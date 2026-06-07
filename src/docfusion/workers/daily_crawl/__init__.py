"""Daily opportunity crawl worker — run via `python -m docfusion.workers.daily_crawl`."""
from .runner import main, run_crawl

__all__ = ["main", "run_crawl"]
