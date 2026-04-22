"""
Performance Dashboard for Discovery Engine

This module provides a comprehensive dashboard for monitoring
scraper performance, deployment health, and data quality metrics.
"""

from .performance_dashboard import PerformanceDashboard, DashboardConfig, DashboardMetrics
# from .dashboard_server import DashboardServer, create_dashboard_server

__all__ = [
	'PerformanceDashboard',
	'DashboardConfig',
	'DashboardMetrics',
	# 'DashboardServer',
	# 'create_dashboard_server',
]