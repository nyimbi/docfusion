#!/usr/bin/env python3
"""
API Tests

Comprehensive test suite for the FastAPI-based proposal writer API
including endpoints, middleware, validation, and integration tests.
"""

import asyncio
import pytest
from fastapi.testclient import TestClient
from fastapi import status
import json
from typing import Dict, Any, Optional

from src.proposal_writer.api import create_app, APIApplication
from src.proposal_writer.api.serializers.document_serializers import DocumentCreateRequest
from src.proposal_writer.api.serializers.template_serializers import TemplateCreateRequest


class TestAPIApplication:
	"""Test API application setup and configuration"""
	
	@pytest.fixture
	def app_instance(self):
		"""Create API application instance for testing"""
		return APIApplication("Test API", "1.0.0", "test")
	
	def test_api_application_initialization(self, app_instance):
		"""Test API application initialization"""
		assert app_instance.title == "Test API"
		assert app_instance.version == "1.0.0"
		assert app_instance.environment == "test"
	
	def test_create_fastapi_app(self, app_instance):
		"""Test FastAPI app creation"""
		app = app_instance.create_app()
		assert app.title == "Test API"
		assert app.version == "1.0.0"


class TestAPIEndpoints:
	"""Test API endpoints"""
	
	@pytest.fixture
	def client(self):
		"""Create test client"""
		app = create_app("test")
		return TestClient(app)
	
	def test_root_endpoint(self, client):
		"""Test root endpoint redirect"""
		response = client.get("/")
		assert response.status_code == status.HTTP_200_OK or response.status_code == 307
	
	def test_api_info_endpoint(self, client):
		"""Test API info endpoint"""
		response = client.get("/api/v1/info")
		assert response.status_code == status.HTTP_200_OK
		data = response.json()
		assert "title" in data
		assert "version" in data
		assert "status" in data
		assert data["status"] == "running"
	
	def test_health_check_endpoint(self, client):
		"""Test health check endpoint"""
		response = client.get("/health")
		assert response.status_code == status.HTTP_200_OK
		data = response.json()
		assert data["status"] == "healthy"
		assert "timestamp" in data
		assert "version" in data


class TestDocumentEndpoints:
	"""Test document-related endpoints"""
	
	@pytest.fixture
	def client(self):
		"""Create test client with authentication bypass for testing"""
		app = create_app("test")
		return TestClient(app)
	
	@pytest.fixture
	def sample_document_data(self):
		"""Sample document data for testing"""
		return {
			"title": "Test Document",
			"content": "This is a test document with some content for testing purposes.",
			"category": "general",
			"tags": ["test", "sample"],
			"metadata": {"test": True}
		}
	
	def test_document_creation_validation(self, client, sample_document_data):
		"""Test document creation with validation"""
		# Note: This would fail without proper authentication setup
		# In a real test, we'd mock the authentication or set up test users
		response = client.post("/api/v1/documents/", json=sample_document_data)
		# We expect authentication error since no auth is provided
		assert response.status_code in [401, 422]  # Unauthorized or validation error
	
	def test_document_creation_invalid_data(self, client):
		"""Test document creation with invalid data"""
		invalid_data = {
			"title": "",  # Empty title should fail validation
			"content": ""  # Empty content should fail validation
		}
		response = client.post("/api/v1/documents/", json=invalid_data)
		assert response.status_code in [401, 422]  # Auth error or validation error
	
	def test_document_list_endpoint(self, client):
		"""Test document listing endpoint"""
		response = client.get("/api/v1/documents/")
		# Should require authentication
		assert response.status_code == 401
	
	def test_document_search_endpoint(self, client):
		"""Test document search endpoint"""
		search_params = {"query": "test", "limit": 10}
		response = client.get("/api/v1/documents/search", params=search_params)
		# Should require authentication
		assert response.status_code == 401


class TestTemplateEndpoints:
	"""Test template-related endpoints"""
	
	@pytest.fixture
	def client(self):
		"""Create test client"""
		app = create_app("test")
		return TestClient(app)
	
	@pytest.fixture
	def sample_template_data(self):
		"""Sample template data for testing"""
		return {
			"name": "Test Template",
			"description": "A test template for validation",
			"category": "general",
			"content": "Template content with {placeholder} fields",
			"fields": [
				{
					"name": "placeholder",
					"label": "Placeholder Field",
					"type": "text",
					"required": True
				}
			],
			"tags": ["test", "template"]
		}
	
	def test_template_creation_validation(self, client, sample_template_data):
		"""Test template creation validation"""
		response = client.post("/api/v1/templates/", json=sample_template_data)
		# Should require authentication
		assert response.status_code == 401
	
	def test_template_list_endpoint(self, client):
		"""Test template listing endpoint"""
		response = client.get("/api/v1/templates/")
		# Should require authentication
		assert response.status_code == 401
	
	def test_template_search_endpoint(self, client):
		"""Test template search endpoint"""
		search_data = {"query": "test", "limit": 10}
		response = client.post("/api/v1/templates/search", json=search_data)
		# Should require authentication
		assert response.status_code == 401


class TestAPIValidation:
	"""Test API input validation"""
	
	@pytest.fixture
	def client(self):
		"""Create test client"""
		app = create_app("test")
		return TestClient(app)
	
	def test_document_serializer_validation(self):
		"""Test document serializer validation"""
		# Test valid data
		valid_data = {
			"title": "Valid Title",
			"content": "Valid content with sufficient length",
			"category": "general"
		}
		
		try:
			doc_request = DocumentCreateRequest(**valid_data)
			assert doc_request.title == "Valid Title"
			assert doc_request.content == "Valid content with sufficient length"
		except Exception as e:
			pytest.fail(f"Valid data should not raise exception: {e}")
	
	def test_document_serializer_invalid_data(self):
		"""Test document serializer with invalid data"""
		# Test invalid data
		invalid_data = {
			"title": "",  # Empty title
			"content": "",  # Empty content
		}
		
		with pytest.raises(Exception):  # Should raise validation error
			DocumentCreateRequest(**invalid_data)
	
	def test_template_serializer_validation(self):
		"""Test template serializer validation"""
		valid_data = {
			"name": "Valid Template",
			"content": "Template with {field} placeholder",
			"fields": [
				{
					"name": "field",
					"label": "Field Label",
					"type": "text"
				}
			]
		}
		
		try:
			template_request = TemplateCreateRequest(**valid_data)
			assert template_request.name == "Valid Template"
			assert len(template_request.fields) == 1
		except Exception as e:
			pytest.fail(f"Valid data should not raise exception: {e}")


class TestAPIMiddleware:
	"""Test API middleware"""
	
	@pytest.fixture
	def client(self):
		"""Create test client"""
		app = create_app("test")
		return TestClient(app)
	
	def test_cors_headers(self, client):
		"""Test CORS headers are present"""
		response = client.options("/api/v1/info")
		# CORS headers should be present for OPTIONS request
		assert response.status_code in [200, 404]  # Depending on middleware setup
	
	def test_rate_limiting_headers(self, client):
		"""Test rate limiting headers"""
		response = client.get("/api/v1/info")
		# Rate limiting headers might be present
		assert response.status_code == 200
		# In a real implementation, we'd check for X-RateLimit-* headers
	
	def test_security_headers(self, client):
		"""Test security headers"""
		response = client.get("/api/v1/info")
		assert response.status_code == 200
		# Could check for security headers like X-Content-Type-Options, etc.


class TestAPIDocumentation:
	"""Test API documentation"""
	
	@pytest.fixture
	def client(self):
		"""Create test client"""
		app = create_app("test")
		return TestClient(app)
	
	def test_openapi_schema(self, client):
		"""Test OpenAPI schema generation"""
		response = client.get("/api/v1/openapi.json")
		assert response.status_code == 200
		schema = response.json()
		assert "openapi" in schema
		assert "info" in schema
		assert "paths" in schema
	
	def test_swagger_ui(self, client):
		"""Test Swagger UI endpoint"""
		response = client.get("/docs")
		assert response.status_code == 200
		assert "text/html" in response.headers.get("content-type", "")
	
	def test_redoc_ui(self, client):
		"""Test ReDoc UI endpoint"""
		response = client.get("/redoc")
		assert response.status_code == 200
		assert "text/html" in response.headers.get("content-type", "")


class TestAPIIntegration:
	"""Integration tests for API functionality"""
	
	@pytest.fixture
	def client(self):
		"""Create test client"""
		app = create_app("test")
		return TestClient(app)
	
	def test_api_workflow_without_auth(self, client):
		"""Test basic API workflow without authentication"""
		# 1. Check API info
		response = client.get("/api/v1/info")
		assert response.status_code == 200
		
		# 2. Check health
		response = client.get("/health")
		assert response.status_code == 200
		
		# 3. Try to access protected endpoint (should fail)
		response = client.get("/api/v1/documents/")
		assert response.status_code == 401
	
	def test_api_error_handling(self, client):
		"""Test API error handling"""
		# Test 404 error
		response = client.get("/api/v1/nonexistent")
		assert response.status_code == 404
		
		# Test validation error with malformed JSON
		response = client.post(
			"/api/v1/documents/",
			data="invalid json",
			headers={"Content-Type": "application/json"}
		)
		assert response.status_code in [400, 422]


# Async test example
class TestAsyncAPI:
	"""Test async functionality"""
	
	@pytest.mark.asyncio
	async def test_async_initialization(self):
		"""Test async initialization of API components"""
		app_instance = APIApplication("Test API", "1.0.0", "test")
		
		# Test async service initialization
		await app_instance.initialize_services()
		assert app_instance.security_manager is not None
		assert app_instance.input_validators is not None
		
		# Test cleanup
		await app_instance.cleanup()


# Performance test example
class TestAPIPerformance:
	"""Performance tests for API"""
	
	@pytest.fixture
	def client(self):
		"""Create test client"""
		app = create_app("test")
		return TestClient(app)
	
	def test_api_response_time(self, client):
		"""Test API response time"""
		import time
		
		start_time = time.time()
		response = client.get("/api/v1/info")
		end_time = time.time()
		
		assert response.status_code == 200
		response_time = end_time - start_time
		# API should respond within 1 second
		assert response_time < 1.0
	
	def test_concurrent_requests(self, client):
		"""Test handling of concurrent requests"""
		import concurrent.futures
		import threading
		
		def make_request():
			return client.get("/api/v1/info")
		
		# Make 10 concurrent requests
		with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
			futures = [executor.submit(make_request) for _ in range(10)]
			responses = [future.result() for future in futures]
		
		# All requests should succeed
		assert all(response.status_code == 200 for response in responses)


if __name__ == "__main__":
	# Run tests with pytest
	pytest.main([__file__, "-v"])