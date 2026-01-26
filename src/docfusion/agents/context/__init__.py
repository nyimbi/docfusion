"""
Context Management Module

Provides context and inter-agent awareness capabilities for the multi-agent system.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

from .context_manager import (
    ContextManager,
    ContextType,
    ContextScope,
    ContextEntry,
    AgentAwarenessInfo,
    WorkflowContext,
    TaskInterdependency,
    get_context_manager
)

__all__ = [
    "ContextManager",
    "ContextType",
    "ContextScope", 
    "ContextEntry",
    "AgentAwarenessInfo",
    "WorkflowContext",
    "TaskInterdependency",
    "get_context_manager"
]