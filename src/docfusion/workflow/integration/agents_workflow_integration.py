#!/usr/bin/env python3
"""
Agents-Workflow Integration Layer

Comprehensive integration between the workflow automation system and the 
multi-agent system, enabling seamless coordination of agent-driven document 
creation processes with intelligent workflow management.

This module provides:
- Agent-workflow orchestration
- Task scheduling with agent capabilities 
- Agent performance monitoring within workflows
- Collaborative agent workflow patterns
- Agent specialization for workflow tasks
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
from pydantic import BaseModel, ConfigDict

# Import workflow components
from ..coordination.task_coordinator import TaskCoordinator, TaskAssignment
from ..coordination.deadline_manager import DeadlineManager
from ..monitoring.workflow_monitor import WorkflowMonitor

# Import agent system components
from ...agents.core.agent import Agent, AgentState, AgentConfig, AgentCapabilities
from ...agents.orchestration.task_orchestrator import TaskOrchestrator
from ...agents.orchestration.crew_manager import AgentCrew, CrewConfig
from ...agents.orchestration.swarm_manager import AgentSwarm
from ...agents.specialists.writer_agent import WriterAgent
from ...agents.specialists.research_agent import ResearchAgent
from ...agents.specialists.quality_agent import QualityAgent
from ...agents.specialists.reviewer_agent import ReviewerAgent
from ...agents.specialists.compliance_agent import ComplianceAgent
from ...core.utils import uuid7str

class AgentWorkflowRole(str, Enum):
	"""Agent roles within workflow execution"""
	CONTENT_CREATOR = "content_creator"
	RESEARCHER = "researcher"
	REVIEWER = "reviewer"
	QUALITY_ASSURANCE = "quality_assurance"
	COMPLIANCE_CHECKER = "compliance_checker"
	COORDINATOR = "coordinator"
	EDITOR = "editor"
	LAYOUT_SPECIALIST = "layout_specialist"
	WORKFLOW_MONITOR = "workflow_monitor"

class AgentTaskType(str, Enum):
	"""Types of tasks agents can perform in workflows"""
	RESEARCH_TASK = "research_task"
	CONTENT_GENERATION = "content_generation"
	CONTENT_REVIEW = "content_review"
	QUALITY_CHECK = "quality_check"
	COMPLIANCE_VALIDATION = "compliance_validation"
	DOCUMENT_ASSEMBLY = "document_assembly"
	FORMATTING = "formatting"
	COLLABORATION = "collaboration"
	WORKFLOW_COORDINATION = "workflow_coordination"

class AgentWorkflowStatus(str, Enum):
	"""Status of agent within workflow"""
	AVAILABLE = "available"
	ASSIGNED = "assigned"
	WORKING = "working"
	WAITING_FOR_INPUT = "waiting_for_input"
	COMPLETED_TASK = "completed_task"
	ERROR_STATE = "error_state"
	OFFLINE = "offline"

@dataclass
class AgentCapabilityMapping:
	"""Maps agent capabilities to workflow requirements"""
	agent_id: str
	agent_type: str
	workflow_roles: List[AgentWorkflowRole]
	task_types: List[AgentTaskType]
	specializations: List[str]
	performance_metrics: Dict[str, float] = field(default_factory=dict)
	availability_schedule: Optional[Dict[str, Any]] = None
	max_concurrent_tasks: int = 3
	preferred_collaboration_patterns: List[str] = field(default_factory=list)

@dataclass
class WorkflowAgentAssignment:
	"""Agent assignment within a workflow"""
	assignment_id: str = field(default_factory=uuid7str)
	workflow_id: str = ""
	agent_id: str = ""
	role: AgentWorkflowRole = AgentWorkflowRole.CONTENT_CREATOR
	task_id: Optional[str] = None
	status: AgentWorkflowStatus = AgentWorkflowStatus.AVAILABLE
	assigned_at: datetime = field(default_factory=datetime.now)
	started_at: Optional[datetime] = None
	completed_at: Optional[datetime] = None
	priority: float = 0.5
	constraints: Dict[str, Any] = field(default_factory=dict)
	context: Dict[str, Any] = field(default_factory=dict)

class AgentWorkflowMetrics(BaseModel):
	"""Performance metrics for agents in workflows"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	agent_id: str
	workflow_id: str
	tasks_completed: int = 0
	tasks_failed: int = 0
	average_completion_time: float = 0.0
	quality_score: float = 0.0
	collaboration_effectiveness: float = 0.0
	deadline_adherence: float = 1.0
	resource_utilization: float = 0.0
	error_rate: float = 0.0
	learning_progress: float = 0.0
	user_satisfaction: float = 0.0

class AgentsWorkflowIntegration:
	"""
	Main integration layer between agents and workflow systems
	
	Provides comprehensive orchestration of agent-driven workflows with
	intelligent task assignment, performance monitoring, and collaborative
	coordination patterns.
	"""
	
	def __init__(self, 
				 task_coordinator: TaskCoordinator,
				 deadline_manager: DeadlineManager,
				 workflow_monitor: WorkflowMonitor,
				 task_orchestrator: Optional[TaskOrchestrator] = None):
		"""Initialize agents-workflow integration"""
		self.task_coordinator = task_coordinator
		self.deadline_manager = deadline_manager
		self.workflow_monitor = workflow_monitor
		self.task_orchestrator = task_orchestrator
		
		# Agent management
		self.active_agents: Dict[str, Agent] = {}
		self.agent_capabilities: Dict[str, AgentCapabilityMapping] = {}
		self.workflow_assignments: Dict[str, List[WorkflowAgentAssignment]] = {}
		
		# Agent collections
		self.agent_crews: Dict[str, AgentCrew] = {}
		self.agent_swarms: Dict[str, AgentSwarm] = {}
		
		# Performance tracking
		self.agent_metrics: Dict[str, AgentWorkflowMetrics] = {}
		self.workflow_performance: Dict[str, Dict[str, Any]] = {}
		
		# Integration state
		self.integration_active = False
		self.background_tasks: List[asyncio.Task] = []
		
		self.logger = logging.getLogger(__name__)
		self.logger.info("Agents-Workflow integration initialized")
	
	async def start_integration(self) -> None:
		"""Start the agents-workflow integration system"""
		if self.integration_active:
			return
		
		self.integration_active = True
		
		# Start background monitoring and coordination tasks
		self.background_tasks = [
			asyncio.create_task(self._monitor_agent_performance()),
			asyncio.create_task(self._coordinate_workflow_agents()),
			asyncio.create_task(self._manage_agent_health()),
			asyncio.create_task(self._optimize_agent_assignments())
		]
		
		self.logger.info("Agents-Workflow integration started")
	
	async def stop_integration(self) -> None:
		"""Stop the agents-workflow integration system"""
		if not self.integration_active:
			return
		
		self.integration_active = False
		
		# Cancel background tasks
		for task in self.background_tasks:
			task.cancel()
		
		# Wait for tasks to complete
		await asyncio.gather(*self.background_tasks, return_exceptions=True)
		
		# Stop all agents gracefully
		for agent in self.active_agents.values():
			await agent.stop()
		
		self.logger.info("Agents-Workflow integration stopped")
	
	# ==================== AGENT REGISTRATION AND MANAGEMENT ====================
	
	async def register_workflow_agent(self, 
									  agent: Agent, 
									  capabilities: AgentCapabilityMapping) -> bool:
		"""Register an agent for workflow participation"""
		try:
			# Validate agent and capabilities
			if not await self._validate_agent_for_workflow(agent, capabilities):
				return False
			
			# Register agent
			self.active_agents[agent.agent_id] = agent
			self.agent_capabilities[agent.agent_id] = capabilities
			
			# Initialize metrics
			self.agent_metrics[agent.agent_id] = AgentWorkflowMetrics(
				agent_id=agent.agent_id,
				workflow_id="global"  # Will be updated per workflow
			)
			
			# Start agent if not already running
			if agent.state != AgentState.ACTIVE:
				await agent.start()
			
			self.logger.info(f"Registered workflow agent: {agent.name} ({agent.agent_id})")
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to register workflow agent: {e}")
			return False
	
	async def create_specialist_agents(self) -> Dict[str, Agent]:
		"""Create and register specialized agents for workflow tasks"""
		specialists = {}
		
		try:
			# Create writer agent
			writer_config = AgentConfig(
				name="Workflow Writer",
				description="Specialized content creation agent for document workflows",
				primary_role="content_writer",
				capabilities=AgentCapabilities(
					max_concurrent_tasks=5,
					supported_task_types=["content_generation", "editing", "formatting"],
					expertise_domains=["technical_writing", "business_communication", "proposal_writing"]
				)
			)
			writer_agent = WriterAgent(writer_config)
			
			writer_capabilities = AgentCapabilityMapping(
				agent_id=writer_agent.agent_id,
				agent_type="WriterAgent",
				workflow_roles=[AgentWorkflowRole.CONTENT_CREATOR, AgentWorkflowRole.EDITOR],
				task_types=[AgentTaskType.CONTENT_GENERATION, AgentTaskType.FORMATTING],
				specializations=["technical_writing", "business_proposals"],
				max_concurrent_tasks=5
			)
			
			if await self.register_workflow_agent(writer_agent, writer_capabilities):
				specialists["writer"] = writer_agent
			
			# Create research agent
			research_config = AgentConfig(
				name="Workflow Researcher",
				description="Specialized research agent for gathering and analyzing information",
				primary_role="researcher",
				capabilities=AgentCapabilities(
					max_concurrent_tasks=3,
					supported_task_types=["research", "analysis", "data_gathering"],
					expertise_domains=["market_research", "competitive_analysis", "technical_research"]
				)
			)
			research_agent = ResearchAgent(research_config)
			
			research_capabilities = AgentCapabilityMapping(
				agent_id=research_agent.agent_id,
				agent_type="ResearchAgent",
				workflow_roles=[AgentWorkflowRole.RESEARCHER],
				task_types=[AgentTaskType.RESEARCH_TASK],
				specializations=["market_analysis", "technical_research"],
				max_concurrent_tasks=3
			)
			
			if await self.register_workflow_agent(research_agent, research_capabilities):
				specialists["researcher"] = research_agent
			
			# Create quality assurance agent
			qa_config = AgentConfig(
				name="Workflow QA",
				description="Quality assurance agent for workflow output validation",
				primary_role="quality_assurance",
				capabilities=AgentCapabilities(
					max_concurrent_tasks=4,
					supported_task_types=["quality_check", "validation", "testing"],
					expertise_domains=["document_quality", "compliance_checking", "error_detection"]
				)
			)
			qa_agent = QualityAgent(qa_config)
			
			qa_capabilities = AgentCapabilityMapping(
				agent_id=qa_agent.agent_id,
				agent_type="QualityAgent", 
				workflow_roles=[AgentWorkflowRole.QUALITY_ASSURANCE],
				task_types=[AgentTaskType.QUALITY_CHECK],
				specializations=["quality_assurance", "compliance_validation"],
				max_concurrent_tasks=4
			)
			
			if await self.register_workflow_agent(qa_agent, qa_capabilities):
				specialists["quality"] = qa_agent
			
			# Create reviewer agent
			reviewer_config = AgentConfig(
				name="Workflow Reviewer",
				description="Document review and feedback agent",
				primary_role="reviewer",
				capabilities=AgentCapabilities(
					max_concurrent_tasks=3,
					supported_task_types=["review", "feedback", "approval"],
					expertise_domains=["document_review", "editorial_review", "technical_review"]
				)
			)
			reviewer_agent = ReviewerAgent(reviewer_config)
			
			reviewer_capabilities = AgentCapabilityMapping(
				agent_id=reviewer_agent.agent_id,
				agent_type="ReviewerAgent",
				workflow_roles=[AgentWorkflowRole.REVIEWER],
				task_types=[AgentTaskType.CONTENT_REVIEW],
				specializations=["document_review", "technical_editing"],
				max_concurrent_tasks=3
			)
			
			if await self.register_workflow_agent(reviewer_agent, reviewer_capabilities):
				specialists["reviewer"] = reviewer_agent
			
			# Create compliance agent
			compliance_config = AgentConfig(
				name="Workflow Compliance",
				description="Compliance checking and validation agent",
				primary_role="compliance_officer",
				capabilities=AgentCapabilities(
					max_concurrent_tasks=2,
					supported_task_types=["compliance_check", "validation", "audit"],
					expertise_domains=["regulatory_compliance", "security_compliance", "quality_standards"]
				)
			)
			compliance_agent = ComplianceAgent(compliance_config)
			
			compliance_capabilities = AgentCapabilityMapping(
				agent_id=compliance_agent.agent_id,
				agent_type="ComplianceAgent",
				workflow_roles=[AgentWorkflowRole.COMPLIANCE_CHECKER],
				task_types=[AgentTaskType.COMPLIANCE_VALIDATION],
				specializations=["regulatory_compliance", "security_validation"],
				max_concurrent_tasks=2
			)
			
			if await self.register_workflow_agent(compliance_agent, compliance_capabilities):
				specialists["compliance"] = compliance_agent
			
			self.logger.info(f"Created {len(specialists)} specialist agents for workflows")
			return specialists
			
		except Exception as e:
			self.logger.error(f"Failed to create specialist agents: {e}")
			return specialists
	
	# ==================== WORKFLOW-AGENT COORDINATION ====================
	
	async def assign_agents_to_workflow(self, 
										workflow_id: str,
										workflow_requirements: Dict[str, Any]) -> Dict[str, WorkflowAgentAssignment]:
		"""Assign optimal agents to workflow based on requirements"""
		assignments = {}
		
		try:
			# Analyze workflow requirements
			required_roles = workflow_requirements.get('required_roles', [])
			priority = workflow_requirements.get('priority', 0.5)
			
			# Find suitable agents for each required role
			for role_str in required_roles:
				try:
					role = AgentWorkflowRole(role_str)
					suitable_agents = await self._find_agents_for_role(role, workflow_requirements)
					
					if suitable_agents:
						# Select best agent based on performance and availability
						best_agent = await self._select_optimal_agent(suitable_agents, workflow_requirements)
						
						assignment = WorkflowAgentAssignment(
							workflow_id=workflow_id,
							agent_id=best_agent.agent_id,
							role=role,
							status=AgentWorkflowStatus.ASSIGNED,
							priority=priority,
							constraints=workflow_requirements.get('constraints', {}),
							context=workflow_requirements.get('context', {})
						)
						
						assignments[role.value] = assignment
						
						# Register assignment
						if workflow_id not in self.workflow_assignments:
							self.workflow_assignments[workflow_id] = []
						self.workflow_assignments[workflow_id].append(assignment)
						
						self.logger.info(f"Assigned agent {best_agent.name} to role {role.value} in workflow {workflow_id}")
					else:
						self.logger.warning(f"No suitable agents found for role {role.value}")
				
				except ValueError:
					self.logger.warning(f"Invalid workflow role: {role_str}")
			
			# Notify task coordinator about assignments
			await self._notify_task_coordinator_assignments(workflow_id, assignments)
			
			return assignments
			
		except Exception as e:
			self.logger.error(f"Failed to assign agents to workflow: {e}")
			return assignments
	
	async def create_agent_crew_for_workflow(self,
											 workflow_id: str,
											 crew_configuration: Dict[str, Any]) -> Optional[AgentCrew]:
		"""Create specialized agent crew for workflow execution"""
		try:
			# Get assigned agents for this workflow
			workflow_assignments = self.workflow_assignments.get(workflow_id, [])
			
			if not workflow_assignments:
				self.logger.warning(f"No agent assignments found for workflow {workflow_id}")
				return None
			
			# Create crew configuration
			crew_config = CrewConfig(
				name=f"Workflow_Crew_{workflow_id[:8]}",
				description=f"Agent crew for workflow {workflow_id}",
				required_roles=[assignment.role.value for assignment in workflow_assignments],
				max_agents=max(2, min(len(workflow_assignments), 20)),
				collaboration_mode=crew_configuration.get('collaboration_pattern', 'hierarchical'),
				quality_threshold=crew_configuration.get('quality_threshold', 0.8)
			)
			
			# Create crew
			crew = AgentCrew(crew_config)
			
			# Add agents to crew
			for assignment in workflow_assignments:
				agent = self.active_agents.get(assignment.agent_id)
				if agent:
					await crew.add_agent(agent, assignment.role.value)
			
			# Store crew reference
			self.agent_crews[workflow_id] = crew
			
			self.logger.info(f"Created agent crew for workflow {workflow_id} with {len(workflow_assignments)} agents")
			return crew
			
		except Exception as e:
			self.logger.error(f"Failed to create agent crew for workflow: {e}")
			return None
	
	async def execute_workflow_with_agents(self,
										   workflow_id: str,
										   workflow_definition: Dict[str, Any]) -> Dict[str, Any]:
		"""Execute workflow using assigned agents"""
		try:
			# Get workflow assignments
			assignments = self.workflow_assignments.get(workflow_id, [])
			if not assignments:
				raise ValueError(f"No agent assignments found for workflow {workflow_id}")
			
			# Create execution context
			execution_context = {
				'workflow_id': workflow_id,
				'start_time': datetime.now(),
				'agents': {assignment.agent_id: assignment.role.value for assignment in assignments},
				'status': 'executing',
				'results': {}
			}
			
			# Execute based on workflow type
			workflow_type = workflow_definition.get('execution_pattern', 'sequential')
			
			if workflow_type == 'crew_based':
				# Execute using agent crew
				crew = self.agent_crews.get(workflow_id)
				if crew:
					result = await self._execute_crew_workflow(crew, workflow_definition, execution_context)
				else:
					result = await self._execute_direct_agent_workflow(assignments, workflow_definition, execution_context)
			
			elif workflow_type == 'swarm_based':
				# Execute using agent swarm
				swarm = await self._create_workflow_swarm(workflow_id, assignments)
				result = await self._execute_swarm_workflow(swarm, workflow_definition, execution_context)
			
			else:
				# Execute using direct agent coordination
				result = await self._execute_direct_agent_workflow(assignments, workflow_definition, execution_context)
			
			# Update execution context with results
			execution_context.update(result)
			execution_context['end_time'] = datetime.now()
			execution_context['duration'] = (execution_context['end_time'] - execution_context['start_time']).total_seconds()
			execution_context['status'] = 'completed' if result.get('success', False) else 'failed'
			
			# Update performance metrics
			await self._update_workflow_performance_metrics(workflow_id, execution_context)
			
			self.logger.info(f"Completed workflow execution {workflow_id} in {execution_context['duration']:.2f}s")
			return execution_context
			
		except Exception as e:
			self.logger.error(f"Failed to execute workflow with agents: {e}")
			return {
				'workflow_id': workflow_id,
				'status': 'failed',
				'error': str(e),
				'end_time': datetime.now()
			}
	
	# ==================== TASK COORDINATION WITH AGENTS ====================
	
	async def coordinate_agent_tasks(self,
									 workflow_id: str,
									 task_definitions: List[Dict[str, Any]]) -> List[TaskAssignment]:
		"""Coordinate task assignments between workflow system and agents"""
		task_assignments = []
		
		try:
			for task_def in task_definitions:
				# Determine required agent role for task
				task_type = task_def.get('type', 'general')
				required_role = self._map_task_type_to_agent_role(task_type)
				
				# Find appropriate agent
				suitable_agents = await self._find_agents_for_role(required_role, task_def)
				if not suitable_agents:
					self.logger.warning(f"No suitable agents for task type {task_type}")
					continue
				
				# Select optimal agent
				selected_agent = await self._select_optimal_agent(suitable_agents, task_def)
				
				# Create task assignment through task coordinator
				assignment = await self.task_coordinator.assign_task(
					task_id=task_def.get('task_id', uuid7str()),
					assignee_id=selected_agent.agent_id,
					task_type=task_type,
					priority=task_def.get('priority', 0.5),
					requirements=task_def.get('requirements', {}),
					deadline=task_def.get('deadline'),
					workflow_id=workflow_id
				)
				
				if assignment:
					task_assignments.append(assignment)
					
					# Notify agent of task assignment
					await self._notify_agent_of_assignment(selected_agent, assignment, task_def)
			
			self.logger.info(f"Coordinated {len(task_assignments)} agent tasks for workflow {workflow_id}")
			return task_assignments
			
		except Exception as e:
			self.logger.error(f"Failed to coordinate agent tasks: {e}")
			return task_assignments
	
	async def monitor_agent_task_progress(self, workflow_id: str) -> Dict[str, Any]:
		"""Monitor progress of agent tasks within workflow"""
		try:
			task_progress = {}
			
			# Get all task assignments for workflow
			assignments = self.workflow_assignments.get(workflow_id, [])
			
			for assignment in assignments:
				if assignment.task_id:
					# Get progress from task coordinator
					progress = await self.task_coordinator.get_task_progress(assignment.task_id)
					if progress:
						task_progress[assignment.task_id] = progress
					
					# Get additional metrics from agent
					agent = self.active_agents.get(assignment.agent_id)
					if agent:
						agent_metrics = agent.get_metrics()
						# Enhance progress with agent-specific metrics
						if assignment.task_id in task_progress:
							task_progress[assignment.task_id].agent_metrics = {
								'current_load': agent_metrics.current_load,
								'success_rate': agent_metrics.success_rate,
								'average_response_time': agent_metrics.average_response_time
							}
			
			return task_progress
			
		except Exception as e:
			self.logger.error(f"Failed to monitor agent task progress: {e}")
			return {}
	
	# ==================== PERFORMANCE MONITORING AND OPTIMIZATION ====================
	
	async def get_agent_workflow_performance(self, 
											 agent_id: Optional[str] = None,
											 workflow_id: Optional[str] = None) -> Dict[str, Any]:
		"""Get comprehensive performance metrics for agents in workflows"""
		try:
			performance_data = {}
			
			if agent_id:
				# Get specific agent performance
				if agent_id in self.agent_metrics:
					performance_data[agent_id] = self.agent_metrics[agent_id].dict()
			else:
				# Get all agent performance
				for aid, metrics in self.agent_metrics.items():
					if workflow_id is None or metrics.workflow_id == workflow_id:
						if aid not in performance_data:
							performance_data[aid] = {}
						performance_data[aid] = metrics.dict()
			
			# Add workflow-specific performance data
			if workflow_id and workflow_id in self.workflow_performance:
				performance_data['workflow_summary'] = self.workflow_performance[workflow_id]
			
			return performance_data
			
		except Exception as e:
			self.logger.error(f"Failed to get agent workflow performance: {e}")
			return {}
	
	async def optimize_agent_assignments(self, workflow_id: str) -> Dict[str, Any]:
		"""Optimize agent assignments for better workflow performance"""
		try:
			optimization_results = {
				'workflow_id': workflow_id,
				'optimizations_applied': [],
				'performance_improvements': {},
				'recommendations': []
			}
			
			# Get current assignments and performance
			current_performance = await self.get_agent_workflow_performance(workflow_id=workflow_id)
			
			# Analyze performance bottlenecks
			bottlenecks = await self._identify_performance_bottlenecks(workflow_id, current_performance)
			
			# Apply optimizations
			for bottleneck in bottlenecks:
				if bottleneck['type'] == 'overloaded_agent':
					# Redistribute tasks from overloaded agent
					optimization = await self._redistribute_agent_tasks(bottleneck['agent_id'], workflow_id)
					optimization_results['optimizations_applied'].append(optimization)
				
				elif bottleneck['type'] == 'skill_mismatch':
					# Reassign tasks to better-suited agents
					optimization = await self._reassign_mismatched_tasks(bottleneck['task_id'], workflow_id)
					optimization_results['optimizations_applied'].append(optimization)
				
				elif bottleneck['type'] == 'communication_overhead':
					# Optimize agent communication patterns
					optimization = await self._optimize_agent_communication(workflow_id)
					optimization_results['optimizations_applied'].append(optimization)
			
			# Generate recommendations for future workflows
			recommendations = await self._generate_optimization_recommendations(workflow_id, current_performance)
			optimization_results['recommendations'] = recommendations
			
			self.logger.info(f"Applied {len(optimization_results['optimizations_applied'])} optimizations to workflow {workflow_id}")
			return optimization_results
			
		except Exception as e:
			self.logger.error(f"Failed to optimize agent assignments: {e}")
			return {'error': str(e)}
	
	# ==================== BACKGROUND MONITORING TASKS ====================
	
	async def _monitor_agent_performance(self) -> None:
		"""Background task to monitor agent performance in workflows"""
		while self.integration_active:
			try:
				for agent_id, agent in self.active_agents.items():
					# Update agent metrics
					agent_metrics = agent.get_metrics()
					
					if agent_id in self.agent_metrics:
						workflow_metrics = self.agent_metrics[agent_id]
						
						# Update workflow-specific metrics
						workflow_metrics.average_completion_time = agent_metrics.average_response_time
						workflow_metrics.error_rate = agent_metrics.errors_encountered / max(agent_metrics.tasks_completed + agent_metrics.tasks_failed, 1)
						workflow_metrics.resource_utilization = agent_metrics.current_load
						
						# Calculate quality score based on success rate and other factors
						workflow_metrics.quality_score = (
							agent_metrics.success_rate * 0.4 +
							(1 - workflow_metrics.error_rate) * 0.3 +
							min(workflow_metrics.deadline_adherence, 1.0) * 0.3
						)
				
				await asyncio.sleep(30)  # Monitor every 30 seconds
				
			except Exception as e:
				self.logger.error(f"Error in agent performance monitoring: {e}")
				await asyncio.sleep(60)
	
	async def _coordinate_workflow_agents(self) -> None:
		"""Background task to coordinate agents across workflows"""
		while self.integration_active:
			try:
				# Check for workflow coordination opportunities
				for workflow_id, assignments in self.workflow_assignments.items():
					# Check for agents waiting for collaboration
					waiting_agents = [a for a in assignments if a.status == AgentWorkflowStatus.WAITING_FOR_INPUT]
					
					if len(waiting_agents) > 1:
						# Facilitate collaboration between waiting agents
						await self._facilitate_agent_collaboration(workflow_id, waiting_agents)
					
					# Check for stuck agents
					stuck_agents = await self._identify_stuck_agents(workflow_id, assignments)
					for agent_assignment in stuck_agents:
						await self._resolve_stuck_agent(agent_assignment)
				
				await asyncio.sleep(45)  # Coordinate every 45 seconds
				
			except Exception as e:
				self.logger.error(f"Error in workflow agent coordination: {e}")
				await asyncio.sleep(60)
	
	async def _manage_agent_health(self) -> None:
		"""Background task to manage agent health and availability"""
		while self.integration_active:
			try:
				for agent_id, agent in self.active_agents.items():
					# Check agent health
					health_status = agent.get_health_status()
					
					if not health_status['is_healthy']:
						self.logger.warning(f"Agent {agent.name} is unhealthy: {health_status}")
						
						# Attempt to recover agent
						try:
							if agent.state == AgentState.ERROR:
								await agent.resume()
						except Exception as recovery_error:
							self.logger.error(f"Failed to recover agent {agent.name}: {recovery_error}")
							
							# Mark agent as offline and reassign tasks
							await self._handle_failed_agent(agent_id)
				
				await asyncio.sleep(60)  # Health check every minute
				
			except Exception as e:
				self.logger.error(f"Error in agent health management: {e}")
				await asyncio.sleep(120)
	
	async def _optimize_agent_assignments(self) -> None:
		"""Background task to continuously optimize agent assignments"""
		while self.integration_active:
			try:
				# Optimize assignments for each active workflow
				for workflow_id in self.workflow_assignments.keys():
					await self.optimize_agent_assignments(workflow_id)
				
				await asyncio.sleep(300)  # Optimize every 5 minutes
				
			except Exception as e:
				self.logger.error(f"Error in agent assignment optimization: {e}")
				await asyncio.sleep(600)
	
	# ==================== HELPER METHODS ====================
	
	async def _validate_agent_for_workflow(self, agent: Agent, capabilities: AgentCapabilityMapping) -> bool:
		"""Validate that agent is suitable for workflow participation"""
		try:
			# Check agent state
			if agent.state == AgentState.TERMINATED:
				return False
			
			# Validate capabilities mapping
			if not capabilities.workflow_roles or not capabilities.task_types:
				return False
			
			# Check agent configuration compatibility
			if not agent.config.capabilities.collaboration_enabled:
				self.logger.warning(f"Agent {agent.name} has collaboration disabled")
			
			return True
			
		except Exception as e:
			self.logger.error(f"Agent validation failed: {e}")
			return False
	
	async def _find_agents_for_role(self, 
									role: AgentWorkflowRole, 
									requirements: Dict[str, Any]) -> List[Agent]:
		"""Find agents capable of fulfilling a specific workflow role"""
		suitable_agents = []
		
		for agent_id, capabilities in self.agent_capabilities.items():
			if role in capabilities.workflow_roles:
				agent = self.active_agents.get(agent_id)
				if agent and agent.state == AgentState.ACTIVE:
					# Check additional requirements
					if self._check_agent_requirements(agent, capabilities, requirements):
						suitable_agents.append(agent)
		
		return suitable_agents
	
	def _check_agent_requirements(self, 
								  agent: Agent, 
								  capabilities: AgentCapabilityMapping,
								  requirements: Dict[str, Any]) -> bool:
		"""Check if agent meets specific requirements"""
		# Check specializations
		required_specializations = requirements.get('specializations', [])
		if required_specializations:
			if not any(spec in capabilities.specializations for spec in required_specializations):
				return False
		
		# Check availability
		if agent.metrics.current_load >= 1.0:  # Agent at capacity
			return False
		
		# Check performance thresholds
		min_quality = requirements.get('min_quality_score', 0.0)
		if agent.metrics.success_rate < min_quality:
			return False
		
		return True
	
	async def _select_optimal_agent(self, 
									suitable_agents: List[Agent], 
									requirements: Dict[str, Any]) -> Agent:
		"""Select the optimal agent from suitable candidates"""
		if not suitable_agents:
			raise ValueError("No suitable agents available")
		
		if len(suitable_agents) == 1:
			return suitable_agents[0]
		
		# Score agents based on multiple criteria
		agent_scores = {}
		
		for agent in suitable_agents:
			score = 0.0
			
			# Performance score (40%)
			score += agent.metrics.success_rate * 0.4
			
			# Availability score (30%)
			availability = 1.0 - agent.metrics.current_load
			score += availability * 0.3
			
			# Response time score (20%)
			max_response_time = 60.0  # seconds
			response_score = max(0, 1 - (agent.metrics.average_response_time / max_response_time))
			score += response_score * 0.2
			
			# Specialization match score (10%)
			agent_capabilities = self.agent_capabilities.get(agent.agent_id)
			if agent_capabilities:
				required_specs = requirements.get('specializations', [])
				if required_specs:
					matches = sum(1 for spec in required_specs if spec in agent_capabilities.specializations)
					spec_score = matches / len(required_specs)
					score += spec_score * 0.1
			
			agent_scores[agent.agent_id] = score
		
		# Return agent with highest score
		best_agent_id = max(agent_scores, key=agent_scores.get)
		return next(agent for agent in suitable_agents if agent.agent_id == best_agent_id)
	
	def _map_task_type_to_agent_role(self, task_type: str) -> AgentWorkflowRole:
		"""Map task type to appropriate agent role"""
		task_role_mapping = {
			'research': AgentWorkflowRole.RESEARCHER,
			'content_generation': AgentWorkflowRole.CONTENT_CREATOR,
			'content_review': AgentWorkflowRole.REVIEWER,
			'quality_check': AgentWorkflowRole.QUALITY_ASSURANCE,
			'compliance_validation': AgentWorkflowRole.COMPLIANCE_CHECKER,
			'editing': AgentWorkflowRole.EDITOR,
			'formatting': AgentWorkflowRole.LAYOUT_SPECIALIST,
			'coordination': AgentWorkflowRole.COORDINATOR
		}
		
		return task_role_mapping.get(task_type, AgentWorkflowRole.CONTENT_CREATOR)
	
	async def _notify_task_coordinator_assignments(self, 
												   workflow_id: str, 
												   assignments: Dict[str, WorkflowAgentAssignment]) -> None:
		"""Notify task coordinator of agent assignments"""
		try:
			assignment_data = {
				'workflow_id': workflow_id,
				'agent_assignments': {
					role: {
						'agent_id': assignment.agent_id,
						'role': assignment.role.value,
						'status': assignment.status.value,
						'priority': assignment.priority
					}
					for role, assignment in assignments.items()
				}
			}
			
			# This would integrate with the task coordinator's assignment tracking
			await self.task_coordinator.register_workflow_assignments(workflow_id, assignment_data)
			
		except Exception as e:
			self.logger.error(f"Failed to notify task coordinator of assignments: {e}")
	
	async def _notify_agent_of_assignment(self, 
										  agent: Agent, 
										  assignment: TaskAssignment, 
										  task_definition: Dict[str, Any]) -> None:
		"""Notify agent of task assignment"""
		try:
			# Create task notification for agent
			task_notification = {
				'assignment_id': assignment.assignment_id,
				'task_id': assignment.task_id,
				'task_type': assignment.task_type,
				'priority': assignment.priority,
				'deadline': assignment.deadline.isoformat() if assignment.deadline else None,
				'requirements': assignment.requirements,
				'workflow_context': task_definition.get('context', {})
			}
			
			# Send notification to agent (this would use the agent's message handling system)
			await agent.message_queue.put(task_notification)
			
		except Exception as e:
			self.logger.error(f"Failed to notify agent of assignment: {e}")
	
	async def _update_workflow_performance_metrics(self, 
												   workflow_id: str, 
												   execution_context: Dict[str, Any]) -> None:
		"""Update performance metrics for workflow execution"""
		try:
			performance_data = {
				'workflow_id': workflow_id,
				'execution_time': execution_context.get('duration', 0),
				'success': execution_context.get('status') == 'completed',
				'agent_count': len(execution_context.get('agents', {})),
				'task_count': len(execution_context.get('results', {})),
				'timestamp': datetime.now(),
				'quality_metrics': execution_context.get('quality_metrics', {}),
				'resource_utilization': execution_context.get('resource_utilization', 0.0)
			}
			
			self.workflow_performance[workflow_id] = performance_data
			
			# Update individual agent metrics for this workflow
			for agent_id in execution_context.get('agents', {}):
				if agent_id in self.agent_metrics:
					agent_metrics = self.agent_metrics[agent_id]
					agent_metrics.workflow_id = workflow_id
					
					if performance_data['success']:
						agent_metrics.tasks_completed += 1
					else:
						agent_metrics.tasks_failed += 1
			
		except Exception as e:
			self.logger.error(f"Failed to update workflow performance metrics: {e}")
	
	# Placeholder implementations for complex workflow execution methods
	async def _execute_crew_workflow(self, crew: AgentCrew, workflow_definition: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
		"""Execute workflow using agent crew"""
		# Implementation would depend on specific crew execution patterns
		return {'success': True, 'execution_type': 'crew_based'}
	
	async def _execute_swarm_workflow(self, swarm: AgentSwarm, workflow_definition: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
		"""Execute workflow using agent swarm"""
		# Implementation would depend on specific swarm execution patterns
		return {'success': True, 'execution_type': 'swarm_based'}
	
	async def _execute_direct_agent_workflow(self, assignments: List[WorkflowAgentAssignment], workflow_definition: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
		"""Execute workflow using direct agent coordination"""
		# Implementation would coordinate agents directly without crew/swarm patterns
		return {'success': True, 'execution_type': 'direct_coordination'}
	
	async def _create_workflow_swarm(self, workflow_id: str, assignments: List[WorkflowAgentAssignment]) -> AgentSwarm:
		"""Create agent swarm for workflow execution"""
		try:
			from ...agents.orchestration.swarm_manager import SwarmConfig, SwarmBehavior

			config = SwarmConfig(
				swarm_id=workflow_id,
				name=f"workflow-{workflow_id}",
				description=f"Swarm for workflow {workflow_id}",
				primary_behavior=SwarmBehavior.COLLABORATIVE,
				target_size=len(assignments),
			)
			swarm = AgentSwarm(config)

			# Add assigned agents to the swarm
			for assignment in assignments:
				agent = self.active_agents.get(assignment.agent_id)
				if agent:
					await swarm.add_agent(agent)

			self.agent_swarms[workflow_id] = swarm
			self.logger.info(f"Created swarm for workflow {workflow_id} with {len(assignments)} agents")
			return swarm
		except Exception as e:
			self.logger.error(f"Failed to create workflow swarm: {e}")
			# Fallback: return a minimal swarm
			return AgentSwarm(SwarmConfig(swarm_id=workflow_id, name=f"workflow-{workflow_id}", description="fallback"))
	
	async def _identify_performance_bottlenecks(self, workflow_id: str, performance_data: Dict[str, Any]) -> List[Dict[str, Any]]:
		"""Identify performance bottlenecks in workflow execution"""
		# Implementation would analyze performance data to identify bottlenecks
		return []
	
	async def _redistribute_agent_tasks(self, agent_id: str, workflow_id: str) -> Dict[str, Any]:
		"""Redistribute tasks from overloaded agent"""
		# Implementation would redistribute tasks to other available agents
		return {'type': 'task_redistribution', 'agent_id': agent_id}
	
	async def _reassign_mismatched_tasks(self, task_id: str, workflow_id: str) -> Dict[str, Any]:
		"""Reassign tasks to better-suited agents"""
		# Implementation would reassign tasks based on agent capabilities
		return {'type': 'task_reassignment', 'task_id': task_id}
	
	async def _optimize_agent_communication(self, workflow_id: str) -> Dict[str, Any]:
		"""Optimize communication patterns between agents"""
		# Implementation would optimize agent communication for efficiency
		return {'type': 'communication_optimization', 'workflow_id': workflow_id}
	
	async def _generate_optimization_recommendations(self, workflow_id: str, performance_data: Dict[str, Any]) -> List[str]:
		"""Generate recommendations for workflow optimization"""
		# Implementation would analyze performance and generate recommendations
		return ["Consider increasing agent parallelism", "Optimize task sequencing"]
	
	async def _facilitate_agent_collaboration(self, workflow_id: str, waiting_agents: List[WorkflowAgentAssignment]) -> None:
		"""Facilitate collaboration between waiting agents"""
		try:
			from ...agents.specialists.coordinator_agent import CoordinatorAgent

			# Use coordinator agent if available, otherwise direct message exchange
			coordinator = None
			for agent in self.active_agents.values():
				if isinstance(agent, CoordinatorAgent):
					coordinator = agent
					break

			if coordinator:
				for wa in waiting_agents:
					agent = self.active_agents.get(wa.agent_id)
					if agent:
						await coordinator.register_agent(agent)
				self.logger.info(f"Facilitated collaboration for {len(waiting_agents)} agents via coordinator")
			else:
				# Direct collaboration: share context between waiting agents
				shared_context = {"workflow_id": workflow_id, "collaboration": True}
				for wa in waiting_agents:
					agent = self.active_agents.get(wa.agent_id)
					if agent and hasattr(agent, 'context'):
						agent.context.update(shared_context)
				self.logger.info(f"Facilitated direct collaboration for {len(waiting_agents)} agents")
		except Exception as e:
			self.logger.error(f"Failed to facilitate agent collaboration: {e}")
	
	async def _identify_stuck_agents(self, workflow_id: str, assignments: List[WorkflowAgentAssignment]) -> List[WorkflowAgentAssignment]:
		"""Identify agents that are stuck or unresponsive"""
		# Implementation would identify stuck agents based on timing and status
		return []
	
	async def _resolve_stuck_agent(self, assignment: WorkflowAgentAssignment) -> None:
		"""Resolve issues with stuck agent using retry → reassign → escalate"""
		try:
			agent = self.active_agents.get(assignment.agent_id)
			retry_count = assignment.context.get("retry_count", 0)
			max_retries = assignment.context.get("max_retries", 3)

			if retry_count < max_retries:
				# Retry: increment counter and attempt restart
				assignment.context["retry_count"] = retry_count + 1
				if agent and hasattr(agent, 'restart'):
					await agent.restart()
				elif agent and hasattr(agent, 'start'):
					await agent.start()
				self.logger.info(f"Retry {retry_count + 1}/{max_retries} for stuck agent {assignment.agent_id}")
			else:
				# Reassign: find alternative agent
				reassignment = await self._reassign_mismatched_tasks(
					assignment.task_id or "", assignment.workflow_id
				)
				if reassignment:
					self.logger.info(f"Reassigned task from stuck agent {assignment.agent_id}")
				else:
					# Escalate: mark as failed
					assignment.status = AgentWorkflowStatus.ERROR_STATE
					self.logger.warning(f"Escalated stuck agent {assignment.agent_id} to error state")
		except Exception as e:
			self.logger.error(f"Failed to resolve stuck agent {assignment.agent_id}: {e}")
	
	async def _handle_failed_agent(self, agent_id: str) -> None:
		"""Handle agent failure by reassigning tasks"""
		try:
			agent = self.active_agents.get(agent_id)
			if agent and hasattr(agent, 'stop'):
				await agent.stop()

			# Find all assignments for this agent
			for workflow_id, assignments in self.workflow_assignments.items():
				for assignment in assignments:
					if assignment.agent_id == agent_id:
						assignment.status = AgentWorkflowStatus.ERROR_STATE
						if assignment.task_id:
							await self._reassign_mismatched_tasks(
								assignment.task_id, workflow_id
							)
							self.logger.info(
								f"Reassigned task {assignment.task_id} from failed agent {agent_id}"
							)

			# Remove from active agents
			self.active_agents.pop(agent_id, None)
			self.logger.warning(f"Handled failure of agent {agent_id}")
		except Exception as e:
			self.logger.error(f"Failed to handle agent failure for {agent_id}: {e}")

# Factory function for creating agents-workflow integration
async def create_agents_workflow_integration(
	task_coordinator: TaskCoordinator,
	deadline_manager: DeadlineManager,
	workflow_monitor: WorkflowMonitor,
	auto_create_specialists: bool = True
) -> AgentsWorkflowIntegration:
	"""Create and initialize agents-workflow integration"""
	integration = AgentsWorkflowIntegration(
		task_coordinator=task_coordinator,
		deadline_manager=deadline_manager,
		workflow_monitor=workflow_monitor
	)
	
	# Auto-create specialist agents if requested
	if auto_create_specialists:
		specialists = await integration.create_specialist_agents()
		integration.logger.info(f"Created {len(specialists)} specialist agents for workflow integration")
	
	return integration
