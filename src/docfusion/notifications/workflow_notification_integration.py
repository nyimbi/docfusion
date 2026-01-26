"""
Workflow Notification Integration - Week 20 Complete Integration Layer

Integrates the comprehensive notifications system with all DocuFusion workflow events,
providing seamless notification delivery for workflow state changes, deadlines,
user interactions, and system events across all supported channels.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Set, Callable
import json

from pydantic import BaseModel, Field, ConfigDict
# from uuid_extensions import uuid7str
import uuid

def uuid7str() -> str:
	"""Generate UUID7-style string (fallback implementation)."""
	return str(uuid.uuid4())

from .delivery.notification_delivery import (
	NotificationDelivery, NotificationMessage, ChannelType, Priority, DeliveryResult,
	create_notification_delivery
)
from .prioritization.priority_manager import (
	PriorityManager, NotificationMetadata, ImportanceContext, PriorityLevel,
	create_priority_manager, create_notification_metadata
)
from .analytics.notification_analytics import (
	NotificationAnalytics, NotificationEvent, AnalyticsEvent,
	create_notification_analytics, create_notification_event
)
from .channels import *


class WorkflowEventType(str, Enum):
	"""Workflow event types that trigger notifications."""
	WORKFLOW_STARTED = "workflow_started"
	WORKFLOW_COMPLETED = "workflow_completed"
	WORKFLOW_FAILED = "workflow_failed"
	WORKFLOW_PAUSED = "workflow_paused"
	WORKFLOW_RESUMED = "workflow_resumed"
	
	TASK_CREATED = "task_created"
	TASK_ASSIGNED = "task_assigned"
	TASK_STARTED = "task_started"
	TASK_COMPLETED = "task_completed"
	TASK_FAILED = "task_failed"
	TASK_OVERDUE = "task_overdue"
	
	DEADLINE_APPROACHING = "deadline_approaching"
	DEADLINE_MISSED = "deadline_missed"
	DEADLINE_EXTENDED = "deadline_extended"
	
	DOCUMENT_GENERATED = "document_generated"
	DOCUMENT_REVIEWED = "document_reviewed"
	DOCUMENT_APPROVED = "document_approved"
	DOCUMENT_REJECTED = "document_rejected"
	
	USER_MENTION = "user_mention"
	COLLABORATION_REQUEST = "collaboration_request"
	APPROVAL_REQUEST = "approval_request"
	
	SYSTEM_ERROR = "system_error"
	PERFORMANCE_ALERT = "performance_alert"
	SECURITY_ALERT = "security_alert"


class NotificationTemplate(BaseModel):
	"""Notification template for workflow events."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True)
	
	template_id: str = Field(..., description="Template identifier")
	event_type: WorkflowEventType = Field(..., description="Triggering event type")
	
	# Template content
	title_template: str = Field(..., description="Notification title template")
	content_template: str = Field(..., description="Notification content template")
	
	# Default settings
	default_priority: Priority = Field(Priority.MEDIUM, description="Default notification priority")
	default_channels: List[ChannelType] = Field(default_factory=list, description="Default delivery channels")
	
	# Conditions
	conditions: Dict[str, Any] = Field(default_factory=dict, description="Template activation conditions")
	
	# Channel-specific templates
	channel_templates: Dict[ChannelType, Dict[str, Any]] = Field(
		default_factory=dict, 
		description="Channel-specific template overrides"
	)


class WorkflowNotificationIntegration:
	"""
	Complete integration between workflow system and notifications.
	
	Provides comprehensive notification delivery for all workflow events including:
	- Automatic notification triggering on workflow events
	- Intelligent priority calculation based on context
	- Multi-channel delivery with channel optimization
	- User preference management and respect
	- Analytics and performance tracking
	- Template-based notification generation
	- Event filtering and routing
	- Batch notification processing
	"""
	
	def __init__(
		self,
		notification_delivery: Optional[NotificationDelivery] = None,
		priority_manager: Optional[PriorityManager] = None,
		analytics: Optional[NotificationAnalytics] = None,
		enable_auto_notifications: bool = True,
		batch_processing: bool = True,
		batch_interval_seconds: int = 30
	):
		self.enable_auto_notifications = enable_auto_notifications
		self.batch_processing = batch_processing
		self.batch_interval_seconds = batch_interval_seconds
		
		# Core components - will be initialized if not provided
		self.notification_delivery = notification_delivery
		self.priority_manager = priority_manager
		self.analytics = analytics
		
		# Notification templates
		self._templates: Dict[WorkflowEventType, List[NotificationTemplate]] = {}
		
		# Event filters and handlers
		self._event_filters: List[Callable] = []
		self._event_handlers: Dict[WorkflowEventType, List[Callable]] = {}
		
		# Batch processing
		self._batch_queue: List[Dict[str, Any]] = []
		self._batch_task: Optional[asyncio.Task] = None
		
		# User preferences and subscriptions
		self._user_subscriptions: Dict[str, Set[WorkflowEventType]] = {}
		self._user_channel_preferences: Dict[str, Dict[WorkflowEventType, List[ChannelType]]] = {}
		self._user_quiet_hours: Dict[str, Dict[str, Any]] = {}
		
		# Metrics and monitoring
		self._integration_stats = {
			'events_processed': 0,
			'notifications_sent': 0,
			'notifications_filtered': 0,
			'batch_processes': 0,
			'template_renders': 0
		}
		
		# System state
		self._running = False
		self._background_tasks: List[asyncio.Task] = []
		
		# Logging
		self.logger = logging.getLogger(__name__)
		self.logger.info("WorkflowNotificationIntegration initialized")
	
	async def start(self) -> None:
		"""Start the notification integration service."""
		if self._running:
			self.logger.warning("Integration service already running")
			return
		
		self._running = True
		self.logger.info("Starting workflow notification integration service")
		
		# Initialize components if not provided
		if not self.notification_delivery:
			self.notification_delivery = await create_notification_delivery()
		
		if not self.priority_manager:
			self.priority_manager = await create_priority_manager()
		
		if not self.analytics:
			self.analytics = await create_notification_analytics()
		
		# Load default templates
		await self._load_default_templates()
		
		# Start batch processing if enabled
		if self.batch_processing:
			self._batch_task = asyncio.create_task(self._batch_processor())
			self._background_tasks.append(self._batch_task)
		
		self.logger.info("Workflow notification integration service started")
	
	async def stop(self) -> None:
		"""Stop the notification integration service."""
		if not self._running:
			return
		
		self.logger.info("Stopping workflow notification integration service...")
		self._running = False
		
		# Process remaining batch items
		if self._batch_queue:
			await self._process_batch()
		
		# Cancel background tasks
		for task in self._background_tasks:
			task.cancel()
		
		if self._background_tasks:
			await asyncio.gather(*self._background_tasks, return_exceptions=True)
		
		self._background_tasks.clear()
		
		# Stop core components
		if self.notification_delivery:
			await self.notification_delivery.stop()
		if self.priority_manager:
			await self.priority_manager.stop()
		
		self.logger.info("Workflow notification integration service stopped")
	
	async def handle_workflow_event(
		self,
		event_type: WorkflowEventType,
		event_data: Dict[str, Any],
		affected_users: List[str] = None,
		workflow_id: Optional[str] = None,
		priority_override: Optional[Priority] = None
	) -> List[str]:
		"""
		Handle a workflow event and trigger appropriate notifications.
		
		Args:
			event_type: Type of workflow event
			event_data: Event details and context
			affected_users: List of users to notify (if None, will be determined from event)
			workflow_id: Associated workflow identifier
			priority_override: Override calculated priority
			
		Returns:
			List of notification IDs that were sent
		"""
		if not self.enable_auto_notifications:
			return []
		
		self._integration_stats['events_processed'] += 1
		
		try:
			# Apply event filters
			if not await self._should_process_event(event_type, event_data):
				self._integration_stats['notifications_filtered'] += 1
				return []
			
			# Determine affected users
			if not affected_users:
				affected_users = await self._determine_affected_users(event_type, event_data)
			
			if not affected_users:
				return []
			
			# Get applicable templates
			templates = await self._get_applicable_templates(event_type, event_data)
			if not templates:
				self.logger.warning("No templates found for event type: %s", event_type.value)
				return []
			
			# Process notifications for each user and template
			notification_ids = []
			
			for user_id in affected_users:
				# Check user subscriptions
				if not await self._is_user_subscribed(user_id, event_type):
					continue
				
				for template in templates:
					# Check template conditions
					if not await self._evaluate_template_conditions(template, event_data, user_id):
						continue
					
					# Create notification
					notification_id = await self._create_notification_from_template(
						template, event_type, event_data, user_id, workflow_id, priority_override
					)
					
					if notification_id:
						notification_ids.append(notification_id)
			
			self._integration_stats['notifications_sent'] += len(notification_ids)
			
			# Execute custom event handlers
			await self._execute_event_handlers(event_type, event_data, notification_ids)
			
			return notification_ids
			
		except Exception as e:
			self.logger.error("Error handling workflow event %s: %s", event_type.value, str(e))
			return []
	
	async def add_notification_template(self, template: NotificationTemplate) -> None:
		"""Add a notification template for workflow events."""
		if template.event_type not in self._templates:
			self._templates[template.event_type] = []
		
		self._templates[template.event_type].append(template)
		self.logger.info("Added notification template: %s for event: %s", 
						template.template_id, template.event_type.value)
	
	async def subscribe_user(self, user_id: str, event_types: List[WorkflowEventType]) -> None:
		"""Subscribe user to specific workflow event notifications."""
		if user_id not in self._user_subscriptions:
			self._user_subscriptions[user_id] = set()
		
		self._user_subscriptions[user_id].update(event_types)
		self.logger.debug("Subscribed user %s to %d event types", user_id, len(event_types))
	
	async def unsubscribe_user(self, user_id: str, event_types: List[WorkflowEventType]) -> None:
		"""Unsubscribe user from workflow event notifications."""
		if user_id in self._user_subscriptions:
			self._user_subscriptions[user_id].difference_update(event_types)
			
			# Remove user if no subscriptions left
			if not self._user_subscriptions[user_id]:
				del self._user_subscriptions[user_id]
		
		self.logger.debug("Unsubscribed user %s from %d event types", user_id, len(event_types))
	
	async def set_user_channel_preferences(
		self,
		user_id: str,
		preferences: Dict[WorkflowEventType, List[ChannelType]]
	) -> None:
		"""Set user's preferred notification channels for different event types."""
		self._user_channel_preferences[user_id] = preferences
		self.logger.debug("Updated channel preferences for user: %s", user_id)
	
	async def set_user_quiet_hours(
		self,
		user_id: str,
		start_hour: int,
		end_hour: int,
		timezone: str = "UTC"
	) -> None:
		"""Set user's quiet hours for notification delivery."""
		self._user_quiet_hours[user_id] = {
			'start_hour': start_hour,
			'end_hour': end_hour,
			'timezone': timezone
		}
		self.logger.debug("Set quiet hours for user %s: %d:00 - %d:00", user_id, start_hour, end_hour)
	
	def add_event_filter(self, filter_func: Callable[[WorkflowEventType, Dict[str, Any]], bool]) -> None:
		"""Add a custom event filter function."""
		self._event_filters.append(filter_func)
		self.logger.debug("Added event filter function")
	
	def add_event_handler(
		self,
		event_type: WorkflowEventType,
		handler_func: Callable[[WorkflowEventType, Dict[str, Any], List[str]], None]
	) -> None:
		"""Add a custom event handler function."""
		if event_type not in self._event_handlers:
			self._event_handlers[event_type] = []
		
		self._event_handlers[event_type].append(handler_func)
		self.logger.debug("Added event handler for: %s", event_type.value)
	
	async def get_integration_statistics(self) -> Dict[str, Any]:
		"""Get integration performance statistics."""
		stats = self._integration_stats.copy()
		
		# Add component statistics
		if self.notification_delivery:
			stats['delivery_stats'] = self.notification_delivery.get_metrics().__dict__
		
		if self.priority_manager:
			stats['priority_stats'] = self.priority_manager.get_priority_statistics()
		
		if self.analytics:
			# Get last 24 hours analytics
			end_time = datetime.now()
			start_time = end_time - timedelta(hours=24)
			analytics_metrics = await self.analytics.get_metrics(start_time, end_time)
			stats['analytics_stats'] = analytics_metrics.model_dump()
		
		stats['active_templates'] = sum(len(templates) for templates in self._templates.values())
		stats['subscribed_users'] = len(self._user_subscriptions)
		stats['batch_queue_size'] = len(self._batch_queue)
		
		return stats
	
	# Private implementation methods
	
	async def _load_default_templates(self) -> None:
		"""Load default notification templates for common workflow events."""
		default_templates = [
			# Workflow lifecycle templates
			NotificationTemplate(
				template_id="workflow_started_default",
				event_type=WorkflowEventType.WORKFLOW_STARTED,
				title_template="Workflow Started: {{workflow_name}}",
				content_template="Workflow '{{workflow_name}}' has been started. {{description}}",
				default_priority=Priority.MEDIUM,
				default_channels=[ChannelType.IN_APP, ChannelType.EMAIL]
			),
			
			NotificationTemplate(
				template_id="workflow_completed_default",
				event_type=WorkflowEventType.WORKFLOW_COMPLETED,
				title_template="Workflow Completed: {{workflow_name}}",
				content_template="Workflow '{{workflow_name}}' has completed successfully. Duration: {{duration}}",
				default_priority=Priority.MEDIUM,
				default_channels=[ChannelType.IN_APP, ChannelType.EMAIL]
			),
			
			NotificationTemplate(
				template_id="workflow_failed_default",
				event_type=WorkflowEventType.WORKFLOW_FAILED,
				title_template="Workflow Failed: {{workflow_name}}",
				content_template="Workflow '{{workflow_name}}' has failed. Error: {{error_message}}",
				default_priority=Priority.HIGH,
				default_channels=[ChannelType.IN_APP, ChannelType.EMAIL, ChannelType.SMS]
			),
			
			# Task management templates
			NotificationTemplate(
				template_id="task_assigned_default",
				event_type=WorkflowEventType.TASK_ASSIGNED,
				title_template="New Task Assigned: {{task_name}}",
				content_template="You have been assigned task '{{task_name}}'. Due: {{due_date}}",
				default_priority=Priority.HIGH,
				default_channels=[ChannelType.IN_APP, ChannelType.EMAIL]
			),
			
			NotificationTemplate(
				template_id="task_overdue_default",
				event_type=WorkflowEventType.TASK_OVERDUE,
				title_template="Task Overdue: {{task_name}}",
				content_template="Task '{{task_name}}' is overdue. Due date was: {{due_date}}",
				default_priority=Priority.CRITICAL,
				default_channels=[ChannelType.IN_APP, ChannelType.EMAIL, ChannelType.SMS]
			),
			
			# Deadline templates
			NotificationTemplate(
				template_id="deadline_approaching_default",
				event_type=WorkflowEventType.DEADLINE_APPROACHING,
				title_template="Deadline Approaching: {{item_name}}",
				content_template="{{item_name}} deadline is approaching. Due: {{due_date}} ({{time_remaining}})",
				default_priority=Priority.HIGH,
				default_channels=[ChannelType.IN_APP, ChannelType.EMAIL]
			),
			
			# Document templates
			NotificationTemplate(
				template_id="document_generated_default",
				event_type=WorkflowEventType.DOCUMENT_GENERATED,
				title_template="Document Generated: {{document_name}}",
				content_template="Document '{{document_name}}' has been generated and is ready for review.",
				default_priority=Priority.MEDIUM,
				default_channels=[ChannelType.IN_APP, ChannelType.EMAIL]
			),
			
			NotificationTemplate(
				template_id="approval_request_default",
				event_type=WorkflowEventType.APPROVAL_REQUEST,
				title_template="Approval Required: {{item_name}}",
				content_template="Your approval is required for '{{item_name}}'. Please review and approve/reject.",
				default_priority=Priority.HIGH,
				default_channels=[ChannelType.IN_APP, ChannelType.EMAIL]
			),
			
			# System alerts
			NotificationTemplate(
				template_id="system_error_default",
				event_type=WorkflowEventType.SYSTEM_ERROR,
				title_template="System Error Alert",
				content_template="System error detected: {{error_message}}. Component: {{component}}",
				default_priority=Priority.CRITICAL,
				default_channels=[ChannelType.IN_APP, ChannelType.EMAIL, ChannelType.SMS]
			),
			
			NotificationTemplate(
				template_id="security_alert_default",
				event_type=WorkflowEventType.SECURITY_ALERT,
				title_template="Security Alert",
				content_template="Security event detected: {{alert_message}}. Please review immediately.",
				default_priority=Priority.CRITICAL,
				default_channels=[ChannelType.IN_APP, ChannelType.EMAIL, ChannelType.SMS]
			)
		]
		
		for template in default_templates:
			await self.add_notification_template(template)
		
		self.logger.info("Loaded %d default notification templates", len(default_templates))
	
	async def _should_process_event(self, event_type: WorkflowEventType, event_data: Dict[str, Any]) -> bool:
		"""Check if event should be processed based on filters."""
		for filter_func in self._event_filters:
			try:
				if not filter_func(event_type, event_data):
					return False
			except Exception as e:
				self.logger.warning("Event filter error: %s", str(e))
				continue
		
		return True
	
	async def _determine_affected_users(self, event_type: WorkflowEventType, event_data: Dict[str, Any]) -> List[str]:
		"""Determine which users should be notified for this event."""
		affected_users = []
		
		# Check for explicit user lists in event data
		if 'users' in event_data:
			affected_users.extend(event_data['users'])
		
		if 'assigned_user' in event_data:
			affected_users.append(event_data['assigned_user'])
		
		if 'created_by' in event_data:
			affected_users.append(event_data['created_by'])
		
		if 'workflow_owner' in event_data:
			affected_users.append(event_data['workflow_owner'])
		
		# Add stakeholders based on event type
		if event_type in [WorkflowEventType.APPROVAL_REQUEST, WorkflowEventType.DOCUMENT_REVIEWED]:
			if 'approvers' in event_data:
				affected_users.extend(event_data['approvers'])
		
		# Remove duplicates and filter by subscriptions
		unique_users = list(set(affected_users))
		subscribed_users = [
			user_id for user_id in unique_users
			if await self._is_user_subscribed(user_id, event_type)
		]
		
		return subscribed_users
	
	async def _get_applicable_templates(
		self,
		event_type: WorkflowEventType,
		event_data: Dict[str, Any]
	) -> List[NotificationTemplate]:
		"""Get notification templates applicable to this event."""
		return self._templates.get(event_type, [])
	
	async def _is_user_subscribed(self, user_id: str, event_type: WorkflowEventType) -> bool:
		"""Check if user is subscribed to this event type."""
		user_subscriptions = self._user_subscriptions.get(user_id, set())
		
		# If no explicit subscriptions, default to subscribing to high-priority events
		if not user_subscriptions:
			high_priority_events = {
				WorkflowEventType.TASK_ASSIGNED,
				WorkflowEventType.TASK_OVERDUE,
				WorkflowEventType.DEADLINE_APPROACHING,
				WorkflowEventType.APPROVAL_REQUEST,
				WorkflowEventType.SYSTEM_ERROR,
				WorkflowEventType.SECURITY_ALERT
			}
			return event_type in high_priority_events
		
		return event_type in user_subscriptions
	
	async def _evaluate_template_conditions(
		self,
		template: NotificationTemplate,
		event_data: Dict[str, Any],
		user_id: str
	) -> bool:
		"""Evaluate if template conditions are met."""
		if not template.conditions:
			return True
		
		# Simple condition evaluation (could be enhanced with more complex logic)
		for condition_key, condition_value in template.conditions.items():
			if condition_key in event_data:
				if event_data[condition_key] != condition_value:
					return False
			else:
				return False
		
		return True
	
	async def _create_notification_from_template(
		self,
		template: NotificationTemplate,
		event_type: WorkflowEventType,
		event_data: Dict[str, Any],
		user_id: str,
		workflow_id: Optional[str],
		priority_override: Optional[Priority]
	) -> Optional[str]:
		"""Create and send notification from template."""
		try:
			# Render template content
			title = await self._render_template(template.title_template, event_data)
			content = await self._render_template(template.content_template, event_data)
			
			self._integration_stats['template_renders'] += 1
			
			# Determine channels
			user_preferences = self._user_channel_preferences.get(user_id, {})
			preferred_channels = user_preferences.get(event_type, template.default_channels)
			
			if not preferred_channels:
				preferred_channels = [ChannelType.IN_APP]  # Fallback
			
			# Calculate priority
			if priority_override:
				final_priority = priority_override
			else:
				# Create metadata for priority calculation
				importance_contexts = await self._determine_importance_contexts(event_type, event_data)
				
				metadata = create_notification_metadata(
					notification_id=uuid7str(),
					user_id=user_id,
					title_keywords=title.split(),
					content_keywords=content.split(),
					importance_contexts=importance_contexts,
					workflow_id=workflow_id,
					**event_data
				)
				
				if self.priority_manager:
					priority_score = await self.priority_manager.calculate_priority(metadata)
					final_priority = Priority(priority_score.final_priority.value)
				else:
					final_priority = Priority.MEDIUM
			
			# Send notifications for each preferred channel
			notification_ids = []
			
			for channel in preferred_channels:
				# Check quiet hours
				if await self._is_quiet_hours(user_id, final_priority):
					continue
				
				# Create notification message
				message = NotificationMessage(
					title=title,
					content=content,
					recipient_id=user_id,
					channel=channel,
					priority=final_priority,
					workflow_id=workflow_id,
					event_type=event_type.value,
					tags=[event_type.value, 'workflow'],
					channel_data=template.channel_templates.get(channel, {})
				)
				
				# Send notification
				if self.batch_processing:
					self._batch_queue.append({
						'message': message,
						'event_type': event_type,
						'user_id': user_id
					})
				else:
					if self.notification_delivery:
						notification_id = await self.notification_delivery.send_notification(message)
						notification_ids.append(notification_id)
					
					# Track analytics
					await self._track_notification_sent(notification_id, user_id, channel, event_type)
			
			return notification_ids[0] if notification_ids else None
			
		except Exception as e:
			self.logger.error("Error creating notification from template %s: %s", 
							template.template_id, str(e))
			return None
	
	async def _render_template(self, template: str, data: Dict[str, Any]) -> str:
		"""Render notification template with data."""
		rendered = template
		
		# Simple template variable replacement
		for key, value in data.items():
			placeholder = f'{{{{{key}}}}}'
			rendered = rendered.replace(placeholder, str(value))
		
		# Add default variables
		rendered = rendered.replace('{{timestamp}}', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
		
		return rendered
	
	async def _determine_importance_contexts(
		self,
		event_type: WorkflowEventType,
		event_data: Dict[str, Any]
	) -> List[ImportanceContext]:
		"""Determine importance contexts for priority calculation."""
		contexts = []
		
		# Map event types to importance contexts
		context_mapping = {
			WorkflowEventType.DEADLINE_APPROACHING: [ImportanceContext.DEADLINE_CRITICAL],
			WorkflowEventType.DEADLINE_MISSED: [ImportanceContext.DEADLINE_CRITICAL],
			WorkflowEventType.TASK_OVERDUE: [ImportanceContext.DEADLINE_CRITICAL],
			WorkflowEventType.WORKFLOW_FAILED: [ImportanceContext.ERROR_RECOVERY],
			WorkflowEventType.SYSTEM_ERROR: [ImportanceContext.ERROR_RECOVERY],
			WorkflowEventType.SECURITY_ALERT: [ImportanceContext.SECURITY_ALERT],
			WorkflowEventType.APPROVAL_REQUEST: [ImportanceContext.STAKEHOLDER_PRIORITY],
			WorkflowEventType.COLLABORATION_REQUEST: [ImportanceContext.COLLABORATION_URGENT],
			WorkflowEventType.PERFORMANCE_ALERT: [ImportanceContext.PERFORMANCE_ALERT]
		}
		
		if event_type in context_mapping:
			contexts.extend(context_mapping[event_type])
		
		# Add revenue impact context if present
		if event_data.get('revenue_impact'):
			contexts.append(ImportanceContext.REVENUE_IMPACT)
		
		# Add compliance context if present
		if event_data.get('compliance_required'):
			contexts.append(ImportanceContext.COMPLIANCE_RISK)
		
		return contexts
	
	async def _is_quiet_hours(self, user_id: str, priority: Priority) -> bool:
		"""Check if it's quiet hours for user (except for critical notifications)."""
		if priority == Priority.CRITICAL:
			return False  # Always send critical notifications
		
		quiet_hours = self._user_quiet_hours.get(user_id)
		if not quiet_hours:
			return False
		
		# Simple quiet hours check (could be enhanced with timezone support)
		current_hour = datetime.now().hour
		start_hour = quiet_hours['start_hour']
		end_hour = quiet_hours['end_hour']
		
		if start_hour <= end_hour:
			return start_hour <= current_hour <= end_hour
		else:  # Overnight quiet hours
			return current_hour >= start_hour or current_hour <= end_hour
	
	async def _track_notification_sent(
		self,
		notification_id: str,
		user_id: str,
		channel: ChannelType,
		event_type: WorkflowEventType
	) -> None:
		"""Track notification sent event in analytics."""
		if not self.analytics:
			return
		
		event = create_notification_event(
			notification_id=notification_id,
			user_id=user_id,
			event_type=AnalyticsEvent.SENT,
			channel_type=channel.value,
			workflow_id=None,  # Could be extracted from context
			custom_attributes={'workflow_event_type': event_type.value}
		)
		
		await self.analytics.track_event(event)
	
	async def _execute_event_handlers(
		self,
		event_type: WorkflowEventType,
		event_data: Dict[str, Any],
		notification_ids: List[str]
	) -> None:
		"""Execute custom event handlers."""
		handlers = self._event_handlers.get(event_type, [])
		
		for handler in handlers:
			try:
				await handler(event_type, event_data, notification_ids)
			except Exception as e:
				self.logger.warning("Event handler error for %s: %s", event_type.value, str(e))
	
	async def _batch_processor(self) -> None:
		"""Background task for batch processing notifications."""
		self.logger.debug("Batch processor started")
		
		while self._running:
			try:
				await asyncio.sleep(self.batch_interval_seconds)
				
				if self._batch_queue:
					await self._process_batch()
				
			except Exception as e:
				self.logger.error("Batch processor error: %s", str(e))
				await asyncio.sleep(5)  # Brief pause on error
		
		self.logger.debug("Batch processor stopped")
	
	async def _process_batch(self) -> None:
		"""Process batched notification items."""
		if not self._batch_queue:
			return
		
		batch_items = self._batch_queue.copy()
		self._batch_queue.clear()
		
		self.logger.debug("Processing batch of %d notifications", len(batch_items))
		
		# Group by channel for efficient processing
		channel_groups = {}
		for item in batch_items:
			channel = item['message'].channel
			if channel not in channel_groups:
				channel_groups[channel] = []
			channel_groups[channel].append(item)
		
		# Process each channel group
		for channel, items in channel_groups.items():
			messages = [item['message'] for item in items]
			
			try:
				if self.notification_delivery:
					notification_ids = await self.notification_delivery.send_batch(messages)
				else:
					notification_ids = []
				
				# Track analytics for each notification
				for i, item in enumerate(items):
					if i < len(notification_ids):
						await self._track_notification_sent(
							notification_ids[i],
							item['user_id'],
							channel,
							item['event_type']
						)
				
			except Exception as e:
				self.logger.error("Batch processing error for channel %s: %s", channel.value, str(e))
		
		self._integration_stats['batch_processes'] += 1
		self.logger.debug("Completed batch processing")


# Utility functions for workflow notification integration

async def create_workflow_notification_integration(
	notification_channels: Optional[Dict[ChannelType, Any]] = None,
	**kwargs
) -> WorkflowNotificationIntegration:
	"""Factory function to create WorkflowNotificationIntegration instance."""
	# Create notification delivery with channels if provided
	delivery = None
	if notification_channels:
		delivery = await create_notification_delivery(channels=notification_channels)
	
	integration = WorkflowNotificationIntegration(
		notification_delivery=delivery,
		**kwargs
	)
	
	await integration.start()
	return integration


def create_workflow_event_data(
	workflow_name: str,
	workflow_id: str,
	**additional_data
) -> Dict[str, Any]:
	"""Create standardized workflow event data structure."""
	return {
		'workflow_name': workflow_name,
		'workflow_id': workflow_id,
		'timestamp': datetime.now().isoformat(),
		**additional_data
	}


# Example usage patterns

async def example_workflow_integration():
	"""Example of how to use the workflow notification integration."""
	# Create integration with multiple channels
	channels = {
		ChannelType.EMAIL: create_email_channel(
			EmailProvider.SMTP,
			from_email="notifications@docufusion.com"
		),
		ChannelType.SMS: create_sms_channel(
			SMSProvider.TWILIO,
			api_key="your_twilio_key"
		),
		ChannelType.IN_APP: create_inapp_channel()
	}
	
	integration = await create_workflow_notification_integration(
		notification_channels=channels,
		batch_processing=True
	)
	
	# Subscribe users to events
	await integration.subscribe_user("user123", [
		WorkflowEventType.TASK_ASSIGNED,
		WorkflowEventType.DEADLINE_APPROACHING,
		WorkflowEventType.APPROVAL_REQUEST
	])
	
	# Set user preferences
	await integration.set_user_channel_preferences("user123", {
		WorkflowEventType.TASK_ASSIGNED: [ChannelType.IN_APP, ChannelType.EMAIL],
		WorkflowEventType.DEADLINE_APPROACHING: [ChannelType.EMAIL, ChannelType.SMS],
		WorkflowEventType.APPROVAL_REQUEST: [ChannelType.IN_APP]
	})
	
	# Handle workflow events
	event_data = create_workflow_event_data(
		workflow_name="RFP Response Generation",
		workflow_id="workflow_001",
		assigned_user="user123",
		due_date="2024-01-15T17:00:00Z",
		task_name="Review Generated Content"
	)
	
	notification_ids = await integration.handle_workflow_event(
		WorkflowEventType.TASK_ASSIGNED,
		event_data
	)
	
	print(f"Sent {len(notification_ids)} notifications")
	
	# Get statistics
	stats = await integration.get_integration_statistics()
	print(f"Integration stats: {stats}")
	
	await integration.stop()