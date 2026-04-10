"""
Memory Manager

Advanced memory management system for agents with persistent storage,
retrieval, and context-aware memory organization.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import hashlib
import json
import logging
import pickle  # noqa: S403 - used for trusted internal memory serialization only
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

from cachetools import TTLCache  # type: ignore[import-untyped]
from pydantic import BaseModel, ConfigDict, Field
from ...core.utils import uuid7str

try:
except ImportError:
    import uuid

    class MemoryType(str, Enum):
    """Types of memory storage"""

    SHORT_TERM = "short_term"  # Temporary working memory
    LONG_TERM = "long_term"  # Persistent memory
    EPISODIC = "episodic"  # Event-based memories
    SEMANTIC = "semantic"  # Knowledge-based memories
    PROCEDURAL = "procedural"  # Skill and process memories
    WORKING = "working"  # Active task context
    SHARED = "shared"  # Inter-agent shared memories

class MemoryScope(str, Enum):
    """Memory access scope"""

    PRIVATE = "private"  # Agent-specific memory
    CREW = "crew"  # Crew-level shared memory
    SWARM = "swarm"  # Swarm-level collective memory
    GLOBAL = "global"  # System-wide shared memory
    PROJECT = "project"  # Project-specific memory

class MemoryPriority(str, Enum):
    """Memory retention priority"""

    CRITICAL = "critical"  # Never delete
    HIGH = "high"  # High retention priority
    MEDIUM = "medium"  # Normal retention
    LOW = "low"  # Can be deleted if needed
    TEMPORARY = "temporary"  # Delete after session

@dataclass
class MemoryEntry:
    """Individual memory entry"""

    entry_id: str = field(default_factory=uuid7str)
    content: Any = None
    memory_type: MemoryType = MemoryType.WORKING
    scope: MemoryScope = MemoryScope.PRIVATE
    priority: MemoryPriority = MemoryPriority.MEDIUM

    # Metadata
    created_at: datetime = field(default_factory=datetime.now)
    last_accessed: datetime = field(default_factory=datetime.now)
    access_count: int = 0
    tags: Set[str] = field(default_factory=set)
    context: Dict[str, Any] = field(default_factory=dict)

    # Relationships
    related_entries: Set[str] = field(default_factory=set)
    parent_entry: Optional[str] = None
    child_entries: Set[str] = field(default_factory=set)

    # Storage and retrieval
    content_hash: Optional[str] = None
    compressed: bool = False
    encrypted: bool = False

    # Lifecycle
    ttl_seconds: Optional[int] = None
    expires_at: Optional[datetime] = None
    retention_policy: Optional[str] = None

class MemoryConfig(BaseModel):
    """Memory manager configuration"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    # Storage limits
    max_short_term_entries: int = Field(default=1000, ge=10)
    max_long_term_entries: int = Field(default=10000, ge=100)
    max_total_memory_mb: int = Field(default=500, ge=10)

    # Retention policies
    short_term_ttl_hours: int = Field(default=24, ge=1)
    working_memory_ttl_minutes: int = Field(default=60, ge=5)
    cleanup_interval_minutes: int = Field(default=30, ge=5)

    # Cache settings - TTL-based eviction prevents unbounded growth
    cache_size: int = Field(default=100, ge=10)
    cache_ttl_seconds: int = Field(default=3600, ge=60, description="Cache entry TTL in seconds (default 1 hour)")

    # Features
    enable_compression: bool = Field(default=True)
    enable_encryption: bool = Field(default=False)
    enable_persistence: bool = Field(default=True)
    enable_indexing: bool = Field(default=True)

    # Performance
    batch_size: int = Field(default=50, ge=1)
    async_operations: bool = Field(default=True)

class MemoryIndex:
    """Memory indexing system for fast retrieval"""

    def __init__(self):
        self.content_index: Dict[str, Set[str]] = {}  # content_hash -> entry_ids
        self.tag_index: Dict[str, Set[str]] = {}  # tag -> entry_ids
        self.type_index: Dict[MemoryType, Set[str]] = {}  # type -> entry_ids
        self.scope_index: Dict[MemoryScope, Set[str]] = {}  # scope -> entry_ids
        self.time_index: Dict[str, Set[str]] = {}  # time_bucket -> entry_ids
        self.relationship_index: Dict[str, Set[str]] = {}  # entry_id -> related_ids

    def add_entry(self, entry: MemoryEntry) -> None:
        """Add entry to all relevant indexes"""
        entry_id = entry.entry_id

        # Content hash index
        if entry.content_hash:
            if entry.content_hash not in self.content_index:
                self.content_index[entry.content_hash] = set()
            self.content_index[entry.content_hash].add(entry_id)

        # Tag index
        for tag in entry.tags:
            if tag not in self.tag_index:
                self.tag_index[tag] = set()
            self.tag_index[tag].add(entry_id)

        # Type index
        if entry.memory_type not in self.type_index:
            self.type_index[entry.memory_type] = set()
        self.type_index[entry.memory_type].add(entry_id)

        # Scope index
        if entry.scope not in self.scope_index:
            self.scope_index[entry.scope] = set()
        self.scope_index[entry.scope].add(entry_id)

        # Time bucket index
        time_bucket = entry.created_at.strftime("%Y-%m-%d-%H")
        if time_bucket not in self.time_index:
            self.time_index[time_bucket] = set()
        self.time_index[time_bucket].add(entry_id)

        # Relationship index
        self.relationship_index[entry_id] = entry.related_entries.copy()

    def remove_entry(self, entry: MemoryEntry) -> None:
        """Remove entry from all indexes"""
        entry_id = entry.entry_id

        # Remove from all indexes
        for index in [
            self.content_index,
            self.tag_index,
            self.type_index,
            self.scope_index,
            self.time_index,
        ]:
            for key, entry_set in index.items():
                entry_set.discard(entry_id)

        self.relationship_index.pop(entry_id, None)

    def find_by_tags(self, tags: Set[str]) -> Set[str]:
        """Find entries by tags"""
        if not tags:
            return set()

        result_sets = [self.tag_index.get(tag, set()) for tag in tags]
        return set.intersection(*result_sets) if result_sets else set()

    def find_by_type(self, memory_type: MemoryType) -> Set[str]:
        """Find entries by type"""
        return self.type_index.get(memory_type, set()).copy()

    def find_by_scope(self, scope: MemoryScope) -> Set[str]:
        """Find entries by scope"""
        return self.scope_index.get(scope, set()).copy()

    def find_by_content_hash(self, content_hash: str) -> Set[str]:
        """Find entries by content hash"""
        return self.content_index.get(content_hash, set()).copy()

class MemoryManager:
    """
    Advanced memory management system for agents

    Provides sophisticated memory storage, retrieval, and organization
    with support for different memory types, scopes, and retention policies.
    """

    def __init__(self, agent_id: str, config: Optional[MemoryConfig] = None):
        self.agent_id = agent_id
        self.config = config or MemoryConfig()

        # Memory storage
        self.memories: Dict[str, MemoryEntry] = {}
        # TTL-based cache with automatic eviction - prevents unbounded growth
        self.memory_cache: TTLCache[str, MemoryEntry] = TTLCache(
            maxsize=self.config.cache_size,
            ttl=self.config.cache_ttl_seconds
        )

        # Indexing and search
        self.index = MemoryIndex()

        # Memory statistics
        self.stats = {
            "total_entries": 0,
            "entries_by_type": {t: 0 for t in MemoryType},
            "entries_by_scope": {s: 0 for s in MemoryScope},
            "memory_usage_mb": 0.0,
            "cache_hits": 0,
            "cache_misses": 0,
            "last_cleanup": datetime.now(),
        }

        # Memory management
        self._cleanup_task: Optional[asyncio.Task] = None
        self._running = False

        self.logger = logging.getLogger(f"memory.{agent_id}")
        self.logger.info(f"Memory manager initialized for agent {agent_id}")

    async def start(self) -> None:
        """Start memory manager"""
        if self._running:
            return

        self._running = True

        # Load persistent memories if enabled
        if self.config.enable_persistence:
            await self._load_persistent_memories()

        # Start cleanup task
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        self.logger.info("Memory manager started")

    async def stop(self) -> None:
        """Stop memory manager"""
        if not self._running:
            return

        self._running = False

        # Cancel cleanup task
        if self._cleanup_task:
            self._cleanup_task.cancel()

        # Save persistent memories
        if self.config.enable_persistence:
            await self._save_persistent_memories()

        self.logger.info("Memory manager stopped")

    # Memory operations

    async def store_memory(
        self,
        content: Any,
        memory_type: MemoryType = MemoryType.WORKING,
        scope: MemoryScope = MemoryScope.PRIVATE,
        priority: MemoryPriority = MemoryPriority.MEDIUM,
        tags: Optional[Set[str]] = None,
        context: Optional[Dict[str, Any]] = None,
        ttl_seconds: Optional[int] = None,
    ) -> str:
        """Store a memory entry"""
        try:
            # Create memory entry
            entry = MemoryEntry(
                content=content,
                memory_type=memory_type,
                scope=scope,
                priority=priority,
                tags=tags or set(),
                context=context or {},
                ttl_seconds=ttl_seconds,
            )

            # Set expiration
            if ttl_seconds:
                entry.expires_at = datetime.now() + timedelta(seconds=ttl_seconds)
            elif memory_type == MemoryType.SHORT_TERM:
                entry.expires_at = datetime.now() + timedelta(
                    hours=self.config.short_term_ttl_hours
                )
            elif memory_type == MemoryType.WORKING:
                entry.expires_at = datetime.now() + timedelta(
                    minutes=self.config.working_memory_ttl_minutes
                )

            # Generate content hash
            entry.content_hash = self._generate_content_hash(content)

            # Compression if enabled
            if self.config.enable_compression and len(str(content)) > 1000:
                entry.compressed = True
                entry.content = self._compress_content(content)

            # Check for duplicates
            duplicate_ids = self.index.find_by_content_hash(entry.content_hash)
            if duplicate_ids:
                # Update existing entry instead of creating duplicate
                existing_id = next(iter(duplicate_ids))
                existing_entry = self.memories[existing_id]
                existing_entry.last_accessed = datetime.now()
                existing_entry.access_count += 1
                return existing_id

            # Store memory
            self.memories[entry.entry_id] = entry
            self.index.add_entry(entry)

            # Update cache - TTLCache handles eviction automatically
            self.memory_cache[entry.entry_id] = entry

            # Update statistics
            self._update_stats()

            self.logger.debug(f"Stored memory: {entry.entry_id} ({memory_type})")
            return entry.entry_id

        except Exception as e:
            self.logger.error(f"Failed to store memory: {e}")
            raise

    async def retrieve_memory(self, entry_id: str) -> Optional[MemoryEntry]:
        """Retrieve a specific memory entry"""
        try:
            # Check cache first - TTLCache handles eviction automatically
            if entry_id in self.memory_cache:
                entry = self.memory_cache[entry_id]
                self.stats["cache_hits"] += 1
            else:
                # Load from storage
                entry = self.memories.get(entry_id)
                if entry:
                    self.stats["cache_misses"] += 1
                    # Add to cache - TTLCache handles eviction automatically
                    self.memory_cache[entry_id] = entry

            if entry:
                # Update access information
                entry.last_accessed = datetime.now()
                entry.access_count += 1

                # Decompress if needed
                if entry.compressed:
                    entry.content = self._decompress_content(entry.content)
                    entry.compressed = False

                self.logger.debug(f"Retrieved memory: {entry_id}")

            return entry

        except Exception as e:
            self.logger.error(f"Failed to retrieve memory {entry_id}: {e}")
            return None

    async def search_memories(
        self,
        query: Optional[str] = None,
        tags: Optional[Set[str]] = None,
        memory_type: Optional[MemoryType] = None,
        scope: Optional[MemoryScope] = None,
        date_range: Optional[Tuple[datetime, datetime]] = None,
        limit: int = 50,
    ) -> List[MemoryEntry]:
        """Search memories with various criteria"""
        try:
            result_ids: Set[str] = set()

            # Start with all entries
            if not any([tags, memory_type, scope, date_range]):
                result_ids = set(self.memories.keys())
            else:
                # Apply filters
                filter_sets = []

                if tags:
                    filter_sets.append(self.index.find_by_tags(tags))

                if memory_type:
                    filter_sets.append(self.index.find_by_type(memory_type))

                if scope:
                    filter_sets.append(self.index.find_by_scope(scope))

                # Intersect all filter results
                if filter_sets:
                    result_ids = set.intersection(*filter_sets)

            # Apply date range filter
            if date_range:
                start_date, end_date = date_range
                filtered_ids = set()
                for entry_id in result_ids:
                    entry = self.memories[entry_id]
                    if start_date <= entry.created_at <= end_date:
                        filtered_ids.add(entry_id)
                result_ids = filtered_ids

            # Text search in content
            if query:
                query_filtered = set()
                for entry_id in result_ids:
                    entry = self.memories[entry_id]
                    if self._matches_query(entry, query):
                        query_filtered.add(entry_id)
                result_ids = query_filtered

            # Convert to entries and sort
            results = []
            for entry_id in result_ids:
                entry = self.memories[entry_id]
                results.append(entry)

            # Sort by relevance/recency
            results.sort(key=lambda x: (x.access_count, x.last_accessed), reverse=True)

            return results[:limit]

        except Exception as e:
            self.logger.error(f"Memory search failed: {e}")
            return []

    async def delete_memory(self, entry_id: str) -> bool:
        """Delete a memory entry"""
        try:
            if entry_id not in self.memories:
                return False

            entry = self.memories[entry_id]

            # Remove from indexes
            self.index.remove_entry(entry)

            # Remove from storage
            del self.memories[entry_id]

            # Remove from cache
            self.memory_cache.pop(entry_id, None)

            # Update statistics
            self._update_stats()

            self.logger.debug(f"Deleted memory: {entry_id}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to delete memory {entry_id}: {e}")
            return False

    async def create_memory_association(
        self, entry_id1: str, entry_id2: str, relationship_type: str = "related"
    ) -> bool:
        """Create association between two memories"""
        try:
            entry1 = self.memories.get(entry_id1)
            entry2 = self.memories.get(entry_id2)

            if not entry1 or not entry2:
                return False

            # Create bidirectional relationship
            entry1.related_entries.add(entry_id2)
            entry2.related_entries.add(entry_id1)

            # Update context
            if "relationships" not in entry1.context:
                entry1.context["relationships"] = {}
            entry1.context["relationships"][entry_id2] = relationship_type

            if "relationships" not in entry2.context:
                entry2.context["relationships"] = {}
            entry2.context["relationships"][entry_id1] = relationship_type

            # Update indexes
            self.index.relationship_index[entry_id1] = entry1.related_entries.copy()
            self.index.relationship_index[entry_id2] = entry2.related_entries.copy()

            self.logger.debug(
                f"Created memory association: {entry_id1} <-> {entry_id2}"
            )
            return True

        except Exception as e:
            self.logger.error(f"Failed to create memory association: {e}")
            return False

    async def get_related_memories(
        self, entry_id: str, depth: int = 1
    ) -> List[MemoryEntry]:
        """Get related memories up to specified depth"""
        try:
            visited = set()
            related = []
            queue = [(entry_id, 0)]

            while queue:
                current_id, current_depth = queue.pop(0)

                if current_id in visited or current_depth > depth:
                    continue

                visited.add(current_id)

                if current_id != entry_id:  # Don't include the original entry
                    entry = self.memories.get(current_id)
                    if entry:
                        related.append(entry)

                # Add related entries to queue
                if current_depth < depth:
                    entry = self.memories.get(current_id)
                    if entry:
                        for related_id in entry.related_entries:
                            if related_id not in visited:
                                queue.append((related_id, current_depth + 1))

            return related

        except Exception as e:
            self.logger.error(f"Failed to get related memories: {e}")
            return []

    # Memory management and maintenance

    async def _cleanup_loop(self) -> None:
        """Background cleanup loop"""
        while self._running:
            try:
                await self._perform_cleanup()
                await asyncio.sleep(self.config.cleanup_interval_minutes * 60)
            except Exception as e:
                self.logger.error(f"Cleanup error: {e}")
                await asyncio.sleep(60)

    async def _perform_cleanup(self) -> None:
        """Perform memory cleanup - TTLCache handles cache eviction automatically"""
        current_time = datetime.now()
        cleanup_count = 0

        # Remove expired memories
        expired_ids = []
        for entry_id, entry in self.memories.items():
            if entry.expires_at and entry.expires_at < current_time:
                expired_ids.append(entry_id)

        for entry_id in expired_ids:
            await self.delete_memory(entry_id)
            cleanup_count += 1

        # Enforce memory limits
        if len(self.memories) > self.config.max_long_term_entries:
            # Remove least accessed memories
            entries_by_access = sorted(
                self.memories.values(), key=lambda x: (x.access_count, x.last_accessed)
            )

            to_remove = len(self.memories) - self.config.max_long_term_entries
            for entry in entries_by_access[:to_remove]:
                if entry.priority != MemoryPriority.CRITICAL:
                    await self.delete_memory(entry.entry_id)
                    cleanup_count += 1

        # Note: TTLCache handles cache eviction automatically based on TTL
        # No manual cache cleanup needed - entries expire automatically

        if cleanup_count > 0:
            self.logger.info(f"Cleaned up {cleanup_count} memory entries")

        self.stats["last_cleanup"] = current_time

    def _generate_content_hash(self, content: Any) -> str:
        """Generate hash for content deduplication"""
        try:
            content_str = (
                str(content) if not isinstance(content, (str, bytes)) else content
            )
            return hashlib.md5(content_str.encode()).hexdigest()
        except (TypeError, AttributeError, UnicodeEncodeError) as e:
            self.logger.warning(f"Content hash primary encoding failed, using fallback: {e}")
            return hashlib.md5(str(content).encode()).hexdigest()

    def _compress_content(self, content: Any) -> bytes:
        """Compress content for storage"""
        import gzip

        return gzip.compress(pickle.dumps(content))

    def _decompress_content(self, compressed_content: bytes) -> Any:
        """Decompress content for retrieval"""
        import gzip

        return pickle.loads(gzip.decompress(compressed_content))

    def _matches_query(self, entry: MemoryEntry, query: str) -> bool:
        """Check if entry matches text query"""
        query_lower = query.lower()

        # Search in content
        content_str = str(entry.content).lower()
        if query_lower in content_str:
            return True

        # Search in tags
        for tag in entry.tags:
            if query_lower in tag.lower():
                return True

        # Search in context
        context_str = str(entry.context).lower()
        if query_lower in context_str:
            return True

        return False

    def _update_stats(self) -> None:
        """Update memory statistics"""
        self.stats["total_entries"] = len(self.memories)

        # Count by type and scope
        type_counts = {t: 0 for t in MemoryType}
        scope_counts = {s: 0 for s in MemoryScope}

        total_size = 0
        for entry in self.memories.values():
            type_counts[entry.memory_type] += 1
            scope_counts[entry.scope] += 1

            # Estimate size
            try:
                size = len(pickle.dumps(entry.content))  # noqa: S301 - trusted internal data only
                total_size += size
            except (TypeError, AttributeError) as e:
                self.logger.debug(f"Could not serialize content for size estimation: {e}")
                total_size += len(str(entry.content))

        self.stats["entries_by_type"] = type_counts
        self.stats["entries_by_scope"] = scope_counts
        self.stats["memory_usage_mb"] = total_size / (1024 * 1024)

    async def _load_persistent_memories(self) -> None:
        """Load persistent memories from storage"""
        # Placeholder implementation - would load from database/file
        pass

    async def _save_persistent_memories(self) -> None:
        """Save persistent memories to storage"""
        # Placeholder implementation - would save to database/file
        pass

    # Public interface methods

    def get_memory_stats(self) -> Dict[str, Any]:
        """Get memory manager statistics"""
        self._update_stats()
        return self.stats.copy()

    async def clear_memories(
        self,
        memory_type: Optional[MemoryType] = None,
        scope: Optional[MemoryScope] = None,
        keep_critical: bool = True,
    ) -> int:
        """Clear memories with optional filters"""
        cleared_count = 0

        entries_to_clear = []
        for entry in self.memories.values():
            # Apply filters
            if memory_type and entry.memory_type != memory_type:
                continue
            if scope and entry.scope != scope:
                continue
            if keep_critical and entry.priority == MemoryPriority.CRITICAL:
                continue

            entries_to_clear.append(entry.entry_id)

        for entry_id in entries_to_clear:
            if await self.delete_memory(entry_id):
                cleared_count += 1

        return cleared_count

    async def export_memories(self, format_type: str = "json") -> str:
        """Export memories to specified format"""
        if format_type == "json":
            export_data = {}
            for entry_id, entry in self.memories.items():
                export_data[entry_id] = {
                    "content": entry.content,
                    "memory_type": entry.memory_type.value,
                    "scope": entry.scope.value,
                    "priority": entry.priority.value,
                    "created_at": entry.created_at.isoformat(),
                    "tags": list(entry.tags),
                    "context": entry.context,
                }
            return json.dumps(export_data, indent=2)

        raise ValueError(f"Unsupported export format: {format_type}")

    async def import_memories(self, data: str, format_type: str = "json") -> int:
        """Import memories from specified format"""
        imported_count = 0

        if format_type == "json":
            import_data = json.loads(data)

            for entry_data in import_data.values():
                try:
                    await self.store_memory(
                        content=entry_data["content"],
                        memory_type=MemoryType(entry_data["memory_type"]),
                        scope=MemoryScope(entry_data["scope"]),
                        priority=MemoryPriority(entry_data["priority"]),
                        tags=set(entry_data.get("tags", [])),
                        context=entry_data.get("context", {}),
                    )
                    imported_count += 1
                except Exception as e:
                    self.logger.warning(f"Failed to import memory entry: {e}")

        return imported_count
