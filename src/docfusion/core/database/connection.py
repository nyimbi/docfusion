"""
Database Connection Management

Provides centralized connection management for both sync and async SQLAlchemy
connections, as well as direct asyncpg connections for high-performance operations.
"""

import asyncio
import logging
from typing import Optional, AsyncGenerator, Generator, Dict, Any
from contextlib import asynccontextmanager, contextmanager
import threading

import asyncpg
from sqlalchemy import create_engine, Engine, event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine, AsyncSession
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool

from .config import DatabaseConfig, get_database_config


class DatabaseConnection:
	"""
	Centralized database connection manager for DocuFusion.
	
	Manages both sync and async SQLAlchemy engines, plus direct asyncpg
	connections for high-performance vector operations.
	"""
	
	def __init__(self, config: Optional[DatabaseConfig] = None):
		self.config = config or get_database_config()
		self.logger = logging.getLogger(__name__)
		
		# Connection instances
		self._sync_engine: Optional[Engine] = None
		self._async_engine: Optional[AsyncEngine] = None
		self._asyncpg_pool: Optional[asyncpg.Pool] = None
		
		# Thread-local session makers
		self._local = threading.local()
		self._sync_session_maker: Optional[sessionmaker] = None
		self._async_session_maker: Optional[sessionmaker] = None
		
		# Initialization state
		self._initialized = False
		self._sync_initialized = False
		self._async_initialized = False
	
	async def initialize(self) -> None:
		"""Initialize all database connections."""
		if self._initialized:
			return
		
		self.logger.info("Initializing database connections...")
		
		# Initialize sync engine
		await asyncio.get_event_loop().run_in_executor(None, self._initialize_sync_engine)
		
		# Initialize async engine
		await self._initialize_async_engine()
		
		# Initialize asyncpg pool
		await self._initialize_asyncpg_pool()
		
		self._initialized = True
		self.logger.info("Database connections initialized successfully")
	
	def _initialize_sync_engine(self) -> None:
		"""Initialize synchronous SQLAlchemy engine."""
		if self._sync_initialized:
			return
		
		self.logger.debug("Creating synchronous SQLAlchemy engine...")
		
		engine_options = self.config.get_database_options()
		self._sync_engine = create_engine(
			self.config.sqlalchemy_url,
			**engine_options
		)
		
		# Configure connection pool events
		@event.listens_for(self._sync_engine, "connect")
		def set_connection_options(dbapi_connection, connection_record):
			"""Set connection-level options."""
			with dbapi_connection.cursor() as cursor:
				# Set search path for schema
				cursor.execute(f"SET search_path TO {self.config.default_schema}, public")
				
				# Enable extensions if configured
				if self.config.enable_pgvector:
					try:
						cursor.execute("CREATE EXTENSION IF NOT EXISTS vector")
					except Exception as e:
						self.logger.warning(f"Failed to enable pgvector: {e}")
				
				if self.config.enable_pgai:
					try:
						cursor.execute("CREATE EXTENSION IF NOT EXISTS ai CASCADE")
					except Exception as e:
						self.logger.warning(f"Failed to enable pgai: {e}")
		
		# Create session maker
		self._sync_session_maker = sessionmaker(
			bind=self._sync_engine,
			autocommit=self.config.autocommit,
			autoflush=self.config.autoflush
		)
		
		self._sync_initialized = True
		self.logger.debug("Synchronous SQLAlchemy engine created")
	
	async def _initialize_async_engine(self) -> None:
		"""Initialize asynchronous SQLAlchemy engine."""
		if self._async_initialized:
			return
		
		self.logger.debug("Creating asynchronous SQLAlchemy engine...")
		
		engine_options = self.config.get_async_database_options()
		self._async_engine = create_async_engine(
			self.config.async_sqlalchemy_url,
			**engine_options
		)
		
		# Configure async connection events
		@event.listens_for(self._async_engine.sync_engine, "connect")
		def set_async_connection_options(dbapi_connection, connection_record):
			"""Set async connection-level options."""
			with dbapi_connection.cursor() as cursor:
				# Set search path for schema
				cursor.execute(f"SET search_path TO {self.config.default_schema}, public")
		
		# Create async session maker
		self._async_session_maker = sessionmaker(
			bind=self._async_engine,
			class_=AsyncSession,
			autocommit=self.config.autocommit,
			autoflush=self.config.autoflush
		)
		
		self._async_initialized = True
		self.logger.debug("Asynchronous SQLAlchemy engine created")
	
	async def _initialize_asyncpg_pool(self) -> None:
		"""Initialize asyncpg connection pool."""
		self.logger.debug("Creating asyncpg connection pool...")
		
		pool_options = self.config.get_asyncpg_pool_options()
		
		# Connection setup function
		async def init_connection(conn):
			"""Initialize individual asyncpg connections."""
			# Set search path
			await conn.execute(f"SET search_path TO {self.config.default_schema}, public")
			
			# Enable extensions if configured
			if self.config.enable_pgvector:
				try:
					await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
				except Exception as e:
					self.logger.warning(f"Failed to enable pgvector on connection: {e}")
		
		try:
			self._asyncpg_pool = await asyncpg.create_pool(
				self.config.asyncpg_url,
				init=init_connection,
				**pool_options
			)
			self.logger.debug("Asyncpg connection pool created")
		except Exception as e:
			self.logger.error(f"Failed to create asyncpg pool: {e}")
			raise
	
	@property
	def sync_engine(self) -> Engine:
		"""Get synchronous SQLAlchemy engine."""
		if not self._sync_initialized:
			self._initialize_sync_engine()
		return self._sync_engine
	
	@property
	def async_engine(self) -> AsyncEngine:
		"""Get asynchronous SQLAlchemy engine."""
		if not self._async_initialized:
			raise RuntimeError("Async engine not initialized. Call initialize() first.")
		return self._async_engine
	
	@property
	def asyncpg_pool(self) -> asyncpg.Pool:
		"""Get asyncpg connection pool."""
		if not self._asyncpg_pool:
			raise RuntimeError("Asyncpg pool not initialized. Call initialize() first.")
		return self._asyncpg_pool
	
	@contextmanager
	def get_sync_session(self) -> Generator[Session, None, None]:
		"""Get synchronous database session context manager."""
		if not self._sync_session_maker:
			self._initialize_sync_engine()
		
		session = self._sync_session_maker()
		try:
			yield session
			session.commit()
		except Exception:
			session.rollback()
			raise
		finally:
			session.close()
	
	@asynccontextmanager
	async def get_async_session(self) -> AsyncGenerator[AsyncSession, None]:
		"""Get asynchronous database session context manager."""
		if not self._async_session_maker:
			await self._initialize_async_engine()
		
		session = self._async_session_maker()
		try:
			yield session
			await session.commit()
		except Exception:
			await session.rollback()
			raise
		finally:
			await session.close()
	
	@asynccontextmanager
	async def get_asyncpg_connection(self) -> AsyncGenerator[asyncpg.Connection, None]:
		"""Get direct asyncpg connection context manager."""
		if not self._asyncpg_pool:
			await self._initialize_asyncpg_pool()
		
		async with self._asyncpg_pool.acquire() as connection:
			yield connection
	
	async def execute_raw_sql(self, sql: str, *args) -> Any:
		"""Execute raw SQL using asyncpg for high performance."""
		async with self.get_asyncpg_connection() as conn:
			return await conn.fetch(sql, *args)
	
	async def execute_raw_sql_single(self, sql: str, *args) -> Any:
		"""Execute raw SQL and return single result."""
		async with self.get_asyncpg_connection() as conn:
			return await conn.fetchrow(sql, *args)
	
	def get_connection_info(self) -> Dict[str, Any]:
		"""Get connection information for monitoring."""
		info = {
			'sync_engine_initialized': self._sync_initialized,
			'async_engine_initialized': self._async_initialized,
			'asyncpg_pool_initialized': self._asyncpg_pool is not None,
			'config': {
				'host': self.config.connection_info.host,
				'port': self.config.connection_info.port,
				'database': self.config.connection_info.database,
				'username': self.config.connection_info.username,
				'pool_size': self.config.pool_size,
				'async_pool_size': self.config.async_pool_size,
			}
		}
		
		# Add pool stats if available
		if self._sync_engine:
			pool = self._sync_engine.pool
			info['sync_pool'] = {
				'size': pool.size(),
				'checked_in': pool.checkedin(),
				'checked_out': pool.checkedout(),
				'overflow': pool.overflow(),
			}
		
		if self._asyncpg_pool:
			info['asyncpg_pool'] = {
				'min_size': self._asyncpg_pool.get_min_size(),
				'max_size': self._asyncpg_pool.get_max_size(),
				'current_size': self._asyncpg_pool.get_size(),
			}
		
		return info
	
	async def health_check(self) -> Dict[str, bool]:
		"""Perform health check on all connections."""
		health = {}
		
		# Test sync connection
		try:
			with self.get_sync_session() as session:
				session.execute("SELECT 1")
			health['sync_connection'] = True
		except Exception as e:
			self.logger.error(f"Sync connection health check failed: {e}")
			health['sync_connection'] = False
		
		# Test async connection
		try:
			async with self.get_async_session() as session:
				await session.execute("SELECT 1")
			health['async_connection'] = True
		except Exception as e:
			self.logger.error(f"Async connection health check failed: {e}")
			health['async_connection'] = False
		
		# Test asyncpg connection
		try:
			async with self.get_asyncpg_connection() as conn:
				await conn.fetchval("SELECT 1")
			health['asyncpg_connection'] = True
		except Exception as e:
			self.logger.error(f"Asyncpg connection health check failed: {e}")
			health['asyncpg_connection'] = False
		
		return health
	
	async def close(self) -> None:
		"""Close all database connections."""
		self.logger.info("Closing database connections...")
		
		if self._sync_engine:
			self._sync_engine.dispose()
			self._sync_engine = None
		
		if self._async_engine:
			await self._async_engine.dispose()
			self._async_engine = None
		
		if self._asyncpg_pool:
			await self._asyncpg_pool.close()
			self._asyncpg_pool = None
		
		self._initialized = False
		self._sync_initialized = False
		self._async_initialized = False
		
		self.logger.info("Database connections closed")


# Global connection instance
_database_connection: Optional[DatabaseConnection] = None


async def get_database_connection() -> DatabaseConnection:
	"""
	Get the global database connection instance.
	
	Initializes the connection if not already done.
	"""
	global _database_connection
	
	if _database_connection is None:
		_database_connection = DatabaseConnection()
		await _database_connection.initialize()
	
	return _database_connection


def set_database_connection(connection: DatabaseConnection) -> None:
	"""Set the global database connection."""
	global _database_connection
	_database_connection = connection


async def reset_database_connection() -> None:
	"""Reset the global database connection (mainly for testing)."""
	global _database_connection
	
	if _database_connection:
		await _database_connection.close()
	
	_database_connection = None