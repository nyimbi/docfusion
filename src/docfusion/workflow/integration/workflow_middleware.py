#!/usr/bin/env python3
"""
Workflow Middleware

FastAPI middleware for automatically integrating workflow automation with API endpoints.
This middleware intercepts document creation requests and enables workflow automation
without requiring changes to existing endpoint implementations.

Key Features:
- Automatic workflow integration for document requests
- Request transformation and enhancement
- Progress tracking and monitoring
- Event emission for workflow triggers
- Backward compatibility with existing APIs
- Configurable integration levels
"""

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Union

try:
    from uuid_extensions import uuid7str
except ImportError:
    from uuid import uuid4

    def uuid7str() -> str:
        return str(uuid4())


from fastapi import HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from ...api.serializers.document_serializers import (
    DocumentCreateRequest,
    DocumentResponse,
)

# Import document engine components
from ...document_engine.document_engine import (
    DocumentGenerationRequest,
    DocumentGenerationResult,
)

# Import workflow integration components
from .workflow_document_bridge import (
    DocumentWorkflowEvent,
    WorkflowDocumentBridge,
    WorkflowDocumentConfiguration,
    WorkflowProgress,
)
from .workflow_request_extensions import (
    TeamRole,
    WorkflowConfiguration,
    WorkflowEnabledDocumentRequest,
    WorkflowIntegrationLevel,
    WorkflowTemplateManager,
    create_workflow_request_builder,
    template_manager,
)

logger = logging.getLogger(__name__)


# ============================================================================
# Configuration Models
# ============================================================================


class WorkflowMiddlewareConfig(BaseModel):
    """Configuration for workflow middleware"""

    model_config = ConfigDict(extra="forbid")

    # Integration settings
    enabled: bool = True
    auto_workflow_integration: bool = True
    default_integration_level: WorkflowIntegrationLevel = (
        WorkflowIntegrationLevel.STANDARD
    )

    # Endpoint configuration
    document_creation_endpoints: List[str] = Field(
        default_factory=lambda: [
            "/api/v1/documents/",
            "/api/v1/documents/generate",
            "/api/v1/documents/create",
        ]
    )
    document_render_endpoints: List[str] = Field(
        default_factory=lambda: [
            "/api/v1/documents/{id}/render",
            "/api/v1/documents/render",
        ]
    )

    # Workflow detection
    detect_workflow_headers: bool = True
    workflow_header_prefix: str = "X-Workflow-"
    detect_workflow_params: bool = True
    detect_team_assignments: bool = True

    # Template integration
    enable_template_suggestions: bool = True
    auto_apply_templates: bool = False
    template_selection_strategy: str = "best_match"  # best_match, most_used, latest

    # Progress integration
    enable_progress_headers: bool = True
    progress_callback_header: str = "X-Progress-Callback"
    webhook_integration: bool = True

    # Response enhancement
    enhance_responses: bool = True
    include_workflow_metadata: bool = True
    include_progress_links: bool = True

    # Performance settings
    async_workflow_creation: bool = True
    workflow_timeout_seconds: float = 30.0
    max_concurrent_workflows: int = 100


class WorkflowRequestMetadata(BaseModel):
    """Metadata extracted from HTTP request for workflow integration"""

    model_config = ConfigDict(extra="forbid")

    # Request identification
    request_id: str = Field(default_factory=uuid7str)
    endpoint_path: str
    http_method: str
    user_id: Optional[str] = None

    # Workflow configuration
    workflow_enabled: bool = False
    integration_level: WorkflowIntegrationLevel = WorkflowIntegrationLevel.NONE
    workflow_template_id: Optional[str] = None

    # Team assignments
    team_assignments: List[Dict[str, Any]] = Field(default_factory=list)
    collaboration_mode: str = "individual"

    # Timeline settings
    deadline: Optional[datetime] = None
    priority: str = "medium"
    urgency: str = "medium"

    # Headers and parameters
    workflow_headers: Dict[str, str] = Field(default_factory=dict)
    progress_callback_url: Optional[str] = None
    webhook_urls: List[str] = Field(default_factory=list)

    # Request body data
    original_request_data: Dict[str, Any] = Field(default_factory=dict)


# ============================================================================
# Main Middleware Class
# ============================================================================


class WorkflowMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for workflow automation integration.

    This middleware automatically detects document creation requests and
    integrates them with the workflow automation system, providing seamless
    workflow capabilities without requiring changes to existing endpoints.
    """

    def __init__(
        self,
        app: ASGIApp,
        workflow_bridge: WorkflowDocumentBridge,
        config: Optional[WorkflowMiddlewareConfig] = None,
    ):
        super().__init__(app)
        self.workflow_bridge = workflow_bridge
        self.config = config or WorkflowMiddlewareConfig()
        self.template_manager = template_manager

        # State tracking
        self._active_workflows: Dict[
            str, str
        ] = {}  # request_id -> workflow_instance_id
        self._request_metadata: Dict[str, WorkflowRequestMetadata] = {}

        # Performance tracking
        self._workflow_creation_times: List[float] = []
        self._concurrent_workflows = 0

        # Subscribe to workflow events
        asyncio.create_task(self._setup_event_subscriptions())

        logger.info("WorkflowMiddleware initialized")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Main middleware dispatch method"""
        try:
            # Check if workflow integration should be applied
            if not self._should_apply_workflow_integration(request):
                return await call_next(request)

            # Extract workflow metadata from request
            metadata = await self._extract_workflow_metadata(request)

            # Process request based on endpoint type
            if self._is_document_creation_endpoint(request):
                return await self._handle_document_creation(
                    request, call_next, metadata
                )
            elif self._is_document_render_endpoint(request):
                return await self._handle_document_render(request, call_next, metadata)
            else:
                return await call_next(request)

        except Exception as e:
            logger.error(f"WorkflowMiddleware error: {str(e)}")
            # Fallback to original request processing
            return await call_next(request)

    # ========================================================================
    # Document Creation Handling
    # ========================================================================

    async def _handle_document_creation(
        self, request: Request, call_next: Callable, metadata: WorkflowRequestMetadata
    ) -> Response:
        """Handle document creation requests with workflow integration"""
        try:
            # Parse request body
            body = await request.body()
            if body:
                try:
                    request_data = json.loads(body.decode())
                    metadata.original_request_data = request_data
                except json.JSONDecodeError:
                    logger.warning("Failed to parse request body as JSON")

            # Create workflow-enabled request if workflow is enabled
            if metadata.workflow_enabled:
                enhanced_request = await self._create_workflow_enabled_request(metadata)

                # Create workflow instance
                workflow_instance = await self._create_workflow_instance(
                    enhanced_request, metadata
                )

                if workflow_instance:
                    # Track workflow
                    self._active_workflows[metadata.request_id] = (
                        workflow_instance.instance_id
                    )
                    self._request_metadata[metadata.request_id] = metadata

                    # Execute workflow-enabled document creation
                    return await self._execute_workflow_document_creation(
                        enhanced_request,
                        workflow_instance,
                        request,
                        call_next,
                        metadata,
                    )

            # Fallback to standard processing
            response = await call_next(request)

            # Enhance response if requested
            if self.config.enhance_responses:
                return await self._enhance_response(response, metadata)

            return response

        except Exception as e:
            logger.error(f"Error handling document creation: {str(e)}")
            return await call_next(request)

    async def _create_workflow_enabled_request(
        self, metadata: WorkflowRequestMetadata
    ) -> WorkflowEnabledDocumentRequest:
        """Create workflow-enabled document request from metadata"""
        try:
            # Extract document generation configuration from original request
            request_data = metadata.original_request_data

            # Build basic document generation request
            # This would need to be adapted based on your actual request structure
            from ...document_engine.document_engine import (
                DocumentGenerationConfiguration,
            )

            generation_config = DocumentGenerationConfiguration(
                document_type=request_data.get("document_type", "standard_document"),
                target_word_count=request_data.get("target_word_count", 3000),
                # Add other configuration fields as needed
            )

            # Create workflow request builder
            requester_id = metadata.user_id or "anonymous"
            builder = create_workflow_request_builder(requester_id)
            builder.with_generation_config(generation_config)

            # Apply workflow template if specified
            if metadata.workflow_template_id:
                builder.with_workflow_template(metadata.workflow_template_id)

            # Add team assignments
            for assignment_data in metadata.team_assignments:
                user_id = assignment_data.get("user_id")
                role_str = assignment_data.get("role", "writer")

                try:
                    role = TeamRole(role_str.lower())
                except ValueError:
                    role = TeamRole.WRITER

                if user_id:
                    builder.with_team_member(user_id, role)

            # Set deadline if provided
            if metadata.deadline:
                builder.with_deadline(metadata.deadline)

            # Set priority and urgency
            priority_mapping = {
                "low": "LOW",
                "medium": "MEDIUM",
                "high": "HIGH",
                "critical": "CRITICAL",
            }

            from ...workflow.automation.task_scheduler import TaskPriority

            try:
                priority = TaskPriority(
                    priority_mapping.get(metadata.priority, "MEDIUM")
                )
            except ValueError:
                priority = TaskPriority.MEDIUM

            builder.with_priority(priority, metadata.urgency)

            # Set project context if available
            project_name = request_data.get("project_name") or request_data.get("title")
            client_name = request_data.get("client_name")
            description = request_data.get("description")

            if project_name:
                builder.with_project_context(project_name, client_name, description)

            return builder.build()

        except Exception as e:
            logger.error(f"Failed to create workflow-enabled request: {str(e)}")
            raise

    async def _create_workflow_instance(
        self,
        workflow_request: WorkflowEnabledDocumentRequest,
        metadata: WorkflowRequestMetadata,
    ):
        """Create workflow instance for the document request"""
        try:
            # Check concurrent workflow limit
            if self._concurrent_workflows >= self.config.max_concurrent_workflows:
                logger.warning("Maximum concurrent workflows reached")
                return None

            # Extract team assignments
            assigned_users = [
                assignment.user_id for assignment in workflow_request.team_assignments
            ]

            # Create workflow instance
            start_time = asyncio.get_event_loop().time()

            workflow_instance = await self.workflow_bridge.create_document_workflow(
                document_request=workflow_request.to_standard_request(),
                assigned_users=assigned_users,
                deadline=metadata.deadline,
            )

            # Track performance
            creation_time = asyncio.get_event_loop().time() - start_time
            self._workflow_creation_times.append(creation_time)
            self._concurrent_workflows += 1

            logger.info(
                f"Created workflow instance {workflow_instance.instance_id} in {creation_time:.3f}s"
            )
            return workflow_instance

        except Exception as e:
            logger.error(f"Failed to create workflow instance: {str(e)}")
            return None

    async def _execute_workflow_document_creation(
        self,
        workflow_request: WorkflowEnabledDocumentRequest,
        workflow_instance,
        original_request: Request,
        call_next: Callable,
        metadata: WorkflowRequestMetadata,
    ) -> Response:
        """Execute document creation through workflow system"""
        try:
            if self.config.async_workflow_creation:
                # Start workflow execution asynchronously
                asyncio.create_task(
                    self._async_workflow_execution(
                        workflow_request, workflow_instance, metadata
                    )
                )

                # Return immediate response with workflow information
                return JSONResponse(
                    status_code=202,  # Accepted
                    content={
                        "message": "Document creation workflow started",
                        "workflow_instance_id": workflow_instance.instance_id,
                        "request_id": metadata.request_id,
                        "status": "processing",
                        "progress_url": f"/api/v1/workflows/{workflow_instance.instance_id}/progress",
                        "estimated_completion_time": metadata.deadline.isoformat()
                        if metadata.deadline
                        else None,
                    },
                )
            else:
                # Execute workflow synchronously
                result = await asyncio.wait_for(
                    self.workflow_bridge.execute_document_workflow(
                        workflow_instance.instance_id,
                        workflow_request.to_standard_request(),
                    ),
                    timeout=self.config.workflow_timeout_seconds,
                )

                # Convert to standard response format
                response_data = {
                    "document_id": result.request_id,
                    "status": "completed",
                    "workflow_instance_id": workflow_instance.instance_id,
                    "processing_time": result.processing_time,
                    "quality_score": result.overall_quality_score,
                    "outputs": list(result.rendered_outputs.keys()),
                }

                return JSONResponse(status_code=201, content=response_data)

        except asyncio.TimeoutError:
            logger.warning(
                f"Workflow execution timeout for {workflow_instance.instance_id}"
            )
            return JSONResponse(
                status_code=202,
                content={
                    "message": "Document creation is taking longer than expected",
                    "workflow_instance_id": workflow_instance.instance_id,
                    "status": "processing",
                    "progress_url": f"/api/v1/workflows/{workflow_instance.instance_id}/progress",
                },
            )
        except Exception as e:
            logger.error(f"Workflow execution failed: {str(e)}")
            # Fallback to original processing
            return await call_next(original_request)

    async def _async_workflow_execution(
        self,
        workflow_request: WorkflowEnabledDocumentRequest,
        workflow_instance,
        metadata: WorkflowRequestMetadata,
    ):
        """Execute workflow asynchronously"""
        try:
            result = await self.workflow_bridge.execute_document_workflow(
                workflow_instance.instance_id, workflow_request.to_standard_request()
            )

            # Send progress notifications if callback URL provided
            if metadata.progress_callback_url:
                await self._send_progress_notification(
                    metadata.progress_callback_url,
                    {
                        "workflow_instance_id": workflow_instance.instance_id,
                        "status": "completed",
                        "result": {
                            "document_id": result.request_id,
                            "processing_time": result.processing_time,
                            "quality_score": result.overall_quality_score,
                        },
                    },
                )

            # Clean up tracking
            self._concurrent_workflows -= 1
            if metadata.request_id in self._active_workflows:
                del self._active_workflows[metadata.request_id]
            if metadata.request_id in self._request_metadata:
                del self._request_metadata[metadata.request_id]

        except Exception as e:
            logger.error(f"Async workflow execution failed: {str(e)}")

            # Send failure notification
            if metadata.progress_callback_url:
                await self._send_progress_notification(
                    metadata.progress_callback_url,
                    {
                        "workflow_instance_id": workflow_instance.instance_id,
                        "status": "failed",
                        "error": str(e),
                    },
                )

            self._concurrent_workflows -= 1

    # ========================================================================
    # Document Render Handling
    # ========================================================================

    async def _handle_document_render(
        self, request: Request, call_next: Callable, metadata: WorkflowRequestMetadata
    ) -> Response:
        """Handle document render requests with workflow integration"""
        try:
            # Check if this document has an associated workflow
            document_id = self._extract_document_id_from_path(request.url.path)

            if document_id and metadata.workflow_enabled:
                # Check for existing workflow
                workflow_progress = await self.workflow_bridge.get_workflow_progress(
                    document_id
                )

                if workflow_progress:
                    # Add workflow metadata to response
                    response = await call_next(request)

                    if self.config.enhance_responses and hasattr(response, "headers"):
                        response.headers["X-Workflow-Instance-Id"] = (
                            workflow_progress.workflow_instance_id
                        )
                        response.headers["X-Workflow-Progress"] = str(
                            workflow_progress.completion_percentage
                        )
                        response.headers["X-Workflow-Phase"] = (
                            workflow_progress.current_phase.value
                        )

                    return response

            # Standard processing
            return await call_next(request)

        except Exception as e:
            logger.error(f"Error handling document render: {str(e)}")
            return await call_next(request)

    # ========================================================================
    # Request Analysis and Metadata Extraction
    # ========================================================================

    def _should_apply_workflow_integration(self, request: Request) -> bool:
        """Determine if workflow integration should be applied to this request"""
        if not self.config.enabled:
            return False

        # Check if it's a relevant endpoint
        path = request.url.path
        method = request.method

        # Check document creation endpoints
        if method == "POST" and any(
            self._path_matches(path, endpoint)
            for endpoint in self.config.document_creation_endpoints
        ):
            return True

        # Check document render endpoints
        if method == "POST" and any(
            self._path_matches(path, endpoint)
            for endpoint in self.config.document_render_endpoints
        ):
            return True

        return False

    async def _extract_workflow_metadata(
        self, request: Request
    ) -> WorkflowRequestMetadata:
        """Extract workflow metadata from HTTP request"""
        metadata = WorkflowRequestMetadata(
            endpoint_path=request.url.path, http_method=request.method
        )

        # Extract user ID from request (this would depend on your auth system)
        user_id = getattr(request.state, "user_id", None)
        if not user_id and hasattr(request, "user"):
            user_id = getattr(request.user, "id", None)
        metadata.user_id = user_id

        # Extract workflow headers
        if self.config.detect_workflow_headers:
            workflow_headers = {}
            for header_name, header_value in request.headers.items():
                if header_name.lower().startswith(
                    self.config.workflow_header_prefix.lower()
                ):
                    workflow_headers[header_name] = header_value

            metadata.workflow_headers = workflow_headers

            # Parse specific workflow headers
            if f"{self.config.workflow_header_prefix}Enabled" in workflow_headers:
                metadata.workflow_enabled = (
                    workflow_headers[
                        f"{self.config.workflow_header_prefix}Enabled"
                    ].lower()
                    == "true"
                )

            if f"{self.config.workflow_header_prefix}Template" in workflow_headers:
                metadata.workflow_template_id = workflow_headers[
                    f"{self.config.workflow_header_prefix}Template"
                ]

            if f"{self.config.workflow_header_prefix}Priority" in workflow_headers:
                metadata.priority = workflow_headers[
                    f"{self.config.workflow_header_prefix}Priority"
                ]

            if f"{self.config.workflow_header_prefix}Deadline" in workflow_headers:
                try:
                    deadline_str = workflow_headers[
                        f"{self.config.workflow_header_prefix}Deadline"
                    ]
                    metadata.deadline = datetime.fromisoformat(deadline_str)
                except ValueError:
                    logger.warning(f"Invalid deadline format: {deadline_str}")

        # Extract progress callback URL
        if self.config.progress_callback_header in request.headers:
            metadata.progress_callback_url = request.headers[
                self.config.progress_callback_header
            ]

        # Extract query parameters
        if self.config.detect_workflow_params:
            query_params = dict(request.query_params)

            if "workflow_enabled" in query_params:
                metadata.workflow_enabled = (
                    query_params["workflow_enabled"].lower() == "true"
                )

            if "workflow_template" in query_params:
                metadata.workflow_template_id = query_params["workflow_template"]

            if "priority" in query_params:
                metadata.priority = query_params["priority"]

            if "team_members" in query_params:
                # Parse team member assignments from query parameter
                try:
                    team_data = json.loads(query_params["team_members"])
                    if isinstance(team_data, list):
                        metadata.team_assignments = team_data
                except json.JSONDecodeError:
                    logger.warning("Invalid team_members JSON in query parameters")

        # Auto-enable workflow based on configuration
        if (
            self.config.auto_workflow_integration
            and not metadata.workflow_enabled
            and self._is_document_creation_endpoint(request)
        ):
            metadata.workflow_enabled = True
            metadata.integration_level = self.config.default_integration_level

        # Suggest workflow template if enabled
        if (
            metadata.workflow_enabled
            and not metadata.workflow_template_id
            and self.config.enable_template_suggestions
        ):
            metadata.workflow_template_id = await self._suggest_workflow_template(
                request, metadata
            )

        return metadata

    async def _suggest_workflow_template(
        self, request: Request, metadata: WorkflowRequestMetadata
    ) -> Optional[str]:
        """Suggest appropriate workflow template based on request"""
        try:
            # Parse request to determine document type and complexity
            body = await request.body()
            if body:
                try:
                    request_data = json.loads(body.decode())
                    document_type = request_data.get(
                        "document_type", "standard_document"
                    )

                    # Get templates for this document type
                    templates = self.template_manager.list_templates(
                        document_type=document_type
                    )

                    if templates:
                        if self.config.template_selection_strategy == "best_match":
                            # Select template with highest success rate
                            return max(
                                templates, key=lambda t: t.success_rate
                            ).template_id
                        elif self.config.template_selection_strategy == "most_used":
                            # Select most frequently used template
                            return max(
                                templates, key=lambda t: t.usage_count
                            ).template_id
                        else:
                            # Select latest template
                            return max(
                                templates, key=lambda t: t.created_at
                            ).template_id

                except json.JSONDecodeError:
                    pass

        except Exception as e:
            logger.warning(f"Failed to suggest workflow template: {str(e)}")

        return None

    # ========================================================================
    # Response Enhancement
    # ========================================================================

    async def _enhance_response(
        self, response: Response, metadata: WorkflowRequestMetadata
    ) -> Response:
        """Enhance response with workflow metadata"""
        try:
            if not self.config.include_workflow_metadata:
                return response

            # Add workflow headers if workflow was used
            if metadata.workflow_enabled and hasattr(response, "headers"):
                response.headers["X-Workflow-Enabled"] = "true"
                response.headers["X-Workflow-Integration-Level"] = (
                    metadata.integration_level.value
                )

                if metadata.request_id in self._active_workflows:
                    workflow_instance_id = self._active_workflows[metadata.request_id]
                    response.headers["X-Workflow-Instance-Id"] = workflow_instance_id

                    if self.config.include_progress_links:
                        response.headers["X-Progress-URL"] = (
                            f"/api/v1/workflows/{workflow_instance_id}/progress"
                        )

                if metadata.workflow_template_id:
                    response.headers["X-Workflow-Template-Id"] = (
                        metadata.workflow_template_id
                    )

            return response

        except Exception as e:
            logger.error(f"Failed to enhance response: {str(e)}")
            return response

    # ========================================================================
    # Helper Methods
    # ========================================================================

    def _is_document_creation_endpoint(self, request: Request) -> bool:
        """Check if request is for document creation"""
        if request.method != "POST":
            return False

        path = request.url.path
        return any(
            self._path_matches(path, endpoint)
            for endpoint in self.config.document_creation_endpoints
        )

    def _is_document_render_endpoint(self, request: Request) -> bool:
        """Check if request is for document rendering"""
        if request.method != "POST":
            return False

        path = request.url.path
        return any(
            self._path_matches(path, endpoint)
            for endpoint in self.config.document_render_endpoints
        )

    def _path_matches(self, actual_path: str, pattern: str) -> bool:
        """Check if actual path matches pattern (supports {id} placeholders)"""
        # Simple pattern matching - could be enhanced with regex
        if "{" not in pattern:
            return actual_path == pattern

        # Split by '/' and compare segments
        actual_segments = actual_path.strip("/").split("/")
        pattern_segments = pattern.strip("/").split("/")

        if len(actual_segments) != len(pattern_segments):
            return False

        for actual, pattern_seg in zip(actual_segments, pattern_segments):
            if pattern_seg.startswith("{") and pattern_seg.endswith("}"):
                continue  # Match any value for placeholder
            elif actual != pattern_seg:
                return False

        return True

    def _extract_document_id_from_path(self, path: str) -> Optional[str]:
        """Extract document ID from URL path"""
        # Simple extraction - assumes document ID is the segment after 'documents'
        segments = path.strip("/").split("/")
        try:
            doc_index = segments.index("documents")
            if doc_index + 1 < len(segments):
                return segments[doc_index + 1]
        except ValueError:
            pass

        return None

    async def _send_progress_notification(
        self, callback_url: str, data: Dict[str, Any]
    ):
        """Send progress notification to callback URL"""
        try:
            import aiohttp

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    callback_url, json=data, timeout=aiohttp.ClientTimeout(total=5.0)
                ) as response:
                    if response.status != 200:
                        logger.warning(
                            f"Progress notification failed: {response.status}"
                        )

        except Exception as e:
            logger.warning(f"Failed to send progress notification: {str(e)}")

    async def _setup_event_subscriptions(self):
        """Set up subscriptions to workflow events"""
        try:
            await self.workflow_bridge.subscribe_to_workflow_events(
                self._handle_workflow_event
            )
        except Exception as e:
            logger.error(f"Failed to setup event subscriptions: {str(e)}")

    async def _handle_workflow_event(self, event: DocumentWorkflowEvent):
        """Handle workflow events"""
        try:
            logger.debug(
                f"Received workflow event: {event.event_type} for document {event.document_id}"
            )

            # Find associated request metadata
            request_metadata = None
            for req_id, metadata in self._request_metadata.items():
                if (
                    metadata.user_id == event.user_id
                    and event.workflow_instance_id in self._active_workflows.values()
                ):
                    request_metadata = metadata
                    break

            if request_metadata and request_metadata.progress_callback_url:
                # Send event notification
                await self._send_progress_notification(
                    request_metadata.progress_callback_url,
                    {
                        "event_type": event.event_type,
                        "document_id": event.document_id,
                        "workflow_instance_id": event.workflow_instance_id,
                        "timestamp": event.timestamp.isoformat(),
                        "data": event.data,
                    },
                )

        except Exception as e:
            logger.error(f"Error handling workflow event: {str(e)}")


# ============================================================================
# Factory Functions
# ============================================================================


def create_workflow_middleware(
    workflow_bridge: WorkflowDocumentBridge,
    config: Optional[WorkflowMiddlewareConfig] = None,
) -> WorkflowMiddleware:
    """
    Create workflow middleware instance.

    Args:
            workflow_bridge: The workflow document bridge
            config: Optional middleware configuration

    Returns:
            Configured WorkflowMiddleware instance
    """
    return WorkflowMiddleware(None, workflow_bridge, config)


def add_workflow_middleware_to_app(
    app,  # FastAPI app
    workflow_bridge: WorkflowDocumentBridge,
    config: Optional[WorkflowMiddlewareConfig] = None,
):
    """
    Add workflow middleware to FastAPI application.

    Args:
            app: FastAPI application instance
            workflow_bridge: The workflow document bridge
            config: Optional middleware configuration
    """
    middleware = WorkflowMiddleware(app, workflow_bridge, config)
    app.add_middleware(
        WorkflowMiddleware, workflow_bridge=workflow_bridge, config=config
    )
