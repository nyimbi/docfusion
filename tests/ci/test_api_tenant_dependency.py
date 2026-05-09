from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from docfusion.api.dependencies import TenantContext, require_tenant


def _make_app() -> TestClient:
	app = FastAPI()

	@app.get("/_t")
	def _route(ctx: TenantContext = Depends(require_tenant)):
		return {"userId": ctx.user_id, "organizationId": ctx.organization_id}

	return TestClient(app)


def test_returns_401_without_user_header():
	r = _make_app().get("/_t", headers={"x-docfusion-organization-id": "o"})
	assert r.status_code == 401


def test_returns_403_without_org_header():
	r = _make_app().get("/_t", headers={"x-docfusion-user-id": "u"})
	assert r.status_code == 403


def test_returns_context_when_both_headers_set():
	r = _make_app().get(
		"/_t",
		headers={"x-docfusion-user-id": "u", "x-docfusion-organization-id": "o"},
	)
	assert r.status_code == 200
	assert r.json() == {"userId": "u", "organizationId": "o"}
