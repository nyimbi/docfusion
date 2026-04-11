#!/usr/bin/env python3
"""
CORS Middleware

FastAPI middleware for Cross-Origin Resource Sharing (CORS) with configurable
origins, methods, headers, and security policies for frontend integration.
"""

import logging
from typing import Dict, List, Optional, Set, Union, Callable
from urllib.parse import urlparse

from fastapi import Request, Response
from fastapi.middleware.cors import CORSMiddleware as FastAPICORSMiddleware
from fastapi.responses import Response as FastAPIResponse


def _get_allowed_origins() -> list[str]:
	from ...config.secrets import SecretsManager
	return SecretsManager.get_cors_allowed_origins()


class CORSConfiguration:
	"""CORS configuration settings"""
	
	def __init__(
		self,
		allowed_origins: List[str] = None,
		allowed_origin_patterns: List[str] = None,
		allowed_methods: List[str] = None,
		allowed_headers: List[str] = None,
		exposed_headers: List[str] = None,
		allow_credentials: bool = True,
		max_age: int = 86400,
		allow_private_networks: bool = False
	):
		self.allowed_origins = set(allowed_origins or [])
		self.allowed_origin_patterns = allowed_origin_patterns or []
		self.allowed_methods = set(allowed_methods or [
			"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"
		])
		self.allowed_headers = set(allowed_headers or [
			"Accept",
			"Accept-Language",
			"Content-Type",
			"Content-Language",
			"Authorization",
			"X-API-Key",
			"X-Requested-With",
			"X-CSRF-Token",
			"Cache-Control",
			"Pragma"
		])
		self.exposed_headers = set(exposed_headers or [
			"Content-Length",
			"Content-Type",
			"X-RateLimit-Limit",
			"X-RateLimit-Remaining",
			"X-RateLimit-Reset"
		])
		self.allow_credentials = allow_credentials
		self.max_age = max_age
		self.allow_private_networks = allow_private_networks


class CORSMiddleware:
	"""Enhanced CORS middleware with security features"""
	
	def __init__(self, config: Optional[CORSConfiguration] = None):
		self.config = config or self._get_default_config()
		self.logger = logging.getLogger(__name__)
		
		# Compile origin patterns for faster matching
		self._compile_origin_patterns()
		
		self.logger.info("CORS middleware initialized")
	
	def _get_default_config(self) -> CORSConfiguration:
		"""Get default CORS configuration"""
		return CORSConfiguration(
			allowed_origins=_get_allowed_origins(),
			allowed_origin_patterns=[
				r"https://.*\.yourdomain\.com",  # Production subdomains
				r"https://.*\.vercel\.app",      # Vercel deployments
				r"https://.*\.netlify\.app"      # Netlify deployments
			]
		)
	
	def _compile_origin_patterns(self):
		"""Compile regex patterns for origin matching"""
		import re
		self.compiled_patterns = []
		
		for pattern in self.config.allowed_origin_patterns:
			try:
				compiled = re.compile(pattern)
				self.compiled_patterns.append(compiled)
			except re.error as e:
				self.logger.error(f"Invalid origin pattern '{pattern}': {e}")
	
	async def __call__(self, request: Request, call_next: Callable):
		"""Process CORS for incoming request"""
		origin = request.headers.get("origin")
		method = request.method
		
		# Handle preflight OPTIONS requests
		if method == "OPTIONS":
			return self._handle_preflight(request, origin)
		
		# Process actual request
		response = await call_next(request)
		
		# Add CORS headers to response
		self._add_cors_headers(response, origin, method)
		
		return response
	
	def _handle_preflight(self, request: Request, origin: Optional[str]) -> FastAPIResponse:
		"""Handle CORS preflight OPTIONS request"""
		response = FastAPIResponse(status_code=200)
		
		# Check if origin is allowed
		if not self._is_origin_allowed(origin):
			self.logger.warning(f"CORS preflight rejected for origin: {origin}")
			return FastAPIResponse(status_code=403)
		
		# Get requested method and headers
		requested_method = request.headers.get("access-control-request-method")
		requested_headers = request.headers.get("access-control-request-headers", "")
		
		# Validate requested method
		if requested_method and requested_method not in self.config.allowed_methods:
			self.logger.warning(f"CORS preflight rejected method: {requested_method}")
			return FastAPIResponse(status_code=403)
		
		# Validate requested headers
		if requested_headers:
			requested_header_list = [h.strip().lower() for h in requested_headers.split(",")]
			allowed_headers_lower = {h.lower() for h in self.config.allowed_headers}
			
			for header in requested_header_list:
				if header not in allowed_headers_lower:
					self.logger.warning(f"CORS preflight rejected header: {header}")
					return FastAPIResponse(status_code=403)
		
		# Add preflight headers
		response.headers["Access-Control-Allow-Origin"] = origin
		response.headers["Access-Control-Allow-Methods"] = ", ".join(self.config.allowed_methods)
		response.headers["Access-Control-Allow-Headers"] = ", ".join(self.config.allowed_headers)
		response.headers["Access-Control-Max-Age"] = str(self.config.max_age)
		
		if self.config.allow_credentials:
			response.headers["Access-Control-Allow-Credentials"] = "true"
		
		if self.config.allow_private_networks:
			response.headers["Access-Control-Allow-Private-Network"] = "true"
		
		self.logger.debug(f"CORS preflight approved for origin: {origin}")
		return response
	
	def _add_cors_headers(self, response: Response, origin: Optional[str], method: str):
		"""Add CORS headers to actual response"""
		if not self._is_origin_allowed(origin):
			return
		
		# Add basic CORS headers
		response.headers["Access-Control-Allow-Origin"] = origin
		
		if self.config.exposed_headers:
			response.headers["Access-Control-Expose-Headers"] = ", ".join(self.config.exposed_headers)
		
		if self.config.allow_credentials:
			response.headers["Access-Control-Allow-Credentials"] = "true"
		
		# Add method-specific headers
		if method in self.config.allowed_methods:
			response.headers["Access-Control-Allow-Methods"] = method
		
		# Add security headers
		response.headers["Vary"] = "Origin"
	
	def _is_origin_allowed(self, origin: Optional[str]) -> bool:
		"""Check if origin is allowed"""
		if not origin:
			return True  # Allow requests without origin (same-origin, mobile apps)
		
		# Check exact matches
		if origin in self.config.allowed_origins:
			return True
		
		# Check pattern matches
		for pattern in self.compiled_patterns:
			if pattern.match(origin):
				return True
		
		# Special case: allow localhost during development
		if self._is_development_origin(origin):
			return True
		
		return False
	
	def _is_development_origin(self, origin: str) -> bool:
		"""Check if origin is a development origin"""
		try:
			parsed = urlparse(origin)
			hostname = parsed.hostname
			
			# Allow localhost and 127.0.0.1
			if hostname in ['localhost', '127.0.0.1', '0.0.0.0']:
				return True
			
			# Allow private IP ranges during development
			if hostname and self._is_private_ip(hostname):
				return True
			
			return False
		except Exception as e:
			self.logger.warning(f"Failed to validate origin '{origin}': {e}")
			return False
	
	def _is_private_ip(self, ip: str) -> bool:
		"""Check if IP is in private range"""
		try:
			import ipaddress
			ip_obj = ipaddress.ip_address(ip)
			return ip_obj.is_private
		except Exception as e:
			self.logger.warning(f"Failed to check private IP for '{ip}': {e}")
			return False
	
	# ==================== CONFIGURATION METHODS ====================
	
	def add_allowed_origin(self, origin: str):
		"""Add allowed origin"""
		self.config.allowed_origins.add(origin)
		self.logger.info(f"Added allowed origin: {origin}")
	
	def remove_allowed_origin(self, origin: str):
		"""Remove allowed origin"""
		self.config.allowed_origins.discard(origin)
		self.logger.info(f"Removed allowed origin: {origin}")
	
	def add_allowed_origin_pattern(self, pattern: str):
		"""Add allowed origin pattern"""
		import re
		try:
			compiled = re.compile(pattern)
			self.config.allowed_origin_patterns.append(pattern)
			self.compiled_patterns.append(compiled)
			self.logger.info(f"Added allowed origin pattern: {pattern}")
		except re.error as e:
			self.logger.error(f"Invalid origin pattern '{pattern}': {e}")
	
	def add_allowed_method(self, method: str):
		"""Add allowed HTTP method"""
		self.config.allowed_methods.add(method.upper())
		self.logger.info(f"Added allowed method: {method}")
	
	def add_allowed_header(self, header: str):
		"""Add allowed header"""
		self.config.allowed_headers.add(header)
		self.logger.info(f"Added allowed header: {header}")
	
	def add_exposed_header(self, header: str):
		"""Add exposed header"""
		self.config.exposed_headers.add(header)
		self.logger.info(f"Added exposed header: {header}")
	
	def set_allow_credentials(self, allow: bool):
		"""Set whether to allow credentials"""
		self.config.allow_credentials = allow
		self.logger.info(f"Set allow credentials: {allow}")
	
	def set_max_age(self, max_age: int):
		"""Set preflight cache max age"""
		self.config.max_age = max_age
		self.logger.info(f"Set CORS max age: {max_age}")
	
	def get_configuration(self) -> Dict[str, any]:
		"""Get current CORS configuration"""
		return {
			'allowed_origins': list(self.config.allowed_origins),
			'allowed_origin_patterns': self.config.allowed_origin_patterns,
			'allowed_methods': list(self.config.allowed_methods),
			'allowed_headers': list(self.config.allowed_headers),
			'exposed_headers': list(self.config.exposed_headers),
			'allow_credentials': self.config.allow_credentials,
			'max_age': self.config.max_age,
			'allow_private_networks': self.config.allow_private_networks
		}


class ProductionCORSConfig(CORSConfiguration):
	"""Production-ready CORS configuration"""
	
	def __init__(self, production_domains: List[str]):
		super().__init__(
			allowed_origins=production_domains,
			allowed_origin_patterns=[],  # Be explicit in production
			allowed_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
			allowed_headers=[
				"Accept",
				"Content-Type",
				"Authorization",
				"X-API-Key",
				"X-Requested-With",
				"Cache-Control"
			],
			exposed_headers=[
				"Content-Length",
				"Content-Type",
				"X-RateLimit-Limit",
				"X-RateLimit-Remaining",
				"X-RateLimit-Reset"
			],
			allow_credentials=True,
			max_age=3600,  # 1 hour cache
			allow_private_networks=False
		)


class DevelopmentCORSConfig(CORSConfiguration):
	"""Development-friendly CORS configuration"""

	def __init__(self):
		super().__init__(
			allowed_origins=_get_allowed_origins(),
			allowed_origin_patterns=[
				r"http://localhost:\d+",
				r"http://127\.0\.0\.1:\d+",
				r"https://.*\.ngrok\.io",
				r"https://.*\.localhost\.run"
			],
			allowed_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
			allow_credentials=True,
			max_age=86400,  # 24 hours cache for development
			allow_private_networks=True
		)


# Factory functions
def create_cors_middleware(config: Optional[CORSConfiguration] = None) -> CORSMiddleware:
	"""Create CORSMiddleware instance"""
	return CORSMiddleware(config)


def create_development_cors_middleware() -> CORSMiddleware:
	"""Create CORS middleware with development configuration"""
	return CORSMiddleware(DevelopmentCORSConfig())


def create_production_cors_middleware(production_domains: List[str]) -> CORSMiddleware:
	"""Create CORS middleware with production configuration"""
	return CORSMiddleware(ProductionCORSConfig(production_domains))


def get_fastapi_cors_middleware(config: Optional[CORSConfiguration] = None) -> FastAPICORSMiddleware:
	"""Get FastAPI's built-in CORS middleware with our configuration"""
	config = config or CORSConfiguration()
	
	return FastAPICORSMiddleware(
		allow_origins=list(config.allowed_origins),
		allow_credentials=config.allow_credentials,
		allow_methods=list(config.allowed_methods),
		allow_headers=list(config.allowed_headers),
		expose_headers=list(config.exposed_headers),
		max_age=config.max_age
	)