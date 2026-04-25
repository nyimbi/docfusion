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
			logger.debug("LaTeX cache hit for key %s", cache_key[:16])
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
		logger.debug("Running LaTeX command: %s", " ".join(cmd))
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
