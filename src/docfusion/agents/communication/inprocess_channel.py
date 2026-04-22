"""
In-process agent communication channel.

Lightweight asyncio.Queue-backed channel optimized for single-process
agent orchestration with zero serialization overhead.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from .channels import BaseChannel, ChannelConfig, ChannelStatus
from ..core.messages import AgentMessage, MessageStatus

logger = logging.getLogger(__name__)


class InProcessChannel(BaseChannel):
	"""
	Lightweight in-process channel backed by asyncio.Queue.

	Optimized for single-process agent orchestration where all agents
	reside in the same Python runtime.  No serialization overhead.
	"""

	def __init__(self, config: ChannelConfig):
		super().__init__(config)
		self._agent_queues: Dict[str, asyncio.Queue] = {}
		self.logger.info(f"InProcess channel {self.name} initialized")

	async def connect(self, agent_id: str, connection_info: Dict[str, Any]) -> bool:
		try:
			if agent_id in self.connections:
				return True
			self.connections[agent_id] = {
				"connected_at": datetime.now(),
				"preferences": connection_info.get("preferences", {}),
			}
			self._agent_queues[agent_id] = asyncio.Queue(
				maxsize=self.config.max_buffer_size
			)
			self.logger.info(f"Agent {agent_id} connected to InProcess channel")
			return True
		except Exception as e:
			self.logger.error(f"Connection failed for {agent_id}: {e}")
			return False

	async def disconnect(self, agent_id: str) -> bool:
		try:
			if agent_id in self.connections:
				del self.connections[agent_id]
				self._agent_queues.pop(agent_id, None)
				self.logger.info(f"Agent {agent_id} disconnected from InProcess channel")
				return True
			return False
		except Exception as e:
			self.logger.error(f"Disconnection failed for {agent_id}: {e}")
			return False

	async def send_message(
		self, message: AgentMessage, sender_id: Optional[str] = None, **kwargs
	) -> bool:
		try:
			if self.status != ChannelStatus.ACTIVE:
				return False
			await self.message_queue.put(message)
			self.metrics.messages_sent += 1
			return True
		except Exception as e:
			self.logger.error(f"Send failed: {e}")
			self.metrics.error_count += 1
			return False

	async def _process_message(self, message: AgentMessage) -> None:
		try:
			recipient_id = message.header.recipient_id
			if recipient_id and recipient_id in self._agent_queues:
				await self._agent_queues[recipient_id].put(message)
				self.metrics.messages_received += 1
				message.status = MessageStatus.DELIVERED
				self.logger.debug(f"Message delivered to {recipient_id}")
			elif not recipient_id:
				# Broadcast to all connected agents except sender
				delivery_count = 0
				for agent_id, queue in self._agent_queues.items():
					if agent_id == message.header.sender_id:
						continue
					await queue.put(message)
					delivery_count += 1
				self.metrics.messages_received += delivery_count
				message.status = MessageStatus.DELIVERED
				self.logger.debug(f"Broadcast delivered to {delivery_count} agents")
			else:
				self.metrics.messages_dropped += 1
				message.status = MessageStatus.FAILED
				self.logger.warning(f"Recipient {recipient_id} not connected")
			self.message_buffer.append({
				"message": message,
				"timestamp": datetime.now(),
			})
		except Exception as e:
			self.logger.error(f"Message processing failed: {e}")
			self.metrics.messages_dropped += 1
			message.status = MessageStatus.FAILED

	async def get_messages(self, agent_id: str) -> List[AgentMessage]:
		if agent_id not in self._agent_queues:
			return []
		messages = []
		queue = self._agent_queues[agent_id]
		while not queue.empty():
			try:
				message = await asyncio.wait_for(queue.get(), timeout=0.1)
				messages.append(message)
			except asyncio.TimeoutError:
				break
		return messages
