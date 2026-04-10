"""
Database Configuration Management

Centralized configuration for PostgreSQL database connections across all
DocuFusion components with support for different environments and connection pooling.
"""

import os
from typing import Optional, Dict, Any
from dataclasses import dataclass, field
from pydantic import BaseModel, Field, ConfigDict, validator
from urllib.parse import urlparse
import logging


@dataclass
class PostgreSQLConnectionInfo:
	"""Parsed PostgreSQL connection information."""
	host: str
	port: int
	database: str
	username: str
	password: str
	schema: str = "public"
	
	@classmethod
	def from_url(cls, url: str, schema: str = "public") -> "PostgreSQLConnectionInfo":
		"""Parse PostgreSQL URL into connection components."""
		parsed = urlparse(url)
		
		if parsed.scheme not in ("postgresql", "postgres"):
			raise ValueError(f"Invalid PostgreSQL URL scheme: {parsed.scheme}")
		
		return cls(
			host=parsed.hostname or "localhost",
			port=parsed.port or 5432,
			database=parsed.path.lstrip("/") or "postgres",
			username=parsed.username or "postgres",
			password=parsed.password or "",
			schema=schema
		)
	
	def to_url(self, async_driver: bool = False) -> str:
		"""Convert back to PostgreSQL URL."""
		scheme = "postgresql+asyncpg" if async_driver else "postgresql+psycopg2"
		password_part = f":{self.password}" if self.password else ""
		return f"{scheme}://{self.username}{password_part}@{self.host}:{self.port}/{self.database}"


class DatabaseConfig(BaseModel):
	"""
	Comprehensive database configuration for DocuFusion PostgreSQL integration.
	
	Supports both async and sync connections with configurable pooling,
	schema management, and environment-specific settings.
	"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	# Connection settings
	connection_url: str = Field(
		default="postgresql://azureuser:Abcd1234.@db.lindela.io:5432/docfusion",
		description="PostgreSQL connection URL"
	)
	
	# Pool configuration
	pool_size: int = Field(default=10, ge=1, le=100, description="Connection pool size")
	max_overflow: int = Field(default=20, ge=0, le=100, description="Maximum pool overflow")
	pool_timeout: int = Field(default=30, ge=1, description="Pool timeout in seconds")
	pool_recycle: int = Field(default=3600, ge=60, description="Pool recycle time in seconds")
	
	# Async pool settings
	async_pool_size: int = Field(default=10, ge=1, le=100, description="Async connection pool size")
	async_max_pool_size: int = Field(default=20, ge=1, le=100, description="Maximum async pool size")
	async_command_timeout: float = Field(default=60.0, gt=0, description="Async command timeout")
	
	# Schema and database settings
	default_schema: str = Field(default="public", description="Default database schema")
	application_schemas: Dict[str, str] = Field(
		default_factory=lambda: {
			"rag": "rag",
			"notifications": "notifications", 
			"workflow": "workflow",
			"documents": "documents",
			"users": "users",
			"analytics": "analytics"
		},
		description="Application-specific schema mappings"
	)
	
	# Connection options
	echo_sql: bool = Field(default=False, description="Enable SQL query logging")
	autocommit: bool = Field(default=False, description="Enable autocommit mode")
	autoflush: bool = Field(default=True, description="Enable automatic session flushing")
	
	# Migration settings
	migration_directory: str = Field(default="migrations", description="Alembic migration directory")
	migration_table: str = Field(default="alembic_version", description="Migration version table name")
	
	# Performance settings
	statement_timeout: Optional[int] = Field(default=300, description="Statement timeout in seconds")
	idle_in_transaction_session_timeout: Optional[int] = Field(
		default=600, description="Idle transaction timeout"
	)
	
	# Environment settings
	environment: str = Field(default="development", description="Environment name")
	debug: bool = Field(default=False, description="Debug mode")
	
	# Extension settings
	enable_pgvector: bool = Field(default=True, description="Enable pgvector extension")
	enable_pgai: bool = Field(default=True, description="Enable pgai extension")
	enable_timescaledb: bool = Field(default=False, description="Enable TimescaleDB extension")
	
	@validator('connection_url')
	def validate_connection_url(cls, v):
		"""Validate PostgreSQL connection URL format."""
		try:
			parsed = urlparse(v)
			if parsed.scheme not in ("postgresql", "postgres"):
				raise ValueError("URL must use postgresql:// or postgres:// scheme")
			return v
		except Exception as e:
			raise ValueError(f"Invalid PostgreSQL URL: {e}")
	
	@property
	def connection_info(self) -> PostgreSQLConnectionInfo:
		"""Get parsed connection information."""
		return PostgreSQLConnectionInfo.from_url(self.connection_url, self.default_schema)
	
	@property 
	def sqlalchemy_url(self) -> str:
		"""Get SQLAlchemy-compatible connection URL (sync)."""
		return self.connection_info.to_url(async_driver=False)
	
	@property
	def async_sqlalchemy_url(self) -> str:
		"""Get async SQLAlchemy-compatible connection URL."""
		return self.connection_info.to_url(async_driver=True)
	
	@property
	def asyncpg_url(self) -> str:
		"""Get asyncpg-compatible connection URL."""
		return self.connection_url
	
	def get_schema_url(self, schema_name: str, async_driver: bool = False) -> str:
		"""Get connection URL for specific schema."""
		info = self.connection_info
		info.schema = schema_name
		return info.to_url(async_driver=async_driver)
	
	def get_database_options(self) -> Dict[str, Any]:
		"""Get SQLAlchemy engine options."""
		options = {
			'pool_size': self.pool_size,
			'max_overflow': self.max_overflow,
			'pool_timeout': self.pool_timeout,
			'pool_recycle': self.pool_recycle,
			'echo': self.echo_sql,
		}
		
		# Add connection arguments
		connect_args = {}
		if self.statement_timeout:
			connect_args['options'] = f'-c statement_timeout={self.statement_timeout}s'
		if self.idle_in_transaction_session_timeout:
			connect_args['options'] = (
				connect_args.get('options', '') + 
				f' -c idle_in_transaction_session_timeout={self.idle_in_transaction_session_timeout}s'
			)
		
		if connect_args:
			options['connect_args'] = connect_args
		
		return options
	
	def get_async_database_options(self) -> Dict[str, Any]:
		"""Get async SQLAlchemy engine options."""
		return {
			'pool_size': self.async_pool_size,
			'max_overflow': self.async_max_pool_size - self.async_pool_size,
			'pool_timeout': self.pool_timeout,
			'pool_recycle': self.pool_recycle,
			'echo': self.echo_sql,
		}
	
	def get_asyncpg_pool_options(self) -> Dict[str, Any]:
		"""Get asyncpg connection pool options."""
		return {
			'min_size': self.async_pool_size,
			'max_size': self.async_max_pool_size,
			'command_timeout': self.async_command_timeout,
		}


# Global configuration instance
_database_config: Optional[DatabaseConfig] = None


def get_database_config() -> DatabaseConfig:
	"""
	Get the global database configuration instance.
	
	Loads configuration from environment variables if not already initialized.
	"""
	global _database_config
	
	if _database_config is None:
		# Load from environment variables
		config_data = {}
		
		# Check for connection URL in environment
		if db_url := os.getenv("DATABASE_URL"):
			config_data["connection_url"] = db_url
		elif db_url := os.getenv("POSTGRES_URL"):
			config_data["connection_url"] = db_url
		
		# Pool settings from environment
		if pool_size := os.getenv("DB_POOL_SIZE"):
			config_data["pool_size"] = int(pool_size)
		
		if pool_timeout := os.getenv("DB_POOL_TIMEOUT"):
			config_data["pool_timeout"] = int(pool_timeout)
		
		# Debug settings
		if debug := os.getenv("DB_DEBUG"):
			config_data["debug"] = debug.lower() in ("true", "1", "yes")
			config_data["echo_sql"] = config_data["debug"]
		
		# Environment
		if env := os.getenv("ENVIRONMENT"):
			config_data["environment"] = env
		
		_database_config = DatabaseConfig(**config_data)
		
		# Log configuration
		logger = logging.getLogger(__name__)
		conn_info = _database_config.connection_info
		logger.info(
			f"Database configuration initialized: {conn_info.username}@{conn_info.host}:{conn_info.port}/{conn_info.database}"
		)
	
	return _database_config


def set_database_config(config: DatabaseConfig) -> None:
	"""Set the global database configuration."""
	global _database_config
	_database_config = config


def reset_database_config() -> None:
	"""Reset the global database configuration (mainly for testing)."""
	global _database_config
	_database_config = None


# Environment-specific configuration factories

def create_development_config() -> DatabaseConfig:
	"""Create development environment database configuration."""
	return DatabaseConfig(
		connection_url="postgresql://azureuser:Abcd1234.@db.lindela.io:5432/docfusion",
		pool_size=5,
		max_overflow=10,
		echo_sql=True,
		debug=True,
		environment="development"
	)


def create_testing_config() -> DatabaseConfig:
	"""Create testing environment database configuration."""
	return DatabaseConfig(
		connection_url="postgresql://azureuser:Abcd1234.@db.lindela.io:5432/docfusion_test",
		pool_size=3,
		max_overflow=5,
		echo_sql=False,
		debug=False,
		environment="testing"
	)


def create_production_config() -> DatabaseConfig:
	"""Create production environment database configuration."""
	return DatabaseConfig(
		connection_url="postgresql://azureuser:Abcd1234.@db.lindela.io:5432/docfusion",
		pool_size=20,
		max_overflow=40,
		pool_timeout=60,
		echo_sql=False,
		debug=False,
		environment="production",
		statement_timeout=600,
		idle_in_transaction_session_timeout=1200
	)