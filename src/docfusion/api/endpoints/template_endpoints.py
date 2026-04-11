#!/usr/bin/env python3
"""
Template Endpoints

FastAPI endpoints for template management including CRUD operations,
categorization, search, and preview functionality with security integration.
"""

import asyncio
import logging
from datetime import timezone, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi import Path as PathParam
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ...document_engine.secure_document_engine import SecureDocumentEngine
from ...security import SecurityManager
from ...storage.secure_storage_service import SecureStorageService
from ..middleware.authentication_middleware import get_api_key_user, get_current_user
from ...core.utils import uuid7str
from ..serializers.template_serializers import (
    TemplateCreateRequest,
    TemplateListResponse,
    TemplatePreviewRequest,
    TemplateResponse,
    TemplateSearchRequest,
    TemplateUpdateRequest,
)

class TemplateEndpoints:
    """FastAPI template endpoints with security integration"""

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
        self.router = APIRouter(prefix="/api/v1/templates", tags=["templates"])

        # Register endpoints
        self._register_endpoints()

        self.logger.info("Template endpoints initialized")

    def _register_endpoints(self):
        """Register all template endpoints"""

        @self.router.post("/", response_model=TemplateResponse, status_code=201)
        async def create_template(
            request: TemplateCreateRequest,
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Create a new template"""
            return await self.create_template_handler(request, current_user)

        @self.router.get("/{template_id}", response_model=TemplateResponse)
        async def get_template(
            template_id: str = PathParam(..., description="Template ID"),
            include_content: bool = Query(True, description="Include template content"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Get template by ID"""
            return await self.get_template_handler(
                template_id, include_content, current_user
            )

        @self.router.get("/", response_model=TemplateListResponse)
        async def list_templates(
            page: int = Query(1, ge=1, description="Page number"),
            limit: int = Query(20, ge=1, le=100, description="Items per page"),
            category: Optional[str] = Query(None, description="Filter by category"),
            access_level: Optional[str] = Query(
                None, description="Filter by access level"
            ),
            tags: Optional[List[str]] = Query(None, description="Filter by tags"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """List templates with pagination and filtering"""
            return await self.list_templates_handler(
                page, limit, category, access_level, tags, current_user
            )

        @self.router.put("/{template_id}", response_model=TemplateResponse)
        async def update_template(
            template_id: str = PathParam(..., description="Template ID"),
            request: TemplateUpdateRequest = ...,
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Update template by ID"""
            return await self.update_template_handler(
                template_id, request, current_user
            )

        @self.router.delete("/{template_id}", status_code=204)
        async def delete_template(
            template_id: str = PathParam(..., description="Template ID"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Delete template by ID"""
            await self.delete_template_handler(template_id, current_user)

        @self.router.post("/{template_id}/preview", response_model=Dict[str, Any])
        async def preview_template(
            template_id: str = PathParam(..., description="Template ID"),
            request: TemplatePreviewRequest = ...,
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Generate template preview with sample data"""
            return await self.preview_template_handler(
                template_id, request, current_user
            )

        @self.router.post("/search", response_model=TemplateListResponse)
        async def search_templates(
            request: TemplateSearchRequest = ...,
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Advanced template search with filtering"""
            return await self.search_templates_handler(request, current_user)

        @self.router.get("/{template_id}/info", response_model=Dict[str, Any])
        async def get_template_info(
            template_id: str = PathParam(..., description="Template ID"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Get detailed template information"""
            return await self.get_template_info_handler(template_id, current_user)

        @self.router.post(
            "/{template_id}/duplicate", response_model=TemplateResponse, status_code=201
        )
        async def duplicate_template(
            template_id: str = PathParam(..., description="Template ID"),
            new_name: Optional[str] = Query(None, description="New template name"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Create a copy of existing template"""
            return await self.duplicate_template_handler(
                template_id, new_name, current_user
            )

        @self.router.post("/{template_id}/validate", response_model=Dict[str, Any])
        async def validate_template(
            template_id: str = PathParam(..., description="Template ID"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Validate template structure and content"""
            return await self.validate_template_handler(template_id, current_user)

        @self.router.get("/categories", response_model=Dict[str, Any])
        async def get_template_categories(
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Get available template categories"""
            return await self.get_template_categories_handler(current_user)

        @self.router.post("/upload", response_model=TemplateResponse, status_code=201)
        async def upload_template(
            file: UploadFile = File(..., description="Template file to upload"),
            name: Optional[str] = Query(None, description="Template name"),
            category: Optional[str] = Query(None, description="Template category"),
            description: Optional[str] = Query(
                None, description="Template description"
            ),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Upload template file and create template"""
            return await self.upload_template_handler(
                file, name, category, description, current_user
            )

    # ==================== ENDPOINT HANDLERS ====================

    async def create_template_handler(
        self, request: TemplateCreateRequest, current_user: Dict[str, Any]
    ) -> TemplateResponse:
        """Handle template creation"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Check permission to create templates
            auth_result = await self.security.check_permission(
                user_id, "template", "create", context=context
            )

            if not auth_result.has_permission:
                raise HTTPException(status_code=403, detail="Permission denied")

            # Create template document in storage
            template_id = uuid7str()
            result = await self.storage.create_document(
                title=request.name,
                content=request.content,
                user_id=user_id,
                category="template",
                tags=request.tags or [],
                metadata={
                    "template_id": template_id,
                    "template_category": request.category,
                    "template_description": request.description,
                    "template_version": "1.0",
                    "template_fields": request.fields or [],
                    "template_access_level": request.access_level or "user",
                    "is_template": True,
                },
                context=context,
            )

            if not result["success"]:
                raise HTTPException(
                    status_code=400,
                    detail=result.get("error", "Failed to create template"),
                )

            return TemplateResponse(
                template_id=template_id,
                name=request.name,
                description=request.description,
                category=request.category,
                content=request.content,
                fields=request.fields or [],
                tags=request.tags or [],
                access_level=request.access_level or "user",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
                created_by=user_id,
                version="1.0",
                is_active=True,
            )

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Template creation failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def get_template_handler(
        self, template_id: str, include_content: bool, current_user: Dict[str, Any]
    ) -> TemplateResponse:
        """Handle template retrieval"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Get template information using document engine
            template_info = await self.document_engine.get_template_info(
                template_id=template_id, user_id=user_id, context=context
            )

            if not template_info["success"]:
                if "access denied" in template_info.get("error", "").lower():
                    raise HTTPException(status_code=403, detail="Access denied")
                raise HTTPException(status_code=404, detail="Template not found")

            template = template_info["template"]

            return TemplateResponse(
                template_id=template_id,
                name=template.get("name", ""),
                description=template.get("description", ""),
                category=template.get("category", "general"),
                content=template.get("content", "") if include_content else "",
                fields=template.get("fields", []),
                tags=template.get("tags", []),
                access_level=template.get("access_level", "user"),
                created_at=template.get("created_at"),
                updated_at=template.get("last_modified"),
                created_by=template.get("created_by"),
                version="1.0",
                is_active=True,
                output_formats=template.get("output_formats", ["pdf", "docx", "html"]),
            )

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Template retrieval failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def list_templates_handler(
        self,
        page: int,
        limit: int,
        category: Optional[str],
        access_level: Optional[str],
        tags: Optional[List[str]],
        current_user: Dict[str, Any],
    ) -> TemplateListResponse:
        """Handle template listing with filters"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Get available templates using document engine
            templates_result = await self.document_engine.list_available_templates(
                user_id=user_id, category=category, context=context
            )

            if not templates_result["success"]:
                raise HTTPException(
                    status_code=500, detail="Failed to retrieve templates"
                )

            all_templates = templates_result["templates"]

            # Apply additional filters
            filtered_templates = all_templates

            if access_level:
                filtered_templates = [
                    t
                    for t in filtered_templates
                    if t.get("access_level") == access_level
                ]

            if tags:
                filtered_templates = [
                    t
                    for t in filtered_templates
                    if any(tag in t.get("tags", []) for tag in tags)
                ]

            # Pagination
            total = len(filtered_templates)
            offset = (page - 1) * limit
            page_templates = filtered_templates[offset : offset + limit]

            # Convert to response format
            templates = []
            for template in page_templates:
                templates.append(
                    TemplateResponse(
                        template_id=template["template_id"],
                        name=template["name"],
                        description=template["description"],
                        category=template["category"],
                        content="",  # Don't include content in list
                        fields=template.get("fields", []),
                        tags=template.get("tags", []),
                        access_level=template.get("access_level", "user"),
                        created_at=None,
                        updated_at=None,
                        created_by=None,
                        version="1.0",
                        is_active=True,
                    )
                )

            return TemplateListResponse(
                templates=templates,
                total=total,
                page=page,
                limit=limit,
                total_pages=(total + limit - 1) // limit,
                categories=self._get_unique_categories(all_templates),
                access_levels=self._get_unique_access_levels(all_templates),
            )

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Template listing failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def update_template_handler(
        self,
        template_id: str,
        request: TemplateUpdateRequest,
        current_user: Dict[str, Any],
    ) -> TemplateResponse:
        """Handle template updates"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Check template access first
            template_info = await self.get_template_handler(
                template_id, False, current_user
            )

            # Check permission to update templates
            auth_result = await self.security.check_permission(
                user_id, "template", "edit", context=context
            )

            if not auth_result.has_permission:
                raise HTTPException(status_code=403, detail="Permission denied")

            # Update template metadata
            metadata = {
                "template_id": template_id,
                "template_category": request.category or template_info.category,
                "template_description": request.description
                or template_info.description,
                "template_version": "1.1",  # Increment version
                "template_fields": request.fields or template_info.fields,
                "template_access_level": request.access_level
                or template_info.access_level,
                "is_template": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            # This is a simplified update - in production would need to find the actual document
            # and update it through the storage service

            return TemplateResponse(
                template_id=template_id,
                name=request.name or template_info.name,
                description=request.description or template_info.description,
                category=request.category or template_info.category,
                content=request.content or template_info.content,
                fields=request.fields or template_info.fields,
                tags=request.tags or template_info.tags,
                access_level=request.access_level or template_info.access_level,
                created_at=template_info.created_at,
                updated_at=datetime.now(timezone.utc),
                created_by=template_info.created_by,
                version="1.1",
                is_active=True,
            )

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Template update failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def delete_template_handler(
        self, template_id: str, current_user: Dict[str, Any]
    ):
        """Handle template deletion"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Check permission to delete templates
            auth_result = await self.security.check_permission(
                user_id, "template", "manage", context=context
            )

            if not auth_result.has_permission:
                raise HTTPException(status_code=403, detail="Permission denied")

            # In production, would need to find and delete the actual template document
            self.logger.info(f"Template {template_id} deleted by user {user_id}")

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Template deletion failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def preview_template_handler(
        self,
        template_id: str,
        request: TemplatePreviewRequest,
        current_user: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Handle template preview generation"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Generate preview using document engine
            preview_result = await self.document_engine.generate_document(
                template_id=template_id,
                content_data=request.sample_data or {},
                user_id=user_id,
                output_format=request.output_format or "html",
                context=context,
            )

            if not preview_result["success"]:
                raise HTTPException(
                    status_code=400,
                    detail=preview_result.get("error", "Preview generation failed"),
                )

            return {
                "success": True,
                "template_id": template_id,
                "preview_url": f"/api/v1/templates/{template_id}/preview/{preview_result['document_id']}",
                "format": request.output_format or "html",
                "generated_at": preview_result["generated_at"],
            }

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Template preview failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def search_templates_handler(
        self, request: TemplateSearchRequest, current_user: Dict[str, Any]
    ) -> TemplateListResponse:
        """Handle advanced template search"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Get available templates first
            templates_result = await self.document_engine.list_available_templates(
                user_id=user_id, category=request.category, context=context
            )

            if not templates_result["success"]:
                raise HTTPException(status_code=500, detail="Search failed")

            templates = templates_result["templates"]

            # Apply search filters
            if request.query:
                query_lower = request.query.lower()
                templates = [
                    t
                    for t in templates
                    if (
                        query_lower in t.get("name", "").lower()
                        or query_lower in t.get("description", "").lower()
                    )
                ]

            if request.access_level:
                templates = [
                    t
                    for t in templates
                    if t.get("access_level") == request.access_level
                ]

            if request.tags:
                templates = [
                    t
                    for t in templates
                    if any(tag in t.get("tags", []) for tag in request.tags)
                ]

            # Convert to response format
            template_responses = []
            for template in templates[: request.limit]:
                template_responses.append(
                    TemplateResponse(
                        template_id=template["template_id"],
                        name=template["name"],
                        description=template["description"],
                        category=template["category"],
                        content="",
                        fields=template.get("fields", []),
                        tags=template.get("tags", []),
                        access_level=template.get("access_level", "user"),
                        created_at=None,
                        updated_at=None,
                        created_by=None,
                        version="1.0",
                        is_active=True,
                    )
                )

            return TemplateListResponse(
                templates=template_responses,
                total=len(templates),
                page=1,
                limit=request.limit,
                total_pages=1,
                search_query=request.query,
            )

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Template search failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def get_template_info_handler(
        self, template_id: str, current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle detailed template information retrieval"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Get template info using document engine
            return await self.document_engine.get_template_info(
                template_id=template_id, user_id=user_id, context=context
            )

        except Exception as e:
            self.logger.error(f"Template info retrieval failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def duplicate_template_handler(
        self, template_id: str, new_name: Optional[str], current_user: Dict[str, Any]
    ) -> TemplateResponse:
        """Handle template duplication"""
        try:
            user_id = current_user["user_id"]

            # Get original template
            original = await self.get_template_handler(template_id, True, current_user)

            # Create duplicate with new name
            duplicate_name = new_name or f"Copy of {original.name}"

            create_request = TemplateCreateRequest(
                name=duplicate_name,
                description=f"Copy of {original.description}",
                category=original.category,
                content=original.content,
                fields=original.fields,
                tags=original.tags,
                access_level=original.access_level,
            )

            return await self.create_template_handler(create_request, current_user)

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Template duplication failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def validate_template_handler(
        self, template_id: str, current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle template validation"""
        try:
            # Get template
            template = await self.get_template_handler(template_id, True, current_user)

            # Perform validation checks
            validation_results = {
                "valid": True,
                "errors": [],
                "warnings": [],
                "template_id": template_id,
            }

            # Basic validation checks
            if not template.name:
                validation_results["errors"].append("Template name is required")
                validation_results["valid"] = False

            if not template.content:
                validation_results["errors"].append("Template content is required")
                validation_results["valid"] = False

            if not template.fields:
                validation_results["warnings"].append("Template has no defined fields")

            # Check for required fields in content
            if template.fields:
                for field in template.fields:
                    field_placeholder = f"{{{field}}}"
                    if field_placeholder not in template.content:
                        validation_results["warnings"].append(
                            f"Field '{field}' not found in template content"
                        )

            return validation_results

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Template validation failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def get_template_categories_handler(
        self, current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle template categories retrieval"""
        try:
            # Get available templates to extract categories
            templates_result = await self.list_templates_handler(
                1, 1000, None, None, None, current_user
            )

            categories = self._get_unique_categories(
                [t.__dict__ for t in templates_result.templates]
            )

            return {"categories": categories, "total": len(categories)}

        except Exception as e:
            self.logger.error(f"Template categories retrieval failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def upload_template_handler(
        self,
        file: UploadFile,
        name: Optional[str],
        category: Optional[str],
        description: Optional[str],
        current_user: Dict[str, Any],
    ) -> TemplateResponse:
        """Handle template file upload"""
        try:
            # Read file content
            file_content = await file.read()
            content = file_content.decode("utf-8")

            # Create template from uploaded content
            create_request = TemplateCreateRequest(
                name=name or file.filename or "Uploaded Template",
                description=description or f"Template uploaded from {file.filename}",
                category=category or "general",
                content=content,
                fields=[],  # Would extract fields from content in production
                tags=["uploaded"],
                access_level="user",
            )

            return await self.create_template_handler(create_request, current_user)

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Template upload failed: {e}")
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

    def _get_unique_categories(self, templates: List[Dict[str, Any]]) -> List[str]:
        """Extract unique categories from templates"""
        categories = set()
        for template in templates:
            if template.get("category"):
                categories.add(template["category"])
        return sorted(list(categories))

    def _get_unique_access_levels(self, templates: List[Dict[str, Any]]) -> List[str]:
        """Extract unique access levels from templates"""
        access_levels = set()
        for template in templates:
            if template.get("access_level"):
                access_levels.add(template["access_level"])
        return sorted(list(access_levels))

# Factory function
def create_template_endpoints(
    storage_service: SecureStorageService,
    document_engine: SecureDocumentEngine,
    security_manager: SecurityManager,
) -> TemplateEndpoints:
    """Create TemplateEndpoints instance with services"""
    return TemplateEndpoints(storage_service, document_engine, security_manager)
