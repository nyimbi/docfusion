#!/usr/bin/env python3
"""
Style Analyzer with Ollama Integration

Advanced writing style and tone analysis with AI-powered insights for comprehensive
document understanding and stylistic assessment.
"""

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple
from ...core.utils import uuid7str
import time

try:
    from ...prompting_strategies import (
        create_chain_of_thought_prompt,
        create_tree_of_thought_prompt,
        filter_thinking_tags,
    )
except ImportError:
    try:
        from ..prompting_strategies import (
            create_chain_of_thought_prompt,
            create_tree_of_thought_prompt,
            filter_thinking_tags,
        )
    except ImportError:
        # Fallback implementations
        def create_chain_of_thought_prompt(
            task, context, reasoning_steps, output_format=None, examples=None
        ):
            return f"{task}\n\nContext: {context}\n\nThink step by step:\n" + "\n".join(
                f"{i + 1}. {step}" for i, step in enumerate(reasoning_steps)
            )

        def create_tree_of_thought_prompt(problem, branches, depth=2):
            prompt = f"Problem: {problem}\n\nExplore multiple approaches:\n"
            for i, branch in enumerate(branches[:3]):
                prompt += f"\nApproach {i + 1}: {branch}\n"
            return prompt

        def filter_thinking_tags(text: str) -> str:
            if not text or not isinstance(text, str):
                return text
            cleaned = re.sub(
                r"<think\s*>.*?</think\s*>", "", text, flags=re.DOTALL | re.IGNORECASE
            )
            return re.sub(r"\n\s*\n\s*\n", "\n\n", cleaned).strip()

try:
    from ...config.llm_config import LLMConfiguration, LLMTask, get_llm_config
except ImportError:
    try:
        from ..config.llm_config import LLMConfiguration, LLMTask, get_llm_config
    except ImportError:
        # Fallback for missing config system
        class LLMTask:
            STYLE_ANALYSIS = "style_analysis"

        class LLMConfiguration:
            def __init__(self):
                self.model = "deepseek-r1:32b"
                self.base_url = "http://localhost:11434"
                self.timeout = 120.0
                self.temperature = 0.1
                self.top_p = 0.9
                self.num_predict = 1500

        def get_llm_config(task):
            return LLMConfiguration()

try:
    import aiohttp
    from aiohttp import ClientError, ClientTimeout
except ImportError:
    aiohttp = None

try:
    from textstat import (
        automated_readability_index,
        flesch_kincaid_grade,
        flesch_reading_ease,
    )
except ImportError:
    flesch_reading_ease = flesch_kincaid_grade = automated_readability_index = None

class WritingTone(Enum):
    """Writing tone classifications"""

    FORMAL = "formal"
    INFORMAL = "informal"
    TECHNICAL = "technical"
    PERSUASIVE = "persuasive"
    NEUTRAL = "neutral"
    AUTHORITATIVE = "authoritative"
    CONVERSATIONAL = "conversational"
    ACADEMIC = "academic"

class WritingStyle(Enum):
    """Writing style classifications"""

    DESCRIPTIVE = "descriptive"
    NARRATIVE = "narrative"
    EXPOSITORY = "expository"
    ARGUMENTATIVE = "argumentative"
    ANALYTICAL = "analytical"
    INSTRUCTIONAL = "instructional"
    COMPARATIVE = "comparative"
    TECHNICAL_SPECIFICATION = "technical_specification"

@dataclass
class StyleMetrics:
    """Comprehensive style analysis metrics"""

    # Basic metrics
    word_count: int = 0
    sentence_count: int = 0
    paragraph_count: int = 0
    avg_words_per_sentence: float = 0.0
    avg_sentences_per_paragraph: float = 0.0

    # Complexity metrics
    complex_words_ratio: float = 0.0
    passive_voice_ratio: float = 0.0
    subordinate_clause_ratio: float = 0.0
    conjunction_usage_ratio: float = 0.0

    # Readability scores
    flesch_reading_ease: Optional[float] = None
    flesch_kincaid_grade: Optional[float] = None
    automated_readability_index: Optional[float] = None

    # Vocabulary analysis
    unique_words_ratio: float = 0.0
    technical_terms_ratio: float = 0.0
    business_terms_ratio: float = 0.0
    action_words_ratio: float = 0.0

    # Stylistic patterns
    question_ratio: float = 0.0
    exclamation_ratio: float = 0.0
    first_person_ratio: float = 0.0
    second_person_ratio: float = 0.0
    third_person_ratio: float = 0.0

    # Confidence and uncertainty
    certainty_words_ratio: float = 0.0
    uncertainty_words_ratio: float = 0.0
    modal_verbs_ratio: float = 0.0

@dataclass
class ToneAnalysis:
    """Detailed tone analysis results"""

    primary_tone: WritingTone = WritingTone.NEUTRAL
    secondary_tones: List[WritingTone] = field(default_factory=list)
    confidence_score: float = 0.0

    # Tone indicators
    formality_score: float = 0.0  # 0.0 = informal, 1.0 = formal
    authority_score: float = 0.0  # 0.0 = tentative, 1.0 = authoritative
    emotion_score: float = 0.0  # 0.0 = neutral, 1.0 = highly emotional
    persuasiveness_score: float = 0.0  # 0.0 = factual, 1.0 = highly persuasive

    # Supporting evidence
    tone_indicators: Dict[str, List[str]] = field(default_factory=dict)
    linguistic_features: Dict[str, float] = field(default_factory=dict)

@dataclass
class StyleAnalysis:
    """Comprehensive writing style analysis"""

    primary_style: WritingStyle = WritingStyle.EXPOSITORY
    style_confidence: float = 0.0

    # Style characteristics
    descriptiveness: float = 0.0
    argumentativeness: float = 0.0
    technicality: float = 0.0
    clarity: float = 0.0
    conciseness: float = 0.0

    # Style patterns
    structure_patterns: List[str] = field(default_factory=list)
    rhetorical_devices: List[str] = field(default_factory=list)
    writing_techniques: List[str] = field(default_factory=list)

@dataclass
class StyleAnalysisResult:
    """Complete style analysis result"""

    success: bool = False
    analysis_id: str = field(default_factory=uuid7str)

    # Core analysis components
    metrics: StyleMetrics = field(default_factory=StyleMetrics)
    tone_analysis: ToneAnalysis = field(default_factory=ToneAnalysis)
    style_analysis: StyleAnalysis = field(default_factory=StyleAnalysis)

    # AI-enhanced insights
    ai_analysis: Optional[Dict[str, Any]] = None
    style_recommendations: List[str] = field(default_factory=list)
    improvement_suggestions: List[str] = field(default_factory=list)

    # Analysis metadata
    processing_time: float = 0.0
    confidence_score: float = 0.0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    # Statistical summaries
    statistics: Dict[str, Any] = field(default_factory=dict)

class StyleAnalyzer:
    """Advanced style analyzer with Ollama AI enhancement"""

    def __init__(
        self,
        llm_config: Optional[LLMConfiguration] = None,
        use_ai_enhancement: bool = True,
        enable_detailed_analysis: bool = True,
        custom_vocabularies: Optional[Dict[str, Set[str]]] = None,
    ):
        # Load centralized LLM configuration
        self.llm_config = llm_config or get_llm_config(LLMTask.STYLE_ANALYSIS)
        self.use_ai_enhancement = use_ai_enhancement
        self.enable_detailed_analysis = enable_detailed_analysis
        self.logger = logging.getLogger(__name__)

        # Initialize vocabularies
        self._initialize_vocabularies(custom_vocabularies)

        # Compile patterns for performance
        self._compile_patterns()

        self.logger.info(
            f"StyleAnalyzer initialized with model: {self.llm_config.model} from centralized config"
        )

    def _initialize_vocabularies(
        self, custom_vocabularies: Optional[Dict[str, Set[str]]]
    ):
        """Initialize specialized word vocabularies"""
        self.vocabularies = custom_vocabularies or {}

        # Technical terms vocabulary
        if "technical_terms" not in self.vocabularies:
            self.vocabularies["technical_terms"] = {
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
                "application",
                "deployment",
                "authentication",
                "authorization",
                "encryption",
                "validation",
            }

        # Business terms vocabulary
        if "business_terms" not in self.vocabularies:
            self.vocabularies["business_terms"] = {
                "stakeholder",
                "deliverable",
                "milestone",
                "requirement",
                "objective",
                "strategy",
                "initiative",
                "investment",
                "roi",
                "kpi",
                "metrics",
                "compliance",
                "governance",
                "vendor",
                "procurement",
                "budget",
                "timeline",
                "deadline",
                "proposal",
                "contract",
                "agreement",
            }

        # Action words vocabulary
        if "action_words" not in self.vocabularies:
            self.vocabularies["action_words"] = {
                "implement",
                "develop",
                "create",
                "design",
                "build",
                "establish",
                "execute",
                "deliver",
                "achieve",
                "provide",
                "ensure",
                "maintain",
                "optimize",
                "enhance",
                "improve",
                "support",
                "manage",
                "coordinate",
                "facilitate",
                "enable",
                "integrate",
                "deploy",
                "configure",
                "validate",
            }

        # Certainty indicators
        if "certainty_words" not in self.vocabularies:
            self.vocabularies["certainty_words"] = {
                "will",
                "must",
                "shall",
                "definitely",
                "certainly",
                "absolutely",
                "clearly",
                "obviously",
                "undoubtedly",
                "guaranteed",
                "proven",
                "established",
                "confirmed",
                "verified",
                "demonstrated",
                "ensures",
            }

        # Uncertainty indicators
        if "uncertainty_words" not in self.vocabularies:
            self.vocabularies["uncertainty_words"] = {
                "might",
                "may",
                "could",
                "possibly",
                "perhaps",
                "potentially",
                "likely",
                "probably",
                "seems",
                "appears",
                "suggests",
                "indicates",
                "approximately",
                "roughly",
                "estimated",
                "expected",
                "anticipated",
            }

        # Modal verbs
        if "modal_verbs" not in self.vocabularies:
            self.vocabularies["modal_verbs"] = {
                "can",
                "could",
                "may",
                "might",
                "will",
                "would",
                "shall",
                "should",
                "must",
                "ought",
                "need",
                "dare",
                "used",
            }

    def _compile_patterns(self):
        """Compile regex patterns for efficient analysis"""
        self.patterns = {
            "sentences": re.compile(r"[.!?]+\s+"),
            "paragraphs": re.compile(r"\n\s*\n"),
            "complex_words": re.compile(r"\b\w{7,}\b", re.IGNORECASE),
            "passive_voice": re.compile(
                r"\b(?:is|are|was|were|be|been|being)\s+\w*ed\b", re.IGNORECASE
            ),
            "subordinate_clauses": re.compile(
                r"\b(?:because|since|although|while|if|when|unless|until)\b",
                re.IGNORECASE,
            ),
            "conjunctions": re.compile(
                r"\b(?:and|but|or|nor|for|so|yet|however|therefore|moreover|furthermore)\b",
                re.IGNORECASE,
            ),
            "questions": re.compile(r"\?"),
            "exclamations": re.compile(r"!"),
            "first_person": re.compile(
                r"\b(?:I|we|me|us|my|our|mine|ours)\b", re.IGNORECASE
            ),
            "second_person": re.compile(r"\b(?:you|your|yours)\b", re.IGNORECASE),
            "third_person": re.compile(
                r"\b(?:he|she|it|they|him|her|them|his|hers|its|their|theirs)\b",
                re.IGNORECASE,
            ),
        }

    async def analyze_style(
        self,
        text: str,
        use_ai: Optional[bool] = None,
        detailed_analysis: Optional[bool] = None,
    ) -> StyleAnalysisResult:
        """Perform comprehensive style analysis"""
        start_time = time.monotonic()
        result = StyleAnalysisResult()

        try:
            assert text and text.strip(), "Text content is required"

            use_ai = use_ai if use_ai is not None else self.use_ai_enhancement
            detailed = (
                detailed_analysis
                if detailed_analysis is not None
                else self.enable_detailed_analysis
            )

            # Step 1: Calculate basic metrics
            result.metrics = await self._calculate_style_metrics(text)

            # Step 2: Analyze tone
            result.tone_analysis = await self._analyze_tone(text, detailed)

            # Step 3: Analyze writing style
            result.style_analysis = await self._analyze_writing_style(text, detailed)

            # Step 4: AI-enhanced analysis (if enabled)
            if use_ai and aiohttp:
                try:
                    result.ai_analysis = await self._ai_enhanced_analysis(text)
                    result.style_recommendations = (
                        await self._generate_style_recommendations(text, result)
                    )
                    result.improvement_suggestions = (
                        await self._generate_improvement_suggestions(text, result)
                    )
                except Exception as e:
                    result.warnings.append(f"AI analysis failed: {str(e)}")
                    self.logger.warning(f"AI analysis failed: {e}")

            # Step 5: Calculate overall confidence and statistics
            result.confidence_score = self._calculate_overall_confidence(result)
            result.statistics = self._compile_statistics(result)

            result.success = True
            result.processing_time = time.monotonic() - start_time

            self.logger.info(
                f"Style analysis completed, confidence: {result.confidence_score:.3f}"
            )

        except Exception as e:
            result.errors.append(f"Style analysis failed: {str(e)}")
            self.logger.error(f"Style analysis error: {e}")

        return result

    async def _calculate_style_metrics(self, text: str) -> StyleMetrics:
        """Calculate comprehensive style metrics"""
        metrics = StyleMetrics()

        # Basic counts
        words = text.split()
        metrics.word_count = len(words)

        sentences = self.patterns["sentences"].split(text)
        sentences = [s.strip() for s in sentences if s.strip()]
        metrics.sentence_count = len(sentences)

        paragraphs = self.patterns["paragraphs"].split(text)
        paragraphs = [p.strip() for p in paragraphs if p.strip()]
        metrics.paragraph_count = len(paragraphs)

        # Averages
        if metrics.sentence_count > 0:
            metrics.avg_words_per_sentence = metrics.word_count / metrics.sentence_count

        if metrics.paragraph_count > 0:
            metrics.avg_sentences_per_paragraph = (
                metrics.sentence_count / metrics.paragraph_count
            )

        # Complexity metrics
        if metrics.word_count > 0:
            complex_words = len(self.patterns["complex_words"].findall(text))
            metrics.complex_words_ratio = complex_words / metrics.word_count

            passive_constructions = len(self.patterns["passive_voice"].findall(text))
            metrics.passive_voice_ratio = (
                passive_constructions / metrics.sentence_count
                if metrics.sentence_count > 0
                else 0
            )

            subordinate_clauses = len(
                self.patterns["subordinate_clauses"].findall(text)
            )
            metrics.subordinate_clause_ratio = (
                subordinate_clauses / metrics.sentence_count
                if metrics.sentence_count > 0
                else 0
            )

            conjunctions = len(self.patterns["conjunctions"].findall(text))
            metrics.conjunction_usage_ratio = conjunctions / metrics.word_count

        # Readability scores (if textstat available)
        if flesch_reading_ease:
            try:
                metrics.flesch_reading_ease = flesch_reading_ease(text)
                metrics.flesch_kincaid_grade = flesch_kincaid_grade(text)
                metrics.automated_readability_index = automated_readability_index(text)
            except (ValueError, TypeError, ZeroDivisionError) as e:
                self.logger.warning(f"Readability score calculation failed: {e}")

        # Vocabulary analysis
        if metrics.word_count > 0:
            unique_words = set(word.lower().strip('.,!?;:"()[]{}') for word in words)
            metrics.unique_words_ratio = len(unique_words) / metrics.word_count

            # Count specialized vocabulary
            text_lower = text.lower()

            tech_count = sum(
                1 for term in self.vocabularies["technical_terms"] if term in text_lower
            )
            metrics.technical_terms_ratio = tech_count / metrics.word_count

            business_count = sum(
                1 for term in self.vocabularies["business_terms"] if term in text_lower
            )
            metrics.business_terms_ratio = business_count / metrics.word_count

            action_count = sum(
                1 for term in self.vocabularies["action_words"] if term in text_lower
            )
            metrics.action_words_ratio = action_count / metrics.word_count

        # Stylistic patterns
        if metrics.sentence_count > 0:
            questions = len(self.patterns["questions"].findall(text))
            metrics.question_ratio = questions / metrics.sentence_count

            exclamations = len(self.patterns["exclamations"].findall(text))
            metrics.exclamation_ratio = exclamations / metrics.sentence_count

        if metrics.word_count > 0:
            first_person = len(self.patterns["first_person"].findall(text))
            metrics.first_person_ratio = first_person / metrics.word_count

            second_person = len(self.patterns["second_person"].findall(text))
            metrics.second_person_ratio = second_person / metrics.word_count

            third_person = len(self.patterns["third_person"].findall(text))
            metrics.third_person_ratio = third_person / metrics.word_count

        # Confidence and uncertainty indicators
        if metrics.word_count > 0:
            text_words = set(word.lower().strip('.,!?;:"()[]{}') for word in words)

            certainty_count = len(text_words & self.vocabularies["certainty_words"])
            metrics.certainty_words_ratio = certainty_count / metrics.word_count

            uncertainty_count = len(text_words & self.vocabularies["uncertainty_words"])
            metrics.uncertainty_words_ratio = uncertainty_count / metrics.word_count

            modal_count = len(text_words & self.vocabularies["modal_verbs"])
            metrics.modal_verbs_ratio = modal_count / metrics.word_count

        return metrics

    async def _analyze_tone(self, text: str, detailed: bool) -> ToneAnalysis:
        """Analyze writing tone characteristics"""
        analysis = ToneAnalysis()

        # Calculate formality score based on multiple indicators
        formality_indicators = []

        # Vocabulary formality (technical/business terms vs informal language)
        text_lower = text.lower()
        formal_vocab_count = sum(
            1 for term in self.vocabularies["technical_terms"] if term in text_lower
        ) + sum(1 for term in self.vocabularies["business_terms"] if term in text_lower)

        words = text.split()
        if len(words) > 0:
            formal_vocab_ratio = formal_vocab_count / len(words)
            formality_indicators.append(
                min(formal_vocab_ratio * 10, 1.0)
            )  # Scale to 0-1

        # Sentence structure formality (longer sentences, complex structures)
        if hasattr(self, "_last_metrics"):
            avg_sentence_length = self._last_metrics.avg_words_per_sentence
            # Longer sentences generally indicate more formal writing
            sentence_formality = min(
                avg_sentence_length / 20, 1.0
            )  # Scale with 20 words as baseline
            formality_indicators.append(sentence_formality)

        # Personal pronouns (fewer = more formal)
        first_person_count = len(self.patterns["first_person"].findall(text))
        second_person_count = len(self.patterns["second_person"].findall(text))
        personal_pronoun_ratio = (
            (first_person_count + second_person_count) / len(words)
            if len(words) > 0
            else 0
        )
        pronoun_formality = 1.0 - min(
            personal_pronoun_ratio * 20, 1.0
        )  # Inverse relationship
        formality_indicators.append(pronoun_formality)

        # Calculate overall formality score
        analysis.formality_score = (
            sum(formality_indicators) / len(formality_indicators)
            if formality_indicators
            else 0.5
        )

        # Calculate authority score
        authority_indicators = []

        # Certainty vs uncertainty language
        certainty_ratio = (
            sum(
                1 for word in self.vocabularies["certainty_words"] if word in text_lower
            )
            / len(words)
            if len(words) > 0
            else 0
        )
        uncertainty_ratio = (
            sum(
                1
                for word in self.vocabularies["uncertainty_words"]
                if word in text_lower
            )
            / len(words)
            if len(words) > 0
            else 0
        )

        authority_from_certainty = min(certainty_ratio * 20, 1.0) - min(
            uncertainty_ratio * 10, 0.5
        )
        authority_indicators.append(max(authority_from_certainty, 0))

        # Action words (indicate decisiveness)
        action_ratio = (
            sum(1 for word in self.vocabularies["action_words"] if word in text_lower)
            / len(words)
            if len(words) > 0
            else 0
        )
        authority_indicators.append(min(action_ratio * 15, 1.0))

        analysis.authority_score = (
            sum(authority_indicators) / len(authority_indicators)
            if authority_indicators
            else 0.5
        )

        # Calculate emotion score (questions, exclamations, emotional language)
        emotion_indicators = []

        question_count = len(self.patterns["questions"].findall(text))
        exclamation_count = len(self.patterns["exclamations"].findall(text))
        sentence_count = len(self.patterns["sentences"].split(text))

        if sentence_count > 0:
            punctuation_emotion = (
                question_count + exclamation_count * 2
            ) / sentence_count
            emotion_indicators.append(min(punctuation_emotion, 1.0))

        analysis.emotion_score = (
            sum(emotion_indicators) / len(emotion_indicators)
            if emotion_indicators
            else 0.2
        )

        # Calculate persuasiveness score
        persuasive_indicators = []

        # Second person usage (direct address)
        you_count = len(re.findall(r"\byou\b", text_lower))
        persuasive_indicators.append(
            min(you_count / len(words) * 30, 1.0) if len(words) > 0 else 0
        )

        # Action words (call to action)
        persuasive_indicators.append(min(action_ratio * 10, 1.0))

        analysis.persuasiveness_score = (
            sum(persuasive_indicators) / len(persuasive_indicators)
            if persuasive_indicators
            else 0.3
        )

        # Determine primary tone based on scores
        tone_scores = {
            WritingTone.FORMAL: analysis.formality_score,
            WritingTone.AUTHORITATIVE: analysis.authority_score,
            WritingTone.PERSUASIVE: analysis.persuasiveness_score,
            WritingTone.TECHNICAL: min(formal_vocab_ratio * 8, 1.0)
            if len(words) > 0
            else 0,
            WritingTone.CONVERSATIONAL: 1.0
            - analysis.formality_score
            + analysis.emotion_score * 0.5,
        }

        # Find primary and secondary tones
        sorted_tones = sorted(tone_scores.items(), key=lambda x: x[1], reverse=True)
        analysis.primary_tone = sorted_tones[0][0]
        analysis.confidence_score = sorted_tones[0][1]

        # Add secondary tones that score above threshold
        for tone, score in sorted_tones[1:]:
            if score > 0.6:
                analysis.secondary_tones.append(tone)

        # Store linguistic features for detailed analysis
        if detailed:
            analysis.linguistic_features = {
                "formality_score": analysis.formality_score,
                "authority_score": analysis.authority_score,
                "emotion_score": analysis.emotion_score,
                "persuasiveness_score": analysis.persuasiveness_score,
                "formal_vocab_ratio": formal_vocab_ratio if len(words) > 0 else 0,
                "personal_pronoun_ratio": personal_pronoun_ratio,
                "certainty_ratio": certainty_ratio,
                "uncertainty_ratio": uncertainty_ratio,
            }

        return analysis

    async def _analyze_writing_style(self, text: str, detailed: bool) -> StyleAnalysis:
        """Analyze overall writing style characteristics"""
        analysis = StyleAnalysis()

        words = text.split()
        word_count = len(words)

        if word_count == 0:
            return analysis

        # Calculate style dimensions

        # Descriptiveness (adjectives, detailed descriptions)
        descriptive_patterns = re.findall(
            r"\b(?:detailed|comprehensive|extensive|thorough|specific|precise)\b",
            text.lower(),
        )
        adjective_pattern = re.compile(
            r"\b(?:\w+ly\s+\w+|\w+(?:ive|ous|ful|ing|ed)\s+\w+)\b", re.IGNORECASE
        )
        adjectives = len(adjective_pattern.findall(text))
        analysis.descriptiveness = min(
            (len(descriptive_patterns) + adjectives * 0.1) / word_count * 100, 1.0
        )

        # Argumentativeness (reasoning words, evidence presentation)
        argument_words = [
            "therefore",
            "because",
            "since",
            "however",
            "moreover",
            "furthermore",
            "consequently",
            "thus",
            "hence",
        ]
        argument_count = sum(text.lower().count(word) for word in argument_words)
        analysis.argumentativeness = min(argument_count / word_count * 50, 1.0)

        # Technicality (technical vocabulary, specifications)
        tech_terms = sum(
            1 for term in self.vocabularies["technical_terms"] if term in text.lower()
        )
        analysis.technicality = min(tech_terms / word_count * 20, 1.0)

        # Clarity (sentence structure, direct language)
        avg_sentence_length = word_count / max(
            len(self.patterns["sentences"].split(text)), 1
        )
        clarity_score = 1.0 - min(
            avg_sentence_length / 30, 0.7
        )  # Shorter sentences = clearer

        # Reduce clarity for excessive passive voice
        passive_count = len(self.patterns["passive_voice"].findall(text))
        sentence_count = len(self.patterns["sentences"].split(text))
        if sentence_count > 0:
            passive_penalty = (passive_count / sentence_count) * 0.3
            clarity_score = max(clarity_score - passive_penalty, 0.1)

        analysis.clarity = clarity_score

        # Conciseness (word efficiency, directness)
        filler_words = [
            "very",
            "really",
            "quite",
            "rather",
            "somewhat",
            "actually",
            "basically",
            "essentially",
        ]
        filler_count = sum(text.lower().count(word) for word in filler_words)
        conciseness_penalty = min(filler_count / word_count * 10, 0.4)
        analysis.conciseness = max(
            1.0 - conciseness_penalty - (avg_sentence_length / 40), 0.1
        )

        # Determine primary style based on characteristics
        style_scores = {
            WritingStyle.TECHNICAL_SPECIFICATION: analysis.technicality * 0.7
            + analysis.clarity * 0.3,
            WritingStyle.ARGUMENTATIVE: analysis.argumentativeness * 0.8
            + analysis.clarity * 0.2,
            WritingStyle.ANALYTICAL: analysis.argumentativeness * 0.4
            + analysis.technicality * 0.4
            + analysis.clarity * 0.2,
            WritingStyle.DESCRIPTIVE: analysis.descriptiveness * 0.8
            + analysis.clarity * 0.2,
            WritingStyle.EXPOSITORY: analysis.clarity * 0.5
            + analysis.conciseness * 0.3
            + analysis.argumentativeness * 0.2,
            WritingStyle.INSTRUCTIONAL: analysis.clarity * 0.6
            + analysis.conciseness * 0.4,
        }

        sorted_styles = sorted(style_scores.items(), key=lambda x: x[1], reverse=True)
        analysis.primary_style = sorted_styles[0][0]
        analysis.style_confidence = sorted_styles[0][1]

        # Identify structure patterns
        if detailed:
            structure_patterns = []

            if text.count("\n") > 3:
                structure_patterns.append("Multi-paragraph structure")

            if re.search(r"\b(?:first|second|third|finally|lastly)\b", text.lower()):
                structure_patterns.append("Sequential organization")

            if re.search(r"\b(?:\d+\.|•|\*)\s", text):
                structure_patterns.append("Bulleted or numbered lists")

            if re.search(r"\b(?:introduction|conclusion|summary)\b", text.lower()):
                structure_patterns.append("Formal document structure")

            analysis.structure_patterns = structure_patterns

        return analysis

    async def _ai_enhanced_analysis(self, text: str) -> Dict[str, Any]:
        """Perform AI-enhanced style analysis using Ollama with Chain-of-Thought prompting"""
        if not aiohttp:
            raise ImportError("aiohttp required for AI analysis")

        # Create Chain-of-Thought prompt for comprehensive style analysis
        task = "Analyze the writing style and tone of the provided text comprehensively"
        context = f"Text to analyze (first 3000 chars): {text[:3000]}{'...' if len(text) > 3000 else ''}"

        reasoning_steps = [
            "Examine the vocabulary choices and word complexity",
            "Analyze sentence structure, length, and complexity patterns",
            "Identify tone indicators (formal/informal language, certainty markers, emotional expressions)",
            "Assess writing style characteristics (descriptive, argumentative, technical, instructional)",
            "Evaluate audience appropriateness and engagement level",
            "Determine overall quality and provide specific improvement recommendations",
        ]

        output_format = """JSON format:
{
	"tone_assessment": {
		"primary_tone": "string",
		"tone_confidence": 0.0-1.0,
		"tone_explanation": "string"
	},
	"style_characteristics": {
		"clarity": 0.0-1.0,
		"conciseness": 0.0-1.0,
		"formality": 0.0-1.0,
		"engagement": 0.0-1.0
	},
	"audience_fit": {
		"target_audience": "string",
		"appropriateness_score": 0.0-1.0
	},
	"recommendations": ["string"],
	"overall_quality": 0.0-1.0
}"""

        examples = [
            "For formal business text: high formality (0.8+), technical tone, clear recommendations",
            "For casual content: lower formality (0.3-), conversational tone, engagement focus",
        ]

        prompt = create_chain_of_thought_prompt(
            task=task,
            context=context,
            reasoning_steps=reasoning_steps,
            output_format=output_format,
            examples=examples,
        )

        timeout = ClientTimeout(total=self.llm_config.timeout)

        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                f"{self.llm_config.base_url}/api/generate",
                json={
                    "model": self.llm_config.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": self.llm_config.to_ollama_options(),
                },
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    ai_response = result.get("response", "").strip()

                    # Filter thinking tags if enabled in config
                    if self.llm_config.enable_thinking_filter:
                        ai_response = filter_thinking_tags(ai_response)

                    # Parse JSON response
                    try:
                        return json.loads(ai_response)
                    except json.JSONDecodeError:
                        # Fallback: extract insights from text response
                        return {
                            "raw_response": ai_response,
                            "tone_assessment": {
                                "primary_tone": "analysis_available",
                                "tone_confidence": 0.7,
                            },
                            "recommendations": [
                                "Review AI analysis in raw_response field"
                            ],
                        }
                else:
                    raise Exception(f"Ollama API error: {response.status}")

    async def _generate_style_recommendations(
        self, text: str, analysis: StyleAnalysisResult
    ) -> List[str]:
        """Generate style improvement recommendations using advanced analysis"""
        recommendations = []

        # Use Tree-of-Thought approach for comprehensive recommendations
        branches = [
            "Analyze readability and sentence structure issues",
            "Evaluate tone consistency and appropriateness",
            "Assess vocabulary usage and variety",
            "Review structural and organizational aspects",
        ]

        # Readability recommendations with detailed analysis
        if (
            analysis.metrics.flesch_reading_ease
            and analysis.metrics.flesch_reading_ease < 30
        ):
            recommendations.append(
                "Consider simplifying sentence structure for better readability (current Flesch score indicates difficult reading level)"
            )

        if analysis.metrics.avg_words_per_sentence > 25:
            recommendations.append(
                f"Break up long sentences to improve clarity (average {analysis.metrics.avg_words_per_sentence:.1f} words per sentence)"
            )

        # Tone recommendations with contextual awareness
        if (
            analysis.tone_analysis.formality_score < 0.3
            and analysis.metrics.business_terms_ratio > 0.05
        ):
            recommendations.append(
                "Maintain consistent formal tone throughout business content (detected business terminology with informal language)"
            )

        if analysis.tone_analysis.authority_score < 0.4:
            recommendations.append(
                "Use more decisive language and reduce uncertainty markers to increase authority"
            )

        # Style recommendations with specific guidance
        if analysis.style_analysis.clarity < 0.6:
            clarity_issues = []
            if analysis.metrics.passive_voice_ratio > 0.3:
                clarity_issues.append("excessive passive voice")
            if analysis.metrics.avg_words_per_sentence > 20:
                clarity_issues.append("complex sentence structure")

            if clarity_issues:
                recommendations.append(
                    f"Improve clarity by addressing: {', '.join(clarity_issues)}"
                )
            else:
                recommendations.append(
                    "Improve clarity by using more direct language and concrete examples"
                )

        if analysis.metrics.passive_voice_ratio > 0.3:
            recommendations.append(
                f"Reduce passive voice usage for more engaging writing (currently {analysis.metrics.passive_voice_ratio:.1%} of content)"
            )

        # Advanced vocabulary recommendations
        if analysis.metrics.unique_words_ratio < 0.4:
            recommendations.append(
                f"Expand vocabulary to avoid repetitive language (unique word ratio: {analysis.metrics.unique_words_ratio:.1%})"
            )

        # Context-specific recommendations based on detected style
        if analysis.style_analysis.primary_style.value == "technical_specification":
            if analysis.metrics.technical_terms_ratio < 0.03:
                recommendations.append(
                    "Include more specific technical terminology for technical specification style"
                )

        if analysis.style_analysis.primary_style.value == "persuasive":
            if analysis.metrics.second_person_ratio < 0.01:
                recommendations.append(
                    "Consider using direct address (you/your) to enhance persuasive impact"
                )

        return recommendations

    async def _generate_improvement_suggestions(
        self, text: str, analysis: StyleAnalysisResult
    ) -> List[str]:
        """Generate specific improvement suggestions using Chain-of-Thought analysis"""
        suggestions = []

        # Chain-of-Thought approach: analyze structure, engagement, style-specific needs

        # Step 1: Structural improvements
        if analysis.metrics.paragraph_count < 3 and len(text) > 500:
            suggestions.append(
                "Break content into multiple paragraphs for better organization and readability"
            )

        if analysis.metrics.sentence_count > 0:
            if analysis.metrics.avg_sentences_per_paragraph > 8:
                suggestions.append(
                    "Consider shorter paragraphs (currently averaging 8+ sentences per paragraph)"
                )

        # Step 2: Engagement and readability improvements
        if (
            analysis.metrics.question_ratio == 0
            and analysis.tone_analysis.persuasiveness_score > 0.6
        ):
            suggestions.append(
                "Consider adding rhetorical questions to engage readers and enhance persuasive impact"
            )

        if (
            analysis.metrics.exclamation_ratio == 0
            and analysis.tone_analysis.emotion_score < 0.2
        ):
            if analysis.style_analysis.primary_style in [
                WritingStyle.PERSUASIVE,
                WritingStyle.ARGUMENTATIVE,
            ]:
                suggestions.append(
                    "Add occasional emphasis to strengthen emotional connection with readers"
                )

        # Step 3: Style-specific improvements with reasoning
        if (
            analysis.style_analysis.primary_style
            == WritingStyle.TECHNICAL_SPECIFICATION
        ):
            if analysis.metrics.technical_terms_ratio < 0.03:
                suggestions.append(
                    "Include more specific technical terminology and precise specifications for technical content"
                )
            if analysis.style_analysis.clarity < 0.7:
                suggestions.append(
                    "Enhance technical clarity with step-by-step explanations and concrete examples"
                )

        if analysis.style_analysis.primary_style == WritingStyle.ARGUMENTATIVE:
            if analysis.metrics.conjunction_usage_ratio < 0.02:
                suggestions.append(
                    "Strengthen logical connections between ideas using more transitional phrases"
                )
            if analysis.tone_analysis.authority_score < 0.6:
                suggestions.append(
                    "Support arguments with more definitive language and evidence-based statements"
                )

        # Step 4: Business communication improvements
        if analysis.metrics.business_terms_ratio > 0.05:
            if analysis.tone_analysis.formality_score < 0.6:
                suggestions.append(
                    "Maintain consistent professional tone throughout business content"
                )
            if analysis.metrics.action_words_ratio < 0.02:
                suggestions.append(
                    "Include more action-oriented language to drive business outcomes"
                )

        # Step 5: Vocabulary and language improvements
        if analysis.metrics.modal_verbs_ratio > 0.05:
            suggestions.append(
                "Consider reducing modal verb usage (might, could, should) for more direct communication"
            )

        if (
            analysis.metrics.uncertainty_words_ratio
            > analysis.metrics.certainty_words_ratio
        ):
            suggestions.append(
                "Balance uncertain language with more confident statements to enhance credibility"
            )

        # Step 6: Audience-specific suggestions
        if (
            analysis.tone_analysis.formality_score > 0.8
            and analysis.tone_analysis.emotion_score < 0.3
        ):
            suggestions.append(
                "Balance formal tone with engaging elements to maintain reader interest"
            )

        return suggestions

    def _calculate_overall_confidence(self, result: StyleAnalysisResult) -> float:
        """Calculate overall confidence score for the analysis"""
        confidence_factors = []

        # Text length factor (more text = more confident analysis)
        if result.metrics.word_count >= 100:
            confidence_factors.append(min(result.metrics.word_count / 500, 1.0))
        else:
            confidence_factors.append(0.5)

        # Tone analysis confidence
        confidence_factors.append(result.tone_analysis.confidence_score)

        # Style analysis confidence
        confidence_factors.append(result.style_analysis.style_confidence)

        # AI analysis confidence (if available)
        if result.ai_analysis and "tone_assessment" in result.ai_analysis:
            ai_confidence = result.ai_analysis["tone_assessment"].get(
                "tone_confidence", 0.7
            )
            confidence_factors.append(ai_confidence)

        return sum(confidence_factors) / len(confidence_factors)

    def _compile_statistics(self, result: StyleAnalysisResult) -> Dict[str, Any]:
        """Compile comprehensive analysis statistics"""
        return {
            "analysis_summary": {
                "word_count": result.metrics.word_count,
                "sentence_count": result.metrics.sentence_count,
                "primary_tone": result.tone_analysis.primary_tone.value,
                "primary_style": result.style_analysis.primary_style.value,
                "overall_confidence": result.confidence_score,
            },
            "readability_metrics": {
                "flesch_reading_ease": result.metrics.flesch_reading_ease,
                "avg_words_per_sentence": result.metrics.avg_words_per_sentence,
                "complex_words_ratio": result.metrics.complex_words_ratio,
            },
            "style_scores": {
                "formality": result.tone_analysis.formality_score,
                "authority": result.tone_analysis.authority_score,
                "clarity": result.style_analysis.clarity,
                "conciseness": result.style_analysis.conciseness,
            },
            "vocabulary_analysis": {
                "unique_words_ratio": result.metrics.unique_words_ratio,
                "technical_terms_ratio": result.metrics.technical_terms_ratio,
                "business_terms_ratio": result.metrics.business_terms_ratio,
            },
        }

    def get_analyzer_info(self) -> Dict[str, Any]:
        """Get comprehensive analyzer information"""
        return {
            "analyzer_version": "1.0.0",
            "ollama_model": self.ollama_model,
            "ai_enhancement_enabled": self.use_ai_enhancement,
            "supported_tones": [tone.value for tone in WritingTone],
            "supported_styles": [style.value for style in WritingStyle],
            "vocabulary_sets": list(self.vocabularies.keys()),
            "analysis_features": {
                "basic_metrics": True,
                "tone_analysis": True,
                "style_analysis": True,
                "ai_enhancement": self.use_ai_enhancement and aiohttp is not None,
                "readability_scoring": flesch_reading_ease is not None,
            },
        }

    async def close(self):
        """Close analyzer and cleanup resources"""
        self.logger.info("StyleAnalyzer closed")

# Factory function
def create_style_analyzer(
    config: Optional[Dict[str, Any]] = None,
    llm_config: Optional[LLMConfiguration] = None,
) -> StyleAnalyzer:
    """Create StyleAnalyzer instance with configuration

    Args:
            config: Legacy configuration dict (deprecated, use llm_config instead)
            llm_config: Centralized LLM configuration object
    """
    if config is None:
        config = {}

    # Use centralized LLM config if provided, otherwise fall back to legacy config
    if llm_config is None and config:
        # Convert legacy config to LLM config for backward compatibility
        llm_config = LLMConfiguration()
        llm_config.base_url = config.get("ollama_base_url", llm_config.base_url)
        llm_config.model = config.get("ollama_model", llm_config.model)
        llm_config.timeout = config.get("ollama_timeout", llm_config.timeout)

    return StyleAnalyzer(
        llm_config=llm_config,
        use_ai_enhancement=config.get("use_ai_enhancement", True),
        enable_detailed_analysis=config.get("enable_detailed_analysis", True),
        custom_vocabularies=config.get("custom_vocabularies"),
    )
