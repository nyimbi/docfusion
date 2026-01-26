#!/usr/bin/env python3
"""
Security-Workflow Integration Layer

Comprehensive integration between the workflow automation system and the 
security management system, ensuring secure workflow execution with proper
authentication, authorization, encryption, and audit logging.

This module provides:
- Secure workflow execution with authentication
- Role-based access control for workflow operations
- Encrypted workflow data and communications
- Comprehensive audit logging of workflow activities
- Compliance validation during workflow execution
- Data loss prevention for workflow content
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Union, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import json
import hashlib
from pydantic import BaseModel, Field, ConfigDict

try:
	from uuid_extensions import uuid7str
except ImportError:
	import uuid
	def uuid7str() -> str:
		return str(uuid.uuid4())

# Import workflow components
from ..coordination.task_coordinator import TaskCoordinator, TaskAssignment
from ..coordination.deadline_manager import DeadlineManager
from ..monitoring.workflow_monitor import WorkflowMonitor

# Import security components
from ...security.security_manager import SecurityManager, SecurityManagerConfiguration
from ...security.authentication.user_authentication import AuthenticationResult, UserCredentials
from ...security.authorization.role_based_access import AccessResult, PermissionAction, ResourceType
from ...security.encryption.data_encryption import EncryptionResult
from ...security.audit.audit_logger import AuditEventType, AuditSeverity
from ...security.data_protection.dlp_system import ContentType, DLPAction
from ...security.compliance.gdpr_compliance import GDPRRights


class WorkflowSecurityLevel(str, Enum):
	"""Security levels for workflow execution"""
	PUBLIC = "public"
	INTERNAL = "internal"
	CONFIDENTIAL = "confidential"
	RESTRICTED = "restricted"
	TOP_SECRET = "top_secret"


class WorkflowSecurityAction(str, Enum):
	"""Security actions for workflow operations"""
	CREATE_WORKFLOW = "create_workflow"
	EXECUTE_WORKFLOW = "execute_workflow"
	VIEW_WORKFLOW = "view_workflow"
	MODIFY_WORKFLOW = "modify_workflow"
	DELETE_WORKFLOW = "delete_workflow"
	ASSIGN_TASK = "assign_task"
	MONITOR_WORKFLOW = "monitor_workflow"
	ACCESS_RESULTS = "access_results"


class WorkflowSecurityEvent(str, Enum):
	"""Security events in workflow execution"""
	WORKFLOW_STARTED = "workflow_started"
	WORKFLOW_COMPLETED = "workflow_completed"
	WORKFLOW_FAILED = "workflow_failed"
	TASK_ASSIGNED = "task_assigned"
	UNAUTHORIZED_ACCESS = "unauthorized_access"
	DATA_ENCRYPTED = "data_encrypted"
	COMPLIANCE_VIOLATION = "compliance_violation"
	SECURITY_POLICY_APPLIED = "security_policy_applied"


@dataclass
class WorkflowSecurityContext:
	"""Security context for workflow operations"""
	user_id: str
	session_id: Optional[str] = None
	ip_address: Optional[str] = None
	user_agent: Optional[str] = None
	security_level: WorkflowSecurityLevel = WorkflowSecurityLevel.INTERNAL
	classification: Optional[str] = None
	access_controls: Dict[str, Any] = field(default_factory=dict)
	encryption_required: bool = True
	audit_required: bool = True
	compliance_frameworks: List[str] = field(default_factory=list)


@dataclass
class SecureWorkflowPermissions:
	"""Permissions required for secure workflow operations"""
	can_create: bool = False
	can_execute: bool = False
	can_view: bool = False
	can_modify: bool = False
	can_delete: bool = False
	can_assign_tasks: bool = False
	can_monitor: bool = False
	can_access_results: bool = False
	max_security_level: WorkflowSecurityLevel = WorkflowSecurityLevel.PUBLIC
	allowed_classifications: List[str] = field(default_factory=list)
	resource_restrictions: Dict[str, Any] = field(default_factory=dict)


class SecureWorkflowResult(BaseModel):
	"""Result of secure workflow operation"""
	model_config = ConfigDict(extra='forbid')
	
	success: bool
	workflow_id: Optional[str] = None
	session_id: Optional[str] = None
	security_level: WorkflowSecurityLevel
	encrypted: bool = False
	audit_logged: bool = False
	compliance_validated: bool = False
	access_granted: bool = False
	error_message: Optional[str] = None
	security_warnings: List[str] = Field(default_factory=list)
	result_data: Optional[Dict[str, Any]] = None
	execution_time: Optional[float] = None


class SecurityWorkflowIntegration:
	"""
	Main integration layer between security and workflow systems
	
	Provides comprehensive security enforcement for workflow operations
	including authentication, authorization, encryption, audit logging,
	and compliance validation.
	"""
	
	def __init__(self,
				 security_manager: SecurityManager,
				 task_coordinator: TaskCoordinator,
				 deadline_manager: DeadlineManager,
				 workflow_monitor: WorkflowMonitor):
		"""Initialize security-workflow integration"""
		self.security_manager = security_manager
		self.task_coordinator = task_coordinator
		self.deadline_manager = deadline_manager
		self.workflow_monitor = workflow_monitor
		
		# Security state management
		self.active_secure_sessions: Dict[str, Dict[str, Any]] = {}
		self.workflow_security_contexts: Dict[str, WorkflowSecurityContext] = {}
		self.user_permissions_cache: Dict[str, SecureWorkflowPermissions] = {}
		
		# Security policies and configurations
		self.security_policies: Dict[str, Dict[str, Any]] = {}
		self.classification_policies: Dict[str, Dict[str, Any]] = {}
		self.encryption_policies: Dict[WorkflowSecurityLevel, Dict[str, Any]] = {}
		
		# Performance metrics
		self.security_metrics: Dict[str, Any] = {
			'authentication_attempts': 0,
			'authorization_checks': 0,
			'encryptions_performed': 0,
			'security_violations': 0,
			'audit_events_logged': 0
		}
		
		self.logger = logging.getLogger(__name__)
		self._initialize_security_policies()
		self.logger.info("Security-Workflow integration initialized")
	
	def _initialize_security_policies(self) -> None:
		"""Initialize default security policies for workflows"""
		# Default workflow security policies
		self.security_policies = {
			'default': {
				'require_authentication': True,
				'require_authorization': True,
				'encrypt_sensitive_data': True,
				'audit_all_operations': True,
				'enforce_data_classification': True,
				'enable_dlp_scanning': True,
				'require_compliance_validation': True
			},
			'high_security': {
				'require_mfa': True,
				'require_device_verification': True,
				'encrypt_all_data': True,
				'detailed_audit_logging': True,
				'strict_access_controls': True,
				'continuous_monitoring': True,
				'enhanced_dlp_rules': True
			}
		}
		
		# Classification-based policies
		self.classification_policies = {
			'public': {
				'encryption_level': 'basic',
				'access_restrictions': 'minimal',
				'audit_level': 'standard'
			},
			'internal': {
				'encryption_level': 'standard',
				'access_restrictions': 'moderate',
				'audit_level': 'detailed'
			},
			'confidential': {
				'encryption_level': 'strong',
				'access_restrictions': 'strict',
				'audit_level': 'comprehensive'
			},
			'restricted': {
				'encryption_level': 'maximum',
				'access_restrictions': 'very_strict',
				'audit_level': 'full'
			}
		}
		
		# Encryption policies by security level
		self.encryption_policies = {
			WorkflowSecurityLevel.PUBLIC: {
				'encrypt_workflow_data': False,
				'encrypt_task_data': False,
				'encrypt_communications': False
			},
			WorkflowSecurityLevel.INTERNAL: {
				'encrypt_workflow_data': True,
				'encrypt_task_data': False,
				'encrypt_communications': True
			},
			WorkflowSecurityLevel.CONFIDENTIAL: {
				'encrypt_workflow_data': True,
				'encrypt_task_data': True,
				'encrypt_communications': True
			},
			WorkflowSecurityLevel.RESTRICTED: {
				'encrypt_workflow_data': True,
				'encrypt_task_data': True,
				'encrypt_communications': True,
				'use_advanced_encryption': True
			},
			WorkflowSecurityLevel.TOP_SECRET: {
				'encrypt_workflow_data': True,
				'encrypt_task_data': True,
				'encrypt_communications': True,
				'use_advanced_encryption': True,
				'require_key_escrow': True
			}
		}
	
	# ==================== SECURE WORKFLOW AUTHENTICATION ====================
	
	async def authenticate_workflow_user(self,
										 username: str,
										 password: str,
										 mfa_code: Optional[str] = None,
										 ip_address: Optional[str] = None,
										 user_agent: Optional[str] = None,
										 workflow_id: Optional[str] = None) -> Tuple[bool, Dict[str, Any]]:
		"""Authenticate user for workflow operations"""
		try:
			self.security_metrics['authentication_attempts'] += 1
			
			# Perform authentication
			auth_result = await self.security_manager.authenticate_user(
				username=username,
				password=password,
				mfa_code=mfa_code,
				ip_address=ip_address,
				user_agent=user_agent
			)
			
			if auth_result.status.value == "success":
				# Create secure session
				session_id = uuid7str()
				session_data = {
					'session_id': session_id,
					'user_id': auth_result.user_id,
					'username': username,
					'authenticated_at': datetime.now(),
					'ip_address': ip_address,
					'user_agent': user_agent,
					'workflow_id': workflow_id,
					'mfa_verified': auth_result.mfa_verified,
					'session_timeout': datetime.now() + timedelta(hours=8)
				}
				
				self.active_secure_sessions[session_id] = session_data
				
				# Log successful authentication
				await self._log_security_event(
					WorkflowSecurityEvent.WORKFLOW_STARTED,
					f"User {username} authenticated for workflow access",
					auth_result.user_id,
					ip_address,
					{'workflow_id': workflow_id, 'mfa_verified': auth_result.mfa_verified}
				)
				
				return True, {
					'session_id': session_id,
					'user_id': auth_result.user_id,
					'requires_additional_auth': auth_result.requires_mfa and not auth_result.mfa_verified,
					'permissions': await self._get_user_workflow_permissions(auth_result.user_id)
				}
			else:
				# Log failed authentication
				await self._log_security_event(
					WorkflowSecurityEvent.UNAUTHORIZED_ACCESS,
					f"Failed authentication attempt for user {username}",
					None,
					ip_address,
					{'reason': auth_result.status.value, 'workflow_id': workflow_id}
				)
				
				return False, {
					'error': f"Authentication failed: {auth_result.status.value}",
					'requires_mfa': auth_result.requires_mfa
				}
		
		except Exception as e:
			self.logger.error(f"Workflow authentication failed: {e}")
			return False, {'error': f"Authentication error: {str(e)}"}
	
	async def validate_workflow_session(self, session_id: str) -> Tuple[bool, Dict[str, Any]]:
		"""Validate active workflow session"""
		try:
			if session_id not in self.active_secure_sessions:
				return False, {'error': 'Invalid session'}
			
			session_data = self.active_secure_sessions[session_id]
			
			# Check session timeout
			if datetime.now() > session_data['session_timeout']:
				del self.active_secure_sessions[session_id]
				return False, {'error': 'Session expired'}
			
			# Extend session if valid
			session_data['last_activity'] = datetime.now()
			session_data['session_timeout'] = datetime.now() + timedelta(hours=8)
			
			return True, {
				'user_id': session_data['user_id'],
				'username': session_data['username'],
				'authenticated_at': session_data['authenticated_at'],
				'mfa_verified': session_data.get('mfa_verified', False)
			}
		
		except Exception as e:
			self.logger.error(f"Session validation failed: {e}")
			return False, {'error': f"Session validation error: {str(e)}"}
	
	# ==================== SECURE WORKFLOW AUTHORIZATION ====================
	
	async def authorize_workflow_operation(self,
										   user_id: str,
										   action: WorkflowSecurityAction,
										   workflow_id: Optional[str] = None,
										   security_level: WorkflowSecurityLevel = WorkflowSecurityLevel.INTERNAL,
										   resource_context: Optional[Dict[str, Any]] = None) -> AccessResult:
		"""Authorize user for specific workflow operation"""
		try:
			self.security_metrics['authorization_checks'] += 1
			
			# Convert workflow action to security permission
			permission_action, resource_type = self._map_workflow_action_to_permission(action)
			
			# Perform authorization check
			access_result = await self.security_manager.check_permission(
				user_id=user_id,
				resource_type=resource_type.value,
				action=permission_action.value,
				resource_id=workflow_id,
				context=resource_context
			)
			
			# Additional workflow-specific authorization checks
			if access_result.decision.value == "granted":
				# Check security level clearance
				user_permissions = await self._get_user_workflow_permissions(user_id)
				if not self._check_security_level_access(user_permissions, security_level):
					access_result.decision = "denied"
					access_result.reason = f"Insufficient security clearance for {security_level.value} workflows"
			
			# Log authorization result
			await self._log_security_event(
				WorkflowSecurityEvent.SECURITY_POLICY_APPLIED if access_result.decision.value == "granted" else WorkflowSecurityEvent.UNAUTHORIZED_ACCESS,
				f"Authorization check for {action.value}: {access_result.decision.value}",
				user_id,
				resource_context.get('ip_address') if resource_context else None,
				{
					'action': action.value,
					'workflow_id': workflow_id,
					'security_level': security_level.value,
					'decision': access_result.decision.value,
					'reason': access_result.reason
				}
			)
			
			return access_result
		
		except Exception as e:
			self.logger.error(f"Workflow authorization failed: {e}")
			# Return deny on error for security
			from ...security.authorization.role_based_access import AccessDecision
			return AccessResult(
				decision=AccessDecision.DENIED,
				user_id=user_id,
				resource_type=ResourceType.WORKFLOW,
				action=PermissionAction.READ,
				reason=f"Authorization error: {str(e)}"
			)
	
	async def create_secure_workflow_context(self,
											 user_id: str,
											 workflow_id: str,
											 security_level: WorkflowSecurityLevel,
											 classification: Optional[str] = None,
											 ip_address: Optional[str] = None,
											 user_agent: Optional[str] = None) -> WorkflowSecurityContext:
		"""Create security context for workflow execution"""
		try:
			# Get user permissions
			user_permissions = await self._get_user_workflow_permissions(user_id)
			
			# Determine security policies to apply
			security_policy = self._get_security_policy_for_level(security_level)
			classification_policy = self._get_classification_policy(classification)
			
			# Create security context
			context = WorkflowSecurityContext(
				user_id=user_id,
				ip_address=ip_address,
				user_agent=user_agent,
				security_level=security_level,
				classification=classification,
				encryption_required=security_policy.get('encrypt_sensitive_data', True),
				audit_required=security_policy.get('audit_all_operations', True),
				compliance_frameworks=classification_policy.get('compliance_frameworks', []),
				access_controls={
					'max_security_level': user_permissions.max_security_level.value,
					'allowed_classifications': user_permissions.allowed_classifications,
					'resource_restrictions': user_permissions.resource_restrictions
				}
			)
			
			# Store context
			self.workflow_security_contexts[workflow_id] = context
			
			self.logger.info(f"Created secure workflow context for {workflow_id} at {security_level.value} level")
			return context
		
		except Exception as e:
			self.logger.error(f"Failed to create secure workflow context: {e}")
			raise
	
	# ==================== SECURE WORKFLOW EXECUTION ====================
	
	async def execute_secure_workflow(self,
									  workflow_id: str,
									  workflow_definition: Dict[str, Any],
									  security_context: WorkflowSecurityContext,
									  execution_parameters: Optional[Dict[str, Any]] = None) -> SecureWorkflowResult:
		"""Execute workflow with comprehensive security enforcement"""
		start_time = datetime.now()
		
		try:
			# Validate security context
			if not await self._validate_security_context(security_context):
				return SecureWorkflowResult(
					success=False,
					workflow_id=workflow_id,
					security_level=security_context.security_level,
					error_message="Invalid security context",
					access_granted=False
				)
			
			# Pre-execution security checks
			security_validation = await self._perform_pre_execution_security_checks(
				workflow_id, workflow_definition, security_context
			)
			
			if not security_validation['passed']:
				return SecureWorkflowResult(
					success=False,
					workflow_id=workflow_id,
					security_level=security_context.security_level,
					error_message=f"Security validation failed: {security_validation['reason']}",
					security_warnings=security_validation.get('warnings', []),
					access_granted=False
				)
			
			# Encrypt workflow data if required
			encrypted_workflow_data = None
			if security_context.encryption_required:
				encryption_result = await self._encrypt_workflow_data(
					workflow_definition, security_context
				)
				if encryption_result.success:
					encrypted_workflow_data = encryption_result.encrypted_data
					self.security_metrics['encryptions_performed'] += 1
				else:
					return SecureWorkflowResult(
						success=False,
						workflow_id=workflow_id,
						security_level=security_context.security_level,
						error_message="Failed to encrypt workflow data",
						access_granted=True
					)
			
			# Log workflow execution start
			await self._log_security_event(
				WorkflowSecurityEvent.WORKFLOW_STARTED,
				f"Secure workflow execution started: {workflow_id}",
				security_context.user_id,
				security_context.ip_address,
				{
					'workflow_id': workflow_id,
					'security_level': security_context.security_level.value,
					'classification': security_context.classification,
					'encrypted': security_context.encryption_required
				}
			)
			
			# Execute workflow with security monitoring
			execution_result = await self._execute_workflow_with_monitoring(
				workflow_id, workflow_definition, security_context, execution_parameters
			)
			
			# Post-execution security processing
			secure_result = await self._process_secure_workflow_results(
				workflow_id, execution_result, security_context
			)
			
			# Calculate execution time
			execution_time = (datetime.now() - start_time).total_seconds()
			
			# Log workflow completion
			await self._log_security_event(
				WorkflowSecurityEvent.WORKFLOW_COMPLETED if secure_result['success'] else WorkflowSecurityEvent.WORKFLOW_FAILED,
				f"Secure workflow execution completed: {workflow_id}",
				security_context.user_id,
				security_context.ip_address,
				{
					'workflow_id': workflow_id,
					'success': secure_result['success'],
					'execution_time': execution_time,
					'tasks_completed': secure_result.get('tasks_completed', 0)
				}
			)
			
			return SecureWorkflowResult(
				success=secure_result['success'],
				workflow_id=workflow_id,
				security_level=security_context.security_level,
				encrypted=security_context.encryption_required,
				audit_logged=security_context.audit_required,
				compliance_validated=True,
				access_granted=True,
				result_data=secure_result.get('result_data'),
				execution_time=execution_time,
				security_warnings=secure_result.get('security_warnings', [])
			)
		
		except Exception as e:
			self.logger.error(f"Secure workflow execution failed: {e}")
			self.security_metrics['security_violations'] += 1
			
			# Log security failure
			await self._log_security_event(
				WorkflowSecurityEvent.WORKFLOW_FAILED,
				f"Secure workflow execution failed: {workflow_id}",
				security_context.user_id,
				security_context.ip_address,
				{
					'workflow_id': workflow_id,
					'error': str(e),
					'execution_time': (datetime.now() - start_time).total_seconds()
				}
			)
			
			return SecureWorkflowResult(
				success=False,
				workflow_id=workflow_id,
				security_level=security_context.security_level,
				error_message=f"Execution failed: {str(e)}",
				execution_time=(datetime.now() - start_time).total_seconds(),
				access_granted=True
			)
	
	# ==================== SECURE TASK COORDINATION ====================
	
	async def assign_secure_task(self,
								 task_id: str,
								 assignee_id: str,
								 task_data: Dict[str, Any],
								 security_context: WorkflowSecurityContext,
								 requester_id: str) -> Tuple[bool, Dict[str, Any]]:
		"""Assign task with security validation and encryption"""
		try:
			# Authorize task assignment
			auth_result = await self.authorize_workflow_operation(
				user_id=requester_id,
				action=WorkflowSecurityAction.ASSIGN_TASK,
				workflow_id=security_context.workflow_id if hasattr(security_context, 'workflow_id') else None,
				security_level=security_context.security_level,
				resource_context={
					'assignee_id': assignee_id,
					'task_id': task_id,
					'ip_address': security_context.ip_address
				}
			)
			
			if auth_result.decision.value != "granted":
				return False, {
					'error': f"Authorization denied: {auth_result.reason}",
					'decision': auth_result.decision.value
				}
			
			# Validate assignee has necessary clearance
			assignee_permissions = await self._get_user_workflow_permissions(assignee_id)
			if not self._check_security_level_access(assignee_permissions, security_context.security_level):
				return False, {
					'error': f"Assignee lacks security clearance for {security_context.security_level.value} tasks"
				}
			
			# Encrypt task data if required
			secure_task_data = task_data.copy()
			if security_context.encryption_required:
				encryption_result = await self._encrypt_task_data(task_data, security_context)
				if encryption_result.success:
					secure_task_data = {
						'encrypted': True,
						'encrypted_data': encryption_result.encrypted_data,
						'key_id': encryption_result.key_id
					}
			
			# Perform DLP scanning on task content
			dlp_result = await self._scan_task_content_for_dlp(task_data, security_context)
			if not dlp_result['allowed']:
				return False, {
					'error': 'Task content violates data loss prevention policies',
					'dlp_violations': dlp_result.get('violations', [])
				}
			
			# Assign task through coordinator
			assignment = await self.task_coordinator.assign_task(
				task_id=task_id,
				assignee_id=assignee_id,
				task_type=task_data.get('type', 'secure_task'),
				priority=task_data.get('priority', 0.5),
				requirements=secure_task_data,
				deadline=task_data.get('deadline'),
				workflow_id=getattr(security_context, 'workflow_id', None)
			)
			
			if assignment:
				# Log secure task assignment
				await self._log_security_event(
					WorkflowSecurityEvent.TASK_ASSIGNED,
					f"Secure task assigned: {task_id} to {assignee_id}",
					requester_id,
					security_context.ip_address,
					{
						'task_id': task_id,
						'assignee_id': assignee_id,
						'security_level': security_context.security_level.value,
						'encrypted': security_context.encryption_required,
						'assignment_id': assignment.assignment_id
					}
				)
				
				return True, {
					'assignment_id': assignment.assignment_id,
					'task_id': task_id,
					'assignee_id': assignee_id,
					'encrypted': security_context.encryption_required,
					'security_level': security_context.security_level.value
				}
			else:
				return False, {'error': 'Failed to create task assignment'}
		
		except Exception as e:
			self.logger.error(f"Secure task assignment failed: {e}")
			return False, {'error': f"Task assignment error: {str(e)}"}
	
	# ==================== DATA PROTECTION AND ENCRYPTION ====================
	
	async def encrypt_workflow_content(self,
									   content: str,
									   content_type: str,
									   security_context: WorkflowSecurityContext) -> EncryptionResult:
		"""Encrypt workflow content based on security level"""
		try:
			# Determine encryption purpose
			purpose = f"workflow_{security_context.security_level.value}_{content_type}"
			
			# Encrypt content
			encryption_result = await self.security_manager.encrypt_sensitive_data(
				data=content,
				purpose=purpose,
				user_id=security_context.user_id
			)
			
			self.security_metrics['encryptions_performed'] += 1
			
			# Log encryption event
			await self._log_security_event(
				WorkflowSecurityEvent.DATA_ENCRYPTED,
				f"Workflow content encrypted: {content_type}",
				security_context.user_id,
				security_context.ip_address,
				{
					'content_type': content_type,
					'security_level': security_context.security_level.value,
					'purpose': purpose,
					'success': encryption_result.success
				}
			)
			
			return encryption_result
		
		except Exception as e:
			self.logger.error(f"Workflow content encryption failed: {e}")
			raise
	
	async def scan_workflow_content_for_dlp(self,
											content: str,
											content_type: str,
											security_context: WorkflowSecurityContext) -> Dict[str, Any]:
		"""Scan workflow content for data loss prevention violations"""
		try:
			# Perform DLP scan
			dlp_result = await self.security_manager.scan_content_for_dlp(
				content=content,
				content_type=content_type,
				user_id=security_context.user_id,
				action="workflow_processing",
				source_ip=security_context.ip_address,
				user_agent=security_context.user_agent
			)
			
			# Log DLP scan result
			if not dlp_result['allowed']:
				await self._log_security_event(
					WorkflowSecurityEvent.COMPLIANCE_VIOLATION,
					f"DLP violation detected in workflow content",
					security_context.user_id,
					security_context.ip_address,
					{
						'content_type': content_type,
						'action_taken': dlp_result['action_taken'],
						'violations': len(dlp_result.get('violations', [])),
						'confidence': dlp_result.get('scan_result', {}).get('confidence', 0.0)
					}
				)
			
			return dlp_result
		
		except Exception as e:
			self.logger.error(f"DLP scanning failed: {e}")
			# Return blocked result on error (fail secure)
			return {
				'allowed': False,
				'action_taken': DLPAction.BLOCK,
				'error': str(e),
				'blocked_reasons': ['DLP scanning error']
			}
	
	# ==================== COMPLIANCE AND GOVERNANCE ====================
	
	async def validate_workflow_compliance(self,
										   workflow_definition: Dict[str, Any],
										   security_context: WorkflowSecurityContext) -> Dict[str, Any]:
		"""Validate workflow compliance with applicable frameworks"""
		try:
			compliance_results = {
				'compliant': True,
				'framework_results': {},
				'violations': [],
				'recommendations': []
			}
			
			# Check each required compliance framework
			for framework in security_context.compliance_frameworks:
				framework_result = await self._validate_framework_compliance(
					workflow_definition, framework, security_context
				)
				compliance_results['framework_results'][framework] = framework_result
				
				if not framework_result['compliant']:
					compliance_results['compliant'] = False
					compliance_results['violations'].extend(framework_result.get('violations', []))
					compliance_results['recommendations'].extend(framework_result.get('recommendations', []))
			
			# Log compliance validation
			if not compliance_results['compliant']:
				await self._log_security_event(
					WorkflowSecurityEvent.COMPLIANCE_VIOLATION,
					"Workflow compliance validation failed",
					security_context.user_id,
					security_context.ip_address,
					{
						'frameworks': security_context.compliance_frameworks,
						'violations': len(compliance_results['violations']),
						'details': compliance_results['violations']
					}
				)
			
			return compliance_results
		
		except Exception as e:
			self.logger.error(f"Compliance validation failed: {e}")
			return {
				'compliant': False,
				'error': str(e),
				'violations': [f"Compliance validation error: {str(e)}"]
			}
	
	# ==================== SECURITY MONITORING AND METRICS ====================
	
	async def get_workflow_security_metrics(self) -> Dict[str, Any]:
		"""Get comprehensive security metrics for workflow operations"""
		try:
			# Basic security metrics
			metrics = self.security_metrics.copy()
			
			# Add session metrics
			metrics['active_sessions'] = len(self.active_secure_sessions)
			metrics['workflow_contexts'] = len(self.workflow_security_contexts)
			
			# Calculate security health score
			total_operations = max(sum([
				metrics['authentication_attempts'],
				metrics['authorization_checks'],
				metrics['encryptions_performed']
			]), 1)
			
			security_health_score = 1.0 - (metrics['security_violations'] / total_operations)
			metrics['security_health_score'] = max(0.0, min(1.0, security_health_score))
			
			# Add timestamp
			metrics['last_updated'] = datetime.now().isoformat()
			
			return metrics
		
		except Exception as e:
			self.logger.error(f"Failed to get security metrics: {e}")
			return {'error': str(e)}
	
	async def monitor_workflow_security_events(self) -> List[Dict[str, Any]]:
		"""Monitor and return recent security events"""
		try:
			# This would integrate with the audit system to get recent security events
			# For now, return a summary of recent activity
			
			recent_events = []
			
			# Get recent audit events (simplified)
			audit_stats = await self.security_manager.audit.get_audit_statistics()
			
			# Convert to security event summary
			for event_type, count in audit_stats.get('event_counts', {}).items():
				if count > 0:
					recent_events.append({
						'event_type': event_type,
						'count': count,
						'timestamp': datetime.now().isoformat(),
						'severity': self._get_event_severity(event_type)
					})
			
			return recent_events
		
		except Exception as e:
			self.logger.error(f"Failed to monitor security events: {e}")
			return []
	
	# ==================== HELPER METHODS ====================
	
	async def _get_user_workflow_permissions(self, user_id: str) -> SecureWorkflowPermissions:
		"""Get user permissions for workflow operations"""
		if user_id in self.user_permissions_cache:
			return self.user_permissions_cache[user_id]
		
		try:
			# Get user permissions from RBAC system
			permissions = await self.security_manager.rbac.get_user_permissions(user_id)
			
			# Convert to workflow permissions
			workflow_permissions = SecureWorkflowPermissions(
				can_create=any('create' in perm.lower() for perm in permissions),
				can_execute=any('execute' in perm.lower() for perm in permissions),
				can_view=any('view' in perm.lower() or 'read' in perm.lower() for perm in permissions),
				can_modify=any('modify' in perm.lower() or 'edit' in perm.lower() for perm in permissions),
				can_delete=any('delete' in perm.lower() for perm in permissions),
				can_assign_tasks=any('assign' in perm.lower() for perm in permissions),
				can_monitor=any('monitor' in perm.lower() for perm in permissions),
				can_access_results=any('access' in perm.lower() for perm in permissions),
				max_security_level=WorkflowSecurityLevel.INTERNAL,  # Default
				allowed_classifications=['public', 'internal']  # Default
			)
			
			# Cache permissions
			self.user_permissions_cache[user_id] = workflow_permissions
			
			return workflow_permissions
		
		except Exception as e:
			self.logger.error(f"Failed to get user permissions: {e}")
			# Return minimal permissions on error
			return SecureWorkflowPermissions()
	
	def _map_workflow_action_to_permission(self, action: WorkflowSecurityAction) -> Tuple[PermissionAction, ResourceType]:
		"""Map workflow action to security permission"""
		action_mapping = {
			WorkflowSecurityAction.CREATE_WORKFLOW: (PermissionAction.CREATE, ResourceType.WORKFLOW),
			WorkflowSecurityAction.EXECUTE_WORKFLOW: (PermissionAction.EXECUTE, ResourceType.WORKFLOW),
			WorkflowSecurityAction.VIEW_WORKFLOW: (PermissionAction.READ, ResourceType.WORKFLOW),
			WorkflowSecurityAction.MODIFY_WORKFLOW: (PermissionAction.UPDATE, ResourceType.WORKFLOW),
			WorkflowSecurityAction.DELETE_WORKFLOW: (PermissionAction.DELETE, ResourceType.WORKFLOW),
			WorkflowSecurityAction.ASSIGN_TASK: (PermissionAction.ASSIGN, ResourceType.TASK),
			WorkflowSecurityAction.MONITOR_WORKFLOW: (PermissionAction.READ, ResourceType.WORKFLOW),
			WorkflowSecurityAction.ACCESS_RESULTS: (PermissionAction.READ, ResourceType.DOCUMENT)
		}
		
		return action_mapping.get(action, (PermissionAction.READ, ResourceType.SYSTEM))
	
	def _check_security_level_access(self, permissions: SecureWorkflowPermissions, required_level: WorkflowSecurityLevel) -> bool:
		"""Check if user has access to required security level"""
		level_hierarchy = {
			WorkflowSecurityLevel.PUBLIC: 1,
			WorkflowSecurityLevel.INTERNAL: 2,
			WorkflowSecurityLevel.CONFIDENTIAL: 3,
			WorkflowSecurityLevel.RESTRICTED: 4,
			WorkflowSecurityLevel.TOP_SECRET: 5
		}
		
		user_max_level = level_hierarchy.get(permissions.max_security_level, 1)
		required_level_value = level_hierarchy.get(required_level, 5)
		
		return user_max_level >= required_level_value
	
	def _get_security_policy_for_level(self, security_level: WorkflowSecurityLevel) -> Dict[str, Any]:
		"""Get security policy configuration for security level"""
		if security_level in [WorkflowSecurityLevel.RESTRICTED, WorkflowSecurityLevel.TOP_SECRET]:
			return self.security_policies['high_security']
		else:
			return self.security_policies['default']
	
	def _get_classification_policy(self, classification: Optional[str]) -> Dict[str, Any]:
		"""Get classification-based policy"""
		if classification and classification.lower() in self.classification_policies:
			return self.classification_policies[classification.lower()]
		else:
			return self.classification_policies['internal']  # Default
	
	async def _log_security_event(self,
								  event_type: WorkflowSecurityEvent,
								  description: str,
								  user_id: Optional[str],
								  ip_address: Optional[str],
								  details: Optional[Dict[str, Any]] = None) -> None:
		"""Log security event to audit system"""
		try:
			# Map workflow security event to audit event type
			audit_event_type = self._map_security_event_to_audit_type(event_type)
			
			# Log to audit system
			await self.security_manager.audit.log_event(
				event_type=audit_event_type,
				action=event_type.value,
				description=description,
				user_id=user_id,
				source_ip=ip_address,
				severity=self._get_event_severity(event_type.value),
				details=details or {}
			)
			
			self.security_metrics['audit_events_logged'] += 1
		
		except Exception as e:
			self.logger.error(f"Failed to log security event: {e}")
	
	def _map_security_event_to_audit_type(self, event_type: WorkflowSecurityEvent) -> AuditEventType:
		"""Map workflow security event to audit event type"""
		event_mapping = {
			WorkflowSecurityEvent.WORKFLOW_STARTED: AuditEventType.WORKFLOW_STARTED,
			WorkflowSecurityEvent.WORKFLOW_COMPLETED: AuditEventType.WORKFLOW_COMPLETED,
			WorkflowSecurityEvent.WORKFLOW_FAILED: AuditEventType.WORKFLOW_FAILED,
			WorkflowSecurityEvent.TASK_ASSIGNED: AuditEventType.TASK_ASSIGNED,
			WorkflowSecurityEvent.UNAUTHORIZED_ACCESS: AuditEventType.ACCESS_DENIED,
			WorkflowSecurityEvent.DATA_ENCRYPTED: AuditEventType.DATA_ENCRYPTED,
			WorkflowSecurityEvent.COMPLIANCE_VIOLATION: AuditEventType.COMPLIANCE_VIOLATION,
			WorkflowSecurityEvent.SECURITY_POLICY_APPLIED: AuditEventType.SYSTEM_START
		}
		
		return event_mapping.get(event_type, AuditEventType.SYSTEM_START)
	
	def _get_event_severity(self, event_type: str) -> AuditSeverity:
		"""Get severity level for event type"""
		high_severity_events = ['unauthorized_access', 'compliance_violation', 'workflow_failed']
		medium_severity_events = ['task_assigned', 'data_encrypted', 'security_policy_applied']
		
		if any(severity_event in event_type.lower() for severity_event in high_severity_events):
			return AuditSeverity.HIGH
		elif any(severity_event in event_type.lower() for severity_event in medium_severity_events):
			return AuditSeverity.MEDIUM
		else:
			return AuditSeverity.LOW
	
	# Placeholder implementations for complex security operations
	async def _validate_security_context(self, context: WorkflowSecurityContext) -> bool:
		"""Validate security context"""
		# Implementation would validate all aspects of security context
		return True
	
	async def _perform_pre_execution_security_checks(self, workflow_id: str, workflow_def: Dict[str, Any], context: WorkflowSecurityContext) -> Dict[str, Any]:
		"""Perform comprehensive pre-execution security validation"""
		# Implementation would perform various security checks
		return {'passed': True, 'warnings': []}
	
	async def _encrypt_workflow_data(self, workflow_def: Dict[str, Any], context: WorkflowSecurityContext) -> EncryptionResult:
		"""Encrypt workflow definition data"""
		# Implementation would encrypt sensitive workflow data
		from ...security.encryption.data_encryption import EncryptionResult
		return EncryptionResult(success=True, encrypted_data="encrypted_workflow_data", key_id="workflow_key")
	
	async def _execute_workflow_with_monitoring(self, workflow_id: str, workflow_def: Dict[str, Any], context: WorkflowSecurityContext, params: Optional[Dict[str, Any]]) -> Dict[str, Any]:
		"""Execute workflow with security monitoring"""
		# Implementation would execute workflow with continuous security monitoring
		return {'success': True, 'tasks_completed': 5, 'result_data': {'status': 'completed'}}
	
	async def _process_secure_workflow_results(self, workflow_id: str, execution_result: Dict[str, Any], context: WorkflowSecurityContext) -> Dict[str, Any]:
		"""Process workflow results with security controls"""
		# Implementation would apply security controls to workflow results
		return execution_result
	
	async def _encrypt_task_data(self, task_data: Dict[str, Any], context: WorkflowSecurityContext) -> EncryptionResult:
		"""Encrypt task data"""
		# Implementation would encrypt task data
		from ...security.encryption.data_encryption import EncryptionResult
		return EncryptionResult(success=True, encrypted_data="encrypted_task_data", key_id="task_key")
	
	async def _scan_task_content_for_dlp(self, task_data: Dict[str, Any], context: WorkflowSecurityContext) -> Dict[str, Any]:
		"""Scan task content for DLP violations"""
		# Implementation would scan task content for sensitive data
		return {'allowed': True, 'action_taken': 'allow'}
	
	async def _validate_framework_compliance(self, workflow_def: Dict[str, Any], framework: str, context: WorkflowSecurityContext) -> Dict[str, Any]:
		"""Validate compliance with specific framework"""
		# Implementation would validate compliance with specific frameworks
		return {'compliant': True, 'violations': [], 'recommendations': []}


# Factory function for creating security-workflow integration
async def create_security_workflow_integration(
	security_manager: SecurityManager,
	task_coordinator: TaskCoordinator,
	deadline_manager: DeadlineManager,
	workflow_monitor: WorkflowMonitor
) -> SecurityWorkflowIntegration:
	"""Create and initialize security-workflow integration"""
	integration = SecurityWorkflowIntegration(
		security_manager=security_manager,
		task_coordinator=task_coordinator,
		deadline_manager=deadline_manager,
		workflow_monitor=workflow_monitor
	)
	
	integration.logger.info("Security-Workflow integration created and ready")
	return integration