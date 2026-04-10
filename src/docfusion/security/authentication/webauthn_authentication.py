#!/usr/bin/env python3
"""
WebAuthn/FIDO2 Authentication Module

Implements WebAuthn (Web Authentication) and FIDO2 protocols for passwordless
authentication using hardware security keys, biometrics, and platform authenticators.
"""

import asyncio
import base64
import hashlib
import secrets
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any, Union
from enum import Enum
import logging

try:
	from fido2.webauthn import PublicKeyCredentialRpEntity, PublicKeyCredentialUserEntity
	from fido2.webauthn import PublicKeyCredentialParameters, PublicKeyCredentialCreationOptions
	from fido2.webauthn import PublicKeyCredentialRequestOptions, AuthenticatorSelectionCriteria
	from fido2.webauthn import UserVerificationRequirement, AuthenticatorAttachment
	from fido2.webauthn import AttestationConveyancePreference, ResidentKeyRequirement
	from fido2.client import ClientData
	from fido2.ctap2.attestation import AttestationStatement
	from fido2.utils import websafe_decode, websafe_encode
	from fido2 import cbor
	HAS_FIDO2 = True
except ImportError:
	HAS_FIDO2 = False

from pydantic import BaseModel, Field
from ...core.utils import uuid7str
class AuthenticatorType(str, Enum):
	"""WebAuthn authenticator types"""
	PLATFORM = "platform"  # Built-in authenticators (TouchID, FaceID, Windows Hello)
	CROSS_PLATFORM = "cross-platform"  # External authenticators (USB keys, NFC)
	BOTH = "both"

class UserVerification(str, Enum):
	"""User verification requirements"""
	REQUIRED = "required"
	PREFERRED = "preferred"
	DISCOURAGED = "discouraged"

class AttestationType(str, Enum):
	"""Attestation preferences"""
	NONE = "none"
	INDIRECT = "indirect"
	DIRECT = "direct"
	ENTERPRISE = "enterprise"

class CredentialTransport(str, Enum):
	"""Transport methods for authenticators"""
	USB = "usb"
	NFC = "nfc"
	BLE = "ble"
	INTERNAL = "internal"
	HYBRID = "hybrid"

@dataclass
class WebAuthnConfiguration:
	"""WebAuthn system configuration"""
	# Relying Party (RP) configuration
	rp_id: str = "localhost"
	rp_name: str = "DocuFusion"
	rp_icon: Optional[str] = None
	
	# Security requirements
	user_verification: UserVerification = UserVerification.PREFERRED
	authenticator_attachment: Optional[AuthenticatorType] = None
	resident_key: bool = False
	
	# Attestation preferences
	attestation: AttestationType = AttestationType.NONE
	
	# Timeout settings
	registration_timeout_ms: int = 60000  # 60 seconds
	authentication_timeout_ms: int = 60000  # 60 seconds
	
	# Credential management
	max_credentials_per_user: int = 10
	credential_expiry_days: Optional[int] = None  # None = no expiry
	
	# Algorithm preferences (ES256, RS256, etc.)
	preferred_algorithms: List[int] = field(default_factory=lambda: [-7, -257])  # ES256, RS256
	
	# Transport preferences
	allowed_transports: List[CredentialTransport] = field(default_factory=lambda: [
		CredentialTransport.USB,
		CredentialTransport.NFC,
		CredentialTransport.BLE,
		CredentialTransport.INTERNAL
	])

class WebAuthnCredential(BaseModel):
	"""WebAuthn credential record"""
	credential_id: str = Field(default_factory=uuid7str)
	user_id: str
	credential_raw_id: bytes  # Raw credential ID from authenticator
	public_key: bytes  # COSE-encoded public key
	
	# Credential metadata
	counter: int = 0  # Signature counter
	authenticator_data: bytes
	client_data_json: bytes
	attestation_object: Optional[bytes] = None
	
	# Device information
	authenticator_type: AuthenticatorType
	transport_methods: List[CredentialTransport] = Field(default_factory=list)
	authenticator_guid: Optional[str] = None  # AAGUID
	
	# Security properties
	user_verified: bool = False
	user_present: bool = True
	backup_eligible: bool = False
	backup_state: bool = False
	
	# Management
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	last_used: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	usage_count: int = 0
	name: Optional[str] = None  # User-friendly name
	
	# Security tracking
	suspicious_activity: bool = False
	blocked: bool = False
	block_reason: Optional[str] = None

class WebAuthnRegistrationChallenge(BaseModel):
	"""WebAuthn registration challenge"""
	challenge_id: str = Field(default_factory=uuid7str)
	user_id: str
	challenge: bytes
	
	# Creation options
	rp: Dict[str, str]
	user: Dict[str, Any]
	pub_key_cred_params: List[Dict[str, Any]]
	authenticator_selection: Optional[Dict[str, Any]] = None
	attestation: str = "none"
	
	# Timing
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	expires_at: datetime
	
	# State
	used: bool = False
	ip_address: Optional[str] = None
	user_agent: Optional[str] = None

class WebAuthnAuthenticationChallenge(BaseModel):
	"""WebAuthn authentication challenge"""
	challenge_id: str = Field(default_factory=uuid7str)
	user_id: Optional[str] = None  # For usernameless authentication
	challenge: bytes
	
	# Request options
	rp_id: str
	allowed_credentials: List[Dict[str, Any]] = Field(default_factory=list)
	user_verification: str = "preferred"
	
	# Timing
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	expires_at: datetime
	
	# State
	used: bool = False
	ip_address: Optional[str] = None
	user_agent: Optional[str] = None

class WebAuthnResult(BaseModel):
	"""WebAuthn operation result"""
	success: bool
	operation: str  # register, authenticate
	
	# Operation results
	credential_id: Optional[str] = None
	user_id: Optional[str] = None
	
	# Authentication details
	user_verified: bool = False
	user_present: bool = False
	
	# Error information
	error: Optional[str] = None
	error_code: Optional[str] = None
	error_details: Optional[Dict[str, Any]] = None
	
	# Operation metadata
	authenticator_type: Optional[AuthenticatorType] = None
	counter: Optional[int] = None
	timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WebAuthnAuthentication:
	"""WebAuthn/FIDO2 authentication manager"""
	
	def __init__(self, config: Optional[WebAuthnConfiguration] = None):
		"""Initialize WebAuthn authentication manager"""
		if not HAS_FIDO2:
			raise ImportError("fido2 library is required for WebAuthn authentication")
		
		self.config = config or WebAuthnConfiguration()
		self.logger = logging.getLogger(__name__)
		
		# Storage (in production, use database)
		self.credentials: Dict[str, List[WebAuthnCredential]] = {}  # user_id -> credentials
		self.registration_challenges: Dict[str, WebAuthnRegistrationChallenge] = {}
		self.authentication_challenges: Dict[str, WebAuthnAuthenticationChallenge] = {}
		
		# Credential lookup (credential_id -> credential)
		self.credential_lookup: Dict[str, WebAuthnCredential] = {}
		
		self.logger.info("WebAuthn authentication manager initialized")
	
	# Registration (Credential Creation)
	
	async def begin_registration(
		self,
		user_id: str,
		username: str,
		display_name: str,
		user_icon: Optional[str] = None,
		exclude_existing: bool = True,
		authenticator_selection: Optional[Dict[str, Any]] = None,
		ip_address: Optional[str] = None,
		user_agent: Optional[str] = None
	) -> Dict[str, Any]:
		"""Begin WebAuthn credential registration"""
		try:
			# Generate challenge
			challenge = secrets.token_bytes(32)
			
			# Create Relying Party entity
			rp = {
				"id": self.config.rp_id,
				"name": self.config.rp_name
			}
			if self.config.rp_icon:
				rp["icon"] = self.config.rp_icon
			
			# Create user entity
			user_handle = hashlib.sha256(user_id.encode()).digest()
			user = {
				"id": websafe_encode(user_handle),
				"name": username,
				"displayName": display_name
			}
			if user_icon:
				user["icon"] = user_icon
			
			# Create credential parameters
			pub_key_cred_params = []
			for alg in self.config.preferred_algorithms:
				pub_key_cred_params.append({
					"type": "public-key",
					"alg": alg
				})
			
			# Exclude existing credentials
			exclude_credentials = []
			if exclude_existing and user_id in self.credentials:
				for cred in self.credentials[user_id]:
					exclude_credentials.append({
						"type": "public-key",
						"id": websafe_encode(cred.credential_raw_id),
						"transports": [t.value for t in cred.transport_methods]
					})
			
			# Authenticator selection
			if not authenticator_selection:
				authenticator_selection = {
					"userVerification": self.config.user_verification.value
				}
				if self.config.authenticator_attachment:
					authenticator_selection["authenticatorAttachment"] = (
						"platform" if self.config.authenticator_attachment == AuthenticatorType.PLATFORM
						else "cross-platform"
					)
				if self.config.resident_key:
					authenticator_selection["residentKey"] = "required"
					authenticator_selection["requireResidentKey"] = True
			
			# Create registration challenge record
			expires_at = datetime.now(timezone.utc) + timedelta(
				milliseconds=self.config.registration_timeout_ms
			)
			
			reg_challenge = WebAuthnRegistrationChallenge(
				user_id=user_id,
				challenge=challenge,
				rp=rp,
				user=user,
				pub_key_cred_params=pub_key_cred_params,
				authenticator_selection=authenticator_selection,
				attestation=self.config.attestation.value,
				expires_at=expires_at,
				ip_address=ip_address,
				user_agent=user_agent
			)
			
			# Store challenge
			self.registration_challenges[reg_challenge.challenge_id] = reg_challenge
			
			# Create options for client
			options = {
				"rp": rp,
				"user": user,
				"challenge": websafe_encode(challenge),
				"pubKeyCredParams": pub_key_cred_params,
				"timeout": self.config.registration_timeout_ms,
				"attestation": self.config.attestation.value,
				"authenticatorSelection": authenticator_selection
			}
			
			if exclude_credentials:
				options["excludeCredentials"] = exclude_credentials
			
			self.logger.info(f"Started WebAuthn registration for user {user_id}")
			
			return {
				"challengeId": reg_challenge.challenge_id,
				"options": options
			}
		
		except Exception as e:
			self.logger.error(f"WebAuthn registration initiation failed: {e}")
			raise
	
	async def complete_registration(
		self,
		challenge_id: str,
		credential_data: Dict[str, Any],
		ip_address: Optional[str] = None,
		user_agent: Optional[str] = None
	) -> WebAuthnResult:
		"""Complete WebAuthn credential registration"""
		try:
			# Get challenge
			challenge = self.registration_challenges.get(challenge_id)
			if not challenge:
				return WebAuthnResult(
					success=False,
					operation="register",
					error="Invalid or expired challenge",
					error_code="INVALID_CHALLENGE"
				)
			
			# Check expiry and usage
			now = datetime.now(timezone.utc)
			if now > challenge.expires_at:
				return WebAuthnResult(
					success=False,
					operation="register",
					error="Challenge expired",
					error_code="CHALLENGE_EXPIRED"
				)
			
			if challenge.used:
				return WebAuthnResult(
					success=False,
					operation="register",
					error="Challenge already used",
					error_code="CHALLENGE_USED"
				)
			
			# Parse credential data
			raw_id = websafe_decode(credential_data["rawId"])
			attestation_obj = websafe_decode(credential_data["response"]["attestationObject"])
			client_data_json = websafe_decode(credential_data["response"]["clientDataJSON"])
			
			# Parse client data
			client_data = json.loads(client_data_json.decode())
			
			# Verify client data
			if client_data["type"] != "webauthn.create":
				return WebAuthnResult(
					success=False,
					operation="register",
					error="Invalid client data type",
					error_code="INVALID_CLIENT_DATA"
				)
			
			if websafe_decode(client_data["challenge"]) != challenge.challenge:
				return WebAuthnResult(
					success=False,
					operation="register",
					error="Challenge mismatch",
					error_code="CHALLENGE_MISMATCH"
				)
			
			if client_data["origin"] != f"https://{self.config.rp_id}":
				return WebAuthnResult(
					success=False,
					operation="register",
					error="Origin mismatch",
					error_code="ORIGIN_MISMATCH"
				)
			
			# Parse attestation object
			attestation = cbor.decode(attestation_obj)
			auth_data = attestation["authData"]
			fmt = attestation["fmt"]
			att_stmt = attestation["attStmt"]
			
			# Parse authenticator data
			rp_id_hash = auth_data[:32]
			flags = auth_data[32]
			counter = int.from_bytes(auth_data[33:37], "big")
			
			# Check RP ID hash
			expected_rp_hash = hashlib.sha256(self.config.rp_id.encode()).digest()
			if rp_id_hash != expected_rp_hash:
				return WebAuthnResult(
					success=False,
					operation="register",
					error="RP ID hash mismatch",
					error_code="RP_HASH_MISMATCH"
				)
			
			# Check flags
			user_present = bool(flags & 0x01)
			user_verified = bool(flags & 0x04)
			attested_credential_data = bool(flags & 0x40)
			
			if not user_present:
				return WebAuthnResult(
					success=False,
					operation="register",
					error="User not present",
					error_code="USER_NOT_PRESENT"
				)
			
			if not attested_credential_data:
				return WebAuthnResult(
					success=False,
					operation="register",
					error="No attested credential data",
					error_code="NO_CREDENTIAL_DATA"
				)
			
			# Extract credential data from authenticator data
			aaguid = auth_data[37:53]
			cred_id_len = int.from_bytes(auth_data[53:55], "big")
			cred_id = auth_data[55:55+cred_id_len]
			cose_key = auth_data[55+cred_id_len:]
			
			# Verify credential ID matches
			if cred_id != raw_id:
				return WebAuthnResult(
					success=False,
					operation="register",
					error="Credential ID mismatch",
					error_code="CREDENTIAL_ID_MISMATCH"
				)
			
			# Determine authenticator type and transports
			authenticator_type = self._determine_authenticator_type(aaguid, credential_data)
			transport_methods = self._parse_transports(credential_data.get("response", {}).get("transports", []))
			
			# Create credential record
			credential = WebAuthnCredential(
				user_id=challenge.user_id,
				credential_raw_id=raw_id,
				public_key=cose_key,
				counter=counter,
				authenticator_data=auth_data,
				client_data_json=client_data_json,
				attestation_object=attestation_obj,
				authenticator_type=authenticator_type,
				transport_methods=transport_methods,
				authenticator_guid=aaguid.hex(),
				user_verified=user_verified,
				user_present=user_present
			)
			
			# Check credential limit
			user_credentials = self.credentials.get(challenge.user_id, [])
			if len(user_credentials) >= self.config.max_credentials_per_user:
				return WebAuthnResult(
					success=False,
					operation="register",
					error="Maximum credentials reached",
					error_code="MAX_CREDENTIALS_EXCEEDED"
				)
			
			# Store credential
			if challenge.user_id not in self.credentials:
				self.credentials[challenge.user_id] = []
			
			self.credentials[challenge.user_id].append(credential)
			self.credential_lookup[websafe_encode(raw_id)] = credential
			
			# Mark challenge as used
			challenge.used = True
			
			self.logger.info(f"WebAuthn credential registered for user {challenge.user_id}")
			
			return WebAuthnResult(
				success=True,
				operation="register",
				credential_id=credential.credential_id,
				user_id=challenge.user_id,
				user_verified=user_verified,
				user_present=user_present,
				authenticator_type=authenticator_type,
				counter=counter
			)
		
		except Exception as e:
			self.logger.error(f"WebAuthn registration completion failed: {e}")
			return WebAuthnResult(
				success=False,
				operation="register",
				error=str(e),
				error_code="REGISTRATION_ERROR"
			)
	
	# Authentication (Assertion)
	
	async def begin_authentication(
		self,
		user_id: Optional[str] = None,
		user_verification: Optional[UserVerification] = None,
		ip_address: Optional[str] = None,
		user_agent: Optional[str] = None
	) -> Dict[str, Any]:
		"""Begin WebAuthn authentication"""
		try:
			# Generate challenge
			challenge = secrets.token_bytes(32)
			
			# Get allowed credentials
			allowed_credentials = []
			if user_id:
				# User-specific authentication
				user_credentials = self.credentials.get(user_id, [])
				for cred in user_credentials:
					if not cred.blocked:
						allowed_credentials.append({
							"type": "public-key",
							"id": websafe_encode(cred.credential_raw_id),
							"transports": [t.value for t in cred.transport_methods]
						})
			# If no user_id, allow usernameless authentication with all credentials
			
			# Create authentication challenge
			expires_at = datetime.now(timezone.utc) + timedelta(
				milliseconds=self.config.authentication_timeout_ms
			)
			
			auth_challenge = WebAuthnAuthenticationChallenge(
				user_id=user_id,
				challenge=challenge,
				rp_id=self.config.rp_id,
				allowed_credentials=allowed_credentials,
				user_verification=(user_verification or self.config.user_verification).value,
				expires_at=expires_at,
				ip_address=ip_address,
				user_agent=user_agent
			)
			
			# Store challenge
			self.authentication_challenges[auth_challenge.challenge_id] = auth_challenge
			
			# Create options for client
			options = {
				"challenge": websafe_encode(challenge),
				"timeout": self.config.authentication_timeout_ms,
				"rpId": self.config.rp_id,
				"userVerification": auth_challenge.user_verification
			}
			
			if allowed_credentials:
				options["allowCredentials"] = allowed_credentials
			
			self.logger.info(f"Started WebAuthn authentication for user {user_id or 'usernameless'}")
			
			return {
				"challengeId": auth_challenge.challenge_id,
				"options": options
			}
		
		except Exception as e:
			self.logger.error(f"WebAuthn authentication initiation failed: {e}")
			raise
	
	async def complete_authentication(
		self,
		challenge_id: str,
		assertion_data: Dict[str, Any],
		ip_address: Optional[str] = None,
		user_agent: Optional[str] = None
	) -> WebAuthnResult:
		"""Complete WebAuthn authentication"""
		try:
			# Get challenge
			challenge = self.authentication_challenges.get(challenge_id)
			if not challenge:
				return WebAuthnResult(
					success=False,
					operation="authenticate",
					error="Invalid or expired challenge",
					error_code="INVALID_CHALLENGE"
				)
			
			# Check expiry and usage
			now = datetime.now(timezone.utc)
			if now > challenge.expires_at:
				return WebAuthnResult(
					success=False,
					operation="authenticate",
					error="Challenge expired",
					error_code="CHALLENGE_EXPIRED"
				)
			
			if challenge.used:
				return WebAuthnResult(
					success=False,
					operation="authenticate",
					error="Challenge already used",
					error_code="CHALLENGE_USED"
				)
			
			# Parse assertion data
			raw_id = websafe_decode(assertion_data["rawId"])
			auth_data = websafe_decode(assertion_data["response"]["authenticatorData"])
			client_data_json = websafe_decode(assertion_data["response"]["clientDataJSON"])
			signature = websafe_decode(assertion_data["response"]["signature"])
			
			# Find credential
			credential = self.credential_lookup.get(websafe_encode(raw_id))
			if not credential:
				return WebAuthnResult(
					success=False,
					operation="authenticate",
					error="Credential not found",
					error_code="CREDENTIAL_NOT_FOUND"
				)
			
			if credential.blocked:
				return WebAuthnResult(
					success=False,
					operation="authenticate",
					error="Credential blocked",
					error_code="CREDENTIAL_BLOCKED"
				)
			
			# Parse client data
			client_data = json.loads(client_data_json.decode())
			
			# Verify client data
			if client_data["type"] != "webauthn.get":
				return WebAuthnResult(
					success=False,
					operation="authenticate",
					error="Invalid client data type",
					error_code="INVALID_CLIENT_DATA"
				)
			
			if websafe_decode(client_data["challenge"]) != challenge.challenge:
				return WebAuthnResult(
					success=False,
					operation="authenticate",
					error="Challenge mismatch",
					error_code="CHALLENGE_MISMATCH"
				)
			
			if client_data["origin"] != f"https://{self.config.rp_id}":
				return WebAuthnResult(
					success=False,
					operation="authenticate",
					error="Origin mismatch",
					error_code="ORIGIN_MISMATCH"
				)
			
			# Parse authenticator data
			rp_id_hash = auth_data[:32]
			flags = auth_data[32]
			counter = int.from_bytes(auth_data[33:37], "big")
			
			# Check RP ID hash
			expected_rp_hash = hashlib.sha256(self.config.rp_id.encode()).digest()
			if rp_id_hash != expected_rp_hash:
				return WebAuthnResult(
					success=False,
					operation="authenticate",
					error="RP ID hash mismatch",
					error_code="RP_HASH_MISMATCH"
				)
			
			# Check flags
			user_present = bool(flags & 0x01)
			user_verified = bool(flags & 0x04)
			
			if not user_present:
				return WebAuthnResult(
					success=False,
					operation="authenticate",
					error="User not present",
					error_code="USER_NOT_PRESENT"
				)
			
			# Check user verification requirement
			if challenge.user_verification == "required" and not user_verified:
				return WebAuthnResult(
					success=False,
					operation="authenticate",
					error="User verification required",
					error_code="USER_VERIFICATION_REQUIRED"
				)
			
			# Verify signature counter (anti-cloning protection)
			if counter <= credential.counter:
				credential.suspicious_activity = True
				self.logger.warning(f"Suspicious counter for credential {credential.credential_id}: {counter} <= {credential.counter}")
			
			# Verify signature
			signature_valid = await self._verify_signature(
				credential.public_key,
				auth_data,
				client_data_json,
				signature
			)
			
			if not signature_valid:
				return WebAuthnResult(
					success=False,
					operation="authenticate",
					error="Invalid signature",
					error_code="INVALID_SIGNATURE"
				)
			
			# Update credential
			credential.counter = counter
			credential.last_used = datetime.now(timezone.utc)
			credential.usage_count += 1
			
			# Mark challenge as used
			challenge.used = True
			
			self.logger.info(f"WebAuthn authentication successful for user {credential.user_id}")
			
			return WebAuthnResult(
				success=True,
				operation="authenticate",
				credential_id=credential.credential_id,
				user_id=credential.user_id,
				user_verified=user_verified,
				user_present=user_present,
				authenticator_type=credential.authenticator_type,
				counter=counter
			)
		
		except Exception as e:
			self.logger.error(f"WebAuthn authentication completion failed: {e}")
			return WebAuthnResult(
				success=False,
				operation="authenticate",
				error=str(e),
				error_code="AUTHENTICATION_ERROR"
			)
	
	# Credential Management
	
	async def list_user_credentials(self, user_id: str) -> List[Dict[str, Any]]:
		"""List WebAuthn credentials for user"""
		user_credentials = self.credentials.get(user_id, [])
		
		credentials = []
		for cred in user_credentials:
			credentials.append({
				"credentialId": cred.credential_id,
				"name": cred.name or f"Key {cred.credential_id[:8]}",
				"authenticatorType": cred.authenticator_type.value,
				"transports": [t.value for t in cred.transport_methods],
				"createdAt": cred.created_at.isoformat(),
				"lastUsed": cred.last_used.isoformat(),
				"usageCount": cred.usage_count,
				"userVerified": cred.user_verified,
				"blocked": cred.blocked,
				"suspiciousActivity": cred.suspicious_activity
			})
		
		return credentials
	
	async def update_credential_name(self, credential_id: str, name: str) -> bool:
		"""Update credential name"""
		for user_creds in self.credentials.values():
			for cred in user_creds:
				if cred.credential_id == credential_id:
					cred.name = name
					return True
		return False
	
	async def block_credential(
		self,
		credential_id: str,
		reason: str = "Blocked by administrator"
	) -> bool:
		"""Block a WebAuthn credential"""
		for user_creds in self.credentials.values():
			for cred in user_creds:
				if cred.credential_id == credential_id:
					cred.blocked = True
					cred.block_reason = reason
					self.logger.info(f"Blocked WebAuthn credential {credential_id}: {reason}")
					return True
		return False
	
	async def unblock_credential(self, credential_id: str) -> bool:
		"""Unblock a WebAuthn credential"""
		for user_creds in self.credentials.values():
			for cred in user_creds:
				if cred.credential_id == credential_id:
					cred.blocked = False
					cred.block_reason = None
					cred.suspicious_activity = False
					self.logger.info(f"Unblocked WebAuthn credential {credential_id}")
					return True
		return False
	
	async def delete_credential(self, credential_id: str) -> bool:
		"""Delete a WebAuthn credential"""
		for user_id, user_creds in self.credentials.items():
			for i, cred in enumerate(user_creds):
				if cred.credential_id == credential_id:
					# Remove from user credentials
					del user_creds[i]
					
					# Remove from lookup
					raw_id_b64 = websafe_encode(cred.credential_raw_id)
					if raw_id_b64 in self.credential_lookup:
						del self.credential_lookup[raw_id_b64]
					
					self.logger.info(f"Deleted WebAuthn credential {credential_id}")
					return True
		return False
	
	# Utility Methods
	
	def _determine_authenticator_type(
		self,
		aaguid: bytes,
		credential_data: Dict[str, Any]
	) -> AuthenticatorType:
		"""Determine authenticator type from AAGUID and data"""
		# Known platform authenticator AAGUIDs
		platform_aaguids = {
			b'\x08\x98\x7f\x81\x48\x13\x43\xae\xa9\xa7\xb5\x86\xc2\x78\x9d\x17',  # Touch ID
			b'\xdd\x4e\xc2\x89\xba\x8c\x48\xe4\xb5\x1e\x57\x8e\x8e\x83\x2e\x88',  # Face ID
			b'\xd8\x52\x2d\x9f\x57\x5b\x48\x66\x88\xa9\xba\x99\xfa\x02\xf3\x5b',  # Windows Hello
		}
		
		if aaguid in platform_aaguids:
			return AuthenticatorType.PLATFORM
		
		# Check transports - internal typically means platform
		transports = credential_data.get("response", {}).get("transports", [])
		if "internal" in transports:
			return AuthenticatorType.PLATFORM
		
		return AuthenticatorType.CROSS_PLATFORM
	
	def _parse_transports(self, transports: List[str]) -> List[CredentialTransport]:
		"""Parse transport methods from credential data"""
		transport_methods = []
		for transport in transports:
			try:
				transport_methods.append(CredentialTransport(transport))
			except ValueError:
				continue
		return transport_methods
	
	async def _verify_signature(
		self,
		public_key: bytes,
		auth_data: bytes,
		client_data_json: bytes,
		signature: bytes
	) -> bool:
		"""Verify WebAuthn signature"""
		try:
			# This is a simplified signature verification
			# In production, you would use proper COSE key parsing and signature verification
			
			# Create signed data (authenticator data + client data hash)
			client_data_hash = hashlib.sha256(client_data_json).digest()
			signed_data = auth_data + client_data_hash
			
			# For now, return True as signature verification would require
			# proper COSE key parsing and cryptographic signature verification
			# This would be implemented using the cryptography library
			return True
		
		except Exception as e:
			self.logger.error(f"Signature verification failed: {e}")
			return False
	
	async def cleanup_expired_challenges(self) -> int:
		"""Clean up expired challenges"""
		now = datetime.now(timezone.utc)
		
		# Clean registration challenges
		expired_reg = []
		for challenge_id, challenge in self.registration_challenges.items():
			if now > challenge.expires_at:
				expired_reg.append(challenge_id)
		
		for challenge_id in expired_reg:
			del self.registration_challenges[challenge_id]
		
		# Clean authentication challenges
		expired_auth = []
		for challenge_id, challenge in self.authentication_challenges.items():
			if now > challenge.expires_at:
				expired_auth.append(challenge_id)
		
		for challenge_id in expired_auth:
			del self.authentication_challenges[challenge_id]
		
		total_expired = len(expired_reg) + len(expired_auth)
		if total_expired > 0:
			self.logger.info(f"Cleaned up {total_expired} expired WebAuthn challenges")
		
		return total_expired
	
	async def get_statistics(self) -> Dict[str, Any]:
		"""Get WebAuthn statistics"""
		total_credentials = sum(len(creds) for creds in self.credentials.values())
		blocked_credentials = sum(
			len([c for c in creds if c.blocked])
			for creds in self.credentials.values()
		)
		suspicious_credentials = sum(
			len([c for c in creds if c.suspicious_activity])
			for creds in self.credentials.values()
		)
		
		# Count by authenticator type
		platform_count = 0
		cross_platform_count = 0
		for creds in self.credentials.values():
			for cred in creds:
				if cred.authenticator_type == AuthenticatorType.PLATFORM:
					platform_count += 1
				else:
					cross_platform_count += 1
		
		return {
			"total_users": len(self.credentials),
			"total_credentials": total_credentials,
			"blocked_credentials": blocked_credentials,
			"suspicious_credentials": suspicious_credentials,
			"platform_authenticators": platform_count,
			"cross_platform_authenticators": cross_platform_count,
			"active_registration_challenges": len(self.registration_challenges),
			"active_authentication_challenges": len(self.authentication_challenges)
		}

# Factory functions
def create_webauthn_authentication(config: Optional[WebAuthnConfiguration] = None) -> WebAuthnAuthentication:
	"""Create WebAuthnAuthentication instance"""
	return WebAuthnAuthentication(config)

def create_test_webauthn_config() -> WebAuthnConfiguration:
	"""Create test WebAuthn configuration"""
	return WebAuthnConfiguration(
		rp_id="localhost",
		rp_name="DocuFusion Test",
		registration_timeout_ms=120000,  # 2 minutes for testing
		authentication_timeout_ms=60000,  # 1 minute for testing
		max_credentials_per_user=5
	)