"""Structured logging setup for DocuFusion processes."""

from __future__ import annotations

import logging
import os
import sys
from typing import Any

import structlog


def setup_logging(level: str | int | None = None) -> None:
	"""Configure stdlib logging and structlog to emit JSON lines."""
	log_level = level or os.getenv("LOG_LEVEL", "INFO")
	if isinstance(log_level, str):
		log_level = getattr(logging, log_level.upper(), logging.INFO)

	shared_processors: list[Any] = [
		structlog.contextvars.merge_contextvars,
		structlog.stdlib.add_logger_name,
		structlog.stdlib.add_log_level,
		structlog.processors.TimeStamper(fmt="iso", utc=True),
		structlog.processors.StackInfoRenderer(),
		structlog.processors.format_exc_info,
	]

	formatter = structlog.stdlib.ProcessorFormatter(
		processor=structlog.processors.JSONRenderer(),
		foreign_pre_chain=shared_processors,
	)
	handler = logging.StreamHandler(sys.stdout)
	handler.setFormatter(formatter)

	root_logger = logging.getLogger()
	root_logger.handlers.clear()
	root_logger.addHandler(handler)
	root_logger.setLevel(log_level)

	structlog.configure(
		processors=[
			*shared_processors,
			structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
		],
		logger_factory=structlog.stdlib.LoggerFactory(),
		wrapper_class=structlog.stdlib.BoundLogger,
		cache_logger_on_first_use=True,
	)
