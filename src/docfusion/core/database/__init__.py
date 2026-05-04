"""
DocuFusion Database Core Module

Centralized database configuration and connection management for PostgreSQL.
Provides SQLAlchemy ORM integration and connection pooling.

Usage:
    from docfusion.core.database import get_database_session
    
    session_manager = await get_database_session()
    async with session_manager.async_session() as session:
        # Database operations
        pass
"""

import os

from .config import (
    DatabaseConfig, 
    get_database_config,
    create_development_config,
    create_production_config,
    create_testing_config
)
from .connection import (
    DatabaseConnection, 
    get_database_connection
)
from .session import (
    DatabaseSession, 
    get_database_session,
    get_async_db_session,
    get_sync_db_session,
    with_db_session,
    with_async_db_session
)
from .models import (
    Base,
    BaseModel,
    AuditableMixin,
    NamedEntityMixin,
    TaggableMixin,
    TimestampMixin,
    UserEntity,
    NamedEntity, 
    DocumentEntity,
    WorkflowEntity,
    User,
    Organization,
    Document,
    WorkflowTemplate,
    WorkflowInstance,
    create_all_tables,
    drop_all_tables
)

__version__ = "1.0.0"

__all__ = [
    # Configuration
    'DatabaseConfig',
    'get_database_config',
    'create_development_config',
    'create_production_config', 
    'create_testing_config',
    
    # Connection Management
    'DatabaseConnection',
    'get_database_connection',
    
    # Session Management
    'DatabaseSession',
    'get_database_session',
    'get_async_db_session',
    'get_sync_db_session',
    'with_db_session',
    'with_async_db_session',
    
    # ORM Models
    'Base',
    'BaseModel',
    'AuditableMixin',
    'NamedEntityMixin',
    'TaggableMixin', 
    'TimestampMixin',
    'UserEntity',
    'NamedEntity',
    'DocumentEntity',
    'WorkflowEntity',
    
    # Concrete Models
    'User',
    'Organization',
    'Document',
    'WorkflowTemplate', 
    'WorkflowInstance',
    
    # Utilities
    'create_all_tables',
    'drop_all_tables'
]

# PostgreSQL Connection Details
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres@localhost:5432/docfusion")
DATABASE_HOST = os.getenv("DATABASE_HOST", "localhost")
DATABASE_PORT = 5432
DATABASE_NAME = os.getenv("DATABASE_NAME", "docfusion")
DATABASE_USER = os.getenv("DATABASE_USER", "postgres")
