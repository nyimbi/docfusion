"""
DocFusion Sync
==============

Synchronizes scraped opportunities to the DocFusion frontend database.

Responsibilities:
	- Transform ScrapedOpportunity to DocFusion format
	- Batch insert/update to PostgreSQL
	- Track sync history and status
	- Handle conflicts and errors

Integration Points:
	- frontend/lib/db/schema.ts: opportunities table
	- frontend/lib/types/opportunity.ts: TypeScript types
	- frontend/lib/actions/import-opportunities.ts: Existing import system

Author: TenderSourceMax
"""

from __future__ import annotations

import os
import json
import logging
from datetime import datetime, date, timezone
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4
from pathlib import Path

from backend.discovery.models.opportunity import ScrapedOpportunity

logger = logging.getLogger(__name__)


# ============================================================================
# DocFusion Schema Mapping
# ============================================================================

# Field naming conventions across the stack:
#   SQL column:   country_region  (snake_case, PostgreSQL convention)
#   Python dict:  country_region  (snake_case, matches SQL column for raw queries)
#   TypeScript:   countryRegion   (camelCase, Drizzle ORM converts automatically)
#   Filter param: countries       (plural, consistent with categories/sectors/etc.)

# Map internal opportunity types to DocFusion status
OPPORTUNITY_TYPE_TO_STATUS: dict[str, str] = {
	"rfp": "open",
	"rfq": "open",
	"rfi": "open",
	"eoi": "open",
	"tender": "open",
	"itb": "open",
	"ifb": "open",
	"gpn": "open",
	"spn": "open",
	"lta": "open",
	"framework": "open",
	"grant": "open",
	"awarded": "awarded",
	"cancelled": "cancelled",
	"closed": "closed",
}

# Map categories to DocFusion sectors
CATEGORY_TO_SECTOR: dict[str, str] = {
	"ERP/CRM Systems": "Technology",
	"Healthcare/HMIS": "Healthcare",
	"Financial/Fintech": "Finance",
	"E-Government": "Government",
	"Education/LMS": "Education",
	"Cybersecurity": "Technology",
	"AgriTech": "Agriculture",
	"GIS/Mapping": "Technology",
	"AI/Innovation": "Technology",
	"Digital Platform": "Technology",
	"Database/MIS": "Technology",
	"Custom Software": "Technology",
	"IT Infrastructure": "Technology",
	"IT Consultancy": "Consulting",
	"IT Training": "Education",
	"Other": "Other",
}


# ============================================================================
# Sync Result
# ============================================================================

@dataclass
class SyncResult:
	"""Result of a single sync operation."""
	opportunity_id: str
	source_id: str
	action: str  # "inserted", "updated", "skipped", "failed"
	error: str | None = None


@dataclass
class BatchSyncResult:
	"""Result of batch sync operation."""
	total: int = 0
	inserted: int = 0
	updated: int = 0
	skipped: int = 0
	failed: int = 0
	errors: list[str] = field(default_factory=list)
	results: list[SyncResult] = field(default_factory=list)
	duration_seconds: float = 0.0


# ============================================================================
# DocFusion Sync
# ============================================================================

class DocFusionSync:
	"""
	Synchronizes scraped opportunities to DocFusion database.

	Supports multiple sync modes:
		1. Direct PostgreSQL (if DATABASE_URL available)
		2. JSON export (for manual import)
		3. API integration (future)

	Usage:
		sync = DocFusionSync()
		result = await sync.sync_batch(opportunities)
		print(f"Inserted: {result.inserted}, Updated: {result.updated}")
	"""

	def __init__(
		self,
		database_url: str | None = None,
		export_dir: str | Path | None = None,
		dry_run: bool = False,
	) -> None:
		"""
		Initialize sync handler.

		Args:
			database_url: PostgreSQL connection string (from DATABASE_URL env)
			export_dir: Directory for JSON exports (if not using direct DB)
			dry_run: If True, don't actually write data
		"""
		self.database_url = database_url or os.environ.get("DATABASE_URL")
		self.export_dir = Path(export_dir) if export_dir else Path("data/sync_exports")
		self.dry_run = dry_run

		self._db_available = False
		self._pool = None

		# Check database availability
		if self.database_url:
			try:
				import asyncpg
				self._db_available = True
			except ImportError:
				logger.warning("asyncpg not installed - using JSON export mode")

		# Ensure export directory exists
		if not self._db_available:
			self.export_dir.mkdir(parents=True, exist_ok=True)

	async def connect(self) -> None:
		"""Establish database connection pool."""
		if not self._db_available or not self.database_url:
			return

		import asyncpg
		self._pool = await asyncpg.create_pool(
			self.database_url,
			min_size=2,
			max_size=10,
		)
		logger.info("Connected to DocFusion database")

	async def close(self) -> None:
		"""Close database connection pool."""
		if self._pool:
			await self._pool.close()
			logger.info("Closed database connection")

	async def __aenter__(self) -> "DocFusionSync":
		await self.connect()
		return self

	async def __aexit__(self, *args) -> None:
		await self.close()

	def transform_opportunity(
		self,
		opp: ScrapedOpportunity,
	) -> dict[str, Any]:
		"""
		Transform ScrapedOpportunity to DocFusion database format.

		Maps to the opportunities table schema defined in:
		frontend/lib/db/schema.ts

		Args:
			opp: Scraped opportunity

		Returns:
			Dictionary matching DocFusion opportunities table schema
		"""
		# Generate UUID if not present
		doc_id = str(uuid4())

		# Map opportunity type to status
		opp_type = opp.opportunity_type.value if opp.opportunity_type else "tender"
		status = OPPORTUNITY_TYPE_TO_STATUS.get(opp_type.lower(), "open")

		# Map category to sector
		sector = CATEGORY_TO_SECTOR.get(opp.category, "Technology") if opp.category else "Technology"

		# Build DocFusion record
		record = {
			"id": doc_id,
			"title": opp.title[:500] if opp.title else "",
			"project_summary": opp.description[:5000] if opp.description else None,
			"status": status,
			"deadline": opp.deadline.isoformat() if opp.deadline else None,
			"published_date": opp.published_date.isoformat() if opp.published_date else None,

			# Organization/Source
			"organization": opp.organization[:255] if opp.organization else None,
			"country_region": opp.country[:100] if opp.country else None,
			"funder": opp.funder[:255] if opp.funder else None,

			# Classification
			"category": opp.category,
			"sector": sector,
			"opportunity_type": opp_type,

			# Financial
			"budget_value": opp.budget_value[:100] if opp.budget_value else None,
			"budget_min": opp.budget_numeric if opp.budget_numeric else None,
			"budget_max": opp.budget_numeric if opp.budget_numeric else None,
			"currency": opp.budget_currency or "USD",

			# References
			"reference_number": opp.reference[:100] if opp.reference else None,
			"notice_id": opp.notice_id[:100] if opp.notice_id else None,
			"source": opp.source,
			"source_id": opp.source_id,

			# URLs
			"portal_url": opp.portal_url[:1000] if opp.portal_url else None,
			"document_url": opp.document_url[:1000] if opp.document_url else None,

			# Metadata
			"scraped_at": opp.scraped_at.isoformat() if opp.scraped_at else datetime.now(timezone.utc).isoformat(),
			"fingerprint": opp.fingerprint,
			"raw_data": json.dumps(opp.raw_data) if opp.raw_data else None,

			# Timestamps
			"created_at": datetime.now(timezone.utc).isoformat(),
			"updated_at": datetime.now(timezone.utc).isoformat(),
		}

		return record

	async def sync_opportunity(
		self,
		opp: ScrapedOpportunity,
	) -> SyncResult:
		"""
		Sync a single opportunity to DocFusion.

		Args:
			opp: Opportunity to sync

		Returns:
			SyncResult with action and status
		"""
		record = self.transform_opportunity(opp)

		if self.dry_run:
			return SyncResult(
				opportunity_id=record["id"],
				source_id=opp.source_id,
				action="skipped",
				error="Dry run mode",
			)

		if self._pool:
			return await self._sync_to_database(record, opp)
		else:
			return self._sync_to_json(record, opp)

	async def _sync_to_database(
		self,
		record: dict[str, Any],
		opp: ScrapedOpportunity,
	) -> SyncResult:
		"""Sync record to PostgreSQL database."""
		async with self._pool.acquire() as conn:
			try:
				# Check if exists by fingerprint or source_id
				existing = await conn.fetchrow(
					"""
					SELECT id FROM opportunities
					WHERE fingerprint = $1 OR (source = $2 AND source_id = $3)
					""",
					record["fingerprint"],
					opp.source,
					opp.source_id,
				)

				if existing:
					# Update existing record
					await conn.execute(
						"""
						UPDATE opportunities SET
							title = $2,
							project_summary = $3,
							status = $4,
							deadline = $5,
							organization = $6,
							country_region = $7,
							category = $8,
							budget_value = $9,
							portal_url = $10,
							document_url = $11,
							updated_at = $12
						WHERE id = $1
						""",
						existing["id"],
						record["title"],
						record["project_summary"],
						record["status"],
						record["deadline"],
						record["organization"],
						record["country_region"],
						record["category"],
						record["budget_value"],
						record["portal_url"],
						record["document_url"],
						datetime.now(timezone.utc),
					)

					return SyncResult(
						opportunity_id=str(existing["id"]),
						source_id=opp.source_id,
						action="updated",
					)

				else:
					# Insert new record using dict-driven column/value mapping
					# to keep field ordering explicit and self-documenting
					insert_fields = {
						"id": record["id"],
						"title": record["title"],
						"project_summary": record["project_summary"],
						"status": record["status"],
						"deadline": record["deadline"],
						"published_date": record["published_date"],
						"organization": record["organization"],
						"country_region": record["country_region"],
						"funder": record["funder"],
						"category": record["category"],
						"sector": record["sector"],
						"opportunity_type": record["opportunity_type"],
						"budget_value": record["budget_value"],
						"budget_min": record["budget_min"],
						"budget_max": record["budget_max"],
						"currency": record["currency"],
						"reference_number": record["reference_number"],
						"notice_id": record["notice_id"],
						"source": record["source"],
						"source_id": record["source_id"],
						"portal_url": record["portal_url"],
						"document_url": record["document_url"],
						"scraped_at": record["scraped_at"],
						"fingerprint": record["fingerprint"],
						"created_at": record["created_at"],
						"updated_at": record["updated_at"],
					}

					columns = list(insert_fields.keys())
					placeholders = ", ".join(f"${i+1}" for i in range(len(columns)))
					column_names = ", ".join(columns)
					values = [insert_fields[col] for col in columns]

					query = f"INSERT INTO opportunities ({column_names}) VALUES ({placeholders})"
					await conn.execute(query, *values)

					return SyncResult(
						opportunity_id=record["id"],
						source_id=opp.source_id,
						action="inserted",
					)

			except Exception as e:
				logger.error(f"Database sync error: {e}")
				return SyncResult(
					opportunity_id=record["id"],
					source_id=opp.source_id,
					action="failed",
					error=str(e),
				)

	def _sync_to_json(
		self,
		record: dict[str, Any],
		opp: ScrapedOpportunity,
	) -> SyncResult:
		"""Export record to JSON file for manual import."""
		try:
			# Create source-specific export file
			export_file = self.export_dir / f"{opp.source}_{datetime.now(timezone.utc).strftime('%Y%m%d')}.jsonl"

			with open(export_file, "a") as f:
				f.write(json.dumps(record, default=str) + "\n")

			return SyncResult(
				opportunity_id=record["id"],
				source_id=opp.source_id,
				action="inserted",
			)

		except Exception as e:
			logger.error(f"JSON export error: {e}")
			return SyncResult(
				opportunity_id=record["id"],
				source_id=opp.source_id,
				action="failed",
				error=str(e),
			)

	async def sync_batch(
		self,
		opportunities: list[ScrapedOpportunity],
	) -> BatchSyncResult:
		"""
		Sync a batch of opportunities.

		Args:
			opportunities: List of opportunities to sync

		Returns:
			BatchSyncResult with statistics
		"""
		start_time = datetime.now(timezone.utc)
		result = BatchSyncResult(total=len(opportunities))

		for opp in opportunities:
			sync_result = await self.sync_opportunity(opp)
			result.results.append(sync_result)

			if sync_result.action == "inserted":
				result.inserted += 1
			elif sync_result.action == "updated":
				result.updated += 1
			elif sync_result.action == "skipped":
				result.skipped += 1
			elif sync_result.action == "failed":
				result.failed += 1
				if sync_result.error:
					result.errors.append(f"{sync_result.source_id}: {sync_result.error}")

		result.duration_seconds = (datetime.now(timezone.utc) - start_time).total_seconds()

		logger.info(
			f"Sync complete: {result.inserted} inserted, {result.updated} updated, "
			f"{result.skipped} skipped, {result.failed} failed in {result.duration_seconds:.2f}s"
		)

		return result

	def export_for_import(
		self,
		opportunities: list[ScrapedOpportunity],
		output_path: str | Path | None = None,
	) -> Path:
		"""
		Export opportunities as JSON for frontend import.

		Creates a file compatible with the existing import system at:
		frontend/lib/actions/import-opportunities.ts

		Args:
			opportunities: List of opportunities to export
			output_path: Output file path (default: auto-generated)

		Returns:
			Path to exported file
		"""
		if output_path:
			output = Path(output_path)
		else:
			timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
			output = self.export_dir / f"opportunities_export_{timestamp}.json"

		records = [self.transform_opportunity(opp) for opp in opportunities]

		# Write as JSON array (compatible with frontend import)
		with open(output, "w") as f:
			json.dump(records, f, indent=2, default=str)

		logger.info(f"Exported {len(records)} opportunities to {output}")

		return output

	def get_sync_stats(self) -> dict[str, Any]:
		"""
		Get sync statistics from database.

		Returns:
			Dictionary with counts by source, status, etc.
		"""
		if not self._pool:
			return {"error": "Database not connected"}

		# Would need async context - placeholder
		return {
			"total_synced": 0,
			"by_source": {},
			"by_status": {},
			"last_sync": None,
		}


# ============================================================================
# Convenience Functions
# ============================================================================

async def sync_opportunities(
	opportunities: list[ScrapedOpportunity],
	database_url: str | None = None,
	dry_run: bool = False,
) -> BatchSyncResult:
	"""
	Convenience function to sync opportunities.

	Args:
		opportunities: List of opportunities to sync
		database_url: Optional database URL (uses env if not provided)
		dry_run: If True, don't write data

	Returns:
		BatchSyncResult with statistics
	"""
	async with DocFusionSync(database_url=database_url, dry_run=dry_run) as sync:
		return await sync.sync_batch(opportunities)


def export_opportunities(
	opportunities: list[ScrapedOpportunity],
	output_path: str | Path,
) -> Path:
	"""
	Convenience function to export opportunities to JSON.

	Args:
		opportunities: List of opportunities to export
		output_path: Output file path

	Returns:
		Path to exported file
	"""
	sync = DocFusionSync()
	return sync.export_for_import(opportunities, output_path)


# ============================================================================
# Standalone execution
# ============================================================================

if __name__ == "__main__":
	import asyncio

	# Test sync
	sync = DocFusionSync(dry_run=True)

	test_opp = ScrapedOpportunity(
		source_id="TEST001",
		source="test_source",
		title="Supply of IT Equipment for Ministry of Education",
		organization="Ministry of Education",
		country="Kenya",
		deadline=date(2024, 3, 15),
		budget_value="USD 500,000",
		budget_numeric=500000.0,
		budget_currency="USD",
		category="IT Infrastructure",
	)

	# Test transformation
	record = sync.transform_opportunity(test_opp)

	print("DocFusion Record:")
	print("=" * 40)
	for key, value in record.items():
		if value is not None:
			print(f"{key}: {value}")

	# Test export
	export_path = sync.export_for_import([test_opp])
	print(f"\nExported to: {export_path}")
