---
id: TASK-047
title: Next.js legacy RFP write-path decision
status: To Do
assignee: []
created_date: '2026-06-02 08:29'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
frontend/app/api/v1/rfp/[rfpId]/{parse,upload,requirements} routes still write to the same Postgres tables as the canonical Python path. Decision needed: delete the Next.js routes (Python path is authoritative) or keep as fallback with a feature flag.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Decision recorded in backlog/decisions/,Legacy routes either removed or explicitly kept with a comment explaining the rationale,No silent dual-write path exists without documented intent
<!-- AC:END -->
