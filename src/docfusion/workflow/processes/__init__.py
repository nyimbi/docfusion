"""
Workflow process definition and template management.

This package provides visual workflow design capabilities, industry-specific
workflow templates, and process validation functionality.
"""

from .process_definition import (
	ProcessDefinition,
	WorkflowNode,
	WorkflowEdge,
	NodeType,
	WorkflowValidationResult,
	ProcessMetadata
)
from .workflow_template import (
	WorkflowTemplate,
	TemplateCategory,
	TemplateParameter,
	TemplateInstance,
	IndustryTemplate
)

__all__ = [
	'ProcessDefinition',
	'WorkflowNode',
	'WorkflowEdge',
	'NodeType',
	'WorkflowValidationResult',
	'ProcessMetadata',
	'WorkflowTemplate',
	'TemplateCategory',
	'TemplateParameter',
	'TemplateInstance',
	'IndustryTemplate'
]