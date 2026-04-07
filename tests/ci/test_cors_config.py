"""Tests for CORS configuration.

Validates that _get_allowed_origins correctly parses the
CORS_ALLOWED_ORIGINS environment variable with proper defaults.
"""
import os

import pytest

from docfusion.api.app import _get_allowed_origins


class TestCORSConfig:
	"""Verify CORS origin loading from environment variables."""

	def test_default_origins(self, monkeypatch: pytest.MonkeyPatch) -> None:
		"""Without env var, defaults to localhost:3000."""
		monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
		origins = _get_allowed_origins()
		assert origins == ["http://localhost:3000"]

	def test_custom_single_origin(self, monkeypatch: pytest.MonkeyPatch) -> None:
		"""A single custom origin should be returned as a one-element list."""
		monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://app.example.com")
		origins = _get_allowed_origins()
		assert origins == ["https://app.example.com"]

	def test_multiple_origins(self, monkeypatch: pytest.MonkeyPatch) -> None:
		"""Comma-separated origins should all be included in the list."""
		monkeypatch.setenv(
			"CORS_ALLOWED_ORIGINS",
			"https://app.example.com,https://admin.example.com,http://localhost:8080"
		)
		origins = _get_allowed_origins()
		assert origins == [
			"https://app.example.com",
			"https://admin.example.com",
			"http://localhost:8080",
		]

	def test_origins_are_stripped(self, monkeypatch: pytest.MonkeyPatch) -> None:
		"""Whitespace around origins should be stripped."""
		monkeypatch.setenv(
			"CORS_ALLOWED_ORIGINS",
			"  https://a.com ,  https://b.com  , https://c.com  "
		)
		origins = _get_allowed_origins()
		assert origins == ["https://a.com", "https://b.com", "https://c.com"]

	def test_empty_env_var(self, monkeypatch: pytest.MonkeyPatch) -> None:
		"""Empty env var should fall back to empty list (all entries stripped away)."""
		monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "")
		origins = _get_allowed_origins()
		# Empty string splits to [""], strip leaves "", the `if origin.strip()` filter removes it
		assert origins == []

	def test_whitespace_only_env_var(self, monkeypatch: pytest.MonkeyPatch) -> None:
		"""Whitespace-only env var should result in empty list."""
		monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "   ")
		origins = _get_allowed_origins()
		assert origins == []

	def test_trailing_comma(self, monkeypatch: pytest.MonkeyPatch) -> None:
		"""A trailing comma should not produce an empty entry."""
		monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://a.com,")
		origins = _get_allowed_origins()
		assert origins == ["https://a.com"]

	def test_leading_comma(self, monkeypatch: pytest.MonkeyPatch) -> None:
		"""A leading comma should not produce an empty entry."""
		monkeypatch.setenv("CORS_ALLOWED_ORIGINS", ",https://a.com")
		origins = _get_allowed_origins()
		assert origins == ["https://a.com"]

	def test_multiple_commas(self, monkeypatch: pytest.MonkeyPatch) -> None:
		"""Consecutive commas should be treated as empty entries and filtered out."""
		monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://a.com,,,,https://b.com")
		origins = _get_allowed_origins()
		assert origins == ["https://a.com", "https://b.com"]

	def test_return_type_is_list(self, monkeypatch: pytest.MonkeyPatch) -> None:
		"""Return value should always be a list of strings."""
		monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
		origins = _get_allowed_origins()
		assert isinstance(origins, list)
		assert all(isinstance(o, str) for o in origins)

	def test_wildcard_origin(self, monkeypatch: pytest.MonkeyPatch) -> None:
		"""A wildcard origin '*' should be preserved as-is."""
		monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "*")
		origins = _get_allowed_origins()
		assert origins == ["*"]
