"""Tests for LocalBlobStore: store/retrieve round-trip, missing-key None, path safety."""

from __future__ import annotations

import pytest

from docfusion.storage.blob_store import BlobStore, LocalBlobStore


async def test_store_retrieve_round_trip(tmp_path):
	store = LocalBlobStore(root=tmp_path)
	data = b"hello rfp world"
	await store.store("orgs/acme/rfp/abc/tender.pdf", data)
	result = await store.retrieve("orgs/acme/rfp/abc/tender.pdf")
	assert result == data


async def test_retrieve_missing_key_returns_none(tmp_path):
	store = LocalBlobStore(root=tmp_path)
	assert await store.retrieve("orgs/acme/rfp/nope/missing.pdf") is None


async def test_store_creates_parent_dirs(tmp_path):
	store = LocalBlobStore(root=tmp_path)
	await store.store("orgs/org1/rfp/deep/nested/file.docx", b"data")
	dest = tmp_path / "org1" / "rfp" / "deep" / "nested" / "file.docx"
	assert dest.exists()


async def test_strip_orgs_prefix(tmp_path):
	store = LocalBlobStore(root=tmp_path)
	await store.store("orgs/x/rfp/1/f.pdf", b"abc")
	# Key without prefix stores at same relative path
	stored_path = tmp_path / "x" / "rfp" / "1" / "f.pdf"
	assert stored_path.read_bytes() == b"abc"


async def test_key_without_orgs_prefix(tmp_path):
	store = LocalBlobStore(root=tmp_path)
	await store.store("x/rfp/1/f.pdf", b"xyz")
	assert await store.retrieve("x/rfp/1/f.pdf") == b"xyz"


async def test_overwrite_existing(tmp_path):
	store = LocalBlobStore(root=tmp_path)
	await store.store("orgs/a/rfp/1/f.pdf", b"v1")
	await store.store("orgs/a/rfp/1/f.pdf", b"v2")
	assert await store.retrieve("orgs/a/rfp/1/f.pdf") == b"v2"


def test_local_blob_store_implements_protocol(tmp_path):
	store = LocalBlobStore(root=tmp_path)
	assert isinstance(store, BlobStore)
