"""FastAPI-injectable LaTeX rendering service."""

from __future__ import annotations

from pathlib import Path
import shutil
import tempfile

from .assembler import ContentBlock, DocumentAssembler


class LaTeXServiceError(RuntimeError):
	"""Raised when PDF generation fails and the workspace is preserved."""


class LaTeXService:
	"""Compile content blocks into PDF bytes in a storage-backed workspace."""

	def __init__(
		self,
		storage_root: Path | str = "storage",
		assembler: DocumentAssembler | None = None,
		template: Path | None = None,
	) -> None:
		self.storage_root = Path(storage_root)
		self.assembler = assembler or DocumentAssembler()
		self.template = template or Path(__file__).parent / "templates" / "proposal_base.tex"
		self.last_workspace: Path | None = None

	async def compile_document(self, rfp_id: str, blocks: list[ContentBlock]) -> bytes:
		"""Compile ``blocks`` for ``rfp_id`` and return PDF bytes."""
		workspace_root = self.storage_root / "latex"
		workspace_root.mkdir(parents=True, exist_ok=True)
		workspace = Path(
			tempfile.mkdtemp(
				prefix=f"{self._safe_workspace_prefix(rfp_id)}-",
				dir=workspace_root,
			)
		)
		self.last_workspace = workspace

		try:
			pdf_path = await self.assembler.assemble(blocks, self.template, workspace)
			pdf_bytes = pdf_path.read_bytes()
		except Exception as exc:
			raise LaTeXServiceError(
				f"LaTeX compilation failed; workspace preserved at {workspace}",
			) from exc

		shutil.rmtree(workspace)
		return pdf_bytes

	def _safe_workspace_prefix(self, rfp_id: str) -> str:
		return "".join(
			char if char.isalnum() or char in "._-" else "-"
			for char in rfp_id
		).strip(".-") or "rfp"
