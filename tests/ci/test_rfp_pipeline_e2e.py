#!/usr/bin/env python3
"""End-to-end: upload -> parse -> requirements -> compliance -> discovery ingest."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from docfusion.api.endpoints.rfp_endpoints import router as rfp_router
from docfusion.api.endpoints.discovery_endpoints import router as discovery_router


@pytest.fixture
def client():
	app = FastAPI()
	app.include_router(rfp_router)
	app.include_router(discovery_router)
	return TestClient(app)


class TestRfpPipeline:
	"""End-to-end tests for the RFP pipeline."""

	def test_upload_endpoint(self, client):
		"""Test RFP upload returns metadata."""
		response = client.post(
			"/api/v1/rfp/upload",
			files={"file": ("sample.pdf", b"%PDF-1.4 test content", "application/pdf")},
		)
		assert response.status_code == 200
		data = response.json()
		assert "rfp_id" in data
		assert data["filename"] == "sample.pdf"
		assert data["size"] > 0

	def test_parse_endpoint(self, client):
		"""Test RFP parse returns requirement count."""
		response = client.post("/api/v1/rfp/rfp-123/parse")
		assert response.status_code == 200
		data = response.json()
		assert data["rfp_id"] == "rfp-123"
		assert data["requirement_count"] >= 0

	def test_list_requirements_endpoint(self, client):
		"""Test requirements list endpoint."""
		response = client.get("/api/v1/rfp/rfp-123/requirements")
		assert response.status_code == 200
		assert isinstance(response.json(), list)

	def test_generate_matrix_endpoint(self, client):
		"""Test compliance matrix generation endpoint."""
		response = client.post("/api/v1/rfp/rfp-123/compliance-matrix")
		assert response.status_code == 200
		data = response.json()
		assert "matrix_id" in data
		assert "entry_count" in data

	def test_update_entry_endpoint(self, client):
		"""Test compliance entry update endpoint."""
		response = client.patch(
			"/api/v1/rfp/rfp-123/compliance-matrix/m-1/entries/e-1",
			json={"status": "addressed", "response": "We provide 24/7 support."},
		)
		assert response.status_code == 200
		data = response.json()
		assert data["ok"] is True

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
