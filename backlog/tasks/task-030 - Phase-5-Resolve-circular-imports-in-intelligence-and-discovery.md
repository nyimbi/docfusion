---
id: TASK-030
title: 'Phase 5: Resolve circular imports in intelligence and discovery'
status: Done
assignee: []
created_date: ''
updated_date: '2026-04-22 23:54'
labels: []
dependencies: []
priority: medium
---

# task-030 - Phase 5: Resolve circular imports in intelligence and discovery

## Description (the why)

`src/docfusion/intelligence/__init__.py` has commented-out imports because `intelligence/` and `discovery/` reference each other circularly via shared types. We break the cycle by moving shared types into `docfusion.core.types`.

## Acceptance Criteria (the what)

- [ ] `src/docfusion/core/types/opportunity.py` exists with the shared `OpportunityData` model.
- [ ] `intelligence/` and `discovery/` both import from `core.types`, never from each other.
- [ ] `python -c "from docfusion.intelligence import *; from docfusion.discovery import *"` succeeds with zero `ImportError`.
- [ ] Commented-out imports in `intelligence/__init__.py` are re-enabled.

## Implementation Plan (the how)

**Step 1: Find the shared types.**
```bash
grep -rn "class OpportunityData\|class Opportunity\b" src/docfusion/ --include="*.py" | head
```

**Step 2: Create the canonical home.**
```bash
mkdir -p src/docfusion/core/types
```

Create `src/docfusion/core/types/opportunity.py` and **move** the `OpportunityData` class there (don't copy — move, so there's only one):

```python
"""Canonical Opportunity data model shared across intelligence + discovery."""

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from docfusion.core.utils import uuid7str

class OpportunityData(BaseModel):
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	id: str = Field(default_factory=uuid7str)
	title: str
	source: str
	organization: str | None = None
	country_region: str | None = None
	deadline: datetime | None = None
	fingerprint: str | None = None
	# Add remaining fields from the original OpportunityData.
```

Add `src/docfusion/core/types/__init__.py`:

```python
from docfusion.core.types.opportunity import OpportunityData

__all__ = ["OpportunityData"]
```

**Step 3: Update every import site.**

```bash
grep -rn "from docfusion.intelligence.*import.*OpportunityData\|from docfusion.discovery.*import.*OpportunityData" src/docfusion/ --include="*.py"
```

Change every hit to:

```python
from docfusion.core.types import OpportunityData
```

**Step 4: Re-enable commented imports.** Open `src/docfusion/intelligence/__init__.py` and `src/docfusion/discovery/__init__.py`. Find `# from ...` lines commented because of circularity. Un-comment.

**Step 5: Smoke test.**
```bash
uv run python -c "from docfusion.intelligence import *; from docfusion.discovery import *; print('OK')"
# Expected: "OK" printed, no ImportError.

uv run pytest tests/ci/ -vxs -k "intelligence or discovery"
```

**Step 6: Commit.**
```bash
git add src/docfusion/core/types/ src/docfusion/intelligence/ src/docfusion/discovery/
git commit -m "refactor: break intelligence<->discovery cycle via core.types [findings-plan-5.3]"
```

## Notes for less-capable agents

- If `OpportunityData` has 30+ fields, copy them all. Missing one field breaks callers.
- Keep the Pydantic `model_config` — don't accidentally drop `extra='forbid'`.
- Do NOT try to resolve circles not listed here. One at a time.

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed circular import: defined IntelligenceLevel in core.types.intelligence, made OpportunityIntelligence lazy-import only, fixed discovery __all__ to be dynamic based on _SCRAPERS_AVAILABLE. 5 tests passing.
<!-- SECTION:NOTES:END -->
