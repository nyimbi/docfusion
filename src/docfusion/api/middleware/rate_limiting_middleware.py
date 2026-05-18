#!/usr/bin/env python3
"""
Rate Limiting Middleware

FastAPI middleware implementing sliding window rate limiting with different
limits for different endpoints, user tiers, and request types.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import time
from collections import deque, defaultdict

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse


class RateLimitRule:
	"""Rate limit rule configuration"""
	
	def __init__(
		self,
		requests_per_minute: int,
		requests_per_hour: int,
		requests_per_day: int,
		burst_limit: Optional[int] = None,
		endpoints: Optional[List[str]] = None,
		methods: Optional[List[str]] = None,
		user_tiers: Optional[List[str]] = None
	):
		self.requests_per_minute = requests_per_minute
		self.requests_per_hour = requests_per_hour
		self.requests_per_day = requests_per_day
		self.burst_limit = burst_limit or requests_per_minute
		self.endpoints = endpoints or []
		self.methods = methods or []
		self.user_tiers = user_tiers or []


class SlidingWindowCounter:
	"""Sliding window rate counter"""
	
	def __init__(self):
		self.requests: deque = deque()
	
	def add_request(self, timestamp: float):
		"""Add request timestamp"""
		self.requests.append(timestamp)
	
	def count_requests(self, window_seconds: int) -> int:
		"""Count requests in sliding window"""
		now = time.time()
		cutoff = now - window_seconds
		
		# Remove old requests
		while self.requests and self.requests[0] < cutoff:
			self.requests.popleft()
		
		return len(self.requests)
	
	def cleanup_old_requests(self, max_age_seconds: int = 86400):
		"""Clean up old requests beyond max age"""
		now = time.time()
		cutoff = now - max_age_seconds
		
		while self.requests and self.requests[0] < cutoff:
			self.requests.popleft()


class RateLimitingMiddleware:
	"""Rate limiting middleware with sliding windows"""
	
	def __init__(self):
		self.logger = logging.getLogger(__name__)
		
		# Request counters per client
		self.counters: Dict[str, SlidingWindowCounter] = defaultdict(SlidingWindowCounter)
		
		# Rate limit rules
		self.rules: List[RateLimitRule] = []
		
		# Default rules
		self._setup_default_rules()
		
		# Cleanup task
		self._cleanup_task = None
		self._start_cleanup_task()
		
		self.logger.info("Rate limiting middleware initialized")
	
	def _setup_default_rules(self):
		"""Set up default rate limiting rules"""
		# Default rule for all endpoints
		self.rules.append(RateLimitRule(
			requests_per_minute=100,
			requests_per_hour=1000,
			requests_per_day=10000
		))
		
		# Stricter limits for authentication endpoints
		self.rules.append(RateLimitRule(
			requests_per_minute=10,
			requests_per_hour=50,
			requests_per_day=200,
			endpoints=['/api/v1/auth/login', '/api/v1/auth/register'],
			methods=['POST']
		))
		
		# Document creation limits
		self.rules.append(RateLimitRule(
			requests_per_minute=20,
			requests_per_hour=200,
			requests_per_day=1000,
			endpoints=['/api/v1/documents'],
			methods=['POST']
		))
		
		# Search endpoint limits
		self.rules.append(RateLimitRule(
			requests_per_minute=50,
			requests_per_hour=500,
			requests_per_day=2000,
			endpoints=['/api/v1/documents/search', '/api/v1/templates/search']
		))
		
		# API key endpoints (more generous)
		self.rules.append(RateLimitRule(
			requests_per_minute=500,
			requests_per_hour=5000,
			requests_per_day=50000,
			user_tiers=['premium', 'enterprise']
		))
	
	async def __call__(self, request: Request, call_next):
		"""Process request through rate limiting"""
		try:
			# Get client identifier
			client_id = self._get_client_id(request)
			
			# Check rate limits
			rate_limit_result = await self._check_rate_limits(request, client_id)
			
			if not rate_limit_result['allowed']:
				return self._create_rate_limit_response(rate_limit_result)
			
			# Record request
			await self._record_request(client_id)
			
			# Process request
			response = await call_next(request)
			
			# Add rate limit headers to response
			self._add_rate_limit_headers(response, rate_limit_result)
			
			return response
		
		except Exception as e:
			self.logger.error(f"Rate limiting error: {e}")
			# Don't block request on rate limiting errors
			return await call_next(request)
	
	async def _check_rate_limits(
		self,
		request: Request,
		client_id: str
	) -> Dict[str, Any]:
		"""Check if request is within rate limits"""
		counter = self.counters[client_id]
		
		# Get applicable rules for this request
		applicable_rules = self._get_applicable_rules(request)
		
		# Check each rule
		for rule in applicable_rules:
			# Check minute limit
			minute_count = counter.count_requests(60)
			if minute_count >= rule.requests_per_minute:
				return {
					'allowed': False,
					'reason': 'rate_limit_exceeded',
					'limit_type': 'per_minute',
					'limit': rule.requests_per_minute,
					'current': minute_count,
					'reset_time': self._calculate_reset_time(counter, 60),
					'retry_after': self._calculate_retry_after(counter, rule.requests_per_minute, 60)
				}
			
			# Check hour limit
			hour_count = counter.count_requests(3600)
			if hour_count >= rule.requests_per_hour:
				return {
					'allowed': False,
					'reason': 'rate_limit_exceeded',
					'limit_type': 'per_hour',
					'limit': rule.requests_per_hour,
					'current': hour_count,
					'reset_time': self._calculate_reset_time(counter, 3600),
					'retry_after': self._calculate_retry_after(counter, rule.requests_per_hour, 3600)
				}
			
			# Check day limit
			day_count = counter.count_requests(86400)
			if day_count >= rule.requests_per_day:
				return {
					'allowed': False,
					'reason': 'rate_limit_exceeded',
					'limit_type': 'per_day',
					'limit': rule.requests_per_day,
					'current': day_count,
					'reset_time': self._calculate_reset_time(counter, 86400),
					'retry_after': self._calculate_retry_after(counter, rule.requests_per_day, 86400)
				}
			
			# Check burst limit
			burst_count = counter.count_requests(10)  # 10-second window for burst
			if burst_count >= rule.burst_limit:
				return {
					'allowed': False,
					'reason': 'burst_limit_exceeded',
					'limit_type': 'burst',
					'limit': rule.burst_limit,
					'current': burst_count,
					'reset_time': self._calculate_reset_time(counter, 10),
					'retry_after': 10  # Fixed retry after for burst
				}
		
		# All rules passed
		most_restrictive_rule = min(applicable_rules, key=lambda r: r.requests_per_minute)
		
		return {
			'allowed': True,
			'minute_limit': most_restrictive_rule.requests_per_minute,
			'hour_limit': most_restrictive_rule.requests_per_hour,
			'day_limit': most_restrictive_rule.requests_per_day,
			'minute_remaining': most_restrictive_rule.requests_per_minute - counter.count_requests(60),
			'hour_remaining': most_restrictive_rule.requests_per_hour - counter.count_requests(3600),
			'day_remaining': most_restrictive_rule.requests_per_day - counter.count_requests(86400),
			'reset_time': self._calculate_reset_time(counter, 60)
		}
	
	def _get_applicable_rules(self, request: Request) -> List[RateLimitRule]:
		"""Get rate limit rules applicable to this request"""
		path = request.url.path
		method = request.method
		
		# Get user tier if available
		user_tier = None
		if hasattr(request.state, 'user') and request.state.user:
			user_info = request.state.user
			# Determine tier from user permissions or API key type
			if user_info.get('auth_type') == 'api_key':
				api_key_info = user_info.get('api_key_info', {})
				user_tier = api_key_info.get('tier', 'basic')
			else:
				user_permissions = user_info.get('permissions', {})
				user_roles = [role['role_name'] for role in user_permissions.get('roles', [])]
				if 'Admin' in user_roles:
					user_tier = 'enterprise'
				elif 'Manager' in user_roles:
					user_tier = 'premium'
				else:
					user_tier = 'basic'
		
		applicable_rules = []
		
		for rule in self.rules:
			# Check endpoint match
			if rule.endpoints and not any(path.startswith(endpoint) for endpoint in rule.endpoints):
				continue
			
			# Check method match
			if rule.methods and method not in rule.methods:
				continue
			
			# Check user tier match
			if rule.user_tiers and user_tier not in rule.user_tiers:
				continue
			
			applicable_rules.append(rule)
		
		# If no specific rules match, use default rule
		if not applicable_rules:
			applicable_rules = [self.rules[0]]  # First rule is default
		
		return applicable_rules
	
	def _get_client_id(self, request: Request) -> str:
		"""Get unique client identifier"""
		# Try to get user ID first
		if hasattr(request.state, 'user') and request.state.user:
			user_id = request.state.user.get('user_id')
			if user_id:
				return f"user:{user_id}"
		
		# Try API key
		api_key = request.headers.get('X-API-Key')
		if api_key:
			return f"api_key:{api_key[:16]}"  # Use first 16 chars for privacy
		
		# Fall back to IP address
		ip_address = self._get_client_ip(request)
		return f"ip:{ip_address}"
	
	def _get_client_ip(self, request: Request) -> str:
		"""Extract client IP address"""
		# Check forwarded headers
		forwarded_for = request.headers.get('X-Forwarded-For')
		if forwarded_for:
			return forwarded_for.split(',')[0].strip()
		
		real_ip = request.headers.get('X-Real-IP')
		if real_ip:
			return real_ip
		
		# Fall back to client host
		if request.client:
			return request.client.host
		
		return "unknown"
	
	async def _record_request(self, client_id: str):
		"""Record request timestamp"""
		now = time.time()
		self.counters[client_id].add_request(now)
	
	def _calculate_reset_time(self, counter: SlidingWindowCounter, window_seconds: int) -> int:
		"""Calculate when the rate limit window resets"""
		if not counter.requests:
			return int(time.time())
		
		oldest_request = counter.requests[0]
		return int(oldest_request + window_seconds)
	
	def _calculate_retry_after(
		self,
		counter: SlidingWindowCounter,
		limit: int,
		window_seconds: int
	) -> int:
		"""Calculate retry-after seconds"""
		if not counter.requests or len(counter.requests) < limit:
			return 1
		
		# Find the oldest request that would need to age out
		oldest_blocking_request = counter.requests[-(limit-1)] if len(counter.requests) >= limit else counter.requests[0]
		retry_time = oldest_blocking_request + window_seconds
		
		return max(1, int(retry_time - time.time()))
	
	def _create_rate_limit_response(self, rate_limit_result: Dict[str, Any]) -> JSONResponse:
		"""Create rate limit exceeded response"""
		headers = {
			'X-RateLimit-Limit': str(rate_limit_result['limit']),
			'X-RateLimit-Remaining': '0',
			'X-RateLimit-Reset': str(rate_limit_result['reset_time']),
			'Retry-After': str(rate_limit_result['retry_after'])
		}
		
		content = {
			'error': 'Rate limit exceeded',
			'message': f"Too many requests. Limit: {rate_limit_result['limit']} {rate_limit_result['limit_type']}",
			'limit_type': rate_limit_result['limit_type'],
			'limit': rate_limit_result['limit'],
			'current': rate_limit_result['current'],
			'retry_after': rate_limit_result['retry_after'],
			'reset_time': rate_limit_result['reset_time']
		}
		
		return JSONResponse(
			status_code=status.HTTP_429_TOO_MANY_REQUESTS,
			content=content,
			headers=headers
		)
	
	def _add_rate_limit_headers(self, response, rate_limit_result: Dict[str, Any]):
		"""Add rate limiting headers to response"""
		if rate_limit_result['allowed']:
			response.headers['X-RateLimit-Limit-Minute'] = str(rate_limit_result['minute_limit'])
			response.headers['X-RateLimit-Remaining-Minute'] = str(rate_limit_result['minute_remaining'])
			response.headers['X-RateLimit-Limit-Hour'] = str(rate_limit_result['hour_limit'])
			response.headers['X-RateLimit-Remaining-Hour'] = str(rate_limit_result['hour_remaining'])
			response.headers['X-RateLimit-Limit-Day'] = str(rate_limit_result['day_limit'])
			response.headers['X-RateLimit-Remaining-Day'] = str(rate_limit_result['day_remaining'])
			response.headers['X-RateLimit-Reset'] = str(rate_limit_result['reset_time'])
	
	def _start_cleanup_task(self):
		"""Start background cleanup task"""
		async def cleanup_loop():
			while True:
				try:
					await asyncio.sleep(300)  # Cleanup every 5 minutes
					await self._cleanup_old_requests()
				except Exception as e:
					self.logger.error(f"Cleanup task error: {e}")
		
		self._cleanup_task = asyncio.create_task(cleanup_loop())
	
	async def _cleanup_old_requests(self):
		"""Clean up old request records"""
		cleanup_count = 0
		empty_clients = []
		
		for client_id, counter in self.counters.items():
			counter.cleanup_old_requests()
			cleanup_count += 1
			
			# Remove empty counters
			if not counter.requests:
				empty_clients.append(client_id)
		
		# Remove empty client counters
		for client_id in empty_clients:
			del self.counters[client_id]
		
		self.logger.debug(f"Cleaned up {cleanup_count} rate limit counters, removed {len(empty_clients)} empty clients")
	
	# ==================== CONFIGURATION METHODS ====================
	
	def add_rule(self, rule: RateLimitRule):
		"""Add custom rate limiting rule"""
		self.rules.append(rule)
		self.logger.info(f"Added rate limiting rule: {rule.requests_per_minute}/min, {rule.requests_per_hour}/hour")
	
	def remove_rules_for_endpoint(self, endpoint: str):
		"""Remove all rules for specific endpoint"""
		self.rules = [
			rule for rule in self.rules
			if not rule.endpoints or endpoint not in rule.endpoints
		]
		self.logger.info(f"Removed rate limiting rules for endpoint: {endpoint}")
	
	def get_client_stats(self, client_id: str) -> Dict[str, Any]:
		"""Get rate limiting statistics for client"""
		if client_id not in self.counters:
			return {
				'client_id': client_id,
				'requests_last_minute': 0,
				'requests_last_hour': 0,
				'requests_last_day': 0
			}
		
		counter = self.counters[client_id]
		
		return {
			'client_id': client_id,
			'requests_last_minute': counter.count_requests(60),
			'requests_last_hour': counter.count_requests(3600),
			'requests_last_day': counter.count_requests(86400),
			'total_tracked_requests': len(counter.requests)
		}
	
	def get_global_stats(self) -> Dict[str, Any]:
		"""Get global rate limiting statistics"""
		total_clients = len(self.counters)
		total_requests = sum(len(counter.requests) for counter in self.counters.values())
		
		return {
			'total_clients': total_clients,
			'total_tracked_requests': total_requests,
			'active_rules': len(self.rules),
			'cleanup_task_running': self._cleanup_task and not self._cleanup_task.done()
		}
	
	async def reset_client_limits(self, client_id: str):
		"""Reset rate limits for specific client"""
		if client_id in self.counters:
			del self.counters[client_id]
			self.logger.info(f"Reset rate limits for client: {client_id}")
	
	async def close(self):
		"""Clean shutdown of rate limiting middleware"""
		if self._cleanup_task:
			self._cleanup_task.cancel()
			try:
				await self._cleanup_task
			except asyncio.CancelledError:
				pass
		
		self.logger.info("Rate limiting middleware closed")


# Factory function
def create_rate_limiting_middleware() -> RateLimitingMiddleware:
	"""Create RateLimitingMiddleware instance"""
	return RateLimitingMiddleware()
