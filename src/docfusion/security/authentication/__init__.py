#!/usr/bin/env python3
"""
Authentication Package

Provides secure user and API authentication mechanisms.
"""

from .user_authentication import UserAuthentication, UserCredentials, AuthenticationResult
from .api_authentication import APIAuthentication, APIKey, APIKeyResult

__all__ = [
    "UserAuthentication", "UserCredentials", "AuthenticationResult",
    "APIAuthentication", "APIKey", "APIKeyResult"
]