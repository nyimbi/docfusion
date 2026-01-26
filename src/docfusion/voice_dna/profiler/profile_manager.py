"""
Profile Manager

This module provides comprehensive voice profile management including versioning,
comparison, evolution tracking, and profile lifecycle management. Handles the
storage, retrieval, and analysis of organizational voice profiles over time.
"""

import asyncio
import json
import shutil
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from dataclasses import dataclass
from enum import Enum
import statistics

from pydantic import BaseModel, Field, ConfigDict
from uuid import uuid4

# Import voice analysis components
from ..analyzer.voice_pattern_analyzer import VoiceFingerprint, WritingPattern, VoiceComponent
from ..analyzer.style_pattern_extractor import StyleProfile, StylePattern, StyleDimension
from .voice_profiler import VoiceProfile, ProfileType, DocumentMetadata

# NLP imports with fallbacks
try:
	import numpy as np
	from sklearn.metrics.pairwise import cosine_similarity
	ML_AVAILABLE = True
except ImportError:
	ML_AVAILABLE = False


class ProfileStatus(str, Enum):
	"""Status of voice profiles"""
	
	ACTIVE = "active"
	ARCHIVED = "archived"
	DRAFT = "draft"
	DEPRECATED = "deprecated"
	PENDING_REVIEW = "pending_review"


class ComparisonType(str, Enum):
	"""Types of profile comparisons"""
	
	EVOLUTION = "evolution"
	SIMILARITY = "similarity"
	DEVIATION = "deviation"
	BENCHMARK = "benchmark"
	COMPETITIVE = "competitive"


class ProfileVersion(BaseModel):
	"""Version information for voice profiles"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	version_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique version identifier")
	version_number: str = Field(description="Semantic version number (e.g., '1.0.0')")
	profile_id: str = Field(description="Associated profile ID")
	
	# Version details
	created_timestamp: datetime = Field(default_factory=datetime.now)
	created_by: Optional[str] = Field(None, description="User/system that created this version")
	change_description: str = Field(description="Description of changes in this version")
	change_summary: Dict[str, Any] = Field(description="Summary of specific changes")
	
	# Version metadata
	is_major_change: bool = Field(description="Whether this represents a major change")
	confidence_delta: float = Field(description="Change in confidence from previous version")
	parent_version_id: Optional[str] = Field(None, description="Previous version ID")
	
	# Profile snapshot
	voice_fingerprint: VoiceFingerprint = Field(description="Voice fingerprint at this version")
	style_profile: Optional[StyleProfile] = Field(None, description="Style profile at this version")


class ProfileComparison(BaseModel):
	"""Comparison result between voice profiles"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	comparison_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique comparison identifier")
	comparison_type: ComparisonType = Field(description="Type of comparison performed")
	
	# Compared profiles
	source_profile_id: str = Field(description="Source profile ID")
	target_profile_id: str = Field(description="Target profile ID")
	source_version: Optional[str] = Field(None, description="Source profile version")
	target_version: Optional[str] = Field(None, description="Target profile version")
	
	# Comparison results
	overall_similarity: float = Field(ge=0.0, le=1.0, description="Overall similarity score")
	component_similarities: Dict[str, float] = Field(description="Similarity by voice component")
	significant_differences: List[str] = Field(description="List of significant differences")
	
	# Detailed analysis
	vocabulary_overlap: float = Field(ge=0.0, le=1.0, description="Vocabulary similarity")
	tone_similarity: float = Field(ge=0.0, le=1.0, description="Tone profile similarity")
	formality_difference: float = Field(ge=0.0, description="Formality level difference")
	complexity_difference: float = Field(ge=0.0, description="Complexity score difference")
	
	# Evolution metrics (for evolution comparisons)
	evolution_trajectory: Optional[Dict[str, float]] = Field(None, description="Evolution direction")
	change_velocity: Optional[float] = Field(None, description="Rate of change")
	stability_score: Optional[float] = Field(None, description="Voice stability over time")
	
	# Metadata
	comparison_timestamp: datetime = Field(default_factory=datetime.now)
	analysis_notes: List[str] = Field(default=[], description="Analysis notes and observations")


class ProfileManager:
	"""
	Comprehensive voice profile management system
	
	Provides versioning, comparison, evolution tracking, and lifecycle
	management for organizational voice profiles with advanced analytics
	and change management capabilities.
	"""
	
	def __init__(self, storage_path: Optional[str] = None):
		# Storage configuration
		self.storage_path = Path(storage_path) if storage_path else Path.cwd() / "voice_profiles"
		self.storage_path.mkdir(exist_ok=True)
		
		# Profile storage
		self.profiles: Dict[str, VoiceProfile] = {}
		self.versions: Dict[str, List[ProfileVersion]] = {}
		self.comparisons: Dict[str, ProfileComparison] = {}
		
		# Management configuration
		self.auto_version_threshold = 0.1  # Auto-create version if changes exceed threshold
		self.max_versions_per_profile = 50  # Maximum versions to keep
		self.comparison_cache_ttl = timedelta(hours=24)  # Cache comparison results
		
		# Analytics tracking
		self.usage_stats = defaultdict(int)
		self.performance_metrics = defaultdict(list)
		
		# Initialize storage
		self._initialize_storage()
		self._log_initialization()
	
	def _initialize_storage(self):
		"""Initialize persistent storage structure"""
		
		# Create storage directories
		(self.storage_path / "profiles").mkdir(exist_ok=True)
		(self.storage_path / "versions").mkdir(exist_ok=True)
		(self.storage_path / "comparisons").mkdir(exist_ok=True)
		(self.storage_path / "backups").mkdir(exist_ok=True)
		
		# Load existing profiles
		self._load_existing_profiles()
	
	def _load_existing_profiles(self):
		"""Load existing profiles from storage"""
		
		try:
			profiles_dir = self.storage_path / "profiles"
			for profile_file in profiles_dir.glob("*.json"):
				with open(profile_file, 'r') as f:
					profile_data = json.load(f)
					profile = VoiceProfile.model_validate(profile_data)
					self.profiles[profile.profile_id] = profile
			
			# Load versions
			versions_dir = self.storage_path / "versions"
			for version_file in versions_dir.glob("*.json"):
				with open(version_file, 'r') as f:
					version_data = json.load(f)
					version = ProfileVersion.model_validate(version_data)
					if version.profile_id not in self.versions:
						self.versions[version.profile_id] = []
					self.versions[version.profile_id].append(version)
			
			# Sort versions by timestamp
			for profile_id in self.versions:
				self.versions[profile_id].sort(key=lambda v: v.created_timestamp)
			
			self._log_profiles_loaded(len(self.profiles), sum(len(v) for v in self.versions.values()))
			
		except Exception as e:
			self._log_storage_error(f"Failed to load existing profiles: {str(e)}")
	
	async def create_profile_version(self, 
	                                 profile: VoiceProfile,
	                                 change_description: str,
	                                 created_by: Optional[str] = None,
	                                 force_version: bool = False) -> ProfileVersion:
		"""
		Create a new version of a voice profile
		
		Args:
			profile: Voice profile to version
			change_description: Description of changes
			created_by: User/system creating the version
			force_version: Force version creation regardless of changes
			
		Returns:
			Created profile version
		"""
		start_time = datetime.now()
		
		try:
			self._log_version_creation_start(profile.profile_id)
			
			# Get current version for comparison
			current_versions = self.versions.get(profile.profile_id, [])
			previous_version = current_versions[-1] if current_versions else None
			
			# Calculate changes
			change_summary = {}
			confidence_delta = 0.0
			is_major_change = force_version
			
			if previous_version:
				change_analysis = await self._analyze_profile_changes(
					previous_version.voice_fingerprint, 
					profile.voice_fingerprint,
					previous_version.style_profile,
					profile.style_profile
				)
				
				change_summary = change_analysis["changes"]
				confidence_delta = change_analysis["confidence_delta"]
				is_major_change = change_analysis["is_major"] or force_version
				
				# Check if auto-versioning threshold met
				if not force_version and change_analysis["total_change"] < self.auto_version_threshold:
					self._log_version_skipped(profile.profile_id, change_analysis["total_change"])
					return previous_version
			
			# Generate version number
			version_number = self._generate_version_number(
				current_versions, is_major_change
			)
			
			# Create version
			version = ProfileVersion(
				version_number=version_number,
				profile_id=profile.profile_id,
				change_description=change_description,
				change_summary=change_summary,
				created_by=created_by,
				is_major_change=is_major_change,
				confidence_delta=confidence_delta,
				parent_version_id=previous_version.version_id if previous_version else None,
				voice_fingerprint=profile.voice_fingerprint,
				style_profile=profile.style_profile
			)
			
			# Store version
			if profile.profile_id not in self.versions:
				self.versions[profile.profile_id] = []
			self.versions[profile.profile_id].append(version)
			
			# Persist to storage
			await self._persist_version(version)
			
			# Cleanup old versions if needed
			await self._cleanup_old_versions(profile.profile_id)
			
			# Update statistics
			self.usage_stats["versions_created"] += 1
			duration = (datetime.now() - start_time).total_seconds()
			self.performance_metrics["version_creation_time"].append(duration)
			
			self._log_version_created(
				profile.profile_id, version.version_number, is_major_change, duration
			)
			
			return version
			
		except Exception as e:
			self._log_version_error(f"Version creation failed for {profile.profile_id}: {str(e)}")
			raise
	
	async def _analyze_profile_changes(self,
	                                   old_fingerprint: VoiceFingerprint,
	                                   new_fingerprint: VoiceFingerprint,
	                                   old_style: Optional[StyleProfile],
	                                   new_style: Optional[StyleProfile]) -> Dict[str, Any]:
		"""Analyze changes between profile versions"""
		
		changes = {}
		total_change = 0.0
		
		# Vocabulary changes
		old_vocab = set(old_fingerprint.vocabulary_signature.keys())
		new_vocab = set(new_fingerprint.vocabulary_signature.keys())
		
		vocab_added = new_vocab - old_vocab
		vocab_removed = old_vocab - new_vocab
		vocab_change = (len(vocab_added) + len(vocab_removed)) / max(len(old_vocab | new_vocab), 1)
		
		changes["vocabulary"] = {
			"words_added": len(vocab_added),
			"words_removed": len(vocab_removed),
			"change_ratio": vocab_change
		}
		total_change += vocab_change * 0.3
		
		# Formality changes
		formality_change = abs(new_fingerprint.formality_level - old_fingerprint.formality_level)
		changes["formality"] = {
			"old_level": old_fingerprint.formality_level,
			"new_level": new_fingerprint.formality_level,
			"change": formality_change
		}
		total_change += formality_change * 0.2
		
		# Complexity changes
		complexity_change = abs(new_fingerprint.complexity_score - old_fingerprint.complexity_score)
		changes["complexity"] = {
			"old_score": old_fingerprint.complexity_score,
			"new_score": new_fingerprint.complexity_score,
			"change": complexity_change
		}
		total_change += complexity_change * 0.2
		
		# Tone changes
		tone_changes = {}
		all_tones = set(old_fingerprint.tone_profile.keys()) | set(new_fingerprint.tone_profile.keys())
		tone_total_change = 0.0
		
		for tone in all_tones:
			old_score = old_fingerprint.tone_profile.get(tone, 0.0)
			new_score = new_fingerprint.tone_profile.get(tone, 0.0)
			tone_change = abs(new_score - old_score)
			tone_changes[tone] = {
				"old_score": old_score,
				"new_score": new_score,
				"change": tone_change
			}
			tone_total_change += tone_change
		
		changes["tone"] = tone_changes
		total_change += tone_total_change * 0.2
		
		# Style changes (if available)
		if old_style and new_style:
			style_change = abs(new_style.formality_score - old_style.formality_score)
			changes["style"] = {
				"formality_change": style_change,
				"pattern_changes": len(new_style.style_patterns) - len(old_style.style_patterns)
			}
			total_change += style_change * 0.1
		
		# Confidence change
		confidence_delta = new_fingerprint.confidence_level - old_fingerprint.confidence_level
		
		return {
			"changes": changes,
			"total_change": total_change,
			"confidence_delta": confidence_delta,
			"is_major": total_change >= 0.3  # Major change threshold
		}
	
	def _generate_version_number(self, existing_versions: List[ProfileVersion], is_major: bool) -> str:
		"""Generate semantic version number"""
		
		if not existing_versions:
			return "1.0.0"
		
		# Parse latest version
		latest_version = existing_versions[-1].version_number
		try:
			parts = latest_version.split('.')
			major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
		except:
			# Fallback if version parsing fails
			return f"{len(existing_versions) + 1}.0.0"
		
		# Increment based on change type
		if is_major:
			return f"{major + 1}.0.0"
		else:
			return f"{major}.{minor}.{patch + 1}"
	
	async def compare_profiles(self,
	                           source_profile_id: str,
	                           target_profile_id: str,
	                           comparison_type: ComparisonType = ComparisonType.SIMILARITY,
	                           source_version: Optional[str] = None,
	                           target_version: Optional[str] = None) -> ProfileComparison:
		"""
		Compare two voice profiles
		
		Args:
			source_profile_id: Source profile ID
			target_profile_id: Target profile ID
			comparison_type: Type of comparison to perform
			source_version: Specific source version (latest if None)
			target_version: Specific target version (latest if None)
			
		Returns:
			Detailed profile comparison
		"""
		start_time = datetime.now()
		
		try:
			self._log_comparison_start(source_profile_id, target_profile_id, comparison_type.value)
			
			# Get profile versions
			source_fingerprint, source_style = await self._get_profile_version(
				source_profile_id, source_version
			)
			target_fingerprint, target_style = await self._get_profile_version(
				target_profile_id, target_version
			)
			
			# Perform comparison based on type
			if comparison_type == ComparisonType.EVOLUTION:
				comparison_result = await self._compare_evolution(
					source_fingerprint, target_fingerprint, source_style, target_style
				)
			else:
				comparison_result = await self._compare_similarity(
					source_fingerprint, target_fingerprint, source_style, target_style
				)
			
			# Create comparison object
			comparison = ProfileComparison(
				comparison_type=comparison_type,
				source_profile_id=source_profile_id,
				target_profile_id=target_profile_id,
				source_version=source_version,
				target_version=target_version,
				**comparison_result
			)
			
			# Cache result
			self.comparisons[comparison.comparison_id] = comparison
			await self._persist_comparison(comparison)
			
			# Update statistics
			self.usage_stats["comparisons_performed"] += 1
			duration = (datetime.now() - start_time).total_seconds()
			self.performance_metrics["comparison_time"].append(duration)
			
			self._log_comparison_complete(
				source_profile_id, target_profile_id, comparison.overall_similarity, duration
			)
			
			return comparison
			
		except Exception as e:
			self._log_comparison_error(f"Profile comparison failed: {str(e)}")
			raise
	
	async def _get_profile_version(self, profile_id: str, version: Optional[str]) -> Tuple[VoiceFingerprint, Optional[StyleProfile]]:
		"""Get specific version of a profile"""
		
		profile_versions = self.versions.get(profile_id, [])
		if not profile_versions:
			raise ValueError(f"No versions found for profile {profile_id}")
		
		if version:
			# Find specific version
			for pv in profile_versions:
				if pv.version_number == version:
					return pv.voice_fingerprint, pv.style_profile
			raise ValueError(f"Version {version} not found for profile {profile_id}")
		else:
			# Return latest version
			latest = profile_versions[-1]
			return latest.voice_fingerprint, latest.style_profile
	
	async def _compare_similarity(self,
	                              source_fp: VoiceFingerprint,
	                              target_fp: VoiceFingerprint,
	                              source_style: Optional[StyleProfile],
	                              target_style: Optional[StyleProfile]) -> Dict[str, Any]:
		"""Perform similarity comparison between profiles"""
		
		# Calculate component similarities
		component_similarities = {}
		
		# Vocabulary similarity
		source_vocab = set(source_fp.vocabulary_signature.keys())
		target_vocab = set(target_fp.vocabulary_signature.keys())
		vocab_intersection = len(source_vocab.intersection(target_vocab))
		vocab_union = len(source_vocab.union(target_vocab))
		vocabulary_overlap = vocab_intersection / vocab_union if vocab_union > 0 else 0.0
		component_similarities["vocabulary"] = vocabulary_overlap
		
		# Tone similarity
		all_tones = set(source_fp.tone_profile.keys()) | set(target_fp.tone_profile.keys())
		tone_similarities = []
		for tone in all_tones:
			source_score = source_fp.tone_profile.get(tone, 0.0)
			target_score = target_fp.tone_profile.get(tone, 0.0)
			similarity = 1.0 - abs(source_score - target_score)
			tone_similarities.append(similarity)
		
		tone_similarity = statistics.mean(tone_similarities) if tone_similarities else 0.0
		component_similarities["tone"] = tone_similarity
		
		# Formality and complexity differences
		formality_difference = abs(source_fp.formality_level - target_fp.formality_level)
		complexity_difference = abs(source_fp.complexity_score - target_fp.complexity_score)
		
		component_similarities["formality"] = 1.0 - formality_difference
		component_similarities["complexity"] = 1.0 - complexity_difference
		
		# Overall similarity
		overall_similarity = statistics.mean(component_similarities.values())
		
		# Identify significant differences
		significant_differences = []
		if formality_difference > 0.2:
			significant_differences.append(f"Formality difference: {formality_difference:.3f}")
		if complexity_difference > 0.2:
			significant_differences.append(f"Complexity difference: {complexity_difference:.3f}")
		if vocabulary_overlap < 0.5:
			significant_differences.append(f"Low vocabulary overlap: {vocabulary_overlap:.3f}")
		
		return {
			"overall_similarity": overall_similarity,
			"component_similarities": component_similarities,
			"significant_differences": significant_differences,
			"vocabulary_overlap": vocabulary_overlap,
			"tone_similarity": tone_similarity,
			"formality_difference": formality_difference,
			"complexity_difference": complexity_difference
		}
	
	async def _compare_evolution(self,
	                             old_fp: VoiceFingerprint,
	                             new_fp: VoiceFingerprint,
	                             old_style: Optional[StyleProfile],
	                             new_style: Optional[StyleProfile]) -> Dict[str, Any]:
		"""Perform evolution comparison between profile versions"""
		
		# Calculate basic similarity first
		similarity_result = await self._compare_similarity(old_fp, new_fp, old_style, new_style)
		
		# Add evolution-specific metrics
		evolution_trajectory = {
			"formality": new_fp.formality_level - old_fp.formality_level,
			"complexity": new_fp.complexity_score - old_fp.complexity_score,
			"technical_density": new_fp.technical_density - old_fp.technical_density,
			"confidence": new_fp.confidence_level - old_fp.confidence_level
		}
		
		# Calculate change velocity (magnitude of change)
		change_magnitudes = [abs(v) for v in evolution_trajectory.values()]
		change_velocity = statistics.mean(change_magnitudes)
		
		# Calculate stability (inverse of change)
		stability_score = max(0.0, 1.0 - change_velocity)
		
		# Add evolution metrics to result
		similarity_result.update({
			"evolution_trajectory": evolution_trajectory,
			"change_velocity": change_velocity,
			"stability_score": stability_score
		})
		
		return similarity_result
	
	async def get_profile_evolution_timeline(self, profile_id: str) -> Dict[str, Any]:
		"""Get evolution timeline for a profile"""
		
		versions = self.versions.get(profile_id, [])
		if len(versions) < 2:
			return {"error": "Insufficient versions for timeline analysis"}
		
		timeline = []
		for i, version in enumerate(versions):
			entry = {
				"version": version.version_number,
				"timestamp": version.created_timestamp.isoformat(),
				"description": version.change_description,
				"is_major": version.is_major_change,
				"confidence": version.voice_fingerprint.confidence_level,
				"formality": version.voice_fingerprint.formality_level,
				"complexity": version.voice_fingerprint.complexity_score
			}
			
			if i > 0:
				# Calculate changes from previous version
				prev_fp = versions[i-1].voice_fingerprint
				curr_fp = version.voice_fingerprint
				
				entry["changes"] = {
					"formality_delta": curr_fp.formality_level - prev_fp.formality_level,
					"complexity_delta": curr_fp.complexity_score - prev_fp.complexity_score,
					"confidence_delta": curr_fp.confidence_level - prev_fp.confidence_level
				}
			
			timeline.append(entry)
		
		# Calculate overall trends
		first_fp = versions[0].voice_fingerprint
		last_fp = versions[-1].voice_fingerprint
		
		trends = {
			"formality_trend": last_fp.formality_level - first_fp.formality_level,
			"complexity_trend": last_fp.complexity_score - first_fp.complexity_score,
			"confidence_trend": last_fp.confidence_level - first_fp.confidence_level,
			"total_versions": len(versions),
			"timespan_days": (versions[-1].created_timestamp - versions[0].created_timestamp).days
		}
		
		return {
			"profile_id": profile_id,
			"timeline": timeline,
			"trends": trends,
			"analysis_timestamp": datetime.now().isoformat()
		}
	
	async def archive_profile(self, profile_id: str, archive_reason: str) -> bool:
		"""Archive a voice profile"""
		
		try:
			if profile_id not in self.profiles:
				raise ValueError(f"Profile {profile_id} not found")
			
			profile = self.profiles[profile_id]
			profile.status = ProfileStatus.ARCHIVED
			profile.metadata["archive_reason"] = archive_reason
			profile.metadata["archived_at"] = datetime.now().isoformat()
			
			await self._persist_profile(profile)
			self._log_profile_archived(profile_id, archive_reason)
			
			return True
			
		except Exception as e:
			self._log_management_error(f"Failed to archive profile {profile_id}: {str(e)}")
			return False
	
	async def restore_profile(self, profile_id: str) -> bool:
		"""Restore an archived profile"""
		
		try:
			if profile_id not in self.profiles:
				raise ValueError(f"Profile {profile_id} not found")
			
			profile = self.profiles[profile_id]
			profile.status = ProfileStatus.ACTIVE
			profile.metadata.pop("archive_reason", None)
			profile.metadata.pop("archived_at", None)
			profile.metadata["restored_at"] = datetime.now().isoformat()
			
			await self._persist_profile(profile)
			self._log_profile_restored(profile_id)
			
			return True
			
		except Exception as e:
			self._log_management_error(f"Failed to restore profile {profile_id}: {str(e)}")
			return False
	
	async def cleanup_old_versions(self, profile_id: str, keep_count: Optional[int] = None) -> int:
		"""Clean up old versions of a profile"""
		
		versions = self.versions.get(profile_id, [])
		keep_count = keep_count or self.max_versions_per_profile
		
		if len(versions) <= keep_count:
			return 0
		
		# Keep the most recent versions and major versions
		versions_to_keep = []
		versions_to_remove = []
		
		# Always keep recent versions
		versions_to_keep.extend(versions[-keep_count//2:])
		
		# Keep major versions
		for version in versions[:-keep_count//2]:
			if version.is_major_change and version not in versions_to_keep:
				versions_to_keep.append(version)
			else:
				versions_to_remove.append(version)
		
		# Remove excess versions
		for version in versions_to_remove:
			await self._remove_version_storage(version)
		
		# Update in-memory storage
		self.versions[profile_id] = sorted(versions_to_keep, key=lambda v: v.created_timestamp)
		
		self._log_versions_cleaned(profile_id, len(versions_to_remove))
		return len(versions_to_remove)
	
	async def _cleanup_old_versions(self, profile_id: str):
		"""Internal version cleanup"""
		await self.cleanup_old_versions(profile_id)
	
	async def create_backup(self, backup_name: Optional[str] = None) -> str:
		"""Create backup of all profiles and versions"""
		
		backup_name = backup_name or f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
		backup_path = self.storage_path / "backups" / backup_name
		backup_path.mkdir(parents=True, exist_ok=True)
		
		try:
			# Copy profiles
			profiles_backup = backup_path / "profiles"
			profiles_backup.mkdir(exist_ok=True)
			shutil.copytree(self.storage_path / "profiles", profiles_backup, dirs_exist_ok=True)
			
			# Copy versions
			versions_backup = backup_path / "versions"
			versions_backup.mkdir(exist_ok=True)
			shutil.copytree(self.storage_path / "versions", versions_backup, dirs_exist_ok=True)
			
			# Create backup manifest
			manifest = {
				"backup_name": backup_name,
				"created_at": datetime.now().isoformat(),
				"profile_count": len(self.profiles),
				"version_count": sum(len(v) for v in self.versions.values()),
				"backup_path": str(backup_path)
			}
			
			with open(backup_path / "manifest.json", 'w') as f:
				json.dump(manifest, f, indent=2)
			
			self._log_backup_created(backup_name, len(self.profiles))
			return backup_name
			
		except Exception as e:
			self._log_management_error(f"Backup creation failed: {str(e)}")
			raise
	
	def get_manager_statistics(self) -> Dict[str, Any]:
		"""Get comprehensive manager statistics"""
		
		total_versions = sum(len(v) for v in self.versions.values())
		avg_versions_per_profile = total_versions / max(len(self.profiles), 1)
		
		# Calculate version age distribution
		all_versions = []
		for versions in self.versions.values():
			all_versions.extend(versions)
		
		if all_versions:
			version_ages = [(datetime.now() - v.created_timestamp).days for v in all_versions]
			avg_version_age = statistics.mean(version_ages)
		else:
			avg_version_age = 0
		
		# Performance metrics
		avg_comparison_time = statistics.mean(self.performance_metrics.get("comparison_time", [0]))
		avg_version_time = statistics.mean(self.performance_metrics.get("version_creation_time", [0]))
		
		return {
			"total_profiles": len(self.profiles),
			"total_versions": total_versions,
			"avg_versions_per_profile": avg_versions_per_profile,
			"avg_version_age_days": avg_version_age,
			"total_comparisons": len(self.comparisons),
			"avg_comparison_time": avg_comparison_time,
			"avg_version_creation_time": avg_version_time,
			"storage_path": str(self.storage_path),
			"usage_statistics": dict(self.usage_stats),
			"ml_available": ML_AVAILABLE
		}
	
	# Persistence methods
	
	async def _persist_profile(self, profile: VoiceProfile):
		"""Persist profile to storage"""
		profile_path = self.storage_path / "profiles" / f"{profile.profile_id}.json"
		with open(profile_path, 'w') as f:
			json.dump(profile.model_dump(), f, indent=2, default=str)
	
	async def _persist_version(self, version: ProfileVersion):
		"""Persist version to storage"""
		version_path = self.storage_path / "versions" / f"{version.version_id}.json"
		with open(version_path, 'w') as f:
			json.dump(version.model_dump(), f, indent=2, default=str)
	
	async def _persist_comparison(self, comparison: ProfileComparison):
		"""Persist comparison to storage"""
		comparison_path = self.storage_path / "comparisons" / f"{comparison.comparison_id}.json"
		with open(comparison_path, 'w') as f:
			json.dump(comparison.model_dump(), f, indent=2, default=str)
	
	async def _remove_version_storage(self, version: ProfileVersion):
		"""Remove version from storage"""
		version_path = self.storage_path / "versions" / f"{version.version_id}.json"
		if version_path.exists():
			version_path.unlink()
	
	# Logging methods
	
	def _log_initialization(self):
		ml_status = "available" if ML_AVAILABLE else "fallback mode"
		print(f"ProfileManager: Initialized with storage at {self.storage_path} ({ml_status})")
	
	def _log_profiles_loaded(self, profile_count: int, version_count: int):
		print(f"ProfileManager: Loaded {profile_count} profiles and {version_count} versions")
	
	def _log_version_creation_start(self, profile_id: str):
		print(f"ProfileManager: Creating version for profile {profile_id}")
	
	def _log_version_created(self, profile_id: str, version: str, is_major: bool, duration: float):
		change_type = "major" if is_major else "minor"
		print(f"ProfileManager: Created {change_type} version {version} for {profile_id} ({duration:.2f}s)")
	
	def _log_version_skipped(self, profile_id: str, change_amount: float):
		print(f"ProfileManager: Version skipped for {profile_id} (change: {change_amount:.3f} < threshold)")
	
	def _log_comparison_start(self, source_id: str, target_id: str, comparison_type: str):
		print(f"ProfileManager: Starting {comparison_type} comparison: {source_id} vs {target_id}")
	
	def _log_comparison_complete(self, source_id: str, target_id: str, similarity: float, duration: float):
		print(f"ProfileManager: Comparison complete: {source_id} vs {target_id} (similarity: {similarity:.3f}, {duration:.2f}s)")
	
	def _log_profile_archived(self, profile_id: str, reason: str):
		print(f"ProfileManager: Archived profile {profile_id} (reason: {reason})")
	
	def _log_profile_restored(self, profile_id: str):
		print(f"ProfileManager: Restored profile {profile_id}")
	
	def _log_versions_cleaned(self, profile_id: str, removed_count: int):
		print(f"ProfileManager: Cleaned {removed_count} old versions for profile {profile_id}")
	
	def _log_backup_created(self, backup_name: str, profile_count: int):
		print(f"ProfileManager: Created backup '{backup_name}' ({profile_count} profiles)")
	
	def _log_storage_error(self, message: str):
		print(f"ProfileManager Storage Error: {message}")
	
	def _log_version_error(self, message: str):
		print(f"ProfileManager Version Error: {message}")
	
	def _log_comparison_error(self, message: str):
		print(f"ProfileManager Comparison Error: {message}")
	
	def _log_management_error(self, message: str):
		print(f"ProfileManager Management Error: {message}")


# Example usage and testing
async def create_sample_profile_management():
	"""Create sample profile management for testing"""
	
	# Initialize manager
	manager = ProfileManager("/tmp/voice_profile_test")
	
	# Create sample voice profiles
	from ..analyzer.voice_pattern_analyzer import VoicePatternAnalyzer
	from .voice_profiler import VoiceProfiler
	
	analyzer = VoicePatternAnalyzer()
	profiler = VoiceProfiler()
	
	# Sample documents for different organizations
	org1_docs = [
		"We are pleased to present our comprehensive solution that leverages innovative methodologies.",
		"Our research demonstrates significant value through systematic implementation of proven frameworks.",
		"We respectfully recommend collaborative approaches that deliver measurable outcomes."
	]
	
	org2_docs = [
		"Hey there! We're super excited to share our awesome new product that's totally game-changing.",
		"This is gonna revolutionize everything and make your life so much easier, guaranteed!",
		"Thanks for checking us out - we can't wait to work together and create something amazing!"
	]
	
	# Create voice fingerprints
	fp1 = await analyzer.analyze_voice_patterns(org1_docs, "Formal Corp")
	fp2 = await analyzer.analyze_voice_patterns(org2_docs, "Casual Startup")
	
	# Create voice profiles
	profile1 = await profiler.create_voice_profile("Formal Corp", org1_docs)
	profile2 = await profiler.create_voice_profile("Casual Startup", org2_docs)
	
	# Create versions
	version1 = await manager.create_profile_version(
		profile1, "Initial profile creation", "system"
	)
	version2 = await manager.create_profile_version(
		profile2, "Initial profile creation", "system"
	)
	
	# Create modified version
	modified_docs = org1_docs + ["We appreciate your partnership and look forward to collaboration."]
	fp1_modified = await analyzer.analyze_voice_patterns(modified_docs, "Formal Corp")
	profile1_modified = await profiler.create_voice_profile("Formal Corp", modified_docs)
	
	version1_updated = await manager.create_profile_version(
		profile1_modified, "Added collaborative language", "user_123"
	)
	
	# Compare profiles
	comparison = await manager.compare_profiles(
		profile1.profile_id, profile2.profile_id, ComparisonType.SIMILARITY
	)
	
	evolution_comparison = await manager.compare_profiles(
		profile1.profile_id, profile1.profile_id, 
		ComparisonType.EVOLUTION,
		version1.version_number, version1_updated.version_number
	)
	
	# Get evolution timeline
	timeline = await manager.get_profile_evolution_timeline(profile1.profile_id)
	
	return {
		"manager": manager,
		"profiles": [profile1, profile2],
		"versions": [version1, version2, version1_updated],
		"comparison": comparison,
		"evolution": evolution_comparison,
		"timeline": timeline,
		"stats": manager.get_manager_statistics()
	}


if __name__ == "__main__":
	# Test the profile manager
	import asyncio
	
	async def main():
		result = await create_sample_profile_management()
		
		print("Profile Management Results:")
		print("=" * 60)
		
		print(f"\nCreated Profiles: {len(result['profiles'])}")
		for profile in result['profiles']:
			print(f"  📋 {profile.organization_name} ({profile.profile_type.value})")
			print(f"     Confidence: {profile.voice_fingerprint.confidence_level:.3f}")
		
		print(f"\nCreated Versions: {len(result['versions'])}")
		for version in result['versions']:
			change_type = "🔴 Major" if version.is_major_change else "🟡 Minor"
			print(f"  {change_type} v{version.version_number}: {version.change_description}")
		
		print(f"\nProfile Comparison:")
		comp = result['comparison']
		print(f"  Overall Similarity: {comp.overall_similarity:.3f}")
		print(f"  Vocabulary Overlap: {comp.vocabulary_overlap:.3f}")
		print(f"  Formality Difference: {comp.formality_difference:.3f}")
		
		print(f"\nEvolution Analysis:")
		evo = result['evolution']
		if evo.evolution_trajectory:
			for metric, change in evo.evolution_trajectory.items():
				direction = "📈" if change > 0 else "📉" if change < 0 else "➡️"
				print(f"  {direction} {metric.title()}: {change:+.3f}")
		
		print(f"\nTimeline Analysis:")
		timeline = result['timeline']
		if 'timeline' in timeline:
			for entry in timeline['timeline']:
				print(f"  v{entry['version']}: {entry['description']}")
				if 'changes' in entry:
					for change, delta in entry['changes'].items():
						if abs(delta) > 0.01:
							print(f"    {change}: {delta:+.3f}")
		
		print(f"\nManager Statistics:")
		stats = result['stats']
		for key, value in stats.items():
			if isinstance(value, dict):
				print(f"  {key.replace('_', ' ').title()}:")
				for k, v in value.items():
					print(f"    {k}: {v}")
			else:
				print(f"  {key.replace('_', ' ').title()}: {value}")
	
	asyncio.run(main())