# DocuFusion Backlog

This backlog decomposes the [Master Completion Plan](../../docs/plans/2026-04-22-master-completion-plan.md) into actionable tasks for an implementing agent.

## How to use this backlog

1. **Read the master plan first.** Every task references a Gap ID (e.g. `G-RFP-01`) defined in §2 of the master plan. Open it before starting any task.
2. **Work phases in order.** Phase 1 tasks (task-001 through task-006) must complete before Phase 2, and so on.
3. **Within a phase**, follow the numerical order of task IDs unless a task's Description explicitly says it can parallelize.
4. **Each task file has three mandatory sections:**
   - **Description** — the *why*.
   - **Acceptance Criteria** — the *what* (verifiable outcomes).
   - **Implementation Plan** — the *how* (step-by-step instructions).
5. **Do not mark a task Done until all Acceptance Criteria checkboxes are ticked.** Add an `## Implementation Notes` section summarizing your actual approach before closing.

## Task numbering convention

- **task-001 to task-006** — Phase 1: Foundation Hardening
- **task-007 to task-013** — Phase 2: RFP Pipeline Unification
- **task-014 to task-019** — Phase 3: Agent Subsystem
- **task-020 to task-026** — Phase 4: Document Engine
- **task-027 to task-035** — Phase 5: Quality/Architecture Debt
- **task-036 to task-042** — Phase 6: Production Readiness

## Rules that apply to every task

Apply these without needing to be told. They are enforced in pre-commit after task-006.

1. No new `NotImplementedError`. Use `PendingImplementationError` (from `docfusion.core.errors` after task-006) if truly unavoidable.
2. No `asyncio.get_event_loop()` — use `asyncio.get_running_loop()` inside async, `asyncio.new_event_loop()` only at entrypoints.
3. No `datetime.utcnow()` — always `datetime.now(timezone.utc)`.
4. No direct `os.environ.get()` — always `SecretsManager`.
5. Pydantic v2 only: `model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)`.
6. Tabs, not spaces, in Python. (Overrides pyproject ruff config.)
7. All new tests go in `tests/ci/`. Real objects. Mock only LLM calls.
8. Source files stay under 25 KB. Warn at 20 KB.
9. All LLM calls go through `LiteLLMClient` + `LLMFallbackChain`. No direct provider clients.
10. All persistent writes use asyncpg. Sync PostgreSQL drivers only inside Alembic migrations.
11. UUID7 for all new IDs: `from docfusion.core.utils import uuid7str` + `id: str = Field(default_factory=uuid7str)`.
12. Every new module ships with at least one CI test.

## Workflow for the implementing agent

For each task:

```bash
# 1. Read the task
backlog task <id> --plain

# 2. Start work
backlog task edit <id> -a @implementer -s "In Progress"

# 3. Follow the Implementation Plan step by step

# 4. Run the verification commands listed in Acceptance Criteria

# 5. Tick each Acceptance Criteria checkbox as you satisfy it

# 6. Add Implementation Notes section describing what you actually did

# 7. Commit (reference the task ID and Gap IDs)
git commit -m "feat(phase-N): task-NNN done — <Gap-IDs>"

# 8. Mark Done
backlog task edit <id> -s Done --notes "Short summary"
```

## Common pitfalls to avoid

- **Do not invent file paths.** If a task says "modify `src/docfusion/foo.py`", verify the file exists first with `ls`. If it doesn't, the task description is wrong — stop and ask.
- **Do not skip verification commands.** Running them is how you know your change actually works.
- **Do not combine tasks.** Each task is atomic. Finish one, commit, then move to the next.
- **If a task looks too big**, split it: create subtasks with `backlog task create -p <parent-id>`.
- **If you disagree with the plan**, update the task with your proposed change BEFORE implementing. Do not silently deviate.
