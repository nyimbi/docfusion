"""
NotificationAnalytics - Week 20 Comprehensive Notification Analytics System

Implements advanced analytics for notification effectiveness tracking including
delivery rates, user engagement metrics, A/B testing capabilities, and
predictive analytics for optimal notification timing and content.
"""

import logging
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.types import confloat
from ...core.utils import uuid7str

class AnalyticsEvent(str, Enum):
    """Notification analytics event types."""

    SENT = "sent"
    DELIVERED = "delivered"
    OPENED = "opened"
    CLICKED = "clicked"
    DISMISSED = "dismissed"
    FAILED = "failed"
    BOUNCED = "bounced"
    UNSUBSCRIBED = "unsubscribed"
    CONVERTED = "converted"
    SHARED = "shared"

class TimeGranularity(str, Enum):
    """Time-based analytics granularity."""

    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"

@dataclass
class NotificationEvent:
    """Individual notification event for analytics tracking."""

    event_id: str
    notification_id: str
    user_id: str
    event_type: AnalyticsEvent
    channel_type: str
    timestamp: datetime

    # Event details
    message_priority: Optional[str] = None
    workflow_id: Optional[str] = None
    campaign_id: Optional[str] = None
    ab_test_group: Optional[str] = None

    # Performance metrics
    delivery_time_ms: Optional[int] = None
    response_time_seconds: Optional[float] = None

    # Context data
    user_timezone: Optional[str] = None
    device_type: Optional[str] = None
    platform: Optional[str] = None

    # Custom attributes
    custom_attributes: Dict[str, Any] = field(default_factory=dict)

class AnalyticsMetrics(BaseModel):
    """Comprehensive analytics metrics."""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    # Time period
    start_time: datetime = Field(..., description="Analytics period start")
    end_time: datetime = Field(..., description="Analytics period end")

    # Volume metrics
    total_sent: int = Field(0, description="Total notifications sent")
    total_delivered: int = Field(0, description="Total notifications delivered")
    total_failed: int = Field(0, description="Total notifications failed")

    # Engagement metrics
    total_opened: int = Field(0, description="Total notifications opened")
    total_clicked: int = Field(0, description="Total notifications clicked")
    total_dismissed: int = Field(0, description="Total notifications dismissed")
    total_converted: int = Field(0, description="Total conversions")

    # Rate calculations
    delivery_rate: confloat(ge=0.0, le=1.0) = Field(
        0.0, description="Delivery success rate"
    )
    failure_rate: confloat(ge=0.0, le=1.0) = Field(0.0, description="Failure rate")
    open_rate: confloat(ge=0.0, le=1.0) = Field(0.0, description="Open rate")
    click_rate: confloat(ge=0.0, le=1.0) = Field(0.0, description="Click-through rate")
    conversion_rate: confloat(ge=0.0, le=1.0) = Field(
        0.0, description="Conversion rate"
    )

    # Performance metrics
    average_delivery_time_ms: float = Field(0.0, description="Average delivery time")
    average_response_time_seconds: float = Field(
        0.0, description="Average user response time"
    )

    # Channel breakdown
    channel_metrics: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict, description="Per-channel metrics"
    )

    # Priority breakdown
    priority_metrics: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict, description="Per-priority metrics"
    )

    # Time-based patterns
    hourly_distribution: Dict[int, int] = Field(
        default_factory=dict, description="Hourly send distribution"
    )
    daily_trends: Dict[str, int] = Field(
        default_factory=dict, description="Daily trend data"
    )

class ABTestResult(BaseModel):
    """A/B test analysis results."""

    model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

    test_name: str = Field(..., description="A/B test identifier")
    start_date: datetime = Field(..., description="Test start date")
    end_date: Optional[datetime] = Field(None, description="Test end date")

    # Test groups
    control_group: str = Field(..., description="Control group identifier")
    test_groups: List[str] = Field(..., description="Test group identifiers")

    # Results per group
    group_results: Dict[str, Dict[str, Any]] = Field(
        ..., description="Results by group"
    )

    # Statistical significance
    is_significant: bool = Field(False, description="Statistical significance flag")
    confidence_level: float = Field(0.95, description="Confidence level")
    p_value: Optional[float] = Field(None, description="P-value for significance test")

    # Winner determination
    winning_group: Optional[str] = Field(
        None, description="Winning group if significant"
    )
    improvement_percentage: Optional[float] = Field(
        None, description="Improvement over control"
    )

    # Recommendations
    recommendation: Optional[str] = Field(None, description="Test recommendation")

class NotificationAnalytics:
    """
    Comprehensive notification analytics system.

    Provides advanced analytics capabilities including:
    - Real-time delivery and engagement tracking
    - Channel performance analysis and optimization
    - User behavior pattern recognition
    - A/B testing framework with statistical analysis
    - Predictive analytics for optimal send times
    - Custom event tracking and reporting
    - Export capabilities for business intelligence
    """

    def __init__(
        self,
        retention_days: int = 90,
        enable_realtime_analytics: bool = True,
        enable_predictive_analytics: bool = True,
    ):
        self.retention_days = retention_days
        self.enable_realtime_analytics = enable_realtime_analytics
        self.enable_predictive_analytics = enable_predictive_analytics

        # Event storage
        self._events: List[NotificationEvent] = []
        self._events_by_notification: Dict[str, List[NotificationEvent]] = defaultdict(
            list
        )
        self._events_by_user: Dict[str, List[NotificationEvent]] = defaultdict(list)
        self._events_by_channel: Dict[str, List[NotificationEvent]] = defaultdict(list)

        # A/B testing
        self._ab_tests: Dict[str, Dict[str, Any]] = {}

        # Cached metrics
        self._cached_metrics: Dict[str, Any] = {}
        self._cache_expiry: Dict[str, datetime] = {}

        # Real-time aggregates
        self._realtime_counters = defaultdict(int)
        self._hourly_stats = defaultdict(lambda: defaultdict(int))

        # User patterns
        self._user_engagement_profiles: Dict[str, Dict[str, Any]] = {}

        # Logging
        self.logger = logging.getLogger(__name__)
        self.logger.info("NotificationAnalytics initialized")

    async def track_event(self, event: NotificationEvent) -> None:
        """Track a notification event for analytics."""
        # Store event
        self._events.append(event)
        self._events_by_notification[event.notification_id].append(event)
        self._events_by_user[event.user_id].append(event)
        self._events_by_channel[event.channel_type].append(event)

        # Update real-time counters
        if self.enable_realtime_analytics:
            await self._update_realtime_counters(event)

        # Update user engagement profile
        await self._update_user_profile(event)

        # Clean up old events
        await self._cleanup_old_events()

        self.logger.debug(
            "Tracked analytics event: %s for notification %s",
            event.event_type.value,
            event.notification_id,
        )

    async def get_metrics(
        self,
        start_time: datetime,
        end_time: datetime,
        channel_type: Optional[str] = None,
        use_cache: bool = True,
    ) -> AnalyticsMetrics:
        """Get comprehensive analytics metrics for a time period."""
        # Check cache
        cache_key = (
            f"metrics_{start_time.isoformat()}_{end_time.isoformat()}_{channel_type}"
        )
        if use_cache and cache_key in self._cached_metrics:
            if self._cache_expiry.get(cache_key, datetime.min) > datetime.now():
                return AnalyticsMetrics(**self._cached_metrics[cache_key])

        # Filter events by time period and channel
        filtered_events = [
            event
            for event in self._events
            if start_time <= event.timestamp <= end_time
            and (not channel_type or event.channel_type == channel_type)
        ]

        # Calculate metrics
        metrics = await self._calculate_metrics(filtered_events, start_time, end_time)

        # Cache results
        if use_cache:
            self._cached_metrics[cache_key] = metrics.model_dump()
            self._cache_expiry[cache_key] = datetime.now() + timedelta(minutes=5)

        return metrics

    async def get_channel_performance(
        self, start_time: datetime, end_time: datetime
    ) -> Dict[str, AnalyticsMetrics]:
        """Get performance metrics by channel."""
        channel_metrics = {}

        channels = set(
            event.channel_type
            for event in self._events
            if start_time <= event.timestamp <= end_time
        )

        for channel in channels:
            channel_metrics[channel] = await self.get_metrics(
                start_time, end_time, channel_type=channel
            )

        return channel_metrics

    async def get_user_engagement_analysis(
        self, user_id: str, days_back: int = 30
    ) -> Dict[str, Any]:
        """Analyze user engagement patterns."""
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days_back)

        user_events = [
            event
            for event in self._events_by_user.get(user_id, [])
            if start_time <= event.timestamp <= end_time
        ]

        if not user_events:
            return {"user_id": user_id, "no_data": True}

        # Analyze engagement patterns
        engagement_analysis = {
            "user_id": user_id,
            "total_notifications": len(
                [e for e in user_events if e.event_type == AnalyticsEvent.SENT]
            ),
            "total_opened": len(
                [e for e in user_events if e.event_type == AnalyticsEvent.OPENED]
            ),
            "total_clicked": len(
                [e for e in user_events if e.event_type == AnalyticsEvent.CLICKED]
            ),
            "total_dismissed": len(
                [e for e in user_events if e.event_type == AnalyticsEvent.DISMISSED]
            ),
            "most_active_hours": await self._get_user_active_hours(user_events),
            "preferred_channels": await self._get_user_preferred_channels(user_events),
            "average_response_time": await self._get_user_average_response_time(
                user_events
            ),
            "engagement_trend": await self._calculate_user_engagement_trend(
                user_events
            ),
        }

        # Calculate rates
        if engagement_analysis["total_notifications"] > 0:
            engagement_analysis["open_rate"] = (
                engagement_analysis["total_opened"]
                / engagement_analysis["total_notifications"]
            )
            engagement_analysis["click_rate"] = (
                engagement_analysis["total_clicked"]
                / engagement_analysis["total_notifications"]
            )

        return engagement_analysis

    async def start_ab_test(
        self,
        test_name: str,
        control_group: str,
        test_groups: List[str],
        description: str = "",
        expected_duration_days: int = 14,
    ) -> str:
        """Start a new A/B test."""
        test_id = f"ab_{test_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        self._ab_tests[test_id] = {
            "test_name": test_name,
            "test_id": test_id,
            "control_group": control_group,
            "test_groups": test_groups,
            "description": description,
            "start_date": datetime.now(),
            "expected_end_date": datetime.now()
            + timedelta(days=expected_duration_days),
            "status": "active",
            "events": [],
        }

        self.logger.info(
            "Started A/B test: %s with groups: %s vs %s",
            test_name,
            control_group,
            test_groups,
        )

        return test_id

    async def track_ab_test_event(
        self, test_id: str, group: str, event: NotificationEvent
    ) -> None:
        """Track an event for A/B testing."""
        if test_id in self._ab_tests:
            event.ab_test_group = group
            self._ab_tests[test_id]["events"].append(event)

            # Also track in main analytics
            await self.track_event(event)

    async def analyze_ab_test(self, test_id: str) -> ABTestResult:
        """Analyze A/B test results."""
        if test_id not in self._ab_tests:
            raise ValueError(f"A/B test {test_id} not found")

        test_data = self._ab_tests[test_id]
        events = test_data["events"]

        # Group events by test group
        group_events = defaultdict(list)
        for event in events:
            group_events[event.ab_test_group].append(event)

        # Calculate metrics for each group
        group_results = {}
        for group, group_event_list in group_events.items():
            group_results[group] = await self._calculate_ab_group_metrics(
                group_event_list
            )

        # Perform statistical significance test
        significance_result = await self._calculate_statistical_significance(
            group_results
        )

        return ABTestResult(
            test_name=test_data["test_name"],
            start_date=test_data["start_date"],
            end_date=test_data.get("end_date"),
            control_group=test_data["control_group"],
            test_groups=test_data["test_groups"],
            group_results=group_results,
            is_significant=significance_result["is_significant"],
            confidence_level=significance_result["confidence_level"],
            p_value=significance_result.get("p_value"),
            winning_group=significance_result.get("winning_group"),
            improvement_percentage=significance_result.get("improvement_percentage"),
            recommendation=significance_result.get("recommendation"),
        )

    async def get_optimal_send_times(
        self,
        user_id: Optional[str] = None,
        channel_type: Optional[str] = None,
        days_back: int = 30,
    ) -> Dict[str, Any]:
        """Predict optimal notification send times."""
        if not self.enable_predictive_analytics:
            return {"error": "Predictive analytics disabled"}

        end_time = datetime.now()
        start_time = end_time - timedelta(days=days_back)

        # Filter events
        filtered_events = [
            event
            for event in self._events
            if start_time <= event.timestamp <= end_time
            and (not user_id or event.user_id == user_id)
            and (not channel_type or event.channel_type == channel_type)
            and event.event_type in [AnalyticsEvent.OPENED, AnalyticsEvent.CLICKED]
        ]

        if len(filtered_events) < 10:  # Need minimum data
            return {"error": "Insufficient data for prediction", "min_required": 10}

        # Analyze engagement by hour of day
        hourly_engagement = defaultdict(list)
        for event in filtered_events:
            hour = event.timestamp.hour
            # Calculate engagement score (clicked = 2, opened = 1)
            score = 2 if event.event_type == AnalyticsEvent.CLICKED else 1
            hourly_engagement[hour].append(score)

        # Calculate average engagement by hour
        hourly_averages = {}
        for hour, scores in hourly_engagement.items():
            hourly_averages[hour] = statistics.mean(scores)

        # Find optimal hours (top 3)
        sorted_hours = sorted(hourly_averages.items(), key=lambda x: x[1], reverse=True)
        optimal_hours = [hour for hour, score in sorted_hours[:3]]

        # Analyze day of week patterns
        daily_engagement = defaultdict(list)
        for event in filtered_events:
            day = event.timestamp.weekday()  # 0 = Monday
            score = 2 if event.event_type == AnalyticsEvent.CLICKED else 1
            daily_engagement[day].append(score)

        daily_averages = {}
        for day, scores in daily_engagement.items():
            daily_averages[day] = statistics.mean(scores)

        sorted_days = sorted(daily_averages.items(), key=lambda x: x[1], reverse=True)
        optimal_days = [day for day, score in sorted_days[:3]]

        return {
            "optimal_hours": optimal_hours,
            "optimal_days": optimal_days,
            "hourly_engagement_scores": hourly_averages,
            "daily_engagement_scores": daily_averages,
            "data_points": len(filtered_events),
            "analysis_period_days": days_back,
        }

    async def export_analytics_data(
        self, start_time: datetime, end_time: datetime, format_type: str = "json"
    ) -> Dict[str, Any]:
        """Export analytics data for external analysis."""
        filtered_events = [
            event for event in self._events if start_time <= event.timestamp <= end_time
        ]

        export_data = {
            "export_metadata": {
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "total_events": len(filtered_events),
                "export_timestamp": datetime.now().isoformat(),
            },
            "events": [],
        }

        for event in filtered_events:
            export_data["events"].append(
                {
                    "event_id": event.event_id,
                    "notification_id": event.notification_id,
                    "user_id": event.user_id,
                    "event_type": event.event_type.value,
                    "channel_type": event.channel_type,
                    "timestamp": event.timestamp.isoformat(),
                    "message_priority": event.message_priority,
                    "workflow_id": event.workflow_id,
                    "campaign_id": event.campaign_id,
                    "ab_test_group": event.ab_test_group,
                    "delivery_time_ms": event.delivery_time_ms,
                    "response_time_seconds": event.response_time_seconds,
                    "user_timezone": event.user_timezone,
                    "device_type": event.device_type,
                    "platform": event.platform,
                    "custom_attributes": event.custom_attributes,
                }
            )

        # Add summary metrics
        export_data["summary_metrics"] = (
            await self.get_metrics(start_time, end_time)
        ).model_dump()

        return export_data

    # Private helper methods

    async def _calculate_metrics(
        self, events: List[NotificationEvent], start_time: datetime, end_time: datetime
    ) -> AnalyticsMetrics:
        """Calculate comprehensive metrics from events."""
        def bounded_rate(numerator: int, denominator: int) -> float:
            if denominator <= 0:
                return 0.0
            return min(numerator / denominator, 1.0)

        # Count events by type
        event_counts = defaultdict(int)
        for event in events:
            event_counts[event.event_type] += 1

        total_sent = event_counts[AnalyticsEvent.SENT]
        total_delivered = event_counts[AnalyticsEvent.DELIVERED]
        total_failed = event_counts[AnalyticsEvent.FAILED]
        total_opened = event_counts[AnalyticsEvent.OPENED]
        total_clicked = event_counts[AnalyticsEvent.CLICKED]
        total_dismissed = event_counts[AnalyticsEvent.DISMISSED]
        total_converted = event_counts[AnalyticsEvent.CONVERTED]

        # Calculate rates
        delivery_rate = bounded_rate(total_delivered, total_sent)
        failure_rate = bounded_rate(total_failed, total_sent)
        open_rate = bounded_rate(total_opened, total_delivered)
        click_rate = bounded_rate(total_clicked, total_delivered)
        conversion_rate = bounded_rate(total_converted, total_delivered)

        # Calculate performance metrics
        delivery_times = [
            e.delivery_time_ms for e in events if e.delivery_time_ms is not None
        ]
        response_times = [
            e.response_time_seconds
            for e in events
            if e.response_time_seconds is not None
        ]

        avg_delivery_time = statistics.mean(delivery_times) if delivery_times else 0.0
        avg_response_time = statistics.mean(response_times) if response_times else 0.0

        # Channel breakdown
        channel_metrics = {}
        channels = set(event.channel_type for event in events)
        for channel in channels:
            channel_events = [e for e in events if e.channel_type == channel]
            channel_counts = defaultdict(int)
            for event in channel_events:
                channel_counts[event.event_type] += 1

            channel_sent = channel_counts[AnalyticsEvent.SENT]
            channel_delivered = channel_counts[AnalyticsEvent.DELIVERED]
            channel_opened = channel_counts[AnalyticsEvent.OPENED]

            channel_metrics[channel] = {
                "sent": channel_sent,
                "delivered": channel_delivered,
                "opened": channel_opened,
                "delivery_rate": bounded_rate(channel_delivered, channel_sent),
                "open_rate": bounded_rate(channel_opened, channel_delivered),
            }

        # Priority breakdown
        priority_metrics = {}
        priorities = set(
            event.message_priority for event in events if event.message_priority
        )
        for priority in priorities:
            priority_events = [e for e in events if e.message_priority == priority]
            priority_counts = defaultdict(int)
            for event in priority_events:
                priority_counts[event.event_type] += 1

            priority_sent = priority_counts[AnalyticsEvent.SENT]
            priority_delivered = priority_counts[AnalyticsEvent.DELIVERED]

            priority_metrics[priority] = {
                "sent": priority_sent,
                "delivered": priority_delivered,
                "delivery_rate": bounded_rate(priority_delivered, priority_sent),
            }

        # Hourly distribution
        hourly_distribution = defaultdict(int)
        for event in events:
            if event.event_type == AnalyticsEvent.SENT:
                hourly_distribution[event.timestamp.hour] += 1

        # Daily trends
        daily_trends = defaultdict(int)
        for event in events:
            if event.event_type == AnalyticsEvent.SENT:
                date_key = event.timestamp.strftime("%Y-%m-%d")
                daily_trends[date_key] += 1

        return AnalyticsMetrics(
            start_time=start_time,
            end_time=end_time,
            total_sent=total_sent,
            total_delivered=total_delivered,
            total_failed=total_failed,
            total_opened=total_opened,
            total_clicked=total_clicked,
            total_dismissed=total_dismissed,
            total_converted=total_converted,
            delivery_rate=delivery_rate,
            failure_rate=failure_rate,
            open_rate=open_rate,
            click_rate=click_rate,
            conversion_rate=conversion_rate,
            average_delivery_time_ms=avg_delivery_time,
            average_response_time_seconds=avg_response_time,
            channel_metrics=channel_metrics,
            priority_metrics=priority_metrics,
            hourly_distribution=dict(hourly_distribution),
            daily_trends=dict(daily_trends),
        )

    async def _update_realtime_counters(self, event: NotificationEvent) -> None:
        """Update real-time analytics counters."""
        self._realtime_counters[f"total_{event.event_type.value}"] += 1
        self._realtime_counters[f"{event.channel_type}_{event.event_type.value}"] += 1

        # Hourly stats
        current_hour = event.timestamp.replace(minute=0, second=0, microsecond=0)
        hour_key = current_hour.isoformat()
        self._hourly_stats[hour_key][event.event_type.value] += 1

    async def _update_user_profile(self, event: NotificationEvent) -> None:
        """Update user engagement profile."""
        if event.user_id not in self._user_engagement_profiles:
            self._user_engagement_profiles[event.user_id] = {
                "first_seen": event.timestamp,
                "last_seen": event.timestamp,
                "total_notifications": 0,
                "total_opened": 0,
                "total_clicked": 0,
                "preferred_channels": defaultdict(int),
                "active_hours": defaultdict(int),
            }

        profile = self._user_engagement_profiles[event.user_id]
        profile["last_seen"] = event.timestamp

        if event.event_type == AnalyticsEvent.SENT:
            profile["total_notifications"] += 1
        elif event.event_type == AnalyticsEvent.OPENED:
            profile["total_opened"] += 1
        elif event.event_type == AnalyticsEvent.CLICKED:
            profile["total_clicked"] += 1

        profile["preferred_channels"][event.channel_type] += 1
        profile["active_hours"][event.timestamp.hour] += 1

    async def _cleanup_old_events(self) -> None:
        """Remove events older than retention period."""
        cutoff_date = datetime.now() - timedelta(days=self.retention_days)

        # Filter out old events
        self._events = [
            event for event in self._events if event.timestamp > cutoff_date
        ]

        # Rebuild indexes
        self._events_by_notification.clear()
        self._events_by_user.clear()
        self._events_by_channel.clear()

        for event in self._events:
            self._events_by_notification[event.notification_id].append(event)
            self._events_by_user[event.user_id].append(event)
            self._events_by_channel[event.channel_type].append(event)

    async def _get_user_active_hours(
        self, events: List[NotificationEvent]
    ) -> List[int]:
        """Get user's most active hours."""
        hour_counts = defaultdict(int)
        for event in events:
            if event.event_type in [AnalyticsEvent.OPENED, AnalyticsEvent.CLICKED]:
                hour_counts[event.timestamp.hour] += 1

        sorted_hours = sorted(hour_counts.items(), key=lambda x: x[1], reverse=True)
        return [hour for hour, count in sorted_hours[:3]]

    async def _get_user_preferred_channels(
        self, events: List[NotificationEvent]
    ) -> List[str]:
        """Get user's preferred channels based on engagement."""
        channel_engagement = defaultdict(lambda: {"sent": 0, "engaged": 0})

        for event in events:
            channel = event.channel_type
            if event.event_type == AnalyticsEvent.SENT:
                channel_engagement[channel]["sent"] += 1
            elif event.event_type in [AnalyticsEvent.OPENED, AnalyticsEvent.CLICKED]:
                channel_engagement[channel]["engaged"] += 1

        # Calculate engagement rates
        channel_rates = {}
        for channel, data in channel_engagement.items():
            if data["sent"] > 0:
                channel_rates[channel] = data["engaged"] / data["sent"]

        sorted_channels = sorted(
            channel_rates.items(), key=lambda x: x[1], reverse=True
        )
        return [channel for channel, rate in sorted_channels]

    async def _get_user_average_response_time(
        self, events: List[NotificationEvent]
    ) -> Optional[float]:
        """Calculate user's average response time."""
        response_times = [
            e.response_time_seconds
            for e in events
            if e.response_time_seconds is not None
        ]
        return statistics.mean(response_times) if response_times else None

    async def _calculate_user_engagement_trend(
        self, events: List[NotificationEvent]
    ) -> str:
        """Calculate user engagement trend."""
        if len(events) < 4:
            return "insufficient_data"

        # Group events by week
        weekly_engagement = defaultdict(int)
        for event in events:
            if event.event_type in [AnalyticsEvent.OPENED, AnalyticsEvent.CLICKED]:
                week_key = event.timestamp.strftime("%Y-W%U")
                weekly_engagement[week_key] += 1

        if len(weekly_engagement) < 2:
            return "stable"

        engagement_values = list(weekly_engagement.values())
        recent_avg = statistics.mean(engagement_values[-2:])
        earlier_avg = statistics.mean(engagement_values[:-2])

        if recent_avg > earlier_avg * 1.2:
            return "increasing"
        elif recent_avg < earlier_avg * 0.8:
            return "decreasing"
        else:
            return "stable"

    async def _calculate_ab_group_metrics(
        self, events: List[NotificationEvent]
    ) -> Dict[str, Any]:
        """Calculate metrics for A/B test group."""
        event_counts = defaultdict(int)
        for event in events:
            event_counts[event.event_type] += 1

        sent = event_counts[AnalyticsEvent.SENT]
        delivered = event_counts[AnalyticsEvent.DELIVERED]
        opened = event_counts[AnalyticsEvent.OPENED]
        clicked = event_counts[AnalyticsEvent.CLICKED]
        converted = event_counts[AnalyticsEvent.CONVERTED]

        return {
            "sent": sent,
            "delivered": delivered,
            "opened": opened,
            "clicked": clicked,
            "converted": converted,
            "delivery_rate": delivered / sent if sent > 0 else 0.0,
            "open_rate": opened / delivered if delivered > 0 else 0.0,
            "click_rate": clicked / delivered if delivered > 0 else 0.0,
            "conversion_rate": converted / delivered if delivered > 0 else 0.0,
        }

    async def _calculate_statistical_significance(
        self, group_results: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate statistical significance between A/B test groups."""
        # Simplified significance test - in production would use proper statistical tests
        if len(group_results) < 2:
            return {"is_significant": False, "confidence_level": 0.95}

        # Find control and best performing group
        groups = list(group_results.keys())
        control_group = groups[0]  # Assume first group is control

        control_rate = group_results[control_group].get("click_rate", 0.0)
        best_group = control_group
        best_rate = control_rate

        for group, metrics in group_results.items():
            if group != control_group:
                group_rate = metrics.get("click_rate", 0.0)
                if group_rate > best_rate:
                    best_group = group
                    best_rate = group_rate

        # Simple significance check (in production, use proper statistical tests)
        improvement = (
            (best_rate - control_rate) / control_rate if control_rate > 0 else 0
        )
        is_significant = (
            improvement > 0.1 and best_rate > control_rate
        )  # 10% improvement threshold

        return {
            "is_significant": is_significant,
            "confidence_level": 0.95,
            "winning_group": best_group if is_significant else None,
            "improvement_percentage": improvement * 100 if is_significant else None,
            "recommendation": "Deploy winning variant"
            if is_significant
            else "Continue testing",
        }

# Utility functions for analytics

def create_notification_event(
    notification_id: str,
    user_id: str,
    event_type: AnalyticsEvent,
    channel_type: str,
    **kwargs,
) -> NotificationEvent:
    """Create a notification analytics event."""

    return NotificationEvent(
        event_id=uuid7str(),
        notification_id=notification_id,
        user_id=user_id,
        event_type=event_type,
        channel_type=channel_type,
        timestamp=datetime.now(),
        **kwargs,
    )

async def create_notification_analytics(
    retention_days: int = 90, **kwargs
) -> NotificationAnalytics:
    """Factory function to create NotificationAnalytics instance."""
    return NotificationAnalytics(retention_days=retention_days, **kwargs)
