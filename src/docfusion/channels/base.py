"""Channel protocol definitions."""

from __future__ import annotations

from typing import Awaitable, Callable, Protocol

from .events import Event

EventHandler = Callable[[Event], Awaitable[None]]


class Channel(Protocol):
	"""Protocol for event channels."""

	async def publish(self, event: Event) -> None: ...

	def subscribe(self, handler: EventHandler) -> None: ...

	def unsubscribe(self, handler: EventHandler) -> None: ...


__all__ = ["Channel", "EventHandler"]
