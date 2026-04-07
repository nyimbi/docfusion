"""
Opportunity Deduplicator
========================

Detects and handles duplicate opportunities across sources.

Deduplication Strategy:
	1. Exact match: Same source_id from same source
	2. Fingerprint match: SHA256 hash of (title + org + deadline)
	3. Similarity match: Fuzzy title matching (85%+ similarity)

Source Priority (for duplicate resolution):
	1. Government Gazette (most authoritative)
	2. Government Portal (official source)
	3. MDB Portal (World Bank, AfDB, etc.)
	4. UN Agency (UNDP, UNGM, etc.)
	5. Aggregator (dgMarket, etc.)

Author: TenderSourceMax
"""

from __future__ import annotations

import hashlib
import logging
import sqlite3
from datetime import date, datetime, timezone
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from difflib import SequenceMatcher
from enum import IntEnum

from backend.discovery.models.opportunity import ScrapedOpportunity, SourceType

logger = logging.getLogger(__name__)


# ============================================================================
# Source Priority
# ============================================================================

class SourcePriority(IntEnum):
	"""Source priority for duplicate resolution (higher = more authoritative)."""
	GAZETTE = 100        # Government gazettes
	GOVERNMENT = 80      # National e-procurement portals
	MDB = 60             # Multilateral Development Banks
	UN_AGENCY = 50       # UN agencies
	REGIONAL = 40        # Regional organizations
	AGGREGATOR = 20      # Third-party aggregators
	OTHER = 10           # Other sources


SOURCE_TYPE_PRIORITY: dict[SourceType, SourcePriority] = {
	SourceType.GAZETTE: SourcePriority.GAZETTE,
	SourceType.GOVERNMENT: SourcePriority.GOVERNMENT,
	SourceType.MDB: SourcePriority.MDB,
	SourceType.UN_AGENCY: SourcePriority.UN_AGENCY,
	SourceType.REGIONAL: SourcePriority.REGIONAL,
	SourceType.AGGREGATOR: SourcePriority.AGGREGATOR,
	SourceType.OTHER: SourcePriority.OTHER,
}


# ============================================================================
# Deduplication Result
# ============================================================================

@dataclass
class DuplicateMatch:
	"""Information about a duplicate match."""
	existing_fingerprint: str
	existing_source: str
	existing_title: str
	match_type: str  # "exact", "fingerprint", "similarity"
	similarity_score: float | None = None


@dataclass
class DeduplicationResult:
	"""Result of deduplication check."""
	is_duplicate: bool
	action: str  # "skip", "update", "insert"
	match: DuplicateMatch | None = None
	reason: str = ""


@dataclass
class BatchDeduplicationResult:
	"""Result of batch deduplication."""
	unique: list[ScrapedOpportunity]
	duplicates: list[tuple[ScrapedOpportunity, DuplicateMatch]]
	updates: list[tuple[ScrapedOpportunity, str]]  # (opp, existing_fingerprint)
	stats: dict[str, int] = field(default_factory=dict)


# ============================================================================
# Deduplicator
# ============================================================================

class Deduplicator:
	"""
	Detects duplicate opportunities using multiple strategies.

	Uses SQLite for persistent fingerprint storage, enabling
	deduplication across scraping sessions.

	Usage:
		dedup = Deduplicator(db_path="dedup.db")
		result = dedup.check(opportunity)
		if not result.is_duplicate:
			# Process the opportunity
			dedup.register(opportunity)
	"""

	# Similarity threshold for fuzzy matching
	SIMILARITY_THRESHOLD = 0.85

	def __init__(
		self,
		db_path: str | Path | None = None,
		similarity_threshold: float = 0.85,
		enable_similarity_check: bool = True,
	) -> None:
		"""
		Initialize deduplicator.

		Args:
			db_path: Path to SQLite database for fingerprint storage.
					 If None, uses in-memory storage.
			similarity_threshold: Threshold for fuzzy title matching (0-1)
			enable_similarity_check: Whether to perform expensive similarity checks
		"""
		self.similarity_threshold = similarity_threshold
		self.enable_similarity_check = enable_similarity_check

		# Initialize database
		if db_path:
			self.db_path = Path(db_path)
			self.db_path.parent.mkdir(parents=True, exist_ok=True)
			self._conn = sqlite3.connect(str(self.db_path))
		else:
			self._conn = sqlite3.connect(":memory:")

		self._init_database()

		# In-memory cache for current session
		self._session_fingerprints: set[str] = set()
		self._session_source_ids: dict[str, set[str]] = {}  # source -> {source_ids}

		# Statistics
		self._stats = {
			"checked": 0,
			"duplicates_exact": 0,
			"duplicates_fingerprint": 0,
			"duplicates_similarity": 0,
			"unique": 0,
			"updates": 0,
		}

	def _init_database(self) -> None:
		"""Initialize SQLite database schema."""
		cursor = self._conn.cursor()

		cursor.execute("""
			CREATE TABLE IF NOT EXISTS fingerprints (
				fingerprint TEXT PRIMARY KEY,
				source TEXT NOT NULL,
				source_id TEXT NOT NULL,
				title TEXT NOT NULL,
				organization TEXT,
				deadline TEXT,
				source_type TEXT,
				first_seen TEXT NOT NULL,
				last_seen TEXT NOT NULL,
				seen_count INTEGER DEFAULT 1
			)
		""")

		cursor.execute("""
			CREATE INDEX IF NOT EXISTS idx_source_source_id
			ON fingerprints(source, source_id)
		""")

		cursor.execute("""
			CREATE INDEX IF NOT EXISTS idx_title
			ON fingerprints(title)
		""")

		self._conn.commit()

	@property
	def stats(self) -> dict[str, int]:
		"""Get deduplication statistics."""
		return self._stats.copy()

	def reset_stats(self) -> None:
		"""Reset statistics counters."""
		self._stats = {
			"checked": 0,
			"duplicates_exact": 0,
			"duplicates_fingerprint": 0,
			"duplicates_similarity": 0,
			"unique": 0,
			"updates": 0,
		}

	def check(
		self,
		opportunity: ScrapedOpportunity,
		source_type: SourceType = SourceType.OTHER,
	) -> DeduplicationResult:
		"""
		Check if opportunity is a duplicate.

		Args:
			opportunity: Opportunity to check
			source_type: Type of source for priority resolution

		Returns:
			DeduplicationResult with action and match info
		"""
		self._stats["checked"] += 1

		# 1. Check exact source_id match (same source)
		exact_match = self._check_exact_match(opportunity)
		if exact_match:
			self._stats["duplicates_exact"] += 1
			return DeduplicationResult(
				is_duplicate=True,
				action="skip",
				match=exact_match,
				reason="Exact source_id match",
			)

		# 2. Check fingerprint match (cross-source)
		fingerprint = opportunity.fingerprint
		fingerprint_match = self._check_fingerprint_match(fingerprint, opportunity)

		if fingerprint_match:
			# Determine action based on source priority
			action, reason = self._resolve_duplicate(
				opportunity, fingerprint_match, source_type
			)

			if action == "skip":
				self._stats["duplicates_fingerprint"] += 1
			else:
				self._stats["updates"] += 1

			return DeduplicationResult(
				is_duplicate=True,
				action=action,
				match=fingerprint_match,
				reason=reason,
			)

		# 3. Optional similarity check (expensive)
		if self.enable_similarity_check:
			similarity_match = self._check_similarity_match(opportunity)
			if similarity_match:
				self._stats["duplicates_similarity"] += 1
				return DeduplicationResult(
					is_duplicate=True,
					action="skip",
					match=similarity_match,
					reason=f"Title similarity {similarity_match.similarity_score:.0%}",
				)

		# Not a duplicate
		self._stats["unique"] += 1
		return DeduplicationResult(
			is_duplicate=False,
			action="insert",
			reason="No duplicate found",
		)

	def _check_exact_match(
		self,
		opportunity: ScrapedOpportunity,
	) -> DuplicateMatch | None:
		"""Check for exact source_id match from same source."""
		source = opportunity.source
		source_id = opportunity.source_id

		# Check session cache first
		if source in self._session_source_ids:
			if source_id in self._session_source_ids[source]:
				return DuplicateMatch(
					existing_fingerprint="",
					existing_source=source,
					existing_title="",
					match_type="exact",
				)

		# Check database
		cursor = self._conn.cursor()
		cursor.execute(
			"SELECT fingerprint, title FROM fingerprints WHERE source = ? AND source_id = ?",
			(source, source_id),
		)
		row = cursor.fetchone()

		if row:
			return DuplicateMatch(
				existing_fingerprint=row[0],
				existing_source=source,
				existing_title=row[1],
				match_type="exact",
			)

		return None

	def _check_fingerprint_match(
		self,
		fingerprint: str,
		opportunity: ScrapedOpportunity,
	) -> DuplicateMatch | None:
		"""Check for fingerprint match in database."""
		# Check session cache
		if fingerprint in self._session_fingerprints:
			return DuplicateMatch(
				existing_fingerprint=fingerprint,
				existing_source="session",
				existing_title="",
				match_type="fingerprint",
			)

		# Check database
		cursor = self._conn.cursor()
		cursor.execute(
			"SELECT source, title, source_type FROM fingerprints WHERE fingerprint = ?",
			(fingerprint,),
		)
		row = cursor.fetchone()

		if row:
			return DuplicateMatch(
				existing_fingerprint=fingerprint,
				existing_source=row[0],
				existing_title=row[1],
				match_type="fingerprint",
			)

		return None

	def _check_similarity_match(
		self,
		opportunity: ScrapedOpportunity,
	) -> DuplicateMatch | None:
		"""
		Check for similar titles in database.

		This is an expensive operation - use sparingly.
		"""
		title = opportunity.title.lower().strip()

		# Only check against recent entries to limit scope
		cursor = self._conn.cursor()
		cursor.execute(
			"""
			SELECT fingerprint, source, title
			FROM fingerprints
			ORDER BY last_seen DESC
			LIMIT 1000
			"""
		)

		for row in cursor.fetchall():
			existing_title = row[2].lower().strip()
			similarity = SequenceMatcher(None, title, existing_title).ratio()

			if similarity >= self.similarity_threshold:
				return DuplicateMatch(
					existing_fingerprint=row[0],
					existing_source=row[1],
					existing_title=row[2],
					match_type="similarity",
					similarity_score=similarity,
				)

		return None

	def _resolve_duplicate(
		self,
		opportunity: ScrapedOpportunity,
		match: DuplicateMatch,
		source_type: SourceType,
	) -> tuple[str, str]:
		"""
		Determine action for duplicate based on source priority.

		Returns:
			Tuple of (action, reason)
		"""
		# Get existing source type from database
		cursor = self._conn.cursor()
		cursor.execute(
			"SELECT source_type FROM fingerprints WHERE fingerprint = ?",
			(match.existing_fingerprint,),
		)
		row = cursor.fetchone()

		if not row or not row[0]:
			# Can't determine priority, skip by default
			return "skip", "Existing source type unknown"

		try:
			existing_source_type = SourceType(row[0])
		except ValueError:
			return "skip", "Invalid existing source type"

		# Compare priorities
		new_priority = SOURCE_TYPE_PRIORITY.get(source_type, SourcePriority.OTHER)
		existing_priority = SOURCE_TYPE_PRIORITY.get(existing_source_type, SourcePriority.OTHER)

		if new_priority > existing_priority:
			return "update", f"Higher priority source ({source_type.value} > {existing_source_type.value})"
		else:
			return "skip", f"Lower or equal priority ({source_type.value} <= {existing_source_type.value})"

	def register(
		self,
		opportunity: ScrapedOpportunity,
		source_type: SourceType = SourceType.OTHER,
	) -> None:
		"""
		Register opportunity in deduplication database.

		Call this after successfully processing an opportunity.

		Args:
			opportunity: Opportunity to register
			source_type: Type of source
		"""
		fingerprint = opportunity.fingerprint
		now = datetime.now(timezone.utc).isoformat()

		# Update session cache
		self._session_fingerprints.add(fingerprint)

		if opportunity.source not in self._session_source_ids:
			self._session_source_ids[opportunity.source] = set()
		self._session_source_ids[opportunity.source].add(opportunity.source_id)

		# Upsert to database
		cursor = self._conn.cursor()
		cursor.execute(
			"""
			INSERT INTO fingerprints (
				fingerprint, source, source_id, title, organization,
				deadline, source_type, first_seen, last_seen, seen_count
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
			ON CONFLICT(fingerprint) DO UPDATE SET
				last_seen = excluded.last_seen,
				seen_count = seen_count + 1,
				source = CASE
					WHEN excluded.source_type > source_type THEN excluded.source
					ELSE source
				END,
				source_type = CASE
					WHEN excluded.source_type > source_type THEN excluded.source_type
					ELSE source_type
				END
			""",
			(
				fingerprint,
				opportunity.source,
				opportunity.source_id,
				opportunity.title,
				opportunity.organization,
				opportunity.deadline.isoformat() if opportunity.deadline else None,
				source_type.value,
				now,
				now,
			),
		)
		self._conn.commit()

	def process_batch(
		self,
		opportunities: list[ScrapedOpportunity],
		source_type: SourceType = SourceType.OTHER,
		auto_register: bool = True,
	) -> BatchDeduplicationResult:
		"""
		Process a batch of opportunities for deduplication.

		Args:
			opportunities: List of opportunities to process
			source_type: Type of source for all opportunities
			auto_register: Whether to automatically register unique opportunities

		Returns:
			BatchDeduplicationResult with unique/duplicate lists
		"""
		unique: list[ScrapedOpportunity] = []
		duplicates: list[tuple[ScrapedOpportunity, DuplicateMatch]] = []
		updates: list[tuple[ScrapedOpportunity, str]] = []

		for opp in opportunities:
			result = self.check(opp, source_type)

			if not result.is_duplicate:
				unique.append(opp)
				if auto_register:
					self.register(opp, source_type)

			elif result.action == "update":
				updates.append((opp, result.match.existing_fingerprint))
				if auto_register:
					self.register(opp, source_type)

			else:  # skip
				duplicates.append((opp, result.match))

		return BatchDeduplicationResult(
			unique=unique,
			duplicates=duplicates,
			updates=updates,
			stats={
				"total": len(opportunities),
				"unique": len(unique),
				"duplicates": len(duplicates),
				"updates": len(updates),
			},
		)

	def get_fingerprint_count(self) -> int:
		"""Get total number of fingerprints in database."""
		cursor = self._conn.cursor()
		cursor.execute("SELECT COUNT(*) FROM fingerprints")
		return cursor.fetchone()[0]

	def clear_old_entries(self, days: int = 90) -> int:
		"""
		Remove entries not seen in the specified number of days.

		Args:
			days: Number of days after which to remove entries

		Returns:
			Number of entries removed
		"""
		from datetime import timedelta

		cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

		cursor = self._conn.cursor()
		cursor.execute(
			"DELETE FROM fingerprints WHERE last_seen < ?",
			(cutoff,),
		)
		deleted = cursor.rowcount
		self._conn.commit()

		logger.info(f"Cleared {deleted} old fingerprint entries")
		return deleted

	def close(self) -> None:
		"""Close database connection."""
		self._conn.close()

	def __enter__(self) -> "Deduplicator":
		return self

	def __exit__(self, *args) -> None:
		self.close()


# ============================================================================
# Standalone execution
# ============================================================================

if __name__ == "__main__":
	import tempfile

	# Test deduplicator
	with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
		db_path = f.name

	dedup = Deduplicator(db_path=db_path)

	# Create test opportunities
	opp1 = ScrapedOpportunity(
		source_id="TEST001",
		source="test_source",
		title="Supply of IT Equipment for Ministry",
		organization="Ministry of Finance",
		deadline=date(2024, 3, 15),
	)

	opp2 = ScrapedOpportunity(
		source_id="TEST002",
		source="test_source",
		title="Supply of IT Equipment for Ministry",  # Same title
		organization="Ministry of Finance",
		deadline=date(2024, 3, 15),  # Same deadline
	)

	opp3 = ScrapedOpportunity(
		source_id="TEST003",
		source="other_source",
		title="Completely Different Tender",
		organization="Other Org",
		deadline=date(2024, 4, 1),
	)

	# Test deduplication
	print("Testing Deduplicator")
	print("=" * 40)

	result1 = dedup.check(opp1)
	print(f"Opp1: {result1.action} - {result1.reason}")
	dedup.register(opp1)

	result2 = dedup.check(opp2)
	print(f"Opp2: {result2.action} - {result2.reason}")

	result3 = dedup.check(opp3)
	print(f"Opp3: {result3.action} - {result3.reason}")

	print(f"\nStats: {dedup.stats}")
	print(f"Fingerprints in DB: {dedup.get_fingerprint_count()}")

	dedup.close()

	# Cleanup
	Path(db_path).unlink()
