"""
Voice Profiler

This module provides comprehensive voice profile creation from document corpora,
with multi-dimensional voice modeling, evolution tracking, comparison capabilities,
and voice segmentation by document type and audience. Serves as the primary
interface for creating and managing organizational voice profiles.
"""

import asyncio
import logging
logger = logging.getLogger(__name__)
import json
import pickle
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum
import statistics
import hashlib

from pydantic import BaseModel, Field, ConfigDict, field_validator
from uuid import uuid4

# Import voice analysis components
from ..analyzer.voice_pattern_analyzer import VoicePatternAnalyzer, VoiceFingerprint, WritingPattern, VoiceComponent
from ..analyzer.style_pattern_extractor import StylePatternExtractor, StyleProfile, StylePattern, StyleDimension

# NLP imports with fallbacks
try:
	import numpy as np
	from sklearn.cluster import KMeans
	from sklearn.feature_extraction.text import TfidfVectorizer
	from sklearn.metrics.pairwise import cosine_similarity
	from sklearn.decomposition import PCA
	SKLEARN_AVAILABLE = True
except ImportError:
	SKLEARN_AVAILABLE = False


class ProfileType(str, Enum):
	"""Types of voice profiles"""
	
	MASTER_PROFILE = "master_profile"
	DOCUMENT_TYPE_PROFILE = "document_type_profile"
	AUDIENCE_PROFILE = "audience_profile"
	TEMPORAL_PROFILE = "temporal_profile"
	AUTHOR_PROFILE = "author_profile"
	DEPARTMENT_PROFILE = "department_profile"


class ProfileStatus(str, Enum):
	"""Status of voice profiles"""
	
	ACTIVE = "active"
	DRAFT = "draft"
	ARCHIVED = "archived"
	DEPRECATED = "deprecated"
	UNDER_REVIEW = "under_review"


class DocumentMetadata(BaseModel):
	"""Metadata for documents used in voice profiling"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	document_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique document identifier")
	document_title: Optional[str] = Field(None, description="Document title")
	document_type: str = Field(description="Type of document (proposal, report, email, etc.)")
	
	# Document characteristics
	word_count: int = Field(ge=0, description="Number of words in document")
	creation_date: Optional[datetime] = Field(None, description="Document creation date")
	author: Optional[str] = Field(None, description="Document author")
	department: Optional[str] = Field(None, description="Originating department")
	
	# Audience information
	target_audience: Optional[str] = Field(None, description="Target audience description")
	audience_level: Optional[str] = Field(None, description="Audience level (executive, technical, general)")
	
	# Content characteristics
	formality_level: Optional[float] = Field(None, ge=0.0, le=1.0, description="Document formality level")
	technical_density: Optional[float] = Field(None, ge=0.0, le=1.0, description="Technical content density")
	
	# Quality metrics
	voice_consistency_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Voice consistency score")
	brand_alignment_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Brand alignment score")
	
	# Processing metadata
	processing_timestamp: datetime = Field(default_factory=datetime.now)
	content_hash: str = Field(description="Hash of document content for deduplication")


class VoiceEvolutionPoint(BaseModel):
	"""Point in time snapshot of voice evolution"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	evolution_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique evolution point identifier")
	timestamp: datetime = Field(default_factory=datetime.now)
	
	# Voice characteristics at this point
	voice_fingerprint: VoiceFingerprint = Field(description="Voice fingerprint at this time")
	style_profile: Optional[StyleProfile] = Field(None, description="Style profile at this time")
	
	# Change metrics
	documents_added_since_last: int = Field(ge=0, description="Documents added since last evolution point")
	change_magnitude: float = Field(ge=0.0, le=1.0, description="Magnitude of change from previous point")
	change_areas: List[str] = Field(description="Areas where changes occurred")
	
	# Evolution context
	trigger_event: Optional[str] = Field(None, description="Event that triggered this evolution point")
	notes: Optional[str] = Field(None, description="Notes about changes at this point")


class VoiceProfile(BaseModel):
	"""Comprehensive voice profile with multi-dimensional modeling"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	profile_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique profile identifier")
	organization_name: str = Field(description="Organization name")
	profile_name: str = Field(description="Profile name (e.g., 'Master Voice', 'Technical Docs')")
	profile_type: ProfileType = Field(description="Type of voice profile")
	profile_status: ProfileStatus = Field(default=ProfileStatus.ACTIVE, description="Profile status")
	
	# Core voice components
	voice_fingerprint: VoiceFingerprint = Field(description="Primary voice fingerprint")
	style_profile: Optional[StyleProfile] = Field(None, description="Detailed style profile")
	
	# Profile metadata
	documents_analyzed: List[DocumentMetadata] = Field(description="Documents used to create profile")
	total_documents: int = Field(ge=0, description="Total number of documents in profile")
	total_words: int = Field(ge=0, description="Total words analyzed")
	
	# Profile quality metrics
	internal_consistency: float = Field(ge=0.0, le=1.0, description="Internal consistency of voice across documents")
	profile_completeness: float = Field(ge=0.0, le=1.0, description="Completeness of voice analysis")
	confidence_level: float = Field(ge=0.0, le=1.0, description="Overall confidence in profile")
	
	# Segmentation data
	document_type_variations: Dict[str, Dict[str, float]] = Field(description="Voice variations by document type")
	audience_variations: Dict[str, Dict[str, float]] = Field(description="Voice variations by audience")
	author_variations: Dict[str, Dict[str, float]] = Field(description="Voice variations by author")
	
	# Evolution tracking
	evolution_history: List[VoiceEvolutionPoint] = Field(description="Voice evolution over time")
	last_updated: datetime = Field(default_factory=datetime.now)
	
	# Comparison data
	similar_profiles: List[str] = Field(description="IDs of similar voice profiles")
	distinctive_features: List[str] = Field(description="Most distinctive features of this voice")
	
	# Profile management
	created_date: datetime = Field(default_factory=datetime.now)
	created_by: Optional[str] = Field(None, description="Profile creator")
	version: str = Field(default="1.0.0", description="Profile version")
	parent_profile_id: Optional[str] = Field(None, description="Parent profile if this is a derived profile")


class VoiceProfiler:
	"""
	Comprehensive voice profiler for organizational voice analysis
	
	Creates multi-dimensional voice profiles from document corpora with
	evolution tracking, comparison capabilities, voice segmentation by
	document type and audience, and comprehensive profile management.
	"""
	
	def __init__(self):
		# Initialize analyzers
		self.voice_analyzer = VoicePatternAnalyzer()
		self.style_extractor = StylePatternExtractor()
		
		# Profile storage
		self.voice_profiles: Dict[str, VoiceProfile] = {}
		self.profile_index: Dict[str, List[str]] = defaultdict(list)  # Index by organization
		
		# Similarity computation
		self.similarity_cache: Dict[Tuple[str, str], float] = {}
		
		# Configuration
		self.min_corpus_size = 3  # Minimum documents for reliable profile
		self.evolution_threshold = 0.1  # Minimum change to trigger evolution point
		self.max_evolution_points = 50  # Maximum evolution points to store
		
		# Performance tracking
		self.profiles_created = 0
		self.total_documents_processed = 0
		self.average_processing_time = 0.0
		
		self._log_initialization()
	
	async def create_voice_profile(self, organization_name: str,
	                               documents: List[str],
	                               document_metadata: Optional[List[DocumentMetadata]] = None,
	                               profile_name: Optional[str] = None,
	                               profile_type: ProfileType = ProfileType.MASTER_PROFILE,
	                               segmentation_criteria: Optional[Dict[str, Any]] = None,
	                               parent_profile_id: Optional[str] = None) -> VoiceProfile:
		"""
		Create comprehensive voice profile from document corpus
		
		Args:
			organization_name: Organization name
			documents: List of document texts
			document_metadata: Optional metadata for each document
			profile_name: Name for the profile
			profile_type: Type of profile to create
			segmentation_criteria: Criteria for voice segmentation
			parent_profile_id: Parent profile if this is derived
			
		Returns:
			Comprehensive voice profile
		"""
		start_time = datetime.now()
		
		try:
			self._log_profile_creation_start(organization_name, len(documents), profile_type)
			
			# Validate input
			if len(documents) < self.min_corpus_size:
				raise ValueError(f"Insufficient documents: {len(documents)} (minimum: {self.min_corpus_size})")
			
			# Create document metadata if not provided
			if not document_metadata:
				document_metadata = await self._create_document_metadata(documents)
			
			# Ensure metadata matches documents
			if len(document_metadata) != len(documents):
				raise ValueError("Document metadata count must match document count")
			
			# Generate voice fingerprint
			voice_fingerprint = await self.voice_analyzer.analyze_voice_patterns(
				documents, organization_name
			)
			
			# Generate style profile
			style_profile = await self.style_extractor.extract_style_patterns(
				documents, organization_name
			)
			
			# Perform voice segmentation analysis
			segmentation_results = await self._analyze_voice_segmentation(
				documents, document_metadata, segmentation_criteria
			)
			
			# Calculate profile quality metrics
			internal_consistency = await self._calculate_internal_consistency(documents, voice_fingerprint)
			profile_completeness = self._calculate_profile_completeness(voice_fingerprint, style_profile)
			confidence_level = self._calculate_profile_confidence(
				voice_fingerprint, style_profile, len(documents), sum(len(doc.split()) for doc in documents)
			)
			
			# Identify distinctive features
			distinctive_features = await self._identify_distinctive_features(voice_fingerprint, style_profile)
			
			# Create initial evolution point
			initial_evolution = VoiceEvolutionPoint(
				voice_fingerprint=voice_fingerprint,
				style_profile=style_profile,
				documents_added_since_last=len(documents),
				change_magnitude=0.0,  # Initial point
				change_areas=[],
				trigger_event="Initial profile creation"
			)
			
			# Create voice profile
			profile_name = profile_name or f"{organization_name} {profile_type.value.replace('_', ' ').title()}"
			
			voice_profile = VoiceProfile(
				organization_name=organization_name,
				profile_name=profile_name,
				profile_type=profile_type,
				voice_fingerprint=voice_fingerprint,
				style_profile=style_profile,
				documents_analyzed=document_metadata,
				total_documents=len(documents),
				total_words=sum(len(doc.split()) for doc in documents),
				internal_consistency=internal_consistency,
				profile_completeness=profile_completeness,
				confidence_level=confidence_level,
				document_type_variations=segmentation_results.get('document_type', {}),
				audience_variations=segmentation_results.get('audience', {}),
				author_variations=segmentation_results.get('author', {}),
				evolution_history=[initial_evolution],
				distinctive_features=distinctive_features,
				similar_profiles=[],  # Will be calculated later
				parent_profile_id=parent_profile_id
			)
			
			# Store profile and update index
			self.voice_profiles[voice_profile.profile_id] = voice_profile
			self.profile_index[organization_name].append(voice_profile.profile_id)
			
			# Update performance tracking
			self.profiles_created += 1
			self.total_documents_processed += len(documents)
			processing_time = (datetime.now() - start_time).total_seconds()
			self._update_average_processing_time(processing_time)
			
			self._log_profile_creation_complete(
				organization_name, profile_name, confidence_level, processing_time
			)
			
			return voice_profile
			
		except Exception as e:
			self._log_profile_creation_error(f"Profile creation failed for {organization_name}: {str(e)}")
			raise
	
	async def update_voice_profile(self, profile_id: str, 
	                               new_documents: List[str],
	                               new_document_metadata: Optional[List[DocumentMetadata]] = None,
	                               evolution_notes: Optional[str] = None) -> VoiceProfile:
		"""
		Update existing voice profile with new documents
		
		Args:
			profile_id: Profile to update
			new_documents: New documents to add
			new_document_metadata: Metadata for new documents
			evolution_notes: Notes about this evolution
			
		Returns:
			Updated voice profile
		"""
		if profile_id not in self.voice_profiles:
			raise ValueError(f"Profile {profile_id} not found")
		
		profile = self.voice_profiles[profile_id]
		
		# Get existing documents
		existing_documents = [doc.content for doc in profile.documents_analyzed if hasattr(doc, 'content')]
		all_documents = existing_documents + new_documents
		
		# Create metadata for new documents
		if not new_document_metadata:
			new_document_metadata = await self._create_document_metadata(new_documents)
		
		# Re-analyze voice with all documents
		updated_fingerprint = await self.voice_analyzer.analyze_voice_patterns(
			all_documents, profile.organization_name
		)
		
		updated_style_profile = await self.style_extractor.extract_style_patterns(
			all_documents, profile.organization_name
		)
		
		# Calculate change magnitude
		change_magnitude = await self._calculate_change_magnitude(
			profile.voice_fingerprint, updated_fingerprint
		)
		
		# Create evolution point if significant change
		if change_magnitude >= self.evolution_threshold:
			change_areas = await self._identify_change_areas(
				profile.voice_fingerprint, updated_fingerprint,
				profile.style_profile, updated_style_profile
			)
			
			evolution_point = VoiceEvolutionPoint(
				voice_fingerprint=updated_fingerprint,
				style_profile=updated_style_profile,
				documents_added_since_last=len(new_documents),
				change_magnitude=change_magnitude,
				change_areas=change_areas,
				trigger_event="Profile update with new documents",
				notes=evolution_notes
			)
			
			# Add to evolution history
			profile.evolution_history.append(evolution_point)
			
			# Limit evolution history size
			if len(profile.evolution_history) > self.max_evolution_points:
				profile.evolution_history = profile.evolution_history[-self.max_evolution_points:]
		
		# Update profile
		profile.voice_fingerprint = updated_fingerprint
		profile.style_profile = updated_style_profile
		profile.documents_analyzed.extend(new_document_metadata)
		profile.total_documents += len(new_documents)
		profile.total_words += sum(len(doc.split()) for doc in new_documents)
		profile.last_updated = datetime.now()
		
		# Recalculate quality metrics
		profile.internal_consistency = await self._calculate_internal_consistency(all_documents, updated_fingerprint)
		profile.profile_completeness = self._calculate_profile_completeness(updated_fingerprint, updated_style_profile)
		profile.confidence_level = self._calculate_profile_confidence(
			updated_fingerprint, updated_style_profile, len(all_documents), profile.total_words
		)
		
		return profile
	
	async def compare_voice_profiles(self, profile_id1: str, profile_id2: str) -> Dict[str, Any]:
		"""
		Compare two voice profiles for similarity and differences
		
		Args:
			profile_id1: First profile ID
			profile_id2: Second profile ID
			
		Returns:
			Comprehensive comparison results
		"""
		if profile_id1 not in self.voice_profiles or profile_id2 not in self.voice_profiles:
			raise ValueError("One or both profiles not found")
		
		profile1 = self.voice_profiles[profile_id1]
		profile2 = self.voice_profiles[profile_id2]
		
		# Calculate similarity metrics
		vocabulary_similarity = await self._calculate_vocabulary_similarity(
			profile1.voice_fingerprint, profile2.voice_fingerprint
		)
		
		tone_similarity = await self._calculate_tone_similarity(
			profile1.voice_fingerprint, profile2.voice_fingerprint
		)
		
		formality_similarity = 1.0 - abs(
			profile1.voice_fingerprint.formality_level - profile2.voice_fingerprint.formality_level
		)
		
		complexity_similarity = 1.0 - abs(
			profile1.voice_fingerprint.complexity_score - profile2.voice_fingerprint.complexity_score
		)
		
		# Overall similarity
		overall_similarity = statistics.mean([
			vocabulary_similarity, tone_similarity, formality_similarity, complexity_similarity
		])
		
		# Identify key differences
		key_differences = await self._identify_key_differences(profile1, profile2)
		
		# Identify similarities
		key_similarities = await self._identify_key_similarities(profile1, profile2)
		
		comparison_result = {
			"profile1_id": profile_id1,
			"profile2_id": profile_id2,
			"profile1_name": profile1.profile_name,
			"profile2_name": profile2.profile_name,
			"overall_similarity": overall_similarity,
			"similarity_metrics": {
				"vocabulary_similarity": vocabulary_similarity,
				"tone_similarity": tone_similarity,
				"formality_similarity": formality_similarity,
				"complexity_similarity": complexity_similarity
			},
			"key_similarities": key_similarities,
			"key_differences": key_differences,
			"comparison_timestamp": datetime.now(),
			"comparison_confidence": min(profile1.confidence_level, profile2.confidence_level)
		}
		
		return comparison_result
	
	async def segment_voice_by_criteria(self, profile_id: str, 
	                                    criteria: Dict[str, Any]) -> Dict[str, VoiceProfile]:
		"""
		Segment voice profile by specified criteria
		
		Args:
			profile_id: Base profile to segment
			criteria: Segmentation criteria (document_type, audience, author, etc.)
			
		Returns:
			Dictionary of segmented voice profiles
		"""
		if profile_id not in self.voice_profiles:
			raise ValueError(f"Profile {profile_id} not found")
		
		base_profile = self.voice_profiles[profile_id]
		segmented_profiles = {}
		
		# Group documents by criteria
		document_groups = self._group_documents_by_criteria(base_profile.documents_analyzed, criteria)
		
		# Create profile for each group
		for group_name, documents_metadata in document_groups.items():
			if len(documents_metadata) >= self.min_corpus_size:
				# Extract document texts (would need to be stored or retrieved)
				# For now, create placeholder profile
				segment_profile = await self._create_segment_profile(
					base_profile, group_name, documents_metadata
				)
				segmented_profiles[group_name] = segment_profile
		
		return segmented_profiles
	
	async def track_voice_evolution(self, profile_id: str, 
	                                time_range: Optional[Tuple[datetime, datetime]] = None) -> Dict[str, Any]:
		"""
		Track voice evolution over time for a profile
		
		Args:
			profile_id: Profile to analyze
			time_range: Optional time range to analyze
			
		Returns:
			Evolution analysis results
		"""
		if profile_id not in self.voice_profiles:
			raise ValueError(f"Profile {profile_id} not found")
		
		profile = self.voice_profiles[profile_id]
		evolution_points = profile.evolution_history
		
		# Filter by time range if provided
		if time_range:
			start_time, end_time = time_range
			evolution_points = [
				point for point in evolution_points
				if start_time <= point.timestamp <= end_time
			]
		
		if len(evolution_points) < 2:
			return {
				"profile_id": profile_id,
				"evolution_analysis": "Insufficient evolution points for analysis",
				"evolution_points": len(evolution_points)
			}
		
		# Analyze evolution trends
		evolution_analysis = {
			"profile_id": profile_id,
			"profile_name": profile.profile_name,
			"evolution_points": len(evolution_points),
			"time_span_days": (evolution_points[-1].timestamp - evolution_points[0].timestamp).days,
			"total_change_magnitude": sum(point.change_magnitude for point in evolution_points[1:]),
			"average_change_per_update": statistics.mean([point.change_magnitude for point in evolution_points[1:]]),
			"most_common_change_areas": self._get_most_common_change_areas(evolution_points),
			"stability_score": self._calculate_stability_score(evolution_points),
			"evolution_trajectory": self._analyze_evolution_trajectory(evolution_points),
			"recent_changes": self._analyze_recent_changes(evolution_points[-5:] if len(evolution_points) >= 5 else evolution_points)
		}
		
		return evolution_analysis
	
	# Helper methods for profile analysis
	
	async def _create_document_metadata(self, documents: List[str]) -> List[DocumentMetadata]:
		"""Create basic document metadata"""
		metadata_list = []
		
		for i, document in enumerate(documents):
			content_hash = hashlib.md5(document.encode()).hexdigest()
			
			metadata = DocumentMetadata(
				document_type="unknown",
				word_count=len(document.split()),
				content_hash=content_hash
			)
			metadata_list.append(metadata)
		
		return metadata_list
	
	async def _analyze_voice_segmentation(self, documents: List[str], 
	                                      document_metadata: List[DocumentMetadata],
	                                      segmentation_criteria: Optional[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
		"""Analyze voice variations across different document segments"""
		
		segmentation_results = {
			'document_type': {},
			'audience': {},
			'author': {}
		}
		
		# Group documents by metadata attributes
		if segmentation_criteria:
			# Analyze variations by document type
			type_groups = defaultdict(list)
			for doc, metadata in zip(documents, document_metadata):
				doc_type = metadata.document_type or "unknown"
				type_groups[doc_type].append(doc)
			
			# Calculate voice variations for each document type
			for doc_type, type_docs in type_groups.items():
				if len(type_docs) >= 2:  # Need at least 2 docs for variation analysis
					# Calculate basic voice characteristics
					avg_formality = self._calculate_average_formality(type_docs)
					avg_complexity = self._calculate_average_complexity(type_docs)
					
					segmentation_results['document_type'][doc_type] = {
						'formality': avg_formality,
						'complexity': avg_complexity,
						'document_count': len(type_docs)
					}
		
		return segmentation_results
	
	def _calculate_average_formality(self, documents: List[str]) -> float:
		"""Calculate average formality across documents"""
		formality_scores = []
		
		for doc in documents:
			# Simple formality calculation
			formal_words = ['furthermore', 'moreover', 'consequently']
			informal_words = ['yeah', 'okay', 'really']
			
			words = doc.lower().split()
			formal_count = sum(1 for word in words if word in formal_words)
			informal_count = sum(1 for word in words if word in informal_words)
			
			if formal_count + informal_count > 0:
				formality = formal_count / (formal_count + informal_count)
			else:
				formality = 0.5
			
			formality_scores.append(formality)
		
		return statistics.mean(formality_scores) if formality_scores else 0.5
	
	def _calculate_average_complexity(self, documents: List[str]) -> float:
		"""Calculate average complexity across documents"""
		complexity_scores = []
		
		for doc in documents:
			sentences = doc.split('.')
			words = doc.split()
			
			if sentences and words:
				avg_sentence_length = len(words) / len(sentences)
				complexity = min(avg_sentence_length / 20.0, 1.0)
			else:
				complexity = 0.5
			
			complexity_scores.append(complexity)
		
		return statistics.mean(complexity_scores) if complexity_scores else 0.5
	
	async def _calculate_internal_consistency(self, documents: List[str], voice_fingerprint: VoiceFingerprint) -> float:
		"""Calculate internal consistency of voice across documents"""
		
		if len(documents) < 2:
			return 1.0
		
		# Calculate voice characteristics for each document
		doc_formalities = []
		doc_complexities = []
		
		for doc in documents:
			doc_formalities.append(self._calculate_average_formality([doc]))
			doc_complexities.append(self._calculate_average_complexity([doc]))
		
		# Calculate consistency as inverse of coefficient of variation
		consistency_scores = []
		
		if doc_formalities and statistics.mean(doc_formalities) > 0:
			formality_cv = statistics.stdev(doc_formalities) / statistics.mean(doc_formalities)
			consistency_scores.append(max(0.0, 1.0 - formality_cv))
		
		if doc_complexities and statistics.mean(doc_complexities) > 0:
			complexity_cv = statistics.stdev(doc_complexities) / statistics.mean(doc_complexities)
			consistency_scores.append(max(0.0, 1.0 - complexity_cv))
		
		return statistics.mean(consistency_scores) if consistency_scores else 0.5
	
	def _calculate_profile_completeness(self, voice_fingerprint: VoiceFingerprint, 
	                                   style_profile: Optional[StyleProfile]) -> float:
		"""Calculate completeness of voice profile"""
		
		completeness_factors = []
		
		# Voice fingerprint completeness
		vf_completeness = 0.0
		if voice_fingerprint.vocabulary_signature:
			vf_completeness += 0.2
		if voice_fingerprint.sentence_patterns:
			vf_completeness += 0.2
		if voice_fingerprint.tone_profile:
			vf_completeness += 0.2
		if voice_fingerprint.patterns:
			vf_completeness += 0.2
		if voice_fingerprint.confidence_level > 0.5:
			vf_completeness += 0.2
		
		completeness_factors.append(vf_completeness)
		
		# Style profile completeness
		if style_profile:
			sp_completeness = 0.0
			if style_profile.style_patterns:
				sp_completeness += 0.3
			if style_profile.persuasion_scores:
				sp_completeness += 0.2
			if style_profile.emotional_range:
				sp_completeness += 0.2
			if style_profile.analysis_confidence > 0.5:
				sp_completeness += 0.3
			
			completeness_factors.append(sp_completeness)
		
		return statistics.mean(completeness_factors)
	
	def _calculate_profile_confidence(self, voice_fingerprint: VoiceFingerprint,
	                                 style_profile: Optional[StyleProfile],
	                                 document_count: int, total_words: int) -> float:
		"""Calculate overall confidence in profile"""
		
		confidence_factors = []
		
		# Base confidence from components
		confidence_factors.append(voice_fingerprint.confidence_level)
		if style_profile:
			confidence_factors.append(style_profile.analysis_confidence)
		
		# Document count factor
		doc_count_factor = min(document_count / 10, 1.0)  # 10+ docs ideal
		confidence_factors.append(doc_count_factor)
		
		# Word count factor
		word_count_factor = min(total_words / 10000, 1.0)  # 10k+ words ideal
		confidence_factors.append(word_count_factor)
		
		return statistics.mean(confidence_factors)
	
	async def _identify_distinctive_features(self, voice_fingerprint: VoiceFingerprint,
	                                        style_profile: Optional[StyleProfile]) -> List[str]:
		"""Identify most distinctive features of the voice"""
		
		distinctive_features = []
		
		# High distinctiveness features from voice fingerprint
		if voice_fingerprint.distinctiveness_score > 0.7:
			distinctive_features.append(f"Highly distinctive voice (score: {voice_fingerprint.distinctiveness_score:.2f})")
		
		# Formality level
		if voice_fingerprint.formality_level > 0.8:
			distinctive_features.append("Very formal communication style")
		elif voice_fingerprint.formality_level < 0.3:
			distinctive_features.append("Casual, informal communication style")
		
		# Complexity
		if voice_fingerprint.complexity_score > 0.8:
			distinctive_features.append("High language complexity and sophistication")
		elif voice_fingerprint.complexity_score < 0.3:
			distinctive_features.append("Simple, accessible language")
		
		# Technical density
		if voice_fingerprint.technical_density > 0.15:
			distinctive_features.append("High technical language density")
		
		# Tone characteristics
		for tone, score in voice_fingerprint.tone_profile.items():
			if score > 0.02:  # Significant tone presence
				distinctive_features.append(f"Strong {tone} tone")
		
		return distinctive_features[:5]  # Top 5 features
	
	async def _calculate_change_magnitude(self, old_fingerprint: VoiceFingerprint,
	                                     new_fingerprint: VoiceFingerprint) -> float:
		"""Calculate magnitude of change between voice fingerprints"""
		
		changes = []
		
		# Formality change
		formality_change = abs(old_fingerprint.formality_level - new_fingerprint.formality_level)
		changes.append(formality_change)
		
		# Complexity change
		complexity_change = abs(old_fingerprint.complexity_score - new_fingerprint.complexity_score)
		changes.append(complexity_change)
		
		# Technical density change
		technical_change = abs(old_fingerprint.technical_density - new_fingerprint.technical_density)
		changes.append(technical_change)
		
		# Vocabulary overlap (inverted - less overlap = more change)
		old_vocab = set(old_fingerprint.vocabulary_signature.keys())
		new_vocab = set(new_fingerprint.vocabulary_signature.keys())
		
		if old_vocab and new_vocab:
			overlap = len(old_vocab.intersection(new_vocab)) / len(old_vocab.union(new_vocab))
			vocab_change = 1.0 - overlap
			changes.append(vocab_change)
		
		return statistics.mean(changes) if changes else 0.0
	
	async def _identify_change_areas(self, old_fingerprint: VoiceFingerprint, new_fingerprint: VoiceFingerprint,
	                                old_style: Optional[StyleProfile], new_style: Optional[StyleProfile]) -> List[str]:
		"""Identify specific areas where voice has changed"""
		
		change_areas = []
		
		# Check formality changes
		formality_change = abs(old_fingerprint.formality_level - new_fingerprint.formality_level)
		if formality_change > 0.1:
			direction = "increased" if new_fingerprint.formality_level > old_fingerprint.formality_level else "decreased"
			change_areas.append(f"Formality {direction} by {formality_change:.2f}")
		
		# Check complexity changes
		complexity_change = abs(old_fingerprint.complexity_score - new_fingerprint.complexity_score)
		if complexity_change > 0.1:
			direction = "increased" if new_fingerprint.complexity_score > old_fingerprint.complexity_score else "decreased"
			change_areas.append(f"Language complexity {direction} by {complexity_change:.2f}")
		
		# Check technical density changes
		technical_change = abs(old_fingerprint.technical_density - new_fingerprint.technical_density)
		if technical_change > 0.05:
			direction = "increased" if new_fingerprint.technical_density > old_fingerprint.technical_density else "decreased"
			change_areas.append(f"Technical language density {direction} by {technical_change:.2f}")
		
		return change_areas
	
	async def _calculate_vocabulary_similarity(self, fp1: VoiceFingerprint, fp2: VoiceFingerprint) -> float:
		"""Calculate vocabulary similarity between two fingerprints"""
		
		vocab1 = set(fp1.vocabulary_signature.keys())
		vocab2 = set(fp2.vocabulary_signature.keys())
		
		if not vocab1 and not vocab2:
			return 1.0
		elif not vocab1 or not vocab2:
			return 0.0
		
		intersection = len(vocab1.intersection(vocab2))
		union = len(vocab1.union(vocab2))
		
		return intersection / union if union > 0 else 0.0
	
	async def _calculate_tone_similarity(self, fp1: VoiceFingerprint, fp2: VoiceFingerprint) -> float:
		"""Calculate tone similarity between two fingerprints"""
		
		tone1 = fp1.tone_profile
		tone2 = fp2.tone_profile
		
		if not tone1 and not tone2:
			return 1.0
		
		# Calculate cosine similarity of tone vectors
		all_tones = set(tone1.keys()).union(set(tone2.keys()))
		
		if not all_tones:
			return 1.0
		
		vector1 = [tone1.get(tone, 0.0) for tone in all_tones]
		vector2 = [tone2.get(tone, 0.0) for tone in all_tones]
		
		# Simple cosine similarity calculation
		dot_product = sum(a * b for a, b in zip(vector1, vector2))
		magnitude1 = sum(a * a for a in vector1) ** 0.5
		magnitude2 = sum(b * b for b in vector2) ** 0.5
		
		if magnitude1 == 0 or magnitude2 == 0:
			return 0.0
		
		return dot_product / (magnitude1 * magnitude2)
	
	async def _identify_key_differences(self, profile1: VoiceProfile, profile2: VoiceProfile) -> List[str]:
		"""Identify key differences between profiles"""
		
		differences = []
		
		fp1, fp2 = profile1.voice_fingerprint, profile2.voice_fingerprint
		
		# Formality differences
		formality_diff = abs(fp1.formality_level - fp2.formality_level)
		if formality_diff > 0.2:
			more_formal = profile1.profile_name if fp1.formality_level > fp2.formality_level else profile2.profile_name
			differences.append(f"{more_formal} is significantly more formal")
		
		# Complexity differences
		complexity_diff = abs(fp1.complexity_score - fp2.complexity_score)
		if complexity_diff > 0.2:
			more_complex = profile1.profile_name if fp1.complexity_score > fp2.complexity_score else profile2.profile_name
			differences.append(f"{more_complex} uses more complex language")
		
		# Technical density differences
		technical_diff = abs(fp1.technical_density - fp2.technical_density)
		if technical_diff > 0.1:
			more_technical = profile1.profile_name if fp1.technical_density > fp2.technical_density else profile2.profile_name
			differences.append(f"{more_technical} uses more technical language")
		
		return differences[:5]
	
	async def _identify_key_similarities(self, profile1: VoiceProfile, profile2: VoiceProfile) -> List[str]:
		"""Identify key similarities between profiles"""
		
		similarities = []
		
		fp1, fp2 = profile1.voice_fingerprint, profile2.voice_fingerprint
		
		# Formality similarities
		if abs(fp1.formality_level - fp2.formality_level) < 0.1:
			similarities.append("Similar formality levels")
		
		# Complexity similarities
		if abs(fp1.complexity_score - fp2.complexity_score) < 0.1:
			similarities.append("Similar language complexity")
		
		# Technical density similarities
		if abs(fp1.technical_density - fp2.technical_density) < 0.05:
			similarities.append("Similar technical language usage")
		
		# Vocabulary overlap
		vocab_similarity = await self._calculate_vocabulary_similarity(fp1, fp2)
		if vocab_similarity > 0.5:
			similarities.append(f"High vocabulary overlap ({vocab_similarity:.1%})")
		
		return similarities[:5]
	
	def _group_documents_by_criteria(self, documents_metadata: List[DocumentMetadata],
	                                criteria: Dict[str, Any]) -> Dict[str, List[DocumentMetadata]]:
		"""Group documents by specified criteria"""
		
		groups = defaultdict(list)
		
		for doc_metadata in documents_metadata:
			# Group by specified criteria
			for criterion, value in criteria.items():
				if hasattr(doc_metadata, criterion):
					doc_value = getattr(doc_metadata, criterion)
					if doc_value == value or (value is None and doc_value is None):
						group_key = f"{criterion}_{value}"
						groups[group_key].append(doc_metadata)
		
		return dict(groups)
	
	async def _create_segment_profile(self, base_profile: VoiceProfile, 
	                                 segment_name: str,
	                                 segment_documents: List[DocumentMetadata]) -> VoiceProfile:
		"""Create voice profile for document segment"""
		
		# For now, create a simplified segment profile
		# In production, would re-analyze the actual document texts
		segment_profile = VoiceProfile(
			organization_name=base_profile.organization_name,
			profile_name=f"{base_profile.profile_name} - {segment_name}",
			profile_type=ProfileType.DOCUMENT_TYPE_PROFILE,
			voice_fingerprint=base_profile.voice_fingerprint,  # Simplified - would recalculate
			style_profile=base_profile.style_profile,
			documents_analyzed=segment_documents,
			total_documents=len(segment_documents),
			total_words=sum(doc.word_count for doc in segment_documents),
			internal_consistency=0.8,  # Placeholder
			profile_completeness=0.7,  # Placeholder
			confidence_level=0.6,  # Lower confidence for segments
			document_type_variations={},
			audience_variations={},
			author_variations={},
			evolution_history=[],
			distinctive_features=[f"Segment of {base_profile.profile_name}"],
			similar_profiles=[],
			parent_profile_id=base_profile.profile_id
		)
		
		return segment_profile
	
	def _get_most_common_change_areas(self, evolution_points: List[VoiceEvolutionPoint]) -> List[str]:
		"""Get most common areas of change from evolution points"""
		
		all_change_areas = []
		for point in evolution_points:
			all_change_areas.extend(point.change_areas)
		
		if not all_change_areas:
			return []
		
		change_counter = Counter(all_change_areas)
		return [area for area, count in change_counter.most_common(5)]
	
	def _calculate_stability_score(self, evolution_points: List[VoiceEvolutionPoint]) -> float:
		"""Calculate voice stability score from evolution points"""
		
		if len(evolution_points) < 2:
			return 1.0
		
		change_magnitudes = [point.change_magnitude for point in evolution_points[1:]]
		avg_change = statistics.mean(change_magnitudes)
		
		# Stability is inverse of average change
		return max(0.0, 1.0 - avg_change * 2)  # Scale factor of 2
	
	def _analyze_evolution_trajectory(self, evolution_points: List[VoiceEvolutionPoint]) -> str:
		"""Analyze the trajectory of voice evolution"""
		
		if len(evolution_points) < 3:
			return "Insufficient data for trajectory analysis"
		
		recent_changes = [point.change_magnitude for point in evolution_points[-3:]]
		
		if all(c < 0.05 for c in recent_changes):
			return "Stable - minimal changes"
		elif recent_changes[-1] > recent_changes[-2]:
			return "Accelerating - increasing rate of change"
		elif recent_changes[-1] < recent_changes[-2]:
			return "Decelerating - decreasing rate of change"
		else:
			return "Variable - inconsistent change pattern"
	
	def _analyze_recent_changes(self, recent_points: List[VoiceEvolutionPoint]) -> Dict[str, Any]:
		"""Analyze recent changes in voice evolution"""
		
		if not recent_points:
			return {"status": "No recent changes"}
		
		total_recent_change = sum(point.change_magnitude for point in recent_points)
		avg_recent_change = total_recent_change / len(recent_points)
		
		return {
			"recent_evolution_points": len(recent_points),
			"total_recent_change": total_recent_change,
			"average_recent_change": avg_recent_change,
			"most_recent_change_areas": recent_points[-1].change_areas if recent_points else []
		}
	
	def _update_average_processing_time(self, processing_time: float):
		"""Update average processing time statistics"""
		if self.profiles_created == 1:
			self.average_processing_time = processing_time
		else:
			self.average_processing_time = (
				(self.average_processing_time * (self.profiles_created - 1) + processing_time) / self.profiles_created
			)
	
	# Profile management methods
	
	def get_profile(self, profile_id: str) -> Optional[VoiceProfile]:
		"""Get voice profile by ID"""
		return self.voice_profiles.get(profile_id)
	
	def list_profiles(self, organization_name: Optional[str] = None) -> List[str]:
		"""List voice profiles, optionally filtered by organization"""
		if organization_name:
			return self.profile_index.get(organization_name, [])
		else:
			return list(self.voice_profiles.keys())
	
	def get_profiler_statistics(self) -> Dict[str, Any]:
		"""Get profiler performance and usage statistics"""
		
		stats = {
			"profiles_created": self.profiles_created,
			"total_documents_processed": self.total_documents_processed,
			"average_processing_time_seconds": self.average_processing_time,
			"organizations_profiled": len(self.profile_index),
			"total_stored_profiles": len(self.voice_profiles),
			"sklearn_available": SKLEARN_AVAILABLE
		}
		
		if self.voice_profiles:
			profiles = list(self.voice_profiles.values())
			stats.update({
				"average_profile_confidence": statistics.mean([p.confidence_level for p in profiles]),
				"average_documents_per_profile": statistics.mean([p.total_documents for p in profiles]),
				"average_words_per_profile": statistics.mean([p.total_words for p in profiles]),
				"profile_types": Counter([p.profile_type.value for p in profiles])
			})
		
		return stats
	
	# Logging methods
	
	def _log_initialization(self):
		logger.info(f"VoiceProfiler: Initialized with {len(ProfileType)} profile types")
	
	def _log_profile_creation_start(self, organization: str, doc_count: int, profile_type: ProfileType):
		logger.info(f"VoiceProfiler: Creating {profile_type.value} for {organization} ({doc_count} documents)")
	
	def _log_profile_creation_complete(self, organization: str, profile_name: str, confidence: float, duration: float):
		logger.info(f"VoiceProfiler: Created profile '{profile_name}' for {organization} (confidence: {confidence:.3f}, duration: {duration:.1f}s)")
	
	def _log_profile_creation_error(self, message: str):
		logger.error(f"VoiceProfiler Error: {message}")


# Example usage and testing
async def create_sample_voice_profiling():
	"""Create sample voice profiling for testing"""
	
	# Initialize profiler
	profiler = VoiceProfiler()
	
	# Sample documents for voice profiling
	sample_documents = [
		"""
		We are pleased to present our strategic approach to organizational transformation. 
		Our comprehensive methodology leverages proven frameworks and industry best practices 
		to deliver exceptional results. We appreciate the opportunity to demonstrate our 
		capabilities and look forward to establishing a successful partnership with your team.
		""",
		"""
		Our technical implementation follows rigorous standards and incorporates advanced 
		methodologies for optimal performance. The systematic approach ensures reliable 
		outcomes while maintaining flexibility for future enhancements. We recommend 
		proceeding with the proposed framework to achieve your strategic objectives.
		""",
		"""
		The comprehensive analysis demonstrates significant opportunities for improvement 
		across multiple operational dimensions. Our research indicates that implementing 
		our proven methodology will deliver measurable value and establish competitive 
		advantage. We are confident in our ability to exceed expectations and drive 
		sustainable growth for your organization.
		""",
		"""
		We respectfully submit our proposal for your consideration, highlighting our 
		unique qualifications and demonstrated expertise. Our collaborative approach 
		ensures seamless integration with your existing processes while delivering 
		innovative solutions that address your specific requirements and objectives.
		""",
		"""
		Our strategic recommendations are based on comprehensive market analysis and 
		extensive industry experience. The proposed solution leverages cutting-edge 
		technology and proven methodologies to optimize performance and achieve 
		sustainable results that align with your organizational goals.
		"""
	]
	
	# Create sample document metadata
	metadata = [
		DocumentMetadata(
			document_type="proposal",
			word_count=len(doc.split()),
			author="Senior Consultant",
			target_audience="C-level executives",
			content_hash=hashlib.md5(doc.encode()).hexdigest()
		) for doc in sample_documents
	]
	
	# Create master voice profile
	master_profile = await profiler.create_voice_profile(
		organization_name="Strategic Consulting Group",
		documents=sample_documents,
		document_metadata=metadata,
		profile_name="Master Voice Profile",
		profile_type=ProfileType.MASTER_PROFILE
	)
	
	# Compare with a slightly different profile (simulated)
	modified_documents = sample_documents + [
		"""
		Hey there! We're super excited to share our awesome approach with you. 
		It's really innovative and we think you'll love it. Let's chat about 
		how we can make amazing things happen together!
		"""
	]
	
	casual_profile = await profiler.create_voice_profile(
		organization_name="Strategic Consulting Group",
		documents=modified_documents,
		profile_name="Casual Communication Profile",
		profile_type=ProfileType.DOCUMENT_TYPE_PROFILE
	)
	
	# Compare profiles
	comparison = await profiler.compare_voice_profiles(
		master_profile.profile_id, casual_profile.profile_id
	)
	
	# Track evolution
	evolution_analysis = await profiler.track_voice_evolution(casual_profile.profile_id)
	
	return {
		"master_profile": master_profile,
		"casual_profile": casual_profile,
		"comparison": comparison,
		"evolution_analysis": evolution_analysis,
		"profiler_stats": profiler.get_profiler_statistics()
	}


if __name__ == "__main__":
	# Test the voice profiler
	import asyncio
	
	async def main():
		results = await create_sample_voice_profiling()
		
		logger.info(f"Voice Profiling Results:")
		print("=" * 60)
		
		# Master profile results
		master = results["master_profile"]
		logger.info(f"\nMaster Profile: {master.profile_name}")
		logger.info(f"  Confidence: {master.confidence_level:.3f}")
		logger.info(f"  Consistency: {master.internal_consistency:.3f}")
		logger.info(f"  Completeness: {master.profile_completeness:.3f}")
		logger.info(f"  Documents: {master.total_documents}")
		logger.info(f"  Words: {master.total_words:,}")
		
		logger.info(f"\n  Voice Characteristics:")
		logger.info(f"    Formality: {master.voice_fingerprint.formality_level:.3f}")
		logger.info(f"    Complexity: {master.voice_fingerprint.complexity_score:.3f}")
		logger.info(f"    Technical Density: {master.voice_fingerprint.technical_density:.3f}")
		logger.info(f"    Distinctiveness: {master.voice_fingerprint.distinctiveness_score:.3f}")
		
		logger.info(f"\n  Distinctive Features:")
		for feature in master.distinctive_features:
			logger.info(f"    • {feature}")
		
		# Casual profile results
		casual = results["casual_profile"]
		logger.info(f"\nCasual Profile: {casual.profile_name}")
		logger.info(f"  Confidence: {casual.confidence_level:.3f}")
		logger.info(f"  Evolution Points: {len(casual.evolution_history)}")
		
		# Comparison results
		comparison = results["comparison"]
		logger.info(f"\nProfile Comparison:")
		logger.info(f"  Overall Similarity: {comparison['overall_similarity']:.3f}")
		logger.info(f"  Vocabulary Similarity: {comparison['similarity_metrics']['vocabulary_similarity']:.3f}")
		logger.info(f"  Tone Similarity: {comparison['similarity_metrics']['tone_similarity']:.3f}")
		logger.info(f"  Formality Similarity: {comparison['similarity_metrics']['formality_similarity']:.3f}")
		
		logger.info(f"\n  Key Similarities:")
		for similarity in comparison['key_similarities']:
			logger.info(f"    • {similarity}")
		
		logger.info(f"\n  Key Differences:")
		for difference in comparison['key_differences']:
			logger.info(f"    • {difference}")
		
		# Evolution analysis
		evolution = results["evolution_analysis"]
		logger.info(f"\nEvolution Analysis:")
		logger.info(f"  Evolution Points: {evolution['evolution_points']}")
		logger.info(f"  Stability Score: {evolution.get('stability_score', 'N/A')}")
		logger.info(f"  Evolution Trajectory: {evolution.get('evolution_trajectory', 'N/A')}")
		
		# Profiler statistics
		stats = results["profiler_stats"]
		logger.info(f"\nProfiler Statistics:")
		for key, value in stats.items():
			if isinstance(value, dict):
				logger.info(f"  {key.replace('_', ' ').title()}:")
				for subkey, subvalue in value.items():
					logger.info(f"    {subkey}: {subvalue}")
			else:
				logger.info(f"  {key.replace('_', ' ').title()}: {value}")
	
	asyncio.run(main())