---
id: TASK-009
title: 'Phase 2: Add AI-powered analysis to RFPAnalyzer'
status: Done
assignee: []
created_date: ''
updated_date: '2026-04-22 22:11'
labels: []
dependencies:
  - task-007
  - task-008
priority: high
---

# task-009 - Phase 2: Add AI-powered analysis to RFPAnalyzer

## Description (the why)

`RFPAnalyzer` today is pure keyword/rule-based. It classifies compliance and risk by matching words, which produces shallow results. Adding an AI-powered pass lets the analyzer write narratives, catch context-dependent risks, and produce strategic recommendations the rule engine cannot.

## Acceptance Criteria (the what)

- [ ] `RFPAnalyzer` has a new async method `_analyze_with_ai(requirements, text) -> AnalysisResult`.
- [ ] Rule-based analysis still runs first; AI pass enriches with narrative fields.
- [ ] LiteLLM via `LLMFallbackChain` — never direct provider calls.
- [ ] `AnalysisResult` Pydantic model gains optional narrative fields: `compliance_narrative`, `risk_narrative`, `strategic_recommendations` (all `str | None`).
- [ ] Test in `tests/ci/test_rfp_analyzer_ai.py` confirms AI narrative fields populate when LiteLLM is available and remain None when disabled.

## Implementation Plan (the how)

**Step 1: Read current analyzer.**
```bash
grep -n "class RFPAnalyzer\|def analyze\|class AnalysisResult" src/docfusion/rfp/rfp_analyzer.py
```

**Step 2: Extend `AnalysisResult`.** Locate the Pydantic model (likely in `views.py` or at top of `rfp_analyzer.py`):

```python
class AnalysisResult(BaseModel):
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	# ... existing fields ...
	compliance_narrative: str | None = None
	risk_narrative: str | None = None
	strategic_recommendations: str | None = None
```

**Step 3: Add `_analyze_with_ai` method** to `RFPAnalyzer`:

```python
async def _analyze_with_ai(
	self,
	requirements: list[Requirement],
	document_text: str,
) -> dict[str, str]:
	"""Run an AI pass over the analyzed requirements.

	Returns a dict with `compliance_narrative`, `risk_narrative`,
	`strategic_recommendations`. Missing keys if the call failed — the caller
	keeps existing rule-based values.
	"""
	assert requirements, "requirements must not be empty"

	prompt = self._build_analysis_prompt(requirements, document_text)
	try:
		response = await self._fallback.chat_completion(
			messages=[{"role": "user", "content": prompt}],
			model="gpt-4o-mini",
			response_format={"type": "json_object"},
		)
	except Exception as exc:
		self._log_ai_failure(exc)
		return {}

	import json
	content = response.choices[0].message.content
	try:
		return json.loads(content) if isinstance(content, str) else dict(content)
	except (json.JSONDecodeError, TypeError):
		return {}

def _build_analysis_prompt(
	self,
	requirements: list[Requirement],
	document_text: str,
) -> str:
	preview = document_text[:3000]
	requirement_summary = "\n".join(
		f"- [{r.priority}] {r.text[:200]}" for r in requirements[:30]
	)
	return (
		"Analyze this RFP. Return JSON with three string keys: "
		"`compliance_narrative` (2-3 sentence summary of compliance landscape), "
		"`risk_narrative` (2-3 sentences on risks), "
		"`strategic_recommendations` (2-3 bulleted recommendations as a single string).\n\n"
		f"Document excerpt:\n{preview}\n\n"
		f"Extracted requirements:\n{requirement_summary}"
	)
```

**Step 4: Wire it into the main `analyze` method.** Find the existing `async def analyze(...)` and append before return:

```python
if self.ai_enhancement:
	narrative = await self._analyze_with_ai(result.requirements, document_text)
	result.compliance_narrative = narrative.get("compliance_narrative")
	result.risk_narrative = narrative.get("risk_narrative")
	result.strategic_recommendations = narrative.get("strategic_recommendations")
```

**Step 5: Constructor changes.** Mirror task-008's pattern for `ai_enhancement` flag and LLM client wiring. Reuse the same `_fallback` attribute convention.

**Step 6: Test.**

```python
# tests/ci/test_rfp_analyzer_ai.py
"""AI narrative generation in RFPAnalyzer."""

import pytest

from docfusion.rfp.rfp_analyzer import RFPAnalyzer
from docfusion.rfp.requirement_extractor import Requirement

@pytest.fixture
def sample_requirements():
	return [
		Requirement(text="Vendor shall provide 24/7 support", category="support", priority="high", confidence=0.9, source="regex"),
		Requirement(text="Must support SSO via SAML", category="security", priority="critical", confidence=0.95, source="ai"),
	]

async def test_ai_populates_narratives(sample_requirements, mock_litellm_gateway):
	analyzer = RFPAnalyzer(ai_enhancement=True)
	result = await analyzer.analyze("RFP text about support and security.", sample_requirements)
	assert result.compliance_narrative is not None
	assert result.risk_narrative is not None

async def test_narratives_none_when_ai_disabled(sample_requirements):
	analyzer = RFPAnalyzer(ai_enhancement=False)
	result = await analyzer.analyze("RFP text.", sample_requirements)
	assert result.compliance_narrative is None
	assert result.risk_narrative is None
	assert result.strategic_recommendations is None
```

**Step 7: Verify + commit.**
```bash
uv run pytest tests/ci/test_rfp_analyzer_ai.py -vxs
git add src/docfusion/rfp/rfp_analyzer.py tests/ci/test_rfp_analyzer_ai.py
# Also the views.py if AnalysisResult lives there.
git commit -m "feat(rfp): AI-powered analysis in RFPAnalyzer [G-RFP-02]"
```

## Notes for less-capable agents

- Do not add AI calls inside existing rule-based helpers. Rule-based pass runs first and fully; AI runs after, purely additive.
- If `AnalysisResult` is a dataclass instead of Pydantic, still add the fields — but migrate to Pydantic in a separate task.
- When the prompt grows past 4000 chars, truncate `document_text` aggressively. Keep requirements list intact.

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AI narratives added to RFPAnalyzer with 8 passing tests; fixed config merge bug
<!-- SECTION:NOTES:END -->
