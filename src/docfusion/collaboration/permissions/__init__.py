"""
Collaboration permissions package for granular access control.

This package provides section-level editing permissions, role-based collaboration
controls, and dynamic permission management for collaborative documents.
"""

from .collaboration_permissions import (
	CollaborationPermissions,
	Permission,
	PermissionScope,
	UserPermissions,
	SectionPermissions,
	PermissionGrant,
	PermissionRule
)

__all__ = [
	'CollaborationPermissions',
	'Permission',
	'PermissionScope', 
	'UserPermissions',
	'SectionPermissions',
	'PermissionGrant',
	'PermissionRule'
]