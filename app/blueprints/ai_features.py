"""
AI Features views and APIs for DocuFusion Flask-AppBuilder.
"""

from flask import request, jsonify
from flask_appbuilder import BaseView, expose, has_access
from flask_appbuilder.api import BaseApi, expose as api_expose
from flask_appbuilder.security.decorators import protect
from flask_login import current_user

from ..services.ai_service import AIService


class AIFeaturesView(BaseView):
	"""AI features management view."""
	
	default_view = 'ai_features'
	
	def __init__(self):
		super().__init__()
		self.ai_service = AIService()
	
	@expose('/')
	@has_access
	def ai_features(self):
		"""Main AI features page."""
		return self.render_template('ai_features/main.html')


class AIFeaturesApi(BaseApi):
	"""REST API for AI features."""
	
	resource_name = 'ai_features'
	
	def __init__(self):
		super().__init__()
		self.ai_service = AIService()
	
	@api_expose('/enhance_content', methods=['POST'])
	@protect()
	def enhance_content(self):
		"""Enhance content using AI."""
		data = request.get_json()
		content = data.get('content', '')
		document_type = data.get('document_type', 'proposal')
		
		try:
			enhancements = self.ai_service.enhance_content(content, document_type)
			return enhancements
		except Exception as e:
			return {'error': f'Enhancement failed: {str(e)}'}, 500