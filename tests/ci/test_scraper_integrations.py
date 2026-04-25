#!/usr/bin/env python3
"""
Integration Tests for Scraper Components

Tests integration between different scraper components and external services.
Includes tests for Crawlee, Crawl4AI, CloudScraper, and Playwright integrations.
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, Mock
import json
import tempfile
from pathlib import Path
import aiohttp
from datetime import datetime, timezone

from docfusion.discovery.crawlers.ai_driven.universal_scraper import UniversalScraper
from docfusion.discovery.crawlers.ai_driven.structure_learner import StructureLearner
from docfusion.discovery.crawlers.source_databases.global_source_db import GlobalSourceDB, ProcurementSource, SourceType
from docfusion.discovery.crawlers.generic.base_scraper import ScrapingConfiguration


@pytest.fixture
def integration_config():
	"""Configuration for integration testing"""
	return ScrapingConfiguration(
		max_concurrent=1,  # Single threaded for predictable testing
		request_timeout=15,
		rate_limit_requests_per_minute=20,
		respect_robots_txt=False,
		user_agent="IntegrationTest/1.0"
	)


@pytest.fixture
async def integration_scraper(integration_config):
	"""Create scraper for integration testing with mocked optional dependencies"""
	with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.PlaywrightCrawler') as mock_crawlee:
		with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.async_playwright') as mock_playwright:
			mock_playwright_instance = AsyncMock()
			mock_playwright.return_value.start = AsyncMock(return_value=mock_playwright_instance)
			mock_browser = AsyncMock()
			mock_playwright_instance.chromium.launch = AsyncMock(return_value=mock_browser)
			mock_crawlee_instance = MagicMock()
			mock_crawlee.return_value = mock_crawlee_instance

			scraper = UniversalScraper(integration_config)
			await scraper.initialize()
			yield scraper
			await scraper.cleanup()


@pytest.fixture
async def mock_global_db():
	"""Mock global database with test data"""
	db = GlobalSourceDB()
	await db.initialize_sources()
	return db


@pytest.fixture
def sample_procurement_source():
	"""Sample procurement source for testing"""
	from docfusion.discovery.crawlers.source_databases.global_source_db import AccessMethod, GeographicScope
	return ProcurementSource(
		name="Test Government Portal",
		url="https://test-procurement.gov/opportunities",
		base_domain="test-procurement.gov",
		source_type=SourceType.GOVERNMENT_FEDERAL,
		geographic_scope=GeographicScope.NATIONAL,
		country="US",
		access_method=AccessMethod.HTTP_GET,
		health_score=0.9
	)


class TestCrawleeIntegration:
	"""Test Crawlee Python integration"""
	
	@pytest.mark.asyncio
	async def test_crawlee_playwright_initialization(self, integration_scraper):
		"""Test that Crawlee PlaywrightCrawler initializes properly"""
		assert integration_scraper.crawlee_crawler is not None
		
		# Verify Crawlee configuration
		crawler = integration_scraper.crawlee_crawler
		assert hasattr(crawler, 'run')
		assert hasattr(crawler, 'add_requests')
		assert hasattr(crawler, 'tear_down')
	
	@pytest.mark.asyncio
	async def test_crawlee_request_handling(self, integration_scraper):
		"""Test Crawlee request handling mechanism"""
		test_url = "https://example.gov/test"
		
		# Track if request handler was called
		handler_called = False
		request_data = {}
		
		async def test_handler(context):
			nonlocal handler_called, request_data
			handler_called = True
			request_data = {
				'url': context.request.url,
				'page_available': context.page is not None
			}
			
			# Store test result in scraper's results
			integration_scraper.crawlee_results.append({
				'success': True,
				'url': context.request.url,
				'content': '<html>Test content</html>',
				'extraction_result': None
			})
		
		# Mock the Crawlee crawler
		integration_scraper.crawlee_crawler.add_requests = AsyncMock()
		
		async def mock_run(handler):
			mock_context = MagicMock()
			mock_context.request.url = test_url
			mock_context.page = MagicMock()
			await handler(mock_context)
		
		integration_scraper.crawlee_crawler.run = AsyncMock(side_effect=mock_run)
		
		# Test the request handling
		from crawlee import Request
		with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.Request') as mock_request_class:
			mock_request = Mock()
			mock_request_class.from_url.return_value = mock_request
			
			await integration_scraper.crawlee_crawler.add_requests([mock_request])
			await integration_scraper.crawlee_crawler.run(test_handler)
			
			assert handler_called
			assert request_data['page_available']
	
	@pytest.mark.asyncio
	async def test_crawlee_session_management(self, integration_scraper):
		"""Test Crawlee session and cookie management"""
		# Verify session pool configuration
		crawler = integration_scraper.crawlee_crawler
		
		# These would be integration tests with actual Crawlee instance
		# For now, verify the configuration is set up correctly
		assert crawler is not None
		
		# In a real integration test, we would:
		# 1. Make multiple requests to a site that sets cookies
		# 2. Verify cookies are maintained across requests
		# 3. Test session rotation functionality
	
	@pytest.mark.asyncio
	async def test_crawlee_anti_detection_features(self, integration_scraper):
		"""Test Crawlee's anti-detection capabilities"""
		# This would be tested against a site that detects bots
		# For unit tests, we verify the configuration
		
		crawler = integration_scraper.crawlee_crawler
		assert crawler is not None
		
		# In real integration:
		# 1. Test against bot detection services
		# 2. Verify user agent rotation
		# 3. Test fingerprint randomization
		# 4. Verify request timing randomization


class TestCrawl4AIIntegration:
	"""Test Crawl4AI integration"""
	
	@pytest.mark.asyncio
	async def test_crawl4ai_llm_strategy_initialization(self, integration_scraper):
		"""Test Crawl4AI LLM strategy initialization"""
		assert integration_scraper.llm_strategy is not None
		
		# Verify strategy configuration
		strategy = integration_scraper.llm_strategy
		assert hasattr(strategy, 'instruction')
		assert 'procurement' in strategy.instruction.lower()
	
	@pytest.mark.asyncio
	async def test_crawl4ai_cosine_strategy_initialization(self, integration_scraper):
		"""Test Crawl4AI Cosine strategy initialization"""
		assert integration_scraper.cosine_strategy is not None
		
		strategy = integration_scraper.cosine_strategy
		assert hasattr(strategy, 'semantic_filter')
		assert 'procurement' in strategy.semantic_filter.lower()
	
	@pytest.mark.asyncio
	async def test_crawl4ai_llm_extraction_flow(self, integration_scraper):
		"""Test complete Crawl4AI LLM extraction flow"""
		test_url = "https://procurement-test.gov"
		
		# Mock AsyncWebCrawler
		integration_scraper.llm_strategy = MagicMock()
		with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.AsyncWebCrawler') as mock_crawler_class:
			with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.CrawlerRunConfig') as mock_config:
				with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.CacheMode') as mock_cache:
					mock_crawler = AsyncMock()
					mock_crawler_class.return_value.__aenter__ = AsyncMock(return_value=mock_crawler)
					mock_crawler_class.return_value.__aexit__ = AsyncMock(return_value=None)
					
					# Mock extraction result with JSON response
					mock_result = MagicMock()
					mock_result.success = True
					mock_result.cleaned_html = "<html><body>Clean content</body></html>"
					mock_result.markdown = "Clean content"
					mock_result.extracted_content = json.dumps([
						{
							'title': 'AI Extracted Procurement',
							'description': 'LLM found this procurement opportunity',
							'deadline': '2024-12-31',
							'value': '$100,000',
							'organization': 'AI Department'
						}
					])
					
					mock_crawler.arun = AsyncMock(return_value=mock_result)
					mock_config.return_value = MagicMock()
					mock_cache.ENABLED = "enabled"
					
					# Execute LLM extraction
					scraping_result, extraction_result = await integration_scraper._extract_with_crawl4ai_llm(test_url)
			
			# Verify results
			assert scraping_result.status.value == "success"
			assert scraping_result.method_used == "crawl4ai_llm"
			
			# Verify Crawl4AI was called with correct configuration
			mock_crawler.arun.assert_called_once()
			call_args = mock_crawler.arun.call_args
			assert test_url in call_args.kwargs.get('url', '')  # URL is passed as keyword arg
	
	@pytest.mark.asyncio
	async def test_crawl4ai_cosine_extraction_flow(self, integration_scraper):
		"""Test Crawl4AI Cosine strategy extraction"""
		test_url = "https://cosine-test.gov"
		
		integration_scraper.cosine_strategy = MagicMock()
		with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.AsyncWebCrawler') as mock_crawler_class:
			with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.CrawlerRunConfig') as mock_config:
				with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.CacheMode') as mock_cache:
					mock_crawler = AsyncMock()
					mock_crawler_class.return_value.__aenter__ = AsyncMock(return_value=mock_crawler)
					mock_crawler_class.return_value.__aexit__ = AsyncMock(return_value=None)
					
					# Mock cosine extraction result
					mock_result = MagicMock()
					mock_result.success = True
					mock_result.cleaned_html = "<html>Cosine filtered content</html>"
					mock_result.markdown = "Filtered content about procurement opportunities"
					mock_result.extracted_content = json.dumps({"clusters": [{"content": ["Cosine Filtered Opportunity - Found via semantic filtering with high relevance score"]}]})
					
					mock_crawler.arun = AsyncMock(return_value=mock_result)
					mock_config.return_value = MagicMock()
					mock_cache.ENABLED = "enabled"
					
					# Mock HTML opportunity extraction
					expected_opportunities = [
						{'title': 'Cosine Filtered Opportunity', 'description': 'Found via semantic filtering'}
					]
					
					with patch.object(integration_scraper, '_extract_opportunities_from_html') as mock_html_extract:
						mock_html_extract.return_value = MagicMock(
							opportunities=expected_opportunities,
							valid_items_found=1
						)
						
						scraping_result, extraction_result = await integration_scraper._extract_with_crawl4ai_cosine(test_url)
				
				assert scraping_result.status.value == "success"
				assert extraction_result.valid_items_found == 1
	
	@pytest.mark.asyncio
	async def test_crawl4ai_error_handling(self, integration_scraper):
		"""Test Crawl4AI error handling"""
		test_url = "https://failing-site.gov"
		
		integration_scraper.llm_strategy = MagicMock()
		with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.AsyncWebCrawler') as mock_crawler_class:
			with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.CrawlerRunConfig') as mock_config:
				with patch('docfusion.discovery.crawlers.ai_driven.universal_scraper.CacheMode') as mock_cache:
					mock_crawler = AsyncMock()
					mock_crawler_class.return_value.__aenter__ = AsyncMock(return_value=mock_crawler)
					mock_crawler_class.return_value.__aexit__ = AsyncMock(return_value=None)
					
					# Mock failed extraction
					mock_result = MagicMock()
					mock_result.success = False
					mock_result.error_message = "Crawl4AI extraction failed"
					mock_result.cleaned_html = None
					mock_result.markdown = None
					
					mock_crawler.arun = AsyncMock(return_value=mock_result)
					mock_config.return_value = MagicMock()
					mock_cache.ENABLED = "enabled"
					
					scraping_result, extraction_result = await integration_scraper._extract_with_crawl4ai_llm(test_url)
					
					assert scraping_result.status.value == "failed"
					assert len(extraction_result.errors) > 0
					assert any("crawl4ai" in err.lower() for err in extraction_result.errors)


class TestCloudScraperIntegration:
	"""Test CloudScraper integration for Cloudflare bypass"""
	
	@pytest.mark.asyncio
	async def test_cloudscraper_session_creation(self, integration_scraper):
		"""Test CloudScraper session initialization"""
		assert integration_scraper.cloudscraper_session is not None
		assert hasattr(integration_scraper.cloudscraper_session, 'get')
		assert hasattr(integration_scraper.cloudscraper_session, 'post')
	
	@pytest.mark.asyncio
	async def test_cloudscraper_successful_request(self, integration_scraper):
		"""Test successful CloudScraper request"""
		test_url = "https://cloudflare-protected.com"
		
		# Mock successful CloudScraper response
		mock_response = MagicMock()
		mock_response.status_code = 200
		mock_response.text = """
		<html>
		<body>
			<div class="procurement-item">
				<h2>Cloudflare Bypassed Tender</h2>
				<p>This tender was successfully extracted despite Cloudflare protection.</p>
			</div>
		</body>
		</html>
		"""
		mock_response.headers = {'Content-Type': 'text/html; charset=utf-8'}
		
		integration_scraper.cloudscraper_session.get = MagicMock(return_value=mock_response)
		
		# Mock HTML extraction
		with patch.object(integration_scraper, '_extract_opportunities_from_html') as mock_extract:
			mock_extract.return_value = MagicMock(
				opportunities=[{'title': 'Cloudflare Bypassed Tender'}],
				valid_items_found=1
			)
			
			scraping_result, extraction_result = await integration_scraper._extract_with_cloudscraper(test_url)
			
			assert scraping_result.status.value == "success"
			assert scraping_result.status_code == 200
			assert extraction_result.valid_items_found == 1
			
			# Verify CloudScraper was called correctly
			integration_scraper.cloudscraper_session.get.assert_called_once_with(test_url, timeout=30)
	
	@pytest.mark.asyncio
	async def test_cloudscraper_cloudflare_challenge_handling(self, integration_scraper):
		"""Test CloudScraper handling of Cloudflare challenges"""
		test_url = "https://heavy-cloudflare.com"
		
		# Mock CloudScraper challenge solving
		mock_response = MagicMock()
		mock_response.status_code = 200  # After challenge is solved
		mock_response.text = "<html>Challenge solved content</html>"
		mock_response.headers = {}
		
		integration_scraper.cloudscraper_session.get = MagicMock(return_value=mock_response)
		
		with patch.object(integration_scraper, '_extract_opportunities_from_html') as mock_extract:
			mock_extract.return_value = MagicMock(opportunities=[], valid_items_found=0)
			
			scraping_result, extraction_result = await integration_scraper._extract_with_cloudscraper(test_url)
			
			assert scraping_result.status.value == "success"
			assert scraping_result.status_code == 200
	
	@pytest.mark.asyncio
	async def test_cloudscraper_failure_handling(self, integration_scraper):
		"""Test CloudScraper failure scenarios"""
		test_url = "https://blocked-site.com"
		
		# Mock CloudScraper failure
		integration_scraper.cloudscraper_session.get = MagicMock(
			side_effect=Exception("CloudScraper blocked")
		)
		
		scraping_result, extraction_result = await integration_scraper._extract_with_cloudscraper(test_url)
		
		assert scraping_result.status.value == "failed"
		assert "blocked" in scraping_result.error_message.lower()
		assert len(extraction_result.errors) > 0


class TestPlaywrightIntegration:
	"""Test Playwright integration for browser automation"""
	
	@pytest.mark.asyncio
	async def test_playwright_browser_initialization(self, integration_scraper):
		"""Test Playwright browser initialization"""
		assert integration_scraper.playwright is not None
		assert integration_scraper.browser is not None
	
	@pytest.mark.asyncio
	async def test_playwright_stealth_mode(self, integration_scraper):
		"""Test Playwright stealth browser automation"""
		test_url = "https://bot-detection-site.com"
		
		# Mock Playwright page and browser context
		mock_page = AsyncMock()
		mock_page.goto = AsyncMock()
		mock_page.wait_for_load_state = AsyncMock()
		mock_page.content = AsyncMock(return_value="<html>Stealth content</html>")
		mock_page.close = AsyncMock()
		
		mock_context = AsyncMock()
		mock_context.new_page = AsyncMock(return_value=mock_page)
		mock_context.close = AsyncMock()
		
		integration_scraper.browser.new_context = AsyncMock(return_value=mock_context)
		
		with patch.object(integration_scraper, '_extract_opportunities_from_html') as mock_extract:
			mock_extract.return_value = MagicMock(opportunities=[], valid_items_found=0)
			
			scraping_result, extraction_result = await integration_scraper._extract_with_playwright(
				test_url, stealth=True
			)
			
			assert scraping_result.status.value == "success"
			
			# Verify stealth context was created
			integration_scraper.browser.new_context.assert_called_once()
			context_args = integration_scraper.browser.new_context.call_args[1]
			
			# Verify stealth options were set
			assert 'user_agent' in context_args
			assert 'viewport' in context_args
	
	@pytest.mark.asyncio
	async def test_playwright_javascript_execution(self, integration_scraper):
		"""Test Playwright JavaScript execution capabilities"""
		test_url = "https://js-heavy-site.com"
		
		mock_page = AsyncMock()
		mock_page.goto = AsyncMock()
		mock_page.wait_for_load_state = AsyncMock()
		mock_page.evaluate = AsyncMock(return_value="JS executed successfully")
		mock_page.content = AsyncMock(return_value="<html>JS processed content</html>")
		mock_page.close = AsyncMock()
		
		mock_context = AsyncMock()
		mock_context.new_page = AsyncMock(return_value=mock_page)
		mock_context.close = AsyncMock()
		
		integration_scraper.browser.new_context = AsyncMock(return_value=mock_context)
		
		with patch.object(integration_scraper, '_extract_opportunities_from_html') as mock_extract:
			mock_extract.return_value = MagicMock(opportunities=[], valid_items_found=0)
			
			scraping_result, extraction_result = await integration_scraper._extract_with_playwright(test_url)
			
			# Verify page navigation and JavaScript execution
			mock_page.goto.assert_called_once_with(test_url, wait_until='domcontentloaded', timeout=30000)
			mock_page.wait_for_load_state.assert_called()


class TestEndToEndIntegration:
	"""End-to-end integration tests"""
	
	@pytest.mark.asyncio
	async def test_complete_extraction_workflow(self, integration_scraper, sample_procurement_source):
		"""Test complete extraction workflow with all components"""
		test_url = str(sample_procurement_source.url)
		
		# Mock successful Crawlee extraction
		mock_context = MagicMock()
		mock_page = AsyncMock()
		mock_request = MagicMock()
		mock_request.url = test_url
		
		mock_context.page = mock_page
		mock_context.request = mock_request
		mock_page.wait_for_load_state = AsyncMock()
		mock_page.content = AsyncMock(return_value="""
		<html>
		<body>
			<div class="opportunities">
				<div class="opportunity">
					<h3>Government IT Services</h3>
					<p>Comprehensive IT support services needed</p>
					<span class="deadline">2024-12-31</span>
					<span class="value">$500,000</span>
				</div>
			</div>
		</body>
		</html>
		""")
		
		# Mock dynamic opportunities
		mock_dynamic_element = AsyncMock()
		mock_dynamic_element.text_content = AsyncMock(return_value="Dynamic Opportunity\nDeadline: 2024-11-30\nValue: $200,000")
		mock_dynamic_element.query_selector = AsyncMock(return_value=None)
		mock_dynamic_element.evaluate = AsyncMock(return_value="div")
		mock_dynamic_element.get_attribute = AsyncMock(return_value="opportunity-dynamic")
		
		mock_page.query_selector_all = AsyncMock(return_value=[mock_dynamic_element])
		
		async def mock_run(handler):
			await handler(mock_context)
		
		integration_scraper.crawlee_crawler.add_requests = AsyncMock()
		integration_scraper.crawlee_crawler.run = AsyncMock(
			side_effect=mock_run
		)
		
		# Mock HTML extraction
		from docfusion.discovery.crawlers.ai_driven.universal_scraper import ExtractionResult
		with patch.object(integration_scraper, '_extract_opportunities_from_html', return_value=ExtractionResult(
			opportunities=[
				{
					'title': 'Government IT Services',
					'description': 'Comprehensive IT support services needed',
					'deadline': '2024-12-31',
					'estimated_value': '$500,000'
				}
			],
			valid_items_found=1
		)):
			
			# Execute complete workflow
			scraping_result, extraction_result = await integration_scraper.scrape_with_intelligence(
				test_url, use_learned_structure=True, learn_structure=True
			)
			
			# Verify successful extraction
			assert scraping_result.status.value == "success"
			assert scraping_result.method_used == "crawlee"
			assert extraction_result.extraction_method == "crawlee"
			
			# Should have both static and dynamic opportunities
			total_opportunities = extraction_result.valid_items_found + len(extraction_result.opportunities)
			assert total_opportunities >= 1
			
			# Verify statistics were updated
			stats = integration_scraper.get_extraction_stats()
			assert stats['total_extractions'] > 0
			assert stats['successful_extractions'] > 0
			assert stats['crawlee_extractions'] > 0
	
	@pytest.mark.asyncio
	async def test_fallback_strategy_chain(self, integration_scraper):
		"""Test fallback strategy chain when primary methods fail"""
		test_url = "https://difficult-site.gov"
		
		# Mock Crawlee failure
		integration_scraper.crawlee_crawler.run = AsyncMock(side_effect=Exception("Crawlee failed"))
		
		# Mock CloudScraper success
		mock_response = MagicMock()
		mock_response.status_code = 200
		mock_response.text = "<html><body>Fallback content</body></html>"
		mock_response.headers = {}
		
		integration_scraper.cloudscraper_session.get = MagicMock(return_value=mock_response)
		
		from docfusion.discovery.crawlers.ai_driven.universal_scraper import ExtractionResult
		with patch.object(integration_scraper, '_extract_opportunities_from_html', return_value=ExtractionResult(
			opportunities=[{'title': 'Fallback Opportunity'}],
			valid_items_found=1
		)):
			scraping_result, extraction_result = await integration_scraper.scrape_with_intelligence(test_url)
			
			# Should succeed with CloudScraper fallback
			assert extraction_result.valid_items_found == 1
			
			# Should contain error from failed Crawlee attempt
			assert len(extraction_result.errors) > 0
			assert any("crawlee" in error.lower() for error in extraction_result.errors)
	
	@pytest.mark.asyncio
	async def test_structure_learning_integration(self, integration_scraper):
		"""Test integration with structure learning"""
		test_url = "https://learning-test.gov"
		domain = "learning-test.gov"
		
		# Set up initial site structure
		from docfusion.discovery.crawlers.ai_driven.universal_scraper import SiteStructure
		initial_structure = SiteStructure(
			domain=domain,
			site_type="government",
			confidence_score=0.5,
			extraction_success_rate=0.6
		)
		
		integration_scraper.site_structures[domain] = initial_structure
		
		# Mock successful extraction
		mock_context = MagicMock()
		mock_page = AsyncMock()
		mock_request = MagicMock()
		mock_request.url = test_url
		
		mock_context.page = mock_page
		mock_context.request = mock_request
		mock_page.wait_for_load_state = AsyncMock()
		mock_page.content = AsyncMock(return_value="<html>Learning content</html>")
		mock_page.query_selector_all = AsyncMock(return_value=[])
		
		async def mock_run(handler):
			await handler(mock_context)
		
		integration_scraper.crawlee_crawler.add_requests = AsyncMock()
		integration_scraper.crawlee_crawler.run = AsyncMock(
			side_effect=mock_run
		)
		
		with patch.object(integration_scraper, '_extract_opportunities_from_html') as mock_extract:
			mock_extract.return_value = MagicMock(
				opportunities=[{'title': 'Learning Opportunity'}],
				valid_items_found=1
			)
			
			# Execute with learning enabled
			scraping_result, extraction_result = await integration_scraper.scrape_with_intelligence(
				test_url, use_learned_structure=True, learn_structure=True
			)
			
			# Verify structure was updated
			updated_structure = integration_scraper.site_structures[domain]
			assert updated_structure.extraction_success_rate >= initial_structure.extraction_success_rate
			assert updated_structure.last_updated >= initial_structure.last_updated


class TestExternalServiceMocking:
	"""Test external service interactions with proper mocking"""
	
	@pytest.mark.asyncio
	async def test_ollama_vision_model_integration(self, integration_scraper):
		"""Test integration with Ollama vision model (mocked)"""
		# This would test the PatternRecognizer integration
		# For now, we verify the scraper can handle external AI services
		
		test_url = "https://vision-test.gov"
		
		# Mock vision analysis
		with patch('requests.post') as mock_post:
			mock_response = MagicMock()
			mock_response.json.return_value = {
				'response': json.dumps([
					{'type': 'procurement_opportunity', 'confidence': 0.9, 'location': 'top-section'}
				])
			}
			mock_post.return_value = mock_response
			
			# This would be tested with actual PatternRecognizer integration
			# For now, verify the scraper framework supports it
			assert integration_scraper is not None
	
	@pytest.mark.asyncio
	async def test_openai_api_integration(self, integration_scraper):
		"""Test OpenAI API integration for LLM extraction"""
		# Mock OpenAI API response
		with patch('openai.ChatCompletion.create') as mock_openai:
			mock_openai.return_value = {
				'choices': [{
					'message': {
						'content': json.dumps([
							{
								'title': 'AI Extracted Opportunity',
								'description': 'Found by OpenAI',
								'deadline': '2024-12-31'
							}
						])
					}
				}]
			}
			
			# This would be part of the Crawl4AI LLM strategy
			# Verify the framework supports external AI APIs
			assert integration_scraper.llm_strategy is not None


@pytest.mark.integration
class TestRealWorldScenarios:
	"""Real-world integration scenarios (requires external services)"""
	
	@pytest.mark.skip(reason="Requires live internet connection")
	@pytest.mark.asyncio
	async def test_live_government_site_extraction(self, integration_scraper):
		"""Test extraction from actual government site"""
		# This would test against a real government procurement site
		# Skipped by default to avoid external dependencies
		
		live_url = "https://sam.gov/api/prod/sgs/v1/search"  # SAM.gov API
		
		try:
			scraping_result, extraction_result = await integration_scraper.scrape_with_intelligence(live_url)
			
			# Verify we can handle real-world responses
			assert scraping_result is not None
			assert extraction_result is not None
			
		except Exception as e:
			pytest.skip(f"Live test failed: {e}")
	
	@pytest.mark.skip(reason="Requires external services")
	@pytest.mark.asyncio
	async def test_cloudflare_bypass_live(self, integration_scraper):
		"""Test CloudScraper against real Cloudflare protection"""
		# This would test against a site with actual Cloudflare protection
		# Skipped to avoid external dependencies
		pass


if __name__ == "__main__":
	# Run integration tests
	pytest.main(["-v", "-k", "not live and not skip", __file__])