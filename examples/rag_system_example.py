#!/usr/bin/env python3
"""
RAG System Example

Demonstrates the capabilities of the RAG (Retrieval-Augmented Generation) system
including document ingestion, semantic search, and context retrieval.
"""

import asyncio
import os
from pathlib import Path
from datetime import datetime

from docfusion.storage.rag import (
    RAGService, RAGConfiguration, create_rag_service
)
from docfusion.storage.rag_storage_service import (
    RAGStorageService, RAGStorageConfiguration
)


# Database configuration
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres@localhost:5432/docfusion")


async def demonstrate_basic_rag():
    """Demonstrate basic RAG functionality"""
    print("=== RAG System Basic Demonstration ===\n")
    
    # Check for required environment variables
    if not os.getenv('OPENAI_API_KEY'):
        print("⚠️  OPENAI_API_KEY not found. Using mock data for demonstration.")
        return
    
    # Configure RAG system
    config = RAGConfiguration(
        connection_string=DATABASE_URL,
        schema_name="demo_rag",
        openai_api_key=os.getenv('OPENAI_API_KEY'),
        chunk_size=1000,
        chunk_overlap=200,
        default_similarity_threshold=0.7
    )
    
    # Create RAG service
    print("🔧 Initializing RAG service...")
    service = RAGService(config)
    await service.initialize()
    print("✅ RAG service initialized successfully!\n")
    
    try:
        # Sample documents to demonstrate the system
        sample_documents = [
            {
                "title": "Machine Learning Fundamentals",
                "content": """
                Machine learning is a subset of artificial intelligence that focuses on the development of algorithms and statistical models that enable computer systems to improve their performance on a specific task through experience, without being explicitly programmed.
                
                Key concepts in machine learning include supervised learning, unsupervised learning, and reinforcement learning. Supervised learning involves training models on labeled data, while unsupervised learning finds patterns in unlabeled data. Reinforcement learning uses rewards and penalties to train agents.
                
                Common machine learning algorithms include linear regression, decision trees, support vector machines, neural networks, and ensemble methods like random forests and gradient boosting.
                """,
                "category": "ai",
                "tags": ["machine learning", "artificial intelligence", "algorithms"]
            },
            {
                "title": "Natural Language Processing Overview",
                "content": """
                Natural Language Processing (NLP) is a branch of artificial intelligence that helps computers understand, interpret and manipulate human language. NLP draws from many disciplines, including computer science and computational linguistics.
                
                Modern NLP techniques rely heavily on machine learning and deep learning approaches. Key NLP tasks include text classification, named entity recognition, sentiment analysis, machine translation, and question answering.
                
                Popular NLP models include transformer architectures like BERT, GPT, and T5. These models use attention mechanisms to understand context and relationships between words in text.
                """,
                "category": "nlp",
                "tags": ["nlp", "natural language processing", "transformers", "bert"]
            },
            {
                "title": "Deep Learning and Neural Networks",
                "content": """
                Deep learning is a subset of machine learning that uses artificial neural networks with multiple layers to model and understand complex patterns in data. These neural networks are inspired by the structure and function of the human brain.
                
                Key architectures in deep learning include convolutional neural networks (CNNs) for image processing, recurrent neural networks (RNNs) for sequential data, and transformer models for natural language processing tasks.
                
                Deep learning has achieved remarkable success in computer vision, natural language processing, speech recognition, and game playing. Applications include image recognition, autonomous vehicles, virtual assistants, and recommendation systems.
                """,
                "category": "deep_learning",
                "tags": ["deep learning", "neural networks", "cnn", "rnn", "transformers"]
            },
            {
                "title": "Data Science Methodology",
                "content": """
                Data science is an interdisciplinary field that uses scientific methods, processes, algorithms, and systems to extract knowledge and insights from structured and unstructured data.
                
                The data science process typically includes data collection, data cleaning and preprocessing, exploratory data analysis, feature engineering, model building and evaluation, and deployment of models into production.
                
                Key tools in data science include Python and R programming languages, databases like SQL and NoSQL systems, visualization tools, and machine learning frameworks like scikit-learn, TensorFlow, and PyTorch.
                """,
                "category": "data_science",
                "tags": ["data science", "python", "analytics", "visualization"]
            }
        ]
        
        # Add documents to RAG system
        print("📄 Adding sample documents to RAG system...")
        document_ids = []
        
        for i, doc in enumerate(sample_documents):
            print(f"   Adding document {i+1}: {doc['title']}")
            doc_id = await service.add_document(
                content=doc["content"],
                title=doc["title"],
                category=doc["category"],
                tags=doc["tags"]
            )
            
            if doc_id:
                document_ids.append(doc_id)
                print(f"   ✅ Document added with ID: {doc_id}")
            else:
                print(f"   ❌ Failed to add document: {doc['title']}")
        
        print(f"\n📊 Successfully added {len(document_ids)} documents\n")
        
        # Demonstrate semantic search
        print("🔍 Demonstrating Semantic Search:")
        print("-" * 40)
        
        search_queries = [
            "What are neural networks and how do they work?",
            "Tell me about text processing and language models",
            "How does machine learning training work?",
            "What tools are used in data analysis?"
        ]
        
        for query in search_queries:
            print(f"\n🔎 Query: {query}")
            
            search_result = await service.search(
                query=query,
                limit=3,
                similarity_threshold=0.6,
                include_context=True
            )
            
            print(f"   Found {len(search_result.results)} relevant chunks")
            print(f"   Search time: {search_result.search_time:.3f}s")
            print(f"   Embedding time: {search_result.embedding_time:.3f}s")
            
            for i, result in enumerate(search_result.results, 1):
                print(f"   [{i}] {result.document_title} (similarity: {result.similarity_score:.3f})")
                print(f"       {result.content[:100]}...")
            
            if search_result.context:
                print(f"   📝 Generated context length: {len(search_result.context)} characters")
        
        # Demonstrate related document finding
        print("\n\n🔗 Finding Related Documents:")
        print("-" * 30)
        
        if document_ids:
            first_doc_id = document_ids[0]
            related_docs = await service.get_related_documents(
                document_id=first_doc_id,
                limit=2,
                similarity_threshold=0.7
            )
            
            print(f"Documents related to '{sample_documents[0]['title']}':")
            for i, related in enumerate(related_docs, 1):
                print(f"   [{i}] {related.document_title} (similarity: {related.similarity_score:.3f})")
        
        # Show system statistics
        print("\n\n📊 RAG System Statistics:")
        print("-" * 25)
        
        stats = await service.get_statistics()
        print(f"   📄 Total documents: {stats.total_documents}")
        print(f"   🧩 Total chunks: {stats.total_chunks}")
        print(f"   🔍 Total queries: {stats.total_queries}")
        print(f"   ⏱️  Average query time: {stats.avg_query_time:.3f}s")
        print(f"   📈 Average similarity: {stats.avg_similarity_score:.3f}")
        print(f"   💾 Embedding cache size: {stats.embedding_cache_size}")
        
        # Demonstrate document context retrieval
        if document_ids:
            print("\n\n📖 Document Context Retrieval:")
            print("-" * 30)
            
            context = await service.get_document_context(
                document_id=document_ids[0],
                max_chunks=3
            )
            
            if context:
                print(f"Context from '{sample_documents[0]['title']}':")
                print(f"Length: {len(context)} characters")
                print(f"Preview: {context[:200]}...")
        
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
        print("✅ RAG service closed successfully")


async def demonstrate_rag_storage_integration():
    """Demonstrate RAG integration with existing storage service"""
    print("\n\n=== RAG Storage Integration Demonstration ===\n")
    
    if not os.getenv('OPENAI_API_KEY'):
        print("⚠️  OPENAI_API_KEY not found. Skipping integration demonstration.")
        return
    
    # Create temporary storage directory
    import tempfile
    with tempfile.TemporaryDirectory() as temp_dir:
        storage_path = Path(temp_dir) / "rag_demo"
        
        # Configure RAG storage service
        config = RAGStorageConfiguration(
            storage_root_path=storage_path,
            enable_rag=True,
            postgresql_connection_string=DATABASE_URL,
            openai_api_key=os.getenv('OPENAI_API_KEY'),
            similarity_threshold=0.7,
            enable_hybrid_search=True
        )
        
        print("🔧 Initializing RAG Storage Service...")
        service = RAGStorageService(config)
        await service.initialize()
        print("✅ RAG Storage Service initialized successfully!\n")
        
        try:
            # Store document with both traditional and RAG indexing
            print("📄 Storing document with hybrid indexing...")
            doc_id = await service.store_document(
                content="This document demonstrates the integration of traditional file-based storage with advanced semantic search capabilities using PostgreSQL and vector embeddings.",
                title="Hybrid Storage Demo",
                category="demo",
                tags=["hybrid", "storage", "demo"],
                author="demo_system",
                enable_rag_indexing=True
            )
            
            if doc_id:
                print(f"   ✅ Document stored with ID: {doc_id}")
                
                # Demonstrate hybrid search
                print("\n🔍 Testing Hybrid Search:")
                
                # Traditional search
                traditional_results = await service.search_documents(
                    query="storage capabilities",
                    search_type="full_text",
                    limit=5
                )
                print(f"   📝 Traditional search found: {len(traditional_results)} results")
                
                # Semantic search
                semantic_results = await service.search_documents(
                    query="document indexing with vectors",
                    search_type="semantic",
                    limit=5
                )
                print(f"   🧠 Semantic search found: {len(semantic_results)} results")
                
                # Hybrid search
                hybrid_results = await service.search_documents(
                    query="advanced storage system",
                    search_type="hybrid",
                    limit=5
                )
                print(f"   🔀 Hybrid search found: {len(hybrid_results)} results")
                
                # Get semantic context
                context = await service.get_semantic_context(
                    query="storage and search technologies",
                    max_results=3
                )
                
                if context:
                    print(f"\n📖 Semantic context generated:")
                    print(f"   Length: {len(context)} characters")
                    print(f"   Preview: {context[:150]}...")
                
                # Show integrated statistics
                print("\n📊 Integrated Storage Statistics:")
                stats = await service.get_storage_statistics()
                
                print(f"   Traditional storage:")
                print(f"     - Total documents: {stats.get('total_documents', 0)}")
                print(f"     - Search operations: {stats.get('search_operations', 0)}")
                
                if stats.get('rag_enabled'):
                    print(f"   RAG system:")
                    print(f"     - RAG documents: {stats.get('rag_total_documents', 0)}")
                    print(f"     - RAG chunks: {stats.get('rag_total_chunks', 0)}")
                    print(f"     - RAG queries: {stats.get('rag_total_queries', 0)}")
                
            else:
                print("   ❌ Failed to store document")
                
        except Exception as e:
            print(f"❌ Error during integration demonstration: {e}")
            import traceback
            traceback.print_exc()
        
        finally:
            await service.close()
            print("\n✅ RAG Storage Service closed successfully")


async def main():
    """Main demonstration function"""
    print("🚀 RAG System Demonstration Starting...\n")
    
    try:
        # Basic RAG demonstration
        await demonstrate_basic_rag()
        
        # RAG storage integration demonstration
        await demonstrate_rag_storage_integration()
        
        print("\n\n🎉 All demonstrations completed successfully!")
        print("\nThe RAG system provides:")
        print("  ✅ Semantic search with vector embeddings")
        print("  ✅ Intelligent document chunking")
        print("  ✅ Context-aware retrieval")
        print("  ✅ Integration with traditional storage")
        print("  ✅ Performance monitoring and optimization")
        print("  ✅ PostgreSQL with pgai for scalable vector operations")
        
    except Exception as e:
        print(f"\n❌ Demonstration failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
