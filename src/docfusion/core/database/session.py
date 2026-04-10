"""
Database Session Management

Provides high-level session management utilities, dependency injection for FastAPI,
and transaction management across all DocuFusion components.
"""

import asyncio
import logging
from typing import Optional, Callable, AsyncGenerator, Generator, Dict, Any, TypeVar, Generic
from contextlib import asynccontextmanager, contextmanager
from functools import wraps
import threading

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from .connection import DatabaseConnection, get_database_connection
from .config import DatabaseConfig, get_database_config

T = TypeVar('T')


class DatabaseSession:
	"""
	High-level database session manager with transaction support,
	error handling, and integration utilities.
	"""
	
	def __init__(self, connection: Optional[DatabaseConnection] = None):
		self.connection = connection
		self.logger = logging.getLogger(__name__)
		self._local = threading.local()
	
	async def _get_connection(self) -> DatabaseConnection:
		"""Get database connection, initializing if needed."""
		if self.connection is None:
			self.connection = await get_database_connection()
		return self.connection
	
	@contextmanager
	def sync_session(self, autocommit: bool = True) -> Generator[Session, None, None]:
		"""
		Context manager for synchronous database sessions.
		
		Args:
			autocommit: Whether to automatically commit on success
		"""
		connection = asyncio.run(self._get_connection()) if self.connection is None else self.connection
		
		with connection.get_sync_session() as session:
			try:
				yield session
				if autocommit:
					session.commit()
			except Exception as e:
				session.rollback()
				self.logger.error(f"Database session error: {e}")
				raise
	
	@asynccontextmanager
	async def async_session(self, autocommit: bool = True) -> AsyncGenerator[AsyncSession, None]:
		"""
		Context manager for asynchronous database sessions.
		
		Args:
			autocommit: Whether to automatically commit on success
		"""
		connection = await self._get_connection()
		
		async with connection.get_async_session() as session:
			try:
				yield session
				if autocommit:
					await session.commit()
			except Exception as e:
				await session.rollback()
				self.logger.error(f"Async database session error: {e}")
				raise
	
	@contextmanager
	def transaction(self) -> Generator[Session, None, None]:
		"""Context manager for explicit transaction control."""
		with self.sync_session(autocommit=False) as session:
			transaction = session.begin()
			try:
				yield session
				transaction.commit()
			except Exception:
				transaction.rollback()
				raise
	
	@asynccontextmanager
	async def async_transaction(self) -> AsyncGenerator[AsyncSession, None]:
		"""Context manager for explicit async transaction control."""
		async with self.async_session(autocommit=False) as session:
			transaction = await session.begin()
			try:
				yield session
				await transaction.commit()
			except Exception:
				await transaction.rollback()
				raise
	
	def execute_in_session(self, func: Callable[[Session], T], autocommit: bool = True) -> T:
		"""
		Execute a function within a synchronous database session.
		
		Args:
			func: Function that takes a Session and returns a result
			autocommit: Whether to automatically commit
		"""
		with self.sync_session(autocommit=autocommit) as session:
			return func(session)
	
	async def execute_in_async_session(
		self, 
		func: Callable[[AsyncSession], T], 
		autocommit: bool = True
	) -> T:
		"""
		Execute a function within an asynchronous database session.
		
		Args:
			func: Async function that takes an AsyncSession and returns a result
			autocommit: Whether to automatically commit
		"""
		async with self.async_session(autocommit=autocommit) as session:
			return await func(session)
	
	def with_retry(
		self, 
		max_retries: int = 3, 
		backoff_factor: float = 1.0,
		retry_exceptions: tuple = (SQLAlchemyError,)
	):
		"""
		Decorator for automatic retry on database errors.
		
		Args:
			max_retries: Maximum number of retry attempts
			backoff_factor: Exponential backoff multiplier
			retry_exceptions: Tuple of exceptions to retry on
		"""
		def decorator(func):
			@wraps(func)
			def wrapper(*args, **kwargs):
				last_exception = None
				
				for attempt in range(max_retries + 1):
					try:
						return func(*args, **kwargs)
					except retry_exceptions as e:
						last_exception = e
						if attempt < max_retries:
							wait_time = backoff_factor * (2 ** attempt)
							self.logger.warning(
								f"Database operation failed (attempt {attempt + 1}/{max_retries + 1}): {e}. "
								f"Retrying in {wait_time}s..."
							)
							import time
							time.sleep(wait_time)
						else:
							self.logger.error(f"Database operation failed after {max_retries + 1} attempts")
							raise
				
				raise last_exception
			
			return wrapper
		return decorator
	
	def async_with_retry(
		self, 
		max_retries: int = 3, 
		backoff_factor: float = 1.0,
		retry_exceptions: tuple = (SQLAlchemyError,)
	):
		"""
		Async decorator for automatic retry on database errors.
		"""
		def decorator(func):
			@wraps(func)
			async def wrapper(*args, **kwargs):
				last_exception = None
				
				for attempt in range(max_retries + 1):
					try:
						return await func(*args, **kwargs)
					except retry_exceptions as e:
						last_exception = e
						if attempt < max_retries:
							wait_time = backoff_factor * (2 ** attempt)
							self.logger.warning(
								f"Async database operation failed (attempt {attempt + 1}/{max_retries + 1}): {e}. "
								f"Retrying in {wait_time}s..."
							)
							await asyncio.sleep(wait_time)
						else:
							self.logger.error(f"Async database operation failed after {max_retries + 1} attempts")
							raise
				
				raise last_exception
			
			return wrapper
		return decorator
	
	async def health_check(self) -> Dict[str, Any]:
		"""Perform session-level health check."""
		connection = await self._get_connection()
		health_info = await connection.health_check()
		
		# Add session-specific health checks
		try:
			# Test sync session
			with self.sync_session() as session:
				session.execute("SELECT current_database(), current_user, version()")
			health_info['sync_session'] = True
		except Exception as e:
			self.logger.error(f"Sync session health check failed: {e}")
			health_info['sync_session'] = False
		
		try:
			# Test async session
			async with self.async_session() as session:
				await session.execute("SELECT current_database(), current_user, version()")
			health_info['async_session'] = True
		except Exception as e:
			self.logger.error(f"Async session health check failed: {e}")
			health_info['async_session'] = False
		
		return health_info


# Global session instance
_database_session: Optional[DatabaseSession] = None


async def get_database_session() -> DatabaseSession:
	"""Get the global database session instance."""
	global _database_session
	
	if _database_session is None:
		connection = await get_database_connection()
		_database_session = DatabaseSession(connection)
	
	return _database_session


def set_database_session(session: DatabaseSession) -> None:
	"""Set the global database session."""
	global _database_session
	_database_session = session


async def reset_database_session() -> None:
	"""Reset the global database session."""
	global _database_session
	_database_session = None


# FastAPI Dependency Injection Support

async def get_async_db_session() -> AsyncGenerator[AsyncSession, None]:
	"""
	FastAPI dependency for async database sessions.
	
	Usage:
		@app.post("/items/")
		async def create_item(item: Item, db: AsyncSession = Depends(get_async_db_session)):
			# Use db session
			pass
	"""
	session_manager = await get_database_session()
	async with session_manager.async_session() as session:
		yield session


def get_sync_db_session() -> Generator[Session, None, None]:
	"""
	FastAPI dependency for sync database sessions.
	
	Usage:
		@app.post("/items/")
		def create_item(item: Item, db: Session = Depends(get_sync_db_session)):
			# Use db session
			pass
	"""
	# Note: This runs the async function in a thread for sync contexts
	loop = None
	try:
		loop = asyncio.get_event_loop()
	except RuntimeError:
		loop = asyncio.new_event_loop()
		asyncio.set_event_loop(loop)
	
	session_manager = loop.run_until_complete(get_database_session())
	with session_manager.sync_session() as session:
		yield session


# Utility Decorators for Component Integration

def with_db_session(func):
	"""
	Decorator to automatically inject database session into sync functions.
	
	Usage:
		@with_db_session
		def my_function(session: Session, other_param: str):
			# session is automatically injected
			pass
	"""
	@wraps(func)
	def wrapper(*args, **kwargs):
		session_manager = asyncio.run(get_database_session())
		with session_manager.sync_session() as session:
			return func(session, *args, **kwargs)
	return wrapper


def with_async_db_session(func):
	"""
	Decorator to automatically inject database session into async functions.
	
	Usage:
		@with_async_db_session
		async def my_function(session: AsyncSession, other_param: str):
			# session is automatically injected
				pass
	"""
	@wraps(func)
	async def wrapper(*args, **kwargs):
		session_manager = await get_database_session()
		async with session_manager.async_session() as session:
			return await func(session, *args, **kwargs)
	return wrapper


# Transaction Management Utilities

class TransactionManager:
	"""Advanced transaction management for complex operations."""
	
	def __init__(self, session_manager: Optional[DatabaseSession] = None):
		self.session_manager = session_manager
		self.logger = logging.getLogger(__name__)
	
	async def _get_session_manager(self) -> DatabaseSession:
		"""Get session manager instance."""
		if self.session_manager is None:
			self.session_manager = await get_database_session()
		return self.session_manager
	
	@asynccontextmanager
	async def distributed_transaction(self, *operations) -> AsyncGenerator[AsyncSession, None]:
		"""
		Manage distributed transactions across multiple operations.
		
		Args:
			operations: List of async functions to execute in transaction
		"""
		session_manager = await self._get_session_manager()
		
		async with session_manager.async_transaction() as session:
			try:
				# Execute all operations in the same transaction
				for operation in operations:
					await operation(session)
				
				yield session
				
			except Exception as e:
				self.logger.error(f"Distributed transaction failed: {e}")
				raise
	
	async def execute_batch_operations(
		self, 
		operations: list, 
		batch_size: int = 100,
		continue_on_error: bool = False
	) -> Dict[str, Any]:
		"""
		Execute operations in batches with transaction management.
		
		Args:
			operations: List of async functions to execute
			batch_size: Number of operations per batch
			continue_on_error: Whether to continue if a batch fails
		"""
		session_manager = await self._get_session_manager()
		results = {
			'successful_batches': 0,
			'failed_batches': 0,
			'total_operations': len(operations),
			'errors': []
		}
		
		for i in range(0, len(operations), batch_size):
			batch = operations[i:i + batch_size]
			
			try:
				async with session_manager.async_transaction() as session:
					for operation in batch:
						await operation(session)
				
				results['successful_batches'] += 1
				
			except Exception as e:
				error_info = {
					'batch_index': i // batch_size,
					'batch_size': len(batch),
					'error': str(e)
				}
				results['errors'].append(error_info)
				results['failed_batches'] += 1
				
				self.logger.error(f"Batch {i // batch_size} failed: {e}")
				
				if not continue_on_error:
					break
		
		return results


# Example usage and testing utilities

async def example_database_usage():
	"""Example demonstrating database session usage patterns."""
	# Get session manager
	session_manager = await get_database_session()
	
	# Basic sync session usage
	with session_manager.sync_session() as session:
		result = session.execute("SELECT current_database()")
		logging.info(f"Current database: {result.scalar()}")
	
	# Basic async session usage
	async with session_manager.async_session() as session:
		result = await session.execute("SELECT current_user")
		logging.info(f"Current user: {result.scalar()}")
	
	# Transaction usage
	async with session_manager.async_transaction() as session:
		# Multiple operations in single transaction
		await session.execute("SELECT 1")
		await session.execute("SELECT 2")
	
	# Health check
	health = await session_manager.health_check()
	logging.info(f"Database health: {health}")


if __name__ == "__main__":
	asyncio.run(example_database_usage())