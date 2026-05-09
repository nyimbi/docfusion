#!/usr/bin/env python3
"""End-to-end: upload -> parse -> requirements -> compliance -> discovery ingest.

W3 reset: every RFP endpoint now requires the tenant headers
``x-docfusion-user-id`` and ``x-docfusion-organization-id``. The handlers
whose DB wire-up is deferred to W3b return 501 with a sentinel detail
string, and the test contract reflects that — the goal is to catch
silent regressions, not pretend the pipeline is fully wired here.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from docfusion.api.endpoints.rfp_endpoints import router as rfp_router
from docfusion.api.endpoints.discovery_endpoints import router as discovery_router

TENANT_HEADERS = {
	"x-docfusion-user-id": "test-user",
	"x-docfusion-organization-id": "test-org",
}


@pytest.fixture
def client():
	app = FastAPI()
	app.include_router(rfp_router)
	app.include_router(discovery_router)
	return TestClient(app)


class TestRfpPipeline:
	"""End-to-end tests for the RFP pipeline."""

	def test_upload_endpoint(self, client):
		"""Upload returns metadata + 202 Accepted under tenant context."""
		response = client.post(
			"/api/v1/rfp/upload",
			headers=TENANT_HEADERS,
			files={"file": ("sample.pdf", b"%PDF-1.4 test content", "application/pdf")},
		)
		assert response.status_code == 202
		data = response.json()
		assert "rfp_id" in data
		assert data["filename"] == "sample.pdf"
		assert data["size"] > 0
		assert data["organization_id"] == "test-org"

	def test_upload_requires_tenant_headers(self, client):
		"""Anonymous upload is rejected at the trust boundary."""
		response = client.post(
			"/api/v1/rfp/upload",
			files={"file": ("sample.pdf", b"%PDF-1.4 test", "application/pdf")},
		)
		assert response.status_code == 401

	def test_parse_endpoint_returns_501_until_wired(self, client):
		"""Parse handler is honest about being unwired (W3b)."""
		response = client.post("/api/v1/rfp/rfp-123/parse", headers=TENANT_HEADERS)
		assert response.status_code == 501
		assert "Next.js" in response.json()["detail"]

	def test_list_requirements_returns_501_until_wired(self, client):
		"""Requirements listing handler is honest about being unwired."""
		response = client.get(
			"/api/v1/rfp/rfp-123/requirements", headers=TENANT_HEADERS
		)
		assert response.status_code == 501

	def test_generate_matrix_returns_501_until_wired(self, client):
		"""Compliance matrix generation handler is honest about being unwired."""
		response = client.post(
			"/api/v1/rfp/rfp-123/compliance-matrix", headers=TENANT_HEADERS
		)
		assert response.status_code == 501

	def test_update_entry_returns_501_until_wired(self, client):
		"""Compliance entry update handler is honest about being unwired."""
		response = client.patch(
			"/api/v1/rfp/rfp-123/compliance-matrix/m-1/entries/e-1",
			headers=TENANT_HEADERS,
			json={"status": "addressed", "response": "We provide 24/7 support."},
		)
		assert response.status_code == 501

	def test_discovery_sources_endpoint(self, client):
		"""Test discovery sources list endpoint."""
		response = client.get("/api/v1/discovery/sources")
		assert response.status_code == 200
		assert isinstance(response.json(), list)

	def test_discovery_health_endpoint(self, client):
		"""Test discovery health endpoint."""
		response = client.get("/api/v1/discovery/health")
		assert response.status_code == 200
		data = response.json()
		assert "status" in data
		assert "capabilities" in data

	def test_discovery_ingest_endpoint(self, client):
		"""Test discovery ingest endpoint."""
		response = client.post("/api/v1/discovery/opportunities/op-1/ingest")
		assert response.status_code == 200
		data = response.json()
		assert "rfp_id" in data
		assert data["source"] == "discovery"
		assert data["opportunity_id"] == "op-1"


if __name__ == "__main__":
	pytest.main([__file__, "-v"])
