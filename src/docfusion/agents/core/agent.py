import asyncio
import logging
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Union, Callable, TypeVar, Generic
from enum import Enum
from dataclasses import dataclass, field
import statistics
from pydantic import BaseModel, Field, ConfigDict
import re
"""
Core Agent Base Class

The fundamental agent abstraction for the multi-agent system with
capabilities, goals, communication, and task execution.

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

# Import from other system components (with fallbacks)
try:
	from ...intelligence.models.base_models import IntelligenceResult
except:
	# Fallback if intelligence models not available
	class IntelligenceResult:
		def __init__(self, **kwargs):
			for k, v in kwargs.items():
				setattr(self, k, v)

try:
	from ...voice_dna.integration import VoiceIntegrator, AnalysisRequest
except:
	# Fallback if voice DNA not available
	class VoiceIntegrator:
		def __init__(self, config=None): pass
		async def analyze(self, request): return None
	
	class AnalysisRequest:
		def __init__(self, **kwargs): pass

try:
	from ..context import get_context_manager
except:
	# Fallback if context manager not available
	async def get_context_manager():
		return None

try:
	from ..tools import get_tool_registry
except:
	# Fallback if tools not available
	def get_tool_registry():
		return None

# Import Ollama LLM client
try:
	from ..llm.ollama_client import OllamaClient, OllamaConfig
except ImportError:
	# Fallback if Ollama client not available
	class OllamaClient:
		def __init__(self, config=None): pass
		async def generate(self, prompt, system_prompt=None): return "Ollama not available"
		async def health_check(self): return False
		async def close(self): pass
	
	class OllamaConfig:
		def __init__(self, **kwargs): pass


class AgentState(str, Enum):
	"""Agent operational states"""
	INITIALIZING = "initializing"
	IDLE = "idle"
	ACTIVE = "active"
	BUSY = "busy"
	WAITING = "waiting"
	ERROR = "error"
	SUSPENDED = "suspended"
	TERMINATED = "terminated"


class AgentPriority(str, Enum):
	"""Agent priority levels for task assignment"""
	CRITICAL = "critical"
	HIGH = "high"
	MEDIUM = "medium"
	LOW = "low"
	BACKGROUND = "background"


class AgentMetrics(BaseModel):
	"""Agent performance and operational metrics"""
	model_config = ConfigDict(extra='forbid')
	
	tasks_completed: int = 0
	tasks_failed: int = 0
	total_processing_time: float = 0.0
	average_response_time: float = 0.0
	success_rate: float = 1.0
	current_load: float = 0.0
	peak_load: float = 0.0
	memory_usage: int = 0
	messages_sent: int = 0
	messages_received: int = 0
	collaborations_initiated: int = 0
	knowledge_items_learned: int = 0
	errors_encountered: int = 0
	uptime_seconds: float = 0.0
	last_activity: datetime = Field(default_factory=datetime.now)


class AgentCapabilities(BaseModel):
	"""Agent capability definitions and constraints"""
	model_config = ConfigDict(extra='forbid')
	
	max_concurrent_tasks: int = Field(default=3, ge=1, le=10)
	max_memory_items: int = Field(default=1000, ge=100)
	task_timeout_seconds: int = Field(default=300, ge=30)
	communication_timeout_seconds: int = Field(default=30, ge=5)
	learning_enabled: bool = True
	collaboration_enabled: bool = True
	autonomous_task_creation: bool = False
	context_retention_hours: int = Field(default=24, ge=1)
	expertise_domains: List[str] = Field(default_factory=list)
	supported_task_types: List[str] = Field(default_factory=list)
	quality_threshold: float = Field(default=0.8, ge=0.0, le=1.0)


class AgentConfig(BaseModel):
	"""Agent configuration settings"""
	model_config = ConfigDict(extra='forbid')
	
	agent_id: str = Field(default_factory=uuid7str)
	name: str = Field(description="Human-readable agent name")
	description: str = Field(description="Agent purpose and role description")
	version: str = Field(default="1.0.0")
	
	# Role and behavior
	primary_role: str = Field(description="Primary agent role/specialization")
	personality_traits: Dict[str, float] = Field(default_factory=dict)
	risk_tolerance: float = Field(default=0.5, ge=0.0, le=1.0)
	creativity_level: float = Field(default=0.7, ge=0.0, le=1.0)
	
	# Operational settings
	capabilities: AgentCapabilities = Field(default_factory=AgentCapabilities)
	auto_start: bool = True
	logging_level: str = "INFO"
	metrics_enabled: bool = True
	
	# Integration settings
	voice_analysis_enabled: bool = True
	intelligence_integration: bool = True
	memory_persistence: bool = True
	
	# LLM settings
	llm_model: str = Field(default="qwen2.5:1.5b", description="Default LLM model to use")
	llm_host: str = Field(default="http://localhost:11434", description="Ollama host URL")
	llm_temperature: float = Field(default=0.7, ge=0.0, le=2.0)
	llm_max_tokens: int = Field(default=2048, ge=100, le=8192)


class AgentContext(BaseModel):
	"""Current operational context for an agent"""
	model_config = ConfigDict(extra='forbid')
	
	current_tasks: List[str] = Field(default_factory=list)
	active_conversations: List[str] = Field(default_factory=list)
	recent_interactions: Dict[str, datetime] = Field(default_factory=dict)
	working_memory: Dict[str, Any] = Field(default_factory=dict)
	shared_context: Dict[str, Any] = Field(default_factory=dict)
	goal_progress: Dict[str, float] = Field(default_factory=dict)
	current_focus: Optional[str] = None
	collaboration_state: Dict[str, str] = Field(default_factory=dict)


T = TypeVar('T')


class Agent(ABC, Generic[T]):
	"""
	Base Agent class for multi-agent system
	
	Provides core functionality for autonomous agents including:
	- Task execution and management
	- Inter-agent communication
	- Memory and context management
	- Performance monitoring
	- Goal-oriented behavior
	"""
	
	def __init__(self, config: AgentConfig):
		self.config = config
		self.agent_id = config.agent_id
		self.name = config.name
		self.state = AgentState.INITIALIZING
		self.metrics = AgentMetrics()
		self.context = AgentContext()
		
		# Core components
		self.logger = logging.getLogger(f"agent.{self.name}")
		self.logger.setLevel(getattr(logging, config.logging_level))
		
		# Task and communication queues
		self.task_queue: asyncio.Queue = asyncio.Queue()
		self.message_queue: asyncio.Queue = asyncio.Queue()
		self.response_queue: asyncio.Queue = asyncio.Queue()
		
		# Internal state
		self._running = False
		self._task_futures: Dict[str, asyncio.Task] = {}
		self._message_handlers: Dict[str, Callable] = {}
		self._goals: Dict[str, Any] = {}
		self._knowledge_base: Dict[str, Any] = {}
		
		# Integration components
		self.voice_integrator = VoiceIntegrator() if config.voice_analysis_enabled else None
		self.context_manager = None
		self.tool_registry = get_tool_registry()
		
		# Initialize Ollama client
		self.llm_client = None
		self._setup_llm_client()
		
		# Initialize agent
		self._setup_message_handlers()
		self._initialize_goals()
		
		self.logger.info(f"Agent {self.name} initialized with ID: {self.agent_id}")
	
	# Core agent lifecycle methods
	
	async def start(self) -> None:
		"""Start the agent's main processing loop"""
		if self._running:
			return
		
		self.logger.info(f"Starting agent {self.name}")
		self.state = AgentState.ACTIVE
		self._running = True
		self.metrics.last_activity = datetime.now()
		
		# Initialize context manager
		self.context_manager = await get_context_manager()
		if self.context_manager:
			await self._register_with_context_manager()
		
		# Start main processing task
		self._main_task = asyncio.create_task(self._main_loop())
		
		# Start subsidiary tasks
		self._message_task = asyncio.create_task(self._process_messages())
		self._monitoring_task = asyncio.create_task(self._monitor_performance())
		
		await self._on_start()
	
	async def stop(self) -> None:
		"""Stop the agent gracefully"""
		if not self._running:
			return
		
		self.logger.info(f"Stopping agent {self.name}")
		self._running = False
		
		# Cancel running tasks
		if hasattr(self, '_main_task'):
			self._main_task.cancel()
		if hasattr(self, '_message_task'):
			self._message_task.cancel()
		if hasattr(self, '_monitoring_task'):
			self._monitoring_task.cancel()
		
		# Cancel all active task futures
		for task_id, future in self._task_futures.items():
			if not future.done():
				future.cancel()
				self.logger.debug(f"Cancelled task {task_id}")
		
		# Close LLM client
		if self.llm_client:
			await self.llm_client.close()
			
		self.state = AgentState.TERMINATED
		await self._on_stop()
		
		self.logger.info(f"Agent {self.name} stopped")
	
	async def pause(self) -> None:
		"""Pause agent operations temporarily"""
		self.logger.info(f"Pausing agent {self.name}")
		self.state = AgentState.SUSPENDED
		await self._on_pause()
	
	async def resume(self) -> None:
		"""Resume agent operations from pause"""
		self.logger.info(f"Resuming agent {self.name}")
		self.state = AgentState.ACTIVE
		self.metrics.last_activity = datetime.now()
		await self._on_resume()
	
	# Abstract methods for specialization
	
	@abstractmethod
	async def process_task(self, task: Any) -> Any:
		"""Process a specific task - must be implemented by subclasses"""
		pass
	
	@abstractmethod
	async def handle_message(self, message: Any) -> Optional[Any]:
		"""Handle incoming message - must be implemented by subclasses"""
		pass
	
	@abstractmethod
	def get_capabilities(self) -> List[str]:
		"""Return list of agent capabilities"""
		pass
	
	@abstractmethod
	async def evaluate_task_fit(self, task: Any) -> float:
		"""Evaluate how well this agent fits a given task (0.0 to 1.0)"""
		pass
	
	# Task management
	
	async def assign_task(self, task: Any, priority: AgentPriority = AgentPriority.MEDIUM) -> str:
		"""Assign a new task to this agent"""
		if len(self.context.current_tasks) >= self.config.capabilities.max_concurrent_tasks:
			raise RuntimeError(f"Agent {self.name} at maximum task capacity")
		
		task_id = uuid7str()
		self.context.current_tasks.append(task_id)
		
		# Queue the task for processing
		await self.task_queue.put((task_id, task, priority))
		
		self.logger.info(f"Task {task_id} assigned to agent {self.name}")
		return task_id
	
	async def get_task_result(self, task_id: str, timeout: float = None) -> Any:
		"""Get the result of a specific task"""
		if task_id in self._task_futures:
			future = self._task_futures[task_id]
			try:
				if timeout:
					result = await asyncio.wait_for(future, timeout=timeout)
				else:
					result = await future
				return result
			except asyncio.TimeoutError:
				self.logger.warning(f"Task {task_id} timed out")
				raise
			finally:
				self._task_futures.pop(task_id, None)
		else:
			raise ValueError(f"Task {task_id} not found")
	
	async def cancel_task(self, task_id: str) -> bool:
		"""Cancel a running task"""
		if task_id in self._task_futures:
			future = self._task_futures[task_id]
			if not future.done():
				future.cancel()
				self.logger.info(f"Cancelled task {task_id}")
				return True
		
		if task_id in self.context.current_tasks:
			self.context.current_tasks.remove(task_id)
		
		return False
	
	# Communication methods
	
	async def send_message(self, recipient: str, message: Any, message_type: str = "general") -> str:
		"""Send a message to another agent or component"""
		message_id = uuid7str()
		
		# This would integrate with the message bus
		self.metrics.messages_sent += 1
		self.logger.debug(f"Sent message {message_id} to {recipient}")
		
		return message_id
	
	async def broadcast_message(self, message: Any, message_type: str = "broadcast") -> List[str]:
		"""Broadcast a message to all connected agents"""
		# This would integrate with the message bus
		self.metrics.messages_sent += 1
		self.logger.debug(f"Broadcast message of type {message_type}")
		
		return []  # Would return list of message IDs
	
	async def request_collaboration(self, agents: List[str], task: Any) -> str:
		"""Request collaboration with other agents on a task"""
		collaboration_id = uuid7str()
		self.context.collaboration_state[collaboration_id] = "pending"
		self.metrics.collaborations_initiated += 1
		
		self.logger.info(f"Requested collaboration {collaboration_id} with agents: {agents}")
		return collaboration_id
	
	# Memory and knowledge management
	
	def store_knowledge(self, key: str, value: Any, category: str = "general") -> None:
		"""Store knowledge in agent's knowledge base"""
		self._knowledge_base[key] = {
			"value": value,
			"category": category,
			"timestamp": datetime.now(),
			"access_count": 0
		}
		self.metrics.knowledge_items_learned += 1
		self.logger.debug(f"Stored knowledge: {key} in category {category}")
	
	def retrieve_knowledge(self, key: str) -> Optional[Any]:
		"""Retrieve knowledge from agent's knowledge base"""
		if key in self._knowledge_base:
			item = self._knowledge_base[key]
			item["access_count"] += 1
			return item["value"]
		return None
	
	def search_knowledge(self, query: str, category: Optional[str] = None) -> List[Dict[str, Any]]:
		"""Search knowledge base for relevant information"""
		results = []
		query_lower = query.lower()
		
		for key, item in self._knowledge_base.items():
			if category and item["category"] != category:
				continue
			
			# Simple keyword matching (would be more sophisticated in practice)
			if query_lower in key.lower() or query_lower in str(item["value"]).lower():
				results.append({
					"key": key,
					"value": item["value"],
					"category": item["category"],
					"relevance": 1.0  # Simplified relevance scoring
				})
		
		return sorted(results, key=lambda x: x["relevance"], reverse=True)
	
	def update_context(self, key: str, value: Any) -> None:
		"""Update working context"""
		self.context.working_memory[key] = value
		self.context.shared_context[key] = {
			"value": value,
			"agent_id": self.agent_id,
			"timestamp": datetime.now()
		}
	
	def get_context(self, key: str) -> Optional[Any]:
		"""Get item from working context"""
		return self.context.working_memory.get(key)
	
	# Goal and progress tracking
	
	def set_goal(self, goal_id: str, goal_description: str, target_value: float = 1.0) -> None:
		"""Set a goal for the agent"""
		self._goals[goal_id] = {
			"description": goal_description,
			"target": target_value,
			"current": 0.0,
			"created": datetime.now(),
			"last_updated": datetime.now()
		}
		self.context.goal_progress[goal_id] = 0.0
		self.logger.info(f"Set goal {goal_id}: {goal_description}")
	
	async def update_goal_progress(self, goal_id: str, progress: float) -> None:
		"""Update progress toward a goal"""
		if goal_id in self._goals:
			self._goals[goal_id]["current"] = progress
			self._goals[goal_id]["last_updated"] = datetime.now()
			self.context.goal_progress[goal_id] = progress
			
			if progress >= self._goals[goal_id]["target"]:
				self.logger.info(f"Goal {goal_id} completed!")
				await self._on_goal_completed(goal_id)
	
	def get_goal_status(self) -> Dict[str, Dict[str, Any]]:
		"""Get status of all goals"""
		return self._goals.copy()
	
	# Performance and metrics
	
	def get_metrics(self) -> AgentMetrics:
		"""Get current agent metrics"""
		return self.metrics.model_copy()
	
	# Tool Usage Methods
	
	async def use_tool(self, tool_name: str, **kwargs) -> Any:
		"""Use a tool by name with parameters"""
		if not self.tool_registry:
			self.logger.warning(f"Tool registry not available, cannot use tool: {tool_name}")
			return None
		
		try:
			# Use tool through registry
			result = await self.tool_registry.execute_tool(tool_name, **kwargs)
			
			# Log tool usage for context
			await self._notify_tool_usage(tool_name, result.success, result.metadata)
			
			self.logger.debug(f"Tool {tool_name} executed: success={result.success}")
			return result
			
		except Exception as e:
			self.logger.error(f"Tool usage failed for {tool_name}: {e}")
			return None
	
	async def search_web(self, query: str, max_results: int = 10) -> Optional[Any]:
		"""Convenience method for web search"""
		return await self.use_tool("web_search", query=query, max_results=max_results)
	
	async def scrape_url(self, url: str, extract_text: bool = True) -> Optional[Any]:
		"""Convenience method for web scraping"""
		return await self.use_tool("web_scrape", url=url, extract_text=extract_text)
	
	async def download_file(self, url: str, filename: Optional[str] = None) -> Optional[Any]:
		"""Convenience method for file download"""
		return await self.use_tool("download", url=url, filename=filename)
	
	async def read_file(self, file_path: str, encoding: str = "utf-8") -> Optional[Any]:
		"""Convenience method for file reading"""
		return await self.use_tool("file_read", file_path=file_path, encoding=encoding)
	
	async def write_file(self, file_path: str, content: str, encoding: str = "utf-8") -> Optional[Any]:
		"""Convenience method for file writing"""
		return await self.use_tool("file_write", file_path=file_path, content=content, encoding=encoding)
	
	async def list_directory(self, directory_path: str = ".", recursive: bool = False) -> Optional[Any]:
		"""Convenience method for directory listing"""
		return await self.use_tool("directory_list", directory_path=directory_path, recursive=recursive)
	
	async def search_files(self, search_term: str, search_path: str = ".", search_type: str = "name") -> Optional[Any]:
		"""Convenience method for file search"""
		return await self.use_tool("file_search", search_term=search_term, search_path=search_path, search_type=search_type)
	
	async def process_json(self, operation: str, data: Any, **kwargs) -> Optional[Any]:
		"""Convenience method for JSON processing"""
		return await self.use_tool("json_processor", operation=operation, data=data, **kwargs)
	
	async def process_csv(self, operation: str, data: Any, **kwargs) -> Optional[Any]:
		"""Convenience method for CSV processing"""
		return await self.use_tool("csv_processor", operation=operation, data=data, **kwargs)
	
	async def process_text(self, operation: str, text: str, **kwargs) -> Optional[Any]:
		"""Convenience method for text processing"""
		return await self.use_tool("text_processor", operation=operation, text=text, **kwargs)
	
	async def research_company(self, company_name: str, research_depth: str = "basic") -> Optional[Any]:
		"""Convenience method for company research"""
		return await self.use_tool("company_research", company_name=company_name, research_depth=research_depth)
	
	async def research_market(self, market_or_industry: str, geographic_scope: str = "global") -> Optional[Any]:
		"""Convenience method for market research"""
		return await self.use_tool("market_research", market_or_industry=market_or_industry, geographic_scope=geographic_scope)
	
	def get_available_tools(self) -> List[str]:
		"""Get list of available tools"""
		if self.tool_registry:
			return self.tool_registry.list_tools()
		return []
	
	def get_tool_capabilities(self) -> Dict[str, List[str]]:
		"""Get tool capabilities mapping"""
		if self.tool_registry:
			capabilities = {}
			for tool_name in self.tool_registry.list_tools():
				tool = self.tool_registry.get_tool(tool_name)
				if tool:
					capabilities[tool_name] = [cap.value for cap in tool.capabilities]
			return capabilities
		return {}
	
	async def _notify_tool_usage(self, tool_name: str, success: bool, metadata: Dict[str, Any]) -> None:
		"""Notify context manager about tool usage"""
		if self.context_manager:
			try:
				await self.context_manager.update_agent_status(self.agent_id, {
					"last_tool_used": tool_name,
					"tool_success": success,
					"tool_metadata": metadata
				})
			except Exception as e:
				self.logger.warning(f"Failed to notify tool usage: {e}")
	
	def get_health_status(self) -> Dict[str, Any]:
		"""Get agent health and status information"""
		return {
			"agent_id": self.agent_id,
			"name": self.name,
			"state": self.state.value,
			"uptime_seconds": self.metrics.uptime_seconds,
			"current_load": self.metrics.current_load,
			"success_rate": self.metrics.success_rate,
			"active_tasks": len(self.context.current_tasks),
			"max_tasks": self.config.capabilities.max_concurrent_tasks,
			"memory_usage": self.metrics.memory_usage,
			"last_activity": self.metrics.last_activity.isoformat(),
			"errors": self.metrics.errors_encountered,
			"is_healthy": self.state not in [AgentState.ERROR, AgentState.TERMINATED]
		}
	
	# Integration with other systems
	
	async def generate_with_llm(self, prompt: str, system_prompt: Optional[str] = None, 
								task_info: Optional[Dict[str, Any]] = None) -> str:
		"""Generate text using the configured LLM with context awareness"""
		if not self.llm_client:
			self.logger.warning("LLM client not available, returning fallback response")
			return "LLM processing unavailable"
		
		try:
			# Build context-aware system prompt
			if not system_prompt:
				if self.context_manager and task_info:
					# Use context manager to build comprehensive context prompt
					system_prompt = await self.context_manager.build_context_prompt(self.agent_id, task_info)
				else:
					# Fallback to basic agent context
					system_prompt = f"You are {self.name}, {self.config.description}. "
					system_prompt += f"Your primary role is {self.config.primary_role}. "
					system_prompt += "Respond professionally and helpfully."
			
			response = await self.llm_client.generate(prompt, system_prompt)
			self.logger.debug(f"LLM generated {len(response.content)} characters")
			return response.content
			
		except Exception as e:
			self.logger.error(f"LLM generation failed: {e}")
			return f"Error generating response: {str(e)}"
	
	async def chat_with_llm(self, messages: List[Dict[str, str]]) -> str:
		"""Have a conversation with the LLM using message history"""
		if not self.llm_client:
			return "LLM client not available"
		
		try:
			from ..llm.ollama_client import OllamaMessage
			
			# Convert messages to Ollama format
			ollama_messages = [
				OllamaMessage(role=msg["role"], content=msg["content"])
				for msg in messages
			]
			
			response = await self.llm_client.chat(ollama_messages)
			return response.content
			
		except Exception as e:
			self.logger.error(f"LLM chat failed: {e}")
			return f"Chat error: {str(e)}"
	
	async def check_llm_health(self) -> bool:
		"""Check if the LLM is available and responding"""
		if not self.llm_client:
			return False
		
		try:
			return await self.llm_client.health_check()
		except Exception as e:
			self.logger.error(f"LLM health check failed: {e}")
			return False
	
	def get_llm_config(self) -> Dict[str, Any]:
		"""Get current LLM configuration"""
		if not self.llm_client:
			return {"status": "not_available"}
		
		config = self.llm_client.get_config()
		return {
			"model": config.model,
			"host": config.host,
			"temperature": config.temperature,
			"max_tokens": config.max_tokens,
			"status": "available"
		}

	async def analyze_voice_consistency(self, text: str, organization: str) -> Optional[Any]:
		"""Analyze voice consistency using Voice DNA Engine"""
		if not self.voice_integrator:
			return None
		
		try:
			request = AnalysisRequest(
				analysis_type="validation_only",
				text_content=text,
				organization_name=organization
			)
			result = await self.voice_integrator.analyze(request)
			
			# Store insights in knowledge base
			self.store_knowledge(
				f"voice_analysis_{organization}", 
				result, 
				"voice_consistency"
			)
			
			return result
		except Exception as e:
			self.logger.error(f"Voice analysis failed: {e}")
			self.metrics.errors_encountered += 1
			return None
	
	# Internal processing methods
	
	async def _main_loop(self) -> None:
		"""Main agent processing loop"""
		start_time = datetime.now()
		
		while self._running:
			try:
				if self.state == AgentState.SUSPENDED:
					await asyncio.sleep(1)
					continue
				
				# Update uptime
				self.metrics.uptime_seconds = (datetime.now() - start_time).total_seconds()
				
				# Process tasks from queue
				if not self.task_queue.empty():
					await self._process_next_task()
				else:
					self.state = AgentState.IDLE
					await asyncio.sleep(0.1)
				
				# Periodic maintenance
				await self._periodic_maintenance()
				
			except Exception as e:
				self.logger.error(f"Error in main loop: {e}")
				self.metrics.errors_encountered += 1
				self.state = AgentState.ERROR
				await asyncio.sleep(1)
	
	async def _process_next_task(self) -> None:
		"""Process the next task from the queue"""
		try:
			# Get task with timeout
			task_id, task, priority = await asyncio.wait_for(
				self.task_queue.get(), 
				timeout=1.0
			)
			
			self.state = AgentState.BUSY
			self.logger.debug(f"Processing task {task_id}")
			
			# Create and store task future
			task_future = asyncio.create_task(self._execute_task(task_id, task))
			self._task_futures[task_id] = task_future
			
			# Update metrics
			self.metrics.last_activity = datetime.now()
			
		except asyncio.TimeoutError:
			pass  # No tasks available
		except Exception as e:
			self.logger.error(f"Error processing task: {e}")
			self.metrics.errors_encountered += 1
	
	async def _execute_task(self, task_id: str, task: Any) -> Any:
		"""Execute a specific task"""
		start_time = datetime.now()
		
		try:
			self.logger.info(f"Executing task {task_id}")
			
			# Call the specialized task processor
			result = await asyncio.wait_for(
				self.process_task(task),
				timeout=self.config.capabilities.task_timeout_seconds
			)
			
			# Update metrics
			execution_time = (datetime.now() - start_time).total_seconds()
			self.metrics.total_processing_time += execution_time
			self.metrics.tasks_completed += 1
			self.metrics.success_rate = (
				self.metrics.tasks_completed / 
				(self.metrics.tasks_completed + self.metrics.tasks_failed)
			)
			
			# Update average response time
			if self.metrics.tasks_completed > 0:
				self.metrics.average_response_time = (
					self.metrics.total_processing_time / self.metrics.tasks_completed
				)
			
			self.logger.info(f"Task {task_id} completed in {execution_time:.2f}s")
			return result
			
		except asyncio.TimeoutError:
			self.logger.warning(f"Task {task_id} timed out")
			self.metrics.tasks_failed += 1
			raise
		except Exception as e:
			self.logger.error(f"Task {task_id} failed: {e}")
			self.metrics.tasks_failed += 1
			self.metrics.errors_encountered += 1
			raise
		finally:
			# Clean up
			if task_id in self.context.current_tasks:
				self.context.current_tasks.remove(task_id)
			
			# Update load metrics
			self.metrics.current_load = len(self.context.current_tasks) / self.config.capabilities.max_concurrent_tasks
			if self.metrics.current_load > self.metrics.peak_load:
				self.metrics.peak_load = self.metrics.current_load
	
	async def _process_messages(self) -> None:
		"""Process incoming messages"""
		while self._running:
			try:
				if not self.message_queue.empty():
					message = await self.message_queue.get()
					response = await self.handle_message(message)
					
					if response:
						await self.response_queue.put(response)
					
					self.metrics.messages_received += 1
					self.metrics.last_activity = datetime.now()
				else:
					await asyncio.sleep(0.1)
			except Exception as e:
				self.logger.error(f"Error processing messages: {e}")
				self.metrics.errors_encountered += 1
	
	async def _monitor_performance(self) -> None:
		"""Monitor agent performance and health"""
		while self._running:
			try:
				# Update memory usage (simplified)
				self.metrics.memory_usage = len(self._knowledge_base) + len(self.context.working_memory)
				
				# Check for memory cleanup
				if self.metrics.memory_usage > self.config.capabilities.max_memory_items:
					await self._cleanup_memory()
				
				# Check for stuck tasks
				current_time = datetime.now()
				timeout_threshold = timedelta(seconds=self.config.capabilities.task_timeout_seconds * 2)
				
				for task_id, future in list(self._task_futures.items()):
					if current_time - self.metrics.last_activity > timeout_threshold:
						if not future.done():
							future.cancel()
							self.logger.warning(f"Cancelled stuck task {task_id}")
						self._task_futures.pop(task_id, None)
				
				await asyncio.sleep(30)  # Monitor every 30 seconds
				
			except Exception as e:
				self.logger.error(f"Error in performance monitoring: {e}")
				await asyncio.sleep(60)
	
	async def _periodic_maintenance(self) -> None:
		"""Perform periodic maintenance tasks"""
		# This runs frequently, so keep it lightweight
		pass
	
	async def _cleanup_memory(self) -> None:
		"""Clean up old memory items"""
		current_time = datetime.now()
		retention_hours = self.config.capabilities.context_retention_hours
		cutoff_time = current_time - timedelta(hours=retention_hours)
		
		# Clean up old knowledge items (keep most accessed)
		items_to_remove = []
		for key, item in self._knowledge_base.items():
			if item["timestamp"] < cutoff_time and item["access_count"] < 2:
				items_to_remove.append(key)
		
		for key in items_to_remove[:len(items_to_remove)//2]:  # Remove half of candidates
			del self._knowledge_base[key]
		
		self.logger.info(f"Cleaned up {len(items_to_remove)} memory items")
	
	def _setup_llm_client(self) -> None:
		"""Initialize Ollama LLM client with agent configuration"""
		try:
			ollama_config = OllamaConfig(
				host=self.config.llm_host,
				model=self.config.llm_model,
				temperature=self.config.llm_temperature,
				max_tokens=self.config.llm_max_tokens
			)
			self.llm_client = OllamaClient(ollama_config)
			self.logger.info(f"LLM client initialized: {self.config.llm_model} @ {self.config.llm_host}")
		except Exception as e:
			self.logger.error(f"Failed to initialize LLM client: {e}")
			self.llm_client = None

	def _setup_message_handlers(self) -> None:
		"""Set up message handlers for different message types"""
		# Override in subclasses to add specific handlers
		pass
	
	def _initialize_goals(self) -> None:
		"""Initialize default goals for the agent"""
		# Override in subclasses to set specific goals
		self.set_goal("operational_efficiency", "Maintain high task completion rate", 0.9)
		self.set_goal("response_time", "Maintain fast response times", 0.8)
	
	async def _register_with_context_manager(self) -> None:
		"""Register this agent with the context manager"""
		if not self.context_manager:
			return
		
		try:
			agent_info = {
				"name": self.name,
				"role": self.config.primary_role,
				"capabilities": self.get_capabilities() if hasattr(self, 'get_capabilities') else [],
				"state": self.state.value
			}
			
			success = await self.context_manager.register_agent(self.agent_id, agent_info)
			if success:
				self.logger.info(f"Agent {self.name} registered with context manager")
			else:
				self.logger.warning(f"Failed to register agent {self.name} with context manager")
		except Exception as e:
			self.logger.error(f"Error registering with context manager: {e}")
	
	async def _update_context_status(self, status_update: Dict[str, Any]) -> None:
		"""Update agent status in context manager"""
		if self.context_manager:
			try:
				await self.context_manager.update_agent_status(self.agent_id, status_update)
			except Exception as e:
				self.logger.warning(f"Failed to update context status: {e}")
	
	async def _notify_task_start(self, task_info: Dict[str, Any]) -> None:
		"""Notify context manager that a task has started"""
		if self.context_manager:
			try:
				await self.context_manager.register_task_start(self.agent_id, task_info)
			except Exception as e:
				self.logger.warning(f"Failed to notify task start: {e}")
	
	async def _notify_task_completion(self, task_id: str, results: Dict[str, Any]) -> None:
		"""Notify context manager that a task has completed"""
		if self.context_manager:
			try:
				await self.context_manager.register_task_completion(self.agent_id, task_id, results)
			except Exception as e:
				self.logger.warning(f"Failed to notify task completion: {e}")
	
	# Lifecycle hooks for subclasses
	
	async def _on_start(self) -> None:
		"""Called when agent starts"""
		pass
	
	async def _on_stop(self) -> None:
		"""Called when agent stops"""
		pass
	
	async def _on_pause(self) -> None:
		"""Called when agent is paused"""
		pass
	
	async def _on_resume(self) -> None:
		"""Called when agent resumes"""
		pass
	
	async def _on_goal_completed(self, goal_id: str) -> None:
		"""Called when a goal is completed"""
		pass
	
	# String representation
	
	def __str__(self) -> str:
		return f"Agent({self.name}:{self.agent_id[:8]}:{self.state.value})"
	
	def __repr__(self) -> str:
		return (f"Agent(name='{self.name}', id='{self.agent_id}', "
				f"state='{self.state.value}', tasks={len(self.context.current_tasks)})")