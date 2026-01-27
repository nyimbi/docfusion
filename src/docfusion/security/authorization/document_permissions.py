#!/usr/bin/env python3
"""
Document Permissions Module

Provides document-level access control with sharing, collaboration permissions,
version access management, and inheritance from parent documents.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union

try:
    from uuid_extensions import uuid7str
except ImportError:
    from uuid import uuid4

    def uuid7str() -> str:
        return str(uuid4())


from pydantic import BaseModel, ConfigDict, Field


class PermissionLevel(Enum):
    """Document permission levels"""

    NONE = "none"
    VIEW = "view"
    COMMENT = "comment"
    EDIT = "edit"
    MANAGE = "manage"
    OWNER = "owner"


class ShareType(Enum):
    """Document sharing types"""

    PRIVATE = "private"
    INTERNAL = "internal"  # Within organization
    PUBLIC = "public"
    LINK = "link"  # Anyone with link
    DOMAIN = "domain"  # Specific domain users


class AccessType(Enum):
    """How access was granted"""

    DIRECT = "direct"  # Directly assigned
    INHERITED = "inherited"  # From parent document
    ROLE_BASED = "role_based"  # Through user role
    TEAM_BASED = "team_based"  # Through team membership
    LINK_BASED = "link_based"  # Through shared link


class DocumentAccess(BaseModel):
    """Document access record"""

    model_config = ConfigDict(extra="forbid", validate_by_name=True)

    access_id: str = Field(default_factory=uuid7str)
    document_id: str

    # Subject (who has access)
    user_id: Optional[str] = None
    role_id: Optional[str] = None
    team_id: Optional[str] = None
    email: Optional[str] = None  # For external users

    # Permission details
    permission_level: PermissionLevel
    access_type: AccessType

    # Sharing and collaboration
    can_share: bool = False
    can_copy: bool = True
    can_download: bool = True
    can_print: bool = True

    # Version access
    version_access: str = "latest"  # "latest", "all", "specific:v1.2"

    # Restrictions
    expires_at: Optional[datetime] = None
    ip_restrictions: List[str] = Field(default_factory=list)
    time_restrictions: Optional[Dict[str, str]] = None

    # Metadata
    granted_by: str
    granted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_accessed_at: Optional[datetime] = None
    access_count: int = 0

    # Status
    is_active: bool = True
    revoked_at: Optional[datetime] = None
    revoked_by: Optional[str] = None


class DocumentSharingSettings(BaseModel):
    """Document sharing configuration"""

    model_config = ConfigDict(extra="forbid", validate_by_name=True)

    document_id: str
    share_type: ShareType

    # Link sharing
    share_link: Optional[str] = None
    link_password: Optional[str] = None
    link_expires_at: Optional[datetime] = None

    # Domain restrictions
    allowed_domains: List[str] = Field(default_factory=list)
    blocked_domains: List[str] = Field(default_factory=list)

    # Default permissions for new shares
    default_permission: PermissionLevel = PermissionLevel.VIEW
    require_approval: bool = False

    # Download and copy controls
    allow_download: bool = True
    allow_copy: bool = True
    allow_print: bool = True

    # Notifications
    notify_on_access: bool = False
    notify_on_share: bool = True

    # Created metadata
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DocumentPermissionInheritance(BaseModel):
    """Document permission inheritance settings"""

    model_config = ConfigDict(extra="forbid", validate_by_name=True)

    document_id: str
    parent_document_id: Optional[str] = None

    # Inheritance settings
    inherit_permissions: bool = True
    inherit_sharing: bool = False
    override_parent: bool = False

    # Permission mapping for inheritance
    permission_mapping: Dict[str, str] = Field(default_factory=dict)

    # Metadata
    updated_by: str
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class DocumentPermissionsConfig:
    """Configuration for document permissions"""

    # Default permissions
    default_owner_permissions: PermissionLevel = PermissionLevel.OWNER
    default_creator_can_share: bool = True

    # Inheritance settings
    enable_permission_inheritance: bool = True
    max_inheritance_depth: int = 10

    # Sharing settings
    allow_public_sharing: bool = False
    allow_link_sharing: bool = True
    default_link_expiry_days: int = 30
    require_authentication_for_links: bool = False

    # Security settings
    log_all_access: bool = True
    require_approval_for_external_shares: bool = True
    max_external_shares_per_document: int = 100

    # Cleanup settings
    cleanup_expired_access_hours: int = 24
    cleanup_revoked_access_days: int = 30


class DocumentPermissions:
    """Document-level access control and sharing system"""

    def __init__(self, config: Optional[DocumentPermissionsConfig] = None):
        """Initialize document permissions system"""
        self.config = config or DocumentPermissionsConfig()
        self.logger = logging.getLogger(__name__)

        # Storage (replace with database in production)
        self.document_access: Dict[
            str, List[DocumentAccess]
        ] = {}  # document_id -> access list
        self.sharing_settings: Dict[
            str, DocumentSharingSettings
        ] = {}  # document_id -> settings
        self.inheritance_settings: Dict[
            str, DocumentPermissionInheritance
        ] = {}  # document_id -> inheritance
        self.access_logs: List[Dict[str, Any]] = []

        self.logger.info("Document permissions system initialized")

    async def grant_document_access(
        self,
        document_id: str,
        granted_by: str,
        permission_level: PermissionLevel,
        user_id: Optional[str] = None,
        role_id: Optional[str] = None,
        team_id: Optional[str] = None,
        email: Optional[str] = None,
        expires_in_days: Optional[int] = None,
        can_share: bool = False,
        can_copy: bool = True,
        can_download: bool = True,
        can_print: bool = True,
        version_access: str = "latest",
        ip_restrictions: Optional[List[str]] = None,
        time_restrictions: Optional[Dict[str, str]] = None,
    ) -> str:
        """Grant access to a document"""
        # Validate that exactly one subject is specified
        subjects = [user_id, role_id, team_id, email]
        if sum(1 for s in subjects if s is not None) != 1:
            raise ValueError(
                "Exactly one of user_id, role_id, team_id, or email must be specified"
            )

        # Determine access type
        if user_id:
            access_type = AccessType.DIRECT
        elif role_id:
            access_type = AccessType.ROLE_BASED
        elif team_id:
            access_type = AccessType.TEAM_BASED
        else:  # email
            access_type = AccessType.DIRECT

        # Check for external sharing approval requirement
        if email and self.config.require_approval_for_external_shares:
            # In production, this would trigger approval workflow
            self.logger.info(
                f"External share requires approval: {email} for document {document_id}"
            )

        # Check external share limits
        if email:
            external_count = await self._count_external_shares(document_id)
            if external_count >= self.config.max_external_shares_per_document:
                raise ValueError(
                    f"Maximum external shares limit reached: {self.config.max_external_shares_per_document}"
                )

        # Calculate expiration
        expires_at = None
        if expires_in_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

        # Create access record
        access = DocumentAccess(
            document_id=document_id,
            user_id=user_id,
            role_id=role_id,
            team_id=team_id,
            email=email,
            permission_level=permission_level,
            access_type=access_type,
            can_share=can_share,
            can_copy=can_copy,
            can_download=can_download,
            can_print=can_print,
            version_access=version_access,
            expires_at=expires_at,
            ip_restrictions=ip_restrictions or [],
            time_restrictions=time_restrictions,
            granted_by=granted_by,
        )

        # Store access record
        if document_id not in self.document_access:
            self.document_access[document_id] = []

        # Check for existing access and update if found
        existing_access = await self._find_existing_access(
            document_id, user_id, role_id, team_id, email
        )
        if existing_access:
            # Update existing access
            existing_access.permission_level = permission_level
            existing_access.can_share = can_share
            existing_access.can_copy = can_copy
            existing_access.can_download = can_download
            existing_access.can_print = can_print
            existing_access.version_access = version_access
            existing_access.expires_at = expires_at
            existing_access.ip_restrictions = ip_restrictions or []
            existing_access.time_restrictions = time_restrictions
            existing_access.is_active = True
            existing_access.revoked_at = None
            existing_access.revoked_by = None

            access_id = existing_access.access_id
        else:
            # Add new access
            self.document_access[document_id].append(access)
            access_id = access.access_id

        # Log access grant
        await self._log_access_event(
            "access_granted",
            document_id,
            granted_by,
            {
                "access_id": access_id,
                "permission_level": permission_level.value,
                "subject_type": access_type.value,
                "subject_id": user_id or role_id or team_id or email,
            },
        )

        self.logger.info(
            f"Granted {permission_level.value} access to document {document_id}"
        )
        return access_id

    async def check_document_permission(
        self,
        document_id: str,
        user_id: str,
        requested_permission: PermissionLevel,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Check if user has permission to access document"""
        context = context or {}

        # Get all access records for document
        document_accesses = self.document_access.get(document_id, [])

        # Get user's effective permissions
        effective_permissions = await self._get_user_effective_permissions(
            document_id, user_id, context
        )

        # Find highest permission level
        highest_permission = PermissionLevel.NONE
        granted_by_access = None
        access_restrictions = {}

        for access in effective_permissions:
            if self._permission_level_value(
                access.permission_level
            ) > self._permission_level_value(highest_permission):
                highest_permission = access.permission_level
                granted_by_access = access
                access_restrictions = {
                    "can_share": access.can_share,
                    "can_copy": access.can_copy,
                    "can_download": access.can_download,
                    "can_print": access.can_print,
                    "version_access": access.version_access,
                }

        # Check if requested permission is satisfied
        has_permission = self._permission_level_value(
            highest_permission
        ) >= self._permission_level_value(requested_permission)

        # Log access check
        if self.config.log_all_access:
            await self._log_access_event(
                "permission_check",
                document_id,
                user_id,
                {
                    "requested_permission": requested_permission.value,
                    "granted_permission": highest_permission.value,
                    "has_permission": has_permission,
                    "access_type": granted_by_access.access_type.value
                    if granted_by_access
                    else None,
                },
            )

        # Update access count and last accessed time
        if granted_by_access and has_permission:
            granted_by_access.access_count += 1
            granted_by_access.last_accessed_at = datetime.now(timezone.utc)

        return {
            "has_permission": has_permission,
            "effective_permission": highest_permission.value,
            "requested_permission": requested_permission.value,
            "granted_by": granted_by_access.access_id if granted_by_access else None,
            "access_type": granted_by_access.access_type.value
            if granted_by_access
            else None,
            "restrictions": access_restrictions,
            "checked_at": datetime.now(timezone.utc),
        }

    async def revoke_document_access(
        self, document_id: str, access_id: str, revoked_by: str
    ) -> bool:
        """Revoke access to a document"""
        document_accesses = self.document_access.get(document_id, [])

        for access in document_accesses:
            if access.access_id == access_id and access.is_active:
                access.is_active = False
                access.revoked_at = datetime.now(timezone.utc)
                access.revoked_by = revoked_by

                # Log revocation
                await self._log_access_event(
                    "access_revoked",
                    document_id,
                    revoked_by,
                    {
                        "access_id": access_id,
                        "permission_level": access.permission_level.value,
                    },
                )

                self.logger.info(
                    f"Revoked access {access_id} to document {document_id}"
                )
                return True

        return False

    async def create_share_link(
        self,
        document_id: str,
        created_by: str,
        permission_level: PermissionLevel = PermissionLevel.VIEW,
        expires_in_days: Optional[int] = None,
        password: Optional[str] = None,
        allow_download: bool = True,
        allow_copy: bool = True,
        allow_print: bool = True,
    ) -> str:
        """Create a shareable link for document"""
        if not self.config.allow_link_sharing:
            raise ValueError("Link sharing is disabled")

        # Generate secure share link
        import secrets

        share_token = secrets.token_urlsafe(32)
        share_link = f"https://app.example.com/share/{share_token}"

        # Calculate expiration
        expires_at = None
        if expires_in_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
        elif self.config.default_link_expiry_days:
            expires_at = datetime.now(timezone.utc) + timedelta(
                days=self.config.default_link_expiry_days
            )

        # Create or update sharing settings
        sharing_settings = DocumentSharingSettings(
            document_id=document_id,
            share_type=ShareType.LINK,
            share_link=share_link,
            link_password=password,
            link_expires_at=expires_at,
            default_permission=permission_level,
            allow_download=allow_download,
            allow_copy=allow_copy,
            allow_print=allow_print,
            created_by=created_by,
        )

        self.sharing_settings[document_id] = sharing_settings

        # Create access record for link-based access
        await self.grant_document_access(
            document_id=document_id,
            granted_by=created_by,
            permission_level=permission_level,
            email="*",  # Wildcard for link access
            can_copy=allow_copy,
            can_download=allow_download,
            can_print=allow_print,
            expires_in_days=expires_in_days,
        )

        # Log share link creation
        await self._log_access_event(
            "share_link_created",
            document_id,
            created_by,
            {
                "share_link": share_link,
                "permission_level": permission_level.value,
                "expires_at": expires_at.isoformat() if expires_at else None,
            },
        )

        self.logger.info(f"Created share link for document {document_id}")
        return share_link

    async def access_via_share_link(
        self,
        share_link: str,
        user_id: Optional[str] = None,
        password: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Access document via share link"""
        context = context or {}

        # Find sharing settings by link
        sharing_settings = None
        document_id = None

        for doc_id, settings in self.sharing_settings.items():
            if settings.share_link == share_link:
                sharing_settings = settings
                document_id = doc_id
                break

        if not sharing_settings:
            return {"success": False, "error": "Invalid share link"}

        # Check link expiration
        if (
            sharing_settings.link_expires_at
            and datetime.now(timezone.utc) > sharing_settings.link_expires_at
        ):
            return {"success": False, "error": "Share link has expired"}

        # Check password if required
        if (
            sharing_settings.link_password
            and password != sharing_settings.link_password
        ):
            return {"success": False, "error": "Invalid password"}

        # Check authentication requirement
        if self.config.require_authentication_for_links and not user_id:
            return {"success": False, "error": "Authentication required"}

        # Create temporary access
        temp_access_id = await self.grant_document_access(
            document_id=document_id,
            granted_by="system",
            permission_level=sharing_settings.default_permission,
            user_id=user_id,
            email=context.get("email") if not user_id else None,
            can_copy=sharing_settings.allow_copy,
            can_download=sharing_settings.allow_download,
            can_print=sharing_settings.allow_print,
            expires_in_days=1,  # Temporary access for 1 day
        )

        # Log link access
        await self._log_access_event(
            "share_link_accessed",
            document_id,
            user_id or "anonymous",
            {
                "share_link": share_link,
                "temp_access_id": temp_access_id,
                "ip_address": context.get("ip_address"),
            },
        )

        return {
            "success": True,
            "document_id": document_id,
            "permission_level": sharing_settings.default_permission.value,
            "access_id": temp_access_id,
            "restrictions": {
                "can_copy": sharing_settings.allow_copy,
                "can_download": sharing_settings.allow_download,
                "can_print": sharing_settings.allow_print,
            },
        }

    async def set_document_inheritance(
        self,
        document_id: str,
        parent_document_id: Optional[str],
        updated_by: str,
        inherit_permissions: bool = True,
        inherit_sharing: bool = False,
        override_parent: bool = False,
        permission_mapping: Optional[Dict[str, str]] = None,
    ) -> bool:
        """Set document permission inheritance"""
        if not self.config.enable_permission_inheritance:
            raise ValueError("Permission inheritance is disabled")

        # Validate inheritance depth
        if parent_document_id:
            depth = await self._calculate_inheritance_depth(parent_document_id)
            if depth >= self.config.max_inheritance_depth:
                raise ValueError(
                    f"Maximum inheritance depth exceeded: {self.config.max_inheritance_depth}"
                )

        # Create inheritance settings
        inheritance = DocumentPermissionInheritance(
            document_id=document_id,
            parent_document_id=parent_document_id,
            inherit_permissions=inherit_permissions,
            inherit_sharing=inherit_sharing,
            override_parent=override_parent,
            permission_mapping=permission_mapping or {},
            updated_by=updated_by,
        )

        self.inheritance_settings[document_id] = inheritance

        # Apply inherited permissions if enabled
        if inherit_permissions and parent_document_id:
            await self._apply_inherited_permissions(
                document_id, parent_document_id, updated_by
            )

        # Log inheritance change
        await self._log_access_event(
            "inheritance_updated",
            document_id,
            updated_by,
            {
                "parent_document_id": parent_document_id,
                "inherit_permissions": inherit_permissions,
                "inherit_sharing": inherit_sharing,
            },
        )

        self.logger.info(
            f"Set inheritance for document {document_id} -> parent {parent_document_id}"
        )
        return True

    async def get_document_access_list(self, document_id: str) -> List[Dict[str, Any]]:
        """Get list of all access records for a document"""
        document_accesses = self.document_access.get(document_id, [])
        access_list = []

        for access in document_accesses:
            if access.is_active and not self._is_access_expired(access):
                access_info = {
                    "access_id": access.access_id,
                    "permission_level": access.permission_level.value,
                    "access_type": access.access_type.value,
                    "granted_by": access.granted_by,
                    "granted_at": access.granted_at,
                    "last_accessed_at": access.last_accessed_at,
                    "access_count": access.access_count,
                    "expires_at": access.expires_at,
                    "restrictions": {
                        "can_share": access.can_share,
                        "can_copy": access.can_copy,
                        "can_download": access.can_download,
                        "can_print": access.can_print,
                    },
                }

                # Add subject information
                if access.user_id:
                    access_info["subject"] = {"type": "user", "id": access.user_id}
                elif access.role_id:
                    access_info["subject"] = {"type": "role", "id": access.role_id}
                elif access.team_id:
                    access_info["subject"] = {"type": "team", "id": access.team_id}
                elif access.email:
                    access_info["subject"] = {"type": "email", "id": access.email}

                access_list.append(access_info)

        return sorted(access_list, key=lambda x: x["granted_at"], reverse=True)

    async def get_user_accessible_documents(
        self, user_id: str, minimum_permission: PermissionLevel = PermissionLevel.VIEW
    ) -> List[Dict[str, Any]]:
        """Get list of documents user has access to"""
        accessible_documents = []

        for document_id in self.document_access.keys():
            permission_check = await self.check_document_permission(
                document_id, user_id, minimum_permission
            )

            if permission_check["has_permission"]:
                accessible_documents.append(
                    {
                        "document_id": document_id,
                        "permission_level": permission_check["effective_permission"],
                        "access_type": permission_check["access_type"],
                        "restrictions": permission_check["restrictions"],
                    }
                )

        return accessible_documents

    async def cleanup_expired_access(self) -> int:
        """Clean up expired access records"""
        cleaned_count = 0
        now = datetime.now(timezone.utc)

        for document_id, accesses in self.document_access.items():
            for access in accesses:
                if access.is_active and self._is_access_expired(access):
                    access.is_active = False
                    cleaned_count += 1

        # Clean up expired share links
        for document_id, settings in list(self.sharing_settings.items()):
            if settings.link_expires_at and now > settings.link_expires_at:
                del self.sharing_settings[document_id]
                cleaned_count += 1

        if cleaned_count > 0:
            self.logger.info(f"Cleaned up {cleaned_count} expired access records")

        return cleaned_count

    async def _get_user_effective_permissions(
        self, document_id: str, user_id: str, context: Dict[str, Any]
    ) -> List[DocumentAccess]:
        """Get user's effective permissions for document"""
        effective_permissions = []
        document_accesses = self.document_access.get(document_id, [])

        for access in document_accesses:
            if not access.is_active or self._is_access_expired(access):
                continue

            # Check if access applies to this user
            if access.user_id == user_id:
                # Direct user access
                if self._check_access_restrictions(access, context):
                    effective_permissions.append(access)

            elif access.role_id:
                # Role-based access (would need role system integration)
                # For now, skip role-based access
                pass

            elif access.team_id:
                # Team-based access (would need team system integration)
                # For now, skip team-based access
                pass

            elif access.email == "*":
                # Link-based access (wildcard email)
                if self._check_access_restrictions(access, context):
                    effective_permissions.append(access)

        # Add inherited permissions if enabled
        inheritance = self.inheritance_settings.get(document_id)
        if (
            inheritance
            and inheritance.inherit_permissions
            and inheritance.parent_document_id
        ):
            parent_permissions = await self._get_user_effective_permissions(
                inheritance.parent_document_id, user_id, context
            )

            for parent_access in parent_permissions:
                # Create inherited access record
                inherited_access = DocumentAccess(
                    document_id=document_id,
                    user_id=parent_access.user_id,
                    role_id=parent_access.role_id,
                    team_id=parent_access.team_id,
                    email=parent_access.email,
                    permission_level=parent_access.permission_level,
                    access_type=AccessType.INHERITED,
                    can_share=parent_access.can_share,
                    can_copy=parent_access.can_copy,
                    can_download=parent_access.can_download,
                    can_print=parent_access.can_print,
                    granted_by=parent_access.granted_by,
                )
                effective_permissions.append(inherited_access)

        return effective_permissions

    def _check_access_restrictions(
        self, access: DocumentAccess, context: Dict[str, Any]
    ) -> bool:
        """Check if access restrictions are met"""
        # Check IP restrictions
        if access.ip_restrictions and context.get("ip_address"):
            if context["ip_address"] not in access.ip_restrictions:
                return False

        # Check time restrictions
        if access.time_restrictions:
            if not self._check_time_restrictions(access.time_restrictions):
                return False

        return True

    def _check_time_restrictions(self, time_restrictions: Dict[str, str]) -> bool:
        """Check if current time meets restrictions"""
        now = datetime.now(timezone.utc)

        # Check day of week restrictions
        if "allowed_days" in time_restrictions:
            allowed_days = time_restrictions["allowed_days"].split(",")
            current_day = now.strftime("%A").lower()
            if current_day not in [day.strip().lower() for day in allowed_days]:
                return False

        # Check time of day restrictions
        if "allowed_hours" in time_restrictions:
            allowed_hours = time_restrictions["allowed_hours"]
            start_hour, end_hour = map(int, allowed_hours.split("-"))
            if not (start_hour <= now.hour <= end_hour):
                return False

        return True

    def _is_access_expired(self, access: DocumentAccess) -> bool:
        """Check if access has expired"""
        if access.expires_at:
            return datetime.now(timezone.utc) > access.expires_at
        return False

    def _permission_level_value(self, level: PermissionLevel) -> int:
        """Get numeric value for permission level comparison"""
        level_values = {
            PermissionLevel.NONE: 0,
            PermissionLevel.VIEW: 1,
            PermissionLevel.COMMENT: 2,
            PermissionLevel.EDIT: 3,
            PermissionLevel.MANAGE: 4,
            PermissionLevel.OWNER: 5,
        }
        return level_values.get(level, 0)

    async def _find_existing_access(
        self,
        document_id: str,
        user_id: Optional[str],
        role_id: Optional[str],
        team_id: Optional[str],
        email: Optional[str],
    ) -> Optional[DocumentAccess]:
        """Find existing access record for subject"""
        document_accesses = self.document_access.get(document_id, [])

        for access in document_accesses:
            if (
                access.user_id == user_id
                and access.role_id == role_id
                and access.team_id == team_id
                and access.email == email
            ):
                return access

        return None

    async def _count_external_shares(self, document_id: str) -> int:
        """Count external (email-based) shares for document"""
        document_accesses = self.document_access.get(document_id, [])
        external_count = 0

        for access in document_accesses:
            if access.email and access.email != "*" and access.is_active:
                external_count += 1

        return external_count

    async def _calculate_inheritance_depth(self, document_id: str) -> int:
        """Calculate inheritance depth for document"""
        inheritance = self.inheritance_settings.get(document_id)
        if not inheritance or not inheritance.parent_document_id:
            return 0

        return 1 + await self._calculate_inheritance_depth(
            inheritance.parent_document_id
        )

    async def _apply_inherited_permissions(
        self, document_id: str, parent_document_id: str, updated_by: str
    ):
        """Apply permissions from parent document"""
        parent_accesses = self.document_access.get(parent_document_id, [])

        for parent_access in parent_accesses:
            if parent_access.is_active and not self._is_access_expired(parent_access):
                # Create inherited access
                await self.grant_document_access(
                    document_id=document_id,
                    granted_by=updated_by,
                    permission_level=parent_access.permission_level,
                    user_id=parent_access.user_id,
                    role_id=parent_access.role_id,
                    team_id=parent_access.team_id,
                    email=parent_access.email,
                    can_share=parent_access.can_share,
                    can_copy=parent_access.can_copy,
                    can_download=parent_access.can_download,
                    can_print=parent_access.can_print,
                    version_access=parent_access.version_access,
                )

    async def _log_access_event(
        self, event_type: str, document_id: str, user_id: str, details: Dict[str, Any]
    ):
        """Log access event for audit trail"""
        if not self.config.log_all_access:
            return

        log_entry = {
            "timestamp": datetime.now(timezone.utc),
            "event_type": event_type,
            "document_id": document_id,
            "user_id": user_id,
            "details": details,
        }

        self.access_logs.append(log_entry)

        # Keep only last 10,000 logs
        if len(self.access_logs) > 10000:
            self.access_logs = self.access_logs[-10000:]


# Factory function
def create_document_permissions(
    config: Optional[DocumentPermissionsConfig] = None,
) -> DocumentPermissions:
    """Create DocumentPermissions instance with optional configuration"""
    return DocumentPermissions(config)
