"""
Agent Memory and Context Management

Shared knowledge management, context persistence, and collective memory
systems for multi-agent coordination and learning.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

from .memory_manager import MemoryManager, MemoryConfig, MemoryType
from .context_manager import ContextManager, ContextScope, SharedContext
from .knowledge_base import KnowledgeBase, KnowledgeEntry, KnowledgeGraph
from .learning_system import LearningSystem, ExperienceRecord, AdaptationEngine

__all__ = [
	"MemoryManager",
	"MemoryConfig", 
	"MemoryType",
	"ContextManager",
	"ContextScope",
	"SharedContext",
	"KnowledgeBase",
	"KnowledgeEntry",
	"KnowledgeGraph",
	"LearningSystem",
	"ExperienceRecord",
	"AdaptationEngine"
]