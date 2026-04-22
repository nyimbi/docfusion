---
id: task-026
title: "Phase 4: Expose discovery capability flags"
status: To Do
phase: 4
gap_ids: [G-DISC-01]
priority: Medium
---

# task-026 - Phase 4: Expose discovery capability flags

## Description (the why)

`src/docfusion/discovery/__init__.py` wraps optional imports (playwright, crawl4ai, sklearn) in try/except. When they fail, they silently fall back — there's no way for the healthcheck or the frontend to know which discovery features are available. We surface a `CAPABILITIES` dict that downstream consumers inspect.

## Acceptance Criteria (the what)

- [ ] `src/docfusion/discovery/__init__.py` exposes a `CAPABILITIES: dict[str, bool]` at module level after the optional imports resolve.
- [ ] Keys reflect the real optional dependencies: `playwright`, `crawl4ai`, `sklearn`, `vision_scraper`, `universal_scraper`.
- [ ] `/api/v1/discovery/health` reads `CAPABILITIES` and reports per-capability status.
- [ ] Test `tests/ci/test_discovery_capabilities.py` confirms `CAPABILITIES` is a dict of bools after import.

## Implementation Plan (the how)

**Step 1: Read the current `__init__.py`.**
```bash
cat src/docfusion/discovery/__init__.py
```

**Step 2: Refactor the try/except to populate `CAPABILITIES`.**

```python
"""docfusion.discovery package with optional capabilities."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

CAPABILITIES: dict[str, bool] = {}


def _try_import(name: str, importer) -> bool:
	try:
		importer()
		CAPABILITIES[name] = True
		return True
	except ImportError as exc:
		CAPABILITIES[name] = False
		logger.info("Discovery capability %s not available: %s", name, exc)
		return False


def _import_playwright() -> None:
	import playwright  # noqa


def _import_crawl4ai() -> None:
	import crawl4ai  # noqa


def _import_sklearn() -> None:
	import sklearn  # noqa


def _import_vision_scraper() -> None:
	from docfusion.discovery.vision_scraper import VisionScraper  # noqa


def _import_universal_scraper() -> None:
	from docfusion.discovery.universal_scraper import UniversalScraper  # noqa


_try_import("playwright", _import_playwright)
_try_import("crawl4ai", _import_crawl4ai)
_try_import("sklearn", _import_sklearn)
_try_import("vision_scraper", _import_vision_scraper)
_try_import("universal_scraper", _import_universal_scraper)


__all__ = ["CAPABILITIES"]
```

Preserve any existing `__all__` exports that callers rely on — add to them, don't replace.

**Step 3: Update the discovery health endpoint** (already in task-013 but confirm):

```python
@router.get("/health")
async def discovery_health() -> dict:
	from docfusion.discovery import CAPABILITIES
	all_ok = all(CAPABILITIES.values())
	return {
		"status": "ok" if all_ok else "degraded",
		"capabilities": CAPABILITIES,
	}
```

**Step 4: Test.**

```python
# tests/ci/test_discovery_capabilities.py
"""Discovery capabilities coverage."""

from docfusion.discovery import CAPABILITIES


def test_capabilities_is_dict_of_bools():
	assert isinstance(CAPABILITIES, dict)
	assert all(isinstance(v, bool) for v in CAPABILITIES.values())


def test_expected_keys_present():
	expected = {"playwright", "crawl4ai", "sklearn", "vision_scraper", "universal_scraper"}
	assert expected.issubset(CAPABILITIES.keys())
```

**Step 5: Verify + commit.**
```bash
uv run pytest tests/ci/test_discovery_capabilities.py -vxs
git add src/docfusion/discovery/__init__.py tests/ci/test_discovery_capabilities.py
git commit -m "feat(discovery): expose CAPABILITIES flags for healthcheck [G-DISC-01]"
```

## Notes for less-capable agents

- Do NOT break existing re-exports. If the old `__init__.py` exports `OpportunityData` or `ScrapingOrchestrator`, keep those exports.
- If one of the module-level imports has side effects (for example, registering a scraper), leave it inside the try/except but add a `CAPABILITIES` entry for it.
