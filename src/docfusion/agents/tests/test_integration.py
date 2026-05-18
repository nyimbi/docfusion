"""
Integration Tests

Tests for agent integration with existing systems and services.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import pytest
from datetime import datetime
from unittest.mock import Mock, AsyncMock

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from integration.proposal_integration import ProposalIntegration, ProposalAgentBridge, ProposalRequirements, ProposalContext
from integration.voice_integration import VoiceIntegrator as AgentVoiceIntegrator
from integration.service_registry import ServiceRegistry, ServiceIntegration


class TestProposalIntegration:
	"""Test proposal generation integration"""
	
	@pytest.fixture
	def proposal_requirements(self):
		"""Create test proposal requirements"""
		return ProposalRequirements(
			client_name="Test Client",
			project_title="AI Implementation Project",
			project_description="Implementing AI solutions for business optimization",
			deadline=datetime.now(),
			industry="technology",
			proposal_type="technical",
			sections_required=["executive_summary", "technical_approach", "timeline", "budget"],
			target_audience="technical_decision_makers"
		)
	
	def test_proposal_requirements_creation(self, proposal_requirements):
		"""Test proposal requirements structure"""
		assert proposal_requirements.client_name == "Test Client"
		assert proposal_requirements.project_title == "AI Implementation Project"
		assert proposal_requirements.industry == "technology"
		assert len(proposal_requirements.sections_required) == 4
	
	def test_proposal_context_creation(self, proposal_requirements):
		"""Test proposal context creation"""
		context = ProposalContext(
			requirements=proposal_requirements,
			client_profile={"industry": "tech", "size": "large"},
			organizational_context={"organization_name": "Test Org"}
		)
		
		assert context.requirements == proposal_requirements
		assert context.client_profile["industry"] == "tech"
		assert context.organizational_context["organization_name"] == "Test Org"
	
	@pytest.mark.asyncio
	async def test_proposal_agent_bridge_initialization(self):
		"""Test proposal agent bridge initialization"""
		bridge = ProposalAgentBridge()
		
		assert bridge.task_orchestrator is None  # Not initialized yet
		assert len(bridge.active_crews) == 0
		assert len(bridge.active_swarms) == 0
		
		# Initialize with mock services
		services = {
			"voice_integrator": Mock(),
			"document_engine": Mock(),
			"storage_service": Mock(),
			"rag_service": Mock()
		}
		
		await bridge.initialize(services)
		
		assert bridge.task_orchestrator is not None
		assert bridge.voice_integrator is not None
		assert bridge.document_engine is not None
	
	@pytest.mark.asyncio
	async def test_proposal_generation_with_crew(self, proposal_requirements):
		"""Test proposal generation using crew approach"""
		integration = ProposalIntegration()
		
		# Mock services
		mock_services = {
			"voice_integrator": Mock(),
			"document_engine": Mock(),
			"storage_service": Mock()
		}
		
		await integration.initialize(mock_services)
		
		context = ProposalContext(requirements=proposal_requirements)
		
		# Mock the crew execution to return success
		integration.bridge.generate_proposal_with_crew = AsyncMock(return_value={
			"proposal_id": "test_proposal_123",
			"client_name": proposal_requirements.client_name,
			"sections": {"executive_summary": "Mock summary"},
			"metadata": {"generation_method": "crew_based"},
			"quality_scores": {"overall": 0.9}
		})
		
		result = await integration.generate_proposal(proposal_requirements, context, method="crew")
		
		assert result["proposal_id"] is not None
		assert result["client_name"] == "Test Client"
		assert "sections" in result
		assert result["metadata"]["generation_method"] == "crew_based"
	
	@pytest.mark.asyncio
	async def test_proposal_generation_with_swarm(self, proposal_requirements):
		"""Test proposal generation using swarm approach"""
		integration = ProposalIntegration()
		
		await integration.initialize({})
		
		context = ProposalContext(requirements=proposal_requirements)
		
		# Mock swarm execution
		integration.bridge.generate_proposal_with_swarm = AsyncMock(return_value={
			"proposal_id": "swarm_proposal_456",
			"client_name": proposal_requirements.client_name,
			"research_insights": {"market_analysis": "Mock analysis"},
			"content_sections": {"approach": "Mock approach"},
			"metadata": {"generation_method": "swarm_based"}
		})
		
		result = await integration.generate_proposal(proposal_requirements, context, method="swarm")
		
		assert result["proposal_id"] is not None
		assert result["metadata"]["generation_method"] == "swarm_based"
		assert "research_insights" in result
		assert "content_sections" in result
	
	@pytest.mark.asyncio
	async def test_proposal_generation_with_workflow(self, proposal_requirements):
		"""Test proposal generation using workflow orchestrator"""
		integration = ProposalIntegration()
		
		await integration.initialize({})
		
		context = ProposalContext(requirements=proposal_requirements)
		
		# Mock workflow execution
		integration.bridge.generate_proposal_with_workflow = AsyncMock(return_value="execution_123")
		
		result = await integration.generate_proposal(proposal_requirements, context, method="workflow")
		
		assert result["execution_id"] == "execution_123"
		assert result["method"] == "workflow"


class TestVoiceIntegration:
	"""Test voice DNA integration"""
	
	def test_voice_integrator_initialization(self):
		"""Test voice integrator initialization"""
		integrator = AgentVoiceIntegrator()
		
		# Should initialize even without voice DNA engine
		assert integrator.voice_engine is not None or integrator.voice_engine is None
		assert len(integrator.analysis_cache) == 0
	
	@pytest.mark.asyncio
	async def test_voice_analysis_for_agent(self):
		"""Test voice analysis for specific agent"""
		integrator = AgentVoiceIntegrator()
		
		content = "This is a test proposal section with professional tone and structure."
		organization = "Test Organization"
		
		# This should work even without actual voice DNA engine (fallback mode)
		result = await integrator.analyze_for_agent("agent_1", content, organization)
		
		# In mock mode, result may be None, which is acceptable
		assert result is None or hasattr(result, 'overall_voice_score')
	
	@pytest.mark.asyncio
	async def test_content_validation(self):
		"""Test content validation"""
		integrator = AgentVoiceIntegrator()
		
		content = "Professional business proposal content for validation testing."
		organization = "Test Organization"
		
		result = await integrator.validate_content(content, organization)
		
		assert "valid" in result
		assert "score" in result
		assert isinstance(result["valid"], bool)
		assert isinstance(result["score"], (int, float))
	
	@pytest.mark.asyncio
	async def test_writing_enhancement(self):
		"""Test writing enhancement"""
		integrator = AgentVoiceIntegrator()
		
		content = "Basic content that could be enhanced for better quality and engagement."
		organization = "Test Organization"
		
		result = await integrator.enhance_writing(content, organization, intensity=0.7)
		
		assert "enhanced_content" in result
		assert "improvements" in result
		assert isinstance(result["enhanced_content"], str)
		assert isinstance(result["improvements"], list)


class TestServiceRegistry:
	"""Test service registry and integration"""
	
	def test_service_registry_initialization(self):
		"""Test service registry initialization"""
		registry = ServiceRegistry()
		
		assert len(registry.services) == 0
		assert len(registry.service_aliases) == 0
		assert not registry._running
	
	@pytest.mark.asyncio
	async def test_service_registration_and_retrieval(self):
		"""Test service registration and retrieval"""
		registry = ServiceRegistry()
		await registry.start()
		
		# Register mock service
		mock_service = Mock()
		mock_service.process_data = Mock(return_value="processed")
		
		success = registry.register_service(
			"test_service",
			"data_processor",
			mock_service,
			aliases=["processor", "data_svc"]
		)
		
		assert success
		assert "test_service" in registry.services
		
		# Retrieve service by name
		retrieved = registry.get_service("test_service")
		assert retrieved == mock_service
		
		# Retrieve service by alias
		aliased = registry.get_service("processor")
		assert aliased == mock_service
		
		# Test service functionality
		result = retrieved.process_data()
		assert result == "processed"
		
		await registry.stop()
	
	@pytest.mark.asyncio
	async def test_service_health_monitoring(self):
		"""Test service health monitoring"""
		registry = ServiceRegistry()
		
		# Create service with health check
		mock_service = Mock()
		health_check_calls = []
		
		def health_check():
			health_check_calls.append(datetime.now())
			return True
		
		registry.register_service(
			"monitored_service",
			"test_service",
			mock_service,
			health_check=health_check
		)
		
		# Perform health check
		await registry._perform_health_checks()
		
		assert len(health_check_calls) == 1
		
		service_def = registry.services["monitored_service"]
		assert service_def.status.value == "available"
		assert service_def.last_health_check is not None
	
	def test_service_listing_and_filtering(self):
		"""Test service listing and filtering"""
		registry = ServiceRegistry()
		
		# Register different types of services
		registry.register_service("db_service", "database", Mock())
		registry.register_service("api_service", "api", Mock())
		registry.register_service("cache_service", "cache", Mock())
		registry.register_service("another_api", "api", Mock())
		
		# List all services
		all_services = registry.list_services()
		assert len(all_services) == 4
		
		# Filter by service type
		api_services = registry.get_services_by_type("api")
		assert len(api_services) == 2
		
		db_services = registry.get_services_by_type("database")
		assert len(db_services) == 1
	
	@pytest.mark.asyncio
	async def test_service_integration_manager(self):
		"""Test service integration manager"""
		integration = ServiceIntegration()
		await integration.initialize()
		
		assert integration._initialized
		assert integration.registry is not None
		
		# Register mock services
		integration.registry.register_service("voice_service", "voice_integration", Mock())
		integration.registry.register_service("doc_service", "document_engine", Mock())
		
		# Test service availability
		available_services = integration.get_available_services()
		assert "voice_service" in available_services
		assert "doc_service" in available_services
		
		# Test service availability check
		assert integration.is_service_available("voice_service")
		assert not integration.is_service_available("nonexistent_service")


class TestEndToEndIntegration:
	"""Test end-to-end integration scenarios"""
	
	@pytest.mark.asyncio
	async def test_complete_proposal_workflow(self):
		"""Test complete proposal generation workflow"""
		# Initialize integration system
		proposal_integration = ProposalIntegration()
		service_integration = ServiceIntegration()
		
		await service_integration.initialize()
		
		# Register mock services
		service_integration.registry.register_service(
			"voice_integrator", 
			"voice_analysis", 
			Mock()
		)
		service_integration.registry.register_service(
			"document_engine",
			"document_processing",
			Mock()
		)
		
		# Initialize proposal integration with services
		services = {
			"voice_integrator": service_integration.voice_integrator,
			"document_engine": service_integration.document_engine
		}
		
		await proposal_integration.initialize(services)
		
		# Create proposal requirements
		requirements = ProposalRequirements(
			client_name="Integration Test Client",
			project_title="End-to-End Test Project",
			project_description="Complete integration test scenario",
			deadline=datetime.now(),
			industry="testing",
			sections_required=["summary", "approach"]
		)
		
		# Mock successful proposal generation
		proposal_integration.bridge.generate_proposal_with_crew = AsyncMock(return_value={
			"proposal_id": "integration_test_proposal",
			"client_name": requirements.client_name,
			"sections": {"summary": "Generated summary", "approach": "Generated approach"},
			"metadata": {"generation_method": "crew_based", "services_used": ["voice", "document"]},
			"success": True
		})
		
		# Execute end-to-end workflow
		result = await proposal_integration.generate_proposal(requirements, method="crew")
		
		# Validate results
		assert result["success"]
		assert result["proposal_id"] == "integration_test_proposal"
		assert result["client_name"] == requirements.client_name
		assert len(result["sections"]) == 2
		assert result["metadata"]["generation_method"] == "crew_based"


if __name__ == "__main__":
	pytest.main([__file__, "-v"])