---
id: TASK-010
title: 'Phase 2: Route StakeholderMapper through LiteLLM'
status: Done
assignee: []
created_date: ''
updated_date: '2026-04-22 22:14'
labels: []
dependencies:
  - task-007
priority: medium
---

# task-010 - Phase 2: Route StakeholderMapper through LiteLLM

## Description (the why)

`StakeholderMapper` calls Ollama directly at `localhost:11434` with `llama3.2:3b`. This bypasses the LiteLLM gateway, meaning no failover, no Redis caching, no cost tracking, and a hard dependency on local Ollama.

## Acceptance Criteria (the what)

- [ ] No `httpx` / `aiohttp` / `requests` calls to `localhost:11434` or `/api/generate` remain in `stakeholder_mapper.py`.
- [ ] All LLM calls go through `LiteLLMClient.chat_completion` using OpenAI-compatible `/v1/chat/completions` schema.
- [ ] `LLMFallbackChain` is used for resilience.
- [ ] Existing `test_stakeholder_mapper.py` tests still pass.
- [ ] A new test `test_stakeholder_mapper_litellm.py` verifies LiteLLM is called and Ollama is not.

## Implementation Plan (the how)

**Step 1: Read current implementation.**
```bash
grep -n "localhost:11434\|api/generate\|httpx\|aiohttp" src/docfusion/rfp/stakeholder_mapper.py
```

**Step 2: Replace the HTTP client.** Find every call site (likely inside methods like `_extract_stakeholders_with_llm`). Replace:

```python
# BEFORE
async with httpx.AsyncClient(base_url="http://localhost:11434") as client:
	response = await client.post("/api/generate", json={
		"model": "llama3.2:3b",
		"prompt": prompt,
		"stream": False,
	})
	result = response.json()["response"]
```

with:

```python
# AFTER
response = await self._fallback.chat_completion(
	messages=[{"role": "user", "content": prompt}],
	model="gpt-4o-mini",
)
result = response.choices[0].message.content
```

**Step 3: Update constructor.** Mirror task-008:

```python
def __init__(
	self,
	*,
	llm_client: LiteLLMClient | None = None,
	# ... existing kwargs ...
) -> None:
	self._llm_client = llm_client or LiteLLMClient()
	self._fallback = LLMFallbackChain(self._llm_client)
	# ... existing init ...
```

**Step 4: Adjust response parsing.** The Ollama `/api/generate` returns `{"response": "..."}`; OpenAI-style returns `{"choices": [{"message": {"content": "..."}}]}`. Every parser downstream must be updated.

**Step 5: Test.**

```python
# tests/ci/test_stakeholder_mapper_litellm.py
"""Ensure StakeholderMapper uses LiteLLM, not direct Ollama."""

import inspect

import pytest

from docfusion.rfp.stakeholder_mapper import StakeholderMapper

def test_no_direct_ollama_in_source():
	source = inspect.getsource(StakeholderMapper)
	assert "localhost:11434" not in source
	assert "/api/generate" not in source

async def test_maps_stakeholders_via_litellm(mock_litellm_gateway):
	mapper = StakeholderMapper()
	text = "The project manager, Alice Smith, will oversee delivery. The CTO approves."
	result = await mapper.map_stakeholders(text)
	assert len(result.stakeholders) >= 1
```

**Step 6: Verify.**
```bash
uv run pytest tests/ci/test_stakeholder_mapper.py tests/ci/test_stakeholder_mapper_litellm.py -vxs
grep -n "localhost:11434" src/docfusion/rfp/stakeholder_mapper.py
# Must return 0 lines.
```

**Step 7: Commit.**
```bash
git add src/docfusion/rfp/stakeholder_mapper.py tests/ci/test_stakeholder_mapper_litellm.py
git commit -m "refactor(rfp): route StakeholderMapper through LiteLLM [G-RFP-04]"
```

## Notes for less-capable agents

- `llama3.2:3b` → `gpt-4o-mini` is the preferred swap. If you need a specific smaller model, use `gpt-4o-mini` anyway and let LiteLLM route.
- Watch for temperature or prompt-format differences. Ollama prompts often include `<|system|>` markers that OpenAI ignores — strip them.
- If the mapper streams responses, `LiteLLMClient` has a `stream` variant — use that if streaming is meaningful.

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
StakeholderMapper routed through LiteLLM/LLMFallbackChain; 6 tests passing
<!-- SECTION:NOTES:END -->
