"""
DocuFusion API Application Factory

Creates and configures the FastAPI application with all endpoints wired to services.
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
from contextlib import asynccontextmanager
from typing import Optional
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
import structlog

from .dependencies import (
	ServiceContainer,
	ServiceSettings,
	initialize_services,
	initialize_endpoints,
	shutdown_services,
	load_settings,
)
from .middleware.error_handler import register_error_handlers
from ..config.secrets import SecretsManager
from ..logging_config import setup_logging

logger = logging.getLogger(__name__)

APP_VERSION = os.getenv("APP_VERSION", "1.0.0")
DEFAULT_RATE_LIMIT = os.getenv("DOCFUSION_DEFAULT_RATE_LIMIT", "60/minute")
HEALTH_PATHS = {"/health", "/api/health"}
GRACEFUL_SHUTDOWN_TIMEOUT_SECONDS = float(
	os.getenv("GRACEFUL_SHUTDOWN_TIMEOUT_SECONDS", "30"),
)

CRITICAL_HEALTH_SERVICES = {
	"database_connection",
	"security_manager",
	"storage_service",
	"document_engine",
}

HEALTH_SERVICE_ATTRS = {
	"database_connection": "database_connection",
	"database_session": "database_session",
	"security_manager": "security_manager",
	"storage_service": "storage_service",
	"document_engine": "document_engine",
	"searxng": "searxng_client",
	"firecrawl": "firecrawl_client",
	"litellm": "litellm_client",
}

HEALTH_ENDPOINT_ATTRS = {
	"documents": "document_endpoints",
	"templates": "template_endpoints",
	"search": "search_endpoints",
	"batch": "batch_endpoints",
	"collaboration": "collaboration_endpoints",
	"webhooks": "webhook_endpoints",
	"websocket": "websocket_endpoints",
}


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
	settings = getattr(app.state, "settings", None) or load_settings()
	validate_startup_environment(settings)
	app.state.draining = False
	app.state.in_flight_requests = 0

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

	try:
		yield
	finally:
		# Shutdown
		logger.info("Shutting down DocuFusion API...")
		app.state.draining = True
		await _drain_in_flight_requests(app)
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
	setup_logging()

	# Merge settings
	app_settings = settings or load_settings()
	_init_sentry()

	# Create FastAPI app
	app = FastAPI(
		title="DocuFusion API",
		description="AI-powered document intelligence platform for RFP response automation",
		version=APP_VERSION,
		docs_url="/docs",
		redoc_url="/redoc",
		openapi_url="/openapi.json",
		lifespan=lifespan,
	)
	app.state.draining = False
	app.state.in_flight_requests = 0
	app.state.settings = app_settings

	limiter = _configure_rate_limiting(app)
	_configure_request_context_middleware(app)

	# Add CORS middleware
	app.add_middleware(
		CORSMiddleware,
		allow_origins=app_settings.cors_allowed_origins,
		allow_credentials=True,
		allow_methods=["*"],
		allow_headers=["*"],
	)

	# Register error handlers
	register_error_handlers(app)

	# Prometheus /metrics endpoint (no auth required)
	try:
		from prometheus_fastapi_instrumentator import Instrumentator

		Instrumentator(
			should_group_status_codes=True,
			should_ignore_untemplated=True,
			excluded_handlers=["/health", "/api/health", "/metrics"],
		).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
	except Exception:
		# Prometheus is optional; don't block startup if the instrumentation fails.
		pass

	# Health check endpoint (no auth required)
	@app.get("/health", tags=["system"])
	@limiter.exempt
	async def health_check(request: Request):
		"""Health check endpoint."""
		payload, status_code = _build_health_payload(request.app)
		return JSONResponse(content=payload, status_code=status_code)

	@app.get("/api/health", tags=["system"], include_in_schema=False)
	@limiter.exempt
	async def api_health_check(request: Request):
		"""API-prefixed health check endpoint."""
		payload, status_code = _build_health_payload(request.app)
		return JSONResponse(content=payload, status_code=status_code)

	# Root endpoint
	@app.get("/", tags=["system"])
	async def root():
		"""Root endpoint with API information."""
		return {
			"message": "DocuFusion API",
			"version": APP_VERSION,
			"docs": "/docs",
			"health": "/health",
		}

	# API info endpoint
	@app.get("/api/v1/info", tags=["system"])
	async def api_info():
		"""API information endpoint."""
		return {
			"name": "DocuFusion",
			"version": APP_VERSION,
			"description": "AI-powered document intelligence platform",
			"endpoints": {
				"documents": "/api/v1/documents",
				"templates": "/api/v1/templates",
				"search": "/api/v1/search",
				"collaboration": "/api/v1/collaboration",
			},
		}

	# Note: Additional routers will be registered after services are initialized
	# This is done in the lifespan function when the container is ready

	return app


def validate_startup_environment(settings: ServiceSettings) -> None:
	"""Fail fast when production/staging required configuration is missing."""
	if not SecretsManager.is_strict_mode():
		return

	missing: list[str] = []
	if not settings.database_url:
		missing.append("DATABASE_URL")
	if not settings.jwt_secret:
		missing.append("JWT_SECRET")

	if missing:
		raise RuntimeError(
			"Missing required startup environment variables: "
			+ ", ".join(sorted(missing))
		)


def _init_sentry() -> None:
	"""Initialize Sentry when SENTRY_DSN is configured."""
	dsn = os.getenv("SENTRY_DSN")
	if not dsn:
		return

	import sentry_sdk

	sentry_sdk.init(
		dsn=dsn,
		environment=os.getenv("ENVIRONMENT", "development"),
		release=APP_VERSION,
		traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.0")),
	)
	logger.info(
		"Sentry error tracking initialized",
		extra={"environment": os.getenv("ENVIRONMENT", "development")},
	)


def _configure_rate_limiting(app: FastAPI) -> Limiter:
	"""Apply a default unauthenticated public API rate limit."""
	limiter = Limiter(
		key_func=get_remote_address,
		default_limits=[DEFAULT_RATE_LIMIT],
		headers_enabled=True,
	)
	app.state.limiter = limiter
	app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
	app.add_middleware(SlowAPIMiddleware)
	return limiter


def _configure_request_context_middleware(app: FastAPI) -> None:
	"""Bind request IDs and track in-flight requests for shutdown drain."""

	@app.middleware("http")
	async def request_context_middleware(request: Request, call_next):
		request_id = request.headers.get("X-Request-ID") or str(uuid4())
		request.state.request_id = request_id

		if (
			getattr(request.app.state, "draining", False)
			and request.url.path not in HEALTH_PATHS
		):
			return JSONResponse(
				status_code=503,
				content={"detail": "Server is shutting down"},
				headers={"X-Request-ID": request_id},
			)

		request.app.state.in_flight_requests = (
			getattr(request.app.state, "in_flight_requests", 0) + 1
		)
		structlog.contextvars.clear_contextvars()
		structlog.contextvars.bind_contextvars(request_id=request_id)
		try:
			response = await call_next(request)
			response.headers["X-Request-ID"] = request_id
			return response
		finally:
			request.app.state.in_flight_requests = max(
				getattr(request.app.state, "in_flight_requests", 1) - 1,
				0,
			)
			structlog.contextvars.clear_contextvars()


async def _drain_in_flight_requests(app: FastAPI) -> None:
	"""Wait briefly for in-flight requests to complete during shutdown."""
	loop = asyncio.get_running_loop()
	deadline = loop.time() + GRACEFUL_SHUTDOWN_TIMEOUT_SECONDS

	while getattr(app.state, "in_flight_requests", 0) > 0 and loop.time() < deadline:
		await asyncio.sleep(0.05)

	remaining = getattr(app.state, "in_flight_requests", 0)
	if remaining:
		logger.warning("Shutdown continuing with %s in-flight requests", remaining)


def _build_health_payload(app: FastAPI) -> tuple[dict[str, object], int]:
	"""Build readiness payload from the actual initialized service container."""
	container = getattr(app.state, "container", None)
	if container is None:
		return {
			"status": "starting",
			"version": APP_VERSION,
			"checks": {
				"db": "unavailable",
				"cache": "not_configured",
			},
			"services": {},
			"endpoints": {},
			"missing_critical": sorted(CRITICAL_HEALTH_SERVICES),
		}, 200

	services = {
		name: "ready" if getattr(container, attr, None) is not None else "unavailable"
		for name, attr in HEALTH_SERVICE_ATTRS.items()
	}
	endpoints = {
		name: "ready" if getattr(container, attr, None) is not None else "unavailable"
		for name, attr in HEALTH_ENDPOINT_ATTRS.items()
	}
	missing_critical = sorted(
		name for name in CRITICAL_HEALTH_SERVICES if services.get(name) != "ready"
	)

	if missing_critical:
		status = "unhealthy"
		status_code = 200
	elif any(value != "ready" for value in [*services.values(), *endpoints.values()]):
		status = "degraded"
		status_code = 200
	else:
		status = "healthy"
		status_code = 200

	return {
		"status": status,
		"version": APP_VERSION,
		"checks": {
			"db": "ready"
			if services.get("database_connection") == "ready"
			else "unavailable",
			"cache": _cache_check(container),
		},
		"services": services,
		"endpoints": endpoints,
		"missing_critical": missing_critical,
	}, status_code


def _cache_check(container: ServiceContainer) -> str:
	"""Report cache readiness when a cache client is configured."""
	for attr in ("cache", "cache_client", "redis", "redis_client"):
		if getattr(container, attr, None) is not None:
			return "ready"
	return "not_configured"


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
		app.add_api_websocket_route(
			"/ws", container.websocket_endpoints.websocket_endpoint
		)
		logger.info("WebSocket endpoint registered")


# ============================================================================
# Default Application Instance
# ============================================================================

# Create default instance for simple usage
app = create_app()


# ============================================================================
# Development Server
# ============================================================================


def _handle_shutdown_signal(server, sig: signal.Signals) -> None:
	"""Request graceful uvicorn shutdown for direct process execution."""
	app.state.draining = True
	server.should_exit = True
	logger.info("Shutdown signal received", extra={"signal": sig.name})


async def serve() -> int:
	"""Run the API with explicit signal handling for direct execution."""
	import uvicorn

	setup_logging()
	config = uvicorn.Config(
		"docfusion.api.app:app",
		host="0.0.0.0",
		port=8000,
		reload=True,
	)
	server = uvicorn.Server(config)

	loop = asyncio.get_running_loop()
	for sig in (signal.SIGTERM, signal.SIGINT):
		try:
			loop.add_signal_handler(sig, _handle_shutdown_signal, server, sig)
		except (NotImplementedError, RuntimeError):
			signal.signal(
				sig, lambda _signum, _frame, s=sig: _handle_shutdown_signal(server, s)
			)

	server.install_signal_handlers = lambda: None
	await server.serve()
	return 0


if __name__ == "__main__":
	raise SystemExit(asyncio.run(serve()))
