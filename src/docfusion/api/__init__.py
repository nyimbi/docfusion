"""
API Package

FastAPI-based REST API for the proposal writer system with comprehensive
endpoints, middleware, validation, and documentation.
"""

__version__ = "1.0.0"
__author__ = "Proposal Writer Team"

# Import minimal app for now - full API has import issues to be fixed
from .app import app

__all__ = ["app"]