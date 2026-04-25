"""
Agent Memory TTL Cleanup Job

Scheduled job to purge expired agent memory entries.
Can be invoked via cron, systemd timer, or Airflow DAG.
"""

import asyncio
import logging
import sys
from datetime import timezone, datetime

from .persistent_store import PersistentMemoryStore

logger = logging.getLogger(__name__)


async def run_cleanup(dsn: str | None = None) -> int:
	"""Execute expired-memory cleanup and return count deleted."""
	store = PersistentMemoryStore(connection_string=dsn)
	await store.initialize()
	try:
		count = await store.cleanup_expired()
		logger.info(
			"Agent memory cleanup complete at %s — %s entries purged",
			datetime.now(timezone.utc).isoformat(),
			count,
		)
		return count
	finally:
		await store.close()


def main() -> None:
	logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
	dsn = sys.argv[1] if len(sys.argv) > 1 else None
	count = asyncio.run(run_cleanup(dsn))
	print(f"Purged {count} expired agent memories")


if __name__ == "__main__":
	main()
