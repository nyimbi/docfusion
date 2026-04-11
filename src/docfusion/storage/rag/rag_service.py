#!/usr/bin/env python3
"""
RAG Service - Main RAG System Implementation

Combines database operations, embedding generation, and semantic search
to provide a complete RAG (Retrieval-Augmented Generation) system
using PostgreSQL with pgai extensions.
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from .database import DatabaseConfiguration, DocumentChunk, RAGDatabase, RAGDocument
from .embedding_service import EmbeddingConfiguration, EmbeddingResult, EmbeddingService
from ...core.utils import uuid7str

@dataclass
class RAGConfiguration:
    """Configuration for RAG service"""

    # Database configuration
    connection_string: str
    schema_name: str = "rag"

    # Embedding configuration
    embedding_provider: str = "ollama"  # "ollama" or "openai"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "nomic-embed-text"
    openai_api_key: Optional[str] = None
    openai_model: str = "text-embedding-ada-002"
    embedding_dimensions: Optional[int] = None  # Auto-detected

    # Chunking configuration
    chunk_size: int = 1000
    chunk_overlap: int = 200
    min_chunk_size: int = 100

    # Search configuration
    default_similarity_threshold: float = 0.7
    max_search_results: int = 50
    enable_hybrid_search: bool = True

    # Processing configuration
    max_concurrent_requests: int = 10
    enable_caching: bool = True

    # Performance configuration
    batch_size: int = 100
    max_processing_time: float = 300.0

@dataclass
class RAGSearchResult:
    """Result from RAG search operation"""

    chunk_id: str
    document_id: str
    document_title: str
    content: str
    similarity_score: float
    chunk_index: int
    metadata: Dict[str, Any]
    document_metadata: Dict[str, Any]
    category: str = ""
    tags: List[str] = field(default_factory=list)

@dataclass
class RAGQueryResult:
    """Complete RAG query result with context"""

    query: str
    results: List[RAGSearchResult]
    context: str
    total_results: int
    search_time: float
    embedding_time: float
    query_metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class RAGStats:
    """RAG system statistics"""

    total_documents: int = 0
    total_chunks: int = 0
    total_queries: int = 0
    avg_query_time: float = 0.0
    avg_similarity_score: float = 0.0
    cache_hit_rate: float = 0.0
    embedding_cache_size: int = 0
    database_stats: Dict[str, Any] = field(default_factory=dict)

class RAGService:
    """Main RAG service orchestrating all components"""

    def __init__(self, config: RAGConfiguration):
        self.config = config
        self.logger = logging.getLogger(__name__)

        # Initialize components
        self._init_database_config()
        self._init_embedding_config()

        self.database = RAGDatabase(self.db_config)
        self.embedding_service = EmbeddingService(self.embedding_config)

        # Service state
        self._initialized = False
        self._stats = RAGStats()

        # Query history for analytics
        self.query_history: List[Dict[str, Any]] = []

    def _init_database_config(self):
        """Initialize database configuration"""
        # Get the current embedding model name
        embedding_model = (
            self.config.ollama_model
            if self.config.embedding_provider == "ollama"
            else self.config.openai_model
        )

        # Get embedding dimensions (auto-detect if not specified)
        embedding_dims = self.config.embedding_dimensions
        if embedding_dims is None:
            embedding_dims = self._get_default_embedding_dimensions()

        self.db_config = DatabaseConfiguration(
            connection_string=self.config.connection_string,
            schema_name=self.config.schema_name,
            embedding_model=embedding_model,
            embedding_dimensions=embedding_dims,
            chunk_size=self.config.chunk_size,
            chunk_overlap=self.config.chunk_overlap,
        )

    def _init_embedding_config(self):
        """Initialize embedding configuration"""
        # Get embedding dimensions (auto-detect if not specified)
        embedding_dims = self.config.embedding_dimensions
        if embedding_dims is None:
            embedding_dims = self._get_default_embedding_dimensions()

        self.embedding_config = EmbeddingConfiguration(
            provider=self.config.embedding_provider,
            ollama_base_url=self.config.ollama_base_url,
            ollama_model=self.config.ollama_model,
            openai_api_key=self.config.openai_api_key,
            openai_model=self.config.openai_model,
            embedding_dimensions=embedding_dims,
            chunk_size=self.config.chunk_size,
            chunk_overlap=self.config.chunk_overlap,
            min_chunk_size=self.config.min_chunk_size,
            max_concurrent_requests=self.config.max_concurrent_requests,
            enable_embedding_cache=self.config.enable_caching,
        )

    def _get_default_embedding_dimensions(self) -> int:
        """Get default embedding dimensions for the configured model"""
        if self.config.embedding_provider == "ollama":
            if "nomic-embed-text" in self.config.ollama_model:
                return 768  # nomic-embed-text dimensions
            elif "bge-m3" in self.config.ollama_model:
                return 1024  # bge-m3 dimensions
            else:
                return 1024  # Default for most Ollama embedding models
        else:  # OpenAI
            if "ada-002" in self.config.openai_model:
                return 1536  # text-embedding-ada-002 dimensions
            elif "3-small" in self.config.openai_model:
                return 1536  # text-embedding-3-small dimensions
            elif "3-large" in self.config.openai_model:
                return 3072  # text-embedding-3-large dimensions
            else:
                return 1536  # Default OpenAI dimensions

    async def initialize(self):
        """Initialize RAG service"""
        if self._initialized:
            return

        try:
            # Initialize database
            await self.database.initialize()

            self._initialized = True
            self.logger.info("RAG service initialized successfully")

        except Exception as e:
            self.logger.error(f"Failed to initialize RAG service: {e}")
            raise RuntimeError(f"RAG service initialization failed: {e}") from e

    async def add_document(
        self,
        content: str,
        title: str,
        document_id: Optional[str] = None,
        document_type: str = "text",
        category: str = "general",
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """Add a document to the RAG system"""
        await self._ensure_initialized()

        if document_id is None:
            document_id = uuid7str()

        document = RAGDocument(
            document_id=document_id,
            title=title,
            content=content,
            document_type=document_type,
            category=category,
            tags=tags or [],
            metadata=metadata or {},
        )

        try:
            # Store document in database
            stored = await self.database.store_document(document)
            if not stored:
                return None

            # Process document into chunks with embeddings
            chunks = await self.embedding_service.process_document(document)

            # Store chunks in database
            stored_chunks = await self.database.store_chunks(chunks)

            if stored_chunks > 0:
                self.logger.info(
                    f"Successfully added document {document_id} with {stored_chunks} chunks"
                )
                return document_id
            else:
                self.logger.error(f"Failed to store chunks for document {document_id}")
                # Clean up document if chunk storage failed
                await self.database.delete_document(document_id)
                return None

        except Exception as e:
            self.logger.error(f"Failed to add document {document_id}: {e}")
            return None

    async def search(
        self,
        query: str,
        limit: int = 10,
        similarity_threshold: Optional[float] = None,
        filters: Optional[Dict[str, Any]] = None,
        include_context: bool = True,
    ) -> RAGQueryResult:
        """Perform semantic search and return results with context"""
        await self._ensure_initialized()

        start_time = datetime.now()

        if similarity_threshold is None:
            similarity_threshold = self.config.default_similarity_threshold

        try:
            # Generate query embedding
            embedding_start = datetime.now()
            query_embedding_result = (
                await self.embedding_service.generate_query_embedding(query)
            )
            embedding_time = (datetime.now() - embedding_start).total_seconds()

            if not query_embedding_result:
                self.logger.error("Failed to generate query embedding")
                return RAGQueryResult(
                    query=query,
                    results=[],
                    context="",
                    total_results=0,
                    search_time=0.0,
                    embedding_time=0.0,
                    query_metadata={"error": "Failed to generate query embedding"},
                )

            # Perform semantic search
            search_start = datetime.now()
            raw_results = await self.database.semantic_search(
                query_embedding=query_embedding_result.embedding,
                limit=min(limit, self.config.max_search_results),
                similarity_threshold=similarity_threshold,
                filters=filters,
            )
            search_time = (datetime.now() - search_start).total_seconds()

            # Convert to RAGSearchResult objects
            results = []
            for raw_result in raw_results:
                result = RAGSearchResult(
                    chunk_id=raw_result["chunk_id"],
                    document_id=raw_result["document_id"],
                    document_title=raw_result["document_title"],
                    content=raw_result["content"],
                    similarity_score=raw_result["similarity_score"],
                    chunk_index=raw_result["chunk_index"],
                    metadata=raw_result["chunk_metadata"],
                    document_metadata=raw_result["document_metadata"],
                    category=raw_result["category"],
                    tags=raw_result["tags"],
                )
                results.append(result)

            # Generate context from results
            context = ""
            if include_context and results:
                context = self._generate_context(results)

            total_search_time = (datetime.now() - start_time).total_seconds()

            # Create query result
            query_result = RAGQueryResult(
                query=query,
                results=results,
                context=context,
                total_results=len(results),
                search_time=search_time,
                embedding_time=embedding_time,
                query_metadata={
                    "total_time": total_search_time,
                    "similarity_threshold": similarity_threshold,
                    "filters": filters or {},
                    "embedding_model": self.config.embedding_model,
                },
            )

            # Update statistics
            self._update_query_stats(query_result)

            return query_result

        except Exception as e:
            self.logger.error(f"Search failed for query '{query}': {e}")
            return RAGQueryResult(
                query=query,
                results=[],
                context="",
                total_results=0,
                search_time=0.0,
                embedding_time=0.0,
                query_metadata={"error": str(e)},
            )

    async def get_document_context(
        self, document_id: str, max_chunks: int = 5
    ) -> Optional[str]:
        """Get context from a specific document"""
        await self._ensure_initialized()

        try:
            # Get document
            document = await self.database.get_document(document_id)
            if not document:
                return None

            # Get top chunks from the document (could implement ranking later)
            raw_results = await self.database.semantic_search(
                query_embedding=[0.0]
                * self.config.embedding_dimensions,  # Dummy embedding
                limit=max_chunks,
                similarity_threshold=0.0,  # Get all chunks
                filters={"document_id": document_id},
            )

            # Sort by chunk index to maintain document order
            raw_results.sort(key=lambda x: x["chunk_index"])

            # Combine chunks into context
            context_parts = []
            for result in raw_results:
                context_parts.append(result["content"])

            return "\n\n".join(context_parts)

        except Exception as e:
            self.logger.error(f"Failed to get document context for {document_id}: {e}")
            return None

    async def get_related_documents(
        self, document_id: str, limit: int = 5, similarity_threshold: float = 0.8
    ) -> List[RAGSearchResult]:
        """Find documents related to a given document"""
        await self._ensure_initialized()

        try:
            # Get document content for embedding
            document = await self.database.get_document(document_id)
            if not document:
                return []

            # Use document title as query (could use full content or summary)
            query = document.title

            # Search for related documents
            search_result = await self.search(
                query=query,
                limit=limit + 1,  # +1 to account for the source document
                similarity_threshold=similarity_threshold,
                include_context=False,
            )

            # Filter out the source document
            related_results = [
                result
                for result in search_result.results
                if result.document_id != document_id
            ]

            return related_results[:limit]

        except Exception as e:
            self.logger.error(
                f"Failed to find related documents for {document_id}: {e}"
            )
            return []

    async def delete_document(self, document_id: str) -> bool:
        """Delete a document from the RAG system"""
        await self._ensure_initialized()

        try:
            return await self.database.delete_document(document_id)
        except Exception as e:
            self.logger.error(f"Failed to delete document {document_id}: {e}")
            return False

    async def list_documents(
        self,
        category: Optional[str] = None,
        document_type: Optional[str] = None,
        tags: Optional[List[str]] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[RAGDocument]:
        """List documents with filtering"""
        await self._ensure_initialized()

        try:
            return await self.database.list_documents(
                category=category,
                document_type=document_type,
                tags=tags,
                limit=limit,
                offset=offset,
            )
        except Exception as e:
            self.logger.error(f"Failed to list documents: {e}")
            return []

    async def get_statistics(self) -> RAGStats:
        """Get comprehensive RAG system statistics"""
        await self._ensure_initialized()

        try:
            # Get database statistics
            db_stats = await self.database.get_statistics()

            # Get embedding cache statistics
            cache_stats = self.embedding_service.get_cache_stats()

            # Update stats object
            self._stats.total_documents = db_stats.get("total_documents", 0)
            self._stats.total_chunks = db_stats.get("total_chunks", 0)
            self._stats.database_stats = db_stats
            self._stats.embedding_cache_size = cache_stats["cache_size"]

            # Calculate cache hit rate if we have query history
            if self.query_history:
                successful_queries = len(
                    [q for q in self.query_history if not q.get("error")]
                )
                self._stats.cache_hit_rate = successful_queries / len(
                    self.query_history
                )

            return self._stats

        except Exception as e:
            self.logger.error(f"Failed to get statistics: {e}")
            return self._stats

    async def optimize_system(self) -> Dict[str, Any]:
        """Optimize the RAG system performance"""
        await self._ensure_initialized()

        optimization_results = {
            "timestamp": datetime.now().isoformat(),
            "operations_performed": [],
            "performance_improvements": {},
            "recommendations": [],
        }

        try:
            # Clear embedding cache to free memory
            self.embedding_service.clear_cache()
            optimization_results["operations_performed"].append(
                "cleared_embedding_cache"
            )

            # Get current statistics for recommendations
            stats = await self.get_statistics()

            # Generate performance recommendations
            if stats.total_chunks > 10000:
                optimization_results["recommendations"].append(
                    "Consider implementing chunk archiving for older documents"
                )

            if stats.avg_query_time > 1.0:
                optimization_results["recommendations"].append(
                    "Query performance is slow - consider optimizing database indexes"
                )

            if stats.cache_hit_rate < 0.5:
                optimization_results["recommendations"].append(
                    "Low cache hit rate - consider increasing cache size or TTL"
                )

            return optimization_results

        except Exception as e:
            self.logger.error(f"System optimization failed: {e}")
            optimization_results["error"] = str(e)
            return optimization_results

    def _generate_context(self, results: List[RAGSearchResult]) -> str:
        """Generate context string from search results"""
        if not results:
            return ""

        context_parts = []
        for i, result in enumerate(results):
            # Include document title and content
            part = f"[Document: {result.document_title}]\n{result.content}"
            context_parts.append(part)

        return "\n\n---\n\n".join(context_parts)

    def _update_query_stats(self, query_result: RAGQueryResult):
        """Update query statistics"""
        self._stats.total_queries += 1

        # Update average query time
        if self._stats.avg_query_time == 0:
            self._stats.avg_query_time = query_result.search_time
        else:
            self._stats.avg_query_time = (
                self._stats.avg_query_time * (self._stats.total_queries - 1)
                + query_result.search_time
            ) / self._stats.total_queries

        # Update average similarity score
        if query_result.results:
            avg_similarity = sum(
                r.similarity_score for r in query_result.results
            ) / len(query_result.results)
            if self._stats.avg_similarity_score == 0:
                self._stats.avg_similarity_score = avg_similarity
            else:
                self._stats.avg_similarity_score = (
                    self._stats.avg_similarity_score * (self._stats.total_queries - 1)
                    + avg_similarity
                ) / self._stats.total_queries

        # Add to query history (keep last 1000 queries)
        query_record = {
            "timestamp": datetime.now().isoformat(),
            "query": query_result.query,
            "results_count": query_result.total_results,
            "search_time": query_result.search_time,
            "embedding_time": query_result.embedding_time,
            "avg_similarity": sum(r.similarity_score for r in query_result.results)
            / len(query_result.results)
            if query_result.results
            else 0,
            "error": query_result.query_metadata.get("error"),
        }

        self.query_history.append(query_record)
        if len(self.query_history) > 1000:
            self.query_history = self.query_history[-1000:]

    async def _ensure_initialized(self):
        """Ensure service is initialized"""
        if not self._initialized:
            await self.initialize()

    async def close(self):
        """Close RAG service and cleanup resources"""
        try:
            if self.database:
                await self.database.close()

            if self.embedding_service:
                self.embedding_service.clear_cache()

            self.logger.info("RAG service closed successfully")

        except Exception as e:
            self.logger.error(f"Error closing RAG service: {e}")

# Utility functions
async def create_rag_service(
    connection_string: str,
    embedding_provider: str = "ollama",
    ollama_model: str = "nomic-embed-text",
    ollama_base_url: str = "http://localhost:11434",
    openai_api_key: Optional[str] = None,
    **kwargs,
) -> RAGService:
    """Create and initialize RAG service"""
    config = RAGConfiguration(
        connection_string=connection_string,
        embedding_provider=embedding_provider,
        ollama_model=ollama_model,
        ollama_base_url=ollama_base_url,
        openai_api_key=openai_api_key,
        **kwargs,
    )

    service = RAGService(config)
    await service.initialize()
    return service

def get_default_rag_config(connection_string: str) -> RAGConfiguration:
    """Get default RAG configuration using Ollama"""
    return RAGConfiguration(
        connection_string=connection_string,
        schema_name="rag",
        embedding_provider="ollama",
        ollama_model="nomic-embed-text",
        ollama_base_url="http://localhost:11434",
        embedding_dimensions=None,  # Auto-detected
        chunk_size=1000,
        chunk_overlap=200,
        default_similarity_threshold=0.7,
        max_search_results=50,
        enable_hybrid_search=True,
        max_concurrent_requests=10,
        enable_caching=True,
    )
