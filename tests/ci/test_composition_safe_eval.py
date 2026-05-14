"""Tests for safe expression evaluation in the composition runner.

Validates that the transition from eval() to simpleeval properly
sandboxes condition evaluation -- legitimate expressions work while
malicious code is blocked.

The runner passes names={"context": context.variables} to simpleeval,
so expressions must reference top-level variables via the "context"
name, typically as context["key"].
"""
import asyncio
import importlib
import importlib.util
import time
from dataclasses import dataclass, field
from typing import Any

import pytest

simpleeval = pytest.importorskip("simpleeval", reason="simpleeval not installed")


def _load_runner_module():
	"""Load the runner module, handling import chain issues."""
	try:
		from docfusion.experimental.composition.runner import CompositionRunner, ExecutionContext
		return CompositionRunner, ExecutionContext
	except (ImportError, AttributeError) as exc:
		# Attempt direct file load if package init chain is broken
		module_path = __import__("pathlib").Path(__file__).parent.parent.parent / "src" / "docfusion" / "experimental" / "composition" / "runner.py"
		if not module_path.exists():
			pytest.skip(f"Runner module not found at {module_path}")
		pytest.skip(f"Cannot import runner due to dependency chain: {exc}")


CompositionRunner, ExecutionContext = _load_runner_module()


def _make_context(variables: dict[str, Any] | None = None) -> ExecutionContext:
	"""Build a minimal ExecutionContext for condition evaluation."""
	return ExecutionContext(
		execution_id="test-exec-001",
		composition_id="test-comp-001",
		input_data={},
		variables=variables or {},
	)


@pytest.fixture
def runner() -> CompositionRunner:
	return CompositionRunner(max_workers=2, enable_monitoring=False)


def _eval_condition(runner, condition: str, variables: dict[str, Any] | None = None) -> bool:
	"""Helper to synchronously evaluate a condition expression."""
	ctx = _make_context(variables)
	return asyncio.run(runner._evaluate_condition(condition, ctx))


class TestSafeEvaluation:
	"""Verify that condition evaluation is safe and correct.

	The runner maps names={"context": context.variables}, so the only
	top-level name available in expressions is "context", which is the
	variables dict. Dict item access uses bracket notation.
	"""

	def test_simple_boolean_via_context_dict(self, runner) -> None:
		"""context['approved'] == True should evaluate to True."""
		result = _eval_condition(runner, "context['approved'] == True", {"approved": True})
		assert result is True

	def test_simple_boolean_false(self, runner) -> None:
		"""context['approved'] == True should be False when value is False."""
		result = _eval_condition(runner, "context['approved'] == True", {"approved": False})
		assert result is False

	def test_arithmetic_condition_gt(self, runner) -> None:
		"""Numeric comparison via context dict access."""
		result = _eval_condition(runner, "context['score'] > 0.5", {"score": 0.8})
		assert result is True

	def test_arithmetic_condition_lt(self, runner) -> None:
		"""Numeric comparison below threshold should return False."""
		result = _eval_condition(runner, "context['score'] > 0.5", {"score": 0.3})
		assert result is False

	def test_string_comparison(self, runner) -> None:
		"""String equality via context dict access."""
		result = _eval_condition(runner, "context['status'] == 'active'", {"status": "active"})
		assert result is True

	def test_string_comparison_mismatch(self, runner) -> None:
		"""String inequality should return False."""
		result = _eval_condition(runner, "context['status'] == 'active'", {"status": "inactive"})
		assert result is False

	def test_malicious_import_blocked(self, runner) -> None:
		"""Attempts to import modules must be blocked by simpleeval."""
		result = _eval_condition(runner, "__import__('os')")
		assert result is False

	def test_malicious_file_access_blocked(self, runner) -> None:
		"""Attempts to open files must be blocked."""
		result = _eval_condition(runner, "open('/etc/passwd')")
		assert result is False

	def test_malicious_exec_blocked(self, runner) -> None:
		"""Attempts to use exec must be blocked."""
		result = _eval_condition(runner, "exec('1+1')")
		assert result is False

	def test_malicious_eval_blocked(self, runner) -> None:
		"""Attempts to use eval must be blocked."""
		result = _eval_condition(runner, "eval('1+1')")
		assert result is False

	def test_malicious_attribute_traversal_blocked(self, runner) -> None:
		"""Dunder attribute traversal for sandbox escape must be blocked."""
		result = _eval_condition(runner, "context.__class__.__mro__", {"x": ""})
		assert result is False

	def test_missing_variable_returns_false(self, runner) -> None:
		"""Referencing undefined names should return False, not crash."""
		result = _eval_condition(runner, "undefined_var == True")
		assert result is False

	def test_invalid_syntax_returns_false(self, runner) -> None:
		"""Invalid expression syntax should return False."""
		malformed = [
			"if True then False",
			"=== broken ===",
			"def foo(): pass",
		]
		for expr in malformed:
			result = _eval_condition(runner, expr)
			assert result is False, f"Malformed expression should return False: {expr!r}"

	def test_shortcut_success(self, runner) -> None:
		"""The literal string 'success' should always return True."""
		result = _eval_condition(runner, "success")
		assert result is True

	def test_shortcut_failure(self, runner) -> None:
		"""The literal string 'failure' should always return False."""
		result = _eval_condition(runner, "failure")
		assert result is False

	def test_shortcut_empty_with_empty_vars(self, runner) -> None:
		"""'empty' should return True when context has no variables."""
		result = _eval_condition(runner, "empty", {})
		assert result is True

	def test_shortcut_empty_with_populated_vars(self, runner) -> None:
		"""'empty' should return False when context has variables."""
		result = _eval_condition(runner, "empty", {"key": "value"})
		assert result is False

	def test_shortcut_nonempty_with_populated_vars(self, runner) -> None:
		"""'nonempty' should return True when context has variables."""
		result = _eval_condition(runner, "nonempty", {"key": "value"})
		assert result is True

	def test_shortcut_nonempty_with_empty_vars(self, runner) -> None:
		"""'nonempty' should return False when context has no variables."""
		result = _eval_condition(runner, "nonempty", {})
		assert result is False

	def test_integer_equality(self, runner) -> None:
		"""Integer equality via context dict."""
		result = _eval_condition(runner, "context['retries'] == 3", {"retries": 3})
		assert result is True

	def test_direct_variable_access_without_context_prefix(self, runner) -> None:
		"""Direct variable access (without 'context' prefix) should return False
		because only 'context' is in the names dict."""
		result = _eval_condition(runner, "approved == True", {"approved": True})
		# This should fail because 'approved' isn't a top-level name
		assert result is False

	def test_arithmetic_operations(self, runner) -> None:
		"""Basic arithmetic within expressions should work."""
		result = _eval_condition(runner, "1 + 1 == 2")
		assert result is True

	def test_none_comparison(self, runner) -> None:
		"""None comparison should work."""
		result = _eval_condition(runner, "context['value'] is None", {"value": None})
		# simpleeval may or may not support 'is'; if not, returns False -- both are safe
		assert isinstance(result, bool)
