#!/usr/bin/env python3
"""
RAG + DocumentEngine Integration Example

Demonstrates the complete integration of the RAG system with the DocumentEngine
for enhanced document generation with semantic content retrieval and intelligent
content recommendations.
"""

import asyncio
import os
import tempfile
from pathlib import Path
from datetime import datetime

from docfusion.document_engine.document_engine import (
    DocumentEngine, DocumentGenerationRequest, DocumentGenerationConfiguration
)
from docfusion.storage.rag_storage_service import (
    RAGStorageService, RAGStorageConfiguration
)


# Database configuration
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres@localhost:5432/docfusion")


class RAGEnhancedDocumentEngine:
    """DocumentEngine enhanced with RAG capabilities"""
    
    def __init__(
        self,
        storage_path: Path,
        postgresql_connection_string: str,
        openai_api_key: str = None
    ):
        self.storage_path = storage_path
        self.postgresql_connection_string = postgresql_connection_string
        self.openai_api_key = openai_api_key or os.getenv('OPENAI_API_KEY')
        
        # Initialize components
        self.rag_storage_service = None
        self.document_engine = None
        
    async def initialize(self):
        """Initialize RAG-enhanced document engine"""
        print("🔧 Initializing RAG-Enhanced Document Engine...")
        
        # Create RAG storage service
        rag_config = RAGStorageConfiguration(
            storage_root_path=self.storage_path,
            enable_rag=True,
            postgresql_connection_string=self.postgresql_connection_string,
            openai_api_key=self.openai_api_key,
            similarity_threshold=0.7,
            enable_hybrid_search=True,
            chunk_size=1000,
            chunk_overlap=200
        )
        
        self.rag_storage_service = RAGStorageService(rag_config)
        await self.rag_storage_service.initialize()
        
        # Create document engine with RAG storage
        engine_config = DocumentGenerationConfiguration(
            enable_storage=True,
            storage_root_path=str(self.storage_path),
            output_formats=["html"],
            enable_accessibility=True,
            enable_brand_compliance=False  # Simplify for demo
        )
        
        self.document_engine = DocumentEngine(
            config=engine_config,
            enable_logging=True,
            storage_service=self.rag_storage_service  # Use RAG storage service
        )
        
        print("✅ RAG-Enhanced Document Engine initialized successfully!")
    
    async def add_knowledge_base_documents(self):
        """Add knowledge base documents to the RAG system"""
        print("\n📚 Building Knowledge Base...")
        
        knowledge_documents = [
            {
                "title": "Best Practices for Technical Proposals",
                "content": """
                Technical proposals should follow a structured approach to clearly communicate complex ideas to stakeholders. Key elements include:
                
                1. Executive Summary: Provide a high-level overview that highlights the main benefits and recommendations.
                2. Technical Approach: Detail the methodology, technologies, and implementation strategy.
                3. Risk Assessment: Identify potential challenges and mitigation strategies.
                4. Timeline and Milestones: Present a realistic project schedule with key deliverables.
                5. Budget and Resources: Provide detailed cost breakdown and resource requirements.
                
                Best practices include using clear, non-technical language where possible, including visual aids like diagrams and charts, and ensuring all sections support the main value proposition.
                """,
                "category": "proposal_guidance",
                "tags": ["technical proposals", "best practices", "structure"]
            },
            {
                "title": "Modern Software Architecture Principles",
                "content": """
                Modern software architecture emphasizes scalability, maintainability, and resilience. Key principles include:
                
                Microservices Architecture: Breaking applications into small, independent services that can be developed, deployed, and scaled separately.
                
                Cloud-Native Design: Leveraging cloud platforms for automatic scaling, managed services, and global distribution.
                
                API-First Development: Designing APIs before implementation to ensure proper service integration and future extensibility.
                
                DevOps Integration: Implementing continuous integration/continuous deployment (CI/CD) pipelines for reliable software delivery.
                
                Security by Design: Building security considerations into every layer of the architecture from the ground up.
                """,
                "category": "architecture",
                "tags": ["software architecture", "microservices", "cloud-native", "devops"]
            },
            {
                "title": "Data Science Project Methodology",
                "content": """
                Successful data science projects follow a structured methodology that ensures reliable and actionable results:
                
                1. Problem Definition: Clearly define the business problem and success criteria.
                2. Data Collection: Identify and gather relevant data sources, ensuring data quality and completeness.
                3. Exploratory Data Analysis: Understand data patterns, distributions, and relationships.
                4. Feature Engineering: Create and select features that best represent the underlying patterns.
                5. Model Development: Build and train machine learning models using appropriate algorithms.
                6. Model Evaluation: Assess model performance using relevant metrics and validation techniques.
                7. Deployment and Monitoring: Deploy models to production and monitor their performance over time.
                
                Key success factors include stakeholder involvement, iterative development, and clear communication of results and limitations.
                """,
                "category": "data_science",
                "tags": ["data science", "methodology", "machine learning", "analytics"]
            },
            {
                "title": "Agile Project Management Essentials",
                "content": """
                Agile project management emphasizes flexibility, collaboration, and continuous improvement. Core components include:
                
                Sprint Planning: Regular planning sessions to define work for upcoming iterations.
                Daily Standups: Brief daily meetings to coordinate work and identify blockers.
                Sprint Reviews: Demonstrations of completed work to stakeholders for feedback.
                Retrospectives: Team reflection sessions to identify improvements for future sprints.
                
                Key roles include Product Owner (defines requirements), Scrum Master (facilitates process), and Development Team (implements solutions).
                
                Success metrics include velocity (work completed per sprint), burn-down charts (work remaining), and stakeholder satisfaction.
                """,
                "category": "project_management",
                "tags": ["agile", "scrum", "project management", "sprints"]
            }
        ]
        
        doc_ids = []
        for doc in knowledge_documents:
            print(f"   📄 Adding: {doc['title']}")
            doc_id = await self.rag_storage_service.store_document(
                content=doc["content"],
                title=doc["title"],
                category=doc["category"],
                tags=doc["tags"],
                author="knowledge_base",
                enable_rag_indexing=True
            )
            
            if doc_id:
                doc_ids.append(doc_id)
                print(f"      ✅ Added with ID: {doc_id}")
            else:
                print(f"      ❌ Failed to add document")
        
        print(f"\n📊 Knowledge base built with {len(doc_ids)} documents")
        return doc_ids
    
    async def generate_enhanced_document(self, request_type: str, context: str):
        """Generate document with RAG-enhanced content"""
        print(f"\n📝 Generating {request_type} document with RAG enhancement...")
        
        # Get semantic context and recommendations
        print("🧠 Retrieving semantic context...")
        semantic_context = await self.rag_storage_service.get_semantic_context(
            query=context,
            max_results=3,
            similarity_threshold=0.6
        )
        
        # Get content recommendations
        print("💡 Getting content recommendations...")
        recommendations = await self.rag_storage_service.get_content_recommendations(
            context=context,
            content_type="both",
            limit=5,
            use_semantic_search=True
        )
        
        # Build content sources from semantic context and recommendations
        content_sources = [
            {"content": f"Context: {context}", "type": "user_request"}
        ]
        
        if semantic_context:
            # Extract key points from semantic context
            context_snippets = semantic_context.split('\n\n---\n\n')[:2]  # Take first 2 contexts
            for i, snippet in enumerate(context_snippets):
                content_sources.append({
                    "content": snippet,
                    "type": "semantic_context",
                    "source": "rag_system",
                    "relevance": "high"
                })
        
        # Add recommendations as content sources
        for rec in recommendations[:3]:  # Take top 3 recommendations
            content_sources.append({
                "content": getattr(rec, 'content', str(rec)),
                "type": "recommendation",
                "source": "rag_system",
                "title": getattr(rec, 'title', 'Recommendation'),
                "relevance_score": getattr(rec, 'relevance_score', 0.5)
            })
        
        # Create document generation request
        request = DocumentGenerationRequest(
            content_sources=content_sources,
            content_structure={
                "title": f"RAG-Enhanced {request_type}",
                "sections": [
                    {"title": "Overview", "content": context},
                    {"title": "Analysis", "content": "RAG-enhanced analysis"},
                    {"title": "Recommendations", "content": "AI-powered recommendations"}
                ]
            }
        )
        
        request.generation_config.document_title = f"RAG-Enhanced {request_type}"
        request.generation_config.document_type = request_type.lower()
        
        # Generate document
        print("🎯 Generating document with enhanced content...")
        result = await self.document_engine.generate_document(request)
        
        if result.generation_successful:
            print(f"✅ Document generated successfully!")
            print(f"   📄 Document ID: {result.request_id}")
            print(f"   ⏱️  Processing time: {result.processing_time:.2f}s")
            print(f"   📊 Quality score: {result.overall_quality_score:.2f}")
            print(f"   🔧 Content sources used: {len(content_sources)}")
            print(f"   🧠 Semantic context length: {len(semantic_context) if semantic_context else 0} chars")
            print(f"   💡 Recommendations used: {len(recommendations)}")
            
            return result
        else:
            print("❌ Document generation failed")
            print(f"   Errors: {result.errors}")
            return None
    
    async def demonstrate_semantic_search(self):
        """Demonstrate semantic search capabilities"""
        print("\n🔍 Demonstrating Semantic Search Capabilities...")
        
        search_queries = [
            "How to structure a technical proposal for software architecture?",
            "What are the key steps in a data science project?",
            "Best practices for agile project management"
        ]
        
        for query in search_queries:
            print(f"\n🔎 Query: {query}")
            
            # Perform hybrid search
            results = await self.rag_storage_service.search_documents(
                query=query,
                search_type="hybrid",
                limit=3
            )
            
            print(f"   Found {len(results)} relevant results:")
            for i, result in enumerate(results, 1):
                print(f"   [{i}] {result.title}")
                print(f"       Relevance: {result.relevance_score:.3f}")
                print(f"       Source: {result.source}")
                print(f"       Match type: {result.match_type}")
                if result.similarity_score:
                    print(f"       Similarity: {result.similarity_score:.3f}")
    
    async def close(self):
        """Close all services"""
        if self.rag_storage_service:
            await self.rag_storage_service.close()
        print("✅ RAG-Enhanced Document Engine closed")


async def main():
    """Main demonstration function"""
    print("🚀 RAG + DocumentEngine Integration Demo")
    print("=" * 50)
    
    if not os.getenv('OPENAI_API_KEY'):
        print("⚠️  OPENAI_API_KEY not found. Please set your OpenAI API key.")
        return
    
    # Create temporary storage
    with tempfile.TemporaryDirectory() as temp_dir:
        storage_path = Path(temp_dir) / "rag_engine_demo"
        
        # Initialize RAG-enhanced document engine
        engine = RAGEnhancedDocumentEngine(
            storage_path=storage_path,
            postgresql_connection_string=DATABASE_URL
        )
        
        try:
            await engine.initialize()
            
            # Build knowledge base
            knowledge_doc_ids = await engine.add_knowledge_base_documents()
            
            # Demonstrate semantic search
            await engine.demonstrate_semantic_search()
            
            # Generate enhanced documents
            document_requests = [
                {
                    "type": "Technical Proposal",
                    "context": "We need to build a scalable microservices architecture for a fintech application with real-time data processing, secure API endpoints, and cloud-native deployment capabilities."
                },
                {
                    "type": "Project Plan",
                    "context": "Create an agile development plan for a 6-month data science project involving customer behavior analysis, predictive modeling, and recommendation system implementation."
                },
                {
                    "type": "Architecture Document", 
                    "context": "Design a modern software architecture for an e-commerce platform that can handle high traffic, provide personalized recommendations, and integrate with multiple payment systems."
                }
            ]
            
            generated_docs = []
            for req in document_requests:
                result = await engine.generate_enhanced_document(
                    request_type=req["type"],
                    context=req["context"]
                )
                
                if result:
                    generated_docs.append(result)
            
            # Show final statistics
            print("\n\n📊 Final Demo Statistics:")
            print("-" * 30)
            
            stats = await engine.rag_storage_service.get_storage_statistics()
            print(f"📚 Knowledge base documents: {len(knowledge_doc_ids)}")
            print(f"📄 Generated documents: {len(generated_docs)}")
            print(f"🔍 Search operations: {stats.get('search_operations', 0)}")
            print(f"🧠 RAG queries: {stats.get('rag_total_queries', 0)}")
            print(f"🧩 Total chunks: {stats.get('rag_total_chunks', 0)}")
            
            print(f"\n🎉 Integration Demo Completed Successfully!")
            print("\nThe RAG-Enhanced DocumentEngine provides:")
            print("  ✅ Semantic knowledge retrieval")
            print("  ✅ Intelligent content recommendations")
            print("  ✅ Context-aware document generation")
            print("  ✅ Hybrid search capabilities")
            print("  ✅ Automated content enhancement")
            print("  ✅ Quality-scored results")
            
        except Exception as e:
            print(f"\n❌ Demo failed: {e}")
            import traceback
            traceback.print_exc()
        
        finally:
            await engine.close()


if __name__ == "__main__":
    asyncio.run(main())
