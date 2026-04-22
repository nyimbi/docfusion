---
id: task-021
title: "Phase 4: Dynamic template population via composition runner"
status: To Do
phase: 4
gap_ids: [G-DOC-02]
priority: High
---

# task-021 - Phase 4: Dynamic template population via composition runner

## Description (the why)

`src/docfusion/api/endpoints/template_endpoints.py` today returns static templates. To turn a template into a working document, callers need to supply variables and get a rendered result. We add a `POST /api/v1/templates/{id}/render` endpoint that runs the composition runner and returns the populated output.

## Acceptance Criteria (the what)

- [ ] `POST /api/v1/templates/{template_id}/render` accepts a `variables` JSON body and returns the rendered output (plain text, Markdown, or LaTeX depending on template type).
- [ ] The endpoint uses the existing composition runner (`docfusion.composition.runner`) — no duplicated logic.
- [ ] Validation: missing required variables return HTTP 422 with a list of missing names.
- [ ] Test `tests/ci/test_template_render.py` verifies: (a) successful render with all variables, (b) missing variables → 422 with a helpful error body.

## Implementation Plan (the how)

**Step 1: Read the runner.**
```bash
grep -n "class\|def run\|def render" src/docfusion/composition/runner.py | head -20
```

Find the primary entry point — likely `Runner.run(template_source, context)` or similar. Note its signature.

**Step 2: Inventory templates.** Templates probably live in DB — check:
```bash
grep -rn "templates" frontend/lib/db/schema.ts src/docfusion/api/endpoints/template_endpoints.py 2>/dev/null | head
```

**Step 3: Add the render endpoint.**

Open `src/docfusion/api/endpoints/template_endpoints.py`. Add:

```python
from pydantic import BaseModel, ConfigDict
from fastapi import HTTPException
from sqlalchemy import text

from docfusion.composition.runner import Runner, RunnerContext


class TemplateRenderRequest(BaseModel):
	model_config = ConfigDict(extra='forbid')
	variables: dict[str, Any] = {}


class TemplateRenderResponse(BaseModel):
	model_config = ConfigDict(extra='forbid')
	template_id: str
	output: str
	format: str


@router.post("/{template_id}/render", response_model=TemplateRenderResponse)
async def render_template(
	template_id: str,
	req: TemplateRenderRequest,
	session: AsyncSession = Depends(get_db),
) -> TemplateRenderResponse:
	row = (await session.execute(
		text("SELECT * FROM templates WHERE id = :id"),
		{"id": template_id},
	)).mappings().first()
	if row is None:
		raise HTTPException(404, f"Template {template_id} not found")

	template_source = row["source"] or row["content"]
	template_format = row.get("format") or "markdown"
	required_vars = (row.get("required_variables") or []) if row.get("required_variables") else []

	missing = [v for v in required_vars if v not in req.variables]
	if missing:
		raise HTTPException(
			status_code=422,
			detail={"error": "missing required variables", "missing": missing},
		)

	runner = Runner()
	try:
		result = await runner.run(
			template_source,
			RunnerContext(variables=req.variables),
		)
	except Exception as exc:
		raise HTTPException(500, f"Composition runner error: {exc}") from exc

	return TemplateRenderResponse(
		template_id=template_id,
		output=result.output if hasattr(result, "output") else str(result),
		format=template_format,
	)
```

If `Runner`, `RunnerContext`, or `result.output` have different names, adjust to match reality.

**Step 4: Test.**

```python
# tests/ci/test_template_render.py
"""Template render endpoint coverage."""

import pytest
from httpx import AsyncClient

from docfusion.api.main import app


async def test_render_missing_variables_returns_422(db_session, seeded_template_id):
	async with AsyncClient(app=app, base_url="http://test") as client:
		r = await client.post(f"/api/v1/templates/{seeded_template_id}/render", json={"variables": {}})
	assert r.status_code == 422
	body = r.json()
	assert "missing" in body.get("detail", {})


async def test_render_with_all_variables(db_session, seeded_template_id):
	async with AsyncClient(app=app, base_url="http://test") as client:
		r = await client.post(
			f"/api/v1/templates/{seeded_template_id}/render",
			json={"variables": {"name": "Alice", "project": "DocuFusion"}},
		)
	assert r.status_code == 200
	assert r.json()["output"]
```

Add a `seeded_template_id` fixture in `tests/ci/conftest.py` that inserts a test template row and yields its id.

**Step 5: Verify + commit.**
```bash
uv run pytest tests/ci/test_template_render.py -vxs
git add src/docfusion/api/endpoints/template_endpoints.py tests/ci/test_template_render.py tests/ci/conftest.py
git commit -m "feat(api): template dynamic population via composition runner [G-DOC-02]"
```

## Notes for less-capable agents

- If the runner is not async, wrap the call in `asyncio.to_thread(runner.run, ...)`.
- If `required_variables` isn't a column in the templates table, treat all variables as optional and skip the 422 logic (but include it as a follow-up task).
- If templates are stored as files rather than DB rows, read from disk instead — the rest of the endpoint logic is identical.
