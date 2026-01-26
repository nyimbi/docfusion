#!/usr/bin/env python3
"""
RAG (Retrieval-Augmented Generation) System

PostgreSQL-based RAG implementation using pgai for vector operations and embeddings.
Provides semantic search, document chunking, and embedding management for the
DocuFusion storage layer.
"""

# Main exports
from .rag_service import (
    RAGService,
    RAGConfiguration,
    RAGSearchResult,
    RAGQueryResult,
    RAGStats,
    create_rag_service,
    get_default_rag_config
)

from .database import (
    RAGDatabase,
    RAGDocument,
    DocumentChunk,
    DatabaseConfiguration,
    create_rag_database,
    get_default_database_config
)

from .embedding_service import (
    EmbeddingService,
    EmbeddingConfiguration,
    EmbeddingResult,
    ChunkingResult,
    TextChunker,
    create_embedding_service,
    get_optimal_chunk_size
)

__all__ = [
    # Main RAG service
    'RAGService',
    'RAGConfiguration',
    'RAGSearchResult',
    'RAGQueryResult',
    'RAGStats',
    'create_rag_service',
    'get_default_rag_config',
    
    # Database layer
    'RAGDatabase',
    'RAGDocument',
    'DocumentChunk',
    'DatabaseConfiguration',
    'create_rag_database',
    'get_default_database_config',
    
    # Embedding service
    'EmbeddingService',
    'EmbeddingConfiguration',
    'EmbeddingResult',
    'ChunkingResult',
    'TextChunker',
    'create_embedding_service',
    'get_optimal_chunk_size',
]

__version__ = "1.0.0"