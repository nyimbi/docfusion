"""
Integration between workflow engine and collaboration system.

This module provides workflow-driven document creation, automated 
workflow execution, and integration with collaboration features.
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Callable

from pydantic import BaseModel, Field, ConfigDict

def uuid7str():
	"""Generate a UUID7-like string using UUID4 for compatibility."""
	return str(uuid.uuid4())

# Import collaboration components
from ..collaboration.presence.presence_manager import PresenceManager, UserSession
from ..collaboration.permissions.collaboration_permissions import CollaborationPermissions, Permission, PermissionScope
from ..collaboration.editing.collaborative_editor import CollaborativeEditor

# Import workflow components  
from .processes.process_definition import ProcessDefinition, WorkflowNode, NodeType
from .processes.workflow_template import WorkflowTemplate, IndustryTemplate


logger = logging.getLogger(__name__)


class WorkflowExecutionStatus(str, Enum):
	"""Workflow execution statuses."""
	PENDING = "pending"
	RUNNING = "running"
	WAITING = "waiting"
	COMPLETED = "completed"
	FAILED = "failed"
	CANCELLED = "cancelled"
	SUSPENDED = "suspended"


class TaskStatus(str, Enum):
	"""Individual task statuses."""
	NOT_STARTED = "not_started"
	IN_PROGRESS = "in_progress"
	COMPLETED = "completed"
	FAILED = "failed"
	SKIPPED = "skipped"
	WAITING_FOR_INPUT = "waiting_for_input"


class WorkflowExecution(BaseModel):
	"""Active workflow execution instance."""
	model_config = ConfigDict(extra='forbid')
	
	execution_id: str = Field(default_factory=uuid7str)
	process_id: str = Field(description="Process definition ID")
	document_id: str = Field(description="Associated document ID")
	initiated_by: str = Field(description="User who started the workflow")
	started_at: datetime = Field(default_factory=datetime.now)
	
	# Execution state
	status: WorkflowExecutionStatus = Field(WorkflowExecutionStatus.PENDING)
	current_tasks: List[str] = Field(default_factory=list, description="Currently active task IDs")
	completed_tasks: List[str] = Field(default_factory=list, description="Completed task IDs")
	failed_tasks: List[str] = Field(default_factory=list, description="Failed task IDs")
	
	# Workflow data
	workflow_variables: Dict[str, Any] = Field(default_factory=dict, description="Workflow execution variables")
	task_assignments: Dict[str, List[str]] = Field(default_factory=dict, description="Task ID -> assigned user IDs")
	task_status: Dict[str, TaskStatus] = Field(default_factory=dict, description="Task ID -> status")
	task_results: Dict[str, Dict[str, Any]] = Field(default_factory=dict, description="Task execution results")
	
	# Timing and performance
	estimated_completion: Optional[datetime] = Field(None, description="Estimated completion time")
	actual_completion: Optional[datetime] = Field(None, description="Actual completion time")
	task_durations: Dict[str, float] = Field(default_factory=dict, description="Task ID -> duration in seconds")
	
	# Collaboration integration
	collaboration_sessions: Dict[str, str] = Field(default_factory=dict, description="Task ID -> session ID")
	permission_grants: List[str] = Field(default_factory=list, description="Permission grant IDs created for this workflow")


class TaskExecution(BaseModel):
	"""Individual task execution state."""
	model_config = ConfigDict(extra='forbid')
	
	task_id: str = Field(description="Task identifier")
	execution_id: str = Field(description="Parent workflow execution ID")
	node: WorkflowNode = Field(description="Workflow node definition")
	
	# Execution state
	status: TaskStatus = Field(TaskStatus.NOT_STARTED)
	assigned_users: List[str] = Field(default_factory=list)
	started_at: Optional[datetime] = None
	completed_at: Optional[datetime] = None
	
	# Task data
	input_data: Dict[str, Any] = Field(default_factory=dict)
	output_data: Dict[str, Any] = Field(default_factory=dict)
	
	# Collaboration state
	collaboration_session_id: Optional[str] = None
	document_section_id: Optional[str] = None
	required_permissions: Set[Permission] = Field(default_factory=set)
	
	# Error handling
	error_message: Optional[str] = None
	retry_count: int = 0
	escalated: bool = False


@dataclass
class WorkflowEvent:
	"""Workflow execution event."""
	event_id: str = field(default_factory=uuid7str)
	execution_id: str = ""
	event_type: str = ""  # started, task_completed, failed, etc.
	event_data: Dict[str, Any] = field(default_factory=dict)
	timestamp: datetime = field(default_factory=datetime.now)
	user_id: Optional[str] = None


class CollaborationWorkflowIntegrator:
	"""
	Integrates workflow engine with collaboration system.
	
	Provides workflow-driven document creation, automated workflow
	execution, and seamless integration with collaboration features.
	"""
	
	def __init__(
		self,
		presence_manager: PresenceManager,
		permissions_manager: CollaborationPermissions,
		process_definition: ProcessDefinition,
		workflow_template: WorkflowTemplate
	):
		self.presence_manager = presence_manager
		self.permissions_manager = permissions_manager
		self.process_definition = process_definition
		self.workflow_template = workflow_template
		
		# Execution state
		self.active_executions: Dict[str, WorkflowExecution] = {}  # execution_id -> execution
		self.task_executions: Dict[str, TaskExecution] = {}  # task_id -> task execution
		self.collaborative_editors: Dict[str, CollaborativeEditor] = {}  # document_id -> editor
		self.workflow_subscribers: List[Callable] = []
		
		# Background tasks
		self.execution_monitor_task: Optional[asyncio.Task] = None
		self._lock = asyncio.Lock()
		
		logger.info("CollaborationWorkflowIntegrator initialized")
	
	async def start_monitoring(self):
		"""Start background workflow monitoring."""
		if self.execution_monitor_task is None:
			self.execution_monitor_task = asyncio.create_task(self._monitor_workflow_executions())
			logger.info("Workflow execution monitoring started")
	
	async def stop_monitoring(self):
		"""Stop background workflow monitoring."""
		if self.execution_monitor_task:
			self.execution_monitor_task.cancel()
			try:
				await self.execution_monitor_task
			except asyncio.CancelledError:
				pass
			self.execution_monitor_task = None
			logger.info("Workflow execution monitoring stopped")
	
	async def start_workflow_for_document(
		self,
		process_id: str,
		document_id: str,
		initiated_by: str,
		workflow_variables: Optional[Dict[str, Any]] = None
	) -> WorkflowExecution:
		"""
		Start a workflow execution for a document.
		
		Args:
			process_id: Process definition ID
			initiated_by: User starting the workflow
			document_id: Document to associate with workflow
			workflow_variables: Initial workflow variables
			
		Returns:
			WorkflowExecution: Started workflow execution
		"""
		async with self._lock:
			# Validate process exists
			process_metadata = await self.process_definition.get_process(process_id)
			if not process_metadata:
				raise ValueError(f"Process {process_id} not found")
			
			# Create workflow execution
			execution = WorkflowExecution(
				process_id=process_id,
				document_id=document_id,
				initiated_by=initiated_by,
				workflow_variables=workflow_variables or {},
				status=WorkflowExecutionStatus.RUNNING
			)
			
			self.active_executions[execution.execution_id] = execution
			
			# Initialize collaborative editor for document if needed
			if document_id not in self.collaborative_editors:
				editor = CollaborativeEditor(document_id)
				self.collaborative_editors[document_id] = editor
			
			# Start execution
			await self._initialize_workflow_execution(execution)
			
			logger.info(f"Started workflow {process_id} for document {document_id}")
			
			# Notify subscribers
			await self._notify_workflow_event(WorkflowEvent(
				execution_id=execution.execution_id,
				event_type="workflow_started",
				event_data={
					"process_id": process_id,
					"document_id": document_id,
					"initiated_by": initiated_by
				},
				user_id=initiated_by
			))
			
			return execution
	
	async def start_workflow_from_template(
		self,
		template_id: str,
		document_id: str,
		initiated_by: str,
		template_parameters: Dict[str, Any]
	) -> WorkflowExecution:
		"""
		Start workflow from template with parameters.
		
		Args:
			template_id: Template ID
			document_id: Document ID
			initiated_by: User starting workflow
			template_parameters: Template parameter values
			
		Returns:
			WorkflowExecution: Started workflow execution
		"""
		# Get template
		template = await self.workflow_template.get_template(template_id)
		if not template:
			raise ValueError(f"Template {template_id} not found")
		
		# Instantiate template
		instance = await self.workflow_template.instantiate_template(
			template_id, f"Workflow for {document_id}", template_parameters, initiated_by
		)
		
		# Create process from template
		process_metadata = await self.process_definition.create_process(
			name=f"Process from {template.name}",
			description=f"Generated from template {template.name}",
			created_by=initiated_by
		)
		
		# Apply template definition to process
		await self._apply_template_to_process(process_metadata.process_id, template, template_parameters)
		
		# Start workflow
		return await self.start_workflow_for_document(
			process_metadata.process_id,
			document_id,
			initiated_by,
			template_parameters
		)
	
	async def complete_task(
		self,
		execution_id: str,
		task_id: str,
		user_id: str,
		task_output: Optional[Dict[str, Any]] = None
	) -> bool:
		"""
		Complete a workflow task.
		
		Args:
			execution_id: Workflow execution ID
			task_id: Task ID to complete
			user_id: User completing task
			task_output: Task output data
			
		Returns:
			bool: True if task was completed successfully
		"""
		async with self._lock:
			if execution_id not in self.active_executions:
				logger.warning(f"Execution {execution_id} not found")
				return False
			
			if task_id not in self.task_executions:
				logger.warning(f"Task {task_id} not found")
				return False
			
			execution = self.active_executions[execution_id]
			task_execution = self.task_executions[task_id]
			
			# Validate user can complete task
			if user_id not in task_execution.assigned_users:
				# Check if user has permission to complete task
				has_permission = await self.permissions_manager.check_permission(
					user_id=user_id,
					permission=Permission.WRITE,
					target_id=execution.document_id,
					scope=PermissionScope.DOCUMENT
				)
				
				if not has_permission:
					logger.warning(f"User {user_id} lacks permission to complete task {task_id}")
					return False
			
			# Update task status
			task_execution.status = TaskStatus.COMPLETED
			task_execution.completed_at = datetime.now()
			task_execution.output_data = task_output or {}
			
			# Calculate task duration
			if task_execution.started_at:
				duration = (task_execution.completed_at - task_execution.started_at).total_seconds()
				execution.task_durations[task_id] = duration
			
			# Update execution state
			if task_id in execution.current_tasks:
				execution.current_tasks.remove(task_id)
			execution.completed_tasks.append(task_id)
			execution.task_status[task_id] = TaskStatus.COMPLETED
			execution.task_results[task_id] = task_execution.output_data
			
			logger.info(f"Task {task_id} completed by {user_id}")
			
			# Check if workflow can continue
			await self._progress_workflow_execution(execution)
			
			# Notify subscribers
			await self._notify_workflow_event(WorkflowEvent(
				execution_id=execution_id,
				event_type="task_completed",
				event_data={
					"task_id": task_id,
					"task_output": task_output,
					"completed_by": user_id
				},
				user_id=user_id
			))
			
			return True
	
	async def assign_task_to_users(
		self,
		execution_id: str,
		task_id: str,
		user_ids: List[str],
		assigned_by: str
	) -> bool:
		"""
		Assign task to specific users.
		
		Args:
			execution_id: Workflow execution ID
			task_id: Task ID
			user_ids: List of user IDs to assign
			assigned_by: User making the assignment
			
		Returns:
			bool: True if assignment was successful
		"""
		async with self._lock:
			if execution_id not in self.active_executions:
				return False
			
			if task_id not in self.task_executions:
				return False
			
			execution = self.active_executions[execution_id]
			task_execution = self.task_executions[task_id]
			
			# Update task assignment
			task_execution.assigned_users = user_ids
			execution.task_assignments[task_id] = user_ids
			
			# Grant necessary permissions to assigned users
			for user_id in user_ids:
				for permission in task_execution.required_permissions:
					await self.permissions_manager.grant_permission(
						user_id=user_id,
						permission=permission,
						scope=PermissionScope.DOCUMENT,
						target_id=execution.document_id,
						granted_by=assigned_by,
						reason=f"Workflow task assignment: {task_id}"
					)
			
			# Add users to collaboration session if needed
			if task_execution.collaboration_session_id:
				editor = self.collaborative_editors.get(execution.document_id)
				if editor:
					for user_id in user_ids:
						await editor.add_user(user_id, f"User {user_id}")
			
			logger.info(f"Assigned task {task_id} to users: {user_ids}")
			
			# Notify assigned users
			await self._notify_workflow_event(WorkflowEvent(
				execution_id=execution_id,
				event_type="task_assigned",
				event_data={
					"task_id": task_id,
					"assigned_users": user_ids,
					"assigned_by": assigned_by
				},
				user_id=assigned_by
			))
			
			return True
	
	async def get_workflow_status(self, execution_id: str) -> Optional[Dict[str, Any]]:
		"""
		Get comprehensive workflow execution status.
		
		Args:
			execution_id: Workflow execution ID
			
		Returns:
			Optional[Dict[str, Any]]: Workflow status if found
		"""
		if execution_id not in self.active_executions:
			return None
		
		execution = self.active_executions[execution_id]
		
		# Get process definition
		process_metadata = await self.process_definition.get_process(execution.process_id)
		process_nodes = await self.process_definition.get_process_nodes(execution.process_id)
		
		# Calculate progress
		total_tasks = len(process_nodes)
		completed_tasks = len(execution.completed_tasks)
		progress_percentage = (completed_tasks / total_tasks) * 100 if total_tasks > 0 else 0
		
		# Get active users
		active_users = []
		if execution.document_id in self.collaborative_editors:
			editor = self.collaborative_editors[execution.document_id]
			editor_users = await editor.get_users()
			active_users = [user.user_name for user in editor_users.values()]
		
		return {
			"execution_id": execution_id,
			"process_id": execution.process_id,
			"process_name": process_metadata.name if process_metadata else "Unknown",
			"document_id": execution.document_id,
			"status": execution.status.value,
			"initiated_by": execution.initiated_by,
			"started_at": execution.started_at.isoformat(),
			"progress_percentage": progress_percentage,
			"current_tasks": execution.current_tasks,
			"completed_tasks": execution.completed_tasks,
			"failed_tasks": execution.failed_tasks,
			"total_tasks": total_tasks,
			"active_users": active_users,
			"estimated_completion": execution.estimated_completion.isoformat() if execution.estimated_completion else None,
			"actual_completion": execution.actual_completion.isoformat() if execution.actual_completion else None,
			"workflow_variables": execution.workflow_variables
		}
	
	async def get_user_tasks(
		self,
		user_id: str,
		status_filter: Optional[TaskStatus] = None
	) -> List[Dict[str, Any]]:
		"""
		Get tasks assigned to a user.
		
		Args:
			user_id: User ID
			status_filter: Optional status filter
			
		Returns:
			List[Dict[str, Any]]: User's tasks
		"""
		user_tasks = []
		
		for task_execution in self.task_executions.values():
			if user_id not in task_execution.assigned_users:
				continue
			
			if status_filter and task_execution.status != status_filter:
				continue
			
			execution = self.active_executions.get(task_execution.execution_id)
			if not execution:
				continue
			
			task_info = {
				"task_id": task_execution.task_id,
				"execution_id": task_execution.execution_id,
				"task_name": task_execution.node.name,
				"task_type": task_execution.node.node_type.value,
				"status": task_execution.status.value,
				"document_id": execution.document_id,
				"started_at": task_execution.started_at.isoformat() if task_execution.started_at else None,
				"assigned_users": task_execution.assigned_users,
				"required_permissions": [p.value for p in task_execution.required_permissions],
				"collaboration_session_id": task_execution.collaboration_session_id
			}
			
			user_tasks.append(task_info)
		
		return user_tasks
	
	async def subscribe_to_workflow_events(self, callback: Callable[[WorkflowEvent], None]) -> str:
		"""
		Subscribe to workflow execution events.
		
		Args:
			callback: Callback function for workflow events
			
		Returns:
			str: Subscription ID
		"""
		self.workflow_subscribers.append(callback)
		subscription_id = uuid7str()
		logger.info("New workflow event subscription added")
		return subscription_id
	
	async def _initialize_workflow_execution(self, execution: WorkflowExecution):
		"""Initialize workflow execution by finding and starting initial tasks."""
		process_nodes = await self.process_definition.get_process_nodes(execution.process_id)
		process_edges = await self.process_definition.get_process_edges(execution.process_id)
		
		# Find start nodes
		start_nodes = [node for node in process_nodes.values() if node.node_type == NodeType.START]
		
		if not start_nodes:
			execution.status = WorkflowExecutionStatus.FAILED
			logger.error(f"No start node found in process {execution.process_id}")
			return
		
		# Initialize all task executions
		for node in process_nodes.values():
			task_execution = TaskExecution(
				task_id=node.node_id,
				execution_id=execution.execution_id,
				node=node,
				assigned_users=node.assigned_users.copy(),
				required_permissions=self._determine_task_permissions(node)
			)
			
			self.task_executions[node.node_id] = task_execution
			execution.task_status[node.node_id] = TaskStatus.NOT_STARTED
		
		# Start initial tasks (typically start nodes or tasks following start nodes)
		for start_node in start_nodes:
			await self._start_task(execution, start_node.node_id)
		
		# Progress workflow
		await self._progress_workflow_execution(execution)
	
	async def _progress_workflow_execution(self, execution: WorkflowExecution):
		"""Progress workflow execution by starting next available tasks."""
		process_edges = await self.process_definition.get_process_edges(execution.process_id)
		
		# Find tasks that can be started
		for edge in process_edges.values():
			source_task = self.task_executions.get(edge.source_node_id)
			target_task = self.task_executions.get(edge.target_node_id)
			
			if not source_task or not target_task:
				continue
			
			# Check if source task is completed and target task is not started
			if (source_task.status == TaskStatus.COMPLETED and 
				target_task.status == TaskStatus.NOT_STARTED):
				
				# Check edge condition if present
				if edge.condition:
					condition_met = await self._evaluate_edge_condition(edge, execution)
					if not condition_met:
						continue
				
				# Start target task
				await self._start_task(execution, target_task.task_id)
		
		# Check if workflow is completed
		await self._check_workflow_completion(execution)
	
	async def _start_task(self, execution: WorkflowExecution, task_id: str):
		"""Start execution of a specific task."""
		task_execution = self.task_executions[task_id]
		
		# Update task status
		task_execution.status = TaskStatus.IN_PROGRESS
		task_execution.started_at = datetime.now()
		execution.current_tasks.append(task_id)
		execution.task_status[task_id] = TaskStatus.IN_PROGRESS
		
		# Handle different node types
		if task_execution.node.node_type in [NodeType.USER_TASK, NodeType.MANUAL_TASK]:
			await self._setup_collaborative_task(execution, task_execution)
		elif task_execution.node.node_type in [NodeType.SERVICE_TASK, NodeType.SCRIPT_TASK]:
			await self._execute_service_task(execution, task_execution)
		elif task_execution.node.node_type == NodeType.START:
			# Start nodes complete immediately
			await self._complete_automatic_task(execution, task_execution)
		elif task_execution.node.node_type == NodeType.END:
			# End nodes complete immediately and may end workflow
			await self._complete_automatic_task(execution, task_execution)
		
		logger.info(f"Started task {task_id} in execution {execution.execution_id}")
	
	async def _setup_collaborative_task(self, execution: WorkflowExecution, task_execution: TaskExecution):
		"""Setup collaborative editing for a user task."""
		# Create collaboration session
		editor = self.collaborative_editors.get(execution.document_id)
		if editor:
			# Add assigned users to collaboration session
			for user_id in task_execution.assigned_users:
				session = await self.presence_manager.add_user_to_document(
					execution.document_id,
					user_id,
					f"User {user_id}",
					task_execution.required_permissions
				)
				task_execution.collaboration_session_id = session.session_id
		
		# Grant necessary permissions
		for user_id in task_execution.assigned_users:
			for permission in task_execution.required_permissions:
				await self.permissions_manager.grant_permission(
					user_id=user_id,
					permission=permission,
					scope=PermissionScope.DOCUMENT,
					target_id=execution.document_id,
					granted_by=execution.initiated_by,
					reason=f"Workflow task: {task_execution.node.name}"
				)
	
	async def _execute_service_task(self, execution: WorkflowExecution, task_execution: TaskExecution):
		"""Execute a service task automatically."""
		try:
			# Simulate service task execution
			await asyncio.sleep(0.1)  # Simulate processing
			
			# Auto-complete service tasks for now
			await self._complete_automatic_task(execution, task_execution)
			
		except Exception as e:
			task_execution.status = TaskStatus.FAILED
			task_execution.error_message = str(e)
			execution.failed_tasks.append(task_execution.task_id)
			logger.error(f"Service task {task_execution.task_id} failed: {e}")
	
	async def _complete_automatic_task(self, execution: WorkflowExecution, task_execution: TaskExecution):
		"""Complete an automatic task (start, end, service, etc.)."""
		task_execution.status = TaskStatus.COMPLETED
		task_execution.completed_at = datetime.now()
		
		if task_execution.task_id in execution.current_tasks:
			execution.current_tasks.remove(task_execution.task_id)
		execution.completed_tasks.append(task_execution.task_id)
		execution.task_status[task_execution.task_id] = TaskStatus.COMPLETED
	
	async def _check_workflow_completion(self, execution: WorkflowExecution):
		"""Check if workflow execution is completed."""
		process_nodes = await self.process_definition.get_process_nodes(execution.process_id)
		
		# Check if all end nodes are completed
		end_nodes = [node for node in process_nodes.values() if node.node_type == NodeType.END]
		
		if end_nodes:
			end_nodes_completed = all(
				execution.task_status.get(node.node_id) == TaskStatus.COMPLETED
				for node in end_nodes
			)
			
			if end_nodes_completed:
				execution.status = WorkflowExecutionStatus.COMPLETED
				execution.actual_completion = datetime.now()
				
				logger.info(f"Workflow execution {execution.execution_id} completed")
				
				# Notify completion
				await self._notify_workflow_event(WorkflowEvent(
					execution_id=execution.execution_id,
					event_type="workflow_completed",
					event_data={
						"completion_time": execution.actual_completion.isoformat(),
						"total_tasks": len(process_nodes),
						"completed_tasks": len(execution.completed_tasks),
						"failed_tasks": len(execution.failed_tasks)
					}
				))
	
	async def _apply_template_to_process(
		self,
		process_id: str,
		template: IndustryTemplate,
		parameters: Dict[str, Any]
	):
		"""Apply template definition to a process with parameters."""
		base_definition = template.base_process_definition
		
		# Add nodes from template
		for node_data in base_definition.get("nodes", {}).values():
			await self.process_definition.add_node(
				process_id=process_id,
				node_type=NodeType(node_data["node_type"]),
				name=node_data["name"],
				x=node_data.get("x", 0),
				y=node_data.get("y", 0),
				properties=node_data.get("properties", {})
			)
		
		# Add edges from template
		for edge_data in base_definition.get("edges", []):
			nodes = await self.process_definition.get_process_nodes(process_id)
			source_nodes = [n for n in nodes.values() if n.name == edge_data["source"]]
			target_nodes = [n for n in nodes.values() if n.name == edge_data["target"]]
			
			if source_nodes and target_nodes:
				await self.process_definition.add_edge(
					process_id=process_id,
					source_node_id=source_nodes[0].node_id,
					target_node_id=target_nodes[0].node_id,
					condition=edge_data.get("condition", "")
				)
	
	async def _evaluate_edge_condition(self, edge, execution: WorkflowExecution) -> bool:
		"""Evaluate edge condition to determine if workflow can proceed."""
		if not edge.condition:
			return True
		
		# Simple condition evaluation (would be more sophisticated in production)
		try:
			# Replace variables in condition with actual values
			condition = edge.condition
			for var_name, var_value in execution.workflow_variables.items():
				condition = condition.replace(f"{{{var_name}}}", str(var_value))
			
			# Evaluate simple conditions
			if condition in ["true", "True", "1"]:
				return True
			elif condition in ["false", "False", "0"]:
				return False
			else:
				# Default to true for unrecognized conditions
				return True
				
		except Exception as e:
			logger.warning(f"Error evaluating edge condition '{edge.condition}': {e}")
			return False
	
	def _determine_task_permissions(self, node: WorkflowNode) -> Set[Permission]:
		"""Determine required permissions for a task based on node type."""
		permissions = set()
		
		if node.node_type in [NodeType.USER_TASK, NodeType.MANUAL_TASK]:
			permissions.add(Permission.READ)
			permissions.add(Permission.WRITE)
			
			if "review" in node.name.lower():
				permissions.add(Permission.REVIEW)
			
			if "approve" in node.name.lower():
				permissions.add(Permission.APPROVE)
			
			if "comment" in node.name.lower():
				permissions.add(Permission.COMMENT)
		
		elif node.node_type in [NodeType.SERVICE_TASK, NodeType.SCRIPT_TASK]:
			permissions.add(Permission.READ)
		
		return permissions
	
	async def _monitor_workflow_executions(self):
		"""Background task to monitor workflow executions."""
		while True:
			try:
				await asyncio.sleep(30)  # Check every 30 seconds
				
				current_time = datetime.now()
				
				async with self._lock:
					for execution in self.active_executions.values():
						if execution.status not in [WorkflowExecutionStatus.RUNNING, WorkflowExecutionStatus.WAITING]:
							continue
						
						# Check for task timeouts
						for task_id in execution.current_tasks:
							task_execution = self.task_executions.get(task_id)
							if not task_execution or not task_execution.started_at:
								continue
							
							# Check timeout
							if task_execution.node.timeout_seconds:
								elapsed = (current_time - task_execution.started_at).total_seconds()
								if elapsed > task_execution.node.timeout_seconds:
									# Handle timeout
									await self._handle_task_timeout(execution, task_execution)
							
							# Check escalation
							if task_execution.node.escalation_delay_hours:
								elapsed_hours = (current_time - task_execution.started_at).total_seconds() / 3600
								if elapsed_hours > task_execution.node.escalation_delay_hours and not task_execution.escalated:
									await self._escalate_task(execution, task_execution)
				
			except Exception as e:
				logger.error(f"Error in workflow execution monitoring: {e}")
				await asyncio.sleep(60)
	
	async def _handle_task_timeout(self, execution: WorkflowExecution, task_execution: TaskExecution):
		"""Handle task timeout."""
		logger.warning(f"Task {task_execution.task_id} timed out in execution {execution.execution_id}")
		
		if task_execution.retry_count < task_execution.node.retry_count:
			# Retry task
			task_execution.retry_count += 1
			task_execution.started_at = datetime.now()
			
			await self._notify_workflow_event(WorkflowEvent(
				execution_id=execution.execution_id,
				event_type="task_retried",
				event_data={
					"task_id": task_execution.task_id,
					"retry_count": task_execution.retry_count
				}
			))
		else:
			# Mark as failed
			task_execution.status = TaskStatus.FAILED
			task_execution.error_message = "Task timeout"
			execution.failed_tasks.append(task_execution.task_id)
			
			if task_execution.task_id in execution.current_tasks:
				execution.current_tasks.remove(task_execution.task_id)
			
			await self._notify_workflow_event(WorkflowEvent(
				execution_id=execution.execution_id,
				event_type="task_failed",
				event_data={
					"task_id": task_execution.task_id,
					"reason": "timeout"
				}
			))
	
	async def _escalate_task(self, execution: WorkflowExecution, task_execution: TaskExecution):
		"""Escalate task to additional users."""
		if not task_execution.node.escalation_users:
			return
		
		task_execution.escalated = True
		
		# Add escalation users to task assignment
		original_users = task_execution.assigned_users.copy()
		task_execution.assigned_users.extend(task_execution.node.escalation_users)
		
		# Grant permissions to escalation users
		for user_id in task_execution.node.escalation_users:
			for permission in task_execution.required_permissions:
				await self.permissions_manager.grant_permission(
					user_id=user_id,
					permission=permission,
					scope=PermissionScope.DOCUMENT,
					target_id=execution.document_id,
					granted_by=execution.initiated_by,
					reason=f"Task escalation: {task_execution.node.name}"
				)
		
		logger.info(f"Escalated task {task_execution.task_id} to {task_execution.node.escalation_users}")
		
		await self._notify_workflow_event(WorkflowEvent(
			execution_id=execution.execution_id,
			event_type="task_escalated",
			event_data={
				"task_id": task_execution.task_id,
				"original_users": original_users,
				"escalation_users": task_execution.node.escalation_users
			}
		))
	
	async def _notify_workflow_event(self, event: WorkflowEvent):
		"""Notify subscribers of workflow events."""
		for callback in self.workflow_subscribers:
			try:
				if asyncio.iscoroutinefunction(callback):
					await callback(event)
				else:
					callback(event)
			except Exception as e:
				logger.error(f"Error in workflow event callback: {e}")
	
	async def cleanup(self):
		"""Clean up workflow integration resources."""
		await self.stop_monitoring()
		
		async with self._lock:
			# Clean up collaborative editors
			for editor in self.collaborative_editors.values():
				await editor.cleanup()
			
			self.active_executions.clear()
			self.task_executions.clear()
			self.collaborative_editors.clear()
			self.workflow_subscribers.clear()
		
		logger.info("CollaborationWorkflowIntegrator cleaned up")