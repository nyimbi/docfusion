---
id: TASK-007
title: 'Phase 2: Centralize Docling and LiteLLM config in SecretsManager'
status: Done
assignee: []
created_date: ''
updated_date: '2026-04-22 21:24'
labels: []
dependencies: []
priority: high
---

# task-007 - Phase 2: Centralize Docling and LiteLLM config in SecretsManager

## Description (the why)

The RFP pipeline currently hardcodes Docling and LiteLLM URLs. We centralize these in SecretsManager so environment-specific values live in one place.

## Acceptance Criteria (the what)

- [x] `SecretsManager.get_docling_url()` exists and returns a string
- [x] `SecretsManager.get_docling_timeout()` exists and returns an int
- [x] `RequirementExtractor` reads docling URL and timeout from `SecretsManager` instead of hardcoded values
- [x] No hardcoded `http://20.84.71.33:3600` remains in `src/docfusion/rfp/`
- [x] CI test verifies the wiring

## Implementation Plan (the how)

1. Add `get_docling_url()` and `get_docling_timeout()` static methods to `SecretsManager`
2. Update `RequirementExtractor._get_default_config()` to use these methods
3. Write `tests/ci/test_secrets_manager_docling.py` verifying the centralization
4. Run tests and commit

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added get_docling_url() and get_docling_timeout() to SecretsManager; wired RequirementExtractor to use them; removed hardcoded 20.84.71.33:3600
<!-- SECTION:NOTES:END -->
