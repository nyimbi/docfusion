"""Tests for the Phase 4 LaTeX rendering pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pytest

from docfusion.rendering.latex.assembler import DocumentAssembler
from docfusion.rendering.latex.compiler import CompileResult, LaTeXCompiler
from docfusion.rendering.latex.service import LaTeXService, LaTeXServiceError


@dataclass
class Block:
	block_id: str
	content: str


class FakeProcess:
	def __init__(self, returncode: int = 0) -> None:
		self.returncode = returncode

	async def communicate(self) -> tuple[bytes, bytes]:
		return b"", b""


async def test_latex_compiler_runs_xelatex_twice(monkeypatch, tmp_path):
	tex_file = tmp_path / "master.tex"
	tex_file.write_text(r"\documentclass{article}\begin{document}ok\end{document}")
	calls: list[tuple[str, ...]] = []

	async def fake_create_subprocess_exec(*cmd: str, **_kwargs: object) -> FakeProcess:
		calls.append(cmd)
		output_arg = next(part for part in cmd if part.startswith("-output-directory="))
		output_dir = Path(output_arg.split("=", 1)[1])
		(output_dir / "master.pdf").write_bytes(b"%PDF-1.7\n")
		(output_dir / "master.log").write_text(
			"Output written on master.pdf (2 pages).\n"
			"LaTeX Warning: Reference `x' undefined.\n",
			encoding="utf-8",
		)
		return FakeProcess(returncode=0)

	monkeypatch.setattr("shutil.which", lambda _engine: "/usr/bin/xelatex")
	monkeypatch.setattr(
		"asyncio.create_subprocess_exec",
		fake_create_subprocess_exec,
	)

	result = await LaTeXCompiler().compile(tex_file, tmp_path)

	assert result.success is True
	assert result.pdf_path == tmp_path / "master.pdf"
	assert result.pages == 2
	assert result.warnings == ["LaTeX Warning: Reference `x' undefined."]
	assert len(calls) == 2
	assert calls[0][:2] == ("xelatex", "-interaction=nonstopmode")
	assert f"-output-directory={tmp_path}" in calls[0]
	assert str(tex_file) in calls[0]


async def test_latex_compiler_returns_log_errors(monkeypatch, tmp_path):
	tex_file = tmp_path / "broken.tex"
	tex_file.write_text(r"\bad")

	async def fake_create_subprocess_exec(*cmd: str, **_kwargs: object) -> FakeProcess:
		output_arg = next(part for part in cmd if part.startswith("-output-directory="))
		output_dir = Path(output_arg.split("=", 1)[1])
		(output_dir / "broken.log").write_text(
			"! Undefined control sequence.\n"
			"l.1 \\bad\n"
			"ERROR: LaTeX failed.\n",
			encoding="utf-8",
		)
		return FakeProcess(returncode=1)

	monkeypatch.setattr("shutil.which", lambda _engine: "/usr/bin/xelatex")
	monkeypatch.setattr(
		"asyncio.create_subprocess_exec",
		fake_create_subprocess_exec,
	)

	result = await LaTeXCompiler().compile(tex_file, tmp_path)

	assert result.success is False
	assert result.pdf_path is None
	assert result.errors == ["! Undefined control sequence.", "ERROR: LaTeX failed."]


async def test_latex_compiler_gracefully_handles_missing_xelatex(monkeypatch, tmp_path):
	tex_file = tmp_path / "master.tex"
	tex_file.write_text(r"\documentclass{article}\begin{document}ok\end{document}")
	monkeypatch.setattr("shutil.which", lambda _engine: None)

	result = await LaTeXCompiler().compile(tex_file, tmp_path)

	assert result.success is False
	assert result.errors == ["xelatex not found — install texlive-xetex"]


async def test_document_assembler_writes_blocks_and_master(tmp_path):
	template = tmp_path / "template.tex"
	template.write_text(
		r"\documentclass{article}\begin{document}% DOCFUSION_CONTENT\end{document}",
		encoding="utf-8",
	)
	pdf_path = tmp_path / "master.pdf"

	class FakeCompiler:
		async def compile(self, tex_file: Path, output_dir: Path) -> CompileResult:
			assert tex_file == output_dir / "master.tex"
			pdf_path.write_bytes(b"%PDF-1.7\n")
			return CompileResult(pdf_path=pdf_path, success=True, pages=1)

	assembler = DocumentAssembler(compiler=FakeCompiler())
	result_path = await assembler.assemble(
		[
			Block("intro", r"\section{Intro}"),
			Block("risk/plan", r"\section{Risk Plan}"),
		],
		template,
		tmp_path,
	)

	assert result_path == pdf_path
	assert (tmp_path / "blocks" / "intro.tex").read_text() == r"\section{Intro}"
	assert (tmp_path / "blocks" / "risk-plan.tex").read_text() == r"\section{Risk Plan}"
	assert r"\input{blocks/intro}" in (tmp_path / "master.tex").read_text()
	assert r"\input{blocks/risk-plan}" in (tmp_path / "master.tex").read_text()


async def test_latex_service_returns_pdf_bytes_and_cleans_success_workspace(tmp_path):
	class FakeAssembler:
		async def assemble(
			self,
			blocks: list[Block],
			template: Path,
			output_dir: Path,
		) -> Path:
			assert blocks == [Block("intro", "content")]
			assert template.exists()
			pdf_path = output_dir / "master.pdf"
			pdf_path.write_bytes(b"%PDF-service\n")
			return pdf_path

	service = LaTeXService(storage_root=tmp_path, assembler=FakeAssembler())

	pdf_bytes = await service.compile_document("rfp-123", [Block("intro", "content")])

	assert pdf_bytes == b"%PDF-service\n"
	assert service.last_workspace is not None
	assert not service.last_workspace.exists()


async def test_latex_service_preserves_failed_workspace(tmp_path):
	class FailingAssembler:
		async def assemble(
			self,
			blocks: list[Block],
			template: Path,
			output_dir: Path,
		) -> Path:
			(output_dir / "master.log").write_text("! failure", encoding="utf-8")
			raise RuntimeError("compile failed")

	service = LaTeXService(storage_root=tmp_path, assembler=FailingAssembler())

	with pytest.raises(LaTeXServiceError):
		await service.compile_document("rfp-123", [Block("intro", "content")])

	assert service.last_workspace is not None
	assert service.last_workspace.exists()
	assert (service.last_workspace / "master.log").exists()
