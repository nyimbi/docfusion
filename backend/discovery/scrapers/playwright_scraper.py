"""
Playwright-Enabled Scraper Base Class
======================================

Extends BaseScraper with JavaScript rendering support using Playwright.

For sites that require JavaScript rendering (UNGM, dynamic government portals),
use PlaywrightScraper instead of BaseScraper.

Features:
    - Headless Chromium browser
    - Automatic JavaScript rendering
    - Wait for dynamic content
    - Screenshot capture for debugging
    - API request interception for data extraction

Usage:
    class UNGMScraper(PlaywrightScraper):
        source_id = "ungm"
        source_name = "UN Global Marketplace"
        base_url = "https://www.ungm.org"

        async def scrape(self) -> list[ScrapedOpportunity]:
            html = await self.fetch_page_js("/Public/Notice", wait_for=".notice-item")
            return self.parse_notices(html)

Author: DocuFusion Team
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, ClassVar
from datetime import datetime, timezone

from backend.discovery.scrapers.base import BaseScraper
from backend.discovery.models.opportunity import ScrapedOpportunity, ScraperResult

logger = logging.getLogger(__name__)


class PlaywrightScraper(BaseScraper):
    """
    Base scraper with Playwright support for JavaScript-rendered pages.

    Extends BaseScraper with:
        - Headless Chromium browser for JS rendering
        - Automatic wait for dynamic content
        - Request interception for API data
        - Screenshot capture for debugging

    Use this for sites where:
        - Content is loaded via JavaScript
        - Data comes from internal API calls
        - Anti-bot measures require real browser behavior
    """

    # Playwright-specific settings
    requires_javascript: bool = True
    headless: bool = True
    browser_type: str = "chromium"  # chromium, firefox, webkit

    # Wait settings
    default_wait_timeout: int = 30000  # 30 seconds
    default_wait_for: str | None = None  # CSS selector to wait for

    # Browser instance (shared across requests)
    _playwright: Any = None
    _browser: Any = None
    _context: Any = None

    async def _init_playwright(self) -> None:
        """Initialize Playwright browser if not already running."""
        if self._browser is not None:
            return

        try:
            from playwright.async_api import async_playwright

            self._playwright = await async_playwright().start()

            if self.browser_type == "firefox":
                self._browser = await self._playwright.firefox.launch(headless=self.headless)
            elif self.browser_type == "webkit":
                self._browser = await self._playwright.webkit.launch(headless=self.headless)
            else:
                self._browser = await self._playwright.chromium.launch(headless=self.headless)

            # Create context with realistic settings
            self._context = await self._browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                locale="en-US",
                timezone_id="America/New_York",
            )

            logger.debug(f"[{self.source_id}] Playwright browser initialized")

        except ImportError:
            logger.error(f"[{self.source_id}] Playwright not installed. Install with: pip install playwright && playwright install")
            raise RuntimeError("Playwright not installed. Run: pip install playwright && playwright install")

    async def close(self) -> None:
        """Close Playwright browser and HTTP client."""
        if self._context:
            await self._context.close()
            self._context = None

        if self._browser:
            await self._browser.close()
            self._browser = None

        if self._playwright:
            await self._playwright.stop()
            self._playwright = None

        await super().close()

    async def fetch_page_js(
        self,
        url: str,
        *,
        wait_for: str | None = None,
        timeout: int | None = None,
        screenshot: bool = False,
        wait_for_network_idle: bool = True,
    ) -> str:
        """
        Fetch a page with JavaScript rendering using Playwright.

        Args:
            url: URL to fetch (relative or absolute)
            wait_for: CSS selector to wait for before returning
            timeout: Timeout in milliseconds
            screenshot: Capture screenshot for debugging
            wait_for_network_idle: Wait for network to be idle

        Returns:
            Rendered HTML content
        """
        # Build absolute URL
        if not url.startswith(("http://", "https://")):
            from urllib.parse import urljoin
            url = urljoin(self.base_url, url)

        await self._init_playwright()
        page = await self._context.new_page()

        try:
            # Apply rate limiting
            await self._wait_for_rate_limit()

            # Navigate to page
            response = await page.goto(
                url,
                timeout=timeout or self.default_wait_timeout,
                wait_until="networkidle" if wait_for_network_idle else "load",
            )

            if not response:
                raise Exception(f"Failed to load {url}")

            if response.status >= 400:
                raise Exception(f"HTTP {response.status} error loading {url}")

            # Wait for specific element if provided
            if wait_for:
                await page.wait_for_selector(
                    wait_for,
                    timeout=timeout or self.default_wait_timeout,
                    state="attached",  # Wait for element in DOM, not visible
                )

            # Optional screenshot for debugging
            if screenshot:
                screenshot_path = f"/tmp/{self.source_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                await page.screenshot(path=screenshot_path)
                logger.debug(f"[{self.source_id}] Screenshot saved: {screenshot_path}")

            # Get rendered HTML
            html = await page.content()
            self._bytes_downloaded += len(html)
            self._request_count += 1

            return html

        finally:
            await page.close()

    async def fetch_api_data(
        self,
        url: str,
        *,
        api_pattern: str | None = None,
        wait_for: str | None = None,
        timeout: int | None = None,
    ) -> list[dict[str, Any]]:
        """
        Intercept and extract data from API calls made by JavaScript.

        Useful for sites that load data via internal APIs.
        Captures XHR/Fetch responses matching a pattern.

        Args:
            url: Page URL to load
            api_pattern: Regex pattern for API URLs to capture
            wait_for: CSS selector to wait for
            timeout: Timeout in milliseconds

        Returns:
            List of captured API response data
        """
        import re

        await self._init_playwright()
        page = await self._context.new_page()

        captured_data: list[dict[str, Any]] = []

        try:
            # Set up response interception
            async def handle_response(response: Any) -> None:
                if api_pattern:
                    if re.search(api_pattern, response.url):
                        try:
                            data = await response.json()
                            captured_data.append(data)
                        except Exception:
                            pass

            page.on("response", handle_response)

            # Navigate
            await self._wait_for_rate_limit()
            await page.goto(url, timeout=timeout or self.default_wait_timeout)

            if wait_for:
                await page.wait_for_selector(wait_for, timeout=timeout or self.default_wait_timeout)

            return captured_data

        finally:
            await page.close()

    async def execute_script(
        self,
        url: str,
        script: str,
        *,
        wait_for: str | None = None,
        timeout: int | None = None,
    ) -> Any:
        """
        Load page and execute JavaScript in browser context.

        Args:
            url: Page URL
            script: JavaScript to execute
            wait_for: CSS selector to wait for
            timeout: Timeout in milliseconds

        Returns:
            Script result
        """
        await self._init_playwright()
        page = await self._context.new_page()

        try:
            await self._wait_for_rate_limit()
            await page.goto(url, timeout=timeout or self.default_wait_timeout)

            if wait_for:
                await page.wait_for_selector(wait_for, timeout=timeout or self.default_wait_timeout)

            result = await page.evaluate(script)
            self._request_count += 1

            return result

        finally:
            await page.close()

    async def run(self) -> ScraperResult:
        """
        Execute Playwright-enabled scraper.

        Wraps BaseScraper.run() with Playwright initialization/cleanup.
        """
        try:
            return await super().run()
        finally:
            # Ensure browser is closed even if scrape fails
            if self._browser:
                await self.close()