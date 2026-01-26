"""
Tests for template management functionality.
"""

import pytest
import json
from app.models import Template


class TestTemplateModelView:
	"""Test template model view operations."""
	
	def test_template_list_view(self, auth_client):
		"""Test template list view."""
		response = auth_client.get('/templatemodelview/list/')
		assert response.status_code == 200
		assert b'Templates' in response.data or b'template' in response.data.lower()
	
	def test_template_add_view(self, auth_client):
		"""Test template add view."""
		response = auth_client.get('/templatemodelview/add')
		assert response.status_code == 200
		assert b'Add' in response.data or b'name' in response.data
	
	def test_template_show_view(self, auth_client, sample_template):
		"""Test template show view."""
		response = auth_client.get(f'/templatemodelview/show/{sample_template.id}')
		assert response.status_code == 200
		assert sample_template.name.encode() in response.data
	
	def test_template_preview(self, auth_client, sample_template):
		"""Test template preview functionality."""
		response = auth_client.get(f'/templatemodelview/preview/{sample_template.id}')
		assert response.status_code == 200
		# Should show rendered template with sample data
	
	def test_template_clone(self, auth_client, sample_template):
		"""Test template cloning."""
		response = auth_client.get(f'/templatemodelview/clone/{sample_template.id}')
		assert response.status_code == 302  # Should redirect to edit page
	
	def test_template_validate(self, auth_client, sample_template):
		"""Test template validation."""
		response = auth_client.get(f'/templatemodelview/validate/{sample_template.id}')
		assert response.status_code == 200
		# Should show validation results
	
	def test_template_export(self, auth_client, sample_template):
		"""Test template export."""
		response = auth_client.get(f'/templatemodelview/export/{sample_template.id}')
		assert response.status_code == 200
		assert response.headers['Content-Type'] == 'application/json'
	
	def test_create_document_from_template(self, auth_client, sample_template):
		"""Test creating document from template."""
		response = auth_client.get(f'/templatemodelview/create_document/{sample_template.id}')
		assert response.status_code == 302  # Should redirect to document edit page


class TestTemplateApi:
	"""Test template API endpoints."""
	
	def test_template_api_list(self, auth_client):
		"""Test template API list endpoint."""
		response = auth_client.get('/api/v1/templates/')
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'result' in data or 'templates' in data
	
	def test_template_api_render(self, auth_client, sample_template):
		"""Test template rendering API."""
		request_data = {
			'data': {
				'client_name': 'Test Client Corporation',
				'project_title': 'API Test Project'
			}
		}
		response = auth_client.post(
			f'/api/v1/templates/render/{sample_template.id}',
			data=json.dumps(request_data),
			content_type='application/json'
		)
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'rendered_content' in data
		assert 'Test Client Corporation' in data['rendered_content']
	
	def test_template_api_variables(self, auth_client, sample_template):
		"""Test template variables extraction API."""
		response = auth_client.get(f'/api/v1/templates/variables/{sample_template.id}')
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'variables' in data
		assert 'client_name' in data['variables']
	
	def test_template_api_validate(self, auth_client, sample_template):
		"""Test template validation API."""
		response = auth_client.post(f'/api/v1/templates/validate/{sample_template.id}')
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'is_valid' in data
	
	def test_template_api_search(self, auth_client, sample_template):
		"""Test template search API."""
		response = auth_client.get('/api/v1/templates/search?q=test')
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'templates' in data
		assert 'count' in data
	
	def test_template_api_import(self, auth_client):
		"""Test template import API."""
		import_data = {
			'format_version': '1.0',
			'template': {
				'name': 'Imported Test Template',
				'description': 'A template imported via API',
				'category': 'proposal',
				'content': 'Hello {{name}}, this is an imported template.',
				'version': '1.0'
			}
		}
		response = auth_client.post(
			'/api/v1/templates/import',
			data=json.dumps(import_data),
			content_type='application/json'
		)
		assert response.status_code == 200
		data = json.loads(response.data)
		assert 'message' in data
		assert 'template_id' in data


class TestTemplateModel:
	"""Test template model functionality."""
	
	def test_template_creation(self, app):
		"""Test creating a new template."""
		with app.app_context():
			template = Template(
				name='New Test Template',
				description='Test template description',
				category='proposal',
				template_content='Hello {{client}}, this is a test.',
				is_active=True,
				is_public=False
			)
			
			from app import db
			db.session.add(template)
			db.session.commit()
			
			assert template.id is not None
			assert template.name == 'New Test Template'
			assert template.is_active == True
	
	def test_template_relationships(self, app, sample_template):
		"""Test template relationships."""
		with app.app_context():
			from app.models import Document
			
			# Create document using template
			document = Document(
				title='Document from Template',
				template_id=sample_template.id,
				content=sample_template.template_content,
				document_type='proposal'
			)
			
			from app import db
			db.session.add(document)
			db.session.commit()
			
			# Test relationship
			assert document.template is not None
			assert document.template.name == sample_template.name
			assert document in sample_template.documents


class TestTemplateService:
	"""Test template service functionality."""
	
	def test_template_rendering(self, app, sample_template):
		"""Test template rendering with data."""
		from app.services.template_service import TemplateService
		
		with app.app_context():
			service = TemplateService()
			
			data = {'client_name': 'Acme Corporation'}
			rendered = service.render_template(sample_template.template_content, data)
			
			assert 'Acme Corporation' in rendered
			assert '{{client_name}}' not in rendered
	
	def test_variable_extraction(self, app, sample_template):
		"""Test extracting variables from template."""
		from app.services.template_service import TemplateService
		
		with app.app_context():
			service = TemplateService()
			variables = service.extract_variables(sample_template.template_content)
			
			assert 'client_name' in variables
			assert len(variables) > 0
	
	def test_template_validation(self, app, sample_template):
		"""Test template validation."""
		from app.services.template_service import TemplateService
		
		with app.app_context():
			service = TemplateService()
			result = service.validate_template(sample_template)
			
			assert 'is_valid' in result
			assert 'errors' in result
			assert 'variables' in result
			assert result['is_valid'] == True  # Sample template should be valid
	
	def test_sample_data_generation(self, app):
		"""Test sample data generation for different categories."""
		from app.services.template_service import TemplateService
		
		service = TemplateService()
		
		# Test different categories
		rfp_data = service.get_sample_data('rfp_response')
		proposal_data = service.get_sample_data('proposal')
		contract_data = service.get_sample_data('contract')
		
		assert 'client_name' in rfp_data
		assert 'client_name' in proposal_data
		assert 'party_a' in contract_data
		
		# Each category should have appropriate fields
		assert 'project_title' in rfp_data
		assert 'project_title' in proposal_data
		assert 'contract_date' in contract_data
	
	def test_template_analysis(self, app, sample_template):
		"""Test template structure analysis."""
		from app.services.template_service import TemplateService
		
		with app.app_context():
			service = TemplateService()
			analysis = service.analyze_template_structure(sample_template)
			
			assert 'character_count' in analysis
			assert 'variable_count' in analysis
			assert 'complexity_score' in analysis
			assert 'complexity_level' in analysis
			
			assert analysis['character_count'] > 0
			assert analysis['variable_count'] >= 1  # Has client_name variable
	
	def test_template_export(self, app, sample_template):
		"""Test template export functionality."""
		from app.services.template_service import TemplateService
		
		with app.app_context():
			service = TemplateService()
			export_data = service.export_template(sample_template)
			
			assert 'format_version' in export_data
			assert 'template' in export_data
			
			template_data = export_data['template']
			assert 'name' in template_data
			assert 'content' in template_data
			assert 'variables' in template_data
			assert template_data['name'] == sample_template.name
	
	def test_template_import(self, app):
		"""Test template import functionality."""
		from app.services.template_service import TemplateService
		
		with app.app_context():
			service = TemplateService()
			
			import_data = {
				'format_version': '1.0',
				'template': {
					'name': 'Imported Template',
					'description': 'A template imported for testing',
					'category': 'proposal',
					'content': 'Hello {{client}}, welcome to {{company}}!',
					'version': '1.0'
				}
			}
			
			template = service.import_template(import_data)
			
			assert template.name == 'Imported Template'
			assert template.template_content == 'Hello {{client}}, welcome to {{company}}!'
			assert template.category == 'proposal'
	
	def test_improvement_suggestions(self, app, sample_template):
		"""Test template improvement suggestions."""
		from app.services.template_service import TemplateService
		
		with app.app_context():
			service = TemplateService()
			suggestions = service.suggest_improvements(sample_template)
			
			assert isinstance(suggestions, list)
			# Suggestions may be empty for a well-formed template
			
			for suggestion in suggestions:
				assert 'type' in suggestion
				assert 'priority' in suggestion
				assert 'message' in suggestion
	
	def test_invalid_template_handling(self, app):
		"""Test handling of invalid templates."""
		from app.services.template_service import TemplateService
		
		service = TemplateService()
		
		# Test template with syntax error
		invalid_content = "Hello {{client_name, this is broken"
		
		with pytest.raises(ValueError):
			service.render_template(invalid_content, {'client_name': 'Test'})
	
	def test_empty_template_handling(self, app):
		"""Test handling of empty templates."""
		from app.services.template_service import TemplateService
		
		service = TemplateService()
		
		# Test empty template
		result = service.render_template('', {})
		assert result == ''
		
		variables = service.extract_variables('')
		assert variables == []