"""
Conflict Resolution Module

Automatic conflict resolution for collaborative document editing including:
- Rule-based conflict resolution strategies
- Machine learning-based resolution suggestions
- Context-aware merge strategies
- User preference learning
- Resolution quality assessment

Simple API for intelligent conflict resolution with fallback to manual review.
"""

from typing import Any, Dict, List, Optional, Set, Tuple, Union, Callable
from dataclasses import dataclass, field
from enum import Enum
import asyncio
import json
import time
import re
from datetime import datetime
from collections import defaultdict
from uuid_extensions import uuid7str
from pydantic import BaseModel, Field, ConfigDict

from .conflict_detector import (
	DetectedConflict, ConflictType, ConflictSeverity, ConflictScope,
	ConflictAnalysisResult, ContentRegion, SemanticEntity
)


class ResolutionStrategy(Enum):
	"""Conflict resolution strategies"""
	AUTO_MERGE = "auto_merge"  # Fully automatic resolution
	PREFER_NEWER = "prefer_newer"  # Prefer more recent changes
	PREFER_LONGER = "prefer_longer"  # Prefer longer/more detailed content
	PREFER_AUTHOR = "prefer_author"  # Prefer specific author
	SEMANTIC_MERGE = "semantic_merge"  # AI-powered semantic resolution
	MANUAL_REVIEW = "manual_review"  # Require human intervention
	COMBINE_BOTH = "combine_both"  # Merge both versions intelligently
	REJECT_CONFLICT = "reject_conflict"  # Reject conflicting changes


class ResolutionStatus(Enum):
	"""Status of conflict resolution"""
	RESOLVED = "resolved"
	PARTIALLY_RESOLVED = "partially_resolved"
	REQUIRES_MANUAL = "requires_manual"
	FAILED = "failed"
	PENDING = "pending"


class ResolutionQuality(Enum):
	"""Quality assessment of resolution"""
	EXCELLENT = "excellent"  # High confidence, clean resolution
	GOOD = "good"  # Acceptable resolution with minor concerns
	ACCEPTABLE = "acceptable"  # Resolution works but not optimal
	POOR = "poor"  # Low confidence, may need review
	UNKNOWN = "unknown"  # Cannot assess quality


@dataclass
class ResolutionRule:
	"""Rule for automatic conflict resolution"""
	rule_id: str = field(default_factory=uuid7str)
	rule_name: str = ""
	description: str = ""
	
	# Rule conditions
	conflict_types: List[ConflictType] = field(default_factory=list)
	severity_threshold: ConflictSeverity = ConflictSeverity.LOW
	scope_applicability: List[ConflictScope] = field(default_factory=list)
	content_patterns: List[str] = field(default_factory=list)
	
	# Resolution strategy
	strategy: ResolutionStrategy = ResolutionStrategy.AUTO_MERGE
	priority: int = 100  # Higher number = higher priority
	
	# Rule metadata
	success_rate: float = 0.0
	usage_count: int = 0
	created_by: str = ""
	enabled: bool = True
	metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ResolutionAttempt:
	"""Single attempt at resolving a conflict"""
	attempt_id: str = field(default_factory=uuid7str)
	conflict_id: str = ""
	strategy_used: ResolutionStrategy = ResolutionStrategy.AUTO_MERGE
	rule_applied: Optional[str] = None  # Rule ID if rule-based
	
	# Resolution results
	resolved_content: str = ""
	confidence: float = 0.0
	quality_score: float = 0.0
	quality_assessment: ResolutionQuality = ResolutionQuality.UNKNOWN
	
	# Processing metadata
	processing_time_ms: float = 0.0
	timestamp: datetime = field(default_factory=datetime.now)
	reasoning: str = ""
	alternative_resolutions: List[str] = field(default_factory=list)
	
	# Success metrics
	user_accepted: Optional[bool] = None
	manual_modifications: bool = False
	feedback_provided: str = ""


@dataclass
class ResolvedConflict:
	"""Conflict with its resolution"""
	original_conflict: DetectedConflict
	resolution_attempts: List[ResolutionAttempt] = field(default_factory=list)
	final_resolution: Optional[ResolutionAttempt] = None
	
	# Resolution status
	status: ResolutionStatus = ResolutionStatus.PENDING
	requires_manual_review: bool = False
	manual_reviewer: str = ""
	manual_review_notes: str = ""
	
	# Resolution metadata
	total_attempts: int = 0
	resolution_time_ms: float = 0.0
	resolved_at: Optional[datetime] = None
	resolved_by: str = ""  # system, rule, manual, hybrid


class ConflictResolutionResult(BaseModel):
	"""Result of conflict resolution process"""
	model_config = ConfigDict(extra='forbid', validate_default=True)
	
	# Input information
	total_conflicts: int = 0
	analysis_result: Optional[ConflictAnalysisResult] = None
	
	# Resolution results
	resolved_conflicts: List[ResolvedConflict] = Field(default_factory=list)
	unresolved_conflicts: List[DetectedConflict] = Field(default_factory=list)
	
	# Merged content
	merged_content: str = ""
	merge_successful: bool = False
	merge_quality_score: float = 0.0
	
	# Processing statistics
	resolution_summary: Dict[str, int] = Field(default_factory=dict)
	strategies_used: Dict[str, int] = Field(default_factory=dict)
	total_processing_time_ms: float = 0.0
	
	# Quality metrics
	overall_confidence: float = 0.0
	manual_review_required: bool = False
	automated_resolution_rate: float = 0.0
	
	# Metadata
	processed_at: datetime = Field(default_factory=datetime.now)
	resolver_version: str = "1.0"


class UserPreferences(BaseModel):
	"""User preferences for conflict resolution"""
	model_config = ConfigDict(extra='forbid', validate_default=True)
	
	user_id: str
	preferred_strategy: ResolutionStrategy = ResolutionStrategy.AUTO_MERGE
	
	# Author preferences
	trusted_authors: List[str] = Field(default_factory=list)
	preferred_authors: List[str] = Field(default_factory=list)
	
	# Content preferences  
	prefer_longer_content: bool = True
	prefer_newer_changes: bool = True
	prefer_detailed_explanations: bool = True
	
	# Automation preferences
	auto_resolve_threshold: ConflictSeverity = ConflictSeverity.MEDIUM
	require_review_for_critical: bool = True
	enable_semantic_resolution: bool = True
	
	# Learning preferences
	learn_from_manual_edits: bool = True
	provide_feedback: bool = True
	
	# Metadata
	created_at: datetime = Field(default_factory=datetime.now)
	last_updated: datetime = Field(default_factory=datetime.now)


class ConflictResolver:
	"""
	Intelligent conflict resolution system for collaborative editing.
	
	Provides automated conflict resolution using rule-based strategies,
	semantic understanding, and machine learning from user preferences.
	
	Simple usage:
	```python
	resolver = ConflictResolver()
	result = await resolver.resolve_conflicts(conflicts)
	merged_content = result.merged_content
	```
	"""
	
	def __init__(self, semantic_resolution: bool = True):
		self.semantic_resolution_enabled = semantic_resolution
		
		# Resolution rules and strategies
		self.resolution_rules: List[ResolutionRule] = []
		self.custom_strategies: Dict[str, Callable] = {}
		self.user_preferences: Dict[str, UserPreferences] = {}
		
		# Learning and performance tracking
		self.resolution_history: List[ResolutionAttempt] = []
		self.rule_performance: Dict[str, Dict[str, float]] = defaultdict(dict)
		
		# Performance caches
		self._strategy_cache: Dict[str, ResolutionStrategy] = {}
		self._resolution_cache: Dict[str, str] = {}
		
		# Thread safety
		self._lock = asyncio.Lock()
		
		# Initialize default rules
		asyncio.create_task(self._initialize_default_rules())
	
	async def resolve_conflicts(
		self,
		conflicts: Union[List[DetectedConflict], ConflictAnalysisResult],
		content_a: str = "",
		content_b: str = "",
		user_id: Optional[str] = None,
		preferences: Optional[UserPreferences] = None
	) -> ConflictResolutionResult:
		"""
		Resolve conflicts using intelligent strategies.
		
		Simple API - provide conflicts and get resolved content.
		"""
		start_time = time.time()
		
		async with self._lock:
			# Extract conflicts from input
			if isinstance(conflicts, ConflictAnalysisResult):
				conflict_list = conflicts.conflicts
				analysis_result = conflicts
			else:
				conflict_list = conflicts
				analysis_result = None
			
			# Initialize result
			result = ConflictResolutionResult(
				total_conflicts=len(conflict_list),
				analysis_result=analysis_result
			)
			
			# Get user preferences
			user_prefs = preferences or await self._get_user_preferences(user_id)
			
			# Process each conflict
			for conflict in conflict_list:
				resolved_conflict = await self._resolve_single_conflict(
					conflict, content_a, content_b, user_prefs
				)
				
				if resolved_conflict.status == ResolutionStatus.RESOLVED:
					result.resolved_conflicts.append(resolved_conflict)
				else:
					result.unresolved_conflicts.append(conflict)
					result.manual_review_required = True
			
			# Generate merged content
			if result.resolved_conflicts:
				result.merged_content = await self._generate_merged_content(
					content_a, content_b, result.resolved_conflicts
				)
				result.merge_successful = len(result.unresolved_conflicts) == 0
			else:
				result.merged_content = content_a  # Fallback to original
				result.merge_successful = False
			
			# Calculate statistics
			await self._calculate_resolution_statistics(result)
			
			# Calculate processing time
			result.total_processing_time_ms = (time.time() - start_time) * 1000
			
			return result
	
	async def resolve_conflict(
		self,
		conflict: DetectedConflict,
		content_a: str = "",
		content_b: str = "",
		strategy: Optional[ResolutionStrategy] = None,
		user_id: Optional[str] = None
	) -> ResolvedConflict:
		"""
		Resolve single conflict with specified strategy.
		
		Simple API for individual conflict resolution.
		"""
		user_prefs = await self._get_user_preferences(user_id)
		
		if strategy:
			# Override user preferences with explicit strategy
			temp_prefs = UserPreferences(user_id=user_id or "system")
			temp_prefs.preferred_strategy = strategy
			user_prefs = temp_prefs
		
		return await self._resolve_single_conflict(conflict, content_a, content_b, user_prefs)
	
	async def add_resolution_rule(
		self,
		rule_name: str,
		conflict_types: List[ConflictType],
		strategy: ResolutionStrategy,
		description: str = "",
		priority: int = 100,
		severity_threshold: ConflictSeverity = ConflictSeverity.LOW
	) -> ResolutionRule:
		"""
		Add custom resolution rule.
		
		Simple API for adding resolution strategies.
		"""
		rule = ResolutionRule(
			rule_name=rule_name,
			description=description,
			conflict_types=conflict_types,
			severity_threshold=severity_threshold,
			strategy=strategy,
			priority=priority
		)
		
		self.resolution_rules.append(rule)
		
		# Sort rules by priority
		self.resolution_rules.sort(key=lambda r: r.priority, reverse=True)
		
		return rule
	
	async def set_user_preferences(
		self,
		user_id: str,
		preferences: UserPreferences
	) -> None:
		"""Set user preferences for conflict resolution."""
		self.user_preferences[user_id] = preferences
	
	async def learn_from_resolution(
		self,
		resolved_conflict: ResolvedConflict,
		user_feedback: Dict[str, Any]
	) -> None:
		"""
		Learn from user feedback on resolution quality.
		
		Simple API for improving resolution strategies.
		"""
		if not resolved_conflict.final_resolution:
			return
		
		attempt = resolved_conflict.final_resolution
		
		# Update user acceptance
		if "accepted" in user_feedback:
			attempt.user_accepted = user_feedback["accepted"]
		
		# Store feedback
		if "feedback" in user_feedback:
			attempt.feedback_provided = user_feedback["feedback"]
		
		# Update rule performance if rule was used
		if attempt.rule_applied:
			rule_id = attempt.rule_applied
			if rule_id not in self.rule_performance:
				self.rule_performance[rule_id] = {"success_count": 0, "total_count": 0}
			
			self.rule_performance[rule_id]["total_count"] += 1
			if attempt.user_accepted:
				self.rule_performance[rule_id]["success_count"] += 1
			
			# Update rule success rate
			for rule in self.resolution_rules:
				if rule.rule_id == rule_id:
					rule.usage_count += 1
					rule.success_rate = (
						self.rule_performance[rule_id]["success_count"] / 
						self.rule_performance[rule_id]["total_count"]
					)
					break
		
		# Store in resolution history for ML training
		self.resolution_history.append(attempt)
	
	# Internal resolution methods
	
	async def _resolve_single_conflict(
		self,
		conflict: DetectedConflict,
		content_a: str,
		content_b: str,
		user_prefs: UserPreferences
	) -> ResolvedConflict:
		"""Resolve a single conflict using available strategies."""
		resolved_conflict = ResolvedConflict(original_conflict=conflict)
		
		# Try resolution strategies in priority order
		strategies_to_try = await self._get_applicable_strategies(conflict, user_prefs)
		
		for strategy, rule_id in strategies_to_try:
			attempt = await self._attempt_resolution(
				conflict, content_a, content_b, strategy, rule_id
			)
			
			resolved_conflict.resolution_attempts.append(attempt)
			resolved_conflict.total_attempts += 1
			
			# Check if resolution is acceptable
			if await self._is_resolution_acceptable(attempt, user_prefs):
				resolved_conflict.final_resolution = attempt
				resolved_conflict.status = ResolutionStatus.RESOLVED
				resolved_conflict.resolved_at = datetime.now()
				resolved_conflict.resolved_by = "system" if rule_id else "strategy"
				break
		
		# If no resolution worked, mark for manual review
		if not resolved_conflict.final_resolution:
			resolved_conflict.status = ResolutionStatus.REQUIRES_MANUAL
			resolved_conflict.requires_manual_review = True
		
		return resolved_conflict
	
	async def _attempt_resolution(
		self,
		conflict: DetectedConflict,
		content_a: str,
		content_b: str,
		strategy: ResolutionStrategy,
		rule_id: Optional[str] = None
	) -> ResolutionAttempt:
		"""Attempt to resolve conflict with specific strategy."""
		start_time = time.time()
		
		attempt = ResolutionAttempt(
			conflict_id=conflict.conflict_id,
			strategy_used=strategy,
			rule_applied=rule_id
		)
		
		try:
			if strategy == ResolutionStrategy.PREFER_NEWER:
				# Use content from more recent author (simplified)
				attempt.resolved_content = conflict.content_b
				attempt.confidence = 0.8
				attempt.reasoning = "Preferred newer changes"
			
			elif strategy == ResolutionStrategy.PREFER_LONGER:
				# Use longer/more detailed content
				if len(conflict.content_a) > len(conflict.content_b):
					attempt.resolved_content = conflict.content_a
				else:
					attempt.resolved_content = conflict.content_b
				attempt.confidence = 0.7
				attempt.reasoning = "Preferred longer content"
			
			elif strategy == ResolutionStrategy.COMBINE_BOTH:
				# Intelligently combine both versions
				combined = await self._combine_content_versions(
					conflict.content_a, conflict.content_b, conflict
				)
				attempt.resolved_content = combined
				attempt.confidence = 0.6
				attempt.reasoning = "Combined both versions"
			
			elif strategy == ResolutionStrategy.SEMANTIC_MERGE:
				# Use semantic analysis for resolution
				if self.semantic_resolution_enabled:
					semantic_result = await self._semantic_resolution(
						conflict, content_a, content_b
					)
					attempt.resolved_content = semantic_result["content"]
					attempt.confidence = semantic_result["confidence"]
					attempt.reasoning = semantic_result["reasoning"]
				else:
					# Fallback to simple merge
					attempt.resolved_content = conflict.content_a
					attempt.confidence = 0.5
					attempt.reasoning = "Semantic resolution disabled, used fallback"
			
			elif strategy == ResolutionStrategy.AUTO_MERGE:
				# Simple automatic merge based on conflict type
				attempt.resolved_content = await self._auto_merge_content(conflict)
				attempt.confidence = 0.9 if conflict.severity == ConflictSeverity.LOW else 0.6
				attempt.reasoning = "Automatic merge based on conflict analysis"
			
			else:
				# Default to using content A
				attempt.resolved_content = conflict.content_a
				attempt.confidence = 0.5
				attempt.reasoning = f"Used default strategy: {strategy.value}"
			
			# Assess resolution quality
			attempt.quality_assessment = await self._assess_resolution_quality(
				attempt, conflict
			)
			attempt.quality_score = await self._calculate_quality_score(attempt)
			
		except Exception as e:
			attempt.resolved_content = conflict.content_a  # Safe fallback
			attempt.confidence = 0.1
			attempt.reasoning = f"Resolution failed: {str(e)}, using fallback"
			attempt.quality_assessment = ResolutionQuality.POOR
		
		attempt.processing_time_ms = (time.time() - start_time) * 1000
		return attempt
	
	async def _get_applicable_strategies(
		self,
		conflict: DetectedConflict,
		user_prefs: UserPreferences
	) -> List[Tuple[ResolutionStrategy, Optional[str]]]:
		"""Get applicable resolution strategies for a conflict."""
		strategies = []
		
		# Check resolution rules first (highest priority)
		for rule in self.resolution_rules:
			if not rule.enabled:
				continue
			
			# Check if rule applies to this conflict
			if await self._rule_applies_to_conflict(rule, conflict):
				strategies.append((rule.strategy, rule.rule_id))
		
		# Add user's preferred strategy if not already covered
		if not any(s[0] == user_prefs.preferred_strategy for s in strategies):
			strategies.append((user_prefs.preferred_strategy, None))
		
		# Add fallback strategies based on conflict characteristics
		fallback_strategies = await self._get_fallback_strategies(conflict, user_prefs)
		strategies.extend(fallback_strategies)
		
		return strategies
	
	async def _rule_applies_to_conflict(
		self,
		rule: ResolutionRule,
		conflict: DetectedConflict
	) -> bool:
		"""Check if resolution rule applies to conflict."""
		# Check conflict type
		if rule.conflict_types and conflict.conflict_type not in rule.conflict_types:
			return False
		
		# Check severity threshold
		severity_order = [
			ConflictSeverity.INFO,
			ConflictSeverity.LOW,
			ConflictSeverity.MEDIUM,
			ConflictSeverity.HIGH,
			ConflictSeverity.CRITICAL
		]
		
		if (severity_order.index(conflict.severity) > 
			severity_order.index(rule.severity_threshold)):
			return False
		
		# Check scope applicability
		if rule.scope_applicability and conflict.scope not in rule.scope_applicability:
			return False
		
		# Check content patterns
		if rule.content_patterns:
			content_combined = conflict.content_a + " " + conflict.content_b
			if not any(re.search(pattern, content_combined, re.IGNORECASE) 
					  for pattern in rule.content_patterns):
				return False
		
		return True
	
	async def _get_fallback_strategies(
		self,
		conflict: DetectedConflict,
		user_prefs: UserPreferences
	) -> List[Tuple[ResolutionStrategy, None]]:
		"""Get fallback strategies based on conflict characteristics."""
		strategies = []
		
		# Based on conflict type
		if conflict.conflict_type == ConflictType.FORMAT_CONFLICT:
			strategies.append((ResolutionStrategy.PREFER_NEWER, None))
		elif conflict.conflict_type == ConflictType.CONTENT_OVERLAP:
			if user_prefs.prefer_longer_content:
				strategies.append((ResolutionStrategy.PREFER_LONGER, None))
			strategies.append((ResolutionStrategy.COMBINE_BOTH, None))
		elif conflict.conflict_type == ConflictType.SEMANTIC_CONFLICT:
			if self.semantic_resolution_enabled:
				strategies.append((ResolutionStrategy.SEMANTIC_MERGE, None))
		
		# Based on severity
		if conflict.severity == ConflictSeverity.LOW:
			strategies.append((ResolutionStrategy.AUTO_MERGE, None))
		elif conflict.severity == ConflictSeverity.CRITICAL:
			strategies.append((ResolutionStrategy.MANUAL_REVIEW, None))
		
		# Always add auto_merge as final fallback
		if not any(s[0] == ResolutionStrategy.AUTO_MERGE for s in strategies):
			strategies.append((ResolutionStrategy.AUTO_MERGE, None))
		
		return strategies
	
	async def _combine_content_versions(
		self,
		content_a: str,
		content_b: str,
		conflict: DetectedConflict
	) -> str:
		"""Intelligently combine two content versions."""
		# Simple combination strategies
		
		if conflict.conflict_type == ConflictType.FORMAT_CONFLICT:
			# Keep content, merge formatting
			return content_b  # Prefer newer formatting
		
		elif len(content_a.split()) > len(content_b.split()):
			# A is more detailed, use A as base and add unique parts from B
			unique_words_b = set(content_b.split()) - set(content_a.split())
			if unique_words_b:
				return content_a + " " + " ".join(unique_words_b)
			return content_a
		
		else:
			# B is more detailed, use B as base and add unique parts from A
			unique_words_a = set(content_a.split()) - set(content_b.split())
			if unique_words_a:
				return content_b + " " + " ".join(unique_words_a)
			return content_b
	
	async def _semantic_resolution(
		self,
		conflict: DetectedConflict,
		content_a: str,
		content_b: str
	) -> Dict[str, Any]:
		"""Resolve conflict using semantic analysis."""
		# Simplified semantic resolution
		# In production, this would use advanced NLP
		
		# Analyze semantic similarity
		words_a = set(conflict.content_a.lower().split())
		words_b = set(conflict.content_b.lower().split())
		
		common_words = words_a & words_b
		total_words = words_a | words_b
		
		similarity = len(common_words) / len(total_words) if total_words else 0
		
		if similarity > 0.7:
			# High similarity, combine intelligently
			resolved = await self._combine_content_versions(
				conflict.content_a, conflict.content_b, conflict
			)
			return {
				"content": resolved,
				"confidence": 0.8,
				"reasoning": f"High semantic similarity ({similarity:.2f}), merged content"
			}
		else:
			# Low similarity, prefer longer or newer
			if len(conflict.content_b) > len(conflict.content_a):
				return {
					"content": conflict.content_b,
					"confidence": 0.6,
					"reasoning": f"Low similarity ({similarity:.2f}), preferred longer content"
				}
			else:
				return {
					"content": conflict.content_a,
					"confidence": 0.6,
					"reasoning": f"Low similarity ({similarity:.2f}), preferred original content"
				}
	
	async def _auto_merge_content(self, conflict: DetectedConflict) -> str:
		"""Simple automatic merge based on conflict characteristics."""
		if conflict.severity == ConflictSeverity.LOW:
			# Low severity - prefer longer content
			return (conflict.content_a if len(conflict.content_a) > len(conflict.content_b) 
					else conflict.content_b)
		else:
			# Higher severity - be conservative, prefer original
			return conflict.content_a
	
	async def _is_resolution_acceptable(
		self,
		attempt: ResolutionAttempt,
		user_prefs: UserPreferences
	) -> bool:
		"""Check if resolution attempt is acceptable."""
		# Quality thresholds
		min_confidence = 0.5
		min_quality_score = 0.4
		
		if attempt.confidence < min_confidence:
			return False
		
		if attempt.quality_score < min_quality_score:
			return False
		
		# Quality assessment threshold
		unacceptable_qualities = [ResolutionQuality.POOR]
		if attempt.quality_assessment in unacceptable_qualities:
			return False
		
		return True
	
	async def _assess_resolution_quality(
		self,
		attempt: ResolutionAttempt,
		conflict: DetectedConflict
	) -> ResolutionQuality:
		"""Assess the quality of a resolution attempt."""
		if attempt.confidence > 0.9:
			return ResolutionQuality.EXCELLENT
		elif attempt.confidence > 0.7:
			return ResolutionQuality.GOOD
		elif attempt.confidence > 0.5:
			return ResolutionQuality.ACCEPTABLE
		elif attempt.confidence > 0.3:
			return ResolutionQuality.POOR
		else:
			return ResolutionQuality.UNKNOWN
	
	async def _calculate_quality_score(self, attempt: ResolutionAttempt) -> float:
		"""Calculate numerical quality score for resolution."""
		# Simple quality scoring
		base_score = attempt.confidence
		
		# Bonus for fast processing
		if attempt.processing_time_ms < 100:
			base_score += 0.1
		elif attempt.processing_time_ms < 500:
			base_score += 0.05
		
		# Bonus for detailed reasoning
		if len(attempt.reasoning) > 20:
			base_score += 0.05
		
		return min(1.0, base_score)
	
	async def _generate_merged_content(
		self,
		content_a: str,
		content_b: str,
		resolved_conflicts: List[ResolvedConflict]
	) -> str:
		"""Generate final merged content from resolved conflicts."""
		# Start with base content
		merged = content_a
		
		# Apply resolutions in reverse position order (to maintain positions)
		sorted_conflicts = sorted(
			resolved_conflicts,
			key=lambda rc: rc.original_conflict.position,
			reverse=True
		)
		
		for resolved_conflict in sorted_conflicts:
			if resolved_conflict.final_resolution:
				conflict = resolved_conflict.original_conflict
				resolution = resolved_conflict.final_resolution
				
				# Replace conflict region with resolved content
				start = conflict.position
				end = start + conflict.length
				
				merged = (merged[:start] + 
						 resolution.resolved_content + 
						 merged[end:])
		
		return merged
	
	async def _calculate_resolution_statistics(self, result: ConflictResolutionResult) -> None:
		"""Calculate statistics for resolution result."""
		resolved_count = len(result.resolved_conflicts)
		unresolved_count = len(result.unresolved_conflicts)
		total = resolved_count + unresolved_count
		
		# Resolution summary
		result.resolution_summary = {
			"resolved": resolved_count,
			"unresolved": unresolved_count,
			"requires_manual": sum(1 for rc in result.resolved_conflicts 
								  if rc.requires_manual_review)
		}
		
		# Strategies used
		strategy_counts = defaultdict(int)
		for resolved_conflict in result.resolved_conflicts:
			if resolved_conflict.final_resolution:
				strategy = resolved_conflict.final_resolution.strategy_used.value
				strategy_counts[strategy] += 1
		
		result.strategies_used = dict(strategy_counts)
		
		# Overall metrics
		if total > 0:
			result.automated_resolution_rate = resolved_count / total
			
			# Overall confidence (average of resolved conflicts)
			if resolved_count > 0:
				total_confidence = sum(
					rc.final_resolution.confidence 
					for rc in result.resolved_conflicts 
					if rc.final_resolution
				)
				result.overall_confidence = total_confidence / resolved_count
		
		# Merge quality score
		if result.merge_successful:
			result.merge_quality_score = result.overall_confidence
		else:
			result.merge_quality_score = result.overall_confidence * 0.5
	
	async def _get_user_preferences(self, user_id: Optional[str]) -> UserPreferences:
		"""Get user preferences or create default."""
		if user_id and user_id in self.user_preferences:
			return self.user_preferences[user_id]
		
		# Return default preferences
		return UserPreferences(user_id=user_id or "anonymous")
	
	async def _initialize_default_rules(self) -> None:
		"""Initialize default resolution rules."""
		# Format conflict rules
		await self.add_resolution_rule(
			rule_name="Auto-resolve format conflicts",
			conflict_types=[ConflictType.FORMAT_CONFLICT],
			strategy=ResolutionStrategy.PREFER_NEWER,
			description="Automatically resolve formatting conflicts by preferring newer formatting",
			priority=200,
			severity_threshold=ConflictSeverity.MEDIUM
		)
		
		# Low-severity content overlap
		await self.add_resolution_rule(
			rule_name="Auto-merge low severity overlaps",
			conflict_types=[ConflictType.CONTENT_OVERLAP],
			strategy=ResolutionStrategy.AUTO_MERGE,
			description="Automatically merge low-severity content overlaps",
			priority=150,
			severity_threshold=ConflictSeverity.LOW
		)
		
		# Critical conflicts require manual review
		await self.add_resolution_rule(
			rule_name="Manual review for critical conflicts",
			conflict_types=[ConflictType.SEMANTIC_CONFLICT, ConflictType.CONTENT_OVERLAP],
			strategy=ResolutionStrategy.MANUAL_REVIEW,
			description="Require manual review for critical conflicts",
			priority=300,
			severity_threshold=ConflictSeverity.CRITICAL
		)
	
	async def get_resolution_statistics(self) -> Dict[str, Any]:
		"""Get resolver performance statistics."""
		return {
			"total_rules": len(self.resolution_rules),
			"enabled_rules": sum(1 for r in self.resolution_rules if r.enabled),
			"resolution_history_size": len(self.resolution_history),
			"rule_performance": dict(self.rule_performance),
			"semantic_resolution_enabled": self.semantic_resolution_enabled,
			"cached_strategies": len(self._strategy_cache),
			"cached_resolutions": len(self._resolution_cache)
		}