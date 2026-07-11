"""Event payloads published through DocuFusion channels."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class Event:
	"""Event emitted by an agent or system component."""

	event_type: str
	payload: dict[str, Any]
	timestamp: datetime = field(default_factory=datetime.utcnow)
	source_agent: str | None = None


__all__ = ["Event"]
