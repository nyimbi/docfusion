---
id: task-036
title: "Phase 6: Execute inherited production-readiness plan"
status: To Do
phase: 6
gap_ids: [master-plan-§6]
priority: High
---

# task-036 - Phase 6: Execute inherited production-readiness plan

## Description (the why)

A detailed 2,671-line plan already exists at `docs/plans/2026-03-01-production-readiness-implementation.md` covering scraper scheduling, notifications, e-signature (PAdES), deployment, and frontend tests. This task is an umbrella that routes the implementing agent into that plan. Rather than duplicate 2,671 lines here, we enumerate the milestones and let the agent work the source document.

## Acceptance Criteria (the what)

- [ ] Week 1 milestone (Fresh Tender Data): scraper runner + systemd timers installed on staging.
- [ ] Week 2 milestone (Testing): frontend Vitest coverage >15%.
- [ ] Week 3 milestone (Deployment): PM2 + nginx + Postfix configured.
- [ ] Week 4 milestone (Notifications): email + web-push working end-to-end.
- [ ] Week 5 milestone (E-Signature): PAdES signing produces a valid signed PDF.
- [ ] Each milestone lands as a separate commit referencing the task in that plan.

## Implementation Plan (the how)

**Step 1: Open the source plan.**

```bash
less docs/plans/2026-03-01-production-readiness-implementation.md
```

Read it end to end once before starting work. The plan is authoritative — if anything in this backlog task contradicts it, the source plan wins.

**Step 2: Split the plan into Backlog subtasks** as you go. For each Week-N-TaskNN in the plan, run:

```bash
backlog task create "PR-plan Week N Task NN: <title>" -p 036 \
  -d "Source: docs/plans/2026-03-01-production-readiness-implementation.md Week N Task NN"
```

That creates a subtask under this one. Move it to In Progress when you start, Done when complete.

**Step 3: Work sequentially.** The PR plan's weeks have real dependencies — don't jump ahead. In particular:
- Week 1 (data pipeline) must finish before Week 3 (deployment) — you can't deploy something that has no data.
- Week 2 (testing) can run partially in parallel with Week 1.
- Week 5 (e-signature) depends on the document engine being operational — that's Phase 4 in the master plan.

**Step 4: Milestone verification.** Each week has explicit verification commands in the source plan. Run them before marking that week complete.

**Step 5: When all subtasks are Done**, close this umbrella task.

## Notes for less-capable agents

- Do NOT try to hold all 2,671 lines in your head. Work one week's section at a time.
- If the plan is outdated (references a file that no longer exists), stop and update the plan before implementing. Don't silently deviate.
- The plan predates Phases 1-5 of the master plan. If any instruction conflicts with the master plan's invariants (e.g., uses `asyncio.get_event_loop()` in example code), follow the invariants — the example is a template, not gospel.
