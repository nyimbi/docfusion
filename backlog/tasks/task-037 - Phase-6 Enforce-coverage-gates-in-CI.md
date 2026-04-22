---
id: task-037
title: "Phase 6: Enforce coverage gates in CI"
status: To Do
phase: 6
gap_ids: [G-OP-04]
priority: High
dependencies: [task-003, task-036]
---

# task-037 - Phase 6: Enforce coverage gates in CI

## Description (the why)

The project claims an 80% coverage minimum but does not enforce it. Coverage regressions slip in silently. We add a hard gate at 25% (Python) / 15% (frontend) initially, then raise it over time.

## Acceptance Criteria (the what)

- [ ] `pyproject.toml` sets `--cov-fail-under=25` for the pytest command.
- [ ] `frontend/vitest.config.ts` configures coverage thresholds: 15% statements / branches / functions / lines.
- [ ] CI workflow (`.github/workflows/*.yml`) runs both coverage commands and fails the build if thresholds are breached.
- [ ] A README badge or `STATUS.md` section reports current coverage.

## Implementation Plan (the how)

**Step 1: Measure current coverage.**
```bash
uv run pytest tests/ci/ --cov=docfusion --cov-report=term 2>&1 | tail -15
cd frontend && npx vitest run --coverage 2>&1 | tail -15
```

Record the numbers. If either is below the target threshold, set the threshold at the current value minus 2 (never raise the floor above what you have — that's a trap).

**Step 2: Add pytest config.** In `pyproject.toml`:

```toml
[tool.pytest.ini_options]
# ... existing ...
addopts = "--cov=docfusion --cov-report=term --cov-report=xml --cov-fail-under=25"
```

If there's already an `addopts`, append to it. Do not clobber existing flags.

**Step 3: Add Vitest config.** In `frontend/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// ... existing ...
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			thresholds: {
				statements: 15,
				branches: 15,
				functions: 15,
				lines: 15,
			},
		},
	},
});
```

**Step 4: Add CI jobs.** In `.github/workflows/ci.yml` (or the main CI file):

```yaml
jobs:
  python-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: uv sync
      - run: uv run pytest tests/ci/
        # --cov-fail-under comes from pyproject.toml

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - working-directory: frontend
        run: |
          npm ci
          npx vitest run --coverage
```

Make the build-package job depend on both.

**Step 5: Verify locally.**
```bash
uv run pytest tests/ci/  # Should pass if coverage ≥ 25.
cd frontend && npx vitest run --coverage  # Should pass if ≥ 15.
```

**Step 6: Commit.**
```bash
git add pyproject.toml frontend/vitest.config.ts .github/workflows/
git commit -m "ci: enforce coverage gates [G-OP-04]"
```

## Notes for less-capable agents

- Do NOT set the threshold above the current measured coverage. The gate must pass on main today.
- If frontend coverage is actually 0.66% (as findings-plan suggests), this task waits for task-036 to bring it to 15%+ first. If that hasn't happened, either defer this task or set the threshold at the current value and open a follow-up to raise it.
- XML coverage output enables services like Codecov to ingest it later.
