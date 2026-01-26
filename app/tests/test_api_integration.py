"""
Tests for API integration and service layer functionality.
"""

import pytest
import json
from unittest.mock import Mock, patch


class TestAPIAuthentication:
	"""Test API authentication and authorization."""
	
	def test_api_access_without_auth(self, client):
		"""Test API access without authentication."""
		response = client.get('/api/v1/documents/')
		# Should require authentication
		assert response.status_code in [401, 302, 403]
	
	def test_api_access_with_auth(self, auth_client):
		"""Test API access with authentication."""
		response = auth_client.get('/api/v1/documents/')
		assert response.status_code == 200
	
	def test_api_permissions(self, auth_client, sample_document):
		"""Test API permission enforcement."""
		# Test document operations
		response = auth_client.get(f'/api/v1/documents/{sample_document.id}')
		assert response.status_code == 200
		
		# Test that user can access their own documents
		data = json.loads(response.data)
		assert 'id' in data or 'result' in data


class TestServiceIntegration:
	"""Test service layer integration."""
	
	def test_document_service_initialization(self, app):
		"""Test document service initialization."""
		from app.services.document_service import DocumentService
		
		with app.app_context():
			service = DocumentService()
			assert service is not None
			# Service should handle missing backend components gracefully
	
	def test_ai_service_initialization(self, app):
		"""Test AI service initialization."""
		from app.services.ai_service import AIService
		
		with app.app_context():
			service = AIService()
			assert service is not None
			# Service should provide fallback functionality
	
	def test_template_service_initialization(self, app):
		"""Test template service initialization."""
		from app.services.template_service import TemplateService
		
		service = TemplateService()
		assert service is not None
		assert service.jinja_env is not None
	
	def test_integration_service_backend_calls(self, app):
		"""Test integration service backend API calls."""
		from app.services.integration_service import IntegrationService
		
		service = IntegrationService()
		
		# Test backend API call (will fail in test but should handle gracefully)
		result = service.call_backend_api('/test', 'GET')
		assert 'error' in result  # Should return error dict when backend unavailable
	
	@patch('requests.Session.get')
	def test_integration_service_mocked_call(self, mock_get, app):
		"""Test integration service with mocked backend."""
		from app.services.integration_service import IntegrationService
		
		# Mock successful response
		mock_response = Mock()
		mock_response.status_code = 200
		mock_response.json.return_value = {'status': 'success', 'data': 'test'}
		mock_response.raise_for_status.return_value = None
		mock_get.return_value = mock_response
		
		service = IntegrationService()
		result = service.call_backend_api('/test', 'GET')
		
		assert result['status'] == 'success'
		assert result['data'] == 'test'


class TestAPIEndpoints:
	"""Test comprehensive API endpoint functionality."""
	
	def test_document_api_crud(self, auth_client, sample_document):
		"""Test document API CRUD operations."""
		# Read
		response = auth_client.get(f'/api/v1/documents/{sample_document.id}')
		assert response.status_code == 200
		
		# List
		response = auth_client.get('/api/v1/documents/')
		assert response.status_code == 200
		
		# Update would require proper form data and CSRF handling
		# Delete would require proper permissions
	
	def test_template_api_operations(self, auth_client, sample_template):
		"""Test template API operations."""
		# Test render endpoint
		render_data = {
			'data': {
				'client_name': 'API Test Client'
			}
		}
		response = auth_client.post(
			f'/api/v1/templates/render/{sample_template.id}',
			data=json.dumps(render_data),
			content_type='application/json'
		)
		assert response.status_code == 200
		
		# Test variables endpoint
		response = auth_client.get(f'/api/v1/templates/variables/{sample_template.id}')
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'variables' in data
	
	def test_project_api_operations(self, auth_client, sample_project):
		"""Test project API operations."""
		# Test metrics endpoint
		response = auth_client.get(f'/api/v1/projects/metrics/{sample_project.id}')
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'metrics' in data
		
		# Test timeline endpoint
		response = auth_client.get(f'/api/v1/projects/timeline/{sample_project.id}')
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'project_milestones' in data
	
	def test_opportunity_api_operations(self, auth_client, sample_opportunity):
		"""Test opportunity API operations."""
		# Test analysis endpoint
		response = auth_client.post(f'/api/v1/opportunities/analyze/{sample_opportunity.id}')
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'analysis' in data or 'message' in data
		
		# Test pipeline endpoint
		response = auth_client.get('/api/v1/opportunities/pipeline')
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'pipeline_stats' in data
	
	def test_ai_features_api(self, auth_client):
		"""Test AI features API."""
		enhance_data = {
			'content': 'This is a test document that needs enhancement.',
			'document_type': 'proposal'
		}
		response = auth_client.post(
			'/api/v1/ai_features/enhance_content',
			data=json.dumps(enhance_data),
			content_type='application/json'
		)
		# Should return enhancement suggestions or error if AI backend unavailable
		assert response.status_code in [200, 500]
		
		if response.status_code == 200:
			data = json.loads(response.data)
			assert 'suggestions' in data or 'error' in data


class TestErrorHandling:
	"""Test error handling and edge cases."""
	
	def test_not_found_endpoints(self, auth_client):
		"""Test 404 handling for non-existent resources."""
		response = auth_client.get('/api/v1/documents/99999')
		assert response.status_code == 404
		
		response = auth_client.get('/api/v1/templates/99999')
		assert response.status_code == 404
		
		response = auth_client.get('/api/v1/projects/99999')
		assert response.status_code == 404
	
	def test_invalid_json_handling(self, auth_client):
		"""Test handling of invalid JSON in API requests."""
		response = auth_client.post(
			'/api/v1/ai_features/enhance_content',
			data='invalid json',
			content_type='application/json'
		)
		assert response.status_code == 400
	
	def test_missing_required_fields(self, auth_client, sample_template):
		"""Test handling of missing required fields."""
		# Try to render template without data
		response = auth_client.post(
			f'/api/v1/templates/render/{sample_template.id}',
			data=json.dumps({}),
			content_type='application/json'
		)
		# Should handle gracefully
		assert response.status_code in [200, 400]
	
	def test_service_unavailable_handling(self, app):
		"""Test handling when backend services are unavailable."""
		from app.services.ai_service import AIService
		from app.services.document_service import DocumentService
		
		with app.app_context():
			# AI service should handle missing components gracefully
			ai_service = AIService()
			result = ai_service.enhance_content('test content', 'proposal')
			assert isinstance(result, dict)
			
			# Document service should provide fallbacks
			doc_service = DocumentService()
			assert doc_service is not None


class TestPerformance:
	"""Test performance and scalability aspects."""
	
	def test_bulk_operations(self, auth_client, sample_data):
		"""Test bulk operations performance."""
		document_ids = [sample_data['document'].id]
		
		bulk_data = {
			'document_ids': document_ids,
			'formats': ['html']  # Use HTML for faster generation
		}
		
		response = auth_client.post(
			'/api/v1/documents/bulk_generate',
			data=json.dumps(bulk_data),
			content_type='application/json'
		)
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'results' in data
	
	def test_search_performance(self, auth_client):
		"""Test search endpoint performance."""
		# Test document search
		response = auth_client.get('/api/v1/documents/search?q=test')
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'documents' in data
		assert 'count' in data
		
		# Test template search
		response = auth_client.get('/api/v1/templates/search?q=test')
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'templates' in data
		assert 'count' in data
	
	def test_concurrent_access(self, auth_client, sample_document):
		"""Test concurrent access to the same resource."""
		# Simulate multiple requests to the same document
		responses = []
		for _ in range(3):
			response = auth_client.get(f'/api/v1/documents/{sample_document.id}')
			responses.append(response)
		
		# All requests should succeed
		for response in responses:
			assert response.status_code == 200


class TestDataConsistency:
	"""Test data consistency and integrity."""
	
	def test_document_template_relationship(self, auth_client, sample_template):
		"""Test document-template relationship consistency."""
		# Create document from template
		response = auth_client.get(f'/templatemodelview/create_document/{sample_template.id}')
		assert response.status_code == 302  # Redirect to edit page
		
		# Verify relationship was created correctly
		from app.models import Document
		from app import db
		
		with auth_client.application.app_context():
			documents = db.session.query(Document).filter_by(template_id=sample_template.id).all()
			assert len(documents) > 0
			
			for doc in documents:
				assert doc.template_id == sample_template.id
				assert doc.template is not None
	
	def test_project_document_relationship(self, app, sample_project, sample_document):
		"""Test project-document relationship consistency."""
		with app.app_context():
			# Link document to project
			sample_document.project_id = sample_project.id
			
			from app import db
			db.session.commit()
			
			# Verify bidirectional relationship
			assert sample_document.project.id == sample_project.id
			assert sample_document in sample_project.documents
	
	def test_cascade_operations(self, app, sample_project):
		"""Test cascade delete and update operations."""
		with app.app_context():
			from app.models import Document
			from app import db
			
			# Create document linked to project
			doc = Document(
				title='Test Cascade Document',
				project_id=sample_project.id,
				document_type='proposal'
			)
			db.session.add(doc)
			db.session.commit()
			
			doc_id = doc.id
			
			# Delete project (should handle cascade appropriately)
			# Note: Actual cascade behavior depends on foreign key configuration
			db.session.delete(sample_project)
			db.session.commit()
			
			# Check that document still exists but relationship is cleared
			remaining_doc = db.session.query(Document).filter_by(id=doc_id).first()
			if remaining_doc:
				assert remaining_doc.project_id is None or remaining_doc.project_id != sample_project.id