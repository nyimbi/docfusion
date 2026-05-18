"""
Voice Integration

Integration layer connecting AI agents with the Voice DNA Engine
for consistent organizational voice and writing enhancement.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import logging
from typing import Any, Dict, Optional

try:
	from ...voice_dna import (
		VoiceIntegrator as BaseVoiceIntegrator,
		AnalysisRequest, AnalysisResult, AnalysisType
	)
	VOICE_DNA_AVAILABLE = True
except ImportError:
	VOICE_DNA_AVAILABLE = False
	# Create mock classes for development
	class BaseVoiceIntegrator:
		def __init__(self, config=None): pass
		async def analyze(self, request): return None
	
	class AnalysisRequest:
		def __init__(self, **kwargs): pass
	
	class AnalysisResult:
		def __init__(self, **kwargs): pass
	
	class AnalysisType:
		VALIDATION_ONLY = "validation_only"
		COMPREHENSIVE_ENHANCEMENT = "comprehensive_enhancement"


class VoiceIntegrator:
	"""
	Agent-integrated voice analysis and enhancement system
	
	Provides Voice DNA Engine integration for agents with
	caching, batch processing, and agent-specific contexts.
	"""
	
	def __init__(self, config: Optional[Dict[str, Any]] = None):
		self.config = config or {}
		
		if VOICE_DNA_AVAILABLE:
			self.voice_engine = BaseVoiceIntegrator(config)
		else:
			self.voice_engine = None
			
		self.analysis_cache: Dict[str, AnalysisResult] = {}
		self.organization_profiles: Dict[str, Dict[str, Any]] = {}
		
		self.logger = logging.getLogger("agent_voice_integrator")
		if not VOICE_DNA_AVAILABLE:
			self.logger.warning("Voice DNA Engine not available - running in mock mode")
	
	async def analyze_for_agent(self, agent_id: str, content: str, 
								organization: str, analysis_type: str = "comprehensive") -> Optional[AnalysisResult]:
		"""Perform voice analysis for specific agent context"""
		if not VOICE_DNA_AVAILABLE:
			self.logger.warning("Voice analysis requested but engine not available")
			return None
		
		try:
			# Create analysis request
			request = AnalysisRequest(
				analysis_type=getattr(AnalysisType, analysis_type.upper(), AnalysisType.COMPREHENSIVE_ENHANCEMENT),
				text_content=content,
				organization_name=organization,
				agent_context=agent_id
			)
			
			# Perform analysis
			result = await self.voice_engine.analyze(request)
			
			# Cache result
			cache_key = f"{agent_id}_{hash(content)}_{organization}"
			self.analysis_cache[cache_key] = result
			
			return result
			
		except Exception as e:
			self.logger.error(f"Voice analysis failed for agent {agent_id}: {e}")
			return None
	
	async def validate_content(self, content: str, organization: str) -> Dict[str, Any]:
		"""Simple content validation"""
		if not VOICE_DNA_AVAILABLE:
			return {"valid": True, "score": 0.8, "message": "Mock validation"}
		
		try:
			request = AnalysisRequest(
				analysis_type=AnalysisType.VALIDATION_ONLY,
				text_content=content,
				organization_name=organization
			)
			
			result = await self.voice_engine.analyze(request)
			
			return {
				"valid": result.overall_voice_score > 0.8 if result else True,
				"score": result.overall_voice_score if result else 0.8,
				"recommendations": result.key_recommendations if result else []
			}
			
		except Exception as e:
			self.logger.error(f"Content validation failed: {e}")
			return {"valid": False, "score": 0.0, "error": str(e)}
	
	async def enhance_writing(self, content: str, organization: str, 
							  intensity: float = 0.7) -> Dict[str, Any]:
		"""Enhance writing using voice engine"""
		if not VOICE_DNA_AVAILABLE:
			return {"enhanced_content": content, "improvements": []}
		
		try:
			request = AnalysisRequest(
				analysis_type=AnalysisType.COMPREHENSIVE_ENHANCEMENT,
				text_content=content,
				organization_name=organization,
				enhancement_intensity=intensity
			)
			
			result = await self.voice_engine.analyze(request)
			
			return {
				"enhanced_content": getattr(result, 'enhanced_content', content),
				"improvements": getattr(result, 'improvements', []),
				"quality_score": getattr(result, 'overall_voice_score', 0.8)
			}
			
		except Exception as e:
			self.logger.error(f"Writing enhancement failed: {e}")
			return {"enhanced_content": content, "improvements": [], "error": str(e)}