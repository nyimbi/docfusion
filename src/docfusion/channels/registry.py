"""Singleton registry for DocuFusion communication channels."""

from __future__ import annotations

from .base import Channel
from .memory import InMemoryChannel


class ChannelRegistry:
	"""Process-wide channel registry."""

	_channels: dict[str, Channel] = {}

	@classmethod
	def register(cls, name: str, channel: Channel) -> None:
		cls._channels[name] = channel

	@classmethod
	def get_channel(cls, name: str) -> Channel:
		cls._ensure_defaults()
		try:
			return cls._channels[name]
		except KeyError as exc:
			raise KeyError(f"Channel {name!r} is not registered") from exc

	@classmethod
	def _ensure_defaults(cls) -> None:
		for name in ("events", "errors", "results"):
			cls._channels.setdefault(name, InMemoryChannel())


ChannelRegistry._ensure_defaults()

__all__ = ["ChannelRegistry"]
