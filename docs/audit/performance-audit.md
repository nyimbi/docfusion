# DocuFusion Performance Audit Report

**Date**: 2026-04-06
**Auditor**: Performance Engineer Agent
**Scope**: Codebase-wide performance analysis

## Executive Summary

This audit identified **47 performance issues** across the DocuFusion codebase, categorized by severity:
- **Critical**: 4 issues
- **High**: 12 issues
- **Medium**: 19 issues
- **Low**: 12 issues

Key areas of concern:
1. **HTTP Client Management** - Multiple singleton clients without proper connection pooling
2. **Memory Management** - Unbounded caches and memory leaks in agent systems
3. **Database Operations** - Missing query optimization and connection handling
4. **File Operations** - Synchronous file reads in async contexts
5. **Resource Cleanup** - Incomplete cleanup in error paths

---

## Critical Issues (Severity: Critical)

### CRIT-001: HTTP Client Singleton Without Connection Pooling
**File**: `src/docfusion/infrastructure/litellm_client.py`
**Lines**: 426-435
**Description**: The `get_litellm_client()` function returns a singleton `LiteLLMClient` that creates a new `httpx.AsyncClient` on each access via the `client` property if `_client` is None. However, when used outside the async context manager, the client is never closed, leading to connection leaks.

```python
# Current problematic code
_default_client: LiteLLMClient | None = None

async def get_litellm_client() -> LiteLLMClient:
    global _default_client
    if _default_client is None:
        _default_client = LiteLLMClient()  # No connection pooling config
    return _default_client
```

**Impact**: Connection exhaustion under load, resource leaks, potential memory leaks.
**Recommended Fix**: Configure httpx.AsyncClient with connection limits and implement proper lifecycle management.

### CRIT-002: Memory Leak in Memory Manager
**File**: `src/docfusion/agents/memory/memory_manager.py`
**Lines**: 565-606
**Description**: The `_perform_cleanup()` method iterates over all memories while potentially deleting entries during iteration. The `memory_cache` dictionary can grow unbounded if cleanup intervals are missed or if entries are added faster than cleanup runs.

```python
# Current problematic code
async def _perform_cleanup(self) -> None:
    current_time = datetime.now()
    cleanup_count = 0

    # Remove expired memories
    expired_ids = []
    for entry_id, entry in self.memories.items():
        if entry.expires_at and entry.expires_at < current_time:
            expired_ids.append(entry_id)
```

**Impact**: Unbounded memory growth, OOM conditions in long-running processes.
**Recommended Fix**: Implement proper cache eviction (LRU/LFU), use `weakref` for cached entries, add memory pressure callbacks.

### CRIT-003: Unbounded Queue in Context Manager
**File**: `src/docfusion/agents/memory/context_manager.py`
**Lines**: 168-187
**Description**: The `history` list in `SharedContext` grows unbounded. Every `set()` operation appends to history without size limits.

```python
# Current problematic code
self.history.append({
    "action": "set",
    "key": key,
    "agent_id": agent_id,
    "timestamp": datetime.now().isoformat(),
    "version": entry.version,
})
```

**Impact**: Memory exhaustion in high-traffic scenarios, degraded performance over time.
**Recommended Fix**: Implement circular buffer with configurable max size, add periodic cleanup.

### CRIT-004: Database Session Management - Missing Error Handling
**File**: `src/docfusion/core/database/connection.py`
**Lines**: 196-210
**Description**: The sync session context manager commits on success but doesn't properly handle all error scenarios. If an exception occurs after partial operations, the session may be left in an inconsistent state.

```python
# Current code
@contextmanager
def get_sync_session(self) -> Generator[Session, None, None]:
    if not self._sync_session_maker:
        self._initialize_sync_engine()

    session = self._sync_session_maker()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
```

**Impact**: Data corruption, connection pool exhaustion, orphaned transactions.
**Recommended Fix**: Add explicit flush before commit, implement transaction retry logic, use savepoints for nested operations.

---

## High Issues (Severity: High)

### HIGH-001: N+1 Query Pattern Risk in Knowledge Base
**File**: `src/docfusion/agents/memory/knowledge_base.py`
**Lines**: 109-131
**Description**: The `search_knowledge()` method performs linear search over all nodes in memory, which is O(n) for each search operation. With large knowledge graphs, this becomes a performance bottleneck.

```python
# Current O(n) implementation
async def search_knowledge(self, query: str, ...) -> List[KnowledgeEntry]:
    results = []
    for entry in self.knowledge_graph.nodes.values():  # Linear scan
        if domain and entry.domain != domain:
            continue
        if query.lower() in entry.title.lower():
            results.append(entry)
    return results
```

**Impact**: O(n) search performance degrades with knowledge base size.
**Recommended Fix**: Implement proper indexing (inverted index, semantic search with pgvector), use dictionary lookups for domain filtering.

### HIGH-002: Inefficient String Operations in Content Matching
**File**: `src/docfusion/agents/memory/memory_manager.py`
**Lines**: 631-650
**Description**: The `_matches_query()` method performs multiple string lowercasing operations and linear scans through tags and context.

```python
def _matches_query(self, entry: MemoryEntry, query: str) -> bool:
    query_lower = query.lower()
    content_str = str(entry.content).lower()  # Converts entire content to string + lower
    if query_lower in content_str:
        return True
    for tag in entry.tags:
        if query_lower in tag.lower():
            return True
    return False
```

**Impact**: O(n*m) complexity for search where n=entries and m=avg content length.
**Recommended Fix**: Pre-compute search indexes, use full-text search, implement inverted index.

### HIGH-003: Blocking File I/O in Git Operations
**File**: `src/docfusion/document_engine/git_latex_manager.py`
**Lines**: 101-138
**Description**: File read/write operations are synchronous, blocking the event loop. The `read_content()` and `write_content()` methods use synchronous file I/O.

```python
def read_content(self) -> str:
    content = self.file_path.read_text(encoding='utf-8')  # Blocking I/O
    return content
```

**Impact**: Event loop blocking, degraded concurrency, slow document processing.
**Recommended Fix**: Use `aiofiles` for async file operations, run file I/O in thread pool.

### HIGH-004: Singleton HTTP Clients Without Request Timeout Defaults
**File**: `src/docfusion/infrastructure/searxng_client.py`
**Lines**: 129-148
**Description**: The `client` property creates a new `httpx.AsyncClient` if `_client` is None, but this client is never properly closed when used outside the async context manager.

```python
@property
def client(self) -> httpx.AsyncClient:
    if self._client is None:
        self._client = httpx.AsyncClient(timeout=self.timeout)  # No connection limits
    return self._client
```

**Impact**: Connection pool exhaustion, hanging requests, memory leaks.
**Recommended Fix**: Add connection pool limits, implement proper cleanup, use connection pooling.

### HIGH-005: Large File Read Into Memory
**File**: `src/docfusion/nlp/processors/document_processor.py`
**Lines**: 208-209
**Description**: Entire files are read into memory without size checks, which can cause OOM for large documents.

```python
with open(file_path, "rb") as f:
    file_content = f.read()  # Reads entire file into memory
```

**Impact**: Memory exhaustion with large files, slow processing, potential crashes.
**Recommended Fix**: Stream files in chunks, use memory-mapped files for large documents, implement size limits.

### HIGH-006: Compression Without Size Limits
**File**: `src/docfusion/agents/memory/memory_manager.py`
**Lines**: 619-630
**Description**: Content compression uses `pickle` which can deserialize malicious data, and there's no size limit before compression.

```python
def _compress_content(self, content: Any) -> bytes:
    import gzip
    return gzip.compress(pickle.dumps(content))  # No size limit check

def _decompress_content(self, compressed_content: bytes) -> Any:
    import gzip
    return pickle.loads(gzip.decompress(compressed_content))  # Security risk
```

**Impact**: Memory bombs via large pickles, security vulnerabilities (pickle deserialization attacks).
**Recommended Fix**: Implement size limits before compression, use JSON instead of pickle for trusted serialization.

### HIGH-007: Repeated Pickle Serialization for Size Estimation
**File**: `src/docfusion/agents/memory/memory_manager.py`
**Lines**: 666-672
**Description**: `_update_stats()` calls `pickle.dumps()` on every entry to estimate size, which is computationally expensive.

```python
for entry in self.memories.values():
    try:
        size = len(pickle.dumps(entry.content))  # Expensive per-entry serialization
        total_size += size
    except (TypeError, AttributeError) as e:
        total_size += len(str(entry.content))
```

**Impact**: O(n) serialization cost on every stats update, CPU-bound bottleneck.
**Recommended Fix**: Cache size estimates, update incrementally on store/delete, use sampling.

### HIGH-008: Context Manager Without Depth Limit
**File**: `src/docfusion/agents/memory/context_manager.py`
**Lines**: 628-667
**Description**: `get_inherited_value()` and `propagate_to_children()` can recurse infinitely if there are circular references in the context hierarchy.

```python
async def get_inherited_value(self, context_id: str, key: str, ...) -> Any:
    # ...
    for parent_id, children in self.context_hierarchy.items():
        if context_id in children:
            parent_value = await self.get_inherited_value(parent_id, key, agent_id)  # No depth limit
            # ...
```

**Impact**: Stack overflow, infinite loops, DoS vulnerability.
**Recommended Fix**: Add depth limit parameter, implement visited set tracking, detect cycles.

### HIGH-009: Database Connection Pool Configuration Missing
**File**: `src/docfusion/core/database/connection.py`
**Lines**: 69-81
**Description**: No explicit pool configuration for SQLAlchemy engines. Default settings may not be optimal for production.

```python
engine_options = self.config.get_database_options()
self._sync_engine = create_engine(
    self.config.sqlalchemy_url,
    **engine_options  # No explicit pool_size, max_overflow, pool_timeout
)
```

**Impact**: Connection exhaustion under load, poor connection reuse, unpredictable behavior.
**Recommended Fix**: Configure explicit pool_size, max_overflow, pool_timeout, pool_recycle, pool_pre_ping.

### HIGH-010: AsyncPG Pool Initialization in Hot Path
**File**: `src/docfusion/core/database/connection.py`
**Lines**: 145-173
**Description**: `_initialize_asyncpg_pool()` is called during initialization but can fail silently, leaving the pool in an inconsistent state.

```python
async def _initialize_asyncpg_pool(self) -> None:
    try:
        self._asyncpg_pool = await asyncpg.create_pool(
            self.config.asyncpg_url,
            init=init_connection,
            **pool_options
        )
    except Exception as e:
        self.logger.error(f"Failed to create asyncpg pool: {e}")
        raise  # Good: re-raises, but pool_options may have invalid values
```

**Impact**: Application fails to start, but initialization state inconsistent.
**Recommended Fix**: Add connection pool health check, implement retry logic, validate options before creating pool.

### HIGH-011: Missing Index on Database Queries
**File**: `src/docfusion/core/database/models.py`
**Lines**: Entire file
**Description**: Base models don't define indexes for frequently queried fields like `created_at`, `updated_at`, `is_active`, `deleted_at`. These are commonly filtered fields.

```python
class BaseModel(Base):
    __abstract__ = True
    id = Column(UUID(as_uuid=False), primary_key=True, ...)
    created_at = Column(DateTime(timezone=True), ...)  # No index
    updated_at = Column(DateTime(timezone=True), ...)  # No index
    is_active = Column(Boolean, ...)  # No index
    deleted_at = Column(DateTime(timezone=True), ...)  # No index
```

**Impact**: Full table scans on common queries, slow pagination, poor filter performance.
**Recommended Fix**: Add indexes on `created_at`, `updated_at`, `is_active`, `deleted_at`, and any JSONB columns used in queries.

### HIGH-012: LLM Fallback Chain Without Request Cancellation
**File**: `src/docfusion/infrastructure/llm_fallback.py`
**Lines**: 335-434
**Description**: When providers fail, the fallback chain creates new requests sequentially. If the original request is cancelled (e.g., client disconnect), the fallback continues executing.

```python
async def complete(self, messages: list[ChatMessage | dict[str, str]], ...) -> CompletionResponse:
    for provider in available_providers:
        try:
            response = await self._make_request(...)  # No cancellation check
            return response
        except Exception as e:
            last_error = e
            # ... continue to next provider
```

**Impact**: Resource waste, orphaned requests, cascading failures.
**Recommended Fix**: Pass cancellation token, check `asyncio.current_task().cancelled()`, implement request timeout per provider.

---

## Medium Issues (Severity: Medium)

### MED-001: Linear Search in Knowledge Base Graph
**File**: `src/docfusion/agents/memory/knowledge_base.py`
**Lines**: 134-156
**Description**: `get_related_knowledge()` uses BFS with a list as queue, which has O(n) pop(0) complexity.

```python
async def get_related_knowledge(self, knowledge_id: str, depth: int = 1) -> List[KnowledgeEntry]:
    queue = [(knowledge_id, 0)]
    while queue:
        current_id, current_depth = queue.pop(0)  # O(n) operation
```

**Impact**: O(n^2) for large graphs, degraded performance with knowledge base size.
**Recommended Fix**: Use `collections.deque` for O(1) popleft, or implement adjacency list with sets.

### MED-002: Redundant Dictionary Copy Operations
**File**: `src/docfusion/agents/memory/context_manager.py`
**Lines**: 307-328
**Description**: `get_all()` creates a new dictionary and iterates over all entries, copying values.

```python
async def get_all(self, agent_id: Optional[str] = None, ...) -> Dict[str, Any]:
    async with self._lock:
        result = {}
        for key, entry in self.entries.items():
            # ... filtering logic
            result[key] = entry.value  # Copies all values
        return result
```

**Impact**: Memory overhead, O(n) copy operation, slow for large context spaces.
**Recommended Fix**: Return iterator/generator, implement lazy evaluation, add pagination.

### MED-003: String Concatenation in Loops
**File**: `src/docfusion/document_engine/git_latex_manager.py`
**Lines**: 772-836
**Description**: `_generate_main_document()` uses string concatenation in loops for building LaTeX content.

```python
content_includes = []
for block in config.get('content_blocks', []):
    # ...
    content_includes.append(f"\\input{{blocks/{block}}}")  # Multiple string operations
```

**Impact**: Memory fragmentation for large documents, O(n^2) with naive implementation.
**Recommended Fix**: Use list join (already partially done), pre-allocate buffer size.

### MED-004: DateTime.now() Called in Loops
**File**: `src/docfusion/agents/memory/context_manager.py`
**Lines**: Multiple locations
**Description**: `datetime.now()` is called repeatedly in loops instead of being captured once.

```python
# Line 147-148
entry.updated_at = datetime.now()  # Called per entry update
# Line 173
"timestamp": datetime.now().isoformat(),  # Called per history entry
```

**Impact**: Unnecessary system calls, inconsistent timestamps within operations.
**Recommended Fix**: Capture `now = datetime.now()` once at the start of batch operations.

### MED-005: JSON Encoding in Hot Path
**File**: `src/docfusion/agents/memory/memory_manager.py`
**Lines**: 723-736
**Description**: `export_memories()` serializes all memories to JSON without streaming, causing memory spike for large exports.

```python
async def export_memories(self, format_type: str = "json") -> str:
    export_data = {}
    for entry_id, entry in self.memories.items():
        export_data[entry_id] = {...}  # Builds entire dict in memory
    return json.dumps(export_data, indent=2)  # Serializes all at once
```

**Impact**: Memory spike proportional to memory size, slow for large datasets.
**Recommended Fix**: Use streaming JSON encoder, implement pagination, write to file directly.

### MED-006: Cache Without TTL in Document Engine
**File**: `src/docfusion/document_engine/performance_optimizer.py`
**Lines**: 227-233
**Description**: Cache initialization doesn't set TTL or max size limits.

```python
if self.baseline_metrics.cache_efficiency < 0.7:
    if not self.engine.enable_caching:
        self.engine.enable_caching = True
        self.engine.cache = {}  # Unbounded cache, no TTL
        self.engine.cache_stats = {'hits': 0, 'misses': 0}
```

**Impact**: Memory growth, stale cached data, no eviction policy.
**Recommended Fix**: Use `functools.lru_cache`, `cachetools.TTLCache`, or implement max_size with TTL.

### MED-007: Sleep Without Cancellation Check
**File**: `src/docfusion/infrastructure/llm_fallback.py`
**Lines**: 569-578
**Description**: Health check loop uses fixed sleep without checking if the task should stop.

```python
async def _health_check_loop(self) -> None:
    while self._running:
        try:
            await asyncio.sleep(self._health_check_interval)
            await self.health_check()
        except asyncio.CancelledError:
            break
        except Exception as e:
            self.logger.error(f"Health check loop error: {e}")
```

**Impact**: Delayed shutdown, unnecessary health checks during shutdown.
**Recommended Fix**: Use `asyncio.wait_for` with cancellation, check `_running` flag more frequently.

### MED-008: Inefficient List Operations in Cleanup
**File**: `src/docfusion/agents/memory/memory_manager.py`
**Lines**: 572-591
**Description**: Cleanup collects all expired IDs first, then deletes one by one.

```python
# Remove expired memories
expired_ids = []
for entry_id, entry in self.memories.items():
    if entry.expires_at and entry.expires_at < current_time:
        expired_ids.append(entry_id)

for entry_id in expired_ids:
    await self.delete_memory(entry_id)  # Individual delete operations
```

**Impact**: O(n) iteration + O(m) individual deletes = O(n + m * delete_cost).
**Recommended Fix**: Batch delete with single dict comprehension, use `dict.pop(key, None)` in loop.

### MED-009: Global State in Singleton Clients
**File**: `src/docfusion/infrastructure/litellm_client.py`
**Lines**: 426-435
**Description**: Global singleton `_default_client` can cause issues in tests and multi-tenant scenarios.

```python
_default_client: LiteLLMClient | None = None

async def get_litellm_client() -> LiteLLMClient:
    global _default_client
    if _default_client is None:
        _default_client = LiteLLMClient()
    return _default_client
```

**Impact**: State bleeding between tests, thread-safety issues, hidden dependencies.
**Recommended Fix**: Use dependency injection, context variables, or factory pattern instead of globals.

### MED-010: Missing Connection Pool Limits in AsyncPG
**File**: `src/docfusion/agents/memory/persistent_adapter.py`
**Lines**: 293-298
**Description**: AsyncPG pool created with `pool_size` and `max_pool_size` but no explicit timeout or command timeout validation.

```python
self.pool = await asyncpg.create_pool(
    self.config.database_url,
    min_size=self.config.pool_size,
    max_size=self.config.max_pool_size,
    command_timeout=self.config.command_timeout,
    # Missing: connection_timeout, max_queries, max_inactive_connection_lifetime
)
```

**Impact**: Connections may hang indefinitely, pool exhaustion in edge cases.
**Recommended Fix**: Add `connection_timeout`, `max_queries`, `max_inactive_connection_lifetime`.

### MED-011: Inefficient Set Operations in Memory Index
**File**: `src/docfusion/agents/memory/memory_manager.py`
**Lines**: 188-194
**Description**: `find_by_tags()` computes intersection for each tag set, creating intermediate sets.

```python
def find_by_tags(self, tags: Set[str]) -> Set[str]:
    if not tags:
        return set()
    result_sets = [self.tag_index.get(tag, set()) for tag in tags]
    return set.intersection(*result_sets) if result_sets else set()
```

**Impact**: Memory allocation for intermediate sets, O(k*n) for k tags.
**Recommended Fix**: Sort tags by set size ascending, accumulate intersection incrementally.

### MED-012: Dictionary Rebuild in Stats Update
**File**: `src/docfusion/agents/memory/memory_manager.py`
**Lines**: 652-675
**Description**: `_update_stats()` rebuilds type and scope counts dictionaries every call.

```python
def _update_stats(self) -> None:
    type_counts = {t: 0 for t in MemoryType}  # Rebuilds every call
    scope_counts = {s: 0 for s in MemoryScope}  # Rebuilds every call
    # ...
    self.stats["entries_by_type"] = type_counts  # Full replacement
    self.stats["entries_by_scope"] = scope_counts  # Full replacement
```

**Impact**: O(n) per call, unnecessary dictionary allocations.
**Recommended Fix**: Increment counters on store/delete, use `defaultdict(int)`.

### MED-013: Synchronous Git Operations in Async Methods
**File**: `src/docfusion/document_engine/git_latex_manager.py`
**Lines**: 229-276
**Description**: Git operations (`repo.index.add`, `repo.index.commit`) are synchronous but called from async methods.

```python
async def generate_content_block(...) -> str:
    # ... async method
    block.write_content(...)  # Synchronous Git operations inside
```

**Impact**: Event loop blocking during Git operations.
**Recommended Fix**: Run Git operations in thread pool with `asyncio.to_thread()`.

### MED-014: Missing Vacuum/Analyze After Bulk Operations
**File**: `src/docfusion/core/database/connection.py`
**Lines**: N/A
**Description**: No VACUUM or ANALYZE operations after bulk inserts/updates, leading to table bloat and poor query plans.

**Impact**: Degraded query performance over time, table bloat.
**Recommended Fix**: Add post-bulk-operation maintenance, implement periodic vacuum schedule.

### MED-015: Context Switching in Tight Loops
**File**: `src/docfusion/agents/memory/context_manager.py`
**Lines**: 169-176
**Description**: History append happens inside lock, but notification is called inside lock too.

```python
async with self._lock:
    # ... modify entries
    self.history.append(...)  # Inside lock
    await self._notify_observers(...)  # Also inside lock - can block other operations
```

**Impact**: Lock held during potentially slow notification callbacks.
**Recommended Fix**: Collect observers to notify, release lock, then notify.

### MED-016: Redundant JSON Serialization in Git Latex Manager
**File**: `src/docfusion/document_engine/git_latex_manager.py`
**Lines**: 556-568
**Description**: `_create_metadata_header()` calls `json.dumps()` for metadata on every block creation.

```python
header = f"""% Block metadata: type={block_type}, priority=high, dependencies=[]
% AI-generated: {str(ai_generated).lower()}
% Last modified: {timestamp}
% Requirements: {json.dumps(requirements, default=str)}"""  # JSON serialization per block
```

**Impact**: CPU overhead for JSON serialization, repeated work for similar metadata.
**Recommended Fix**: Cache common metadata patterns, use string templates with escaping.

### MED-017: No Batch Insert for Document Operations
**File**: `src/docfusion/document_engine/assembler/content_assembler.py`
**Lines**: N/A (architectural)
**Description**: Content blocks are processed one by one without batching opportunities for database operations.

**Impact**: N database roundtrips for N blocks, inefficient network usage.
**Recommended Fix**: Implement batch insert/update patterns, use bulk operations.

### MED-018: Cache Stats Without Atomicity
**File**: `src/docfusion/document_engine/performance_optimizer.py`
**Lines**: 104-107
**Description**: Cache efficiency calculation reads hits and misses non-atomically.

```python
total_requests = cache_stats['hits'] + cache_stats['misses']
cache_efficiency = cache_stats['hits'] / total_requests
```

**Impact**: Inconsistent metrics under concurrent access.
**Recommended Fix**: Use atomic counters (`threading.Atomic`), lock-protected reads.

### MED-019: Repeated UUID Generation
**File**: Multiple files use `uuid7str()` or `uuid.uuid4()` inline
**Description**: UUID generation called in hot paths without batching or caching.

```python
# Common pattern across multiple files
entry_id: str = Field(default_factory=uuid7str)  # UUID generation per instance
```

**Impact**: CPU overhead for UUID generation in tight loops.
**Recommended Fix**: Pre-generate batch of UUIDs, use `uuid.uuid1()` for faster generation when ordering matters.

---

## Low Issues (Severity: Low)

### LOW-001: Unused Import in Performance Optimizer
**File**: `src/docfusion/document_engine/performance_optimizer.py`
**Lines**: 371-372
**Description**: `DocumentGenerationConfiguration` imported inside function.

```python
from docfusion.document_engine.document_engine import DocumentGenerationRequest, DocumentGenerationConfiguration
```

**Impact**: Import overhead on function call.
**Recommended Fix**: Move import to module level.

### LOW-002: Missing Type Hints
**File**: `src/docfusion/agents/memory/memory_manager.py`
**Lines**: Multiple functions
**Description**: Some helper methods missing return type hints.

**Impact**: IDE support issues, mypy warnings.
**Recommended Fix**: Add complete type hints for all public methods.

### LOW-003: Magic Numbers in Performance Grading
**File**: `src/docfusion/document_engine/performance_optimizer.py`
**Lines**: 179-209
**Description**: Performance grade thresholds are hardcoded magic numbers.

```python
if total_time < 0.5:
    score = 95
elif total_time < 1.0:
    score = 85
# ...
```

**Impact**: Difficult to tune, unclear business logic.
**Recommended Fix**: Extract to configuration class with documentation.

### LOW-004: Hardcoded Retry Intervals
**File**: `src/docfusion/core/database/session.py`
**Lines**: 163-166
**Description**: Retry sleep intervals use magic numbers without configuration.

```python
time.sleep(wait_time)  # wait_time = backoff_factor * (2 ** attempt)
```

**Impact**: Difficult to tune for different environments.
**Recommended Fix**: Add to configuration class.

### LOW-005: Logger Initialization Pattern
**File**: Multiple files
**Description**: Loggers created per instance instead of module-level.

```python
self.logger = logging.getLogger(f"memory.{agent_id}")  # Per-instance logger
```

**Impact**: Minor memory overhead, inconsistent logging patterns.
**Recommended Fix**: Use module-level loggers where appropriate.

### LOW-006: No Docstring for Private Methods
**File**: Multiple files
**Description**: Many `_private` methods lack docstrings.

**Impact**: Code maintenance difficulty.
**Recommended Fix**: Add brief docstrings for complex private methods.

### LOW-007: Inconsistent Error Handling
**File**: `src/docfusion/infrastructure/firecrawl_client.py`
**Lines**: 241-247
**Description**: Some errors return `ScrapeResult` with `success=False`, others raise exceptions.

```python
except httpx.HTTPError as e:
    logger.error(f"Firecrawl scrape failed for {url}: {e}")
    return ScrapeResult(success=False, url=url, error=str(e))  # Returns error
```

**Impact**: Inconsistent error handling patterns across codebase.
**Recommended Fix**: Standardize on either exception-based or result-based error handling.

### LOW-008: Mutable Default Arguments
**File**: `src/docfusion/document_engine/git_latex_manager.py`
**Lines**: 680-706
**Description**: `create_document_config()` has `appendices: list[str] = None` which should use `None` and check inside.

```python
async def create_document_config(
    self,
    # ...
    appendices: list[str] = None,  # Should use Optional[List[str]]
    # ...
) -> dict[str, Any]:
    config = {
        # ...
        "appendices": appendices or [],  # Correct handling, but signature is misleading
    }
```

**Impact**: Type checker confusion, potential None iteration.
**Recommended Fix**: Use `appendices: list[str] | None = None` type hint.

### LOW-009: Duplicate Code in Client Factories
**File**: `src/docfusion/infrastructure/*.py`
**Description**: SearXNGClient, FirecrawlClient, LiteLLMClient have similar `__aenter__`, `__aexit__`, `client` property patterns.

**Impact**: Code duplication, maintenance burden.
**Recommended Fix**: Create base `AsyncClient` class with common patterns.

### LOW-010: Unused Variables in Tests
**File**: Various test files
**Description**: Some test files have unused variables or imports.

**Impact**: Code cleanliness, linting warnings.
**Recommended Fix**: Clean up unused imports and variables.

### LOW-011: Inconsistent Naming Conventions
**File**: Multiple files
**Description**: Mix of `snake_case` and `camelCase` in some areas, particularly in config keys.

```python
font_size=config.get('font_size', '11pt'),  # snake_case
paper_size=config.get('paper_size', 'letterpaper'),  # snake_case
# vs
"documentClass": config.get('document_class', 'article'),  # Mixed
```

**Impact**: Code consistency, potential confusion.
**Recommended Fix**: Standardize on snake_case for Python, camelCase for JSON/external APIs.

### LOW-012: Missing `__all__` Exports
**File**: Multiple modules
**Description**: Many modules don't define `__all__` for explicit public API.

**Impact**: Import wildcard issues, unclear module boundaries.
**Recommended Fix**: Add `__all__` to public modules.

---

## Performance Optimization Recommendations

### Priority 1: Connection Pooling
1. Create a centralized HTTP client pool manager
2. Configure connection limits, timeouts, and retry policies
3. Implement proper lifecycle management for singleton clients

### Priority 2: Memory Management
1. Add memory limits to caches and in-memory stores
2. Implement LRU eviction for caches
3. Add memory pressure callbacks for graceful degradation

### Priority 3: Database Optimization
1. Add indexes to commonly queried columns
2. Implement batch operations for bulk inserts/updates
3. Configure connection pool parameters explicitly

### Priority 4: Async Improvements
1. Convert synchronous file I/O to async with `aiofiles`
2. Use thread pools for blocking operations
3. Implement proper cancellation handling

### Priority 5: Caching Strategy
1. Implement distributed caching (Redis) for production
2. Add TTL to all caches
3. Use cache invalidation on data changes

---

## Metrics and Benchmarks Required

To fully assess performance, the following benchmarks should be established:

1. **HTTP Client Pool Utilization**: Track connection reuse ratio, wait time for connections
2. **Memory Growth Rate**: Monitor memory usage over time, identify leak patterns
3. **Database Query Performance**: Enable query logging, identify slow queries
4. **Cache Hit/Miss Ratio**: Track cache effectiveness per subsystem
5. **Document Processing Pipeline**: Measure time per stage (assembly, rendering, etc.)

---

## Conclusion

This performance audit identified significant optimization opportunities across the codebase. The most critical issues relate to:

1. **Resource Management**: HTTP clients, database connections, and memory all need proper lifecycle management
2. **Algorithmic Efficiency**: Linear searches and unbounded growth in memory systems
3. **Async Patterns**: Blocking I/O in async contexts and missing cancellation handling

Addressing these issues will improve system reliability, reduce resource consumption, and enable better scalability.

---

*Report generated by Performance Engineer Agent*
*DocuFusion Performance Audit - 2026-04-06*