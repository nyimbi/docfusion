"""
Specialized Agent Types

Task-specific agent implementations for the proposal generation system.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import logging
from importlib import import_module

logger = logging.getLogger(__name__)

# Import specialists with optional dependency handling
# This allows the agents package to be imported even when some
# specialist dependencies are not available

_specialists = {}

def _try_import(module_name: str, class_name: str) -> None:
	"""Try to import a specialist class, logging a warning if not available."""
	try:
		# Import from relative module path
		module = import_module(f".{module_name}", package=__name__)
		_specialists[class_name] = getattr(module, class_name, None)
	except ImportError as e:
		logger.debug(f"Specialist {class_name} not available: {e}")
	except Exception as e:
		logger.warning(f"Failed to import specialist {class_name}: {e}")

# Import all specialists
_try_import("research_agent", "ResearchAgent")
_try_import("writer_agent", "WriterAgent")
_try_import("reviewer_agent", "ReviewerAgent")
_try_import("coordinator_agent", "CoordinatorAgent")
_try_import("analysis_agent", "AnalysisAgent")
_try_import("quality_agent", "QualityAgent")
_try_import("editor_agent", "EditorAgent")
_try_import("layout_agent", "LayoutAgent")
_try_import("compliance_agent", "ComplianceAgent")

# Make specialists available at module level
ResearchAgent = _specialists.get("ResearchAgent")
WriterAgent = _specialists.get("WriterAgent")
ReviewerAgent = _specialists.get("ReviewerAgent")
CoordinatorAgent = _specialists.get("CoordinatorAgent")
AnalysisAgent = _specialists.get("AnalysisAgent")
QualityAgent = _specialists.get("QualityAgent")
EditorAgent = _specialists.get("EditorAgent")
LayoutAgent = _specialists.get("LayoutAgent")
ComplianceAgent = _specialists.get("ComplianceAgent")

# Export all available specialists
__all__ = [name for name, cls in _specialists.items() if cls is not None]