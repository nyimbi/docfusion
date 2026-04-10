"""
Reviewer Agent

Specialized agent for content review, quality assurance, and improvement
recommendations with voice consistency and compliance validation.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import logging
import re
from typing import Any, Dict, List, Optional, Set, Union
from datetime import datetime, timedelta
from dataclasses import dataclass

from ..core.agent import Agent, AgentConfig, AgentCapabilities, AgentState
from ..core.roles import AgentRole, get_role_definition
from ..core.messages import AgentMessage, MessageType, MessageTemplates

from ...voice_dna import VoiceIntegrator, AnalysisType, enhance_writing, analyze_content_quality


@dataclass
class ReviewTask:
	"""Review task specification"""
	task_id: str
	content: str
	review_type: str  # "quality", "compliance", "voice", "technical", "comprehensive"
	criteria: Dict[str, Any]
	standards: Dict[str, float]
	original_requirements: Optional[Dict[str, Any]] = None


@dataclass
class ReviewResult:
	"""Review task result"""
	task_id: str
	review_type: str
	overall_score: float
	quality_scores: Dict[str, float]
	compliance_issues: List[Dict[str, Any]]
	improvement_suggestions: List[Dict[str, Any]]
	approved: bool
	confidence_level: float
	detailed_feedback: Dict[str, Any]


class ReviewerAgent(Agent[ReviewTask]):
	"""
	Specialized reviewer agent for quality assurance and content improvement
	
	Capabilities:
	- Content quality assessment
	- Voice consistency validation
	- Style guide compliance checking
	- Technical accuracy review
	- Improvement recommendations
	- Approval/rejection decisions
	"""
	
	def __init__(self, config: Optional[AgentConfig] = None):
		if config is None:
			config = self._create_default_config()
		
		super().__init__(config)
		
		# Review-specific components
		self.review_standards = {
			"quality": {"minimum": 0.8, "target": 0.9},
			"readability": {"minimum": 0.7, "target": 0.85},
			"voice_consistency": {"minimum": 0.85, "target": 0.95},
			"compliance": {"minimum": 0.9, "target": 0.98},
			"engagement": {"minimum": 0.7, "target": 0.85}
		}
		
		self.review_types = {
			"quality", "compliance", "voice", "technical", "comprehensive", "final"
		}
		
		self._setup_reviewer_goals()
		
		self.logger.info(f"Reviewer Agent {self.name} initialized")
	
	def _create_default_config(self) -> AgentConfig:
		"""Create default configuration for reviewer agent"""
		role_def = get_role_definition(AgentRole.REVIEWER)
		
		return AgentConfig(
			name="Quality Reviewer",
			description="Content quality assurance and review specialist",
			primary_role="reviewer",
			capabilities=AgentCapabilities(
				max_concurrent_tasks=4,
				expertise_domains=["content_review", "quality_assessment", "editorial_feedback"],
				supported_task_types=["review", "feedback", "quality_assessment", "editing"],
				quality_threshold=0.9
			),
			personality_traits={
				"attention_to_detail": 0.98,
				"objectivity": 0.95,
				"thoroughness": 0.95,
				"critical_thinking": 0.9
			},
			creativity_level=0.4,
			risk_tolerance=0.2,
			voice_analysis_enabled=True,
			# LLM configuration optimized for objective review
			llm_model="qwen2.5:1.5b",
			llm_temperature=0.3,  # Low temperature for objective analysis
			llm_max_tokens=3072
		)
	
	def _setup_reviewer_goals(self) -> None:
		"""Set up reviewer-specific goals"""
		self.set_goal("review_accuracy", "Maintain high accuracy in reviews", 0.95)
		self.set_goal("quality_standards", "Enforce quality standards consistently", 0.98)
		self.set_goal("improvement_value", "Provide valuable improvement suggestions", 0.9)
		self.set_goal("review_efficiency", "Complete reviews efficiently", 0.85)
	
	async def process_task(self, task: ReviewTask) -> ReviewResult:
		"""Process a review task"""
		self.logger.info(f"Processing review task: {task.review_type}")
		
		try:
			if task.review_type == "comprehensive":
				result = await self._comprehensive_review(task)
			elif task.review_type == "quality":
				result = await self._quality_review(task)
			elif task.review_type == "voice":
				result = await self._voice_review(task)
			elif task.review_type == "compliance":
				result = await self._compliance_review(task)
			else:
				result = await self._general_review(task)
			
			await self._update_review_metrics(task, result)
			
			self.logger.info(f"Review completed with score: {result.overall_score:.2f}")
			return result
			
		except Exception as e:
			self.logger.error(f"Review task failed: {e}")
			raise
	
	async def handle_message(self, message: AgentMessage) -> Optional[AgentMessage]:
		"""Handle incoming messages"""
		message_type = message.header.message_type
		
		if message_type == MessageType.TASK_REQUEST:
			return await self._handle_review_request(message)
		elif message_type == MessageType.STATUS_REQUEST:
			return await self._handle_status_request(message)
		else:
			return None
	
	def get_capabilities(self) -> List[str]:
		"""Return reviewer agent capabilities"""
		return [
			"content_review",
			"quality_assessment",
			"voice_validation", 
			"compliance_checking",
			"technical_review",
			"improvement_recommendations",
			"approval_decisions"
		]
	
	async def evaluate_task_fit(self, task: ReviewTask) -> float:
		"""Evaluate how well this agent fits a review task"""
		if not isinstance(task, ReviewTask):
			return 0.0
		
		base_fit = 0.9
		
		if task.review_type in self.review_types:
			base_fit *= 1.0
		else:
			base_fit *= 0.7
		
		return base_fit
	
	# Review method implementations
	
	async def _comprehensive_review(self, task: ReviewTask) -> ReviewResult:
		"""Conduct comprehensive review covering all aspects"""
		self.logger.info("Conducting comprehensive review")
		
		# Quality assessment
		if self.voice_integrator:
			quality_request = analyze_content_quality(
				text=task.content,
				organization="review_org"
			)
			quality_result = await self.voice_integrator.analyze(quality_request)
			quality_scores = {
				"overall": quality_result.quality_analysis.overall_quality_score if quality_result.quality_analysis else 0.8,
				"readability": 0.85,
				"clarity": 0.8,
				"structure": 0.9
			}
		else:
			quality_scores = self._basic_quality_assessment(task.content)
		
		# Voice consistency check
		voice_scores = await self._check_voice_consistency(task.content)
		
		# Compliance validation
		compliance_issues = await self._validate_compliance(task.content, task.criteria)
		
		# Generate improvement suggestions
		suggestions = await self._generate_improvement_suggestions(
			task.content, quality_scores, voice_scores, compliance_issues
		)
		
		# Calculate overall score
		overall_score = (
			quality_scores["overall"] * 0.4 +
			voice_scores.get("consistency", 0.8) * 0.3 +
			(1.0 - len(compliance_issues) * 0.1) * 0.3
		)
		
		# Determine approval
		approved = overall_score >= self.review_standards["quality"]["minimum"]
		
		return ReviewResult(
			task_id=task.task_id,
			review_type=task.review_type,
			overall_score=overall_score,
			quality_scores=quality_scores,
			compliance_issues=compliance_issues,
			improvement_suggestions=suggestions,
			approved=approved,
			confidence_level=0.9,
			detailed_feedback={
				"voice_analysis": voice_scores,
				"strengths": self._identify_strengths(task.content),
				"weaknesses": self._identify_weaknesses(task.content),
				"recommendations": suggestions[:5]
			}
		)
	
	async def _quality_review(self, task: ReviewTask) -> ReviewResult:
		"""Conduct quality-focused review"""
		quality_scores = self._basic_quality_assessment(task.content)
		
		suggestions = []
		if quality_scores["readability"] < 0.8:
			suggestions.append({
				"type": "readability",
				"description": "Improve sentence structure and word choice",
				"priority": "medium"
			})
		
		if quality_scores["structure"] < 0.8:
			suggestions.append({
				"type": "structure",
				"description": "Enhance document organization and flow",
				"priority": "high"
			})
		
		overall_score = quality_scores["overall"]
		approved = overall_score >= self.review_standards["quality"]["minimum"]
		
		return ReviewResult(
			task_id=task.task_id,
			review_type=task.review_type,
			overall_score=overall_score,
			quality_scores=quality_scores,
			compliance_issues=[],
			improvement_suggestions=suggestions,
			approved=approved,
			confidence_level=0.85,
			detailed_feedback={"focus": "content_quality"}
		)
	
	async def _voice_review(self, task: ReviewTask) -> ReviewResult:
		"""Conduct voice consistency review"""
		voice_scores = await self._check_voice_consistency(task.content)
		
		suggestions = []
		if voice_scores.get("consistency", 0.8) < 0.9:
			suggestions.append({
				"type": "voice_consistency",
				"description": "Improve consistency with brand voice guidelines",
				"priority": "high"
			})
		
		overall_score = voice_scores.get("consistency", 0.8)
		approved = overall_score >= self.review_standards["voice_consistency"]["minimum"]
		
		return ReviewResult(
			task_id=task.task_id,
			review_type=task.review_type,
			overall_score=overall_score,
			quality_scores={"voice": overall_score},
			compliance_issues=[],
			improvement_suggestions=suggestions,
			approved=approved,
			confidence_level=0.9,
			detailed_feedback={"voice_analysis": voice_scores}
		)
	
	async def _compliance_review(self, task: ReviewTask) -> ReviewResult:
		"""Conduct compliance-focused review"""
		compliance_issues = await self._validate_compliance(task.content, task.criteria)
		
		compliance_score = max(0.0, 1.0 - len(compliance_issues) * 0.15)
		approved = compliance_score >= self.review_standards["compliance"]["minimum"]
		
		suggestions = [
			{
				"type": "compliance",
				"description": issue.get("description", "Address compliance issue"),
				"priority": "high"
			}
			for issue in compliance_issues
		]
		
		return ReviewResult(
			task_id=task.task_id,
			review_type=task.review_type,
			overall_score=compliance_score,
			quality_scores={"compliance": compliance_score},
			compliance_issues=compliance_issues,
			improvement_suggestions=suggestions,
			approved=approved,
			confidence_level=0.95,
			detailed_feedback={"compliance_focus": True}
		)
	
	async def _general_review(self, task: ReviewTask) -> ReviewResult:
		"""Conduct general review"""
		quality_scores = self._basic_quality_assessment(task.content)
		
		suggestions = [
			{
				"type": "general",
				"description": "Review content for accuracy and completeness",
				"priority": "medium"
			}
		]
		
		overall_score = quality_scores["overall"]
		approved = overall_score >= 0.7
		
		return ReviewResult(
			task_id=task.task_id,
			review_type=task.review_type,
			overall_score=overall_score,
			quality_scores=quality_scores,
			compliance_issues=[],
			improvement_suggestions=suggestions,
			approved=approved,
			confidence_level=0.75,
			detailed_feedback={"review_type": "general"}
		)
	
	# Helper methods
	
	def _basic_quality_assessment(self, content: str) -> Dict[str, float]:
		"""Basic quality assessment without external tools"""
		word_count = len(content.split())
		sentence_count = len(content.split('.'))
		
		# Basic readability
		avg_sentence_length = word_count / max(sentence_count, 1)
		readability = max(0.0, min(1.0, 1.0 - (avg_sentence_length - 20) / 30))
		
		# Structure assessment
		has_headings = bool(re.search(r'^#{1,6}\s+', content, re.MULTILINE))
		has_bullets = bool(re.search(r'^[•\-\*]\s+', content, re.MULTILINE))
		structure = 0.5 + (0.25 * has_headings) + (0.25 * has_bullets)
		
		# Clarity indicators
		clarity_words = ["clear", "specific", "detailed", "comprehensive"]
		clarity_count = sum(1 for word in clarity_words if word in content.lower())
		clarity = min(1.0, clarity_count / 2.0 + 0.6)
		
		overall = (readability * 0.4 + structure * 0.3 + clarity * 0.3)
		
		return {
			"overall": overall,
			"readability": readability,
			"structure": structure,
			"clarity": clarity
		}
	
	async def _check_voice_consistency(self, content: str) -> Dict[str, float]:
		"""Check voice consistency"""
		if self.voice_integrator:
			try:
				request = AnalysisRequest(
					analysis_type=AnalysisType.VALIDATION_ONLY,
					text_content=content,
					organization_name="review_org"
				)
				result = await self.voice_integrator.analyze(request)

				return {
					"consistency": result.consistency_score,
					"authenticity": result.authenticity_score,
					"overall": result.overall_voice_score
				}
			except Exception as e:
				self.logger.warning(f"Voice consistency check failed, using fallback scores: {e}")
		
		# Fallback voice assessment
		return {
			"consistency": 0.8,
			"authenticity": 0.75,
			"overall": 0.78
		}
	
	async def _validate_compliance(self, content: str, criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
		"""Validate compliance with criteria"""
		issues = []
		
		# Check word count requirements
		if "min_words" in criteria:
			word_count = len(content.split())
			if word_count < criteria["min_words"]:
				issues.append({
					"type": "word_count",
					"description": f"Content has {word_count} words, minimum required: {criteria['min_words']}",
					"severity": "medium"
				})
		
		# Check required sections
		if "required_sections" in criteria:
			for section in criteria["required_sections"]:
				if section.lower() not in content.lower():
					issues.append({
						"type": "missing_section",
						"description": f"Required section '{section}' not found",
						"severity": "high"
					})
		
		# Check forbidden words/phrases
		if "forbidden_words" in criteria:
			for word in criteria["forbidden_words"]:
				if word.lower() in content.lower():
					issues.append({
						"type": "forbidden_content",
						"description": f"Forbidden word/phrase found: '{word}'",
						"severity": "high"
					})
		
		return issues
	
	async def _generate_improvement_suggestions(
		self, content: str, quality_scores: Dict[str, float], 
		voice_scores: Dict[str, float], compliance_issues: List[Dict[str, Any]]
	) -> List[Dict[str, Any]]:
		"""Generate improvement suggestions based on analysis"""
		suggestions = []
		
		# Quality-based suggestions
		if quality_scores.get("readability", 1.0) < 0.8:
			suggestions.append({
				"type": "readability",
				"description": "Simplify sentence structure and use clearer language",
				"priority": "high",
				"impact": "Improves reader comprehension and engagement"
			})
		
		if quality_scores.get("structure", 1.0) < 0.8:
			suggestions.append({
				"type": "structure",
				"description": "Add clear headings and improve document organization",
				"priority": "medium",
				"impact": "Enhances document flow and navigation"
			})
		
		# Voice-based suggestions
		if voice_scores.get("consistency", 1.0) < 0.9:
			suggestions.append({
				"type": "voice",
				"description": "Align language and tone with established voice guidelines",
				"priority": "high",
				"impact": "Ensures brand consistency and professionalism"
			})
		
		# Compliance-based suggestions
		for issue in compliance_issues:
			suggestions.append({
				"type": "compliance",
				"description": f"Address compliance issue: {issue['description']}",
				"priority": issue.get("severity", "medium"),
				"impact": "Ensures compliance with requirements and standards"
			})
		
		return suggestions
	
	def _identify_strengths(self, content: str) -> List[str]:
		"""Identify content strengths"""
		strengths = []
		
		if len(content.split()) > 1000:
			strengths.append("Comprehensive coverage of topic")
		
		if bool(re.search(r'^#{1,6}\s+', content, re.MULTILINE)):
			strengths.append("Clear document structure with headings")
		
		if "benefits" in content.lower() and "value" in content.lower():
			strengths.append("Includes value proposition and benefits")
		
		return strengths or ["Content demonstrates professional presentation"]
	
	def _identify_weaknesses(self, content: str) -> List[str]:
		"""Identify content weaknesses"""
		weaknesses = []
		
		sentences = content.split('.')
		avg_length = len(content.split()) / max(len(sentences), 1)
		if avg_length > 25:
			weaknesses.append("Sentences are too long on average")
		
		if not bool(re.search(r'^[•\-\*]\s+', content, re.MULTILINE)):
			weaknesses.append("Lacks bullet points for easy scanning")
		
		return weaknesses or ["Minor improvements possible"]
	
	# Message handling
	
	async def _handle_review_request(self, message: AgentMessage) -> AgentMessage:
		"""Handle review task request"""
		try:
			task_data = message.payload.content
			
			review_task = ReviewTask(
				task_id=message.header.message_id,
				content=task_data.get("content", ""),
				review_type=task_data.get("review_type", "quality"),
				criteria=task_data.get("criteria", {}),
				standards=task_data.get("standards", self.review_standards)
			)
			
			result = await self.process_task(review_task)
			
			return MessageTemplates.task_response(
				sender_id=self.agent_id,
				recipient_id=message.header.sender_id,
				result=result.__dict__,
				original_message_id=message.header.message_id
			)
			
		except Exception as e:
			self.logger.error(f"Error handling review request: {e}")
			return MessageTemplates.error_report(
				sender_id=self.agent_id,
				recipient_id=message.header.sender_id,
				error_info={"error": str(e)}
			)
	
	async def _handle_status_request(self, message: AgentMessage) -> AgentMessage:
		"""Handle status request"""
		status_data = {
			"agent_status": self.get_health_status(),
			"review_standards": self.review_standards,
			"supported_review_types": list(self.review_types),
			"capabilities": self.get_capabilities()
		}
		
		return MessageTemplates.task_response(
			sender_id=self.agent_id,
			recipient_id=message.header.sender_id,
			result=status_data,
			original_message_id=message.header.message_id
		)
	
	async def _update_review_metrics(self, task: ReviewTask, result: ReviewResult) -> None:
		"""Update review performance metrics"""
		self.update_goal_progress("review_accuracy", result.confidence_level)
		self.update_goal_progress("quality_standards", result.overall_score)
	
	# Public interface methods
	
	async def review_content(self, content: str, review_type: str = "comprehensive",
							criteria: Optional[Dict[str, Any]] = None) -> ReviewResult:
		"""Public method for content review"""
		task = ReviewTask(
			task_id=f"review_{hash(content)}",
			content=content,
			review_type=review_type,
			criteria=criteria or {},
			standards=self.review_standards
		)
		
		return await self.process_task(task)
	
	def get_review_standards(self) -> Dict[str, Dict[str, float]]:
		"""Get current review standards"""
		return self.review_standards.copy()