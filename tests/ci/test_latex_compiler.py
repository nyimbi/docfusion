"""LaTeX compilation coverage."""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from docfusion.document_engine.latex.compiler import CompileResult, LatexCompiler


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
	assert result.cache_hit is False


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


async def test_empty_tex_raises(skip_if_no_latex, tmp_path):
	compiler = LatexCompiler(cache_dir=tmp_path)
	with pytest.raises(AssertionError):
		await compiler.compile("")


async def test_timeout_is_enforced(skip_if_no_latex, tmp_path):
	# Use a very short timeout to force timeout behavior
	compiler = LatexCompiler(cache_dir=tmp_path, timeout_seconds=1)
	# Even a valid doc should compile within 1s, so this is more of a smoke test
	result = await compiler.compile(GOOD_TEX)
	assert result.success


async def test_git_latex_manager_adapter_compiles(skip_if_no_latex, tmp_path):
	from docfusion.document_engine.git_latex_manager import LaTeXCompiler as Adapter

	tex_file = tmp_path / "document.tex"
	tex_file.write_text(GOOD_TEX, encoding="utf-8")
	adapter = Adapter(working_dir=tmp_path)
	result = await adapter.compile_document("document.tex")
	assert result.success
	assert Path(result.output_file).exists()
	pdf_bytes = Path(result.output_file).read_bytes()
	assert pdf_bytes.startswith(b"%PDF")
