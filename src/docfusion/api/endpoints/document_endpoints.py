#!/usr/bin/env python3
"""
Document Endpoints

FastAPI endpoints for document CRUD operations including creation, retrieval,
updating, deletion, and rendering with comprehensive security integration.
"""

import asyncio
import logging
from datetime import timezone, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi import Path as PathParam
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator

from ...document_engine.secure_document_engine import SecureDocumentEngine
from ...security import SecurityManager
from ...storage.secure_storage_service import SecureStorageService
from ..middleware.authentication_middleware import get_api_key_user, get_current_user
from ...core.utils import uuid7str
from ..serializers.document_serializers import (
    DocumentCreateRequest,
    DocumentHistoryResponse,
    DocumentListResponse,
    DocumentResponse,
    DocumentUpdateRequest,
    RenderRequest,
)

class DocumentEndpoints:
    """FastAPI document endpoints with security integration"""

    def __init__(
        self,
        storage_service: SecureStorageService,
        document_engine: SecureDocumentEngine,
        security_manager: SecurityManager,
    ):
        self.storage = storage_service
        self.document_engine = document_engine
        self.security = security_manager
        self.logger = logging.getLogger(__name__)

        # Create FastAPI router
        self.router = APIRouter(prefix="/api/v1/documents", tags=["documents"])

        # Register endpoints
        self._register_endpoints()

        self.logger.info("Document endpoints initialized")

    def _register_endpoints(self):
        """Register all document endpoints"""

        @self.router.post("/", response_model=DocumentResponse, status_code=201)
        async def create_document(
            request: DocumentCreateRequest,
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Create a new document"""
            return await self.create_document_handler(request, current_user)

        @self.router.get("/{document_id}", response_model=DocumentResponse)
        async def get_document(
            document_id: str = PathParam(..., description="Document ID"),
            include_content: bool = Query(True, description="Include document content"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Get document by ID"""
            return await self.get_document_handler(
                document_id, include_content, current_user
            )

        @self.router.get("/", response_model=DocumentListResponse)
        async def list_documents(
            page: int = Query(1, ge=1, description="Page number"),
            limit: int = Query(20, ge=1, le=100, description="Items per page"),
            category: Optional[str] = Query(None, description="Filter by category"),
            tags: Optional[List[str]] = Query(None, description="Filter by tags"),
            search: Optional[str] = Query(None, description="Search query"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """List documents with pagination and filtering"""
            return await self.list_documents_handler(
                page, limit, category, tags, search, current_user
            )

        @self.router.put("/{document_id}", response_model=DocumentResponse)
        async def update_document(
            document_id: str = PathParam(..., description="Document ID"),
            request: DocumentUpdateRequest = ...,
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Update document by ID"""
            return await self.update_document_handler(
                document_id, request, current_user
            )

        @self.router.delete("/{document_id}", status_code=204)
        async def delete_document(
            document_id: str = PathParam(..., description="Document ID"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Delete document by ID"""
            await self.delete_document_handler(document_id, current_user)

        @self.router.post("/{document_id}/render", response_class=StreamingResponse)
        async def render_document(
            document_id: str = PathParam(..., description="Document ID"),
            request: RenderRequest = ...,
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Render document to specified format"""
            return await self.render_document_handler(
                document_id, request, current_user
            )

        @self.router.get(
            "/{document_id}/history", response_model=DocumentHistoryResponse
        )
        async def get_document_history(
            document_id: str = PathParam(..., description="Document ID"),
            limit: int = Query(10, ge=1, le=50, description="Number of history items"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Get document version history"""
            return await self.get_document_history_handler(
                document_id, limit, current_user
            )

        @self.router.post("/{document_id}/share", response_model=Dict[str, Any])
        async def share_document(
            document_id: str = PathParam(..., description="Document ID"),
            target_user_id: Optional[str] = Query(None, description="Target user ID"),
            target_email: Optional[str] = Query(None, description="Target email"),
            permission_level: str = Query("view", description="Permission level"),
            expires_in_days: Optional[int] = Query(
                None, description="Expiration in days"
            ),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Share document with another user"""
            return await self.share_document_handler(
                document_id,
                target_user_id,
                target_email,
                permission_level,
                expires_in_days,
                current_user,
            )

        @self.router.post("/{document_id}/share-link", response_model=Dict[str, Any])
        async def create_share_link(
            document_id: str = PathParam(..., description="Document ID"),
            permission_level: str = Query("view", description="Permission level"),
            expires_in_days: Optional[int] = Query(7, description="Expiration in days"),
            password: Optional[str] = Query(None, description="Optional password"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Create shareable link for document"""
            return await self.create_share_link_handler(
                document_id, permission_level, expires_in_days, password, current_user
            )

        @self.router.post("/upload", response_model=DocumentResponse, status_code=201)
        async def upload_document(
            file: UploadFile = File(..., description="Document file to upload"),
            title: Optional[str] = Query(None, description="Document title"),
            category: Optional[str] = Query(None, description="Document category"),
            tags: Optional[List[str]] = Query(None, description="Document tags"),
            extract_content: bool = Query(
                True, description="Extract and process content"
            ),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Upload and process document file"""
            return await self.upload_document_handler(
                file, title, category, tags, extract_content, current_user
            )

        @self.router.get("/search", response_model=DocumentListResponse)
        async def search_documents(
            query: str = Query(..., description="Search query"),
            search_type: str = Query(
                "hybrid", description="Search type: full_text, semantic, hybrid"
            ),
            limit: int = Query(20, ge=1, le=100, description="Maximum results"),
            similarity_threshold: Optional[float] = Query(
                None, description="Similarity threshold for semantic search"
            ),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Advanced document search with semantic capabilities"""
            return await self.search_documents_handler(
                query, search_type, limit, similarity_threshold, current_user
            )

    # ==================== ENDPOINT HANDLERS ====================

    async def create_document_handler(
        self, request: DocumentCreateRequest, current_user: Dict[str, Any]
    ) -> DocumentResponse:
        """Handle document creation"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Create document through secure storage
            result = await self.storage.create_document(
                title=request.title,
                content=request.content,
                user_id=user_id,
                category=request.category or "",
                tags=request.tags or [],
                metadata=request.metadata or {},
                encrypt_content=request.encrypt_content,
                sharing_permissions=request.sharing_permissions,
                context=context,
            )

            if not result["success"]:
                raise HTTPException(
                    status_code=400,
                    detail=result.get("error", "Failed to create document"),
                )

            # Get the created document
            document = await self.storage.get_document(
                result["document_id"], user_id, context=context
            )

            if not document["success"]:
                raise HTTPException(
                    status_code=500, detail="Failed to retrieve created document"
                )

            return DocumentResponse(
                document_id=result["document_id"],
                title=request.title,
                content=request.content,
                category=request.category or "",
                tags=request.tags or [],
                metadata=request.metadata or {},
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
                created_by=user_id,
                encrypted=result.get("encrypted", False),
                permission_level=document.get("permission_level", "owner"),
            )

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Document creation failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def get_document_handler(
        self, document_id: str, include_content: bool, current_user: Dict[str, Any]
    ) -> DocumentResponse:
        """Handle document retrieval"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            result = await self.storage.get_document(
                document_id=document_id,
                user_id=user_id,
                decrypt_content=include_content,
                context=context,
            )

            if not result["success"]:
                if "Permission denied" in result.get("error", ""):
                    raise HTTPException(status_code=403, detail="Access denied")
                raise HTTPException(status_code=404, detail="Document not found")

            document = result["document"]

            return DocumentResponse(
                document_id=document_id,
                title=document.get("title", ""),
                content=document.get("content", "") if include_content else "",
                category=document.get("metadata", {}).get("category", ""),
                tags=document.get("metadata", {}).get("tags", []),
                metadata=document.get("metadata", {}),
                created_at=document.get("metadata", {}).get("created_at"),
                updated_at=document.get("metadata", {}).get("updated_at"),
                created_by=document.get("metadata", {}).get("created_by"),
                encrypted=document.get("metadata", {}).get("encrypted", False),
                permission_level=result.get("permission_level", "view"),
            )

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Document retrieval failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def list_documents_handler(
        self,
        page: int,
        limit: int,
        category: Optional[str],
        tags: Optional[List[str]],
        search: Optional[str],
        current_user: Dict[str, Any],
    ) -> DocumentListResponse:
        """Handle document listing with pagination"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Get user's accessible documents
            user_docs_result = await self.storage.get_user_documents(
                user_id=user_id, include_shared=True, context=context
            )

            if not user_docs_result["success"]:
                raise HTTPException(
                    status_code=500, detail="Failed to retrieve user documents"
                )

            accessible_docs = user_docs_result["accessible_documents"]

            # Apply filters
            filtered_docs = accessible_docs

            if category:
                filtered_docs = [
                    doc
                    for doc in filtered_docs
                    if doc.get("metadata", {}).get("category") == category
                ]

            if tags:
                filtered_docs = [
                    doc
                    for doc in filtered_docs
                    if any(
                        tag in doc.get("metadata", {}).get("tags", []) for tag in tags
                    )
                ]

            if search:
                # Perform search if query provided
                search_result = await self.storage.search_documents(
                    query=search,
                    user_id=user_id,
                    limit=limit * 2,  # Get more results for filtering
                    context=context,
                )

                if search_result["success"]:
                    search_doc_ids = {
                        result.document_id for result in search_result["results"]
                    }
                    filtered_docs = [
                        doc
                        for doc in filtered_docs
                        if doc["document_id"] in search_doc_ids
                    ]

            # Pagination
            total = len(filtered_docs)
            offset = (page - 1) * limit
            page_docs = filtered_docs[offset : offset + limit]

            # Convert to response format
            documents = []
            for doc in page_docs:
                documents.append(
                    DocumentResponse(
                        document_id=doc["document_id"],
                        title=doc.get("title", ""),
                        content="",  # Don't include content in list
                        category=doc.get("metadata", {}).get("category", ""),
                        tags=doc.get("metadata", {}).get("tags", []),
                        metadata=doc.get("metadata", {}),
                        created_at=doc.get("metadata", {}).get("created_at"),
                        updated_at=doc.get("metadata", {}).get("updated_at"),
                        created_by=doc.get("metadata", {}).get("created_by"),
                        encrypted=doc.get("metadata", {}).get("encrypted", False),
                        permission_level=doc.get("permission_level", "view"),
                    )
                )

            return DocumentListResponse(
                documents=documents,
                total=total,
                page=page,
                limit=limit,
                total_pages=(total + limit - 1) // limit,
            )

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Document listing failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def update_document_handler(
        self,
        document_id: str,
        request: DocumentUpdateRequest,
        current_user: Dict[str, Any],
    ) -> DocumentResponse:
        """Handle document updates"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            result = await self.storage.update_document(
                document_id=document_id,
                user_id=user_id,
                title=request.title,
                content=request.content,
                metadata=request.metadata,
                context=context,
            )

            if not result["success"]:
                if "Permission denied" in result.get("error", ""):
                    raise HTTPException(status_code=403, detail="Access denied")
                raise HTTPException(
                    status_code=400,
                    detail=result.get("error", "Failed to update document"),
                )

            # Get updated document
            updated_doc = await self.get_document_handler(
                document_id, True, current_user
            )
            return updated_doc

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Document update failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def delete_document_handler(
        self, document_id: str, current_user: Dict[str, Any]
    ):
        """Handle document deletion"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            result = await self.storage.delete_document(
                document_id=document_id, user_id=user_id, context=context
            )

            if not result["success"]:
                if "Permission denied" in result.get("error", ""):
                    raise HTTPException(status_code=403, detail="Access denied")
                raise HTTPException(status_code=404, detail="Document not found")

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Document deletion failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def render_document_handler(
        self, document_id: str, request: RenderRequest, current_user: Dict[str, Any]
    ) -> StreamingResponse:
        """Handle document rendering"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Get document first
            doc_result = await self.storage.get_document(
                document_id=document_id,
                user_id=user_id,
                decrypt_content=True,
                context=context,
            )

            if not doc_result["success"]:
                if "Permission denied" in doc_result.get("error", ""):
                    raise HTTPException(status_code=403, detail="Access denied")
                raise HTTPException(status_code=404, detail="Document not found")

            document = doc_result["document"]

            # Generate document using document engine
            generation_result = await self.document_engine.generate_document(
                template_id=request.template_id or "default",
                content_data={
                    "title": document.get("title", ""),
                    "content": document.get("content", ""),
                    "metadata": document.get("metadata", {}),
                },
                user_id=user_id,
                output_format=request.output_format,
                classification=request.classification,
                metadata=request.metadata,
                context=context,
            )

            if not generation_result["success"]:
                raise HTTPException(
                    status_code=400,
                    detail=generation_result.get("error", "Document generation failed"),
                )

            # Return file stream (simulated)
            file_path = generation_result["file_path"]

            def generate_file_content():
                # In production, this would stream the actual generated file
                yield f"Generated {request.output_format.upper()} content for document {document_id}\n"
                yield f"Title: {document.get('title', '')}\n"
                yield f"Generated at: {generation_result['generated_at']}\n"
                yield f"Format: {request.output_format}\n"

            headers = {
                "Content-Disposition": f'attachment; filename="{document_id}.{request.output_format}"'
            }

            media_type = {
                "pdf": "application/pdf",
                "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "html": "text/html",
            }.get(request.output_format, "application/octet-stream")

            return StreamingResponse(
                generate_file_content(), media_type=media_type, headers=headers
            )

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Document rendering failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def get_document_history_handler(
        self, document_id: str, limit: int, current_user: Dict[str, Any]
    ) -> DocumentHistoryResponse:
        """Handle document history retrieval"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Check document access first
            doc_result = await self.storage.get_document(
                document_id=document_id,
                user_id=user_id,
                decrypt_content=False,
                context=context,
            )

            if not doc_result["success"]:
                if "Permission denied" in doc_result.get("error", ""):
                    raise HTTPException(status_code=403, detail="Access denied")
                raise HTTPException(status_code=404, detail="Document not found")

            # Simulate history (in production, would get from version control)
            history = [
                {
                    "version": "1.0",
                    "changed_at": datetime.now(timezone.utc).isoformat(),
                    "changed_by": user_id,
                    "changes": ["Initial creation"],
                    "comment": "Document created",
                }
            ]

            return DocumentHistoryResponse(document_id=document_id, history=history)

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Document history retrieval failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def share_document_handler(
        self,
        document_id: str,
        target_user_id: Optional[str],
        target_email: Optional[str],
        permission_level: str,
        expires_in_days: Optional[int],
        current_user: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Handle document sharing"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            result = await self.storage.share_document(
                document_id=document_id,
                shared_by=user_id,
                target_user_id=target_user_id,
                target_email=target_email,
                permission_level=permission_level,
                expires_in_days=expires_in_days,
                context=context,
            )

            if not result["success"]:
                if "Permission denied" in result.get("error", ""):
                    raise HTTPException(status_code=403, detail="Access denied")
                raise HTTPException(
                    status_code=400,
                    detail=result.get("error", "Failed to share document"),
                )

            return {
                "success": True,
                "access_id": result["access_id"],
                "message": "Document shared successfully",
            }

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Document sharing failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def create_share_link_handler(
        self,
        document_id: str,
        permission_level: str,
        expires_in_days: Optional[int],
        password: Optional[str],
        current_user: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Handle share link creation"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            result = await self.storage.create_share_link(
                document_id=document_id,
                created_by=user_id,
                permission_level=permission_level,
                expires_in_days=expires_in_days,
                password=password,
                context=context,
            )

            if not result["success"]:
                if "Permission denied" in result.get("error", ""):
                    raise HTTPException(status_code=403, detail="Access denied")
                raise HTTPException(
                    status_code=400,
                    detail=result.get("error", "Failed to create share link"),
                )

            return {
                "success": True,
                "share_link": result["share_link"],
                "expires_in_days": expires_in_days,
                "password_protected": password is not None,
            }

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Share link creation failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def upload_document_handler(
        self,
        file: UploadFile,
        title: Optional[str],
        category: Optional[str],
        tags: Optional[List[str]],
        extract_content: bool,
        current_user: Dict[str, Any],
    ) -> DocumentResponse:
        """Handle document upload and processing"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Read file content
            file_content = await file.read()

            # Extract text content if requested (simplified)
            if extract_content:
                if file.content_type == "text/plain":
                    content = file_content.decode("utf-8")
                else:
                    content = f"Uploaded file: {file.filename} ({file.content_type})"
            else:
                content = f"Uploaded file: {file.filename}"

            # Create document
            create_request = DocumentCreateRequest(
                title=title or file.filename or "Uploaded Document",
                content=content,
                category=category,
                tags=tags,
                metadata={
                    "original_filename": file.filename,
                    "content_type": file.content_type,
                    "file_size": len(file_content),
                    "uploaded": True,
                },
            )

            return await self.create_document_handler(create_request, current_user)

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Document upload failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def search_documents_handler(
        self,
        query: str,
        search_type: str,
        limit: int,
        similarity_threshold: Optional[float],
        current_user: Dict[str, Any],
    ) -> DocumentListResponse:
        """Handle advanced document search"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Build filters for user access
            filters = {"user_id": user_id}

            # Perform search using storage service
            result = await self.storage.search_documents(
                query=query,
                user_id=user_id,
                filters=filters,
                limit=limit,
                use_semantic_search=search_type in ["semantic", "hybrid"],
                context=context,
            )

            if not result["success"]:
                raise HTTPException(
                    status_code=400, detail=result.get("error", "Search failed")
                )

            # Convert search results to document responses
            documents = []
            for search_result in result["results"]:
                documents.append(
                    DocumentResponse(
                        document_id=search_result.document_id,
                        title=search_result.title,
                        content=search_result.content_snippet,
                        category=search_result.category,
                        tags=search_result.tags,
                        metadata=search_result.metadata,
                        created_at=None,  # Would get from metadata in production
                        updated_at=None,
                        created_by=None,
                        encrypted=False,
                        permission_level="view",
                        relevance_score=search_result.relevance_score,
                        match_type=search_result.match_type,
                    )
                )

            return DocumentListResponse(
                documents=documents,
                total=result["total_results"],
                page=1,
                limit=limit,
                total_pages=1,
                search_query=query,
                search_type=search_type,
            )

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Document search failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    # ==================== HELPER METHODS ====================

    def _build_request_context(self, current_user: Dict[str, Any]) -> Dict[str, Any]:
        """Build request context from user information"""
        return {
            "user_id": current_user["user_id"],
            "ip_address": current_user.get("ip_address"),
            "user_agent": current_user.get("user_agent"),
            "session_id": current_user.get("session_id"),
            "permissions": current_user.get("permissions", []),
        }

# Factory function
def create_document_endpoints(
    storage_service: SecureStorageService,
    document_engine: SecureDocumentEngine,
    security_manager: SecurityManager,
) -> DocumentEndpoints:
    """Create DocumentEndpoints instance with services"""
    return DocumentEndpoints(storage_service, document_engine, security_manager)
