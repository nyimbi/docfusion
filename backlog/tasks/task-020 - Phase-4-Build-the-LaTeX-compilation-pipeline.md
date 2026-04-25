---
id: TASK-020
title: 'Phase 4: Build the LaTeX compilation pipeline'
status: Done
assignee: []
created_date: ''
updated_date: '2026-04-22 23:38'
labels: []
dependencies: []
---

# task-020 - Phase 4: Build the LaTeX compilation pipeline

## Description (the why)

`src/docfusion/document_engine/git_latex_manager.py` references `pdflatex` / `xelatex` but never invokes them. Final PDF generation is the headline deliverable — we cannot ship without it. We build an async subprocess wrapper with timeout, two-pass run for cross-references, structured error parsing, and SHA256-keyed output caching.

## Acceptance Criteria (the what)

- [ ] New module `src/docfusion/document_engine/latex/compiler.py` with an async `LatexCompiler` class.
- [ ] `compile(tex_source)` invokes the engine in a temp dir, runs two passes, parses errors, returns PDF bytes.
- [ ] Timeout configurable via `SecretsManager.get_latex_timeout()` (default 120s).
- [ ] SHA256-keyed output cache: identical input returns cached PDF without re-compiling.
- [ ] `git_latex_manager.py` delegates compilation to `LatexCompiler`.
- [ ] Test `tests/ci/test_latex_compiler.py` compiles a known-good document to PDF in under 15 seconds.
- [ ] Test confirms malformed .tex returns errors instead of crashing.

## Implementation Plan (the how)

**Step 1: Add SecretsManager getters** (mirror task-007 pattern):

```python
def get_latex_engine(self) -> str:
	return self._get_env("LATEX_ENGINE", default="pdflatex")

def get_latex_timeout(self) -> int:
	return int(self._get_env("LATEX_TIMEOUT", default="120"))

def get_latex_cache_dir(self) -> str:
	return self._get_env("LATEX_CACHE_DIR", default="/tmp/docfusion-latex-cache")
```

**Step 2: Create `src/docfusion/document_engine/latex/__init__.py`** (empty).

**Step 3: Create `src/docfusion/document_engine/latex/compiler.py`.** Use async subprocess (not shell), which avoids the command-injection class of bug entirely:

```python
"""Async LaTeX compilation with two-pass cross-reference resolution."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path

from docfusion.config.secrets import SecretsManager

logger = logging.getLogger(__name__)

@dataclass
class LatexError:
	line: int | None
	message: str
	kind: str

@dataclass
class CompileResult:
	success: bool
	pdf_bytes: bytes | None
	log: str
	errors: list[LatexError]
	cache_hit: bool = False

class LatexCompilationError(Exception):
	"""Raised on timeout or unrecoverable compilation failure."""

class LatexCompiler:
	"""Invoke the configured LaTeX engine against a .tex source string."""

	def __init__(
		self,
		*,
		engine: str | None = None,
		timeout_seconds: int | None = None,
		cache_dir: Path | None = None,
	) -> None:
		secrets = SecretsManager()
		self._engine = engine or secrets.get_latex_engine()
		self._timeout = timeout_seconds or secrets.get_latex_timeout()
		self._cache_dir = Path(cache_dir or secrets.get_latex_cache_dir())
		self._cache_dir.mkdir(parents=True, exist_ok=True)

	async def compile(self, tex_source: str) -> CompileResult:
		assert isinstance(tex_source, str) and tex_source, "tex_source must be non-empty"

		cache_key = hashlib.sha256(tex_source.encode("utf-8")).hexdigest()
		cached_pdf = self._cache_dir / f"{cache_key}.pdf"
		if cached_pdf.exists():
			return CompileResult(
				success=True,
				pdf_bytes=cached_pdf.read_bytes(),
				log="(from cache)",
				errors=[],
				cache_hit=True,
			)

		with tempfile.TemporaryDirectory() as tmp:
			workdir = Path(tmp)
			tex_file = workdir / "document.tex"
			tex_file.write_text(tex_source, encoding="utf-8")

			log = ""
			for pass_num in (1, 2):
				returncode, pass_log = await self._run_engine(tex_file, workdir)
				log += f"\n=== Pass {pass_num} ===\n{pass_log}"
				if returncode != 0 and pass_num == 2:
					errors = self._parse_errors(pass_log)
					return CompileResult(success=False, pdf_bytes=None, log=log, errors=errors)

			pdf_path = workdir / "document.pdf"
			if not pdf_path.exists():
				return CompileResult(
					success=False,
					pdf_bytes=None,
					log=log,
					errors=self._parse_errors(log),
				)

			pdf_bytes = pdf_path.read_bytes()
			cached_pdf.write_bytes(pdf_bytes)
			return CompileResult(
				success=True,
				pdf_bytes=pdf_bytes,
				log=log,
				errors=self._parse_errors(log, include_warnings=True),
			)

	async def _run_engine(self, tex_file: Path, workdir: Path) -> tuple[int, str]:
		cmd = [
			self._engine,
			"-interaction=nonstopmode",
			"-halt-on-error",
			"-output-directory", str(workdir),
			str(tex_file),
		]
		process = await asyncio.create_subprocess_exec(
			*cmd,
			stdout=asyncio.subprocess.PIPE,
			stderr=asyncio.subprocess.PIPE,
			cwd=str(workdir),
		)
		try:
			stdout, stderr = await asyncio.wait_for(
				process.communicate(),
				timeout=self._timeout,
			)
		except asyncio.TimeoutError:
			process.kill()
			await process.wait()
			raise LatexCompilationError(f"LaTeX compile timed out after {self._timeout}s")

		log = (stdout or b"").decode("utf-8", errors="replace")
		log += (stderr or b"").decode("utf-8", errors="replace")
		log_file = workdir / "document.log"
		if log_file.exists():
			log += "\n" + log_file.read_text(encoding="utf-8", errors="replace")
		return process.returncode or 0, log

	def _parse_errors(self, log: str, include_warnings: bool = False) -> list[LatexError]:
		errors: list[LatexError] = []
		for m in re.finditer(r"^! (.+?)(?:\r?\n)l\.(\d+)", log, re.MULTILINE):
			errors.append(LatexError(
				line=int(m.group(2)),
				message=m.group(1),
				kind="error",
			))
		if include_warnings:
			for m in re.finditer(r"^LaTeX Warning: (.+)", log, re.MULTILINE):
				errors.append(LatexError(line=None, message=m.group(1), kind="warning"))
		return errors
```

**Security note for the implementer:** This compiler uses `asyncio.create_subprocess_exec` (not `subprocess.Popen(..., shell=True)` and not `os.system`). Arguments are passed as a list — no shell interpolation, no command injection. Do NOT switch to a shell-based invocation.

**Step 4: Wire into `git_latex_manager.py`.** Find every inline reference to `pdflatex` / `xelatex` and replace with:

```python
from docfusion.document_engine.latex.compiler import LatexCompiler

compiler = LatexCompiler()
result = await compiler.compile(tex_source)
if not result.success:
	raise RuntimeError(f"LaTeX compile failed: {[e.message for e in result.errors]}")
pdf_bytes = result.pdf_bytes
```

**Step 5: Test.**

```python
# tests/ci/test_latex_compiler.py
"""LaTeX compilation coverage."""

import shutil
import pytest

from docfusion.document_engine.latex.compiler import LatexCompiler

GOOD_TEX = r"""
\documentclass{article}
\begin{document}
Hello, DocuFusion!
\section{Introduction}
This is a test document.
\end{document}
"""

BAD_TEX = r"""
\documentclass{article}
\begin{document}
\unknowncommand{oops}
\end{document}
"""

@pytest.fixture
def skip_if_no_latex():
	if shutil.which("pdflatex") is None:
		pytest.skip("pdflatex not installed")

async def test_compiles_valid_tex(skip_if_no_latex, tmp_path):
	compiler = LatexCompiler(cache_dir=tmp_path)
	result = await compiler.compile(GOOD_TEX)
	assert result.success
	assert result.pdf_bytes is not None
	assert result.pdf_bytes.startswith(b"%PDF")

async def test_cache_hit_on_second_call(skip_if_no_latex, tmp_path):
	compiler = LatexCompiler(cache_dir=tmp_path)
	first = await compiler.compile(GOOD_TEX)
	second = await compiler.compile(GOOD_TEX)
	assert second.cache_hit is True
	assert second.pdf_bytes == first.pdf_bytes

async def test_invalid_tex_returns_errors(skip_if_no_latex, tmp_path):
	compiler = LatexCompiler(cache_dir=tmp_path)
	result = await compiler.compile(BAD_TEX)
	assert result.success is False
	assert len(result.errors) > 0
```

**Step 6: Verify + commit.**
```bash
uv run pytest tests/ci/test_latex_compiler.py -vxs

git add src/docfusion/document_engine/latex/ src/docfusion/document_engine/git_latex_manager.py src/docfusion/config/secrets.py tests/ci/test_latex_compiler.py
git commit -m "feat(document_engine): real LaTeX compilation pipeline [G-DOC-01]"
```

## Notes for less-capable agents

- `pdflatex` must be on PATH. If CI doesn't have TeX Live, the test skips — open a follow-up task to install it.
- Do NOT cache failed compiles. Cache only successes.
- Do NOT use `subprocess.run` with `shell=True`. Argument-list exec is the safe pattern.
- If a document uses `\bibliography{}`, two passes won't be enough (needs biber). Document the limitation; don't try to support it in this task.

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
LaTeX compiler with two-pass, caching, error parsing; 6 tests passing
<!-- SECTION:NOTES:END -->
