#!/usr/bin/env python3
"""Tests for agent communication channels."""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from docfusion.agents.communication.channels import (
	BaseChannel,
	ChannelConfig,
	ChannelStatus,
	ChannelType,
	DirectChannel,
	BroadcastChannel,
	AgentChannel,
)
from docfusion.agents.communication.inprocess_channel import InProcessChannel
from docfusion.agents.communication.redis_channel import RedisChannel
from docfusion.agents.communication.websocket_channel import WebSocketChannel
from docfusion.agents.core.messages import (
	AgentMessage,
	MessageHeader,
	MessagePayload,
	MessageType,
	MessagePriority,
	MessageDeliveryMode,
	MessageStatus,
)


def _make_message(
	sender_id: str = "agent-a",
	recipient_id: str | None = "agent-b",
	message_type: MessageType = MessageType.DIRECT_MESSAGE,
	delivery_mode: MessageDeliveryMode = MessageDeliveryMode.DIRECT,
	routing_key: str | None = None,
) -> AgentMessage:
	return AgentMessage(
		header=MessageHeader(
			sender_id=sender_id,
			recipient_id=recipient_id,
			message_type=message_type,
			priority=MessagePriority.MEDIUM,
			delivery_mode=delivery_mode,
			routing_key=routing_key,
		),
		payload=MessagePayload(content="hello"),
	)


class TestBaseChannelDefaults:
	"""Verify BaseChannel abstract methods no longer raise NotImplementedError."""

	def test_base_channel_send_returns_false(self):
		class DummyChannel(BaseChannel):
			async def send_message(self, message, sender_id=None, **kwargs):
				return await super().send_message(message, sender_id, **kwargs)
			async def connect(self, agent_id, connection_info):
				return True
			async def disconnect(self, agent_id):
				return True
			async def _process_message(self, message):
				pass

		config = ChannelConfig(name="dummy", channel_type=ChannelType.DIRECT)
		channel = DummyChannel(config)
		msg = _make_message()
		result = asyncio.run(channel.send_message(msg))
		assert result is False

	def test_no_notimplemented_error_in_source(self):
		import inspect
		source = inspect.getsource(BaseChannel)
		assert "NotImplementedError" not in source


class TestInProcessChannel:
	"""Tests for InProcessChannel."""

	@pytest.fixture
	def channel(self):
		config = ChannelConfig(name="test-inproc", channel_type=ChannelType.QUEUE)
		return InProcessChannel(config)

	@pytest.mark.asyncio
	async def test_connect_and_disconnect(self, channel):
		assert await channel.connect("a1", {}) is True
		assert "a1" in channel.connections
		assert await channel.disconnect("a1") is True
		assert "a1" not in channel.connections

	@pytest.mark.asyncio
	async def test_disconnect_unknown_returns_false(self, channel):
		assert await channel.disconnect("unknown") is False

	@pytest.mark.asyncio
	async def test_send_and_receive_direct(self, channel):
		await channel.connect("sender", {})
		await channel.connect("receiver", {})
		await channel.start()

		msg = _make_message(sender_id="sender", recipient_id="receiver")
		assert await channel.send_message(msg) is True

		# Allow processor to run
		await asyncio.sleep(0.05)

		messages = await channel.get_messages("receiver")
		assert len(messages) == 1
		assert messages[0].header.sender_id == "sender"
		assert messages[0].status == MessageStatus.DELIVERED

		await channel.stop()

	@pytest.mark.asyncio
	async def test_broadcast_without_recipient(self, channel):
		await channel.connect("a1", {})
		await channel.connect("a2", {})
		await channel.start()

		msg = _make_message(sender_id="a1", recipient_id=None)
		assert await channel.send_message(msg) is True
		await asyncio.sleep(0.05)

		# a1 should not receive its own broadcast
		assert len(await channel.get_messages("a1")) == 0
		# a2 should receive it
		assert len(await channel.get_messages("a2")) == 1

		await channel.stop()

	@pytest.mark.asyncio
	async def test_send_to_missing_recipient(self, channel):
		await channel.start()
		msg = _make_message(sender_id="a1", recipient_id="missing")
		assert await channel.send_message(msg) is True
		await asyncio.sleep(0.05)
		assert msg.status == MessageStatus.FAILED
		assert channel.metrics.messages_dropped >= 1
		await channel.stop()

	@pytest.mark.asyncio
	async def test_pause_prevents_send(self, channel):
		await channel.start()
		await channel.pause()
		msg = _make_message()
		assert await channel.send_message(msg) is False
		await channel.stop()

	@pytest.mark.asyncio
	async def test_idempotent_connect(self, channel):
		assert await channel.connect("a1", {}) is True
		assert await channel.connect("a1", {}) is True  # idempotent
		assert len(channel.connections) == 1


class TestRedisChannel:
	"""Tests for RedisChannel with mocked redis."""

	@pytest.fixture
	def channel(self):
		config = ChannelConfig(name="test-redis", channel_type=ChannelType.TOPIC)
		return RedisChannel(config)

	@pytest.mark.asyncio
	async def test_connect_without_redis(self, channel):
		"""Should still allow connections when redis is unavailable."""
		assert await channel.connect("a1", {}) is True
		assert "a1" in channel.connections

	@pytest.mark.asyncio
	async def test_disconnect(self, channel):
		await channel.connect("a1", {})
		assert await channel.disconnect("a1") is True
		assert "a1" not in channel.connections

	@pytest.mark.asyncio
	async def test_send_and_process_without_redis(self, channel):
		"""Fallback to local buffer when redis is unavailable."""
		await channel.start()
		msg = _make_message()
		assert await channel.send_message(msg) is True
		await asyncio.sleep(0.05)
		# Should not crash even without redis
		assert channel.metrics.messages_sent >= 1
		await channel.stop()

	@pytest.mark.asyncio
	async def test_stop_closes_resources(self, channel):
		await channel.connect("a1", {})
		await channel.stop()
		assert channel.status == ChannelStatus.CLOSED
		assert len(channel.connections) == 0

	@pytest.mark.asyncio
	async def test_send_when_inactive_returns_false(self, channel):
		channel.status = ChannelStatus.CLOSED
		msg = _make_message()
		assert await channel.send_message(msg) is False


class TestWebSocketChannel:
	"""Tests for WebSocketChannel with mocked websockets."""

	@pytest.fixture
	def channel(self):
		config = ChannelConfig(name="test-ws", channel_type=ChannelType.DIRECT)
		return WebSocketChannel(config)

	@pytest.mark.asyncio
	async def test_connect_without_websocket(self, channel):
		"""Should allow connections without a real websocket object."""
		assert await channel.connect("a1", {}) is True
		assert "a1" in channel.connections

	@pytest.mark.asyncio
	async def test_connect_with_mock_websocket(self, channel):
		ws = MagicMock()
		ws.close = AsyncMock()
		assert await channel.connect("a1", {"websocket": ws}) is True
		assert channel._websockets["a1"] == ws

	@pytest.mark.asyncio
	async def test_disconnect_closes_websocket(self, channel):
		ws = MagicMock()
		ws.close = AsyncMock()
		await channel.connect("a1", {"websocket": ws})
		assert await channel.disconnect("a1") is True
		ws.close.assert_awaited_once()

	@pytest.mark.asyncio
	async def test_send_and_process_without_websocket(self, channel):
		"""Should fallback to local queue when no websocket available."""
		await channel.connect("sender", {})
		await channel.connect("receiver", {})
		await channel.start()

		msg = _make_message(sender_id="sender", recipient_id="receiver")
		assert await channel.send_message(msg) is True
		await asyncio.sleep(0.05)

		messages = await channel.get_messages("receiver")
		assert len(messages) == 1
		assert messages[0].header.sender_id == "sender"

		await channel.stop()

	@pytest.mark.asyncio
	async def test_process_with_mock_websocket(self, channel):
		ws = MagicMock()
		ws.send = AsyncMock()
		await channel.connect("sender", {})
		await channel.connect("receiver", {"websocket": ws})
		await channel.start()

		msg = _make_message(sender_id="sender", recipient_id="receiver")
		assert await channel.send_message(msg) is True
		await asyncio.sleep(0.05)

		ws.send.assert_awaited_once()
		assert msg.status == MessageStatus.DELIVERED

		await channel.stop()


class TestDirectChannel:
	"""Tests for DirectChannel."""

	@pytest.fixture
	def channel(self):
		config = ChannelConfig(name="test-direct", channel_type=ChannelType.DIRECT)
		return DirectChannel(config)

	@pytest.mark.asyncio
	async def test_sender_receiver_pattern(self, channel):
		assert await channel.connect("s1", {"role": "sender"}) is True
		assert await channel.connect("r1", {"role": "receiver"}) is True
		assert channel.sender_id == "s1"
		assert channel.receiver_id == "r1"

	@pytest.mark.asyncio
	async def test_second_sender_rejected(self, channel):
		await channel.connect("s1", {"role": "sender"})
		assert await channel.connect("s2", {"role": "sender"}) is False

	@pytest.mark.asyncio
	async def test_unauthorized_send_blocked(self, channel):
		await channel.connect("s1", {"role": "sender"})
		await channel.connect("r1", {"role": "receiver"})
		await channel.start()

		msg = _make_message(sender_id="s1", recipient_id="r1")
		assert await channel.send_message(msg, sender_id="impostor") is False
		await channel.stop()

	@pytest.mark.asyncio
	async def test_send_and_receive(self, channel):
		await channel.connect("s1", {"role": "sender"})
		await channel.connect("r1", {"role": "receiver"})
		await channel.start()

		msg = _make_message(sender_id="s1", recipient_id="r1")
		assert await channel.send_message(msg, sender_id="s1") is True
		await asyncio.sleep(0.05)

		messages = await channel.get_messages("r1")
		assert len(messages) == 1
		assert messages[0].status == MessageStatus.DELIVERED

		await channel.stop()


class TestBroadcastChannel:
	"""Tests for BroadcastChannel."""

	@pytest.fixture
	def channel(self):
		config = ChannelConfig(name="test-bcast", channel_type=ChannelType.BROADCAST)
		return BroadcastChannel(config)

	@pytest.mark.asyncio
	async def test_broadcaster_and_subscribers(self, channel):
		assert await channel.connect("b1", {"role": "broadcaster"}) is True
		assert await channel.connect("s1", {"role": "subscriber"}) is True
		assert await channel.connect("s2", {"role": "subscriber"}) is True
		assert channel.broadcaster_id == "b1"
		assert len(channel.subscribers) == 2

	@pytest.mark.asyncio
	async def test_unauthorized_broadcast_blocked(self, channel):
		await channel.connect("b1", {"role": "broadcaster"})
		await channel.start()

		msg = _make_message(sender_id="b1")
		assert await channel.send_message(msg, sender_id="impostor") is False
		await channel.stop()

	@pytest.mark.asyncio
	async def test_broadcast_delivery(self, channel):
		await channel.connect("b1", {"role": "broadcaster"})
		await channel.connect("s1", {"role": "subscriber"})
		await channel.connect("s2", {"role": "subscriber"})
		await channel.start()

		msg = _make_message(sender_id="b1")
		assert await channel.send_message(msg, sender_id="b1") is True
		await asyncio.sleep(0.05)

		assert len(await channel.get_messages("s1")) == 1
		assert len(await channel.get_messages("s2")) == 1
		assert msg.status == MessageStatus.DELIVERED

		await channel.stop()

	@pytest.mark.asyncio
	async def test_filter_by_message_type(self, channel):
		await channel.connect("b1", {"role": "broadcaster"})
		await channel.connect(
			"s1", {"role": "subscriber", "preferences": {"message_types": ["task_request"]}}
		)
		await channel.start()

		msg = _make_message(
			sender_id="b1", message_type=MessageType.GENERAL_MESSAGE
		)
		assert await channel.send_message(msg, sender_id="b1") is True
		await asyncio.sleep(0.05)

		# s1 filtered out GENERAL_MESSAGE because it only allows task_request
		assert len(await channel.get_messages("s1")) == 0
		assert msg.status == MessageStatus.FAILED

		await channel.stop()


class TestAgentChannel:
	"""Tests for AgentChannel."""

	@pytest.fixture
	def channel(self):
		config = ChannelConfig(name="test-agent", channel_type=ChannelType.TOPIC)
		return AgentChannel(config)

	@pytest.mark.asyncio
	async def test_topic_routing(self, channel):
		await channel.connect("a1", {})
		await channel.connect("a2", {})
		await channel.subscribe_to_topic("a1", "alerts")
		await channel.subscribe_to_topic("a2", "alerts")
		await channel.start()

		msg = _make_message(
			sender_id="a1", recipient_id=None,
			delivery_mode=MessageDeliveryMode.PUBLISH_SUBSCRIBE,
			routing_key="alerts",
		)
		assert await channel.send_message(msg) is True
		await asyncio.sleep(0.05)

		# a1 and a2 both subscribed to alerts
		assert len(await channel.get_messages("a1")) == 1
		assert len(await channel.get_messages("a2")) == 1

		await channel.stop()

	@pytest.mark.asyncio
	async def test_direct_delivery(self, channel):
		await channel.connect("a1", {})
		await channel.connect("a2", {})
		await channel.start()

		msg = _make_message(sender_id="a1", recipient_id="a2")
		assert await channel.send_message(msg) is True
		await asyncio.sleep(0.05)

		assert len(await channel.get_messages("a2")) == 1
		assert len(await channel.get_messages("a1")) == 0

		await channel.stop()

	@pytest.mark.asyncio
	async def test_auto_subscribe_on_connect(self, channel):
		await channel.connect("a1", {"auto_subscribe_topics": ["news", "alerts"]})
		assert "news" in channel.get_agent_topics("a1")
		assert "alerts" in channel.get_agent_topics("a1")

	@pytest.mark.asyncio
	async def test_disconnect_unsubscribes_all(self, channel):
		await channel.connect("a1", {})
		await channel.subscribe_to_topic("a1", "news")
		await channel.disconnect("a1")
		assert len(channel.get_agent_topics("a1")) == 0
		assert "news" not in channel.routing_table


if __name__ == "__main__":
	pytest.main([__file__, "-v"])
