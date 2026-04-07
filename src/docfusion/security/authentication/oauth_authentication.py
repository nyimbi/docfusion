#!/usr/bin/env python3
"""
OAuth 2.0 Authentication Module

Implements OAuth 2.0 authentication with support for multiple providers
(Google, Microsoft, GitHub) including token management and security validation.
"""

import asyncio
import base64
import hashlib
import logging
import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from urllib.parse import parse_qs, urlencode, urlparse

import aiohttp
import jwt
from pydantic import BaseModel, Field
from uuid_extensions import uuid7str

from ...config.secrets import SecretsManager


class OAuthProvider(str, Enum):
    """Supported OAuth 2.0 providers"""

    GOOGLE = "google"
    MICROSOFT = "microsoft"
    GITHUB = "github"


class OAuthGrantType(str, Enum):
    """OAuth 2.0 grant types"""

    AUTHORIZATION_CODE = "authorization_code"
    REFRESH_TOKEN = "refresh_token"
    CLIENT_CREDENTIALS = "client_credentials"


class OAuthTokenType(str, Enum):
    """OAuth token types"""

    BEARER = "Bearer"
    MAC = "MAC"


@dataclass
class OAuthProviderConfig:
    """Configuration for OAuth 2.0 provider"""

    provider: OAuthProvider
    client_id: str
    client_secret: str
    authorization_endpoint: str
    token_endpoint: str
    userinfo_endpoint: str
    scope: str = "openid profile email"
    redirect_uri: str = ""

    # Provider-specific settings
    audience: Optional[str] = None  # For Microsoft
    tenant_id: Optional[str] = None  # For Microsoft

    # Security settings
    enable_pkce: bool = True
    token_endpoint_auth_method: str = "client_secret_post"  # or client_secret_basic

    # Validation settings
    verify_ssl: bool = True
    timeout_seconds: int = 30


@dataclass
class OAuthConfiguration:
    """OAuth 2.0 system configuration"""

    providers: Dict[OAuthProvider, OAuthProviderConfig] = field(default_factory=dict)

    # Security settings
    state_expiry_minutes: int = 10
    code_verifier_length: int = 128
    enable_token_introspection: bool = True

    # Session management
    access_token_expiry_minutes: int = 60
    refresh_token_expiry_days: int = 30

    # Rate limiting
    auth_rate_limit_per_hour: int = 100
    token_rate_limit_per_hour: int = 500


class OAuthState(BaseModel):
    """OAuth state for CSRF protection"""

    state_id: str = Field(default_factory=uuid7str)
    provider: OAuthProvider
    redirect_uri: str
    code_verifier: Optional[str] = None  # For PKCE
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime
    user_id: Optional[str] = None
    client_info: Dict[str, Any] = Field(default_factory=dict)


class OAuthToken(BaseModel):
    """OAuth token information"""

    token_id: str = Field(default_factory=uuid7str)
    provider: OAuthProvider
    user_id: str
    access_token: str
    refresh_token: Optional[str] = None
    token_type: OAuthTokenType = OAuthTokenType.BEARER
    expires_at: datetime
    scope: str

    # Token metadata
    issued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_used: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # User information from provider
    provider_user_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None

    # Security
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None


class OAuthUserInfo(BaseModel):
    """User information from OAuth provider"""

    provider: OAuthProvider
    provider_user_id: str
    email: str
    name: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    picture: Optional[str] = None
    locale: Optional[str] = None
    email_verified: bool = False

    # Provider-specific fields
    raw_data: Dict[str, Any] = Field(default_factory=dict)


class OAuthResult(BaseModel):
    """OAuth authentication result"""

    success: bool
    provider: Optional[OAuthProvider] = None
    user_info: Optional[OAuthUserInfo] = None
    token: Optional[OAuthToken] = None
    error: Optional[str] = None
    error_description: Optional[str] = None

    # Additional metadata
    authentication_time: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    requires_linking: bool = False  # If account needs to be linked to existing user


class OAuthAuthentication:
    """OAuth 2.0 authentication manager"""

    def __init__(self, config: Optional[OAuthConfiguration] = None):
        """Initialize OAuth authentication manager"""
        self.config = config or OAuthConfiguration()
        self.logger = logging.getLogger(__name__)

        # State storage (in production, use Redis or database)
        self.oauth_states: Dict[str, OAuthState] = {}
        self.oauth_tokens: Dict[str, OAuthToken] = {}

        # Provider configurations
        self._setup_default_providers()

        # Rate limiting (simplified implementation)
        self.auth_attempts: Dict[str, List[datetime]] = {}
        self.token_requests: Dict[str, List[datetime]] = {}

        self.logger.info(
            f"OAuth authentication initialized with {len(self.config.providers)} providers"
        )

    def _setup_default_providers(self):
        """Set up default provider configurations using centralized secrets management."""
        if OAuthProvider.GOOGLE not in self.config.providers:
            self.config.providers[OAuthProvider.GOOGLE] = OAuthProviderConfig(
                provider=OAuthProvider.GOOGLE,
                client_id=SecretsManager.get_google_client_id(),
                client_secret=SecretsManager.get_google_client_secret(),
                authorization_endpoint="https://accounts.google.com/o/oauth2/v2/auth",
                token_endpoint="https://oauth2.googleapis.com/token",
                userinfo_endpoint="https://www.googleapis.com/oauth2/v2/userinfo",
                scope="openid profile email",
            )

        if OAuthProvider.MICROSOFT not in self.config.providers:
            self.config.providers[OAuthProvider.MICROSOFT] = OAuthProviderConfig(
                provider=OAuthProvider.MICROSOFT,
                client_id=SecretsManager.get_microsoft_client_id(),
                client_secret=SecretsManager.get_microsoft_client_secret(),
                authorization_endpoint="https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
                token_endpoint="https://login.microsoftonline.com/common/oauth2/v2.0/token",
                userinfo_endpoint="https://graph.microsoft.com/v1.0/me",
                scope="openid profile email User.Read",
            )

        if OAuthProvider.GITHUB not in self.config.providers:
            self.config.providers[OAuthProvider.GITHUB] = OAuthProviderConfig(
                provider=OAuthProvider.GITHUB,
                client_id=SecretsManager.get_github_client_id(),
                client_secret=SecretsManager.get_github_client_secret(),
                authorization_endpoint="https://github.com/login/oauth/authorize",
                token_endpoint="https://github.com/login/oauth/access_token",
                userinfo_endpoint="https://api.github.com/user",
                scope="user:email",
            )

    def get_authorization_url(
        self,
        provider: OAuthProvider,
        redirect_uri: str,
        user_id: Optional[str] = None,
        client_ip: Optional[str] = None,
    ) -> str:
        """Generate OAuth authorization URL with PKCE"""
        provider_config = self.config.providers.get(provider)
        if not provider_config:
            raise ValueError(f"Provider {provider} not configured")

        # Check rate limiting
        if not self._check_auth_rate_limit(client_ip or "unknown"):
            raise ValueError("Rate limit exceeded for authentication requests")

        # Generate state and PKCE parameters
        state = self._create_oauth_state(provider, redirect_uri, user_id, client_ip)
        code_verifier = None
        code_challenge = None

        if provider_config.enable_pkce:
            code_verifier = (
                base64.urlsafe_b64encode(secrets.token_bytes(96))
                .decode("utf-8")
                .rstrip("=")
            )
            state.code_verifier = code_verifier

            code_challenge = (
                base64.urlsafe_b64encode(
                    hashlib.sha256(code_verifier.encode("utf-8")).digest()
                )
                .decode("utf-8")
                .rstrip("=")
            )

        # Store state
        self.oauth_states[state.state_id] = state

        # Build authorization URL
        auth_params = {
            "response_type": "code",
            "client_id": provider_config.client_id,
            "redirect_uri": redirect_uri,
            "scope": provider_config.scope,
            "state": state.state_id,
        }

        # Add PKCE parameters
        if provider_config.enable_pkce and code_challenge:
            auth_params["code_challenge"] = code_challenge
            auth_params["code_challenge_method"] = "S256"

        # Provider-specific parameters
        if provider == OAuthProvider.MICROSOFT and provider_config.tenant_id:
            # Replace 'common' with specific tenant
            auth_endpoint = provider_config.authorization_endpoint.replace(
                "/common/", f"/{provider_config.tenant_id}/"
            )
        else:
            auth_endpoint = provider_config.authorization_endpoint

        return f"{auth_endpoint}?{urlencode(auth_params)}"

    async def handle_authorization_callback(
        self,
        provider: OAuthProvider,
        code: str,
        state: str,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> OAuthResult:
        """Handle OAuth authorization callback"""
        try:
            # Validate state
            oauth_state = self.oauth_states.get(state)
            if not oauth_state:
                return OAuthResult(
                    success=False,
                    error="invalid_state",
                    error_description="Invalid or expired state parameter",
                )

            # Check state expiry
            if datetime.now(timezone.utc) > oauth_state.expires_at:
                del self.oauth_states[state]
                return OAuthResult(
                    success=False,
                    error="expired_state",
                    error_description="State parameter has expired",
                )

            # Validate provider matches
            if oauth_state.provider != provider:
                return OAuthResult(
                    success=False,
                    error="provider_mismatch",
                    error_description="Provider mismatch in state",
                )

            # Exchange code for token
            token_result = await self._exchange_code_for_token(
                provider, code, oauth_state, client_ip, user_agent
            )

            if not token_result.success:
                return token_result

            # Get user information
            user_info = await self._get_user_info(
                provider, token_result.token.access_token
            )
            if not user_info:
                return OAuthResult(
                    success=False,
                    error="userinfo_failed",
                    error_description="Failed to retrieve user information",
                )

            # Update token with user info
            token_result.token.provider_user_id = user_info.provider_user_id
            token_result.token.email = user_info.email
            token_result.token.name = user_info.name
            token_result.token.picture = user_info.picture

            # Store token
            self.oauth_tokens[token_result.token.token_id] = token_result.token

            # Clean up state
            del self.oauth_states[state]

            return OAuthResult(
                success=True,
                provider=provider,
                user_info=user_info,
                token=token_result.token,
            )

        except Exception as e:
            self.logger.error(f"OAuth callback error: {e}")
            return OAuthResult(
                success=False, error="callback_error", error_description=str(e)
            )

    async def refresh_access_token(self, token_id: str) -> OAuthResult:
        """Refresh OAuth access token"""
        token = self.oauth_tokens.get(token_id)
        if not token or not token.refresh_token:
            return OAuthResult(
                success=False,
                error="invalid_token",
                error_description="Token not found or no refresh token",
            )

        provider_config = self.config.providers.get(token.provider)
        if not provider_config:
            return OAuthResult(
                success=False,
                error="provider_not_configured",
                error_description=f"Provider {token.provider} not configured",
            )

        # Prepare refresh request
        refresh_data = {
            "grant_type": OAuthGrantType.REFRESH_TOKEN,
            "refresh_token": token.refresh_token,
            "client_id": provider_config.client_id,
            "client_secret": provider_config.client_secret,
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    provider_config.token_endpoint,
                    data=refresh_data,
                    headers={"Accept": "application/json"},
                ) as response:
                    result = await response.json()

                    if response.status == 200 and "access_token" in result:
                        # Update token
                        token.access_token = result["access_token"]
                        if "refresh_token" in result:
                            token.refresh_token = result["refresh_token"]

                        # Update expiry
                        expires_in = result.get("expires_in", 3600)
                        token.expires_at = datetime.now(timezone.utc) + timedelta(
                            seconds=expires_in
                        )
                        token.last_used = datetime.now(timezone.utc)

                        return OAuthResult(
                            success=True, provider=token.provider, token=token
                        )
                    else:
                        return OAuthResult(
                            success=False,
                            error=result.get("error", "refresh_failed"),
                            error_description=result.get(
                                "error_description", "Token refresh failed"
                            ),
                        )

        except Exception as e:
            self.logger.error(f"Token refresh error: {e}")
            return OAuthResult(
                success=False, error="refresh_error", error_description=str(e)
            )

    async def validate_token(self, token_id: str) -> bool:
        """Validate OAuth token"""
        token = self.oauth_tokens.get(token_id)
        if not token:
            return False

        # Check expiry
        if datetime.now(timezone.utc) >= token.expires_at:
            return False

        # Update last used
        token.last_used = datetime.now(timezone.utc)

        return True

    async def revoke_token(self, token_id: str) -> bool:
        """Revoke OAuth token"""
        token = self.oauth_tokens.get(token_id)
        if not token:
            return False

        provider_config = self.config.providers.get(token.provider)
        if not provider_config:
            return False

        # Try to revoke at provider (if supported)
        try:
            # Note: Implementation would depend on provider's revocation endpoint
            pass
        except Exception as e:
            self.logger.warning(f"Failed to revoke token at provider: {e}")

        # Remove from local storage
        del self.oauth_tokens[token_id]
        return True

    def _create_oauth_state(
        self,
        provider: OAuthProvider,
        redirect_uri: str,
        user_id: Optional[str],
        client_ip: Optional[str],
    ) -> OAuthState:
        """Create OAuth state for CSRF protection"""
        expiry = datetime.now(timezone.utc) + timedelta(
            minutes=self.config.state_expiry_minutes
        )

        return OAuthState(
            provider=provider,
            redirect_uri=redirect_uri,
            expires_at=expiry,
            user_id=user_id,
            client_info={"ip": client_ip} if client_ip else {},
        )

    async def _exchange_code_for_token(
        self,
        provider: OAuthProvider,
        code: str,
        oauth_state: OAuthState,
        client_ip: Optional[str],
        user_agent: Optional[str],
    ) -> OAuthResult:
        """Exchange authorization code for access token"""
        provider_config = self.config.providers.get(provider)
        if not provider_config:
            return OAuthResult(success=False, error="provider_not_configured")

        # Check token request rate limit
        if not self._check_token_rate_limit(client_ip or "unknown"):
            return OAuthResult(
                success=False,
                error="rate_limit_exceeded",
                error_description="Too many token requests",
            )

        # Prepare token request
        token_data = {
            "grant_type": OAuthGrantType.AUTHORIZATION_CODE,
            "code": code,
            "redirect_uri": oauth_state.redirect_uri,
            "client_id": provider_config.client_id,
        }

        # Add client secret based on auth method
        if provider_config.token_endpoint_auth_method == "client_secret_post":
            token_data["client_secret"] = provider_config.client_secret

        # Add PKCE verifier
        if provider_config.enable_pkce and oauth_state.code_verifier:
            token_data["code_verifier"] = oauth_state.code_verifier

        try:
            headers = {"Accept": "application/json"}

            # Handle client_secret_basic auth
            if provider_config.token_endpoint_auth_method == "client_secret_basic":
                auth_string = (
                    f"{provider_config.client_id}:{provider_config.client_secret}"
                )
                encoded_auth = base64.b64encode(auth_string.encode()).decode()
                headers["Authorization"] = f"Basic {encoded_auth}"

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    provider_config.token_endpoint,
                    data=token_data,
                    headers=headers,
                    timeout=provider_config.timeout_seconds,
                ) as response:
                    result = await response.json()

                    if response.status == 200 and "access_token" in result:
                        # Create token object
                        expires_in = result.get("expires_in", 3600)
                        expires_at = datetime.now(timezone.utc) + timedelta(
                            seconds=expires_in
                        )

                        token = OAuthToken(
                            provider=provider,
                            user_id=oauth_state.user_id or "unknown",
                            access_token=result["access_token"],
                            refresh_token=result.get("refresh_token"),
                            token_type=OAuthTokenType(
                                result.get("token_type", "Bearer")
                            ),
                            expires_at=expires_at,
                            scope=result.get("scope", provider_config.scope),
                            provider_user_id="",  # Will be filled from userinfo
                            client_ip=client_ip,
                            user_agent=user_agent,
                        )

                        return OAuthResult(success=True, provider=provider, token=token)
                    else:
                        return OAuthResult(
                            success=False,
                            error=result.get("error", "token_exchange_failed"),
                            error_description=result.get(
                                "error_description", "Failed to exchange code for token"
                            ),
                        )

        except Exception as e:
            self.logger.error(f"Token exchange error: {e}")
            return OAuthResult(
                success=False, error="exchange_error", error_description=str(e)
            )

    async def _get_user_info(
        self, provider: OAuthProvider, access_token: str
    ) -> Optional[OAuthUserInfo]:
        """Get user information from OAuth provider"""
        provider_config = self.config.providers.get(provider)
        if not provider_config:
            return None

        try:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            }

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    provider_config.userinfo_endpoint,
                    headers=headers,
                    timeout=provider_config.timeout_seconds,
                ) as response:
                    if response.status == 200:
                        user_data = await response.json()
                        return self._parse_user_info(provider, user_data)

        except Exception as e:
            self.logger.error(f"Failed to get user info: {e}")

        return None

    def _parse_user_info(
        self, provider: OAuthProvider, user_data: Dict[str, Any]
    ) -> OAuthUserInfo:
        """Parse user information based on provider"""
        if provider == OAuthProvider.GOOGLE:
            return OAuthUserInfo(
                provider=provider,
                provider_user_id=user_data.get("id", ""),
                email=user_data.get("email", ""),
                name=user_data.get("name"),
                given_name=user_data.get("given_name"),
                family_name=user_data.get("family_name"),
                picture=user_data.get("picture"),
                locale=user_data.get("locale"),
                email_verified=user_data.get("verified_email", False),
                raw_data=user_data,
            )

        elif provider == OAuthProvider.MICROSOFT:
            return OAuthUserInfo(
                provider=provider,
                provider_user_id=user_data.get("id", ""),
                email=user_data.get("mail") or user_data.get("userPrincipalName", ""),
                name=user_data.get("displayName"),
                given_name=user_data.get("givenName"),
                family_name=user_data.get("surname"),
                locale=user_data.get("preferredLanguage"),
                email_verified=True,  # Microsoft emails are typically verified
                raw_data=user_data,
            )

        elif provider == OAuthProvider.GITHUB:
            return OAuthUserInfo(
                provider=provider,
                provider_user_id=str(user_data.get("id", "")),
                email=user_data.get("email", ""),
                name=user_data.get("name"),
                picture=user_data.get("avatar_url"),
                email_verified=True,  # GitHub requires verified email for OAuth
                raw_data=user_data,
            )

        else:
            # Generic parser
            return OAuthUserInfo(
                provider=provider,
                provider_user_id=user_data.get("id", ""),
                email=user_data.get("email", ""),
                name=user_data.get("name"),
                raw_data=user_data,
            )

    def _check_auth_rate_limit(self, identifier: str) -> bool:
        """Check authentication rate limit"""
        now = datetime.now(timezone.utc)
        hour_ago = now - timedelta(hours=1)

        # Clean old attempts
        if identifier in self.auth_attempts:
            self.auth_attempts[identifier] = [
                attempt
                for attempt in self.auth_attempts[identifier]
                if attempt > hour_ago
            ]
        else:
            self.auth_attempts[identifier] = []

        # Check limit
        if len(self.auth_attempts[identifier]) >= self.config.auth_rate_limit_per_hour:
            return False

        # Record attempt
        self.auth_attempts[identifier].append(now)
        return True

    def _check_token_rate_limit(self, identifier: str) -> bool:
        """Check token request rate limit"""
        now = datetime.now(timezone.utc)
        hour_ago = now - timedelta(hours=1)

        # Clean old requests
        if identifier in self.token_requests:
            self.token_requests[identifier] = [
                request
                for request in self.token_requests[identifier]
                if request > hour_ago
            ]
        else:
            self.token_requests[identifier] = []

        # Check limit
        if (
            len(self.token_requests[identifier])
            >= self.config.token_rate_limit_per_hour
        ):
            return False

        # Record request
        self.token_requests[identifier].append(now)
        return True

    async def cleanup_expired_tokens(self) -> int:
        """Clean up expired tokens"""
        now = datetime.now(timezone.utc)
        expired_tokens = []

        for token_id, token in self.oauth_tokens.items():
            if now >= token.expires_at:
                expired_tokens.append(token_id)

        for token_id in expired_tokens:
            del self.oauth_tokens[token_id]

        return len(expired_tokens)

    async def cleanup_expired_states(self) -> int:
        """Clean up expired OAuth states"""
        now = datetime.now(timezone.utc)
        expired_states = []

        for state_id, state in self.oauth_states.items():
            if now >= state.expires_at:
                expired_states.append(state_id)

        for state_id in expired_states:
            del self.oauth_states[state_id]

        return len(expired_states)

    async def get_token_info(self, token_id: str) -> Optional[Dict[str, Any]]:
        """Get token information"""
        token = self.oauth_tokens.get(token_id)
        if not token:
            return None

        return {
            "token_id": token.token_id,
            "provider": token.provider,
            "user_id": token.user_id,
            "expires_at": token.expires_at.isoformat(),
            "scope": token.scope,
            "email": token.email,
            "name": token.name,
            "last_used": token.last_used.isoformat(),
            "is_expired": datetime.now(timezone.utc) >= token.expires_at,
        }

    async def get_user_tokens(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all tokens for a user"""
        user_tokens = []

        for token in self.oauth_tokens.values():
            if token.user_id == user_id:
                user_tokens.append(
                    {
                        "token_id": token.token_id,
                        "provider": token.provider,
                        "expires_at": token.expires_at.isoformat(),
                        "last_used": token.last_used.isoformat(),
                        "is_expired": datetime.now(timezone.utc) >= token.expires_at,
                    }
                )

        return user_tokens


# Factory functions
def create_oauth_authentication(
    config: Optional[OAuthConfiguration] = None,
) -> OAuthAuthentication:
    """Create OAuthAuthentication instance"""
    return OAuthAuthentication(config)


def create_oauth_config_from_env() -> OAuthConfiguration:
    """Create OAuth configuration from environment variables"""
    import os

    config = OAuthConfiguration()

    # Google configuration
    google_client_id = os.getenv("GOOGLE_CLIENT_ID")
    google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    if google_client_id and google_client_secret:
        config.providers[OAuthProvider.GOOGLE].client_id = google_client_id
        config.providers[OAuthProvider.GOOGLE].client_secret = google_client_secret

    # Microsoft configuration
    microsoft_client_id = os.getenv("MICROSOFT_CLIENT_ID")
    microsoft_client_secret = os.getenv("MICROSOFT_CLIENT_SECRET")
    if microsoft_client_id and microsoft_client_secret:
        config.providers[OAuthProvider.MICROSOFT].client_id = microsoft_client_id
        config.providers[
            OAuthProvider.MICROSOFT
        ].client_secret = microsoft_client_secret

    # GitHub configuration
    github_client_id = os.getenv("GITHUB_CLIENT_ID")
    github_client_secret = os.getenv("GITHUB_CLIENT_SECRET")
    if github_client_id and github_client_secret:
        config.providers[OAuthProvider.GITHUB].client_id = github_client_id
        config.providers[OAuthProvider.GITHUB].client_secret = github_client_secret

    return config
