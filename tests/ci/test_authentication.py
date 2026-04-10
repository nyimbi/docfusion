#!/usr/bin/env python3
"""
Authentication Module Tests

Comprehensive test suite for the authentication subsystem covering:
- User authentication (password hashing, JWT tokens, MFA, sessions, rate limiting)
- OAuth 2.0 authentication (provider configuration, PKCE, token management)
- SAML 2.0 authentication (IdP/SP configuration, request generation, response parsing)
"""

import asyncio
import base64
import time
from datetime import datetime, timedelta, timezone

import pyotp
import pytest

from docfusion.security.authentication.user_authentication import (
	AuthenticationResult,
	AuthenticationStatus,
	MFAMethod,
	SecurityConfiguration,
	UserAuthentication,
	UserCredentials,
	UserSecurityProfile,
	create_user_authentication,
)
from docfusion.security.authentication.oauth_authentication import (
	OAuthAuthentication,
	OAuthConfiguration,
	OAuthProvider,
	OAuthProviderConfig,
	OAuthState,
	OAuthToken,
	OAuthTokenType,
	OAuthResult,
	OAuthUserInfo,
	OAuthGrantType,
)
from docfusion.security.authentication.saml_authentication import (
	SAMLAuthentication,
	SAMLAuthentication as SAMLAuth,
	SAMLBinding,
	SAMLConfiguration,
	SAMLIdentityProviderConfig,
	SAMLNameIDFormat,
	SAMLServiceProviderConfig,
	SAMLResult,
	SAMLUserInfo,
)


# ============================================================================
# UserAuthentication Fixtures
# ============================================================================


@pytest.fixture
def security_config():
	"""Create a SecurityConfiguration with short timeouts for testing."""
	import secrets
	return SecurityConfiguration(
		min_password_length=8,
		require_uppercase=True,
		require_lowercase=True,
		require_numbers=True,
		require_special_chars=True,
		max_failed_attempts=3,
		lockout_duration_minutes=5,
		progressive_delay=True,
		jwt_secret_key=secrets.token_urlsafe(32),
		jwt_algorithm="HS256",
		access_token_expiry_minutes=15,
		refresh_token_expiry_days=7,
		password_expiry_days=90,
		session_timeout_minutes=60,
		concurrent_sessions_limit=3,
	)


@pytest.fixture
def auth(security_config):
	"""Create UserAuthentication instance with test configuration."""
	return UserAuthentication(config=security_config)


@pytest.fixture
def strong_password():
	"""A password that passes all policy requirements."""
	return "Str0ng!P@ssw0rd"


@pytest.fixture
def weak_password():
	"""A password that fails policy requirements."""
	return "weak"


# ============================================================================
# Password Hashing and Verification Tests
# ============================================================================


class TestPasswordHashing:
	"""Tests for password hashing, verification, and strength validation."""

	def test_hash_password_returns_hash_and_salt(self, auth, strong_password):
		password_hash, salt = auth._hash_password(strong_password)
		assert isinstance(password_hash, str)
		assert isinstance(salt, str)
		assert len(password_hash) > 0
		assert len(salt) > 0

	def test_hash_password_different_salts_per_call(self, auth, strong_password):
		hash1, salt1 = auth._hash_password(strong_password)
		hash2, salt2 = auth._hash_password(strong_password)
		assert hash1 != hash2
		assert salt1 != salt2

	def test_verify_password_correct(self, auth, strong_password):
		password_hash, salt = auth._hash_password(strong_password)
		assert auth._verify_password(strong_password, password_hash, salt) is True

	def test_verify_password_incorrect(self, auth, strong_password):
		password_hash, salt = auth._hash_password(strong_password)
		assert auth._verify_password("WrongPassword1!", password_hash, salt) is False

	def test_verify_password_empty_password(self, auth):
		password_hash, salt = auth._hash_password("V@lidP@ss1")
		assert auth._verify_password("", password_hash, salt) is False

	def test_verify_password_malformed_hash(self, auth, strong_password):
		result = auth._verify_password(strong_password, "not_a_real_hash", "not_a_real_salt")
		assert result is False


class TestPasswordStrengthValidation:
	"""Tests for password strength validation against policy."""

	def test_valid_password(self, auth, strong_password):
		result = auth._validate_password_strength(strong_password)
		assert result["valid"] is True
		assert len(result["errors"]) == 0

	def test_too_short(self, auth):
		result = auth._validate_password_strength("Ab1!")
		assert result["valid"] is False
		assert any("at least" in e for e in result["errors"])

	def test_missing_uppercase(self, auth):
		result = auth._validate_password_strength("lowercase1!")
		assert result["valid"] is False
		assert any("uppercase" in e for e in result["errors"])

	def test_missing_lowercase(self, auth):
		result = auth._validate_password_strength("UPPERCASE1!")
		assert result["valid"] is False
		assert any("lowercase" in e for e in result["errors"])

	def test_missing_number(self, auth):
		result = auth._validate_password_strength("NoNumber!")
		assert result["valid"] is False
		assert any("number" in e for e in result["errors"])

	def test_missing_special_char(self, auth):
		result = auth._validate_password_strength("NoSpecial1")
		assert result["valid"] is False
		assert any("special" in e for e in result["errors"])

	def test_multiple_violations(self, auth):
		result = auth._validate_password_strength("abc")
		assert result["valid"] is False
		assert len(result["errors"]) >= 3

	def test_custom_min_length(self):
		config = SecurityConfiguration(min_password_length=16)
		auth = UserAuthentication(config=config)
		result = auth._validate_password_strength("Sh0rt!Pw")
		assert result["valid"] is False
		assert any("16" in e for e in result["errors"])

	def test_disabled_requirements(self):
		config = SecurityConfiguration(
			min_password_length=4,
			require_uppercase=False,
			require_lowercase=False,
			require_numbers=False,
			require_special_chars=False,
		)
		auth = UserAuthentication(config=config)
		result = auth._validate_password_strength("abcd")
		assert result["valid"] is True


# ============================================================================
# User Creation Tests
# ============================================================================


class TestUserCreation:
	"""Tests for user account creation."""

	async def test_create_user_success(self, auth, strong_password):
		user_id = await auth.create_user("testuser", strong_password)
		assert isinstance(user_id, str)
		assert len(user_id) > 0
		assert "testuser" in auth.users

	async def test_create_user_stores_profile(self, auth, strong_password):
		user_id = await auth.create_user("testuser", strong_password)
		profile = auth.users["testuser"]
		assert profile.user_id == user_id
		assert profile.password_hash != ""
		assert profile.password_salt != ""
		assert profile.password_updated_at is not None
		assert profile.password_expires_at is not None

	async def test_create_user_weak_password_raises(self, auth):
		with pytest.raises(ValueError, match="Password validation failed"):
			await auth.create_user("testuser", "weak")

	async def test_create_user_duplicate_raises(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)
		with pytest.raises(ValueError, match="already exists"):
			await auth.create_user("testuser", strong_password)

	async def test_create_user_with_mfa(self, auth, strong_password):
		user_id = await auth.create_user("mfauser", strong_password, require_mfa=True)
		profile = auth.users["mfauser"]
		assert profile.mfa_enabled is True
		assert profile.mfa_secret is not None
		assert len(profile.mfa_backup_codes) > 0
		assert MFAMethod.TOTP in profile.mfa_methods

	async def test_create_user_without_mfa(self, auth, strong_password):
		await auth.create_user("nomfa", strong_password, require_mfa=False)
		profile = auth.users["nomfa"]
		assert profile.mfa_enabled is False


# ============================================================================
# Authentication Tests
# ============================================================================


class TestAuthentication:
	"""Tests for the main authenticate() flow."""

	async def test_authenticate_success(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)
		creds = UserCredentials(
			username="testuser",
			password=strong_password,
			ip_address="127.0.0.1",
		)
		result = await auth.authenticate(creds)
		assert result.status == AuthenticationStatus.SUCCESS
		assert result.user_id is not None
		assert result.access_token is not None
		assert result.refresh_token is not None
		assert result.expires_at is not None
		assert result.session_id is not None

	async def test_authenticate_invalid_username(self, auth, strong_password):
		creds = UserCredentials(
			username="nonexistent",
			password=strong_password,
			ip_address="127.0.0.1",
		)
		result = await auth.authenticate(creds)
		assert result.status == AuthenticationStatus.INVALID_CREDENTIALS

	async def test_authenticate_wrong_password(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)
		creds = UserCredentials(
			username="testuser",
			password="WrongP@ss1",
			ip_address="127.0.0.1",
		)
		result = await auth.authenticate(creds)
		assert result.status == AuthenticationStatus.INVALID_CREDENTIALS

	async def test_authenticate_mfa_required(self, auth, strong_password):
		await auth.create_user("mfauser", strong_password, require_mfa=True)
		creds = UserCredentials(
			username="mfauser",
			password=strong_password,
			ip_address="127.0.0.1",
		)
		result = await auth.authenticate(creds)
		assert result.status == AuthenticationStatus.MFA_REQUIRED
		assert result.requires_mfa is True
		assert MFAMethod.TOTP in result.mfa_methods

	async def test_authenticate_mfa_with_valid_totp(self, auth, strong_password):
		await auth.create_user("mfauser", strong_password, require_mfa=True)
		profile = auth.users["mfauser"]
		totp = pyotp.TOTP(profile.mfa_secret)
		valid_code = totp.now()

		creds = UserCredentials(
			username="mfauser",
			password=strong_password,
			mfa_code=valid_code,
			ip_address="127.0.0.1",
		)
		result = await auth.authenticate(creds)
		assert result.status == AuthenticationStatus.SUCCESS

	async def test_authenticate_mfa_with_invalid_code(self, auth, strong_password):
		await auth.create_user("mfauser", strong_password, require_mfa=True)
		creds = UserCredentials(
			username="mfauser",
			password=strong_password,
			mfa_code="000000",
			ip_address="127.0.0.1",
		)
		result = await auth.authenticate(creds)
		assert result.status == AuthenticationStatus.INVALID_CREDENTIALS

	async def test_authenticate_mfa_with_backup_code(self, auth, strong_password):
		await auth.create_user("mfauser", strong_password, require_mfa=True)
		profile = auth.users["mfauser"]
		backup_code = profile.mfa_backup_codes[0]

		creds = UserCredentials(
			username="mfauser",
			password=strong_password,
			mfa_code=backup_code,
			ip_address="127.0.0.1",
		)
		result = await auth.authenticate(creds)
		assert result.status == AuthenticationStatus.SUCCESS
		# Backup code should be consumed
		assert backup_code not in profile.mfa_backup_codes


# ============================================================================
# Token Tests
# ============================================================================


class TestTokens:
	"""Tests for JWT access and refresh token generation and validation."""

	async def test_generate_access_token(self, auth):
		token = auth._generate_access_token("user123")
		assert isinstance(token, str)
		assert len(token) > 0

	async def test_generate_access_token_with_device(self, auth):
		token = auth._generate_access_token("user123", device_id="device_abc")
		assert isinstance(token, str)

	async def test_generate_refresh_token(self, auth):
		token = auth._generate_refresh_token("user123")
		assert isinstance(token, str)

	async def test_verify_valid_token(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)
		creds = UserCredentials(username="testuser", password=strong_password, ip_address="127.0.0.1")
		result = await auth.authenticate(creds)
		assert result.status == AuthenticationStatus.SUCCESS

		claims = await auth.verify_token(result.access_token)
		assert claims["user_id"] is not None
		assert claims["type"] == "access"

	async def test_verify_invalid_token(self, auth):
		with pytest.raises(Exception):
			await auth.verify_token("invalid.token.here")

	async def test_refresh_token_success(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)
		creds = UserCredentials(username="testuser", password=strong_password, ip_address="127.0.0.1")
		result = await auth.authenticate(creds)
		assert result.status == AuthenticationStatus.SUCCESS

		refresh_result = await auth.refresh_token(result.refresh_token)
		assert refresh_result.status == AuthenticationStatus.SUCCESS
		assert refresh_result.access_token is not None

	async def test_refresh_token_with_access_token_fails(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)
		creds = UserCredentials(username="testuser", password=strong_password, ip_address="127.0.0.1")
		result = await auth.authenticate(creds)
		assert result.status == AuthenticationStatus.SUCCESS

		refresh_result = await auth.refresh_token(result.access_token)
		assert refresh_result.status == AuthenticationStatus.INVALID_CREDENTIALS

	async def test_refresh_token_invalid(self, auth):
		refresh_result = await auth.refresh_token("invalid.refresh.token")
		assert refresh_result.status == AuthenticationStatus.INVALID_CREDENTIALS

	async def test_token_contains_session_id(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)
		creds = UserCredentials(username="testuser", password=strong_password, ip_address="127.0.0.1")
		result = await auth.authenticate(creds)
		claims = await auth.verify_token(result.access_token)
		assert "session_id" in claims


# ============================================================================
# Session Management Tests
# ============================================================================


class TestSessionManagement:
	"""Tests for session creation, retrieval, and revocation."""

	async def test_session_created_on_auth(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)
		creds = UserCredentials(username="testuser", password=strong_password, ip_address="127.0.0.1")
		result = await auth.authenticate(creds)
		assert result.session_id in auth.active_sessions

	async def test_session_contains_metadata(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)
		creds = UserCredentials(
			username="testuser",
			password=strong_password,
			ip_address="10.0.0.1",
			user_agent="TestBrowser/1.0",
			device_id="dev123",
		)
		result = await auth.authenticate(creds)
		session = auth.active_sessions[result.session_id]
		assert session["user_id"] == result.user_id
		assert session["ip_address"] == "10.0.0.1"
		assert session["user_agent"] == "TestBrowser/1.0"
		assert session["device_id"] == "dev123"

	async def test_logout_invalidates_session(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)
		creds = UserCredentials(username="testuser", password=strong_password, ip_address="127.0.0.1")
		result = await auth.authenticate(creds)
		assert result.status == AuthenticationStatus.SUCCESS

		logout_result = await auth.logout(result.session_id)
		assert logout_result is True
		assert result.session_id not in auth.active_sessions

	async def test_logout_nonexistent_session(self, auth):
		logout_result = await auth.logout("nonexistent_session")
		assert logout_result is False

	async def test_get_user_sessions(self, auth, strong_password):
		user_id = await auth.create_user("testuser", strong_password)
		creds = UserCredentials(username="testuser", password=strong_password, ip_address="127.0.0.1")
		await auth.authenticate(creds)
		await auth.authenticate(creds)

		sessions = await auth.get_user_sessions(user_id)
		assert len(sessions) == 2

	async def test_revoke_all_sessions(self, auth, strong_password):
		user_id = await auth.create_user("testuser", strong_password)
		creds = UserCredentials(username="testuser", password=strong_password, ip_address="127.0.0.1")
		await auth.authenticate(creds)
		await auth.authenticate(creds)

		revoked = await auth.revoke_all_sessions(user_id)
		assert revoked == 2
		assert len(auth.active_sessions) == 0

	async def test_revoked_session_token_fails_verify(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)
		creds = UserCredentials(username="testuser", password=strong_password, ip_address="127.0.0.1")
		result = await auth.authenticate(creds)

		await auth.logout(result.session_id)
		with pytest.raises(Exception):
			await auth.verify_token(result.access_token)


# ============================================================================
# Account Lockout Tests
# ============================================================================


class TestAccountLockout:
	"""Tests for account lockout after failed login attempts."""

	async def test_lockout_after_max_failures(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)
		creds = UserCredentials(
			username="testuser",
			password="WrongP@ss1!",
			ip_address="127.0.0.1",
		)

		# Fail max_failed_attempts times
		for _ in range(auth.config.max_failed_attempts):
			result = await auth.authenticate(creds)
			assert result.status == AuthenticationStatus.INVALID_CREDENTIALS

		# Next attempt should be locked
		result = await auth.authenticate(creds)
		assert result.status == AuthenticationStatus.ACCOUNT_LOCKED

	async def test_successful_login_resets_failures(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)

		# One failed attempt
		bad_creds = UserCredentials(
			username="testuser",
			password="WrongP@ss1!",
			ip_address="127.0.0.1",
		)
		await auth.authenticate(bad_creds)

		# Successful login
		good_creds = UserCredentials(
			username="testuser",
			password=strong_password,
			ip_address="127.0.0.1",
		)
		result = await auth.authenticate(good_creds)
		assert result.status == AuthenticationStatus.SUCCESS

		# Failure count should be reset
		profile = auth.users["testuser"]
		assert profile.failed_login_attempts == 0

	async def test_progressive_delay_increases_lockout(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)
		bad_creds = UserCredentials(
			username="testuser",
			password="WrongP@ss1!",
			ip_address="127.0.0.1",
		)

		# Trigger lockout
		for _ in range(auth.config.max_failed_attempts):
			await auth.authenticate(bad_creds)

		profile = auth.users["testuser"]
		assert profile.account_locked_until is not None


# ============================================================================
# Password Expiry Tests
# ============================================================================


class TestPasswordExpiry:
	"""Tests for password expiry detection."""

	async def test_expired_password_detected(self, auth, strong_password):
		user_id = await auth.create_user("testuser", strong_password)
		profile = auth.users["testuser"]

		# Force password expiry
		profile.password_expires_at = datetime.now(timezone.utc) - timedelta(days=1)

		creds = UserCredentials(
			username="testuser",
			password=strong_password,
			ip_address="127.0.0.1",
		)
		result = await auth.authenticate(creds)
		assert result.status == AuthenticationStatus.EXPIRED_PASSWORD

	async def test_force_password_change(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)
		profile = auth.users["testuser"]
		profile.force_password_change = True

		creds = UserCredentials(
			username="testuser",
			password=strong_password,
			ip_address="127.0.0.1",
		)
		result = await auth.authenticate(creds)
		assert result.status == AuthenticationStatus.EXPIRED_PASSWORD

	async def test_change_password_success(self, auth, strong_password):
		user_id = await auth.create_user("testuser", strong_password)
		new_password = "N3wStr0ng!P@ss"
		result = await auth.change_password(user_id, strong_password, new_password)
		assert result is True

		# Verify new password works
		creds = UserCredentials(
			username="testuser",
			password=new_password,
			ip_address="127.0.0.1",
		)
		auth_result = await auth.authenticate(creds)
		assert auth_result.status == AuthenticationStatus.SUCCESS

	async def test_change_password_wrong_current(self, auth, strong_password):
		user_id = await auth.create_user("testuser", strong_password)
		result = await auth.change_password(user_id, "WrongP@ss1!", "N3wStr0ng!P@ss")
		assert result is False

	async def test_change_password_same_password(self, auth, strong_password):
		user_id = await auth.create_user("testuser", strong_password)
		result = await auth.change_password(user_id, strong_password, strong_password)
		assert result is False

	async def test_change_password_weak_new(self, auth, strong_password):
		user_id = await auth.create_user("testuser", strong_password)
		result = await auth.change_password(user_id, strong_password, "weak")
		assert result is False

	async def test_change_password_nonexistent_user(self, auth, strong_password):
		result = await auth.change_password("nonexistent_id", strong_password, "N3wStr0ng!P@ss")
		assert result is False


# ============================================================================
# Rate Limiting Tests
# ============================================================================


class TestRateLimiting:
	"""Tests for IP-based rate limiting on authentication attempts."""

	def test_rate_limit_allows_initial_requests(self, auth):
		assert auth._check_rate_limit("192.168.1.1") is True

	def test_rate_limit_blocks_after_max(self, auth):
		ip = "192.168.1.2"
		# Default max is 10 attempts in 5-minute window
		for _ in range(10):
			auth._check_rate_limit(ip)
		# 11th should be blocked
		assert auth._check_rate_limit(ip) is False

	def test_rate_limit_no_ip_always_passes(self, auth):
		# None IP should not be rate limited
		assert auth._check_rate_limit(None) is True

	def test_rate_limit_separate_ips(self, auth):
		ip1 = "192.168.1.10"
		ip2 = "192.168.1.11"
		for _ in range(10):
			auth._check_rate_limit(ip1)
		# ip1 blocked, ip2 not
		assert auth._check_rate_limit(ip1) is False
		assert auth._check_rate_limit(ip2) is True

	def test_rate_limit_cleans_old_entries(self, auth):
		ip = "192.168.1.20"
		# Add an old timestamp manually
		auth.rate_limit_tracker[ip] = [time.time() - 600]  # 10 minutes ago
		# Should still allow (old entry cleaned)
		assert auth._check_rate_limit(ip) is True

	async def test_authenticate_rate_limited(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)
		ip = "10.0.0.1"
		creds = UserCredentials(username="testuser", password="WrongP@ss1!", ip_address=ip)

		# Exhaust rate limit
		for _ in range(10):
			await auth.authenticate(creds)

		# Next attempt from same IP should be rate limited
		good_creds = UserCredentials(username="testuser", password=strong_password, ip_address=ip)
		result = await auth.authenticate(good_creds)
		assert result.status == AuthenticationStatus.RATE_LIMITED


# ============================================================================
# MFA Tests
# ============================================================================


class TestMFA:
	"""Tests for multi-factor authentication flows."""

	async def test_enable_mfa(self, auth, strong_password):
		user_id = await auth.create_user("testuser", strong_password)
		result = await auth.enable_mfa(user_id)
		assert "secret" in result
		assert "qr_code" in result
		assert "backup_codes" in result
		assert "uri" in result
		assert len(result["backup_codes"]) > 0

	async def test_enable_mfa_already_enabled(self, auth, strong_password):
		user_id = await auth.create_user("mfauser", strong_password, require_mfa=True)
		with pytest.raises(ValueError, match="already enabled"):
			await auth.enable_mfa(user_id)

	async def test_enable_mfa_nonexistent_user(self, auth):
		with pytest.raises(ValueError, match="User not found"):
			await auth.enable_mfa("nonexistent_id")

	async def test_verify_mfa_setup_valid(self, auth, strong_password):
		user_id = await auth.create_user("testuser", strong_password)
		result = await auth.enable_mfa(user_id)

		totp = pyotp.TOTP(result["secret"])
		valid_code = totp.now()

		verified = await auth.verify_mfa_setup(user_id, valid_code)
		assert verified is True

		profile = auth.users["testuser"]
		assert profile.mfa_enabled is True

	async def test_verify_mfa_setup_invalid_code(self, auth, strong_password):
		user_id = await auth.create_user("testuser", strong_password)
		await auth.enable_mfa(user_id)

		verified = await auth.verify_mfa_setup(user_id, "000000")
		assert verified is False

	async def test_backup_codes_consumed_on_use(self, auth, strong_password):
		await auth.create_user("mfauser", strong_password, require_mfa=True)
		profile = auth.users["mfauser"]
		initial_count = len(profile.mfa_backup_codes)
		backup_code = profile.mfa_backup_codes[0]

		creds = UserCredentials(
			username="mfauser",
			password=strong_password,
			mfa_code=backup_code,
			ip_address="127.0.0.1",
		)
		await auth.authenticate(creds)
		assert len(profile.mfa_backup_codes) == initial_count - 1


# ============================================================================
# Device Trust Tests
# ============================================================================


class TestDeviceTrust:
	"""Tests for device trust detection."""

	def test_trusted_device(self, auth, strong_password):
		user_id = "user123"
		profile = UserSecurityProfile(
			user_id=user_id,
			password_hash="hash",
			password_salt="salt",
			password_updated_at=datetime.now(timezone.utc),
			trusted_devices=["device_abc"],
		)
		assert auth._is_device_trusted(profile, "device_abc") is True

	def test_untrusted_device(self, auth):
		profile = UserSecurityProfile(
			user_id="user123",
			password_hash="hash",
			password_salt="salt",
			password_updated_at=datetime.now(timezone.utc),
			trusted_devices=["device_abc"],
		)
		assert auth._is_device_trusted(profile, "device_xyz") is False

	def test_no_device_id(self, auth):
		profile = UserSecurityProfile(
			user_id="user123",
			password_hash="hash",
			password_salt="salt",
			password_updated_at=datetime.now(timezone.utc),
		)
		assert auth._is_device_trusted(profile, None) is False

	async def test_security_warning_new_device(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)
		creds = UserCredentials(
			username="testuser",
			password=strong_password,
			device_id="new_device",
			ip_address="127.0.0.1",
		)
		result = await auth.authenticate(creds)
		assert result.status == AuthenticationStatus.SUCCESS
		assert any("new device" in w.lower() for w in result.security_warnings)


# ============================================================================
# Security Warnings Tests
# ============================================================================


class TestSecurityWarnings:
	"""Tests for security warning generation."""

	async def test_password_expiry_warning(self, auth, strong_password):
		await auth.create_user("testuser", strong_password)
		profile = auth.users["testuser"]
		# Set password to expire in 5 days (within 7-day warning window)
		profile.password_expires_at = datetime.now(timezone.utc) + timedelta(days=5)

		creds = UserCredentials(
			username="testuser",
			password=strong_password,
			ip_address="127.0.0.1",
		)
		result = await auth.authenticate(creds)
		assert result.status == AuthenticationStatus.SUCCESS
		assert any("expires" in w.lower() for w in result.security_warnings)


# ============================================================================
# Factory Function Test
# ============================================================================


class TestFactoryFunction:
	"""Tests for the create_user_authentication factory."""

	def test_create_with_default_config(self):
		auth = create_user_authentication()
		assert isinstance(auth, UserAuthentication)

	def test_create_with_custom_config(self, security_config):
		auth = create_user_authentication(config=security_config)
		assert auth.config == security_config


# ============================================================================
# OAuth Authentication Tests
# ============================================================================


@pytest.fixture
def oauth_provider_configs():
	"""Create OAuth provider configurations for testing."""
	return {
		OAuthProvider.GOOGLE: OAuthProviderConfig(
			provider=OAuthProvider.GOOGLE,
			client_id="test_google_client_id",
			client_secret="test_google_client_secret",
			authorization_endpoint="https://accounts.google.com/o/oauth2/v2/auth",
			token_endpoint="https://oauth2.googleapis.com/token",
			userinfo_endpoint="https://www.googleapis.com/oauth2/v2/userinfo",
			scope="openid profile email",
			redirect_uri="http://localhost:8080/callback",
			enable_pkce=True,
		),
		OAuthProvider.MICROSOFT: OAuthProviderConfig(
			provider=OAuthProvider.MICROSOFT,
			client_id="test_ms_client_id",
			client_secret="test_ms_client_secret",
			authorization_endpoint="https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
			token_endpoint="https://login.microsoftonline.com/common/oauth2/v2.0/token",
			userinfo_endpoint="https://graph.microsoft.com/v1.0/me",
			scope="openid profile email User.Read",
			redirect_uri="http://localhost:8080/callback",
			enable_pkce=True,
		),
		OAuthProvider.GITHUB: OAuthProviderConfig(
			provider=OAuthProvider.GITHUB,
			client_id="test_gh_client_id",
			client_secret="test_gh_client_secret",
			authorization_endpoint="https://github.com/login/oauth/authorize",
			token_endpoint="https://github.com/login/oauth/access_token",
			userinfo_endpoint="https://api.github.com/user",
			scope="user:email",
			redirect_uri="http://localhost:8080/callback",
			enable_pkce=True,
		),
	}


@pytest.fixture
def oauth_config(oauth_provider_configs):
	"""Create OAuth configuration for testing."""
	return OAuthConfiguration(
		providers=oauth_provider_configs,
		state_expiry_minutes=10,
		access_token_expiry_minutes=60,
		refresh_token_expiry_days=30,
		auth_rate_limit_per_hour=100,
		token_rate_limit_per_hour=500,
	)


@pytest.fixture
def oauth(oauth_config):
	"""Create OAuthAuthentication instance with test configuration."""
	return OAuthAuthentication(config=oauth_config)


class TestOAuthConfiguration:
	"""Tests for OAuth configuration and provider setup."""

	def test_provider_configs_available(self, oauth):
		assert OAuthProvider.GOOGLE in oauth.config.providers
		assert OAuthProvider.MICROSOFT in oauth.config.providers
		assert OAuthProvider.GITHUB in oauth.config.providers

	def test_default_state_expiry(self, oauth):
		assert oauth.config.state_expiry_minutes == 10

	def test_pkce_enabled_by_default(self, oauth):
		for provider_config in oauth.config.providers.values():
			assert provider_config.enable_pkce is True


class TestOAuthAuthorizationUrl:
	"""Tests for OAuth authorization URL generation."""

	def test_google_authorization_url(self, oauth):
		url = oauth.get_authorization_url(
			OAuthProvider.GOOGLE,
			"http://localhost:8080/callback",
			client_ip="127.0.0.1",
		)
		assert "accounts.google.com" in url
		assert "client_id=test_google_client_id" in url
		assert "response_type=code" in url
		assert "scope=" in url

	def test_microsoft_authorization_url(self, oauth):
		url = oauth.get_authorization_url(
			OAuthProvider.MICROSOFT,
			"http://localhost:8080/callback",
			client_ip="127.0.0.1",
		)
		assert "login.microsoftonline.com" in url

	def test_github_authorization_url(self, oauth):
		url = oauth.get_authorization_url(
			OAuthProvider.GITHUB,
			"http://localhost:8080/callback",
			client_ip="127.0.0.1",
		)
		assert "github.com" in url

	def test_pkce_parameters_included(self, oauth):
		url = oauth.get_authorization_url(
			OAuthProvider.GOOGLE,
			"http://localhost:8080/callback",
			client_ip="127.0.0.1",
		)
		assert "code_challenge=" in url
		assert "code_challenge_method=S256" in url

	def test_state_parameter_included(self, oauth):
		url = oauth.get_authorization_url(
			OAuthProvider.GOOGLE,
			"http://localhost:8080/callback",
			client_ip="127.0.0.1",
		)
		assert "state=" in url
		# Verify state is stored
		assert len(oauth.oauth_states) > 0

	def test_unconfigured_provider_raises(self, oauth):
		empty_config = OAuthConfiguration()
		empty_oauth = OAuthAuthentication(config=empty_config)
		# Remove default providers that were auto-added
		empty_oauth.config.providers.clear()
		with pytest.raises(ValueError, match="not configured"):
			empty_oauth.get_authorization_url(
				OAuthProvider.GOOGLE,
				"http://localhost:8080/callback",
			)


class TestOAuthState:
	"""Tests for OAuth state management and CSRF protection."""

	def test_state_stored(self, oauth):
		oauth.get_authorization_url(
			OAuthProvider.GOOGLE,
			"http://localhost:8080/callback",
			client_ip="127.0.0.1",
		)
		assert len(oauth.oauth_states) == 1

	def test_state_has_expiry(self, oauth):
		oauth.get_authorization_url(
			OAuthProvider.GOOGLE,
			"http://localhost:8080/callback",
			client_ip="127.0.0.1",
		)
		state = list(oauth.oauth_states.values())[0]
		assert state.expires_at > datetime.now(timezone.utc)

	def test_state_has_pkce_verifier(self, oauth):
		oauth.get_authorization_url(
			OAuthProvider.GOOGLE,
			"http://localhost:8080/callback",
			client_ip="127.0.0.1",
		)
		state = list(oauth.oauth_states.values())[0]
		assert state.code_verifier is not None
		assert len(state.code_verifier) > 0


class TestOAuthCallback:
	"""Tests for OAuth callback handling."""

	async def test_invalid_state_returns_error(self, oauth):
		result = await oauth.handle_authorization_callback(
			OAuthProvider.GOOGLE,
			code="test_code",
			state="invalid_state_id",
		)
		assert result.success is False
		assert result.error == "invalid_state"

	async def test_expired_state_returns_error(self, oauth):
		# Create a state that's already expired
		expired_state = OAuthState(
			provider=OAuthProvider.GOOGLE,
			redirect_uri="http://localhost:8080/callback",
			expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
		)
		oauth.oauth_states[expired_state.state_id] = expired_state

		result = await oauth.handle_authorization_callback(
			OAuthProvider.GOOGLE,
			code="test_code",
			state=expired_state.state_id,
		)
		assert result.success is False
		assert result.error == "expired_state"

	async def test_provider_mismatch_returns_error(self, oauth):
		state = OAuthState(
			provider=OAuthProvider.GOOGLE,
			redirect_uri="http://localhost:8080/callback",
			expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
		)
		oauth.oauth_states[state.state_id] = state

		result = await oauth.handle_authorization_callback(
			OAuthProvider.GITHUB,  # Different provider
			code="test_code",
			state=state.state_id,
		)
		assert result.success is False
		assert result.error == "provider_mismatch"


class TestOAuthTokenManagement:
	"""Tests for OAuth token validation and revocation."""

	async def test_validate_valid_token(self, oauth):
		token = OAuthToken(
			provider=OAuthProvider.GOOGLE,
			user_id="user123",
			access_token="at_abc",
			refresh_token="rt_abc",
			expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
			scope="openid profile email",
			provider_user_id="prov_user_123",
		)
		oauth.oauth_tokens[token.token_id] = token

		assert await oauth.validate_token(token.token_id) is True

	async def test_validate_expired_token(self, oauth):
		token = OAuthToken(
			provider=OAuthProvider.GOOGLE,
			user_id="user123",
			access_token="at_abc",
			expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
			scope="openid profile email",
			provider_user_id="prov_user_123",
		)
		oauth.oauth_tokens[token.token_id] = token

		assert await oauth.validate_token(token.token_id) is False

	async def test_validate_nonexistent_token(self, oauth):
		assert await oauth.validate_token("nonexistent") is False

	async def test_revoke_token(self, oauth):
		token = OAuthToken(
			provider=OAuthProvider.GOOGLE,
			user_id="user123",
			access_token="at_abc",
			expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
			scope="openid profile email",
			provider_user_id="prov_user_123",
		)
		oauth.oauth_tokens[token.token_id] = token

		result = await oauth.revoke_token(token.token_id)
		assert result is True
		assert token.token_id not in oauth.oauth_tokens

	async def test_revoke_nonexistent_token(self, oauth):
		result = await oauth.revoke_token("nonexistent")
		assert result is False


# ============================================================================
# SAML Authentication Tests
# ============================================================================


@pytest.fixture
def saml_idp_config():
	"""Create SAML Identity Provider configuration for testing."""
	return SAMLIdentityProviderConfig(
		entity_id="https://idp.example.com",
		sso_url="https://idp.example.com/sso",
		slo_url="https://idp.example.com/slo",
		x509_cert="MIIDBzCCAe+gAwIBAgIJAP...",
		preferred_binding=SAMLBinding.HTTP_REDIRECT,
		name_id_format=SAMLNameIDFormat.EMAIL,
		want_assertions_signed=True,
	)


@pytest.fixture
def saml_sp_config():
	"""Create SAML Service Provider configuration for testing."""
	return SAMLServiceProviderConfig(
		entity_id="https://sp.docufusion.ai",
		assertion_consumer_service_url="https://sp.docufusion.ai/acs",
		single_logout_service_url="https://sp.docufusion.ai/slo",
		x509_cert="MIIDBzCCAe+gAwIBAgIJAP...",
		sign_requests=True,
	)


@pytest.fixture
def saml_config(saml_sp_config, saml_idp_config):
	"""Create SAML configuration for testing."""
	return SAMLConfiguration(
		service_provider=saml_sp_config,
		identity_providers={"https://idp.example.com": saml_idp_config},
		request_id_expiry_minutes=10,
		force_authn=False,
		is_passive=False,
		clock_skew_seconds=300,
		maximum_authentication_age_seconds=3600,
		require_signed_assertions=True,
	)


@pytest.fixture
def saml(saml_config):
	"""Create SAMLAuthentication instance with test configuration."""
	return SAMLAuthentication(config=saml_config)


class TestSAMLConfiguration:
	"""Tests for SAML configuration validation."""

	def test_saml_initialization(self, saml):
		assert saml.config is not None
		assert "https://idp.example.com" in saml.config.identity_providers

	def test_idp_config_available(self, saml):
		idp = saml.config.identity_providers["https://idp.example.com"]
		assert idp.sso_url == "https://idp.example.com/sso"
		assert idp.slo_url == "https://idp.example.com/slo"

	def test_sp_config_available(self, saml):
		sp = saml.config.service_provider
		assert sp.entity_id == "https://sp.docufusion.ai"
		assert sp.assertion_consumer_service_url == "https://sp.docufusion.ai/acs"


class TestSAMLMetadata:
	"""Tests for SAML metadata XML generation."""

	def test_metadata_contains_entity_id(self, saml):
		metadata = saml.get_metadata_xml()
		assert "https://sp.docufusion.ai" in metadata

	def test_metadata_contains_acs_url(self, saml):
		metadata = saml.get_metadata_xml()
		assert "https://sp.docufusion.ai/acs" in metadata

	def test_metadata_contains_slo_url(self, saml):
		metadata = saml.get_metadata_xml()
		assert "https://sp.docufusion.ai/slo" in metadata

	def test_metadata_contains_org_info(self, saml):
		metadata = saml.get_metadata_xml()
		assert "DocuFusion" in metadata


class TestSAMLAuthnRequest:
	"""Tests for SAML AuthnRequest generation."""

	def test_create_authn_request(self, saml):
		request_xml = saml.create_authn_request("https://idp.example.com")
		assert "AuthnRequest" in request_xml
		assert "https://idp.example.com/sso" in request_xml

	def test_create_authn_request_with_relay_state(self, saml):
		request_xml = saml.create_authn_request(
			"https://idp.example.com",
			relay_state="https://app.docufusion.ai/dashboard",
		)
		assert "AuthnRequest" in request_xml

	def test_create_authn_request_stored(self, saml):
		saml.create_authn_request("https://idp.example.com")
		assert len(saml.pending_requests) == 1

	def test_create_authn_request_unknown_idp_raises(self, saml):
		with pytest.raises(ValueError, match="not configured"):
			saml.create_authn_request("https://unknown.idp.com")


class TestSAMLSSOUrl:
	"""Tests for SAML SSO URL generation."""

	def test_get_sso_url_redirect_binding(self, saml):
		url = saml.get_sso_url("https://idp.example.com")
		assert "https://idp.example.com/sso" in url
		assert "SAMLRequest=" in url

	def test_get_sso_url_with_relay_state(self, saml):
		url = saml.get_sso_url(
			"https://idp.example.com",
			relay_state="test_state",
		)
		assert "RelayState=test_state" in url

	def test_get_sso_url_unknown_idp_raises(self, saml):
		with pytest.raises(ValueError):
			saml.get_sso_url("https://unknown.idp.com")


class TestSAMLResponseHandling:
	"""Tests for SAML response parsing and validation."""

	async def test_invalid_base64_response(self, saml):
		result = await saml.handle_sso_response("not_valid_base64!!!")
		assert result.success is False

	async def test_invalid_xml_response(self, saml):
		encoded = base64.b64encode(b"<invalid>not saml</invalid>").decode()
		result = await saml.handle_sso_response(encoded)
		# Should fail due to missing SAML structure
		assert result.success is False


class TestSAMLLogout:
	"""Tests for SAML logout request generation."""

	def test_create_logout_request(self, saml):
		logout_xml = saml.create_logout_request(
			"https://idp.example.com",
			name_id="user@example.com",
			session_index="session_123",
		)
		assert "LogoutRequest" in logout_xml
		assert "user@example.com" in logout_xml
		assert "session_123" in logout_xml

	def test_create_logout_request_unknown_idp_raises(self, saml):
		with pytest.raises(ValueError, match="Single logout not supported"):
			saml.create_logout_request(
				"https://unknown.idp.com",
				name_id="user@example.com",
			)

	def test_create_logout_request_no_slo_raises(self, saml):
		# Add an IdP without SLO URL
		idp_no_slo = SAMLIdentityProviderConfig(
			entity_id="https://idp-no-slo.example.com",
			sso_url="https://idp-no-slo.example.com/sso",
			slo_url=None,
		)
		saml.config.identity_providers["https://idp-no-slo.example.com"] = idp_no_slo
		with pytest.raises(ValueError, match="Single logout not supported"):
			saml.create_logout_request(
				"https://idp-no-slo.example.com",
				name_id="user@example.com",
			)


class TestSAMLSessionManagement:
	"""Tests for SAML session management."""

	def test_active_sessions_empty_initially(self, saml):
		assert len(saml.active_sessions) == 0

	async def test_handle_logout_response_invalid_xml(self, saml):
		result = await saml.handle_logout_response("not_valid_base64!!!")
		assert result is False


# ============================================================================
# Pydantic Model Validation Tests
# ============================================================================


class TestModelValidation:
	"""Tests for Pydantic model validation on authentication data classes."""

	def test_authentication_result_defaults(self):
		result = AuthenticationResult(status=AuthenticationStatus.SUCCESS)
		assert result.user_id is None
		assert result.access_token is None
		assert result.requires_mfa is False
		assert len(result.mfa_methods) == 0
		assert len(result.security_warnings) == 0
		assert result.session_id is not None

	def test_authentication_result_extra_fields_forbidden(self):
		with pytest.raises(Exception):
			AuthenticationResult(
				status=AuthenticationStatus.SUCCESS,
				extra_field="not_allowed",
			)

	def test_user_security_profile_defaults(self):
		profile = UserSecurityProfile(
			user_id="u1",
			password_hash="hash",
			password_salt="salt",
			password_updated_at=datetime.now(timezone.utc),
		)
		assert profile.failed_login_attempts == 0
		assert profile.mfa_enabled is False
		assert profile.force_password_change is False

	def test_oauth_provider_enum_values(self):
		assert OAuthProvider.GOOGLE.value == "google"
		assert OAuthProvider.MICROSOFT.value == "microsoft"
		assert OAuthProvider.GITHUB.value == "github"

	def test_saml_binding_enum_values(self):
		assert "HTTP-Redirect" in SAMLBinding.HTTP_REDIRECT.value
		assert "HTTP-POST" in SAMLBinding.HTTP_POST.value

	def test_mfa_method_enum_values(self):
		assert MFAMethod.TOTP.value == "totp"
		assert MFAMethod.SMS.value == "sms"
		assert MFAMethod.EMAIL.value == "email"
		assert MFAMethod.BACKUP_CODES.value == "backup_codes"