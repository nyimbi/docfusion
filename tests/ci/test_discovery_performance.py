"""
Discovery Performance Tests

This module provides comprehensive performance testing for the discovery
engine, validating throughput, latency, and scalability requirements
including the ability to process 1000+ opportunities per day.
"""

import asyncio
import time
import statistics
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
from concurrent.futures import ThreadPoolExecutor
import resource
import psutil
import pytest

from docfusion.discovery.models.opportunity_models import OpportunityData
from docfusion.discovery.analyzers.opportunity_analyzer import OpportunityAnalyzer
from docfusion.discovery.analyzers.qualification_analyzer import (
	QualificationAnalyzer, OrganizationalCapabilities
)
from docfusion.discovery.matchers.capability_matcher import CapabilityMatcher
from docfusion.discovery.integrations.nlp_integration import DiscoveryNLPService
from docfusion.discovery.integrations.storage_integration import DiscoveryStorageService


class PerformanceMetrics:
	"""Performance metrics collector"""
	
	def __init__(self):
		self.start_time = None
		self.end_time = None
		self.processing_times = []
		self.memory_usage = []
		self.cpu_usage = []
		self.throughput_measurements = []
		
		# Error tracking
		self.total_operations = 0
		self.successful_operations = 0
		self.failed_operations = 0
	
	def start_measurement(self):
		"""Start performance measurement"""
		self.start_time = time.time()
		self.memory_usage.append(psutil.virtual_memory().percent)
		self.cpu_usage.append(psutil.cpu_percent())
	
	def end_measurement(self):
		"""End performance measurement"""
		self.end_time = time.time()
		self.memory_usage.append(psutil.virtual_memory().percent)
		self.cpu_usage.append(psutil.cpu_percent())
	
	def record_operation(self, processing_time: float, success: bool):
		"""Record individual operation metrics"""
		self.processing_times.append(processing_time)
		self.total_operations += 1
		
		if success:
			self.successful_operations += 1
		else:
			self.failed_operations += 1
	
	def calculate_throughput(self) -> float:
		"""Calculate operations per second"""
		if self.start_time and self.end_time:
			total_time = self.end_time - self.start_time
			return self.total_operations / total_time if total_time > 0 else 0.0
		return 0.0
	
	def get_summary(self) -> Dict[str, Any]:
		"""Get performance summary"""
		return {
			'total_operations': self.total_operations,
			'successful_operations': self.successful_operations,
			'failed_operations': self.failed_operations,
			'success_rate': self.successful_operations / max(self.total_operations, 1),
			'throughput_ops_per_sec': self.calculate_throughput(),
			'avg_processing_time': statistics.mean(self.processing_times) if self.processing_times else 0,
			'median_processing_time': statistics.median(self.processing_times) if self.processing_times else 0,
			'p95_processing_time': statistics.quantiles(self.processing_times, n=20)[18] if len(self.processing_times) > 20 else 0,
			'p99_processing_time': statistics.quantiles(self.processing_times, n=100)[98] if len(self.processing_times) > 100 else 0,
			'min_processing_time': min(self.processing_times) if self.processing_times else 0,
			'max_processing_time': max(self.processing_times) if self.processing_times else 0,
			'avg_memory_usage': statistics.mean(self.memory_usage) if self.memory_usage else 0,
			'peak_memory_usage': max(self.memory_usage) if self.memory_usage else 0,
			'avg_cpu_usage': statistics.mean(self.cpu_usage) if self.cpu_usage else 0,
			'peak_cpu_usage': max(self.cpu_usage) if self.cpu_usage else 0,
			'total_duration': (self.end_time - self.start_time) if (self.start_time and self.end_time) else 0
		}


class PerformanceTestSuite:
	"""Comprehensive performance test suite for discovery engine"""
	
	def __init__(self):
		self.opportunity_analyzer = OpportunityAnalyzer()
		self.qualification_analyzer = QualificationAnalyzer()
		self.capability_matcher = CapabilityMatcher()
		self.nlp_service = DiscoveryNLPService()
		self.storage_service = DiscoveryStorageService()
		
		# Test data cache
		self._test_opportunities = None
		self._org_capabilities = None
	
	def generate_test_opportunities(self, count: int) -> List[OpportunityData]:
		"""Generate test opportunities for performance testing"""
		
		if self._test_opportunities and len(self._test_opportunities) >= count:
			return self._test_opportunities[:count]
		
		print(f"🔧 Generating {count} test opportunities...")
		
		# Base opportunity templates
		templates = [
			{
				'title_template': 'Enterprise {technology} Implementation Project {id}',
				'description_template': 'Implement {technology} solution for enterprise client with focus on scalability, security, and performance optimization.',
				'requirements_template': '{technology} expertise, {years} years experience, security clearance preferred',
				'technologies': ['Cloud Computing', 'AI/ML', 'Data Analytics', 'Cybersecurity', 'DevOps'],
				'industries': ['technology', 'healthcare', 'financial_services', 'government', 'manufacturing']
			},
			{
				'title_template': '{industry} Digital Transformation Initiative {id}',
				'description_template': 'Modernize {industry} operations through digital transformation including system integration and process automation.',
				'requirements_template': 'Digital transformation experience, {industry} domain knowledge, agile methodology',
				'technologies': ['Microservices', 'API Integration', 'Process Automation', 'Mobile Development', 'Analytics'],
				'industries': ['healthcare', 'financial_services', 'government', 'retail', 'education']
			},
			{
				'title_template': 'Advanced {technology} Platform Development {id}',
				'description_template': 'Design and develop advanced {technology} platform with real-time processing capabilities and enterprise integration.',
				'requirements_template': '{technology} development, distributed systems, enterprise integration experience',
				'technologies': ['IoT', 'Blockchain', 'Machine Learning', 'Real-time Analytics', 'Edge Computing'],
				'industries': ['manufacturing', 'logistics', 'energy', 'automotive', 'telecommunications']
			}
		]
		
		opportunities = []
		
		for i in range(count):
			template = templates[i % len(templates)]
			technology = template['technologies'][i % len(template['technologies'])]
			industry = template['industries'][i % len(template['industries'])]
			
			# Generate opportunity with variations
			opportunity = OpportunityData(
				id=f"perf_test_{i:06d}",
				title=template['title_template'].format(technology=technology, id=i+1),
				description=template['description_template'].format(technology=technology, industry=industry),
				requirements=template['requirements_template'].format(
					technology=technology,
					industry=industry,
					years=3 + (i % 8)  # 3-10 years experience
				),
				estimated_value=float(1000000 + (i * 100000) + (i % 5) * 500000),  # $1M to $6M range
				submission_deadline=datetime.now() + timedelta(days=15 + (i % 60)),  # 15-75 days
				industry=industry,
				status='active'
			)
			
			opportunities.append(opportunity)
		
		self._test_opportunities = opportunities
		return opportunities
	
	def get_test_org_capabilities(self) -> OrganizationalCapabilities:
		"""Get test organizational capabilities"""
		
		if self._org_capabilities:
			return self._org_capabilities
		
		self._org_capabilities = OrganizationalCapabilities(
			core_competencies={
				'software_development': 0.88,
				'cloud_computing': 0.82,
				'data_analytics': 0.79,
				'project_management': 0.86,
				'cybersecurity': 0.74,
				'artificial_intelligence': 0.71,
				'devops': 0.83,
				'microservices': 0.77,
				'digital_transformation': 0.80,
				'enterprise_integration': 0.85
			},
			technical_skills={
				'python': 0.89,
				'java': 0.84,
				'javascript': 0.81,
				'aws': 0.78,
				'azure': 0.72,
				'docker': 0.86,
				'kubernetes': 0.76,
				'terraform': 0.73,
				'react': 0.79,
				'spring': 0.82,
				'tensorflow': 0.69,
				'spark': 0.71
			},
			industry_experience={
				'technology': 18,
				'healthcare': 12,
				'financial_services': 15,
				'government': 8,
				'manufacturing': 6,
				'retail': 5,
				'education': 4,
				'energy': 3
			},
			team_composition={
				'senior_developer': 15,
				'solution_architect': 6,
				'project_manager': 4,
				'data_scientist': 8,
				'devops_engineer': 7,
				'security_specialist': 3,
				'ui_ux_designer': 4,
				'business_analyst': 3
			}
		)
		
		return self._org_capabilities
	
	async def test_individual_component_performance(self) -> Dict[str, Dict[str, Any]]:
		"""Test performance of individual components"""
		
		print("🔬 Testing individual component performance...")
		
		# Generate smaller test set for component testing
		opportunities = self.generate_test_opportunities(50)
		org_capabilities = self.get_test_org_capabilities()
		
		component_results = {}
		
		# Test OpportunityAnalyzer
		print("  📊 Testing OpportunityAnalyzer...")
		analyzer_metrics = PerformanceMetrics()
		analyzer_metrics.start_measurement()
		
		for opp in opportunities[:20]:  # Test with 20 opportunities
			start_time = time.time()
			try:
				analysis = await self.opportunity_analyzer.analyze_opportunity(opp)
				processing_time = time.time() - start_time
				analyzer_metrics.record_operation(processing_time, True)
			except Exception as e:
				processing_time = time.time() - start_time
				analyzer_metrics.record_operation(processing_time, False)
		
		analyzer_metrics.end_measurement()
		component_results['opportunity_analyzer'] = analyzer_metrics.get_summary()
		
		# Test QualificationAnalyzer
		print("  🎯 Testing QualificationAnalyzer...")
		qualifier_metrics = PerformanceMetrics()
		qualifier_metrics.start_measurement()
		
		for opp in opportunities[:15]:  # Test with 15 opportunities
			start_time = time.time()
			try:
				qualification = await self.qualification_analyzer.analyze_qualification(opp, org_capabilities)
				processing_time = time.time() - start_time
				qualifier_metrics.record_operation(processing_time, True)
			except Exception as e:
				processing_time = time.time() - start_time
				qualifier_metrics.record_operation(processing_time, False)
		
		qualifier_metrics.end_measurement()
		component_results['qualification_analyzer'] = qualifier_metrics.get_summary()
		
		# Test CapabilityMatcher
		print("  🔗 Testing CapabilityMatcher...")
		matcher_metrics = PerformanceMetrics()
		matcher_metrics.start_measurement()
		
		# Train capability matcher first
		await self.capability_matcher.train_matcher([])
		
		org_caps_dict = {**org_capabilities.core_competencies, **org_capabilities.technical_skills}
		requirements = ['Python development', 'Cloud architecture', 'Data analytics', 'Project management']
		
		for _ in range(25):  # Test with 25 matching operations
			start_time = time.time()
			try:
				results = await self.capability_matcher.match_capabilities(requirements, org_caps_dict)
				processing_time = time.time() - start_time
				matcher_metrics.record_operation(processing_time, True)
			except Exception as e:
				processing_time = time.time() - start_time
				matcher_metrics.record_operation(processing_time, False)
		
		matcher_metrics.end_measurement()
		component_results['capability_matcher'] = matcher_metrics.get_summary()
		
		print("✅ Individual component performance testing completed")
		return component_results
	
	async def test_concurrent_processing(self, concurrency_level: int = 5) -> Dict[str, Any]:
		"""Test concurrent processing capabilities"""
		
		print(f"⚡ Testing concurrent processing (concurrency: {concurrency_level})...")
		
		opportunities = self.generate_test_opportunities(100)
		org_capabilities = self.get_test_org_capabilities()
		
		concurrent_metrics = PerformanceMetrics()
		concurrent_metrics.start_measurement()
		
		# Process opportunities in concurrent batches
		batch_size = concurrency_level
		results = []
		
		for i in range(0, len(opportunities), batch_size):
			batch = opportunities[i:i + batch_size]
			
			# Process batch concurrently
			batch_tasks = []
			for opp in batch:
				task = self._process_single_opportunity_performance(opp, org_capabilities)
				batch_tasks.append(task)
			
			# Execute batch
			batch_start = time.time()
			batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
			batch_time = time.time() - batch_start
			
			# Record results
			for result in batch_results:
				if isinstance(result, Exception):
					concurrent_metrics.record_operation(batch_time / len(batch), False)
				else:
					concurrent_metrics.record_operation(result['processing_time'], result['success'])
					results.append(result)
		
		concurrent_metrics.end_measurement()
		
		concurrent_summary = concurrent_metrics.get_summary()
		concurrent_summary['concurrency_level'] = concurrency_level
		concurrent_summary['batches_processed'] = (len(opportunities) + batch_size - 1) // batch_size
		
		print(f"✅ Concurrent processing test completed (throughput: {concurrent_summary['throughput_ops_per_sec']:.2f} ops/sec)")
		
		return concurrent_summary
	
	async def _process_single_opportunity_performance(self, opportunity: OpportunityData,
	                                                  org_capabilities: OrganizationalCapabilities) -> Dict[str, Any]:
		"""Process single opportunity for performance testing"""
		
		start_time = time.time()
		
		try:
			# Simplified workflow for performance testing
			analysis = await self.opportunity_analyzer.analyze_opportunity(opportunity)
			qualification = await self.qualification_analyzer.analyze_qualification(opportunity, org_capabilities)
			
			processing_time = time.time() - start_time
			
			return {
				'opportunity_id': opportunity.id,
				'processing_time': processing_time,
				'success': True,
				'analysis_score': analysis.strategic_assessment.strategic_fit_score,
				'match_score': qualification.overall_match_score
			}
			
		except Exception as e:
			processing_time = time.time() - start_time
			return {
				'opportunity_id': opportunity.id,
				'processing_time': processing_time,
				'success': False,
				'error': str(e)
			}
	
	async def test_daily_throughput_simulation(self, target_daily_ops: int = 1000) -> Dict[str, Any]:
		"""Simulate daily throughput to validate 1000+ opportunities per day capability"""
		
		print(f"🚀 Testing daily throughput simulation (target: {target_daily_ops} ops/day)...")
		
		# Calculate required throughput per second
		seconds_per_day = 24 * 60 * 60
		required_ops_per_sec = target_daily_ops / seconds_per_day
		
		print(f"   Target throughput: {required_ops_per_sec:.6f} ops/sec")
		
		# Test with scaled-down simulation (process for 60 seconds instead of full day)
		simulation_duration = 60  # seconds
		target_ops_for_simulation = max(int(required_ops_per_sec * simulation_duration * 10), 50)  # 10x multiplier for testing
		
		print(f"   Simulation: {target_ops_for_simulation} operations in {simulation_duration} seconds")
		
		opportunities = self.generate_test_opportunities(target_ops_for_simulation)
		org_capabilities = self.get_test_org_capabilities()
		
		throughput_metrics = PerformanceMetrics()
		throughput_metrics.start_measurement()
		
		# Process opportunities with optimal concurrency
		optimal_concurrency = min(10, target_ops_for_simulation // 5)  # Adjust based on system capacity
		
		completed_operations = 0
		simulation_start = time.time()
		
		for i in range(0, len(opportunities), optimal_concurrency):
			# Check if we've exceeded simulation duration
			elapsed_time = time.time() - simulation_start
			if elapsed_time > simulation_duration:
				break
			
			batch = opportunities[i:i + optimal_concurrency]
			
			# Process batch
			batch_tasks = [
				self._process_single_opportunity_performance(opp, org_capabilities)
				for opp in batch
			]
			
			batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
			
			# Record results
			for result in batch_results:
				if isinstance(result, Exception):
					throughput_metrics.record_operation(0.5, False)  # Estimated time for failed operation
				else:
					throughput_metrics.record_operation(result['processing_time'], result['success'])
					if result['success']:
						completed_operations += 1
		
		throughput_metrics.end_measurement()
		
		# Calculate daily throughput projection
		actual_duration = time.time() - simulation_start
		actual_throughput = completed_operations / actual_duration
		projected_daily_throughput = actual_throughput * seconds_per_day
		
		throughput_summary = throughput_metrics.get_summary()
		throughput_summary.update({
			'simulation_duration': actual_duration,
			'completed_operations': completed_operations,
			'actual_throughput_ops_per_sec': actual_throughput,
			'projected_daily_throughput': projected_daily_throughput,
			'meets_daily_target': projected_daily_throughput >= target_daily_ops,
			'target_daily_ops': target_daily_ops,
			'throughput_ratio': projected_daily_throughput / target_daily_ops
		})
		
		print(f"✅ Daily throughput simulation completed")
		print(f"   Projected daily throughput: {projected_daily_throughput:.0f} opportunities/day")
		print(f"   Target achievement: {throughput_summary['throughput_ratio']:.2f}x")
		
		return throughput_summary
	
	async def test_memory_and_cpu_efficiency(self) -> Dict[str, Any]:
		"""Test memory and CPU efficiency under load"""
		
		print("💾 Testing memory and CPU efficiency...")
		
		opportunities = self.generate_test_opportunities(200)
		org_capabilities = self.get_test_org_capabilities()
		
		# Monitor system resources
		process = psutil.Process()
		initial_memory = process.memory_info().rss / 1024 / 1024  # MB
		initial_cpu_times = process.cpu_times()
		
		efficiency_metrics = PerformanceMetrics()
		efficiency_metrics.start_measurement()
		
		# Process opportunities while monitoring resources
		memory_samples = [initial_memory]
		cpu_samples = []
		
		for i, opportunity in enumerate(opportunities):
			start_time = time.time()
			
			try:
				# Process opportunity
				analysis = await self.opportunity_analyzer.analyze_opportunity(opportunity)
				qualification = await self.qualification_analyzer.analyze_qualification(opportunity, org_capabilities)
				
				processing_time = time.time() - start_time
				efficiency_metrics.record_operation(processing_time, True)
				
				# Sample resources every 10 operations
				if i % 10 == 0:
					current_memory = process.memory_info().rss / 1024 / 1024  # MB
					memory_samples.append(current_memory)
					
					current_cpu = psutil.cpu_percent()
					cpu_samples.append(current_cpu)
			
			except Exception as e:
				processing_time = time.time() - start_time
				efficiency_metrics.record_operation(processing_time, False)
		
		efficiency_metrics.end_measurement()
		
		# Final resource measurements
		final_memory = process.memory_info().rss / 1024 / 1024  # MB
		final_cpu_times = process.cpu_times()
		
		efficiency_summary = efficiency_metrics.get_summary()
		efficiency_summary.update({
			'initial_memory_mb': initial_memory,
			'final_memory_mb': final_memory,
			'peak_memory_mb': max(memory_samples),
			'memory_growth_mb': final_memory - initial_memory,
			'avg_memory_mb': statistics.mean(memory_samples),
			'cpu_samples': cpu_samples,
			'avg_cpu_percent': statistics.mean(cpu_samples) if cpu_samples else 0,
			'memory_per_operation_kb': (final_memory - initial_memory) * 1024 / max(efficiency_metrics.total_operations, 1)
		})
		
		print(f"✅ Resource efficiency test completed")
		print(f"   Memory growth: {efficiency_summary['memory_growth_mb']:.1f} MB")
		print(f"   Memory per operation: {efficiency_summary['memory_per_operation_kb']:.1f} KB")
		print(f"   Average CPU: {efficiency_summary['avg_cpu_percent']:.1f}%")
		
		return efficiency_summary


# Test cases
@pytest.mark.asyncio
async def test_component_performance_benchmarks():
	"""Test individual component performance benchmarks"""
	
	suite = PerformanceTestSuite()
	component_results = await suite.test_individual_component_performance()
	
	# Performance assertions for each component
	
	# OpportunityAnalyzer benchmarks
	opp_analyzer = component_results['opportunity_analyzer']
	assert opp_analyzer['success_rate'] >= 0.9  # 90% success rate
	assert opp_analyzer['avg_processing_time'] < 5.0  # Average under 5 seconds
	assert opp_analyzer['p95_processing_time'] < 10.0  # 95th percentile under 10 seconds
	
	# QualificationAnalyzer benchmarks
	qual_analyzer = component_results['qualification_analyzer']
	assert qual_analyzer['success_rate'] >= 0.85  # 85% success rate
	assert qual_analyzer['avg_processing_time'] < 8.0  # Average under 8 seconds
	assert qual_analyzer['p95_processing_time'] < 15.0  # 95th percentile under 15 seconds
	
	# CapabilityMatcher benchmarks
	cap_matcher = component_results['capability_matcher']
	assert cap_matcher['success_rate'] >= 0.95  # 95% success rate
	assert cap_matcher['avg_processing_time'] < 2.0  # Average under 2 seconds
	assert cap_matcher['p95_processing_time'] < 5.0  # 95th percentile under 5 seconds
	
	print("✅ Component performance benchmarks passed")
	print(f"   OpportunityAnalyzer: {opp_analyzer['avg_processing_time']:.2f}s avg")
	print(f"   QualificationAnalyzer: {qual_analyzer['avg_processing_time']:.2f}s avg")
	print(f"   CapabilityMatcher: {cap_matcher['avg_processing_time']:.2f}s avg")


@pytest.mark.asyncio
async def test_concurrent_processing_performance():
	"""Test concurrent processing performance and scalability"""
	
	suite = PerformanceTestSuite()
	
	# Test different concurrency levels
	concurrency_levels = [1, 3, 5, 8]
	results = {}
	
	for concurrency in concurrency_levels:
		result = await suite.test_concurrent_processing(concurrency)
		results[f"concurrency_{concurrency}"] = result
	
	# Verify that concurrency improves throughput
	single_threaded_throughput = results['concurrency_1']['throughput_ops_per_sec']
	concurrent_throughput = results['concurrency_5']['throughput_ops_per_sec']
	
	# Concurrent processing should provide better throughput (at least 2x improvement)
	improvement_ratio = concurrent_throughput / single_threaded_throughput
	assert improvement_ratio >= 2.0, f"Concurrency improvement ratio {improvement_ratio:.2f} too low"
	
	# All concurrency levels should maintain good success rates
	for concurrency_result in results.values():
		assert concurrency_result['success_rate'] >= 0.8  # 80% success rate minimum
	
	print("✅ Concurrent processing performance test passed")
	print(f"   Single-threaded: {single_threaded_throughput:.2f} ops/sec")
	print(f"   Concurrent (5): {concurrent_throughput:.2f} ops/sec")
	print(f"   Improvement: {improvement_ratio:.2f}x")


@pytest.mark.asyncio
async def test_daily_throughput_target():
	"""Test ability to process 1000+ opportunities per day"""
	
	suite = PerformanceTestSuite()
	throughput_result = await suite.test_daily_throughput_simulation(1000)
	
	# Primary requirement: must meet daily throughput target
	assert throughput_result['meets_daily_target'] is True, \
		f"Daily throughput target not met: {throughput_result['projected_daily_throughput']:.0f}/1000"
	
	# Quality requirements
	assert throughput_result['success_rate'] >= 0.85  # 85% success rate
	assert throughput_result['avg_processing_time'] < 30.0  # Average under 30 seconds per opportunity
	
	# Verify we have sufficient margin (at least 20% above target)
	assert throughput_result['throughput_ratio'] >= 1.2, \
		f"Insufficient throughput margin: {throughput_result['throughput_ratio']:.2f}x"
	
	print("✅ Daily throughput target test passed")
	print(f"   Projected daily capacity: {throughput_result['projected_daily_throughput']:.0f} opportunities")
	print(f"   Target achievement: {throughput_result['throughput_ratio']:.2f}x")
	print(f"   Success rate: {throughput_result['success_rate']:.1%}")


@pytest.mark.asyncio
async def test_resource_efficiency():
	"""Test memory and CPU efficiency under sustained load"""
	
	suite = PerformanceTestSuite()
	efficiency_result = await suite.test_memory_and_cpu_efficiency()
	
	# Memory efficiency requirements
	assert efficiency_result['memory_per_operation_kb'] < 500  # Less than 500KB per operation
	assert efficiency_result['memory_growth_mb'] < 200  # Less than 200MB total growth
	
	# CPU efficiency requirements
	assert efficiency_result['avg_cpu_percent'] < 80  # Average CPU usage under 80%
	
	# Success rate under sustained load
	assert efficiency_result['success_rate'] >= 0.85  # 85% success rate
	
	print("✅ Resource efficiency test passed")
	print(f"   Memory per operation: {efficiency_result['memory_per_operation_kb']:.1f} KB")
	print(f"   Total memory growth: {efficiency_result['memory_growth_mb']:.1f} MB")
	print(f"   Average CPU usage: {efficiency_result['avg_cpu_percent']:.1f}%")


@pytest.mark.asyncio
async def test_stress_test_high_volume():
	"""Stress test with high volume processing"""
	
	suite = PerformanceTestSuite()
	
	# Generate larger dataset for stress testing
	opportunities = suite.generate_test_opportunities(500)  # 500 opportunities
	org_capabilities = suite.get_test_org_capabilities()
	
	print("🔥 Running high-volume stress test...")
	
	stress_metrics = PerformanceMetrics()
	stress_metrics.start_measurement()
	
	# Process in optimal batch sizes
	batch_size = 8
	successful_batches = 0
	total_batches = 0
	
	for i in range(0, len(opportunities), batch_size):
		batch = opportunities[i:i + batch_size]
		total_batches += 1
		
		batch_start = time.time()
		
		try:
			# Process batch
			batch_tasks = [
				suite._process_single_opportunity_performance(opp, org_capabilities)
				for opp in batch
			]
			
			batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
			
			batch_time = time.time() - batch_start
			
			# Record results
			batch_success_count = 0
			for result in batch_results:
				if isinstance(result, Exception):
					stress_metrics.record_operation(batch_time / len(batch), False)
				else:
					stress_metrics.record_operation(result['processing_time'], result['success'])
					if result['success']:
						batch_success_count += 1
			
			if batch_success_count >= len(batch) * 0.8:  # 80% of batch successful
				successful_batches += 1
		
		except Exception as e:
			# Batch failed entirely
			for _ in range(len(batch)):
				stress_metrics.record_operation(10.0, False)  # Estimated failure time
	
	stress_metrics.end_measurement()
	
	stress_summary = stress_metrics.get_summary()
	
	# Stress test requirements
	assert stress_summary['success_rate'] >= 0.75  # 75% success rate under stress
	assert stress_summary['throughput_ops_per_sec'] >= 0.1  # Minimum throughput maintained
	assert successful_batches / total_batches >= 0.8  # 80% of batches mostly successful
	
	print("✅ High-volume stress test passed")
	print(f"   Processed {stress_summary['total_operations']} operations")
	print(f"   Success rate: {stress_summary['success_rate']:.1%}")
	print(f"   Throughput: {stress_summary['throughput_ops_per_sec']:.2f} ops/sec")
	print(f"   Batch success rate: {successful_batches/total_batches:.1%}")


@pytest.mark.asyncio
async def test_latency_requirements():
	"""Test latency requirements for real-time processing"""
	
	suite = PerformanceTestSuite()
	opportunities = suite.generate_test_opportunities(100)
	org_capabilities = suite.get_test_org_capabilities()
	
	print("⏱️  Testing latency requirements...")
	
	latency_measurements = []
	
	# Process opportunities individually to measure latency
	for opportunity in opportunities[:50]:  # Test with 50 opportunities
		start_time = time.time()
		
		try:
			# Fast-track processing for latency testing
			analysis = await suite.opportunity_analyzer.analyze_opportunity(opportunity)
			
			latency = time.time() - start_time
			latency_measurements.append(latency)
			
		except Exception:
			# Record timeout for failed operations
			latency_measurements.append(30.0)
	
	# Calculate latency statistics
	avg_latency = statistics.mean(latency_measurements)
	median_latency = statistics.median(latency_measurements)
	p95_latency = statistics.quantiles(latency_measurements, n=20)[18] if len(latency_measurements) > 20 else max(latency_measurements)
	p99_latency = statistics.quantiles(latency_measurements, n=100)[98] if len(latency_measurements) > 100 else max(latency_measurements)
	
	# Latency requirements
	assert avg_latency < 10.0  # Average latency under 10 seconds
	assert median_latency < 8.0  # Median latency under 8 seconds
	assert p95_latency < 20.0  # 95th percentile under 20 seconds
	assert p99_latency < 30.0  # 99th percentile under 30 seconds
	
	print("✅ Latency requirements test passed")
	print(f"   Average latency: {avg_latency:.2f}s")
	print(f"   Median latency: {median_latency:.2f}s")
	print(f"   P95 latency: {p95_latency:.2f}s")
	print(f"   P99 latency: {p99_latency:.2f}s")


if __name__ == "__main__":
	# Run all performance tests
	import sys
	
	async def run_all_performance_tests():
		print("🚀 Running Discovery Engine Performance Tests")
		print("=" * 60)
		
		performance_tests = [
			test_component_performance_benchmarks,
			test_concurrent_processing_performance,
			test_daily_throughput_target,
			test_resource_efficiency,
			test_latency_requirements,
			test_stress_test_high_volume
		]
		
		passed = 0
		failed = 0
		
		start_time = time.time()
		
		for test_func in performance_tests:
			try:
				print(f"\n🧪 Running {test_func.__name__}")
				await test_func()
				passed += 1
			except Exception as e:
				print(f"❌ {test_func.__name__} failed: {str(e)}")
				failed += 1
		
		total_time = time.time() - start_time
		
		print("\n" + "=" * 60)
		print(f"📊 Performance Test Results: {passed} passed, {failed} failed")
		print(f"🕐 Total test time: {total_time:.1f} seconds")
		
		if failed == 0:
			print("🎉 All performance tests passed!")
			print("✅ System meets 1000+ opportunities/day throughput requirement")
			return 0
		else:
			print("💥 Some performance tests failed!")
			return 1
	
	sys.exit(asyncio.run(run_all_performance_tests()))