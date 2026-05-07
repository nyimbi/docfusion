"""
Basic PostgreSQL Connection Test

Simple test to validate PostgreSQL connection and basic operations.
"""

import asyncio
import os
import asyncpg
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Connection details
POSTGRES_URL = os.getenv("DATABASE_URL")
ASYNCPG_URL = POSTGRES_URL

pytestmark = pytest.mark.skipif(
    not POSTGRES_URL,
    reason="PostgreSQL connection tests require DATABASE_URL",
)

async def test_asyncpg_connection():
    """Test direct asyncpg connection."""
    print("Testing asyncpg connection...")
    try:
        conn = await asyncpg.connect(ASYNCPG_URL)
        
        # Basic query
        result = await conn.fetchval("SELECT version()")
        print(f"✅ PostgreSQL Version: {result[:50]}...")
        
        # Test current database
        db_name = await conn.fetchval("SELECT current_database()")
        print(f"✅ Connected to database: {db_name}")
        
        # Test current user
        user = await conn.fetchval("SELECT current_user")
        print(f"✅ Connected as user: {user}")
        
        # Test basic table operations
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS test_table (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("✅ Test table created/verified")
        
        # Insert test data
        await conn.execute("""
            INSERT INTO test_table (name) VALUES ($1)
            ON CONFLICT DO NOTHING
        """, "test_connection")
        
        # Query test data
        result = await conn.fetchval("""
            SELECT name FROM test_table WHERE name = $1
        """, "test_connection")
        print(f"✅ Test data query result: {result}")
        
        # Cleanup
        await conn.execute("DROP TABLE IF EXISTS test_table")
        print("✅ Test table cleaned up")
        
        await conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Asyncpg connection failed: {e}")
        return False

def test_sqlalchemy_sync_connection():
    """Test synchronous SQLAlchemy connection."""
    print("\nTesting SQLAlchemy sync connection...")
    try:
        # Create engine with psycopg2
        sync_url = POSTGRES_URL.replace("postgresql://", "postgresql+psycopg2://")
        engine = create_engine(sync_url, echo=False)
        
        # Create session
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Basic query
        result = session.execute(text("SELECT version()"))
        version = result.scalar()
        print(f"✅ PostgreSQL Version: {version[:50]}...")
        
        # Test current database
        result = session.execute(text("SELECT current_database()"))
        db_name = result.scalar()
        print(f"✅ Connected to database: {db_name}")
        
        # Test current user
        result = session.execute(text("SELECT current_user"))
        user = result.scalar()
        print(f"✅ Connected as user: {user}")
        
        session.close()
        engine.dispose()
        return True
        
    except Exception as e:
        print(f"❌ SQLAlchemy sync connection failed: {e}")
        return False

async def test_sqlalchemy_async_connection():
    """Test asynchronous SQLAlchemy connection."""
    print("\nTesting SQLAlchemy async connection...")
    try:
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
        
        # Create async engine with asyncpg
        async_url = POSTGRES_URL.replace("postgresql://", "postgresql+asyncpg://")
        engine = create_async_engine(async_url, echo=False)
        
        # Create async session
        AsyncSessionLocal = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        
        async with AsyncSessionLocal() as session:
            # Basic query
            result = await session.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✅ PostgreSQL Version: {version[:50]}...")
            
            # Test current database
            result = await session.execute(text("SELECT current_database()"))
            db_name = result.scalar()
            print(f"✅ Connected to database: {db_name}")
            
            # Test current user
            result = await session.execute(text("SELECT current_user"))
            user = result.scalar()
            print(f"✅ Connected as user: {user}")
        
        await engine.dispose()
        return True
        
    except Exception as e:
        print(f"❌ SQLAlchemy async connection failed: {e}")
        return False

def test_database_extensions():
    """Test available database extensions."""
    print("\nTesting database extensions...")
    try:
        sync_url = POSTGRES_URL.replace("postgresql://", "postgresql+psycopg2://")
        engine = create_engine(sync_url, echo=False)
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Check available extensions
        result = session.execute(text("""
            SELECT extname, extversion 
            FROM pg_extension 
            ORDER BY extname
        """))
        
        extensions = result.fetchall()
        print("✅ Available extensions:")
        for ext_name, ext_version in extensions:
            print(f"   - {ext_name}: {ext_version}")
        
        # Check if vector extension is available
        result = session.execute(text("""
            SELECT extname FROM pg_extension WHERE extname = 'vector'
        """))
        vector_ext = result.fetchone()
        
        if vector_ext:
            print("✅ pgvector extension is available")
        else:
            print("⚠️  pgvector extension is not installed")
        
        session.close()
        engine.dispose()
        return True
        
    except Exception as e:
        print(f"❌ Extension check failed: {e}")
        return False

async def main():
    """Run all PostgreSQL tests."""
    if not POSTGRES_URL:
        print("DATABASE_URL is required to run PostgreSQL connection tests")
        return False

    print("🚀 DocuFusion PostgreSQL Basic Connection Tests")
    print("=" * 50)
    
    results = []
    
    # Test asyncpg connection
    result = await test_asyncpg_connection()
    results.append(("Asyncpg Connection", result))
    
    # Test SQLAlchemy sync
    result = test_sqlalchemy_sync_connection()
    results.append(("SQLAlchemy Sync", result))
    
    # Test SQLAlchemy async
    result = await test_sqlalchemy_async_connection()
    results.append(("SQLAlchemy Async", result))
    
    # Test extensions
    result = test_database_extensions()
    results.append(("Database Extensions", result))
    
    # Summary
    print("\n📊 Test Results Summary:")
    print("-" * 30)
    
    passed = 0
    for test_name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status} {test_name}")
        if success:
            passed += 1
    
    success_rate = (passed / len(results)) * 100
    print(f"\nSuccess Rate: {success_rate:.1f}% ({passed}/{len(results)})")
    
    if passed == len(results):
        print("\n🎉 All PostgreSQL connections are working!")
        print("✅ Ready for DocuFusion PostgreSQL integration")
    else:
        print(f"\n⚠️  {len(results) - passed} connection tests failed")
    
    return passed == len(results)

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)
