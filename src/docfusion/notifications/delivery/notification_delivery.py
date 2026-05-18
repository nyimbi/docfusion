"""
NotificationDelivery - Week 20 Multi-Channel Notification Delivery System

Implements comprehensive notification delivery with multi-channel support,
delivery confirmation, retry logic, and optimization based on user preferences.
Provides enterprise-grade reliability and performance for workflow notifications.
"""

import asyncio
import logging

# from ...core.utils import uuid7str
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.types import conint
from ...core.utils import uuid7str

class DeliveryStatus(str, Enum):
    """Notification delivery status tracking."""

    PENDING = "pending"
    QUEUED = "queued"
    SENDING = "sending"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETRYING = "retrying"
    EXPIRED = "expired"
    CANCELLED = "cancelled"

class ChannelType(str, Enum):
    """Supported notification delivery channels."""

    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    IN_APP = "in_app"
    WEBHOOK = "webhook"
    SLACK = "slack"
    TEAMS = "teams"

class Priority(str, Enum):
    """Notification priority levels for delivery optimization."""

    CRITICAL = "critical"  # Immediate delivery, bypass quiet hours
    HIGH = "high"  # Priority queue, minimal delay
    MEDIUM = "medium"  # Standard delivery
    LOW = "low"  # Batch delivery, respect quiet hours

@dataclass
class DeliveryMetrics:
    """Comprehensive delivery performance metrics."""

    total_sent: int = 0
    total_delivered: int = 0
    total_failed: int = 0
    total_retries: int = 0
    average_delivery_time: float = 0.0
    success_rate: float = 0.0
    channel_performance: Dict[ChannelType, Dict[str, float]] = field(
        default_factory=dict
    )
    last_updated: datetime = field(default_factory=datetime.now)

class NotificationMessage(BaseModel):
    """Structured notification message with delivery requirements."""

    model_config = ConfigDict(
        extra="forbid", validate_by_name=True, validate_by_alias=True
    )

    id: str = Field(default_factory=uuid7str, description="Unique message identifier")
    title: str = Field(
        ..., min_length=1, max_length=200, description="Notification title"
    )
    content: str = Field(
        ..., min_length=1, max_length=5000, description="Message content"
    )
    recipient_id: str = Field(..., description="Target recipient identifier")
    channel: ChannelType = Field(..., description="Delivery channel")
    priority: Priority = Field(default=Priority.MEDIUM, description="Delivery priority")

    # Delivery configuration
    retry_count: conint(ge=0, le=10) = Field(
        default=3, description="Maximum retry attempts"
    )
    retry_delay: conint(ge=1, le=3600) = Field(
        default=60, description="Retry delay in seconds"
    )
    expires_at: Optional[datetime] = Field(None, description="Message expiration time")
    scheduled_at: Optional[datetime] = Field(
        None, description="Scheduled delivery time"
    )

    # Channel-specific data
    channel_data: Dict[str, Any] = Field(
        default_factory=dict, description="Channel-specific parameters"
    )

    # Metadata
    workflow_id: Optional[str] = Field(
        None, description="Associated workflow identifier"
    )
    event_type: Optional[str] = Field(None, description="Triggering event type")
    tags: List[str] = Field(
        default_factory=list, description="Message classification tags"
    )

    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    @field_validator("expires_at")
    @classmethod
    def validate_expiry(cls, v, values):
        """Ensure expiry time is in the future."""
        if v and v <= datetime.now():
            raise ValueError("Expiry time must be in the future")
        return v

    @field_validator("scheduled_at")
    @classmethod
    def validate_schedule(cls, v, values):
        """Ensure scheduled time is valid."""
        if v and v <= datetime.now():
            raise ValueError("Scheduled time must be in the future")
        return v

class DeliveryResult(BaseModel):
    """Detailed delivery attempt result."""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    message_id: str = Field(..., description="Message identifier")
    status: DeliveryStatus = Field(..., description="Delivery status")
    channel: ChannelType = Field(..., description="Delivery channel")
    attempted_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")

    # Result details
    success: bool = Field(..., description="Delivery success flag")
    error_message: Optional[str] = Field(
        None, description="Error description if failed"
    )
    error_code: Optional[str] = Field(None, description="Error classification code")
    retry_after: Optional[int] = Field(
        None, description="Suggested retry delay in seconds"
    )

    # Performance metrics
    delivery_time_ms: Optional[int] = Field(
        None, description="Delivery time in milliseconds"
    )
    network_latency_ms: Optional[int] = Field(None, description="Network latency")
    provider_response: Optional[Dict[str, Any]] = Field(default_factory=dict)

    # Tracking data
    tracking_id: Optional[str] = Field(
        None, description="External provider tracking ID"
    )
    receipt_id: Optional[str] = Field(None, description="Delivery receipt identifier")

class NotificationChannel(Protocol):
    """Protocol defining notification channel interface."""

    async def send(self, message: NotificationMessage) -> DeliveryResult:
        """Send notification through this channel."""
        ...

    async def validate_recipient(self, recipient_id: str) -> bool:
        """Validate recipient can receive notifications on this channel."""
        ...

    def get_channel_type(self) -> ChannelType:
        """Get the channel type identifier."""
        ...

    def supports_priority(self, priority: Priority) -> bool:
        """Check if channel supports given priority level."""
        ...

class RetryStrategy:
    """Configurable retry strategy for failed deliveries."""

    def __init__(
        self,
        max_retries: int = 3,
        base_delay: int = 60,
        exponential_backoff: bool = True,
        max_delay: int = 3600,
        jitter: bool = True,
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.exponential_backoff = exponential_backoff
        self.max_delay = max_delay
        self.jitter = jitter

    def calculate_delay(self, attempt: int) -> int:
        """Calculate retry delay for given attempt number."""
        if self.exponential_backoff:
            delay = self.base_delay * (2**attempt)
        else:
            delay = self.base_delay

        # Apply maximum delay limit
        delay = min(delay, self.max_delay)

        # Add jitter to prevent thundering herd
        if self.jitter:
            import random

            delay = delay + random.randint(0, delay // 4)

        return delay

class NotificationDelivery:
    """
    Enterprise-grade notification delivery system with multi-channel support.

    Provides comprehensive notification delivery with:
    - Multi-channel delivery (email, SMS, push, in-app, webhook)
    - Intelligent retry logic with exponential backoff
    - Delivery confirmation and tracking
    - Performance optimization based on user preferences
    - Real-time metrics and analytics
    - Batch processing for efficiency
    - Queue management with priority handling
    """

    def __init__(
        self,
        channels: Optional[Dict[ChannelType, NotificationChannel]] = None,
        retry_strategy: Optional[RetryStrategy] = None,
        batch_size: int = 100,
        worker_count: int = 5,
        metrics_enabled: bool = True,
    ):
        self.channels = channels or {}
        self.retry_strategy = retry_strategy or RetryStrategy()
        self.batch_size = batch_size
        self.worker_count = worker_count
        self.metrics_enabled = metrics_enabled

        # Internal state
        self._delivery_queue: asyncio.Queue = asyncio.Queue()
        self._retry_queue: asyncio.Queue = asyncio.Queue()
        self._scheduled_queue: List[NotificationMessage] = []
        self._active_deliveries: Dict[str, NotificationMessage] = {}
        self._delivery_results: Dict[str, List[DeliveryResult]] = {}
        self._metrics = DeliveryMetrics()
        self._workers: List[asyncio.Task] = []
        self._scheduler_task: Optional[asyncio.Task] = None
        self._running = False

        # Performance optimization
        self._delivery_preferences: Dict[str, Dict[str, Any]] = {}
        self._channel_health: Dict[ChannelType, Dict[str, Any]] = {}

        # Logging
        self.logger = logging.getLogger(__name__)
        self.logger.info(
            "NotificationDelivery initialized with %d channels", len(self.channels)
        )

    async def start(self) -> None:
        """Start the notification delivery service."""
        if self._running:
            self.logger.warning("Delivery service already running")
            return

        self._running = True
        self.logger.info(
            "Starting notification delivery service with %d workers", self.worker_count
        )

        # Start worker tasks
        for i in range(self.worker_count):
            worker = asyncio.create_task(self._delivery_worker(f"worker-{i}"))
            self._workers.append(worker)

        # Start scheduler task
        self._scheduler_task = asyncio.create_task(self._scheduler_worker())

        # Initialize channel health monitoring
        await self._initialize_channel_health()

        self.logger.info("Notification delivery service started successfully")

    async def stop(self) -> None:
        """Stop the notification delivery service gracefully."""
        if not self._running:
            return

        self.logger.info("Stopping notification delivery service...")
        self._running = False

        # Cancel scheduler
        if self._scheduler_task:
            self._scheduler_task.cancel()
            try:
                await self._scheduler_task
            except asyncio.CancelledError:
                pass

        # Cancel workers
        for worker in self._workers:
            worker.cancel()

        # Wait for workers to complete
        if self._workers:
            await asyncio.gather(*self._workers, return_exceptions=True)

        self._workers.clear()
        self.logger.info("Notification delivery service stopped")

    def register_channel(
        self, channel_type: ChannelType, channel: NotificationChannel
    ) -> None:
        """Register a notification delivery channel."""
        self.channels[channel_type] = channel
        self._channel_health[channel_type] = {
            "available": True,
            "last_success": None,
            "last_failure": None,
            "failure_count": 0,
            "success_rate": 1.0,
        }
        self.logger.info("Registered channel: %s", channel_type.value)

    def unregister_channel(self, channel_type: ChannelType) -> None:
        """Unregister a notification delivery channel."""
        if channel_type in self.channels:
            del self.channels[channel_type]
            del self._channel_health[channel_type]
            self.logger.info("Unregistered channel: %s", channel_type.value)

    async def send_notification(self, message: NotificationMessage) -> str:
        """
        Queue notification for delivery.

        Args:
                message: Notification message to deliver

        Returns:
                Message ID for tracking
        """
        # Validate message
        await self._validate_message(message)

        # Check if scheduled for future delivery
        if message.scheduled_at and message.scheduled_at > datetime.now():
            self._scheduled_queue.append(message)
            self.logger.debug(
                "Scheduled message %s for delivery at %s",
                message.id,
                message.scheduled_at,
            )
            return message.id

        # Queue for immediate delivery
        await self._delivery_queue.put(message)
        self.logger.debug("Queued message %s for immediate delivery", message.id)

        # Initialize tracking
        self._delivery_results[message.id] = []

        return message.id

    async def send_batch(self, messages: List[NotificationMessage]) -> List[str]:
        """
        Queue multiple notifications for batch delivery.

        Args:
                messages: List of notification messages

        Returns:
                List of message IDs for tracking
        """
        message_ids = []

        for message in messages:
            message_id = await self.send_notification(message)
            message_ids.append(message_id)

        self.logger.info("Queued batch of %d messages for delivery", len(messages))
        return message_ids

    async def get_delivery_status(self, message_id: str) -> Optional[DeliveryResult]:
        """Get latest delivery status for a message."""
        results = self._delivery_results.get(message_id, [])
        return results[-1] if results else None

    async def get_delivery_history(self, message_id: str) -> List[DeliveryResult]:
        """Get complete delivery history for a message."""
        return self._delivery_results.get(message_id, [])

    async def cancel_notification(self, message_id: str) -> bool:
        """Cancel a pending notification."""
        # Remove from active deliveries
        if message_id in self._active_deliveries:
            del self._active_deliveries[message_id]

            # Record cancellation
            result = DeliveryResult(
                message_id=message_id,
                status=DeliveryStatus.CANCELLED,
                channel=ChannelType.EMAIL,  # Default, will be updated
                success=False,
                error_message="Cancelled by user",
            )

            self._delivery_results.setdefault(message_id, []).append(result)
            self.logger.info("Cancelled notification %s", message_id)
            return True

        return False

    def get_metrics(self) -> DeliveryMetrics:
        """Get current delivery performance metrics."""
        return self._metrics

    def set_delivery_preference(
        self, recipient_id: str, preferences: Dict[str, Any]
    ) -> None:
        """Set delivery preferences for a recipient."""
        self._delivery_preferences[recipient_id] = preferences
        self.logger.debug("Updated delivery preferences for recipient %s", recipient_id)

    async def _validate_message(self, message: NotificationMessage) -> None:
        """Validate notification message before delivery."""
        # Check channel availability
        if message.channel not in self.channels:
            raise ValueError(f"Channel {message.channel.value} not registered")

        # Check channel health
        channel_health = self._channel_health.get(message.channel, {})
        if not channel_health.get("available", True):
            raise ValueError(f"Channel {message.channel.value} currently unavailable")

        # Validate recipient
        channel = self.channels[message.channel]
        if not await channel.validate_recipient(message.recipient_id):
            raise ValueError(
                f"Invalid recipient {message.recipient_id} for channel {message.channel.value}"
            )

        # Check expiry
        if message.expires_at and message.expires_at <= datetime.now():
            raise ValueError("Message has already expired")

    async def _delivery_worker(self, worker_id: str) -> None:
        """Background worker for processing delivery queue."""
        self.logger.debug("Delivery worker %s started", worker_id)

        while self._running:
            try:
                # Get message from queue with timeout
                try:
                    message = await asyncio.wait_for(
                        self._delivery_queue.get(), timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue

                # Process message
                await self._process_message(message, worker_id)

            except Exception as e:
                self.logger.error("Worker %s encountered error: %s", worker_id, str(e))
                await asyncio.sleep(1)  # Brief pause on error

        self.logger.debug("Delivery worker %s stopped", worker_id)

    async def _process_message(
        self, message: NotificationMessage, worker_id: str
    ) -> None:
        """Process individual message delivery."""
        self.logger.debug("Worker %s processing message %s", worker_id, message.id)

        # Check expiry
        if message.expires_at and message.expires_at <= datetime.now():
            await self._record_delivery_result(
                message,
                DeliveryResult(
                    message_id=message.id,
                    status=DeliveryStatus.EXPIRED,
                    channel=message.channel,
                    success=False,
                    error_message="Message expired before delivery",
                ),
            )
            return

        # Track active delivery
        self._active_deliveries[message.id] = message

        try:
            # Apply delivery preferences
            await self._apply_delivery_preferences(message)

            # Attempt delivery
            channel = self.channels[message.channel]

            start_time = datetime.now()
            result = await channel.send(message)
            delivery_time = (datetime.now() - start_time).total_seconds() * 1000

            # Update delivery time
            result.delivery_time_ms = int(delivery_time)
            result.completed_at = datetime.now()

            # Record result
            await self._record_delivery_result(message, result)

            # Handle retry if needed
            if not result.success and self._should_retry(message, result):
                await self._schedule_retry(message, result)

        except Exception as e:
            # Create error result
            error_result = DeliveryResult(
                message_id=message.id,
                status=DeliveryStatus.FAILED,
                channel=message.channel,
                success=False,
                error_message=str(e),
                error_code="DELIVERY_EXCEPTION",
            )

            await self._record_delivery_result(message, error_result)

            # Schedule retry if appropriate
            if self._should_retry(message, error_result):
                await self._schedule_retry(message, error_result)

        finally:
            # Remove from active deliveries
            self._active_deliveries.pop(message.id, None)

    async def _record_delivery_result(
        self, message: NotificationMessage, result: DeliveryResult
    ) -> None:
        """Record delivery result and update metrics."""
        self._delivery_results.setdefault(message.id, []).append(result)

        # Update metrics
        if self.metrics_enabled:
            await self._update_metrics(result)

        # Update channel health
        await self._update_channel_health(result)

        self.logger.debug(
            "Recorded delivery result for message %s: %s",
            message.id,
            result.status.value,
        )

    def _should_retry(
        self, message: NotificationMessage, result: DeliveryResult
    ) -> bool:
        """Determine if message should be retried."""
        if result.success:
            return False

        # Check retry count
        current_attempts = len(
            [r for r in self._delivery_results.get(message.id, []) if not r.success]
        )
        if current_attempts >= message.retry_count:
            return False

        # Check if error is retryable
        non_retryable_codes = ["INVALID_RECIPIENT", "EXPIRED", "CANCELLED"]
        if result.error_code in non_retryable_codes:
            return False

        return True

    async def _schedule_retry(
        self, message: NotificationMessage, last_result: DeliveryResult
    ) -> None:
        """Schedule message for retry delivery."""
        attempt_count = len(
            [r for r in self._delivery_results.get(message.id, []) if not r.success]
        )
        retry_delay = self.retry_strategy.calculate_delay(attempt_count)

        # Use provider suggested delay if available
        if last_result.retry_after:
            retry_delay = max(retry_delay, last_result.retry_after)

        # Schedule retry
        retry_time = datetime.now() + timedelta(seconds=retry_delay)
        message.scheduled_at = retry_time
        self._scheduled_queue.append(message)

        self.logger.info(
            "Scheduled retry for message %s in %d seconds (attempt %d)",
            message.id,
            retry_delay,
            attempt_count + 1,
        )

    async def _scheduler_worker(self) -> None:
        """Background worker for processing scheduled messages."""
        self.logger.debug("Scheduler worker started")

        while self._running:
            try:
                current_time = datetime.now()
                ready_messages = []

                # Find ready messages
                remaining_messages = []
                for message in self._scheduled_queue:
                    if message.scheduled_at and message.scheduled_at <= current_time:
                        ready_messages.append(message)
                    else:
                        remaining_messages.append(message)

                # Update scheduled queue
                self._scheduled_queue = remaining_messages

                # Queue ready messages for delivery
                for message in ready_messages:
                    message.scheduled_at = None  # Clear schedule time
                    await self._delivery_queue.put(message)

                if ready_messages:
                    self.logger.debug(
                        "Scheduled %d messages for immediate delivery",
                        len(ready_messages),
                    )

                # Sleep before next check
                await asyncio.sleep(10)  # Check every 10 seconds

            except Exception as e:
                self.logger.error("Scheduler worker error: %s", str(e))
                await asyncio.sleep(5)

        self.logger.debug("Scheduler worker stopped")

    async def _apply_delivery_preferences(self, message: NotificationMessage) -> None:
        """Apply recipient delivery preferences to message."""
        preferences = self._delivery_preferences.get(message.recipient_id, {})

        # Apply quiet hours
        quiet_hours = preferences.get("quiet_hours")
        if quiet_hours and message.priority != Priority.CRITICAL:
            current_hour = datetime.now().hour
            start_hour = quiet_hours.get("start", 22)
            end_hour = quiet_hours.get("end", 8)

            if start_hour <= current_hour or current_hour <= end_hour:
                # Delay until quiet hours end
                next_delivery = datetime.now().replace(
                    hour=end_hour, minute=0, second=0, microsecond=0
                )
                if next_delivery <= datetime.now():
                    next_delivery += timedelta(days=1)

                message.scheduled_at = next_delivery
                self._scheduled_queue.append(message)
                self.logger.debug("Delayed message %s due to quiet hours", message.id)
                return

        # Apply channel preferences
        preferred_channels = preferences.get("preferred_channels", [])
        if preferred_channels and message.channel not in preferred_channels:
            # Try to use preferred channel if available
            for preferred_channel in preferred_channels:
                if preferred_channel in self.channels:
                    old_channel = message.channel
                    message.channel = preferred_channel
                    self.logger.debug(
                        "Switched message %s channel from %s to %s",
                        message.id,
                        old_channel.value,
                        preferred_channel.value,
                    )
                    break

    async def _update_metrics(self, result: DeliveryResult) -> None:
        """Update delivery performance metrics."""
        self._metrics.total_sent += 1

        if result.success:
            self._metrics.total_delivered += 1
        else:
            self._metrics.total_failed += 1

        # Update success rate
        if self._metrics.total_sent > 0:
            self._metrics.success_rate = (
                self._metrics.total_delivered / self._metrics.total_sent
            )

        # Update average delivery time
        if result.delivery_time_ms and result.success:
            current_avg = self._metrics.average_delivery_time
            total_delivered = self._metrics.total_delivered

            if total_delivered == 1:
                self._metrics.average_delivery_time = result.delivery_time_ms
            else:
                # Rolling average
                self._metrics.average_delivery_time = (
                    current_avg * (total_delivered - 1) + result.delivery_time_ms
                ) / total_delivered

        # Update channel performance
        channel_perf = self._metrics.channel_performance.setdefault(
            result.channel,
            {
                "sent": 0,
                "delivered": 0,
                "failed": 0,
                "success_rate": 0.0,
                "avg_delivery_time": 0.0,
            },
        )

        channel_perf["sent"] += 1
        if result.success:
            channel_perf["delivered"] += 1
            if result.delivery_time_ms:
                # Update channel average delivery time
                delivered = channel_perf["delivered"]
                if delivered == 1:
                    channel_perf["avg_delivery_time"] = result.delivery_time_ms
                else:
                    current_avg = channel_perf["avg_delivery_time"]
                    channel_perf["avg_delivery_time"] = (
                        current_avg * (delivered - 1) + result.delivery_time_ms
                    ) / delivered
        else:
            channel_perf["failed"] += 1

        # Update channel success rate
        if channel_perf["sent"] > 0:
            channel_perf["success_rate"] = (
                channel_perf["delivered"] / channel_perf["sent"]
            )

        self._metrics.last_updated = datetime.now()

    async def _update_channel_health(self, result: DeliveryResult) -> None:
        """Update channel health status based on delivery results."""
        health = self._channel_health.get(result.channel, {})

        if result.success:
            health["last_success"] = datetime.now()
            health["failure_count"] = 0
        else:
            health["last_failure"] = datetime.now()
            health["failure_count"] = health.get("failure_count", 0) + 1

        # Update availability based on failure rate
        failure_threshold = 10  # Disable channel after 10 consecutive failures
        health["available"] = health["failure_count"] < failure_threshold

        # Update success rate (last 100 attempts)
        # This would typically be stored in a more sophisticated way
        # For now, using a simple calculation
        if health["failure_count"] == 0:
            health["success_rate"] = 1.0
        else:
            health["success_rate"] = max(0.0, 1.0 - (health["failure_count"] / 100))

        self._channel_health[result.channel] = health

    async def _initialize_channel_health(self) -> None:
        """Initialize channel health monitoring."""
        for channel_type in self.channels.keys():
            if channel_type not in self._channel_health:
                self._channel_health[channel_type] = {
                    "available": True,
                    "last_success": None,
                    "last_failure": None,
                    "failure_count": 0,
                    "success_rate": 1.0,
                }

        self.logger.debug(
            "Initialized health monitoring for %d channels", len(self._channel_health)
        )

# Utility functions for common delivery patterns

async def create_notification_delivery(
    channels: Optional[Dict[ChannelType, NotificationChannel]] = None, **kwargs
) -> NotificationDelivery:
    """Factory function to create and start a NotificationDelivery instance."""
    delivery = NotificationDelivery(channels=channels, **kwargs)
    await delivery.start()
    return delivery

def create_urgent_message(
    title: str,
    content: str,
    recipient_id: str,
    channel: ChannelType,
    workflow_id: Optional[str] = None,
) -> NotificationMessage:
    """Create an urgent notification message with immediate delivery."""
    return NotificationMessage(
        title=title,
        content=content,
        recipient_id=recipient_id,
        channel=channel,
        priority=Priority.CRITICAL,
        retry_count=5,  # More retries for urgent messages
        workflow_id=workflow_id,
        tags=["urgent", "immediate"],
    )

def create_scheduled_message(
    title: str,
    content: str,
    recipient_id: str,
    channel: ChannelType,
    scheduled_at: datetime,
    workflow_id: Optional[str] = None,
) -> NotificationMessage:
    """Create a scheduled notification message."""
    return NotificationMessage(
        title=title,
        content=content,
        recipient_id=recipient_id,
        channel=channel,
        scheduled_at=scheduled_at,
        workflow_id=workflow_id,
        tags=["scheduled"],
    )
