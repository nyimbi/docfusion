import asyncio
import logging
from typing import Any, Dict, List, Optional, Set, Union, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import uuid
from pydantic import BaseModel, Field, ConfigDict
from ..core.agent import Agent
from ..core.messages import AgentMessage, MessageType, MessageTemplates
import re

"""
Agent Crew Management

Inspired by CrewAI for structured team-based agent coordination
with defined roles, goals, and collaborative workflows.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""


try:
	from uuid_extensions import uuid7str
except ImportError:
	import uuid
	def uuid7str() -> str:
		return str(uuid.uuid4())


class CrewStatus(str, Enum):
	"""Crew operational status"""
	FORMING = "forming"
	ACTIVE = "active"
	WORKING = "working"
	PAUSED = "paused"
	COMPLETING = "completing"
	COMPLETED = "completed"
	DISBANDED = "disbanded"
	ERROR = "error"


class TaskPriority(str, Enum):
	"""Task priority levels"""
	CRITICAL = "critical"
	HIGH = "high"
	MEDIUM = "medium"
	LOW = "low"


@dataclass
class CrewTask:
	"""Task to be executed by the crew"""
	task_id: str
	description: str
	task_type: str
	assigned_agent: Optional[str] = None
	priority: TaskPriority = TaskPriority.MEDIUM
	dependencies: List[str] = field(default_factory=list)
	deadline: Optional[datetime] = None
	context: Dict[str, Any] = field(default_factory=dict)
	result: Optional[Any] = None
	status: str = "pending"
	created_at: datetime = field(default_factory=datetime.now)


class CrewConfig(BaseModel):
	"""Configuration for agent crew"""
	model_config = ConfigDict(extra='forbid')
	
	crew_id: str = Field(default_factory=uuid7str)
	name: str = Field(description="Crew name")
	description: str = Field(description="Crew purpose and objectives")
	
	# Agent composition
	required_roles: List[str] = Field(default_factory=list)
	max_agents: int = Field(default=6, ge=2, le=20)
	min_agents: int = Field(default=3, ge=2)
	
	# Operational settings
	collaboration_mode: str = Field(default="coordinated")  # "coordinated", "autonomous", "hierarchical"
	communication_frequency: int = Field(default=30)  # seconds between status checks
	task_timeout_minutes: int = Field(default=60)
	max_retries: int = Field(default=3)
	
	# Quality and performance
	quality_threshold: float = Field(default=0.8, ge=0.0, le=1.0)
	performance_monitoring: bool = True
	auto_scaling: bool = False
	
	# Goals and success criteria
	success_criteria: Dict[str, Any] = Field(default_factory=dict)
	kpis: List[str] = Field(default_factory=list)


class CrewMetrics(BaseModel):
	"""Crew performance metrics"""
	model_config = ConfigDict(extra='forbid')
	
	tasks_completed: int = 0
	tasks_failed: int = 0
	tasks_in_progress: int = 0
	average_task_completion_time: float = 0.0
	success_rate: float = 1.0
	collaboration_score: float = 0.0
	efficiency_score: float = 0.0
	quality_score: float = 0.0
	agent_utilization: Dict[str, float] = Field(default_factory=dict)
	communication_volume: int = 0
	started_at: Optional[datetime] = None
	last_activity: Optional[datetime] = None


class AgentCrew:
	"""
	Agent Crew for structured team collaboration
	
	Inspired by CrewAI's approach to organizing agents into cohesive teams
	with defined roles, shared goals, and coordinated task execution.
	"""
	
	def __init__(self, config: CrewConfig):
		self.config = config
		self.crew_id = config.crew_id
		self.name = config.name
		self.status = CrewStatus.FORMING
		
		# Agent management
		self.agents: Dict[str, Agent] = {}
		self.agent_roles: Dict[str, str] = {}
		self.agent_assignments: Dict[str, List[str]] = {}  # agent_id -> task_ids
		
		# Task management
		self.tasks: Dict[str, CrewTask] = {}
		self.task_queue: List[str] = []
		self.completed_tasks: List[str] = []
		self.failed_tasks: List[str] = []
		
		# Communication and coordination
		self.crew_memory: Dict[str, Any] = {}
		self.shared_context: Dict[str, Any] = {}
		self.communication_log: List[Dict[str, Any]] = []
		
		# Metrics and monitoring
		self.metrics = CrewMetrics()
		self.performance_history: List[Dict[str, Any]] = []
		
		# Coordination
		self.coordinator: Optional[CoordinatorAgent] = None
		
		self.logger = logging.getLogger(f"crew.{self.name}")
		self.logger.info(f"Crew {self.name} initialized")
	
	async def assemble_crew(self, agent_configs: List[Dict[str, Any]]) -> bool:
		"""Assemble the crew with specified agents"""
		try:
			self.logger.info(f"Assembling crew {self.name} with {len(agent_configs)} agents")
			
			# Create and add agents
			for agent_config in agent_configs:
				agent = await self._create_agent(agent_config)
				if agent:
					await self.add_agent(agent, agent_config.get("role"))
			
			# Validate crew composition
			if len(self.agents) < self.config.min_agents:
				self.logger.error(f"Insufficient agents: {len(self.agents)} < {self.config.min_agents}")
				return False
			
			# Assign coordinator if needed
			if self.config.collaboration_mode == "coordinated":
				await self._assign_coordinator()
			
			self.status = CrewStatus.ACTIVE
			self.metrics.started_at = datetime.now()
			
			self.logger.info(f"Crew {self.name} assembled successfully with {len(self.agents)} agents")
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to assemble crew: {e}")
			self.status = CrewStatus.ERROR
			return False
	
	async def add_agent(self, agent: Agent, role: str) -> bool:
		"""Add an agent to the crew"""
		try:
			if len(self.agents) >= self.config.max_agents:
				self.logger.warning("Crew at maximum capacity")
				return False
			
			agent_id = agent.agent_id
			self.agents[agent_id] = agent
			self.agent_roles[agent_id] = role
			self.agent_assignments[agent_id] = []
			
			# Start the agent if not already running
			if agent.state != "active":
				await agent.start()
			
			self.logger.info(f"Added {role} agent {agent_id} to crew")
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to add agent: {e}")
			return False
	
	async def remove_agent(self, agent_id: str) -> bool:
		"""Remove an agent from the crew"""
		try:
			if agent_id not in self.agents:
				return False
			
			# Reassign tasks if any
			if self.agent_assignments[agent_id]:
				await self._reassign_agent_tasks(agent_id)
			
			# Stop and remove agent
			agent = self.agents[agent_id]
			await agent.stop()
			
			del self.agents[agent_id]
			del self.agent_roles[agent_id]
			del self.agent_assignments[agent_id]
			
			self.logger.info(f"Removed agent {agent_id} from crew")
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to remove agent: {e}")
			return False
	
	async def assign_task(self, task: CrewTask) -> bool:
		"""Assign a task to the crew"""
		try:
			self.tasks[task.task_id] = task
			
			# Find best agent for the task
			best_agent = await self._find_best_agent_for_task(task)
			
			if best_agent:
				task.assigned_agent = best_agent
				self.agent_assignments[best_agent].append(task.task_id)
				task.status = "assigned"
				
				# Send task to agent
				await self._send_task_to_agent(task, best_agent)
				
				self.logger.info(f"Assigned task {task.task_id} to agent {best_agent}")
				return True
			else:
				# Queue task for later assignment
				self.task_queue.append(task.task_id)
				task.status = "queued"
				
				self.logger.warning(f"No available agent for task {task.task_id}, queued")
				return False
				
		except Exception as e:
			self.logger.error(f"Failed to assign task: {e}")
			return False
	
	async def execute_workflow(self, workflow_tasks: List[CrewTask]) -> Dict[str, Any]:
		"""Execute a complete workflow"""
		try:
			self.logger.info(f"Starting workflow execution with {len(workflow_tasks)} tasks")
			self.status = CrewStatus.WORKING
			
			# Add all tasks
			for task in workflow_tasks:
				await self.assign_task(task)
			
			# Start monitoring and coordination
			monitoring_task = asyncio.create_task(self._monitor_workflow())
			coordination_task = asyncio.create_task(self._coordinate_execution())
			
			# Wait for completion or timeout
			workflow_timeout = len(workflow_tasks) * self.config.task_timeout_minutes * 60
			
			try:
				await asyncio.wait_for(
					self._wait_for_completion(),
					timeout=workflow_timeout
				)
				
				self.status = CrewStatus.COMPLETED
				result = {
					"success": True,
					"completed_tasks": len(self.completed_tasks),
					"failed_tasks": len(self.failed_tasks),
					"metrics": self.metrics.model_dump(),
					"results": {task_id: self.tasks[task_id].result 
							   for task_id in self.completed_tasks}
				}
				
				self.logger.info(f"Workflow completed successfully")
				return result
				
			except asyncio.TimeoutError:
				self.logger.error("Workflow timed out")
				self.status = CrewStatus.ERROR
				return {
					"success": False,
					"error": "Workflow timeout",
					"completed_tasks": len(self.completed_tasks),
					"failed_tasks": len(self.failed_tasks)
				}
			finally:
				# Cancel monitoring tasks
				monitoring_task.cancel()
				coordination_task.cancel()
				
		except Exception as e:
			self.logger.error(f"Workflow execution failed: {e}")
			self.status = CrewStatus.ERROR
			return {"success": False, "error": str(e)}
	
	async def pause_crew(self) -> bool:
		"""Pause crew operations"""
		try:
			self.status = CrewStatus.PAUSED
			
			# Pause all agents
			for agent in self.agents.values():
				await agent.pause()
			
			self.logger.info("Crew paused")
			return True
		except Exception as e:
			self.logger.error(f"Failed to pause crew: {e}")
			return False
	
	async def resume_crew(self) -> bool:
		"""Resume crew operations"""
		try:
			self.status = CrewStatus.ACTIVE
			
			# Resume all agents
			for agent in self.agents.values():
				await agent.resume()
			
			self.logger.info("Crew resumed")
			return True
		except Exception as e:
			self.logger.error(f"Failed to resume crew: {e}")
			return False
	
	async def disband_crew(self) -> bool:
		"""Disband the crew and stop all agents"""
		try:
			self.status = CrewStatus.DISBANDED
			
			# Stop all agents
			for agent in self.agents.values():
				await agent.stop()
			
			# Clear state
			self.agents.clear()
			self.agent_roles.clear()
			self.agent_assignments.clear()
			
			self.logger.info("Crew disbanded")
			return True
		except Exception as e:
			self.logger.error(f"Failed to disband crew: {e}")
			return False
	
	# Internal coordination methods
	
	async def _create_agent(self, agent_config: Dict[str, Any]) -> Optional[Agent]:
		"""Create an agent based on configuration"""
		agent_type = agent_config.get("type")
		
		agent_map = {
			"researcher": ResearchAgent,
			"writer": WriterAgent,
			"reviewer": ReviewerAgent,
			"coordinator": CoordinatorAgent,
			"analyst": AnalysisAgent,
			"quality": QualityAgent
		}
		
		if agent_type in agent_map:
			agent_class = agent_map[agent_type]
			return agent_class(agent_config.get("config"))
		
		return None
	
	async def _assign_coordinator(self) -> None:
		"""Assign a coordinator agent if needed"""
		# Look for existing coordinator
		for agent_id, role in self.agent_roles.items():
			if role == "coordinator":
				self.coordinator = self.agents[agent_id]
				return
		
		# Create new coordinator if none exists
		coordinator_config = {"type": "coordinator", "config": None}
		coordinator = await self._create_agent(coordinator_config)
		if coordinator:
			await self.add_agent(coordinator, "coordinator")
			self.coordinator = coordinator
	
	async def _find_best_agent_for_task(self, task: CrewTask) -> Optional[str]:
		"""Find the best agent for a specific task"""
		best_agent = None
		best_score = 0.0
		
		for agent_id, agent in self.agents.items():
			# Check availability
			if len(self.agent_assignments[agent_id]) >= agent.config.capabilities.max_concurrent_tasks:
				continue
			
			# Evaluate task fit
			try:
				fit_score = await agent.evaluate_task_fit(task)
				if fit_score > best_score:
					best_score = fit_score
					best_agent = agent_id
			except Exception as e:
				self.logger.warning(f"Agent {agent_id} task fit evaluation failed: {e}")
				continue
		
		return best_agent if best_score > 0.5 else None
	
	async def _send_task_to_agent(self, task: CrewTask, agent_id: str) -> bool:
		"""Send task to assigned agent"""
		try:
			agent = self.agents[agent_id]
			
			# Create task message
			message = MessageTemplates.task_request(
				sender_id=self.crew_id,
				recipient_id=agent_id,
				task_data={
					"task_id": task.task_id,
					"task_type": task.task_type,
					"description": task.description,
					"context": task.context,
					"priority": task.priority.value,
					"deadline": task.deadline.isoformat() if task.deadline else None
				}
			)
			
			# Send to agent (would use message bus in full implementation)
			response = await agent.handle_message(message)
			
			if response:
				task.status = "in_progress"
				self.metrics.tasks_in_progress += 1
			
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to send task to agent: {e}")
			return False
	
	async def _monitor_workflow(self) -> None:
		"""Monitor workflow progress and agent health"""
		while self.status in [CrewStatus.WORKING, CrewStatus.ACTIVE]:
			try:
				# Update metrics
				await self._update_metrics()
				
				# Check agent health
				unhealthy_agents = []
				for agent_id, agent in self.agents.items():
					health = agent.get_health_status()
					if not health.get("is_healthy", True):
						unhealthy_agents.append(agent_id)
				
				# Handle unhealthy agents
				for agent_id in unhealthy_agents:
					await self._handle_unhealthy_agent(agent_id)
				
				# Process queued tasks
				await self._process_task_queue()
				
				await asyncio.sleep(self.config.communication_frequency)
				
			except Exception as e:
				self.logger.error(f"Monitoring error: {e}")
				await asyncio.sleep(10)
	
	async def _coordinate_execution(self) -> None:
		"""Coordinate task execution and agent communication"""
		while self.status in [CrewStatus.WORKING, CrewStatus.ACTIVE]:
			try:
				# Check for completed tasks
				for task_id, task in self.tasks.items():
					if task.status == "in_progress":
						# Check if task is completed (simplified)
						if task.assigned_agent:
							agent = self.agents[task.assigned_agent]
							# Would check actual task completion status
							
				# Facilitate inter-agent communication
				await self._facilitate_communication()
				
				await asyncio.sleep(self.config.communication_frequency)
				
			except Exception as e:
				self.logger.error(f"Coordination error: {e}")
				await asyncio.sleep(10)
	
	async def _wait_for_completion(self) -> None:
		"""Wait for all tasks to complete"""
		while True:
			pending_tasks = sum(1 for task in self.tasks.values() 
							   if task.status in ["pending", "queued", "assigned", "in_progress"])
			
			if pending_tasks == 0:
				break
			
			await asyncio.sleep(5)
	
	async def _reassign_agent_tasks(self, agent_id: str) -> None:
		"""Reassign tasks from a removed agent"""
		task_ids = self.agent_assignments[agent_id].copy()
		
		for task_id in task_ids:
			task = self.tasks[task_id]
			task.assigned_agent = None
			task.status = "pending"
			
			# Try to reassign
			new_agent = await self._find_best_agent_for_task(task)
			if new_agent:
				task.assigned_agent = new_agent
				self.agent_assignments[new_agent].append(task_id)
				await self._send_task_to_agent(task, new_agent)
			else:
				self.task_queue.append(task_id)
	
	async def _process_task_queue(self) -> None:
		"""Process queued tasks by assigning them to available agents"""
		tasks_to_process = self.task_queue.copy()
		
		for task_id in tasks_to_process:
			task = self.tasks[task_id]
			best_agent = await self._find_best_agent_for_task(task)
			
			if best_agent:
				task.assigned_agent = best_agent
				self.agent_assignments[best_agent].append(task_id)
				task.status = "assigned"
				
				await self._send_task_to_agent(task, best_agent)
				self.task_queue.remove(task_id)
	
	async def _update_metrics(self) -> None:
		"""Update crew performance metrics"""
		current_time = datetime.now()
		
		# Basic counts
		self.metrics.tasks_completed = len(self.completed_tasks)
		self.metrics.tasks_failed = len(self.failed_tasks)
		self.metrics.tasks_in_progress = sum(1 for task in self.tasks.values() 
											if task.status == "in_progress")
		
		# Success rate
		total_finished = self.metrics.tasks_completed + self.metrics.tasks_failed
		if total_finished > 0:
			self.metrics.success_rate = self.metrics.tasks_completed / total_finished
		
		# Agent utilization
		for agent_id, agent in self.agents.items():
			active_tasks = len(self.agent_assignments[agent_id])
			max_tasks = agent.config.capabilities.max_concurrent_tasks
			self.metrics.agent_utilization[agent_id] = active_tasks / max_tasks
		
		self.metrics.last_activity = current_time
	
	async def _handle_unhealthy_agent(self, agent_id: str) -> None:
		"""Handle an unhealthy agent"""
		self.logger.warning(f"Agent {agent_id} is unhealthy, attempting recovery")
		
		try:
			agent = self.agents[agent_id]
			
			# Try to restart agent
			await agent.stop()
			await asyncio.sleep(2)
			await agent.start()
			
			# If still unhealthy, remove from crew
			health = agent.get_health_status()
			if not health.get("is_healthy", True):
				await self.remove_agent(agent_id)
				
		except Exception as e:
			self.logger.error(f"Failed to handle unhealthy agent {agent_id}: {e}")
	
	async def _facilitate_communication(self) -> None:
		"""Facilitate communication between agents"""
		# This would implement inter-agent communication protocols
		# For now, just log communication activity
		self.metrics.communication_volume += len(self.agents)
	
	# Public interface methods
	
	def get_crew_status(self) -> Dict[str, Any]:
		"""Get current crew status"""
		return {
			"crew_id": self.crew_id,
			"name": self.name,
			"status": self.status.value,
			"agent_count": len(self.agents),
			"active_tasks": len([t for t in self.tasks.values() if t.status == "in_progress"]),
			"completed_tasks": len(self.completed_tasks),
			"failed_tasks": len(self.failed_tasks),
			"metrics": self.metrics.model_dump()
		}
	
	def get_agent_status(self, agent_id: str) -> Optional[Dict[str, Any]]:
		"""Get status of a specific agent"""
		if agent_id in self.agents:
			agent = self.agents[agent_id]
			return {
				"agent_id": agent_id,
				"role": self.agent_roles[agent_id],
				"status": agent.state.value,
				"assigned_tasks": len(self.agent_assignments[agent_id]),
				"health": agent.get_health_status()
			}
		return None
	
	def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
		"""Get status of a specific task"""
		if task_id in self.tasks:
			task = self.tasks[task_id]
			return {
				"task_id": task_id,
				"description": task.description,
				"status": task.status,
				"assigned_agent": task.assigned_agent,
				"priority": task.priority.value,
				"created_at": task.created_at.isoformat()
			}
		return None
	
	async def create_proposal_crew(self) -> 'AgentCrew':
		"""Create a crew specifically for proposal generation"""
		proposal_config = CrewConfig(
			name="Proposal Generation Crew",
			description="Specialized crew for end-to-end proposal generation",
			required_roles=["researcher", "writer", "reviewer", "quality"],
			collaboration_mode="coordinated",
			success_criteria={
				"quality_threshold": 0.9,
				"all_sections_complete": True,
				"voice_consistency": 0.95
			}
		)
		
		crew = AgentCrew(proposal_config)
		
		# Define standard agent configurations
		agent_configs = [
			{"type": "researcher", "role": "researcher", "config": None},
			{"type": "writer", "role": "writer", "config": None},
			{"type": "reviewer", "role": "reviewer", "config": None},
			{"type": "quality", "role": "quality", "config": None},
			{"type": "coordinator", "role": "coordinator", "config": None}
		]
		
		await crew.assemble_crew(agent_configs)
		return crew