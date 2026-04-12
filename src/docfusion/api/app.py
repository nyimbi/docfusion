"""
DocuFusion API Application Factory

Creates and configures the FastAPI application with all endpoints wired to services.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Dict, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .dependencies import (
	ServiceContainer,
	ServiceSettings,
	initialize_services,
	initialize_endpoints,
	shutdown_services,
	load_settings,
)
from .middleware.error_handler import register_error_handlers

logger = logging.getLogger(__name__)


# ============================================================================
# Application Factory
# ============================================================================

def get_cors_origins() -> list[str]:
	"""Get CORS allowed origins via centralized configuration."""
	from ..config.secrets import SecretsManager
	return SecretsManager.get_cors_allowed_origins()


# Alias for test compatibility
_get_allowed_origins = get_cors_origins


@asynccontextmanager
async def lifespan(app: FastAPI):
	"""
	Application lifespan manager for startup and shutdown.

	Initializes all services on startup and cleans up on shutdown.
	"""
	# Startup
	logger.info("Starting DocuFusion API...")
	settings = load_settings()

	try:
		# Initialize services
		container = await initialize_services(settings)

		# Initialize endpoints (after services are ready)
		await initialize_endpoints(container)

		# Store container in app state for request access
		app.state.container = container
		app.state.settings = settings

		# Register routers from endpoints
		_register_routers(app, container)

		logger.info("DocuFusion API started successfully")

	except Exception as e:
		logger.error(f"Failed to start DocuFusion API: {e}")
		raise

	yield

	# Shutdown
	logger.info("Shutting down DocuFusion API...")
	await shutdown_services()
	logger.info("DocuFusion API shutdown complete")


def create_app(settings: Optional[ServiceSettings] = None) -> FastAPI:
	"""
	Application factory for DocuFusion API.

	Args:
		settings: Optional custom settings (uses environment if not provided)

	Returns:
		Configured FastAPI application

	Usage:
		# Production
		app = create_app()

		# Testing with custom settings
		app = create_app(settings=ServiceSettings(jwt_secret="test-secret"))
	"""
	# Merge settings
	app_settings = settings or load_settings()

	# Create FastAPI app
	app = FastAPI(
		title="DocuFusion API",
		description="AI-powered document intelligence platform for RFP response automation",
		version="1.0.0",
		docs_url="/docs",
		redoc_url="/redoc",
		openapi_url="/openapi.json",
		lifespan=lifespan,
	)

	# Add CORS middleware
	app.add_middleware(
		CORSMiddleware,
		allow_origins=get_cors_origins(),
		allow_credentials=True,
		allow_methods=["*"],
		allow_headers=["*"],
	)

	# Register error handlers
	register_error_handlers(app)

	# Health check endpoint (no auth required)
	@app.get("/health", tags=["system"])
	async def health_check():
		"""Health check endpoint."""
		return {
			"status": "healthy",
			"version": "1.0.0",
			"services": {
				"searxng": "configured",
				"firecrawl": "configured",
				"litellm": "configured",
			}
		}

	# Root endpoint
	@app.get("/", tags=["system"])
	async def root():
		"""Root endpoint with API information."""
		return {
			"message": "DocuFusion API",
			"version": "1.0.0",
			"docs": "/docs",
			"health": "/health",
		}

	# API info endpoint
	@app.get("/api/v1/info", tags=["system"])
	async def api_info():
		"""API information endpoint."""
		return {
			"name": "DocuFusion",
			"version": "1.0.0",
			"description": "AI-powered document intelligence platform",
			"endpoints": {
				"documents": "/api/v1/documents",
				"templates": "/api/v1/templates",
				"search": "/api/v1/search",
				"collaboration": "/api/v1/collaboration",
			}
		}

	# Note: Additional routers will be registered after services are initialized
	# This is done in the lifespan function when the container is ready

	return app


def _register_routers(app: FastAPI, container: ServiceContainer) -> None:
	"""
	Register all API routers with the application.

	This is called after services are initialized.

	Args:
		app: FastAPI application
		container: Service container with initialized services
	"""
	# Document endpoints
	if container.document_endpoints:
		app.include_router(container.document_endpoints.router)
		logger.info("Document endpoints registered")

	# Template endpoints
	if container.template_endpoints:
		app.include_router(container.template_endpoints.router)
		logger.info("Template endpoints registered")

	# Search endpoints
	if container.search_endpoints:
		app.include_router(container.search_endpoints.router)
		logger.info("Search endpoints registered")

	# Batch endpoints
	if container.batch_endpoints:
		app.include_router(container.batch_endpoints.router)
		logger.info("Batch endpoints registered")

	# Collaboration endpoints
	if container.collaboration_endpoints:
		app.include_router(container.collaboration_endpoints.router)
		logger.info("Collaboration endpoints registered")

	# Webhook endpoints
	if container.webhook_endpoints:
		app.include_router(container.webhook_endpoints.router)
		logger.info("Webhook endpoints registered")

	# WebSocket endpoints (special handling)
	if container.websocket_endpoints:
		app.add_websocket_route("/ws", container.websocket_endpoints.websocket_endpoint)
		logger.info("WebSocket endpoint registered")


# ============================================================================
# Default Application Instance
# ============================================================================

# Create default instance for simple usage
app = create_app()


# ============================================================================
# Development Server
# ============================================================================

if __name__ == "__main__":
	import uvicorn

	# Configure logging
	logging.basicConfig(
		level=logging.INFO,
		format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
	)

	# Run development server
	uvicorn.run(
		"docfusion.api.app:app",
		host="0.0.0.0",
		port=8000,
		reload=True,
	)