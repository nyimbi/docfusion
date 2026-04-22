"""Tests for docfusion.core.errors."""

import pytest

from docfusion.core.errors import PendingImplementationError


def test_pending_implementation_requires_task_id():
	with pytest.raises(ValueError, match="task ID"):
		raise PendingImplementationError("no ticket referenced")


def test_pending_implementation_accepts_task_reference():
	with pytest.raises(PendingImplementationError):
		raise PendingImplementationError("See task-042: example")
