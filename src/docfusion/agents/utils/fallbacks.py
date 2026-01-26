"""
Fallback class implementations for missing dependencies.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

from typing import Any, Dict, Optional


def create_fallback_classes():
	"""Create fallback classes for missing dependencies"""
	
	class MockVoiceIntegrator:
		def __init__(self, config: Optional[Dict[str, Any]] = None):
			self.config = config or {}
		
		async def analyze(self, request) -> Optional[Any]:
			return None
	
	class MockAnalysisRequest:
		def __init__(self, **kwargs):
			for k, v in kwargs.items():
				setattr(self, k, v)
	
	class MockIntelligenceResult:
		def __init__(self, **kwargs):
			for k, v in kwargs.items():
				setattr(self, k, v)
	
	class MockDocumentEngine:
		def __init__(self, config: Optional[Dict[str, Any]] = None):
			self.config = config or {}
		
		async def process_document(self, content: str) -> Dict[str, Any]:
			return {"processed": content}
	
	return {
		"VoiceIntegrator": MockVoiceIntegrator,
		"AnalysisRequest": MockAnalysisRequest, 
		"IntelligenceResult": MockIntelligenceResult,
		"DocumentEngine": MockDocumentEngine
	}