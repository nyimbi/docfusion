#!/usr/bin/env python3
"""
Content Optimizer with Ollama Integration

Advanced content optimization for clarity, persuasiveness, and overall effectiveness
with AI-powered improvements and comprehensive quality enhancement.
"""

import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

try:
	import aiohttp
	from aiohttp import ClientTimeout
except ImportError:
	aiohttp = None

from ...core.utils import uuid7str
import time

try:
	from ..prompting_strategies import (
		AdvancedPromptBuilder,
		create_advanced_prompt_builder,
		create_chain_of_thought_prompt,
		filter_thinking_tags,
	)
except ImportError:
    # Fallback if prompting strategies not available
    def create_chain_of_thought_prompt(
        task, context, reasoning_steps, output_format=None, examples=None
    ):
        return f"{task}\n\nContext: {context}\n\nPlease complete this task."

    def filter_thinking_tags(text):
        return text

    def create_advanced_prompt_builder(model_name):
        return None

    AdvancedPromptBuilder = None

class OptimizationType(Enum):
    """Types of content optimizations"""

    CLARITY = "clarity"
    PERSUASIVENESS = "persuasiveness"
    CONCISENESS = "conciseness"
    ENGAGEMENT = "engagement"
    PROFESSIONALISM = "professionalism"
    ACCESSIBILITY = "accessibility"
    IMPACT = "impact"
    FLOW = "flow"
    COMPREHENSIVENESS = "comprehensiveness"

class OptimizationPriority(Enum):
    """Priority levels for optimizations"""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    OPTIONAL = "optional"

class ImprovementArea(Enum):
    """Specific areas for content improvement"""

    SENTENCE_STRUCTURE = "sentence_structure"
    VOCABULARY = "vocabulary"
    TRANSITIONS = "transitions"
    ARGUMENTS = "arguments"
    EVIDENCE = "evidence"
    EXAMPLES = "examples"
    CALL_TO_ACTION = "call_to_action"
    READABILITY = "readability"
    TONE = "tone"
    ORGANIZATION = "organization"

@dataclass
class OptimizationSuggestion:
    """A specific optimization suggestion"""

    id: str = field(default_factory=uuid7str)
    area: ImprovementArea = ImprovementArea.READABILITY
    priority: OptimizationPriority = OptimizationPriority.MEDIUM

    # Suggestion details
    original_text: str = ""
    suggested_text: str = ""
    explanation: str = ""
    reason: str = ""

    # Positioning
    start_position: int = 0
    end_position: int = 0
    sentence_index: int = 0

    # Impact assessment
    impact_score: float = 0.0
    confidence: float = 0.0
    effort_required: str = "medium"  # low, medium, high

@dataclass
class QualityMetrics:
    """Content quality measurements"""

    # Core quality scores
    clarity_score: float = 0.0
    persuasiveness_score: float = 0.0
    engagement_score: float = 0.0
    professionalism_score: float = 0.0
    accessibility_score: float = 0.0
    overall_quality: float = 0.0

    # Detailed metrics
    readability_level: float = 0.0
    sentence_complexity: float = 0.0
    vocabulary_sophistication: float = 0.0
    argument_strength: float = 0.0
    evidence_quality: float = 0.0

    # Structure metrics
    logical_flow: float = 0.0
    transition_quality: float = 0.0
    organization_score: float = 0.0
    coherence: float = 0.0

    # Impact metrics
    call_to_action_strength: float = 0.0
    benefit_emphasis: float = 0.0
    credibility_indicators: float = 0.0

@dataclass
class OptimizedContent:
    """Optimized content result"""

    original_text: str = ""
    optimized_text: str = ""
    optimization_types: List[OptimizationType] = field(default_factory=list)

    # Quality comparison
    original_metrics: QualityMetrics = field(default_factory=QualityMetrics)
    optimized_metrics: QualityMetrics = field(default_factory=QualityMetrics)
    improvement_delta: Dict[str, float] = field(default_factory=dict)

    # Applied changes
    suggestions_applied: List[OptimizationSuggestion] = field(default_factory=list)
    changes_summary: List[str] = field(default_factory=list)

    # Metadata
    word_count_change: int = 0
    readability_improvement: float = 0.0
    overall_improvement: float = 0.0

@dataclass
class ContentOptimizationResult:
    """Complete content optimization result"""

    success: bool = False
    optimization_id: str = field(default_factory=uuid7str)

    # Optimization results
    optimized_content: Optional[OptimizedContent] = None
    suggestions: List[OptimizationSuggestion] = field(default_factory=list)

    # Analysis insights
    quality_assessment: QualityMetrics = field(default_factory=QualityMetrics)
    improvement_opportunities: List[str] = field(default_factory=list)
    priority_actions: List[str] = field(default_factory=list)

    # AI insights
    ai_analysis: Optional[Dict[str, Any]] = None

    # Processing metadata
    processing_time: float = 0.0
    model_calls: int = 0
    tokens_used: int = 0

    # Feedback
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    statistics: Dict[str, Any] = field(default_factory=dict)

class ContentOptimizer:
    """Advanced content optimizer with AI-powered improvements"""

    def __init__(
        self,
        ollama_base_url: str = "http://localhost:11434",
        ollama_model: str = "deepseek-r1:32b",
        ollama_timeout: float = 120.0,
        use_ai_enhancement: bool = True,
        enable_comprehensive_analysis: bool = True,
        optimization_threshold: float = 0.7,
        use_advanced_prompting: bool = True,
    ):
        self.ollama_base_url = ollama_base_url.rstrip("/")
        self.ollama_model = ollama_model
        self.ollama_timeout = ollama_timeout
        self.use_ai_enhancement = use_ai_enhancement
        self.enable_comprehensive_analysis = enable_comprehensive_analysis
        self.optimization_threshold = optimization_threshold
        self.use_advanced_prompting = use_advanced_prompting
        self.logger = logging.getLogger(__name__)

        # Initialize advanced prompting if available
        self.prompt_builder = None
        if self.use_advanced_prompting and AdvancedPromptBuilder:
            try:
                self.prompt_builder = create_advanced_prompt_builder(ollama_model)
            except Exception as e:
                self.logger.warning(f"Could not initialize advanced prompting: {e}")

        # Initialize optimization rules and patterns
        self._initialize_optimization_rules()
        self._initialize_quality_indicators()

        self.logger.info(f"ContentOptimizer initialized with model: {ollama_model}")

    def _initialize_optimization_rules(self):
        """Initialize rule-based optimization patterns"""
        self.optimization_rules = {
            OptimizationType.CLARITY: {
                "patterns": [
                    {
                        "pattern": r"\b(?:in order to|for the purpose of)\b",
                        "replacement": "to",
                        "reason": "Simplify unnecessarily complex phrases",
                        "priority": OptimizationPriority.HIGH,
                    },
                    {
                        "pattern": r"\b(?:due to the fact that|owing to the fact that)\b",
                        "replacement": "because",
                        "reason": "Use simpler causal language",
                        "priority": OptimizationPriority.HIGH,
                    },
                    {
                        "pattern": r"\b(?:at this point in time|at the present time)\b",
                        "replacement": "now",
                        "reason": "Reduce wordiness",
                        "priority": OptimizationPriority.MEDIUM,
                    },
                ],
                "indicators": [
                    "complex_sentences",
                    "passive_voice",
                    "redundant_phrases",
                ],
            },
            OptimizationType.PERSUASIVENESS: {
                "indicators": [
                    "benefit_words",
                    "action_verbs",
                    "evidence_markers",
                    "credibility_signals",
                ],
                "enhancement_words": [
                    "proven",
                    "demonstrated",
                    "validated",
                    "successful",
                    "effective",
                    "results",
                    "benefits",
                    "advantages",
                    "opportunities",
                    "value",
                ],
            },
            OptimizationType.CONCISENESS: {
                "patterns": [
                    {
                        "pattern": r"\b(?:it is important to note that|it should be noted that)\b",
                        "replacement": "",
                        "reason": "Remove unnecessary introductory phrases",
                        "priority": OptimizationPriority.MEDIUM,
                    },
                    {
                        "pattern": r"\b(?:very|really|quite|rather|somewhat)\b",
                        "replacement": "",
                        "reason": "Remove weak intensifiers",
                        "priority": OptimizationPriority.LOW,
                    },
                ],
                "indicators": ["word_count", "redundant_phrases", "weak_modifiers"],
            },
            OptimizationType.ENGAGEMENT: {
                "indicators": [
                    "question_usage",
                    "direct_address",
                    "active_voice",
                    "varied_sentence_structure",
                ],
                "enhancement_techniques": [
                    "add_rhetorical_questions",
                    "use_direct_address",
                    "include_specific_examples",
                    "vary_sentence_length",
                ],
            },
        }

    def _initialize_quality_indicators(self):
        """Initialize quality assessment indicators"""
        self.quality_indicators = {
            "clarity": {
                "positive": [
                    "clear",
                    "specific",
                    "precise",
                    "straightforward",
                    "direct",
                ],
                "negative": ["confusing", "ambiguous", "vague", "unclear", "complex"],
                "structural": ["short_sentences", "active_voice", "simple_vocabulary"],
            },
            "persuasiveness": {
                "positive": [
                    "proven",
                    "effective",
                    "successful",
                    "guaranteed",
                    "demonstrated",
                ],
                "negative": ["might", "maybe", "possibly", "perhaps", "uncertain"],
                "structural": [
                    "benefit_statements",
                    "evidence_presentation",
                    "call_to_action",
                ],
            },
            "professionalism": {
                "positive": [
                    "professional",
                    "expert",
                    "qualified",
                    "experienced",
                    "established",
                ],
                "negative": ["awesome", "cool", "stuff", "things", "guys"],
                "structural": ["formal_tone", "proper_grammar", "business_vocabulary"],
            },
            "engagement": {
                "positive": ["you", "your", "imagine", "consider", "discover"],
                "indicators": [
                    "questions",
                    "direct_address",
                    "active_constructions",
                    "examples",
                ],
            },
        }

    async def optimize_content(
        self,
        text: str,
        optimization_types: List[OptimizationType],
        target_audience: str = "professional",
        apply_suggestions: bool = True,
    ) -> ContentOptimizationResult:
        """Optimize content for specified improvements"""
        start_time = time.monotonic()
        result = ContentOptimizationResult()

        try:
            assert text and text.strip(), "Text content is required"
            assert optimization_types, "At least one optimization type required"

            # Step 1: Analyze current content quality
            result.quality_assessment = await self._assess_content_quality(text)

            # Step 2: Generate optimization suggestions
            result.suggestions = await self._generate_optimization_suggestions(
                text, optimization_types, target_audience
            )

            # Step 3: Apply optimizations if requested
            if apply_suggestions and result.suggestions:
                result.optimized_content = await self._apply_optimizations(
                    text, result.suggestions, optimization_types
                )

                # Step 4: AI enhancement if available
                if self.use_ai_enhancement and aiohttp and result.optimized_content:
                    try:
                        enhanced_result = await self._ai_enhance_optimization(
                            result.optimized_content,
                            optimization_types,
                            target_audience,
                        )
                        if enhanced_result:
                            result.optimized_content = enhanced_result
                            result.model_calls += 1
                    except Exception as e:
                        result.warnings.append(f"AI enhancement failed: {str(e)}")

            # Step 5: Generate improvement opportunities and priority actions
            result.improvement_opportunities = (
                await self._identify_improvement_opportunities(
                    text, result.quality_assessment
                )
            )
            result.priority_actions = await self._generate_priority_actions(
                result.suggestions
            )

            # Step 6: Comprehensive AI analysis if enabled
            if (
                self.enable_comprehensive_analysis
                and self.use_ai_enhancement
                and aiohttp
            ):
                try:
                    result.ai_analysis = await self._comprehensive_ai_analysis(
                        text, optimization_types, target_audience
                    )
                    result.model_calls += 1
                except Exception as e:
                    result.warnings.append(
                        f"Comprehensive AI analysis failed: {str(e)}"
                    )

            # Step 7: Compile statistics
            result.statistics = self._compile_optimization_statistics(result, text)

            result.success = len(result.errors) == 0
            result.processing_time = time.monotonic() - start_time

            self.logger.info(
                f"Content optimization completed: {len(optimization_types)} types, "
                f"{len(result.suggestions)} suggestions"
            )

        except Exception as e:
            result.errors.append(f"Content optimization failed: {str(e)}")
            self.logger.error(f"Content optimization error: {e}")

        return result

    async def _assess_content_quality(self, text: str) -> QualityMetrics:
        """Assess current content quality across multiple dimensions"""
        metrics = QualityMetrics()

        try:
            words = text.split()
            sentences = re.split(r"[.!?]+", text)
            sentences = [s.strip() for s in sentences if s.strip()]
            text_lower = text.lower()

            # Clarity assessment
            clarity_factors = []

            # Average sentence length (shorter = clearer)
            if sentences:
                avg_sentence_length = len(words) / len(sentences)
                if avg_sentence_length <= 15:
                    clarity_factors.append(1.0)
                elif avg_sentence_length <= 20:
                    clarity_factors.append(0.8)
                elif avg_sentence_length <= 25:
                    clarity_factors.append(0.6)
                else:
                    clarity_factors.append(0.4)

            # Passive voice usage (less passive = clearer)
            passive_count = len(
                re.findall(
                    r"\b(?:was|were|is|are|been|being)\s+\w*ed\b", text, re.IGNORECASE
                )
            )
            passive_ratio = passive_count / len(sentences) if sentences else 0
            clarity_factors.append(max(1.0 - passive_ratio, 0.2))

            # Complex word usage
            complex_words = [word for word in words if len(word) > 8]
            complex_ratio = len(complex_words) / len(words) if words else 0
            clarity_factors.append(max(1.0 - complex_ratio * 2, 0.2))

            metrics.clarity_score = (
                sum(clarity_factors) / len(clarity_factors) if clarity_factors else 0.5
            )

            # Persuasiveness assessment
            persuasion_factors = []

            # Benefit-focused language
            benefit_words = sum(
                1
                for word in self.quality_indicators["persuasiveness"]["positive"]
                if word in text_lower
            )
            persuasion_factors.append(
                min(benefit_words / len(words) * 50, 1.0) if words else 0
            )

            # Evidence markers
            evidence_markers = [
                "research shows",
                "studies indicate",
                "proven",
                "demonstrated",
                "results show",
            ]
            evidence_count = sum(
                1 for marker in evidence_markers if marker in text_lower
            )
            persuasion_factors.append(min(evidence_count * 0.3, 1.0))

            # Action language
            action_words = [
                "achieve",
                "deliver",
                "ensure",
                "provide",
                "guarantee",
                "enable",
            ]
            action_count = sum(1 for word in action_words if word in text_lower)
            persuasion_factors.append(
                min(action_count / len(words) * 30, 1.0) if words else 0
            )

            metrics.persuasiveness_score = (
                sum(persuasion_factors) / len(persuasion_factors)
                if persuasion_factors
                else 0.5
            )

            # Engagement assessment
            engagement_factors = []

            # Direct address usage
            direct_address = text_lower.count("you") + text_lower.count("your")
            engagement_factors.append(
                min(direct_address / len(words) * 20, 1.0) if words else 0
            )

            # Question usage
            questions = text.count("?")
            engagement_factors.append(
                min(questions / len(sentences) * 2, 1.0) if sentences else 0
            )

            # Varied sentence structure
            if len(sentences) > 1:
                sentence_lengths = [len(s.split()) for s in sentences]
                length_variance = len(set(sentence_lengths)) / len(sentence_lengths)
                engagement_factors.append(length_variance)
            else:
                engagement_factors.append(0.5)

            metrics.engagement_score = (
                sum(engagement_factors) / len(engagement_factors)
                if engagement_factors
                else 0.5
            )

            # Professionalism assessment
            professionalism_factors = []

            # Professional vocabulary
            professional_words = sum(
                1
                for word in self.quality_indicators["professionalism"]["positive"]
                if word in text_lower
            )
            unprofessional_words = sum(
                1
                for word in self.quality_indicators["professionalism"]["negative"]
                if word in text_lower
            )

            if professional_words + unprofessional_words > 0:
                professionalism_factors.append(
                    professional_words / (professional_words + unprofessional_words)
                )
            else:
                professionalism_factors.append(0.7)  # Neutral

            # Formal tone indicators
            contractions = len(re.findall(r"\b\w+'[a-z]+\b", text))
            contraction_penalty = (
                min(contractions / len(words) * 5, 0.3) if words else 0
            )
            professionalism_factors.append(max(0.8 - contraction_penalty, 0.2))

            metrics.professionalism_score = (
                sum(professionalism_factors) / len(professionalism_factors)
                if professionalism_factors
                else 0.7
            )

            # Accessibility assessment (readability factors)
            accessibility_factors = []

            # Sentence complexity
            accessibility_factors.append(
                metrics.clarity_score
            )  # Reuse clarity assessment

            # Vocabulary difficulty
            avg_word_length = (
                sum(len(word) for word in words) / len(words) if words else 5
            )
            if avg_word_length <= 5:
                accessibility_factors.append(1.0)
            elif avg_word_length <= 6:
                accessibility_factors.append(0.8)
            else:
                accessibility_factors.append(0.6)

            # Structure clarity (paragraph usage approximation)
            paragraph_breaks = text.count("\n\n")
            if len(text) > 500 and paragraph_breaks >= 2:
                accessibility_factors.append(0.9)
            elif len(text) > 200 and paragraph_breaks >= 1:
                accessibility_factors.append(0.8)
            else:
                accessibility_factors.append(0.6)

            metrics.accessibility_score = sum(accessibility_factors) / len(
                accessibility_factors
            )

            # Calculate detailed metrics
            metrics.readability_level = metrics.clarity_score
            metrics.sentence_complexity = (
                1.0 - clarity_factors[0] if clarity_factors else 0.5
            )
            metrics.vocabulary_sophistication = complex_ratio
            metrics.argument_strength = metrics.persuasiveness_score

            # Structural metrics
            metrics.logical_flow = self._assess_logical_flow(sentences)
            metrics.transition_quality = self._assess_transitions(sentences)
            metrics.organization_score = self._assess_organization(text)
            metrics.coherence = (
                metrics.logical_flow
                + metrics.transition_quality
                + metrics.organization_score
            ) / 3

            # Impact metrics
            metrics.call_to_action_strength = self._assess_call_to_action(text)
            metrics.benefit_emphasis = (
                min(benefit_words / len(words) * 40, 1.0) if words else 0
            )
            metrics.credibility_indicators = min(evidence_count * 0.4, 1.0)

            # Overall quality score
            quality_components = [
                metrics.clarity_score,
                metrics.persuasiveness_score,
                metrics.engagement_score,
                metrics.professionalism_score,
                metrics.accessibility_score,
            ]
            metrics.overall_quality = sum(quality_components) / len(quality_components)

        except Exception as e:
            self.logger.warning(f"Quality assessment failed: {e}")
            metrics.overall_quality = 0.5  # Default neutral score

        return metrics

    def _assess_logical_flow(self, sentences: List[str]) -> float:
        """Assess logical flow between sentences"""
        if len(sentences) < 2:
            return 0.8  # Single sentence assumed to have good flow

        flow_score = 0.7  # Base score

        # Check for transition words/phrases
        transition_words = [
            "however",
            "therefore",
            "furthermore",
            "additionally",
            "consequently",
            "moreover",
            "nevertheless",
            "meanwhile",
            "subsequently",
            "thus",
        ]

        transition_count = 0
        for sentence in sentences[1:]:  # Skip first sentence
            sentence_lower = sentence.lower()
            if any(word in sentence_lower for word in transition_words):
                transition_count += 1

        # Bonus for appropriate transition usage
        if transition_count > 0:
            flow_score += min(transition_count / len(sentences) * 2, 0.2)

        # Check for logical progression indicators
        sequence_words = ["first", "second", "third", "next", "finally", "lastly"]
        sequence_count = sum(
            1
            for sentence in sentences
            for word in sequence_words
            if word in sentence.lower()
        )

        if sequence_count > 0:
            flow_score += min(sequence_count * 0.1, 0.1)

        return min(flow_score, 1.0)

    def _assess_transitions(self, sentences: List[str]) -> float:
        """Assess quality of transitions between sentences"""
        if len(sentences) < 2:
            return 0.8

        transition_score = 0.6  # Base score

        # High-quality transitions
        quality_transitions = [
            "as a result",
            "in addition",
            "on the other hand",
            "for example",
            "in contrast",
            "similarly",
            "specifically",
            "in particular",
        ]

        # Basic transitions
        basic_transitions = ["and", "but", "so", "then", "also", "however"]

        quality_count = 0
        basic_count = 0

        text_lower = " ".join(sentences).lower()

        for transition in quality_transitions:
            if transition in text_lower:
                quality_count += 1

        for transition in basic_transitions:
            if transition in text_lower:
                basic_count += 1

        # Score based on transition quality
        transition_score += quality_count * 0.1
        transition_score += basic_count * 0.05

        return min(transition_score, 1.0)

    def _assess_organization(self, text: str) -> float:
        """Assess overall text organization"""
        organization_score = 0.6  # Base score

        # Check for clear structure indicators
        structure_indicators = [
            "introduction",
            "conclusion",
            "summary",
            "overview",
            "background",
            "methodology",
            "results",
            "recommendations",
        ]

        text_lower = text.lower()
        structure_count = sum(
            1 for indicator in structure_indicators if indicator in text_lower
        )

        if structure_count > 0:
            organization_score += min(structure_count * 0.1, 0.3)

        # Check for paragraph breaks (approximation)
        paragraph_breaks = text.count("\n\n")
        word_count = len(text.split())

        if word_count > 200:
            expected_breaks = word_count // 200  # Rough guideline
            if paragraph_breaks >= expected_breaks:
                organization_score += 0.1

        # Check for list structures
        if re.search(r"^\d+\.", text, re.MULTILINE) or re.search(
            r"^[•\-\*]\s", text, re.MULTILINE
        ):
            organization_score += 0.1

        return min(organization_score, 1.0)

    def _assess_call_to_action(self, text: str) -> float:
        """Assess strength of call-to-action elements"""
        cta_score = 0.3  # Base score (low because not all content needs CTA)

        # Strong CTA words
        cta_words = [
            "contact",
            "call",
            "email",
            "visit",
            "schedule",
            "request",
            "download",
            "sign up",
            "register",
            "apply",
            "submit",
        ]

        # Action-oriented phrases
        action_phrases = [
            "next steps",
            "get started",
            "take action",
            "move forward",
            "begin today",
            "start now",
            "don't wait",
        ]

        text_lower = text.lower()

        cta_count = sum(1 for word in cta_words if word in text_lower)
        phrase_count = sum(1 for phrase in action_phrases if phrase in text_lower)

        if cta_count > 0:
            cta_score += min(cta_count * 0.2, 0.5)

        if phrase_count > 0:
            cta_score += min(phrase_count * 0.3, 0.4)

        return min(cta_score, 1.0)

    async def _generate_optimization_suggestions(
        self,
        text: str,
        optimization_types: List[OptimizationType],
        target_audience: str,
    ) -> List[OptimizationSuggestion]:
        """Generate specific optimization suggestions"""
        suggestions = []

        try:
            sentences = re.split(r"[.!?]+", text)
            sentences = [s.strip() for s in sentences if s.strip()]

            for optimization_type in optimization_types:
                type_suggestions = await self._generate_type_specific_suggestions(
                    text, sentences, optimization_type, target_audience
                )
                suggestions.extend(type_suggestions)

            # Sort by priority and impact
            suggestions.sort(key=lambda x: (x.priority.value, -x.impact_score))

        except Exception as e:
            self.logger.warning(f"Suggestion generation failed: {e}")

        return suggestions[:20]  # Limit to top 20 suggestions

    async def _generate_type_specific_suggestions(
        self,
        text: str,
        sentences: List[str],
        optimization_type: OptimizationType,
        target_audience: str,
    ) -> List[OptimizationSuggestion]:
        """Generate suggestions for a specific optimization type"""
        suggestions = []

        if optimization_type not in self.optimization_rules:
            return suggestions

        rules = self.optimization_rules[optimization_type]

        # Apply pattern-based suggestions
        if "patterns" in rules:
            for pattern_rule in rules["patterns"]:
                pattern = re.compile(pattern_rule["pattern"], re.IGNORECASE)
                matches = list(pattern.finditer(text))

                for match in matches:
                    suggestion = OptimizationSuggestion()
                    suggestion.area = ImprovementArea.VOCABULARY
                    suggestion.priority = pattern_rule["priority"]
                    suggestion.original_text = match.group()
                    suggestion.suggested_text = pattern_rule["replacement"]
                    suggestion.explanation = pattern_rule["reason"]
                    suggestion.start_position = match.start()
                    suggestion.end_position = match.end()
                    suggestion.impact_score = self._calculate_impact_score(
                        pattern_rule["priority"], optimization_type
                    )
                    suggestion.confidence = 0.8
                    suggestion.effort_required = "low"
                    suggestions.append(suggestion)

        # Generate contextual suggestions based on optimization type
        if optimization_type == OptimizationType.CLARITY:
            suggestions.extend(self._generate_clarity_suggestions(text, sentences))
        elif optimization_type == OptimizationType.PERSUASIVENESS:
            suggestions.extend(
                self._generate_persuasiveness_suggestions(text, sentences)
            )
        elif optimization_type == OptimizationType.ENGAGEMENT:
            suggestions.extend(self._generate_engagement_suggestions(text, sentences))
        elif optimization_type == OptimizationType.CONCISENESS:
            suggestions.extend(self._generate_conciseness_suggestions(text, sentences))

        return suggestions

    def _generate_clarity_suggestions(
        self, text: str, sentences: List[str]
    ) -> List[OptimizationSuggestion]:
        """Generate clarity-specific suggestions"""
        suggestions = []

        # Check for overly long sentences
        for i, sentence in enumerate(sentences):
            word_count = len(sentence.split())
            if word_count > 25:
                suggestion = OptimizationSuggestion()
                suggestion.area = ImprovementArea.SENTENCE_STRUCTURE
                suggestion.priority = OptimizationPriority.HIGH
                suggestion.original_text = sentence
                suggestion.explanation = f"Consider breaking this {word_count}-word sentence into shorter ones"
                suggestion.reason = "Long sentences can be difficult to follow"
                suggestion.sentence_index = i
                suggestion.impact_score = min((word_count - 20) / 20, 1.0)
                suggestion.confidence = 0.9
                suggestion.effort_required = "medium"
                suggestions.append(suggestion)

        # Check for excessive passive voice
        passive_pattern = re.compile(
            r"\b(?:was|were|is|are|been|being)\s+\w*ed\b", re.IGNORECASE
        )
        for i, sentence in enumerate(sentences):
            passive_matches = list(passive_pattern.finditer(sentence))
            if len(passive_matches) > 1:  # Multiple passive constructions
                suggestion = OptimizationSuggestion()
                suggestion.area = ImprovementArea.SENTENCE_STRUCTURE
                suggestion.priority = OptimizationPriority.MEDIUM
                suggestion.original_text = sentence
                suggestion.explanation = (
                    "Consider using active voice for clearer communication"
                )
                suggestion.reason = (
                    "Active voice is generally more direct and easier to understand"
                )
                suggestion.sentence_index = i
                suggestion.impact_score = 0.6
                suggestion.confidence = 0.7
                suggestion.effort_required = "medium"
                suggestions.append(suggestion)

        return suggestions

    def _generate_persuasiveness_suggestions(
        self, text: str, sentences: List[str]
    ) -> List[OptimizationSuggestion]:
        """Generate persuasiveness-specific suggestions"""
        suggestions = []

        text_lower = text.lower()

        # Check for benefit emphasis
        benefit_words = ["benefit", "advantage", "value", "improvement", "success"]
        benefit_count = sum(1 for word in benefit_words if word in text_lower)

        if benefit_count == 0:
            suggestion = OptimizationSuggestion()
            suggestion.area = ImprovementArea.ARGUMENTS
            suggestion.priority = OptimizationPriority.HIGH
            suggestion.explanation = (
                "Add specific benefits or advantages to strengthen persuasiveness"
            )
            suggestion.reason = "Benefit-focused language increases persuasive impact"
            suggestion.impact_score = 0.8
            suggestion.confidence = 0.8
            suggestion.effort_required = "medium"
            suggestions.append(suggestion)

        # Check for evidence/proof
        evidence_indicators = [
            "research",
            "study",
            "data",
            "proven",
            "demonstrated",
            "results",
        ]
        evidence_count = sum(1 for word in evidence_indicators if word in text_lower)

        if evidence_count == 0 and len(sentences) > 3:
            suggestion = OptimizationSuggestion()
            suggestion.area = ImprovementArea.EVIDENCE
            suggestion.priority = OptimizationPriority.MEDIUM
            suggestion.explanation = "Include supporting evidence or proof points"
            suggestion.reason = "Evidence strengthens credibility and persuasiveness"
            suggestion.impact_score = 0.7
            suggestion.confidence = 0.7
            suggestion.effort_required = "high"
            suggestions.append(suggestion)

        # Check for call-to-action
        cta_words = ["contact", "call", "email", "schedule", "request", "apply"]
        cta_count = sum(1 for word in cta_words if word in text_lower)

        if cta_count == 0 and len(text) > 500:
            suggestion = OptimizationSuggestion()
            suggestion.area = ImprovementArea.CALL_TO_ACTION
            suggestion.priority = OptimizationPriority.HIGH
            suggestion.explanation = "Add a clear call-to-action to guide next steps"
            suggestion.reason = "Clear calls-to-action improve response rates"
            suggestion.impact_score = 0.9
            suggestion.confidence = 0.8
            suggestion.effort_required = "low"
            suggestions.append(suggestion)

        return suggestions

    def _generate_engagement_suggestions(
        self, text: str, sentences: List[str]
    ) -> List[OptimizationSuggestion]:
        """Generate engagement-specific suggestions"""
        suggestions = []

        # Check for direct address usage
        you_count = text.lower().count("you")
        word_count = len(text.split())
        you_ratio = you_count / word_count if word_count > 0 else 0

        if you_ratio < 0.01:  # Less than 1% "you" usage
            suggestion = OptimizationSuggestion()
            suggestion.area = ImprovementArea.TONE
            suggestion.priority = OptimizationPriority.MEDIUM
            suggestion.explanation = (
                "Consider using more direct address ('you', 'your') to engage readers"
            )
            suggestion.reason = (
                "Direct address creates personal connection with readers"
            )
            suggestion.impact_score = 0.6
            suggestion.confidence = 0.7
            suggestion.effort_required = "low"
            suggestions.append(suggestion)

        # Check for question usage
        question_count = text.count("?")
        if question_count == 0 and len(sentences) > 5:
            suggestion = OptimizationSuggestion()
            suggestion.area = ImprovementArea.ENGAGEMENT
            suggestion.priority = OptimizationPriority.LOW
            suggestion.explanation = (
                "Consider adding rhetorical questions to engage readers"
            )
            suggestion.reason = "Questions encourage reader participation and thinking"
            suggestion.impact_score = 0.5
            suggestion.confidence = 0.6
            suggestion.effort_required = "low"
            suggestions.append(suggestion)

        return suggestions

    def _generate_conciseness_suggestions(
        self, text: str, sentences: List[str]
    ) -> List[OptimizationSuggestion]:
        """Generate conciseness-specific suggestions"""
        suggestions = []

        # Check for redundant phrases
        redundant_patterns = [
            (r"\b(?:absolutely essential|absolutely necessary)\b", "essential"),
            (r"\b(?:completely finished|totally completed)\b", "finished"),
            (r"\b(?:final outcome|end result)\b", "result"),
            (r"\b(?:future plans|advance planning)\b", "plans"),
        ]

        for pattern, replacement in redundant_patterns:
            matches = list(re.finditer(pattern, text, re.IGNORECASE))
            for match in matches:
                suggestion = OptimizationSuggestion()
                suggestion.area = ImprovementArea.VOCABULARY
                suggestion.priority = OptimizationPriority.MEDIUM
                suggestion.original_text = match.group()
                suggestion.suggested_text = replacement
                suggestion.explanation = "Remove redundant words for conciseness"
                suggestion.reason = "Eliminating redundancy improves clarity and flow"
                suggestion.start_position = match.start()
                suggestion.end_position = match.end()
                suggestion.impact_score = 0.4
                suggestion.confidence = 0.9
                suggestion.effort_required = "low"
                suggestions.append(suggestion)

        return suggestions

    def _calculate_impact_score(
        self, priority: OptimizationPriority, optimization_type: OptimizationType
    ) -> float:
        """Calculate impact score for a suggestion"""
        priority_scores = {
            OptimizationPriority.CRITICAL: 1.0,
            OptimizationPriority.HIGH: 0.8,
            OptimizationPriority.MEDIUM: 0.6,
            OptimizationPriority.LOW: 0.4,
            OptimizationPriority.OPTIONAL: 0.2,
        }

        type_multipliers = {
            OptimizationType.CLARITY: 1.0,
            OptimizationType.PERSUASIVENESS: 0.9,
            OptimizationType.ENGAGEMENT: 0.8,
            OptimizationType.CONCISENESS: 0.7,
            OptimizationType.PROFESSIONALISM: 0.8,
        }

        base_score = priority_scores.get(priority, 0.5)
        type_multiplier = type_multipliers.get(optimization_type, 0.7)

        return base_score * type_multiplier

    async def _apply_optimizations(
        self,
        text: str,
        suggestions: List[OptimizationSuggestion],
        optimization_types: List[OptimizationType],
    ) -> OptimizedContent:
        """Apply optimization suggestions to create optimized content"""
        result = OptimizedContent()
        result.original_text = text
        result.optimization_types = optimization_types

        # Apply suggestions in order of priority and position
        optimized_text = text
        applied_suggestions = []
        changes_summary = []

        # Sort suggestions by position (reverse order to maintain positions)
        position_suggestions = [
            s for s in suggestions if s.suggested_text and s.start_position > 0
        ]
        position_suggestions.sort(key=lambda x: x.start_position, reverse=True)

        # Apply position-based changes
        for suggestion in position_suggestions:
            if suggestion.impact_score >= 0.5:  # Only apply high-impact suggestions
                try:
                    start = suggestion.start_position
                    end = suggestion.end_position

                    # Replace text
                    optimized_text = (
                        optimized_text[:start]
                        + suggestion.suggested_text
                        + optimized_text[end:]
                    )

                    applied_suggestions.append(suggestion)
                    changes_summary.append(
                        f"Replaced '{suggestion.original_text}' with '{suggestion.suggested_text}'"
                    )

                except Exception as e:
                    self.logger.warning(f"Failed to apply suggestion: {e}")

        # Apply general suggestions (non-positional)
        general_suggestions = [
            s for s in suggestions if not s.suggested_text or s.start_position == 0
        ]
        for suggestion in general_suggestions:
            if (
                suggestion.impact_score >= 0.6
            ):  # Higher threshold for general suggestions
                applied_suggestions.append(suggestion)
                changes_summary.append(suggestion.explanation)

        result.optimized_text = optimized_text
        result.suggestions_applied = applied_suggestions
        result.changes_summary = changes_summary
        result.word_count_change = len(optimized_text.split()) - len(text.split())

        # Calculate quality metrics
        result.original_metrics = await self._assess_content_quality(text)
        result.optimized_metrics = await self._assess_content_quality(optimized_text)

        # Calculate improvements
        result.improvement_delta = {
            "clarity": result.optimized_metrics.clarity_score
            - result.original_metrics.clarity_score,
            "persuasiveness": result.optimized_metrics.persuasiveness_score
            - result.original_metrics.persuasiveness_score,
            "engagement": result.optimized_metrics.engagement_score
            - result.original_metrics.engagement_score,
            "professionalism": result.optimized_metrics.professionalism_score
            - result.original_metrics.professionalism_score,
            "accessibility": result.optimized_metrics.accessibility_score
            - result.original_metrics.accessibility_score,
            "overall": result.optimized_metrics.overall_quality
            - result.original_metrics.overall_quality,
        }

        result.overall_improvement = result.improvement_delta["overall"]
        result.readability_improvement = result.improvement_delta["accessibility"]

        return result

    async def _ai_enhance_optimization(
        self,
        optimized_content: OptimizedContent,
        optimization_types: List[OptimizationType],
        target_audience: str,
    ) -> Optional[OptimizedContent]:
        """Use AI to further enhance optimized content"""
        if not aiohttp:
            return None

        try:
            optimization_goals = ", ".join(
                [opt.value.replace("_", " ") for opt in optimization_types]
            )

            prompt = f"""Improve the following text for {optimization_goals}. Target audience: {target_audience}.
Make the text more effective while preserving the original meaning and key information.

Original text:
{optimized_content.optimized_text}

Enhanced version:"""

            timeout = ClientTimeout(total=self.ollama_timeout)

            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self.ollama_base_url}/api/generate",
                    json={
                        "model": self.ollama_model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.3,
                            "top_p": 0.9,
                            "num_predict": len(optimized_content.optimized_text.split())
                            + 100,
                        },
                    },
                ) as response:
                    if response.status == 200:
                        api_result = await response.json()
                        raw_response = api_result.get("response", "").strip()

                        # Filter thinking tags for deepseek-r1 model
                        if "deepseek-r1" in self.ollama_model.lower():
                            enhanced_text = filter_thinking_tags(raw_response)
                        else:
                            enhanced_text = raw_response

                        # Create new optimized content with AI enhancement
                        enhanced_content = OptimizedContent()
                        enhanced_content.__dict__.update(optimized_content.__dict__)
                        enhanced_content.optimized_text = enhanced_text
                        enhanced_content.changes_summary.append(
                            "AI-enhanced for improved effectiveness"
                        )

                        # Recalculate metrics
                        enhanced_content.optimized_metrics = (
                            await self._assess_content_quality(enhanced_text)
                        )

                        # Update improvement delta
                        enhanced_content.improvement_delta = {
                            "clarity": enhanced_content.optimized_metrics.clarity_score
                            - enhanced_content.original_metrics.clarity_score,
                            "persuasiveness": enhanced_content.optimized_metrics.persuasiveness_score
                            - enhanced_content.original_metrics.persuasiveness_score,
                            "engagement": enhanced_content.optimized_metrics.engagement_score
                            - enhanced_content.original_metrics.engagement_score,
                            "professionalism": enhanced_content.optimized_metrics.professionalism_score
                            - enhanced_content.original_metrics.professionalism_score,
                            "accessibility": enhanced_content.optimized_metrics.accessibility_score
                            - enhanced_content.original_metrics.accessibility_score,
                            "overall": enhanced_content.optimized_metrics.overall_quality
                            - enhanced_content.original_metrics.overall_quality,
                        }

                        enhanced_content.overall_improvement = (
                            enhanced_content.improvement_delta["overall"]
                        )
                        enhanced_content.word_count_change = len(
                            enhanced_text.split()
                        ) - len(enhanced_content.original_text.split())

                        return enhanced_content

                    else:
                        raise Exception(f"Ollama API error: {response.status}")

        except Exception as e:
            self.logger.warning(f"AI enhancement failed: {e}")
            return None

    async def _identify_improvement_opportunities(
        self, text: str, quality_metrics: QualityMetrics
    ) -> List[str]:
        """Identify key improvement opportunities based on quality assessment"""
        opportunities = []

        # Identify areas below optimization threshold
        if quality_metrics.clarity_score < self.optimization_threshold:
            opportunities.append(
                "Improve clarity by simplifying sentence structure and vocabulary"
            )

        if quality_metrics.persuasiveness_score < self.optimization_threshold:
            opportunities.append("Strengthen persuasiveness with benefits and evidence")

        if quality_metrics.engagement_score < self.optimization_threshold:
            opportunities.append(
                "Increase engagement with direct address and interactive elements"
            )

        if quality_metrics.professionalism_score < self.optimization_threshold:
            opportunities.append(
                "Enhance professionalism with formal tone and business vocabulary"
            )

        if quality_metrics.accessibility_score < self.optimization_threshold:
            opportunities.append(
                "Improve accessibility with simpler language and better structure"
            )

        # Specific structural opportunities
        if quality_metrics.logical_flow < 0.6:
            opportunities.append(
                "Improve logical flow with better transitions and organization"
            )

        if quality_metrics.call_to_action_strength < 0.3:
            opportunities.append("Add clear calls-to-action to guide reader responses")

        if quality_metrics.evidence_quality < 0.4:
            opportunities.append(
                "Include more supporting evidence and credibility indicators"
            )

        return opportunities[:6]  # Limit to top 6 opportunities

    async def _generate_priority_actions(
        self, suggestions: List[OptimizationSuggestion]
    ) -> List[str]:
        """Generate prioritized action recommendations"""
        actions = []

        # Group suggestions by area
        area_groups = {}
        for suggestion in suggestions:
            area = suggestion.area.value
            if area not in area_groups:
                area_groups[area] = []
            area_groups[area].append(suggestion)

        # Generate actions based on high-priority, high-impact suggestions
        for area, area_suggestions in area_groups.items():
            high_priority = [
                s
                for s in area_suggestions
                if s.priority
                in [OptimizationPriority.CRITICAL, OptimizationPriority.HIGH]
            ]
            high_impact = [s for s in area_suggestions if s.impact_score > 0.7]

            if high_priority and high_impact:
                action = f"Address {area.replace('_', ' ')} issues - {len(high_priority)} high-priority items identified"
                actions.append(action)

        # Add general recommendations based on suggestion patterns
        if (
            len(
                [s for s in suggestions if s.area == ImprovementArea.SENTENCE_STRUCTURE]
            )
            > 2
        ):
            actions.append("Review and simplify complex sentence structures throughout")

        if len([s for s in suggestions if s.area == ImprovementArea.VOCABULARY]) > 3:
            actions.append("Replace complex vocabulary with clearer alternatives")

        if (
            len([s for s in suggestions if s.area == ImprovementArea.CALL_TO_ACTION])
            > 0
        ):
            actions.append("Add compelling calls-to-action to drive reader engagement")

        return actions[:5]  # Limit to top 5 actions

    async def _comprehensive_ai_analysis(
        self,
        text: str,
        optimization_types: List[OptimizationType],
        target_audience: str,
    ) -> Dict[str, Any]:
        """Perform comprehensive AI analysis of content"""
        if not aiohttp:
            return {}

        try:
            optimization_focus = ", ".join(
                [opt.value.replace("_", " ") for opt in optimization_types]
            )

            prompt = f"""Analyze the following text for content optimization opportunities.
Focus areas: {optimization_focus}
Target audience: {target_audience}

Provide analysis in the following areas:
1. Content strengths
2. Areas for improvement
3. Specific recommendations
4. Overall effectiveness score (0-10)

Text to analyze:
{text[:3000]}{"..." if len(text) > 3000 else ""}

Analysis:"""

            timeout = ClientTimeout(total=self.ollama_timeout)

            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self.ollama_base_url}/api/generate",
                    json={
                        "model": self.ollama_model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.2,
                            "top_p": 0.9,
                            "num_predict": 800,
                        },
                    },
                ) as response:
                    if response.status == 200:
                        api_result = await response.json()
                        raw_response = api_result.get("response", "").strip()

                        # Filter thinking tags for deepseek-r1 model
                        if "deepseek-r1" in self.ollama_model.lower():
                            analysis_text = filter_thinking_tags(raw_response)
                        else:
                            analysis_text = raw_response

                        # Try to parse structured response or return as text
                        return {
                            "comprehensive_analysis": analysis_text,
                            "focus_areas": optimization_focus,
                            "target_audience": target_audience,
                            "analysis_timestamp": time.monotonic(),
                        }
                    else:
                        raise Exception(f"Ollama API error: {response.status}")

        except Exception as e:
            self.logger.warning(f"Comprehensive AI analysis failed: {e}")
            return {}

    def _compile_optimization_statistics(
        self, result: ContentOptimizationResult, original_text: str
    ) -> Dict[str, Any]:
        """Compile comprehensive optimization statistics"""
        stats = {
            "optimization_summary": {
                "success": result.success,
                "suggestions_generated": len(result.suggestions),
                "model_calls": result.model_calls,
                "tokens_used": result.tokens_used,
                "processing_time": result.processing_time,
            },
            "content_analysis": {
                "original_word_count": len(original_text.split()),
                "original_sentence_count": len(re.split(r"[.!?]+", original_text)),
                "improvement_opportunities": len(result.improvement_opportunities),
                "priority_actions": len(result.priority_actions),
            },
            "quality_assessment": {
                "overall_quality": result.quality_assessment.overall_quality,
                "clarity_score": result.quality_assessment.clarity_score,
                "persuasiveness_score": result.quality_assessment.persuasiveness_score,
                "engagement_score": result.quality_assessment.engagement_score,
                "professionalism_score": result.quality_assessment.professionalism_score,
                "accessibility_score": result.quality_assessment.accessibility_score,
            },
        }

        if result.optimized_content:
            stats["optimization_results"] = {
                "optimized_word_count": len(
                    result.optimized_content.optimized_text.split()
                ),
                "word_count_change": result.optimized_content.word_count_change,
                "suggestions_applied": len(
                    result.optimized_content.suggestions_applied
                ),
                "overall_improvement": result.optimized_content.overall_improvement,
                "readability_improvement": result.optimized_content.readability_improvement,
            }

        return stats

    def get_optimizer_info(self) -> Dict[str, Any]:
        """Get comprehensive optimizer information"""
        return {
            "optimizer_version": "1.0.0",
            "ollama_model": self.ollama_model,
            "supported_optimization_types": [opt.value for opt in OptimizationType],
            "supported_improvement_areas": [area.value for area in ImprovementArea],
            "priority_levels": [priority.value for priority in OptimizationPriority],
            "features": {
                "quality_assessment": True,
                "rule_based_optimization": True,
                "ai_enhancement": self.use_ai_enhancement and aiohttp is not None,
                "comprehensive_analysis": self.enable_comprehensive_analysis,
                "suggestion_ranking": True,
                "impact_scoring": True,
            },
            "configuration": {
                "ai_enhancement_enabled": self.use_ai_enhancement,
                "comprehensive_analysis_enabled": self.enable_comprehensive_analysis,
                "optimization_threshold": self.optimization_threshold,
                "timeout": self.ollama_timeout,
            },
        }

    async def close(self):
        """Close optimizer and cleanup resources"""
        self.logger.info("ContentOptimizer closed")

# Factory function
def create_content_optimizer(
    config: Optional[Dict[str, Any]] = None,
) -> ContentOptimizer:
    """Create ContentOptimizer instance with configuration"""
    if config is None:
        config = {}

    return ContentOptimizer(
        ollama_base_url=config.get("ollama_base_url", "http://localhost:11434"),
        ollama_model=config.get("ollama_model", "deepseek-r1:32b"),
        ollama_timeout=config.get("ollama_timeout", 120.0),
        use_ai_enhancement=config.get("use_ai_enhancement", True),
        enable_comprehensive_analysis=config.get("enable_comprehensive_analysis", True),
        optimization_threshold=config.get("optimization_threshold", 0.7),
        use_advanced_prompting=config.get("use_advanced_prompting", True),
    )
