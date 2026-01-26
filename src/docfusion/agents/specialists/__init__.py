"""
Specialized Agent Types

Task-specific agent implementations for the proposal generation system.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

from .research_agent import ResearchAgent
from .writer_agent import WriterAgent
from .reviewer_agent import ReviewerAgent
from .coordinator_agent import CoordinatorAgent
from .analysis_agent import AnalysisAgent
from .quality_agent import QualityAgent
from .editor_agent import EditorAgent
from .layout_agent import LayoutAgent

__all__ = [
	"ResearchAgent",
	"WriterAgent", 
	"ReviewerAgent",
	"CoordinatorAgent",
	"AnalysisAgent",
	"QualityAgent",
	"EditorAgent",
	"LayoutAgent"
]