from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from docfusion.api.dependencies import (
	TenantContext,
	build_signed_tenant_headers,
	require_tenant,
)


TENANT_SECRET = "test-tenant-secret"


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


def test_rejects_unsigned_tenant_headers(monkeypatch):
	monkeypatch.setenv("DOCFUSION_TENANT_HEADER_SECRET", TENANT_SECRET)
	r = _make_app().get(
		"/_t",
		headers={"x-docfusion-user-id": "u", "x-docfusion-organization-id": "o"},
	)
	assert r.status_code == 401


def test_returns_context_when_signed_headers_set(monkeypatch):
	monkeypatch.setenv("DOCFUSION_TENANT_HEADER_SECRET", TENANT_SECRET)
	r = _make_app().get(
		"/_t",
		headers=build_signed_tenant_headers(
			method="GET",
			path="/_t",
			user_id="u",
			organization_id="o",
			secret=TENANT_SECRET,
		),
	)
	assert r.status_code == 200
	assert r.json() == {"userId": "u", "organizationId": "o"}


def test_rejects_signature_for_different_path(monkeypatch):
	monkeypatch.setenv("DOCFUSION_TENANT_HEADER_SECRET", TENANT_SECRET)
	r = _make_app().get(
		"/_t",
		headers=build_signed_tenant_headers(
			method="GET",
			path="/wrong",
			user_id="u",
			organization_id="o",
			secret=TENANT_SECRET,
		),
	)
	assert r.status_code == 401
