"""Base protocol and helper types for DocuFusion agents."""

from __future__ import annotations

import asyncio
import functools
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import (
	Any,
	Awaitable,
	Callable,
	Literal,
	Protocol,
	TYPE_CHECKING,
	TypeVar,
	runtime_checkable,
)

from docfusion.core.utils import uuid7str

if TYPE_CHECKING:
	from docfusion.channels import Event


AgentStatus = Literal["success", "failure", "partial"]
F = TypeVar("F", bound=Callable[..., Awaitable[Any]])


@dataclass
class AgentTask:
	"""Task envelope consumed by an agent."""

	task_id: str = field(default_factory=uuid7str)
	task_type: str = ""
	payload: dict[str, Any] = field(default_factory=dict)
	context: dict[str, Any] = field(default_factory=dict)
	created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class AgentResult:
	"""Structured result returned by an agent."""

	task_id: str
	status: AgentStatus
	data: dict[str, Any] = field(default_factory=dict)
	errors: list[str] = field(default_factory=list)
	duration_ms: float = 0.0


@runtime_checkable
class AgentProtocol(Protocol):
	"""Structural protocol for executable agents."""

	@property
	def name(self) -> str: ...

	async def run(self, task: AgentTask) -> AgentResult: ...

	async def health(self) -> bool: ...


class BaseAgent(ABC):
	"""Common ABC for agents that run structured tasks."""

	@property
	def name(self) -> str:
		return getattr(self, "_agent_name", self.__class__.__name__)

	@name.setter
	def name(self, value: str) -> None:
		self._agent_name = value

	async def health(self) -> bool:
		"""Return whether the agent is available for work."""
		return True

	@abstractmethod
	async def run(self, task: AgentTask) -> AgentResult:
		"""Run a structured task and return a structured result."""

	async def emit(self, event: "Event") -> None:
		"""Publish an event to the default event channel."""
		from docfusion.channels import ChannelRegistry

		asyncio.create_task(ChannelRegistry.get_channel("events").publish(event))

	def _build_result(
		self,
		task: AgentTask | str,
		status: AgentStatus = "success",
		data: dict[str, Any] | None = None,
		errors: list[str] | None = None,
		duration_ms: float | None = None,
		started_at: datetime | None = None,
	) -> AgentResult:
		"""Build a consistent AgentResult for success and failure paths."""
		task_id = task.task_id if isinstance(task, AgentTask) else task
		if duration_ms is None:
			if started_at is None:
				duration_ms = 0.0
			else:
				duration_ms = (datetime.utcnow() - started_at).total_seconds() * 1000
		return AgentResult(
			task_id=task_id,
			status=status,
			data=data or {},
			errors=errors or [],
			duration_ms=float(duration_ms),
		)

	@staticmethod
	def _with_retry(
		max_attempts: int = 3,
		delay_seconds: float = 0.1,
		exceptions: tuple[type[BaseException], ...] = (Exception,),
		backoff: float = 1.0,
	) -> Callable[[F], F]:
		"""Decorate an async function with bounded retry behavior."""
		if max_attempts < 1:
			raise ValueError("max_attempts must be at least 1")

		def decorator(func: F) -> F:
			@functools.wraps(func)
			async def wrapper(*args: Any, **kwargs: Any) -> Any:
				delay = delay_seconds
				last_error: BaseException | None = None
				for attempt in range(1, max_attempts + 1):
					try:
						return await func(*args, **kwargs)
					except exceptions as exc:
						last_error = exc
						if attempt >= max_attempts:
							break
						agent = args[0] if args else None
						if hasattr(agent, "_log_warning"):
							agent._log_warning(
								"%s failed on attempt %s/%s: %s",
								func.__name__,
								attempt,
								max_attempts,
								exc,
							)
						await asyncio.sleep(delay)
						delay *= backoff
				assert last_error is not None
				raise last_error

			return wrapper  # type: ignore[return-value]

		return decorator

	@property
	def _base_logger(self) -> logging.Logger:
		return getattr(self, "logger", logging.getLogger(f"agent.{self.name}"))

	def _log_debug(self, message: str, *args: Any, **kwargs: Any) -> None:
		self._base_logger.debug(message, *args, **kwargs)

	def _log_info(self, message: str, *args: Any, **kwargs: Any) -> None:
		self._base_logger.info(message, *args, **kwargs)

	def _log_warning(self, message: str, *args: Any, **kwargs: Any) -> None:
		self._base_logger.warning(message, *args, **kwargs)

	def _log_error(self, message: str, *args: Any, **kwargs: Any) -> None:
		self._base_logger.error(message, *args, **kwargs)

	def _log_exception(self, message: str, *args: Any, **kwargs: Any) -> None:
		self._base_logger.exception(message, *args, **kwargs)


__all__ = ["AgentProtocol", "BaseAgent", "AgentTask", "AgentResult"]
