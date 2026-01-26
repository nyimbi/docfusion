#!/usr/bin/env python3
"""
Rate Limiting Analytics

Advanced rate limiting system with analytics, monitoring, and intelligent
adaptive throttling based on usage patterns and system performance.
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional, Any, Tuple, Callable
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict, deque
import hashlib

try:
	from uuid_extensions import uuid7str
except ImportError:
	from uuid import uuid4
	def uuid7str() -> str:
		return str(uuid4())

from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


class RateLimitScope(str, Enum):
	"""Rate limit scopes"""
	USER = "user"
	IP = "ip"
	API_KEY = "api_key"
	ENDPOINT = "endpoint"
	GLOBAL = "global"


class LimitationType(str, Enum):
	"""Rate limitation types"""
	REQUESTS_PER_MINUTE = "requests_per_minute"
	REQUESTS_PER_HOUR = "requests_per_hour"
	REQUESTS_PER_DAY = "requests_per_day"
	CONCURRENT_REQUESTS = "concurrent_requests"
	BANDWIDTH_PER_MINUTE = "bandwidth_per_minute"


class ThrottleAction(str, Enum):
	"""Actions to take when rate limit is exceeded"""
	BLOCK = "block"
	DELAY = "delay"
	PRIORITY_QUEUE = "priority_queue"
	ADAPTIVE_BACKOFF = "adaptive_backoff"


@dataclass
class RateLimitRule:
	"""Rate limiting rule definition"""
	rule_id: str = field(default_factory=uuid7str)
	scope: RateLimitScope = RateLimitScope.USER
	limitation_type: LimitationType = LimitationType.REQUESTS_PER_MINUTE
	limit: int = 100
	window_seconds: int = 60
	burst_limit: Optional[int] = None
	throttle_action: ThrottleAction = ThrottleAction.BLOCK
	endpoint_pattern: Optional[str] = None
	user_tier: Optional[str] = None
	priority: int = 100
	enabled: bool = True
	created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class RateLimitState:
	"""Current state of rate limiting for a scope"""
	scope_key: str
	rule_id: str
	current_count: int = 0
	window_start: datetime = field(default_factory=datetime.utcnow)
	last_request: datetime = field(default_factory=datetime.utcnow)
	total_blocked: int = 0
	total_delayed: int = 0
	burst_tokens: int = 0


@dataclass
class RateLimitEvent:
	"""Rate limit event for analytics"""
	event_id: str = field(default_factory=uuid7str)
	timestamp: datetime = field(default_factory=datetime.utcnow)
	scope_key: str = ""
	scope_type: RateLimitScope = RateLimitScope.USER
	endpoint: str = ""
	method: str = ""
	rule_id: str = ""
	action_taken: ThrottleAction = ThrottleAction.BLOCK
	limit: int = 0
	current_count: int = 0
	was_blocked: bool = False
	delay_ms: float = 0.0
	user_id: Optional[str] = None
	ip_address: Optional[str] = None
	metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RateLimitAnalytics:
	"""Analytics summary for rate limiting"""
	period_start: datetime
	period_end: datetime
	total_requests: int = 0
	total_blocked: int = 0
	total_delayed: int = 0
	block_rate: float = 0.0
	top_blocked_ips: List[Dict[str, Any]] = field(default_factory=list)
	top_blocked_users: List[Dict[str, Any]] = field(default_factory=list)
	top_blocked_endpoints: List[Dict[str, Any]] = field(default_factory=list)
	rule_effectiveness: Dict[str, Dict[str, Any]] = field(default_factory=dict)
	hourly_distribution: Dict[int, Dict[str, int]] = field(default_factory=dict)


class RateLimitStore:
	"""In-memory store for rate limit states"""
	
	def __init__(self, cleanup_interval: int = 300):
		self.states: Dict[str, RateLimitState] = {}
		self.cleanup_interval = cleanup_interval
		self.logger = logging.getLogger(__name__)
		
		# Start cleanup task
		asyncio.create_task(self._cleanup_expired_states())
	
	async def get_state(self, scope_key: str, rule_id: str) -> RateLimitState:
		"""Get or create rate limit state"""
		key = f"{scope_key}:{rule_id}"
		
		if key not in self.states:
			self.states[key] = RateLimitState(
				scope_key=scope_key,
				rule_id=rule_id
			)
		
		return self.states[key]
	
	async def update_state(self, state: RateLimitState):
		"""Update rate limit state"""
		key = f"{state.scope_key}:{state.rule_id}"
		self.states[key] = state
	
	async def _cleanup_expired_states(self):
		"""Clean up expired rate limit states"""
		while True:
			try:
				current_time = datetime.utcnow()
				expired_keys = []
				
				for key, state in self.states.items():
					# Remove states that haven't been accessed in the last hour
					if current_time - state.last_request > timedelta(hours=1):
						expired_keys.append(key)
				
				for key in expired_keys:
					del self.states[key]
				
				if expired_keys:
					self.logger.debug(f"Cleaned up {len(expired_keys)} expired rate limit states")
				
				await asyncio.sleep(self.cleanup_interval)
				
			except Exception as e:
				self.logger.error(f"Rate limit cleanup failed: {e}")
				await asyncio.sleep(self.cleanup_interval)


class RateLimitEngine:
	"""Core rate limiting engine"""
	
	def __init__(self, store: RateLimitStore):
		self.store = store
		self.rules: Dict[str, RateLimitRule] = {}
		self.events: deque = deque(maxlen=10000)
		self.logger = logging.getLogger(__name__)
		
		# Setup default rules
		self._setup_default_rules()
	
	def _setup_default_rules(self):
		"""Setup default rate limiting rules"""
		default_rules = [
			RateLimitRule(
				rule_id="global_requests_per_minute",
				scope=RateLimitScope.GLOBAL,
				limitation_type=LimitationType.REQUESTS_PER_MINUTE,
				limit=10000,
				window_seconds=60,
				priority=10
			),
			RateLimitRule(
				rule_id="user_requests_per_minute",
				scope=RateLimitScope.USER,
				limitation_type=LimitationType.REQUESTS_PER_MINUTE,
				limit=100,
				window_seconds=60,
				burst_limit=120,
				priority=50
			),
			RateLimitRule(
				rule_id="ip_requests_per_minute",
				scope=RateLimitScope.IP,
				limitation_type=LimitationType.REQUESTS_PER_MINUTE,
				limit=200,
				window_seconds=60,
				burst_limit=250,
				priority=40
			),
			RateLimitRule(
				rule_id="user_requests_per_hour",
				scope=RateLimitScope.USER,
				limitation_type=LimitationType.REQUESTS_PER_HOUR,
				limit=1000,
				window_seconds=3600,
				priority=60
			),
			RateLimitRule(
				rule_id="premium_user_requests",
				scope=RateLimitScope.USER,
				limitation_type=LimitationType.REQUESTS_PER_MINUTE,
				limit=500,
				window_seconds=60,
				user_tier="premium",
				priority=30
			),
			RateLimitRule(
				rule_id="search_endpoint_limit",
				scope=RateLimitScope.USER,
				limitation_type=LimitationType.REQUESTS_PER_MINUTE,
				limit=20,
				window_seconds=60,
				endpoint_pattern="/api/v1/search",
				priority=70
			)
		]
		
		for rule in default_rules:
			self.rules[rule.rule_id] = rule
	
	def add_rule(self, rule: RateLimitRule):
		"""Add a rate limiting rule"""
		self.rules[rule.rule_id] = rule
		self.logger.info(f"Added rate limit rule: {rule.rule_id}")
	
	def remove_rule(self, rule_id: str):
		"""Remove a rate limiting rule"""
		if rule_id in self.rules:
			del self.rules[rule_id]
			self.logger.info(f"Removed rate limit rule: {rule_id}")
	
	def get_applicable_rules(self, request: Request, user_id: str = None,
	                        user_tier: str = None) -> List[RateLimitRule]:
		"""Get rules applicable to the current request"""
		applicable_rules = []
		endpoint = str(request.url.path)
		
		for rule in self.rules.values():
			if not rule.enabled:
				continue
			
			# Check endpoint pattern
			if rule.endpoint_pattern and rule.endpoint_pattern not in endpoint:
				continue
			
			# Check user tier
			if rule.user_tier and rule.user_tier != user_tier:
				continue
			
			applicable_rules.append(rule)
		
		# Sort by priority (lower number = higher priority)
		return sorted(applicable_rules, key=lambda r: r.priority)
	
	def _get_scope_key(self, rule: RateLimitRule, request: Request,
	                   user_id: str = None) -> str:
		"""Generate scope key for rate limiting"""
		if rule.scope == RateLimitScope.USER and user_id:
			return f"user:{user_id}"
		elif rule.scope == RateLimitScope.IP:
			ip = request.client.host if request.client else "unknown"
			return f"ip:{ip}"
		elif rule.scope == RateLimitScope.API_KEY:
			api_key = request.headers.get("X-API-Key", "unknown")
			return f"api_key:{hashlib.md5(api_key.encode()).hexdigest()[:8]}"
		elif rule.scope == RateLimitScope.ENDPOINT:
			return f"endpoint:{request.url.path}"
		else:  # GLOBAL
			return "global"
	
	async def check_rate_limit(self, request: Request, user_id: str = None,
	                          user_tier: str = None) -> Tuple[bool, Optional[RateLimitEvent]]:
		"""Check if request should be rate limited"""
		try:
			applicable_rules = self.get_applicable_rules(request, user_id, user_tier)
			
			for rule in applicable_rules:
				scope_key = self._get_scope_key(rule, request, user_id)
				state = await self.store.get_state(scope_key, rule.rule_id)
				
				current_time = datetime.utcnow()
				
				# Check if we need to reset the window
				window_elapsed = (current_time - state.window_start).total_seconds()
				if window_elapsed >= rule.window_seconds:
					state.current_count = 0
					state.window_start = current_time
					state.burst_tokens = rule.burst_limit or rule.limit
				
				# Check rate limit
				is_exceeded = False
				if rule.burst_limit and state.burst_tokens > 0:
					# Allow burst
					state.burst_tokens -= 1
				elif state.current_count >= rule.limit:
					is_exceeded = True
				
				# Create event
				event = RateLimitEvent(
					scope_key=scope_key,
					scope_type=rule.scope,
					endpoint=str(request.url.path),
					method=request.method,
					rule_id=rule.rule_id,
					limit=rule.limit,
					current_count=state.current_count,
					user_id=user_id,
					ip_address=request.client.host if request.client else None
				)
				
				if is_exceeded:
					# Handle rate limit exceeded
					if rule.throttle_action == ThrottleAction.BLOCK:
						event.action_taken = ThrottleAction.BLOCK
						event.was_blocked = True
						state.total_blocked += 1
					elif rule.throttle_action == ThrottleAction.DELAY:
						# Calculate delay based on how much over the limit we are
						overage = state.current_count - rule.limit
						delay_ms = min(overage * 100, 2000)  # Max 2 second delay
						event.action_taken = ThrottleAction.DELAY
						event.delay_ms = delay_ms
						state.total_delayed += 1
					
					state.last_request = current_time
					await self.store.update_state(state)
					self.events.append(event)
					
					return is_exceeded, event
				else:
					# Allow request
					state.current_count += 1
					state.last_request = current_time
					await self.store.update_state(state)
					
					event.was_blocked = False
					self.events.append(event)
					
					return False, event
			
			# No applicable rules, allow request
			return False, None
			
		except Exception as e:
			self.logger.error(f"Rate limit check failed: {e}")
			return False, None
	
	async def get_rate_limit_status(self, request: Request, user_id: str = None,
	                               user_tier: str = None) -> Dict[str, Any]:
		"""Get current rate limit status for request"""
		try:
			status = {}
			applicable_rules = self.get_applicable_rules(request, user_id, user_tier)
			
			for rule in applicable_rules:
				scope_key = self._get_scope_key(rule, request, user_id)
				state = await self.store.get_state(scope_key, rule.rule_id)
				
				current_time = datetime.utcnow()
				window_elapsed = (current_time - state.window_start).total_seconds()
				remaining_window = max(0, rule.window_seconds - window_elapsed)
				remaining_requests = max(0, rule.limit - state.current_count)
				
				status[rule.rule_id] = {
					'scope': rule.scope.value,
					'limit': rule.limit,
					'current_count': state.current_count,
					'remaining_requests': remaining_requests,
					'window_seconds': rule.window_seconds,
					'remaining_window_seconds': int(remaining_window),
					'reset_time': (state.window_start + timedelta(seconds=rule.window_seconds)).isoformat()
				}
			
			return status
			
		except Exception as e:
			self.logger.error(f"Failed to get rate limit status: {e}")
			return {}


class RateLimitAnalyzer:
	"""Analyzes rate limiting patterns and effectiveness"""
	
	def __init__(self, engine: RateLimitEngine):
		self.engine = engine
		self.logger = logging.getLogger(__name__)
	
	async def generate_analytics(self, hours: int = 24) -> RateLimitAnalytics:
		"""Generate rate limiting analytics"""
		try:
			end_time = datetime.utcnow()
			start_time = end_time - timedelta(hours=hours)
			
			# Filter events in time period
			recent_events = [
				e for e in self.engine.events 
				if start_time <= e.timestamp <= end_time
			]
			
			if not recent_events:
				return RateLimitAnalytics(
					period_start=start_time,
					period_end=end_time
				)
			
			total_requests = len(recent_events)
			total_blocked = len([e for e in recent_events if e.was_blocked])
			total_delayed = len([e for e in recent_events if e.delay_ms > 0])
			block_rate = total_blocked / total_requests if total_requests > 0 else 0.0
			
			# Top blocked IPs
			ip_blocks = defaultdict(int)
			for event in recent_events:
				if event.was_blocked and event.ip_address:
					ip_blocks[event.ip_address] += 1
			
			top_blocked_ips = [
				{'ip_address': ip, 'blocked_count': count}
				for ip, count in sorted(ip_blocks.items(), key=lambda x: x[1], reverse=True)[:10]
			]
			
			# Top blocked users
			user_blocks = defaultdict(int)
			for event in recent_events:
				if event.was_blocked and event.user_id:
					user_blocks[event.user_id] += 1
			
			top_blocked_users = [
				{'user_id': user_id, 'blocked_count': count}
				for user_id, count in sorted(user_blocks.items(), key=lambda x: x[1], reverse=True)[:10]
			]
			
			# Top blocked endpoints
			endpoint_blocks = defaultdict(int)
			for event in recent_events:
				if event.was_blocked:
					key = f"{event.method} {event.endpoint}"
					endpoint_blocks[key] += 1
			
			top_blocked_endpoints = [
				{'endpoint': endpoint, 'blocked_count': count}
				for endpoint, count in sorted(endpoint_blocks.items(), key=lambda x: x[1], reverse=True)[:10]
			]
			
			# Rule effectiveness
			rule_stats = defaultdict(lambda: {'total': 0, 'blocked': 0, 'delayed': 0})
			for event in recent_events:
				rule_stats[event.rule_id]['total'] += 1
				if event.was_blocked:
					rule_stats[event.rule_id]['blocked'] += 1
				if event.delay_ms > 0:
					rule_stats[event.rule_id]['delayed'] += 1
			
			rule_effectiveness = {}
			for rule_id, stats in rule_stats.items():
				effectiveness = (stats['blocked'] + stats['delayed']) / stats['total'] if stats['total'] > 0 else 0.0
				rule_effectiveness[rule_id] = {
					'total_requests': stats['total'],
					'blocked_count': stats['blocked'],
					'delayed_count': stats['delayed'],
					'effectiveness_rate': effectiveness
				}
			
			# Hourly distribution
			hourly_dist = defaultdict(lambda: {'total': 0, 'blocked': 0})
			for event in recent_events:
				hour = event.timestamp.hour
				hourly_dist[hour]['total'] += 1
				if event.was_blocked:
					hourly_dist[hour]['blocked'] += 1
			
			return RateLimitAnalytics(
				period_start=start_time,
				period_end=end_time,
				total_requests=total_requests,
				total_blocked=total_blocked,
				total_delayed=total_delayed,
				block_rate=block_rate,
				top_blocked_ips=top_blocked_ips,
				top_blocked_users=top_blocked_users,
				top_blocked_endpoints=top_blocked_endpoints,
				rule_effectiveness=rule_effectiveness,
				hourly_distribution=dict(hourly_dist)
			)
			
		except Exception as e:
			self.logger.error(f"Failed to generate rate limit analytics: {e}")
			return RateLimitAnalytics(
				period_start=datetime.utcnow() - timedelta(hours=hours),
				period_end=datetime.utcnow()
			)
	
	async def suggest_rule_optimizations(self) -> List[Dict[str, Any]]:
		"""Suggest optimizations for rate limiting rules"""
		try:
			suggestions = []
			analytics = await self.generate_analytics(hours=24)
			
			# Check for ineffective rules
			for rule_id, stats in analytics.rule_effectiveness.items():
				if stats['effectiveness_rate'] < 0.01 and stats['total_requests'] > 100:
					suggestions.append({
						'type': 'ineffective_rule',
						'rule_id': rule_id,
						'message': f"Rule {rule_id} has low effectiveness ({stats['effectiveness_rate']:.1%})",
						'recommendation': "Consider increasing limits or removing this rule"
					})
			
			# Check for high block rates
			if analytics.block_rate > 0.1:  # More than 10% blocked
				suggestions.append({
					'type': 'high_block_rate',
					'message': f"High block rate detected: {analytics.block_rate:.1%}",
					'recommendation': "Consider reviewing rate limits or implementing adaptive limits"
				})
			
			# Check for repetitive IP blocks
			for ip_data in analytics.top_blocked_ips[:3]:
				if ip_data['blocked_count'] > 100:
					suggestions.append({
						'type': 'suspicious_ip',
						'ip_address': ip_data['ip_address'],
						'blocked_count': ip_data['blocked_count'],
						'message': f"IP {ip_data['ip_address']} blocked {ip_data['blocked_count']} times",
						'recommendation': "Consider implementing IP-based blocking or CAPTCHA"
					})
			
			return suggestions
			
		except Exception as e:
			self.logger.error(f"Failed to generate rule optimization suggestions: {e}")
			return []


class RateLimitMiddleware:
	"""FastAPI middleware for rate limiting"""
	
	def __init__(self, engine: RateLimitEngine):
		self.engine = engine
		self.logger = logging.getLogger(__name__)
	
	async def __call__(self, request: Request, call_next):
		"""Process request through rate limiting"""
		try:
			# Extract user info (this would integrate with your auth system)
			user_id = getattr(request.state, 'user_id', None)
			user_tier = getattr(request.state, 'user_tier', 'standard')
			
			# Check rate limits
			is_limited, event = await self.engine.check_rate_limit(request, user_id, user_tier)
			
			if is_limited and event:
				if event.action_taken == ThrottleAction.BLOCK:
					return JSONResponse(
						status_code=429,
						content={
							'error': 'Rate limit exceeded',
							'message': f'Rate limit exceeded for {event.scope_type.value}',
							'rule_id': event.rule_id,
							'limit': event.limit,
							'current_count': event.current_count,
							'retry_after_seconds': 60
						},
						headers={
							'X-RateLimit-Limit': str(event.limit),
							'X-RateLimit-Remaining': str(max(0, event.limit - event.current_count)),
							'X-RateLimit-Reset': str(int(time.time()) + 60),
							'Retry-After': '60'
						}
					)
				elif event.action_taken == ThrottleAction.DELAY:
					# Implement delay
					await asyncio.sleep(event.delay_ms / 1000)
			
			# Process request
			response = await call_next(request)
			
			# Add rate limit headers
			if event:
				response.headers['X-RateLimit-Limit'] = str(event.limit)
				response.headers['X-RateLimit-Remaining'] = str(max(0, event.limit - event.current_count))
				response.headers['X-RateLimit-Reset'] = str(int(time.time()) + 60)
			
			return response
			
		except Exception as e:
			self.logger.error(f"Rate limit middleware failed: {e}")
			# Continue with request on error
			return await call_next(request)


class RateLimitAPI:
	"""API endpoints for rate limiting analytics"""
	
	def __init__(self, analyzer: RateLimitAnalyzer):
		self.analyzer = analyzer
		self.engine = analyzer.engine
		self.logger = logging.getLogger(__name__)
		
		# Create FastAPI router
		self.router = APIRouter(prefix="/rate-limiting", tags=["rate-limiting"])
		self._register_endpoints()
		
		self.logger.info("Rate limiting API initialized")
	
	def _register_endpoints(self):
		"""Register rate limiting API endpoints"""
		
		@self.router.get("/analytics")
		async def get_rate_limit_analytics(
			hours: int = Query(24, description="Hours to analyze")
		):
			"""Get rate limiting analytics"""
			try:
				analytics = await self.analyzer.generate_analytics(hours)
				return {
					'period_start': analytics.period_start.isoformat(),
					'period_end': analytics.period_end.isoformat(),
					'total_requests': analytics.total_requests,
					'total_blocked': analytics.total_blocked,
					'total_delayed': analytics.total_delayed,
					'block_rate': analytics.block_rate,
					'top_blocked_ips': analytics.top_blocked_ips,
					'top_blocked_users': analytics.top_blocked_users,
					'top_blocked_endpoints': analytics.top_blocked_endpoints,
					'rule_effectiveness': analytics.rule_effectiveness,
					'hourly_distribution': analytics.hourly_distribution
				}
			except Exception as e:
				self.logger.error(f"Rate limit analytics endpoint failed: {e}")
				raise HTTPException(status_code=500, detail=str(e))
		
		@self.router.get("/rules")
		async def get_rate_limit_rules():
			"""Get all rate limiting rules"""
			try:
				rules = []
				for rule in self.engine.rules.values():
					rules.append({
						'rule_id': rule.rule_id,
						'scope': rule.scope.value,
						'limitation_type': rule.limitation_type.value,
						'limit': rule.limit,
						'window_seconds': rule.window_seconds,
						'burst_limit': rule.burst_limit,
						'throttle_action': rule.throttle_action.value,
						'endpoint_pattern': rule.endpoint_pattern,
						'user_tier': rule.user_tier,
						'priority': rule.priority,
						'enabled': rule.enabled,
						'created_at': rule.created_at.isoformat()
					})
				return {'rules': rules}
			except Exception as e:
				self.logger.error(f"Get rules endpoint failed: {e}")
				raise HTTPException(status_code=500, detail=str(e))
		
		@self.router.get("/status")
		async def get_rate_limit_status(request: Request):
			"""Get rate limit status for current request context"""
			try:
				user_id = getattr(request.state, 'user_id', None)
				user_tier = getattr(request.state, 'user_tier', 'standard')
				
				status = await self.engine.get_rate_limit_status(request, user_id, user_tier)
				return status
			except Exception as e:
				self.logger.error(f"Rate limit status endpoint failed: {e}")
				raise HTTPException(status_code=500, detail=str(e))
		
		@self.router.get("/suggestions")
		async def get_optimization_suggestions():
			"""Get rate limiting optimization suggestions"""
			try:
				suggestions = await self.analyzer.suggest_rule_optimizations()
				return {'suggestions': suggestions}
			except Exception as e:
				self.logger.error(f"Optimization suggestions endpoint failed: {e}")
				raise HTTPException(status_code=500, detail=str(e))


# Factory functions
def create_rate_limit_store() -> RateLimitStore:
	"""Create rate limit store instance"""
	return RateLimitStore()


def create_rate_limit_engine(store: RateLimitStore) -> RateLimitEngine:
	"""Create rate limit engine instance"""
	return RateLimitEngine(store)


def create_rate_limit_analyzer(engine: RateLimitEngine) -> RateLimitAnalyzer:
	"""Create rate limit analyzer instance"""
	return RateLimitAnalyzer(engine)


def create_rate_limit_api(analyzer: RateLimitAnalyzer) -> RateLimitAPI:
	"""Create rate limiting API instance"""
	return RateLimitAPI(analyzer)