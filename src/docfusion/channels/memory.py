"""In-memory asyncio channel implementation."""

from __future__ import annotations

import asyncio
import logging

from .base import EventHandler
from .events import Event

logger = logging.getLogger(__name__)


class InMemoryChannel:
	"""Queue-backed channel with async subscriber dispatch."""

	def __init__(self) -> None:
		self._queue: asyncio.Queue[Event] = asyncio.Queue()
		self._handlers: list[EventHandler] = []
		self._dispatch_task: asyncio.Task[None] | None = None

	async def publish(self, event: Event) -> None:
		await self._queue.put(event)
		self._ensure_dispatcher()
		await self._queue.join()

	def subscribe(self, handler: EventHandler) -> None:
		if handler not in self._handlers:
			self._handlers.append(handler)
		self._ensure_dispatcher()

	def unsubscribe(self, handler: EventHandler) -> None:
		if handler in self._handlers:
			self._handlers.remove(handler)

	def _ensure_dispatcher(self) -> None:
		try:
			loop = asyncio.get_running_loop()
		except RuntimeError:
			return
		if (
			self._dispatch_task is None
			or self._dispatch_task.done()
			or self._dispatch_task.get_loop() is not loop
		):
			self._dispatch_task = loop.create_task(self._dispatch_loop())

	async def _dispatch_loop(self) -> None:
		try:
			while True:
				try:
					event = self._queue.get_nowait()
				except asyncio.QueueEmpty:
					break
				try:
					await self._notify_handlers(event)
				finally:
					self._queue.task_done()
		finally:
			self._dispatch_task = None

	async def _notify_handlers(self, event: Event) -> None:
		for handler in list(self._handlers):
			try:
				await handler(event)
			except Exception:
				logger.exception("In-memory channel handler failed for %s", event.event_type)


__all__ = ["InMemoryChannel"]
