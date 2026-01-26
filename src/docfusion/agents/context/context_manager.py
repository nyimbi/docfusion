import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, Set, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict

"""
Agent Context Management System

Manages shared context, inter-agent awareness, and task coordination.
Provides mechanisms for agents to understand the broader system state
and collaborate effectively.

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


class ContextType(str, Enum):
	"""Types of context information"""
	TASK_CONTEXT = "task_context"
	AGENT_STATUS = "agent_status"
	WORK_PROGRESS = "work_progress"
	RESULTS = "results"
	AMBIENT_INFO = "ambient_info"
	COORDINATION = "coordination"
	ERROR_INFO = "error_info"
	SYSTEM_STATE = "system_state"


class ContextScope(str, Enum):
	"""Scope of context visibility"""
	GLOBAL = "global"          # Visible to all agents
	CREW = "crew"              # Visible to crew members
	WORKFLOW = "workflow"      # Visible to workflow participants
	PRIVATE = "private"        # Only visible to the agent
	SHARED_ROLE = "shared_role" # Visible to agents with same role


@dataclass
class ContextEntry:
	"""Individual context entry"""
	entry_id: str = field(default_factory=uuid7str)
	context_type: ContextType = ContextType.AMBIENT_INFO
	scope: ContextScope = ContextScope.WORKFLOW
	source_agent_id: str = ""
	source_agent_name: str = ""
	title: str = ""
	content: Dict[str, Any] = field(default_factory=dict)
	tags: List[str] = field(default_factory=list)
	created_at: datetime = field(default_factory=datetime.now)
	expires_at: Optional[datetime] = None
	priority: int = field(default=5)  # 1-10, higher = more important
	related_task_ids: List[str] = field(default_factory=list)
	related_agent_ids: List[str] = field(default_factory=list)


class AgentAwarenessInfo(BaseModel):
	"""Information about an agent's current state and activities"""
	model_config = ConfigDict(extra='forbid')
	
	agent_id: str
	agent_name: str
	agent_role: str
	current_state: str
	active_tasks: List[Dict[str, Any]] = Field(default_factory=list)
	capabilities: List[str] = Field(default_factory=list)
	current_load: float = 0.0
	availability: str = "available"  # available, busy, unavailable
	last_activity: datetime = Field(default_factory=datetime.now)
	recent_outputs: List[Dict[str, Any]] = Field(default_factory=list)
	collaborative_preferences: Dict[str, Any] = Field(default_factory=dict)


class WorkflowContext(BaseModel):
	"""Context for a specific workflow or project"""
	model_config = ConfigDict(extra='forbid')
	
	workflow_id: str
	workflow_name: str
	description: str
	participating_agents: List[str] = Field(default_factory=list)
	current_phase: str = "initialization"
	phase_progress: float = 0.0
	deliverables: List[Dict[str, Any]] = Field(default_factory=list)
	deadlines: Dict[str, datetime] = Field(default_factory=dict)
	dependencies: Dict[str, List[str]] = Field(default_factory=dict)
	quality_requirements: Dict[str, Any] = Field(default_factory=dict)
	client_context: Dict[str, Any] = Field(default_factory=dict)


class TaskInterdependency(BaseModel):
	"""Represents dependencies between tasks and agents"""
	model_config = ConfigDict(extra='forbid')
	
	task_id: str
	depends_on_tasks: List[str] = Field(default_factory=list)
	depends_on_agents: List[str] = Field(default_factory=list) 
	blocks_tasks: List[str] = Field(default_factory=list)
	shared_resources: List[str] = Field(default_factory=list)
	coordination_points: List[Dict[str, Any]] = Field(default_factory=list)


class ContextManager:
	"""
	Central context management system for multi-agent coordination
	
	Provides:
	- Shared context storage and retrieval
	- Inter-agent awareness and status tracking
	- Task coordination and dependency management
	- Ambient information distribution
	- Real-time context updates
	"""
	
	def __init__(self):
		self.context_store: Dict[str, ContextEntry] = {}
		self.agent_awareness: Dict[str, AgentAwarenessInfo] = {}
		self.workflow_contexts: Dict[str, WorkflowContext] = {}
		self.task_dependencies: Dict[str, TaskInterdependency] = {}
		
		# Context organization
		self.context_by_scope: Dict[ContextScope, Set[str]] = {
			scope: set() for scope in ContextScope
		}
		self.context_by_type: Dict[ContextType, Set[str]] = {
			ctx_type: set() for ctx_type in ContextType
		}
		self.context_by_agent: Dict[str, Set[str]] = {}
		self.context_by_workflow: Dict[str, Set[str]] = {}
		
		# Subscriptions for real-time updates
		self.agent_subscriptions: Dict[str, Set[ContextType]] = {}
		self.workflow_subscriptions: Dict[str, Set[str]] = {}  # workflow_id -> agent_ids
		
		# Context maintenance
		self._maintenance_task: Optional[asyncio.Task] = None
		self._running = False
		
		self.logger = logging.getLogger("context_manager")
		self.logger.info("Context Manager initialized")
	
	async def start(self):
		"""Start the context manager"""
		if self._running:
			return
			
		self._running = True
		self._maintenance_task = asyncio.create_task(self._maintenance_loop())
		self.logger.info("Context Manager started")
	
	async def stop(self):
		"""Stop the context manager"""
		if not self._running:
			return
			
		self._running = False
		if self._maintenance_task:
			self._maintenance_task.cancel()
		self.logger.info("Context Manager stopped")
	
	# Agent Registration and Awareness
	
	async def register_agent(self, agent_id: str, agent_info: Dict[str, Any]) -> bool:
		"""Register an agent with the context system"""
		try:
			awareness_info = AgentAwarenessInfo(
				agent_id=agent_id,
				agent_name=agent_info.get("name", agent_id),
				agent_role=agent_info.get("role", "unknown"),
				current_state=agent_info.get("state", "inactive"),
				capabilities=agent_info.get("capabilities", []),
				availability="available"
			)
			
			self.agent_awareness[agent_id] = awareness_info
			self.context_by_agent[agent_id] = set()
			self.agent_subscriptions[agent_id] = set()
			
			# Add registration context entry
			await self.add_context(ContextEntry(
				context_type=ContextType.SYSTEM_STATE,
				scope=ContextScope.GLOBAL,
				source_agent_id="system",
				source_agent_name="System",
				title=f"Agent {agent_info.get('name', agent_id)} registered",
				content={
					"agent_id": agent_id,
					"agent_name": agent_info.get("name", agent_id),
					"role": agent_info.get("role", "unknown"),
					"capabilities": agent_info.get("capabilities", [])
				},
				tags=["agent_registration", "system_event"]
			))
			
			self.logger.info(f"Registered agent: {agent_id}")
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to register agent {agent_id}: {e}")
			return False
	
	async def update_agent_status(self, agent_id: str, status_update: Dict[str, Any]) -> bool:
		"""Update an agent's status information"""
		if agent_id not in self.agent_awareness:
			return False
			
		try:
			awareness = self.agent_awareness[agent_id]
			
			# Update fields that were provided
			if "state" in status_update:
				awareness.current_state = status_update["state"]
			if "active_tasks" in status_update:
				awareness.active_tasks = status_update["active_tasks"]
			if "current_load" in status_update:
				awareness.current_load = status_update["current_load"]
			if "availability" in status_update:
				awareness.availability = status_update["availability"]
			
			awareness.last_activity = datetime.now()
			
			# Add status update context entry for interested agents
			await self.add_context(ContextEntry(
				context_type=ContextType.AGENT_STATUS,
				scope=ContextScope.WORKFLOW,
				source_agent_id=agent_id,
				source_agent_name=awareness.agent_name,
				title=f"Status update: {awareness.agent_name}",
				content=status_update,
				tags=["status_update", awareness.agent_role],
				priority=3
			))
			
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to update agent status {agent_id}: {e}")
			return False
	
	# Context Management
	
	async def add_context(self, context_entry: ContextEntry) -> bool:
		"""Add a new context entry to the system"""
		try:
			entry_id = context_entry.entry_id
			self.context_store[entry_id] = context_entry
			
			# Update indices
			self.context_by_scope[context_entry.scope].add(entry_id)
			self.context_by_type[context_entry.context_type].add(entry_id)
			
			if context_entry.source_agent_id:
				if context_entry.source_agent_id not in self.context_by_agent:
					self.context_by_agent[context_entry.source_agent_id] = set()
				self.context_by_agent[context_entry.source_agent_id].add(entry_id)
			
			# Add to workflow contexts if applicable
			for task_id in context_entry.related_task_ids:
				workflow_id = self._get_workflow_for_task(task_id)
				if workflow_id:
					if workflow_id not in self.context_by_workflow:
						self.context_by_workflow[workflow_id] = set()
					self.context_by_workflow[workflow_id].add(entry_id)
			
			# Notify subscribed agents
			await self._notify_context_subscribers(context_entry)
			
			self.logger.debug(f"Added context entry: {context_entry.title}")
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to add context entry: {e}")
			return False
	
	async def get_context_for_agent(self, agent_id: str, 
									context_types: Optional[List[ContextType]] = None,
									max_entries: int = 50) -> List[ContextEntry]:
		"""Get relevant context entries for a specific agent"""
		try:
			relevant_entries = []
			
			# Get agent's workflow participations
			agent_workflows = self._get_agent_workflows(agent_id)
			
			# Collect context entries based on scope and relevance
			for entry_id, entry in self.context_store.items():
				should_include = False
				
				# Check scope-based access
				if entry.scope == ContextScope.GLOBAL:
					should_include = True
				elif entry.scope == ContextScope.PRIVATE and entry.source_agent_id == agent_id:
					should_include = True
				elif entry.scope == ContextScope.WORKFLOW:
					# Check if agent participates in any related workflows
					for workflow_id in agent_workflows:
						if entry_id in self.context_by_workflow.get(workflow_id, set()):
							should_include = True
							break
				elif entry.scope == ContextScope.SHARED_ROLE:
					# Check if agent has same role as entry source
					if agent_id in self.agent_awareness and entry.source_agent_id in self.agent_awareness:
						agent_role = self.agent_awareness[agent_id].agent_role
						source_role = self.agent_awareness[entry.source_agent_id].agent_role
						should_include = (agent_role == source_role)
				
				# Filter by context type if specified
				if should_include and context_types:
					should_include = entry.context_type in context_types
				
				# Check if entry is still valid (not expired)
				if should_include and entry.expires_at:
					should_include = datetime.now() < entry.expires_at
				
				if should_include:
					relevant_entries.append(entry)
			
			# Sort by priority and recency
			relevant_entries.sort(key=lambda x: (x.priority, x.created_at), reverse=True)
			
			return relevant_entries[:max_entries]
			
		except Exception as e:
			self.logger.error(f"Failed to get context for agent {agent_id}: {e}")
			return []
	
	async def get_agent_awareness(self, requesting_agent_id: str) -> Dict[str, AgentAwarenessInfo]:
		"""Get awareness information about other agents"""
		try:
			# Return all agent awareness info except sensitive private data
			filtered_awareness = {}
			
			for agent_id, awareness in self.agent_awareness.items():
				if agent_id == requesting_agent_id:
					# Full access to own data
					filtered_awareness[agent_id] = awareness
				else:
					# Limited access to others' data based on collaboration rules
					filtered_awareness[agent_id] = self._filter_agent_awareness(
						awareness, requesting_agent_id
					)
			
			return filtered_awareness
			
		except Exception as e:
			self.logger.error(f"Failed to get agent awareness for {requesting_agent_id}: {e}")
			return {}
	
	async def create_workflow_context(self, workflow_config: Dict[str, Any]) -> str:
		"""Create a new workflow context"""
		try:
			workflow = WorkflowContext(
				workflow_id=workflow_config.get("workflow_id", uuid7str()),
				workflow_name=workflow_config.get("name", "Unnamed Workflow"),
				description=workflow_config.get("description", ""),
				participating_agents=workflow_config.get("participating_agents", []),
				client_context=workflow_config.get("client_context", {}),
				quality_requirements=workflow_config.get("quality_requirements", {})
			)
			
			self.workflow_contexts[workflow.workflow_id] = workflow
			self.context_by_workflow[workflow.workflow_id] = set()
			
			# Subscribe participating agents to this workflow
			for agent_id in workflow.participating_agents:
				if workflow.workflow_id not in self.workflow_subscriptions:
					self.workflow_subscriptions[workflow.workflow_id] = set()
				self.workflow_subscriptions[workflow.workflow_id].add(agent_id)
			
			# Add workflow creation context
			await self.add_context(ContextEntry(
				context_type=ContextType.SYSTEM_STATE,
				scope=ContextScope.WORKFLOW,
				source_agent_id="system",
				source_agent_name="System",
				title=f"Workflow created: {workflow.workflow_name}",
				content={
					"workflow_id": workflow.workflow_id,
					"description": workflow.description,
					"participating_agents": workflow.participating_agents,
					"client_context": workflow.client_context
				},
				tags=["workflow_creation", "coordination"],
				priority=8
			))
			
			return workflow.workflow_id
			
		except Exception as e:
			self.logger.error(f"Failed to create workflow context: {e}")
			return ""
	
	# Task and Work Progress Tracking
	
	async def register_task_start(self, agent_id: str, task_info: Dict[str, Any]) -> bool:
		"""Register that an agent has started a task"""
		try:
			await self.add_context(ContextEntry(
				context_type=ContextType.WORK_PROGRESS,
				scope=ContextScope.WORKFLOW,
				source_agent_id=agent_id,
				source_agent_name=self.agent_awareness[agent_id].agent_name if agent_id in self.agent_awareness else agent_id,
				title=f"Task started: {task_info.get('name', task_info.get('task_id', 'Unknown'))}",
				content={
					"task_id": task_info.get("task_id"),
					"task_type": task_info.get("task_type"),
					"description": task_info.get("description"),
					"estimated_duration": task_info.get("estimated_duration"),
					"dependencies": task_info.get("dependencies", []),
					"status": "started"
				},
				tags=["task_start", "work_progress"],
				related_task_ids=[task_info.get("task_id", "")],
				priority=6
			))
			
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to register task start: {e}")
			return False
	
	async def register_task_completion(self, agent_id: str, task_id: str, results: Dict[str, Any]) -> bool:
		"""Register task completion and results"""
		try:
			await self.add_context(ContextEntry(
				context_type=ContextType.RESULTS,
				scope=ContextScope.WORKFLOW,
				source_agent_id=agent_id,
				source_agent_name=self.agent_awareness[agent_id].agent_name if agent_id in self.agent_awareness else agent_id,
				title=f"Task completed: {results.get('task_name', task_id)}",
				content={
					"task_id": task_id,
					"completion_time": datetime.now().isoformat(),
					"results": results,
					"quality_metrics": results.get("quality_metrics", {}),
					"deliverables": results.get("deliverables", []),
					"next_actions": results.get("next_actions", [])
				},
				tags=["task_completion", "results", "deliverable"],
				related_task_ids=[task_id],
				priority=7
			))
			
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to register task completion: {e}")
			return False
	
	# Context Building for LLM Prompts
	
	async def build_context_prompt(self, agent_id: str, task_info: Dict[str, Any]) -> str:
		"""Build a comprehensive context prompt for an agent's LLM"""
		try:
			context_sections = []
			
			# 1. Agent's role and current situation
			if agent_id in self.agent_awareness:
				awareness = self.agent_awareness[agent_id]
				context_sections.append(f"""AGENT ROLE & STATUS:
You are {awareness.agent_name}, a {awareness.agent_role} agent.
Current status: {awareness.current_state}
Your capabilities: {', '.join(awareness.capabilities)}
Current load: {awareness.current_load:.1%}""")
			
			# 2. Current task context
			if task_info:
				context_sections.append(f"""CURRENT TASK:
Task: {task_info.get('name', 'Unknown')}
Type: {task_info.get('task_type', 'general')}
Description: {task_info.get('description', 'No description provided')}
Priority: {task_info.get('priority', 'medium')}""")
			
			# 3. Workflow context
			workflow_context = await self._get_workflow_context_for_agent(agent_id)
			if workflow_context:
				context_sections.append(workflow_context)
			
			# 4. Recent work by other agents
			other_agents_work = await self._get_recent_agent_work(agent_id)
			if other_agents_work:
				context_sections.append(f"""RECENT WORK BY TEAM:
{other_agents_work}""")
			
			# 5. Available resources and constraints
			resources_context = await self._get_resources_context(agent_id)
			if resources_context:
				context_sections.append(resources_context)
			
			# 6. Quality requirements and standards
			quality_context = await self._get_quality_requirements(agent_id)
			if quality_context:
				context_sections.append(quality_context)
			
			return "\n\n".join(context_sections)
			
		except Exception as e:
			self.logger.error(f"Failed to build context prompt for {agent_id}: {e}")
			return "Context unavailable due to system error."
	
	# Helper Methods
	
	def _get_workflow_for_task(self, task_id: str) -> Optional[str]:
		"""Find which workflow a task belongs to"""
		# Implementation would depend on task tracking system
		# For now, return None - can be enhanced later
		return None
	
	def _get_agent_workflows(self, agent_id: str) -> List[str]:
		"""Get workflows that an agent participates in"""
		workflows = []
		for workflow_id, workflow in self.workflow_contexts.items():
			if agent_id in workflow.participating_agents:
				workflows.append(workflow_id)
		return workflows
	
	def _filter_agent_awareness(self, awareness: AgentAwarenessInfo, requesting_agent_id: str) -> AgentAwarenessInfo:
		"""Filter sensitive information from agent awareness based on permissions"""
		# Return a copy with limited information for privacy
		return AgentAwarenessInfo(
			agent_id=awareness.agent_id,
			agent_name=awareness.agent_name,
			agent_role=awareness.agent_role,
			current_state=awareness.current_state,
			availability=awareness.availability,
			current_load=awareness.current_load,
			capabilities=awareness.capabilities,
			last_activity=awareness.last_activity
			# Exclude private fields like active_tasks details
		)
	
	async def _get_workflow_context_for_agent(self, agent_id: str) -> Optional[str]:
		"""Get workflow context information for an agent"""
		workflows = self._get_agent_workflows(agent_id)
		if not workflows:
			return None
		
		context_parts = []
		for workflow_id in workflows[:3]:  # Limit to 3 most relevant workflows
			workflow = self.workflow_contexts.get(workflow_id)
			if workflow:
				context_parts.append(f"""WORKFLOW: {workflow.workflow_name}
Description: {workflow.description}
Current phase: {workflow.current_phase} ({workflow.phase_progress:.1%} complete)
Team members: {', '.join(workflow.participating_agents)}
Client: {workflow.client_context.get('organization', 'Not specified')}""")
		
		return "WORKFLOW CONTEXT:\n" + "\n\n".join(context_parts) if context_parts else None
	
	async def _get_recent_agent_work(self, requesting_agent_id: str, hours: int = 24) -> Optional[str]:
		"""Get summary of recent work done by other agents"""
		cutoff_time = datetime.now() - timedelta(hours=hours)
		recent_work = []
		
		for entry in self.context_store.values():
			if (entry.context_type in [ContextType.RESULTS, ContextType.WORK_PROGRESS] and
				entry.created_at > cutoff_time and
				entry.source_agent_id != requesting_agent_id):
				
				agent_name = entry.source_agent_name or entry.source_agent_id
				recent_work.append(f"- {agent_name}: {entry.title}")
		
		return "\n".join(recent_work[-10:]) if recent_work else None  # Last 10 items
	
	async def _get_resources_context(self, agent_id: str) -> Optional[str]:
		"""Get information about available resources and constraints"""
		# This would integrate with resource management systems
		# For now, return basic information
		return None
	
	async def _get_quality_requirements(self, agent_id: str) -> Optional[str]:
		"""Get quality requirements and standards for current work"""
		workflows = self._get_agent_workflows(agent_id)
		if not workflows:
			return None
		
		quality_parts = []
		for workflow_id in workflows:
			workflow = self.workflow_contexts.get(workflow_id)
			if workflow and workflow.quality_requirements:
				quality_parts.append(f"Quality standards: {workflow.quality_requirements}")
		
		return "QUALITY REQUIREMENTS:\n" + "\n".join(quality_parts) if quality_parts else None
	
	async def _notify_context_subscribers(self, context_entry: ContextEntry):
		"""Notify subscribed agents about new context"""
		# Implementation would send notifications to interested agents
		# For now, just log the event
		self.logger.debug(f"Context notification: {context_entry.title}")
	
	async def _maintenance_loop(self):
		"""Periodic maintenance of context data"""
		while self._running:
			try:
				await self._cleanup_expired_context()
				await asyncio.sleep(300)  # Run every 5 minutes
			except Exception as e:
				self.logger.error(f"Context maintenance error: {e}")
				await asyncio.sleep(60)
	
	async def _cleanup_expired_context(self):
		"""Remove expired context entries"""
		current_time = datetime.now()
		expired_entries = []
		
		for entry_id, entry in self.context_store.items():
			if entry.expires_at and current_time > entry.expires_at:
				expired_entries.append(entry_id)
		
		for entry_id in expired_entries:
			await self._remove_context_entry(entry_id)
		
		if expired_entries:
			self.logger.debug(f"Cleaned up {len(expired_entries)} expired context entries")
	
	async def _remove_context_entry(self, entry_id: str):
		"""Remove a context entry and update indices"""
		if entry_id not in self.context_store:
			return
		
		entry = self.context_store[entry_id]
		
		# Remove from indices
		self.context_by_scope[entry.scope].discard(entry_id)
		self.context_by_type[entry.context_type].discard(entry_id)
		
		if entry.source_agent_id in self.context_by_agent:
			self.context_by_agent[entry.source_agent_id].discard(entry_id)
		
		for workflow_entries in self.context_by_workflow.values():
			workflow_entries.discard(entry_id)
		
		del self.context_store[entry_id]


# Global context manager instance
_context_manager: Optional[ContextManager] = None

async def get_context_manager() -> ContextManager:
	"""Get the global context manager instance"""
	global _context_manager
	if _context_manager is None:
		_context_manager = ContextManager()
		await _context_manager.start()
	return _context_manager