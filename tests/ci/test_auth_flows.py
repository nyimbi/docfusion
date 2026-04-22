#!/usr/bin/env python3
"""Smoke coverage for docfusion.security top-level modules.

Happy and failure paths for each primary security component.
All tests use real objects; no mocks.
"""

import asyncio

import pytest

from docfusion.security.authentication.api_authentication import (
	APIAuthentication,
	APIAuthenticationConfig,
	APIKeyResult,
)
from docfusion.security.authentication.user_authentication import (
	AuthenticationResult,
	AuthenticationStatus,
	SecurityConfiguration,
	UserAuthentication,
	UserCredentials,
)
from docfusion.security.authorization.abac_authorization import (
	ABACAuthorization,
	ABACConfiguration,
	ABACDecision,
	ABACPolicy,
	AttributeCondition,
	AttributeType,
	ComparisonOperator,
	PolicyEffect,
	PolicyRule,
)
from docfusion.security.authorization.document_permissions import (
	DocumentPermissions,
	DocumentPermissionsConfig,
	PermissionLevel,
)
from docfusion.security.data_protection.dlp_system import (
	ContentType,
	DLPConfiguration,
	DLPSystem,
	ScanResult,
)
from docfusion.security.encryption.data_encryption import (
	DataEncryption,
	DecryptionResult,
	EncryptionAlgorithm,
	EncryptionConfiguration,
	EncryptionResult,
	KeyType,
)
from docfusion.security.security_manager import SecurityManager


# ============================================================================
# UserAuthentication
# ============================================================================

class TestUserAuthentication:
	"""Happy and failure paths for UserAuthentication."""

	def test_create_user_and_authenticate(self):
		"""Happy path: create a user and authenticate with valid credentials."""
		auth = UserAuthentication(SecurityConfiguration())
		user_id = asyncio.run(
			auth.create_user("testuser", "SecureP@ss123", "test@example.com")
		)
		assert isinstance(user_id, str)
		assert user_id != ""

		login = asyncio.run(
			auth.authenticate(
				UserCredentials(username="testuser", password="SecureP@ss123")
			)
		)
		assert isinstance(login, AuthenticationResult)
		assert login.status == AuthenticationStatus.SUCCESS

	def test_authenticate_invalid_credentials(self):
		"""Failure path: authenticate with wrong password."""
		auth = UserAuthentication(SecurityConfiguration())
		asyncio.run(
			auth.create_user("testuser2", "SecureP@ss123", "test2@example.com")
		)
		login = asyncio.run(
			auth.authenticate(
				UserCredentials(username="testuser2", password="wrongpassword")
			)
		)
		assert login.status == AuthenticationStatus.INVALID_CREDENTIALS


# ============================================================================
# APIAuthentication
# ============================================================================

class TestAPIAuthentication:
	"""Happy and failure paths for APIAuthentication."""

	def test_create_and_authenticate_api_key(self):
		"""Happy path: create an API key and authenticate it."""
		api_auth = APIAuthentication(APIAuthenticationConfig())
		result = asyncio.run(
			api_auth.create_api_key(
				user_id="user-1",
				name="test-key",
			)
		)
		assert isinstance(result, APIKeyResult)
		assert result.success is True
		assert result.key_id is not None

		valid = asyncio.run(api_auth.authenticate_api_key(result.api_key))
		assert isinstance(valid, APIKeyResult)
		assert valid.success is True

	def test_authenticate_nonexistent_api_key(self):
		"""Failure path: authenticate a key that does not exist."""
		api_auth = APIAuthentication(APIAuthenticationConfig())
		valid = asyncio.run(api_auth.authenticate_api_key("nonexistent-key"))
		assert isinstance(valid, APIKeyResult)
		assert valid.success is False


# ============================================================================
# DataEncryption
# ============================================================================

class TestDataEncryption:
	"""Happy and failure paths for DataEncryption."""

	async def _test_encrypt_and_decrypt_async(self):
		"""Happy path: encrypt plaintext and decrypt back."""
		enc = DataEncryption(EncryptionConfiguration())
		await asyncio.sleep(0.1)

		key_id = await enc.create_encryption_key(
			key_type=KeyType.DATA,
			purpose="test",
			created_by="tester",
			algorithm=EncryptionAlgorithm.AES_256_GCM,
		)
		assert isinstance(key_id, str)

		cipher = await enc.encrypt_data("hello world", key_id=key_id)
		assert isinstance(cipher, EncryptionResult)
		assert cipher.success is True
		assert cipher.encrypted_data is not None
		assert cipher.nonce is not None
		assert cipher.tag is not None

		plain = await enc.decrypt_data(
			cipher.encrypted_data,
			key_id=key_id,
			nonce=cipher.nonce,
			tag=cipher.tag,
		)
		assert isinstance(plain, DecryptionResult)
		assert plain.success is True
		assert plain.decrypted_data == "hello world"

	def test_encrypt_and_decrypt(self):
		asyncio.run(self._test_encrypt_and_decrypt_async())

	async def _test_decrypt_with_wrong_key_async(self):
		"""Failure path: decrypt with a non-existent key."""
		enc = DataEncryption(EncryptionConfiguration())
		await asyncio.sleep(0.1)

		result = await enc.decrypt_data("garbage", key_id="no-such-key", nonce="nonce", tag="tag")
		assert isinstance(result, DecryptionResult)
		assert result.success is False

	def test_decrypt_with_wrong_key(self):
		asyncio.run(self._test_decrypt_with_wrong_key_async())


# ============================================================================
# DLPSystem
# ============================================================================

class TestDLPSystem:
	"""Happy and failure paths for DLPSystem."""

	async def _test_scan_clean_content_async(self):
		"""Happy path: scan content with no sensitive data."""
		dlp = DLPSystem(DLPConfiguration())
		result = await dlp.scan_content("Hello world", content_type=ContentType.TEXT)
		assert isinstance(result, ScanResult)
		assert result.patterns_found == []
		assert result.overall_confidence == 0.0

	def test_scan_clean_content(self):
		asyncio.run(self._test_scan_clean_content_async())

	async def _test_scan_with_empty_content_async(self):
		"""Failure path: scan empty content."""
		dlp = DLPSystem(DLPConfiguration())
		result = await dlp.scan_content("", content_type=ContentType.TEXT)
		assert isinstance(result, ScanResult)
		assert result.content_size == 0

	def test_scan_with_empty_content(self):
		asyncio.run(self._test_scan_with_empty_content_async())


# ============================================================================
# SecurityManager
# ============================================================================

class TestSecurityManager:
	"""Happy and failure paths for SecurityManager."""

	async def test_initialization(self):
		"""Happy path: SecurityManager initializes all sub-components."""
		mgr = SecurityManager()
		assert mgr.user_auth is not None
		assert mgr.encryption is not None

	async def test_authenticate_through_manager(self):
		"""Happy path: authenticate via SecurityManager delegation."""
		mgr = SecurityManager()
		await mgr.user_auth.create_user("mgruser", "SecureP@ss123", "mgr@example.com")
		result = await mgr.user_auth.authenticate(
			UserCredentials(username="mgruser", password="SecureP@ss123")
		)
		assert result.status == AuthenticationStatus.SUCCESS


# ============================================================================
# ABACAuthorization
# ============================================================================

class TestABACAuthorization:
	"""Happy and failure paths for ABACAuthorization."""

	def test_evaluate_permit_policy(self):
		"""Happy path: policy that permits access."""
		abac = ABACAuthorization(ABACConfiguration())
		policy = ABACPolicy(
			name="allow-test",
			rules=[
				PolicyRule(
					name="allow-admin",
					effect=PolicyEffect.PERMIT,
					conditions=[
						AttributeCondition(
							attribute_type=AttributeType.SUBJECT,
							attribute_name="role",
							operator=ComparisonOperator.EQUALS,
							value="admin",
						)
					],
				)
			],
		)
		abac.add_policy(policy)
		result = asyncio.run(
			abac.evaluate_access(
				subject_attributes={"role": "admin"},
				resource_attributes={"type": "document"},
				action_attributes={"action": "read"},
			)
		)
		assert isinstance(result, ABACDecision)
		assert result.decision == PolicyEffect.PERMIT

	def test_evaluate_deny_policy(self):
		"""Failure path: policy that denies access."""
		abac = ABACAuthorization(ABACConfiguration())
		policy = ABACPolicy(
			name="deny-test",
			rules=[
				PolicyRule(
					name="deny-guest",
					effect=PolicyEffect.DENY,
					conditions=[
						AttributeCondition(
							attribute_type=AttributeType.SUBJECT,
							attribute_name="role",
							operator=ComparisonOperator.EQUALS,
							value="guest",
						)
					],
				)
			],
		)
		abac.add_policy(policy)
		result = asyncio.run(
			abac.evaluate_access(
				subject_attributes={"role": "guest"},
				resource_attributes={"type": "document"},
				action_attributes={"action": "read"},
			)
		)
		assert isinstance(result, ABACDecision)
		assert result.decision == PolicyEffect.DENY


# ============================================================================
# DocumentPermissions
# ============================================================================

class TestDocumentPermissions:
	"""Happy and failure paths for DocumentPermissions."""

	def test_grant_and_check_permission(self):
		"""Happy path: grant read permission and verify it."""
		perms = DocumentPermissions(DocumentPermissionsConfig())
		asyncio.run(
			perms.grant_document_access(
				document_id="doc-1",
				granted_by="admin",
				permission_level=PermissionLevel.VIEW,
				user_id="user-1",
			)
		)
		result = asyncio.run(
			perms.check_document_permission(
				document_id="doc-1",
				user_id="user-1",
				requested_permission=PermissionLevel.VIEW,
			)
		)
		assert result["has_permission"] is True

	def test_check_missing_permission(self):
		"""Failure path: check permission that was never granted."""
		perms = DocumentPermissions(DocumentPermissionsConfig())
		result = asyncio.run(
			perms.check_document_permission(
				document_id="doc-2",
				user_id="user-2",
				requested_permission=PermissionLevel.EDIT,
			)
		)
		assert result["has_permission"] is False


# ============================================================================
# AuditLogger
# ============================================================================

from docfusion.security.audit.audit_logger import (
	AuditLogger,
	AuditConfiguration,
	AuditEventType,
	AuditSeverity,
)


class TestAuditLogger:
	"""Happy and failure paths for AuditLogger."""

	async def _test_log_and_query_async(self):
		"""Happy path: log an event and query it back."""
		audit = AuditLogger(AuditConfiguration())
		event_id = await audit.log_event(
			event_type=AuditEventType.LOGIN_SUCCESS,
			action="login",
			description="User logged in",
			user_id="audit-user-1",
		)
		assert isinstance(event_id, str)
		assert event_id != ""

		events = await audit.query_events(user_id="audit-user-1")
		assert len(events) >= 1

	def test_log_and_query(self):
		asyncio.run(self._test_log_and_query_async())

	async def _test_log_below_minimum_severity_async(self):
		"""Failure path: event below minimum severity is not logged."""
		config = AuditConfiguration(minimum_severity=AuditSeverity.CRITICAL)
		audit = AuditLogger(config)
		await audit.log_event(
			event_type=AuditEventType.LOGIN_SUCCESS,
			action="login",
			description="Low severity login",
			user_id="audit-user-2",
			severity=AuditSeverity.LOW,
		)
		events = await audit.query_events(user_id="audit-user-2")
		assert len(events) == 0

	def test_log_below_minimum_severity(self):
		asyncio.run(self._test_log_below_minimum_severity_async())


# ============================================================================
# GDPRCompliance
# ============================================================================

from docfusion.security.compliance.gdpr_compliance import GDPRCompliance, GDPRConfiguration


class TestGDPRCompliance:
	"""Happy and failure paths for GDPRCompliance."""

	async def _test_export_user_data_async(self):
		"""Happy path: export user data."""
		gdpr = GDPRCompliance(GDPRConfiguration())
		result = await gdpr.export_user_data("gdpr-user-1")
		assert result.user_id == "gdpr-user-1"
		assert result.export_type == "full"

	def test_export_user_data(self):
		asyncio.run(self._test_export_user_data_async())

	async def _test_delete_nonexistent_user_async(self):
		"""Failure path: delete data for user with no registered sources."""
		gdpr = GDPRCompliance(GDPRConfiguration())
		result = await gdpr.delete_user_data("nonexistent-user")
		assert result.deleted_from_sources == []

	def test_delete_nonexistent_user(self):
		asyncio.run(self._test_delete_nonexistent_user_async())
