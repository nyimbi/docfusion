"""
Import utilities and fallbacks for agent system.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import uuid

# UUID generation with fallback
try:
	from uuid_extensions import uuid7str
except ImportError:
	def uuid7str() -> str:
		return str(uuid.uuid4())

# Voice DNA integration with fallbacks
def get_voice_integrator():
	"""Get VoiceIntegrator with fallback"""
	try:
		from ...voice_dna.integration import VoiceIntegrator
		return VoiceIntegrator
	except ImportError:
		class MockVoiceIntegrator:
			def __init__(self, config=None):
				self.config = config
			async def analyze(self, request):
				return None
		return MockVoiceIntegrator

def get_analysis_request():
	"""Get AnalysisRequest with fallback"""
	try:
		from ...voice_dna.integration import AnalysisRequest
		return AnalysisRequest
	except ImportError:
		class MockAnalysisRequest:
			def __init__(self, **kwargs):
				for k, v in kwargs.items():
					setattr(self, k, v)
		return MockAnalysisRequest

# Intelligence models with fallback
def get_intelligence_result():
	"""Get IntelligenceResult with fallback"""
	try:
		from ...intelligence.models.base_models import IntelligenceResult
		return IntelligenceResult
	except ImportError:
		class MockIntelligenceResult:
			def __init__(self, **kwargs):
				for k, v in kwargs.items():
					setattr(self, k, v)
		return MockIntelligenceResult
