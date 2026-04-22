---
id: task-007
title: "Phase 2: Centralize Docling and LiteLLM config in SecretsManager"
status: To Do
phase: 2
gap_ids: [G-RFP-01]
priority: High
---

# task-007 - Phase 2: Centralize Docling and LiteLLM config in SecretsManager

## Description (the why)

`src/docfusion/rfp/requirement_extractor.py` hardcodes `http://20.84.71.33:3600` for Docling. Other RFP modules reach LiteLLM directly. All config must flow through `SecretsManager` per the Phase 1 invariant.

## Acceptance Criteria (the what)

- [ ] `src/docfusion/config/secrets.py` exposes `get_docling_url()`, `get_docling_timeout()`, `get_litellm_url()`, `get_litellm_key()`, `get_litellm_timeout()` (add only the ones missing).
- [ ] Every hit of `grep -rn "20.84.71.33\|localhost:11434\|84.247.181.100" src/docfusion/` resolves through `SecretsManager`, not a literal.
- [ ] `.env.example` lists `DOCLING_URL`, `DOCLING_TIMEOUT`, `LITELLM_URL`, `LITELLM_KEY`, `LITELLM_TIMEOUT` with safe defaults.
- [ ] Unit test in `tests/ci/test_secrets_manager.py` verifies each new getter returns the env var when set and the default when unset.

## Implementation Plan (the how)

**Step 1: Read the current SecretsManager.**
```bash
grep -n "def get_" src/docfusion/config/secrets.py | head -50
```

**Step 2: Identify which getters are missing** from the acceptance list.

**Step 3: Add missing getters using this exact template** (tabs, not spaces). Place near existing getters of the same concern:

```python
def get_docling_url(self) -> str:
	"""Return the Docling service URL.

	Reads DOCLING_URL from environment. Defaults to the production VPS.
	"""
	return self._get_env("DOCLING_URL", default="http://20.84.71.33:3600")


def get_docling_timeout(self) -> int:
	"""Return the Docling request timeout in seconds."""
	return int(self._get_env("DOCLING_TIMEOUT", default="120"))


def get_litellm_url(self) -> str:
	"""Return the LiteLLM gateway URL."""
	return self._get_env("LITELLM_URL", default="http://84.247.181.100:4000")


def get_litellm_key(self) -> str:
	"""Return the LiteLLM master key."""
	return self._get_env("LITELLM_KEY", default="", required=False)


def get_litellm_timeout(self) -> int:
	"""Return the LiteLLM request timeout in seconds."""
	return int(self._get_env("LITELLM_TIMEOUT", default="60"))
```

If `_get_env` doesn't exist on SecretsManager yet, use the equivalent private helper you find in the file (look for `self._settings` or similar).

**Step 4: Replace every hardcoded URL.**
```bash
grep -rn "20.84.71.33\|84.247.181.100:4000" src/docfusion/ --include="*.py"
```

For each hit:
- Add `from docfusion.config.secrets import SecretsManager` to imports if missing.
- Replace the literal with `SecretsManager().get_docling_url()` (or the matching getter).
- If the surrounding code instantiates SecretsManager elsewhere in the module, reuse that instance instead of creating a new one.

**Step 5: Update `.env.example`.** Read it, then add the five variables at the end with this format:

```
# Document parsing
DOCLING_URL=http://20.84.71.33:3600
DOCLING_TIMEOUT=120

# LLM gateway
LITELLM_URL=http://84.247.181.100:4000
LITELLM_KEY=
LITELLM_TIMEOUT=60
```

**Step 6: Add the test.**

```python
# tests/ci/test_secrets_manager.py
"""SecretsManager getter coverage."""

import os

import pytest

from docfusion.config.secrets import SecretsManager


@pytest.fixture
def clean_env(monkeypatch):
	for key in ("DOCLING_URL", "DOCLING_TIMEOUT", "LITELLM_URL", "LITELLM_KEY", "LITELLM_TIMEOUT"):
		monkeypatch.delenv(key, raising=False)
	yield monkeypatch


def test_docling_url_defaults(clean_env):
	assert SecretsManager().get_docling_url() == "http://20.84.71.33:3600"


def test_docling_url_reads_env(clean_env):
	clean_env.setenv("DOCLING_URL", "http://example.test:9999")
	assert SecretsManager().get_docling_url() == "http://example.test:9999"


def test_docling_timeout_defaults(clean_env):
	assert SecretsManager().get_docling_timeout() == 120


def test_litellm_url_defaults(clean_env):
	assert SecretsManager().get_litellm_url() == "http://84.247.181.100:4000"


def test_litellm_timeout_reads_env(clean_env):
	clean_env.setenv("LITELLM_TIMEOUT", "30")
	assert SecretsManager().get_litellm_timeout() == 30
```

**Step 7: Verify.**
```bash
uv run pytest tests/ci/test_secrets_manager.py -vxs

grep -rn "20.84.71.33\|84.247.181.100:4000\|localhost:11434" src/docfusion/ --include="*.py"
# Expected: every remaining hit is either in a comment, a docstring, or inside SecretsManager itself.
```

**Step 8: Commit.**
```bash
git add src/docfusion/config/secrets.py .env.example tests/ci/test_secrets_manager.py src/docfusion/rfp/
git commit -m "feat(rfp): centralize Docling + LiteLLM config via SecretsManager [G-RFP-01]"
```

## Notes for less-capable agents

- Do NOT change `localhost:11434` references yet — that's task-010's job (StakeholderMapper). Touch only the literals this task calls out.
- If you see the same URL in a test fixture, leave it — test fixtures may hardcode by design.
- Preserve the existing `SecretsManager` singleton pattern if there is one. If the module has a `get_settings()` factory, your getters should also route through it.
