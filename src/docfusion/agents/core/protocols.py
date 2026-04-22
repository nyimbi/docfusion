"""Protocol definitions for DocuFusion agents.

These are structural interfaces — an object satisfies a protocol if it has
the required methods. Protocols are enforced by type checkers, not at runtime.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class TaskHandler(Protocol):
	"""An object that can accept and process a task."""

	async def process_task(self, task: dict[str, Any]) -> dict[str, Any]: ...


@runtime_checkable
class MessageHandler(Protocol):
	"""An object that can receive and respond to a message."""

	async def handle_message(self, message: dict[str, Any]) -> dict[str, Any] | None: ...


@runtime_checkable
class CapabilityProvider(Protocol):
	"""An object that advertises capabilities."""

	def get_capabilities(self) -> list[str]: ...
	def evaluate_task_fit(self, task: dict[str, Any]) -> float: ...
