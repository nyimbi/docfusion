"""
Testing and Validation Framework for Discovery Engine

This module provides comprehensive testing capabilities for opportunity detection
accuracy, data quality validation, and system performance verification.
"""

from .accuracy_tester import AccuracyTester, TestConfig, TestResult, AccuracyMetrics
from .data_validator import DataValidator, ValidationConfig, ValidationResult, QualityMetrics
# from .performance_tester import PerformanceTester, PerformanceConfig, PerformanceResult  # TODO: implement

__all__ = [
	'AccuracyTester',
	'TestConfig',
	'TestResult',
	'AccuracyMetrics',
	'DataValidator',
	'ValidationConfig',
	'ValidationResult',
	'QualityMetrics',
	# 'PerformanceTester',
	# 'PerformanceConfig',
	# 'PerformanceResult',
]