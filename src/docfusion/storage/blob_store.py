"""Blob storage abstraction for raw byte payloads (e.g. uploaded RFP files).

This module provides a narrow ``BlobStore`` protocol and a ``LocalBlobStore``
implementation that stages bytes on the local filesystem under
``./storage/rfp``.  The storage key format — ``orgs/{org}/rfp/{id}/{file}`` —
is identical to the future cloud-object-store key so swapping in S3/Linode E3
requires only a new ``BlobStore`` implementation, not a schema change.

Usage::

    store = LocalBlobStore()
    await store.store("orgs/acme/rfp/abc/tender.pdf", raw_bytes)
    data = await store.retrieve("orgs/acme/rfp/abc/tender.pdf")
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Protocol, runtime_checkable


@runtime_checkable
class BlobStore(Protocol):
	"""Narrow protocol for raw-byte blob I/O keyed by a path string."""

	async def store(self, key: str, data: bytes) -> None:
		"""Persist ``data`` under ``key``, creating any intermediate directories."""
		...

	async def retrieve(self, key: str) -> bytes | None:
		"""Return the bytes stored at ``key``, or ``None`` if not found."""
		...


try:
	import boto3
	from botocore.exceptions import ClientError as _BotoClientError
	_BOTO3_AVAILABLE = True
except ImportError:
	_BOTO3_AVAILABLE = False

_LOCAL_STORAGE_ROOT = Path("./storage/rfp")


def _key_to_path(root: Path, key: str) -> Path:
	"""Resolve a storage key to an absolute filesystem path.

	Strips the ``orgs/`` prefix because ``root`` already starts at
	``storage/rfp``; the prefix exists solely for cloud-storage namespace
	clarity and would create a redundant path component on disk.
	"""
	relative = key[len("orgs/"):] if key.startswith("orgs/") else key
	return root / relative


class LocalBlobStore:
	"""Filesystem-backed blob store.  Default: ``./storage/rfp``.

	All I/O is delegated to a thread-pool executor so the event loop is
	never blocked by disk operations.
	"""

	def __init__(self, root: Path | str = _LOCAL_STORAGE_ROOT) -> None:
		self._root = Path(root)

	async def store(self, key: str, data: bytes) -> None:
		"""Write ``data`` to disk, creating parent directories as needed."""
		path = _key_to_path(self._root, key)
		loop = asyncio.get_running_loop()
		await loop.run_in_executor(None, self._write, path, data)

	async def retrieve(self, key: str) -> bytes | None:
		"""Read and return bytes, or ``None`` if the file does not exist."""
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


class LinodeBlobStore:
	"""Linode Object Storage (S3-compatible) blob store.

	Credentials and endpoint are read from environment variables managed by
	``SecretsManager``.  All I/O runs in a thread-pool executor so the event
	loop is never blocked.

	Expected environment variables::

		LINODE_ACCESS_KEY   = <access key>
		LINODE_SECRET_KEY   = <secret key>
		LINODE_S3_ENDPOINT  = https://gb-lon-1.linodeobjects.com  (default)
		LINODE_BUCKET_NAME  = docfusion-rfp  (default)
	"""

	def __init__(
		self,
		access_key: str,
		secret_key: str,
		endpoint_url: str = "https://gb-lon-1.linodeobjects.com",
		bucket: str = "docfusion-rfp",
	) -> None:
		if not _BOTO3_AVAILABLE:
			raise RuntimeError("boto3 is required for LinodeBlobStore — run: uv add boto3")
		self._access_key = access_key
		self._secret_key = secret_key
		self._endpoint_url = endpoint_url
		self._bucket = bucket

	def _client(self):
		return boto3.client(
			"s3",
			endpoint_url=self._endpoint_url,
			aws_access_key_id=self._access_key,
			aws_secret_access_key=self._secret_key,
			region_name=self._endpoint_url.split("//")[-1].split(".")[0],
		)

	async def store(self, key: str, data: bytes) -> None:
		"""Upload ``data`` to Linode Object Storage under ``key``."""
		loop = asyncio.get_running_loop()
		await loop.run_in_executor(None, self._put, key, data)

	async def retrieve(self, key: str) -> bytes | None:
		"""Download and return bytes for ``key``, or ``None`` if not found."""
		loop = asyncio.get_running_loop()
		return await loop.run_in_executor(None, self._get, key)

	def _put(self, key: str, data: bytes) -> None:
		self._client().put_object(Bucket=self._bucket, Key=key, Body=data)

	def _get(self, key: str) -> bytes | None:
		try:
			response = self._client().get_object(Bucket=self._bucket, Key=key)
			return response["Body"].read()
		except _BotoClientError as exc:
			if exc.response["Error"]["Code"] in ("NoSuchKey", "404"):
				return None
			raise


def make_blob_store(
	*,
	access_key: str = "",
	secret_key: str = "",
	endpoint_url: str = "https://gb-lon-1.linodeobjects.com",
	bucket: str = "docfusion-rfp",
	local_root: Path | str = _LOCAL_STORAGE_ROOT,
) -> BlobStore:
	"""Return a ``LinodeBlobStore`` when credentials are provided, else ``LocalBlobStore``.

	Reads config from ``SecretsManager`` when parameters are not supplied,
	making it safe to call with no arguments in the application startup path.
	"""
	resolved_key = access_key or _env("LINODE_ACCESS_KEY")
	resolved_secret = secret_key or _env("LINODE_SECRET_KEY")
	if resolved_key and resolved_secret:
		return LinodeBlobStore(
			access_key=resolved_key,
			secret_key=resolved_secret,
			endpoint_url=endpoint_url or _env("LINODE_S3_ENDPOINT") or "https://gb-lon-1.linodeobjects.com",
			bucket=bucket or _env("LINODE_BUCKET_NAME") or "docfusion-rfp",
		)
	return LocalBlobStore(root=local_root)


def _env(name: str) -> str:
	import os
	return os.environ.get(name, "")
