"""
Voice Validator

This module provides real-time voice consistency validation for organizational
writing. Validates content against established voice patterns and provides
immediate feedback on voice compliance, deviation detection, and improvement
recommendations.
"""

import asyncio
import logging
logger = logging.getLogger(__name__)
import re
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple
from dataclasses import dataclass
from enum import Enum
import statistics

from pydantic import BaseModel, Field, ConfigDict
from uuid import uuid4

# Import voice analysis components
from ..analyzer.voice_pattern_analyzer import VoiceFingerprint, WritingPattern, VoiceComponent
from ..analyzer.style_pattern_extractor import StyleProfile, StylePattern, StyleDimension

# NLP imports with fallbacks
try:
	import spacy
	import nltk
	from nltk.tokenize import sent_tokenize, word_tokenize
	from textstat import flesch_reading_ease, flesch_kincaid_grade
	NLP_AVAILABLE = True
except ImportError:
	NLP_AVAILABLE = False


class DeviationType(str, Enum):
	"""Types of voice deviations"""
	
	VOCABULARY_MISMATCH = "vocabulary_mismatch"
	FORMALITY_SHIFT = "formality_shift"
	TONE_INCONSISTENCY = "tone_inconsistency"
	STYLE_DEVIATION = "style_deviation"
	COMPLEXITY_MISMATCH = "complexity_mismatch"
	BRAND_MISALIGNMENT = "brand_misalignment"
	TECHNICAL_INCONSISTENCY = "technical_inconsistency"
	SENTENCE_STRUCTURE_ANOMALY = "sentence_structure_anomaly"


class ValidationSeverity(str, Enum):
	"""Severity levels for voice validation issues"""
	
	CRITICAL = "critical"
	HIGH = "high"
	MEDIUM = "medium"
	LOW = "low"
	INFO = "info"


class VoiceDeviation(BaseModel):
	"""Individual voice deviation detection"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	deviation_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique deviation identifier")
	deviation_type: DeviationType = Field(description="Type of voice deviation")
	severity: ValidationSeverity = Field(description="Severity of the deviation")
	
	# Location and context
	text_position: int = Field(description="Character position in text where deviation occurs")
	text_length: int = Field(description="Length of text affected by deviation")
	context_snippet: str = Field(description="Text snippet showing the deviation")
	
	# Deviation details
	deviation_description: str = Field(description="Human-readable description of the deviation")
	expected_pattern: str = Field(description="Expected voice pattern")
	actual_pattern: str = Field(description="Actual pattern found")
	
	# Metrics
	deviation_score: float = Field(ge=0.0, le=1.0, description="How significant the deviation is (0=minor, 1=major)")
	confidence: float = Field(ge=0.0, le=1.0, description="Confidence in deviation detection")
	
	# Recommendations
	improvement_suggestions: List[str] = Field(description="Specific suggestions to fix deviation")
	alternative_text: Optional[str] = Field(None, description="Suggested alternative text")
	
	# Metadata
	detected_timestamp: datetime = Field(default_factory=datetime.now)


class ValidationResult(BaseModel):
	"""Comprehensive voice validation result"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	validation_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique validation identifier")
	text_analyzed: str = Field(description="Text that was analyzed")
	organization_name: str = Field(description="Organization whose voice was validated against")
	
	# Overall validation metrics
	overall_voice_score: float = Field(ge=0.0, le=1.0, description="Overall voice consistency score")
	voice_confidence: float = Field(ge=0.0, le=1.0, description="Confidence in voice match")
	deviation_count: int = Field(ge=0, description="Total number of deviations found")
	
	# Deviation analysis
	deviations: List[VoiceDeviation] = Field(description="List of identified deviations")
	deviations_by_severity: Dict[str, int] = Field(description="Count of deviations by severity")
	deviations_by_type: Dict[str, int] = Field(description="Count of deviations by type")
	
	# Voice component scores
	vocabulary_score: float = Field(ge=0.0, le=1.0, description="Vocabulary consistency score")
	formality_score: float = Field(ge=0.0, le=1.0, description="Formality level consistency")
	tone_score: float = Field(ge=0.0, le=1.0, description="Tone consistency score")
	complexity_score: float = Field(ge=0.0, le=1.0, description="Complexity level consistency")
	style_score: float = Field(ge=0.0, le=1.0, description="Overall style consistency")
	
	# Improvement summary
	improvement_priority: ValidationSeverity = Field(description="Highest priority improvement needed")
	key_recommendations: List[str] = Field(description="Top 3-5 improvement recommendations")
	estimated_effort: str = Field(description="Estimated effort to address issues")
	
	# Analysis metadata
	analysis_duration_seconds: float = Field(description="Time taken for validation")
	validation_timestamp: datetime = Field(default_factory=datetime.now)


class VoiceValidator:
	"""
	Real-time voice consistency field_validator
	
	Provides immediate validation of text content against established
	organizational voice patterns, identifying deviations and providing
	specific improvement recommendations for voice consistency.
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
		
		# Validation configuration
		self.deviation_thresholds = {
			ValidationSeverity.CRITICAL: 0.8,
			ValidationSeverity.HIGH: 0.6,
			ValidationSeverity.MEDIUM: 0.4,
			ValidationSeverity.LOW: 0.2,
			ValidationSeverity.INFO: 0.0
		}
		
		# Cache for voice profiles
		self.voice_profiles_cache: Dict[str, VoiceFingerprint] = {}
		self.style_profiles_cache: Dict[str, StyleProfile] = {}
		
		# Validation statistics
		self.validation_count = 0
		self.total_deviations_found = 0
		self.average_validation_time = 0.0
		
		self._log_initialization()
	
	async def validate_voice_consistency(self, text: str, 
	                                     organization_name: str,
	                                     voice_profile: Optional[VoiceFingerprint] = None,
	                                     style_profile: Optional[StyleProfile] = None,
	                                     realtime_mode: bool = True) -> ValidationResult:
		"""
		Validate text against organizational voice patterns
		
		Args:
			text: Text to validate
			organization_name: Organization name for voice comparison
			voice_profile: Optional voice fingerprint to validate against
			style_profile: Optional style profile to validate against
			realtime_mode: Whether to optimize for real-time performance
			
		Returns:
			Comprehensive validation result with deviations and recommendations
		"""
		start_time = datetime.now()
		
		try:
			self._log_validation_start(organization_name, len(text))
			
			# Get voice profiles (from cache or provided)
			if not voice_profile:
				voice_profile = self.voice_profiles_cache.get(organization_name)
			if not style_profile:
				style_profile = self.style_profiles_cache.get(organization_name)
			
			if not voice_profile:
				raise ValueError(f"No voice profile found for {organization_name}")
			
			# Perform validation analysis
			deviations = []
			
			# Vocabulary validation
			vocab_deviations, vocab_score = await self._validate_vocabulary(text, voice_profile)
			deviations.extend(vocab_deviations)
			
			# Formality validation
			formality_deviations, formality_score = await self._validate_formality(text, voice_profile)
			deviations.extend(formality_deviations)
			
			# Tone validation
			tone_deviations, tone_score = await self._validate_tone(text, voice_profile)
			deviations.extend(tone_deviations)
			
			# Complexity validation
			complexity_deviations, complexity_score = await self._validate_complexity(text, voice_profile)
			deviations.extend(complexity_deviations)
			
			# Style validation (if style profile available)
			if style_profile:
				style_deviations, style_score = await self._validate_style_patterns(text, style_profile)
				deviations.extend(style_deviations)
			else:
				style_score = 0.5  # Neutral if no style profile
			
			# Calculate overall scores
			component_scores = [vocab_score, formality_score, tone_score, complexity_score, style_score]
			overall_voice_score = statistics.mean([s for s in component_scores if s is not None])
			
			# Calculate confidence
			voice_confidence = self._calculate_validation_confidence(
				len(text), len(deviations), voice_profile.confidence_level
			)
			
			# Analyze deviations
			deviations_by_severity = self._count_deviations_by_severity(deviations)
			deviations_by_type = self._count_deviations_by_type(deviations)
			
			# Generate recommendations
			key_recommendations = self._generate_key_recommendations(deviations)
			improvement_priority = self._determine_improvement_priority(deviations)
			estimated_effort = self._estimate_improvement_effort(deviations)
			
			# Create validation result
			validation_result = ValidationResult(
				text_analyzed=text[:500] + "..." if len(text) > 500 else text,  # Store snippet
				organization_name=organization_name,
				overall_voice_score=overall_voice_score,
				voice_confidence=voice_confidence,
				deviation_count=len(deviations),
				deviations=deviations,
				deviations_by_severity=deviations_by_severity,
				deviations_by_type=deviations_by_type,
				vocabulary_score=vocab_score,
				formality_score=formality_score,
				tone_score=tone_score,
				complexity_score=complexity_score,
				style_score=style_score,
				improvement_priority=improvement_priority,
				key_recommendations=key_recommendations,
				estimated_effort=estimated_effort,
				analysis_duration_seconds=(datetime.now() - start_time).total_seconds()
			)
			
			# Update statistics
			self.validation_count += 1
			self.total_deviations_found += len(deviations)
			self._update_average_validation_time(validation_result.analysis_duration_seconds)
			
			self._log_validation_complete(
				organization_name, overall_voice_score, len(deviations), validation_result.analysis_duration_seconds
			)
			
			return validation_result
			
		except Exception as e:
			self._log_validation_error(f"Voice validation failed for {organization_name}: {str(e)}")
			raise
	
	async def _validate_vocabulary(self, text: str, voice_profile: VoiceFingerprint) -> Tuple[List[VoiceDeviation], float]:
		"""Validate vocabulary consistency against voice profile"""
		
		deviations = []
		words = text.lower().split()
		
		if not words:
			return deviations, 1.0
		
		# Calculate vocabulary overlap
		text_vocab = set(words)
		profile_vocab = set(voice_profile.vocabulary_signature.keys())
		
		overlap = len(text_vocab.intersection(profile_vocab))
		vocab_score = overlap / len(text_vocab) if text_vocab else 0.0
		
		# Find unusual vocabulary usage
		unusual_words = text_vocab - profile_vocab
		
		# Identify significant vocabulary deviations
		if len(unusual_words) / len(text_vocab) > 0.3:  # More than 30% unusual words
			deviation = VoiceDeviation(
				deviation_type=DeviationType.VOCABULARY_MISMATCH,
				severity=ValidationSeverity.MEDIUM,
				text_position=0,
				text_length=len(text),
				context_snippet=text[:100] + "..." if len(text) > 100 else text,
				deviation_description=f"High unusual vocabulary usage ({len(unusual_words)} unfamiliar words)",
				expected_pattern="Vocabulary consistent with organizational voice",
				actual_pattern=f"Contains {len(unusual_words)} words not in voice profile",
				deviation_score=len(unusual_words) / len(text_vocab),
				confidence=0.7,
				improvement_suggestions=[
					"Review word choices for consistency with organizational voice",
					"Consider using more familiar terminology",
					"Align vocabulary with established writing patterns"
				]
			)
			deviations.append(deviation)
		
		return deviations, vocab_score
	
	async def _validate_formality(self, text: str, voice_profile: VoiceFingerprint) -> Tuple[List[VoiceDeviation], float]:
		"""Validate formality level against voice profile"""
		
		deviations = []
		
		# Calculate text formality
		text_formality = await self._calculate_text_formality(text)
		expected_formality = voice_profile.formality_level
		
		formality_difference = abs(text_formality - expected_formality)
		formality_score = max(0.0, 1.0 - formality_difference)
		
		# Check for significant formality deviations
		if formality_difference > 0.3:  # Significant formality shift
			severity = ValidationSeverity.HIGH if formality_difference > 0.5 else ValidationSeverity.MEDIUM
			
			deviation = VoiceDeviation(
				deviation_type=DeviationType.FORMALITY_SHIFT,
				severity=severity,
				text_position=0,
				text_length=len(text),
				context_snippet=text[:100] + "..." if len(text) > 100 else text,
				deviation_description=f"Formality mismatch: text={text_formality:.2f}, expected={expected_formality:.2f}",
				expected_pattern=f"Formality level around {expected_formality:.2f}",
				actual_pattern=f"Formality level at {text_formality:.2f}",
				deviation_score=formality_difference,
				confidence=0.8,
				improvement_suggestions=self._get_formality_suggestions(text_formality, expected_formality)
			)
			deviations.append(deviation)
		
		return deviations, formality_score
	
	async def _calculate_text_formality(self, text: str) -> float:
		"""Calculate formality level of text"""
		
		formal_indicators = {
			'furthermore', 'moreover', 'consequently', 'nevertheless', 'accordingly',
			'therefore', 'thus', 'hence', 'subsequently', 'notwithstanding'
		}
		
		informal_indicators = {
			'yeah', 'okay', 'gonna', 'wanna', 'kinda', 'anyway', 'basically',
			'actually', 'really', 'pretty', 'just', 'quite'
		}
		
		words = text.lower().split()
		formal_count = sum(1 for word in words if word in formal_indicators)
		informal_count = sum(1 for word in words if word in informal_indicators)
		
		if formal_count + informal_count == 0:
			return 0.5  # Neutral formality
		
		return formal_count / (formal_count + informal_count)
	
	def _get_formality_suggestions(self, actual: float, expected: float) -> List[str]:
		"""Get suggestions for formality adjustment"""
		
		if actual < expected:  # Need more formal
			return [
				"Use more formal vocabulary and sentence structures",
				"Avoid contractions and colloquial expressions",
				"Include formal transition words and phrases",
				"Use passive voice where appropriate"
			]
		else:  # Need less formal
			return [
				"Use simpler, more conversational language",
				"Shorten complex sentences",
				"Use active voice more frequently",
				"Include more accessible vocabulary"
			]
	
	async def _validate_tone(self, text: str, voice_profile: VoiceFingerprint) -> Tuple[List[VoiceDeviation], float]:
		"""Validate tone consistency against voice profile"""
		
		deviations = []
		
		# Analyze text tone
		text_tone_profile = await self._analyze_text_tone(text)
		expected_tone_profile = voice_profile.tone_profile
		
		# Calculate tone similarity
		tone_scores = []
		for tone_type in expected_tone_profile:
			expected_score = expected_tone_profile.get(tone_type, 0.0)
			actual_score = text_tone_profile.get(tone_type, 0.0)
			tone_scores.append(1.0 - abs(expected_score - actual_score))
		
		overall_tone_score = statistics.mean(tone_scores) if tone_scores else 0.5
		
		# Check for significant tone deviations
		for tone_type, expected_score in expected_tone_profile.items():
			if expected_score > 0.01:  # Only check significant tones
				actual_score = text_tone_profile.get(tone_type, 0.0)
				difference = abs(expected_score - actual_score)
				
				if difference > 0.02:  # Significant tone deviation
					severity = ValidationSeverity.MEDIUM if difference > 0.05 else ValidationSeverity.LOW
					
					deviation = VoiceDeviation(
						deviation_type=DeviationType.TONE_INCONSISTENCY,
						severity=severity,
						text_position=0,
						text_length=len(text),
						context_snippet=text[:100] + "..." if len(text) > 100 else text,
						deviation_description=f"Tone inconsistency in {tone_type}: expected {expected_score:.3f}, found {actual_score:.3f}",
						expected_pattern=f"{tone_type.title()} tone at {expected_score:.3f}",
						actual_pattern=f"{tone_type.title()} tone at {actual_score:.3f}",
						deviation_score=difference,
						confidence=0.6,
						improvement_suggestions=[
							f"Adjust {tone_type} tone to match organizational voice",
							f"Review content for {tone_type} language indicators",
							"Consider organizational tone preferences"
						]
					)
					deviations.append(deviation)
		
		return deviations, overall_tone_score
	
	async def _analyze_text_tone(self, text: str) -> Dict[str, float]:
		"""Analyze tone characteristics of text"""
		
		tone_indicators = {
			'professional': {
				'pleased', 'respectfully', 'appreciate', 'acknowledge', 'recommend',
				'suggest', 'consider', 'propose', 'comprehensive', 'systematic'
			},
			'friendly': {
				'thanks', 'great', 'wonderful', 'fantastic', 'love', 'enjoy',
				'happy', 'excited', 'amazing', 'awesome'
			},
			'authoritative': {
				'must', 'shall', 'will', 'required', 'mandatory', 'essential',
				'critical', 'imperative', 'definitive', 'conclusive'
			},
			'collaborative': {
				'together', 'partnership', 'team', 'joint', 'shared', 'mutual',
				'cooperative', 'collective', 'unified', 'alliance'
			}
		}
		
		words = text.lower().split()
		total_words = len(words)
		
		tone_profile = {}
		for tone, indicators in tone_indicators.items():
			tone_count = sum(1 for word in words if word in indicators)
			tone_profile[tone] = tone_count / total_words if total_words > 0 else 0.0
		
		return tone_profile
	
	async def _validate_complexity(self, text: str, voice_profile: VoiceFingerprint) -> Tuple[List[VoiceDeviation], float]:
		"""Validate complexity level against voice profile"""
		
		deviations = []
		
		# Calculate text complexity
		text_complexity = await self._calculate_text_complexity(text)
		expected_complexity = voice_profile.complexity_score
		
		complexity_difference = abs(text_complexity - expected_complexity)
		complexity_score = max(0.0, 1.0 - complexity_difference)
		
		# Check for significant complexity deviations
		if complexity_difference > 0.2:  # Significant complexity shift
			severity = ValidationSeverity.HIGH if complexity_difference > 0.4 else ValidationSeverity.MEDIUM
			
			deviation = VoiceDeviation(
				deviation_type=DeviationType.COMPLEXITY_MISMATCH,
				severity=severity,
				text_position=0,
				text_length=len(text),
				context_snippet=text[:100] + "..." if len(text) > 100 else text,
				deviation_description=f"Complexity mismatch: text={text_complexity:.2f}, expected={expected_complexity:.2f}",
				expected_pattern=f"Complexity level around {expected_complexity:.2f}",
				actual_pattern=f"Complexity level at {text_complexity:.2f}",
				deviation_score=complexity_difference,
				confidence=0.7,
				improvement_suggestions=self._get_complexity_suggestions(text_complexity, expected_complexity)
			)
			deviations.append(deviation)
		
		return deviations, complexity_score
	
	async def _calculate_text_complexity(self, text: str) -> float:
		"""Calculate complexity score for text"""
		
		if not text.strip():
			return 0.0
		
		# Use textstat if available
		if NLP_AVAILABLE:
			try:
				flesch_score = flesch_reading_ease(text)
				fk_grade = flesch_kincaid_grade(text)
				
				# Normalize to 0-1 scale
				complexity = max(0.0, min(1.0, (100 - flesch_score) / 100.0))
				return complexity
			except (ValueError, TypeError, ZeroDivisionError) as e:
				self._log_validation_error(f"Readability scoring failed, using fallback: {e}")

		# Fallback complexity calculation
		sentences = text.split('.')
		words = text.split()
		
		if not sentences or not words:
			return 0.0
		
		avg_sentence_length = len(words) / len(sentences)
		
		# Count complex words (rough approximation)
		complex_words = sum(1 for word in words if len(word) > 6)
		complex_word_ratio = complex_words / len(words)
		
		# Simple complexity score
		length_factor = min(avg_sentence_length / 20.0, 1.0)  # Normalize by 20 words
		complexity = (length_factor + complex_word_ratio) / 2
		
		return min(complexity, 1.0)
	
	def _get_complexity_suggestions(self, actual: float, expected: float) -> List[str]:
		"""Get suggestions for complexity adjustment"""
		
		if actual > expected:  # Too complex
			return [
				"Simplify sentence structures",
				"Use shorter, clearer sentences",
				"Replace complex words with simpler alternatives",
				"Break long sentences into shorter ones"
			]
		else:  # Too simple
			return [
				"Use more sophisticated vocabulary",
				"Include more detailed explanations",
				"Combine simple sentences for better flow",
				"Add technical depth where appropriate"
			]
	
	async def _validate_style_patterns(self, text: str, style_profile: StyleProfile) -> Tuple[List[VoiceDeviation], float]:
		"""Validate style patterns against style profile"""
		
		deviations = []
		
		# For now, simple style validation - in production would be more comprehensive
		style_score = 0.8  # Placeholder
		
		# Check for style pattern adherence
		# This would involve checking against style_profile.style_patterns
		# For brevity, including basic validation
		
		if style_profile.formality_score > 0.7:  # Formal organization
			informal_words = ['yeah', 'okay', 'gonna', 'wanna']
			found_informal = [word for word in informal_words if word in text.lower()]
			
			if found_informal:
				deviation = VoiceDeviation(
					deviation_type=DeviationType.STYLE_DEVIATION,
					severity=ValidationSeverity.MEDIUM,
					text_position=text.lower().find(found_informal[0]),
					text_length=len(found_informal[0]),
					context_snippet=f"Found informal language: {', '.join(found_informal)}",
					deviation_description=f"Informal language in formal organization context",
					expected_pattern="Formal language consistent with organizational style",
					actual_pattern=f"Informal words: {', '.join(found_informal)}",
					deviation_score=len(found_informal) / len(text.split()),
					confidence=0.8,
					improvement_suggestions=[
						"Replace informal language with formal alternatives",
						"Maintain consistent formality level",
						"Review organizational style guidelines"
					]
				)
				deviations.append(deviation)
		
		return deviations, style_score
	
	def _count_deviations_by_severity(self, deviations: List[VoiceDeviation]) -> Dict[str, int]:
		"""Count deviations by severity level"""
		
		severity_counts = defaultdict(int)
		for deviation in deviations:
			severity_counts[deviation.severity.value] += 1
		
		return dict(severity_counts)
	
	def _count_deviations_by_type(self, deviations: List[VoiceDeviation]) -> Dict[str, int]:
		"""Count deviations by type"""
		
		type_counts = defaultdict(int)
		for deviation in deviations:
			type_counts[deviation.deviation_type.value] += 1
		
		return dict(type_counts)
	
	def _generate_key_recommendations(self, deviations: List[VoiceDeviation]) -> List[str]:
		"""Generate top recommendations based on deviations"""
		
		if not deviations:
			return ["Text is consistent with organizational voice"]
		
		# Group by type and severity
		recommendation_priority = defaultdict(list)
		
		for deviation in deviations:
			priority_score = self._get_severity_score(deviation.severity)
			for suggestion in deviation.improvement_suggestions:
				recommendation_priority[suggestion].append(priority_score)
		
		# Rank recommendations by average priority
		ranked_recommendations = []
		for suggestion, scores in recommendation_priority.items():
			avg_score = statistics.mean(scores)
			ranked_recommendations.append((suggestion, avg_score))
		
		# Return top 5 recommendations
		ranked_recommendations.sort(key=lambda x: x[1], reverse=True)
		return [rec[0] for rec in ranked_recommendations[:5]]
	
	def _get_severity_score(self, severity: ValidationSeverity) -> float:
		"""Get numeric score for severity level"""
		severity_scores = {
			ValidationSeverity.CRITICAL: 1.0,
			ValidationSeverity.HIGH: 0.8,
			ValidationSeverity.MEDIUM: 0.6,
			ValidationSeverity.LOW: 0.4,
			ValidationSeverity.INFO: 0.2
		}
		return severity_scores.get(severity, 0.5)
	
	def _determine_improvement_priority(self, deviations: List[VoiceDeviation]) -> ValidationSeverity:
		"""Determine the highest priority improvement needed"""
		
		if not deviations:
			return ValidationSeverity.INFO
		
		# Return the highest severity found
		severity_order = [
			ValidationSeverity.CRITICAL,
			ValidationSeverity.HIGH,
			ValidationSeverity.MEDIUM,
			ValidationSeverity.LOW,
			ValidationSeverity.INFO
		]
		
		for severity in severity_order:
			if any(dev.severity == severity for dev in deviations):
				return severity
		
		return ValidationSeverity.INFO
	
	def _estimate_improvement_effort(self, deviations: List[VoiceDeviation]) -> str:
		"""Estimate effort required to address deviations"""
		
		if not deviations:
			return "No changes needed"
		
		critical_count = sum(1 for dev in deviations if dev.severity == ValidationSeverity.CRITICAL)
		high_count = sum(1 for dev in deviations if dev.severity == ValidationSeverity.HIGH)
		medium_count = sum(1 for dev in deviations if dev.severity == ValidationSeverity.MEDIUM)
		
		total_significant = critical_count + high_count + medium_count
		
		if critical_count > 5 or total_significant > 15:
			return "High effort - Major revision needed"
		elif critical_count > 2 or total_significant > 8:
			return "Medium effort - Moderate revision needed"
		elif critical_count > 0 or total_significant > 3:
			return "Low effort - Minor adjustments needed"
		else:
			return "Minimal effort - Minor tweaks needed"
	
	def _calculate_validation_confidence(self, text_length: int, deviation_count: int, profile_confidence: float) -> float:
		"""Calculate confidence in the validation result"""
		
		# Confidence factors
		text_length_factor = min(text_length / 500, 1.0)  # 500+ chars for good confidence
		profile_factor = profile_confidence
		analysis_factor = 1.0 - (deviation_count / max(text_length / 100, 1))  # Fewer deviations = higher confidence
		
		confidence = (text_length_factor + profile_factor + max(analysis_factor, 0.0)) / 3
		return min(confidence, 1.0)
	
	def cache_voice_profile(self, organization_name: str, voice_profile: VoiceFingerprint):
		"""Cache a voice profile for faster validation"""
		self.voice_profiles_cache[organization_name] = voice_profile
	
	def cache_style_profile(self, organization_name: str, style_profile: StyleProfile):
		"""Cache a style profile for faster validation"""
		self.style_profiles_cache[organization_name] = style_profile
	
	def get_validation_statistics(self) -> Dict[str, Any]:
		"""Get validation performance statistics"""
		
		return {
			"total_validations": self.validation_count,
			"total_deviations_found": self.total_deviations_found,
			"average_deviations_per_validation": self.total_deviations_found / max(self.validation_count, 1),
			"average_validation_time_seconds": self.average_validation_time,
			"cached_voice_profiles": len(self.voice_profiles_cache),
			"cached_style_profiles": len(self.style_profiles_cache),
			"nlp_available": NLP_AVAILABLE
		}
	
	def _update_average_validation_time(self, duration: float):
		"""Update average validation time statistics"""
		if self.validation_count == 1:
			self.average_validation_time = duration
		else:
			# Running average
			self.average_validation_time = (
				(self.average_validation_time * (self.validation_count - 1) + duration) / self.validation_count
			)
	
	# Logging methods
	
	def _log_initialization(self):
		nlp_status = "available" if NLP_AVAILABLE else "fallback mode"
		logger.info(f"VoiceValidator: Initialized ({nlp_status})")
	
	def _log_validation_start(self, organization: str, text_length: int):
		logger.info(f"VoiceValidator: Starting validation for {organization} ({text_length} characters)")
	
	def _log_validation_complete(self, organization: str, voice_score: float, deviation_count: int, duration: float):
		logger.info(f"VoiceValidator: Validation complete for {organization} (score: {voice_score:.3f}, {deviation_count} deviations, {duration:.2f}s)")
	
	def _log_validation_error(self, message: str):
		logger.error(f"VoiceValidator Error: {message}")


# Example usage and testing
async def create_sample_voice_validation():
	"""Create sample voice validation for testing"""
	
	# Initialize field_validator
	field_validator = VoiceValidator()
	
	# Create sample voice profile
	from ..analyzer.voice_pattern_analyzer import VoiceFingerprint
	
	sample_voice_profile = VoiceFingerprint(
		organization_name="Professional Services Firm",
		vocabulary_signature={
			"comprehensive": 0.005,
			"strategic": 0.004,
			"innovative": 0.003,
			"excellence": 0.002,
			"deliver": 0.004
		},
		sentence_patterns={
			"avg_sentence_length": 18.5,
			"declarative_sentences": 0.85,
			"question_sentences": 0.10
		},
		formality_level=0.7,  # Fairly formal
		complexity_score=0.6,  # Moderate complexity
		tone_profile={
			"professional": 0.012,
			"collaborative": 0.008,
			"authoritative": 0.005
		},
		persuasion_style={
			"evidence_based": 0.015,
			"benefit_focused": 0.010
		},
		technical_density=0.08,
		patterns=[],  # Simplified for example
		consistency_score=0.8,
		distinctiveness_score=0.7,
		confidence_level=0.85,
		documents_analyzed=10,
		total_words=25000
	)
	
	# Cache the profile
	field_validator.cache_voice_profile("Professional Services Firm", sample_voice_profile)
	
	# Sample text to validate (with some intentional deviations)
	test_text = """
	Hey there! We're super excited to tell you about our awesome solution that's gonna 
	revolutionize your business operations. It's really, really good and we think you'll 
	love it. Our team has worked hard to create something fantastic that will make your 
	life so much easier. We're confident this is the best thing ever!
	"""
	
	# Perform validation
	validation_result = await field_validator.validate_voice_consistency(
		test_text, "Professional Services Firm"
	)
	
	return validation_result, field_validator.get_validation_statistics()


if __name__ == "__main__":
	# Test the voice field_validator
	import asyncio
	
	async def main():
		result, stats = await create_sample_voice_validation()
		
		logger.info(f"Voice Validation Results:")
		print("=" * 50)
		logger.info(f"Organization: {result.organization_name}")
		logger.info(f"Overall Voice Score: {result.overall_voice_score:.3f}")
		logger.info(f"Voice Confidence: {result.voice_confidence:.3f}")
		logger.info(f"Total Deviations: {result.deviation_count}")
		
		logger.info(f"\nComponent Scores:")
		logger.info(f"  Vocabulary: {result.vocabulary_score:.3f}")
		logger.info(f"  Formality: {result.formality_score:.3f}")
		logger.info(f"  Tone: {result.tone_score:.3f}")
		logger.info(f"  Complexity: {result.complexity_score:.3f}")
		logger.info(f"  Style: {result.style_score:.3f}")
		
		logger.info(f"\nDeviations by Severity:")
		for severity, count in result.deviations_by_severity.items():
			logger.info(f"  {severity.title()}: {count}")
		
		logger.info(f"\nTop Deviations:")
		for i, deviation in enumerate(result.deviations[:3], 1):
			logger.info(f"  {i}. {deviation.deviation_type.value}: {deviation.deviation_description}")
			logger.info(f"     Severity: {deviation.severity.value}")
			logger.info(f"     Confidence: {deviation.confidence:.3f}")
		
		logger.info(f"\nKey Recommendations:")
		for i, rec in enumerate(result.key_recommendations, 1):
			logger.info(f"  {i}. {rec}")
		
		logger.info(f"\nImprovement Summary:")
		logger.info(f"  Priority: {result.improvement_priority.value}")
		logger.info(f"  Effort: {result.estimated_effort}")
		logger.info(f"  Analysis Time: {result.analysis_duration_seconds:.3f}s")
		
		logger.info(f"\nValidator Statistics:")
		for key, value in stats.items():
			logger.info(f"  {key.replace('_', ' ').title()}: {value}")
	
	asyncio.run(main())