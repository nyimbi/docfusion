"""
API Package

FastAPI-based REST API for the proposal writer system with comprehensive
endpoints, middleware, validation, and documentation.
"""

__version__ = "1.0.0"
__author__ = "Proposal Writer Team"

def __getattr__(name: str):
	"""Lazy app export so endpoint imports do not initialize the full API."""
	if name == "app":
		from .app import app

		return app
	raise AttributeError(name)


__all__ = ["app"]
