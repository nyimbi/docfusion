"""
Document management views and APIs for DocuFusion Flask-AppBuilder.
"""

from flask import request, jsonify, redirect, url_for, flash, send_file
from flask_appbuilder import ModelView, BaseView, expose, has_access
from flask_appbuilder.api import BaseApi, expose as api_expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import protect
from flask_login import current_user
from wtforms import TextAreaField, SelectField, FileField
from wtforms.validators import DataRequired, Length
from werkzeug.utils import secure_filename
import json
import os
import tempfile
from datetime import datetime

from ..models import Document, Template, Project
from ..services.document_service import DocumentService
from ..services.ai_service import AIService


class DocumentModelView(ModelView):
	"""
	Document management view with enhanced features for document creation,
	editing, collaboration, and AI assistance.
	"""
	
	datamodel = SQLAInterface(Document)
	
	# List view configuration
	list_columns = ['title', 'document_type', 'status', 'version', 'created_on', 'created_by']
	list_title = "Documents"
	
	# Show view configuration
	show_columns = [
		'title', 'description', 'document_type', 'status', 'version',
		'template', 'project', 'voice_dna_score', 'quality_score',
		'created_on', 'created_by', 'changed_on', 'changed_by'
	]
	show_title = "Document Details"
	
	# Add/Edit form configuration
	add_columns = ['title', 'description', 'document_type', 'template', 'project', 'content']
	edit_columns = ['title', 'description', 'document_type', 'status', 'template', 'project', 'content']
	
	# Form field customization
	add_form_extra_fields = {
		'content': TextAreaField(
			'Content',
			validators=[Length(max=50000)],
			render_kw={"rows": 20, "class": "form-control"}
		),
		'document_type': SelectField(
			'Document Type',
			choices=[
				('proposal', 'Proposal'),
				('rfp_response', 'RFP Response'), 
				('template', 'Template'),
				('report', 'Report'),
				('presentation', 'Presentation'),
				('contract', 'Contract'),
				('other', 'Other')
			],
			validators=[DataRequired()]
		)
	}
	
	edit_form_extra_fields = add_form_extra_fields.copy()
	edit_form_extra_fields['status'] = SelectField(
		'Status',
		choices=[
			('draft', 'Draft'),
			('in_review', 'In Review'),
			('approved', 'Approved'),
			('published', 'Published'),
			('archived', 'Archived')
		]
	)
	
	# Search configuration
	search_columns = ['title', 'description', 'document_type', 'status']
	
	# Permissions
	base_permissions = ['can_list', 'can_show', 'can_add', 'can_edit', 'can_delete']
	
	def __init__(self):
		super().__init__()
		self.document_service = DocumentService()
		self.ai_service = AIService()
	
	@expose('/generate/<int:pk>')
	@has_access
	def generate_document(self, pk):
		"""Generate document in various formats (PDF, DOCX, HTML)."""
		document = self.datamodel.get(pk)
		if not document:
			flash('Document not found', 'error')
			return redirect(url_for('DocumentModelView.list'))
		
		try:
			# Generate all formats
			pdf_path = self.document_service.generate_pdf(document)
			docx_path = self.document_service.generate_docx(document)
			html_path = self.document_service.generate_html(document)
			
			# Update document with generated file paths
			document.generated_pdf = pdf_path
			document.generated_docx = docx_path  
			document.generated_html = html_path
			self.datamodel.edit(document)
			
			flash('Document generated successfully in all formats', 'success')
			
		except Exception as e:
			flash(f'Error generating document: {str(e)}', 'error')
		
		return redirect(url_for('DocumentModelView.show', pk=pk))
	
	@expose('/ai_enhance/<int:pk>')
	@has_access
	def ai_enhance(self, pk):
		"""Use AI to enhance document content."""
		document = self.datamodel.get(pk)
		if not document:
			flash('Document not found', 'error')
			return redirect(url_for('DocumentModelView.list'))
		
		try:
			# Get AI enhancement suggestions
			enhancements = self.ai_service.enhance_content(
				document.content,
				document.document_type
			)
			
			# Store enhancements in session for review
			session_key = f'ai_enhancements_{pk}'
			request.environ.get('werkzeug.request').session[session_key] = enhancements
			
			flash('AI enhancements generated. Review and apply as needed.', 'info')
			
		except Exception as e:
			flash(f'Error generating AI enhancements: {str(e)}', 'error')
		
		return redirect(url_for('DocumentModelView.show', pk=pk))
	
	@expose('/collaborate/<int:pk>')
	@has_access
	def collaborate(self, pk):
		"""Open document in collaboration mode."""
		document = self.datamodel.get(pk)
		if not document:
			flash('Document not found', 'error')
			return redirect(url_for('DocumentModelView.list'))
		
		# Check collaboration permissions
		if not self.appbuilder.sm.has_docufusion_permission('can_collaborate'):
			flash('You do not have permission to collaborate on documents', 'error')
			return redirect(url_for('DocumentModelView.show', pk=pk))
		
		return self.render_template(
			'documents/collaborate.html',
			document=document,
			pk=pk
		)
	
	@expose('/download/<int:pk>/<format>')
	@has_access
	def download(self, pk, format):
		"""Download document in specified format."""
		document = self.datamodel.get(pk)
		if not document:
			flash('Document not found', 'error')
			return redirect(url_for('DocumentModelView.list'))
		
		file_path = None
		filename = f"{document.title}_{document.version}"
		
		if format == 'pdf' and document.generated_pdf:
			file_path = document.generated_pdf
			filename += '.pdf'
		elif format == 'docx' and document.generated_docx:
			file_path = document.generated_docx
			filename += '.docx'
		elif format == 'html' and document.generated_html:
			file_path = document.generated_html
			filename += '.html'
		else:
			flash(f'Format {format} not available for this document', 'error')
			return redirect(url_for('DocumentModelView.show', pk=pk))
		
		try:
			return send_file(
				file_path,
				as_attachment=True,
				download_name=secure_filename(filename)
			)
		except Exception as e:
			flash(f'Error downloading file: {str(e)}', 'error')
			return redirect(url_for('DocumentModelView.show', pk=pk))
	
	@expose('/clone/<int:pk>')
	@has_access
	def clone_document(self, pk):
		"""Create a copy of an existing document."""
		original = self.datamodel.get(pk)
		if not original:
			flash('Document not found', 'error')
			return redirect(url_for('DocumentModelView.list'))
		
		try:
			# Create new document based on original
			new_document = Document(
				title=f"Copy of {original.title}",
				description=original.description,
				content=original.content,
				document_type=original.document_type,
				template_id=original.template_id,
				project_id=original.project_id,
				status='draft',
				version='1.0'
			)
			
			self.datamodel.add(new_document)
			flash(f'Document cloned successfully', 'success')
			return redirect(url_for('DocumentModelView.edit', pk=new_document.id))
			
		except Exception as e:
			flash(f'Error cloning document: {str(e)}', 'error')
			return redirect(url_for('DocumentModelView.show', pk=pk))
	
	def pre_add(self, item):
		"""Pre-processing before adding a new document."""
		# Set default values
		if not item.document_id:
			import uuid
			item.document_id = str(uuid.uuid4())
		
		if not item.version:
			item.version = '1.0'
		
		if not item.status:
			item.status = 'draft'
	
	def post_add(self, item):
		"""Post-processing after adding a new document."""
		# Run initial AI analysis if content exists
		if item.content and self.ai_service:
			try:
				# Analyze voice DNA and quality
				voice_score = self.ai_service.analyze_voice_consistency(item.content)
				quality_score = self.ai_service.analyze_quality(item.content)
				
				item.voice_dna_score = voice_score
				item.quality_score = quality_score
				self.datamodel.edit(item)
				
			except Exception as e:
				# Log error but don't fail the document creation
				self.appbuilder.get_app.logger.error(f"AI analysis failed: {e}")
	
	def post_edit(self, item):
		"""Post-processing after editing a document."""
		# Update AI scores if content changed
		if item.content and self.ai_service:
			try:
				voice_score = self.ai_service.analyze_voice_consistency(item.content)
				quality_score = self.ai_service.analyze_quality(item.content)
				
				item.voice_dna_score = voice_score
				item.quality_score = quality_score
				
			except Exception as e:
				self.appbuilder.get_app.logger.error(f"AI analysis failed: {e}")


class DocumentApi(BaseApi):
	"""
	REST API for document operations.
	"""
	
	resource_name = 'documents'
	datamodel = SQLAInterface(Document)
	
	def __init__(self):
		super().__init__()
		self.document_service = DocumentService()
		self.ai_service = AIService()
	
	@api_expose('/generate/<int:pk>/<format>', methods=['POST'])
	@protect()
	def generate_format(self, pk, format):
		"""Generate document in specific format via API."""
		document = self.datamodel.get(pk)
		if not document:
			return {'error': 'Document not found'}, 404
		
		try:
			if format == 'pdf':
				file_path = self.document_service.generate_pdf(document)
			elif format == 'docx':
				file_path = self.document_service.generate_docx(document)
			elif format == 'html':
				file_path = self.document_service.generate_html(document)
			else:
				return {'error': f'Unsupported format: {format}'}, 400
			
			return {
				'message': f'Document generated in {format} format',
				'file_path': file_path,
				'download_url': url_for('DocumentModelView.download', pk=pk, format=format)
			}
			
		except Exception as e:
			return {'error': f'Generation failed: {str(e)}'}, 500
	
	@api_expose('/ai_analyze/<int:pk>', methods=['POST'])
	@protect()
	def ai_analyze(self, pk):
		"""Run AI analysis on document content."""
		document = self.datamodel.get(pk)
		if not document:
			return {'error': 'Document not found'}, 404
		
		try:
			analysis = self.ai_service.comprehensive_analysis(
				document.content,
				document.document_type
			)
			
			# Update document with analysis results
			document.ai_analysis = analysis
			document.voice_dna_score = analysis.get('voice_score', 0)
			document.quality_score = analysis.get('quality_score', 0)
			self.datamodel.edit(document)
			
			return {
				'message': 'AI analysis completed',
				'analysis': analysis
			}
			
		except Exception as e:
			return {'error': f'AI analysis failed: {str(e)}'}, 500
	
	@api_expose('/bulk_generate', methods=['POST'])
	@protect()
	def bulk_generate(self):
		"""Generate multiple documents in batch."""
		data = request.get_json()
		document_ids = data.get('document_ids', [])
		formats = data.get('formats', ['pdf'])
		
		if not document_ids:
			return {'error': 'No document IDs provided'}, 400
		
		results = []
		for doc_id in document_ids:
			document = self.datamodel.get(doc_id)
			if not document:
				results.append({
					'document_id': doc_id,
					'status': 'error',
					'message': 'Document not found'
				})
				continue
			
			doc_result = {'document_id': doc_id, 'formats': {}}
			
			for format_type in formats:
				try:
					if format_type == 'pdf':
						file_path = self.document_service.generate_pdf(document)
					elif format_type == 'docx':
						file_path = self.document_service.generate_docx(document)
					elif format_type == 'html':
						file_path = self.document_service.generate_html(document)
					else:
						continue
					
					doc_result['formats'][format_type] = {
						'status': 'success',
						'file_path': file_path
					}
					
				except Exception as e:
					doc_result['formats'][format_type] = {
						'status': 'error',
						'message': str(e)
					}
			
			results.append(doc_result)
		
		return {'results': results}
	
	@api_expose('/search', methods=['GET'])
	@protect()
	def search_documents(self):
		"""Advanced document search with filters."""
		query = request.args.get('q', '')
		doc_type = request.args.get('type')
		status = request.args.get('status')
		project_id = request.args.get('project_id')
		
		# Build base query
		search_query = self.datamodel.session.query(Document)
		
		# Apply filters
		if query:
			search_query = search_query.filter(
				Document.title.contains(query) |
				Document.description.contains(query) |
				Document.content.contains(query)
			)
		
		if doc_type:
			search_query = search_query.filter(Document.document_type == doc_type)
		
		if status:
			search_query = search_query.filter(Document.status == status)
		
		if project_id:
			search_query = search_query.filter(Document.project_id == project_id)
		
		# Execute query
		documents = search_query.limit(50).all()
		
		return {
			'documents': [doc.to_dict() for doc in documents],
			'count': len(documents)
		}