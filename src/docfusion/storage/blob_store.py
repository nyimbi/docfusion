"""Blob storage abstraction for raw byte payloads (e.g. uploaded RFP files).

Provides a narrow ``BlobStore`` protocol with two implementations:

* ``LocalBlobStore``: filesystem staging under ``./storage/rfp`` (dev/fallback)
* ``LinodeE3BlobStore``: Linode Object Storage via raw HTTP + AWS4-HMAC-SHA256
  signing — the same approach as ``frontend/lib/storage/linode-e3.ts``, with
  no boto3 dependency.

The storage key format ``orgs/{org}/rfp/{id}/{file}`` is stable across both
backends so no schema migration is needed when switching.

Frontend env var parity::

    LINODE_E3_ACCESS_KEY_ID     = <access key>
    LINODE_E3_SECRET_ACCESS_KEY = <secret key>
    LINODE_E3_BUCKET            = docfusion-rfp
    LINODE_E3_ENDPOINT          = https://gb-lon-1.linodeobjects.com
    LINODE_E3_REGION            = gb-lon-1
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac as _hmac
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol, runtime_checkable
from urllib.parse import quote


# ---------------------------------------------------------------------------
# Protocol
# ---------------------------------------------------------------------------

@runtime_checkable
class BlobStore(Protocol):
	"""Narrow protocol for raw-byte blob I/O keyed by a path string."""

	async def store(self, key: str, data: bytes) -> None:
		"""Persist ``data`` under ``key``."""
		...

	async def retrieve(self, key: str) -> bytes | None:
		"""Return bytes stored at ``key``, or ``None`` if not found."""
		...


# ---------------------------------------------------------------------------
# Local filesystem implementation
# ---------------------------------------------------------------------------

_LOCAL_STORAGE_ROOT = Path("./storage/rfp")


def _key_to_path(root: Path, key: str) -> Path:
	relative = key[len("orgs/"):] if key.startswith("orgs/") else key
	return root / relative


class LocalBlobStore:
	"""Filesystem-backed blob store.  Default root: ``./storage/rfp``."""

	def __init__(self, root: Path | str = _LOCAL_STORAGE_ROOT) -> None:
		self._root = Path(root)

	async def store(self, key: str, data: bytes) -> None:
		path = _key_to_path(self._root, key)
		loop = asyncio.get_running_loop()
		await loop.run_in_executor(None, self._write, path, data)

	async def retrieve(self, key: str) -> bytes | None:
		path = _key_to_path(self._root, key)
		loop = asyncio.get_running_loop()
		return await loop.run_in_executor(None, self._read, path)

	@staticmethod
	def _write(path: Path, data: bytes) -> None:
		path.parent.mkdir(parents=True, exist_ok=True)
		path.write_bytes(data)

	@staticmethod
	def _read(path: Path) -> bytes | None:
		if not path.exists():
			return None
		return path.read_bytes()


# ---------------------------------------------------------------------------
# AWS4-HMAC-SHA256 signing helpers (mirrors linode-e3.ts)
# ---------------------------------------------------------------------------

def _sha256_hex(data: bytes | str) -> str:
	if isinstance(data, str):
		data = data.encode("utf-8")
	return hashlib.sha256(data).hexdigest()


def _hmac_sha256(key: bytes, value: str) -> bytes:
	return _hmac.new(key, value.encode("utf-8"), hashlib.sha256).digest()


def _hmac_sha256_hex(key: bytes, value: str) -> str:
	return _hmac.new(key, value.encode("utf-8"), hashlib.sha256).hexdigest()


def _signing_key(secret_key: str, date_stamp: str, region: str, service: str) -> bytes:
	k_date = _hmac_sha256(f"AWS4{secret_key}".encode("utf-8"), date_stamp)
	k_region = _hmac_sha256(k_date, region)
	k_service = _hmac_sha256(k_region, service)
	return _hmac_sha256(k_service, "aws4_request")


def _build_authorization(
	*,
	method: str,
	canonical_uri: str,
	headers: dict[str, str],
	payload_hash: str,
	amz_date: str,
	date_stamp: str,
	region: str,
	access_key_id: str,
	secret_access_key: str,
) -> str:
	normalized = {k.lower(): v.strip() for k, v in headers.items()}
	signed_header_names = sorted(normalized)
	canonical_headers = "".join(f"{h}:{normalized[h]}\n" for h in signed_header_names)
	signed_headers = ";".join(signed_header_names)
	credential_scope = f"{date_stamp}/{region}/s3/aws4_request"
	canonical_request = "\n".join([
		method,
		canonical_uri,
		"",
		canonical_headers,
		signed_headers,
		payload_hash,
	])
	string_to_sign = "\n".join([
		"AWS4-HMAC-SHA256",
		amz_date,
		credential_scope,
		_sha256_hex(canonical_request),
	])
	sig_key = _signing_key(secret_access_key, date_stamp, region, "s3")
	signature = _hmac_sha256_hex(sig_key, string_to_sign)
	return (
		f"AWS4-HMAC-SHA256 Credential={access_key_id}/{credential_scope},"
		f" SignedHeaders={signed_headers},"
		f" Signature={signature}"
	)


def _amz_date(now: datetime | None = None) -> str:
	dt = now or datetime.now(timezone.utc)
	return dt.strftime("%Y%m%dT%H%M%SZ")


def _encode_key(key: str) -> str:
	return "/".join(quote(seg, safe="") for seg in key.split("/"))


# ---------------------------------------------------------------------------
# Linode E3 implementation (raw HTTP, no boto3)
# ---------------------------------------------------------------------------

class LinodeE3BlobStore:
	"""Linode Object Storage via raw HTTP + AWS4-HMAC-SHA256 signing.

	Mirrors ``frontend/lib/storage/linode-e3.ts`` exactly.  Uses the same
	env var names so frontend and backend share a single ``.env`` config.

	Expected env vars::

		LINODE_E3_ACCESS_KEY_ID     — access key
		LINODE_E3_SECRET_ACCESS_KEY — secret key
		LINODE_E3_BUCKET            — bucket name (default: docfusion-rfp)
		LINODE_E3_ENDPOINT          — endpoint URL (default: https://gb-lon-1.linodeobjects.com)
		LINODE_E3_REGION            — region (default: gb-lon-1)
	"""

	def __init__(
		self,
		access_key_id: str,
		secret_access_key: str,
		bucket: str = "docfusion-rfp",
		endpoint: str = "https://gb-lon-1.linodeobjects.com",
		region: str = "gb-lon-1",
	) -> None:
		self._access_key_id = access_key_id
		self._secret_access_key = secret_access_key
		self._bucket = bucket
		self._endpoint = endpoint.rstrip("/")
		self._region = region

	async def store(self, key: str, data: bytes) -> None:
		"""PUT ``data`` to Linode E3 under ``key``."""
		import aiohttp
		encoded_key = _encode_key(key)
		url = f"{self._endpoint}/{self._bucket}/{encoded_key}"
		now = datetime.now(timezone.utc)
		amz_date = _amz_date(now)
		date_stamp = amz_date[:8]
		payload_hash = _sha256_hex(data)
		host = self._endpoint.split("//")[-1]
		headers: dict[str, str] = {
			"content-length": str(len(data)),
			"content-type": "application/octet-stream",
			"host": host,
			"x-amz-content-sha256": payload_hash,
			"x-amz-date": amz_date,
		}
		headers["authorization"] = _build_authorization(
			method="PUT",
			canonical_uri=f"/{self._bucket}/{encoded_key}",
			headers=headers,
			payload_hash=payload_hash,
			amz_date=amz_date,
			date_stamp=date_stamp,
			region=self._region,
			access_key_id=self._access_key_id,
			secret_access_key=self._secret_access_key,
		)
		# aiohttp doesn't want pseudo-headers like 'host' in the request
		send_headers = {k: v for k, v in headers.items() if k != "host"}
		async with aiohttp.ClientSession() as session:
			async with session.put(url, data=data, headers=send_headers) as resp:
				if resp.status not in (200, 204):
					body = await resp.text()
					raise RuntimeError(
						f"Linode E3 PUT failed: {resp.status} {resp.reason} — {body}"
					)

	async def retrieve(self, key: str) -> bytes | None:
		"""GET ``key`` from Linode E3, returning ``None`` if not found."""
		import aiohttp
		encoded_key = _encode_key(key)
		url = f"{self._endpoint}/{self._bucket}/{encoded_key}"
		now = datetime.now(timezone.utc)
		amz_date = _amz_date(now)
		date_stamp = amz_date[:8]
		payload_hash = _sha256_hex(b"")
		host = self._endpoint.split("//")[-1]
		headers: dict[str, str] = {
			"host": host,
			"x-amz-content-sha256": payload_hash,
			"x-amz-date": amz_date,
		}
		headers["authorization"] = _build_authorization(
			method="GET",
			canonical_uri=f"/{self._bucket}/{encoded_key}",
			headers=headers,
			payload_hash=payload_hash,
			amz_date=amz_date,
			date_stamp=date_stamp,
			region=self._region,
			access_key_id=self._access_key_id,
			secret_access_key=self._secret_access_key,
		)
		send_headers = {k: v for k, v in headers.items() if k != "host"}
		async with aiohttp.ClientSession() as session:
			async with session.get(url, headers=send_headers) as resp:
				if resp.status == 404:
					return None
				if resp.status != 200:
					body = await resp.text()
					raise RuntimeError(
						f"Linode E3 GET failed: {resp.status} {resp.reason} — {body}"
					)
				return await resp.read()


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def make_blob_store(
	*,
	access_key_id: str = "",
	secret_access_key: str = "",
	bucket: str = "",
	endpoint: str = "",
	region: str = "",
	local_root: Path | str = _LOCAL_STORAGE_ROOT,
) -> BlobStore:
	"""Return ``LinodeE3BlobStore`` when E3 credentials are set, else ``LocalBlobStore``.

	Reads ``LINODE_E3_*`` env vars (same names as the frontend) when
	parameters are not supplied.
	"""
	resolved_key = access_key_id or os.environ.get("LINODE_E3_ACCESS_KEY_ID", "")
	resolved_secret = secret_access_key or os.environ.get("LINODE_E3_SECRET_ACCESS_KEY", "")
	if resolved_key and resolved_secret:
		return LinodeE3BlobStore(
			access_key_id=resolved_key,
			secret_access_key=resolved_secret,
			bucket=bucket or os.environ.get("LINODE_E3_BUCKET", "docfusion-rfp"),
			endpoint=endpoint or os.environ.get("LINODE_E3_ENDPOINT", "https://gb-lon-1.linodeobjects.com"),
			region=region or os.environ.get("LINODE_E3_REGION", "gb-lon-1"),
		)
	return LocalBlobStore(root=local_root)
