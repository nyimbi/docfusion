"""Tests for SQL schema name validation.

Validates that _validate_schema_name and VALID_SCHEMA_PATTERN correctly
accept safe identifiers and reject SQL injection attempts.
"""
import pytest

from docfusion.storage.rag.database import _validate_schema_name, VALID_SCHEMA_PATTERN


class TestSchemaNameValidation:
	"""Verify schema name validation rejects injection and accepts valid names."""

	@pytest.mark.parametrize("name", [
		"public",
		"docfusion",
		"my_schema",
		"schema_v2",
		"rag",
		"_private",
		"UPPERCASE",
		"Mixed_Case_V3",
		"a",
	])
	def test_valid_schema_names(self, name: str) -> None:
		"""Standard SQL identifier schema names should pass validation."""
		result = _validate_schema_name(name)
		assert result == name

	@pytest.mark.parametrize("name", [
		"public; DROP TABLE users --",
		"schema'OR'1'='1",
		"../../etc/passwd",
		"schema name",
		"my-schema",
		"123_starts_with_digit",
		"schema.nested",
		"",
		"schema;",
		"valid_name\n-- injection",
		"schema\t\ttabs",
		"name()",
		"name[]",
		"name{}",
		"test*",
		"$money",
		"@mention",
	])
	def test_invalid_schema_names(self, name: str) -> None:
		"""SQL injection attempts and invalid identifiers should be rejected."""
		with pytest.raises(ValueError, match="Invalid schema name"):
			_validate_schema_name(name)

	def test_empty_schema_name(self) -> None:
		"""Empty string should be rejected."""
		with pytest.raises(ValueError, match="Invalid schema name"):
			_validate_schema_name("")

	def test_return_value_is_input(self) -> None:
		"""On success, the function returns the validated name unchanged."""
		name = "valid_schema"
		assert _validate_schema_name(name) is name


class TestValidSchemaPattern:
	"""Direct tests on the compiled regex pattern."""

	def test_pattern_requires_alpha_or_underscore_start(self) -> None:
		"""Schema names must start with a letter or underscore."""
		assert VALID_SCHEMA_PATTERN.match("_ok") is not None
		assert VALID_SCHEMA_PATTERN.match("a1") is not None
		assert VALID_SCHEMA_PATTERN.match("1bad") is None

	def test_pattern_allows_digits_after_start(self) -> None:
		"""Digits are allowed after the first character."""
		assert VALID_SCHEMA_PATTERN.match("schema123") is not None

	def test_pattern_rejects_whitespace(self) -> None:
		"""Whitespace anywhere should cause rejection."""
		assert VALID_SCHEMA_PATTERN.match("no spaces") is None
		assert VALID_SCHEMA_PATTERN.match(" leading") is None
		assert VALID_SCHEMA_PATTERN.match("trailing ") is None

	def test_pattern_rejects_special_characters(self) -> None:
		"""Special characters used in SQL injection should be rejected."""
		for char in [";", "'", '"', "-", ".", "/", "\\", "(", ")", "*"]:
			name = f"test{char}name"
			assert VALID_SCHEMA_PATTERN.match(name) is None, (
				f"Pattern should reject '{char}' in schema name"
			)
