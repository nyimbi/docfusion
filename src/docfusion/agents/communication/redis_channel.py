"""
Redis-backed agent communication channel.

Pub/sub channel for cross-process agent communication with graceful
degradation when the redis package or server is unavailable.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from .channels import BaseChannel, ChannelConfig, ChannelStatus
from ..core.messages import AgentMessage, MessageStatus

logger = logging.getLogger(__name__)


class RedisChannel(BaseChannel):
	"""
	Redis pub/sub backed channel for cross-process agent communication.

	Gracefully degrades to a no-op if the ``redis`` package is not installed
	or the server is unreachable.
	"""

	def __init__(self, config: ChannelConfig):
		super().__init__(config)
		self._redis_client: Any = None
		self._pubsub: Any = None
		self._listener_task: Optional[asyncio.Task] = None
		self._redis_available = False
		self._channel_prefix = f"docfusion:channel:{self.name}"
		self.logger.info(f"Redis channel {self.name} initialized")

	def _import_redis(self) -> bool:
		"""Attempt to import redis asynchronously."""
		try:
			import redis.asyncio as aioredis  # type: ignore[import-untyped]
			self._redis_module = aioredis
			return True
		except ImportError:
			self.logger.warning("redis package not installed; RedisChannel will no-op")
			return False

	async def _connect_redis(self) -> bool:
		if not hasattr(self, "_redis_module") and not self._import_redis():
			return False
		try:
			self._redis_client = self._redis_module.Redis(
				host="localhost", port=6379, decode_responses=True
			)
			await self._redis_client.ping()
			self._pubsub = self._redis_client.pubsub()
			self._redis_available = True
			return True
		except Exception as e:
			self.logger.warning(f"Redis connection failed: {e}")
			self._redis_available = False
			return False

	async def connect(self, agent_id: str, connection_info: Dict[str, Any]) -> bool:
		try:
			if not self._redis_available:
				await self._connect_redis()
			self.connections[agent_id] = {
				"connected_at": datetime.now(),
				"preferences": connection_info.get("preferences", {}),
			}
			if self._redis_available and self._pubsub:
				await self._pubsub.subscribe(f"{self._channel_prefix}:broadcast")
			self.logger.info(f"Agent {agent_id} connected to Redis channel")
			return True
		except Exception as e:
			self.logger.error(f"Connection failed for {agent_id}: {e}")
			return False

	async def disconnect(self, agent_id: str) -> bool:
		try:
			if agent_id in self.connections:
				del self.connections[agent_id]
				self.logger.info(f"Agent {agent_id} disconnected from Redis channel")
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
			if self._redis_available and self._redis_client:
				payload = message.model_dump_json()
				channel = (
					f"{self._channel_prefix}:direct:{message.header.recipient_id}"
					if message.header.recipient_id
					else f"{self._channel_prefix}:broadcast"
				)
				await self._redis_client.publish(channel, payload)
				self.metrics.messages_received += 1
				message.status = MessageStatus.DELIVERED
			else:
				# Fallback: keep in local buffer for in-process consumption
				self.message_buffer.append({
					"message": message,
					"timestamp": datetime.now(),
				})
				self.metrics.messages_received += 1
				message.status = MessageStatus.DELIVERED
		except Exception as e:
			self.logger.error(f"Message processing failed: {e}")
			self.metrics.messages_dropped += 1
			message.status = MessageStatus.FAILED

	async def stop(self) -> None:
		self._running = False
		self.status = ChannelStatus.CLOSED
		if self._listener_task:
			self._listener_task.cancel()
		if self._pubsub:
			try:
				await self._pubsub.close()
			except Exception:
				pass
		if self._redis_client:
			try:
				await self._redis_client.close()
			except Exception:
				pass
		for connection_id in list(self.connections.keys()):
			await self.disconnect(connection_id)
		self.logger.info(f"Redis channel {self.name} stopped")
