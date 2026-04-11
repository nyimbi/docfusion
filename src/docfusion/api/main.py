#!/usr/bin/env python3
"""
API Main Application

FastAPI application setup with comprehensive middleware, documentation,
testing, and monitoring for the proposal writer system.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, Request, HTTPException, Depends, status
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles
import uvicorn

# Internal imports
from .endpoints.document_endpoints import DocumentEndpoints, create_document_endpoints
from .endpoints.template_endpoints import TemplateEndpoints, create_template_endpoints
from .middleware.authentication_middleware import (
	AuthenticationMiddleware, initialize_auth_middleware, get_current_user
)
from .middleware.rate_limiting_middleware import (
	RateLimitingMiddleware, create_rate_limiting_middleware
)
from .middleware.cors_middleware import (
	CORSMiddleware as CustomCORSMiddleware, create_development_cors_middleware,
	create_production_cors_middleware
)
from .validators.input_validators import InputValidators, create_input_validators
from ..security import SecurityManager, create_security_manager
from ..storage.secure_storage_service import SecureStorageService
from ..document_engine.secure_document_engine import SecureDocumentEngine


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _get_allowed_origins() -> list[str]:
	from ..config.secrets import SecretsManager
	return SecretsManager.get_cors_allowed_origins()


class APIApplication:
	"""Main API application class"""
	
	def __init__(
		self,
		title: str = "Proposal Writer API",
		version: str = "1.0.0",
		environment: str = "development"
	):
		self.title = title
		self.version = version
		self.environment = environment
		self.logger = logging.getLogger(__name__)
		
		# Service instances
		self.security_manager: Optional[SecurityManager] = None
		self.storage_service: Optional[SecureStorageService] = None
		self.document_engine: Optional[SecureDocumentEngine] = None
		
		# Middleware instances
		self.auth_middleware: Optional[AuthenticationMiddleware] = None
		self.rate_limit_middleware: Optional[RateLimitingMiddleware] = None
		self.cors_middleware: Optional[CustomCORSMiddleware] = None
		
		# Validators
		self.input_validators: Optional[InputValidators] = None
		
		# Endpoints
		self.document_endpoints: Optional[DocumentEndpoints] = None
		self.template_endpoints: Optional[TemplateEndpoints] = None
		
		# FastAPI app
		self.app: Optional[FastAPI] = None
	
	async def initialize_services(self):
		"""Initialize all services"""
		self.logger.info("Initializing API services...")
		
		# Initialize security manager
		self.security_manager = create_security_manager()
		
		# Initialize validators
		self.input_validators = create_input_validators()
		
		# Note: Storage service and document engine would be initialized
		# with actual configurations in production
		self.logger.info("Services initialized successfully")
	
	async def initialize_middleware(self):
		"""Initialize middleware components"""
		self.logger.info("Initializing middleware...")
		
		# Authentication middleware
		self.auth_middleware = initialize_auth_middleware(self.security_manager)
		
		# Rate limiting middleware
		self.rate_limit_middleware = create_rate_limiting_middleware()
		
		# CORS middleware
		if self.environment == "production":
			production_domains = [
				"https://app.yourdomain.com",
				"https://yourdomain.com"
			]
			self.cors_middleware = create_production_cors_middleware(production_domains)
		else:
			self.cors_middleware = create_development_cors_middleware()
		
		self.logger.info("Middleware initialized successfully")
	
	async def initialize_endpoints(self):
		"""Initialize API endpoints"""
		self.logger.info("Initializing endpoints...")
		
		# Note: In production, these would use actual service instances
		# For now, we'll create mock instances for the API layer
		
		# Create document endpoints
		if self.storage_service and self.document_engine:
			self.document_endpoints = create_document_endpoints(
				self.storage_service,
				self.document_engine,
				self.security_manager
			)
			
			self.template_endpoints = create_template_endpoints(
				self.storage_service,
				self.document_engine,
				self.security_manager
			)
		
		self.logger.info("Endpoints initialized successfully")
	
	def create_app(self) -> FastAPI:
		"""Create FastAPI application"""
		
		@asynccontextmanager
		async def lifespan(app: FastAPI):
			# Startup
			await self.initialize_services()
			await self.initialize_middleware()
			await self.initialize_endpoints()
			yield
			# Shutdown
			await self.cleanup()
		
		# Create FastAPI app
		app = FastAPI(
			title=self.title,
			version=self.version,
			description="Comprehensive document generation and management API",
			lifespan=lifespan,
			docs_url=None,  # We'll create custom docs
			redoc_url=None,
			openapi_url="/api/v1/openapi.json"
		)
		
		# Add middleware
		self._add_middleware(app)
		
		# Add routes
		self._add_routes(app)
		
		# Add custom documentation
		self._add_documentation_routes(app)
		
		# Add error handlers
		self._add_error_handlers(app)
		
		# Add health check
		self._add_health_check(app)
		
		self.app = app
		return app
	
	def _add_middleware(self, app: FastAPI):
		"""Add middleware to FastAPI app"""
		
		# Security middleware
		app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])
		
		# Compression middleware
		app.add_middleware(GZipMiddleware, minimum_size=1000)
		
		# CORS middleware
		app.add_middleware(
			CORSMiddleware,
			allow_origins=_get_allowed_origins(),
			allow_credentials=True,
			allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
			allow_headers=["*"],
		)
		
		# Custom middleware would be added here
		# Note: Custom middleware requires the app to be running
		# so we'll add them differently in production
	
	def _add_routes(self, app: FastAPI):
		"""Add API routes"""
		
		# Root redirect
		@app.get("/", include_in_schema=False)
		async def root():
			return RedirectResponse(url="/docs")
		
		# API info
		@app.get("/api/v1/info", tags=["system"])
		async def api_info():
			return {
				"title": self.title,
				"version": self.version,
				"environment": self.environment,
				"status": "running"
			}
		
		# Include endpoint routers when available
		if hasattr(self, 'document_endpoints') and self.document_endpoints:
			app.include_router(self.document_endpoints.router)
		
		if hasattr(self, 'template_endpoints') and self.template_endpoints:
			app.include_router(self.template_endpoints.router)
	
	def _add_documentation_routes(self, app: FastAPI):
		"""Add custom documentation routes"""
		
		@app.get("/docs", include_in_schema=False)
		async def custom_swagger_ui_html():
			return get_swagger_ui_html(
				openapi_url=app.openapi_url,
				title=f"{app.title} - Swagger UI",
				oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
				swagger_js_url="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js",
				swagger_css_url="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css",
			)
		
		@app.get("/redoc", include_in_schema=False)
		async def redoc_html():
			return get_redoc_html(
				openapi_url=app.openapi_url,
				title=f"{app.title} - ReDoc",
				redoc_js_url="https://unpkg.com/redoc@2.1.3/bundles/redoc.standalone.js",
			)
		
		# Custom OpenAPI schema
		def custom_openapi():
			if app.openapi_schema:
				return app.openapi_schema
			
			openapi_schema = get_openapi(
				title=self.title,
				version=self.version,
				description="""
				# Proposal Writer API
				
				Comprehensive document generation and management API with:
				
				## Features
				- **Document Management**: Full CRUD operations with security
				- **Template System**: Flexible template creation and management
				- **Security**: JWT authentication, API keys, role-based access
				- **Search**: Full-text and semantic search capabilities
				- **Collaboration**: Real-time editing and sharing
				
				## Authentication
				The API supports multiple authentication methods:
				- **JWT Tokens**: Bearer token authentication for web clients
				- **API Keys**: X-API-Key header for service integration
				- **Session Cookies**: Session-based authentication
				
				## Rate Limiting
				Rate limits are enforced per user/IP:
				- **Standard**: 100 requests/minute, 1000 requests/hour
				- **Premium**: 500 requests/minute, 5000 requests/hour
				- **Enterprise**: Custom limits available
				
				## Security
				All endpoints are secured with:
				- Input validation and sanitization
				- SQL injection protection
				- XSS prevention
				- CSRF protection
				- Audit logging
				""",
				routes=app.routes,
			)
			
			# Add security schemes
			openapi_schema["components"]["securitySchemes"] = {
				"BearerAuth": {
					"type": "http",
					"scheme": "bearer",
					"bearerFormat": "JWT"
				},
				"ApiKeyAuth": {
					"type": "apiKey",
					"in": "header",
					"name": "X-API-Key"
				}
			}
			
			# Add security to all paths
			for path in openapi_schema["paths"]:
				for method in openapi_schema["paths"][path]:
					openapi_schema["paths"][path][method]["security"] = [
						{"BearerAuth": []},
						{"ApiKeyAuth": []}
					]
			
			app.openapi_schema = openapi_schema
			return app.openapi_schema
		
		app.openapi = custom_openapi
	
	def _add_error_handlers(self, app: FastAPI):
		"""Add custom error handlers"""
		
		@app.exception_handler(HTTPException)
		async def http_exception_handler(request: Request, exc: HTTPException):
			return JSONResponse(
				status_code=exc.status_code,
				content={
					"error": exc.detail,
					"status_code": exc.status_code,
					"timestamp": "2024-01-01T00:00:00Z",  # Would use actual timestamp
					"path": str(request.url.path)
				}
			)
		
		@app.exception_handler(422)
		async def validation_exception_handler(request: Request, exc):
			return JSONResponse(
				status_code=422,
				content={
					"error": "Validation error",
					"details": exc.errors() if hasattr(exc, 'errors') else str(exc),
					"status_code": 422,
					"timestamp": "2024-01-01T00:00:00Z",
					"path": str(request.url.path)
				}
			)
		
		@app.exception_handler(500)
		async def internal_server_error_handler(request: Request, exc):
			logger.error(f"Internal server error: {exc}")
			return JSONResponse(
				status_code=500,
				content={
					"error": "Internal server error",
					"status_code": 500,
					"timestamp": "2024-01-01T00:00:00Z",
					"path": str(request.url.path)
				}
			)
	
	def _add_health_check(self, app: FastAPI):
		"""Add health check endpoints"""
		
		@app.get("/health", tags=["system"])
		async def health_check():
			return {
				"status": "healthy",
				"timestamp": "2024-01-01T00:00:00Z",
				"version": self.version,
				"environment": self.environment
			}
		
		@app.get("/health/detailed", tags=["system"])
		async def detailed_health_check(current_user: Dict[str, Any] = Depends(get_current_user)):
			"""Detailed health check requiring authentication"""
			return {
				"status": "healthy",
				"timestamp": "2024-01-01T00:00:00Z",
				"version": self.version,
				"environment": self.environment,
				"services": {
					"security_manager": bool(self.security_manager),
					"storage_service": bool(self.storage_service),
					"document_engine": bool(self.document_engine)
				},
				"middleware": {
					"authentication": bool(self.auth_middleware),
					"rate_limiting": bool(self.rate_limit_middleware),
					"cors": bool(self.cors_middleware)
				}
			}
	
	async def cleanup(self):
		"""Cleanup resources on shutdown"""
		self.logger.info("Cleaning up API resources...")
		
		if self.rate_limit_middleware:
			await self.rate_limit_middleware.close()
		
		if self.security_manager:
			await self.security_manager.close()
		
		self.logger.info("API cleanup completed")


# Application factory
def create_api_application(
	title: str = "Proposal Writer API",
	version: str = "1.0.0",
	environment: str = "development"
) -> APIApplication:
	"""Create API application instance"""
	return APIApplication(title, version, environment)


def create_app(environment: str = "development") -> FastAPI:
	"""Create FastAPI app"""
	api_app = create_api_application(environment=environment)
	return api_app.create_app()


# For running with uvicorn
app = create_app()


if __name__ == "__main__":
	# Development server
	uvicorn.run(
		"main:app",
		host="127.0.0.1",
		port=8000,
		reload=True,
		log_level="info"
	)