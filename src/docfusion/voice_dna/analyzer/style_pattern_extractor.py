"""
Style Pattern Extractor

This module provides multi-dimensional style analysis for organizational writing,
extracting detailed patterns related to formality, persuasion strategies, brand
language patterns, and technical writing styles. Complements the VoicePatternAnalyzer
with deeper stylistic analysis capabilities.
"""

import logging
import asyncio
import re
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from enum import Enum
import statistics

from pydantic import BaseModel, Field, ConfigDict
from uuid import uuid4

# Import the base pattern classes from voice pattern analyzer

logger = logging.getLogger(__name__)

# NLP imports with fallbacks
try:
	import spacy
	import nltk
	from nltk.corpus import stopwords
	from nltk.tokenize import sent_tokenize
	NLP_AVAILABLE = True
except ImportError:
	NLP_AVAILABLE = False


class StyleDimension(str, Enum):
	"""Dimensions of writing style analysis"""
	
	FORMALITY = "formality"
	PERSUASION_STRATEGY = "persuasion_strategy"
	BRAND_LANGUAGE = "brand_language"
	TECHNICAL_STYLE = "technical_style"
	EMOTIONAL_TONE = "emotional_tone"
	CULTURAL_VOICE = "cultural_voice"
	RHETORICAL_DEVICES = "rhetorical_devices"
	SENTENCE_RHYTHM = "sentence_rhythm"


class StylePattern(BaseModel):
	"""Detailed style pattern with multi-dimensional analysis"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	pattern_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique pattern identifier")
	dimension: StyleDimension = Field(description="Style dimension this pattern belongs to")
	pattern_name: str = Field(description="Name of the style pattern")
	
	# Pattern characteristics
	intensity: float = Field(ge=0.0, le=1.0, description="Intensity/strength of this pattern")
	consistency: float = Field(ge=0.0, le=1.0, description="Consistency across documents")
	distinctiveness: float = Field(ge=0.0, le=1.0, description="How unique this pattern is")
	
	# Pattern details
	indicators: List[str] = Field(description="Specific indicators that identify this pattern")
	examples: List[str] = Field(description="Example sentences or phrases")
	contexts: List[str] = Field(description="Contexts where pattern appears")
	
	# Measurements
	frequency_per_1000_words: float = Field(description="Frequency per 1000 words")
	document_coverage: float = Field(ge=0.0, le=1.0, description="Percentage of documents containing pattern")
	
	# Quality metrics
	confidence_score: float = Field(ge=0.0, le=1.0, description="Confidence in pattern identification")
	relevance_score: float = Field(ge=0.0, le=1.0, description="Relevance to organizational voice")
	
	# Metadata
	created_timestamp: datetime = Field(default_factory=datetime.now)


class StyleProfile(BaseModel):
	"""Comprehensive style profile across multiple dimensions"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	profile_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique profile identifier")
	organization_name: str = Field(description="Organization name")
	
	# Style dimension scores
	formality_score: float = Field(ge=0.0, le=1.0, description="Overall formality level")
	persuasion_scores: Dict[str, float] = Field(description="Persuasion strategy strengths")
	brand_alignment: float = Field(ge=0.0, le=1.0, description="Brand language consistency")
	technical_sophistication: float = Field(ge=0.0, le=1.0, description="Technical writing sophistication")
	
	# Emotional and cultural characteristics
	emotional_range: Dict[str, float] = Field(description="Emotional tone characteristics")
	cultural_markers: Dict[str, float] = Field(description="Cultural voice elements")
	
	# Rhetorical and structural elements
	rhetorical_strategies: Dict[str, float] = Field(description="Rhetorical device usage")
	sentence_rhythm_profile: Dict[str, float] = Field(description="Sentence rhythm characteristics")
	
	# Pattern collection
	style_patterns: List[StylePattern] = Field(description="Detailed style patterns")
	
	# Profile quality metrics
	profile_completeness: float = Field(ge=0.0, le=1.0, description="Completeness of style analysis")
	analysis_confidence: float = Field(ge=0.0, le=1.0, description="Overall confidence in analysis")
	
	# Corpus information
	documents_analyzed: int = Field(ge=1, description="Number of documents analyzed")
	total_words_analyzed: int = Field(ge=0, description="Total words in corpus")
	analysis_date: datetime = Field(default_factory=datetime.now)


class StylePatternExtractor:
	"""
	Multi-dimensional style pattern extractor for organizational voice analysis
	
	Provides deep analysis of writing style across multiple dimensions including
	formality, persuasion strategy, brand language, technical sophistication,
	emotional tone, cultural markers, and rhetorical patterns.
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
		
		# Initialize linguistic resources
		if NLP_AVAILABLE:
			try:
				nltk.download('punkt', quiet=True)
				nltk.download('stopwords', quiet=True)
				nltk.download('wordnet', quiet=True)
				nltk.download('vader_lexicon', quiet=True)
				self.stop_words = set(stopwords.words('english'))
			except Exception as e:
				logger.warning(f"Failed to download NLTK resources: {e}")
				self.stop_words = set()
		else:
			self.stop_words = set()
		
		# Style pattern definitions
		self._initialize_style_indicators()
		
		# Analysis configuration
		self.min_pattern_frequency = 0.5  # Per 1000 words
		self.min_document_coverage = 0.3  # 30% of documents
		self.confidence_threshold = 0.6
		
		self._log_initialization()
	
	def _initialize_style_indicators(self):
		"""Initialize style pattern indicators and lexicons"""
		
		# Formality indicators
		self.formality_indicators = {
			'formal': {
				'furthermore', 'moreover', 'consequently', 'nevertheless', 'subsequently',
				'notwithstanding', 'pursuant', 'heretofore', 'wherein', 'whereas',
				'accordingly', 'henceforth', 'therefore', 'thus', 'hence'
			},
			'informal': {
				'yeah', 'okay', 'gonna', 'wanna', 'kinda', 'sorta', 'anyway',
				'basically', 'actually', 'pretty much', 'just', 'really', 'quite'
			}
		}
		
		# Persuasion strategy indicators
		self.persuasion_indicators = {
			'logical_appeal': {
				'evidence', 'research', 'data', 'statistics', 'analysis', 'findings',
				'studies', 'proven', 'demonstrate', 'verify', 'confirm', 'establish'
			},
			'emotional_appeal': {
				'passionate', 'committed', 'dedicated', 'believe', 'trust', 'care',
				'exciting', 'inspiring', 'meaningful', 'important', 'valuable', 'vital'
			},
			'credibility_appeal': {
				'experience', 'expertise', 'qualified', 'certified', 'track record',
				'accomplished', 'recognized', 'established', 'reputation', 'trusted'
			},
			'urgency_appeal': {
				'immediate', 'urgent', 'critical', 'deadline', 'time-sensitive',
				'quickly', 'now', 'today', 'limited time', 'act now'
			}
		}
		
		# Brand language markers
		self.brand_markers = {
			'innovative': {
				'innovative', 'cutting-edge', 'groundbreaking', 'revolutionary',
				'advanced', 'state-of-the-art', 'pioneering', 'breakthrough'
			},
			'reliable': {
				'reliable', 'dependable', 'consistent', 'stable', 'trustworthy',
				'proven', 'established', 'solid', 'robust', 'enduring'
			},
			'collaborative': {
				'collaborative', 'partnership', 'teamwork', 'together', 'joint',
				'shared', 'cooperative', 'unified', 'alliance', 'collective'
			},
			'excellence': {
				'excellence', 'superior', 'outstanding', 'exceptional', 'premier',
				'world-class', 'best-in-class', 'top-tier', 'leading', 'unparalleled'
			}
		}
		
		# Technical writing indicators
		self.technical_indicators = {
			'methodology': {
				'methodology', 'framework', 'approach', 'process', 'procedure',
				'systematic', 'structured', 'disciplined', 'rigorous', 'comprehensive'
			},
			'precision': {
				'specifically', 'precisely', 'exactly', 'accurately', 'explicitly',
				'detailed', 'comprehensive', 'thorough', 'complete', 'exhaustive'
			},
			'objectivity': {
				'objectively', 'impartially', 'unbiased', 'neutral', 'factual',
				'evidence-based', 'data-driven', 'analytical', 'systematic', 'empirical'
			}
		}
		
		# Emotional tone indicators
		self.emotional_indicators = {
			'positive': {
				'excellent', 'outstanding', 'exceptional', 'superb', 'fantastic',
				'delighted', 'pleased', 'satisfied', 'successful', 'achievement'
			},
			'confident': {
				'confident', 'certain', 'assured', 'convinced', 'determined',
				'committed', 'dedicated', 'focused', 'resolved', 'steadfast'
			},
			'cautious': {
				'careful', 'cautious', 'prudent', 'conservative', 'measured',
				'deliberate', 'thoughtful', 'considered', 'judicious', 'circumspect'
			},
			'enthusiastic': {
				'excited', 'enthusiastic', 'eager', 'passionate', 'motivated',
				'energetic', 'dynamic', 'vibrant', 'spirited', 'zealous'
			}
		}
		
		# Rhetorical device patterns
		self.rhetorical_patterns = {
			'repetition': r'\b(\w+)\b.*?\b\1\b',  # Word repetition
			'alliteration': r'\b([a-z])\w+\s+\1\w+',  # Alliteration pattern
			'parallelism': r'\b\w+\s+\w+,\s+\w+\s+\w+,',  # Parallel structure
			'questions': r'\?',  # Rhetorical questions
			'lists': r'\b(?:\w+,\s*){2,}\w+\b'  # Lists of items
		}
	
	async def extract_style_patterns(self, documents: List[str], 
	                                 organization_name: str,
	                                 reference_corpus: Optional[List[str]] = None) -> StyleProfile:
		"""
		Extract comprehensive style patterns from document corpus
		
		Args:
			documents: List of documents to analyze
			organization_name: Organization name for profile
			reference_corpus: Optional reference corpus for comparison
			
		Returns:
			Comprehensive style profile
		"""
		start_time = datetime.now()
		
		try:
			self._log_extraction_start(organization_name, len(documents))
			
			# Validate corpus
			total_words = sum(len(doc.split()) for doc in documents)
			if total_words < 500:
				raise ValueError(f"Corpus too small: {total_words} words (minimum: 500)")
			
			# Extract style patterns across all dimensions
			style_patterns = []
			
			# Formality analysis
			formality_score, formality_patterns = await self._analyze_formality(documents)
			style_patterns.extend(formality_patterns)
			
			# Persuasion strategy analysis
			persuasion_scores, persuasion_patterns = await self._analyze_persuasion_strategies(documents)
			style_patterns.extend(persuasion_patterns)
			
			# Brand language analysis
			brand_alignment, brand_patterns = await self._analyze_brand_language(documents)
			style_patterns.extend(brand_patterns)
			
			# Technical style analysis
			technical_sophistication, technical_patterns = await self._analyze_technical_style(documents)
			style_patterns.extend(technical_patterns)
			
			# Emotional tone analysis
			emotional_range, emotional_patterns = await self._analyze_emotional_tone(documents)
			style_patterns.extend(emotional_patterns)
			
			# Cultural markers analysis
			cultural_markers, cultural_patterns = await self._analyze_cultural_voice(documents)
			style_patterns.extend(cultural_patterns)
			
			# Rhetorical devices analysis
			rhetorical_strategies, rhetorical_patterns = await self._analyze_rhetorical_devices(documents)
			style_patterns.extend(rhetorical_patterns)
			
			# Sentence rhythm analysis
			sentence_rhythm_profile, rhythm_patterns = await self._analyze_sentence_rhythm(documents)
			style_patterns.extend(rhythm_patterns)
			
			# Calculate profile quality metrics
			profile_completeness = self._calculate_completeness(style_patterns)
			analysis_confidence = self._calculate_analysis_confidence(style_patterns, total_words, len(documents))
			
			# Create comprehensive style profile
			style_profile = StyleProfile(
				organization_name=organization_name,
				formality_score=formality_score,
				persuasion_scores=persuasion_scores,
				brand_alignment=brand_alignment,
				technical_sophistication=technical_sophistication,
				emotional_range=emotional_range,
				cultural_markers=cultural_markers,
				rhetorical_strategies=rhetorical_strategies,
				sentence_rhythm_profile=sentence_rhythm_profile,
				style_patterns=style_patterns,
				profile_completeness=profile_completeness,
				analysis_confidence=analysis_confidence,
				documents_analyzed=len(documents),
				total_words_analyzed=total_words
			)
			
			analysis_duration = (datetime.now() - start_time).total_seconds()
			self._log_extraction_complete(organization_name, analysis_confidence, analysis_duration)
			
			return style_profile
			
		except Exception as e:
			self._log_extraction_error(f"Style pattern extraction failed for {organization_name}: {str(e)}")
			raise
	
	async def _analyze_formality(self, documents: List[str]) -> Tuple[float, List[StylePattern]]:
		"""Analyze formality level and patterns"""
		
		formal_counts = defaultdict(int)
		informal_counts = defaultdict(int)
		total_words = 0
		document_formal_scores = []
		
		patterns = []
		
		for doc_idx, document in enumerate(documents):
			words = document.lower().split()
			doc_words = len(words)
			total_words += doc_words
			
			doc_formal = 0
			doc_informal = 0
			
			for word in words:
				if word in self.formality_indicators['formal']:
					formal_counts[word] += 1
					doc_formal += 1
				elif word in self.formality_indicators['informal']:
					informal_counts[word] += 1
					doc_informal += 1
			
			# Document-level formality score
			if doc_formal + doc_informal > 0:
				doc_formality = doc_formal / (doc_formal + doc_informal)
			else:
				doc_formality = 0.5  # Neutral
			document_formal_scores.append(doc_formality)
		
		# Overall formality score
		total_formal = sum(formal_counts.values())
		total_informal = sum(informal_counts.values())
		
		if total_formal + total_informal > 0:
			formality_score = total_formal / (total_formal + total_informal)
		else:
			formality_score = 0.5
		
		# Create formality patterns
		for word, count in formal_counts.most_common(5):
			if count > 0:
				freq_per_1000 = (count / total_words) * 1000
				if freq_per_1000 >= self.min_pattern_frequency:
					pattern = StylePattern(
						dimension=StyleDimension.FORMALITY,
						pattern_name=f"formal_language_{word}",
						intensity=min(freq_per_1000 / 10.0, 1.0),  # Normalize
						consistency=1.0 - (statistics.stdev(document_formal_scores) if len(document_formal_scores) > 1 else 0.0),
						distinctiveness=0.8,  # Formal language is distinctive
						indicators=[word],
						examples=[f"Usage of formal term: {word}"],
						contexts=["formal communication"],
						frequency_per_1000_words=freq_per_1000,
						document_coverage=0.8,  # Assume high coverage for frequent words
						confidence_score=0.8,
						relevance_score=0.9
					)
					patterns.append(pattern)
		
		return formality_score, patterns
	
	async def _analyze_persuasion_strategies(self, documents: List[str]) -> Tuple[Dict[str, float], List[StylePattern]]:
		"""Analyze persuasion strategies and create patterns"""
		
		strategy_counts = defaultdict(lambda: defaultdict(int))
		total_words = sum(len(doc.split()) for doc in documents)
		patterns = []
		
		for document in documents:
			words = document.lower().split()
			
			for strategy, indicators in self.persuasion_indicators.items():
				for word in words:
					if word in indicators:
						strategy_counts[strategy][word] += 1
		
		# Calculate strategy scores
		persuasion_scores = {}
		for strategy, word_counts in strategy_counts.items():
			total_strategy_count = sum(word_counts.values())
			persuasion_scores[strategy] = (total_strategy_count / total_words) * 1000  # Per 1000 words
		
		# Create patterns for dominant strategies
		for strategy, score in persuasion_scores.items():
			if score >= self.min_pattern_frequency:
				top_indicators = [word for word, count in strategy_counts[strategy].most_common(3)]
				
				pattern = StylePattern(
					dimension=StyleDimension.PERSUASION_STRATEGY,
					pattern_name=f"persuasion_{strategy}",
					intensity=min(score / 5.0, 1.0),  # Normalize to 0-1
					consistency=0.7,  # Assume moderate consistency
					distinctiveness=0.8,  # Persuasion strategies are distinctive
					indicators=top_indicators,
					examples=[f"Uses {strategy.replace('_', ' ')} indicators"],
					contexts=["persuasive communication"],
					frequency_per_1000_words=score,
					document_coverage=0.6,  # Moderate coverage expected
					confidence_score=0.7,
					relevance_score=0.9
				)
				patterns.append(pattern)
		
		return persuasion_scores, patterns
	
	async def _analyze_brand_language(self, documents: List[str]) -> Tuple[float, List[StylePattern]]:
		"""Analyze brand language consistency"""
		
		brand_counts = defaultdict(lambda: defaultdict(int))
		total_words = sum(len(doc.split()) for doc in documents)
		patterns = []
		
		for document in documents:
			words = document.lower().split()
			
			for brand_trait, indicators in self.brand_markers.items():
				for word in words:
					if word in indicators:
						brand_counts[brand_trait][word] += 1
		
		# Calculate brand alignment
		total_brand_words = sum(sum(trait_counts.values()) for trait_counts in brand_counts.values())
		brand_alignment = min((total_brand_words / total_words) * 100, 1.0)  # Cap at 1.0
		
		# Create brand language patterns
		for trait, word_counts in brand_counts.items():
			trait_total = sum(word_counts.values())
			if trait_total > 0:
				freq_per_1000 = (trait_total / total_words) * 1000
				
				if freq_per_1000 >= self.min_pattern_frequency:
					pattern = StylePattern(
						dimension=StyleDimension.BRAND_LANGUAGE,
						pattern_name=f"brand_{trait}",
						intensity=min(freq_per_1000 / 3.0, 1.0),
						consistency=0.8,  # Brand language should be consistent
						distinctiveness=0.9,  # Brand language is highly distinctive
						indicators=list(word_counts.keys()),
						examples=[f"Emphasizes {trait} through word choice"],
						contexts=["brand communication"],
						frequency_per_1000_words=freq_per_1000,
						document_coverage=0.7,
						confidence_score=0.8,
						relevance_score=1.0
					)
					patterns.append(pattern)
		
		return brand_alignment, patterns
	
	async def _analyze_technical_style(self, documents: List[str]) -> Tuple[float, List[StylePattern]]:
		"""Analyze technical writing sophistication"""
		
		technical_scores = []
		patterns = []
		
		for document in documents:
			doc_score = self._calculate_document_technical_score(document)
			technical_scores.append(doc_score)
		
		technical_sophistication = statistics.mean(technical_scores) if technical_scores else 0.0
		
		# Analyze technical patterns
		tech_counts = defaultdict(lambda: defaultdict(int))
		total_words = sum(len(doc.split()) for doc in documents)
		
		for document in documents:
			words = document.lower().split()
			
			for tech_category, indicators in self.technical_indicators.items():
				for word in words:
					if word in indicators:
						tech_counts[tech_category][word] += 1
		
		# Create technical style patterns
		for category, word_counts in tech_counts.items():
			category_total = sum(word_counts.values())
			if category_total > 0:
				freq_per_1000 = (category_total / total_words) * 1000
				
				if freq_per_1000 >= self.min_pattern_frequency:
					pattern = StylePattern(
						dimension=StyleDimension.TECHNICAL_STYLE,
						pattern_name=f"technical_{category}",
						intensity=min(freq_per_1000 / 5.0, 1.0),
						consistency=statistics.stdev(technical_scores) if len(technical_scores) > 1 else 0.9,
						distinctiveness=0.7,
						indicators=list(word_counts.keys()),
						examples=[f"Technical {category.replace('_', ' ')} language"],
						contexts=["technical communication"],
						frequency_per_1000_words=freq_per_1000,
						document_coverage=0.8,
						confidence_score=0.8,
						relevance_score=0.8
					)
					patterns.append(pattern)
		
		return technical_sophistication, patterns
	
	def _calculate_document_technical_score(self, document: str) -> float:
		"""Calculate technical sophistication score for a document"""
		
		words = document.lower().split()
		if not words:
			return 0.0
		
		# Technical indicators
		tech_word_count = 0
		for word in words:
			for tech_indicators in self.technical_indicators.values():
				if word in tech_indicators:
					tech_word_count += 1
					break
		
		# Long word count (6+ characters)
		long_word_count = sum(1 for word in words if len(word) >= 6)
		
		# Sentence complexity (approximate)
		sentences = document.split('.')
		avg_sentence_length = len(words) / max(len(sentences), 1)
		
		# Normalize components
		tech_ratio = tech_word_count / len(words)
		long_word_ratio = long_word_count / len(words)
		sentence_complexity = min(avg_sentence_length / 20.0, 1.0)  # 20+ words = complex
		
		return (tech_ratio + long_word_ratio + sentence_complexity) / 3
	
	async def _analyze_emotional_tone(self, documents: List[str]) -> Tuple[Dict[str, float], List[StylePattern]]:
		"""Analyze emotional tone characteristics"""
		
		emotion_counts = defaultdict(lambda: defaultdict(int))
		total_words = sum(len(doc.split()) for doc in documents)
		patterns = []
		
		for document in documents:
			words = document.lower().split()
			
			for emotion, indicators in self.emotional_indicators.items():
				for word in words:
					if word in indicators:
						emotion_counts[emotion][word] += 1
		
		# Calculate emotional range
		emotional_range = {}
		for emotion, word_counts in emotion_counts.items():
			total_emotion_count = sum(word_counts.values())
			emotional_range[emotion] = (total_emotion_count / total_words) * 1000
		
		# Create emotional tone patterns
		for emotion, score in emotional_range.items():
			if score >= self.min_pattern_frequency:
				pattern = StylePattern(
					dimension=StyleDimension.EMOTIONAL_TONE,
					pattern_name=f"emotion_{emotion}",
					intensity=min(score / 3.0, 1.0),
					consistency=0.6,  # Emotional consistency varies
					distinctiveness=0.7,
					indicators=list(emotion_counts[emotion].keys()),
					examples=[f"Uses {emotion} emotional language"],
					contexts=["emotional expression"],
					frequency_per_1000_words=score,
					document_coverage=0.5,
					confidence_score=0.7,
					relevance_score=0.8
				)
				patterns.append(pattern)
		
		return emotional_range, patterns
	
	async def _analyze_cultural_voice(self, documents: List[str]) -> Tuple[Dict[str, float], List[StylePattern]]:
		"""Analyze cultural voice elements"""
		
		# Simple cultural markers (in production would be more sophisticated)
		cultural_indicators = {
			'collaborative': ['together', 'partnership', 'team', 'collective', 'shared'],
			'individual': ['individual', 'personal', 'myself', 'achievement', 'success'],
			'hierarchical': ['leadership', 'authority', 'management', 'supervision', 'command'],
			'egalitarian': ['equal', 'fair', 'inclusive', 'diverse', 'consensus']
		}
		
		cultural_counts = defaultdict(lambda: defaultdict(int))
		total_words = sum(len(doc.split()) for doc in documents)
		patterns = []
		
		for document in documents:
			words = document.lower().split()
			
			for culture_type, indicators in cultural_indicators.items():
				for word in words:
					if word in indicators:
						cultural_counts[culture_type][word] += 1
		
		# Calculate cultural markers
		cultural_markers = {}
		for culture_type, word_counts in cultural_counts.items():
			total_culture_count = sum(word_counts.values())
			cultural_markers[culture_type] = (total_culture_count / total_words) * 1000
		
		# Create cultural patterns
		for culture_type, score in cultural_markers.items():
			if score >= self.min_pattern_frequency:
				pattern = StylePattern(
					dimension=StyleDimension.CULTURAL_VOICE,
					pattern_name=f"culture_{culture_type}",
					intensity=min(score / 2.0, 1.0),
					consistency=0.7,
					distinctiveness=0.8,
					indicators=list(cultural_counts[culture_type].keys()),
					examples=[f"Reflects {culture_type} cultural values"],
					contexts=["cultural expression"],
					frequency_per_1000_words=score,
					document_coverage=0.6,
					confidence_score=0.7,
					relevance_score=0.9
				)
				patterns.append(pattern)
		
		return cultural_markers, patterns
	
	async def _analyze_rhetorical_devices(self, documents: List[str]) -> Tuple[Dict[str, float], List[StylePattern]]:
		"""Analyze rhetorical device usage"""
		
		rhetorical_counts = defaultdict(int)
		total_characters = sum(len(doc) for doc in documents)
		patterns = []
		
		for document in documents:
			for device, pattern in self.rhetorical_patterns.items():
				matches = re.findall(pattern, document.lower(), re.IGNORECASE)
				rhetorical_counts[device] += len(matches)
		
		# Calculate rhetorical strategies
		rhetorical_strategies = {}
		for device, count in rhetorical_counts.items():
			rhetorical_strategies[device] = (count / max(total_characters, 1)) * 10000  # Per 10k characters
		
		# Create rhetorical patterns
		for device, score in rhetorical_strategies.items():
			if score >= 1.0:  # At least 1 per 10k characters
				pattern = StylePattern(
					dimension=StyleDimension.RHETORICAL_DEVICES,
					pattern_name=f"rhetorical_{device}",
					intensity=min(score / 10.0, 1.0),
					consistency=0.5,  # Rhetorical devices vary
					distinctiveness=0.9,  # Highly distinctive
					indicators=[device],
					examples=[f"Uses {device} for rhetorical effect"],
					contexts=["rhetorical expression"],
					frequency_per_1000_words=score * 100,  # Convert to per 1000 words
					document_coverage=0.4,
					confidence_score=0.8,
					relevance_score=0.7
				)
				patterns.append(pattern)
		
		return rhetorical_strategies, patterns
	
	async def _analyze_sentence_rhythm(self, documents: List[str]) -> Tuple[Dict[str, float], List[StylePattern]]:
		"""Analyze sentence rhythm and flow patterns"""
		
		sentence_lengths = []
		sentence_types = defaultdict(int)
		patterns = []
		
		for document in documents:
			if NLP_AVAILABLE:
				sentences = sent_tokenize(document)
			else:
				sentences = document.split('.')
			
			for sentence in sentences:
				if sentence.strip():
					words = sentence.split()
					sentence_lengths.append(len(words))
					
					# Classify sentence type
					if sentence.strip().endswith('?'):
						sentence_types['question'] += 1
					elif sentence.strip().endswith('!'):
						sentence_types['exclamation'] += 1
					else:
						sentence_types['statement'] += 1
		
		if not sentence_lengths:
			return {}, []
		
		# Calculate rhythm profile
		avg_length = statistics.mean(sentence_lengths)
		length_variance = statistics.variance(sentence_lengths) if len(sentence_lengths) > 1 else 0
		total_sentences = len(sentence_lengths)
		
		rhythm_profile = {
			'average_sentence_length': avg_length,
			'sentence_variety': length_variance / max(avg_length, 1),  # Coefficient of variation
			'question_ratio': sentence_types['question'] / total_sentences,
			'exclamation_ratio': sentence_types['exclamation'] / total_sentences
		}
		
		# Create rhythm patterns
		if avg_length > 15:  # Long sentences
			pattern = StylePattern(
				dimension=StyleDimension.SENTENCE_RHYTHM,
				pattern_name="long_sentence_style",
				intensity=min((avg_length - 15) / 15, 1.0),
				consistency=0.8,
				distinctiveness=0.6,
				indicators=["long sentences"],
				examples=[f"Average sentence length: {avg_length:.1f} words"],
				contexts=["sentence structure"],
				frequency_per_1000_words=avg_length,
				document_coverage=1.0,
				confidence_score=0.9,
				relevance_score=0.7
			)
			patterns.append(pattern)
		
		return rhythm_profile, patterns
	
	def _calculate_completeness(self, patterns: List[StylePattern]) -> float:
		"""Calculate how complete the style analysis is"""
		
		# Check coverage across style dimensions
		dimensions_covered = set(pattern.dimension for pattern in patterns)
		total_dimensions = len(StyleDimension)
		
		dimension_coverage = len(dimensions_covered) / total_dimensions
		
		# Check pattern quality
		if patterns:
			avg_confidence = statistics.mean([p.confidence_score for p in patterns])
			avg_relevance = statistics.mean([p.relevance_score for p in patterns])
		else:
			avg_confidence = 0.0
			avg_relevance = 0.0
		
		completeness = (dimension_coverage + avg_confidence + avg_relevance) / 3
		return completeness
	
	def _calculate_analysis_confidence(self, patterns: List[StylePattern], 
	                                  total_words: int, document_count: int) -> float:
		"""Calculate overall confidence in the style analysis"""
		
		# Corpus size factor
		corpus_factor = min(total_words / 1000, 1.0)  # 1000+ words ideal
		
		# Document count factor
		document_factor = min(document_count / 3, 1.0)  # 3+ documents ideal
		
		# Pattern quality factor
		if patterns:
			pattern_factor = statistics.mean([p.confidence_score for p in patterns])
		else:
			pattern_factor = 0.0
		
		# Pattern quantity factor
		quantity_factor = min(len(patterns) / 10, 1.0)  # 10+ patterns ideal
		
		confidence = (corpus_factor + document_factor + pattern_factor + quantity_factor) / 4
		return confidence
	
	def get_style_statistics(self) -> Dict[str, Any]:
		"""Get style extractor performance statistics"""
		
		return {
			"nlp_available": NLP_AVAILABLE,
			"style_dimensions": len(StyleDimension),
			"formality_indicators": len(self.formality_indicators['formal']) + len(self.formality_indicators['informal']),
			"persuasion_strategies": len(self.persuasion_indicators),
			"brand_traits": len(self.brand_markers),
			"technical_categories": len(self.technical_indicators),
			"emotional_categories": len(self.emotional_indicators),
			"rhetorical_patterns": len(self.rhetorical_patterns)
		}
	
	# Logging methods
	
	def _log_initialization(self):
		nlp_status = "available" if NLP_AVAILABLE else "fallback mode"
		logger.info(f"StylePatternExtractor: Initialized ({nlp_status})")
	
	def _log_extraction_start(self, organization: str, doc_count: int):
		logger.info(f"StylePatternExtractor: Starting style extraction for {organization} ({doc_count} documents)")
	
	def _log_extraction_complete(self, organization: str, confidence: float, duration: float):
		logger.info(f"StylePatternExtractor: Completed extraction for {organization} (confidence: {confidence:.3f}, duration: {duration:.1f}s)")
	
	def _log_extraction_error(self, message: str):
		logger.error(f"StylePatternExtractor Error: {message}")


# Example usage and testing
async def create_sample_style_extraction():
	"""Create sample style extraction for testing"""
	
	# Initialize extractor
	extractor = StylePatternExtractor()
	
	# Sample documents with different styles
	sample_documents = [
		"""
		We are pleased to present our comprehensive analysis and strategic recommendations. 
		Our research demonstrates significant opportunities for organizational improvement. 
		The data clearly indicates that implementing our proven methodology will deliver 
		exceptional results. We are confident in our ability to exceed your expectations 
		and establish a lasting partnership built on trust and mutual success.
		""",
		"""
		Our innovative approach leverages cutting-edge technology to create world-class 
		solutions. We're excited to collaborate with your team and deliver outstanding 
		value. This partnership represents a fantastic opportunity to transform your 
		operations and achieve unprecedented growth. Together, we can revolutionize 
		your industry and establish your organization as the undisputed market leader.
		""",
		"""
		The systematic implementation of our framework requires careful analysis of 
		current processes and methodologies. Our approach emphasizes precision, 
		objectivity, and comprehensive evaluation of all relevant parameters. 
		The technical specifications ensure robust performance while maintaining 
		flexibility for future enhancements. This rigorous methodology has been 
		proven effective across multiple implementations.
		"""
	]
	
	# Extract style patterns
	style_profile = await extractor.extract_style_patterns(
		sample_documents, 
		"Technology Consulting Firm"
	)
	
	return style_profile, extractor.get_style_statistics()


if __name__ == "__main__":
	# Test the style pattern extractor
	import asyncio
	
	async def main():
		profile, stats = await create_sample_style_extraction()
		
		logger.info(f"Style Pattern Extraction Results:")
		print("=" * 50)
		logger.info(f"Organization: {profile.organization_name}")
		logger.info(f"Analysis Confidence: {profile.analysis_confidence:.3f}")
		logger.info(f"Profile Completeness: {profile.profile_completeness:.3f}")
		logger.info(f"Formality Score: {profile.formality_score:.3f}")
		logger.info(f"Brand Alignment: {profile.brand_alignment:.3f}")
		logger.info(f"Technical Sophistication: {profile.technical_sophistication:.3f}")
		
		logger.info(f"\nPersuasion Strategies:")
		for strategy, score in profile.persuasion_scores.items():
			logger.info(f"  {strategy.replace('_', ' ').title()}: {score:.3f}")
		
		logger.info(f"\nEmotional Range:")
		for emotion, score in profile.emotional_range.items():
			logger.info(f"  {emotion.title()}: {score:.3f}")
		
		logger.info(f"\nIdentified Patterns ({len(profile.style_patterns)}):")
		for pattern in profile.style_patterns[:5]:  # Show first 5 patterns
			logger.info(f"  📊 {pattern.pattern_name}")
			logger.info(f"     Dimension: {pattern.dimension.value}")
			logger.info(f"     Intensity: {pattern.intensity:.3f}")
			logger.info(f"     Confidence: {pattern.confidence_score:.3f}")
		
		logger.info(f"\nExtractor Statistics:")
		for key, value in stats.items():
			logger.info(f"  {key.replace('_', ' ').title()}: {value}")
	
	asyncio.run(main())
