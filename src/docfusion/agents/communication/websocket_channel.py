"""
WebSocket-backed agent communication channel.

Real-time browser-agent communication wrapping ``websockets`` connections
and exposing them through the BaseChannel interface.

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


class WebSocketChannel(BaseChannel):
	"""
	WebSocket-backed channel for real-time browser-agent communication.

	Wraps ``websockets`` connections and exposes them through the
	BaseChannel interface so orchestrators can treat local and remote
	agents uniformly.
	"""

	def __init__(self, config: ChannelConfig):
		super().__init__(config)
		self._websockets: Dict[str, Any] = {}
		self._ws_available = False
		self.logger.info(f"WebSocket channel {self.name} initialized")

	def _import_websockets(self) -> bool:
		try:
			import websockets  # type: ignore[import-untyped]
			self._ws_module = websockets
			self._ws_available = True
			return True
		except ImportError:
			self.logger.warning("websockets package not installed; WebSocketChannel will no-op")
			return False

	async def connect(self, agent_id: str, connection_info: Dict[str, Any]) -> bool:
		try:
			ws = connection_info.get("websocket")
			if ws:
				self._websockets[agent_id] = ws
				self._ws_available = True
			self.connections[agent_id] = {
				"connected_at": datetime.now(),
				"preferences": connection_info.get("preferences", {}),
				"message_queue": asyncio.Queue(),
			}
			self.logger.info(f"Agent {agent_id} connected to WebSocket channel")
			return True
		except Exception as e:
			self.logger.error(f"Connection failed for {agent_id}: {e}")
			return False

	async def disconnect(self, agent_id: str) -> bool:
		try:
			if agent_id in self.connections:
				del self.connections[agent_id]
			if agent_id in self._websockets:
				ws = self._websockets.pop(agent_id)
				try:
					await ws.close()
				except Exception:
					pass
				self.logger.info(f"Agent {agent_id} WebSocket closed")
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
			if recipient_id and recipient_id in self._websockets:
				ws = self._websockets[recipient_id]
				payload = message.model_dump_json()
				await ws.send(payload)
				self.metrics.messages_received += 1
				message.status = MessageStatus.DELIVERED
				self.logger.debug(f"Message sent via WebSocket to {recipient_id}")
			elif recipient_id and recipient_id in self.connections:
				# Fallback to local queue if WebSocket not available
				queue = self.connections[recipient_id]["message_queue"]
				await queue.put(message)
				self.metrics.messages_received += 1
				message.status = MessageStatus.DELIVERED
			else:
				self.metrics.messages_dropped += 1
				message.status = MessageStatus.FAILED
			self.message_buffer.append({
				"message": message,
				"timestamp": datetime.now(),
			})
		except Exception as e:
			self.logger.error(f"Message processing failed: {e}")
			self.metrics.messages_dropped += 1
			message.status = MessageStatus.FAILED

	async def get_messages(self, agent_id: str) -> List[AgentMessage]:
		if agent_id not in self.connections:
			return []
		messages = []
		queue = self.connections[agent_id]["message_queue"]
		while not queue.empty():
			try:
				message = await asyncio.wait_for(queue.get(), timeout=0.1)
				messages.append(message)
			except asyncio.TimeoutError:
				break
		return messages
