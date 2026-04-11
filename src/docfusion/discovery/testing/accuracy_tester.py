#!/usr/bin/env python3
"""
Opportunity Detection Accuracy Tester

Tests and validates the accuracy of opportunity detection across
different procurement sources, extraction methods, and data quality scenarios.
Provides comprehensive metrics and benchmarking capabilities.
"""

import asyncio
import json
import logging
import statistics
from typing import Dict, List, Optional, Any, Tuple, Set
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dataclasses import dataclass
from enum import Enum
import tempfile

from pydantic import BaseModel, Field, validator
from ...core.utils import uuid7str

from ..crawlers.source_databases.global_source_db import GlobalSourceDB, ProcurementSource
from ..crawlers.ai_driven.universal_scraper import UniversalScraper, ScrapingConfiguration
from ..crawlers.ai_driven.structure_learner import StructureLearner, create_extraction_attempt
from ..models.opportunity_models import OpportunityData as Opportunity


class TestType(Enum):
	"""Type of accuracy test"""
	DETECTION_ACCURACY = "detection_accuracy"
	EXTRACTION_QUALITY = "extraction_quality"
	FALSE_POSITIVE_RATE = "false_positive_rate"
	PRECISION_RECALL = "precision_recall"
	CROSS_VALIDATION = "cross_validation"
	BENCHMARK_COMPARISON = "benchmark_comparison"


class TestStatus(Enum):
	"""Status of test execution"""
	PENDING = "pending"
	RUNNING = "running"
	COMPLETED = "completed"
	FAILED = "failed"
	CANCELLED = "cancelled"


@dataclass
class GroundTruthData:
	"""Ground truth data for accuracy testing"""
	source_url: str
	expected_opportunities: List[Dict[str, Any]]
	page_content_hash: Optional[str] = None
	created_at: datetime = None
	validated_by: Optional[str] = None
	notes: Optional[str] = None


class AccuracyMetrics(BaseModel):
	"""Accuracy metrics for opportunity detection"""
	
	# Basic detection metrics
	true_positives: int = 0
	false_positives: int = 0
	true_negatives: int = 0
	false_negatives: int = 0
	
	# Calculated metrics
	precision: float = 0.0
	recall: float = 0.0
	f1_score: float = 0.0
	accuracy: float = 0.0
	specificity: float = 0.0
	
	# Quality metrics
	avg_title_similarity: float = 0.0
	avg_description_similarity: float = 0.0
	avg_deadline_accuracy: float = 0.0
	avg_value_accuracy: float = 0.0
	
	# Performance metrics
	avg_extraction_time: float = 0.0
	success_rate: float = 0.0
	error_rate: float = 0.0
	
	# Confidence metrics
	avg_confidence_score: float = 0.0
	confidence_calibration: float = 0.0  # How well confidence predicts accuracy


class TestResult(BaseModel):
	"""Result of an accuracy test"""
	test_id: str = Field(default_factory=uuid7str)
	test_type: TestType
	test_name: str
	
	# Test configuration
	source_id: Optional[str] = None
	extraction_method: Optional[str] = None
	test_parameters: Dict[str, Any] = Field(default_factory=dict)
	
	# Execution info
	status: TestStatus = TestStatus.PENDING
	started_at: Optional[datetime] = None
	completed_at: Optional[datetime] = None
	duration_seconds: Optional[float] = None
	
	# Results
	total_samples: int = 0
	processed_samples: int = 0
	metrics: Optional[AccuracyMetrics] = None
	
	# Detailed results
	sample_results: List[Dict[str, Any]] = Field(default_factory=list)
	error_log: List[str] = Field(default_factory=list)
	
	# Metadata
	ground_truth_version: Optional[str] = None
	test_environment: Dict[str, Any] = Field(default_factory=dict)
	notes: Optional[str] = None


class TestConfig(BaseModel):
	"""Configuration for accuracy testing"""
	config_id: str = Field(default_factory=uuid7str)
	
	# Test selection
	test_types: List[TestType] = Field(default_factory=lambda: [TestType.DETECTION_ACCURACY])
	source_selection: str = "all"  # "all", "random", "specific", "high_priority"
	max_sources_per_test: int = 50
	samples_per_source: int = 10
	
	# Ground truth
	use_existing_ground_truth: bool = True
	create_ground_truth_if_missing: bool = True
	ground_truth_validation_threshold: float = 0.8
	
	# Extraction methods to test
	extraction_methods: List[str] = Field(default_factory=lambda: [
		"crawl4ai_llm", "crawl4ai_cosine", "cloudscraper", 
		"playwright_stealth", "vision_analysis"
	])
	
	# Quality thresholds
	min_precision: float = 0.7
	min_recall: float = 0.6
	min_f1_score: float = 0.65
	max_false_positive_rate: float = 0.3
	
	# Performance requirements
	max_avg_extraction_time: float = 30.0
	min_success_rate: float = 0.8
	
	# Test execution
	parallel_tests: int = 3
	test_timeout_minutes: int = 60
	retry_failed_extractions: bool = True
	max_retries: int = 2
	
	# Reporting
	generate_detailed_report: bool = True
	export_results: bool = True
	notification_on_completion: bool = True


class AccuracyTester:
	"""
	Comprehensive accuracy testing system for opportunity detection
	"""
	
	def __init__(
		self,
		global_db: Optional[GlobalSourceDB] = None,
		structure_learner: Optional[StructureLearner] = None,
		config: Optional[TestConfig] = None,
		testing_dir: Optional[Path] = None
	):
		self.logger = logging.getLogger(__name__)
		
		# Dependencies
		self.global_db = global_db or GlobalSourceDB()
		self.structure_learner = structure_learner
		self.config = config or TestConfig()
		
		# Storage
		self.testing_dir = testing_dir or Path(tempfile.gettempdir()) / "accuracy_testing"
		self.testing_dir.mkdir(exist_ok=True)
		
		# Ground truth data
		self.ground_truth_data: Dict[str, GroundTruthData] = {}
		self.ground_truth_file = self.testing_dir / "ground_truth.json"
		
		# Test state
		self.active_tests: Dict[str, TestResult] = {}
		self.completed_tests: Dict[str, TestResult] = {}
		
		# Statistics
		self.testing_stats = {
			'total_tests_run': 0,
			'successful_tests': 0,
			'failed_tests': 0,
			'total_samples_processed': 0,
			'avg_test_duration': 0.0,
			'last_test_completion': None,
			'ground_truth_entries': 0
		}
		
		# Load existing ground truth
		asyncio.create_task(self._load_ground_truth())
	
	async def _load_ground_truth(self):
		"""Load existing ground truth data"""
		
		try:
			if self.ground_truth_file.exists():
				with open(self.ground_truth_file, 'r') as f:
					data = json.load(f)
				
				for url, gt_data in data.items():
					self.ground_truth_data[url] = GroundTruthData(
						source_url=url,
						expected_opportunities=gt_data['expected_opportunities'],
						page_content_hash=gt_data.get('page_content_hash'),
						created_at=datetime.fromisoformat(gt_data['created_at']) if gt_data.get('created_at') else None,
						validated_by=gt_data.get('validated_by'),
						notes=gt_data.get('notes')
					)
				
				self.testing_stats['ground_truth_entries'] = len(self.ground_truth_data)
				self.logger.info(f"Loaded {len(self.ground_truth_data)} ground truth entries")
		
		except Exception as e:
			self.logger.warning(f"Failed to load ground truth data: {e}")
	
	async def _save_ground_truth(self):
		"""Save ground truth data to file"""
		
		try:
			data = {}
			for url, gt_data in self.ground_truth_data.items():
				data[url] = {
					'expected_opportunities': gt_data.expected_opportunities,
					'page_content_hash': gt_data.page_content_hash,
					'created_at': gt_data.created_at.isoformat() if gt_data.created_at else None,
					'validated_by': gt_data.validated_by,
					'notes': gt_data.notes
				}
			
			with open(self.ground_truth_file, 'w') as f:
				json.dump(data, f, indent=2, default=str)
				
		except Exception as e:
			self.logger.error(f"Failed to save ground truth data: {e}")
	
	async def run_accuracy_tests(
		self,
		test_types: Optional[List[TestType]] = None,
		source_filter: Optional[List[str]] = None
	) -> List[str]:
		"""
		Run comprehensive accuracy tests
		
		Args:
			test_types: Types of tests to run
			source_filter: Specific source IDs to test
			
		Returns:
			List of test IDs created
		"""
		
		if test_types is None:
			test_types = self.config.test_types
		
		test_ids = []
		
		try:
			self.logger.info(f"Starting accuracy tests: {[t.value for t in test_types]}")
			
			for test_type in test_types:
				test_id = await self._create_and_run_test(test_type, source_filter)
				if test_id:
					test_ids.append(test_id)
			
			return test_ids
			
		except Exception as e:
			self.logger.error(f"Accuracy testing failed: {e}")
			return test_ids
	
	async def _create_and_run_test(
		self,
		test_type: TestType,
		source_filter: Optional[List[str]] = None
	) -> Optional[str]:
		"""Create and run a specific test"""
		
		try:
			# Create test result
			test_result = TestResult(
				test_type=test_type,
				test_name=f"{test_type.value.replace('_', ' ').title()} Test",
				test_parameters={
					'source_filter': source_filter,
					'extraction_methods': self.config.extraction_methods,
					'samples_per_source': self.config.samples_per_source
				},
				test_environment={
					'config_version': self.config.config_id,
					'ground_truth_entries': len(self.ground_truth_data),
					'start_time': datetime.now(timezone.utc).isoformat()
				}
			)
			
			self.active_tests[test_result.test_id] = test_result
			
			# Run the test asynchronously
			asyncio.create_task(self._execute_test(test_result, source_filter))
			
			return test_result.test_id
			
		except Exception as e:
			self.logger.error(f"Failed to create test {test_type}: {e}")
			return None
	
	async def _execute_test(
		self,
		test_result: TestResult,
		source_filter: Optional[List[str]] = None
	):
		"""Execute a specific accuracy test"""
		
		try:
			test_result.status = TestStatus.RUNNING
			test_result.started_at = datetime.now(timezone.utc)
			
			# Get test sources
			test_sources = await self._get_test_sources(source_filter)
			test_result.total_samples = len(test_sources) * self.config.samples_per_source
			
			self.logger.info(f"Executing {test_result.test_name} on {len(test_sources)} sources")
			
			# Execute test based on type
			if test_result.test_type == TestType.DETECTION_ACCURACY:
				await self._test_detection_accuracy(test_result, test_sources)
			elif test_result.test_type == TestType.EXTRACTION_QUALITY:
				await self._test_extraction_quality(test_result, test_sources)
			elif test_result.test_type == TestType.FALSE_POSITIVE_RATE:
				await self._test_false_positive_rate(test_result, test_sources)
			elif test_result.test_type == TestType.PRECISION_RECALL:
				await self._test_precision_recall(test_result, test_sources)
			elif test_result.test_type == TestType.CROSS_VALIDATION:
				await self._test_cross_validation(test_result, test_sources)
			elif test_result.test_type == TestType.BENCHMARK_COMPARISON:
				await self._test_benchmark_comparison(test_result, test_sources)
			
			# Complete the test
			test_result.completed_at = datetime.now(timezone.utc)
			test_result.duration_seconds = (test_result.completed_at - test_result.started_at).total_seconds()
			test_result.status = TestStatus.COMPLETED
			
			# Move to completed tests
			if test_result.test_id in self.active_tests:
				del self.active_tests[test_result.test_id]
			self.completed_tests[test_result.test_id] = test_result
			
			# Update statistics
			self.testing_stats['total_tests_run'] += 1
			self.testing_stats['successful_tests'] += 1
			self.testing_stats['total_samples_processed'] += test_result.processed_samples
			self.testing_stats['last_test_completion'] = test_result.completed_at
			
			# Calculate average test duration
			completed_tests = list(self.completed_tests.values())
			durations = [t.duration_seconds for t in completed_tests if t.duration_seconds]
			if durations:
				self.testing_stats['avg_test_duration'] = statistics.mean(durations)
			
			self.logger.info(f"Completed {test_result.test_name} in {test_result.duration_seconds:.1f}s")
			
			# Generate report
			if self.config.generate_detailed_report:
				await self._generate_test_report(test_result)
			
		except Exception as e:
			test_result.status = TestStatus.FAILED
			test_result.error_log.append(str(e))
			self.testing_stats['failed_tests'] += 1
			self.logger.error(f"Test execution failed for {test_result.test_name}: {e}")
	
	async def _get_test_sources(self, source_filter: Optional[List[str]] = None) -> List[ProcurementSource]:
		"""Get sources for testing"""
		
		try:
			if source_filter:
				# Use specific sources
				sources = []
				for source_id in source_filter:
					source = await self.global_db.get_source_by_id(source_id)
					if source:
						sources.append(source)
			else:
				# Get sources based on selection strategy
				all_sources = await self.global_db.get_all_sources()
				
				if self.config.source_selection == "all":
					sources = all_sources[:self.config.max_sources_per_test]
				elif self.config.source_selection == "random":
					import random
					sources = random.sample(all_sources, min(self.config.max_sources_per_test, len(all_sources)))
				elif self.config.source_selection == "high_priority":
					# Sort by health score and take top sources
					sorted_sources = sorted(all_sources, key=lambda s: s.health_score, reverse=True)
					sources = sorted_sources[:self.config.max_sources_per_test]
				else:
					sources = all_sources[:self.config.max_sources_per_test]
			
			return sources
			
		except Exception as e:
			self.logger.error(f"Failed to get test sources: {e}")
			return []
	
	async def _test_detection_accuracy(self, test_result: TestResult, sources: List[ProcurementSource]):
		"""Test basic opportunity detection accuracy"""
		
		metrics = AccuracyMetrics()
		extraction_times = []
		confidence_scores = []
		
		for source in sources:
			try:
				# Get or create ground truth for this source
				ground_truth = await self._get_or_create_ground_truth(source)
				if not ground_truth:
					continue
				
				# Test each extraction method
				for method in self.config.extraction_methods:
					start_time = asyncio.get_event_loop().time()
					
					# Create scraper for this method
					scraper = await self._create_test_scraper(method)
					
					# Extract opportunities
					scraping_result, extraction_result = await scraper.scrape_with_intelligence(
						source.base_url,
						use_learned_structure=True
					)
					
					extraction_time = asyncio.get_event_loop().time() - start_time
					extraction_times.append(extraction_time)
					
					if scraping_result.success and extraction_result:
						# Compare with ground truth
						comparison_result = await self._compare_with_ground_truth(
							extraction_result.opportunities,
							ground_truth.expected_opportunities
						)
						
						# Update metrics
						metrics.true_positives += comparison_result['true_positives']
						metrics.false_positives += comparison_result['false_positives']
						metrics.false_negatives += comparison_result['false_negatives']
						
						# Track confidence if available
						if extraction_result.confidence_score:
							confidence_scores.append(extraction_result.confidence_score)
						
						# Store sample result
						test_result.sample_results.append({
							'source_url': source.base_url,
							'extraction_method': method,
							'extraction_time': extraction_time,
							'opportunities_found': len(extraction_result.opportunities),
							'expected_opportunities': len(ground_truth.expected_opportunities),
							'comparison': comparison_result,
							'success': True
						})
					else:
						# Failed extraction
						test_result.sample_results.append({
							'source_url': source.base_url,
							'extraction_method': method,
							'error': scraping_result.error_message,
							'success': False
						})
					
					test_result.processed_samples += 1
					await scraper.cleanup()
				
			except Exception as e:
				test_result.error_log.append(f"Source {source.base_url}: {str(e)}")
				self.logger.warning(f"Test failed for source {source.base_url}: {e}")
		
		# Calculate final metrics
		metrics = self._calculate_metrics(metrics, extraction_times, confidence_scores)
		test_result.metrics = metrics
	
	async def _test_extraction_quality(self, test_result: TestResult, sources: List[ProcurementSource]):
		"""Test quality of extracted opportunity data"""
		
		metrics = AccuracyMetrics()
		title_similarities = []
		description_similarities = []
		deadline_accuracies = []
		
		for source in sources:
			try:
				ground_truth = await self._get_or_create_ground_truth(source)
				if not ground_truth:
					continue
				
				# Use the best performing extraction method
				scraper = await self._create_test_scraper("crawl4ai_llm")
				scraping_result, extraction_result = await scraper.scrape_with_intelligence(source.base_url)
				
				if scraping_result.success and extraction_result:
					# Compare data quality
					quality_metrics = await self._assess_data_quality(
						extraction_result.opportunities,
						ground_truth.expected_opportunities
					)
					
					title_similarities.extend(quality_metrics['title_similarities'])
					description_similarities.extend(quality_metrics['description_similarities'])
					deadline_accuracies.extend(quality_metrics['deadline_accuracies'])
				
				await scraper.cleanup()
				test_result.processed_samples += 1
				
			except Exception as e:
				test_result.error_log.append(f"Quality test failed for {source.base_url}: {str(e)}")
		
		# Calculate quality metrics
		if title_similarities:
			metrics.avg_title_similarity = statistics.mean(title_similarities)
		if description_similarities:
			metrics.avg_description_similarity = statistics.mean(description_similarities)
		if deadline_accuracies:
			metrics.avg_deadline_accuracy = statistics.mean(deadline_accuracies)
		
		test_result.metrics = metrics
	
	async def _test_false_positive_rate(self, test_result: TestResult, sources: List[ProcurementSource]):
		"""Test false positive rate by using non-procurement pages"""
		
		metrics = AccuracyMetrics()
		
		# Test on known non-procurement pages
		non_procurement_urls = [
			"https://www.example.com",
			"https://www.google.com",
			"https://www.wikipedia.org",
			"https://www.amazon.com",
			"https://www.facebook.com"
		]
		
		for url in non_procurement_urls:
			try:
				scraper = await self._create_test_scraper("crawl4ai_llm")
				scraping_result, extraction_result = await scraper.scrape_with_intelligence(url)
				
				if scraping_result.success and extraction_result:
					# Any opportunities found on these pages are false positives
					false_positives = len(extraction_result.opportunities)
					metrics.false_positives += false_positives
					metrics.true_negatives += 1 if false_positives == 0 else 0
					
					test_result.sample_results.append({
						'url': url,
						'opportunities_found': false_positives,
						'expected_opportunities': 0,
						'is_false_positive': false_positives > 0
					})
				else:
					metrics.true_negatives += 1
				
				await scraper.cleanup()
				test_result.processed_samples += 1
				
			except Exception as e:
				test_result.error_log.append(f"False positive test failed for {url}: {str(e)}")
		
		test_result.metrics = metrics
	
	async def _test_precision_recall(self, test_result: TestResult, sources: List[ProcurementSource]):
		"""Test precision and recall across different scenarios"""
		
		# This combines detection accuracy with quality assessment
		await self._test_detection_accuracy(test_result, sources)
		
		# Add precision/recall calculation
		if test_result.metrics:
			metrics = test_result.metrics
			
			if (metrics.true_positives + metrics.false_positives) > 0:
				metrics.precision = metrics.true_positives / (metrics.true_positives + metrics.false_positives)
			
			if (metrics.true_positives + metrics.false_negatives) > 0:
				metrics.recall = metrics.true_positives / (metrics.true_positives + metrics.false_negatives)
			
			if (metrics.precision + metrics.recall) > 0:
				metrics.f1_score = 2 * (metrics.precision * metrics.recall) / (metrics.precision + metrics.recall)
	
	async def _test_cross_validation(self, test_result: TestResult, sources: List[ProcurementSource]):
		"""Perform cross-validation testing"""
		
		# Split sources into training and validation sets
		import random
		random.shuffle(sources)
		
		fold_size = len(sources) // 5  # 5-fold cross-validation
		fold_metrics = []
		
		for fold in range(5):
			start_idx = fold * fold_size
			end_idx = start_idx + fold_size if fold < 4 else len(sources)
			
			validation_sources = sources[start_idx:end_idx]
			training_sources = sources[:start_idx] + sources[end_idx:]
			
			# Test on validation set
			fold_result = TestResult(
				test_type=TestType.DETECTION_ACCURACY,
				test_name=f"Cross-validation fold {fold + 1}"
			)
			
			await self._test_detection_accuracy(fold_result, validation_sources)
			
			if fold_result.metrics:
				fold_metrics.append(fold_result.metrics)
				test_result.sample_results.append({
					'fold': fold + 1,
					'validation_sources': len(validation_sources),
					'metrics': fold_result.metrics.dict()
				})
		
		# Calculate average metrics across folds
		if fold_metrics:
			avg_metrics = AccuracyMetrics()
			avg_metrics.precision = statistics.mean(m.precision for m in fold_metrics)
			avg_metrics.recall = statistics.mean(m.recall for m in fold_metrics)
			avg_metrics.f1_score = statistics.mean(m.f1_score for m in fold_metrics)
			avg_metrics.accuracy = statistics.mean(m.accuracy for m in fold_metrics)
			
			test_result.metrics = avg_metrics
		
		test_result.processed_samples = len(sources)
	
	async def _test_benchmark_comparison(self, test_result: TestResult, sources: List[ProcurementSource]):
		"""Compare performance against benchmark methods"""
		
		# Define benchmark methods (simpler extraction strategies)
		benchmark_methods = ["cloudscraper", "playwright_css"]
		advanced_methods = ["crawl4ai_llm", "vision_analysis"]
		
		benchmark_results = {}
		
		for method_group, methods in [("benchmark", benchmark_methods), ("advanced", advanced_methods)]:
			group_metrics = AccuracyMetrics()
			
			for source in sources[:10]:  # Test on subset for benchmark
				try:
					ground_truth = await self._get_or_create_ground_truth(source)
					if not ground_truth:
						continue
					
					for method in methods:
						scraper = await self._create_test_scraper(method)
						scraping_result, extraction_result = await scraper.scrape_with_intelligence(source.base_url)
						
						if scraping_result.success and extraction_result:
							comparison = await self._compare_with_ground_truth(
								extraction_result.opportunities,
								ground_truth.expected_opportunities
							)
							
							group_metrics.true_positives += comparison['true_positives']
							group_metrics.false_positives += comparison['false_positives']
							group_metrics.false_negatives += comparison['false_negatives']
						
						await scraper.cleanup()
				
				except Exception as e:
					test_result.error_log.append(f"Benchmark test failed: {str(e)}")
			
			benchmark_results[method_group] = self._calculate_metrics(group_metrics, [], [])
		
		# Store comparison results
		test_result.sample_results = [
			{
				'method_group': group,
				'metrics': metrics.dict()
			}
			for group, metrics in benchmark_results.items()
		]
		
		# Use advanced methods metrics as final result
		test_result.metrics = benchmark_results.get("advanced", AccuracyMetrics())
		test_result.processed_samples = len(sources) * len(benchmark_methods + advanced_methods)
	
	async def _create_test_scraper(self, method: str) -> UniversalScraper:
		"""Create a scraper configured for testing"""
		
		config = ScrapingConfiguration(
			max_concurrent=1,  # Single threaded for testing
			request_timeout=30,
			rate_limit_requests_per_minute=30,
			user_agent="ProposalWriter-AccuracyTester/1.0"
		)
		
		return UniversalScraper(config)
	
	async def _get_or_create_ground_truth(self, source: ProcurementSource) -> Optional[GroundTruthData]:
		"""Get existing or create new ground truth data"""
		
		url = source.base_url
		
		# Check if we have existing ground truth
		if url in self.ground_truth_data:
			return self.ground_truth_data[url]
		
		# Create new ground truth if enabled
		if self.config.create_ground_truth_if_missing:
			ground_truth = await self._create_ground_truth_data(source)
			if ground_truth:
				self.ground_truth_data[url] = ground_truth
				await self._save_ground_truth()
				self.testing_stats['ground_truth_entries'] += 1
				return ground_truth
		
		return None
	
	async def _create_ground_truth_data(self, source: ProcurementSource) -> Optional[GroundTruthData]:
		"""Create ground truth data for a source"""
		
		try:
			# Use the most reliable method to extract initial data
			scraper = await self._create_test_scraper("crawl4ai_llm")
			scraping_result, extraction_result = await scraper.scrape_with_intelligence(source.base_url)
			
			if scraping_result.success and extraction_result and extraction_result.opportunities:
				# Convert opportunities to ground truth format
				expected_opportunities = []
				for opp in extraction_result.opportunities:
					expected_opportunities.append({
						'title': opp.title,
						'description': opp.description or "",
						'deadline': opp.deadline.isoformat() if opp.deadline else None,
						'estimated_value': opp.estimated_value,
						'source_url': opp.source_url,
						'procurement_type': opp.procurement_type or "",
						'organization': opp.organization or ""
					})
				
				ground_truth = GroundTruthData(
					source_url=source.base_url,
					expected_opportunities=expected_opportunities,
					created_at=datetime.now(timezone.utc),
					validated_by="auto_generated",
					notes="Auto-generated from crawl4ai_llm extraction"
				)
				
				await scraper.cleanup()
				return ground_truth
			
			await scraper.cleanup()
			
		except Exception as e:
			self.logger.warning(f"Failed to create ground truth for {source.base_url}: {e}")
		
		return None
	
	async def _compare_with_ground_truth(
		self,
		extracted_opportunities: List[Opportunity],
		expected_opportunities: List[Dict[str, Any]]
	) -> Dict[str, int]:
		"""Compare extracted opportunities with ground truth"""
		
		result = {
			'true_positives': 0,
			'false_positives': 0,
			'false_negatives': 0
		}
		
		try:
			# Convert extracted opportunities to comparable format
			extracted_data = []
			for opp in extracted_opportunities:
				extracted_data.append({
					'title': opp.title.lower() if opp.title else "",
					'description': (opp.description or "").lower(),
					'deadline': opp.deadline.isoformat() if opp.deadline else None,
					'estimated_value': opp.estimated_value
				})
			
			# Find matches using title similarity and other criteria
			matched_extracted = set()
			matched_expected = set()
			
			for i, expected in enumerate(expected_opportunities):
				expected_title = expected.get('title', '').lower()
				
				best_match = -1
				best_similarity = 0
				
				for j, extracted in enumerate(extracted_data):
					if j in matched_extracted:
						continue
					
					# Calculate title similarity
					similarity = self._calculate_text_similarity(expected_title, extracted['title'])
					
					# Boost similarity if other fields match
					if expected.get('deadline') == extracted.get('deadline'):
						similarity += 0.2
					if abs((expected.get('estimated_value') or 0) - (extracted.get('estimated_value') or 0)) < 1000:
						similarity += 0.1
					
					if similarity > best_similarity and similarity > 0.7:  # Threshold for match
						best_similarity = similarity
						best_match = j
				
				if best_match >= 0:
					result['true_positives'] += 1
					matched_extracted.add(best_match)
					matched_expected.add(i)
			
			# Count false positives and false negatives
			result['false_positives'] = len(extracted_data) - len(matched_extracted)
			result['false_negatives'] = len(expected_opportunities) - len(matched_expected)
			
		except Exception as e:
			self.logger.error(f"Ground truth comparison failed: {e}")
		
		return result
	
	def _calculate_text_similarity(self, text1: str, text2: str) -> float:
		"""Calculate similarity between two text strings"""
		
		try:
			# Simple word overlap similarity
			if not text1 or not text2:
				return 0.0
			
			words1 = set(text1.lower().split())
			words2 = set(text2.lower().split())
			
			if not words1 or not words2:
				return 0.0
			
			intersection = words1 & words2
			union = words1 | words2
			
			return len(intersection) / len(union) if union else 0.0
			
		except Exception as e:
			self.logger.warning(f"Failed to calculate word overlap: {e}")
			return 0.0
	
	async def _assess_data_quality(
		self,
		extracted_opportunities: List[Opportunity],
		expected_opportunities: List[Dict[str, Any]]
	) -> Dict[str, List[float]]:
		"""Assess quality of extracted data fields"""
		
		quality_metrics = {
			'title_similarities': [],
			'description_similarities': [],
			'deadline_accuracies': []
		}
		
		try:
			# Find best matches and assess field quality
			for expected in expected_opportunities:
				expected_title = expected.get('title', '').lower()
				
				best_match = None
				best_similarity = 0
				
				for extracted in extracted_opportunities:
					similarity = self._calculate_text_similarity(expected_title, extracted.title.lower() if extracted.title else "")
					if similarity > best_similarity:
						best_similarity = similarity
						best_match = extracted
				
				if best_match and best_similarity > 0.5:
					# Title similarity
					quality_metrics['title_similarities'].append(best_similarity)
					
					# Description similarity
					expected_desc = expected.get('description', '').lower()
					extracted_desc = (best_match.description or '').lower()
					desc_sim = self._calculate_text_similarity(expected_desc, extracted_desc)
					quality_metrics['description_similarities'].append(desc_sim)
					
					# Deadline accuracy
					expected_deadline = expected.get('deadline')
					extracted_deadline = best_match.deadline.isoformat() if best_match.deadline else None
					deadline_acc = 1.0 if expected_deadline == extracted_deadline else 0.0
					quality_metrics['deadline_accuracies'].append(deadline_acc)
		
		except Exception as e:
			self.logger.error(f"Data quality assessment failed: {e}")
		
		return quality_metrics
	
	def _calculate_metrics(
		self,
		metrics: AccuracyMetrics,
		extraction_times: List[float],
		confidence_scores: List[float]
	) -> AccuracyMetrics:
		"""Calculate final accuracy metrics"""
		
		try:
			# Basic metrics
			total_predictions = metrics.true_positives + metrics.false_positives
			total_actual = metrics.true_positives + metrics.false_negatives
			total_samples = metrics.true_positives + metrics.false_positives + metrics.true_negatives + metrics.false_negatives
			
			if total_predictions > 0:
				metrics.precision = metrics.true_positives / total_predictions
			
			if total_actual > 0:
				metrics.recall = metrics.true_positives / total_actual
			
			if (metrics.precision + metrics.recall) > 0:
				metrics.f1_score = 2 * (metrics.precision * metrics.recall) / (metrics.precision + metrics.recall)
			
			if total_samples > 0:
				metrics.accuracy = (metrics.true_positives + metrics.true_negatives) / total_samples
				
				# Specificity
				true_negatives_plus_false_positives = metrics.true_negatives + metrics.false_positives
				if true_negatives_plus_false_positives > 0:
					metrics.specificity = metrics.true_negatives / true_negatives_plus_false_positives
			
			# Performance metrics
			if extraction_times:
				metrics.avg_extraction_time = statistics.mean(extraction_times)
				successful_extractions = len([t for t in extraction_times if t < self.config.max_avg_extraction_time])
				metrics.success_rate = successful_extractions / len(extraction_times)
				metrics.error_rate = 1.0 - metrics.success_rate
			
			# Confidence metrics
			if confidence_scores:
				metrics.avg_confidence_score = statistics.mean(confidence_scores)
				# Simple confidence calibration (can be improved)
				metrics.confidence_calibration = abs(metrics.avg_confidence_score - metrics.accuracy)
			
		except Exception as e:
			self.logger.error(f"Metrics calculation failed: {e}")
		
		return metrics
	
	async def _generate_test_report(self, test_result: TestResult):
		"""Generate detailed test report"""
		
		try:
			report = {
				'test_summary': {
					'test_id': test_result.test_id,
					'test_name': test_result.test_name,
					'test_type': test_result.test_type.value,
					'status': test_result.status.value,
					'duration_seconds': test_result.duration_seconds,
					'total_samples': test_result.total_samples,
					'processed_samples': test_result.processed_samples
				},
				'metrics': test_result.metrics.dict() if test_result.metrics else None,
				'sample_results': test_result.sample_results,
				'error_log': test_result.error_log,
				'test_parameters': test_result.test_parameters,
				'test_environment': test_result.test_environment
			}
			
			# Add quality assessment
			if test_result.metrics:
				m = test_result.metrics
				report['quality_assessment'] = {
					'precision_grade': self._grade_metric(m.precision, 0.8, 0.6),
					'recall_grade': self._grade_metric(m.recall, 0.7, 0.5),
					'f1_score_grade': self._grade_metric(m.f1_score, 0.75, 0.55),
					'overall_performance': 'excellent' if m.f1_score >= 0.8 else 
										  'good' if m.f1_score >= 0.65 else
										  'fair' if m.f1_score >= 0.4 else 'poor'
				}
			
			# Save report
			report_file = self.testing_dir / f"test_report_{test_result.test_id}.json"
			with open(report_file, 'w') as f:
				json.dump(report, f, indent=2, default=str)
			
			self.logger.info(f"Generated test report: {report_file}")
			
		except Exception as e:
			self.logger.error(f"Test report generation failed: {e}")
	
	def _grade_metric(self, value: float, excellent_threshold: float, good_threshold: float) -> str:
		"""Grade a metric value"""
		if value >= excellent_threshold:
			return 'excellent'
		elif value >= good_threshold:
			return 'good'
		elif value >= good_threshold * 0.7:
			return 'fair'
		else:
			return 'poor'
	
	def get_test_status(self, test_id: str) -> Optional[Dict[str, Any]]:
		"""Get status of a specific test"""
		
		test_result = self.active_tests.get(test_id) or self.completed_tests.get(test_id)
		if not test_result:
			return None
		
		return {
			'test_id': test_result.test_id,
			'test_name': test_result.test_name,
			'test_type': test_result.test_type.value,
			'status': test_result.status.value,
			'progress': test_result.processed_samples / max(test_result.total_samples, 1),
			'started_at': test_result.started_at,
			'duration_seconds': test_result.duration_seconds,
			'metrics': test_result.metrics.dict() if test_result.metrics else None,
			'error_count': len(test_result.error_log)
		}
	
	def get_all_test_results(self) -> Dict[str, Any]:
		"""Get results of all tests"""
		
		results = {
			'active_tests': [
				self.get_test_status(test_id) 
				for test_id in self.active_tests.keys()
			],
			'completed_tests': [
				self.get_test_status(test_id)
				for test_id in self.completed_tests.keys()
			],
			'testing_stats': self.testing_stats.copy()
		}
		
		return results
	
	async def add_ground_truth_data(
		self,
		source_url: str,
		expected_opportunities: List[Dict[str, Any]],
		validated_by: str,
		notes: Optional[str] = None
	) -> bool:
		"""Add manually validated ground truth data"""
		
		try:
			ground_truth = GroundTruthData(
				source_url=source_url,
				expected_opportunities=expected_opportunities,
				created_at=datetime.now(timezone.utc),
				validated_by=validated_by,
				notes=notes
			)
			
			self.ground_truth_data[source_url] = ground_truth
			await self._save_ground_truth()
			
			self.testing_stats['ground_truth_entries'] = len(self.ground_truth_data)
			self.logger.info(f"Added ground truth data for {source_url}")
			
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to add ground truth data: {e}")
			return False
	
	def get_testing_stats(self) -> Dict[str, Any]:
		"""Get accuracy testing statistics"""
		
		stats = self.testing_stats.copy()
		
		# Add current state
		stats.update({
			'active_tests': len(self.active_tests),
			'completed_tests': len(self.completed_tests),
			'ground_truth_entries': len(self.ground_truth_data)
		})
		
		# Add performance summary
		if self.completed_tests:
			completed = list(self.completed_tests.values())
			successful = [t for t in completed if t.status == TestStatus.COMPLETED and t.metrics]
			
			if successful:
				avg_precision = statistics.mean(t.metrics.precision for t in successful)
				avg_recall = statistics.mean(t.metrics.recall for t in successful)
				avg_f1 = statistics.mean(t.metrics.f1_score for t in successful)
				
				stats['performance_summary'] = {
					'avg_precision': avg_precision,
					'avg_recall': avg_recall,
					'avg_f1_score': avg_f1,
					'tests_with_good_performance': len([t for t in successful if t.metrics.f1_score >= 0.65])
				}
		
		return stats
	
	async def cleanup(self):
		"""Clean up testing resources"""
		
		try:
			# Cancel active tests
			for test_result in self.active_tests.values():
				test_result.status = TestStatus.CANCELLED
			
			# Save final ground truth data
			await self._save_ground_truth()
			
			self.logger.info("AccuracyTester cleanup completed")
			
		except Exception as e:
			self.logger.error(f"Cleanup failed: {e}")


# Factory function
def create_accuracy_tester(
	global_db: Optional[GlobalSourceDB] = None,
	structure_learner: Optional[StructureLearner] = None,
	config: Optional[TestConfig] = None
) -> AccuracyTester:
	"""Create an AccuracyTester instance"""
	return AccuracyTester(global_db, structure_learner, config)