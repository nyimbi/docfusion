"""Assemble content blocks into a master LaTeX document."""

from __future__ import annotations

from pathlib import Path
import re
from typing import Any, Protocol

from .compiler import LaTeXCompiler


class ContentBlock(Protocol):
	"""Minimal block contract consumed by the LaTeX assembler."""

	block_id: str
	content: str


class DocumentAssembler:
	"""Write block files, build ``master.tex``, and compile it to PDF."""

	def __init__(self, compiler: LaTeXCompiler | None = None) -> None:
		self.compiler = compiler or LaTeXCompiler()

	async def assemble(
		self,
		blocks: list[ContentBlock],
		template: Path,
		output_dir: Path,
	) -> Path:
		"""Assemble ``blocks`` with ``template`` and return the compiled PDF path."""
		output_dir = Path(output_dir)
		blocks_dir = output_dir / "blocks"
		blocks_dir.mkdir(parents=True, exist_ok=True)

		input_lines: list[str] = []
		for block in blocks:
			block_id = self._safe_block_id(self._get_block_value(block, "block_id"))
			block_content = self._get_block_value(block, "content")
			(blocks_dir / f"{block_id}.tex").write_text(
				str(block_content),
				encoding="utf-8",
			)
			input_lines.append(rf"\input{{blocks/{block_id}}}")

		master_tex = output_dir / "master.tex"
		master_tex.write_text(
			self._render_template(Path(template), "\n".join(input_lines)),
			encoding="utf-8",
		)

		result = await self.compiler.compile(master_tex, output_dir)
		if not result.success or result.pdf_path is None:
			error_text = "; ".join(result.errors) or "unknown LaTeX compilation error"
			raise RuntimeError(f"LaTeX compilation failed: {error_text}")
		return result.pdf_path

	def _render_template(self, template: Path, content: str) -> str:
		template_text = template.read_text(encoding="utf-8")
		for marker in ("{{ content }}", "{{content}}", "% DOCFUSION_CONTENT"):
			if marker in template_text:
				return template_text.replace(marker, content)
		if r"\end{document}" in template_text:
			return template_text.replace(r"\end{document}", f"{content}\n\\end{{document}}")
		return f"{template_text}\n{content}\n"

	def _get_block_value(self, block: ContentBlock, key: str) -> Any:
		if isinstance(block, dict):
			return block[key]
		return getattr(block, key)

	def _safe_block_id(self, block_id: Any) -> str:
		safe_id = re.sub(r"[^A-Za-z0-9_.-]+", "-", str(block_id)).strip(".-")
		if not safe_id:
			raise ValueError("block_id must contain at least one safe filename character")
		return safe_id
