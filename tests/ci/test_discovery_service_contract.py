"""Behavior checks for the default discovery service contract."""

from __future__ import annotations

from typing import Any

import pytest

from docfusion.services.discovery_service import DefaultDiscoveryService


class _FakeSearchResponse:
	def raise_for_status(self) -> None:
		return None

	def json(self) -> dict[str, Any]:
		return {
			"results": [
				{
					"title": "Tender for case management platform",
					"url": "https://example.test/tenders/case-management",
					"content": "RFP for digital case management implementation.",
					"engine": "bing",
					"score": 3.5,
				},
				{
					"title": "Annual report",
					"url": "https://example.test/news",
					"content": "General corporate update.",
					"engine": "bing",
					"score": 1.0,
				},
			],
		}


class _FakeAsyncClient:
	calls: list[dict[str, Any]] = []

	def __init__(self, *args: Any, **kwargs: Any) -> None:
		self.args = args
		self.kwargs = kwargs

	async def __aenter__(self) -> "_FakeAsyncClient":
		return self

	async def __aexit__(self, *args: Any) -> None:
		return None

	async def get(self, url: str, params: dict[str, Any]) -> _FakeSearchResponse:
		self.calls.append({"url": url, "params": params})
		return _FakeSearchResponse()


class _FakeAnalysis:
	def model_dump(self) -> dict[str, Any]:
		return {"status": "analyzed", "confidence": 0.8}


class _FakeOpportunityAnalyzer:
	def __init__(self) -> None:
		self.last_input: dict[str, Any] | None = None

	async def analyze_opportunity(self, opportunity: dict[str, Any]) -> _FakeAnalysis:
		self.last_input = opportunity
		return _FakeAnalysis()


class _FakeScrapeResult:
	success = True
	markdown = (
		"# Detailed tender notice\n\n"
		"RFP package for digital case management implementation with submission requirements.\n\n"
		"[RFP package](/docs/case-management-rfp.pdf)"
	)
	links = ["/docs/case-management-rfp.pdf", "https://example.test/news"]
	metadata = {
		"title": "Detailed case management tender",
		"description": "Full tender notice from the buyer portal.",
	}
	extract: dict[str, Any] = {}
	error = None


class _FakeFirecrawlClient:
	calls: list[dict[str, Any]] = []

	def __init__(self, *args: Any, **kwargs: Any) -> None:
		self.args = args
		self.kwargs = kwargs

	async def __aenter__(self) -> "_FakeFirecrawlClient":
		return self

	async def __aexit__(self, *args: Any) -> None:
		return None

	async def scrape(self, url: str, options: Any) -> _FakeScrapeResult:
		self.calls.append({"url": url, "options": options})
		return _FakeScrapeResult()


def _bare_discovery_service() -> DefaultDiscoveryService:
	service = DefaultDiscoveryService.__new__(DefaultDiscoveryService)
	service._opportunity_cache = {}
	service._searxng_url = "https://search.lindela.io"
	service._opportunity_analyzer = None
	service._qualification_analyzer = None
	service._global_db = None
	service._engine = None
	service._firecrawl_url = "http://84.247.181.100:3002"
	service._firecrawl_enrich_limit = 3
	return service


@pytest.mark.asyncio
async def test_default_discovery_searches_searxng_and_caches_opportunities(monkeypatch):
	_FakeAsyncClient.calls = []
	monkeypatch.setattr("httpx.AsyncClient", _FakeAsyncClient)
	service = _bare_discovery_service()

	results = await service.discover_opportunities(filters={"query": "case management tender", "limit": 5, "enrich": False})

	assert len(results) == 1
	assert results[0]["title"] == "Tender for case management platform"
	assert results[0]["source"] == "searxng"
	assert await service.get_opportunity_details(results[0]["id"]) == results[0]
	assert _FakeAsyncClient.calls[0]["url"] == "https://search.lindela.io/search"
	assert _FakeAsyncClient.calls[0]["params"]["q"] == "case management tender"


@pytest.mark.asyncio
async def test_default_discovery_enriches_top_search_results_with_firecrawl(monkeypatch):
	_FakeAsyncClient.calls = []
	_FakeFirecrawlClient.calls = []
	monkeypatch.setattr("httpx.AsyncClient", _FakeAsyncClient)
	monkeypatch.setattr(
		"docfusion.infrastructure.firecrawl_client.FirecrawlClient",
		_FakeFirecrawlClient,
	)
	service = _bare_discovery_service()

	results = await service.discover_opportunities(filters={"query": "case management tender", "limit": 5})

	assert len(results) == 1
	assert results[0]["title"] == "Detailed case management tender"
	assert results[0]["description"] == "Full tender notice from the buyer portal."
	assert results[0]["scrape_status"] == "success"
	assert "RFP package for digital case management" in results[0]["requirements"]
	assert "firecrawl-enriched" in results[0]["tags"]
	assert results[0]["document_links"] == [{
		"url": "https://example.test/docs/case-management-rfp.pdf",
		"source": "firecrawl-link",
	}]
	assert _FakeFirecrawlClient.calls[0]["url"] == "https://example.test/tenders/case-management"
	assert await service.get_opportunity_details(results[0]["id"]) == results[0]


@pytest.mark.asyncio
async def test_default_discovery_analysis_uses_cached_opportunity_without_stub_status():
	service = _bare_discovery_service()
	analyzer = _FakeOpportunityAnalyzer()
	service._opportunity_analyzer = analyzer
	service._opportunity_cache["opp-1"] = {
		"id": "opp-1",
		"title": "Case management RFP",
		"description": "RFP for case workflow modernization.",
	}

	result = await service.analyze_opportunity("opp-1")

	assert result == {"status": "analyzed", "confidence": 0.8}
	assert analyzer.last_input == service._opportunity_cache["opp-1"]


@pytest.mark.asyncio
async def test_default_discovery_analysis_is_honest_when_details_are_missing():
	service = _bare_discovery_service()
	service._opportunity_analyzer = _FakeOpportunityAnalyzer()

	result = await service.analyze_opportunity("missing")

	assert result["status"] == "unavailable"
	assert "not_implemented" not in str(result)


@pytest.mark.asyncio
async def test_default_discovery_lists_searxng_source():
	service = _bare_discovery_service()

	sources = await service.list_sources()

	assert sources == [{
		"id": "searxng",
		"name": "SearXNG metasearch",
		"type": "metasearch",
		"region": "global",
		"url": "https://search.lindela.io",
	}, {
		"id": "firecrawl",
		"name": "Firecrawl page enrichment",
		"type": "scraper",
		"region": "global",
		"url": "http://84.247.181.100:3002",
	}]
