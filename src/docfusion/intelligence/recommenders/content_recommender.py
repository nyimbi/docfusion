"""
Content Recommender

This module provides intelligent content improvement recommendations for proposal
sections using NLP analysis, content quality assessment, and competitive
benchmarking to optimize proposal competitiveness.
"""

import asyncio
import json
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Set, Union
from dataclasses import dataclass, field
from enum import Enum

import numpy as np
from pydantic import BaseModel, Field, ConfigDict
from uuid import uuid4

from ..predictors.scoring_predictor import ProposalSection, SectionFeatures
from ...core.models.base import BaseEntity


class ContentType(str, Enum):
	"""Types of proposal content"""
	
	TEXT = "text"
	GRAPHICS = "graphics"
	TABLES = "tables"
	CHARTS = "charts"
	DIAGRAMS = "diagrams"
	APPENDICES = "appendices"


class RecommendationCategory(str, Enum):
	"""Categories of content recommendations"""
	
	STRUCTURE_ORGANIZATION = "structure_organization"
	CONTENT_QUALITY = "content_quality"
	COMPLIANCE_REQUIREMENTS = "compliance_requirements"
	COMPETITIVE_DIFFERENTIATION = "competitive_differentiation"
	VISUAL_PRESENTATION = "visual_presentation"
	EVIDENCE_SUPPORT = "evidence_support"
	CLARITY_READABILITY = "clarity_readability"
	TECHNICAL_DEPTH = "technical_depth"


class ContentIssue(BaseModel):
	"""Identified content issue"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	issue_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique issue identifier")
	issue_type: RecommendationCategory = Field(description="Category of the issue")
	severity: str = Field(description="Severity level: critical, high, medium, low")
	
	location: str = Field(description="Where the issue occurs (section, paragraph, etc.)")
	description: str = Field(description="Description of the issue")
	impact: str = Field(description="Impact on proposal competitiveness")
	
	current_content_snippet: Optional[str] = Field(None, description="Current problematic content")
	recommended_action: str = Field(description="Recommended action to address issue")


class ContentSuggestion(BaseModel):
	"""Content improvement suggestion"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	suggestion_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique suggestion identifier")
	category: RecommendationCategory = Field(description="Category of suggestion")
	priority: str = Field(description="Priority level: high, medium, low")
	
	title: str = Field(description="Short title of suggestion")
	description: str = Field(description="Detailed description of suggestion")
	rationale: str = Field(description="Why this suggestion improves competitiveness")
	
	implementation_effort: str = Field(description="Effort required: minimal, moderate, significant")
	expected_impact: str = Field(description="Expected impact on scores/competitiveness")
	
	specific_actions: List[str] = Field(description="Specific actions to implement suggestion")
	example_content: Optional[str] = Field(None, description="Example of improved content")


class ContentAnalysis(BaseModel):
	"""Comprehensive content analysis results"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	analysis_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique analysis identifier")
	section_type: ProposalSection = Field(description="Type of section analyzed")
	content_length: int = Field(ge=0, description="Content length in words")
	
	# Quality metrics
	readability_score: float = Field(ge=0.0, le=1.0, description="Content readability score")
	technical_depth_score: float = Field(ge=0.0, le=1.0, description="Technical depth assessment")
	compliance_score: float = Field(ge=0.0, le=1.0, description="Compliance with requirements")
	evidence_strength_score: float = Field(ge=0.0, le=1.0, description="Strength of supporting evidence")
	
	# Content characteristics
	key_themes: List[str] = Field(description="Main themes identified in content")
	technical_concepts: List[str] = Field(description="Technical concepts covered")
	missing_elements: List[str] = Field(description="Missing required elements")
	
	# Competitive analysis
	differentiation_strength: float = Field(ge=0.0, le=1.0, description="Strength of differentiation")
	competitive_gaps: List[str] = Field(description="Areas where competitors may be stronger")
	
	analysis_timestamp: datetime = Field(default_factory=datetime.now)


class ContentRecommendationReport(BaseModel):
	"""Comprehensive content recommendation report"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	report_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique report identifier")
	proposal_id: str = Field(description="Proposal identifier")
	section_type: ProposalSection = Field(description="Section analyzed")
	
	# Analysis summary
	overall_content_score: float = Field(ge=0.0, le=100.0, description="Overall content quality score")
	content_analysis: ContentAnalysis = Field(description="Detailed content analysis")
	
	# Issues and recommendations
	critical_issues: List[ContentIssue] = Field(description="Critical issues requiring immediate attention")
	improvement_suggestions: List[ContentSuggestion] = Field(description="Prioritized improvement suggestions")
	
	# Competitive positioning
	competitive_strengths: List[str] = Field(description="Competitive strengths to leverage")
	competitive_weaknesses: List[str] = Field(description="Weaknesses to address")
	
	# Implementation guidance
	quick_wins: List[str] = Field(description="Quick improvements with high impact")
	long_term_improvements: List[str] = Field(description="Long-term strategic improvements")
	resource_requirements: str = Field(description="Resources needed for implementation")
	
	# Metrics and tracking
	expected_score_improvement: float = Field(ge=0.0, le=20.0, description="Expected score improvement")
	implementation_timeline: str = Field(description="Recommended implementation timeline")
	
	report_timestamp: datetime = Field(default_factory=datetime.now)


class ContentRecommender:
	"""
	Intelligent content recommendation engine for proposals
	
	Analyzes proposal content and provides actionable recommendations
	to improve quality, compliance, competitiveness, and readability
	using NLP analysis and competitive benchmarking techniques.
	"""
	
	def __init__(self):
		# Content analysis patterns
		self.technical_keywords = self._load_technical_keyword_patterns()
		self.compliance_patterns = self._load_compliance_patterns()
		self.quality_indicators = self._load_quality_indicators()
		
		# Scoring weights
		self.scoring_weights = {
			'readability': 0.2,
			'technical_depth': 0.25,
			'compliance': 0.25,
			'evidence_strength': 0.2,
			'differentiation': 0.1
		}
		
		# Recommendation thresholds
		self.critical_threshold = 0.6  # Below this is critical
		self.improvement_threshold = 0.8  # Below this needs improvement
		
		# Analysis history
		self.analysis_history: List[ContentRecommendationReport] = []
		
		self._log_initialization()
	
	async def analyze_content(self, content: str, section_type: ProposalSection,
	                          requirements: Optional[List[str]] = None,
	                          competitive_context: Optional[Dict[str, Any]] = None) -> ContentRecommendationReport:
		"""
		Analyze content and generate comprehensive recommendations
		
		Args:
			content: Text content to analyze
			section_type: Type of proposal section
			requirements: List of requirements to check compliance
			competitive_context: Competitive intelligence for benchmarking
			
		Returns:
			Comprehensive content recommendation report
		"""
		try:
			self._log_analysis_start(section_type)
			
			# Perform content analysis
			content_analysis = await self._analyze_content_quality(
				content, section_type, requirements
			)
			
			# Calculate overall content score
			overall_score = self._calculate_overall_content_score(content_analysis)
			
			# Identify issues and suggestions
			critical_issues = self._identify_critical_issues(
				content_analysis, content, section_type, requirements
			)
			
			improvement_suggestions = self._generate_improvement_suggestions(
				content_analysis, content, section_type, competitive_context
			)
			
			# Competitive analysis
			competitive_strengths, competitive_weaknesses = self._analyze_competitive_position(
				content_analysis, competitive_context
			)
			
			# Implementation guidance
			quick_wins = self._identify_quick_wins(improvement_suggestions)
			long_term_improvements = self._identify_long_term_improvements(improvement_suggestions)
			
			# Generate report
			report = ContentRecommendationReport(
				proposal_id=f"proposal_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
				section_type=section_type,
				overall_content_score=overall_score,
				content_analysis=content_analysis,
				critical_issues=critical_issues,
				improvement_suggestions=improvement_suggestions,
				competitive_strengths=competitive_strengths,
				competitive_weaknesses=competitive_weaknesses,
				quick_wins=quick_wins,
				long_term_improvements=long_term_improvements,
				resource_requirements=self._assess_resource_requirements(improvement_suggestions),
				expected_score_improvement=self._estimate_score_improvement(improvement_suggestions),
				implementation_timeline=self._estimate_implementation_timeline(improvement_suggestions)
			)
			
			# Store analysis history
			self.analysis_history.append(report)
			
			self._log_analysis_complete(section_type, overall_score, len(critical_issues))
			
			return report
			
		except Exception as e:
			self._log_analysis_error(f"Content analysis failed for {section_type}: {str(e)}")
			raise
	
	async def _analyze_content_quality(self, content: str, section_type: ProposalSection,
	                                   requirements: Optional[List[str]] = None) -> ContentAnalysis:
		"""Analyze content quality across multiple dimensions"""
		
		# Basic content metrics
		word_count = len(content.split())
		
		# Quality assessments
		readability_score = self._assess_readability(content)
		technical_depth_score = self._assess_technical_depth(content, section_type)
		compliance_score = self._assess_compliance(content, requirements) if requirements else 0.8
		evidence_strength_score = self._assess_evidence_strength(content)
		differentiation_strength = self._assess_differentiation(content)
		
		# Content analysis
		key_themes = self._extract_key_themes(content)
		technical_concepts = self._extract_technical_concepts(content, section_type)
		missing_elements = self._identify_missing_elements(content, section_type, requirements)
		competitive_gaps = self._identify_competitive_gaps(content, section_type)
		
		return ContentAnalysis(
			section_type=section_type,
			content_length=word_count,
			readability_score=readability_score,
			technical_depth_score=technical_depth_score,
			compliance_score=compliance_score,
			evidence_strength_score=evidence_strength_score,
			key_themes=key_themes,
			technical_concepts=technical_concepts,
			missing_elements=missing_elements,
			differentiation_strength=differentiation_strength,
			competitive_gaps=competitive_gaps
		)
	
	def _assess_readability(self, content: str) -> float:
		"""Assess content readability using multiple indicators"""
		
		sentences = content.split('.')
		words = content.split()
		
		if not sentences or not words:
			return 0.0
		
		# Average sentence length (target: 15-20 words)
		avg_sentence_length = len(words) / len(sentences)
		sentence_score = max(0, 1.0 - abs(avg_sentence_length - 17.5) / 17.5)
		
		# Complex word assessment (simplified)
		complex_words = [w for w in words if len(w) > 12]
		complex_ratio = len(complex_words) / len(words)
		complexity_score = max(0, 1.0 - complex_ratio * 3)  # Penalize excessive complexity
		
		# Passive voice assessment (simplified pattern matching)
		passive_indicators = ['was', 'were', 'been', 'being', 'is', 'are']
		passive_count = sum(1 for word in words if word.lower() in passive_indicators)
		passive_ratio = passive_count / len(words)
		passive_score = max(0, 1.0 - passive_ratio * 4)
		
		# Combined readability score
		readability = (sentence_score * 0.4 + complexity_score * 0.3 + passive_score * 0.3)
		
		return min(1.0, max(0.0, readability))
	
	def _assess_technical_depth(self, content: str, section_type: ProposalSection) -> float:
		"""Assess technical depth appropriate to section type"""
		
		content_lower = content.lower()
		
		# Section-specific technical indicators
		technical_indicators = self.technical_keywords.get(section_type, [])
		
		# Count technical terms
		technical_matches = sum(1 for term in technical_indicators if term in content_lower)
		technical_density = technical_matches / len(content.split()) if content.split() else 0
		
		# Methodology indicators
		methodology_terms = ['approach', 'methodology', 'framework', 'process', 'procedure', 'technique']
		methodology_count = sum(1 for term in methodology_terms if term in content_lower)
		
		# Quantitative indicators
		quantitative_patterns = [r'\d+%', r'\d+\.\d+', r'\$[\d,]+', r'\d+\s*(hours?|days?|weeks?)']
		quantitative_count = sum(len(re.findall(pattern, content, re.IGNORECASE)) for pattern in quantitative_patterns)
		
		# Combined technical depth score
		base_score = min(1.0, technical_density * 50)  # Scale technical density
		methodology_bonus = min(0.2, methodology_count * 0.05)
		quantitative_bonus = min(0.2, quantitative_count * 0.02)
		
		technical_depth = base_score + methodology_bonus + quantitative_bonus
		
		return min(1.0, max(0.0, technical_depth))
	
	def _assess_compliance(self, content: str, requirements: Optional[List[str]]) -> float:
		"""Assess compliance with stated requirements"""
		
		if not requirements:
			return 0.8  # Default score when no specific requirements
		
		content_lower = content.lower()
		compliance_indicators = []
		
		for requirement in requirements:
			requirement_lower = requirement.lower()
			
			# Check for direct mentions
			if requirement_lower in content_lower:
				compliance_indicators.append(1.0)
			else:
				# Check for related concepts (simplified keyword matching)
				key_terms = requirement_lower.split()[:3]  # Take first 3 words
				matches = sum(1 for term in key_terms if term in content_lower)
				compliance_indicators.append(matches / len(key_terms) if key_terms else 0)
		
		# Average compliance across all requirements
		compliance_score = sum(compliance_indicators) / len(compliance_indicators) if compliance_indicators else 0.8
		
		return min(1.0, max(0.0, compliance_score))
	
	def _assess_evidence_strength(self, content: str) -> float:
		"""Assess strength of supporting evidence"""
		
		# Evidence indicators
		evidence_patterns = [
			r'case study',
			r'example',
			r'demonstrated',
			r'proven',
			r'successful',
			r'achieved',
			r'delivered',
			r'resulted in',
			r'performance metrics?',
			r'testimonial',
			r'reference',
			r'award',
			r'certification'
		]
		
		evidence_count = sum(len(re.findall(pattern, content, re.IGNORECASE)) for pattern in evidence_patterns)
		
		# Quantitative evidence
		quantitative_evidence = [r'\d+%', r'\$[\d,]+', r'\d+\s*improvement', r'\d+x\s*faster']
		quantitative_count = sum(len(re.findall(pattern, content, re.IGNORECASE)) for pattern in quantitative_evidence)
		
		# Calculate evidence strength
		content_length = len(content.split())
		evidence_density = evidence_count / content_length if content_length > 0 else 0
		quantitative_density = quantitative_count / content_length if content_length > 0 else 0
		
		evidence_strength = min(1.0, evidence_density * 100 + quantitative_density * 200)
		
		return min(1.0, max(0.0, evidence_strength))
	
	def _assess_differentiation(self, content: str) -> float:
		"""Assess strength of differentiation and unique value propositions"""
		
		differentiation_indicators = [
			r'unique',
			r'innovative',
			r'proprietary',
			r'exclusively',
			r'only company',
			r'first to',
			r'patent',
			r'breakthrough',
			r'competitive advantage',
			r'differentiator',
			r'unlike competitors',
			r'exclusively positioned'
		]
		
		content_lower = content.lower()
		differentiation_count = sum(len(re.findall(pattern, content_lower, re.IGNORECASE)) 
		                           for pattern in differentiation_indicators)
		
		# Value proposition indicators
		value_indicators = ['benefit', 'value', 'advantage', 'superior', 'best-in-class', 'optimize', 'enhance']
		value_count = sum(1 for term in value_indicators if term in content_lower)
		
		# Calculate differentiation strength
		content_length = len(content.split())
		differentiation_density = differentiation_count / content_length if content_length > 0 else 0
		value_density = value_count / content_length if content_length > 0 else 0
		
		differentiation_strength = min(1.0, differentiation_density * 50 + value_density * 20)
		
		return min(1.0, max(0.0, differentiation_strength))
	
	def _extract_key_themes(self, content: str) -> List[str]:
		"""Extract main themes from content"""
		
		# Simplified theme extraction using keyword clustering
		content_lower = content.lower()
		words = re.findall(r'\b\w+\b', content_lower)
		
		# Filter out common stop words
		stop_words = {'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}
		meaningful_words = [w for w in words if len(w) > 4 and w not in stop_words]
		
		# Count word frequency
		word_counts = {}
		for word in meaningful_words:
			word_counts[word] = word_counts.get(word, 0) + 1
		
		# Get top themes
		top_themes = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)[:10]
		
		return [theme[0].title() for theme in top_themes]
	
	def _extract_technical_concepts(self, content: str, section_type: ProposalSection) -> List[str]:
		"""Extract technical concepts relevant to section type"""
		
		technical_terms = self.technical_keywords.get(section_type, [])
		content_lower = content.lower()
		
		found_concepts = []
		for term in technical_terms:
			if term in content_lower:
				found_concepts.append(term.title())
		
		return found_concepts[:15]  # Return top 15 concepts
	
	def _identify_missing_elements(self, content: str, section_type: ProposalSection,
	                               requirements: Optional[List[str]]) -> List[str]:
		"""Identify missing required elements"""
		
		missing_elements = []
		
		# Section-specific required elements
		required_elements = {
			ProposalSection.TECHNICAL_APPROACH: [
				"methodology", "implementation plan", "deliverables", "timeline"
			],
			ProposalSection.MANAGEMENT_APPROACH: [
				"project management", "quality assurance", "risk management", "communication plan"
			],
			ProposalSection.PAST_PERFORMANCE: [
				"relevant experience", "client references", "performance metrics", "lessons learned"
			],
			ProposalSection.PERSONNEL_QUALIFICATIONS: [
				"team structure", "key personnel", "qualifications", "experience"
			]
		}
		
		section_requirements = required_elements.get(section_type, [])
		content_lower = content.lower()
		
		for element in section_requirements:
			if element not in content_lower:
				missing_elements.append(element.title())
		
		# Check against specific requirements if provided
		if requirements:
			for req in requirements:
				req_lower = req.lower()
				if req_lower not in content_lower:
					# Check if key terms from requirement are present
					key_terms = req_lower.split()[:3]
					if not any(term in content_lower for term in key_terms):
						missing_elements.append(f"Requirement: {req}")
		
		return missing_elements
	
	def _identify_competitive_gaps(self, content: str, section_type: ProposalSection) -> List[str]:
		"""Identify potential competitive gaps"""
		
		gaps = []
		
		# Common competitive gaps by section
		competitive_indicators = {
			ProposalSection.TECHNICAL_APPROACH: [
				"industry standards", "best practices", "scalability", "performance benchmarks"
			],
			ProposalSection.MANAGEMENT_APPROACH: [
				"project management certification", "quality frameworks", "risk mitigation"
			],
			ProposalSection.PAST_PERFORMANCE: [
				"quantitative results", "client testimonials", "awards recognition"
			]
		}
		
		indicators = competitive_indicators.get(section_type, [])
		content_lower = content.lower()
		
		for indicator in indicators:
			if indicator not in content_lower:
				gaps.append(f"Missing {indicator}")
		
		return gaps
	
	def _calculate_overall_content_score(self, analysis: ContentAnalysis) -> float:
		"""Calculate overall content quality score"""
		
		weighted_score = (
			analysis.readability_score * self.scoring_weights['readability'] +
			analysis.technical_depth_score * self.scoring_weights['technical_depth'] +
			analysis.compliance_score * self.scoring_weights['compliance'] +
			analysis.evidence_strength_score * self.scoring_weights['evidence_strength'] +
			analysis.differentiation_strength * self.scoring_weights['differentiation']
		)
		
		return weighted_score * 100  # Convert to 0-100 scale
	
	def _identify_critical_issues(self, analysis: ContentAnalysis, content: str,
	                              section_type: ProposalSection,
	                              requirements: Optional[List[str]]) -> List[ContentIssue]:
		"""Identify critical issues requiring immediate attention"""
		
		critical_issues = []
		
		# Compliance issues
		if analysis.compliance_score < self.critical_threshold:
			critical_issues.append(ContentIssue(
				issue_type=RecommendationCategory.COMPLIANCE_REQUIREMENTS,
				severity="critical",
				location=f"{section_type.value} section",
				description="Content does not adequately address required elements",
				impact="May result in proposal rejection or significant point deductions",
				recommended_action="Review all requirements and ensure comprehensive coverage"
			))
		
		# Content length issues
		if analysis.content_length < 300:
			critical_issues.append(ContentIssue(
				issue_type=RecommendationCategory.CONTENT_QUALITY,
				severity="high",
				location=f"{section_type.value} section",
				description="Content appears insufficient for competitive evaluation",
				impact="Evaluators may perceive lack of depth or preparation",
				recommended_action="Expand content with detailed explanations and supporting evidence"
			))
		
		# Missing evidence
		if analysis.evidence_strength_score < self.critical_threshold:
			critical_issues.append(ContentIssue(
				issue_type=RecommendationCategory.EVIDENCE_SUPPORT,
				severity="high",
				location=f"{section_type.value} section",
				description="Insufficient supporting evidence and quantitative data",
				impact="Claims may not be credible to evaluators",
				recommended_action="Add specific examples, metrics, and quantitative support"
			))
		
		return critical_issues
	
	def _generate_improvement_suggestions(self, analysis: ContentAnalysis, content: str,
	                                      section_type: ProposalSection,
	                                      competitive_context: Optional[Dict[str, Any]]) -> List[ContentSuggestion]:
		"""Generate prioritized improvement suggestions"""
		
		suggestions = []
		
		# Readability improvements
		if analysis.readability_score < self.improvement_threshold:
			suggestions.append(ContentSuggestion(
				category=RecommendationCategory.CLARITY_READABILITY,
				priority="medium",
				title="Improve Content Readability",
				description="Content readability can be enhanced for better evaluator comprehension",
				rationale="Clear, readable content improves evaluator understanding and scoring",
				implementation_effort="minimal",
				expected_impact="2-3 point score improvement",
				specific_actions=[
					"Break long sentences into shorter ones (target 15-20 words)",
					"Use active voice instead of passive voice where possible",
					"Replace complex terminology with clearer alternatives when appropriate",
					"Add transition sentences between paragraphs"
				],
				example_content="Example: Change 'The system will be implemented by our team' to 'Our team will implement the system'"
			))
		
		# Technical depth improvements
		if analysis.technical_depth_score < self.improvement_threshold:
			suggestions.append(ContentSuggestion(
				category=RecommendationCategory.TECHNICAL_DEPTH,
				priority="high",
				title="Enhance Technical Detail",
				description="Content lacks sufficient technical depth for competitive positioning",
				rationale="Technical evaluators expect detailed methodologies and implementation specifics",
				implementation_effort="moderate",
				expected_impact="4-6 point score improvement",
				specific_actions=[
					"Add specific methodologies and frameworks",
					"Include implementation steps and procedures",
					"Provide technical specifications and requirements",
					"Add diagrams or flowcharts to illustrate technical approach"
				]
			))
		
		# Evidence strengthening
		if analysis.evidence_strength_score < self.improvement_threshold:
			suggestions.append(ContentSuggestion(
				category=RecommendationCategory.EVIDENCE_SUPPORT,
				priority="high",
				title="Strengthen Supporting Evidence",
				description="Content needs more compelling evidence and quantitative support",
				rationale="Strong evidence builds credibility and demonstrates capability",
				implementation_effort="moderate",
				expected_impact="3-5 point score improvement",
				specific_actions=[
					"Add specific case studies and examples",
					"Include quantitative metrics and results",
					"Reference client testimonials or awards",
					"Provide performance benchmarks and comparisons"
				]
			))
		
		# Differentiation improvements
		if analysis.differentiation_strength < self.improvement_threshold:
			suggestions.append(ContentSuggestion(
				category=RecommendationCategory.COMPETITIVE_DIFFERENTIATION,
				priority="high",
				title="Strengthen Competitive Differentiation",
				description="Content lacks clear differentiation from competitors",
				rationale="Strong differentiation is critical for winning competitive proposals",
				implementation_effort="significant",
				expected_impact="5-8 point score improvement",
				specific_actions=[
					"Identify and highlight unique capabilities",
					"Emphasize proprietary tools or methodologies",
					"Contrast approach with typical industry practices",
					"Articulate specific client benefits and value propositions"
				]
			))
		
		# Section-specific suggestions
		section_suggestions = self._generate_section_specific_suggestions(analysis, section_type)
		suggestions.extend(section_suggestions)
		
		return suggestions
	
	def _generate_section_specific_suggestions(self, analysis: ContentAnalysis,
	                                           section_type: ProposalSection) -> List[ContentSuggestion]:
		"""Generate section-specific improvement suggestions"""
		
		suggestions = []
		
		if section_type == ProposalSection.TECHNICAL_APPROACH:
			suggestions.append(ContentSuggestion(
				category=RecommendationCategory.STRUCTURE_ORGANIZATION,
				priority="medium",
				title="Organize Technical Approach Systematically",
				description="Structure technical content for optimal evaluator comprehension",
				rationale="Well-organized technical content demonstrates systematic thinking",
				implementation_effort="minimal",
				expected_impact="2-3 point improvement",
				specific_actions=[
					"Use consistent headings for each technical area",
					"Present approach in logical sequence",
					"Include overview before detailed explanations",
					"Add summary of key technical benefits"
				]
			))
		
		elif section_type == ProposalSection.PAST_PERFORMANCE:
			suggestions.append(ContentSuggestion(
				category=RecommendationCategory.EVIDENCE_SUPPORT,
				priority="high",
				title="Enhance Past Performance Examples",
				description="Past performance examples need stronger relevance and detail",
				rationale="Relevant, detailed past performance builds evaluator confidence",
				implementation_effort="moderate",
				expected_impact="4-6 point improvement",
				specific_actions=[
					"Select most relevant examples for current opportunity",
					"Include specific performance metrics and outcomes",
					"Highlight lessons learned and improvements implemented",
					"Add client contact information where permitted"
				]
			))
		
		elif section_type == ProposalSection.MANAGEMENT_APPROACH:
			suggestions.append(ContentSuggestion(
				category=RecommendationCategory.STRUCTURE_ORGANIZATION,
				priority="high",
				title="Develop Comprehensive Management Framework",
				description="Management approach needs systematic framework and controls",
				rationale="Systematic management demonstrates capability to deliver successfully",
				implementation_effort="moderate",
				expected_impact="3-5 point improvement",
				specific_actions=[
					"Present integrated management framework",
					"Include quality assurance and control processes",
					"Address risk management and mitigation strategies",
					"Show communication and reporting protocols"
				]
			))
		
		return suggestions
	
	def _analyze_competitive_position(self, analysis: ContentAnalysis,
	                                  competitive_context: Optional[Dict[str, Any]]) -> Tuple[List[str], List[str]]:
		"""Analyze competitive strengths and weaknesses"""
		
		strengths = []
		weaknesses = []
		
		# Analysis-based strengths
		if analysis.technical_depth_score >= 0.8:
			strengths.append("Strong technical depth and expertise demonstrated")
		
		if analysis.evidence_strength_score >= 0.8:
			strengths.append("Compelling evidence and quantitative support provided")
		
		if analysis.differentiation_strength >= 0.7:
			strengths.append("Clear differentiation and unique value propositions")
		
		if analysis.compliance_score >= 0.9:
			strengths.append("Excellent compliance with stated requirements")
		
		# Analysis-based weaknesses
		if analysis.readability_score < 0.7:
			weaknesses.append("Content readability may hinder evaluator comprehension")
		
		if analysis.technical_depth_score < 0.6:
			weaknesses.append("Technical content may lack depth compared to competitors")
		
		if analysis.evidence_strength_score < 0.6:
			weaknesses.append("Supporting evidence may be weaker than competitor offerings")
		
		if len(analysis.missing_elements) > 3:
			weaknesses.append("Multiple required elements missing or inadequately addressed")
		
		return strengths, weaknesses
	
	def _identify_quick_wins(self, suggestions: List[ContentSuggestion]) -> List[str]:
		"""Identify quick improvement opportunities"""
		
		quick_wins = []
		
		for suggestion in suggestions:
			if suggestion.implementation_effort == "minimal" and suggestion.priority in ["high", "medium"]:
				quick_wins.append(f"{suggestion.title}: {suggestion.specific_actions[0]}")
		
		return quick_wins[:5]
	
	def _identify_long_term_improvements(self, suggestions: List[ContentSuggestion]) -> List[str]:
		"""Identify long-term strategic improvements"""
		
		long_term = []
		
		for suggestion in suggestions:
			if suggestion.implementation_effort == "significant" and suggestion.priority == "high":
				long_term.append(f"{suggestion.title}: {suggestion.description}")
		
		return long_term[:4]
	
	def _assess_resource_requirements(self, suggestions: List[ContentSuggestion]) -> str:
		"""Assess resources needed for implementation"""
		
		effort_counts = {"minimal": 0, "moderate": 0, "significant": 0}
		
		for suggestion in suggestions:
			effort_counts[suggestion.implementation_effort] += 1
		
		total_hours = (effort_counts["minimal"] * 2 + 
		               effort_counts["moderate"] * 8 + 
		               effort_counts["significant"] * 20)
		
		return f"Estimated {total_hours} hours: {effort_counts['minimal']} minimal, {effort_counts['moderate']} moderate, {effort_counts['significant']} significant effort items"
	
	def _estimate_score_improvement(self, suggestions: List[ContentSuggestion]) -> float:
		"""Estimate potential score improvement"""
		
		total_improvement = 0
		
		for suggestion in suggestions:
			if suggestion.priority == "high":
				if "4-6 point" in suggestion.expected_impact:
					total_improvement += 5
				elif "3-5 point" in suggestion.expected_impact:
					total_improvement += 4
				elif "5-8 point" in suggestion.expected_impact:
					total_improvement += 6.5
			elif suggestion.priority == "medium":
				if "2-3 point" in suggestion.expected_impact:
					total_improvement += 2.5
		
		return min(20, total_improvement * 0.7)  # Apply realization factor, cap at 20 points
	
	def _estimate_implementation_timeline(self, suggestions: List[ContentSuggestion]) -> str:
		"""Estimate implementation timeline"""
		
		high_priority_count = sum(1 for s in suggestions if s.priority == "high")
		moderate_effort_count = sum(1 for s in suggestions if s.implementation_effort == "moderate")
		significant_effort_count = sum(1 for s in suggestions if s.implementation_effort == "significant")
		
		if significant_effort_count > 2:
			return "2-3 weeks for full implementation"
		elif moderate_effort_count > 3:
			return "1-2 weeks for full implementation"
		else:
			return "3-5 days for full implementation"
	
	def _load_technical_keyword_patterns(self) -> Dict[ProposalSection, List[str]]:
		"""Load technical keyword patterns by section"""
		
		return {
			ProposalSection.TECHNICAL_APPROACH: [
				"methodology", "framework", "architecture", "algorithm", "implementation",
				"integration", "scalability", "performance", "security", "testing",
				"deployment", "monitoring", "optimization", "automation", "standards"
			],
			ProposalSection.MANAGEMENT_APPROACH: [
				"project management", "agile", "scrum", "kanban", "quality assurance",
				"risk management", "communication", "stakeholder", "governance",
				"reporting", "milestone", "deliverable", "schedule", "resource"
			],
			ProposalSection.PAST_PERFORMANCE: [
				"delivered", "achieved", "successful", "completed", "managed",
				"implemented", "led", "developed", "improved", "optimized",
				"reduced", "increased", "enhanced", "streamlined", "transformed"
			]
		}
	
	def _load_compliance_patterns(self) -> List[str]:
		"""Load compliance check patterns"""
		
		return [
			"requirement", "shall", "must", "compliance", "conform",
			"standard", "specification", "mandatory", "required", "deliver"
		]
	
	def _load_quality_indicators(self) -> Dict[str, List[str]]:
		"""Load quality indicator patterns"""
		
		return {
			"evidence": ["demonstrated", "proven", "example", "case study", "testimonial"],
			"quantitative": ["percent", "improvement", "reduction", "increase", "metric"],
			"differentiation": ["unique", "proprietary", "innovative", "exclusive", "competitive advantage"]
		}
	
	def get_content_analysis_statistics(self) -> Dict[str, Any]:
		"""Get statistics on content analyses performed"""
		
		if not self.analysis_history:
			return {"total_analyses": 0}
		
		scores = [report.overall_content_score for report in self.analysis_history]
		
		return {
			"total_analyses": len(self.analysis_history),
			"average_content_score": np.mean(scores),
			"score_distribution": {
				"excellent (90-100)": sum(1 for s in scores if s >= 90),
				"good (80-89)": sum(1 for s in scores if 80 <= s < 90),
				"acceptable (70-79)": sum(1 for s in scores if 70 <= s < 80),
				"needs_improvement (<70)": sum(1 for s in scores if s < 70)
			},
			"common_issues": self._get_common_issues(),
			"improvement_tracking": self._get_improvement_tracking()
		}
	
	def _get_common_issues(self) -> Dict[str, int]:
		"""Get common issues across analyses"""
		
		issue_counts = {}
		
		for report in self.analysis_history:
			for issue in report.critical_issues:
				issue_type = issue.issue_type.value
				issue_counts[issue_type] = issue_counts.get(issue_type, 0) + 1
		
		return issue_counts
	
	def _get_improvement_tracking(self) -> Dict[str, float]:
		"""Track improvement over time"""
		
		if len(self.analysis_history) < 2:
			return {}
		
		first_half = self.analysis_history[:len(self.analysis_history)//2]
		second_half = self.analysis_history[len(self.analysis_history)//2:]
		
		first_avg = np.mean([r.overall_content_score for r in first_half])
		second_avg = np.mean([r.overall_content_score for r in second_half])
		
		return {
			"early_average_score": first_avg,
			"recent_average_score": second_avg,
			"improvement_trend": second_avg - first_avg
		}
	
	# Logging methods
	
	def _log_initialization(self):
		print("ContentRecommender: Initialized for intelligent content analysis and improvement recommendations")
	
	def _log_analysis_start(self, section_type: ProposalSection):
		print(f"ContentRecommender: Starting content analysis for {section_type.value}")
	
	def _log_analysis_complete(self, section_type: ProposalSection, score: float, issues: int):
		print(f"ContentRecommender: Completed analysis for {section_type.value} - Score: {score:.1f}, Issues: {issues}")
	
	def _log_analysis_error(self, message: str):
		print(f"ContentRecommender Error: {message}")


# Example usage and testing
async def create_sample_content_recommendation():
	"""Create sample content recommendation for testing"""
	
	# Initialize recommender
	recommender = ContentRecommender()
	
	# Sample content for analysis
	sample_content = """
	Our technical approach leverages proven methodologies and industry best practices to deliver 
	comprehensive solutions. We will implement an agile development framework that ensures quality 
	deliverables on schedule. The team has successfully delivered similar projects with excellent results.
	
	Our methodology includes requirements analysis, system design, development, testing, and deployment phases.
	Quality assurance will be maintained throughout the project lifecycle. Risk management strategies 
	will be employed to mitigate potential issues.
	
	The proposed solution utilizes cloud-based architecture for scalability and performance optimization.
	We have demonstrated expertise in similar implementations with measurable improvements in efficiency.
	"""
	
	# Sample requirements
	requirements = [
		"Must include detailed technical methodology",
		"Shall provide risk management approach", 
		"Must demonstrate relevant experience",
		"Shall include quality assurance procedures"
	]
	
	# Analyze content
	report = await recommender.analyze_content(
		sample_content, 
		ProposalSection.TECHNICAL_APPROACH,
		requirements=requirements
	)
	
	return report, recommender.get_content_analysis_statistics()


if __name__ == "__main__":
	# Test the content recommender
	import asyncio
	
	async def main():
		report, stats = await create_sample_content_recommendation()
		
		print("Content Recommendation Report:")
		print("=" * 50)
		print(f"Section: {report.section_type.value}")
		print(f"Overall Score: {report.overall_content_score:.1f}/100")
		print(f"Content Length: {report.content_analysis.content_length} words")
		
		print(f"\nQuality Metrics:")
		print(f"  Readability: {report.content_analysis.readability_score:.3f}")
		print(f"  Technical Depth: {report.content_analysis.technical_depth_score:.3f}")
		print(f"  Compliance: {report.content_analysis.compliance_score:.3f}")
		print(f"  Evidence Strength: {report.content_analysis.evidence_strength_score:.3f}")
		
		print(f"\nCritical Issues ({len(report.critical_issues)}):")
		for issue in report.critical_issues[:3]:
			print(f"  🚨 {issue.severity.upper()}: {issue.description}")
		
		print(f"\nTop Improvement Suggestions:")
		for suggestion in report.improvement_suggestions[:3]:
			print(f"  💡 {suggestion.title} ({suggestion.priority} priority)")
			print(f"     {suggestion.description}")
		
		print(f"\nQuick Wins:")
		for win in report.quick_wins[:3]:
			print(f"  ⚡ {win}")
		
		print(f"\nExpected Improvement: {report.expected_score_improvement:.1f} points")
		print(f"Implementation Timeline: {report.implementation_timeline}")
	
	asyncio.run(main())