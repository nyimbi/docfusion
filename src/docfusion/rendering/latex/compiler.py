"""Async LaTeX compiler wrapper for file-based rendering."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from pathlib import Path
import re
import shutil


@dataclass(frozen=True)
class CompileResult:
	"""Structured result from a LaTeX compilation attempt."""

	pdf_path: Path | None
	success: bool
	errors: list[str] = field(default_factory=list)
	warnings: list[str] = field(default_factory=list)
	pages: int | None = None


class LaTeXCompiler:
	"""Compile a ``.tex`` file with an async, shell-free LaTeX subprocess."""

	async def compile(
		self,
		tex_file: Path,
		output_dir: Path,
		engine: str = "xelatex",
	) -> CompileResult:
		"""Compile ``tex_file`` into ``output_dir`` with two LaTeX passes."""
		tex_file = Path(tex_file)
		output_dir = Path(output_dir)
		output_dir.mkdir(parents=True, exist_ok=True)

		if shutil.which(engine) is None:
			return CompileResult(
				pdf_path=None,
				success=False,
				errors=[f"{engine} not found — install texlive-xetex"],
			)

		last_returncode = 0
		for _pass_number in range(2):
			last_returncode = await self._run_engine(tex_file, output_dir, engine)

		log_text = self._read_log(tex_file, output_dir)
		errors, warnings = self._parse_log(log_text)
		pdf_path = output_dir / f"{tex_file.stem}.pdf"
		success = last_returncode == 0 and pdf_path.exists() and not errors
		return CompileResult(
			pdf_path=pdf_path if pdf_path.exists() else None,
			success=success,
			errors=errors,
			warnings=warnings,
			pages=self._parse_pages(log_text),
		)

	async def _run_engine(self, tex_file: Path, output_dir: Path, engine: str) -> int:
		process = await asyncio.create_subprocess_exec(
			engine,
			"-interaction=nonstopmode",
			f"-output-directory={output_dir}",
			str(tex_file),
			stdout=asyncio.subprocess.PIPE,
			stderr=asyncio.subprocess.PIPE,
		)
		await process.communicate()
		return process.returncode or 0

	def _read_log(self, tex_file: Path, output_dir: Path) -> str:
		log_file = output_dir / f"{tex_file.stem}.log"
		if not log_file.exists():
			return ""
		return log_file.read_text(encoding="utf-8", errors="replace")

	def _parse_log(self, log_text: str) -> tuple[list[str], list[str]]:
		errors: list[str] = []
		warnings: list[str] = []
		for raw_line in log_text.splitlines():
			line = raw_line.strip()
			if not line:
				continue
			if line.startswith("!") or "ERROR" in line:
				errors.append(line)
			elif "Warning" in line:
				warnings.append(line)
		return errors, warnings

	def _parse_pages(self, log_text: str) -> int | None:
		match = re.search(r"Output written on .+ \((\d+) pages?", log_text)
		return int(match.group(1)) if match else None
