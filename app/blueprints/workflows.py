"""
Workflow management views and APIs for DocuFusion Flask-AppBuilder.
"""

from flask import request, jsonify
from flask_appbuilder import BaseView, expose, has_access
from flask_appbuilder.api import BaseApi, expose as api_expose
from flask_appbuilder.security.decorators import protect
from flask_login import current_user

from ..models import WorkflowInstance


class WorkflowView(BaseView):
	"""Workflow management view."""
	
	default_view = 'workflows'
	
	@expose('/')
	@has_access
	def workflows(self):
		"""Main workflows page."""
		return self.render_template('workflows/main.html')


class WorkflowApi(BaseApi):
	"""REST API for workflow operations."""
	
	resource_name = 'workflows'
	
	@api_expose('/instances', methods=['GET'])
	@protect()
	def list_instances(self):
		"""List workflow instances."""
		return {'instances': []}