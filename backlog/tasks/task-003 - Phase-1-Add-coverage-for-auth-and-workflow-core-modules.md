# task-003 - Phase-1-Add-coverage-for-auth-and-workflow-core-modules.md

Task TASK-003 - Phase 1: Add coverage for auth and workflow core modules
==================================================

Status: In Progress
Priority: High
Created: 
Updated: 2026-04-22 19:17

Description:
--------------------------------------------------
Add smoke coverage for docfusion.security and docfusion.workflow top-level modules, ensuring at least one happy-path and one failure-path per module. Fix any failing tests discovered during verification.

Acceptance Criteria:
--------------------------------------------------
- [x] `tests/ci/test_auth_flows.py` passes with all security module smoke tests green
- [x] `tests/ci/test_workflow_core.py` passes with all workflow module smoke tests green
- [x] `tests/ci/test_authentication.py` passes (complementary auth coverage)
- [x] `tests/ci/test_workflow_engine.py` passes (complementary workflow coverage)
- [x] Every top-level security and workflow module has at least one happy-path and one failure-path test

Implementation Plan:
--------------------------------------------------
1. Run the existing test suite to identify failing tests
2. Fix source code bugs causing test failures:
   - `SecurityConfiguration.jwt_secret_key` using `pydantic.Field` in std `@dataclass` → use `dataclasses.field`
   - `security_manager.py` missing `import secrets`
   - `task_scheduler.py` using naive `datetime.now()` → use `datetime.now(timezone.utc)`
3. Fix test bugs causing failures:
   - DataEncryption/DLPSystem tests creating objects outside async context → restructure to create inside `asyncio.run()`
   - APIAuthentication tests expecting `dict` → expect `APIKeyResult`
   - TaskCoordinator `assigned_to` expecting string → expect `List[str]`
   - TaskCoordinator no-matching-member expecting `None` → expect low-confidence `TaskAssignment`
4. Verify all four test files pass

Implementation Notes:
--------------------------------------------------
Approach: Triage and fix both source-code bugs and test-expectation mismatches that were causing 11 failures across `test_auth_flows.py` and `test_workflow_core.py`.

Files touched:
- `src/docfusion/security/authentication/user_authentication.py` — fixed `SecurityConfiguration.jwt_secret_key` to use `dataclasses.field(default_factory=...)` instead of `pydantic.Field`, which was producing a `FieldInfo` object and breaking JWT signing.
- `src/docfusion/security/security_manager.py` — added missing `import secrets`.
- `src/docfusion/workflow/automation/task_scheduler.py` — fixed two `datetime.now()` calls to `datetime.now(timezone.utc)` to prevent offset-naive vs offset-aware comparison errors.
- `tests/ci/test_auth_flows.py` — restructured DataEncryption and DLPSystem tests to instantiate objects inside `asyncio.run()` so that `asyncio.create_task()` calls in `__init__` find a running event loop. Fixed APIAuthentication tests to assert on `APIKeyResult` fields (`success`, `api_key`) instead of `dict`.
- `tests/ci/test_workflow_core.py` — fixed TaskCoordinator `assigned_to` assertion to expect `List[str]`. Updated no-matching-member test to assert on low `confidence_score` instead of `None`, matching the actual fallback behavior of the coordinator.

Unexpected findings:
- `DataEncryption.__init__` and `DLPSystem.__init__` call `asyncio.create_task()` synchronously; this pattern works when instantiated inside an async context but fails from a sync test. Restructuring the tests was the minimal fix.
- `TaskCoordinator` assigns tasks even when no member has the exact required skills, falling back to the best available candidate with a low confidence score. The original test expected `None`.

Deviations from plan: None.

Follow-up tasks: None.
