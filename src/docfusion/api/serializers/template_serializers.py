#!/usr/bin/env python3
"""
Template Serializers

Pydantic models for template API request and response serialization
with comprehensive validation and type safety.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator
from ...core.utils import uuid7str

class TemplateCategory(str, Enum):
    """Template categories"""

    PROPOSAL = "proposal"
    CONTRACT = "contract"
    REPORT = "report"
    PRESENTATION = "presentation"
    LETTER = "letter"
    INVOICE = "invoice"
    MARKETING = "marketing"
    LEGAL = "legal"
    TECHNICAL = "technical"
    GENERAL = "general"

class TemplateAccessLevel(str, Enum):
    """Template access levels"""

    PUBLIC = "public"
    USER = "user"
    ADMIN = "admin"
    SYSTEM = "system"

class FieldType(str, Enum):
    """Template field types"""

    TEXT = "text"
    TEXTAREA = "textarea"
    NUMBER = "number"
    DATE = "date"
    BOOLEAN = "boolean"
    SELECT = "select"
    MULTISELECT = "multiselect"
    FILE = "file"
    IMAGE = "image"

class OutputFormat(str, Enum):
    """Supported output formats"""

    PDF = "pdf"
    DOCX = "docx"
    HTML = "html"
    PPTX = "pptx"

# ==================== FIELD MODELS ====================

class TemplateFieldOption(BaseModel):
    """Template field option for select fields"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    value: str = Field(..., description="Option value")
    label: str = Field(..., description="Option display label")
    default: bool = Field(False, description="Whether this is the default option")

class TemplateField(BaseModel):
    """Template field definition"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True, validate_assignment=True)

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern=r"^[a-zA-Z_][a-zA-Z0-9_]*$",
        description="Field name (must be valid identifier)",
    )

    label: str = Field(
        ..., min_length=1, max_length=200, description="Field display label"
    )

    type: FieldType = Field(FieldType.TEXT, description="Field type")

    required: bool = Field(False, description="Whether field is required")
    default_value: Optional[Any] = Field(None, description="Default field value")
    placeholder: Optional[str] = Field(None, description="Field placeholder text")
    help_text: Optional[str] = Field(None, description="Help text for field")

    # Validation rules
    min_length: Optional[int] = Field(None, ge=0, description="Minimum text length")
    max_length: Optional[int] = Field(None, ge=1, description="Maximum text length")
    min_value: Optional[float] = Field(None, description="Minimum numeric value")
    max_value: Optional[float] = Field(None, description="Maximum numeric value")
    pattern: Optional[str] = Field(None, description="Regex pattern for validation")

    # Select field options
    options: Optional[List[TemplateFieldOption]] = Field(
        None, description="Options for select fields"
    )

    @field_validator("options")
    @classmethod
    def validate_options(cls, v, values):
        field_type = values.get("type")
        if field_type in [FieldType.SELECT, FieldType.MULTISELECT]:
            if not v or len(v) == 0:
                raise ValueError("Select fields must have at least one option")
        elif v is not None:
            raise ValueError("Options only allowed for select fields")
        return v

    @model_validator(mode='after')
    def validate_field_constraints(self):
        min_len = self.min_length
        max_len = self.max_length
        min_val = self.min_value
        max_val = self.max_value

        if min_len is not None and max_len is not None and min_len > max_len:
            raise ValueError("min_length cannot be greater than max_length")

        if min_val is not None and max_val is not None and min_val > max_val:
            raise ValueError("min_value cannot be greater than max_value")

        return self

# ==================== REQUEST MODELS ====================

class TemplateCreateRequest(BaseModel):
    """Request model for creating a template"""

    model_config = ConfigDict(
        extra="forbid", validate_by_name=True, validate_by_alias=True, validate_assignment=True, str_strip_whitespace=True
    )

    name: str = Field(..., min_length=1, max_length=255, description="Template name")

    description: Optional[str] = Field(
        None, max_length=1000, description="Template description"
    )

    category: TemplateCategory = Field(
        TemplateCategory.GENERAL, description="Template category"
    )

    content: str = Field(
        ..., min_length=1, description="Template content with placeholders"
    )

    fields: Optional[List[TemplateField]] = Field(
        None, description="Template field definitions"
    )

    tags: Optional[List[str]] = Field(None, description="Template tags")

    access_level: TemplateAccessLevel = Field(
        TemplateAccessLevel.USER, description="Template access level"
    )

    output_formats: Optional[List[OutputFormat]] = Field(
        [OutputFormat.PDF, OutputFormat.DOCX, OutputFormat.HTML],
        description="Supported output formats",
    )

    is_active: bool = Field(True, description="Whether template is active")

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

    @field_validator("fields")
    @classmethod
    def validate_fields(cls, v):
        if v is not None:
            if len(v) > 50:
                raise ValueError("Maximum 50 fields allowed")

            # Check for duplicate field names
            field_names = [field.name for field in v]
            if len(field_names) != len(set(field_names)):
                raise ValueError("Field names must be unique")

        return v

    @field_validator("content")
    @classmethod
    def validate_content_placeholders(cls, v, values):
        """Validate that content placeholders match defined fields"""
        import re

        # Extract placeholders from content
        placeholders = set(re.findall(r"\{(\w+)\}", v))

        # Get defined field names
        fields = values.get("fields", [])
        field_names = {field.name for field in fields} if fields else set()

        # Check for placeholders without corresponding fields
        undefined_placeholders = placeholders - field_names
        if undefined_placeholders:
            raise ValueError(
                f"Undefined placeholders in content: {', '.join(undefined_placeholders)}"
            )

        return v

class TemplateUpdateRequest(BaseModel):
    """Request model for updating a template"""

    model_config = ConfigDict(
        extra="forbid", validate_by_name=True, validate_by_alias=True, validate_assignment=True, str_strip_whitespace=True
    )

    name: Optional[str] = Field(
        None, min_length=1, max_length=255, description="Updated template name"
    )

    description: Optional[str] = Field(
        None, max_length=1000, description="Updated template description"
    )

    category: Optional[TemplateCategory] = Field(
        None, description="Updated template category"
    )

    content: Optional[str] = Field(
        None, min_length=1, description="Updated template content"
    )

    fields: Optional[List[TemplateField]] = Field(
        None, description="Updated template fields"
    )

    tags: Optional[List[str]] = Field(None, description="Updated template tags")

    access_level: Optional[TemplateAccessLevel] = Field(
        None, description="Updated template access level"
    )

    output_formats: Optional[List[OutputFormat]] = Field(
        None, description="Updated supported output formats"
    )

    is_active: Optional[bool] = Field(
        None, description="Updated template active status"
    )

    @model_validator(mode='after')
    def validate_at_least_one_field(self):
        if not any(v is not None for v in self.model_dump().values()):
            raise ValueError("At least one field must be provided for update")
        return self

class TemplatePreviewRequest(BaseModel):
    """Request model for template preview"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    sample_data: Optional[Dict[str, Any]] = Field(
        None, description="Sample data to populate template fields"
    )

    output_format: OutputFormat = Field(
        OutputFormat.HTML, description="Output format for preview"
    )

class TemplateSearchRequest(BaseModel):
    """Request model for template search"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True, validate_assignment=True)

    query: Optional[str] = Field(None, max_length=500, description="Search query")

    category: Optional[TemplateCategory] = Field(None, description="Filter by category")

    access_level: Optional[TemplateAccessLevel] = Field(
        None, description="Filter by access level"
    )

    tags: Optional[List[str]] = Field(None, description="Filter by tags")

    is_active: Optional[bool] = Field(None, description="Filter by active status")

    limit: int = Field(20, ge=1, le=100, description="Maximum number of results")

    @field_validator("tags")
    @classmethod
    def validate_search_tags(cls, v):
        if v is not None and len(v) > 10:
            raise ValueError("Maximum 10 tags allowed for search")
        return v

# ==================== RESPONSE MODELS ====================

class TemplateResponse(BaseModel):
    """Response model for template data"""

    model_config = ConfigDict(
        extra="allow", validate_assignment=True, populate_by_name=True
    )

    template_id: str = Field(..., description="Unique template identifier")
    name: str = Field(..., description="Template name")
    description: Optional[str] = Field(None, description="Template description")
    category: str = Field(..., description="Template category")
    content: str = Field(..., description="Template content")

    fields: List[TemplateField] = Field(
        default_factory=list, description="Template field definitions"
    )

    tags: List[str] = Field(default_factory=list, description="Template tags")
    access_level: str = Field(..., description="Template access level")

    output_formats: List[str] = Field(
        default_factory=list, description="Supported output formats"
    )

    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    created_by: Optional[str] = Field(None, description="Creator user ID")

    version: str = Field("1.0", description="Template version")
    is_active: bool = Field(True, description="Whether template is active")

    usage_count: Optional[int] = Field(
        None, description="Number of times template was used"
    )

class TemplateListResponse(BaseModel):
    """Response model for template list with pagination"""

    model_config = ConfigDict(extra="allow")

    templates: List[TemplateResponse] = Field(..., description="List of templates")
    total: int = Field(..., description="Total number of templates")
    page: int = Field(..., description="Current page number")
    limit: int = Field(..., description="Items per page")
    total_pages: int = Field(..., description="Total number of pages")

    # Additional metadata
    categories: Optional[List[str]] = Field(None, description="Available categories")
    access_levels: Optional[List[str]] = Field(
        None, description="Available access levels"
    )
    search_query: Optional[str] = Field(None, description="Search query used")

class TemplateValidationResult(BaseModel):
    """Template validation result"""

    model_config = ConfigDict(extra="allow")

    is_valid: bool = Field(..., description="Whether template is valid")
    errors: List[str] = Field(default_factory=list, description="Validation errors")
    warnings: List[str] = Field(default_factory=list, description="Validation warnings")
    suggestions: List[str] = Field(
        default_factory=list, description="Improvement suggestions"
    )

    field_validation: Optional[Dict[str, List[str]]] = Field(
        None, description="Field-specific validation results"
    )

    placeholder_analysis: Optional[Dict[str, Any]] = Field(
        None, description="Analysis of template placeholders"
    )

class TemplateUsageAnalytics(BaseModel):
    """Template usage analytics"""

    model_config = ConfigDict(extra="allow")

    template_id: str = Field(..., description="Template identifier")
    total_usage: int = Field(..., description="Total number of uses")
    usage_this_month: int = Field(..., description="Usage this month")
    usage_this_week: int = Field(..., description="Usage this week")

    top_users: List[Dict[str, Union[str, int]]] = Field(
        default_factory=list, description="Top users of this template"
    )

    usage_timeline: List[Dict[str, Union[str, int]]] = Field(
        default_factory=list, description="Usage over time"
    )

    popular_field_values: Dict[str, List[str]] = Field(
        default_factory=dict, description="Most common values for each field"
    )

# ==================== BULK OPERATIONS ====================

class BulkTemplateOperationRequest(BaseModel):
    """Request for bulk operations on templates"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    template_ids: List[str] = Field(
        ..., min_items=1, max_items=50, description="List of template IDs to operate on"
    )

    operation: str = Field(
        ...,
        description="Operation to perform (activate, deactivate, delete, update_category, etc.)",
    )

    parameters: Optional[Dict[str, Any]] = Field(
        None, description="Operation-specific parameters"
    )

class BulkTemplateOperationResult(BaseModel):
    """Result of bulk template operation"""

    model_config = ConfigDict(extra="allow")

    total_requested: int = Field(
        ..., description="Total templates requested for operation"
    )
    successful: int = Field(..., description="Number of successful operations")
    failed: int = Field(..., description="Number of failed operations")

    errors: List[Dict[str, str]] = Field(
        default_factory=list, description="Errors for failed operations"
    )

    processed_ids: List[str] = Field(
        default_factory=list, description="Successfully processed template IDs"
    )

# ==================== IMPORT/EXPORT MODELS ====================

class TemplateImportRequest(BaseModel):
    """Request model for template import"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    templates: List[TemplateCreateRequest] = Field(
        ..., min_items=1, max_items=20, description="Templates to import"
    )

    overwrite_existing: bool = Field(
        False, description="Whether to overwrite existing templates with same name"
    )

    default_access_level: TemplateAccessLevel = Field(
        TemplateAccessLevel.USER,
        description="Default access level for imported templates",
    )

class TemplateImportResult(BaseModel):
    """Result of template import operation"""

    model_config = ConfigDict(extra="allow")

    total_requested: int = Field(
        ..., description="Total templates requested for import"
    )
    imported: int = Field(..., description="Number of successfully imported templates")
    skipped: int = Field(..., description="Number of skipped templates")
    failed: int = Field(..., description="Number of failed imports")

    imported_template_ids: List[str] = Field(
        default_factory=list, description="IDs of successfully imported templates"
    )

    errors: List[Dict[str, str]] = Field(
        default_factory=list, description="Import errors"
    )

    warnings: List[str] = Field(default_factory=list, description="Import warnings")

class TemplateExportFormat(str, Enum):
    """Template export formats"""

    JSON = "json"
    YAML = "yaml"
    CSV = "csv"

class TemplateExportRequest(BaseModel):
    """Request model for template export"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    template_ids: Optional[List[str]] = Field(
        None,
        description="Specific template IDs to export (if None, export all accessible)",
    )

    format: TemplateExportFormat = Field(
        TemplateExportFormat.JSON, description="Export format"
    )

    include_content: bool = Field(
        True, description="Whether to include template content in export"
    )

    include_usage_stats: bool = Field(
        False, description="Whether to include usage statistics"
    )

# ==================== UTILITY FUNCTIONS ====================

def create_template_response(
    template_id: str, name: str, category: str, content: str, **kwargs
) -> TemplateResponse:
    """Helper function to create template response"""
    return TemplateResponse(
        template_id=template_id,
        name=name,
        category=category,
        content=content,
        access_level=kwargs.get("access_level", "user"),
        **kwargs,
    )

def create_template_field(
    name: str,
    label: str,
    field_type: FieldType = FieldType.TEXT,
    required: bool = False,
    **kwargs,
) -> TemplateField:
    """Helper function to create template field"""
    return TemplateField(
        name=name, label=label, type=field_type, required=required, **kwargs
    )

def create_paginated_template_response(
    templates: List[TemplateResponse], total: int, page: int, limit: int, **kwargs
) -> TemplateListResponse:
    """Helper function to create paginated template response"""
    return TemplateListResponse(
        templates=templates,
        total=total,
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit,
        **kwargs,
    )
