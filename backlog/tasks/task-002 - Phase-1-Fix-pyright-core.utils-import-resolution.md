---
id: TASK-002
title: 'Phase 1: Fix pyright core.utils import resolution'
status: Done
assignee: []
created_date: ''
updated_date: '2026-04-22 19:17'
labels: []
dependencies: []
priority: medium
---

# task-002 - Phase 1: Fix pyright core.utils import resolution

## Description (the why)

`pyright` cannot resolve `from docfusion.core.utils import uuid7str` because no `pyrightconfig.json` exists to tell it where the source root is. This leaves type errors uncaught across the codebase.

## Acceptance Criteria (the what)

- [x] `pyrightconfig.json` exists at repo root with `include`, `extraPaths`, and `pythonVersion` set correctly.
- [x] `uv run pyright src/docfusion/core/utils.py` reports zero errors.
- [x] `uv run pyright src/docfusion/rfp/` reports no new import-resolution errors (existing unrelated errors are acceptable — document them).
- [x] The config commits without breaking `mypy` (run `uv run mypy src/docfusion/core/utils.py` and confirm).

## Implementation Plan (the how)

**Step 1: Read the current utils file to understand what's exported.**
```bash
head -40 src/docfusion/core/utils.py
```

**Step 2: Create `pyrightconfig.json` at repo root.**

Write this exact content:

```json
{
  "include": ["src"],
  "extraPaths": ["src"],
  "pythonVersion": "3.12",
  "typeCheckingMode": "basic",
  "useLibraryCodeForTypes": true,
  "reportMissingImports": "error",
  "reportMissingTypeStubs": "none",
  "exclude": [
    "**/__pycache__",
    "**/.venv",
    "**/node_modules",
    "**/tests/fixtures",
    "artifacts",
    "data"
  ]
}
```

**Step 3: Verify.**
```bash
uv run pyright src/docfusion/core/utils.py
# Expected: 0 errors.

uv run pyright src/docfusion/rfp/requirement_extractor.py 2>&1 | grep -i "unknown import symbol\|could not be resolved" | grep "core.utils"
# Expected: no results (the core.utils imports should resolve).
```

**Step 4: Cross-check with mypy.**
```bash
uv run mypy src/docfusion/core/utils.py
# Expected: Success or only pre-existing errors.
```

**Step 5: Commit.**
```bash
git add pyrightconfig.json
git commit -m "fix: add pyrightconfig.json for core.utils resolution [HANDOVER-2]"
```

## Notes for less-capable agents

- `typeCheckingMode: "basic"` is intentional. `strict` breaks on hundreds of existing sites and is not a Phase 1 goal.
- Do NOT add `pyrightconfig.json` to `.gitignore`. It must be committed.
- If `pyright` is not installed, install it: `uv add --dev pyright`.

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created pyrightconfig.json with src include/extraPaths and basic type-checking mode
<!-- SECTION:NOTES:END -->
