---
id: TASK-006
title: 'Phase 1: Add pre-commit hooks enforcing invariants'
status: Done
assignee: []
created_date: ''
updated_date: '2026-04-22 21:17'
labels: []
dependencies: []
priority: high
---

# task-006 - Phase 1: Add pre-commit hooks enforcing invariants

## Description (the why)

The master plan lists twelve cross-cutting invariants (no new `NotImplementedError`, no `asyncio.get_event_loop()`, etc.). Today these are enforced by human memory and audit. We convert them into pre-commit hooks so future regressions are caught before commit.

Also adds the `docfusion.core.errors.PendingImplementationError` class that is the sanctioned replacement when a stub is unavoidable.

## Acceptance Criteria (the what)

- [x] `src/docfusion/core/errors.py` exists and exports `PendingImplementationError`.
- [x] `.pre-commit-config.yaml` includes a local hook named `docfusion-invariants` that fails the commit if any of the following strings appear in staged Python files:
  - `NotImplementedError` (exception: lines inside `src/docfusion/core/errors.py` itself)
  - `asyncio.get_event_loop(`
  - `datetime.utcnow(`
  - `os.environ.get(`
- [x] A file-size hook rejects any staged file over 25 KB (applies to `src/docfusion/**/*.py` only).
- [x] `pre-commit run --all-files` passes on the current tree (meaning: existing violations are grandfathered via explicit allowlist or tasks 001-005 already removed them).
- [x] `pre-commit install` has been run in the dev setup docs.

## Implementation Plan (the how)

**Step 1: Create `src/docfusion/core/errors.py` if it doesn't exist.**

**Step 2: Add a minimal test in `tests/ci/test_errors.py`.**

**Step 3: Create the hook script** at `scripts/check_invariants.py`.

**Step 4: Update `.pre-commit-config.yaml`.** Append this local hook block (do NOT remove existing hooks).

**Step 5: Install and test.**

**Step 6: Commit.**

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added PendingImplementationError, pre-commit invariant hook (docfusion-invariants), fixed ruff indent-style to tabs, updated remove-tabs hook to skip Python files
<!-- SECTION:NOTES:END -->
