#!/usr/bin/env python3
"""
Error Tracking and Debugging Tools

Comprehensive error tracking system with structured logging, error aggregation,
debugging utilities, and automated error analysis for production monitoring.
"""

import asyncio
import hashlib
import inspect
import json
import logging
import sys
import traceback
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import timezone, datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

from fastapi import Request
from ...core.utils import uuid7str

class ErrorSeverity(str, Enum):
    """Error severity levels"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ErrorCategory(str, Enum):
    """Error categories"""

    VALIDATION = "validation"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    DATABASE = "database"
    EXTERNAL_API = "external_api"
    SEARCH = "search"
    WEBSOCKET = "websocket"
    SYSTEM = "system"
    UNKNOWN = "unknown"

@dataclass
class ErrorContext:
    """Error context information"""

    user_id: Optional[str] = None
    session_id: Optional[str] = None
    request_id: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_data: Optional[Dict[str, Any]] = None
    response_data: Optional[Dict[str, Any]] = None
    system_info: Optional[Dict[str, Any]] = None

@dataclass
class ErrorEvent:
    """Structured error event"""

    error_id: str = field(default_factory=uuid7str)
    error_hash: str = ""
    timestamp: datetime = field(default_factory=datetime.utcnow)
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
    category: ErrorCategory = ErrorCategory.UNKNOWN
    message: str = ""
    exception_type: str = ""
    exception_message: str = ""
    traceback: str = ""
    file_path: str = ""
    line_number: int = 0
    function_name: str = ""
    context: ErrorContext = field(default_factory=ErrorContext)
    metadata: Dict[str, Any] = field(default_factory=dict)
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolution_notes: str = ""

@dataclass
class ErrorSummary:
    """Error summary for aggregation"""

    error_hash: str
    first_seen: datetime
    last_seen: datetime
    count: int
    sample_error: ErrorEvent
    affected_users: set = field(default_factory=set)
    affected_endpoints: set = field(default_factory=set)

class ErrorCapture:
    """Captures and processes exceptions"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def capture_exception(
        self,
        exception: Exception,
        context: ErrorContext = None,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        category: ErrorCategory = ErrorCategory.UNKNOWN,
        metadata: Dict[str, Any] = None,
    ) -> ErrorEvent:
        """Capture and structure exception information"""

        # Get exception details
        exc_type, exc_value, exc_traceback = sys.exc_info()
        if exc_type is None:
            exc_type = type(exception)
            exc_value = exception
            exc_traceback = exception.__traceback__

        # Extract traceback info
        tb_lines = traceback.format_exception(exc_type, exc_value, exc_traceback)
        traceback_str = "".join(tb_lines)

        # Get file/line info from traceback
        file_path = ""
        line_number = 0
        function_name = ""

        if exc_traceback:
            frame = exc_traceback.tb_frame
            file_path = frame.f_code.co_filename
            line_number = exc_traceback.tb_lineno
            function_name = frame.f_code.co_name

        # Create error hash for deduplication
        error_signature = (
            f"{exc_type.__name__}:{str(exc_value)}:{file_path}:{line_number}"
        )
        error_hash = hashlib.md5(error_signature.encode()).hexdigest()

        # Create error event
        error_event = ErrorEvent(
            error_hash=error_hash,
            severity=severity,
            category=category,
            message=str(exc_value),
            exception_type=exc_type.__name__,
            exception_message=str(exc_value),
            traceback=traceback_str,
            file_path=file_path,
            line_number=line_number,
            function_name=function_name,
            context=context or ErrorContext(),
            metadata=metadata or {},
        )

        return error_event

    def capture_from_request(
        self,
        exception: Exception,
        request: Request,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        category: ErrorCategory = ErrorCategory.UNKNOWN,
        metadata: Dict[str, Any] = None,
    ) -> ErrorEvent:
        """Capture exception with HTTP request context"""

        # Build context from request
        context = ErrorContext(
            request_id=getattr(request.state, "request_id", None),
            endpoint=str(request.url.path),
            method=request.method,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            system_info={
                "url": str(request.url),
                "headers": dict(request.headers),
                "query_params": dict(request.query_params),
            },
        )

        # Get user info from request if available
        if hasattr(request.state, "user"):
            context.user_id = getattr(request.state.user, "user_id", None)

        return self.capture_exception(exception, context, severity, category, metadata)

class ErrorAggregator:
    """Aggregates and analyzes error patterns"""

    def __init__(self, max_events: int = 10000, max_summaries: int = 1000):
        self.max_events = max_events
        self.max_summaries = max_summaries

        # Storage
        self.error_events: deque = deque(maxlen=max_events)
        self.error_summaries: Dict[str, ErrorSummary] = {}

        # Indexes for fast lookup
        self.errors_by_user: Dict[str, List[str]] = defaultdict(
            list
        )  # user_id -> error_ids
        self.errors_by_endpoint: Dict[str, List[str]] = defaultdict(
            list
        )  # endpoint -> error_ids
        self.errors_by_category: Dict[ErrorCategory, List[str]] = defaultdict(list)

        self.logger = logging.getLogger(__name__)

    def add_error(self, error_event: ErrorEvent):
        """Add error event to aggregation"""
        try:
            # Add to events list
            self.error_events.append(error_event)

            # Update or create summary
            if error_event.error_hash in self.error_summaries:
                summary = self.error_summaries[error_event.error_hash]
                summary.last_seen = error_event.timestamp
                summary.count += 1

                if error_event.context.user_id:
                    summary.affected_users.add(error_event.context.user_id)
                if error_event.context.endpoint:
                    summary.affected_endpoints.add(error_event.context.endpoint)
            else:
                # Create new summary
                summary = ErrorSummary(
                    error_hash=error_event.error_hash,
                    first_seen=error_event.timestamp,
                    last_seen=error_event.timestamp,
                    count=1,
                    sample_error=error_event,
                    affected_users=set([error_event.context.user_id])
                    if error_event.context.user_id
                    else set(),
                    affected_endpoints=set([error_event.context.endpoint])
                    if error_event.context.endpoint
                    else set(),
                )
                self.error_summaries[error_event.error_hash] = summary

                # Clean up old summaries if needed
                if len(self.error_summaries) > self.max_summaries:
                    oldest_hash = min(
                        self.error_summaries.keys(),
                        key=lambda h: self.error_summaries[h].first_seen,
                    )
                    del self.error_summaries[oldest_hash]

            # Update indexes
            if error_event.context.user_id:
                self.errors_by_user[error_event.context.user_id].append(
                    error_event.error_id
                )

            if error_event.context.endpoint:
                self.errors_by_endpoint[error_event.context.endpoint].append(
                    error_event.error_id
                )

            self.errors_by_category[error_event.category].append(error_event.error_id)

        except Exception as e:
            self.logger.error(f"Failed to aggregate error: {e}")

    def get_error_stats(self, hours: int = 24) -> Dict[str, Any]:
        """Get error statistics for specified time period"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        recent_errors = [e for e in self.error_events if e.timestamp >= cutoff_time]

        if not recent_errors:
            return {
                "total_errors": 0,
                "unique_errors": 0,
                "error_rate": 0.0,
                "top_errors": [],
                "errors_by_severity": {},
                "errors_by_category": {},
                "affected_users": 0,
                "affected_endpoints": 0,
            }

        # Calculate statistics
        error_counts = defaultdict(int)
        severity_counts = defaultdict(int)
        category_counts = defaultdict(int)
        affected_users = set()
        affected_endpoints = set()

        for error in recent_errors:
            error_counts[error.error_hash] += 1
            severity_counts[error.severity.value] += 1
            category_counts[error.category.value] += 1

            if error.context.user_id:
                affected_users.add(error.context.user_id)
            if error.context.endpoint:
                affected_endpoints.add(error.context.endpoint)

        # Get top errors
        top_errors = []
        for error_hash, count in sorted(
            error_counts.items(), key=lambda x: x[1], reverse=True
        )[:10]:
            if error_hash in self.error_summaries:
                summary = self.error_summaries[error_hash]
                top_errors.append(
                    {
                        "error_hash": error_hash,
                        "count": count,
                        "message": summary.sample_error.message,
                        "exception_type": summary.sample_error.exception_type,
                        "first_seen": summary.first_seen.isoformat(),
                        "last_seen": summary.last_seen.isoformat(),
                        "affected_users": len(summary.affected_users),
                        "affected_endpoints": len(summary.affected_endpoints),
                    }
                )

        return {
            "total_errors": len(recent_errors),
            "unique_errors": len(error_counts),
            "error_rate": len(recent_errors) / hours,  # Errors per hour
            "top_errors": top_errors,
            "errors_by_severity": dict(severity_counts),
            "errors_by_category": dict(category_counts),
            "affected_users": len(affected_users),
            "affected_endpoints": len(affected_endpoints),
            "time_period_hours": hours,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    def get_error_trends(
        self, hours: int = 24, bucket_minutes: int = 60
    ) -> List[Dict[str, Any]]:
        """Get error trends over time"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        recent_errors = [e for e in self.error_events if e.timestamp >= cutoff_time]

        # Create time buckets
        bucket_size = timedelta(minutes=bucket_minutes)
        buckets = []

        current_time = cutoff_time
        while current_time < datetime.now(timezone.utc):
            buckets.append(
                {
                    "timestamp": current_time,
                    "total_errors": 0,
                    "unique_errors": set(),
                    "errors_by_severity": defaultdict(int),
                }
            )
            current_time += bucket_size

        # Distribute errors into buckets
        for error in recent_errors:
            bucket_index = int(
                (error.timestamp - cutoff_time).total_seconds() // (bucket_minutes * 60)
            )
            if 0 <= bucket_index < len(buckets):
                bucket = buckets[bucket_index]
                bucket["total_errors"] += 1
                bucket["unique_errors"].add(error.error_hash)
                bucket["errors_by_severity"][error.severity.value] += 1

        # Convert sets to counts and format response
        trend_data = []
        for bucket in buckets:
            trend_data.append(
                {
                    "timestamp": bucket["timestamp"].isoformat(),
                    "total_errors": bucket["total_errors"],
                    "unique_errors": len(bucket["unique_errors"]),
                    "errors_by_severity": dict(bucket["errors_by_severity"]),
                }
            )

        return trend_data

    def search_errors(
        self,
        query: str = None,
        severity: ErrorSeverity = None,
        category: ErrorCategory = None,
        user_id: str = None,
        endpoint: str = None,
        hours: int = 24,
        limit: int = 100,
    ) -> List[ErrorEvent]:
        """Search errors with filters"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        filtered_errors = []

        for error in self.error_events:
            if error.timestamp < cutoff_time:
                continue

            # Apply filters
            if severity and error.severity != severity:
                continue
            if category and error.category != category:
                continue
            if user_id and error.context.user_id != user_id:
                continue
            if endpoint and error.context.endpoint != endpoint:
                continue
            if query and query.lower() not in error.message.lower():
                continue

            filtered_errors.append(error)

            if len(filtered_errors) >= limit:
                break

        return filtered_errors

class DebugUtils:
    """Debugging utilities and helpers"""

    @staticmethod
    def get_system_info() -> Dict[str, Any]:
        """Get system information for debugging"""
        import platform

        import psutil

        return {
            "python_version": sys.version,
            "platform": platform.platform(),
            "cpu_count": psutil.cpu_count(),
            "memory_total_gb": psutil.virtual_memory().total / 1024 / 1024 / 1024,
            "disk_usage": {
                "total_gb": psutil.disk_usage("/").total / 1024 / 1024 / 1024,
                "used_gb": psutil.disk_usage("/").used / 1024 / 1024 / 1024,
                "free_gb": psutil.disk_usage("/").free / 1024 / 1024 / 1024,
            },
        }

    @staticmethod
    def get_call_stack() -> List[Dict[str, Any]]:
        """Get current call stack for debugging"""
        stack = []

        for frame_info in inspect.stack()[1:]:  # Skip current frame
            stack.append(
                {
                    "filename": frame_info.filename,
                    "function": frame_info.function,
                    "line_number": frame_info.lineno,
                    "code": frame_info.code_context[0].strip()
                    if frame_info.code_context
                    else None,
                }
            )

        return stack

    @staticmethod
    def get_local_variables(depth: int = 1) -> Dict[str, Any]:
        """Get local variables from calling frame"""
        try:
            frame = sys._getframe(depth)
            local_vars = {}

            for name, value in frame.f_locals.items():
                try:
                    # Only include serializable values
                    json.dumps(value)
                    local_vars[name] = value
                except (TypeError, ValueError):
                    local_vars[name] = str(type(value))

            return local_vars
        except Exception:
            return {}

    @staticmethod
    def format_exception_chain(exception: Exception) -> List[Dict[str, Any]]:
        """Format exception chain for debugging"""
        chain = []
        current_exception = exception

        while current_exception:
            chain.append(
                {
                    "type": type(current_exception).__name__,
                    "message": str(current_exception),
                    "args": current_exception.args,
                }
            )
            current_exception = current_exception.__cause__

        return chain

class ErrorTracker:
    """Main error tracking system"""

    def __init__(self):
        self.capture = ErrorCapture()
        self.aggregator = ErrorAggregator()
        self.error_handlers: List[Callable] = []
        self.logger = logging.getLogger(__name__)

        # Setup logging handler
        self.log_handler = ErrorLogHandler(self)
        logging.getLogger().addHandler(self.log_handler)

        self.logger.info("Error tracker initialized")

    def add_error_handler(self, handler: Callable[[ErrorEvent], None]):
        """Add custom error handler"""
        self.error_handlers.append(handler)

    async def track_error(
        self,
        exception: Exception,
        context: ErrorContext = None,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        category: ErrorCategory = ErrorCategory.UNKNOWN,
        metadata: Dict[str, Any] = None,
    ) -> str:
        """Track an error and return error ID"""

        try:
            # Capture error details
            error_event = self.capture.capture_exception(
                exception, context, severity, category, metadata
            )

            # Add to aggregation
            self.aggregator.add_error(error_event)

            # Call custom handlers
            for handler in self.error_handlers:
                try:
                    await handler(error_event)
                except Exception as e:
                    self.logger.error(f"Error handler failed: {e}")

            # Log error
            self.logger.error(
                f"Error tracked: {error_event.error_id} - {error_event.message}"
            )

            return error_event.error_id

        except Exception as e:
            self.logger.error(f"Failed to track error: {e}")
            return ""

    async def track_request_error(
        self,
        exception: Exception,
        request: Request,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        category: ErrorCategory = ErrorCategory.UNKNOWN,
        metadata: Dict[str, Any] = None,
    ) -> str:
        """Track error from HTTP request"""

        error_event = self.capture.capture_from_request(
            exception, request, severity, category, metadata
        )

        self.aggregator.add_error(error_event)

        for handler in self.error_handlers:
            try:
                await handler(error_event)
            except Exception as e:
                self.logger.error(f"Error handler failed: {e}")

        return error_event.error_id

    def get_error_stats(self, hours: int = 24) -> Dict[str, Any]:
        """Get error statistics"""
        return self.aggregator.get_error_stats(hours)

    def get_error_trends(
        self, hours: int = 24, bucket_minutes: int = 60
    ) -> List[Dict[str, Any]]:
        """Get error trends"""
        return self.aggregator.get_error_trends(hours, bucket_minutes)

    def search_errors(self, **kwargs) -> List[ErrorEvent]:
        """Search errors with filters"""
        return self.aggregator.search_errors(**kwargs)

    def get_error_by_id(self, error_id: str) -> Optional[ErrorEvent]:
        """Get specific error by ID"""
        for error in self.aggregator.error_events:
            if error.error_id == error_id:
                return error
        return None

class ErrorLogHandler(logging.Handler):
    """Custom logging handler to capture errors"""

    def __init__(self, error_tracker):
        super().__init__(logging.ERROR)
        self.error_tracker = error_tracker

    def emit(self, record):
        """Handle log record"""
        if record.levelno >= logging.ERROR and record.exc_info:
            try:
                # Create context from log record
                context = ErrorContext(
                    request_id=getattr(record, "request_id", None),
                    user_id=getattr(record, "user_id", None),
                )

                # Determine category from logger name
                category = ErrorCategory.UNKNOWN
                if "database" in record.name.lower():
                    category = ErrorCategory.DATABASE
                elif "auth" in record.name.lower():
                    category = ErrorCategory.AUTHENTICATION
                elif "search" in record.name.lower():
                    category = ErrorCategory.SEARCH

                # Track the error
                asyncio.create_task(
                    self.error_tracker.track_error(
                        record.exc_info[1],
                        context,
                        ErrorSeverity.HIGH
                        if record.levelno >= logging.CRITICAL
                        else ErrorSeverity.MEDIUM,
                        category,
                    )
                )
            except Exception:
                pass  # Don't let error handling break logging

# Factory function
def create_error_tracker() -> ErrorTracker:
    """Create error tracker instance"""
    return ErrorTracker()
