"""
Voice Integration Engine

This module provides comprehensive integration between Voice DNA Engine
components and external NLP analyzers and document processing systems.
Enables seamless voice analysis workflow and unified API access.
"""

import logging
import asyncio
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union, Callable
from dataclasses import dataclass
from enum import Enum
import statistics

from pydantic import BaseModel, Field, ConfigDict
from uuid import uuid4

# Import Voice DNA components
from ..analyzer.voice_pattern_analyzer import VoicePatternAnalyzer, VoiceFingerprint, WritingPattern
from ..analyzer.style_pattern_extractor import StylePatternExtractor, StyleProfile, StylePattern
from ..validator.voice_validator import VoiceValidator, ValidationResult, VoiceDeviation
from ..validator.authenticity_scorer import AuthenticityScorer, AuthenticityReport, AuthenticityDimension
from ..profiler.voice_profiler import VoiceProfiler, VoiceProfile, ProfileType
from ..profiler.profile_manager import ProfileManager, ProfileVersion, ProfileComparison

# Import Enhancement components
from ..enhancement.writing_enhancer import WritingEnhancer, EnhancementRequest, EnhancementResult

logger = logging.getLogger(__name__)
from ..enhancement.content_quality_analyzer import ContentQualityAnalyzer, QualityAnalysisResult
from ..enhancement.style_guide_compliance import StyleGuideCompliance, ComplianceRequest, ComplianceResult
from ..enhancement.natural_writing_assistant import NaturalWritingAssistant, WritingAssistanceRequest, WritingAssistanceResult

# NLP imports with fallbacks
try:
	import spacy
	import nltk
	from textblob import TextBlob
	NLP_AVAILABLE = True
except ImportError:
	NLP_AVAILABLE = False


class AnalysisType(str, Enum):
	"""Types of voice analysis"""
	
	FULL_ANALYSIS = "full_analysis"
	PATTERN_ONLY = "pattern_only"
	VALIDATION_ONLY = "validation_only"
	STYLE_ONLY = "style_only"
	AUTHENTICITY_ONLY = "authenticity_only"
	COMPARISON = "comparison"
	
	# Enhancement-focused analysis types
	WRITING_ENHANCEMENT = "writing_enhancement"
	QUALITY_ANALYSIS = "quality_analysis"
	COMPLIANCE_CHECK = "compliance_check"
	WRITING_ASSISTANCE = "writing_assistance"
	COMPREHENSIVE_ENHANCEMENT = "comprehensive_enhancement"


class IntegrationMode(str, Enum):
	"""Integration operation modes"""
	
	REAL_TIME = "real_time"
	BATCH_PROCESSING = "batch_processing"
	CONTINUOUS_MONITORING = "continuous_monitoring"
	PIPELINE = "pipeline"


class AnalysisRequest(BaseModel):
	"""Request for voice analysis"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	request_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique request identifier")
	analysis_type: AnalysisType = Field(description="Type of analysis to perform")
	
	# Input data
	text_content: Optional[str] = Field(None, description="Text content to analyze")
	documents: Optional[List[str]] = Field(None, description="Multiple documents to analyze")
	document_metadata: Optional[Dict[str, Any]] = Field(None, description="Document metadata")
	
	# Organization context
	organization_name: str = Field(description="Organization name")
	target_audience: Optional[str] = Field(None, description="Target audience for content")
	document_type: Optional[str] = Field(None, description="Type of document")
	
	# Analysis configuration
	use_cached_profiles: bool = Field(default=True, description="Use cached voice profiles if available")
	create_profile: bool = Field(default=False, description="Create new voice profile from analysis")
	update_existing_profile: bool = Field(default=False, description="Update existing profile with results")
	
	# Processing options
	enable_nlp_enhancement: bool = Field(default=True, description="Use advanced NLP processing")
	include_recommendations: bool = Field(default=True, description="Include improvement recommendations")
	detailed_breakdown: bool = Field(default=False, description="Include detailed component breakdown")
	
	# Enhancement options (for enhancement-focused analysis types)
	enhancement_intensity: float = Field(default=0.7, ge=0.1, le=1.0, description="Enhancement intensity level")
	preserve_voice: bool = Field(default=True, description="Preserve original voice characteristics")
	style_guide_rules: Optional[Dict[str, Any]] = Field(None, description="Style guide rules for compliance")
	
	# Metadata
	requested_by: Optional[str] = Field(None, description="User/system requesting analysis")
	request_timestamp: datetime = Field(default_factory=datetime.now)


class AnalysisResult(BaseModel):
	"""Comprehensive voice analysis result"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	result_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique result identifier")
	request_id: str = Field(description="Associated request ID")
	analysis_type: AnalysisType = Field(description="Type of analysis performed")
	
	# Core results
	voice_fingerprint: Optional[VoiceFingerprint] = Field(None, description="Voice pattern analysis result")
	style_profile: Optional[StyleProfile] = Field(None, description="Style analysis result")
	validation_result: Optional[ValidationResult] = Field(None, description="Voice validation result")
	authenticity_report: Optional[AuthenticityReport] = Field(None, description="Authenticity analysis result")
	profile_comparison: Optional[ProfileComparison] = Field(None, description="Profile comparison result")
	
	# Enhancement results
	enhancement_result: Optional[EnhancementResult] = Field(None, description="Writing enhancement result")
	quality_analysis: Optional[QualityAnalysisResult] = Field(None, description="Content quality analysis result")
	compliance_result: Optional[ComplianceResult] = Field(None, description="Style guide compliance result")
	writing_assistance: Optional[WritingAssistanceResult] = Field(None, description="Writing assistance result")
	
	# Integrated analysis
	overall_voice_score: float = Field(ge=0.0, le=1.0, description="Overall voice quality score")
	consistency_score: float = Field(ge=0.0, le=1.0, description="Voice consistency score")
	authenticity_score: float = Field(ge=0.0, le=1.0, description="Voice authenticity score")
	confidence_level: float = Field(ge=0.0, le=1.0, description="Overall analysis confidence")
	
	# Recommendations
	key_recommendations: List[str] = Field(description="Top improvement recommendations")
	priority_issues: List[str] = Field(description="High priority issues to address")
	improvement_roadmap: Dict[str, List[str]] = Field(description="Structured improvement plan")
	
	# Performance metrics
	analysis_duration_seconds: float = Field(description="Total analysis time")
	components_analyzed: List[str] = Field(description="List of components that were analyzed")
	nlp_enhancement_used: bool = Field(description="Whether NLP enhancement was used")
	
	# Quality indicators
	data_quality_score: float = Field(ge=0.0, le=1.0, description="Input data quality assessment")
	analysis_completeness: float = Field(ge=0.0, le=1.0, description="Completeness of analysis")
	
	# Metadata
	organization_name: str = Field(description="Organization analyzed")
	analysis_timestamp: datetime = Field(default_factory=datetime.now)


class IntegrationConfig(BaseModel):
	"""Configuration for voice integration"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	# Component configuration
	enable_pattern_analysis: bool = Field(default=True, description="Enable voice pattern analysis")
	enable_style_analysis: bool = Field(default=True, description="Enable style pattern analysis")
	enable_validation: bool = Field(default=True, description="Enable voice validation")
	enable_authenticity_scoring: bool = Field(default=True, description="Enable authenticity scoring")
	enable_profile_management: bool = Field(default=True, description="Enable profile management")
	
	# NLP configuration
	nlp_model: str = Field(default="en_core_web_sm", description="spaCy model to use")
	enable_sentiment_analysis: bool = Field(default=True, description="Enable sentiment analysis")
	enable_entity_recognition: bool = Field(default=True, description="Enable named entity recognition")
	enable_dependency_parsing: bool = Field(default=False, description="Enable dependency parsing")
	
	# Performance configuration
	max_concurrent_analyses: int = Field(default=5, description="Maximum concurrent analyses")
	cache_results: bool = Field(default=True, description="Cache analysis results")
	cache_ttl_minutes: int = Field(default=60, description="Cache time-to-live in minutes")
	
	# Storage configuration
	profile_storage_path: Optional[str] = Field(None, description="Path for profile storage")
	result_storage_path: Optional[str] = Field(None, description="Path for result storage")
	enable_backup: bool = Field(default=True, description="Enable automatic backups")
	
	# Quality thresholds
	min_text_length: int = Field(default=100, description="Minimum text length for analysis")
	min_confidence_threshold: float = Field(default=0.5, description="Minimum confidence for results")
	max_analysis_time_seconds: int = Field(default=300, description="Maximum analysis time")


class DocumentAnalysisEngine:
	"""Document processing integration engine"""
	
	def __init__(self, config: IntegrationConfig):
		self.config = config
		self.processing_stats = defaultdict(int)
		
	async def extract_document_features(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
		"""Extract comprehensive document features for voice analysis"""
		
		features = {
			"text_stats": self._calculate_text_statistics(text),
			"structure_analysis": await self._analyze_document_structure(text),
			"linguistic_features": await self._extract_linguistic_features(text)
		}
		
		if metadata:
			features["metadata_analysis"] = self._analyze_metadata(metadata)
		
		return features
	
	def _calculate_text_statistics(self, text: str) -> Dict[str, Any]:
		"""Calculate basic text statistics"""
		
		words = text.split()
		sentences = text.split('.')
		
		return {
			"word_count": len(words),
			"sentence_count": len([s for s in sentences if s.strip()]),
			"paragraph_count": len([p for p in text.split('\n\n') if p.strip()]),
			"avg_words_per_sentence": len(words) / max(len(sentences), 1),
			"character_count": len(text),
			"unique_words": len(set(word.lower() for word in words))
		}
	
	async def _analyze_document_structure(self, text: str) -> Dict[str, Any]:
		"""Analyze document structure patterns"""
		
		structure = {
			"has_headers": bool(text.count('#') > 0 or text.count('=') > 5),
			"has_lists": bool(text.count('•') > 0 or text.count('-') > 3),
			"has_formatting": bool('*' in text or '_' in text),
			"paragraph_lengths": [],
			"sentence_variety": {}
		}
		
		# Analyze paragraphs
		paragraphs = [p for p in text.split('\n\n') if p.strip()]
		structure["paragraph_lengths"] = [len(p.split()) for p in paragraphs]
		
		# Analyze sentence types
		sentences = [s.strip() for s in text.split('.') if s.strip()]
		structure["sentence_variety"] = {
			"declarative": len([s for s in sentences if not s.endswith(('?', '!'))]),
			"interrogative": len([s for s in sentences if s.endswith('?')]),
			"exclamatory": len([s for s in sentences if s.endswith('!')])
		}
		
		return structure
	
	async def _extract_linguistic_features(self, text: str) -> Dict[str, Any]:
		"""Extract linguistic features using NLP"""
		
		features = {
			"pos_distribution": {},
			"named_entities": [],
			"sentiment": {"polarity": 0.0, "subjectivity": 0.0}
		}
		
		if NLP_AVAILABLE:
			try:
				# Use TextBlob for sentiment
				blob = TextBlob(text)
				features["sentiment"] = {
					"polarity": blob.sentiment.polarity,
					"subjectivity": blob.sentiment.subjectivity
				}
				
				# Basic POS analysis
				pos_counts = defaultdict(int)
				for word, pos in blob.tags:
					pos_counts[pos] += 1
				features["pos_distribution"] = dict(pos_counts)
				
			except Exception as e:
				logger.warning(f"Failed to extract advanced features: {e}")
				pass  # Fallback to basic analysis
		
		return features
	
	def _analyze_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
		"""Analyze document metadata for voice analysis context"""
		
		analysis = {
			"has_author": "author" in metadata,
			"has_date": "date" in metadata or "created_date" in metadata,
			"has_type": "document_type" in metadata or "type" in metadata,
			"has_audience": "audience" in metadata or "target_audience" in metadata,
			"metadata_completeness": len(metadata) / 10.0  # Normalize by expected fields
		}
		
		return analysis


class NLPAnalysisEngine:
	"""Advanced NLP analysis integration engine"""
	
	def __init__(self, config: IntegrationConfig):
		self.config = config
		self.nlp = None
		self._initialize_nlp()
		
	def _initialize_nlp(self):
		"""Initialize NLP pipeline"""
		
		if not NLP_AVAILABLE:
			return
		
		try:
			self.nlp = spacy.load(self.config.nlp_model)
		except OSError:
			try:
				self.nlp = spacy.load("en_core_web_sm")
			except OSError:
				self.nlp = None
	
	async def enhance_voice_analysis(self, text: str, base_analysis: Dict[str, Any]) -> Dict[str, Any]:
		"""Enhance voice analysis with advanced NLP"""
		
		if not self.nlp:
			return base_analysis
		
		enhanced = base_analysis.copy()
		
		try:
			doc = self.nlp(text)
			
			# Add linguistic complexity
			enhanced["linguistic_complexity"] = self._calculate_linguistic_complexity(doc)
			
			# Add syntactic patterns
			enhanced["syntactic_patterns"] = self._extract_syntactic_patterns(doc)
			
			# Add semantic analysis
			enhanced["semantic_features"] = await self._extract_semantic_features(doc)
			
			# Add discourse markers
			enhanced["discourse_markers"] = self._identify_discourse_markers(doc)
			
		except Exception as e:
			enhanced["nlp_error"] = str(e)
		
		return enhanced
	
	def _calculate_linguistic_complexity(self, doc) -> Dict[str, float]:
		"""Calculate linguistic complexity metrics"""
		
		sentences = list(doc.sents)
		tokens = [token for token in doc if not token.is_space]
		
		if not sentences or not tokens:
			return {"error": "insufficient_data"}
		
		# Calculate various complexity metrics
		avg_sentence_length = len(tokens) / len(sentences)
		avg_word_length = sum(len(token.text) for token in tokens if token.is_alpha) / max(len([t for t in tokens if t.is_alpha]), 1)
		
		# Dependency depth (approximation)
		max_depth = 0
		for sent in sentences:
			for token in sent:
				depth = self._calculate_dependency_depth(token)
				max_depth = max(max_depth, depth)
		
		return {
			"avg_sentence_length": avg_sentence_length,
			"avg_word_length": avg_word_length,
			"max_dependency_depth": max_depth,
			"clause_complexity": self._calculate_clause_complexity(sentences)
		}
	
	def _calculate_dependency_depth(self, token, depth=0) -> int:
		"""Calculate dependency tree depth"""
		if not token.children:
			return depth
		return max(self._calculate_dependency_depth(child, depth + 1) for child in token.children)
	
	def _calculate_clause_complexity(self, sentences) -> float:
		"""Calculate average clause complexity"""
		
		clause_counts = []
		for sent in sentences:
			# Simple approximation: count subordinating conjunctions and relative pronouns
			subordinating_markers = ['SCONJ', 'PRON']  # Simplified
			clause_markers = sum(1 for token in sent if token.pos_ in subordinating_markers)
			clause_counts.append(clause_markers + 1)  # At least one main clause
		
		return statistics.mean(clause_counts) if clause_counts else 1.0
	
	def _extract_syntactic_patterns(self, doc) -> Dict[str, Any]:
		"""Extract syntactic patterns from text"""
		
		patterns = {
			"pos_patterns": defaultdict(int),
			"dependency_patterns": defaultdict(int),
			"phrase_types": defaultdict(int)
		}
		
		for token in doc:
			patterns["pos_patterns"][token.pos_] += 1
			patterns["dependency_patterns"][token.dep_] += 1
		
		# Convert to relative frequencies
		total_tokens = len([t for t in doc if not t.is_space])
		if total_tokens > 0:
			for category in patterns:
				for pattern in patterns[category]:
					patterns[category][pattern] = patterns[category][pattern] / total_tokens
		
		return dict(patterns)
	
	async def _extract_semantic_features(self, doc) -> Dict[str, Any]:
		"""Extract semantic features"""
		
		features = {
			"entities": [],
			"entity_types": defaultdict(int),
			"key_phrases": []
		}
		
		# Named entities
		for ent in doc.ents:
			features["entities"].append({
				"text": ent.text,
				"label": ent.label_,
				"start": ent.start,
				"end": ent.end
			})
			features["entity_types"][ent.label_] += 1
		
		# Key phrases (simple noun phrases)
		for chunk in doc.noun_chunks:
			if len(chunk.text.split()) > 1:  # Multi-word phrases
				features["key_phrases"].append(chunk.text)
		
		return features
	
	def _identify_discourse_markers(self, doc) -> Dict[str, List[str]]:
		"""Identify discourse markers and connectives"""
		
		markers = {
			"temporal": ["first", "then", "next", "finally", "meanwhile", "subsequently"],
			"causal": ["because", "therefore", "thus", "consequently", "as a result"],
			"contrastive": ["however", "nevertheless", "on the other hand", "despite", "although"],
			"additive": ["furthermore", "moreover", "additionally", "also", "in addition"]
		}
		
		found_markers = defaultdict(list)
		text_lower = doc.text.lower()
		
		for category, marker_list in markers.items():
			for marker in marker_list:
				if marker in text_lower:
					found_markers[category].append(marker)
		
		return dict(found_markers)


class VoiceIntegrator:
	"""
	Comprehensive voice analysis integration system
	
	Orchestrates all Voice DNA Engine components with NLP enhancement
	and document processing to provide unified voice analysis capabilities.
	"""
	
	def __init__(self, config: Optional[IntegrationConfig] = None):
		self.config = config or IntegrationConfig()
		
		# Initialize core components
		self.pattern_analyzer = VoicePatternAnalyzer() if self.config.enable_pattern_analysis else None
		self.style_extractor = StylePatternExtractor() if self.config.enable_style_analysis else None
		self.voice_validator = VoiceValidator() if self.config.enable_validation else None
		self.authenticity_scorer = AuthenticityScorer() if self.config.enable_authenticity_scoring else None
		self.voice_profiler = VoiceProfiler() if self.config.enable_profile_management else None
		self.profile_manager = ProfileManager(self.config.profile_storage_path) if self.config.enable_profile_management else None
		
		# Initialize enhancement components
		self.writing_enhancer = WritingEnhancer()
		self.quality_analyzer = ContentQualityAnalyzer()
		self.compliance_checker = StyleGuideCompliance()
		self.writing_assistant = NaturalWritingAssistant()
		
		# Initialize integration engines
		self.document_engine = DocumentAnalysisEngine(self.config)
		self.nlp_engine = NLPAnalysisEngine(self.config)
		
		# Analysis state
		self.active_analyses: Dict[str, AnalysisRequest] = {}
		self.analysis_cache: Dict[str, AnalysisResult] = {}
		self.integration_stats = defaultdict(int)
		
		self._log_initialization()
	
	async def analyze(self, request: AnalysisRequest) -> AnalysisResult:
		"""
		Perform comprehensive voice analysis
		
		Args:
			request: Analysis request configuration
			
		Returns:
			Comprehensive analysis result
		"""
		start_time = datetime.now()
		
		try:
			self._log_analysis_start(request.request_id, request.analysis_type.value)
			self.active_analyses[request.request_id] = request
			
			# Validate input
			await self._validate_analysis_request(request)
			
			# Check cache first
			if self.config.cache_results:
				cached_result = self._get_cached_result(request)
				if cached_result:
					self._log_cache_hit(request.request_id)
					return cached_result
			
			# Prepare input data
			text_content, documents = self._prepare_input_data(request)
			
			# Extract document features
			document_features = await self.document_engine.extract_document_features(
				text_content, request.document_metadata
			)
			
			# Perform core analysis based on type
			analysis_results = await self._perform_core_analysis(
				request, text_content, documents, document_features
			)
			
			# Enhance with NLP if enabled
			if request.enable_nlp_enhancement and self.config.enable_sentiment_analysis:
				analysis_results = await self.nlp_engine.enhance_voice_analysis(
					text_content, analysis_results
				)
			
			# Generate comprehensive result
			result = await self._generate_analysis_result(
				request, analysis_results, document_features, start_time
			)
			
			# Cache result if enabled
			if self.config.cache_results:
				self._cache_result(request, result)
			
			# Update profiles if requested
			if request.create_profile or request.update_existing_profile:
				await self._update_voice_profiles(request, result)
			
			# Update statistics
			self.integration_stats["analyses_completed"] += 1
			self.integration_stats[f"{request.analysis_type.value}_analyses"] += 1
			
			# Clean up
			self.active_analyses.pop(request.request_id, None)
			
			self._log_analysis_complete(
				request.request_id, result.overall_voice_score, result.analysis_duration_seconds
			)
			
			return result
			
		except Exception as e:
			self._log_analysis_error(f"Analysis failed for {request.request_id}: {str(e)}")
			self.active_analyses.pop(request.request_id, None)
			raise
	
	async def _validate_analysis_request(self, request: AnalysisRequest):
		"""Validate analysis request"""
		
		if not request.text_content and not request.documents:
			raise ValueError("Either text_content or documents must be provided")
		
		if request.text_content and len(request.text_content) < self.config.min_text_length:
			raise ValueError(f"Text too short: {len(request.text_content)} < {self.config.min_text_length}")
		
		if not request.organization_name:
			raise ValueError("Organization name is required")
	
	def _prepare_input_data(self, request: AnalysisRequest) -> Tuple[str, List[str]]:
		"""Prepare input data for analysis"""
		
		if request.text_content:
			text_content = request.text_content
			documents = [request.text_content]
		elif request.documents:
			text_content = ' '.join(request.documents)
			documents = request.documents
		else:
			raise ValueError("No input data provided")
		
		return text_content, documents
	
	async def _perform_core_analysis(self,
	                                 request: AnalysisRequest,
	                                 text_content: str,
	                                 documents: List[str],
	                                 document_features: Dict[str, Any]) -> Dict[str, Any]:
		"""Perform core voice analysis components"""
		
		results = {"components_analyzed": []}
		
		# Voice pattern analysis
		if (request.analysis_type in [AnalysisType.FULL_ANALYSIS, AnalysisType.PATTERN_ONLY] and 
		    self.pattern_analyzer):
			results["voice_fingerprint"] = await self.pattern_analyzer.analyze_voice_patterns(
				documents, request.organization_name
			)
			results["components_analyzed"].append("voice_patterns")
		
		# Style pattern analysis
		if (request.analysis_type in [AnalysisType.FULL_ANALYSIS, AnalysisType.STYLE_ONLY] and 
		    self.style_extractor):
			results["style_profile"] = await self.style_extractor.extract_style_patterns(
				documents, request.organization_name
			)
			results["components_analyzed"].append("style_patterns")
		
		# Voice validation
		if (request.analysis_type in [AnalysisType.FULL_ANALYSIS, AnalysisType.VALIDATION_ONLY] and 
		    self.voice_validator):
			
			# Get or use existing voice profile
			voice_profile = results.get("voice_fingerprint")
			if not voice_profile and request.use_cached_profiles:
				voice_profile = self.voice_validator.voice_profiles_cache.get(request.organization_name)
			
			if voice_profile:
				results["validation_result"] = await self.voice_validator.validate_voice_consistency(
					text_content, request.organization_name, voice_profile
				)
				results["components_analyzed"].append("voice_validation")
		
		# Authenticity scoring
		if (request.analysis_type in [AnalysisType.FULL_ANALYSIS, AnalysisType.AUTHENTICITY_ONLY] and 
		    self.authenticity_scorer):
			
			voice_profile = results.get("voice_fingerprint")
			style_profile = results.get("style_profile")
			
			results["authenticity_report"] = await self.authenticity_scorer.assess_authenticity(
				text_content, request.organization_name, voice_profile, style_profile,
				request.target_audience
			)
			results["components_analyzed"].append("authenticity_scoring")
		
		# Profile comparison
		if request.analysis_type == AnalysisType.COMPARISON and self.profile_manager:
			# Implementation would depend on comparison parameters in request
			results["components_analyzed"].append("profile_comparison")
		
		# Enhancement-focused analyses
		if request.analysis_type in [AnalysisType.WRITING_ENHANCEMENT, AnalysisType.COMPREHENSIVE_ENHANCEMENT]:
			enhancement_request = EnhancementRequest(
				text=text_content,
				enhancement_intensity=request.enhancement_intensity,
				preserve_original_voice=request.preserve_voice,
				context=request.document_type or "general"
			)
			results["enhancement_result"] = await self.writing_enhancer.enhance_writing(enhancement_request)
			results["components_analyzed"].append("writing_enhancement")
		
		if request.analysis_type in [AnalysisType.QUALITY_ANALYSIS, AnalysisType.COMPREHENSIVE_ENHANCEMENT]:
			results["quality_analysis"] = await self.quality_analyzer.analyze_content_quality(
				text_content, 
				target_audience=request.target_audience,
				content_type=request.document_type
			)
			results["components_analyzed"].append("quality_analysis")
		
		if request.analysis_type in [AnalysisType.COMPLIANCE_CHECK, AnalysisType.COMPREHENSIVE_ENHANCEMENT]:
			if request.style_guide_rules:
				compliance_request = ComplianceRequest(
					text=text_content,
					organization_name=request.organization_name,
					custom_style_guide=request.style_guide_rules,
					target_audience=request.target_audience
				)
				results["compliance_result"] = await self.compliance_checker.check_compliance(compliance_request)
				results["components_analyzed"].append("compliance_check")
		
		if request.analysis_type in [AnalysisType.WRITING_ASSISTANCE, AnalysisType.COMPREHENSIVE_ENHANCEMENT]:
			assistance_request = WritingAssistanceRequest(
				text=text_content,
				enhancement_intensity=request.enhancement_intensity,
				target_audience=request.target_audience,
				context=request.document_type
			)
			results["writing_assistance"] = await self.writing_assistant.provide_assistance(assistance_request)
			results["components_analyzed"].append("writing_assistance")
		
		return results
	
	async def _generate_analysis_result(self,
	                                    request: AnalysisRequest,
	                                    analysis_results: Dict[str, Any],
	                                    document_features: Dict[str, Any],
	                                    start_time: datetime) -> AnalysisResult:
		"""Generate comprehensive analysis result"""
		
		# Extract individual results
		voice_fingerprint = analysis_results.get("voice_fingerprint")
		style_profile = analysis_results.get("style_profile")
		validation_result = analysis_results.get("validation_result")
		authenticity_report = analysis_results.get("authenticity_report")
		
		# Extract enhancement results
		enhancement_result = analysis_results.get("enhancement_result")
		quality_analysis = analysis_results.get("quality_analysis")
		compliance_result = analysis_results.get("compliance_result")
		writing_assistance = analysis_results.get("writing_assistance")
		
		# Calculate integrated scores
		overall_voice_score = self._calculate_overall_voice_score(
			voice_fingerprint, validation_result, authenticity_report
		)
		
		consistency_score = validation_result.overall_voice_score if validation_result else 0.5
		authenticity_score = authenticity_report.overall_authenticity if authenticity_report else 0.5
		confidence_level = self._calculate_overall_confidence(
			voice_fingerprint, style_profile, validation_result, authenticity_report
		)
		
		# Generate recommendations
		key_recommendations, priority_issues, improvement_roadmap = self._generate_recommendations(
			voice_fingerprint, validation_result, authenticity_report, request.include_recommendations
		)
		
		# Calculate data quality
		data_quality_score = self._assess_data_quality(document_features)
		analysis_completeness = len(analysis_results.get("components_analyzed", [])) / 4.0  # 4 main components
		
		return AnalysisResult(
			request_id=request.request_id,
			analysis_type=request.analysis_type,
			voice_fingerprint=voice_fingerprint,
			style_profile=style_profile,
			validation_result=validation_result,
			authenticity_report=authenticity_report,
			enhancement_result=enhancement_result,
			quality_analysis=quality_analysis,
			compliance_result=compliance_result,
			writing_assistance=writing_assistance,
			overall_voice_score=overall_voice_score,
			consistency_score=consistency_score,
			authenticity_score=authenticity_score,
			confidence_level=confidence_level,
			key_recommendations=key_recommendations,
			priority_issues=priority_issues,
			improvement_roadmap=improvement_roadmap,
			analysis_duration_seconds=(datetime.now() - start_time).total_seconds(),
			components_analyzed=analysis_results.get("components_analyzed", []),
			nlp_enhancement_used=request.enable_nlp_enhancement,
			data_quality_score=data_quality_score,
			analysis_completeness=analysis_completeness,
			organization_name=request.organization_name
		)
	
	def _calculate_overall_voice_score(self,
	                                   voice_fingerprint: Optional[VoiceFingerprint],
	                                   validation_result: Optional[ValidationResult],
	                                   authenticity_report: Optional[AuthenticityReport]) -> float:
		"""Calculate integrated voice score"""
		
		scores = []
		
		if voice_fingerprint:
			scores.append(voice_fingerprint.confidence_level)
		
		if validation_result:
			scores.append(validation_result.overall_voice_score)
		
		if authenticity_report:
			scores.append(authenticity_report.overall_authenticity)
		
		return statistics.mean(scores) if scores else 0.5
	
	def _calculate_overall_confidence(self,
	                                  voice_fingerprint: Optional[VoiceFingerprint],
	                                  style_profile: Optional[StyleProfile],
	                                  validation_result: Optional[ValidationResult],
	                                  authenticity_report: Optional[AuthenticityReport]) -> float:
		"""Calculate overall analysis confidence"""
		
		confidences = []
		
		if voice_fingerprint:
			confidences.append(voice_fingerprint.confidence_level)
		
		if style_profile:
			confidences.append(style_profile.confidence_level)
		
		if validation_result:
			confidences.append(validation_result.voice_confidence)
		
		if authenticity_report:
			confidences.append(authenticity_report.confidence_level)
		
		return statistics.mean(confidences) if confidences else 0.5
	
	def _generate_recommendations(self,
	                              voice_fingerprint: Optional[VoiceFingerprint],
	                              validation_result: Optional[ValidationResult],
	                              authenticity_report: Optional[AuthenticityReport],
	                              include_recommendations: bool) -> Tuple[List[str], List[str], Dict[str, List[str]]]:
		"""Generate integrated recommendations"""
		
		if not include_recommendations:
			return [], [], {}
		
		key_recommendations = []
		priority_issues = []
		improvement_roadmap = defaultdict(list)
		
		# From validation result
		if validation_result:
			key_recommendations.extend(validation_result.key_recommendations[:3])
			
			for deviation in validation_result.deviations:
				if deviation.severity.value in ["critical", "high"]:
					priority_issues.append(deviation.deviation_description)
					improvement_roadmap["immediate"].extend(deviation.improvement_suggestions)
				elif deviation.severity.value == "medium":
					improvement_roadmap["short_term"].extend(deviation.improvement_suggestions)
				else:
					improvement_roadmap["long_term"].extend(deviation.improvement_suggestions)
		
		# From authenticity report
		if authenticity_report:
			for dimension_result in authenticity_report.dimension_results:
				if dimension_result.authenticity_score < 0.6:
					priority_issues.append(f"Low {dimension_result.dimension.value} authenticity")
					improvement_roadmap["short_term"].extend(dimension_result.improvement_recommendations)
		
		# Voice fingerprint recommendations
		if voice_fingerprint and voice_fingerprint.confidence_level < 0.7:
			key_recommendations.append("Increase document corpus size for better voice profiling")
			improvement_roadmap["long_term"].append("Collect more writing samples for analysis")
		
		# Deduplicate and limit
		key_recommendations = list(dict.fromkeys(key_recommendations))[:5]
		priority_issues = list(dict.fromkeys(priority_issues))[:5]
		
		# Clean up roadmap
		for timeframe in improvement_roadmap:
			improvement_roadmap[timeframe] = list(dict.fromkeys(improvement_roadmap[timeframe]))[:3]
		
		return key_recommendations, priority_issues, dict(improvement_roadmap)
	
	def _assess_data_quality(self, document_features: Dict[str, Any]) -> float:
		"""Assess input data quality"""
		
		text_stats = document_features.get("text_stats", {})
		
		quality_factors = []
		
		# Word count factor
		word_count = text_stats.get("word_count", 0)
		quality_factors.append(min(word_count / 500, 1.0))  # 500+ words = full score
		
		# Sentence variety factor
		sentence_count = text_stats.get("sentence_count", 0)
		if sentence_count > 0:
			quality_factors.append(min(sentence_count / 20, 1.0))  # 20+ sentences = full score
		else:
			quality_factors.append(0.0)
		
		# Unique vocabulary factor
		unique_words = text_stats.get("unique_words", 0)
		total_words = text_stats.get("word_count", 1)
		vocabulary_diversity = unique_words / total_words
		quality_factors.append(min(vocabulary_diversity * 2, 1.0))  # 50% diversity = full score
		
		return statistics.mean(quality_factors)
	
	async def _update_voice_profiles(self, request: AnalysisRequest, result: AnalysisResult):
		"""Update voice profiles based on analysis results"""
		
		if not self.voice_profiler or not self.profile_manager:
			return
		
		try:
			if request.create_profile and result.voice_fingerprint:
				# Create new voice profile
				documents = request.documents or [request.text_content]
				voice_profile = await self.voice_profiler.create_voice_profile(
					request.organization_name, documents
				)
				
				# Create initial version
				await self.profile_manager.create_profile_version(
					voice_profile, "Initial profile creation from analysis", request.requested_by
				)
			
			elif request.update_existing_profile and result.voice_fingerprint:
				# Update existing profile - implementation would depend on update strategy
				pass
				
		except Exception as e:
			self._log_profile_update_error(f"Profile update failed: {str(e)}")
	
	# Caching methods
	
	def _get_cached_result(self, request: AnalysisRequest) -> Optional[AnalysisResult]:
		"""Get cached analysis result"""
		
		cache_key = self._generate_cache_key(request)
		cached_result = self.analysis_cache.get(cache_key)
		
		if cached_result:
			# Check if cache is still valid
			cache_age = datetime.now() - cached_result.analysis_timestamp
			if cache_age.total_seconds() / 60 < self.config.cache_ttl_minutes:
				return cached_result
			else:
				# Remove expired cache entry
				self.analysis_cache.pop(cache_key, None)
		
		return None
	
	def _cache_result(self, request: AnalysisRequest, result: AnalysisResult):
		"""Cache analysis result"""
		
		cache_key = self._generate_cache_key(request)
		self.analysis_cache[cache_key] = result
		
		# Simple cache size management
		if len(self.analysis_cache) > 100:
			# Remove oldest entries
			oldest_keys = sorted(
				self.analysis_cache.keys(),
				key=lambda k: self.analysis_cache[k].analysis_timestamp
			)[:20]
			for key in oldest_keys:
				self.analysis_cache.pop(key, None)
	
	def _generate_cache_key(self, request: AnalysisRequest) -> str:
		"""Generate cache key for request"""
		
		# Simple hash-based cache key
		key_components = [
			request.analysis_type.value,
			request.organization_name,
			request.text_content[:100] if request.text_content else "",
			str(len(request.documents or [])),
			str(request.enable_nlp_enhancement)
		]
		
		return "_".join(key_components)
	
	def get_integration_statistics(self) -> Dict[str, Any]:
		"""Get comprehensive integration statistics"""
		
		return {
			"total_analyses": self.integration_stats.get("analyses_completed", 0),
			"active_analyses": len(self.active_analyses),
			"cached_results": len(self.analysis_cache),
			"component_status": {
				"pattern_analyzer": self.pattern_analyzer is not None,
				"style_extractor": self.style_extractor is not None,
				"voice_validator": self.voice_validator is not None,
				"authenticity_scorer": self.authenticity_scorer is not None,
				"voice_profiler": self.voice_profiler is not None,
				"profile_manager": self.profile_manager is not None
			},
			"nlp_available": NLP_AVAILABLE,
			"config": self.config.model_dump()
		}
	
	# Logging methods
	
	def _log_initialization(self):
		components = [name for name, enabled in [
			("Pattern Analysis", self.pattern_analyzer is not None),
			("Style Analysis", self.style_extractor is not None),
			("Voice Validation", self.voice_validator is not None),
			("Authenticity Scoring", self.authenticity_scorer is not None),
			("Profile Management", self.profile_manager is not None)
		] if enabled]
		
		nlp_status = "available" if NLP_AVAILABLE else "fallback mode"
		print(f"VoiceIntegrator: Initialized with {len(components)} components ({nlp_status})")
		print(f"  Components: {', '.join(components)}")
	
	def _log_analysis_start(self, request_id: str, analysis_type: str):
		print(f"VoiceIntegrator: Starting {analysis_type} analysis [{request_id}]")
	
	def _log_analysis_complete(self, request_id: str, voice_score: float, duration: float):
		print(f"VoiceIntegrator: Analysis complete [{request_id}] (score: {voice_score:.3f}, {duration:.2f}s)")
	
	def _log_cache_hit(self, request_id: str):
		print(f"VoiceIntegrator: Cache hit for analysis [{request_id}]")
	
	def _log_analysis_error(self, message: str):
		print(f"VoiceIntegrator Error: {message}")
	
	def _log_profile_update_error(self, message: str):
		print(f"VoiceIntegrator Profile Error: {message}")


# Example usage and testing
async def create_sample_voice_integration():
	"""Create sample voice integration for testing"""
	
	# Initialize integrator with default configuration
	config = IntegrationConfig(
		enable_pattern_analysis=True,
		enable_style_analysis=True,
		enable_validation=True,
		enable_authenticity_scoring=True,
		cache_results=True
	)
	
	integrator = VoiceIntegrator(config)
	
	# Sample analysis request
	request = AnalysisRequest(
		analysis_type=AnalysisType.FULL_ANALYSIS,
		text_content="""
		We are pleased to present our comprehensive proposal for your organization's digital transformation initiative. 
		Our team brings extensive expertise in implementing innovative solutions that deliver measurable value. Through 
		systematic analysis of your requirements, we have developed a strategic approach that addresses your unique challenges 
		while leveraging proven methodologies. We recommend a phased implementation that ensures minimal disruption to 
		your operations while maximizing the benefits of the proposed solution. Our collaborative approach emphasizes 
		partnership and knowledge transfer, ensuring your team is fully prepared to maintain and enhance the system 
		post-implementation. We are confident in our ability to exceed your expectations and look forward to discussing 
		this proposal in detail.
		""",
		organization_name="Professional Services Firm",
		target_audience="Enterprise Clients",
		document_type="Proposal",
		enable_nlp_enhancement=True,
		include_recommendations=True,
		detailed_breakdown=True,
		create_profile=True,
		requested_by="integration_test"
	)
	
	# Perform analysis
	result = await integrator.analyze(request)
	
	return {
		"integrator": integrator,
		"request": request,
		"result": result,
		"stats": integrator.get_integration_statistics()
	}


if __name__ == "__main__":
	# Test the voice integration
	import asyncio
	
	async def main():
		sample = await create_sample_voice_integration()
		
		print("Voice Integration Results:")
		print("=" * 60)
		
		result = sample["result"]
		print(f"Request ID: {result.request_id}")
		print(f"Analysis Type: {result.analysis_type.value}")
		print(f"Organization: {result.organization_name}")
		
		print(f"\n🎯 Overall Scores:")
		print(f"  Voice Score: {result.overall_voice_score:.3f}")
		print(f"  Consistency: {result.consistency_score:.3f}")
		print(f"  Authenticity: {result.authenticity_score:.3f}")
		print(f"  Confidence: {result.confidence_level:.3f}")
		
		print(f"\n🔍 Components Analyzed:")
		for component in result.components_analyzed:
			print(f"  ✅ {component.replace('_', ' ').title()}")
		
		print(f"\n📊 Quality Metrics:")
		print(f"  Data Quality: {result.data_quality_score:.3f}")
		print(f"  Completeness: {result.analysis_completeness:.3f}")
		print(f"  Analysis Time: {result.analysis_duration_seconds:.2f}s")
		print(f"  NLP Enhanced: {'✅' if result.nlp_enhancement_used else '❌'}")
		
		if result.key_recommendations:
			print(f"\n💡 Key Recommendations:")
			for i, rec in enumerate(result.key_recommendations, 1):
				print(f"  {i}. {rec}")
		
		if result.priority_issues:
			print(f"\n⚠️ Priority Issues:")
			for i, issue in enumerate(result.priority_issues, 1):
				print(f"  {i}. {issue}")
		
		if result.improvement_roadmap:
			print(f"\n🗺️ Improvement Roadmap:")
			for timeframe, actions in result.improvement_roadmap.items():
				if actions:
					print(f"  {timeframe.replace('_', ' ').title()}:")
					for action in actions:
						print(f"    • {action}")
		
		print(f"\nIntegration Statistics:")
		stats = sample["stats"]
		for key, value in stats.items():
			if isinstance(value, dict):
				print(f"  {key.replace('_', ' ').title()}:")
				for k, v in value.items():
					print(f"    {k}: {v}")
			else:
				print(f"  {key.replace('_', ' ').title()}: {value}")
	
	asyncio.run(main())