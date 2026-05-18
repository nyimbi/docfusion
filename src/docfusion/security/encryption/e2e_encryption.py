#!/usr/bin/env python3
"""
End-to-End Encryption Module

Implements end-to-end encryption for documents with support for multiple
encryption schemes, key exchange protocols, and secure sharing mechanisms.
"""

import base64
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

try:
    from cryptography.fernet import Fernet
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    HAS_CRYPTOGRAPHY = True
except ImportError:
    HAS_CRYPTOGRAPHY = False

from pydantic import BaseModel, Field
from ...core.utils import uuid7str
class EncryptionScheme(str, Enum):
    """Supported encryption schemes"""

    AES_256_GCM = "aes-256-gcm"
    AES_256_CBC = "aes-256-cbc"
    CHACHA20_POLY1305 = "chacha20-poly1305"
    FERNET = "fernet"

class KeyExchangeProtocol(str, Enum):
    """Key exchange protocols"""

    RSA_OAEP = "rsa-oaep"
    ECDH = "ecdh"
    RSA_PKCS1V15 = "rsa-pkcs1v15"

class KeyDerivationFunction(str, Enum):
    """Key derivation functions"""

    PBKDF2 = "pbkdf2"
    HKDF = "hkdf"
    SCRYPT = "scrypt"

@dataclass
class E2EEncryptionConfig:
    """End-to-end encryption configuration"""

    default_encryption_scheme: EncryptionScheme = EncryptionScheme.AES_256_GCM
    default_key_exchange: KeyExchangeProtocol = KeyExchangeProtocol.RSA_OAEP
    default_kdf: KeyDerivationFunction = KeyDerivationFunction.PBKDF2

    # Key generation settings
    rsa_key_size: int = 2048
    ec_curve: str = "secp256r1"

    # Encryption settings
    aes_key_size: int = 256
    pbkdf2_iterations: int = 100000
    salt_size: int = 32
    iv_size: int = 16

    # Security settings
    enable_key_rotation: bool = True
    key_rotation_days: int = 30
    max_shares_per_key: int = 100

    # Performance settings
    chunk_size: int = 64 * 1024  # 64KB chunks for large files

class EncryptionKey(BaseModel):
    """Encryption key information"""

    key_id: str = Field(default_factory=uuid7str)
    scheme: EncryptionScheme
    key_data: bytes

    # Key metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str
    expires_at: Optional[datetime] = None

    # Usage tracking
    usage_count: int = 0
    last_used: Optional[datetime] = None

    # Key derivation info (if derived)
    derivation_info: Optional[Dict[str, Any]] = None

class KeyPair(BaseModel):
    """Asymmetric key pair"""

    key_id: str = Field(default_factory=uuid7str)
    public_key: bytes
    private_key: bytes
    key_exchange_protocol: KeyExchangeProtocol

    # Key metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str
    expires_at: Optional[datetime] = None

    # Usage tracking
    usage_count: int = 0
    last_used: Optional[datetime] = None

class EncryptedDocument(BaseModel):
    """Encrypted document container"""

    document_id: str = Field(default_factory=uuid7str)
    encrypted_data: bytes
    encryption_metadata: Dict[str, Any]

    # Document metadata
    original_size: int
    encrypted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    encrypted_by: str

    # Access control
    authorized_users: List[str] = Field(default_factory=list)
    sharing_permissions: Dict[str, List[str]] = Field(
        default_factory=dict
    )  # user_id -> permissions

    # Versioning
    version: int = 1
    parent_document_id: Optional[str] = None

class DocumentShare(BaseModel):
    """Document sharing information"""

    share_id: str = Field(default_factory=uuid7str)
    document_id: str
    shared_by: str
    shared_with: str
    encrypted_key: bytes  # Document key encrypted for recipient

    # Sharing metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
    permissions: List[str] = Field(default_factory=lambda: ["read"])

    # Access tracking
    accessed_count: int = 0
    last_accessed: Optional[datetime] = None

class E2EEncryptionResult(BaseModel):
    """End-to-end encryption operation result"""

    success: bool
    document_id: Optional[str] = None
    encrypted_data: Optional[bytes] = None
    decrypted_data: Optional[bytes] = None

    # Operation metadata
    operation: str  # encrypt, decrypt, share, revoke
    encryption_scheme: Optional[EncryptionScheme] = None
    key_id: Optional[str] = None

    # Error information
    error: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None

    # Performance metrics
    operation_time_ms: Optional[float] = None
    data_size: Optional[int] = None

class E2EEncryption:
    """End-to-end encryption manager"""

    def __init__(self, config: Optional[E2EEncryptionConfig] = None):
        """Initialize E2E encryption manager"""
        if not HAS_CRYPTOGRAPHY:
            raise ImportError("cryptography library is required for E2E encryption")

        self.config = config or E2EEncryptionConfig()
        self.logger = logging.getLogger(__name__)

        # Storage (in production, use secure key management service)
        self.encryption_keys: Dict[str, EncryptionKey] = {}
        self.key_pairs: Dict[str, KeyPair] = {}
        self.encrypted_documents: Dict[str, EncryptedDocument] = {}
        self.document_shares: Dict[str, DocumentShare] = {}

        # User key pairs (user_id -> key_id)
        self.user_key_pairs: Dict[str, str] = {}

        self.logger.info("E2E encryption manager initialized")

    async def generate_user_keypair(self, user_id: str) -> str:
        """Generate key pair for user"""
        try:
            if self.config.default_key_exchange == KeyExchangeProtocol.RSA_OAEP:
                private_key = rsa.generate_private_key(
                    public_exponent=65537,
                    key_size=self.config.rsa_key_size,
                    backend=default_backend(),
                )
                public_key = private_key.public_key()

                private_pem = private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption(),
                )

                public_pem = public_key.public_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PublicFormat.SubjectPublicKeyInfo,
                )

            elif self.config.default_key_exchange == KeyExchangeProtocol.ECDH:
                private_key = ec.generate_private_key(
                    ec.SECP256R1(), backend=default_backend()
                )
                public_key = private_key.public_key()

                private_pem = private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption(),
                )

                public_pem = public_key.public_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PublicFormat.SubjectPublicKeyInfo,
                )

            else:
                raise ValueError(
                    f"Unsupported key exchange protocol: {self.config.default_key_exchange}"
                )

            # Create key pair
            key_pair = KeyPair(
                public_key=public_pem,
                private_key=private_pem,
                key_exchange_protocol=self.config.default_key_exchange,
                created_by=user_id,
            )

            # Store key pair
            self.key_pairs[key_pair.key_id] = key_pair
            self.user_key_pairs[user_id] = key_pair.key_id

            self.logger.info(f"Generated key pair for user {user_id}")
            return key_pair.key_id

        except Exception as e:
            self.logger.error(f"Failed to generate key pair for user {user_id}: {e}")
            raise

    async def encrypt_document(
        self,
        document_data: bytes,
        user_id: str,
        document_id: Optional[str] = None,
        scheme: Optional[EncryptionScheme] = None,
    ) -> E2EEncryptionResult:
        """Encrypt document with E2E encryption"""
        start_time = datetime.now(timezone.utc)

        try:
            scheme = scheme or self.config.default_encryption_scheme
            doc_id = document_id or uuid7str()

            # Generate document encryption key
            doc_key = self._generate_document_key(scheme)

            # Encrypt document data
            encrypted_data, encryption_metadata = await self._encrypt_data(
                document_data, doc_key, scheme
            )

            # Create encrypted document
            encrypted_doc = EncryptedDocument(
                document_id=doc_id,
                encrypted_data=encrypted_data,
                encryption_metadata=encryption_metadata,
                original_size=len(document_data),
                encrypted_by=user_id,
                authorized_users=[user_id],
            )

            # Store document key encrypted for user
            await self._store_document_key_for_user(doc_id, doc_key, user_id)

            # Store encrypted document
            self.encrypted_documents[doc_id] = encrypted_doc

            # Calculate operation time
            operation_time = (
                datetime.now(timezone.utc) - start_time
            ).total_seconds() * 1000

            self.logger.info(f"Encrypted document {doc_id} for user {user_id}")

            return E2EEncryptionResult(
                success=True,
                document_id=doc_id,
                encrypted_data=encrypted_data,
                operation="encrypt",
                encryption_scheme=scheme,
                operation_time_ms=operation_time,
                data_size=len(document_data),
            )

        except Exception as e:
            self.logger.error(f"Document encryption failed: {e}")
            return E2EEncryptionResult(success=False, operation="encrypt", error=str(e))

    async def decrypt_document(
        self, document_id: str, user_id: str
    ) -> E2EEncryptionResult:
        """Decrypt document for authorized user"""
        start_time = datetime.now(timezone.utc)

        try:
            # Get encrypted document
            encrypted_doc = self.encrypted_documents.get(document_id)
            if not encrypted_doc:
                return E2EEncryptionResult(
                    success=False, operation="decrypt", error="Document not found"
                )

            # Check if user is authorized
            if user_id not in encrypted_doc.authorized_users:
                return E2EEncryptionResult(
                    success=False,
                    operation="decrypt",
                    error="User not authorized to decrypt this document",
                )

            # Get document key for user
            doc_key = await self._get_document_key_for_user(document_id, user_id)
            if not doc_key:
                return E2EEncryptionResult(
                    success=False,
                    operation="decrypt",
                    error="Cannot retrieve document key for user",
                )

            # Decrypt document data
            decrypted_data = await self._decrypt_data(
                encrypted_doc.encrypted_data, doc_key, encrypted_doc.encryption_metadata
            )

            # Update access tracking
            await self._update_document_access(document_id, user_id)

            # Calculate operation time
            operation_time = (
                datetime.now(timezone.utc) - start_time
            ).total_seconds() * 1000

            self.logger.info(f"Decrypted document {document_id} for user {user_id}")

            return E2EEncryptionResult(
                success=True,
                document_id=document_id,
                decrypted_data=decrypted_data,
                operation="decrypt",
                operation_time_ms=operation_time,
                data_size=len(decrypted_data),
            )

        except Exception as e:
            self.logger.error(f"Document decryption failed: {e}")
            return E2EEncryptionResult(success=False, operation="decrypt", error=str(e))

    async def share_document(
        self,
        document_id: str,
        shared_by: str,
        shared_with: str,
        permissions: Optional[List[str]] = None,
        expires_in_days: Optional[int] = None,
    ) -> E2EEncryptionResult:
        """Share encrypted document with another user"""
        try:
            # Verify document exists and user has sharing permissions
            encrypted_doc = self.encrypted_documents.get(document_id)
            if not encrypted_doc:
                return E2EEncryptionResult(
                    success=False, operation="share", error="Document not found"
                )

            if shared_by not in encrypted_doc.authorized_users:
                return E2EEncryptionResult(
                    success=False,
                    operation="share",
                    error="User not authorized to share this document",
                )

            # Check if recipient has a key pair
            recipient_keypair_id = self.user_key_pairs.get(shared_with)
            if not recipient_keypair_id:
                return E2EEncryptionResult(
                    success=False,
                    operation="share",
                    error="Recipient does not have encryption keys",
                )

            # Get document key for sharer
            doc_key = await self._get_document_key_for_user(document_id, shared_by)
            if not doc_key:
                return E2EEncryptionResult(
                    success=False,
                    operation="share",
                    error="Cannot retrieve document key",
                )

            # Encrypt document key for recipient
            recipient_keypair = self.key_pairs[recipient_keypair_id]
            encrypted_key = await self._encrypt_key_for_user(doc_key, recipient_keypair)

            # Create share record
            expires_at = None
            if expires_in_days:
                expires_at = datetime.now(timezone.utc) + timedelta(
                    days=expires_in_days
                )

            share = DocumentShare(
                document_id=document_id,
                shared_by=shared_by,
                shared_with=shared_with,
                encrypted_key=encrypted_key,
                expires_at=expires_at,
                permissions=permissions or ["read"],
            )

            # Store share
            self.document_shares[share.share_id] = share

            # Add user to authorized users
            if shared_with not in encrypted_doc.authorized_users:
                encrypted_doc.authorized_users.append(shared_with)

            # Update sharing permissions
            encrypted_doc.sharing_permissions[shared_with] = permissions or ["read"]

            self.logger.info(
                f"Document {document_id} shared by {shared_by} with {shared_with}"
            )

            return E2EEncryptionResult(
                success=True, document_id=document_id, operation="share"
            )

        except Exception as e:
            self.logger.error(f"Document sharing failed: {e}")
            return E2EEncryptionResult(success=False, operation="share", error=str(e))

    async def revoke_document_access(
        self, document_id: str, revoked_by: str, revoked_user: str
    ) -> E2EEncryptionResult:
        """Revoke user access to encrypted document"""
        try:
            # Verify document exists and user has revocation permissions
            encrypted_doc = self.encrypted_documents.get(document_id)
            if not encrypted_doc:
                return E2EEncryptionResult(
                    success=False, operation="revoke", error="Document not found"
                )

            # Only document owner or admin can revoke access
            if (
                revoked_by != encrypted_doc.encrypted_by
                and revoked_by not in encrypted_doc.authorized_users
            ):
                return E2EEncryptionResult(
                    success=False,
                    operation="revoke",
                    error="User not authorized to revoke access",
                )

            # Remove from authorized users
            if revoked_user in encrypted_doc.authorized_users:
                encrypted_doc.authorized_users.remove(revoked_user)

            # Remove sharing permissions
            if revoked_user in encrypted_doc.sharing_permissions:
                del encrypted_doc.sharing_permissions[revoked_user]

            # Remove all shares for this user and document
            shares_to_remove = []
            for share_id, share in self.document_shares.items():
                if (
                    share.document_id == document_id
                    and share.shared_with == revoked_user
                ):
                    shares_to_remove.append(share_id)

            for share_id in shares_to_remove:
                del self.document_shares[share_id]

            self.logger.info(
                f"Revoked access to document {document_id} for user {revoked_user}"
            )

            return E2EEncryptionResult(
                success=True, document_id=document_id, operation="revoke"
            )

        except Exception as e:
            self.logger.error(f"Access revocation failed: {e}")
            return E2EEncryptionResult(success=False, operation="revoke", error=str(e))

    def _generate_document_key(self, scheme: EncryptionScheme) -> bytes:
        """Generate encryption key for document"""
        if (
            scheme == EncryptionScheme.AES_256_GCM
            or scheme == EncryptionScheme.AES_256_CBC
        ):
            return secrets.token_bytes(32)  # 256 bits
        elif scheme == EncryptionScheme.CHACHA20_POLY1305:
            return secrets.token_bytes(32)  # 256 bits
        elif scheme == EncryptionScheme.FERNET:
            return Fernet.generate_key()
        else:
            raise ValueError(f"Unsupported encryption scheme: {scheme}")

    async def _encrypt_data(
        self, data: bytes, key: bytes, scheme: EncryptionScheme
    ) -> Tuple[bytes, Dict[str, Any]]:
        """Encrypt data using specified scheme"""
        if scheme == EncryptionScheme.AES_256_GCM:
            iv = secrets.token_bytes(12)  # 96-bit IV for GCM
            cipher = Cipher(
                algorithms.AES(key), modes.GCM(iv), backend=default_backend()
            )
            encryptor = cipher.encryptor()

            # Encrypt in chunks for large data
            encrypted_chunks = []
            for i in range(0, len(data), self.config.chunk_size):
                chunk = data[i : i + self.config.chunk_size]
                encrypted_chunks.append(encryptor.update(chunk))

            encryptor.finalize()

            encrypted_data = b"".join(encrypted_chunks)
            tag = encryptor.tag

            return encrypted_data + tag, {
                "scheme": scheme,
                "iv": base64.b64encode(iv).decode(),
                "tag_length": len(tag),
            }

        elif scheme == EncryptionScheme.AES_256_CBC:
            iv = secrets.token_bytes(16)  # 128-bit IV for CBC

            # Add PKCS7 padding
            padding_length = 16 - (len(data) % 16)
            padded_data = data + bytes([padding_length]) * padding_length

            cipher = Cipher(
                algorithms.AES(key), modes.CBC(iv), backend=default_backend()
            )
            encryptor = cipher.encryptor()
            encrypted_data = encryptor.update(padded_data) + encryptor.finalize()

            return encrypted_data, {
                "scheme": scheme,
                "iv": base64.b64encode(iv).decode(),
            }

        elif scheme == EncryptionScheme.FERNET:
            f = Fernet(key)
            encrypted_data = f.encrypt(data)

            return encrypted_data, {"scheme": scheme}

        else:
            raise ValueError(f"Unsupported encryption scheme: {scheme}")

    async def _decrypt_data(
        self, encrypted_data: bytes, key: bytes, metadata: Dict[str, Any]
    ) -> bytes:
        """Decrypt data using metadata information"""
        scheme = EncryptionScheme(metadata["scheme"])

        if scheme == EncryptionScheme.AES_256_GCM:
            iv = base64.b64decode(metadata["iv"])
            tag_length = metadata["tag_length"]

            # Split data and tag
            tag = encrypted_data[-tag_length:]
            ciphertext = encrypted_data[:-tag_length]

            cipher = Cipher(
                algorithms.AES(key), modes.GCM(iv, tag), backend=default_backend()
            )
            decryptor = cipher.decryptor()

            # Decrypt in chunks for large data
            decrypted_chunks = []
            for i in range(0, len(ciphertext), self.config.chunk_size):
                chunk = ciphertext[i : i + self.config.chunk_size]
                decrypted_chunks.append(decryptor.update(chunk))

            decrypted_chunks.append(decryptor.finalize())

            return b"".join(decrypted_chunks)

        elif scheme == EncryptionScheme.AES_256_CBC:
            iv = base64.b64decode(metadata["iv"])

            cipher = Cipher(
                algorithms.AES(key), modes.CBC(iv), backend=default_backend()
            )
            decryptor = cipher.decryptor()
            padded_data = decryptor.update(encrypted_data) + decryptor.finalize()

            # Remove PKCS7 padding
            padding_length = padded_data[-1]
            return padded_data[:-padding_length]

        elif scheme == EncryptionScheme.FERNET:
            f = Fernet(key)
            return f.decrypt(encrypted_data)

        else:
            raise ValueError(f"Unsupported encryption scheme: {scheme}")

    async def _store_document_key_for_user(
        self, document_id: str, document_key: bytes, user_id: str
    ):
        """Store document key encrypted for user"""
        user_keypair_id = self.user_key_pairs.get(user_id)
        if not user_keypair_id:
            raise ValueError(f"User {user_id} does not have encryption keys")

        user_keypair = self.key_pairs[user_keypair_id]
        encrypted_key = await self._encrypt_key_for_user(document_key, user_keypair)

        # Store in document shares (self-share)
        share = DocumentShare(
            document_id=document_id,
            shared_by=user_id,
            shared_with=user_id,
            encrypted_key=encrypted_key,
            permissions=["read", "write", "share"],
        )

        self.document_shares[share.share_id] = share

    async def _get_document_key_for_user(
        self, document_id: str, user_id: str
    ) -> Optional[bytes]:
        """Get document key decrypted for user"""
        # Find share for this user and document
        user_share = None
        for share in self.document_shares.values():
            if share.document_id == document_id and share.shared_with == user_id:
                # Check if share is still valid
                if share.expires_at and datetime.now(timezone.utc) > share.expires_at:
                    continue
                user_share = share
                break

        if not user_share:
            return None

        # Get user's key pair
        user_keypair_id = self.user_key_pairs.get(user_id)
        if not user_keypair_id:
            return None

        user_keypair = self.key_pairs[user_keypair_id]

        # Decrypt document key
        return await self._decrypt_key_for_user(user_share.encrypted_key, user_keypair)

    async def _encrypt_key_for_user(self, key: bytes, user_keypair: KeyPair) -> bytes:
        """Encrypt key using user's public key"""
        public_key = serialization.load_pem_public_key(
            user_keypair.public_key, backend=default_backend()
        )

        if user_keypair.key_exchange_protocol == KeyExchangeProtocol.RSA_OAEP:
            encrypted_key = public_key.encrypt(
                key,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None,
                ),
            )
            return encrypted_key

        else:
            raise ValueError(
                f"Unsupported key exchange protocol: {user_keypair.key_exchange_protocol}"
            )

    async def _decrypt_key_for_user(
        self, encrypted_key: bytes, user_keypair: KeyPair
    ) -> bytes:
        """Decrypt key using user's private key"""
        private_key = serialization.load_pem_private_key(
            user_keypair.private_key, password=None, backend=default_backend()
        )

        if user_keypair.key_exchange_protocol == KeyExchangeProtocol.RSA_OAEP:
            decrypted_key = private_key.decrypt(
                encrypted_key,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None,
                ),
            )
            return decrypted_key

        else:
            raise ValueError(
                f"Unsupported key exchange protocol: {user_keypair.key_exchange_protocol}"
            )

    async def _update_document_access(self, document_id: str, user_id: str):
        """Update document access tracking"""
        # Update document access tracking
        encrypted_doc = self.encrypted_documents.get(document_id)
        if encrypted_doc:
            # Update shares access tracking
            for share in self.document_shares.values():
                if share.document_id == document_id and share.shared_with == user_id:
                    share.accessed_count += 1
                    share.last_accessed = datetime.now(timezone.utc)
                    break

    async def get_user_documents(self, user_id: str) -> List[Dict[str, Any]]:
        """Get list of documents user has access to"""
        user_docs = []

        for doc_id, encrypted_doc in self.encrypted_documents.items():
            if user_id in encrypted_doc.authorized_users:
                permissions = encrypted_doc.sharing_permissions.get(user_id, ["read"])
                user_docs.append(
                    {
                        "document_id": doc_id,
                        "encrypted_by": encrypted_doc.encrypted_by,
                        "encrypted_at": encrypted_doc.encrypted_at.isoformat(),
                        "original_size": encrypted_doc.original_size,
                        "permissions": permissions,
                        "version": encrypted_doc.version,
                    }
                )

        return user_docs

    async def get_document_shares(self, document_id: str) -> List[Dict[str, Any]]:
        """Get sharing information for document"""
        shares = []

        for share in self.document_shares.values():
            if share.document_id == document_id:
                shares.append(
                    {
                        "share_id": share.share_id,
                        "shared_with": share.shared_with,
                        "shared_by": share.shared_by,
                        "permissions": share.permissions,
                        "created_at": share.created_at.isoformat(),
                        "expires_at": share.expires_at.isoformat()
                        if share.expires_at
                        else None,
                        "accessed_count": share.accessed_count,
                        "last_accessed": share.last_accessed.isoformat()
                        if share.last_accessed
                        else None,
                    }
                )

        return shares

    async def cleanup_expired_shares(self) -> int:
        """Clean up expired document shares"""
        now = datetime.now(timezone.utc)
        expired_shares = []

        for share_id, share in self.document_shares.items():
            if share.expires_at and now > share.expires_at:
                expired_shares.append(share_id)

        for share_id in expired_shares:
            share = self.document_shares.pop(share_id)

            # Remove user from authorized users if no other valid shares
            document_id = share.document_id
            user_id = share.shared_with

            has_valid_share = any(
                s.document_id == document_id
                and s.shared_with == user_id
                and (s.expires_at is None or s.expires_at > now)
                for s in self.document_shares.values()
            )

            if not has_valid_share:
                encrypted_doc = self.encrypted_documents.get(document_id)
                if encrypted_doc and user_id in encrypted_doc.authorized_users:
                    encrypted_doc.authorized_users.remove(user_id)
                    if user_id in encrypted_doc.sharing_permissions:
                        del encrypted_doc.sharing_permissions[user_id]

        return len(expired_shares)

    async def get_statistics(self) -> Dict[str, Any]:
        """Get E2E encryption statistics"""
        return {
            "total_documents": len(self.encrypted_documents),
            "total_key_pairs": len(self.key_pairs),
            "total_shares": len(self.document_shares),
            "users_with_keys": len(self.user_key_pairs),
            "encryption_schemes_used": list(
                set(
                    doc.encryption_metadata.get("scheme")
                    for doc in self.encrypted_documents.values()
                )
            ),
        }

# Factory functions
def create_e2e_encryption(
    config: Optional[E2EEncryptionConfig] = None,
) -> E2EEncryption:
    """Create E2EEncryption instance"""
    return E2EEncryption(config)

def create_test_e2e_config() -> E2EEncryptionConfig:
    """Create test E2E encryption configuration"""
    return E2EEncryptionConfig(
        rsa_key_size=1024,  # Smaller for testing
        pbkdf2_iterations=10000,  # Fewer iterations for testing
        chunk_size=1024,  # Smaller chunks for testing
    )
