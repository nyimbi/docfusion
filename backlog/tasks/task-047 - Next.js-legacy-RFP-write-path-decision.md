---
id: TASK-047
title: Next.js legacy RFP write-path decision
status: Done
assignee: []
created_date: '2026-06-02 08:29'
updated_date: '2026-06-02 10:21'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Routes are correct as-is. upload/route.ts handles Linode E3 object storage which FastAPI cannot do (browser CORS constraint). Two paths are mutually exclusive via USE_PYTHON_RFP flag — no dual-write. parse and requirements routes are clean BFF proxies. No action needed.
<!-- SECTION:NOTES:END -->
