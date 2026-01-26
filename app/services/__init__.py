"""
Service layer for DocuFusion Flask-AppBuilder application.

This module provides service classes that encapsulate business logic
and integrate with the proposal_writer backend components.
"""

from .document_service import DocumentService
from .template_service import TemplateService
from .ai_service import AIService
from .collaboration_service import CollaborationService
from .workflow_service import WorkflowService
from .integration_service import IntegrationService

__all__ = [
	'DocumentService',
	'TemplateService', 
	'AIService',
	'CollaborationService',
	'WorkflowService',
	'IntegrationService'
]