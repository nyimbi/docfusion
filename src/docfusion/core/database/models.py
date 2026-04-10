"""
Base Database Models

SQLAlchemy ORM base classes and common model patterns for all DocuFusion components.
Provides base entities with timestamps, UUIDs, and common fields.
"""

from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.hybrid import hybrid_property
from ...core.utils import uuid7str

# Try to import uuid7str, fallback to uuid4
# Base class for all ORM models
Base = declarative_base()

class BaseModel(Base):
    """
    Abstract base model for all DocuFusion database entities.

    Provides common fields and functionality:
    - UUID primary key
    - Created/updated timestamps with automatic management
    - Soft delete capability
    - Metadata JSON field
    - Common query methods
    """

    __abstract__ = True

    # Primary key using UUID7 for better database performance
    id = Column(
        UUID(as_uuid=False),
        primary_key=True,
        default=uuid7str,
        comment="Unique identifier using UUID7",
    )

    # Timestamp fields with automatic management
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        comment="Record creation timestamp",
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        onupdate=func.now(),
        comment="Record last update timestamp",
    )

    # Soft delete support
    deleted_at = Column(
        DateTime(timezone=True), nullable=True, comment="Soft delete timestamp"
    )

    is_active = Column(
        Boolean, nullable=False, default=True, comment="Active status flag"
    )

    # Flexible metadata storage
    metadata_ = Column(
        JSONB, nullable=False, default=dict, comment="Additional metadata as JSON"
    )

    # Version tracking for optimistic locking
    version = Column(
        Integer,
        nullable=False,
        default=1,
        comment="Version number for optimistic locking",
    )

    @hybrid_property
    def is_deleted(self) -> bool:
        """Check if record is soft deleted."""
        return self.deleted_at is not None

    def update_timestamp(self) -> None:
        """Manually update the timestamp."""
        self.updated_at = datetime.utcnow()

    def soft_delete(self) -> None:
        """Perform soft delete on the record."""
        self.deleted_at = datetime.utcnow()
        self.is_active = False

    def restore(self) -> None:
        """Restore a soft-deleted record."""
        self.deleted_at = None
        self.is_active = True

    def increment_version(self) -> None:
        """Increment version for optimistic locking."""
        self.version += 1

    def to_dict(self, include_metadata: bool = True) -> Dict[str, Any]:
        """Convert model to dictionary representation."""
        result = {
            "id": self.id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None,
            "is_active": self.is_active,
            "version": self.version,
        }

        if include_metadata and self.metadata_:
            result["metadata"] = self.metadata_

        return result

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(id={self.id})>"

class AuditableMixin:
    """
    Mixin for models that need audit trail functionality.

    Adds fields to track who created/modified records.
    """

    created_by = Column(
        UUID(as_uuid=False), nullable=True, comment="ID of user who created the record"
    )

    updated_by = Column(
        UUID(as_uuid=False),
        nullable=True,
        comment="ID of user who last updated the record",
    )

    def set_created_by(self, user_id: str) -> None:
        """Set the creator of the record."""
        self.created_by = user_id

    def set_updated_by(self, user_id: str) -> None:
        """Set the updater of the record."""
        self.updated_by = user_id

class NamedEntityMixin:
    """
    Mixin for entities that have name and description fields.
    """

    name = Column(String(255), nullable=False, comment="Entity name")

    description = Column(Text, nullable=True, comment="Entity description")

    slug = Column(String(255), nullable=True, unique=True, comment="URL-friendly slug")

    def generate_slug(self) -> None:
        """Generate URL-friendly slug from name."""
        import re

        if self.name:
            slug = re.sub(r"[^\w\s-]", "", self.name.lower())
            slug = re.sub(r"[-\s]+", "-", slug)
            self.slug = slug.strip("-")

class TaggableMixin:
    """
    Mixin for entities that support tagging.
    """

    tags = Column(JSONB, nullable=False, default=list, comment="Tags as JSON array")

    def add_tag(self, tag: str) -> None:
        """Add a tag to the entity."""
        if not self.tags:
            self.tags = []
        if tag not in self.tags:
            self.tags.append(tag)

    def remove_tag(self, tag: str) -> None:
        """Remove a tag from the entity."""
        if self.tags and tag in self.tags:
            self.tags.remove(tag)

    def has_tag(self, tag: str) -> bool:
        """Check if entity has a specific tag."""
        return self.tags and tag in self.tags

class TimestampMixin:
    """
    Lightweight timestamp mixin for models that don't need full BaseModel.
    """

    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())

    updated_at = Column(
        DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now()
    )

# Common base classes for specific use cases

class UserEntity(BaseModel, AuditableMixin):
    """Base class for user-related entities."""

    __abstract__ = True

class NamedEntity(BaseModel, NamedEntityMixin, TaggableMixin):
    """Base class for named entities with tags."""

    __abstract__ = True

class DocumentEntity(BaseModel, AuditableMixin, TaggableMixin):
    """Base class for document-related entities."""

    __abstract__ = True

    title = Column(String(500), nullable=False, comment="Document title")

    content = Column(Text, nullable=True, comment="Document content")

    content_type = Column(
        String(100),
        nullable=False,
        default="text/plain",
        comment="MIME type of content",
    )

    file_size = Column(Integer, nullable=True, comment="File size in bytes")

    checksum = Column(String(64), nullable=True, comment="Content checksum (SHA-256)")

class WorkflowEntity(BaseModel, AuditableMixin, NamedEntityMixin):
    """Base class for workflow-related entities."""

    __abstract__ = True

    status = Column(
        String(50), nullable=False, default="draft", comment="Current workflow status"
    )

    priority = Column(
        String(20), nullable=False, default="medium", comment="Workflow priority level"
    )

    started_at = Column(
        DateTime(timezone=True), nullable=True, comment="Workflow start timestamp"
    )

    completed_at = Column(
        DateTime(timezone=True), nullable=True, comment="Workflow completion timestamp"
    )

    def start_workflow(self) -> None:
        """Mark workflow as started."""
        self.started_at = datetime.utcnow()
        self.status = "running"

    def complete_workflow(self) -> None:
        """Mark workflow as completed."""
        self.completed_at = datetime.utcnow()
        self.status = "completed"

    def fail_workflow(self) -> None:
        """Mark workflow as failed."""
        self.status = "failed"

# Database utility functions

def create_all_tables(engine):
    """Create all tables defined by Base metadata."""
    Base.metadata.create_all(bind=engine)

def drop_all_tables(engine):
    """Drop all tables defined by Base metadata."""
    Base.metadata.drop_all(bind=engine)

def get_table_names():
    """Get list of all table names defined in Base metadata."""
    return list(Base.metadata.tables.keys())

# Example component-specific models (these would typically be in separate files)

class User(UserEntity):
    """User account model."""

    __tablename__ = "users"

    username = Column(String(100), nullable=False, unique=True)
    email = Column(String(255), nullable=False, unique=True)
    full_name = Column(String(255), nullable=True)
    is_superuser = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)

    # Password hash (should be handled by authentication system)
    password_hash = Column(String(255), nullable=True)

    # Profile information
    profile_data = Column(JSONB, default=dict)

class Organization(NamedEntity):
    """Organization/tenant model."""

    __tablename__ = "organizations"

    # Organization details
    organization_type = Column(String(50), default="enterprise")
    industry = Column(String(100), nullable=True)
    size = Column(String(20), nullable=True)  # small, medium, large, enterprise

    # Contact information
    website = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(JSONB, nullable=True)

    # Settings
    settings = Column(JSONB, default=dict)

    # Status
    subscription_status = Column(String(50), default="active")
    subscription_tier = Column(String(50), default="basic")

class Document(DocumentEntity):
    """Generic document model."""

    __tablename__ = "documents"

    # Document classification
    document_type = Column(String(100), nullable=False, default="general")
    category = Column(String(100), nullable=True)

    # File information
    original_filename = Column(String(500), nullable=True)
    file_path = Column(String(1000), nullable=True)

    # Processing status
    processing_status = Column(String(50), default="pending")
    processing_error = Column(Text, nullable=True)

    # Relationships (these would be defined with proper foreign keys)
    organization_id = Column(UUID(as_uuid=False), nullable=True)
    parent_document_id = Column(UUID(as_uuid=False), nullable=True)

class WorkflowTemplate(WorkflowEntity):
    """Workflow template model."""

    __tablename__ = "workflow_templates"

    # Template configuration
    template_type = Column(String(100), nullable=False)
    template_version = Column(String(20), default="1.0")

    # Workflow definition
    workflow_definition = Column(JSONB, nullable=False)
    input_schema = Column(JSONB, nullable=True)
    output_schema = Column(JSONB, nullable=True)

    # Usage tracking
    usage_count = Column(Integer, default=0)
    success_rate = Column(Integer, default=0)  # Percentage

class WorkflowInstance(WorkflowEntity):
    """Workflow instance model."""

    __tablename__ = "workflow_instances"

    # Template reference
    template_id = Column(UUID(as_uuid=False), nullable=True)

    # Instance data
    input_data = Column(JSONB, nullable=True)
    output_data = Column(JSONB, nullable=True)
    execution_context = Column(JSONB, nullable=True)

    # Progress tracking
    current_step = Column(String(100), nullable=True)
    total_steps = Column(Integer, nullable=True)
    completed_steps = Column(Integer, default=0)

    # Error information
    error_message = Column(Text, nullable=True)
    error_details = Column(JSONB, nullable=True)

# Export commonly used models and utilities
__all__ = [
    "Base",
    "BaseModel",
    "AuditableMixin",
    "NamedEntityMixin",
    "TaggableMixin",
    "TimestampMixin",
    "UserEntity",
    "NamedEntity",
    "DocumentEntity",
    "WorkflowEntity",
    "User",
    "Organization",
    "Document",
    "WorkflowTemplate",
    "WorkflowInstance",
    "create_all_tables",
    "drop_all_tables",
    "get_table_names",
]
