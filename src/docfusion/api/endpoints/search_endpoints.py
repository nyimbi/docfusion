#!/usr/bin/env python3
"""
Advanced Search and Filtering Endpoints

Comprehensive search endpoints with full-text search, advanced filtering,
faceted search, and intelligent query processing with performance optimization.
"""

import asyncio
import logging
import re
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi import Path as PathParam
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator

try:
    import meilisearch
except ImportError:
    meilisearch = None

try:
    from opensearchpy import OpenSearch
except ImportError:
    OpenSearch = None

try:
    import httpx
except ImportError:
    httpx = None

from ...security import SecurityManager
from ..middleware.authentication_middleware import get_api_key_user, get_current_user
from ...core.utils import uuid7str

class SearchScope(str, Enum):
    """Search scope options"""

    ALL = "all"
    DOCUMENTS = "documents"
    TEMPLATES = "templates"
    COMMENTS = "comments"
    METADATA = "metadata"
    CONTENT = "content"

class SearchMode(str, Enum):
    """Search mode options"""

    FULL_TEXT = "full_text"
    EXACT = "exact"
    FUZZY = "fuzzy"
    REGEX = "regex"
    SEMANTIC = "semantic"

class SortOrder(str, Enum):
    """Sort order options"""

    ASC = "asc"
    DESC = "desc"

class SearchSort(str, Enum):
    """Sort field options"""

    RELEVANCE = "relevance"
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"
    TITLE = "title"
    SIZE = "size"
    AUTHOR = "author"
    POPULARITY = "popularity"

class DateFilter(BaseModel):
    """Date range filter"""

    field: str = Field(..., description="Date field to filter on")
    from_date: Optional[datetime] = Field(None, description="Start date")
    to_date: Optional[datetime] = Field(None, description="End date")
    relative: Optional[str] = Field(
        None, description="Relative date (e.g., '7d', '1m', '1y')"
    )

class RangeFilter(BaseModel):
    """Numeric range filter"""

    field: str = Field(..., description="Numeric field to filter on")
    min_value: Optional[float] = Field(None, description="Minimum value")
    max_value: Optional[float] = Field(None, description="Maximum value")

class FacetFilter(BaseModel):
    """Facet-based filter"""

    field: str = Field(..., description="Field to facet on")
    values: List[str] = Field(..., min_items=1, description="Values to filter by")
    operator: str = Field("OR", description="Filter operator (AND/OR)")

class SearchFilters(BaseModel):
    """Advanced search filters"""

    tags: Optional[List[str]] = Field(None, description="Tag filters")
    authors: Optional[List[str]] = Field(None, description="Author filters")
    document_types: Optional[List[str]] = Field(
        None, description="Document type filters"
    )
    categories: Optional[List[str]] = Field(None, description="Category filters")
    languages: Optional[List[str]] = Field(None, description="Language filters")
    date_filters: Optional[List[DateFilter]] = Field(
        None, description="Date range filters"
    )
    range_filters: Optional[List[RangeFilter]] = Field(
        None, description="Numeric range filters"
    )
    facet_filters: Optional[List[FacetFilter]] = Field(
        None, description="Facet filters"
    )
    custom_fields: Optional[Dict[str, Any]] = Field(
        None, description="Custom field filters"
    )

class SearchRequest(BaseModel):
    """Advanced search request"""

    query: str = Field(..., min_length=1, description="Search query")
    scope: SearchScope = Field(SearchScope.ALL, description="Search scope")
    mode: SearchMode = Field(SearchMode.FULL_TEXT, description="Search mode")
    filters: Optional[SearchFilters] = Field(None, description="Search filters")
    sort_by: SearchSort = Field(SearchSort.RELEVANCE, description="Sort field")
    sort_order: SortOrder = Field(SortOrder.DESC, description="Sort order")
    page: int = Field(1, ge=1, description="Page number")
    per_page: int = Field(20, ge=1, le=100, description="Results per page")
    highlight: bool = Field(True, description="Enable result highlighting")
    include_facets: bool = Field(False, description="Include facet counts")
    include_suggestions: bool = Field(False, description="Include search suggestions")
    include_debug: bool = Field(False, description="Include debug information")

class SearchHighlight(BaseModel):
    """Search result highlight"""

    field: str = Field(..., description="Highlighted field")
    fragments: List[str] = Field(..., description="Highlighted text fragments")

class SearchResultItem(BaseModel):
    """Individual search result item"""

    id: str = Field(..., description="Item ID")
    type: str = Field(..., description="Item type")
    title: str = Field(..., description="Item title")
    excerpt: Optional[str] = Field(None, description="Content excerpt")
    url: Optional[str] = Field(None, description="Item URL")
    score: float = Field(..., description="Relevance score")
    highlights: Optional[List[SearchHighlight]] = Field(
        None, description="Highlighted matches"
    )
    metadata: Dict[str, Any] = Field(..., description="Item metadata")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

class SearchFacet(BaseModel):
    """Search facet result"""

    field: str = Field(..., description="Facet field")
    values: List[Dict[str, Any]] = Field(..., description="Facet values with counts")
    total: int = Field(..., description="Total unique values")

class SearchSuggestion(BaseModel):
    """Search suggestion"""

    text: str = Field(..., description="Suggested query text")
    type: str = Field(..., description="Suggestion type")
    score: float = Field(..., description="Suggestion relevance")

class SearchDebugInfo(BaseModel):
    """Search debug information"""

    query_time_ms: float = Field(..., description="Query execution time")
    index_used: str = Field(..., description="Search index used")
    total_docs_examined: int = Field(..., description="Total documents examined")
    filters_applied: List[str] = Field(..., description="Filters that were applied")
    optimization_hints: List[str] = Field(..., description="Query optimization hints")

class SearchResponse(BaseModel):
    """Search response"""

    query: str = Field(..., description="Original search query")
    total_results: int = Field(..., description="Total number of results")
    page: int = Field(..., description="Current page")
    per_page: int = Field(..., description="Results per page")
    total_pages: int = Field(..., description="Total number of pages")
    results: List[SearchResultItem] = Field(..., description="Search results")
    facets: Optional[List[SearchFacet]] = Field(None, description="Search facets")
    suggestions: Optional[List[SearchSuggestion]] = Field(
        None, description="Search suggestions"
    )
    debug_info: Optional[SearchDebugInfo] = Field(None, description="Debug information")
    search_id: str = Field(default_factory=uuid7str, description="Unique search ID")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow, description="Search timestamp"
    )

class SavedSearch(BaseModel):
    """Saved search configuration"""

    search_id: str = Field(default_factory=uuid7str, description="Search ID")
    name: str = Field(..., min_length=1, max_length=100, description="Search name")
    description: Optional[str] = Field(
        None, max_length=500, description="Search description"
    )
    request: SearchRequest = Field(..., description="Search request configuration")
    created_by: str = Field(..., description="User who created the search")
    created_at: datetime = Field(
        default_factory=datetime.utcnow, description="Creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow, description="Last update timestamp"
    )
    is_public: bool = Field(False, description="Whether search is publicly accessible")
    tags: List[str] = Field(default_factory=list, description="Search tags")

class SearchBackend(ABC):
    """Abstract base class for search backends"""

    @abstractmethod
    async def index_document(
        self, doc_id: str, title: str, content: str, metadata: Dict[str, Any]
    ):
        """Index a document"""
        pass

    @abstractmethod
    async def search(
        self, request: SearchRequest
    ) -> Tuple[List[Tuple[str, float]], Dict[str, Any]]:
        """Execute search and return (results, debug_info)"""
        pass

    @abstractmethod
    async def delete_document(self, doc_id: str):
        """Delete document from index"""
        pass

    @abstractmethod
    async def get_stats(self) -> Dict[str, Any]:
        """Get backend statistics"""
        pass

class MeiliSearchBackend(SearchBackend):
    """MeiliSearch backend implementation"""

    def __init__(
        self,
        host: str = "http://localhost:7700",
        api_key: Optional[str] = None,
        index_name: str = "documents",
    ):
        self.host = host
        self.api_key = api_key
        self.index_name = index_name
        self.logger = logging.getLogger(__name__)

        if meilisearch is None:
            raise ImportError("meilisearch package is required for MeiliSearch backend")

        self.client = meilisearch.Client(host, api_key)
        self.index = self.client.index(index_name)

        # Initialize index settings
        asyncio.create_task(self._setup_index())

        self.logger.info(f"MeiliSearch backend initialized with host: {host}")

    async def _setup_index(self):
        """Setup MeiliSearch index configuration"""
        try:
            # Configure searchable attributes
            await asyncio.get_event_loop().run_in_executor(
                None,
                self.index.update_searchable_attributes,
                [
                    "title",
                    "content",
                    "metadata.tags",
                    "metadata.category",
                    "metadata.author",
                ],
            )

            # Configure filterable attributes
            await asyncio.get_event_loop().run_in_executor(
                None,
                self.index.update_filterable_attributes,
                ["type", "author", "category", "tags", "created_at", "updated_at"],
            )

            # Configure sortable attributes
            await asyncio.get_event_loop().run_in_executor(
                None,
                self.index.update_sortable_attributes,
                ["created_at", "updated_at", "title"],
            )

            self.logger.info("MeiliSearch index configured successfully")

        except Exception as e:
            self.logger.warning(f"MeiliSearch index setup failed: {e}")

    async def index_document(
        self, doc_id: str, title: str, content: str, metadata: Dict[str, Any]
    ):
        """Index document in MeiliSearch"""
        try:
            document = {
                "id": doc_id,
                "title": title,
                "content": content,
                "metadata": metadata,
                "indexed_at": datetime.utcnow().isoformat(),
            }

            await asyncio.get_event_loop().run_in_executor(
                None, self.index.add_documents, [document]
            )

            self.logger.debug(f"Indexed document {doc_id} in MeiliSearch")

        except Exception as e:
            self.logger.error(f"MeiliSearch indexing failed for {doc_id}: {e}")
            raise

    async def search(
        self, request: SearchRequest
    ) -> Tuple[List[Tuple[str, float]], Dict[str, Any]]:
        """Execute search in MeiliSearch"""
        try:
            # Build MeiliSearch query
            query_params = {
                "q": request.query,
                "limit": request.per_page,
                "offset": (request.page - 1) * request.per_page,
                "attributesToHighlight": ["title", "content"]
                if request.highlight
                else [],
                "showMatchesPosition": request.highlight,
            }

            # Add filters
            filters = self._build_meilisearch_filters(request.filters)
            if filters:
                query_params["filter"] = filters

            # Add sorting
            if request.sort_by != SearchSort.RELEVANCE:
                sort_field = self._map_sort_field(request.sort_by)
                sort_order = "asc" if request.sort_order == SortOrder.ASC else "desc"
                query_params["sort"] = [f"{sort_field}:{sort_order}"]

            # Execute search
            start_time = datetime.utcnow()
            results = await asyncio.get_event_loop().run_in_executor(
                None, self.index.search, request.query, query_params
            )
            end_time = datetime.utcnow()

            # Process results
            search_results = []
            for hit in results["hits"]:
                # MeiliSearch doesn't provide explicit scores, use position as proxy
                score = 1.0 / (results["hits"].index(hit) + 1)
                search_results.append((hit["id"], score))

            # Build debug info
            debug_info = {
                "query_time_ms": (end_time - start_time).total_seconds() * 1000,
                "total_hits": results.get("estimatedTotalHits", len(results["hits"])),
                "processing_time_ms": results.get("processingTimeMs", 0),
                "backend": "meilisearch",
            }

            return search_results, debug_info

        except Exception as e:
            self.logger.error(f"MeiliSearch search failed: {e}")
            raise

    def _build_meilisearch_filters(
        self, filters: Optional[SearchFilters]
    ) -> Optional[List[str]]:
        """Build MeiliSearch filter expressions"""
        if not filters:
            return None

        filter_expressions = []

        if filters.authors:
            authors_filter = " OR ".join(
                [f'author = "{author}"' for author in filters.authors]
            )
            filter_expressions.append(f"({authors_filter})")

        if filters.document_types:
            types_filter = " OR ".join(
                [f'type = "{doc_type}"' for doc_type in filters.document_types]
            )
            filter_expressions.append(f"({types_filter})")

        if filters.categories:
            categories_filter = " OR ".join(
                [f'category = "{category}"' for category in filters.categories]
            )
            filter_expressions.append(f"({categories_filter})")

        if filters.tags:
            tags_filter = " OR ".join([f'tags = "{tag}"' for tag in filters.tags])
            filter_expressions.append(f"({tags_filter})")

        # Date filters
        if filters.date_filters:
            for date_filter in filters.date_filters:
                if date_filter.from_date:
                    filter_expressions.append(
                        f"{date_filter.field} >= {date_filter.from_date.timestamp()}"
                    )
                if date_filter.to_date:
                    filter_expressions.append(
                        f"{date_filter.field} <= {date_filter.to_date.timestamp()}"
                    )

        return filter_expressions if filter_expressions else None

    def _map_sort_field(self, sort_by: SearchSort) -> str:
        """Map SearchSort to MeiliSearch field"""
        mapping = {
            SearchSort.CREATED_AT: "created_at",
            SearchSort.UPDATED_AT: "updated_at",
            SearchSort.TITLE: "title",
            SearchSort.AUTHOR: "author",
        }
        return mapping.get(sort_by, "created_at")

    async def delete_document(self, doc_id: str):
        """Delete document from MeiliSearch"""
        try:
            await asyncio.get_event_loop().run_in_executor(
                None, self.index.delete_document, doc_id
            )
            self.logger.debug(f"Deleted document {doc_id} from MeiliSearch")
        except Exception as e:
            self.logger.error(f"MeiliSearch document deletion failed for {doc_id}: {e}")
            raise

    async def get_stats(self) -> Dict[str, Any]:
        """Get MeiliSearch statistics"""
        try:
            stats = await asyncio.get_event_loop().run_in_executor(
                None, self.index.get_stats
            )
            return {
                "backend": "meilisearch",
                "total_documents": stats.get("numberOfDocuments", 0),
                "is_indexing": stats.get("isIndexing", False),
                "field_distribution": stats.get("fieldDistribution", {}),
            }
        except Exception as e:
            self.logger.error(f"Failed to get MeiliSearch stats: {e}")
            return {"backend": "meilisearch", "error": str(e)}

class OpenSearchBackend(SearchBackend):
    """OpenSearch/Elasticsearch backend implementation"""

    def __init__(
        self,
        host: str = "localhost",
        port: int = 9200,
        username: Optional[str] = None,
        password: Optional[str] = None,
        use_ssl: bool = False,
        index_name: str = "documents",
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.use_ssl = use_ssl
        self.index_name = index_name
        self.logger = logging.getLogger(__name__)

        if OpenSearch is None:
            raise ImportError(
                "opensearch-py package is required for OpenSearch backend"
            )

        # Configure OpenSearch client
        auth = (username, password) if username and password else None
        self.client = OpenSearch(
            hosts=[{"host": host, "port": port}],
            http_auth=auth,
            use_ssl=use_ssl,
            verify_certs=use_ssl,
            ssl_show_warn=False,
        )

        # Initialize index
        asyncio.create_task(self._setup_index())

        self.logger.info(f"OpenSearch backend initialized with host: {host}:{port}")

    async def _setup_index(self):
        """Setup OpenSearch index mapping"""
        try:
            # Check if index exists
            if not await asyncio.get_event_loop().run_in_executor(
                None, self.client.indices.exists, self.index_name
            ):
                # Create index with mapping
                mapping = {
                    "mappings": {
                        "properties": {
                            "id": {"type": "keyword"},
                            "title": {
                                "type": "text",
                                "analyzer": "standard",
                                "fields": {"keyword": {"type": "keyword"}},
                            },
                            "content": {"type": "text", "analyzer": "standard"},
                            "metadata": {
                                "properties": {
                                    "author": {"type": "keyword"},
                                    "category": {"type": "keyword"},
                                    "tags": {"type": "keyword"},
                                    "type": {"type": "keyword"},
                                    "created_at": {"type": "date"},
                                    "updated_at": {"type": "date"},
                                }
                            },
                            "indexed_at": {"type": "date"},
                        }
                    },
                    "settings": {
                        "number_of_shards": 1,
                        "number_of_replicas": 0,
                        "analysis": {
                            "analyzer": {
                                "custom_analyzer": {
                                    "type": "custom",
                                    "tokenizer": "standard",
                                    "filter": ["lowercase", "stop"],
                                }
                            }
                        },
                    },
                }

                await asyncio.get_event_loop().run_in_executor(
                    None, self.client.indices.create, self.index_name, mapping
                )

                self.logger.info("OpenSearch index created successfully")

        except Exception as e:
            self.logger.warning(f"OpenSearch index setup failed: {e}")

    async def index_document(
        self, doc_id: str, title: str, content: str, metadata: Dict[str, Any]
    ):
        """Index document in OpenSearch"""
        try:
            document = {
                "id": doc_id,
                "title": title,
                "content": content,
                "metadata": metadata,
                "indexed_at": datetime.utcnow().isoformat(),
            }

            await asyncio.get_event_loop().run_in_executor(
                None, self.client.index, self.index_name, document, doc_id
            )

            self.logger.debug(f"Indexed document {doc_id} in OpenSearch")

        except Exception as e:
            self.logger.error(f"OpenSearch indexing failed for {doc_id}: {e}")
            raise

    async def search(
        self, request: SearchRequest
    ) -> Tuple[List[Tuple[str, float]], Dict[str, Any]]:
        """Execute search in OpenSearch"""
        try:
            # Build OpenSearch query
            query_body = self._build_opensearch_query(request)

            # Execute search
            start_time = datetime.utcnow()
            response = await asyncio.get_event_loop().run_in_executor(
                None, self.client.search, self.index_name, query_body
            )
            end_time = datetime.utcnow()

            # Process results
            search_results = []
            for hit in response["hits"]["hits"]:
                search_results.append((hit["_id"], hit["_score"]))

            # Build debug info
            debug_info = {
                "query_time_ms": (end_time - start_time).total_seconds() * 1000,
                "total_hits": response["hits"]["total"]["value"],
                "max_score": response["hits"]["max_score"],
                "took_ms": response.get("took", 0),
                "backend": "opensearch",
            }

            return search_results, debug_info

        except Exception as e:
            self.logger.error(f"OpenSearch search failed: {e}")
            raise

    def _build_opensearch_query(self, request: SearchRequest) -> Dict[str, Any]:
        """Build OpenSearch query body"""
        query_body = {
            "from": (request.page - 1) * request.per_page,
            "size": request.per_page,
        }

        # Build main query
        if request.mode == SearchMode.EXACT:
            query = {"match_phrase": {"content": request.query}}
        elif request.mode == SearchMode.FUZZY:
            query = {
                "multi_match": {
                    "query": request.query,
                    "fields": ["title^2", "content"],
                    "fuzziness": "AUTO",
                }
            }
        elif request.mode == SearchMode.REGEX:
            query = {"regexp": {"content": request.query}}
        else:  # FULL_TEXT or SEMANTIC
            query = {
                "multi_match": {
                    "query": request.query,
                    "fields": ["title^2", "content", "metadata.tags"],
                    "type": "best_fields",
                }
            }

        # Add filters
        filters = self._build_opensearch_filters(request.filters)
        if filters:
            query_body["query"] = {"bool": {"must": [query], "filter": filters}}
        else:
            query_body["query"] = query

        # Add sorting
        if request.sort_by != SearchSort.RELEVANCE:
            sort_field = self._map_opensearch_sort_field(request.sort_by)
            sort_order = "asc" if request.sort_order == SortOrder.ASC else "desc"
            query_body["sort"] = [{sort_field: {"order": sort_order}}]

        # Add highlighting
        if request.highlight:
            query_body["highlight"] = {
                "fields": {
                    "title": {},
                    "content": {"fragment_size": 150, "number_of_fragments": 3},
                }
            }

        return query_body

    def _build_opensearch_filters(
        self, filters: Optional[SearchFilters]
    ) -> List[Dict[str, Any]]:
        """Build OpenSearch filter clauses"""
        if not filters:
            return []

        filter_clauses = []

        if filters.authors:
            filter_clauses.append({"terms": {"metadata.author": filters.authors}})

        if filters.document_types:
            filter_clauses.append({"terms": {"metadata.type": filters.document_types}})

        if filters.categories:
            filter_clauses.append({"terms": {"metadata.category": filters.categories}})

        if filters.tags:
            filter_clauses.append({"terms": {"metadata.tags": filters.tags}})

        # Date range filters
        if filters.date_filters:
            for date_filter in filters.date_filters:
                range_filter = {"range": {f"metadata.{date_filter.field}": {}}}

                if date_filter.from_date:
                    range_filter["range"][f"metadata.{date_filter.field}"]["gte"] = (
                        date_filter.from_date.isoformat()
                    )
                if date_filter.to_date:
                    range_filter["range"][f"metadata.{date_filter.field}"]["lte"] = (
                        date_filter.to_date.isoformat()
                    )

                filter_clauses.append(range_filter)

        # Numeric range filters
        if filters.range_filters:
            for range_filter in filters.range_filters:
                range_clause = {"range": {f"metadata.{range_filter.field}": {}}}

                if range_filter.min_value is not None:
                    range_clause["range"][f"metadata.{range_filter.field}"]["gte"] = (
                        range_filter.min_value
                    )
                if range_filter.max_value is not None:
                    range_clause["range"][f"metadata.{range_filter.field}"]["lte"] = (
                        range_filter.max_value
                    )

                filter_clauses.append(range_clause)

        return filter_clauses

    def _map_opensearch_sort_field(self, sort_by: SearchSort) -> str:
        """Map SearchSort to OpenSearch field"""
        mapping = {
            SearchSort.CREATED_AT: "metadata.created_at",
            SearchSort.UPDATED_AT: "metadata.updated_at",
            SearchSort.TITLE: "title.keyword",
            SearchSort.AUTHOR: "metadata.author",
        }
        return mapping.get(sort_by, "metadata.created_at")

    async def delete_document(self, doc_id: str):
        """Delete document from OpenSearch"""
        try:
            await asyncio.get_event_loop().run_in_executor(
                None, self.client.delete, self.index_name, doc_id
            )
            self.logger.debug(f"Deleted document {doc_id} from OpenSearch")
        except Exception as e:
            self.logger.error(f"OpenSearch document deletion failed for {doc_id}: {e}")
            raise

    async def get_stats(self) -> Dict[str, Any]:
        """Get OpenSearch statistics"""
        try:
            stats = await asyncio.get_event_loop().run_in_executor(
                None, self.client.indices.stats, self.index_name
            )

            index_stats = stats["indices"][self.index_name]
            return {
                "backend": "opensearch",
                "total_documents": index_stats["total"]["docs"]["count"],
                "index_size_bytes": index_stats["total"]["store"]["size_in_bytes"],
                "search_total": index_stats["total"]["search"]["query_total"],
                "search_time_ms": index_stats["total"]["search"][
                    "query_time_in_millis"
                ],
            }
        except Exception as e:
            self.logger.error(f"Failed to get OpenSearch stats: {e}")
            return {"backend": "opensearch", "error": str(e)}

class InMemorySearchBackend(SearchBackend):
    """Simple in-memory search backend for development/testing"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.documents: Dict[str, Dict[str, Any]] = {}
        self.word_index: Dict[str, Set[str]] = {}
        self.metadata_index: Dict[str, Dict[str, Set[str]]] = {}
        self.logger.info("In-memory search backend initialized")

    async def index_document(
        self, doc_id: str, title: str, content: str, metadata: Dict[str, Any]
    ):
        """Index document in memory"""
        # Store document
        doc = {
            "id": doc_id,
            "title": title,
            "content": content,
            "metadata": metadata,
            "indexed_at": datetime.utcnow(),
        }
        self.documents[doc_id] = doc

        # Index words
        all_text = f"{title} {content}".lower()
        words = re.findall(r"\b\w+\b", all_text)

        for word in words:
            if word not in self.word_index:
                self.word_index[word] = set()
            self.word_index[word].add(doc_id)

        # Index metadata
        for field, value in metadata.items():
            if field not in self.metadata_index:
                self.metadata_index[field] = {}

            value_str = str(value).lower()
            if value_str not in self.metadata_index[field]:
                self.metadata_index[field][value_str] = set()
            self.metadata_index[field][value_str].add(doc_id)

    async def search(
        self, request: SearchRequest
    ) -> Tuple[List[Tuple[str, float]], Dict[str, Any]]:
        """Execute in-memory search"""
        start_time = datetime.utcnow()

        # Simple full-text search
        query_words = re.findall(r"\b\w+\b", request.query.lower())
        doc_scores = {}

        for word in query_words:
            if word in self.word_index:
                for doc_id in self.word_index[word]:
                    if doc_id not in doc_scores:
                        doc_scores[doc_id] = 0.0
                    doc_scores[doc_id] += 1.0

        # Apply filters (simplified)
        if request.filters:
            filtered_docs = {}
            for doc_id, score in doc_scores.items():
                doc = self.documents[doc_id]
                if self._matches_filters(doc, request.filters):
                    filtered_docs[doc_id] = score
            doc_scores = filtered_docs

        # Sort and return
        results = [
            (doc_id, score)
            for doc_id, score in sorted(
                doc_scores.items(), key=lambda x: x[1], reverse=True
            )
        ]

        end_time = datetime.utcnow()
        debug_info = {
            "query_time_ms": (end_time - start_time).total_seconds() * 1000,
            "total_hits": len(results),
            "backend": "memory",
        }

        return results, debug_info

    def _matches_filters(self, doc: Dict[str, Any], filters: SearchFilters) -> bool:
        """Simple filter matching"""
        metadata = doc.get("metadata", {})

        if filters.authors:
            if metadata.get("author") not in filters.authors:
                return False

        if filters.tags:
            doc_tags = metadata.get("tags", [])
            if not any(tag in doc_tags for tag in filters.tags):
                return False

        return True

    async def delete_document(self, doc_id: str):
        """Delete document from memory"""
        if doc_id in self.documents:
            del self.documents[doc_id]

        # Clean up indexes
        for word, doc_ids in list(self.word_index.items()):
            doc_ids.discard(doc_id)
            if not doc_ids:
                del self.word_index[word]

    async def get_stats(self) -> Dict[str, Any]:
        """Get in-memory statistics"""
        return {
            "backend": "memory",
            "total_documents": len(self.documents),
            "total_words_indexed": len(self.word_index),
        }

class SearchEngine:
    """Advanced search engine with multiple backend support"""

    def __init__(
        self,
        security_manager: SecurityManager,
        backend_type: str = "memory",
        backend_config: Optional[Dict[str, Any]] = None,
    ):
        self.security = security_manager
        self.logger = logging.getLogger(__name__)
        self.backend_type = backend_type
        self.backend_config = backend_config or {}

        # Initialize search backend
        self.backend = self._create_backend(backend_type, backend_config)

        # Search statistics
        self.search_stats = {
            "total_searches": 0,
            "total_documents_indexed": 0,
            "average_query_time": 0.0,
            "most_common_queries": {},
            "facet_usage": {},
            "backend_type": backend_type,
        }

        # Saved searches
        self.saved_searches: Dict[str, SavedSearch] = {}
        self.user_searches: Dict[str, Set[str]] = {}

        self.logger.info(f"Search engine initialized with {backend_type} backend")

    def _create_backend(
        self, backend_type: str, config: Dict[str, Any]
    ) -> SearchBackend:
        """Create search backend instance"""
        if backend_type == "meilisearch":
            return MeiliSearchBackend(
                host=config.get("host", "http://localhost:7700"),
                api_key=config.get("api_key"),
                index_name=config.get("index_name", "documents"),
            )
        elif backend_type == "opensearch":
            return OpenSearchBackend(
                host=config.get("host", "localhost"),
                port=config.get("port", 9200),
                username=config.get("username"),
                password=config.get("password"),
                use_ssl=config.get("use_ssl", False),
                index_name=config.get("index_name", "documents"),
            )
        elif backend_type == "memory":
            return InMemorySearchBackend()
        else:
            raise ValueError(f"Unsupported backend type: {backend_type}")

    async def switch_backend(
        self, backend_type: str, config: Optional[Dict[str, Any]] = None
    ):
        """Switch to a different search backend"""
        try:
            new_backend = self._create_backend(backend_type, config or {})

            # Optionally migrate documents to new backend
            if hasattr(self.backend, "documents"):  # Only for memory backend
                for doc_id, doc in self.backend.documents.items():
                    await new_backend.index_document(
                        doc_id, doc["title"], doc["content"], doc["metadata"]
                    )

            self.backend = new_backend
            self.backend_type = backend_type
            self.search_stats["backend_type"] = backend_type

            self.logger.info(f"Switched to {backend_type} backend")

        except Exception as e:
            self.logger.error(f"Backend switch failed: {e}")
            raise

    async def index_document(
        self, doc_id: str, title: str, content: str, metadata: Dict[str, Any]
    ):
        """Index a document for searching"""
        try:
            await self.backend.index_document(doc_id, title, content, metadata)
            self.search_stats["total_documents_indexed"] += 1
            self.logger.debug(f"Indexed document {doc_id}")

        except Exception as e:
            self.logger.error(f"Document indexing failed for {doc_id}: {e}")
            raise

    async def search(
        self, request: SearchRequest, user_id: str, context: Dict[str, Any]
    ) -> SearchResponse:
        """Execute advanced search"""
        start_time = datetime.utcnow()

        try:
            # Track search statistics
            self.search_stats["total_searches"] += 1
            query = request.query.lower()

            if query in self.search_stats["most_common_queries"]:
                self.search_stats["most_common_queries"][query] += 1
            else:
                self.search_stats["most_common_queries"][query] = 1

            # Execute search with backend
            matching_docs, backend_debug = await self.backend.search(request)

            # Apply security filtering
            filtered_docs = await self._apply_security_filter(
                matching_docs, user_id, context
            )

            # Calculate pagination for filtered results
            total_results = len(filtered_docs)
            total_pages = (total_results + request.per_page - 1) // request.per_page
            start_idx = (request.page - 1) * request.per_page
            end_idx = start_idx + request.per_page
            page_docs = filtered_docs[start_idx:end_idx]

            # Build result items
            results = []
            for doc_id, score in page_docs:
                result_item = await self._build_result_item(doc_id, score, request)
                results.append(result_item)

            # Build response
            response = SearchResponse(
                query=request.query,
                total_results=total_results,
                page=request.page,
                per_page=request.per_page,
                total_pages=total_pages,
                results=results,
            )

            # Add optional components
            if request.include_facets:
                response.facets = await self._calculate_facets(filtered_docs)

            if request.include_suggestions:
                response.suggestions = await self._generate_suggestions(request.query)

            if request.include_debug:
                end_time = datetime.utcnow()
                query_time = (end_time - start_time).total_seconds() * 1000

                response.debug_info = SearchDebugInfo(
                    query_time_ms=query_time,
                    index_used=backend_debug.get("backend", "unknown"),
                    total_docs_examined=backend_debug.get(
                        "total_hits", len(matching_docs)
                    ),
                    filters_applied=self._get_applied_filters(request),
                    optimization_hints=self._get_optimization_hints(request),
                )

            # Update statistics
            end_time = datetime.utcnow()
            query_time = (end_time - start_time).total_seconds() * 1000
            self._update_average_query_time(query_time)

            return response

        except Exception as e:
            self.logger.error(f"Search execution failed: {e}")
            raise

    async def delete_document(self, doc_id: str):
        """Delete document from search index"""
        try:
            await self.backend.delete_document(doc_id)
            self.logger.debug(f"Deleted document {doc_id} from search index")
        except Exception as e:
            self.logger.error(f"Document deletion failed for {doc_id}: {e}")
            raise

    async def _apply_security_filter(
        self, docs: List[Tuple[str, float]], user_id: str, context: Dict[str, Any]
    ) -> List[Tuple[str, float]]:
        """Apply security filtering to search results"""
        filtered_docs = []

        for doc_id, score in docs:
            try:
                # Check document permissions
                permission_result = await self.security.check_document_permission(
                    doc_id, user_id, "view", context
                )

                if permission_result.get("has_permission", False):
                    filtered_docs.append((doc_id, score))
            except Exception as e:
                self.logger.warning(
                    f"Permission check failed for document {doc_id}: {e}"
                )

        return filtered_docs

    async def _build_result_item(
        self, doc_id: str, score: float, request: SearchRequest
    ) -> SearchResultItem:
        """Build search result item"""
        # For now, create a simple result item
        # In production, would fetch document details from storage
        return SearchResultItem(
            id=doc_id,
            type="document",
            title=f"Document {doc_id}",
            excerpt="Document content excerpt...",
            url=f"/documents/{doc_id}",
            score=score,
            highlights=None,
            metadata={"doc_id": doc_id, "backend": self.backend_type},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

    async def _calculate_facets(
        self, docs: List[Tuple[str, float]]
    ) -> List[SearchFacet]:
        """Calculate search facets from results"""
        # Simplified facet calculation - in production would use backend-specific facet features
        facets = []

        # For demonstration, create some sample facets
        facets.append(
            SearchFacet(
                field="backend",
                values=[{"value": self.backend_type, "count": len(docs)}],
                total=1,
            )
        )

        return facets

    async def _generate_suggestions(self, query: str) -> List[SearchSuggestion]:
        """Generate search suggestions"""
        suggestions = []

        # Simple suggestion generation based on common queries
        common_queries = list(self.search_stats["most_common_queries"].keys())

        for common_query in common_queries[:5]:
            if common_query != query.lower() and query.lower() in common_query:
                suggestions.append(
                    SearchSuggestion(text=common_query, type="popular", score=0.8)
                )

        return suggestions

    def _update_average_query_time(self, query_time: float):
        """Update average query time statistics"""
        current_avg = self.search_stats["average_query_time"]
        total_searches = self.search_stats["total_searches"]

        if total_searches == 1:
            self.search_stats["average_query_time"] = query_time
        else:
            self.search_stats["average_query_time"] = (
                (current_avg * (total_searches - 1)) + query_time
            ) / total_searches

    def _get_applied_filters(self, request: SearchRequest) -> List[str]:
        """Get list of applied filters for debugging"""
        applied = []

        if request.scope != SearchScope.ALL:
            applied.append(f"scope:{request.scope}")

        if request.mode != SearchMode.FULL_TEXT:
            applied.append(f"mode:{request.mode}")

        if request.filters:
            if request.filters.tags:
                applied.append("tags_filter")
            if request.filters.authors:
                applied.append("authors_filter")
            if request.filters.date_filters:
                applied.append("date_filters")

        return applied

    def _get_optimization_hints(self, request: SearchRequest) -> List[str]:
        """Get optimization hints for debugging"""
        hints = []

        if len(request.query) < 3:
            hints.append("Consider using longer search terms for better results")

        if request.mode == SearchMode.REGEX and len(request.query) > 20:
            hints.append("Complex regex patterns may be slower")

        if request.include_facets and not request.filters:
            hints.append("Facets are more effective when combined with filters")

        return hints

class SearchEndpoints:
    """Advanced search and filtering endpoints"""

    def __init__(self, security_manager: SecurityManager):
        self.security = security_manager
        self.search_engine = SearchEngine(security_manager)
        self.logger = logging.getLogger(__name__)

        # Create FastAPI router
        self.router = APIRouter(prefix="/api/v1/search", tags=["search"])

        # Register endpoints
        self._register_endpoints()

        self.logger.info("Search endpoints initialized")

    def _register_endpoints(self):
        """Register search endpoints"""

        @self.router.post("/", response_model=SearchResponse)
        async def search_documents(
            request: SearchRequest,
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Execute advanced search"""
            return await self.search_handler(request, current_user)

        @self.router.post("/saved", response_model=SavedSearch, status_code=201)
        async def save_search(
            name: str = Query(..., description="Search name"),
            description: Optional[str] = Query(None, description="Search description"),
            request: SearchRequest = ...,
            is_public: bool = Query(False, description="Make search public"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Save search configuration"""
            return await self.save_search_handler(
                name, description, request, is_public, current_user
            )

        @self.router.get("/saved", response_model=List[SavedSearch])
        async def list_saved_searches(
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """List user's saved searches"""
            return await self.list_saved_searches_handler(current_user)

        @self.router.get("/saved/{search_id}", response_model=SavedSearch)
        async def get_saved_search(
            search_id: str = PathParam(..., description="Saved search ID"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Get saved search by ID"""
            return await self.get_saved_search_handler(search_id, current_user)

        @self.router.post("/saved/{search_id}/execute", response_model=SearchResponse)
        async def execute_saved_search(
            search_id: str = PathParam(..., description="Saved search ID"),
            page: int = Query(1, ge=1, description="Page number"),
            per_page: int = Query(20, ge=1, le=100, description="Results per page"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Execute saved search"""
            return await self.execute_saved_search_handler(
                search_id, page, per_page, current_user
            )

        @self.router.delete("/saved/{search_id}", status_code=204)
        async def delete_saved_search(
            search_id: str = PathParam(..., description="Saved search ID"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Delete saved search"""
            await self.delete_saved_search_handler(search_id, current_user)

        @self.router.get("/suggestions", response_model=List[SearchSuggestion])
        async def get_search_suggestions(
            query: str = Query(..., min_length=1, description="Partial query"),
            limit: int = Query(5, ge=1, le=20, description="Maximum suggestions"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Get search suggestions"""
            return await self.get_search_suggestions_handler(query, limit, current_user)

        @self.router.get("/stats", response_model=Dict[str, Any])
        async def get_search_stats(
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Get search statistics"""
            return await self.get_search_stats_handler(current_user)

        @self.router.post("/index/document", response_model=Dict[str, Any])
        async def index_document(
            doc_id: str = Query(..., description="Document ID"),
            title: str = Query(..., description="Document title"),
            content: str = Query(..., description="Document content"),
            metadata: Dict[str, Any] = {},
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Index document for searching"""
            return await self.index_document_handler(
                doc_id, title, content, metadata, current_user
            )

        @self.router.post("/backend/switch", response_model=Dict[str, Any])
        async def switch_backend(
            backend_type: str = Query(
                ..., description="Backend type (memory, meilisearch, opensearch)"
            ),
            config: Dict[str, Any] = {},
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Switch search backend"""
            return await self.switch_backend_handler(backend_type, config, current_user)

    # ==================== HANDLER METHODS ====================

    async def search_handler(
        self, request: SearchRequest, current_user: Dict[str, Any]
    ) -> SearchResponse:
        """Handle search request"""
        try:
            user_id = current_user["user_id"]

            # Build context
            context = self._build_context(current_user)

            # Execute search
            response = await self.search_engine.search(request, user_id, context)

            # Log audit event
            await self.security.audit.log_event(
                event_type="search_executed",
                action="search",
                description=f"Search executed: '{request.query}'",
                user_id=user_id,
                resource_type="search",
                details={
                    "query": request.query,
                    "scope": request.scope,
                    "mode": request.mode,
                    "total_results": response.total_results,
                    "search_id": response.search_id,
                },
            )

            return response

        except Exception as e:
            self.logger.error(f"Search execution failed: {e}")
            raise HTTPException(status_code=500, detail="Search failed")

    async def save_search_handler(
        self,
        name: str,
        description: Optional[str],
        request: SearchRequest,
        is_public: bool,
        current_user: Dict[str, Any],
    ) -> SavedSearch:
        """Handle save search request"""
        try:
            user_id = current_user["user_id"]

            # Check permissions
            auth_result = await self.security.check_permission(
                user_id, "search", "save"
            )

            if not auth_result.has_permission:
                raise HTTPException(status_code=403, detail="Permission denied")

            # Create saved search
            saved_search = SavedSearch(
                name=name,
                description=description,
                request=request,
                created_by=user_id,
                is_public=is_public,
            )

            # Store saved search
            self.search_engine.saved_searches[saved_search.search_id] = saved_search

            # Track user searches
            if user_id not in self.search_engine.user_searches:
                self.search_engine.user_searches[user_id] = set()
            self.search_engine.user_searches[user_id].add(saved_search.search_id)

            self.logger.info(
                f"Saved search {saved_search.search_id} created by user {user_id}"
            )
            return saved_search

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Save search failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to save search")

    async def list_saved_searches_handler(
        self, current_user: Dict[str, Any]
    ) -> List[SavedSearch]:
        """Handle list saved searches request"""
        try:
            user_id = current_user["user_id"]

            if user_id not in self.search_engine.user_searches:
                return []

            saved_searches = []
            for search_id in self.search_engine.user_searches[user_id]:
                if search_id in self.search_engine.saved_searches:
                    saved_searches.append(self.search_engine.saved_searches[search_id])

            return saved_searches

        except Exception as e:
            self.logger.error(f"List saved searches failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to list saved searches")

    async def get_saved_search_handler(
        self, search_id: str, current_user: Dict[str, Any]
    ) -> SavedSearch:
        """Handle get saved search request"""
        try:
            user_id = current_user["user_id"]

            if search_id not in self.search_engine.saved_searches:
                raise HTTPException(status_code=404, detail="Saved search not found")

            saved_search = self.search_engine.saved_searches[search_id]

            # Check ownership or public access
            if saved_search.created_by != user_id and not saved_search.is_public:
                raise HTTPException(status_code=403, detail="Access denied")

            return saved_search

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Get saved search failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to get saved search")

    async def execute_saved_search_handler(
        self, search_id: str, page: int, per_page: int, current_user: Dict[str, Any]
    ) -> SearchResponse:
        """Handle execute saved search request"""
        try:
            # Get saved search
            saved_search = await self.get_saved_search_handler(search_id, current_user)

            # Update pagination in request
            search_request = saved_search.request.copy()
            search_request.page = page
            search_request.per_page = per_page

            # Execute search
            return await self.search_handler(search_request, current_user)

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Execute saved search failed: {e}")
            raise HTTPException(
                status_code=500, detail="Failed to execute saved search"
            )

    async def delete_saved_search_handler(
        self, search_id: str, current_user: Dict[str, Any]
    ):
        """Handle delete saved search request"""
        try:
            user_id = current_user["user_id"]

            if search_id not in self.search_engine.saved_searches:
                raise HTTPException(status_code=404, detail="Saved search not found")

            saved_search = self.search_engine.saved_searches[search_id]

            # Check ownership
            if saved_search.created_by != user_id:
                raise HTTPException(status_code=403, detail="Access denied")

            # Delete saved search
            del self.search_engine.saved_searches[search_id]

            # Remove from user tracking
            if user_id in self.search_engine.user_searches:
                self.search_engine.user_searches[user_id].discard(search_id)

            self.logger.info(f"Deleted saved search {search_id} for user {user_id}")

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Delete saved search failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to delete saved search")

    async def get_search_suggestions_handler(
        self, query: str, limit: int, current_user: Dict[str, Any]
    ) -> List[SearchSuggestion]:
        """Handle get search suggestions request"""
        try:
            suggestions = await self.search_engine._generate_suggestions(query)
            return suggestions[:limit]

        except Exception as e:
            self.logger.error(f"Get search suggestions failed: {e}")
            raise HTTPException(
                status_code=500, detail="Failed to get search suggestions"
            )

    async def get_search_stats_handler(
        self, current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle get search statistics request"""
        try:
            user_id = current_user["user_id"]

            # Check permissions
            auth_result = await self.security.check_permission(
                user_id, "system", "read"
            )

            stats = self.search_engine.search_stats.copy()
            backend_stats = await self.search_engine.backend.get_stats()

            if auth_result.has_permission:
                # Return full stats
                return {
                    "engine_stats": stats,
                    "backend_stats": backend_stats,
                    "permissions": "full",
                }
            else:
                # Return limited stats
                return {
                    "total_searches": stats["total_searches"],
                    "backend_type": stats["backend_type"],
                    "permissions": "limited",
                }

        except Exception as e:
            self.logger.error(f"Get search stats failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to get search stats")

    async def index_document_handler(
        self,
        doc_id: str,
        title: str,
        content: str,
        metadata: Dict[str, Any],
        current_user: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Handle document indexing request"""
        try:
            user_id = current_user["user_id"]

            # Check permissions
            auth_result = await self.security.check_permission(
                user_id, "search", "index"
            )

            if not auth_result.has_permission:
                raise HTTPException(status_code=403, detail="Permission denied")

            # Index document
            await self.search_engine.index_document(doc_id, title, content, metadata)

            return {
                "success": True,
                "document_id": doc_id,
                "indexed_at": datetime.utcnow().isoformat(),
                "backend": self.search_engine.backend_type,
            }

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Document indexing failed: {e}")
            raise HTTPException(status_code=500, detail="Document indexing failed")

    async def switch_backend_handler(
        self, backend_type: str, config: Dict[str, Any], current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle backend switch request"""
        try:
            user_id = current_user["user_id"]

            # Check permissions (admin only)
            auth_result = await self.security.check_permission(
                user_id, "system", "manage"
            )

            if not auth_result.has_permission:
                raise HTTPException(
                    status_code=403, detail="Permission denied - admin required"
                )

            # Switch backend
            old_backend = self.search_engine.backend_type
            await self.search_engine.switch_backend(backend_type, config)

            return {
                "success": True,
                "old_backend": old_backend,
                "new_backend": backend_type,
                "switched_at": datetime.utcnow().isoformat(),
            }

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Backend switch failed: {e}")
            raise HTTPException(status_code=500, detail="Backend switch failed")

    def _build_context(self, current_user: Dict[str, Any]) -> Dict[str, Any]:
        """Build request context"""
        return {
            "user_id": current_user["user_id"],
            "permissions": current_user.get("permissions", []),
            "ip_address": current_user.get("ip_address"),
            "user_agent": current_user.get("user_agent"),
        }

# Factory function
def create_search_endpoints(security_manager: SecurityManager) -> SearchEndpoints:
    """Create SearchEndpoints instance with security manager"""
    return SearchEndpoints(security_manager)
