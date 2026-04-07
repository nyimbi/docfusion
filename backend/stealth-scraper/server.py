"""
Stealth Scraper Service with LLM Extraction

A FastAPI service that provides:
1. Stealth web scraping using Camoufox (0% detection rate)
2. LLM-based structured data extraction via Ollama

This is a drop-in replacement for Firecrawl when sites block normal scraping.
The API is designed to be Firecrawl-compatible for easy integration.

Architecture:
    Request → Camoufox (stealth browser) → HTML/Markdown
                    ↓
              Ollama (local LLM) → Structured JSON extraction

Port: 3003 (runs alongside Firecrawl on 3002)
"""

import asyncio
import json
import os
import random
import re
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Optional
from urllib.parse import urljoin, urlparse

import logging

import httpx

logger = logging.getLogger(__name__)
from camoufox.async_api import AsyncCamoufox
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from markdownify import markdownify as md
from pydantic import BaseModel, ConfigDict, Field


# ============================================================================
# Configuration
# ============================================================================

MAX_CONTENT_LENGTH = 15000  # Maximum characters sent to LLM extraction

PORT = int(os.getenv("PORT", "3003"))
HOST = os.getenv("HOST", "0.0.0.0")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "granite4:350m")


# ============================================================================
# Request/Response Models
# ============================================================================

class ExtractConfig(BaseModel):
	"""Configuration for LLM extraction."""
	schema_: dict[str, Any] = Field(alias="schema", description="JSON schema for extraction")
	systemPrompt: Optional[str] = Field(default=None, description="System prompt for LLM")
	prompt: Optional[str] = Field(default=None, description="User prompt for LLM")


class ScrapeOptions(BaseModel):
	"""Options for scraping a URL."""
	model_config = ConfigDict(extra="forbid", populate_by_name=True)

	timeout: int = Field(default=60000, description="Timeout in milliseconds")
	waitForSelector: Optional[str] = Field(default=None, alias="wait_for_selector")
	waitAfterLoad: int = Field(default=2000, alias="wait_after_load")
	humanScroll: bool = Field(default=True, alias="human_scroll")
	screenshot: bool = Field(default=False)
	blockMedia: bool = Field(default=True, alias="block_media")


class ScrapeRequest(BaseModel):
	"""Request body for scrape endpoint."""
	url: str
	formats: Optional[list[str]] = Field(default=["markdown"])
	extract: Optional[ExtractConfig] = None
	options: Optional[ScrapeOptions] = None

	# Aliases for Firecrawl compatibility
	includeTags: Optional[list[str]] = None
	excludeTags: Optional[list[str]] = None
	timeout: Optional[int] = None


class ScrapeMetadata(BaseModel):
	"""Metadata about the scraped page."""
	title: Optional[str] = None
	description: Optional[str] = None
	language: Optional[str] = None
	sourceURL: str
	statusCode: int


class ScrapeData(BaseModel):
	"""Data returned from scraping."""
	markdown: Optional[str] = None
	html: Optional[str] = None
	rawHtml: Optional[str] = None
	metadata: ScrapeMetadata
	links: Optional[list[str]] = None
	screenshot: Optional[str] = None
	extract: Optional[dict[str, Any]] = None


class ScrapeResponse(BaseModel):
	"""Response from scrape endpoint - Firecrawl compatible."""
	success: bool
	data: Optional[ScrapeData] = None
	error: Optional[str] = None


class HealthResponse(BaseModel):
	"""Health check response."""
	status: str
	service: str
	engine: str
	ollama_url: str
	ollama_model: str
	ollama_status: str


# ============================================================================
# Utility Functions
# ============================================================================

def extract_links(html: str, base_url: str) -> list[str]:
	"""Extract all HTTP/HTTPS links from HTML content."""
	link_pattern = re.compile(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>', re.IGNORECASE)
	links = set()

	for match in link_pattern.finditer(html):
		href = match.group(1)
		try:
			absolute = urljoin(base_url, href)
			parsed = urlparse(absolute)
			if parsed.scheme in ("http", "https"):
				links.add(absolute)
		except Exception:
			pass

	return sorted(links)


def extract_meta_description(html: str) -> Optional[str]:
	"""Extract meta description from HTML."""
	pattern = re.compile(
		r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
		re.IGNORECASE
	)
	match = pattern.search(html)
	if match:
		return match.group(1)

	# Try alternate format
	pattern2 = re.compile(
		r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']',
		re.IGNORECASE
	)
	match2 = pattern2.search(html)
	return match2.group(1) if match2 else None


def extract_language(html: str) -> Optional[str]:
	"""Extract language from HTML."""
	pattern = re.compile(r'<html[^>]+lang=["\']([^"\']+)["\']', re.IGNORECASE)
	match = pattern.search(html)
	return match.group(1) if match else None


async def random_delay(min_ms: int, max_ms: int) -> None:
	"""Sleep for a random duration."""
	delay = random.randint(min_ms, max_ms) / 1000
	await asyncio.sleep(delay)


async def simulate_human_scroll(page) -> None:
	"""Simulate human-like scrolling behavior."""
	try:
		scroll_height = await page.evaluate("document.body.scrollHeight")
		viewport_height = await page.evaluate("window.innerHeight")

		if scroll_height <= viewport_height * 1.5:
			return

		current_scroll = 0
		max_scroll = min(scroll_height - viewport_height, viewport_height * 3)

		while current_scroll < max_scroll:
			scroll_amount = random.randint(100, 400)
			current_scroll += scroll_amount
			await page.evaluate(f"window.scrollTo({{top: {current_scroll}, behavior: 'smooth'}})")
			await random_delay(200, 800)

		await random_delay(500, 1000)
		await page.evaluate("window.scrollTo({top: 0, behavior: 'smooth'})")
	except Exception:
		pass


# ============================================================================
# Ollama LLM Extraction
# ============================================================================

async def check_ollama_health() -> bool:
	"""Check if Ollama is reachable."""
	try:
		async with httpx.AsyncClient() as client:
			response = await client.get(f"{OLLAMA_URL}/api/tags", timeout=5.0)
			return response.status_code == 200
	except Exception:
		return False


async def extract_with_ollama(
	content: str,
	schema: dict[str, Any],
	system_prompt: Optional[str] = None,
	user_prompt: Optional[str] = None
) -> dict[str, Any]:
	"""
	Extract structured data from content using Ollama.

	Uses JSON mode with schema guidance to extract data matching the schema.
	"""
	# Truncate content with warning if necessary
	original_length = len(content)
	content = content[:MAX_CONTENT_LENGTH]
	if original_length > MAX_CONTENT_LENGTH:
		logger.warning(
			f"Content truncated: {original_length} -> {MAX_CONTENT_LENGTH} chars "
			f"({MAX_CONTENT_LENGTH / original_length:.0%} retained)"
		)

	# Build the extraction prompt
	default_system = """You are a data extraction assistant. Extract structured data from the provided content.
Return ONLY valid JSON matching the schema. Do not include explanations or markdown formatting.
If a field cannot be found, omit it or use null. Do not make up data."""

	default_user = f"""Extract data from the following content according to this JSON schema:

Schema:
```json
{json.dumps(schema, indent=2)}
```

Content:
{content}

Return ONLY the JSON object, no explanations."""

	messages = [
		{"role": "system", "content": system_prompt or default_system},
		{"role": "user", "content": user_prompt or default_user}
	]

	try:
		async with httpx.AsyncClient() as client:
			response = await client.post(
				f"{OLLAMA_URL}/api/chat",
				json={
					"model": OLLAMA_MODEL,
					"messages": messages,
					"stream": False,
					"format": "json",
					"options": {
						"temperature": 0.1,  # Low temperature for consistent extraction
						"num_predict": 4096,  # Allow longer responses
					}
				},
				timeout=300.0  # 5 minute timeout for LLM
			)

			if response.status_code != 200:
				raise Exception(f"Ollama error: {response.text}")

			result = response.json()
			content_text = result.get("message", {}).get("content", "{}")

			# Parse the JSON response
			try:
				return json.loads(content_text)
			except json.JSONDecodeError:
				# Try to extract JSON from the response
				json_match = re.search(r'\{[\s\S]*\}', content_text)
				if json_match:
					return json.loads(json_match.group())
				return {"error": "Failed to parse LLM response", "raw": content_text[:500]}

	except httpx.TimeoutException:
		return {"error": "LLM extraction timed out"}
	except Exception as e:
		return {"error": f"LLM extraction failed: {str(e)}"}


# ============================================================================
# Stealth Scraper
# ============================================================================

async def stealth_scrape(
	url: str,
	formats: list[str],
	options: ScrapeOptions,
	extract_config: Optional[ExtractConfig] = None
) -> ScrapeResponse:
	"""
	Scrape a URL using Camoufox stealth browser.

	Camoufox provides:
	- Realistic fingerprints via BrowserForge
	- C++ level fingerprint modifications
	- Automatic geoip/timezone matching
	- 0% detection on anti-bot tests
	"""
	timeout_sec = options.timeout / 1000

	try:
		async with AsyncCamoufox(
			headless=True,
			geoip=True,
			block_images=options.blockMedia,
			humanize=True,
		) as browser:
			page = await browser.new_page()

			try:
				# Navigate with timeout
				await page.goto(url, timeout=timeout_sec * 1000, wait_until="domcontentloaded")

				# Wait for selector if specified
				if options.waitForSelector:
					await page.wait_for_selector(options.waitForSelector, timeout=timeout_sec * 500)

				# Wait for dynamic content
				await random_delay(options.waitAfterLoad, options.waitAfterLoad + 1000)

				# Human-like scrolling
				if options.humanScroll:
					await simulate_human_scroll(page)

				# Get content
				html = await page.content()
				title = await page.title()

				# Convert to markdown
				markdown = md(
					html,
					heading_style="ATX",
					bullets="-",
					strip=["script", "style", "nav", "footer", "header", "aside", "noscript"]
				)

				# Extract metadata
				description = extract_meta_description(html)
				language = extract_language(html)

				# Extract links if requested
				links = extract_links(html, url) if "links" in formats else None

				# Screenshot if requested
				screenshot_b64 = None
				if options.screenshot or "screenshot" in formats:
					import base64
					screenshot_bytes = await page.screenshot(type="png")
					screenshot_b64 = base64.b64encode(screenshot_bytes).decode()

				# LLM extraction if requested
				extracted_data = None
				if extract_config and ("extract" in formats or extract_config.schema_):
					extracted_data = await extract_with_ollama(
						markdown,  # Use markdown for cleaner extraction
						extract_config.schema_,
						extract_config.systemPrompt,
						extract_config.prompt
					)

				# Build response data
				data = ScrapeData(
					markdown=markdown if "markdown" in formats else None,
					html=html if "html" in formats else None,
					rawHtml=html if "rawHtml" in formats else None,
					metadata=ScrapeMetadata(
						title=title,
						description=description,
						language=language,
						sourceURL=url,
						statusCode=200
					),
					links=links,
					screenshot=screenshot_b64,
					extract=extracted_data
				)

				return ScrapeResponse(success=True, data=data)

			except Exception as e:
				return ScrapeResponse(success=False, error=f"Page error: {str(e)}")

	except Exception as e:
		return ScrapeResponse(success=False, error=f"Browser error: {str(e)}")


# ============================================================================
# FastAPI Application
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
	"""Application lifespan handler."""
	ollama_ok = await check_ollama_health()
	print(f"""
╔═══════════════════════════════════════════════════════════════════╗
║           STEALTH SCRAPER SERVICE (Camoufox + Ollama)             ║
╠═══════════════════════════════════════════════════════════════════╣
║  Server:     http://{HOST}:{PORT:<43}║
║  Health:     GET /health                                          ║
║  Scrape:     POST /v1/scrape                                      ║
║                                                                   ║
║  Browser:    Camoufox (Firefox, 0% detection)                     ║
║  LLM:        Ollama @ {OLLAMA_URL:<40}║
║  Model:      {OLLAMA_MODEL:<52}║
║  LLM Status: {"✅ Connected" if ollama_ok else "❌ Not available":<52}║
╚═══════════════════════════════════════════════════════════════════╝
""")
	yield


app = FastAPI(
	title="Stealth Scraper",
	description="Anti-bot bypass scraping with LLM extraction using Camoufox and Ollama",
	version="1.0.0",
	lifespan=lifespan
)

def _get_allowed_origins() -> list[str]:
	"""Parse allowed CORS origins from environment variable.

	Defaults to localhost:3000 (Next.js dev server) if not configured.
	In production, set CORS_ALLOWED_ORIGINS to a comma-separated list of origins.
	"""
	origins_env = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
	return [origin.strip() for origin in origins_env.split(",") if origin.strip()]


# CORS for frontend access
app.add_middleware(
	CORSMiddleware,
	allow_origins=_get_allowed_origins(),
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
	"""
	Health check endpoint.

	Returns service status and Ollama connectivity.
	"""
	ollama_ok = await check_ollama_health()
	return HealthResponse(
		status="ok",
		service="stealth-scraper",
		engine="camoufox",
		ollama_url=OLLAMA_URL,
		ollama_model=OLLAMA_MODEL,
		ollama_status="connected" if ollama_ok else "unavailable"
	)


@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_endpoint(request: ScrapeRequest):
	"""
	Scrape a URL with stealth browser and optional LLM extraction.

	This is the native endpoint. For Firecrawl compatibility, use /v1/scrape.
	"""
	options = request.options or ScrapeOptions()

	# Override timeout from request if provided
	if request.timeout:
		options.timeout = request.timeout

	formats = request.formats or ["markdown"]

	return await stealth_scrape(request.url, formats, options, request.extract)


@app.post("/v1/scrape", response_model=ScrapeResponse)
async def scrape_v1_endpoint(request: ScrapeRequest):
	"""
	Scrape a URL with stealth browser (Firecrawl-compatible API).

	This endpoint accepts the same request format as Firecrawl's /v1/scrape,
	making it a drop-in replacement for blocked sites.

	Example request:
	```json
	{
	    "url": "https://example.com",
	    "formats": ["markdown", "extract"],
	    "extract": {
	        "schema": {
	            "type": "object",
	            "properties": {
	                "title": {"type": "string"},
	                "items": {"type": "array"}
	            }
	        },
	        "systemPrompt": "Extract tender information"
	    }
	}
	```
	"""
	options = request.options or ScrapeOptions()

	if request.timeout:
		options.timeout = request.timeout

	formats = request.formats or ["markdown"]

	# If extract config provided, ensure "extract" is in formats
	if request.extract and "extract" not in formats:
		formats.append("extract")

	return await stealth_scrape(request.url, formats, options, request.extract)


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
	import uvicorn
	uvicorn.run(app, host=HOST, port=PORT)
