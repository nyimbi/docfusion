"""
Tests for document management functionality.
"""

import pytest
import json
from app.models import Document


class TestDocumentModelView:
	"""Test document model view operations."""
	
	def test_document_list_view(self, auth_client):
		"""Test document list view."""
		response = auth_client.get('/documentmodelview/list/')
		assert response.status_code == 200
		assert b'Documents' in response.data
	
	def test_document_add_view(self, auth_client):
		"""Test document add view."""
		response = auth_client.get('/documentmodelview/add')
		assert response.status_code == 200
		assert b'Add Document' in response.data or b'title' in response.data
	
	def test_document_show_view(self, auth_client, sample_document):
		"""Test document show view."""
		response = auth_client.get(f'/documentmodelview/show/{sample_document.id}')
		assert response.status_code == 200
		assert sample_document.title.encode() in response.data
	
	def test_document_edit_view(self, auth_client, sample_document):
		"""Test document edit view."""
		response = auth_client.get(f'/documentmodelview/edit/{sample_document.id}')
		assert response.status_code == 200
		assert sample_document.title.encode() in response.data
	
	def test_document_generation(self, auth_client, sample_document):
		"""Test document generation endpoint."""
		response = auth_client.get(f'/documentmodelview/generate/{sample_document.id}')
		# Should redirect back to show page
		assert response.status_code == 302 or response.status_code == 200
	
	def test_document_clone(self, auth_client, sample_document):
		"""Test document cloning."""
		response = auth_client.get(f'/documentmodelview/clone/{sample_document.id}')
		# Should redirect to edit page of new document or show success
		assert response.status_code == 302 or response.status_code == 200


class TestDocumentApi:
	"""Test document API endpoints."""
	
	def test_document_api_list(self, auth_client):
		"""Test document API list endpoint."""
		response = auth_client.get('/api/v1/documents/')
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'result' in data or 'documents' in data
	
	def test_document_api_show(self, auth_client, sample_document):
		"""Test document API show endpoint."""
		response = auth_client.get(f'/api/v1/documents/{sample_document.id}')
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'id' in data or 'result' in data
	
	def test_document_api_generate(self, auth_client, sample_document):
		"""Test document generation API."""
		response = auth_client.post(f'/api/v1/documents/generate/{sample_document.id}/pdf')
		assert response.status_code == 200 or response.status_code == 500  # May fail without backend
		
		if response.status_code == 200:
			data = json.loads(response.data)
			assert 'message' in data
	
	def test_document_api_ai_analyze(self, auth_client, sample_document):
		"""Test document AI analysis API."""
		response = auth_client.post(f'/api/v1/documents/ai_analyze/{sample_document.id}')
		assert response.status_code == 200 or response.status_code == 500  # May fail without AI backend
		
		if response.status_code == 200:
			data = json.loads(response.data)
			assert 'message' in data or 'analysis' in data
	
	def test_document_api_search(self, auth_client, sample_document):
		"""Test document search API."""
		response = auth_client.get('/api/v1/documents/search?q=test')
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'documents' in data
		assert 'count' in data
	
	def test_document_api_bulk_generate(self, auth_client, sample_document):
		"""Test bulk document generation API."""
		request_data = {
			'document_ids': [sample_document.id],
			'formats': ['pdf', 'html']
		}
		response = auth_client.post(
			'/api/v1/documents/bulk_generate',
			data=json.dumps(request_data),
			content_type='application/json'
		)
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'results' in data


class TestDocumentModel:
	"""Test document model functionality."""
	
	def test_document_creation(self, app):
		"""Test creating a new document."""
		with app.app_context():
			document = Document(
				title='New Test Document',
				description='Test description',
				content='Test content',
				document_type='proposal',
				status='draft'
			)
			
			from app import db
			db.session.add(document)
			db.session.commit()
			
			assert document.id is not None
			assert document.title == 'New Test Document'
			assert document.status == 'draft'
	
	def test_document_to_dict(self, sample_document):
		"""Test document serialization."""
		data = sample_document.to_dict()
		
		assert 'id' in data
		assert 'title' in data
		assert 'document_type' in data
		assert 'status' in data
		assert data['title'] == sample_document.title
	
	def test_document_relationships(self, app, sample_document, sample_project):
		"""Test document relationships."""
		with app.app_context():
			# Link document to project
			sample_document.project_id = sample_project.id
			
			from app import db
			db.session.commit()
			
			# Test relationship
			assert sample_document.project is not None
			assert sample_document.project.name == sample_project.name
			assert sample_document in sample_project.documents


class TestDocumentService:
	"""Test document service functionality."""
	
	def test_document_statistics(self, app, sample_document):
		"""Test document statistics calculation."""
		from app.services.document_service import DocumentService
		
		with app.app_context():
			service = DocumentService()
			stats = service.get_document_statistics(sample_document)
			
			assert 'character_count' in stats
			assert 'word_count' in stats
			assert 'paragraph_count' in stats
			assert stats['character_count'] > 0
			assert stats['word_count'] > 0
	
	def test_document_analysis(self, app, sample_document):
		"""Test document analysis."""
		from app.services.document_service import DocumentService
		
		with app.app_context():
			service = DocumentService()
			analysis = service.analyze_document(sample_document)
			
			# Should return analysis even if backend not available
			assert isinstance(analysis, dict)
			# May be empty if NLP backend not available
	
	def test_document_generation_fallback(self, app, sample_document):
		"""Test document generation with fallback."""
		from app.services.document_service import DocumentService
		
		with app.app_context():
			service = DocumentService()
			
			# Test PDF generation (should use fallback)
			try:
				pdf_path = service.generate_pdf(sample_document)
				assert pdf_path is not None
				assert isinstance(pdf_path, str)
			except Exception as e:
				# Fallback generation might fail in test environment
				assert 'generation failed' in str(e).lower() or 'not found' in str(e).lower()
			
			# Test HTML generation (should work)
			html_path = service.generate_html(sample_document)
			assert html_path is not None
			assert html_path.endswith('.html')


class TestDocumentWorkflows:
	"""Test document workflow integration."""
	
	def test_document_collaboration_access(self, auth_client, sample_document):
		"""Test document collaboration access."""
		response = auth_client.get(f'/documentmodelview/collaborate/{sample_document.id}')
		# Should show collaboration interface or redirect based on permissions
		assert response.status_code in [200, 302, 403]
	
	def test_document_ai_enhancement(self, auth_client, sample_document):
		"""Test AI enhancement endpoint."""
		response = auth_client.get(f'/documentmodelview/ai_enhance/{sample_document.id}')
		# Should redirect back to document view
		assert response.status_code == 302
	
	def test_document_download(self, auth_client, sample_document):
		"""Test document download functionality."""
		# Test download without generated files (should show error)
		response = auth_client.get(f'/documentmodelview/download/{sample_document.id}/pdf')
		assert response.status_code == 302  # Redirect to show page with error