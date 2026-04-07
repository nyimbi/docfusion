"""Tests for the optional imports utility.

Validates that try_import correctly handles existing modules, missing
modules, and missing classes within existing modules.

Note: We import directly from the module file to avoid the broken
transitive import chain in docfusion.agents.__init__.
"""
import importlib
import importlib.util
import sys
from pathlib import Path

import pytest


def _load_try_import():
	"""Load try_import directly from the module file, bypassing package __init__."""
	module_path = (
		Path(__file__).parent.parent.parent
		/ "src" / "docfusion" / "agents" / "utils" / "optional_imports.py"
	)
	if not module_path.exists():
		pytest.skip(f"Module not found at {module_path}")

	spec = importlib.util.spec_from_file_location(
		"docfusion.agents.utils.optional_imports_isolated", str(module_path)
	)
	module = importlib.util.module_from_spec(spec)
	spec.loader.exec_module(module)
	return module.try_import


try_import = _load_try_import()


class TestTryImport:
	"""Verify try_import returns classes or None without raising."""

	def test_import_existing_stdlib_class(self) -> None:
		"""Importing a standard library class should succeed."""
		result = try_import("datetime", "datetime")
		assert result is not None
		import datetime
		assert result is datetime.datetime

	def test_import_existing_stdlib_module_level_class(self) -> None:
		"""Importing another well-known stdlib class should succeed."""
		result = try_import("collections", "OrderedDict")
		assert result is not None
		from collections import OrderedDict
		assert result is OrderedDict

	def test_import_nonexistent_module(self) -> None:
		"""Importing from a module that does not exist should return None."""
		result = try_import("nonexistent_module_xyz_abc_123", "SomeClass")
		assert result is None

	def test_import_existing_module_wrong_class(self) -> None:
		"""Importing a non-existent class from an existing module should return None."""
		result = try_import("datetime", "NonExistentClass")
		assert result is None

	def test_import_nested_module(self) -> None:
		"""Importing from a dotted module path should work."""
		result = try_import("os.path", "join")
		assert result is not None
		import os.path
		assert result is os.path.join

	def test_import_returns_type_or_callable(self) -> None:
		"""The returned object should be the actual class/callable, not a wrapper."""
		result = try_import("pathlib", "Path")
		assert result is not None
		from pathlib import Path as StdPath
		assert result is StdPath
		# Verify it's actually usable
		p = result(".")
		assert isinstance(p, StdPath)

	def test_import_nonexistent_deeply_nested_module(self) -> None:
		"""A deeply nested non-existent module should return None gracefully."""
		result = try_import("a.b.c.d.e.f.g", "Nope")
		assert result is None

	def test_import_returns_none_not_raises(self) -> None:
		"""Regardless of the failure mode, try_import must never raise."""
		r1 = try_import("fake_module_never_installed", "FakeClass")
		r2 = try_import("json", "ThisDoesNotExist")
		assert r1 is None
		assert r2 is None

	def test_import_builtin_function(self) -> None:
		"""Should return non-class attributes (functions) from modules."""
		result = try_import("json", "dumps")
		assert result is not None
		import json
		assert result is json.dumps

	def test_import_constant_attribute(self) -> None:
		"""Should return module-level constants too."""
		result = try_import("sys", "maxsize")
		assert result is not None
		assert result == sys.maxsize
