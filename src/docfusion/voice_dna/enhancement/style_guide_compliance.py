"""
Style Guide Compliance

Advanced style guide compliance system that validates content against specific
organizational style guidelines, brand voice requirements, and writing standards.
Provides detailed compliance scoring and actionable recommendations.
"""

import asyncio
import re
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple, Union, Pattern
from enum import Enum
import statistics
import json

from pydantic import BaseModel, Field, ConfigDict
from uuid import uuid4

# Import Voice DNA components for voice profile integration
from ..analyzer.voice_pattern_analyzer import VoiceFingerprint
from ..analyzer.style_pattern_extractor import StyleProfile


class ViolationSeverity(str, Enum):
	"""Severity levels for style guide violations"""
	
	CRITICAL = "critical"
	HIGH = "high"
	MEDIUM = "medium"
	LOW = "low"
	INFORMATIONAL = "informational"


class RuleCategory(str, Enum):
	"""Categories of style guide rules"""
	
	GRAMMAR = "grammar"
	PUNCTUATION = "punctuation"
	VOCABULARY = "vocabulary"
	TONE = "tone"
	FORMAT = "format"
	BRAND_VOICE = "brand_voice"
	TECHNICAL = "technical"
	ACCESSIBILITY = "accessibility"


class StyleGuideRule(BaseModel):
	"""Individual style guide rule definition"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	rule_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique rule identifier")
	rule_name: str = Field(description="Human-readable rule name")
	category: RuleCategory = Field(description="Rule category")
	
	# Rule definition
	description: str = Field(description="Detailed rule description")
	pattern: Optional[str] = Field(None, description="Regex pattern for rule detection")
	keywords: List[str] = Field(default=[], description="Keywords to check")
	forbidden_words: List[str] = Field(default=[], description="Words that should not be used")
	required_words: List[str] = Field(default=[], description="Words that should be used")
	
	# Rule parameters
	severity: ViolationSeverity = Field(description="Violation severity level")
	is_active: bool = Field(default=True, description="Whether rule is currently active")
	applies_to: List[str] = Field(default=["all"], description="Content types this rule applies to")
	
	# Validation logic
	validation_function: Optional[str] = Field(None, description="Custom validation function name")
	threshold_value: Optional[float] = Field(None, description="Threshold for numeric checks")
	
	# Correction guidance
	correction_suggestion: str = Field(description="How to fix violations")
	examples: List[Dict[str, str]] = Field(default=[], description="Before/after examples")
	
	# Metadata
	created_by: Optional[str] = Field(None, description="Rule creator")
	last_updated: datetime = Field(default_factory=datetime.now)


class ComplianceViolation(BaseModel):
	"""Individual compliance violation found in text"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	violation_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique violation identifier")
	rule_id: str = Field(description="Associated rule ID")
	rule_name: str = Field(description="Rule name for reference")
	
	# Violation location
	text_position: int = Field(description="Character position where violation occurs")
	text_length: int = Field(description="Length of violating text")
	context_snippet: str = Field(description="Text snippet showing violation in context")
	
	# Violation details
	violation_description: str = Field(description="Description of the specific violation")
	violating_text: str = Field(description="The actual text that violates the rule")
	severity: ViolationSeverity = Field(description="Severity of this violation")
	
	# Correction information
	suggested_correction: str = Field(description="Suggested fix for the violation")
	alternative_options: List[str] = Field(default=[], description="Alternative correction options")
	confidence_score: float = Field(ge=0.0, le=1.0, description="Confidence in violation detection")
	
	# Impact assessment
	impact_on_brand: float = Field(ge=0.0, le=1.0, description="Impact on brand consistency")
	impact_on_readability: float = Field(ge=0.0, le=1.0, description="Impact on readability")
	fix_difficulty: str = Field(description="Difficulty of fixing: easy, medium, hard")
	
	# Metadata
	detected_timestamp: datetime = Field(default_factory=datetime.now)


class ComplianceRequest(BaseModel):
	"""Request for style guide compliance checking"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	request_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique request identifier")
	
	# Content to check
	text_content: str = Field(description="Text to check for compliance")
	content_type: str = Field(default="general", description="Type of content")
	content_context: Optional[str] = Field(None, description="Context or purpose of content")
	
	# Style guide configuration
	style_guide_name: str = Field(description="Name/ID of style guide to use")
	rule_categories: List[RuleCategory] = Field(default=[], description="Specific categories to check")
	severity_threshold: ViolationSeverity = Field(default=ViolationSeverity.LOW, description="Minimum severity to report")
	
	# Voice profile integration
	voice_profile: Optional[VoiceFingerprint] = Field(None, description="Voice profile for brand compliance")
	style_profile: Optional[StyleProfile] = Field(None, description="Style profile for consistency")
	
	# Checking options
	include_suggestions: bool = Field(default=True, description="Include correction suggestions")
	detailed_analysis: bool = Field(default=True, description="Include detailed compliance analysis")
	custom_rules: List[StyleGuideRule] = Field(default=[], description="Additional custom rules")
	
	# Metadata
	requested_by: Optional[str] = Field(None, description="User requesting compliance check")
	request_timestamp: datetime = Field(default_factory=datetime.now)


class ComplianceResult(BaseModel):
	"""Comprehensive style guide compliance result"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	result_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique result identifier")
	request_id: str = Field(description="Associated request ID")
	
	# Overall compliance metrics
	overall_compliance_score: float = Field(ge=0.0, le=1.0, description="Overall compliance score")
	total_violations: int = Field(ge=0, description="Total number of violations found")
	violations_by_severity: Dict[str, int] = Field(description="Count of violations by severity")
	violations_by_category: Dict[str, int] = Field(description="Count of violations by category")
	
	# Detailed violations
	violations: List[ComplianceViolation] = Field(description="List of all violations found")
	critical_violations: List[ComplianceViolation] = Field(description="Critical violations requiring immediate attention")
	
	# Compliance analysis
	category_compliance: Dict[str, float] = Field(description="Compliance score by category")
	rule_compliance: Dict[str, bool] = Field(description="Pass/fail status by rule")
	brand_voice_alignment: float = Field(ge=0.0, le=1.0, description="Alignment with brand voice")
	
	# Improvement recommendations
	priority_fixes: List[str] = Field(description="High-priority fixes needed")
	quick_fixes: List[str] = Field(description="Easy fixes for immediate improvement")
	strategic_improvements: List[str] = Field(description="Long-term strategic improvements")
	
	# Compliance insights
	compliance_trends: Dict[str, Any] = Field(description="Trends in compliance issues")
	best_practices_followed: List[str] = Field(description="Style guide best practices being followed")
	areas_of_excellence: List[str] = Field(description="Areas where content excels")
	
	# Quality assurance
	analysis_confidence: float = Field(ge=0.0, le=1.0, description="Confidence in compliance analysis")
	rules_checked: int = Field(description="Number of rules that were checked")
	coverage_completeness: float = Field(ge=0.0, le=1.0, description="Completeness of compliance coverage")
	
	# Metadata
	style_guide_used: str = Field(description="Style guide that was applied")
	analysis_duration_seconds: float = Field(description="Time taken for analysis")
	analysis_timestamp: datetime = Field(default_factory=datetime.now)


class StyleGuideCompliance:
	"""
	Advanced style guide compliance system
	
	Validates content against specific organizational style guides, brand voice
	requirements, and writing standards. Provides detailed compliance scoring,
	violation detection, and actionable recommendations for improvement.
	"""
	
	def __init__(self):
		# Style guide storage
		self.style_guides: Dict[str, Dict[str, Any]] = {}
		self.custom_rules: Dict[str, StyleGuideRule] = {}
		self.rule_patterns: Dict[str, Pattern] = {}
		
		# Load default style guides
		self._load_default_style_guides()
		
		# Compliance configuration
		self.compliance_config = {
			"max_violations_per_rule": 50,
			"context_snippet_length": 100,
			"confidence_threshold": 0.7,
			"brand_voice_weight": 0.3,
			"grammar_weight": 0.25,
			"tone_weight": 0.2,
			"format_weight": 0.25
		}
		
		# Validation functions
		self.validation_functions = {
			"sentence_length_check": self._validate_sentence_length,
			"passive_voice_check": self._validate_passive_voice,
			"readability_check": self._validate_readability,
			"brand_voice_check": self._validate_brand_voice,
			"tone_consistency_check": self._validate_tone_consistency,
			"technical_accuracy_check": self._validate_technical_accuracy
		}
		
		# Compliance statistics
		self.compliance_checks = 0
		self.total_violations_found = 0
		self.average_compliance_score = 0.0
		
		self._log_initialization()
	
	def _load_default_style_guides(self):
		"""Load default style guides for common organizations"""
		
		# Corporate style guide
		corporate_rules = [
			StyleGuideRule(
				rule_name="Professional Tone",
				category=RuleCategory.TONE,
				description="Use professional, respectful language",
				forbidden_words=["awesome", "cool", "stuff", "things"],
				severity=ViolationSeverity.MEDIUM,
				correction_suggestion="Use more professional alternatives",
				examples=[
					{"before": "This stuff is awesome", "after": "This solution is excellent"}
				]
			),
			StyleGuideRule(
				rule_name="Active Voice Preference",
				category=RuleCategory.GRAMMAR,
				description="Prefer active voice over passive voice",
				pattern=r"\b(?:was|were|is|are|am|been|being)\s+\w+(?:ed|en)\b",
				validation_function="passive_voice_check",
				severity=ViolationSeverity.LOW,
				correction_suggestion="Convert to active voice where possible"
			),
			StyleGuideRule(
				rule_name="Sentence Length Limit",
				category=RuleCategory.FORMAT,
				description="Keep sentences under 25 words for readability",
				validation_function="sentence_length_check",
				threshold_value=25,
				severity=ViolationSeverity.MEDIUM,
				correction_suggestion="Break long sentences into shorter ones"
			),
			StyleGuideRule(
				rule_name="Brand Voice Consistency",
				category=RuleCategory.BRAND_VOICE,
				description="Maintain consistency with established brand voice",
				validation_function="brand_voice_check",
				severity=ViolationSeverity.HIGH,
				correction_suggestion="Align language with brand voice guidelines"
			),
		]
		
		# Academic style guide
		academic_rules = [
			StyleGuideRule(
				rule_name="Formal Language",
				category=RuleCategory.TONE,
				description="Use formal academic language",
				forbidden_words=["can't", "won't", "don't", "isn't", "aren't"],
				severity=ViolationSeverity.HIGH,
				correction_suggestion="Use formal alternatives (cannot, will not, etc.)"
			),
			StyleGuideRule(
				rule_name="Third Person Voice",
				category=RuleCategory.GRAMMAR,
				description="Use third person perspective in academic writing",
				pattern=r"\b(?:I|we|you|my|our|your)\b",
				severity=ViolationSeverity.MEDIUM,
				correction_suggestion="Rewrite in third person"
			),
			StyleGuideRule(
				rule_name="Citation Required",
				category=RuleCategory.TECHNICAL,
				description="Claims should be supported with citations",
				pattern=r"\b(?:studies show|research indicates|according to)\b(?![^.]*\([^)]+\))",
				severity=ViolationSeverity.HIGH,
				correction_suggestion="Add appropriate citations"
			)
		]
		
		# Marketing style guide
		marketing_rules = [
			StyleGuideRule(
				rule_name="Engaging Language",
				category=RuleCategory.TONE,
				description="Use engaging, persuasive language",
				required_words=["you", "your", "discover", "transform", "achieve"],
				severity=ViolationSeverity.LOW,
				correction_suggestion="Add more engaging, audience-focused language"
			),
			StyleGuideRule(
				rule_name="Call-to-Action Present",
				category=RuleCategory.FORMAT,
				description="Marketing content should include clear call-to-action",
				pattern=r"\b(?:contact|call|visit|download|subscribe|register|sign up)\b",
				severity=ViolationSeverity.MEDIUM,
				correction_suggestion="Add clear call-to-action"
			),
			StyleGuideRule(
				rule_name="Benefit-Focused",
				category=RuleCategory.VOCABULARY,
				description="Focus on customer benefits rather than features",
				required_words=["benefit", "advantage", "value", "results", "success"],
				severity=ViolationSeverity.LOW,
				correction_suggestion="Emphasize customer benefits and outcomes"
			)
		]
		
		# Store style guides
		self.style_guides = {
			"corporate": {
				"name": "Corporate Style Guide",
				"description": "Professional corporate communication standards",
				"rules": corporate_rules
			},
			"academic": {
				"name": "Academic Writing Style Guide", 
				"description": "Formal academic writing standards",
				"rules": academic_rules
			},
			"marketing": {
				"name": "Marketing Content Style Guide",
				"description": "Engaging marketing communication standards",
				"rules": marketing_rules
			}
		}
		
		# Compile regex patterns
		self._compile_rule_patterns()
	
	def _compile_rule_patterns(self):
		"""Compile regex patterns for efficient matching"""
		
		for guide_name, guide in self.style_guides.items():
			for rule in guide["rules"]:
				if rule.pattern:
					try:
						self.rule_patterns[rule.rule_id] = re.compile(rule.pattern, re.IGNORECASE)
					except re.error as e:
						self._log_pattern_error(f"Invalid pattern in rule {rule.rule_name}: {str(e)}")
	
	async def check_compliance(self, request: ComplianceRequest) -> ComplianceResult:
		"""
		Perform comprehensive style guide compliance check
		
		Args:
			request: Compliance checking request with content and configuration
			
		Returns:
			Detailed compliance result with violations and recommendations
		"""
		start_time = datetime.now()
		
		try:
			self._log_compliance_start(request.request_id, request.style_guide_name)
			
			# Get style guide rules
			rules = self._get_applicable_rules(request)
			
			# Perform compliance checking
			violations = []
			for rule in rules:
				rule_violations = await self._check_rule_compliance(request.text_content, rule)
				violations.extend(rule_violations)
			
			# Filter by severity threshold
			filtered_violations = [
				v for v in violations 
				if self._severity_rank(v.severity) >= self._severity_rank(request.severity_threshold)
			]
			
			# Calculate compliance metrics
			compliance_metrics = self._calculate_compliance_metrics(
				filtered_violations, rules, len(request.text_content)
			)
			
			# Analyze compliance by category
			category_compliance = self._analyze_category_compliance(filtered_violations, rules)
			
			# Check brand voice alignment if voice profile provided
			brand_voice_alignment = 0.5  # Default neutral
			if request.voice_profile:
				brand_voice_alignment = await self._check_brand_voice_alignment(
					request.text_content, request.voice_profile
				)
			
			# Generate recommendations
			priority_fixes, quick_fixes, strategic_improvements = self._generate_compliance_recommendations(
				filtered_violations, category_compliance
			)
			
			# Identify compliance trends and insights
			compliance_trends = self._analyze_compliance_trends(filtered_violations)
			best_practices = self._identify_best_practices(request.text_content, rules)
			excellence_areas = self._identify_excellence_areas(category_compliance)
			
			# Calculate quality assurance metrics
			analysis_confidence = self._calculate_analysis_confidence(
				len(request.text_content), len(rules), len(filtered_violations)
			)
			coverage_completeness = len([r for r in rules if r.is_active]) / len(rules)
			
			# Create result
			result = ComplianceResult(
				request_id=request.request_id,
				overall_compliance_score=compliance_metrics["overall_score"],
				total_violations=len(filtered_violations),
				violations_by_severity=compliance_metrics["by_severity"],
				violations_by_category=compliance_metrics["by_category"],
				violations=filtered_violations,
				critical_violations=[v for v in filtered_violations if v.severity == ViolationSeverity.CRITICAL],
				category_compliance=category_compliance,
				rule_compliance={r.rule_id: len([v for v in filtered_violations if v.rule_id == r.rule_id]) == 0 for r in rules},
				brand_voice_alignment=brand_voice_alignment,
				priority_fixes=priority_fixes,
				quick_fixes=quick_fixes,
				strategic_improvements=strategic_improvements,
				compliance_trends=compliance_trends,
				best_practices_followed=best_practices,
				areas_of_excellence=excellence_areas,
				analysis_confidence=analysis_confidence,
				rules_checked=len(rules),
				coverage_completeness=coverage_completeness,
				style_guide_used=request.style_guide_name,
				analysis_duration_seconds=(datetime.now() - start_time).total_seconds()
			)
			
			# Update statistics
			self.compliance_checks += 1
			self.total_violations_found += len(filtered_violations)
			self._update_average_compliance_score(compliance_metrics["overall_score"])
			
			self._log_compliance_complete(
				request.request_id, compliance_metrics["overall_score"], 
				len(filtered_violations), result.analysis_duration_seconds
			)
			
			return result
			
		except Exception as e:
			self._log_compliance_error(f"Compliance check failed for {request.request_id}: {str(e)}")
			raise
	
	def _get_applicable_rules(self, request: ComplianceRequest) -> List[StyleGuideRule]:
		"""Get rules applicable to the compliance request"""
		
		rules = []
		
		# Get base style guide rules
		if request.style_guide_name in self.style_guides:
			style_guide = self.style_guides[request.style_guide_name]
			base_rules = style_guide["rules"]
			
			# Filter by category if specified
			if request.rule_categories:
				base_rules = [r for r in base_rules if r.category in request.rule_categories]
			
			# Filter by content type
			base_rules = [r for r in base_rules 
			             if "all" in r.applies_to or request.content_type in r.applies_to]
			
			# Filter by active status
			base_rules = [r for r in base_rules if r.is_active]
			
			rules.extend(base_rules)
		
		# Add custom rules
		custom_rules = [r for r in request.custom_rules 
		               if r.is_active and ("all" in r.applies_to or request.content_type in r.applies_to)]
		
		if request.rule_categories:
			custom_rules = [r for r in custom_rules if r.category in request.rule_categories]
		
		rules.extend(custom_rules)
		
		return rules
	
	async def _check_rule_compliance(self, text: str, rule: StyleGuideRule) -> List[ComplianceViolation]:
		"""Check compliance for a specific rule"""
		
		violations = []
		
		try:
			# Use custom validation function if specified
			if rule.validation_function and rule.validation_function in self.validation_functions:
				validator = self.validation_functions[rule.validation_function]
				rule_violations = await validator(text, rule)
				violations.extend(rule_violations)
			
			# Pattern-based checking
			elif rule.pattern and rule.rule_id in self.rule_patterns:
				pattern = self.rule_patterns[rule.rule_id]
				matches = pattern.finditer(text)
				
				for match in matches:
					if len(violations) >= self.compliance_config["max_violations_per_rule"]:
						break
					
					violation = ComplianceViolation(
						rule_id=rule.rule_id,
						rule_name=rule.rule_name,
						text_position=match.start(),
						text_length=match.end() - match.start(),
						context_snippet=self._get_context_snippet(text, match.start(), match.end()),
						violation_description=f"Text matches pattern: {rule.description}",
						violating_text=match.group(),
						severity=rule.severity,
						suggested_correction=rule.correction_suggestion,
						confidence_score=0.8,
						impact_on_brand=self._assess_brand_impact(rule),
						impact_on_readability=self._assess_readability_impact(rule),
						fix_difficulty=self._assess_fix_difficulty(rule)
					)
					violations.append(violation)
			
			# Keyword-based checking
			elif rule.keywords or rule.forbidden_words or rule.required_words:
				keyword_violations = await self._check_keyword_compliance(text, rule)
				violations.extend(keyword_violations)
			
		except Exception as e:
			self._log_rule_error(f"Error checking rule {rule.rule_name}: {str(e)}")
		
		return violations
	
	async def _check_keyword_compliance(self, text: str, rule: StyleGuideRule) -> List[ComplianceViolation]:
		"""Check compliance for keyword-based rules"""
		
		violations = []
		words = text.lower().split()
		
		# Check forbidden words
		for forbidden_word in rule.forbidden_words:
			if forbidden_word.lower() in words:
				# Find all occurrences
				text_lower = text.lower()
				start = 0
				while True:
					pos = text_lower.find(forbidden_word.lower(), start)
					if pos == -1:
						break
					
					if len(violations) >= self.compliance_config["max_violations_per_rule"]:
						break
					
					violation = ComplianceViolation(
						rule_id=rule.rule_id,
						rule_name=rule.rule_name,
						text_position=pos,
						text_length=len(forbidden_word),
						context_snippet=self._get_context_snippet(text, pos, pos + len(forbidden_word)),
						violation_description=f"Use of forbidden word: {forbidden_word}",
						violating_text=forbidden_word,
						severity=rule.severity,
						suggested_correction=rule.correction_suggestion,
						confidence_score=0.9,
						impact_on_brand=self._assess_brand_impact(rule),
						impact_on_readability=self._assess_readability_impact(rule),
						fix_difficulty="easy"
					)
					violations.append(violation)
					start = pos + 1
		
		# Check required words (if text lacks required words)
		if rule.required_words:
			missing_words = [word for word in rule.required_words if word.lower() not in text.lower()]
			
			if missing_words:
				violation = ComplianceViolation(
					rule_id=rule.rule_id,
					rule_name=rule.rule_name,
					text_position=0,
					text_length=0,
					context_snippet=text[:100] + "..." if len(text) > 100 else text,
					violation_description=f"Missing required words: {', '.join(missing_words)}",
					violating_text="[missing content]",
					severity=rule.severity,
					suggested_correction=f"Include these required words: {', '.join(missing_words)}",
					confidence_score=0.8,
					impact_on_brand=self._assess_brand_impact(rule),
					impact_on_readability=self._assess_readability_impact(rule),
					fix_difficulty="medium"
				)
				violations.append(violation)
		
		return violations
	
	def _get_context_snippet(self, text: str, start: int, end: int) -> str:
		"""Get context snippet around a violation"""
		
		snippet_length = self.compliance_config["context_snippet_length"]
		
		# Expand context around the violation
		context_start = max(0, start - snippet_length // 2)
		context_end = min(len(text), end + snippet_length // 2)
		
		snippet = text[context_start:context_end]
		
		# Add ellipsis if truncated
		if context_start > 0:
			snippet = "..." + snippet
		if context_end < len(text):
			snippet = snippet + "..."
		
		return snippet
	
	def _assess_brand_impact(self, rule: StyleGuideRule) -> float:
		"""Assess impact of rule violation on brand consistency"""
		
		impact_map = {
			RuleCategory.BRAND_VOICE: 0.9,
			RuleCategory.TONE: 0.7,
			RuleCategory.VOCABULARY: 0.6,
			RuleCategory.FORMAT: 0.4,
			RuleCategory.GRAMMAR: 0.3,
			RuleCategory.PUNCTUATION: 0.2,
			RuleCategory.TECHNICAL: 0.5,
			RuleCategory.ACCESSIBILITY: 0.4
		}
		
		return impact_map.get(rule.category, 0.5)
	
	def _assess_readability_impact(self, rule: StyleGuideRule) -> float:
		"""Assess impact of rule violation on readability"""
		
		impact_map = {
			RuleCategory.GRAMMAR: 0.8,
			RuleCategory.PUNCTUATION: 0.7,
			RuleCategory.FORMAT: 0.6,
			RuleCategory.VOCABULARY: 0.5,
			RuleCategory.TONE: 0.3,
			RuleCategory.BRAND_VOICE: 0.2,
			RuleCategory.TECHNICAL: 0.6,
			RuleCategory.ACCESSIBILITY: 0.9
		}
		
		return impact_map.get(rule.category, 0.5)
	
	def _assess_fix_difficulty(self, rule: StyleGuideRule) -> str:
		"""Assess difficulty of fixing rule violation"""
		
		if rule.category in [RuleCategory.PUNCTUATION, RuleCategory.VOCABULARY]:
			return "easy"
		elif rule.category in [RuleCategory.GRAMMAR, RuleCategory.FORMAT]:
			return "medium"
		elif rule.category in [RuleCategory.TONE, RuleCategory.BRAND_VOICE]:
			return "hard"
		else:
			return "medium"
	
	# Validation functions for custom rules
	
	async def _validate_sentence_length(self, text: str, rule: StyleGuideRule) -> List[ComplianceViolation]:
		"""Validate sentence length compliance"""
		
		violations = []
		sentences = [s.strip() for s in text.split('.') if s.strip()]
		threshold = rule.threshold_value or 25
		
		for i, sentence in enumerate(sentences):
			word_count = len(sentence.split())
			if word_count > threshold:
				# Find sentence position in text
				sentence_start = text.find(sentence)
				if sentence_start != -1:
					violation = ComplianceViolation(
						rule_id=rule.rule_id,
						rule_name=rule.rule_name,
						text_position=sentence_start,
						text_length=len(sentence),
						context_snippet=sentence[:100] + "..." if len(sentence) > 100 else sentence,
						violation_description=f"Sentence too long: {word_count} words (limit: {threshold})",
						violating_text=sentence[:50] + "..." if len(sentence) > 50 else sentence,
						severity=rule.severity,
						suggested_correction="Break into shorter sentences",
						confidence_score=0.9,
						impact_on_brand=0.3,
						impact_on_readability=0.8,
						fix_difficulty="medium"
					)
					violations.append(violation)
		
		return violations
	
	async def _validate_passive_voice(self, text: str, rule: StyleGuideRule) -> List[ComplianceViolation]:
		"""Validate passive voice usage"""
		
		violations = []
		sentences = [s.strip() for s in text.split('.') if s.strip()]
		
		# Simple passive voice detection
		passive_pattern = re.compile(r'\b(?:was|were|is|are|am|been|being)\s+\w+(?:ed|en)\b', re.IGNORECASE)
		
		for sentence in sentences:
			matches = passive_pattern.finditer(sentence)
			for match in matches:
				# Find position in full text
				sentence_start = text.find(sentence)
				if sentence_start != -1:
					violation_pos = sentence_start + match.start()
					
					violation = ComplianceViolation(
						rule_id=rule.rule_id,
						rule_name=rule.rule_name,
						text_position=violation_pos,
						text_length=match.end() - match.start(),
						context_snippet=self._get_context_snippet(text, violation_pos, violation_pos + match.end() - match.start()),
						violation_description="Passive voice detected",
						violating_text=match.group(),
						severity=rule.severity,
						suggested_correction="Consider using active voice",
						confidence_score=0.7,
						impact_on_brand=0.4,
						impact_on_readability=0.6,
						fix_difficulty="medium"
					)
					violations.append(violation)
		
		return violations
	
	async def _validate_readability(self, text: str, rule: StyleGuideRule) -> List[ComplianceViolation]:
		"""Validate readability compliance"""
		
		violations = []
		
		# Simple readability check based on sentence and word length
		sentences = [s.strip() for s in text.split('.') if s.strip()]
		words = text.split()
		
		if not sentences or not words:
			return violations
		
		avg_sentence_length = len(words) / len(sentences)
		avg_word_length = sum(len(word) for word in words) / len(words)
		
		# Check if readability is too complex
		if avg_sentence_length > 20 or avg_word_length > 6:
			violation = ComplianceViolation(
				rule_id=rule.rule_id,
				rule_name=rule.rule_name,
				text_position=0,
				text_length=len(text),
				context_snippet=text[:100] + "..." if len(text) > 100 else text,
				violation_description=f"Low readability: avg sentence length {avg_sentence_length:.1f}, avg word length {avg_word_length:.1f}",
				violating_text="[entire text]",
				severity=rule.severity,
				suggested_correction="Simplify language and shorten sentences",
				confidence_score=0.8,
				impact_on_brand=0.3,
				impact_on_readability=0.9,
				fix_difficulty="hard"
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_brand_voice(self, text: str, rule: StyleGuideRule) -> List[ComplianceViolation]:
		"""Validate brand voice consistency"""
		
		violations = []
		
		# This is a simplified brand voice check
		# In production, this would integrate with the VoiceFingerprint
		
		# Check for brand-inconsistent language patterns
		informal_words = ['awesome', 'cool', 'stuff', 'things', 'gonna', 'wanna']
		overly_technical = ['utilize', 'implement', 'leverage', 'facilitate']
		
		text_lower = text.lower()
		words = text_lower.split()
		
		# Check for informal language in formal brand context
		informal_count = sum(1 for word in words if word in informal_words)
		if informal_count > 0:
			violation = ComplianceViolation(
				rule_id=rule.rule_id,
				rule_name=rule.rule_name,
				text_position=0,
				text_length=len(text),
				context_snippet=text[:100] + "..." if len(text) > 100 else text,
				violation_description=f"Brand voice inconsistency: {informal_count} informal words detected",
				violating_text=", ".join([w for w in words if w in informal_words]),
				severity=rule.severity,
				suggested_correction="Replace informal language with brand-appropriate alternatives",
				confidence_score=0.6,
				impact_on_brand=0.9,
				impact_on_readability=0.3,
				fix_difficulty="medium"
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_tone_consistency(self, text: str, rule: StyleGuideRule) -> List[ComplianceViolation]:
		"""Validate tone consistency"""
		
		violations = []
		
		# Analyze tone indicators
		positive_words = ['excellent', 'outstanding', 'great', 'wonderful', 'amazing']
		negative_words = ['terrible', 'awful', 'horrible', 'bad', 'poor']
		
		words = text.lower().split()
		positive_count = sum(1 for word in words if word in positive_words)
		negative_count = sum(1 for word in words if word in negative_words)
		
		# Check for tone inconsistency (mixed strong positive/negative)
		if positive_count > 0 and negative_count > 0:
			violation = ComplianceViolation(
				rule_id=rule.rule_id,
				rule_name=rule.rule_name,
				text_position=0,
				text_length=len(text),
				context_snippet=text[:100] + "..." if len(text) > 100 else text,
				violation_description="Mixed tone indicators detected",
				violating_text="[tone inconsistency]",
				severity=rule.severity,
				suggested_correction="Maintain consistent tone throughout",
				confidence_score=0.5,
				impact_on_brand=0.7,
				impact_on_readability=0.4,
				fix_difficulty="hard"
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_technical_accuracy(self, text: str, rule: StyleGuideRule) -> List[ComplianceViolation]:
		"""Validate technical accuracy and terminology"""
		
		violations = []
		
		# Check for common technical writing issues
		issues = [
			("data is", "data are", "Data is plural"),
			("criteria is", "criteria are", "Criteria is plural"),
			("phenomena is", "phenomena are", "Phenomena is plural")
		]
		
		text_lower = text.lower()
		
		for incorrect, correct, description in issues:
			if incorrect in text_lower:
				pos = text_lower.find(incorrect)
				violation = ComplianceViolation(
					rule_id=rule.rule_id,
					rule_name=rule.rule_name,
					text_position=pos,
					text_length=len(incorrect),
					context_snippet=self._get_context_snippet(text, pos, pos + len(incorrect)),
					violation_description=description,
					violating_text=incorrect,
					severity=rule.severity,
					suggested_correction=f"Use '{correct}' instead of '{incorrect}'",
					confidence_score=0.9,
					impact_on_brand=0.5,
					impact_on_readability=0.6,
					fix_difficulty="easy"
				)
				violations.append(violation)
		
		return violations
	
	async def _check_brand_voice_alignment(self, text: str, voice_profile: VoiceFingerprint) -> float:
		"""Check alignment with brand voice profile"""
		
		# Simple alignment check based on vocabulary overlap
		text_words = set(text.lower().split())
		profile_vocab = set(voice_profile.vocabulary_signature.keys())
		
		if not text_words:
			return 0.5
		
		overlap = len(text_words.intersection(profile_vocab))
		alignment_score = overlap / len(text_words)
		
		# Normalize to 0-1 range
		return min(alignment_score * 2, 1.0)  # Scale up for display
	
	def _calculate_compliance_metrics(self, violations: List[ComplianceViolation], 
	                                 rules: List[StyleGuideRule], 
	                                 text_length: int) -> Dict[str, Any]:
		"""Calculate overall compliance metrics"""
		
		# Overall compliance score
		if not rules:
			overall_score = 1.0
		else:
			# Weight violations by severity
			severity_weights = {
				ViolationSeverity.CRITICAL: 1.0,
				ViolationSeverity.HIGH: 0.8,
				ViolationSeverity.MEDIUM: 0.6,
				ViolationSeverity.LOW: 0.4,
				ViolationSeverity.INFORMATIONAL: 0.2
			}
			
			total_penalty = sum(severity_weights.get(v.severity, 0.5) for v in violations)
			max_possible_penalty = len(rules)  # Assume one violation per rule max
			
			overall_score = max(0, 1 - (total_penalty / max_possible_penalty))
		
		# Count by severity
		by_severity = {}
		for severity in ViolationSeverity:
			by_severity[severity.value] = len([v for v in violations if v.severity == severity])
		
		# Count by category
		by_category = {}
		for category in RuleCategory:
			category_violations = [v for v in violations 
			                      if any(r.rule_id == v.rule_id and r.category == category for r in rules)]
			by_category[category.value] = len(category_violations)
		
		return {
			"overall_score": overall_score,
			"by_severity": by_severity,
			"by_category": by_category
		}
	
	def _analyze_category_compliance(self, violations: List[ComplianceViolation], 
	                                rules: List[StyleGuideRule]) -> Dict[str, float]:
		"""Analyze compliance by rule category"""
		
		category_compliance = {}
		
		for category in RuleCategory:
			category_rules = [r for r in rules if r.category == category]
			category_violations = [v for v in violations 
			                      if any(r.rule_id == v.rule_id and r.category == category for r in category_rules)]
			
			if category_rules:
				compliance_score = max(0, 1 - (len(category_violations) / len(category_rules)))
			else:
				compliance_score = 1.0
			
			category_compliance[category.value] = compliance_score
		
		return category_compliance
	
	def _generate_compliance_recommendations(self, violations: List[ComplianceViolation], 
	                                        category_compliance: Dict[str, float]) -> Tuple[List[str], List[str], List[str]]:
		"""Generate compliance improvement recommendations"""
		
		priority_fixes = []
		quick_fixes = []
		strategic_improvements = []
		
		# Priority fixes based on critical and high severity violations
		critical_violations = [v for v in violations if v.severity in [ViolationSeverity.CRITICAL, ViolationSeverity.HIGH]]
		
		for violation in critical_violations[:5]:  # Top 5 priority fixes
			priority_fixes.append(f"Fix {violation.rule_name}: {violation.suggested_correction}")
		
		# Quick fixes for easy violations
		easy_violations = [v for v in violations if v.fix_difficulty == "easy"]
		
		for violation in easy_violations[:5]:  # Top 5 quick fixes
			quick_fixes.append(f"{violation.rule_name}: {violation.suggested_correction}")
		
		# Strategic improvements based on category performance
		low_compliance_categories = [cat for cat, score in category_compliance.items() if score < 0.6]
		
		for category in low_compliance_categories:
			strategic_improvements.append(f"Improve {category.replace('_', ' ')} compliance across all content")
		
		# Add general strategic recommendations
		if len(violations) > 10:
			strategic_improvements.append("Implement comprehensive style guide training")
		
		strategic_improvements.append("Establish regular compliance review process")
		strategic_improvements.append("Create style guide reference materials")
		
		return priority_fixes, quick_fixes[:4], strategic_improvements[:4]
	
	def _analyze_compliance_trends(self, violations: List[ComplianceViolation]) -> Dict[str, Any]:
		"""Analyze trends in compliance violations"""
		
		trends = {
			"most_common_violation": "None",
			"most_problematic_category": "None",
			"severity_distribution": {},
			"fix_difficulty_distribution": {}
		}
		
		if violations:
			# Most common violation
			violation_counts = Counter(v.rule_name for v in violations)
			trends["most_common_violation"] = violation_counts.most_common(1)[0][0]
			
			# Most problematic category
			category_counts = Counter(v.rule_name for v in violations)  # Simplified
			trends["most_problematic_category"] = "grammar"  # Simplified
			
			# Severity distribution
			severity_counts = Counter(v.severity.value for v in violations)
			trends["severity_distribution"] = dict(severity_counts)
			
			# Fix difficulty distribution
			difficulty_counts = Counter(v.fix_difficulty for v in violations)
			trends["fix_difficulty_distribution"] = dict(difficulty_counts)
		
		return trends
	
	def _identify_best_practices(self, text: str, rules: List[StyleGuideRule]) -> List[str]:
		"""Identify style guide best practices being followed"""
		
		best_practices = []
		
		# Check for good practices
		sentences = [s.strip() for s in text.split('.') if s.strip()]
		words = text.split()
		
		# Good sentence length variety
		if sentences:
			lengths = [len(sentence.split()) for sentence in sentences]
			if len(set(lengths)) > len(lengths) * 0.5:  # Good variety
				best_practices.append("Good sentence length variety")
		
		# Professional vocabulary usage
		professional_words = ['professional', 'expertise', 'comprehensive', 'strategic', 'innovative']
		if any(word in text.lower() for word in professional_words):
			best_practices.append("Use of professional vocabulary")
		
		# Proper structure indicators
		if any(word in text.lower() for word in ['furthermore', 'however', 'therefore', 'additionally']):
			best_practices.append("Good use of transition words")
		
		# Active voice preference
		passive_indicators = len(re.findall(r'\b(?:was|were|is|are|am|been|being)\s+\w+(?:ed|en)\b', text, re.IGNORECASE))
		if passive_indicators / len(sentences) < 0.3:  # Less than 30% passive
			best_practices.append("Good use of active voice")
		
		return best_practices[:4]
	
	def _identify_excellence_areas(self, category_compliance: Dict[str, float]) -> List[str]:
		"""Identify areas of compliance excellence"""
		
		excellence_areas = []
		
		for category, score in category_compliance.items():
			if score >= 0.9:
				excellence_areas.append(f"Excellent {category.replace('_', ' ')} compliance")
			elif score >= 0.8:
				excellence_areas.append(f"Good {category.replace('_', ' ')} compliance")
		
		return excellence_areas
	
	def _severity_rank(self, severity: ViolationSeverity) -> int:
		"""Get numeric rank for severity level"""
		severity_ranks = {
			ViolationSeverity.INFORMATIONAL: 1,
			ViolationSeverity.LOW: 2,
			ViolationSeverity.MEDIUM: 3,
			ViolationSeverity.HIGH: 4,
			ViolationSeverity.CRITICAL: 5
		}
		return severity_ranks.get(severity, 1)
	
	def _calculate_analysis_confidence(self, text_length: int, rule_count: int, violation_count: int) -> float:
		"""Calculate confidence in compliance analysis"""
		
		confidence_factors = []
		
		# Text length factor
		text_factor = min(text_length / 1000, 1.0)  # 1000+ chars = full confidence
		confidence_factors.append(text_factor)
		
		# Rule coverage factor
		rule_factor = min(rule_count / 10, 1.0)  # 10+ rules = full confidence
		confidence_factors.append(rule_factor)
		
		# Pattern detection confidence
		if violation_count > 0:
			detection_confidence = 0.8  # Found violations = good detection
		else:
			detection_confidence = 0.6  # No violations = uncertain
		confidence_factors.append(detection_confidence)
		
		return statistics.mean(confidence_factors)
	
	def _update_average_compliance_score(self, score: float):
		"""Update running average compliance score"""
		total_score = self.average_compliance_score * (self.compliance_checks - 1) + score
		self.average_compliance_score = total_score / self.compliance_checks
	
	def add_custom_rule(self, rule: StyleGuideRule) -> bool:
		"""Add a custom style guide rule"""
		
		try:
			self.custom_rules[rule.rule_id] = rule
			
			# Compile pattern if present
			if rule.pattern:
				self.rule_patterns[rule.rule_id] = re.compile(rule.pattern, re.IGNORECASE)
			
			self._log_rule_added(rule.rule_name)
			return True
			
		except Exception as e:
			self._log_rule_error(f"Failed to add rule {rule.rule_name}: {str(e)}")
			return False
	
	def get_style_guide_info(self, guide_name: str) -> Optional[Dict[str, Any]]:
		"""Get information about a specific style guide"""
		
		if guide_name in self.style_guides:
			guide = self.style_guides[guide_name]
			return {
				"name": guide["name"],
				"description": guide["description"],
				"rule_count": len(guide["rules"]),
				"categories": list(set(rule.category.value for rule in guide["rules"])),
				"active_rules": len([r for r in guide["rules"] if r.is_active])
			}
		
		return None
	
	def get_compliance_statistics(self) -> Dict[str, Any]:
		"""Get compliance checking statistics"""
		
		return {
			"total_compliance_checks": self.compliance_checks,
			"total_violations_found": self.total_violations_found,
			"average_compliance_score": self.average_compliance_score,
			"average_violations_per_check": self.total_violations_found / max(self.compliance_checks, 1),
			"style_guides_available": len(self.style_guides),
			"custom_rules_count": len(self.custom_rules),
			"validation_functions": len(self.validation_functions),
			"rule_categories_supported": len(RuleCategory),
			"violation_severities": len(ViolationSeverity)
		}
	
	# Logging methods
	
	def _log_initialization(self):
		guide_count = len(self.style_guides)
		rule_count = sum(len(guide["rules"]) for guide in self.style_guides.values())
		print(f"StyleGuideCompliance: Initialized with {guide_count} style guides and {rule_count} rules")
	
	def _log_compliance_start(self, request_id: str, style_guide: str):
		print(f"StyleGuideCompliance: Starting compliance check [{request_id}] using '{style_guide}' guide")
	
	def _log_compliance_complete(self, request_id: str, compliance_score: float, violations: int, duration: float):
		print(f"StyleGuideCompliance: Check complete [{request_id}] (score: {compliance_score:.3f}, {violations} violations, {duration:.2f}s)")
	
	def _log_pattern_error(self, message: str):
		print(f"StyleGuideCompliance Pattern Error: {message}")
	
	def _log_rule_error(self, message: str):
		print(f"StyleGuideCompliance Rule Error: {message}")
	
	def _log_rule_added(self, rule_name: str):
		print(f"StyleGuideCompliance: Added custom rule '{rule_name}'")
	
	def _log_compliance_error(self, message: str):
		print(f"StyleGuideCompliance Error: {message}")


# Example usage and testing
async def create_sample_compliance_check():
	"""Create sample style guide compliance check for testing"""
	
	# Initialize compliance checker
	compliance_checker = StyleGuideCompliance()
	
	# Sample text with various compliance issues
	sample_text = """
	This stuff is really awesome and will help you improve your business processes. 
	We're gonna make sure that your organization achieves great results. The solution 
	that was developed by our team is being implemented across multiple departments.
	
	Our methodology leverages cutting-edge technologies and innovative approaches that 
	facilitate optimal outcomes. The comprehensive framework that is utilized by our 
	experts enables organizations to transform their operations effectively and efficiently.
	"""
	
	# Create compliance request
	request = ComplianceRequest(
		text_content=sample_text,
		content_type="business_proposal",
		content_context="Marketing content for corporate clients",
		style_guide_name="corporate",
		rule_categories=[RuleCategory.TONE, RuleCategory.GRAMMAR, RuleCategory.VOCABULARY],
		severity_threshold=ViolationSeverity.LOW,
		include_suggestions=True,
		detailed_analysis=True
	)
	
	# Perform compliance check
	result = await compliance_checker.check_compliance(request)
	
	return {
		"compliance_checker": compliance_checker,
		"request": request,
		"result": result,
		"sample_text": sample_text,
		"stats": compliance_checker.get_compliance_statistics()
	}


if __name__ == "__main__":
	# Test the style guide compliance system
	import asyncio
	
	async def main():
		sample = await create_sample_compliance_check()
		
		print("Style Guide Compliance Results:")
		print("=" * 60)
		
		result = sample["result"]
		
		print(f"📝 Text Length: {len(sample['sample_text'])} characters")
		print(f"📋 Style Guide: {result.style_guide_used}")
		print(f"🔍 Rules Checked: {result.rules_checked}")
		print()
		
		print(f"🎯 Overall Compliance:")
		print(f"  Compliance Score: {result.overall_compliance_score:.3f}")
		print(f"  Total Violations: {result.total_violations}")
		print(f"  Analysis Confidence: {result.analysis_confidence:.3f}")
		print(f"  Brand Voice Alignment: {result.brand_voice_alignment:.3f}")
		print()
		
		print(f"📊 Violations by Severity:")
		for severity, count in result.violations_by_severity.items():
			if count > 0:
				print(f"  {severity.title()}: {count}")
		print()
		
		print(f"📂 Violations by Category:")
		for category, count in result.violations_by_category.items():
			if count > 0:
				print(f"  {category.replace('_', ' ').title()}: {count}")
		print()
		
		print(f"🚨 Critical Violations:")
		for violation in result.critical_violations:
			print(f"  • {violation.rule_name}: {violation.violation_description}")
			print(f"    Fix: {violation.suggested_correction}")
		print()
		
		if result.violations:
			print(f"📝 Sample Violations:")
			for violation in result.violations[:3]:  # Show first 3
				print(f"  • {violation.rule_name} ({violation.severity.value})")
				print(f"    Issue: {violation.violation_description}")
				print(f"    Text: '{violation.violating_text}'")
				print(f"    Fix: {violation.suggested_correction}")
				print()
		
		if result.priority_fixes:
			print(f"🎯 Priority Fixes:")
			for fix in result.priority_fixes:
				print(f"  1. {fix}")
		print()
		
		if result.quick_fixes:
			print(f"⚡ Quick Fixes:")
			for fix in result.quick_fixes:
				print(f"  • {fix}")
		print()
		
		if result.best_practices_followed:
			print(f"✅ Best Practices Followed:")
			for practice in result.best_practices_followed:
				print(f"  • {practice}")
		print()
		
		if result.areas_of_excellence:
			print(f"🌟 Areas of Excellence:")
			for area in result.areas_of_excellence:
				print(f"  • {area}")
		print()
		
		print(f"📈 Category Compliance Scores:")
		for category, score in result.category_compliance.items():
			print(f"  {category.replace('_', ' ').title()}: {score:.3f}")
		print()
		
		print(f"📊 Compliance Trends:")
		trends = result.compliance_trends
		for trend, value in trends.items():
			print(f"  {trend.replace('_', ' ').title()}: {value}")
		print()
		
		print(f"⚙️ System Statistics:")
		stats = sample["stats"]
		for key, value in stats.items():
			print(f"  {key.replace('_', ' ').title()}: {value}")
	
	asyncio.run(main())