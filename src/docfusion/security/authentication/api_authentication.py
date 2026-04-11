#!/usr/bin/env python3
"""
API Authentication Module

Provides secure API authentication with API key management, JWT token handling,
rate limiting, and API security features.
"""

import asyncio
import hashlib
import hmac
import logging
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union

# JWT handling
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError

# Pydantic models
from pydantic import BaseModel, ConfigDict, Field
from ...core.utils import uuid7str

class APIKeyStatus(Enum):
    """API key status enumeration"""

    ACTIVE = "active"
    SUSPENDED = "suspended"
    EXPIRED = "expired"
    REVOKED = "revoked"

class APIPermissionLevel(Enum):
    """API permission levels"""

    READ_ONLY = "read_only"
    READ_WRITE = "read_write"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

class RateLimitScope(Enum):
    """Rate limiting scope"""

    PER_KEY = "per_key"
    PER_IP = "per_ip"
    PER_USER = "per_user"
    GLOBAL = "global"

class APIKey(BaseModel):
    """API key model"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    key_id: str = Field(default_factory=uuid7str)
    key_hash: str
    key_prefix: str  # First 8 characters for identification
    name: str
    description: Optional[str] = None

    # Ownership and permissions
    user_id: str
    permission_level: APIPermissionLevel = APIPermissionLevel.READ_ONLY
    scopes: List[str] = Field(default_factory=list)
    allowed_ips: List[str] = Field(default_factory=list)

    # Status and lifecycle
    status: APIKeyStatus = APIKeyStatus.ACTIVE
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None

    # Usage tracking
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0

    # Rate limiting
    rate_limit_requests: int = 1000  # Per hour
    rate_limit_window_seconds: int = 3600

class APIKeyResult(BaseModel):
    """Result of API key operations"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    success: bool
    key_id: Optional[str] = None
    api_key: Optional[str] = None  # Only returned on creation
    error_message: Optional[str] = None
    rate_limited: bool = False
    remaining_requests: Optional[int] = None
    reset_time: Optional[datetime] = None

@dataclass
class APIAuthenticationConfig:
    """Configuration for API authentication"""

    # API key settings
    key_length: int = 32
    key_prefix_length: int = 8
    default_expiry_days: int = 365
    max_keys_per_user: int = 10

    # JWT settings for API tokens
    jwt_secret_key: str = Field(default_factory=lambda: secrets.token_urlsafe(32))
    jwt_algorithm: str = "HS256"
    token_expiry_hours: int = 24

    # Rate limiting
    default_rate_limit: int = 1000  # Per hour
    rate_limit_window: int = 3600  # 1 hour in seconds
    burst_allowance: int = 10  # Burst requests allowed

    # Security
    require_https: bool = True
    log_all_requests: bool = True
    block_suspicious_ips: bool = True

class APIAuthentication:
    """API authentication system with key management and rate limiting"""

    def __init__(self, config: Optional[APIAuthenticationConfig] = None):
        """Initialize API authentication system"""
        self.config = config or APIAuthenticationConfig()
        self.logger = logging.getLogger(__name__)

        # In-memory storage (replace with database in production)
        self.api_keys: Dict[str, APIKey] = {}
        self.rate_limit_tracker: Dict[str, List[float]] = {}
        self.suspicious_ips: set[str] = set()
        self.request_logs: List[Dict[str, Any]] = []

        # API key hash mapping for fast lookups
        self.key_hash_mapping: Dict[str, str] = {}  # hash -> key_id

        self.logger.info("API authentication system initialized")

    async def create_api_key(
        self,
        user_id: str,
        name: str,
        description: Optional[str] = None,
        permission_level: APIPermissionLevel = APIPermissionLevel.READ_ONLY,
        scopes: Optional[List[str]] = None,
        expires_in_days: Optional[int] = None,
        allowed_ips: Optional[List[str]] = None,
        rate_limit: Optional[int] = None,
    ) -> APIKeyResult:
        """Create a new API key for a user"""
        try:
            # Check if user has reached key limit
            user_keys = [
                key
                for key in self.api_keys.values()
                if key.user_id == user_id and key.status == APIKeyStatus.ACTIVE
            ]
            if len(user_keys) >= self.config.max_keys_per_user:
                return APIKeyResult(
                    success=False,
                    error_message=f"Maximum number of API keys ({self.config.max_keys_per_user}) reached",
                )

            # Generate secure API key
            raw_key = secrets.token_urlsafe(self.config.key_length)
            key_prefix = raw_key[: self.config.key_prefix_length]
            key_hash = self._hash_api_key(raw_key)

            # Set expiration
            expires_at = None
            if expires_in_days:
                expires_at = datetime.now(timezone.utc) + timedelta(
                    days=expires_in_days
                )
            elif self.config.default_expiry_days:
                expires_at = datetime.now(timezone.utc) + timedelta(
                    days=self.config.default_expiry_days
                )

            # Create API key record
            api_key_record = APIKey(
                key_hash=key_hash,
                key_prefix=key_prefix,
                name=name,
                description=description,
                user_id=user_id,
                permission_level=permission_level,
                scopes=scopes or [],
                allowed_ips=allowed_ips or [],
                expires_at=expires_at,
                rate_limit_requests=rate_limit or self.config.default_rate_limit,
            )

            # Store API key
            self.api_keys[api_key_record.key_id] = api_key_record
            self.key_hash_mapping[key_hash] = api_key_record.key_id

            self.logger.info(f"Created API key: {name} for user: {user_id}")

            return APIKeyResult(
                success=True,
                key_id=api_key_record.key_id,
                api_key=raw_key,  # Only time the raw key is returned
            )

        except Exception as e:
            self.logger.error(f"Failed to create API key: {e}")
            return APIKeyResult(
                success=False, error_message=f"Failed to create API key: {e}"
            )

    async def authenticate_api_key(
        self,
        api_key: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        endpoint: Optional[str] = None,
        method: Optional[str] = None,
    ) -> APIKeyResult:
        """Authenticate API request using API key"""
        start_time = time.time()

        try:
            # Hash the provided key for lookup
            key_hash = self._hash_api_key(api_key)
            key_id = self.key_hash_mapping.get(key_hash)

            if not key_id:
                await self._log_request(
                    None,
                    ip_address,
                    user_agent,
                    endpoint,
                    method,
                    False,
                    "Invalid API key",
                )
                return APIKeyResult(success=False, error_message="Invalid API key")

            api_key_record = self.api_keys[key_id]

            # Check key status
            if api_key_record.status != APIKeyStatus.ACTIVE:
                await self._log_request(
                    key_id,
                    ip_address,
                    user_agent,
                    endpoint,
                    method,
                    False,
                    f"Key status: {api_key_record.status}",
                )
                return APIKeyResult(
                    success=False,
                    error_message=f"API key is {api_key_record.status.value}",
                )

            # Check expiration
            if (
                api_key_record.expires_at
                and datetime.now(timezone.utc) > api_key_record.expires_at
            ):
                api_key_record.status = APIKeyStatus.EXPIRED
                await self._log_request(
                    key_id,
                    ip_address,
                    user_agent,
                    endpoint,
                    method,
                    False,
                    "Key expired",
                )
                return APIKeyResult(success=False, error_message="API key has expired")

            # Check IP restrictions
            if (
                api_key_record.allowed_ips
                and ip_address not in api_key_record.allowed_ips
            ):
                await self._log_request(
                    key_id,
                    ip_address,
                    user_agent,
                    endpoint,
                    method,
                    False,
                    "IP not allowed",
                )
                return APIKeyResult(
                    success=False, error_message="Request from unauthorized IP address"
                )

            # Check suspicious IP
            if self.config.block_suspicious_ips and ip_address in self.suspicious_ips:
                await self._log_request(
                    key_id,
                    ip_address,
                    user_agent,
                    endpoint,
                    method,
                    False,
                    "Suspicious IP",
                )
                return APIKeyResult(
                    success=False,
                    error_message="Request blocked due to suspicious activity",
                )

            # Rate limiting check
            rate_limit_result = await self._check_rate_limit(api_key_record, ip_address)
            if not rate_limit_result["allowed"]:
                await self._log_request(
                    key_id,
                    ip_address,
                    user_agent,
                    endpoint,
                    method,
                    False,
                    "Rate limited",
                )
                return APIKeyResult(
                    success=False,
                    error_message="Rate limit exceeded",
                    rate_limited=True,
                    remaining_requests=0,
                    reset_time=rate_limit_result["reset_time"],
                )

            # Authentication successful
            api_key_record.total_requests += 1
            api_key_record.successful_requests += 1
            api_key_record.last_used_at = datetime.now(timezone.utc)

            await self._log_request(
                key_id, ip_address, user_agent, endpoint, method, True, "Success"
            )

            return APIKeyResult(
                success=True,
                key_id=key_id,
                remaining_requests=rate_limit_result["remaining"],
                reset_time=rate_limit_result["reset_time"],
            )

        except Exception as e:
            self.logger.error(f"API authentication error: {e}")
            return APIKeyResult(
                success=False, error_message="Authentication failed due to system error"
            )

    async def generate_jwt_token(
        self, key_id: str, additional_claims: Optional[Dict[str, Any]] = None
    ) -> str:
        """Generate JWT token for API key"""
        api_key_record = self.api_keys.get(key_id)
        if not api_key_record or api_key_record.status != APIKeyStatus.ACTIVE:
            raise ValueError("Invalid or inactive API key")

        now = datetime.now(timezone.utc)
        payload = {
            "key_id": key_id,
            "user_id": api_key_record.user_id,
            "permission_level": api_key_record.permission_level.value,
            "scopes": api_key_record.scopes,
            "iat": now,
            "exp": now + timedelta(hours=self.config.token_expiry_hours),
            "type": "api_token",
        }

        if additional_claims:
            payload.update(additional_claims)

        return jwt.encode(
            payload, self.config.jwt_secret_key, algorithm=self.config.jwt_algorithm
        )

    async def verify_jwt_token(self, token: str) -> Dict[str, Any]:
        """Verify JWT API token"""
        try:
            payload = jwt.decode(
                token,
                self.config.jwt_secret_key,
                algorithms=[self.config.jwt_algorithm],
            )

            if payload.get("type") != "api_token":
                raise InvalidTokenError("Invalid token type")

            # Verify API key is still active
            key_id = payload.get("key_id")
            if key_id:
                api_key_record = self.api_keys.get(key_id)
                if not api_key_record or api_key_record.status != APIKeyStatus.ACTIVE:
                    raise InvalidTokenError("API key is no longer active")

            return payload

        except ExpiredSignatureError:
            raise InvalidTokenError("Token has expired")
        except Exception as e:
            raise InvalidTokenError(f"Invalid token: {e}") from e

    async def revoke_api_key(self, key_id: str, user_id: Optional[str] = None) -> bool:
        """Revoke an API key"""
        try:
            api_key_record = self.api_keys.get(key_id)
            if not api_key_record:
                return False

            # Check ownership if user_id provided
            if user_id and api_key_record.user_id != user_id:
                return False

            api_key_record.status = APIKeyStatus.REVOKED
            api_key_record.revoked_at = datetime.now(timezone.utc)

            # Remove from hash mapping
            if api_key_record.key_hash in self.key_hash_mapping:
                del self.key_hash_mapping[api_key_record.key_hash]

            self.logger.info(f"Revoked API key: {key_id}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to revoke API key {key_id}: {e}")
            return False

    async def list_api_keys(self, user_id: str) -> List[Dict[str, Any]]:
        """List API keys for a user (without sensitive data)"""
        user_keys = []
        for api_key_record in self.api_keys.values():
            if api_key_record.user_id == user_id:
                user_keys.append(
                    {
                        "key_id": api_key_record.key_id,
                        "name": api_key_record.name,
                        "description": api_key_record.description,
                        "key_prefix": api_key_record.key_prefix,
                        "permission_level": api_key_record.permission_level.value,
                        "status": api_key_record.status.value,
                        "created_at": api_key_record.created_at,
                        "expires_at": api_key_record.expires_at,
                        "last_used_at": api_key_record.last_used_at,
                        "total_requests": api_key_record.total_requests,
                        "successful_requests": api_key_record.successful_requests,
                        "rate_limit": api_key_record.rate_limit_requests,
                    }
                )

        return sorted(user_keys, key=lambda x: x["created_at"], reverse=True)

    async def update_api_key(
        self,
        key_id: str,
        user_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        permission_level: Optional[APIPermissionLevel] = None,
        scopes: Optional[List[str]] = None,
        allowed_ips: Optional[List[str]] = None,
        rate_limit: Optional[int] = None,
        expires_at: Optional[datetime] = None,
    ) -> bool:
        """Update API key properties"""
        try:
            api_key_record = self.api_keys.get(key_id)
            if not api_key_record or api_key_record.user_id != user_id:
                return False

            # Update provided fields
            if name is not None:
                api_key_record.name = name
            if description is not None:
                api_key_record.description = description
            if permission_level is not None:
                api_key_record.permission_level = permission_level
            if scopes is not None:
                api_key_record.scopes = scopes
            if allowed_ips is not None:
                api_key_record.allowed_ips = allowed_ips
            if rate_limit is not None:
                api_key_record.rate_limit_requests = rate_limit
            if expires_at is not None:
                api_key_record.expires_at = expires_at

            self.logger.info(f"Updated API key: {key_id}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to update API key {key_id}: {e}")
            return False

    async def get_api_key_stats(
        self, key_id: str, user_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get detailed statistics for an API key"""
        api_key_record = self.api_keys.get(key_id)
        if not api_key_record or api_key_record.user_id != user_id:
            return None

        # Calculate success rate
        success_rate = 0.0
        if api_key_record.total_requests > 0:
            success_rate = (
                api_key_record.successful_requests / api_key_record.total_requests
            )

        # Get recent requests (last 24 hours)
        twenty_four_hours_ago = datetime.now(timezone.utc) - timedelta(hours=24)
        recent_requests = [
            log
            for log in self.request_logs
            if log.get("key_id") == key_id
            and log.get("timestamp", datetime.min.replace(tzinfo=timezone.utc))
            > twenty_four_hours_ago
        ]

        return {
            "key_id": key_id,
            "total_requests": api_key_record.total_requests,
            "successful_requests": api_key_record.successful_requests,
            "failed_requests": api_key_record.failed_requests,
            "success_rate": success_rate,
            "last_used_at": api_key_record.last_used_at,
            "requests_last_24h": len(recent_requests),
            "rate_limit": api_key_record.rate_limit_requests,
            "status": api_key_record.status.value,
        }

    def _hash_api_key(self, api_key: str) -> str:
        """Hash API key for secure storage"""
        return hashlib.sha256(api_key.encode("utf-8")).hexdigest()

    async def _check_rate_limit(
        self, api_key_record: APIKey, ip_address: Optional[str]
    ) -> Dict[str, Any]:
        """Check rate limiting for API key"""
        now = time.time()
        key_id = api_key_record.key_id
        window_seconds = api_key_record.rate_limit_window_seconds
        max_requests = api_key_record.rate_limit_requests

        # Initialize tracking if not exists
        if key_id not in self.rate_limit_tracker:
            self.rate_limit_tracker[key_id] = []

        # Clean old requests outside window
        cutoff_time = now - window_seconds
        self.rate_limit_tracker[key_id] = [
            timestamp
            for timestamp in self.rate_limit_tracker[key_id]
            if timestamp > cutoff_time
        ]

        # Check if limit exceeded
        current_count = len(self.rate_limit_tracker[key_id])
        if current_count >= max_requests:
            # Calculate reset time
            oldest_request = min(self.rate_limit_tracker[key_id])
            reset_time = datetime.fromtimestamp(
                oldest_request + window_seconds, tz=timezone.utc
            )

            return {"allowed": False, "remaining": 0, "reset_time": reset_time}

        # Add current request
        self.rate_limit_tracker[key_id].append(now)
        remaining = max_requests - current_count - 1

        # Calculate next reset time
        reset_time = datetime.fromtimestamp(now + window_seconds, tz=timezone.utc)

        return {"allowed": True, "remaining": remaining, "reset_time": reset_time}

    async def _log_request(
        self,
        key_id: Optional[str],
        ip_address: Optional[str],
        user_agent: Optional[str],
        endpoint: Optional[str],
        method: Optional[str],
        success: bool,
        notes: str,
    ):
        """Log API request for audit and monitoring"""
        if not self.config.log_all_requests:
            return

        log_entry = {
            "timestamp": datetime.now(timezone.utc),
            "key_id": key_id,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "endpoint": endpoint,
            "method": method,
            "success": success,
            "notes": notes,
        }

        self.request_logs.append(log_entry)

        # Keep only last 10,000 logs (in production, use proper log rotation)
        if len(self.request_logs) > 10000:
            self.request_logs = self.request_logs[-10000:]

        # Update failed request count for API key
        if key_id and not success:
            api_key_record = self.api_keys.get(key_id)
            if api_key_record:
                api_key_record.failed_requests += 1

        # Track suspicious activity
        if not success and ip_address:
            await self._track_suspicious_activity(ip_address)

    async def _track_suspicious_activity(self, ip_address: str):
        """Track and flag suspicious IP addresses"""
        # Count failed attempts from this IP in last hour
        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        failed_attempts = [
            log
            for log in self.request_logs
            if (
                log.get("ip_address") == ip_address
                and not log.get("success")
                and log.get("timestamp", datetime.min.replace(tzinfo=timezone.utc))
                > one_hour_ago
            )
        ]

        # Flag as suspicious if too many failures
        if len(failed_attempts) > 50:  # Configurable threshold
            self.suspicious_ips.add(ip_address)
            self.logger.warning(
                f"Marked IP as suspicious: {ip_address} ({len(failed_attempts)} failures)"
            )

    async def cleanup_expired_keys(self) -> int:
        """Clean up expired API keys"""
        cleaned_count = 0
        now = datetime.now(timezone.utc)

        for key_id, api_key_record in list(self.api_keys.items()):
            if (
                api_key_record.expires_at
                and now > api_key_record.expires_at
                and api_key_record.status == APIKeyStatus.ACTIVE
            ):
                api_key_record.status = APIKeyStatus.EXPIRED
                cleaned_count += 1

        if cleaned_count > 0:
            self.logger.info(f"Marked {cleaned_count} API keys as expired")

        return cleaned_count

    async def get_usage_analytics(
        self, user_id: Optional[str] = None, days: int = 30
    ) -> Dict[str, Any]:
        """Get API usage analytics"""
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

        # Filter logs by date and optionally by user
        relevant_logs = []
        for log in self.request_logs:
            log_time = log.get("timestamp", datetime.min.replace(tzinfo=timezone.utc))
            if log_time > cutoff_date:
                if user_id:
                    key_id = log.get("key_id")
                    if key_id:
                        api_key_record = self.api_keys.get(key_id)
                        if api_key_record and api_key_record.user_id == user_id:
                            relevant_logs.append(log)
                else:
                    relevant_logs.append(log)

        # Calculate analytics
        total_requests = len(relevant_logs)
        successful_requests = len([log for log in relevant_logs if log.get("success")])
        failed_requests = total_requests - successful_requests

        # Group by day
        daily_stats = {}
        for log in relevant_logs:
            date_key = (
                log.get("timestamp", datetime.min.replace(tzinfo=timezone.utc))
                .date()
                .isoformat()
            )
            if date_key not in daily_stats:
                daily_stats[date_key] = {"total": 0, "successful": 0, "failed": 0}

            daily_stats[date_key]["total"] += 1
            if log.get("success"):
                daily_stats[date_key]["successful"] += 1
            else:
                daily_stats[date_key]["failed"] += 1

        # Top endpoints
        endpoint_stats = {}
        for log in relevant_logs:
            endpoint = log.get("endpoint", "unknown")
            if endpoint not in endpoint_stats:
                endpoint_stats[endpoint] = 0
            endpoint_stats[endpoint] += 1

        top_endpoints = sorted(
            endpoint_stats.items(), key=lambda x: x[1], reverse=True
        )[:10]

        return {
            "period_days": days,
            "total_requests": total_requests,
            "successful_requests": successful_requests,
            "failed_requests": failed_requests,
            "success_rate": successful_requests / max(1, total_requests),
            "daily_stats": daily_stats,
            "top_endpoints": top_endpoints,
        }

# Factory function
def create_api_authentication(
    config: Optional[APIAuthenticationConfig] = None,
) -> APIAuthentication:
    """Create APIAuthentication instance with optional configuration"""
    return APIAuthentication(config)
