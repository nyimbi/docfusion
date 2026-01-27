#!/usr/bin/env python3
"""
Performance Monitoring and Alerting System

Comprehensive performance monitoring with real-time metrics collection,
alerting, and automated performance analysis for API and WebSocket endpoints.
"""

import asyncio
import logging
import statistics
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

import psutil

try:
    from uuid_extensions import uuid7str
except ImportError:
    from uuid import uuid4

    def uuid7str() -> str:
        return str(uuid4())


class AlertLevel(str, Enum):
    """Alert severity levels"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class MetricType(str, Enum):
    """Performance metric types"""

    RESPONSE_TIME = "response_time"
    THROUGHPUT = "throughput"
    ERROR_RATE = "error_rate"
    CPU_USAGE = "cpu_usage"
    MEMORY_USAGE = "memory_usage"
    DISK_USAGE = "disk_usage"
    WEBSOCKET_CONNECTIONS = "websocket_connections"
    ACTIVE_USERS = "active_users"
    QUEUE_SIZE = "queue_size"
    DATABASE_CONNECTIONS = "database_connections"


@dataclass
class PerformanceMetric:
    """Performance metric data point"""

    metric_id: str = field(default_factory=uuid7str)
    metric_type: MetricType = MetricType.RESPONSE_TIME
    value: float = 0.0
    timestamp: datetime = field(default_factory=datetime.utcnow)
    endpoint: Optional[str] = None
    method: Optional[str] = None
    status_code: Optional[int] = None
    user_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Alert:
    """Performance alert"""

    alert_id: str = field(default_factory=uuid7str)
    level: AlertLevel = AlertLevel.MEDIUM
    metric_type: MetricType = MetricType.RESPONSE_TIME
    message: str = ""
    value: float = 0.0
    threshold: float = 0.0
    endpoint: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PerformanceThreshold:
    """Performance threshold configuration"""

    metric_type: MetricType
    warning_threshold: float
    critical_threshold: float
    duration_seconds: int = 60  # Time window to evaluate
    min_samples: int = 5  # Minimum samples needed
    endpoint_pattern: Optional[str] = None


class SystemMonitor:
    """System resource monitoring"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    async def get_cpu_usage(self) -> float:
        """Get current CPU usage percentage"""
        try:
            return psutil.cpu_percent(interval=1)
        except Exception as e:
            self.logger.error(f"Failed to get CPU usage: {e}")
            return 0.0

    async def get_memory_usage(self) -> Dict[str, float]:
        """Get memory usage statistics"""
        try:
            memory = psutil.virtual_memory()
            return {
                "total_mb": memory.total / 1024 / 1024,
                "available_mb": memory.available / 1024 / 1024,
                "used_mb": memory.used / 1024 / 1024,
                "percentage": memory.percent,
            }
        except Exception as e:
            self.logger.error(f"Failed to get memory usage: {e}")
            return {"percentage": 0.0}

    async def get_disk_usage(self) -> Dict[str, float]:
        """Get disk usage statistics"""
        try:
            disk = psutil.disk_usage("/")
            return {
                "total_gb": disk.total / 1024 / 1024 / 1024,
                "used_gb": disk.used / 1024 / 1024 / 1024,
                "free_gb": disk.free / 1024 / 1024 / 1024,
                "percentage": (disk.used / disk.total) * 100,
            }
        except Exception as e:
            self.logger.error(f"Failed to get disk usage: {e}")
            return {"percentage": 0.0}

    async def get_network_stats(self) -> Dict[str, float]:
        """Get network I/O statistics"""
        try:
            net_io = psutil.net_io_counters()
            return {
                "bytes_sent": net_io.bytes_sent,
                "bytes_recv": net_io.bytes_recv,
                "packets_sent": net_io.packets_sent,
                "packets_recv": net_io.packets_recv,
            }
        except Exception as e:
            self.logger.error(f"Failed to get network stats: {e}")
            return {}


class PerformanceCollector:
    """Collects and aggregates performance metrics"""

    def __init__(self, max_metrics_per_type: int = 10000):
        self.max_metrics_per_type = max_metrics_per_type
        self.metrics: Dict[MetricType, deque] = defaultdict(
            lambda: deque(maxlen=max_metrics_per_type)
        )
        self.endpoint_metrics: Dict[str, deque] = defaultdict(
            lambda: deque(maxlen=1000)
        )
        self.system_monitor = SystemMonitor()
        self.logger = logging.getLogger(__name__)

        # Start system monitoring
        asyncio.create_task(self._collect_system_metrics())

    async def record_metric(self, metric: PerformanceMetric):
        """Record a performance metric"""
        try:
            # Store in main metrics collection
            self.metrics[metric.metric_type].append(metric)

            # Store endpoint-specific metrics
            if metric.endpoint:
                endpoint_key = (
                    f"{metric.method}:{metric.endpoint}"
                    if metric.method
                    else metric.endpoint
                )
                self.endpoint_metrics[endpoint_key].append(metric)

            self.logger.debug(f"Recorded metric: {metric.metric_type} = {metric.value}")

        except Exception as e:
            self.logger.error(f"Failed to record metric: {e}")

    async def record_request_metric(
        self,
        endpoint: str,
        method: str,
        response_time: float,
        status_code: int,
        user_id: str = None,
        metadata: Dict[str, Any] = None,
    ):
        """Record request performance metric"""
        metric = PerformanceMetric(
            metric_type=MetricType.RESPONSE_TIME,
            value=response_time,
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            user_id=user_id,
            metadata=metadata or {},
        )
        await self.record_metric(metric)

    async def record_error_metric(
        self, endpoint: str, method: str, error_type: str, user_id: str = None
    ):
        """Record error metric"""
        metric = PerformanceMetric(
            metric_type=MetricType.ERROR_RATE,
            value=1.0,  # Error count
            endpoint=endpoint,
            method=method,
            user_id=user_id,
            metadata={"error_type": error_type},
        )
        await self.record_metric(metric)

    async def get_metrics_summary(
        self, metric_type: MetricType, duration_minutes: int = 60
    ) -> Dict[str, Any]:
        """Get aggregated metrics summary"""
        try:
            cutoff_time = datetime.utcnow() - timedelta(minutes=duration_minutes)
            recent_metrics = [
                m for m in self.metrics[metric_type] if m.timestamp >= cutoff_time
            ]

            if not recent_metrics:
                return {"count": 0}

            values = [m.value for m in recent_metrics]

            summary = {
                "count": len(values),
                "min": min(values),
                "max": max(values),
                "mean": statistics.mean(values),
                "median": statistics.median(values),
                "std_dev": statistics.stdev(values) if len(values) > 1 else 0.0,
                "percentiles": {
                    "p50": statistics.quantiles(values, n=2)[0]
                    if len(values) >= 2
                    else values[0],
                    "p90": statistics.quantiles(values, n=10)[8]
                    if len(values) >= 10
                    else max(values),
                    "p95": statistics.quantiles(values, n=20)[18]
                    if len(values) >= 20
                    else max(values),
                    "p99": statistics.quantiles(values, n=100)[98]
                    if len(values) >= 100
                    else max(values),
                },
            }

            return summary

        except Exception as e:
            self.logger.error(f"Failed to calculate metrics summary: {e}")
            return {"count": 0, "error": str(e)}

    async def get_endpoint_performance(
        self, endpoint: str, duration_minutes: int = 60
    ) -> Dict[str, Any]:
        """Get performance stats for specific endpoint"""
        try:
            cutoff_time = datetime.utcnow() - timedelta(minutes=duration_minutes)
            endpoint_data = self.endpoint_metrics.get(endpoint, deque())

            recent_metrics = [m for m in endpoint_data if m.timestamp >= cutoff_time]

            if not recent_metrics:
                return {"endpoint": endpoint, "count": 0}

            # Response time stats
            response_times = [
                m.value
                for m in recent_metrics
                if m.metric_type == MetricType.RESPONSE_TIME
            ]
            error_count = len(
                [m for m in recent_metrics if m.metric_type == MetricType.ERROR_RATE]
            )

            # Status code distribution
            status_codes = defaultdict(int)
            for m in recent_metrics:
                if m.status_code:
                    status_codes[m.status_code] += 1

            return {
                "endpoint": endpoint,
                "total_requests": len(recent_metrics),
                "error_count": error_count,
                "error_rate": error_count / len(recent_metrics)
                if recent_metrics
                else 0.0,
                "avg_response_time": statistics.mean(response_times)
                if response_times
                else 0.0,
                "max_response_time": max(response_times) if response_times else 0.0,
                "status_codes": dict(status_codes),
                "throughput_per_minute": len(recent_metrics) / duration_minutes
                if duration_minutes > 0
                else 0,
            }

        except Exception as e:
            self.logger.error(f"Failed to get endpoint performance: {e}")
            return {"endpoint": endpoint, "error": str(e)}

    async def _collect_system_metrics(self):
        """Background task to collect system metrics"""
        while True:
            try:
                # CPU usage
                cpu_usage = await self.system_monitor.get_cpu_usage()
                await self.record_metric(
                    PerformanceMetric(metric_type=MetricType.CPU_USAGE, value=cpu_usage)
                )

                # Memory usage
                memory_stats = await self.system_monitor.get_memory_usage()
                await self.record_metric(
                    PerformanceMetric(
                        metric_type=MetricType.MEMORY_USAGE,
                        value=memory_stats.get("percentage", 0.0),
                        metadata=memory_stats,
                    )
                )

                # Disk usage
                disk_stats = await self.system_monitor.get_disk_usage()
                await self.record_metric(
                    PerformanceMetric(
                        metric_type=MetricType.DISK_USAGE,
                        value=disk_stats.get("percentage", 0.0),
                        metadata=disk_stats,
                    )
                )

                await asyncio.sleep(30)  # Collect system metrics every 30 seconds

            except Exception as e:
                self.logger.error(f"System metrics collection failed: {e}")
                await asyncio.sleep(60)  # Wait longer on error


class AlertManager:
    """Manages performance alerts and notifications"""

    def __init__(self, collector: PerformanceCollector):
        self.collector = collector
        self.active_alerts: Dict[str, Alert] = {}
        self.alert_history: deque = deque(maxlen=1000)
        self.alert_handlers: List[Callable] = []
        self.thresholds: List[PerformanceThreshold] = []
        self.logger = logging.getLogger(__name__)

        # Default thresholds
        self._setup_default_thresholds()

        # Start alert monitoring
        asyncio.create_task(self._monitor_alerts())

    def _setup_default_thresholds(self):
        """Setup default performance thresholds"""
        self.thresholds = [
            # Response time thresholds
            PerformanceThreshold(
                metric_type=MetricType.RESPONSE_TIME,
                warning_threshold=1000.0,  # 1 second
                critical_threshold=5000.0,  # 5 seconds
                duration_seconds=300,  # 5 minutes
                min_samples=10,
            ),
            # Error rate thresholds
            PerformanceThreshold(
                metric_type=MetricType.ERROR_RATE,
                warning_threshold=0.05,  # 5% error rate
                critical_threshold=0.15,  # 15% error rate
                duration_seconds=300,
                min_samples=20,
            ),
            # CPU usage thresholds
            PerformanceThreshold(
                metric_type=MetricType.CPU_USAGE,
                warning_threshold=70.0,  # 70% CPU
                critical_threshold=90.0,  # 90% CPU
                duration_seconds=300,
                min_samples=5,
            ),
            # Memory usage thresholds
            PerformanceThreshold(
                metric_type=MetricType.MEMORY_USAGE,
                warning_threshold=80.0,  # 80% memory
                critical_threshold=95.0,  # 95% memory
                duration_seconds=300,
                min_samples=5,
            ),
            # Disk usage thresholds
            PerformanceThreshold(
                metric_type=MetricType.DISK_USAGE,
                warning_threshold=85.0,  # 85% disk
                critical_threshold=95.0,  # 95% disk
                duration_seconds=60,
                min_samples=2,
            ),
        ]

    def add_alert_handler(self, handler: Callable[[Alert], None]):
        """Add custom alert handler"""
        self.alert_handlers.append(handler)

    async def create_alert(
        self,
        level: AlertLevel,
        metric_type: MetricType,
        message: str,
        value: float,
        threshold: float,
        endpoint: str = None,
        metadata: Dict[str, Any] = None,
    ) -> Alert:
        """Create and process new alert"""
        alert = Alert(
            level=level,
            metric_type=metric_type,
            message=message,
            value=value,
            threshold=threshold,
            endpoint=endpoint,
            metadata=metadata or {},
        )

        # Check for duplicate active alerts
        alert_key = f"{metric_type}:{endpoint or 'system'}"
        if alert_key in self.active_alerts:
            # Update existing alert
            existing = self.active_alerts[alert_key]
            existing.value = value
            existing.created_at = datetime.utcnow()
            existing.metadata.update(metadata or {})
            alert = existing
        else:
            # Add to active alerts
            self.active_alerts[alert_key] = alert

        # Add to history
        self.alert_history.append(alert)

        # Notify handlers
        for handler in self.alert_handlers:
            try:
                await handler(alert)
            except Exception as e:
                self.logger.error(f"Alert handler failed: {e}")

        self.logger.warning(f"Alert created: {level} - {message}")
        return alert

    async def resolve_alert(self, metric_type: MetricType, endpoint: str = None):
        """Resolve active alert"""
        alert_key = f"{metric_type}:{endpoint or 'system'}"
        if alert_key in self.active_alerts:
            alert = self.active_alerts[alert_key]
            alert.resolved_at = datetime.utcnow()
            del self.active_alerts[alert_key]
            self.logger.info(f"Alert resolved: {alert.message}")

    async def _monitor_alerts(self):
        """Background task to monitor for alert conditions"""
        while True:
            try:
                await self._check_thresholds()
                await asyncio.sleep(60)  # Check every minute
            except Exception as e:
                self.logger.error(f"Alert monitoring failed: {e}")
                await asyncio.sleep(120)  # Wait longer on error

    async def _check_thresholds(self):
        """Check all thresholds and create alerts if needed"""
        for threshold in self.thresholds:
            try:
                # Get recent metrics
                duration_minutes = threshold.duration_seconds // 60
                summary = await self.collector.get_metrics_summary(
                    threshold.metric_type, duration_minutes
                )

                if summary["count"] < threshold.min_samples:
                    continue

                # Check thresholds based on metric type
                current_value = None
                if threshold.metric_type in [
                    MetricType.RESPONSE_TIME,
                    MetricType.CPU_USAGE,
                    MetricType.MEMORY_USAGE,
                    MetricType.DISK_USAGE,
                ]:
                    current_value = summary.get("mean", 0)
                elif threshold.metric_type == MetricType.ERROR_RATE:
                    # Calculate error rate from recent metrics
                    cutoff_time = datetime.utcnow() - timedelta(
                        minutes=duration_minutes
                    )
                    recent_errors = [
                        m
                        for m in self.collector.metrics[MetricType.ERROR_RATE]
                        if m.timestamp >= cutoff_time
                    ]
                    total_requests = summary["count"]
                    error_count = len(recent_errors)
                    current_value = (
                        error_count / total_requests if total_requests > 0 else 0
                    )

                if current_value is None:
                    continue

                # Create alerts based on thresholds
                alert_key = f"{threshold.metric_type}:system"

                if current_value >= threshold.critical_threshold:
                    if alert_key not in self.active_alerts:
                        await self.create_alert(
                            AlertLevel.CRITICAL,
                            threshold.metric_type,
                            f"Critical {threshold.metric_type.value}: {current_value:.2f} >= {threshold.critical_threshold}",
                            current_value,
                            threshold.critical_threshold,
                            metadata={
                                "duration_minutes": duration_minutes,
                                "samples": summary["count"],
                            },
                        )
                elif current_value >= threshold.warning_threshold:
                    if alert_key not in self.active_alerts:
                        await self.create_alert(
                            AlertLevel.HIGH,
                            threshold.metric_type,
                            f"High {threshold.metric_type.value}: {current_value:.2f} >= {threshold.warning_threshold}",
                            current_value,
                            threshold.warning_threshold,
                            metadata={
                                "duration_minutes": duration_minutes,
                                "samples": summary["count"],
                            },
                        )
                else:
                    # Resolve alert if conditions are normal
                    await self.resolve_alert(threshold.metric_type)

            except Exception as e:
                self.logger.error(
                    f"Threshold check failed for {threshold.metric_type}: {e}"
                )

    def get_active_alerts(self) -> List[Alert]:
        """Get all active alerts"""
        return list(self.active_alerts.values())

    def get_alert_history(self, limit: int = 100) -> List[Alert]:
        """Get recent alert history"""
        return list(self.alert_history)[-limit:]


class PerformanceMonitor:
    """Main performance monitoring system"""

    def __init__(self):
        self.collector = PerformanceCollector()
        self.alert_manager = AlertManager(self.collector)
        self.logger = logging.getLogger(__name__)

        # Setup default alert handlers
        self.alert_manager.add_alert_handler(self._log_alert_handler)

        self.logger.info("Performance monitoring system initialized")

    async def _log_alert_handler(self, alert: Alert):
        """Default alert handler that logs alerts"""
        log_level = {
            AlertLevel.LOW: logging.INFO,
            AlertLevel.MEDIUM: logging.WARNING,
            AlertLevel.HIGH: logging.WARNING,
            AlertLevel.CRITICAL: logging.ERROR,
        }.get(alert.level, logging.WARNING)

        self.logger.log(
            log_level, f"PERFORMANCE ALERT [{alert.level.upper()}]: {alert.message}"
        )

    async def record_request(
        self,
        endpoint: str,
        method: str,
        response_time: float,
        status_code: int,
        user_id: str = None,
        metadata: Dict[str, Any] = None,
    ):
        """Record API request performance"""
        await self.collector.record_request_metric(
            endpoint, method, response_time, status_code, user_id, metadata
        )

        # Check for slow requests
        if response_time > 5000:  # 5 seconds
            await self.alert_manager.create_alert(
                AlertLevel.HIGH,
                MetricType.RESPONSE_TIME,
                f"Slow request detected: {method} {endpoint} took {response_time:.0f}ms",
                response_time,
                5000.0,
                endpoint=endpoint,
                metadata={"user_id": user_id, "status_code": status_code},
            )

    async def record_error(
        self, endpoint: str, method: str, error_type: str, user_id: str = None
    ):
        """Record API error"""
        await self.collector.record_error_metric(endpoint, method, error_type, user_id)

    async def record_websocket_connections(self, connection_count: int):
        """Record WebSocket connection count"""
        await self.collector.record_metric(
            PerformanceMetric(
                metric_type=MetricType.WEBSOCKET_CONNECTIONS,
                value=float(connection_count),
            )
        )

    async def record_active_users(self, user_count: int):
        """Record active user count"""
        await self.collector.record_metric(
            PerformanceMetric(
                metric_type=MetricType.ACTIVE_USERS, value=float(user_count)
            )
        )

    async def get_performance_summary(
        self, duration_minutes: int = 60
    ) -> Dict[str, Any]:
        """Get comprehensive performance summary"""
        try:
            summary = {}

            # Get summaries for all metric types
            for metric_type in MetricType:
                metric_summary = await self.collector.get_metrics_summary(
                    metric_type, duration_minutes
                )
                if metric_summary.get("count", 0) > 0:
                    summary[metric_type.value] = metric_summary

            # Add active alerts
            summary["active_alerts"] = [
                {
                    "level": alert.level.value,
                    "metric_type": alert.metric_type.value,
                    "message": alert.message,
                    "value": alert.value,
                    "threshold": alert.threshold,
                    "endpoint": alert.endpoint,
                    "created_at": alert.created_at.isoformat(),
                }
                for alert in self.alert_manager.get_active_alerts()
            ]

            # Add system info
            memory_stats = await self.collector.system_monitor.get_memory_usage()
            disk_stats = await self.collector.system_monitor.get_disk_usage()

            summary["system_status"] = {
                "timestamp": datetime.utcnow().isoformat(),
                "memory_usage_mb": memory_stats.get("used_mb", 0),
                "memory_percentage": memory_stats.get("percentage", 0),
                "disk_usage_gb": disk_stats.get("used_gb", 0),
                "disk_percentage": disk_stats.get("percentage", 0),
            }

            return summary

        except Exception as e:
            self.logger.error(f"Failed to get performance summary: {e}")
            return {"error": str(e)}

    async def get_top_endpoints(
        self, limit: int = 10, duration_minutes: int = 60
    ) -> List[Dict[str, Any]]:
        """Get top performing/problematic endpoints"""
        try:
            endpoint_stats = []

            for endpoint in self.collector.endpoint_metrics.keys():
                stats = await self.collector.get_endpoint_performance(
                    endpoint, duration_minutes
                )
                if stats.get("total_requests", 0) > 0:
                    endpoint_stats.append(stats)

            # Sort by various metrics
            by_requests = sorted(
                endpoint_stats, key=lambda x: x.get("total_requests", 0), reverse=True
            )[:limit]
            by_errors = sorted(
                endpoint_stats, key=lambda x: x.get("error_rate", 0), reverse=True
            )[:limit]
            by_response_time = sorted(
                endpoint_stats,
                key=lambda x: x.get("avg_response_time", 0),
                reverse=True,
            )[:limit]

            return {
                "top_by_requests": by_requests,
                "top_by_errors": by_errors,
                "top_by_response_time": by_response_time,
            }

        except Exception as e:
            self.logger.error(f"Failed to get top endpoints: {e}")
            return {}


# Factory function
def create_performance_monitor() -> PerformanceMonitor:
    """Create performance monitor instance"""
    return PerformanceMonitor()
