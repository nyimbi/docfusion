"""
Opportunity Notification Service

This module provides real-time notification capabilities for the discovery
engine, alerting stakeholders about new opportunities, analysis updates,
and critical deadlines.
"""

import asyncio
import logging
logger = logging.getLogger(__name__)
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Union
from uuid import uuid4

from pydantic import BaseModel, Field, ConfigDict

from ...core.services.notification_manager import NotificationManager
from ...core.models.notification_models import Notification, NotificationChannel
from ..models.opportunity_models import OpportunityData
from ..analyzers.opportunity_analyzer import OpportunityAnalysis


class NotificationType(Enum):
	"""Types of opportunity notifications"""
	NEW_OPPORTUNITY = "new_opportunity"
	HIGH_VALUE_OPPORTUNITY = "high_value_opportunity"
	STRATEGIC_OPPORTUNITY = "strategic_opportunity"
	ANALYSIS_COMPLETE = "analysis_complete"
	DEADLINE_APPROACHING = "deadline_approaching"
	STATUS_CHANGE = "status_change"
	COMPETITIVE_ALERT = "competitive_alert"
	CAPABILITY_MATCH = "capability_match"


class NotificationPriority(Enum):
	"""Notification priority levels"""
	LOW = "low"
	NORMAL = "normal"
	HIGH = "high"
	URGENT = "urgent"
	CRITICAL = "critical"


class NotificationRule(BaseModel):
	"""Rule for generating notifications"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	rule_id: str = Field(description="Unique rule identifier")
	rule_name: str = Field(description="Human-readable rule name")
	notification_type: NotificationType = Field(description="Type of notification to generate")
	
	# Trigger conditions
	trigger_conditions: Dict[str, Any] = Field(description="Conditions that trigger notification")
	priority: NotificationPriority = Field(description="Notification priority")
	
	# Targeting
	target_roles: List[str] = Field(default_factory=list, description="Target user roles")
	target_users: List[str] = Field(default_factory=list, description="Specific target users")
	channels: List[NotificationChannel] = Field(description="Delivery channels")
	
	# Timing
	delay_seconds: int = Field(default=0, description="Delay before sending notification")
	frequency_limit: Optional[str] = Field(None, description="Frequency limit (e.g., 'once_per_day')")
	
	# Content
	message_template: str = Field(description="Notification message template")
	action_url: Optional[str] = Field(None, description="URL for primary action")
	
	# Rule metadata
	is_active: bool = Field(default=True, description="Whether rule is active")
	created_date: datetime = Field(default_factory=datetime.now)
	last_triggered: Optional[datetime] = Field(None, description="When rule was last triggered")
	trigger_count: int = Field(default=0, description="Number of times rule has been triggered")


class OpportunityNotification(BaseModel):
	"""Opportunity-specific notification"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	notification_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique notification ID")
	opportunity_id: str = Field(description="Associated opportunity ID")
	notification_type: NotificationType = Field(description="Type of notification")
	priority: NotificationPriority = Field(description="Notification priority")
	
	# Content
	title: str = Field(description="Notification title")
	message: str = Field(description="Notification message")
	details: Dict[str, Any] = Field(default_factory=dict, description="Additional notification details")
	
	# Targeting and delivery
	recipients: List[str] = Field(description="Notification recipients")
	channels: List[NotificationChannel] = Field(description="Delivery channels")
	
	# Timing
	scheduled_time: datetime = Field(default_factory=datetime.now, description="When to send notification")
	expiry_time: Optional[datetime] = Field(None, description="When notification expires")
	
	# Status
	status: str = Field(default="pending", description="Notification status")
	sent_time: Optional[datetime] = Field(None, description="When notification was sent")
	delivery_attempts: int = Field(default=0, description="Number of delivery attempts")
	
	# Actions
	primary_action: Optional[Dict[str, str]] = Field(None, description="Primary action button")
	secondary_actions: List[Dict[str, str]] = Field(default_factory=list, description="Additional actions")


class NotificationSubscription(BaseModel):
	"""User notification subscription preferences"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	user_id: str = Field(description="User identifier")
	subscription_id: str = Field(default_factory=lambda: str(uuid4()), description="Subscription ID")
	
	# Preferences
	enabled_types: List[NotificationType] = Field(description="Enabled notification types")
	preferred_channels: List[NotificationChannel] = Field(description="Preferred delivery channels")
	
	# Filters
	value_threshold: Optional[float] = Field(None, description="Minimum opportunity value")
	industry_filters: List[str] = Field(default_factory=list, description="Industry filters")
	keyword_filters: List[str] = Field(default_factory=list, description="Keyword filters")
	
	# Timing preferences
	quiet_hours_start: Optional[int] = Field(None, description="Quiet hours start (24h format)")
	quiet_hours_end: Optional[int] = Field(None, description="Quiet hours end (24h format)")
	
	# Metadata
	created_date: datetime = Field(default_factory=datetime.now)
	last_updated: datetime = Field(default_factory=datetime.now)
	is_active: bool = Field(default=True, description="Whether subscription is active")


class OpportunityNotificationService:
	"""
	Comprehensive notification service for opportunity discovery
	
	Manages real-time notifications for stakeholders about opportunities,
	analysis updates, deadlines, and other discovery events.
	"""
	
	def __init__(self, notification_manager: Optional[NotificationManager] = None):
		self.notification_manager = notification_manager or NotificationManager()
		
		# Notification rules and subscriptions
		self.notification_rules: Dict[str, NotificationRule] = {}
		self.user_subscriptions: Dict[str, NotificationSubscription] = {}
		
		# Notification queue and history
		self.pending_notifications: List[OpportunityNotification] = []
		self.notification_history: List[OpportunityNotification] = []
		
		# Service statistics
		self.notifications_sent = 0
		self.notifications_failed = 0
		self.rules_triggered = 0
		
		# Initialize default notification rules
		self._initialize_default_rules()
		
		# Start background notification processor
		self._notification_processor_task = None
		self._start_notification_processor()
		
		self._log_service_initialized()
	
	def _initialize_default_rules(self) -> None:
		"""Initialize default notification rules"""
		
		default_rules = [
			NotificationRule(
				rule_id="new_high_value_opportunity",
				rule_name="High-Value Opportunity Alert",
				notification_type=NotificationType.HIGH_VALUE_OPPORTUNITY,
				trigger_conditions={'estimated_value': {'$gte': 5000000.0}},
				priority=NotificationPriority.HIGH,
				target_roles=['business_development', 'executive'],
				channels=[NotificationChannel.EMAIL, NotificationChannel.SLACK],
				message_template="🚀 High-value opportunity detected: {opportunity_title} (${estimated_value:,.0f})",
				action_url="/opportunities/{opportunity_id}"
			),
			
			NotificationRule(
				rule_id="strategic_fit_opportunity", 
				rule_name="Strategic Fit Opportunity",
				notification_type=NotificationType.STRATEGIC_OPPORTUNITY,
				trigger_conditions={'strategic_fit_score': {'$gte': 0.8}},
				priority=NotificationPriority.HIGH,
				target_roles=['strategy', 'business_development'],
				channels=[NotificationChannel.EMAIL, NotificationChannel.PUSH],
				message_template="🎯 Strategic opportunity identified: {opportunity_title} (Strategic Fit: {strategic_fit_score:.0%})",
				action_url="/opportunities/{opportunity_id}/analysis"
			),
			
			NotificationRule(
				rule_id="deadline_approaching",
				rule_name="Submission Deadline Approaching",
				notification_type=NotificationType.DEADLINE_APPROACHING,
				trigger_conditions={'days_until_deadline': {'$lte': 7}},
				priority=NotificationPriority.URGENT,
				target_roles=['proposal_team', 'project_manager'],
				channels=[NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.SLACK],
				message_template="⏰ Urgent: {opportunity_title} deadline in {days_until_deadline} days",
				action_url="/opportunities/{opportunity_id}/proposal"
			),
			
			NotificationRule(
				rule_id="strong_capability_match",
				rule_name="Strong Capability Match",
				notification_type=NotificationType.CAPABILITY_MATCH,
				trigger_conditions={'capability_match_score': {'$gte': 0.85}},
				priority=NotificationPriority.NORMAL,
				target_roles=['technical_lead', 'capability_manager'],
				channels=[NotificationChannel.EMAIL],
				message_template="✅ Excellent capability match: {opportunity_title} ({capability_match_score:.0%} match)",
				action_url="/opportunities/{opportunity_id}/qualification"
			),
			
			NotificationRule(
				rule_id="analysis_complete",
				rule_name="Opportunity Analysis Complete",
				notification_type=NotificationType.ANALYSIS_COMPLETE,
				trigger_conditions={'analysis_status': 'completed'},
				priority=NotificationPriority.NORMAL,
				target_roles=['business_development', 'technical_lead'],
				channels=[NotificationChannel.EMAIL],
				message_template="📊 Analysis complete for {opportunity_title} - Win Probability: {win_probability:.0%}",
				action_url="/opportunities/{opportunity_id}/results"
			)
		]
		
		for rule in default_rules:
			self.notification_rules[rule.rule_id] = rule
	
	async def process_opportunity_event(self, event_type: str, 
	                                   opportunity_data: OpportunityData,
	                                   analysis_data: Optional[Dict[str, Any]] = None) -> List[OpportunityNotification]:
		"""
		Process opportunity event and generate relevant notifications
		
		Args:
			event_type: Type of event (new_opportunity, analysis_update, status_change)
			opportunity_data: Opportunity data
			analysis_data: Optional analysis results
			
		Returns:
			List of generated notifications
		"""
		generated_notifications = []
		
		try:
			# Prepare event context
			event_context = {
				'opportunity_id': opportunity_data.id,
				'opportunity_title': opportunity_data.title,
				'estimated_value': opportunity_data.estimated_value or 0,
				'submission_deadline': opportunity_data.submission_deadline,
				'event_type': event_type,
				'event_timestamp': datetime.now()
			}
			
			# Add analysis data to context
			if analysis_data:
				event_context.update(analysis_data)
			
			# Calculate derived metrics
			if opportunity_data.submission_deadline:
				days_until_deadline = (opportunity_data.submission_deadline - datetime.now()).days
				event_context['days_until_deadline'] = days_until_deadline
			
			# Evaluate notification rules
			for rule in self.notification_rules.values():
				if not rule.is_active:
					continue
				
				# Check if rule conditions are met
				if self._evaluate_rule_conditions(rule, event_context):
					# Check frequency limits
					if self._check_frequency_limit(rule, opportunity_data.id):
						notification = await self._generate_notification(rule, event_context)
						if notification:
							generated_notifications.append(notification)
							
							# Update rule trigger statistics
							rule.last_triggered = datetime.now()
							rule.trigger_count += 1
							self.rules_triggered += 1
			
			# Queue notifications for delivery
			for notification in generated_notifications:
				await self._queue_notification(notification)
			
			self._log_event_processed(event_type, opportunity_data.id, len(generated_notifications))
			return generated_notifications
			
		except Exception as e:
			self._log_event_error(f"Failed to process event {event_type} for {opportunity_data.id}: {str(e)}")
			return []
	
	def _evaluate_rule_conditions(self, rule: NotificationRule, context: Dict[str, Any]) -> bool:
		"""Evaluate whether rule conditions are met"""
		
		try:
			for field, condition in rule.trigger_conditions.items():
				if field not in context:
					return False
				
				value = context[field]
				
				if isinstance(condition, dict):
					# Handle comparison operators
					for operator, threshold in condition.items():
						if operator == '$gte' and value < threshold:
							return False
						elif operator == '$lte' and value > threshold:
							return False
						elif operator == '$gt' and value <= threshold:
							return False
						elif operator == '$lt' and value >= threshold:
							return False
						elif operator == '$eq' and value != threshold:
							return False
						elif operator == '$ne' and value == threshold:
							return False
				else:
					# Direct equality check
					if value != condition:
						return False
			
			return True
			
		except Exception as e:
			self._log_rule_error(f"Rule evaluation failed for {rule.rule_id}: {str(e)}")
			return False
	
	def _check_frequency_limit(self, rule: NotificationRule, opportunity_id: str) -> bool:
		"""Check if notification frequency limit allows sending"""
		
		if not rule.frequency_limit:
			return True  # No frequency limit
		
		if not rule.last_triggered:
			return True  # Never triggered before
		
		# Calculate time since last trigger
		time_since_last = datetime.now() - rule.last_triggered
		
		# Check frequency limits
		if rule.frequency_limit == 'once_per_day':
			return time_since_last >= timedelta(days=1)
		elif rule.frequency_limit == 'once_per_hour':
			return time_since_last >= timedelta(hours=1)
		elif rule.frequency_limit == 'once_per_opportunity':
			# Check if we've already notified for this specific opportunity
			# In a real implementation, would check against opportunity-specific history
			return True
		
		return True  # Default to allowing
	
	async def _generate_notification(self, rule: NotificationRule, 
	                                 context: Dict[str, Any]) -> Optional[OpportunityNotification]:
		"""Generate notification from rule and context"""
		
		try:
			# Format message using context
			message = rule.message_template.format(**context)
			
			# Generate title
			title = f"{rule.notification_type.value.replace('_', ' ').title()}"
			
			# Determine recipients
			recipients = await self._determine_recipients(rule, context)
			
			if not recipients:
				self._log_notification_skip(rule.rule_id, "no recipients")
				return None
			
			# Calculate scheduled time
			scheduled_time = datetime.now() + timedelta(seconds=rule.delay_seconds)
			
			# Generate action URL
			action_url = None
			if rule.action_url:
				action_url = rule.action_url.format(**context)
			
			# Create primary action
			primary_action = None
			if action_url:
				primary_action = {
					'text': 'View Opportunity',
					'url': action_url
				}
			
			# Create notification
			notification = OpportunityNotification(
				opportunity_id=context['opportunity_id'],
				notification_type=rule.notification_type,
				priority=rule.priority,
				title=title,
				message=message,
				details=dict(context),
				recipients=recipients,
				channels=rule.channels,
				scheduled_time=scheduled_time,
				primary_action=primary_action
			)
			
			return notification
			
		except Exception as e:
			self._log_notification_error(f"Failed to generate notification for rule {rule.rule_id}: {str(e)}")
			return None
	
	async def _determine_recipients(self, rule: NotificationRule, context: Dict[str, Any]) -> List[str]:
		"""Determine notification recipients based on rule and user subscriptions"""
		
		recipients = set()
		
		# Add explicitly targeted users
		recipients.update(rule.target_users)
		
		# Add users based on roles
		# In a real implementation, would query user management system
		role_users = {
			'business_development': ['bd_manager', 'sales_lead'],
			'technical_lead': ['tech_manager', 'solution_architect'],
			'proposal_team': ['proposal_manager', 'writer'],
			'executive': ['ceo', 'business_director'],
			'strategy': ['strategy_manager'],
			'project_manager': ['pm_lead'],
			'capability_manager': ['capability_lead']
		}
		
		for role in rule.target_roles:
			if role in role_users:
				recipients.update(role_users[role])
		
		# Filter based on user subscriptions
		filtered_recipients = []
		for user_id in recipients:
			if await self._should_notify_user(user_id, rule.notification_type, context):
				filtered_recipients.append(user_id)
		
		return filtered_recipients
	
	async def _should_notify_user(self, user_id: str, notification_type: NotificationType,
	                              context: Dict[str, Any]) -> bool:
		"""Check if user should receive notification based on their subscription"""
		
		if user_id not in self.user_subscriptions:
			return True  # Default to notify if no subscription preferences
		
		subscription = self.user_subscriptions[user_id]
		
		if not subscription.is_active:
			return False
		
		# Check if notification type is enabled
		if notification_type not in subscription.enabled_types:
			return False
		
		# Check value threshold
		if (subscription.value_threshold and 
		    context.get('estimated_value', 0) < subscription.value_threshold):
			return False
		
		# Check industry filters
		if (subscription.industry_filters and 
		    context.get('industry') not in subscription.industry_filters):
			return False
		
		# Check keyword filters
		if subscription.keyword_filters:
			opportunity_text = f"{context.get('opportunity_title', '')} {context.get('description', '')}"
			if not any(keyword.lower() in opportunity_text.lower() 
			          for keyword in subscription.keyword_filters):
				return False
		
		# Check quiet hours
		if subscription.quiet_hours_start and subscription.quiet_hours_end:
			current_hour = datetime.now().hour
			if subscription.quiet_hours_start <= current_hour <= subscription.quiet_hours_end:
				return False
		
		return True
	
	async def _queue_notification(self, notification: OpportunityNotification) -> None:
		"""Queue notification for delivery"""
		
		try:
			# Add to pending queue
			self.pending_notifications.append(notification)
			
			# Sort by priority and scheduled time
			self.pending_notifications.sort(
				key=lambda n: (
					self._priority_order(n.priority),
					n.scheduled_time
				)
			)
			
			self._log_notification_queued(notification.notification_id, notification.priority.value)
			
		except Exception as e:
			self._log_notification_error(f"Failed to queue notification {notification.notification_id}: {str(e)}")
	
	def _priority_order(self, priority: NotificationPriority) -> int:
		"""Convert priority to numeric order for sorting"""
		priority_map = {
			NotificationPriority.CRITICAL: 0,
			NotificationPriority.URGENT: 1,
			NotificationPriority.HIGH: 2,
			NotificationPriority.NORMAL: 3,
			NotificationPriority.LOW: 4
		}
		return priority_map.get(priority, 5)
	
	def _start_notification_processor(self) -> None:
		"""Start background task to process notifications"""
		if self._notification_processor_task is None:
			self._notification_processor_task = asyncio.create_task(self._notification_processor())
	
	async def _notification_processor(self) -> None:
		"""Background processor for sending queued notifications"""
		while True:
			try:
				# Process pending notifications
				current_time = datetime.now()
				ready_notifications = []
				
				# Find notifications ready to send
				for notification in self.pending_notifications[:]:
					if notification.scheduled_time <= current_time:
						ready_notifications.append(notification)
						self.pending_notifications.remove(notification)
				
				# Send ready notifications
				for notification in ready_notifications:
					await self._send_notification(notification)
				
				# Sleep before next check
				await asyncio.sleep(30)  # Check every 30 seconds
				
			except Exception as e:
				self._log_processor_error(f"Notification processor error: {str(e)}")
				await asyncio.sleep(60)  # Longer sleep on error
	
	async def _send_notification(self, notification: OpportunityNotification) -> None:
		"""Send individual notification through configured channels"""
		
		try:
			notification.delivery_attempts += 1
			
			# Prepare notification data for delivery
			notification_data = Notification(
				notification_id=notification.notification_id,
				title=notification.title,
				message=notification.message,
				recipients=notification.recipients,
				channels=notification.channels,
				priority=notification.priority.value,
				metadata=notification.details
			)
			
			# Send through notification manager
			delivery_result = await self.notification_manager.send_notification(notification_data)
			
			if delivery_result.success:
				notification.status = "sent"
				notification.sent_time = datetime.now()
				self.notifications_sent += 1
				
				self._log_notification_sent(notification.notification_id, len(notification.recipients))
			else:
				notification.status = "failed"
				self.notifications_failed += 1
				
				# Retry logic for failed notifications
				if notification.delivery_attempts < 3:
					# Reschedule for retry
					notification.scheduled_time = datetime.now() + timedelta(minutes=15)
					self.pending_notifications.append(notification)
					
					self._log_notification_retry(notification.notification_id, notification.delivery_attempts)
				else:
					self._log_notification_failed(notification.notification_id, delivery_result.error_message)
			
			# Move to history
			self.notification_history.append(notification)
			
			# Cleanup old history entries
			if len(self.notification_history) > 1000:
				self.notification_history = self.notification_history[-500:]
			
		except Exception as e:
			notification.status = "error"
			self.notifications_failed += 1
			
			self._log_notification_error(f"Failed to send notification {notification.notification_id}: {str(e)}")
	
	async def create_subscription(self, user_id: str, preferences: Dict[str, Any]) -> NotificationSubscription:
		"""Create notification subscription for user"""
		
		subscription = NotificationSubscription(
			user_id=user_id,
			enabled_types=[NotificationType(t) for t in preferences.get('enabled_types', [])],
			preferred_channels=[NotificationChannel(c) for c in preferences.get('preferred_channels', [])],
			value_threshold=preferences.get('value_threshold'),
			industry_filters=preferences.get('industry_filters', []),
			keyword_filters=preferences.get('keyword_filters', []),
			quiet_hours_start=preferences.get('quiet_hours_start'),
			quiet_hours_end=preferences.get('quiet_hours_end')
		)
		
		self.user_subscriptions[user_id] = subscription
		
		self._log_subscription_created(user_id)
		return subscription
	
	async def update_subscription(self, user_id: str, preferences: Dict[str, Any]) -> Optional[NotificationSubscription]:
		"""Update user notification subscription"""
		
		if user_id not in self.user_subscriptions:
			return None
		
		subscription = self.user_subscriptions[user_id]
		
		# Update preferences
		if 'enabled_types' in preferences:
			subscription.enabled_types = [NotificationType(t) for t in preferences['enabled_types']]
		
		if 'preferred_channels' in preferences:
			subscription.preferred_channels = [NotificationChannel(c) for c in preferences['preferred_channels']]
		
		if 'value_threshold' in preferences:
			subscription.value_threshold = preferences['value_threshold']
		
		if 'industry_filters' in preferences:
			subscription.industry_filters = preferences['industry_filters']
		
		if 'keyword_filters' in preferences:
			subscription.keyword_filters = preferences['keyword_filters']
		
		subscription.last_updated = datetime.now()
		
		self._log_subscription_updated(user_id)
		return subscription
	
	async def get_notification_statistics(self) -> Dict[str, Any]:
		"""Get comprehensive notification service statistics"""
		
		# Calculate success rate
		total_notifications = self.notifications_sent + self.notifications_failed
		success_rate = (
			self.notifications_sent / total_notifications
			if total_notifications > 0 else 1.0
		)
		
		# Queue statistics
		queue_size = len(self.pending_notifications)
		priority_distribution = {}
		
		for notification in self.pending_notifications:
			priority = notification.priority.value
			priority_distribution[priority] = priority_distribution.get(priority, 0) + 1
		
		# Rule statistics
		active_rules = sum(1 for rule in self.notification_rules.values() if rule.is_active)
		
		return {
			'notifications_sent': self.notifications_sent,
			'notifications_failed': self.notifications_failed,
			'success_rate': success_rate,
			'rules_triggered': self.rules_triggered,
			'active_rules': active_rules,
			'total_rules': len(self.notification_rules),
			'active_subscriptions': len(self.user_subscriptions),
			'queue_statistics': {
				'queue_size': queue_size,
				'priority_distribution': priority_distribution
			},
			'service_status': 'active'
		}
	
	# Logging methods
	
	def _log_service_initialized(self) -> None:
		"""Log service initialization"""
		logger.info(f"OpportunityNotificationService: Service initialized with {len(self.notification_rules)} rules")
	
	def _log_event_processed(self, event_type: str, opportunity_id: str, notifications_count: int) -> None:
		"""Log event processing completion"""
		logger.info(f"OpportunityNotificationService: Processed {event_type} for {opportunity_id} - {notifications_count} notifications generated")
	
	def _log_event_error(self, message: str) -> None:
		"""Log event processing errors"""
		logger.error(f"OpportunityNotificationService Event Error: {message}")
	
	def _log_rule_error(self, message: str) -> None:
		"""Log rule evaluation errors"""
		logger.error(f"OpportunityNotificationService Rule Error: {message}")
	
	def _log_notification_skip(self, rule_id: str, reason: str) -> None:
		"""Log skipped notification"""
		logger.info(f"OpportunityNotificationService: Skipped notification for rule {rule_id} - {reason}")
	
	def _log_notification_error(self, message: str) -> None:
		"""Log notification errors"""
		logger.error(f"OpportunityNotificationService Notification Error: {message}")
	
	def _log_notification_queued(self, notification_id: str, priority: str) -> None:
		"""Log queued notification"""
		logger.info(f"OpportunityNotificationService: Queued notification {notification_id} (priority: {priority})")
	
	def _log_notification_sent(self, notification_id: str, recipient_count: int) -> None:
		"""Log sent notification"""
		logger.info(f"OpportunityNotificationService: Sent notification {notification_id} to {recipient_count} recipients")
	
	def _log_notification_retry(self, notification_id: str, attempt: int) -> None:
		"""Log notification retry"""
		logger.info(f"OpportunityNotificationService: Retrying notification {notification_id} (attempt {attempt})")
	
	def _log_notification_failed(self, notification_id: str, error: Optional[str]) -> None:
		"""Log failed notification"""
		logger.error(f"OpportunityNotificationService: Failed to send notification {notification_id} - {error}")
	
	def _log_processor_error(self, message: str) -> None:
		"""Log processor errors"""
		logger.error(f"OpportunityNotificationService Processor Error: {message}")
	
	def _log_subscription_created(self, user_id: str) -> None:
		"""Log subscription creation"""
		logger.info(f"OpportunityNotificationService: Created subscription for user {user_id}")
	
	def _log_subscription_updated(self, user_id: str) -> None:
		"""Log subscription update"""
		logger.info(f"OpportunityNotificationService: Updated subscription for user {user_id}")


# Example usage and testing
async def test_notification_service():
	"""Test notification service functionality"""
	
	# Initialize notification service
	notification_service = OpportunityNotificationService()
	
	# Sample opportunity data
	opportunity = OpportunityData(
		id="test_notification_001",
		title="Enterprise AI Platform Development",
		description="Develop enterprise-scale AI platform with machine learning capabilities",
		estimated_value=7500000.0,  # High value to trigger notification
		submission_deadline=datetime.now() + timedelta(days=5)  # Approaching deadline
	)
	
	# Sample analysis data
	analysis_data = {
		'strategic_fit_score': 0.85,
		'capability_match_score': 0.90,
		'win_probability': 0.72,
		'analysis_status': 'completed'
	}
	
	# Create test subscription
	await notification_service.create_subscription(
		'test_user',
		{
			'enabled_types': ['high_value_opportunity', 'strategic_opportunity', 'deadline_approaching'],
			'preferred_channels': ['email', 'push'],
			'value_threshold': 5000000.0
		}
	)
	
	# Process opportunity events
	notifications = await notification_service.process_opportunity_event(
		'new_opportunity',
		opportunity,
		analysis_data
	)
	
	# Wait a moment for processing
	await asyncio.sleep(1)
	
	# Get statistics
	stats = await notification_service.get_notification_statistics()
	
	return len(notifications), stats


if __name__ == "__main__":
	# Test the notification service
	import asyncio
	
	async def main():
		notification_count, stats = await test_notification_service()
		logger.info(f"Generated Notifications: {notification_count}")
		logger.info(f"Notification Statistics:")
		logger.info(f"- Rules Triggered: {stats['rules_triggered']}")
		logger.info(f"- Active Rules: {stats['active_rules']}")
		logger.info(f"- Queue Size: {stats['queue_statistics']['queue_size']}")
		logger.info(f"- Success Rate: {stats['success_rate']:.2%}")
		
	asyncio.run(main())