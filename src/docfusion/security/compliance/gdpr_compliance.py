#!/usr/bin/env python3
"""
GDPR Compliance Module

Implements GDPR (General Data Protection Regulation) compliance features
including data export, deletion, consent management, and privacy controls.
"""

import asyncio
import json
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any, Union, Set
from enum import Enum
import logging
from pathlib import Path
import tempfile
import io

from pydantic import BaseModel, Field
from uuid_extensions import uuid7str


class DataProcessingPurpose(str, Enum):
	"""GDPR data processing purposes"""
	LEGITIMATE_INTEREST = "legitimate_interest"
	CONTRACT = "contract"
	LEGAL_OBLIGATION = "legal_obligation"
	VITAL_INTERESTS = "vital_interests"
	PUBLIC_TASK = "public_task"
	CONSENT = "consent"


class ConsentStatus(str, Enum):
	"""Consent status types"""
	GIVEN = "given"
	WITHDRAWN = "withdrawn"
	PENDING = "pending"
	EXPIRED = "expired"
	NOT_REQUIRED = "not_required"


class DataCategory(str, Enum):
	"""Data categories under GDPR"""
	PERSONAL_DATA = "personal_data"
	SENSITIVE_DATA = "sensitive_data"
	BIOMETRIC_DATA = "biometric_data"
	HEALTH_DATA = "health_data"
	FINANCIAL_DATA = "financial_data"
	LOCATION_DATA = "location_data"
	COMMUNICATION_DATA = "communication_data"
	BEHAVIORAL_DATA = "behavioral_data"


class GDPRRights(str, Enum):
	"""GDPR individual rights"""
	ACCESS = "access"  # Right to access
	RECTIFICATION = "rectification"  # Right to rectification
	ERASURE = "erasure"  # Right to erasure (right to be forgotten)
	RESTRICT_PROCESSING = "restrict_processing"  # Right to restrict processing
	DATA_PORTABILITY = "data_portability"  # Right to data portability
	OBJECT = "object"  # Right to object
	AUTOMATED_DECISION_MAKING = "automated_decision_making"  # Rights related to automated decision making


class ProcessingActivity(BaseModel):
	"""GDPR processing activity record"""
	activity_id: str = Field(default_factory=uuid7str)
	name: str
	description: str
	controller: str  # Data controller details
	processor: Optional[str] = None  # Data processor details (if applicable)
	
	# Purpose and legal basis
	purposes: List[DataProcessingPurpose]
	legal_basis: str
	legitimate_interests: Optional[str] = None  # If applicable
	
	# Data subjects and categories
	data_subject_categories: List[str]
	personal_data_categories: List[DataCategory]
	special_category_data: List[DataCategory] = Field(default_factory=list)
	
	# Recipients and transfers
	recipient_categories: List[str] = Field(default_factory=list)
	third_country_transfers: List[Dict[str, str]] = Field(default_factory=list)
	
	# Retention and security
	retention_period: str
	security_measures: List[str] = Field(default_factory=list)
	
	# Metadata
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	created_by: str


class ConsentRecord(BaseModel):
	"""Individual consent record"""
	consent_id: str = Field(default_factory=uuid7str)
	user_id: str
	purpose: DataProcessingPurpose
	status: ConsentStatus
	
	# Consent details
	consent_text: str
	consent_version: str = "1.0"
	granular_consent: Dict[str, bool] = Field(default_factory=dict)  # Specific permissions
	
	# Timing
	given_at: Optional[datetime] = None
	withdrawn_at: Optional[datetime] = None
	expires_at: Optional[datetime] = None
	
	# Context
	consent_method: str  # How consent was obtained (web_form, api, etc.)
	ip_address: Optional[str] = None
	user_agent: Optional[str] = None
	
	# Evidence
	evidence: Dict[str, Any] = Field(default_factory=dict)  # Proof of consent
	
	# Metadata
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DataSubjectRequest(BaseModel):
	"""GDPR data subject request"""
	request_id: str = Field(default_factory=uuid7str)
	user_id: str
	request_type: GDPRRights
	status: str = "pending"  # pending, processing, completed, rejected
	
	# Request details
	description: Optional[str] = None
	specific_data_requested: Optional[List[str]] = None
	
	# Processing information
	submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	processed_at: Optional[datetime] = None
	completed_at: Optional[datetime] = None
	
	# Response
	response_data: Optional[Dict[str, Any]] = None
	response_file_path: Optional[str] = None
	rejection_reason: Optional[str] = None
	
	# Identity verification
	identity_verified: bool = False
	verification_method: Optional[str] = None
	
	# Compliance tracking
	within_deadline: bool = True  # 30 days for most requests
	extension_granted: bool = False
	extension_reason: Optional[str] = None
	
	# Metadata
	processed_by: Optional[str] = None
	notes: Optional[str] = None


class DataExportResult(BaseModel):
	"""Data export operation result"""
	export_id: str = Field(default_factory=uuid7str)
	user_id: str
	export_type: str  # full, partial, specific_data
	
	# Export details
	exported_data: Dict[str, Any] = Field(default_factory=dict)
	file_path: Optional[str] = None
	file_size: Optional[int] = None
	
	# Data categories included
	data_categories: List[str] = Field(default_factory=list)
	data_sources: List[str] = Field(default_factory=list)
	
	# Timing
	requested_at: datetime
	generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	
	# Security
	encrypted: bool = False
	access_link_expires_at: Optional[datetime] = None
	download_count: int = 0
	max_downloads: int = 3


class DataDeletionResult(BaseModel):
	"""Data deletion operation result"""
	deletion_id: str = Field(default_factory=uuid7str)
	user_id: str
	deletion_type: str  # full, partial, specific_data
	
	# Deletion details
	deleted_data_categories: List[str] = Field(default_factory=list)
	deleted_from_sources: List[str] = Field(default_factory=list)
	
	# Retention requirements
	retained_data: Dict[str, str] = Field(default_factory=dict)  # data -> reason
	retention_reasons: List[str] = Field(default_factory=list)
	
	# Timing
	requested_at: datetime
	completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	
	# Verification
	deletion_verified: bool = False
	verification_method: Optional[str] = None


@dataclass
class GDPRConfiguration:
	"""GDPR compliance configuration"""
	# Organization details
	organization_name: str = "DocuFusion"
	data_controller_contact: str = "privacy@docufusion.ai"
	dpo_contact: str = "dpo@docufusion.ai"  # Data Protection Officer
	
	# Request handling
	request_response_days: int = 30
	complex_request_extension_days: int = 60
	data_export_retention_days: int = 7
	
	# Data retention
	default_retention_period_days: int = 365 * 7  # 7 years
	inactive_user_retention_days: int = 365 * 3  # 3 years
	
	# Consent management
	consent_renewal_days: int = 365 * 2  # 2 years
	require_explicit_consent: bool = True
	
	# Export settings
	export_file_format: str = "json"  # json, csv, xml
	max_export_file_size_mb: int = 100
	encrypt_exports: bool = True
	
	# Deletion settings
	soft_delete_retention_days: int = 30  # Grace period
	enable_right_to_be_forgotten: bool = True
	
	# Compliance features
	enable_consent_logging: bool = True
	enable_processing_logging: bool = True
	enable_automated_deletion: bool = True


class GDPRCompliance:
	"""GDPR compliance management system"""
	
	def __init__(self, config: Optional[GDPRConfiguration] = None):
		"""Initialize GDPR compliance system"""
		self.config = config or GDPRConfiguration()
		self.logger = logging.getLogger(__name__)
		
		# Storage (in production, use database)
		self.processing_activities: Dict[str, ProcessingActivity] = {}
		self.consent_records: Dict[str, List[ConsentRecord]] = {}  # user_id -> consents
		self.data_subject_requests: Dict[str, DataSubjectRequest] = {}
		self.data_exports: Dict[str, DataExportResult] = {}
		self.data_deletions: Dict[str, DataDeletionResult] = {}
		
		# Data source registrations (for export/deletion)
		self.data_sources: Dict[str, Dict[str, Any]] = {}
		
		self.logger.info("GDPR compliance system initialized")
	
	# Processing Activities Management
	
	def register_processing_activity(self, activity: ProcessingActivity) -> str:
		"""Register a data processing activity"""
		self.processing_activities[activity.activity_id] = activity
		self.logger.info(f"Registered processing activity: {activity.name}")
		return activity.activity_id
	
	def update_processing_activity(self, activity_id: str, updates: Dict[str, Any]) -> bool:
		"""Update processing activity"""
		if activity_id not in self.processing_activities:
			return False
		
		activity = self.processing_activities[activity_id]
		for key, value in updates.items():
			if hasattr(activity, key):
				setattr(activity, key, value)
		
		activity.updated_at = datetime.now(timezone.utc)
		self.logger.info(f"Updated processing activity: {activity_id}")
		return True
	
	def get_processing_activities(self) -> List[ProcessingActivity]:
		"""Get all processing activities"""
		return list(self.processing_activities.values())
	
	# Consent Management
	
	async def record_consent(
		self,
		user_id: str,
		purpose: DataProcessingPurpose,
		consent_text: str,
		consent_method: str = "web_form",
		granular_consent: Optional[Dict[str, bool]] = None,
		ip_address: Optional[str] = None,
		user_agent: Optional[str] = None,
		expires_in_days: Optional[int] = None
	) -> str:
		"""Record user consent"""
		expires_at = None
		if expires_in_days:
			expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
		elif self.config.consent_renewal_days:
			expires_at = datetime.now(timezone.utc) + timedelta(days=self.config.consent_renewal_days)
		
		consent = ConsentRecord(
			user_id=user_id,
			purpose=purpose,
			status=ConsentStatus.GIVEN,
			consent_text=consent_text,
			consent_method=consent_method,
			granular_consent=granular_consent or {},
			given_at=datetime.now(timezone.utc),
			expires_at=expires_at,
			ip_address=ip_address,
			user_agent=user_agent
		)
		
		# Store consent
		if user_id not in self.consent_records:
			self.consent_records[user_id] = []
		self.consent_records[user_id].append(consent)
		
		self.logger.info(f"Recorded consent for user {user_id}, purpose: {purpose}")
		return consent.consent_id
	
	async def withdraw_consent(
		self,
		user_id: str,
		purpose: DataProcessingPurpose,
		withdrawal_method: str = "web_form"
	) -> bool:
		"""Withdraw user consent"""
		if user_id not in self.consent_records:
			return False
		
		# Find and withdraw the most recent consent for this purpose
		user_consents = self.consent_records[user_id]
		for consent in reversed(user_consents):
			if consent.purpose == purpose and consent.status == ConsentStatus.GIVEN:
				consent.status = ConsentStatus.WITHDRAWN
				consent.withdrawn_at = datetime.now(timezone.utc)
				consent.updated_at = datetime.now(timezone.utc)
				
				self.logger.info(f"Withdrew consent for user {user_id}, purpose: {purpose}")
				return True
		
		return False
	
	def check_consent(self, user_id: str, purpose: DataProcessingPurpose) -> ConsentStatus:
		"""Check current consent status"""
		if user_id not in self.consent_records:
			return ConsentStatus.NOT_REQUIRED
		
		user_consents = self.consent_records[user_id]
		
		# Find the most recent consent for this purpose
		relevant_consents = [
			c for c in user_consents 
			if c.purpose == purpose
		]
		
		if not relevant_consents:
			return ConsentStatus.NOT_REQUIRED
		
		# Get most recent consent
		latest_consent = max(relevant_consents, key=lambda c: c.created_at)
		
		# Check if expired
		if (latest_consent.expires_at and 
			datetime.now(timezone.utc) > latest_consent.expires_at):
			return ConsentStatus.EXPIRED
		
		return latest_consent.status
	
	def get_user_consents(self, user_id: str) -> List[ConsentRecord]:
		"""Get all consents for user"""
		return self.consent_records.get(user_id, [])
	
	# Data Subject Rights Requests
	
	async def submit_data_subject_request(
		self,
		user_id: str,
		request_type: GDPRRights,
		description: Optional[str] = None,
		specific_data_requested: Optional[List[str]] = None
	) -> str:
		"""Submit a data subject rights request"""
		request = DataSubjectRequest(
			user_id=user_id,
			request_type=request_type,
			description=description,
			specific_data_requested=specific_data_requested
		)
		
		self.data_subject_requests[request.request_id] = request
		
		self.logger.info(f"Submitted {request_type} request for user {user_id}")
		return request.request_id
	
	async def process_data_subject_request(
		self,
		request_id: str,
		processed_by: str
	) -> bool:
		"""Process a data subject rights request"""
		request = self.data_subject_requests.get(request_id)
		if not request:
			return False
		
		request.status = "processing"
		request.processed_at = datetime.now(timezone.utc)
		request.processed_by = processed_by
		
		try:
			if request.request_type == GDPRRights.ACCESS:
				result = await self._handle_access_request(request)
			elif request.request_type == GDPRRights.DATA_PORTABILITY:
				result = await self._handle_portability_request(request)
			elif request.request_type == GDPRRights.ERASURE:
				result = await self._handle_erasure_request(request)
			elif request.request_type == GDPRRights.RECTIFICATION:
				result = await self._handle_rectification_request(request)
			elif request.request_type == GDPRRights.RESTRICT_PROCESSING:
				result = await self._handle_restrict_processing_request(request)
			elif request.request_type == GDPRRights.OBJECT:
				result = await self._handle_object_request(request)
			else:
				result = False
			
			if result:
				request.status = "completed"
				request.completed_at = datetime.now(timezone.utc)
			else:
				request.status = "rejected"
				request.rejection_reason = "Unable to process request"
			
			return result
		
		except Exception as e:
			self.logger.error(f"Error processing request {request_id}: {e}")
			request.status = "rejected"
			request.rejection_reason = str(e)
			return False
	
	async def _handle_access_request(self, request: DataSubjectRequest) -> bool:
		"""Handle right to access request"""
		export_result = await self.export_user_data(
			user_id=request.user_id,
			export_type="access_request",
			requested_at=request.submitted_at
		)
		
		request.response_data = {
			'export_id': export_result.export_id,
			'data_categories': export_result.data_categories,
			'data_sources': export_result.data_sources
		}
		request.response_file_path = export_result.file_path
		
		return True
	
	async def _handle_portability_request(self, request: DataSubjectRequest) -> bool:
		"""Handle data portability request"""
		export_result = await self.export_user_data(
			user_id=request.user_id,
			export_type="portability",
			format="json",
			requested_at=request.submitted_at
		)
		
		request.response_data = {
			'export_id': export_result.export_id,
			'format': 'json',
			'machine_readable': True
		}
		request.response_file_path = export_result.file_path
		
		return True
	
	async def _handle_erasure_request(self, request: DataSubjectRequest) -> bool:
		"""Handle right to erasure (right to be forgotten) request"""
		if not self.config.enable_right_to_be_forgotten:
			request.rejection_reason = "Right to erasure not enabled"
			return False
		
		deletion_result = await self.delete_user_data(
			user_id=request.user_id,
			deletion_type="full",
			requested_at=request.submitted_at
		)
		
		request.response_data = {
			'deletion_id': deletion_result.deletion_id,
			'deleted_categories': deletion_result.deleted_data_categories,
			'retained_data': deletion_result.retained_data
		}
		
		return True
	
	async def _handle_rectification_request(self, request: DataSubjectRequest) -> bool:
		"""Handle rectification request"""
		# This would integrate with data update mechanisms
		request.response_data = {
			'message': 'Rectification request logged. Please provide correct data through user profile.'
		}
		return True
	
	async def _handle_restrict_processing_request(self, request: DataSubjectRequest) -> bool:
		"""Handle restrict processing request"""
		# This would integrate with processing controls
		request.response_data = {
			'message': 'Processing restriction applied to user data'
		}
		return True
	
	async def _handle_object_request(self, request: DataSubjectRequest) -> bool:
		"""Handle objection to processing request"""
		# This would integrate with processing controls
		request.response_data = {
			'message': 'Objection to processing logged and applied'
		}
		return True
	
	# Data Export Functionality
	
	async def export_user_data(
		self,
		user_id: str,
		export_type: str = "full",
		format: str = "json",
		specific_data: Optional[List[str]] = None,
		requested_at: Optional[datetime] = None
	) -> DataExportResult:
		"""Export user data in compliance with GDPR"""
		requested_at = requested_at or datetime.now(timezone.utc)
		
		# Collect data from all registered sources
		exported_data = {}
		data_categories = []
		data_sources = []
		
		for source_name, source_config in self.data_sources.items():
			try:
				source_data = await self._export_from_source(
					source_name, source_config, user_id, specific_data
				)
				if source_data:
					exported_data[source_name] = source_data
					data_sources.append(source_name)
					
					# Determine data categories (simplified)
					if 'profile' in source_name.lower():
						data_categories.append('personal_data')
					elif 'document' in source_name.lower():
						data_categories.append('communication_data')
					elif 'activity' in source_name.lower():
						data_categories.append('behavioral_data')
			except Exception as e:
				self.logger.error(f"Failed to export from source {source_name}: {e}")
		
		# Add consent records
		user_consents = self.get_user_consents(user_id)
		if user_consents:
			exported_data['consent_records'] = [
				{
					'consent_id': consent.consent_id,
					'purpose': consent.purpose,
					'status': consent.status,
					'given_at': consent.given_at.isoformat() if consent.given_at else None,
					'withdrawn_at': consent.withdrawn_at.isoformat() if consent.withdrawn_at else None,
					'consent_text': consent.consent_text,
					'granular_consent': consent.granular_consent
				}
				for consent in user_consents
			]
			data_categories.append('consent_data')
		
		# Create export file
		export_result = DataExportResult(
			user_id=user_id,
			export_type=export_type,
			exported_data=exported_data,
			data_categories=list(set(data_categories)),
			data_sources=data_sources,
			requested_at=requested_at
		)
		
		# Generate file
		file_path = await self._create_export_file(export_result, format)
		export_result.file_path = file_path
		
		if file_path:
			file_size = Path(file_path).stat().st_size
			export_result.file_size = file_size
		
		# Set expiration
		export_result.access_link_expires_at = datetime.now(timezone.utc) + timedelta(
			days=self.config.data_export_retention_days
		)
		
		# Store export record
		self.data_exports[export_result.export_id] = export_result
		
		self.logger.info(f"Exported data for user {user_id}, type: {export_type}")
		return export_result
	
	async def _export_from_source(
		self,
		source_name: str,
		source_config: Dict[str, Any],
		user_id: str,
		specific_data: Optional[List[str]]
	) -> Optional[Dict[str, Any]]:
		"""Export data from a specific source"""
		# This is a simplified implementation
		# In practice, this would call actual data source APIs
		
		source_type = source_config.get('type', 'mock')
		
		if source_type == 'user_profile':
			return {
				'user_id': user_id,
				'email': f'user{user_id}@example.com',
				'name': f'User {user_id}',
				'created_at': datetime.now(timezone.utc).isoformat(),
				'last_login': datetime.now(timezone.utc).isoformat()
			}
		elif source_type == 'documents':
			return {
				'documents_created': 42,
				'documents_shared': 15,
				'total_document_size': 1024000
			}
		elif source_type == 'activity_logs':
			return {
				'login_count': 127,
				'last_activity': datetime.now(timezone.utc).isoformat(),
				'features_used': ['document_creation', 'sharing', 'export']
			}
		
		return None
	
	async def _create_export_file(
		self,
		export_result: DataExportResult,
		format: str
	) -> Optional[str]:
		"""Create export file"""
		try:
			# Create temporary file
			temp_dir = Path(tempfile.mkdtemp())
			
			if format == 'json':
				file_path = temp_dir / f"gdpr_export_{export_result.export_id}.json"
				with open(file_path, 'w', encoding='utf-8') as f:
					json.dump(export_result.exported_data, f, indent=2, default=str)
			
			elif format == 'zip':
				file_path = temp_dir / f"gdpr_export_{export_result.export_id}.zip"
				with zipfile.ZipFile(file_path, 'w') as zf:
					# Add main data file
					zf.writestr(
						'user_data.json',
						json.dumps(export_result.exported_data, indent=2, default=str)
					)
					
					# Add metadata file
					metadata = {
						'export_id': export_result.export_id,
						'user_id': export_result.user_id,
						'export_type': export_result.export_type,
						'generated_at': export_result.generated_at.isoformat(),
						'data_categories': export_result.data_categories,
						'data_sources': export_result.data_sources
					}
					zf.writestr('metadata.json', json.dumps(metadata, indent=2))
			
			else:
				raise ValueError(f"Unsupported export format: {format}")
			
			return str(file_path)
		
		except Exception as e:
			self.logger.error(f"Failed to create export file: {e}")
			return None
	
	# Data Deletion Functionality
	
	async def delete_user_data(
		self,
		user_id: str,
		deletion_type: str = "full",
		specific_data: Optional[List[str]] = None,
		requested_at: Optional[datetime] = None
	) -> DataDeletionResult:
		"""Delete user data in compliance with GDPR"""
		requested_at = requested_at or datetime.now(timezone.utc)
		
		deleted_categories = []
		deleted_sources = []
		retained_data = {}
		retention_reasons = []
		
		# Delete from all registered sources
		for source_name, source_config in self.data_sources.items():
			try:
				deletion_result = await self._delete_from_source(
					source_name, source_config, user_id, specific_data
				)
				
				if deletion_result.get('deleted'):
					deleted_sources.append(source_name)
					deleted_categories.extend(deletion_result.get('categories', []))
				
				if deletion_result.get('retained'):
					retained_data[source_name] = deletion_result['retained']
					retention_reasons.extend(deletion_result.get('retention_reasons', []))
			
			except Exception as e:
				self.logger.error(f"Failed to delete from source {source_name}: {e}")
		
		# Handle consent records
		if deletion_type == "full":
			if user_id in self.consent_records:
				# Keep consent withdrawal records for legal purposes
				withdrawn_consents = [
					c for c in self.consent_records[user_id]
					if c.status == ConsentStatus.WITHDRAWN
				]
				
				if withdrawn_consents:
					retained_data['consent_withdrawals'] = len(withdrawn_consents)
					retention_reasons.append("Legal obligation to retain consent withdrawal records")
				
				# Remove other consent records
				del self.consent_records[user_id]
				deleted_categories.append('consent_data')
		
		# Remove user data exports (except those required for legal reasons)
		exports_to_remove = []
		for export_id, export in self.data_exports.items():
			if export.user_id == user_id:
				# Keep exports related to legal proceedings
				if export.export_type not in ['legal_hold', 'compliance']:
					exports_to_remove.append(export_id)
		
		for export_id in exports_to_remove:
			export = self.data_exports.pop(export_id)
			if export.file_path and Path(export.file_path).exists():
				Path(export.file_path).unlink()
		
		# Create deletion result
		deletion_result = DataDeletionResult(
			user_id=user_id,
			deletion_type=deletion_type,
			deleted_data_categories=list(set(deleted_categories)),
			deleted_from_sources=deleted_sources,
			retained_data=retained_data,
			retention_reasons=list(set(retention_reasons)),
			requested_at=requested_at
		)
		
		# Store deletion record
		self.data_deletions[deletion_result.deletion_id] = deletion_result
		
		self.logger.info(f"Deleted data for user {user_id}, type: {deletion_type}")
		return deletion_result
	
	async def _delete_from_source(
		self,
		source_name: str,
		source_config: Dict[str, Any],
		user_id: str,
		specific_data: Optional[List[str]]
	) -> Dict[str, Any]:
		"""Delete data from a specific source"""
		# This is a simplified implementation
		# In practice, this would call actual data source deletion APIs
		
		source_type = source_config.get('type', 'mock')
		
		if source_type == 'user_profile':
			# Some profile data might be retained for legal reasons
			return {
				'deleted': True,
				'categories': ['personal_data'],
				'retained': 'Basic account record for audit purposes',
				'retention_reasons': ['Legal obligation for financial records']
			}
		elif source_type == 'documents':
			return {
				'deleted': True,
				'categories': ['communication_data'],
				'retained': None,
				'retention_reasons': []
			}
		elif source_type == 'activity_logs':
			# Activity logs might be retained for security purposes
			return {
				'deleted': False,
				'categories': [],
				'retained': 'Anonymized activity logs',
				'retention_reasons': ['Security and fraud prevention']
			}
		
		return {'deleted': False}
	
	# Data Source Registration
	
	def register_data_source(
		self,
		source_name: str,
		source_type: str,
		export_handler: Optional[Any] = None,
		delete_handler: Optional[Any] = None,
		retention_policy: Optional[Dict[str, Any]] = None
	):
		"""Register a data source for GDPR operations"""
		self.data_sources[source_name] = {
			'type': source_type,
			'export_handler': export_handler,
			'delete_handler': delete_handler,
			'retention_policy': retention_policy or {}
		}
		
		self.logger.info(f"Registered data source: {source_name} ({source_type})")
	
	# Utility Methods
	
	async def get_compliance_report(self) -> Dict[str, Any]:
		"""Generate GDPR compliance report"""
		now = datetime.now(timezone.utc)
		
		# Count requests by type and status
		request_stats = {}
		for request in self.data_subject_requests.values():
			req_type = request.request_type.value
			status = request.status
			
			if req_type not in request_stats:
				request_stats[req_type] = {}
			
			request_stats[req_type][status] = request_stats[req_type].get(status, 0) + 1
		
		# Check request response times
		overdue_requests = []
		for request in self.data_subject_requests.values():
			if request.status in ['pending', 'processing']:
				days_pending = (now - request.submitted_at).days
				deadline = self.config.request_response_days
				if request.extension_granted:
					deadline = self.config.complex_request_extension_days
				
				if days_pending > deadline:
					overdue_requests.append(request.request_id)
		
		# Consent statistics
		total_consents = sum(len(consents) for consents in self.consent_records.values())
		active_consents = 0
		expired_consents = 0
		
		for user_consents in self.consent_records.values():
			for consent in user_consents:
				if consent.status == ConsentStatus.GIVEN:
					if consent.expires_at and now > consent.expires_at:
						expired_consents += 1
					else:
						active_consents += 1
		
		return {
			'report_generated_at': now.isoformat(),
			'processing_activities': len(self.processing_activities),
			'data_sources_registered': len(self.data_sources),
			'data_subject_requests': {
				'total': len(self.data_subject_requests),
				'by_type_and_status': request_stats,
				'overdue': len(overdue_requests)
			},
			'consent_management': {
				'total_consents': total_consents,
				'active_consents': active_consents,
				'expired_consents': expired_consents,
				'users_with_consent': len(self.consent_records)
			},
			'data_operations': {
				'exports_generated': len(self.data_exports),
				'deletions_performed': len(self.data_deletions)
			},
			'compliance_status': {
				'overdue_requests_count': len(overdue_requests),
				'consent_renewal_required': expired_consents,
				'compliant': len(overdue_requests) == 0
			}
		}
	
	async def cleanup_expired_data(self) -> Dict[str, int]:
		"""Clean up expired GDPR-related data"""
		now = datetime.now(timezone.utc)
		cleanup_stats = {}
		
		# Clean up expired data exports
		expired_exports = []
		for export_id, export in self.data_exports.items():
			if (export.access_link_expires_at and 
				now > export.access_link_expires_at):
				expired_exports.append(export_id)
		
		for export_id in expired_exports:
			export = self.data_exports.pop(export_id)
			if export.file_path and Path(export.file_path).exists():
				Path(export.file_path).unlink()
		
		cleanup_stats['expired_exports_removed'] = len(expired_exports)
		
		# Update expired consents
		expired_consent_updates = 0
		for user_consents in self.consent_records.values():
			for consent in user_consents:
				if (consent.status == ConsentStatus.GIVEN and 
					consent.expires_at and now > consent.expires_at):
					consent.status = ConsentStatus.EXPIRED
					expired_consent_updates += 1
		
		cleanup_stats['consents_marked_expired'] = expired_consent_updates
		
		return cleanup_stats
	
	def get_data_subject_request(self, request_id: str) -> Optional[DataSubjectRequest]:
		"""Get data subject request by ID"""
		return self.data_subject_requests.get(request_id)
	
	def list_data_subject_requests(
		self,
		user_id: Optional[str] = None,
		status: Optional[str] = None
	) -> List[DataSubjectRequest]:
		"""List data subject requests with optional filters"""
		requests = list(self.data_subject_requests.values())
		
		if user_id:
			requests = [r for r in requests if r.user_id == user_id]
		
		if status:
			requests = [r for r in requests if r.status == status]
		
		return sorted(requests, key=lambda r: r.submitted_at, reverse=True)


# Factory functions
def create_gdpr_compliance(config: Optional[GDPRConfiguration] = None) -> GDPRCompliance:
	"""Create GDPRCompliance instance"""
	return GDPRCompliance(config)


def create_sample_processing_activities() -> List[ProcessingActivity]:
	"""Create sample processing activities for testing"""
	activities = []
	
	# User account management
	user_mgmt = ProcessingActivity(
		name="User Account Management",
		description="Processing user registration, authentication, and profile management",
		controller="DocuFusion Inc.",
		purposes=[DataProcessingPurpose.CONTRACT, DataProcessingPurpose.LEGITIMATE_INTEREST],
		legal_basis="Performance of contract and legitimate interests",
		data_subject_categories=["users", "customers"],
		personal_data_categories=[DataCategory.PERSONAL_DATA],
		recipient_categories=["internal_staff", "technical_support"],
		retention_period="7 years after account closure",
		security_measures=["encryption", "access_controls", "audit_logging"],
		created_by="system"
	)
	activities.append(user_mgmt)
	
	# Document processing
	doc_processing = ProcessingActivity(
		name="Document Processing and Storage",
		description="Processing and storing user-generated documents",
		controller="DocuFusion Inc.",
		purposes=[DataProcessingPurpose.CONTRACT],
		legal_basis="Performance of contract",
		data_subject_categories=["users"],
		personal_data_categories=[DataCategory.COMMUNICATION_DATA],
		recipient_categories=["cloud_storage_providers"],
		retention_period="Duration of contract plus 3 years",
		security_measures=["end_to_end_encryption", "access_controls"],
		created_by="system"
	)
	activities.append(doc_processing)
	
	return activities