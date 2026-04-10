#!/usr/bin/env python3
"""
Authentication Middleware

FastAPI middleware for JWT token validation, API key authentication,
and session management with comprehensive security integration.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

import aioredis
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from ...security import APIAuthentication, SecurityManager, UserAuthentication
from ...config.secrets import SecretsManager
from ...core.utils import uuid7str

class AuthenticationMiddleware:
    """Authentication middleware with JWT and API key support"""

    def __init__(self, security_manager: SecurityManager):
        self.security = security_manager
        self.logger = logging.getLogger(__name__)

        # Security schemes
        self.bearer_scheme = HTTPBearer(auto_error=False)
        self.api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

        # Configuration - use centralized secrets management
        jwt_secret = SecretsManager.get_jwt_secret()
        if not jwt_secret:
            raise RuntimeError(
                "JWT_SECRET environment variable is required in production. "
                "Set the environment variable or run in development mode. "
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
            )
        self.jwt_secret = jwt_secret
        self.jwt_algorithm = "HS256"
        self.jwt_expiration_minutes = 60

        # Session storage (in production, use Redis or database)
        self.active_sessions: Dict[str, Dict[str, Any]] = {}

        self.logger.info("Authentication middleware initialized")

    async def __call__(self, request: Request, call_next: Callable):
        """Process request through authentication middleware"""
        try:
            # Skip authentication for certain paths
            if self._should_skip_auth(request.url.path):
                response = await call_next(request)
                return response

            # Extract authentication info
            auth_info = await self._extract_auth_info(request)

            if not auth_info:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Validate authentication
            user_info = await self._validate_authentication(auth_info, request)

            if not user_info:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials",
                )

            # Add user info to request state
            request.state.user = user_info

            # Process request
            response = await call_next(request)

            # Update session activity
            await self._update_session_activity(user_info.get("session_id"))

            return response

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Authentication middleware error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication service error",
            )

    async def _extract_auth_info(self, request: Request) -> Optional[Dict[str, Any]]:
        """Extract authentication information from request"""
        # Try Bearer token first
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            return {"type": "jwt", "token": token}

        # Try API key
        api_key = request.headers.get("X-API-Key")
        if api_key:
            return {"type": "api_key", "key": api_key}

        # Try session cookie
        session_id = request.cookies.get("session_id")
        if session_id:
            return {"type": "session", "session_id": session_id}

        return None

    async def _validate_authentication(
        self, auth_info: Dict[str, Any], request: Request
    ) -> Optional[Dict[str, Any]]:
        """Validate authentication and return user info"""
        try:
            if auth_info["type"] == "jwt":
                return await self._validate_jwt_token(auth_info["token"], request)

            elif auth_info["type"] == "api_key":
                return await self._validate_api_key(auth_info["key"], request)

            elif auth_info["type"] == "session":
                return await self._validate_session(auth_info["session_id"], request)

            return None

        except Exception as e:
            self.logger.error(f"Authentication validation error: {e}")
            return None

    async def _validate_jwt_token(
        self, token: str, request: Request
    ) -> Optional[Dict[str, Any]]:
        """Validate JWT token and extract user info"""
        try:
            # Decode JWT token
            payload = jwt.decode(
                token, self.jwt_secret, algorithms=[self.jwt_algorithm]
            )

            user_id = payload.get("sub")
            session_id = payload.get("session_id")

            if not user_id:
                return None

            # Check if token is not expired
            exp = payload.get("exp")
            if exp and datetime.utcnow().timestamp() > exp:
                return None

            # Get user permissions from security manager
            permissions = await self.security.rbac.get_user_permissions(user_id)

            return {
                "user_id": user_id,
                "session_id": session_id,
                "auth_type": "jwt",
                "permissions": permissions,
                "ip_address": self._get_client_ip(request),
                "user_agent": request.headers.get("User-Agent"),
                "authenticated_at": datetime.utcnow(),
                "token_payload": payload,
            }

        except JWTError as e:
            self.logger.warning(f"Invalid JWT token: {e}")
            return None
        except Exception as e:
            self.logger.error(f"JWT validation error: {e}")
            return None

    async def _validate_api_key(
        self, api_key: str, request: Request
    ) -> Optional[Dict[str, Any]]:
        """Validate API key and extract user info"""
        try:
            # Authenticate API key using security manager
            result = await self.security.authenticate_api_request(
                api_key=api_key,
                ip_address=self._get_client_ip(request),
                user_agent=request.headers.get("User-Agent"),
                endpoint=str(request.url.path),
                method=request.method,
            )

            if not result.success:
                return None

            # Get user permissions
            permissions = await self.security.rbac.get_user_permissions(result.user_id)

            return {
                "user_id": result.user_id,
                "session_id": f"api_key_{uuid7str()}",
                "auth_type": "api_key",
                "permissions": permissions,
                "ip_address": self._get_client_ip(request),
                "user_agent": request.headers.get("User-Agent"),
                "authenticated_at": datetime.utcnow(),
                "api_key_info": {
                    "key_id": result.api_key_id,
                    "rate_limited": result.rate_limited,
                    "remaining_requests": result.remaining_requests,
                },
            }

        except Exception as e:
            self.logger.error(f"API key validation error: {e}")
            return None

    async def _validate_session(
        self, session_id: str, request: Request
    ) -> Optional[Dict[str, Any]]:
        """Validate session and extract user info"""
        try:
            # Check active sessions
            if session_id not in self.active_sessions:
                return None

            session = self.active_sessions[session_id]

            # Check session expiration
            if session["expires_at"] < datetime.utcnow():
                del self.active_sessions[session_id]
                return None

            # Get user permissions
            permissions = await self.security.rbac.get_user_permissions(
                session["user_id"]
            )

            return {
                "user_id": session["user_id"],
                "session_id": session_id,
                "auth_type": "session",
                "permissions": permissions,
                "ip_address": self._get_client_ip(request),
                "user_agent": request.headers.get("User-Agent"),
                "authenticated_at": session["authenticated_at"],
                "session_info": session,
            }

        except Exception as e:
            self.logger.error(f"Session validation error: {e}")
            return None

    def _should_skip_auth(self, path: str) -> bool:
        """Check if path should skip authentication"""
        skip_paths = [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/health",
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/forgot-password",
        ]

        return any(path.startswith(skip_path) for skip_path in skip_paths)

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request"""
        # Check for forwarded headers first
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # Fall back to client host
        if request.client:
            return request.client.host

        return "unknown"

    async def _update_session_activity(self, session_id: Optional[str]):
        """Update session last activity timestamp"""
        if session_id and session_id in self.active_sessions:
            self.active_sessions[session_id]["last_activity"] = datetime.utcnow()

    # ==================== SESSION MANAGEMENT ====================

    async def create_session(
        self,
        user_id: str,
        auth_method: str = "password",
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create new user session"""
        session_id = uuid7str()
        session = {
            "session_id": session_id,
            "user_id": user_id,
            "auth_method": auth_method,
            "authenticated_at": datetime.utcnow(),
            "last_activity": datetime.utcnow(),
            "expires_at": datetime.utcnow().replace(
                minute=datetime.utcnow().minute + self.jwt_expiration_minutes
            ),
            "ip_address": ip_address,
            "user_agent": user_agent,
            "is_active": True,
        }

        self.active_sessions[session_id] = session
        return session

    async def invalidate_session(self, session_id: str) -> bool:
        """Invalidate user session"""
        if session_id in self.active_sessions:
            del self.active_sessions[session_id]
            return True
        return False

    async def create_jwt_token(self, user_id: str, session_id: str) -> str:
        """Create JWT token for user session"""
        payload = {
            "sub": user_id,
            "session_id": session_id,
            "iat": datetime.utcnow().timestamp(),
            "exp": datetime.utcnow().timestamp() + (self.jwt_expiration_minutes * 60),
            "type": "access_token",
        }

        return jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)

    async def cleanup_expired_sessions(self):
        """Clean up expired sessions"""
        now = datetime.utcnow()
        expired_sessions = []

        for session_id, session in self.active_sessions.items():
            if session["expires_at"] < now:
                expired_sessions.append(session_id)

        for session_id in expired_sessions:
            del self.active_sessions[session_id]

        self.logger.info(f"Cleaned up {len(expired_sessions)} expired sessions")

# Dependency functions for FastAPI
auth_middleware: Optional[AuthenticationMiddleware] = None

def initialize_auth_middleware(
    security_manager: SecurityManager,
) -> AuthenticationMiddleware:
    """Initialize authentication middleware"""
    global auth_middleware
    auth_middleware = AuthenticationMiddleware(security_manager)
    return auth_middleware

async def get_current_user(request: Request) -> Dict[str, Any]:
    """FastAPI dependency to get current authenticated user"""
    if not hasattr(request.state, "user") or not request.state.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )

    return request.state.user

async def get_current_user_optional(request: Request) -> Optional[Dict[str, Any]]:
    """FastAPI dependency to get current user if authenticated"""
    return getattr(request.state, "user", None)

async def get_api_key_user(
    api_key: str = Depends(APIKeyHeader(name="X-API-Key")),
) -> Dict[str, Any]:
    """FastAPI dependency for API key authentication"""
    if not auth_middleware:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication not initialized",
        )

    # Create dummy request for validation
    class DummyRequest:
        def __init__(self):
            self.headers = {"X-API-Key": api_key}
            self.method = "GET"
            self.url = type("URL", (), {"path": "/api/v1"})()
            self.client = None

    request = DummyRequest()

    auth_info = {"type": "api_key", "key": api_key}
    user_info = await auth_middleware._validate_authentication(auth_info, request)

    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key"
        )

    return user_info

def require_permission(required_permission: str):
    """Decorator to require specific permission"""

    def decorator(func):
        async def wrapper(
            *args, current_user: Dict[str, Any] = Depends(get_current_user), **kwargs
        ):
            user_permissions = current_user.get("permissions", {})
            user_roles = [
                role["role_name"] for role in user_permissions.get("roles", [])
            ]

            # Check if user has required permission
            has_permission = False
            for role in user_permissions.get("roles", []):
                role_permissions = role.get("permissions", [])
                if any(
                    perm["name"] == required_permission for perm in role_permissions
                ):
                    has_permission = True
                    break

            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission '{required_permission}' required",
                )

            return await func(*args, current_user=current_user, **kwargs)

        return wrapper

    return decorator

def require_role(required_role: str):
    """Decorator to require specific role"""

    def decorator(func):
        async def wrapper(
            *args, current_user: Dict[str, Any] = Depends(get_current_user), **kwargs
        ):
            user_permissions = current_user.get("permissions", {})
            user_roles = [
                role["role_name"] for role in user_permissions.get("roles", [])
            ]

            if required_role not in user_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Role '{required_role}' required",
                )

            return await func(*args, current_user=current_user, **kwargs)

        return wrapper

    return decorator

# Factory function
def create_authentication_middleware(
    security_manager: SecurityManager,
) -> AuthenticationMiddleware:
    """Create AuthenticationMiddleware instance"""
    return AuthenticationMiddleware(security_manager)
