import asyncio
import logging
from typing import Any, Dict, List, Optional, Set, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from ..core.agent import Agent, AgentConfig, AgentCapabilities, AgentState
from ..core.roles import AgentRole, get_role_definition
from ..core.messages import AgentMessage, MessageType, MessageTemplates
import re
"""
Quality Agent

Specialized agent for quality assurance, voice consistency validation,
and content optimization using the Voice DNA Engine.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

from ...voice_dna import (
	VoiceIntegrator, AnalysisRequest, AnalysisType,
	WritingEnhancer, ContentQualityAnalyzer, StyleGuideCompliance,
	enhance_writing, analyze_content_quality, check_style_compliance
)

# Import additional classes needed for compliance and enhancement requests
try:
	from ...voice_dna.compliance_module import ComplianceRequest
	from ...voice_dna.enhancement_module import EnhancementRequest
except ImportError:
	# Create simple fallback classes if the modules don't exist
	@dataclass
	class ComplianceRequest:
		text_content: str
		content_context: str
		style_guide_name: str
		voice_profile: Optional[Any] = None
		style_profile: Optional[Any] = None
		requested_by: str = "quality_agent"
	
	@dataclass
	class EnhancementRequest:
		text: str
		enhancement_intensity: float = 0.7
		preserve_original_voice: bool = True


@dataclass
class QualityTask:
	"""Quality assurance task specification"""
	task_id: str
	content: str
	quality_type: str  # "voice_consistency", "content_quality", "style_compliance", "comprehensive"
	organization_profile: str
	quality_standards: Dict[str, float]
	improvement_level: str = "moderate"


@dataclass
class QualityResult:
	"""Quality assurance result"""
	task_id: str
	quality_type: str
	quality_scores: Dict[str, float]
	voice_analysis: Dict[str, Any]
	enhancement_suggestions: List[Dict[str, Any]]
	improved_content: Dict[str, str]
	compliance_status: Dict[str, Any]
	overall_quality_grade: str
	certification: bool


class QualityAgent(Agent[QualityTask]):
	"""
	Specialized quality assurance agent using Voice DNA Engine
	
	Capabilities:
	- Voice consistency validation and improvement
	- Content quality analysis and enhancement
	- Style guide compliance checking
	- Automated content optimization
	- Quality certification and scoring
	- Brand voice alignment verification
	"""
	
	def __init__(self, config: Optional[AgentConfig] = None):
		if config is None:
			config = self._create_default_config()
		
		super().__init__(config)
		
		# Voice DNA components
		self.voice_integrator = VoiceIntegrator()
		self.writing_enhancer = WritingEnhancer()
		self.quality_analyzer = ContentQualityAnalyzer()
		self.compliance_checker = StyleGuideCompliance()
		
		# Quality standards
		self.quality_thresholds = {
			"voice_consistency": {"minimum": 0.85, "target": 0.95, "excellent": 0.98},
			"readability": {"minimum": 0.8, "target": 0.9, "excellent": 0.95},
			"engagement": {"minimum": 0.75, "target": 0.85, "excellent": 0.92},
			"compliance": {"minimum": 0.9, "target": 0.95, "excellent": 0.99},
			"human_likeness": {"minimum": 0.8, "target": 0.9, "excellent": 0.95}
		}
		
		self._setup_quality_goals()
		
		self.logger.info(f"Quality Agent {self.name} initialized with Voice DNA Engine")
	
	def _create_default_config(self) -> AgentConfig:
		"""Create default configuration for quality agent"""
		role_def = get_role_definition(AgentRole.QUALITY_ASSURER)
		
		return AgentConfig(
			name="Quality Assurance Specialist",
			description="Content quality and voice consistency specialist",
			primary_role="quality_assurer",
			capabilities=AgentCapabilities(
				max_concurrent_tasks=3,
				expertise_domains=["quality_assurance", "voice_consistency", "content_review"],
				supported_task_types=["quality_check", "voice_validation", "content_enhancement"],
				quality_threshold=0.95
			),
			personality_traits={
				"perfectionism": 0.95,
				"attention_to_detail": 0.98,
				"consistency": 0.95,
				"objectivity": 0.9
			},
			creativity_level=0.3,
			risk_tolerance=0.1,
			voice_analysis_enabled=True,
			# LLM configuration optimized for quality assessment
			llm_model="qwen2.5:1.5b", 
			llm_temperature=0.2,  # Very low temperature for consistent quality assessment
			llm_max_tokens=2048
		)
	
	def _setup_quality_goals(self) -> None:
		"""Set up quality-specific goals"""
		self.set_goal("quality_consistency", "Maintain consistent quality standards", 0.98)
		self.set_goal("voice_alignment", "Ensure perfect voice alignment", 0.95)
		self.set_goal("content_improvement", "Provide valuable content improvements", 0.9)
		self.set_goal("certification_accuracy", "Accurate quality certification", 0.95)
	
	async def process_task(self, task: QualityTask) -> QualityResult:
		"""Process a quality assurance task"""
		self.logger.info(f"Processing quality task: {task.quality_type}")
		
		try:
			if task.quality_type == "comprehensive":
				result = await self._comprehensive_quality_check(task)
			elif task.quality_type == "voice_consistency":
				result = await self._voice_consistency_check(task)
			elif task.quality_type == "content_quality":
				result = await self._content_quality_check(task)
			elif task.quality_type == "style_compliance":
				result = await self._style_compliance_check(task)
			else:
				result = await self._basic_quality_check(task)
			
			self.logger.info(f"Quality check completed: {result.overall_quality_grade}")
			return result
			
		except Exception as e:
			self.logger.error(f"Quality task failed: {e}")
			raise
	
	async def handle_message(self, message: AgentMessage) -> Optional[AgentMessage]:
		"""Handle incoming messages"""
		if message.header.message_type == MessageType.TASK_REQUEST:
			return await self._handle_quality_request(message)
		return None
	
	def get_capabilities(self) -> List[str]:
		"""Return quality agent capabilities"""
		return [
			"voice_consistency_validation",
			"content_quality_analysis",
			"style_guide_compliance",
			"automated_content_enhancement",
			"quality_certification",
			"brand_voice_alignment",
			"readability_optimization",
			"engagement_improvement"
		]
	
	async def evaluate_task_fit(self, task: QualityTask) -> float:
		"""Evaluate task fit"""
		if not isinstance(task, QualityTask):
			return 0.0
		
		# Quality tasks are our specialty
		return 0.95
	
	# Quality check implementations
	
	async def _comprehensive_quality_check(self, task: QualityTask) -> QualityResult:
		"""Conduct comprehensive quality analysis using all Voice DNA tools"""
		self.logger.info("Conducting comprehensive quality analysis")
		
		# 1. Voice consistency analysis
		voice_request = AnalysisRequest(
			analysis_type=AnalysisType.COMPREHENSIVE_ENHANCEMENT,
			text_content=task.content,
			organization_name=task.organization_profile,
			enhancement_intensity=0.8
		)
		voice_result = await self.voice_integrator.analyze(voice_request)
		
		# 2. Content quality analysis
		quality_result = await self.quality_analyzer.analyze_content_quality(
			text=task.content,
			target_audience="professional",
			content_type="proposal"
		)
		
		# 3. Style compliance check
		compliance_result = await self.compliance_checker.check_compliance(
			ComplianceRequest(
				text_content=task.content,
				content_context="proposal_generation",
				style_guide_name="corporate",
				voice_profile=None,
				style_profile=None,
				requested_by="quality_agent"
			)
		)
		
		# 4. Content enhancement
		enhancement_result = await self.writing_enhancer.enhance_writing(
			EnhancementRequest(
				text=task.content,
				enhancement_intensity=0.7,
				preserve_original_voice=True
			)
		)
		
		# Compile quality scores
		quality_scores = {
			"voice_consistency": voice_result.consistency_score if voice_result else 0.85,
			"overall_quality": quality_result.overall_quality_score if quality_result else 0.8,
			"readability": quality_result.readability_metrics.overall_readability if quality_result and quality_result.readability_metrics else 0.8,
			"engagement": quality_result.engagement_metrics.overall_engagement if quality_result and quality_result.engagement_metrics else 0.75,
			"human_likeness": quality_result.human_likeness_metrics.overall_human_likeness if quality_result and quality_result.human_likeness_metrics else 0.8,
			"compliance": compliance_result.overall_compliance_score if compliance_result else 0.9
		}
		
		# Generate overall grade
		overall_score = sum(quality_scores.values()) / len(quality_scores)
		overall_grade = self._calculate_quality_grade(overall_score)
		
		# Check certification
		certified = self._check_certification_criteria(quality_scores, task.quality_standards)
		
		# Compile voice analysis
		voice_analysis = {
			"consistency_score": voice_result.consistency_score if voice_result else 0.85,
			"authenticity_score": voice_result.authenticity_score if voice_result else 0.8,
			"recommendations": voice_result.key_recommendations if voice_result else []
		}
		
		# Generate enhancement suggestions
		enhancement_suggestions = self._generate_enhancement_suggestions(
			quality_scores, voice_result, quality_result, compliance_result
		)
		
		# Create improved content versions
		improved_content = {
			"original": task.content,
			"enhanced": enhancement_result.enhanced_text if enhancement_result else task.content,
			"voice_optimized": voice_result.enhanced_versions.get("conservative", task.content) if voice_result and hasattr(voice_result, 'enhanced_versions') else task.content
		}
		
		# Compliance status
		compliance_status = {
			"overall_score": compliance_result.overall_compliance_score if compliance_result else 0.9,
			"violations_count": len(compliance_result.violations) if compliance_result else 0,
			"certification_ready": compliance_result.overall_compliance_score >= 0.9 if compliance_result else True
		}
		
		return QualityResult(
			task_id=task.task_id,
			quality_type=task.quality_type,
			quality_scores=quality_scores,
			voice_analysis=voice_analysis,
			enhancement_suggestions=enhancement_suggestions,
			improved_content=improved_content,
			compliance_status=compliance_status,
			overall_quality_grade=overall_grade,
			certification=certified
		)
	
	async def _voice_consistency_check(self, task: QualityTask) -> QualityResult:
		"""Focus on voice consistency validation"""
		voice_request = AnalysisRequest(
			analysis_type=AnalysisType.VALIDATION_ONLY,
			text_content=task.content,
			organization_name=task.organization_profile
		)
		
		voice_result = await self.voice_integrator.analyze(voice_request)
		
		quality_scores = {
			"voice_consistency": voice_result.consistency_score,
			"authenticity": voice_result.authenticity_score
		}
		
		overall_grade = self._calculate_quality_grade(voice_result.overall_voice_score)
		certified = voice_result.overall_voice_score >= self.quality_thresholds["voice_consistency"]["minimum"]
		
		return QualityResult(
			task_id=task.task_id,
			quality_type=task.quality_type,
			quality_scores=quality_scores,
			voice_analysis={"consistency_score": voice_result.consistency_score},
			enhancement_suggestions=[],
			improved_content={"original": task.content},
			compliance_status={},
			overall_quality_grade=overall_grade,
			certification=certified
		)
	
	async def _content_quality_check(self, task: QualityTask) -> QualityResult:
		"""Focus on content quality analysis"""
		quality_result = await self.quality_analyzer.analyze_content_quality(
			text=task.content,
			target_audience="professional"
		)
		
		quality_scores = {
			"overall_quality": quality_result.overall_quality_score,
			"readability": quality_result.readability_metrics.overall_readability if quality_result.readability_metrics else 0.8,
			"engagement": quality_result.engagement_metrics.overall_engagement if quality_result.engagement_metrics else 0.75
		}
		
		overall_score = sum(quality_scores.values()) / len(quality_scores)
		overall_grade = self._calculate_quality_grade(overall_score)
		certified = overall_score >= 0.8
		
		return QualityResult(
			task_id=task.task_id,
			quality_type=task.quality_type,
			quality_scores=quality_scores,
			voice_analysis={},
			enhancement_suggestions=quality_result.improvement_recommendations or [],
			improved_content={"original": task.content},
			compliance_status={},
			overall_quality_grade=overall_grade,
			certification=certified
		)
	
	async def _style_compliance_check(self, task: QualityTask) -> QualityResult:
		"""Focus on style guide compliance"""
		compliance_result = await self.compliance_checker.check_compliance(
			ComplianceRequest(
				text_content=task.content,
				content_context="quality_check",
				style_guide_name="corporate",
				voice_profile=None,
				style_profile=None,
				requested_by="quality_agent"
			)
		)
		
		quality_scores = {
			"compliance": compliance_result.overall_compliance_score,
			"voice_alignment": compliance_result.voice_alignment_score,
			"style_consistency": compliance_result.style_consistency_score
		}
		
		overall_score = compliance_result.overall_compliance_score
		overall_grade = self._calculate_quality_grade(overall_score)
		certified = overall_score >= self.quality_thresholds["compliance"]["minimum"]
		
		compliance_status = {
			"overall_score": compliance_result.overall_compliance_score,
			"violations_count": len(compliance_result.violations),
			"violations": [v.__dict__ for v in compliance_result.violations] if compliance_result.violations else []
		}
		
		return QualityResult(
			task_id=task.task_id,
			quality_type=task.quality_type,
			quality_scores=quality_scores,
			voice_analysis={},
			enhancement_suggestions=compliance_result.improvement_suggestions or [],
			improved_content={"original": task.content},
			compliance_status=compliance_status,
			overall_quality_grade=overall_grade,
			certification=certified
		)
	
	async def _basic_quality_check(self, task: QualityTask) -> QualityResult:
		"""Basic quality assessment"""
		# Simple quality metrics
		word_count = len(task.content.split())
		sentence_count = len(task.content.split('.'))
		avg_sentence_length = word_count / max(sentence_count, 1)
		
		quality_scores = {
			"readability": max(0.0, min(1.0, 1.0 - (avg_sentence_length - 20) / 30)),
			"completeness": min(1.0, word_count / 500),  # Assume 500 words is complete
			"structure": 0.8 if '#' in task.content or '•' in task.content else 0.6
		}
		
		overall_score = sum(quality_scores.values()) / len(quality_scores)
		overall_grade = self._calculate_quality_grade(overall_score)
		certified = overall_score >= 0.7
		
		return QualityResult(
			task_id=task.task_id,
			quality_type=task.quality_type,
			quality_scores=quality_scores,
			voice_analysis={},
			enhancement_suggestions=[{"suggestion": "Consider professional quality analysis"}],
			improved_content={"original": task.content},
			compliance_status={},
			overall_quality_grade=overall_grade,
			certification=certified
		)
	
	# Helper methods
	
	def _calculate_quality_grade(self, score: float) -> str:
		"""Calculate quality grade from score"""
		if score >= 0.95:
			return "A+"
		elif score >= 0.9:
			return "A"
		elif score >= 0.85:
			return "B+"
		elif score >= 0.8:
			return "B"
		elif score >= 0.7:
			return "C"
		else:
			return "D"
	
	def _check_certification_criteria(self, quality_scores: Dict[str, float], 
									 standards: Dict[str, float]) -> bool:
		"""Check if content meets certification criteria"""
		for metric, score in quality_scores.items():
			threshold = standards.get(metric, self.quality_thresholds.get(metric, {}).get("minimum", 0.8))
			if score < threshold:
				return False
		return True
	
	def _generate_enhancement_suggestions(self, quality_scores: Dict[str, float], 
										voice_result: Any, quality_result: Any,
										compliance_result: Any) -> List[Dict[str, Any]]:
		"""Generate enhancement suggestions based on analysis results"""
		suggestions = []
		
		# Voice consistency suggestions
		if quality_scores.get("voice_consistency", 1.0) < self.quality_thresholds["voice_consistency"]["target"]:
			suggestions.append({
				"category": "voice_consistency",
				"priority": "high",
				"description": "Improve consistency with brand voice guidelines",
				"impact": "Ensures brand alignment and professional presentation"
			})
		
		# Readability suggestions
		if quality_scores.get("readability", 1.0) < self.quality_thresholds["readability"]["target"]:
			suggestions.append({
				"category": "readability",
				"priority": "medium",
				"description": "Simplify sentence structure and improve clarity",
				"impact": "Enhances reader comprehension and engagement"
			})
		
		# Engagement suggestions
		if quality_scores.get("engagement", 1.0) < self.quality_thresholds["engagement"]["target"]:
			suggestions.append({
				"category": "engagement",
				"priority": "medium",
				"description": "Add more compelling language and value propositions",
				"impact": "Increases reader interest and response rates"
			})
		
		# Compliance suggestions
		if quality_scores.get("compliance", 1.0) < self.quality_thresholds["compliance"]["target"]:
			suggestions.append({
				"category": "compliance",
				"priority": "high",
				"description": "Address style guide compliance issues",
				"impact": "Ensures adherence to organizational standards"
			})
		
		return suggestions
	
	async def _handle_quality_request(self, message: AgentMessage) -> AgentMessage:
		"""Handle quality assurance request"""
		try:
			task_data = message.payload.content
			
			quality_task = QualityTask(
				task_id=message.header.message_id,
				content=task_data.get("content", ""),
				quality_type=task_data.get("quality_type", "comprehensive"),
				organization_profile=task_data.get("organization_profile", "default"),
				quality_standards=task_data.get("quality_standards", {}),
				improvement_level=task_data.get("improvement_level", "moderate")
			)
			
			result = await self.process_task(quality_task)
			
			return MessageTemplates.task_response(
				sender_id=self.agent_id,
				recipient_id=message.header.sender_id,
				result=result.__dict__,
				original_message_id=message.header.message_id
			)
			
		except Exception as e:
			return MessageTemplates.error_report(
				sender_id=self.agent_id,
				recipient_id=message.header.sender_id,
				error_info={"error": str(e)}
			)
	
	# Public interface methods
	
	async def certify_content_quality(self, content: str, organization_profile: str,
									 quality_standards: Dict[str, float] = field(default_factory=dict)) -> QualityResult:
		"""Public method for content quality certification"""
		task = QualityTask(
			task_id=f"certification_{hash(content)}",
			content=content,
			quality_type="comprehensive",
			organization_profile=organization_profile,
			quality_standards=quality_standards or {}
		)
		
		return await self.process_task(task)
	
	async def validate_voice_consistency(self, content: str, organization_profile: str) -> QualityResult:
		"""Public method for voice consistency validation"""
		task = QualityTask(
			task_id=f"voice_validation_{hash(content)}",
			content=content,
			quality_type="voice_consistency",
			organization_profile=organization_profile,
			quality_standards={}
		)
		
		return await self.process_task(task)
	
	def get_quality_standards(self) -> Dict[str, Dict[str, float]]:
		"""Get current quality standards and thresholds"""
		return self.quality_thresholds.copy()