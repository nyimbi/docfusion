"""Test that BaseHealthCheck uses abc.ABC instead of NotImplementedError."""

from __future__ import annotations

import abc
import inspect

from docfusion.api.health.health_checks import BaseHealthCheck


def test_base_health_check_is_abstract():
	assert issubclass(BaseHealthCheck, abc.ABC)
	assert inspect.isabstract(BaseHealthCheck)
	assert "_perform_check" in BaseHealthCheck.__abstractmethods__
