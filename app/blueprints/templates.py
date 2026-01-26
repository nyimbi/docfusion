"""
Template management views and APIs for DocuFusion Flask-AppBuilder.
"""

from flask import request, jsonify, redirect, url_for, flash
from flask_appbuilder import ModelView, BaseView, expose, has_access
from flask_appbuilder.api import BaseApi, expose as api_expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import protect
from flask_login import current_user
from wtforms import TextAreaField, SelectField, BooleanField
from wtforms.validators import DataRequired, Length
import json

from ..models import Template, Document
from ..services.template_service import TemplateService


class TemplateModelView(ModelView):
	"""
	Template management view for creating and managing document templates.
	"""
	
	datamodel = SQLAInterface(Template)
	
	# List view configuration
	list_columns = ['name', 'category', 'version', 'is_active', 'is_public', 'created_on']
	list_title = "Document Templates"
	
	# Show view configuration
	show_columns = [
		'name', 'description', 'category', 'version', 'is_active', 'is_public',
		'template_content', 'created_on', 'created_by', 'changed_on', 'changed_by'
	]
	show_title = "Template Details"
	
	# Add/Edit form configuration
	add_columns = ['name', 'description', 'category', 'template_content', 'is_active', 'is_public']
	edit_columns = ['name', 'description', 'category', 'template_content', 'version', 'is_active', 'is_public']
	
	# Form field customization
	add_form_extra_fields = {
		'template_content': TextAreaField(
			'Template Content',
			validators=[Length(max=100000)],
			render_kw={"rows": 25, "class": "form-control", "placeholder": "Enter template content with placeholders like {{client_name}}, {{project_title}}, etc."}
		),
		'category': SelectField(
			'Category',
			choices=[
				('rfp_response', 'RFP Response'),
				('proposal', 'Proposal'),
				('contract', 'Contract'),
				('report', 'Report'),
				('presentation', 'Presentation'),
				('technical_doc', 'Technical Document'),
				('compliance', 'Compliance Document'),
				('other', 'Other')
			],
			validators=[DataRequired()]
		),
		'is_active': BooleanField('Active'),
		'is_public': BooleanField('Public Template')
	}
	
	edit_form_extra_fields = add_form_extra_fields.copy()
	
	# Search configuration
	search_columns = ['name', 'description', 'category']
	
	# Permissions
	base_permissions = ['can_list', 'can_show', 'can_add', 'can_edit', 'can_delete']
	
	def __init__(self):
		super().__init__()
		self.template_service = TemplateService()
	
	@expose('/preview/<int:pk>')
	@has_access
	def preview_template(self, pk):
		"""Preview template with sample data."""
		template = self.datamodel.get(pk)
		if not template:
			flash('Template not found', 'error')
			return redirect(url_for('TemplateModelView.list'))
		
		try:
			# Generate preview with sample data
			sample_data = self.template_service.get_sample_data(template.category)
			preview_content = self.template_service.render_template(
				template.template_content,
				sample_data
			)
			
			return self.render_template(
				'templates/preview.html',
				template=template,
				preview_content=preview_content,
				sample_data=sample_data
			)
			
		except Exception as e:
			flash(f'Error generating preview: {str(e)}', 'error')
			return redirect(url_for('TemplateModelView.show', pk=pk))
	
	@expose('/create_document/<int:pk>')
	@has_access
	def create_document_from_template(self, pk):
		"""Create a new document from this template."""
		template = self.datamodel.get(pk)
		if not template:
			flash('Template not found', 'error')
			return redirect(url_for('TemplateModelView.list'))
		
		# Check permissions
		if not self.appbuilder.sm.has_docufusion_permission('can_create_documents'):
			flash('You do not have permission to create documents', 'error')
			return redirect(url_for('TemplateModelView.show', pk=pk))
		
		try:
			# Create new document from template
			new_document = Document(
				title=f"New {template.category} from {template.name}",
				description=f"Document created from template: {template.name}",
				content=template.template_content,
				document_type=template.category,
				template_id=template.id,
				status='draft',
				version='1.0'
			)
			
			# Use DocumentModelView's datamodel to add the document
			from .documents import DocumentModelView
			doc_view = DocumentModelView()
			doc_view.datamodel.add(new_document)
			
			flash(f'Document created from template "{template.name}"', 'success')
			return redirect(url_for('DocumentModelView.edit', pk=new_document.id))
			
		except Exception as e:
			flash(f'Error creating document: {str(e)}', 'error')
			return redirect(url_for('TemplateModelView.show', pk=pk))
	
	@expose('/clone/<int:pk>')
	@has_access
	def clone_template(self, pk):
		"""Create a copy of an existing template."""
		original = self.datamodel.get(pk)
		if not original:
			flash('Template not found', 'error')
			return redirect(url_for('TemplateModelView.list'))
		
		try:
			# Create new template based on original
			new_template = Template(
				name=f"Copy of {original.name}",
				description=original.description,
				category=original.category,
				template_content=original.template_content,
				template_structure=original.template_structure,
				is_active=True,
				is_public=False,
				version='1.0'
			)
			
			self.datamodel.add(new_template)
			flash(f'Template cloned successfully', 'success')
			return redirect(url_for('TemplateModelView.edit', pk=new_template.id))
			
		except Exception as e:
			flash(f'Error cloning template: {str(e)}', 'error')
			return redirect(url_for('TemplateModelView.show', pk=pk))
	
	@expose('/export/<int:pk>')
	@has_access
	def export_template(self, pk):
		"""Export template as JSON for sharing."""
		template = self.datamodel.get(pk)
		if not template:
			flash('Template not found', 'error')
			return redirect(url_for('TemplateModelView.list'))
		
		try:
			export_data = self.template_service.export_template(template)
			
			from flask import Response
			return Response(
				json.dumps(export_data, indent=2),
				mimetype='application/json',
				headers={
					'Content-Disposition': f'attachment; filename=template_{template.name.replace(" ", "_")}.json'
				}
			)
			
		except Exception as e:
			flash(f'Error exporting template: {str(e)}', 'error')
			return redirect(url_for('TemplateModelView.show', pk=pk))
	
	@expose('/validate/<int:pk>')
	@has_access
	def validate_template(self, pk):
		"""Validate template syntax and structure."""
		template = self.datamodel.get(pk)
		if not template:
			flash('Template not found', 'error')
			return redirect(url_for('TemplateModelView.list'))
		
		try:
			validation_result = self.template_service.validate_template(template)
			
			if validation_result['is_valid']:
				flash('Template validation passed successfully', 'success')
			else:
				flash(f'Template validation failed: {"; ".join(validation_result["errors"])}', 'error')
			
			return self.render_template(
				'templates/validation_result.html',
				template=template,
				validation_result=validation_result
			)
			
		except Exception as e:
			flash(f'Error validating template: {str(e)}', 'error')
			return redirect(url_for('TemplateModelView.show', pk=pk))
	
	def pre_add(self, item):
		"""Pre-processing before adding a new template."""
		# Set default values
		if not item.template_id:
			import uuid
			item.template_id = str(uuid.uuid4())
		
		if not item.version:
			item.version = '1.0'
		
		if item.is_active is None:
			item.is_active = True
		
		if item.is_public is None:
			item.is_public = False
	
	def post_add(self, item):
		"""Post-processing after adding a new template."""
		# Validate template structure
		try:
			self.template_service.analyze_template_structure(item)
		except Exception as e:
			self.appbuilder.get_app.logger.error(f"Template structure analysis failed: {e}")
	
	def pre_edit(self, item):
		"""Pre-processing before editing a template."""
		# Update version if content changed
		if item.template_content and hasattr(item, '_original_content'):
			if item.template_content != item._original_content:
				# Increment version number
				version_parts = item.version.split('.')
				if len(version_parts) >= 2:
					try:
						minor_version = int(version_parts[1]) + 1
						item.version = f"{version_parts[0]}.{minor_version}"
					except (ValueError, IndexError):
						pass


class TemplateApi(BaseApi):
	"""
	REST API for template operations.
	"""
	
	resource_name = 'templates'
	datamodel = SQLAInterface(Template)
	
	def __init__(self):
		super().__init__()
		self.template_service = TemplateService()
	
	@api_expose('/render/<int:pk>', methods=['POST'])
	@protect()
	def render_template(self, pk):
		"""Render template with provided data."""
		template = self.datamodel.get(pk)
		if not template:
			return {'error': 'Template not found'}, 404
		
		data = request.get_json()
		template_data = data.get('data', {})
		
		try:
			rendered_content = self.template_service.render_template(
				template.template_content,
				template_data
			)
			
			return {
				'rendered_content': rendered_content,
				'template_id': template.id,
				'template_name': template.name
			}
			
		except Exception as e:
			return {'error': f'Rendering failed: {str(e)}'}, 500
	
	@api_expose('/variables/<int:pk>', methods=['GET'])
	@protect()
	def get_template_variables(self, pk):
		"""Get list of variables used in template."""
		template = self.datamodel.get(pk)
		if not template:
			return {'error': 'Template not found'}, 404
		
		try:
			variables = self.template_service.extract_variables(template.template_content)
			
			return {
				'variables': variables,
				'template_id': template.id,
				'template_name': template.name
			}
			
		except Exception as e:
			return {'error': f'Variable extraction failed: {str(e)}'}, 500
	
	@api_expose('/validate/<int:pk>', methods=['POST'])
	@protect()
	def validate_template_api(self, pk):
		"""Validate template via API."""
		template = self.datamodel.get(pk)
		if not template:
			return {'error': 'Template not found'}, 404
		
		try:
			validation_result = self.template_service.validate_template(template)
			return validation_result
			
		except Exception as e:
			return {'error': f'Validation failed: {str(e)}'}, 500
	
	@api_expose('/search', methods=['GET'])
	@protect()
	def search_templates(self):
		"""Search templates with filters."""
		query = request.args.get('q', '')
		category = request.args.get('category')
		is_public = request.args.get('is_public')
		
		# Build base query
		search_query = self.datamodel.session.query(Template)
		
		# Apply filters
		if query:
			search_query = search_query.filter(
				Template.name.contains(query) |
				Template.description.contains(query)
			)
		
		if category:
			search_query = search_query.filter(Template.category == category)
		
		if is_public is not None:
			is_public_bool = is_public.lower() in ['true', '1', 'yes']
			search_query = search_query.filter(Template.is_public == is_public_bool)
		
		# Only show active templates by default
		search_query = search_query.filter(Template.is_active == True)
		
		# Execute query
		templates = search_query.limit(50).all()
		
		return {
			'templates': [
				{
					'id': t.id,
					'name': t.name,
					'description': t.description,
					'category': t.category,
					'version': t.version,
					'is_public': t.is_public,
					'created_on': t.created_on.isoformat() if t.created_on else None
				}
				for t in templates
			],
			'count': len(templates)
		}
	
	@api_expose('/import', methods=['POST'])
	@protect()
	def import_template(self):
		"""Import template from JSON data."""
		data = request.get_json()
		
		if not data:
			return {'error': 'No data provided'}, 400
		
		try:
			template = self.template_service.import_template(data)
			return {
				'message': 'Template imported successfully',
				'template_id': template.id,
				'template_name': template.name
			}
			
		except Exception as e:
			return {'error': f'Import failed: {str(e)}'}, 500