"""
Health Monitoring
=================

Health checks and status tracking for scraping sources.

Monitors:
	- Last successful scrape per source
	- Success/failure rate
	- Opportunities found trends
	- Processing time averages
	- Error patterns

Alerts:
	- Source down > 24 hours
	- Zero opportunities (unexpected)
	- Rate limit exceeded
	- Parsing errors spike

Author: TenderSourceMax
"""

from __future__ import annotations

import json
import logging
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


# ============================================================================
# Health Status
# ============================================================================

class HealthStatus(str, Enum):
	"""Health status levels."""
	HEALTHY = "healthy"
	DEGRADED = "degraded"
	UNHEALTHY = "unhealthy"
	UNKNOWN = "unknown"


@dataclass
class SourceHealth:
	"""Health status for a single source."""
	source_id: str
	status: HealthStatus
	last_success: datetime | None = None
	last_failure: datetime | None = None
	success_rate_24h: float = 0.0
	avg_opportunities_per_run: float = 0.0
	avg_duration_seconds: float = 0.0
	consecutive_failures: int = 0
	last_error: str | None = None
	warnings: list[str] = field(default_factory=list)


@dataclass
class SystemHealth:
	"""Overall system health."""
	status: HealthStatus
	sources_healthy: int = 0
	sources_degraded: int = 0
	sources_unhealthy: int = 0
	sources_unknown: int = 0
	total_opportunities_24h: int = 0
	dedup_fingerprints: int = 0
	source_details: list[SourceHealth] = field(default_factory=list)
	alerts: list[str] = field(default_factory=list)


# ============================================================================
# Health Record Storage
# ============================================================================

@dataclass
class ScrapeRecord:
	"""Record of a single scrape execution."""
	source_id: str
	timestamp: datetime
	status: str  # "success", "partial", "failed"
	opportunities_found: int
	opportunities_unique: int
	duration_seconds: float
	error: str | None = None


# ============================================================================
# Health Checker
# ============================================================================

class HealthChecker:
	"""
	Monitors health of scraping sources.

	Tracks scrape history in SQLite and calculates health metrics.

	Usage:
		checker = HealthChecker(db_path="health.db")
		checker.record_scrape("ungm", "success", 50, 45, 30.5)
		health = checker.get_source_health("ungm")
	"""

	# Thresholds for health status
	SUCCESS_RATE_HEALTHY = 0.9  # 90%+ = healthy
	SUCCESS_RATE_DEGRADED = 0.5  # 50-90% = degraded
	MAX_HOURS_WITHOUT_SUCCESS = 24  # Unhealthy if no success in 24h
	MAX_CONSECUTIVE_FAILURES = 3  # Unhealthy after 3 consecutive failures

	def __init__(
		self,
		db_path: str | Path | None = None,
	) -> None:
		"""
		Initialize health checker.

		Args:
			db_path: Path to SQLite database for history storage
		"""
		if db_path:
			self.db_path = Path(db_path)
			self.db_path.parent.mkdir(parents=True, exist_ok=True)
			self._conn = sqlite3.connect(str(self.db_path))
		else:
			self._conn = sqlite3.connect(":memory:")

		self._init_database()

	def _init_database(self) -> None:
		"""Initialize database schema."""
		cursor = self._conn.cursor()

		cursor.execute("""
			CREATE TABLE IF NOT EXISTS scrape_history (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				source_id TEXT NOT NULL,
				timestamp TEXT NOT NULL,
				status TEXT NOT NULL,
				opportunities_found INTEGER DEFAULT 0,
				opportunities_unique INTEGER DEFAULT 0,
				duration_seconds REAL DEFAULT 0,
				error TEXT
			)
		""")

		cursor.execute("""
			CREATE INDEX IF NOT EXISTS idx_source_timestamp
			ON scrape_history(source_id, timestamp DESC)
		""")

		cursor.execute("""
			CREATE TABLE IF NOT EXISTS alerts (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				source_id TEXT,
				alert_type TEXT NOT NULL,
				message TEXT NOT NULL,
				timestamp TEXT NOT NULL,
				acknowledged INTEGER DEFAULT 0
			)
		""")

		self._conn.commit()

	def record_scrape(
		self,
		source_id: str,
		status: str,
		opportunities_found: int,
		opportunities_unique: int,
		duration_seconds: float,
		error: str | None = None,
	) -> None:
		"""
		Record a scrape execution.

		Args:
			source_id: Source identifier
			status: Status (success, partial, failed)
			opportunities_found: Total opportunities scraped
			opportunities_unique: Unique opportunities after dedup
			duration_seconds: Execution duration
			error: Error message if failed
		"""
		cursor = self._conn.cursor()
		cursor.execute(
			"""
			INSERT INTO scrape_history (
				source_id, timestamp, status, opportunities_found,
				opportunities_unique, duration_seconds, error
			) VALUES (?, ?, ?, ?, ?, ?, ?)
			""",
			(
				source_id,
				datetime.now(timezone.utc).isoformat(),
				status,
				opportunities_found,
				opportunities_unique,
				duration_seconds,
				error,
			),
		)
		self._conn.commit()

		# Check for alert conditions
		self._check_alerts(source_id, status, opportunities_found, error)

	def _check_alerts(
		self,
		source_id: str,
		status: str,
		opportunities_found: int,
		error: str | None,
	) -> None:
		"""Check for conditions that should trigger alerts."""
		health = self.get_source_health(source_id)

		alerts: list[tuple[str, str]] = []

		# Consecutive failure alert
		if health.consecutive_failures >= self.MAX_CONSECUTIVE_FAILURES:
			alerts.append((
				"consecutive_failures",
				f"Source {source_id} has failed {health.consecutive_failures} times consecutively",
			))

		# Zero opportunities alert (if previously successful)
		if status == "success" and opportunities_found == 0:
			if health.avg_opportunities_per_run > 0:
				alerts.append((
					"zero_opportunities",
					f"Source {source_id} returned 0 opportunities (expected ~{health.avg_opportunities_per_run:.0f})",
				))

		# Long time since success
		if health.last_success:
			hours_since = (datetime.now(timezone.utc) - health.last_success).total_seconds() / 3600
			if hours_since > self.MAX_HOURS_WITHOUT_SUCCESS:
				alerts.append((
					"no_recent_success",
					f"Source {source_id} has not succeeded in {hours_since:.1f} hours",
				))

		# Record alerts
		cursor = self._conn.cursor()
		for alert_type, message in alerts:
			cursor.execute(
				"""
				INSERT INTO alerts (source_id, alert_type, message, timestamp)
				VALUES (?, ?, ?, ?)
				""",
				(source_id, alert_type, message, datetime.now(timezone.utc).isoformat()),
			)
			logger.warning(f"ALERT: {message}")

		self._conn.commit()

	def get_source_health(self, source_id: str) -> SourceHealth:
		"""
		Get health status for a source.

		Args:
			source_id: Source identifier

		Returns:
			SourceHealth with metrics
		"""
		cursor = self._conn.cursor()

		# Get last 24 hours of history
		cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

		cursor.execute(
			"""
			SELECT status, timestamp, opportunities_found, opportunities_unique,
				   duration_seconds, error
			FROM scrape_history
			WHERE source_id = ? AND timestamp > ?
			ORDER BY timestamp DESC
			""",
			(source_id, cutoff),
		)
		rows = cursor.fetchall()

		if not rows:
			return SourceHealth(
				source_id=source_id,
				status=HealthStatus.UNKNOWN,
			)

		# Calculate metrics
		total_runs = len(rows)
		successful_runs = sum(1 for r in rows if r[0] == "success")
		success_rate = successful_runs / total_runs if total_runs > 0 else 0

		# Find last success/failure
		last_success = None
		last_failure = None
		last_error = None
		consecutive_failures = 0

		for row in rows:
			status, timestamp, opps_found, opps_unique, duration, error = row
			ts = datetime.fromisoformat(timestamp)

			if status == "success":
				if last_success is None:
					last_success = ts
				break  # Found most recent success
			else:
				if last_failure is None:
					last_failure = ts
					last_error = error
				consecutive_failures += 1

		# Calculate averages
		avg_opportunities = sum(r[2] for r in rows if r[0] == "success") / max(successful_runs, 1)
		avg_duration = sum(r[4] for r in rows) / total_runs

		# Determine status
		if consecutive_failures >= self.MAX_CONSECUTIVE_FAILURES:
			status = HealthStatus.UNHEALTHY
		elif success_rate >= self.SUCCESS_RATE_HEALTHY:
			status = HealthStatus.HEALTHY
		elif success_rate >= self.SUCCESS_RATE_DEGRADED:
			status = HealthStatus.DEGRADED
		else:
			status = HealthStatus.UNHEALTHY

		# Check for no recent success
		if last_success:
			hours_since = (datetime.now(timezone.utc) - last_success).total_seconds() / 3600
			if hours_since > self.MAX_HOURS_WITHOUT_SUCCESS:
				status = HealthStatus.UNHEALTHY

		# Generate warnings
		warnings: list[str] = []
		if avg_opportunities < 5 and avg_opportunities > 0:
			warnings.append("Low opportunity count")
		if avg_duration > 120:
			warnings.append("Slow execution time")

		return SourceHealth(
			source_id=source_id,
			status=status,
			last_success=last_success,
			last_failure=last_failure,
			success_rate_24h=success_rate,
			avg_opportunities_per_run=avg_opportunities,
			avg_duration_seconds=avg_duration,
			consecutive_failures=consecutive_failures,
			last_error=last_error,
			warnings=warnings,
		)

	def get_system_health(
		self,
		source_ids: list[str] | None = None,
	) -> SystemHealth:
		"""
		Get overall system health.

		Args:
			source_ids: List of sources to check (all if None)

		Returns:
			SystemHealth with aggregated metrics
		"""
		cursor = self._conn.cursor()

		# Get all sources with recent activity if not specified
		if source_ids is None:
			cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
			cursor.execute(
				"SELECT DISTINCT source_id FROM scrape_history WHERE timestamp > ?",
				(cutoff,),
			)
			source_ids = [row[0] for row in cursor.fetchall()]

		# Get health for each source
		source_details: list[SourceHealth] = []
		healthy = degraded = unhealthy = unknown = 0

		for source_id in source_ids:
			health = self.get_source_health(source_id)
			source_details.append(health)

			if health.status == HealthStatus.HEALTHY:
				healthy += 1
			elif health.status == HealthStatus.DEGRADED:
				degraded += 1
			elif health.status == HealthStatus.UNHEALTHY:
				unhealthy += 1
			else:
				unknown += 1

		# Calculate total opportunities in 24h
		cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
		cursor.execute(
			"""
			SELECT SUM(opportunities_unique)
			FROM scrape_history
			WHERE timestamp > ? AND status = 'success'
			""",
			(cutoff,),
		)
		total_opps = cursor.fetchone()[0] or 0

		# Get active alerts
		cursor.execute(
			"""
			SELECT message FROM alerts
			WHERE acknowledged = 0
			ORDER BY timestamp DESC
			LIMIT 10
			"""
		)
		alerts = [row[0] for row in cursor.fetchall()]

		# Determine overall status
		if unhealthy > 0:
			overall_status = HealthStatus.UNHEALTHY
		elif degraded > 0:
			overall_status = HealthStatus.DEGRADED
		elif healthy > 0:
			overall_status = HealthStatus.HEALTHY
		else:
			overall_status = HealthStatus.UNKNOWN

		return SystemHealth(
			status=overall_status,
			sources_healthy=healthy,
			sources_degraded=degraded,
			sources_unhealthy=unhealthy,
			sources_unknown=unknown,
			total_opportunities_24h=total_opps,
			source_details=source_details,
			alerts=alerts,
		)

	def get_recent_alerts(
		self,
		limit: int = 20,
		unacknowledged_only: bool = True,
	) -> list[dict[str, Any]]:
		"""
		Get recent alerts.

		Args:
			limit: Maximum alerts to return
			unacknowledged_only: Only return unacknowledged alerts

		Returns:
			List of alert dictionaries
		"""
		cursor = self._conn.cursor()

		if unacknowledged_only:
			cursor.execute(
				"""
				SELECT source_id, alert_type, message, timestamp
				FROM alerts
				WHERE acknowledged = 0
				ORDER BY timestamp DESC
				LIMIT ?
				""",
				(limit,),
			)
		else:
			cursor.execute(
				"""
				SELECT source_id, alert_type, message, timestamp
				FROM alerts
				ORDER BY timestamp DESC
				LIMIT ?
				""",
				(limit,),
			)

		return [
			{
				"source_id": row[0],
				"type": row[1],
				"message": row[2],
				"timestamp": row[3],
			}
			for row in cursor.fetchall()
		]

	def acknowledge_alerts(
		self,
		source_id: str | None = None,
	) -> int:
		"""
		Acknowledge alerts.

		Args:
			source_id: Source to acknowledge (all if None)

		Returns:
			Number of alerts acknowledged
		"""
		cursor = self._conn.cursor()

		if source_id:
			cursor.execute(
				"UPDATE alerts SET acknowledged = 1 WHERE source_id = ? AND acknowledged = 0",
				(source_id,),
			)
		else:
			cursor.execute("UPDATE alerts SET acknowledged = 1 WHERE acknowledged = 0")

		count = cursor.rowcount
		self._conn.commit()

		return count

	def cleanup_old_records(self, days: int = 30) -> int:
		"""
		Remove records older than specified days.

		Args:
			days: Number of days to retain

		Returns:
			Number of records removed
		"""
		cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
		cursor = self._conn.cursor()

		cursor.execute("DELETE FROM scrape_history WHERE timestamp < ?", (cutoff,))
		history_deleted = cursor.rowcount

		cursor.execute("DELETE FROM alerts WHERE timestamp < ?", (cutoff,))
		alerts_deleted = cursor.rowcount

		self._conn.commit()

		logger.info(f"Cleaned up {history_deleted} history records and {alerts_deleted} alerts")

		return history_deleted + alerts_deleted

	def close(self) -> None:
		"""Close database connection."""
		self._conn.close()


# ============================================================================
# Convenience Functions
# ============================================================================

_default_checker: HealthChecker | None = None


def get_health_checker(db_path: str | Path | None = None) -> HealthChecker:
	"""Get or create default health checker."""
	global _default_checker

	if _default_checker is None:
		_default_checker = HealthChecker(db_path or "data/health.db")

	return _default_checker


def check_source_health(source_id: str) -> SourceHealth:
	"""Check health of a single source."""
	return get_health_checker().get_source_health(source_id)


def get_system_health() -> SystemHealth:
	"""Get overall system health."""
	return get_health_checker().get_system_health()


# ============================================================================
# Standalone execution
# ============================================================================

if __name__ == "__main__":
	# Test health checker
	checker = HealthChecker()

	# Simulate some scrape records
	test_sources = ["ungm", "afdb", "kenya_ppip"]

	for source in test_sources:
		# Record some successes
		for i in range(5):
			checker.record_scrape(
				source_id=source,
				status="success",
				opportunities_found=50 + i * 5,
				opportunities_unique=40 + i * 3,
				duration_seconds=25.0 + i,
			)

	# Record a failure
	checker.record_scrape(
		source_id="afdb",
		status="failed",
		opportunities_found=0,
		opportunities_unique=0,
		duration_seconds=5.0,
		error="Connection timeout",
	)

	# Get health status
	print("System Health")
	print("=" * 60)

	system_health = checker.get_system_health(test_sources)
	print(f"Overall Status: {system_health.status.value}")
	print(f"Sources Healthy: {system_health.sources_healthy}")
	print(f"Sources Degraded: {system_health.sources_degraded}")
	print(f"Sources Unhealthy: {system_health.sources_unhealthy}")
	print(f"Total Opportunities (24h): {system_health.total_opportunities_24h}")

	print("\nSource Details:")
	for source in system_health.source_details:
		print(f"  {source.source_id}: {source.status.value}")
		print(f"    Success Rate: {source.success_rate_24h:.0%}")
		print(f"    Avg Opportunities: {source.avg_opportunities_per_run:.0f}")

	# Show alerts
	alerts = checker.get_recent_alerts()
	if alerts:
		print(f"\nAlerts ({len(alerts)}):")
		for alert in alerts:
			print(f"  - {alert['message']}")

	checker.close()
