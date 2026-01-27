#!/usr/bin/env python3
"""
Data Encryption Module

Provides AES-256 encryption for sensitive data with secure key management,
key rotation, field-level encryption, and key derivation functions.
"""

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

# Cryptographic libraries
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

try:
    from uuid_extensions import uuid7str
except ImportError:
    from uuid import uuid4

    def uuid7str() -> str:
        return str(uuid4())


from pydantic import BaseModel, ConfigDict, Field


class EncryptionAlgorithm(Enum):
    """Supported encryption algorithms"""

    AES_256_GCM = "aes-256-gcm"
    AES_256_CBC = "aes-256-cbc"
    RSA_2048 = "rsa-2048"
    RSA_4096 = "rsa-4096"


class KeyType(Enum):
    """Encryption key types"""

    MASTER = "master"
    DATA = "data"
    FIELD = "field"
    SESSION = "session"
    BACKUP = "backup"


class EncryptionResult(BaseModel):
    """Result of encryption operation"""

    model_config = ConfigDict(extra="forbid", validate_by_name=True)

    success: bool
    encrypted_data: Optional[str] = None  # Base64 encoded
    key_id: Optional[str] = None
    algorithm: Optional[str] = None
    nonce: Optional[str] = None  # Base64 encoded
    tag: Optional[str] = None  # Base64 encoded (for GCM mode)
    error_message: Optional[str] = None

    # Metadata
    encrypted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data_size: Optional[int] = None


class DecryptionResult(BaseModel):
    """Result of decryption operation"""

    model_config = ConfigDict(extra="forbid", validate_by_name=True)

    success: bool
    decrypted_data: Optional[str] = None
    key_id: Optional[str] = None
    algorithm: Optional[str] = None
    error_message: Optional[str] = None

    # Metadata
    decrypted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data_size: Optional[int] = None


class EncryptionKey(BaseModel):
    """Encryption key model"""

    model_config = ConfigDict(extra="forbid", validate_by_name=True)

    key_id: str = Field(default_factory=uuid7str)
    key_type: KeyType
    algorithm: EncryptionAlgorithm

    # Key material (encrypted with master key)
    encrypted_key: str  # Base64 encoded
    key_hash: str  # For verification

    # Key metadata
    purpose: str
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None

    # Key rotation
    previous_key_id: Optional[str] = None
    next_key_id: Optional[str] = None
    rotation_scheduled_at: Optional[datetime] = None

    # Usage tracking
    usage_count: int = 0
    last_used_at: Optional[datetime] = None
    max_usage_count: Optional[int] = None

    # Status
    is_active: bool = True
    revoked_at: Optional[datetime] = None
    revoked_by: Optional[str] = None


@dataclass
class EncryptionConfiguration:
    """Configuration for encryption system"""

    # Default encryption settings
    default_algorithm: EncryptionAlgorithm = EncryptionAlgorithm.AES_256_GCM
    key_size_bits: int = 256

    # Key derivation settings
    pbkdf2_iterations: int = 100000
    hkdf_info: bytes = b"ProposalWriter-KDF"

    # Key rotation settings
    auto_rotate_keys: bool = True
    key_rotation_days: int = 90
    max_key_usage_count: int = 1000000

    # Master key settings
    master_key_file: Optional[str] = None
    master_key_env_var: str = "MASTER_ENCRYPTION_KEY"
    backup_master_keys: int = 3

    # Security settings
    require_key_authentication: bool = True
    log_all_operations: bool = True
    verify_integrity: bool = True

    # Performance settings
    enable_key_cache: bool = True
    key_cache_ttl_seconds: int = 300
    max_concurrent_operations: int = 100


class DataEncryption:
    """Comprehensive data encryption system with key management"""

    def __init__(self, config: Optional[EncryptionConfiguration] = None):
        """Initialize encryption system with configuration"""
        self.config = config or EncryptionConfiguration()
        self.logger = logging.getLogger(__name__)

        # Storage (replace with secure database/HSM in production)
        self.encryption_keys: Dict[str, EncryptionKey] = {}
        self.key_cache: Dict[str, bytes] = {}
        self.cache_timestamps: Dict[str, datetime] = {}

        # Master key management
        self.master_key: Optional[bytes] = None
        self.backup_master_keys: List[bytes] = []

        # Concurrency control
        self.semaphore = asyncio.Semaphore(self.config.max_concurrent_operations)

        # Initialize master key
        asyncio.create_task(self._initialize_master_key())

        self.logger.info("Data encryption system initialized")

    async def create_encryption_key(
        self,
        key_type: KeyType,
        purpose: str,
        created_by: str,
        algorithm: Optional[EncryptionAlgorithm] = None,
        expires_in_days: Optional[int] = None,
        max_usage_count: Optional[int] = None,
    ) -> str:
        """Create a new encryption key"""
        if not self.master_key:
            raise ValueError("Master key not initialized")

        algorithm = algorithm or self.config.default_algorithm

        # Generate key material
        if algorithm in [
            EncryptionAlgorithm.AES_256_GCM,
            EncryptionAlgorithm.AES_256_CBC,
        ]:
            key_material = secrets.token_bytes(32)  # 256 bits
        else:
            raise ValueError(f"Unsupported algorithm for key generation: {algorithm}")

        # Encrypt key material with master key
        encrypted_key = await self._encrypt_key_material(key_material)
        key_hash = hashlib.sha256(key_material).hexdigest()

        # Set expiration
        expires_at = None
        if expires_in_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
        elif self.config.auto_rotate_keys:
            expires_at = datetime.now(timezone.utc) + timedelta(
                days=self.config.key_rotation_days
            )

        # Create key record
        encryption_key = EncryptionKey(
            key_type=key_type,
            algorithm=algorithm,
            encrypted_key=encrypted_key,
            key_hash=key_hash,
            purpose=purpose,
            created_by=created_by,
            expires_at=expires_at,
            max_usage_count=max_usage_count or self.config.max_key_usage_count,
        )

        # Schedule rotation if enabled
        if self.config.auto_rotate_keys and expires_at:
            encryption_key.rotation_scheduled_at = expires_at - timedelta(
                days=7
            )  # Rotate 1 week before expiry

        self.encryption_keys[encryption_key.key_id] = encryption_key

        self.logger.info(
            f"Created encryption key: {encryption_key.key_id} for {purpose}"
        )
        return encryption_key.key_id

    async def encrypt_data(
        self,
        data: Union[str, bytes],
        key_id: str,
        additional_data: Optional[bytes] = None,
    ) -> EncryptionResult:
        """Encrypt data using specified key"""
        async with self.semaphore:
            try:
                # Get encryption key
                encryption_key = self.encryption_keys.get(key_id)
                if not encryption_key:
                    return EncryptionResult(
                        success=False, error_message="Encryption key not found"
                    )

                if not encryption_key.is_active:
                    return EncryptionResult(
                        success=False, error_message="Encryption key is not active"
                    )

                # Check key expiration
                if (
                    encryption_key.expires_at
                    and datetime.now(timezone.utc) > encryption_key.expires_at
                ):
                    return EncryptionResult(
                        success=False, error_message="Encryption key has expired"
                    )

                # Check usage limit
                if (
                    encryption_key.max_usage_count
                    and encryption_key.usage_count >= encryption_key.max_usage_count
                ):
                    return EncryptionResult(
                        success=False,
                        error_message="Encryption key usage limit exceeded",
                    )

                # Get key material
                key_material = await self._get_key_material(key_id)
                if not key_material:
                    return EncryptionResult(
                        success=False, error_message="Failed to retrieve key material"
                    )

                # Convert data to bytes
                if isinstance(data, str):
                    data_bytes = data.encode("utf-8")
                else:
                    data_bytes = data

                # Encrypt based on algorithm
                if encryption_key.algorithm == EncryptionAlgorithm.AES_256_GCM:
                    encrypted_data, nonce, tag = await self._encrypt_aes_gcm(
                        data_bytes, key_material, additional_data
                    )
                elif encryption_key.algorithm == EncryptionAlgorithm.AES_256_CBC:
                    encrypted_data, nonce = await self._encrypt_aes_cbc(
                        data_bytes, key_material
                    )
                    tag = None
                else:
                    return EncryptionResult(
                        success=False,
                        error_message=f"Unsupported encryption algorithm: {encryption_key.algorithm}",
                    )

                # Update key usage
                encryption_key.usage_count += 1
                encryption_key.last_used_at = datetime.now(timezone.utc)

                # Log operation
                if self.config.log_all_operations:
                    self.logger.info(f"Encrypted data with key {key_id}")

                return EncryptionResult(
                    success=True,
                    encrypted_data=base64.b64encode(encrypted_data).decode("utf-8"),
                    key_id=key_id,
                    algorithm=encryption_key.algorithm.value,
                    nonce=base64.b64encode(nonce).decode("utf-8"),
                    tag=base64.b64encode(tag).decode("utf-8") if tag else None,
                    data_size=len(data_bytes),
                )

            except Exception as e:
                self.logger.error(f"Encryption failed: {e}")
                return EncryptionResult(
                    success=False, error_message=f"Encryption failed: {e}"
                )

    async def decrypt_data(
        self,
        encrypted_data: str,
        key_id: str,
        nonce: str,
        tag: Optional[str] = None,
        additional_data: Optional[bytes] = None,
    ) -> DecryptionResult:
        """Decrypt data using specified key"""
        async with self.semaphore:
            try:
                # Get encryption key
                encryption_key = self.encryption_keys.get(key_id)
                if not encryption_key:
                    return DecryptionResult(
                        success=False, error_message="Encryption key not found"
                    )

                # Get key material
                key_material = await self._get_key_material(key_id)
                if not key_material:
                    return DecryptionResult(
                        success=False, error_message="Failed to retrieve key material"
                    )

                # Decode base64 data
                try:
                    data_bytes = base64.b64decode(encrypted_data)
                    nonce_bytes = base64.b64decode(nonce)
                    tag_bytes = base64.b64decode(tag) if tag else None
                except Exception as e:
                    return DecryptionResult(
                        success=False, error_message=f"Invalid base64 encoding: {e}"
                    )

                # Decrypt based on algorithm
                if encryption_key.algorithm == EncryptionAlgorithm.AES_256_GCM:
                    decrypted_data = await self._decrypt_aes_gcm(
                        data_bytes,
                        key_material,
                        nonce_bytes,
                        tag_bytes,
                        additional_data,
                    )
                elif encryption_key.algorithm == EncryptionAlgorithm.AES_256_CBC:
                    decrypted_data = await self._decrypt_aes_cbc(
                        data_bytes, key_material, nonce_bytes
                    )
                else:
                    return DecryptionResult(
                        success=False,
                        error_message=f"Unsupported decryption algorithm: {encryption_key.algorithm}",
                    )

                # Update key usage
                encryption_key.usage_count += 1
                encryption_key.last_used_at = datetime.now(timezone.utc)

                # Log operation
                if self.config.log_all_operations:
                    self.logger.info(f"Decrypted data with key {key_id}")

                return DecryptionResult(
                    success=True,
                    decrypted_data=decrypted_data.decode("utf-8"),
                    key_id=key_id,
                    algorithm=encryption_key.algorithm.value,
                    data_size=len(decrypted_data),
                )

            except Exception as e:
                self.logger.error(f"Decryption failed: {e}")
                return DecryptionResult(
                    success=False, error_message=f"Decryption failed: {e}"
                )

    async def encrypt_field(
        self,
        field_name: str,
        field_value: str,
        record_id: str,
        key_id: Optional[str] = None,
    ) -> EncryptionResult:
        """Encrypt a specific field with field-level encryption"""
        # Create field-specific key if not provided
        if not key_id:
            key_id = await self.create_encryption_key(
                key_type=KeyType.FIELD,
                purpose=f"field_encryption_{field_name}",
                created_by="system",
            )

        # Create additional authenticated data for field context
        additional_data = json.dumps(
            {
                "field_name": field_name,
                "record_id": record_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ).encode("utf-8")

        return await self.encrypt_data(field_value, key_id, additional_data)

    async def decrypt_field(
        self,
        field_name: str,
        encrypted_data: str,
        record_id: str,
        key_id: str,
        nonce: str,
        tag: Optional[str] = None,
    ) -> DecryptionResult:
        """Decrypt a specific field with field-level encryption"""
        # Recreate additional authenticated data for field context
        additional_data = json.dumps(
            {
                "field_name": field_name,
                "record_id": record_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ).encode("utf-8")

        return await self.decrypt_data(
            encrypted_data, key_id, nonce, tag, additional_data
        )

    async def rotate_key(self, key_id: str, rotated_by: str) -> str:
        """Rotate encryption key"""
        old_key = self.encryption_keys.get(key_id)
        if not old_key:
            raise ValueError("Key not found for rotation")

        # Create new key
        new_key_id = await self.create_encryption_key(
            key_type=old_key.key_type,
            purpose=old_key.purpose,
            created_by=rotated_by,
            algorithm=old_key.algorithm,
            expires_in_days=self.config.key_rotation_days
            if self.config.auto_rotate_keys
            else None,
        )

        # Update key relationships
        old_key.next_key_id = new_key_id
        new_key = self.encryption_keys[new_key_id]
        new_key.previous_key_id = key_id

        # Deactivate old key
        old_key.is_active = False
        old_key.revoked_at = datetime.now(timezone.utc)
        old_key.revoked_by = rotated_by

        # Clear cache
        self._invalidate_key_cache(key_id)

        self.logger.info(f"Rotated key {key_id} -> {new_key_id}")
        return new_key_id

    async def derive_key(
        self, master_password: str, salt: bytes, info: str, key_length: int = 32
    ) -> bytes:
        """Derive encryption key using PBKDF2 + HKDF"""
        # PBKDF2 for password-based key derivation
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=self.config.pbkdf2_iterations,
            backend=default_backend(),
        )

        intermediate_key = kdf.derive(master_password.encode("utf-8"))

        # HKDF for key expansion
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=key_length,
            salt=salt,
            info=info.encode("utf-8"),
            backend=default_backend(),
        )

        return hkdf.derive(intermediate_key)

    async def get_key_info(self, key_id: str) -> Optional[Dict[str, Any]]:
        """Get information about encryption key (without sensitive data)"""
        encryption_key = self.encryption_keys.get(key_id)
        if not encryption_key:
            return None

        return {
            "key_id": encryption_key.key_id,
            "key_type": encryption_key.key_type.value,
            "algorithm": encryption_key.algorithm.value,
            "purpose": encryption_key.purpose,
            "created_by": encryption_key.created_by,
            "created_at": encryption_key.created_at,
            "expires_at": encryption_key.expires_at,
            "usage_count": encryption_key.usage_count,
            "max_usage_count": encryption_key.max_usage_count,
            "last_used_at": encryption_key.last_used_at,
            "is_active": encryption_key.is_active,
            "rotation_scheduled_at": encryption_key.rotation_scheduled_at,
            "previous_key_id": encryption_key.previous_key_id,
            "next_key_id": encryption_key.next_key_id,
        }

    async def list_keys(
        self, key_type: Optional[KeyType] = None, active_only: bool = True
    ) -> List[Dict[str, Any]]:
        """List encryption keys"""
        keys = []

        for encryption_key in self.encryption_keys.values():
            if key_type and encryption_key.key_type != key_type:
                continue

            if active_only and not encryption_key.is_active:
                continue

            key_info = await self.get_key_info(encryption_key.key_id)
            if key_info:
                keys.append(key_info)

        return sorted(keys, key=lambda x: x["created_at"], reverse=True)

    async def cleanup_expired_keys(self) -> int:
        """Clean up expired and over-used keys"""
        cleaned_count = 0
        now = datetime.now(timezone.utc)

        for key_id, encryption_key in list(self.encryption_keys.items()):
            should_cleanup = False

            # Check expiration
            if encryption_key.expires_at and now > encryption_key.expires_at:
                should_cleanup = True

            # Check usage limit
            if (
                encryption_key.max_usage_count
                and encryption_key.usage_count >= encryption_key.max_usage_count
            ):
                should_cleanup = True

            if should_cleanup and encryption_key.is_active:
                encryption_key.is_active = False
                encryption_key.revoked_at = now
                encryption_key.revoked_by = "system_cleanup"
                self._invalidate_key_cache(key_id)
                cleaned_count += 1

        if cleaned_count > 0:
            self.logger.info(f"Cleaned up {cleaned_count} expired/overused keys")

        return cleaned_count

    async def _initialize_master_key(self):
        """Initialize master encryption key"""
        import os

        # Try to load from environment variable
        master_key_b64 = os.getenv(self.config.master_key_env_var)
        if master_key_b64:
            try:
                self.master_key = base64.b64decode(master_key_b64)
                self.logger.info("Master key loaded from environment variable")
                return
            except Exception as e:
                self.logger.warning(f"Failed to load master key from environment: {e}")

        # Try to load from file
        if self.config.master_key_file:
            try:
                with open(self.config.master_key_file, "rb") as f:
                    self.master_key = f.read()
                self.logger.info("Master key loaded from file")
                return
            except Exception as e:
                self.logger.warning(f"Failed to load master key from file: {e}")

        # Generate new master key
        self.master_key = secrets.token_bytes(32)
        self.logger.warning("Generated new master key - save this securely!")

        # Save to environment variable for persistence
        master_key_b64 = base64.b64encode(self.master_key).decode("utf-8")
        os.environ[self.config.master_key_env_var] = master_key_b64

    async def _encrypt_key_material(self, key_material: bytes) -> str:
        """Encrypt key material with master key"""
        if not self.master_key:
            raise ValueError("Master key not available")

        # Use AES-GCM to encrypt key material
        nonce = secrets.token_bytes(12)
        cipher = Cipher(
            algorithms.AES(self.master_key), modes.GCM(nonce), backend=default_backend()
        )

        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(key_material) + encryptor.finalize()

        # Combine nonce + tag + ciphertext
        encrypted_key = nonce + encryptor.tag + ciphertext
        return base64.b64encode(encrypted_key).decode("utf-8")

    async def _decrypt_key_material(self, encrypted_key: str) -> bytes:
        """Decrypt key material with master key"""
        if not self.master_key:
            raise ValueError("Master key not available")

        encrypted_data = base64.b64decode(encrypted_key)

        # Extract nonce, tag, and ciphertext
        nonce = encrypted_data[:12]
        tag = encrypted_data[12:28]
        ciphertext = encrypted_data[28:]

        # Decrypt
        cipher = Cipher(
            algorithms.AES(self.master_key),
            modes.GCM(nonce, tag),
            backend=default_backend(),
        )

        decryptor = cipher.decryptor()
        key_material = decryptor.update(ciphertext) + decryptor.finalize()

        return key_material

    async def _get_key_material(self, key_id: str) -> Optional[bytes]:
        """Get decrypted key material for encryption key"""
        # Check cache first
        if self.config.enable_key_cache and key_id in self.key_cache:
            cache_time = self.cache_timestamps.get(key_id)
            if cache_time:
                age = (datetime.now(timezone.utc) - cache_time).total_seconds()
                if age < self.config.key_cache_ttl_seconds:
                    return self.key_cache[key_id]

        # Get key from storage
        encryption_key = self.encryption_keys.get(key_id)
        if not encryption_key:
            return None

        # Decrypt key material
        try:
            key_material = await self._decrypt_key_material(
                encryption_key.encrypted_key
            )

            # Cache the key material
            if self.config.enable_key_cache:
                self.key_cache[key_id] = key_material
                self.cache_timestamps[key_id] = datetime.now(timezone.utc)

                # Cleanup old cache entries
                if len(self.key_cache) > 100:
                    oldest_keys = sorted(
                        self.cache_timestamps.keys(),
                        key=lambda k: self.cache_timestamps[k],
                    )[:10]  # Remove oldest 10

                    for old_key in oldest_keys:
                        self.key_cache.pop(old_key, None)
                        self.cache_timestamps.pop(old_key, None)

            return key_material

        except Exception as e:
            self.logger.error(f"Failed to decrypt key material for {key_id}: {e}")
            return None

    def _invalidate_key_cache(self, key_id: str):
        """Invalidate cached key material"""
        self.key_cache.pop(key_id, None)
        self.cache_timestamps.pop(key_id, None)

    async def _encrypt_aes_gcm(
        self, data: bytes, key: bytes, additional_data: Optional[bytes] = None
    ) -> Tuple[bytes, bytes, bytes]:
        """Encrypt data using AES-GCM"""
        nonce = secrets.token_bytes(12)
        cipher = Cipher(
            algorithms.AES(key), modes.GCM(nonce), backend=default_backend()
        )

        encryptor = cipher.encryptor()

        if additional_data:
            encryptor.authenticate_additional_data(additional_data)

        ciphertext = encryptor.update(data) + encryptor.finalize()

        return ciphertext, nonce, encryptor.tag

    async def _decrypt_aes_gcm(
        self,
        ciphertext: bytes,
        key: bytes,
        nonce: bytes,
        tag: bytes,
        additional_data: Optional[bytes] = None,
    ) -> bytes:
        """Decrypt data using AES-GCM"""
        cipher = Cipher(
            algorithms.AES(key), modes.GCM(nonce, tag), backend=default_backend()
        )

        decryptor = cipher.decryptor()

        if additional_data:
            decryptor.authenticate_additional_data(additional_data)

        return decryptor.update(ciphertext) + decryptor.finalize()

    async def _encrypt_aes_cbc(self, data: bytes, key: bytes) -> Tuple[bytes, bytes]:
        """Encrypt data using AES-CBC"""
        # Pad data to block size
        from cryptography.hazmat.primitives import padding

        padder = padding.PKCS7(128).padder()
        padded_data = padder.update(data) + padder.finalize()

        nonce = secrets.token_bytes(16)  # IV for CBC
        cipher = Cipher(
            algorithms.AES(key), modes.CBC(nonce), backend=default_backend()
        )

        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(padded_data) + encryptor.finalize()

        return ciphertext, nonce

    async def _decrypt_aes_cbc(
        self, ciphertext: bytes, key: bytes, nonce: bytes
    ) -> bytes:
        """Decrypt data using AES-CBC"""
        cipher = Cipher(
            algorithms.AES(key), modes.CBC(nonce), backend=default_backend()
        )

        decryptor = cipher.decryptor()
        padded_data = decryptor.update(ciphertext) + decryptor.finalize()

        # Remove padding
        from cryptography.hazmat.primitives import padding

        unpadder = padding.PKCS7(128).unpadder()
        data = unpadder.update(padded_data) + unpadder.finalize()

        return data


# Factory function
def create_data_encryption(
    config: Optional[EncryptionConfiguration] = None,
) -> DataEncryption:
    """Create DataEncryption instance with optional configuration"""
    return DataEncryption(config)
