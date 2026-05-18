#!/usr/bin/env python3
"""
API Monitoring and Analytics

Comprehensive API monitoring system with performance tracking, error analysis,
usage analytics, health checks, and alerting capabilities.
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import timezone, datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple
from ...core.utils import uuid7str

class AlertLevel(str, Enum):
    """Alert severity levels"""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class HealthStatus(str, Enum):
    """Health check status"""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"

@dataclass
class RequestMetric:
    """Request performance metric"""

    request_id: str = field(default_factory=uuid7str)
    method: str = ""
    endpoint: str = ""
    status_code: int = 0
    response_time_ms: float = 0.0
    request_size_bytes: int = 0
    response_size_bytes: int = 0
    user_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class PerformanceStats:
    """Performance statistics"""

    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    average_response_time: float = 0.0
    p50_response_time: float = 0.0
    p95_response_time: float = 0.0
    p99_response_time: float = 0.0
    requests_per_second: float = 0.0
    error_rate: float = 0.0
    throughput_mb_per_second: float = 0.0

@dataclass
class ErrorMetric:
    """Error tracking metric"""

    error_id: str = field(default_factory=uuid7str)
    error_type: str = ""
    error_message: str = ""
    endpoint: str = ""
    method: str = ""
    user_id: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    stack_trace: Optional[str] = None
    request_data: Optional[Dict[str, Any]] = None
    count: int = 1

@dataclass
class HealthCheck:
    """Health check result"""

    check_id: str = field(default_factory=uuid7str)
    service_name: str = ""
    status: HealthStatus = HealthStatus.UNKNOWN
    response_time_ms: float = 0.0
    message: str = ""
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Alert:
    """System alert"""

    alert_id: str = field(default_factory=uuid7str)
    level: AlertLevel = AlertLevel.INFO
    title: str = ""
    description: str = ""
    source: str = ""
    timestamp: datetime = field(default_factory=datetime.utcnow)
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

class APIMonitor:
    """Comprehensive API monitoring and analytics system"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

        # Metrics storage (in production, would use time-series database)
        self.request_metrics: List[RequestMetric] = []
        self.error_metrics: List[ErrorMetric] = []
        self.health_checks: List[HealthCheck] = []
        self.alerts: List[Alert] = []

        # Real-time statistics
        self.current_stats = PerformanceStats()

        # Rate limiting and throttling tracking
        self.rate_limit_violations: Dict[
            str, List[datetime]
        ] = {}  # user_id -> timestamps
        self.throttling_stats: Dict[str, int] = {}  # endpoint -> throttle count

        # Active requests tracking
        self.active_requests: Dict[str, RequestMetric] = {}

        # Configuration
        self.config = {
            "retention_days": 30,
            "alert_thresholds": {
                "error_rate": 0.05,  # 5% error rate
                "response_time": 5000,  # 5 seconds
                "requests_per_second": 1000,  # 1000 RPS
                "memory_usage": 0.85,  # 85% memory usage
                "disk_usage": 0.90,  # 90% disk usage
            },
            "health_check_interval": 60,  # seconds
            "metrics_aggregation_interval": 300,  # 5 minutes
        }

        # Background tasks
        self.background_tasks: Set[asyncio.Task] = set()

        # Start background monitoring
        self._start_background_tasks()

        self.logger.info("API monitor initialized")

    def _start_background_tasks(self):
        """Start background monitoring tasks"""
        # Health check task
        health_task = asyncio.create_task(self._health_check_loop())
        self.background_tasks.add(health_task)
        health_task.add_done_callback(self.background_tasks.discard)

        # Metrics aggregation task
        metrics_task = asyncio.create_task(self._metrics_aggregation_loop())
        self.background_tasks.add(metrics_task)
        metrics_task.add_done_callback(self.background_tasks.discard)

        # Cleanup task
        cleanup_task = asyncio.create_task(self._cleanup_old_data_loop())
        self.background_tasks.add(cleanup_task)
        cleanup_task.add_done_callback(self.background_tasks.discard)

    # ==================== REQUEST TRACKING ====================

    async def start_request_tracking(
        self,
        request_id: str,
        method: str,
        endpoint: str,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_size_bytes: int = 0,
    ) -> RequestMetric:
        """Start tracking a request"""
        metric = RequestMetric(
            request_id=request_id,
            method=method,
            endpoint=endpoint,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            request_size_bytes=request_size_bytes,
            timestamp=datetime.now(timezone.utc),
        )

        self.active_requests[request_id] = metric
        return metric

    async def finish_request_tracking(
        self,
        request_id: str,
        status_code: int,
        response_size_bytes: int = 0,
        error_message: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """Finish tracking a request"""
        if request_id not in self.active_requests:
            return

        metric = self.active_requests[request_id]

        # Calculate response time
        end_time = datetime.now(timezone.utc)
        response_time_ms = (end_time - metric.timestamp).total_seconds() * 1000

        # Update metric
        metric.status_code = status_code
        metric.response_time_ms = response_time_ms
        metric.response_size_bytes = response_size_bytes
        metric.error_message = error_message
        metric.metadata = metadata or {}

        # Store metric
        self.request_metrics.append(metric)

        # Remove from active requests
        del self.active_requests[request_id]

        # Update real-time stats
        self._update_stats(metric)

        # Check for alerts
        await self._check_performance_alerts(metric)

        self.logger.debug(
            f"Request {request_id} completed: {status_code} in {response_time_ms:.2f}ms"
        )

    def _update_stats(self, metric: RequestMetric):
        """Update real-time statistics"""
        self.current_stats.total_requests += 1

        if 200 <= metric.status_code < 400:
            self.current_stats.successful_requests += 1
        else:
            self.current_stats.failed_requests += 1

        # Update error rate
        if self.current_stats.total_requests > 0:
            self.current_stats.error_rate = (
                self.current_stats.failed_requests / self.current_stats.total_requests
            )

        # Update average response time (simple moving average)
        if self.current_stats.total_requests == 1:
            self.current_stats.average_response_time = metric.response_time_ms
        else:
            # Exponential moving average
            alpha = 0.1
            self.current_stats.average_response_time = (
                alpha * metric.response_time_ms
                + (1 - alpha) * self.current_stats.average_response_time
            )

    # ==================== ERROR TRACKING ====================

    async def track_error(
        self,
        error_type: str,
        error_message: str,
        endpoint: str,
        method: str,
        user_id: Optional[str] = None,
        stack_trace: Optional[str] = None,
        request_data: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Track an error occurrence"""
        # Check if this is a duplicate error
        existing_error = self._find_existing_error(error_type, error_message, endpoint)

        if existing_error:
            existing_error.count += 1
            existing_error.timestamp = datetime.now(timezone.utc)
            error_id = existing_error.error_id
        else:
            error_metric = ErrorMetric(
                error_type=error_type,
                error_message=error_message,
                endpoint=endpoint,
                method=method,
                user_id=user_id,
                stack_trace=stack_trace,
                request_data=request_data,
            )

            self.error_metrics.append(error_metric)
            error_id = error_metric.error_id

        # Create alert for critical errors
        if error_type in ["InternalServerError", "DatabaseError", "SecurityError"]:
            await self._create_alert(
                AlertLevel.ERROR,
                f"Critical Error: {error_type}",
                f"Error in {endpoint}: {error_message}",
                "error_tracking",
                {"error_id": error_id, "endpoint": endpoint},
            )

        self.logger.debug(f"Tracked error {error_id}: {error_type} in {endpoint}")
        return error_id

    def _find_existing_error(
        self, error_type: str, error_message: str, endpoint: str
    ) -> Optional[ErrorMetric]:
        """Find existing similar error"""
        # Look for errors in the last hour
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=1)

        for error in reversed(self.error_metrics):
            if error.timestamp < cutoff_time:
                break

            if (
                error.error_type == error_type
                and error.error_message == error_message
                and error.endpoint == endpoint
            ):
                return error

        return None

    # ==================== HEALTH CHECKS ====================

    async def register_health_check(
        self, service_name: str, check_function, interval_seconds: int = 60
    ):
        """Register a health check function"""

        async def health_check_wrapper():
            while True:
                try:
                    start_time = time.time()
                    result = await check_function()
                    response_time_ms = (time.time() - start_time) * 1000

                    health_check = HealthCheck(
                        service_name=service_name,
                        status=result.get("status", HealthStatus.UNKNOWN),
                        response_time_ms=response_time_ms,
                        message=result.get("message", ""),
                        metadata=result.get("metadata", {}),
                    )

                    self.health_checks.append(health_check)

                    # Create alert if unhealthy
                    if health_check.status == HealthStatus.UNHEALTHY:
                        await self._create_alert(
                            AlertLevel.CRITICAL,
                            f"Service Unhealthy: {service_name}",
                            health_check.message,
                            "health_check",
                            {
                                "service": service_name,
                                "response_time": response_time_ms,
                            },
                        )
                    elif health_check.status == HealthStatus.DEGRADED:
                        await self._create_alert(
                            AlertLevel.WARNING,
                            f"Service Degraded: {service_name}",
                            health_check.message,
                            "health_check",
                            {
                                "service": service_name,
                                "response_time": response_time_ms,
                            },
                        )

                except Exception as e:
                    self.logger.error(f"Health check failed for {service_name}: {e}")

                    health_check = HealthCheck(
                        service_name=service_name,
                        status=HealthStatus.UNHEALTHY,
                        message=f"Health check error: {str(e)}",
                    )

                    self.health_checks.append(health_check)

                await asyncio.sleep(interval_seconds)

        # Start health check task
        task = asyncio.create_task(health_check_wrapper())
        self.background_tasks.add(task)
        task.add_done_callback(self.background_tasks.discard)

        self.logger.info(f"Registered health check for {service_name}")

    async def _health_check_loop(self):
        """Background health check loop"""
        while True:
            try:
                # Basic system health checks
                await self._check_system_health()

                # Check for stale active requests
                await self._check_stale_requests()

                await asyncio.sleep(self.config["health_check_interval"])

            except Exception as e:
                self.logger.error(f"Health check loop error: {e}")
                await asyncio.sleep(60)

    async def _check_system_health(self):
        """Check basic system health metrics"""
        try:
            import psutil

            # Memory usage
            memory = psutil.virtual_memory()
            memory_usage = memory.percent / 100.0

            if memory_usage > self.config["alert_thresholds"]["memory_usage"]:
                await self._create_alert(
                    AlertLevel.WARNING,
                    "High Memory Usage",
                    f"Memory usage is {memory_usage:.1%}",
                    "system_health",
                    {"memory_usage": memory_usage},
                )

            # Disk usage
            disk = psutil.disk_usage("/")
            disk_usage = disk.percent / 100.0

            if disk_usage > self.config["alert_thresholds"]["disk_usage"]:
                await self._create_alert(
                    AlertLevel.WARNING,
                    "High Disk Usage",
                    f"Disk usage is {disk_usage:.1%}",
                    "system_health",
                    {"disk_usage": disk_usage},
                )

            # CPU usage
            cpu_usage = psutil.cpu_percent(interval=1) / 100.0

            # Record system health
            system_health = HealthCheck(
                service_name="system",
                status=HealthStatus.HEALTHY
                if memory_usage < 0.8 and disk_usage < 0.8
                else HealthStatus.DEGRADED,
                message=f"Memory: {memory_usage:.1%}, Disk: {disk_usage:.1%}, CPU: {cpu_usage:.1%}",
                metadata={
                    "memory_usage": memory_usage,
                    "disk_usage": disk_usage,
                    "cpu_usage": cpu_usage,
                },
            )

            self.health_checks.append(system_health)

        except ImportError:
            # psutil not available
            pass
        except Exception as e:
            self.logger.error(f"System health check failed: {e}")

    async def _check_stale_requests(self):
        """Check for requests that have been active too long"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        stale_requests = []

        for request_id, metric in self.active_requests.items():
            if metric.timestamp < cutoff_time:
                stale_requests.append((request_id, metric))

        if stale_requests:
            await self._create_alert(
                AlertLevel.WARNING,
                "Stale Requests Detected",
                f"Found {len(stale_requests)} requests active for over 10 minutes",
                "request_monitoring",
                {"stale_count": len(stale_requests)},
            )

            # Clean up stale requests
            for request_id, _ in stale_requests:
                del self.active_requests[request_id]

    # ==================== RATE LIMITING TRACKING ====================

    async def track_rate_limit_violation(
        self, user_id: str, endpoint: str, limit: int, window_seconds: int
    ):
        """Track rate limit violation"""
        if user_id not in self.rate_limit_violations:
            self.rate_limit_violations[user_id] = []

        self.rate_limit_violations[user_id].append(datetime.now(timezone.utc))

        # Clean old violations
        cutoff_time = datetime.now(timezone.utc) - timedelta(seconds=window_seconds)
        self.rate_limit_violations[user_id] = [
            ts for ts in self.rate_limit_violations[user_id] if ts > cutoff_time
        ]

        # Check if user is repeatedly violating rate limits
        if len(self.rate_limit_violations[user_id]) > limit * 2:
            await self._create_alert(
                AlertLevel.WARNING,
                "Excessive Rate Limit Violations",
                f"User {user_id} has exceeded rate limits {len(self.rate_limit_violations[user_id])} times",
                "rate_limiting",
                {
                    "user_id": user_id,
                    "endpoint": endpoint,
                    "violations": len(self.rate_limit_violations[user_id]),
                },
            )

        self.logger.debug(f"Rate limit violation: {user_id} on {endpoint}")

    async def track_throttling(self, endpoint: str):
        """Track API throttling"""
        if endpoint not in self.throttling_stats:
            self.throttling_stats[endpoint] = 0

        self.throttling_stats[endpoint] += 1

        # Alert if throttling is excessive
        if self.throttling_stats[endpoint] % 100 == 0:
            await self._create_alert(
                AlertLevel.INFO,
                f"High Throttling on {endpoint}",
                f"Endpoint has been throttled {self.throttling_stats[endpoint]} times",
                "throttling",
                {"endpoint": endpoint, "count": self.throttling_stats[endpoint]},
            )

    # ==================== ALERTING ====================

    async def _create_alert(
        self,
        level: AlertLevel,
        title: str,
        description: str,
        source: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Create a system alert"""
        alert = Alert(
            level=level,
            title=title,
            description=description,
            source=source,
            metadata=metadata or {},
        )

        self.alerts.append(alert)

        self.logger.warning(f"Alert created: {level.value} - {title}: {description}")
        return alert.alert_id

    async def _check_performance_alerts(self, metric: RequestMetric):
        """Check if performance metrics warrant alerts"""
        # High response time alert
        if metric.response_time_ms > self.config["alert_thresholds"]["response_time"]:
            await self._create_alert(
                AlertLevel.WARNING,
                "High Response Time",
                f"{metric.endpoint} took {metric.response_time_ms:.0f}ms to respond",
                "performance",
                {
                    "endpoint": metric.endpoint,
                    "response_time": metric.response_time_ms,
                    "user_id": metric.user_id,
                },
            )

        # Error rate alert
        if (
            self.current_stats.total_requests > 100  # Only alert after some requests
            and self.current_stats.error_rate
            > self.config["alert_thresholds"]["error_rate"]
        ):
            await self._create_alert(
                AlertLevel.ERROR,
                "High Error Rate",
                f"Error rate is {self.current_stats.error_rate:.1%}",
                "performance",
                {
                    "error_rate": self.current_stats.error_rate,
                    "total_requests": self.current_stats.total_requests,
                    "failed_requests": self.current_stats.failed_requests,
                },
            )

    async def resolve_alert(self, alert_id: str, resolved_by: str) -> bool:
        """Resolve an alert"""
        for alert in self.alerts:
            if alert.alert_id == alert_id and not alert.resolved:
                alert.resolved = True
                alert.resolved_at = datetime.now(timezone.utc)
                alert.metadata["resolved_by"] = resolved_by

                self.logger.info(f"Alert {alert_id} resolved by {resolved_by}")
                return True

        return False

    # ==================== ANALYTICS ====================

    async def get_performance_stats(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        endpoint: Optional[str] = None,
    ) -> PerformanceStats:
        """Get performance statistics"""
        if not start_time:
            start_time = datetime.now(timezone.utc) - timedelta(hours=1)
        if not end_time:
            end_time = datetime.now(timezone.utc)

        # Filter metrics
        filtered_metrics = [
            m
            for m in self.request_metrics
            if start_time <= m.timestamp <= end_time
            and (not endpoint or m.endpoint == endpoint)
        ]

        if not filtered_metrics:
            return PerformanceStats()

        # Calculate statistics
        total_requests = len(filtered_metrics)
        successful_requests = len(
            [m for m in filtered_metrics if 200 <= m.status_code < 400]
        )
        failed_requests = total_requests - successful_requests

        response_times = [m.response_time_ms for m in filtered_metrics]
        response_times.sort()

        # Calculate percentiles
        def percentile(data: List[float], p: float) -> float:
            if not data:
                return 0.0
            index = int(len(data) * p / 100.0)
            return data[min(index, len(data) - 1)]

        # Calculate requests per second
        time_span = (end_time - start_time).total_seconds()
        requests_per_second = total_requests / time_span if time_span > 0 else 0

        # Calculate throughput
        total_bytes = sum(
            m.request_size_bytes + m.response_size_bytes for m in filtered_metrics
        )
        throughput_mb_per_second = (
            (total_bytes / (1024 * 1024)) / time_span if time_span > 0 else 0
        )

        return PerformanceStats(
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            average_response_time=sum(response_times) / len(response_times)
            if response_times
            else 0,
            p50_response_time=percentile(response_times, 50),
            p95_response_time=percentile(response_times, 95),
            p99_response_time=percentile(response_times, 99),
            requests_per_second=requests_per_second,
            error_rate=failed_requests / total_requests if total_requests > 0 else 0,
            throughput_mb_per_second=throughput_mb_per_second,
        )

    async def get_endpoint_analytics(
        self, start_time: Optional[datetime] = None, end_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get analytics by endpoint"""
        if not start_time:
            start_time = datetime.now(timezone.utc) - timedelta(hours=1)
        if not end_time:
            end_time = datetime.now(timezone.utc)

        # Group metrics by endpoint
        endpoint_metrics: Dict[str, List[RequestMetric]] = {}

        for metric in self.request_metrics:
            if start_time <= metric.timestamp <= end_time:
                if metric.endpoint not in endpoint_metrics:
                    endpoint_metrics[metric.endpoint] = []
                endpoint_metrics[metric.endpoint].append(metric)

        # Calculate stats for each endpoint
        endpoint_stats = {}
        for endpoint, metrics in endpoint_metrics.items():
            total = len(metrics)
            successful = len([m for m in metrics if 200 <= m.status_code < 400])
            avg_response_time = (
                sum(m.response_time_ms for m in metrics) / total if metrics else 0
            )

            endpoint_stats[endpoint] = {
                "total_requests": total,
                "successful_requests": successful,
                "failed_requests": total - successful,
                "error_rate": (total - successful) / total if total > 0 else 0,
                "average_response_time": avg_response_time,
                "max_response_time": max(m.response_time_ms for m in metrics)
                if metrics
                else 0,
                "min_response_time": min(m.response_time_ms for m in metrics)
                if metrics
                else 0,
            }

        return endpoint_stats

    async def get_error_analytics(
        self, start_time: Optional[datetime] = None, end_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get error analytics"""
        if not start_time:
            start_time = datetime.now(timezone.utc) - timedelta(hours=1)
        if not end_time:
            end_time = datetime.now(timezone.utc)

        # Filter errors
        filtered_errors = [
            e for e in self.error_metrics if start_time <= e.timestamp <= end_time
        ]

        # Group by error type
        error_types = {}
        for error in filtered_errors:
            if error.error_type not in error_types:
                error_types[error.error_type] = {"count": 0, "endpoints": set()}
            error_types[error.error_type]["count"] += error.count
            error_types[error.error_type]["endpoints"].add(error.endpoint)

        # Convert sets to lists for JSON serialization
        for error_type in error_types.values():
            error_type["endpoints"] = list(error_type["endpoints"])

        # Group by endpoint
        error_endpoints = {}
        for error in filtered_errors:
            if error.endpoint not in error_endpoints:
                error_endpoints[error.endpoint] = {"count": 0, "types": set()}
            error_endpoints[error.endpoint]["count"] += error.count
            error_endpoints[error.endpoint]["types"].add(error.error_type)

        # Convert sets to lists for JSON serialization
        for endpoint in error_endpoints.values():
            endpoint["types"] = list(endpoint["types"])

        return {
            "total_errors": len(filtered_errors),
            "unique_errors": len(set(e.error_id for e in filtered_errors)),
            "by_type": error_types,
            "by_endpoint": error_endpoints,
            "most_common_errors": sorted(
                [
                    (error_type, data["count"])
                    for error_type, data in error_types.items()
                ],
                key=lambda x: x[1],
                reverse=True,
            )[:10],
        }

    async def get_user_analytics(
        self, start_time: Optional[datetime] = None, end_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get user activity analytics"""
        if not start_time:
            start_time = datetime.now(timezone.utc) - timedelta(hours=1)
        if not end_time:
            end_time = datetime.now(timezone.utc)

        # Filter metrics with user IDs
        user_metrics = [
            m
            for m in self.request_metrics
            if m.user_id and start_time <= m.timestamp <= end_time
        ]

        # Group by user
        user_activity = {}
        for metric in user_metrics:
            if metric.user_id not in user_activity:
                user_activity[metric.user_id] = {
                    "total_requests": 0,
                    "successful_requests": 0,
                    "failed_requests": 0,
                    "endpoints": set(),
                    "avg_response_time": 0,
                    "response_times": [],
                }

            activity = user_activity[metric.user_id]
            activity["total_requests"] += 1
            if 200 <= metric.status_code < 400:
                activity["successful_requests"] += 1
            else:
                activity["failed_requests"] += 1
            activity["endpoints"].add(metric.endpoint)
            activity["response_times"].append(metric.response_time_ms)

        # Calculate averages and convert sets to lists
        for user_id, activity in user_activity.items():
            if activity["response_times"]:
                activity["avg_response_time"] = sum(activity["response_times"]) / len(
                    activity["response_times"]
                )
            del activity["response_times"]  # Remove raw data
            activity["endpoints"] = list(activity["endpoints"])
            activity["error_rate"] = (
                activity["failed_requests"] / activity["total_requests"]
                if activity["total_requests"] > 0
                else 0
            )

        return {
            "total_active_users": len(user_activity),
            "user_activity": user_activity,
            "most_active_users": sorted(
                [
                    (user_id, data["total_requests"])
                    for user_id, data in user_activity.items()
                ],
                key=lambda x: x[1],
                reverse=True,
            )[:10],
        }

    # ==================== HEALTH STATUS ====================

    async def get_overall_health(self) -> Dict[str, Any]:
        """Get overall system health status"""
        # Get recent health checks
        recent_checks = [
            check
            for check in self.health_checks
            if check.timestamp > datetime.now(timezone.utc) - timedelta(minutes=10)
        ]

        if not recent_checks:
            overall_status = HealthStatus.UNKNOWN
        else:
            # Determine overall status
            statuses = [check.status for check in recent_checks]
            if HealthStatus.UNHEALTHY in statuses:
                overall_status = HealthStatus.UNHEALTHY
            elif HealthStatus.DEGRADED in statuses:
                overall_status = HealthStatus.DEGRADED
            else:
                overall_status = HealthStatus.HEALTHY

        # Count services by status
        service_statuses = {}
        for check in recent_checks:
            service = check.service_name
            if service not in service_statuses:
                service_statuses[service] = check.status
            else:
                # Take the worst status for each service
                if check.status == HealthStatus.UNHEALTHY:
                    service_statuses[service] = HealthStatus.UNHEALTHY
                elif (
                    check.status == HealthStatus.DEGRADED
                    and service_statuses[service] != HealthStatus.UNHEALTHY
                ):
                    service_statuses[service] = HealthStatus.DEGRADED

        # Count unresolved alerts
        unresolved_alerts = len([a for a in self.alerts if not a.resolved])
        critical_alerts = len(
            [
                a
                for a in self.alerts
                if not a.resolved and a.level == AlertLevel.CRITICAL
            ]
        )

        return {
            "overall_status": overall_status,
            "service_count": len(service_statuses),
            "healthy_services": len(
                [s for s in service_statuses.values() if s == HealthStatus.HEALTHY]
            ),
            "degraded_services": len(
                [s for s in service_statuses.values() if s == HealthStatus.DEGRADED]
            ),
            "unhealthy_services": len(
                [s for s in service_statuses.values() if s == HealthStatus.UNHEALTHY]
            ),
            "unresolved_alerts": unresolved_alerts,
            "critical_alerts": critical_alerts,
            "active_requests": len(self.active_requests),
            "current_stats": self.current_stats,
            "last_updated": datetime.now(timezone.utc),
        }

    async def get_service_health(self, service_name: str) -> Dict[str, Any]:
        """Get health status for a specific service"""
        service_checks = [
            check for check in self.health_checks if check.service_name == service_name
        ]

        if not service_checks:
            return {
                "service_name": service_name,
                "status": HealthStatus.UNKNOWN,
                "message": "No health checks found",
            }

        # Get latest check
        latest_check = max(service_checks, key=lambda x: x.timestamp)

        # Get recent performance
        recent_checks = [
            check
            for check in service_checks
            if check.timestamp > datetime.now(timezone.utc) - timedelta(hours=1)
        ]

        avg_response_time = (
            sum(check.response_time_ms for check in recent_checks) / len(recent_checks)
            if recent_checks
            else 0
        )

        return {
            "service_name": service_name,
            "status": latest_check.status,
            "message": latest_check.message,
            "last_check": latest_check.timestamp,
            "response_time_ms": latest_check.response_time_ms,
            "avg_response_time_1h": avg_response_time,
            "check_count_1h": len(recent_checks),
            "metadata": latest_check.metadata,
        }

    # ==================== BACKGROUND TASKS ====================

    async def _metrics_aggregation_loop(self):
        """Background metrics aggregation loop"""
        while True:
            try:
                await self._aggregate_metrics()
                await asyncio.sleep(self.config["metrics_aggregation_interval"])
            except Exception as e:
                self.logger.error(f"Metrics aggregation loop error: {e}")
                await asyncio.sleep(60)

    async def _aggregate_metrics(self):
        """Aggregate and summarize metrics"""
        # Calculate current RPS
        one_minute_ago = datetime.now(timezone.utc) - timedelta(minutes=1)
        recent_requests = [
            m for m in self.request_metrics if m.timestamp > one_minute_ago
        ]

        self.current_stats.requests_per_second = len(recent_requests) / 60.0

        # Calculate percentiles for recent requests
        if recent_requests:
            response_times = sorted([m.response_time_ms for m in recent_requests])

            def percentile(data: List[float], p: float) -> float:
                if not data:
                    return 0.0
                index = int(len(data) * p / 100.0)
                return data[min(index, len(data) - 1)]

            self.current_stats.p50_response_time = percentile(response_times, 50)
            self.current_stats.p95_response_time = percentile(response_times, 95)
            self.current_stats.p99_response_time = percentile(response_times, 99)

        # Calculate throughput
        total_bytes = sum(
            m.request_size_bytes + m.response_size_bytes for m in recent_requests
        )
        self.current_stats.throughput_mb_per_second = (
            total_bytes / (1024 * 1024)
        ) / 60.0

        self.logger.debug(
            f"Metrics aggregated: {self.current_stats.requests_per_second:.1f} RPS, "
            f"{self.current_stats.error_rate:.1%} error rate"
        )

    async def _cleanup_old_data_loop(self):
        """Background cleanup loop"""
        while True:
            try:
                await self._cleanup_old_data()
                await asyncio.sleep(3600)  # Run every hour
            except Exception as e:
                self.logger.error(f"Cleanup loop error: {e}")
                await asyncio.sleep(3600)

    async def _cleanup_old_data(self):
        """Clean up old metrics and data"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(days=self.config["retention_days"])

        # Clean up request metrics
        old_count = len(self.request_metrics)
        self.request_metrics = [
            m for m in self.request_metrics if m.timestamp > cutoff_time
        ]

        # Clean up error metrics
        self.error_metrics = [
            e for e in self.error_metrics if e.timestamp > cutoff_time
        ]

        # Clean up health checks
        self.health_checks = [
            h for h in self.health_checks if h.timestamp > cutoff_time
        ]

        # Clean up old alerts (keep resolved alerts for 7 days)
        alert_cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        self.alerts = [
            a
            for a in self.alerts
            if not a.resolved or (a.resolved_at and a.resolved_at > alert_cutoff)
        ]

        # Clean up rate limit violations
        rate_limit_cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
        for user_id in list(self.rate_limit_violations.keys()):
            self.rate_limit_violations[user_id] = [
                ts
                for ts in self.rate_limit_violations[user_id]
                if ts > rate_limit_cutoff
            ]
            if not self.rate_limit_violations[user_id]:
                del self.rate_limit_violations[user_id]

        self.logger.info(
            f"Cleaned up {old_count - len(self.request_metrics)} old request metrics"
        )

    # ==================== ADMIN METHODS ====================

    async def get_current_stats(self) -> PerformanceStats:
        """Get current performance statistics"""
        return self.current_stats

    async def get_alerts(
        self,
        level: Optional[AlertLevel] = None,
        resolved: Optional[bool] = None,
        limit: int = 100,
    ) -> List[Alert]:
        """Get system alerts"""
        filtered_alerts = self.alerts

        if level:
            filtered_alerts = [a for a in filtered_alerts if a.level == level]

        if resolved is not None:
            filtered_alerts = [a for a in filtered_alerts if a.resolved == resolved]

        # Sort by timestamp (newest first)
        filtered_alerts.sort(key=lambda x: x.timestamp, reverse=True)

        return filtered_alerts[:limit]

    async def close(self):
        """Clean shutdown of monitor"""
        # Cancel background tasks
        for task in self.background_tasks:
            task.cancel()

        # Wait for tasks to complete
        if self.background_tasks:
            await asyncio.gather(*self.background_tasks, return_exceptions=True)

        self.logger.info("API monitor closed")

# Global monitor instance
_monitor_instance: Optional[APIMonitor] = None

def get_monitor() -> APIMonitor:
    """Get global monitor instance"""
    global _monitor_instance
    if _monitor_instance is None:
        _monitor_instance = APIMonitor()
    return _monitor_instance

# Factory function
def create_api_monitor() -> APIMonitor:
    """Create new APIMonitor instance"""
    return APIMonitor()
