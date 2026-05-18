"""Command-line entrypoint for DocFusion."""

from __future__ import annotations

import argparse
from typing import TYPE_CHECKING

import uvicorn

from docfusion import __version__

if TYPE_CHECKING:
	from collections.abc import Sequence

API_APP_FACTORY = "docfusion.api.app:create_app"


def build_parser() -> argparse.ArgumentParser:
	"""Build the DocFusion command-line parser."""
	parser = argparse.ArgumentParser(
		prog="docfusion",
		description="DocFusion document intelligence platform",
	)
	parser.add_argument(
		"--version",
		action="store_true",
		help="print the installed DocFusion version and exit",
	)

	subparsers = parser.add_subparsers(dest="command")
	api_parser = subparsers.add_parser("api", help="run the FastAPI service")
	api_parser.add_argument(
		"--host",
		default="127.0.0.1",
		help="interface to bind the API server to",
	)
	api_parser.add_argument(
		"--port",
		type=int,
		default=8000,
		help="port to bind the API server to",
	)
	api_parser.add_argument(
		"--reload",
		action="store_true",
		help="enable uvicorn reload mode for local development",
	)

	return parser


def main(argv: Sequence[str] | None = None) -> int:
	"""Run the DocFusion command-line interface."""
	parser = build_parser()
	args = parser.parse_args(argv)

	if args.version:
		print(f"docfusion {__version__}")
		return 0

	if args.command == "api":
		uvicorn.run(
			API_APP_FACTORY,
			factory=True,
			host=args.host,
			port=args.port,
			reload=args.reload,
		)
		return 0

	parser.print_help()
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
