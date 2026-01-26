"""
Custom Security Manager for DocuFusion
"""

from flask_appbuilder.security.sqla.manager import SecurityManager
from flask_appbuilder.security.views import UserDBModelView
from flask_appbuilder import expose
from flask import request, jsonify, session
from flask_login import current_user
import logging

log = logging.getLogger(__name__)


class DocuFusionSecurityManager(SecurityManager):
	"""
	Custom security manager for DocuFusion with enhanced features.
	"""
	
	def __init__(self, appbuilder):
		super().__init__(appbuilder)
		
		# Custom permissions for DocuFusion
		self.docufusion_permissions = [
			'can_create_documents',
			'can_edit_documents', 
			'can_delete_documents',
			'can_view_documents',
			'can_share_documents',
			'can_manage_templates',
			'can_use_ai_features',
			'can_access_workflow',
			'can_collaborate',
			'can_manage_compliance',
			'can_view_analytics',
			'can_export_documents',
		]
	
	def create_db(self):
		"""Create database and default roles/permissions."""
		super().create_db()
		self._create_docufusion_permissions()
		self._create_docufusion_roles()
	
	def _create_docufusion_permissions(self):
		"""Create DocuFusion-specific permissions."""
		for permission in self.docufusion_permissions:
			if not self.find_permission(permission):
				self.add_permission(permission)
				log.info(f"Created permission: {permission}")
	
	def _create_docufusion_roles(self):
		"""Create DocuFusion-specific roles with appropriate permissions."""
		
		# Document Viewer Role
		viewer_role = self.find_role('DocumentViewer')
		if not viewer_role:
			viewer_role = self.add_role('DocumentViewer')
			viewer_perms = [
				'can_view_documents',
				'can_export_documents',
			]
			for perm_name in viewer_perms:
				perm = self.find_permission(perm_name)
				if perm:
					self.add_permission_role(viewer_role, perm)
		
		# Document Editor Role
		editor_role = self.find_role('DocumentEditor')
		if not editor_role:
			editor_role = self.add_role('DocumentEditor')
			editor_perms = [
				'can_view_documents',
				'can_create_documents',
				'can_edit_documents',
				'can_export_documents',
				'can_collaborate',
				'can_use_ai_features',
			]
			for perm_name in editor_perms:
				perm = self.find_permission(perm_name)
				if perm:
					self.add_permission_role(editor_role, perm)
		
		# Project Manager Role
		manager_role = self.find_role('ProjectManager')
		if not manager_role:
			manager_role = self.add_role('ProjectManager')
			manager_perms = [
				'can_view_documents',
				'can_create_documents',
				'can_edit_documents',
				'can_delete_documents',
				'can_share_documents',
				'can_manage_templates',
				'can_access_workflow',
				'can_collaborate',
				'can_use_ai_features',
				'can_view_analytics',
				'can_export_documents',
			]
			for perm_name in manager_perms:
				perm = self.find_permission(perm_name)
				if perm:
					self.add_permission_role(manager_role, perm)
		
		# Compliance Officer Role
		compliance_role = self.find_role('ComplianceOfficer')
		if not compliance_role:
			compliance_role = self.add_role('ComplianceOfficer')
			compliance_perms = [
				'can_view_documents',
				'can_edit_documents',
				'can_manage_compliance',
				'can_view_analytics',
				'can_export_documents',
			]
			for perm_name in compliance_perms:
				perm = self.find_permission(perm_name)
				if perm:
					self.add_permission_role(compliance_role, perm)
	
	def has_docufusion_permission(self, permission_name: str, user=None) -> bool:
		"""
		Check if user has specific DocuFusion permission.
		
		Args:
			permission_name: Name of the permission to check
			user: User object (uses current_user if None)
		
		Returns:
			True if user has permission, False otherwise
		"""
		if user is None:
			user = current_user
		
		if not user or not user.is_authenticated:
			return False
		
		if user.is_active and hasattr(user, 'roles'):
			for role in user.roles:
				for permission in role.permissions:
					if permission.name == permission_name:
						return True
		
		return False
	
	def get_user_permissions(self, user=None) -> list[str]:
		"""
		Get list of all permissions for a user.
		
		Args:
			user: User object (uses current_user if None)
		
		Returns:
			List of permission names
		"""
		if user is None:
			user = current_user
		
		permissions = []
		if user and user.is_authenticated and hasattr(user, 'roles'):
			for role in user.roles:
				for permission in role.permissions:
					if permission.name not in permissions:
						permissions.append(permission.name)
		
		return permissions


class DocuFusionUserDBModelView(UserDBModelView):
	"""
	Custom User model view with DocuFusion-specific fields and features.
	"""
	
	# Add custom columns to the user list
	list_columns = ['username', 'email', 'first_name', 'last_name', 'active', 'roles']
	
	# Show additional fields in edit form
	show_columns = ['username', 'active', 'first_name', 'last_name', 'email', 'roles']
	
	# Add custom fields to edit form
	edit_columns = ['first_name', 'last_name', 'username', 'active', 'email', 'roles', 'password', 'conf_password']
	
	# Add custom fields to add form
	add_columns = ['first_name', 'last_name', 'username', 'active', 'email', 'roles', 'password', 'conf_password']
	
	@expose('/api/current_user')
	def current_user_api(self):
		"""API endpoint to get current user information."""
		if not current_user.is_authenticated:
			return jsonify({'error': 'Not authenticated'}), 401
		
		# Get user permissions
		security_manager = self.appbuilder.sm
		permissions = []
		if hasattr(security_manager, 'get_user_permissions'):
			permissions = security_manager.get_user_permissions()
		
		return jsonify({
			'id': current_user.id,
			'username': current_user.username,
			'first_name': current_user.first_name,
			'last_name': current_user.last_name,
			'email': current_user.email,
			'is_active': current_user.active,
			'roles': [role.name for role in current_user.roles],
			'permissions': permissions
		})
	
	@expose('/api/permissions')
	def user_permissions_api(self):
		"""API endpoint to get current user permissions."""
		if not current_user.is_authenticated:
			return jsonify({'error': 'Not authenticated'}), 401
		
		security_manager = self.appbuilder.sm
		permissions = []
		if hasattr(security_manager, 'get_user_permissions'):
			permissions = security_manager.get_user_permissions()
		
		return jsonify({'permissions': permissions})