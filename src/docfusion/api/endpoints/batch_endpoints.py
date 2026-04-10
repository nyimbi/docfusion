#!/usr/bin/env python3
"""
Batch Document Processing Endpoints

FastAPI endpoints for batch document operations including bulk creation,
processing, and async operations with status tracking.
"""

import asyncio
import logging
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi import Path as PathParam
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator

from ...document_engine.secure_document_engine import SecureDocumentEngine
from ...security import SecurityManager
from ...storage.secure_storage_service import SecureStorageService
from ..middleware.authentication_middleware import get_current_user
from ..serializers.document_serializers import DocumentCreateRequest, DocumentResponse
from ...core.utils import uuid7str

class BatchJobStatus(str, Enum):
    """Batch job status enumeration"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"

class BatchJobType(str, Enum):
    """Batch job type enumeration"""

    DOCUMENT_CREATION = "document_creation"
    DOCUMENT_PROCESSING = "document_processing"
    DOCUMENT_RENDERING = "document_rendering"
    DOCUMENT_ANALYSIS = "document_analysis"
    BULK_UPDATE = "bulk_update"
    BULK_DELETE = "bulk_delete"

class BatchDocumentCreateRequest(BaseModel):
    """Request model for batch document creation"""

    documents: List[DocumentCreateRequest] = Field(
        ..., min_items=1, max_items=100, description="Documents to create"
    )
    parallel_processing: bool = Field(True, description="Process documents in parallel")
    fail_fast: bool = Field(False, description="Stop processing on first failure")
    priority: int = Field(
        0, ge=-10, le=10, description="Processing priority (-10 lowest, 10 highest)"
    )
    metadata: Optional[Dict[str, Any]] = Field(None, description="Batch job metadata")

class BatchJobResponse(BaseModel):
    """Response model for batch job creation"""

    job_id: str = Field(..., description="Unique job identifier")
    job_type: BatchJobType = Field(..., description="Type of batch job")
    status: BatchJobStatus = Field(..., description="Current job status")
    total_items: int = Field(..., description="Total number of items to process")
    created_at: datetime = Field(..., description="Job creation timestamp")
    estimated_completion: Optional[datetime] = Field(
        None, description="Estimated completion time"
    )
    priority: int = Field(..., description="Job priority")
    user_id: str = Field(..., description="User who created the job")

class BatchJobStatusResponse(BaseModel):
    """Response model for batch job status"""

    job_id: str = Field(..., description="Job identifier")
    job_type: BatchJobType = Field(..., description="Type of batch job")
    status: BatchJobStatus = Field(..., description="Current status")
    progress: Dict[str, Any] = Field(..., description="Progress information")
    results: Optional[List[Dict[str, Any]]] = Field(
        None, description="Job results if completed"
    )
    errors: List[Dict[str, Any]] = Field(default_factory=list, description="Job errors")
    created_at: datetime = Field(..., description="Job creation time")
    started_at: Optional[datetime] = Field(None, description="Job start time")
    completed_at: Optional[datetime] = Field(None, description="Job completion time")
    duration: Optional[float] = Field(None, description="Job duration in seconds")

class AsyncProcessingRequest(BaseModel):
    """Request model for async document processing"""

    document_ids: List[str] = Field(
        ..., min_items=1, max_items=50, description="Documents to process"
    )
    operation: str = Field(..., description="Operation to perform")
    parameters: Optional[Dict[str, Any]] = Field(
        None, description="Operation parameters"
    )
    webhook_url: Optional[str] = Field(
        None, description="Webhook URL for completion notification"
    )
    priority: int = Field(0, ge=-10, le=10, description="Processing priority")

class BatchEndpoints:
    """FastAPI batch processing endpoints"""

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
        self.router = APIRouter(prefix="/api/v1/batch", tags=["batch-processing"])

        # Job tracking (in production, would use Redis or database)
        self.active_jobs: Dict[str, Dict[str, Any]] = {}
        self.job_results: Dict[str, Dict[str, Any]] = {}

        # Register endpoints
        self._register_endpoints()

        self.logger.info("Batch processing endpoints initialized")

    def _register_endpoints(self):
        """Register all batch processing endpoints"""

        @self.router.post(
            "/documents/create", response_model=BatchJobResponse, status_code=202
        )
        async def batch_create_documents(
            request: BatchDocumentCreateRequest,
            background_tasks: BackgroundTasks,
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Create multiple documents in batch"""
            return await self.batch_create_documents_handler(
                request, background_tasks, current_user
            )

        @self.router.post(
            "/documents/process", response_model=BatchJobResponse, status_code=202
        )
        async def async_process_documents(
            request: AsyncProcessingRequest,
            background_tasks: BackgroundTasks,
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Process documents asynchronously"""
            return await self.async_process_documents_handler(
                request, background_tasks, current_user
            )

        @self.router.get("/jobs/{job_id}", response_model=BatchJobStatusResponse)
        async def get_job_status(
            job_id: str = PathParam(..., description="Job ID"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Get batch job status and results"""
            return await self.get_job_status_handler(job_id, current_user)

        @self.router.post("/jobs/{job_id}/cancel", response_model=Dict[str, Any])
        async def cancel_job(
            job_id: str = PathParam(..., description="Job ID"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Cancel a running batch job"""
            return await self.cancel_job_handler(job_id, current_user)

        @self.router.post("/jobs/{job_id}/pause", response_model=Dict[str, Any])
        async def pause_job(
            job_id: str = PathParam(..., description="Job ID"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Pause a running batch job"""
            return await self.pause_job_handler(job_id, current_user)

        @self.router.post("/jobs/{job_id}/resume", response_model=Dict[str, Any])
        async def resume_job(
            job_id: str = PathParam(..., description="Job ID"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Resume a paused batch job"""
            return await self.resume_job_handler(job_id, current_user)

        @self.router.get("/jobs", response_model=List[BatchJobStatusResponse])
        async def list_user_jobs(
            status: Optional[BatchJobStatus] = Query(
                None, description="Filter by status"
            ),
            job_type: Optional[BatchJobType] = Query(
                None, description="Filter by job type"
            ),
            limit: int = Query(20, ge=1, le=100, description="Maximum results"),
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """List user's batch jobs"""
            return await self.list_user_jobs_handler(
                status, job_type, limit, current_user
            )

        @self.router.post(
            "/documents/upload-bulk", response_model=BatchJobResponse, status_code=202
        )
        async def bulk_upload_documents(
            files: List[UploadFile] = File(..., description="Multiple files to upload"),
            category: Optional[str] = Query(
                None, description="Category for all documents"
            ),
            extract_content: bool = Query(
                True, description="Extract content from files"
            ),
            parallel_processing: bool = Query(
                True, description="Process files in parallel"
            ),
            background_tasks: BackgroundTasks = ...,
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Upload and process multiple files in batch"""
            return await self.bulk_upload_documents_handler(
                files,
                category,
                extract_content,
                parallel_processing,
                background_tasks,
                current_user,
            )

        @self.router.post(
            "/documents/render-bulk", response_model=BatchJobResponse, status_code=202
        )
        async def bulk_render_documents(
            document_ids: List[str] = Query(..., description="Document IDs to render"),
            output_format: str = Query("pdf", description="Output format"),
            template_id: Optional[str] = Query(None, description="Template to use"),
            background_tasks: BackgroundTasks = ...,
            current_user: Dict[str, Any] = Depends(get_current_user),
        ):
            """Render multiple documents in batch"""
            return await self.bulk_render_documents_handler(
                document_ids, output_format, template_id, background_tasks, current_user
            )

    # ==================== HANDLER METHODS ====================

    async def batch_create_documents_handler(
        self,
        request: BatchDocumentCreateRequest,
        background_tasks: BackgroundTasks,
        current_user: Dict[str, Any],
    ) -> BatchJobResponse:
        """Handle batch document creation"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Create job
            job_id = uuid7str()
            job = {
                "job_id": job_id,
                "job_type": BatchJobType.DOCUMENT_CREATION,
                "status": BatchJobStatus.PENDING,
                "user_id": user_id,
                "total_items": len(request.documents),
                "processed_items": 0,
                "successful_items": 0,
                "failed_items": 0,
                "created_at": datetime.utcnow(),
                "priority": request.priority,
                "metadata": request.metadata or {},
                "request": request,
                "context": context,
                "results": [],
                "errors": [],
            }

            self.active_jobs[job_id] = job

            # Schedule background processing
            background_tasks.add_task(
                self._process_batch_document_creation, job_id, request, context
            )

            return BatchJobResponse(
                job_id=job_id,
                job_type=BatchJobType.DOCUMENT_CREATION,
                status=BatchJobStatus.PENDING,
                total_items=len(request.documents),
                created_at=job["created_at"],
                priority=request.priority,
                user_id=user_id,
            )

        except Exception as e:
            self.logger.error(f"Batch document creation setup failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to setup batch job")

    async def async_process_documents_handler(
        self,
        request: AsyncProcessingRequest,
        background_tasks: BackgroundTasks,
        current_user: Dict[str, Any],
    ) -> BatchJobResponse:
        """Handle async document processing"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Create job
            job_id = uuid7str()
            job = {
                "job_id": job_id,
                "job_type": BatchJobType.DOCUMENT_PROCESSING,
                "status": BatchJobStatus.PENDING,
                "user_id": user_id,
                "total_items": len(request.document_ids),
                "processed_items": 0,
                "successful_items": 0,
                "failed_items": 0,
                "created_at": datetime.utcnow(),
                "priority": request.priority,
                "metadata": {"operation": request.operation},
                "request": request,
                "context": context,
                "results": [],
                "errors": [],
            }

            self.active_jobs[job_id] = job

            # Schedule background processing
            background_tasks.add_task(
                self._process_async_documents, job_id, request, context
            )

            return BatchJobResponse(
                job_id=job_id,
                job_type=BatchJobType.DOCUMENT_PROCESSING,
                status=BatchJobStatus.PENDING,
                total_items=len(request.document_ids),
                created_at=job["created_at"],
                priority=request.priority,
                user_id=user_id,
            )

        except Exception as e:
            self.logger.error(f"Async document processing setup failed: {e}")
            raise HTTPException(
                status_code=500, detail="Failed to setup async processing"
            )

    async def get_job_status_handler(
        self, job_id: str, current_user: Dict[str, Any]
    ) -> BatchJobStatusResponse:
        """Handle job status retrieval"""
        try:
            user_id = current_user["user_id"]

            # Check active jobs first
            if job_id in self.active_jobs:
                job = self.active_jobs[job_id]
            elif job_id in self.job_results:
                job = self.job_results[job_id]
            else:
                raise HTTPException(status_code=404, detail="Job not found")

            # Verify ownership
            if job["user_id"] != user_id:
                raise HTTPException(status_code=403, detail="Access denied")

            # Calculate progress
            progress = {
                "total_items": job["total_items"],
                "processed_items": job["processed_items"],
                "successful_items": job["successful_items"],
                "failed_items": job["failed_items"],
                "percentage": (job["processed_items"] / job["total_items"] * 100)
                if job["total_items"] > 0
                else 0,
            }

            # Calculate duration
            duration = None
            if job.get("started_at"):
                end_time = job.get("completed_at") or datetime.utcnow()
                duration = (end_time - job["started_at"]).total_seconds()

            return BatchJobStatusResponse(
                job_id=job_id,
                job_type=job["job_type"],
                status=job["status"],
                progress=progress,
                results=job.get("results")
                if job["status"] == BatchJobStatus.COMPLETED
                else None,
                errors=job.get("errors", []),
                created_at=job["created_at"],
                started_at=job.get("started_at"),
                completed_at=job.get("completed_at"),
                duration=duration,
            )

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Job status retrieval failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def cancel_job_handler(
        self, job_id: str, current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle job cancellation"""
        try:
            user_id = current_user["user_id"]

            if job_id not in self.active_jobs:
                raise HTTPException(status_code=404, detail="Job not found")

            job = self.active_jobs[job_id]

            # Verify ownership
            if job["user_id"] != user_id:
                raise HTTPException(status_code=403, detail="Access denied")

            # Check if job can be cancelled
            if job["status"] in [
                BatchJobStatus.COMPLETED,
                BatchJobStatus.FAILED,
                BatchJobStatus.CANCELLED,
            ]:
                raise HTTPException(status_code=400, detail="Job cannot be cancelled")

            # Cancel job
            job["status"] = BatchJobStatus.CANCELLED
            job["completed_at"] = datetime.utcnow()

            # Move to results
            self.job_results[job_id] = job
            del self.active_jobs[job_id]

            return {
                "success": True,
                "job_id": job_id,
                "status": BatchJobStatus.CANCELLED,
                "message": "Job cancelled successfully",
            }

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Job cancellation failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def pause_job_handler(
        self, job_id: str, current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle job pausing"""
        try:
            user_id = current_user["user_id"]

            if job_id not in self.active_jobs:
                raise HTTPException(status_code=404, detail="Job not found")

            job = self.active_jobs[job_id]

            # Verify ownership
            if job["user_id"] != user_id:
                raise HTTPException(status_code=403, detail="Access denied")

            # Check if job can be paused
            if job["status"] != BatchJobStatus.RUNNING:
                raise HTTPException(
                    status_code=400, detail="Only running jobs can be paused"
                )

            # Pause job
            job["status"] = BatchJobStatus.PAUSED

            return {
                "success": True,
                "job_id": job_id,
                "status": BatchJobStatus.PAUSED,
                "message": "Job paused successfully",
            }

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Job pausing failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def resume_job_handler(
        self, job_id: str, current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle job resuming"""
        try:
            user_id = current_user["user_id"]

            if job_id not in self.active_jobs:
                raise HTTPException(status_code=404, detail="Job not found")

            job = self.active_jobs[job_id]

            # Verify ownership
            if job["user_id"] != user_id:
                raise HTTPException(status_code=403, detail="Access denied")

            # Check if job can be resumed
            if job["status"] != BatchJobStatus.PAUSED:
                raise HTTPException(
                    status_code=400, detail="Only paused jobs can be resumed"
                )

            # Resume job
            job["status"] = BatchJobStatus.RUNNING

            return {
                "success": True,
                "job_id": job_id,
                "status": BatchJobStatus.RUNNING,
                "message": "Job resumed successfully",
            }

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Job resuming failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def list_user_jobs_handler(
        self,
        status: Optional[BatchJobStatus],
        job_type: Optional[BatchJobType],
        limit: int,
        current_user: Dict[str, Any],
    ) -> List[BatchJobStatusResponse]:
        """Handle user job listing"""
        try:
            user_id = current_user["user_id"]

            # Combine active and completed jobs
            all_jobs = {**self.active_jobs, **self.job_results}

            # Filter by user and criteria
            user_jobs = []
            for job in all_jobs.values():
                if job["user_id"] != user_id:
                    continue

                if status and job["status"] != status:
                    continue

                if job_type and job["job_type"] != job_type:
                    continue

                user_jobs.append(job)

            # Sort by creation time (newest first)
            user_jobs.sort(key=lambda x: x["created_at"], reverse=True)

            # Apply limit
            user_jobs = user_jobs[:limit]

            # Convert to response format
            responses = []
            for job in user_jobs:
                progress = {
                    "total_items": job["total_items"],
                    "processed_items": job["processed_items"],
                    "successful_items": job["successful_items"],
                    "failed_items": job["failed_items"],
                    "percentage": (job["processed_items"] / job["total_items"] * 100)
                    if job["total_items"] > 0
                    else 0,
                }

                duration = None
                if job.get("started_at"):
                    end_time = job.get("completed_at") or datetime.utcnow()
                    duration = (end_time - job["started_at"]).total_seconds()

                responses.append(
                    BatchJobStatusResponse(
                        job_id=job["job_id"],
                        job_type=job["job_type"],
                        status=job["status"],
                        progress=progress,
                        results=job.get("results")
                        if job["status"] == BatchJobStatus.COMPLETED
                        else None,
                        errors=job.get("errors", []),
                        created_at=job["created_at"],
                        started_at=job.get("started_at"),
                        completed_at=job.get("completed_at"),
                        duration=duration,
                    )
                )

            return responses

        except Exception as e:
            self.logger.error(f"Job listing failed: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def bulk_upload_documents_handler(
        self,
        files: List[UploadFile],
        category: Optional[str],
        extract_content: bool,
        parallel_processing: bool,
        background_tasks: BackgroundTasks,
        current_user: Dict[str, Any],
    ) -> BatchJobResponse:
        """Handle bulk document upload"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Create job
            job_id = uuid7str()
            job = {
                "job_id": job_id,
                "job_type": BatchJobType.DOCUMENT_CREATION,
                "status": BatchJobStatus.PENDING,
                "user_id": user_id,
                "total_items": len(files),
                "processed_items": 0,
                "successful_items": 0,
                "failed_items": 0,
                "created_at": datetime.utcnow(),
                "priority": 0,
                "metadata": {"operation": "bulk_upload", "category": category},
                "context": context,
                "results": [],
                "errors": [],
            }

            self.active_jobs[job_id] = job

            # Process files and store file data
            file_data = []
            for file in files:
                content = await file.read()
                file_data.append(
                    {
                        "filename": file.filename,
                        "content_type": file.content_type,
                        "content": content,
                        "size": len(content),
                    }
                )

            # Schedule background processing
            background_tasks.add_task(
                self._process_bulk_upload,
                job_id,
                file_data,
                category,
                extract_content,
                parallel_processing,
                context,
            )

            return BatchJobResponse(
                job_id=job_id,
                job_type=BatchJobType.DOCUMENT_CREATION,
                status=BatchJobStatus.PENDING,
                total_items=len(files),
                created_at=job["created_at"],
                priority=0,
                user_id=user_id,
            )

        except Exception as e:
            self.logger.error(f"Bulk upload setup failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to setup bulk upload")

    async def bulk_render_documents_handler(
        self,
        document_ids: List[str],
        output_format: str,
        template_id: Optional[str],
        background_tasks: BackgroundTasks,
        current_user: Dict[str, Any],
    ) -> BatchJobResponse:
        """Handle bulk document rendering"""
        try:
            user_id = current_user["user_id"]
            context = self._build_request_context(current_user)

            # Create job
            job_id = uuid7str()
            job = {
                "job_id": job_id,
                "job_type": BatchJobType.DOCUMENT_RENDERING,
                "status": BatchJobStatus.PENDING,
                "user_id": user_id,
                "total_items": len(document_ids),
                "processed_items": 0,
                "successful_items": 0,
                "failed_items": 0,
                "created_at": datetime.utcnow(),
                "priority": 0,
                "metadata": {
                    "operation": "bulk_render",
                    "output_format": output_format,
                },
                "context": context,
                "results": [],
                "errors": [],
            }

            self.active_jobs[job_id] = job

            # Schedule background processing
            background_tasks.add_task(
                self._process_bulk_render,
                job_id,
                document_ids,
                output_format,
                template_id,
                context,
            )

            return BatchJobResponse(
                job_id=job_id,
                job_type=BatchJobType.DOCUMENT_RENDERING,
                status=BatchJobStatus.PENDING,
                total_items=len(document_ids),
                created_at=job["created_at"],
                priority=0,
                user_id=user_id,
            )

        except Exception as e:
            self.logger.error(f"Bulk render setup failed: {e}")
            raise HTTPException(
                status_code=500, detail="Failed to setup bulk rendering"
            )

    # ==================== BACKGROUND PROCESSING ====================

    async def _process_batch_document_creation(
        self, job_id: str, request: BatchDocumentCreateRequest, context: Dict[str, Any]
    ):
        """Process batch document creation in background"""
        job = self.active_jobs.get(job_id)
        if not job:
            return

        try:
            job["status"] = BatchJobStatus.RUNNING
            job["started_at"] = datetime.utcnow()

            user_id = context["user_id"]

            # Process documents
            if request.parallel_processing:
                # Parallel processing
                tasks = []
                for doc_request in request.documents:
                    task = self._create_single_document(doc_request, user_id, context)
                    tasks.append(task)

                results = await asyncio.gather(*tasks, return_exceptions=True)

                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        job["errors"].append(
                            {
                                "item_index": i,
                                "error": str(result),
                                "document_title": request.documents[i].title,
                            }
                        )
                        job["failed_items"] += 1
                    else:
                        job["results"].append(result)
                        job["successful_items"] += 1

                    job["processed_items"] += 1

                    if request.fail_fast and isinstance(result, Exception):
                        break
            else:
                # Sequential processing
                for i, doc_request in enumerate(request.documents):
                    if job["status"] == BatchJobStatus.CANCELLED:
                        break

                    if job["status"] == BatchJobStatus.PAUSED:
                        # Wait for resume
                        while job["status"] == BatchJobStatus.PAUSED:
                            await asyncio.sleep(1)
                        if job["status"] == BatchJobStatus.CANCELLED:
                            break

                    try:
                        result = await self._create_single_document(
                            doc_request, user_id, context
                        )
                        job["results"].append(result)
                        job["successful_items"] += 1
                    except Exception as e:
                        job["errors"].append(
                            {
                                "item_index": i,
                                "error": str(e),
                                "document_title": doc_request.title,
                            }
                        )
                        job["failed_items"] += 1

                        if request.fail_fast:
                            break

                    job["processed_items"] += 1

            # Complete job
            job["status"] = (
                BatchJobStatus.COMPLETED
                if job["failed_items"] == 0
                else BatchJobStatus.FAILED
            )
            job["completed_at"] = datetime.utcnow()

            # Move to results
            self.job_results[job_id] = job
            del self.active_jobs[job_id]

        except Exception as e:
            self.logger.error(f"Batch document creation failed: {e}")
            job["status"] = BatchJobStatus.FAILED
            job["completed_at"] = datetime.utcnow()
            job["errors"].append(
                {"error": f"Job processing failed: {str(e)}", "type": "job_error"}
            )

            # Move to results
            self.job_results[job_id] = job
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]

    async def _create_single_document(
        self, doc_request: DocumentCreateRequest, user_id: str, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create a single document"""
        result = await self.storage.create_document(
            title=doc_request.title,
            content=doc_request.content,
            user_id=user_id,
            category=doc_request.category or "",
            tags=doc_request.tags or [],
            metadata=doc_request.metadata or {},
            encrypt_content=doc_request.encrypt_content,
            sharing_permissions=doc_request.sharing_permissions,
            context=context,
        )

        if not result["success"]:
            raise Exception(result.get("error", "Document creation failed"))

        return {
            "document_id": result["document_id"],
            "title": doc_request.title,
            "created_at": datetime.utcnow().isoformat(),
            "encrypted": result.get("encrypted", False),
        }

    async def _process_async_documents(
        self, job_id: str, request: AsyncProcessingRequest, context: Dict[str, Any]
    ):
        """Process documents asynchronously in background"""
        job = self.active_jobs.get(job_id)
        if not job:
            return

        try:
            job["status"] = BatchJobStatus.RUNNING
            job["started_at"] = datetime.utcnow()

            user_id = context["user_id"]

            # Process each document
            for i, document_id in enumerate(request.document_ids):
                if job["status"] == BatchJobStatus.CANCELLED:
                    break

                if job["status"] == BatchJobStatus.PAUSED:
                    while job["status"] == BatchJobStatus.PAUSED:
                        await asyncio.sleep(1)
                    if job["status"] == BatchJobStatus.CANCELLED:
                        break

                try:
                    # Perform the specified operation
                    result = await self._perform_document_operation(
                        document_id,
                        request.operation,
                        request.parameters or {},
                        user_id,
                        context,
                    )
                    job["results"].append(result)
                    job["successful_items"] += 1
                except Exception as e:
                    job["errors"].append(
                        {"item_index": i, "document_id": document_id, "error": str(e)}
                    )
                    job["failed_items"] += 1

                job["processed_items"] += 1

            # Complete job
            job["status"] = (
                BatchJobStatus.COMPLETED
                if job["failed_items"] == 0
                else BatchJobStatus.FAILED
            )
            job["completed_at"] = datetime.utcnow()

            # Send webhook notification if provided
            if request.webhook_url:
                await self._send_webhook_notification(request.webhook_url, job)

            # Move to results
            self.job_results[job_id] = job
            del self.active_jobs[job_id]

        except Exception as e:
            self.logger.error(f"Async document processing failed: {e}")
            job["status"] = BatchJobStatus.FAILED
            job["completed_at"] = datetime.utcnow()
            job["errors"].append(
                {"error": f"Job processing failed: {str(e)}", "type": "job_error"}
            )

            # Move to results
            self.job_results[job_id] = job
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]

    async def _perform_document_operation(
        self,
        document_id: str,
        operation: str,
        parameters: Dict[str, Any],
        user_id: str,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Perform operation on a single document"""
        if operation == "analyze":
            # Simulate document analysis
            return {
                "document_id": document_id,
                "operation": operation,
                "result": "analysis_completed",
                "processed_at": datetime.utcnow().isoformat(),
            }
        elif operation == "render":
            # Use document engine for rendering
            format = parameters.get("format", "pdf")
            template_id = parameters.get("template_id", "default")

            # Get document first
            doc_result = await self.storage.get_document(
                document_id, user_id, context=context
            )
            if not doc_result["success"]:
                raise Exception(
                    f"Failed to retrieve document: {doc_result.get('error')}"
                )

            document = doc_result["document"]

            # Generate document
            generation_result = await self.document_engine.generate_document(
                template_id=template_id,
                content_data={
                    "title": document.get("title", ""),
                    "content": document.get("content", ""),
                    "metadata": document.get("metadata", {}),
                },
                user_id=user_id,
                output_format=format,
                context=context,
            )

            if not generation_result["success"]:
                raise Exception(
                    f"Document generation failed: {generation_result.get('error')}"
                )

            return {
                "document_id": document_id,
                "operation": operation,
                "result": "render_completed",
                "output_format": format,
                "file_path": generation_result.get("file_path"),
                "processed_at": datetime.utcnow().isoformat(),
            }
        else:
            raise Exception(f"Unknown operation: {operation}")

    async def _process_bulk_upload(
        self,
        job_id: str,
        file_data: List[Dict[str, Any]],
        category: Optional[str],
        extract_content: bool,
        parallel_processing: bool,
        context: Dict[str, Any],
    ):
        """Process bulk file upload in background"""
        job = self.active_jobs.get(job_id)
        if not job:
            return

        try:
            job["status"] = BatchJobStatus.RUNNING
            job["started_at"] = datetime.utcnow()

            user_id = context["user_id"]

            # Process files
            for i, file_info in enumerate(file_data):
                if job["status"] == BatchJobStatus.CANCELLED:
                    break

                try:
                    # Extract content if requested
                    if extract_content:
                        if file_info["content_type"] == "text/plain":
                            content = file_info["content"].decode("utf-8")
                        else:
                            content = f"Uploaded file: {file_info['filename']} ({file_info['content_type']})"
                    else:
                        content = f"Uploaded file: {file_info['filename']}"

                    # Create document
                    result = await self.storage.create_document(
                        title=file_info["filename"],
                        content=content,
                        user_id=user_id,
                        category=category or "",
                        tags=[],
                        metadata={
                            "original_filename": file_info["filename"],
                            "content_type": file_info["content_type"],
                            "file_size": file_info["size"],
                            "uploaded": True,
                        },
                        context=context,
                    )

                    if not result["success"]:
                        raise Exception(result.get("error", "Document creation failed"))

                    job["results"].append(
                        {
                            "document_id": result["document_id"],
                            "filename": file_info["filename"],
                            "created_at": datetime.utcnow().isoformat(),
                        }
                    )
                    job["successful_items"] += 1

                except Exception as e:
                    job["errors"].append(
                        {
                            "item_index": i,
                            "filename": file_info["filename"],
                            "error": str(e),
                        }
                    )
                    job["failed_items"] += 1

                job["processed_items"] += 1

            # Complete job
            job["status"] = (
                BatchJobStatus.COMPLETED
                if job["failed_items"] == 0
                else BatchJobStatus.FAILED
            )
            job["completed_at"] = datetime.utcnow()

            # Move to results
            self.job_results[job_id] = job
            del self.active_jobs[job_id]

        except Exception as e:
            self.logger.error(f"Bulk upload processing failed: {e}")
            job["status"] = BatchJobStatus.FAILED
            job["completed_at"] = datetime.utcnow()
            job["errors"].append(
                {
                    "error": f"Bulk upload processing failed: {str(e)}",
                    "type": "job_error",
                }
            )

            # Move to results
            self.job_results[job_id] = job
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]

    async def _process_bulk_render(
        self,
        job_id: str,
        document_ids: List[str],
        output_format: str,
        template_id: Optional[str],
        context: Dict[str, Any],
    ):
        """Process bulk document rendering in background"""
        job = self.active_jobs.get(job_id)
        if not job:
            return

        try:
            job["status"] = BatchJobStatus.RUNNING
            job["started_at"] = datetime.utcnow()

            user_id = context["user_id"]

            # Process documents
            for i, document_id in enumerate(document_ids):
                if job["status"] == BatchJobStatus.CANCELLED:
                    break

                try:
                    result = await self._perform_document_operation(
                        document_id,
                        "render",
                        {
                            "format": output_format,
                            "template_id": template_id or "default",
                        },
                        user_id,
                        context,
                    )

                    job["results"].append(result)
                    job["successful_items"] += 1

                except Exception as e:
                    job["errors"].append(
                        {"item_index": i, "document_id": document_id, "error": str(e)}
                    )
                    job["failed_items"] += 1

                job["processed_items"] += 1

            # Complete job
            job["status"] = (
                BatchJobStatus.COMPLETED
                if job["failed_items"] == 0
                else BatchJobStatus.FAILED
            )
            job["completed_at"] = datetime.utcnow()

            # Move to results
            self.job_results[job_id] = job
            del self.active_jobs[job_id]

        except Exception as e:
            self.logger.error(f"Bulk render processing failed: {e}")
            job["status"] = BatchJobStatus.FAILED
            job["completed_at"] = datetime.utcnow()
            job["errors"].append(
                {
                    "error": f"Bulk render processing failed: {str(e)}",
                    "type": "job_error",
                }
            )

            # Move to results
            self.job_results[job_id] = job
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]

    async def _send_webhook_notification(self, webhook_url: str, job: Dict[str, Any]):
        """Send webhook notification for job completion"""
        try:
            import httpx

            payload = {
                "job_id": job["job_id"],
                "status": job["status"],
                "completed_at": job["completed_at"].isoformat(),
                "results_summary": {
                    "total_items": job["total_items"],
                    "successful_items": job["successful_items"],
                    "failed_items": job["failed_items"],
                },
            }

            async with httpx.AsyncClient() as client:
                await client.post(webhook_url, json=payload, timeout=10)

        except Exception as e:
            self.logger.error(f"Webhook notification failed: {e}")

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
def create_batch_endpoints(
    storage_service: SecureStorageService,
    document_engine: SecureDocumentEngine,
    security_manager: SecurityManager,
) -> BatchEndpoints:
    """Create BatchEndpoints instance with services"""
    return BatchEndpoints(storage_service, document_engine, security_manager)
