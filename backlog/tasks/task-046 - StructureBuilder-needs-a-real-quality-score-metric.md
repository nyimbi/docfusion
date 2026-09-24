---
id: TASK-046
title: StructureBuilder needs a real quality score metric
status: Done
assignee: []
created_date: '2026-05-16 09:04'
updated_date: '2026-07-11 05:47'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
B.fix.4 partial: DocumentFormatter's formatting_quality_score now flows through the real style_coverage measurement. StructureBuilder remains unmeasured because designing a structure_quality_score is a product decision, not a code decision: does coverage (sections/blocks) matter more than hierarchy depth integrity? Does TOC generation count? How do we weight an under-structured vs over-structured document? The honesty pass deliberately reports None rather than fabricate a formula. This task captures the open product question.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Product decision recorded on what 'structure quality' means as a metric,Formula documented and implemented in StructureBuilder.create_document_structure,DocumentStructure carries the score field (Optional[float]),Orchestrator routes the score through without overwriting,Test coverage matches the test_document_engine_phase_honesty pattern
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
replaced stub with completeness ratio
<!-- SECTION:NOTES:END -->
