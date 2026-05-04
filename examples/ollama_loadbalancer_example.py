#!/usr/bin/env python3
"""
Ollama Load Balancer Example

Demonstrates load balancing across multiple Ollama instances for high-availability
and improved performance in production deployments.

Setup:
1. Start multiple Ollama instances on different ports:
   ollama serve --host localhost --port 11434
   ollama serve --host localhost --port 11435  
   ollama serve --host localhost --port 11436

2. Pull the embedding model on each instance:
   ollama pull nomic-embed-text

3. Run this example to see load balancing in action
"""

import asyncio
import os
import time
from pathlib import Path
from datetime import datetime

from docfusion.storage.rag import (
    RAGConfiguration, RAGService, EmbeddingConfiguration, EmbeddingService
)
from docfusion.storage.rag.ollama_loadbalancer import (
    OllamaLoadBalancer, LoadBalancingStrategy, create_load_balanced_embedding_service
)


async def demonstrate_basic_load_balancing():
    """Demonstrate basic load balancing functionality"""
    print("=== Basic Ollama Load Balancing Demo ===\n")
    
    # Configure multiple Ollama instances
    ollama_instances = [
        "http://localhost:11434",
        "http://localhost:11435", 
        "http://localhost:11436"
    ]
    
    print(f"🔧 Setting up load balancer with {len(ollama_instances)} instances:")
    for i, instance in enumerate(ollama_instances, 1):
        print(f"   {i}. {instance}")
    
    try:
        # Create load-balanced embedding service
        load_balancer = await create_load_balanced_embedding_service(
            instances=ollama_instances,
            strategy=LoadBalancingStrategy.HEALTH_WEIGHTED,
            health_check_interval=10,
            max_retries=2
        )
        
        print("✅ Load balancer initialized successfully\n")
        
        # Check initial status
        status = load_balancer.get_status()
        print(f"📊 Load Balancer Status:")
        print(f"   Strategy: {status['strategy']}")
        print(f"   Total Instances: {status['total_instances']}")
        print(f"   Healthy Instances: {status['healthy_instances']}")
        print(f"   Success Rate: {status['success_rate']:.1%}")
        
        if status['healthy_instances'] == 0:
            print("\n❌ No healthy instances available!")
            print("Make sure Ollama is running on the configured ports with nomic-embed-text model")
            return
        
        # Generate embeddings to demonstrate load balancing
        print(f"\n🔍 Generating embeddings across multiple instances...")
        
        test_texts = [
            "Load balancing distributes requests across multiple servers",
            "High availability ensures service continues even if some instances fail",
            "Ollama provides local AI model serving capabilities",
            "Embedding models convert text into vector representations",
            "Production deployments require redundancy and failover mechanisms",
            "Semantic search uses embeddings to find contextually similar content",
            "Vector databases store high-dimensional embedding vectors efficiently",
            "RAG systems combine retrieval with generation for better responses"
        ]
        
        start_time = time.time()
        
        for i, text in enumerate(test_texts, 1):
            try:
                result = await load_balancer.generate_embedding("nomic-embed-text", text)
                
                if result:
                    print(f"   [{i}] ✅ Generated via {result['instance']} - {result['dimensions']}D")
                else:
                    print(f"   [{i}] ❌ Failed to generate embedding")
            
            except Exception as e:
                print(f"   [{i}] ❌ Error: {e}")
        
        total_time = time.time() - start_time
        print(f"\n📊 Generated {len(test_texts)} embeddings in {total_time:.2f}s")
        
        # Show load balancer metrics
        print(f"\n📈 Load Balancer Metrics:")
        metrics = load_balancer.get_metrics()
        global_metrics = metrics['global_metrics']
        
        print(f"   Total Requests: {global_metrics['total_requests']}")
        print(f"   Success Rate: {global_metrics['success_rate']:.1%}")
        print(f"   Request Rate: {global_metrics['request_rate_5min']:.2f}/sec")
        
        print(f"\n🎯 Instance Performance:")
        for instance, instance_metrics in metrics['instance_metrics'].items():
            if instance_metrics['total_requests'] > 0:
                print(f"   {instance}:")
                print(f"     Requests: {instance_metrics['total_requests']}")
                print(f"     Success Rate: {instance_metrics['success_rate']:.1%}")
                print(f"     Avg Response: {instance_metrics['avg_response_time']:.3f}s")
                print(f"     Load Score: {instance_metrics.get('load_score', 'N/A')}")
        
        await load_balancer.stop()
    
    except Exception as e:
        print(f"❌ Load balancer demo failed: {e}")


async def demonstrate_load_balancing_strategies():
    """Demonstrate different load balancing strategies"""
    print("\n\n=== Load Balancing Strategies Demo ===\n")
    
    ollama_instances = [
        "http://localhost:11434",
        "http://localhost:11435"
    ]
    
    strategies = [
        LoadBalancingStrategy.ROUND_ROBIN,
        LoadBalancingStrategy.RANDOM,
        LoadBalancingStrategy.HEALTH_WEIGHTED
    ]
    
    test_text = "This is a test for load balancing strategies"
    
    for strategy in strategies:
        print(f"🎯 Testing {strategy.value.upper()} strategy:")
        
        try:
            load_balancer = await create_load_balanced_embedding_service(
                instances=ollama_instances,
                strategy=strategy,
                health_check_interval=30
            )
            
            # Generate several embeddings to see distribution
            instance_usage = {}
            
            for i in range(6):
                result = await load_balancer.generate_embedding("nomic-embed-text", f"{test_text} {i}")
                
                if result:
                    instance = result['instance']
                    instance_usage[instance] = instance_usage.get(instance, 0) + 1
                    print(f"   Request {i+1}: {instance}")
            
            # Show distribution
            print(f"   Distribution: {instance_usage}")
            
            await load_balancer.stop()
            
        except Exception as e:
            print(f"   ❌ Strategy {strategy.value} failed: {e}")
        
        print()


async def demonstrate_failover():
    """Demonstrate failover behavior"""
    print("=== Failover Demonstration ===\n")
    
    # Include one non-existent instance to simulate failure
    ollama_instances = [
        "http://localhost:11434",
        "http://localhost:11435",
        "http://localhost:99999"  # This will fail
    ]
    
    print(f"🔧 Setting up load balancer with one failing instance:")
    for instance in ollama_instances:
        print(f"   - {instance}")
    
    try:
        load_balancer = await create_load_balanced_embedding_service(
            instances=ollama_instances,
            strategy=LoadBalancingStrategy.HEALTH_WEIGHTED,
            health_check_interval=5,
            max_retries=2,
            enable_failover=True
        )
        
        # Wait for health checks to complete
        print("\n⏳ Waiting for health checks...")
        await asyncio.sleep(6)
        
        status = load_balancer.get_status()
        print(f"\n📊 Failover Status:")
        print(f"   Total Instances: {status['total_instances']}")
        print(f"   Healthy Instances: {status['healthy_instances']}")
        print(f"   Circuit Breakers Active: {status['active_circuit_breakers']}")
        
        # Show which instances are healthy
        for instance in status['instances']:
            health_status = "✅ Healthy" if instance['healthy'] else "❌ Unhealthy"
            breaker_status = "🔴 Circuit Open" if instance['circuit_breaker'] else ""
            print(f"   {instance['url']}: {health_status} {breaker_status}")
        
        # Generate embeddings - should only use healthy instances
        print(f"\n🔍 Testing failover behavior:")
        
        for i in range(5):
            try:
                result = await load_balancer.generate_embedding("nomic-embed-text", f"Failover test {i}")
                
                if result:
                    print(f"   [{i+1}] ✅ Successfully routed to {result['instance']}")
                else:
                    print(f"   [{i+1}] ❌ No healthy instances available")
            
            except Exception as e:
                print(f"   [{i+1}] ❌ Error: {e}")
        
        await load_balancer.stop()
        
    except Exception as e:
        print(f"❌ Failover demo failed: {e}")


async def demonstrate_rag_with_load_balancing():
    """Demonstrate RAG system with load-balanced Ollama"""
    print("\n\n=== RAG with Load Balancing Demo ===\n")
    
    # Configure RAG with load-balanced Ollama
    rag_config = RAGConfiguration(
        connection_string=os.environ.get("DATABASE_URL", "postgresql://postgres@localhost:5432/docfusion"),
        schema_name="loadbalancer_demo_rag",
        embedding_provider="ollama",
        
        # Load balancing configuration
        ollama_instances=[
            "http://localhost:11434",
            "http://localhost:11435"
        ],
        load_balancing_strategy="health_weighted",
        enable_load_balancing=True,
        
        chunk_size=600,
        chunk_overlap=100
    )
    
    # Create embedding service with load balancing
    embedding_config = EmbeddingConfiguration(
        provider="ollama",
        ollama_model="nomic-embed-text",
        ollama_instances=rag_config.ollama_instances,
        load_balancing_strategy=rag_config.load_balancing_strategy,
        enable_load_balancing=rag_config.enable_load_balancing,
        max_concurrent_requests=5
    )
    
    embedding_service = EmbeddingService(embedding_config)
    
    try:
        print("🔧 Initializing RAG service with load-balanced embeddings...")
        
        # Check if load balancer was initialized
        if hasattr(embedding_service, 'load_balancer') and embedding_service.load_balancer:
            print("✅ Load balancer initialized in embedding service")
            
            # Get load balancer status
            status = embedding_service.load_balancer.get_status()
            print(f"   Healthy instances: {status['healthy_instances']}/{status['total_instances']}")
            
            if status['healthy_instances'] > 0:
                print(f"\n📄 Testing document embedding with load balancing...")
                
                # Create a test document
                from docfusion.storage.rag.database import RAGDocument
                
                test_doc = RAGDocument(
                    document_id="lb_test_1",
                    title="Load Balancing Test Document",
                    content="""Load balancing is a critical technique for distributing workloads across multiple computing resources. In the context of AI and machine learning applications, load balancing helps ensure high availability and optimal performance when serving models at scale.

When deploying embedding models like those provided by Ollama, load balancing becomes essential for production environments. Multiple model instances can handle concurrent requests, reducing latency and improving throughput. Health checks ensure that only responsive instances receive traffic, while automatic failover maintains service availability even when individual instances fail.

This document demonstrates how load balancing integrates seamlessly with RAG (Retrieval-Augmented Generation) systems, enabling scalable and reliable semantic search capabilities."""
                )
                
                # Process document with load-balanced embeddings
                start_time = time.time()
                chunks = await embedding_service.process_document(test_doc)
                processing_time = time.time() - start_time
                
                print(f"✅ Document processed successfully:")
                print(f"   Chunks created: {len(chunks)}")
                print(f"   Processing time: {processing_time:.2f}s")
                print(f"   Load balancing: {'✅ Active' if embedding_service.load_balancer else '❌ Inactive'}")
                
                # Show load balancer metrics
                if embedding_service.load_balancer:
                    metrics = embedding_service.load_balancer.get_metrics()
                    global_metrics = metrics['global_metrics']
                    
                    print(f"\n📊 Load Balancer Usage:")
                    print(f"   Total requests: {global_metrics['total_requests']}")
                    print(f"   Success rate: {global_metrics['success_rate']:.1%}")
                    
                    for instance_url, instance_metrics in metrics['instance_metrics'].items():
                        if instance_metrics['total_requests'] > 0:
                            print(f"   {instance_url}: {instance_metrics['total_requests']} requests")
            
            else:
                print("❌ No healthy Ollama instances available for load balancing")
        
        else:
            print("⚠️ Load balancing not active - using single instance")
    
    except Exception as e:
        print(f"❌ RAG load balancing demo failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        await embedding_service.close()


async def main():
    """Main demonstration function"""
    print("🚀 Ollama Load Balancer Demonstration")
    print("=" * 60)
    print("This demo requires multiple Ollama instances running")
    print("Setup instructions:")
    print("1. ollama serve --host localhost --port 11434")
    print("2. ollama serve --host localhost --port 11435")
    print("3. ollama serve --host localhost --port 11436")
    print("4. ollama pull nomic-embed-text (on each instance)")
    print("=" * 60)
    
    try:
        # Basic load balancing
        await demonstrate_basic_load_balancing()
        
        # Different strategies
        await demonstrate_load_balancing_strategies()
        
        # Failover behavior
        await demonstrate_failover()
        
        # RAG integration
        await demonstrate_rag_with_load_balancing()
        
        print(f"\n\n🎉 Load balancing demonstrations completed!")
        print(f"\nLoad balancing provides:")
        print(f"  ✅ High availability through redundancy")
        print(f"  ✅ Improved performance through distribution")
        print(f"  ✅ Automatic failover and health monitoring")
        print(f"  ✅ Multiple load balancing strategies")
        print(f"  ✅ Circuit breaker pattern for resilience")
        print(f"  ✅ Real-time metrics and monitoring")
    
    except KeyboardInterrupt:
        print(f"\n🛑 Demo interrupted by user")
    
    except Exception as e:
        print(f"\n❌ Demo failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
