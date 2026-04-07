"""
Web Tools for Agents

Provides web search, scraping, download, and URL validation capabilities.
"""

import logging
import asyncio
import aiohttp
import json
import re
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, urljoin, quote
from dataclasses import dataclass
from datetime import datetime
import mimetypes
from pathlib import Path

from .base import AgentTool, ToolResult, ToolCapability, ToolError, ToolConfig

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
	"""Search result from web search"""
	title: str
	url: str
	snippet: str
	source: str = ""
	relevance_score: float = 0.0
	metadata: Dict[str, Any] = None


class WebSearchTool(AgentTool):
	"""
	Web search tool using multiple search engines
	
	Supports DuckDuckGo, Bing, and other search APIs
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="web_search",
			description="Search the web for information using multiple search engines",
			capabilities=[ToolCapability.WEB_SEARCH, ToolCapability.RESEARCH],
			config=config
		)
		self.session: Optional[aiohttp.ClientSession] = None
		self.search_engines = {
			"duckduckgo": self._search_duckduckgo,
			"bing": self._search_bing
		}
	
	async def execute(self, query: str, max_results: int = 10, 
					 search_engine: str = "duckduckgo", **kwargs) -> ToolResult:
		"""Execute web search"""
		
		if not self.session:
			self.session = aiohttp.ClientSession()
		
		try:
			search_func = self.search_engines.get(search_engine, self._search_duckduckgo)
			results = await search_func(query, max_results)
			
			return ToolResult(
				success=True,
				data=results,
				tool_name=self.name,
				metadata={
					"query": query,
					"search_engine": search_engine,
					"result_count": len(results)
				}
			)
			
		except Exception as e:
			raise ToolError(f"Search failed: {str(e)}", self.name, "SEARCH_ERROR")
	
	async def _search_duckduckgo(self, query: str, max_results: int) -> List[SearchResult]:
		"""Search using DuckDuckGo Instant Answer API"""
		
		# DuckDuckGo Instant Answer API
		url = "https://api.duckduckgo.com/"
		params = {
			"q": query,
			"format": "json",
			"no_html": "1",
			"skip_disambig": "1"
		}
		
		try:
			async with self.session.get(url, params=params) as response:
				data = await response.json()
				
				results = []
				
				# Process instant answer
				if data.get("Answer"):
					results.append(SearchResult(
						title="Instant Answer",
						url=data.get("AnswerURL", ""),
						snippet=data.get("Answer"),
						source="DuckDuckGo",
						relevance_score=1.0
					))
				
				# Process related topics
				for topic in data.get("RelatedTopics", [])[:max_results]:
					if isinstance(topic, dict) and "Text" in topic:
						results.append(SearchResult(
							title=topic.get("Text", "")[:100],
							url=topic.get("FirstURL", ""),
							snippet=topic.get("Text", ""),
							source="DuckDuckGo",
							relevance_score=0.8
						))
				
				return results[:max_results]
				
		except Exception as e:
			self.logger.warning(f"DuckDuckGo search failed: {e}")
			return []
	
	async def _search_bing(self, query: str, max_results: int) -> List[SearchResult]:
		"""Search using Bing (requires API key)"""
		# This would require Bing Search API key
		# For now, return empty results with a note
		return []
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for web search"""
		return {
			"type": "object",
			"properties": {
				"query": {
					"type": "string",
					"description": "Search query"
				},
				"max_results": {
					"type": "integer",
					"default": 10,
					"minimum": 1,
					"maximum": 50,
					"description": "Maximum number of results to return"
				},
				"search_engine": {
					"type": "string",
					"enum": ["duckduckgo", "bing"],
					"default": "duckduckgo",
					"description": "Search engine to use"
				}
			},
			"required": ["query"]
		}


class WebScrapeTool(AgentTool):
	"""
	Web scraping tool for extracting content from web pages
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="web_scrape",
			description="Extract content from web pages",
			capabilities=[ToolCapability.WEB_SCRAPING, ToolCapability.DATA_PROCESSING],
			config=config
		)
		self.session: Optional[aiohttp.ClientSession] = None
	
	async def execute(self, url: str, extract_text: bool = True, 
					 extract_links: bool = False, extract_images: bool = False,
					 css_selector: Optional[str] = None, **kwargs) -> ToolResult:
		"""Execute web scraping"""
		
		if not self.session:
			timeout = aiohttp.ClientTimeout(total=self.config.timeout_seconds)
			self.session = aiohttp.ClientSession(timeout=timeout)
		
		try:
			# Validate URL
			parsed_url = urlparse(url)
			if not parsed_url.scheme or not parsed_url.netloc:
				raise ToolError("Invalid URL provided", self.name, "INVALID_URL")
			
			# Set headers to mimic browser
			headers = {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
			}
			
			async with self.session.get(url, headers=headers) as response:
				if response.status != 200:
					raise ToolError(f"HTTP {response.status}: {response.reason}", 
								  self.name, "HTTP_ERROR")
				
				content = await response.text()
				content_type = response.headers.get('content-type', '').lower()
				
				# Parse content based on type
				if 'html' in content_type:
					result_data = await self._parse_html(content, url, extract_text, 
														extract_links, extract_images, css_selector)
				else:
					result_data = {"text": content, "content_type": content_type}
				
				return ToolResult(
					success=True,
					data=result_data,
					tool_name=self.name,
					metadata={
						"url": url,
						"status_code": response.status,
						"content_type": content_type,
						"content_length": len(content)
					}
				)
				
		except Exception as e:
			raise ToolError(f"Scraping failed: {str(e)}", self.name, "SCRAPE_ERROR")
	
	async def _parse_html(self, html_content: str, base_url: str, extract_text: bool,
						 extract_links: bool, extract_images: bool, 
						 css_selector: Optional[str]) -> Dict[str, Any]:
		"""Parse HTML content and extract requested elements"""
		
		try:
			from bs4 import BeautifulSoup
		except ImportError:
			# Fallback without BeautifulSoup - basic text extraction
			return await self._basic_html_parse(html_content)
		
		soup = BeautifulSoup(html_content, 'html.parser')
		result = {}
		
		if css_selector:
			# Extract content matching CSS selector
			elements = soup.select(css_selector)
			result["selected_content"] = [elem.get_text().strip() for elem in elements]
		
		if extract_text:
			# Remove script and style elements
			for script in soup(["script", "style"]):
				script.decompose()
			
			# Get text content
			text = soup.get_text()
			# Clean up whitespace
			lines = (line.strip() for line in text.splitlines())
			text = '\n'.join(line for line in lines if line)
			result["text"] = text
			
			# Extract title
			title = soup.find("title")
			result["title"] = title.string if title else ""
		
		if extract_links:
			links = []
			for a_tag in soup.find_all("a", href=True):
				href = a_tag["href"]
				full_url = urljoin(base_url, href)
				links.append({
					"text": a_tag.get_text().strip(),
					"url": full_url
				})
			result["links"] = links
		
		if extract_images:
			images = []
			for img_tag in soup.find_all("img", src=True):
				src = img_tag["src"]
				full_url = urljoin(base_url, src)
				images.append({
					"alt": img_tag.get("alt", ""),
					"url": full_url
				})
			result["images"] = images
		
		return result
	
	async def _basic_html_parse(self, html_content: str) -> Dict[str, Any]:
		"""Basic HTML parsing without BeautifulSoup"""
		# Remove HTML tags
		text = re.sub('<[^<]+?>', '', html_content)
		text = re.sub(r'\s+', ' ', text).strip()
		
		# Extract title
		title_match = re.search(r'<title>(.*?)</title>', html_content, re.IGNORECASE)
		title = title_match.group(1) if title_match else ""
		
		return {
			"text": text,
			"title": title
		}
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for web scraping"""
		return {
			"type": "object",
			"properties": {
				"url": {
					"type": "string",
					"description": "URL to scrape"
				},
				"extract_text": {
					"type": "boolean",
					"default": True,
					"description": "Extract text content"
				},
				"extract_links": {
					"type": "boolean", 
					"default": False,
					"description": "Extract all links"
				},
				"extract_images": {
					"type": "boolean",
					"default": False,
					"description": "Extract image URLs"
				},
				"css_selector": {
					"type": "string",
					"description": "CSS selector for specific content"
				}
			},
			"required": ["url"]
		}


class DownloadTool(AgentTool):
	"""
	Download tool for fetching files from URLs
	"""
	
	def __init__(self, download_dir: str = "/tmp/agent_downloads", config: Optional[ToolConfig] = None):
		super().__init__(
			name="download",
			description="Download files from URLs",
			capabilities=[ToolCapability.DOWNLOAD, ToolCapability.FILE_OPERATIONS],
			config=config
		)
		self.download_dir = Path(download_dir)
		self.download_dir.mkdir(exist_ok=True)
		self.session: Optional[aiohttp.ClientSession] = None
	
	async def execute(self, url: str, filename: Optional[str] = None,
					 max_size_mb: int = 100, **kwargs) -> ToolResult:
		"""Execute file download"""
		
		if not self.session:
			timeout = aiohttp.ClientTimeout(total=self.config.timeout_seconds)
			self.session = aiohttp.ClientSession(timeout=timeout)
		
		try:
			# Validate URL
			parsed_url = urlparse(url)
			if not parsed_url.scheme or not parsed_url.netloc:
				raise ToolError("Invalid URL provided", self.name, "INVALID_URL")
			
			# Generate filename if not provided
			if not filename:
				filename = Path(parsed_url.path).name or "download"
				if not filename or filename == "/":
					filename = f"download_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
			
			file_path = self.download_dir / filename
			
			# Set headers
			headers = {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
			}
			
			async with self.session.get(url, headers=headers) as response:
				if response.status != 200:
					raise ToolError(f"HTTP {response.status}: {response.reason}",
								  self.name, "HTTP_ERROR")
				
				# Check content length
				content_length = response.headers.get('content-length')
				if content_length:
					size_mb = int(content_length) / (1024 * 1024)
					if size_mb > max_size_mb:
						raise ToolError(f"File too large: {size_mb:.1f}MB > {max_size_mb}MB",
									  self.name, "FILE_TOO_LARGE")
				
				# Download file
				downloaded_size = 0
				with open(file_path, 'wb') as f:
					async for chunk in response.content.iter_chunked(8192):
						f.write(chunk)
						downloaded_size += len(chunk)
						
						# Check size limit during download
						if downloaded_size > max_size_mb * 1024 * 1024:
							file_path.unlink()  # Delete partial file
							raise ToolError(f"File too large during download: > {max_size_mb}MB",
										  self.name, "FILE_TOO_LARGE")
				
				# Get file info
				content_type = response.headers.get('content-type', '')
				file_size = file_path.stat().st_size
				
				return ToolResult(
					success=True,
					data={
						"file_path": str(file_path),
						"filename": filename,
						"size_bytes": file_size,
						"size_mb": file_size / (1024 * 1024),
						"content_type": content_type,
						"mime_type": mimetypes.guess_type(str(file_path))[0]
					},
					tool_name=self.name,
					metadata={
						"url": url,
						"download_dir": str(self.download_dir)
					}
				)
				
		except Exception as e:
			raise ToolError(f"Download failed: {str(e)}", self.name, "DOWNLOAD_ERROR")
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for download"""
		return {
			"type": "object", 
			"properties": {
				"url": {
					"type": "string",
					"description": "URL to download from"
				},
				"filename": {
					"type": "string", 
					"description": "Custom filename for downloaded file"
				},
				"max_size_mb": {
					"type": "integer",
					"default": 100,
					"minimum": 1,
					"maximum": 1000,
					"description": "Maximum file size in MB"
				}
			},
			"required": ["url"]
		}


class URLValidatorTool(AgentTool):
	"""
	URL validation and analysis tool
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="url_validator",
			description="Validate and analyze URLs",
			capabilities=[ToolCapability.WEB_SEARCH],
			config=config
		)
		self.session: Optional[aiohttp.ClientSession] = None
	
	async def execute(self, url: str, check_availability: bool = True, 
					 follow_redirects: bool = True, **kwargs) -> ToolResult:
		"""Execute URL validation"""
		
		# Basic URL validation
		try:
			parsed = urlparse(url)
			is_valid = bool(parsed.scheme and parsed.netloc)
		except Exception as e:
			logger.warning(f"Failed to parse URL {url}: {e}")
			is_valid = False
		
		result_data = {
			"url": url,
			"is_valid": is_valid,
			"scheme": parsed.scheme if is_valid else None,
			"domain": parsed.netloc if is_valid else None,
			"path": parsed.path if is_valid else None
		}
		
		if not is_valid:
			return ToolResult(
				success=True,
				data=result_data,
				tool_name=self.name
			)
		
		# Check availability if requested
		if check_availability:
			if not self.session:
				timeout = aiohttp.ClientTimeout(total=10)  # Shorter timeout for validation
				self.session = aiohttp.ClientSession(timeout=timeout)
			
			try:
				headers = {"User-Agent": "Mozilla/5.0 URL Validator"}
				method = aiohttp.hdrs.METH_HEAD if not follow_redirects else aiohttp.hdrs.METH_GET
				
				async with self.session.request(method, url, headers=headers, 
											   allow_redirects=follow_redirects) as response:
					result_data.update({
						"available": True,
						"status_code": response.status,
						"content_type": response.headers.get('content-type'),
						"final_url": str(response.url) if follow_redirects else url,
						"redirected": str(response.url) != url
					})
					
			except Exception as e:
				result_data.update({
					"available": False,
					"error": str(e)
				})
		
		return ToolResult(
			success=True,
			data=result_data,
			tool_name=self.name
		)
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for URL validation"""
		return {
			"type": "object",
			"properties": {
				"url": {
					"type": "string",
					"description": "URL to validate"
				},
				"check_availability": {
					"type": "boolean",
					"default": True,
					"description": "Check if URL is accessible"
				},
				"follow_redirects": {
					"type": "boolean", 
					"default": True,
					"description": "Follow HTTP redirects"
				}
			},
			"required": ["url"]
		}