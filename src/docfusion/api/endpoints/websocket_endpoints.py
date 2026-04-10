#!/usr/bin/env python3
"""
WebSocket Endpoints

Real-time WebSocket endpoints for collaborative editing, presence awareness,
notifications, and status updates with comprehensive security integration.
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any, Set
from datetime import datetime
from enum import Enum

from fastapi import WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from pydantic import BaseModel, Field, ValidationError

from ..middleware.authentication_middleware import get_websocket_user
from ...security import SecurityManager
from ...core.utils import uuid7str

class MessageType(str, Enum):
	"""WebSocket message types"""
	# Authentication
	AUTH = "auth"
	AUTH_SUCCESS = "auth_success"
	AUTH_FAILED = "auth_failed"
	
	# Document editing
	DOCUMENT_EDIT = "document_edit"
	DOCUMENT_CHANGE = "document_change"
	DOCUMENT_SAVE = "document_save"
	DOCUMENT_SAVED = "document_saved"
	
	# Collaboration
	USER_JOINED = "user_joined"
	USER_LEFT = "user_left"
	CURSOR_UPDATE = "cursor_update"
	SELECTION_UPDATE = "selection_update"
	PRESENCE_UPDATE = "presence_update"
	
	# Notifications
	NOTIFICATION = "notification"
	BATCH_STATUS_UPDATE = "batch_status_update"
	
	# System
	PING = "ping"
	PONG = "pong"
	ERROR = "error"
	DISCONNECT = "disconnect"

class WebSocketMessage(BaseModel):
	"""Base WebSocket message structure"""
	type: MessageType = Field(..., description="Message type")
	data: Dict[str, Any] = Field(..., description="Message data")
	message_id: str = Field(default_factory=uuid7str, description="Unique message ID")
	timestamp: datetime = Field(default_factory=datetime.utcnow, description="Message timestamp")

class DocumentEditMessage(BaseModel):
	"""Document edit message structure"""
	document_id: str = Field(..., description="Document being edited")
	operation: str = Field(..., description="Edit operation type")
	changes: List[Dict[str, Any]] = Field(..., description="Change operations")
	cursor_position: Optional[Dict[str, Any]] = Field(None, description="Current cursor position")
	user_id: str = Field(..., description="User making the change")

class PresenceInfo(BaseModel):
	"""User presence information"""
	user_id: str = Field(..., description="User ID")
	username: str = Field(..., description="Username")
	avatar_url: Optional[str] = Field(None, description="User avatar URL")
	status: str = Field("online", description="User status")
	document_id: Optional[str] = Field(None, description="Currently editing document")
	cursor_position: Optional[Dict[str, Any]] = Field(None, description="Current cursor position")
	last_activity: datetime = Field(default_factory=datetime.utcnow, description="Last activity timestamp")

class ConnectionManager:
	"""Manages WebSocket connections and message routing"""
	
	def __init__(self, security_manager: SecurityManager):
		self.security = security_manager
		self.logger = logging.getLogger(__name__)
		
		# Active connections by user_id
		self.active_connections: Dict[str, WebSocket] = {}
		
		# Document subscriptions: document_id -> set of user_ids
		self.document_subscriptions: Dict[str, Set[str]] = {}
		
		# User presence information
		self.user_presence: Dict[str, PresenceInfo] = {}
		
		# Message rate limiting
		self.message_counts: Dict[str, Dict[str, int]] = {}  # user_id -> {minute: count}
		
		self.logger.info("WebSocket connection manager initialized")
	
	async def connect(self, websocket: WebSocket, user_id: str, user_info: Dict[str, Any]):
		"""Handle new WebSocket connection"""
		try:
			await websocket.accept()
			
			# Close existing connection if any
			if user_id in self.active_connections:
				try:
					await self.active_connections[user_id].close()
				except (ConnectionError, RuntimeError, OSError) as e:
					self.logger.debug(f"Failed to close existing connection for user {user_id}: {e}")
			
			# Store new connection
			self.active_connections[user_id] = websocket
			
			# Update user presence
			self.user_presence[user_id] = PresenceInfo(
				user_id=user_id,
				username=user_info.get('username', 'Unknown'),
				avatar_url=user_info.get('avatar_url'),
				status="online"
			)
			
			# Send authentication success
			await self.send_to_user(user_id, MessageType.AUTH_SUCCESS, {
				'user_id': user_id,
				'connected_at': datetime.utcnow().isoformat(),
				'session_id': user_info.get('session_id')
			})
			
			# Notify other users of presence
			await self.broadcast_presence_update(user_id)
			
			self.logger.info(f"User {user_id} connected via WebSocket")
			
		except Exception as e:
			self.logger.error(f"WebSocket connection failed for user {user_id}: {e}")
			await websocket.close()
	
	async def disconnect(self, user_id: str):
		"""Handle WebSocket disconnection"""
		try:
			# Remove from active connections
			if user_id in self.active_connections:
				del self.active_connections[user_id]
			
			# Remove from document subscriptions
			for document_id, subscribers in list(self.document_subscriptions.items()):
				if user_id in subscribers:
					subscribers.remove(user_id)
					if not subscribers:
						del self.document_subscriptions[document_id]
					else:
						# Notify other users in document
						await self.send_to_document_subscribers(document_id, MessageType.USER_LEFT, {
							'user_id': user_id,
							'document_id': document_id,
							'left_at': datetime.utcnow().isoformat()
						}, exclude_user=user_id)
			
			# Update presence to offline
			if user_id in self.user_presence:
				self.user_presence[user_id].status = "offline"
				await self.broadcast_presence_update(user_id)
				# Remove presence after delay to allow offline notification
				asyncio.create_task(self._cleanup_user_presence(user_id, delay=30))
			
			# Clean up message rate limiting
			if user_id in self.message_counts:
				del self.message_counts[user_id]
			
			self.logger.info(f"User {user_id} disconnected from WebSocket")
			
		except Exception as e:
			self.logger.error(f"WebSocket disconnection cleanup failed for user {user_id}: {e}")
	
	async def subscribe_to_document(self, user_id: str, document_id: str):
		"""Subscribe user to document updates"""
		if document_id not in self.document_subscriptions:
			self.document_subscriptions[document_id] = set()
		
		self.document_subscriptions[document_id].add(user_id)
		
		# Update user presence
		if user_id in self.user_presence:
			self.user_presence[user_id].document_id = document_id
			self.user_presence[user_id].last_activity = datetime.utcnow()
		
		# Notify other users in document
		await self.send_to_document_subscribers(document_id, MessageType.USER_JOINED, {
			'user_id': user_id,
			'document_id': document_id,
			'joined_at': datetime.utcnow().isoformat(),
			'presence': self.user_presence.get(user_id, {}).dict() if user_id in self.user_presence else {}
		}, exclude_user=user_id)
		
		self.logger.debug(f"User {user_id} subscribed to document {document_id}")
	
	async def unsubscribe_from_document(self, user_id: str, document_id: str):
		"""Unsubscribe user from document updates"""
		if document_id in self.document_subscriptions:
			self.document_subscriptions[document_id].discard(user_id)
			if not self.document_subscriptions[document_id]:
				del self.document_subscriptions[document_id]
		
		# Update user presence
		if user_id in self.user_presence:
			if self.user_presence[user_id].document_id == document_id:
				self.user_presence[user_id].document_id = None
		
		# Notify other users in document
		await self.send_to_document_subscribers(document_id, MessageType.USER_LEFT, {
			'user_id': user_id,
			'document_id': document_id,
			'left_at': datetime.utcnow().isoformat()
		}, exclude_user=user_id)
		
		self.logger.debug(f"User {user_id} unsubscribed from document {document_id}")
	
	async def send_to_user(self, user_id: str, message_type: MessageType, data: Dict[str, Any]):
		"""Send message to specific user"""
		if user_id not in self.active_connections:
			return False
		
		try:
			message = WebSocketMessage(
				type=message_type,
				data=data
			)
			
			await self.active_connections[user_id].send_text(message.json())
			return True
		
		except Exception as e:
			self.logger.error(f"Failed to send message to user {user_id}: {e}")
			# Remove broken connection
			if user_id in self.active_connections:
				del self.active_connections[user_id]
			return False
	
	async def send_to_document_subscribers(
		self,
		document_id: str,
		message_type: MessageType,
		data: Dict[str, Any],
		exclude_user: Optional[str] = None
	):
		"""Send message to all subscribers of a document"""
		if document_id not in self.document_subscriptions:
			return 0
		
		sent_count = 0
		for user_id in list(self.document_subscriptions[document_id]):
			if exclude_user and user_id == exclude_user:
				continue
			
			if await self.send_to_user(user_id, message_type, data):
				sent_count += 1
		
		return sent_count
	
	async def broadcast_to_all(self, message_type: MessageType, data: Dict[str, Any]):
		"""Broadcast message to all connected users"""
		sent_count = 0
		for user_id in list(self.active_connections.keys()):
			if await self.send_to_user(user_id, message_type, data):
				sent_count += 1
		
		return sent_count
	
	async def broadcast_presence_update(self, user_id: str):
		"""Broadcast user presence update to relevant users"""
		if user_id not in self.user_presence:
			return
		
		presence = self.user_presence[user_id]
		
		# Send to users in the same document
		if presence.document_id:
			await self.send_to_document_subscribers(
				presence.document_id,
				MessageType.PRESENCE_UPDATE,
				{
					'user_id': user_id,
					'presence': presence.dict()
				},
				exclude_user=user_id
			)
	
	def is_rate_limited(self, user_id: str) -> bool:
		"""Check if user is rate limited"""
		current_minute = datetime.utcnow().minute
		
		if user_id not in self.message_counts:
			self.message_counts[user_id] = {}
		
		# Clean old minute counts
		user_counts = self.message_counts[user_id]
		old_minutes = [minute for minute in user_counts.keys() if minute != current_minute]
		for minute in old_minutes:
			del user_counts[minute]
		
		# Check current minute count
		current_count = user_counts.get(current_minute, 0)
		if current_count >= 100:  # 100 messages per minute limit
			return True
		
		# Increment count
		user_counts[current_minute] = current_count + 1
		return False
	
	def get_document_users(self, document_id: str) -> List[Dict[str, Any]]:
		"""Get all users currently in a document"""
		if document_id not in self.document_subscriptions:
			return []
		
		users = []
		for user_id in self.document_subscriptions[document_id]:
			if user_id in self.user_presence:
				users.append(self.user_presence[user_id].dict())
		
		return users
	
	def get_connection_stats(self) -> Dict[str, Any]:
		"""Get connection statistics"""
		return {
			'total_connections': len(self.active_connections),
			'total_documents': len(self.document_subscriptions),
			'online_users': len([p for p in self.user_presence.values() if p.status == "online"]),
			'document_subscriptions': {
				doc_id: len(subscribers) for doc_id, subscribers in self.document_subscriptions.items()
			}
		}
	
	async def _cleanup_user_presence(self, user_id: str, delay: int = 30):
		"""Clean up user presence after delay"""
		await asyncio.sleep(delay)
		if user_id in self.user_presence and self.user_presence[user_id].status == "offline":
			del self.user_presence[user_id]

class WebSocketEndpoints:
	"""WebSocket endpoint handlers"""
	
	def __init__(self, security_manager: SecurityManager):
		self.security = security_manager
		self.connection_manager = ConnectionManager(security_manager)
		self.logger = logging.getLogger(__name__)
		
		self.logger.info("WebSocket endpoints initialized")
	
	async def websocket_endpoint(
		self,
		websocket: WebSocket,
		token: Optional[str] = Query(None, description="Authentication token")
	):
		"""Main WebSocket endpoint"""
		user_info = None
		user_id = None
		
		try:
			# Authenticate user
			if token:
				try:
					user_info = await get_websocket_user(token)
					user_id = user_info['user_id']
				except Exception as e:
					await websocket.accept()
					await websocket.send_text(json.dumps({
						'type': MessageType.AUTH_FAILED,
						'data': {'error': 'Authentication failed'},
						'timestamp': datetime.utcnow().isoformat()
					}))
					await websocket.close()
					return
			else:
				await websocket.accept()
				await websocket.send_text(json.dumps({
					'type': MessageType.AUTH_FAILED,
					'data': {'error': 'Token required'},
					'timestamp': datetime.utcnow().isoformat()
				}))
				await websocket.close()
				return
			
			# Connect user
			await self.connection_manager.connect(websocket, user_id, user_info)
			
			# Message handling loop
			while True:
				try:
					# Receive message
					data = await websocket.receive_text()
					message_data = json.loads(data)
					
					# Validate message structure
					try:
						message = WebSocketMessage(**message_data)
					except ValidationError as e:
						await self.connection_manager.send_to_user(
							user_id,
							MessageType.ERROR,
							{'error': 'Invalid message format', 'details': str(e)}
						)
						continue
					
					# Rate limiting
					if self.connection_manager.is_rate_limited(user_id):
						await self.connection_manager.send_to_user(
							user_id,
							MessageType.ERROR,
							{'error': 'Rate limit exceeded'}
						)
						continue
					
					# Handle message
					await self.handle_message(user_id, message, user_info)
				
				except WebSocketDisconnect:
					break
				except json.JSONDecodeError:
					await self.connection_manager.send_to_user(
						user_id,
						MessageType.ERROR,
						{'error': 'Invalid JSON format'}
					)
				except Exception as e:
					self.logger.error(f"WebSocket message handling error for user {user_id}: {e}")
					await self.connection_manager.send_to_user(
						user_id,
						MessageType.ERROR,
						{'error': 'Message processing failed'}
					)
		
		except Exception as e:
			self.logger.error(f"WebSocket connection error: {e}")
		
		finally:
			if user_id:
				await self.connection_manager.disconnect(user_id)
	
	async def handle_message(
		self,
		user_id: str,
		message: WebSocketMessage,
		user_info: Dict[str, Any]
	):
		"""Handle incoming WebSocket message"""
		try:
			if message.type == MessageType.PING:
				await self.connection_manager.send_to_user(user_id, MessageType.PONG, {
					'timestamp': datetime.utcnow().isoformat()
				})
			
			elif message.type == MessageType.DOCUMENT_EDIT:
				await self.handle_document_edit(user_id, message, user_info)
			
			elif message.type == MessageType.CURSOR_UPDATE:
				await self.handle_cursor_update(user_id, message, user_info)
			
			elif message.type == MessageType.SELECTION_UPDATE:
				await self.handle_selection_update(user_id, message, user_info)
			
			elif message.type == MessageType.DOCUMENT_SAVE:
				await self.handle_document_save(user_id, message, user_info)
			
			elif message.type == MessageType.USER_JOINED:
				await self.handle_user_joined(user_id, message, user_info)
			
			elif message.type == MessageType.USER_LEFT:
				await self.handle_user_left(user_id, message, user_info)
			
			else:
				await self.connection_manager.send_to_user(
					user_id,
					MessageType.ERROR,
					{'error': f'Unsupported message type: {message.type}'}
				)
		
		except Exception as e:
			self.logger.error(f"Message handling failed for user {user_id}: {e}")
			await self.connection_manager.send_to_user(
				user_id,
				MessageType.ERROR,
				{'error': 'Message handling failed'}
			)
	
	async def handle_document_edit(
		self,
		user_id: str,
		message: WebSocketMessage,
		user_info: Dict[str, Any]
	):
		"""Handle document edit message"""
		try:
			document_id = message.data.get('document_id')
			if not document_id:
				raise ValueError("document_id required")
			
			# Check document permissions
			context = self._build_context(user_info)
			permission_result = await self.security.check_document_permission(
				document_id, user_id, "edit", context
			)
			
			if not permission_result['has_permission']:
				await self.connection_manager.send_to_user(
					user_id,
					MessageType.ERROR,
					{'error': 'Permission denied for document editing'}
				)
				return
			
			# Subscribe to document if not already
			if document_id not in self.connection_manager.document_subscriptions or \
			   user_id not in self.connection_manager.document_subscriptions[document_id]:
				await self.connection_manager.subscribe_to_document(user_id, document_id)
			
			# Broadcast edit to other document subscribers
			edit_data = {
				'document_id': document_id,
				'user_id': user_id,
				'operation': message.data.get('operation'),
				'changes': message.data.get('changes', []),
				'timestamp': datetime.utcnow().isoformat(),
				'message_id': message.message_id
			}
			
			await self.connection_manager.send_to_document_subscribers(
				document_id,
				MessageType.DOCUMENT_CHANGE,
				edit_data,
				exclude_user=user_id
			)
			
			# Log audit event
			await self.security.audit.log_event(
				event_type="document_edited",
				action="realtime_edit",
				description=f"Real-time edit on document {document_id}",
				user_id=user_id,
				resource_type="document",
				resource_id=document_id,
				details={
					'operation': message.data.get('operation'),
					'changes_count': len(message.data.get('changes', [])),
					'via_websocket': True
				}
			)
		
		except Exception as e:
			self.logger.error(f"Document edit handling failed: {e}")
			await self.connection_manager.send_to_user(
				user_id,
				MessageType.ERROR,
				{'error': 'Document edit failed'}
			)
	
	async def handle_cursor_update(
		self,
		user_id: str,
		message: WebSocketMessage,
		user_info: Dict[str, Any]
	):
		"""Handle cursor position update"""
		try:
			document_id = message.data.get('document_id')
			cursor_position = message.data.get('cursor_position')
			
			if not document_id or cursor_position is None:
				return
			
			# Update user presence
			if user_id in self.connection_manager.user_presence:
				self.connection_manager.user_presence[user_id].cursor_position = cursor_position
				self.connection_manager.user_presence[user_id].last_activity = datetime.utcnow()
			
			# Broadcast cursor update to document subscribers
			await self.connection_manager.send_to_document_subscribers(
				document_id,
				MessageType.CURSOR_UPDATE,
				{
					'user_id': user_id,
					'document_id': document_id,
					'cursor_position': cursor_position,
					'timestamp': datetime.utcnow().isoformat()
				},
				exclude_user=user_id
			)
		
		except Exception as e:
			self.logger.error(f"Cursor update handling failed: {e}")
	
	async def handle_selection_update(
		self,
		user_id: str,
		message: WebSocketMessage,
		user_info: Dict[str, Any]
	):
		"""Handle text selection update"""
		try:
			document_id = message.data.get('document_id')
			selection = message.data.get('selection')
			
			if not document_id:
				return
			
			# Broadcast selection update to document subscribers
			await self.connection_manager.send_to_document_subscribers(
				document_id,
				MessageType.SELECTION_UPDATE,
				{
					'user_id': user_id,
					'document_id': document_id,
					'selection': selection,
					'timestamp': datetime.utcnow().isoformat()
				},
				exclude_user=user_id
			)
		
		except Exception as e:
			self.logger.error(f"Selection update handling failed: {e}")
	
	async def handle_document_save(
		self,
		user_id: str,
		message: WebSocketMessage,
		user_info: Dict[str, Any]
	):
		"""Handle document save request"""
		try:
			document_id = message.data.get('document_id')
			content = message.data.get('content')
			
			if not document_id:
				raise ValueError("document_id required")
			
			# Check document permissions
			context = self._build_context(user_info)
			permission_result = await self.security.check_document_permission(
				document_id, user_id, "edit", context
			)
			
			if not permission_result['has_permission']:
				await self.connection_manager.send_to_user(
					user_id,
					MessageType.ERROR,
					{'error': 'Permission denied for document saving'}
				)
				return
			
			# In production, would save to storage service
			# For now, just confirm save
			save_result = {
				'document_id': document_id,
				'saved_at': datetime.utcnow().isoformat(),
				'saved_by': user_id,
				'version': '1.0',  # Would be actual version
				'success': True
			}
			
			# Send save confirmation to user
			await self.connection_manager.send_to_user(
				user_id,
				MessageType.DOCUMENT_SAVED,
				save_result
			)
			
			# Notify other document subscribers
			await self.connection_manager.send_to_document_subscribers(
				document_id,
				MessageType.DOCUMENT_SAVED,
				{
					'document_id': document_id,
					'saved_by': user_id,
					'saved_at': save_result['saved_at']
				},
				exclude_user=user_id
			)
		
		except Exception as e:
			self.logger.error(f"Document save handling failed: {e}")
			await self.connection_manager.send_to_user(
				user_id,
				MessageType.ERROR,
				{'error': 'Document save failed'}
			)
	
	async def handle_user_joined(
		self,
		user_id: str,
		message: WebSocketMessage,
		user_info: Dict[str, Any]
	):
		"""Handle user joining document"""
		try:
			document_id = message.data.get('document_id')
			if not document_id:
				raise ValueError("document_id required")
			
			# Check document permissions
			context = self._build_context(user_info)
			permission_result = await self.security.check_document_permission(
				document_id, user_id, "view", context
			)
			
			if not permission_result['has_permission']:
				await self.connection_manager.send_to_user(
					user_id,
					MessageType.ERROR,
					{'error': 'Permission denied for document access'}
				)
				return
			
			# Subscribe to document
			await self.connection_manager.subscribe_to_document(user_id, document_id)
			
			# Send current document users to joining user
			document_users = self.connection_manager.get_document_users(document_id)
			await self.connection_manager.send_to_user(
				user_id,
				MessageType.PRESENCE_UPDATE,
				{
					'document_id': document_id,
					'users': document_users
				}
			)
		
		except Exception as e:
			self.logger.error(f"User joined handling failed: {e}")
			await self.connection_manager.send_to_user(
				user_id,
				MessageType.ERROR,
				{'error': 'Failed to join document'}
			)
	
	async def handle_user_left(
		self,
		user_id: str,
		message: WebSocketMessage,
		user_info: Dict[str, Any]
	):
		"""Handle user leaving document"""
		try:
			document_id = message.data.get('document_id')
			if not document_id:
				raise ValueError("document_id required")
			
			# Unsubscribe from document
			await self.connection_manager.unsubscribe_from_document(user_id, document_id)
		
		except Exception as e:
			self.logger.error(f"User left handling failed: {e}")
	
	# ==================== STATUS UPDATES ====================
	
	async def send_batch_status_update(self, user_id: str, job_id: str, status_data: Dict[str, Any]):
		"""Send batch job status update to user"""
		await self.connection_manager.send_to_user(
			user_id,
			MessageType.BATCH_STATUS_UPDATE,
			{
				'job_id': job_id,
				'status': status_data,
				'timestamp': datetime.utcnow().isoformat()
			}
		)
	
	async def send_notification(self, user_id: str, notification: Dict[str, Any]):
		"""Send notification to user"""
		await self.connection_manager.send_to_user(
			user_id,
			MessageType.NOTIFICATION,
			{
				'notification': notification,
				'timestamp': datetime.utcnow().isoformat()
			}
		)
	
	async def broadcast_system_notification(self, notification: Dict[str, Any]):
		"""Broadcast system notification to all connected users"""
		await self.connection_manager.broadcast_to_all(
			MessageType.NOTIFICATION,
			{
				'notification': notification,
				'type': 'system',
				'timestamp': datetime.utcnow().isoformat()
			}
		)
	
	# ==================== HELPER METHODS ====================
	
	def _build_context(self, user_info: Dict[str, Any]) -> Dict[str, Any]:
		"""Build request context from user information"""
		return {
			'user_id': user_info['user_id'],
			'ip_address': user_info.get('ip_address'),
			'user_agent': user_info.get('user_agent'),
			'session_id': user_info.get('session_id'),
			'permissions': user_info.get('permissions', []),
			'via_websocket': True
		}
	
	def get_connection_stats(self) -> Dict[str, Any]:
		"""Get WebSocket connection statistics"""
		return self.connection_manager.get_connection_stats()
	
	def get_document_collaborators(self, document_id: str) -> List[Dict[str, Any]]:
		"""Get users currently collaborating on a document"""
		return self.connection_manager.get_document_users(document_id)

# Factory function
def create_websocket_endpoints(security_manager: SecurityManager) -> WebSocketEndpoints:
	"""Create WebSocketEndpoints instance with security manager"""
	return WebSocketEndpoints(security_manager)