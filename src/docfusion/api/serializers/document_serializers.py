#!/usr/bin/env python3
"""
Document Serializers

Pydantic models for document API request and response serialization
with comprehensive validation and type safety.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator
from ...core.utils import uuid7str

class OutputFormat(str, Enum):
    """Supported document output formats"""

    PDF = "pdf"
    DOCX = "docx"
    HTML = "html"

class DocumentCategory(str, Enum):
    """Document categories"""

    PROPOSAL = "proposal"
    CONTRACT = "contract"
    REPORT = "report"
    PRESENTATION = "presentation"
    LETTER = "letter"
    TEMPLATE = "template"
    GENERAL = "general"

class PermissionLevel(str, Enum):
    """Document permission levels"""

    OWNER = "owner"
    EDIT = "edit"
    COMMENT = "comment"
    VIEW = "view"

class SearchType(str, Enum):
    """Document search types"""

    FULL_TEXT = "full_text"
    SEMANTIC = "semantic"
    HYBRID = "hybrid"

# ==================== REQUEST MODELS ====================

class DocumentCreateRequest(BaseModel):
    """Request model for creating a document"""

    model_config = ConfigDict(
        extra="forbid", validate_by_name=True, validate_by_alias=True, validate_assignment=True, str_strip_whitespace=True
    )

    title: str = Field(..., min_length=1, max_length=255, description="Document title")

    content: str = Field(..., min_length=1, description="Document content")

    category: Optional[DocumentCategory] = Field(
        DocumentCategory.GENERAL, description="Document category"
    )

    tags: Optional[List[str]] = Field(
        None, description="Document tags for organization"
    )

    metadata: Optional[Dict[str, Any]] = Field(
        None, description="Additional document metadata"
    )

    encrypt_content: Optional[bool] = Field(
        None, description="Whether to encrypt document content"
    )

    sharing_permissions: Optional[Dict[str, str]] = Field(
        None, description="Initial sharing permissions (user_id: permission_level)"
    )

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v):
        if v is not None:
            if len(v) > 20:
                raise ValueError("Maximum 20 tags allowed")
            for tag in v:
                if not isinstance(tag, str) or len(tag.strip()) == 0:
                    raise ValueError("Tags must be non-empty strings")
                if len(tag) > 50:
                    raise ValueError("Tag length must be 50 characters or less")
        return v

    @field_validator("sharing_permissions")
    @classmethod
    def validate_sharing_permissions(cls, v):
        if v is not None:
            valid_permissions = {e.value for e in PermissionLevel}
            for user_id, permission in v.items():
                if not user_id.strip():
                    raise ValueError("User ID cannot be empty")
                if permission not in valid_permissions:
                    raise ValueError(f"Invalid permission level: {permission}")
        return v

class DocumentUpdateRequest(BaseModel):
    """Request model for updating a document"""

    model_config = ConfigDict(
        extra="forbid", validate_by_name=True, validate_by_alias=True, validate_assignment=True, str_strip_whitespace=True
    )

    title: Optional[str] = Field(
        None, min_length=1, max_length=255, description="Updated document title"
    )

    content: Optional[str] = Field(
        None, min_length=1, description="Updated document content"
    )

    metadata: Optional[Dict[str, Any]] = Field(
        None, description="Updated document metadata"
    )

    @model_validator(mode='after')
    def validate_at_least_one_field(self):
        if not any(v is not None for v in self.model_dump().values()):
            raise ValueError("At least one field must be provided for update")
        return self

class RenderRequest(BaseModel):
    """Request model for document rendering"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True, validate_assignment=True)

    output_format: OutputFormat = Field(
        OutputFormat.PDF, description="Output format for rendering"
    )

    template_id: Optional[str] = Field(
        None, description="Template ID to use for rendering"
    )

    classification: Optional[str] = Field(
        None, description="Document classification level"
    )

    metadata: Optional[Dict[str, Any]] = Field(
        None, description="Additional rendering metadata"
    )

    content_override: Optional[str] = Field(
        None,
        min_length=1,
        max_length=2_000_000,
        description=(
            "Live editor content to render instead of the stored document body. "
            "When present, takes precedence over the persisted content; title "
            "and metadata still come from storage. Capped at ~2MB to bound "
            "renderer work — typical proposal HTML is well under 200KB."
        ),
    )

# ==================== RESPONSE MODELS ====================

class DocumentResponse(BaseModel):
    """Response model for document data"""

    model_config = ConfigDict(
        extra="allow", validate_assignment=True, populate_by_name=True
    )

    document_id: str = Field(..., description="Unique document identifier")
    title: str = Field(..., description="Document title")
    content: str = Field(..., description="Document content")
    category: str = Field(..., description="Document category")
    tags: List[str] = Field(default_factory=list, description="Document tags")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Document metadata"
    )

    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    created_by: Optional[str] = Field(None, description="Creator user ID")

    encrypted: bool = Field(False, description="Whether content is encrypted")
    permission_level: str = Field(
        ..., description="User's permission level for this document"
    )

    # Optional fields for search results
    relevance_score: Optional[float] = Field(None, description="Search relevance score")
    match_type: Optional[str] = Field(None, description="Type of search match")

class DocumentListResponse(BaseModel):
    """Response model for document list with pagination"""

    model_config = ConfigDict(extra="allow")

    documents: List[DocumentResponse] = Field(..., description="List of documents")
    total: int = Field(..., description="Total number of documents")
    page: int = Field(..., description="Current page number")
    limit: int = Field(..., description="Items per page")
    total_pages: int = Field(..., description="Total number of pages")

    # Optional fields for search
    search_query: Optional[str] = Field(None, description="Search query used")
    search_type: Optional[str] = Field(None, description="Type of search performed")

class DocumentHistoryEntry(BaseModel):
    """Single entry in document history"""

    model_config = ConfigDict(extra="allow")

    version: str = Field(..., description="Version identifier")
    changed_at: str = Field(..., description="Change timestamp")
    changed_by: str = Field(..., description="User who made changes")
    changes: List[str] = Field(..., description="List of changes made")
    comment: Optional[str] = Field(None, description="Change comment")

class DocumentHistoryResponse(BaseModel):
    """Response model for document version history"""

    model_config = ConfigDict(extra="allow")

    document_id: str = Field(..., description="Document identifier")
    history: List[DocumentHistoryEntry] = Field(
        ..., description="Version history entries"
    )

# ==================== SEARCH MODELS ====================

class DocumentSearchRequest(BaseModel):
    """Request model for document search"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True, validate_assignment=True)

    query: str = Field(..., min_length=1, max_length=500, description="Search query")

    search_type: SearchType = Field(
        SearchType.HYBRID, description="Type of search to perform"
    )

    limit: int = Field(20, ge=1, le=100, description="Maximum number of results")

    category: Optional[DocumentCategory] = Field(
        None, description="Filter by document category"
    )

    tags: Optional[List[str]] = Field(None, description="Filter by tags")

    similarity_threshold: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Similarity threshold for semantic search"
    )

    date_from: Optional[datetime] = Field(
        None, description="Filter documents created after this date"
    )

    date_to: Optional[datetime] = Field(
        None, description="Filter documents created before this date"
    )

    @field_validator("tags")
    @classmethod
    def validate_search_tags(cls, v):
        if v is not None and len(v) > 10:
            raise ValueError("Maximum 10 tags allowed for search")
        return v

    @model_validator(mode='after')
    def validate_date_range(self):
        date_from = self.date_from
        date_to = self.date_to

        if date_from and date_to and date_from > date_to:
            raise ValueError("date_from must be before date_to")

        return self

class SearchResultHighlight(BaseModel):
    """Search result highlight"""

    model_config = ConfigDict(extra="allow")

    field: str = Field(..., description="Field containing the match")
    text: str = Field(..., description="Highlighted text snippet")
    start_pos: int = Field(..., description="Start position of match")
    end_pos: int = Field(..., description="End position of match")

class EnhancedSearchResult(BaseModel):
    """Enhanced search result with additional context"""

    model_config = ConfigDict(extra="allow")

    document_id: str = Field(..., description="Document identifier")
    title: str = Field(..., description="Document title")
    content_snippet: str = Field(..., description="Content snippet")
    relevance_score: float = Field(..., description="Relevance score")
    match_type: str = Field(..., description="Type of match")
    source: str = Field(..., description="Source of the result")

    # Enhanced fields
    similarity_score: Optional[float] = Field(
        None, description="Semantic similarity score"
    )
    chunk_id: Optional[str] = Field(
        None, description="Chunk identifier for RAG results"
    )
    chunk_index: Optional[int] = Field(None, description="Chunk index in document")
    semantic_context: Optional[str] = Field(None, description="Semantic context")

    # Metadata
    category: str = Field("", description="Document category")
    tags: List[str] = Field(default_factory=list, description="Document tags")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )
    highlights: List[SearchResultHighlight] = Field(
        default_factory=list, description="Search highlights"
    )

# ==================== VALIDATION MODELS ====================

class DocumentValidationResult(BaseModel):
    """Result of document validation"""

    model_config = ConfigDict(extra="allow")

    is_valid: bool = Field(..., description="Whether document is valid")
    errors: List[str] = Field(default_factory=list, description="Validation errors")
    warnings: List[str] = Field(default_factory=list, description="Validation warnings")
    suggestions: List[str] = Field(
        default_factory=list, description="Improvement suggestions"
    )

class BulkOperationRequest(BaseModel):
    """Request for bulk operations on documents"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    document_ids: List[str] = Field(
        ...,
        min_items=1,
        max_items=100,
        description="List of document IDs to operate on",
    )

    operation: str = Field(
        ...,
        description="Operation to perform (delete, update_tags, change_category, etc.)",
    )

    parameters: Optional[Dict[str, Any]] = Field(
        None, description="Operation-specific parameters"
    )

class BulkOperationResult(BaseModel):
    """Result of bulk operation"""

    model_config = ConfigDict(extra="allow")

    total_requested: int = Field(
        ..., description="Total documents requested for operation"
    )
    successful: int = Field(..., description="Number of successful operations")
    failed: int = Field(..., description="Number of failed operations")
    errors: List[Dict[str, str]] = Field(
        default_factory=list, description="Errors for failed operations"
    )
    processed_ids: List[str] = Field(
        default_factory=list, description="Successfully processed document IDs"
    )

# ==================== ANALYTICS MODELS ====================

class DocumentAnalytics(BaseModel):
    """Document analytics data"""

    model_config = ConfigDict(extra="allow")

    total_documents: int = Field(..., description="Total number of documents")
    documents_this_month: int = Field(..., description="Documents created this month")
    documents_this_week: int = Field(..., description="Documents created this week")

    category_distribution: Dict[str, int] = Field(
        default_factory=dict, description="Distribution of documents by category"
    )

    top_tags: List[Dict[str, Union[str, int]]] = Field(
        default_factory=list, description="Most frequently used tags"
    )

    activity_timeline: List[Dict[str, Union[str, int]]] = Field(
        default_factory=list, description="Document creation activity over time"
    )

    user_activity: Optional[Dict[str, Any]] = Field(
        None, description="User-specific activity metrics"
    )

# ==================== ERROR MODELS ====================

class APIError(BaseModel):
    """Standard API error response"""

    model_config = ConfigDict(extra="allow")

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(
        None, description="Additional error details"
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow, description="Error timestamp"
    )
    request_id: Optional[str] = Field(
        None, description="Request identifier for tracking"
    )

class ValidationError(APIError):
    """Validation error response"""

    field_errors: List[Dict[str, str]] = Field(
        default_factory=list, description="Field-specific validation errors"
    )

# ==================== UTILITY FUNCTIONS ====================

def create_document_response(
    document_id: str, title: str, content: str, category: str = "general", **kwargs
) -> DocumentResponse:
    """Helper function to create document response"""
    return DocumentResponse(
        document_id=document_id,
        title=title,
        content=content,
        category=category,
        permission_level=kwargs.get("permission_level", "view"),
        **kwargs,
    )

def create_paginated_response(
    documents: List[DocumentResponse], total: int, page: int, limit: int, **kwargs
) -> DocumentListResponse:
    """Helper function to create paginated response"""
    return DocumentListResponse(
        documents=documents,
        total=total,
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit,
        **kwargs,
    )
