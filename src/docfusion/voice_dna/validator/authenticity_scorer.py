"""
Authenticity Scorer

This module provides authenticity measurement and organizational voice compliance
scoring. Determines how authentic and compliant content is with an organization's
established voice, brand consistency, competitive differentiation, and audience
appropriateness.
"""

import asyncio
import re
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple
from dataclasses import dataclass
from enum import Enum
import statistics
import math

from pydantic import BaseModel, Field, ConfigDict
from uuid import uuid4

# Import voice analysis components
from ..analyzer.voice_pattern_analyzer import VoiceFingerprint, WritingPattern, VoiceComponent
from ..analyzer.style_pattern_extractor import StyleProfile, StylePattern, StyleDimension

# NLP imports with fallbacks
try:
	import numpy as np
	from sklearn.feature_extraction.text import TfidfVectorizer
	from sklearn.metrics.pairwise import cosine_similarity
	SKLEARN_AVAILABLE = True
except ImportError:
	SKLEARN_AVAILABLE = False


class AuthenticityDimension(str, Enum):
	"""Dimensions of authenticity assessment"""
	
	VOICE_CONSISTENCY = "voice_consistency"
	BRAND_ALIGNMENT = "brand_alignment"
	COMPETITIVE_DIFFERENTIATION = "competitive_differentiation"
	AUDIENCE_APPROPRIATENESS = "audience_appropriateness"
	CULTURAL_AUTHENTICITY = "cultural_authenticity"
	TECHNICAL_CREDIBILITY = "technical_credibility"
	EMOTIONAL_ALIGNMENT = "emotional_alignment"
	STYLISTIC_COHERENCE = "stylistic_coherence"


class AuthenticityFactor(BaseModel):
	"""Individual factor contributing to authenticity score"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	factor_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique factor identifier")
	dimension: AuthenticityDimension = Field(description="Authenticity dimension")
	factor_name: str = Field(description="Name of the authenticity factor")
	
	# Measurements
	score: float = Field(ge=0.0, le=1.0, description="Authenticity score for this factor")
	weight: float = Field(ge=0.0, le=1.0, description="Weight/importance of this factor")
	confidence: float = Field(ge=0.0, le=1.0, description="Confidence in measurement")
	
	# Evidence and reasoning
	evidence_snippets: List[str] = Field(description="Text snippets supporting this score")
	positive_indicators: List[str] = Field(description="Elements that support authenticity")
	negative_indicators: List[str] = Field(description="Elements that detract from authenticity")
	
	# Detailed analysis
	analysis_details: Dict[str, Any] = Field(description="Detailed analysis data")
	improvement_opportunities: List[str] = Field(description="Specific improvement suggestions")
	
	# Metadata
	measured_timestamp: datetime = Field(default_factory=datetime.now)


class AuthenticityReport(BaseModel):
	"""Comprehensive authenticity assessment report"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	report_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique report identifier")
	organization_name: str = Field(description="Organization being assessed")
	text_analyzed: str = Field(description="Text that was analyzed")
	
	# Overall authenticity metrics
	overall_authenticity_score: float = Field(ge=0.0, le=1.0, description="Overall authenticity score")
	authenticity_confidence: float = Field(ge=0.0, le=1.0, description="Confidence in authenticity assessment")
	authenticity_grade: str = Field(description="Letter grade for authenticity (A-F)")
	
	# Dimension scores
	dimension_scores: Dict[str, float] = Field(description="Scores by authenticity dimension")
	dimension_weights: Dict[str, float] = Field(description="Weights applied to each dimension")
	
	# Factor analysis
	authenticity_factors: List[AuthenticityFactor] = Field(description="Detailed authenticity factors")
	
	# Compliance metrics
	brand_compliance_score: float = Field(ge=0.0, le=1.0, description="Brand compliance score")
	voice_consistency_score: float = Field(ge=0.0, le=1.0, description="Voice consistency score")
	audience_alignment_score: float = Field(ge=0.0, le=1.0, description="Audience alignment score")
	
	# Competitive analysis
	competitive_differentiation_score: float = Field(ge=0.0, le=1.0, description="How well content differentiates from competitors")
	unique_value_proposition_strength: float = Field(ge=0.0, le=1.0, description="Strength of unique positioning")
	
	# Recommendations
	top_authenticity_strengths: List[str] = Field(description="Top 3 authenticity strengths")
	critical_improvements_needed: List[str] = Field(description="Critical improvements for authenticity")
	recommended_actions: List[str] = Field(description="Specific recommended actions")
	
	# Quality indicators
	analysis_completeness: float = Field(ge=0.0, le=1.0, description="Completeness of authenticity analysis")
	measurement_reliability: float = Field(ge=0.0, le=1.0, description="Reliability of measurements")
	
	# Analysis metadata
	analysis_timestamp: datetime = Field(default_factory=datetime.now)
	analysis_duration_seconds: float = Field(description="Time taken for analysis")
	words_analyzed: int = Field(description="Number of words analyzed")


class AuthenticityScorer:
	"""
	Organizational voice authenticity and compliance scorer
	
	Provides comprehensive authenticity measurement across multiple dimensions
	including voice consistency, brand alignment, competitive differentiation,
	and audience appropriateness for organizational communications.
	"""
	
	def __init__(self):
		# Initialize scoring configuration
		self._initialize_authenticity_dimensions()
		
		# Initialize brand and competitive lexicons
		self._initialize_brand_lexicons()
		self._initialize_competitive_markers()
		
		# Scoring parameters
		self.min_text_length = 50  # Minimum characters for reliable scoring
		self.dimension_weights = self._get_default_dimension_weights()
		
		# Performance tracking
		self.total_assessments = 0
		self.average_assessment_time = 0.0
		self.authenticity_score_distribution = []
		
		self._log_initialization()
	
	def _initialize_authenticity_dimensions(self):
		"""Initialize authenticity assessment dimensions"""
		
		self.dimension_analyzers = {
			AuthenticityDimension.VOICE_CONSISTENCY: self._analyze_voice_consistency,
			AuthenticityDimension.BRAND_ALIGNMENT: self._analyze_brand_alignment,
			AuthenticityDimension.COMPETITIVE_DIFFERENTIATION: self._analyze_competitive_differentiation,
			AuthenticityDimension.AUDIENCE_APPROPRIATENESS: self._analyze_audience_appropriateness,
			AuthenticityDimension.CULTURAL_AUTHENTICITY: self._analyze_cultural_authenticity,
			AuthenticityDimension.TECHNICAL_CREDIBILITY: self._analyze_technical_credibility,
			AuthenticityDimension.EMOTIONAL_ALIGNMENT: self._analyze_emotional_alignment,
			AuthenticityDimension.STYLISTIC_COHERENCE: self._analyze_stylistic_coherence
		}
	
	def _initialize_brand_lexicons(self):
		"""Initialize brand-related vocabulary lexicons"""
		
		self.brand_value_indicators = {
			'innovation': {
				'positive': {'innovative', 'cutting-edge', 'revolutionary', 'groundbreaking', 'pioneering', 'breakthrough'},
				'negative': {'outdated', 'traditional', 'conventional', 'old-fashioned', 'legacy'}
			},
			'quality': {
				'positive': {'excellence', 'superior', 'premium', 'world-class', 'outstanding', 'exceptional'},
				'negative': {'mediocre', 'average', 'substandard', 'inferior', 'basic'}
			},
			'reliability': {
				'positive': {'reliable', 'dependable', 'consistent', 'stable', 'trustworthy', 'proven'},
				'negative': {'unreliable', 'inconsistent', 'unstable', 'questionable', 'unproven'}
			},
			'collaboration': {
				'positive': {'partnership', 'teamwork', 'collaborative', 'together', 'alliance', 'cooperative'},
				'negative': {'isolated', 'independent', 'separate', 'individual', 'solitary'}
			},
			'expertise': {
				'positive': {'expert', 'specialized', 'experienced', 'skilled', 'knowledgeable', 'proficient'},
				'negative': {'inexperienced', 'novice', 'unskilled', 'amateur', 'generalist'}
			}
		}
		
		self.brand_messaging_patterns = {
			'value_proposition': [
				r'we (?:provide|offer|deliver|enable)',
				r'our (?:solution|approach|methodology|expertise)',
				r'unique (?:value|benefit|advantage|capability)',
				r'differentiates? (?:us|our)'
			],
			'credibility_claims': [
				r'proven (?:track record|experience|success)',
				r'(?:\d+\+?|\w+) years? of experience',
				r'successfully (?:delivered|implemented|completed)',
				r'recognized (?:leader|expert|authority)'
			],
			'customer_focus': [
				r'your (?:needs|requirements|goals|objectives)',
				r'understand your (?:business|challenges|industry)',
				r'tailored to your (?:specific|unique)',
				r'focused on your success'
			]
		}
	
	def _initialize_competitive_markers(self):
		"""Initialize competitive differentiation markers"""
		
		self.competitive_language = {
			'direct_comparison': {
				'better than', 'superior to', 'outperform', 'exceed', 'surpass',
				'unlike competitors', 'competitive advantage', 'market leader'
			},
			'indirect_differentiation': {
				'unique approach', 'distinctive methodology', 'proprietary',
				'exclusive', 'specialized', 'differentiated', 'unmatched'
			},
			'commodity_language': {
				'industry standard', 'common practice', 'typical approach',
				'like others', 'similar to', 'standard solution'
			}
		}
		
		self.authenticity_red_flags = {
			'generic_claims': {
				'best in class', 'industry leading', 'world class', 'cutting edge',
				'state of the art', 'revolutionary', 'game changing'
			},
			'unsupported_superlatives': {
				'always', 'never', 'perfect', 'guaranteed', 'flawless',
				'ultimate', 'maximum', 'optimal', 'ideal'
			},
			'vague_language': {
				'synergy', 'leverage', 'paradigm', 'holistic', 'seamless',
				'robust', 'scalable', 'flexible', 'comprehensive'
			}
		}
	
	def _get_default_dimension_weights(self) -> Dict[str, float]:
		"""Get default weights for authenticity dimensions"""
		
		return {
			AuthenticityDimension.VOICE_CONSISTENCY.value: 0.20,
			AuthenticityDimension.BRAND_ALIGNMENT.value: 0.18,
			AuthenticityDimension.COMPETITIVE_DIFFERENTIATION.value: 0.15,
			AuthenticityDimension.AUDIENCE_APPROPRIATENESS.value: 0.12,
			AuthenticityDimension.CULTURAL_AUTHENTICITY.value: 0.10,
			AuthenticityDimension.TECHNICAL_CREDIBILITY.value: 0.10,
			AuthenticityDimension.EMOTIONAL_ALIGNMENT.value: 0.08,
			AuthenticityDimension.STYLISTIC_COHERENCE.value: 0.07
		}
	
	async def assess_authenticity(self, text: str,
	                              organization_name: str,
	                              voice_profile: Optional[VoiceFingerprint] = None,
	                              style_profile: Optional[StyleProfile] = None,
	                              target_audience: Optional[str] = None,
	                              competitive_context: Optional[List[str]] = None,
	                              custom_weights: Optional[Dict[str, float]] = None) -> AuthenticityReport:
		"""
		Assess authenticity of text against organizational voice and brand
		
		Args:
			text: Text to assess for authenticity
			organization_name: Organization name
			voice_profile: Voice fingerprint for comparison
			style_profile: Style profile for comparison
			target_audience: Target audience description
			competitive_context: List of competitive context information
			custom_weights: Custom weights for authenticity dimensions
			
		Returns:
			Comprehensive authenticity assessment report
		"""
		start_time = datetime.now()
		
		try:
			self._log_assessment_start(organization_name, len(text))
			
			# Validate input
			if len(text) < self.min_text_length:
				raise ValueError(f"Text too short for reliable assessment: {len(text)} characters (minimum: {self.min_text_length})")
			
			# Use custom weights if provided
			dimension_weights = custom_weights or self.dimension_weights
			
			# Initialize authenticity factors collection
			authenticity_factors = []
			dimension_scores = {}
			
			# Assess each authenticity dimension
			for dimension, analyzer in self.dimension_analyzers.items():
				factors, score = await analyzer(
					text, organization_name, voice_profile, style_profile, 
					target_audience, competitive_context
				)
				authenticity_factors.extend(factors)
				dimension_scores[dimension.value] = score
			
			# Calculate weighted overall score
			overall_score = self._calculate_weighted_score(dimension_scores, dimension_weights)
			
			# Calculate specific compliance metrics
			brand_compliance = dimension_scores.get(AuthenticityDimension.BRAND_ALIGNMENT.value, 0.0)
			voice_consistency = dimension_scores.get(AuthenticityDimension.VOICE_CONSISTENCY.value, 0.0)
			audience_alignment = dimension_scores.get(AuthenticityDimension.AUDIENCE_APPROPRIATENESS.value, 0.0)
			competitive_diff = dimension_scores.get(AuthenticityDimension.COMPETITIVE_DIFFERENTIATION.value, 0.0)
			
			# Determine authenticity grade
			authenticity_grade = self._calculate_authenticity_grade(overall_score)
			
			# Calculate quality indicators
			analysis_completeness = self._calculate_analysis_completeness(authenticity_factors)
			measurement_reliability = self._calculate_measurement_reliability(authenticity_factors, len(text))
			authenticity_confidence = (analysis_completeness + measurement_reliability) / 2
			
			# Generate recommendations
			strengths = self._identify_authenticity_strengths(authenticity_factors)
			critical_improvements = self._identify_critical_improvements(authenticity_factors)
			recommendations = self._generate_authenticity_recommendations(authenticity_factors)
			
			# Assess unique value proposition
			uvp_strength = await self._assess_unique_value_proposition(text, competitive_context)
			
			# Create comprehensive report
			authenticity_report = AuthenticityReport(
				organization_name=organization_name,
				text_analyzed=text[:500] + "..." if len(text) > 500 else text,
				overall_authenticity_score=overall_score,
				authenticity_confidence=authenticity_confidence,
				authenticity_grade=authenticity_grade,
				dimension_scores=dimension_scores,
				dimension_weights=dimension_weights,
				authenticity_factors=authenticity_factors,
				brand_compliance_score=brand_compliance,
				voice_consistency_score=voice_consistency,
				audience_alignment_score=audience_alignment,
				competitive_differentiation_score=competitive_diff,
				unique_value_proposition_strength=uvp_strength,
				top_authenticity_strengths=strengths,
				critical_improvements_needed=critical_improvements,
				recommended_actions=recommendations,
				analysis_completeness=analysis_completeness,
				measurement_reliability=measurement_reliability,
				analysis_duration_seconds=(datetime.now() - start_time).total_seconds(),
				words_analyzed=len(text.split())
			)
			
			# Update performance tracking
			self._update_performance_tracking(authenticity_report)
			
			self._log_assessment_complete(
				organization_name, overall_score, len(authenticity_factors), 
				authenticity_report.analysis_duration_seconds
			)
			
			return authenticity_report
			
		except Exception as e:
			self._log_assessment_error(f"Authenticity assessment failed for {organization_name}: {str(e)}")
			raise
	
	async def _analyze_voice_consistency(self, text: str, organization_name: str,
	                                     voice_profile: Optional[VoiceFingerprint], 
	                                     style_profile: Optional[StyleProfile],
	                                     target_audience: Optional[str],
	                                     competitive_context: Optional[List[str]]) -> Tuple[List[AuthenticityFactor], float]:
		"""Analyze voice consistency authenticity"""
		
		factors = []
		
		if not voice_profile:
			# Without voice profile, return neutral score
			factor = AuthenticityFactor(
				dimension=AuthenticityDimension.VOICE_CONSISTENCY,
				factor_name="voice_profile_unavailable",
				score=0.5,
				weight=1.0,
				confidence=0.3,
				evidence_snippets=[],
				positive_indicators=["No voice profile available for comparison"],
				negative_indicators=[],
				analysis_details={"status": "no_voice_profile"},
				improvement_opportunities=["Establish organizational voice profile for comparison"]
			)
			return [factor], 0.5
		
		# Vocabulary consistency
		vocab_consistency = await self._measure_vocabulary_consistency(text, voice_profile)
		vocab_factor = AuthenticityFactor(
			dimension=AuthenticityDimension.VOICE_CONSISTENCY,
			factor_name="vocabulary_consistency",
			score=vocab_consistency,
			weight=0.4,
			confidence=0.8,
			evidence_snippets=self._extract_vocabulary_examples(text, voice_profile),
			positive_indicators=self._get_positive_vocab_indicators(text, voice_profile),
			negative_indicators=self._get_negative_vocab_indicators(text, voice_profile),
			analysis_details={"vocabulary_overlap": vocab_consistency},
			improvement_opportunities=self._get_vocabulary_improvements(text, voice_profile)
		)
		factors.append(vocab_factor)
		
		# Tone consistency
		tone_consistency = await self._measure_tone_consistency(text, voice_profile)
		tone_factor = AuthenticityFactor(
			dimension=AuthenticityDimension.VOICE_CONSISTENCY,
			factor_name="tone_consistency",
			score=tone_consistency,
			weight=0.3,
			confidence=0.7,
			evidence_snippets=self._extract_tone_examples(text),
			positive_indicators=self._get_positive_tone_indicators(text, voice_profile),
			negative_indicators=self._get_negative_tone_indicators(text, voice_profile),
			analysis_details={"tone_alignment": tone_consistency},
			improvement_opportunities=self._get_tone_improvements(text, voice_profile)
		)
		factors.append(tone_factor)
		
		# Formality consistency
		formality_consistency = await self._measure_formality_consistency(text, voice_profile)
		formality_factor = AuthenticityFactor(
			dimension=AuthenticityDimension.VOICE_CONSISTENCY,
			factor_name="formality_consistency",
			score=formality_consistency,
			weight=0.3,
			confidence=0.8,
			evidence_snippets=self._extract_formality_examples(text),
			positive_indicators=self._get_positive_formality_indicators(text, voice_profile),
			negative_indicators=self._get_negative_formality_indicators(text, voice_profile),
			analysis_details={"formality_alignment": formality_consistency},
			improvement_opportunities=self._get_formality_improvements(text, voice_profile)
		)
		factors.append(formality_factor)
		
		# Calculate weighted dimension score
		weighted_score = sum(f.score * f.weight for f in factors) / sum(f.weight for f in factors)
		
		return factors, weighted_score
	
	async def _analyze_brand_alignment(self, text: str, organization_name: str,
	                                   voice_profile: Optional[VoiceFingerprint],
	                                   style_profile: Optional[StyleProfile],
	                                   target_audience: Optional[str],
	                                   competitive_context: Optional[List[str]]) -> Tuple[List[AuthenticityFactor], float]:
		"""Analyze brand alignment authenticity"""
		
		factors = []
		
		# Brand value expression
		brand_values_score, brand_evidence = await self._assess_brand_value_expression(text)
		brand_values_factor = AuthenticityFactor(
			dimension=AuthenticityDimension.BRAND_ALIGNMENT,
			factor_name="brand_value_expression",
			score=brand_values_score,
			weight=0.4,
			confidence=0.8,
			evidence_snippets=brand_evidence,
			positive_indicators=self._get_positive_brand_indicators(text),
			negative_indicators=self._get_negative_brand_indicators(text),
			analysis_details={"brand_value_alignment": brand_values_score},
			improvement_opportunities=self._get_brand_value_improvements(text)
		)
		factors.append(brand_values_factor)
		
		# Brand messaging consistency
		messaging_score, messaging_evidence = await self._assess_brand_messaging(text)
		messaging_factor = AuthenticityFactor(
			dimension=AuthenticityDimension.BRAND_ALIGNMENT,
			factor_name="brand_messaging_consistency",
			score=messaging_score,
			weight=0.35,
			confidence=0.7,
			evidence_snippets=messaging_evidence,
			positive_indicators=self._get_positive_messaging_indicators(text),
			negative_indicators=self._get_negative_messaging_indicators(text),
			analysis_details={"messaging_strength": messaging_score},
			improvement_opportunities=self._get_messaging_improvements(text)
		)
		factors.append(messaging_factor)
		
		# Generic language avoidance
		generic_avoidance_score = await self._assess_generic_language_avoidance(text)
		generic_factor = AuthenticityFactor(
			dimension=AuthenticityDimension.BRAND_ALIGNMENT,
			factor_name="generic_language_avoidance",
			score=generic_avoidance_score,
			weight=0.25,
			confidence=0.9,
			evidence_snippets=self._extract_generic_language_examples(text),
			positive_indicators=self._get_positive_specificity_indicators(text),
			negative_indicators=self._get_negative_generic_indicators(text),
			analysis_details={"generic_language_ratio": 1.0 - generic_avoidance_score},
			improvement_opportunities=self._get_generic_language_improvements(text)
		)
		factors.append(generic_factor)
		
		# Calculate weighted dimension score
		weighted_score = sum(f.score * f.weight for f in factors) / sum(f.weight for f in factors)
		
		return factors, weighted_score
	
	async def _analyze_competitive_differentiation(self, text: str, organization_name: str,
	                                               voice_profile: Optional[VoiceFingerprint],
	                                               style_profile: Optional[StyleProfile],
	                                               target_audience: Optional[str],
	                                               competitive_context: Optional[List[str]]) -> Tuple[List[AuthenticityFactor], float]:
		"""Analyze competitive differentiation authenticity"""
		
		factors = []
		
		# Differentiation clarity
		diff_clarity_score = await self._assess_differentiation_clarity(text)
		clarity_factor = AuthenticityFactor(
			dimension=AuthenticityDimension.COMPETITIVE_DIFFERENTIATION,
			factor_name="differentiation_clarity",
			score=diff_clarity_score,
			weight=0.4,
			confidence=0.7,
			evidence_snippets=self._extract_differentiation_examples(text),
			positive_indicators=self._get_positive_differentiation_indicators(text),
			negative_indicators=self._get_negative_differentiation_indicators(text),
			analysis_details={"differentiation_strength": diff_clarity_score},
			improvement_opportunities=self._get_differentiation_improvements(text)
		)
		factors.append(clarity_factor)
		
		# Unique value proposition
		uvp_score = await self._assess_unique_value_proposition(text, competitive_context)
		uvp_factor = AuthenticityFactor(
			dimension=AuthenticityDimension.COMPETITIVE_DIFFERENTIATION,
			factor_name="unique_value_proposition",
			score=uvp_score,
			weight=0.35,
			confidence=0.6,
			evidence_snippets=self._extract_uvp_examples(text),
			positive_indicators=self._get_positive_uvp_indicators(text),
			negative_indicators=self._get_negative_uvp_indicators(text),
			analysis_details={"uvp_strength": uvp_score},
			improvement_opportunities=self._get_uvp_improvements(text)
		)
		factors.append(uvp_factor)
		
		# Commodity language avoidance
		commodity_avoidance = await self._assess_commodity_language_avoidance(text)
		commodity_factor = AuthenticityFactor(
			dimension=AuthenticityDimension.COMPETITIVE_DIFFERENTIATION,
			factor_name="commodity_language_avoidance",
			score=commodity_avoidance,
			weight=0.25,
			confidence=0.8,
			evidence_snippets=self._extract_commodity_examples(text),
			positive_indicators=self._get_positive_uniqueness_indicators(text),
			negative_indicators=self._get_negative_commodity_indicators(text),
			analysis_details={"commodity_language_ratio": 1.0 - commodity_avoidance},
			improvement_opportunities=self._get_commodity_improvements(text)
		)
		factors.append(commodity_factor)
		
		# Calculate weighted dimension score
		weighted_score = sum(f.score * f.weight for f in factors) / sum(f.weight for f in factors)
		
		return factors, weighted_score
	
	async def _analyze_audience_appropriateness(self, text: str, organization_name: str,
	                                            voice_profile: Optional[VoiceFingerprint],
	                                            style_profile: Optional[StyleProfile],
	                                            target_audience: Optional[str],
	                                            competitive_context: Optional[List[str]]) -> Tuple[List[AuthenticityFactor], float]:
		"""Analyze audience appropriateness authenticity"""
		
		factors = []
		
		# Complexity appropriateness
		complexity_score = await self._assess_complexity_appropriateness(text, target_audience)
		complexity_factor = AuthenticityFactor(
			dimension=AuthenticityDimension.AUDIENCE_APPROPRIATENESS,
			factor_name="complexity_appropriateness",
			score=complexity_score,
			weight=0.4,
			confidence=0.7,
			evidence_snippets=self._extract_complexity_examples(text),
			positive_indicators=self._get_positive_complexity_indicators(text, target_audience),
			negative_indicators=self._get_negative_complexity_indicators(text, target_audience),
			analysis_details={"complexity_alignment": complexity_score},
			improvement_opportunities=self._get_complexity_improvements(text, target_audience)
		)
		factors.append(complexity_factor)
		
		# Terminology appropriateness  
		terminology_score = await self._assess_terminology_appropriateness(text, target_audience)
		terminology_factor = AuthenticityFactor(
			dimension=AuthenticityDimension.AUDIENCE_APPROPRIATENESS,
			factor_name="terminology_appropriateness",
			score=terminology_score,
			weight=0.35,
			confidence=0.6,
			evidence_snippets=self._extract_terminology_examples(text),
			positive_indicators=self._get_positive_terminology_indicators(text, target_audience),
			negative_indicators=self._get_negative_terminology_indicators(text, target_audience),
			analysis_details={"terminology_alignment": terminology_score},
			improvement_opportunities=self._get_terminology_improvements(text, target_audience)
		)
		factors.append(terminology_factor)
		
		# Context relevance
		context_score = await self._assess_context_relevance(text, target_audience)
		context_factor = AuthenticityFactor(
			dimension=AuthenticityDimension.AUDIENCE_APPROPRIATENESS,
			factor_name="context_relevance",
			score=context_score,
			weight=0.25,
			confidence=0.5,
			evidence_snippets=self._extract_context_examples(text),
			positive_indicators=self._get_positive_context_indicators(text, target_audience),
			negative_indicators=self._get_negative_context_indicators(text, target_audience),
			analysis_details={"context_alignment": context_score},
			improvement_opportunities=self._get_context_improvements(text, target_audience)
		)
		factors.append(context_factor)
		
		# Calculate weighted dimension score
		weighted_score = sum(f.score * f.weight for f in factors) / sum(f.weight for f in factors)
		
		return factors, weighted_score
	
	# Implement remaining dimension analyzers with similar patterns...
	# For brevity, showing abbreviated implementations
	
	async def _analyze_cultural_authenticity(self, *args) -> Tuple[List[AuthenticityFactor], float]:
		"""Analyze cultural authenticity (abbreviated implementation)"""
		factor = AuthenticityFactor(
			dimension=AuthenticityDimension.CULTURAL_AUTHENTICITY,
			factor_name="cultural_alignment",
			score=0.7,  # Placeholder
			weight=1.0,
			confidence=0.5,
			evidence_snippets=[],
			positive_indicators=["Neutral cultural markers"],
			negative_indicators=[],
			analysis_details={},
			improvement_opportunities=["Enhance cultural alignment"]
		)
		return [factor], 0.7
	
	async def _analyze_technical_credibility(self, *args) -> Tuple[List[AuthenticityFactor], float]:
		"""Analyze technical credibility (abbreviated implementation)"""
		factor = AuthenticityFactor(
			dimension=AuthenticityDimension.TECHNICAL_CREDIBILITY,
			factor_name="technical_accuracy",
			score=0.75,  # Placeholder
			weight=1.0,
			confidence=0.6,
			evidence_snippets=[],
			positive_indicators=["Appropriate technical depth"],
			negative_indicators=[],
			analysis_details={},
			improvement_opportunities=["Enhance technical precision"]
		)
		return [factor], 0.75
	
	async def _analyze_emotional_alignment(self, *args) -> Tuple[List[AuthenticityFactor], float]:
		"""Analyze emotional alignment (abbreviated implementation)"""
		factor = AuthenticityFactor(
			dimension=AuthenticityDimension.EMOTIONAL_ALIGNMENT,
			factor_name="emotional_resonance",
			score=0.6,  # Placeholder
			weight=1.0,
			confidence=0.5,
			evidence_snippets=[],
			positive_indicators=["Appropriate emotional tone"],
			negative_indicators=[],
			analysis_details={},
			improvement_opportunities=["Strengthen emotional connection"]
		)
		return [factor], 0.6
	
	async def _analyze_stylistic_coherence(self, *args) -> Tuple[List[AuthenticityFactor], float]:
		"""Analyze stylistic coherence (abbreviated implementation)"""
		factor = AuthenticityFactor(
			dimension=AuthenticityDimension.STYLISTIC_COHERENCE,
			factor_name="style_consistency",
			score=0.8,  # Placeholder
			weight=1.0,
			confidence=0.7,
			evidence_snippets=[],
			positive_indicators=["Consistent style throughout"],
			negative_indicators=[],
			analysis_details={},
			improvement_opportunities=["Maintain stylistic consistency"]
		)
		return [factor], 0.8
	
	# Helper methods for measurements and analysis
	
	async def _measure_vocabulary_consistency(self, text: str, voice_profile: VoiceFingerprint) -> float:
		"""Measure vocabulary consistency against voice profile"""
		words = set(text.lower().split())
		profile_vocab = set(voice_profile.vocabulary_signature.keys())
		
		if not words:
			return 0.0
		
		overlap = len(words.intersection(profile_vocab))
		return overlap / len(words)
	
	async def _measure_tone_consistency(self, text: str, voice_profile: VoiceFingerprint) -> float:
		"""Measure tone consistency against voice profile"""
		# Simplified implementation
		text_lower = text.lower()
		tone_score = 0.0
		
		for tone, expected_level in voice_profile.tone_profile.items():
			if tone == 'professional' and expected_level > 0.01:
				professional_indicators = ['pleased', 'appreciate', 'recommend', 'respectfully']
				found_indicators = sum(1 for indicator in professional_indicators if indicator in text_lower)
				tone_score += min(found_indicators / 10.0, expected_level)
		
		return min(tone_score, 1.0)
	
	async def _measure_formality_consistency(self, text: str, voice_profile: VoiceFingerprint) -> float:
		"""Measure formality consistency against voice profile"""
		# Calculate text formality
		formal_words = {'furthermore', 'moreover', 'consequently', 'therefore'}
		informal_words = {'yeah', 'okay', 'gonna', 'really'}
		
		words = text.lower().split()
		formal_count = sum(1 for word in words if word in formal_words)
		informal_count = sum(1 for word in words if word in informal_words)
		
		if formal_count + informal_count == 0:
			text_formality = 0.5
		else:
			text_formality = formal_count / (formal_count + informal_count)
		
		# Compare to expected formality
		expected_formality = voice_profile.formality_level
		difference = abs(text_formality - expected_formality)
		return max(0.0, 1.0 - difference)
	
	async def _assess_brand_value_expression(self, text: str) -> Tuple[float, List[str]]:
		"""Assess how well text expresses brand values"""
		text_lower = text.lower()
		evidence = []
		brand_score = 0.0
		
		for brand_value, indicators in self.brand_value_indicators.items():
			positive_count = sum(1 for word in indicators['positive'] if word in text_lower)
			negative_count = sum(1 for word in indicators['negative'] if word in text_lower)
			
			if positive_count > 0:
				evidence.append(f"Expresses {brand_value} values")
				brand_score += positive_count * 0.1
			
			if negative_count > 0:
				evidence.append(f"Contains language contrary to {brand_value}")
				brand_score -= negative_count * 0.05
		
		return min(max(brand_score, 0.0), 1.0), evidence[:5]
	
	async def _assess_brand_messaging(self, text: str) -> Tuple[float, List[str]]:
		"""Assess brand messaging consistency"""
		evidence = []
		messaging_score = 0.0
		
		for pattern_type, patterns in self.brand_messaging_patterns.items():
			for pattern in patterns:
				matches = re.findall(pattern, text.lower())
				if matches:
					evidence.append(f"Contains {pattern_type.replace('_', ' ')} messaging")
					messaging_score += len(matches) * 0.2
		
		return min(messaging_score, 1.0), evidence[:5]
	
	async def _assess_generic_language_avoidance(self, text: str) -> float:
		"""Assess avoidance of generic business language"""
		text_lower = text.lower()
		words = text_lower.split()
		
		if not words:
			return 0.5
		
		generic_count = 0
		for generic_set in self.authenticity_red_flags.values():
			for phrase in generic_set:
				if phrase in text_lower:
					generic_count += text_lower.count(phrase)
		
		generic_ratio = generic_count / len(words)
		return max(0.0, 1.0 - generic_ratio * 10)  # Penalize generic language
	
	async def _assess_differentiation_clarity(self, text: str) -> float:
		"""Assess clarity of competitive differentiation"""
		text_lower = text.lower()
		
		direct_diff_count = sum(1 for phrase in self.competitive_language['direct_comparison'] if phrase in text_lower)
		indirect_diff_count = sum(1 for phrase in self.competitive_language['indirect_differentiation'] if phrase in text_lower)
		commodity_count = sum(1 for phrase in self.competitive_language['commodity_language'] if phrase in text_lower)
		
		differentiation_score = (direct_diff_count * 0.3 + indirect_diff_count * 0.2) - (commodity_count * 0.1)
		return min(max(differentiation_score, 0.0), 1.0)
	
	async def _assess_unique_value_proposition(self, text: str, competitive_context: Optional[List[str]] = None) -> float:
		"""Assess strength of unique value proposition"""
		# Simplified UVP assessment
		text_lower = text.lower()
		
		uvp_indicators = ['unique', 'exclusive', 'proprietary', 'distinctive', 'differentiated', 'only']
		uvp_count = sum(1 for indicator in uvp_indicators if indicator in text_lower)
		
		value_indicators = ['value', 'benefit', 'advantage', 'outcome', 'result', 'impact']
		value_count = sum(1 for indicator in value_indicators if indicator in text_lower)
		
		uvp_strength = min((uvp_count + value_count) * 0.1, 1.0)
		return uvp_strength
	
	async def _assess_commodity_language_avoidance(self, text: str) -> float:
		"""Assess avoidance of commodity language"""
		text_lower = text.lower()
		words = text_lower.split()
		
		if not words:
			return 0.5
		
		commodity_count = sum(1 for phrase in self.competitive_language['commodity_language'] if phrase in text_lower)
		commodity_ratio = commodity_count / len(words)
		
		return max(0.0, 1.0 - commodity_ratio * 20)  # Strong penalty for commodity language
	
	async def _assess_complexity_appropriateness(self, text: str, target_audience: Optional[str]) -> float:
		"""Assess if complexity is appropriate for target audience"""
		# Simplified complexity assessment based on audience
		if not target_audience:
			return 0.5  # Neutral if no audience specified
		
		sentences = text.split('.')
		words = text.split()
		
		if not sentences or not words:
			return 0.5
		
		avg_sentence_length = len(words) / len(sentences)
		
		# Audience-specific complexity expectations
		if 'executive' in target_audience.lower() or 'c-level' in target_audience.lower():
			# Executives prefer concise, high-level content
			ideal_length = 15
		elif 'technical' in target_audience.lower() or 'engineer' in target_audience.lower():
			# Technical audiences can handle more complexity
			ideal_length = 25
		else:
			# General business audience
			ideal_length = 20
		
		complexity_diff = abs(avg_sentence_length - ideal_length)
		complexity_score = max(0.0, 1.0 - complexity_diff / ideal_length)
		
		return complexity_score
	
	async def _assess_terminology_appropriateness(self, text: str, target_audience: Optional[str]) -> float:
		"""Assess if terminology is appropriate for target audience"""
		# Placeholder implementation
		return 0.7
	
	async def _assess_context_relevance(self, text: str, target_audience: Optional[str]) -> float:
		"""Assess context relevance for target audience"""
		# Placeholder implementation
		return 0.6
	
	# Helper methods for extracting examples and indicators
	
	def _extract_vocabulary_examples(self, text: str, voice_profile: VoiceFingerprint) -> List[str]:
		"""Extract vocabulary examples"""
		words = text.lower().split()
		profile_words = set(voice_profile.vocabulary_signature.keys())
		matching_words = [word for word in words[:10] if word in profile_words]
		return matching_words[:5]
	
	def _get_positive_vocab_indicators(self, text: str, voice_profile: VoiceFingerprint) -> List[str]:
		"""Get positive vocabulary indicators"""
		return ["Uses vocabulary consistent with organizational voice"]
	
	def _get_negative_vocab_indicators(self, text: str, voice_profile: VoiceFingerprint) -> List[str]:
		"""Get negative vocabulary indicators"""
		return []
	
	def _get_vocabulary_improvements(self, text: str, voice_profile: VoiceFingerprint) -> List[str]:
		"""Get vocabulary improvement suggestions"""
		return ["Incorporate more organization-specific terminology"]
	
	# Additional helper methods would follow similar patterns...
	# For brevity, including abbreviated implementations
	
	def _extract_tone_examples(self, text: str) -> List[str]:
		return [text[:100] + "..."]
	
	def _get_positive_tone_indicators(self, text: str, voice_profile: VoiceFingerprint) -> List[str]:
		return ["Appropriate tone for organization"]
	
	def _get_negative_tone_indicators(self, text: str, voice_profile: VoiceFingerprint) -> List[str]:
		return []
	
	def _get_tone_improvements(self, text: str, voice_profile: VoiceFingerprint) -> List[str]:
		return ["Align tone with organizational voice"]
	
	def _extract_formality_examples(self, text: str) -> List[str]:
		return [text[:100] + "..."]
	
	def _get_positive_formality_indicators(self, text: str, voice_profile: VoiceFingerprint) -> List[str]:
		return ["Appropriate formality level"]
	
	def _get_negative_formality_indicators(self, text: str, voice_profile: VoiceFingerprint) -> List[str]:
		return []
	
	def _get_formality_improvements(self, text: str, voice_profile: VoiceFingerprint) -> List[str]:
		return ["Adjust formality to match organizational standards"]
	
	# Brand analysis helper methods
	
	def _get_positive_brand_indicators(self, text: str) -> List[str]:
		return ["Expresses brand values effectively"]
	
	def _get_negative_brand_indicators(self, text: str) -> List[str]:
		return []
	
	def _get_brand_value_improvements(self, text: str) -> List[str]:
		return ["Strengthen brand value expression"]
	
	def _get_positive_messaging_indicators(self, text: str) -> List[str]:
		return ["Consistent brand messaging"]
	
	def _get_negative_messaging_indicators(self, text: str) -> List[str]:
		return []
	
	def _get_messaging_improvements(self, text: str) -> List[str]:
		return ["Enhance brand messaging consistency"]
	
	def _extract_generic_language_examples(self, text: str) -> List[str]:
		generic_phrases = []
		for generic_set in self.authenticity_red_flags.values():
			for phrase in generic_set:
				if phrase in text.lower():
					generic_phrases.append(phrase)
		return generic_phrases[:5]
	
	def _get_positive_specificity_indicators(self, text: str) -> List[str]:
		return ["Uses specific, concrete language"]
	
	def _get_negative_generic_indicators(self, text: str) -> List[str]:
		return self._extract_generic_language_examples(text)
	
	def _get_generic_language_improvements(self, text: str) -> List[str]:
		return ["Replace generic business language with specific, concrete terms"]
	
	# Competitive differentiation helpers
	
	def _extract_differentiation_examples(self, text: str) -> List[str]:
		return []
	
	def _get_positive_differentiation_indicators(self, text: str) -> List[str]:
		return ["Clear competitive differentiation"]
	
	def _get_negative_differentiation_indicators(self, text: str) -> List[str]:
		return []
	
	def _get_differentiation_improvements(self, text: str) -> List[str]:
		return ["Strengthen competitive differentiation messaging"]
	
	def _extract_uvp_examples(self, text: str) -> List[str]:
		return []
	
	def _get_positive_uvp_indicators(self, text: str) -> List[str]:
		return ["Strong unique value proposition"]
	
	def _get_negative_uvp_indicators(self, text: str) -> List[str]:
		return []
	
	def _get_uvp_improvements(self, text: str) -> List[str]:
		return ["Clarify and strengthen unique value proposition"]
	
	def _extract_commodity_examples(self, text: str) -> List[str]:
		return []
	
	def _get_positive_uniqueness_indicators(self, text: str) -> List[str]:
		return ["Avoids commodity language"]
	
	def _get_negative_commodity_indicators(self, text: str) -> List[str]:
		return []
	
	def _get_commodity_improvements(self, text: str) -> List[str]:
		return ["Replace commodity language with unique positioning"]
	
	# Audience appropriateness helpers
	
	def _extract_complexity_examples(self, text: str) -> List[str]:
		return []
	
	def _get_positive_complexity_indicators(self, text: str, target_audience: Optional[str]) -> List[str]:
		return ["Appropriate complexity for audience"]
	
	def _get_negative_complexity_indicators(self, text: str, target_audience: Optional[str]) -> List[str]:
		return []
	
	def _get_complexity_improvements(self, text: str, target_audience: Optional[str]) -> List[str]:
		return ["Adjust complexity for target audience"]
	
	def _extract_terminology_examples(self, text: str) -> List[str]:
		return []
	
	def _get_positive_terminology_indicators(self, text: str, target_audience: Optional[str]) -> List[str]:
		return ["Appropriate terminology for audience"]
	
	def _get_negative_terminology_indicators(self, text: str, target_audience: Optional[str]) -> List[str]:
		return []
	
	def _get_terminology_improvements(self, text: str, target_audience: Optional[str]) -> List[str]:
		return ["Adjust terminology for target audience"]
	
	def _extract_context_examples(self, text: str) -> List[str]:
		return []
	
	def _get_positive_context_indicators(self, text: str, target_audience: Optional[str]) -> List[str]:
		return ["Relevant context for audience"]
	
	def _get_negative_context_indicators(self, text: str, target_audience: Optional[str]) -> List[str]:
		return []
	
	def _get_context_improvements(self, text: str, target_audience: Optional[str]) -> List[str]:
		return ["Enhance context relevance for audience"]
	
	# Analysis and scoring helper methods
	
	def _calculate_weighted_score(self, dimension_scores: Dict[str, float], 
	                              dimension_weights: Dict[str, float]) -> float:
		"""Calculate weighted overall authenticity score"""
		
		total_weighted_score = 0.0
		total_weight = 0.0
		
		for dimension, score in dimension_scores.items():
			weight = dimension_weights.get(dimension, 0.0)
			total_weighted_score += score * weight
			total_weight += weight
		
		return total_weighted_score / max(total_weight, 1.0)
	
	def _calculate_authenticity_grade(self, score: float) -> str:
		"""Convert authenticity score to letter grade"""
		
		if score >= 0.9:
			return "A"
		elif score >= 0.8:
			return "B"
		elif score >= 0.7:
			return "C"
		elif score >= 0.6:
			return "D"
		else:
			return "F"
	
	def _calculate_analysis_completeness(self, factors: List[AuthenticityFactor]) -> float:
		"""Calculate completeness of authenticity analysis"""
		
		dimensions_covered = set(factor.dimension for factor in factors)
		total_dimensions = len(AuthenticityDimension)
		
		return len(dimensions_covered) / total_dimensions
	
	def _calculate_measurement_reliability(self, factors: List[AuthenticityFactor], text_length: int) -> float:
		"""Calculate reliability of authenticity measurements"""
		
		if not factors:
			return 0.0
		
		# Reliability factors
		confidence_factor = statistics.mean([f.confidence for f in factors])
		text_length_factor = min(text_length / 500, 1.0)  # 500+ chars for reliability
		factor_count_factor = min(len(factors) / 10, 1.0)  # 10+ factors ideal
		
		return (confidence_factor + text_length_factor + factor_count_factor) / 3
	
	def _identify_authenticity_strengths(self, factors: List[AuthenticityFactor]) -> List[str]:
		"""Identify top authenticity strengths"""
		
		high_scoring_factors = [f for f in factors if f.score >= 0.8]
		strengths = [f"Strong {f.factor_name.replace('_', ' ')}" for f in high_scoring_factors[:3]]
		
		if not strengths:
			strengths = ["Maintains basic authenticity standards"]
		
		return strengths
	
	def _identify_critical_improvements(self, factors: List[AuthenticityFactor]) -> List[str]:
		"""Identify critical improvements needed"""
		
		low_scoring_factors = [f for f in factors if f.score < 0.6]
		improvements = [f"Improve {f.factor_name.replace('_', ' ')}" for f in low_scoring_factors[:3]]
		
		return improvements
	
	def _generate_authenticity_recommendations(self, factors: List[AuthenticityFactor]) -> List[str]:
		"""Generate comprehensive authenticity recommendations"""
		
		all_recommendations = []
		for factor in factors:
			all_recommendations.extend(factor.improvement_opportunities)
		
		# Remove duplicates while preserving order
		unique_recommendations = []
		seen = set()
		for rec in all_recommendations:
			if rec not in seen:
				unique_recommendations.append(rec)
				seen.add(rec)
		
		return unique_recommendations[:5]
	
	def _update_performance_tracking(self, report: AuthenticityReport):
		"""Update performance tracking statistics"""
		
		self.total_assessments += 1
		self.authenticity_score_distribution.append(report.overall_authenticity_score)
		
		# Update average assessment time
		if self.total_assessments == 1:
			self.average_assessment_time = report.analysis_duration_seconds
		else:
			self.average_assessment_time = (
				(self.average_assessment_time * (self.total_assessments - 1) + 
				 report.analysis_duration_seconds) / self.total_assessments
			)
	
	def get_scorer_statistics(self) -> Dict[str, Any]:
		"""Get authenticity scorer performance statistics"""
		
		stats = {
			"total_assessments": self.total_assessments,
			"average_assessment_time_seconds": self.average_assessment_time,
			"dimensions_analyzed": len(AuthenticityDimension),
			"sklearn_available": SKLEARN_AVAILABLE
		}
		
		if self.authenticity_score_distribution:
			stats.update({
				"average_authenticity_score": statistics.mean(self.authenticity_score_distribution),
				"authenticity_score_std": statistics.stdev(self.authenticity_score_distribution) if len(self.authenticity_score_distribution) > 1 else 0.0,
				"highest_authenticity_score": max(self.authenticity_score_distribution),
				"lowest_authenticity_score": min(self.authenticity_score_distribution)
			})
		
		return stats
	
	# Logging methods
	
	def _log_initialization(self):
		print(f"AuthenticityScorer: Initialized with {len(AuthenticityDimension)} authenticity dimensions")
	
	def _log_assessment_start(self, organization: str, text_length: int):
		print(f"AuthenticityScorer: Starting authenticity assessment for {organization} ({text_length} characters)")
	
	def _log_assessment_complete(self, organization: str, score: float, factor_count: int, duration: float):
		print(f"AuthenticityScorer: Assessment complete for {organization} (score: {score:.3f}, {factor_count} factors, {duration:.2f}s)")
	
	def _log_assessment_error(self, message: str):
		print(f"AuthenticityScorer Error: {message}")


# Example usage and testing
async def create_sample_authenticity_assessment():
	"""Create sample authenticity assessment for testing"""
	
	# Initialize scorer
	scorer = AuthenticityScorer()
	
	# Create sample voice profile
	from ..analyzer.voice_pattern_analyzer import VoiceFingerprint
	
	sample_voice_profile = VoiceFingerprint(
		organization_name="Innovation Consulting",
		vocabulary_signature={
			"innovative": 0.008,
			"transform": 0.006,
			"strategic": 0.005,
			"optimize": 0.004,
			"excellence": 0.003
		},
		sentence_patterns={
			"avg_sentence_length": 16.2,
			"declarative_sentences": 0.80,
			"question_sentences": 0.15
		},
		formality_level=0.65,
		complexity_score=0.55,
		tone_profile={
			"professional": 0.015,
			"collaborative": 0.012,
			"confident": 0.008
		},
		persuasion_style={
			"evidence_based": 0.020,
			"benefit_focused": 0.015
		},
		technical_density=0.12,
		patterns=[],
		consistency_score=0.82,
		distinctiveness_score=0.75,
		confidence_level=0.88,
		documents_analyzed=15,
		total_words=35000
	)
	
	# Sample text for authenticity assessment
	test_text = """
	Our innovative approach to digital transformation leverages cutting-edge methodologies 
	to optimize your organizational capabilities. We deliver world-class solutions that 
	transform business operations through strategic excellence and proven expertise. 
	
	Unlike typical consultants who offer generic approaches, our proprietary framework 
	provides unique value through data-driven insights and comprehensive analysis. We've 
	successfully transformed over 200 organizations, delivering measurable results that 
	exceed expectations and drive sustainable growth.
	
	Our collaborative partnership approach ensures seamless integration with your team 
	while maintaining the highest standards of technical excellence. We appreciate the 
	opportunity to demonstrate how our innovative solutions can revolutionize your 
	business operations and establish competitive advantage in your market.
	"""
	
	# Perform authenticity assessment
	assessment_result = await scorer.assess_authenticity(
		test_text, 
		"Innovation Consulting",
		voice_profile=sample_voice_profile,
		target_audience="C-level executives",
		competitive_context=["digital transformation consultants", "management consulting firms"]
	)
	
	return assessment_result, scorer.get_scorer_statistics()


if __name__ == "__main__":
	# Test the authenticity scorer
	import asyncio
	
	async def main():
		result, stats = await create_sample_authenticity_assessment()
		
		print("Authenticity Assessment Results:")
		print("=" * 50)
		print(f"Organization: {result.organization_name}")
		print(f"Overall Authenticity Score: {result.overall_authenticity_score:.3f}")
		print(f"Authenticity Grade: {result.authenticity_grade}")
		print(f"Confidence: {result.authenticity_confidence:.3f}")
		
		print(f"\nDimension Scores:")
		for dimension, score in result.dimension_scores.items():
			weight = result.dimension_weights.get(dimension, 0.0)
			print(f"  {dimension.replace('_', ' ').title()}: {score:.3f} (weight: {weight:.2f})")
		
		print(f"\nCompliance Metrics:")
		print(f"  Brand Compliance: {result.brand_compliance_score:.3f}")
		print(f"  Voice Consistency: {result.voice_consistency_score:.3f}")
		print(f"  Audience Alignment: {result.audience_alignment_score:.3f}")
		print(f"  Competitive Differentiation: {result.competitive_differentiation_score:.3f}")
		print(f"  UVP Strength: {result.unique_value_proposition_strength:.3f}")
		
		print(f"\nTop Authenticity Strengths:")
		for i, strength in enumerate(result.top_authenticity_strengths, 1):
			print(f"  {i}. {strength}")
		
		print(f"\nCritical Improvements Needed:")
		for i, improvement in enumerate(result.critical_improvements_needed, 1):
			print(f"  {i}. {improvement}")
		
		print(f"\nTop Factors:")
		for i, factor in enumerate(result.authenticity_factors[:5], 1):
			print(f"  {i}. {factor.factor_name}: {factor.score:.3f}")
			print(f"     Dimension: {factor.dimension.value}")
			print(f"     Confidence: {factor.confidence:.3f}")
		
		print(f"\nAnalysis Quality:")
		print(f"  Completeness: {result.analysis_completeness:.3f}")
		print(f"  Reliability: {result.measurement_reliability:.3f}")
		print(f"  Duration: {result.analysis_duration_seconds:.3f}s")
		print(f"  Words Analyzed: {result.words_analyzed}")
		
		print(f"\nScorer Statistics:")
		for key, value in stats.items():
			print(f"  {key.replace('_', ' ').title()}: {value}")
	
	asyncio.run(main())