---
id: task-040
title: "Phase 6: (Closed) Drop legacy requirements table — absorbed into task-012"
status: Done
phase: 6
gap_ids: [G-DATA-01-tail]
priority: Low
---

# task-040 - Closed: absorbed into task-012

## Description

Originally this task dropped the legacy `requirements` table after a 14-day shadow-write soak. The platform has no active users, so there is no cutover risk. The drop has been folded into task-012 (single atomic migration that adds `aiAnalysis`, copies data, drops legacy).

## Acceptance Criteria

- [x] Closed as absorbed.

## Implementation Notes

No code changes required for this task. Verification belongs to task-012.
