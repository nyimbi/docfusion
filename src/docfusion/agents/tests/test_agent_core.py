"""
Core Agent System Tests

Unit tests for core agent functionality including base agent,
roles, messages, and basic lifecycle operations.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, AsyncMock

# Import test utilities
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.agent import Agent, AgentConfig, AgentState, AgentMetrics, AgentGoal
from core.roles import AgentRole, get_role_definition, CapabilityDefinition, RoleDefinition
from core.messages import AgentMessage, MessageType, MessageHeader, MessagePayload, MessageBuilder
from specialists.research_agent import ResearchAgent
from specialists.writer_agent import WriterAgent


class TestAgentConfig:
	"""Test agent configuration"""
	
	def test_agent_config_creation(self):
		"""Test basic agent configuration creation"""
		config = AgentConfig(
			name="Test Agent",
			description="A test agent",
			primary_role="researcher"
		)
		
		assert config.name == "Test Agent"
		assert config.description == "A test agent"
		assert config.primary_role == "researcher"
		assert config.creativity_level == 0.5  # Default value
		assert config.risk_tolerance == 0.3  # Default value
	
	def test_agent_config_validation(self):
		"""Test agent configuration validation"""
		# Test valid creativity level
		config = AgentConfig(
			name="Test Agent",
			description="Test",
			primary_role="writer",
			creativity_level=0.8
		)
		assert config.creativity_level == 0.8
		
		# Test creativity level bounds - should be handled by Pydantic
		with pytest.raises(ValueError):
			AgentConfig(
				name="Test Agent",
				description="Test", 
				primary_role="writer",
				creativity_level=1.5  # Invalid: > 1.0
			)


class TestAgent:
	"""Test base agent functionality"""
	
	@pytest.fixture
	def agent_config(self):
		"""Create test agent configuration"""
		return AgentConfig(
			name="Test Agent",
			description="Agent for testing",
			primary_role="researcher",
			creativity_level=0.6,
			risk_tolerance=0.4
		)
	
	def test_agent_initialization(self, agent_config):
		"""Test agent initialization"""
		agent = Agent(agent_config)
		
		assert agent.name == "Test Agent"
		assert agent.config == agent_config
		assert agent.state == AgentState.INACTIVE
		assert agent.agent_id is not None
		assert isinstance(agent.metrics, AgentMetrics)
		assert len(agent.goals) == 0
		assert len(agent.active_tasks) == 0
	
	@pytest.mark.asyncio
	async def test_agent_lifecycle(self, agent_config):
		"""Test agent start/stop lifecycle"""
		agent = Agent(agent_config)
		
		# Test start
		await agent.start()
		assert agent.state == AgentState.ACTIVE
		
		# Test pause
		await agent.pause()
		assert agent.state == AgentState.PAUSED
		
		# Test resume  
		await agent.resume()
		assert agent.state == AgentState.ACTIVE
		
		# Test stop
		await agent.stop()
		assert agent.state == AgentState.INACTIVE
	
	def test_agent_goals(self, agent_config):
		"""Test agent goal management"""
		agent = Agent(agent_config)
		
		# Add goal
		agent.set_goal("test_goal", "Test goal description", 0.8)
		
		assert "test_goal" in agent.goals
		goal = agent.goals["test_goal"]
		assert goal.description == "Test goal description"
		assert goal.target_score == 0.8
		
		# Update goal progress
		agent.update_goal_progress("test_goal", 0.6)
		assert goal.current_score == 0.6
		
		# Remove goal
		agent.remove_goal("test_goal")
		assert "test_goal" not in agent.goals
	
	def test_agent_capabilities(self, agent_config):
		"""Test agent capability reporting"""
		agent = Agent(agent_config)
		capabilities = agent.get_capabilities()
		
		# Should return list of capability strings
		assert isinstance(capabilities, list)
		assert len(capabilities) >= 0  # May be empty for base agent
	
	@pytest.mark.asyncio
	async def test_agent_task_fit_evaluation(self, agent_config):
		"""Test task fit evaluation"""
		agent = Agent(agent_config)
		
		# Create mock task
		mock_task = Mock()
		mock_task.task_type = "research"
		mock_task.complexity = 0.5
		
		# Test evaluation (should return 0.0 for base agent)
		fit_score = await agent.evaluate_task_fit(mock_task)
		assert isinstance(fit_score, float)
		assert 0.0 <= fit_score <= 1.0


class TestAgentRoles:
	"""Test agent role system"""
	
	def test_role_definition_retrieval(self):
		"""Test retrieving role definitions"""
		researcher_role = get_role_definition(AgentRole.RESEARCHER)
		
		assert researcher_role is not None
		assert researcher_role.role == AgentRole.RESEARCHER
		assert researcher_role.name is not None
		assert researcher_role.description is not None
		assert len(researcher_role.primary_capabilities) > 0
	
	def test_all_roles_have_definitions(self):
		"""Test that all roles have definitions"""
		for role in AgentRole:
			role_def = get_role_definition(role)
			assert role_def is not None
			assert role_def.role == role


class TestAgentMessages:
	"""Test agent message system"""
	
	def test_message_header_creation(self):
		"""Test message header creation"""
		header = MessageHeader(
			sender_id="agent_1",
			recipient_id="agent_2",
			message_type=MessageType.TASK_REQUEST
		)
		
		assert header.sender_id == "agent_1"
		assert header.recipient_id == "agent_2"
		assert header.message_type == MessageType.TASK_REQUEST
		assert header.timestamp is not None
		assert header.message_id is not None
	
	def test_message_payload_creation(self):
		"""Test message payload creation"""
		payload = MessagePayload(
			content={"task": "research", "topic": "AI"},
			content_type="application/json"
		)
		
		assert payload.content["task"] == "research"
		assert payload.content["topic"] == "AI"
		assert payload.content_type == "application/json"
	
	def test_complete_message_creation(self):
		"""Test complete message creation"""
		header = MessageHeader(
			sender_id="agent_1",
			recipient_id="agent_2", 
			message_type=MessageType.TASK_REQUEST
		)
		
		payload = MessagePayload(
			content={"task": "write", "section": "introduction"}
		)
		
		message = AgentMessage(header=header, payload=payload)
		
		assert message.header == header
		assert message.payload == payload
		assert message.status.name in ["PENDING", "SENT", "DELIVERED", "FAILED"]
	
	def test_message_builder(self):
		"""Test message builder functionality"""
		message = (MessageBuilder("agent_1")
				   .to("agent_2")
				   .with_type(MessageType.TASK_REQUEST)
				   .with_content({"task": "analyze"})
				   .build())
		
		assert message.header.sender_id == "agent_1"
		assert message.header.recipient_id == "agent_2"
		assert message.header.message_type == MessageType.TASK_REQUEST
		assert message.payload.content["task"] == "analyze"


class TestSpecializedAgents:
	"""Test specialized agent implementations"""
	
	def test_research_agent_creation(self):
		"""Test research agent creation"""
		config = AgentConfig(
			name="Research Agent",
			description="Specialized research agent",
			primary_role="researcher"
		)
		
		agent = ResearchAgent(config)
		
		assert isinstance(agent, Agent)
		assert agent.name == "Research Agent"
		assert AgentRole.RESEARCHER.value in agent.config.primary_role
	
	def test_writer_agent_creation(self):
		"""Test writer agent creation"""
		config = AgentConfig(
			name="Writer Agent", 
			description="Specialized writing agent",
			primary_role="writer"
		)
		
		agent = WriterAgent(config)
		
		assert isinstance(agent, Agent)
		assert agent.name == "Writer Agent"
		assert AgentRole.WRITER.value in agent.config.primary_role
	
	@pytest.mark.asyncio
	async def test_specialized_agent_capabilities(self):
		"""Test specialized agent capabilities"""
		# Create research agent
		research_config = AgentConfig(
			name="Researcher",
			description="Research specialist", 
			primary_role="researcher"
		)
		research_agent = ResearchAgent(research_config)
		research_caps = research_agent.get_capabilities()
		
		# Should have research-specific capabilities
		assert len(research_caps) > 0
		assert any("research" in cap.lower() for cap in research_caps)
		
		# Create writer agent
		writer_config = AgentConfig(
			name="Writer",
			description="Writing specialist",
			primary_role="writer"
		)
		writer_agent = WriterAgent(writer_config)
		writer_caps = writer_agent.get_capabilities()
		
		# Should have writing-specific capabilities
		assert len(writer_caps) > 0
		assert any("writ" in cap.lower() for cap in writer_caps)


if __name__ == "__main__":
	pytest.main([__file__, "-v"])