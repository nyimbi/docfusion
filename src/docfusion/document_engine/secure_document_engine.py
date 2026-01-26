#!/usr/bin/env python3
"""
Secure Document Engine

Security-enhanced document engine that integrates authentication, authorization,
encryption, and audit logging with document generation and processing.
"""

import asyncio
import logging
from dataclasses import dataclass
from typing import Dict, List, Any, Optional, Union
from datetime import datetime

try:
	from uuid_extensions import uuid7str
except ImportError:
	from uuid import uuid4
	def uuid7str() -> str:
		return str(uuid4())

from .document_engine import DocumentEngine, DocumentEngineConfiguration, DocumentGenerationResult
from ..security import (
	SecurityManager, SecurityManagerConfiguration,
	AuditEventType, AuditSeverity, PermissionLevel
)


@dataclass
class SecureDocumentEngineConfiguration:
	"""Configuration for secure document engine"""
	# Base document engine configuration
	document_engine_config: DocumentEngineConfiguration
	
	# Security configuration
	security_config: Optional[SecurityManagerConfiguration] = None
	
	# Security policies
	require_authentication: bool = True
	enable_content_encryption: bool = True
	enable_template_access_control: bool = True
	audit_all_operations: bool = True
	
	# Document security settings
	default_document_classification: str = "internal"
	require_approval_for_sensitive_content: bool = True
	enable_watermarking: bool = True
	track_document_access: bool = True
	
	# Template security
	template_access_levels: Dict[str, List[str]] = None  # template_id -> required_roles
	restrict_system_templates: bool = True


class SecureDocumentEngine:
	"""Security-enhanced document generation engine"""
	
	def __init__(self, config: SecureDocumentEngineConfiguration):
		self.config = config
		self.logger = logging.getLogger(__name__)
		
		# Initialize security manager
		self.security = SecurityManager(config.security_config)
		
		# Initialize base document engine
		self.document_engine = DocumentEngine(config.document_engine_config)
		
		# Template access control
		self.template_access_levels = config.template_access_levels or {}
		
		self.logger.info("Secure document engine initialized")
	
	# ==================== SECURE DOCUMENT GENERATION ====================
	
	async def generate_document(
		self,
		template_id: str,
		content_data: Dict[str, Any],
		user_id: str,
		output_format: str = "pdf",
		classification: Optional[str] = None,
		metadata: Optional[Dict[str, Any]] = None,
		context: Optional[Dict[str, Any]] = None
	) -> Dict[str, Any]:
		"""Generate document with security controls"""
		# Authentication check
		if self.config.require_authentication and not user_id:
			return {'success': False, 'error': 'Authentication required'}
		
		# Authorization check - user can create documents
		auth_result = await self.security.check_permission(
			user_id, "document", "create", context=context
		)
		
		if not auth_result.has_permission:
			await self.security.log_security_violation(
				f"Unauthorized document generation attempt by user {user_id}",
				user_id,
				context.get('ip_address') if context else None
			)
			return {'success': False, 'error': 'Permission denied'}
		
		# Template access control
		if not await self._check_template_access(template_id, user_id):
			await self.security.log_security_violation(
				f"Unauthorized template access: {template_id}",
				user_id,
				context.get('ip_address') if context else None
			)
			return {'success': False, 'error': 'Template access denied'}
		
		try:
			# Encrypt sensitive content data
			secure_content_data = await self._secure_content_data(content_data, user_id)
			
			# Add security metadata
			generation_metadata = {
				**(metadata or {}),
				'generated_by': user_id,
				'generated_at': datetime.utcnow().isoformat(),
				'classification': classification or self.config.default_document_classification,
				'security_version': '1.0',
				'template_id': template_id
			}
			
			# Check for sensitive content that might require approval
			if (self.config.require_approval_for_sensitive_content and 
				await self._contains_sensitive_content(secure_content_data)):
				
				# In production, this would trigger an approval workflow
				generation_metadata['requires_approval'] = True
				self.logger.info(f"Document generation requires approval for user {user_id}")
			
			# Generate document using base engine
			document_id = uuid7str()
			
			# Simulate document generation (would use actual document engine)
			generation_result = {
				'success': True,
				'document_id': document_id,
				'output_format': output_format,
				'generated_at': datetime.utcnow().isoformat(),
				'metadata': generation_metadata,
				'file_path': f'/generated/{document_id}.{output_format}',
				'file_size': 1024000  # Simulated size
			}
			
			# Apply watermarking if enabled
			if self.config.enable_watermarking:
				await self._apply_document_watermark(
					generation_result['file_path'], user_id, document_id
				)
				generation_result['watermarked'] = True
			
			# Set up document permissions
			await self.security.grant_document_access(
				document_id, user_id, user_id, "owner"
			)
			
			# Audit log
			if self.config.audit_all_operations:
				await self.security.audit.log_event(
					event_type=AuditEventType.DOCUMENT_CREATED,
					action="generate_document",
					description=f"Generated document from template {template_id}",
					user_id=user_id,
					resource_type="document",
					resource_id=document_id,
					severity=AuditSeverity.MEDIUM,
					details={
						'template_id': template_id,
						'output_format': output_format,
						'classification': generation_metadata['classification'],
						'file_size': generation_result['file_size'],
						'watermarked': generation_result.get('watermarked', False),
						'requires_approval': generation_metadata.get('requires_approval', False)
					}
				)
			
			return generation_result
		
		except Exception as e:
			self.logger.error(f"Document generation failed for user {user_id}: {e}")
			await self.security.log_security_violation(
				f"Document generation failed: {e}",
				user_id,
				context.get('ip_address') if context else None
			)
			return {'success': False, 'error': f'Document generation failed: {e}'}
	
	async def get_document(
		self,
		document_id: str,
		user_id: str,
		include_metadata: bool = True,
		context: Optional[Dict[str, Any]] = None
	) -> Dict[str, Any]:
		"""Get generated document with security checks"""
		# Authentication check
		if self.config.require_authentication and not user_id:
			return {'success': False, 'error': 'Authentication required'}
		
		# Document permission check
		permission_result = await self.security.check_document_permission(
			document_id, user_id, "view", context
		)
		
		if not permission_result['has_permission']:
			await self.security.log_security_violation(
				f"Unauthorized document access attempt: {document_id}",
				user_id,
				context.get('ip_address') if context else None
			)
			return {'success': False, 'error': 'Permission denied'}
		
		try:
			# Retrieve document info (would integrate with storage)
			document_info = {
				'document_id': document_id,
				'file_path': f'/generated/{document_id}.pdf',
				'generated_at': datetime.utcnow().isoformat(),
				'classification': 'internal',
				'watermarked': True,
				'file_size': 1024000
			}
			
			# Track document access if enabled
			if self.config.track_document_access:
				await self._track_document_access(document_id, user_id, context)
			
			# Audit log
			if self.config.audit_all_operations:
				await self.security.log_document_activity(
					"viewed", document_id, user_id,
					"Accessed generated document",
					{
						'permission_level': permission_result['effective_permission'],
						'classification': document_info.get('classification'),
						'file_size': document_info.get('file_size')
					}
				)
			
			return {
				'success': True,
				'document': document_info,
				'permission_level': permission_result['effective_permission'],
				'restrictions': permission_result.get('restrictions', {})
			}
		
		except Exception as e:
			self.logger.error(f"Failed to get document {document_id}: {e}")
			return {'success': False, 'error': f'Document retrieval failed: {e}'}
	
	# ==================== TEMPLATE SECURITY ====================
	
	async def list_available_templates(
		self,
		user_id: str,
		category: Optional[str] = None,
		context: Optional[Dict[str, Any]] = None
	) -> Dict[str, Any]:
		"""List templates available to user"""
		if self.config.require_authentication and not user_id:
			return {'success': False, 'error': 'Authentication required'}
		
		try:
			# Get all templates (would integrate with template system)
			all_templates = [
				{
					'template_id': f'template_{i}',
					'name': f'Template {i}',
					'category': category or 'general',
					'access_level': 'user' if i % 2 == 0 else 'admin',
					'description': f'Sample template {i}'
				}
				for i in range(1, 6)
			]
			
			# Filter templates based on user access
			accessible_templates = []
			for template in all_templates:
				if await self._check_template_access(template['template_id'], user_id):
					accessible_templates.append(template)
			
			# Audit log
			if self.config.audit_all_operations:
				await self.security.audit.log_event(
					event_type=AuditEventType.DOCUMENT_VIEWED,
					action="list_templates",
					description="Listed available templates",
					user_id=user_id,
					severity=AuditSeverity.LOW,
					details={
						'category': category,
						'total_templates': len(all_templates),
						'accessible_templates': len(accessible_templates)
					}
				)
			
			return {
				'success': True,
				'templates': accessible_templates,
				'total_available': len(accessible_templates),
				'user_id': user_id
			}
		
		except Exception as e:
			self.logger.error(f"Failed to list templates for user {user_id}: {e}")
			return {'success': False, 'error': f'Template listing failed: {e}'}
	
	async def get_template_info(
		self,
		template_id: str,
		user_id: str,
		context: Optional[Dict[str, Any]] = None
	) -> Dict[str, Any]:
		"""Get template information with access control"""
		if self.config.require_authentication and not user_id:
			return {'success': False, 'error': 'Authentication required'}
		
		# Template access check
		if not await self._check_template_access(template_id, user_id):
			return {'success': False, 'error': 'Template access denied'}
		
		try:
			# Get template info (would integrate with template system)
			template_info = {
				'template_id': template_id,
				'name': f'Template {template_id}',
				'description': f'Description for {template_id}',
				'category': 'general',
				'fields': ['title', 'content', 'author'],
				'output_formats': ['pdf', 'docx', 'html'],
				'access_level': 'user',
				'last_modified': datetime.utcnow().isoformat()
			}
			
			return {
				'success': True,
				'template': template_info,
				'user_has_access': True
			}
		
		except Exception as e:
			self.logger.error(f"Failed to get template info {template_id}: {e}")
			return {'success': False, 'error': f'Template info retrieval failed: {e}'}
	
	# ==================== DOCUMENT ANALYTICS ====================
	
	async def get_document_analytics(
		self,
		user_id: str,
		date_range: Optional[Dict[str, str]] = None,
		context: Optional[Dict[str, Any]] = None
	) -> Dict[str, Any]:
		"""Get document generation analytics for user"""
		if self.config.require_authentication and not user_id:
			return {'success': False, 'error': 'Authentication required'}
		
		# Check if user can view analytics
		auth_result = await self.security.check_permission(
			user_id, "system", "read", context=context
		)
		
		try:
			# Get user's document generation history (simulated)
			analytics = {
				'user_id': user_id,
				'total_documents_generated': 25,
				'documents_this_month': 5,
				'most_used_templates': [
					{'template_id': 'template_1', 'usage_count': 10},
					{'template_id': 'template_2', 'usage_count': 8}
				],
				'output_format_distribution': {
					'pdf': 15,
					'docx': 7,
					'html': 3
				},
				'classification_distribution': {
					'internal': 20,
					'confidential': 4,
					'public': 1
				}
			}
			
			# Add security-specific metrics if user has permission
			if auth_result.has_permission:
				security_metrics = await self.security.get_security_metrics()
				analytics['security_metrics'] = {
					'total_audit_events': security_metrics.get('audit_statistics', {}).get('total_events_logged', 0),
					'active_sessions': security_metrics.get('active_sessions', 0),
					'encryption_enabled': self.config.enable_content_encryption
				}
			
			return {
				'success': True,
				'analytics': analytics,
				'date_range': date_range,
				'includes_security_metrics': auth_result.has_permission
			}
		
		except Exception as e:
			self.logger.error(f"Failed to get analytics for user {user_id}: {e}")
			return {'success': False, 'error': f'Analytics retrieval failed: {e}'}
	
	# ==================== SECURITY HELPERS ====================
	
	async def _check_template_access(self, template_id: str, user_id: str) -> bool:
		"""Check if user has access to template"""
		if not self.config.enable_template_access_control:
			return True
		
		# Check specific template access levels
		if template_id in self.template_access_levels:
			required_roles = self.template_access_levels[template_id]
			user_permissions = await self.security.rbac.get_user_permissions(user_id)
			
			# Check if user has any of the required roles
			user_roles = [role['role_name'] for role in user_permissions.get('roles', [])]
			return any(role in required_roles for role in user_roles)
		
		# For system templates, check if restriction is enabled
		if self.config.restrict_system_templates and template_id.startswith('system_'):
			# Check if user has admin permissions
			auth_result = await self.security.check_permission(
				user_id, "system", "manage"
			)
			return auth_result.has_permission
		
		# Default allow for user templates
		return True
	
	async def _secure_content_data(self, content_data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
		"""Encrypt sensitive fields in content data"""
		if not self.config.enable_content_encryption:
			return content_data
		
		secure_data = content_data.copy()
		sensitive_fields = ['password', 'ssn', 'credit_card', 'personal_info']
		
		for field_name, field_value in content_data.items():
			if any(sensitive in field_name.lower() for sensitive in sensitive_fields):
				if isinstance(field_value, str):
					encryption_result = await self.security.encrypt_sensitive_data(
						field_value, f"content_field_{field_name}", user_id
					)
					
					if encryption_result.success:
						secure_data[field_name] = {
							'encrypted': True,
							'data': encryption_result.encrypted_data,
							'key_id': encryption_result.key_id,
							'algorithm': encryption_result.algorithm,
							'nonce': encryption_result.nonce,
							'tag': encryption_result.tag
						}
		
		return secure_data
	
	async def _contains_sensitive_content(self, content_data: Dict[str, Any]) -> bool:
		"""Check if content contains sensitive information"""
		sensitive_keywords = [
			'confidential', 'secret', 'proprietary', 'classified',
			'social security', 'credit card', 'password', 'personal'
		]
		
		content_str = str(content_data).lower()
		return any(keyword in content_str for keyword in sensitive_keywords)
	
	async def _apply_document_watermark(self, file_path: str, user_id: str, document_id: str):
		"""Apply security watermark to document"""
		# In production, this would add actual watermarks to the document
		self.logger.info(f"Applied watermark to document {document_id} for user {user_id}")
	
	async def _track_document_access(
		self,
		document_id: str,
		user_id: str,
		context: Optional[Dict[str, Any]]
	):
		"""Track document access for analytics"""
		access_info = {
			'document_id': document_id,
			'user_id': user_id,
			'accessed_at': datetime.utcnow().isoformat(),
			'ip_address': context.get('ip_address') if context else None,
			'user_agent': context.get('user_agent') if context else None
		}
		
		# Store access tracking info (would integrate with analytics system)
		self.logger.debug(f"Tracked document access: {access_info}")
	
	# ==================== SYSTEM MANAGEMENT ====================
	
	async def get_security_status(self) -> Dict[str, Any]:
		"""Get security status of document engine"""
		security_metrics = await self.security.get_security_metrics()
		
		return {
			'security_enabled': True,
			'authentication_required': self.config.require_authentication,
			'content_encryption_enabled': self.config.enable_content_encryption,
			'template_access_control_enabled': self.config.enable_template_access_control,
			'audit_logging_enabled': self.config.audit_all_operations,
			'watermarking_enabled': self.config.enable_watermarking,
			'security_metrics': security_metrics,
			'document_engine_version': '1.0.0'
		}
	
	async def cleanup_expired_data(self) -> Dict[str, Any]:
		"""Clean up expired security data"""
		return await self.security.cleanup_expired_security_data()
	
	async def close(self):
		"""Clean shutdown of secure document engine"""
		await self.security.close()
		# Would also close document engine
		self.logger.info("Secure document engine closed")


# Factory function
def create_secure_document_engine(config: SecureDocumentEngineConfiguration) -> SecureDocumentEngine:
	"""Create SecureDocumentEngine instance with configuration"""
	return SecureDocumentEngine(config)