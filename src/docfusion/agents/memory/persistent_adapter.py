"""
Persistent Memory Adapter for Agent Memory System

Provides PostgreSQL-backed persistent storage for agent memories with
pgvector-powered semantic similarity search.

This adapter implements the MemoryManager interface while providing
additional persistence and cross-agent memory sharing capabilities.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import hashlib
import json
import logging
import gzip
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

import asyncpg

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .memory_manager import (
    MemoryEntry,
    MemoryType,
    MemoryScope,
    MemoryPriority,
    MemoryConfig,
    MemoryIndex,
)
from ...core.utils import uuid7str
from .schema import (
    DEFAULT_EMBEDDING_DIMENSIONS,
    get_schema_sql,
)

class PersistentMemoryConfig(BaseModel):
    """Configuration for persistent memory adapter."""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    # Database connection
    database_url: str = Field(
        ...,
        description="PostgreSQL connection URL for persistent storage"
    )

    # Schema settings
    schema_name: str = Field(
        default="agent_memory",
        description="Database schema name for memory tables"
    )

    @field_validator("schema_name")
    @classmethod
    def validate_schema_name(cls, v: str) -> str:
        """Validate schema name contains only safe identifier characters (prevents SQL injection)."""
        import re
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", v):
            raise ValueError(
                f"Invalid schema name '{v}': must start with letter or underscore "
                "and contain only alphanumeric characters and underscores"
            )
        return v

    # Pool settings
    pool_size: int = Field(default=10, ge=1, le=100)
    max_pool_size: int = Field(default=20, ge=1, le=100)
    command_timeout: float = Field(default=30.0, gt=0)

    # Embedding settings
    embedding_dimensions: int = Field(
        default=DEFAULT_EMBEDDING_DIMENSIONS,
        ge=128,
        le=4096,
        description="Vector dimensions for embeddings"
    )

    # Feature flags
    enable_embeddings: bool = Field(
        default=True,
        description="Enable semantic similarity search via embeddings"
    )
    enable_persistence: bool = Field(
        default=True,
        description="Enable persistent storage (False = in-memory only)"
    )

    # Memory settings
    max_memories_per_agent: int = Field(
        default=10000,
        ge=100,
        description="Maximum memories per agent before pruning"
    )
    cleanup_interval_minutes: int = Field(
        default=30,
        ge=5,
        description="Interval for cleanup of expired memories"
    )

    # Cache settings
    cache_size: int = Field(
        default=1000,
        ge=10,
        description="Number of entries to cache in memory"
    )
    cache_ttl_minutes: int = Field(
        default=60,
        ge=1,
        description="Cache TTL in minutes"
    )

    @property
    def asyncpg_url(self) -> str:
        """Get asyncpg-compatible connection URL."""
        url = self.database_url
        # Convert SQLAlchemy URL to asyncpg format if needed
        if "postgresql+asyncpg://" in url:
            url = url.replace("postgresql+asyncpg://", "postgresql://")
        elif "postgresql+psycopg2://" in url:
            url = url.replace("postgresql+psycopg2://", "postgresql://")
        return url

class EmbeddingClient:
    """
    Client for generating embeddings using the EmbeddingService.

    This wraps the EmbeddingService to provide a simple interface
    for generating embeddings from memory content.
    """

    def __init__(
        self,
        embedding_service: Any | None = None,
        embedding_dimensions: int = DEFAULT_EMBEDDING_DIMENSIONS,
    ):
        """
        Initialize embedding client.

        Args:
            embedding_service: Optional EmbeddingService instance from
                src.docfusion.storage.rag.embedding_service
            embedding_dimensions: Vector dimensions for embeddings
        """
        self.embedding_service = embedding_service
        self.embedding_dimensions = embedding_dimensions
        self.logger = logging.getLogger(__name__)

    async def generate_embedding(self, text: str) -> list[float] | None:
        """
        Generate embedding for text content.

        Args:
            text: Text to embed

        Returns:
            Embedding vector or None if generation fails
        """
        if self.embedding_service is None:
            self.logger.debug("No embedding service configured")
            return None

        try:
            result = await self.embedding_service.generate_query_embedding(text)
            if result and hasattr(result, "embedding"):
                return result.embedding
            return None
        except Exception as e:
            self.logger.error(f"Failed to generate embedding: {e}")
            return None

    async def generate_embeddings_batch(
        self,
        texts: list[str]
    ) -> list[list[float] | None]:
        """
        Generate embeddings for multiple texts.

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors (or None for failures)
        """
        if self.embedding_service is None:
            return [None] * len(texts)

        try:
            results = await self.embedding_service._generate_embeddings_batch(texts)
            return [
                r.embedding if r and hasattr(r, "embedding") else None
                for r in results
            ]
        except Exception as e:
            self.logger.error(f"Batch embedding generation failed: {e}")
            return [None] * len(texts)

@dataclass
class MemoryCacheEntry:
    """Cache entry for in-memory caching."""

    entry: MemoryEntry
    cached_at: datetime = field(default_factory=datetime.now)
    access_count: int = 0

    def is_expired(self, ttl_minutes: int) -> bool:
        """Check if cache entry is expired."""
        return (datetime.now() - self.cached_at) > timedelta(minutes=ttl_minutes)

class PersistentMemoryAdapter:
    """
    PostgreSQL-backed persistent memory adapter for agents.

    This adapter implements the MemoryManager interface while providing
    persistence, cross-agent memory sharing, and semantic similarity search.

    Features:
    - Persistent storage in PostgreSQL
    - Vector similarity search via pgvector
    - Memory sharing across agents (scoped)
    - Automatic cleanup of expired memories
    - In-memory caching for performance
    """

    def __init__(
        self,
        agent_id: str,
        config: PersistentMemoryConfig,
        embedding_service: Any | None = None,
        memory_config: MemoryConfig | None = None,
    ):
        """
        Initialize persistent memory adapter.

        Args:
            agent_id: Unique identifier for the agent
            config: Persistent memory configuration
            embedding_service: Optional EmbeddingService for semantic search
            memory_config: Optional base MemoryConfig for compatibility
        """
        self.agent_id = agent_id
        self.config = config
        self.memory_config = memory_config or MemoryConfig()

        # Database connection
        self.pool: asyncpg.Pool | None = None

        # Embedding client
        self.embedding_client = EmbeddingClient(
            embedding_service=embedding_service,
            embedding_dimensions=config.embedding_dimensions,
        )

        # In-memory cache
        self._cache: Dict[str, MemoryCacheEntry] = {}
        self._cache_by_hash: Dict[str, str] = {}  # content_hash -> entry_id

        # Memory index for fast lookups (mirrors in-memory manager)
        self.index = MemoryIndex()

        # State
        self._initialized = False
        self._running = False
        self._cleanup_task: asyncio.Task | None = None

        # Statistics
        self.stats = {
            "total_entries": 0,
            "entries_by_type": {t: 0 for t in MemoryType},
            "entries_by_scope": {s: 0 for s in MemoryScope},
            "memory_usage_mb": 0.0,
            "cache_hits": 0,
            "cache_misses": 0,
            "last_cleanup": datetime.now(),
            "db_queries": 0,
            "embedding_generations": 0,
        }

        self.logger = logging.getLogger(f"persistent_memory.{agent_id}")

    async def start(self) -> None:
        """Start the memory adapter and initialize database connection."""
        if self._running:
            return

        try:
            # Create database pool
            self.pool = await asyncpg.create_pool(
                self.config.asyncpg_url,
                min_size=self.config.pool_size,
                max_size=self.config.max_pool_size,
                command_timeout=self.config.command_timeout,
            )

            # Initialize schema if persistence enabled
            if self.config.enable_persistence:
                await self._initialize_schema()

            # Load existing memories into cache
            if self.config.enable_persistence:
                await self._load_memories_into_cache()

            self._running = True
            self._initialized = True

            # Start cleanup task
            if self.config.enable_persistence:
                self._cleanup_task = asyncio.create_task(self._cleanup_loop())

            self.logger.info(
                f"Persistent memory adapter started for agent {self.agent_id}"
            )

        except Exception as e:
            self.logger.error(f"Failed to start memory adapter: {e}")
            raise

    async def stop(self) -> None:
        """Stop the memory adapter and close database connection."""
        if not self._running:
            return

        self._running = False

        # Cancel cleanup task
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        # Close database pool
        if self.pool:
            await self.pool.close()
            self.pool = None

        self.logger.info(f"Persistent memory adapter stopped for agent {self.agent_id}")

    async def _initialize_schema(self) -> None:
        """Initialize database schema for memory storage."""
        if not self.pool:
            raise RuntimeError("Database pool not initialized")

        async with self.pool.acquire() as conn:
            try:
                # Create schema
                await conn.execute(
                    f"CREATE SCHEMA IF NOT EXISTS {self.config.schema_name}"
                )

                # Apply schema SQL
                schema_sql = get_schema_sql(
                    embedding_dimensions=self.config.embedding_dimensions,
                    include_optimizations=False
                )

                # Execute schema creation statements
                await conn.execute(schema_sql)

                self.logger.info("Database schema initialized successfully")

            except Exception as e:
                self.logger.error(f"Schema initialization failed: {e}")
                raise

    async def _load_memories_into_cache(self) -> None:
        """Load existing memories from database into cache."""
        if not self.pool:
            return

        try:
            async with self.pool.acquire() as conn:
                # Load recent memories into cache
                rows = await conn.fetch(f"""
                    SELECT id, agent_id, memory_type, scope, priority, content,
                           tags, context, created_at, last_accessed, access_count,
                           expires_at, compressed, encrypted, content_hash
                    FROM {self.config.schema_name}.agent_memories
                    WHERE agent_id = $1
                    ORDER BY last_accessed DESC
                    LIMIT $2
                """, self.agent_id, self.config.cache_size)

                for row in rows:
                    try:
                        entry = self._row_to_entry(row)
                        self._add_to_cache(entry)
                        self.index.add_entry(entry)
                    except Exception as e:
                        self.logger.warning(f"Failed to load memory {row['id']}: {e}")

                self.stats["total_entries"] = len(self._cache)
                self._update_stats_by_type()
                self.logger.info(f"Loaded {len(rows)} memories into cache")

        except Exception as e:
            self.logger.error(f"Failed to load memories into cache: {e}")

    def _row_to_entry(self, row: asyncpg.Record) -> MemoryEntry:
        """Convert database row to MemoryEntry."""
        content = row["content"]

        # Decompress if needed
        if row.get("compressed"):
            try:
                content = self._decompress_content(content)
            except Exception as e:
                self.logger.warning(f"Failed to decompress content: {e}")

        # Parse content if it's a string
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except json.JSONDecodeError:
                self.logger.warning("json.JSONDecodeError in _row_to_entry")

        entry = MemoryEntry(
            entry_id=str(row["id"]),
            content=content,
            memory_type=MemoryType(row["memory_type"]),
            scope=MemoryScope(row["scope"]),
            priority=MemoryPriority(row["priority"]),
            created_at=row["created_at"],
            last_accessed=row["last_accessed"],
            access_count=row["access_count"] or 0,
            tags=set(row["tags"]) if row.get("tags") else set(),
            context=row["context"] or {},
            expires_at=row.get("expires_at"),
            content_hash=row.get("content_hash"),
            compressed=row.get("compressed", False),
            encrypted=row.get("encrypted", False),
        )

        return entry

    def _entry_to_dict(self, entry: MemoryEntry) -> Dict[str, Any]:
        """Convert MemoryEntry to database dictionary."""
        content = entry.content

        # Compress large content if needed
        compressed = False
        if self.memory_config.enable_compression and len(str(content)) > 1000:
            content = self._compress_content(content)
            compressed = True

        # Convert content to JSON-serializable format
        if isinstance(content, (dict, list)):
            content_json = json.dumps(content)
        elif isinstance(content, bytes):
            content_json = content.decode("utf-8", errors="replace")
        else:
            content_json = str(content)

        return {
            "agent_id": self.agent_id,
            "memory_type": entry.memory_type.value,
            "scope": entry.scope.value,
            "priority": entry.priority.value,
            "content": content_json,
            "tags": list(entry.tags) if entry.tags else [],
            "context": entry.context if entry.context else {},
            "created_at": entry.created_at,
            "last_accessed": entry.last_accessed,
            "access_count": entry.access_count,
            "expires_at": entry.expires_at,
            "content_hash": entry.content_hash,
            "compressed": compressed,
            "encrypted": entry.encrypted,
        }

    # Memory Operations (implementing MemoryManager interface)

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
        """
        Store a memory entry with persistence.

        Args:
            content: Memory content to store
            memory_type: Type of memory (short_term, long_term, etc.)
            scope: Access scope (private, crew, swarm, etc.)
            priority: Retention priority
            tags: Optional tags for search
            context: Optional context metadata
            ttl_seconds: Optional time-to-live

        Returns:
            Unique memory entry ID
        """
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
                    hours=self.memory_config.short_term_ttl_hours
                )
            elif memory_type == MemoryType.WORKING:
                entry.expires_at = datetime.now() + timedelta(
                    minutes=self.memory_config.working_memory_ttl_minutes
                )

            # Generate content hash
            entry.content_hash = self._generate_content_hash(content)

            # Check for duplicates in cache
            if entry.content_hash in self._cache_by_hash:
                existing_id = self._cache_by_hash[entry.content_hash]
                if existing_id in self._cache:
                    existing = self._cache[existing_id].entry
                    existing.last_accessed = datetime.now()
                    existing.access_count += 1
                    # Update in database
                    await self._update_access_stats(existing_id)
                    return existing_id

            # Generate embedding if enabled
            embedding = None
            if self.config.enable_embeddings and isinstance(content, str):
                embedding = await self.embedding_client.generate_embedding(content)
                if embedding:
                    self.stats["embedding_generations"] += 1

            # Persist to database
            if self.config.enable_persistence and self.pool:
                entry_id = await self._persist_entry(entry, embedding)
                entry.entry_id = entry_id
            else:
                # Generate ID for non-persistent mode
                entry.entry_id = uuid7str()

            # Update cache and index
            self._add_to_cache(entry)
            self.index.add_entry(entry)
            self._update_stats()

            self.logger.debug(f"Stored memory: {entry.entry_id} ({memory_type})")
            return entry.entry_id

        except Exception as e:
            self.logger.error(f"Failed to store memory: {e}")
            raise

    async def retrieve_memory(self, entry_id: str) -> Optional[MemoryEntry]:
        """
        Retrieve a specific memory entry by ID.

        Args:
            entry_id: Unique memory entry ID

        Returns:
            MemoryEntry or None if not found
        """
        try:
            # Check cache first
            if entry_id in self._cache:
                cached = self._cache[entry_id]
                cached.access_count += 1
                self.stats["cache_hits"] += 1

                # Update access stats asynchronously
                if self.config.enable_persistence:
                    asyncio.create_task(self._update_access_stats(entry_id))

                return cached.entry

            self.stats["cache_misses"] += 1

            # Load from database
            if self.config.enable_persistence and self.pool:
                entry = await self._load_entry_from_db(entry_id)
                if entry:
                    self._add_to_cache(entry)
                    return entry

            return None

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
        """
        Search memories with various criteria.

        Args:
            query: Optional text query for content search
            tags: Optional tag filters
            memory_type: Optional memory type filter
            scope: Optional scope filter
            date_range: Optional date range filter
            limit: Maximum number of results

        Returns:
            List of matching MemoryEntry objects
        """
        try:
            # Use semantic search if query provided and embeddings enabled
            if query and self.config.enable_embeddings:
                results = await self._semantic_search(
                    query=query,
                    tags=tags,
                    memory_type=memory_type,
                    scope=scope,
                    date_range=date_range,
                    limit=limit,
                )
                return [r[0] for r in results]

            # Fall back to database search
            if self.config.enable_persistence and self.pool:
                return await self._database_search(
                    query=query,
                    tags=tags,
                    memory_type=memory_type,
                    scope=scope,
                    date_range=date_range,
                    limit=limit,
                )

            # In-memory search
            return self._in_memory_search(
                query=query,
                tags=tags,
                memory_type=memory_type,
                scope=scope,
                date_range=date_range,
                limit=limit,
            )

        except Exception as e:
            self.logger.error(f"Memory search failed: {e}")
            return []

    async def delete_memory(self, entry_id: str) -> bool:
        """
        Delete a memory entry.

        Args:
            entry_id: Unique memory entry ID

        Returns:
            True if deleted, False if not found
        """
        try:
            # Remove from cache
            if entry_id in self._cache:
                entry = self._cache[entry_id].entry
                del self._cache[entry_id]

                # Remove hash mapping
                if entry.content_hash and entry.content_hash in self._cache_by_hash:
                    del self._cache_by_hash[entry.content_hash]

                # Remove from index
                self.index.remove_entry(entry)

            # Remove from database
            if self.config.enable_persistence and self.pool:
                async with self.pool.acquire() as conn:
                    await conn.execute(
                        f"DELETE FROM {self.config.schema_name}.agent_memories WHERE id = $1",
                        entry_id
                    )

            self._update_stats()
            self.logger.debug(f"Deleted memory: {entry_id}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to delete memory {entry_id}: {e}")
            return False

    async def create_memory_association(
        self,
        entry_id1: str,
        entry_id2: str,
        relationship_type: str = "related"
    ) -> bool:
        """
        Create association between two memories.

        Args:
            entry_id1: First memory ID
            entry_id2: Second memory ID
            relationship_type: Type of relationship

        Returns:
            True if association created, False if memories not found
        """
        try:
            entry1 = await self.retrieve_memory(entry_id1)
            entry2 = await self.retrieve_memory(entry_id2)

            if not entry1 or not entry2:
                return False

            # Update in-memory relationship
            entry1.related_entries.add(entry_id2)
            entry2.related_entries.add(entry_id1)

            # Update context
            if "relationships" not in entry1.context:
                entry1.context["relationships"] = {}
            entry1.context["relationships"][entry_id2] = relationship_type

            if "relationships" not in entry2.context:
                entry2.context["relationships"] = {}
            entry2.context["relationships"][entry_id1] = relationship_type

            # Persist relationship
            if self.config.enable_persistence and self.pool:
                async with self.pool.acquire() as conn:
                    await conn.execute(
                        f"""
                        INSERT INTO {self.config.schema_name}.memory_relationships
                        (parent_id, child_id, relationship_type)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (parent_id, child_id, relationship_type) DO NOTHING
                        """,
                        entry_id1,
                        entry_id2,
                        relationship_type
                    )

            # Update index
            self.index.relationship_index[entry_id1] = entry1.related_entries.copy()
            self.index.relationship_index[entry_id2] = entry2.related_entries.copy()

            self.logger.debug(f"Created memory association: {entry_id1} <-> {entry_id2}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to create memory association: {e}")
            return False

    async def get_related_memories(
        self,
        entry_id: str,
        depth: int = 1
    ) -> List[MemoryEntry]:
        """
        Get related memories up to specified depth.

        Args:
            entry_id: Starting memory ID
            depth: Maximum relationship depth

        Returns:
            List of related MemoryEntry objects
        """
        try:
            visited = set()
            related = []
            queue = [(entry_id, 0)]

            while queue:
                current_id, current_depth = queue.pop(0)

                if current_id in visited or current_depth > depth:
                    continue

                visited.add(current_id)

                if current_id != entry_id:
                    entry = await self.retrieve_memory(current_id)
                    if entry:
                        related.append(entry)

                if current_depth < depth:
                    # Get relationships from database
                    if self.config.enable_persistence and self.pool:
                        rel_ids = await self._get_relationships(current_id)
                    else:
                        rel_ids = list(self.index.relationship_index.get(current_id, set()))

                    for rel_id in rel_ids:
                        if rel_id not in visited:
                            queue.append((rel_id, current_depth + 1))

            return related

        except Exception as e:
            self.logger.error(f"Failed to get related memories: {e}")
            return []

    # Similarity Search

    async def find_similar_memories(
        self,
        query: str,
        scope: Optional[MemoryScope] = None,
        memory_type: Optional[MemoryType] = None,
        similarity_threshold: float = 0.7,
        limit: int = 10,
    ) -> List[Tuple[MemoryEntry, float]]:
        """
        Find memories similar to query using semantic search.

        Args:
            query: Text query to find similar memories
            scope: Optional scope filter
            memory_type: Optional memory type filter
            similarity_threshold: Minimum similarity score (0-1)
            limit: Maximum number of results

        Returns:
            List of (MemoryEntry, similarity_score) tuples
        """
        if not self.config.enable_embeddings:
            self.logger.warning("Semantic search requires embeddings to be enabled")
            return []

        try:
            # Generate query embedding
            query_embedding = await self.embedding_client.generate_embedding(query)
            if not query_embedding:
                return []

            # Search database
            if self.config.enable_persistence and self.pool:
                return await self._vector_search(
                    query_embedding=query_embedding,
                    scope=scope,
                    memory_type=memory_type,
                    similarity_threshold=similarity_threshold,
                    limit=limit,
                )

            return []

        except Exception as e:
            self.logger.error(f"Similar memory search failed: {e}")
            return []

    # Statistics and Management

    def get_memory_stats(self) -> Dict[str, Any]:
        """Get memory manager statistics."""
        self._update_stats()
        return self.stats.copy()

    async def clear_memories(
        self,
        memory_type: Optional[MemoryType] = None,
        scope: Optional[MemoryScope] = None,
        keep_critical: bool = True,
    ) -> int:
        """
        Clear memories with optional filters.

        Args:
            memory_type: Optional memory type filter
            scope: Optional scope filter
            keep_critical: Whether to keep critical priority memories

        Returns:
            Number of memories cleared
        """
        cleared_count = 0

        # Build delete conditions
        conditions = ["agent_id = $1"]
        params = [self.agent_id]
        param_idx = 2

        if memory_type:
            conditions.append(f"memory_type = ${param_idx}")
            params.append(memory_type.value)
            param_idx += 1

        if scope:
            conditions.append(f"scope = ${param_idx}")
            params.append(scope.value)
            param_idx += 1

        if keep_critical:
            conditions.append("priority != 'critical'")

        where_clause = " AND ".join(conditions)

        try:
            # Delete from database
            if self.config.enable_persistence and self.pool:
                async with self.pool.acquire() as conn:
                    result = await conn.execute(
                        f"DELETE FROM {self.config.schema_name}.agent_memories WHERE {where_clause}",
                        *params
                    )
                    cleared_count = int(result.split()[-1])

            # Clear from cache
            entries_to_remove = []
            for entry_id, cached in self._cache.items():
                entry = cached.entry
                if memory_type and entry.memory_type != memory_type:
                    continue
                if scope and entry.scope != scope:
                    continue
                if keep_critical and entry.priority == MemoryPriority.CRITICAL:
                    continue
                entries_to_remove.append(entry_id)

            for entry_id in entries_to_remove:
                del self._cache[entry_id]
                # Also update index
                if entry_id in self.index.relationship_index:
                    del self.index.relationship_index[entry_id]

            self._update_stats()
            return cleared_count

        except Exception as e:
            self.logger.error(f"Failed to clear memories: {e}")
            return 0

    # Private Helper Methods

    def _add_to_cache(self, entry: MemoryEntry) -> None:
        """Add entry to in-memory cache."""
        # Enforce cache size limit
        while len(self._cache) >= self.config.cache_size:
            # Remove oldest entry
            oldest_id = min(
                self._cache.keys(),
                key=lambda x: self._cache[x].cached_at
            )
            del self._cache[oldest_id]

        self._cache[entry.entry_id] = MemoryCacheEntry(entry=entry)
        if entry.content_hash:
            self._cache_by_hash[entry.content_hash] = entry.entry_id

    async def _persist_entry(
        self,
        entry: MemoryEntry,
        embedding: list[float] | None
    ) -> str:
        """Persist entry to database."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                f"""
                INSERT INTO {self.config.schema_name}.agent_memories
                (agent_id, memory_type, scope, priority, content, tags, context,
                 expires_at, content_hash, compressed, encrypted, embedding)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
                """,
                self.agent_id,
                entry.memory_type.value,
                entry.scope.value,
                entry.priority.value,
                json.dumps(entry.content) if not isinstance(entry.content, str) else entry.content,
                list(entry.tags),
                entry.context,
                entry.expires_at,
                entry.content_hash,
                entry.compressed,
                entry.encrypted,
                embedding,
            )
            return str(row["id"])

    async def _load_entry_from_db(self, entry_id: str) -> Optional[MemoryEntry]:
        """Load entry from database by ID."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                f"""
                SELECT id, agent_id, memory_type, scope, priority, content,
                       tags, context, created_at, last_accessed, access_count,
                       expires_at, compressed, encrypted, content_hash
                FROM {self.config.schema_name}.agent_memories
                WHERE id = $1
                """,
                entry_id
            )
            if row:
                return self._row_to_entry(row)
            return None

    async def _update_access_stats(self, entry_id: str) -> None:
        """Update access statistics for entry."""
        if not self.pool:
            return

        async with self.pool.acquire() as conn:
            await conn.execute(
                f"""
                UPDATE {self.config.schema_name}.agent_memories
                SET last_accessed = NOW(), access_count = access_count + 1
                WHERE id = $1
                """,
                entry_id
            )
        self.stats["db_queries"] += 1

    async def _semantic_search(
        self,
        query: str,
        tags: Optional[Set[str]],
        memory_type: Optional[MemoryType],
        scope: Optional[MemoryScope],
        date_range: Optional[Tuple[datetime, datetime]],
        limit: int,
    ) -> List[Tuple[MemoryEntry, float]]:
        """Perform semantic search using embeddings."""
        # Generate query embedding
        query_embedding = await self.embedding_client.generate_embedding(query)
        if not query_embedding:
            return []

        return await self._vector_search(
            query_embedding=query_embedding,
            scope=scope,
            memory_type=memory_type,
            similarity_threshold=0.5,
            limit=limit,
        )

    async def _vector_search(
        self,
        query_embedding: list[float],
        scope: Optional[MemoryScope],
        memory_type: Optional[MemoryType],
        similarity_threshold: float,
        limit: int,
    ) -> List[Tuple[MemoryEntry, float]]:
        """Perform vector similarity search in database."""
        async with self.pool.acquire() as conn:
            # Build WHERE clause
            conditions = ["embedding IS NOT NULL"]
            params = [query_embedding]
            param_idx = 2

            if scope:
                conditions.append(f"scope = ${param_idx}")
                params.append(scope.value)
                param_idx += 1

            if memory_type:
                conditions.append(f"memory_type = ${param_idx}")
                params.append(memory_type.value)
                param_idx += 1

            params.append(similarity_threshold)
            param_idx += 1
            params.append(limit)

            where_clause = " AND ".join(conditions)

            rows = await conn.fetch(
                f"""
                SELECT id, agent_id, memory_type, scope, priority, content,
                       tags, context, created_at, last_accessed, access_count,
                       expires_at, compressed, encrypted, content_hash,
                       (1 - (embedding <=> $1)) as similarity
                FROM {self.config.schema_name}.agent_memories
                WHERE {where_clause}
                AND (1 - (embedding <=> $1)) >= ${param_idx - 1}
                ORDER BY embedding <=> $1
                LIMIT ${param_idx}
                """,
                *params
            )

            results = []
            for row in rows:
                entry = self._row_to_entry(row)
                similarity = float(row["similarity"])
                results.append((entry, similarity))
                # Update cache
                self._add_to_cache(entry)

            self.stats["db_queries"] += 1
            return results

    async def _database_search(
        self,
        query: Optional[str],
        tags: Optional[Set[str]],
        memory_type: Optional[MemoryType],
        scope: Optional[MemoryScope],
        date_range: Optional[Tuple[datetime, datetime]],
        limit: int,
    ) -> List[MemoryEntry]:
        """Search memories in database."""
        conditions = ["agent_id = $1"]
        params = [self.agent_id]
        param_idx = 2

        if query:
            conditions.append(f"content::text ILIKE ${param_idx}")
            params.append(f"%{query}%")
            param_idx += 1

        if tags:
            conditions.append(f"tags && ${param_idx}")
            params.append(list(tags))
            param_idx += 1

        if memory_type:
            conditions.append(f"memory_type = ${param_idx}")
            params.append(memory_type.value)
            param_idx += 1

        if scope:
            conditions.append(f"scope = ${param_idx}")
            params.append(scope.value)
            param_idx += 1

        if date_range:
            conditions.append(f"created_at BETWEEN ${param_idx} AND ${param_idx + 1}")
            params.extend([date_range[0], date_range[1]])
            param_idx += 2

        params.append(limit)

        where_clause = " AND ".join(conditions)

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT id, agent_id, memory_type, scope, priority, content,
                       tags, context, created_at, last_accessed, access_count,
                       expires_at, compressed, encrypted, content_hash
                FROM {self.config.schema_name}.agent_memories
                WHERE {where_clause}
                ORDER BY last_accessed DESC
                LIMIT ${param_idx}
                """,
                *params
            )

            results = []
            for row in rows:
                entry = self._row_to_entry(row)
                results.append(entry)
                self._add_to_cache(entry)

            self.stats["db_queries"] += 1
            return results

    def _in_memory_search(
        self,
        query: Optional[str],
        tags: Optional[Set[str]],
        memory_type: Optional[MemoryType],
        scope: Optional[MemoryScope],
        date_range: Optional[Tuple[datetime, datetime]],
        limit: int,
    ) -> List[MemoryEntry]:
        """Search memories in-memory cache (fallback)."""
        results = []

        for entry in self._cache.values():
            e = entry.entry

            # Apply filters
            if memory_type and e.memory_type != memory_type:
                continue
            if scope and e.scope != scope:
                continue
            if tags and not tags.issubset(e.tags):
                continue
            if date_range:
                if not (date_range[0] <= e.created_at <= date_range[1]):
                    continue
            if query and not self._matches_query(e, query):
                continue

            results.append(e)

        # Sort by access count and last accessed
        results.sort(key=lambda x: (x.access_count, x.last_accessed), reverse=True)
        return results[:limit]

    def _matches_query(self, entry: MemoryEntry, query: str) -> bool:
        """Check if entry matches text query."""
        query_lower = query.lower()
        content_str = str(entry.content).lower()
        if query_lower in content_str:
            return True
        for tag in entry.tags:
            if query_lower in tag.lower():
                return True
        context_str = str(entry.context).lower()
        if query_lower in context_str:
            return True
        return False

    async def _get_relationships(self, entry_id: str) -> List[str]:
        """Get related entry IDs from database."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT child_id FROM {self.config.schema_name}.memory_relationships
                WHERE parent_id = $1
                UNION
                SELECT parent_id FROM {self.config.schema_name}.memory_relationships
                WHERE child_id = $1
                """,
                entry_id
            )
            return [str(row[0]) for row in rows]

    async def _cleanup_loop(self) -> None:
        """Background cleanup loop for expired memories."""
        while self._running:
            try:
                await self._perform_cleanup()
                await asyncio.sleep(self.config.cleanup_interval_minutes * 60)
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Cleanup error: {e}")
                await asyncio.sleep(60)

    async def _perform_cleanup(self) -> None:
        """Perform memory cleanup."""
        if not self.pool:
            return

        async with self.pool.acquire() as conn:
            # Call cleanup function
            result = await conn.fetchval(
                f"SELECT {self.config.schema_name}.cleanup_expired_memories()"
            )
            deleted_count = result or 0

            # Prune low-priority memories if over limit
            await conn.execute(
                f"SELECT {self.config.schema_name}.prune_low_priority_memories($1, $2)",
                self.agent_id,
                self.config.max_memories_per_agent
            )

        # Clear expired entries from cache
        expired_ids = []
        for entry_id, cached in self._cache.items():
            if cached.entry.expires_at and cached.entry.expires_at < datetime.now():
                expired_ids.append(entry_id)

        for entry_id in expired_ids:
            del self._cache[entry_id]

        if deleted_count > 0:
            self.logger.info(f"Cleaned up {deleted_count} expired memories")

        self.stats["last_cleanup"] = datetime.now()

    def _update_stats(self) -> None:
        """Update memory statistics."""
        self.stats["total_entries"] = len(self._cache)

        type_counts = {t: 0 for t in MemoryType}
        scope_counts = {s: 0 for s in MemoryScope}

        for cached in self._cache.values():
            type_counts[cached.entry.memory_type] += 1
            scope_counts[cached.entry.scope] += 1

        self.stats["entries_by_type"] = type_counts
        self.stats["entries_by_scope"] = scope_counts

    def _update_stats_by_type(self) -> None:
        """Update statistics by memory type."""
        type_counts = {t: 0 for t in MemoryType}
        scope_counts = {s: 0 for s in MemoryScope}

        for cached in self._cache.values():
            type_counts[cached.entry.memory_type] += 1
            scope_counts[cached.entry.scope] += 1

        self.stats["entries_by_type"] = type_counts
        self.stats["entries_by_scope"] = scope_counts

    def _generate_content_hash(self, content: Any) -> str:
        """Generate hash for content deduplication."""
        try:
            content_str = str(content) if not isinstance(content, (str, bytes)) else content
            return hashlib.md5(content_str.encode()).hexdigest()
        except (TypeError, AttributeError, UnicodeEncodeError) as e:
            self.logger.warning(f"Content hash encoding failed, using fallback: {e}")
            return hashlib.md5(str(content).encode()).hexdigest()

    def _compress_content(self, content: Any) -> bytes:
        """Compress content for storage."""
        import pickle  # noqa: S403 - trusted internal content only
        return gzip.compress(pickle.dumps(content))

    def _decompress_content(self, compressed_content: bytes) -> Any:
        """Decompress content for retrieval."""
        import pickle  # noqa: S403 - trusted internal content only
        return pickle.loads(gzip.decompress(compressed_content))

    # Context Manager Support

    async def __aenter__(self) -> "PersistentMemoryAdapter":
        """Async context manager entry."""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.stop()

# Factory function
async def create_persistent_memory(
    agent_id: str,
    database_url: str,
    embedding_service: Any | None = None,
    **kwargs
) -> PersistentMemoryAdapter:
    """
    Create and initialize a persistent memory adapter.

    Args:
        agent_id: Unique agent identifier
        database_url: PostgreSQL connection URL
        embedding_service: Optional embedding service for semantic search
        **kwargs: Additional configuration options

    Returns:
        Initialized PersistentMemoryAdapter
    """
    config = PersistentMemoryConfig(database_url=database_url, **kwargs)
    adapter = PersistentMemoryAdapter(
        agent_id=agent_id,
        config=config,
        embedding_service=embedding_service,
    )
    await adapter.start()
    return adapter