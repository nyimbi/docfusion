import asyncio
import logging
from collections import defaultdict, deque
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set

from pydantic import BaseModel, ConfigDict, Field

from ..core.messages import AgentMessage, MessageStatus, MessageType

"""
Message Bus System

Central communication hub for inter-agent message routing and delivery.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

class CommunicationProtocol(str, Enum):
    """Communication protocol types"""

    DIRECT = "direct"
    BROADCAST = "broadcast"
    PUBLISH_SUBSCRIBE = "publish_subscribe"
    REQUEST_RESPONSE = "request_response"
    QUEUE = "queue"

class MessageBusConfig(BaseModel):
    """Message bus configuration"""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    max_message_history: int = Field(default=10000)
    message_ttl_seconds: int = Field(default=3600)
    retry_attempts: int = Field(default=3)
    retry_delay_seconds: float = Field(default=1.0)
    enable_persistence: bool = Field(default=False)
    enable_metrics: bool = Field(default=True)

class MessageBus:
    """
    Central message bus for agent communication

    Provides reliable message delivery, routing, and protocol support
    for multi-agent coordination and collaboration.
    """

    def __init__(self, config: Optional[MessageBusConfig] = None):
        self.config = config or MessageBusConfig()

        # Agent registry
        self.registered_agents: Dict[str, Dict[str, Any]] = {}
        self.agent_channels: Dict[str, asyncio.Queue] = {}

        # Message routing and delivery
        self.message_history: deque = deque(maxlen=self.config.max_message_history)
        self.pending_messages: Dict[str, AgentMessage] = {}
        self.failed_messages: Dict[str, AgentMessage] = {}

        # Subscription management
        self.topic_subscriptions: Dict[str, Set[str]] = defaultdict(set)
        self.agent_subscriptions: Dict[str, Set[str]] = defaultdict(set)

        # Communication patterns
        self.request_response_registry: Dict[
            str, str
        ] = {}  # message_id -> waiting_agent_id

        # Metrics and monitoring
        self.metrics = {
            "messages_sent": 0,
            "messages_delivered": 0,
            "messages_failed": 0,
            "active_agents": 0,
            "average_delivery_time": 0.0,
        }

        # Bus control
        self._running = False
        self._delivery_task: Optional[asyncio.Task] = None

        self.logger = logging.getLogger(__name__)
        self.logger.info("Message bus initialized")

    async def start(self) -> None:
        """Start the message bus"""
        if self._running:
            return

        self._running = True
        self._delivery_task = asyncio.create_task(self._message_delivery_loop())

        self.logger.info("Message bus started")

    async def stop(self) -> None:
        """Stop the message bus"""
        if not self._running:
            return

        self._running = False

        if self._delivery_task:
            self._delivery_task.cancel()

        self.logger.info("Message bus stopped")

    async def register_agent(self, agent_id: str, agent_info: Dict[str, Any]) -> bool:
        """Register an agent with the message bus"""
        try:
            self.registered_agents[agent_id] = {
                **agent_info,
                "registered_at": datetime.now(),
                "last_activity": datetime.now(),
                "message_count": 0,
            }

            # Create message channel for agent
            self.agent_channels[agent_id] = asyncio.Queue()

            self.metrics["active_agents"] += 1
            self.logger.info(f"Registered agent: {agent_id}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to register agent {agent_id}: {e}")
            return False

    async def unregister_agent(self, agent_id: str) -> bool:
        """Unregister an agent from the message bus"""
        try:
            if agent_id in self.registered_agents:
                del self.registered_agents[agent_id]

            if agent_id in self.agent_channels:
                del self.agent_channels[agent_id]

            # Clean up subscriptions
            for topic_agents in self.topic_subscriptions.values():
                topic_agents.discard(agent_id)

            if agent_id in self.agent_subscriptions:
                del self.agent_subscriptions[agent_id]

            self.metrics["active_agents"] -= 1
            self.logger.info(f"Unregistered agent: {agent_id}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to unregister agent {agent_id}: {e}")
            return False

    async def send_message(self, message: AgentMessage) -> bool:
        """Send a message through the bus"""
        try:
            # Update message metadata
            message.metadata.delivery_attempts.append(datetime.now())
            message.status = MessageStatus.SENT

            # Add to history
            self.message_history.append(message)
            self.pending_messages[message.header.message_id] = message

            # Route message based on delivery mode
            success = await self._route_message(message)

            if success:
                self.metrics["messages_sent"] += 1
                message.status = MessageStatus.DELIVERED
                self.metrics["messages_delivered"] += 1
            else:
                message.status = MessageStatus.FAILED
                self.metrics["messages_failed"] += 1
                self.failed_messages[message.header.message_id] = message

            # Clean up
            self.pending_messages.pop(message.header.message_id, None)

            return success

        except Exception as e:
            self.logger.error(f"Failed to send message: {e}")
            return False

    async def subscribe_to_topic(self, agent_id: str, topic: str) -> bool:
        """Subscribe an agent to a topic"""
        try:
            if agent_id not in self.registered_agents:
                return False

            self.topic_subscriptions[topic].add(agent_id)
            self.agent_subscriptions[agent_id].add(topic)

            self.logger.debug(f"Agent {agent_id} subscribed to topic: {topic}")
            return True

        except Exception as e:
            self.logger.error(f"Subscription failed: {e}")
            return False

    async def unsubscribe_from_topic(self, agent_id: str, topic: str) -> bool:
        """Unsubscribe an agent from a topic"""
        try:
            self.topic_subscriptions[topic].discard(agent_id)
            self.agent_subscriptions[agent_id].discard(topic)

            self.logger.debug(f"Agent {agent_id} unsubscribed from topic: {topic}")
            return True

        except Exception as e:
            self.logger.error(f"Unsubscription failed: {e}")
            return False

    async def get_messages(self, agent_id: str) -> List[AgentMessage]:
        """Get pending messages for an agent"""
        try:
            if agent_id not in self.agent_channels:
                return []

            messages = []
            channel = self.agent_channels[agent_id]

            # Get all available messages
            while not channel.empty():
                try:
                    message = await asyncio.wait_for(channel.get(), timeout=0.1)
                    messages.append(message)
                except asyncio.TimeoutError:
                    break

            # Update agent activity
            if agent_id in self.registered_agents:
                self.registered_agents[agent_id]["last_activity"] = datetime.now()
                self.registered_agents[agent_id]["message_count"] += len(messages)

            return messages

        except Exception as e:
            self.logger.error(f"Failed to get messages for {agent_id}: {e}")
            return []

    async def publish_to_topic(self, topic: str, message: AgentMessage) -> int:
        """Publish a message to a topic"""
        try:
            subscribers = self.topic_subscriptions.get(topic, set())
            delivery_count = 0

            for subscriber_id in subscribers:
                if subscriber_id in self.agent_channels:
                    await self.agent_channels[subscriber_id].put(message)
                    delivery_count += 1

            self.logger.debug(
                f"Published message to topic {topic} - {delivery_count} recipients"
            )
            return delivery_count

        except Exception as e:
            self.logger.error(f"Failed to publish to topic {topic}: {e}")
            return 0

    async def _route_message(self, message: AgentMessage) -> bool:
        """Route message based on delivery mode and recipient"""
        try:
            delivery_mode = message.header.delivery_mode

            if delivery_mode == "direct":
                return await self._deliver_direct_message(message)
            elif delivery_mode == "broadcast":
                return await self._deliver_broadcast_message(message)
            elif delivery_mode == "multicast":
                return await self._deliver_multicast_message(message)
            elif delivery_mode == "publish_subscribe":
                return await self._deliver_pubsub_message(message)
            else:
                # Default to direct delivery
                return await self._deliver_direct_message(message)

        except Exception as e:
            self.logger.error(f"Message routing failed: {e}")
            return False

    async def _deliver_direct_message(self, message: AgentMessage) -> bool:
        """Deliver message directly to recipient"""
        recipient_id = message.header.recipient_id

        if not recipient_id or recipient_id not in self.agent_channels:
            self.logger.warning(f"Invalid recipient: {recipient_id}")
            return False

        try:
            await self.agent_channels[recipient_id].put(message)
            message.update_routing_path("message_bus")
            return True
        except Exception as e:
            self.logger.error(f"Direct delivery failed: {e}")
            return False

    async def _deliver_broadcast_message(self, message: AgentMessage) -> bool:
        """Broadcast message to all registered agents"""
        delivery_count = 0

        for agent_id, channel in self.agent_channels.items():
            if agent_id != message.header.sender_id:  # Don't send to sender
                try:
                    await channel.put(message)
                    delivery_count += 1
                except Exception as e:
                    self.logger.warning(
                        f"Broadcast delivery failed for {agent_id}: {e}"
                    )

        return delivery_count > 0

    async def _deliver_multicast_message(self, message: AgentMessage) -> bool:
        """Deliver message to a specific group"""
        recipient_group = message.header.recipient_group

        if not recipient_group:
            return False

        # Get group members (simplified - would be more sophisticated)
        group_members = self.topic_subscriptions.get(recipient_group, set())
        delivery_count = 0

        for member_id in group_members:
            if member_id in self.agent_channels:
                try:
                    await self.agent_channels[member_id].put(message)
                    delivery_count += 1
                except Exception as e:
                    self.logger.warning(
                        f"Multicast delivery failed for {member_id}: {e}"
                    )

        return delivery_count > 0

    async def _deliver_pubsub_message(self, message: AgentMessage) -> bool:
        """Deliver message using publish-subscribe pattern"""
        routing_key = message.header.routing_key

        if not routing_key:
            return False

        return await self.publish_to_topic(routing_key, message) > 0

    async def _message_delivery_loop(self) -> None:
        """Main message delivery and maintenance loop"""
        while self._running:
            try:
                # Clean up expired messages
                await self._cleanup_expired_messages()

                # Retry failed messages
                await self._retry_failed_messages()

                # Update metrics
                self._update_delivery_metrics()

                await asyncio.sleep(1.0)

            except Exception as e:
                self.logger.error(f"Delivery loop error: {e}")
                await asyncio.sleep(5.0)

    async def _cleanup_expired_messages(self) -> None:
        """Clean up expired messages"""
        current_time = datetime.now()
        ttl = timedelta(seconds=self.config.message_ttl_seconds)

        expired_messages = []
        for message_id, message in self.pending_messages.items():
            if current_time - message.header.timestamp > ttl:
                expired_messages.append(message_id)

        for message_id in expired_messages:
            message = self.pending_messages.pop(message_id, None)
            if message:
                message.status = MessageStatus.EXPIRED
                self.failed_messages[message_id] = message

    async def _retry_failed_messages(self) -> None:
        """Retry failed message deliveries"""
        messages_to_retry = []

        for message_id, message in self.failed_messages.items():
            if (
                message.should_retry()
                and len(message.metadata.delivery_attempts) < self.config.retry_attempts
            ):
                messages_to_retry.append(message_id)

        for message_id in messages_to_retry:
            message = self.failed_messages.pop(message_id, None)
            if message:
                message.metadata.retry_count += 1
                await self.send_message(message)

    def _update_delivery_metrics(self) -> None:
        """Update delivery performance metrics"""
        # Calculate average delivery time (simplified)
        if self.metrics["messages_delivered"] > 0:
            # This would calculate actual delivery times
            self.metrics["average_delivery_time"] = 0.1  # Placeholder

    # Public interface methods

    def get_bus_status(self) -> Dict[str, Any]:
        """Get message bus status"""
        return {
            "running": self._running,
            "registered_agents": len(self.registered_agents),
            "pending_messages": len(self.pending_messages),
            "failed_messages": len(self.failed_messages),
            "topics": len(self.topic_subscriptions),
            "metrics": self.metrics.copy(),
        }

    def get_agent_info(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a registered agent"""
        return self.registered_agents.get(agent_id)

    def get_topic_subscribers(self, topic: str) -> List[str]:
        """Get list of subscribers for a topic"""
        return list(self.topic_subscriptions.get(topic, set()))

    async def broadcast_system_message(
        self,
        message_content: Any,
        message_type: MessageType = MessageType.SYSTEM_NOTIFICATION,
    ) -> bool:
        """Broadcast a system message to all agents"""
        from ..core.messages import (
            MessageBuilder,  # Import here to avoid circular imports
        )

        message = (
            MessageBuilder("system")
            .broadcast()
            .with_type(message_type)
            .with_content(message_content)
            .build()
        )

        return await self.send_message(message)
