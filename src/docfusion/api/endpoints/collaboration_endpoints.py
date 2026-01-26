#!/usr/bin/env python3
"""
Document Collaboration Endpoints

FastAPI endpoints for document collaboration features including real-time editing,
comments, suggestions, and team management with comprehensive security integration.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timedelta
from enum import Enum

from fastapi import APIRouter, HTTPException, Depends, Query, Path as PathParam
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator

try:
	from uuid_extensions import uuid7str
except ImportError:
	from uuid import uuid4
	def uuid7str() -> str:
		return str(uuid4())

from ..middleware.authentication_middleware import get_current_user
from ...storage.secure_storage_service import SecureStorageService
from ...security import SecurityManager


class CollaborationPermission(str, Enum):
	"""Collaboration permission levels"""
	VIEWER = "viewer"
	COMMENTER = "commenter"
	EDITOR = "editor"
	OWNER = "owner"


class CommentStatus(str, Enum):
	"""Comment status options"""
	OPEN = "open"
	RESOLVED = "resolved"
	ARCHIVED = "archived"


class SuggestionStatus(str, Enum):
	"""Suggestion status options"""
	PENDING = "pending"
	ACCEPTED = "accepted"
	REJECTED = "rejected"
	SUPERSEDED = "superseded"


class CommentCreateRequest(BaseModel):
	"""Request model for creating a comment"""
	document_id: str = Field(..., description="Document ID")
	content: str = Field(..., min_length=1, max_length=2000, description="Comment content")
	selection_start: Optional[int] = Field(None, description="Text selection start position")
	selection_end: Optional[int] = Field(None, description="Text selection end position")
	reply_to: Optional[str] = Field(None, description="Parent comment ID if this is a reply")
	metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class CommentResponse(BaseModel):
	"""Response model for comments"""
	comment_id: str = Field(..., description="Unique comment ID")
	document_id: str = Field(..., description="Document ID")
	content: str = Field(..., description="Comment content")
	author_id: str = Field(..., description="Author user ID")
	author_name: str = Field(..., description="Author display name")
	created_at: datetime = Field(..., description="Creation timestamp")
	updated_at: datetime = Field(..., description="Last update timestamp")
	status: CommentStatus = Field(..., description="Comment status")
	selection_start: Optional[int] = Field(None, description="Text selection start")
	selection_end: Optional[int] = Field(None, description="Text selection end")
	reply_to: Optional[str] = Field(None, description="Parent comment ID")
	replies: List['CommentResponse'] = Field(default_factory=list, description="Reply comments")
	resolved_by: Optional[str] = Field(None, description="User who resolved the comment")
	resolved_at: Optional[datetime] = Field(None, description="Resolution timestamp")
	metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class SuggestionCreateRequest(BaseModel):
	"""Request model for creating a suggestion"""
	document_id: str = Field(..., description="Document ID")
	title: str = Field(..., min_length=1, max_length=200, description="Suggestion title")
	description: str = Field(..., min_length=1, max_length=1000, description="Suggestion description")
	original_text: Optional[str] = Field(None, description="Original text being suggested to change")
	suggested_text: Optional[str] = Field(None, description="Suggested replacement text")
	selection_start: Optional[int] = Field(None, description="Text selection start position")
	selection_end: Optional[int] = Field(None, description="Text selection end position")
	priority: int = Field(0, ge=0, le=5, description="Priority level (0-5)")
	metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class SuggestionResponse(BaseModel):
	"""Response model for suggestions"""
	suggestion_id: str = Field(..., description="Unique suggestion ID")
	document_id: str = Field(..., description="Document ID")
	title: str = Field(..., description="Suggestion title")
	description: str = Field(..., description="Suggestion description")
	author_id: str = Field(..., description="Author user ID")
	author_name: str = Field(..., description="Author display name")
	created_at: datetime = Field(..., description="Creation timestamp")
	updated_at: datetime = Field(..., description="Last update timestamp")
	status: SuggestionStatus = Field(..., description="Suggestion status")
	original_text: Optional[str] = Field(None, description="Original text")
	suggested_text: Optional[str] = Field(None, description="Suggested text")
	selection_start: Optional[int] = Field(None, description="Selection start")
	selection_end: Optional[int] = Field(None, description="Selection end")
	priority: int = Field(..., description="Priority level")
	reviewed_by: Optional[str] = Field(None, description="User who reviewed the suggestion")
	reviewed_at: Optional[datetime] = Field(None, description="Review timestamp")
	metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class CollaboratorRequest(BaseModel):
	"""Request model for adding collaborators"""
	user_id: Optional[str] = Field(None, description="User ID to add")
	email: Optional[str] = Field(None, description="Email address to invite")
	permission: CollaborationPermission = Field(..., description="Permission level")
	message: Optional[str] = Field(None, max_length=500, description="Invitation message")


class CollaboratorResponse(BaseModel):
	"""Response model for collaborators"""
	user_id: str = Field(..., description="User ID")
	username: str = Field(..., description="Username")
	email: str = Field(..., description="Email address")
	permission: CollaborationPermission = Field(..., description="Permission level")
	added_at: datetime = Field(..., description="When collaborator was added")
	added_by: str = Field(..., description="Who added the collaborator")
	last_active: Optional[datetime] = Field(None, description="Last activity timestamp")
	is_online: bool = Field(False, description="Whether user is currently online")


class ActivityLogEntry(BaseModel):
	"""Activity log entry model"""
	activity_id: str = Field(..., description="Activity ID")
	user_id: str = Field(..., description="User who performed the activity")
	username: str = Field(..., description="Username")
	action: str = Field(..., description="Action performed")
	description: str = Field(..., description="Activity description")
	timestamp: datetime = Field(..., description="Activity timestamp")
	metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class CollaborationEndpoints:
	"""Document collaboration endpoints"""
	
	def __init__(
		self,
		storage_service: SecureStorageService,
		security_manager: SecurityManager,
		websocket_endpoints: Optional[Any] = None  # Avoid circular import
	):
		self.storage = storage_service
		self.security = security_manager
		self.websocket_endpoints = websocket_endpoints
		self.logger = logging.getLogger(__name__)
		
		# Create FastAPI router
		self.router = APIRouter(prefix="/api/v1/collaboration", tags=["collaboration"])
		
		# In-memory storage for collaboration data (in production, would use database)
		self.comments: Dict[str, Dict[str, Any]] = {}
		self.suggestions: Dict[str, Dict[str, Any]] = {}
		self.collaborators: Dict[str, List[Dict[str, Any]]] = {}  # document_id -> list of collaborators
		self.activity_log: Dict[str, List[Dict[str, Any]]] = {}  # document_id -> list of activities
		
		# Register endpoints
		self._register_endpoints()
		
		self.logger.info("Collaboration endpoints initialized")
	
	def _register_endpoints(self):
		"""Register collaboration endpoints"""
		
		# ==================== COMMENTS ====================
		
		@self.router.post("/comments", response_model=CommentResponse, status_code=201)
		async def create_comment(
			request: CommentCreateRequest,
			current_user: Dict[str, Any] = Depends(get_current_user)
		):
			"""Create a new comment on a document"""
			return await self.create_comment_handler(request, current_user)
		
		@self.router.get("/documents/{document_id}/comments", response_model=List[CommentResponse])
		async def get_document_comments(
			document_id: str = PathParam(..., description="Document ID"),
			status: Optional[CommentStatus] = Query(None, description="Filter by status"),
			include_resolved: bool = Query(True, description="Include resolved comments"),
			current_user: Dict[str, Any] = Depends(get_current_user)
		):
			"""Get all comments for a document"""
			return await self.get_document_comments_handler(
				document_id, status, include_resolved, current_user
			)
		
		@self.router.put("/comments/{comment_id}", response_model=CommentResponse)
		async def update_comment(
			comment_id: str = PathParam(..., description="Comment ID"),
			content: str = Query(..., description="Updated comment content"),
			current_user: Dict[str, Any] = Depends(get_current_user)
		):
			"""Update a comment"""
			return await self.update_comment_handler(comment_id, content, current_user)
		
		@self.router.post("/comments/{comment_id}/resolve", response_model=Dict[str, Any])
		async def resolve_comment(
			comment_id: str = PathParam(..., description="Comment ID"),
			current_user: Dict[str, Any] = Depends(get_current_user)
		):
			"""Resolve a comment"""
			return await self.resolve_comment_handler(comment_id, current_user)
		
		@self.router.delete("/comments/{comment_id}", status_code=204)
		async def delete_comment(
			comment_id: str = PathParam(..., description="Comment ID"),
			current_user: Dict[str, Any] = Depends(get_current_user)
		):
			"""Delete a comment"""
			await self.delete_comment_handler(comment_id, current_user)
		
		# ==================== SUGGESTIONS ====================
		
		@self.router.post("/suggestions", response_model=SuggestionResponse, status_code=201)
		async def create_suggestion(
			request: SuggestionCreateRequest,
			current_user: Dict[str, Any] = Depends(get_current_user)
		):
			"""Create a new suggestion for a document"""
			return await self.create_suggestion_handler(request, current_user)
		
		@self.router.get("/documents/{document_id}/suggestions", response_model=List[SuggestionResponse])
		async def get_document_suggestions(
			document_id: str = PathParam(..., description="Document ID"),
			status: Optional[SuggestionStatus] = Query(None, description="Filter by status"),
			priority: Optional[int] = Query(None, description="Filter by priority"),
			current_user: Dict[str, Any] = Depends(get_current_user)
		):
			"""Get all suggestions for a document"""
			return await self.get_document_suggestions_handler(
				document_id, status, priority, current_user
			)
		
		@self.router.post("/suggestions/{suggestion_id}/accept", response_model=Dict[str, Any])
		async def accept_suggestion(
			suggestion_id: str = PathParam(..., description="Suggestion ID"),
			current_user: Dict[str, Any] = Depends(get_current_user)
		):
			"""Accept a suggestion"""
			return await self.accept_suggestion_handler(suggestion_id, current_user)
		
		@self.router.post("/suggestions/{suggestion_id}/reject", response_model=Dict[str, Any])
		async def reject_suggestion(
			suggestion_id: str = PathParam(..., description="Suggestion ID"),
			reason: Optional[str] = Query(None, description="Rejection reason"),
			current_user: Dict[str, Any] = Depends(get_current_user)
		):
			"""Reject a suggestion"""
			return await self.reject_suggestion_handler(suggestion_id, reason, current_user)
		
		@self.router.delete("/suggestions/{suggestion_id}", status_code=204)
		async def delete_suggestion(
			suggestion_id: str = PathParam(..., description="Suggestion ID"),
			current_user: Dict[str, Any] = Depends(get_current_user)
		):
			"""Delete a suggestion"""
			await self.delete_suggestion_handler(suggestion_id, current_user)
		
		# ==================== COLLABORATORS ====================
		
		@self.router.post("/documents/{document_id}/collaborators", response_model=Dict[str, Any])
		async def add_collaborator(
			document_id: str = PathParam(..., description="Document ID"),
			request: CollaboratorRequest = ...,
			current_user: Dict[str, Any] = Depends(get_current_user)
		):
			"""Add a collaborator to a document"""
			return await self.add_collaborator_handler(document_id, request, current_user)
		
		@self.router.get("/documents/{document_id}/collaborators", response_model=List[CollaboratorResponse])
		async def get_document_collaborators(
			document_id: str = PathParam(..., description="Document ID"),
			current_user: Dict[str, Any] = Depends(get_current_user)
		):
			"""Get all collaborators for a document"""
			return await self.get_document_collaborators_handler(document_id, current_user)
		
		@self.router.put("/documents/{document_id}/collaborators/{user_id}", response_model=Dict[str, Any])
		async def update_collaborator_permission(
			document_id: str = PathParam(..., description="Document ID"),
			user_id: str = PathParam(..., description="Collaborator user ID"),
			permission: CollaborationPermission = Query(..., description="New permission level"),
			current_user: Dict[str, Any] = Depends(get_current_user)
		):
			"""Update collaborator permission"""
			return await self.update_collaborator_permission_handler(
				document_id, user_id, permission, current_user
			)
		
		@self.router.delete("/documents/{document_id}/collaborators/{user_id}", status_code=204)
		async def remove_collaborator(
			document_id: str = PathParam(..., description="Document ID"),
			user_id: str = PathParam(..., description="Collaborator user ID"),
			current_user: Dict[str, Any] = Depends(get_current_user)
		):
			"""Remove a collaborator from a document"""
			await self.remove_collaborator_handler(document_id, user_id, current_user)
		
		# ==================== ACTIVITY LOG ====================
		
		@self.router.get("/documents/{document_id}/activity", response_model=List[ActivityLogEntry])
		async def get_document_activity(
			document_id: str = PathParam(..., description="Document ID"),
			limit: int = Query(50, ge=1, le=100, description="Maximum results"),
			since: Optional[datetime] = Query(None, description="Show activity since this timestamp"),
			current_user: Dict[str, Any] = Depends(get_current_user)
		):
			"""Get activity log for a document"""
			return await self.get_document_activity_handler(document_id, limit, since, current_user)
		
		# ==================== COLLABORATION STATUS ====================
		
		@self.router.get("/documents/{document_id}/status", response_model=Dict[str, Any])
		async def get_collaboration_status(
			document_id: str = PathParam(..., description="Document ID"),
			current_user: Dict[str, Any] = Depends(get_current_user)
		):
			"""Get collaboration status for a document"""
			return await self.get_collaboration_status_handler(document_id, current_user)
	
	# ==================== COMMENT HANDLERS ====================
	
	async def create_comment_handler(
		self,
		request: CommentCreateRequest,
		current_user: Dict[str, Any]
	) -> CommentResponse:
		"""Handle comment creation"""
		try:
			user_id = current_user['user_id']
			context = self._build_request_context(current_user)
			
			# Check document access
			permission_result = await self.security.check_document_permission(
				request.document_id, user_id, "view", context
			)
			
			if not permission_result['has_permission']:
				raise HTTPException(status_code=403, detail="Access denied")
			
			# Check if user can comment (needs commenter permission or higher)
			user_permission = self._get_user_collaboration_permission(request.document_id, user_id)
			if user_permission in [CollaborationPermission.VIEWER]:
				raise HTTPException(status_code=403, detail="Comment permission required")
			
			# Create comment
			comment_id = uuid7str()
			comment = {
				'comment_id': comment_id,
				'document_id': request.document_id,
				'content': request.content,
				'author_id': user_id,
				'author_name': current_user.get('username', 'Unknown'),
				'created_at': datetime.utcnow(),
				'updated_at': datetime.utcnow(),
				'status': CommentStatus.OPEN,
				'selection_start': request.selection_start,
				'selection_end': request.selection_end,
				'reply_to': request.reply_to,
				'replies': [],
				'resolved_by': None,
				'resolved_at': None,
				'metadata': request.metadata or {}
			}
			
			self.comments[comment_id] = comment
			
			# Add to activity log
			await self._log_activity(
				request.document_id,
				user_id,
				current_user.get('username', 'Unknown'),
				"comment_created",
				f"Added a comment: {request.content[:50]}{'...' if len(request.content) > 50 else ''}",
				{'comment_id': comment_id}
			)
			
			# Notify via WebSocket if available
			if self.websocket_endpoints:
				await self._notify_collaborators(
					request.document_id,
					"comment_added",
					{
						'comment': comment,
						'author': current_user.get('username', 'Unknown')
					},
					exclude_user=user_id
				)
			
			return CommentResponse(**comment)
		
		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Comment creation failed: {e}")
			raise HTTPException(status_code=500, detail="Internal server error")
	
	async def get_document_comments_handler(
		self,
		document_id: str,
		status: Optional[CommentStatus],
		include_resolved: bool,
		current_user: Dict[str, Any]
	) -> List[CommentResponse]:
		"""Handle document comments retrieval"""
		try:
			user_id = current_user['user_id']
			context = self._build_request_context(current_user)
			
			# Check document access
			permission_result = await self.security.check_document_permission(
				document_id, user_id, "view", context
			)
			
			if not permission_result['has_permission']:
				raise HTTPException(status_code=403, detail="Access denied")
			
			# Get comments for document
			document_comments = []
			for comment in self.comments.values():
				if comment['document_id'] == document_id:
					if status and comment['status'] != status:
						continue
					if not include_resolved and comment['status'] == CommentStatus.RESOLVED:
						continue
					document_comments.append(comment)
			
			# Sort by creation time
			document_comments.sort(key=lambda x: x['created_at'])
			
			# Build threaded comment structure (replies nested under parent comments)
			threaded_comments = []
			comment_map = {c['comment_id']: c for c in document_comments}
			
			for comment in document_comments:
				if comment['reply_to'] is None:
					# Top-level comment
					threaded_comments.append(comment)
				else:
					# Reply - add to parent's replies
					parent_id = comment['reply_to']
					if parent_id in comment_map:
						comment_map[parent_id]['replies'].append(comment)
			
			return [CommentResponse(**comment) for comment in threaded_comments]
		
		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Document comments retrieval failed: {e}")
			raise HTTPException(status_code=500, detail="Internal server error")
	
	async def update_comment_handler(
		self,
		comment_id: str,
		content: str,
		current_user: Dict[str, Any]
	) -> CommentResponse:
		"""Handle comment update"""
		try:
			user_id = current_user['user_id']
			
			if comment_id not in self.comments:
				raise HTTPException(status_code=404, detail="Comment not found")
			
			comment = self.comments[comment_id]
			
			# Check if user can edit this comment (author only)
			if comment['author_id'] != user_id:
				raise HTTPException(status_code=403, detail="Can only edit your own comments")
			
			# Update comment
			comment['content'] = content
			comment['updated_at'] = datetime.utcnow()
			
			# Add to activity log
			await self._log_activity(
				comment['document_id'],
				user_id,
				current_user.get('username', 'Unknown'),
				"comment_updated",
				f"Updated a comment",
				{'comment_id': comment_id}
			)
			
			# Notify via WebSocket if available
			if self.websocket_endpoints:
				await self._notify_collaborators(
					comment['document_id'],
					"comment_updated",
					{
						'comment': comment,
						'author': current_user.get('username', 'Unknown')
					},
					exclude_user=user_id
				)
			
			return CommentResponse(**comment)
		
		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Comment update failed: {e}")
			raise HTTPException(status_code=500, detail="Internal server error")
	
	async def resolve_comment_handler(
		self,
		comment_id: str,
		current_user: Dict[str, Any]
	) -> Dict[str, Any]:
		"""Handle comment resolution"""
		try:
			user_id = current_user['user_id']
			
			if comment_id not in self.comments:
				raise HTTPException(status_code=404, detail="Comment not found")
			
			comment = self.comments[comment_id]
			
			# Check document permission (need editor permission or higher)
			user_permission = self._get_user_collaboration_permission(comment['document_id'], user_id)
			if user_permission in [CollaborationPermission.VIEWER, CollaborationPermission.COMMENTER]:
				raise HTTPException(status_code=403, detail="Editor permission required to resolve comments")
			
			# Resolve comment
			comment['status'] = CommentStatus.RESOLVED
			comment['resolved_by'] = user_id
			comment['resolved_at'] = datetime.utcnow()
			
			# Add to activity log
			await self._log_activity(
				comment['document_id'],
				user_id,
				current_user.get('username', 'Unknown'),
				"comment_resolved",
				f"Resolved a comment",
				{'comment_id': comment_id}
			)
			
			# Notify via WebSocket if available
			if self.websocket_endpoints:
				await self._notify_collaborators(
					comment['document_id'],
					"comment_resolved",
					{
						'comment_id': comment_id,
						'resolved_by': current_user.get('username', 'Unknown')
					},
					exclude_user=user_id
				)
			
			return {
				'success': True,
				'comment_id': comment_id,
				'resolved_by': user_id,
				'resolved_at': comment['resolved_at']
			}
		
		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Comment resolution failed: {e}")
			raise HTTPException(status_code=500, detail="Internal server error")
	
	async def delete_comment_handler(
		self,
		comment_id: str,
		current_user: Dict[str, Any]
	):
		"""Handle comment deletion"""
		try:
			user_id = current_user['user_id']
			
			if comment_id not in self.comments:
				raise HTTPException(status_code=404, detail="Comment not found")
			
			comment = self.comments[comment_id]
			
			# Check if user can delete this comment (author or owner/editor)
			user_permission = self._get_user_collaboration_permission(comment['document_id'], user_id)
			if comment['author_id'] != user_id and user_permission not in [CollaborationPermission.OWNER, CollaborationPermission.EDITOR]:
				raise HTTPException(status_code=403, detail="Can only delete your own comments or need editor permission")
			
			# Delete comment
			document_id = comment['document_id']
			del self.comments[comment_id]
			
			# Also delete replies
			replies_to_delete = [cid for cid, c in self.comments.items() if c['reply_to'] == comment_id]
			for reply_id in replies_to_delete:
				del self.comments[reply_id]
			
			# Add to activity log
			await self._log_activity(
				document_id,
				user_id,
				current_user.get('username', 'Unknown'),
				"comment_deleted",
				f"Deleted a comment",
				{'comment_id': comment_id, 'replies_deleted': len(replies_to_delete)}
			)
		
		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Comment deletion failed: {e}")
			raise HTTPException(status_code=500, detail="Internal server error")
	
	# ==================== SUGGESTION HANDLERS ====================
	
	async def create_suggestion_handler(
		self,
		request: SuggestionCreateRequest,
		current_user: Dict[str, Any]
	) -> SuggestionResponse:
		"""Handle suggestion creation"""
		try:
			user_id = current_user['user_id']
			context = self._build_request_context(current_user)
			
			# Check document access
			permission_result = await self.security.check_document_permission(
				request.document_id, user_id, "view", context
			)
			
			if not permission_result['has_permission']:
				raise HTTPException(status_code=403, detail="Access denied")
			
			# Check if user can suggest (needs commenter permission or higher)
			user_permission = self._get_user_collaboration_permission(request.document_id, user_id)
			if user_permission in [CollaborationPermission.VIEWER]:
				raise HTTPException(status_code=403, detail="Comment permission required for suggestions")
			
			# Create suggestion
			suggestion_id = uuid7str()
			suggestion = {
				'suggestion_id': suggestion_id,
				'document_id': request.document_id,
				'title': request.title,
				'description': request.description,
				'author_id': user_id,
				'author_name': current_user.get('username', 'Unknown'),
				'created_at': datetime.utcnow(),
				'updated_at': datetime.utcnow(),
				'status': SuggestionStatus.PENDING,
				'original_text': request.original_text,
				'suggested_text': request.suggested_text,
				'selection_start': request.selection_start,
				'selection_end': request.selection_end,
				'priority': request.priority,
				'reviewed_by': None,
				'reviewed_at': None,
				'metadata': request.metadata or {}
			}
			
			self.suggestions[suggestion_id] = suggestion
			
			# Add to activity log
			await self._log_activity(
				request.document_id,
				user_id,
				current_user.get('username', 'Unknown'),
				"suggestion_created",
				f"Created suggestion: {request.title}",
				{'suggestion_id': suggestion_id, 'priority': request.priority}
			)
			
			# Notify via WebSocket if available
			if self.websocket_endpoints:
				await self._notify_collaborators(
					request.document_id,
					"suggestion_added",
					{
						'suggestion': suggestion,
						'author': current_user.get('username', 'Unknown')
					},
					exclude_user=user_id
				)
			
			return SuggestionResponse(**suggestion)
		
		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Suggestion creation failed: {e}")
			raise HTTPException(status_code=500, detail="Internal server error")
	
	async def get_document_suggestions_handler(
		self,
		document_id: str,
		status: Optional[SuggestionStatus],
		priority: Optional[int],
		current_user: Dict[str, Any]
	) -> List[SuggestionResponse]:
		"""Handle document suggestions retrieval"""
		try:
			user_id = current_user['user_id']
			context = self._build_request_context(current_user)
			
			# Check document access
			permission_result = await self.security.check_document_permission(
				document_id, user_id, "view", context
			)
			
			if not permission_result['has_permission']:
				raise HTTPException(status_code=403, detail="Access denied")
			
			# Get suggestions for document
			document_suggestions = []
			for suggestion in self.suggestions.values():
				if suggestion['document_id'] == document_id:
					if status and suggestion['status'] != status:
						continue
					if priority is not None and suggestion['priority'] != priority:
						continue
					document_suggestions.append(suggestion)
			
			# Sort by priority (high to low) then by creation time
			document_suggestions.sort(key=lambda x: (-x['priority'], x['created_at']))
			
			return [SuggestionResponse(**suggestion) for suggestion in document_suggestions]
		
		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Document suggestions retrieval failed: {e}")
			raise HTTPException(status_code=500, detail="Internal server error")
	
	async def accept_suggestion_handler(
		self,
		suggestion_id: str,
		current_user: Dict[str, Any]
	) -> Dict[str, Any]:
		"""Handle suggestion acceptance"""
		try:
			user_id = current_user['user_id']
			
			if suggestion_id not in self.suggestions:
				raise HTTPException(status_code=404, detail="Suggestion not found")
			
			suggestion = self.suggestions[suggestion_id]
			
			# Check document permission (need editor permission or higher)
			user_permission = self._get_user_collaboration_permission(suggestion['document_id'], user_id)
			if user_permission not in [CollaborationPermission.EDITOR, CollaborationPermission.OWNER]:
				raise HTTPException(status_code=403, detail="Editor permission required to accept suggestions")
			
			# Accept suggestion
			suggestion['status'] = SuggestionStatus.ACCEPTED
			suggestion['reviewed_by'] = user_id
			suggestion['reviewed_at'] = datetime.utcnow()
			
			# Add to activity log
			await self._log_activity(
				suggestion['document_id'],
				user_id,
				current_user.get('username', 'Unknown'),
				"suggestion_accepted",
				f"Accepted suggestion: {suggestion['title']}",
				{'suggestion_id': suggestion_id}
			)
			
			# Notify via WebSocket if available
			if self.websocket_endpoints:
				await self._notify_collaborators(
					suggestion['document_id'],
					"suggestion_accepted",
					{
						'suggestion_id': suggestion_id,
						'title': suggestion['title'],
						'accepted_by': current_user.get('username', 'Unknown')
					},
					exclude_user=user_id
				)
			
			return {
				'success': True,
				'suggestion_id': suggestion_id,
				'status': SuggestionStatus.ACCEPTED,
				'accepted_by': user_id,
				'accepted_at': suggestion['reviewed_at']
			}
		
		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Suggestion acceptance failed: {e}")
			raise HTTPException(status_code=500, detail="Internal server error")
	
	async def reject_suggestion_handler(
		self,
		suggestion_id: str,
		reason: Optional[str],
		current_user: Dict[str, Any]
	) -> Dict[str, Any]:
		"""Handle suggestion rejection"""
		try:
			user_id = current_user['user_id']
			
			if suggestion_id not in self.suggestions:
				raise HTTPException(status_code=404, detail="Suggestion not found")
			
			suggestion = self.suggestions[suggestion_id]
			
			# Check document permission (need editor permission or higher)
			user_permission = self._get_user_collaboration_permission(suggestion['document_id'], user_id)
			if user_permission not in [CollaborationPermission.EDITOR, CollaborationPermission.OWNER]:
				raise HTTPException(status_code=403, detail="Editor permission required to reject suggestions")
			
			# Reject suggestion
			suggestion['status'] = SuggestionStatus.REJECTED
			suggestion['reviewed_by'] = user_id
			suggestion['reviewed_at'] = datetime.utcnow()
			if reason:
				suggestion['metadata']['rejection_reason'] = reason
			
			# Add to activity log
			await self._log_activity(
				suggestion['document_id'],
				user_id,
				current_user.get('username', 'Unknown'),
				"suggestion_rejected",
				f"Rejected suggestion: {suggestion['title']}" + (f" - {reason}" if reason else ""),
				{'suggestion_id': suggestion_id, 'reason': reason}
			)
			
			# Notify via WebSocket if available
			if self.websocket_endpoints:
				await self._notify_collaborators(
					suggestion['document_id'],
					"suggestion_rejected",
					{
						'suggestion_id': suggestion_id,
						'title': suggestion['title'],
						'rejected_by': current_user.get('username', 'Unknown'),
						'reason': reason
					},
					exclude_user=user_id
				)
			
			return {
				'success': True,
				'suggestion_id': suggestion_id,
				'status': SuggestionStatus.REJECTED,
				'rejected_by': user_id,
				'rejected_at': suggestion['reviewed_at'],
				'reason': reason
			}
		
		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Suggestion rejection failed: {e}")
			raise HTTPException(status_code=500, detail="Internal server error")
	
	async def delete_suggestion_handler(
		self,
		suggestion_id: str,
		current_user: Dict[str, Any]
	):
		"""Handle suggestion deletion"""
		try:
			user_id = current_user['user_id']
			
			if suggestion_id not in self.suggestions:
				raise HTTPException(status_code=404, detail="Suggestion not found")
			
			suggestion = self.suggestions[suggestion_id]
			
			# Check if user can delete this suggestion (author or owner/editor)
			user_permission = self._get_user_collaboration_permission(suggestion['document_id'], user_id)
			if suggestion['author_id'] != user_id and user_permission not in [CollaborationPermission.OWNER, CollaborationPermission.EDITOR]:
				raise HTTPException(status_code=403, detail="Can only delete your own suggestions or need editor permission")
			
			# Delete suggestion
			document_id = suggestion['document_id']
			title = suggestion['title']
			del self.suggestions[suggestion_id]
			
			# Add to activity log
			await self._log_activity(
				document_id,
				user_id,
				current_user.get('username', 'Unknown'),
				"suggestion_deleted",
				f"Deleted suggestion: {title}",
				{'suggestion_id': suggestion_id}
			)
		
		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Suggestion deletion failed: {e}")
			raise HTTPException(status_code=500, detail="Internal server error")
	
	# ==================== COLLABORATOR HANDLERS ====================
	
	async def add_collaborator_handler(
		self,
		document_id: str,
		request: CollaboratorRequest,
		current_user: Dict[str, Any]
	) -> Dict[str, Any]:
		"""Handle adding collaborator"""
		try:
			user_id = current_user['user_id']
			context = self._build_request_context(current_user)
			
			# Check document permission (need owner permission to add collaborators)
			permission_result = await self.security.check_document_permission(
				document_id, user_id, "manage", context
			)
			
			if not permission_result['has_permission']:
				raise HTTPException(status_code=403, detail="Manage permission required")
			
			# Get target user info
			target_user_id = request.user_id
			if not target_user_id and request.email:
				# In production, would look up user by email
				target_user_id = f"user_{request.email.split('@')[0]}"  # Simplified
			
			if not target_user_id:
				raise HTTPException(status_code=400, detail="User ID or email required")
			
			# Add collaborator
			if document_id not in self.collaborators:
				self.collaborators[document_id] = []
			
			# Check if already a collaborator
			existing = next(
				(c for c in self.collaborators[document_id] if c['user_id'] == target_user_id),
				None
			)
			
			if existing:
				raise HTTPException(status_code=400, detail="User is already a collaborator")
			
			collaborator = {
				'user_id': target_user_id,
				'username': target_user_id,  # In production, would get from user service
				'email': request.email or f"{target_user_id}@example.com",
				'permission': request.permission,
				'added_at': datetime.utcnow(),
				'added_by': user_id,
				'last_active': None,
				'is_online': False
			}
			
			self.collaborators[document_id].append(collaborator)
			
			# Grant document access in security system
			await self.security.grant_document_access(
				document_id, target_user_id, user_id, request.permission.value
			)
			
			# Add to activity log
			await self._log_activity(
				document_id,
				user_id,
				current_user.get('username', 'Unknown'),
				"collaborator_added",
				f"Added {collaborator['username']} as {request.permission.value}",
				{
					'collaborator_id': target_user_id,
					'permission': request.permission.value,
					'invitation_message': request.message
				}
			)
			
			# Notify via WebSocket if available
			if self.websocket_endpoints:
				await self._notify_collaborators(
					document_id,
					"collaborator_added",
					{
						'collaborator': collaborator,
						'added_by': current_user.get('username', 'Unknown')
					},
					exclude_user=user_id
				)
			
			return {
				'success': True,
				'collaborator': collaborator,
				'message': 'Collaborator added successfully'
			}
		
		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Adding collaborator failed: {e}")
			raise HTTPException(status_code=500, detail="Internal server error")
	
	async def get_document_collaborators_handler(
		self,
		document_id: str,
		current_user: Dict[str, Any]
	) -> List[CollaboratorResponse]:
		"""Handle collaborators retrieval"""
		try:
			user_id = current_user['user_id']
			context = self._build_request_context(current_user)
			
			# Check document access
			permission_result = await self.security.check_document_permission(
				document_id, user_id, "view", context
			)
			
			if not permission_result['has_permission']:
				raise HTTPException(status_code=403, detail="Access denied")
			
			# Get collaborators
			document_collaborators = self.collaborators.get(document_id, [])
			
			# Update online status (in production, would check actual user presence)
			for collaborator in document_collaborators:
				if self.websocket_endpoints:
					# Check if user is connected via WebSocket
					collaborator['is_online'] = collaborator['user_id'] in getattr(
						self.websocket_endpoints.connection_manager, 'active_connections', {}
					)
			
			return [CollaboratorResponse(**c) for c in document_collaborators]
		
		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Collaborators retrieval failed: {e}")
			raise HTTPException(status_code=500, detail="Internal server error")
	
	async def update_collaborator_permission_handler(
		self,
		document_id: str,
		collaborator_user_id: str,
		permission: CollaborationPermission,
		current_user: Dict[str, Any]
	) -> Dict[str, Any]:
		"""Handle collaborator permission update"""
		try:
			user_id = current_user['user_id']
			context = self._build_request_context(current_user)
			
			# Check document permission (need owner permission)
			permission_result = await self.security.check_document_permission(
				document_id, user_id, "manage", context
			)
			
			if not permission_result['has_permission']:
				raise HTTPException(status_code=403, detail="Manage permission required")
			
			# Find and update collaborator
			document_collaborators = self.collaborators.get(document_id, [])
			collaborator = next(
				(c for c in document_collaborators if c['user_id'] == collaborator_user_id),
				None
			)
			
			if not collaborator:
				raise HTTPException(status_code=404, detail="Collaborator not found")
			
			old_permission = collaborator['permission']
			collaborator['permission'] = permission
			
			# Update in security system
			await self.security.grant_document_access(
				document_id, collaborator_user_id, user_id, permission.value
			)
			
			# Add to activity log
			await self._log_activity(
				document_id,
				user_id,
				current_user.get('username', 'Unknown'),
				"collaborator_permission_updated",
				f"Changed {collaborator['username']} permission from {old_permission} to {permission.value}",
				{
					'collaborator_id': collaborator_user_id,
					'old_permission': old_permission,
					'new_permission': permission.value
				}
			)
			
			return {
				'success': True,
				'collaborator_id': collaborator_user_id,
				'old_permission': old_permission,
				'new_permission': permission.value,
				'message': 'Permission updated successfully'
			}
		
		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Collaborator permission update failed: {e}")
			raise HTTPException(status_code=500, detail="Internal server error")
	
	async def remove_collaborator_handler(
		self,
		document_id: str,
		collaborator_user_id: str,
		current_user: Dict[str, Any]
	):
		"""Handle collaborator removal"""
		try:
			user_id = current_user['user_id']
			context = self._build_request_context(current_user)
			
			# Check document permission (need owner permission)
			permission_result = await self.security.check_document_permission(
				document_id, user_id, "manage", context
			)
			
			if not permission_result['has_permission']:
				raise HTTPException(status_code=403, detail="Manage permission required")
			
			# Find and remove collaborator
			document_collaborators = self.collaborators.get(document_id, [])
			collaborator = next(
				(c for c in document_collaborators if c['user_id'] == collaborator_user_id),
				None
			)
			
			if not collaborator:
				raise HTTPException(status_code=404, detail="Collaborator not found")
			
			# Remove collaborator
			self.collaborators[document_id] = [
				c for c in document_collaborators if c['user_id'] != collaborator_user_id
			]
			
			# Revoke document access in security system
			# In production, would call security.revoke_document_access()
			
			# Add to activity log
			await self._log_activity(
				document_id,
				user_id,
				current_user.get('username', 'Unknown'),
				"collaborator_removed",
				f"Removed {collaborator['username']} ({collaborator['permission']})",
				{
					'collaborator_id': collaborator_user_id,
					'permission': collaborator['permission']
				}
			)
			
			# Notify via WebSocket if available
			if self.websocket_endpoints:
				await self._notify_collaborators(
					document_id,
					"collaborator_removed",
					{
						'collaborator_id': collaborator_user_id,
						'username': collaborator['username'],
						'removed_by': current_user.get('username', 'Unknown')
					},
					exclude_user=user_id
				)
		
		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Collaborator removal failed: {e}")
			raise HTTPException(status_code=500, detail="Internal server error")
	
	# ==================== ACTIVITY LOG HANDLERS ====================
	
	async def get_document_activity_handler(
		self,
		document_id: str,
		limit: int,
		since: Optional[datetime],
		current_user: Dict[str, Any]
	) -> List[ActivityLogEntry]:
		"""Handle document activity retrieval"""
		try:
			user_id = current_user['user_id']
			context = self._build_request_context(current_user)
			
			# Check document access
			permission_result = await self.security.check_document_permission(
				document_id, user_id, "view", context
			)
			
			if not permission_result['has_permission']:
				raise HTTPException(status_code=403, detail="Access denied")
			
			# Get activity log
			activities = self.activity_log.get(document_id, [])
			
			# Filter by timestamp if provided
			if since:
				activities = [a for a in activities if a['timestamp'] >= since]
			
			# Sort by timestamp (newest first) and limit
			activities.sort(key=lambda x: x['timestamp'], reverse=True)
			activities = activities[:limit]
			
			return [ActivityLogEntry(**activity) for activity in activities]
		
		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Document activity retrieval failed: {e}")
			raise HTTPException(status_code=500, detail="Internal server error")
	
	# ==================== STATUS HANDLERS ====================
	
	async def get_collaboration_status_handler(
		self,
		document_id: str,
		current_user: Dict[str, Any]
	) -> Dict[str, Any]:
		"""Handle collaboration status retrieval"""
		try:
			user_id = current_user['user_id']
			context = self._build_request_context(current_user)
			
			# Check document access
			permission_result = await self.security.check_document_permission(
				document_id, user_id, "view", context
			)
			
			if not permission_result['has_permission']:
				raise HTTPException(status_code=403, detail="Access denied")
			
			# Count collaboration items
			document_comments = [c for c in self.comments.values() if c['document_id'] == document_id]
			document_suggestions = [s for s in self.suggestions.values() if s['document_id'] == document_id]
			document_collaborators = self.collaborators.get(document_id, [])
			
			# Count by status
			open_comments = len([c for c in document_comments if c['status'] == CommentStatus.OPEN])
			resolved_comments = len([c for c in document_comments if c['status'] == CommentStatus.RESOLVED])
			
			pending_suggestions = len([s for s in document_suggestions if s['status'] == SuggestionStatus.PENDING])
			accepted_suggestions = len([s for s in document_suggestions if s['status'] == SuggestionStatus.ACCEPTED])
			rejected_suggestions = len([s for s in document_suggestions if s['status'] == SuggestionStatus.REJECTED])
			
			# Count online collaborators
			online_collaborators = 0
			if self.websocket_endpoints:
				active_connections = getattr(
					self.websocket_endpoints.connection_manager, 'active_connections', {}
				)
				online_collaborators = len([
					c for c in document_collaborators
					if c['user_id'] in active_connections
				])
			
			# Get recent activity count
			recent_activity_count = len([
				a for a in self.activity_log.get(document_id, [])
				if a['timestamp'] >= datetime.utcnow() - timedelta(hours=24)
			])
			
			return {
				'document_id': document_id,
				'collaboration_summary': {
					'total_collaborators': len(document_collaborators),
					'online_collaborators': online_collaborators,
					'total_comments': len(document_comments),
					'open_comments': open_comments,
					'resolved_comments': resolved_comments,
					'total_suggestions': len(document_suggestions),
					'pending_suggestions': pending_suggestions,
					'accepted_suggestions': accepted_suggestions,
					'rejected_suggestions': rejected_suggestions,
					'recent_activity_count': recent_activity_count
				},
				'user_permission': self._get_user_collaboration_permission(document_id, user_id).value,
				'can_comment': self._get_user_collaboration_permission(document_id, user_id) != CollaborationPermission.VIEWER,
				'can_edit': self._get_user_collaboration_permission(document_id, user_id) in [CollaborationPermission.EDITOR, CollaborationPermission.OWNER],
				'can_manage': self._get_user_collaboration_permission(document_id, user_id) == CollaborationPermission.OWNER
			}
		
		except HTTPException:
			raise
		except Exception as e:
			self.logger.error(f"Collaboration status retrieval failed: {e}")
			raise HTTPException(status_code=500, detail="Internal server error")
	
	# ==================== HELPER METHODS ====================
	
	def _get_user_collaboration_permission(
		self,
		document_id: str,
		user_id: str
	) -> CollaborationPermission:
		"""Get user's collaboration permission for a document"""
		document_collaborators = self.collaborators.get(document_id, [])
		collaborator = next(
			(c for c in document_collaborators if c['user_id'] == user_id),
			None
		)
		
		if collaborator:
			return CollaborationPermission(collaborator['permission'])
		
		# Default permission (in production, would check document ownership)
		return CollaborationPermission.VIEWER
	
	async def _log_activity(
		self,
		document_id: str,
		user_id: str,
		username: str,
		action: str,
		description: str,
		metadata: Optional[Dict[str, Any]] = None
	):
		"""Log activity for a document"""
		if document_id not in self.activity_log:
			self.activity_log[document_id] = []
		
		activity = {
			'activity_id': uuid7str(),
			'user_id': user_id,
			'username': username,
			'action': action,
			'description': description,
			'timestamp': datetime.utcnow(),
			'metadata': metadata or {}
		}
		
		self.activity_log[document_id].append(activity)
		
		# Keep only last 1000 activities per document
		if len(self.activity_log[document_id]) > 1000:
			self.activity_log[document_id] = self.activity_log[document_id][-1000:]
	
	async def _notify_collaborators(
		self,
		document_id: str,
		event_type: str,
		data: Dict[str, Any],
		exclude_user: Optional[str] = None
	):
		"""Notify document collaborators via WebSocket"""
		if not self.websocket_endpoints:
			return
		
		await self.websocket_endpoints.connection_manager.send_to_document_subscribers(
			document_id,
			event_type,
			data,
			exclude_user=exclude_user
		)
	
	def _build_request_context(self, current_user: Dict[str, Any]) -> Dict[str, Any]:
		"""Build request context from user information"""
		return {
			'user_id': current_user['user_id'],
			'ip_address': current_user.get('ip_address'),
			'user_agent': current_user.get('user_agent'),
			'session_id': current_user.get('session_id'),
			'permissions': current_user.get('permissions', [])
		}


# Factory function
def create_collaboration_endpoints(
	storage_service: SecureStorageService,
	security_manager: SecurityManager,
	websocket_endpoints: Optional[Any] = None
) -> CollaborationEndpoints:
	"""Create CollaborationEndpoints instance with services"""
	return CollaborationEndpoints(storage_service, security_manager, websocket_endpoints)