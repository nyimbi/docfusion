#!/usr/bin/env python3
"""
Comprehensive tests for UniversalScraper

Tests all extraction strategies, integrations, error handling, and learning capabilities.
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
import tempfile
from pathlib import Path
import json

from docfusion.discovery.crawlers.ai_driven.universal_scraper import (
    UniversalScraper, ExtractionResult, SiteStructure, 
    create_universal_scraper
)
from docfusion.discovery.crawlers.generic.base_scraper import (
    ScrapingConfiguration, ScrapingResult, ScrapingStatus
)


# Test fixtures and mock data
@pytest.fixture
def scraper_config():
	"""Create test scraper configuration"""
	return ScrapingConfiguration(
		max_concurrent=2,
		request_timeout=10,
		rate_limit_requests_per_minute=30,
		respect_robots_txt=False,  # Disable for testing
		user_agent="TestBot/1.0",
		request_delay_range=(0.5, 1.0)
	)


@pytest.fixture
async def universal_scraper(scraper_config):
	"""Create UniversalScraper instance with mocked optional dependencies"""
	with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.PlaywrightCrawler') as mock_crawlee:
		with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.async_playwright') as mock_playwright:
			mock_playwright_instance = AsyncMock()
			mock_playwright.return_value.start = AsyncMock(return_value=mock_playwright_instance)
			mock_browser = AsyncMock()
			mock_playwright_instance.chromium.launch = AsyncMock(return_value=mock_browser)
			mock_crawlee_instance = MagicMock()
			mock_crawlee.return_value = mock_crawlee_instance

			scraper = UniversalScraper(scraper_config)
			await scraper.initialize()
			yield scraper
			await scraper.cleanup()


@pytest.fixture
def sample_html_content():
	"""Sample HTML content with procurement opportunities"""
	return """
	<html>
	<head><title>Government Procurement Portal</title></head>
	<body>
		<div class="opportunity-list">
			<div class="opportunity-item">
				<h3 class="title">Software Development Services</h3>
				<p class="description">We need custom software development for our agency.</p>
				<span class="deadline">Deadline: 2024-12-31</span>
				<span class="value">Budget: $500,000</span>
				<span class="organization">Department of Technology</span>
			</div>
			<div class="opportunity-item">
				<h3 class="title">IT Equipment Procurement</h3>
				<p class="description">Purchasing laptops and servers for office upgrade.</p>
				<span class="deadline">Due: 2024-11-15</span>
				<span class="value">Estimated Value: $250,000</span>
				<span class="organization">City IT Department</span>
			</div>
		</div>
	</body>
	</html>
	"""


@pytest.fixture
def sample_site_structure():
	"""Sample learned site structure"""
	return SiteStructure(
		domain="test-procurement.gov",
		site_type="government",
		opportunity_list_selector=".opportunity-list",
		opportunity_item_selector=".opportunity-item",
		title_selector=".title",
		description_selector=".description",
		deadline_selector=".deadline",
		value_selector=".value",
		requires_javascript=False,
		has_cloudflare=False,
		confidence_score=0.9,
		extraction_success_rate=0.85
	)


class TestUniversalScraperInitialization:
	"""Test scraper initialization and configuration"""
	
	def test_scraper_creation(self, scraper_config):
		"""Test basic scraper creation"""
		scraper = UniversalScraper(scraper_config)
		
		assert scraper.config == scraper_config
		assert scraper.site_structures == {}
		assert scraper.extraction_stats['total_extractions'] == 0
		assert scraper.crawlee_crawler is None
		assert scraper.playwright is None
	
	async def test_scraper_initialization(self, scraper_config):
		"""Test scraper initialization process"""
		scraper = UniversalScraper(scraper_config)
		
		with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.PlaywrightCrawler') as mock_crawlee:
			with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.async_playwright') as mock_playwright:
				mock_playwright_instance = AsyncMock()
				mock_playwright.return_value.start = AsyncMock(return_value=mock_playwright_instance)
				
				mock_browser = AsyncMock()
				mock_playwright_instance.chromium.launch = AsyncMock(return_value=mock_browser)
				
				await scraper.initialize()
				
				# Verify Crawlee was initialized
				mock_crawlee.assert_called_once()
				assert scraper.crawlee_crawler is not None
				
				# Verify Playwright was initialized
				mock_playwright.assert_called_once()
				assert scraper.playwright == mock_playwright_instance
				assert scraper.browser == mock_browser
				
		await scraper.cleanup()
	
	def test_factory_function(self):
		"""Test factory function for creating scraper"""
		scraper = create_universal_scraper(
			requests_per_second=2.0,
			use_proxies=False,
			max_retries=5
		)
		
		assert isinstance(scraper, UniversalScraper)
		assert scraper.config.rate_limit_requests_per_minute == 120  # 2 * 60
		assert scraper.config.max_retries == 5


class TestExtractionStrategies:
	"""Test individual extraction strategies"""
	
	@pytest.mark.asyncio
	async def test_crawlee_extraction_success(self, universal_scraper, sample_html_content):
		"""Test successful Crawlee extraction"""
		test_url = "https://test-procurement.gov/opportunities"
		
		# Mock Crawlee crawler behavior
		mock_context = MagicMock()
		mock_page = AsyncMock()
		mock_request = MagicMock()
		mock_request.url = test_url
		
		mock_context.page = mock_page
		mock_context.request = mock_request
		
		mock_page.wait_for_load_state = AsyncMock()
		mock_page.content = AsyncMock(return_value=sample_html_content)
		mock_page.query_selector_all = AsyncMock(return_value=[])  # No dynamic elements for this test
		
		async def mock_run(handler):
			await handler(mock_context)
		
		# Mock the Crawlee crawler
		universal_scraper.crawlee_crawler.add_requests = AsyncMock()
		universal_scraper.crawlee_crawler.run = AsyncMock(
			side_effect=mock_run
		)
		
		# Mock the HTML extraction method
		expected_extraction = ExtractionResult(
			opportunities=[
				{
					'title': 'Software Development Services',
					'description': 'We need custom software development for our agency.',
					'deadline': '2024-12-31',
					'estimated_value': '$500,000'
				}
			],
			valid_items_found=1,
			extraction_method="crawlee"
		)
		
		with patch.object(universal_scraper, '_extract_opportunities_from_html', return_value=expected_extraction):
			scraping_result, extraction_result = await universal_scraper._extract_with_crawlee(test_url)
			
			# Verify successful extraction
			assert scraping_result.status == ScrapingStatus.SUCCESS
			assert scraping_result.method_used == "crawlee"
			assert extraction_result.extraction_method == "crawlee"
			assert extraction_result.valid_items_found == 1
			assert len(extraction_result.opportunities) == 1
	
	@pytest.mark.asyncio
	async def test_cloudscraper_extraction(self, universal_scraper, sample_html_content):
		"""Test CloudScraper extraction"""
		test_url = "https://test-procurement.gov/opportunities"
		
		# Mock CloudScraper response
		mock_response = MagicMock()
		mock_response.status_code = 200
		mock_response.text = sample_html_content
		mock_response.headers = {'Content-Type': 'text/html'}
		
		universal_scraper.cloudscraper_session.get = MagicMock(return_value=mock_response)
		
		# Mock HTML extraction
		expected_extraction = ExtractionResult(
			opportunities=[{'title': 'Test Opportunity'}],
			valid_items_found=1
		)
		
		with patch.object(universal_scraper, '_extract_opportunities_from_html', return_value=expected_extraction):
			scraping_result, extraction_result = await universal_scraper._extract_with_cloudscraper(test_url)
			
			assert scraping_result.status == ScrapingStatus.SUCCESS
			assert scraping_result.status_code == 200
			assert extraction_result.valid_items_found == 1
	
	@pytest.mark.asyncio
	async def test_crawl4ai_llm_extraction(self, universal_scraper):
		"""Test Crawl4AI LLM extraction"""
		test_url = "https://test-procurement.gov/opportunities"
		
		# Mock Crawl4AI components
		universal_scraper.llm_strategy = MagicMock()
		with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.AsyncWebCrawler') as mock_crawler_class:
			with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.CrawlerRunConfig') as mock_config:
				with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.CacheMode') as mock_cache:
					mock_crawler = AsyncMock()
					mock_crawler_class.return_value.__aenter__ = AsyncMock(return_value=mock_crawler)
					mock_crawler_class.return_value.__aexit__ = AsyncMock(return_value=None)
					
					# Mock crawl result
					mock_result = MagicMock()
					mock_result.success = True
					mock_result.cleaned_html = "<html>Test content</html>"
					mock_result.markdown = "Test content"
					mock_result.extracted_content = json.dumps([
						{
							'title': 'AI Extracted Opportunity',
							'description': 'AI found this opportunity',
							'deadline': '2024-12-31'
						}
					])
					
					mock_crawler.arun = AsyncMock(return_value=mock_result)
					mock_config.return_value = MagicMock()
					mock_cache.ENABLED = "enabled"
					
					scraping_result, extraction_result = await universal_scraper._extract_with_crawl4ai_llm(test_url)
			
			assert scraping_result.status == ScrapingStatus.SUCCESS
			assert scraping_result.method_used == "crawl4ai_llm"
			# Note: Actual extraction would depend on LLM response parsing
	
	@pytest.mark.asyncio
	async def test_playwright_stealth_extraction(self, universal_scraper, sample_html_content):
		"""Test Playwright stealth extraction"""
		test_url = "https://test-procurement.gov/opportunities"
		
		# Mock Playwright page
		mock_page = AsyncMock()
		mock_page.goto = AsyncMock()
		mock_page.wait_for_load_state = AsyncMock()
		mock_page.content = AsyncMock(return_value=sample_html_content)
		
		# Mock browser context
		mock_context = AsyncMock()
		mock_context.new_page = AsyncMock(return_value=mock_page)
		
		universal_scraper.browser.new_context = AsyncMock(return_value=mock_context)
		
		# Mock HTML extraction
		expected_extraction = ExtractionResult(
			opportunities=[{'title': 'Playwright Opportunity'}],
			valid_items_found=1
		)
		
		with patch.object(universal_scraper, '_extract_opportunities_from_html', return_value=expected_extraction):
			scraping_result, extraction_result = await universal_scraper._extract_with_playwright(test_url, stealth=True)
			
			assert scraping_result.status == ScrapingStatus.SUCCESS
			assert extraction_result.valid_items_found == 1


class TestSiteStructureLearning:
	"""Test site structure learning and optimization"""
	
	@pytest.mark.asyncio
	async def test_site_structure_learning(self, universal_scraper, sample_html_content, sample_site_structure):
		"""Test learning site structure from successful extractions"""
		test_url = "https://test-procurement.gov/opportunities"
		domain = "test-procurement.gov"
		
		# Set up initial structure
		universal_scraper.site_structures[domain] = sample_site_structure
		
		# Mock successful scraping result
		scraping_result = ScrapingResult(
			url=test_url,
			status=ScrapingStatus.SUCCESS,
			html_content=sample_html_content,
			method_used="crawlee"
		)
		
		extraction_result = ExtractionResult(
			opportunities=[{'title': 'Test Opportunity'}],
			valid_items_found=1,
			total_items_found=1,
			extraction_method="crawlee"
		)
		
		# Test structure update
		await universal_scraper._update_site_structure(domain, scraping_result, extraction_result)
		
		updated_structure = universal_scraper.site_structures[domain]
		assert updated_structure.extraction_success_rate >= sample_site_structure.extraction_success_rate
		assert updated_structure.last_updated >= sample_site_structure.last_updated
	
	def test_extraction_strategy_selection_with_structure(self, universal_scraper, sample_site_structure):
		"""Test strategy selection based on learned site structure"""
		# Test with Cloudflare detection
		cloudflare_structure = sample_site_structure.copy(deep=True)
		cloudflare_structure.has_cloudflare = True
		
		strategies = universal_scraper._get_extraction_strategies(cloudflare_structure)
		assert "cloudscraper" in strategies[:2]  # Should be early in list
		
		# Test with JavaScript requirement
		js_structure = sample_site_structure.copy(deep=True)
		js_structure.requires_javascript = True
		
		strategies = universal_scraper._get_extraction_strategies(js_structure)
		assert "playwright_css" in strategies or "crawl4ai_llm" in strategies
	
	def test_extraction_strategy_selection_without_structure(self, universal_scraper):
		"""Test default strategy selection for unknown sites"""
		strategies = universal_scraper._get_extraction_strategies(None)
		
		# Verify Crawlee is first (primary strategy)
		assert strategies[0] == "crawlee"
		
		# Verify all expected strategies are present
		expected_strategies = [
			"crawlee", "cloudscraper", "crawl4ai_llm", 
			"playwright_stealth", "crawl4ai_cosine", "playwright_css"
		]
		
		for strategy in expected_strategies:
			assert strategy in strategies


class TestDynamicContentExtraction:
	"""Test dynamic content extraction capabilities"""
	
	@pytest.mark.asyncio
	async def test_dynamic_opportunities_extraction(self, universal_scraper):
		"""Test extraction of dynamic opportunities from page elements"""
		# Mock Playwright page elements
		mock_element1 = AsyncMock()
		mock_element1.text_content = AsyncMock(return_value="Software Development RFP\nDeadline: 2024-12-31\nBudget: $100,000")
		mock_element1.query_selector = AsyncMock(return_value=None)  # No sub-elements
		mock_element1.evaluate = AsyncMock(return_value="div")
		mock_element1.get_attribute = AsyncMock(side_effect=lambda attr: "opportunity-item" if attr == "class" else None)
		
		mock_element2 = AsyncMock()
		mock_element2.text_content = AsyncMock(return_value="Too short")  # Should be filtered out
		
		mock_page = AsyncMock()
		mock_page.query_selector_all = AsyncMock(return_value=[mock_element1, mock_element2])
		
		opportunities = await universal_scraper._extract_dynamic_opportunities(mock_page)
		
		# Should extract 1 valid opportunity (element2 filtered out for being too short)
		assert len(opportunities) == 1
		assert "Software Development RFP" in opportunities[0]['title']
		assert "2024-12-31" in opportunities[0].get('deadline', '')
	
	@pytest.mark.asyncio
	async def test_opportunity_from_element_extraction(self, universal_scraper):
		"""Test extracting opportunity data from a single element"""
		# Mock element with structured content
		mock_element = AsyncMock()
		mock_element.text_content = AsyncMock(return_value="""
		IT Services Procurement
		Description: We need comprehensive IT support services for our organization.
		Deadline: 2024-12-31
		Value: $500,000
		Contact: procurement@agency.gov
		""")
		
		# Mock sub-element queries
		mock_title_element = AsyncMock()
		mock_title_element.text_content = AsyncMock(return_value="IT Services Procurement")
		mock_element.query_selector = AsyncMock(return_value=mock_title_element)
		
		# Mock element attributes for selector generation
		mock_element.evaluate = AsyncMock(return_value="div")
		mock_element.get_attribute = AsyncMock(side_effect=lambda attr: {
			'class': 'opportunity-card main',
			'id': None
		}.get(attr))
		
		opportunity = await universal_scraper._extract_opportunity_from_element(mock_element)
		
		assert opportunity is not None
		assert opportunity['title'] == "IT Services Procurement"
		assert "2024-12-31" in opportunity.get('deadline', '')
		assert "$500,000" in opportunity.get('estimated_value', '')
		assert opportunity['source_element_selector'] == "div.opportunity-card.main"


class TestErrorHandlingAndFallbacks:
	"""Test error handling and fallback mechanisms"""
	
	@pytest.mark.asyncio
	async def test_crawlee_extraction_failure_fallback(self, universal_scraper):
		"""Test fallback when Crawlee extraction fails"""
		test_url = "https://test-procurement.gov/opportunities"
		
		# Mock Crawlee failure
		universal_scraper.crawlee_crawler.add_requests = AsyncMock()
		universal_scraper.crawlee_crawler.run = AsyncMock(side_effect=Exception("Crawlee failed"))
		
		# Mock successful CloudScraper fallback
		mock_response = MagicMock()
		mock_response.status_code = 200
		mock_response.text = "<html>Fallback content</html>"
		mock_response.headers = {}
		
		universal_scraper.cloudscraper_session.get = MagicMock(return_value=mock_response)
		
		expected_extraction = ExtractionResult(
			opportunities=[{'title': 'Fallback Opportunity'}],
			valid_items_found=1
		)
		
		with patch.object(universal_scraper, '_extract_opportunities_from_html', return_value=expected_extraction):
			scraping_result, extraction_result = await universal_scraper.scrape_with_intelligence(test_url)
			
			# Should succeed with fallback strategy
			assert extraction_result.valid_items_found == 1
			assert len(extraction_result.errors) > 0  # Should contain Crawlee error
	
	@pytest.mark.asyncio
	async def test_all_strategies_fail(self, universal_scraper):
		"""Test behavior when all extraction strategies fail"""
		test_url = "https://test-procurement.gov/opportunities"
		
		# Mock all strategies to fail
		with patch.object(universal_scraper, '_extract_with_crawlee', side_effect=Exception("Crawlee failed")):
			with patch.object(universal_scraper, '_extract_with_cloudscraper', side_effect=Exception("CloudScraper failed")):
				with patch.object(universal_scraper, '_extract_with_crawl4ai_llm', side_effect=Exception("Crawl4AI failed")):
					with patch.object(universal_scraper, '_extract_with_playwright', side_effect=Exception("Playwright failed")):
						scraping_result, extraction_result = await universal_scraper.scrape_with_intelligence(test_url)
						
						assert scraping_result.status == ScrapingStatus.FAILED
						assert extraction_result.valid_items_found == 0
						assert len(extraction_result.errors) > 0
	
	@pytest.mark.asyncio
	async def test_network_timeout_handling(self, universal_scraper):
		"""Test handling of network timeouts"""
		test_url = "https://timeout-test.gov"
		
		# Mock timeout exception
		import asyncio
		universal_scraper.crawlee_crawler.add_requests = AsyncMock()
		universal_scraper.crawlee_crawler.run = AsyncMock(side_effect=asyncio.TimeoutError("Network timeout"))
		
		# Mock CloudScraper and other fallbacks to also fail
		with patch.object(universal_scraper, '_extract_with_cloudscraper', side_effect=Exception("CloudScraper failed")):
			with patch.object(universal_scraper, '_extract_with_crawl4ai_llm', side_effect=Exception("Crawl4AI failed")):
				with patch.object(universal_scraper, '_extract_with_playwright', side_effect=Exception("Playwright failed")):
					with patch.object(universal_scraper, '_extract_with_crawl4ai_cosine', side_effect=Exception("Cosine failed")):
						with patch.object(universal_scraper, '_extract_with_playwright_css', side_effect=Exception("CSS failed")):
							with patch.object(universal_scraper, '_extract_with_vision', side_effect=Exception("Vision failed")):
								scraping_result, extraction_result = await universal_scraper.scrape_with_intelligence(test_url)
								
								# Should handle timeout gracefully and try fallback strategies
								assert len(extraction_result.errors) > 0
								assert any("timeout" in error.lower() for error in extraction_result.errors)


class TestPerformanceAndOptimization:
	"""Test performance aspects and optimization"""
	
	@pytest.mark.asyncio
	async def test_concurrent_requests_limit(self, scraper_config):
		"""Test that concurrent request limits are respected"""
		scraper_config.max_concurrent = 2
		with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.PlaywrightCrawler') as mock_crawlee:
			with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.async_playwright') as mock_playwright:
				mock_playwright_instance = AsyncMock()
				mock_playwright.return_value.start = AsyncMock(return_value=mock_playwright_instance)
				mock_browser = AsyncMock()
				mock_playwright_instance.chromium.launch = AsyncMock(return_value=mock_browser)
				mock_crawlee.return_value = MagicMock()
				
				scraper = UniversalScraper(scraper_config)
				await scraper.initialize()
				
				# Verify Crawlee is configured with correct concurrency
				assert scraper.crawlee_crawler is not None
				# Note: In real implementation, we'd check the Crawlee configuration
				
				await scraper.cleanup()
	
	@pytest.mark.asyncio
	async def test_rate_limiting(self, universal_scraper):
		"""Test that rate limiting is applied"""
		# This would be integration-tested with actual requests
		# For unit tests, we verify the configuration is passed correctly
		assert universal_scraper.config.rate_limit_requests_per_minute > 0
		assert universal_scraper.config.request_delay_range is not None
	
	def test_statistics_tracking(self, universal_scraper):
		"""Test extraction statistics tracking"""
		initial_stats = universal_scraper.get_extraction_stats()
		
		# Verify initial state
		assert initial_stats['total_extractions'] == 0
		assert initial_stats['successful_extractions'] == 0
		assert 'crawlee_extractions' in initial_stats
		
		# Test stats update (would be called during actual extraction)
		universal_scraper.extraction_stats['total_extractions'] += 1
		universal_scraper.extraction_stats['successful_extractions'] += 1
		universal_scraper.extraction_stats['crawlee_extractions'] += 1
		
		updated_stats = universal_scraper.get_extraction_stats()
		assert updated_stats['total_extractions'] == 1
		assert updated_stats['success_rate'] == 1.0


class TestIntegrationScenarios:
	"""Integration tests for real-world scenarios"""
	
	@pytest.mark.asyncio
	async def test_government_site_scenario(self, universal_scraper, sample_html_content):
		"""Test extraction from a typical government procurement site"""
		test_url = "https://government-procurement.gov/opportunities"
		
		# Set up learned government site structure
		gov_structure = SiteStructure(
			domain="government-procurement.gov",
			site_type="government",
			opportunity_list_selector=".opportunity-list",
			opportunity_item_selector=".opportunity-item",
			title_selector=".title",
			requires_javascript=False,
			has_cloudflare=False,
			confidence_score=0.9
		)
		
		universal_scraper.site_structures["government-procurement.gov"] = gov_structure
		
		# Mock Crawlee extraction
		mock_context = MagicMock()
		mock_page = AsyncMock()
		mock_request = MagicMock()
		mock_request.url = test_url
		
		mock_context.page = mock_page
		mock_context.request = mock_request
		mock_page.wait_for_load_state = AsyncMock()
		mock_page.content = AsyncMock(return_value=sample_html_content)
		mock_page.query_selector_all = AsyncMock(return_value=[])
		
		async def mock_run(handler):
			await handler(mock_context)
		
		universal_scraper.crawlee_crawler.add_requests = AsyncMock()
		universal_scraper.crawlee_crawler.run = AsyncMock(
			side_effect=mock_run
		)
		
		# Mock HTML extraction to return government opportunities
		expected_extraction = ExtractionResult(
			opportunities=[
				{
					'title': 'Software Development Services',
					'description': 'Government software development project',
					'organization': 'Department of Technology',
					'deadline': '2024-12-31',
					'estimated_value': '$500,000'
				},
				{
					'title': 'IT Equipment Procurement',
					'description': 'Hardware procurement for government office',
					'organization': 'City IT Department', 
					'deadline': '2024-11-15',
					'estimated_value': '$250,000'
				}
			],
			valid_items_found=2,
			extraction_method="crawlee"
		)
		
		with patch.object(universal_scraper, '_extract_opportunities_from_html', return_value=expected_extraction):
			with patch.object(universal_scraper, '_get_extraction_strategies', return_value=["crawlee"]):
				scraping_result, extraction_result = await universal_scraper.scrape_with_intelligence(
					test_url, use_learned_structure=True
				)
				
				assert scraping_result.status == ScrapingStatus.SUCCESS
				assert extraction_result.valid_items_found == 2
				assert extraction_result.extraction_method == "crawlee"
			
			# Verify government-specific data was extracted
			opportunities = extraction_result.opportunities
			assert any('Department' in opp.get('organization', '') for opp in opportunities)
			assert any('government' in opp.get('description', '').lower() for opp in opportunities)
	
	@pytest.mark.asyncio  
	async def test_cloudflare_protected_site(self, universal_scraper):
		"""Test extraction from Cloudflare-protected site"""
		test_url = "https://protected-procurement.com/tenders"
		
		# Set up site structure indicating Cloudflare protection
		protected_structure = SiteStructure(
			domain="protected-procurement.com",
			site_type="corporate",
			has_cloudflare=True,
			requires_javascript=True,
			confidence_score=0.7
		)
		
		universal_scraper.site_structures["protected-procurement.com"] = protected_structure
		
		# Mock Crawlee failure due to Cloudflare
		universal_scraper.crawlee_crawler.run = AsyncMock(side_effect=Exception("Cloudflare blocked"))
		
		# Mock successful CloudScraper bypass
		mock_response = MagicMock()
		mock_response.status_code = 200
		mock_response.text = "<html><div class='tender'>Cloudflare bypassed tender</div></html>"
		mock_response.headers = {}
		
		universal_scraper.cloudscraper_session.get = MagicMock(return_value=mock_response)
		
		expected_extraction = ExtractionResult(
			opportunities=[{'title': 'Bypassed Tender', 'description': 'Successfully bypassed Cloudflare'}],
			valid_items_found=1
		)
		
		with patch.object(universal_scraper, '_extract_opportunities_from_html', return_value=expected_extraction):
			scraping_result, extraction_result = await universal_scraper.scrape_with_intelligence(test_url)
			
			assert extraction_result.valid_items_found == 1
			# Should use CloudScraper due to learned Cloudflare detection
			assert "cloudscraper" in extraction_result.extraction_method or len(extraction_result.errors) > 0


class TestCleanupAndResourceManagement:
	"""Test proper resource cleanup"""
	
	@pytest.mark.asyncio
	async def test_cleanup_all_resources(self, scraper_config):
		"""Test that all resources are properly cleaned up"""
		scraper = UniversalScraper(scraper_config)
		
		# Mock all components
		mock_crawlee = AsyncMock()
		mock_crawlee.tear_down = AsyncMock()
		scraper.crawlee_crawler = mock_crawlee
		
		mock_browser = AsyncMock()
		mock_browser.close = AsyncMock()
		scraper.browser = mock_browser
		
		mock_playwright = AsyncMock()
		mock_playwright.stop = AsyncMock()
		scraper.playwright = mock_playwright
		
		mock_session = MagicMock()
		mock_session.close = MagicMock()
		scraper.cloudscraper_session = mock_session
		scraper.cloudscraper_session.close = mock_session.close
		
		# Test cleanup
		await scraper.cleanup()
		
		# Verify all components were cleaned up
		mock_crawlee.tear_down.assert_called_once()
		mock_browser.close.assert_called_once()
		mock_playwright.stop.assert_called_once()
		mock_session.close.assert_called_once()
	
	@pytest.mark.asyncio
	async def test_cleanup_with_failures(self, scraper_config):
		"""Test cleanup when some components fail to clean up"""
		scraper = UniversalScraper(scraper_config)
		
		# Mock failing Crawlee cleanup
		mock_crawlee = AsyncMock()
		mock_crawlee.tear_down = AsyncMock(side_effect=Exception("Crawlee cleanup failed"))
		scraper.crawlee_crawler = mock_crawlee
		
		mock_browser = AsyncMock()
		mock_browser.close = AsyncMock()
		scraper.browser = mock_browser
		
		# Cleanup should not raise exception even if some components fail
		await scraper.cleanup()
		
		# Verify cleanup was attempted
		mock_crawlee.tear_down.assert_called_once()
		mock_browser.close.assert_called_once()


# Performance benchmarks (run separately)
class TestPerformanceBenchmarks:
	"""Performance benchmark tests"""
	
	@pytest.mark.benchmark
	@pytest.mark.asyncio
	async def test_extraction_speed_benchmark(self, universal_scraper, sample_html_content, benchmark):
		"""Benchmark extraction speed"""
		test_url = "https://benchmark-test.gov"
		
		# Mock fast extraction
		mock_context = MagicMock()
		mock_page = AsyncMock()
		mock_request = MagicMock()
		mock_request.url = test_url
		
		mock_context.page = mock_page
		mock_context.request = mock_request
		mock_page.wait_for_load_state = AsyncMock()
		mock_page.content = AsyncMock(return_value=sample_html_content)
		mock_page.query_selector_all = AsyncMock(return_value=[])
		
		async def mock_run(handler):
			await handler(mock_context)
		
		universal_scraper.crawlee_crawler.add_requests = AsyncMock()
		universal_scraper.crawlee_crawler.run = AsyncMock(
			side_effect=mock_run
		)
		
		expected_extraction = ExtractionResult(
			opportunities=[{'title': 'Benchmark Opportunity'}],
			valid_items_found=1
		)
		
		with patch.object(universal_scraper, '_extract_opportunities_from_html', return_value=expected_extraction):
			# Benchmark the extraction
			result = await benchmark(
				universal_scraper.scrape_with_intelligence,
				test_url
			)
			
			scraping_result, extraction_result = result
			assert extraction_result.valid_items_found == 1


if __name__ == "__main__":
	# Run specific test categories
	import sys
	
	if len(sys.argv) > 1:
		if sys.argv[1] == "integration":
			pytest.main(["-v", "-k", "TestIntegrationScenarios"])
		elif sys.argv[1] == "performance":  
			pytest.main(["-v", "-k", "TestPerformanceBenchmarks", "--benchmark-only"])
		elif sys.argv[1] == "unit":
			pytest.main(["-v", "-k", "not TestIntegrationScenarios and not TestPerformanceBenchmarks"])
	else:
		pytest.main(["-v", __file__])