#!/usr/bin/env python3
"""
Workflow Request Extensions

Extensions to the existing DocumentGenerationRequest and related models to include
workflow automation configuration. This module provides backward-compatible
extensions that enable workflow integration without breaking existing code.

Key Features:
- Workflow-enabled document request models
- Backward compatibility with existing requests
- Flexible workflow configuration options
- Team assignment and collaboration settings
- Timeline and deadline management
- Quality assurance workflow configuration
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
from enum import Enum

try:
	from uuid_extensions import uuid7str
except ImportError:
	from uuid import uuid4
	def uuid7str() -> str:
		return str(uuid4())

from pydantic import BaseModel, Field, ConfigDict, validator

# Import existing document engine models
from ...document_engine.document_engine import (
	DocumentGenerationRequest, DocumentGenerationConfiguration,
	DocumentGenerationResult, GenerationPhase
)

# Import workflow models
from .workflow_document_bridge import (
	DocumentWorkflowMode, WorkflowDocumentConfiguration, WorkflowPhaseMapping
)
from ..automation.task_scheduler import TaskPriority, SchedulingStrategy
from ..coordination.task_coordinator import AssignmentStrategy, TaskComplexity, CollaborationType

logger = logging.getLogger(__name__)


# ============================================================================
# Configuration Models
# ============================================================================

class WorkflowIntegrationLevel(Enum):
	"""Levels of workflow integration"""
	NONE = "none"           # No workflow integration
	BASIC = "basic"         # Basic task tracking
	STANDARD = "standard"   # Full workflow with coordination
	ADVANCED = "advanced"   # Advanced workflow with AI optimization
	CUSTOM = "custom"       # Custom workflow configuration


class TeamRole(Enum):
	"""Roles for team members in workflow"""
	CREATOR = "creator"         # Document creator/requester
	WRITER = "writer"           # Content writer
	REVIEWER = "reviewer"       # Content reviewer
	EDITOR = "editor"           # Document editor
	APPROVER = "approver"       # Final approver
	COORDINATOR = "coordinator" # Workflow coordinator
	SUBJECT_MATTER_EXPERT = "subject_matter_expert"  # SME for technical content


class WorkflowConfiguration(BaseModel):
	"""Comprehensive workflow configuration for document requests"""
	model_config = ConfigDict(extra='forbid')
	
	# Integration settings
	integration_level: WorkflowIntegrationLevel = WorkflowIntegrationLevel.STANDARD
	workflow_mode: DocumentWorkflowMode = DocumentWorkflowMode.AUTOMATIC
	
	# Timeline settings
	enable_deadline_management: bool = True
	project_deadline: Optional[datetime] = None
	deadline_buffer_hours: float = 24.0
	enable_automatic_scheduling: bool = True
	
	# Team settings
	enable_team_collaboration: bool = True
	assigned_team_members: List[str] = Field(default_factory=list)
	team_roles: Dict[str, TeamRole] = Field(default_factory=dict)  # user_id -> role
	enable_skill_based_assignment: bool = True
	max_concurrent_tasks_per_user: int = 3
	
	# Task coordination
	assignment_strategy: AssignmentStrategy = AssignmentStrategy.SKILL_BASED
	scheduling_strategy: SchedulingStrategy = SchedulingStrategy.BALANCED
	task_priority: TaskPriority = TaskPriority.MEDIUM
	enable_workload_balancing: bool = True
	
	# Quality assurance
	enable_quality_checkpoints: bool = True
	require_peer_review: bool = False
	require_manager_approval: bool = False
	enable_automated_quality_checks: bool = True
	quality_threshold: float = 0.8  # Minimum quality score
	
	# Progress tracking
	enable_progress_notifications: bool = True
	notification_channels: List[str] = Field(default_factory=lambda: ["email", "workflow"])
	enable_real_time_monitoring: bool = True
	progress_update_interval_minutes: int = 15
	
	# Advanced features
	enable_ai_optimization: bool = False
	enable_predictive_scheduling: bool = False
	enable_bottleneck_detection: bool = True
	enable_performance_analytics: bool = True
	
	# Custom phase configuration
	custom_phase_mappings: List[WorkflowPhaseMapping] = Field(default_factory=list)
	enable_custom_phases: bool = False
	
	# Collaboration preferences
	collaboration_mode: CollaborationType = CollaborationType.TEAM
	enable_concurrent_editing: bool = False
	conflict_resolution_strategy: str = "manual"  # manual, auto, voting
	
	# Escalation settings
	enable_automatic_escalation: bool = True
	escalation_delay_hours: float = 4.0
	escalation_recipients: List[str] = Field(default_factory=list)


class TeamMemberAssignment(BaseModel):
	"""Assignment of team member to workflow"""
	model_config = ConfigDict(extra='forbid')
	
	user_id: str
	role: TeamRole
	assigned_phases: List[GenerationPhase] = Field(default_factory=list)
	skills: Dict[str, float] = Field(default_factory=dict)  # skill -> proficiency (0-1)
	availability_hours: float = 8.0  # Available hours per day
	preferred_task_types: List[str] = Field(default_factory=list)
	max_concurrent_tasks: int = 3
	collaboration_preference: CollaborationType = CollaborationType.INDIVIDUAL
	notification_preferences: Dict[str, bool] = Field(default_factory=dict)


class WorkflowTemplate(BaseModel):
	"""Template for predefined workflow configurations"""
	model_config = ConfigDict(extra='forbid')
	
	template_id: str = Field(default_factory=uuid7str)
	template_name: str
	description: str
	document_types: List[str] = Field(default_factory=list)  # Applicable document types
	
	# Template configuration
	workflow_config: WorkflowConfiguration
	default_team_size: int = 1
	estimated_duration_hours: float = 4.0
	complexity_level: TaskComplexity = TaskComplexity.MEDIUM
	
	# Template metadata
	created_by: str
	created_at: datetime = Field(default_factory=datetime.now)
	version: str = "1.0"
	tags: List[str] = Field(default_factory=list)
	usage_count: int = 0
	success_rate: float = 0.0  # Success rate for this template


# ============================================================================
# Extended Request Models
# ============================================================================

class WorkflowEnabledDocumentRequest(BaseModel):
	"""
	Extended document generation request with workflow automation support.
	
	This class extends the standard DocumentGenerationRequest to include
	workflow configuration while maintaining backward compatibility.
	"""
	model_config = ConfigDict(extra='forbid')
	
	# Standard document request fields
	request_id: str = Field(default_factory=uuid7str)
	requester_id: str
	generation_config: DocumentGenerationConfiguration
	
	# Workflow-specific fields
	workflow_config: Optional[WorkflowConfiguration] = None
	team_assignments: List[TeamMemberAssignment] = Field(default_factory=list)
	workflow_template_id: Optional[str] = None
	
	# Project context
	project_name: Optional[str] = None
	project_description: Optional[str] = None
	client_name: Optional[str] = None
	business_context: Dict[str, Any] = Field(default_factory=dict)
	
	# Priority and urgency
	urgency_level: str = "medium"  # low, medium, high, critical
	business_priority: TaskPriority = TaskPriority.MEDIUM
	competitive_situation: bool = False
	
	# External dependencies
	external_dependencies: List[str] = Field(default_factory=list)
	required_approvers: List[str] = Field(default_factory=list)
	stakeholder_notifications: List[str] = Field(default_factory=list)
	
	# Workflow preferences
	preferred_start_time: Optional[datetime] = None
	flexible_deadline: bool = True
	allow_parallel_processing: bool = True
	enable_progress_sharing: bool = True
	
	# Integration settings
	integration_webhooks: List[str] = Field(default_factory=list)
	external_system_ids: Dict[str, str] = Field(default_factory=dict)  # system -> id
	
	@validator('workflow_config', pre=True, always=True)
	def set_default_workflow_config(cls, v, values):
		"""Set default workflow configuration if none provided"""
		if v is None and values.get('requester_id'):
			# Create basic workflow configuration
			return WorkflowConfiguration(
				integration_level=WorkflowIntegrationLevel.STANDARD,
				assigned_team_members=[values['requester_id']]
			)
		return v
	
	@validator('team_assignments', pre=True, always=True) 
	def ensure_requester_assignment(cls, v, values):
		"""Ensure requester is assigned as creator if no assignments provided"""
		if not v and values.get('requester_id'):
			requester_assignment = TeamMemberAssignment(
				user_id=values['requester_id'],
				role=TeamRole.CREATOR,
				assigned_phases=[phase for phase in GenerationPhase]
			)
			return [requester_assignment]
		return v
	
	def to_standard_request(self) -> DocumentGenerationRequest:
		"""Convert to standard DocumentGenerationRequest for backward compatibility"""
		return DocumentGenerationRequest(
			request_id=self.request_id,
			requester_id=self.requester_id,
			generation_config=self.generation_config
		)
	
	def get_workflow_document_config(self) -> WorkflowDocumentConfiguration:
		"""Convert workflow config to WorkflowDocumentConfiguration"""
		if not self.workflow_config:
			return WorkflowDocumentConfiguration()
		
		config = self.workflow_config
		
		return WorkflowDocumentConfiguration(
			workflow_mode=config.workflow_mode,
			enable_task_scheduling=config.enable_automatic_scheduling,
			enable_deadline_management=config.enable_deadline_management,
			enable_progress_monitoring=config.enable_real_time_monitoring,
			assignment_strategy=config.assignment_strategy,
			enable_workload_balancing=config.enable_workload_balancing,
			max_concurrent_tasks_per_user=config.max_concurrent_tasks_per_user,
			scheduling_strategy=config.scheduling_strategy,
			priority_level=config.task_priority,
			enable_automatic_deadlines=config.enable_deadline_management,
			default_deadline_buffer_hours=config.deadline_buffer_hours,
			critical_path_monitoring=config.enable_bottleneck_detection,
			enable_quality_checkpoints=config.enable_quality_checkpoints,
			require_peer_review=config.require_peer_review,
			require_manager_approval=config.require_manager_approval,
			phase_mappings=config.custom_phase_mappings,
			enable_event_notifications=config.enable_progress_notifications,
			notification_channels=config.notification_channels
		)


class WorkflowEnabledDocumentResult(BaseModel):
	"""Extended document generation result with workflow metadata"""
	model_config = ConfigDict(extra='forbid')
	
	# Standard result fields
	request_id: str
	generation_result: DocumentGenerationResult
	
	# Workflow-specific fields
	workflow_instance_id: Optional[str] = None
	workflow_state: str = "completed"
	
	# Team and collaboration metrics
	team_participation: Dict[str, Dict[str, Any]] = Field(default_factory=dict)  # user_id -> metrics
	collaboration_metrics: Dict[str, Any] = Field(default_factory=dict)
	
	# Workflow performance metrics
	workflow_processing_time: float = 0.0
	task_completion_times: Dict[str, float] = Field(default_factory=dict)  # task_id -> duration
	phase_durations: Dict[str, float] = Field(default_factory=dict)  # phase -> duration
	
	# Quality metrics
	workflow_quality_score: Optional[float] = None
	review_feedback: List[Dict[str, Any]] = Field(default_factory=list)
	quality_checkpoints_passed: int = 0
	quality_checkpoints_total: int = 0
	
	# Timeline metrics
	planned_duration_hours: Optional[float] = None
	actual_duration_hours: Optional[float] = None
	deadline_met: bool = True
	buffer_time_used_hours: float = 0.0
	
	# Resource utilization
	resource_utilization: Dict[str, float] = Field(default_factory=dict)  # user_id -> utilization
	bottlenecks_detected: List[str] = Field(default_factory=list)
	optimization_suggestions: List[str] = Field(default_factory=list)
	
	# Workflow events and milestones
	milestone_timestamps: Dict[str, datetime] = Field(default_factory=dict)
	event_log: List[Dict[str, Any]] = Field(default_factory=list)
	
	def to_standard_result(self) -> DocumentGenerationResult:
		"""Convert to standard DocumentGenerationResult for backward compatibility"""
		return self.generation_result


# ============================================================================
# Request Builder and Factory
# ============================================================================

class WorkflowRequestBuilder:
	"""Builder for creating workflow-enabled document requests"""
	
	def __init__(self, requester_id: str):
		self.requester_id = requester_id
		self._generation_config = None
		self._workflow_config = WorkflowConfiguration()
		self._team_assignments = []
		self._project_context = {}
		self._template_id = None
	
	def with_generation_config(self, config: DocumentGenerationConfiguration) -> 'WorkflowRequestBuilder':
		"""Set document generation configuration"""
		self._generation_config = config
		return self
	
	def with_workflow_template(self, template_id: str) -> 'WorkflowRequestBuilder':
		"""Use a predefined workflow template"""
		self._template_id = template_id
		return self
	
	def with_workflow_mode(self, mode: DocumentWorkflowMode) -> 'WorkflowRequestBuilder':
		"""Set workflow mode"""
		self._workflow_config.workflow_mode = mode
		return self
	
	def with_deadline(self, deadline: datetime, buffer_hours: float = 24.0) -> 'WorkflowRequestBuilder':
		"""Set project deadline"""
		self._workflow_config.project_deadline = deadline
		self._workflow_config.deadline_buffer_hours = buffer_hours
		self._workflow_config.enable_deadline_management = True
		return self
	
	def with_team_member(
		self, 
		user_id: str, 
		role: TeamRole, 
		skills: Optional[Dict[str, float]] = None,
		phases: Optional[List[GenerationPhase]] = None
	) -> 'WorkflowRequestBuilder':
		"""Add team member assignment"""
		assignment = TeamMemberAssignment(
			user_id=user_id,
			role=role,
			skills=skills or {},
			assigned_phases=phases or []
		)
		self._team_assignments.append(assignment)
		
		# Add to workflow config team list
		if user_id not in self._workflow_config.assigned_team_members:
			self._workflow_config.assigned_team_members.append(user_id)
			self._workflow_config.team_roles[user_id] = role
		
		return self
	
	def with_quality_requirements(
		self, 
		require_review: bool = False, 
		require_approval: bool = False,
		quality_threshold: float = 0.8
	) -> 'WorkflowRequestBuilder':
		"""Set quality assurance requirements"""
		self._workflow_config.require_peer_review = require_review
		self._workflow_config.require_manager_approval = require_approval
		self._workflow_config.quality_threshold = quality_threshold
		self._workflow_config.enable_quality_checkpoints = True
		return self
	
	def with_priority(self, priority: TaskPriority, urgency: str = "medium") -> 'WorkflowRequestBuilder':
		"""Set priority and urgency"""
		self._workflow_config.task_priority = priority
		self._project_context['urgency_level'] = urgency
		return self
	
	def with_project_context(
		self, 
		project_name: str, 
		client_name: Optional[str] = None,
		description: Optional[str] = None
	) -> 'WorkflowRequestBuilder':
		"""Set project context information"""
		self._project_context.update({
			'project_name': project_name,
			'client_name': client_name,
			'project_description': description
		})
		return self
	
	def with_collaboration_settings(
		self,
		enable_concurrent_editing: bool = False,
		conflict_resolution: str = "manual",
		collaboration_mode: CollaborationType = CollaborationType.TEAM
	) -> 'WorkflowRequestBuilder':
		"""Set collaboration preferences"""
		self._workflow_config.enable_concurrent_editing = enable_concurrent_editing
		self._workflow_config.conflict_resolution_strategy = conflict_resolution
		self._workflow_config.collaboration_mode = collaboration_mode
		return self
	
	def build(self) -> WorkflowEnabledDocumentRequest:
		"""Build the workflow-enabled document request"""
		if not self._generation_config:
			raise ValueError("Document generation configuration is required")
		
		# Ensure requester is in team assignments
		requester_in_team = any(
			assignment.user_id == self.requester_id 
			for assignment in self._team_assignments
		)
		
		if not requester_in_team:
			self._team_assignments.insert(0, TeamMemberAssignment(
				user_id=self.requester_id,
				role=TeamRole.CREATOR,
				assigned_phases=[phase for phase in GenerationPhase]
			))
		
		return WorkflowEnabledDocumentRequest(
			requester_id=self.requester_id,
			generation_config=self._generation_config,
			workflow_config=self._workflow_config,
			team_assignments=self._team_assignments,
			workflow_template_id=self._template_id,
			**self._project_context
		)


# ============================================================================
# Template Management
# ============================================================================

class WorkflowTemplateManager:
	"""Manager for workflow templates"""
	
	def __init__(self):
		self.templates: Dict[str, WorkflowTemplate] = {}
		self._setup_default_templates()
	
	def _setup_default_templates(self):
		"""Set up default workflow templates"""
		
		# Simple individual workflow template
		simple_config = WorkflowConfiguration(
			integration_level=WorkflowIntegrationLevel.BASIC,
			workflow_mode=DocumentWorkflowMode.AUTOMATIC,
			enable_team_collaboration=False,
			require_peer_review=False,
			require_manager_approval=False
		)
		
		simple_template = WorkflowTemplate(
			template_name="Simple Individual Workflow",
			description="Basic workflow for individual document creation",
			document_types=["memo", "letter", "simple_report"],
			workflow_config=simple_config,
			default_team_size=1,
			estimated_duration_hours=2.0,
			complexity_level=TaskComplexity.LOW,
			created_by="system",
			tags=["simple", "individual", "basic"]
		)
		
		self.templates[simple_template.template_id] = simple_template
		
		# Standard team workflow template
		team_config = WorkflowConfiguration(
			integration_level=WorkflowIntegrationLevel.STANDARD,
			workflow_mode=DocumentWorkflowMode.AUTOMATIC,
			enable_team_collaboration=True,
			require_peer_review=True,
			enable_skill_based_assignment=True,
			enable_workload_balancing=True
		)
		
		team_template = WorkflowTemplate(
			template_name="Standard Team Workflow",
			description="Collaborative workflow with peer review",
			document_types=["business_proposal", "technical_specification", "user_manual"],
			workflow_config=team_config,
			default_team_size=3,
			estimated_duration_hours=6.0,
			complexity_level=TaskComplexity.MEDIUM,
			created_by="system",
			tags=["team", "collaborative", "review"]
		)
		
		self.templates[team_template.template_id] = team_template
		
		# Advanced enterprise workflow template
		enterprise_config = WorkflowConfiguration(
			integration_level=WorkflowIntegrationLevel.ADVANCED,
			workflow_mode=DocumentWorkflowMode.ASSISTED,
			enable_team_collaboration=True,
			require_peer_review=True,
			require_manager_approval=True,
			enable_ai_optimization=True,
			enable_predictive_scheduling=True,
			enable_automatic_escalation=True,
			quality_threshold=0.9
		)
		
		enterprise_template = WorkflowTemplate(
			template_name="Enterprise Approval Workflow",
			description="Full-featured workflow with AI optimization and approvals",
			document_types=["contract", "policy", "compliance_report", "strategic_plan"],
			workflow_config=enterprise_config,
			default_team_size=5,
			estimated_duration_hours=12.0,
			complexity_level=TaskComplexity.HIGH,
			created_by="system",
			tags=["enterprise", "approval", "ai", "advanced"]
		)
		
		self.templates[enterprise_template.template_id] = enterprise_template
	
	def get_template(self, template_id: str) -> Optional[WorkflowTemplate]:
		"""Get workflow template by ID"""
		return self.templates.get(template_id)
	
	def list_templates(
		self, 
		document_type: Optional[str] = None,
		complexity: Optional[TaskComplexity] = None,
		tags: Optional[List[str]] = None
	) -> List[WorkflowTemplate]:
		"""List available templates with optional filtering"""
		templates = list(self.templates.values())
		
		if document_type:
			templates = [
				t for t in templates 
				if not t.document_types or document_type in t.document_types
			]
		
		if complexity:
			templates = [t for t in templates if t.complexity_level == complexity]
		
		if tags:
			templates = [
				t for t in templates 
				if any(tag in t.tags for tag in tags)
			]
		
		return templates
	
	def create_template(self, template: WorkflowTemplate) -> str:
		"""Create a new workflow template"""
		self.templates[template.template_id] = template
		return template.template_id
	
	def update_template_usage(self, template_id: str, success: bool):
		"""Update template usage statistics"""
		if template_id in self.templates:
			template = self.templates[template_id]
			template.usage_count += 1
			
			# Update success rate (simple moving average)
			if template.usage_count == 1:
				template.success_rate = 1.0 if success else 0.0
			else:
				# Weighted average favoring recent results
				weight = 0.8  # Weight for new result
				template.success_rate = (
					weight * (1.0 if success else 0.0) + 
					(1 - weight) * template.success_rate
				)


# ============================================================================
# Factory Functions
# ============================================================================

def create_workflow_request_builder(requester_id: str) -> WorkflowRequestBuilder:
	"""Create a new workflow request builder"""
	return WorkflowRequestBuilder(requester_id)


def create_simple_workflow_request(
	requester_id: str,
	generation_config: DocumentGenerationConfiguration,
	deadline: Optional[datetime] = None
) -> WorkflowEnabledDocumentRequest:
	"""Create a simple workflow-enabled request with minimal configuration"""
	builder = WorkflowRequestBuilder(requester_id)
	builder.with_generation_config(generation_config)
	
	if deadline:
		builder.with_deadline(deadline)
	
	return builder.build()


def create_team_workflow_request(
	requester_id: str,
	generation_config: DocumentGenerationConfiguration,
	team_members: List[tuple[str, TeamRole]],  # [(user_id, role), ...]
	deadline: Optional[datetime] = None,
	require_review: bool = True
) -> WorkflowEnabledDocumentRequest:
	"""Create a team-based workflow request"""
	builder = WorkflowRequestBuilder(requester_id)
	builder.with_generation_config(generation_config)
	builder.with_workflow_mode(DocumentWorkflowMode.AUTOMATIC)
	
	# Add team members
	for user_id, role in team_members:
		builder.with_team_member(user_id, role)
	
	if deadline:
		builder.with_deadline(deadline)
	
	if require_review:
		builder.with_quality_requirements(require_review=True)
	
	return builder.build()


async def convert_standard_to_workflow_request(
	standard_request: DocumentGenerationRequest,
	workflow_config: Optional[WorkflowConfiguration] = None
) -> WorkflowEnabledDocumentRequest:
	"""Convert a standard DocumentGenerationRequest to workflow-enabled request"""
	return WorkflowEnabledDocumentRequest(
		request_id=standard_request.request_id,
		requester_id=standard_request.requester_id,
		generation_config=standard_request.generation_config,
		workflow_config=workflow_config
	)


# Global template manager instance
template_manager = WorkflowTemplateManager()