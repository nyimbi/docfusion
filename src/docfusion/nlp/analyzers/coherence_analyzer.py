#!/usr/bin/env python3
"""
Coherence Analyzer with Ollama Integration

Advanced logical flow, discourse coherence, and argument structure analysis
with AI-powered insights for comprehensive document understanding.
"""

import asyncio
import json
import logging
import re
from collections import defaultdict, deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

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
            COHERENCE_ANALYSIS = "coherence_analysis"

        class LLMConfiguration:
            def __init__(self):
                self.model = "deepseek-r1:32b"
                self.base_url = "http://localhost:11434"
                self.timeout = 90.0
                self.temperature = 0.1
                self.top_p = 0.9
                self.num_predict = 1200
                self.enable_thinking_filter = True

            def to_ollama_options(self):
                return {
                    "temperature": self.temperature,
                    "top_p": self.top_p,
                    "num_predict": self.num_predict,
                }

        def get_llm_config(task):
            return LLMConfiguration()


try:
    import aiohttp
    from aiohttp import ClientError, ClientTimeout
except ImportError:
    aiohttp = None

# NLTK for stopwords
try:
    import nltk
    from nltk.corpus import stopwords

    # Download stopwords if not available
    try:
        stopwords.words("english")
    except LookupError:
        nltk.download("stopwords", quiet=True)
    HAS_NLTK = True
except ImportError:
    HAS_NLTK = False

try:
    from uuid_extensions import uuid7str
except ImportError:
    from uuid import uuid4

    def uuid7str() -> str:
        return str(uuid4())


class CoherenceType(Enum):
    """Types of coherence analysis"""

    LEXICAL = "lexical_coherence"
    SEMANTIC = "semantic_coherence"
    STRUCTURAL = "structural_coherence"
    DISCOURSE = "discourse_coherence"
    ARGUMENTATIVE = "argumentative_coherence"


class TransitionType(Enum):
    """Types of discourse transitions"""

    ADDITION = "addition"
    CONTRAST = "contrast"
    CAUSE_EFFECT = "cause_effect"
    TEMPORAL = "temporal"
    COMPARISON = "comparison"
    EMPHASIS = "emphasis"
    CONCLUSION = "conclusion"
    EXAMPLE = "example"


class ArgumentStructure(Enum):
    """Types of argument structures"""

    LINEAR = "linear_argument"
    HIERARCHICAL = "hierarchical_argument"
    COMPARATIVE = "comparative_argument"
    PROBLEM_SOLUTION = "problem_solution"
    CAUSE_EFFECT = "cause_effect_chain"
    EVIDENCE_BASED = "evidence_based"


@dataclass
class CoherenceScore:
    """Detailed coherence scoring"""

    overall_score: float = 0.0
    lexical_score: float = 0.0
    semantic_score: float = 0.0
    structural_score: float = 0.0
    discourse_score: float = 0.0
    confidence: float = 0.0

    # Detailed metrics
    topic_continuity: float = 0.0
    transition_quality: float = 0.0
    argument_flow: float = 0.0
    reference_resolution: float = 0.0


@dataclass
class TransitionAnalysis:
    """Analysis of discourse transitions"""

    transition_word: str = ""
    transition_type: TransitionType = TransitionType.ADDITION
    sentence_position: int = 0
    effectiveness_score: float = 0.0
    context_appropriateness: float = 0.0

    # Connection analysis
    connects_to_previous: bool = False
    strengthens_argument: bool = False
    clarity_contribution: float = 0.0


@dataclass
class ArgumentFlow:
    """Analysis of argument structure and flow"""

    structure_type: ArgumentStructure = ArgumentStructure.LINEAR
    main_claims: List[str] = field(default_factory=list)
    supporting_evidence: List[str] = field(default_factory=list)
    logical_gaps: List[str] = field(default_factory=list)

    # Flow metrics
    claim_support_ratio: float = 0.0
    evidence_relevance: float = 0.0
    logical_consistency: float = 0.0
    conclusion_strength: float = 0.0


@dataclass
class TopicProgression:
    """Analysis of topic development and progression"""

    main_topics: List[str] = field(default_factory=list)
    topic_transitions: List[Tuple[str, str, float]] = field(
        default_factory=list
    )  # (from_topic, to_topic, smoothness)
    topic_development_depth: Dict[str, float] = field(default_factory=dict)
    coherence_breaks: List[int] = field(
        default_factory=list
    )  # Sentence positions where coherence breaks

    # Progression metrics
    topic_focus_score: float = 0.0
    development_consistency: float = 0.0
    narrative_flow: float = 0.0


@dataclass
class CoherenceBreak:
    """Identified break in coherence"""

    position: int = 0  # Sentence or paragraph position
    break_type: str = ""
    severity: float = 0.0
    description: str = ""
    suggestion: str = ""


@dataclass
class CoherenceAnalysisResult:
    """Comprehensive coherence analysis result"""

    success: bool = False
    analysis_id: str = field(default_factory=uuid7str)

    # Core analysis components
    coherence_scores: CoherenceScore = field(default_factory=CoherenceScore)
    transitions: List[TransitionAnalysis] = field(default_factory=list)
    argument_flow: ArgumentFlow = field(default_factory=ArgumentFlow)
    topic_progression: TopicProgression = field(default_factory=TopicProgression)
    coherence_breaks: List[CoherenceBreak] = field(default_factory=list)

    # AI-enhanced insights
    ai_analysis: Optional[Dict[str, Any]] = None
    improvement_suggestions: List[str] = field(default_factory=list)
    structural_recommendations: List[str] = field(default_factory=list)

    # Analysis metadata
    processing_time: float = 0.0
    confidence_score: float = 0.0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    # Statistical summaries
    statistics: Dict[str, Any] = field(default_factory=dict)


class CoherenceAnalyzer:
    """Advanced coherence analyzer with logical flow assessment"""

    def __init__(
        self,
        llm_config: Optional[LLMConfiguration] = None,
        use_ai_enhancement: bool = True,
        coherence_threshold: float = 0.6,
        enable_detailed_analysis: bool = True,
    ):
        # Load centralized LLM configuration
        self.llm_config = llm_config or get_llm_config(LLMTask.COHERENCE_ANALYSIS)
        self.use_ai_enhancement = use_ai_enhancement
        self.coherence_threshold = coherence_threshold
        self.enable_detailed_analysis = enable_detailed_analysis
        self.logger = logging.getLogger(__name__)

        # Initialize linguistic patterns and indicators
        self._initialize_patterns()

        self.logger.info(
            f"CoherenceAnalyzer initialized with model: {self.llm_config.model} from centralized config"
        )

    def _initialize_patterns(self):
        """Initialize patterns for coherence analysis"""
        # Transition word patterns by type
        self.transition_patterns = {
            TransitionType.ADDITION: {
                "also",
                "additionally",
                "furthermore",
                "moreover",
                "besides",
                "in addition",
                "similarly",
                "likewise",
                "equally",
                "as well as",
                "not only",
                "along with",
            },
            TransitionType.CONTRAST: {
                "however",
                "nevertheless",
                "nonetheless",
                "but",
                "yet",
                "although",
                "though",
                "despite",
                "in contrast",
                "on the other hand",
                "conversely",
                "whereas",
                "while",
            },
            TransitionType.CAUSE_EFFECT: {
                "therefore",
                "thus",
                "consequently",
                "as a result",
                "because",
                "since",
                "due to",
                "owing to",
                "leads to",
                "results in",
                "causes",
                "enables",
            },
            TransitionType.TEMPORAL: {
                "first",
                "second",
                "third",
                "finally",
                "then",
                "next",
                "subsequently",
                "previously",
                "earlier",
                "later",
                "meanwhile",
                "simultaneously",
                "before",
                "after",
            },
            TransitionType.COMPARISON: {
                "similarly",
                "likewise",
                "in comparison",
                "compared to",
                "like",
                "unlike",
                "as opposed to",
                "different from",
                "in the same way",
                "analogous to",
            },
            TransitionType.EMPHASIS: {
                "indeed",
                "certainly",
                "obviously",
                "clearly",
                "undoubtedly",
                "without doubt",
                "most importantly",
                "significantly",
                "notably",
                "particularly",
                "especially",
            },
            TransitionType.CONCLUSION: {
                "in conclusion",
                "to conclude",
                "finally",
                "in summary",
                "to summarize",
                "overall",
                "ultimately",
                "in the end",
                "as a result",
                "therefore",
            },
            TransitionType.EXAMPLE: {
                "for example",
                "for instance",
                "such as",
                "including",
                "like",
                "namely",
                "specifically",
                "particularly",
                "to illustrate",
                "case in point",
            },
        }

        # Compile all transition words for quick lookup
        self.all_transitions = set()
        for transition_set in self.transition_patterns.values():
            self.all_transitions.update(transition_set)

        # Reference patterns (pronouns and demonstratives)
        self.reference_patterns = {
            "pronouns": {
                "it",
                "they",
                "them",
                "this",
                "that",
                "these",
                "those",
                "he",
                "she",
                "we",
            },
            "demonstratives": {
                "this",
                "that",
                "these",
                "those",
                "such",
                "aforementioned",
            },
            "definite_articles": {"the"},
        }

        # Argument indicator patterns
        self.argument_patterns = {
            "claims": {
                "argue",
                "claim",
                "assert",
                "propose",
                "suggest",
                "contend",
                "maintain",
            },
            "evidence": {
                "because",
                "since",
                "given that",
                "evidence shows",
                "studies indicate",
                "research demonstrates",
            },
            "conclusions": {
                "therefore",
                "thus",
                "hence",
                "consequently",
                "as a result",
                "it follows that",
            },
        }

        # Compile regex patterns for efficiency
        self._compile_regex_patterns()

    def _compile_regex_patterns(self):
        """Compile regex patterns for efficient matching"""
        self.regex_patterns = {
            "sentences": re.compile(r"[.!?]+\s+"),
            "paragraphs": re.compile(r"\n\s*\n"),
            "references": re.compile(
                r"\b(?:this|that|these|those|it|they|them)\b", re.IGNORECASE
            ),
            "claims": re.compile(
                r"\b(?:argue|claim|assert|propose|suggest|contend|maintain)\b",
                re.IGNORECASE,
            ),
            "evidence_markers": re.compile(
                r"\b(?:because|since|given that|evidence|studies|research|data)\b",
                re.IGNORECASE,
            ),
        }

    async def analyze_coherence(
        self,
        text: str,
        use_ai: Optional[bool] = None,
        detailed_analysis: Optional[bool] = None,
    ) -> CoherenceAnalysisResult:
        """Perform comprehensive coherence analysis"""
        start_time = asyncio.get_event_loop().time()
        result = CoherenceAnalysisResult()

        try:
            assert text and text.strip(), "Text content is required"

            use_ai = use_ai if use_ai is not None else self.use_ai_enhancement
            detailed = (
                detailed_analysis
                if detailed_analysis is not None
                else self.enable_detailed_analysis
            )

            # Split into sentences and paragraphs for analysis
            sentences = self._split_into_sentences(text)
            paragraphs = self._split_into_paragraphs(text)

            if len(sentences) < 2:
                result.warnings.append("Insufficient content for coherence analysis")
                return result

            # Step 1: Analyze discourse transitions
            result.transitions = await self._analyze_transitions(sentences)

            # Step 2: Assess topic progression
            result.topic_progression = await self._analyze_topic_progression(
                sentences, paragraphs
            )

            # Step 3: Evaluate argument flow
            result.argument_flow = await self._analyze_argument_flow(
                sentences, paragraphs
            )

            # Step 4: Calculate coherence scores
            result.coherence_scores = await self._calculate_coherence_scores(
                sentences,
                result.transitions,
                result.topic_progression,
                result.argument_flow,
            )

            # Step 5: Identify coherence breaks
            result.coherence_breaks = await self._identify_coherence_breaks(
                sentences, result.coherence_scores, result.topic_progression
            )

            # Step 6: AI-enhanced analysis (if enabled)
            if use_ai and aiohttp:
                try:
                    result.ai_analysis = await self._ai_coherence_analysis(text)
                    result.improvement_suggestions = (
                        await self._generate_improvement_suggestions(text, result)
                    )
                    result.structural_recommendations = (
                        await self._generate_structural_recommendations(result)
                    )
                except Exception as e:
                    result.warnings.append(f"AI coherence analysis failed: {str(e)}")
                    self.logger.warning(f"AI coherence analysis failed: {e}")

            # Step 7: Generate non-AI recommendations if AI is disabled
            if not use_ai or not aiohttp:
                result.improvement_suggestions = self._generate_rule_based_suggestions(
                    result
                )
                result.structural_recommendations = (
                    self._generate_rule_based_structural_recommendations(result)
                )

            # Step 8: Calculate overall confidence and compile statistics
            result.confidence_score = self._calculate_overall_confidence(result)
            result.statistics = self._compile_coherence_statistics(result, text)

            result.success = len(result.errors) == 0
            result.processing_time = asyncio.get_event_loop().time() - start_time

            self.logger.info(
                f"Coherence analysis completed, overall score: {result.coherence_scores.overall_score:.3f}"
            )

        except Exception as e:
            result.errors.append(f"Coherence analysis failed: {str(e)}")
            self.logger.error(f"Coherence analysis error: {e}")

        return result

    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        sentences = self.regex_patterns["sentences"].split(text)
        sentences = [s.strip() for s in sentences if s.strip() and len(s.split()) > 3]
        return sentences

    def _split_into_paragraphs(self, text: str) -> List[str]:
        """Split text into paragraphs"""
        paragraphs = self.regex_patterns["paragraphs"].split(text)
        paragraphs = [p.strip() for p in paragraphs if p.strip()]
        return paragraphs

    async def _analyze_transitions(
        self, sentences: List[str]
    ) -> List[TransitionAnalysis]:
        """Analyze discourse transitions between sentences"""
        transitions = []

        for i, sentence in enumerate(sentences):
            sentence_lower = sentence.lower()

            # Check for transition words at the beginning of sentences
            words = sentence_lower.split()
            if not words:
                continue

            # Check first few words for transitions
            for j in range(min(3, len(words))):
                phrase = " ".join(words[: j + 1])

                for transition_type, transition_set in self.transition_patterns.items():
                    for transition in transition_set:
                        if phrase.startswith(transition) or transition in phrase:
                            analysis = TransitionAnalysis()
                            analysis.transition_word = transition
                            analysis.transition_type = transition_type
                            analysis.sentence_position = i

                            # Calculate effectiveness based on context
                            analysis.effectiveness_score = (
                                self._calculate_transition_effectiveness(
                                    sentence, sentences, i, transition_type
                                )
                            )

                            # Check connection to previous sentence
                            if i > 0:
                                analysis.connects_to_previous = (
                                    self._evaluates_connection(
                                        sentences[i - 1], sentence, transition_type
                                    )
                                )

                            analysis.strengthens_argument = self._strengthens_argument(
                                sentence, transition_type
                            )

                            analysis.clarity_contribution = min(
                                analysis.effectiveness_score * 1.2, 1.0
                            )

                            transitions.append(analysis)
                            break

                    if transitions and transitions[-1].sentence_position == i:
                        break

                if transitions and transitions[-1].sentence_position == i:
                    break

        return transitions

    def _calculate_transition_effectiveness(
        self,
        sentence: str,
        all_sentences: List[str],
        position: int,
        transition_type: TransitionType,
    ) -> float:
        """Calculate how effective a transition is in its context"""
        effectiveness = 0.5  # Base score

        # Position appropriateness
        if position == 0:
            # Opening transitions should be introductory
            if transition_type in [TransitionType.ADDITION, TransitionType.EMPHASIS]:
                effectiveness += 0.2
        elif position == len(all_sentences) - 1:
            # Closing transitions should be conclusory
            if transition_type == TransitionType.CONCLUSION:
                effectiveness += 0.3
        else:
            # Middle transitions should connect ideas
            effectiveness += 0.1

        # Content appropriateness
        sentence_lower = sentence.lower()

        if transition_type == TransitionType.CAUSE_EFFECT:
            if any(
                word in sentence_lower
                for word in ["result", "effect", "impact", "outcome"]
            ):
                effectiveness += 0.2

        if transition_type == TransitionType.CONTRAST:
            if any(
                word in sentence_lower
                for word in ["different", "opposite", "unlike", "alternative"]
            ):
                effectiveness += 0.2

        if transition_type == TransitionType.EXAMPLE:
            if any(
                word in sentence_lower
                for word in ["example", "instance", "case", "illustration"]
            ):
                effectiveness += 0.2

        return min(effectiveness, 1.0)

    def _evaluates_connection(
        self, prev_sentence: str, current_sentence: str, transition_type: TransitionType
    ) -> bool:
        """Evaluate if transition connects appropriately to previous sentence"""
        prev_lower = prev_sentence.lower()
        curr_lower = current_sentence.lower()

        # Simple heuristics for connection evaluation
        if transition_type == TransitionType.CONTRAST:
            # Should have contrasting content
            contrast_indicators = [
                "not",
                "never",
                "different",
                "opposite",
                "unlike",
                "however",
            ]
            return any(word in curr_lower for word in contrast_indicators)

        if transition_type == TransitionType.CAUSE_EFFECT:
            # Previous should mention cause, current should mention effect
            cause_words = ["because", "since", "due to", "leads", "causes"]
            effect_words = ["result", "effect", "consequence", "outcome"]
            return any(word in prev_lower for word in cause_words) or any(
                word in curr_lower for word in effect_words
            )

        if transition_type == TransitionType.ADDITION:
            # Should add related information
            return len(set(prev_lower.split()) & set(curr_lower.split())) > 2

        return True  # Default to connected

    def _strengthens_argument(
        self, sentence: str, transition_type: TransitionType
    ) -> bool:
        """Determine if transition strengthens argumentative flow"""
        sentence_lower = sentence.lower()

        strengthening_types = [
            TransitionType.CAUSE_EFFECT,
            TransitionType.EVIDENCE,
            TransitionType.CONCLUSION,
            TransitionType.EMPHASIS,
        ]

        if transition_type in strengthening_types:
            return True

        # Check for argumentative content
        if any(
            pattern in sentence_lower for pattern in self.argument_patterns["evidence"]
        ):
            return True

        if any(
            pattern in sentence_lower
            for pattern in self.argument_patterns["conclusions"]
        ):
            return True

        return False

    async def _analyze_topic_progression(
        self, sentences: List[str], paragraphs: List[str]
    ) -> TopicProgression:
        """Analyze topic development and progression"""
        progression = TopicProgression()

        try:
            # Extract key topics from content
            topic_keywords = self._extract_topic_keywords(sentences)
            progression.main_topics = list(topic_keywords.keys())[:5]

            # Analyze topic transitions between sentences
            for i in range(1, len(sentences)):
                current_topics = self._get_sentence_topics(sentences[i], topic_keywords)
                prev_topics = self._get_sentence_topics(
                    sentences[i - 1], topic_keywords
                )

                # Calculate topic transition smoothness
                if current_topics and prev_topics:
                    overlap = len(set(current_topics) & set(prev_topics))
                    total_topics = len(set(current_topics) | set(prev_topics))

                    if total_topics > 0:
                        smoothness = overlap / total_topics

                        for curr_topic in current_topics:
                            for prev_topic in prev_topics:
                                if curr_topic != prev_topic:
                                    progression.topic_transitions.append(
                                        (prev_topic, curr_topic, smoothness)
                                    )

            # Calculate topic development depth
            for topic in progression.main_topics:
                topic_count = sum(
                    1 for sentence in sentences if topic.lower() in sentence.lower()
                )
                total_sentences = len(sentences)
                progression.topic_development_depth[topic] = (
                    topic_count / total_sentences if total_sentences > 0 else 0
                )

            # Identify coherence breaks (sudden topic changes)
            for i in range(1, len(sentences)):
                current_topics = self._get_sentence_topics(sentences[i], topic_keywords)
                prev_topics = self._get_sentence_topics(
                    sentences[i - 1], topic_keywords
                )

                if current_topics and prev_topics:
                    overlap = len(set(current_topics) & set(prev_topics))
                    if (
                        overlap == 0
                        and len(current_topics) > 0
                        and len(prev_topics) > 0
                    ):
                        progression.coherence_breaks.append(i)

            # Calculate progression metrics
            if len(progression.main_topics) > 0:
                avg_development = sum(
                    progression.topic_development_depth.values()
                ) / len(progression.topic_development_depth)
                progression.development_consistency = avg_development

                # Topic focus score (higher = more focused)
                max_development = (
                    max(progression.topic_development_depth.values())
                    if progression.topic_development_depth
                    else 0
                )
                progression.topic_focus_score = max_development

                # Narrative flow (fewer coherence breaks = better flow)
                break_penalty = (
                    len(progression.coherence_breaks) / len(sentences)
                    if len(sentences) > 0
                    else 0
                )
                progression.narrative_flow = max(1.0 - break_penalty * 2, 0.0)

        except Exception as e:
            self.logger.warning(f"Topic progression analysis failed: {e}")

        return progression

    def _extract_topic_keywords(self, sentences: List[str]) -> Dict[str, int]:
        """Extract key topic words from sentences"""
        word_counts = defaultdict(int)

        # Use NLTK stopwords or fallback
        if HAS_NLTK:
            stop_words = set(stopwords.words("english"))
        else:
            stop_words = {
                "the",
                "a",
                "an",
                "and",
                "or",
                "but",
                "in",
                "on",
                "at",
                "to",
                "for",
                "of",
                "with",
                "by",
            }

        for sentence in sentences:
            words = re.findall(r"\b\w+\b", sentence.lower())
            for word in words:
                if len(word) > 3 and word not in stop_words:
                    word_counts[word] += 1

        # Return top topics by frequency
        sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
        return dict(sorted_words[:10])

    def _get_sentence_topics(
        self, sentence: str, topic_keywords: Dict[str, int]
    ) -> List[str]:
        """Get topics present in a sentence"""
        sentence_lower = sentence.lower()
        present_topics = []

        for topic in topic_keywords:
            if topic in sentence_lower:
                present_topics.append(topic)

        return present_topics

    async def _analyze_argument_flow(
        self, sentences: List[str], paragraphs: List[str]
    ) -> ArgumentFlow:
        """Analyze argument structure and logical flow"""
        flow = ArgumentFlow()

        try:
            # Identify claims
            for sentence in sentences:
                sentence_lower = sentence.lower()
                if any(
                    claim_word in sentence_lower
                    for claim_word in self.argument_patterns["claims"]
                ):
                    flow.main_claims.append(sentence.strip())

            # Identify supporting evidence
            for sentence in sentences:
                sentence_lower = sentence.lower()
                if any(
                    evidence_word in sentence_lower
                    for evidence_word in self.argument_patterns["evidence"]
                ):
                    flow.supporting_evidence.append(sentence.strip())

            # Calculate claim support ratio
            if len(flow.main_claims) > 0:
                flow.claim_support_ratio = len(flow.supporting_evidence) / len(
                    flow.main_claims
                )

            # Assess evidence relevance (simplified heuristic)
            if flow.supporting_evidence and flow.main_claims:
                relevance_scores = []
                for evidence in flow.supporting_evidence:
                    max_relevance = 0
                    for claim in flow.main_claims:
                        # Simple word overlap for relevance
                        evidence_words = set(evidence.lower().split())
                        claim_words = set(claim.lower().split())
                        overlap = len(evidence_words & claim_words)
                        total_words = len(evidence_words | claim_words)

                        if total_words > 0:
                            relevance = overlap / total_words
                            max_relevance = max(max_relevance, relevance)

                    relevance_scores.append(max_relevance)

                flow.evidence_relevance = sum(relevance_scores) / len(relevance_scores)

            # Assess logical consistency (look for contradictions)
            consistency_score = 1.0  # Start high
            contradiction_indicators = [
                "but not",
                "however not",
                "despite",
                "although",
                "contradicts",
            ]

            contradiction_count = 0
            for sentence in sentences:
                sentence_lower = sentence.lower()
                if any(
                    indicator in sentence_lower
                    for indicator in contradiction_indicators
                ):
                    contradiction_count += 1

            if (
                contradiction_count > len(sentences) * 0.2
            ):  # More than 20% contradictory statements
                consistency_score -= 0.3

            flow.logical_consistency = max(consistency_score, 0.0)

            # Assess conclusion strength
            conclusion_indicators = [
                "therefore",
                "thus",
                "in conclusion",
                "finally",
                "ultimately",
            ]
            conclusion_sentences = []

            for sentence in sentences[-3:]:  # Check last 3 sentences
                sentence_lower = sentence.lower()
                if any(
                    indicator in sentence_lower for indicator in conclusion_indicators
                ):
                    conclusion_sentences.append(sentence)

            if conclusion_sentences:
                # Strong conclusions typically connect to main claims
                conclusion_strength = 0.7  # Base strength for having conclusions

                for conclusion in conclusion_sentences:
                    for claim in flow.main_claims:
                        # Check connection between conclusion and claims
                        conclusion_words = set(conclusion.lower().split())
                        claim_words = set(claim.lower().split())
                        overlap = len(conclusion_words & claim_words)

                        if overlap > 2:  # Reasonable connection
                            conclusion_strength = min(conclusion_strength + 0.2, 1.0)

                flow.conclusion_strength = conclusion_strength
            else:
                flow.conclusion_strength = 0.3  # Lower score for missing conclusions

            # Determine argument structure type
            if len(flow.main_claims) > 3 and flow.claim_support_ratio > 0.8:
                flow.structure_type = ArgumentStructure.EVIDENCE_BASED
            elif contradiction_count > 0:
                flow.structure_type = ArgumentStructure.COMPARATIVE
            elif any(
                "problem" in sentence.lower() and "solution" in sentence.lower()
                for sentence in sentences
            ):
                flow.structure_type = ArgumentStructure.PROBLEM_SOLUTION
            elif any(
                "cause" in sentence.lower() and "effect" in sentence.lower()
                for sentence in sentences
            ):
                flow.structure_type = ArgumentStructure.CAUSE_EFFECT
            else:
                flow.structure_type = ArgumentStructure.LINEAR

        except Exception as e:
            self.logger.warning(f"Argument flow analysis failed: {e}")

        return flow

    async def _calculate_coherence_scores(
        self,
        sentences: List[str],
        transitions: List[TransitionAnalysis],
        topic_progression: TopicProgression,
        argument_flow: ArgumentFlow,
    ) -> CoherenceScore:
        """Calculate comprehensive coherence scores"""
        scores = CoherenceScore()

        try:
            # Lexical coherence (word repetition, reference resolution)
            lexical_score = self._calculate_lexical_coherence(sentences)
            scores.lexical_score = lexical_score

            # Semantic coherence (topic consistency)
            semantic_score = (
                topic_progression.topic_focus_score * 0.6
                + topic_progression.development_consistency * 0.4
            )
            scores.semantic_score = semantic_score

            # Structural coherence (transitions, organization)
            if len(sentences) > 0:
                transition_coverage = len(transitions) / len(sentences)
                avg_transition_effectiveness = (
                    sum(t.effectiveness_score for t in transitions) / len(transitions)
                    if transitions
                    else 0.5
                )
                structural_score = (
                    min(transition_coverage * 2, 1.0) * 0.4
                    + avg_transition_effectiveness * 0.6
                )
            else:
                structural_score = 0.0

            scores.structural_score = structural_score

            # Discourse coherence (argument flow)
            discourse_score = (
                argument_flow.logical_consistency * 0.4
                + argument_flow.evidence_relevance * 0.3
                + argument_flow.conclusion_strength * 0.3
            )
            scores.discourse_score = discourse_score

            # Overall coherence score (weighted average)
            scores.overall_score = (
                lexical_score * 0.2
                + semantic_score * 0.3
                + structural_score * 0.25
                + discourse_score * 0.25
            )

            # Additional metrics
            scores.topic_continuity = topic_progression.narrative_flow
            scores.transition_quality = avg_transition_effectiveness
            scores.argument_flow = discourse_score
            scores.reference_resolution = self._calculate_reference_resolution(
                sentences
            )

            # Calculate confidence based on text length and analysis completeness
            confidence_factors = []

            if len(sentences) >= 5:
                confidence_factors.append(min(len(sentences) / 20, 1.0))
            else:
                confidence_factors.append(0.5)

            if transitions:
                confidence_factors.append(0.8)
            else:
                confidence_factors.append(0.4)

            if argument_flow.main_claims or argument_flow.supporting_evidence:
                confidence_factors.append(0.7)
            else:
                confidence_factors.append(0.5)

            scores.confidence = sum(confidence_factors) / len(confidence_factors)

        except Exception as e:
            self.logger.warning(f"Coherence score calculation failed: {e}")
            scores.confidence = 0.3

        return scores

    def _calculate_lexical_coherence(self, sentences: List[str]) -> float:
        """Calculate lexical coherence based on word repetition and references"""
        if len(sentences) < 2:
            return 0.5

        # Calculate word overlap between adjacent sentences
        overlap_scores = []

        for i in range(1, len(sentences)):
            words1 = set(sentences[i - 1].lower().split())
            words2 = set(sentences[i].lower().split())

            overlap = len(words1 & words2)
            total_unique = len(words1 | words2)

            if total_unique > 0:
                overlap_scores.append(overlap / total_unique)

        avg_overlap = sum(overlap_scores) / len(overlap_scores) if overlap_scores else 0

        # Check for proper use of references
        reference_score = self._calculate_reference_resolution(sentences)

        # Combine lexical measures
        lexical_coherence = avg_overlap * 0.6 + reference_score * 0.4

        return min(lexical_coherence, 1.0)

    def _calculate_reference_resolution(self, sentences: List[str]) -> float:
        """Calculate how well references (pronouns, demonstratives) are resolved"""
        if len(sentences) < 2:
            return 1.0

        reference_count = 0
        resolved_count = 0

        for i in range(1, len(sentences)):
            current_sentence = sentences[i].lower()

            # Count references in current sentence
            references = self.regex_patterns["references"].findall(current_sentence)
            reference_count += len(references)

            if references:
                # Simple heuristic: check if previous sentence has potential antecedents
                prev_sentence = sentences[i - 1].lower()

                # Look for nouns in previous sentence that could be antecedents
                prev_words = prev_sentence.split()
                potential_antecedents = [
                    word for word in prev_words if len(word) > 3 and word.isalpha()
                ]

                if potential_antecedents:
                    resolved_count += len(
                        references
                    )  # Assume resolved if potential antecedents exist

        if reference_count == 0:
            return 0.8  # Good score if no problematic references

        return resolved_count / reference_count

    async def _identify_coherence_breaks(
        self,
        sentences: List[str],
        coherence_scores: CoherenceScore,
        topic_progression: TopicProgression,
    ) -> List[CoherenceBreak]:
        """Identify specific points where coherence breaks down"""
        breaks = []

        try:
            # Identify breaks from topic progression
            for break_position in topic_progression.coherence_breaks:
                coherence_break = CoherenceBreak()
                coherence_break.position = break_position
                coherence_break.break_type = "topic_shift"
                coherence_break.severity = 0.7  # Moderate severity for topic shifts
                coherence_break.description = (
                    f"Abrupt topic change at sentence {break_position + 1}"
                )
                coherence_break.suggestion = "Add transitional phrase to connect topics"
                breaks.append(coherence_break)

            # Identify breaks from missing transitions
            for i in range(1, len(sentences)):
                # Check if sentence needs transition but doesn't have one
                current_sentence = sentences[i].lower()

                # Look for contrast indicators without transitions
                if any(
                    word in current_sentence
                    for word in ["but", "however", "different", "unlike"]
                ):
                    # Check if proper transition is present
                    has_transition = any(
                        transition in current_sentence
                        for transition in self.all_transitions
                    )

                    if not has_transition:
                        coherence_break = CoherenceBreak()
                        coherence_break.position = i
                        coherence_break.break_type = "missing_transition"
                        coherence_break.severity = 0.5
                        coherence_break.description = (
                            f"Missing transition word at sentence {i + 1}"
                        )
                        coherence_break.suggestion = "Add appropriate transition word (however, but, in contrast)"
                        breaks.append(coherence_break)

            # Sort breaks by severity (most severe first)
            breaks.sort(key=lambda x: x.severity, reverse=True)

        except Exception as e:
            self.logger.warning(f"Coherence break identification failed: {e}")

        return breaks[:10]  # Return top 10 breaks

    async def _ai_coherence_analysis(self, text: str) -> Dict[str, Any]:
        """AI-enhanced coherence analysis using advanced Chain-of-Thought prompting"""
        if not aiohttp:
            raise ImportError("aiohttp required for AI coherence analysis")

        # Create Chain-of-Thought prompt for comprehensive coherence analysis
        task = "Analyze the logical flow and coherence of the provided text comprehensively"
        context = f"Text to analyze (first 3500 chars): {text[:3500]}{'...' if len(text) > 3500 else ''}"

        reasoning_steps = [
            "Examine the overall document structure and organization",
            "Analyze topic progression and identify any abrupt shifts or gaps",
            "Evaluate the quality and appropriateness of transitions between ideas",
            "Assess the logical flow of arguments and supporting evidence",
            "Identify specific points where coherence breaks down",
            "Determine strengths that contribute to overall coherence",
            "Formulate specific, actionable improvement recommendations",
        ]

        output_format = """JSON format:
{
	"coherence_assessment": {
		"overall_score": 0.0-1.0,
		"topic_continuity": 0.0-1.0,
		"argument_flow": 0.0-1.0,
		"transition_quality": 0.0-1.0
	},
	"strengths": ["specific strength 1", "specific strength 2"],
	"weaknesses": ["specific weakness 1", "specific weakness 2"],
	"flow_breaks": [
		{"position": "specific location", "issue": "detailed description", "suggestion": "specific fix"}
	],
	"improvement_recommendations": ["actionable recommendation 1", "actionable recommendation 2"]
}"""

        examples = [
            "For academic writing: focus on logical argument progression, evidence support, clear transitions",
            "For technical documentation: emphasize step-by-step flow, clear section transitions, consistent terminology",
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

                    try:
                        return json.loads(ai_response)
                    except json.JSONDecodeError:
                        return {
                            "coherence_assessment": {"overall_score": 0.5},
                            "raw_analysis": ai_response,
                            "improvement_recommendations": [
                                "Review AI analysis in raw_analysis field"
                            ],
                        }
                else:
                    raise Exception(f"Ollama API error: {response.status}")

    async def _generate_improvement_suggestions(
        self, text: str, result: CoherenceAnalysisResult
    ) -> List[str]:
        """Generate AI-powered improvement suggestions"""
        suggestions = []

        if result.ai_analysis and "improvement_recommendations" in result.ai_analysis:
            suggestions.extend(result.ai_analysis["improvement_recommendations"])

        # Add rule-based suggestions
        suggestions.extend(self._generate_rule_based_suggestions(result))

        return suggestions[:8]  # Limit to 8 suggestions

    async def _generate_structural_recommendations(
        self, result: CoherenceAnalysisResult
    ) -> List[str]:
        """Generate structural improvement recommendations"""
        recommendations = []

        if result.ai_analysis and "flow_breaks" in result.ai_analysis:
            for break_info in result.ai_analysis["flow_breaks"]:
                if isinstance(break_info, dict) and "suggestion" in break_info:
                    recommendations.append(break_info["suggestion"])

        # Add rule-based structural recommendations
        recommendations.extend(
            self._generate_rule_based_structural_recommendations(result)
        )

        return recommendations[:6]  # Limit to 6 recommendations

    def _generate_rule_based_suggestions(
        self, result: CoherenceAnalysisResult
    ) -> List[str]:
        """Generate rule-based improvement suggestions"""
        suggestions = []

        # Low lexical coherence
        if result.coherence_scores.lexical_score < 0.5:
            suggestions.append(
                "Improve word choice consistency and reduce repetitive vocabulary"
            )

        # Low semantic coherence
        if result.coherence_scores.semantic_score < 0.5:
            suggestions.append(
                "Maintain focus on main topics and reduce tangential content"
            )

        # Poor transitions
        if result.coherence_scores.transition_quality < 0.5:
            suggestions.append(
                "Add more transitional phrases to connect ideas smoothly"
            )

        # Weak argument flow
        if result.coherence_scores.argument_flow < 0.5:
            suggestions.append(
                "Strengthen logical connections between claims and evidence"
            )

        # Topic progression issues
        if result.topic_progression.narrative_flow < 0.5:
            suggestions.append(
                "Organize content to follow a clearer logical progression"
            )

        # Reference resolution problems
        if result.coherence_scores.reference_resolution < 0.6:
            suggestions.append(
                "Clarify pronoun references and ensure antecedents are clear"
            )

        return suggestions

    def _generate_rule_based_structural_recommendations(
        self, result: CoherenceAnalysisResult
    ) -> List[str]:
        """Generate rule-based structural recommendations"""
        recommendations = []

        # Few transitions
        if len(result.transitions) < len(result.topic_progression.main_topics):
            recommendations.append(
                "Add paragraph-level transitions to improve flow between sections"
            )

        # Many coherence breaks
        if len(result.coherence_breaks) > 3:
            recommendations.append(
                "Address abrupt topic changes with better transitions"
            )

        # Weak conclusion
        if result.argument_flow.conclusion_strength < 0.5:
            recommendations.append(
                "Strengthen conclusion by clearly connecting to main arguments"
            )

        # Poor claim support
        if result.argument_flow.claim_support_ratio < 0.5:
            recommendations.append(
                "Provide more evidence and examples to support main claims"
            )

        # Low topic focus
        if result.topic_progression.topic_focus_score < 0.4:
            recommendations.append(
                "Focus content on fewer main topics for better coherence"
            )

        return recommendations

    def _calculate_overall_confidence(self, result: CoherenceAnalysisResult) -> float:
        """Calculate overall confidence in coherence analysis"""
        confidence_factors = []

        # Base confidence from coherence scores
        confidence_factors.append(result.coherence_scores.confidence)

        # Analysis completeness
        if result.transitions:
            confidence_factors.append(0.8)

        if result.topic_progression.main_topics:
            confidence_factors.append(0.7)

        if result.argument_flow.main_claims or result.argument_flow.supporting_evidence:
            confidence_factors.append(0.7)

        # AI analysis confidence
        if result.ai_analysis:
            confidence_factors.append(0.8)

        return (
            sum(confidence_factors) / len(confidence_factors)
            if confidence_factors
            else 0.5
        )

    def _compile_coherence_statistics(
        self, result: CoherenceAnalysisResult, text: str
    ) -> Dict[str, Any]:
        """Compile comprehensive coherence analysis statistics"""
        return {
            "analysis_summary": {
                "overall_coherence_score": result.coherence_scores.overall_score,
                "transitions_found": len(result.transitions),
                "coherence_breaks": len(result.coherence_breaks),
                "main_topics": len(result.topic_progression.main_topics),
                "argument_claims": len(result.argument_flow.main_claims),
                "supporting_evidence": len(result.argument_flow.supporting_evidence),
            },
            "coherence_breakdown": {
                "lexical_coherence": result.coherence_scores.lexical_score,
                "semantic_coherence": result.coherence_scores.semantic_score,
                "structural_coherence": result.coherence_scores.structural_score,
                "discourse_coherence": result.coherence_scores.discourse_score,
            },
            "flow_metrics": {
                "topic_continuity": result.coherence_scores.topic_continuity,
                "transition_quality": result.coherence_scores.transition_quality,
                "argument_flow": result.coherence_scores.argument_flow,
                "reference_resolution": result.coherence_scores.reference_resolution,
            },
            "structural_analysis": {
                "argument_structure": result.argument_flow.structure_type.value,
                "claim_support_ratio": result.argument_flow.claim_support_ratio,
                "evidence_relevance": result.argument_flow.evidence_relevance,
                "logical_consistency": result.argument_flow.logical_consistency,
                "conclusion_strength": result.argument_flow.conclusion_strength,
            },
            "content_metrics": {
                "text_length": len(text),
                "word_count": len(text.split()),
                "sentence_count": len(self._split_into_sentences(text)),
                "paragraph_count": len(self._split_into_paragraphs(text)),
            },
        }

    def get_analyzer_info(self) -> Dict[str, Any]:
        """Get comprehensive analyzer information"""
        return {
            "analyzer_version": "1.0.0",
            "ollama_model": self.ollama_model,
            "ai_enhancement_enabled": self.use_ai_enhancement,
            "supported_coherence_types": [
                coherence_type.value for coherence_type in CoherenceType
            ],
            "supported_transition_types": [
                transition_type.value for transition_type in TransitionType
            ],
            "supported_argument_structures": [
                structure.value for structure in ArgumentStructure
            ],
            "analysis_features": {
                "transition_analysis": True,
                "topic_progression": True,
                "argument_flow": True,
                "coherence_breaks": True,
                "ai_enhancement": self.use_ai_enhancement and aiohttp is not None,
            },
            "configuration": {
                "coherence_threshold": self.coherence_threshold,
                "detailed_analysis": self.enable_detailed_analysis,
            },
        }

    async def close(self):
        """Close analyzer and cleanup resources"""
        self.logger.info("CoherenceAnalyzer closed")


# Factory function
def create_coherence_analyzer(
    config: Optional[Dict[str, Any]] = None,
    llm_config: Optional[LLMConfiguration] = None,
) -> CoherenceAnalyzer:
    """Create CoherenceAnalyzer instance with configuration

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

    return CoherenceAnalyzer(
        llm_config=llm_config,
        use_ai_enhancement=config.get("use_ai_enhancement", True),
        coherence_threshold=config.get("coherence_threshold", 0.6),
        enable_detailed_analysis=config.get("enable_detailed_analysis", True),
    )
