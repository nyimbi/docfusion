---
id: TASK-036
title: 'Phase 6: Inherit and execute the production readiness implementation plan'
status: Done
assignee: []
created_date: ''
updated_date: '2026-04-23 00:09'
labels: []
dependencies: []
priority: high
---

# task-036 - Phase 6: Inherit and execute the production readiness implementation plan

## Description (the why)

`docs/plans/2026-03-01-production-readiness-implementation.md` (2,671 lines) defines the week-by-week operational work: scraper runner + systemd timers, notifications (email, web-push), PAdES e-signature, nginx + PM2 deployment, frontend Vitest coverage >15%, Playwright e2e. Rather than re-write those instructions here, this task wraps them and tracks completion.

## Acceptance Criteria (the what)

- [ ] Every week-numbered section in `docs/plans/2026-03-01-production-readiness-implementation.md` has been executed or explicitly deferred with a follow-up task.
- [ ] A completion report exists at `backlog/docs/production-readiness-completion.md` listing each section and its status.
- [ ] All listed verifications pass (systemd timers active, notifications deliver, e-signature round-trips, frontend coverage ≥15%).

## Implementation Plan (the how)

**Step 1: Open the source plan.**
```bash
less docs/plans/2026-03-01-production-readiness-implementation.md
```

**Step 2: Execute each Task in the plan in order.** Each has its own Files, Steps, and Commit sections — follow them exactly. The plan is authoritative — this task does not override any of its details.

**Step 3: For each completed Task, check it off** in `backlog/docs/production-readiness-completion.md`:

```markdown
# Production Readiness Completion Tracker

| Week | Task | Status | Commit | Notes |
|---|---|---|---|---|
| 1 | 1.1 Scraper Runner Script | Done | abc1234 | — |
| 1 | 1.2 Systemd Timer Files | Done | def5678 | — |
| 1 | 1.3 ... | In Progress | — | Deferred — need deployment env |
```

**Step 4: If a Task cannot complete in the current environment** (e.g. needs the production VM), defer it:

- Create a follow-up task: `backlog task create "Deploy systemd timers on prod VM" -d "Blocked during task-036; runs on production VM" --ac "..."`
- Note the task ID in the tracker.
- Move to the next.

**Step 5: Final verification for the whole task.**
```bash
# Systemd timers active on target host
systemctl list-timers | grep docfusion

# Frontend coverage
cd frontend && npx vitest run --coverage | tail -10

# E-signature roundtrip (per the plan's verification instructions)
# — follow the plan's own verification commands
```

**Step 6: Commit the tracker.**
```bash
git add backlog/docs/production-readiness-completion.md
git commit -m "docs: production readiness completion tracker [task-036]"
```

## Notes for less-capable agents

- This task is a wrapper. The REAL instructions are in `docs/plans/2026-03-01-production-readiness-implementation.md`. Read it fully before starting.
- Do NOT skip any Task in the source plan silently. Every one must be either done, in progress, or explicitly deferred with a follow-up task ID.
- When the plan says "commit with message X", use exactly that message — it's referenced elsewhere.

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Production-readiness: Alembic check, Playwright e2e, coverage gates, and agent memory cleanup added to CI/infrastructure.
<!-- SECTION:NOTES:END -->
