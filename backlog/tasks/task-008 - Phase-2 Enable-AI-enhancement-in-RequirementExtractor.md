---
id: task-008
title: "Phase 2: Enable AI enhancement in RequirementExtractor"
status: To Do
phase: 2
gap_ids: [G-RFP-01, G-FB-01]
priority: High
dependencies: [task-007]
---

# task-008 - Phase 2: Enable AI enhancement in RequirementExtractor

## Description (the why)

`RequirementExtractor` today runs regex-only with `ai_enhancement=False`. This misses implicit requirements, cross-refs, and requirements stated in prose. Adding an AI refinement pass — while keeping the fast regex pass — gives us both speed and quality.

## Acceptance Criteria (the what)

- [ ] `RequirementExtractor.__init__` defaults `ai_enhancement=True` when LiteLLM is reachable, falls back to `False` otherwise.
- [ ] A new async method `_extract_with_ai(self, text: str, sections: list) -> list[Requirement]` exists.
- [ ] AI calls route through `LiteLLMClient` and `LLMFallbackChain` — no direct provider calls.
- [ ] Regex extraction still runs first; AI runs second, merging results by confidence.
- [ ] Unit test in `tests/ci/test_requirement_extractor_ai.py` verifies: (a) AI pass discovers a requirement regex missed, (b) regex-only path still works when LiteLLM is down (fallback chain exhausts), (c) merging preserves the higher-confidence item when both find the same requirement.

## Implementation Plan (the how)

**Step 1: Read the existing module.**
```bash
wc -l src/docfusion/rfp/requirement_extractor.py
grep -n "class RequirementExtractor\|def extract\|def __init__\|ai_enhancement" src/docfusion/rfp/requirement_extractor.py
```

**Step 2: Add imports.**

```python
from docfusion.infrastructure.litellm_client import LiteLLMClient
from docfusion.infrastructure.llm_fallback import LLMFallbackChain
```

If those modules don't exist at those paths, `grep -rn "class LiteLLMClient" src/docfusion/` to find them and adjust.

**Step 3: Modify `__init__`** to accept and configure the LLM client:

```python
def __init__(
	self,
	*,
	ai_enhancement: bool | None = None,
	llm_client: LiteLLMClient | None = None,
	# ... keep all existing kwargs ...
) -> None:
	# ... existing init code ...
	self._llm_client = llm_client or LiteLLMClient()
	self._fallback = LLMFallbackChain(self._llm_client)
	if ai_enhancement is None:
		ai_enhancement = self._llm_client.is_reachable()
	self.ai_enhancement = ai_enhancement
```

`is_reachable()` may not exist. If it doesn't, add a simple one to `LiteLLMClient`:

```python
def is_reachable(self) -> bool:
	"""Return True if the LiteLLM gateway responded to a ping within 2 seconds."""
	try:
		import httpx
		with httpx.Client(timeout=2.0) as client:
			response = client.get(f"{self._url}/health")
		return response.status_code == 200
	except Exception:
		return False
```

**Step 4: Implement `_extract_with_ai`.**

```python
async def _extract_with_ai(
	self,
	text: str,
	sections: list[dict[str, Any]],
) -> list[Requirement]:
	"""Run a LiteLLM-backed extraction pass over the document.

	Regex extraction happens first and is passed as context. The AI's job is to
	catch requirements stated in prose, resolve ambiguous classifications, and
	surface cross-references that a keyword pattern cannot detect.
	"""
	assert isinstance(text, str) and text, "text must be a non-empty string"

	# Chunk to respect model context limits.
	chunks = self._chunk_text(text, max_chars=50_000)
	requirements: list[Requirement] = []

	for chunk in chunks:
		prompt = self._build_extraction_prompt(chunk, sections)
		try:
			response = await self._fallback.chat_completion(
				messages=[{"role": "user", "content": prompt}],
				model="gpt-4o-mini",
				response_format={"type": "json_object"},
			)
		except Exception as exc:
			self._log_ai_failure(exc, chunk_size=len(chunk))
			continue

		parsed = self._parse_ai_response(response)
		requirements.extend(parsed)

	assert all(isinstance(r, Requirement) for r in requirements)
	return requirements
```

**Step 5: Add helpers** (`_chunk_text`, `_build_extraction_prompt`, `_parse_ai_response`, `_log_ai_failure`). Implement minimally — tests will tell you if they're enough:

```python
def _chunk_text(self, text: str, max_chars: int) -> list[str]:
	if len(text) <= max_chars:
		return [text]
	# Chunk on paragraph boundaries so requirements aren't split mid-sentence.
	paragraphs = text.split("\n\n")
	chunks: list[str] = []
	current = ""
	for para in paragraphs:
		if len(current) + len(para) + 2 > max_chars:
			chunks.append(current)
			current = para
		else:
			current = f"{current}\n\n{para}" if current else para
	if current:
		chunks.append(current)
	return chunks


def _build_extraction_prompt(self, chunk: str, sections: list[dict[str, Any]]) -> str:
	return (
		"You are analyzing a Request for Proposal document. Extract every "
		"requirement — explicit or implicit — from the text below. Return JSON "
		"with a single key `requirements` containing an array of objects with "
		"`text`, `category`, `priority`, `source_section`, and `confidence` (0-1).\n\n"
		f"Known sections: {[s.get('title') for s in sections]}\n\n"
		f"Text:\n{chunk}"
	)


def _parse_ai_response(self, response: Any) -> list[Requirement]:
	import json
	content = response.choices[0].message.content if hasattr(response, "choices") else response
	data = json.loads(content) if isinstance(content, str) else content
	items = data.get("requirements", [])
	out: list[Requirement] = []
	for item in items:
		try:
			out.append(Requirement(
				text=item["text"],
				category=item.get("category", "unknown"),
				priority=item.get("priority", "medium"),
				source_section=item.get("source_section"),
				confidence=float(item.get("confidence", 0.5)),
				source="ai",
			))
		except (KeyError, ValueError, TypeError):
			continue
	return out


def _log_ai_failure(self, exc: Exception, chunk_size: int) -> None:
	import logging
	logging.getLogger(__name__).warning(
		"AI extraction pass failed (chunk_size=%d): %s", chunk_size, exc
	)
```

**Step 6: Merge regex + AI results in the existing `extract` method.** Find the method, and after the regex pass, add:

```python
if self.ai_enhancement:
	ai_reqs = await self._extract_with_ai(text, sections)
	requirements = self._merge_requirements(requirements, ai_reqs)
```

Add a `_merge_requirements` helper:

```python
def _merge_requirements(
	self,
	regex_reqs: list[Requirement],
	ai_reqs: list[Requirement],
) -> list[Requirement]:
	"""Merge by near-duplicate text match; keep higher-confidence entry."""
	merged: list[Requirement] = list(regex_reqs)
	for ai_req in ai_reqs:
		match = self._find_duplicate(ai_req, merged)
		if match is None:
			merged.append(ai_req)
		elif ai_req.confidence > match.confidence:
			merged.remove(match)
			merged.append(ai_req)
	return merged


def _find_duplicate(self, target: Requirement, pool: list[Requirement]) -> Requirement | None:
	from difflib import SequenceMatcher
	for candidate in pool:
		ratio = SequenceMatcher(None, target.text.lower(), candidate.text.lower()).ratio()
		if ratio > 0.85:
			return candidate
	return None
```

**Step 7: Write the test.**

```python
# tests/ci/test_requirement_extractor_ai.py
"""AI enhancement coverage for RequirementExtractor."""

import pytest

from docfusion.rfp.requirement_extractor import RequirementExtractor, Requirement


SAMPLE_RFP = """
The vendor shall provide 24/7 support coverage.

Additionally, a compliant solution must support single sign-on. SSO is
mandatory and failure to meet this requirement will result in disqualification.
"""


async def test_ai_finds_requirement_regex_misses(mock_litellm_gateway):
	extractor = RequirementExtractor(ai_enhancement=True)
	results = await extractor.extract(SAMPLE_RFP)
	# Regex would catch "shall provide 24/7 support"; AI should also surface SSO.
	texts = [r.text.lower() for r in results]
	assert any("24/7" in t for t in texts)
	assert any("sso" in t or "single sign-on" in t for t in texts)


async def test_falls_back_to_regex_when_ai_down(monkeypatch):
	extractor = RequirementExtractor(ai_enhancement=False)
	results = await extractor.extract(SAMPLE_RFP)
	assert len(results) >= 1  # regex alone still catches at least one


async def test_merge_prefers_higher_confidence():
	extractor = RequirementExtractor(ai_enhancement=False)
	regex_req = Requirement(text="provide support", confidence=0.5, source="regex")
	ai_req = Requirement(text="provide support", confidence=0.9, source="ai")
	merged = extractor._merge_requirements([regex_req], [ai_req])
	assert len(merged) == 1
	assert merged[0].confidence == 0.9
```

You will need a `mock_litellm_gateway` fixture in `tests/ci/conftest.py`. Use pytest-httpserver to respond to `POST /v1/chat/completions` with a canned JSON payload that includes the SSO requirement.

**Step 8: Verify.**
```bash
uv run pytest tests/ci/test_requirement_extractor_ai.py -vxs
```

**Step 9: Commit.**
```bash
git add src/docfusion/rfp/requirement_extractor.py tests/ci/test_requirement_extractor_ai.py tests/ci/conftest.py
git commit -m "feat(rfp): AI enhancement via LiteLLM in RequirementExtractor [G-RFP-01][G-FB-01]"
```

## Notes for less-capable agents

- If `LiteLLMClient` does not have `chat_completion` async, check the method name — it may be `complete` or `generate`. Adjust accordingly.
- Do NOT change the `Requirement` Pydantic model in this task. If you need a field that doesn't exist, create a separate task to add it.
- The merge threshold `0.85` is intentional. Lower values produce too many false merges.
