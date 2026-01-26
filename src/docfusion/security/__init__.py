#!/usr/bin/env python3
"""
Security Package

Comprehensive security framework for the proposal writer system.
Provides authentication, authorization, encryption, and audit capabilities.
"""

from .authentication.user_authentication import UserAuthentication, UserCredentials, AuthenticationResult
from .authentication.api_authentication import APIAuthentication, APIKey, APIKeyResult
from .authorization.role_based_access import RoleBasedAccess, Role, Permission, AccessResult
from .authorization.document_permissions import DocumentPermissions, DocumentAccess, PermissionLevel
from .encryption.data_encryption import DataEncryption, EncryptionResult
from .audit.audit_logger import AuditLogger, AuditEvent, AuditEventType

__all__ = [
    # Authentication
    "UserAuthentication", "UserCredentials", "AuthenticationResult",
    "APIAuthentication", "APIKey", "APIKeyResult",
    
    # Authorization
    "RoleBasedAccess", "Role", "Permission", "AccessResult",
    "DocumentPermissions", "DocumentAccess", "PermissionLevel",
    
    # Encryption
    "DataEncryption", "EncryptionResult",
    
    # Audit
    "AuditLogger", "AuditEvent", "AuditEventType"
]