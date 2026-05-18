#!/usr/bin/env python3
"""
RAG-Enhanced Storage Service

Extends the existing storage service with RAG capabilities using PostgreSQL
and pgai for semantic search, document embeddings, and intelligent retrieval.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .rag import (
    RAGConfiguration,
    RAGService,
)
from .storage_service import StorageConfiguration, StorageService
from ..core.utils import uuid7str

@dataclass
class RAGStorageConfiguration:
    """Configuration for RAG-enhanced storage service"""

    # Base storage configuration
    storage_root_path: Path
    enable_search: bool = True
    enable_indexing: bool = True
    enable_retrieval: bool = True
    enable_content_blocks: bool = True

    # RAG configuration
    enable_rag: bool = True
    postgresql_connection_string: str = ""
    rag_schema_name: str = "rag"

    # Embedding provider configuration
    embedding_provider: str = "ollama"  # "ollama" or "openai"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "nomic-embed-text"
    openai_api_key: Optional[str] = None

    # RAG-specific settings
    similarity_threshold: float = 0.7
    max_rag_results: int = 20
    enable_hybrid_search: bool = True
    chunk_size: int = 1000
    chunk_overlap: int = 200

    # Performance settings
    search_cache_size: int = 1000
    retrieval_cache_size: int = 500
    max_concurrent_requests: int = 10

@dataclass
class EnhancedSearchResult:
    """Enhanced search result combining traditional and RAG search"""

    # Traditional search fields
    document_id: str
    title: str
    content_snippet: str
    relevance_score: float
    match_type: str
    source: str

    # RAG-specific fields
    similarity_score: Optional[float] = None
    chunk_id: Optional[str] = None
    chunk_index: Optional[int] = None
    semantic_context: Optional[str] = None

    # Combined metadata
    category: str = ""
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    highlights: List[str] = field(default_factory=list)

class RAGStorageService:
    """Storage service enhanced with RAG capabilities"""

    def __init__(self, config: RAGStorageConfiguration):
        self.config = config
        self.logger = logging.getLogger(__name__)

        # Initialize base storage service
        base_config = StorageConfiguration(
            storage_root_path=config.storage_root_path,
            enable_search=config.enable_search,
            enable_indexing=config.enable_indexing,
            enable_retrieval=config.enable_retrieval,
            enable_content_blocks=config.enable_content_blocks,
            search_cache_size=config.search_cache_size,
            retrieval_cache_size=config.retrieval_cache_size,
        )

        self.base_storage = StorageService(base_config)

        # Initialize RAG service if enabled
        self.rag_service: Optional[RAGService] = None
        if config.enable_rag and config.postgresql_connection_string:
            self._init_rag_service()

        # Service state
        self._initialized = False
        self._rag_available = False

    def _init_rag_service(self):
        """Initialize RAG service"""
        try:
            rag_config = RAGConfiguration(
                connection_string=self.config.postgresql_connection_string,
                schema_name=self.config.rag_schema_name,
                embedding_provider=self.config.embedding_provider,
                ollama_base_url=self.config.ollama_base_url,
                ollama_model=self.config.ollama_model,
                openai_api_key=self.config.openai_api_key,
                chunk_size=self.config.chunk_size,
                chunk_overlap=self.config.chunk_overlap,
                default_similarity_threshold=self.config.similarity_threshold,
                max_search_results=self.config.max_rag_results,
                enable_hybrid_search=self.config.enable_hybrid_search,
                max_concurrent_requests=self.config.max_concurrent_requests,
            )

            self.rag_service = RAGService(rag_config)
            self.logger.info("RAG service configured successfully")

        except Exception as e:
            self.logger.error(f"Failed to initialize RAG service: {e}")
            self.rag_service = None

    async def initialize(self):
        """Initialize the RAG-enhanced storage service"""
        if self._initialized:
            return

        try:
            # Initialize base storage service
            await self.base_storage.initialize()

            # Initialize RAG service if available
            if self.rag_service:
                await self.rag_service.initialize()
                self._rag_available = True
                self.logger.info("RAG service initialized successfully")

            self._initialized = True
            self.logger.info("RAG-enhanced storage service initialized successfully")

        except Exception as e:
            self.logger.error(f"Failed to initialize RAG storage service: {e}")
            raise RuntimeError(f"RAG storage service initialization failed: {e}") from e

    async def store_document(
        self,
        content: str,
        title: str = "",
        document_id: Optional[str] = None,
        content_type: str = "text",
        category: str = "general",
        tags: Optional[List[str]] = None,
        author: str = "system",
        metadata: Optional[Dict[str, Any]] = None,
        enable_rag_indexing: bool = True,
    ) -> str:
        """Store document in both traditional and RAG storage"""
        await self._ensure_initialized()

        if document_id is None:
            document_id = uuid7str()

        # Store in base storage service
        base_doc_id = await self.base_storage.store_document(
            content=content,
            title=title,
            document_id=document_id,
            content_type=content_type,
            category=category,
            tags=tags,
            author=author,
            metadata=metadata,
        )

        # Store in RAG system if available and enabled
        if self._rag_available and enable_rag_indexing and self.rag_service:
            try:
                rag_doc_id = await self.rag_service.add_document(
                    content=content,
                    title=title,
                    document_id=document_id,
                    document_type=content_type,
                    category=category,
                    tags=tags or [],
                    metadata=metadata or {},
                )

                if rag_doc_id:
                    self.logger.debug(f"Document {document_id} indexed in RAG system")
                else:
                    self.logger.warning(
                        f"Failed to index document {document_id} in RAG system"
                    )

            except Exception as e:
                self.logger.error(
                    f"RAG indexing failed for document {document_id}: {e}"
                )
                # Don't fail the entire operation if RAG indexing fails

        return base_doc_id

    async def search_documents(
        self,
        query: str,
        search_type: str = "hybrid",  # full_text, semantic, hybrid
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50,
        include_highlights: bool = True,
        similarity_threshold: Optional[float] = None,
    ) -> List[EnhancedSearchResult]:
        """Enhanced search combining traditional and semantic search"""
        await self._ensure_initialized()

        if search_type == "semantic" and not self._rag_available:
            self.logger.warning(
                "Semantic search requested but RAG not available, falling back to full_text"
            )
            search_type = "full_text"

        results = []

        try:
            if search_type in ["full_text", "hybrid"]:
                # Get traditional search results
                traditional_results = await self.base_storage.search_documents(
                    query=query,
                    search_type="full_text",
                    filters=filters,
                    limit=limit,
                    include_highlights=include_highlights,
                )

                # Convert to enhanced results
                for result in traditional_results:
                    enhanced_result = EnhancedSearchResult(
                        document_id=result["document_id"],
                        title=result.get("title", ""),
                        content_snippet=result["content_snippet"],
                        relevance_score=result["relevance_score"],
                        match_type=result["match_type"],
                        source=result["source"],
                        category=result.get("category", ""),
                        tags=result.get("tags", []),
                        metadata=result.get("metadata", {}),
                        highlights=result.get("highlights", []),
                    )
                    results.append(enhanced_result)

            if (
                search_type in ["semantic", "hybrid"]
                and self._rag_available
                and self.rag_service
            ):
                # Get semantic search results
                try:
                    rag_result = await self.rag_service.search(
                        query=query,
                        limit=limit,
                        similarity_threshold=similarity_threshold
                        or self.config.similarity_threshold,
                        filters=filters,
                        include_context=False,
                    )

                    # Convert RAG results to enhanced results
                    for rag_search_result in rag_result.results:
                        enhanced_result = EnhancedSearchResult(
                            document_id=rag_search_result.document_id,
                            title=rag_search_result.document_title,
                            content_snippet=rag_search_result.content,
                            relevance_score=rag_search_result.similarity_score,
                            similarity_score=rag_search_result.similarity_score,
                            match_type="semantic",
                            source="rag_system",
                            chunk_id=rag_search_result.chunk_id,
                            chunk_index=rag_search_result.chunk_index,
                            category=rag_search_result.category,
                            tags=rag_search_result.tags,
                            metadata=rag_search_result.metadata,
                        )
                        results.append(enhanced_result)

                except Exception as e:
                    self.logger.error(f"Semantic search failed: {e}")
                    # Continue with traditional results only

            # Deduplicate and merge results if hybrid search
            if search_type == "hybrid":
                results = self._merge_search_results(results, limit)

            return results[:limit]

        except Exception as e:
            self.logger.error(f"Enhanced search failed: {e}")
            return []

    async def get_semantic_context(
        self,
        query: str,
        max_results: int = 5,
        similarity_threshold: Optional[float] = None,
    ) -> Optional[str]:
        """Get semantic context for a query using RAG"""
        if not self._rag_available or not self.rag_service:
            return None

        try:
            rag_result = await self.rag_service.search(
                query=query,
                limit=max_results,
                similarity_threshold=similarity_threshold
                or self.config.similarity_threshold,
                include_context=True,
            )

            return rag_result.context if rag_result.context else None

        except Exception as e:
            self.logger.error(f"Failed to get semantic context: {e}")
            return None

    async def find_related_documents(
        self, document_id: str, limit: int = 5, similarity_threshold: float = 0.8
    ) -> List[EnhancedSearchResult]:
        """Find documents semantically related to a given document"""
        if not self._rag_available or not self.rag_service:
            return []

        try:
            related_results = await self.rag_service.get_related_documents(
                document_id=document_id,
                limit=limit,
                similarity_threshold=similarity_threshold,
            )

            # Convert to enhanced results
            enhanced_results = []
            for result in related_results:
                enhanced_result = EnhancedSearchResult(
                    document_id=result.document_id,
                    title=result.document_title,
                    content_snippet=result.content,
                    relevance_score=result.similarity_score,
                    similarity_score=result.similarity_score,
                    match_type="semantic_related",
                    source="rag_system",
                    chunk_id=result.chunk_id,
                    chunk_index=result.chunk_index,
                    category=result.category,
                    tags=result.tags,
                    metadata=result.metadata,
                )
                enhanced_results.append(enhanced_result)

            return enhanced_results

        except Exception as e:
            self.logger.error(f"Failed to find related documents: {e}")
            return []

    async def get_content_recommendations(
        self,
        context: str,
        content_type: str = "both",
        category: Optional[str] = None,
        limit: int = 10,
        use_semantic_search: bool = True,
    ) -> List[Any]:
        """Enhanced content recommendations using both traditional and semantic methods"""
        await self._ensure_initialized()

        recommendations = []

        # Get traditional recommendations
        traditional_recs = await self.base_storage.get_content_recommendations(
            context=context, content_type=content_type, category=category, limit=limit
        )
        recommendations.extend(traditional_recs)

        # Get semantic recommendations if available
        if use_semantic_search and self._rag_available and self.rag_service:
            try:
                rag_result = await self.rag_service.search(
                    query=context,
                    limit=limit,
                    filters={"category": category} if category else None,
                    include_context=False,
                )

                # Convert RAG results to recommendation format
                for rag_search_result in rag_result.results:
                    # Create recommendation object compatible with existing format
                    recommendation = type(
                        "ContentRecommendation",
                        (),
                        {
                            "title": rag_search_result.document_title,
                            "content": rag_search_result.content,
                            "content_type": "semantic",
                            "relevance_score": rag_search_result.similarity_score,
                            "metadata": {
                                **rag_search_result.metadata,
                                "chunk_id": rag_search_result.chunk_id,
                                "chunk_index": rag_search_result.chunk_index,
                                "similarity_score": rag_search_result.similarity_score,
                            },
                        },
                    )()
                    recommendations.append(recommendation)

            except Exception as e:
                self.logger.error(f"Semantic recommendations failed: {e}")

        # Sort by relevance score and limit
        recommendations.sort(
            key=lambda x: getattr(x, "relevance_score", 0), reverse=True
        )
        return recommendations[:limit]

    async def delete_document(self, document_id: str) -> bool:
        """Delete document from both traditional and RAG storage"""
        await self._ensure_initialized()

        # Delete from base storage
        base_deleted = await self.base_storage.delete_document(document_id)

        # Delete from RAG system if available
        rag_deleted = True
        if self._rag_available and self.rag_service:
            try:
                rag_deleted = await self.rag_service.delete_document(document_id)
            except Exception as e:
                self.logger.error(f"Failed to delete document from RAG system: {e}")
                rag_deleted = False

        return base_deleted and rag_deleted

    async def get_storage_statistics(self) -> Dict[str, Any]:
        """Get comprehensive storage statistics including RAG metrics"""
        await self._ensure_initialized()

        # Get base storage statistics
        base_stats = await self.base_storage.get_storage_statistics()

        # Get RAG statistics if available
        rag_stats = {}
        if self._rag_available and self.rag_service:
            try:
                rag_system_stats = await self.rag_service.get_statistics()
                rag_stats = {
                    "rag_total_documents": rag_system_stats.total_documents,
                    "rag_total_chunks": rag_system_stats.total_chunks,
                    "rag_total_queries": rag_system_stats.total_queries,
                    "rag_avg_query_time": rag_system_stats.avg_query_time,
                    "rag_avg_similarity_score": rag_system_stats.avg_similarity_score,
                    "rag_cache_hit_rate": rag_system_stats.cache_hit_rate,
                    "rag_embedding_cache_size": rag_system_stats.embedding_cache_size,
                    "rag_database_stats": rag_system_stats.database_stats,
                }
            except Exception as e:
                self.logger.error(f"Failed to get RAG statistics: {e}")
                rag_stats["rag_error"] = str(e)

        # Combine statistics
        combined_stats = {
            **base_stats,
            **rag_stats,
            "rag_enabled": self.config.enable_rag,
            "rag_available": self._rag_available,
            "hybrid_search_enabled": self.config.enable_hybrid_search,
        }

        return combined_stats

    async def optimize_storage(self) -> Dict[str, Any]:
        """Optimize both traditional and RAG storage systems"""
        await self._ensure_initialized()

        optimization_results = {
            "timestamp": datetime.now().isoformat(),
            "base_storage_optimization": {},
            "rag_optimization": {},
            "combined_recommendations": [],
        }

        # Optimize base storage
        try:
            optimization_results[
                "base_storage_optimization"
            ] = await self.base_storage.optimize_storage()
        except Exception as e:
            optimization_results["base_storage_optimization"] = {"error": str(e)}

        # Optimize RAG system
        if self._rag_available and self.rag_service:
            try:
                optimization_results[
                    "rag_optimization"
                ] = await self.rag_service.optimize_system()
            except Exception as e:
                optimization_results["rag_optimization"] = {"error": str(e)}

        # Generate combined recommendations
        stats = await self.get_storage_statistics()
        if stats.get("rag_avg_query_time", 0) > 1.0:
            optimization_results["combined_recommendations"].append(
                "RAG query performance is slow - consider database optimization"
            )

        if stats.get("cache_hit_rate", 0) < 0.5:
            optimization_results["combined_recommendations"].append(
                "Low cache hit rate - consider tuning cache settings"
            )

        return optimization_results

    def _merge_search_results(
        self, results: List[EnhancedSearchResult], limit: int
    ) -> List[EnhancedSearchResult]:
        """Merge and deduplicate search results from different sources"""
        # Group results by document_id
        grouped_results = {}

        for result in results:
            doc_id = result.document_id
            if doc_id not in grouped_results:
                grouped_results[doc_id] = result
            else:
                # Merge results for the same document
                existing = grouped_results[doc_id]

                # Use the higher relevance score
                if result.relevance_score > existing.relevance_score:
                    grouped_results[doc_id] = result

                # Combine semantic information
                if result.similarity_score and not existing.similarity_score:
                    existing.similarity_score = result.similarity_score
                    existing.chunk_id = result.chunk_id
                    existing.chunk_index = result.chunk_index

                # Merge highlights
                if result.highlights:
                    existing.highlights.extend(result.highlights)
                    existing.highlights = list(
                        set(existing.highlights)
                    )  # Remove duplicates

        # Sort by relevance score
        merged_results = list(grouped_results.values())
        merged_results.sort(key=lambda x: x.relevance_score, reverse=True)

        return merged_results[:limit]

    async def _ensure_initialized(self):
        """Ensure service is initialized"""
        if not self._initialized:
            await self.initialize()

    async def close(self):
        """Close all services and cleanup resources"""
        try:
            if self.base_storage:
                await self.base_storage.close()

            if self.rag_service:
                await self.rag_service.close()

            self.logger.info("RAG storage service closed successfully")

        except Exception as e:
            self.logger.error(f"Error closing RAG storage service: {e}")

# Utility functions
async def create_rag_storage_service(
    storage_path: Path,
    postgresql_connection_string: str,
    embedding_provider: str = "ollama",
    ollama_model: str = "nomic-embed-text",
    ollama_base_url: str = "http://localhost:11434",
    openai_api_key: Optional[str] = None,
    **kwargs,
) -> RAGStorageService:
    """Create and initialize RAG-enhanced storage service"""
    config = RAGStorageConfiguration(
        storage_root_path=storage_path,
        postgresql_connection_string=postgresql_connection_string,
        embedding_provider=embedding_provider,
        ollama_model=ollama_model,
        ollama_base_url=ollama_base_url,
        openai_api_key=openai_api_key,
        **kwargs,
    )

    service = RAGStorageService(config)
    await service.initialize()
    return service
