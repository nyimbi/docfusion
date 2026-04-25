"""Notification manager stub."""

from typing import Any, Dict, List, Optional


class NotificationManager:
	"""Stub notification manager for discovery integration."""

	async def send(self, *, recipients: List[str], title: str, message: str, channels: List[str], metadata: Optional[Dict[str, Any]] = None) -> bool:
		return True
