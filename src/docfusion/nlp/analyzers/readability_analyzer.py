#!/usr/bin/env python3
"""
Readability Analyzer with Ollama Integration

Advanced readability assessment with multiple metrics, AI-powered insights,
and comprehensive recommendations for document accessibility.
"""

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from ...core.utils import uuid7str

try:
    import aiohttp
    from aiohttp import ClientError, ClientTimeout
except ImportError:
    aiohttp = None

try:
    from textstat import (
        automated_readability_index,
        avg_sentence_length,
        coleman_liau_index,
        dale_chall_readability_score,
        difficult_words,
        flesch_kincaid_grade,
        flesch_reading_ease,
        gunning_fog,
        lexicon_count,
        linsear_write_formula,
        syllable_count,
        text_standard,
    )
    from textstat import sentence_count as textstat_sentence_count
except ImportError:
    # Fallback implementations if textstat is not available
    flesch_reading_ease = flesch_kincaid_grade = gunning_fog = None
    automated_readability_index = coleman_liau_index = None
    linsear_write_formula = dale_chall_readability_score = text_standard = None
    syllable_count = textstat_sentence_count = lexicon_count = None
    avg_sentence_length = difficult_words = None

# Import centralized LLM config and advanced prompting
try:
    from ..config.llm_config import LLMConfiguration, LLMTask, get_llm_config
    from ..prompting_strategies import (
        PromptingStrategy,
        create_chain_of_thought_prompt,
        create_tree_of_thought_prompt,
        filter_thinking_tags,
    )

    HAS_ADVANCED_PROMPTING = True
except ImportError:
    HAS_ADVANCED_PROMPTING = False
    LLMConfiguration = None

class ReadingLevel(Enum):
    """Reading difficulty levels"""

    ELEMENTARY = "elementary"
    MIDDLE_SCHOOL = "middle_school"
    HIGH_SCHOOL = "high_school"
    COLLEGE = "college"
    GRADUATE = "graduate"
    PROFESSIONAL = "professional"

class AudienceType(Enum):
    """Target audience types"""

    GENERAL_PUBLIC = "general_public"
    BUSINESS_PROFESSIONAL = "business_professional"
    TECHNICAL_EXPERT = "technical_expert"
    ACADEMIC_RESEARCHER = "academic_researcher"
    GOVERNMENT_OFFICIAL = "government_official"

@dataclass
class ReadabilityMetrics:
    """Comprehensive readability measurements"""

    # Standard readability scores
    flesch_reading_ease: Optional[float] = None
    flesch_kincaid_grade: Optional[float] = None
    gunning_fog_index: Optional[float] = None
    automated_readability_index: Optional[float] = None
    coleman_liau_index: Optional[float] = None
    dale_chall_score: Optional[float] = None
    linsear_write_score: Optional[float] = None

    # Text statistics
    word_count: int = 0
    sentence_count: int = 0
    syllable_count: int = 0
    character_count: int = 0
    paragraph_count: int = 0

    # Complexity indicators
    avg_sentence_length: float = 0.0
    avg_syllables_per_word: float = 0.0
    difficult_words_count: int = 0
    difficult_words_ratio: float = 0.0
    complex_words_count: int = 0
    complex_words_ratio: float = 0.0

    # Vocabulary metrics
    unique_words_count: int = 0
    vocabulary_diversity: float = 0.0
    technical_terms_count: int = 0
    jargon_ratio: float = 0.0

@dataclass
class ReadingLevelAssessment:
    """Reading level assessment and recommendations"""

    primary_level: ReadingLevel = ReadingLevel.HIGH_SCHOOL
    grade_level_range: Tuple[float, float] = (9.0, 12.0)
    confidence_score: float = 0.0

    # Audience suitability
    suitable_audiences: List[AudienceType] = field(default_factory=list)
    accessibility_score: float = 0.0

    # Level indicators
    level_indicators: Dict[str, float] = field(default_factory=dict)
    complexity_factors: List[str] = field(default_factory=list)

@dataclass
class AccessibilityAssessment:
    """Document accessibility evaluation"""

    overall_accessibility: float = 0.0
    plain_language_score: float = 0.0
    clarity_score: float = 0.0

    # Accessibility barriers
    barriers: List[str] = field(default_factory=list)
    improvements_needed: List[str] = field(default_factory=list)

    # Specific assessments
    sentence_complexity: float = 0.0
    vocabulary_difficulty: float = 0.0
    structure_clarity: float = 0.0

@dataclass
class ReadabilityAnalysisResult:
    """Comprehensive readability analysis result"""

    success: bool = False
    analysis_id: str = field(default_factory=uuid7str)

    # Core analysis components
    metrics: ReadabilityMetrics = field(default_factory=ReadabilityMetrics)
    reading_level: ReadingLevelAssessment = field(
        default_factory=ReadingLevelAssessment
    )
    accessibility: AccessibilityAssessment = field(
        default_factory=AccessibilityAssessment
    )

    # AI-enhanced insights
    ai_analysis: Optional[Dict[str, Any]] = None
    readability_recommendations: List[str] = field(default_factory=list)
    simplification_suggestions: List[str] = field(default_factory=list)

    # Analysis metadata
    processing_time: float = 0.0
    confidence_score: float = 0.0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    # Statistical summaries
    statistics: Dict[str, Any] = field(default_factory=dict)

class ReadabilityAnalyzer:
    """Advanced readability analyzer with multiple metrics and AI insights"""

    def __init__(
        self,
        llm_config: Optional[LLMConfiguration] = None,
        use_ai_enhancement: bool = True,
        target_reading_level: ReadingLevel = ReadingLevel.HIGH_SCHOOL,
        enable_accessibility_analysis: bool = True,
        enable_advanced_prompting: bool = True,
        ollama_base_url: str = None,
        ollama_model: str = None,
        ollama_timeout: float = None,
    ):
        # Use centralized LLM config or fallback to parameters
        if llm_config and HAS_ADVANCED_PROMPTING:
            self.llm_config = llm_config
        elif HAS_ADVANCED_PROMPTING:
            self.llm_config = get_llm_config(LLMTask.READABILITY_ANALYSIS)
        else:
            # Fallback for backwards compatibility
            self.llm_config = type(
                "MockConfig",
                (),
                {
                    "model": ollama_model or "llama3.2:3b",
                    "base_url": (ollama_base_url or "http://localhost:11434").rstrip(
                        "/"
                    ),
                    "timeout": ollama_timeout or 120.0,
                    "temperature": 0.1,
                    "enable_thinking_filter": False,
                },
            )()

        self.use_ai_enhancement = use_ai_enhancement
        self.target_reading_level = target_reading_level
        self.enable_accessibility_analysis = enable_accessibility_analysis
        self.enable_advanced_prompting = (
            enable_advanced_prompting and HAS_ADVANCED_PROMPTING
        )
        self.logger = logging.getLogger(__name__)

        # Initialize readability standards and vocabularies
        self._initialize_standards()
        self._initialize_vocabularies()

        self.logger.info(f"ReadabilityAnalyzer initialized with model: {ollama_model}")

    def _initialize_standards(self):
        """Initialize readability level standards and thresholds"""
        # Flesch Reading Ease score ranges
        self.flesch_levels = {
            (90, 100): ReadingLevel.ELEMENTARY,
            (80, 89): ReadingLevel.ELEMENTARY,
            (70, 79): ReadingLevel.MIDDLE_SCHOOL,
            (60, 69): ReadingLevel.HIGH_SCHOOL,
            (50, 59): ReadingLevel.HIGH_SCHOOL,
            (30, 49): ReadingLevel.COLLEGE,
            (0, 29): ReadingLevel.GRADUATE,
        }

        # Grade level ranges for different reading levels
        self.grade_level_ranges = {
            ReadingLevel.ELEMENTARY: (1.0, 6.0),
            ReadingLevel.MIDDLE_SCHOOL: (6.0, 9.0),
            ReadingLevel.HIGH_SCHOOL: (9.0, 12.0),
            ReadingLevel.COLLEGE: (12.0, 16.0),
            ReadingLevel.GRADUATE: (16.0, 20.0),
            ReadingLevel.PROFESSIONAL: (18.0, 25.0),
        }

        # Audience suitability mapping
        self.audience_suitability = {
            ReadingLevel.ELEMENTARY: [AudienceType.GENERAL_PUBLIC],
            ReadingLevel.MIDDLE_SCHOOL: [AudienceType.GENERAL_PUBLIC],
            ReadingLevel.HIGH_SCHOOL: [
                AudienceType.GENERAL_PUBLIC,
                AudienceType.BUSINESS_PROFESSIONAL,
            ],
            ReadingLevel.COLLEGE: [
                AudienceType.BUSINESS_PROFESSIONAL,
                AudienceType.GOVERNMENT_OFFICIAL,
            ],
            ReadingLevel.GRADUATE: [
                AudienceType.TECHNICAL_EXPERT,
                AudienceType.ACADEMIC_RESEARCHER,
            ],
            ReadingLevel.PROFESSIONAL: [
                AudienceType.TECHNICAL_EXPERT,
                AudienceType.ACADEMIC_RESEARCHER,
            ],
        }

    def _initialize_vocabularies(self):
        """Initialize specialized vocabularies for analysis"""
        # Technical terms that increase difficulty
        self.technical_vocabulary = {
            "algorithm",
            "architecture",
            "infrastructure",
            "implementation",
            "configuration",
            "optimization",
            "integration",
            "scalability",
            "methodology",
            "framework",
            "specification",
            "protocol",
            "interface",
            "database",
            "authentication",
            "authorization",
            "encryption",
            "validation",
            "verification",
            "deployment",
        }

        # Business jargon
        self.business_jargon = {
            "synergy",
            "leverage",
            "paradigm",
            "stakeholder",
            "deliverable",
            "actionable",
            "scalable",
            "monetize",
            "optimize",
            "streamline",
            "facilitate",
            "implement",
            "strategize",
            "prioritize",
            "incentivize",
            "operationalize",
            "institutionalize",
        }

        # Academic vocabulary
        self.academic_vocabulary = {
            "hypothesis",
            "methodology",
            "empirical",
            "theoretical",
            "conceptual",
            "systematic",
            "comprehensive",
            "analytical",
            "synthesis",
            "paradigm",
            "phenomenon",
            "correlation",
            "causation",
            "significance",
            "validity",
        }

        # Simple alternatives for common complex words
        self.simplification_suggestions = {
            "utilize": "use",
            "facilitate": "help",
            "implement": "do",
            "demonstrate": "show",
            "establish": "set up",
            "initiate": "start",
            "terminate": "end",
            "subsequent": "next",
            "prior": "before",
            "approximately": "about",
        }

    async def analyze_readability(
        self,
        text: str,
        target_audience: Optional[AudienceType] = None,
        use_ai: Optional[bool] = None,
    ) -> ReadabilityAnalysisResult:
        """Perform comprehensive readability analysis"""
        start_time = asyncio.get_event_loop().time()
        result = ReadabilityAnalysisResult()

        try:
            assert text and text.strip(), "Text content is required"

            use_ai = use_ai if use_ai is not None else self.use_ai_enhancement

            # Step 1: Calculate basic readability metrics
            result.metrics = await self._calculate_readability_metrics(text)

            # Step 2: Assess reading level
            result.reading_level = await self._assess_reading_level(
                result.metrics, target_audience
            )

            # Step 3: Evaluate accessibility
            if self.enable_accessibility_analysis:
                result.accessibility = await self._evaluate_accessibility(
                    text, result.metrics
                )

            # Step 4: AI-enhanced analysis (if enabled)
            if use_ai and aiohttp:
                try:
                    result.ai_analysis = await self._ai_readability_analysis(
                        text, target_audience
                    )
                    result.readability_recommendations = (
                        await self._generate_ai_recommendations(text, result)
                    )
                    result.simplification_suggestions = (
                        await self._generate_simplification_suggestions(text, result)
                    )
                except Exception as e:
                    result.warnings.append(f"AI readability analysis failed: {str(e)}")
                    self.logger.warning(f"AI readability analysis failed: {e}")

            # Step 5: Generate rule-based recommendations if AI unavailable
            if not use_ai or not aiohttp or not result.readability_recommendations:
                result.readability_recommendations = (
                    self._generate_rule_based_recommendations(result)
                )
                result.simplification_suggestions = (
                    self._generate_rule_based_simplifications(text, result)
                )

            # Step 6: Calculate confidence and compile statistics
            result.confidence_score = self._calculate_readability_confidence(result)
            result.statistics = self._compile_readability_statistics(result, text)

            result.success = len(result.errors) == 0
            result.processing_time = asyncio.get_event_loop().time() - start_time

            self.logger.info(
                f"Readability analysis completed, reading level: {result.reading_level.primary_level.value}"
            )

        except Exception as e:
            result.errors.append(f"Readability analysis failed: {str(e)}")
            self.logger.error(f"Readability analysis error: {e}")

        return result

    async def _calculate_readability_metrics(self, text: str) -> ReadabilityMetrics:
        """Calculate comprehensive readability metrics"""
        metrics = ReadabilityMetrics()

        try:
            # Basic text statistics
            if lexicon_count:
                metrics.word_count = lexicon_count(text)
            else:
                metrics.word_count = len(text.split())

            if textstat_sentence_count:
                metrics.sentence_count = textstat_sentence_count(text)
            else:
                metrics.sentence_count = len(re.split(r"[.!?]+", text))

            metrics.character_count = len(text)
            metrics.paragraph_count = len(re.split(r"\n\s*\n", text))

            # Syllable count
            if syllable_count:
                metrics.syllable_count = syllable_count(text)
            else:
                metrics.syllable_count = self._estimate_syllables(text)

            # Average metrics
            if metrics.sentence_count > 0:
                metrics.avg_sentence_length = (
                    metrics.word_count / metrics.sentence_count
                )

            if metrics.word_count > 0:
                metrics.avg_syllables_per_word = (
                    metrics.syllable_count / metrics.word_count
                )

            # Readability scores (using textstat if available)
            if flesch_reading_ease:
                metrics.flesch_reading_ease = flesch_reading_ease(text)

            if flesch_kincaid_grade:
                metrics.flesch_kincaid_grade = flesch_kincaid_grade(text)

            if gunning_fog:
                metrics.gunning_fog_index = gunning_fog(text)

            if automated_readability_index:
                metrics.automated_readability_index = automated_readability_index(text)

            if coleman_liau_index:
                metrics.coleman_liau_index = coleman_liau_index(text)

            if dale_chall_readability_score:
                metrics.dale_chall_score = dale_chall_readability_score(text)

            if linsear_write_formula:
                metrics.linsear_write_score = linsear_write_formula(text)

            # Difficult words analysis
            if difficult_words:
                metrics.difficult_words_count = difficult_words(text)
                if metrics.word_count > 0:
                    metrics.difficult_words_ratio = (
                        metrics.difficult_words_count / metrics.word_count
                    )
            else:
                # Fallback: estimate difficult words (3+ syllables)
                words = text.split()
                complex_word_count = 0
                for word in words:
                    word_syllables = self._count_syllables(
                        word.lower().strip('.,!?;:"()[]{}')
                    )
                    if word_syllables >= 3:
                        complex_word_count += 1

                metrics.complex_words_count = complex_word_count
                if metrics.word_count > 0:
                    metrics.complex_words_ratio = (
                        complex_word_count / metrics.word_count
                    )

            # Vocabulary diversity
            words = [word.lower().strip('.,!?;:"()[]{}') for word in text.split()]
            unique_words = set(words)
            metrics.unique_words_count = len(unique_words)

            if metrics.word_count > 0:
                metrics.vocabulary_diversity = len(unique_words) / metrics.word_count

            # Technical/jargon analysis
            text_lower = text.lower()

            # Count technical terms
            technical_count = sum(
                1 for term in self.technical_vocabulary if term in text_lower
            )
            business_count = sum(
                1 for term in self.business_jargon if term in text_lower
            )
            academic_count = sum(
                1 for term in self.academic_vocabulary if term in text_lower
            )

            metrics.technical_terms_count = (
                technical_count + business_count + academic_count
            )

            if metrics.word_count > 0:
                metrics.jargon_ratio = (
                    metrics.technical_terms_count / metrics.word_count
                )

        except Exception as e:
            self.logger.warning(f"Metrics calculation failed: {e}")

        return metrics

    def _estimate_syllables(self, text: str) -> int:
        """Estimate syllable count when textstat is unavailable"""
        words = re.findall(r"\b\w+\b", text.lower())
        total_syllables = sum(self._count_syllables(word) for word in words)
        return total_syllables

    def _count_syllables(self, word: str) -> int:
        """Count syllables in a word (simple approximation)"""
        if not word:
            return 0

        word = word.lower()
        vowels = "aeiouy"
        syllables = 0
        prev_was_vowel = False

        for char in word:
            is_vowel = char in vowels
            if is_vowel and not prev_was_vowel:
                syllables += 1
            prev_was_vowel = is_vowel

        # Handle silent 'e'
        if word.endswith("e") and syllables > 1:
            syllables -= 1

        # Ensure at least one syllable
        return max(syllables, 1)

    async def _assess_reading_level(
        self, metrics: ReadabilityMetrics, target_audience: Optional[AudienceType]
    ) -> ReadingLevelAssessment:
        """Assess reading level based on metrics"""
        assessment = ReadingLevelAssessment()

        try:
            grade_level_estimates = []

            # Collect grade level estimates from different metrics
            if metrics.flesch_kincaid_grade:
                grade_level_estimates.append(metrics.flesch_kincaid_grade)

            if metrics.gunning_fog_index:
                grade_level_estimates.append(metrics.gunning_fog_index)

            if metrics.automated_readability_index:
                grade_level_estimates.append(metrics.automated_readability_index)

            if metrics.coleman_liau_index:
                grade_level_estimates.append(metrics.coleman_liau_index)

            # Use Flesch Reading Ease if available
            if metrics.flesch_reading_ease is not None:
                for (min_score, max_score), level in self.flesch_levels.items():
                    if min_score <= metrics.flesch_reading_ease <= max_score:
                        assessment.primary_level = level
                        break

            # Calculate average grade level if we have estimates
            if grade_level_estimates:
                avg_grade_level = sum(grade_level_estimates) / len(
                    grade_level_estimates
                )

                # Map grade level to reading level
                for level, (min_grade, max_grade) in self.grade_level_ranges.items():
                    if min_grade <= avg_grade_level <= max_grade:
                        assessment.primary_level = level
                        assessment.grade_level_range = (
                            max(min_grade, avg_grade_level - 1),
                            min(max_grade, avg_grade_level + 1),
                        )
                        break

            # Adjust based on complexity indicators
            complexity_score = 0

            if metrics.avg_sentence_length > 20:
                complexity_score += 1
                assessment.complexity_factors.append("Long sentences")

            if metrics.avg_syllables_per_word > 1.7:
                complexity_score += 1
                assessment.complexity_factors.append("Complex vocabulary")

            if metrics.difficult_words_ratio > 0.15:
                complexity_score += 1
                assessment.complexity_factors.append("Many difficult words")

            if metrics.jargon_ratio > 0.05:
                complexity_score += 1
                assessment.complexity_factors.append("Technical jargon")

            # Increase reading level if high complexity
            if complexity_score >= 2:
                level_values = list(ReadingLevel)
                current_index = level_values.index(assessment.primary_level)
                if current_index < len(level_values) - 1:
                    assessment.primary_level = level_values[current_index + 1]

            # Determine suitable audiences
            assessment.suitable_audiences = self.audience_suitability.get(
                assessment.primary_level, []
            )

            # Calculate accessibility score
            accessibility_factors = []

            # Sentence length factor
            if metrics.avg_sentence_length <= 15:
                accessibility_factors.append(0.9)
            elif metrics.avg_sentence_length <= 20:
                accessibility_factors.append(0.7)
            else:
                accessibility_factors.append(0.4)

            # Vocabulary complexity factor
            if metrics.avg_syllables_per_word <= 1.5:
                accessibility_factors.append(0.9)
            elif metrics.avg_syllables_per_word <= 1.7:
                accessibility_factors.append(0.7)
            else:
                accessibility_factors.append(0.5)

            # Jargon factor
            if metrics.jargon_ratio <= 0.02:
                accessibility_factors.append(0.9)
            elif metrics.jargon_ratio <= 0.05:
                accessibility_factors.append(0.7)
            else:
                accessibility_factors.append(0.4)

            assessment.accessibility_score = sum(accessibility_factors) / len(
                accessibility_factors
            )

            # Calculate confidence
            confidence_factors = []

            if metrics.word_count >= 100:
                confidence_factors.append(min(metrics.word_count / 500, 1.0))
            else:
                confidence_factors.append(0.5)

            if grade_level_estimates:
                confidence_factors.append(0.8)
            else:
                confidence_factors.append(0.4)

            assessment.confidence_score = sum(confidence_factors) / len(
                confidence_factors
            )

            # Store level indicators
            assessment.level_indicators = {
                "avg_sentence_length": metrics.avg_sentence_length,
                "avg_syllables_per_word": metrics.avg_syllables_per_word,
                "difficult_words_ratio": metrics.difficult_words_ratio,
                "jargon_ratio": metrics.jargon_ratio,
                "vocabulary_diversity": metrics.vocabulary_diversity,
            }

        except Exception as e:
            self.logger.warning(f"Reading level assessment failed: {e}")

        return assessment

    async def _evaluate_accessibility(
        self, text: str, metrics: ReadabilityMetrics
    ) -> AccessibilityAssessment:
        """Evaluate document accessibility"""
        assessment = AccessibilityAssessment()

        try:
            accessibility_scores = []

            # Sentence complexity assessment
            if metrics.avg_sentence_length <= 15:
                assessment.sentence_complexity = 0.9
            elif metrics.avg_sentence_length <= 20:
                assessment.sentence_complexity = 0.7
            elif metrics.avg_sentence_length <= 25:
                assessment.sentence_complexity = 0.5
            else:
                assessment.sentence_complexity = 0.3
                assessment.barriers.append(
                    "Sentences are too long (>25 words on average)"
                )
                assessment.improvements_needed.append(
                    "Break long sentences into shorter ones"
                )

            accessibility_scores.append(assessment.sentence_complexity)

            # Vocabulary difficulty assessment
            if metrics.difficult_words_ratio <= 0.05:
                assessment.vocabulary_difficulty = 0.9
            elif metrics.difficult_words_ratio <= 0.10:
                assessment.vocabulary_difficulty = 0.7
            elif metrics.difficult_words_ratio <= 0.15:
                assessment.vocabulary_difficulty = 0.5
            else:
                assessment.vocabulary_difficulty = 0.3
                assessment.barriers.append("Too many difficult words")
                assessment.improvements_needed.append(
                    "Replace complex words with simpler alternatives"
                )

            accessibility_scores.append(assessment.vocabulary_difficulty)

            # Structure clarity assessment
            paragraph_count = metrics.paragraph_count
            sentence_count = metrics.sentence_count

            if paragraph_count > 0:
                avg_sentences_per_paragraph = sentence_count / paragraph_count

                if avg_sentences_per_paragraph <= 5:
                    assessment.structure_clarity = 0.9
                elif avg_sentences_per_paragraph <= 8:
                    assessment.structure_clarity = 0.7
                else:
                    assessment.structure_clarity = 0.5
                    assessment.barriers.append("Paragraphs are too long")
                    assessment.improvements_needed.append(
                        "Break long paragraphs into shorter ones"
                    )
            else:
                assessment.structure_clarity = 0.5

            accessibility_scores.append(assessment.structure_clarity)

            # Plain language assessment
            plain_language_factors = []

            # Active voice usage (simple heuristic)
            passive_voice_count = len(
                re.findall(
                    r"\b(?:is|are|was|were|be|been|being)\s+\w*ed\b",
                    text,
                    re.IGNORECASE,
                )
            )
            passive_ratio = (
                passive_voice_count / sentence_count if sentence_count > 0 else 0
            )

            if passive_ratio <= 0.1:
                plain_language_factors.append(0.9)
            elif passive_ratio <= 0.2:
                plain_language_factors.append(0.7)
            else:
                plain_language_factors.append(0.4)
                assessment.barriers.append("Too much passive voice")
                assessment.improvements_needed.append("Use more active voice")

            # Jargon usage
            if metrics.jargon_ratio <= 0.02:
                plain_language_factors.append(0.9)
            elif metrics.jargon_ratio <= 0.05:
                plain_language_factors.append(0.7)
            else:
                plain_language_factors.append(0.4)
                assessment.barriers.append("Too much technical jargon")
                assessment.improvements_needed.append(
                    "Explain technical terms or use simpler language"
                )

            assessment.plain_language_score = sum(plain_language_factors) / len(
                plain_language_factors
            )
            accessibility_scores.append(assessment.plain_language_score)

            # Clarity assessment
            clarity_factors = []

            # Vocabulary diversity (too high can indicate inconsistent terminology)
            if 0.3 <= metrics.vocabulary_diversity <= 0.7:
                clarity_factors.append(0.9)
            elif (
                0.2 <= metrics.vocabulary_diversity < 0.3
                or 0.7 < metrics.vocabulary_diversity <= 0.8
            ):
                clarity_factors.append(0.7)
            else:
                clarity_factors.append(0.5)

            # Sentence length consistency (check standard deviation)
            sentences = re.split(r"[.!?]+", text)
            sentence_lengths = [len(s.split()) for s in sentences if s.strip()]

            if sentence_lengths:
                avg_length = sum(sentence_lengths) / len(sentence_lengths)
                variance = sum(
                    (length - avg_length) ** 2 for length in sentence_lengths
                ) / len(sentence_lengths)
                std_dev = variance**0.5

                # Lower standard deviation = more consistent (better)
                if std_dev <= 5:
                    clarity_factors.append(0.9)
                elif std_dev <= 8:
                    clarity_factors.append(0.7)
                else:
                    clarity_factors.append(0.5)
            else:
                clarity_factors.append(0.5)

            assessment.clarity_score = sum(clarity_factors) / len(clarity_factors)
            accessibility_scores.append(assessment.clarity_score)

            # Overall accessibility score
            assessment.overall_accessibility = sum(accessibility_scores) / len(
                accessibility_scores
            )

            # Add general improvements if overall score is low
            if assessment.overall_accessibility < 0.6:
                if "Use shorter sentences" not in assessment.improvements_needed:
                    assessment.improvements_needed.append("Use shorter sentences")
                if "Simplify vocabulary" not in assessment.improvements_needed:
                    assessment.improvements_needed.append("Simplify vocabulary")
                if (
                    "Organize content with clear headings"
                    not in assessment.improvements_needed
                ):
                    assessment.improvements_needed.append(
                        "Organize content with clear headings"
                    )

        except Exception as e:
            self.logger.warning(f"Accessibility evaluation failed: {e}")

        return assessment

    async def _ai_readability_analysis(
        self, text: str, target_audience: Optional[AudienceType]
    ) -> Dict[str, Any]:
        """AI-enhanced readability analysis with advanced prompting techniques"""
        if not aiohttp:
            raise ImportError("aiohttp required for AI readability analysis")

        audience_context = (
            f" for {target_audience.value.replace('_', ' ')} audience"
            if target_audience
            else ""
        )

        # Use advanced prompting if available
        if self.enable_advanced_prompting:
            prompt = self._create_advanced_readability_prompt(text, target_audience)
        else:
            prompt = self._create_basic_readability_prompt(text, audience_context)

        timeout = ClientTimeout(total=self.llm_config.timeout)

        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                f"{self.llm_config.base_url}/api/generate",
                json={
                    "model": self.llm_config.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": self.llm_config.temperature,
                        "top_p": 0.9,
                        "num_predict": 1500,
                    },
                },
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    ai_response = result.get("response", "").strip()

                    # Apply thinking tag filter if enabled
                    if (
                        self.llm_config.enable_thinking_filter
                        and self.enable_advanced_prompting
                    ):
                        ai_response = filter_thinking_tags(ai_response)

                    try:
                        return json.loads(ai_response)
                    except json.JSONDecodeError:
                        return {
                            "readability_assessment": {
                                "reading_level": "analysis_available"
                            },
                            "raw_analysis": ai_response,
                            "recommendations": [
                                "Review AI analysis in raw_analysis field"
                            ],
                        }
                else:
                    raise Exception(f"Ollama API error: {response.status}")

    def _create_advanced_readability_prompt(
        self, text: str, target_audience: Optional[AudienceType]
    ) -> str:
        """Create advanced Chain-of-Thought readability analysis prompt"""
        audience_context = (
            f" for {target_audience.value.replace('_', ' ')} audience"
            if target_audience
            else ""
        )

        # Define the readability analysis task
        task = f"Analyze the readability and accessibility of text{audience_context}"

        context = {
            "text_sample": text[:3000] + ("..." if len(text) > 3000 else ""),
            "target_audience": target_audience.value if target_audience else "general",
            "analysis_requirements": [
                "Reading difficulty level and grade level",
                "Sentence structure and complexity",
                "Vocabulary accessibility",
                "Overall clarity and flow",
                "Specific barriers to understanding",
            ],
        }

        reasoning_steps = [
            "First, examine sentence length and structure patterns",
            "Then, analyze vocabulary complexity and technical terms",
            "Next, evaluate paragraph organization and flow",
            "Then, identify specific accessibility barriers",
            "Finally, provide actionable improvement recommendations",
        ]

        output_format = """{
	"readability_assessment": {
		"reading_level": "elementary|middle_school|high_school|college|graduate|professional",
		"grade_level_estimate": 1-20,
		"accessibility_score": 0.0-1.0,
		"clarity_score": 0.0-1.0
	},
	"complexity_analysis": {
		"sentence_complexity": "low|medium|high",
		"vocabulary_difficulty": "simple|moderate|complex|very_complex",
		"technical_content": 0.0-1.0
	},
	"barriers": ["barrier1", "barrier2"],
	"recommendations": ["recommendation1", "recommendation2"],
	"simplification_targets": [
		{"original": "complex phrase", "suggested": "simpler alternative"}
	]
}"""

        # Create Chain-of-Thought prompt
        return create_chain_of_thought_prompt(
            task=task,
            context=context,
            reasoning_steps=reasoning_steps,
            output_format=output_format,
            examples=None,
            strategy=PromptingStrategy.CHAIN_OF_THOUGHT,
        )

    def _create_basic_readability_prompt(self, text: str, audience_context: str) -> str:
        """Create basic readability analysis prompt for fallback"""
        return f"""Analyze the readability and accessibility of the following text{audience_context}. Evaluate:

1. Reading difficulty level and grade level
2. Sentence structure and complexity
3. Vocabulary accessibility
4. Overall clarity and flow
5. Specific barriers to understanding

Text to analyze:
{text[:3000]}{"..." if len(text) > 3000 else ""}

Provide your analysis in JSON format:
{{
	"readability_assessment": {{
		"reading_level": "elementary|middle_school|high_school|college|graduate|professional",
		"grade_level_estimate": 1-20,
		"accessibility_score": 0.0-1.0,
		"clarity_score": 0.0-1.0
	}},
	"complexity_analysis": {{
		"sentence_complexity": "low|medium|high",
		"vocabulary_difficulty": "simple|moderate|complex|very_complex",
		"technical_content": 0.0-1.0
	}},
	"barriers": ["barrier1", "barrier2"],
	"recommendations": ["recommendation1", "recommendation2"],
	"simplification_targets": [
		{{"original": "complex phrase", "suggested": "simpler alternative"}}
	]
}}"""

    async def _generate_ai_recommendations(
        self, text: str, result: ReadabilityAnalysisResult
    ) -> List[str]:
        """Generate AI-powered readability recommendations"""
        recommendations = []

        if result.ai_analysis and "recommendations" in result.ai_analysis:
            recommendations.extend(result.ai_analysis["recommendations"])

        # Add rule-based recommendations
        recommendations.extend(self._generate_rule_based_recommendations(result))

        return recommendations[:8]  # Limit to 8 recommendations

    async def _generate_simplification_suggestions(
        self, text: str, result: ReadabilityAnalysisResult
    ) -> List[str]:
        """Generate AI-powered simplification suggestions"""
        suggestions = []

        if result.ai_analysis and "simplification_targets" in result.ai_analysis:
            for target in result.ai_analysis["simplification_targets"]:
                if (
                    isinstance(target, dict)
                    and "original" in target
                    and "suggested" in target
                ):
                    suggestions.append(
                        f"Replace '{target['original']}' with '{target['suggested']}'"
                    )

        # Add rule-based simplifications
        suggestions.extend(self._generate_rule_based_simplifications(text, result))

        return suggestions[:10]  # Limit to 10 suggestions

    def _generate_rule_based_recommendations(
        self, result: ReadabilityAnalysisResult
    ) -> List[str]:
        """Generate rule-based readability recommendations"""
        recommendations = []

        # Sentence length recommendations
        if result.metrics.avg_sentence_length > 20:
            recommendations.append(
                "Break long sentences into shorter ones (aim for 15-20 words)"
            )

        # Vocabulary recommendations
        if result.metrics.difficult_words_ratio > 0.15:
            recommendations.append("Replace difficult words with simpler alternatives")

        # Syllable recommendations
        if result.metrics.avg_syllables_per_word > 1.7:
            recommendations.append("Use shorter, simpler words when possible")

        # Jargon recommendations
        if result.metrics.jargon_ratio > 0.05:
            recommendations.append(
                "Define technical terms or use plain language alternatives"
            )

        # Structure recommendations
        if result.metrics.paragraph_count > 0:
            avg_sentences_per_paragraph = (
                result.metrics.sentence_count / result.metrics.paragraph_count
            )
            if avg_sentences_per_paragraph > 6:
                recommendations.append("Break long paragraphs into shorter ones")

        # Reading level recommendations
        target_level = self.target_reading_level
        if result.reading_level.primary_level.value != target_level.value:
            level_order = [
                ReadingLevel.ELEMENTARY,
                ReadingLevel.MIDDLE_SCHOOL,
                ReadingLevel.HIGH_SCHOOL,
                ReadingLevel.COLLEGE,
                ReadingLevel.GRADUATE,
                ReadingLevel.PROFESSIONAL,
            ]

            current_index = level_order.index(result.reading_level.primary_level)
            target_index = level_order.index(target_level)

            if current_index > target_index:
                recommendations.append(
                    f"Simplify content to reach {target_level.value.replace('_', ' ')} reading level"
                )
            else:
                recommendations.append(
                    f"Content may be too simple for {target_level.value.replace('_', ' ')} audience"
                )

        # Accessibility recommendations
        if result.accessibility.overall_accessibility < 0.6:
            recommendations.append("Improve overall accessibility for broader audience")

        return recommendations

    def _generate_rule_based_simplifications(
        self, text: str, result: ReadabilityAnalysisResult
    ) -> List[str]:
        """Generate rule-based word simplification suggestions"""
        suggestions = []
        text_lower = text.lower()

        # Check for words that can be simplified
        for complex_word, simple_word in self.simplification_suggestions.items():
            if complex_word in text_lower:
                suggestions.append(f"Replace '{complex_word}' with '{simple_word}'")

        # Check for technical terms that need explanation
        for term in self.technical_vocabulary:
            if term in text_lower:
                suggestions.append(f"Define or explain the technical term '{term}'")

        # Check for business jargon
        for jargon in self.business_jargon:
            if jargon in text_lower:
                suggestions.append(
                    f"Consider replacing business jargon '{jargon}' with clearer language"
                )

        return suggestions[:5]  # Limit to 5 simplification suggestions

    def _calculate_readability_confidence(
        self, result: ReadabilityAnalysisResult
    ) -> float:
        """Calculate overall confidence in readability analysis"""
        confidence_factors = []

        # Text length factor
        if result.metrics.word_count >= 100:
            confidence_factors.append(min(result.metrics.word_count / 300, 1.0))
        else:
            confidence_factors.append(0.5)

        # Metric availability factor
        available_metrics = 0
        if result.metrics.flesch_reading_ease is not None:
            available_metrics += 1
        if result.metrics.flesch_kincaid_grade is not None:
            available_metrics += 1
        if result.metrics.gunning_fog_index is not None:
            available_metrics += 1
        if result.metrics.automated_readability_index is not None:
            available_metrics += 1

        if available_metrics >= 3:
            confidence_factors.append(0.9)
        elif available_metrics >= 2:
            confidence_factors.append(0.7)
        else:
            confidence_factors.append(0.5)

        # Reading level assessment confidence
        confidence_factors.append(result.reading_level.confidence_score)

        # AI analysis confidence
        if result.ai_analysis:
            confidence_factors.append(0.8)

        return sum(confidence_factors) / len(confidence_factors)

    def _compile_readability_statistics(
        self, result: ReadabilityAnalysisResult, text: str
    ) -> Dict[str, Any]:
        """Compile comprehensive readability analysis statistics"""
        return {
            "analysis_summary": {
                "reading_level": result.reading_level.primary_level.value,
                "accessibility_score": result.accessibility.overall_accessibility,
                "word_count": result.metrics.word_count,
                "sentence_count": result.metrics.sentence_count,
                "avg_sentence_length": result.metrics.avg_sentence_length,
                "difficult_words_ratio": result.metrics.difficult_words_ratio,
            },
            "readability_scores": {
                "flesch_reading_ease": result.metrics.flesch_reading_ease,
                "flesch_kincaid_grade": result.metrics.flesch_kincaid_grade,
                "gunning_fog_index": result.metrics.gunning_fog_index,
                "automated_readability_index": result.metrics.automated_readability_index,
                "coleman_liau_index": result.metrics.coleman_liau_index,
                "dale_chall_score": result.metrics.dale_chall_score,
            },
            "complexity_metrics": {
                "avg_syllables_per_word": result.metrics.avg_syllables_per_word,
                "complex_words_ratio": result.metrics.complex_words_ratio,
                "vocabulary_diversity": result.metrics.vocabulary_diversity,
                "jargon_ratio": result.metrics.jargon_ratio,
                "technical_terms_count": result.metrics.technical_terms_count,
            },
            "accessibility_breakdown": {
                "sentence_complexity": result.accessibility.sentence_complexity,
                "vocabulary_difficulty": result.accessibility.vocabulary_difficulty,
                "structure_clarity": result.accessibility.structure_clarity,
                "plain_language_score": result.accessibility.plain_language_score,
                "clarity_score": result.accessibility.clarity_score,
            },
            "audience_analysis": {
                "suitable_audiences": [
                    audience.value
                    for audience in result.reading_level.suitable_audiences
                ],
                "grade_level_range": result.reading_level.grade_level_range,
                "accessibility_barriers": len(result.accessibility.barriers),
                "improvement_areas": len(result.accessibility.improvements_needed),
            },
        }

    def get_analyzer_info(self) -> Dict[str, Any]:
        """Get comprehensive analyzer information"""
        return {
            "analyzer_version": "1.0.0",
            "ollama_model": self.ollama_model,
            "ai_enhancement_enabled": self.use_ai_enhancement,
            "supported_reading_levels": [level.value for level in ReadingLevel],
            "supported_audience_types": [audience.value for audience in AudienceType],
            "analysis_features": {
                "readability_metrics": True,
                "reading_level_assessment": True,
                "accessibility_evaluation": self.enable_accessibility_analysis,
                "ai_enhancement": self.use_ai_enhancement and aiohttp is not None,
                "textstat_integration": flesch_reading_ease is not None,
            },
            "configuration": {
                "target_reading_level": self.target_reading_level.value,
                "accessibility_analysis_enabled": self.enable_accessibility_analysis,
            },
            "available_metrics": {
                "flesch_reading_ease": flesch_reading_ease is not None,
                "flesch_kincaid_grade": flesch_kincaid_grade is not None,
                "gunning_fog": gunning_fog is not None,
                "automated_readability_index": automated_readability_index is not None,
                "coleman_liau_index": coleman_liau_index is not None,
                "dale_chall_readability": dale_chall_readability_score is not None,
            },
        }

    async def close(self):
        """Close analyzer and cleanup resources"""
        self.logger.info("ReadabilityAnalyzer closed")

# Factory function
def create_readability_analyzer(
    config: Optional[Dict[str, Any]] = None,
    llm_config: Optional[LLMConfiguration] = None,
) -> ReadabilityAnalyzer:
    """Create ReadabilityAnalyzer instance with configuration"""
    if config is None:
        config = {}

    target_level = config.get("target_reading_level", "high_school")
    if isinstance(target_level, str):
        target_level = ReadingLevel(target_level)

    # Use centralized LLM config if available
    if llm_config:
        return ReadabilityAnalyzer(
            llm_config=llm_config,
            target_reading_level=target_level,
            use_ai_enhancement=config.get("use_ai_enhancement", True),
            enable_accessibility_analysis=config.get(
                "enable_accessibility_analysis", True
            ),
            enable_advanced_prompting=config.get("enable_advanced_prompting", True),
        )

    return ReadabilityAnalyzer(
        ollama_base_url=config.get("ollama_base_url", "http://localhost:11434"),
        ollama_model=config.get("ollama_model", "llama3.2:3b"),
        ollama_timeout=config.get("ollama_timeout", 120.0),
        use_ai_enhancement=config.get("use_ai_enhancement", True),
        target_reading_level=target_level,
        enable_accessibility_analysis=config.get("enable_accessibility_analysis", True),
    )
