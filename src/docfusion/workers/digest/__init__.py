"""Opportunity digest mailer — run via `python -m docfusion.workers.digest`."""
from .runner import main, run_digest

__all__ = ["main", "run_digest"]
