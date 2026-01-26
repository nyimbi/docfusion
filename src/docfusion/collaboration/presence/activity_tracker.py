"""
Activity tracking and analytics for collaborative document editing.

This module provides detailed activity logging, productivity metrics,
collaboration analytics, and activity-based notifications.
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

from pydantic import BaseModel, Field, ConfigDict

def uuid7str():
	"""Generate a UUID7-like string using UUID4 for compatibility."""
	return str(uuid.uuid4())


logger = logging.getLogger(__name__)


class ActivityType(str, Enum):
	"""Types of user activities to track."""
	DOCUMENT_OPEN = "document_open"
	DOCUMENT_CLOSE = "document_close"
	TEXT_INSERT = "text_insert"
	TEXT_DELETE = "text_delete"
	TEXT_FORMAT = "text_format"
	COMMENT_ADD = "comment_add"
	COMMENT_RESOLVE = "comment_resolve"
	SECTION_NAVIGATE = "section_navigate"
	CURSOR_MOVE = "cursor_move"
	SELECTION_CHANGE = "selection_change"
	COPY_TEXT = "copy_text"
	PASTE_TEXT = "paste_text"
	UNDO_ACTION = "undo_action"
	REDO_ACTION = "redo_action"
	SAVE_DOCUMENT = "save_document"
	BRANCH_CREATE = "branch_create"
	BRANCH_SWITCH = "branch_switch"
	MERGE_EXECUTE = "merge_execute"
	CONFLICT_RESOLVE = "conflict_resolve"
	TEMPLATE_APPLY = "template_apply"
	EXPORT_DOCUMENT = "export_document"
	SHARE_DOCUMENT = "share_document"
	PERMISSION_CHANGE = "permission_change"
	SESSION_START = "session_start"
	SESSION_END = "session_end"
	IDLE_START = "idle_start"
	IDLE_END = "idle_end"


class ActivityEvent(BaseModel):
	"""Individual activity event record."""
	model_config = ConfigDict(extra='forbid')
	
	event_id: str = Field(default_factory=uuid7str)
	document_id: str = Field(description="Document being worked on")
	user_id: str = Field(description="User performing activity")
	session_id: str = Field(description="User session identifier")
	activity_type: ActivityType = Field(description="Type of activity")
	timestamp: datetime = Field(default_factory=datetime.now)
	duration_ms: Optional[int] = Field(None, description="Activity duration in milliseconds")
	content_length: Optional[int] = Field(None, description="Content length affected")
	section_id: Optional[str] = Field(None, description="Document section involved")
	metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional activity data")
	productivity_score: Optional[float] = Field(None, description="Productivity contribution score")


class SessionSummary(BaseModel):
	"""Summary of user activity within a session."""
	model_config = ConfigDict(extra='forbid')
	
	session_id: str
	document_id: str
	user_id: str
	start_time: datetime
	end_time: Optional[datetime] = None
	total_duration_minutes: float = 0.0
	active_duration_minutes: float = 0.0
	idle_duration_minutes: float = 0.0
	
	# Activity counts
	total_activities: int = 0
	edit_activities: int = 0
	navigation_activities: int = 0
	collaboration_activities: int = 0
	
	# Content metrics
	characters_added: int = 0
	characters_deleted: int = 0
	net_characters: int = 0
	sections_worked: Set[str] = Field(default_factory=set)
	
	# Productivity metrics
	average_productivity_score: float = 0.0
	peak_productivity_period: Optional[Tuple[datetime, datetime]] = None
	focus_score: float = 0.0  # Based on session length and activity density


class ProductivityMetrics(BaseModel):
	"""Comprehensive productivity metrics for a user or document."""
	model_config = ConfigDict(extra='forbid')
	
	user_id: Optional[str] = None
	document_id: Optional[str] = None
	period_start: datetime
	period_end: datetime
	
	# Time metrics
	total_session_time_hours: float = 0.0
	active_editing_time_hours: float = 0.0
	collaboration_time_hours: float = 0.0
	
	# Activity metrics
	total_activities: int = 0
	activities_per_hour: float = 0.0
	most_productive_hour: Optional[int] = None
	least_productive_hour: Optional[int] = None
	
	# Content metrics
	total_characters_added: int = 0
	total_characters_deleted: int = 0
	net_contribution: int = 0
	words_per_minute: float = 0.0
	
	# Collaboration metrics
	comments_added: int = 0
	conflicts_resolved: int = 0
	sessions_count: int = 0
	average_session_duration: float = 0.0
	
	# Quality metrics
	average_productivity_score: float = 0.0
	consistency_score: float = 0.0  # How consistent activity levels are
	collaboration_score: float = 0.0  # Based on helpful collaboration activities


@dataclass
class ActivityFilter:
	"""Filter criteria for querying activities."""
	document_ids: Optional[Set[str]] = None
	user_ids: Optional[Set[str]] = None
	session_ids: Optional[Set[str]] = None
	activity_types: Optional[Set[ActivityType]] = None
	start_time: Optional[datetime] = None
	end_time: Optional[datetime] = None
	min_productivity_score: Optional[float] = None
	max_productivity_score: Optional[float] = None


class ActivityTracker:
	"""
	Comprehensive activity tracking and analytics system.
	
	Tracks all user activities in collaborative documents, provides
	productivity metrics, collaboration analytics, and insights.
	"""
	
	def __init__(self, storage_path: Optional[str] = None):
		self.activities: List[ActivityEvent] = []  # In-memory for demo, would use database
		self.active_sessions: Dict[str, datetime] = {}  # session_id -> start_time
		self.session_summaries: Dict[str, SessionSummary] = {}  # session_id -> summary
		self.activity_subscribers: List[callable] = []
		self.metrics_cache: Dict[str, ProductivityMetrics] = {}
		self.cache_ttl = 300  # 5 minutes
		self._lock = asyncio.Lock()
		
		# Productivity scoring weights
		self.activity_weights = {
			ActivityType.TEXT_INSERT: 1.0,
			ActivityType.TEXT_DELETE: 0.8,
			ActivityType.TEXT_FORMAT: 0.6,
			ActivityType.COMMENT_ADD: 0.9,
			ActivityType.COMMENT_RESOLVE: 0.7,
			ActivityType.CONFLICT_RESOLVE: 1.2,
			ActivityType.MERGE_EXECUTE: 1.1,
			ActivityType.BRANCH_CREATE: 0.8,
			ActivityType.SAVE_DOCUMENT: 0.3,
			ActivityType.CURSOR_MOVE: 0.1,
			ActivityType.SELECTION_CHANGE: 0.1,
			ActivityType.SECTION_NAVIGATE: 0.2
		}
		
		logger.info("ActivityTracker initialized")
	
	async def start_session(
		self,
		session_id: str,
		document_id: str,
		user_id: str
	) -> SessionSummary:
		"""
		Start tracking a new user session.
		
		Args:
			session_id: Session identifier
			document_id: Document being accessed
			user_id: User identifier
			
		Returns:
			SessionSummary: Created session summary
		"""
		async with self._lock:
			start_time = datetime.now()
			self.active_sessions[session_id] = start_time
			
			summary = SessionSummary(
				session_id=session_id,
				document_id=document_id,
				user_id=user_id,
				start_time=start_time
			)
			
			self.session_summaries[session_id] = summary
			
			# Log session start activity
			await self.log_activity(
				document_id=document_id,
				user_id=user_id,
				session_id=session_id,
				activity_type=ActivityType.SESSION_START,
				metadata={"session_start_time": start_time.isoformat()}
			)
			
			logger.info(f"Started tracking session {session_id} for user {user_id}")
			return summary
	
	async def end_session(self, session_id: str) -> Optional[SessionSummary]:
		"""
		End tracking for a user session.
		
		Args:
			session_id: Session identifier
			
		Returns:
			Optional[SessionSummary]: Updated session summary
		"""
		async with self._lock:
			if session_id not in self.session_summaries:
				logger.warning(f"Session {session_id} not found for ending")
				return None
			
			summary = self.session_summaries[session_id]
			end_time = datetime.now()
			summary.end_time = end_time
			
			if session_id in self.active_sessions:
				start_time = self.active_sessions[session_id]
				summary.total_duration_minutes = (end_time - start_time).total_seconds() / 60
				del self.active_sessions[session_id]
			
			# Calculate final session metrics
			await self._calculate_session_metrics(summary)
			
			# Log session end activity
			await self.log_activity(
				document_id=summary.document_id,
				user_id=summary.user_id,
				session_id=session_id,
				activity_type=ActivityType.SESSION_END,
				metadata={
					"session_end_time": end_time.isoformat(),
					"session_duration_minutes": summary.total_duration_minutes,
					"total_activities": summary.total_activities
				}
			)
			
			logger.info(f"Ended tracking session {session_id}, duration: {summary.total_duration_minutes:.1f} minutes")
			return summary
	
	async def log_activity(
		self,
		document_id: str,
		user_id: str,
		session_id: str,
		activity_type: ActivityType,
		duration_ms: Optional[int] = None,
		content_length: Optional[int] = None,
		section_id: Optional[str] = None,
		metadata: Optional[Dict[str, Any]] = None
	) -> ActivityEvent:
		"""
		Log a user activity event.
		
		Args:
			document_id: Document identifier
			user_id: User identifier
			session_id: Session identifier
			activity_type: Type of activity
			duration_ms: Activity duration in milliseconds
			content_length: Content length affected
			section_id: Document section involved
			metadata: Additional activity data
			
		Returns:
			ActivityEvent: Logged activity event
		"""
		async with self._lock:
			# Calculate productivity score
			productivity_score = self._calculate_productivity_score(
				activity_type, duration_ms, content_length
			)
			
			event = ActivityEvent(
				document_id=document_id,
				user_id=user_id,
				session_id=session_id,
				activity_type=activity_type,
				duration_ms=duration_ms,
				content_length=content_length,
				section_id=section_id,
				metadata=metadata or {},
				productivity_score=productivity_score
			)
			
			self.activities.append(event)
			
			# Update session summary
			if session_id in self.session_summaries:
				await self._update_session_summary(session_id, event)
			
			# Notify subscribers
			await self._notify_activity_subscribers(event)
			
			logger.debug(f"Logged activity {activity_type.value} for user {user_id}")
			return event
	
	async def get_activities(
		self,
		filter_criteria: Optional[ActivityFilter] = None,
		limit: Optional[int] = None,
		offset: int = 0
	) -> List[ActivityEvent]:
		"""
		Get activities matching filter criteria.
		
		Args:
			filter_criteria: Filter criteria
			limit: Maximum number of activities to return
			offset: Number of activities to skip
			
		Returns:
			List[ActivityEvent]: Matching activities
		"""
		filtered_activities = []
		
		for activity in self.activities:
			if self._matches_filter(activity, filter_criteria):
				filtered_activities.append(activity)
		
		# Sort by timestamp (most recent first)
		filtered_activities.sort(key=lambda a: a.timestamp, reverse=True)
		
		# Apply offset and limit
		start_idx = offset
		end_idx = start_idx + limit if limit else None
		
		return filtered_activities[start_idx:end_idx]
	
	async def get_session_summary(self, session_id: str) -> Optional[SessionSummary]:
		"""
		Get session summary.
		
		Args:
			session_id: Session identifier
			
		Returns:
			Optional[SessionSummary]: Session summary if found
		"""
		return self.session_summaries.get(session_id)
	
	async def get_user_productivity_metrics(
		self,
		user_id: str,
		period_start: Optional[datetime] = None,
		period_end: Optional[datetime] = None
	) -> ProductivityMetrics:
		"""
		Calculate productivity metrics for a user.
		
		Args:
			user_id: User identifier
			period_start: Start of analysis period
			period_end: End of analysis period
			
		Returns:
			ProductivityMetrics: User productivity metrics
		"""
		if not period_start:
			period_start = datetime.now() - timedelta(days=7)
		if not period_end:
			period_end = datetime.now()
		
		cache_key = f"user_{user_id}_{period_start.isoformat()}_{period_end.isoformat()}"
		
		# Check cache
		if cache_key in self.metrics_cache:
			cached_metrics = self.metrics_cache[cache_key]
			if (datetime.now() - cached_metrics.period_end).total_seconds() < self.cache_ttl:
				return cached_metrics
		
		# Calculate metrics
		filter_criteria = ActivityFilter(
			user_ids={user_id},
			start_time=period_start,
			end_time=period_end
		)
		
		activities = await self.get_activities(filter_criteria)
		metrics = await self._calculate_productivity_metrics(
			activities, user_id=user_id, period_start=period_start, period_end=period_end
		)
		
		# Cache results
		self.metrics_cache[cache_key] = metrics
		
		return metrics
	
	async def get_document_productivity_metrics(
		self,
		document_id: str,
		period_start: Optional[datetime] = None,
		period_end: Optional[datetime] = None
	) -> ProductivityMetrics:
		"""
		Calculate productivity metrics for a document.
		
		Args:
			document_id: Document identifier
			period_start: Start of analysis period
			period_end: End of analysis period
			
		Returns:
			ProductivityMetrics: Document productivity metrics
		"""
		if not period_start:
			period_start = datetime.now() - timedelta(days=7)
		if not period_end:
			period_end = datetime.now()
		
		cache_key = f"doc_{document_id}_{period_start.isoformat()}_{period_end.isoformat()}"
		
		# Check cache
		if cache_key in self.metrics_cache:
			cached_metrics = self.metrics_cache[cache_key]
			if (datetime.now() - cached_metrics.period_end).total_seconds() < self.cache_ttl:
				return cached_metrics
		
		# Calculate metrics
		filter_criteria = ActivityFilter(
			document_ids={document_id},
			start_time=period_start,
			end_time=period_end
		)
		
		activities = await self.get_activities(filter_criteria)
		metrics = await self._calculate_productivity_metrics(
			activities, document_id=document_id, period_start=period_start, period_end=period_end
		)
		
		# Cache results
		self.metrics_cache[cache_key] = metrics
		
		return metrics
	
	async def get_collaboration_analytics(
		self,
		document_id: str,
		period_start: Optional[datetime] = None,
		period_end: Optional[datetime] = None
	) -> Dict[str, Any]:
		"""
		Get collaboration analytics for a document.
		
		Args:
			document_id: Document identifier
			period_start: Start of analysis period
			period_end: End of analysis period
			
		Returns:
			Dict[str, Any]: Collaboration analytics
		"""
		if not period_start:
			period_start = datetime.now() - timedelta(days=7)
		if not period_end:
			period_end = datetime.now()
		
		filter_criteria = ActivityFilter(
			document_ids={document_id},
			start_time=period_start,
			end_time=period_end
		)
		
		activities = await self.get_activities(filter_criteria)
		
		# Analyze collaboration patterns
		user_activity_counts = {}
		collaboration_activities = []
		peak_collaboration_times = {}
		
		for activity in activities:
			user_id = activity.user_id
			if user_id not in user_activity_counts:
				user_activity_counts[user_id] = 0
			user_activity_counts[user_id] += 1
			
			if activity.activity_type in [
				ActivityType.COMMENT_ADD,
				ActivityType.COMMENT_RESOLVE,
				ActivityType.CONFLICT_RESOLVE,
				ActivityType.MERGE_EXECUTE
			]:
				collaboration_activities.append(activity)
			
			# Track activity by hour for peak time analysis
			hour = activity.timestamp.hour
			if hour not in peak_collaboration_times:
				peak_collaboration_times[hour] = 0
			peak_collaboration_times[hour] += 1
		
		# Find most active collaborators
		top_collaborators = sorted(
			user_activity_counts.items(),
			key=lambda x: x[1],
			reverse=True
		)[:5]
		
		# Find peak collaboration hour
		peak_hour = max(peak_collaboration_times.items(), key=lambda x: x[1])[0] if peak_collaboration_times else None
		
		return {
			"document_id": document_id,
			"period_start": period_start.isoformat(),
			"period_end": period_end.isoformat(),
			"total_activities": len(activities),
			"collaboration_activities": len(collaboration_activities),
			"unique_collaborators": len(user_activity_counts),
			"top_collaborators": [{"user_id": uid, "activity_count": count} for uid, count in top_collaborators],
			"peak_collaboration_hour": peak_hour,
			"collaboration_density": len(collaboration_activities) / max(len(activities), 1),
			"activity_by_hour": peak_collaboration_times
		}
	
	async def subscribe_to_activities(self, callback: callable) -> str:
		"""
		Subscribe to activity notifications.
		
		Args:
			callback: Callback function for activity events
			
		Returns:
			str: Subscription ID
		"""
		self.activity_subscribers.append(callback)
		subscription_id = uuid7str()
		logger.info("New activity subscription added")
		return subscription_id
	
	async def unsubscribe_from_activities(self, callback: callable) -> bool:
		"""
		Unsubscribe from activity notifications.
		
		Args:
			callback: Callback function to remove
			
		Returns:
			bool: True if subscription was removed
		"""
		try:
			self.activity_subscribers.remove(callback)
			return True
		except ValueError:
			return False
	
	def _calculate_productivity_score(
		self,
		activity_type: ActivityType,
		duration_ms: Optional[int],
		content_length: Optional[int]
	) -> float:
		"""Calculate productivity score for an activity."""
		base_score = self.activity_weights.get(activity_type, 0.5)
		
		# Adjust based on content length
		if content_length and activity_type in [ActivityType.TEXT_INSERT, ActivityType.TEXT_DELETE]:
			# More content = higher productivity for content activities
			content_multiplier = min(content_length / 100, 2.0)  # Cap at 2x
			base_score *= content_multiplier
		
		# Adjust based on duration (faster = more productive for some activities)
		if duration_ms and activity_type in [ActivityType.TEXT_INSERT, ActivityType.TEXT_FORMAT]:
			if duration_ms < 5000:  # Under 5 seconds is efficient
				base_score *= 1.2
			elif duration_ms > 30000:  # Over 30 seconds might indicate struggle
				base_score *= 0.8
		
		return round(base_score, 2)
	
	async def _update_session_summary(self, session_id: str, event: ActivityEvent):
		"""Update session summary with new activity."""
		summary = self.session_summaries[session_id]
		
		summary.total_activities += 1
		
		# Categorize activity
		if event.activity_type in [
			ActivityType.TEXT_INSERT, ActivityType.TEXT_DELETE, ActivityType.TEXT_FORMAT,
			ActivityType.UNDO_ACTION, ActivityType.REDO_ACTION
		]:
			summary.edit_activities += 1
		elif event.activity_type in [
			ActivityType.SECTION_NAVIGATE, ActivityType.CURSOR_MOVE, ActivityType.SELECTION_CHANGE
		]:
			summary.navigation_activities += 1
		elif event.activity_type in [
			ActivityType.COMMENT_ADD, ActivityType.COMMENT_RESOLVE,
			ActivityType.CONFLICT_RESOLVE, ActivityType.MERGE_EXECUTE
		]:
			summary.collaboration_activities += 1
		
		# Track content changes
		if event.activity_type == ActivityType.TEXT_INSERT and event.content_length:
			summary.characters_added += event.content_length
		elif event.activity_type == ActivityType.TEXT_DELETE and event.content_length:
			summary.characters_deleted += event.content_length
		
		# Track sections worked
		if event.section_id:
			summary.sections_worked.add(event.section_id)
		
		# Update productivity score
		if event.productivity_score:
			current_avg = summary.average_productivity_score
			total_activities = summary.total_activities
			summary.average_productivity_score = (
				(current_avg * (total_activities - 1) + event.productivity_score) / total_activities
			)
	
	async def _calculate_session_metrics(self, summary: SessionSummary):
		"""Calculate final metrics for a completed session."""
		summary.net_characters = summary.characters_added - summary.characters_deleted
		
		# Calculate focus score based on activity density and session length
		if summary.total_duration_minutes > 0:
			activity_density = summary.total_activities / summary.total_duration_minutes
			if activity_density > 0:
				# Good focus = consistent activity throughout session
				summary.focus_score = min(activity_density * 0.1, 1.0)
		
		logger.debug(f"Calculated session metrics for {summary.session_id}")
	
	async def _calculate_productivity_metrics(
		self,
		activities: List[ActivityEvent],
		user_id: Optional[str] = None,
		document_id: Optional[str] = None,
		period_start: datetime = None,
		period_end: datetime = None
	) -> ProductivityMetrics:
		"""Calculate comprehensive productivity metrics."""
		if not activities:
			return ProductivityMetrics(
				user_id=user_id,
				document_id=document_id,
				period_start=period_start,
				period_end=period_end
			)
		
		# Time calculations
		total_time_hours = 0.0
		active_editing_time_hours = 0.0
		collaboration_time_hours = 0.0
		
		# Activity analysis
		activity_counts = {}
		hourly_activity = {}
		total_chars_added = 0
		total_chars_deleted = 0
		comments_count = 0
		conflicts_resolved = 0
		
		# Get session summaries for time calculations
		session_ids = {activity.session_id for activity in activities}
		for session_id in session_ids:
			if session_id in self.session_summaries:
				summary = self.session_summaries[session_id]
				total_time_hours += summary.total_duration_minutes / 60
				active_editing_time_hours += summary.active_duration_minutes / 60
		
		for activity in activities:
			activity_type = activity.activity_type
			if activity_type not in activity_counts:
				activity_counts[activity_type] = 0
			activity_counts[activity_type] += 1
			
			# Track by hour
			hour = activity.timestamp.hour
			if hour not in hourly_activity:
				hourly_activity[hour] = 0
			hourly_activity[hour] += 1
			
			# Content metrics
			if activity_type == ActivityType.TEXT_INSERT and activity.content_length:
				total_chars_added += activity.content_length
			elif activity_type == ActivityType.TEXT_DELETE and activity.content_length:
				total_chars_deleted += activity.content_length
			
			# Collaboration metrics
			if activity_type == ActivityType.COMMENT_ADD:
				comments_count += 1
			elif activity_type == ActivityType.CONFLICT_RESOLVE:
				conflicts_resolved += 1
			
			# Track collaboration time
			if activity_type in [
				ActivityType.COMMENT_ADD, ActivityType.COMMENT_RESOLVE,
				ActivityType.CONFLICT_RESOLVE, ActivityType.MERGE_EXECUTE
			]:
				collaboration_time_hours += (activity.duration_ms or 1000) / 3600000
		
		# Calculate derived metrics
		activities_per_hour = len(activities) / max(total_time_hours, 0.1)
		net_contribution = total_chars_added - total_chars_deleted
		words_per_minute = (total_chars_added / 5) / max(total_time_hours * 60, 1)  # Assume 5 chars per word
		
		# Find most/least productive hours
		most_productive_hour = max(hourly_activity.items(), key=lambda x: x[1])[0] if hourly_activity else None
		least_productive_hour = min(hourly_activity.items(), key=lambda x: x[1])[0] if hourly_activity else None
		
		# Calculate quality scores
		productivity_scores = [a.productivity_score for a in activities if a.productivity_score]
		avg_productivity_score = sum(productivity_scores) / len(productivity_scores) if productivity_scores else 0.0
		
		# Consistency score based on variance in hourly activity
		hourly_values = list(hourly_activity.values())
		if len(hourly_values) > 1:
			mean_activity = sum(hourly_values) / len(hourly_values)
			variance = sum((x - mean_activity) ** 2 for x in hourly_values) / len(hourly_values)
			consistency_score = max(0, 1 - (variance / (mean_activity + 1)))
		else:
			consistency_score = 1.0
		
		# Collaboration score
		collaboration_score = min(
			(comments_count * 0.1 + conflicts_resolved * 0.2 + collaboration_time_hours * 0.1),
			1.0
		)
		
		return ProductivityMetrics(
			user_id=user_id,
			document_id=document_id,
			period_start=period_start,
			period_end=period_end,
			total_session_time_hours=total_time_hours,
			active_editing_time_hours=active_editing_time_hours,
			collaboration_time_hours=collaboration_time_hours,
			total_activities=len(activities),
			activities_per_hour=activities_per_hour,
			most_productive_hour=most_productive_hour,
			least_productive_hour=least_productive_hour,
			total_characters_added=total_chars_added,
			total_characters_deleted=total_chars_deleted,
			net_contribution=net_contribution,
			words_per_minute=words_per_minute,
			comments_added=comments_count,
			conflicts_resolved=conflicts_resolved,
			sessions_count=len(session_ids),
			average_session_duration=total_time_hours / max(len(session_ids), 1),
			average_productivity_score=avg_productivity_score,
			consistency_score=consistency_score,
			collaboration_score=collaboration_score
		)
	
	def _matches_filter(
		self,
		activity: ActivityEvent,
		filter_criteria: Optional[ActivityFilter]
	) -> bool:
		"""Check if activity matches filter criteria."""
		if not filter_criteria:
			return True
		
		if (filter_criteria.document_ids and 
			activity.document_id not in filter_criteria.document_ids):
			return False
		
		if (filter_criteria.user_ids and 
			activity.user_id not in filter_criteria.user_ids):
			return False
		
		if (filter_criteria.session_ids and 
			activity.session_id not in filter_criteria.session_ids):
			return False
		
		if (filter_criteria.activity_types and 
			activity.activity_type not in filter_criteria.activity_types):
			return False
		
		if (filter_criteria.start_time and 
			activity.timestamp < filter_criteria.start_time):
			return False
		
		if (filter_criteria.end_time and 
			activity.timestamp > filter_criteria.end_time):
			return False
		
		if (filter_criteria.min_productivity_score and 
			(not activity.productivity_score or activity.productivity_score < filter_criteria.min_productivity_score)):
			return False
		
		if (filter_criteria.max_productivity_score and 
			(not activity.productivity_score or activity.productivity_score > filter_criteria.max_productivity_score)):
			return False
		
		return True
	
	async def _notify_activity_subscribers(self, event: ActivityEvent):
		"""Notify subscribers of new activity."""
		for callback in self.activity_subscribers:
			try:
				if asyncio.iscoroutinefunction(callback):
					await callback(event)
				else:
					callback(event)
			except Exception as e:
				logger.error(f"Error in activity callback: {e}")
	
	async def cleanup(self):
		"""Clean up activity tracker resources."""
		async with self._lock:
			self.activities.clear()
			self.active_sessions.clear()
			self.session_summaries.clear()
			self.activity_subscribers.clear()
			self.metrics_cache.clear()
		
		logger.info("ActivityTracker cleaned up")