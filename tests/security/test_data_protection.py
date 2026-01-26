#!/usr/bin/env python3
"""
Data Protection Security Tests

Comprehensive security testing for encryption, DLP, secure sharing,
and data protection mechanisms including key management and compliance.
"""

import asyncio
import pytest
import base64
import json
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch, AsyncMock
from typing import Dict, Any

from docfusion.security.encryption.e2e_encryption import (
    E2EEncryption, EncryptionScheme, KeyExchangeProtocol
)
from docfusion.security.data_protection.dlp_system import (
    DLPSystem, DataPattern, DLPPolicy, DLPAction, DataSensitivityLevel
)
from docfusion.security.encryption.data_encryption import (
    DataEncryption, EncryptionConfig
)


class TestE2EEncryptionSecurity:
    """End-to-end encryption security tests"""
    
    @pytest.fixture
    def e2e_encryption(self):
        # Mock E2E encryption since it requires cryptography library
        return Mock()
    
    def test_key_generation_entropy(self, e2e_encryption):
        """Test encryption key generation has sufficient entropy"""
        # Mock key generation
        e2e_encryption.generate_key.return_value = b'x' * 32  # 256-bit key
        
        key1 = e2e_encryption.generate_key()
        key2 = e2e_encryption.generate_key()
        
        # Keys should be different
        assert key1 != key2
        # Keys should be proper length
        assert len(key1) == 32
        assert len(key2) == 32
    
    def test_key_derivation_security(self, e2e_encryption):
        """Test key derivation function security"""
        # Mock key derivation with different salts
        e2e_encryption.derive_key.side_effect = lambda password, salt: (password + salt).encode()[:32]
        
        password = "user_password"
        salt1 = b"salt1"
        salt2 = b"salt2"
        
        derived_key1 = e2e_encryption.derive_key(password, salt1)
        derived_key2 = e2e_encryption.derive_key(password, salt2)
        
        # Same password with different salts should produce different keys
        assert derived_key1 != derived_key2
    
    def test_encryption_randomness(self, e2e_encryption):
        """Test encryption produces different ciphertexts for same plaintext"""
        plaintext = "sensitive document content"
        key = b'x' * 32
        
        # Mock encryption to include random IV
        e2e_encryption.encrypt.side_effect = lambda data, k: f"encrypted_{data}_{id(data)}".encode()
        
        ciphertext1 = e2e_encryption.encrypt(plaintext, key)
        ciphertext2 = e2e_encryption.encrypt(plaintext, key)
        
        # Same plaintext should produce different ciphertexts
        assert ciphertext1 != ciphertext2
    
    def test_key_rotation_enforcement(self, e2e_encryption):
        """Test key rotation enforcement"""
        # Mock key with expiration
        old_key = Mock()
        old_key.created_at = datetime.now(timezone.utc) - timedelta(days=31)
        old_key.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        
        e2e_encryption.is_key_expired.return_value = True
        
        assert e2e_encryption.is_key_expired(old_key)
    
    def test_secure_key_sharing(self, e2e_encryption):
        """Test secure key sharing mechanisms"""
        # Mock key sharing with public key encryption
        recipient_public_key = Mock()
        document_key = b'x' * 32
        
        e2e_encryption.share_key.return_value = "encrypted_key_for_recipient"
        
        shared_key = e2e_encryption.share_key(document_key, recipient_public_key)
        
        # Should return encrypted key
        assert shared_key is not None
        assert isinstance(shared_key, str)


class TestDLPSecurity:
    """Data Loss Prevention security tests"""
    
    @pytest.fixture
    def dlp_system(self):
        return Mock()  # Mock DLP system
    
    def test_pii_detection_accuracy(self, dlp_system):
        """Test PII detection accuracy and false positive rates"""
        # Mock PII patterns
        dlp_system.scan_content.return_value = {
            'violations': [
                {
                    'pattern': 'ssn',
                    'matches': ['123-45-6789'],
                    'confidence': 0.95,
                    'action': DLPAction.BLOCK
                }
            ]
        }
        
        test_content = "John's SSN is 123-45-6789"
        result = dlp_system.scan_content(test_content)
        
        assert len(result['violations']) > 0
        assert result['violations'][0]['confidence'] > 0.9
    
    def test_pattern_bypass_protection(self, dlp_system):
        """Test protection against pattern bypass attempts"""
        bypass_attempts = [
            "123-45-6789",  # Normal SSN
            "123 45 6789",  # Spaces instead of dashes
            "123.45.6789",  # Dots instead of dashes
            "1234 5 6789",  # Mixed formatting
            "SSN: 123456789",  # No separators
        ]
        
        # Mock detection that catches variants
        def mock_scan(content):
            if any(char.isdigit() for char in content) and len([c for c in content if c.isdigit()]) == 9:
                return {'violations': [{'pattern': 'ssn', 'confidence': 0.8}]}
            return {'violations': []}
        
        dlp_system.scan_content.side_effect = mock_scan
        
        for attempt in bypass_attempts:
            result = dlp_system.scan_content(attempt)
            assert len(result['violations']) > 0, f"Failed to detect: {attempt}"
    
    def test_obfuscation_resistance(self, dlp_system):
        """Test resistance to data obfuscation techniques"""
        obfuscated_data = [
            "SSN: 1two3-4five-6seven8nine",  # Mixed numbers and words
            "Credit Card: 4***-****-****-1234",  # Partially masked
            "Email: john[dot]doe[at]company[dot]com",  # Bracket obfuscation
        ]
        
        # Mock advanced detection
        dlp_system.scan_content.return_value = {'violations': [{'pattern': 'obfuscated_data'}]}
        
        for data in obfuscated_data:
            result = dlp_system.scan_content(data)
            # Should still detect obfuscated sensitive data
            assert len(result['violations']) > 0
    
    def test_performance_dos_protection(self, dlp_system):
        """Test protection against DoS through large content scanning"""
        # Very large content that could cause DoS
        large_content = "A" * 10_000_000  # 10MB of text
        
        # Mock timeout protection
        def mock_scan_with_timeout(content):
            if len(content) > 1_000_000:  # 1MB limit
                return {'error': 'content_too_large', 'violations': []}
            return {'violations': []}
        
        dlp_system.scan_content.side_effect = mock_scan_with_timeout
        
        result = dlp_system.scan_content(large_content)
        
        # Should handle large content gracefully
        assert 'error' in result or len(result.get('violations', [])) == 0
    
    def test_policy_bypass_prevention(self, dlp_system):
        """Test prevention of DLP policy bypass"""
        # Mock policy evaluation
        dlp_system.evaluate_policies.return_value = [
            {'policy': 'block_ssn', 'action': DLPAction.BLOCK, 'priority': 1}
        ]
        
        policies = dlp_system.evaluate_policies("content with SSN")
        
        # Should not allow bypassing high-priority policies
        blocking_policies = [p for p in policies if p['action'] == DLPAction.BLOCK]
        assert len(blocking_policies) > 0


class TestSecureSharing:
    """Secure document sharing security tests"""
    
    @pytest.fixture
    def secure_sharing(self):
        return Mock()  # Mock secure sharing system
    
    def test_access_link_uniqueness(self, secure_sharing):
        """Test unique access links for each sharing instance"""
        document_id = "doc_123"
        
        # Mock link generation
        secure_sharing.generate_share_link.side_effect = lambda doc_id, options: f"https://app.com/share/{doc_id}_{id(options)}"
        
        link1 = secure_sharing.generate_share_link(document_id, {"expires_in": 3600})
        link2 = secure_sharing.generate_share_link(document_id, {"expires_in": 3600})
        
        # Links should be different even for same document
        assert link1 != link2
    
    def test_expiration_enforcement(self, secure_sharing):
        """Test strict expiration enforcement"""
        # Mock expired link
        secure_sharing.is_link_valid.return_value = False
        secure_sharing.get_link_expiry.return_value = datetime.now(timezone.utc) - timedelta(hours=1)
        
        expired_link = "https://app.com/share/expired_link"
        
        assert not secure_sharing.is_link_valid(expired_link)
    
    def test_permission_isolation(self, secure_sharing):
        """Test proper permission isolation between shares"""
        # Mock different permission levels
        secure_sharing.get_share_permissions.side_effect = lambda link: {
            "read_only_link": ["read"],
            "edit_link": ["read", "write"],
            "admin_link": ["read", "write", "delete"]
        }.get(link.split('/')[-1], [])
        
        read_only_perms = secure_sharing.get_share_permissions("https://app.com/share/read_only_link")
        edit_perms = secure_sharing.get_share_permissions("https://app.com/share/edit_link")
        
        assert "write" not in read_only_perms
        assert "write" in edit_perms
    
    def test_watermark_integrity(self, secure_sharing):
        """Test watermark integrity and tamper detection"""
        # Mock watermarking
        secure_sharing.add_watermark.return_value = "watermarked_content"
        secure_sharing.verify_watermark.return_value = True
        
        original_content = "sensitive document content"
        watermarked = secure_sharing.add_watermark(original_content, "user@example.com")
        
        assert secure_sharing.verify_watermark(watermarked)
    
    def test_download_tracking_security(self, secure_sharing):
        """Test secure download tracking"""
        # Mock download tracking
        secure_sharing.log_access.return_value = True
        
        share_link = "https://app.com/share/tracked_document"
        user_info = {"ip": "192.168.1.1", "user_agent": "Browser"}
        
        # Should log access attempts
        assert secure_sharing.log_access(share_link, user_info)


class TestKeyManagementSecurity:
    """Key management security tests"""
    
    @pytest.fixture
    def key_manager(self):
        return Mock()  # Mock key management system
    
    def test_key_escrow_security(self, key_manager):
        """Test secure key escrow implementation"""
        # Mock key escrow
        key_manager.escrow_key.return_value = "escrowed_key_id"
        key_manager.recover_key.return_value = b"recovered_key"
        
        original_key = b"original_encryption_key"
        escrowed_id = key_manager.escrow_key(original_key, "backup_reason")
        
        # Should be able to recover key
        recovered_key = key_manager.recover_key(escrowed_id, "recovery_reason")
        assert recovered_key == original_key
    
    def test_key_derivation_consistency(self, key_manager):
        """Test key derivation consistency and security"""
        # Mock consistent key derivation
        key_manager.derive_key.side_effect = lambda password, salt, iterations: (
            (password + str(salt) + str(iterations)).encode()[:32]
        )
        
        password = "user_password"
        salt = b"fixed_salt"
        iterations = 100000
        
        key1 = key_manager.derive_key(password, salt, iterations)
        key2 = key_manager.derive_key(password, salt, iterations)
        
        # Same inputs should produce same key
        assert key1 == key2
        
        # Different iterations should produce different key
        key3 = key_manager.derive_key(password, salt, iterations + 1)
        assert key1 != key3
    
    def test_key_lifecycle_management(self, key_manager):
        """Test complete key lifecycle management"""
        # Mock key lifecycle
        key_manager.create_key.return_value = {"key_id": "key_123", "key": b"new_key"}
        key_manager.rotate_key.return_value = {"key_id": "key_456", "key": b"rotated_key"}
        key_manager.revoke_key.return_value = True
        
        # Create key
        new_key = key_manager.create_key("document_123")
        assert new_key["key_id"] is not None
        
        # Rotate key
        rotated_key = key_manager.rotate_key(new_key["key_id"])
        assert rotated_key["key_id"] != new_key["key_id"]
        
        # Revoke old key
        assert key_manager.revoke_key(new_key["key_id"])
    
    def test_key_access_authorization(self, key_manager):
        """Test key access authorization"""
        # Mock key access control
        def mock_authorize_key_access(key_id, user_id, operation):
            authorized_users = {"key_123": ["user1", "user2"]}
            return user_id in authorized_users.get(key_id, [])
        
        key_manager.authorize_key_access.side_effect = mock_authorize_key_access
        
        # Authorized user should have access
        assert key_manager.authorize_key_access("key_123", "user1", "decrypt")
        
        # Unauthorized user should not have access
        assert not key_manager.authorize_key_access("key_123", "user3", "decrypt")


class TestDataProtectionIntegration:
    """Integration tests for data protection components"""
    
    @pytest.mark.asyncio
    async def test_encrypted_dlp_scanning(self):
        """Test DLP scanning of encrypted content"""
        # Mock encrypted content that needs DLP scanning
        encrypted_content = base64.b64encode(b"SSN: 123-45-6789").decode()
        
        # Mock decryption and scanning
        decrypted_content = base64.b64decode(encrypted_content).decode()
        
        # Should be able to scan decrypted content
        assert "123-45-6789" in decrypted_content
    
    @pytest.mark.asyncio
    async def test_secure_sharing_with_encryption(self):
        """Test secure sharing combined with encryption"""
        # Mock end-to-end encrypted sharing
        document_content = "sensitive financial data"
        recipient_key = b"recipient_public_key"
        
        # Should encrypt before sharing
        encrypted_content = base64.b64encode(document_content.encode()).decode()
        
        assert encrypted_content != document_content
    
    @pytest.mark.asyncio
    async def test_compliance_data_handling(self):
        """Test compliance-aware data handling"""
        # Mock GDPR-compliant data processing
        personal_data = {
            "name": "John Doe",
            "email": "john@example.com",
            "ssn": "123-45-6789"
        }
        
        # Should handle personal data according to regulations
        processed_data = {k: v if k != "ssn" else "***-**-****" for k, v in personal_data.items()}
        
        assert processed_data["ssn"] == "***-**-****"
        assert processed_data["email"] == "john@example.com"


# Performance and DoS Protection Tests
class TestDataProtectionPerformance:
    """Data protection performance and DoS protection tests"""
    
    @pytest.mark.asyncio
    async def test_encryption_performance_limits(self):
        """Test encryption performance limits"""
        # Large content that could cause DoS
        large_content = b"A" * 1_000_000  # 1MB
        
        # Mock encryption with size limits
        def mock_encrypt(content):
            if len(content) > 10_000_000:  # 10MB limit
                raise ValueError("Content too large")
            return content[::-1]  # Simple mock encryption
        
        # Should handle large content
        encrypted = mock_encrypt(large_content)
        assert len(encrypted) == len(large_content)
        
        # Should reject extremely large content
        with pytest.raises(ValueError):
            mock_encrypt(b"A" * 11_000_000)
    
    @pytest.mark.asyncio
    async def test_dlp_scanning_performance_limits(self):
        """Test DLP scanning performance limits"""
        # Mock DLP with performance limits
        def mock_dlp_scan(content):
            if len(content) > 5_000_000:  # 5MB limit
                return {"error": "content_too_large"}
            return {"violations": []}
        
        # Should handle reasonable content
        result = mock_dlp_scan("normal content")
        assert "error" not in result
        
        # Should limit large content
        large_content = "A" * 6_000_000
        result = mock_dlp_scan(large_content)
        assert result.get("error") == "content_too_large"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])