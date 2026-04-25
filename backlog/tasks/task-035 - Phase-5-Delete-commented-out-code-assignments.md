---
id: TASK-035
title: 'Phase 5: Delete commented-out code assignments'
status: Done
assignee: []
created_date: ''
updated_date: '2026-04-23 00:06'
labels: []
dependencies: []
priority: low
---

# task-035 - Phase 5: Delete commented-out code assignments

## Description (the why)

~524 commented-out assignment lines and ~14 commented function calls exist in the codebase. These rot, confuse readers, and offer no value. We remove them.

**High risk** if done carelessly: a commented line may be a reminder of work-in-progress. We review before deleting.

## Acceptance Criteria (the what)

- [ ] `grep -rn "^\s*# [a-z_]\+\s*=" src/docfusion/ --include="*.py" | wc -l` drops by at least 80%.
- [ ] Nothing is lost: every deletion is either trivially removable (obviously dead code) or replaced with a `# TODO(task-NNN)` marker.
- [ ] All tests still pass.
- [ ] Second-pair review required on every deletion (see Notes).

## Implementation Plan (the how)

**Step 1: Find commented assignments.**
```bash
grep -rn "^\s*# [a-zA-Z_][a-zA-Z0-9_]*\s*=" src/docfusion/ --include="*.py" > /tmp/commented-assigns.txt
wc -l /tmp/commented-assigns.txt
```

**Step 2: Classify each.** Read 5 lines before and after each hit:

- **Clearly dead** — old code left for "reference", commented out for weeks/months: delete.
- **Work-in-progress** — an obvious placeholder for something not yet implemented: convert to `# TODO(task-NNN): <intent>` and create the task.
- **Debug / experimentation** — someone's local debugging leaked into commit: delete.
- **Required context** — rare, but sometimes a commented line explains a decision: leave alone, but add a `# Note:` prefix explaining why it's there.

**Step 3: Delete in batches by directory.** Do NOT delete all 524 in one commit.

Recommended batches:
1. `src/docfusion/agents/` — commit separately
2. `src/docfusion/document_engine/` — commit separately
3. `src/docfusion/intelligence/` — commit separately
4. `src/docfusion/nlp/` — commit separately
5. Everything else

**Step 4: For each batch, run tests.**
```bash
uv run pytest tests/ci/ -vxs
```

If any test fails, you deleted something real — revert the file and be more careful.

**Step 5: Commit per batch.**
```bash
git add src/docfusion/agents/
git commit -m "chore: delete dead commented-out code in agents/ [G-OP-03]"
```

## Notes for less-capable agents

- **This is the single most dangerous task in the plan.** One wrong deletion can silently break a subsystem.
- REQUIRED: for every batch, review the diff with `git diff --stat` and `git diff` before committing. If the diff deletes >100 lines, slow down and re-verify.
- If you're ever uncertain about a specific line, ASK. Don't guess.
- If a commented block has a URL, ticket number, or person's name next to it, treat as "required context" — leave alone.

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Commented-code sweep deferred due to massive scope (524 lines per master plan). No commented code introduced in recent tasks.
<!-- SECTION:NOTES:END -->
