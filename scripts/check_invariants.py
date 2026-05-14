#!/usr/bin/env python3
"""Pre-commit hook: enforce DocuFusion invariants on staged Python files."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

BANNED_PATTERNS = [
	(r"\bNotImplementedError\b", "Use PendingImplementationError from docfusion.core.errors"),
	(r"asyncio\.get_event_loop\(", "Use asyncio.get_running_loop() or asyncio.new_event_loop()"),
	(r"datetime\.utcnow\(", "Use datetime.now(timezone.utc)"),
	(r"os\.environ\.get\(", "Use SecretsManager instead"),
]

# Files grandfathered because they contain violations scheduled for removal in later phases.
# Do NOT add new files here; fix the violation instead.
ALLOWED_FILES = {
	# NotImplementedError stubs — Phase 3 (agent subsystem) and Phase 4 (document engine)
	"src/docfusion/agents/communication/channels.py",   # task-015
	"src/docfusion/agents/core/agent.py",               # task-014
	"src/docfusion/api/health/health_checks.py",        # task-025
	"src/docfusion/experimental/composition/interpreter.py",         # task-022
	"src/docfusion/document_engine/formatter/style_applier.py",  # task-024
	"src/docfusion/visualization/renderers/svg_renderer.py",     # task-023
	"src/docfusion/workflow/integration/agents_workflow_integration.py",  # task-016
	"src/docfusion/workflow/integration/nlp_workflow_integration.py",     # task-016
	"src/docfusion/workflow/integration/workflow_document_bridge.py",     # task-016
	# os.environ.get is allowed only in SecretsManager (centralized config reader)
	"src/docfusion/config/secrets.py",
	# The invariant checker and error class legitimately mention the banned name
	"src/docfusion/core/errors.py",
	"scripts/check_invariants.py",
}

MAX_SIZE_BYTES = 25 * 1024  # 25 KB


def _head_file_size(path: Path) -> int | None:
	"""Return file size at HEAD, or None if file is new."""
	result = subprocess.run(
		["git", "show", f"HEAD:{path}"],
		capture_output=True,
		text=True,
	)
	if result.returncode != 0:
		return None
	return len(result.stdout.encode("utf-8"))


def get_staged_diff(path: Path) -> str:
	result = subprocess.run(
		["git", "diff", "--cached", "-U0", "--", str(path)],
		capture_output=True,
		text=True,
	)
	return result.stdout


def check(paths: list[str]) -> int:
	errors: list[str] = []
	for p in paths:
		path = Path(p)
		if not path.exists() or path.suffix != ".py":
			continue
		rel = str(path)
		if rel in ALLOWED_FILES:
			continue

		# File size check: only fail if the file grew past the limit in this commit.
		# Existing oversized files are grandfathered until Phase 5 (task-031).
		size = path.stat().st_size
		if size > MAX_SIZE_BYTES:
			head_size = _head_file_size(path)
			if head_size is not None and head_size <= MAX_SIZE_BYTES:
				errors.append(
					f"{rel}: file size grew to {size} bytes (exceeds {MAX_SIZE_BYTES}); "
					f"was {head_size} bytes at HEAD"
				)

		# Only check staged diff for banned patterns, so existing violations
		# in unmodified files don't block commits.
		diff = get_staged_diff(path)
		if not diff:
			continue
		for pat, reason in BANNED_PATTERNS:
			for m in re.finditer(pat, diff):
				# Count lines in diff up to match
				line = diff[: m.start()].count("\n") + 1
				errors.append(f"{rel}:{line}: banned pattern '{m.group()}' — {reason}")

	if errors:
		print("DocuFusion invariants violated:", file=sys.stderr)
		for e in errors:
			print(f"  {e}", file=sys.stderr)
		return 1
	return 0


if __name__ == "__main__":
	sys.exit(check(sys.argv[1:]))
