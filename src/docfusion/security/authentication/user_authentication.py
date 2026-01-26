#!/usr/bin/env python3
"""
User Authentication Module

Provides secure user authentication with password hashing, JWT tokens, 
multi-factor authentication, and account security features.
"""

import asyncio
import hashlib
import hmac
import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Union, Tuple, Any
from enum import Enum
import logging
import pyotp
import qrcode
from io import BytesIO
import base64

# JWT handling
import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError

# Password hashing with bcrypt
import bcrypt

try:
	from uuid_extensions import uuid7str
except ImportError:
	from uuid import uuid4
	def uuid7str() -> str:
		return str(uuid4())

# Pydantic models
from pydantic import BaseModel, Field, ConfigDict, validator


class AuthenticationStatus(Enum):
	"""Authentication status enumeration"""
	SUCCESS = "success"
	INVALID_CREDENTIALS = "invalid_credentials"  
	ACCOUNT_LOCKED = "account_locked"
	MFA_REQUIRED = "mfa_required"
	EXPIRED_PASSWORD = "expired_password"
	SECURITY_CHALLENGE = "security_challenge"
	RATE_LIMITED = "rate_limited"


class MFAMethod(Enum):
	"""Multi-factor authentication methods"""
	TOTP = "totp"  # Time-based One-Time Password (Google Authenticator)
	SMS = "sms"    # SMS verification
	EMAIL = "email"  # Email verification
	BACKUP_CODES = "backup_codes"  # Backup recovery codes


@dataclass
class UserCredentials:
	"""User credentials for authentication"""
	username: str
	password: str
	mfa_code: Optional[str] = None
	device_id: Optional[str] = None
	ip_address: Optional[str] = None
	user_agent: Optional[str] = None


class AuthenticationResult(BaseModel):
	"""Result of authentication attempt"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	status: AuthenticationStatus
	user_id: Optional[str] = None
	access_token: Optional[str] = None
	refresh_token: Optional[str] = None
	expires_at: Optional[datetime] = None
	requires_mfa: bool = False
	mfa_methods: List[MFAMethod] = Field(default_factory=list)
	error_message: Optional[str] = None
	session_id: str = Field(default_factory=uuid7str)
	device_trusted: bool = False
	security_warnings: List[str] = Field(default_factory=list)


class UserSecurityProfile(BaseModel):
	"""User security profile and settings"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	user_id: str
	password_hash: str
	password_salt: str
	password_updated_at: datetime
	failed_login_attempts: int = 0
	account_locked_until: Optional[datetime] = None
	last_login_at: Optional[datetime] = None
	
	# MFA settings
	mfa_enabled: bool = False
	mfa_secret: Optional[str] = None
	mfa_backup_codes: List[str] = Field(default_factory=list)
	mfa_methods: List[MFAMethod] = Field(default_factory=list)
	
	# Security settings
	password_expires_at: Optional[datetime] = None
	force_password_change: bool = False
	trusted_devices: List[str] = Field(default_factory=list)
	session_timeout_minutes: int = 60
	
	# Audit trail
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class SecurityConfiguration:
	"""Security configuration for authentication"""
	# Password policy
	min_password_length: int = 12
	require_uppercase: bool = True
	require_lowercase: bool = True
	require_numbers: bool = True
	require_special_chars: bool = True
	password_history_count: int = 5
	password_expiry_days: int = 90
	
	# Account lockout policy
	max_failed_attempts: int = 5
	lockout_duration_minutes: int = 30
	progressive_delay: bool = True
	
	# JWT configuration
	jwt_secret_key: str = Field(default_factory=lambda: secrets.token_urlsafe(32))
	jwt_algorithm: str = "HS256"
	access_token_expiry_minutes: int = 15
	refresh_token_expiry_days: int = 7
	
	# MFA configuration
	mfa_issuer_name: str = "ProposalWriter"
	mfa_backup_codes_count: int = 10
	mfa_grace_period_minutes: int = 30
	
	# Session configuration
	session_timeout_minutes: int = 60
	device_trust_duration_days: int = 30
	concurrent_sessions_limit: int = 3


class UserAuthentication:
	"""Secure user authentication system with comprehensive security features"""
	
	def __init__(self, config: Optional[SecurityConfiguration] = None):
		"""Initialize authentication system with configuration"""
		self.config = config or SecurityConfiguration()
		self.logger = logging.getLogger(__name__)
		
		# In-memory storage for demo (replace with database in production)
		self.users: Dict[str, UserSecurityProfile] = {}
		self.active_sessions: Dict[str, Dict[str, Any]] = {}
		self.rate_limit_tracker: Dict[str, List[float]] = {}
		
		# Password validation patterns
		self._compile_password_patterns()
		
		self.logger.info("User authentication system initialized")
	
	def _compile_password_patterns(self):
		"""Compile regex patterns for password validation"""
		import re
		self.patterns = {
			'uppercase': re.compile(r'[A-Z]'),
			'lowercase': re.compile(r'[a-z]'),
			'numbers': re.compile(r'\d'),
			'special': re.compile(r'[!@#$%^&*(),.?":{}|<>]')
		}
	
	async def create_user(
		self,
		username: str,
		password: str,
		email: Optional[str] = None,
		require_mfa: bool = False
	) -> str:
		"""Create a new user account with secure password hashing"""
		# Validate password strength
		password_validation = self._validate_password_strength(password)
		if not password_validation['valid']:
			raise ValueError(f"Password validation failed: {password_validation['errors']}")
		
		# Check if user already exists
		if username in self.users:
			raise ValueError(f"User {username} already exists")
		
		# Generate secure password hash
		password_hash, salt = self._hash_password(password)
		
		user_id = uuid7str()
		now = datetime.now(timezone.utc)
		
		# Create user security profile
		user_profile = UserSecurityProfile(
			user_id=user_id,
			password_hash=password_hash,
			password_salt=salt,
			password_updated_at=now,
			password_expires_at=now + timedelta(days=self.config.password_expiry_days),
			mfa_enabled=require_mfa
		)
		
		# Set up MFA if required
		if require_mfa:
			mfa_secret = pyotp.random_base32()
			backup_codes = self._generate_backup_codes()
			
			user_profile.mfa_secret = mfa_secret
			user_profile.mfa_backup_codes = backup_codes
			user_profile.mfa_methods = [MFAMethod.TOTP]
		
		self.users[username] = user_profile
		
		self.logger.info(f"Created user account: {username} (ID: {user_id})")
		return user_id
	
	async def authenticate(self, credentials: UserCredentials) -> AuthenticationResult:
		"""Authenticate user with comprehensive security checks"""
		start_time = time.time()
		
		try:
			# Rate limiting check
			if not self._check_rate_limit(credentials.ip_address):
				return AuthenticationResult(
					status=AuthenticationStatus.RATE_LIMITED,
					error_message="Too many authentication attempts. Please try again later."
				)
			
			# Get user profile
			user_profile = self.users.get(credentials.username)
			if not user_profile:
				# Simulate hash computation to prevent timing attacks
				self._hash_password("dummy_password")
				return AuthenticationResult(
					status=AuthenticationStatus.INVALID_CREDENTIALS,
					error_message="Invalid username or password"
				)
			
			# Check account lockout
			if self._is_account_locked(user_profile):
				return AuthenticationResult(
					status=AuthenticationStatus.ACCOUNT_LOCKED,
					error_message="Account is temporarily locked due to too many failed attempts"
				)
			
			# Verify password
			if not self._verify_password(credentials.password, user_profile.password_hash, user_profile.password_salt):
				await self._handle_failed_login(user_profile)
				return AuthenticationResult(
					status=AuthenticationStatus.INVALID_CREDENTIALS,
					error_message="Invalid username or password"
				)
			
			# Reset failed attempts on successful password verification
			user_profile.failed_login_attempts = 0
			user_profile.account_locked_until = None
			
			# Check password expiry
			if self._is_password_expired(user_profile):
				return AuthenticationResult(
					status=AuthenticationStatus.EXPIRED_PASSWORD,
					error_message="Password has expired. Please change your password.",
					user_id=user_profile.user_id
				)
			
			# Handle MFA if enabled
			if user_profile.mfa_enabled:
				mfa_result = await self._handle_mfa(user_profile, credentials.mfa_code)
				if mfa_result.status != AuthenticationStatus.SUCCESS:
					return mfa_result
			
			# Check device trust
			device_trusted = self._is_device_trusted(user_profile, credentials.device_id)
			
			# Generate tokens and session
			access_token = self._generate_access_token(user_profile.user_id, credentials.device_id)
			refresh_token = self._generate_refresh_token(user_profile.user_id)
			session_id = uuid7str()
			
			# Create session
			expires_at = datetime.now(timezone.utc) + timedelta(minutes=self.config.access_token_expiry_minutes)
			await self._create_session(session_id, user_profile.user_id, credentials, expires_at)
			
			# Update login timestamp
			user_profile.last_login_at = datetime.now(timezone.utc)
			
			# Generate security warnings if needed
			security_warnings = self._generate_security_warnings(user_profile, credentials)
			
			self.logger.info(f"Successful authentication for user: {credentials.username}")
			
			return AuthenticationResult(
				status=AuthenticationStatus.SUCCESS,
				user_id=user_profile.user_id,
				access_token=access_token,
				refresh_token=refresh_token,
				expires_at=expires_at,
				session_id=session_id,
				device_trusted=device_trusted,
				security_warnings=security_warnings
			)
		
		except Exception as e:
			self.logger.error(f"Authentication error for {credentials.username}: {e}")
			return AuthenticationResult(
				status=AuthenticationStatus.INVALID_CREDENTIALS,
				error_message="Authentication failed due to system error"
			)
	
	async def verify_token(self, token: str) -> Dict[str, Any]:
		"""Verify JWT access token and return claims"""
		try:
			payload = jwt.decode(
				token,
				self.config.jwt_secret_key,
				algorithms=[self.config.jwt_algorithm]
			)
			
			# Check if session is still active
			session_id = payload.get('session_id')
			if session_id and session_id not in self.active_sessions:
				raise InvalidTokenError("Session no longer active")
			
			return payload
		
		except ExpiredSignatureError:
			raise InvalidTokenError("Token has expired")
		except Exception as e:
			raise InvalidTokenError(f"Invalid token: {e}")
	
	async def refresh_token(self, refresh_token: str) -> AuthenticationResult:
		"""Refresh access token using refresh token"""
		try:
			payload = jwt.decode(
				refresh_token,
				self.config.jwt_secret_key,
				algorithms=[self.config.jwt_algorithm]
			)
			
			if payload.get('type') != 'refresh':
				raise InvalidTokenError("Invalid token type")
			
			user_id = payload['user_id']
			device_id = payload.get('device_id')
			
			# Generate new access token
			access_token = self._generate_access_token(user_id, device_id)
			expires_at = datetime.now(timezone.utc) + timedelta(minutes=self.config.access_token_expiry_minutes)
			
			return AuthenticationResult(
				status=AuthenticationStatus.SUCCESS,
				user_id=user_id,
				access_token=access_token,
				expires_at=expires_at
			)
		
		except Exception as e:
			return AuthenticationResult(
				status=AuthenticationStatus.INVALID_CREDENTIALS,
				error_message=f"Token refresh failed: {e}"
			)
	
	async def logout(self, session_id: str) -> bool:
		"""Logout user and invalidate session"""
		try:
			if session_id in self.active_sessions:
				del self.active_sessions[session_id]
				self.logger.info(f"User logged out, session: {session_id}")
				return True
			return False
		except Exception as e:
			self.logger.error(f"Logout error: {e}")
			return False
	
	async def change_password(
		self,
		user_id: str,
		current_password: str,
		new_password: str
	) -> bool:
		"""Change user password with validation"""
		try:
			# Find user by ID
			user_profile = None
			for profile in self.users.values():
				if profile.user_id == user_id:
					user_profile = profile
					break
			
			if not user_profile:
				raise ValueError("User not found")
			
			# Verify current password
			if not self._verify_password(current_password, user_profile.password_hash, user_profile.password_salt):
				raise ValueError("Current password is incorrect")
			
			# Validate new password
			password_validation = self._validate_password_strength(new_password)
			if not password_validation['valid']:
				raise ValueError(f"New password validation failed: {password_validation['errors']}")
			
			# Check password history (simplified - in production, store password history)
			if current_password == new_password:
				raise ValueError("New password must be different from current password")
			
			# Update password
			password_hash, salt = self._hash_password(new_password)
			user_profile.password_hash = password_hash
			user_profile.password_salt = salt
			user_profile.password_updated_at = datetime.now(timezone.utc)
			user_profile.password_expires_at = datetime.now(timezone.utc) + timedelta(days=self.config.password_expiry_days)
			user_profile.force_password_change = False
			
			self.logger.info(f"Password changed for user: {user_id}")
			return True
		
		except Exception as e:
			self.logger.error(f"Password change error: {e}")
			return False
	
	async def enable_mfa(self, user_id: str) -> Dict[str, Any]:
		"""Enable multi-factor authentication for user"""
		user_profile = None
		for profile in self.users.values():
			if profile.user_id == user_id:
				user_profile = profile
				break
		
		if not user_profile:
			raise ValueError("User not found")
		
		if user_profile.mfa_enabled:
			raise ValueError("MFA is already enabled")
		
		# Generate MFA secret and backup codes
		mfa_secret = pyotp.random_base32()
		backup_codes = self._generate_backup_codes()
		
		# Generate QR code for TOTP setup
		totp_uri = pyotp.TOTP(mfa_secret).provisioning_uri(
			name=user_id,
			issuer_name=self.config.mfa_issuer_name
		)
		
		qr = qrcode.QRCode(version=1, box_size=10, border=5)
		qr.add_data(totp_uri)
		qr.make(fit=True)
		
		qr_img = qr.make_image(fill_color="black", back_color="white")
		qr_buffer = BytesIO()
		qr_img.save(qr_buffer, format='PNG')
		qr_base64 = base64.b64encode(qr_buffer.getvalue()).decode()
		
		# Update user profile (MFA not enabled until verified)
		user_profile.mfa_secret = mfa_secret
		user_profile.mfa_backup_codes = backup_codes
		
		return {
			'secret': mfa_secret,
			'qr_code': qr_base64,
			'backup_codes': backup_codes,
			'uri': totp_uri
		}
	
	async def verify_mfa_setup(self, user_id: str, mfa_code: str) -> bool:
		"""Verify MFA setup and enable MFA"""
		user_profile = None
		for profile in self.users.values():
			if profile.user_id == user_id:
				user_profile = profile
				break
		
		if not user_profile or not user_profile.mfa_secret:
			return False
		
		# Verify TOTP code
		totp = pyotp.TOTP(user_profile.mfa_secret)
		if totp.verify(mfa_code, valid_window=1):
			user_profile.mfa_enabled = True
			user_profile.mfa_methods = [MFAMethod.TOTP]
			self.logger.info(f"MFA enabled for user: {user_id}")
			return True
		
		return False
	
	def _hash_password(self, password: str) -> Tuple[str, str]:
		"""Generate secure password hash with salt"""
		salt = bcrypt.gensalt(rounds=12)
		password_hash = bcrypt.hashpw(password.encode('utf-8'), salt)
		return password_hash.decode('utf-8'), salt.decode('utf-8')
	
	def _verify_password(self, password: str, stored_hash: str, salt: str) -> bool:
		"""Verify password against stored hash"""
		try:
			return bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))
		except Exception:
			return False
	
	def _validate_password_strength(self, password: str) -> Dict[str, Any]:
		"""Validate password strength against policy"""
		errors = []
		
		if len(password) < self.config.min_password_length:
			errors.append(f"Password must be at least {self.config.min_password_length} characters")
		
		if self.config.require_uppercase and not self.patterns['uppercase'].search(password):
			errors.append("Password must contain at least one uppercase letter")
		
		if self.config.require_lowercase and not self.patterns['lowercase'].search(password):
			errors.append("Password must contain at least one lowercase letter")
		
		if self.config.require_numbers and not self.patterns['numbers'].search(password):
			errors.append("Password must contain at least one number")
		
		if self.config.require_special_chars and not self.patterns['special'].search(password):
			errors.append("Password must contain at least one special character")
		
		return {
			'valid': len(errors) == 0,
			'errors': errors
		}
	
	def _check_rate_limit(self, ip_address: Optional[str]) -> bool:
		"""Check if IP address is rate limited"""
		if not ip_address:
			return True
		
		now = time.time()
		window = 300  # 5 minutes
		max_attempts = 10
		
		# Clean old attempts
		if ip_address in self.rate_limit_tracker:
			self.rate_limit_tracker[ip_address] = [
				timestamp for timestamp in self.rate_limit_tracker[ip_address]
				if now - timestamp < window
			]
		else:
			self.rate_limit_tracker[ip_address] = []
		
		# Check if limit exceeded
		if len(self.rate_limit_tracker[ip_address]) >= max_attempts:
			return False
		
		# Add current attempt
		self.rate_limit_tracker[ip_address].append(now)
		return True
	
	def _is_account_locked(self, user_profile: UserSecurityProfile) -> bool:
		"""Check if account is locked"""
		if user_profile.account_locked_until:
			if datetime.now(timezone.utc) < user_profile.account_locked_until:
				return True
			else:
				# Unlock account
				user_profile.account_locked_until = None
				user_profile.failed_login_attempts = 0
		
		return False
	
	def _is_password_expired(self, user_profile: UserSecurityProfile) -> bool:
		"""Check if password has expired"""
		if user_profile.force_password_change:
			return True
		
		if user_profile.password_expires_at:
			return datetime.now(timezone.utc) > user_profile.password_expires_at
		
		return False
	
	async def _handle_failed_login(self, user_profile: UserSecurityProfile):
		"""Handle failed login attempt"""
		user_profile.failed_login_attempts += 1
		
		if user_profile.failed_login_attempts >= self.config.max_failed_attempts:
			lockout_duration = timedelta(minutes=self.config.lockout_duration_minutes)
			
			# Progressive delay for repeated failures
			if self.config.progressive_delay:
				multiplier = min(user_profile.failed_login_attempts - self.config.max_failed_attempts + 1, 5)
				lockout_duration *= multiplier
			
			user_profile.account_locked_until = datetime.now(timezone.utc) + lockout_duration
			self.logger.warning(f"Account locked for user: {user_profile.user_id} until {user_profile.account_locked_until}")
	
	async def _handle_mfa(self, user_profile: UserSecurityProfile, mfa_code: Optional[str]) -> AuthenticationResult:
		"""Handle multi-factor authentication"""
		if not mfa_code:
			return AuthenticationResult(
				status=AuthenticationStatus.MFA_REQUIRED,
				requires_mfa=True,
				mfa_methods=user_profile.mfa_methods,
				user_id=user_profile.user_id,
				error_message="Multi-factor authentication required"
			)
		
		# Verify TOTP code
		if MFAMethod.TOTP in user_profile.mfa_methods and user_profile.mfa_secret:
			totp = pyotp.TOTP(user_profile.mfa_secret)
			if totp.verify(mfa_code, valid_window=1):
				return AuthenticationResult(status=AuthenticationStatus.SUCCESS)
		
		# Check backup codes
		if mfa_code in user_profile.mfa_backup_codes:
			# Remove used backup code
			user_profile.mfa_backup_codes.remove(mfa_code)
			return AuthenticationResult(status=AuthenticationStatus.SUCCESS)
		
		return AuthenticationResult(
			status=AuthenticationStatus.INVALID_CREDENTIALS,
			error_message="Invalid MFA code"
		)
	
	def _is_device_trusted(self, user_profile: UserSecurityProfile, device_id: Optional[str]) -> bool:
		"""Check if device is trusted"""
		if device_id and device_id in user_profile.trusted_devices:
			return True
		return False
	
	def _generate_access_token(self, user_id: str, device_id: Optional[str] = None) -> str:
		"""Generate JWT access token"""
		now = datetime.now(timezone.utc)
		payload = {
			'user_id': user_id,
			'type': 'access',
			'iat': now,
			'exp': now + timedelta(minutes=self.config.access_token_expiry_minutes),
			'session_id': uuid7str()
		}
		
		if device_id:
			payload['device_id'] = device_id
		
		return jwt.encode(payload, self.config.jwt_secret_key, algorithm=self.config.jwt_algorithm)
	
	def _generate_refresh_token(self, user_id: str, device_id: Optional[str] = None) -> str:
		"""Generate JWT refresh token"""
		now = datetime.now(timezone.utc)
		payload = {
			'user_id': user_id,
			'type': 'refresh',
			'iat': now,
			'exp': now + timedelta(days=self.config.refresh_token_expiry_days)
		}
		
		if device_id:
			payload['device_id'] = device_id
		
		return jwt.encode(payload, self.config.jwt_secret_key, algorithm=self.config.jwt_algorithm)
	
	async def _create_session(
		self,
		session_id: str,
		user_id: str,
		credentials: UserCredentials,
		expires_at: datetime
	):
		"""Create user session"""
		self.active_sessions[session_id] = {
			'user_id': user_id,
			'created_at': datetime.now(timezone.utc),
			'expires_at': expires_at,
			'ip_address': credentials.ip_address,
			'user_agent': credentials.user_agent,
			'device_id': credentials.device_id,
			'last_activity': datetime.now(timezone.utc)
		}
	
	def _generate_backup_codes(self) -> List[str]:
		"""Generate backup codes for MFA"""
		return [
			secrets.token_hex(4).upper()
			for _ in range(self.config.mfa_backup_codes_count)
		]
	
	def _generate_security_warnings(self, user_profile: UserSecurityProfile, credentials: UserCredentials) -> List[str]:
		"""Generate security warnings for login"""
		warnings = []
		
		# Check for password expiry warning
		if user_profile.password_expires_at:
			days_until_expiry = (user_profile.password_expires_at - datetime.now(timezone.utc)).days
			if days_until_expiry <= 7:
				warnings.append(f"Password expires in {days_until_expiry} days")
		
		# Check for new device
		if credentials.device_id and not self._is_device_trusted(user_profile, credentials.device_id):
			warnings.append("Login from new device detected")
		
		return warnings
	
	async def get_user_sessions(self, user_id: str) -> List[Dict[str, Any]]:
		"""Get active sessions for user"""
		sessions = []
		for session_id, session_data in self.active_sessions.items():
			if session_data['user_id'] == user_id:
				sessions.append({
					'session_id': session_id,
					'created_at': session_data['created_at'],
					'last_activity': session_data['last_activity'],
					'ip_address': session_data['ip_address'],
					'user_agent': session_data['user_agent']
				})
		return sessions
	
	async def revoke_all_sessions(self, user_id: str) -> int:
		"""Revoke all sessions for user"""
		revoked_count = 0
		sessions_to_remove = []
		
		for session_id, session_data in self.active_sessions.items():
			if session_data['user_id'] == user_id:
				sessions_to_remove.append(session_id)
		
		for session_id in sessions_to_remove:
			del self.active_sessions[session_id]
			revoked_count += 1
		
		self.logger.info(f"Revoked {revoked_count} sessions for user: {user_id}")
		return revoked_count


# Factory function for convenience
def create_user_authentication(config: Optional[SecurityConfiguration] = None) -> UserAuthentication:
	"""Create UserAuthentication instance with optional configuration"""
	return UserAuthentication(config)