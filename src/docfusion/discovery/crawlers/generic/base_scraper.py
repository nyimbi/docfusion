#!/usr/bin/env python3
"""
Base Scraper Framework

Robust, intelligent web scraping infrastructure with rate limiting,
proxy management, error handling, and session management.
"""

import asyncio
import aiohttp
import time
import logging
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any, Union, Set, Callable
from enum import Enum
import json
import hashlib
from urllib.parse import urljoin, urlparse
from pathlib import Path
import tempfile
import os

from pydantic import BaseModel, Field
import uuid

def uuid7str() -> str:
	"""Generate a UUID7-like string using UUID4"""
	return str(uuid.uuid4())


class ScrapingStatus(str, Enum):
	"""Scraping operation status"""
	PENDING = "pending"
	RUNNING = "running"
	SUCCESS = "success"
	FAILED = "failed"
	RATE_LIMITED = "rate_limited"
	BLOCKED = "blocked"
	TIMEOUT = "timeout"


class ProxyStatus(str, Enum):
	"""Proxy health status"""
	ACTIVE = "active"
	SLOW = "slow"
	BLOCKED = "blocked"
	FAILED = "failed"
	TESTING = "testing"


@dataclass
class ScrapingConfiguration:
	"""Configuration for scraping operations"""
	# Rate limiting
	requests_per_second: float = 1.0
	requests_per_minute: int = 30
	requests_per_hour: int = 1000
	burst_size: int = 5
	
	# Timeouts and delays
	request_timeout: int = 30
	page_load_timeout: int = 60
	retry_delay_base: float = 1.0
	retry_delay_max: float = 300.0
	random_delay_range: tuple[float, float] = (0.5, 2.0)
	
	# Retry configuration
	max_retries: int = 3
	retry_on_status_codes: Set[int] = field(default_factory=lambda: {429, 502, 503, 504})
	backoff_multiplier: float = 2.0
	
	# Session management
	session_duration: int = 3600  # 1 hour
	max_concurrent_sessions: int = 10
	
	# User agent rotation
	user_agents: List[str] = field(default_factory=lambda: [
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
		'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
	])
	
	# Headers
	default_headers: Dict[str, str] = field(default_factory=lambda: {
		'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
		'Accept-Language': 'en-US,en;q=0.9',
		'Accept-Encoding': 'gzip, deflate',
		'DNT': '1',
		'Connection': 'keep-alive',
		'Upgrade-Insecure-Requests': '1'
	})
	
	# Proxy configuration
	enable_proxy_rotation: bool = True
	proxy_test_timeout: int = 10
	proxy_max_failures: int = 3
	proxy_cooldown_minutes: int = 30


class ProxyManager:
	"""Manages proxy rotation and health monitoring"""
	
	def __init__(self, config: ScrapingConfiguration):
		self.config = config
		self.logger = logging.getLogger(__name__)
		
		# Proxy pools
		self.http_proxies: List[str] = []
		self.socks_proxies: List[str] = []
		
		# Proxy status tracking
		self.proxy_status: Dict[str, ProxyStatus] = {}
		self.proxy_failures: Dict[str, int] = {}
		self.proxy_last_used: Dict[str, datetime] = {}
		self.proxy_response_times: Dict[str, List[float]] = {}
		
		# Current proxy index for rotation
		self._current_http_index = 0
		self._current_socks_index = 0
	
	def add_http_proxies(self, proxies: List[str]):
		"""Add HTTP proxies to the pool"""
		for proxy in proxies:
			if proxy not in self.http_proxies:
				self.http_proxies.append(proxy)
				self.proxy_status[proxy] = ProxyStatus.TESTING
				self.proxy_failures[proxy] = 0
				self.proxy_response_times[proxy] = []
	
	def add_socks_proxies(self, proxies: List[str]):
		"""Add SOCKS proxies to the pool"""
		for proxy in proxies:
			if proxy not in self.socks_proxies:
				self.socks_proxies.append(proxy)
				self.proxy_status[proxy] = ProxyStatus.TESTING
				self.proxy_failures[proxy] = 0
				self.proxy_response_times[proxy] = []
	
	def get_next_proxy(self, proxy_type: str = 'http') -> Optional[str]:
		"""Get next available proxy with rotation"""
		if not self.config.enable_proxy_rotation:
			return None
		
		proxies = self.http_proxies if proxy_type == 'http' else self.socks_proxies
		if not proxies:
			return None
		
		# Filter active proxies
		active_proxies = [
			proxy for proxy in proxies 
			if self.proxy_status.get(proxy) == ProxyStatus.ACTIVE
		]
		
		if not active_proxies:
			# Try to find proxies that are not blocked
			available_proxies = [
				proxy for proxy in proxies
				if self.proxy_status.get(proxy) in [ProxyStatus.SLOW, ProxyStatus.TESTING]
			]
			if available_proxies:
				active_proxies = available_proxies[:1]  # Try one
			else:
				return None
		
		# Round-robin selection with current index
		if proxy_type == 'http':
			proxy = active_proxies[self._current_http_index % len(active_proxies)]
			self._current_http_index += 1
		else:
			proxy = active_proxies[self._current_socks_index % len(active_proxies)]
			self._current_socks_index += 1
		
		self.proxy_last_used[proxy] = datetime.now(timezone.utc)
		return proxy
	
	def record_proxy_result(self, proxy: str, success: bool, response_time: Optional[float] = None):
		"""Record proxy usage result for health monitoring"""
		if proxy not in self.proxy_status:
			return
		
		if success:
			# Reset failure count and update status
			self.proxy_failures[proxy] = 0
			if response_time:
				self.proxy_response_times[proxy].append(response_time)
				# Keep only last 10 response times
				if len(self.proxy_response_times[proxy]) > 10:
					self.proxy_response_times[proxy] = self.proxy_response_times[proxy][-10:]
				
				# Determine status based on average response time
				avg_time = sum(self.proxy_response_times[proxy]) / len(self.proxy_response_times[proxy])
				self.proxy_status[proxy] = ProxyStatus.SLOW if avg_time > 10.0 else ProxyStatus.ACTIVE
			else:
				self.proxy_status[proxy] = ProxyStatus.ACTIVE
		else:
			# Increment failure count
			self.proxy_failures[proxy] += 1
			
			if self.proxy_failures[proxy] >= self.config.proxy_max_failures:
				self.proxy_status[proxy] = ProxyStatus.BLOCKED
				self.logger.warning(f"Proxy {proxy} marked as blocked after {self.proxy_failures[proxy]} failures")
			elif self.proxy_failures[proxy] > 1:
				self.proxy_status[proxy] = ProxyStatus.FAILED
	
	async def test_proxy(self, proxy: str, test_url: str = "http://httpbin.org/ip") -> bool:
		"""Test proxy connectivity and performance"""
		try:
			connector = aiohttp.ProxyConnector.from_url(proxy)
			timeout = aiohttp.ClientTimeout(total=self.config.proxy_test_timeout)
			
			start_time = time.time()
			async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
				async with session.get(test_url) as response:
					if response.status == 200:
						response_time = time.time() - start_time
						self.record_proxy_result(proxy, True, response_time)
						return True
					else:
						self.record_proxy_result(proxy, False)
						return False
		except Exception as e:
			self.logger.debug(f"Proxy test failed for {proxy}: {e}")
			self.record_proxy_result(proxy, False)
			return False
	
	def cleanup_failed_proxies(self):
		"""Remove blocked proxies that have been in cooldown"""
		now = datetime.now(timezone.utc)
		cooldown_duration = timedelta(minutes=self.config.proxy_cooldown_minutes)
		
		for proxy in list(self.proxy_status.keys()):
			if self.proxy_status[proxy] == ProxyStatus.BLOCKED:
				last_used = self.proxy_last_used.get(proxy)
				if last_used and (now - last_used) > cooldown_duration:
					# Reset proxy for retesting
					self.proxy_status[proxy] = ProxyStatus.TESTING
					self.proxy_failures[proxy] = 0
					self.logger.info(f"Proxy {proxy} reset for retesting after cooldown")


class RateLimiter:
	"""Advanced rate limiting with multiple windows and burst support"""
	
	def __init__(self, config: ScrapingConfiguration):
		self.config = config
		self.logger = logging.getLogger(__name__)
		
		# Request tracking
		self.request_times: List[datetime] = []
		self.last_request_time: Optional[datetime] = None
		self.burst_tokens = config.burst_size
		self.burst_last_refill = datetime.now(timezone.utc)
		
		# Per-domain rate limiting
		self.domain_request_times: Dict[str, List[datetime]] = {}
	
	async def wait_if_needed(self, domain: Optional[str] = None) -> float:
		"""Wait if rate limiting is needed, return actual wait time"""
		now = datetime.now(timezone.utc)
		wait_time = 0.0
		
		# Check burst capacity first
		if self.burst_tokens > 0:
			self.burst_tokens -= 1
			return 0.0  # No wait needed for burst requests
		
		# Refill burst tokens (1 per second)
		time_since_refill = (now - self.burst_last_refill).total_seconds()
		if time_since_refill >= 1.0:
			tokens_to_add = min(self.config.burst_size, int(time_since_refill))
			self.burst_tokens = min(self.config.burst_size, self.burst_tokens + tokens_to_add)
			self.burst_last_refill = now
		
		# Check rate limits
		min_interval = 1.0 / self.config.requests_per_second
		
		if self.last_request_time:
			time_since_last = (now - self.last_request_time).total_seconds()
			if time_since_last < min_interval:
				wait_time = min_interval - time_since_last
				await asyncio.sleep(wait_time)
		
		# Clean old request times (keep only last hour)
		cutoff_time = now - timedelta(hours=1)
		self.request_times = [t for t in self.request_times if t > cutoff_time]
		
		# Check hourly limits
		if len(self.request_times) >= self.config.requests_per_hour:
			oldest_request = min(self.request_times)
			wait_until = oldest_request + timedelta(hours=1)
			if wait_until > now:
				additional_wait = (wait_until - now).total_seconds()
				wait_time += additional_wait
				await asyncio.sleep(additional_wait)
		
		# Update tracking
		self.request_times.append(now)
		self.last_request_time = now
		
		return wait_time
	
	def add_random_delay(self) -> float:
		"""Add random delay to avoid detection"""
		delay = random.uniform(*self.config.random_delay_range)
		return delay


class SessionManager:
	"""Manages HTTP sessions with automatic rotation"""
	
	def __init__(self, config: ScrapingConfiguration, proxy_manager: ProxyManager):
		self.config = config
		self.proxy_manager = proxy_manager
		self.logger = logging.getLogger(__name__)
		
		# Active sessions
		self.sessions: Dict[str, aiohttp.ClientSession] = {}
		self.session_created: Dict[str, datetime] = {}
		self.session_request_count: Dict[str, int] = {}
		
		# Session rotation
		self.current_session_index = 0
	
	async def get_session(self, use_proxy: bool = True) -> aiohttp.ClientSession:
		"""Get or create a session with automatic rotation"""
		now = datetime.now(timezone.utc)
		
		# Clean expired sessions
		await self._cleanup_expired_sessions()
		
		# Check if we need a new session
		if len(self.sessions) < self.config.max_concurrent_sessions:
			session_id = f"session_{uuid7str()}"
			session = await self._create_session(session_id, use_proxy)
			return session
		
		# Use existing session with round-robin
		session_ids = list(self.sessions.keys())
		if session_ids:
			session_id = session_ids[self.current_session_index % len(session_ids)]
			self.current_session_index += 1
			
			# Check if session needs rotation
			session_age = (now - self.session_created[session_id]).total_seconds()
			request_count = self.session_request_count[session_id]
			
			if session_age > self.config.session_duration or request_count > 100:
				await self._rotate_session(session_id, use_proxy)
			
			return self.sessions[session_id]
		
		# Fallback: create new session
		session_id = f"session_{uuid7str()}"
		return await self._create_session(session_id, use_proxy)
	
	async def _create_session(self, session_id: str, use_proxy: bool) -> aiohttp.ClientSession:
		"""Create a new HTTP session"""
		# Get headers with random user agent
		headers = self.config.default_headers.copy()
		headers['User-Agent'] = random.choice(self.config.user_agents)
		
		# Configure proxy if enabled
		connector = None
		if use_proxy:
			proxy = self.proxy_manager.get_next_proxy()
			if proxy:
				try:
					connector = aiohttp.ProxyConnector.from_url(proxy)
				except Exception as e:
					self.logger.warning(f"Failed to create proxy connector for {proxy}: {e}")
		
		# Create session
		timeout = aiohttp.ClientTimeout(total=self.config.request_timeout)
		session = aiohttp.ClientSession(
			headers=headers,
			connector=connector,
			timeout=timeout
		)
		
		# Track session
		self.sessions[session_id] = session
		self.session_created[session_id] = datetime.now(timezone.utc)
		self.session_request_count[session_id] = 0
		
		self.logger.debug(f"Created session {session_id} with proxy: {bool(connector)}")
		return session
	
	async def _rotate_session(self, session_id: str, use_proxy: bool):
		"""Rotate an existing session"""
		if session_id in self.sessions:
			await self.sessions[session_id].close()
			del self.sessions[session_id]
			del self.session_created[session_id]
			del self.session_request_count[session_id]
		
		# Create new session with same ID
		self.sessions[session_id] = await self._create_session(session_id, use_proxy)
	
	async def _cleanup_expired_sessions(self):
		"""Clean up expired sessions"""
		now = datetime.now(timezone.utc)
		expired_sessions = []
		
		for session_id, created_time in self.session_created.items():
			if (now - created_time).total_seconds() > self.config.session_duration:
				expired_sessions.append(session_id)
		
		for session_id in expired_sessions:
			if session_id in self.sessions:
				await self.sessions[session_id].close()
				del self.sessions[session_id]
				del self.session_created[session_id]
				del self.session_request_count[session_id]
				
		if expired_sessions:
			self.logger.debug(f"Cleaned up {len(expired_sessions)} expired sessions")
	
	def record_request(self, session: aiohttp.ClientSession):
		"""Record a request for session tracking"""
		session_id = next((sid for sid, s in self.sessions.items() if s == session), None)
		if session_id:
			self.session_request_count[session_id] += 1
	
	async def close_all(self):
		"""Close all active sessions"""
		for session in self.sessions.values():
			await session.close()
		
		self.sessions.clear()
		self.session_created.clear()
		self.session_request_count.clear()


class ScrapingResult(BaseModel):
	"""Result from a scraping operation"""
	request_id: str = Field(default_factory=uuid7str)
	url: str
	status: ScrapingStatus
	status_code: Optional[int] = None
	
	# Content
	html_content: Optional[str] = None
	text_content: Optional[str] = None
	json_content: Optional[Dict[str, Any]] = None
	
	# Metadata
	response_headers: Dict[str, str] = Field(default_factory=dict)
	content_type: Optional[str] = None
	content_length: Optional[int] = None
	
	# Timing
	start_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	end_time: Optional[datetime] = None
	total_time: Optional[float] = None
	
	# Request details
	proxy_used: Optional[str] = None
	user_agent_used: Optional[str] = None
	retries_attempted: int = 0
	
	# Error information
	error_message: Optional[str] = None
	error_type: Optional[str] = None


class BaseScraper(ABC):
	"""
	Abstract base class for all scrapers with robust infrastructure
	"""
	
	def __init__(self, config: Optional[ScrapingConfiguration] = None):
		"""Initialize scraper with configuration"""
		self.config = config or ScrapingConfiguration()
		self.logger = logging.getLogger(self.__class__.__name__)
		
		# Initialize managers
		self.proxy_manager = ProxyManager(self.config)
		self.rate_limiter = RateLimiter(self.config)
		self.session_manager = SessionManager(self.config, self.proxy_manager)
		
		# Statistics tracking
		self.stats = {
			'total_requests': 0,
			'successful_requests': 0,
			'failed_requests': 0,
			'rate_limited_requests': 0,
			'blocked_requests': 0,
			'total_wait_time': 0.0,
			'avg_response_time': 0.0
		}
		
		# Cache for repeated requests
		self._response_cache: Dict[str, ScrapingResult] = {}
		self._cache_ttl = 3600  # 1 hour
	
	async def scrape_url(
		self,
		url: str,
		headers: Optional[Dict[str, str]] = None,
		use_cache: bool = True,
		use_proxy: bool = True
	) -> ScrapingResult:
		"""
		Scrape a single URL with full error handling and retry logic
		"""
		request_id = uuid7str()
		result = ScrapingResult(
			request_id=request_id,
			url=url,
			status=ScrapingStatus.PENDING
		)
		
		# Check cache first
		if use_cache:
			cache_key = self._get_cache_key(url, headers)
			cached_result = self._get_cached_result(cache_key)
			if cached_result:
				self.logger.debug(f"Using cached result for {url}")
				return cached_result
		
		# Update stats
		self.stats['total_requests'] += 1
		
		# Apply rate limiting
		wait_time = await self.rate_limiter.wait_if_needed(urlparse(url).netloc)
		if wait_time > 0:
			self.stats['total_wait_time'] += wait_time
			# Add random delay
			random_delay = self.rate_limiter.add_random_delay()
			await asyncio.sleep(random_delay)
			self.stats['total_wait_time'] += random_delay
		
		# Attempt request with retries
		for attempt in range(self.config.max_retries + 1):
			try:
				result.status = ScrapingStatus.RUNNING
				result.retries_attempted = attempt
				
				# Get session
				session = await self.session_manager.get_session(use_proxy)
				
				# Prepare headers
				request_headers = self.config.default_headers.copy()
				if headers:
					request_headers.update(headers)
				
				# Make request
				start_time = time.time()
				async with session.get(url, headers=request_headers) as response:
					end_time = time.time()
					
					# Update result timing
					result.end_time = datetime.now(timezone.utc)
					result.total_time = end_time - start_time
					result.status_code = response.status
					result.response_headers = dict(response.headers)
					result.content_type = response.headers.get('Content-Type', '')
					result.content_length = response.headers.get('Content-Length')
					
					# Record request for session management
					self.session_manager.record_request(session)
					
					# Check for rate limiting or blocking
					if response.status == 429:
						result.status = ScrapingStatus.RATE_LIMITED
						self.stats['rate_limited_requests'] += 1
						
						# Extract rate limit info if available
						retry_after = response.headers.get('Retry-After')
						if retry_after:
							try:
								wait_time = int(retry_after)
								await asyncio.sleep(min(wait_time, 300))  # Max 5 minutes
							except ValueError:
								await asyncio.sleep(60)  # Default 1 minute
						else:
							await asyncio.sleep(60)
						
						continue  # Retry
					
					elif response.status in [403, 401]:
						result.status = ScrapingStatus.BLOCKED
						self.stats['blocked_requests'] += 1
						result.error_message = f"Access denied (HTTP {response.status})"
						break  # Don't retry
					
					elif response.status >= 500:
						# Server error - retry
						result.error_message = f"Server error (HTTP {response.status})"
						if attempt < self.config.max_retries:
							delay = self.config.retry_delay_base * (self.config.backoff_multiplier ** attempt)
							delay = min(delay, self.config.retry_delay_max)
							await asyncio.sleep(delay)
							continue
						else:
							result.status = ScrapingStatus.FAILED
							break
					
					elif response.status != 200:
						result.status = ScrapingStatus.FAILED
						result.error_message = f"HTTP error {response.status}"
						break
					
					# Success - read content
					content = await response.read()
					
					# Determine content type and decode
					if 'application/json' in result.content_type.lower():
						try:
							result.json_content = json.loads(content.decode('utf-8'))
						except (json.JSONDecodeError, UnicodeDecodeError) as e:
							result.error_message = f"Failed to decode JSON: {e}"
							result.status = ScrapingStatus.FAILED
							break
					else:
						try:
							result.html_content = content.decode('utf-8')
							result.text_content = await self._extract_text(result.html_content)
						except UnicodeDecodeError:
							try:
								# Try with different encoding
								result.html_content = content.decode('latin-1')
								result.text_content = await self._extract_text(result.html_content)
							except Exception as e:
								result.error_message = f"Failed to decode content: {e}"
								result.status = ScrapingStatus.FAILED
								break
					
					result.status = ScrapingStatus.SUCCESS
					self.stats['successful_requests'] += 1
					
					# Record proxy success if used
					proxy_used = getattr(session.connector, '_proxy', None) if hasattr(session, 'connector') else None
					if proxy_used:
						self.proxy_manager.record_proxy_result(str(proxy_used), True, result.total_time)
					
					break  # Success, exit retry loop
					
			except asyncio.TimeoutError:
				result.error_message = "Request timeout"
				result.error_type = "TimeoutError"
				if attempt < self.config.max_retries:
					delay = self.config.retry_delay_base * (self.config.backoff_multiplier ** attempt)
					await asyncio.sleep(min(delay, self.config.retry_delay_max))
					continue
				else:
					result.status = ScrapingStatus.TIMEOUT
					break
					
			except Exception as e:
				result.error_message = str(e)
				result.error_type = type(e).__name__
				self.logger.error(f"Scraping error for {url}: {e}")
				
				# Record proxy failure if used
				try:
					session = await self.session_manager.get_session(use_proxy)
					proxy_used = getattr(session.connector, '_proxy', None) if hasattr(session, 'connector') else None
					if proxy_used:
						self.proxy_manager.record_proxy_result(str(proxy_used), False)
				except:
					pass
				
				if attempt < self.config.max_retries:
					delay = self.config.retry_delay_base * (self.config.backoff_multiplier ** attempt)
					await asyncio.sleep(min(delay, self.config.retry_delay_max))
					continue
				else:
					result.status = ScrapingStatus.FAILED
					break
		
		# Update final stats
		if result.status == ScrapingStatus.FAILED:
			self.stats['failed_requests'] += 1
		
		# Cache successful result
		if result.status == ScrapingStatus.SUCCESS and use_cache:
			cache_key = self._get_cache_key(url, headers)
			self._cache_result(cache_key, result)
		
		return result
	
	async def scrape_urls(
		self,
		urls: List[str],
		headers: Optional[Dict[str, str]] = None,
		max_concurrent: int = 10,
		use_cache: bool = True,
		use_proxy: bool = True
	) -> List[ScrapingResult]:
		"""
		Scrape multiple URLs concurrently with proper resource management
		"""
		semaphore = asyncio.Semaphore(max_concurrent)
		
		async def scrape_with_semaphore(url: str) -> ScrapingResult:
			async with semaphore:
				return await self.scrape_url(url, headers, use_cache, use_proxy)
		
		tasks = [scrape_with_semaphore(url) for url in urls]
		results = await asyncio.gather(*tasks, return_exceptions=True)
		
		# Convert exceptions to failed results
		final_results = []
		for i, result in enumerate(results):
			if isinstance(result, Exception):
				failed_result = ScrapingResult(
					url=urls[i],
					status=ScrapingStatus.FAILED,
					error_message=str(result),
					error_type=type(result).__name__
				)
				final_results.append(failed_result)
			else:
				final_results.append(result)
		
		return final_results
	
	def _get_cache_key(self, url: str, headers: Optional[Dict[str, str]]) -> str:
		"""Generate cache key for request"""
		content = f"{url}|{json.dumps(headers or {}, sort_keys=True)}"
		return hashlib.md5(content.encode()).hexdigest()
	
	def _cache_result(self, cache_key: str, result: ScrapingResult):
		"""Cache a successful result"""
		self._response_cache[cache_key] = result
	
	def _get_cached_result(self, cache_key: str) -> Optional[ScrapingResult]:
		"""Get cached result if still valid"""
		if cache_key in self._response_cache:
			cached_result = self._response_cache[cache_key]
			# Check if cache is still valid
			if cached_result.start_time:
				cache_age = (datetime.now(timezone.utc) - cached_result.start_time).total_seconds()
				if cache_age < self._cache_ttl:
					return cached_result
				else:
					# Remove expired cache entry
					del self._response_cache[cache_key]
		return None
	
	async def _extract_text(self, html_content: str) -> str:
		"""Extract text from HTML content (basic implementation)"""
		try:
			from bs4 import BeautifulSoup
			soup = BeautifulSoup(html_content, 'html.parser')
			
			# Remove script and style elements
			for script in soup(["script", "style"]):
				script.decompose()
			
			# Get text and clean up whitespace
			text = soup.get_text()
			lines = (line.strip() for line in text.splitlines())
			chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
			text = ' '.join(chunk for chunk in chunks if chunk)
			
			return text
		except ImportError:
			# Fallback: basic HTML tag removal
			import re
			text = re.sub(r'<[^>]+>', ' ', html_content)
			text = re.sub(r'\s+', ' ', text).strip()
			return text
	
	def get_stats(self) -> Dict[str, Any]:
		"""Get scraping statistics"""
		stats = self.stats.copy()
		
		# Calculate derived metrics
		if stats['total_requests'] > 0:
			stats['success_rate'] = stats['successful_requests'] / stats['total_requests']
			stats['failure_rate'] = stats['failed_requests'] / stats['total_requests']
			
		if stats['successful_requests'] > 0 and stats['total_wait_time'] > 0:
			stats['avg_wait_time'] = stats['total_wait_time'] / stats['successful_requests']
		
		# Add proxy stats
		stats['active_proxies'] = len([p for p, s in self.proxy_manager.proxy_status.items() if s == ProxyStatus.ACTIVE])
		stats['total_proxies'] = len(self.proxy_manager.proxy_status)
		
		return stats
	
	async def cleanup(self):
		"""Clean up resources"""
		await self.session_manager.close_all()
		self.proxy_manager.cleanup_failed_proxies()
		self._response_cache.clear()
	
	@abstractmethod
	async def extract_opportunities(self, result: ScrapingResult) -> List[Dict[str, Any]]:
		"""
		Extract procurement opportunities from scraped content.
		Must be implemented by subclasses.
		"""
		pass
	
	@abstractmethod
	async def validate_opportunity(self, opportunity: Dict[str, Any]) -> bool:
		"""
		Validate an extracted opportunity.
		Must be implemented by subclasses.
		"""
		pass


# Utility functions for common scraping tasks
def create_scraper_config(
	requests_per_second: float = 1.0,
	use_proxies: bool = False,
	max_retries: int = 3
) -> ScrapingConfiguration:
	"""Create a scraping configuration with common settings"""
	return ScrapingConfiguration(
		requests_per_second=requests_per_second,
		max_retries=max_retries,
		enable_proxy_rotation=use_proxies
	)


async def test_scraper_connectivity(scraper: BaseScraper, test_urls: List[str]) -> Dict[str, Any]:
	"""Test scraper connectivity and performance"""
	results = await scraper.scrape_urls(test_urls, max_concurrent=3)
	
	success_count = sum(1 for r in results if r.status == ScrapingStatus.SUCCESS)
	total_time = sum(r.total_time or 0 for r in results if r.total_time)
	
	return {
		'total_tests': len(test_urls),
		'successful_tests': success_count,
		'success_rate': success_count / len(test_urls) if test_urls else 0,
		'average_response_time': total_time / len(test_urls) if test_urls else 0,
		'results': results
	}