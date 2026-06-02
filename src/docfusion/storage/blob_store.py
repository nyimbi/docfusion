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
