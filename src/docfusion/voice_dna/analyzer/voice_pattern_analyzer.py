"""
Voice Pattern Analyzer

This module provides comprehensive writing style fingerprinting and analysis
capabilities for organizational voice consistency. Uses advanced NLP and
machine learning techniques to identify unique writing patterns, vocabulary
choices, and stylistic elements that characterize an organization's voice.
"""

import logging
import asyncio
import re
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum
import statistics

import numpy as np
from pydantic import BaseModel, Field, ConfigDict
from uuid import uuid4

# NLP imports
try:
	import spacy
	import nltk
	from nltk.corpus import stopwords
	from nltk.tokenize import sent_tokenize, word_tokenize
	from textstat import flesch_reading_ease, flesch_kincaid_grade, automated_readability_index
	NLP_AVAILABLE = True
	logger = logging.getLogger(__name__)
except ImportError:
	NLP_AVAILABLE = False
	# Mock objects for when NLP libraries aren't available
	class MockSpacy:
		def load(self, model):
			return self
		def __call__(self, text):
			return MockDoc(text)
	
	class MockDoc:
		def __init__(self, text):
			self.text = text
			self.sents = [MockSent(s) for s in text.split('.') if s.strip()]
			self.ents = []
			
	class MockSent:
		def __init__(self, text):
			self.text = text
			
	spacy = MockSpacy()


class VoiceComponent(str, Enum):
	"""Components of organizational voice"""
	
	VOCABULARY = "vocabulary"
	SENTENCE_STRUCTURE = "sentence_structure" 
	TONE = "tone"
	FORMALITY = "formality"
	COMPLEXITY = "complexity"
	PERSUASION_STYLE = "persuasion_style"
	TECHNICAL_LANGUAGE = "technical_language"
	CULTURAL_MARKERS = "cultural_markers"


class WritingPattern(BaseModel):
	"""Individual writing pattern identification"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	pattern_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique pattern identifier")
	component: VoiceComponent = Field(description="Voice component this pattern relates to")
	pattern_type: str = Field(description="Type of pattern (frequency, structure, style)")
	
	# Pattern details
	pattern_description: str = Field(description="Human-readable description of the pattern")
	pattern_regex: Optional[str] = Field(None, description="Regex pattern if applicable")
	frequency_score: float = Field(ge=0.0, le=1.0, description="Frequency of this pattern in corpus")
	confidence_score: float = Field(ge=0.0, le=1.0, description="Confidence in pattern identification")
	
	# Examples and context
	examples: List[str] = Field(description="Example instances of this pattern")
	contexts: List[str] = Field(description="Contexts where this pattern appears")
	
	# Metadata
	first_observed: datetime = Field(default_factory=datetime.now)
	last_observed: datetime = Field(default_factory=datetime.now) 
	observation_count: int = Field(default=1, description="Number of times pattern has been observed")


class VoiceFingerprint(BaseModel):
	"""Comprehensive voice fingerprint for an organization"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	fingerprint_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique fingerprint identifier")
	organization_name: str = Field(description="Organization name")
	
	# Core voice characteristics
	vocabulary_signature: Dict[str, float] = Field(description="Unique vocabulary usage patterns")
	sentence_patterns: Dict[str, float] = Field(description="Sentence structure patterns")
	formality_level: float = Field(ge=0.0, le=1.0, description="Overall formality level")
	complexity_score: float = Field(ge=0.0, le=1.0, description="Language complexity score")
	
	# Style dimensions
	tone_profile: Dict[str, float] = Field(description="Tone characteristics (professional, friendly, authoritative)")
	persuasion_style: Dict[str, float] = Field(description="Persuasion approach patterns")
	technical_density: float = Field(ge=0.0, le=1.0, description="Technical language density")
	
	# Pattern collection
	patterns: List[WritingPattern] = Field(description="Identified writing patterns")
	
	# Quality metrics
	consistency_score: float = Field(ge=0.0, le=1.0, description="Internal consistency of voice")
	distinctiveness_score: float = Field(ge=0.0, le=1.0, description="How distinctive this voice is")
	confidence_level: float = Field(ge=0.0, le=1.0, description="Overall confidence in fingerprint")
	
	# Corpus information
	documents_analyzed: int = Field(ge=1, description="Number of documents used to create fingerprint")
	total_words: int = Field(ge=0, description="Total words in analyzed corpus")
	date_created: datetime = Field(default_factory=datetime.now)
	last_updated: datetime = Field(default_factory=datetime.now)


class VoicePatternAnalyzer:
	"""
	Advanced voice pattern analyzer for organizational writing consistency
	
	Analyzes document corpora to identify unique writing patterns, vocabulary
	preferences, structural elements, and stylistic choices that characterize
	an organization's voice and communication style.
	"""
	
	def __init__(self):
		# Initialize NLP pipeline
		if NLP_AVAILABLE:
			try:
				self.nlp = spacy.load("en_core_web_sm")
			except OSError:
				# Fallback to basic tokenization
				self.nlp = None
		else:
			self.nlp = None
			
		# Initialize NLTK components
		if NLP_AVAILABLE:
			try:
				nltk.download('punkt', quiet=True)
				nltk.download('stopwords', quiet=True)
				self.stop_words = set(stopwords.words('english'))
			except Exception as e:
				logger.warning(f"Failed to download NLTK resources: {e}")
				self.stop_words = set()
		else:
			self.stop_words = set()
		
		# Pattern storage
		self.voice_profiles: Dict[str, VoiceFingerprint] = {}
		self.pattern_cache: Dict[str, List[WritingPattern]] = {}
		
		# Analysis configuration
		self.min_corpus_size = 1000  # Minimum words for reliable analysis
		self.pattern_confidence_threshold = 0.6
		self.vocabulary_frequency_threshold = 0.001
		
		self._log_initialization()
	
	async def analyze_voice_patterns(self, documents: List[str], 
	                                organization_name: str,
	                                corpus_metadata: Optional[Dict[str, Any]] = None) -> VoiceFingerprint:
		"""
		Analyze voice patterns from a document corpus
		
		Args:
			documents: List of document texts to analyze
			organization_name: Name of the organization
			corpus_metadata: Optional metadata about the corpus
			
		Returns:
			Comprehensive voice fingerprint
		"""
		start_time = datetime.now()
		
		try:
			self._log_analysis_start(organization_name, len(documents))
			
			# Validate corpus size
			total_text = ' '.join(documents)
			word_count = len(total_text.split())
			
			if word_count < self.min_corpus_size:
				raise ValueError(f"Corpus too small: {word_count} words (minimum: {self.min_corpus_size})")
			
			# Extract comprehensive patterns
			vocabulary_signature = await self._extract_vocabulary_signature(documents)
			sentence_patterns = await self._extract_sentence_patterns(documents)
			formality_level = await self._calculate_formality_level(documents)
			complexity_score = await self._calculate_complexity_score(documents)
			tone_profile = await self._extract_tone_profile(documents)
			persuasion_style = await self._extract_persuasion_style(documents)
			technical_density = await self._calculate_technical_density(documents)
			
			# Identify specific patterns
			patterns = await self._identify_writing_patterns(documents)
			
			# Calculate quality metrics
			consistency_score = await self._calculate_consistency_score(documents, patterns)
			distinctiveness_score = await self._calculate_distinctiveness_score(vocabulary_signature, sentence_patterns)
			confidence_level = self._calculate_overall_confidence(patterns, word_count, len(documents))
			
			# Create voice fingerprint
			fingerprint = VoiceFingerprint(
				organization_name=organization_name,
				vocabulary_signature=vocabulary_signature,
				sentence_patterns=sentence_patterns,
				formality_level=formality_level,
				complexity_score=complexity_score,
				tone_profile=tone_profile,
				persuasion_style=persuasion_style,
				technical_density=technical_density,
				patterns=patterns,
				consistency_score=consistency_score,
				distinctiveness_score=distinctiveness_score,
				confidence_level=confidence_level,
				documents_analyzed=len(documents),
				total_words=word_count
			)
			
			# Cache the fingerprint
			self.voice_profiles[organization_name] = fingerprint
			
			analysis_duration = (datetime.now() - start_time).total_seconds()
			self._log_analysis_complete(organization_name, fingerprint.confidence_level, analysis_duration)
			
			return fingerprint
			
		except Exception as e:
			self._log_analysis_error(f"Voice pattern analysis failed for {organization_name}: {str(e)}")
			raise
	
	async def _extract_vocabulary_signature(self, documents: List[str]) -> Dict[str, float]:
		"""Extract unique vocabulary usage patterns"""
		
		# Combine all documents
		full_text = ' '.join(documents).lower()
		
		# Tokenize and clean
		if self.nlp:
			doc = self.nlp(full_text)
			tokens = [token.lemma_ for token in doc if not token.is_stop and not token.is_punct and token.is_alpha]
		else:
			# Fallback tokenization
			tokens = [word.lower() for word in full_text.split() if word.isalpha() and word not in self.stop_words]
		
		# Calculate word frequencies
		word_freq = Counter(tokens)
		total_words = len(tokens)
		
		# Create signature with relative frequencies
		signature = {}
		for word, count in word_freq.most_common(500):  # Top 500 words
			relative_freq = count / total_words
			if relative_freq >= self.vocabulary_frequency_threshold:
				signature[word] = relative_freq
		
		return signature
	
	async def _extract_sentence_patterns(self, documents: List[str]) -> Dict[str, float]:
		"""Extract sentence structure and pattern usage"""
		
		patterns = defaultdict(float)
		sentence_count = 0
		
		for document in documents:
			# Sentence tokenization
			if NLP_AVAILABLE:
				sentences = sent_tokenize(document)
			else:
				sentences = document.split('.')
				
			for sentence in sentences:
				sentence = sentence.strip()
				if not sentence:
					continue
					
				sentence_count += 1
				
				# Analyze sentence characteristics
				word_count = len(sentence.split())
				patterns['avg_sentence_length'] += word_count
				
				# Sentence starters
				first_word = sentence.split()[0].lower() if sentence.split() else ""
				if first_word:
					patterns[f'starts_with_{first_word}'] += 1
				
				# Punctuation patterns
				if sentence.endswith('?'):
					patterns['question_sentences'] += 1
				elif sentence.endswith('!'):
					patterns['exclamatory_sentences'] += 1
				else:
					patterns['declarative_sentences'] += 1
				
				# Complex sentence indicators
				if ',' in sentence:
					patterns['comma_sentences'] += 1
				if ';' in sentence:
					patterns['semicolon_sentences'] += 1
				if ' and ' in sentence.lower():
					patterns['coordinating_and'] += 1
				if ' but ' in sentence.lower():
					patterns['coordinating_but'] += 1
				
				# Passive voice detection (simple heuristic)
				passive_indicators = ['was', 'were', 'been', 'being']
				if any(word in sentence.lower() for word in passive_indicators):
					patterns['passive_voice'] += 1
		
		# Convert to relative frequencies
		if sentence_count > 0:
			for pattern in patterns:
				if pattern != 'avg_sentence_length':
					patterns[pattern] = patterns[pattern] / sentence_count
				else:
					patterns[pattern] = patterns[pattern] / sentence_count  # Average
		
		return dict(patterns)
	
	async def _calculate_formality_level(self, documents: List[str]) -> float:
		"""Calculate overall formality level of writing"""
		
		formality_indicators = {
			'formal': {
				'furthermore', 'moreover', 'nevertheless', 'consequently', 'therefore', 
				'accordingly', 'subsequently', 'notwithstanding', 'heretofore', 'pursuant'
			},
			'informal': {
				'yeah', 'okay', 'gonna', 'wanna', 'kinda', 'sorta', 'cause', 'cuz', 'gotta', 'lemme'
			}
		}
		
		formal_count = 0
		informal_count = 0
		total_words = 0
		
		for document in documents:
			words = document.lower().split()
			total_words += len(words)
			
			for word in words:
				if word in formality_indicators['formal']:
					formal_count += 1
				elif word in formality_indicators['informal']:
					informal_count += 1
		
		if total_words == 0:
			return 0.5  # Neutral
			
		formal_ratio = formal_count / total_words
		informal_ratio = informal_count / total_words
		
		# Formality score (0 = informal, 1 = formal, 0.5 = neutral)
		if formal_ratio + informal_ratio == 0:
			return 0.5
		else:
			return formal_ratio / (formal_ratio + informal_ratio)
	
	async def _calculate_complexity_score(self, documents: List[str]) -> float:
		"""Calculate language complexity score"""
		
		complexity_scores = []
		
		for document in documents:
			if not document.strip():
				continue
				
			# Use textstat if available
			if NLP_AVAILABLE:
				try:
					fk_grade = flesch_kincaid_grade(document)
					flesch_ease = flesch_reading_ease(document)
					ari_score = automated_readability_index(document)
					
					# Normalize scores to 0-1 range
					normalized_fk = min(max(fk_grade / 20.0, 0.0), 1.0)  # Grade 20+ = max complexity
					normalized_flesch = max(min((100 - flesch_ease) / 100.0, 1.0), 0.0)  # Invert Flesch score
					normalized_ari = min(max(ari_score / 20.0, 0.0), 1.0)  # Grade 20+ = max complexity
					
					complexity_score = (normalized_fk + normalized_flesch + normalized_ari) / 3
					complexity_scores.append(complexity_score)
				except (ValueError, TypeError, ZeroDivisionError) as e:
					self._log_analysis_error(f"Readability calculation failed, using fallback: {e}")
					complexity_scores.append(self._simple_complexity_score(document))
			else:
				complexity_scores.append(self._simple_complexity_score(document))
		
		return statistics.mean(complexity_scores) if complexity_scores else 0.5
	
	def _simple_complexity_score(self, text: str) -> float:
		"""Simple complexity scoring fallback"""
		
		if not text:
			return 0.0
			
		sentences = text.split('.')
		words = text.split()
		
		if not sentences or not words:
			return 0.0
		
		avg_sentence_length = len(words) / len(sentences)
		
		# Count complex words (3+ syllables - approximated)
		complex_words = 0
		for word in words:
			syllables = self._count_syllables(word)
			if syllables >= 3:
				complex_words += 1
		
		complex_word_ratio = complex_words / len(words) if words else 0
		
		# Normalize sentence length complexity (15+ words = high complexity)
		length_complexity = min(avg_sentence_length / 15.0, 1.0)
		
		return (length_complexity + complex_word_ratio) / 2
	
	def _count_syllables(self, word: str) -> int:
		"""Approximate syllable counting"""
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
	
	async def _extract_tone_profile(self, documents: List[str]) -> Dict[str, float]:
		"""Extract tone characteristics"""
		
		tone_indicators = {
			'professional': {
				'pleased', 'respectfully', 'sincerely', 'regards', 'appreciate', 
				'acknowledge', 'recommend', 'suggest', 'propose', 'consider'
			},
			'friendly': {
				'thanks', 'thank you', 'great', 'wonderful', 'fantastic', 
				'awesome', 'love', 'enjoy', 'happy', 'excited'
			},
			'authoritative': {
				'must', 'shall', 'will', 'required', 'mandatory', 'essential', 
				'critical', 'imperative', 'demand', 'insist'
			},
			'collaborative': {
				'together', 'partnership', 'collaborate', 'team', 'joint', 
				'shared', 'mutual', 'cooperative', 'alliance', 'unified'
			}
		}
		
		tone_counts = defaultdict(int)
		total_words = 0
		
		for document in documents:
			words = document.lower().split()
			total_words += len(words)
			
			for word in words:
				for tone, indicators in tone_indicators.items():
					if word in indicators:
						tone_counts[tone] += 1
		
		# Normalize to percentages
		tone_profile = {}
		for tone, count in tone_counts.items():
			tone_profile[tone] = count / total_words if total_words > 0 else 0.0
		
		return tone_profile
	
	async def _extract_persuasion_style(self, documents: List[str]) -> Dict[str, float]:
		"""Extract persuasion approach patterns"""
		
		persuasion_patterns = {
			'evidence_based': {
				'research shows', 'studies indicate', 'data demonstrates', 'evidence suggests',
				'statistics reveal', 'analysis confirms', 'findings show', 'proven', 'verified'
			},
			'benefit_focused': {
				'benefit', 'advantage', 'value', 'opportunity', 'gain', 'improve', 
				'enhance', 'optimize', 'maximize', 'increase'
			},
			'urgency_driven': {
				'immediate', 'urgent', 'quickly', 'now', 'today', 'deadline', 
				'limited time', 'act fast', 'don\'t wait', 'expires'
			},
			'relationship_based': {
				'trust', 'partnership', 'relationship', 'together', 'collaborate',
				'work with', 'support', 'understand', 'listen', 'care'
			}
		}
		
		pattern_counts = defaultdict(int)
		total_text_length = sum(len(doc) for doc in documents)
		
		for document in documents:
			doc_lower = document.lower()
			
			for style, patterns in persuasion_patterns.items():
				for pattern in patterns:
					count = doc_lower.count(pattern)
					pattern_counts[style] += count
		
		# Normalize by text length
		persuasion_style = {}
		for style, count in pattern_counts.items():
			persuasion_style[style] = count / max(total_text_length, 1) * 1000  # Per 1000 characters
		
		return persuasion_style
	
	async def _calculate_technical_density(self, documents: List[str]) -> float:
		"""Calculate technical language density"""
		
		technical_indicators = {
			'system', 'process', 'methodology', 'framework', 'architecture', 
			'implementation', 'specification', 'parameter', 'configuration', 
			'integration', 'optimization', 'algorithm', 'protocol', 'interface'
		}
		
		technical_count = 0
		total_words = 0
		
		for document in documents:
			words = document.lower().split()
			total_words += len(words)
			
			for word in words:
				if word in technical_indicators:
					technical_count += 1
		
		return technical_count / total_words if total_words > 0 else 0.0
	
	async def _identify_writing_patterns(self, documents: List[str]) -> List[WritingPattern]:
		"""Identify specific writing patterns in the corpus"""
		
		patterns = []
		
		# Vocabulary patterns
		vocab_patterns = await self._identify_vocabulary_patterns(documents)
		patterns.extend(vocab_patterns)
		
		# Structural patterns
		structure_patterns = await self._identify_structure_patterns(documents)
		patterns.extend(structure_patterns)
		
		# Style patterns
		style_patterns = await self._identify_style_patterns(documents)
		patterns.extend(style_patterns)
		
		# Filter by confidence threshold
		high_confidence_patterns = [
			pattern for pattern in patterns 
			if pattern.confidence_score >= self.pattern_confidence_threshold
		]
		
		return high_confidence_patterns
	
	async def _identify_vocabulary_patterns(self, documents: List[str]) -> List[WritingPattern]:
		"""Identify distinctive vocabulary patterns"""
		patterns = []
		
		# Find frequently used phrases
		full_text = ' '.join(documents).lower()
		
		# Simple n-gram analysis
		bigrams = self._extract_ngrams(full_text, 2)
		trigrams = self._extract_ngrams(full_text, 3)
		
		# Create patterns for high-frequency n-grams
		total_bigrams = sum(bigrams.values())
		for bigram, count in bigrams.most_common(20):
			frequency = count / total_bigrams
			if frequency > 0.001:  # More than 0.1% of all bigrams
				pattern = WritingPattern(
					component=VoiceComponent.VOCABULARY,
					pattern_type="phrase_frequency",
					pattern_description=f"Frequent use of phrase '{bigram}'",
					frequency_score=frequency,
					confidence_score=min(frequency * 1000, 1.0),
					examples=[bigram],
					contexts=["general usage"]
				)
				patterns.append(pattern)
		
		return patterns
	
	def _extract_ngrams(self, text: str, n: int) -> Counter:
		"""Extract n-grams from text"""
		words = text.split()
		ngrams = []
		
		for i in range(len(words) - n + 1):
			ngram = ' '.join(words[i:i+n])
			ngrams.append(ngram)
		
		return Counter(ngrams)
	
	async def _identify_structure_patterns(self, documents: List[str]) -> List[WritingPattern]:
		"""Identify structural writing patterns"""
		patterns = []
		
		# Analyze paragraph structures
		paragraph_lengths = []
		for document in documents:
			paragraphs = document.split('\n\n')
			for paragraph in paragraphs:
				if paragraph.strip():
					word_count = len(paragraph.split())
					paragraph_lengths.append(word_count)
		
		if paragraph_lengths:
			avg_paragraph_length = statistics.mean(paragraph_lengths)
			pattern = WritingPattern(
				component=VoiceComponent.SENTENCE_STRUCTURE,
				pattern_type="paragraph_structure",
				pattern_description=f"Average paragraph length: {avg_paragraph_length:.1f} words",
				frequency_score=1.0,
				confidence_score=0.8,
				examples=[f"Typical paragraph: {avg_paragraph_length:.0f} words"],
				contexts=["document structure"]
			)
			patterns.append(pattern)
		
		return patterns
	
	async def _identify_style_patterns(self, documents: List[str]) -> List[WritingPattern]:
		"""Identify stylistic patterns"""
		patterns = []
		
		# Analyze sentence variety
		question_count = 0
		exclamation_count = 0
		total_sentences = 0
		
		for document in documents:
			if NLP_AVAILABLE:
				sentences = sent_tokenize(document)
			else:
				sentences = document.split('.')
				
			total_sentences += len(sentences)
			question_count += document.count('?')
			exclamation_count += document.count('!')
		
		if total_sentences > 0:
			question_ratio = question_count / total_sentences
			exclamation_ratio = exclamation_count / total_sentences
			
			if question_ratio > 0.05:  # More than 5% questions
				pattern = WritingPattern(
					component=VoiceComponent.TONE,
					pattern_type="interrogative_style",
					pattern_description=f"Frequent use of questions ({question_ratio:.1%})",
					frequency_score=question_ratio,
					confidence_score=0.7,
					examples=["Uses questions to engage readers"],
					contexts=["rhetorical engagement"]
				)
				patterns.append(pattern)
		
		return patterns
	
	async def _calculate_consistency_score(self, documents: List[str], patterns: List[WritingPattern]) -> float:
		"""Calculate internal voice consistency"""
		
		if len(documents) < 2:
			return 1.0  # Single document is perfectly consistent
		
		# Analyze consistency across documents
		doc_scores = []
		
		for i, doc in enumerate(documents):
			doc_score = 0.0
			pattern_matches = 0
			
			for pattern in patterns:
				# Simple pattern matching - in production would be more sophisticated
				if pattern.pattern_type == "phrase_frequency" and pattern.examples:
					phrase = pattern.examples[0]
					if phrase.lower() in doc.lower():
						doc_score += pattern.frequency_score
						pattern_matches += 1
			
			if pattern_matches > 0:
				doc_scores.append(doc_score / pattern_matches)
			else:
				doc_scores.append(0.0)
		
		# Calculate coefficient of variation (lower = more consistent)
		if doc_scores and statistics.mean(doc_scores) > 0:
			cv = statistics.stdev(doc_scores) / statistics.mean(doc_scores)
			consistency = max(0.0, 1.0 - cv)  # Invert so higher = more consistent
		else:
			consistency = 0.5  # Neutral consistency
		
		return consistency
	
	async def _calculate_distinctiveness_score(self, vocabulary_signature: Dict[str, float], 
	                                          sentence_patterns: Dict[str, float]) -> float:
		"""Calculate how distinctive this voice is"""
		
		# Simple heuristic: voices with unique vocabulary and varied sentence patterns are more distinctive
		vocab_uniqueness = len(vocabulary_signature) / max(sum(vocabulary_signature.values()), 1)
		pattern_variety = len(sentence_patterns) / 20.0  # Normalize by expected pattern count
		
		distinctiveness = (vocab_uniqueness + min(pattern_variety, 1.0)) / 2
		return min(distinctiveness, 1.0)
	
	def _calculate_overall_confidence(self, patterns: List[WritingPattern], 
	                                 word_count: int, document_count: int) -> float:
		"""Calculate overall confidence in the voice fingerprint"""
		
		# Confidence factors
		corpus_size_factor = min(word_count / self.min_corpus_size, 1.0)
		document_count_factor = min(document_count / 5, 1.0)  # 5+ documents ideal
		pattern_count_factor = min(len(patterns) / 10, 1.0)  # 10+ patterns ideal
		
		# Pattern confidence
		if patterns:
			avg_pattern_confidence = statistics.mean([p.confidence_score for p in patterns])
		else:
			avg_pattern_confidence = 0.0
		
		# Weighted combination
		confidence = (
			corpus_size_factor * 0.3 +
			document_count_factor * 0.2 +
			pattern_count_factor * 0.2 +
			avg_pattern_confidence * 0.3
		)
		
		return confidence
	
	def get_voice_profile(self, organization_name: str) -> Optional[VoiceFingerprint]:
		"""Retrieve a stored voice profile"""
		return self.voice_profiles.get(organization_name)
	
	def list_voice_profiles(self) -> List[str]:
		"""List all stored voice profiles"""
		return list(self.voice_profiles.keys())
	
	def get_analyzer_statistics(self) -> Dict[str, Any]:
		"""Get analyzer performance and usage statistics"""
		
		profiles = list(self.voice_profiles.values())
		if not profiles:
			return {"total_profiles": 0}
		
		return {
			"total_profiles": len(profiles),
			"avg_confidence": statistics.mean([p.confidence_level for p in profiles]),
			"avg_documents_per_profile": statistics.mean([p.documents_analyzed for p in profiles]),
			"avg_patterns_per_profile": statistics.mean([len(p.patterns) for p in profiles]),
			"total_patterns_identified": sum(len(p.patterns) for p in profiles),
			"nlp_available": NLP_AVAILABLE
		}
	
	# Logging methods
	
	def _log_initialization(self):
		nlp_status = "available" if NLP_AVAILABLE else "not available (using fallbacks)"
		print(f"VoicePatternAnalyzer: Initialized (NLP libraries: {nlp_status})")
	
	def _log_analysis_start(self, organization_name: str, document_count: int):
		print(f"VoicePatternAnalyzer: Starting voice analysis for {organization_name} ({document_count} documents)")
	
	def _log_analysis_complete(self, organization_name: str, confidence: float, duration: float):
		print(f"VoicePatternAnalyzer: Completed analysis for {organization_name} (confidence: {confidence:.3f}, duration: {duration:.1f}s)")
	
	def _log_analysis_error(self, message: str):
		print(f"VoicePatternAnalyzer Error: {message}")


# Example usage and testing
async def create_sample_voice_analysis():
	"""Create sample voice analysis for testing"""
	
	# Initialize analyzer
	analyzer = VoicePatternAnalyzer()
	
	# Sample document corpus (representing an organization's writing style)
	sample_documents = [
		"""
		We are pleased to submit our comprehensive proposal for your consideration. Our organization 
		brings extensive expertise and proven methodologies to deliver exceptional results. We recommend 
		a collaborative approach that leverages our team's capabilities while ensuring alignment with 
		your strategic objectives. Our proven track record demonstrates consistent success in similar 
		engagements, and we are confident in our ability to exceed your expectations.
		""",
		"""
		Our technical approach incorporates industry best practices and innovative solutions. The proposed 
		methodology ensures robust implementation while maintaining flexibility for evolving requirements. 
		We appreciate the opportunity to demonstrate our capabilities and look forward to a successful 
		partnership. Our team's expertise spans multiple domains, enabling comprehensive solution delivery 
		that addresses your organization's unique challenges.
		""",
		"""
		We respectfully acknowledge your requirements and propose a solution that delivers measurable value. 
		Our research-driven approach ensures optimal outcomes through systematic implementation of proven 
		frameworks. The evidence clearly demonstrates the effectiveness of our methodology, and we are 
		committed to achieving exceptional results. We appreciate your consideration and welcome the 
		opportunity to discuss our proposal in detail.
		"""
	]
	
	# Perform voice analysis
	fingerprint = await analyzer.analyze_voice_patterns(
		sample_documents, 
		"Professional Services Firm"
	)
	
	return fingerprint, analyzer.get_analyzer_statistics()


if __name__ == "__main__":
	# Test the voice pattern analyzer
	import asyncio
	
	async def main():
		fingerprint, stats = await create_sample_voice_analysis()
		
		print("Voice Pattern Analysis Results:")
		print("=" * 50)
		print(f"Organization: {fingerprint.organization_name}")
		print(f"Confidence Level: {fingerprint.confidence_level:.3f}")
		print(f"Formality Level: {fingerprint.formality_level:.3f}")
		print(f"Complexity Score: {fingerprint.complexity_score:.3f}")
		print(f"Technical Density: {fingerprint.technical_density:.3f}")
		print(f"Consistency Score: {fingerprint.consistency_score:.3f}")
		print(f"Distinctiveness: {fingerprint.distinctiveness_score:.3f}")
		
		print(f"\nTone Profile:")
		for tone, score in fingerprint.tone_profile.items():
			print(f"  {tone.title()}: {score:.4f}")
		
		print(f"\nTop Vocabulary (showing first 10):")
		vocab_items = list(fingerprint.vocabulary_signature.items())[:10]
		for word, freq in vocab_items:
			print(f"  {word}: {freq:.4f}")
		
		print(f"\nIdentified Patterns ({len(fingerprint.patterns)}):")
		for pattern in fingerprint.patterns[:3]:  # Show first 3 patterns
			print(f"  📝 {pattern.pattern_description}")
			print(f"     Component: {pattern.component.value}")
			print(f"     Confidence: {pattern.confidence_score:.3f}")
		
		print(f"\nAnalyzer Statistics:")
		for key, value in stats.items():
			print(f"  {key.replace('_', ' ').title()}: {value}")
	
	asyncio.run(main())