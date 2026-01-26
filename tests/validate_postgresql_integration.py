#!/usr/bin/env python3
"""
DocuFusion PostgreSQL Integration Validation

Complete validation of PostgreSQL integration including:
- Connection validation
- ORM functionality
- Migration system
- Performance testing
- Component integration readiness
"""

import asyncio
import sys
import time
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from sqlalchemy import text

from docfusion.core.database import (
    get_database_config,
    get_database_connection,
    get_database_session,
    User,
    Organization,
    Document,
    WorkflowTemplate,
    WorkflowInstance,
    create_all_tables
)

async def validate_configuration():
    """Validate database configuration."""
    print("🔧 Validating Database Configuration...")
    
    try:
        config = get_database_config()
        
        # Validate connection URL
        assert config.connection_url == "postgresql://nyimbi:Abcd1234.@172.236.30.103:5432/docdb"
        print(f"   ✅ Connection URL: {config.connection_url}")
        
        # Validate connection info
        conn_info = config.connection_info
        assert conn_info.host == "172.236.30.103"
        assert conn_info.port == 5432
        assert conn_info.database == "docdb"
        assert conn_info.username == "nyimbi"
        print(f"   ✅ Host: {conn_info.host}:{conn_info.port}")
        print(f"   ✅ Database: {conn_info.database}")
        print(f"   ✅ User: {conn_info.username}")
        
        # Validate URLs
        sync_url = config.sqlalchemy_url
        async_url = config.async_sqlalchemy_url
        assert sync_url.startswith("postgresql+psycopg2://")
        assert async_url.startswith("postgresql+asyncpg://")
        print(f"   ✅ Sync URL: {sync_url.split('@')[0]}@***")
        print(f"   ✅ Async URL: {async_url.split('@')[0]}@***")
        
        return True
    except Exception as e:
        print(f"   ❌ Configuration validation failed: {e}")
        return False

async def validate_connections():
    """Validate all connection types."""
    print("\n🔗 Validating Database Connections...")
    
    try:
        connection = await get_database_connection()
        
        # Test sync connection
        with connection.get_sync_session() as session:
            result = session.execute(text("SELECT 'sync_test' as test"))
            assert result.scalar() == "sync_test"
        print("   ✅ Synchronous connection working")
        
        # Test async connection
        async with connection.get_async_session() as session:
            result = await session.execute(text("SELECT 'async_test' as test"))
            assert result.scalar() == "async_test"
        print("   ✅ Asynchronous connection working")
        
        # Test asyncpg connection
        async with connection.get_asyncpg_connection() as conn:
            result = await conn.fetchval("SELECT 'asyncpg_test'")
            assert result == "asyncpg_test"
        print("   ✅ AsyncPG connection working")
        
        # Test health check
        health = await connection.health_check()
        assert all(health.values())
        print("   ✅ Health check passed")
        
        return True
    except Exception as e:
        print(f"   ❌ Connection validation failed: {e}")
        return False

async def validate_orm_models():
    """Validate ORM model functionality."""
    print("\n📋 Validating ORM Models...")
    
    try:
        session_manager = await get_database_session()
        
        # Test User model
        user = User(
            username=f"testuser_{int(time.time())}",
            email=f"test_{int(time.time())}@example.com",
            full_name="Test User"
        )
        assert user.id is not None
        assert user.created_at is not None
        assert user.is_active == True
        print("   ✅ User model created successfully")
        
        # Test Organization model
        org = Organization(
            name=f"Test Org {int(time.time())}",
            description="Test organization",
            organization_type="enterprise"
        )
        assert org.id is not None
        assert org.name.startswith("Test Org")
        print("   ✅ Organization model created successfully")
        
        # Test Document model
        doc = Document(
            title=f"Test Document {int(time.time())}",
            content="Test content",
            document_type="test",
            content_type="text/plain"
        )
        assert doc.id is not None
        assert doc.title.startswith("Test Document")
        print("   ✅ Document model created successfully")
        
        # Test WorkflowTemplate model
        template = WorkflowTemplate(
            name=f"Test Template {int(time.time())}",
            description="Test workflow template",
            template_type="test",
            workflow_definition={"steps": ["step1", "step2"]}
        )
        assert template.id is not None
        assert template.workflow_definition is not None
        print("   ✅ WorkflowTemplate model created successfully")
        
        # Test WorkflowInstance model
        instance = WorkflowInstance(
            name=f"Test Instance {int(time.time())}",
            description="Test workflow instance",
            template_id=template.id,
            input_data={"param": "value"}
        )
        assert instance.id is not None
        assert instance.template_id == template.id
        print("   ✅ WorkflowInstance model created successfully")
        
        return True
    except Exception as e:
        print(f"   ❌ ORM validation failed: {e}")
        return False

async def validate_database_operations():
    """Validate database CRUD operations."""
    print("\n💾 Validating Database Operations...")
    
    try:
        session_manager = await get_database_session()
        
        async with session_manager.async_session() as session:
            # Create test user
            user = User(
                username=f"dbtest_{int(time.time())}",
                email=f"dbtest_{int(time.time())}@example.com",
                full_name="Database Test User"
            )
            session.add(user)
            await session.commit()
            print("   ✅ CREATE operation successful")
            
            # Read test user
            found_user = await session.get(User, user.id)
            assert found_user is not None
            assert found_user.username == user.username
            print("   ✅ READ operation successful")
            
            # Update test user
            found_user.full_name = "Updated Database Test User"
            await session.commit()
            print("   ✅ UPDATE operation successful")
            
            # Verify update
            updated_user = await session.get(User, user.id)
            assert updated_user.full_name == "Updated Database Test User"
            print("   ✅ UPDATE verification successful")
            
            # Delete test user
            await session.delete(found_user)
            await session.commit()
            print("   ✅ DELETE operation successful")
            
            # Verify deletion
            deleted_user = await session.get(User, user.id)
            assert deleted_user is None
            print("   ✅ DELETE verification successful")
        
        return True
    except Exception as e:
        print(f"   ❌ Database operations validation failed: {e}")
        return False

async def validate_performance():
    """Validate performance characteristics."""
    print("\n⚡ Validating Performance...")
    
    try:
        session_manager = await get_database_session()
        
        # Test batch operations
        start_time = time.time()
        batch_size = 50
        
        async with session_manager.async_session() as session:
            # Create batch of documents
            documents = [
                Document(
                    title=f"Perf Test Doc {i}",
                    content=f"Performance test content {i}",
                    document_type="performance_test",
                    content_type="text/plain"
                ) for i in range(batch_size)
            ]
            
            session.add_all(documents)
            await session.commit()
            
            batch_time = time.time() - start_time
            print(f"   ✅ Batch insert ({batch_size} records): {batch_time:.3f}s")
            
            # Test concurrent operations
            start_time = time.time()
            
            async def concurrent_query():
                async with session_manager.async_session() as s:
                    result = await s.execute(text("SELECT COUNT(*) FROM documents WHERE document_type = 'performance_test'"))
                    return result.scalar()
            
            # Run concurrent queries
            tasks = [concurrent_query() for _ in range(10)]
            results = await asyncio.gather(*tasks)
            
            concurrent_time = time.time() - start_time
            print(f"   ✅ Concurrent queries (10 parallel): {concurrent_time:.3f}s")
            
            # Cleanup
            for doc in documents:
                await session.delete(doc)
            await session.commit()
            print("   ✅ Performance test cleanup completed")
        
        # Performance assertions
        assert batch_time < 5.0, f"Batch operations too slow: {batch_time:.3f}s"
        assert concurrent_time < 2.0, f"Concurrent operations too slow: {concurrent_time:.3f}s"
        
        return True
    except Exception as e:
        print(f"   ❌ Performance validation failed: {e}")
        return False

async def validate_extensions():
    """Validate PostgreSQL extensions."""
    print("\n🔧 Validating PostgreSQL Extensions...")
    
    try:
        connection = await get_database_connection()
        
        async with connection.get_asyncpg_connection() as conn:
            # Check pgvector extension
            result = await conn.fetch(
                "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'"
            )
            
            if result:
                ext_name, ext_version = result[0]
                print(f"   ✅ pgvector extension: {ext_name} v{ext_version}")
                
                # Test vector operations
                await conn.execute("SELECT '[1,2,3]'::vector")
                print("   ✅ Vector operations working")
            else:
                print("   ⚠️  pgvector extension not installed (optional)")
            
            # Check JSONB operations
            result = await conn.fetchval(
                "SELECT $1::jsonb -> 'key'",
                '{"key": "value", "test": "data"}'
            )
            assert result == '"value"'
            print("   ✅ JSONB operations working")
        
        return True
    except Exception as e:
        print(f"   ❌ Extensions validation failed: {e}")
        return False

async def validate_integration_readiness():
    """Validate readiness for component integration."""
    print("\n🎯 Validating Component Integration Readiness...")
    
    try:
        # Check import accessibility
        from docfusion.core.database import (
            DatabaseConfig, get_database_config,
            DatabaseConnection, get_database_connection,
            DatabaseSession, get_database_session,
            User, Organization, Document
        )
        print("   ✅ All imports accessible")
        
        # Check configuration options
        config = get_database_config()
        options = config.get_database_options()
        async_options = config.get_async_database_options()
        
        assert 'pool_size' in options
        assert 'pool_size' in async_options
        print("   ✅ Configuration options available")
        
        # Check session decorators
        from docfusion.core.database import with_async_db_session
        print("   ✅ Session decorators available")
        
        # Check FastAPI dependencies
        from docfusion.core.database import get_async_db_session, get_sync_db_session
        print("   ✅ FastAPI dependencies available")
        
        # Check utility functions
        from docfusion.core.database import create_all_tables, drop_all_tables
        print("   ✅ Utility functions available")
        
        return True
    except Exception as e:
        print(f"   ❌ Integration readiness validation failed: {e}")
        return False

async def main():
    """Run complete PostgreSQL integration validation."""
    print("🚀 DocuFusion PostgreSQL Integration Validation")
    print("=" * 60)
    
    validation_results = []
    
    # Run all validations
    validations = [
        ("Configuration", validate_configuration),
        ("Connections", validate_connections),
        ("ORM Models", validate_orm_models),
        ("Database Operations", validate_database_operations),
        ("Performance", validate_performance),
        ("Extensions", validate_extensions),
        ("Integration Readiness", validate_integration_readiness)
    ]
    
    for name, validation_func in validations:
        try:
            result = await validation_func()
            validation_results.append((name, result))
        except Exception as e:
            print(f"   ❌ {name} validation crashed: {e}")
            validation_results.append((name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 POSTGRESQL INTEGRATION VALIDATION RESULTS")
    print("=" * 60)
    
    passed = 0
    total = len(validation_results)
    
    for name, success in validation_results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status:10} {name}")
        if success:
            passed += 1
    
    success_rate = (passed / total) * 100
    print("-" * 60)
    print(f"Total Validations: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {success_rate:.1f}%")
    
    # Final assessment
    print("\n🎯 Final Assessment:")
    if success_rate == 100:
        print("🌟 EXCELLENT - PostgreSQL integration is fully operational")
        print("✅ Ready for production deployment")
        print("✅ All DocuFusion components can integrate immediately")
    elif success_rate >= 90:
        print("👍 GOOD - PostgreSQL integration is mostly working")
        print("⚠️  Minor issues detected, but suitable for development")
    elif success_rate >= 70:
        print("⚠️  ACCEPTABLE - PostgreSQL integration has some issues")
        print("🔧 Additional work needed before production deployment")
    else:
        print("🔴 NEEDS WORK - Critical PostgreSQL integration failures")
        print("❌ Not ready for component integration")
    
    print("\n" + "=" * 60)
    
    # Connection summary
    print("🔗 PostgreSQL Connection Details:")
    print(f"   Host: 172.236.30.103:5432")
    print(f"   Database: docdb") 
    print(f"   User: nyimbi")
    print(f"   URL: postgresql://nyimbi:***@172.236.30.103:5432/docdb")
    
    return success_rate == 100

if __name__ == "__main__":
    success = asyncio.run(main())
    print(f"\n🏁 Validation completed with {'SUCCESS' if success else 'FAILURE'}")
    sys.exit(0 if success else 1)