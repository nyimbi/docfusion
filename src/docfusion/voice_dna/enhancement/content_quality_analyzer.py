"""
Content Quality Analyzer

Advanced content quality analysis system that evaluates text for readability,
engagement, human-likeness, and overall content effectiveness. Provides detailed
metrics and actionable recommendations for content improvement.
"""

import asyncio
import logging
import re
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from enum import Enum
import statistics
import math

logger = logging.getLogger(__name__)

from pydantic import BaseModel, Field, ConfigDict
from uuid import uuid4

# NLP imports with fallbacks
try:
	import spacy
	import nltk
	from textblob import TextBlob
	from textstat import (
		flesch_reading_ease, flesch_kincaid_grade, automated_readability_index,
		coleman_liau_index, gunning_fog, smog_index, text_standard
	)
	NLP_AVAILABLE = True
except ImportError:
	NLP_AVAILABLE = False


class QualityDimension(str, Enum):
	"""Dimensions of content quality analysis"""
	
	READABILITY = "readability"
	ENGAGEMENT = "engagement" 
	HUMAN_LIKENESS = "human_likeness"
	CLARITY = "clarity"
	COHERENCE = "coherence"
	AUTHENTICITY = "authenticity"
	EMOTIONAL_RESONANCE = "emotional_resonance"
	PERSUASIVENESS = "persuasiveness"


class ReadabilityMetrics(BaseModel):
	"""Comprehensive readability analysis"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	# Standard readability scores
	flesch_reading_ease: float = Field(description="Flesch Reading Ease score")
	flesch_kincaid_grade: float = Field(description="Flesch-Kincaid Grade Level")
	automated_readability_index: float = Field(description="ARI score")
	coleman_liau_index: float = Field(description="Coleman-Liau Index")
	gunning_fog_index: float = Field(description="Gunning Fog Index")
	smog_index: float = Field(description="SMOG Index")
	
	# Overall readability
	overall_grade_level: float = Field(description="Combined grade level estimate")
	readability_score: float = Field(ge=0.0, le=1.0, description="Normalized readability score")
	difficulty_level: str = Field(description="Difficulty level: easy, medium, hard")
	
	# Text complexity factors
	average_sentence_length: float = Field(description="Average words per sentence")
	average_word_length: float = Field(description="Average characters per word")
	complex_word_ratio: float = Field(ge=0.0, le=1.0, description="Ratio of complex words")
	
	# Recommendations
	readability_issues: List[str] = Field(description="Identified readability issues")
	improvement_suggestions: List[str] = Field(description="Readability improvement suggestions")
	target_audience_fit: str = Field(description="How well content fits target audience reading level")


class EngagementMetrics(BaseModel):
	"""Content engagement analysis"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	# Engagement indicators
	hook_strength: float = Field(ge=0.0, le=1.0, description="Strength of opening hook")
	emotional_language_ratio: float = Field(ge=0.0, le=1.0, description="Ratio of emotional language")
	active_voice_ratio: float = Field(ge=0.0, le=1.0, description="Ratio of active voice sentences")
	question_engagement: float = Field(ge=0.0, le=1.0, description="Use of engaging questions")
	
	# Content dynamics
	sentence_variety_score: float = Field(ge=0.0, le=1.0, description="Sentence structure variety")
	rhythm_score: float = Field(ge=0.0, le=1.0, description="Text rhythm and flow")
	urgency_indicators: float = Field(ge=0.0, le=1.0, description="Presence of urgency markers")
	
	# Narrative elements
	storytelling_elements: float = Field(ge=0.0, le=1.0, description="Use of narrative techniques")
	concrete_examples: float = Field(ge=0.0, le=1.0, description="Concrete examples and specifics")
	personal_connection: float = Field(ge=0.0, le=1.0, description="Personal/relatable content")
	
	# Overall engagement
	overall_engagement_score: float = Field(ge=0.0, le=1.0, description="Overall engagement rating")
	engagement_level: str = Field(description="Low, medium, high engagement")
	
	# Enhancement opportunities
	engagement_gaps: List[str] = Field(description="Areas lacking engagement")
	engagement_suggestions: List[str] = Field(description="Suggestions to boost engagement")


class HumanLikenessMetrics(BaseModel):
	"""Analysis of human-like writing characteristics"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	# Natural variation indicators
	sentence_length_variation: float = Field(ge=0.0, le=1.0, description="Variation in sentence lengths")
	vocabulary_diversity: float = Field(ge=0.0, le=1.0, description="Lexical diversity")
	structural_unpredictability: float = Field(ge=0.0, le=1.0, description="Structural variation")
	
	# Human writing patterns
	natural_flow_patterns: float = Field(ge=0.0, le=1.0, description="Natural flow indicators")
	conversational_markers: float = Field(ge=0.0, le=1.0, description="Conversational language use")
	imperfection_indicators: float = Field(ge=0.0, le=1.0, description="Natural imperfections")
	
	# Authenticity markers
	personal_voice: float = Field(ge=0.0, le=1.0, description="Personal voice strength")
	spontaneity_indicators: float = Field(ge=0.0, le=1.0, description="Spontaneous language patterns")
	emotional_authenticity: float = Field(ge=0.0, le=1.0, description="Authentic emotional expression")
	
	# AI detection resistance
	pattern_irregularity: float = Field(ge=0.0, le=1.0, description="Irregularity in patterns")
	predictability_score: float = Field(ge=0.0, le=1.0, description="Text predictability (lower is better)")
	human_likeness_score: float = Field(ge=0.0, le=1.0, description="Overall human-likeness rating")
	
	# Enhancement areas
	artificial_indicators: List[str] = Field(description="Indicators that might seem artificial")
	humanization_suggestions: List[str] = Field(description="Suggestions to increase human-likeness")


class QualityAnalysisResult(BaseModel):
	"""Comprehensive content quality analysis result"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	analysis_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique analysis identifier")
	text_analyzed: str = Field(description="Text that was analyzed (truncated for storage)")
	
	# Core metrics
	readability_metrics: ReadabilityMetrics = Field(description="Readability analysis results")
	engagement_metrics: EngagementMetrics = Field(description="Engagement analysis results")
	human_likeness_metrics: HumanLikenessMetrics = Field(description="Human-likeness analysis results")
	
	# Overall quality scores
	overall_quality_score: float = Field(ge=0.0, le=1.0, description="Combined quality score")
	content_effectiveness: float = Field(ge=0.0, le=1.0, description="Content effectiveness rating")
	audience_appropriateness: float = Field(ge=0.0, le=1.0, description="Audience fit score")
	
	# Dimensional analysis
	dimension_scores: Dict[str, float] = Field(description="Scores by quality dimension")
	strength_areas: List[str] = Field(description="Content strengths")
	improvement_areas: List[str] = Field(description="Areas needing improvement")
	
	# Recommendations
	priority_improvements: List[str] = Field(description="High-priority improvements")
	quick_wins: List[str] = Field(description="Easy improvements for immediate impact")
	strategic_enhancements: List[str] = Field(description="Strategic improvements for long-term impact")
	
	# Content characteristics
	content_type_classification: str = Field(description="Detected content type")
	writing_style_profile: Dict[str, Any] = Field(description="Identified writing style characteristics")
	target_audience_analysis: Dict[str, Any] = Field(description="Target audience assessment")
	
	# Quality assurance
	confidence_level: float = Field(ge=0.0, le=1.0, description="Confidence in analysis")
	analysis_completeness: float = Field(ge=0.0, le=1.0, description="Completeness of analysis")
	
	# Metadata
	analysis_duration_seconds: float = Field(description="Time taken for analysis")
	analysis_timestamp: datetime = Field(default_factory=datetime.now)


class ContentQualityAnalyzer:
	"""
	Advanced content quality analysis system
	
	Evaluates text across multiple dimensions including readability, engagement,
	human-likeness, clarity, coherence, and overall content effectiveness.
	Provides detailed metrics and actionable recommendations for improvement.
	"""
	
	def __init__(self):
		# Initialize NLP pipeline
		if NLP_AVAILABLE:
			try:
				self.nlp = spacy.load("en_core_web_sm")
			except OSError:
				self.nlp = None
		else:
			self.nlp = None
		
		# Analysis configuration
		self.analysis_config = {
			"min_text_length": 50,
			"readability_weight": 0.25,
			"engagement_weight": 0.25,
			"human_likeness_weight": 0.25,
			"coherence_weight": 0.25
		}
		
		# Quality indicators and dictionaries
		self.emotional_words = self._load_emotional_words()
		self.engagement_words = self._load_engagement_words()
		self.conversational_markers = self._load_conversational_markers()
		self.storytelling_indicators = self._load_storytelling_indicators()
		
		# Analysis statistics
		self.analysis_count = 0
		self.total_quality_scores = 0.0
		self.average_quality_score = 0.0
		
		self._log_initialization()
	
	def _load_emotional_words(self) -> Dict[str, Set[str]]:
		"""Load emotional vocabulary by category"""
		return {
			'positive': {
				'amazing', 'excellent', 'outstanding', 'fantastic', 'wonderful',
				'incredible', 'remarkable', 'exceptional', 'brilliant', 'superb',
				'delighted', 'thrilled', 'excited', 'passionate', 'enthusiastic'
			},
			'negative': {
				'terrible', 'awful', 'horrible', 'dreadful', 'disappointing',
				'frustrating', 'concerning', 'troubling', 'alarming', 'shocking',
				'worried', 'anxious', 'stressed', 'overwhelmed', 'devastated'
			},
			'intensity': {
				'absolutely', 'completely', 'totally', 'entirely', 'utterly',
				'extremely', 'incredibly', 'remarkably', 'significantly', 'dramatically'
			}
		}
	
	def _load_engagement_words(self) -> Dict[str, Set[str]]:
		"""Load engagement-boosting vocabulary"""
		return {
			'action': {
				'discover', 'explore', 'unlock', 'reveal', 'master',
				'achieve', 'transform', 'create', 'build', 'develop'
			},
			'urgency': {
				'now', 'today', 'immediately', 'urgent', 'critical',
				'deadline', 'limited', 'exclusive', 'opportunity', 'don\'t miss'
			},
			'curiosity': {
				'secret', 'hidden', 'behind-the-scenes', 'insider', 'exclusive',
				'surprising', 'unexpected', 'remarkable', 'little-known', 'revealed'
			},
			'benefit': {
				'benefit', 'advantage', 'value', 'gain', 'profit',
				'improve', 'enhance', 'optimize', 'maximize', 'boost'
			}
		}
	
	def _load_conversational_markers(self) -> Set[str]:
		"""Load conversational language markers"""
		return {
			# Contractions
			"don't", "won't", "can't", "isn't", "aren't", "wasn't", "weren't",
			"haven't", "hasn't", "hadn't", "wouldn't", "couldn't", "shouldn't",
			"it's", "that's", "what's", "who's", "where's", "when's", "how's",
			"i'm", "you're", "we're", "they're", "i'll", "you'll", "we'll", "they'll",
			
			# Informal connectors
			"anyway", "besides", "actually", "basically", "obviously", "clearly",
			"honestly", "frankly", "really", "quite", "pretty", "rather",
			
			# Conversational starters
			"look", "listen", "well", "so", "now", "okay", "right", "sure"
		}
	
	def _load_storytelling_indicators(self) -> Set[str]:
		"""Load storytelling and narrative markers"""
		return {
			# Temporal markers
			"once", "then", "suddenly", "meanwhile", "later", "finally",
			"first", "next", "after", "before", "during", "while",
			
			# Narrative elements
			"story", "experience", "journey", "adventure", "challenge",
			"problem", "solution", "discovery", "breakthrough", "moment",
			
			# Descriptive elements
			"imagine", "picture", "visualize", "scene", "situation",
			"example", "instance", "case", "scenario", "illustration"
		}
	
	async def analyze_content_quality(self, 
	                                  text: str,
	                                  target_audience: Optional[str] = None,
	                                  content_type: Optional[str] = None,
	                                  analysis_dimensions: Optional[List[QualityDimension]] = None) -> QualityAnalysisResult:
		"""
		Perform comprehensive content quality analysis
		
		Args:
			text: Text to analyze
			target_audience: Target audience (e.g., "general public", "executives", "technical")
			content_type: Type of content (e.g., "article", "email", "proposal")
			analysis_dimensions: Specific dimensions to focus on
			
		Returns:
			Comprehensive quality analysis result
		"""
		start_time = datetime.now()
		
		try:
			self._log_analysis_start(len(text), content_type)
			
			# Validate input
			if len(text) < self.analysis_config["min_text_length"]:
				raise ValueError(f"Text too short: {len(text)} < {self.analysis_config['min_text_length']}")
			
			# Set analysis dimensions if not specified
			if analysis_dimensions is None:
				analysis_dimensions = list(QualityDimension)
			
			# Perform core analyses
			readability_metrics = await self._analyze_readability(text, target_audience)
			engagement_metrics = await self._analyze_engagement(text)
			human_likeness_metrics = await self._analyze_human_likeness(text)
			
			# Calculate dimensional scores
			dimension_scores = {}
			if QualityDimension.READABILITY in analysis_dimensions:
				dimension_scores[QualityDimension.READABILITY.value] = readability_metrics.readability_score
			if QualityDimension.ENGAGEMENT in analysis_dimensions:
				dimension_scores[QualityDimension.ENGAGEMENT.value] = engagement_metrics.overall_engagement_score
			if QualityDimension.HUMAN_LIKENESS in analysis_dimensions:
				dimension_scores[QualityDimension.HUMAN_LIKENESS.value] = human_likeness_metrics.human_likeness_score
			
			# Add additional dimensional analysis
			if QualityDimension.CLARITY in analysis_dimensions:
				dimension_scores[QualityDimension.CLARITY.value] = await self._analyze_clarity(text)
			if QualityDimension.COHERENCE in analysis_dimensions:
				dimension_scores[QualityDimension.COHERENCE.value] = await self._analyze_coherence(text)
			if QualityDimension.AUTHENTICITY in analysis_dimensions:
				dimension_scores[QualityDimension.AUTHENTICITY.value] = await self._analyze_authenticity(text)
			
			# Calculate overall scores
			overall_quality_score = self._calculate_overall_quality(dimension_scores)
			content_effectiveness = self._calculate_content_effectiveness(
				readability_metrics, engagement_metrics, target_audience
			)
			audience_appropriateness = self._calculate_audience_appropriateness(
				readability_metrics, target_audience
			)
			
			# Identify strengths and improvement areas
			strength_areas, improvement_areas = self._identify_strengths_and_improvements(
				dimension_scores, readability_metrics, engagement_metrics, human_likeness_metrics
			)
			
			# Generate recommendations
			priority_improvements = self._generate_priority_improvements(
				dimension_scores, readability_metrics, engagement_metrics, human_likeness_metrics
			)
			quick_wins = self._generate_quick_wins(readability_metrics, engagement_metrics)
			strategic_enhancements = self._generate_strategic_enhancements(dimension_scores)
			
			# Analyze content characteristics
			content_type_classification = self._classify_content_type(text)
			writing_style_profile = await self._analyze_writing_style(text)
			target_audience_analysis = self._analyze_target_audience_fit(
				readability_metrics, engagement_metrics, target_audience
			)
			
			# Calculate quality assurance metrics
			confidence_level = self._calculate_confidence_level(
				text, readability_metrics, engagement_metrics, human_likeness_metrics
			)
			analysis_completeness = len(dimension_scores) / len(QualityDimension)
			
			# Create result
			result = QualityAnalysisResult(
				text_analyzed=text[:500] + "..." if len(text) > 500 else text,
				readability_metrics=readability_metrics,
				engagement_metrics=engagement_metrics,
				human_likeness_metrics=human_likeness_metrics,
				overall_quality_score=overall_quality_score,
				content_effectiveness=content_effectiveness,
				audience_appropriateness=audience_appropriateness,
				dimension_scores=dimension_scores,
				strength_areas=strength_areas,
				improvement_areas=improvement_areas,
				priority_improvements=priority_improvements,
				quick_wins=quick_wins,
				strategic_enhancements=strategic_enhancements,
				content_type_classification=content_type_classification,
				writing_style_profile=writing_style_profile,
				target_audience_analysis=target_audience_analysis,
				confidence_level=confidence_level,
				analysis_completeness=analysis_completeness,
				analysis_duration_seconds=(datetime.now() - start_time).total_seconds()
			)
			
			# Update statistics
			self.analysis_count += 1
			self.total_quality_scores += overall_quality_score
			self._update_average_quality_score()
			
			self._log_analysis_complete(overall_quality_score, result.analysis_duration_seconds)
			
			return result
			
		except Exception as e:
			self._log_analysis_error(f"Content quality analysis failed: {str(e)}")
			raise
	
	async def _analyze_readability(self, text: str, target_audience: Optional[str]) -> ReadabilityMetrics:
		"""Analyze text readability comprehensively"""
		
		# Calculate readability scores using textstat if available
		if NLP_AVAILABLE:
			try:
				flesch_ease = flesch_reading_ease(text)
				fk_grade = flesch_kincaid_grade(text)
				ari = automated_readability_index(text)
				cli = coleman_liau_index(text)
				gf = gunning_fog(text)
				smog = smog_index(text)
			except (ValueError, TypeError, ZeroDivisionError) as e:
				logger.warning(f"Readability scoring failed, using fallback: {e}")
				flesch_ease, fk_grade, ari, cli, gf, smog = self._simple_readability_scores(text)
		else:
			flesch_ease, fk_grade, ari, cli, gf, smog = self._simple_readability_scores(text)
		
		# Calculate overall grade level
		scores = [fk_grade, ari, cli, gf, smog]
		overall_grade_level = statistics.mean([s for s in scores if s is not None and not math.isnan(s)])
		
		# Normalize readability score (0-1 scale)
		if flesch_ease >= 90:
			readability_score = 1.0
			difficulty = "very_easy"
		elif flesch_ease >= 80:
			readability_score = 0.9
			difficulty = "easy"
		elif flesch_ease >= 70:
			readability_score = 0.7
			difficulty = "fairly_easy"
		elif flesch_ease >= 60:
			readability_score = 0.6
			difficulty = "standard"
		elif flesch_ease >= 50:
			readability_score = 0.4
			difficulty = "fairly_difficult"
		elif flesch_ease >= 30:
			readability_score = 0.3
			difficulty = "difficult"
		else:
			readability_score = 0.1
			difficulty = "very_difficult"
		
		# Calculate text complexity factors
		sentences = [s.strip() for s in text.split('.') if s.strip()]
		words = text.split()
		
		avg_sentence_length = len(words) / len(sentences) if sentences else 0
		avg_word_length = sum(len(word) for word in words) / len(words) if words else 0
		
		complex_words = [word for word in words if len(word) > 6]
		complex_word_ratio = len(complex_words) / len(words) if words else 0
		
		# Identify readability issues
		readability_issues = []
		if avg_sentence_length > 20:
			readability_issues.append("Sentences are too long (average > 20 words)")
		if complex_word_ratio > 0.2:
			readability_issues.append("Too many complex words (> 20% of text)")
		if overall_grade_level > 12:
			readability_issues.append("Reading level too high for general audience")
		
		# Generate improvement suggestions
		improvement_suggestions = []
		if avg_sentence_length > 18:
			improvement_suggestions.append("Break long sentences into shorter ones")
		if complex_word_ratio > 0.15:
			improvement_suggestions.append("Replace complex words with simpler alternatives")
		if flesch_ease < 60:
			improvement_suggestions.append("Simplify language and sentence structure")
		
		# Assess target audience fit
		if target_audience:
			target_fit = self._assess_readability_audience_fit(overall_grade_level, target_audience)
		else:
			target_fit = "Unknown - no target audience specified"
		
		return ReadabilityMetrics(
			flesch_reading_ease=flesch_ease,
			flesch_kincaid_grade=fk_grade,
			automated_readability_index=ari,
			coleman_liau_index=cli,
			gunning_fog_index=gf,
			smog_index=smog,
			overall_grade_level=overall_grade_level,
			readability_score=readability_score,
			difficulty_level=difficulty,
			average_sentence_length=avg_sentence_length,
			average_word_length=avg_word_length,
			complex_word_ratio=complex_word_ratio,
			readability_issues=readability_issues,
			improvement_suggestions=improvement_suggestions,
			target_audience_fit=target_fit
		)
	
	def _simple_readability_scores(self, text: str) -> Tuple[float, float, float, float, float, float]:
		"""Calculate simplified readability scores when textstat unavailable"""
		
		sentences = [s.strip() for s in text.split('.') if s.strip()]
		words = text.split()
		syllables = sum(self._count_syllables(word) for word in words)
		
		if not sentences or not words:
			return 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
		
		avg_sentence_length = len(words) / len(sentences)
		avg_syllables_per_word = syllables / len(words)
		
		# Simplified Flesch Reading Ease
		flesch_ease = 206.835 - (1.015 * avg_sentence_length) - (84.6 * avg_syllables_per_word)
		flesch_ease = max(0, min(100, flesch_ease))
		
		# Simplified Flesch-Kincaid Grade Level
		fk_grade = (0.39 * avg_sentence_length) + (11.8 * avg_syllables_per_word) - 15.59
		fk_grade = max(0, fk_grade)
		
		# Simplified ARI
		chars = sum(len(word) for word in words)
		ari = (4.71 * (chars / len(words))) + (0.5 * avg_sentence_length) - 21.43
		ari = max(0, ari)
		
		# Rough estimates for other metrics
		cli = fk_grade * 0.9  # Approximation
		gf = fk_grade * 1.1   # Approximation
		smog = fk_grade * 0.95 # Approximation
		
		return flesch_ease, fk_grade, ari, cli, gf, smog
	
	def _count_syllables(self, word: str) -> int:
		"""Count syllables in a word (approximation)"""
		word = word.lower()
		vowels = 'aeiouy'
		syllable_count = 0
		prev_was_vowel = False
		
		for char in word:
			is_vowel = char in vowels
			if is_vowel and not prev_was_vowel:
				syllable_count += 1
			prev_was_vowel = is_vowel
		
		# Handle silent e
		if word.endswith('e'):
			syllable_count -= 1
		
		return max(syllable_count, 1)
	
	def _assess_readability_audience_fit(self, grade_level: float, target_audience: str) -> str:
		"""Assess how well readability fits target audience"""
		
		audience_grade_ranges = {
			"general public": (6, 10),
			"high school": (9, 12),
			"college": (13, 16),
			"graduate": (16, 20),
			"executives": (12, 16),
			"technical": (14, 18),
			"academic": (16, 20),
			"children": (3, 6)
		}
		
		target_lower = target_audience.lower()
		for audience, (min_grade, max_grade) in audience_grade_ranges.items():
			if audience in target_lower:
				if min_grade <= grade_level <= max_grade:
					return f"Good fit for {target_audience}"
				elif grade_level < min_grade:
					return f"Too simple for {target_audience} (grade {grade_level:.1f} vs {min_grade}-{max_grade})"
				else:
					return f"Too complex for {target_audience} (grade {grade_level:.1f} vs {min_grade}-{max_grade})"
		
		return f"Unknown audience readability fit (grade level: {grade_level:.1f})"
	
	async def _analyze_engagement(self, text: str) -> EngagementMetrics:
		"""Analyze content engagement factors"""
		
		sentences = [s.strip() for s in text.split('.') if s.strip()]
		words = text.lower().split()
		
		# Analyze hook strength (opening sentence)
		hook_strength = self._analyze_hook_strength(sentences[0] if sentences else "")
		
		# Analyze emotional language
		emotional_count = 0
		for category, emotion_words in self.emotional_words.items():
			emotional_count += sum(1 for word in words if word in emotion_words)
		emotional_language_ratio = emotional_count / len(words) if words else 0
		
		# Analyze active vs passive voice
		active_voice_ratio = self._calculate_active_voice_ratio(sentences)
		
		# Analyze question engagement
		question_count = sum(1 for s in sentences if '?' in s)
		question_engagement = min(question_count / max(len(sentences), 1) * 2, 1.0)
		
		# Analyze sentence variety
		sentence_variety_score = self._calculate_sentence_variety(sentences)
		
		# Analyze rhythm and flow
		rhythm_score = self._calculate_rhythm_score(sentences)
		
		# Analyze urgency indicators
		urgency_count = sum(1 for word in words 
		                   if word in self.engagement_words.get('urgency', set()))
		urgency_indicators = min(urgency_count / max(len(words), 1) * 10, 1.0)
		
		# Analyze storytelling elements
		storytelling_count = sum(1 for word in words if word in self.storytelling_indicators)
		storytelling_elements = min(storytelling_count / max(len(words), 1) * 5, 1.0)
		
		# Analyze concrete examples
		concrete_examples = self._analyze_concrete_examples(text)
		
		# Analyze personal connection
		personal_connection = self._analyze_personal_connection(text)
		
		# Calculate overall engagement score
		engagement_factors = [
			hook_strength * 0.15,
			emotional_language_ratio * 5 * 0.15,  # Scale up emotional ratio
			active_voice_ratio * 0.1,
			question_engagement * 0.1,
			sentence_variety_score * 0.1,
			rhythm_score * 0.1,
			urgency_indicators * 0.1,
			storytelling_elements * 0.1,
			concrete_examples * 0.05,
			personal_connection * 0.05
		]
		
		overall_engagement_score = sum(engagement_factors)
		overall_engagement_score = min(overall_engagement_score, 1.0)
		
		# Determine engagement level
		if overall_engagement_score >= 0.8:
			engagement_level = "high"
		elif overall_engagement_score >= 0.6:
			engagement_level = "medium"
		else:
			engagement_level = "low"
		
		# Identify engagement gaps
		engagement_gaps = []
		if hook_strength < 0.5:
			engagement_gaps.append("Weak opening hook")
		if emotional_language_ratio < 0.02:
			engagement_gaps.append("Limited emotional language")
		if active_voice_ratio < 0.7:
			engagement_gaps.append("Too much passive voice")
		if question_engagement < 0.1:
			engagement_gaps.append("Lack of engaging questions")
		
		# Generate engagement suggestions
		engagement_suggestions = []
		if hook_strength < 0.6:
			engagement_suggestions.append("Strengthen opening with compelling hook")
		if emotional_language_ratio < 0.03:
			engagement_suggestions.append("Add more emotional and impactful language")
		if sentence_variety_score < 0.6:
			engagement_suggestions.append("Vary sentence structures and lengths")
		if storytelling_elements < 0.2:
			engagement_suggestions.append("Include more narrative elements and examples")
		
		return EngagementMetrics(
			hook_strength=hook_strength,
			emotional_language_ratio=min(emotional_language_ratio * 5, 1.0),  # Scale for display
			active_voice_ratio=active_voice_ratio,
			question_engagement=question_engagement,
			sentence_variety_score=sentence_variety_score,
			rhythm_score=rhythm_score,
			urgency_indicators=urgency_indicators,
			storytelling_elements=storytelling_elements,
			concrete_examples=concrete_examples,
			personal_connection=personal_connection,
			overall_engagement_score=overall_engagement_score,
			engagement_level=engagement_level,
			engagement_gaps=engagement_gaps,
			engagement_suggestions=engagement_suggestions
		)
	
	def _analyze_hook_strength(self, opening_sentence: str) -> float:
		"""Analyze strength of opening hook"""
		
		if not opening_sentence:
			return 0.0
		
		opening_lower = opening_sentence.lower()
		hook_score = 0.0
		
		# Strong opening indicators
		strong_starters = [
			'imagine', 'what if', 'did you know', 'surprising', 'shocking',
			'secret', 'revealed', 'discover', 'unlock', 'transform'
		]
		
		for starter in strong_starters:
			if starter in opening_lower:
				hook_score += 0.3
		
		# Question openings
		if opening_sentence.strip().endswith('?'):
			hook_score += 0.2
		
		# Emotional words in opening
		emotional_count = sum(1 for category in self.emotional_words.values()
		                     for word in category
		                     if word in opening_lower)
		hook_score += min(emotional_count * 0.1, 0.3)
		
		# Statistics or numbers
		if re.search(r'\d+%|\d+\s*(percent|times|fold)', opening_lower):
			hook_score += 0.2
		
		return min(hook_score, 1.0)
	
	def _calculate_active_voice_ratio(self, sentences: List[str]) -> float:
		"""Calculate ratio of active voice sentences"""
		
		if not sentences:
			return 0.0
		
		active_count = 0
		passive_indicators = ['was', 'were', 'been', 'being', 'is', 'are', 'am']
		
		for sentence in sentences:
			sentence_lower = sentence.lower()
			
			# Simple heuristic: if sentence contains passive indicators + past participle
			has_passive_indicator = any(indicator in sentence_lower for indicator in passive_indicators)
			
			# Look for "by" which often indicates passive voice
			has_by = ' by ' in sentence_lower
			
			# If no clear passive indicators, assume active
			if not (has_passive_indicator and (has_by or 'been' in sentence_lower)):
				active_count += 1
		
		return active_count / len(sentences)
	
	def _calculate_sentence_variety(self, sentences: List[str]) -> float:
		"""Calculate sentence structure variety score"""
		
		if not sentences:
			return 0.0
		
		# Analyze sentence lengths
		lengths = [len(sentence.split()) for sentence in sentences]
		length_variety = statistics.stdev(lengths) / statistics.mean(lengths) if len(lengths) > 1 else 0
		
		# Analyze sentence starters
		starters = [sentence.split()[0].lower() if sentence.split() else "" for sentence in sentences]
		unique_starters = len(set(starters))
		starter_variety = unique_starters / len(sentences) if sentences else 0
		
		# Combine factors
		variety_score = (min(length_variety, 0.5) * 2 + starter_variety) / 2
		return min(variety_score, 1.0)
	
	def _calculate_rhythm_score(self, sentences: List[str]) -> float:
		"""Calculate text rhythm and flow score"""
		
		if len(sentences) < 2:
			return 0.5
		
		# Analyze sentence length patterns
		lengths = [len(sentence.split()) for sentence in sentences]
		
		# Good rhythm has variation but not extreme jumps
		rhythm_score = 0.0
		
		# Check for alternating patterns
		short_long_pattern = 0
		for i in range(len(lengths) - 1):
			if (lengths[i] < 10 and lengths[i+1] > 15) or (lengths[i] > 15 and lengths[i+1] < 10):
				short_long_pattern += 1
		
		rhythm_score += min(short_long_pattern / max(len(lengths) - 1, 1), 0.5)
		
		# Check for transition words
		transition_words = ['however', 'therefore', 'furthermore', 'additionally', 'meanwhile']
		transition_count = sum(1 for sentence in sentences
		                      for transition in transition_words
		                      if transition in sentence.lower())
		
		rhythm_score += min(transition_count / len(sentences), 0.5)
		
		return rhythm_score
	
	def _analyze_concrete_examples(self, text: str) -> float:
		"""Analyze use of concrete examples and specifics"""
		
		text_lower = text.lower()
		example_indicators = [
			'for example', 'for instance', 'such as', 'including',
			'specifically', 'in particular', 'case study', 'illustration'
		]
		
		example_count = sum(1 for indicator in example_indicators if indicator in text_lower)
		
		# Look for numbers and statistics
		number_pattern = re.findall(r'\d+', text)
		number_score = min(len(number_pattern) / 100, 0.5)  # Normalize
		
		# Look for specific details
		specific_words = ['exactly', 'precisely', 'specifically', 'detailed', 'comprehensive']
		specific_count = sum(1 for word in specific_words if word in text_lower)
		specific_score = min(specific_count / len(text.split()) * 10, 0.3)
		
		return min(example_count * 0.2 + number_score + specific_score, 1.0)
	
	def _analyze_personal_connection(self, text: str) -> float:
		"""Analyze personal and relatable content"""
		
		text_lower = text.lower()
		personal_pronouns = ['you', 'your', 'we', 'our', 'us', 'i', 'my']
		total_words = len(text.split())
		
		pronoun_count = sum(1 for word in text.split() if word.lower() in personal_pronouns)
		pronoun_ratio = pronoun_count / total_words if total_words > 0 else 0
		
		# Direct address indicators
		direct_address = ['you can', 'you will', 'you should', 'you might', 'you need']
		address_count = sum(1 for phrase in direct_address if phrase in text_lower)
		
		# Relatable scenarios
		relatable_words = ['experience', 'situation', 'challenge', 'problem', 'solution', 'journey']
		relatable_count = sum(1 for word in relatable_words if word in text_lower)
		
		connection_score = (
			min(pronoun_ratio * 5, 0.5) +  # Scale pronoun ratio
			min(address_count * 0.1, 0.3) +
			min(relatable_count / total_words * 20, 0.2)
		)
		
		return min(connection_score, 1.0)
	
	async def _analyze_human_likeness(self, text: str) -> HumanLikenessMetrics:
		"""Analyze human-like writing characteristics"""
		
		sentences = [s.strip() for s in text.split('.') if s.strip()]
		words = text.split()
		
		# Sentence length variation
		if len(sentences) > 1:
			lengths = [len(sentence.split()) for sentence in sentences]
			cv = statistics.stdev(lengths) / statistics.mean(lengths)
			sentence_length_variation = min(cv / 0.5, 1.0)  # Target CV of 0.5
		else:
			sentence_length_variation = 0.0
		
		# Vocabulary diversity
		unique_words = len(set(word.lower() for word in words))
		vocabulary_diversity = unique_words / len(words) if words else 0
		
		# Structural unpredictability
		structural_unpredictability = self._calculate_structural_unpredictability(sentences)
		
		# Natural flow patterns
		natural_flow_patterns = self._calculate_natural_flow_patterns(text)
		
		# Conversational markers
		conversational_count = sum(1 for word in words if word.lower() in self.conversational_markers)
		conversational_markers = min(conversational_count / len(words) * 10, 1.0)
		
		# Imperfection indicators (natural human writing imperfections)
		imperfection_indicators = self._calculate_imperfection_indicators(text)
		
		# Personal voice
		personal_voice = self._calculate_personal_voice_strength(text)
		
		# Spontaneity indicators
		spontaneity_indicators = self._calculate_spontaneity_indicators(text)
		
		# Emotional authenticity
		emotional_authenticity = self._calculate_emotional_authenticity(text)
		
		# Pattern irregularity
		pattern_irregularity = self._calculate_pattern_irregularity(sentences)
		
		# Predictability score (lower is better for human-likeness)
		predictability_score = self._calculate_predictability_score(text)
		
		# Overall human-likeness score
		human_likeness_factors = [
			sentence_length_variation * 0.15,
			vocabulary_diversity * 0.15,
			structural_unpredictability * 0.1,
			natural_flow_patterns * 0.1,
			conversational_markers * 0.1,
			imperfection_indicators * 0.1,
			personal_voice * 0.1,
			spontaneity_indicators * 0.1,
			emotional_authenticity * 0.05,
			pattern_irregularity * 0.05
		]
		
		human_likeness_score = sum(human_likeness_factors)
		
		# Identify artificial indicators
		artificial_indicators = []
		if sentence_length_variation < 0.3:
			artificial_indicators.append("Uniform sentence lengths")
		if vocabulary_diversity < 0.4:
			artificial_indicators.append("Limited vocabulary diversity")
		if conversational_markers < 0.1:
			artificial_indicators.append("Lack of conversational elements")
		if predictability_score > 0.8:
			artificial_indicators.append("Highly predictable patterns")
		
		# Generate humanization suggestions
		humanization_suggestions = []
		if sentence_length_variation < 0.4:
			humanization_suggestions.append("Vary sentence lengths more naturally")
		if conversational_markers < 0.2:
			humanization_suggestions.append("Add more conversational language")
		if imperfection_indicators < 0.2:
			humanization_suggestions.append("Include subtle natural imperfections")
		if personal_voice < 0.3:
			humanization_suggestions.append("Strengthen personal voice and perspective")
		
		return HumanLikenessMetrics(
			sentence_length_variation=sentence_length_variation,
			vocabulary_diversity=vocabulary_diversity,
			structural_unpredictability=structural_unpredictability,
			natural_flow_patterns=natural_flow_patterns,
			conversational_markers=conversational_markers,
			imperfection_indicators=imperfection_indicators,
			personal_voice=personal_voice,
			spontaneity_indicators=spontaneity_indicators,
			emotional_authenticity=emotional_authenticity,
			pattern_irregularity=pattern_irregularity,
			predictability_score=predictability_score,
			human_likeness_score=human_likeness_score,
			artificial_indicators=artificial_indicators,
			humanization_suggestions=humanization_suggestions
		)
	
	def _calculate_structural_unpredictability(self, sentences: List[str]) -> float:
		"""Calculate structural unpredictability score"""
		
		if len(sentences) < 3:
			return 0.5
		
		# Analyze sentence starter patterns
		starters = [sentence.split()[0].lower() if sentence.split() else "" for sentence in sentences]
		
		# Count consecutive similar starters
		consecutive_similar = 0
		for i in range(len(starters) - 1):
			if starters[i] == starters[i + 1]:
				consecutive_similar += 1
		
		# Lower consecutive similarity = higher unpredictability
		unpredictability = max(0, 1 - (consecutive_similar / max(len(sentences) - 1, 1)))
		
		return unpredictability
	
	def _calculate_natural_flow_patterns(self, text: str) -> float:
		"""Calculate natural flow pattern indicators"""
		
		# Look for natural connectors and transitions
		natural_connectors = [
			'and', 'but', 'so', 'then', 'now', 'well', 'actually',
			'besides', 'anyway', 'meanwhile', 'still', 'yet'
		]
		
		words = text.lower().split()
		connector_count = sum(1 for word in words if word in natural_connectors)
		
		# Look for natural pauses (commas, em dashes)
		comma_count = text.count(',')
		dash_count = text.count('—') + text.count('--')
		
		# Natural flow score
		flow_score = (
			min(connector_count / len(words) * 20, 0.5) +
			min(comma_count / len(words) * 30, 0.3) +
			min(dash_count / len(words) * 100, 0.2)
		)
		
		return min(flow_score, 1.0)
	
	def _calculate_imperfection_indicators(self, text: str) -> float:
		"""Calculate natural imperfection indicators"""
		
		imperfection_score = 0.0
		
		# Minor inconsistencies (natural in human writing)
		# Variation in punctuation spacing
		single_space_periods = len(re.findall(r'\.\s[A-Z]', text))
		double_space_periods = len(re.findall(r'\.\s\s[A-Z]', text))
		
		if single_space_periods > 0 and double_space_periods > 0:
			imperfection_score += 0.2  # Mixed spacing is human-like
		
		# Occasional long sentences mixed with short ones
		sentences = [s.strip() for s in text.split('.') if s.strip()]
		if sentences:
			lengths = [len(sentence.split()) for sentence in sentences]
			if max(lengths) > 25 and min(lengths) < 5:
				imperfection_score += 0.3
		
		# Natural hesitation markers
		hesitation_markers = ['well', 'um', 'uh', 'you know', 'i mean', 'sort of', 'kind of']
		hesitation_count = sum(1 for marker in hesitation_markers if marker in text.lower())
		
		if hesitation_count > 0:
			imperfection_score += min(hesitation_count * 0.1, 0.3)
		
		# Parenthetical asides (natural in human writing)
		parenthetical_count = text.count('(') + text.count('[')
		if parenthetical_count > 0:
			imperfection_score += min(parenthetical_count * 0.05, 0.2)
		
		return min(imperfection_score, 1.0)
	
	def _calculate_personal_voice_strength(self, text: str) -> float:
		"""Calculate personal voice and perspective strength"""
		
		text_lower = text.lower()
		
		# Personal opinions and perspectives
		opinion_markers = [
			'i think', 'i believe', 'in my opinion', 'personally', 'i feel',
			'from my perspective', 'it seems to me', 'i would say'
		]
		
		opinion_count = sum(1 for marker in opinion_markers if marker in text_lower)
		
		# Personal experiences
		experience_markers = [
			'i remember', 'i experienced', 'i learned', 'i discovered',
			'in my experience', 'i found', 'i realized'
		]
		
		experience_count = sum(1 for marker in experience_markers if marker in text_lower)
		
		# Subjective language
		subjective_words = [
			'fascinating', 'interesting', 'amazing', 'surprising',
			'wonderful', 'terrible', 'beautiful', 'ugly'
		]
		
		subjective_count = sum(1 for word in subjective_words if word in text_lower)
		
		personal_voice_score = (
			min(opinion_count * 0.2, 0.4) +
			min(experience_count * 0.2, 0.3) +
			min(subjective_count / len(text.split()) * 20, 0.3)
		)
		
		return min(personal_voice_score, 1.0)
	
	def _calculate_spontaneity_indicators(self, text: str) -> float:
		"""Calculate spontaneous language pattern indicators"""
		
		text_lower = text.lower()
		
		# Spontaneous language markers
		spontaneous_markers = [
			'oh', 'ah', 'wow', 'hey', 'wait', 'hold on',
			'by the way', 'come to think of it', 'speaking of'
		]
		
		spontaneous_count = sum(1 for marker in spontaneous_markers if marker in text_lower)
		
		# Stream of consciousness indicators
		consciousness_markers = ['and then', 'and also', 'plus', 'also']
		consciousness_count = sum(1 for marker in consciousness_markers if marker in text_lower)
		
		# Interrupted thoughts (indicated by em dashes)
		interruption_count = text.count('—') + text.count('--')
		
		spontaneity_score = (
			min(spontaneous_count / len(text.split()) * 50, 0.4) +
			min(consciousness_count / len(text.split()) * 30, 0.3) +
			min(interruption_count / len(text.split()) * 100, 0.3)
		)
		
		return min(spontaneity_score, 1.0)
	
	def _calculate_emotional_authenticity(self, text: str) -> float:
		"""Calculate emotional authenticity score"""
		
		# Mix of emotional intensities (authentic emotions vary)
		words = text.lower().split()
		
		positive_emotions = sum(1 for word in words if word in self.emotional_words.get('positive', set()))
		negative_emotions = sum(1 for word in words if word in self.emotional_words.get('negative', set()))
		intensity_words = sum(1 for word in words if word in self.emotional_words.get('intensity', set()))
		
		# Authentic emotions usually have some variation
		if positive_emotions > 0 and negative_emotions > 0:
			emotion_balance = 0.4  # Mixed emotions are more authentic
		elif positive_emotions > 0 or negative_emotions > 0:
			emotion_balance = 0.2
		else:
			emotion_balance = 0.0
		
		intensity_score = min(intensity_words / len(words) * 50, 0.3)
		
		# Gradual emotional language (not all superlatives)
		superlatives = ['best', 'worst', 'amazing', 'terrible', 'perfect', 'horrible']
		superlative_count = sum(1 for word in words if word in superlatives)
		
		# Moderate use of superlatives is more authentic
		if superlative_count / len(words) > 0.05:
			superlative_penalty = 0.2  # Too many superlatives seem artificial
		else:
			superlative_penalty = 0.0
		
		authenticity_score = emotion_balance + intensity_score - superlative_penalty
		
		return max(0, min(authenticity_score, 1.0))
	
	def _calculate_pattern_irregularity(self, sentences: List[str]) -> float:
		"""Calculate pattern irregularity score"""
		
		if len(sentences) < 3:
			return 0.5
		
		# Analyze various pattern irregularities
		irregularity_score = 0.0
		
		# Sentence length irregularity
		lengths = [len(sentence.split()) for sentence in sentences]
		length_changes = []
		for i in range(len(lengths) - 1):
			change = abs(lengths[i+1] - lengths[i])
			length_changes.append(change)
		
		if length_changes:
			avg_change = statistics.mean(length_changes)
			irregularity_score += min(avg_change / 10, 0.3)
		
		# Punctuation irregularity
		punct_patterns = [sentence.count(',') + sentence.count(';') for sentence in sentences]
		if len(set(punct_patterns)) > len(punct_patterns) * 0.5:  # High variety
			irregularity_score += 0.3
		
		# Starter word irregularity
		starters = [sentence.split()[0].lower() if sentence.split() else "" for sentence in sentences]
		unique_starters_ratio = len(set(starters)) / len(starters)
		irregularity_score += unique_starters_ratio * 0.4
		
		return min(irregularity_score, 1.0)
	
	def _calculate_predictability_score(self, text: str) -> float:
		"""Calculate text predictability score (lower is more human-like)"""
		
		words = text.split()
		sentences = [s.strip() for s in text.split('.') if s.strip()]
		
		predictability_factors = []
		
		# Word repetition predictability
		word_counts = Counter(word.lower() for word in words)
		repeated_words = sum(1 for count in word_counts.values() if count > 2)
		word_predictability = repeated_words / len(set(words)) if words else 0
		predictability_factors.append(word_predictability)
		
		# Sentence structure predictability
		sentence_starts = [sentence.split()[0].lower() if sentence.split() else "" for sentence in sentences]
		start_repetition = len(sentence_starts) - len(set(sentence_starts))
		structure_predictability = start_repetition / len(sentences) if sentences else 0
		predictability_factors.append(structure_predictability)
		
		# Length pattern predictability
		if len(sentences) > 2:
			lengths = [len(sentence.split()) for sentence in sentences]
			length_variance = statistics.variance(lengths)
			length_predictability = 1 / (1 + length_variance)  # Low variance = high predictability
			predictability_factors.append(length_predictability)
		
		return statistics.mean(predictability_factors) if predictability_factors else 0.5
	
	async def _analyze_clarity(self, text: str) -> float:
		"""Analyze content clarity"""
		
		sentences = [s.strip() for s in text.split('.') if s.strip()]
		words = text.split()
		
		clarity_score = 0.0
		
		# Sentence length clarity (shorter sentences are usually clearer)
		if sentences:
			avg_sentence_length = sum(len(sentence.split()) for sentence in sentences) / len(sentences)
			length_clarity = max(0, min(1, (25 - avg_sentence_length) / 15))  # Optimal around 10-15 words
			clarity_score += length_clarity * 0.3
		
		# Word choice clarity (prefer common words)
		common_word_ratio = sum(1 for word in words if len(word) <= 6) / len(words) if words else 0
		clarity_score += common_word_ratio * 0.3
		
		# Structural clarity (use of lists, headers, etc.)
		structure_indicators = text.count('\n') + text.count('•') + text.count('-')
		structure_clarity = min(structure_indicators / 10, 0.2)
		clarity_score += structure_clarity
		
		# Transition clarity
		clear_transitions = ['first', 'second', 'then', 'next', 'finally', 'therefore']
		transition_count = sum(1 for transition in clear_transitions if transition in text.lower())
		transition_clarity = min(transition_count / len(sentences) * 2, 0.2) if sentences else 0
		clarity_score += transition_clarity
		
		return min(clarity_score, 1.0)
	
	async def _analyze_coherence(self, text: str) -> float:
		"""Analyze content coherence and logical flow"""
		
		sentences = [s.strip() for s in text.split('.') if s.strip()]
		
		if len(sentences) < 2:
			return 0.5
		
		coherence_score = 0.0
		
		# Logical connectors
		logical_connectors = [
			'because', 'therefore', 'however', 'consequently', 'as a result',
			'furthermore', 'moreover', 'in addition', 'on the other hand'
		]
		
		connector_count = sum(1 for sentence in sentences
		                     for connector in logical_connectors
		                     if connector in sentence.lower())
		
		connector_coherence = min(connector_count / len(sentences) * 2, 0.4)
		coherence_score += connector_coherence
		
		# Topic consistency (simplified - count repeated key terms)
		words = text.lower().split()
		word_counts = Counter(words)
		key_terms = [word for word, count in word_counts.items() 
		            if count > 2 and len(word) > 4 and word.isalpha()]
		
		topic_consistency = min(len(key_terms) / 10, 0.3)
		coherence_score += topic_consistency
		
		# Paragraph coherence (if paragraphs are present)
		paragraphs = text.split('\n\n')
		if len(paragraphs) > 1:
			paragraph_coherence = 0.3  # Presence of paragraphs indicates structure
		else:
			paragraph_coherence = 0.0
		
		coherence_score += paragraph_coherence
		
		return min(coherence_score, 1.0)
	
	async def _analyze_authenticity(self, text: str) -> float:
		"""Analyze content authenticity"""
		
		# This is a simplified authenticity check
		# Real implementation would be more sophisticated
		
		authenticity_factors = []
		
		# Personal voice indicators
		personal_pronouns = ['i', 'my', 'we', 'our']
		words = text.lower().split()
		personal_ratio = sum(1 for word in words if word in personal_pronouns) / len(words) if words else 0
		authenticity_factors.append(min(personal_ratio * 10, 0.3))
		
		# Conversational elements
		conversational_ratio = sum(1 for word in words if word in self.conversational_markers) / len(words) if words else 0
		authenticity_factors.append(min(conversational_ratio * 20, 0.3))
		
		# Natural imperfections
		imperfections = self._calculate_imperfection_indicators(text)
		authenticity_factors.append(imperfections * 0.4)
		
		return statistics.mean(authenticity_factors) if authenticity_factors else 0.5
	
	def _calculate_overall_quality(self, dimension_scores: Dict[str, float]) -> float:
		"""Calculate overall quality score from dimensional scores"""
		
		if not dimension_scores:
			return 0.0
		
		# Weight the scores according to configuration
		weighted_scores = []
		
		for dimension, score in dimension_scores.items():
			weight = self.analysis_config.get(f"{dimension}_weight", 1.0 / len(dimension_scores))
			weighted_scores.append(score * weight)
		
		return sum(weighted_scores)
	
	def _calculate_content_effectiveness(self, 
	                                    readability: ReadabilityMetrics,
	                                    engagement: EngagementMetrics,
	                                    target_audience: Optional[str]) -> float:
		"""Calculate content effectiveness score"""
		
		effectiveness_factors = []
		
		# Readability effectiveness
		if target_audience:
			# Adjust readability expectation based on audience
			if 'executive' in target_audience.lower() or 'professional' in target_audience.lower():
				target_readability = 0.6  # Can handle more complex content
			elif 'general' in target_audience.lower():
				target_readability = 0.8  # Need higher readability
			else:
				target_readability = 0.7  # Default
		else:
			target_readability = 0.7
		
		readability_effectiveness = 1 - abs(readability.readability_score - target_readability)
		effectiveness_factors.append(readability_effectiveness)
		
		# Engagement effectiveness
		effectiveness_factors.append(engagement.overall_engagement_score)
		
		# Hook effectiveness for content start
		effectiveness_factors.append(engagement.hook_strength)
		
		return statistics.mean(effectiveness_factors)
	
	def _calculate_audience_appropriateness(self, 
	                                       readability: ReadabilityMetrics, 
	                                       target_audience: Optional[str]) -> float:
		"""Calculate audience appropriateness score"""
		
		if not target_audience:
			return 0.5  # Neutral if no audience specified
		
		target_lower = target_audience.lower()
		
		# Define appropriate grade levels for different audiences
		if 'general public' in target_lower or 'consumer' in target_lower:
			target_grade_range = (6, 10)
		elif 'executive' in target_lower or 'professional' in target_lower:
			target_grade_range = (10, 14)
		elif 'technical' in target_lower or 'specialist' in target_lower:
			target_grade_range = (12, 16)
		elif 'academic' in target_lower:
			target_grade_range = (14, 18)
		else:
			target_grade_range = (8, 12)  # Default range
		
		actual_grade = readability.overall_grade_level
		min_grade, max_grade = target_grade_range
		
		if min_grade <= actual_grade <= max_grade:
			return 1.0  # Perfect fit
		elif actual_grade < min_grade:
			# Too simple
			distance = min_grade - actual_grade
			return max(0, 1 - (distance / 5))  # Penalty for each grade level off
		else:
			# Too complex
			distance = actual_grade - max_grade
			return max(0, 1 - (distance / 5))  # Penalty for each grade level off
	
	def _identify_strengths_and_improvements(self,
	                                        dimension_scores: Dict[str, float],
	                                        readability: ReadabilityMetrics,
	                                        engagement: EngagementMetrics,
	                                        human_likeness: HumanLikenessMetrics) -> Tuple[List[str], List[str]]:
		"""Identify content strengths and areas for improvement"""
		
		strengths = []
		improvements = []
		
		# Analyze dimensional scores
		for dimension, score in dimension_scores.items():
			if score >= 0.8:
				strengths.append(f"Excellent {dimension.replace('_', ' ')}")
			elif score >= 0.6:
				strengths.append(f"Good {dimension.replace('_', ' ')}")
			elif score < 0.4:
				improvements.append(f"Improve {dimension.replace('_', ' ')}")
		
		# Specific readability strengths/improvements
		if readability.readability_score >= 0.8:
			strengths.append("Highly readable content")
		elif readability.readability_score < 0.5:
			improvements.append("Simplify language and structure")
		
		# Specific engagement strengths/improvements
		if engagement.hook_strength >= 0.7:
			strengths.append("Strong opening hook")
		elif engagement.hook_strength < 0.4:
			improvements.append("Strengthen opening engagement")
		
		if engagement.emotional_language_ratio >= 0.6:
			strengths.append("Good use of emotional language")
		elif engagement.emotional_language_ratio < 0.3:
			improvements.append("Add more emotional resonance")
		
		# Human-likeness strengths/improvements
		if human_likeness.vocabulary_diversity >= 0.7:
			strengths.append("Diverse vocabulary usage")
		elif human_likeness.vocabulary_diversity < 0.4:
			improvements.append("Increase vocabulary variety")
		
		if human_likeness.conversational_markers >= 0.5:
			strengths.append("Natural conversational tone")
		elif human_likeness.conversational_markers < 0.2:
			improvements.append("Add more conversational elements")
		
		return strengths, improvements
	
	def _generate_priority_improvements(self,
	                                   dimension_scores: Dict[str, float],
	                                   readability: ReadabilityMetrics,
	                                   engagement: EngagementMetrics,
	                                   human_likeness: HumanLikenessMetrics) -> List[str]:
		"""Generate priority improvements based on lowest scores"""
		
		priorities = []
		
		# Find lowest dimensional scores
		sorted_dimensions = sorted(dimension_scores.items(), key=lambda x: x[1])
		
		for dimension, score in sorted_dimensions[:2]:  # Top 2 priorities
			if score < 0.6:
				if dimension == 'readability':
					priorities.append("Simplify sentence structure and vocabulary")
				elif dimension == 'engagement':
					priorities.append("Add emotional language and engaging elements")
				elif dimension == 'human_likeness':
					priorities.append("Increase natural variation and conversational tone")
				else:
					priorities.append(f"Improve {dimension.replace('_', ' ')}")
		
		# Add specific high-impact improvements
		if engagement.hook_strength < 0.4:
			priorities.insert(0, "Create compelling opening hook")
		
		if readability.average_sentence_length > 22:
			priorities.append("Break up long sentences")
		
		if human_likeness.sentence_length_variation < 0.3:
			priorities.append("Add sentence length variety")
		
		return priorities[:5]  # Return top 5 priorities
	
	def _generate_quick_wins(self, readability: ReadabilityMetrics, engagement: EngagementMetrics) -> List[str]:
		"""Generate quick win improvements"""
		
		quick_wins = []
		
		if engagement.question_engagement < 0.1:
			quick_wins.append("Add 1-2 engaging questions")
		
		if readability.average_sentence_length > 20:
			quick_wins.append("Break 2-3 longest sentences")
		
		if engagement.active_voice_ratio < 0.7:
			quick_wins.append("Convert passive voice to active")
		
		if engagement.emotional_language_ratio < 0.2:
			quick_wins.append("Add 3-4 emotional words")
		
		quick_wins.append("Add transition words between paragraphs")
		quick_wins.append("Strengthen opening sentence")
		
		return quick_wins[:4]  # Return top 4 quick wins
	
	def _generate_strategic_enhancements(self, dimension_scores: Dict[str, float]) -> List[str]:
		"""Generate strategic long-term enhancements"""
		
		strategic = []
		
		# Overall strategy based on dimension performance
		avg_score = statistics.mean(dimension_scores.values()) if dimension_scores else 0.5
		
		if avg_score < 0.5:
			strategic.append("Complete content restructuring for clarity and engagement")
		elif avg_score < 0.7:
			strategic.append("Systematic improvement across all quality dimensions")
		
		# Specific strategic recommendations
		strategic.extend([
			"Develop consistent brand voice throughout",
			"Optimize content structure for target audience",
			"Implement storytelling elements for better engagement",
			"Create content style guide for consistency"
		])
		
		return strategic[:4]
	
	def _classify_content_type(self, text: str) -> str:
		"""Classify the type of content"""
		
		text_lower = text.lower()
		
		# Simple heuristics for content type classification
		if any(word in text_lower for word in ['proposal', 'recommend', 'solution']):
			return "business_proposal"
		elif any(word in text_lower for word in ['email', 'subject', 'dear']):
			return "email"
		elif any(word in text_lower for word in ['article', 'introduction', 'conclusion']):
			return "article"
		elif any(word in text_lower for word in ['report', 'analysis', 'findings']):
			return "report"
		elif any(word in text_lower for word in ['blog', 'post', 'comment']):
			return "blog_post"
		else:
			return "general_content"
	
	async def _analyze_writing_style(self, text: str) -> Dict[str, Any]:
		"""Analyze writing style characteristics"""
		
		sentences = [s.strip() for s in text.split('.') if s.strip()]
		words = text.split()
		
		style_profile = {
			"formality_level": "medium",  # Simplified classification
			"tone": "neutral",
			"perspective": "third_person",
			"complexity": "medium"
		}
		
		# Analyze formality
		formal_indicators = ['furthermore', 'therefore', 'consequently', 'moreover']
		informal_indicators = ['gonna', 'wanna', 'yeah', 'okay']
		
		formal_count = sum(1 for word in words if word.lower() in formal_indicators)
		informal_count = sum(1 for word in words if word.lower() in informal_indicators)
		
		if formal_count > informal_count * 2:
			style_profile["formality_level"] = "high"
		elif informal_count > formal_count * 2:
			style_profile["formality_level"] = "low"
		
		# Analyze tone
		positive_words = sum(1 for word in words if word.lower() in self.emotional_words.get('positive', set()))
		negative_words = sum(1 for word in words if word.lower() in self.emotional_words.get('negative', set()))
		
		if positive_words > negative_words * 2:
			style_profile["tone"] = "positive"
		elif negative_words > positive_words * 2:
			style_profile["tone"] = "negative"
		
		# Analyze perspective
		first_person = sum(1 for word in words if word.lower() in ['i', 'my', 'me'])
		second_person = sum(1 for word in words if word.lower() in ['you', 'your'])
		
		if first_person > 0:
			style_profile["perspective"] = "first_person"
		elif second_person > len(words) * 0.02:  # More than 2% you/your
			style_profile["perspective"] = "second_person"
		
		return style_profile
	
	def _analyze_target_audience_fit(self,
	                                readability: ReadabilityMetrics,
	                                engagement: EngagementMetrics,
	                                target_audience: Optional[str]) -> Dict[str, Any]:
		"""Analyze how well content fits target audience"""
		
		if not target_audience:
			return {"status": "unknown", "message": "No target audience specified"}
		
		audience_analysis = {
			"specified_audience": target_audience,
			"readability_fit": readability.target_audience_fit,
			"engagement_fit": "unknown",
			"recommendations": []
		}
		
		target_lower = target_audience.lower()
		
		# Analyze engagement fit for different audiences
		if 'executive' in target_lower:
			if engagement.hook_strength >= 0.6 and engagement.urgency_indicators >= 0.3:
				audience_analysis["engagement_fit"] = "good"
			else:
				audience_analysis["engagement_fit"] = "needs_improvement"
				audience_analysis["recommendations"].append("Add more business urgency and impact")
		
		elif 'general' in target_lower:
			if engagement.overall_engagement_score >= 0.6:
				audience_analysis["engagement_fit"] = "good"
			else:
				audience_analysis["engagement_fit"] = "needs_improvement"
				audience_analysis["recommendations"].append("Increase accessibility and relatability")
		
		elif 'technical' in target_lower:
			if readability.complex_word_ratio >= 0.15:  # Technical content expected
				audience_analysis["engagement_fit"] = "good"
			else:
				audience_analysis["engagement_fit"] = "may_be_too_simple"
				audience_analysis["recommendations"].append("Add appropriate technical depth")
		
		return audience_analysis
	
	def _calculate_confidence_level(self,
	                               text: str,
	                               readability: ReadabilityMetrics,
	                               engagement: EngagementMetrics,
	                               human_likeness: HumanLikenessMetrics) -> float:
		"""Calculate confidence level in the analysis"""
		
		confidence_factors = []
		
		# Text length factor (longer text = higher confidence)
		text_length_factor = min(len(text) / 1000, 1.0)  # 1000+ chars = full confidence
		confidence_factors.append(text_length_factor)
		
		# Sentence count factor
		sentence_count = len([s for s in text.split('.') if s.strip()])
		sentence_factor = min(sentence_count / 10, 1.0)  # 10+ sentences = full confidence
		confidence_factors.append(sentence_factor)
		
		# NLP availability factor
		nlp_factor = 1.0 if NLP_AVAILABLE else 0.7
		confidence_factors.append(nlp_factor)
		
		# Analysis completeness factor
		metrics_available = sum([
			1 if readability else 0,
			1 if engagement else 0,
			1 if human_likeness else 0
		])
		completeness_factor = metrics_available / 3.0
		confidence_factors.append(completeness_factor)
		
		return statistics.mean(confidence_factors)
	
	def _update_average_quality_score(self):
		"""Update running average of quality scores"""
		self.average_quality_score = self.total_quality_scores / self.analysis_count
	
	def get_analyzer_statistics(self) -> Dict[str, Any]:
		"""Get analyzer performance statistics"""
		
		return {
			"total_analyses": self.analysis_count,
			"average_quality_score": self.average_quality_score,
			"dimensions_supported": len(QualityDimension),
			"nlp_available": NLP_AVAILABLE,
			"vocabulary_resources": {
				"emotional_words": sum(len(words) for words in self.emotional_words.values()),
				"engagement_words": sum(len(words) for words in self.engagement_words.values()),
				"conversational_markers": len(self.conversational_markers),
				"storytelling_indicators": len(self.storytelling_indicators)
			},
			"analysis_capabilities": [
				"Readability analysis with multiple metrics",
				"Engagement factor analysis",
				"Human-likeness assessment",
				"Content effectiveness evaluation",
				"Audience appropriateness scoring"
			]
		}
	
	# Logging methods
	
	def _log_initialization(self):
		nlp_status = "available" if NLP_AVAILABLE else "fallback mode"
		vocab_size = (sum(len(words) for words in self.emotional_words.values()) +
		             sum(len(words) for words in self.engagement_words.values()) +
		             len(self.conversational_markers) + len(self.storytelling_indicators))
		logger.info(f"ContentQualityAnalyzer: Initialized with {vocab_size} vocabulary resources ({nlp_status})")
	
	def _log_analysis_start(self, text_length: int, content_type: Optional[str]):
		content_info = f" ({content_type})" if content_type else ""
		logger.info(f"ContentQualityAnalyzer: Starting analysis of {text_length} characters{content_info}")
	
	def _log_analysis_complete(self, quality_score: float, duration: float):
		logger.info(f"ContentQualityAnalyzer: Analysis complete (quality: {quality_score:.3f}, {duration:.2f}s)")
	
	def _log_analysis_error(self, message: str):
		logger.error(f"ContentQualityAnalyzer Error: {message}")


# Example usage and testing
async def create_sample_quality_analysis():
	"""Create sample content quality analysis for testing"""
	
	# Initialize analyzer
	analyzer = ContentQualityAnalyzer()
	
	# Sample text with various quality characteristics
	sample_text = """
	Are you struggling to improve your business performance? This comprehensive solution 
	delivers exceptional results through innovative methodologies and proven frameworks. 
	Our team understands your challenges and we're excited to help transform your operations.
	
	Furthermore, our approach leverages cutting-edge technology to optimize your processes. 
	The benefits are significant: increased efficiency, reduced costs, and improved outcomes. 
	We've helped numerous organizations achieve remarkable success, and we're confident we can 
	do the same for you.
	
	What makes our solution unique? It's the combination of expertise, innovation, and 
	personalized service. We don't just deliver a product – we build lasting partnerships 
	that drive sustainable growth. Contact us today to discover how we can revolutionize 
	your business.
	"""
	
	# Perform comprehensive analysis
	result = await analyzer.analyze_content_quality(
		text=sample_text,
		target_audience="business executives",
		content_type="marketing content"
	)
	
	return {
		"analyzer": analyzer,
		"sample_text": sample_text,
		"result": result,
		"stats": analyzer.get_analyzer_statistics()
	}


if __name__ == "__main__":
	# Test the content quality analyzer
	import asyncio
	
	async def main():
		sample = await create_sample_quality_analysis()
		
		logger.info(f"Content Quality Analysis Results:")
		print("=" * 60)
		
		result = sample["result"]
		
		logger.info(f"📝 Text Length: {len(sample['sample_text'])} characters")
		logger.info(f"📋 Content Type: {result.content_type_classification}")
		print()
		
		logger.info(f"🎯 Overall Scores:")
		logger.info(f"  Quality Score: {result.overall_quality_score:.3f}")
		logger.info(f"  Content Effectiveness: {result.content_effectiveness:.3f}")
		logger.info(f"  Audience Appropriateness: {result.audience_appropriateness:.3f}")
		logger.info(f"  Confidence Level: {result.confidence_level:.3f}")
		print()
		
		logger.info(f"📊 Dimensional Analysis:")
		for dimension, score in result.dimension_scores.items():
			logger.info(f"  {dimension.replace('_', ' ').title()}: {score:.3f}")
		print()
		
		logger.info(f"📖 Readability Metrics:")
		r = result.readability_metrics
		logger.info(f"  Flesch Reading Ease: {r.flesch_reading_ease:.1f}")
		logger.info(f"  Grade Level: {r.overall_grade_level:.1f}")
		logger.info(f"  Difficulty: {r.difficulty_level}")
		logger.info(f"  Avg Sentence Length: {r.average_sentence_length:.1f} words")
		print()
		
		logger.info(f"🎭 Engagement Metrics:")
		e = result.engagement_metrics
		logger.info(f"  Hook Strength: {e.hook_strength:.3f}")
		logger.info(f"  Emotional Language: {e.emotional_language_ratio:.3f}")
		logger.info(f"  Active Voice: {e.active_voice_ratio:.3f}")
		logger.info(f"  Engagement Level: {e.engagement_level}")
		print()
		
		logger.info(f"👤 Human-likeness Metrics:")
		h = result.human_likeness_metrics
		logger.info(f"  Sentence Variation: {h.sentence_length_variation:.3f}")
		logger.info(f"  Vocabulary Diversity: {h.vocabulary_diversity:.3f}")
		logger.info(f"  Conversational Tone: {h.conversational_markers:.3f}")
		logger.info(f"  Human-likeness Score: {h.human_likeness_score:.3f}")
		print()
		
		if result.strength_areas:
			logger.info(f"💪 Strengths:")
			for strength in result.strength_areas:
				logger.info(f"  • {strength}")
		print()
		
		if result.improvement_areas:
			logger.info(f"🎯 Improvement Areas:")
			for improvement in result.improvement_areas:
				logger.info(f"  • {improvement}")
		print()
		
		if result.priority_improvements:
			logger.info(f"🚨 Priority Improvements:")
			for priority in result.priority_improvements:
				logger.info(f"  1. {priority}")
		print()
		
		if result.quick_wins:
			logger.info(f"⚡ Quick Wins:")
			for win in result.quick_wins:
				logger.info(f"  • {win}")
		print()
		
		logger.info(f"🎨 Writing Style Profile:")
		for aspect, value in result.writing_style_profile.items():
			logger.info(f"  {aspect.replace('_', ' ').title()}: {value}")
		print()
		
		logger.info(f"📈 Analyzer Statistics:")
		stats = sample["stats"]
		for key, value in stats.items():
			if isinstance(value, dict):
				logger.info(f"  {key.replace('_', ' ').title()}:")
				for k, v in value.items():
					logger.info(f"    {k}: {v}")
			elif isinstance(value, list):
				logger.info(f"  {key.replace('_', ' ').title()}:")
				for item in value:
					logger.info(f"    • {item}")
			else:
				logger.info(f"  {key.replace('_', ' ').title()}: {value}")
	
	asyncio.run(main())