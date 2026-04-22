---
id: task-025
title: "Phase 4: Complete the health-check missing implementation"
status: To Do
phase: 4
gap_ids: [G-HC-01]
priority: Low
---

# task-025 - Phase 4: Complete the health-check missing implementation

## Description (the why)

`src/docfusion/api/health/health_checks.py:143` has a `NotImplementedError`. Either the abstract method should be removed (if unused) or implemented to check the corresponding dependency (likely Docling reachability).

## Acceptance Criteria (the what)

- [ ] No `NotImplementedError` remains in `health_checks.py`.
- [ ] The endpoint `/api/v1/health` (or wherever this check is routed) returns a structured status for every dependency.
- [ ] Test `tests/ci/test_health_checks.py` verifies the endpoint returns 200 with a well-formed body.

## Implementation Plan (the how)

**Step 1: Read the file around line 143** and find the class + method name.

```bash
sed -n '120,160p' src/docfusion/api/health/health_checks.py
```

**Step 2: Decide disposition.**

- If the method is an abstract base (no concrete callers for it), delete the `@abstractmethod` and the `raise` — convert to a no-op default.
- If the method is intended to check a specific dependency (the class name or method name should hint), implement it.

Likely candidate: a Docling health check. Template:

```python
async def check_docling(self) -> dict[str, Any]:
	"""Ping the Docling service and record response time."""
	from docfusion.config.secrets import SecretsManager
	import httpx
	import time

	url = SecretsManager().get_docling_url()
	start = time.monotonic()
	try:
		async with httpx.AsyncClient(timeout=5.0) as client:
			r = await client.get(f"{url}/health")
		elapsed_ms = (time.monotonic() - start) * 1000
		return {
			"status": "healthy" if r.status_code == 200 else "degraded",
			"latency_ms": round(elapsed_ms, 1),
			"upstream_status": r.status_code,
		}
	except Exception as exc:
		return {
			"status": "unhealthy",
			"error": str(exc),
			"latency_ms": round((time.monotonic() - start) * 1000, 1),
		}
```

**Step 3: Wire into the main health endpoint.** Find the existing `/health` route and include the new check in its response.

**Step 4: Test.**

```python
# tests/ci/test_health_checks.py
import pytest
from httpx import AsyncClient

from docfusion.api.main import app


async def test_health_endpoint_returns_structured_status():
	async with AsyncClient(app=app, base_url="http://test") as client:
		r = await client.get("/api/v1/health")
	assert r.status_code == 200
	body = r.json()
	assert "status" in body or "checks" in body
```

**Step 5: Verify + commit.**
```bash
uv run pytest tests/ci/test_health_checks.py -vxs
grep -n "NotImplementedError" src/docfusion/api/health/health_checks.py
# Must be 0 lines.

git add src/docfusion/api/health/ tests/ci/test_health_checks.py
git commit -m "fix(health): complete missing health check [G-HC-01]"
```

## Notes for less-capable agents

- If the unimplemented method on line 143 is for a dependency that doesn't exist yet, delete it cleanly instead of fabricating one.
- Never call a production service (LiteLLM gateway, Docling) without a timeout. 5 seconds is right for a health check.
