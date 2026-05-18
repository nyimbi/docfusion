from typing import Any

import pytest

from docfusion.api.endpoints.websocket_endpoints import (
	MessageType,
	WebSocketEndpoints,
	WebSocketMessage,
)


class FakeSecurity:
	def __init__(self, allowed: bool = True):
		self.allowed = allowed

	async def check_document_permission(
		self,
		document_id: str,
		user_id: str,
		permission_level: str,
		context: dict[str, Any],
	) -> dict[str, Any]:
		return {"has_permission": self.allowed}


class FakeStorage:
	def __init__(self, result: dict[str, Any] | None = None):
		self.result = result or {"success": True, "version": "v2"}
		self.calls: list[dict[str, Any]] = []

	async def update_document(self, **kwargs: Any) -> dict[str, Any]:
		self.calls.append(kwargs)
		return self.result


class FakeConnectionManager:
	def __init__(self):
		self.user_messages: list[tuple[str, MessageType, dict[str, Any]]] = []
		self.subscriber_messages: list[tuple[str, MessageType, dict[str, Any], str | None]] = []

	async def send_to_user(
		self,
		user_id: str,
		message_type: MessageType,
		data: dict[str, Any],
	) -> None:
		self.user_messages.append((user_id, message_type, data))

	async def send_to_document_subscribers(
		self,
		document_id: str,
		message_type: MessageType,
		data: dict[str, Any],
		exclude_user: str | None = None,
	) -> None:
		self.subscriber_messages.append((document_id, message_type, data, exclude_user))


def _message(data: dict[str, Any]) -> WebSocketMessage:
	return WebSocketMessage(type=MessageType.DOCUMENT_SAVE, data=data)


@pytest.mark.asyncio
async def test_document_save_persists_content_before_acknowledging_success():
	storage = FakeStorage()
	endpoints = WebSocketEndpoints(FakeSecurity(), storage_service=storage)
	connections = FakeConnectionManager()
	endpoints.connection_manager = connections

	await endpoints.handle_document_save(
		"user-1",
		_message({"document_id": "doc-1", "content": "updated content"}),
		{"user_id": "user-1", "session_id": "session-1"},
	)

	assert storage.calls == [
		{
			"document_id": "doc-1",
			"user_id": "user-1",
			"title": None,
			"content": "updated content",
			"metadata": None,
			"context": {
				"user_id": "user-1",
				"ip_address": None,
				"user_agent": None,
				"session_id": "session-1",
				"permissions": [],
				"via_websocket": True,
			},
		}
	]
	assert connections.user_messages[0][1] == MessageType.DOCUMENT_SAVED
	assert connections.user_messages[0][2]["version"] == "v2"
	assert connections.subscriber_messages[0][1] == MessageType.DOCUMENT_SAVED


@pytest.mark.asyncio
async def test_document_save_without_storage_reports_error_not_saved():
	endpoints = WebSocketEndpoints(FakeSecurity(), storage_service=None)
	connections = FakeConnectionManager()
	endpoints.connection_manager = connections

	await endpoints.handle_document_save(
		"user-1",
		_message({"document_id": "doc-1", "content": "updated content"}),
		{"user_id": "user-1"},
	)

	assert connections.user_messages == [
		(
			"user-1",
			MessageType.ERROR,
			{"error": "Document save service unavailable"},
		)
	]
	assert connections.subscriber_messages == []
