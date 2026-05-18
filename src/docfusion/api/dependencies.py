"""
Dependency Injection Container

Centralized service initialization and dependency injection for the API.
All services are singleton and expensive to initialize, so we use application
state pattern instead of FastAPI's Depends().

Usage:
    # In app.py
    from docfusion.api.dependencies import initialize_services, initialize_endpoints

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Startup
        settings = load_settings()
        container = await initialize_services(settings)
        await initialize_endpoints(container)
        app.state.container = container
        yield
        # Shutdown
        await shutdown_services()

    # In endpoints
    from docfusion.api.dependencies import get_storage_service, get_document_engine

    @router.post("/documents/")
    async def create_document(
        request: DocumentCreateRequest,
        storage: SecureStorageService = Depends(get_storage_service),
    ):
        ...
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import NoReturn, Optional

# Infrastructure clients
from ..infrastructure.searxng_client import SearXNGClient
from ..infrastructure.firecrawl_client import FirecrawlClient
from ..infrastructure.litellm_client import LiteLLMClient

# Secrets management
from ..config.secrets import SecretsManager

# Database
from ..core.database.config import DatabaseConfig
from ..core.database.connection import DatabaseConnection, get_database_connection
from ..core.database.session import DatabaseSession, get_database_session

# Core services
from ..security import SecurityManager, SecurityManagerConfiguration
from ..storage.secure_storage_service import (
	SecureStorageService,
	SecureStorageConfiguration,
)
from ..storage.rag_storage_service import RAGStorageConfiguration
from ..document_engine.secure_document_engine import (
	SecureDocumentEngine,
	SecureDocumentEngineConfiguration,
)
from ..document_engine.document_engine import DocumentGenerationConfiguration

# Endpoint classes
from .endpoints.document_endpoints import DocumentEndpoints
from .endpoints.template_endpoints import TemplateEndpoints
from .endpoints.search_endpoints import SearchEndpoints
from .endpoints.batch_endpoints import BatchEndpoints
from .endpoints.collaboration_endpoints import CollaborationEndpoints
from .endpoints.webhook_endpoints import WebhookEndpoints
from .endpoints.websocket_endpoints import WebSocketEndpoints

logger = logging.getLogger(__name__)


# ============================================================================
# Configuration
# ============================================================================

@dataclass
class ServiceSettings:
	"""Application settings loaded from environment."""

	# Security
	jwt_secret: str = ""
	encryption_key: Optional[str] = None
	require_authentication: bool = True

	# Storage
	storage_path: str = "./data/storage"
	enable_embeddings: bool = True
	embedding_model: str = "all-MiniLM-L6-v2"

	# Document Engine
	template_path: str = "./templates"
	output_path: str = "./output"
	supported_formats: list = field(default_factory=lambda: ["pdf", "docx", "html", "md"])

	# Collaboration
	collaboration_storage_path: str = "./data/collaboration"

	# Database
	database_url: str = ""

	# Infrastructure Services
	searxng_url: str = "http://84.247.181.100:8888"
	firecrawl_url: str = "http://84.247.181.100:3002"
	litellm_url: str = "http://84.247.181.100:4000"
	litellm_key: str = ""

	# CORS
	cors_allowed_origins: list[str] = field(default_factory=lambda: ["http://localhost:3000"])


def load_settings() -> ServiceSettings:
	"""Load settings from environment variables using centralized secrets management."""
	return ServiceSettings(
		jwt_secret=SecretsManager.get_jwt_secret(),
		encryption_key=SecretsManager.get_encryption_key(),
		require_authentication=SecretsManager.get_require_auth(),
		storage_path=SecretsManager.get_storage_path(),
		enable_embeddings=SecretsManager.is_embeddings_enabled(),
		embedding_model=SecretsManager.get_embedding_model(),
		template_path=SecretsManager.get_template_path(),
		output_path=SecretsManager.get_output_path(),
		collaboration_storage_path=SecretsManager.get_collaboration_storage_path(),
		database_url=SecretsManager.get_database_url(),
		searxng_url=SecretsManager.get_searxng_url(),
		firecrawl_url=SecretsManager.get_firecrawl_url(),
		litellm_url=SecretsManager.get_litellm_url(),
		litellm_key=SecretsManager.get_litellm_key(),
		cors_allowed_origins=SecretsManager.get_cors_allowed_origins(),
	)


# ============================================================================
# Service Container
# ============================================================================

class ServiceContainer:
	"""
	Singleton container for all services.

	All services are initialized once and shared across the application.
	"""

	_instance: Optional["ServiceContainer"] = None

	def __init__(self):
		# Database
		self.database_connection: Optional[DatabaseConnection] = None
		self.database_session: Optional[DatabaseSession] = None

		# Infrastructure clients
		self.searxng_client: Optional[SearXNGClient] = None
		self.firecrawl_client: Optional[FirecrawlClient] = None
		self.litellm_client: Optional[LiteLLMClient] = None

		# Core services
		self.security_manager: Optional[SecurityManager] = None
		self.storage_service: Optional[SecureStorageService] = None
		self.document_engine: Optional[SecureDocumentEngine] = None
		self.collaboration_integrator = None
		self.intelligence_service = None

		# Endpoint instances
		self.document_endpoints: Optional[DocumentEndpoints] = None
		self.template_endpoints: Optional[TemplateEndpoints] = None
		self.search_endpoints: Optional[SearchEndpoints] = None
		self.batch_endpoints: Optional[BatchEndpoints] = None
		self.collaboration_endpoints: Optional[CollaborationEndpoints] = None
		self.webhook_endpoints: Optional[WebhookEndpoints] = None
		self.websocket_endpoints: Optional[WebSocketEndpoints] = None

	@classmethod
	def get_instance(cls) -> "ServiceContainer":
		"""Get or create the singleton instance."""
		if cls._instance is None:
			cls._instance = ServiceContainer()
		return cls._instance


# ============================================================================
# Service Initialization
# ============================================================================

async def initialize_services(settings: ServiceSettings) -> ServiceContainer:
	"""
	Initialize all services in dependency order.

	This MUST be called during application startup.

	Args:
		settings: Application settings

	Returns:
		ServiceContainer with all initialized services
	"""
	container = ServiceContainer.get_instance()

	logger.info("Initializing DocuFusion services...")

	# 1. Initialize database connection
	try:
		# Set database config from settings
		db_config = DatabaseConfig(connection_url=settings.database_url)
		from ..core.database.config import set_database_config
		set_database_config(db_config)

		container.database_connection = await get_database_connection()
		container.database_session = await get_database_session()
		logger.info("Database connection initialized")
	except Exception as e:
		logger.warning(f"Failed to initialize database connection: {e}")
		# Continue without database - some features will be limited

	# 2. Initialize infrastructure clients (no dependencies)
	try:
		container.searxng_client = SearXNGClient(base_url=settings.searxng_url)
		logger.info(f"SearXNG client initialized: {settings.searxng_url}")
	except Exception as e:
		logger.warning(f"Failed to initialize SearXNG client: {e}")

	try:
		container.firecrawl_client = FirecrawlClient(
			base_url=settings.firecrawl_url,
			api_key="",  # Self-hosted, no key needed
		)
		logger.info(f"Firecrawl client initialized: {settings.firecrawl_url}")
	except Exception as e:
		logger.warning(f"Failed to initialize Firecrawl client: {e}")

	try:
		container.litellm_client = LiteLLMClient(
			base_url=settings.litellm_url,
			api_key=settings.litellm_key,
		)
		logger.info(f"LiteLLM client initialized: {settings.litellm_url}")
	except Exception as e:
		logger.warning(f"Failed to initialize LiteLLM client: {e}")

	# 3. Initialize SecurityManager (no dependencies)
	try:
		security_config = SecurityManagerConfiguration(
			enable_audit_integration=True,
			enable_encryption_integration=True,
			require_mfa_for_admin=False,  # Set based on settings
		)
		container.security_manager = SecurityManager(security_config)
		await container.security_manager._initialize_system()
		logger.info("Security manager initialized")
	except Exception as e:
		logger.warning(f"Failed to initialize security manager: {e}")
		# Create minimal security manager
		try:
			container.security_manager = SecurityManager()
			await container.security_manager._initialize_system()
			logger.info("Security manager initialized with defaults")
		except Exception as e2:
			logger.error(f"Failed to initialize security manager with defaults: {e2}")

	# 4. Initialize SecureStorageService (depends on SecurityManager, database)
	if container.security_manager and container.database_connection:
		try:
			rag_config = RAGStorageConfiguration(
				storage_root_path=Path(settings.storage_path),
				enable_rag=True,
				postgresql_connection_string=settings.database_url,
				embedding_provider="ollama",
				ollama_base_url=settings.litellm_url.replace(":4000", ":11434"),  # Ollama port
			)
			storage_config = SecureStorageConfiguration(
				rag_config=rag_config,
				security_config=container.security_manager.config,
				require_authentication=settings.require_authentication,
				enable_document_encryption=True,
			)
			container.storage_service = SecureStorageService(storage_config)
			logger.info("Secure storage service initialized")
		except Exception as e:
			logger.warning(f"Failed to initialize storage service: {e}")

	# 5. Initialize SecureDocumentEngine (depends on SecurityManager)
	if container.security_manager:
		try:
			doc_engine_config = DocumentGenerationConfiguration(
				storage_root_path=settings.template_path,
				output_directory=settings.output_path,
			)
			secure_engine_config = SecureDocumentEngineConfiguration(
				document_engine_config=doc_engine_config,
				security_config=container.security_manager.config,
				require_authentication=settings.require_authentication,
			)
			container.document_engine = SecureDocumentEngine(secure_engine_config)
			logger.info("Secure document engine initialized")
		except Exception as e:
			logger.warning(f"Failed to initialize document engine: {e}")

	logger.info("Core services initialized")
	return container


async def initialize_endpoints(container: ServiceContainer) -> ServiceContainer:
	"""
	Initialize all endpoint classes with injected services.

	This MUST be called after initialize_services().

	Args:
		container: ServiceContainer with initialized services

	Returns:
		ServiceContainer with initialized endpoints
	"""
	logger.info("Initializing API endpoints...")

	# Initialize DocumentEndpoints
	if container.storage_service and container.document_engine and container.security_manager:
		try:
			container.document_endpoints = DocumentEndpoints(
				storage_service=container.storage_service,
				document_engine=container.document_engine,
				security_manager=container.security_manager,
			)
			logger.info("Document endpoints initialized")
		except Exception as e:
			logger.error(f"Failed to initialize document endpoints: {e}")

	# Initialize TemplateEndpoints (uses same services)
	if container.storage_service and container.document_engine and container.security_manager:
		try:
			container.template_endpoints = TemplateEndpoints(
				storage_service=container.storage_service,
				document_engine=container.document_engine,
				security_manager=container.security_manager,
			)
			logger.info("Template endpoints initialized")
		except Exception as e:
			logger.error(f"Failed to initialize template endpoints: {e}")

	# Initialize SearchEndpoints (only needs security_manager)
	if container.security_manager:
		try:
			container.search_endpoints = SearchEndpoints(
				security_manager=container.security_manager,
			)
			logger.info("Search endpoints initialized")
		except Exception as e:
			logger.error(f"Failed to initialize search endpoints: {e}")

	# Initialize BatchEndpoints
	if container.storage_service and container.document_engine and container.security_manager:
		try:
			container.batch_endpoints = BatchEndpoints(
				storage_service=container.storage_service,
				document_engine=container.document_engine,
				security_manager=container.security_manager,
			)
			logger.info("Batch endpoints initialized")
		except Exception as e:
			logger.error(f"Failed to initialize batch endpoints: {e}")

	# Initialize CollaborationEndpoints
	if container.storage_service and container.security_manager:
		try:
			container.collaboration_endpoints = CollaborationEndpoints(
				storage_service=container.storage_service,
				security_manager=container.security_manager,
				websocket_endpoints=None,  # Will be set later if needed
			)
			logger.info("Collaboration endpoints initialized")
		except Exception as e:
			logger.warning(f"Collaboration endpoints not initialized: {e}")

	# Initialize WebhookEndpoints
	if container.security_manager:
		try:
			container.webhook_endpoints = WebhookEndpoints(
				security_manager=container.security_manager,
			)
			logger.info("Webhook endpoints initialized")
		except Exception as e:
			logger.warning(f"Webhook endpoints not initialized: {e}")

	# Initialize WebSocketEndpoints
	if container.security_manager:
		try:
			container.websocket_endpoints = WebSocketEndpoints(
				security_manager=container.security_manager,
				storage_service=container.storage_service,
			)
			logger.info("WebSocket endpoints initialized")
		except Exception as e:
			logger.warning(f"WebSocket endpoints not initialized: {e}")

	logger.info("API endpoints initialized")
	return container


async def shutdown_services() -> None:
	"""Gracefully shutdown all services."""
	container = ServiceContainer.get_instance()

	logger.info("Shutting down services...")

	# Close infrastructure clients
	if container.searxng_client:
		await container.searxng_client.close()

	if container.firecrawl_client:
		await container.firecrawl_client.close()

	if container.litellm_client:
		await container.litellm_client.close()

	# Close database connection
	if container.database_connection:
		await container.database_connection.close()

	# Close storage service
	if container.storage_service:
		try:
			await container.storage_service.close()
		except Exception as e:
			logger.warning(f"Error closing storage service: {e}")

	logger.info("All services shut down")


# ============================================================================
# Dependency Injection Functions for FastAPI
# ============================================================================

async def get_container() -> ServiceContainer:
	"""Get the service container (for dependency injection)."""
	return ServiceContainer.get_instance()


async def get_searxng() -> SearXNGClient:
	"""Get SearXNG client (for dependency injection)."""
	container = await get_container()
	if container.searxng_client is None:
		raise RuntimeError("SearXNG client not initialized. Call initialize_services() first.")
	return container.searxng_client


async def get_firecrawl() -> FirecrawlClient:
	"""Get Firecrawl client (for dependency injection)."""
	container = await get_container()
	if container.firecrawl_client is None:
		raise RuntimeError("Firecrawl client not initialized. Call initialize_services() first.")
	return container.firecrawl_client


async def get_litellm() -> LiteLLMClient:
	"""Get LiteLLM client (for dependency injection)."""
	container = await get_container()
	if container.litellm_client is None:
		raise RuntimeError("LiteLLM client not initialized. Call initialize_services() first.")
	return container.litellm_client


# Placeholder functions for core services (to be implemented)
async def get_storage_service():
	"""Get storage service (for dependency injection)."""
	container = await get_container()
	if container.storage_service is None:
		raise RuntimeError("Storage service not initialized. Call initialize_services() first.")
	return container.storage_service


async def get_document_engine():
	"""Get document engine (for dependency injection)."""
	container = await get_container()
	if container.document_engine is None:
		raise RuntimeError("Document engine not initialized. Call initialize_services() first.")
	return container.document_engine


async def get_collaboration_integrator():
	"""Get collaboration integrator (for dependency injection)."""
	container = await get_container()
	if container.collaboration_integrator is None:
		raise RuntimeError("Collaboration integrator not initialized. Call initialize_services() first.")
	return container.collaboration_integrator


# Endpoint dependency injection functions
async def get_document_endpoints():
	"""Get document endpoints (for dependency injection)."""
	container = await get_container()
	if container.document_endpoints is None:
		raise RuntimeError("Document endpoints not initialized. Call initialize_endpoints() first.")
	return container.document_endpoints


async def get_template_endpoints():
	"""Get template endpoints (for dependency injection)."""
	container = await get_container()
	if container.template_endpoints is None:
		raise RuntimeError("Template endpoints not initialized. Call initialize_endpoints() first.")
	return container.template_endpoints


async def get_search_endpoints():
	"""Get search endpoints (for dependency injection)."""
	container = await get_container()
	if container.search_endpoints is None:
		raise RuntimeError("Search endpoints not initialized. Call initialize_endpoints() first.")
	return container.search_endpoints


# ============================================================================
# Context Managers
# ============================================================================

@asynccontextmanager
async def service_context():
	"""
	Context manager for service lifecycle.

	Usage:
		async with service_context() as container:
			# Use services
			search_results = await container.searxng_client.search("query")
	"""
	settings = load_settings()
	container = await initialize_services(settings)
	try:
		yield container
	finally:
		await shutdown_services()


# ============================================================================
# Tenant dependency
# ============================================================================
#
# The Next.js BFF proxies requests to FastAPI and injects the resolved tenant
# identity via HMAC-signed headers. FastAPI never inspects the user's session
# cookie directly; the signed BFF context is the trust boundary.

from fastapi import Header, HTTPException, Request, status


@dataclass(frozen=True, slots=True)
class TenantContext:
	user_id: str
	organization_id: str


TENANT_SIGNATURE_MAX_AGE_SECONDS = 300
TENANT_SIGNATURE_SECRET_ENV = "DOCFUSION_TENANT_HEADER_SECRET"


def build_tenant_signature(
	*,
	method: str,
	path: str,
	user_id: str,
	organization_id: str,
	timestamp: str,
	secret: str,
) -> str:
	"""Build the BFF-to-FastAPI tenant header signature."""
	payload = "\n".join(
		[
			"v1",
			method.upper(),
			path,
			user_id,
			organization_id,
			timestamp,
		]
	)
	return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def build_signed_tenant_headers(
	*,
	method: str,
	path: str,
	user_id: str,
	organization_id: str,
	timestamp: int | None = None,
	secret: str | None = None,
) -> dict[str, str]:
	"""Build signed tenant headers for tests and trusted internal clients."""
	resolved_secret = secret or os.environ.get(TENANT_SIGNATURE_SECRET_ENV)
	if not resolved_secret:
		raise RuntimeError(f"{TENANT_SIGNATURE_SECRET_ENV} is required")
	resolved_timestamp = str(timestamp if timestamp is not None else int(time.time()))
	return {
		"x-docfusion-user-id": user_id,
		"x-docfusion-organization-id": organization_id,
		"x-docfusion-tenant-timestamp": resolved_timestamp,
		"x-docfusion-tenant-signature": build_tenant_signature(
			method=method,
			path=path,
			user_id=user_id,
			organization_id=organization_id,
			timestamp=resolved_timestamp,
			secret=resolved_secret,
		),
	}


def _reject_invalid_tenant_signature() -> NoReturn:
	raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid tenant signature")


def require_tenant(
	request: Request,
	x_docfusion_user_id: str | None = Header(default=None),
	x_docfusion_organization_id: str | None = Header(default=None),
	x_docfusion_tenant_timestamp: str | None = Header(default=None),
	x_docfusion_tenant_signature: str | None = Header(default=None),
) -> TenantContext:
	"""Resolve calling user and organization from signed BFF-injected headers.

	Raises 401 if user is missing, 403 if user is set but org is missing.
	"""
	if not x_docfusion_user_id:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
	if not x_docfusion_organization_id:
		raise HTTPException(
			status_code=status.HTTP_403_FORBIDDEN, detail="No organization context"
		)
	if not x_docfusion_tenant_timestamp or not x_docfusion_tenant_signature:
		_reject_invalid_tenant_signature()

	secret = os.environ.get(TENANT_SIGNATURE_SECRET_ENV)
	if not secret:
		logger.error("%s is required to verify tenant headers", TENANT_SIGNATURE_SECRET_ENV)
		_reject_invalid_tenant_signature()

	try:
		timestamp = int(x_docfusion_tenant_timestamp)
	except ValueError:
		_reject_invalid_tenant_signature()
	if abs(int(time.time()) - timestamp) > TENANT_SIGNATURE_MAX_AGE_SECONDS:
		_reject_invalid_tenant_signature()

	expected_signature = build_tenant_signature(
		method=request.method,
		path=request.url.path,
		user_id=x_docfusion_user_id,
		organization_id=x_docfusion_organization_id,
		timestamp=x_docfusion_tenant_timestamp,
		secret=secret,
	)
	if not hmac.compare_digest(expected_signature, x_docfusion_tenant_signature):
		_reject_invalid_tenant_signature()

	return TenantContext(
		user_id=x_docfusion_user_id,
		organization_id=x_docfusion_organization_id,
	)
