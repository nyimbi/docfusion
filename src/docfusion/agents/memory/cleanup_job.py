"""Agent memory TTL cleanup — deletes entries older than MEMORY_TTL_DAYS (default 30). Designed to run as a systemd oneshot service at 03:00 UTC daily."""

from __future__ import annotations

import asyncio
import logging
import os

from sqlalchemy import text

from ...core.database.session import get_database_session

MEMORY_TTL_DAYS = int(os.environ.get('MEMORY_TTL_DAYS', '30'))

if MEMORY_TTL_DAYS < 1:
	raise ValueError("MEMORY_TTL_DAYS must be a positive integer")

logger = logging.getLogger(__name__)

_DELETE_EXPIRED_MEMORY_SQL = text(
	f"""
	DELETE FROM agent_memories
	WHERE expires_at IS NOT NULL
	  AND expires_at < NOW() - INTERVAL '{MEMORY_TTL_DAYS} days'
	"""
)


async def run_cleanup() -> int:
	"""Delete expired agent memory entries outside the configured retention window."""
	try:
		session_manager = await get_database_session()
		async with session_manager.async_session() as session:
			result = await session.execute(_DELETE_EXPIRED_MEMORY_SQL)
			rowcount = getattr(result, "rowcount", None)
			deleted_count = int(rowcount) if rowcount is not None and rowcount >= 0 else 0
	except Exception as exc:
		logger.exception(
			"Failed to delete expired agent memory entries (TTL=%sd)",
			MEMORY_TTL_DAYS,
		)
		raise RuntimeError("Agent memory TTL cleanup failed") from exc

	logger.info(
		"Deleted %s expired agent memory entries (TTL=%sd)",
		deleted_count,
		MEMORY_TTL_DAYS,
	)
	return deleted_count


if __name__ == "__main__":
	logging.basicConfig(
		level=logging.INFO,
		format="%(asctime)s %(levelname)s %(name)s: %(message)s",
	)
	count = asyncio.run(run_cleanup())
	print(f"Deleted {count} expired agent memory entries (TTL={MEMORY_TTL_DAYS}d)")
