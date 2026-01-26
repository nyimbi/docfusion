"""
Workflow automation package for orchestrating proposal creation workflows.

This package provides automated workflow execution, task scheduling, and 
process coordination capabilities for complex document creation workflows.
"""

from .workflow_engine import WorkflowEngine, WorkflowInstance, ProcessState
from .task_scheduler import TaskScheduler, ScheduledTask, SchedulingStrategy

__all__ = [
    'WorkflowEngine',
    'WorkflowInstance', 
    'ProcessState',
    'TaskScheduler',
    'ScheduledTask',
    'SchedulingStrategy'
]