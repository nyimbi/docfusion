"""
Collaborative Editor Module

Real-time collaborative document editing with CRDT (Conflict-free Replicated Data Type)
support, WebSocket synchronization, and multi-user presence awareness.

Simple, understandable API for real-time collaboration.
"""

from typing import Any, Dict, List, Optional, Set, Callable
from dataclasses import dataclass, field
from enum import Enum
import asyncio
import logging
import time
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from ...core.utils import uuid7str

logger = logging.getLogger(__name__)

class OperationType(Enum):
	"""Types of collaborative operations"""
	INSERT = "insert"
	DELETE = "delete"
	RETAIN = "retain"
	FORMAT = "format"
	COMMENT = "comment"

class UserPresence(Enum):
	"""User presence states"""
	ONLINE = "online"
	EDITING = "editing"
	VIEWING = "viewing"
	IDLE = "idle"
	OFFLINE = "offline"

@dataclass
class Operation:
	"""Individual collaborative operation (CRDT delta)"""
	op_id: str = field(default_factory=uuid7str)
	op_type: OperationType = OperationType.INSERT
	position: int = 0
	length: int = 0
	content: str = ""
	attributes: Dict[str, Any] = field(default_factory=dict)
	author_id: str = ""
	timestamp: float = field(default_factory=time.time)
	vector_clock: Dict[str, int] = field(default_factory=dict)

@dataclass
class CursorPosition:
	"""User cursor position and selection"""
	user_id: str = ""
	position: int = 0
	selection_start: int = 0
	selection_end: int = 0
	last_updated: float = field(default_factory=time.time)

@dataclass
class Comment:
	"""Document comment/annotation"""
	comment_id: str = field(default_factory=uuid7str)
	position: int = 0
	length: int = 0
	text: str = ""
	author_id: str = ""
	created_at: datetime = field(default_factory=datetime.now)
	resolved: bool = False
	replies: List['Comment'] = field(default_factory=list)

@dataclass
class User:
	"""Collaborative user"""
	user_id: str = field(default_factory=uuid7str)
	name: str = ""
	email: str = ""
	avatar_url: str = ""
	presence: UserPresence = UserPresence.OFFLINE
	cursor: Optional[CursorPosition] = None
	last_activity: datetime = field(default_factory=datetime.now)
	permissions: Set[str] = field(default_factory=set)

class DocumentState(BaseModel):
	"""Current document state with collaborative metadata"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True, validate_default=True)
	
	document_id: str = Field(default_factory=uuid7str)
	content: str = ""
	operations: List[Operation] = Field(default_factory=list)
	vector_clock: Dict[str, int] = Field(default_factory=dict)
	users: Dict[str, User] = Field(default_factory=dict)
	cursors: Dict[str, CursorPosition] = Field(default_factory=dict)
	comments: Dict[str, Comment] = Field(default_factory=dict)
	last_modified: datetime = Field(default_factory=datetime.now)
	version: int = 0

class CollaborativeEditor:
	"""
	Real-time collaborative document editor with simple API.
	
	Provides CRDT-based conflict resolution, real-time synchronization,
	and multi-user presence awareness through WebSockets.
	
	Simple usage:
	```python
	editor = CollaborativeEditor(document_id="doc123")
	await editor.add_user("user1", "Alice")
	await editor.insert_text("user1", 0, "Hello World")
	await editor.add_comment("user1", 6, 5, "Check this")
	```
	"""
	
	def __init__(
		self,
		document_id: str,
		initial_content: str = "",
		websocket_handler: Optional[Callable] = None
	):
		self.document_id = document_id
		self.state = DocumentState(
			document_id=document_id,
			content=initial_content
		)
		
		# Real-time synchronization
		self.websocket_handler = websocket_handler
		self.subscribers: Dict[str, Callable] = {}
		
		# Operation history for undo/redo
		self.operation_history: List[Operation] = []
		self.undo_stack: Dict[str, List[Operation]] = {}  # Per user
		self.redo_stack: Dict[str, List[Operation]] = {}  # Per user
		
		# Performance optimization
		self._operation_cache: Dict[str, Operation] = {}
		self._last_sync: float = time.time()
		
		# Thread safety
		self._lock = asyncio.Lock()
	
	async def add_user(
		self,
		user_id: str,
		name: str,
		email: str = "",
		avatar_url: str = "",
		permissions: Optional[Set[str]] = None
	) -> User:
		"""
		Add a user to the collaborative session.
		
		Simple API - just provide user ID and name.
		"""
		async with self._lock:
			user = User(
				user_id=user_id,
				name=name,
				email=email,
				avatar_url=avatar_url,
				presence=UserPresence.ONLINE,
				permissions=permissions or {"read", "write"}
			)
			
			self.state.users[user_id] = user
			
			# Initialize user-specific stacks
			self.undo_stack[user_id] = []
			self.redo_stack[user_id] = []
			
			# Initialize vector clock entry
			self.state.vector_clock[user_id] = 0
			
			await self._broadcast_user_joined(user)
			
			return user
	
	async def remove_user(self, user_id: str) -> bool:
		"""Remove a user from the collaborative session."""
		async with self._lock:
			if user_id not in self.state.users:
				return False
			
			# Set user as offline
			self.state.users[user_id].presence = UserPresence.OFFLINE
			
			# Clean up cursor
			if user_id in self.state.cursors:
				del self.state.cursors[user_id]
			
			await self._broadcast_user_left(user_id)
			
			return True
	
	async def insert_text(
		self,
		user_id: str,
		position: int,
		text: str,
		attributes: Optional[Dict[str, Any]] = None
	) -> Operation:
		"""
		Insert text at specified position.
		
		Simple API - position-based insertion with automatic conflict resolution.
		"""
		if not await self._check_permission(user_id, "write"):
			raise PermissionError(f"User {user_id} does not have write permission")
		
		async with self._lock:
			# Create operation
			operation = Operation(
				op_type=OperationType.INSERT,
				position=position,
				length=len(text),
				content=text,
				attributes=attributes or {},
				author_id=user_id,
				vector_clock=self.state.vector_clock.copy()
			)
			
			# Increment vector clock
			self.state.vector_clock[user_id] += 1
			operation.vector_clock[user_id] = self.state.vector_clock[user_id]
			
			# Apply operation using CRDT
			await self._apply_operation(operation)
			
			# Add to history for undo/redo
			self.operation_history.append(operation)
			self.undo_stack[user_id].append(operation)
			self.redo_stack[user_id].clear()  # Clear redo on new operation
			
			# Update user presence
			self.state.users[user_id].presence = UserPresence.EDITING
			self.state.users[user_id].last_activity = datetime.now()
			
			# Broadcast to collaborators
			await self._broadcast_operation(operation)
			
			return operation
	
	async def delete_text(
		self,
		user_id: str,
		position: int,
		length: int
	) -> Operation:
		"""
		Delete text at specified position and length.
		
		Simple API - position and length based deletion.
		"""
		if not await self._check_permission(user_id, "write"):
			raise PermissionError(f"User {user_id} does not have write permission")
		
		async with self._lock:
			# Get content being deleted for undo
			deleted_content = self.state.content[position:position + length]
			
			# Create operation
			operation = Operation(
				op_type=OperationType.DELETE,
				position=position,
				length=length,
				content=deleted_content,  # Store deleted content for undo
				author_id=user_id,
				vector_clock=self.state.vector_clock.copy()
			)
			
			# Increment vector clock
			self.state.vector_clock[user_id] += 1
			operation.vector_clock[user_id] = self.state.vector_clock[user_id]
			
			# Apply operation
			await self._apply_operation(operation)
			
			# Add to history
			self.operation_history.append(operation)
			self.undo_stack[user_id].append(operation)
			self.redo_stack[user_id].clear()
			
			# Update user presence
			self.state.users[user_id].presence = UserPresence.EDITING
			self.state.users[user_id].last_activity = datetime.now()
			
			# Broadcast
			await self._broadcast_operation(operation)
			
			return operation
	
	async def update_cursor(
		self,
		user_id: str,
		position: int,
		selection_start: Optional[int] = None,
		selection_end: Optional[int] = None
	) -> CursorPosition:
		"""
		Update user cursor position and selection.
		
		Simple API - just provide position and optional selection range.
		"""
		async with self._lock:
			cursor = CursorPosition(
				user_id=user_id,
				position=position,
				selection_start=selection_start or position,
				selection_end=selection_end or position,
				last_updated=time.time()
			)
			
			self.state.cursors[user_id] = cursor
			
			# Update user presence
			if user_id in self.state.users:
				self.state.users[user_id].cursor = cursor
				self.state.users[user_id].last_activity = datetime.now()
			
			# Broadcast cursor update
			await self._broadcast_cursor_update(cursor)
			
			return cursor
	
	async def add_comment(
		self,
		user_id: str,
		position: int,
		length: int,
		text: str
	) -> Comment:
		"""
		Add a comment/annotation to the document.
		
		Simple API - position, length, and comment text.
		"""
		if not await self._check_permission(user_id, "comment"):
			raise PermissionError(f"User {user_id} does not have comment permission")
		
		async with self._lock:
			comment = Comment(
				position=position,
				length=length,
				text=text,
				author_id=user_id
			)
			
			self.state.comments[comment.comment_id] = comment
			
			# Broadcast comment
			await self._broadcast_comment_added(comment)
			
			return comment
	
	async def resolve_comment(self, user_id: str, comment_id: str) -> bool:
		"""Resolve a comment."""
		async with self._lock:  # Fix: acquire lock before modifying shared state
			if comment_id not in self.state.comments:
				return False

			comment = self.state.comments[comment_id]

			# Check permissions (author or admin)
			if not (comment.author_id == user_id or await self._check_permission(user_id, "admin")):
				raise PermissionError("Cannot resolve comment")

			comment.resolved = True
			await self._broadcast_comment_resolved(comment_id)

			return True
	
	async def undo(self, user_id: str) -> Optional[Operation]:
		"""
		Undo the last operation by user.
		
		Simple API - just provide user ID.
		"""
		async with self._lock:
			if not self.undo_stack[user_id]:
				return None
			
			# Get last operation
			last_op = self.undo_stack[user_id].pop()
			
			# Create inverse operation
			inverse_op = await self._create_inverse_operation(last_op, user_id)
			
			# Apply inverse operation
			await self._apply_operation(inverse_op)
			
			# Move to redo stack
			self.redo_stack[user_id].append(last_op)
			
			# Broadcast
			await self._broadcast_operation(inverse_op)
			
			return inverse_op
	
	async def redo(self, user_id: str) -> Optional[Operation]:
		"""
		Redo the last undone operation by user.
		
		Simple API - just provide user ID.
		"""
		async with self._lock:
			if not self.redo_stack[user_id]:
				return None
			
			# Get operation to redo
			redo_op = self.redo_stack[user_id].pop()
			
			# Apply operation
			await self._apply_operation(redo_op)
			
			# Move back to undo stack
			self.undo_stack[user_id].append(redo_op)
			
			# Broadcast
			await self._broadcast_operation(redo_op)
			
			return redo_op
	
	async def get_document_content(self) -> str:
		"""Get current document content."""
		return self.state.content
	
	async def get_users(self) -> Dict[str, User]:
		"""Get all users in the session."""
		return self.state.users.copy()
	
	async def get_cursors(self) -> Dict[str, CursorPosition]:
		"""Get all user cursor positions."""
		return self.state.cursors.copy()
	
	async def get_comments(self) -> Dict[str, Comment]:
		"""Get all comments in the document."""
		return self.state.comments.copy()
	
	async def subscribe_to_changes(
		self,
		callback: Callable[[str, Any], None]
	) -> str:
		"""
		Subscribe to real-time changes.
		
		Simple callback-based subscription API.
		"""
		subscription_id = uuid7str()
		self.subscribers[subscription_id] = callback
		return subscription_id
	
	async def unsubscribe(self, subscription_id: str) -> bool:
		"""Unsubscribe from changes."""
		if subscription_id in self.subscribers:
			del self.subscribers[subscription_id]
			return True
		return False
	
	# Internal CRDT implementation methods
	
	async def _apply_operation(self, operation: Operation) -> None:
		"""Apply operation using CRDT algorithm for conflict resolution."""
		
		# Transform operation based on concurrent operations
		transformed_op = await self._transform_operation(operation)
		
		if transformed_op.op_type == OperationType.INSERT:
			# Insert text at transformed position
			pos = transformed_op.position
			self.state.content = (
				self.state.content[:pos] + 
				transformed_op.content + 
				self.state.content[pos:]
			)
			
		elif transformed_op.op_type == OperationType.DELETE:
			# Delete text at transformed position
			pos = transformed_op.position
			length = transformed_op.length
			self.state.content = (
				self.state.content[:pos] + 
				self.state.content[pos + length:]
			)
		
		# Update document state
		self.state.operations.append(transformed_op)
		self.state.version += 1
		self.state.last_modified = datetime.now()
	
	async def _transform_operation(self, operation: Operation) -> Operation:
		"""
		Transform operation against concurrent operations (Operational Transform).
		
		Simple transformation for position adjustments.
		"""
		transformed_position = operation.position
		
		# Check operations that happened concurrently (same vector clock)
		for existing_op in reversed(self.operation_history):
			# Skip operations by same author or later operations
			if existing_op.author_id == operation.author_id:
				continue
			
			# Check if operations are concurrent
			if self._are_concurrent(operation, existing_op):
				if existing_op.op_type == OperationType.INSERT:
					# Adjust position if insert happened before our operation
					if existing_op.position <= operation.position:
						transformed_position += existing_op.length
				
				elif existing_op.op_type == OperationType.DELETE:
					# Adjust position if delete happened before our operation
					if existing_op.position < operation.position:
						transformed_position -= existing_op.length
					elif existing_op.position < operation.position + operation.length:
						# Operation overlaps with deleted content
						# Simple strategy: move to start of deleted region
						transformed_position = existing_op.position
		
		# Create transformed operation
		return Operation(
			op_id=operation.op_id,
			op_type=operation.op_type,
			position=transformed_position,
			length=operation.length,
			content=operation.content,
			attributes=operation.attributes,
			author_id=operation.author_id,
			timestamp=operation.timestamp,
			vector_clock=operation.vector_clock
		)
	
	def _are_concurrent(self, op1: Operation, op2: Operation) -> bool:
		"""Check if two operations are concurrent using vector clocks."""
		clock1 = op1.vector_clock
		clock2 = op2.vector_clock
		
		# Operations are concurrent if neither happened-before the other
		op1_before_op2 = all(
			clock1.get(user, 0) <= clock2.get(user, 0) 
			for user in set(clock1.keys()) | set(clock2.keys())
		)
		op2_before_op1 = all(
			clock2.get(user, 0) <= clock1.get(user, 0) 
			for user in set(clock1.keys()) | set(clock2.keys())
		)
		
		# Concurrent means NEITHER happened-before the other
		return not op1_before_op2 and not op2_before_op1
	
	async def _create_inverse_operation(
		self,
		operation: Operation,
		user_id: str
	) -> Operation:
		"""Create inverse operation for undo."""
		if operation.op_type == OperationType.INSERT:
			# Inverse of insert is delete
			return Operation(
				op_type=OperationType.DELETE,
				position=operation.position,
				length=operation.length,
				content=operation.content,  # Store original content
				author_id=user_id,
				vector_clock=self.state.vector_clock.copy()
			)
		
		elif operation.op_type == OperationType.DELETE:
			# Inverse of delete is insert
			return Operation(
				op_type=OperationType.INSERT,
				position=operation.position,
				length=operation.length,
				content=operation.content,  # Restore deleted content
				author_id=user_id,
				vector_clock=self.state.vector_clock.copy()
			)
		
		# For other operation types, return no-op
		return operation
	
	async def _check_permission(self, user_id: str, permission: str) -> bool:
		"""Check if user has specific permission."""
		if user_id not in self.state.users:
			return False
		
		user_permissions = self.state.users[user_id].permissions
		return permission in user_permissions or "admin" in user_permissions
	
	# Broadcasting methods for real-time synchronization
	
	async def _broadcast_operation(self, operation: Operation) -> None:
		"""Broadcast operation to all subscribers."""
		event_data = {
			"type": "operation",
			"operation": {
				"op_id": operation.op_id,
				"op_type": operation.op_type.value,
				"position": operation.position,
				"length": operation.length,
				"content": operation.content,
				"author_id": operation.author_id,
				"timestamp": operation.timestamp
			}
		}
		
		await self._broadcast_event("operation", event_data)
	
	async def _broadcast_cursor_update(self, cursor: CursorPosition) -> None:
		"""Broadcast cursor update to subscribers."""
		event_data = {
			"type": "cursor",
			"cursor": {
				"user_id": cursor.user_id,
				"position": cursor.position,
				"selection_start": cursor.selection_start,
				"selection_end": cursor.selection_end
			}
		}
		
		await self._broadcast_event("cursor", event_data)
	
	async def _broadcast_user_joined(self, user: User) -> None:
		"""Broadcast user joined event."""
		event_data = {
			"type": "user_joined",
			"user": {
				"user_id": user.user_id,
				"name": user.name,
				"presence": user.presence.value
			}
		}
		
		await self._broadcast_event("user_joined", event_data)
	
	async def _broadcast_user_left(self, user_id: str) -> None:
		"""Broadcast user left event."""
		event_data = {
			"type": "user_left",
			"user_id": user_id
		}
		
		await self._broadcast_event("user_left", event_data)
	
	async def _broadcast_comment_added(self, comment: Comment) -> None:
		"""Broadcast comment added event."""
		event_data = {
			"type": "comment_added",
			"comment": {
				"comment_id": comment.comment_id,
				"position": comment.position,
				"length": comment.length,
				"text": comment.text,
				"author_id": comment.author_id
			}
		}
		
		await self._broadcast_event("comment_added", event_data)
	
	async def _broadcast_comment_resolved(self, comment_id: str) -> None:
		"""Broadcast comment resolved event."""
		event_data = {
			"type": "comment_resolved",
			"comment_id": comment_id
		}
		
		await self._broadcast_event("comment_resolved", event_data)
	
	async def _broadcast_event(self, event_type: str, event_data: Dict[str, Any]) -> None:
		"""Broadcast event to all subscribers."""
		# Call WebSocket handler if available
		if self.websocket_handler:
			try:
				await self.websocket_handler(event_type, event_data)
			except Exception as e:
				# Log error but don't fail
				logger.warning(f"WebSocket handler error in _broadcast_event: {e}")

		# Snapshot subscribers to avoid RuntimeError during concurrent modification
		for subscription_id, callback in list(self.subscribers.items()):
			try:
				await callback(event_type, event_data)
			except Exception as e:
				# Log error but don't fail
				logger.warning(f"Subscriber callback error in _broadcast_event: {e}")
	
	async def get_state_snapshot(self) -> Dict[str, Any]:
		"""Get complete state snapshot for new clients."""
		return {
			"document_id": self.state.document_id,
			"content": self.state.content,
			"version": self.state.version,
			"users": {
				user_id: {
					"user_id": user.user_id,
					"name": user.name,
					"presence": user.presence.value,
					"last_activity": user.last_activity.isoformat()
				}
				for user_id, user in self.state.users.items()
			},
			"cursors": {
				user_id: {
					"user_id": cursor.user_id,
					"position": cursor.position,
					"selection_start": cursor.selection_start,
					"selection_end": cursor.selection_end
				}
				for user_id, cursor in self.state.cursors.items()
			},
			"comments": {
				comment_id: {
					"comment_id": comment.comment_id,
					"position": comment.position,
					"length": comment.length,
					"text": comment.text,
					"author_id": comment.author_id,
					"resolved": comment.resolved,
					"created_at": comment.created_at.isoformat()
				}
				for comment_id, comment in self.state.comments.items()
			}
		}

	async def cleanup(self) -> None:
		"""Clean up collaborative editor resources."""
		self.subscribers.clear()
		self.operation_history.clear()
		self.undo_stack.clear()
		self.redo_stack.clear()
		self._operation_cache.clear()

class CollaborativeSession:
	"""
	Simple session manager for collaborative editing.
	
	Manages multiple document sessions with easy-to-use API.
	"""
	
	def __init__(self):
		self.sessions: Dict[str, CollaborativeEditor] = {}
		self._session_lock = asyncio.Lock()
	
	async def create_session(
		self,
		document_id: str,
		initial_content: str = "",
		websocket_handler: Optional[Callable] = None
	) -> CollaborativeEditor:
		"""Create a new collaborative session."""
		async with self._session_lock:
			if document_id in self.sessions:
				return self.sessions[document_id]
			
			session = CollaborativeEditor(
				document_id=document_id,
				initial_content=initial_content,
				websocket_handler=websocket_handler
			)
			
			self.sessions[document_id] = session
			return session
	
	async def get_session(self, document_id: str) -> Optional[CollaborativeEditor]:
		"""Get existing collaborative session."""
		return self.sessions.get(document_id)
	
	async def close_session(self, document_id: str) -> bool:
		"""Close collaborative session."""
		async with self._session_lock:
			if document_id in self.sessions:
				# Set all users offline
				session = self.sessions[document_id]
				for user_id in list(session.state.users.keys()):
					await session.remove_user(user_id)
				
				del self.sessions[document_id]
				return True
			return False
	
	async def get_active_sessions(self) -> List[str]:
		"""Get list of active session IDs."""
		return list(self.sessions.keys())
	
	async def get_session_info(self, document_id: str) -> Optional[Dict[str, Any]]:
		"""Get session information."""
		if document_id not in self.sessions:
			return None
		
		session = self.sessions[document_id]
		return {
			"document_id": document_id,
			"user_count": len(session.state.users),
			"version": session.state.version,
			"last_modified": session.state.last_modified.isoformat(),
			"users": list(session.state.users.keys())
		}