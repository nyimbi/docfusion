#!/usr/bin/env python3
"""
API Usage Analytics

Comprehensive analytics system for tracking API usage patterns, user behavior,
endpoint performance, and generating detailed reports and insights.
"""

import asyncio
import json
import logging
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

try:
    from uuid_extensions import uuid7str
except ImportError:
    from uuid import uuid4

    def uuid7str() -> str:
        return str(uuid4)


from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field


class AnalyticsPeriod(str, Enum):
    """Time periods for analytics"""

    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


class EventType(str, Enum):
    """API event types"""

    REQUEST = "request"
    RESPONSE = "response"
    ERROR = "error"
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    DOCUMENT_CREATE = "document_create"
    DOCUMENT_UPDATE = "document_update"
    DOCUMENT_DELETE = "document_delete"
    SEARCH_QUERY = "search_query"
    WEBSOCKET_CONNECT = "websocket_connect"
    WEBSOCKET_DISCONNECT = "websocket_disconnect"


@dataclass
class AnalyticsEvent:
    """Analytics event data"""

    event_id: str = field(default_factory=uuid7str)
    event_type: EventType = EventType.REQUEST
    timestamp: datetime = field(default_factory=datetime.utcnow)
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    status_code: Optional[int] = None
    response_time_ms: Optional[float] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    referer: Optional[str] = None
    request_size_bytes: Optional[int] = None
    response_size_bytes: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class UsageStats:
    """Usage statistics summary"""

    period: str
    start_time: datetime
    end_time: datetime
    total_requests: int = 0
    unique_users: int = 0
    unique_sessions: int = 0
    total_response_time_ms: float = 0.0
    avg_response_time_ms: float = 0.0
    total_bytes_transferred: int = 0
    error_count: int = 0
    error_rate: float = 0.0
    top_endpoints: List[Dict[str, Any]] = field(default_factory=list)
    top_users: List[Dict[str, Any]] = field(default_factory=list)
    status_code_distribution: Dict[int, int] = field(default_factory=dict)
    hourly_distribution: Dict[int, int] = field(default_factory=dict)


class AnalyticsCollector:
    """Collects and stores analytics events"""

    def __init__(self, max_events: int = 100000):
        self.max_events = max_events
        self.events: List[AnalyticsEvent] = []
        self.event_index: Dict[str, List[int]] = defaultdict(list)  # For fast lookups
        self.logger = logging.getLogger(__name__)

        # Real-time counters
        self.request_counter = Counter()
        self.user_counter = Counter()
        self.endpoint_counter = Counter()
        self.error_counter = Counter()

        self.logger.info("Analytics collector initialized")

    async def record_event(self, event: AnalyticsEvent):
        """Record an analytics event"""
        try:
            # Add to events list
            if len(self.events) >= self.max_events:
                # Remove oldest events to maintain size limit
                removed_event = self.events.pop(0)
                self._remove_from_index(removed_event, 0)
                # Update all indices
                for event_type, indices in self.event_index.items():
                    self.event_index[event_type] = [i - 1 for i in indices if i > 0]

            # Add new event
            event_index = len(self.events)
            self.events.append(event)

            # Update indices
            self.event_index[event.event_type.value].append(event_index)
            if event.user_id:
                self.event_index[f"user:{event.user_id}"].append(event_index)
            if event.endpoint:
                self.event_index[f"endpoint:{event.endpoint}"].append(event_index)

            # Update real-time counters
            self.request_counter[event.timestamp.date()] += 1
            if event.user_id:
                self.user_counter[event.user_id] += 1
            if event.endpoint:
                self.endpoint_counter[event.endpoint] += 1
            if event.status_code and event.status_code >= 400:
                self.error_counter[event.timestamp.date()] += 1

            self.logger.debug(f"Recorded analytics event: {event.event_type}")

        except Exception as e:
            self.logger.error(f"Failed to record analytics event: {e}")

    def _remove_from_index(self, event: AnalyticsEvent, index: int):
        """Remove event from indices"""
        try:
            self.event_index[event.event_type.value].remove(index)
            if event.user_id and index in self.event_index[f"user:{event.user_id}"]:
                self.event_index[f"user:{event.user_id}"].remove(index)
            if (
                event.endpoint
                and index in self.event_index[f"endpoint:{event.endpoint}"]
            ):
                self.event_index[f"endpoint:{event.endpoint}"].remove(index)
        except ValueError:
            pass  # Index might not exist

    async def record_api_request(
        self,
        endpoint: str,
        method: str,
        status_code: int,
        response_time_ms: float,
        user_id: str = None,
        session_id: str = None,
        ip_address: str = None,
        user_agent: str = None,
        request_size: int = None,
        response_size: int = None,
        metadata: Dict[str, Any] = None,
    ):
        """Record API request event"""
        event = AnalyticsEvent(
            event_type=EventType.REQUEST,
            user_id=user_id,
            session_id=session_id,
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            response_time_ms=response_time_ms,
            ip_address=ip_address,
            user_agent=user_agent,
            request_size_bytes=request_size,
            response_size_bytes=response_size,
            metadata=metadata or {},
        )
        await self.record_event(event)

    async def record_user_activity(
        self,
        event_type: EventType,
        user_id: str,
        session_id: str = None,
        metadata: Dict[str, Any] = None,
    ):
        """Record user activity event"""
        event = AnalyticsEvent(
            event_type=event_type,
            user_id=user_id,
            session_id=session_id,
            metadata=metadata or {},
        )
        await self.record_event(event)

    def get_events_in_period(
        self,
        start_time: datetime,
        end_time: datetime,
        event_type: EventType = None,
        user_id: str = None,
        endpoint: str = None,
    ) -> List[AnalyticsEvent]:
        """Get events within time period with optional filters"""
        try:
            # Start with all events or filtered by type/user/endpoint
            if event_type:
                candidate_indices = self.event_index[event_type.value]
            elif user_id:
                candidate_indices = self.event_index[f"user:{user_id}"]
            elif endpoint:
                candidate_indices = self.event_index[f"endpoint:{endpoint}"]
            else:
                candidate_indices = range(len(self.events))

            filtered_events = []
            for i in candidate_indices:
                if i < len(self.events):
                    event = self.events[i]
                    if start_time <= event.timestamp <= end_time:
                        # Apply additional filters
                        if event_type and event.event_type != event_type:
                            continue
                        if user_id and event.user_id != user_id:
                            continue
                        if endpoint and event.endpoint != endpoint:
                            continue
                        filtered_events.append(event)

            return filtered_events

        except Exception as e:
            self.logger.error(f"Failed to get events in period: {e}")
            return []


class UsageAnalyzer:
    """Analyzes usage patterns and generates insights"""

    def __init__(self, collector: AnalyticsCollector):
        self.collector = collector
        self.logger = logging.getLogger(__name__)

    async def generate_usage_stats(
        self,
        period: AnalyticsPeriod,
        start_time: datetime = None,
        end_time: datetime = None,
    ) -> UsageStats:
        """Generate usage statistics for specified period"""
        try:
            # Set default time range based on period
            if end_time is None:
                end_time = datetime.utcnow()

            if start_time is None:
                if period == AnalyticsPeriod.HOUR:
                    start_time = end_time - timedelta(hours=1)
                elif period == AnalyticsPeriod.DAY:
                    start_time = end_time - timedelta(days=1)
                elif period == AnalyticsPeriod.WEEK:
                    start_time = end_time - timedelta(weeks=1)
                elif period == AnalyticsPeriod.MONTH:
                    start_time = end_time - timedelta(days=30)

            # Get events in period
            events = self.collector.get_events_in_period(
                start_time, end_time, EventType.REQUEST
            )

            if not events:
                return UsageStats(
                    period=period.value, start_time=start_time, end_time=end_time
                )

            # Calculate statistics
            total_requests = len(events)
            unique_users = len(set(e.user_id for e in events if e.user_id))
            unique_sessions = len(set(e.session_id for e in events if e.session_id))

            # Response time statistics
            response_times = [e.response_time_ms for e in events if e.response_time_ms]
            total_response_time = sum(response_times) if response_times else 0.0
            avg_response_time = (
                total_response_time / len(response_times) if response_times else 0.0
            )

            # Byte transfer statistics
            request_bytes = [
                e.request_size_bytes for e in events if e.request_size_bytes
            ]
            response_bytes = [
                e.response_size_bytes for e in events if e.response_size_bytes
            ]
            total_bytes = sum(request_bytes) + sum(response_bytes)

            # Error statistics
            error_events = [e for e in events if e.status_code and e.status_code >= 400]
            error_count = len(error_events)
            error_rate = error_count / total_requests if total_requests > 0 else 0.0

            # Top endpoints
            endpoint_stats = defaultdict(
                lambda: {"count": 0, "total_time": 0.0, "errors": 0}
            )
            for event in events:
                if event.endpoint:
                    key = (
                        f"{event.method} {event.endpoint}"
                        if event.method
                        else event.endpoint
                    )
                    endpoint_stats[key]["count"] += 1
                    if event.response_time_ms:
                        endpoint_stats[key]["total_time"] += event.response_time_ms
                    if event.status_code and event.status_code >= 400:
                        endpoint_stats[key]["errors"] += 1

            top_endpoints = []
            for endpoint, stats in sorted(
                endpoint_stats.items(), key=lambda x: x[1]["count"], reverse=True
            )[:10]:
                avg_time = (
                    stats["total_time"] / stats["count"] if stats["count"] > 0 else 0.0
                )
                error_rate_endpoint = (
                    stats["errors"] / stats["count"] if stats["count"] > 0 else 0.0
                )
                top_endpoints.append(
                    {
                        "endpoint": endpoint,
                        "request_count": stats["count"],
                        "avg_response_time_ms": avg_time,
                        "error_rate": error_rate_endpoint,
                    }
                )

            # Top users
            user_stats = defaultdict(lambda: {"count": 0, "total_time": 0.0})
            for event in events:
                if event.user_id:
                    user_stats[event.user_id]["count"] += 1
                    if event.response_time_ms:
                        user_stats[event.user_id]["total_time"] += (
                            event.response_time_ms
                        )

            top_users = []
            for user_id, stats in sorted(
                user_stats.items(), key=lambda x: x[1]["count"], reverse=True
            )[:10]:
                avg_time = (
                    stats["total_time"] / stats["count"] if stats["count"] > 0 else 0.0
                )
                top_users.append(
                    {
                        "user_id": user_id,
                        "request_count": stats["count"],
                        "avg_response_time_ms": avg_time,
                    }
                )

            # Status code distribution
            status_codes = Counter(e.status_code for e in events if e.status_code)

            # Hourly distribution
            hourly_dist = defaultdict(int)
            for event in events:
                hourly_dist[event.timestamp.hour] += 1

            return UsageStats(
                period=period.value,
                start_time=start_time,
                end_time=end_time,
                total_requests=total_requests,
                unique_users=unique_users,
                unique_sessions=unique_sessions,
                total_response_time_ms=total_response_time,
                avg_response_time_ms=avg_response_time,
                total_bytes_transferred=total_bytes,
                error_count=error_count,
                error_rate=error_rate,
                top_endpoints=top_endpoints,
                top_users=top_users,
                status_code_distribution=dict(status_codes),
                hourly_distribution=dict(hourly_dist),
            )

        except Exception as e:
            self.logger.error(f"Failed to generate usage stats: {e}")
            return UsageStats(
                period=period.value,
                start_time=start_time or datetime.utcnow(),
                end_time=end_time or datetime.utcnow(),
            )

    async def get_user_behavior_analysis(
        self, user_id: str, days: int = 30
    ) -> Dict[str, Any]:
        """Analyze individual user behavior patterns"""
        try:
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(days=days)

            events = self.collector.get_events_in_period(
                start_time, end_time, user_id=user_id
            )

            if not events:
                return {"user_id": user_id, "no_activity": True}

            # Activity timeline
            daily_activity = defaultdict(int)
            hourly_activity = defaultdict(int)
            endpoint_usage = defaultdict(int)

            for event in events:
                daily_activity[event.timestamp.date()] += 1
                hourly_activity[event.timestamp.hour] += 1
                if event.endpoint:
                    endpoint_usage[event.endpoint] += 1

            # Most active day and hour
            most_active_day = (
                max(daily_activity.items(), key=lambda x: x[1])
                if daily_activity
                else None
            )
            most_active_hour = (
                max(hourly_activity.items(), key=lambda x: x[1])
                if hourly_activity
                else None
            )

            # Session analysis
            sessions = set(e.session_id for e in events if e.session_id)

            return {
                "user_id": user_id,
                "analysis_period_days": days,
                "total_requests": len(events),
                "unique_sessions": len(sessions),
                "avg_requests_per_day": len(events) / days,
                "most_active_day": {
                    "date": most_active_day[0].isoformat() if most_active_day else None,
                    "requests": most_active_day[1] if most_active_day else 0,
                },
                "most_active_hour": {
                    "hour": most_active_hour[0] if most_active_hour else None,
                    "requests": most_active_hour[1] if most_active_hour else 0,
                },
                "top_endpoints": [
                    {"endpoint": endpoint, "count": count}
                    for endpoint, count in sorted(
                        endpoint_usage.items(), key=lambda x: x[1], reverse=True
                    )[:5]
                ],
                "daily_activity": {
                    str(date): count for date, count in sorted(daily_activity.items())
                },
                "hourly_activity": {
                    hour: count for hour, count in sorted(hourly_activity.items())
                },
            }

        except Exception as e:
            self.logger.error(f"Failed to analyze user behavior: {e}")
            return {"user_id": user_id, "error": str(e)}

    async def get_trend_analysis(
        self,
        metric: str = "requests",
        period: AnalyticsPeriod = AnalyticsPeriod.DAY,
        points: int = 30,
    ) -> Dict[str, Any]:
        """Get trend analysis for specified metric over time"""
        try:
            trends = []
            end_time = datetime.utcnow()

            # Calculate time delta based on period
            if period == AnalyticsPeriod.HOUR:
                delta = timedelta(hours=1)
            elif period == AnalyticsPeriod.DAY:
                delta = timedelta(days=1)
            elif period == AnalyticsPeriod.WEEK:
                delta = timedelta(weeks=1)
            else:
                delta = timedelta(days=30)

            # Collect data points
            for i in range(points):
                point_end = end_time - (delta * i)
                point_start = point_end - delta

                events = self.collector.get_events_in_period(
                    point_start, point_end, EventType.REQUEST
                )

                if metric == "requests":
                    value = len(events)
                elif metric == "users":
                    value = len(set(e.user_id for e in events if e.user_id))
                elif metric == "errors":
                    value = len(
                        [e for e in events if e.status_code and e.status_code >= 400]
                    )
                elif metric == "response_time":
                    response_times = [
                        e.response_time_ms for e in events if e.response_time_ms
                    ]
                    value = (
                        sum(response_times) / len(response_times)
                        if response_times
                        else 0.0
                    )
                else:
                    value = 0

                trends.append({"timestamp": point_start.isoformat(), "value": value})

            # Reverse to get chronological order
            trends.reverse()

            # Calculate trend direction
            if len(trends) >= 2:
                recent_avg = sum(t["value"] for t in trends[-7:]) / min(7, len(trends))
                older_avg = sum(t["value"] for t in trends[:7]) / min(7, len(trends))

                if recent_avg > older_avg * 1.1:
                    trend_direction = "increasing"
                elif recent_avg < older_avg * 0.9:
                    trend_direction = "decreasing"
                else:
                    trend_direction = "stable"
            else:
                trend_direction = "unknown"

            return {
                "metric": metric,
                "period": period.value,
                "points": len(trends),
                "trend_direction": trend_direction,
                "data": trends,
            }

        except Exception as e:
            self.logger.error(f"Failed to get trend analysis: {e}")
            return {"metric": metric, "error": str(e)}


class UsageAnalyticsAPI:
    """API endpoints for usage analytics"""

    def __init__(self, analyzer: UsageAnalyzer):
        self.analyzer = analyzer
        self.collector = analyzer.collector
        self.logger = logging.getLogger(__name__)

        # Create FastAPI router
        self.router = APIRouter(prefix="/analytics", tags=["analytics"])
        self._register_endpoints()

        self.logger.info("Usage analytics API initialized")

    def _register_endpoints(self):
        """Register analytics API endpoints"""

        @self.router.get("/usage")
        async def get_usage_stats(
            period: AnalyticsPeriod = Query(
                AnalyticsPeriod.DAY, description="Time period for analytics"
            ),
            start_time: Optional[datetime] = Query(
                None, description="Start time (ISO format)"
            ),
            end_time: Optional[datetime] = Query(
                None, description="End time (ISO format)"
            ),
        ):
            """Get usage statistics for specified period"""
            try:
                stats = await self.analyzer.generate_usage_stats(
                    period, start_time, end_time
                )
                return {
                    "period": stats.period,
                    "start_time": stats.start_time.isoformat(),
                    "end_time": stats.end_time.isoformat(),
                    "total_requests": stats.total_requests,
                    "unique_users": stats.unique_users,
                    "unique_sessions": stats.unique_sessions,
                    "avg_response_time_ms": stats.avg_response_time_ms,
                    "total_bytes_transferred": stats.total_bytes_transferred,
                    "error_count": stats.error_count,
                    "error_rate": stats.error_rate,
                    "top_endpoints": stats.top_endpoints,
                    "top_users": stats.top_users,
                    "status_code_distribution": stats.status_code_distribution,
                    "hourly_distribution": stats.hourly_distribution,
                }
            except Exception as e:
                self.logger.error(f"Usage stats endpoint failed: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.router.get("/user/{user_id}")
        async def get_user_analysis(
            user_id: str, days: int = Query(30, description="Number of days to analyze")
        ):
            """Get user behavior analysis"""
            try:
                analysis = await self.analyzer.get_user_behavior_analysis(user_id, days)
                return analysis
            except Exception as e:
                self.logger.error(f"User analysis endpoint failed: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.router.get("/trends")
        async def get_trends(
            metric: str = Query(
                "requests",
                description="Metric to analyze (requests, users, errors, response_time)",
            ),
            period: AnalyticsPeriod = Query(
                AnalyticsPeriod.DAY, description="Time period per data point"
            ),
            points: int = Query(30, description="Number of data points"),
        ):
            """Get trend analysis for specified metric"""
            try:
                trends = await self.analyzer.get_trend_analysis(metric, period, points)
                return trends
            except Exception as e:
                self.logger.error(f"Trends endpoint failed: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        @self.router.get("/dashboard")
        async def get_dashboard_data():
            """Get comprehensive dashboard data"""
            try:
                # Get multiple time periods
                hour_stats = await self.analyzer.generate_usage_stats(
                    AnalyticsPeriod.HOUR
                )
                day_stats = await self.analyzer.generate_usage_stats(
                    AnalyticsPeriod.DAY
                )
                week_stats = await self.analyzer.generate_usage_stats(
                    AnalyticsPeriod.WEEK
                )

                # Get trends
                request_trends = await self.analyzer.get_trend_analysis(
                    "requests", AnalyticsPeriod.HOUR, 24
                )
                error_trends = await self.analyzer.get_trend_analysis(
                    "errors", AnalyticsPeriod.HOUR, 24
                )

                return {
                    "last_hour": {
                        "total_requests": hour_stats.total_requests,
                        "unique_users": hour_stats.unique_users,
                        "error_rate": hour_stats.error_rate,
                        "avg_response_time_ms": hour_stats.avg_response_time_ms,
                    },
                    "last_day": {
                        "total_requests": day_stats.total_requests,
                        "unique_users": day_stats.unique_users,
                        "error_rate": day_stats.error_rate,
                        "avg_response_time_ms": day_stats.avg_response_time_ms,
                    },
                    "last_week": {
                        "total_requests": week_stats.total_requests,
                        "unique_users": week_stats.unique_users,
                        "error_rate": week_stats.error_rate,
                        "avg_response_time_ms": week_stats.avg_response_time_ms,
                    },
                    "trends": {"requests": request_trends, "errors": error_trends},
                    "top_endpoints_today": day_stats.top_endpoints[:5],
                    "top_users_today": day_stats.top_users[:5],
                    "generated_at": datetime.utcnow().isoformat(),
                }
            except Exception as e:
                self.logger.error(f"Dashboard endpoint failed: {e}")
                raise HTTPException(status_code=500, detail=str(e))


# Factory functions
def create_analytics_collector() -> AnalyticsCollector:
    """Create analytics collector instance"""
    return AnalyticsCollector()


def create_usage_analyzer(collector: AnalyticsCollector) -> UsageAnalyzer:
    """Create usage analyzer instance"""
    return UsageAnalyzer(collector)


def create_analytics_api(analyzer: UsageAnalyzer) -> UsageAnalyticsAPI:
    """Create analytics API instance"""
    return UsageAnalyticsAPI(analyzer)
