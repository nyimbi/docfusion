#!/usr/bin/env python3
"""
Discovery Engine - AI-Driven Scrapers

Week 9 implementation of the Discovery Engine featuring comprehensive
AI-driven scraping capabilities with advanced pattern recognition,
machine learning optimization, and enterprise-grade monitoring.

Core Components:
- UniversalScraper: Multi-strategy AI-powered scraper with Crawl4AI, Playwright, and CloudScraper
- VisionScraper: Computer vision-based analysis with screenshot processing
- StructureLearner: ML-based pattern recognition and strategy optimization
- PatternRecognizer: Procurement-specific pattern detection with Qwen2.5VL
- GlobalSourceDB: Comprehensive database of 1000+ procurement sources worldwide
- SourceDiscoverer: Automatic procurement source discovery and validation
- ScraperDeployment: Enterprise deployment and orchestration system
- DeploymentMonitor: Real-time health monitoring and alerting
- PerformanceDashboard: Comprehensive performance visualization
- AccuracyTester: ML-driven accuracy testing and validation
- DataValidator: Advanced data quality assurance and validation

Key Features:
- AI-driven extraction with multiple fallback strategies
- Cloudflare bypass and anti-bot evasion
- Computer vision for visual content analysis
- ML-based continuous learning and optimization
- Real-time monitoring and health checks
- Comprehensive testing and validation framework
- Enterprise-grade deployment orchestration
- Global procurement source coverage
"""

import logging as _logging

_logger = _logging.getLogger(__name__)

# ---- Shared data models (always importable, no heavy deps) ----
from .models.opportunity_models import OpportunityData

# ---- Heavy scraper / ML / deployment components (optional) ----
# These require third-party packages (sklearn, playwright, etc.) that may
# not be installed in every environment.  Wrap in try/except so that
# lightweight consumers (e.g. the intelligence module) can still import
# OpportunityData without pulling the entire crawler tree.

try:
	# Core scrapers and extractors
	from .crawlers.generic.base_scraper import BaseScraper, ScrapingConfiguration, ScrapingResult
	from .crawlers.ai_driven.universal_scraper import UniversalScraper, ExtractionStrategy, ExtractionResult
	from .crawlers.ai_driven.vision_scraper import VisionScraper, VisionAnalysisResult, UIElement
	from .crawlers.ai_driven.structure_learner import StructureLearner, ExtractionAttempt, SitePattern, StrategyRecommendation
	from .crawlers.ai_driven.pattern_recognizer import PatternRecognizer, PatternMatch, ProcurementPattern

	# Source databases and discovery
	from .crawlers.source_databases.global_source_db import GlobalSourceDB, ProcurementSource, SourceType, SourceStatus
	from .crawlers.source_databases.source_discoverer import SourceDiscoverer, DiscoveryResult, SourcePattern

	# Deployment and orchestration
	from .deployment.scraper_deployment import ScraperDeployment, DeploymentConfig, DeploymentStatus, ScraperInstance
	from .deployment.deployment_monitor import DeploymentMonitor, HealthCheck, Alert, MonitoringConfig

	# Performance monitoring
	from .dashboard.performance_dashboard import PerformanceDashboard, DashboardConfig, DashboardMetrics

	# Testing and validation
	from .testing.accuracy_tester import AccuracyTester, TestConfig, TestResult, AccuracyMetrics
	from .testing.data_validator import DataValidator, ValidationConfig, ValidationResult, QualityMetrics

	_SCRAPERS_AVAILABLE = True
except (ImportError, AttributeError) as _exc:
	_logger.debug("Discovery scraper components unavailable: %s", _exc)
	_SCRAPERS_AVAILABLE = False


__all__ = [
	# Shared data models (always available)
	'OpportunityData',

	# Core infrastructure
	'BaseScraper',
	'ScrapingConfiguration',
	'ScrapingResult',

	# AI-driven scrapers
	'UniversalScraper',
	'ExtractionStrategy',
	'ExtractionResult',
	'VisionScraper',
	'VisionAnalysisResult',
	'UIElement',

	# ML and pattern recognition
	'StructureLearner',
	'ExtractionAttempt',
	'SitePattern',
	'StrategyRecommendation',
	'PatternRecognizer',
	'PatternMatch',
	'ProcurementPattern',

	# Source management
	'GlobalSourceDB',
	'ProcurementSource',
	'SourceType',
	'SourceStatus',
	'SourceDiscoverer',
	'DiscoveryResult',
	'SourcePattern',

	# Deployment and orchestration
	'ScraperDeployment',
	'DeploymentConfig',
	'DeploymentStatus',
	'ScraperInstance',
	'DeploymentMonitor',
	'HealthCheck',
	'Alert',
	'MonitoringConfig',

	# Performance monitoring
	'PerformanceDashboard',
	'DashboardConfig',
	'DashboardMetrics',

	# Testing and validation
	'AccuracyTester',
	'TestConfig',
	'TestResult',
	'AccuracyMetrics',
	'DataValidator',
	'ValidationConfig',
	'ValidationResult',
	'QualityMetrics',
]

# Version information
__version__ = "1.0.0"
__week__ = 9
__title__ = "Discovery Engine - AI-Driven Scrapers"


# Factory functions for easy instantiation
def create_discovery_engine(
	enable_learning: bool = True,
	enable_monitoring: bool = True,
	enable_validation: bool = True,
	config_overrides: dict = None
):
	"""
	Create a complete Discovery Engine instance with all components

	Args:
		enable_learning: Enable ML-based learning and optimization
		enable_monitoring: Enable real-time monitoring and health checks
		enable_validation: Enable data validation and quality assurance
		config_overrides: Custom configuration overrides

	Returns:
		Dictionary containing all initialized components

	Raises:
		RuntimeError: If scraper components are not available
	"""
	if not _SCRAPERS_AVAILABLE:
		raise RuntimeError(
			"Discovery scraper components are not available. "
			"Install the required dependencies (sklearn, playwright, etc.)."
		)

	# Initialize core components
	global_db = GlobalSourceDB()

	structure_learner = None
	if enable_learning:
		structure_learner = StructureLearner()

	# Create scraper with optimal configuration
	scraper_config = ScrapingConfiguration(
		max_concurrent=5,
		request_delay_range=(1.0, 3.0),
		request_timeout=30,
		rate_limit_requests_per_minute=60,
		respect_robots_txt=True,
		user_agent="ProposalWriter-Discovery/1.0"
	)

	universal_scraper = UniversalScraper(scraper_config)
	vision_scraper = VisionScraper(scraper_config)
	pattern_recognizer = PatternRecognizer()
	source_discoverer = SourceDiscoverer(global_db, universal_scraper)

	# Deployment and orchestration
	deployment = ScraperDeployment(global_db, structure_learner)

	monitor = None
	if enable_monitoring:
		monitor = DeploymentMonitor(deployment, global_db)

	dashboard = None
	if enable_monitoring:
		dashboard = PerformanceDashboard(deployment, monitor, global_db, structure_learner)

	# Testing and validation
	accuracy_tester = None
	data_validator = None

	if enable_validation:
		accuracy_tester = AccuracyTester(global_db, structure_learner)
		data_validator = DataValidator(global_db)

	return {
		'global_db': global_db,
		'structure_learner': structure_learner,
		'universal_scraper': universal_scraper,
		'vision_scraper': vision_scraper,
		'pattern_recognizer': pattern_recognizer,
		'source_discoverer': source_discoverer,
		'deployment': deployment,
		'monitor': monitor,
		'dashboard': dashboard,
		'accuracy_tester': accuracy_tester,
		'data_validator': data_validator
	}


async def initialize_discovery_engine():
	"""
	Initialize the complete Discovery Engine with all components
	"""

	engine = create_discovery_engine()

	# Load initial procurement sources
	await engine['global_db'].initialize_sources()

	# Start monitoring if available
	if engine['monitor']:
		await engine['monitor'].start_monitoring()

	# Start dashboard if available
	if engine['dashboard']:
		await engine['dashboard'].start_dashboard()

	return engine


async def deploy_scrapers_for_top_sources(
	engine: dict,
	source_count: int = 100,
	deployment_config: dict = None
):
	"""
	Deploy scrapers for the top procurement sources

	Args:
		engine: Discovery engine instance from create_discovery_engine()
		source_count: Number of top sources to deploy
		deployment_config: Custom deployment configuration

	Returns:
		List of deployment IDs
	"""

	deployment = engine.get('deployment')
	if not deployment:
		raise ValueError("Deployment component not available")

	# Deploy scrapers for top sources
	deployment_ids = await deployment.deploy_top_sources(
		limit=source_count,
		deployment_config_template=deployment_config
	)

	return deployment_ids


async def run_comprehensive_testing(
	engine: dict,
	test_config: dict = None
):
	"""
	Run comprehensive accuracy testing and data validation

	Args:
		engine: Discovery engine instance
		test_config: Custom test configuration

	Returns:
		Dictionary with test results
	"""

	results = {}

	# Run accuracy tests
	if engine.get('accuracy_tester'):
		test_ids = await engine['accuracy_tester'].run_accuracy_tests()
		results['accuracy_tests'] = test_ids

	# Run data validation on sample data
	if engine.get('data_validator') and engine.get('global_db'):
		# Get sample opportunities (would come from actual scraping)
		sample_opportunities = []  # In practice, this would be populated from scraping results

		if sample_opportunities:
			validation_result = await engine['data_validator'].validate_opportunities(sample_opportunities)
			results['data_validation'] = validation_result

	return results
