#!/usr/bin/env python3
"""
Workflow Document Bridge

Primary integration bridge connecting the Week 19 workflow automation system
with the existing document creation processes. This bridge provides seamless
integration between DocumentEngine operations and workflow management.

Key Features:
- Document creation workflow orchestration
- Task-based document generation phases
- Real-time progress tracking and monitoring
- Automated task assignment and coordination
- Deadline management for document projects
- Quality assurance workflow integration
- Event-driven workflow triggers
"""

import asyncio
import logging
from dataclasses import dataclass, field
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

# Import document engine components
from ...document_engine.document_engine import (
    DocumentEngine,
    DocumentGenerationConfiguration,
    DocumentGenerationRequest,
    DocumentGenerationResult,
    GenerationPhase,
)
from ..automation.task_scheduler import (
    ScheduledTask,
    SchedulingStrategy,
    TaskPriority,
    TaskScheduler,
    TaskState,
)

# Import workflow components
from ..automation.workflow_engine import (
    ProcessState,
    TriggerType,
    WorkflowEngine,
    WorkflowEvent,
    WorkflowInstance,
    WorkflowTrigger,
)
from ..coordination.deadline_manager import (
    AlertLevel,
    CriticalPath,
    DeadlineAlert,
    DeadlineManager,
)
from ..coordination.task_coordinator import (
    AssignmentStrategy,
    CollaborationType,
    TaskAssignment,
    TaskComplexity,
    TaskCoordinator,
)
from ..monitoring.workflow_monitor import (
    MonitoringAlert,
    PerformanceMetrics,
    WorkflowMonitor,
)

logger = logging.getLogger(__name__)


# ============================================================================
# Configuration Models
# ============================================================================


class DocumentWorkflowMode(Enum):
    """Modes for document workflow integration"""

    AUTOMATIC = "automatic"  # Full workflow automation
    ASSISTED = "assisted"  # Human-assisted workflow
    MANUAL = "manual"  # Manual workflow coordination
    REVIEW_ONLY = "review_only"  # Review and approval only


class WorkflowPhaseMapping(BaseModel):
    """Maps document generation phases to workflow tasks"""

    model_config = ConfigDict(extra="forbid")

    phase: GenerationPhase
    task_name: str
    estimated_duration_minutes: float
    required_skills: Dict[str, float] = Field(default_factory=dict)
    complexity: TaskComplexity = TaskComplexity.MEDIUM
    collaboration_type: CollaborationType = CollaborationType.INDIVIDUAL
    can_be_automated: bool = True
    requires_human_review: bool = False


class WorkflowDocumentConfiguration(BaseModel):
    """Configuration for workflow-enabled document creation"""

    model_config = ConfigDict(extra="forbid")

    # Workflow settings
    workflow_mode: DocumentWorkflowMode = DocumentWorkflowMode.AUTOMATIC
    enable_task_scheduling: bool = True
    enable_deadline_management: bool = True
    enable_progress_monitoring: bool = True

    # Task assignment
    assignment_strategy: AssignmentStrategy = AssignmentStrategy.SKILL_BASED
    enable_workload_balancing: bool = True
    max_concurrent_tasks_per_user: int = 3

    # Scheduling preferences
    scheduling_strategy: SchedulingStrategy = SchedulingStrategy.BALANCED
    priority_level: TaskPriority = TaskPriority.MEDIUM

    # Timeline settings
    enable_automatic_deadlines: bool = True
    default_deadline_buffer_hours: float = 24.0
    critical_path_monitoring: bool = True

    # Quality assurance
    enable_quality_checkpoints: bool = True
    require_peer_review: bool = False
    require_manager_approval: bool = False

    # Phase mappings
    phase_mappings: List[WorkflowPhaseMapping] = Field(default_factory=list)

    # Event handling
    enable_event_notifications: bool = True
    notification_channels: List[str] = Field(
        default_factory=lambda: ["email", "workflow"]
    )


# ============================================================================
# Event Models
# ============================================================================


class DocumentWorkflowEvent(BaseModel):
    """Event model for document workflow integration"""

    model_config = ConfigDict(extra="forbid")

    event_id: str = Field(default_factory=uuid7str)
    event_type: str
    document_id: str
    workflow_instance_id: str
    user_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    data: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class WorkflowProgress(BaseModel):
    """Progress tracking for workflow-enabled documents"""

    model_config = ConfigDict(extra="forbid")

    workflow_instance_id: str
    document_id: str
    current_phase: GenerationPhase
    completed_phases: List[GenerationPhase] = Field(default_factory=list)
    active_tasks: List[str] = Field(default_factory=list)
    completion_percentage: float = 0.0
    estimated_completion_time: Optional[datetime] = None
    quality_score: Optional[float] = None
    processing_metrics: Dict[str, Any] = Field(default_factory=dict)


# ============================================================================
# Main Bridge Class
# ============================================================================


class WorkflowDocumentBridge:
    """
    Primary bridge connecting workflow automation with document creation.

    This bridge orchestrates the integration between the workflow system and
    document engine, providing seamless task management, progress tracking,
    and automated coordination for document creation processes.
    """

    def __init__(
        self,
        workflow_engine: WorkflowEngine,
        task_scheduler: TaskScheduler,
        task_coordinator: TaskCoordinator,
        deadline_manager: DeadlineManager,
        workflow_monitor: WorkflowMonitor,
        document_engine: DocumentEngine,
        config: WorkflowDocumentConfiguration,
    ):
        self.workflow_engine = workflow_engine
        self.task_scheduler = task_scheduler
        self.task_coordinator = task_coordinator
        self.deadline_manager = deadline_manager
        self.workflow_monitor = workflow_monitor
        self.document_engine = document_engine
        self.config = config

        # State tracking
        self.active_document_workflows: Dict[str, WorkflowInstance] = {}
        self.document_progress: Dict[str, WorkflowProgress] = {}
        self.event_subscribers: List[Callable[[DocumentWorkflowEvent], None]] = []

        # Default phase mappings if not configured
        if not config.phase_mappings:
            self._setup_default_phase_mappings()

        # Background tasks
        self._background_tasks: List[asyncio.Task] = []
        self._shutdown_event = asyncio.Event()
        self._lock = asyncio.Lock()

        # Event handlers
        self._setup_event_handlers()

    # ========================================================================
    # Core Bridge Operations
    # ========================================================================

    async def create_document_workflow(
        self,
        document_request: DocumentGenerationRequest,
        assigned_users: Optional[List[str]] = None,
        deadline: Optional[datetime] = None,
    ) -> WorkflowInstance:
        """
        Create a new workflow instance for document generation.

        Args:
                document_request: The original document generation request
                assigned_users: Optional list of users to assign tasks to
                deadline: Optional project deadline

        Returns:
                Created workflow instance
        """
        async with self._lock:
            try:
                # Create workflow context
                workflow_context = {
                    "document_request_id": document_request.request_id,
                    "document_type": document_request.generation_config.document_type.value,
                    "requester_id": document_request.requester_id,
                    "target_word_count": getattr(
                        document_request.generation_config, "target_word_count", 3000
                    ),
                    "complexity_level": getattr(
                        document_request, "complexity_level", "medium"
                    ),
                    "assigned_users": assigned_users or [document_request.requester_id],
                    "workflow_mode": self.config.workflow_mode.value,
                }

                # Create workflow instance
                workflow_instance = await self.workflow_engine.create_workflow_instance(
                    process_definition_id="document_generation_workflow",
                    context=workflow_context,
                )

                # Set up deadline management if enabled
                if self.config.enable_deadline_management and deadline:
                    await self.deadline_manager.set_workflow_deadline(
                        workflow_instance.instance_id,
                        deadline,
                        buffer_hours=self.config.default_deadline_buffer_hours,
                    )
                elif self.config.enable_automatic_deadlines:
                    # Calculate automatic deadline based on complexity
                    estimated_hours = self._estimate_completion_time(document_request)
                    auto_deadline = datetime.now() + timedelta(hours=estimated_hours)
                    await self.deadline_manager.set_workflow_deadline(
                        workflow_instance.instance_id,
                        auto_deadline,
                        buffer_hours=self.config.default_deadline_buffer_hours,
                    )

                # Create workflow tasks for each generation phase
                await self._create_workflow_tasks(
                    workflow_instance, document_request, assigned_users
                )

                # Initialize progress tracking
                progress = WorkflowProgress(
                    workflow_instance_id=workflow_instance.instance_id,
                    document_id=document_request.request_id,
                    current_phase=GenerationPhase.CONTENT_ASSEMBLY,
                    estimated_completion_time=deadline,
                )
                self.document_progress[document_request.request_id] = progress

                # Track active workflow
                self.active_document_workflows[document_request.request_id] = (
                    workflow_instance
                )

                # Start workflow monitoring
                if self.config.enable_progress_monitoring:
                    await self.workflow_monitor.register_workflow_start(
                        workflow_instance.instance_id,
                        "document_generation_workflow",
                        expected_duration_minutes=estimated_hours * 60,
                    )

                # Emit workflow created event
                await self._emit_workflow_event(
                    "workflow_created",
                    document_request.request_id,
                    workflow_instance.instance_id,
                    document_request.requester_id,
                    {"estimated_completion_time": estimated_hours},
                )

                logger.info(
                    f"Created document workflow {workflow_instance.instance_id} for document {document_request.request_id}"
                )
                return workflow_instance

            except Exception as e:
                logger.error(f"Failed to create document workflow: {str(e)}")
                raise

    async def execute_document_workflow(
        self, workflow_instance_id: str, document_request: DocumentGenerationRequest
    ) -> DocumentGenerationResult:
        """
        Execute the complete document generation workflow.

        Args:
                workflow_instance_id: ID of the workflow instance
                document_request: The document generation request

        Returns:
                Document generation result with workflow metadata
        """
        try:
            # Start the workflow
            await self.workflow_engine.start_workflow_instance(workflow_instance_id)

            # Execute document generation with workflow coordination
            if self.config.workflow_mode == DocumentWorkflowMode.AUTOMATIC:
                result = await self._execute_automated_workflow(
                    workflow_instance_id, document_request
                )
            elif self.config.workflow_mode == DocumentWorkflowMode.ASSISTED:
                result = await self._execute_assisted_workflow(
                    workflow_instance_id, document_request
                )
            else:
                result = await self._execute_manual_workflow(
                    workflow_instance_id, document_request
                )

            # Update workflow completion
            await self.workflow_engine.complete_workflow_instance(workflow_instance_id)

            # Record completion metrics
            if self.config.enable_progress_monitoring:
                await self.workflow_monitor.register_workflow_completion(
                    workflow_instance_id,
                    result.processing_time,
                    result.overall_quality_score,
                )

            # Update progress tracking
            if document_request.request_id in self.document_progress:
                progress = self.document_progress[document_request.request_id]
                progress.completion_percentage = 100.0
                progress.quality_score = result.overall_quality_score
                progress.processing_metrics = result.component_processing_times

            # Emit completion event
            await self._emit_workflow_event(
                "workflow_completed",
                document_request.request_id,
                workflow_instance_id,
                document_request.requester_id,
                {
                    "processing_time": result.processing_time,
                    "quality_score": result.overall_quality_score,
                    "output_formats": list(result.rendered_outputs.keys()),
                },
            )

            logger.info(f"Completed document workflow {workflow_instance_id}")
            return result

        except Exception as e:
            logger.error(
                f"Failed to execute document workflow {workflow_instance_id}: {str(e)}"
            )

            # Mark workflow as failed
            await self.workflow_engine.fail_workflow_instance(
                workflow_instance_id, error_message=str(e)
            )

            # Emit failure event
            await self._emit_workflow_event(
                "workflow_failed",
                document_request.request_id,
                workflow_instance_id,
                document_request.requester_id,
                {"error": str(e)},
            )

            raise

    async def get_workflow_progress(
        self, document_id: str
    ) -> Optional[WorkflowProgress]:
        """Get current progress for a document workflow"""
        return self.document_progress.get(document_id)

    async def update_task_progress(
        self,
        workflow_instance_id: str,
        task_id: str,
        completion_percentage: float,
        status_message: Optional[str] = None,
    ):
        """Update progress for a specific workflow task"""
        async with self._lock:
            try:
                # Update task in scheduler
                await self.task_scheduler.update_task_progress(
                    task_id, completion_percentage, status_message
                )

                # Update overall workflow progress
                await self._update_workflow_progress(workflow_instance_id)

                # Emit progress event
                document_id = await self._get_document_id_for_workflow(
                    workflow_instance_id
                )
                if document_id:
                    await self._emit_workflow_event(
                        "task_progress_updated",
                        document_id,
                        workflow_instance_id,
                        None,
                        {
                            "task_id": task_id,
                            "completion_percentage": completion_percentage,
                            "status_message": status_message,
                        },
                    )

            except Exception as e:
                logger.error(f"Failed to update task progress: {str(e)}")
                raise

    # ========================================================================
    # Event Handling
    # ========================================================================

    async def subscribe_to_workflow_events(
        self, callback: Callable[[DocumentWorkflowEvent], None]
    ):
        """Subscribe to document workflow events"""
        self.event_subscribers.append(callback)

    async def _emit_workflow_event(
        self,
        event_type: str,
        document_id: str,
        workflow_instance_id: str,
        user_id: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ):
        """Emit a workflow event to all subscribers"""
        if not self.config.enable_event_notifications:
            return

        event = DocumentWorkflowEvent(
            event_type=event_type,
            document_id=document_id,
            workflow_instance_id=workflow_instance_id,
            user_id=user_id,
            data=data or {},
        )

        # Notify all subscribers
        for callback in self.event_subscribers:
            try:
                await callback(event)
            except Exception as e:
                logger.warning(f"Event subscriber failed: {str(e)}")

    # ========================================================================
    # Workflow Execution Modes
    # ========================================================================

    async def _execute_automated_workflow(
        self, workflow_instance_id: str, document_request: DocumentGenerationRequest
    ) -> DocumentGenerationResult:
        """Execute fully automated document workflow"""
        logger.info(f"Executing automated workflow {workflow_instance_id}")

        # Execute document generation with progress tracking
        original_generate = self.document_engine.generate_document

        async def progress_tracking_wrapper(request):
            # Track phase progress
            result = await original_generate(request)

            # Update progress after completion
            await self._update_workflow_progress(workflow_instance_id)

            return result

        # Execute with progress tracking
        self.document_engine.generate_document = progress_tracking_wrapper
        try:
            result = await self.document_engine.generate_document(document_request)
        finally:
            self.document_engine.generate_document = original_generate

        return result

    async def _execute_assisted_workflow(
        self, workflow_instance_id: str, document_request: DocumentGenerationRequest
    ) -> DocumentGenerationResult:
        """Execute human-assisted document workflow"""
        logger.info(f"Executing assisted workflow {workflow_instance_id}")

        # Create tasks for human review points
        review_tasks = []

        if self.config.require_peer_review:
            review_task = ScheduledTask(
                task_id=uuid7str(),
                workflow_instance_id=workflow_instance_id,
                name="peer_review",
                description="Peer review of generated document",
                priority=TaskPriority.HIGH,
                estimated_duration_minutes=30.0,
            )
            review_tasks.append(review_task)

        if self.config.require_manager_approval:
            approval_task = ScheduledTask(
                task_id=uuid7str(),
                workflow_instance_id=workflow_instance_id,
                name="manager_approval",
                description="Manager approval of final document",
                priority=TaskPriority.HIGH,
                estimated_duration_minutes=15.0,
            )
            review_tasks.append(approval_task)

        # Submit review tasks
        for task in review_tasks:
            await self.task_scheduler.submit_task(task)

        # Execute document generation
        result = await self.document_engine.generate_document(document_request)

        # Wait for review/approval tasks if any
        for task in review_tasks:
            await self.task_scheduler.wait_for_task_completion(task.task_id)

        return result

    async def _execute_manual_workflow(
        self, workflow_instance_id: str, document_request: DocumentGenerationRequest
    ) -> DocumentGenerationResult:
        """Execute manual coordination workflow"""
        logger.info(f"Executing manual workflow {workflow_instance_id}")

        # In manual mode, we create tasks but don't auto-execute
        # This allows human coordinators to manage the process

        # Create manual coordination tasks
        coordination_tasks = [
            ScheduledTask(
                task_id=uuid7str(),
                workflow_instance_id=workflow_instance_id,
                name="coordinate_content_assembly",
                description="Coordinate content assembly phase",
                priority=TaskPriority.MEDIUM,
                estimated_duration_minutes=60.0,
            ),
            ScheduledTask(
                task_id=uuid7str(),
                workflow_instance_id=workflow_instance_id,
                name="coordinate_formatting",
                description="Coordinate document formatting phase",
                priority=TaskPriority.MEDIUM,
                estimated_duration_minutes=45.0,
            ),
            ScheduledTask(
                task_id=uuid7str(),
                workflow_instance_id=workflow_instance_id,
                name="coordinate_quality_review",
                description="Coordinate final quality review",
                priority=TaskPriority.HIGH,
                estimated_duration_minutes=30.0,
            ),
        ]

        # Submit coordination tasks
        for task in coordination_tasks:
            await self.task_scheduler.submit_task(task)

        # Execute document generation (coordinators trigger phases manually)
        result = await self.document_engine.generate_document(document_request)

        return result

    # ========================================================================
    # Task Management
    # ========================================================================

    async def _create_workflow_tasks(
        self,
        workflow_instance: WorkflowInstance,
        document_request: DocumentGenerationRequest,
        assigned_users: Optional[List[str]] = None,
    ):
        """Create workflow tasks for each generation phase"""
        try:
            phase_mappings = self.config.phase_mappings
            if not phase_mappings:
                phase_mappings = self._get_default_phase_mappings()

            created_tasks = []

            for phase_mapping in phase_mappings:
                # Create scheduled task
                task = ScheduledTask(
                    task_id=uuid7str(),
                    workflow_instance_id=workflow_instance.instance_id,
                    name=phase_mapping.task_name,
                    description=f"Execute {phase_mapping.phase.value} phase for document generation",
                    priority=self.config.priority_level,
                    estimated_duration_minutes=phase_mapping.estimated_duration_minutes,
                    required_skills=phase_mapping.required_skills,
                    complexity=phase_mapping.complexity,
                    collaboration_type=phase_mapping.collaboration_type,
                    metadata={
                        "generation_phase": phase_mapping.phase.value,
                        "document_request_id": document_request.request_id,
                        "can_be_automated": phase_mapping.can_be_automated,
                        "requires_human_review": phase_mapping.requires_human_review,
                    },
                )

                # Submit to scheduler
                success = await self.task_scheduler.submit_task(task)
                if success:
                    created_tasks.append(task)

                    # Assign to users if specified
                    if assigned_users and self.config.enable_task_scheduling:
                        await self._assign_task_to_users(task, assigned_users)
                else:
                    logger.warning(f"Failed to submit task {phase_mapping.task_name}")

            logger.info(
                f"Created {len(created_tasks)} workflow tasks for {workflow_instance.instance_id}"
            )

        except Exception as e:
            logger.error(f"Failed to create workflow tasks: {str(e)}")
            raise

    async def _assign_task_to_users(self, task: ScheduledTask, user_ids: List[str]):
        """Assign a task to specific users using the task coordinator"""
        try:
            assignment = await self.task_coordinator.assign_task(
                task_id=task.task_id,
                workflow_instance_id=task.workflow_instance_id,
                required_skills=task.required_skills,
                estimated_effort_hours=task.estimated_duration_minutes / 60.0,
                complexity_level=task.complexity,
                collaboration_type=task.collaboration_type,
            )

            if assignment:
                logger.info(
                    f"Assigned task {task.task_id} to user {assignment.assigned_user_id}"
                )
            else:
                logger.warning(f"Failed to assign task {task.task_id}")

        except Exception as e:
            logger.error(f"Failed to assign task {task.task_id}: {str(e)}")

    # ========================================================================
    # Progress Tracking
    # ========================================================================

    async def _update_workflow_progress(self, workflow_instance_id: str):
        """Update progress tracking for a workflow"""
        try:
            # Get workflow instance
            workflow_instance = await self.workflow_engine.get_workflow_instance(
                workflow_instance_id
            )
            if not workflow_instance:
                return

            # Find document progress
            document_id = None
            for doc_id, progress in self.document_progress.items():
                if progress.workflow_instance_id == workflow_instance_id:
                    document_id = doc_id
                    break

            if not document_id:
                return

            progress = self.document_progress[document_id]

            # Get all tasks for this workflow
            workflow_tasks = await self.task_scheduler.get_tasks_for_workflow(
                workflow_instance_id
            )

            # Calculate completion percentage
            if workflow_tasks:
                total_tasks = len(workflow_tasks)
                completed_tasks = sum(
                    1 for task in workflow_tasks if task.state == TaskState.COMPLETED
                )
                progress.completion_percentage = (completed_tasks / total_tasks) * 100.0

                # Update active tasks
                progress.active_tasks = [
                    task.task_id
                    for task in workflow_tasks
                    if task.state in [TaskState.RUNNING, TaskState.QUEUED]
                ]

                # Update current phase based on active tasks
                for task in workflow_tasks:
                    if (
                        task.state == TaskState.RUNNING
                        and "generation_phase" in task.metadata
                    ):
                        phase_str = task.metadata["generation_phase"]
                        try:
                            progress.current_phase = GenerationPhase(phase_str)
                        except ValueError:
                            pass

            # Update estimated completion time
            if progress.completion_percentage < 100.0:
                remaining_tasks = [
                    t for t in workflow_tasks if t.state != TaskState.COMPLETED
                ]
                if remaining_tasks:
                    remaining_minutes = sum(
                        t.estimated_duration_minutes for t in remaining_tasks
                    )
                    progress.estimated_completion_time = datetime.now() + timedelta(
                        minutes=remaining_minutes
                    )

        except Exception as e:
            logger.error(f"Failed to update workflow progress: {str(e)}")

    # ========================================================================
    # Helper Methods
    # ========================================================================

    def _setup_default_phase_mappings(self):
        """Set up default phase mappings if none provided"""
        default_mappings = [
            WorkflowPhaseMapping(
                phase=GenerationPhase.CONTENT_ASSEMBLY,
                task_name="content_assembly",
                estimated_duration_minutes=45.0,
                required_skills={"content_writing": 0.7, "research": 0.5},
                complexity=TaskComplexity.MEDIUM,
                can_be_automated=True,
            ),
            WorkflowPhaseMapping(
                phase=GenerationPhase.STRUCTURE_BUILDING,
                task_name="structure_building",
                estimated_duration_minutes=30.0,
                required_skills={"document_structure": 0.8, "organization": 0.6},
                complexity=TaskComplexity.MEDIUM,
                can_be_automated=True,
            ),
            WorkflowPhaseMapping(
                phase=GenerationPhase.FORMATTING,
                task_name="document_formatting",
                estimated_duration_minutes=25.0,
                required_skills={"formatting": 0.7, "design": 0.4},
                complexity=TaskComplexity.LOW,
                can_be_automated=True,
            ),
            WorkflowPhaseMapping(
                phase=GenerationPhase.RENDERING,
                task_name="document_rendering",
                estimated_duration_minutes=15.0,
                required_skills={"technical_skills": 0.6},
                complexity=TaskComplexity.LOW,
                can_be_automated=True,
            ),
            WorkflowPhaseMapping(
                phase=GenerationPhase.QUALITY_VALIDATION,
                task_name="quality_validation",
                estimated_duration_minutes=35.0,
                required_skills={"quality_assurance": 0.8, "attention_to_detail": 0.9},
                complexity=TaskComplexity.HIGH,
                can_be_automated=False,
                requires_human_review=True,
            ),
        ]

        self.config.phase_mappings = default_mappings

    def _get_default_phase_mappings(self) -> List[WorkflowPhaseMapping]:
        """Get default phase mappings"""
        if not self.config.phase_mappings:
            self._setup_default_phase_mappings()
        return self.config.phase_mappings

    def _estimate_completion_time(
        self, document_request: DocumentGenerationRequest
    ) -> float:
        """Estimate completion time in hours based on document complexity"""
        base_hours = 2.0  # Base time for simple document

        # Factor in document type complexity
        type_multipliers = {
            "technical_specification": 1.5,
            "business_proposal": 1.3,
            "research_report": 1.7,
            "user_manual": 1.4,
            "standard_document": 1.0,
        }

        doc_type = getattr(
            document_request.generation_config, "document_type", "standard_document"
        )
        if hasattr(doc_type, "value"):
            doc_type = doc_type.value

        multiplier = type_multipliers.get(str(doc_type).lower(), 1.0)

        # Factor in target word count
        target_words = getattr(
            document_request.generation_config, "target_word_count", 3000
        )
        word_factor = max(
            1.0, target_words / 3000.0
        )  # Scale based on 3000 words baseline

        # Factor in complexity level
        complexity_multipliers = {
            "simple": 0.7,
            "moderate": 1.0,
            "advanced": 1.4,
            "expert": 1.8,
        }

        complexity = getattr(document_request, "complexity_level", "moderate")
        complexity_factor = complexity_multipliers.get(str(complexity).lower(), 1.0)

        estimated_hours = base_hours * multiplier * word_factor * complexity_factor

        # Add buffer for workflow coordination overhead
        workflow_overhead = 0.3  # 30% overhead for coordination
        estimated_hours *= 1.0 + workflow_overhead

        return estimated_hours

    async def _get_document_id_for_workflow(
        self, workflow_instance_id: str
    ) -> Optional[str]:
        """Get document ID associated with a workflow instance"""
        for doc_id, progress in self.document_progress.items():
            if progress.workflow_instance_id == workflow_instance_id:
                return doc_id
        return None

    def _setup_event_handlers(self):
        """Set up event handlers for workflow components"""
        # These will be implemented as the workflow system matures
        pass

    # ========================================================================
    # Lifecycle Management
    # ========================================================================

    async def start(self):
        """Start the workflow document bridge"""
        try:
            logger.info("Starting WorkflowDocumentBridge")

            # Start workflow monitoring
            if self.config.enable_progress_monitoring:
                monitor_task = asyncio.create_task(self._monitor_workflow_progress())
                self._background_tasks.append(monitor_task)

            # Start deadline monitoring
            if self.config.enable_deadline_management:
                deadline_task = asyncio.create_task(self._monitor_deadlines())
                self._background_tasks.append(deadline_task)

            logger.info("WorkflowDocumentBridge started successfully")

        except Exception as e:
            logger.error(f"Failed to start WorkflowDocumentBridge: {str(e)}")
            raise

    async def stop(self):
        """Stop the workflow document bridge"""
        try:
            logger.info("Stopping WorkflowDocumentBridge")

            # Signal shutdown
            self._shutdown_event.set()

            # Cancel background tasks
            for task in self._background_tasks:
                if not task.done():
                    task.cancel()

            # Wait for tasks to complete
            if self._background_tasks:
                await asyncio.gather(*self._background_tasks, return_exceptions=True)

            logger.info("WorkflowDocumentBridge stopped")

        except Exception as e:
            logger.error(f"Error stopping WorkflowDocumentBridge: {str(e)}")

    async def _monitor_workflow_progress(self):
        """Background task to monitor workflow progress"""
        while not self._shutdown_event.is_set():
            try:
                # Update progress for all active workflows
                for doc_id in list(self.document_progress.keys()):
                    progress = self.document_progress[doc_id]
                    if progress.completion_percentage < 100.0:
                        await self._update_workflow_progress(
                            progress.workflow_instance_id
                        )

                # Sleep before next check
                await asyncio.sleep(30)  # Check every 30 seconds

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in workflow progress monitoring: {str(e)}")
                await asyncio.sleep(5)

    async def _monitor_deadlines(self):
        """Background task to monitor workflow deadlines"""
        while not self._shutdown_event.is_set():
            try:
                # Check deadlines for active workflows
                for doc_id, progress in self.document_progress.items():
                    if (
                        progress.completion_percentage < 100.0
                        and progress.estimated_completion_time
                        and progress.estimated_completion_time
                        < datetime.now() + timedelta(hours=2)
                    ):
                        # Emit deadline warning
                        await self._emit_workflow_event(
                            "deadline_warning",
                            doc_id,
                            progress.workflow_instance_id,
                            None,
                            {
                                "estimated_completion": progress.estimated_completion_time.isoformat(),
                                "hours_remaining": (
                                    progress.estimated_completion_time - datetime.now()
                                ).total_seconds()
                                / 3600,
                            },
                        )

                # Sleep before next check
                await asyncio.sleep(300)  # Check every 5 minutes

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in deadline monitoring: {str(e)}")
                await asyncio.sleep(60)


# ============================================================================
# Factory Functions
# ============================================================================


async def create_workflow_document_bridge(
    workflow_engine: WorkflowEngine,
    task_scheduler: TaskScheduler,
    task_coordinator: TaskCoordinator,
    deadline_manager: DeadlineManager,
    workflow_monitor: WorkflowMonitor,
    document_engine: DocumentEngine,
    config: Optional[WorkflowDocumentConfiguration] = None,
) -> WorkflowDocumentBridge:
    """
    Factory function to create and initialize a WorkflowDocumentBridge.

    Args:
            workflow_engine: Workflow automation engine
            task_scheduler: Task scheduling system
            task_coordinator: Task coordination system
            deadline_manager: Deadline management system
            workflow_monitor: Workflow monitoring system
            document_engine: Document generation engine
            config: Optional configuration (uses defaults if not provided)

    Returns:
            Initialized WorkflowDocumentBridge instance
    """
    if config is None:
        config = WorkflowDocumentConfiguration()

    bridge = WorkflowDocumentBridge(
        workflow_engine=workflow_engine,
        task_scheduler=task_scheduler,
        task_coordinator=task_coordinator,
        deadline_manager=deadline_manager,
        workflow_monitor=workflow_monitor,
        document_engine=document_engine,
        config=config,
    )

    await bridge.start()
    return bridge
