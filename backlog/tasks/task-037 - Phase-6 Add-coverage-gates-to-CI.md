---
id: task-037
title: "Phase 6: Add coverage gates to CI"
status: To Do
phase: 6
gap_ids: [G-OP-04]
priority: Medium
dependencies: [task-036]
---

# task-037 - Phase 6: Add coverage gates to CI

## Description (the why)

The "80% minimum coverage" claim in CLAUDE.md is aspirational. We enforce it in CI with `pytest --cov-fail-under` for Python and a Vitest threshold for frontend. Start with baseline thresholds that the current codebase passes; ratchet up over time.

## Acceptance Criteria (the what)

- [ ] `.github/workflows/ci.yml` (or wherever CI runs) runs `uv run pytest --cov=docfusion --cov-fail-under=25 tests/ci/` and fails the build if coverage drops below 25%.
- [ ] Frontend Vitest config has `coverage.thresholds.global.statements = 15`.
- [ ] Local `make test-coverage` target reports current coverage and fails at the same thresholds.
- [ ] Baseline coverage numbers are recorded in `backlog/docs/coverage-baseline.md` so future regressions are visible.

## Implementation Plan (the how)

**Step 1: Measure baseline.**
```bash
uv run pytest --cov=docfusion --cov-report=term tests/ci/ 2>&1 | tee /tmp/py-cov.txt
cd frontend && npx vitest run --coverage 2>&1 | tee /tmp/ts-cov.txt
```

Record the totals (should be ~25% Python, ~1-15% frontend based on task-036 progress). Write to `backlog/docs/coverage-baseline.md`:

```markdown
# Coverage Baseline — <today>

| Stack | Metric | Value |
|---|---|---|
| Python | statement coverage | X% |
| Frontend | statement coverage | Y% |
```

**Step 2: Set thresholds to the floor you just measured.** If Python is at 28%, set the gate at 25% (5-point cushion). If frontend is at 18%, set at 15%.

**Step 3: Update `pyproject.toml`.**

```toml
[tool.pytest.ini_options]
addopts = "--cov=docfusion --cov-report=term-missing --cov-fail-under=25"
```

**Step 4: Update `frontend/vitest.config.ts`.**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			thresholds: {
				statements: 15,
				branches: 10,
				functions: 15,
				lines: 15,
			},
		},
	},
});
```

**Step 5: Update CI.**

Find the CI workflow (usually `.github/workflows/ci.yml`):

```yaml
- name: Python tests with coverage gate
  run: uv run pytest --cov=docfusion --cov-fail-under=25 tests/ci/

- name: Frontend tests with coverage gate
  working-directory: frontend
  run: npx vitest run --coverage
```

**Step 6: Verify locally before pushing.**
```bash
uv run pytest --cov=docfusion --cov-fail-under=25 tests/ci/
# Must pass.

cd frontend && npx vitest run --coverage
# Must pass.
```

**Step 7: Commit.**
```bash
git add pyproject.toml frontend/vitest.config.ts .github/workflows/ci.yml backlog/docs/coverage-baseline.md
git commit -m "ci: enforce coverage gates (Python 25%, Frontend 15%) [G-OP-04]"
```

## Notes for less-capable agents

- Do NOT set thresholds above the current baseline. That guarantees a broken main branch.
- Schedule a quarterly ratchet (+5% each quarter) as a follow-up task.
- If `coverage.thresholds` breaks your Vitest version, check the config — newer Vitest uses this shape; older uses `coverageThresholds`.
