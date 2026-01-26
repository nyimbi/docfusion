# Developer Guide

## Overview

This guide covers development setup, architecture patterns, testing practices, and contribution guidelines for the Real-Time Collaboration System.

## 🛠️ Development Setup

### Prerequisites

- Python 3.12+
- Git
- Modern IDE with Python support (VS Code, PyCharm, etc.)

### Environment Setup

1. **Clone the repository:**
```bash
git clone <repository-url>
cd proposal_writer
```

2. **Create virtual environment:**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies:**
```bash
pip install -e .
pip install -r requirements-dev.txt
```

4. **Install collaboration system dependencies:**
```bash
pip install asyncio pydantic uuid-extensions difflib
```

### Development Dependencies

```bash
# Testing
pytest
pytest-asyncio
pytest-benchmark

# Code quality
black
flake8
mypy
isort

# Performance monitoring
psutil
memory-profiler
```

### IDE Configuration

#### VS Code Settings

```json
{
    "python.defaultInterpreterPath": "./venv/bin/python",
    "python.formatting.provider": "black",
    "python.linting.enabled": true,
    "python.linting.flake8Enabled": true,
    "python.linting.mypyEnabled": true,
    "editor.insertSpaces": false,
    "editor.tabSize": 4,
    "files.trimTrailingWhitespace": true
}
```

#### PyCharm Settings

- Set tab indentation (not spaces) as per project standards
- Enable type checking with mypy
- Configure async debugging for collaborative features

## 🏗️ Architecture Patterns

### Async-First Design

All collaboration APIs are async and follow these patterns:

```python
# Good: Proper async pattern
async def edit_document(self, user_id: str, content: str) -> EditResult:
    async with self._lock:
        result = await self._process_edit(user_id, content)
        await self._broadcast_changes(result)
        return result

# Bad: Blocking in async function
async def edit_document(self, user_id: str, content: str) -> EditResult:
    time.sleep(0.1)  # Never do this!
    return self._sync_process(content)
```

### Error Handling Pattern

```python
async def collaboration_operation(self, *args, **kwargs):
    try:
        # Validate inputs
        self._validate_inputs(args, kwargs)
        
        # Perform operation
        result = await self._execute_operation(*args, **kwargs)
        
        # Post-processing
        await self._post_process(result)
        
        return result
        
    except ValueError as e:
        # Handle validation errors
        logger.error(f"Validation error: {e}")
        raise
        
    except Exception as e:
        # Handle unexpected errors with context
        logger.error(f"Unexpected error in collaboration operation: {e}")
        raise RuntimeError(f"Operation failed: {e}") from e
```

### Resource Management Pattern

```python
class CollaborativeResource:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._resources = {}
        
    async def __aenter__(self):
        await self._lock.acquire()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self._cleanup_resources()
        self._lock.release()

# Usage
async with CollaborativeResource() as resource:
    await resource.perform_operation()
```

## 🧪 Testing Guidelines

### Test Structure

```
tests/
├── ci/                          # Continuous Integration tests
│   ├── test_collaboration_performance.py
│   ├── test_conflict_resolution.py
│   └── test_version_control.py
├── unit/                        # Unit tests
│   ├── test_collaborative_editor.py
│   ├── test_version_manager.py
│   └── test_conflict_detector.py
├── integration/                 # Integration tests
│   ├── test_full_collaboration.py
│   └── test_document_engine_integration.py
└── fixtures/                    # Test fixtures and data
    ├── sample_documents.py
    └── mock_users.py
```

### Testing Patterns

#### Unit Test Pattern

```python
import pytest
from unittest.mock import AsyncMock, Mock

@pytest.fixture
async def collaborative_editor():
    editor = CollaborativeEditor(document_id="test_doc")
    yield editor
    await editor.cleanup()  # Always cleanup

@pytest.mark.asyncio
async def test_insert_text_operation(collaborative_editor):
    # Arrange
    await collaborative_editor.add_user("user1", "Test User")
    
    # Act
    operation = await collaborative_editor.insert_text("user1", 0, "Hello")
    
    # Assert
    assert operation.op_type == OperationType.INSERT
    assert operation.content == "Hello"
    assert operation.author_id == "user1"
    
    # Verify state
    content = await collaborative_editor.get_document_content()
    assert content == "Hello"
```

#### Integration Test Pattern

```python
@pytest.mark.asyncio
async def test_full_collaboration_workflow():
    """Test complete collaboration workflow with multiple users"""
    
    # Setup
    integrator = CollaborationIntegrator()
    
    # Create document
    doc = await integrator.create_collaborative_document(
        "Test Doc", "Initial content"
    )
    
    # Add users
    await integrator.add_user_to_document(doc.document_id, "alice", "Alice")
    await integrator.add_user_to_document(doc.document_id, "bob", "Bob")
    
    # Simulate concurrent edits
    edit_tasks = [
        integrator.edit_document(doc.document_id, "alice", "Alice's edit"),
        integrator.edit_document(doc.document_id, "bob", "Bob's edit")
    ]
    
    results = await asyncio.gather(*edit_tasks, return_exceptions=True)
    
    # Verify results
    assert all(not isinstance(r, Exception) for r in results)
    
    # Test conflict resolution
    resolution = await integrator.resolve_conflicts(doc.document_id, "alice")
    assert resolution.merge_successful or len(resolution.unresolved_conflicts) == 0
```

#### Performance Test Pattern

```python
@pytest.mark.benchmark
@pytest.mark.asyncio
async def test_concurrent_editing_performance():
    """Benchmark concurrent editing performance"""
    
    editor = CollaborativeEditor("perf_test")
    
    # Add multiple users
    users = []
    for i in range(10):
        user_id = f"user_{i}"
        await editor.add_user(user_id, f"User {i}")
        users.append(user_id)
    
    # Benchmark concurrent operations
    async def user_operations(user_id):
        operations = []
        for j in range(50):  # 50 operations per user
            start_time = time.time()
            await editor.insert_text(user_id, 0, f"{user_id}_{j}")
            end_time = time.time()
            operations.append((end_time - start_time) * 1000)
        return operations
    
    # Run benchmark
    start = time.time()
    results = await asyncio.gather(*[user_operations(u) for u in users])
    total_time = time.time() - start
    
    # Analyze results
    all_times = [t for user_times in results for t in user_times]
    avg_time = sum(all_times) / len(all_times)
    
    # Performance assertions
    assert avg_time < 50, f"Average operation time too high: {avg_time:.2f}ms"
    assert total_time < 30, f"Total benchmark time too high: {total_time:.2f}s"
```

### Test Data Management

#### Fixtures

```python
# conftest.py
@pytest.fixture
async def sample_document_content():
    return """
    # Project Proposal
    
    ## Executive Summary
    This project aims to deliver innovative solutions...
    
    ## Technical Approach
    Our approach leverages modern technologies...
    """

@pytest.fixture
async def mock_users():
    return [
        {"user_id": "alice", "name": "Alice Smith", "email": "alice@test.com"},
        {"user_id": "bob", "name": "Bob Jones", "email": "bob@test.com"},
        {"user_id": "charlie", "name": "Charlie Brown", "email": "charlie@test.com"}
    ]
```

#### Test Utilities

```python
# tests/utils.py
class CollaborationTestUtils:
    @staticmethod
    async def setup_collaborative_document(integrator, title="Test Doc"):
        """Setup a document with default settings for testing"""
        return await integrator.create_collaborative_document(
            title=title,
            initial_content="Test content for collaboration testing."
        )
    
    @staticmethod
    async def add_test_users(integrator, document_id, user_count=3):
        """Add multiple test users to a document"""
        users = []
        for i in range(user_count):
            user_id = f"test_user_{i}"
            session = await integrator.add_user_to_document(
                document_id, user_id, f"Test User {i}"
            )
            users.append(session)
        return users
    
    @staticmethod
    def generate_test_content(sections=5, paragraphs_per_section=3):
        """Generate realistic test content"""
        content = "# Test Document\n\n"
        for i in range(sections):
            content += f"## Section {i+1}\n\n"
            for j in range(paragraphs_per_section):
                content += f"This is paragraph {j+1} of section {i+1}. " * 5
                content += "\n\n"
        return content
```

### Running Tests

```bash
# Run all tests
pytest

# Run specific test categories
pytest tests/unit/                    # Unit tests only
pytest tests/integration/             # Integration tests only
pytest tests/ci/                      # CI tests only

# Run with coverage
pytest --cov=proposal_writer.collaboration --cov-report=html

# Run performance tests
pytest tests/ci/test_collaboration_performance.py -v

# Run with benchmarking
pytest --benchmark-only

# Run parallel tests (for performance)
pytest -n auto
```

## 🔧 Code Style and Standards

### Python Code Style

The project follows these coding standards:

1. **Indentation**: Use tabs, not spaces (as per project requirements)
2. **Type Annotations**: Full type annotations required
3. **Async Patterns**: async/await throughout, no blocking calls
4. **Docstrings**: Comprehensive documentation for all public methods
5. **Error Handling**: Explicit exception handling with context

#### Example of Good Code Style

```python
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
import asyncio

@dataclass
class CollaborativeOperation:
	"""
	Represents a single collaborative editing operation.
	
	Attributes:
		operation_id: Unique identifier for the operation
		user_id: ID of user who performed the operation
		content: Operation content or text
	"""
	operation_id: str
	user_id: str
	content: str
	timestamp: float
	metadata: Dict[str, Any]

class CollaborativeEditor:
	"""
	Real-time collaborative document editor.
	
	Provides CRDT-based conflict resolution and real-time synchronization
	for multi-user document editing scenarios.
	"""
	
	def __init__(self, document_id: str):
		self.document_id = document_id
		self._lock = asyncio.Lock()
		self._operations: List[CollaborativeOperation] = []
	
	async def apply_operation(
		self,
		user_id: str,
		operation_content: str,
		metadata: Optional[Dict[str, Any]] = None
	) -> CollaborativeOperation:
		"""
		Apply collaborative operation with conflict resolution.
		
		Args:
			user_id: ID of user performing operation
			operation_content: Content of the operation
			metadata: Optional operation metadata
		
		Returns:
			CollaborativeOperation that was applied
		
		Raises:
			ValueError: If user_id is invalid
			RuntimeError: If operation cannot be applied
		"""
		if not user_id:
			raise ValueError("user_id cannot be empty")
		
		async with self._lock:
			try:
				operation = await self._create_operation(
					user_id, operation_content, metadata or {}
				)
				await self._apply_with_crdt(operation)
				self._operations.append(operation)
				return operation
			
			except Exception as e:
				raise RuntimeError(f"Failed to apply operation: {e}") from e
	
	async def _create_operation(
		self,
		user_id: str,
		content: str,
		metadata: Dict[str, Any]
	) -> CollaborativeOperation:
		"""Create operation with proper validation and timestamps."""
		# Implementation details...
		pass
	
	async def _apply_with_crdt(self, operation: CollaborativeOperation) -> None:
		"""Apply operation using CRDT algorithm."""
		# Implementation details...
		pass
```

### Documentation Standards

#### Docstring Format

```python
async def detect_conflicts(
	self,
	content_a: str,
	content_b: str,
	author_a: str = "",
	author_b: str = ""
) -> ConflictAnalysisResult:
	"""
	Detect conflicts between two document versions.
	
	Performs comprehensive conflict analysis including content overlaps,
	semantic conflicts, and structural differences.
	
	Args:
		content_a: First document version content
		content_b: Second document version content
		author_a: Author of first version (optional)
		author_b: Author of second version (optional)
	
	Returns:
		ConflictAnalysisResult containing detected conflicts and metadata
	
	Raises:
		ValueError: If content parameters are invalid
		RuntimeError: If conflict detection fails
	
	Example:
		>>> detector = ConflictDetector()
		>>> result = await detector.detect_conflicts("v1", "v2")
		>>> print(f"Found {result.total_conflicts} conflicts")
	"""
```

#### API Documentation

- **All public methods** must have comprehensive docstrings
- **Include examples** for complex APIs
- **Document exceptions** that may be raised
- **Specify return types** and their meaning
- **Include performance notes** for critical operations

### Performance Guidelines

#### Async Best Practices

```python
# Good: Proper async patterns
async def process_multiple_documents(self, documents: List[str]):
	# Process concurrently
	tasks = [self._process_single_document(doc) for doc in documents]
	return await asyncio.gather(*tasks)

async def _process_single_document(self, document: str):
	async with self._get_document_lock(document):
		return await self._perform_processing(document)

# Bad: Sequential processing
async def process_multiple_documents(self, documents: List[str]):
	results = []
	for doc in documents:  # Sequential - inefficient!
		result = await self._process_single_document(doc)
		results.append(result)
	return results
```

#### Memory Management

```python
class CollaborationManager:
	def __init__(self):
		self._documents = {}
		self._cleanup_task = asyncio.create_task(self._periodic_cleanup())
	
	async def _periodic_cleanup(self):
		"""Background task to clean up inactive documents."""
		while True:
			try:
				await asyncio.sleep(300)  # 5 minutes
				await self._cleanup_inactive_documents()
			except Exception as e:
				logger.error(f"Cleanup error: {e}")
	
	async def cleanup_document(self, document_id: str):
		"""Explicitly cleanup document resources."""
		if document_id in self._documents:
			document = self._documents[document_id]
			await document.cleanup()
			del self._documents[document_id]
```

#### Caching Strategies

```python
from functools import lru_cache
from typing import Optional

class ConflictDetector:
	def __init__(self):
		self._analysis_cache: Dict[str, ConflictAnalysisResult] = {}
		self._cache_size_limit = 100
	
	async def detect_conflicts(self, content_a: str, content_b: str) -> ConflictAnalysisResult:
		# Create cache key
		cache_key = self._create_cache_key(content_a, content_b)
		
		# Check cache first
		if cache_key in self._analysis_cache:
			return self._analysis_cache[cache_key]
		
		# Perform analysis
		result = await self._perform_conflict_analysis(content_a, content_b)
		
		# Store in cache (with size limit)
		self._cache_result(cache_key, result)
		
		return result
	
	def _create_cache_key(self, content_a: str, content_b: str) -> str:
		"""Create stable cache key from content hashes."""
		import hashlib
		hash_a = hashlib.md5(content_a.encode()).hexdigest()
		hash_b = hashlib.md5(content_b.encode()).hexdigest()
		return f"{hash_a}:{hash_b}"
	
	def _cache_result(self, key: str, result: ConflictAnalysisResult):
		"""Store result in cache with size management."""
		if len(self._analysis_cache) >= self._cache_size_limit:
			# Remove oldest entry (simple FIFO)
			oldest_key = next(iter(self._analysis_cache))
			del self._analysis_cache[oldest_key]
		
		self._analysis_cache[key] = result
```

## 🔍 Debugging and Troubleshooting

### Logging Configuration

```python
import logging
import sys

# Setup collaboration system logging
def setup_logging(level=logging.INFO):
	logging.basicConfig(
		level=level,
		format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
		handlers=[
			logging.StreamHandler(sys.stdout),
			logging.FileHandler('collaboration.log')
		]
	)
	
	# Specific loggers for different components
	loggers = [
		'proposal_writer.collaboration.editing',
		'proposal_writer.collaboration.versioning',
		'proposal_writer.collaboration.conflicts',
		'proposal_writer.collaboration.integration'
	]
	
	for logger_name in loggers:
		logger = logging.getLogger(logger_name)
		logger.setLevel(level)

# Usage in development
setup_logging(logging.DEBUG)
```

### Debug Utilities

```python
class CollaborationDebugger:
	"""Debugging utilities for collaboration system."""
	
	@staticmethod
	async def dump_document_state(editor: CollaborativeEditor) -> Dict[str, Any]:
		"""Dump complete document state for debugging."""
		return {
			"document_id": editor.document_id,
			"content": await editor.get_document_content(),
			"users": await editor.get_users(),
			"operations": len(editor.operation_history),
			"cursors": await editor.get_cursors(),
			"comments": await editor.get_comments()
		}
	
	@staticmethod
	async def analyze_performance(operation_times: List[float]) -> Dict[str, float]:
		"""Analyze performance metrics."""
		if not operation_times:
			return {}
		
		return {
			"count": len(operation_times),
			"avg_ms": sum(operation_times) / len(operation_times),
			"min_ms": min(operation_times),
			"max_ms": max(operation_times),
			"p50_ms": sorted(operation_times)[len(operation_times) // 2],
			"p95_ms": sorted(operation_times)[int(len(operation_times) * 0.95)],
			"p99_ms": sorted(operation_times)[int(len(operation_times) * 0.99)]
		}
```

### Common Issues and Solutions

#### Issue: Slow Performance with Large Documents

**Symptoms:**
- Operations taking >1000ms
- Memory usage increasing continuously
- UI becoming unresponsive

**Debugging:**
```python
# Add performance monitoring
import time
from contextlib import asynccontextmanager

@asynccontextmanager
async def performance_monitor(operation_name: str):
	start_time = time.time()
	start_memory = get_memory_usage()
	
	try:
		yield
	finally:
		end_time = time.time()
		end_memory = get_memory_usage()
		
		duration = (end_time - start_time) * 1000
		memory_delta = end_memory - start_memory
		
		logger.info(f"{operation_name}: {duration:.2f}ms, {memory_delta:.2f}MB")
		
		if duration > 500:
			logger.warning(f"Slow operation detected: {operation_name}")

# Usage
async with performance_monitor("document_edit"):
	await editor.insert_text(user_id, position, text)
```

**Solutions:**
1. Enable content caching
2. Implement operation batching
3. Use background processing for heavy operations
4. Optimize document structure analysis

#### Issue: Conflict Resolution Not Working

**Debugging:**
```python
async def debug_conflict_resolution(detector, resolver, content_a, content_b):
	# Analyze conflicts in detail
	conflicts = await detector.detect_conflicts(content_a, content_b)
	
	print(f"Detected {conflicts.total_conflicts} conflicts:")
	for conflict in conflicts.conflicts:
		print(f"  - {conflict.conflict_type}: {conflict.severity}")
		print(f"    Position: {conflict.position}, Length: {conflict.length}")
		print(f"    Content A: {conflict.content_a}")
		print(f"    Content B: {conflict.content_b}")
		print(f"    Confidence: {conflict.confidence}")
	
	# Attempt resolution
	result = await resolver.resolve_conflicts(conflicts, content_a, content_b)
	
	print(f"Resolution result:")
	print(f"  - Resolved: {len(result.resolved_conflicts)}")
	print(f"  - Unresolved: {len(result.unresolved_conflicts)}")
	print(f"  - Merge successful: {result.merge_successful}")
	
	return result
```

## 🤝 Contributing

### Pull Request Process

1. **Fork the repository** and create a feature branch
2. **Implement your changes** following the coding standards
3. **Add comprehensive tests** for new functionality
4. **Update documentation** as needed
5. **Run the full test suite** and ensure all tests pass
6. **Submit a pull request** with clear description

### Code Review Checklist

- [ ] Code follows project style guidelines (tabs, async patterns)
- [ ] All new functions have type annotations and docstrings
- [ ] Comprehensive tests added with >90% coverage
- [ ] Performance impact assessed and documented
- [ ] Error handling implemented with proper context
- [ ] Documentation updated (API docs, user guide)
- [ ] No breaking changes without migration guide

### Development Workflow

```bash
# 1. Create feature branch
git checkout -b feature/new-collaboration-feature

# 2. Develop with testing
pytest tests/unit/ -v  # Run unit tests frequently

# 3. Run full test suite
pytest tests/ --cov=proposal_writer.collaboration

# 4. Performance testing
pytest tests/ci/test_collaboration_performance.py

# 5. Code quality checks
black src/proposal_writer/collaboration/
flake8 src/proposal_writer/collaboration/
mypy src/proposal_writer/collaboration/

# 6. Commit and push
git commit -m "feat: add new collaboration feature"
git push origin feature/new-collaboration-feature
```

### Architecture Decision Records (ADR)

For significant architectural decisions, create ADR documents:

```markdown
# ADR-001: CRDT Implementation Choice

## Status
Accepted

## Context
We need to choose a conflict resolution algorithm for real-time collaboration.

## Decision
We will use a text-based CRDT with operational transform for position management.

## Consequences
- Provides mathematical guarantees of convergence
- Enables truly real-time collaboration
- Requires careful implementation of position transforms
- May have higher memory usage for operation history
```

## 📚 Additional Resources

### Recommended Reading

- **CRDT Papers**: Research papers on conflict-free replicated data types
- **Operational Transform**: Papers on collaborative editing algorithms
- **Python Async**: Best practices for async programming in Python
- **Performance Testing**: Guidelines for performance benchmarking

### Tools and Libraries

- **pytest-asyncio**: Testing async code
- **pytest-benchmark**: Performance benchmarking
- **aiohttp**: WebSocket server implementation
- **memory-profiler**: Memory usage analysis
- **py-spy**: Performance profiling

### External Documentation

- **Python Asyncio**: https://docs.python.org/3/library/asyncio.html
- **Pydantic**: https://pydantic-docs.helpmanual.io/
- **pytest**: https://docs.pytest.org/
- **Type Hints**: https://docs.python.org/3/library/typing.html