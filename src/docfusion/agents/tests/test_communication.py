"""
Communication System Tests

Tests for agent communication infrastructure including message bus,
channels, and inter-agent messaging protocols.

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

from communication.message_bus import MessageBus, MessageBusConfig, CommunicationProtocol
from communication.channels import DirectChannel, BroadcastChannel, AgentChannel, ChannelConfig, ChannelType
from core.messages import AgentMessage, MessageType, MessageHeader, MessagePayload, MessageBuilder


class TestMessageBus:
	"""Test message bus functionality"""
	
	@pytest.fixture
	def message_bus_config(self):
		"""Create test message bus configuration"""
		return MessageBusConfig(
			max_message_history=100,
			message_ttl_seconds=60,
			retry_attempts=2
		)
	
	def test_message_bus_initialization(self, message_bus_config):
		"""Test message bus initialization"""
		bus = MessageBus(message_bus_config)
		
		assert bus.config == message_bus_config
		assert len(bus.registered_agents) == 0
		assert len(bus.agent_channels) == 0
		assert not bus._running
	
	@pytest.mark.asyncio
	async def test_message_bus_lifecycle(self, message_bus_config):
		"""Test message bus start/stop lifecycle"""
		bus = MessageBus(message_bus_config)
		
		# Test start
		await bus.start()
		assert bus._running
		
		# Test stop
		await bus.stop()
		assert not bus._running
	
	@pytest.mark.asyncio
	async def test_agent_registration(self, message_bus_config):
		"""Test agent registration with message bus"""
		bus = MessageBus(message_bus_config)
		await bus.start()
		
		# Register agent
		agent_info = {
			"name": "Test Agent",
			"type": "researcher",
			"capabilities": ["research", "analysis"]
		}
		
		success = await bus.register_agent("agent_1", agent_info)
		assert success
		assert "agent_1" in bus.registered_agents
		assert "agent_1" in bus.agent_channels
		
		# Unregister agent
		success = await bus.unregister_agent("agent_1")
		assert success
		assert "agent_1" not in bus.registered_agents
		assert "agent_1" not in bus.agent_channels
		
		await bus.stop()
	
	@pytest.mark.asyncio
	async def test_message_sending(self, message_bus_config):
		"""Test message sending through bus"""
		bus = MessageBus(message_bus_config)
		await bus.start()
		
		# Register agents
		await bus.register_agent("sender", {"name": "Sender"})
		await bus.register_agent("receiver", {"name": "Receiver"})
		
		# Create message
		message = (MessageBuilder("sender")
				   .to("receiver")
				   .with_type(MessageType.TASK_REQUEST)
				   .with_content({"task": "test"})
				   .build())
		
		# Send message
		success = await bus.send_message(message)
		assert success
		
		# Check message was delivered
		messages = await bus.get_messages("receiver")
		assert len(messages) == 1
		assert messages[0].payload.content["task"] == "test"
		
		await bus.stop()
	
	@pytest.mark.asyncio
	async def test_topic_subscription(self, message_bus_config):
		"""Test topic subscription and publishing"""
		bus = MessageBus(message_bus_config)
		await bus.start()
		
		# Register agents
		await bus.register_agent("publisher", {"name": "Publisher"})
		await bus.register_agent("subscriber", {"name": "Subscriber"})
		
		# Subscribe to topic
		success = await bus.subscribe_to_topic("subscriber", "research_updates")
		assert success
		
		# Create topic message
		message = (MessageBuilder("publisher")
				   .publish_subscribe("research_updates")
				   .with_type(MessageType.STATUS_UPDATE)
				   .with_content({"update": "research complete"})
				   .build())
		
		# Publish to topic
		delivery_count = await bus.publish_to_topic("research_updates", message)
		assert delivery_count == 1
		
		# Check subscriber received message
		messages = await bus.get_messages("subscriber")
		assert len(messages) == 1
		assert messages[0].payload.content["update"] == "research complete"
		
		await bus.stop()


class TestCommunicationChannels:
	"""Test communication channel implementations"""
	
	def test_channel_config_creation(self):
		"""Test channel configuration"""
		config = ChannelConfig(
			name="Test Channel",
			channel_type=ChannelType.DIRECT,
			max_buffer_size=500
		)
		
		assert config.name == "Test Channel"
		assert config.channel_type == ChannelType.DIRECT
		assert config.max_buffer_size == 500
	
	@pytest.mark.asyncio
	async def test_direct_channel(self):
		"""Test direct channel functionality"""
		config = ChannelConfig(
			name="Direct Test",
			channel_type=ChannelType.DIRECT
		)
		
		channel = DirectChannel(config)
		await channel.start()
		
		# Connect sender and receiver
		await channel.connect("sender", {"role": "sender"})
		await channel.connect("receiver", {"role": "receiver"})
		
		# Create and send message
		message = (MessageBuilder("sender")
				   .to("receiver")
				   .with_content({"msg": "direct test"})
				   .build())
		
		success = await channel.send_message(message, sender_id="sender")
		assert success
		
		# Get messages for receiver
		messages = await channel.get_messages("receiver")
		assert len(messages) == 1
		assert messages[0].payload.content["msg"] == "direct test"
		
		await channel.stop()
	
	@pytest.mark.asyncio
	async def test_broadcast_channel(self):
		"""Test broadcast channel functionality"""
		config = ChannelConfig(
			name="Broadcast Test",
			channel_type=ChannelType.BROADCAST
		)
		
		channel = BroadcastChannel(config)
		await channel.start()
		
		# Connect broadcaster and subscribers
		await channel.connect("broadcaster", {"role": "broadcaster"})
		await channel.connect("sub1", {"role": "subscriber"})
		await channel.connect("sub2", {"role": "subscriber"})
		
		# Create and send broadcast message
		message = (MessageBuilder("broadcaster")
				   .broadcast()
				   .with_content({"announcement": "broadcast test"})
				   .build())
		
		success = await channel.send_message(message, sender_id="broadcaster")
		assert success
		
		# Check all subscribers received message
		sub1_messages = await channel.get_messages("sub1")
		sub2_messages = await channel.get_messages("sub2")
		
		assert len(sub1_messages) == 1
		assert len(sub2_messages) == 1
		assert sub1_messages[0].payload.content["announcement"] == "broadcast test"
		assert sub2_messages[0].payload.content["announcement"] == "broadcast test"
		
		await channel.stop()
	
	@pytest.mark.asyncio
	async def test_agent_channel_topic_routing(self):
		"""Test agent channel topic-based routing"""
		config = ChannelConfig(
			name="Agent Channel Test",
			channel_type=ChannelType.TOPIC
		)
		
		channel = AgentChannel(config)
		await channel.start()
		
		# Connect agents
		await channel.connect("agent1", {"auto_subscribe_topics": ["research"]})
		await channel.connect("agent2", {"auto_subscribe_topics": ["writing"]})
		await channel.connect("agent3", {"auto_subscribe_topics": ["research", "writing"]})
		
		# Send topic-based messages
		research_msg = (MessageBuilder("agent1")
						.topic("research")
						.with_content({"topic": "research update"})
						.build())
		
		writing_msg = (MessageBuilder("agent2")
					   .topic("writing") 
					   .with_content({"topic": "writing update"})
					   .build())
		
		await channel.send_message(research_msg)
		await channel.send_message(writing_msg)
		
		# Check message distribution
		agent1_msgs = await channel.get_messages("agent1")
		agent2_msgs = await channel.get_messages("agent2") 
		agent3_msgs = await channel.get_messages("agent3")
		
		# Agent1 should have research message
		assert len(agent1_msgs) == 1
		assert agent1_msgs[0].payload.content["topic"] == "research update"
		
		# Agent2 should have writing message
		assert len(agent2_msgs) == 1
		assert agent2_msgs[0].payload.content["topic"] == "writing update"
		
		# Agent3 should have both messages
		assert len(agent3_msgs) == 2
		
		await channel.stop()


class TestMessageReliability:
	"""Test message delivery reliability features"""
	
	@pytest.mark.asyncio
	async def test_message_retry_mechanism(self):
		"""Test message retry on failure"""
		config = MessageBusConfig(
			retry_attempts=3,
			retry_delay_seconds=0.1
		)
		
		bus = MessageBus(config)
		await bus.start()
		
		# Register only sender (no receiver to simulate failure)
		await bus.register_agent("sender", {"name": "Sender"})
		
		# Create message to non-existent receiver
		message = (MessageBuilder("sender")
				   .to("nonexistent")
				   .with_content({"test": "retry"})
				   .build())
		
		# Should fail but attempt retries
		success = await bus.send_message(message)
		assert not success  # Should ultimately fail
		
		# Check failed messages
		assert len(bus.failed_messages) > 0
		
		await bus.stop()
	
	@pytest.mark.asyncio
	async def test_message_ttl_expiration(self):
		"""Test message TTL expiration"""
		config = MessageBusConfig(
			message_ttl_seconds=1  # Very short TTL for testing
		)
		
		bus = MessageBus(config)
		await bus.start()
		
		await bus.register_agent("sender", {"name": "Sender"})
		
		# Create message that will expire
		message = (MessageBuilder("sender")
				   .to("receiver")
				   .with_content({"test": "ttl"})
				   .build())
		
		# Send message (will be pending due to missing receiver)
		await bus.send_message(message)
		
		# Wait for TTL expiration
		await asyncio.sleep(1.5)
		
		# Trigger cleanup
		await bus._cleanup_expired_messages()
		
		# Message should be expired
		assert len(bus.failed_messages) > 0
		
		await bus.stop()


if __name__ == "__main__":
	pytest.main([__file__, "-v"])