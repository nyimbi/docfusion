#!/usr/bin/env python3
"""
Storage Service Integration Layer

Provides unified interface between storage components and document engine.
Integrates TextSearchEngine, DocumentRetrieval, DocumentIndexer, and DocumentRetriever
into a cohesive service that the document engine can use seamlessly.
"""

import asyncio
import logging
logger = logging.getLogger(__name__)
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from .engines.document_retrieval import DocumentRetrieval
from .engines.text_search_engine import SearchQuery, TextSearchEngine
from .indexes.document_indexer import (
    DocumentIndexer,
    IndexConfiguration,
)
from .retrievers.document_retriever import ContentRecommendation, DocumentRetriever
from ..core.utils import uuid7str

class HealthStatus(Enum):
    """Health status enumeration"""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"

@dataclass
class ComponentHealth:
    """Health information for a storage component"""

    name: str
    status: HealthStatus
    last_check: datetime
    response_time_ms: float
    error_message: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)

@dataclass
class StorageHealthCheck:
    """Complete storage service health check result"""

    overall_status: HealthStatus
    timestamp: datetime
    uptime_seconds: float
    component_health: Dict[str, ComponentHealth]
    performance_metrics: Dict[str, float]
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

@dataclass
class StorageConfiguration:
    """Configuration for integrated storage service"""

    storage_root_path: Path
    enable_search: bool = True
    enable_indexing: bool = True
    enable_retrieval: bool = True
    enable_content_blocks: bool = True
    search_cache_size: int = 1000
    retrieval_cache_size: int = 500
    index_batch_size: int = 100
    enable_keyword_extraction: bool = True
    max_content_length: int = 1_000_000

@dataclass
class StorageStats:
    """Comprehensive storage system statistics"""

    total_documents: int = 0
    total_indexed_documents: int = 0
    total_content_blocks: int = 0
    total_templates: int = 0
    storage_size_mb: float = 0.0
    search_operations: int = 0
    retrieval_operations: int = 0
    recommendation_operations: int = 0
    average_search_time: float = 0.0
    average_retrieval_time: float = 0.0
    cache_hit_rate: float = 0.0
    component_status: Dict[str, str] = field(default_factory=dict)

class StorageService:
    """
    Unified storage service that integrates all storage components
    and provides a single interface for the document engine
    """

    def __init__(self, config: StorageConfiguration):
        self.config = config
        self.config.storage_root_path.mkdir(parents=True, exist_ok=True)

        # Initialize storage components
        self._search_engine: Optional[TextSearchEngine] = None
        self._document_retrieval: Optional[DocumentRetrieval] = None
        self._document_indexer: Optional[DocumentIndexer] = None
        self._document_retriever: Optional[DocumentRetriever] = None

        # Service state
        self._initialized = False
        self._lock = asyncio.Lock()
        self._start_time = time.time()

        # Statistics tracking
        self._stats = StorageStats()

    async def initialize(self) -> None:
        """Initialize all storage components"""
        if self._initialized:
            return

        async with self._lock:
            if self._initialized:
                return

            try:
                # Initialize search engine
                if self.config.enable_search:
                    self._search_engine = TextSearchEngine(
                        self.config.storage_root_path / "search"
                    )
                    self._stats.component_status["search_engine"] = "active"

                # Initialize document retrieval
                if self.config.enable_retrieval:
                    self._document_retrieval = DocumentRetrieval(
                        self.config.storage_root_path / "documents",
                        cache_size=self.config.retrieval_cache_size,
                    )
                    self._stats.component_status["document_retrieval"] = "active"

                # Initialize document indexer
                if self.config.enable_indexing:
                    index_config = IndexConfiguration(
                        enable_content_extraction=True,
                        enable_keyword_extraction=self.config.enable_keyword_extraction,
                        max_content_length=self.config.max_content_length,
                        index_batch_size=self.config.index_batch_size,
                    )
                    self._document_indexer = DocumentIndexer(
                        self.config.storage_root_path / "indexes", index_config
                    )
                    self._stats.component_status["document_indexer"] = "active"

                # Initialize document retriever
                if self.config.enable_content_blocks:
                    self._document_retriever = DocumentRetriever(
                        self.config.storage_root_path / "retriever"
                    )
                    self._stats.component_status["document_retriever"] = "active"

                self._initialized = True

            except Exception as e:
                raise RuntimeError(f"Failed to initialize storage service: {e}") from e

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
    ) -> str:
        """Store document in all relevant storage components"""
        await self._ensure_initialized()

        if document_id is None:
            document_id = uuid7str()

        tags = tags or []
        metadata = metadata or {}

        try:
            # Store in search engine for full-text search
            if self._search_engine:
                await self._search_engine.index_document(
                    document_id, title, content, metadata
                )

            # Store in document retrieval for complete document access
            if self._document_retrieval:
                await self._document_retrieval.store_document(
                    content=content,
                    title=title,
                    document_id=document_id,
                    content_type=content_type,
                    category=category,
                    tags=tags,
                    author=author,
                    custom_metadata=metadata,
                )

            # Store in document indexer for metadata search and categorization
            if self._document_indexer:
                await self._document_indexer.index_document(
                    document_id=document_id,
                    title=title,
                    content=content,
                    content_type=content_type,
                    category=category,
                    tags=tags,
                    author=author,
                    custom_fields=metadata,
                )

            return document_id

        except Exception as e:
            # Attempt cleanup on failure
            await self._cleanup_failed_store(document_id)
            raise RuntimeError(f"Failed to store document {document_id}: {e}") from e

    async def retrieve_document(
        self, document_id: str, include_metadata: bool = True
    ) -> Optional[Dict[str, Any]]:
        """Retrieve complete document with metadata"""
        await self._ensure_initialized()

        try:
            self._stats.retrieval_operations += 1

            if not self._document_retrieval:
                return None

            result = await self._document_retrieval.retrieve_document(document_id)

            if result and include_metadata and self._document_indexer:
                # Enrich with indexed metadata
                indexed_doc = await self._document_indexer.get_document_by_id(
                    document_id
                )
                if indexed_doc:
                    result["indexed_metadata"] = {
                        "keywords": indexed_doc.extracted_keywords,
                        "word_count": indexed_doc.word_count,
                        "char_count": indexed_doc.char_count,
                        "indexed_at": indexed_doc.indexed_at.isoformat(),
                    }

            return result

        except Exception as e:
            logger.error(f"Error retrieving document {document_id}: {e}")
            return None

    async def search_documents(
        self,
        query: str,
        search_type: str = "full_text",  # full_text, metadata, both
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50,
        include_highlights: bool = True,
    ) -> List[Dict[str, Any]]:
        """Search documents using multiple search strategies"""
        await self._ensure_initialized()

        try:
            self._stats.search_operations += 1
            results = []

            filters = filters or {}

            # Full-text search using search engine
            if search_type in ["full_text", "both"] and self._search_engine:
                search_query = SearchQuery(
                    query=query,
                    result_limit=limit,
                    highlight_fragments=3 if include_highlights else 0,
                )

                search_results = await self._search_engine.search(search_query)

                for result in search_results:
                    doc_info = {
                        "document_id": result.document_id,
                        "title": result.title,
                        "content_snippet": result.content[:200] + "..."
                        if len(result.content) > 200
                        else result.content,
                        "relevance_score": result.relevance_score,
                        "match_type": result.match_type,
                        "source": "search_engine",
                    }

                    if include_highlights:
                        doc_info["highlights"] = result.highlights

                    results.append(doc_info)

            # Metadata search using indexer
            if search_type in ["metadata", "both"] and self._document_indexer:
                # Search by keywords
                if query:
                    keyword_results = await self._document_indexer.search_by_keywords(
                        query.split(), match_all=False
                    )

                    for doc in keyword_results:
                        doc_info = {
                            "document_id": doc.document_id,
                            "title": doc.title,
                            "content_snippet": doc.content[:200] + "..."
                            if len(doc.content) > 200
                            else doc.content,
                            "relevance_score": 0.5,  # Default score for metadata matches
                            "match_type": "metadata",
                            "source": "document_indexer",
                            "category": doc.category,
                            "tags": doc.tags,
                            "keywords": doc.extracted_keywords,
                        }
                        results.append(doc_info)

                # Apply filters
                if "category" in filters:
                    category_results = await self._document_indexer.search_by_category(
                        filters["category"]
                    )
                    for doc in category_results:
                        doc_info = {
                            "document_id": doc.document_id,
                            "title": doc.title,
                            "content_snippet": doc.content[:200] + "..."
                            if len(doc.content) > 200
                            else doc.content,
                            "relevance_score": 0.3,
                            "match_type": "category",
                            "source": "document_indexer",
                            "category": doc.category,
                            "tags": doc.tags,
                        }
                        results.append(doc_info)

                if "tags" in filters:
                    tag_results = await self._document_indexer.search_by_tags(
                        filters["tags"], match_all=False
                    )
                    for doc in tag_results:
                        doc_info = {
                            "document_id": doc.document_id,
                            "title": doc.title,
                            "content_snippet": doc.content[:200] + "..."
                            if len(doc.content) > 200
                            else doc.content,
                            "relevance_score": 0.4,
                            "match_type": "tags",
                            "source": "document_indexer",
                            "category": doc.category,
                            "tags": doc.tags,
                        }
                        results.append(doc_info)

            # Deduplicate results and sort by relevance
            unique_results = {}
            for result in results:
                doc_id = result["document_id"]
                if (
                    doc_id not in unique_results
                    or result["relevance_score"]
                    > unique_results[doc_id]["relevance_score"]
                ):
                    unique_results[doc_id] = result

            final_results = list(unique_results.values())
            final_results.sort(key=lambda x: x["relevance_score"], reverse=True)

            return final_results[:limit]

        except Exception as e:
            logger.error(f"Error searching documents: {e}")
            return []

    async def get_content_recommendations(
        self,
        context: str,
        content_type: str = "both",  # block, template, both
        category: Optional[str] = None,
        limit: int = 10,
    ) -> List[ContentRecommendation]:
        """Get intelligent content recommendations"""
        await self._ensure_initialized()

        try:
            self._stats.recommendation_operations += 1

            if not self._document_retriever:
                return []

            recommendations = await self._document_retriever.recommend_content(
                context=context,
                content_type=content_type,
                category=category,
                limit=limit,
            )

            return recommendations

        except Exception as e:
            logger.error(f"Error getting content recommendations: {e}")
            return []

    async def add_content_block(
        self,
        content: str,
        title: str,
        block_type: str = "general",
        category: str = "general",
        tags: Optional[List[str]] = None,
        author: str = "system",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """Add content block for reuse and templates"""
        await self._ensure_initialized()

        try:
            if not self._document_retriever:
                return None

            block_id = await self._document_retriever.add_content_block(
                content=content,
                title=title,
                block_type=block_type,
                category=category,
                tags=tags or [],
                author=author,
                metadata=metadata or {},
            )

            return block_id

        except Exception as e:
            logger.error(f"Error adding content block: {e}")
            return None

    async def add_template(
        self,
        name: str,
        description: str,
        template_type: str = "document",
        category: str = "general",
        content_blocks: Optional[List[str]] = None,
        variables: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
        author: str = "system",
    ) -> Optional[str]:
        """Add document template"""
        await self._ensure_initialized()

        try:
            if not self._document_retriever:
                return None

            template_id = await self._document_retriever.add_template(
                name=name,
                description=description,
                template_type=template_type,
                category=category,
                content_blocks=content_blocks or [],
                variables=variables or {},
                tags=tags or [],
                author=author,
            )

            return template_id

        except Exception as e:
            logger.error(f"Error adding template: {e}")
            return None

    async def list_documents(
        self,
        category: Optional[str] = None,
        content_type: Optional[str] = None,
        tags: Optional[List[str]] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """List documents with filtering options"""
        await self._ensure_initialized()

        try:
            results = []

            # Get documents from retrieval system
            if self._document_retrieval:
                retrieval_docs = await self._document_retrieval.list_documents(
                    category=category,
                    tags=tags,
                    content_type=content_type,
                    limit=limit,
                    offset=offset,
                )

                for doc in retrieval_docs:
                    doc_info = {
                        "document_id": doc.document_id,
                        "title": doc.title,
                        "content_type": doc.content_type,
                        "category": doc.category,
                        "tags": doc.tags,
                        "author": doc.author,
                        "created_at": doc.created_at.isoformat(),
                        "updated_at": doc.updated_at.isoformat(),
                        "file_size": doc.file_size,
                        "access_count": doc.access_count,
                        "metadata": asdict(doc),
                    }
                    results.append(doc_info)

            return results

        except Exception as e:
            logger.error(f"Error listing documents: {e}")
            return []

    async def delete_document(self, document_id: str) -> bool:
        """Delete document from all storage components"""
        await self._ensure_initialized()

        try:
            success = True

            # Remove from search engine
            if self._search_engine:
                await self._search_engine.remove_document(document_id)

            # Remove from document retrieval
            if self._document_retrieval:
                success &= await self._document_retrieval.delete_document(document_id)

            # Remove from document indexer
            if self._document_indexer:
                success &= await self._document_indexer.remove_document(document_id)

            return success

        except Exception as e:
            logger.error(f"Error deleting document {document_id}: {e}")
            return False

    async def get_storage_statistics(self) -> StorageStats:
        """Get comprehensive storage system statistics"""
        await self._ensure_initialized()

        try:
            # Update component-specific statistics
            if self._document_retrieval:
                retrieval_stats = await self._document_retrieval.get_storage_stats()
                self._stats.total_documents = retrieval_stats["total_documents"]
                self._stats.storage_size_mb = retrieval_stats["total_storage_mb"]
                self._stats.cache_hit_rate = retrieval_stats["cache_hit_rate"]

            if self._document_indexer:
                index_stats = await self._document_indexer.get_index_statistics()
                self._stats.total_indexed_documents = index_stats.total_documents

            if self._document_retriever:
                await self._document_retriever.get_retrieval_stats()
                self._stats.total_content_blocks = len(
                    [
                        block
                        for block in (
                            await self._document_retriever.get_popular_content(
                                "block", 10000
                            )
                        )
                    ]
                )
                self._stats.total_templates = len(
                    [
                        template
                        for template in (
                            await self._document_retriever.get_popular_content(
                                "template", 10000
                            )
                        )
                    ]
                )

            if self._search_engine:
                search_stats = await self._search_engine.get_search_stats()
                self._stats.search_operations = search_stats.total_searches
                self._stats.average_search_time = search_stats.average_search_time

            return self._stats

        except Exception as e:
            logger.error(f"Error getting storage statistics: {e}")
            return self._stats

    async def optimize_storage(self) -> Dict[str, Any]:
        """Optimize all storage components"""
        await self._ensure_initialized()

        optimization_results = {
            "timestamp": datetime.now().isoformat(),
            "components_optimized": [],
            "total_space_recovered_mb": 0.0,
            "errors": [],
        }

        try:
            # Optimize document retrieval
            if self._document_retrieval:
                retrieval_result = await self._document_retrieval.optimize_storage()
                optimization_results["components_optimized"].append(
                    "document_retrieval"
                )
                optimization_results["total_space_recovered_mb"] += (
                    retrieval_result.get("space_recovered_bytes", 0) / 1024 / 1024
                )
                optimization_results["document_retrieval"] = retrieval_result

            # Optimize document indexer
            if self._document_indexer:
                indexer_result = await self._document_indexer.optimize_indexes()
                optimization_results["components_optimized"].append("document_indexer")
                optimization_results["document_indexer"] = indexer_result

            # Clear caches
            if self._document_retrieval:
                await self._document_retrieval.clear_cache()

            if self._document_retriever:
                await self._document_retriever.clear_cache()

            optimization_results["cache_cleared"] = True

        except Exception as e:
            optimization_results["errors"].append(f"Optimization error: {e}")

        return optimization_results

    async def health_check(self, include_details: bool = True) -> StorageHealthCheck:
        """Perform comprehensive health check of all storage components"""
        timestamp = datetime.now()
        uptime = time.time() - self._start_time
        component_health = {}
        warnings = []
        errors = []
        performance_metrics = {}

        try:
            # Check if service is initialized
            if not self._initialized:
                warnings.append("Storage service not initialized")

            # Check search engine health
            if self._search_engine:
                search_health = await self._check_search_engine_health(include_details)
                component_health["search_engine"] = search_health
                performance_metrics["search_response_time_ms"] = (
                    search_health.response_time_ms
                )

                if search_health.status == HealthStatus.UNHEALTHY:
                    errors.append(
                        f"Search engine unhealthy: {search_health.error_message}"
                    )
                elif search_health.status == HealthStatus.DEGRADED:
                    warnings.append(
                        f"Search engine degraded: {search_health.error_message}"
                    )
            else:
                component_health["search_engine"] = ComponentHealth(
                    name="search_engine",
                    status=HealthStatus.UNKNOWN,
                    last_check=timestamp,
                    response_time_ms=0,
                    error_message="Component not enabled",
                )

            # Check document retrieval health
            if self._document_retrieval:
                retrieval_health = await self._check_document_retrieval_health(
                    include_details
                )
                component_health["document_retrieval"] = retrieval_health
                performance_metrics["retrieval_response_time_ms"] = (
                    retrieval_health.response_time_ms
                )

                if retrieval_health.status == HealthStatus.UNHEALTHY:
                    errors.append(
                        f"Document retrieval unhealthy: {retrieval_health.error_message}"
                    )
                elif retrieval_health.status == HealthStatus.DEGRADED:
                    warnings.append(
                        f"Document retrieval degraded: {retrieval_health.error_message}"
                    )
            else:
                component_health["document_retrieval"] = ComponentHealth(
                    name="document_retrieval",
                    status=HealthStatus.UNKNOWN,
                    last_check=timestamp,
                    response_time_ms=0,
                    error_message="Component not enabled",
                )

            # Check document indexer health
            if self._document_indexer:
                indexer_health = await self._check_document_indexer_health(
                    include_details
                )
                component_health["document_indexer"] = indexer_health
                performance_metrics["indexer_response_time_ms"] = (
                    indexer_health.response_time_ms
                )

                if indexer_health.status == HealthStatus.UNHEALTHY:
                    errors.append(
                        f"Document indexer unhealthy: {indexer_health.error_message}"
                    )
                elif indexer_health.status == HealthStatus.DEGRADED:
                    warnings.append(
                        f"Document indexer degraded: {indexer_health.error_message}"
                    )
            else:
                component_health["document_indexer"] = ComponentHealth(
                    name="document_indexer",
                    status=HealthStatus.UNKNOWN,
                    last_check=timestamp,
                    response_time_ms=0,
                    error_message="Component not enabled",
                )

            # Check document retriever health
            if self._document_retriever:
                retriever_health = await self._check_document_retriever_health(
                    include_details
                )
                component_health["document_retriever"] = retriever_health
                performance_metrics["retriever_response_time_ms"] = (
                    retriever_health.response_time_ms
                )

                if retriever_health.status == HealthStatus.UNHEALTHY:
                    errors.append(
                        f"Document retriever unhealthy: {retriever_health.error_message}"
                    )
                elif retriever_health.status == HealthStatus.DEGRADED:
                    warnings.append(
                        f"Document retriever degraded: {retriever_health.error_message}"
                    )
            else:
                component_health["document_retriever"] = ComponentHealth(
                    name="document_retriever",
                    status=HealthStatus.UNKNOWN,
                    last_check=timestamp,
                    response_time_ms=0,
                    error_message="Component not enabled",
                )

            # Check storage filesystem health
            filesystem_health = await self._check_filesystem_health(include_details)
            component_health["filesystem"] = filesystem_health

            if filesystem_health.status == HealthStatus.UNHEALTHY:
                errors.append(
                    f"Filesystem unhealthy: {filesystem_health.error_message}"
                )
            elif filesystem_health.status == HealthStatus.DEGRADED:
                warnings.append(
                    f"Filesystem degraded: {filesystem_health.error_message}"
                )

            # Determine overall status
            overall_status = self._determine_overall_health_status(
                component_health.values()
            )

            # Add performance metrics
            performance_metrics.update(
                {
                    "uptime_seconds": uptime,
                    "total_components": len(component_health),
                    "healthy_components": len(
                        [
                            c
                            for c in component_health.values()
                            if c.status == HealthStatus.HEALTHY
                        ]
                    ),
                    "degraded_components": len(
                        [
                            c
                            for c in component_health.values()
                            if c.status == HealthStatus.DEGRADED
                        ]
                    ),
                    "unhealthy_components": len(
                        [
                            c
                            for c in component_health.values()
                            if c.status == HealthStatus.UNHEALTHY
                        ]
                    ),
                }
            )

        except Exception as e:
            errors.append(f"Health check failed: {str(e)}")
            overall_status = HealthStatus.UNHEALTHY

        return StorageHealthCheck(
            overall_status=overall_status,
            timestamp=timestamp,
            uptime_seconds=uptime,
            component_health=component_health,
            performance_metrics=performance_metrics,
            warnings=warnings,
            errors=errors,
        )

    async def _check_search_engine_health(
        self, include_details: bool
    ) -> ComponentHealth:
        """Check search engine component health"""
        start_time = time.time()

        try:
            # Perform basic search operation
            test_query = SearchQuery(query="test", result_limit=1)
            await self._search_engine.search(test_query)

            response_time = (time.time() - start_time) * 1000

            details = {}
            if include_details:
                stats = await self._search_engine.get_search_stats()
                details = {
                    "total_searches": stats.total_searches,
                    "average_search_time": stats.average_search_time,
                    "cache_size": stats.cache_size,
                }

            # Determine status based on response time
            if response_time > 5000:  # 5 seconds
                status = HealthStatus.UNHEALTHY
                error_message = f"Search response time too high: {response_time:.2f}ms"
            elif response_time > 1000:  # 1 second
                status = HealthStatus.DEGRADED
                error_message = f"Search response time degraded: {response_time:.2f}ms"
            else:
                status = HealthStatus.HEALTHY
                error_message = None

            return ComponentHealth(
                name="search_engine",
                status=status,
                last_check=datetime.now(),
                response_time_ms=response_time,
                error_message=error_message,
                details=details,
            )

        except Exception as e:
            return ComponentHealth(
                name="search_engine",
                status=HealthStatus.UNHEALTHY,
                last_check=datetime.now(),
                response_time_ms=(time.time() - start_time) * 1000,
                error_message=f"Search engine error: {str(e)}",
            )

    async def _check_document_retrieval_health(
        self, include_details: bool
    ) -> ComponentHealth:
        """Check document retrieval component health"""
        start_time = time.time()

        try:
            # Check storage stats to test basic functionality
            await self._document_retrieval.get_storage_stats()

            response_time = (time.time() - start_time) * 1000

            details = {}
            if include_details:
                stats = await self._document_retrieval.get_storage_stats()
                details = {
                    "total_documents": stats.get("total_documents", 0),
                    "total_storage_mb": stats.get("total_storage_mb", 0),
                    "cache_hit_rate": stats.get("cache_hit_rate", 0),
                }

            # Determine status based on response time
            if response_time > 3000:  # 3 seconds
                status = HealthStatus.UNHEALTHY
                error_message = (
                    f"Document retrieval response time too high: {response_time:.2f}ms"
                )
            elif response_time > 1000:  # 1 second
                status = HealthStatus.DEGRADED
                error_message = (
                    f"Document retrieval response time degraded: {response_time:.2f}ms"
                )
            else:
                status = HealthStatus.HEALTHY
                error_message = None

            return ComponentHealth(
                name="document_retrieval",
                status=status,
                last_check=datetime.now(),
                response_time_ms=response_time,
                error_message=error_message,
                details=details,
            )

        except Exception as e:
            return ComponentHealth(
                name="document_retrieval",
                status=HealthStatus.UNHEALTHY,
                last_check=datetime.now(),
                response_time_ms=(time.time() - start_time) * 1000,
                error_message=f"Document retrieval error: {str(e)}",
            )

    async def _check_document_indexer_health(
        self, include_details: bool
    ) -> ComponentHealth:
        """Check document indexer component health"""
        start_time = time.time()

        try:
            # Check index statistics to test basic functionality
            await self._document_indexer.get_index_statistics()

            response_time = (time.time() - start_time) * 1000

            details = {}
            if include_details:
                stats = await self._document_indexer.get_index_statistics()
                details = {
                    "total_documents": stats.total_documents,
                    "total_categories": stats.total_categories,
                    "total_tags": stats.total_tags,
                    "index_size": stats.index_size,
                }

            # Determine status based on response time
            if response_time > 2000:  # 2 seconds
                status = HealthStatus.UNHEALTHY
                error_message = (
                    f"Document indexer response time too high: {response_time:.2f}ms"
                )
            elif response_time > 500:  # 500ms
                status = HealthStatus.DEGRADED
                error_message = (
                    f"Document indexer response time degraded: {response_time:.2f}ms"
                )
            else:
                status = HealthStatus.HEALTHY
                error_message = None

            return ComponentHealth(
                name="document_indexer",
                status=status,
                last_check=datetime.now(),
                response_time_ms=response_time,
                error_message=error_message,
                details=details,
            )

        except Exception as e:
            return ComponentHealth(
                name="document_indexer",
                status=HealthStatus.UNHEALTHY,
                last_check=datetime.now(),
                response_time_ms=(time.time() - start_time) * 1000,
                error_message=f"Document indexer error: {str(e)}",
            )

    async def _check_document_retriever_health(
        self, include_details: bool
    ) -> ComponentHealth:
        """Check document retriever component health"""
        start_time = time.time()

        try:
            # Check retrieval statistics to test basic functionality
            await self._document_retriever.get_retrieval_stats()

            response_time = (time.time() - start_time) * 1000

            details = {}
            if include_details:
                stats = await self._document_retriever.get_retrieval_stats()
                details = {
                    "cache_hit_rate": stats.get("cache_hit_rate", 0),
                    "recommendations_served": stats.get("recommendations_served", 0),
                    "average_recommendation_time": stats.get(
                        "average_recommendation_time", 0
                    ),
                }

            # Determine status based on response time
            if response_time > 2000:  # 2 seconds
                status = HealthStatus.UNHEALTHY
                error_message = (
                    f"Document retriever response time too high: {response_time:.2f}ms"
                )
            elif response_time > 500:  # 500ms
                status = HealthStatus.DEGRADED
                error_message = (
                    f"Document retriever response time degraded: {response_time:.2f}ms"
                )
            else:
                status = HealthStatus.HEALTHY
                error_message = None

            return ComponentHealth(
                name="document_retriever",
                status=status,
                last_check=datetime.now(),
                response_time_ms=response_time,
                error_message=error_message,
                details=details,
            )

        except Exception as e:
            return ComponentHealth(
                name="document_retriever",
                status=HealthStatus.UNHEALTHY,
                last_check=datetime.now(),
                response_time_ms=(time.time() - start_time) * 1000,
                error_message=f"Document retriever error: {str(e)}",
            )

    async def _check_filesystem_health(self, include_details: bool) -> ComponentHealth:
        """Check filesystem health for storage directories"""
        start_time = time.time()

        try:
            import shutil

            # Check if storage path exists and is writable
            if not self.config.storage_root_path.exists():
                raise Exception("Storage root path does not exist")

            if not self.config.storage_root_path.is_dir():
                raise Exception("Storage root path is not a directory")

            # Test write access by creating a temporary file
            test_file = self.config.storage_root_path / f"health_check_{uuid7str()}.tmp"
            test_file.write_text("health check")
            test_file.unlink()  # Clean up

            response_time = (time.time() - start_time) * 1000

            details = {}
            if include_details:
                # Get disk usage information
                usage = shutil.disk_usage(self.config.storage_root_path)
                total_gb = usage.total / (1024**3)
                used_gb = (usage.total - usage.free) / (1024**3)
                free_gb = usage.free / (1024**3)
                usage_percent = (used_gb / total_gb) * 100

                details = {
                    "total_space_gb": round(total_gb, 2),
                    "used_space_gb": round(used_gb, 2),
                    "free_space_gb": round(free_gb, 2),
                    "usage_percent": round(usage_percent, 2),
                    "storage_path": str(self.config.storage_root_path),
                }

            # Determine status based on disk usage
            if include_details and details.get("usage_percent", 0) > 95:
                status = HealthStatus.UNHEALTHY
                error_message = f"Disk usage critical: {details['usage_percent']:.1f}%"
            elif include_details and details.get("usage_percent", 0) > 85:
                status = HealthStatus.DEGRADED
                error_message = f"Disk usage high: {details['usage_percent']:.1f}%"
            else:
                status = HealthStatus.HEALTHY
                error_message = None

            return ComponentHealth(
                name="filesystem",
                status=status,
                last_check=datetime.now(),
                response_time_ms=response_time,
                error_message=error_message,
                details=details,
            )

        except Exception as e:
            return ComponentHealth(
                name="filesystem",
                status=HealthStatus.UNHEALTHY,
                last_check=datetime.now(),
                response_time_ms=(time.time() - start_time) * 1000,
                error_message=f"Filesystem error: {str(e)}",
            )

    def _determine_overall_health_status(self, component_healths) -> HealthStatus:
        """Determine overall health status from component health statuses"""
        health_counts = {
            HealthStatus.HEALTHY: 0,
            HealthStatus.DEGRADED: 0,
            HealthStatus.UNHEALTHY: 0,
            HealthStatus.UNKNOWN: 0,
        }

        for health in component_healths:
            health_counts[health.status] += 1

        total_components = sum(health_counts.values())

        if total_components == 0:
            return HealthStatus.UNKNOWN

        # If any component is unhealthy, overall status is unhealthy
        if health_counts[HealthStatus.UNHEALTHY] > 0:
            return HealthStatus.UNHEALTHY

        # If more than half are degraded or unknown, overall status is degraded
        degraded_ratio = (
            health_counts[HealthStatus.DEGRADED] + health_counts[HealthStatus.UNKNOWN]
        ) / total_components
        if degraded_ratio > 0.5:
            return HealthStatus.DEGRADED

        # If any component is degraded, overall status is degraded
        if health_counts[HealthStatus.DEGRADED] > 0:
            return HealthStatus.DEGRADED

        # Otherwise, healthy
        return HealthStatus.HEALTHY

    async def ping(self) -> Dict[str, Any]:
        """Simple ping endpoint for basic connectivity check"""
        return {
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "uptime_seconds": time.time() - self._start_time,
            "initialized": self._initialized,
            "service": "storage_service",
            "version": "1.0.0",
        }

    async def _ensure_initialized(self) -> None:
        """Ensure storage service is initialized"""
        if not self._initialized:
            await self.initialize()

    async def _cleanup_failed_store(self, document_id: str) -> None:
        """Clean up after failed document store operation"""
        try:
            if self._search_engine:
                await self._search_engine.remove_document(document_id)
            if self._document_retrieval:
                await self._document_retrieval.delete_document(document_id)
            if self._document_indexer:
                await self._document_indexer.remove_document(document_id)
        except Exception as e:
            logger.error(f"Error during cleanup of {document_id}: {e}")

    async def close(self) -> None:
        """Close storage service and cleanup resources"""
        # Save any pending data and cleanup
        try:
            if self._search_engine:
                await self._search_engine._save_indexes()

            if self._document_indexer:
                await self._document_indexer._save_all_indexes()

        except Exception as e:
            logger.error(f"Error during storage service cleanup: {e}")

# Convenience functions for easy integration
async def create_storage_service(
    storage_path: Path, enable_all_components: bool = True, **kwargs
) -> StorageService:
    """Create and initialize storage service with default configuration"""
    config = StorageConfiguration(
        storage_root_path=storage_path,
        enable_search=enable_all_components,
        enable_indexing=enable_all_components,
        enable_retrieval=enable_all_components,
        enable_content_blocks=enable_all_components,
        **kwargs,
    )

    service = StorageService(config)
    await service.initialize()
    return service

async def create_minimal_storage_service(storage_path: Path) -> StorageService:
    """Create storage service with minimal components for basic functionality"""
    config = StorageConfiguration(
        storage_root_path=storage_path,
        enable_search=True,
        enable_indexing=False,
        enable_retrieval=True,
        enable_content_blocks=False,
        search_cache_size=100,
        retrieval_cache_size=100,
    )

    service = StorageService(config)
    await service.initialize()
    return service
