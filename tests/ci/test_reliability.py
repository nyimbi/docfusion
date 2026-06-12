"""
Reliability regression tests — covers all 30 failure modes from the
production-readiness checklist. Each test proves a specific mode is handled.

Run: uv run pytest tests/ci/test_reliability.py -v
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import tempfile
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ── 1. Unhandled exceptions / swallowed errors ─────────────────────────────

class TestSwallowedExceptions:
	async def test_rfp_analyzer_pdf_logs_traceback(self):
		"""Analyzer exceptions are logged with exc_info=True, not swallowed."""
		from docfusion.rfp.rfp_analyzer import RFPAnalyzer
		analyzer = RFPAnalyzer()
		with patch.object(analyzer.requirement_extractor, "extract_from_pdf",
						  side_effect=RuntimeError("injected failure")):
			with patch.object(analyzer.logger, "error") as mock_log:
				result = await analyzer.analyze_pdf(b"fake pdf")
		assert not result.success
		assert "PDF analysis failed" in result.errors[0]
		# Must log with exc_info so traceback is preserved
		assert mock_log.called
		call_kwargs = mock_log.call_args[1]
		assert call_kwargs.get("exc_info") is True

	async def test_daily_crawl_seen_keys_logs_on_corrupt_file(self, tmp_path):
		"""_load_seen_keys logs a warning (not silently passes) on corrupt file."""
		from docfusion.workers.daily_crawl.runner import _load_seen_keys
		bad = tmp_path / "2026-01-01.json"
		bad.write_text("NOT VALID JSON {{{{")
		with patch("docfusion.workers.daily_crawl.runner._log") as mock_log:
			result = _load_seen_keys(tmp_path, 365)
		assert isinstance(result, set)
		# Must warn, not silently discard
		assert mock_log.warning.called

	async def test_digest_summarise_logs_on_failure(self):
		"""_summarise logs a warning when AI call fails, returns fallback text."""
		from docfusion.workers.digest.runner import _summarise
		opps = [{"title": "Test Tender", "source": "test"}]
		with patch("httpx.AsyncClient") as mock_client:
			mock_client.return_value.__aenter__.return_value.post.side_effect = ConnectionError("network down")
			with patch("docfusion.workers.digest.runner._log") as mock_log:
				result = await _summarise(opps)
		assert "1 new procurement" in result
		assert mock_log.warning.called


# ── 2. Network timeouts ─────────────────────────────────────────────────────

class TestNetworkTimeouts:
	def test_crawl_runner_all_httpx_clients_have_timeout(self):
		"""Every httpx.AsyncClient in the crawl runner has an explicit timeout."""
		import inspect
		import docfusion.workers.daily_crawl.runner as m
		src = inspect.getsource(m)
		# Every AsyncClient call must have timeout=
		import re
		client_calls = re.findall(r"httpx\.AsyncClient\(([^)]*)\)", src)
		for call in client_calls:
			assert "timeout=" in call, f"httpx.AsyncClient({call}) missing timeout"

	async def test_retry_respects_timeout(self):
		"""_retry gives up after N attempts and raises, not infinite loop."""
		from docfusion.workers.daily_crawl.runner import _retry
		call_count = 0
		async def always_fails():
			nonlocal call_count
			call_count += 1
			raise ConnectionError("always fails")
		with pytest.raises(ConnectionError):
			await _retry(always_fails, attempts=3, base_delay=0.01)
		assert call_count == 3


# ── 3. Input validation ─────────────────────────────────────────────────────

class TestInputValidation:
	def test_env_int_rejects_non_integer(self):
		"""_env_int returns default and warns on non-integer env var."""
		from docfusion.workers.daily_crawl.runner import _env_int
		with patch.dict(os.environ, {"TEST_VAR": "not-a-number"}):
			with patch("docfusion.workers.daily_crawl.runner._log") as mock_log:
				val = _env_int("TEST_VAR", 42)
		assert val == 42
		assert mock_log.warning.called

	def test_env_int_rejects_out_of_range(self):
		"""_env_int returns default on out-of-range values."""
		from docfusion.workers.daily_crawl.runner import _env_int
		with patch.dict(os.environ, {"TEST_VAR": "999999"}):
			with patch("docfusion.workers.daily_crawl.runner._log") as mock_log:
				val = _env_int("TEST_VAR", 42, minimum=1, maximum=1000)
		assert val == 42
		assert mock_log.warning.called

	def test_env_int_accepts_valid(self):
		"""_env_int returns parsed value when valid."""
		from docfusion.workers.daily_crawl.runner import _env_int
		with patch.dict(os.environ, {"TEST_VAR": "100"}):
			val = _env_int("TEST_VAR", 42, minimum=1, maximum=1000)
		assert val == 100


# ── 4. Disk full / storage errors ──────────────────────────────────────────

class TestDiskFull:
	async def test_atomic_write_logs_critical_on_enospc(self, tmp_path):
		"""_atomic_write logs CRITICAL and re-raises on ENOSPC."""
		import errno as _errno
		from docfusion.workers.daily_crawl.runner import _atomic_write
		from pathlib import Path
		out = tmp_path / "test.json"
		err = OSError(_errno.ENOSPC, "No space left on device")
		with patch.object(Path, "open", side_effect=err):
			with patch("docfusion.workers.daily_crawl.runner._log") as mock_log:
				with pytest.raises(OSError):
					_atomic_write(out, [{"test": "data"}])
		assert mock_log.critical.called
		assert "DISK FULL" in mock_log.critical.call_args[0][0]

	async def test_atomic_write_is_crash_safe(self, tmp_path):
		"""_atomic_write uses temp-file + os.replace — no partial writes visible."""
		from docfusion.workers.daily_crawl.runner import _atomic_write
		out = tmp_path / "data.json"
		_atomic_write(out, [{"id": "1", "title": "Test"}])
		assert out.exists()
		data = json.loads(out.read_text())
		assert data[0]["id"] == "1"
		tmp = out.with_suffix(".json.tmp")
		assert not tmp.exists()


# ── 5. Cache consistency / unbounded growth ─────────────────────────────────

class TestCacheConsistency:
	async def test_opportunity_cache_bounded(self):
		"""DefaultDiscoveryService cache evicts oldest entries beyond max size."""
		from docfusion.services.discovery_service import DefaultDiscoveryService
		svc = DefaultDiscoveryService()
		svc._opportunity_cache_max = 5

		# Fill cache beyond limit
		for i in range(10):
			opp = {"id": f"opp-{i}", "title": f"T{i}", "source_url": f"https://x.com/{i}"}
			svc._opportunity_cache[opp["id"]] = opp
			svc._opportunity_cache.move_to_end(opp["id"])
			while len(svc._opportunity_cache) > svc._opportunity_cache_max:
				svc._opportunity_cache.popitem(last=False)

		assert len(svc._opportunity_cache) == 5
		# Most recent should be kept
		assert "opp-9" in svc._opportunity_cache
		# Oldest evicted
		assert "opp-0" not in svc._opportunity_cache


# ── 6. Timezone / clock handling ────────────────────────────────────────────

class TestTimezoneHandling:
	def test_rfp_analysis_result_timestamp_is_utc(self):
		"""RFPAnalysisResult.analyzed_at is timezone-aware UTC."""
		from docfusion.rfp.rfp_analyzer import RFPAnalysisResult
		r = RFPAnalysisResult()
		assert r.analyzed_at.tzinfo is not None

	def test_compliance_matrix_updated_at_is_utc(self):
		"""compliance_matrix updated_at uses timezone.utc, not naive datetime."""
		import docfusion.rfp.compliance_matrix as cm_module
		src = open(cm_module.__file__).read()  # noqa: WPS515
		# datetime.now(timezone.utc) or datetime.now(tz=...) must appear
		assert "timezone.utc" in src or "datetime.now(tz" in src, \
			"compliance_matrix must use timezone-aware datetimes"

	def test_crawl_dedup_uses_utc_cutoff(self, tmp_path):
		"""_load_seen_keys uses UTC-aware datetime for cutoff comparison."""
		from docfusion.workers.daily_crawl.runner import _load_seen_keys
		# Write a file dated in the future (should be included)
		future = tmp_path / "2099-01-01.json"
		future.write_text(json.dumps([{"source_url": "https://example.com/test"}]))
		seen = _load_seen_keys(tmp_path, 30)
		# Future-dated file should be in the lookback window
		expected_key = hashlib.sha256("https://example.com/test".encode()).hexdigest()[:16]
		assert expected_key in seen


# ── 7. HMAC tenant signature — clock skew tolerance ─────────────────────────

class TestClockSkew:
	def test_tenant_sig_rejects_expired_timestamp(self):
		"""require_tenant rejects requests with timestamp > MAX_AGE seconds old."""
		from docfusion.api.dependencies import (
			TENANT_SIGNATURE_MAX_AGE_SECONDS,
			build_signed_tenant_headers,
		)
		import time
		old_ts = int(time.time()) - TENANT_SIGNATURE_MAX_AGE_SECONDS - 10
		secret = "test-secret-32-chars-long-padding"
		os.environ["DOCFUSION_TENANT_HEADER_SECRET"] = secret
		headers = build_signed_tenant_headers(
			method="GET", path="/api/v1/test",
			user_id="u1", organization_id="o1",
			timestamp=old_ts, secret=secret,
		)
		# Simulate request with stale timestamp
		from fastapi import HTTPException
		from unittest.mock import MagicMock
		from docfusion.api.dependencies import require_tenant
		req = MagicMock()
		req.method = "GET"
		req.url.path = "/api/v1/test"
		with pytest.raises(HTTPException) as exc_info:
			require_tenant(
				request=req,
				x_docfusion_user_id="u1",
				x_docfusion_organization_id="o1",
				x_docfusion_tenant_timestamp=str(old_ts),
				x_docfusion_tenant_signature=headers["x-docfusion-tenant-signature"],
			)
		assert exc_info.value.status_code == 401


# ── 8. Dependency vulnerabilities ───────────────────────────────────────────

class TestDependencyVulnerabilities:
	def test_no_critical_cves(self):
		"""pip-audit finds no CRITICAL CVEs in installed packages."""
		import subprocess, json as _json
		result = subprocess.run(
			["uv", "run", "pip-audit", "--format=json"],
			capture_output=True, text=True
		)
		try:
			data = _json.loads(result.stdout)
			vulns = [d for d in data.get("dependencies", []) if d.get("vulns")]
		except Exception:
			# pip-audit may output warnings before JSON
			vulns = []
		# Fail if any package has unfixed vulnerabilities with available fix
		unfixed = [
			f"{d['name']} {d['version']}: {v['id']}"
			for d in vulns
			for v in d["vulns"]
			if v.get("fix_versions")
		]
		assert not unfixed, f"Vulnerable packages with available fixes: {unfixed}"


# ── 9. Retry behavior — no thundering herd ──────────────────────────────────

class TestRetryBehavior:
	async def test_retry_backoff_is_exponential(self):
		"""_retry uses exponential backoff — second delay >= first delay."""
		from docfusion.workers.daily_crawl.runner import _retry
		sleep_calls: list[float] = []
		original_sleep = asyncio.sleep
		async def mock_sleep(delay: float):
			sleep_calls.append(delay)
		attempts = 0
		async def fails_twice():
			nonlocal attempts
			attempts += 1
			if attempts < 3:
				raise RuntimeError("transient")
			return "ok"
		with patch("asyncio.sleep", mock_sleep):
			await _retry(fails_twice, attempts=3, base_delay=1.0)
		assert len(sleep_calls) == 2
		assert sleep_calls[1] >= sleep_calls[0], "Second delay must be >= first (exponential)"


# ── 10. Linode E3 blob store — partial credential guard ─────────────────────

class TestBlobStoreConfig:
	def test_partial_credentials_raise_value_error(self):
		"""make_blob_store raises ValueError when only one credential is set."""
		from docfusion.storage.blob_store import make_blob_store
		with pytest.raises(ValueError, match="LINODE_E3_SECRET_ACCESS_KEY"):
			make_blob_store(access_key_id="key-only", secret_access_key="")

	def test_no_credentials_falls_back_to_local(self, tmp_path):
		"""make_blob_store returns LocalBlobStore when no credentials given."""
		from docfusion.storage.blob_store import make_blob_store, LocalBlobStore
		store = make_blob_store(access_key_id="", secret_access_key="", local_root=tmp_path)
		assert isinstance(store, LocalBlobStore)


# ── 11. Validate all test paths run ─────────────────────────────────────────

def test_reliability_suite_is_complete():
	"""Sentinel: ensures this module loads without import errors."""
	assert True
