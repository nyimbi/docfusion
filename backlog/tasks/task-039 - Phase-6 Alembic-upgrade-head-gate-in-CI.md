---
id: task-039
title: "Phase 6: Alembic upgrade head gate in CI"
status: To Do
phase: 6
gap_ids: [master-plan-§6.3]
priority: Medium
---

# task-039 - Phase 6: Alembic upgrade head gate in CI

## Description (the why)

Migrations can land broken in ways that only surface at deploy time. A CI check that runs `alembic upgrade head` against a fresh database catches most migration bugs before they reach staging.

## Acceptance Criteria (the what)

- [ ] CI runs `uv run alembic upgrade head` against an ephemeral PostgreSQL on every PR touching `migrations/` or `src/docfusion/`.
- [ ] CI runs `uv run alembic downgrade base` after to verify reversibility.
- [ ] The job fails the build on any error.
- [ ] Runtime < 2 minutes.

## Implementation Plan (the how)

**Step 1: Add a CI job.**

In `.github/workflows/ci.yml`:

```yaml
alembic-check:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_USER: test
        POSTGRES_PASSWORD: test
        POSTGRES_DB: test
      ports: [5432:5432]
      options: >-
        --health-cmd pg_isready
        --health-interval 5s
        --health-timeout 3s
        --health-retries 10
  steps:
    - uses: actions/checkout@v4
    - uses: astral-sh/setup-uv@v3
    - name: Install deps
      run: uv sync
    - name: Upgrade head
      env:
        DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/test
      run: uv run alembic upgrade head
    - name: Downgrade base
      env:
        DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/test
      run: uv run alembic downgrade base
    - name: Upgrade head again
      env:
        DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/test
      run: uv run alembic upgrade head
```

**Step 2: Verify alembic config uses `DATABASE_URL`** from env. Check `alembic.ini` or `migrations/env.py`:

```python
# migrations/env.py
import os
url = os.environ.get("DATABASE_URL") or config.get_main_option("sqlalchemy.url")
```

**Step 3: Test locally.**
```bash
docker run --rm -d --name alembic-test -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test -p 5432:5432 postgres:16
sleep 5
DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test uv run alembic upgrade head
DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test uv run alembic downgrade base
docker stop alembic-test
```

**Step 4: Commit.**
```bash
git add .github/workflows/ci.yml migrations/env.py
git commit -m "ci: gate PRs on alembic upgrade head + downgrade [master-plan-§6.3]"
```

## Notes for less-capable agents

- If the downgrade fails because a migration's `downgrade()` is missing or incorrect, fix the migration — don't skip the check.
- Some migrations (data backfills) are one-way. If unavoidable, mark them with a comment `# NO-DOWNGRADE: <reason>` and add them to an exception list in CI.
- The `postgres:16` version should match production. Check your deployment config.
