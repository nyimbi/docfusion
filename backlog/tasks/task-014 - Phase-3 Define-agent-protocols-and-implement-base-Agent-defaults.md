---
id: task-014
title: "Phase 3: Define agent protocols and implement base Agent defaults"
status: To Do
phase: 3
gap_ids: [G-AG-01, G-AG-02, G-AG-03, G-AG-04, G-AG-05]
priority: Critical
---

# task-014 - Phase 3: Define agent protocols and implement base Agent defaults

## Description (the why)

`src/docfusion/agents/core/agent.py` has five `NotImplementedError` sites on methods that every concrete agent needs: `process_task`, `handle_message`, `get_capabilities`, `evaluate_task_fit`, and a fallback client's `close`. Without working defaults, specialist agents cannot dispatch work. We introduce `Protocol` classes, turn `Agent` into a non-abstract base with sensible defaults, and move the strict contract into the protocols.

## Acceptance Criteria (the what)

- [ ] `src/docfusion/agents/core/protocols.py` exists defining `TaskHandler`, `MessageHandler`, `CapabilityProvider` as `Protocol` classes.
- [ ] `src/docfusion/agents/core/agent.py` no longer raises `NotImplementedError` — each of the five methods has a concrete default.
- [ ] The fallback `OllamaClient.close` is a real no-op coroutine (does not raise).
- [ ] Every specialist in `src/docfusion/agents/specialists/` still instantiates without error.
- [ ] Test `tests/ci/test_base_agent_defaults.py` verifies each default behaviour.

## Implementation Plan (the how)

**Step 1: Read the current file end-to-end.**
```bash
wc -l src/docfusion/agents/core/agent.py
```

Note the imports, the constructor fields, and the surrounding abstract contract. You need to preserve everything that already works.

**Step 2: Create `src/docfusion/agents/core/protocols.py`.**

```python
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
```

**Step 3: Replace the five `NotImplementedError` bodies** in `src/docfusion/agents/core/agent.py`.

Find each line in the table below and replace it with the replacement:

| Line | Current | Replacement |
|---|---|---|
| 53 | `raise NotImplementedError("close is not yet implemented")` | `return None` |
| 310 | `raise NotImplementedError("process_task is not yet implemented")` | Use template A below |
| 315 | `raise NotImplementedError("handle_message is not yet implemented")` | Use template B below |
| 320 | `raise NotImplementedError("get_capabilities is not yet implemented")` | Use template C below |
| 325 | `raise NotImplementedError("evaluate_task_fit is not yet implemented")` | Use template D below |

**Template A — `process_task`:**

```python
async def process_task(self, task: dict[str, Any]) -> dict[str, Any]:
	"""Default task processor. Subclasses override for domain logic.

	The default records the task, invokes the LLM with the task prompt, and
	returns the raw response wrapped as a success result. Callers that need
	structured output MUST override this method.
	"""
	assert isinstance(task, dict), "task must be a dict"
	self._log_task_received(task)
	prompt = task.get("prompt") or task.get("description") or str(task)

	try:
		response = await self._fallback.chat_completion(
			messages=[{"role": "user", "content": prompt}],
			model=task.get("model", "gpt-4o-mini"),
		)
		content = response.choices[0].message.content
	except Exception as exc:
		self._log_task_failure(task, exc)
		return {"status": "failed", "task_id": task.get("id"), "error": str(exc)}

	return {"status": "completed", "task_id": task.get("id"), "result": content}
```

**Template B — `handle_message`:**

```python
async def handle_message(self, message: dict[str, Any]) -> dict[str, Any] | None:
	"""Default message handler. Dispatches by message type.

	Subclasses extend by overriding `_handle_custom_message`.
	"""
	assert isinstance(message, dict), "message must be a dict"
	msg_type = message.get("type", "unknown")

	handlers = {
		"ping": lambda m: {"type": "pong", "sender": self.agent_id},
		"capability_query": lambda m: {"type": "capability_response", "capabilities": self.get_capabilities()},
		"task_assignment": lambda m: None,  # Subclass overrides to accept.
	}
	handler = handlers.get(msg_type)
	if handler is not None:
		return handler(message)
	return await self._handle_custom_message(message)


async def _handle_custom_message(self, message: dict[str, Any]) -> dict[str, Any] | None:
	"""Override in subclasses to handle domain-specific message types."""
	self._log_unknown_message(message)
	return None
```

**Template C — `get_capabilities`:**

```python
def get_capabilities(self) -> list[str]:
	"""Return the capability names this agent advertises.

	Default reads from `self.capabilities` if set during init; otherwise
	returns an empty list. Subclasses may override for dynamic capabilities.
	"""
	return list(getattr(self, "capabilities", []) or [])
```

**Template D — `evaluate_task_fit`:**

```python
def evaluate_task_fit(self, task: dict[str, Any]) -> float:
	"""Return a 0.0–1.0 score for how well this agent fits the task.

	Default score: Jaccard similarity between the task's required capabilities
	and this agent's declared capabilities. Subclasses override for smarter
	routing.
	"""
	required = set(task.get("required_capabilities", []) or [])
	if not required:
		return 0.5
	mine = set(self.get_capabilities())
	if not mine:
		return 0.0
	intersection = required & mine
	union = required | mine
	return len(intersection) / len(union) if union else 0.0
```

**Step 4: Add logging helpers** if they don't already exist:

```python
def _log_task_received(self, task: dict[str, Any]) -> None:
	self.logger.info("Agent %s received task %s", self.agent_id, task.get("id"))


def _log_task_failure(self, task: dict[str, Any], exc: Exception) -> None:
	self.logger.warning("Agent %s failed task %s: %s", self.agent_id, task.get("id"), exc)


def _log_unknown_message(self, message: dict[str, Any]) -> None:
	self.logger.debug("Agent %s received unknown message type %s", self.agent_id, message.get("type"))
```

**Step 5: Test.**

```python
# tests/ci/test_base_agent_defaults.py
"""Defaults for BaseAgent so subclasses don't need to reimplement trivial hooks."""

import pytest

from docfusion.agents.core.agent import Agent


class TinyAgent(Agent):
	pass


async def test_process_task_completes_on_stub(mock_litellm_gateway):
	agent = TinyAgent(agent_id="tiny", capabilities=["demo"])
	result = await agent.process_task({"id": "t1", "prompt": "say hi"})
	assert result["status"] == "completed"


async def test_handle_ping_returns_pong():
	agent = TinyAgent(agent_id="tiny")
	response = await agent.handle_message({"type": "ping"})
	assert response == {"type": "pong", "sender": "tiny"}


def test_capabilities_match_returns_fit_score():
	agent = TinyAgent(agent_id="tiny", capabilities=["writer", "editor"])
	score = agent.evaluate_task_fit({"required_capabilities": ["writer"]})
	assert 0.0 < score <= 1.0


def test_no_capability_overlap_returns_zero():
	agent = TinyAgent(agent_id="tiny", capabilities=["writer"])
	score = agent.evaluate_task_fit({"required_capabilities": ["reviewer"]})
	assert score == 0.0
```

**Step 6: Verify.**
```bash
uv run pytest tests/ci/test_base_agent_defaults.py -vxs
grep -n "NotImplementedError" src/docfusion/agents/core/agent.py
# Must be 0 lines.
```

**Step 7: Commit.**
```bash
git add src/docfusion/agents/core/agent.py src/docfusion/agents/core/protocols.py tests/ci/test_base_agent_defaults.py
git commit -m "feat(agents): concrete defaults for BaseAgent; add protocols [G-AG-01..05]"
```

## Notes for less-capable agents

- The `Agent` constructor likely has many fields — do NOT change its signature. Only add new methods.
- `self._fallback` may not exist on the base class. If it doesn't, either add it with `LiteLLMClient + LLMFallbackChain` in `__init__`, or accept that the default `process_task` requires subclasses to set `self._fallback`.
- When you run the existing specialist tests, they should still pass. If they fail because they previously relied on `NotImplementedError` as a signal, those tests are broken — fix them.
