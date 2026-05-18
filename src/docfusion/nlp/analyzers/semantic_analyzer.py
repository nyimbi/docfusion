#!/usr/bin/env python3
"""
Semantic Analyzer with Ollama Integration

Advanced topic modeling, similarity analysis, and semantic understanding with AI-powered
insights for comprehensive document analysis and content relationships.
"""

import json
import logging
import re
from collections import Counter
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
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
            SEMANTIC_ANALYSIS = "semantic_analysis"

        class LLMConfiguration:
            def __init__(self):
                self.model = "deepseek-r1:32b"
                self.base_url = "http://localhost:11434"
                self.timeout = 120.0
                self.temperature = 0.2
                self.top_p = 0.9
                self.num_predict = 2000
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
    from aiohttp import ClientTimeout
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
    import numpy as np
    from sklearn.cluster import KMeans
    from sklearn.decomposition import LatentDirichletAllocation
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    np = TfidfVectorizer = cosine_similarity = LatentDirichletAllocation = KMeans = None

class TopicModelType(Enum):
    """Topic modeling algorithm types"""

    LDA = "latent_dirichlet_allocation"
    CLUSTERING = "kmeans_clustering"
    AI_ENHANCED = "ollama_ai_topics"

class SimilarityMetric(Enum):
    """Similarity calculation methods"""

    COSINE = "cosine_similarity"
    JACCARD = "jaccard_similarity"
    SEMANTIC_AI = "ai_semantic_similarity"

@dataclass
class Topic:
    """Represents a discovered topic"""

    id: str = field(default_factory=uuid7str)
    name: str = ""
    keywords: List[str] = field(default_factory=list)
    weight: float = 0.0
    confidence: float = 0.0
    description: str = ""

    # Supporting information
    representative_phrases: List[str] = field(default_factory=list)
    related_entities: List[str] = field(default_factory=list)
    document_coverage: float = 0.0  # Percentage of document covered by this topic

@dataclass
class SemanticCluster:
    """Represents a cluster of semantically related content"""

    id: str = field(default_factory=uuid7str)
    name: str = ""
    centroid_text: str = ""
    member_texts: List[str] = field(default_factory=list)
    coherence_score: float = 0.0
    size: int = 0

    # Cluster characteristics
    keywords: List[str] = field(default_factory=list)
    themes: List[str] = field(default_factory=list)
    representative_sentence: str = ""

@dataclass
class SimilarityAnalysis:
    """Text similarity analysis results"""

    similarity_score: float = 0.0
    similarity_type: SimilarityMetric = SimilarityMetric.COSINE
    confidence: float = 0.0

    # Detailed breakdown
    lexical_similarity: float = 0.0
    semantic_similarity: float = 0.0
    structural_similarity: float = 0.0

    # Supporting evidence
    common_terms: List[str] = field(default_factory=list)
    shared_concepts: List[str] = field(default_factory=list)
    similarity_explanation: str = ""

@dataclass
class ConceptMap:
    """Semantic concept mapping"""

    concepts: List[str] = field(default_factory=list)
    relationships: List[Tuple[str, str, str]] = field(
        default_factory=list
    )  # (concept1, relation, concept2)
    concept_weights: Dict[str, float] = field(default_factory=dict)
    central_concepts: List[str] = field(default_factory=list)

@dataclass
class SemanticAnalysisResult:
    """Comprehensive semantic analysis result"""

    success: bool = False
    analysis_id: str = field(default_factory=uuid7str)

    # Core analysis components
    topics: List[Topic] = field(default_factory=list)
    semantic_clusters: List[SemanticCluster] = field(default_factory=list)
    concept_map: ConceptMap = field(default_factory=ConceptMap)

    # AI-enhanced insights
    ai_analysis: Optional[Dict[str, Any]] = None
    thematic_summary: str = ""
    content_themes: List[str] = field(default_factory=list)

    # Analysis metadata
    processing_time: float = 0.0
    confidence_score: float = 0.0
    topic_model_type: TopicModelType = TopicModelType.AI_ENHANCED

    # Statistical summaries
    statistics: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

class SemanticAnalyzer:
    """Advanced semantic analyzer with topic modeling and similarity analysis"""

    def __init__(
        self,
        llm_config: Optional[LLMConfiguration] = None,
        use_ai_enhancement: bool = True,
        num_topics: int = 5,
        min_topic_probability: float = 0.1,
        similarity_threshold: float = 0.3,
    ):
        # Load centralized LLM configuration
        self.llm_config = llm_config or get_llm_config(LLMTask.SEMANTIC_ANALYSIS)
        self.use_ai_enhancement = use_ai_enhancement
        self.num_topics = num_topics
        self.min_topic_probability = min_topic_probability
        self.similarity_threshold = similarity_threshold
        self.logger = logging.getLogger(__name__)

        # Initialize stop words and preprocessing
        self._initialize_preprocessing()

        self.logger.info(
            f"SemanticAnalyzer initialized with model: {self.llm_config.model} from centralized config"
        )

    def _initialize_preprocessing(self):
        """Initialize text preprocessing components using NLTK stopwords"""
        # Use NLTK stopwords with additional semantic analysis words
        if HAS_NLTK:
            base_stopwords = set(stopwords.words("english"))
            # Add semantic analysis specific stopwords
            semantic_stopwords = {
                "now",
                "however",
                "also",
                "therefore",
                "thus",
                "hence",
                "moreover",
                "furthermore",
                "nevertheless",
                "although",
                "indeed",
                "particularly",
            }
            self.stop_words = base_stopwords | semantic_stopwords
        else:
            # Fallback to minimal custom stopwords
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
                "will",
                "would",
                "should",
                "could",
                "can",
                "may",
                "might",
                "must",
                "shall",
            }

        # Domain-specific concept keywords for RFP/proposal analysis
        self.domain_concepts = {
            "technical_concepts": {
                "architecture",
                "infrastructure",
                "system",
                "platform",
                "framework",
                "database",
                "integration",
                "api",
                "security",
                "scalability",
                "performance",
            },
            "project_concepts": {
                "requirement",
                "deliverable",
                "milestone",
                "timeline",
                "budget",
                "resource",
                "stakeholder",
                "objective",
                "scope",
                "risk",
                "quality",
                "testing",
            },
            "business_concepts": {
                "strategy",
                "value",
                "benefit",
                "roi",
                "cost",
                "efficiency",
                "compliance",
                "governance",
                "vendor",
                "procurement",
                "contract",
                "agreement",
            },
        }

    async def analyze_semantics(
        self, text: str, use_ai: Optional[bool] = None, num_topics: Optional[int] = None
    ) -> SemanticAnalysisResult:
        """Perform comprehensive semantic analysis"""
        start_time = time.monotonic()
        result = SemanticAnalysisResult()

        try:
            assert text and text.strip(), "Text content is required"

            use_ai = use_ai if use_ai is not None else self.use_ai_enhancement
            num_topics = num_topics if num_topics is not None else self.num_topics

            # Step 1: Preprocess text
            processed_text = self._preprocess_text(text)
            sentences = self._split_into_sentences(text)

            # Step 2: Extract topics using multiple methods
            if use_ai and aiohttp:
                try:
                    # AI-enhanced topic modeling
                    ai_topics = await self._ai_topic_modeling(text, num_topics)
                    result.topics.extend(ai_topics)
                    result.topic_model_type = TopicModelType.AI_ENHANCED
                except Exception as e:
                    result.warnings.append(f"AI topic modeling failed: {str(e)}")
                    self.logger.warning(f"AI topic modeling failed: {e}")

            # Fallback to traditional methods if AI fails or is disabled
            if not result.topics and TfidfVectorizer:
                try:
                    traditional_topics = await self._traditional_topic_modeling(
                        processed_text, sentences, num_topics
                    )
                    result.topics.extend(traditional_topics)
                    result.topic_model_type = (
                        TopicModelType.LDA
                        if LatentDirichletAllocation
                        else TopicModelType.CLUSTERING
                    )
                except Exception as e:
                    result.warnings.append(
                        f"Traditional topic modeling failed: {str(e)}"
                    )
                    self.logger.warning(f"Traditional topic modeling failed: {e}")

            # Step 3: Create semantic clusters
            if len(sentences) > 3:
                result.semantic_clusters = await self._create_semantic_clusters(
                    sentences, result.topics
                )

            # Step 4: Build concept map
            result.concept_map = await self._build_concept_map(text, result.topics)

            # Step 5: AI-enhanced thematic analysis
            if use_ai and aiohttp:
                try:
                    result.ai_analysis = await self._ai_thematic_analysis(text)
                    result.thematic_summary = result.ai_analysis.get(
                        "thematic_summary", ""
                    )
                    result.content_themes = result.ai_analysis.get("main_themes", [])
                except Exception as e:
                    result.warnings.append(f"AI thematic analysis failed: {str(e)}")

            # Step 6: Calculate confidence and statistics
            result.confidence_score = self._calculate_semantic_confidence(result)
            result.statistics = self._compile_semantic_statistics(result, text)

            result.success = len(result.errors) == 0
            result.processing_time = time.monotonic() - start_time

            self.logger.info(
                f"Semantic analysis completed, topics: {len(result.topics)}, "
                f"clusters: {len(result.semantic_clusters)}"
            )

        except Exception as e:
            result.errors.append(f"Semantic analysis failed: {str(e)}")
            self.logger.error(f"Semantic analysis error: {e}")

        return result

    def _preprocess_text(self, text: str) -> str:
        """Preprocess text for semantic analysis"""
        import re

        # Convert to lowercase
        processed = text.lower()

        # Remove extra whitespace and special characters
        processed = re.sub(r"\s+", " ", processed)
        processed = re.sub(r"[^\w\s]", " ", processed)

        # Remove stop words
        words = processed.split()
        filtered_words = [
            word for word in words if word not in self.stop_words and len(word) > 2
        ]

        return " ".join(filtered_words)

    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences for analysis"""
        import re

        # Simple sentence splitting
        sentences = re.split(r"[.!?]+\s+", text)
        sentences = [s.strip() for s in sentences if s.strip() and len(s.split()) > 3]

        return sentences

    async def _ai_topic_modeling(self, text: str, num_topics: int) -> List[Topic]:
        """AI-enhanced topic modeling using Ollama with Chain-of-Thought prompting"""
        if not aiohttp:
            raise ImportError("aiohttp required for AI topic modeling")

        # Create Chain-of-Thought prompt for comprehensive topic modeling
        task = f"Analyze the provided text and identify the {num_topics} most important topics or themes"
        context = f"Text to analyze (first 4000 chars): {text[:4000]}{'...' if len(text) > 4000 else ''}"

        reasoning_steps = [
            "Read through the entire text carefully to understand its overall context and purpose",
            "Identify recurring keywords, phrases, and concepts throughout the text",
            "Group related concepts and ideas into coherent thematic clusters",
            "Determine the relative importance of each theme based on frequency and context",
            "Create clear, descriptive names for each identified topic",
            "Extract the most representative keywords for each topic",
            "Assess confidence levels based on clarity and consistency of each topic",
        ]

        output_format = """JSON format:
{
	"topics": [
		{
			"name": "Clear, descriptive topic name",
			"keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
			"description": "Brief but comprehensive description of the topic",
			"weight": 0.0-1.0,
			"confidence": 0.0-1.0
		}
	]
}"""

        examples = [
            "For technical documentation: topics like 'System Architecture', 'Security Requirements', 'Implementation Timeline'",
            "For business proposals: topics like 'Project Objectives', 'Resource Requirements', 'Risk Management'",
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
                        parsed_response = json.loads(ai_response)
                        topics = []

                        for i, topic_data in enumerate(
                            parsed_response.get("topics", [])
                        ):
                            topic = Topic()
                            topic.name = topic_data.get("name", f"Topic {i + 1}")
                            topic.keywords = topic_data.get("keywords", [])
                            topic.description = topic_data.get("description", "")
                            topic.weight = float(topic_data.get("weight", 0.5))
                            topic.confidence = float(topic_data.get("confidence", 0.7))

                            # Calculate document coverage based on keyword frequency
                            if topic.keywords:
                                text_lower = text.lower()
                                keyword_count = sum(
                                    text_lower.count(kw.lower())
                                    for kw in topic.keywords
                                )
                                word_count = len(text.split())
                                topic.document_coverage = (
                                    min(keyword_count / word_count * 10, 1.0)
                                    if word_count > 0
                                    else 0
                                )

                            topics.append(topic)

                        return topics

                    except (json.JSONDecodeError, KeyError, ValueError) as e:
                        self.logger.warning(f"Failed to parse AI topic response: {e}")
                        # Create fallback topic from response
                        fallback_topic = Topic()
                        fallback_topic.name = "AI Analysis Available"
                        fallback_topic.description = ai_response[:200]
                        fallback_topic.weight = 0.5
                        fallback_topic.confidence = 0.3
                        return [fallback_topic]
                else:
                    raise Exception(f"Ollama API error: {response.status}")

    async def _traditional_topic_modeling(
        self, processed_text: str, sentences: List[str], num_topics: int
    ) -> List[Topic]:
        """Traditional topic modeling using TF-IDF and clustering/LDA"""
        if not TfidfVectorizer:
            return []

        topics = []

        try:
            # Use sentences as documents for topic modeling
            if len(sentences) < 2:
                return topics

            # Create TF-IDF vectors
            vectorizer = TfidfVectorizer(
                max_features=200,
                ngram_range=(1, 2),
                stop_words="english"
                if hasattr(TfidfVectorizer(), "stop_words")
                else None,
            )

            tfidf_matrix = vectorizer.fit_transform(sentences)
            feature_names = vectorizer.get_feature_names_out()

            # Try LDA if available
            if LatentDirichletAllocation:
                lda = LatentDirichletAllocation(
                    n_components=min(num_topics, len(sentences)),
                    random_state=42,
                    max_iter=10,
                )
                lda.fit(tfidf_matrix)

                for topic_idx, topic in enumerate(lda.components_):
                    top_indices = topic.argsort()[-10:][::-1]
                    top_words = [feature_names[i] for i in top_indices]

                    topic_obj = Topic()
                    topic_obj.name = f"Topic {topic_idx + 1}"
                    topic_obj.keywords = top_words[:5]
                    topic_obj.weight = float(np.max(topic)) if np else 0.5
                    topic_obj.confidence = 0.6
                    topic_obj.description = f"Topic identified through statistical analysis: {', '.join(top_words[:3])}"

                    topics.append(topic_obj)

            # Fallback to clustering if LDA not available
            elif KMeans and len(sentences) >= num_topics:
                kmeans = KMeans(
                    n_clusters=min(num_topics, len(sentences)), random_state=42
                )
                clusters = kmeans.fit_predict(tfidf_matrix)

                for cluster_id in range(num_topics):
                    cluster_sentences = [
                        sentences[i] for i, c in enumerate(clusters) if c == cluster_id
                    ]
                    if cluster_sentences:
                        # Find most representative terms for this cluster
                        cluster_tfidf = tfidf_matrix[clusters == cluster_id]
                        if cluster_tfidf.shape[0] > 0:
                            mean_tfidf = (
                                np.mean(cluster_tfidf.toarray(), axis=0)
                                if np
                                else [0.5] * len(feature_names)
                            )
                            top_indices = sorted(
                                range(len(mean_tfidf)),
                                key=lambda i: mean_tfidf[i],
                                reverse=True,
                            )[:10]
                            top_words = [feature_names[i] for i in top_indices]

                            topic_obj = Topic()
                            topic_obj.name = f"Cluster {cluster_id + 1}"
                            topic_obj.keywords = top_words[:5]
                            topic_obj.weight = 0.5
                            topic_obj.confidence = 0.5
                            topic_obj.description = f"Cluster of related content: {', '.join(top_words[:3])}"
                            topic_obj.representative_phrases = cluster_sentences[:2]

                            topics.append(topic_obj)

        except Exception as e:
            self.logger.warning(f"Traditional topic modeling failed: {e}")

        return topics

    async def _create_semantic_clusters(
        self, sentences: List[str], topics: List[Topic]
    ) -> List[SemanticCluster]:
        """Create semantic clusters from sentences"""
        clusters = []

        if not TfidfVectorizer or len(sentences) < 3:
            return clusters

        try:
            # Create TF-IDF vectors for sentences
            vectorizer = TfidfVectorizer(
                max_features=100,
                stop_words="english"
                if hasattr(TfidfVectorizer(), "stop_words")
                else None,
            )
            tfidf_matrix = vectorizer.fit_transform(sentences)

            # Simple clustering based on similarity
            num_clusters = min(3, len(sentences) // 2)

            if KMeans and num_clusters > 1:
                kmeans = KMeans(n_clusters=num_clusters, random_state=42)
                cluster_labels = kmeans.fit_predict(tfidf_matrix)

                for cluster_id in range(num_clusters):
                    cluster_sentences = [
                        sentences[i]
                        for i, label in enumerate(cluster_labels)
                        if label == cluster_id
                    ]

                    if cluster_sentences:
                        cluster = SemanticCluster()
                        cluster.name = f"Semantic Cluster {cluster_id + 1}"
                        cluster.member_texts = cluster_sentences
                        cluster.size = len(cluster_sentences)
                        cluster.representative_sentence = cluster_sentences[
                            0
                        ]  # Use first as representative

                        # Calculate coherence based on average similarity within cluster
                        if len(cluster_sentences) > 1:
                            cluster_indices = [
                                i
                                for i, label in enumerate(cluster_labels)
                                if label == cluster_id
                            ]
                            cluster_matrix = tfidf_matrix[cluster_indices]
                            if cosine_similarity:
                                similarities = cosine_similarity(cluster_matrix)
                                cluster.coherence_score = (
                                    float(np.mean(similarities)) if np else 0.5
                                )
                            else:
                                cluster.coherence_score = 0.5
                        else:
                            cluster.coherence_score = 1.0

                        # Extract themes from related topics
                        cluster.themes = [
                            topic.name
                            for topic in topics
                            if any(
                                kw in " ".join(cluster_sentences).lower()
                                for kw in topic.keywords
                            )
                        ]

                        clusters.append(cluster)

        except Exception as e:
            self.logger.warning(f"Semantic clustering failed: {e}")

        return clusters

    async def _build_concept_map(self, text: str, topics: List[Topic]) -> ConceptMap:
        """Build semantic concept map"""
        concept_map = ConceptMap()

        try:
            # Extract concepts from topics and domain knowledge
            all_concepts = set()

            # Add topic keywords as concepts
            for topic in topics:
                all_concepts.update(topic.keywords)

            # Add domain-specific concepts that appear in text
            text_lower = text.lower()
            for category, concepts in self.domain_concepts.items():
                for concept in concepts:
                    if concept in text_lower:
                        all_concepts.add(concept)

            concept_map.concepts = list(all_concepts)

            # Calculate concept weights based on frequency
            word_counts = Counter(text_lower.split())
            total_words = sum(word_counts.values())

            for concept in concept_map.concepts:
                count = word_counts.get(concept, 0)
                concept_map.concept_weights[concept] = (
                    count / total_words if total_words > 0 else 0
                )

            # Identify central concepts (high frequency, appear across topics)
            concept_scores = {}
            for concept in concept_map.concepts:
                score = concept_map.concept_weights.get(concept, 0)

                # Bonus for appearing in multiple topics
                topic_appearances = sum(
                    1 for topic in topics if concept in topic.keywords
                )
                if topic_appearances > 1:
                    score *= 1.5

                concept_scores[concept] = score

            # Select top central concepts
            sorted_concepts = sorted(
                concept_scores.items(), key=lambda x: x[1], reverse=True
            )
            concept_map.central_concepts = [
                concept for concept, score in sorted_concepts[:5]
            ]

            # Create simple relationships (co-occurrence based)
            for i, concept1 in enumerate(concept_map.central_concepts):
                for concept2 in concept_map.central_concepts[i + 1 :]:
                    # Check if concepts co-occur in sentences
                    sentences = self._split_into_sentences(text)
                    cooccurrence = sum(
                        1
                        for sent in sentences
                        if concept1 in sent.lower() and concept2 in sent.lower()
                    )

                    if cooccurrence > 0:
                        relation_type = "co-occurs_with"
                        if concept1 in self.domain_concepts.get(
                            "technical_concepts", set()
                        ) and concept2 in self.domain_concepts.get(
                            "business_concepts", set()
                        ):
                            relation_type = "technical_supports"
                        elif concept1 in self.domain_concepts.get(
                            "project_concepts", set()
                        ) and concept2 in self.domain_concepts.get(
                            "business_concepts", set()
                        ):
                            relation_type = "project_delivers"

                        concept_map.relationships.append(
                            (concept1, relation_type, concept2)
                        )

        except Exception as e:
            self.logger.warning(f"Concept map building failed: {e}")

        return concept_map

    async def _ai_thematic_analysis(self, text: str) -> Dict[str, Any]:
        """AI-powered thematic analysis using advanced prompting"""
        if not aiohttp:
            raise ImportError("aiohttp required for AI thematic analysis")

        # Create Chain-of-Thought prompt for comprehensive thematic analysis
        task = "Analyze the main themes and semantic content of the provided text comprehensively"
        context = f"Text to analyze (first 3000 chars): {text[:3000]}{'...' if len(text) > 3000 else ''}"

        reasoning_steps = [
            "Identify the overall document type and domain context",
            "Extract and categorize the main themes that run throughout the text",
            "Analyze relationships and connections between different concepts",
            "Determine the primary focus and purpose of the content",
            "Assess the semantic structure and information hierarchy",
            "Summarize the thematic essence in a concise, comprehensive way",
        ]

        output_format = """JSON format:
{
	"thematic_summary": "Comprehensive 2-3 sentence summary of main themes",
	"main_themes": ["theme1", "theme2", "theme3", "theme4", "theme5"],
	"semantic_relationships": [
		{"concept1": "A", "relation": "specific_relationship_type", "concept2": "B"}
	],
	"content_focus": "primary focus area or domain",
	"purpose": "specific document purpose or intent"
}"""

        examples = [
            "For project proposals: themes like objectives, requirements, implementation strategy",
            "For technical documents: themes like architecture, functionality, integration patterns",
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
                            "thematic_summary": "AI analysis available in raw format",
                            "main_themes": ["AI-identified themes"],
                            "raw_analysis": ai_response,
                        }
                else:
                    raise Exception(f"Ollama API error: {response.status}")

    def _calculate_semantic_confidence(self, result: SemanticAnalysisResult) -> float:
        """Calculate overall confidence in semantic analysis"""
        confidence_factors = []

        # Topic quality factor
        if result.topics:
            avg_topic_confidence = sum(
                topic.confidence for topic in result.topics
            ) / len(result.topics)
            confidence_factors.append(avg_topic_confidence)

        # Cluster quality factor
        if result.semantic_clusters:
            avg_cluster_coherence = sum(
                cluster.coherence_score for cluster in result.semantic_clusters
            ) / len(result.semantic_clusters)
            confidence_factors.append(avg_cluster_coherence)
        else:
            confidence_factors.append(0.5)  # Neutral if no clustering

        # Concept map completeness
        concept_completeness = min(len(result.concept_map.concepts) / 10, 1.0)
        confidence_factors.append(concept_completeness)

        # AI analysis quality
        if result.ai_analysis:
            confidence_factors.append(0.8)  # High confidence for AI analysis

        return (
            sum(confidence_factors) / len(confidence_factors)
            if confidence_factors
            else 0.5
        )

    def _compile_semantic_statistics(
        self, result: SemanticAnalysisResult, text: str
    ) -> Dict[str, Any]:
        """Compile comprehensive semantic analysis statistics"""
        return {
            "analysis_summary": {
                "topics_identified": len(result.topics),
                "semantic_clusters": len(result.semantic_clusters),
                "concepts_mapped": len(result.concept_map.concepts),
                "central_concepts": len(result.concept_map.central_concepts),
                "concept_relationships": len(result.concept_map.relationships),
            },
            "topic_analysis": {
                "avg_topic_weight": sum(topic.weight for topic in result.topics)
                / len(result.topics)
                if result.topics
                else 0,
                "avg_topic_confidence": sum(topic.confidence for topic in result.topics)
                / len(result.topics)
                if result.topics
                else 0,
                "topic_model_type": result.topic_model_type.value,
            },
            "clustering_metrics": {
                "avg_cluster_size": sum(
                    cluster.size for cluster in result.semantic_clusters
                )
                / len(result.semantic_clusters)
                if result.semantic_clusters
                else 0,
                "avg_coherence_score": sum(
                    cluster.coherence_score for cluster in result.semantic_clusters
                )
                / len(result.semantic_clusters)
                if result.semantic_clusters
                else 0,
            },
            "content_metrics": {
                "text_length": len(text),
                "word_count": len(text.split()),
                "unique_concepts_ratio": len(result.concept_map.concepts)
                / len(set(text.lower().split()))
                if text
                else 0,
            },
        }

    async def calculate_similarity(
        self,
        text1: str,
        text2: str,
        similarity_type: SimilarityMetric = SimilarityMetric.COSINE,
    ) -> SimilarityAnalysis:
        """Calculate similarity between two texts"""
        analysis = SimilarityAnalysis()
        analysis.similarity_type = similarity_type

        try:
            if (
                similarity_type == SimilarityMetric.COSINE
                and TfidfVectorizer
                and cosine_similarity
            ):
                analysis = await self._cosine_similarity_analysis(text1, text2)
            elif similarity_type == SimilarityMetric.JACCARD:
                analysis = await self._jaccard_similarity_analysis(text1, text2)
            elif similarity_type == SimilarityMetric.SEMANTIC_AI and aiohttp:
                analysis = await self._ai_similarity_analysis(text1, text2)
            else:
                # Fallback to simple word overlap
                analysis = await self._simple_similarity_analysis(text1, text2)

        except Exception as e:
            self.logger.error(f"Similarity analysis failed: {e}")
            analysis.similarity_score = 0.0
            analysis.confidence = 0.1

        return analysis

    async def _cosine_similarity_analysis(
        self, text1: str, text2: str
    ) -> SimilarityAnalysis:
        """Calculate cosine similarity using TF-IDF vectors"""
        analysis = SimilarityAnalysis()
        analysis.similarity_type = SimilarityMetric.COSINE

        vectorizer = TfidfVectorizer(
            stop_words="english" if hasattr(TfidfVectorizer(), "stop_words") else None
        )
        tfidf_matrix = vectorizer.fit_transform([text1, text2])
        similarity_matrix = cosine_similarity(tfidf_matrix)

        analysis.similarity_score = float(similarity_matrix[0, 1])
        analysis.lexical_similarity = analysis.similarity_score
        analysis.confidence = 0.8

        # Extract common terms
        feature_names = vectorizer.get_feature_names_out()
        tfidf_array = tfidf_matrix.toarray()

        # Find terms that appear in both documents with significant weight
        common_indices = []
        for i, feature in enumerate(feature_names):
            if tfidf_array[0, i] > 0.1 and tfidf_array[1, i] > 0.1:
                common_indices.append(i)

        analysis.common_terms = [feature_names[i] for i in common_indices[:10]]

        return analysis

    async def _jaccard_similarity_analysis(
        self, text1: str, text2: str
    ) -> SimilarityAnalysis:
        """Calculate Jaccard similarity based on word sets"""
        analysis = SimilarityAnalysis()
        analysis.similarity_type = SimilarityMetric.JACCARD

        words1 = set(self._preprocess_text(text1).split())
        words2 = set(self._preprocess_text(text2).split())

        intersection = words1 & words2
        union = words1 | words2

        if union:
            analysis.similarity_score = len(intersection) / len(union)
            analysis.lexical_similarity = analysis.similarity_score
            analysis.common_terms = list(intersection)[:10]
            analysis.confidence = 0.7

        return analysis

    async def _ai_similarity_analysis(
        self, text1: str, text2: str
    ) -> SimilarityAnalysis:
        """AI-powered semantic similarity analysis with Tree-of-Thought prompting"""
        analysis = SimilarityAnalysis()
        analysis.similarity_type = SimilarityMetric.SEMANTIC_AI

        # Create Tree-of-Thought prompt for multi-perspective similarity analysis
        problem = "Compare the semantic similarity between two texts from multiple analytical perspectives"
        branches = [
            "Analyze lexical and vocabulary similarities between the texts",
            "Examine conceptual and thematic overlaps between the documents",
            "Assess structural and organizational similarities in content presentation",
        ]

        context = f"""Text 1: {text1[:1500]}{"..." if len(text1) > 1500 else ""}

Text 2: {text2[:1500]}{"..." if len(text2) > 1500 else ""}"""

        tot_prompt = create_tree_of_thought_prompt(problem, branches)

        prompt = f"""{tot_prompt}

Context:
{context}

Consider each approach systematically, then provide a comprehensive similarity analysis.

Response format:
{{
	"similarity_score": 0.0-1.0,
	"semantic_similarity": 0.0-1.0,
	"lexical_similarity": 0.0-1.0,
	"structural_similarity": 0.0-1.0,
	"shared_concepts": ["concept1", "concept2"],
	"explanation": "Detailed explanation based on multi-perspective analysis"
}}"""

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
                        parsed = json.loads(ai_response)
                        analysis.similarity_score = float(
                            parsed.get("similarity_score", 0.5)
                        )
                        analysis.semantic_similarity = float(
                            parsed.get("semantic_similarity", analysis.similarity_score)
                        )
                        analysis.lexical_similarity = float(
                            parsed.get("lexical_similarity", analysis.similarity_score)
                        )
                        analysis.structural_similarity = float(
                            parsed.get(
                                "structural_similarity", analysis.similarity_score
                            )
                        )
                        analysis.shared_concepts = parsed.get("shared_concepts", [])
                        analysis.similarity_explanation = parsed.get("explanation", "")
                        analysis.confidence = 0.85
                    except (json.JSONDecodeError, ValueError):
                        analysis.similarity_score = 0.5
                        analysis.confidence = 0.3
                        analysis.similarity_explanation = ai_response[:200]

        return analysis

    async def _simple_similarity_analysis(
        self, text1: str, text2: str
    ) -> SimilarityAnalysis:
        """Simple word-based similarity analysis (fallback)"""
        analysis = SimilarityAnalysis()

        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())

        if words1 or words2:
            intersection = words1 & words2
            analysis.similarity_score = len(intersection) / max(
                len(words1), len(words2)
            )
            analysis.common_terms = list(intersection)[:10]
            analysis.confidence = 0.5

        return analysis

    def get_analyzer_info(self) -> Dict[str, Any]:
        """Get comprehensive analyzer information"""
        return {
            "analyzer_version": "1.0.0",
            "ollama_model": self.ollama_model,
            "ai_enhancement_enabled": self.use_ai_enhancement,
            "supported_topic_models": [model.value for model in TopicModelType],
            "supported_similarity_metrics": [
                metric.value for metric in SimilarityMetric
            ],
            "analysis_features": {
                "topic_modeling": True,
                "semantic_clustering": TfidfVectorizer is not None,
                "concept_mapping": True,
                "similarity_analysis": True,
                "ai_enhancement": self.use_ai_enhancement and aiohttp is not None,
            },
            "configuration": {
                "num_topics": self.num_topics,
                "min_topic_probability": self.min_topic_probability,
                "similarity_threshold": self.similarity_threshold,
            },
        }

    async def close(self):
        """Close analyzer and cleanup resources"""
        self.logger.info("SemanticAnalyzer closed")

# Factory function
def create_semantic_analyzer(
    config: Optional[Dict[str, Any]] = None,
    llm_config: Optional[LLMConfiguration] = None,
) -> SemanticAnalyzer:
    """Create SemanticAnalyzer instance with configuration

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

    return SemanticAnalyzer(
        llm_config=llm_config,
        use_ai_enhancement=config.get("use_ai_enhancement", True),
        num_topics=config.get("num_topics", 5),
        min_topic_probability=config.get("min_topic_probability", 0.1),
        similarity_threshold=config.get("similarity_threshold", 0.3),
    )
