---
id: task-007
title: "Phase 2: Centralize Docling and LiteLLM config in SecretsManager"
status: To Do
phase: 2
gap_ids: [G-RFP-01]
priority: High
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

Approach: Added two new static methods to `SecretsManager` and wired `RequirementExtractor` to use them.

Files touched:
- `src/docfusion/config/secrets.py` — added `get_docling_url()` (default `http://20.84.71.33:3600`) and `get_docling_timeout()` (default `300`)
- `src/docfusion/rfp/requirement_extractor.py` — replaced hardcoded docling URL/timeout with `SecretsManager.get_docling_url()` / `SecretsManager.get_docling_timeout()`
- `tests/ci/test_secrets_manager_docling.py` — smoke test verifying URL/timeout types and extractor wiring

Unexpected findings:
- `get_litellm_url()` and `get_litellm_timeout()` already existed in `SecretsManager`, so only Docling methods were missing.

Deviations from plan: None.

Follow-up tasks: None.
