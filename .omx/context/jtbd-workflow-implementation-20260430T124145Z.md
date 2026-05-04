# Ralph Context Snapshot: JTBD Workflow Implementation

## Task Statement

Use `docs/platform-jtbd-catalogue.md` as the source of truth and extend DocFusion so the product and workflow system support identified JTBDs. Work in Ralph mode, in priority order, one coherent vertical slice at a time, with PRD/test-spec/tracker artifacts, implementation, tests, verification, commit, and push per slice.

## Desired Outcome

The first session should implement the highest-value P0 vertical slice and structure continuation artifacts so later agents can continue without rediscovery. The selected initial slice is requirement acceptance and assignment workflow support for JTBD-013/JTBD-014, because it converts extracted RFP requirements into reviewed, assigned, task-projected work with audit evidence.

## Known Facts / Evidence

- `docs/platform-jtbd-catalogue.md` exists and identifies 75 JTBDs.
- P0 roadmap includes "RFP intake to requirement acceptance" and "Compliance matrix governance".
- `frontend/lib/db/schema-rfp.ts` has `rfpRequirements` with `metadata`, assignment fields, due date, compliance status, ambiguity data, source quote/page/section, and AI analysis.
- `frontend/lib/db/schema-tasks.ts` has `proposalTasks` and `taskActivity`, including `requirementId`, `sourceType`, `sourceId`, `status`, `priority`, due dates, escalation flags, and activity audit fields.
- `frontend/lib/actions/requirements.ts` currently supports CRUD, assignment, bulk update, stats, gap analysis, extraction, and saving extracted requirements, but no explicit acceptance/rejection workflow, task projection, or audit event for requirement acceptance.
- `frontend/app/(app)/opportunities/[id]/requirements/RequirementExtractor.tsx` offers extraction review before saving, but saved requirements are not workflow-accepted with reason/checklist/task projection.
- Tests exist under `frontend/__tests__/actions/requirements-unification.test.ts`; frontend uses Vitest.

## Constraints

- Follow AGENTS.md Ralph gate: PRD and test spec must exist before implementation.
- Use existing patterns and no new dependencies.
- Do not overwrite unrelated dirty work.
- Commit using the Lore protocol after verified slice.
- Push after commit if credentials/network permit; record blocker if push fails.
- Do not mark JTBDs fully supported unless implementation and tests prove it.

## Unknowns / Open Questions

- Exact DB migration tooling state for frontend Drizzle is large and dirty; first slice should avoid schema changes if existing `metadata`, `proposalTasks`, and `taskActivity` can support the workflow.
- Many files are already dirty from unrelated work; commits must stage only Ralph-owned files.
- Full build/test may be expensive or fail due unrelated dirty state; targeted verification is the minimum, broader verification where practical.

## Likely Codebase Touchpoints

- `docs/jtbd-workflow-implementation-plan.md`
- `docs/platform-jtbd-catalogue.md`
- `frontend/lib/actions/requirements.ts`
- `frontend/lib/db/schema-rfp.ts`
- `frontend/lib/db/schema-tasks.ts`
- `frontend/__tests__/actions/requirements-workflow.test.ts`
- `frontend/app/(app)/opportunities/[id]/requirements/RequirementExtractor.tsx`
- `frontend/app/(app)/opportunities/[id]/requirements/RequirementsClientPage.tsx`
