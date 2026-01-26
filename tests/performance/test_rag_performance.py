#!/usr/bin/env python3
"""
RAG System Performance Tests

Comprehensive performance testing for the RAG system with large document corpus,
measuring throughput, latency, memory usage, and concurrent operations.
"""

import pytest
import asyncio
import os
import tempfile
import time
import psutil
import statistics
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any
from unittest.mock import patch, MagicMock

# Skip tests if requirements not available
DATABASE_URL = "postgresql://nyimbi:Abcd1234.@172.236.30.103:5432/docdb"
SKIP_PERFORMANCE_TESTS = not os.getenv('OPENAI_API_KEY') or not DATABASE_URL

pytestmark = pytest.mark.skipif(SKIP_PERFORMANCE_TESTS, reason="Performance tests require database and OpenAI API key")

from docfusion.storage.rag import (
	RAGService, RAGConfiguration, RAGDocument
)
from docfusion.storage.rag_storage_service import (
	RAGStorageService, RAGStorageConfiguration
)


class PerformanceMonitor:
	"""Monitor system performance metrics during tests"""
	
	def __init__(self):
		self.process = psutil.Process()
		self.start_time = None
		self.start_memory = None
		self.peak_memory = 0
		
	def start_monitoring(self):
		"""Start performance monitoring"""
		self.start_time = time.time()
		self.start_memory = self.process.memory_info().rss
		self.peak_memory = self.start_memory
		
	def update_peak_memory(self):
		"""Update peak memory usage"""
		current_memory = self.process.memory_info().rss
		if current_memory > self.peak_memory:
			self.peak_memory = current_memory
			
	def get_metrics(self) -> Dict[str, Any]:
		"""Get performance metrics"""
		if not self.start_time:
			return {}
			
		end_time = time.time()
		end_memory = self.process.memory_info().rss
		
		return {
			'execution_time': end_time - self.start_time,
			'start_memory_mb': self.start_memory / 1024 / 1024,
			'end_memory_mb': end_memory / 1024 / 1024,
			'peak_memory_mb': self.peak_memory / 1024 / 1024,
			'memory_growth_mb': (end_memory - self.start_memory) / 1024 / 1024,
			'cpu_percent': self.process.cpu_percent()
		}


@pytest.fixture
def large_document_corpus():
	"""Generate large document corpus for testing"""
	documents = []
	
	# Technology documents
	tech_content_templates = [
		"Machine learning algorithms including neural networks, decision trees, support vector machines, and ensemble methods are widely used in artificial intelligence applications. Deep learning frameworks like TensorFlow and PyTorch enable developers to build sophisticated models for image recognition, natural language processing, and predictive analytics.",
		"Cloud computing platforms such as AWS, Azure, and Google Cloud provide scalable infrastructure for modern applications. Microservices architecture allows teams to develop, deploy, and maintain distributed systems with high availability and fault tolerance.",
		"Data science methodologies encompass data collection, cleaning, analysis, and visualization. Statistical models and machine learning techniques help extract insights from large datasets for business intelligence and decision making.",
		"Software engineering best practices include version control with Git, continuous integration and deployment pipelines, automated testing, and code reviews. Agile methodologies like Scrum facilitate iterative development and team collaboration.",
		"Database management systems support ACID properties for data consistency and reliability. NoSQL databases like MongoDB and Cassandra handle unstructured data and provide horizontal scaling capabilities."
	]
	
	# Business documents
	business_content_templates = [
		"Strategic planning involves setting organizational goals, analyzing market conditions, and developing competitive strategies. Key performance indicators measure progress toward objectives and guide resource allocation decisions.",
		"Project management methodologies like Agile, Waterfall, and Hybrid approaches help teams deliver projects on time and within budget. Risk assessment and mitigation strategies ensure project success and stakeholder satisfaction.",
		"Financial analysis includes revenue forecasting, cost-benefit analysis, and return on investment calculations. Budget planning and expense management support sustainable business growth and profitability.",
		"Marketing strategies encompass brand positioning, customer segmentation, and digital marketing campaigns. Social media marketing and content marketing drive customer engagement and lead generation.",
		"Human resources management covers recruitment, employee development, performance evaluation, and retention strategies. Organizational culture and leadership development foster employee satisfaction and productivity."
	]
	
	# Generate 200 technology documents
	for i in range(200):
		template_idx = i % len(tech_content_templates)
		content = f"{tech_content_templates[template_idx]} Document variation {i+1} with additional context about implementation details, use cases, and industry applications. This content provides comprehensive coverage of the topic with practical examples and technical specifications."
		
		documents.append({
			'title': f'Technology Document {i+1}',
			'content': content,
			'category': 'technology',
			'tags': ['tech', 'ai', 'software', f'doc_{i+1}'],
			'document_type': 'technical'
		})
	
	# Generate 200 business documents
	for i in range(200):
		template_idx = i % len(business_content_templates)
		content = f"{business_content_templates[template_idx]} Business case {i+1} with detailed analysis of market opportunities, competitive landscape, and implementation roadmap. This document includes financial projections, risk assessments, and success metrics."
		
		documents.append({
			'title': f'Business Document {i+1}',
			'content': content,
			'category': 'business',
			'tags': ['business', 'strategy', 'management', f'biz_{i+1}'],
			'document_type': 'business'
		})
	
	# Generate 100 research documents
	for i in range(100):
		content = f"Research study {i+1} investigating the intersection of technology and business innovation. This comprehensive analysis examines current trends, future opportunities, and potential challenges in digital transformation. The study includes case studies, statistical analysis, and recommendations for implementation."
		
		documents.append({
			'title': f'Research Study {i+1}',
			'content': content,
			'category': 'research',
			'tags': ['research', 'innovation', 'analysis', f'research_{i+1}'],
			'document_type': 'research'
		})
	
	return documents


@pytest.fixture
async def performance_rag_service():
	"""Create RAG service configured for performance testing"""
	config = RAGConfiguration(
		connection_string=DATABASE_URL,
		schema_name="performance_test",
		openai_api_key=os.getenv('OPENAI_API_KEY'),
		chunk_size=800,
		chunk_overlap=150,
		default_similarity_threshold=0.7,
		max_search_results=50,
		max_concurrent_requests=20
	)
	
	service = RAGService(config)
	await service.initialize()
	
	yield service
	
	# Cleanup
	await service.close()


@pytest.fixture
async def performance_rag_storage_service():
	"""Create RAG storage service configured for performance testing"""
	with tempfile.TemporaryDirectory() as temp_dir:
		config = RAGStorageConfiguration(
			storage_root_path=Path(temp_dir) / "performance_test",
			enable_rag=True,
			postgresql_connection_string=DATABASE_URL,
			openai_api_key=os.getenv('OPENAI_API_KEY'),
			chunk_size=800,
			chunk_overlap=150,
			similarity_threshold=0.7,
			enable_hybrid_search=True,
			max_concurrent_requests=20,
			search_cache_size=2000,
			retrieval_cache_size=1000
		)
		
		service = RAGStorageService(config)
		await service.initialize()
		
		yield service
		
		# Cleanup
		await service.close()


class TestRAGPerformance:
	"""Performance tests for RAG system"""
	
	@pytest.mark.asyncio
	@pytest.mark.performance
	async def test_bulk_document_ingestion_performance(
		self, 
		performance_rag_service, 
		large_document_corpus
	):
		"""Test performance of bulk document ingestion"""
		monitor = PerformanceMonitor()
		monitor.start_monitoring()
		
		# Use mock for embeddings to focus on ingestion performance
		with patch('openai.AsyncOpenAI') as mock_openai:
			# Mock OpenAI response
			mock_response = MagicMock()
			mock_response.data = [MagicMock()]
			mock_response.data[0].embedding = [0.1] * 1536
			mock_response.usage.total_tokens = 100
			
			mock_client = MagicMock()
			mock_client.embeddings.create.return_value = mock_response
			mock_openai.return_value = mock_client
			
			service = performance_rag_service
			document_ids = []
			batch_size = 50
			
			# Ingest documents in batches
			for i in range(0, min(200, len(large_document_corpus)), batch_size):
				batch = large_document_corpus[i:i+batch_size]
				batch_start = time.time()
				
				batch_ids = []
				for doc in batch:
					doc_id = await service.add_document(**doc)
					if doc_id:
						batch_ids.append(doc_id)
				
				batch_end = time.time()
				document_ids.extend(batch_ids)
				
				print(f"Batch {i//batch_size + 1}: {len(batch_ids)}/{len(batch)} docs ingested in {batch_end - batch_start:.2f}s")
				monitor.update_peak_memory()
			
			metrics = monitor.get_metrics()
			
			# Performance assertions
			assert len(document_ids) >= 150, f"Should ingest at least 150 documents, got {len(document_ids)}"
			assert metrics['execution_time'] < 180, f"Bulk ingestion took too long: {metrics['execution_time']:.2f}s"
			assert metrics['memory_growth_mb'] < 500, f"Memory growth too high: {metrics['memory_growth_mb']:.2f}MB"
			
			print(f"\n=== Bulk Ingestion Performance ===")
			print(f"Documents ingested: {len(document_ids)}")
			print(f"Total time: {metrics['execution_time']:.2f}s")
			print(f"Throughput: {len(document_ids) / metrics['execution_time']:.2f} docs/sec")
			print(f"Memory usage: {metrics['start_memory_mb']:.1f}MB -> {metrics['end_memory_mb']:.1f}MB")
			print(f"Peak memory: {metrics['peak_memory_mb']:.1f}MB")
			
			# Clean up test documents
			for doc_id in document_ids[:20]:  # Clean up subset to avoid timeout
				await service.delete_document(doc_id)
	
	@pytest.mark.asyncio
	@pytest.mark.performance
	async def test_concurrent_search_performance(self, performance_rag_service):
		"""Test concurrent search performance"""
		service = performance_rag_service
		
		# First, add some test documents with mocked embeddings
		with patch('openai.AsyncOpenAI') as mock_openai:
			mock_response = MagicMock()
			mock_response.data = [MagicMock()]
			mock_response.data[0].embedding = [0.2] * 1536
			mock_response.usage.total_tokens = 50
			
			mock_client = MagicMock()
			mock_client.embeddings.create.return_value = mock_response
			mock_openai.return_value = mock_client
			
			# Add test documents
			doc_ids = []
			for i in range(20):
				doc_id = await service.add_document(
					content=f"Test document {i} about machine learning, artificial intelligence, and data science applications in business processes.",
					title=f"Concurrent Test Doc {i}",
					category="test"
				)
				if doc_id:
					doc_ids.append(doc_id)
			
			# Test concurrent searches
			search_queries = [
				"machine learning algorithms",
				"artificial intelligence applications", 
				"data science methodology",
				"business process optimization",
				"technology innovation trends",
				"software development practices",
				"cloud computing solutions",
				"database management systems"
			]
			
			monitor = PerformanceMonitor()
			monitor.start_monitoring()
			
			# Perform concurrent searches
			concurrent_tasks = []
			for _ in range(5):  # 5 rounds of concurrent searches
				for query in search_queries:
					task = service.search(
						query=query,
						limit=10,
						similarity_threshold=0.3  # Lower threshold for mock data
					)
					concurrent_tasks.append(task)
			
			# Execute all searches concurrently
			search_start = time.time()
			results = await asyncio.gather(*concurrent_tasks, return_exceptions=True)
			search_end = time.time()
			
			metrics = monitor.get_metrics()
			
			# Analyze results
			successful_searches = [r for r in results if not isinstance(r, Exception)]
			failed_searches = [r for r in results if isinstance(r, Exception)]
			
			total_searches = len(concurrent_tasks)
			search_time = search_end - search_start
			
			# Performance assertions
			success_rate = len(successful_searches) / total_searches
			assert success_rate >= 0.8, f"Success rate too low: {success_rate:.2f}"
			assert search_time < 60, f"Concurrent searches took too long: {search_time:.2f}s"
			
			print(f"\n=== Concurrent Search Performance ===")
			print(f"Total searches: {total_searches}")
			print(f"Successful: {len(successful_searches)}")
			print(f"Failed: {len(failed_searches)}")
			print(f"Success rate: {success_rate:.2%}")
			print(f"Total time: {search_time:.2f}s")
			print(f"Throughput: {total_searches / search_time:.2f} searches/sec")
			print(f"Memory usage: {metrics['start_memory_mb']:.1f}MB -> {metrics['end_memory_mb']:.1f}MB")
			
			# Cleanup
			for doc_id in doc_ids:
				try:
					await service.delete_document(doc_id)
				except:
					pass
	
	@pytest.mark.asyncio
	@pytest.mark.performance
	async def test_search_latency_distribution(self, performance_rag_service):
		"""Test search latency distribution and percentiles"""
		service = performance_rag_service
		
		with patch('openai.AsyncOpenAI') as mock_openai:
			# Mock setup
			mock_response = MagicMock()
			mock_response.data = [MagicMock()]
			mock_response.data[0].embedding = [0.3] * 1536
			mock_response.usage.total_tokens = 30
			
			mock_client = MagicMock()
			mock_client.embeddings.create.return_value = mock_response
			mock_openai.return_value = mock_client
			
			# Add test documents
			doc_ids = []
			for i in range(10):
				doc_id = await service.add_document(
					content=f"Performance test document {i} covering various topics in technology, business, and research domains.",
					title=f"Latency Test Doc {i}",
					category="performance"
				)
				if doc_id:
					doc_ids.append(doc_id)
			
			# Perform multiple searches and measure latency
			search_latencies = []
			search_query = "technology business research applications"
			
			for i in range(50):  # 50 searches for statistical analysis
				search_start = time.time()
				result = await service.search(
					query=search_query,
					limit=5,
					similarity_threshold=0.1
				)
				search_end = time.time()
				
				latency = search_end - search_start
				search_latencies.append(latency)
			
			# Calculate latency statistics
			if search_latencies:
				mean_latency = statistics.mean(search_latencies)
				median_latency = statistics.median(search_latencies)
				p95_latency = sorted(search_latencies)[int(0.95 * len(search_latencies))]
				p99_latency = sorted(search_latencies)[int(0.99 * len(search_latencies))]
				min_latency = min(search_latencies)
				max_latency = max(search_latencies)
				
				# Performance assertions
				assert mean_latency < 2.0, f"Mean latency too high: {mean_latency:.3f}s"
				assert p95_latency < 5.0, f"P95 latency too high: {p95_latency:.3f}s"
				assert p99_latency < 10.0, f"P99 latency too high: {p99_latency:.3f}s"
				
				print(f"\n=== Search Latency Distribution ===")
				print(f"Samples: {len(search_latencies)}")
				print(f"Mean: {mean_latency:.3f}s")
				print(f"Median: {median_latency:.3f}s")
				print(f"Min: {min_latency:.3f}s")
				print(f"Max: {max_latency:.3f}s")
				print(f"P95: {p95_latency:.3f}s")
				print(f"P99: {p99_latency:.3f}s")
			
			# Cleanup
			for doc_id in doc_ids:
				try:
					await service.delete_document(doc_id)
				except:
					pass
	
	@pytest.mark.asyncio
	@pytest.mark.performance
	async def test_hybrid_search_performance_comparison(self, performance_rag_storage_service):
		"""Compare performance of different search types"""
		service = performance_rag_storage_service
		
		with patch('openai.AsyncOpenAI') as mock_openai:
			# Mock setup
			mock_response = MagicMock()
			mock_response.data = [MagicMock()]
			mock_response.data[0].embedding = [0.4] * 1536
			mock_response.usage.total_tokens = 40
			
			mock_client = MagicMock()
			mock_client.embeddings.create.return_value = mock_response
			mock_openai.return_value = mock_client
			
			# Add test documents
			test_docs = []
			for i in range(30):
				doc_id = await service.store_document(
					content=f"Hybrid search test document {i} discussing artificial intelligence, machine learning algorithms, natural language processing, and business applications of technology solutions.",
					title=f"Hybrid Test {i}",
					category="hybrid_test",
					enable_rag_indexing=True
				)
				if doc_id:
					test_docs.append(doc_id)
			
			search_query = "artificial intelligence machine learning business"
			search_types = ["full_text", "semantic", "hybrid"]
			performance_results = {}
			
			# Test each search type
			for search_type in search_types:
				latencies = []
				
				for _ in range(10):  # 10 searches per type
					search_start = time.time()
					results = await service.search_documents(
						query=search_query,
						search_type=search_type,
						limit=10
					)
					search_end = time.time()
					
					latencies.append(search_end - search_start)
				
				if latencies:
					performance_results[search_type] = {
						'mean_latency': statistics.mean(latencies),
						'median_latency': statistics.median(latencies),
						'min_latency': min(latencies),
						'max_latency': max(latencies),
						'sample_count': len(latencies)
					}
			
			# Performance assertions
			if 'full_text' in performance_results:
				assert performance_results['full_text']['mean_latency'] < 1.0, "Full-text search too slow"
			
			if 'semantic' in performance_results:
				assert performance_results['semantic']['mean_latency'] < 3.0, "Semantic search too slow"
			
			if 'hybrid' in performance_results:
				assert performance_results['hybrid']['mean_latency'] < 5.0, "Hybrid search too slow"
			
			print(f"\n=== Search Type Performance Comparison ===")
			for search_type, metrics in performance_results.items():
				print(f"{search_type.upper()} Search:")
				print(f"  Mean latency: {metrics['mean_latency']:.3f}s")
				print(f"  Median latency: {metrics['median_latency']:.3f}s")
				print(f"  Min latency: {metrics['min_latency']:.3f}s")
				print(f"  Max latency: {metrics['max_latency']:.3f}s")
				print()
			
			# Cleanup is handled by fixture
	
	@pytest.mark.asyncio
	@pytest.mark.performance
	async def test_memory_usage_with_large_corpus(self, performance_rag_service):
		"""Test memory usage scaling with document corpus size"""
		service = performance_rag_service
		monitor = PerformanceMonitor()
		
		with patch('openai.AsyncOpenAI') as mock_openai:
			# Mock setup
			mock_response = MagicMock()
			mock_response.data = [MagicMock()]
			mock_response.data[0].embedding = [0.5] * 1536
			mock_response.usage.total_tokens = 60
			
			mock_client = MagicMock()
			mock_client.embeddings.create.return_value = mock_response
			mock_openai.return_value = mock_client
			
			monitor.start_monitoring()
			memory_checkpoints = []
			document_counts = []
			doc_ids = []
			
			# Add documents in batches and monitor memory
			batch_sizes = [10, 20, 30, 40, 50]
			
			for batch_size in batch_sizes:
				batch_start_memory = monitor.process.memory_info().rss / 1024 / 1024
				
				batch_ids = []
				for i in range(batch_size):
					doc_id = await service.add_document(
						content=f"Memory test document {len(doc_ids) + i} with substantial content about technology trends, business strategies, and research methodologies in modern enterprise environments.",
						title=f"Memory Test {len(doc_ids) + i}",
						category="memory_test"
					)
					if doc_id:
						batch_ids.append(doc_id)
				
				doc_ids.extend(batch_ids)
				current_memory = monitor.process.memory_info().rss / 1024 / 1024
				
				memory_checkpoints.append({
					'document_count': len(doc_ids),
					'memory_mb': current_memory,
					'memory_growth_mb': current_memory - batch_start_memory,
					'batch_size': len(batch_ids)
				})
				document_counts.append(len(doc_ids))
				
				monitor.update_peak_memory()
			
			final_metrics = monitor.get_metrics()
			
			# Analyze memory scaling
			if len(memory_checkpoints) >= 2:
				memory_per_doc = []
				for i in range(1, len(memory_checkpoints)):
					prev_checkpoint = memory_checkpoints[i-1]
					curr_checkpoint = memory_checkpoints[i]
					
					docs_added = curr_checkpoint['document_count'] - prev_checkpoint['document_count']
					memory_added = curr_checkpoint['memory_mb'] - prev_checkpoint['memory_mb']
					
					if docs_added > 0:
						memory_per_doc.append(memory_added / docs_added)
				
				if memory_per_doc:
					avg_memory_per_doc = statistics.mean(memory_per_doc)
					
					# Performance assertions
					assert avg_memory_per_doc < 5.0, f"Memory per document too high: {avg_memory_per_doc:.2f}MB/doc"
					assert final_metrics['memory_growth_mb'] < 500, f"Total memory growth too high: {final_metrics['memory_growth_mb']:.2f}MB"
					
					print(f"\n=== Memory Usage Analysis ===")
					print(f"Total documents: {len(doc_ids)}")
					print(f"Total memory growth: {final_metrics['memory_growth_mb']:.2f}MB")
					print(f"Average memory per document: {avg_memory_per_doc:.3f}MB/doc")
					print(f"Peak memory usage: {final_metrics['peak_memory_mb']:.1f}MB")
					
					print(f"\nMemory checkpoints:")
					for checkpoint in memory_checkpoints:
						print(f"  {checkpoint['document_count']:3d} docs: {checkpoint['memory_mb']:7.1f}MB (+{checkpoint['memory_growth_mb']:5.1f}MB)")
			
			# Cleanup subset of documents
			for doc_id in doc_ids[:20]:
				try:
					await service.delete_document(doc_id)
				except:
					pass


# Integration performance test
@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.performance
async def test_end_to_end_rag_performance_workflow():
	"""End-to-end performance test of complete RAG workflow"""
	if not os.getenv('OPENAI_API_KEY'):
		pytest.skip("Integration performance test requires OPENAI_API_KEY")
	
	config = RAGConfiguration(
		connection_string=DATABASE_URL,
		schema_name="e2e_performance_test",
		openai_api_key=os.getenv('OPENAI_API_KEY'),
		chunk_size=1000,
		chunk_overlap=200
	)
	
	service = RAGService(config)
	await service.initialize()
	
	monitor = PerformanceMonitor()
	monitor.start_monitoring()
	
	try:
		# Add documents
		doc_ids = []
		documents = [
			{
				"content": "Artificial intelligence and machine learning are transforming how businesses operate. Deep learning models enable automated decision making and predictive analytics across industries.",
				"title": "AI Business Transformation",
				"category": "ai"
			},
			{
				"content": "Cloud computing platforms provide scalable infrastructure for modern applications. Containerization with Docker and Kubernetes enables efficient deployment and management of microservices.",
				"title": "Cloud Infrastructure",
				"category": "cloud"
			},
			{
				"content": "Data science combines statistical analysis, machine learning, and domain expertise to extract insights from complex datasets. Visualization tools help communicate findings to stakeholders.",
				"title": "Data Science Methodology",
				"category": "data"
			}
		]
		
		ingestion_start = time.time()
		for doc_data in documents:
			doc_id = await service.add_document(**doc_data)
			if doc_id:
				doc_ids.append(doc_id)
		ingestion_end = time.time()
		
		# Perform searches
		search_start = time.time()
		search_queries = [
			"artificial intelligence business applications",
			"cloud computing infrastructure management",
			"data science analysis techniques"
		]
		
		search_results = []
		for query in search_queries:
			result = await service.search(
				query=query,
				limit=5,
				similarity_threshold=0.6
			)
			search_results.append(result)
		search_end = time.time()
		
		# Get related documents
		if doc_ids:
			related_start = time.time()
			related_docs = await service.get_related_documents(
				document_id=doc_ids[0],
				limit=3,
				similarity_threshold=0.7
			)
			related_end = time.time()
		
		final_metrics = monitor.get_metrics()
		
		# Performance assertions
		assert len(doc_ids) == len(documents), "All documents should be ingested"
		assert all(len(result.results) >= 0 for result in search_results), "Searches should complete"
		assert final_metrics['execution_time'] < 60, "E2E workflow should complete within 60s"
		
		print(f"\n=== End-to-End Performance Results ===")
		print(f"Documents ingested: {len(doc_ids)}")
		print(f"Ingestion time: {ingestion_end - ingestion_start:.2f}s")
		print(f"Search queries: {len(search_queries)}")
		print(f"Search time: {search_end - search_start:.2f}s")
		if doc_ids:
			print(f"Related documents time: {related_end - related_start:.2f}s")
			print(f"Related documents found: {len(related_docs)}")
		print(f"Total workflow time: {final_metrics['execution_time']:.2f}s")
		print(f"Memory usage: {final_metrics['start_memory_mb']:.1f}MB -> {final_metrics['end_memory_mb']:.1f}MB")
		
	finally:
		# Cleanup
		for doc_id in doc_ids:
			await service.delete_document(doc_id)
		
		await service.close()