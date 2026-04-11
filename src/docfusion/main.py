from pathlib import Path
import logging
logger = logging.getLogger(__name__)
from typing import Optional

def main() -> None:
    """Main entry point for proposal_writer."""
    logger.info(f"Hello from docfusion!")
    logger.info(f"Built with modern Python tooling: uv, ruff, mypy, pytest")

if __name__ == "__main__":
    main()
