"""Fallback behavior for the infrastructure SearXNG client."""

from __future__ import annotations

import httpx
import pytest

from docfusion.infrastructure.searxng_client import SearXNGClient


@pytest.mark.asyncio
async def test_searxng_client_fans_out_to_searx_space_when_primary_degrades(monkeypatch):
	monkeypatch.delenv("SEARXNG_FALLBACK_URLS", raising=False)
	monkeypatch.setenv("SEARXNG_PUBLIC_FALLBACK_LIMIT", "1")
	monkeypatch.setenv("SEARXNG_SPACE_INSTANCES_URL", "https://searx.space/data/instances.json")

	requests: list[httpx.Request] = []

	def handler(request: httpx.Request) -> httpx.Response:
		requests.append(request)
		if request.url.host == "primary.example":
			return httpx.Response(
				200,
				json={
					"query": "case management tender",
					"results": [{
						"title": "Primary case management tender",
						"url": "https://buyer.example/primary",
						"content": "Tender for case management implementation.",
						"engine": "duckduckgo",
						"score": 2.0,
					}],
					"unresponsive_engines": [{"engine": "google", "error": "access denied"}],
				},
			)
		if request.url.host == "searx.space":
			return httpx.Response(
				200,
				json={
					"instances": {
						"https://blocked.example/": {
							"network_type": "normal",
							"http": {"status_code": 200},
							"engines": {"google": {"error_rate": 100}},
							"timing": {"search": {"success_percentage": 100, "all": {"median": 0.1}}},
						},
						"https://fallback.example/": {
							"network_type": "normal",
							"git_url": "https://github.com/searxng/searxng",
							"http": {"status_code": 200},
							"engines": {"google": {"error_rate": 0}},
							"timing": {"search": {"success_percentage": 100, "all": {"median": 0.2}}},
						},
					},
				},
			)
		if request.url.host == "fallback.example":
			return httpx.Response(
				200,
				json={
					"query": "case management tender",
					"results": [{
						"title": "Recovered Google RFP",
						"url": "https://buyer.example/recovered",
						"content": "Request for proposals for implementation services.",
						"engine": "google",
						"score": 3.0,
					}],
				},
			)
		return httpx.Response(404)

	client = SearXNGClient(base_url="https://primary.example")
	client._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))

	try:
		response = await client.search(
			"case management tender",
			engines=["google"],
			limit=10,
		)
	finally:
		await client.close()

	assert [result.title for result in response.results] == [
		"Primary case management tender",
		"Recovered Google RFP",
	]
	assert response.source_instances == [
		"https://primary.example",
		"https://fallback.example",
	]
	assert response.fallback_from == "https://primary.example"
	assert "google" in (response.fallback_reason or "")
	assert [(request.url.host, request.url.path) for request in requests] == [
		("primary.example", "/search"),
		("searx.space", "/data/instances.json"),
		("fallback.example", "/search"),
	]


@pytest.mark.asyncio
async def test_searxng_client_fans_out_when_primary_returns_zero_results(monkeypatch):
	monkeypatch.delenv("SEARXNG_FALLBACK_URLS", raising=False)
	monkeypatch.setenv("SEARXNG_PUBLIC_FALLBACK_LIMIT", "1")
	monkeypatch.setenv("SEARXNG_SPACE_INSTANCES_URL", "https://searx.space/data/instances.json")

	requests: list[httpx.Request] = []

	def handler(request: httpx.Request) -> httpx.Response:
		requests.append(request)
		if request.url.host == "primary.example":
			return httpx.Response(200, json={"query": "rfp", "results": []})
		if request.url.host == "searx.space":
			return httpx.Response(
				200,
				json={
					"instances": {
						"https://fallback.example/": {
							"network_type": "normal",
							"git_url": "https://github.com/searxng/searxng",
							"http": {"status_code": 200},
							"engines": {"google": {"error_rate": 0}},
							"timing": {"search": {"success_percentage": 100, "all": {"median": 0.2}}},
						},
					},
				},
			)
		if request.url.host == "fallback.example":
			return httpx.Response(
				200,
				json={
					"query": "rfp",
					"results": [{
						"title": "Fallback zero-result RFP",
						"url": "https://buyer.example/recovered",
						"content": "Request for proposals for implementation services.",
						"engine": "google",
						"score": 3.0,
					}],
				},
			)
		return httpx.Response(404)

	client = SearXNGClient(base_url="https://primary.example")
	client._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))

	try:
		response = await client.search("rfp", engines=["google"], limit=10)
	finally:
		await client.close()

	assert [result.title for result in response.results] == ["Fallback zero-result RFP"]
	assert response.source_instances == ["https://fallback.example"]
	assert response.fallback_from == "https://primary.example"
	assert "returned no results" in (response.fallback_reason or "")
	assert [(request.url.host, request.url.path) for request in requests] == [
		("primary.example", "/search"),
		("searx.space", "/data/instances.json"),
		("fallback.example", "/search"),
	]


@pytest.mark.asyncio
async def test_searxng_client_fans_out_when_requested_engine_is_missing(monkeypatch):
	monkeypatch.delenv("SEARXNG_FALLBACK_URLS", raising=False)
	monkeypatch.setenv("SEARXNG_PUBLIC_FALLBACK_LIMIT", "1")
	monkeypatch.setenv("SEARXNG_SPACE_INSTANCES_URL", "https://searx.space/data/instances.json")

	def handler(request: httpx.Request) -> httpx.Response:
		if request.url.host == "primary.example":
			return httpx.Response(
				200,
				json={
					"query": "rfp",
					"results": [{
						"title": "Primary Bing RFP",
						"url": "https://buyer.example/primary",
						"content": "Tender for case management implementation.",
						"engine": "bing",
						"score": 2.0,
					}],
				},
			)
		if request.url.host == "searx.space":
			return httpx.Response(
				200,
				json={
					"instances": {
						"https://fallback.example/": {
							"network_type": "normal",
							"git_url": "https://github.com/searxng/searxng",
							"http": {"status_code": 200},
							"engines": {"google": {"error_rate": 0}},
							"timing": {"search": {"success_percentage": 100, "all": {"median": 0.2}}},
						},
					},
				},
			)
		if request.url.host == "fallback.example":
			return httpx.Response(
				200,
				json={
					"query": "rfp",
					"results": [{
						"title": "Fallback Google RFP",
						"url": "https://buyer.example/recovered",
						"content": "Request for proposals for implementation services.",
						"engine": "google",
						"score": 3.0,
					}],
				},
			)
		return httpx.Response(404)

	client = SearXNGClient(base_url="https://primary.example")
	client._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))

	try:
		response = await client.search("rfp", engines=["google"], limit=10)
	finally:
		await client.close()

	assert [result.title for result in response.results] == [
		"Primary Bing RFP",
		"Fallback Google RFP",
	]
	assert response.source_instances == ["https://primary.example", "https://fallback.example"]
	assert response.fallback_from == "https://primary.example"
	assert "none from requested engines google" in (response.fallback_reason or "")


@pytest.mark.asyncio
async def test_searxng_client_recovers_from_primary_failure_with_configured_fallback(monkeypatch):
	monkeypatch.setenv("SEARXNG_FALLBACK_URLS", "https://fallback.example")
	monkeypatch.setenv("SEARXNG_PUBLIC_FALLBACKS", "0")

	def handler(request: httpx.Request) -> httpx.Response:
		if request.url.host == "primary.example":
			return httpx.Response(502, text="bad gateway")
		if request.url.host == "fallback.example":
			return httpx.Response(
				200,
				json={
					"query": "rfp",
					"results": [{
						"title": "Fallback RFP",
						"url": "https://buyer.example/rfp",
						"content": "Request for proposals",
						"engine": "bing",
						"score": 1.0,
					}],
				},
			)
		return httpx.Response(404)

	client = SearXNGClient(base_url="https://primary.example")
	client._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))

	try:
		response = await client.search("rfp", engines=["bing"], limit=1)
	finally:
		await client.close()

	assert [result.title for result in response.results] == ["Fallback RFP"]
	assert response.number_of_results == 1
	assert response.source_instance == "https://fallback.example"
	assert response.fallback_from == "https://primary.example"
