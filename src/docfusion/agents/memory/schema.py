"""
PostgreSQL Schema for Agent Persistent Memory

This module defines the database schema for persistent agent memory storage,
including pgvector extension for semantic similarity search.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

# Schema version for migrations
SCHEMA_VERSION = "1.0.0"

# Default embedding dimensions (OpenAI text-embedding-ada-002)
DEFAULT_EMBEDDING_DIMENSIONS = 1536

# PostgreSQL schema for agent memories
AGENT_MEMORY_SCHEMA = """
-- ============================================================================
-- Agent Memory Persistence Schema
-- Version: {version}
--
-- This schema provides persistent storage for agent memories with:
-- - Multiple memory types (short_term, long_term, episodic, semantic, etc.)
-- - Scoped access (private, crew, swarm, global, project)
-- - Priority-based retention policies
-- - Vector similarity search via pgvector
-- - Memory relationships and associations
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS uuid-ossp;

-- ============================================================================
-- Agent Memories Table
-- Stores individual memory entries with embeddings for semantic search
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_memories (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Agent identification
    agent_id VARCHAR(255) NOT NULL,

    -- Memory classification
    memory_type VARCHAR(50) NOT NULL,
    scope VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',

    -- Content storage
    content JSONB NOT NULL,
    content_hash VARCHAR(64),  -- MD5 hash for deduplication

    -- Vector embedding for semantic search (OpenAI ada-002: 1536 dimensions)
    embedding vector({embedding_dimensions}),

    -- Metadata
    tags TEXT[] DEFAULT '{{}}',
    context JSONB DEFAULT '{{}}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Access tracking
    access_count INTEGER DEFAULT 0,

    -- Lifecycle
    expires_at TIMESTAMP WITH TIME ZONE,
    compressed BOOLEAN DEFAULT FALSE,
    encrypted BOOLEAN DEFAULT FALSE,

    -- Constraints
    CONSTRAINT valid_memory_type CHECK (memory_type IN (
        'short_term', 'long_term', 'episodic', 'semantic',
        'procedural', 'working', 'shared'
    )),
    CONSTRAINT valid_scope CHECK (scope IN (
        'private', 'crew', 'swarm', 'global', 'project'
    )),
    CONSTRAINT valid_priority CHECK (priority IN (
        'critical', 'high', 'medium', 'low', 'temporary'
    ))
);

-- ============================================================================
-- Indexes for Agent Memories
-- ============================================================================

-- Agent-based queries (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_agent_memories_agent_id
    ON agent_memories(agent_id);

-- Memory type filtering
CREATE INDEX IF NOT EXISTS idx_agent_memories_type
    ON agent_memories(memory_type);

-- Scope-based access control
CREATE INDEX IF NOT EXISTS idx_agent_memories_scope
    ON agent_memories(scope);

-- Priority-based cleanup queries
CREATE INDEX IF NOT EXISTS idx_agent_memories_priority
    ON agent_memories(priority);

-- Content hash for deduplication
CREATE INDEX IF NOT EXISTS idx_agent_memories_content_hash
    ON agent_memories(content_hash);

-- Expiration-based cleanup
CREATE INDEX IF NOT EXISTS idx_agent_memories_expires_at
    ON agent_memories(expires_at)
    WHERE expires_at IS NOT NULL;

-- Tag-based search using GIN index
CREATE INDEX IF NOT EXISTS idx_agent_memories_tags
    ON agent_memories USING GIN(tags);

-- Context JSONB queries
CREATE INDEX IF NOT EXISTS idx_agent_memories_context
    ON agent_memories USING GIN(context);

-- Vector similarity search using IVFFlat index
-- This is optimized for cosine similarity (vector_cosine_ops)
-- Adjust lists parameter based on expected dataset size:
-- - lists = sqrt(rows) is a good starting point
-- - For < 10k rows, use lists = 100
-- - For 10k-1M rows, use lists = sqrt(rows)
CREATE INDEX IF NOT EXISTS idx_agent_memories_embedding
    ON agent_memories
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_agent_memories_created_at
    ON agent_memories(created_at DESC);

-- Last accessed for LRU-style eviction
CREATE INDEX IF NOT EXISTS idx_agent_memories_last_accessed
    ON agent_memories(last_accessed DESC);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_agent_memories_agent_type_scope
    ON agent_memories(agent_id, memory_type, scope);

-- ============================================================================
-- Memory Relationships Table
-- Stores directed relationships between memories
-- ============================================================================
CREATE TABLE IF NOT EXISTS memory_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Related memories
    parent_id UUID NOT NULL REFERENCES agent_memories(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES agent_memories(id) ON DELETE CASCADE,

    -- Relationship metadata
    relationship_type VARCHAR(50) NOT NULL DEFAULT 'related',
    weight FLOAT DEFAULT 1.0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Metadata
    metadata JSONB DEFAULT '{{}}',

    -- Unique constraint
    CONSTRAINT unique_relationship UNIQUE (parent_id, child_id, relationship_type)
);

-- ============================================================================
-- Indexes for Memory Relationships
-- ============================================================================

-- Find children of a parent memory
CREATE INDEX IF NOT EXISTS idx_memory_relationships_parent
    ON memory_relationships(parent_id);

-- Find parents of a child memory
CREATE INDEX IF NOT EXISTS idx_memory_relationships_child
    ON memory_relationships(child_id);

-- Relationship type filtering
CREATE INDEX IF NOT EXISTS idx_memory_relationships_type
    ON memory_relationships(relationship_type);

-- ============================================================================
-- Memory Statistics Table
-- Aggregated statistics for memory management
-- ============================================================================
CREATE TABLE IF NOT EXISTS memory_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL,

    -- Counts by type
    short_term_count INTEGER DEFAULT 0,
    long_term_count INTEGER DEFAULT 0,
    episodic_count INTEGER DEFAULT 0,
    semantic_count INTEGER DEFAULT 0,
    procedural_count INTEGER DEFAULT 0,
    working_count INTEGER DEFAULT 0,
    shared_count INTEGER DEFAULT 0,

    -- Counts by scope
    private_count INTEGER DEFAULT 0,
    crew_count INTEGER DEFAULT 0,
    swarm_count INTEGER DEFAULT 0,
    global_count INTEGER DEFAULT 0,
    project_count INTEGER DEFAULT 0,

    -- Storage metrics
    total_size_bytes BIGINT DEFAULT 0,
    total_embeddings INTEGER DEFAULT 0,

    -- Timestamps
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint per agent
    CONSTRAINT unique_agent_stats UNIQUE (agent_id)
);

-- Index for quick stats lookup
CREATE INDEX IF NOT EXISTS idx_memory_stats_agent_id
    ON memory_stats(agent_id);

-- ============================================================================
-- Triggers and Functions
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for agent_memories
DROP TRIGGER IF EXISTS trigger_memory_updated_at ON agent_memories;
CREATE TRIGGER trigger_memory_updated_at
    BEFORE UPDATE ON agent_memories
    FOR EACH ROW
    EXECUTE FUNCTION update_memory_updated_at();

-- Function to compute memory content hash
CREATE OR REPLACE FUNCTION compute_content_hash()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content_hash = md5(NEW.content::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for content hashing (only on insert)
DROP TRIGGER IF EXISTS trigger_content_hash ON agent_memories;
CREATE TRIGGER trigger_content_hash
    BEFORE INSERT ON agent_memories
    FOR EACH ROW
    EXECUTE FUNCTION compute_content_hash();

-- ============================================================================
-- Utility Functions
-- ============================================================================

-- Function to find similar memories by embedding
CREATE OR REPLACE FUNCTION find_similar_memories(
    query_embedding vector,
    query_agent_id VARCHAR(255) DEFAULT NULL,
    query_scope VARCHAR(50) DEFAULT NULL,
    query_memory_type VARCHAR(50) DEFAULT NULL,
    similarity_threshold FLOAT DEFAULT 0.7,
    result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    agent_id VARCHAR(255),
    memory_type VARCHAR(50),
    scope VARCHAR(50),
    content JSONB,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.agent_id,
        m.memory_type,
        m.scope,
        m.content,
        1 - (m.embedding <=> query_embedding) AS similarity
    FROM agent_memories m
    WHERE
        (query_agent_id IS NULL OR m.agent_id = query_agent_id)
        AND (query_scope IS NULL OR m.scope = query_scope)
        AND (query_memory_type IS NULL OR m.memory_type = query_memory_type)
        AND m.embedding IS NOT NULL
        AND (1 - (m.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get memory statistics for an agent
CREATE OR REPLACE FUNCTION get_agent_memory_stats(p_agent_id VARCHAR(255))
RETURNS TABLE (
    memory_type VARCHAR(50),
    scope VARCHAR(50),
    count BIGINT,
    avg_access_count FLOAT,
    oldest_created TIMESTAMP WITH TIME ZONE,
    newest_created TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.memory_type,
        m.scope,
        COUNT(*) AS count,
        AVG(m.access_count)::FLOAT AS avg_access_count,
        MIN(m.created_at) AS oldest_created,
        MAX(m.created_at) AS newest_created
    FROM agent_memories m
    WHERE m.agent_id = p_agent_id
    GROUP BY m.memory_type, m.scope
    ORDER BY m.memory_type, m.scope;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired memories
CREATE OR REPLACE FUNCTION cleanup_expired_memories()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM agent_memories
    WHERE expires_at IS NOT NULL AND expires_at < NOW()
    AND priority != 'critical';  -- Never delete critical memories

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to prune low-priority memories when storage limit is reached
CREATE OR REPLACE FUNCTION prune_low_priority_memories(
    p_agent_id VARCHAR(255),
    max_memories INTEGER DEFAULT 10000
)
RETURNS INTEGER AS $$
DECLARE
    current_count INTEGER;
    deleted_count INTEGER;
BEGIN
    -- Get current memory count for agent
    SELECT COUNT(*) INTO current_count
    FROM agent_memories
    WHERE agent_id = p_agent_id;

    -- If under limit, nothing to do
    IF current_count <= max_memories THEN
        RETURN 0;
    END IF;

    -- Delete oldest low-priority memories first
    DELETE FROM agent_memories
    WHERE agent_id = p_agent_id
    AND priority = 'low'
    AND id IN (
        SELECT id FROM agent_memories
        WHERE agent_id = p_agent_id
        ORDER BY last_accessed ASC
        LIMIT (current_count - max_memories)
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
"""

# Additional indexes for specific query patterns
AGENT_MEMORY_OPTIMIZATION_INDEXES = """
-- Additional optimization indexes (create after data loading)

-- Partial index for active (non-expired) memories
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_memories_active
    ON agent_memories(agent_id, created_at DESC)
    WHERE expires_at IS NULL OR expires_at > NOW();

-- Covering index for list queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_memories_list_cover
    ON agent_memories(agent_id, memory_type, scope, created_at DESC)
    INCLUDE (id, content, priority);
"""


def get_schema_sql(
    embedding_dimensions: int = DEFAULT_EMBEDDING_DIMENSIONS,
    include_optimizations: bool = False
) -> str:
    """
    Get the complete schema SQL for agent memory persistence.

    Args:
        embedding_dimensions: Vector dimensions for embeddings
        include_optimizations: Whether to include optimization indexes

    Returns:
        Complete SQL schema as string
    """
    schema = AGENT_MEMORY_SCHEMA.format(
        version=SCHEMA_VERSION,
        embedding_dimensions=embedding_dimensions
    )

    if include_optimizations:
        schema += "\n\n" + AGENT_MEMORY_OPTIMIZATION_INDEXES

    return schema


def get_migration_statements(from_version: str | None, to_version: str) -> list[str]:
    """
    Get migration SQL statements between schema versions.

    Args:
        from_version: Current schema version (None for fresh install)
        to_version: Target schema version

    Returns:
        List of SQL statements for migration
    """
    migrations = []

    if from_version is None:
        # Fresh installation - create all tables
        migrations.append(get_schema_sql())
    elif from_version == "1.0.0" and to_version == "1.0.0":
        # No migration needed
        pass
    else:
        raise ValueError(f"Unsupported migration: {from_version} -> {to_version}")

    return migrations