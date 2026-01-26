"""
End-to-End System Tests

Comprehensive tests that validate the complete AI agent system
functionality including full proposal generation workflows.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Import all major system components
from core.agent import Agent, AgentConfig
from specialists.research_agent import ResearchAgent
from specialists.writer_agent import WriterAgent
from specialists.reviewer_agent import ReviewerAgent
from specialists.quality_agent import QualityAgent
from orchestration.crew_manager import AgentCrew, CrewConfig, CrewTask
from orchestration.swarm_manager import AgentSwarm, SwarmConfig, SwarmTask
from orchestration.task_orchestrator import TaskOrchestrator
from communication.message_bus import MessageBus
from memory.memory_manager import MemoryManager
from memory.context_manager import ContextManager
from integration.proposal_integration import ProposalIntegration, ProposalRequirements


class TestSystemInitialization:
	"""Test complete system initialization"""
	
	@pytest.mark.asyncio
	async def test_full_system_startup(self):
		"""Test that all major components can be initialized"""
		components = {}
		
		try:
			# Initialize core components
			components["message_bus"] = MessageBus()
			await components["message_bus"].start()
			
			components["orchestrator"] = TaskOrchestrator()
			await components["orchestrator"].start()
			
			components["memory_manager"] = MemoryManager("system")
			await components["memory_manager"].start()
			
			components["context_manager"] = ContextManager()
			await components["context_manager"].start()
			
			# Initialize integration
			components["proposal_integration"] = ProposalIntegration()
			await components["proposal_integration"].initialize({})
			
			# Verify all components initialized successfully
			assert components["message_bus"]._running
			assert components["orchestrator"]._running
			assert components["memory_manager"]._running
			assert components["context_manager"]._running
			assert components["proposal_integration"]._initialized
			
		finally:
			# Clean up
			for component in components.values():
				if hasattr(component, 'stop'):
					try:
						await component.stop()
					except:
						pass


class TestAgentCreationAndCoordination:
	"""Test agent creation and coordination"""
	
	@pytest.mark.asyncio
	async def test_agent_creation_and_communication(self):
		"""Test creating agents and basic communication"""
		message_bus = MessageBus()
		await message_bus.start()
		
		try:
			# Create different types of agents
			agents = {}
			
			# Research Agent
			research_config = AgentConfig(
				name="Research Agent",
				description="Test research agent",
				primary_role="researcher"
			)
			agents["researcher"] = ResearchAgent(research_config)
			
			# Writer Agent
			writer_config = AgentConfig(
				name="Writer Agent", 
				description="Test writer agent",
				primary_role="writer"
			)
			agents["writer"] = WriterAgent(writer_config)
			
			# Quality Agent
			quality_config = AgentConfig(
				name="Quality Agent",
				description="Test quality agent", 
				primary_role="quality_assurer"
			)
			agents["quality"] = QualityAgent(quality_config)
			
			# Start all agents
			for agent in agents.values():
				await agent.start()
				# Register with message bus
				agent_info = {"name": agent.name, "type": agent.config.primary_role}
				await message_bus.register_agent(agent.agent_id, agent_info)
			
			# Verify agents are running
			for agent in agents.values():
				assert agent.state.value == "active"
			
			# Test capabilities
			research_caps = agents["researcher"].get_capabilities()
			writer_caps = agents["writer"].get_capabilities()
			quality_caps = agents["quality"].get_capabilities()
			
			assert len(research_caps) > 0
			assert len(writer_caps) > 0
			assert len(quality_caps) > 0
			
			# Verify different capabilities
			assert any("research" in cap.lower() for cap in research_caps)
			assert any("writ" in cap.lower() for cap in writer_caps)
			assert any("quality" in cap.lower() for cap in quality_caps)
			
		finally:
			# Clean up
			for agent in agents.values():
				try:
					await agent.stop()
				except:
					pass
			await message_bus.stop()


class TestCrewOrchestration:
	"""Test crew-based orchestration"""
	
	@pytest.mark.asyncio
	async def test_crew_proposal_workflow(self):
		"""Test complete crew-based proposal workflow"""
		# Create crew configuration
		crew_config = CrewConfig(
			name="Proposal Crew",
			description="Test proposal generation crew",
			required_roles=["researcher", "writer", "quality"],
			min_agents=3,
			collaboration_mode="coordinated"
		)
		
		crew = AgentCrew(crew_config)
		
		# Mock agent creation for testing
		mock_agents = []
		for i, role in enumerate(["researcher", "writer", "quality"]):
			mock_agent = Mock()
			mock_agent.agent_id = f"agent_{i}"
			mock_agent.state = "inactive"
			mock_agent.start = AsyncMock()
			mock_agent.stop = AsyncMock()
			mock_agent.config.capabilities.max_concurrent_tasks = 2
			mock_agent.evaluate_task_fit = AsyncMock(return_value=0.8)
			mock_agent.handle_message = AsyncMock(return_value=Mock())
			mock_agent.get_health_status = Mock(return_value={"is_healthy": True})
			
			await crew.add_agent(mock_agent, role)
			mock_agents.append(mock_agent)
		
		# Create workflow tasks
		tasks = [
			CrewTask(
				task_id="research_task",
				description="Research client and industry",
				task_type="research"
			),
			CrewTask(
				task_id="writing_task",
				description="Write proposal sections",
				task_type="writing",
				dependencies=["research_task"]
			),
			CrewTask(
				task_id="quality_task",
				description="Quality assurance and review",
				task_type="quality",
				dependencies=["writing_task"]
			)
		]
		
		# Mock workflow execution
		with patch.object(crew, '_wait_for_completion', new_callable=AsyncMock):
			# Execute workflow
			result = await crew.execute_workflow(tasks)
			
			# Verify execution
			assert result["success"]
			assert len(crew.tasks) == 3
			
			# Verify all agents were started
			for mock_agent in mock_agents:
				mock_agent.start.assert_called()


class TestSwarmOrchestration:
	"""Test swarm-based orchestration"""
	
	@pytest.mark.asyncio
	async def test_swarm_proposal_workflow(self):
		"""Test swarm intelligence workflow"""
		# Create swarm configuration
		swarm_config = SwarmConfig(
			name="Proposal Swarm",
			description="Test proposal generation swarm",
			target_size=4,
			primary_behavior="collaborative"
		)
		
		swarm = AgentSwarm(swarm_config)
		
		# Initialize with mock agents
		mock_agent_configs = [
			{"type": "researcher", "config": {}},
			{"type": "writer", "config": {}},
			{"type": "quality", "config": {}},
			{"type": "coordinator", "config": {}}
		]
		
		# Mock agent creation
		with patch.object(swarm, '_create_agent') as mock_create:
			mock_agents = []
			for i in range(4):
				mock_agent = Mock()
				mock_agent.agent_id = f"swarm_agent_{i}"
				mock_agent.state = "inactive" 
				mock_agent.start = AsyncMock()
				mock_agent.get_capabilities = Mock(return_value=["research", "analysis"])
				mock_agents.append(mock_agent)
			
			mock_create.side_effect = mock_agents
			
			# Initialize swarm
			success = await swarm.initialize_swarm(mock_agent_configs)
			assert success
			assert len(swarm.agents) == 4
			
			# Create swarm tasks
			swarm_tasks = [
				SwarmTask(
					task_id="distributed_research",
					description="Distributed research task",
					task_type="research",
					complexity=0.6,
					required_agents=2
				),
				SwarmTask(
					task_id="collaborative_writing", 
					description="Collaborative writing task",
					task_type="writing",
					complexity=0.7,
					required_agents=2
				)
			]
			
			# Mock workflow execution
			with patch.object(swarm, '_monitor_task_progress', new_callable=AsyncMock), \
				 patch.object(swarm, '_compile_workflow_results', new_callable=AsyncMock) as mock_results:
				
				mock_results.return_value = {"success": True, "results": {}}
				
				# Execute swarm workflow
				result = await swarm.execute_swarm_workflow(swarm_tasks)
				
				assert result["success"]


class TestCompleteProposalGeneration:
	"""Test complete proposal generation workflow"""
	
	@pytest.mark.asyncio
	async def test_end_to_end_proposal_generation(self):
		"""Test complete end-to-end proposal generation"""
		# Initialize proposal integration
		integration = ProposalIntegration()
		
		# Mock services
		mock_services = {
			"voice_integrator": Mock(),
			"document_engine": Mock(),
			"storage_service": Mock(),
			"rag_service": Mock()
		}
		
		await integration.initialize(mock_services)
		
		# Create proposal requirements
		requirements = ProposalRequirements(
			client_name="End-to-End Test Client",
			project_title="Complete AI System Implementation",
			project_description="Full-scale AI system implementation with multi-agent coordination",
			deadline=datetime.now() + timedelta(days=30),
			industry="technology",
			proposal_type="technical",
			sections_required=[
				"executive_summary",
				"technical_approach",
				"implementation_plan", 
				"risk_assessment",
				"timeline",
				"budget",
				"team_structure"
			],
			target_audience="technical_leadership"
		)
		
		# Mock successful proposal generation for each method
		crew_result = {
			"proposal_id": "crew_proposal_123",
			"client_name": requirements.client_name,
			"sections": {section: f"Generated {section} content" for section in requirements.sections_required},
			"metadata": {
				"generation_method": "crew_based",
				"quality_scores": {"overall": 0.92, "voice_consistency": 0.94},
				"completion_time": "45 minutes"
			},
			"success": True
		}
		
		swarm_result = {
			"proposal_id": "swarm_proposal_456", 
			"client_name": requirements.client_name,
			"research_insights": {
				"market_analysis": "Comprehensive market research findings",
				"competitive_landscape": "Detailed competitive analysis",
				"technical_requirements": "Technical feasibility assessment"
			},
			"content_sections": {section: f"Swarm-generated {section}" for section in requirements.sections_required},
			"metadata": {
				"generation_method": "swarm_based",
				"collective_intelligence_score": 0.88,
				"completion_time": "38 minutes"
			},
			"success": True
		}
		
		workflow_execution_id = "workflow_execution_789"
		
		# Mock generation methods
		integration.bridge.generate_proposal_with_crew = AsyncMock(return_value=crew_result)
		integration.bridge.generate_proposal_with_swarm = AsyncMock(return_value=swarm_result)  
		integration.bridge.generate_proposal_with_workflow = AsyncMock(return_value=workflow_execution_id)
		
		# Test crew-based generation
		crew_proposal = await integration.generate_proposal(requirements, method="crew")
		
		assert crew_proposal["success"]
		assert crew_proposal["proposal_id"] == "crew_proposal_123"
		assert len(crew_proposal["sections"]) == 7
		assert crew_proposal["metadata"]["quality_scores"]["overall"] > 0.9
		
		# Test swarm-based generation
		swarm_proposal = await integration.generate_proposal(requirements, method="swarm")
		
		assert swarm_proposal["success"]
		assert swarm_proposal["proposal_id"] == "swarm_proposal_456"
		assert "research_insights" in swarm_proposal
		assert len(swarm_proposal["content_sections"]) == 7
		
		# Test workflow-based generation
		workflow_result = await integration.generate_proposal(requirements, method="workflow")
		
		assert workflow_result["execution_id"] == workflow_execution_id
		assert workflow_result["method"] == "workflow"
	
	@pytest.mark.asyncio
	async def test_system_performance_and_scalability(self):
		"""Test system performance under load"""
		integration = ProposalIntegration()
		await integration.initialize({})
		
		# Create multiple concurrent proposal requests
		requirements_list = []
		for i in range(5):
			requirements = ProposalRequirements(
				client_name=f"Client {i+1}",
				project_title=f"Project {i+1}",
				project_description=f"Test project {i+1} description",
				deadline=datetime.now() + timedelta(days=30),
				industry="technology"
			)
			requirements_list.append(requirements)
		
		# Mock fast execution for load testing
		integration.bridge.generate_proposal_with_crew = AsyncMock(return_value={
			"proposal_id": "test_proposal",
			"client_name": "Test Client",
			"sections": {"summary": "Generated content"},
			"metadata": {"generation_method": "crew_based"},
			"success": True
		})
		
		# Execute concurrent proposals
		start_time = datetime.now()
		
		tasks = [
			integration.generate_proposal(req, method="crew")
			for req in requirements_list
		]
		
		results = await asyncio.gather(*tasks)
		
		end_time = datetime.now()
		total_time = (end_time - start_time).total_seconds()
		
		# Verify all proposals completed successfully
		assert len(results) == 5
		for result in results:
			assert result["success"]
		
		# Performance should be reasonable (under 10 seconds for 5 proposals)
		assert total_time < 10
		
		print(f"Generated 5 proposals in {total_time:.2f} seconds")


class TestSystemResilience:
	"""Test system resilience and error handling"""
	
	@pytest.mark.asyncio
	async def test_error_handling_and_recovery(self):
		"""Test system behavior under error conditions"""
		integration = ProposalIntegration()
		await integration.initialize({})
		
		requirements = ProposalRequirements(
			client_name="Error Test Client",
			project_title="Error Handling Test",
			project_description="Test error scenarios",
			deadline=datetime.now()
		)
		
		# Test with failing crew generation
		integration.bridge.generate_proposal_with_crew = AsyncMock(
			side_effect=RuntimeError("Crew assembly failed")
		)
		
		with pytest.raises(RuntimeError):
			await integration.generate_proposal(requirements, method="crew")
		
		# Test invalid method
		with pytest.raises(ValueError):
			await integration.generate_proposal(requirements, method="invalid_method")
	
	@pytest.mark.asyncio  
	async def test_memory_and_context_persistence(self):
		"""Test memory and context persistence across operations"""
		memory_manager = MemoryManager("test_agent")
		context_manager = ContextManager()
		
		await memory_manager.start()
		await context_manager.start()
		
		try:
			# Store memories
			memory_id = await memory_manager.store_memory(
				content="Important project insight",
				tags={"project", "insight"},
				scope="project"
			)
			
			# Create shared context
			context_id = await context_manager.create_context(
				scope="project",
				name="Project Context",
				owner="test_agent"
			)
			
			context = context_manager.contexts[context_id]
			await context.set("project_phase", "planning", agent_id="test_agent")
			
			# Verify persistence
			retrieved_memory = await memory_manager.retrieve_memory(memory_id)
			assert retrieved_memory is not None
			assert retrieved_memory.content == "Important project insight"
			
			project_phase = await context.get("project_phase", agent_id="test_agent")
			assert project_phase == "planning"
			
		finally:
			await memory_manager.stop()
			await context_manager.stop()


if __name__ == "__main__":
	# Run with increased verbosity to see all test details
	pytest.main([__file__, "-v", "-s", "--tb=short"])