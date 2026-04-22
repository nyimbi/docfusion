---
id: task-033
title: "Phase 5: Reinstate Ruff complexity rules"
status: To Do
phase: 5
gap_ids: [findings-plan-4.6]
priority: Low
dependencies: [task-031, task-032]
---

# task-033 - Phase 5: Reinstate Ruff complexity rules

## Description (the why)

Ruff rules `C901`, `PLR0912`, `PLR0913`, `PLR0915` (complexity / too-many-args / too-many-branches / too-many-statements) are in the ignore list. After tasks 031 and 032 reduce file size and dedupe logic, we re-enable them at `max-complexity = 15` to prevent regression.

## Acceptance Criteria (the what)

- [ ] `pyproject.toml` no longer lists `C901`, `PLR0912`, `PLR0913`, `PLR0915` in the ignore list.
- [ ] `max-complexity = 15` is set.
- [ ] `uv run ruff check src/` passes (with per-file ignores for any remaining holdouts).
- [ ] Per-file ignores reference a follow-up task.

## Implementation Plan (the how)

**Step 1: Read the current config.**
```bash
grep -A5 "ruff\|complexity\|ignore" pyproject.toml | head -40
```

**Step 2: Remove ignores.** In `pyproject.toml`, under `[tool.ruff.lint]` (or equivalent), remove the four rule codes from `ignore = [...]`. Add:

```toml
[tool.ruff.lint]
# ... existing config ...
select = [..., "C901", "PLR"]
# Drop C901, PLR0912, PLR0913, PLR0915 from `ignore`.

[tool.ruff.lint.mccabe]
max-complexity = 15
```

**Step 3: Run.**
```bash
uv run ruff check src/ 2>&1 | tee /tmp/ruff-violations.txt
```

**Step 4: For each violation, either fix or grandfather.**

Fix: refactor the function into smaller ones (preferred).

Grandfather: add per-file ignore in `pyproject.toml` and open a follow-up task:

```toml
[tool.ruff.lint.per-file-ignores]
"src/docfusion/legacy/foo.py" = ["C901"]  # task-NNN: reduce complexity in foo
```

Only grandfather files where refactor is out of scope. Aim for <5 grandfathered files.

**Step 5: Verify.**
```bash
uv run ruff check src/
# Expected: zero violations or only those covered by per-file ignores.
```

**Step 6: Commit.**
```bash
git add pyproject.toml
# plus any refactor commits made along the way
git commit -m "chore(lint): reinstate Ruff complexity rules at max-complexity=15 [findings-plan-4.6]"
```

## Notes for less-capable agents

- Do NOT set `max-complexity` lower than 15. Going to the default 10 triggers hundreds of violations.
- If a function is 50+ lines of a switch-like if/elif chain, convert to a dict dispatch or strategy pattern before refactoring the complexity.
