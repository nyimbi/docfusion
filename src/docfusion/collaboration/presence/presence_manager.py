"""
Real-time user presence management for collaborative documents.

This module handles user presence tracking, cursor position sharing,
activity status management, and session coordination.
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Callable

from pydantic import BaseModel, Field, ConfigDict
from ...core.utils import uuid7str

logger = logging.getLogger(__name__)

class PresenceStatus(str, Enum):
	"""User presence status enumeration."""
	ONLINE = "online"
	EDITING = "editing"
	VIEWING = "viewing"
	REVIEWING = "reviewing"
	IDLE = "idle"
	OFFLINE = "offline"

class CursorPosition(BaseModel):
	"""User cursor position information."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	position: int = Field(description="Character position in document")
	selection_start: Optional[int] = Field(None, description="Start of selection")
	selection_end: Optional[int] = Field(None, description="End of selection")
	line: Optional[int] = Field(None, description="Line number")
	column: Optional[int] = Field(None, description="Column number")
	last_updated: datetime = Field(default_factory=datetime.now)

class UserPresence(BaseModel):
	"""User presence information."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	user_id: str = Field(description="Unique user identifier")
	user_name: str = Field(description="Display name")
	status: PresenceStatus = Field(PresenceStatus.OFFLINE)
	cursor_position: Optional[CursorPosition] = None
	active_section: Optional[str] = Field(None, description="Current section being edited")
	last_activity: datetime = Field(default_factory=datetime.now)
	session_id: str = Field(default_factory=uuid7str)
	avatar_url: Optional[str] = None
	color: Optional[str] = None  # For displaying user cursors/highlights

class UserSession(BaseModel):
	"""Complete user session information."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	session_id: str = Field(default_factory=uuid7str)
	document_id: str = Field(description="Document being accessed")
	user_id: str = Field(description="User identifier")
	user_name: str = Field(description="Display name")
	presence: UserPresence
	permissions: Set[str] = Field(default_factory=set)
	connected_at: datetime = Field(default_factory=datetime.now)
	last_seen: datetime = Field(default_factory=datetime.now)
	is_online: bool = True
	active_branch: Optional[str] = Field("main", description="Current working branch")
	websocket_id: Optional[str] = None  # For WebSocket connection tracking

@dataclass
class PresenceUpdate:
	"""Presence update event."""
	session_id: str
	user_id: str
	update_type: str  # status, cursor, section, etc.
	data: Dict[str, Any]
	timestamp: datetime = field(default_factory=datetime.now)

class PresenceManager:
	"""
	Manages real-time user presence for collaborative documents.
	
	Provides comprehensive presence tracking including cursor positions,
	activity status, session management, and real-time notifications.
	"""
	
	def __init__(self):
		self.active_sessions: Dict[str, UserSession] = {}  # session_id -> UserSession
		self.document_sessions: Dict[str, Set[str]] = {}  # document_id -> set of session_ids
		self.user_sessions: Dict[str, Set[str]] = {}  # user_id -> set of session_ids
		self.presence_subscribers: Dict[str, List[Callable]] = {}  # document_id -> callbacks
		self.cleanup_task: Optional[asyncio.Task] = None
		self.idle_threshold = 300  # 5 minutes
		self.offline_threshold = 600  # 10 minutes
		self._lock = asyncio.Lock()
		
		# User colors for cursor display (predefined palette)
		self.user_colors = [
			"#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
			"#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"
		]
		self.color_assignments: Dict[str, str] = {}
		
		logger.info("PresenceManager initialized")
	
	async def start_cleanup_task(self):
		"""Start background cleanup task for inactive sessions."""
		if self.cleanup_task is None:
			self.cleanup_task = asyncio.create_task(self._cleanup_inactive_sessions())
			logger.info("Presence cleanup task started")
	
	async def stop_cleanup_task(self):
		"""Stop background cleanup task."""
		if self.cleanup_task:
			self.cleanup_task.cancel()
			try:
				await self.cleanup_task
			except asyncio.CancelledError:
				pass
			self.cleanup_task = None
			logger.info("Presence cleanup task stopped")
	
	async def add_user_to_document(
		self,
		document_id: str,
		user_id: str,
		user_name: str,
		permissions: Optional[Set[str]] = None,
		websocket_id: Optional[str] = None,
		avatar_url: Optional[str] = None
	) -> UserSession:
		"""
		Add user to document collaboration session.
		
		Args:
			document_id: Target document ID
			user_id: User identifier
			user_name: Display name
			permissions: User permissions set
			websocket_id: WebSocket connection ID
			avatar_url: User avatar URL
			
		Returns:
			UserSession: Created user session
		"""
		async with self._lock:
			# Assign user color if not already assigned
			if user_id not in self.color_assignments:
				used_colors = set(self.color_assignments.values())
				available_colors = [c for c in self.user_colors if c not in used_colors]
				if available_colors:
					self.color_assignments[user_id] = available_colors[0]
				else:
					# Reuse colors if all are taken
					self.color_assignments[user_id] = self.user_colors[len(self.color_assignments) % len(self.user_colors)]
			
			# Create user presence
			presence = UserPresence(
				user_id=user_id,
				user_name=user_name,
				status=PresenceStatus.ONLINE,
				color=self.color_assignments[user_id],
				avatar_url=avatar_url
			)
			
			# Create user session
			session = UserSession(
				document_id=document_id,
				user_id=user_id,
				user_name=user_name,
				presence=presence,
				permissions=permissions or {"read"},
				websocket_id=websocket_id
			)
			
			# Store session
			self.active_sessions[session.session_id] = session
			
			# Track document sessions
			if document_id not in self.document_sessions:
				self.document_sessions[document_id] = set()
			self.document_sessions[document_id].add(session.session_id)
			
			# Track user sessions
			if user_id not in self.user_sessions:
				self.user_sessions[user_id] = set()
			self.user_sessions[user_id].add(session.session_id)
			
			logger.info(f"User {user_name} added to document {document_id}")
			
			# Notify subscribers
			await self._notify_presence_update(document_id, PresenceUpdate(
				session_id=session.session_id,
				user_id=user_id,
				update_type="user_joined",
				data={"user_name": user_name, "status": PresenceStatus.ONLINE.value}
			))
			
			return session
	
	async def remove_user_from_document(self, session_id: str) -> bool:
		"""
		Remove user from document collaboration session.
		
		Args:
			session_id: Session identifier
			
		Returns:
			bool: True if session was removed
		"""
		async with self._lock:
			if session_id not in self.active_sessions:
				return False
			
			session = self.active_sessions[session_id]
			document_id = session.document_id
			user_id = session.user_id
			user_name = session.user_name
			
			# Remove from tracking
			del self.active_sessions[session_id]
			
			if document_id in self.document_sessions:
				self.document_sessions[document_id].discard(session_id)
				if not self.document_sessions[document_id]:
					del self.document_sessions[document_id]
			
			if user_id in self.user_sessions:
				self.user_sessions[user_id].discard(session_id)
				if not self.user_sessions[user_id]:
					del self.user_sessions[user_id]
			
			logger.info(f"User {user_name} removed from document {document_id}")
			
			# Notify subscribers
			await self._notify_presence_update(document_id, PresenceUpdate(
				session_id=session_id,
				user_id=user_id,
				update_type="user_left",
				data={"user_name": user_name}
			))
			
			return True
	
	async def update_user_status(
		self,
		session_id: str,
		status: PresenceStatus,
		cursor_position: Optional[CursorPosition] = None,
		active_section: Optional[str] = None
	) -> bool:
		"""
		Update user presence status and activity.
		
		Args:
			session_id: Session identifier
			status: New presence status
			cursor_position: Current cursor position
			active_section: Currently active section
			
		Returns:
			bool: True if update was successful
		"""
		async with self._lock:
			if session_id not in self.active_sessions:
				logger.warning(f"Session {session_id} not found for status update")
				return False
			
			session = self.active_sessions[session_id]
			old_status = session.presence.status
			
			# Update presence
			session.presence.status = status
			session.presence.last_activity = datetime.now()
			session.last_seen = datetime.now()
			
			if cursor_position:
				session.presence.cursor_position = cursor_position
			
			if active_section is not None:
				session.presence.active_section = active_section
			
			# Update online status
			session.is_online = status != PresenceStatus.OFFLINE
			
			logger.debug(f"Updated status for {session.user_name}: {old_status} -> {status}")
			
			# Notify subscribers if status changed
			if old_status != status:
				await self._notify_presence_update(session.document_id, PresenceUpdate(
					session_id=session_id,
					user_id=session.user_id,
					update_type="status_changed",
					data={
						"old_status": old_status.value,
						"new_status": status.value,
						"cursor_position": cursor_position.dict() if cursor_position else None,
						"active_section": active_section
					}
				))
			
			return True
	
	async def update_cursor_position(
		self,
		session_id: str,
		position: int,
		selection_start: Optional[int] = None,
		selection_end: Optional[int] = None,
		line: Optional[int] = None,
		column: Optional[int] = None
	) -> bool:
		"""
		Update user cursor position for real-time awareness.
		
		Args:
			session_id: Session identifier
			position: Character position
			selection_start: Selection start position
			selection_end: Selection end position
			line: Line number
			column: Column number
			
		Returns:
			bool: True if update was successful
		"""
		async with self._lock:
			if session_id not in self.active_sessions:
				return False
			
			session = self.active_sessions[session_id]
			
			cursor_position = CursorPosition(
				position=position,
				selection_start=selection_start,
				selection_end=selection_end,
				line=line,
				column=column
			)
			
			session.presence.cursor_position = cursor_position
			session.presence.last_activity = datetime.now()
			session.last_seen = datetime.now()
			
			# Auto-update status to editing if user is actively moving cursor
			if session.presence.status == PresenceStatus.VIEWING:
				session.presence.status = PresenceStatus.EDITING
			
			# Notify subscribers (throttled for cursor updates)
			await self._notify_presence_update(session.document_id, PresenceUpdate(
				session_id=session_id,
				user_id=session.user_id,
				update_type="cursor_moved",
				data={
					"position": position,
					"selection_start": selection_start,
					"selection_end": selection_end,
					"line": line,
					"column": column
				}
			), throttle=True)
			
			return True
	
	async def get_active_users(self, document_id: str) -> List[UserSession]:
		"""
		Get all active users for a document.
		
		Args:
			document_id: Document identifier
			
		Returns:
			List[UserSession]: Active user sessions
		"""
		async with self._lock:
			if document_id not in self.document_sessions:
				return []
			
			active_users = []
			for session_id in self.document_sessions[document_id]:
				if session_id in self.active_sessions:
					session = self.active_sessions[session_id]
					# Update idle status based on last activity
					await self._update_idle_status(session)
					active_users.append(session)
			
			return sorted(active_users, key=lambda s: s.presence.last_activity, reverse=True)
	
	async def get_user_session(self, session_id: str) -> Optional[UserSession]:
		"""
		Get specific user session.
		
		Args:
			session_id: Session identifier
			
		Returns:
			Optional[UserSession]: User session if found
		"""
		return self.active_sessions.get(session_id)
	
	async def subscribe_to_presence_updates(
		self,
		document_id: str,
		callback: Callable[[PresenceUpdate], None]
	) -> str:
		"""
		Subscribe to presence updates for a document.
		
		Args:
			document_id: Document identifier
			callback: Callback function for updates
			
		Returns:
			str: Subscription ID
		"""
		if document_id not in self.presence_subscribers:
			self.presence_subscribers[document_id] = []
		
		self.presence_subscribers[document_id].append(callback)
		subscription_id = uuid7str()
		
		logger.info(f"New presence subscription for document {document_id}")
		return subscription_id
	
	async def unsubscribe_from_presence_updates(
		self,
		document_id: str,
		callback: Callable[[PresenceUpdate], None]
	) -> bool:
		"""
		Unsubscribe from presence updates.
		
		Args:
			document_id: Document identifier
			callback: Callback function to remove
			
		Returns:
			bool: True if subscription was removed
		"""
		if document_id in self.presence_subscribers:
			try:
				self.presence_subscribers[document_id].remove(callback)
				return True
			except ValueError:
				logger.warning(f"Callback not found in subscribers for document {document_id}")
		return False
	
	async def get_presence_statistics(self, document_id: str) -> Dict[str, Any]:
		"""
		Get presence statistics for a document.
		
		Args:
			document_id: Document identifier
			
		Returns:
			Dict[str, Any]: Presence statistics
		"""
		users = await self.get_active_users(document_id)
		
		status_counts = {}
		for status in PresenceStatus:
			status_counts[status.value] = 0
		
		total_users = len(users)
		online_users = 0
		editing_users = 0
		
		for user in users:
			status_counts[user.presence.status.value] += 1
			if user.is_online:
				online_users += 1
			if user.presence.status == PresenceStatus.EDITING:
				editing_users += 1
		
		return {
			"document_id": document_id,
			"total_users": total_users,
			"online_users": online_users,
			"editing_users": editing_users,
			"status_breakdown": status_counts,
			"timestamp": datetime.now().isoformat()
		}
	
	async def get_global_presence_statistics(self) -> Dict[str, Any]:
		"""
		Get global presence statistics across all documents.
		
		Returns:
			Dict[str, Any]: Global presence statistics
		"""
		total_sessions = len(self.active_sessions)
		total_documents = len(self.document_sessions)
		total_users = len(self.user_sessions)
		
		status_counts = {}
		for status in PresenceStatus:
			status_counts[status.value] = 0
		
		online_sessions = 0
		for session in self.active_sessions.values():
			status_counts[session.presence.status.value] += 1
			if session.is_online:
				online_sessions += 1
		
		return {
			"total_sessions": total_sessions,
			"total_documents": total_documents,
			"total_users": total_users,
			"online_sessions": online_sessions,
			"status_breakdown": status_counts,
			"timestamp": datetime.now().isoformat()
		}
	
	async def _notify_presence_update(
		self,
		document_id: str,
		update: PresenceUpdate,
		throttle: bool = False
	):
		"""Notify subscribers of presence updates."""
		if document_id in self.presence_subscribers:
			for callback in self.presence_subscribers[document_id]:
				try:
					if asyncio.iscoroutinefunction(callback):
						await callback(update)
					else:
						callback(update)
				except Exception as e:
					logger.error(f"Error in presence update callback: {e}")
	
	async def _update_idle_status(self, session: UserSession):
		"""Update session idle status based on last activity."""
		now = datetime.now()
		time_since_activity = (now - session.presence.last_activity).total_seconds()
		
		if time_since_activity > self.offline_threshold:
			if session.presence.status != PresenceStatus.OFFLINE:
				session.presence.status = PresenceStatus.OFFLINE
				session.is_online = False
		elif time_since_activity > self.idle_threshold:
			if session.presence.status in [PresenceStatus.ONLINE, PresenceStatus.EDITING, PresenceStatus.VIEWING]:
				session.presence.status = PresenceStatus.IDLE
	
	async def _cleanup_inactive_sessions(self):
		"""Background task to clean up inactive sessions."""
		while True:
			try:
				await asyncio.sleep(60)  # Check every minute
				
				now = datetime.now()
				inactive_sessions = []
				
				async with self._lock:
					for session_id, session in self.active_sessions.items():
						time_since_activity = (now - session.last_seen).total_seconds()
						
						# Mark as offline after timeout
						if time_since_activity > self.offline_threshold:
							if session.is_online:
								session.presence.status = PresenceStatus.OFFLINE
								session.is_online = False
								await self._notify_presence_update(session.document_id, PresenceUpdate(
									session_id=session_id,
									user_id=session.user_id,
									update_type="user_offline",
									data={"user_name": session.user_name}
								))
						
						# Remove completely inactive sessions after 24 hours
						if time_since_activity > 86400:
							inactive_sessions.append(session_id)
				
				# Remove inactive sessions
				for session_id in inactive_sessions:
					await self.remove_user_from_document(session_id)
					logger.info(f"Removed inactive session: {session_id}")
				
			except Exception as e:
				logger.error(f"Error in presence cleanup task: {e}")
				await asyncio.sleep(60)
	
	async def cleanup(self):
		"""Clean up presence manager resources."""
		await self.stop_cleanup_task()
		
		async with self._lock:
			self.active_sessions.clear()
			self.document_sessions.clear()
			self.user_sessions.clear()
			self.presence_subscribers.clear()
			self.color_assignments.clear()
		
		logger.info("PresenceManager cleaned up")