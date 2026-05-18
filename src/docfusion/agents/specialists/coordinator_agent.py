from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
from ..core.agent import Agent, AgentConfig, AgentCapabilities
from ..core.messages import AgentMessage, MessageType, MessageTemplates
"""
Coordinator Agent

Specialized agent for project coordination, task orchestration, and team
management in multi-agent proposal generation workflows.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""




class TaskStatus(str, Enum):
	"""Task status enumeration"""
	PENDING = "pending"
	ASSIGNED = "assigned"
	IN_PROGRESS = "in_progress"
	COMPLETED = "completed"
	FAILED = "failed"
	CANCELLED = "cancelled"


class WorkflowPhase(str, Enum):
	"""Workflow phase enumeration"""
	PLANNING = "planning"
	RESEARCH = "research"
	WRITING = "writing"
	REVIEW = "review"
	FINALIZATION = "finalization"
	COMPLETE = "complete"


@dataclass
class CoordinationTask:
	"""Coordination task specification"""
	task_id: str
	workflow_id: str
	task_type: str
	description: str
	assigned_agent: Optional[str] = None
	status: TaskStatus = TaskStatus.PENDING
	priority: str = "medium"
	dependencies: List[str] = None
	deadline: Optional[datetime] = None
	estimated_duration: Optional[timedelta] = None


@dataclass
class WorkflowDefinition:
	"""Workflow definition and structure"""
	workflow_id: str
	name: str
	description: str
	phases: List[WorkflowPhase]
	tasks: List[CoordinationTask]
	agents_required: List[str]
	success_criteria: Dict[str, Any]


@dataclass
class CoordinationResult:
	"""Coordination operation result"""
	operation: str
	success: bool
	workflow_status: Dict[str, Any]
	task_assignments: Dict[str, str]
	next_actions: List[str]
	issues: List[str]
	metrics: Dict[str, float]


class CoordinatorAgent(Agent[CoordinationTask]):
	"""
	Specialized coordination agent for workflow and task management
	
	Capabilities:
	- Workflow orchestration and management
	- Task assignment and tracking
	- Agent coordination and communication
	- Progress monitoring and reporting
	- Resource allocation and optimization
	- Issue escalation and resolution
	"""
	
	def __init__(self, config: Optional[AgentConfig] = None):
		if config is None:
			config = self._create_default_config()
		
		super().__init__(config)
		
		# Coordination-specific state
		self.active_workflows: Dict[str, WorkflowDefinition] = {}
		self.agent_registry: Dict[str, Dict[str, Any]] = {}
		self.task_assignments: Dict[str, str] = {}  # task_id -> agent_id
		self.workflow_templates: Dict[str, WorkflowDefinition] = {}
		
		# Coordination metrics
		self.coordination_metrics = {
			"workflows_managed": 0,
			"tasks_coordinated": 0,
			"successful_completions": 0,
			"average_completion_time": 0.0,
			"agent_utilization": {}
		}
		
		# Initialize workflow templates
		self._load_workflow_templates()
		self._setup_coordinator_goals()
		
		self.logger.info(f"Coordinator Agent {self.name} initialized")
	
	def _create_default_config(self) -> AgentConfig:
		"""Create default configuration for coordinator agent"""
		return AgentConfig(
			name="Project Coordinator",
			description="Workflow orchestration and team coordination specialist",
			primary_role="coordinator",
			capabilities=AgentCapabilities(
				max_concurrent_tasks=6,
				expertise_domains=["workflow_coordination", "team_management", "process_optimization"],
				supported_task_types=["coordination", "workflow_management", "task_assignment"],
				quality_threshold=0.85
			),
			personality_traits={
				"organization": 0.95,
				"leadership": 0.9,
				"communication": 0.95,
				"problem_solving": 0.85
			},
			creativity_level=0.7,
			risk_tolerance=0.4,
			# LLM configuration optimized for coordination and communication
			llm_model="qwen2.5:1.5b",
			llm_temperature=0.6,  # Moderate temperature for balanced coordination
			llm_max_tokens=2048
		)
	
	def _setup_coordinator_goals(self) -> None:
		"""Set up coordinator-specific goals"""
		self.set_goal("workflow_efficiency", "Optimize workflow completion times", 0.85)
		self.set_goal("task_success_rate", "Maintain high task completion rate", 0.95)
		self.set_goal("agent_utilization", "Optimize agent resource utilization", 0.8)
		self.set_goal("stakeholder_satisfaction", "Ensure stakeholder satisfaction", 0.9)
	
	def _load_workflow_templates(self) -> None:
		"""Load predefined workflow templates"""
		# Proposal generation workflow
		proposal_workflow = WorkflowDefinition(
			workflow_id="proposal_generation",
			name="Proposal Generation Workflow",
			description="Complete proposal generation from research to final review",
			phases=[
				WorkflowPhase.PLANNING,
				WorkflowPhase.RESEARCH,
				WorkflowPhase.WRITING,
				WorkflowPhase.REVIEW,
				WorkflowPhase.FINALIZATION
			],
			tasks=[
				CoordinationTask(
					task_id="research_phase",
					workflow_id="proposal_generation",
					task_type="research",
					description="Conduct comprehensive research for proposal",
					priority="high"
				),
				CoordinationTask(
					task_id="content_writing",
					workflow_id="proposal_generation",
					task_type="writing",
					description="Write proposal content based on research",
					dependencies=["research_phase"],
					priority="high"
				),
				CoordinationTask(
					task_id="quality_review",
					workflow_id="proposal_generation",
					task_type="review",
					description="Review content quality and compliance",
					dependencies=["content_writing"],
					priority="high"
				),
				CoordinationTask(
					task_id="final_review",
					workflow_id="proposal_generation",
					task_type="review",
					description="Final review and approval",
					dependencies=["quality_review"],
					priority="critical"
				)
			],
			agents_required=["researcher", "writer", "reviewer"],
			success_criteria={
				"all_tasks_completed": True,
				"quality_threshold": 0.85,
				"timeline_adherence": True
			}
		)
		
		self.workflow_templates["proposal_generation"] = proposal_workflow
	
	# Core agent implementation
	
	async def process_task(self, task: CoordinationTask) -> CoordinationResult:
		"""Process a coordination task"""
		self.logger.info(f"Processing coordination task: {task.task_type}")
		
		try:
			if task.task_type == "workflow_start":
				result = await self._start_workflow(task)
			elif task.task_type == "task_assignment":
				result = await self._assign_task(task)
			elif task.task_type == "progress_monitoring":
				result = await self._monitor_progress(task)
			elif task.task_type == "issue_resolution":
				result = await self._resolve_issue(task)
			else:
				result = await self._coordinate_general_task(task)
			
			await self._update_coordination_metrics(task, result)
			
			self.logger.info(f"Coordination task completed: {result.success}")
			return result
			
		except Exception as e:
			self.logger.error(f"Coordination task failed: {e}")
			raise
	
	async def handle_message(self, message: AgentMessage) -> Optional[AgentMessage]:
		"""Handle incoming messages"""
		message_type = message.header.message_type
		
		if message_type == MessageType.TASK_REQUEST:
			return await self._handle_coordination_request(message)
		elif message_type == MessageType.STATUS_REPORT:
			return await self._handle_status_report(message)
		elif message_type == MessageType.WORKFLOW_START:
			return await self._handle_workflow_start(message)
		elif message_type == MessageType.STATUS_REQUEST:
			return await self._handle_status_request(message)
		else:
			return None
	
	def get_capabilities(self) -> List[str]:
		"""Return coordinator agent capabilities"""
		return [
			"workflow_orchestration",
			"task_assignment",
			"progress_monitoring",
			"team_coordination",
			"resource_allocation",
			"issue_resolution",
			"stakeholder_communication",
			"performance_optimization"
		]
	
	async def evaluate_task_fit(self, task: CoordinationTask) -> float:
		"""Evaluate how well this agent fits a coordination task"""
		if not isinstance(task, CoordinationTask):
			return 0.0
		
		base_fit = 0.9
		
		# Coordination tasks are our specialty
		coordination_tasks = ["workflow_start", "task_assignment", "progress_monitoring", "issue_resolution"]
		if task.task_type in coordination_tasks:
			base_fit *= 1.0
		else:
			base_fit *= 0.8
		
		return base_fit
	
	# Coordination method implementations
	
	async def _start_workflow(self, task: CoordinationTask) -> CoordinationResult:
		"""Start a new workflow"""
		workflow_id = task.workflow_id
		
		if workflow_id in self.workflow_templates:
			workflow = self.workflow_templates[workflow_id]
			self.active_workflows[workflow_id] = workflow
			
			# Initialize task tracking
			for workflow_task in workflow.tasks:
				self.task_assignments[workflow_task.task_id] = None
			
			# Find and assign agents
			agent_assignments = await self._assign_workflow_agents(workflow)
			
			self.coordination_metrics["workflows_managed"] += 1
			
			return CoordinationResult(
				operation="workflow_start",
				success=True,
				workflow_status={"phase": WorkflowPhase.PLANNING, "progress": 0.0},
				task_assignments=agent_assignments,
				next_actions=["Begin research phase", "Coordinate with assigned agents"],
				issues=[],
				metrics={"agents_assigned": len(agent_assignments)}
			)
		else:
			return CoordinationResult(
				operation="workflow_start",
				success=False,
				workflow_status={},
				task_assignments={},
				next_actions=[],
				issues=[f"Workflow template '{workflow_id}' not found"],
				metrics={}
			)
	
	async def _assign_task(self, task: CoordinationTask) -> CoordinationResult:
		"""Assign a task to an appropriate agent"""
		# Find best agent for task
		best_agent = await self._find_best_agent_for_task(task)
		
		if best_agent:
			self.task_assignments[task.task_id] = best_agent
			task.assigned_agent = best_agent
			task.status = TaskStatus.ASSIGNED
			
			# Send task to agent (would integrate with message bus)
			await self._send_task_to_agent(task, best_agent)
			
			self.coordination_metrics["tasks_coordinated"] += 1
			
			return CoordinationResult(
				operation="task_assignment",
				success=True,
				workflow_status={},
				task_assignments={task.task_id: best_agent},
				next_actions=[f"Monitor task progress for {task.task_id}"],
				issues=[],
				metrics={"assignment_time": datetime.now().isoformat()}
			)
		else:
			return CoordinationResult(
				operation="task_assignment",
				success=False,
				workflow_status={},
				task_assignments={},
				next_actions=["Find alternative agent", "Escalate resource shortage"],
				issues=["No suitable agent found for task"],
				metrics={}
			)
	
	async def _monitor_progress(self, task: CoordinationTask) -> CoordinationResult:
		"""Monitor workflow and task progress"""
		workflow_id = task.workflow_id
		
		if workflow_id not in self.active_workflows:
			return CoordinationResult(
				operation="progress_monitoring",
				success=False,
				workflow_status={},
				task_assignments={},
				next_actions=[],
				issues=[f"Workflow {workflow_id} not found"],
				metrics={}
			)
		
		workflow = self.active_workflows[workflow_id]
		
		# Calculate progress
		completed_tasks = sum(1 for t in workflow.tasks if t.status == TaskStatus.COMPLETED)
		total_tasks = len(workflow.tasks)
		progress = completed_tasks / total_tasks if total_tasks > 0 else 0.0
		
		# Identify blocked tasks
		blocked_tasks = [t for t in workflow.tasks if t.status == TaskStatus.PENDING and self._are_dependencies_met(t)]
		
		# Determine current phase
		current_phase = self._determine_current_phase(workflow)
		
		next_actions = []
		if blocked_tasks:
			next_actions.append(f"Assign {len(blocked_tasks)} ready tasks")
		if progress > 0.8:
			next_actions.append("Prepare for workflow completion")
		
		return CoordinationResult(
			operation="progress_monitoring",
			success=True,
			workflow_status={
				"phase": current_phase,
				"progress": progress,
				"completed_tasks": completed_tasks,
				"total_tasks": total_tasks
			},
			task_assignments=self.task_assignments,
			next_actions=next_actions,
			issues=[],
			metrics={"progress_percentage": progress * 100}
		)
	
	async def _resolve_issue(self, task: CoordinationTask) -> CoordinationResult:
		"""Resolve workflow or task issues"""
		issue_type = task.description
		
		resolution_actions = []
		success = True
		
		if "agent_unavailable" in issue_type:
			resolution_actions.append("Reassign task to alternative agent")
		elif "deadline_risk" in issue_type:
			resolution_actions.append("Adjust timeline or increase resources")
		elif "quality_concern" in issue_type:
			resolution_actions.append("Schedule additional review cycle")
		else:
			resolution_actions.append("Escalate issue to stakeholders")
			success = False
		
		return CoordinationResult(
			operation="issue_resolution",
			success=success,
			workflow_status={},
			task_assignments={},
			next_actions=resolution_actions,
			issues=[issue_type] if not success else [],
			metrics={"resolution_time": datetime.now().isoformat()}
		)
	
	async def _coordinate_general_task(self, task: CoordinationTask) -> CoordinationResult:
		"""Handle general coordination tasks"""
		return CoordinationResult(
			operation="general_coordination",
			success=True,
			workflow_status={},
			task_assignments={},
			next_actions=["Continue monitoring workflow progress"],
			issues=[],
			metrics={}
		)
	
	# Helper methods
	
	async def _assign_workflow_agents(self, workflow: WorkflowDefinition) -> Dict[str, str]:
		"""Assign agents to workflow tasks"""
		assignments = {}
		
		for task in workflow.tasks:
			agent_id = await self._find_best_agent_for_task(task)
			if agent_id:
				assignments[task.task_id] = agent_id
				self.task_assignments[task.task_id] = agent_id
		
		return assignments
	
	async def _find_best_agent_for_task(self, task: CoordinationTask) -> Optional[str]:
		"""Find the best agent for a specific task"""
		# Task type to agent type mapping
		agent_preferences = {
			"research": ["researcher", "research_agent"],
			"writing": ["writer", "writer_agent", "content_creator"],
			"review": ["reviewer", "reviewer_agent", "quality_assurer"],
			"analysis": ["analyst", "analysis_agent"]
		}
		
		preferred_types = agent_preferences.get(task.task_type, [])
		
		# Find available agents of preferred types
		available_agents = []
		for agent_type in preferred_types:
			if agent_type in self.agent_registry:
				agent_info = self.agent_registry[agent_type]
				if agent_info.get("available", True):
					available_agents.append(agent_type)
		
		# Return first available agent (simplified selection)
		return available_agents[0] if available_agents else None
	
	async def _send_task_to_agent(self, task: CoordinationTask, agent_id: str) -> bool:
		"""Send task assignment to agent"""
		# This would integrate with the message bus to send task to agent
		self.logger.info(f"Task {task.task_id} assigned to agent {agent_id}")
		return True
	
	def _are_dependencies_met(self, task: CoordinationTask) -> bool:
		"""Check if task dependencies are completed"""
		if not task.dependencies:
			return True
		
		workflow = self.active_workflows.get(task.workflow_id)
		if not workflow:
			return False
		
		for dep_id in task.dependencies:
			dep_task = next((t for t in workflow.tasks if t.task_id == dep_id), None)
			if not dep_task or dep_task.status != TaskStatus.COMPLETED:
				return False
		
		return True
	
	def _determine_current_phase(self, workflow: WorkflowDefinition) -> WorkflowPhase:
		"""Determine current workflow phase"""
		# Simplified phase determination
		completed_tasks = sum(1 for t in workflow.tasks if t.status == TaskStatus.COMPLETED)
		total_tasks = len(workflow.tasks)
		
		if completed_tasks == 0:
			return WorkflowPhase.PLANNING
		elif completed_tasks < total_tasks * 0.3:
			return WorkflowPhase.RESEARCH
		elif completed_tasks < total_tasks * 0.6:
			return WorkflowPhase.WRITING
		elif completed_tasks < total_tasks * 0.9:
			return WorkflowPhase.REVIEW
		elif completed_tasks < total_tasks:
			return WorkflowPhase.FINALIZATION
		else:
			return WorkflowPhase.COMPLETE
	
	# Message handling
	
	async def _handle_coordination_request(self, message: AgentMessage) -> AgentMessage:
		"""Handle coordination request"""
		try:
			task_data = message.payload.content
			
			coordination_task = CoordinationTask(
				task_id=message.header.message_id,
				workflow_id=task_data.get("workflow_id", ""),
				task_type=task_data.get("task_type", "general"),
				description=task_data.get("description", "")
			)
			
			result = await self.process_task(coordination_task)
			
			return MessageTemplates.task_response(
				sender_id=self.agent_id,
				recipient_id=message.header.sender_id,
				result=result.__dict__,
				original_message_id=message.header.message_id
			)
			
		except Exception as e:
			return MessageTemplates.error_report(
				sender_id=self.agent_id,
				recipient_id=message.header.sender_id,
				error_info={"error": str(e)}
			)
	
	async def _handle_status_report(self, message: AgentMessage) -> Optional[AgentMessage]:
		"""Handle status report from other agents"""
		status_data = message.payload.content
		agent_id = message.header.sender_id
		
		# Update agent registry with status
		self.agent_registry[agent_id] = {
			"status": status_data.get("status", "unknown"),
			"available": status_data.get("available", True),
			"current_tasks": status_data.get("active_tasks", 0),
			"last_update": datetime.now()
		}
		
		self.logger.debug(f"Updated status for agent {agent_id}")
		return None  # No response needed
	
	async def _handle_workflow_start(self, message: AgentMessage) -> AgentMessage:
		"""Handle workflow start request"""
		workflow_data = message.payload.content
		
		task = CoordinationTask(
			task_id=message.header.message_id,
			workflow_id=workflow_data.get("workflow_id", ""),
			task_type="workflow_start",
			description=f"Start workflow: {workflow_data.get('workflow_name', '')}"
		)
		
		result = await self.process_task(task)
		
		return MessageTemplates.task_response(
			sender_id=self.agent_id,
			recipient_id=message.header.sender_id,
			result=result.__dict__,
			original_message_id=message.header.message_id
		)
	
	async def _handle_status_request(self, message: AgentMessage) -> AgentMessage:
		"""Handle status request"""
		status_data = {
			"agent_status": self.get_health_status(),
			"active_workflows": list(self.active_workflows.keys()),
			"coordination_metrics": self.coordination_metrics,
			"registered_agents": len(self.agent_registry),
			"workflow_templates": list(self.workflow_templates.keys())
		}
		
		return MessageTemplates.task_response(
			sender_id=self.agent_id,
			recipient_id=message.header.sender_id,
			result=status_data,
			original_message_id=message.header.message_id
		)
	
	async def _update_coordination_metrics(self, task: CoordinationTask, result: CoordinationResult) -> None:
		"""Update coordination performance metrics"""
		if result.success:
			self.coordination_metrics["successful_completions"] += 1
		
		# Update goal progress
		if result.operation == "workflow_start" and result.success:
			self.update_goal_progress("workflow_efficiency", 0.8)  # Initial workflow setup
		elif result.operation == "task_assignment" and result.success:
			self.update_goal_progress("agent_utilization", 0.85)
	
	# Public interface methods
	
	async def start_proposal_workflow(self, workflow_params: Dict[str, Any]) -> CoordinationResult:
		"""Public method to start proposal generation workflow"""
		task = CoordinationTask(
			task_id=f"start_workflow_{hash(str(workflow_params))}",
			workflow_id="proposal_generation",
			task_type="workflow_start",
			description="Start proposal generation workflow"
		)
		
		return await self.process_task(task)
	
	def register_agent(self, agent_id: str, agent_info: Dict[str, Any]) -> None:
		"""Register an agent in the coordination system"""
		self.agent_registry[agent_id] = {
			**agent_info,
			"registered_at": datetime.now(),
			"available": True
		}
		
		self.logger.info(f"Registered agent: {agent_id}")
	
	def get_workflow_status(self, workflow_id: str) -> Optional[Dict[str, Any]]:
		"""Get status of a specific workflow"""
		if workflow_id in self.active_workflows:
			workflow = self.active_workflows[workflow_id]
			
			completed_tasks = sum(1 for t in workflow.tasks if t.status == TaskStatus.COMPLETED)
			total_tasks = len(workflow.tasks)
			progress = completed_tasks / total_tasks if total_tasks > 0 else 0.0
			
			return {
				"workflow_id": workflow_id,
				"name": workflow.name,
				"phase": self._determine_current_phase(workflow),
				"progress": progress,
				"completed_tasks": completed_tasks,
				"total_tasks": total_tasks,
				"agents_assigned": len([a for a in self.task_assignments.values() if a])
			}
		
		return None
	
	def get_coordination_metrics(self) -> Dict[str, Any]:
		"""Get coordination performance metrics"""
		return self.coordination_metrics.copy()
