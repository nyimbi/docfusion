"""
InAppChannel - Week 20 In-App Notification Channel

Implements in-application notifications with real-time delivery via WebSocket,
persistent notification storage, and user interaction tracking.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Set
import json

from pydantic import BaseModel, Field, ConfigDict

from ..delivery.notification_delivery import (
	NotificationChannel, NotificationMessage, DeliveryResult, 
	DeliveryStatus, ChannelType, Priority
)


class InAppNotificationType(str, Enum):
	"""In-app notification display types."""
	TOAST = "toast"			# Brief popup notification
	BANNER = "banner"		# Top banner notification  
	MODAL = "modal"			# Modal dialog notification
	SIDEBAR = "sidebar"		# Sidebar notification
	BADGE = "badge"			# Badge/counter notification


class InAppConfiguration(BaseModel):
	"""In-app notification channel configuration."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	# WebSocket Configuration
	websocket_url: Optional[str] = Field(None, description="WebSocket server URL")
	enable_websocket: bool = Field(True, description="Enable real-time WebSocket delivery")
	websocket_timeout: int = Field(30, description="WebSocket connection timeout")
	
	# Persistence Configuration
	enable_persistence: bool = Field(True, description="Store notifications for offline users")
	max_stored_notifications: int = Field(100, description="Maximum notifications per user")
	notification_ttl_hours: int = Field(168, description="Notification time-to-live (hours)")
	
	# Display Configuration
	default_display_duration: int = Field(5, description="Default display duration (seconds)")
	enable_auto_dismiss: bool = Field(True, description="Auto-dismiss notifications")
	enable_sound: bool = Field(True, description="Enable notification sounds")
	
	# Rate Limiting
	rate_limit_per_user_per_minute: int = Field(10, description="Max notifications per user per minute")


class InAppChannel(NotificationChannel):
	"""
	In-app notification channel with real-time delivery and persistence.
	
	Provides comprehensive in-app notification delivery including:
	- Real-time WebSocket delivery for online users
	- Notification persistence for offline users
	- User interaction tracking and analytics
	- Multiple display types (toast, banner, modal, etc.)
	- Rate limiting per user
	"""
	
	def __init__(self, config: InAppConfiguration):
		self.config = config
		
		# WebSocket connections tracking
		self._active_connections: Dict[str, Set[Any]] = {}  # user_id -> set of websocket connections
		
		# Notification storage for offline users
		self._stored_notifications: Dict[str, List[Dict[str, Any]]] = {}  # user_id -> notifications
		
		# Rate limiting per user
		self._user_rate_limits: Dict[str, Dict[str, Any]] = {}
		
		# User interaction tracking
		self._interaction_stats = {
			'total_sent': 0,
			'total_delivered': 0,
			'total_viewed': 0,
			'total_clicked': 0,
			'total_dismissed': 0,
			'type_breakdown': {
				'toast': 0,
				'banner': 0,
				'modal': 0,
				'sidebar': 0,
				'badge': 0
			}
		}
		
		self.logger = logging.getLogger(__name__)
		self.logger.info("InAppChannel initialized")
	
	async def send(self, message: NotificationMessage) -> DeliveryResult:
		"""Send in-app notification."""
		start_time = datetime.now()
		
		try:
			# Rate limiting check
			await self._check_user_rate_limit(message.recipient_id)
			
			# Validate in-app specific data
			inapp_data = await self._validate_inapp_data(message)
			
			# Prepare notification content
			notification_content = await self._prepare_notification_content(message, inapp_data)
			
			# Try real-time delivery first
			delivered_realtime = await self._deliver_realtime(message.recipient_id, notification_content)
			
			# Store for offline delivery if needed
			if self.config.enable_persistence and not delivered_realtime:
				await self._store_notification(message.recipient_id, notification_content)
			
			delivery_time = (datetime.now() - start_time).total_seconds() * 1000
			
			result = DeliveryResult(
				message_id=message.id,
				status=DeliveryStatus.DELIVERED,
				channel=ChannelType.IN_APP,
				success=True,
				delivery_time_ms=int(delivery_time),
				tracking_id=message.id,
				provider_response={
					'realtime_delivered': delivered_realtime,
					'stored_for_offline': not delivered_realtime and self.config.enable_persistence
				}
			)
			
			await self._update_stats(result, inapp_data)
			return result
			
		except Exception as e:
			delivery_time = (datetime.now() - start_time).total_seconds() * 1000
			
			return DeliveryResult(
				message_id=message.id,
				status=DeliveryStatus.FAILED,
				channel=ChannelType.IN_APP,
				success=False,
				error_message=str(e),
				error_code="INAPP_DELIVERY_EXCEPTION",
				delivery_time_ms=int(delivery_time)
			)
	
	async def validate_recipient(self, recipient_id: str) -> bool:
		"""Validate in-app notification recipient (user ID)."""
		try:
			# Basic user ID validation
			if not recipient_id or len(recipient_id.strip()) == 0:
				return False
			
			return True
			
		except Exception as e:
			self.logger.warning(f"In-app recipient validation failed: {e}")
			return False
	
	def get_channel_type(self) -> ChannelType:
		"""Get channel type identifier."""
		return ChannelType.IN_APP
	
	def supports_priority(self, priority: Priority) -> bool:
		"""Check if channel supports given priority level."""
		return True
	
	async def register_user_connection(self, user_id: str, websocket_connection: Any) -> None:
		"""Register a WebSocket connection for a user."""
		if user_id not in self._active_connections:
			self._active_connections[user_id] = set()
		
		self._active_connections[user_id].add(websocket_connection)
		
		# Deliver any stored notifications
		if user_id in self._stored_notifications:
			stored_notifications = self._stored_notifications[user_id]
			for notification in stored_notifications:
				await self._send_via_websocket(websocket_connection, notification)
			
			# Clear stored notifications after delivery
			del self._stored_notifications[user_id]
		
		self.logger.debug("Registered WebSocket connection for user: %s", user_id)
	
	async def unregister_user_connection(self, user_id: str, websocket_connection: Any) -> None:
		"""Unregister a WebSocket connection for a user."""
		if user_id in self._active_connections:
			self._active_connections[user_id].discard(websocket_connection)
			
			# Remove user entry if no active connections
			if not self._active_connections[user_id]:
				del self._active_connections[user_id]
		
		self.logger.debug("Unregistered WebSocket connection for user: %s", user_id)
	
	async def mark_notification_viewed(self, user_id: str, notification_id: str) -> None:
		"""Mark notification as viewed by user."""
		self._interaction_stats['total_viewed'] += 1
		self.logger.debug("Notification %s viewed by user %s", notification_id, user_id)
	
	async def mark_notification_clicked(self, user_id: str, notification_id: str) -> None:
		"""Mark notification as clicked by user."""
		self._interaction_stats['total_clicked'] += 1
		self.logger.debug("Notification %s clicked by user %s", notification_id, user_id)
	
	async def mark_notification_dismissed(self, user_id: str, notification_id: str) -> None:
		"""Mark notification as dismissed by user."""
		self._interaction_stats['total_dismissed'] += 1
		self.logger.debug("Notification %s dismissed by user %s", notification_id, user_id)
	
	def get_delivery_statistics(self) -> Dict[str, Any]:
		"""Get in-app notification delivery statistics."""
		stats = self._interaction_stats.copy()
		
		# Calculate engagement rates
		if stats['total_delivered'] > 0:
			stats['view_rate'] = stats['total_viewed'] / stats['total_delivered']
			stats['click_rate'] = stats['total_clicked'] / stats['total_delivered']
			stats['dismiss_rate'] = stats['total_dismissed'] / stats['total_delivered']
		else:
			stats.update({
				'view_rate': 0.0,
				'click_rate': 0.0,
				'dismiss_rate': 0.0
			})
		
		stats['active_connections'] = sum(len(connections) for connections in self._active_connections.values())
		stats['offline_notifications_stored'] = sum(len(notifications) for notifications in self._stored_notifications.values())
		
		return stats
	
	async def _validate_inapp_data(self, message: NotificationMessage) -> Dict[str, Any]:
		"""Validate in-app specific data."""
		channel_data = message.channel_data
		
		# Get notification type
		notification_type_str = channel_data.get('type', 'toast')
		try:
			notification_type = InAppNotificationType(notification_type_str)
		except ValueError:
			notification_type = InAppNotificationType.TOAST
		
		return {
			'type': notification_type,
			'display_duration': channel_data.get('display_duration', self.config.default_display_duration),
			'auto_dismiss': channel_data.get('auto_dismiss', self.config.enable_auto_dismiss),
			'enable_sound': channel_data.get('enable_sound', self.config.enable_sound),
			'action_buttons': channel_data.get('action_buttons', []),
			'custom_css_class': channel_data.get('custom_css_class'),
			'image_url': channel_data.get('image_url'),
			'click_action': channel_data.get('click_action'),
			'custom_data': channel_data.get('custom_data', {})
		}
	
	async def _prepare_notification_content(self, message: NotificationMessage, inapp_data: Dict[str, Any]) -> Dict[str, Any]:
		"""Prepare in-app notification content."""
		return {
			'id': message.id,
			'title': message.title,
			'content': message.content,
			'type': inapp_data['type'].value,
			'priority': message.priority.value,
			'display_duration': inapp_data['display_duration'],
			'auto_dismiss': inapp_data['auto_dismiss'],
			'enable_sound': inapp_data['enable_sound'],
			'action_buttons': inapp_data['action_buttons'],
			'custom_css_class': inapp_data['custom_css_class'],
			'image_url': inapp_data['image_url'],
			'click_action': inapp_data['click_action'],
			'custom_data': inapp_data['custom_data'],
			'timestamp': datetime.now().isoformat(),
			'workflow_id': message.workflow_id,
			'tags': message.tags
		}
	
	async def _deliver_realtime(self, user_id: str, notification_content: Dict[str, Any]) -> bool:
		"""Attempt real-time delivery via WebSocket."""
		if not self.config.enable_websocket or user_id not in self._active_connections:
			return False
		
		connections = self._active_connections[user_id].copy()  # Copy to avoid modification during iteration
		delivered_to_any = False
		
		for connection in connections:
			try:
				await self._send_via_websocket(connection, notification_content)
				delivered_to_any = True
			except Exception as e:
				self.logger.warning("Failed to deliver to WebSocket connection: %s", str(e))
				# Remove failed connection
				self._active_connections[user_id].discard(connection)
		
		# Clean up empty connection sets
		if user_id in self._active_connections and not self._active_connections[user_id]:
			del self._active_connections[user_id]
		
		return delivered_to_any
	
	async def _send_via_websocket(self, connection: Any, notification_content: Dict[str, Any]) -> None:
		"""Send notification via WebSocket connection."""
		message = {
			'type': 'notification',
			'data': notification_content
		}
		
		# This would depend on the WebSocket library being used
		# Placeholder implementation
		self.logger.debug("Sending WebSocket message: %s", json.dumps(message))
		
		# In a real implementation, this would be something like:
		# await connection.send_text(json.dumps(message))
	
	async def _store_notification(self, user_id: str, notification_content: Dict[str, Any]) -> None:
		"""Store notification for offline user."""
		if user_id not in self._stored_notifications:
			self._stored_notifications[user_id] = []
		
		# Add timestamp for TTL
		notification_content['stored_at'] = datetime.now().isoformat()
		
		# Add to stored notifications
		self._stored_notifications[user_id].append(notification_content)
		
		# Enforce storage limits
		if len(self._stored_notifications[user_id]) > self.config.max_stored_notifications:
			# Remove oldest notifications
			self._stored_notifications[user_id] = self._stored_notifications[user_id][-self.config.max_stored_notifications:]
		
		# Clean up expired notifications
		await self._cleanup_expired_notifications(user_id)
		
		self.logger.debug("Stored notification for offline user: %s", user_id)
	
	async def _cleanup_expired_notifications(self, user_id: str) -> None:
		"""Remove expired notifications for a user."""
		if user_id not in self._stored_notifications:
			return
		
		now = datetime.now()
		ttl_delta = timedelta(hours=self.config.notification_ttl_hours)
		
		valid_notifications = []
		for notification in self._stored_notifications[user_id]:
			stored_at_str = notification.get('stored_at')
			if stored_at_str:
				stored_at = datetime.fromisoformat(stored_at_str)
				if now - stored_at < ttl_delta:
					valid_notifications.append(notification)
		
		self._stored_notifications[user_id] = valid_notifications
		
		# Remove user entry if no notifications left
		if not self._stored_notifications[user_id]:
			del self._stored_notifications[user_id]
	
	async def _check_user_rate_limit(self, user_id: str) -> None:
		"""Check and enforce per-user rate limiting."""
		now = datetime.now()
		
		if user_id not in self._user_rate_limits:
			self._user_rate_limits[user_id] = {
				'count': 0,
				'reset_time': now
			}
		
		user_limit = self._user_rate_limits[user_id]
		
		# Reset counter if window expired
		if (now - user_limit['reset_time']).total_seconds() >= 60:  # 1 minute window
			user_limit['count'] = 0
			user_limit['reset_time'] = now
		
		# Check rate limit
		if user_limit['count'] >= self.config.rate_limit_per_user_per_minute:
			wait_time = 60 - (now - user_limit['reset_time']).total_seconds()
			if wait_time > 0:
				raise Exception(f"Rate limit exceeded for user {user_id}, wait {wait_time:.1f}s")
		
		user_limit['count'] += 1
	
	async def _update_stats(self, result: DeliveryResult, inapp_data: Dict[str, Any]) -> None:
		"""Update delivery statistics."""
		self._interaction_stats['total_sent'] += 1
		
		if result.success:
			self._interaction_stats['total_delivered'] += 1
		
		# Track by notification type
		notification_type = inapp_data['type'].value
		self._interaction_stats['type_breakdown'][notification_type] += 1


# Utility functions for in-app notifications

def create_inapp_channel(
	websocket_url: Optional[str] = None,
	enable_persistence: bool = True,
	**kwargs
) -> InAppChannel:
	"""Factory function to create InAppChannel."""
	config = InAppConfiguration(
		websocket_url=websocket_url,
		enable_persistence=enable_persistence,
		**kwargs
	)
	
	return InAppChannel(config)


def create_toast_notification(
	title: str,
	content: str,
	recipient_id: str,
	display_duration: int = 5,
	enable_sound: bool = True
) -> NotificationMessage:
	"""Create a toast notification message."""
	from ..delivery.notification_delivery import NotificationMessage, Priority
	
	return NotificationMessage(
		title=title,
		content=content,
		recipient_id=recipient_id,
		channel=ChannelType.IN_APP,
		priority=Priority.MEDIUM,
		channel_data={
			'type': 'toast',
			'display_duration': display_duration,
			'enable_sound': enable_sound,
			'auto_dismiss': True
		}
	)


def create_modal_notification(
	title: str,
	content: str,
	recipient_id: str,
	action_buttons: List[Dict[str, str]] = None
) -> NotificationMessage:
	"""Create a modal notification message."""
	from ..delivery.notification_delivery import NotificationMessage, Priority
	
	return NotificationMessage(
		title=title,
		content=content,
		recipient_id=recipient_id,
		channel=ChannelType.IN_APP,
		priority=Priority.HIGH,
		channel_data={
			'type': 'modal',
			'auto_dismiss': False,
			'action_buttons': action_buttons or []
		}
	)