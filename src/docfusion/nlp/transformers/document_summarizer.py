#!/usr/bin/env python3
"""
Document Summarizer with Ollama Integration

Advanced document summarization with extractive and abstractive techniques,
AI-powered insights, and customizable summary generation.
"""

import asyncio
import logging
import re
from collections import Counter
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional
from ...core.utils import uuid7str
import time

try:
    import aiohttp
    from aiohttp import ClientTimeout
except ImportError:
    aiohttp = None

try:
    import numpy as np
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    np = TfidfVectorizer = cosine_similarity = None

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

class SummaryType(Enum):
    """Types of summary generation"""

    EXTRACTIVE = "extractive"
    ABSTRACTIVE = "abstractive"
    HYBRID = "hybrid"
    BULLET_POINTS = "bullet_points"
    EXECUTIVE = "executive"
    TECHNICAL = "technical"
    KEY_FINDINGS = "key_findings"

class SummaryLength(Enum):
    """Summary length categories"""

    BRIEF = "brief"  # 1-2 sentences
    SHORT = "short"  # 50-100 words
    MEDIUM = "medium"  # 100-200 words
    LONG = "long"  # 200-400 words
    DETAILED = "detailed"  # 400+ words

class SummaryFocus(Enum):
    """Summary focus areas"""

    OVERVIEW = "overview"
    KEY_POINTS = "key_points"
    METHODOLOGY = "methodology"
    RESULTS = "results"
    RECOMMENDATIONS = "recommendations"
    TECHNICAL_DETAILS = "technical_details"
    BUSINESS_VALUE = "business_value"

@dataclass
class SentenceScore:
    """Scoring for sentence importance"""

    sentence: str = ""
    position: int = 0
    tf_idf_score: float = 0.0
    position_score: float = 0.0
    keyword_score: float = 0.0
    similarity_score: float = 0.0
    length_score: float = 0.0
    total_score: float = 0.0

@dataclass
class SummarySegment:
    """A segment or section of the summary"""

    title: str = ""
    content: str = ""
    importance: float = 0.0
    source_sentences: List[str] = field(default_factory=list)
    segment_type: str = "content"  # content, introduction, conclusion

@dataclass
class SummaryResult:
    """Complete summary result"""

    success: bool = False
    summary_id: str = field(default_factory=uuid7str)

    # Summary content
    summary_text: str = ""
    summary_segments: List[SummarySegment] = field(default_factory=list)
    key_points: List[str] = field(default_factory=list)

    # Summary metadata
    summary_type: SummaryType = SummaryType.ABSTRACTIVE
    summary_length: SummaryLength = SummaryLength.MEDIUM
    compression_ratio: float = 0.0
    word_count: int = 0

    # Quality metrics
    coherence_score: float = 0.0
    coverage_score: float = 0.0
    informativeness: float = 0.0
    readability_score: float = 0.0

    # Source analysis
    important_sentences: List[SentenceScore] = field(default_factory=list)
    key_topics: List[str] = field(default_factory=list)
    named_entities: List[str] = field(default_factory=list)

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

class DocumentSummarizer:
    """Advanced document summarizer with multiple techniques"""

    def __init__(
        self,
        ollama_base_url: str = "http://localhost:11434",
        ollama_model: str = "deepseek-r1:32b",
        ollama_timeout: float = 180.0,
        use_ai_enhancement: bool = True,
        default_length: SummaryLength = SummaryLength.MEDIUM,
        enable_extractive_fallback: bool = True,
        use_advanced_prompting: bool = True,
    ):
        self.ollama_base_url = ollama_base_url.rstrip("/")
        self.ollama_model = ollama_model
        self.ollama_timeout = ollama_timeout
        self.use_ai_enhancement = use_ai_enhancement
        self.default_length = default_length
        self.enable_extractive_fallback = enable_extractive_fallback
        self.use_advanced_prompting = use_advanced_prompting
        self.logger = logging.getLogger(__name__)

        # Initialize advanced prompting if available
        self.prompt_builder = None
        if self.use_advanced_prompting and AdvancedPromptBuilder:
            try:
                self.prompt_builder = create_advanced_prompt_builder(ollama_model)
            except Exception as e:
                self.logger.warning(f"Could not initialize advanced prompting: {e}")

        # Initialize summarization components
        self._initialize_stop_words()
        self._initialize_key_phrases()

        self.logger.info(f"DocumentSummarizer initialized with model: {ollama_model}")

    def _initialize_stop_words(self):
        """Initialize stop words for text processing using NLTK"""
        if HAS_NLTK:
            # Use NLTK stopwords
            self.stop_words = set(stopwords.words("english"))
        else:
            # Fallback to minimal custom stopwords if NLTK not available
            self.stop_words = {
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
                "is",
                "are",
                "was",
                "were",
                "be",
                "been",
                "being",
                "have",
                "has",
                "had",
                "do",
                "does",
                "did",
            }

    def _initialize_key_phrases(self):
        """Initialize key phrases that indicate important content"""
        self.importance_indicators = {
            "high": [
                "key finding",
                "main result",
                "primary objective",
                "critical issue",
                "important factor",
                "significant impact",
                "major benefit",
                "core requirement",
                "essential element",
                "fundamental principle",
                "primary goal",
                "main purpose",
            ],
            "medium": [
                "notable",
                "significant",
                "important",
                "relevant",
                "substantial",
                "considerable",
                "effective",
                "successful",
                "valuable",
                "beneficial",
                "useful",
                "practical",
            ],
            "structural": [
                "in conclusion",
                "to summarize",
                "in summary",
                "overall",
                "finally",
                "first",
                "second",
                "third",
                "initially",
                "subsequently",
                "therefore",
                "consequently",
                "as a result",
                "furthermore",
                "moreover",
                "however",
            ],
        }

    async def summarize_document(
        self,
        text: str,
        summary_type: SummaryType = SummaryType.ABSTRACTIVE,
        length: Optional[SummaryLength] = None,
        focus: Optional[SummaryFocus] = None,
        custom_word_limit: Optional[int] = None,
    ) -> SummaryResult:
        """Generate comprehensive document summary"""
        start_time = time.monotonic()
        result = SummaryResult()

        try:
            assert text and text.strip(), "Text content is required"

            length = length or self.default_length
            result.summary_type = summary_type
            result.summary_length = length

            # Step 1: Preprocess text and extract sentences
            sentences = self._extract_sentences(text)
            if len(sentences) < 2:
                result.warnings.append(
                    "Document too short for meaningful summarization"
                )
                result.summary_text = text
                result.word_count = len(text.split())
                result.success = True
                return result

            # Step 2: Analyze text structure and importance
            sentence_scores = await self._score_sentences(sentences, text)
            result.important_sentences = sentence_scores

            # Step 3: Extract key topics and entities
            result.key_topics = await self._extract_key_topics(text)
            result.named_entities = await self._extract_named_entities(text)

            # Step 4: Generate summary based on type
            if summary_type == SummaryType.EXTRACTIVE or (
                not self.use_ai_enhancement and not aiohttp
            ):
                await self._generate_extractive_summary(
                    result, sentence_scores, length, focus, custom_word_limit
                )

            elif (
                summary_type == SummaryType.ABSTRACTIVE
                and self.use_ai_enhancement
                and aiohttp
            ):
                try:
                    await self._generate_abstractive_summary(
                        result, text, length, focus, custom_word_limit
                    )
                    result.model_calls += 1
                except Exception as e:
                    result.warnings.append(f"AI summarization failed: {str(e)}")
                    if self.enable_extractive_fallback:
                        await self._generate_extractive_summary(
                            result, sentence_scores, length, focus, custom_word_limit
                        )
                    else:
                        raise e

            elif summary_type == SummaryType.HYBRID:
                await self._generate_hybrid_summary(
                    result, text, sentence_scores, length, focus, custom_word_limit
                )
                if self.use_ai_enhancement and aiohttp:
                    result.model_calls += 1

            elif summary_type == SummaryType.BULLET_POINTS:
                await self._generate_bullet_summary(
                    result, text, sentence_scores, length, focus
                )
                if self.use_ai_enhancement and aiohttp:
                    result.model_calls += 1

            elif summary_type == SummaryType.EXECUTIVE:
                await self._generate_executive_summary(
                    result, text, length, custom_word_limit
                )
                if self.use_ai_enhancement and aiohttp:
                    result.model_calls += 1

            else:
                # Default to extractive
                await self._generate_extractive_summary(
                    result, sentence_scores, length, focus, custom_word_limit
                )

            # Step 5: Quality assessment
            await self._assess_summary_quality(result, text)

            # Step 6: Generate key points if not already done
            if not result.key_points:
                result.key_points = await self._extract_key_points_from_summary(
                    result.summary_text
                )

            # Step 7: Compile statistics
            result.statistics = self._compile_summarization_statistics(result, text)

            result.success = len(result.errors) == 0 and bool(result.summary_text)
            result.processing_time = time.monotonic() - start_time

            self.logger.info(
                f"Document summarization completed: {summary_type.value}, "
                f"compression: {result.compression_ratio:.3f}"
            )

        except Exception as e:
            result.errors.append(f"Document summarization failed: {str(e)}")
            self.logger.error(f"Summarization error: {e}")

        return result

    def _extract_sentences(self, text: str) -> List[str]:
        """Extract and clean sentences from text"""
        # Split by sentence endings
        sentences = re.split(r"[.!?]+\s+", text)

        # Clean and filter sentences
        cleaned_sentences = []
        for sentence in sentences:
            sentence = sentence.strip()

            # Filter out very short sentences and non-sentences
            if len(sentence.split()) >= 5 and not sentence.isupper():
                cleaned_sentences.append(sentence)

        return cleaned_sentences

    async def _score_sentences(
        self, sentences: List[str], full_text: str
    ) -> List[SentenceScore]:
        """Score sentences for importance using multiple factors"""
        sentence_scores = []

        # Calculate TF-IDF scores if available
        tfidf_scores = {}
        if TfidfVectorizer and len(sentences) > 1:
            try:
                vectorizer = TfidfVectorizer(
                    stop_words="english"
                    if hasattr(TfidfVectorizer(), "stop_words")
                    else None
                )
                tfidf_matrix = vectorizer.fit_transform(sentences)

                # Calculate average TF-IDF score for each sentence
                for i, sentence in enumerate(sentences):
                    tfidf_scores[i] = (
                        float(np.mean(tfidf_matrix[i].toarray())) if np else 0.5
                    )
            except Exception as e:
                self.logger.warning(f"TF-IDF calculation failed: {e}")

        # Score each sentence
        for i, sentence in enumerate(sentences):
            score = SentenceScore()
            score.sentence = sentence
            score.position = i

            # TF-IDF score
            score.tf_idf_score = tfidf_scores.get(i, 0.5)

            # Position score (first and last sentences often important)
            if i == 0:
                score.position_score = 1.0
            elif i == len(sentences) - 1:
                score.position_score = 0.8
            elif i < len(sentences) * 0.2:  # First 20%
                score.position_score = 0.7
            elif i > len(sentences) * 0.8:  # Last 20%
                score.position_score = 0.6
            else:
                score.position_score = 0.4

            # Keyword score (importance indicators)
            sentence_lower = sentence.lower()
            keyword_score = 0.0

            for importance_level, phrases in self.importance_indicators.items():
                weight = {"high": 1.0, "medium": 0.6, "structural": 0.4}.get(
                    importance_level, 0.3
                )

                for phrase in phrases:
                    if phrase in sentence_lower:
                        keyword_score += weight

            score.keyword_score = min(keyword_score, 1.0)

            # Length score (moderate length sentences often better)
            word_count = len(sentence.split())
            if 10 <= word_count <= 25:
                score.length_score = 1.0
            elif 5 <= word_count <= 35:
                score.length_score = 0.8
            else:
                score.length_score = 0.5

            # Similarity to document (how representative the sentence is)
            if TfidfVectorizer and cosine_similarity:
                try:
                    vectorizer = TfidfVectorizer(
                        stop_words="english"
                        if hasattr(TfidfVectorizer(), "stop_words")
                        else None
                    )
                    vectors = vectorizer.fit_transform([sentence, full_text])
                    similarity = cosine_similarity(vectors[0:1], vectors[1:2])[0][0]
                    score.similarity_score = float(similarity)
                except (ValueError, TypeError, AttributeError) as e:
                    self.logger.warning(f"Cosine similarity calculation failed: {e}")
                    score.similarity_score = 0.5
            else:
                # Simple word overlap as fallback
                sentence_words = set(sentence.lower().split())
                text_words = set(full_text.lower().split())
                overlap = len(sentence_words & text_words)
                score.similarity_score = (
                    min(overlap / len(sentence_words), 1.0) if sentence_words else 0
                )

            # Calculate total score (weighted combination)
            score.total_score = (
                score.tf_idf_score * 0.3
                + score.position_score * 0.2
                + score.keyword_score * 0.25
                + score.similarity_score * 0.15
                + score.length_score * 0.1
            )

            sentence_scores.append(score)

        # Sort by total score (highest first)
        sentence_scores.sort(key=lambda x: x.total_score, reverse=True)

        return sentence_scores

    async def _extract_key_topics(self, text: str) -> List[str]:
        """Extract key topics from text"""
        # Simple keyword extraction based on frequency
        words = re.findall(r"\b\w{4,}\b", text.lower())
        words = [word for word in words if word not in self.stop_words]

        # Count word frequencies
        word_counts = Counter(words)

        # Get top topics
        top_words = word_counts.most_common(10)

        # Filter for meaningful topics
        topics = []
        for word, count in top_words:
            if count >= 2 and len(word) >= 4:
                topics.append(word)

        return topics[:5]  # Return top 5 topics

    async def _extract_named_entities(self, text: str) -> List[str]:
        """Extract named entities (simplified approach)"""
        # Simple pattern-based entity extraction
        entities = set()

        # Find capitalized words/phrases (potential proper nouns)
        capitalized_patterns = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", text)
        for entity in capitalized_patterns:
            if len(entity.split()) <= 3 and entity not in [
                "The",
                "This",
                "That",
                "These",
                "Those",
            ]:
                entities.add(entity)

        # Find potential company/organization names
        org_patterns = re.findall(
            r"\b[A-Z][a-z]+(?:\s+[A-Z&][a-z]*)*(?:\s+(?:Inc|LLC|Corp|Ltd|Co)\.?)\b",
            text,
        )
        entities.update(org_patterns)

        return list(entities)[:10]  # Return top 10 entities

    async def _generate_extractive_summary(
        self,
        result: SummaryResult,
        sentence_scores: List[SentenceScore],
        length: SummaryLength,
        focus: Optional[SummaryFocus],
        custom_word_limit: Optional[int],
    ):
        """Generate extractive summary by selecting important sentences"""
        # Determine target word count
        word_limits = {
            SummaryLength.BRIEF: 30,
            SummaryLength.SHORT: 75,
            SummaryLength.MEDIUM: 150,
            SummaryLength.LONG: 300,
            SummaryLength.DETAILED: 500,
        }

        target_words = custom_word_limit or word_limits.get(length, 150)

        # Select sentences based on importance and word limit
        selected_sentences = []
        current_word_count = 0

        # Apply focus filtering if specified
        if focus:
            filtered_scores = self._apply_focus_filter(sentence_scores, focus)
        else:
            filtered_scores = sentence_scores

        for score in filtered_scores:
            sentence_words = len(score.sentence.split())

            if current_word_count + sentence_words <= target_words:
                selected_sentences.append((score.position, score.sentence))
                current_word_count += sentence_words

            if (
                current_word_count >= target_words * 0.9
            ):  # Stop at 90% to avoid going over
                break

        # Sort selected sentences by original position for coherent flow
        selected_sentences.sort(key=lambda x: x[0])

        # Combine into summary text
        summary_sentences = [sentence for _, sentence in selected_sentences]
        result.summary_text = " ".join(summary_sentences)
        result.word_count = len(result.summary_text.split())

        # Create summary segments
        if len(summary_sentences) > 3:
            # Split into segments for longer summaries
            mid_point = len(summary_sentences) // 2

            intro_segment = SummarySegment()
            intro_segment.title = "Key Points"
            intro_segment.content = " ".join(summary_sentences[:mid_point])
            intro_segment.segment_type = "introduction"
            intro_segment.importance = 0.9

            conclusion_segment = SummarySegment()
            conclusion_segment.title = "Additional Details"
            conclusion_segment.content = " ".join(summary_sentences[mid_point:])
            conclusion_segment.segment_type = "conclusion"
            conclusion_segment.importance = 0.7

            result.summary_segments = [intro_segment, conclusion_segment]
        else:
            # Single segment for short summaries
            segment = SummarySegment()
            segment.title = "Summary"
            segment.content = result.summary_text
            segment.segment_type = "content"
            segment.importance = 1.0
            result.summary_segments = [segment]

    def _apply_focus_filter(
        self, sentence_scores: List[SentenceScore], focus: SummaryFocus
    ) -> List[SentenceScore]:
        """Filter sentences based on summary focus"""
        focus_keywords = {
            SummaryFocus.METHODOLOGY: [
                "approach",
                "method",
                "process",
                "procedure",
                "technique",
                "strategy",
                "implementation",
                "framework",
                "system",
                "workflow",
            ],
            SummaryFocus.RESULTS: [
                "result",
                "outcome",
                "finding",
                "conclusion",
                "achievement",
                "success",
                "performance",
                "metric",
                "measurement",
                "data",
            ],
            SummaryFocus.RECOMMENDATIONS: [
                "recommend",
                "suggest",
                "propose",
                "should",
                "must",
                "advise",
                "next steps",
                "action",
                "improvement",
                "enhance",
            ],
            SummaryFocus.TECHNICAL_DETAILS: [
                "technical",
                "system",
                "architecture",
                "configuration",
                "specification",
                "implementation",
                "code",
                "software",
                "hardware",
                "infrastructure",
            ],
            SummaryFocus.BUSINESS_VALUE: [
                "value",
                "benefit",
                "roi",
                "cost",
                "profit",
                "efficiency",
                "improvement",
                "advantage",
                "opportunity",
                "impact",
                "business",
            ],
        }

        if focus not in focus_keywords:
            return sentence_scores

        keywords = focus_keywords[focus]

        # Score sentences based on focus relevance
        focused_scores = []
        for score in sentence_scores:
            sentence_lower = score.sentence.lower()
            focus_score = sum(1 for keyword in keywords if keyword in sentence_lower)

            if focus_score > 0:
                # Boost scores for focus-relevant sentences
                boosted_score = SentenceScore()
                boosted_score.__dict__.update(score.__dict__)
                boosted_score.total_score += focus_score * 0.2
                focused_scores.append(boosted_score)
            else:
                focused_scores.append(score)

        # Re-sort by updated scores
        focused_scores.sort(key=lambda x: x.total_score, reverse=True)
        return focused_scores

    async def _generate_abstractive_summary(
        self,
        result: SummaryResult,
        text: str,
        length: SummaryLength,
        focus: Optional[SummaryFocus],
        custom_word_limit: Optional[int],
    ):
        """Generate abstractive summary using AI"""
        if not aiohttp:
            raise ImportError("aiohttp required for abstractive summarization")

        # Determine target word count
        word_limits = {
            SummaryLength.BRIEF: 30,
            SummaryLength.SHORT: 75,
            SummaryLength.MEDIUM: 150,
            SummaryLength.LONG: 300,
            SummaryLength.DETAILED: 500,
        }

        target_words = custom_word_limit or word_limits.get(length, 150)

        # Build focus instruction
        focus_instruction = ""
        if focus:
            focus_descriptions = {
                SummaryFocus.OVERVIEW: "overall overview and main points",
                SummaryFocus.KEY_POINTS: "most important key points",
                SummaryFocus.METHODOLOGY: "approach and methodology",
                SummaryFocus.RESULTS: "results and findings",
                SummaryFocus.RECOMMENDATIONS: "recommendations and next steps",
                SummaryFocus.TECHNICAL_DETAILS: "technical details and specifications",
                SummaryFocus.BUSINESS_VALUE: "business value and benefits",
            }
            focus_instruction = f"Focus primarily on the {focus_descriptions.get(focus, 'main content')}."

        # Build summarization prompt with advanced prompting if available
        if self.use_advanced_prompting and self.prompt_builder:
            try:
                reasoning_steps = [
                    "Analyze the text structure and identify the main themes",
                    "Determine the key information that must be preserved",
                    f"Apply focus on {focus_instruction.lower() if focus_instruction else 'main content'}",
                    f"Craft a coherent {target_words}-word summary",
                    "Verify all essential information is captured",
                ]

                context = f"Document to summarize (target: {target_words} words): {focus_instruction}"
                task = "Create a comprehensive, coherent summary that captures essential information"

                prompt = create_chain_of_thought_prompt(
                    task=task,
                    context=f"{context}\n\nDocument text:\n{text[:4000]}{'...' if len(text) > 4000 else ''}",
                    reasoning_steps=reasoning_steps,
                    output_format="Provide only the summary without additional commentary.",
                )
            except Exception as e:
                self.logger.warning(
                    f"Advanced prompting failed, using basic prompt: {e}"
                )
                prompt = f"""Summarize the following text in approximately {target_words} words.
{focus_instruction}
Create a clear, coherent summary that captures the essential information and maintains the original meaning.

Text to summarize:
{text[:4000]}{"..." if len(text) > 4000 else ""}

Summary:"""
        else:
            prompt = f"""Summarize the following text in approximately {target_words} words.
{focus_instruction}
Create a clear, coherent summary that captures the essential information and maintains the original meaning.

Text to summarize:
{text[:4000]}{"..." if len(text) > 4000 else ""}

Summary:"""

        # Make API call
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
                        "num_predict": min(target_words + 100, 800),
                    },
                },
            ) as response:
                if response.status == 200:
                    api_result = await response.json()
                    raw_response = api_result.get("response", "").strip()

                    # Filter thinking tags for deepseek-r1 model
                    if "deepseek-r1" in self.ollama_model.lower():
                        summary_text = filter_thinking_tags(raw_response)
                    else:
                        summary_text = raw_response

                    result.summary_text = summary_text
                    result.word_count = len(summary_text.split())

                    # Create single segment for AI summary
                    segment = SummarySegment()
                    segment.title = "AI Summary"
                    segment.content = summary_text
                    segment.segment_type = "content"
                    segment.importance = 1.0
                    result.summary_segments = [segment]

                    # Estimate token usage
                    result.tokens_used = (
                        len(prompt.split()) * 1.3 + len(summary_text.split()) * 1.3
                    )

                else:
                    raise Exception(f"Ollama API error: {response.status}")

    async def _generate_hybrid_summary(
        self,
        result: SummaryResult,
        text: str,
        sentence_scores: List[SentenceScore],
        length: SummaryLength,
        focus: Optional[SummaryFocus],
        custom_word_limit: Optional[int],
    ):
        """Generate hybrid summary combining extractive and abstractive approaches"""
        # First, get key sentences using extractive method
        temp_result = SummaryResult()
        await self._generate_extractive_summary(
            temp_result, sentence_scores, length, focus, custom_word_limit
        )

        key_sentences = temp_result.summary_text

        # Then use AI to create a more coherent version
        if self.use_ai_enhancement and aiohttp:
            try:
                word_limits = {
                    SummaryLength.BRIEF: 30,
                    SummaryLength.SHORT: 75,
                    SummaryLength.MEDIUM: 150,
                    SummaryLength.LONG: 300,
                    SummaryLength.DETAILED: 500,
                }

                target_words = custom_word_limit or word_limits.get(length, 150)

                prompt = f"""Rewrite the following key sentences into a coherent, well-flowing summary of approximately {target_words} words.
Maintain all important information but improve the connections and flow between ideas.

Key sentences:
{key_sentences}

Improved summary:"""

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
                                "num_predict": min(target_words + 50, 600),
                            },
                        },
                    ) as response:
                        if response.status == 200:
                            api_result = await response.json()
                            raw_response = api_result.get("response", "").strip()

                            # Filter thinking tags for deepseek-r1 model
                            if "deepseek-r1" in self.ollama_model.lower():
                                summary_text = filter_thinking_tags(raw_response)
                            else:
                                summary_text = raw_response

                            result.summary_text = summary_text
                            result.word_count = len(summary_text.split())

                            # Create segment
                            segment = SummarySegment()
                            segment.title = "Hybrid Summary"
                            segment.content = summary_text
                            segment.segment_type = "content"
                            segment.importance = 1.0
                            segment.source_sentences = [
                                score.sentence for score in sentence_scores[:5]
                            ]
                            result.summary_segments = [segment]

                        else:
                            raise Exception(f"Ollama API error: {response.status}")

            except Exception as e:
                self.logger.warning(f"Hybrid summarization AI enhancement failed: {e}")
                # Fall back to extractive summary
                result.summary_text = temp_result.summary_text
                result.word_count = temp_result.word_count
                result.summary_segments = temp_result.summary_segments
        else:
            # Use extractive result if AI not available
            result.summary_text = temp_result.summary_text
            result.word_count = temp_result.word_count
            result.summary_segments = temp_result.summary_segments

    async def _generate_bullet_summary(
        self,
        result: SummaryResult,
        text: str,
        sentence_scores: List[SentenceScore],
        length: SummaryLength,
        focus: Optional[SummaryFocus],
    ):
        """Generate bullet point summary"""
        # Determine number of bullet points based on length
        bullet_counts = {
            SummaryLength.BRIEF: 3,
            SummaryLength.SHORT: 5,
            SummaryLength.MEDIUM: 7,
            SummaryLength.LONG: 10,
            SummaryLength.DETAILED: 12,
        }

        num_bullets = bullet_counts.get(length, 7)

        if self.use_ai_enhancement and aiohttp:
            try:
                focus_instruction = ""
                if focus:
                    focus_instruction = f"Focus on {focus.value.replace('_', ' ')}."

                prompt = f"""Create {num_bullets} concise bullet points that summarize the key information from the following text.
{focus_instruction}
Each bullet point should be a complete, informative statement.

Text:
{text[:3500]}{"..." if len(text) > 3500 else ""}

Bullet points:"""

                timeout = ClientTimeout(total=self.ollama_timeout)

                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.post(
                        f"{self.ollama_base_url}/api/generate",
                        json={
                            "model": self.ollama_model,
                            "prompt": prompt,
                            "stream": False,
                            "options": {
                                "temperature": 0.4,
                                "top_p": 0.9,
                                "num_predict": num_bullets * 30,
                            },
                        },
                    ) as response:
                        if response.status == 200:
                            api_result = await response.json()
                            raw_response = api_result.get("response", "").strip()

                            # Filter thinking tags for deepseek-r1 model
                            if "deepseek-r1" in self.ollama_model.lower():
                                bullet_text = filter_thinking_tags(raw_response)
                            else:
                                bullet_text = raw_response

                            result.summary_text = bullet_text
                            result.word_count = len(bullet_text.split())

                            # Extract individual bullets
                            bullet_lines = [
                                line.strip()
                                for line in bullet_text.split("\n")
                                if line.strip()
                            ]
                            bullets = []
                            for line in bullet_lines:
                                # Clean up bullet formatting
                                clean_line = re.sub(r"^[•\-\*]\s*", "", line).strip()
                                if clean_line:
                                    bullets.append(clean_line)

                            result.key_points = bullets[:num_bullets]

                            # Create segment
                            segment = SummarySegment()
                            segment.title = "Key Points"
                            segment.content = bullet_text
                            segment.segment_type = "content"
                            segment.importance = 1.0
                            result.summary_segments = [segment]

                        else:
                            raise Exception(f"Ollama API error: {response.status}")

            except Exception as e:
                self.logger.warning(f"AI bullet summarization failed: {e}")
                # Fall back to extractive bullets
                await self._generate_extractive_bullets(
                    result, sentence_scores, num_bullets
                )
        else:
            await self._generate_extractive_bullets(
                result, sentence_scores, num_bullets
            )

    async def _generate_extractive_bullets(
        self,
        result: SummaryResult,
        sentence_scores: List[SentenceScore],
        num_bullets: int,
    ):
        """Generate bullet points from extractive sentences"""
        # Select top sentences
        top_sentences = sentence_scores[:num_bullets]

        bullets = []
        for i, score in enumerate(top_sentences, 1):
            # Simplify sentence for bullet format
            sentence = score.sentence.strip()
            if not sentence.endswith("."):
                sentence += "."
            bullets.append(f"• {sentence}")

        result.summary_text = "\n".join(bullets)
        result.word_count = len(result.summary_text.split())
        result.key_points = [bullet[2:] for bullet in bullets]  # Remove bullet markers

        # Create segment
        segment = SummarySegment()
        segment.title = "Key Points"
        segment.content = result.summary_text
        segment.segment_type = "content"
        segment.importance = 1.0
        result.summary_segments = [segment]

    async def _generate_executive_summary(
        self,
        result: SummaryResult,
        text: str,
        length: SummaryLength,
        custom_word_limit: Optional[int],
    ):
        """Generate executive-style summary with structured sections"""
        if not self.use_ai_enhancement or not aiohttp:
            # Fall back to extractive approach
            temp_result = SummaryResult()
            sentence_scores = await self._score_sentences(
                self._extract_sentences(text), text
            )
            await self._generate_extractive_summary(
                temp_result, sentence_scores, length, None, custom_word_limit
            )
            result.summary_text = temp_result.summary_text
            result.word_count = temp_result.word_count
            result.summary_segments = temp_result.summary_segments
            return

        try:
            word_limits = {
                SummaryLength.BRIEF: 50,
                SummaryLength.SHORT: 100,
                SummaryLength.MEDIUM: 200,
                SummaryLength.LONG: 400,
                SummaryLength.DETAILED: 600,
            }

            target_words = custom_word_limit or word_limits.get(length, 200)

            prompt = f"""Create an executive summary of approximately {target_words} words from the following text.
Structure the summary with:
1. Brief overview of the main topic/project
2. Key objectives or goals
3. Primary benefits or outcomes
4. Critical next steps or recommendations

Make it suitable for executive decision-makers who need the essential information quickly.

Text:
{text[:4000]}{"..." if len(text) > 4000 else ""}

Executive Summary:"""

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
                            "num_predict": min(target_words + 100, 800),
                        },
                    },
                ) as response:
                    if response.status == 200:
                        api_result = await response.json()
                        raw_response = api_result.get("response", "").strip()

                        # Filter thinking tags for deepseek-r1 model
                        if "deepseek-r1" in self.ollama_model.lower():
                            summary_text = filter_thinking_tags(raw_response)
                        else:
                            summary_text = raw_response

                        result.summary_text = summary_text
                        result.word_count = len(summary_text.split())

                        # Try to parse into sections
                        sections = self._parse_executive_sections(summary_text)
                        result.summary_segments = sections

                    else:
                        raise Exception(f"Ollama API error: {response.status}")

        except Exception as e:
            self.logger.error(f"Executive summary generation failed: {e}")
            result.errors.append(f"Executive summary generation failed: {str(e)}")

    def _parse_executive_sections(self, summary_text: str) -> List[SummarySegment]:
        """Parse executive summary into structured sections"""
        segments = []

        # Try to identify section headers
        lines = summary_text.split("\n")
        current_segment = None
        current_content = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Check if line looks like a header
            if (
                line.endswith(":")
                or re.match(r"^\d+\.\s", line)
                or line.isupper()
                and len(line) < 50
            ):
                # Save previous segment if exists
                if current_segment and current_content:
                    current_segment.content = "\n".join(current_content)
                    segments.append(current_segment)

                # Start new segment
                current_segment = SummarySegment()
                current_segment.title = line.rstrip(":")
                current_segment.segment_type = "content"
                current_segment.importance = 0.8
                current_content = []
            else:
                current_content.append(line)

        # Add final segment
        if current_segment and current_content:
            current_segment.content = "\n".join(current_content)
            segments.append(current_segment)

        # If no clear sections found, create single segment
        if not segments:
            segment = SummarySegment()
            segment.title = "Executive Summary"
            segment.content = summary_text
            segment.segment_type = "content"
            segment.importance = 1.0
            segments = [segment]

        return segments

    async def _assess_summary_quality(self, result: SummaryResult, original_text: str):
        """Assess quality of generated summary"""
        if not result.summary_text:
            return

        original_word_count = len(original_text.split())
        summary_word_count = len(result.summary_text.split())

        # Compression ratio
        if original_word_count > 0:
            result.compression_ratio = summary_word_count / original_word_count

        # Coverage assessment (how much of original content is represented)
        original_words = set(original_text.lower().split())
        summary_words = set(result.summary_text.lower().split())

        if original_words:
            word_overlap = len(original_words & summary_words) / len(original_words)
            result.coverage_score = min(word_overlap * 2, 1.0)  # Scale up overlap
        else:
            result.coverage_score = 0.0

        # Coherence assessment (basic sentence flow)
        sentences = self._extract_sentences(result.summary_text)
        if len(sentences) > 1:
            # Simple coherence check based on sentence connections
            coherence_indicators = [
                "however",
                "therefore",
                "furthermore",
                "additionally",
                "consequently",
            ]
            coherence_count = sum(
                1
                for sentence in sentences
                for indicator in coherence_indicators
                if indicator in sentence.lower()
            )
            result.coherence_score = min(0.6 + coherence_count * 0.2, 1.0)
        else:
            result.coherence_score = 0.8  # Single sentence assumed coherent

        # Informativeness (presence of key information)
        informativeness_factors = []

        # Check for key topics
        if result.key_topics:
            topics_in_summary = sum(
                1 for topic in result.key_topics if topic in result.summary_text.lower()
            )
            informativeness_factors.append(topics_in_summary / len(result.key_topics))

        # Check for named entities
        if result.named_entities:
            entities_in_summary = sum(
                1 for entity in result.named_entities if entity in result.summary_text
            )
            informativeness_factors.append(
                entities_in_summary / len(result.named_entities)
            )

        if informativeness_factors:
            result.informativeness = sum(informativeness_factors) / len(
                informativeness_factors
            )
        else:
            result.informativeness = 0.7  # Default reasonable value

        # Readability (simple sentence length assessment)
        if sentences:
            avg_sentence_length = sum(len(s.split()) for s in sentences) / len(
                sentences
            )
            if 10 <= avg_sentence_length <= 20:
                result.readability_score = 1.0
            elif 5 <= avg_sentence_length <= 25:
                result.readability_score = 0.8
            else:
                result.readability_score = 0.6
        else:
            result.readability_score = 0.5

    async def _extract_key_points_from_summary(self, summary_text: str) -> List[str]:
        """Extract key points from generated summary"""
        if not summary_text:
            return []

        sentences = self._extract_sentences(summary_text)

        # For short summaries, each sentence is a key point
        if len(sentences) <= 3:
            return sentences

        # For longer summaries, try to identify the most important sentences
        key_points = []

        for sentence in sentences:
            sentence_lower = sentence.lower()

            # Look for sentences with importance indicators
            importance_score = 0

            # Check for key phrases
            if any(
                phrase in sentence_lower
                for phrase in ["key", "important", "critical", "main", "primary"]
            ):
                importance_score += 2

            if any(
                phrase in sentence_lower
                for phrase in ["significant", "major", "essential", "fundamental"]
            ):
                importance_score += 1

            # Check for structural indicators
            if any(
                phrase in sentence_lower
                for phrase in ["first", "second", "finally", "in conclusion"]
            ):
                importance_score += 1

            # Check sentence position (first and last often important)
            if sentence == sentences[0] or sentence == sentences[-1]:
                importance_score += 1

            if importance_score >= 2 or len(key_points) < 3:
                key_points.append(sentence)

            if len(key_points) >= 5:  # Limit to 5 key points
                break

        return key_points

    def _compile_summarization_statistics(
        self, result: SummaryResult, original_text: str
    ) -> Dict[str, Any]:
        """Compile comprehensive summarization statistics"""
        return {
            "summarization_summary": {
                "success": result.success,
                "summary_type": result.summary_type.value,
                "summary_length": result.summary_length.value,
                "model_calls": result.model_calls,
                "tokens_used": result.tokens_used,
                "processing_time": result.processing_time,
            },
            "content_metrics": {
                "original_word_count": len(original_text.split()),
                "summary_word_count": result.word_count,
                "compression_ratio": result.compression_ratio,
                "sentences_analyzed": len(result.important_sentences),
                "key_topics_identified": len(result.key_topics),
                "named_entities_found": len(result.named_entities),
            },
            "quality_scores": {
                "coherence_score": result.coherence_score,
                "coverage_score": result.coverage_score,
                "informativeness": result.informativeness,
                "readability_score": result.readability_score,
            },
            "summary_structure": {
                "segments_created": len(result.summary_segments),
                "key_points_extracted": len(result.key_points),
                "segment_types": [seg.segment_type for seg in result.summary_segments],
            },
        }

    async def create_multi_perspective_summary(
        self,
        text: str,
        perspectives: List[SummaryFocus],
        length: SummaryLength = SummaryLength.MEDIUM,
    ) -> Dict[str, SummaryResult]:
        """Create summaries from multiple perspectives"""
        results = {}

        # Process perspectives in parallel (with limited concurrency)
        semaphore = asyncio.Semaphore(2)  # Limit concurrent API calls

        async def summarize_perspective(perspective):
            async with semaphore:
                return await self.summarize_document(
                    text, SummaryType.ABSTRACTIVE, length, perspective
                )

        tasks = {
            perspective.value: summarize_perspective(perspective)
            for perspective in perspectives
        }
        perspective_results = await asyncio.gather(
            *tasks.values(), return_exceptions=True
        )

        # Combine results
        for i, (perspective_name, result) in enumerate(
            zip(tasks.keys(), perspective_results)
        ):
            if isinstance(result, Exception):
                error_result = SummaryResult()
                error_result.errors.append(
                    f"Perspective summarization failed: {str(result)}"
                )
                results[perspective_name] = error_result
            else:
                results[perspective_name] = result

        return results

    def get_summarizer_info(self) -> Dict[str, Any]:
        """Get comprehensive summarizer information"""
        return {
            "summarizer_version": "1.0.0",
            "ollama_model": self.ollama_model,
            "supported_summary_types": [
                summary_type.value for summary_type in SummaryType
            ],
            "supported_lengths": [length.value for length in SummaryLength],
            "supported_focuses": [focus.value for focus in SummaryFocus],
            "features": {
                "extractive_summarization": True,
                "abstractive_summarization": self.use_ai_enhancement
                and aiohttp is not None,
                "hybrid_summarization": True,
                "multi_perspective": True,
                "quality_assessment": True,
                "key_point_extraction": True,
                "named_entity_extraction": True,
                "topic_extraction": True,
            },
            "configuration": {
                "ai_enhancement_enabled": self.use_ai_enhancement,
                "default_length": self.default_length.value,
                "extractive_fallback_enabled": self.enable_extractive_fallback,
                "timeout": self.ollama_timeout,
            },
        }

    async def close(self):
        """Close summarizer and cleanup resources"""
        self.logger.info("DocumentSummarizer closed")

# Factory function
def create_document_summarizer(
    config: Optional[Dict[str, Any]] = None,
) -> DocumentSummarizer:
    """Create DocumentSummarizer instance with configuration"""
    if config is None:
        config = {}

    default_length = config.get("default_length", "medium")
    if isinstance(default_length, str):
        default_length = SummaryLength(default_length)

    return DocumentSummarizer(
        ollama_base_url=config.get("ollama_base_url", "http://localhost:11434"),
        ollama_model=config.get("ollama_model", "deepseek-r1:32b"),
        ollama_timeout=config.get("ollama_timeout", 180.0),
        use_ai_enhancement=config.get("use_ai_enhancement", True),
        default_length=default_length,
        enable_extractive_fallback=config.get("enable_extractive_fallback", True),
        use_advanced_prompting=config.get("use_advanced_prompting", True),
    )
