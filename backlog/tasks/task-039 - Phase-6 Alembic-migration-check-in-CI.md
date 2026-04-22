---
id: task-039
title: "Phase 6: Alembic migration check in CI"
status: To Do
phase: 6
gap_ids: [master-plan-§6.3]
priority: Medium
---

# task-039 - Phase 6: Alembic migration check in CI

## Description (the why)

A missing or broken migration silently ships to staging if CI doesn't run `alembic upgrade head` against a fresh DB. We add that as a mandatory CI job.

## Acceptance Criteria (the what)

- [ ] CI workflow runs `uv run alembic upgrade head` against a fresh PostgreSQL container.
- [ ] CI also runs `uv run alembic check` (or equivalent: `alembic revision --autogenerate --sql | grep -q '.'` to detect pending schema changes).
- [ ] Build fails if migrations don't apply cleanly from empty DB.
- [ ] Build fails if model definitions diverge from migrations.

## Implementation Plan (the how)

**Step 1: Add a migration job.**

```yaml
# .github/workflows/ci.yml (append)
  migrations:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: docfusion_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: uv sync
      - name: Run migrations from empty
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/docfusion_test
        run: uv run alembic upgrade head
      - name: Detect drift
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/docfusion_test
        run: |
          if uv run alembic revision --autogenerate -m __drift_check__ 2>&1 | grep -q "No changes"; then
            echo "Schema in sync."
          else
            echo "Schema drift detected."
            # Clean up the generated revision.
            rm -f migrations/versions/*__drift_check__.py
            exit 1
          fi
```

**Step 2: Verify locally.**
```bash
createdb docfusion_test
DATABASE_URL=postgresql+asyncpg://postgres@localhost:5432/docfusion_test uv run alembic upgrade head
DATABASE_URL=postgresql+asyncpg://postgres@localhost:5432/docfusion_test uv run alembic revision --autogenerate -m test
# If it says "No changes detected" you're good. Delete the empty migration file if one was created.
```

**Step 3: Commit.**
```bash
git add .github/workflows/ci.yml
git commit -m "ci: run alembic upgrade and drift check [master-plan-§6.3]"
```

## Notes for less-capable agents

- Do NOT commit the `__drift_check__` migration file. If drift is detected, that's a real problem you should address — not work around.
- If tests already run against a fresh DB, you can reuse the same PostgreSQL service.
- `alembic check` as a command exists only in newer Alembic versions. The autogenerate-and-grep pattern is the portable fallback.
