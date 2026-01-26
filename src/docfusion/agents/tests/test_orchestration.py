"""
Orchestration System Tests

Tests for agent orchestration including crew management, swarm intelligence,
and task orchestration systems.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, AsyncMock

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from orchestration.crew_manager import AgentCrew, CrewConfig, CrewTask, TaskPriority
from orchestration.swarm_manager import AgentSwarm, SwarmConfig, SwarmTask
from orchestration.task_orchestrator import TaskOrchestrator, WorkflowEngine, WorkflowDefinition, TaskType, ExecutionMode
from core.agent import AgentConfig


class TestCrewManagement:
	"""Test crew-based agent coordination"""
	
	@pytest.fixture
	def crew_config(self):
		"""Create test crew configuration"""
		return CrewConfig(
			name="Test Crew",
			description="A test crew for validation",
			required_roles=["researcher", "writer", "reviewer"],
			min_agents=3,
			max_agents=6,
			collaboration_mode="coordinated"
		)
	
	def test_crew_config_creation(self, crew_config):
		"""Test crew configuration"""
		assert crew_config.name == "Test Crew"
		assert crew_config.description == "A test crew for validation"
		assert len(crew_config.required_roles) == 3
		assert crew_config.min_agents == 3
		assert crew_config.max_agents == 6
	
	def test_crew_initialization(self, crew_config):
		"""Test crew initialization"""
		crew = AgentCrew(crew_config)
		
		assert crew.name == "Test Crew"
		assert crew.config == crew_config
		assert len(crew.agents) == 0
		assert len(crew.tasks) == 0
		assert crew.status.value == "forming"
	
	@pytest.mark.asyncio
	async def test_crew_agent_addition(self, crew_config):
		"""Test adding agents to crew"""
		crew = AgentCrew(crew_config)
		
		# Mock agent
		mock_agent = Mock()
		mock_agent.agent_id = "agent_1"
		mock_agent.state = "inactive"
		mock_agent.start = AsyncMock()
		
		# Add agent
		success = await crew.add_agent(mock_agent, "researcher")
		
		assert success
		assert "agent_1" in crew.agents
		assert crew.agent_roles["agent_1"] == "researcher"
		mock_agent.start.assert_called_once()
	
	@pytest.mark.asyncio
	async def test_crew_task_assignment(self, crew_config):
		"""Test task assignment to crew"""
		crew = AgentCrew(crew_config)
		
		# Add mock agents
		for i in range(3):
			mock_agent = Mock()
			mock_agent.agent_id = f"agent_{i}"
			mock_agent.state = "inactive"
			mock_agent.start = AsyncMock()
			mock_agent.config.capabilities.max_concurrent_tasks = 2
			mock_agent.evaluate_task_fit = AsyncMock(return_value=0.8)
			
			await crew.add_agent(mock_agent, ["researcher", "writer", "reviewer"][i])
		
		# Create task
		task = CrewTask(
			task_id="task_1",
			description="Test task",
			task_type="research",
			priority=TaskPriority.HIGH
		)
		
		# Assign task
		success = await crew.assign_task(task)
		assert success
		assert "task_1" in crew.tasks
	
	@pytest.mark.asyncio
	async def test_crew_workflow_execution(self, crew_config):
		"""Test crew workflow execution"""
		crew = AgentCrew(crew_config)
		
		# Add mock agents with proper async methods
		for i in range(3):
			mock_agent = Mock()
			mock_agent.agent_id = f"agent_{i}"
			mock_agent.state = "active" 
			mock_agent.start = AsyncMock()
			mock_agent.config.capabilities.max_concurrent_tasks = 2
			mock_agent.evaluate_task_fit = AsyncMock(return_value=0.8)
			mock_agent.handle_message = AsyncMock(return_value=Mock())
			mock_agent.get_health_status = Mock(return_value={"is_healthy": True})
			
			await crew.add_agent(mock_agent, ["researcher", "writer", "reviewer"][i])
		
		# Create workflow tasks
		tasks = [
			CrewTask(
				task_id=f"task_{i}",
				description=f"Test task {i}",
				task_type="research",
				priority=TaskPriority.MEDIUM
			) for i in range(2)
		]
		
		# Mock the workflow execution to complete quickly
		crew._wait_for_completion = AsyncMock(return_value=None)
		
		# Execute workflow
		result = await crew.execute_workflow(tasks)
		
		assert result["success"]
		assert len(crew.tasks) == 2


class TestSwarmIntelligence:
	"""Test swarm-based agent coordination"""
	
	@pytest.fixture
	def swarm_config(self):
		"""Create test swarm configuration"""
		return SwarmConfig(
			name="Test Swarm",
			description="A test swarm for validation",
			target_size=5,
			min_size=3,
			primary_behavior="collaborative",
			adaptation_rate=0.1
		)
	
	def test_swarm_config_creation(self, swarm_config):
		"""Test swarm configuration"""
		assert swarm_config.name == "Test Swarm"
		assert swarm_config.target_size == 5
		assert swarm_config.min_size == 3
		assert swarm_config.primary_behavior.value == "collaborative"
	
	def test_swarm_initialization(self, swarm_config):
		"""Test swarm initialization"""
		swarm = AgentSwarm(swarm_config)
		
		assert swarm.name == "Test Swarm"
		assert swarm.config == swarm_config
		assert len(swarm.agents) == 0
		assert len(swarm.tasks) == 0
		assert swarm.state.value == "forming"
	
	@pytest.mark.asyncio
	async def test_swarm_agent_addition(self, swarm_config):
		"""Test adding agents to swarm"""
		swarm = AgentSwarm(swarm_config)
		
		# Mock agent
		mock_agent = Mock()
		mock_agent.agent_id = "agent_1"
		mock_agent.state = "inactive"
		mock_agent.start = AsyncMock()
		mock_agent.get_capabilities = Mock(return_value=["research", "analysis"])
		
		# Add agent
		success = await swarm.add_agent(mock_agent, "scout")
		
		assert success
		assert "agent_1" in swarm.agents
		assert swarm.agent_roles["agent_1"].value == "scout"
		assert "agent_1" in swarm.agent_positions
	
	@pytest.mark.asyncio
	async def test_swarm_task_allocation(self, swarm_config):
		"""Test swarm task allocation strategies"""
		swarm = AgentSwarm(swarm_config)
		
		# Add mock agents
		for i in range(3):
			mock_agent = Mock()
			mock_agent.agent_id = f"agent_{i}"
			mock_agent.state = "inactive"
			mock_agent.start = AsyncMock()
			mock_agent.get_capabilities = Mock(return_value=["research"])
			mock_agent.evaluate_task_fit = AsyncMock(return_value=0.7)
			
			await swarm.add_agent(mock_agent, ["scout", "worker", "specialist"][i])
		
		# Create swarm task
		task = SwarmTask(
			task_id="swarm_task_1",
			description="Test swarm task",
			task_type="research",
			complexity=0.6,
			required_agents=2
		)
		
		# Test adaptive allocation
		success = await swarm.assign_task(task)
		assert success
		assert "swarm_task_1" in swarm.tasks


class TestTaskOrchestration:
	"""Test task orchestration and workflow engine"""
	
	@pytest.fixture
	def task_orchestrator(self):
		"""Create test task orchestrator"""
		return TaskOrchestrator()
	
	def test_orchestrator_initialization(self, task_orchestrator):
		"""Test orchestrator initialization"""
		assert len(task_orchestrator.workflows) == 0
		assert len(task_orchestrator.executions) == 0
		assert not task_orchestrator._running
	
	@pytest.mark.asyncio
	async def test_orchestrator_lifecycle(self, task_orchestrator):
		"""Test orchestrator start/stop"""
		await task_orchestrator.start()
		assert task_orchestrator._running
		
		await task_orchestrator.stop()
		assert not task_orchestrator._running
	
	@pytest.mark.asyncio
	async def test_workflow_registration(self, task_orchestrator):
		"""Test workflow definition registration"""
		await task_orchestrator.start()
		
		# Create workflow definition
		workflow_def = WorkflowDefinition(
			name="Test Workflow",
			description="A test workflow",
			tasks=[
				{
					"task_id": "task1",
					"name": "First Task",
					"task_type": TaskType.SEQUENTIAL.value,
					"execution_mode": ExecutionMode.DIRECT_AGENT.value
				}
			],
			execution_graph={"task1": []},
			stages=[["task1"]]
		)
		
		# Register workflow
		success = await task_orchestrator.register_workflow(workflow_def)
		assert success
		assert workflow_def.workflow_id in task_orchestrator.workflows
		
		await task_orchestrator.stop()
	
	@pytest.mark.asyncio
	async def test_workflow_execution(self, task_orchestrator):
		"""Test workflow execution"""
		await task_orchestrator.start()
		
		# Create simple workflow
		workflow_def = WorkflowDefinition(
			name="Simple Workflow",
			description="Simple test workflow", 
			tasks=[
				{
					"task_id": "simple_task",
					"name": "Simple Task",
					"task_type": TaskType.SEQUENTIAL.value,
					"execution_mode": ExecutionMode.DIRECT_AGENT.value,
					"parameters": {"test": "value"}
				}
			],
			execution_graph={"simple_task": []},
			stages=[["simple_task"]]
		)
		
		await task_orchestrator.register_workflow(workflow_def)
		
		# Execute workflow
		execution_context = {"test_context": "value"}
		execution_id = await task_orchestrator.execute_workflow(
			workflow_def.workflow_id, 
			execution_context
		)
		
		assert execution_id is not None
		assert execution_id in task_orchestrator.executions
		
		# Check execution status
		status = task_orchestrator.get_execution_status(execution_id)
		assert status is not None
		assert status["execution_id"] == execution_id
		
		await task_orchestrator.stop()


class TestWorkflowEngine:
	"""Test workflow engine with templates"""
	
	@pytest.fixture
	def workflow_engine(self):
		"""Create workflow engine"""
		orchestrator = TaskOrchestrator()
		return WorkflowEngine(orchestrator)
	
	def test_workflow_engine_initialization(self, workflow_engine):
		"""Test workflow engine initialization"""
		assert workflow_engine.orchestrator is not None
		assert len(workflow_engine.workflow_templates) > 0
	
	@pytest.mark.asyncio
	async def test_proposal_workflow_template(self, workflow_engine):
		"""Test proposal generation workflow template"""
		# Get template
		templates = await workflow_engine.get_workflow_templates()
		assert "proposal_generation" in templates
		
		# Create proposal workflow
		client_context = {
			"client_name": "Test Client",
			"project_title": "Test Project",
			"industry": "technology"
		}
		
		execution_id = await workflow_engine.create_proposal_workflow(client_context)
		assert execution_id is not None


if __name__ == "__main__":
	pytest.main([__file__, "-v"])