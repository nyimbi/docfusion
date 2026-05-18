"""Utilities for handling optional module imports in the agents system.

Provides a safe, consistent mechanism for importing optional dependencies
with proper logging and None-based fallback semantics. This eliminates
the need for inline stub classes scattered across the codebase.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import logging
from importlib import import_module

logger = logging.getLogger(__name__)


def try_import(module_path: str, class_name: str) -> type | None:
	"""Attempt to import a class from a module, returning None if unavailable.

	Uses importlib to dynamically resolve the module path and extract the
	requested class. On ImportError the failure is logged at INFO level
	(expected for optional dependencies). A missing attribute in an
	otherwise-importable module is logged at WARNING level (likely a
	version mismatch or API change).

	Args:
		module_path: Dotted module path (e.g., 'docfusion.intelligence.models.base_models')
		class_name: Name of the class to import

	Returns:
		The imported class, or None if the module is not available.
	"""
	try:
		module = import_module(module_path)
		cls = getattr(module, class_name, None)
		if cls is None:
			logger.warning(f"Class {class_name} not found in {module_path}")
		return cls
	except ImportError as e:
		logger.info(f"Optional module not available: {module_path}.{class_name} ({e})")
		return None
