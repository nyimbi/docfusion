"""
Agent Integration

Integration layer connecting the AI agent system with existing proposal
generation infrastructure and external services.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

from .proposal_integration import ProposalIntegration, ProposalAgentBridge
from .voice_integration import VoiceIntegrator as AgentVoiceIntegrator
from .document_integration import DocumentEngineIntegration, DocumentAgentBridge  
from .storage_integration import StorageIntegration, RAGIntegration
from .workflow_integration import WorkflowIntegration, AgentWorkflowBridge
from .service_registry import ServiceRegistry, ServiceIntegration

__all__ = [
	"ProposalIntegration",
	"ProposalAgentBridge",
	"AgentVoiceIntegrator",
	"DocumentEngineIntegration", 
	"DocumentAgentBridge",
	"StorageIntegration",
	"RAGIntegration",
	"WorkflowIntegration",
	"AgentWorkflowBridge",
	"ServiceRegistry",
	"ServiceIntegration"
]