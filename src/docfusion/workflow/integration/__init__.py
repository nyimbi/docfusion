"""
Workflow integration package for connecting workflow automation with document creation processes.

This package provides bridges and adapters that integrate the Week 19 workflow automation
system with existing document creation components including DocumentEngine, API endpoints,
and storage systems.
"""

from .workflow_document_bridge import WorkflowDocumentBridge, WorkflowDocumentConfiguration
from .workflow_request_extensions import WorkflowEnabledDocumentRequest, WorkflowConfiguration

# TODO: workflow_storage_adapter module does not exist yet
# from .workflow_storage_adapter import WorkflowStorageAdapter, WorkflowMetadata

__all__ = [
	'WorkflowDocumentBridge',
	'WorkflowDocumentConfiguration',
	'WorkflowEnabledDocumentRequest',
	'WorkflowConfiguration',
	# 'WorkflowStorageAdapter',
	# 'WorkflowMetadata'
]
