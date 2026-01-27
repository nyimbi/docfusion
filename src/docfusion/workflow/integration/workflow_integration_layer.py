#!/usr/bin/env python3
"""
Comprehensive Workflow Integration Layer

This module provides the complete integration layer that connects all workflow
automation components with the existing document creation processes. It serves
as the central orchestration point for workflow-enabled document operations.

Key Features:
- Complete workflow automation setup and initialization
- Seamless integration with DocumentEngine and API endpoints
- Workflow-aware storage and document management
- Real-time monitoring and analytics
- Event-driven architecture with comprehensive error handling
- Production-ready configuration and deployment support
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Union

try:
    from uuid_extensions import uuid7str
except ImportError:
    from uuid import uuid4

    def uuid7str() -> str:
        return str(uuid4())


from pydantic import BaseModel, ConfigDict, Field

from ..automation.task_scheduler import SchedulerConfiguration, TaskScheduler

# Import workflow components
from ..automation.workflow_engine import WorkflowConfiguration, WorkflowEngine
from ..coordination.deadline_manager import DeadlineConfiguration, DeadlineManager
from ..coordination.task_coordinator import CoordinatorConfiguration, TaskCoordinator
from ..monitoring.workflow_monitor import MonitoringConfiguration, WorkflowMonitor

# Import new comprehensive integrations
from .agents_workflow_integration import AgentsWorkflowIntegration
from .nlp_workflow_integration import NLPWorkflowIntegration
from .security_workflow_integration import SecurityWorkflowIntegration
from .unified_docufusion_integration import UnifiedDocuFusionIntegration

# Import integration components
from .workflow_document_bridge import (
    WorkflowDocumentBridge,
    WorkflowDocumentConfiguration,
    create_workflow_document_bridge,
)
from .workflow_storage_integration import (
    WorkflowStorageIntegration,
    create_workflow_storage_integration,
)

# Legacy middleware components (maintained for compatibility)
try:
    from .workflow_middleware import WorkflowMiddleware
    from .workflow_request_extensions import WorkflowRequestExtensions
except ImportError:
    # Create placeholder classes if not available
    class WorkflowMiddleware:
        def __init__(self, *args, **kwargs):
            pass

    class WorkflowRequestExtensions:
        def __init__(self, *args, **kwargs):
            pass


# Import existing system components
from ...api.endpoints.document_endpoints import DocumentEndpoints
from ...document_engine.document_engine import (
    DocumentEngine,
    DocumentGenerationConfiguration,
)
from ...storage.storage_service import StorageService

logger = logging.getLogger(__name__)


# ============================================================================
# Configuration Models
# ============================================================================


class IntegrationMode(Enum):
    """Integration modes for different deployment scenarios"""

    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"


class WorkflowIntegrationConfiguration(BaseModel):
    """Comprehensive configuration for workflow integration"""

    model_config = ConfigDict(extra="forbid")

    # Deployment settings
    integration_mode: IntegrationMode = IntegrationMode.DEVELOPMENT
    enable_background_tasks: bool = True
    enable_event_logging: bool = True
    enable_performance_monitoring: bool = True

    # Component configurations
    workflow_engine_config: Optional[WorkflowConfiguration] = None
    scheduler_config: Optional[SchedulerConfiguration] = None
    coordinator_config: Optional[CoordinatorConfiguration] = None
    deadline_config: Optional[DeadlineConfiguration] = None
    monitoring_config: Optional[MonitoringConfiguration] = None
    bridge_config: Optional[WorkflowDocumentConfiguration] = None

    # Integration settings
    enable_api_middleware: bool = True
    enable_storage_integration: bool = True
    enable_document_bridge: bool = True
    enable_workflow_templates: bool = True

    # Performance settings
    max_concurrent_workflows: int = 100
    workflow_timeout_minutes: int = 120
    task_retry_attempts: int = 3
    monitoring_interval_seconds: int = 30

    # Storage settings
    workflow_data_retention_days: int = 90
    enable_workflow_caching: bool = True
    cache_size_limit: int = 1000

    # Event settings
    enable_event_notifications: bool = True
    event_batch_size: int = 50
    event_flush_interval_seconds: int = 10


# ============================================================================
# Main Integration Layer
# ============================================================================


class WorkflowIntegrationLayer:
    """
    Comprehensive workflow integration layer that orchestrates all
    workflow automation components and their integration with the
    existing document creation system.
    """

    def __init__(
        self,
        document_engine: DocumentEngine,
        storage_service: StorageService,
        config: Optional[WorkflowIntegrationConfiguration] = None,
    ):
        self.document_engine = document_engine
        self.storage_service = storage_service
        self.config = config or WorkflowIntegrationConfiguration()

        # Core workflow components (will be initialized)
        self.workflow_engine: Optional[WorkflowEngine] = None
        self.task_scheduler: Optional[TaskScheduler] = None
        self.task_coordinator: Optional[TaskCoordinator] = None
        self.deadline_manager: Optional[DeadlineManager] = None
        self.workflow_monitor: Optional[WorkflowMonitor] = None

        # Integration components (will be initialized)
        self.document_bridge: Optional[WorkflowDocumentBridge] = None
        self.storage_integration: Optional[WorkflowStorageIntegration] = None
        self.workflow_middleware: Optional[WorkflowMiddleware] = None
        self.request_extensions: Optional[WorkflowRequestExtensions] = None

        # Comprehensive integrations (new)
        self.agents_integration: Optional[AgentsWorkflowIntegration] = None
        self.security_integration: Optional[SecurityWorkflowIntegration] = None
        self.nlp_integration: Optional[NLPWorkflowIntegration] = None
        self.unified_integration: Optional[UnifiedDocuFusionIntegration] = None

        # State tracking
        self.is_initialized = False
        self.background_tasks: List[asyncio.Task] = []
        self.event_subscribers: List[Callable[[Dict[str, Any]], None]] = []
        self.performance_metrics: Dict[str, Any] = {}

        # Lifecycle management
        self._shutdown_event = asyncio.Event()
        self._initialization_lock = asyncio.Lock()

        logger.info(
            f"WorkflowIntegrationLayer created in {self.config.integration_mode.value} mode"
        )

    # ========================================================================
    # Initialization and Setup
    # ========================================================================

    async def initialize(self) -> bool:
        """
        Initialize the complete workflow integration system.

        Returns:
                bool: True if initialization was successful
        """
        async with self._initialization_lock:
            if self.is_initialized:
                logger.warning("WorkflowIntegrationLayer already initialized")
                return True

            try:
                logger.info("Initializing WorkflowIntegrationLayer...")

                # Phase 1: Initialize core workflow components
                await self._initialize_core_components()

                # Phase 2: Initialize integration components
                await self._initialize_integration_components()

                # Phase 3: Setup cross-component connections
                await self._setup_component_connections()

                # Phase 4: Start background services
                if self.config.enable_background_tasks:
                    await self._start_background_tasks()

                # Phase 5: Setup event handling
                await self._setup_event_handling()

                # Phase 6: Validate system health
                await self._validate_system_health()

                self.is_initialized = True
                logger.info("WorkflowIntegrationLayer initialized successfully")
                return True

            except Exception as e:
                logger.error(f"Failed to initialize WorkflowIntegrationLayer: {str(e)}")
                await self._cleanup_partial_initialization()
                return False

    async def _initialize_core_components(self):
        """Initialize core workflow automation components."""
        logger.info("Initializing core workflow components...")

        # Initialize WorkflowEngine
        workflow_config = self.config.workflow_engine_config or WorkflowConfiguration()
        self.workflow_engine = WorkflowEngine(config=workflow_config)
        await self.workflow_engine.initialize()

        # Initialize TaskScheduler
        scheduler_config = self.config.scheduler_config or SchedulerConfiguration()
        self.task_scheduler = TaskScheduler(config=scheduler_config)
        await self.task_scheduler.initialize()

        # Initialize TaskCoordinator
        coordinator_config = (
            self.config.coordinator_config or CoordinatorConfiguration()
        )
        self.task_coordinator = TaskCoordinator(config=coordinator_config)
        await self.task_coordinator.initialize()

        # Initialize DeadlineManager
        deadline_config = self.config.deadline_config or DeadlineConfiguration()
        self.deadline_manager = DeadlineManager(config=deadline_config)
        await self.deadline_manager.initialize()

        # Initialize WorkflowMonitor
        monitoring_config = self.config.monitoring_config or MonitoringConfiguration()
        self.workflow_monitor = WorkflowMonitor(config=monitoring_config)
        await self.workflow_monitor.initialize()

        logger.info("Core workflow components initialized")

    async def _initialize_integration_components(self):
        """Initialize integration components."""
        logger.info("Initializing integration components...")

        # Initialize WorkflowStorageIntegration
        if self.config.enable_storage_integration:
            self.storage_integration = await create_workflow_storage_integration(
                storage_service=self.storage_service,
                workflow_engine=self.workflow_engine,
                workflow_monitor=self.workflow_monitor,
            )

        # Initialize WorkflowDocumentBridge
        if self.config.enable_document_bridge:
            bridge_config = self.config.bridge_config or WorkflowDocumentConfiguration()
            self.document_bridge = await create_workflow_document_bridge(
                workflow_engine=self.workflow_engine,
                task_scheduler=self.task_scheduler,
                task_coordinator=self.task_coordinator,
                deadline_manager=self.deadline_manager,
                workflow_monitor=self.workflow_monitor,
                document_engine=self.document_engine,
                config=bridge_config,
            )

        # Initialize WorkflowMiddleware
        if self.config.enable_api_middleware:
            self.workflow_middleware = WorkflowMiddleware(
                workflow_engine=self.workflow_engine,
                document_bridge=self.document_bridge,
            )

        # Initialize WorkflowRequestExtensions
        self.request_extensions = WorkflowRequestExtensions(
            workflow_engine=self.workflow_engine, task_coordinator=self.task_coordinator
        )

        # Initialize comprehensive integrations (new capabilities)
        await self._initialize_comprehensive_integrations()

        logger.info("Integration components initialized")

    async def _initialize_comprehensive_integrations(self):
        """Initialize comprehensive integration components for enhanced capabilities."""
        logger.info("Initializing comprehensive integrations...")

        try:
            # Initialize agents-workflow integration
            if self.config.integration_mode in [
                IntegrationMode.COMPREHENSIVE,
                IntegrationMode.DEVELOPMENT,
            ]:
                from .agents_workflow_integration import (
                    create_agents_workflow_integration,
                )

                self.agents_integration = await create_agents_workflow_integration(
                    task_coordinator=self.task_coordinator,
                    deadline_manager=self.deadline_manager,
                    workflow_monitor=self.workflow_monitor,
                    auto_create_specialists=True,
                )
                logger.info("Agents-workflow integration initialized")

            # Initialize security-workflow integration
            if self.config.integration_mode in [
                IntegrationMode.COMPREHENSIVE,
                IntegrationMode.PRODUCTION,
            ]:
                try:
                    from ...security.security_manager import create_security_manager
                    from .security_workflow_integration import (
                        create_security_workflow_integration,
                    )

                    # Create security manager if not available
                    security_manager = create_security_manager()

                    self.security_integration = (
                        await create_security_workflow_integration(
                            security_manager=security_manager,
                            task_coordinator=self.task_coordinator,
                            deadline_manager=self.deadline_manager,
                            workflow_monitor=self.workflow_monitor,
                        )
                    )
                    logger.info("Security-workflow integration initialized")
                except ImportError as e:
                    logger.warning(f"Security integration not available: {e}")

            # Initialize NLP-workflow integration
            if self.config.integration_mode in [
                IntegrationMode.COMPREHENSIVE,
                IntegrationMode.DEVELOPMENT,
            ]:
                from .nlp_workflow_integration import create_nlp_workflow_integration

                self.nlp_integration = await create_nlp_workflow_integration(
                    task_coordinator=self.task_coordinator,
                    deadline_manager=self.deadline_manager,
                    workflow_monitor=self.workflow_monitor,
                    auto_start=True,
                )
                logger.info("NLP-workflow integration initialized")

            # Initialize unified DocuFusion integration for comprehensive capabilities
            if self.config.integration_mode == IntegrationMode.COMPREHENSIVE:
                from .unified_docufusion_integration import (
                    IntegrationConfiguration,
                    IntegrationScope,
                    create_unified_docufusion_integration,
                )

                unified_config = IntegrationConfiguration(
                    integration_scope=IntegrationScope.COMPREHENSIVE,
                    auto_initialize_components=False,  # We already have components
                    enable_cross_component_optimization=True,
                    enable_intelligent_routing=True,
                    enable_performance_monitoring=True,
                )

                self.unified_integration = await create_unified_docufusion_integration(
                    config=unified_config,
                    document_engine=self.document_engine,
                    storage_service=self.storage_service,
                    auto_initialize=False,  # We'll initialize manually
                )

                # Provide existing components to unified integration
                self.unified_integration.task_coordinator = self.task_coordinator
                self.unified_integration.deadline_manager = self.deadline_manager
                self.unified_integration.workflow_monitor = self.workflow_monitor
                self.unified_integration.agents_integration = self.agents_integration
                self.unified_integration.security_integration = (
                    self.security_integration
                )
                self.unified_integration.nlp_integration = self.nlp_integration
                self.unified_integration.storage_integration = self.storage_integration

                # Initialize unified integration
                unified_result = await self.unified_integration.initialize_integration()
                if unified_result["success"]:
                    logger.info(
                        "Unified DocuFusion integration initialized successfully"
                    )
                else:
                    logger.warning(
                        f"Unified integration initialization had issues: {unified_result.get('error', 'Unknown error')}"
                    )

            logger.info("Comprehensive integrations initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize comprehensive integrations: {e}")
            # Don't fail the entire initialization - comprehensive integrations are optional
            logger.warning("Continuing without comprehensive integrations")

    async def _setup_component_connections(self):
        """Setup connections and event subscriptions between components."""
        logger.info("Setting up component connections...")

        # Connect WorkflowEngine to TaskScheduler
        await self.workflow_engine.subscribe_to_workflow_events(
            self._handle_workflow_engine_events
        )

        # Connect TaskScheduler to TaskCoordinator
        await self.task_scheduler.subscribe_to_scheduling_events(
            self._handle_scheduler_events
        )

        # Connect TaskCoordinator to DeadlineManager
        await self.task_coordinator.subscribe_to_coordination_events(
            self._handle_coordination_events
        )

        # Connect all components to WorkflowMonitor
        await self.workflow_monitor.register_event_source(
            "workflow_engine", self.workflow_engine
        )
        await self.workflow_monitor.register_event_source(
            "task_scheduler", self.task_scheduler
        )
        await self.workflow_monitor.register_event_source(
            "task_coordinator", self.task_coordinator
        )
        await self.workflow_monitor.register_event_source(
            "deadline_manager", self.deadline_manager
        )

        # Connect DocumentBridge to other components if enabled
        if self.document_bridge:
            await self.document_bridge.subscribe_to_workflow_events(
                self._handle_document_bridge_events
            )

        logger.info("Component connections established")

    async def _start_background_tasks(self):
        """Start background monitoring and maintenance tasks."""
        logger.info("Starting background tasks...")

        # Performance monitoring task
        if self.config.enable_performance_monitoring:
            performance_task = asyncio.create_task(self._performance_monitoring_loop())
            self.background_tasks.append(performance_task)

        # System health check task
        health_task = asyncio.create_task(self._health_monitoring_loop())
        self.background_tasks.append(health_task)

        # Event processing task
        if self.config.enable_event_notifications:
            event_task = asyncio.create_task(self._event_processing_loop())
            self.background_tasks.append(event_task)

        # Cleanup task
        cleanup_task = asyncio.create_task(self._cleanup_monitoring_loop())
        self.background_tasks.append(cleanup_task)

        logger.info(f"Started {len(self.background_tasks)} background tasks")

    async def _setup_event_handling(self):
        """Setup comprehensive event handling system."""
        logger.info("Setting up event handling...")

        # Setup event logging if enabled
        if self.config.enable_event_logging:
            await self.subscribe_to_workflow_events(self._log_workflow_events)

        # Setup performance tracking
        if self.config.enable_performance_monitoring:
            await self.subscribe_to_workflow_events(self._track_performance_events)

        logger.info("Event handling configured")

    async def _validate_system_health(self):
        """Validate that all components are healthy and properly connected."""
        logger.info("Validating system health...")

        health_checks = []

        # Check core components
        for component_name, component in [
            ("workflow_engine", self.workflow_engine),
            ("task_scheduler", self.task_scheduler),
            ("task_coordinator", self.task_coordinator),
            ("deadline_manager", self.deadline_manager),
            ("workflow_monitor", self.workflow_monitor),
        ]:
            if component and hasattr(component, "health_check"):
                try:
                    health = await component.health_check()
                    health_checks.append(
                        (component_name, health.get("status") == "healthy")
                    )
                except Exception as e:
                    logger.warning(
                        f"Health check failed for {component_name}: {str(e)}"
                    )
                    health_checks.append((component_name, False))

        # Check integration components
        if self.document_bridge:
            health_checks.append(("document_bridge", True))

        if self.storage_integration:
            health_checks.append(("storage_integration", True))

        # Validate results
        failed_components = [name for name, healthy in health_checks if not healthy]
        if failed_components:
            raise RuntimeError(
                f"Health check failed for components: {failed_components}"
            )

        logger.info(
            f"System health validated - {len(health_checks)} components healthy"
        )

    # ========================================================================
    # Public API Methods
    # ========================================================================

    async def create_workflow_enabled_document(
        self,
        request_data: Dict[str, Any],
        user_id: str,
        workflow_config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create a document using the complete workflow automation system.

        Args:
                request_data: Document creation request data
                user_id: User creating the document
                workflow_config: Optional workflow configuration

        Returns:
                Comprehensive result including document and workflow information
        """
        if not self.is_initialized:
            raise RuntimeError("WorkflowIntegrationLayer not initialized")

        try:
            # Extend the request with workflow configuration
            extended_request = await self.request_extensions.extend_document_request(
                request_data=request_data,
                user_id=user_id,
                workflow_config=workflow_config,
            )

            # Create workflow instance using the document bridge
            if self.document_bridge:
                workflow_instance = await self.document_bridge.create_document_workflow(
                    document_request=extended_request,
                    assigned_users=[user_id],
                    deadline=extended_request.deadline
                    if hasattr(extended_request, "deadline")
                    else None,
                )

                # Execute the workflow-enabled document generation
                result = await self.document_bridge.execute_document_workflow(
                    workflow_instance.instance_id, extended_request
                )

                # Store the document with workflow context
                if self.storage_integration:
                    storage_result = (
                        await self.storage_integration.store_workflow_document(
                            document_id=extended_request.request_id,
                            workflow_instance_id=workflow_instance.instance_id,
                            content=self._extract_content_from_result(result),
                            title=extended_request.generation_config.document_title
                            or "Generated Document",
                            phase="completed",
                            generation_result=result,
                            metadata=request_data.get("metadata", {}),
                        )
                    )

                return {
                    "success": True,
                    "document_id": extended_request.request_id,
                    "workflow_instance_id": workflow_instance.instance_id,
                    "generation_result": result,
                    "storage_result": storage_result
                    if self.storage_integration
                    else None,
                    "workflow_progress": await self.document_bridge.get_workflow_progress(
                        extended_request.request_id
                    ),
                }
            else:
                # Fallback to direct document generation
                result = await self.document_engine.generate_document(extended_request)

                return {
                    "success": True,
                    "document_id": extended_request.request_id,
                    "generation_result": result,
                    "workflow_enabled": False,
                }

        except Exception as e:
            logger.error(f"Failed to create workflow-enabled document: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "workflow_enabled": self.document_bridge is not None,
            }

    async def get_workflow_document_recommendations(
        self, user_id: str, context: Dict[str, Any], limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get intelligent document recommendations based on workflow context.

        Args:
                user_id: User requesting recommendations
                context: Context for recommendations (workflow, phase, etc.)
                limit: Maximum number of recommendations

        Returns:
                List of recommended documents with workflow context
        """
        if not self.storage_integration:
            return []

        try:
            # Extract workflow context
            workflow_instance_id = context.get("workflow_instance_id")
            current_phase = context.get("current_phase", "unknown")

            if workflow_instance_id:
                recommendations = await self.storage_integration.get_workflow_document_recommendations(
                    workflow_instance_id=workflow_instance_id,
                    current_phase=current_phase,
                    user_id=user_id,
                    limit=limit,
                )
            else:
                # Fallback to general search
                query = context.get("query", "")
                recommendations = (
                    await self.storage_integration.search_workflow_documents(
                        query=query, user_id=user_id, limit=limit
                    )
                )

            return [r.dict() for r in recommendations]

        except Exception as e:
            logger.error(f"Failed to get workflow document recommendations: {str(e)}")
            return []

    async def get_comprehensive_workflow_analytics(
        self, time_period_days: int = 30, include_predictions: bool = True
    ) -> Dict[str, Any]:
        """
        Get comprehensive analytics across all workflow components.

        Args:
                time_period_days: Analysis period in days
                include_predictions: Whether to include predictive analytics

        Returns:
                Comprehensive analytics data
        """
        try:
            analytics = {
                "analysis_period_days": time_period_days,
                "generated_at": datetime.now().isoformat(),
                "system_health": await self._get_system_health_summary(),
                "performance_metrics": self.performance_metrics.copy(),
            }

            # Get component-specific analytics
            if self.workflow_monitor:
                analytics[
                    "workflow_metrics"
                ] = await self.workflow_monitor.get_comprehensive_workflow_metrics()

            if self.storage_integration:
                analytics[
                    "storage_insights"
                ] = await self.storage_integration.get_workflow_performance_insights(
                    time_period_days=time_period_days
                )

            if self.document_bridge:
                # Get document generation analytics from the bridge
                pass  # Would implement bridge-specific analytics

            # Add predictive analytics if requested
            if include_predictions:
                analytics["predictions"] = await self._generate_predictive_analytics(
                    analytics
                )

            return analytics

        except Exception as e:
            logger.error(f"Failed to get comprehensive analytics: {str(e)}")
            return {"error": str(e)}

    async def trigger_workflow_event(
        self,
        event_type: str,
        event_data: Dict[str, Any],
        target_workflow_id: Optional[str] = None,
    ) -> bool:
        """
        Trigger a workflow event that can affect running workflows.

        Args:
                event_type: Type of event to trigger
                event_data: Event data payload
                target_workflow_id: Optional specific workflow to target

        Returns:
                bool: True if event was processed successfully
        """
        if not self.workflow_engine:
            return False

        try:
            # Emit event through the workflow engine
            await self.workflow_engine.emit_workflow_event(
                workflow_instance_id=target_workflow_id or "system",
                event_type=event_type,
                event_data=event_data,
            )

            # Notify all subscribers
            event_payload = {
                "event_type": event_type,
                "event_data": event_data,
                "target_workflow_id": target_workflow_id,
                "triggered_at": datetime.now().isoformat(),
            }

            await self._notify_event_subscribers(event_payload)

            return True

        except Exception as e:
            logger.error(f"Failed to trigger workflow event: {str(e)}")
            return False

    async def subscribe_to_workflow_events(
        self, callback: Callable[[Dict[str, Any]], None]
    ) -> str:
        """
        Subscribe to workflow events from the integration layer.

        Args:
                callback: Callback function for events

        Returns:
                str: Subscription ID
        """
        subscription_id = uuid7str()
        self.event_subscribers.append((subscription_id, callback))
        logger.info(f"Added workflow event subscription {subscription_id}")
        return subscription_id

    async def unsubscribe_from_workflow_events(self, subscription_id: str) -> bool:
        """
        Unsubscribe from workflow events.

        Args:
                subscription_id: Subscription ID to remove

        Returns:
                bool: True if successfully unsubscribed
        """
        for i, (sub_id, callback) in enumerate(self.event_subscribers):
            if sub_id == subscription_id:
                del self.event_subscribers[i]
                logger.info(f"Removed workflow event subscription {subscription_id}")
                return True
        return False

    # ========================================================================
    # Comprehensive Integration Access Methods
    # ========================================================================

    def get_agents_integration(self) -> Optional[AgentsWorkflowIntegration]:
        """Get the agents-workflow integration component."""
        return self.agents_integration

    def get_security_integration(self) -> Optional[SecurityWorkflowIntegration]:
        """Get the security-workflow integration component."""
        return self.security_integration

    def get_nlp_integration(self) -> Optional[NLPWorkflowIntegration]:
        """Get the NLP-workflow integration component."""
        return self.nlp_integration

    def get_unified_integration(self) -> Optional[UnifiedDocuFusionIntegration]:
        """Get the unified DocuFusion integration component."""
        return self.unified_integration

    async def create_agent_enabled_workflow(
        self,
        workflow_request: Dict[str, Any],
        user_id: str,
        agent_requirements: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create workflow with intelligent agent assignment and coordination.

        Args:
                workflow_request: Basic workflow creation request
                user_id: User ID for the workflow
                agent_requirements: Specific agent requirements and preferences

        Returns:
                Enhanced workflow result with agent coordination
        """
        if not self.agents_integration:
            return {"success": False, "error": "Agent integration not available"}

        try:
            # Enhance workflow request with agent capabilities
            workflow_id = uuid7str()

            # Assign agents based on workflow requirements
            agent_assignments = await self.agents_integration.assign_agents_to_workflow(
                workflow_id=workflow_id, workflow_requirements=agent_requirements or {}
            )

            # Create agent crew if multiple agents assigned
            if len(agent_assignments) > 1:
                crew = await self.agents_integration.create_agent_crew_for_workflow(
                    workflow_id=workflow_id, crew_configuration=agent_requirements or {}
                )
                workflow_request["agent_crew_id"] = crew.crew_id if crew else None

            # Execute workflow with agent coordination
            execution_result = (
                await self.agents_integration.execute_workflow_with_agents(
                    workflow_id=workflow_id, workflow_definition=workflow_request
                )
            )

            return {
                "success": True,
                "workflow_id": workflow_id,
                "agent_assignments": {
                    role: assignment.agent_id
                    for role, assignment in agent_assignments.items()
                },
                "execution_result": execution_result,
            }

        except Exception as e:
            logger.error(f"Failed to create agent-enabled workflow: {e}")
            return {"success": False, "error": str(e)}

    async def execute_secure_workflow(
        self,
        workflow_request: Dict[str, Any],
        user_credentials: Dict[str, Any],
        security_requirements: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute workflow with comprehensive security enforcement.

        Args:
                workflow_request: Workflow execution request
                user_credentials: User authentication credentials
                security_requirements: Security level and requirements

        Returns:
                Secure workflow execution result
        """
        if not self.security_integration:
            return {"success": False, "error": "Security integration not available"}

        try:
            # Authenticate user
            (
                auth_success,
                auth_data,
            ) = await self.security_integration.authenticate_workflow_user(
                username=user_credentials.get("username", ""),
                password=user_credentials.get("password", ""),
                mfa_code=user_credentials.get("mfa_code"),
                ip_address=user_credentials.get("ip_address"),
                user_agent=user_credentials.get("user_agent"),
                workflow_id=workflow_request.get("workflow_id"),
            )

            if not auth_success:
                return {
                    "success": False,
                    "error": "Authentication failed",
                    "auth_data": auth_data,
                }

            # Create security context
            from .security_workflow_integration import (
                WorkflowSecurityContext,
                WorkflowSecurityLevel,
            )

            security_context = WorkflowSecurityContext(
                user_id=auth_data["user_id"],
                security_level=WorkflowSecurityLevel(
                    security_requirements.get("security_level", "internal")
                ),
                ip_address=user_credentials.get("ip_address"),
                user_agent=user_credentials.get("user_agent"),
            )

            # Execute secure workflow
            secure_result = await self.security_integration.execute_secure_workflow(
                workflow_id=workflow_request.get("workflow_id", uuid7str()),
                workflow_definition=workflow_request,
                security_context=security_context,
            )

            return {
                "success": secure_result.success,
                "workflow_id": secure_result.workflow_id,
                "security_level": secure_result.security_level.value,
                "encrypted": secure_result.encrypted,
                "result_data": secure_result.result_data,
                "security_warnings": secure_result.security_warnings,
            }

        except Exception as e:
            logger.error(f"Failed to execute secure workflow: {e}")
            return {"success": False, "error": str(e)}

    async def process_workflow_with_nlp(
        self, workflow_request: Dict[str, Any], nlp_requirements: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process workflow with advanced NLP capabilities.

        Args:
                workflow_request: Basic workflow request
                nlp_requirements: NLP processing requirements and configuration

        Returns:
                Workflow result enhanced with NLP processing
        """
        if not self.nlp_integration:
            return {"success": False, "error": "NLP integration not available"}

        try:
            from .nlp_workflow_integration import (
                ContentType,
                NLPProcessingMode,
                NLPWorkflowContext,
            )

            # Create NLP context
            nlp_context = NLPWorkflowContext(
                workflow_id=workflow_request.get("workflow_id", uuid7str()),
                user_id=workflow_request.get("user_id", "system"),
                content_type=ContentType(
                    nlp_requirements.get("content_type", "plain_text")
                ),
                processing_mode=NLPProcessingMode(
                    nlp_requirements.get("processing_mode", "batch")
                ),
                quality_threshold=nlp_requirements.get("quality_threshold", 0.8),
            )

            # Execute NLP pipeline if specified
            if "pipeline_stages" in nlp_requirements:
                pipeline_results = (
                    await self.nlp_integration.execute_nlp_workflow_pipeline(
                        workflow_id=nlp_context.workflow_id,
                        pipeline_definition={
                            "stages": nlp_requirements["pipeline_stages"]
                        },
                        context=nlp_context,
                    )
                )

                return {
                    "success": True,
                    "workflow_id": nlp_context.workflow_id,
                    "nlp_pipeline_results": [
                        result.dict() for result in pipeline_results
                    ],
                    "processing_mode": nlp_context.processing_mode.value,
                }

            # Execute parallel NLP tasks if specified
            elif "parallel_tasks" in nlp_requirements:
                from .nlp_workflow_integration import (
                    NLPTaskConfiguration,
                    NLPWorkflowTaskType,
                )

                task_configs = []
                for task_spec in nlp_requirements["parallel_tasks"]:
                    task_config = NLPTaskConfiguration(
                        task_type=NLPWorkflowTaskType(task_spec["task_type"]),
                        parameters=task_spec.get("parameters", {}),
                        quality_criteria=task_spec.get("quality_criteria", {}),
                    )
                    task_configs.append(task_config)

                parallel_results = (
                    await self.nlp_integration.coordinate_parallel_nlp_tasks(
                        workflow_id=nlp_context.workflow_id,
                        task_configurations=task_configs,
                        context=nlp_context,
                    )
                )

                return {
                    "success": True,
                    "workflow_id": nlp_context.workflow_id,
                    "nlp_parallel_results": [
                        result.dict() for result in parallel_results
                    ],
                    "tasks_completed": len(parallel_results),
                }

            else:
                return {"success": False, "error": "No NLP processing specified"}

        except Exception as e:
            logger.error(f"Failed to process workflow with NLP: {e}")
            return {"success": False, "error": str(e)}

    async def execute_unified_workflow(
        self, unified_request: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute workflow using the unified DocuFusion integration.

        Args:
                unified_request: Comprehensive workflow request with all component requirements

        Returns:
                Unified workflow execution result
        """
        if not self.unified_integration:
            return {"success": False, "error": "Unified integration not available"}

        try:
            from .unified_docufusion_integration import (
                UnifiedWorkflowRequest,
                WorkflowExecutionMode,
            )

            # Convert to unified request format
            unified_workflow_request = UnifiedWorkflowRequest(
                workflow_id=unified_request.get("workflow_id", uuid7str()),
                user_id=unified_request["user_id"],
                workflow_type=unified_request.get("workflow_type", "document_creation"),
                execution_mode=WorkflowExecutionMode(
                    unified_request.get("execution_mode", "intelligent")
                ),
                document_request=unified_request.get("document_request"),
                security_context=unified_request.get("security_context"),
                agent_requirements=unified_request.get("agent_requirements"),
                nlp_requirements=unified_request.get("nlp_requirements"),
                storage_config=unified_request.get("storage_config"),
                priority=unified_request.get("priority", 0.5),
                deadline=unified_request.get("deadline"),
                quality_threshold=unified_request.get("quality_threshold", 0.8),
            )

            # Execute unified workflow
            unified_result = await self.unified_integration.execute_unified_workflow(
                unified_workflow_request
            )

            return {
                "success": unified_result.success,
                "workflow_id": unified_result.workflow_id,
                "execution_mode": unified_result.execution_mode.value,
                "total_execution_time": unified_result.total_execution_time,
                "overall_quality_score": unified_result.overall_quality_score,
                "components_used": unified_result.components_used,
                "final_output": unified_result.final_output,
                "warnings": unified_result.warnings,
                "recommendations": unified_result.recommendations,
            }

        except Exception as e:
            logger.error(f"Failed to execute unified workflow: {e}")
            return {"success": False, "error": str(e)}

    # ========================================================================
    # Event Handlers
    # ========================================================================

    async def _handle_workflow_engine_events(self, event: Dict[str, Any]):
        """Handle events from the workflow engine."""
        try:
            event_type = event.get("event_type")

            if event_type == "workflow_started":
                await self._on_workflow_started(event)
            elif event_type == "workflow_completed":
                await self._on_workflow_completed(event)
            elif event_type == "workflow_failed":
                await self._on_workflow_failed(event)

            # Forward to subscribers
            await self._notify_event_subscribers(event)

        except Exception as e:
            logger.error(f"Error handling workflow engine event: {str(e)}")

    async def _handle_scheduler_events(self, event: Dict[str, Any]):
        """Handle events from the task scheduler."""
        try:
            event_type = event.get("event_type")

            if event_type == "task_scheduled":
                await self._on_task_scheduled(event)
            elif event_type == "task_completed":
                await self._on_task_completed(event)

            # Forward to subscribers
            await self._notify_event_subscribers(event)

        except Exception as e:
            logger.error(f"Error handling scheduler event: {str(e)}")

    async def _handle_coordination_events(self, event: Dict[str, Any]):
        """Handle events from the task coordinator."""
        try:
            event_type = event.get("event_type")

            if event_type == "task_assigned":
                await self._on_task_assigned(event)
            elif event_type == "workload_rebalanced":
                await self._on_workload_rebalanced(event)

            # Forward to subscribers
            await self._notify_event_subscribers(event)

        except Exception as e:
            logger.error(f"Error handling coordination event: {str(e)}")

    async def _handle_document_bridge_events(self, event: Dict[str, Any]):
        """Handle events from the document bridge."""
        try:
            event_type = event.get("event_type")

            if event_type == "document_generated":
                await self._on_document_generated(event)
            elif event_type == "workflow_progress_updated":
                await self._on_workflow_progress_updated(event)

            # Forward to subscribers
            await self._notify_event_subscribers(event)

        except Exception as e:
            logger.error(f"Error handling document bridge event: {str(e)}")

    # ========================================================================
    # Specific Event Handlers
    # ========================================================================

    async def _on_workflow_started(self, event: Dict[str, Any]):
        """Handle workflow started event."""
        workflow_id = event.get("workflow_instance_id")
        if workflow_id:
            self.performance_metrics[f"workflow_{workflow_id}_start_time"] = (
                datetime.now()
            )
            logger.info(f"Workflow {workflow_id} started")

    async def _on_workflow_completed(self, event: Dict[str, Any]):
        """Handle workflow completed event."""
        workflow_id = event.get("workflow_instance_id")
        if workflow_id:
            start_time = self.performance_metrics.get(
                f"workflow_{workflow_id}_start_time"
            )
            if start_time:
                duration = (datetime.now() - start_time).total_seconds()
                self.performance_metrics[f"workflow_{workflow_id}_duration"] = duration
            logger.info(f"Workflow {workflow_id} completed")

    async def _on_workflow_failed(self, event: Dict[str, Any]):
        """Handle workflow failed event."""
        workflow_id = event.get("workflow_instance_id")
        error = event.get("error", "Unknown error")
        logger.warning(f"Workflow {workflow_id} failed: {error}")

    async def _on_task_scheduled(self, event: Dict[str, Any]):
        """Handle task scheduled event."""
        task_id = event.get("task_id")
        if task_id:
            self.performance_metrics[f"task_{task_id}_scheduled_time"] = datetime.now()

    async def _on_task_completed(self, event: Dict[str, Any]):
        """Handle task completed event."""
        task_id = event.get("task_id")
        if task_id:
            scheduled_time = self.performance_metrics.get(
                f"task_{task_id}_scheduled_time"
            )
            if scheduled_time:
                duration = (datetime.now() - scheduled_time).total_seconds()
                self.performance_metrics[f"task_{task_id}_duration"] = duration

    async def _on_task_assigned(self, event: Dict[str, Any]):
        """Handle task assigned event."""
        task_id = event.get("task_id")
        user_id = event.get("assigned_user_id")
        logger.debug(f"Task {task_id} assigned to user {user_id}")

    async def _on_workload_rebalanced(self, event: Dict[str, Any]):
        """Handle workload rebalanced event."""
        logger.info("Workload rebalancing completed")

    async def _on_document_generated(self, event: Dict[str, Any]):
        """Handle document generated event."""
        document_id = event.get("document_id")
        quality_score = event.get("quality_score", 0.0)
        logger.info(
            f"Document {document_id} generated with quality score {quality_score}"
        )

    async def _on_workflow_progress_updated(self, event: Dict[str, Any]):
        """Handle workflow progress updated event."""
        workflow_id = event.get("workflow_instance_id")
        progress = event.get("completion_percentage", 0.0)
        logger.debug(f"Workflow {workflow_id} progress: {progress}%")

    # ========================================================================
    # Background Tasks
    # ========================================================================

    async def _performance_monitoring_loop(self):
        """Background task for performance monitoring."""
        while not self._shutdown_event.is_set():
            try:
                if self.config.enable_performance_monitoring:
                    await self._collect_performance_metrics()

                await asyncio.sleep(self.config.monitoring_interval_seconds)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in performance monitoring loop: {str(e)}")
                await asyncio.sleep(60)  # Wait before retrying

    async def _health_monitoring_loop(self):
        """Background task for system health monitoring."""
        while not self._shutdown_event.is_set():
            try:
                health_summary = await self._get_system_health_summary()

                # Check for any unhealthy components
                unhealthy_components = [
                    name
                    for name, status in health_summary.items()
                    if isinstance(status, dict) and status.get("status") != "healthy"
                ]

                if unhealthy_components:
                    logger.warning(
                        f"Unhealthy components detected: {unhealthy_components}"
                    )

                    # Emit health alert event
                    await self._notify_event_subscribers(
                        {
                            "event_type": "system_health_alert",
                            "unhealthy_components": unhealthy_components,
                            "timestamp": datetime.now().isoformat(),
                        }
                    )

                await asyncio.sleep(300)  # Check every 5 minutes

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in health monitoring loop: {str(e)}")
                await asyncio.sleep(60)

    async def _event_processing_loop(self):
        """Background task for event processing and notifications."""
        event_queue = []

        while not self._shutdown_event.is_set():
            try:
                # Process queued events in batches
                if len(event_queue) >= self.config.event_batch_size:
                    await self._process_event_batch(
                        event_queue[: self.config.event_batch_size]
                    )
                    event_queue = event_queue[self.config.event_batch_size :]

                await asyncio.sleep(self.config.event_flush_interval_seconds)

            except asyncio.CancelledError:
                # Process remaining events before shutdown
                if event_queue:
                    await self._process_event_batch(event_queue)
                break
            except Exception as e:
                logger.error(f"Error in event processing loop: {str(e)}")
                await asyncio.sleep(10)

    async def _cleanup_monitoring_loop(self):
        """Background task for cleanup and maintenance."""
        while not self._shutdown_event.is_set():
            try:
                # Clean up old performance metrics
                await self._cleanup_old_metrics()

                # Clean up workflow data if retention period exceeded
                if self.config.workflow_data_retention_days > 0:
                    await self._cleanup_old_workflow_data()

                # Clean up caches if enabled
                if self.config.enable_workflow_caching:
                    await self._cleanup_caches()

                await asyncio.sleep(3600)  # Run every hour

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup monitoring loop: {str(e)}")
                await asyncio.sleep(300)

    # ========================================================================
    # Helper Methods
    # ========================================================================

    async def _collect_performance_metrics(self):
        """Collect performance metrics from all components."""
        try:
            current_time = datetime.now().isoformat()

            # Collect workflow engine metrics
            if self.workflow_engine:
                engine_metrics = (
                    await self.workflow_engine.get_workflow_engine_metrics()
                )
                self.performance_metrics[f"workflow_engine_{current_time}"] = (
                    engine_metrics
                )

            # Collect task scheduler metrics
            if self.task_scheduler:
                scheduler_metrics = (
                    await self.task_scheduler.get_task_scheduler_metrics()
                )
                self.performance_metrics[f"task_scheduler_{current_time}"] = (
                    scheduler_metrics
                )

            # Collect task coordinator metrics
            if self.task_coordinator:
                coordinator_metrics = (
                    await self.task_coordinator.get_task_coordinator_metrics()
                )
                self.performance_metrics[f"task_coordinator_{current_time}"] = (
                    coordinator_metrics
                )

            # Collect deadline manager metrics
            if self.deadline_manager:
                deadline_metrics = (
                    await self.deadline_manager.get_deadline_manager_metrics()
                )
                self.performance_metrics[f"deadline_manager_{current_time}"] = (
                    deadline_metrics
                )

            # Collect workflow monitor metrics
            if self.workflow_monitor:
                monitor_metrics = (
                    await self.workflow_monitor.get_workflow_monitor_metrics()
                )
                self.performance_metrics[f"workflow_monitor_{current_time}"] = (
                    monitor_metrics
                )

        except Exception as e:
            logger.error(f"Failed to collect performance metrics: {str(e)}")

    async def _get_system_health_summary(self) -> Dict[str, Any]:
        """Get summary of system health across all components."""
        health_summary = {
            "overall_status": "healthy",
            "component_count": 0,
            "healthy_components": 0,
            "timestamp": datetime.now().isoformat(),
        }

        # Check each component
        components = [
            ("workflow_engine", self.workflow_engine),
            ("task_scheduler", self.task_scheduler),
            ("task_coordinator", self.task_coordinator),
            ("deadline_manager", self.deadline_manager),
            ("workflow_monitor", self.workflow_monitor),
            ("document_bridge", self.document_bridge),
            ("storage_integration", self.storage_integration),
        ]

        for name, component in components:
            if component:
                health_summary["component_count"] += 1
                try:
                    if hasattr(component, "health_check"):
                        health = await component.health_check()
                        health_summary[name] = health
                        if health.get("status") == "healthy":
                            health_summary["healthy_components"] += 1
                    else:
                        health_summary[name] = {
                            "status": "healthy",
                            "note": "No health check available",
                        }
                        health_summary["healthy_components"] += 1
                except Exception as e:
                    health_summary[name] = {"status": "unhealthy", "error": str(e)}

        # Determine overall status
        if health_summary["healthy_components"] < health_summary["component_count"]:
            health_summary["overall_status"] = "degraded"

        if health_summary["healthy_components"] == 0:
            health_summary["overall_status"] = "unhealthy"

        return health_summary

    async def _generate_predictive_analytics(
        self, current_analytics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate predictive analytics based on current data."""
        predictions = {
            "workflow_load_forecast": {},
            "resource_utilization_forecast": {},
            "performance_trends": {},
            "optimization_opportunities": [],
        }

        try:
            # Simple trend analysis (would use ML models in production)
            workflow_metrics = current_analytics.get("workflow_metrics", {})

            # Predict workflow load
            if "active_workflows" in workflow_metrics:
                current_load = workflow_metrics["active_workflows"]
                # Simple linear trend (would use sophisticated forecasting)
                predictions["workflow_load_forecast"] = {
                    "next_hour": current_load * 1.1,
                    "next_day": current_load * 1.2,
                    "next_week": current_load * 1.15,
                }

            # Identify optimization opportunities
            performance_metrics = current_analytics.get("performance_metrics", {})
            if performance_metrics:
                # Look for patterns indicating optimization opportunities
                predictions["optimization_opportunities"] = [
                    "Consider increasing parallel processing capacity",
                    "Review task assignment algorithms for better load balancing",
                    "Optimize document generation pipeline for faster processing",
                ]

        except Exception as e:
            logger.warning(f"Failed to generate predictive analytics: {str(e)}")
            predictions["error"] = str(e)

        return predictions

    async def _notify_event_subscribers(self, event: Dict[str, Any]):
        """Notify all event subscribers of an event."""
        for subscription_id, callback in self.event_subscribers:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event)
                else:
                    callback(event)
            except Exception as e:
                logger.warning(f"Event subscriber {subscription_id} failed: {str(e)}")

    async def _process_event_batch(self, events: List[Dict[str, Any]]):
        """Process a batch of events."""
        try:
            for event in events:
                await self._notify_event_subscribers(event)
        except Exception as e:
            logger.error(f"Failed to process event batch: {str(e)}")

    async def _log_workflow_events(self, event: Dict[str, Any]):
        """Log workflow events for debugging and monitoring."""
        if self.config.enable_event_logging:
            logger.info(f"Workflow Event: {event.get('event_type')} - {event}")

    async def _track_performance_events(self, event: Dict[str, Any]):
        """Track performance-related events."""
        event_type = event.get("event_type")
        if event_type in ["workflow_completed", "task_completed", "document_generated"]:
            # Track timing and performance metrics
            timestamp = event.get("timestamp", datetime.now().isoformat())
            self.performance_metrics[f"event_{event_type}_{timestamp}"] = event

    def _extract_content_from_result(self, generation_result) -> str:
        """Extract content from document generation result."""
        if hasattr(generation_result, "formatted_content"):
            content = generation_result.formatted_content
            if isinstance(content, dict):
                return content.get("html", content.get("text", str(content)))
            return str(content)
        return "Generated document content"

    async def _cleanup_old_metrics(self):
        """Clean up old performance metrics."""
        try:
            cutoff_time = datetime.now() - timedelta(hours=24)
            keys_to_remove = []

            for key in self.performance_metrics:
                if "time" in key or "_duration" in key:
                    try:
                        # Extract timestamp from key and check if it's old
                        # This is a simplified cleanup - would be more sophisticated in production
                        if len(keys_to_remove) < 100:  # Limit cleanup per cycle
                            keys_to_remove.append(key)
                    except:
                        continue

            for key in keys_to_remove[:50]:  # Remove up to 50 old entries per cleanup
                del self.performance_metrics[key]

        except Exception as e:
            logger.warning(f"Failed to cleanup old metrics: {str(e)}")

    async def _cleanup_old_workflow_data(self):
        """Clean up old workflow data based on retention policy."""
        try:
            cutoff_date = datetime.now() - timedelta(
                days=self.config.workflow_data_retention_days
            )

            # Clean up workflow engine data
            if self.workflow_engine and hasattr(
                self.workflow_engine, "cleanup_old_workflows"
            ):
                await self.workflow_engine.cleanup_old_workflows(cutoff_date)

            # Clean up storage integration data
            if self.storage_integration and hasattr(
                self.storage_integration, "cleanup_old_data"
            ):
                await self.storage_integration.cleanup_old_data(cutoff_date)

        except Exception as e:
            logger.warning(f"Failed to cleanup old workflow data: {str(e)}")

    async def _cleanup_caches(self):
        """Clean up various caches if they get too large."""
        try:
            if self.storage_integration and hasattr(
                self.storage_integration, "cached_recommendations"
            ):
                cache = self.storage_integration.cached_recommendations
                if len(cache) > self.config.cache_size_limit:
                    # Remove oldest 20% of cache entries
                    items_to_remove = len(cache) // 5
                    keys_to_remove = list(cache.keys())[:items_to_remove]
                    for key in keys_to_remove:
                        del cache[key]
                    logger.info(f"Cleaned up {items_to_remove} cache entries")

        except Exception as e:
            logger.warning(f"Failed to cleanup caches: {str(e)}")

    async def _cleanup_partial_initialization(self):
        """Clean up partial initialization in case of failure."""
        try:
            logger.info("Cleaning up partial initialization...")

            # Stop any started background tasks
            for task in self.background_tasks:
                if not task.done():
                    task.cancel()

            # Clear any initialized components
            components = [
                self.workflow_engine,
                self.task_scheduler,
                self.task_coordinator,
                self.deadline_manager,
                self.workflow_monitor,
                self.document_bridge,
                self.storage_integration,
            ]

            for component in components:
                if component and hasattr(component, "cleanup"):
                    try:
                        await component.cleanup()
                    except Exception as e:
                        logger.warning(f"Failed to cleanup component: {str(e)}")

            # Reset state
            self.is_initialized = False
            self.background_tasks.clear()
            self.event_subscribers.clear()
            self.performance_metrics.clear()

        except Exception as e:
            logger.error(f"Failed to cleanup partial initialization: {str(e)}")

    # ========================================================================
    # Lifecycle Management
    # ========================================================================

    async def shutdown(self):
        """Shutdown the workflow integration layer gracefully."""
        if not self.is_initialized:
            logger.warning(
                "WorkflowIntegrationLayer not initialized, skipping shutdown"
            )
            return

        try:
            logger.info("Shutting down WorkflowIntegrationLayer...")

            # Signal shutdown to background tasks
            self._shutdown_event.set()

            # Cancel and wait for background tasks
            if self.background_tasks:
                for task in self.background_tasks:
                    if not task.done():
                        task.cancel()

                await asyncio.gather(*self.background_tasks, return_exceptions=True)
                self.background_tasks.clear()

            # Shutdown integration components
            if self.document_bridge:
                await self.document_bridge.stop()

            if self.storage_integration:
                await self.storage_integration.cleanup()

            # Shutdown core components
            components = [
                self.workflow_monitor,
                self.deadline_manager,
                self.task_coordinator,
                self.task_scheduler,
                self.workflow_engine,
            ]

            for component in components:
                if component and hasattr(component, "shutdown"):
                    try:
                        await component.shutdown()
                    except Exception as e:
                        logger.warning(f"Error shutting down component: {str(e)}")

            # Clear state
            self.is_initialized = False
            self.event_subscribers.clear()
            self.performance_metrics.clear()

            logger.info("WorkflowIntegrationLayer shutdown complete")

        except Exception as e:
            logger.error(f"Error during shutdown: {str(e)}")


# ============================================================================
# Factory Functions
# ============================================================================


async def create_workflow_integration_layer(
    document_engine: DocumentEngine,
    storage_service: StorageService,
    config: Optional[WorkflowIntegrationConfiguration] = None,
) -> WorkflowIntegrationLayer:
    """
    Factory function to create and initialize a complete WorkflowIntegrationLayer.

    Args:
            document_engine: Document generation engine
            storage_service: Document storage service
            config: Optional configuration (uses defaults if not provided)

    Returns:
            Fully initialized WorkflowIntegrationLayer
    """
    integration_layer = WorkflowIntegrationLayer(
        document_engine=document_engine, storage_service=storage_service, config=config
    )

    success = await integration_layer.initialize()
    if not success:
        raise RuntimeError("Failed to initialize WorkflowIntegrationLayer")

    return integration_layer


async def create_development_workflow_integration(
    document_engine: DocumentEngine, storage_service: StorageService
) -> WorkflowIntegrationLayer:
    """
    Create a workflow integration layer optimized for development.

    Args:
            document_engine: Document generation engine
            storage_service: Document storage service

    Returns:
            Development-optimized WorkflowIntegrationLayer
    """
    config = WorkflowIntegrationConfiguration(
        integration_mode=IntegrationMode.DEVELOPMENT,
        enable_background_tasks=True,
        enable_event_logging=True,
        enable_performance_monitoring=True,
        max_concurrent_workflows=10,
        monitoring_interval_seconds=60,
        workflow_data_retention_days=7,
    )

    return await create_workflow_integration_layer(
        document_engine=document_engine, storage_service=storage_service, config=config
    )


async def create_production_workflow_integration(
    document_engine: DocumentEngine, storage_service: StorageService
) -> WorkflowIntegrationLayer:
    """
    Create a workflow integration layer optimized for production.

    Args:
            document_engine: Document generation engine
            storage_service: Document storage service

    Returns:
            Production-optimized WorkflowIntegrationLayer
    """
    config = WorkflowIntegrationConfiguration(
        integration_mode=IntegrationMode.PRODUCTION,
        enable_background_tasks=True,
        enable_event_logging=False,  # Reduce log volume in production
        enable_performance_monitoring=True,
        max_concurrent_workflows=500,
        monitoring_interval_seconds=30,
        workflow_data_retention_days=90,
        cache_size_limit=5000,
    )

    return await create_workflow_integration_layer(
        document_engine=document_engine, storage_service=storage_service, config=config
    )
