"""
AI Agent System for Proposal Writer

Multi-agent orchestration system inspired by CrewAI and swarm intelligence
for collaborative proposal generation, research, and review processes.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

from .core import (
	Agent,
	AgentRole,
	AgentCapability,
	AgentGoal,
	AgentConfig,
	AgentState,
	AgentMessage,
	MessageType,
	MessagePriority
)

from .specialists import (
	ResearchAgent,
	WriterAgent,
	ReviewerAgent,
	CoordinatorAgent,
	AnalysisAgent,
	QualityAgent
)

from .orchestration import (
	AgentCrew,
	AgentSwarm,
	TaskOrchestrator,
	WorkflowEngine,
	CrewConfig,
	SwarmConfig
)

from .communication import (
	MessageBus,
	CommunicationProtocol,
	AgentChannel,
	BroadcastChannel,
	DirectChannel
)

from .memory import (
	MemoryManager,
	MemoryConfig,
	MemoryType,
	ContextManager,
	ContextScope,
	SharedContext,
	KnowledgeBase,
	LearningSystem
)

__version__ = "1.0.0"

__all__ = [
	# Core
	"Agent",
	"AgentRole",
	"AgentCapability", 
	"AgentGoal",
	"AgentConfig",
	"AgentState",
	"AgentMessage",
	"MessageType",
	"MessagePriority",
	
	# Specialists
	"ResearchAgent",
	"WriterAgent", 
	"ReviewerAgent",
	"CoordinatorAgent",
	"AnalysisAgent",
	"QualityAgent",
	
	# Orchestration
	"AgentCrew",
	"AgentSwarm",
	"TaskOrchestrator",
	"WorkflowEngine",
	"CrewConfig",
	"SwarmConfig",
	
	# Communication
	"MessageBus",
	"CommunicationProtocol",
	"AgentChannel",
	"BroadcastChannel",
	"DirectChannel",
	
	# Memory
	"SharedMemory",
	"AgentMemory",
	"ContextManager",
	"KnowledgeBase",
	"ConversationHistory",
	
	# Tasks
	"AgentTask",
	"TaskType",
	"TaskPriority",
	"TaskStatus", 
	"TaskResult",
	"WorkflowTask",
	"TaskScheduler",
	"TaskDependency"
]