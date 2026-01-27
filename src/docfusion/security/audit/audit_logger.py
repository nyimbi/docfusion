#!/usr/bin/env python3
"""
Audit Logger Module

Provides comprehensive activity logging with integrity protection,
structured logging, log retention, and compliance features.
"""

import asyncio
import gzip
import hashlib
import hmac
import json
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Union

try:
    from uuid_extensions import uuid7str
except ImportError:
    from uuid import uuid4

    def uuid7str() -> str:
        return str(uuid4())


from pydantic import BaseModel, ConfigDict, Field


class AuditEventType(Enum):
    """Types of audit events"""

    # Authentication events
    LOGIN_SUCCESS = "auth.login.success"
    LOGIN_FAILED = "auth.login.failed"
    LOGOUT = "auth.logout"
    PASSWORD_CHANGE = "auth.password.change"
    MFA_ENABLED = "auth.mfa.enabled"
    MFA_DISABLED = "auth.mfa.disabled"

    # Authorization events
    ACCESS_GRANTED = "authz.access.granted"
    ACCESS_DENIED = "authz.access.denied"
    PERMISSION_CHANGED = "authz.permission.changed"
    ROLE_ASSIGNED = "authz.role.assigned"
    ROLE_REVOKED = "authz.role.revoked"

    # Document events
    DOCUMENT_CREATED = "doc.created"
    DOCUMENT_VIEWED = "doc.viewed"
    DOCUMENT_MODIFIED = "doc.modified"
    DOCUMENT_DELETED = "doc.deleted"
    DOCUMENT_SHARED = "doc.shared"
    DOCUMENT_DOWNLOADED = "doc.downloaded"

    # System events
    SYSTEM_START = "sys.start"
    SYSTEM_STOP = "sys.stop"
    CONFIG_CHANGED = "sys.config.changed"
    BACKUP_CREATED = "sys.backup.created"

    # Security events
    SECURITY_VIOLATION = "sec.violation"
    ENCRYPTION_KEY_CREATED = "sec.key.created"
    ENCRYPTION_KEY_ROTATED = "sec.key.rotated"
    SUSPICIOUS_ACTIVITY = "sec.suspicious"

    # API events
    API_CALL = "api.call"
    API_KEY_CREATED = "api.key.created"
    API_KEY_REVOKED = "api.key.revoked"
    RATE_LIMIT_EXCEEDED = "api.rate_limit"

    # Data events
    DATA_EXPORT = "data.export"
    DATA_IMPORT = "data.import"
    DATA_ENCRYPTED = "data.encrypted"
    DATA_DECRYPTED = "data.decrypted"

    # Compliance events
    GDPR_REQUEST = "compliance.gdpr.request"
    DATA_RETENTION = "compliance.data.retention"
    AUDIT_EXPORT = "compliance.audit.export"


class AuditSeverity(Enum):
    """Audit event severity levels"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AuditEvent(BaseModel):
    """Audit event model"""

    model_config = ConfigDict(extra="forbid", validate_by_name=True)

    # Event identification
    event_id: str = Field(default_factory=uuid7str)
    event_type: AuditEventType
    severity: AuditSeverity = AuditSeverity.MEDIUM

    # Event timing
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Event source
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    source_ip: Optional[str] = None
    user_agent: Optional[str] = None

    # Event details
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    action: str
    description: str

    # Event data
    details: Dict[str, Any] = Field(default_factory=dict)
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None

    # Context
    request_id: Optional[str] = None
    correlation_id: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

    # Compliance
    compliance_flags: List[str] = Field(default_factory=list)
    retention_period_days: int = 2555  # 7 years default

    # Integrity
    checksum: Optional[str] = None


class LogIntegrityRecord(BaseModel):
    """Log integrity record for tamper detection"""

    model_config = ConfigDict(extra="forbid", validate_by_name=True)

    record_id: str = Field(default_factory=uuid7str)
    event_id: str
    previous_hash: Optional[str] = None
    current_hash: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    signature: str  # HMAC signature


@dataclass
class AuditConfiguration:
    """Configuration for audit logging system"""

    # Storage configuration
    log_file_path: str = "./logs/audit.json"
    archive_path: str = "./logs/archive/"
    max_file_size_mb: int = 100
    max_files: int = 1000

    # Integrity protection
    enable_integrity_protection: bool = True
    integrity_key: Optional[str] = None
    hash_algorithm: str = "sha256"

    # Retention policy
    default_retention_days: int = 2555  # 7 years
    enable_automatic_archival: bool = True
    compress_archived_logs: bool = True

    # Real-time monitoring
    enable_real_time_alerts: bool = True
    alert_on_critical_events: bool = True
    alert_webhook_url: Optional[str] = None

    # Performance
    batch_size: int = 100
    flush_interval_seconds: int = 60
    max_memory_events: int = 10000

    # Compliance
    enable_gdpr_compliance: bool = True
    enable_sox_compliance: bool = True
    enable_pci_compliance: bool = False

    # Filtering
    log_all_events: bool = True
    excluded_event_types: List[str] = Field(default_factory=list)
    minimum_severity: AuditSeverity = AuditSeverity.LOW


class AuditLogger:
    """Comprehensive audit logging system with integrity protection"""

    def __init__(self, config: Optional[AuditConfiguration] = None):
        """Initialize audit logger with configuration"""
        self.config = config or AuditConfiguration()
        self.logger = logging.getLogger(__name__)

        # In-memory event buffer
        self.event_buffer: List[AuditEvent] = []
        self.integrity_chain: List[LogIntegrityRecord] = []
        self.last_hash: Optional[str] = None

        # Integrity key for HMAC
        self.integrity_key = self.config.integrity_key or secrets.token_bytes(32)

        # Event handlers
        self.event_handlers: Dict[AuditEventType, List[Callable]] = {}

        # Statistics
        self.total_events_logged = 0
        self.events_by_type: Dict[str, int] = {}
        self.events_by_severity: Dict[str, int] = {}

        # Background tasks
        self.flush_task: Optional[asyncio.Task] = None
        self.archive_task: Optional[asyncio.Task] = None

        # Initialize storage
        self._ensure_log_directories()

        # Start background processing
        asyncio.create_task(self._start_background_tasks())

        self.logger.info("Audit logging system initialized")

    async def log_event(
        self,
        event_type: AuditEventType,
        action: str,
        description: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        source_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        severity: AuditSeverity = AuditSeverity.MEDIUM,
        details: Optional[Dict[str, Any]] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None,
        correlation_id: Optional[str] = None,
        tags: Optional[List[str]] = None,
        compliance_flags: Optional[List[str]] = None,
        retention_period_days: Optional[int] = None,
    ) -> str:
        """Log an audit event"""
        # Check if event type should be logged
        if not self._should_log_event(event_type, severity):
            return ""

        # Create audit event
        event = AuditEvent(
            event_type=event_type,
            severity=severity,
            user_id=user_id,
            session_id=session_id,
            source_ip=source_ip,
            user_agent=user_agent,
            resource_type=resource_type,
            resource_id=resource_id,
            action=action,
            description=description,
            details=details or {},
            before_state=before_state,
            after_state=after_state,
            request_id=request_id,
            correlation_id=correlation_id,
            tags=tags or [],
            compliance_flags=compliance_flags or [],
            retention_period_days=retention_period_days
            or self.config.default_retention_days,
        )

        # Calculate event checksum for integrity
        if self.config.enable_integrity_protection:
            event.checksum = self._calculate_event_checksum(event)

        # Add to buffer
        self.event_buffer.append(event)

        # Update statistics
        self.total_events_logged += 1
        self.events_by_type[event_type.value] = (
            self.events_by_type.get(event_type.value, 0) + 1
        )
        self.events_by_severity[severity.value] = (
            self.events_by_severity.get(severity.value, 0) + 1
        )

        # Trigger immediate flush for critical events
        if severity == AuditSeverity.CRITICAL:
            asyncio.create_task(self._flush_events())

        # Handle real-time alerts
        if self.config.enable_real_time_alerts:
            await self._handle_real_time_alert(event)

        # Trigger event handlers
        await self._trigger_event_handlers(event)

        # Flush if buffer is full
        if len(self.event_buffer) >= self.config.max_memory_events:
            asyncio.create_task(self._flush_events())

        self.logger.debug(f"Logged audit event: {event_type.value} ({event.event_id})")
        return event.event_id

    async def query_events(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        event_types: Optional[List[AuditEventType]] = None,
        user_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        severity: Optional[AuditSeverity] = None,
        tags: Optional[List[str]] = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> List[AuditEvent]:
        """Query audit events with filters"""
        # For this implementation, we'll search through recent events in memory
        # In production, this would query a database with proper indexing

        matching_events = []

        # Search in current buffer
        for event in self.event_buffer:
            if self._event_matches_filters(
                event,
                start_time,
                end_time,
                event_types,
                user_id,
                resource_type,
                resource_id,
                severity,
                tags,
            ):
                matching_events.append(event)

        # Sort by timestamp (newest first)
        matching_events.sort(key=lambda e: e.timestamp, reverse=True)

        # Apply pagination
        return matching_events[offset : offset + limit]

    async def export_audit_log(
        self,
        start_time: datetime,
        end_time: datetime,
        format: str = "json",
        include_integrity: bool = True,
    ) -> str:
        """Export audit log for compliance purposes"""
        events = await self.query_events(
            start_time=start_time, end_time=end_time, limit=100000
        )

        export_data = {
            "export_id": uuid7str(),
            "export_timestamp": datetime.now(timezone.utc).isoformat(),
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "total_events": len(events),
            "format_version": "1.0",
            "events": [event.model_dump() for event in events],
        }

        if include_integrity and self.config.enable_integrity_protection:
            export_data["integrity_chain"] = [
                record.model_dump()
                for record in self.integrity_chain
                if start_time <= record.timestamp <= end_time
            ]

        # Log the export event
        await self.log_event(
            event_type=AuditEventType.AUDIT_EXPORT,
            action="export_audit_log",
            description=f"Exported {len(events)} audit events",
            severity=AuditSeverity.HIGH,
            details={
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "event_count": len(events),
                "format": format,
            },
            compliance_flags=["audit_export"],
        )

        if format == "json":
            return json.dumps(export_data, indent=2, default=str)
        else:
            raise ValueError(f"Unsupported export format: {format}")

    async def verify_log_integrity(
        self, event_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Verify log integrity using checksums and integrity chain"""
        if not self.config.enable_integrity_protection:
            return {"verified": False, "reason": "Integrity protection disabled"}

        verification_results = {
            "verified": True,
            "total_events_checked": 0,
            "integrity_violations": [],
            "chain_verified": True,
        }

        # Verify specific event or all events
        events_to_verify = []
        if event_id:
            # Find specific event
            for event in self.event_buffer:
                if event.event_id == event_id:
                    events_to_verify.append(event)
                    break
        else:
            events_to_verify = self.event_buffer

        # Verify individual event checksums
        for event in events_to_verify:
            if event.checksum:
                calculated_checksum = self._calculate_event_checksum(event)
                if calculated_checksum != event.checksum:
                    verification_results["integrity_violations"].append(
                        {
                            "event_id": event.event_id,
                            "violation_type": "checksum_mismatch",
                            "expected": event.checksum,
                            "calculated": calculated_checksum,
                        }
                    )
                    verification_results["verified"] = False

        verification_results["total_events_checked"] = len(events_to_verify)

        # Verify integrity chain
        if not self._verify_integrity_chain():
            verification_results["chain_verified"] = False
            verification_results["verified"] = False

        return verification_results

    async def register_event_handler(
        self, event_type: AuditEventType, handler: Callable[[AuditEvent], None]
    ):
        """Register event handler for specific event type"""
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []

        self.event_handlers[event_type].append(handler)
        self.logger.info(f"Registered event handler for {event_type.value}")

    async def get_audit_statistics(self) -> Dict[str, Any]:
        """Get audit logging statistics"""
        return {
            "total_events_logged": self.total_events_logged,
            "events_in_buffer": len(self.event_buffer),
            "events_by_type": dict(
                sorted(self.events_by_type.items(), key=lambda x: x[1], reverse=True)
            ),
            "events_by_severity": self.events_by_severity,
            "integrity_chain_length": len(self.integrity_chain),
            "last_flush": getattr(self, "last_flush_time", None),
            "configuration": {
                "integrity_protection": self.config.enable_integrity_protection,
                "real_time_alerts": self.config.enable_real_time_alerts,
                "retention_days": self.config.default_retention_days,
                "batch_size": self.config.batch_size,
            },
        }

    async def cleanup_old_logs(self, older_than_days: int = None) -> int:
        """Clean up old log files based on retention policy"""
        if older_than_days is None:
            older_than_days = self.config.default_retention_days

        cutoff_date = datetime.now(timezone.utc) - timedelta(days=older_than_days)
        cleaned_count = 0

        # Remove old events from buffer (normally these would be in persistent storage)
        original_count = len(self.event_buffer)
        self.event_buffer = [
            event for event in self.event_buffer if event.timestamp > cutoff_date
        ]
        cleaned_count = original_count - len(self.event_buffer)

        # Clean up old integrity records
        original_integrity_count = len(self.integrity_chain)
        self.integrity_chain = [
            record for record in self.integrity_chain if record.timestamp > cutoff_date
        ]
        cleaned_count += original_integrity_count - len(self.integrity_chain)

        if cleaned_count > 0:
            self.logger.info(f"Cleaned up {cleaned_count} old audit records")

        return cleaned_count

    def _should_log_event(
        self, event_type: AuditEventType, severity: AuditSeverity
    ) -> bool:
        """Check if event should be logged based on configuration"""
        if not self.config.log_all_events:
            return False

        if event_type.value in self.config.excluded_event_types:
            return False

        # Check minimum severity
        severity_levels = {
            AuditSeverity.LOW: 1,
            AuditSeverity.MEDIUM: 2,
            AuditSeverity.HIGH: 3,
            AuditSeverity.CRITICAL: 4,
        }

        return (
            severity_levels[severity] >= severity_levels[self.config.minimum_severity]
        )

    def _calculate_event_checksum(self, event: AuditEvent) -> str:
        """Calculate integrity checksum for event"""
        # Create deterministic string representation
        event_data = {
            "event_id": event.event_id,
            "event_type": event.event_type.value,
            "timestamp": event.timestamp.isoformat(),
            "user_id": event.user_id,
            "action": event.action,
            "description": event.description,
            "details": json.dumps(event.details, sort_keys=True)
            if event.details
            else None,
        }

        event_string = json.dumps(event_data, sort_keys=True)

        if isinstance(self.integrity_key, str):
            key_bytes = self.integrity_key.encode("utf-8")
        else:
            key_bytes = self.integrity_key

        return hmac.new(
            key_bytes, event_string.encode("utf-8"), hashlib.sha256
        ).hexdigest()

    def _create_integrity_record(self, event: AuditEvent) -> LogIntegrityRecord:
        """Create integrity record for event"""
        current_hash = self._calculate_event_checksum(event)

        # Create HMAC signature
        signature_data = f"{event.event_id}:{current_hash}:{self.last_hash or ''}"

        if isinstance(self.integrity_key, str):
            key_bytes = self.integrity_key.encode("utf-8")
        else:
            key_bytes = self.integrity_key

        signature = hmac.new(
            key_bytes, signature_data.encode("utf-8"), hashlib.sha256
        ).hexdigest()

        record = LogIntegrityRecord(
            event_id=event.event_id,
            previous_hash=self.last_hash,
            current_hash=current_hash,
            signature=signature,
        )

        self.last_hash = current_hash
        return record

    def _verify_integrity_chain(self) -> bool:
        """Verify the integrity chain"""
        if not self.integrity_chain:
            return True

        previous_hash = None
        for record in self.integrity_chain:
            # Verify signature
            signature_data = (
                f"{record.event_id}:{record.current_hash}:{record.previous_hash or ''}"
            )

            if isinstance(self.integrity_key, str):
                key_bytes = self.integrity_key.encode("utf-8")
            else:
                key_bytes = self.integrity_key

            expected_signature = hmac.new(
                key_bytes, signature_data.encode("utf-8"), hashlib.sha256
            ).hexdigest()

            if record.signature != expected_signature:
                return False

            # Verify hash chain
            if record.previous_hash != previous_hash:
                return False

            previous_hash = record.current_hash

        return True

    def _event_matches_filters(
        self,
        event: AuditEvent,
        start_time: Optional[datetime],
        end_time: Optional[datetime],
        event_types: Optional[List[AuditEventType]],
        user_id: Optional[str],
        resource_type: Optional[str],
        resource_id: Optional[str],
        severity: Optional[AuditSeverity],
        tags: Optional[List[str]],
    ) -> bool:
        """Check if event matches query filters"""
        if start_time and event.timestamp < start_time:
            return False

        if end_time and event.timestamp > end_time:
            return False

        if event_types and event.event_type not in event_types:
            return False

        if user_id and event.user_id != user_id:
            return False

        if resource_type and event.resource_type != resource_type:
            return False

        if resource_id and event.resource_id != resource_id:
            return False

        if severity and event.severity != severity:
            return False

        if tags and not any(tag in event.tags for tag in tags):
            return False

        return True

    async def _flush_events(self):
        """Flush events from buffer to persistent storage"""
        if not self.event_buffer:
            return

        try:
            # In production, this would write to database or log files
            # For now, we'll simulate by creating integrity records
            if self.config.enable_integrity_protection:
                for event in self.event_buffer[: self.config.batch_size]:
                    integrity_record = self._create_integrity_record(event)
                    self.integrity_chain.append(integrity_record)

            # Remove flushed events (keep some in memory for recent queries)
            if len(self.event_buffer) > self.config.max_memory_events // 2:
                self.event_buffer = self.event_buffer[self.config.batch_size :]

            self.last_flush_time = datetime.now(timezone.utc)
            self.logger.debug(
                f"Flushed {min(self.config.batch_size, len(self.event_buffer))} audit events"
            )

        except Exception as e:
            self.logger.error(f"Failed to flush audit events: {e}")

    async def _handle_real_time_alert(self, event: AuditEvent):
        """Handle real-time alerts for critical events"""
        if (
            not self.config.alert_on_critical_events
            or event.severity != AuditSeverity.CRITICAL
        ):
            return

        try:
            # In production, this would send alerts via webhook, email, etc.
            alert_message = (
                f"CRITICAL AUDIT EVENT: {event.event_type.value} - {event.description}"
            )
            self.logger.critical(alert_message)

            # If webhook URL is configured, send alert
            if self.config.alert_webhook_url:
                # Would send HTTP POST to webhook URL
                pass

        except Exception as e:
            self.logger.error(f"Failed to send real-time alert: {e}")

    async def _trigger_event_handlers(self, event: AuditEvent):
        """Trigger registered event handlers"""
        handlers = self.event_handlers.get(event.event_type, [])

        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(event)
                else:
                    handler(event)
            except Exception as e:
                self.logger.error(f"Event handler failed: {e}")

    def _ensure_log_directories(self):
        """Ensure log directories exist"""
        Path(self.config.log_file_path).parent.mkdir(parents=True, exist_ok=True)
        Path(self.config.archive_path).mkdir(parents=True, exist_ok=True)

    async def _start_background_tasks(self):
        """Start background processing tasks"""

        # Periodic flush task
        async def periodic_flush():
            while True:
                try:
                    await asyncio.sleep(self.config.flush_interval_seconds)
                    await self._flush_events()
                except Exception as e:
                    self.logger.error(f"Periodic flush error: {e}")

        self.flush_task = asyncio.create_task(periodic_flush())

        # Cleanup task (runs daily)
        async def periodic_cleanup():
            while True:
                try:
                    await asyncio.sleep(86400)  # 24 hours
                    await self.cleanup_old_logs()
                except Exception as e:
                    self.logger.error(f"Periodic cleanup error: {e}")

        self.archive_task = asyncio.create_task(periodic_cleanup())

    async def close(self):
        """Close audit logger and flush remaining events"""
        # Cancel background tasks
        if self.flush_task:
            self.flush_task.cancel()

        if self.archive_task:
            self.archive_task.cancel()

        # Final flush
        await self._flush_events()

        self.logger.info("Audit logger closed")


# Factory function
def create_audit_logger(config: Optional[AuditConfiguration] = None) -> AuditLogger:
    """Create AuditLogger instance with optional configuration"""
    return AuditLogger(config)


# Convenience functions for common audit events
async def log_authentication_event(
    audit_logger: AuditLogger,
    event_type: AuditEventType,
    user_id: str,
    success: bool,
    source_ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> str:
    """Log authentication-related event"""
    severity = AuditSeverity.MEDIUM if success else AuditSeverity.HIGH
    description = (
        f"Authentication {'succeeded' if success else 'failed'} for user {user_id}"
    )

    return await audit_logger.log_event(
        event_type=event_type,
        action="authenticate",
        description=description,
        user_id=user_id,
        source_ip=source_ip,
        user_agent=user_agent,
        severity=severity,
        details=details,
        tags=["authentication"],
    )


async def log_document_event(
    audit_logger: AuditLogger,
    event_type: AuditEventType,
    action: str,
    document_id: str,
    user_id: str,
    before_state: Optional[Dict[str, Any]] = None,
    after_state: Optional[Dict[str, Any]] = None,
    details: Optional[Dict[str, Any]] = None,
) -> str:
    """Log document-related event"""
    return await audit_logger.log_event(
        event_type=event_type,
        action=action,
        description=f"Document {action}: {document_id}",
        user_id=user_id,
        resource_type="document",
        resource_id=document_id,
        severity=AuditSeverity.MEDIUM,
        before_state=before_state,
        after_state=after_state,
        details=details,
        tags=["document"],
    )


async def log_security_event(
    audit_logger: AuditLogger,
    event_type: AuditEventType,
    description: str,
    user_id: Optional[str] = None,
    source_ip: Optional[str] = None,
    severity: AuditSeverity = AuditSeverity.HIGH,
    details: Optional[Dict[str, Any]] = None,
) -> str:
    """Log security-related event"""
    return await audit_logger.log_event(
        event_type=event_type,
        action="security_event",
        description=description,
        user_id=user_id,
        source_ip=source_ip,
        severity=severity,
        details=details,
        tags=["security"],
        compliance_flags=["security_audit"],
    )
