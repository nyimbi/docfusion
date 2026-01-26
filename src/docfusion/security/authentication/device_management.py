#!/usr/bin/env python3
"""
Device Management and Trusted Devices Module

Implements device registration, trust management, and security policies
for managing user devices accessing the system. Integrates with WebAuthn
for device-based authentication and provides comprehensive device security.
"""

import asyncio
import hashlib
import secrets
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any, Union, Set
from enum import Enum
import logging
from pathlib import Path
import tempfile
import ipaddress

from pydantic import BaseModel, Field, validator
from uuid_extensions import uuid7str


class DeviceType(str, Enum):
	"""Device types"""
	DESKTOP = "desktop"
	LAPTOP = "laptop"
	MOBILE = "mobile"
	TABLET = "tablet"
	BROWSER = "browser"
	API_CLIENT = "api_client"
	UNKNOWN = "unknown"


class DeviceStatus(str, Enum):
	"""Device status"""
	PENDING = "pending"  # Device registered but not yet trusted
	TRUSTED = "trusted"  # Device is trusted
	BLOCKED = "blocked"  # Device is blocked
	EXPIRED = "expired"  # Trust has expired
	REVOKED = "revoked"  # Trust has been revoked


class TrustLevel(str, Enum):
	"""Device trust levels"""
	HIGH = "high"  # Full access, minimal additional verification
	MEDIUM = "medium"  # Standard access, some additional verification
	LOW = "low"  # Limited access, frequent verification required
	UNTRUSTED = "untrusted"  # No trust, full verification always required


class DeviceRiskLevel(str, Enum):
	"""Device risk assessment levels"""
	VERY_LOW = "very_low"
	LOW = "low"
	MEDIUM = "medium"
	HIGH = "high"
	CRITICAL = "critical"


class DeviceFingerprint(BaseModel):
	"""Device fingerprint for identification"""
	fingerprint_id: str = Field(default_factory=uuid7str)
	
	# Browser/client fingerprinting
	user_agent: str
	screen_resolution: Optional[str] = None
	timezone: Optional[str] = None
	language: Optional[str] = None
	platform: Optional[str] = None
	
	# Network fingerprinting
	ip_address: str
	ip_geolocation: Optional[Dict[str, Any]] = None
	
	# Hardware fingerprinting (when available)
	hardware_concurrency: Optional[int] = None
	device_memory: Optional[int] = None
	canvas_fingerprint: Optional[str] = None
	webgl_fingerprint: Optional[str] = None
	
	# Additional identifiers
	browser_features: List[str] = Field(default_factory=list)
	installed_plugins: List[str] = Field(default_factory=list)
	
	# Metadata
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	confidence_score: float = 0.0  # 0.0 to 1.0
	
	@validator('ip_address')
	def validate_ip_address(cls, v):
		try:
			ipaddress.ip_address(v)
			return v
		except ValueError:
			raise ValueError('Invalid IP address format')


class TrustedDevice(BaseModel):
	"""Trusted device record"""
	device_id: str = Field(default_factory=uuid7str)
	user_id: str
	device_name: str
	device_type: DeviceType
	status: DeviceStatus = DeviceStatus.PENDING
	trust_level: TrustLevel = TrustLevel.UNTRUSTED
	
	# Device identification
	device_fingerprint: DeviceFingerprint
	webauthn_credential_ids: List[str] = Field(default_factory=list)
	device_token: Optional[str] = None  # For mobile push notifications
	
	# Trust establishment
	trusted_at: Optional[datetime] = None
	trust_expires_at: Optional[datetime] = None
	trust_established_by: Optional[str] = None  # admin user_id or "self"
	
	# Security attributes
	last_seen_ip: str
	last_seen_location: Optional[Dict[str, Any]] = None
	security_features: Dict[str, bool] = Field(default_factory=dict)  # screen_lock, biometrics, etc.
	
	# Risk assessment
	risk_level: DeviceRiskLevel = DeviceRiskLevel.MEDIUM
	risk_factors: List[str] = Field(default_factory=list)
	risk_score: float = 0.5  # 0.0 (no risk) to 1.0 (maximum risk)
	
	# Usage tracking
	first_seen: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	last_activity: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	login_count: int = 0
	failed_attempts: int = 0
	
	# Compliance and policies
	complies_with_policy: bool = True
	policy_violations: List[str] = Field(default_factory=list)
	
	# Management
	managed_by_mdm: bool = False  # Mobile Device Management
	mdm_compliance: Optional[Dict[str, Any]] = None
	
	# Metadata
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	notes: Optional[str] = None


class DevicePolicy(BaseModel):
	"""Device management policy"""
	policy_id: str = Field(default_factory=uuid7str)
	policy_name: str
	description: str
	
	# Trust requirements
	require_webauthn: bool = True
	require_screen_lock: bool = True
	require_encryption: bool = True
	require_biometrics: bool = False
	require_mdm: bool = False
	
	# Network restrictions
	allowed_ip_ranges: List[str] = Field(default_factory=list)
	blocked_ip_ranges: List[str] = Field(default_factory=list)
	allowed_countries: List[str] = Field(default_factory=list)
	blocked_countries: List[str] = Field(default_factory=list)
	
	# Device restrictions
	allowed_device_types: List[DeviceType] = Field(default_factory=list)
	blocked_device_types: List[DeviceType] = Field(default_factory=list)
	max_devices_per_user: int = 10
	
	# Trust management
	trust_duration_days: int = 90
	require_reauth_after_days: int = 30
	auto_trust_threshold: float = 0.8  # Confidence score threshold for auto-trust
	
	# Risk management
	max_allowed_risk_score: float = 0.7
	block_high_risk_devices: bool = True
	require_admin_approval: bool = False
	
	# Activity requirements
	max_failed_attempts: int = 5
	lockout_duration_minutes: int = 30
	
	# Compliance
	enforce_os_version: bool = False
	min_os_versions: Dict[str, str] = Field(default_factory=dict)  # platform -> version
	
	# Metadata
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	created_by: str
	active: bool = True


class DeviceSecurityEvent(BaseModel):
	"""Device security event record"""
	event_id: str = Field(default_factory=uuid7str)
	device_id: str
	user_id: str
	event_type: str  # login, failed_login, policy_violation, risk_change, etc.
	
	# Event details
	description: str
	severity: str  # low, medium, high, critical
	
	# Context
	ip_address: Optional[str] = None
	location: Optional[Dict[str, Any]] = None
	user_agent: Optional[str] = None
	
	# Response
	action_taken: Optional[str] = None
	requires_attention: bool = False
	
	# Metadata
	timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	resolved: bool = False
	resolved_at: Optional[datetime] = None
	resolved_by: Optional[str] = None


@dataclass
class DeviceManagementConfig:
	"""Device management configuration"""
	# Default policy settings
	default_trust_duration_days: int = 90
	default_max_devices_per_user: int = 10
	default_require_webauthn: bool = True
	
	# Risk assessment
	enable_risk_assessment: bool = True
	risk_assessment_interval_hours: int = 24
	auto_block_critical_risk: bool = True
	
	# Fingerprinting
	enable_device_fingerprinting: bool = True
	fingerprint_confidence_threshold: float = 0.7
	fingerprint_match_threshold: float = 0.85
	
	# Geolocation
	enable_geolocation_tracking: bool = True
	suspicious_location_threshold_km: float = 500.0
	
	# Trust management
	enable_auto_trust: bool = True
	auto_trust_confidence_threshold: float = 0.8
	require_admin_approval_for_new_devices: bool = False
	
	# Cleanup and maintenance
	cleanup_expired_devices_days: int = 365
	cleanup_inactive_devices_days: int = 180
	
	# Integration settings
	webauthn_integration: bool = True
	mdm_integration: bool = False
	
	# Monitoring
	enable_anomaly_detection: bool = True
	alert_on_new_device: bool = True
	alert_on_suspicious_activity: bool = True


class DeviceManager:
	"""Device management and trusted devices system"""
	
	def __init__(self, config: Optional[DeviceManagementConfig] = None):
		"""Initialize device manager"""
		self.config = config or DeviceManagementConfig()
		self.logger = logging.getLogger(__name__)
		
		# Storage (in production, use database)
		self.trusted_devices: Dict[str, TrustedDevice] = {}
		self.device_policies: Dict[str, DevicePolicy] = {}
		self.security_events: Dict[str, DeviceSecurityEvent] = {}
		
		# Device lookups
		self.user_devices: Dict[str, Set[str]] = {}  # user_id -> device_ids
		self.fingerprint_lookup: Dict[str, str] = {}  # fingerprint_hash -> device_id
		
		# Default policy
		self._create_default_policy()
		
		self.logger.info("Device management system initialized")
	
	def _create_default_policy(self):
		"""Create default device policy"""
		default_policy = DevicePolicy(
			policy_name="Default Device Policy",
			description="Default security policy for device management",
			require_webauthn=self.config.default_require_webauthn,
			max_devices_per_user=self.config.default_max_devices_per_user,
			trust_duration_days=self.config.default_trust_duration_days,
			created_by="system"
		)
		self.device_policies["default"] = default_policy
	
	# Device Registration and Management
	
	async def register_device(
		self,
		user_id: str,
		device_name: str,
		device_type: DeviceType,
		device_fingerprint: DeviceFingerprint,
		webauthn_credential_id: Optional[str] = None,
		security_features: Optional[Dict[str, bool]] = None
	) -> str:
		"""Register a new device for user"""
		try:
			# Check if user has reached device limit
			user_device_count = len(self.user_devices.get(user_id, set()))
			policy = self.device_policies.get("default")
			
			if user_device_count >= policy.max_devices_per_user:
				raise ValueError(f"User has reached maximum device limit ({policy.max_devices_per_user})")
			
			# Check if device fingerprint already exists
			fingerprint_hash = self._hash_fingerprint(device_fingerprint)
			existing_device_id = self.fingerprint_lookup.get(fingerprint_hash)
			
			if existing_device_id and existing_device_id in self.trusted_devices:
				existing_device = self.trusted_devices[existing_device_id]
				if existing_device.user_id != user_id:
					# Device is associated with different user - potential security issue
					await self._log_security_event(
						existing_device_id,
						user_id,
						"device_fingerprint_collision",
						"Device fingerprint matches different user's device",
						severity="high",
						ip_address=device_fingerprint.ip_address
					)
					raise ValueError("Device appears to be already registered to different user")
				
				# Update existing device
				existing_device.device_name = device_name
				existing_device.last_activity = datetime.now(timezone.utc)
				existing_device.last_seen_ip = device_fingerprint.ip_address
				if webauthn_credential_id and webauthn_credential_id not in existing_device.webauthn_credential_ids:
					existing_device.webauthn_credential_ids.append(webauthn_credential_id)
				
				self.logger.info(f"Updated existing device {existing_device_id} for user {user_id}")
				return existing_device_id
			
			# Create new device
			device = TrustedDevice(
				user_id=user_id,
				device_name=device_name,
				device_type=device_type,
				device_fingerprint=device_fingerprint,
				last_seen_ip=device_fingerprint.ip_address,
				security_features=security_features or {},
				webauthn_credential_ids=[webauthn_credential_id] if webauthn_credential_id else []
			)
			
			# Perform risk assessment
			await self._assess_device_risk(device)
			
			# Check policy compliance
			await self._check_policy_compliance(device)
			
			# Determine initial trust level and status
			await self._determine_initial_trust(device, policy)
			
			# Store device
			self.trusted_devices[device.device_id] = device
			self.fingerprint_lookup[fingerprint_hash] = device.device_id
			
			# Update user device mapping
			if user_id not in self.user_devices:
				self.user_devices[user_id] = set()
			self.user_devices[user_id].add(device.device_id)
			
			# Log security event
			await self._log_security_event(
				device.device_id,
				user_id,
				"device_registered",
				f"New device registered: {device_name}",
				severity="medium",
				ip_address=device_fingerprint.ip_address
			)
			
			self.logger.info(f"Registered new device {device.device_id} for user {user_id}")
			return device.device_id
		
		except Exception as e:
			self.logger.error(f"Device registration failed: {e}")
			raise
	
	async def trust_device(
		self,
		device_id: str,
		trust_level: TrustLevel,
		trusted_by: str,
		trust_duration_days: Optional[int] = None
	) -> bool:
		"""Establish trust for a device"""
		device = self.trusted_devices.get(device_id)
		if not device:
			return False
		
		try:
			# Set trust parameters
			device.status = DeviceStatus.TRUSTED
			device.trust_level = trust_level
			device.trusted_at = datetime.now(timezone.utc)
			device.trust_established_by = trusted_by
			
			# Set expiration
			if trust_duration_days:
				device.trust_expires_at = datetime.now(timezone.utc) + timedelta(days=trust_duration_days)
			else:
				policy = self.device_policies.get("default")
				device.trust_expires_at = datetime.now(timezone.utc) + timedelta(days=policy.trust_duration_days)
			
			device.updated_at = datetime.now(timezone.utc)
			
			# Log security event
			await self._log_security_event(
				device_id,
				device.user_id,
				"device_trusted",
				f"Device trust established at {trust_level} level",
				severity="low"
			)
			
			self.logger.info(f"Established trust for device {device_id} at {trust_level} level")
			return True
		
		except Exception as e:
			self.logger.error(f"Failed to trust device {device_id}: {e}")
			return False
	
	async def revoke_device_trust(
		self,
		device_id: str,
		revoked_by: str,
		reason: str = "Trust revoked by administrator"
	) -> bool:
		"""Revoke trust for a device"""
		device = self.trusted_devices.get(device_id)
		if not device:
			return False
		
		try:
			device.status = DeviceStatus.REVOKED
			device.trust_level = TrustLevel.UNTRUSTED
			device.updated_at = datetime.now(timezone.utc)
			device.notes = f"Trust revoked: {reason}"
			
			# Log security event
			await self._log_security_event(
				device_id,
				device.user_id,
				"device_trust_revoked",
				f"Device trust revoked: {reason}",
				severity="medium"
			)
			
			self.logger.info(f"Revoked trust for device {device_id}: {reason}")
			return True
		
		except Exception as e:
			self.logger.error(f"Failed to revoke device trust {device_id}: {e}")
			return False
	
	async def block_device(
		self,
		device_id: str,
		blocked_by: str,
		reason: str = "Device blocked by administrator"
	) -> bool:
		"""Block a device"""
		device = self.trusted_devices.get(device_id)
		if not device:
			return False
		
		try:
			device.status = DeviceStatus.BLOCKED
			device.trust_level = TrustLevel.UNTRUSTED
			device.updated_at = datetime.now(timezone.utc)
			device.notes = f"Device blocked: {reason}"
			
			# Log security event
			await self._log_security_event(
				device_id,
				device.user_id,
				"device_blocked",
				f"Device blocked: {reason}",
				severity="high"
			)
			
			self.logger.info(f"Blocked device {device_id}: {reason}")
			return True
		
		except Exception as e:
			self.logger.error(f"Failed to block device {device_id}: {e}")
			return False
	
	# Device Verification and Authentication
	
	async def verify_device(
		self,
		user_id: str,
		device_fingerprint: DeviceFingerprint,
		webauthn_credential_id: Optional[str] = None
	) -> Dict[str, Any]:
		"""Verify device for authentication"""
		try:
			# Find device by fingerprint
			fingerprint_hash = self._hash_fingerprint(device_fingerprint)
			device_id = self.fingerprint_lookup.get(fingerprint_hash)
			
			if not device_id:
				return {
					'verified': False,
					'device_id': None,
					'trust_level': TrustLevel.UNTRUSTED,
					'reason': 'Device not recognized'
				}
			
			device = self.trusted_devices.get(device_id)
			if not device or device.user_id != user_id:
				return {
					'verified': False,
					'device_id': device_id,
					'trust_level': TrustLevel.UNTRUSTED,
					'reason': 'Device not associated with user'
				}
			
			# Check device status
			if device.status == DeviceStatus.BLOCKED:
				return {
					'verified': False,
					'device_id': device_id,
					'trust_level': TrustLevel.UNTRUSTED,
					'reason': 'Device is blocked'
				}
			
			# Check trust expiration
			if device.trust_expires_at and datetime.now(timezone.utc) > device.trust_expires_at:
				device.status = DeviceStatus.EXPIRED
				device.trust_level = TrustLevel.UNTRUSTED
				return {
					'verified': False,
					'device_id': device_id,
					'trust_level': TrustLevel.UNTRUSTED,
					'reason': 'Device trust has expired'
				}
			
			# Verify WebAuthn credential if provided
			webauthn_verified = True
			if webauthn_credential_id:
				webauthn_verified = webauthn_credential_id in device.webauthn_credential_ids
			
			# Update device activity
			device.last_activity = datetime.now(timezone.utc)
			device.last_seen_ip = device_fingerprint.ip_address
			device.login_count += 1
			
			# Perform additional security checks
			security_checks = await self._perform_security_checks(device, device_fingerprint)
			
			verification_result = {
				'verified': webauthn_verified and security_checks['passed'],
				'device_id': device_id,
				'trust_level': device.trust_level,
				'requires_additional_auth': not (device.status == DeviceStatus.TRUSTED and device.trust_level in [TrustLevel.HIGH, TrustLevel.MEDIUM]),
				'security_warnings': security_checks.get('warnings', []),
				'risk_level': device.risk_level
			}
			
			if not verification_result['verified']:
				device.failed_attempts += 1
				verification_result['reason'] = 'Security verification failed'
			
			return verification_result
		
		except Exception as e:
			self.logger.error(f"Device verification failed: {e}")
			return {
				'verified': False,
				'device_id': None,
				'trust_level': TrustLevel.UNTRUSTED,
				'reason': f'Verification error: {str(e)}'
			}
	
	async def _perform_security_checks(
		self,
		device: TrustedDevice,
		current_fingerprint: DeviceFingerprint
	) -> Dict[str, Any]:
		"""Perform additional security checks on device"""
		warnings = []
		passed = True
		
		try:
			# Check IP address changes
			if device.last_seen_ip != current_fingerprint.ip_address:
				# Check if it's a significant location change
				if self.config.enable_geolocation_tracking:
					distance = await self._calculate_location_distance(
						device.last_seen_location,
						current_fingerprint.ip_geolocation
					)
					
					if distance and distance > self.config.suspicious_location_threshold_km:
						warnings.append(f"Suspicious location change: {distance:.1f} km")
						# Don't fail verification, but flag for attention
			
			# Check fingerprint consistency
			fingerprint_similarity = self._calculate_fingerprint_similarity(
				device.device_fingerprint,
				current_fingerprint
			)
			
			if fingerprint_similarity < self.config.fingerprint_match_threshold:
				warnings.append(f"Device fingerprint mismatch (similarity: {fingerprint_similarity:.2f})")
				passed = False
			
			# Check policy compliance
			policy_check = await self._check_policy_compliance(device)
			if not policy_check:
				warnings.append("Device does not comply with security policy")
				passed = False
			
			# Check risk level
			await self._assess_device_risk(device)
			if device.risk_level == DeviceRiskLevel.CRITICAL:
				warnings.append("Device assessed as critical risk")
				passed = False
			elif device.risk_level == DeviceRiskLevel.HIGH:
				warnings.append("Device assessed as high risk")
			
			return {
				'passed': passed,
				'warnings': warnings,
				'fingerprint_similarity': fingerprint_similarity
			}
		
		except Exception as e:
			self.logger.error(f"Security checks failed: {e}")
			return {
				'passed': False,
				'warnings': [f"Security check error: {str(e)}"]
			}
	
	# Risk Assessment and Security Analytics
	
	async def _assess_device_risk(self, device: TrustedDevice):
		"""Assess and update device risk level"""
		try:
			risk_factors = []
			risk_score = 0.0
			
			# IP reputation and geolocation risks
			if await self._is_suspicious_ip(device.last_seen_ip):
				risk_factors.append("suspicious_ip")
				risk_score += 0.3
			
			# Failed authentication attempts
			if device.failed_attempts > 3:
				risk_factors.append("multiple_failed_attempts")
				risk_score += 0.2
			
			# Device type risks
			if device.device_type in [DeviceType.UNKNOWN, DeviceType.API_CLIENT]:
				risk_factors.append("unknown_device_type")
				risk_score += 0.1
			
			# Security feature compliance
			if not device.security_features.get("screen_lock", False):
				risk_factors.append("no_screen_lock")
				risk_score += 0.15
			
			if not device.security_features.get("encryption", False):
				risk_factors.append("no_encryption")
				risk_score += 0.2
			
			# WebAuthn availability
			if not device.webauthn_credential_ids:
				risk_factors.append("no_webauthn")
				risk_score += 0.1
			
			# Activity patterns
			if device.login_count == 0:  # New device
				risk_factors.append("new_device")
				risk_score += 0.1
			
			# Time-based risks (e.g., access from unusual hours)
			current_hour = datetime.now().hour
			if current_hour < 6 or current_hour > 22:  # Outside business hours
				risk_factors.append("unusual_time_access")
				risk_score += 0.05
			
			# Update device risk assessment
			device.risk_factors = risk_factors
			device.risk_score = min(risk_score, 1.0)
			
			# Determine risk level
			if risk_score >= 0.8:
				device.risk_level = DeviceRiskLevel.CRITICAL
			elif risk_score >= 0.6:
				device.risk_level = DeviceRiskLevel.HIGH
			elif risk_score >= 0.4:
				device.risk_level = DeviceRiskLevel.MEDIUM
			elif risk_score >= 0.2:
				device.risk_level = DeviceRiskLevel.LOW
			else:
				device.risk_level = DeviceRiskLevel.VERY_LOW
			
			# Auto-block if critical risk and policy allows
			if (device.risk_level == DeviceRiskLevel.CRITICAL and 
				self.config.auto_block_critical_risk):
				await self.block_device(
					device.device_id,
					"system",
					"Automatically blocked due to critical risk assessment"
				)
		
		except Exception as e:
			self.logger.error(f"Risk assessment failed for device {device.device_id}: {e}")
			device.risk_level = DeviceRiskLevel.HIGH  # Err on the side of caution
	
	async def _is_suspicious_ip(self, ip_address: str) -> bool:
		"""Check if IP address is suspicious"""
		# This is a simplified implementation
		# In practice, you'd integrate with threat intelligence feeds
		try:
			ip = ipaddress.ip_address(ip_address)
			
			# Check for private/internal IPs (generally less risky)
			if ip.is_private:
				return False
			
			# Check for known suspicious ranges (simplified)
			suspicious_ranges = [
				"10.0.0.0/8",
				"172.16.0.0/12", 
				"192.168.0.0/16"
			]
			
			return False  # Simplified - always return False for now
		
		except Exception:
			return True  # If we can't parse the IP, consider it suspicious
	
	# Fingerprinting and Device Identification
	
	def _hash_fingerprint(self, fingerprint: DeviceFingerprint) -> str:
		"""Create hash of device fingerprint for lookup"""
		fingerprint_components = [
			fingerprint.user_agent,
			fingerprint.screen_resolution or "",
			fingerprint.timezone or "",
			fingerprint.language or "",
			fingerprint.platform or "",
			str(fingerprint.hardware_concurrency or 0),
			str(fingerprint.device_memory or 0),
			fingerprint.canvas_fingerprint or "",
			fingerprint.webgl_fingerprint or "",
			"|".join(sorted(fingerprint.browser_features)),
			"|".join(sorted(fingerprint.installed_plugins))
		]
		
		fingerprint_string = "|".join(fingerprint_components)
		return hashlib.sha256(fingerprint_string.encode()).hexdigest()
	
	def _calculate_fingerprint_similarity(
		self,
		fingerprint1: DeviceFingerprint,
		fingerprint2: DeviceFingerprint
	) -> float:
		"""Calculate similarity between two device fingerprints"""
		try:
			matches = 0
			total_checks = 0
			
			# Compare basic attributes
			attributes = [
				'user_agent', 'screen_resolution', 'timezone', 'language', 
				'platform', 'hardware_concurrency', 'device_memory',
				'canvas_fingerprint', 'webgl_fingerprint'
			]
			
			for attr in attributes:
				val1 = getattr(fingerprint1, attr, None)
				val2 = getattr(fingerprint2, attr, None)
				
				if val1 is not None and val2 is not None:
					total_checks += 1
					if val1 == val2:
						matches += 1
			
			# Compare lists
			list_attributes = ['browser_features', 'installed_plugins']
			for attr in list_attributes:
				list1 = set(getattr(fingerprint1, attr, []))
				list2 = set(getattr(fingerprint2, attr, []))
				
				if list1 or list2:
					total_checks += 1
					if list1 == list2:
						matches += 1
					elif list1 and list2:
						# Partial match based on intersection
						intersection = len(list1.intersection(list2))
						union = len(list1.union(list2))
						if union > 0:
							matches += intersection / union
			
			return matches / total_checks if total_checks > 0 else 0.0
		
		except Exception as e:
			self.logger.error(f"Error calculating fingerprint similarity: {e}")
			return 0.0
	
	# Policy Management
	
	async def _check_policy_compliance(self, device: TrustedDevice) -> bool:
		"""Check if device complies with security policies"""
		try:
			policy = self.device_policies.get("default")
			violations = []
			
			# Check WebAuthn requirement
			if policy.require_webauthn and not device.webauthn_credential_ids:
				violations.append("webauthn_required")
			
			# Check screen lock requirement
			if policy.require_screen_lock and not device.security_features.get("screen_lock", False):
				violations.append("screen_lock_required")
			
			# Check encryption requirement
			if policy.require_encryption and not device.security_features.get("encryption", False):
				violations.append("encryption_required")
			
			# Check biometrics requirement
			if policy.require_biometrics and not device.security_features.get("biometrics", False):
				violations.append("biometrics_required")
			
			# Check device type restrictions
			if policy.blocked_device_types and device.device_type in policy.blocked_device_types:
				violations.append("device_type_blocked")
			
			if policy.allowed_device_types and device.device_type not in policy.allowed_device_types:
				violations.append("device_type_not_allowed")
			
			# Check IP restrictions
			if policy.blocked_ip_ranges:
				for ip_range in policy.blocked_ip_ranges:
					if self._ip_in_range(device.last_seen_ip, ip_range):
						violations.append("ip_blocked")
						break
			
			if policy.allowed_ip_ranges:
				ip_allowed = False
				for ip_range in policy.allowed_ip_ranges:
					if self._ip_in_range(device.last_seen_ip, ip_range):
						ip_allowed = True
						break
				if not ip_allowed:
					violations.append("ip_not_allowed")
			
			device.policy_violations = violations
			device.complies_with_policy = len(violations) == 0
			
			return device.complies_with_policy
		
		except Exception as e:
			self.logger.error(f"Policy compliance check failed: {e}")
			return False
	
	def _ip_in_range(self, ip_address: str, ip_range: str) -> bool:
		"""Check if IP address is in given range"""
		try:
			return ipaddress.ip_address(ip_address) in ipaddress.ip_network(ip_range, strict=False)
		except Exception:
			return False
	
	# Device Trust Automation
	
	async def _determine_initial_trust(self, device: TrustedDevice, policy: DevicePolicy):
		"""Determine initial trust level for new device"""
		try:
			fingerprint_confidence = device.device_fingerprint.confidence_score
			
			# Auto-trust if confidence is high enough and policy allows
			if (self.config.enable_auto_trust and 
				fingerprint_confidence >= self.config.auto_trust_confidence_threshold and
				device.complies_with_policy and
				device.risk_level in [DeviceRiskLevel.VERY_LOW, DeviceRiskLevel.LOW]):
				
				device.status = DeviceStatus.TRUSTED
				device.trust_level = TrustLevel.MEDIUM
				device.trusted_at = datetime.now(timezone.utc)
				device.trust_established_by = "auto"
				device.trust_expires_at = datetime.now(timezone.utc) + timedelta(days=policy.trust_duration_days)
			
			elif self.config.require_admin_approval_for_new_devices or policy.require_admin_approval:
				device.status = DeviceStatus.PENDING
				device.trust_level = TrustLevel.UNTRUSTED
			
			else:
				# Default to low trust for new devices
				device.status = DeviceStatus.TRUSTED
				device.trust_level = TrustLevel.LOW
				device.trusted_at = datetime.now(timezone.utc)
				device.trust_established_by = "auto"
				device.trust_expires_at = datetime.now(timezone.utc) + timedelta(days=30)  # Shorter trust period
		
		except Exception as e:
			self.logger.error(f"Error determining initial trust: {e}")
			# Default to untrusted
			device.status = DeviceStatus.PENDING
			device.trust_level = TrustLevel.UNTRUSTED
	
	# Utility and Helper Methods
	
	async def _calculate_location_distance(
		self,
		location1: Optional[Dict[str, Any]],
		location2: Optional[Dict[str, Any]]
	) -> Optional[float]:
		"""Calculate distance between two locations in kilometers"""
		if not location1 or not location2:
			return None
		
		try:
			# This is a simplified implementation
			# In practice, you'd use a proper geolocation service and distance calculation
			lat1 = location1.get('latitude')
			lon1 = location1.get('longitude')
			lat2 = location2.get('latitude')
			lon2 = location2.get('longitude')
			
			if not all([lat1, lon1, lat2, lon2]):
				return None
			
			# Simplified distance calculation (Haversine formula would be more accurate)
			import math
			
			R = 6371  # Earth's radius in kilometers
			dlat = math.radians(lat2 - lat1)
			dlon = math.radians(lon2 - lon1)
			a = (math.sin(dlat/2) * math.sin(dlat/2) + 
				 math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * 
				 math.sin(dlon/2) * math.sin(dlon/2))
			c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
			distance = R * c
			
			return distance
		
		except Exception as e:
			self.logger.error(f"Error calculating distance: {e}")
			return None
	
	async def _log_security_event(
		self,
		device_id: str,
		user_id: str,
		event_type: str,
		description: str,
		severity: str = "medium",
		ip_address: Optional[str] = None,
		requires_attention: bool = False
	):
		"""Log a device security event"""
		try:
			event = DeviceSecurityEvent(
				device_id=device_id,
				user_id=user_id,
				event_type=event_type,
				description=description,
				severity=severity,
				ip_address=ip_address,
				requires_attention=requires_attention
			)
			
			self.security_events[event.event_id] = event
			
			if severity in ["high", "critical"] or requires_attention:
				self.logger.warning(f"Device security event: {description} (Device: {device_id})")
			else:
				self.logger.info(f"Device security event: {description} (Device: {device_id})")
		
		except Exception as e:
			self.logger.error(f"Failed to log security event: {e}")
	
	# Query and Management Methods
	
	async def get_user_devices(self, user_id: str) -> List[Dict[str, Any]]:
		"""Get all devices for a user"""
		user_device_ids = self.user_devices.get(user_id, set())
		devices = []
		
		for device_id in user_device_ids:
			device = self.trusted_devices.get(device_id)
			if device:
				devices.append({
					'device_id': device.device_id,
					'device_name': device.device_name,
					'device_type': device.device_type,
					'status': device.status,
					'trust_level': device.trust_level,
					'risk_level': device.risk_level,
					'last_activity': device.last_activity.isoformat(),
					'trusted_at': device.trusted_at.isoformat() if device.trusted_at else None,
					'trust_expires_at': device.trust_expires_at.isoformat() if device.trust_expires_at else None,
					'login_count': device.login_count,
					'failed_attempts': device.failed_attempts,
					'complies_with_policy': device.complies_with_policy,
					'policy_violations': device.policy_violations
				})
		
		return sorted(devices, key=lambda d: d['last_activity'], reverse=True)
	
	async def get_device_details(self, device_id: str) -> Optional[Dict[str, Any]]:
		"""Get detailed information about a device"""
		device = self.trusted_devices.get(device_id)
		if not device:
			return None
		
		return {
			'device_id': device.device_id,
			'user_id': device.user_id,
			'device_name': device.device_name,
			'device_type': device.device_type,
			'status': device.status,
			'trust_level': device.trust_level,
			'risk_level': device.risk_level,
			'risk_score': device.risk_score,
			'risk_factors': device.risk_factors,
			'first_seen': device.first_seen.isoformat(),
			'last_activity': device.last_activity.isoformat(),
			'last_seen_ip': device.last_seen_ip,
			'login_count': device.login_count,
			'failed_attempts': device.failed_attempts,
			'security_features': device.security_features,
			'webauthn_credentials': len(device.webauthn_credential_ids),
			'trusted_at': device.trusted_at.isoformat() if device.trusted_at else None,
			'trust_expires_at': device.trust_expires_at.isoformat() if device.trust_expires_at else None,
			'trust_established_by': device.trust_established_by,
			'complies_with_policy': device.complies_with_policy,
			'policy_violations': device.policy_violations,
			'managed_by_mdm': device.managed_by_mdm,
			'notes': device.notes
		}
	
	async def get_security_events(
		self,
		device_id: Optional[str] = None,
		user_id: Optional[str] = None,
		event_type: Optional[str] = None,
		severity: Optional[str] = None,
		limit: int = 100
	) -> List[Dict[str, Any]]:
		"""Get security events with optional filtering"""
		events = []
		
		for event in self.security_events.values():
			# Apply filters
			if device_id and event.device_id != device_id:
				continue
			if user_id and event.user_id != user_id:
				continue
			if event_type and event.event_type != event_type:
				continue
			if severity and event.severity != severity:
				continue
			
			events.append({
				'event_id': event.event_id,
				'device_id': event.device_id,
				'user_id': event.user_id,
				'event_type': event.event_type,
				'description': event.description,
				'severity': event.severity,
				'timestamp': event.timestamp.isoformat(),
				'ip_address': event.ip_address,
				'location': event.location,
				'action_taken': event.action_taken,
				'requires_attention': event.requires_attention,
				'resolved': event.resolved
			})
		
		# Sort by timestamp (newest first) and apply limit
		events.sort(key=lambda e: e['timestamp'], reverse=True)
		return events[:limit]
	
	async def cleanup_expired_devices(self) -> Dict[str, int]:
		"""Clean up expired and inactive devices"""
		now = datetime.now(timezone.utc)
		cleanup_stats = {
			'expired_trust': 0,
			'inactive_devices': 0,
			'old_events': 0
		}
		
		# Update expired trust status
		for device in self.trusted_devices.values():
			if (device.trust_expires_at and 
				now > device.trust_expires_at and
				device.status == DeviceStatus.TRUSTED):
				device.status = DeviceStatus.EXPIRED
				device.trust_level = TrustLevel.UNTRUSTED
				cleanup_stats['expired_trust'] += 1
		
		# Remove very old inactive devices
		devices_to_remove = []
		cleanup_threshold = now - timedelta(days=self.config.cleanup_expired_devices_days)
		
		for device_id, device in self.trusted_devices.items():
			if device.last_activity < cleanup_threshold:
				devices_to_remove.append(device_id)
		
		for device_id in devices_to_remove:
			device = self.trusted_devices.pop(device_id)
			# Clean up related data
			if device.user_id in self.user_devices:
				self.user_devices[device.user_id].discard(device_id)
			# Remove from fingerprint lookup
			fingerprint_hash = self._hash_fingerprint(device.device_fingerprint)
			self.fingerprint_lookup.pop(fingerprint_hash, None)
			cleanup_stats['inactive_devices'] += 1
		
		# Clean up old security events
		events_to_remove = []
		event_cleanup_threshold = now - timedelta(days=90)  # Keep events for 90 days
		
		for event_id, event in self.security_events.items():
			if event.timestamp < event_cleanup_threshold and event.resolved:
				events_to_remove.append(event_id)
		
		for event_id in events_to_remove:
			self.security_events.pop(event_id)
			cleanup_stats['old_events'] += 1
		
		if sum(cleanup_stats.values()) > 0:
			self.logger.info(f"Device cleanup completed: {cleanup_stats}")
		
		return cleanup_stats
	
	async def get_statistics(self) -> Dict[str, Any]:
		"""Get device management statistics"""
		total_devices = len(self.trusted_devices)
		
		# Count by status
		status_counts = {}
		trust_level_counts = {}
		device_type_counts = {}
		risk_level_counts = {}
		
		for device in self.trusted_devices.values():
			status_counts[device.status] = status_counts.get(device.status, 0) + 1
			trust_level_counts[device.trust_level] = trust_level_counts.get(device.trust_level, 0) + 1
			device_type_counts[device.device_type] = device_type_counts.get(device.device_type, 0) + 1
			risk_level_counts[device.risk_level] = risk_level_counts.get(device.risk_level, 0) + 1
		
		# Security events by severity
		event_severity_counts = {}
		for event in self.security_events.values():
			event_severity_counts[event.severity] = event_severity_counts.get(event.severity, 0) + 1
		
		return {
			'total_devices': total_devices,
			'total_users_with_devices': len(self.user_devices),
			'status_distribution': status_counts,
			'trust_level_distribution': trust_level_counts,
			'device_type_distribution': device_type_counts,
			'risk_level_distribution': risk_level_counts,
			'total_security_events': len(self.security_events),
			'security_events_by_severity': event_severity_counts,
			'policies_configured': len(self.device_policies)
		}


# Factory functions
def create_device_manager(config: Optional[DeviceManagementConfig] = None) -> DeviceManager:
	"""Create DeviceManager instance"""
	return DeviceManager(config)


def create_test_device_config() -> DeviceManagementConfig:
	"""Create test device management configuration"""
	return DeviceManagementConfig(
		default_trust_duration_days=30,
		default_max_devices_per_user=5,
		cleanup_expired_devices_days=90,
		auto_trust_confidence_threshold=0.9
	)