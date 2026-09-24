---
id: TASK-044
title: BrandFormatter must handle brand specs with no logo
status: Done
assignee: []
created_date: '2026-05-11 20:52'
updated_date: '2026-07-11 05:47'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After the document-engine honesty pass (PR-pending), the orchestrator no longer masks BrandFormatter failures. Several existing tests now reveal that the formatter hard-asserts a 'primary' logo variant exists (brand_formatter.py:570) even when the brand_specification omits a logo. Three tests are xfail'd waiting on this fix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 BrandFormatter does not assert on logo_variant existence when no logos are configured,Brand spec with only colors and fonts produces formatting_successful=True,Remove xfail markers on test_generate_document_with_brand_compliance, test_brand_focused_workflow, test_brand_and_style_integration,No regressions in brand_formatter own test suite
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
added logo None guard and test
<!-- SECTION:NOTES:END -->
