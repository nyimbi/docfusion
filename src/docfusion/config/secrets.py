"""
Centralized Secrets Management

Provides secure, environment-aware access to all secrets and sensitive configuration.
In development mode, falls back to safe defaults for local testing.
In production, requires explicit configuration via environment variables.

Usage:
    from docfusion.config.secrets import SecretsManager

    jwt_secret = SecretsManager.get_jwt_secret()
    litellm_key = SecretsManager.get_litellm_key()

Security Model:
    - Development: Safe defaults for local testing (dev-secret-key-change-in-production)
    - Production: Strict validation - raises ValueError if secrets not configured
    - Testing: Can override environment detection with SECRETS_STRICT_MODE env var
"""

from __future__ import annotations

import logging
import os
import secrets
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class Environment(str, Enum):
	"""Deployment environment types."""

	DEVELOPMENT = "development"
	STAGING = "staging"
	PRODUCTION = "production"
	TESTING = "testing"


def _detect_environment() -> Environment:
	"""Detect current environment from ENVIRONMENT or NODE_ENV."""
	env = os.environ.get("ENVIRONMENT", os.environ.get("NODE_ENV", "development")).lower()

	if env in ("production", "prod"):
		return Environment.PRODUCTION
	elif env in ("staging", "stage"):
		return Environment.STAGING
	elif env in ("test", "testing", "ci"):
		return Environment.TESTING
	else:
		return Environment.DEVELOPMENT


def _is_strict_mode() -> bool:
	"""Check if strict secret validation is enabled."""
	# Strict mode in production/staging, or when explicitly enabled
	env = _detect_environment()
	explicit_strict = os.environ.get("SECRETS_STRICT_MODE", "").lower() in ("true", "1", "yes")
	return env in (Environment.PRODUCTION, Environment.STAGING) or explicit_strict


@dataclass
class SecretConfig:
	"""Configuration for a single secret."""

	name: str
	env_var: str
	description: str
	default: Optional[str] = None
	development_default: Optional[str] = None
	required_in_production: bool = True
	generate_if_missing: bool = False


class SecretsManager:
	"""
	Centralized secrets management with environment-aware validation.

	All secrets are accessed through static methods that:
	1. Check environment variables first
	2. Apply safe defaults in development mode
	3. Raise clear errors in production when required secrets are missing

	Example:
	    # JWT secret - has dev default, required in production
	    jwt_key = SecretsManager.get_jwt_secret()

	    # API key - empty in dev if not set
	    api_key = SecretsManager.get_litellm_key()
	"""

	# Cache for generated secrets during runtime
	_generated_secrets: dict[str, str] = field(default_factory=dict)

	# Secret configurations
	_SECRETS: dict[str, SecretConfig] = {
		# Authentication secrets
		"JWT_SECRET": SecretConfig(
			name="jwt_secret",
			env_var="JWT_SECRET",
			description="JWT signing secret for authentication tokens",
			development_default="dev-secret-key-change-in-production",
			required_in_production=True,
		),
		"ENCRYPTION_KEY": SecretConfig(
			name="encryption_key",
			env_var="ENCRYPTION_KEY",
			description="Data encryption key for sensitive storage",
			development_default=None,  # Optional even in dev
			required_in_production=False,
		),
		# OAuth provider secrets
		"GOOGLE_CLIENT_ID": SecretConfig(
			name="google_client_id",
			env_var="GOOGLE_CLIENT_ID",
			description="Google OAuth client ID",
			development_default="",
			required_in_production=False,
		),
		"GOOGLE_CLIENT_SECRET": SecretConfig(
			name="google_client_secret",
			env_var="GOOGLE_CLIENT_SECRET",
			description="Google OAuth client secret",
			development_default="",
			required_in_production=False,
		),
		"MICROSOFT_CLIENT_ID": SecretConfig(
			name="microsoft_client_id",
			env_var="MICROSOFT_CLIENT_ID",
			description="Microsoft OAuth client ID",
			development_default="",
			required_in_production=False,
		),
		"MICROSOFT_CLIENT_SECRET": SecretConfig(
			name="microsoft_client_secret",
			env_var="MICROSOFT_CLIENT_SECRET",
			description="Microsoft OAuth client secret",
			development_default="",
			required_in_production=False,
		),
		"GITHUB_CLIENT_ID": SecretConfig(
			name="github_client_id",
			env_var="GITHUB_CLIENT_ID",
			description="GitHub OAuth client ID",
			development_default="",
			required_in_production=False,
		),
		"GITHUB_CLIENT_SECRET": SecretConfig(
			name="github_client_secret",
			env_var="GITHUB_CLIENT_SECRET",
			description="GitHub OAuth client secret",
			development_default="",
			required_in_production=False,
		),
		# Infrastructure secrets
		"LITELLM_KEY": SecretConfig(
			name="litellm_key",
			env_var="LITELLM_KEY",
			description="LiteLLM API key for AI gateway",
			development_default="",
			required_in_production=False,
		),
		"OPENAI_API_KEY": SecretConfig(
			name="openai_api_key",
			env_var="OPENAI_API_KEY",
			description="OpenAI API key for LLM operations",
			development_default="",
			required_in_production=False,
		),
		# Notification provider secrets
		"SENDGRID_API_KEY": SecretConfig(
			name="sendgrid_api_key",
			env_var="SENDGRID_API_KEY",
			description="SendGrid API key for email notifications",
			development_default="",
			required_in_production=False,
		),
		"TWILIO_ACCOUNT_SID": SecretConfig(
			name="twilio_account_sid",
			env_var="TWILIO_ACCOUNT_SID",
			description="Twilio account SID for SMS notifications",
			development_default="",
			required_in_production=False,
		),
		"TWILIO_AUTH_TOKEN": SecretConfig(
			name="twilio_auth_token",
			env_var="TWILIO_AUTH_TOKEN",
			description="Twilio auth token for SMS notifications",
			development_default="",
			required_in_production=False,
		),
		"MAILGUN_API_KEY": SecretConfig(
			name="mailgun_api_key",
			env_var="MAILGUN_API_KEY",
			description="Mailgun API key for email notifications",
			development_default="",
			required_in_production=False,
		),
		"POSTMARK_API_KEY": SecretConfig(
			name="postmark_api_key",
			env_var="POSTMARK_API_KEY",
			description="Postmark API key for email notifications",
			development_default="",
			required_in_production=False,
		),
		"SMS_API_KEY": SecretConfig(
			name="sms_api_key",
			env_var="SMS_API_KEY",
			description="Generic SMS provider API key",
			development_default="",
			required_in_production=False,
		),
		"SMS_API_SECRET": SecretConfig(
			name="sms_api_secret",
			env_var="SMS_API_SECRET",
			description="Generic SMS provider API secret",
			development_default="",
			required_in_production=False,
		),
		"WEBHOOK_API_KEY": SecretConfig(
			name="webhook_api_key",
			env_var="WEBHOOK_API_KEY",
			description="Webhook authentication API key",
			development_default="",
			required_in_production=False,
		),
		"WEBHOOK_API_SECRET": SecretConfig(
			name="webhook_api_secret",
			env_var="WEBHOOK_API_SECRET",
			description="Webhook authentication API secret",
			development_default="",
			required_in_production=False,
		),
		# Webhook secrets
		"WEBHOOK_BEARER_TOKEN": SecretConfig(
			name="webhook_bearer_token",
			env_var="WEBHOOK_BEARER_TOKEN",
			description="Bearer token for webhook authentication",
			development_default="",
			required_in_production=False,
		),
		"WEBHOOK_HMAC_SECRET": SecretConfig(
			name="webhook_hmac_secret",
			env_var="WEBHOOK_HMAC_SECRET",
			description="HMAC secret for webhook signature verification",
			development_default="",
			required_in_production=False,
		),
		# Database secrets
		"DATABASE_PASSWORD": SecretConfig(
			name="database_password",
			env_var="DATABASE_PASSWORD",
			description="Database connection password",
			development_default="",
			required_in_production=False,
		),
		"REDIS_PASSWORD": SecretConfig(
			name="redis_password",
			env_var="REDIS_PASSWORD",
			description="Redis connection password",
			development_default="",
			required_in_production=False,
		),
		# AWS secrets
		"AWS_ACCESS_KEY_ID": SecretConfig(
			name="aws_access_key_id",
			env_var="AWS_ACCESS_KEY_ID",
			description="AWS access key ID",
			development_default="",
			required_in_production=False,
		),
		"AWS_SECRET_ACCESS_KEY": SecretConfig(
			name="aws_secret_access_key",
			env_var="AWS_SECRET_ACCESS_KEY",
			description="AWS secret access key",
			development_default="",
			required_in_production=False,
		),
		# SMTP secrets
		"SMTP_HOST": SecretConfig(
			name="smtp_host",
			env_var="SMTP_HOST",
			description="SMTP server hostname",
			development_default="mail.lindela.io",
			required_in_production=True,
		),
		"SMTP_PORT": SecretConfig(
			name="smtp_port",
			env_var="SMTP_PORT",
			description="SMTP server port",
			development_default="587",
			required_in_production=True,
		),
		"SMTP_USER": SecretConfig(
			name="smtp_user",
			env_var="SMTP_USER",
			description="SMTP authentication username",
			development_default="",
			required_in_production=True,
		),
		"SMTP_PASSWORD": SecretConfig(
			name="smtp_password",
			env_var="SMTP_PASSWORD",
			description="SMTP authentication password",
			development_default="",
			required_in_production=True,
		),
		"SMTP_FROM": SecretConfig(
			name="smtp_from",
			env_var="SMTP_FROM",
			description="SMTP sender email address",
			development_default="opportunities@lindela.io",
			required_in_production=True,
		),
		# Calendar integration secrets
		"OUTLOOK_TENANT_ID": SecretConfig(
			name="outlook_tenant_id",
			env_var="OUTLOOK_TENANT_ID",
			description="Outlook/Azure AD tenant ID",
			development_default="",
			required_in_production=False,
		),
		"GOOGLE_ACCESS_TOKEN": SecretConfig(
			name="google_access_token",
			env_var="GOOGLE_ACCESS_TOKEN",
			description="Google OAuth access token",
			development_default="",
			required_in_production=False,
		),
		"OUTLOOK_ACCESS_TOKEN": SecretConfig(
			name="outlook_access_token",
			env_var="OUTLOOK_ACCESS_TOKEN",
			description="Outlook OAuth access token",
			development_default="",
			required_in_production=False,
		),
		# Database URL (non-secret config, but centralized)
		"DATABASE_URL": SecretConfig(
			name="database_url",
			env_var="DATABASE_URL",
			description="PostgreSQL database connection URL",
			development_default="",
			required_in_production=True,
		),
	}

	@staticmethod
	def _get_secret(secret_key: str) -> str:
		"""
		Get a secret value with environment-aware defaults.

		Args:
		    secret_key: Key in _SECRETS dict

		Returns:
		    Secret value from environment or appropriate default

		Raises:
		    ValueError: In production when required secret is missing
		"""
		config = SecretsManager._SECRETS.get(secret_key)
		if not config:
			raise ValueError(f"Unknown secret: {secret_key}")

		# Try environment variable first
		value = os.environ.get(config.env_var)

		if value:
			return value

		# Check strict mode
		if _is_strict_mode():
			if config.required_in_production:
				raise ValueError(
					f"Required secret {config.env_var} not set. "
					f"Set the environment variable: {config.env_var}"
				)
			return ""  # Non-required secrets return empty in production

		# Development mode - use development default
		if config.development_default is not None:
			logger.debug(f"Using development default for {config.env_var}")
			return config.development_default

		# No default available
		return ""

	@staticmethod
	def is_strict_mode() -> bool:
		"""Check if strict secret validation is enabled."""
		return _is_strict_mode()

	# ========================================================================
	# Authentication Secrets
	# ========================================================================

	@staticmethod
	def get_jwt_secret() -> str:
		"""
		Get JWT signing secret.

		In development, returns a safe default for testing.
		In production, raises ValueError if not configured.
		"""
		return SecretsManager._get_secret("JWT_SECRET")

	@staticmethod
	def get_encryption_key() -> Optional[str]:
		"""Get data encryption key (optional)."""
		value = SecretsManager._get_secret("ENCRYPTION_KEY")
		return value if value else None

	@staticmethod
	def get_require_auth() -> bool:
		"""Get authentication requirement setting."""
		return os.environ.get("REQUIRE_AUTH", "true").lower() in ("true", "1", "yes")

	# ========================================================================
	# OAuth Provider Secrets
	# ========================================================================

	@staticmethod
	def get_google_client_id() -> str:
		"""Get Google OAuth client ID."""
		return SecretsManager._get_secret("GOOGLE_CLIENT_ID")

	@staticmethod
	def get_google_client_secret() -> str:
		"""Get Google OAuth client secret."""
		return SecretsManager._get_secret("GOOGLE_CLIENT_SECRET")

	@staticmethod
	def get_microsoft_client_id() -> str:
		"""Get Microsoft OAuth client ID."""
		return SecretsManager._get_secret("MICROSOFT_CLIENT_ID")

	@staticmethod
	def get_microsoft_client_secret() -> str:
		"""Get Microsoft OAuth client secret."""
		return SecretsManager._get_secret("MICROSOFT_CLIENT_SECRET")

	@staticmethod
	def get_github_client_id() -> str:
		"""Get GitHub OAuth client ID."""
		return SecretsManager._get_secret("GITHUB_CLIENT_ID")

	@staticmethod
	def get_github_client_secret() -> str:
		"""Get GitHub OAuth client secret."""
		return SecretsManager._get_secret("GITHUB_CLIENT_SECRET")

	# ========================================================================
	# Infrastructure Secrets
	# ========================================================================

	@staticmethod
	def get_litellm_key() -> str:
		"""Get LiteLLM API key."""
		return SecretsManager._get_secret("LITELLM_KEY")

	@staticmethod
	def get_openai_api_key() -> str:
		"""Get OpenAI API key."""
		return SecretsManager._get_secret("OPENAI_API_KEY")

	@staticmethod
	def get_litellm_url() -> str:
		"""Get LiteLLM server URL."""
		return os.environ.get("LITELLM_URL", "http://84.247.181.100:4000")

	@staticmethod
	def get_docling_url() -> str:
		"""Get Docling server URL."""
		return os.environ.get("DOCLING_URL", "http://84.247.181.100:3600")

	@staticmethod
	def get_firecrawl_url() -> str:
		"""Get Firecrawl server URL."""
		return os.environ.get("FIRECRAWL_URL", "http://84.247.181.100:3002")

	@staticmethod
	def get_searxng_url() -> str:
		"""Get SearXNG server URL."""
		return os.environ.get("SEARXNG_URL", "https://search.lindela.io")

	@staticmethod
	def get_firecrawl_key() -> str:
		"""Get Firecrawl API key (empty for self-hosted)."""
		return os.environ.get("FIRECRAWL_KEY", "")

	# ========================================================================
	# Notification Provider Secrets
	# ========================================================================

	@staticmethod
	def get_sendgrid_api_key() -> str:
		"""Get SendGrid API key for email."""
		return SecretsManager._get_secret("SENDGRID_API_KEY")

	@staticmethod
	def get_twilio_account_sid() -> str:
		"""Get Twilio account SID for SMS."""
		return SecretsManager._get_secret("TWILIO_ACCOUNT_SID")

	@staticmethod
	def get_twilio_auth_token() -> str:
		"""Get Twilio auth token for SMS."""
		return SecretsManager._get_secret("TWILIO_AUTH_TOKEN")

	@staticmethod
	def get_mailgun_api_key() -> str:
		"""Get Mailgun API key for email."""
		return SecretsManager._get_secret("MAILGUN_API_KEY")

	@staticmethod
	def get_postmark_api_key() -> str:
		"""Get Postmark API key for email."""
		return SecretsManager._get_secret("POSTMARK_API_KEY")

	@staticmethod
	def get_sms_api_key() -> str:
		"""Get generic SMS provider API key."""
		return SecretsManager._get_secret("SMS_API_KEY")

	@staticmethod
	def get_sms_api_secret() -> str:
		"""Get generic SMS provider API secret."""
		return SecretsManager._get_secret("SMS_API_SECRET")

	@staticmethod
	def get_webhook_api_key() -> str:
		"""Get webhook authentication API key."""
		return SecretsManager._get_secret("WEBHOOK_API_KEY")

	@staticmethod
	def get_webhook_api_secret() -> str:
		"""Get webhook authentication API secret."""
		return SecretsManager._get_secret("WEBHOOK_API_SECRET")

	@staticmethod
	def get_webhook_bearer_token() -> str:
		"""Get webhook bearer token."""
		return SecretsManager._get_secret("WEBHOOK_BEARER_TOKEN")

	@staticmethod
	def get_webhook_hmac_secret() -> str:
		"""Get webhook HMAC secret."""
		return SecretsManager._get_secret("WEBHOOK_HMAC_SECRET")

	# ========================================================================
	# Database Secrets
	# ========================================================================

	@staticmethod
	def get_database_password() -> str:
		"""Get database password."""
		return SecretsManager._get_secret("DATABASE_PASSWORD")

	@staticmethod
	def get_redis_password() -> str:
		"""Get Redis password."""
		return SecretsManager._get_secret("REDIS_PASSWORD")

	# ========================================================================
	# AWS Secrets
	# ========================================================================

	@staticmethod
	def get_aws_access_key_id() -> str:
		"""Get AWS access key ID."""
		return SecretsManager._get_secret("AWS_ACCESS_KEY_ID")

	@staticmethod
	def get_aws_secret_access_key() -> str:
		"""Get AWS secret access key."""
		return SecretsManager._get_secret("AWS_SECRET_ACCESS_KEY")

	@staticmethod
	def get_aws_region() -> str:
		"""Get AWS region."""
		return os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))

	# ========================================================================
	# SMTP Secrets
	# ========================================================================

	@staticmethod
	def get_smtp_host() -> str:
		"""Get SMTP server hostname."""
		return SecretsManager._get_secret("SMTP_HOST")

	@staticmethod
	def get_smtp_port() -> int:
		"""Get SMTP server port."""
		return int(SecretsManager._get_secret("SMTP_PORT"))

	@staticmethod
	def get_smtp_user() -> str:
		"""Get SMTP authentication username."""
		return SecretsManager._get_secret("SMTP_USER")

	@staticmethod
	def get_smtp_password() -> str:
		"""Get SMTP authentication password."""
		return SecretsManager._get_secret("SMTP_PASSWORD")

	@staticmethod
	def get_smtp_from_address() -> str:
		"""Get SMTP sender email address."""
		return SecretsManager._get_secret("SMTP_FROM")

	@staticmethod
	def get_smtp_username() -> str:
		"""Get SMTP username (alias for get_smtp_user)."""
		return SecretsManager.get_smtp_user()

	# ========================================================================
	# Calendar Integration Secrets
	# ========================================================================

	@staticmethod
	def get_outlook_tenant_id() -> str:
		"""Get Outlook/Azure AD tenant ID."""
		return SecretsManager._get_secret("OUTLOOK_TENANT_ID")

	@staticmethod
	def get_google_access_token() -> str:
		"""Get Google OAuth access token."""
		return SecretsManager._get_secret("GOOGLE_ACCESS_TOKEN")

	@staticmethod
	def get_outlook_access_token() -> str:
		"""Get Outlook OAuth access token."""
		return SecretsManager._get_secret("OUTLOOK_ACCESS_TOKEN")

	# ========================================================================
	# Infrastructure Configuration
	# ========================================================================

	@staticmethod
	def get_temporal_url() -> str:
		"""Get Temporal server URL."""
		return os.environ.get("TEMPORAL_URL", "62.84.181.55:7233")

	@staticmethod
	def get_temporal_namespace() -> str:
		"""Get Temporal namespace."""
		return os.environ.get("TEMPORAL_NAMESPACE", "default")

	@staticmethod
	def get_temporal_task_queue() -> str:
		"""Get Temporal task queue."""
		return os.environ.get("TEMPORAL_TASK_QUEUE", "docfusion-queue")

	@staticmethod
	def get_database_url() -> str:
		"""Get database connection URL."""
		return SecretsManager._get_secret("DATABASE_URL")

	@staticmethod
	def get_environment() -> str:
		"""Get current environment name (development, staging, production)."""
		return _detect_environment().value

	@staticmethod
	def is_production() -> bool:
		"""Check if running in production environment."""
		return _detect_environment() == Environment.PRODUCTION

	@staticmethod
	def get_searxng_timeout() -> int:
		"""Get SearXNG request timeout in seconds."""
		return int(os.environ.get("SEARXNG_TIMEOUT", "30"))

	@staticmethod
	def get_firecrawl_timeout() -> int:
		"""Get Firecrawl request timeout in seconds."""
		return int(os.environ.get("FIRECRAWL_TIMEOUT", "60"))

	@staticmethod
	def get_litellm_timeout() -> int:
		"""Get LiteLLM request timeout in seconds."""
		return int(os.environ.get("LITELLM_TIMEOUT", "120"))

	@staticmethod
	def get_docling_timeout() -> int:
		"""Get Docling request timeout in seconds."""
		return int(os.environ.get("DOCLING_TIMEOUT", "300"))

	@staticmethod
	def get_cors_allowed_origins() -> list[str]:
		"""Get CORS allowed origins from environment."""
		origins_env = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
		return [origin.strip() for origin in origins_env.split(",") if origin.strip()]

	@staticmethod
	def get_storage_path() -> str:
		"""Get storage path for documents."""
		return os.environ.get("STORAGE_PATH", "./data/storage")

	@staticmethod
	def get_template_path() -> str:
		"""Get template path."""
		return os.environ.get("TEMPLATE_PATH", "./templates")

	@staticmethod
	def get_output_path() -> str:
		"""Get output path."""
		return os.environ.get("OUTPUT_PATH", "./output")

	@staticmethod
	def get_collaboration_storage_path() -> str:
		"""Get collaboration storage path."""
		return os.environ.get("COLLAB_STORAGE_PATH", "./data/collaboration")

	@staticmethod
	def get_embedding_model() -> str:
		"""Get embedding model name."""
		return os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

	@staticmethod
	def is_embeddings_enabled() -> bool:
		"""Check if embeddings are enabled."""
		return os.environ.get("ENABLE_EMBEDDINGS", "true").lower() in ("true", "1", "yes")

	@staticmethod
	def get_smtp_port_number() -> int:
		"""Get SMTP port as integer (alias for get_smtp_port)."""
		return SecretsManager.get_smtp_port()

	@staticmethod
	def get_persistent_memory_enabled() -> str:
		"""Get persistent memory enabled flag."""
		return os.environ.get("PERSISTENT_MEMORY_ENABLED", "")

	@staticmethod
	def get_latex_engine() -> str:
		"""Get LaTeX engine executable."""
		return os.environ.get("LATEX_ENGINE", "pdflatex")

	@staticmethod
	def get_latex_timeout() -> int:
		"""Get LaTeX compilation timeout in seconds."""
		return int(os.environ.get("LATEX_TIMEOUT", "120"))

	@staticmethod
	def get_latex_cache_dir() -> str:
		"""Get LaTeX output cache directory."""
		return os.environ.get("LATEX_CACHE_DIR", "/tmp/docfusion-latex-cache")

	# ========================================================================
	# Linode E3 Object Storage — env var names match frontend LINODE_E3_*
	# ========================================================================

	@staticmethod
	def get_linode_e3_access_key_id() -> str:
		"""Linode E3 access key ID (LINODE_E3_ACCESS_KEY_ID)."""
		return os.environ.get("LINODE_E3_ACCESS_KEY_ID", "")

	@staticmethod
	def get_linode_e3_secret_access_key() -> str:
		"""Linode E3 secret access key (LINODE_E3_SECRET_ACCESS_KEY)."""
		return os.environ.get("LINODE_E3_SECRET_ACCESS_KEY", "")

	@staticmethod
	def get_linode_e3_endpoint() -> str:
		"""Linode E3 endpoint URL (LINODE_E3_ENDPOINT)."""
		return os.environ.get("LINODE_E3_ENDPOINT", "https://gb-lon-1.linodeobjects.com")

	@staticmethod
	def get_linode_e3_region() -> str:
		"""Linode E3 region (LINODE_E3_REGION)."""
		return os.environ.get("LINODE_E3_REGION", "gb-lon-1")

	@staticmethod
	def get_linode_e3_bucket() -> str:
		"""Linode E3 bucket name (LINODE_E3_BUCKET)."""
		return os.environ.get("LINODE_E3_BUCKET", "docfusion-rfp")

	@staticmethod
	def is_linode_e3_configured() -> bool:
		"""Return True when Linode E3 credentials are present."""
		return bool(
			SecretsManager.get_linode_e3_access_key_id()
			and SecretsManager.get_linode_e3_secret_access_key()
		)

	# ========================================================================
	# Utility Methods
	# ========================================================================

	@staticmethod
	def generate_secret(length: int = 32) -> str:
		"""Generate a cryptographically secure random secret."""
		return secrets.token_urlsafe(length)

	@staticmethod
	def validate_all_secrets() -> dict[str, bool | str]:
		"""
		Validate all secrets and return status.

		Returns:
		    Dict with secret names as keys and status (True if set, error message if missing)
		"""
		results: dict[str, bool | str] = {}

		for secret_key, config in SecretsManager._SECRETS.items():
			try:
				value = SecretsManager._get_secret(secret_key)
				if value:
					results[secret_key] = True
				elif config.required_in_production and _is_strict_mode():
					results[secret_key] = f"MISSING: Set {config.env_var}"
				else:
					results[secret_key] = True  # Has default or not required
			except ValueError as e:
				results[secret_key] = str(e)

		return results

	@staticmethod
	def get_secrets_summary() -> dict[str, str]:
		"""
		Get a summary of secrets status (without revealing values).

		Returns:
		    Dict with secret names and their configured status
		"""
		summary: dict[str, str] = {}

		for secret_key, config in SecretsManager._SECRETS.items():
			value = os.environ.get(config.env_var)
			if value:
				# Show that secret is configured (masked)
				summary[secret_key] = f"configured ({len(value)} chars)"
			elif config.development_default is not None:
				summary[secret_key] = "using development default"
			else:
				summary[secret_key] = "not configured"

		return summary


# Convenience functions for backward compatibility
def get_jwt_secret() -> str:
	"""Get JWT secret. Convenience wrapper for SecretsManager.get_jwt_secret()."""
	return SecretsManager.get_jwt_secret()


def get_encryption_key() -> Optional[str]:
	"""Get encryption key. Convenience wrapper for SecretsManager.get_encryption_key()."""
	return SecretsManager.get_encryption_key()


def get_litellm_key() -> str:
	"""Get LiteLLM key. Convenience wrapper for SecretsManager.get_litellm_key()."""
	return SecretsManager.get_litellm_key()
