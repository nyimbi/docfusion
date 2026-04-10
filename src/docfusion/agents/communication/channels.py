import asyncio
import logging

logger = logging.getLogger(__name__)
from typing import Any, Dict, List, Optional, Set, Callable, Union
from datetime import datetime, timedelta
from collections import deque
from enum import Enum
from abc import ABC, abstractmethod
from pydantic import BaseModel, Field, ConfigDict
from ..core.messages import AgentMessage, MessageStatus, MessageType
import re
from ...core.utils import uuid7str

"""
Agent Communication Channels

Direct, broadcast, and specialized communication channels for agent coordination.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

class ChannelType(str, Enum):
	"""Communication channel types"""
	DIRECT = "direct"
	BROADCAST = "broadcast"
	MULTICAST = "multicast"
	QUEUE = "queue"
	TOPIC = "topic"

class ChannelStatus(str, Enum):
	"""Channel operational status"""
	ACTIVE = "active"
	PAUSED = "paused"
	CLOSED = "closed"
	ERROR = "error"

class ChannelConfig(BaseModel):
	"""Channel configuration"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	channel_id: str = Field(default_factory=uuid7str)
	name: str = Field(description="Channel name")
	channel_type: ChannelType = Field(description="Type of communication channel")
	max_buffer_size: int = Field(default=1000, ge=1)
	message_ttl_seconds: int = Field(default=3600, ge=60)
	enable_persistence: bool = Field(default=False)
	enable_compression: bool = Field(default=False)
	priority_handling: bool = Field(default=True)

class ChannelMetrics(BaseModel):
	"""Channel performance metrics"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	messages_sent: int = 0
	messages_received: int = 0
	messages_dropped: int = 0
	active_connections: int = 0
	average_latency: float = 0.0
	buffer_utilization: float = 0.0
	error_count: int = 0
	uptime_seconds: float = 0.0

class BaseChannel(ABC):
	"""
	Base class for all communication channels
	
	Provides common functionality for message routing, buffering,
	and connection management across different channel types.
	"""
	
	def __init__(self, config: ChannelConfig):
		self.config = config
		self.channel_id = config.channel_id
		self.name = config.name
		self.status = ChannelStatus.ACTIVE
		
		# Message handling
		self.message_buffer: deque = deque(maxlen=config.max_buffer_size)
		self.message_queue: asyncio.Queue = asyncio.Queue(maxsize=config.max_buffer_size)
		
		# Connection management
		self.connections: Dict[str, Any] = {}
		self.subscribers: Set[str] = set()
		
		# Metrics and monitoring
		self.metrics = ChannelMetrics()
		self.created_at = datetime.now()
		
		# Channel control
		self._running = False
		self._processor_task: Optional[asyncio.Task] = None
		
		self.logger = logging.getLogger(f"channel.{self.name}")
		self.logger.info(f"Channel {self.name} ({self.config.channel_type}) initialized")
	
	async def start(self) -> None:
		"""Start the channel"""
		if self._running:
			return
		
		self._running = True
		self.status = ChannelStatus.ACTIVE
		self._processor_task = asyncio.create_task(self._message_processor())
		
		self.logger.info(f"Channel {self.name} started")
	
	async def stop(self) -> None:
		"""Stop the channel"""
		if not self._running:
			return
		
		self._running = False
		self.status = ChannelStatus.CLOSED
		
		if self._processor_task:
			self._processor_task.cancel()
		
		# Close all connections
		for connection_id in list(self.connections.keys()):
			await self.disconnect(connection_id)
		
		self.logger.info(f"Channel {self.name} stopped")
	
	async def pause(self) -> None:
		"""Pause channel operations"""
		self.status = ChannelStatus.PAUSED
		self.logger.info(f"Channel {self.name} paused")
	
	async def resume(self) -> None:
		"""Resume channel operations"""
		if self._running:
			self.status = ChannelStatus.ACTIVE
			self.logger.info(f"Channel {self.name} resumed")
	
	@abstractmethod
	async def send_message(self, message: AgentMessage, sender_id: Optional[str] = None, **kwargs) -> bool:
		"""Send a message through this channel"""
		raise NotImplementedError("send_message is not yet implemented")
	
	@abstractmethod
	async def connect(self, agent_id: str, connection_info: Dict[str, Any]) -> bool:
		"""Connect an agent to this channel"""
		raise NotImplementedError("connect is not yet implemented")
	
	@abstractmethod
	async def disconnect(self, agent_id: str) -> bool:
		"""Disconnect an agent from this channel"""
		raise NotImplementedError("disconnect is not yet implemented")
	
	async def _message_processor(self) -> None:
		"""Process messages in the queue"""
		while self._running:
			try:
				if self.status != ChannelStatus.ACTIVE:
					await asyncio.sleep(1.0)
					continue
				
				# Process queued messages
				message = await asyncio.wait_for(self.message_queue.get(), timeout=1.0)
				await self._process_message(message)
				
			except asyncio.TimeoutError:
				continue
			except Exception as e:
				self.logger.error(f"Message processing error: {e}")
				self.metrics.error_count += 1
				await asyncio.sleep(1.0)
	
	@abstractmethod
	async def _process_message(self, message: AgentMessage) -> None:
		"""Process a single message"""
		raise NotImplementedError("_process_message is not yet implemented")
	
	def get_channel_status(self) -> Dict[str, Any]:
		"""Get channel status and metrics"""
		uptime = (datetime.now() - self.created_at).total_seconds()
		self.metrics.uptime_seconds = uptime
		self.metrics.active_connections = len(self.connections)
		self.metrics.buffer_utilization = len(self.message_buffer) / self.config.max_buffer_size
		
		return {
			"channel_id": self.channel_id,
			"name": self.name,
			"type": self.config.channel_type.value,
			"status": self.status.value,
			"connections": len(self.connections),
			"subscribers": len(self.subscribers),
			"metrics": self.metrics.model_dump()
		}

class DirectChannel(BaseChannel):
	"""
	Direct one-to-one communication channel
	
	Provides reliable message delivery between two specific agents
	with guaranteed ordering and delivery confirmation.
	"""
	
	def __init__(self, config: ChannelConfig):
		super().__init__(config)
		self.sender_id: Optional[str] = None
		self.receiver_id: Optional[str] = None
		self.delivery_confirmations: Dict[str, bool] = {}
		
		self.logger.info(f"Direct channel {self.name} initialized")
	
	async def connect(self, agent_id: str, connection_info: Dict[str, Any]) -> bool:
		"""Connect an agent to the direct channel"""
		try:
			role = connection_info.get("role", "participant")
			
			if role == "sender" and not self.sender_id:
				self.sender_id = agent_id
			elif role == "receiver" and not self.receiver_id:
				self.receiver_id = agent_id
			else:
				# Direct channel supports only sender/receiver
				return False
			
			self.connections[agent_id] = {
				"role": role,
				"connected_at": datetime.now(),
				"message_queue": asyncio.Queue()
			}
			
			self.logger.info(f"Agent {agent_id} connected as {role}")
			return True
			
		except Exception as e:
			self.logger.error(f"Connection failed for {agent_id}: {e}")
			return False
	
	async def disconnect(self, agent_id: str) -> bool:
		"""Disconnect an agent from the channel"""
		try:
			if agent_id in self.connections:
				role = self.connections[agent_id]["role"]
				del self.connections[agent_id]
				
				if agent_id == self.sender_id:
					self.sender_id = None
				elif agent_id == self.receiver_id:
					self.receiver_id = None
				
				self.logger.info(f"Agent {agent_id} ({role}) disconnected")
				return True
			return False
			
		except Exception as e:
			self.logger.error(f"Disconnection failed for {agent_id}: {e}")
			return False
	
	async def send_message(self, message: AgentMessage, sender_id: str = None) -> bool:
		"""Send message through direct channel"""
		try:
			if self.status != ChannelStatus.ACTIVE:
				return False
			
			# Verify sender authorization
			if sender_id and sender_id != self.sender_id:
				self.logger.warning(f"Unauthorized send attempt by {sender_id}")
				return False
			
			# Queue message for processing
			await self.message_queue.put(message)
			self.metrics.messages_sent += 1
			
			return True
			
		except Exception as e:
			self.logger.error(f"Send failed: {e}")
			self.metrics.error_count += 1
			return False
	
	async def _process_message(self, message: AgentMessage) -> None:
		"""Process message in direct channel"""
		try:
			if not self.receiver_id or self.receiver_id not in self.connections:
				self.logger.warning("No receiver connected")
				self.metrics.messages_dropped += 1
				return
			
			# Deliver to receiver
			receiver_queue = self.connections[self.receiver_id]["message_queue"]
			await receiver_queue.put(message)
			
			# Add to buffer for history
			self.message_buffer.append({
				"message": message,
				"timestamp": datetime.now(),
				"delivered": True
			})
			
			self.metrics.messages_received += 1
			message.status = MessageStatus.DELIVERED
			
			self.logger.debug(f"Message delivered to {self.receiver_id}")
			
		except Exception as e:
			self.logger.error(f"Message processing failed: {e}")
			self.metrics.messages_dropped += 1
			message.status = MessageStatus.FAILED
	
	async def get_messages(self, agent_id: str) -> List[AgentMessage]:
		"""Get messages for an agent"""
		if agent_id not in self.connections:
			return []
		
		messages = []
		agent_queue = self.connections[agent_id]["message_queue"]
		
		while not agent_queue.empty():
			try:
				message = await asyncio.wait_for(agent_queue.get(), timeout=0.1)
				messages.append(message)
			except asyncio.TimeoutError:
				break
		
		return messages

class BroadcastChannel(BaseChannel):
	"""
	One-to-many broadcast communication channel
	
	Delivers messages from a single sender to multiple subscribers
	with efficient fanout and optional message filtering.
	"""
	
	def __init__(self, config: ChannelConfig):
		super().__init__(config)
		self.broadcaster_id: Optional[str] = None
		self.message_filters: Dict[str, Callable] = {}
		self.subscription_preferences: Dict[str, Dict[str, Any]] = {}
		
		self.logger.info(f"Broadcast channel {self.name} initialized")
	
	async def connect(self, agent_id: str, connection_info: Dict[str, Any]) -> bool:
		"""Connect an agent to the broadcast channel"""
		try:
			role = connection_info.get("role", "subscriber")
			
			if role == "broadcaster" and not self.broadcaster_id:
				self.broadcaster_id = agent_id
			elif role == "subscriber":
				self.subscribers.add(agent_id)
				
				# Store subscription preferences
				preferences = connection_info.get("preferences", {})
				self.subscription_preferences[agent_id] = preferences
			else:
				return False
			
			self.connections[agent_id] = {
				"role": role,
				"connected_at": datetime.now(),
				"message_queue": asyncio.Queue(),
				"preferences": connection_info.get("preferences", {})
			}
			
			self.logger.info(f"Agent {agent_id} connected as {role}")
			return True
			
		except Exception as e:
			self.logger.error(f"Connection failed for {agent_id}: {e}")
			return False
	
	async def disconnect(self, agent_id: str) -> bool:
		"""Disconnect an agent from the channel"""
		try:
			if agent_id in self.connections:
				role = self.connections[agent_id]["role"]
				del self.connections[agent_id]
				
				if agent_id == self.broadcaster_id:
					self.broadcaster_id = None
				else:
					self.subscribers.discard(agent_id)
					self.subscription_preferences.pop(agent_id, None)
				
				self.logger.info(f"Agent {agent_id} ({role}) disconnected")
				return True
			return False
			
		except Exception as e:
			self.logger.error(f"Disconnection failed for {agent_id}: {e}")
			return False
	
	async def send_message(self, message: AgentMessage, sender_id: str = None) -> bool:
		"""Send broadcast message"""
		try:
			if self.status != ChannelStatus.ACTIVE:
				return False
			
			# Verify broadcaster authorization
			if sender_id and sender_id != self.broadcaster_id:
				self.logger.warning(f"Unauthorized broadcast attempt by {sender_id}")
				return False
			
			# Queue message for processing
			await self.message_queue.put(message)
			self.metrics.messages_sent += 1
			
			return True
			
		except Exception as e:
			self.logger.error(f"Broadcast failed: {e}")
			self.metrics.error_count += 1
			return False
	
	async def _process_message(self, message: AgentMessage) -> None:
		"""Process broadcast message"""
		try:
			delivery_count = 0
			
			for subscriber_id in self.subscribers.copy():
				if subscriber_id not in self.connections:
					continue
				
				# Apply message filtering if configured
				if not self._should_deliver_to_subscriber(message, subscriber_id):
					continue
				
				try:
					subscriber_queue = self.connections[subscriber_id]["message_queue"]
					await subscriber_queue.put(message)
					delivery_count += 1
				except Exception as e:
					self.logger.warning(f"Delivery failed to {subscriber_id}: {e}")
			
			# Add to buffer for history
			self.message_buffer.append({
				"message": message,
				"timestamp": datetime.now(),
				"delivered_count": delivery_count
			})
			
			self.metrics.messages_received += delivery_count
			
			if delivery_count > 0:
				message.status = MessageStatus.DELIVERED
			else:
				message.status = MessageStatus.FAILED
				self.metrics.messages_dropped += 1
			
			self.logger.debug(f"Broadcast delivered to {delivery_count} subscribers")
			
		except Exception as e:
			self.logger.error(f"Broadcast processing failed: {e}")
			self.metrics.messages_dropped += 1
			message.status = MessageStatus.FAILED
	
	def _should_deliver_to_subscriber(self, message: AgentMessage, subscriber_id: str) -> bool:
		"""Check if message should be delivered to subscriber based on filters"""
		preferences = self.subscription_preferences.get(subscriber_id, {})
		
		# Message type filtering
		if "message_types" in preferences:
			allowed_types = preferences["message_types"]
			if message.header.message_type.value not in allowed_types:
				return False
		
		# Priority filtering
		if "min_priority" in preferences:
			min_priority = preferences["min_priority"]
			if message.header.priority < min_priority:
				return False
		
		# Topic filtering
		if "topics" in preferences:
			allowed_topics = preferences["topics"]
			message_topic = message.header.routing_key
			if message_topic and message_topic not in allowed_topics:
				return False
		
		return True
	
	async def subscribe_with_filter(self, agent_id: str, filter_criteria: Dict[str, Any]) -> bool:
		"""Subscribe with specific filtering criteria"""
		if agent_id in self.connections:
			self.subscription_preferences[agent_id].update(filter_criteria)
			self.logger.info(f"Updated filters for subscriber {agent_id}")
			return True
		return False
	
	async def get_messages(self, agent_id: str) -> List[AgentMessage]:
		"""Get messages for a subscriber"""
		if agent_id not in self.connections:
			return []
		
		messages = []
		agent_queue = self.connections[agent_id]["message_queue"]
		
		while not agent_queue.empty():
			try:
				message = await asyncio.wait_for(agent_queue.get(), timeout=0.1)
				messages.append(message)
			except asyncio.TimeoutError:
				break
		
		return messages

class AgentChannel(BaseChannel):
	"""
	General-purpose agent communication channel
	
	Supports multiple communication patterns including direct messaging,
	topic-based routing, and priority handling in a single flexible channel.
	"""
	
	def __init__(self, config: ChannelConfig):
		super().__init__(config)
		self.routing_table: Dict[str, Set[str]] = {}  # topic -> subscriber_ids
		self.agent_topics: Dict[str, Set[str]] = {}  # agent_id -> subscribed_topics
		self.priority_queues: Dict[str, asyncio.PriorityQueue] = {}
		
		self.logger.info(f"Agent channel {self.name} initialized")
	
	async def connect(self, agent_id: str, connection_info: Dict[str, Any]) -> bool:
		"""Connect an agent to the channel"""
		try:
			self.connections[agent_id] = {
				"connected_at": datetime.now(),
				"message_queue": asyncio.Queue(),
				"priority_queue": asyncio.PriorityQueue() if self.config.priority_handling else None,
				"subscribed_topics": set(),
				"preferences": connection_info.get("preferences", {})
			}
			
			self.agent_topics[agent_id] = set()
			
			# Auto-subscribe to topics if specified
			auto_topics = connection_info.get("auto_subscribe_topics", [])
			for topic in auto_topics:
				await self.subscribe_to_topic(agent_id, topic)
			
			self.logger.info(f"Agent {agent_id} connected")
			return True
			
		except Exception as e:
			self.logger.error(f"Connection failed for {agent_id}: {e}")
			return False
	
	async def disconnect(self, agent_id: str) -> bool:
		"""Disconnect an agent from the channel"""
		try:
			if agent_id in self.connections:
				# Unsubscribe from all topics
				for topic in self.agent_topics.get(agent_id, set()).copy():
					await self.unsubscribe_from_topic(agent_id, topic)
				
				del self.connections[agent_id]
				self.agent_topics.pop(agent_id, None)
				
				self.logger.info(f"Agent {agent_id} disconnected")
				return True
			return False
			
		except Exception as e:
			self.logger.error(f"Disconnection failed for {agent_id}: {e}")
			return False
	
	async def send_message(self, message: AgentMessage, sender_id: Optional[str] = None, **kwargs) -> bool:
		"""Send message through the channel"""
		try:
			if self.status != ChannelStatus.ACTIVE:
				return False
			
			# Queue message for processing
			await self.message_queue.put(message)
			self.metrics.messages_sent += 1
			
			return True
			
		except Exception as e:
			self.logger.error(f"Send failed: {e}")
			self.metrics.error_count += 1
			return False
	
	async def _process_message(self, message: AgentMessage) -> None:
		"""Process message based on routing requirements"""
		try:
			delivery_count = 0
			
			# Determine delivery mode
			delivery_mode = message.header.delivery_mode
			
			if delivery_mode == "direct":
				delivery_count = await self._deliver_direct(message)
			elif delivery_mode == "broadcast":
				delivery_count = await self._deliver_broadcast(message)
			elif delivery_mode == "topic":
				delivery_count = await self._deliver_topic(message)
			else:
				# Default to direct delivery
				delivery_count = await self._deliver_direct(message)
			
			# Update metrics
			if delivery_count > 0:
				self.metrics.messages_received += delivery_count
				message.status = MessageStatus.DELIVERED
			else:
				self.metrics.messages_dropped += 1
				message.status = MessageStatus.FAILED
			
			# Add to buffer for history
			self.message_buffer.append({
				"message": message,
				"timestamp": datetime.now(),
				"delivery_count": delivery_count
			})
			
		except Exception as e:
			self.logger.error(f"Message processing failed: {e}")
			self.metrics.messages_dropped += 1
			message.status = MessageStatus.FAILED
	
	async def _deliver_direct(self, message: AgentMessage) -> int:
		"""Deliver message directly to specific recipient"""
		recipient_id = message.header.recipient_id
		
		if not recipient_id or recipient_id not in self.connections:
			return 0
		
		try:
			if self.config.priority_handling and message.header.priority > 0:
				priority_queue = self.connections[recipient_id]["priority_queue"]
				await priority_queue.put((message.header.priority, message))
			else:
				message_queue = self.connections[recipient_id]["message_queue"]
				await message_queue.put(message)
			
			return 1
		except Exception:
			return 0
	
	async def _deliver_broadcast(self, message: AgentMessage) -> int:
		"""Deliver message to all connected agents"""
		delivery_count = 0
		
		for agent_id, connection in self.connections.items():
			if agent_id == message.header.sender_id:  # Don't send to sender
				continue
			
			try:
				message_queue = connection["message_queue"]
				await message_queue.put(message)
				delivery_count += 1
			except Exception:
				continue
		
		return delivery_count
	
	async def _deliver_topic(self, message: AgentMessage) -> int:
		"""Deliver message to topic subscribers"""
		routing_key = message.header.routing_key
		
		if not routing_key or routing_key not in self.routing_table:
			return 0
		
		delivery_count = 0
		subscribers = self.routing_table[routing_key]
		
		for subscriber_id in subscribers.copy():
			if subscriber_id not in self.connections:
				continue
			
			try:
				message_queue = self.connections[subscriber_id]["message_queue"]
				await message_queue.put(message)
				delivery_count += 1
			except Exception:
				continue
		
		return delivery_count
	
	async def subscribe_to_topic(self, agent_id: str, topic: str) -> bool:
		"""Subscribe agent to a topic"""
		if agent_id not in self.connections:
			return False
		
		try:
			# Add to routing table
			if topic not in self.routing_table:
				self.routing_table[topic] = set()
			self.routing_table[topic].add(agent_id)
			
			# Track agent subscriptions
			self.agent_topics[agent_id].add(topic)
			self.connections[agent_id]["subscribed_topics"].add(topic)
			
			self.logger.debug(f"Agent {agent_id} subscribed to topic: {topic}")
			return True
			
		except Exception as e:
			self.logger.error(f"Topic subscription failed: {e}")
			return False
	
	async def unsubscribe_from_topic(self, agent_id: str, topic: str) -> bool:
		"""Unsubscribe agent from a topic"""
		try:
			if topic in self.routing_table:
				self.routing_table[topic].discard(agent_id)
				
				# Clean up empty topics
				if not self.routing_table[topic]:
					del self.routing_table[topic]
			
			if agent_id in self.agent_topics:
				self.agent_topics[agent_id].discard(topic)
			
			if agent_id in self.connections:
				self.connections[agent_id]["subscribed_topics"].discard(topic)
			
			self.logger.debug(f"Agent {agent_id} unsubscribed from topic: {topic}")
			return True
			
		except Exception as e:
			self.logger.error(f"Topic unsubscription failed: {e}")
			return False
	
	async def get_messages(self, agent_id: str) -> List[AgentMessage]:
		"""Get messages for an agent (priority-aware)"""
		if agent_id not in self.connections:
			return []
		
		messages = []
		connection = self.connections[agent_id]
		
		# Get priority messages first
		if self.config.priority_handling and connection["priority_queue"]:
			priority_queue = connection["priority_queue"]
			while not priority_queue.empty():
				try:
					_, message = await asyncio.wait_for(priority_queue.get(), timeout=0.1)
					messages.append(message)
				except asyncio.TimeoutError:
					break
		
		# Get regular messages
		message_queue = connection["message_queue"]
		while not message_queue.empty():
			try:
				message = await asyncio.wait_for(message_queue.get(), timeout=0.1)
				messages.append(message)
			except asyncio.TimeoutError:
				break
		
		return messages
	
	def get_topic_subscribers(self, topic: str) -> List[str]:
		"""Get list of subscribers for a topic"""
		return list(self.routing_table.get(topic, set()))
	
	def get_agent_topics(self, agent_id: str) -> List[str]:
		"""Get list of topics an agent is subscribed to"""
		return list(self.agent_topics.get(agent_id, set()))