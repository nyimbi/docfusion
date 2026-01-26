#!/usr/bin/env python3
"""
Authorization Package

Provides role-based access control and permission management.
"""

from .role_based_access import RoleBasedAccess, Role, Permission, AccessResult
from .document_permissions import DocumentPermissions, DocumentAccess, PermissionLevel

__all__ = [
    "RoleBasedAccess", "Role", "Permission", "AccessResult",
    "DocumentPermissions", "DocumentAccess", "PermissionLevel"
]