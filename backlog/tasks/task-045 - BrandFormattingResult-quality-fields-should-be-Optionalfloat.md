---
id: TASK-045
title: 'BrandFormattingResult quality fields should be Optional[float]'
status: Done
assignee: []
created_date: '2026-05-11 20:56'
updated_date: '2026-05-14 10:28'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reviewer finding from the document-engine honesty pass: BrandFormattingResult.brand_consistency_score and .formatting_quality_score are typed float (defaulting 0.0), so the orchestrator's fallback path uses 0.0 + formatting_successful=False to signal 'no measurement', while ad-hoc result types use None directly. The aggregator skips the 0.0 via the success-flag gate, but the typed contract should match the honest-signal contract.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 BrandFormattingResult.brand_consistency_score is Optional[float] = None,BrandFormattingResult.formatting_quality_score is Optional[float] = None,Document_engine fallback returns None instead of 0.0,Existing tests still pass,Quality validation continues to skip None scores
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
BrandFormattingResult.formatting_quality_score, .brand_consistency_score, and .accessibility_compliance_score are now Optional[float] = None. The orchestrator fallback in document_engine._execute_brand_formatting no longer needs to pass brand_consistency_score=0.0 — the default None flows through and the quality aggregator skips it cleanly. Bundled with TASK-044.
<!-- SECTION:NOTES:END -->
