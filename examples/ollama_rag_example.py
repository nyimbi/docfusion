#!/usr/bin/env python3
"""
Ollama RAG Example

Demonstrates the RAG system using Ollama for local embeddings instead of OpenAI.
This provides better privacy, cost control, and offline capabilities.

Requirements:
- Ollama installed and running (https://ollama.ai)
- embedding model pulled (ollama pull nomic-embed-text)
- PostgreSQL database available

Run:
    ollama serve  # Start Ollama server
    ollama pull nomic-embed-text  # Pull embedding model
    python examples/ollama_rag_example.py
"""

import asyncio
import os
import tempfile
from pathlib import Path
from datetime import datetime

from docfusion.storage.rag import (
    RAGService, RAGConfiguration, create_rag_service
)
from docfusion.storage.rag_storage_service import (
    RAGStorageService, RAGStorageConfiguration
)


# Database configuration
DATABASE_URL = "postgresql://nyimbi:Abcd1234.@172.236.30.103:5432/docdb"


async def check_ollama_availability():
    """Check if Ollama is available and has the required model"""
    import aiohttp
    
    try:
        async with aiohttp.ClientSession() as session:
            # Check if Ollama is running
            async with session.get("http://localhost:11434/api/version") as response:
                if response.status != 200:
                    return False, "Ollama server not running"
            
            # Check if nomic-embed-text model is available
            async with session.get("http://localhost:11434/api/tags") as response:
                if response.status == 200:
                    data = await response.json()
                    models = [model["name"] for model in data.get("models", [])]
                    if not any("nomic-embed-text" in model for model in models):
                        return False, "nomic-embed-text model not found. Run: ollama pull nomic-embed-text"
                else:
                    return False, "Cannot check available models"
        
        return True, "Ollama is ready"
        
    except Exception as e:
        return False, f"Ollama not available: {e}"


async def demonstrate_ollama_rag_basic():
    """Demonstrate basic RAG functionality with Ollama"""
    print("=== Ollama RAG Basic Demonstration ===\n")
    
    # Check Ollama availability
    print("🔍 Checking Ollama availability...")
    available, message = await check_ollama_availability()
    
    if not available:
        print(f"❌ {message}")
        print("\nTo fix this:")
        print("1. Install Ollama: https://ollama.ai")
        print("2. Start Ollama: ollama serve")
        print("3. Pull embedding model: ollama pull nomic-embed-text")
        return
    
    print(f"✅ {message}\n")
    
    # Configure RAG system with Ollama
    print("🔧 Initializing RAG service with Ollama...")
    config = RAGConfiguration(
        connection_string=DATABASE_URL,
        schema_name="ollama_demo_rag",
        embedding_provider="ollama",
        ollama_model="nomic-embed-text",
        ollama_base_url="http://localhost:11434",
        chunk_size=800,
        chunk_overlap=150,
        default_similarity_threshold=0.7
    )
    
    service = RAGService(config)
    await service.initialize()
    print("✅ RAG service initialized with Ollama!\n")
    
    try:
        # Sample documents
        sample_documents = [
            {
                "title": "Local AI Models with Ollama",
                "content": """
                Ollama enables running large language models locally on your machine. It supports various models including Llama 2, Code Llama, and embedding models like nomic-embed-text. 
                
                Local AI provides several benefits: complete privacy since data never leaves your machine, no API costs, offline operation, and full control over the model. Ollama makes it easy to install, manage, and use these models through a simple API.
                
                For embedding use cases, nomic-embed-text provides high-quality text embeddings that can be used for semantic search, document similarity, and retrieval-augmented generation applications.
                """,
                "category": "ai",
                "tags": ["ollama", "local-ai", "embeddings"]
            },
            {
                "title": "Privacy-First Document Processing",
                "content": """
                Privacy-first document processing ensures that sensitive documents and data never leave your organization's infrastructure. By using local models and self-hosted solutions, companies can maintain complete control over their data.
                
                This approach is particularly important for industries handling sensitive information such as healthcare, finance, and legal services. Local processing eliminates concerns about data leakage, compliance violations, and unauthorized access.
                
                Tools like Ollama, local vector databases, and self-hosted RAG systems enable sophisticated document processing while maintaining strict privacy controls.
                """,
                "category": "privacy",
                "tags": ["privacy", "security", "local-processing"]
            },
            {
                "title": "Cost-Effective AI Solutions",
                "content": """
                Running AI models locally can provide significant cost savings compared to cloud-based API services. While cloud APIs charge per token or request, local models have a fixed infrastructure cost regardless of usage volume.
                
                For organizations with high AI usage, local deployment becomes cost-effective quickly. Additionally, local models eliminate the ongoing operational costs and provide predictable expense planning.
                
                The trade-offs include initial setup complexity and hardware requirements, but for many use cases, the cost benefits and added control justify the investment.
                """,
                "category": "cost",
                "tags": ["cost-savings", "economics", "local-deployment"]
            }
        ]
        
        # Add documents to RAG system
        print("📄 Adding sample documents to Ollama-powered RAG system...")
        document_ids = []
        
        for i, doc in enumerate(sample_documents):
            print(f"   Adding document {i+1}: {doc['title']}")
            doc_id = await service.add_document(**doc)
            
            if doc_id:
                document_ids.append(doc_id)
                print(f"   ✅ Document added with ID: {doc_id}")
            else:
                print(f"   ❌ Failed to add document: {doc['title']}")
        
        print(f"\n📊 Successfully added {len(document_ids)} documents\n")
        
        # Demonstrate semantic search
        print("🔍 Demonstrating Semantic Search with Ollama:")
        print("-" * 45)
        
        search_queries = [
            "How can I run AI models privately without using cloud services?",
            "What are the cost benefits of local AI deployment?",
            "Tell me about embedding models for document search",
            "How does Ollama help with privacy-first AI?"
        ]
        
        for query in search_queries:
            print(f"\n🔎 Query: {query}")
            
            search_result = await service.search(
                query=query,
                limit=2,
                similarity_threshold=0.5,
                include_context=True
            )
            
            print(f"   Found {len(search_result.results)} relevant chunks")
            print(f"   Search time: {search_result.search_time:.3f}s")
            print(f"   Embedding time: {search_result.embedding_time:.3f}s")
            
            for i, result in enumerate(search_result.results, 1):
                print(f"   [{i}] {result.document_title} (similarity: {result.similarity_score:.3f})")
                print(f"       {result.content[:120]}...")
            
            if search_result.context:
                print(f"   📝 Generated context length: {len(search_result.context)} characters")
        
        # Show system statistics
        print(f"\n\n📊 Ollama RAG System Statistics:")
        print("-" * 30)
        
        stats = await service.get_statistics()
        print(f"   📄 Total documents: {stats.total_documents}")
        print(f"   🧩 Total chunks: {stats.total_chunks}")
        print(f"   🔍 Total queries: {stats.total_queries}")
        print(f"   ⏱️  Average query time: {stats.avg_query_time:.3f}s")
        print(f"   📈 Average similarity: {stats.avg_similarity_score:.3f}")
        print(f"   💾 Embedding cache size: {stats.embedding_cache_size}")
        
        # Get embedding service stats
        embedding_stats = service.embedding_service.get_cache_stats()
        print(f"\n📊 Embedding Service Statistics:")
        print(f"   Provider: {embedding_stats['embedding_provider']}")
        print(f"   Model: {embedding_stats['embedding_model']}")
        print(f"   Dimensions: {embedding_stats['embedding_dimensions']}")
        print(f"   Ollama URL: {embedding_stats['ollama_base_url']}")
        print(f"   Cache size: {embedding_stats['cache_size']}")
        
    except Exception as e:
        print(f"❌ Error during demonstration: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Clean up
        print("\n🧹 Cleaning up test data...")
        for doc_id in document_ids:
            await service.delete_document(doc_id)
        
        await service.close()
        print("✅ Ollama RAG service closed successfully")


async def demonstrate_ollama_rag_storage_integration():
    """Demonstrate Ollama RAG integration with storage service"""
    print("\n\n=== Ollama RAG Storage Integration ===\n")
    
    # Check Ollama availability first
    available, message = await check_ollama_availability()
    if not available:
        print(f"❌ {message}")
        return
    
    # Create temporary storage directory
    with tempfile.TemporaryDirectory() as temp_dir:
        storage_path = Path(temp_dir) / "ollama_rag_demo"
        
        # Configure RAG storage service with Ollama
        print("🔧 Initializing RAG Storage Service with Ollama...")
        config = RAGStorageConfiguration(
            storage_root_path=storage_path,
            enable_rag=True,
            postgresql_connection_string=DATABASE_URL,
            embedding_provider="ollama",
            ollama_model="nomic-embed-text",
            ollama_base_url="http://localhost:11434",
            similarity_threshold=0.6,
            enable_hybrid_search=True
        )
        
        service = RAGStorageService(config)
        await service.initialize()
        print("✅ RAG Storage Service with Ollama initialized!\n")
        
        try:
            # Store document with both traditional and RAG indexing
            print("📄 Storing document with Ollama-powered hybrid indexing...")
            doc_id = await service.store_document(
                content="""This document demonstrates the integration of traditional file-based storage with local semantic search using Ollama embeddings. 
                
                Ollama provides privacy-first AI capabilities by running models locally, eliminating the need to send data to external services. This is particularly valuable for sensitive documents and organizations with strict data governance requirements.
                
                The hybrid approach combines the precision of traditional full-text search with the contextual understanding of semantic search powered by local embedding models.""",
                title="Ollama Hybrid Storage Demo",
                category="demo",
                tags=["ollama", "hybrid", "local-ai", "storage"],
                author="demo_system",
                enable_rag_indexing=True
            )
            
            if doc_id:
                print(f"   ✅ Document stored with ID: {doc_id}")
                
                # Demonstrate different search types
                print("\n🔍 Testing Different Search Types:")
                
                # Traditional search
                print("   📝 Traditional full-text search:")
                traditional_results = await service.search_documents(
                    query="storage capabilities local",
                    search_type="full_text",
                    limit=3
                )
                print(f"      Found: {len(traditional_results)} results")
                for result in traditional_results[:1]:
                    print(f"      - {result.title} (relevance: {result.relevance_score:.3f})")
                
                # Semantic search with Ollama
                print("   🧠 Semantic search with Ollama:")
                semantic_results = await service.search_documents(
                    query="privacy-focused document processing without cloud services",
                    search_type="semantic",
                    limit=3
                )
                print(f"      Found: {len(semantic_results)} results")
                for result in semantic_results[:1]:
                    print(f"      - {result.title} (similarity: {result.similarity_score:.3f})")
                
                # Hybrid search
                print("   🔀 Hybrid search (traditional + semantic):")
                hybrid_results = await service.search_documents(
                    query="local AI storage integration",
                    search_type="hybrid",
                    limit=3
                )
                print(f"      Found: {len(hybrid_results)} results")
                for result in hybrid_results[:1]:
                    print(f"      - {result.title} (combined score: {result.relevance_score:.3f})")
                
                # Get semantic context with Ollama
                print("\n   📖 Getting semantic context with Ollama:")
                context = await service.get_semantic_context(
                    query="benefits of local AI models for document processing",
                    max_results=2
                )
                
                if context:
                    print(f"      Generated context length: {len(context)} characters")
                    print(f"      Context preview: {context[:150]}...")
                else:
                    print("      No context generated")
                
                # Show integrated statistics
                print("\n📊 Ollama-Enhanced Storage Statistics:")
                stats = await service.get_storage_statistics()
                
                print(f"   Traditional storage:")
                print(f"     - Total documents: {stats.get('total_documents', 0)}")
                print(f"     - Search operations: {stats.get('search_operations', 0)}")
                
                if stats.get('rag_enabled'):
                    print(f"   Ollama RAG system:")
                    print(f"     - RAG documents: {stats.get('rag_total_documents', 0)}")
                    print(f"     - RAG chunks: {stats.get('rag_total_chunks', 0)}")
                    print(f"     - RAG queries: {stats.get('rag_total_queries', 0)}")
                    print(f"     - Provider: {stats.get('embedding_provider', 'unknown')}")
                
            else:
                print("   ❌ Failed to store document")
                
        except Exception as e:
            print(f"❌ Error during integration demonstration: {e}")
            import traceback
            traceback.print_exc()
        
        finally:
            await service.close()
            print("\n✅ Ollama RAG Storage Service closed successfully")


async def main():
    """Main demonstration function"""
    print("🚀 Ollama RAG System Demonstration\n")
    print("This demo shows how to use RAG with local Ollama models instead of OpenAI")
    print("Benefits: Privacy, No API costs, Offline operation, Data control")
    print("=" * 70)
    
    try:
        # Basic RAG demonstration
        await demonstrate_ollama_rag_basic()
        
        # RAG storage integration demonstration
        await demonstrate_ollama_rag_storage_integration()
        
        print("\n\n🎉 All Ollama demonstrations completed successfully!")
        print("\nThe Ollama RAG system provides:")
        print("  ✅ Privacy-first local embeddings")
        print("  ✅ No API costs or rate limits")
        print("  ✅ Offline semantic search capabilities")
        print("  ✅ Full control over embedding models")
        print("  ✅ Integration with traditional storage")
        print("  ✅ High-quality nomic-embed-text embeddings")
        print("  ✅ PostgreSQL vector storage with pgai")
        
        print(f"\nTo use Ollama RAG in your applications:")
        print(f"  1. Start Ollama: ollama serve")
        print(f"  2. Pull model: ollama pull nomic-embed-text")
        print(f"  3. Use provider='ollama' in RAG configurations")
        
    except Exception as e:
        print(f"\n❌ Demonstration failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())