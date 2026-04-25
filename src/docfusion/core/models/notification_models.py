"""Notification models stub."""

from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, ConfigDict


class NotificationChannel(str, Enum):
	"""Delivery channels for notifications."""
	EMAIL = "email"
	SMS = "sms"
	PUSH = "push"
	IN_APP = "in_app"
	WEBHOOK = "webhook"
	SLACK = "slack"


class Notification(BaseModel):
	"""A notification message."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	id: str = Field(default_factory=lambda: str(uuid4()))
	title: str = Field(description="Notification title")
	message: str = Field(description="Notification message")
	recipients: List[str] = Field(default_factory=list, description="Target recipients")
	channels: List[NotificationChannel] = Field(default_factory=list, description="Delivery channels")
	metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
