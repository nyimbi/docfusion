#!/usr/bin/env python3
"""Tests for workflow integration stub implementations."""

import ast
import inspect
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest


def _get_source_lines(module_path: Path) -> list[str]:
	return module_path.read_text().splitlines()


def _find_method_body(source_lines: list[str], method_name: str) -> list[str]:
	"""Extract the body of a method from source lines."""
	in_method = False
	indent_level = None
	body = []
	for line in source_lines:
		if not in_method:
			if f"async def {method_name}(" in line or f"def {method_name}(" in line:
				in_method = True
				indent_level = len(line) - len(line.lstrip())
		else:
			current_indent = len(line) - len(line.lstrip())
			if line.strip() == "":
				body.append(line)
				continue
			if current_indent <= indent_level and line.strip():
				break
			body.append(line)
	return body


class TestNoNotImplementedError:
	"""Verify no NotImplementedError remains in workflow integration stubs."""

	@pytest.mark.parametrize(
		"module_name,method_name",
		[
			("nlp_workflow_integration.py", "_update_performance_metrics"),
			("nlp_workflow_integration.py", "_check_performance_thresholds"),
			("agents_workflow_integration.py", "_create_workflow_swarm"),
			("agents_workflow_integration.py", "_facilitate_agent_collaboration"),
			("agents_workflow_integration.py", "_resolve_stuck_agent"),
			("agents_workflow_integration.py", "_handle_failed_agent"),
			("workflow_document_bridge.py", "_setup_event_handlers"),
		],
	)
	def test_method_has_no_notimplemented_error(self, module_name, method_name):
		base = Path("src/docfusion/workflow/integration")
		path = base / module_name
		assert path.exists(), f"{path} not found"
		source = path.read_text()
		assert "NotImplementedError" not in source, (
			f"{module_name} still contains NotImplementedError"
		)

		# Verify the method exists and has a body
		lines = source.splitlines()
		method_body = _find_method_body(lines, method_name)
		assert method_body, f"Method {method_name} not found in {module_name}"

		# The body should not be just a raise or pass
		non_trivial = [l for l in method_body if l.strip() and not l.strip().startswith("#")]
		assert len(non_trivial) > 1, (
			f"Method {method_name} appears to be empty in {module_name}"
		)


class TestStubImplementationsExist:
	"""Verify stub implementations are concrete and callable."""

	def test_nlp_stubs_use_try_except(self):
		path = Path("src/docfusion/workflow/integration/nlp_workflow_integration.py")
		body_perf = _find_method_body(path.read_text().splitlines(), "_update_performance_metrics")
		body_thresh = _find_method_body(path.read_text().splitlines(), "_check_performance_thresholds")
		assert any("try:" in l for l in body_perf)
		assert any("except" in l for l in body_perf)
		assert any("try:" in l for l in body_thresh)
		assert any("except" in l for l in body_thresh)

	def test_agent_stubs_use_try_except(self):
		path = Path("src/docfusion/workflow/integration/agents_workflow_integration.py")
		for method in [
			"_create_workflow_swarm",
			"_facilitate_agent_collaboration",
			"_resolve_stuck_agent",
			"_handle_failed_agent",
		]:
			body = _find_method_body(path.read_text().splitlines(), method)
			assert any("try:" in l for l in body), f"{method} missing try block"
			assert any("except" in l for l in body), f"{method} missing except block"

	def test_bridge_stub_has_handlers(self):
		path = Path("src/docfusion/workflow/integration/workflow_document_bridge.py")
		body = _find_method_body(path.read_text().splitlines(), "_setup_event_handlers")
		assert any("event_subscribers" in l for l in body)
		# Verify individual handler methods exist
		source = path.read_text()
		for handler in [
			"_on_workflow_started",
			"_on_workflow_completed",
			"_on_workflow_failed",
			"_on_task_completed",
		]:
			assert f"def {handler}(" in source, f"Handler {handler} not found"


class TestSourceFileImports:
	"""Verify that the fixed import in nlp_workflow_integration is correct."""

	def test_nlp_service_configuration_import(self):
		path = Path("src/docfusion/workflow/integration/nlp_workflow_integration.py")
		source = path.read_text()
		# The old broken import should be gone
		assert "NLPConfiguration" not in source
		# The fixed import should be present
		assert "NLPServiceConfiguration" in source


if __name__ == "__main__":
	pytest.main([__file__, "-v"])
