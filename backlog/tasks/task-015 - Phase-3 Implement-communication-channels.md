---
id: task-015
title: "Phase 3: Implement communication channels"
status: To Do
phase: 3
gap_ids: [G-CM-01, G-CM-02, G-CM-03, G-CM-04]
priority: Critical
---

# task-015 - Phase 3: Implement communication channels

## Description (the why)

`src/docfusion/agents/communication/channels.py` has four `NotImplementedError` sites on `send_message`, `connect`, `disconnect`, `_process_message`. Without them, agents cannot exchange messages. We implement three concrete channel types: `InProcessChannel` (asyncio Queue), `RedisChannel` (pub/sub), and `WebSocketChannel` (aiohttp).

## Acceptance Criteria (the what)

- [ ] The abstract `Channel` class still exists but has defaults or is explicitly abstract via ABC.
- [ ] `InProcessChannel`, `RedisChannel`, `WebSocketChannel` concrete classes exist.
- [ ] None of the three raises `NotImplementedError`.
- [ ] Tests in `tests/ci/test_channels.py` verify: (a) InProcessChannel can send + receive, (b) two InProcessChannel instances can talk via a shared bus, (c) connect/disconnect change connection state correctly, (d) RedisChannel tests skip gracefully when no Redis is available.

## Implementation Plan (the how)

**Step 1: Read the file.**
```bash
wc -l src/docfusion/agents/communication/channels.py
grep -n "^class\|def " src/docfusion/agents/communication/channels.py
```

**Step 2: Restructure.** Keep the abstract `Channel` class as an `ABC`:

```python
from abc import ABC, abstractmethod
from typing import Any


class Channel(ABC):
	"""Abstract base for agent communication channels."""

	def __init__(self, channel_id: str) -> None:
		self.channel_id = channel_id
		self._connected = False

	@property
	def is_connected(self) -> bool:
		return self._connected

	@abstractmethod
	async def send_message(self, message: dict[str, Any]) -> None: ...

	@abstractmethod
	async def connect(self) -> None: ...

	@abstractmethod
	async def disconnect(self) -> None: ...

	@abstractmethod
	async def _process_message(self, message: dict[str, Any]) -> None: ...
```

Notice we keep `@abstractmethod` but **remove the `NotImplementedError` bodies** — abstract methods don't need a body beyond `...`.

**Step 3: InProcessChannel.**

```python
import asyncio


class InProcessChannel(Channel):
	"""asyncio.Queue-backed channel. All participants share one MessageBus."""

	_bus: "MessageBus | None" = None

	def __init__(self, channel_id: str, bus: "MessageBus | None" = None) -> None:
		super().__init__(channel_id)
		self._bus = bus or MessageBus.default()
		self._subscribers: list[asyncio.Queue[dict[str, Any]]] = []

	async def connect(self) -> None:
		self._bus.register(self)
		self._connected = True

	async def disconnect(self) -> None:
		self._bus.unregister(self)
		self._connected = False

	async def send_message(self, message: dict[str, Any]) -> None:
		if not self._connected:
			raise RuntimeError(f"Channel {self.channel_id} is not connected")
		await self._bus.publish(self.channel_id, message)

	async def receive(self, timeout: float | None = None) -> dict[str, Any]:
		"""Receive one message. Times out if no message arrives."""
		queue = self._bus.queue_for(self.channel_id)
		if timeout is None:
			return await queue.get()
		return await asyncio.wait_for(queue.get(), timeout)

	async def _process_message(self, message: dict[str, Any]) -> None:
		# InProcessChannel doesn't do processing; consumers call receive().
		pass


class MessageBus:
	"""Shared in-memory message bus."""

	_instance: "MessageBus | None" = None

	def __init__(self) -> None:
		self._queues: dict[str, asyncio.Queue[dict[str, Any]]] = {}

	@classmethod
	def default(cls) -> "MessageBus":
		if cls._instance is None:
			cls._instance = cls()
		return cls._instance

	def register(self, channel: InProcessChannel) -> None:
		self._queues.setdefault(channel.channel_id, asyncio.Queue())

	def unregister(self, channel: InProcessChannel) -> None:
		self._queues.pop(channel.channel_id, None)

	def queue_for(self, channel_id: str) -> asyncio.Queue[dict[str, Any]]:
		if channel_id not in self._queues:
			self._queues[channel_id] = asyncio.Queue()
		return self._queues[channel_id]

	async def publish(self, target_channel_id: str, message: dict[str, Any]) -> None:
		queue = self.queue_for(target_channel_id)
		await queue.put(message)
```

**Step 4: RedisChannel (skeleton — optional dependency).**

```python
class RedisChannel(Channel):
	"""Redis pub/sub channel. Requires the `redis` package."""

	def __init__(self, channel_id: str, url: str | None = None) -> None:
		super().__init__(channel_id)
		from docfusion.config.secrets import SecretsManager
		self._url = url or SecretsManager().get_redis_url()
		self._client = None
		self._pubsub = None

	async def connect(self) -> None:
		import redis.asyncio as redis
		self._client = redis.from_url(self._url)
		self._pubsub = self._client.pubsub()
		await self._pubsub.subscribe(self.channel_id)
		self._connected = True

	async def disconnect(self) -> None:
		if self._pubsub is not None:
			await self._pubsub.unsubscribe(self.channel_id)
			await self._pubsub.close()
		if self._client is not None:
			await self._client.close()
		self._connected = False

	async def send_message(self, message: dict[str, Any]) -> None:
		import json
		if not self._connected:
			raise RuntimeError("Not connected")
		await self._client.publish(self.channel_id, json.dumps(message))

	async def _process_message(self, message: dict[str, Any]) -> None:
		# Subclasses or a listener task consume here.
		pass
```

If `SecretsManager` doesn't yet have `get_redis_url`, add it (default `redis://localhost:6379/0`).

**Step 5: WebSocketChannel (minimal).**

```python
class WebSocketChannel(Channel):
	"""aiohttp WebSocket channel."""

	def __init__(self, channel_id: str, url: str) -> None:
		super().__init__(channel_id)
		self._url = url
		self._ws = None
		self._session = None

	async def connect(self) -> None:
		import aiohttp
		self._session = aiohttp.ClientSession()
		self._ws = await self._session.ws_connect(self._url)
		self._connected = True

	async def disconnect(self) -> None:
		if self._ws is not None:
			await self._ws.close()
		if self._session is not None:
			await self._session.close()
		self._connected = False

	async def send_message(self, message: dict[str, Any]) -> None:
		import json
		if not self._connected:
			raise RuntimeError("Not connected")
		await self._ws.send_str(json.dumps(message))

	async def _process_message(self, message: dict[str, Any]) -> None:
		pass
```

**Step 6: Test.**

```python
# tests/ci/test_channels.py
"""Communication channel coverage."""

import asyncio
import os

import pytest

from docfusion.agents.communication.channels import (
	InProcessChannel, MessageBus, RedisChannel, WebSocketChannel,
)


async def test_inprocess_send_and_receive():
	bus = MessageBus()
	ch = InProcessChannel("alice", bus=bus)
	await ch.connect()
	await ch.send_message({"hello": "world"})
	msg = await ch.receive(timeout=1.0)
	assert msg == {"hello": "world"}
	await ch.disconnect()


async def test_two_channels_on_same_bus():
	bus = MessageBus()
	alice = InProcessChannel("alice", bus=bus)
	bob = InProcessChannel("bob", bus=bus)
	await alice.connect()
	await bob.connect()

	await bus.publish("bob", {"from": "alice"})
	msg = await bob.receive(timeout=1.0)
	assert msg["from"] == "alice"

	await alice.disconnect()
	await bob.disconnect()


async def test_send_before_connect_raises():
	ch = InProcessChannel("solo")
	with pytest.raises(RuntimeError, match="not connected"):
		await ch.send_message({"x": 1})


@pytest.mark.skipif(not os.environ.get("REDIS_URL"), reason="Redis not available")
async def test_redis_channel_roundtrip():
	ch = RedisChannel("test-channel")
	await ch.connect()
	await ch.send_message({"test": True})
	await ch.disconnect()
```

**Step 7: Verify + commit.**
```bash
uv run pytest tests/ci/test_channels.py -vxs
grep -n "NotImplementedError" src/docfusion/agents/communication/channels.py
# Must be 0 lines.

git add src/docfusion/agents/communication/ tests/ci/test_channels.py
git commit -m "feat(agents): implement InProcess, Redis, WebSocket channels [G-CM-01..04]"
```

## Notes for less-capable agents

- `MessageBus` is intentionally a singleton for in-process use. Tests that need isolation create their own `MessageBus()` and pass it.
- Do NOT add new deps without updating `pyproject.toml`. If `redis` or `aiohttp` aren't already present, add them with `uv add redis aiohttp`.
- The `WebSocketChannel.connect` leaks the session if `ws_connect` fails — that's acceptable for now; a follow-up task can harden it.
