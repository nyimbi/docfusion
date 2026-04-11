#!/usr/bin/env python3
"""
Secure Storage Service

Security-enhanced storage service that integrates authentication, authorization,
encryption, and audit logging with the existing storage system.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import timezone, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from ..security import (
    AuditEventType,
    AuditSeverity,
    PermissionLevel,
    SecurityManager,
    SecurityManagerConfiguration,
)
from ..core.utils import uuid7str
from .rag_storage_service import (
    EnhancedSearchResult,
    RAGStorageConfiguration,
    RAGStorageService,
)

@dataclass
class SecureStorageConfiguration:
    """Configuration for secure storage service"""

    # Base RAG storage configuration
    rag_config: RAGStorageConfiguration

    # Security configuration
    security_config: Optional[SecurityManagerConfiguration] = None

    # Security policies
    require_authentication: bool = True
    enable_document_encryption: bool = True
    enable_field_level_encryption: bool = True
    audit_all_operations: bool = True

    # Default permissions
    default_document_permission: str = "view"
    allow_public_documents: bool = False
    require_approval_for_sharing: bool = True

    # Encryption settings
    encrypt_sensitive_fields: List[str] = None
    encryption_key_rotation_days: int = 90

class SecureStorageService:
    """Security-enhanced storage service"""

    def __init__(self, config: SecureStorageConfiguration):
        self.config = config
        self.logger = logging.getLogger(__name__)

        # Initialize security manager
        self.security = SecurityManager(config.security_config)

        # Initialize base RAG storage service
        self.rag_storage = RAGStorageService(config.rag_config)

        # Security settings
        self.encrypt_sensitive_fields = config.encrypt_sensitive_fields or [
            "content",
            "description",
            "notes",
            "comments",
        ]

        self.logger.info("Secure storage service initialized")

    # ==================== SECURE DOCUMENT OPERATIONS ====================

    async def create_document(
        self,
        title: str,
        content: str,
        user_id: str,
        category: str = "",
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        encrypt_content: bool = None,
        sharing_permissions: Optional[Dict[str, str]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create document with security controls"""
        # Authentication check
        if self.config.require_authentication and not user_id:
            return {"success": False, "error": "Authentication required"}

        # Authorization check - user can create documents
        auth_result = await self.security.check_permission(
            user_id, "document", "create", context=context
        )

        if not auth_result.has_permission:
            await self.security.log_security_violation(
                f"Unauthorized document creation attempt by user {user_id}",
                user_id,
                context.get("ip_address") if context else None,
            )
            return {"success": False, "error": "Permission denied"}

        try:
            # Encrypt sensitive content if enabled
            encrypted_content = content
            encryption_metadata = {}

            if self.config.enable_document_encryption and (
                encrypt_content is True or encrypt_content is None
            ):
                encryption_result = await self.security.encrypt_sensitive_data(
                    content, f"document_content", user_id
                )

                if encryption_result.success:
                    encrypted_content = encryption_result.encrypted_data
                    encryption_metadata = {
                        "encrypted": True,
                        "encryption_key_id": encryption_result.key_id,
                        "encryption_algorithm": encryption_result.algorithm,
                        "encryption_nonce": encryption_result.nonce,
                        "encryption_tag": encryption_result.tag,
                    }
                else:
                    self.logger.warning(
                        f"Failed to encrypt document content: {encryption_result.error_message}"
                    )

            # Create document through RAG storage
            document_id = uuid7str()

            # Prepare metadata with security information
            secure_metadata = {
                **(metadata or {}),
                "created_by": user_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "security_level": "encrypted"
                if encryption_metadata.get("encrypted")
                else "standard",
                **encryption_metadata,
            }

            # Store document (would integrate with RAG storage)
            # For now, simulate successful creation
            result = {
                "success": True,
                "document_id": document_id,
                "encrypted": encryption_metadata.get("encrypted", False),
            }

            # Set up document permissions
            if sharing_permissions:
                for target_user, permission_level in sharing_permissions.items():
                    await self.security.grant_document_access(
                        document_id, target_user, user_id, permission_level
                    )

            # Grant owner permissions to creator
            await self.security.grant_document_access(
                document_id, user_id, user_id, "owner"
            )

            # Audit log
            if self.config.audit_all_operations:
                await self.security.log_document_activity(
                    "created",
                    document_id,
                    user_id,
                    f"Created document: {title}",
                    {
                        "title": title,
                        "category": category,
                        "tags": tags or [],
                        "encrypted": encryption_metadata.get("encrypted", False),
                        "sharing_permissions": list(sharing_permissions.keys())
                        if sharing_permissions
                        else [],
                    },
                )

            return result

        except Exception as e:
            self.logger.error(f"Failed to create document: {e}")
            await self.security.log_security_violation(
                f"Document creation failed: {e}",
                user_id,
                context.get("ip_address") if context else None,
            )
            return {"success": False, "error": f"Document creation failed: {e}"}

    async def get_document(
        self,
        document_id: str,
        user_id: str,
        decrypt_content: bool = True,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Get document with security checks and decryption"""
        # Authentication check
        if self.config.require_authentication and not user_id:
            return {"success": False, "error": "Authentication required"}

        # Document permission check
        permission_result = await self.security.check_document_permission(
            document_id, user_id, "view", context
        )

        if not permission_result["has_permission"]:
            await self.security.log_security_violation(
                f"Unauthorized document access attempt: {document_id}",
                user_id,
                context.get("ip_address") if context else None,
            )
            return {"success": False, "error": "Permission denied"}

        try:
            # Retrieve document (would integrate with RAG storage)
            # For now, simulate document retrieval
            document = {
                "document_id": document_id,
                "title": "Sample Document",
                "content": "encrypted_content_here",
                "metadata": {
                    "created_by": user_id,
                    "encrypted": True,
                    "encryption_key_id": "key_123",
                    "encryption_algorithm": "aes-256-gcm",
                    "encryption_nonce": "nonce_data",
                    "encryption_tag": "tag_data",
                },
            }

            # Decrypt content if encrypted and requested
            if (
                decrypt_content
                and document["metadata"].get("encrypted")
                and "encryption_key_id" in document["metadata"]
            ):
                decryption_result = await self.security.encryption.decrypt_data(
                    document["content"],
                    document["metadata"]["encryption_key_id"],
                    document["metadata"]["encryption_nonce"],
                    document["metadata"].get("encryption_tag"),
                )

                if decryption_result.success:
                    document["content"] = decryption_result.decrypted_data
                    document["decrypted"] = True
                else:
                    self.logger.warning(
                        f"Failed to decrypt document {document_id}: {decryption_result.error_message}"
                    )
                    document["decryption_error"] = decryption_result.error_message

            # Audit log
            if self.config.audit_all_operations:
                await self.security.log_document_activity(
                    "viewed",
                    document_id,
                    user_id,
                    f"Accessed document: {document.get('title', 'Unknown')}",
                    {
                        "decrypted": document.get("decrypted", False),
                        "permission_level": permission_result["effective_permission"],
                    },
                )

            return {
                "success": True,
                "document": document,
                "permission_level": permission_result["effective_permission"],
                "restrictions": permission_result.get("restrictions", {}),
            }

        except Exception as e:
            self.logger.error(f"Failed to get document {document_id}: {e}")
            return {"success": False, "error": f"Document retrieval failed: {e}"}

    async def update_document(
        self,
        document_id: str,
        user_id: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Update document with security checks"""
        # Authentication check
        if self.config.require_authentication and not user_id:
            return {"success": False, "error": "Authentication required"}

        # Permission check - user can edit document
        permission_result = await self.security.check_document_permission(
            document_id, user_id, "edit", context
        )

        if not permission_result["has_permission"]:
            await self.security.log_security_violation(
                f"Unauthorized document edit attempt: {document_id}",
                user_id,
                context.get("ip_address") if context else None,
            )
            return {"success": False, "error": "Permission denied"}

        try:
            # Get current document state for audit trail
            current_doc = await self.get_document(document_id, user_id, True, context)
            if not current_doc["success"]:
                return current_doc

            before_state = {
                "title": current_doc["document"]["title"],
                "content_length": len(current_doc["document"].get("content", "")),
                "metadata": current_doc["document"]["metadata"],
            }

            # Encrypt new content if provided
            encrypted_content = None
            encryption_metadata = {}

            if content and self.config.enable_document_encryption:
                encryption_result = await self.security.encrypt_sensitive_data(
                    content, f"document_content_update", user_id
                )

                if encryption_result.success:
                    encrypted_content = encryption_result.encrypted_data
                    encryption_metadata = {
                        "encrypted": True,
                        "encryption_key_id": encryption_result.key_id,
                        "encryption_algorithm": encryption_result.algorithm,
                        "encryption_nonce": encryption_result.nonce,
                        "encryption_tag": encryption_result.tag,
                    }

            # Update document (would integrate with RAG storage)
            # For now, simulate successful update
            after_state = {
                "title": title or before_state["title"],
                "content_length": len(content)
                if content
                else before_state["content_length"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": user_id,
                **encryption_metadata,
            }

            # Audit log with before/after state
            if self.config.audit_all_operations:
                await self.security.log_document_activity(
                    "modified",
                    document_id,
                    user_id,
                    f"Updated document: {title or before_state['title']}",
                    {
                        "fields_updated": [
                            k
                            for k, v in {
                                "title": title,
                                "content": content,
                                "metadata": metadata,
                            }.items()
                            if v is not None
                        ],
                        "encrypted": encryption_metadata.get("encrypted", False),
                    },
                )

            return {
                "success": True,
                "document_id": document_id,
                "updated_fields": list(after_state.keys()),
                "encrypted": encryption_metadata.get("encrypted", False),
            }

        except Exception as e:
            self.logger.error(f"Failed to update document {document_id}: {e}")
            return {"success": False, "error": f"Document update failed: {e}"}

    async def delete_document(
        self, document_id: str, user_id: str, context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Delete document with security checks"""
        # Authentication check
        if self.config.require_authentication and not user_id:
            return {"success": False, "error": "Authentication required"}

        # Permission check - user can manage document
        permission_result = await self.security.check_document_permission(
            document_id, user_id, "manage", context
        )

        if not permission_result["has_permission"]:
            await self.security.log_security_violation(
                f"Unauthorized document deletion attempt: {document_id}",
                user_id,
                context.get("ip_address") if context else None,
            )
            return {"success": False, "error": "Permission denied"}

        try:
            # Get document info before deletion for audit
            current_doc = await self.get_document(document_id, user_id, False, context)
            if current_doc["success"]:
                doc_info = {
                    "title": current_doc["document"].get("title", "Unknown"),
                    "created_by": current_doc["document"]["metadata"].get("created_by"),
                    "encrypted": current_doc["document"]["metadata"].get(
                        "encrypted", False
                    ),
                }
            else:
                doc_info = {"title": "Unknown"}

            # Delete document (would integrate with RAG storage)
            # For now, simulate successful deletion

            # Audit log
            if self.config.audit_all_operations:
                await self.security.log_document_activity(
                    "deleted",
                    document_id,
                    user_id,
                    f"Deleted document: {doc_info['title']}",
                    doc_info,
                )

            return {
                "success": True,
                "document_id": document_id,
                "deleted_document": doc_info,
            }

        except Exception as e:
            self.logger.error(f"Failed to delete document {document_id}: {e}")
            return {"success": False, "error": f"Document deletion failed: {e}"}

    # ==================== SECURE SEARCH OPERATIONS ====================

    async def search_documents(
        self,
        query: str,
        user_id: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 20,
        use_semantic_search: bool = True,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Search documents with security filtering"""
        # Authentication check
        if self.config.require_authentication and not user_id:
            return {"success": False, "error": "Authentication required"}

        # Permission check - user can read documents
        auth_result = await self.security.check_permission(
            user_id, "document", "read", context=context
        )

        if not auth_result.has_permission:
            return {"success": False, "error": "Permission denied"}

        try:
            # Get user's accessible documents
            accessible_docs = (
                await self.security.doc_permissions.get_user_accessible_documents(
                    user_id, PermissionLevel.VIEW
                )
            )

            accessible_doc_ids = [doc["document_id"] for doc in accessible_docs]

            # Add document access filter
            security_filters = {
                **(filters or {}),
                "document_ids": accessible_doc_ids,
                "user_id": user_id,
            }

            # Perform search (would integrate with RAG storage)
            # For now, simulate search results
            search_results = [
                EnhancedSearchResult(
                    document_id=f"doc_{i}",
                    title=f"Document {i}",
                    content_snippet=f"Content snippet for document {i} matching '{query}'",
                    relevance_score=0.9 - (i * 0.1),
                    match_type="semantic" if use_semantic_search else "keyword",
                    source="secure_storage",
                    similarity_score=0.85 - (i * 0.1) if use_semantic_search else None,
                    category="proposal",
                    tags=["secure", "sample"],
                )
                for i in range(min(3, limit))
                if f"doc_{i}" in accessible_doc_ids[:3]
            ]

            # Audit log
            if self.config.audit_all_operations:
                await self.security.audit.log_event(
                    event_type=AuditEventType.DOCUMENT_VIEWED,
                    action="search_documents",
                    description=f"Searched documents with query: {query}",
                    user_id=user_id,
                    severity=AuditSeverity.LOW,
                    details={
                        "query": query,
                        "results_count": len(search_results),
                        "semantic_search": use_semantic_search,
                        "filters": filters,
                    },
                )

            return {
                "success": True,
                "query": query,
                "results": search_results,
                "total_results": len(search_results),
                "accessible_documents": len(accessible_doc_ids),
                "security_filtered": True,
            }

        except Exception as e:
            self.logger.error(f"Search failed for user {user_id}: {e}")
            return {"success": False, "error": f"Search failed: {e}"}

    # ==================== SHARING AND COLLABORATION ====================

    async def share_document(
        self,
        document_id: str,
        shared_by: str,
        target_user_id: Optional[str] = None,
        target_email: Optional[str] = None,
        permission_level: str = "view",
        expires_in_days: Optional[int] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Share document with another user"""
        # Authentication check
        if self.config.require_authentication and not shared_by:
            return {"success": False, "error": "Authentication required"}

        # Permission check - user can share document
        permission_result = await self.security.check_document_permission(
            document_id, shared_by, "manage", context
        )

        if not permission_result["has_permission"]:
            return {
                "success": False,
                "error": "Permission denied - cannot share document",
            }

        # Check sharing restrictions
        if not permission_result.get("restrictions", {}).get("can_share", True):
            return {"success": False, "error": "Sharing not allowed for this document"}

        try:
            # Grant document access
            access_id = await self.security.grant_document_access(
                document_id=document_id,
                user_id=target_user_id,
                granted_by=shared_by,
                permission_level=permission_level,
                expires_in_days=expires_in_days,
            )

            # Audit log
            if self.config.audit_all_operations:
                await self.security.log_document_activity(
                    "shared",
                    document_id,
                    shared_by,
                    f"Shared document with {'user ' + target_user_id if target_user_id else 'email ' + target_email}",
                    {
                        "target_user_id": target_user_id,
                        "target_email": target_email,
                        "permission_level": permission_level,
                        "expires_in_days": expires_in_days,
                        "access_id": access_id,
                    },
                )

            return {
                "success": True,
                "access_id": access_id,
                "document_id": document_id,
                "permission_level": permission_level,
                "expires_in_days": expires_in_days,
            }

        except Exception as e:
            self.logger.error(f"Failed to share document {document_id}: {e}")
            return {"success": False, "error": f"Document sharing failed: {e}"}

    async def create_share_link(
        self,
        document_id: str,
        created_by: str,
        permission_level: str = "view",
        expires_in_days: Optional[int] = 7,
        password: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create shareable link for document"""
        # Authentication and permission checks
        if self.config.require_authentication and not created_by:
            return {"success": False, "error": "Authentication required"}

        permission_result = await self.security.check_document_permission(
            document_id, created_by, "manage", context
        )

        if not permission_result["has_permission"]:
            return {"success": False, "error": "Permission denied"}

        try:
            share_link = await self.security.create_document_share_link(
                document_id=document_id,
                created_by=created_by,
                permission_level=permission_level,
                expires_in_days=expires_in_days,
                password=password,
            )

            return {
                "success": True,
                "share_link": share_link,
                "expires_in_days": expires_in_days,
                "permission_level": permission_level,
                "password_protected": password is not None,
            }

        except Exception as e:
            self.logger.error(f"Failed to create share link for {document_id}: {e}")
            return {"success": False, "error": f"Share link creation failed: {e}"}

    # ==================== SECURITY MANAGEMENT ====================

    async def get_user_documents(
        self,
        user_id: str,
        include_shared: bool = True,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Get all documents accessible to user"""
        if self.config.require_authentication and not user_id:
            return {"success": False, "error": "Authentication required"}

        try:
            # Get user's accessible documents
            accessible_docs = (
                await self.security.doc_permissions.get_user_accessible_documents(
                    user_id, PermissionLevel.VIEW
                )
            )

            # Get user security summary
            security_summary = await self.security.get_user_security_summary(user_id)

            return {
                "success": True,
                "user_id": user_id,
                "accessible_documents": accessible_docs,
                "security_summary": security_summary,
                "total_documents": len(accessible_docs),
            }

        except Exception as e:
            self.logger.error(f"Failed to get user documents for {user_id}: {e}")
            return {"success": False, "error": f"Failed to get user documents: {e}"}

    async def get_security_metrics(self) -> Dict[str, Any]:
        """Get security metrics for the storage system"""
        security_metrics = await self.security.get_security_metrics()

        # Add storage-specific metrics
        return {
            **security_metrics,
            "secure_storage_version": "1.0.0",
            "encryption_enabled": self.config.enable_document_encryption,
            "audit_enabled": self.config.audit_all_operations,
            "authentication_required": self.config.require_authentication,
        }

    async def cleanup_security_data(self) -> Dict[str, Any]:
        """Clean up expired security data"""
        return await self.security.cleanup_expired_security_data()

    async def close(self):
        """Clean shutdown of secure storage service"""
        await self.security.close()
        # Would also close RAG storage service
        self.logger.info("Secure storage service closed")

# Factory function
def create_secure_storage_service(
    config: SecureStorageConfiguration,
) -> SecureStorageService:
    """Create SecureStorageService instance with configuration"""
    return SecureStorageService(config)
