#!/usr/bin/env python3
"""
Secure NLP Service

Security-enhanced NLP service that integrates authentication, authorization,
encryption, and audit logging with NLP document analysis and processing.
"""

import asyncio
import logging
from dataclasses import dataclass
from typing import Dict, List, Any, Optional, Union
from datetime import datetime

from .enhanced_nlp_service import EnhancedNLPService, EnhancedNLPServiceConfiguration, EnhancedAnalysisResult
from .nlp_service import NLPService, NLPServiceConfiguration
from ..core.utils import uuid7str
from ..security import (
	SecurityManager, SecurityManagerConfiguration,
	AuditEventType, AuditSeverity, PermissionLevel
)

@dataclass
class SecureNLPServiceConfiguration:
	"""Configuration for secure NLP service"""
	# Base NLP service configuration
	enhanced_nlp_config: Optional[EnhancedNLPServiceConfiguration] = None
	base_nlp_config: Optional[NLPServiceConfiguration] = None
	
	# Security configuration
	security_config: Optional[SecurityManagerConfiguration] = None
	
	# Security policies
	require_authentication: bool = True
	enable_content_encryption: bool = True
	enable_pii_detection: bool = True
	audit_all_operations: bool = True
	
	# Content security settings
	allow_public_analysis: bool = False
	require_content_classification: bool = True
	encrypt_analysis_results: bool = True
	redact_sensitive_content: bool = True
	
	# Processing restrictions
	max_content_size_bytes: int = 10 * 1024 * 1024  # 10MB
	require_approval_for_large_documents: bool = True
	enable_content_filtering: bool = True
	
	# Data retention
	analysis_result_retention_days: int = 90
	audit_log_retention_days: int = 365

class SecureNLPService:
	"""Security-enhanced NLP service"""
	
	def __init__(self, config: SecureNLPServiceConfiguration):
		self.config = config
		self.logger = logging.getLogger(__name__)
		
		# Initialize security manager
		self.security = SecurityManager(config.security_config)
		
		# Initialize NLP services based on configuration
		if config.enhanced_nlp_config:
			self.nlp_service = EnhancedNLPService(config.enhanced_nlp_config)
			self.use_enhanced_service = True
		else:
			self.nlp_service = NLPService(config.base_nlp_config or NLPServiceConfiguration())
			self.use_enhanced_service = False
		
		self.logger.info("Secure NLP service initialized")
	
	# ==================== SECURE ANALYSIS OPERATIONS ====================
	
	async def secure_analyze_document(
		self,
		content: Union[str, bytes],
		user_id: str,
		content_type: Optional[str] = None,
		filename: Optional[str] = None,
		document_id: Optional[str] = None,
		classification: Optional[str] = None,
		include_transformations: bool = False,
		context: Optional[Dict[str, Any]] = None
	) -> Dict[str, Any]:
		"""Analyze document with comprehensive security controls"""
		# Authentication check
		if self.config.require_authentication and not user_id:
			return {'success': False, 'error': 'Authentication required'}
		
		# Authorization check - user can analyze documents
		auth_result = await self.security.check_permission(
			user_id, "nlp", "analyze", context=context
		)
		
		if not auth_result.has_permission:
			await self.security.log_security_violation(
				f"Unauthorized NLP analysis attempt by user {user_id}",
				user_id,
				context.get('ip_address') if context else None
			)
			return {'success': False, 'error': 'Permission denied'}
		
		try:
			# Content size validation
			content_size = len(content) if isinstance(content, (str, bytes)) else 0
			if content_size > self.config.max_content_size_bytes:
				if self.config.require_approval_for_large_documents:
					# In production, this would trigger an approval workflow
					self.logger.info(f"Large document analysis requires approval for user {user_id}")
					return {
						'success': False,
						'error': 'Document too large, approval required',
						'requires_approval': True,
						'content_size': content_size
					}
				else:
					return {'success': False, 'error': f'Content exceeds maximum size limit ({self.config.max_content_size_bytes} bytes)'}
			
			# Content filtering and PII detection
			if self.config.enable_content_filtering:
				content_check_result = await self._check_content_security(content, user_id)
				if not content_check_result['allowed']:
					return {
						'success': False,
						'error': 'Content contains restricted material',
						'violations': content_check_result.get('violations', [])
					}
			
			# Encrypt content before processing if required
			secure_content = content
			encryption_metadata = {}
			
			if self.config.enable_content_encryption:
				content_str = content if isinstance(content, str) else content.decode('utf-8', errors='ignore')
				encryption_result = await self.security.encrypt_sensitive_data(
					content_str, f"nlp_analysis_{user_id}", user_id
				)
				
				if encryption_result.success:
					secure_content = encryption_result.encrypted_data
					encryption_metadata = {
						'content_encrypted': True,
						'encryption_key_id': encryption_result.key_id,
						'encryption_algorithm': encryption_result.algorithm,
						'encryption_nonce': encryption_result.nonce,
						'encryption_tag': encryption_result.tag
					}
				else:
					self.logger.warning(f"Failed to encrypt content for analysis: {encryption_result.error_message}")
			
			# Perform NLP analysis
			analysis_id = uuid7str()
			
			if self.use_enhanced_service:
				analysis_result = await self.nlp_service.comprehensive_analysis(
					content, content_type, filename, document_id, include_transformations
				)
			else:
				analysis_result = await self.nlp_service.analyze_document(
					content, content_type, filename, document_id
				)
			
			if not analysis_result.success:
				await self.security.log_security_violation(
					f"NLP analysis failed for user {user_id}: {', '.join(analysis_result.errors)}",
					user_id,
					context.get('ip_address') if context else None
				)
				return {'success': False, 'error': 'Analysis failed', 'details': analysis_result.errors}
			
			# Redact sensitive information from results if enabled
			if self.config.redact_sensitive_content:
				analysis_result = await self._redact_sensitive_data(analysis_result, user_id)
			
			# Encrypt analysis results if required
			encrypted_results = {}
			if self.config.encrypt_analysis_results:
				encrypted_results = await self._encrypt_analysis_results(analysis_result, user_id)
			
			# Prepare secure response
			secure_response = {
				'success': True,
				'analysis_id': analysis_id,
				'user_id': user_id,
				'document_id': document_id,
				'analysis_timestamp': datetime.utcnow().isoformat(),
				'security_metadata': {
					'content_encrypted': encryption_metadata.get('content_encrypted', False),
					'results_encrypted': bool(encrypted_results),
					'content_filtered': self.config.enable_content_filtering,
					'pii_detected': self.config.enable_pii_detection,
					'classification': classification or 'internal'
				}
			}
			
			# Add analysis results (encrypted or plain)
			if encrypted_results:
				secure_response['encrypted_analysis'] = encrypted_results
			else:
				if self.use_enhanced_service:
					secure_response['comprehensive_analysis'] = {
						'document_quality_score': analysis_result.document_quality_score,
						'improvement_recommendations': analysis_result.improvement_recommendations,
						'enhancement_opportunities': analysis_result.enhancement_opportunities,
						'components_used': analysis_result.components_used,
						'processing_time': analysis_result.total_processing_time,
						'statistics': analysis_result.statistics
					}
					
					# Include specific analysis components (filtered for security)
					if analysis_result.nlp_analysis:
						secure_response['base_analysis'] = {
							'word_count': analysis_result.nlp_analysis.statistics.get('word_count', 0),
							'readability_scores': getattr(analysis_result.nlp_analysis, 'readability_scores', {}),
							'language_detected': getattr(analysis_result.nlp_analysis, 'language', 'unknown')
						}
				else:
					secure_response['analysis'] = {
						'word_count': analysis_result.statistics.get('word_count', 0),
						'processing_time': analysis_result.processing_time,
						'language_detected': getattr(analysis_result, 'language', 'unknown'),
						'success': analysis_result.success
					}
			
			# Audit log
			if self.config.audit_all_operations:
				await self.security.audit.log_event(
					event_type=AuditEventType.DOCUMENT_VIEWED,
					action="nlp_analysis",
					description=f"Performed NLP analysis on {'document ' + document_id if document_id else 'content'}",
					user_id=user_id,
					resource_type="nlp_analysis",
					resource_id=analysis_id,
					severity=AuditSeverity.MEDIUM,
					details={
						'content_type': content_type,
						'filename': filename,
						'content_size_bytes': content_size,
						'enhanced_analysis': self.use_enhanced_service,
						'include_transformations': include_transformations,
						'classification': classification,
						'processing_time': getattr(analysis_result, 'total_processing_time', getattr(analysis_result, 'processing_time', 0)),
						'success': analysis_result.success
					}
				)
			
			return secure_response
		
		except Exception as e:
			self.logger.error(f"Secure NLP analysis failed for user {user_id}: {e}")
			await self.security.log_security_violation(
				f"NLP analysis error: {e}",
				user_id,
				context.get('ip_address') if context else None
			)
			return {'success': False, 'error': f'Analysis failed: {str(e)}'}
	
	async def secure_optimize_content(
		self,
		text: str,
		user_id: str,
		optimization_goals: List[str],
		target_audience: str = "professional",
		context: Optional[Dict[str, Any]] = None
	) -> Dict[str, Any]:
		"""Optimize content with security controls"""
		if not self.use_enhanced_service:
			return {'success': False, 'error': 'Content optimization requires enhanced NLP service'}
		
		# Authentication and authorization checks
		if self.config.require_authentication and not user_id:
			return {'success': False, 'error': 'Authentication required'}
		
		auth_result = await self.security.check_permission(
			user_id, "nlp", "transform", context=context
		)
		
		if not auth_result.has_permission:
			return {'success': False, 'error': 'Permission denied'}
		
		try:
			# Content security check
			if self.config.enable_content_filtering:
				content_check_result = await self._check_content_security(text, user_id)
				if not content_check_result['allowed']:
					return {'success': False, 'error': 'Content contains restricted material'}
			
			# Perform optimization
			optimization_result = await self.nlp_service.optimize_document(
				text, optimization_goals, target_audience
			)
			
			# Encrypt optimized content if required
			if self.config.encrypt_analysis_results and optimization_result.get('success'):
				optimized_content = optimization_result.get('optimized_content', '')
				if optimized_content:
					encryption_result = await self.security.encrypt_sensitive_data(
						optimized_content, f"optimized_content_{user_id}", user_id
					)
					
					if encryption_result.success:
						optimization_result['encrypted_content'] = {
							'encrypted_data': encryption_result.encrypted_data,
							'encryption_key_id': encryption_result.key_id,
							'encryption_algorithm': encryption_result.algorithm,
							'encryption_nonce': encryption_result.nonce,
							'encryption_tag': encryption_result.tag
						}
						# Remove plain text content
						optimization_result.pop('optimized_content', None)
			
			# Audit log
			if self.config.audit_all_operations:
				await self.security.audit.log_event(
					event_type=AuditEventType.DOCUMENT_MODIFIED,
					action="content_optimization",
					description=f"Optimized content with goals: {', '.join(optimization_goals)}",
					user_id=user_id,
					severity=AuditSeverity.LOW,
					details={
						'optimization_goals': optimization_goals,
						'target_audience': target_audience,
						'content_length': len(text),
						'success': optimization_result.get('success', False)
					}
				)
			
			return optimization_result
		
		except Exception as e:
			self.logger.error(f"Content optimization failed for user {user_id}: {e}")
			return {'success': False, 'error': f'Optimization failed: {str(e)}'}
	
	async def secure_generate_summary(
		self,
		text: str,
		user_id: str,
		summary_type: str = "abstractive",
		length: str = "medium",
		context: Optional[Dict[str, Any]] = None
	) -> Dict[str, Any]:
		"""Generate document summary with security controls"""
		if not self.use_enhanced_service:
			return {'success': False, 'error': 'Document summarization requires enhanced NLP service'}
		
		# Authentication and authorization checks
		if self.config.require_authentication and not user_id:
			return {'success': False, 'error': 'Authentication required'}
		
		auth_result = await self.security.check_permission(
			user_id, "nlp", "summarize", context=context
		)
		
		if not auth_result.has_permission:
			return {'success': False, 'error': 'Permission denied'}
		
		try:
			# Content security check
			if self.config.enable_content_filtering:
				content_check_result = await self._check_content_security(text, user_id)
				if not content_check_result['allowed']:
					return {'success': False, 'error': 'Content contains restricted material'}
			
			# Generate summary
			summary_result = await self.nlp_service.generate_summary(
				text, summary_type, length
			)
			
			# Encrypt summary if required
			if self.config.encrypt_analysis_results and summary_result.get('success'):
				summary_text = summary_result.get('summary_text', '')
				if summary_text:
					encryption_result = await self.security.encrypt_sensitive_data(
						summary_text, f"summary_{user_id}", user_id
					)
					
					if encryption_result.success:
						summary_result['encrypted_summary'] = {
							'encrypted_data': encryption_result.encrypted_data,
							'encryption_key_id': encryption_result.key_id,
							'encryption_algorithm': encryption_result.algorithm,
							'encryption_nonce': encryption_result.nonce,
							'encryption_tag': encryption_result.tag
						}
						# Remove plain text summary
						summary_result.pop('summary_text', None)
			
			# Audit log
			if self.config.audit_all_operations:
				await self.security.audit.log_event(
					event_type=AuditEventType.DOCUMENT_CREATED,
					action="document_summarization",
					description=f"Generated {summary_type} summary ({length} length)",
					user_id=user_id,
					severity=AuditSeverity.LOW,
					details={
						'summary_type': summary_type,
						'length': length,
						'original_content_length': len(text),
						'success': summary_result.get('success', False)
					}
				)
			
			return summary_result
		
		except Exception as e:
			self.logger.error(f"Document summarization failed for user {user_id}: {e}")
			return {'success': False, 'error': f'Summarization failed: {str(e)}'}
	
	# ==================== SECURITY HELPER METHODS ====================
	
	async def _check_content_security(self, content: Union[str, bytes], user_id: str) -> Dict[str, Any]:
		"""Check content for security violations"""
		violations = []
		
		try:
			# Convert content to string for analysis
			content_str = content if isinstance(content, str) else content.decode('utf-8', errors='ignore')
			
			# Use DLP system if available for content scanning
			if hasattr(self.security, 'dlp') and self.security.dlp:
				from ..security.data_protection.dlp_system import ContentType
				
				dlp_result = await self.security.dlp.scan_and_enforce(
					content_str,
					ContentType.DOCUMENT,
					user_id,
					action="nlp_analysis"
				)
				
				if not dlp_result['allowed']:
					violations.extend(dlp_result.get('violations', []))
			
			# Basic PII detection if DLP not available
			elif self.config.enable_pii_detection:
				pii_patterns = [
					r'\b\d{3}-\d{2}-\d{4}\b',  # SSN
					r'\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b',  # Credit card
					r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'  # Email (basic)
				]
				
				import re
				for pattern in pii_patterns:
					if re.search(pattern, content_str):
						violations.append("Potential PII detected")
						break
			
			return {
				'allowed': len(violations) == 0,
				'violations': violations,
				'content_length': len(content_str)
			}
		
		except Exception as e:
			self.logger.error(f"Content security check failed: {e}")
			return {'allowed': False, 'violations': ['Content security check failed']}
	
	async def _redact_sensitive_data(self, analysis_result, user_id: str):
		"""Redact sensitive information from analysis results"""
		try:
			# This is a simplified implementation
			# In production, this would use sophisticated NLP models to identify and redact sensitive content
			
			if hasattr(analysis_result, 'nlp_analysis') and analysis_result.nlp_analysis:
				# Redact from extracted entities if present
				if hasattr(analysis_result.nlp_analysis, 'entities'):
					sensitive_entity_types = ['PERSON', 'ORG', 'GPE', 'SSN', 'CREDIT_CARD']
					filtered_entities = []
					
					for entity in getattr(analysis_result.nlp_analysis, 'entities', []):
						if entity.get('label') not in sensitive_entity_types:
							filtered_entities.append(entity)
						else:
							# Replace with redacted version
							filtered_entities.append({
								**entity,
								'text': '[REDACTED]',
								'redacted': True
							})
					
					analysis_result.nlp_analysis.entities = filtered_entities
			
			return analysis_result
		
		except Exception as e:
			self.logger.error(f"Data redaction failed: {e}")
			return analysis_result
	
	async def _encrypt_analysis_results(self, analysis_result, user_id: str) -> Dict[str, Any]:
		"""Encrypt analysis results for secure storage"""
		try:
			# Convert analysis result to JSON-serializable format
			if hasattr(analysis_result, '__dict__'):
				result_data = analysis_result.__dict__
			else:
				result_data = analysis_result
			
			import json
			result_json = json.dumps(result_data, default=str)
			
			# Encrypt the serialized results
			encryption_result = await self.security.encrypt_sensitive_data(
				result_json, f"nlp_results_{user_id}", user_id
			)
			
			if encryption_result.success:
				return {
					'encrypted_data': encryption_result.encrypted_data,
					'encryption_key_id': encryption_result.key_id,
					'encryption_algorithm': encryption_result.algorithm,
					'encryption_nonce': encryption_result.nonce,
					'encryption_tag': encryption_result.tag,
					'encrypted_at': datetime.utcnow().isoformat()
				}
			else:
				self.logger.error(f"Failed to encrypt analysis results: {encryption_result.error_message}")
				return {}
		
		except Exception as e:
			self.logger.error(f"Analysis result encryption failed: {e}")
			return {}
	
	async def decrypt_analysis_results(
		self,
		encrypted_results: Dict[str, Any],
		user_id: str
	) -> Dict[str, Any]:
		"""Decrypt previously encrypted analysis results"""
		try:
			decryption_result = await self.security.encryption.decrypt_data(
				encrypted_results['encrypted_data'],
				encrypted_results['encryption_key_id'],
				encrypted_results['encryption_nonce'],
				encrypted_results.get('encryption_tag')
			)
			
			if decryption_result.success:
				import json
				return json.loads(decryption_result.decrypted_data)
			else:
				self.logger.error(f"Failed to decrypt analysis results: {decryption_result.error_message}")
				return {'error': 'Decryption failed'}
		
		except Exception as e:
			self.logger.error(f"Analysis result decryption failed: {e}")
			return {'error': f'Decryption error: {str(e)}'}
	
	# ==================== SYSTEM MANAGEMENT ====================
	
	async def get_security_status(self) -> Dict[str, Any]:
		"""Get security status of NLP service"""
		security_metrics = await self.security.get_security_metrics()
		nlp_service_info = self.nlp_service.get_service_info()
		
		return {
			'security_enabled': True,
			'authentication_required': self.config.require_authentication,
			'content_encryption_enabled': self.config.enable_content_encryption,
			'pii_detection_enabled': self.config.enable_pii_detection,
			'audit_logging_enabled': self.config.audit_all_operations,
			'content_filtering_enabled': self.config.enable_content_filtering,
			'results_encryption_enabled': self.config.encrypt_analysis_results,
			'enhanced_nlp_enabled': self.use_enhanced_service,
			'security_metrics': security_metrics,
			'nlp_service_info': nlp_service_info,
			'secure_nlp_service_version': '1.0.0'
		}
	
	async def get_user_nlp_activity(
		self,
		user_id: str,
		date_range: Optional[Dict[str, str]] = None,
		context: Optional[Dict[str, Any]] = None
	) -> Dict[str, Any]:
		"""Get NLP activity summary for user"""
		if self.config.require_authentication and not user_id:
			return {'success': False, 'error': 'Authentication required'}
		
		# Check if user can view their own activity
		auth_result = await self.security.check_permission(
			user_id, "audit", "read", context=context
		)
		
		if not auth_result.has_permission:
			return {'success': False, 'error': 'Permission denied'}
		
		try:
			# Get user's security summary (includes audit activity)
			security_summary = await self.security.get_user_security_summary(user_id)
			
			# Filter for NLP-related activities
			nlp_activities = []
			if 'recent_activities' in security_summary:
				nlp_activities = [
					activity for activity in security_summary['recent_activities']
					if 'nlp' in activity.get('action', '').lower() or
					   'analysis' in activity.get('action', '').lower() or
					   'optimization' in activity.get('action', '').lower() or
					   'summarization' in activity.get('action', '').lower()
				]
			
			return {
				'success': True,
				'user_id': user_id,
				'nlp_activities': nlp_activities,
				'total_nlp_operations': len(nlp_activities),
				'security_summary': security_summary,
				'date_range': date_range
			}
		
		except Exception as e:
			self.logger.error(f"Failed to get NLP activity for user {user_id}: {e}")
			return {'success': False, 'error': f'Activity retrieval failed: {str(e)}'}
	
	async def cleanup_expired_data(self) -> Dict[str, Any]:
		"""Clean up expired NLP analysis data and security data"""
		cleanup_result = await self.security.cleanup_expired_security_data()
		
		# Add NLP-specific cleanup logic here
		# For now, just return security cleanup results
		cleanup_result['nlp_cleanup'] = {
			'analysis_results_cleaned': 0,  # Would implement actual cleanup
			'retention_policy_days': self.config.analysis_result_retention_days
		}
		
		return cleanup_result
	
	async def close(self):
		"""Clean shutdown of secure NLP service"""
		await self.security.close()
		await self.nlp_service.close()
		self.logger.info("Secure NLP service closed")

# Factory function
def create_secure_nlp_service(config: SecureNLPServiceConfiguration) -> SecureNLPService:
	"""Create SecureNLPService instance with configuration"""
	return SecureNLPService(config)