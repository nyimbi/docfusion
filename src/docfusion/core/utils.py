"""
Core Utilities

Centralized utility functions shared across the docfusion package.
These are low-level helpers with no dependencies on higher-level modules.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import uuid

try:
	from uuid_extensions import uuid7str
except ImportError:
	def uuid7str() -> str:
		"""Generate a UUID string (falls back to UUID4 when uuid_extensions is unavailable)."""
		return str(uuid.uuid4())

__all__ = ["uuid7str"]