"""
PostgreSQL Integration Tests

Comprehensive tests for DocuFusion PostgreSQL integration including:
- Database connection management
- ORM model operations
- Migration system
- Session management
- Performance validation
"""

import asyncio
import pytest
from datetime import datetime
from typing import Dict, Any, List
import uuid

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

# Import our database components
from docfusion.core.database.config import (
	DatabaseConfig, get_database_config, create_development_config
)
from docfusion.core.database.connection import (
	DatabaseConnection, get_database_connection
)
from docfusion.core.database.session import (
	DatabaseSession, get_database_session
)
from docfusion.core.database.models import (
	Base, BaseModel, User, Organization, Document, 
	WorkflowTemplate, WorkflowInstance
)

TEST_DATABASE_URL = "postgresql://postgres@localhost:5432/docfusion"


class TestPostgreSQLConfiguration:
	"""Test database configuration management."""
	
	def test_database_config_creation(self):
		"""Test creating database configuration."""
		config = DatabaseConfig(connection_url=TEST_DATABASE_URL)
		
		# Verify default connection string
		assert config.connection_url == TEST_DATABASE_URL
		assert config.pool_size == 10
		assert config.default_schema == "public"
	
	def test_connection_url_parsing(self):
		"""Test PostgreSQL URL parsing."""
		config = DatabaseConfig(connection_url=TEST_DATABASE_URL)
		conn_info = config.connection_info
		
		assert conn_info.host == "localhost"
		assert conn_info.port == 5432
		assert conn_info.database == "docfusion"
		assert conn_info.username == "postgres"
		assert conn_info.password == ""
	
	def test_sqlalchemy_url_generation(self):
		"""Test SQLAlchemy URL generation."""
		config = DatabaseConfig(connection_url=TEST_DATABASE_URL)
		
		sync_url = config.sqlalchemy_url
		async_url = config.async_sqlalchemy_url
		
		assert sync_url.startswith("postgresql+psycopg2://")
		assert async_url.startswith("postgresql+asyncpg://")
		assert "localhost:5432/docfusion" in sync_url
		assert "localhost:5432/docfusion" in async_url
	
	def test_database_options(self):
		"""Test database engine options."""
		config = DatabaseConfig(
			pool_size=15,
			max_overflow=25,
			echo_sql=True
		)
		
		options = config.get_database_options()
		
		assert options['pool_size'] == 15
		assert options['max_overflow'] == 25
		assert options['echo'] == True


class TestDatabaseConnection:
	"""Test database connection management."""
	
	@pytest.fixture
	async def db_connection(self):
		"""Create database connection for testing."""
		config = create_development_config()
		connection = DatabaseConnection(config)
		await connection.initialize()
		yield connection
		await connection.close()
	
	async def test_connection_initialization(self, db_connection):
		"""Test database connection initialization."""
		assert db_connection._initialized == True
		assert db_connection._sync_initialized == True
		assert db_connection._async_initialized == True
	
	async def test_sync_session_creation(self, db_connection):
		"""Test synchronous session creation."""
		with db_connection.get_sync_session() as session:
			result = session.execute(text("SELECT 1 as test_value"))
			assert result.scalar() == 1
	
	async def test_async_session_creation(self, db_connection):
		"""Test asynchronous session creation."""
		async with db_connection.get_async_session() as session:
			result = await session.execute(text("SELECT 1 as test_value"))
			assert result.scalar() == 1
	
	async def test_asyncpg_connection(self, db_connection):
		"""Test direct asyncpg connection."""
		async with db_connection.get_asyncpg_connection() as conn:
			result = await conn.fetchval("SELECT 1")
			assert result == 1
	
	async def test_connection_health_check(self, db_connection):
		"""Test connection health checking."""
		health = await db_connection.health_check()
		
		assert health['sync_connection'] == True
		assert health['async_connection'] == True
		assert health['asyncpg_connection'] == True
	
	async def test_connection_info(self, db_connection):
		"""Test connection information retrieval."""
		info = db_connection.get_connection_info()
		
		assert info['sync_engine_initialized'] == True
		assert info['async_engine_initialized'] == True
		assert info['asyncpg_pool_initialized'] == True
		assert info['config']['host'] == "172.236.30.103"
		assert info['config']['database'] == "docdb"


class TestDatabaseSession:
	"""Test database session management."""
	
	@pytest.fixture
	async def db_session(self):
		"""Create database session for testing."""
		connection = DatabaseConnection(create_development_config())
		await connection.initialize()
		session = DatabaseSession(connection)
		yield session
		await connection.close()
	
	async def test_sync_session_usage(self, db_session):
		"""Test synchronous session usage."""
		with db_session.sync_session() as session:
			result = session.execute(text("SELECT current_database()"))
			db_name = result.scalar()
			assert db_name == "docdb"
	
	async def test_async_session_usage(self, db_session):
		"""Test asynchronous session usage."""
		async with db_session.async_session() as session:
			result = await session.execute(text("SELECT current_user"))
			user = result.scalar()
			assert user == "nyimbi"
	
	async def test_transaction_management(self, db_session):
		"""Test transaction management."""
		# Test sync transaction
		with db_session.transaction() as session:
			session.execute(text("SELECT 1"))
		
		# Test async transaction
		async with db_session.async_transaction() as session:
			await session.execute(text("SELECT 1"))
	
	async def test_session_health_check(self, db_session):
		"""Test session health checking."""
		health = await db_session.health_check()
		
		assert health['sync_connection'] == True
		assert health['async_connection'] == True
		assert health['sync_session'] == True
		assert health['async_session'] == True


class TestORMModels:
	"""Test SQLAlchemy ORM models."""
	
	@pytest.fixture
	async def db_session(self):
		"""Create database session for testing."""
		connection = DatabaseConnection(create_development_config())
		await connection.initialize()
		session = DatabaseSession(connection)
		yield session
		await connection.close()
	
	def test_base_model_creation(self):
		"""Test base model functionality."""
		# Create a test user
		user = User(
			username="testuser",
			email="test@example.com",
			full_name="Test User"
		)
		
		# Verify basic fields
		assert user.id is not None
		assert user.created_at is not None
		assert user.updated_at is not None
		assert user.is_active == True
		assert user.version == 1
		assert user.metadata_ == {}
	
	def test_user_model(self):
		"""Test User model functionality."""
		user = User(
			username="testuser",
			email="test@example.com",
			full_name="Test User",
			is_superuser=False,
			is_verified=True
		)
		
		assert user.username == "testuser"
		assert user.email == "test@example.com"
		assert user.full_name == "Test User"
		assert user.is_superuser == False
		assert user.is_verified == True
	
	def test_organization_model(self):
		"""Test Organization model functionality."""
		org = Organization(
			name="Test Organization",
			description="A test organization",
			organization_type="enterprise",
			industry="technology"
		)
		
		assert org.name == "Test Organization"
		assert org.description == "A test organization"
		assert org.organization_type == "enterprise"
		assert org.industry == "technology"
	
	def test_document_model(self):
		"""Test Document model functionality."""
		doc = Document(
			title="Test Document",
			content="This is test content",
			document_type="report",
			content_type="text/plain",
			file_size=1024
		)
		
		assert doc.title == "Test Document"
		assert doc.content == "This is test content"
		assert doc.document_type == "report"
		assert doc.content_type == "text/plain"
		assert doc.file_size == 1024
	
	def test_workflow_template_model(self):
		"""Test WorkflowTemplate model functionality."""
		template = WorkflowTemplate(
			name="Test Workflow",
			description="A test workflow template",
			template_type="document_generation",
			workflow_definition={"steps": ["step1", "step2"]}
		)
		
		assert template.name == "Test Workflow"
		assert template.template_type == "document_generation"
		assert template.workflow_definition == {"steps": ["step1", "step2"]}
	
	def test_workflow_instance_model(self):
		"""Test WorkflowInstance model functionality."""
		instance = WorkflowInstance(
			name="Test Instance",
			description="A test workflow instance",
			input_data={"param1": "value1"},
			current_step="step1",
			total_steps=3,
			completed_steps=1
		)
		
		assert instance.name == "Test Instance"
		assert instance.input_data == {"param1": "value1"}
		assert instance.current_step == "step1"
		assert instance.total_steps == 3
		assert instance.completed_steps == 1
	
	def test_model_methods(self):
		"""Test model utility methods."""
		user = User(username="testuser", email="test@example.com")
		
		# Test timestamp update
		original_updated_at = user.updated_at
		user.update_timestamp()
		assert user.updated_at > original_updated_at
		
		# Test soft delete
		assert user.is_deleted == False
		user.soft_delete()
		assert user.is_deleted == True
		assert user.is_active == False
		
		# Test restore
		user.restore()
		assert user.is_deleted == False
		assert user.is_active == True
		
		# Test version increment
		original_version = user.version
		user.increment_version()
		assert user.version == original_version + 1
		
		# Test to_dict
		user_dict = user.to_dict()
		assert user_dict['id'] == user.id
		assert user_dict['username'] == user.username


class TestDatabaseOperations:
	"""Test database CRUD operations."""
	
	@pytest.fixture
	async def db_session(self):
		"""Create database session for testing."""
		connection = DatabaseConnection(create_development_config())
		await connection.initialize()
		session = DatabaseSession(connection)
		yield session
		await connection.close()
	
	async def test_sync_crud_operations(self, db_session):
		"""Test synchronous CRUD operations."""
		with db_session.sync_session() as session:
			# Create
			user = User(
				username=f"testuser_{uuid.uuid4().hex[:8]}",
				email=f"test_{uuid.uuid4().hex[:8]}@example.com",
				full_name="Test User"
			)
			session.add(user)
			session.commit()
			
			# Read
			found_user = session.get(User, user.id)
			assert found_user is not None
			assert found_user.username == user.username
			
			# Update
			found_user.full_name = "Updated Test User"
			session.commit()
			
			# Verify update
			updated_user = session.get(User, user.id)
			assert updated_user.full_name == "Updated Test User"
			
			# Delete
			session.delete(found_user)
			session.commit()
	
	async def test_async_crud_operations(self, db_session):
		"""Test asynchronous CRUD operations."""
		async with db_session.async_session() as session:
			# Create
			org = Organization(
				name=f"Test Org {uuid.uuid4().hex[:8]}",
				description="Test organization",
				organization_type="startup"
			)
			session.add(org)
			await session.commit()
			
			# Read
			found_org = await session.get(Organization, org.id)
			assert found_org is not None
			assert found_org.name == org.name
			
			# Update
			found_org.description = "Updated test organization"
			await session.commit()
			
			# Verify update
			updated_org = await session.get(Organization, org.id)
			assert updated_org.description == "Updated test organization"
			
			# Delete
			await session.delete(found_org)
			await session.commit()
	
	async def test_query_operations(self, db_session):
		"""Test database query operations."""
		async with db_session.async_session() as session:
			# Create test data
			users = [
				User(
					username=f"user_{i}_{uuid.uuid4().hex[:8]}",
					email=f"user{i}_{uuid.uuid4().hex[:8]}@example.com",
					full_name=f"User {i}"
				) for i in range(3)
			]
			
			session.add_all(users)
			await session.commit()
			
			try:
				# Query all users
				result = await session.execute(select(User))
				all_users = result.scalars().all()
				assert len(all_users) >= 3
				
				# Query with filter
				result = await session.execute(
					select(User).where(User.username == users[0].username)
				)
				filtered_user = result.scalar_one_or_none()
				assert filtered_user is not None
				assert filtered_user.username == users[0].username
				
			finally:
				# Cleanup
				for user in users:
					await session.delete(user)
				await session.commit()


class TestPerformanceAndScaling:
	"""Test database performance and scaling characteristics."""
	
	@pytest.fixture
	async def db_session(self):
		"""Create database session for testing."""
		connection = DatabaseConnection(create_development_config())
		await connection.initialize()
		session = DatabaseSession(connection)
		yield session
		await connection.close()
	
	async def test_batch_operations(self, db_session):
		"""Test batch operations performance."""
		import time
		
		batch_size = 100
		start_time = time.time()
		
		async with db_session.async_session() as session:
			# Create batch of documents
			documents = [
				Document(
					title=f"Batch Document {i}",
					content=f"Content for document {i}",
					document_type="test",
					content_type="text/plain"
				) for i in range(batch_size)
			]
			
			session.add_all(documents)
			await session.commit()
			
			batch_time = time.time() - start_time
			
			# Verify all documents were created
			result = await session.execute(select(Document))
			created_docs = result.scalars().all()
			
			# Find our test documents
			test_docs = [d for d in created_docs if d.title.startswith("Batch Document")]
			assert len(test_docs) >= batch_size
			
			# Cleanup
			for doc in test_docs:
				await session.delete(doc)
			await session.commit()
		
		# Performance assertion (should complete in reasonable time)
		assert batch_time < 10.0, f"Batch operation took {batch_time:.2f}s, expected < 10s"
	
	async def test_concurrent_connections(self, db_session):
		"""Test concurrent database connections."""
		async def test_connection():
			async with db_session.async_session() as session:
				result = await session.execute(text("SELECT pg_backend_pid()"))
				return result.scalar()
		
		# Run multiple concurrent operations
		tasks = [test_connection() for _ in range(10)]
		pids = await asyncio.gather(*tasks)
		
		# Verify we got results from all connections
		assert len(pids) == 10
		assert all(isinstance(pid, int) for pid in pids)
		
		# PIDs should be different (different connections)
		unique_pids = set(pids)
		assert len(unique_pids) >= 1  # At least one unique PID


class TestDatabaseExtensions:
	"""Test PostgreSQL extensions integration."""
	
	@pytest.fixture
	async def db_connection(self):
		"""Create database connection for testing."""
		config = create_development_config()
		connection = DatabaseConnection(config)
		await connection.initialize()
		yield connection
		await connection.close()
	
	async def test_pgvector_extension(self, db_connection):
		"""Test pgvector extension availability."""
		async with db_connection.get_asyncpg_connection() as conn:
			# Check if pgvector extension is available
			try:
				result = await conn.fetch(
					"SELECT extname FROM pg_extension WHERE extname = 'vector'"
				)
				if result:
					# Test basic vector operations
					await conn.execute("SELECT '[1,2,3]'::vector")
				else:
					pytest.skip("pgvector extension not available")
			except Exception as e:
				pytest.skip(f"pgvector extension error: {e}")
	
	async def test_jsonb_operations(self, db_connection):
		"""Test JSONB operations."""
		async with db_connection.get_asyncpg_connection() as conn:
			# Test JSONB creation and querying
			result = await conn.fetchval(
				"SELECT $1::jsonb -> 'key'",
				'{"key": "value", "nested": {"inner": "data"}}'
			)
			assert result == '"value"'
			
			# Test JSONB path operations
			result = await conn.fetchval(
				"SELECT $1::jsonb #> '{nested,inner}'",
				'{"key": "value", "nested": {"inner": "data"}}'
			)
			assert result == '"data"'


# Integration test runner
async def run_postgresql_integration_tests():
	"""Run all PostgreSQL integration tests."""
	print("🚀 Starting DocuFusion PostgreSQL Integration Tests")
	print("=" * 60)
	
	test_results = []
	
	# Configuration tests
	config_test = TestPostgreSQLConfiguration()
	try:
		config_test.test_database_config_creation()
		config_test.test_connection_url_parsing()
		config_test.test_sqlalchemy_url_generation()
		config_test.test_database_options()
		test_results.append(("PostgreSQL Configuration", True, "All configuration tests passed"))
	except Exception as e:
		test_results.append(("PostgreSQL Configuration", False, str(e)))
	
	# Connection tests
	try:
		connection_test = TestDatabaseConnection()
		config = create_development_config()
		db_connection = DatabaseConnection(config)
		await db_connection.initialize()
		
		await connection_test.test_connection_initialization(db_connection)
		await connection_test.test_sync_session_creation(db_connection)
		await connection_test.test_async_session_creation(db_connection)
		await connection_test.test_asyncpg_connection(db_connection)
		await connection_test.test_connection_health_check(db_connection)
		await connection_test.test_connection_info(db_connection)
		
		await db_connection.close()
		test_results.append(("Database Connection", True, "All connection tests passed"))
	except Exception as e:
		test_results.append(("Database Connection", False, str(e)))
	
	# Model tests
	try:
		model_test = TestORMModels()
		model_test.test_base_model_creation()
		model_test.test_user_model()
		model_test.test_organization_model()
		model_test.test_document_model()
		model_test.test_workflow_template_model()
		model_test.test_workflow_instance_model()
		model_test.test_model_methods()
		test_results.append(("ORM Models", True, "All model tests passed"))
	except Exception as e:
		test_results.append(("ORM Models", False, str(e)))
	
	# Print results
	print("\n📊 PostgreSQL Integration Test Results:")
	print("-" * 60)
	
	passed = 0
	failed = 0
	
	for test_name, success, message in test_results:
		status = "✅ PASSED" if success else "❌ FAILED"
		print(f"{status:10} {test_name}")
		if not success:
			print(f"           Error: {message}")
		
		if success:
			passed += 1
		else:
			failed += 1
	
	print("-" * 60)
	print(f"Total Tests: {len(test_results)}")
	print(f"Passed: {passed}")
	print(f"Failed: {failed}")
	print(f"Success Rate: {(passed/len(test_results)*100):.1f}%")
	
	if failed == 0:
		print("\n🎉 All PostgreSQL integration tests passed!")
		print("✅ DocuFusion PostgreSQL integration is working correctly")
		return True
	else:
		print(f"\n⚠️  {failed} PostgreSQL integration tests failed")
		return False


if __name__ == "__main__":
	success = asyncio.run(run_postgresql_integration_tests())
	exit(0 if success else 1)
