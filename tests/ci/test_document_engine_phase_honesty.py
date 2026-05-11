"""
Tests for the DocumentEngine phase orchestration honesty pass (B.fix.1+2+3).

The pre-pass behaviour was: every phase fallback masqueraded as a
successful run with a hardcoded quality score (0.75/0.87), and the
BrandFormatter happy-path explicitly rewrote real failures as
``formatting_successful=True``. Quality validation then averaged those
constants into ``overall_quality_score``, giving callers a fictional
confidence signal.

These tests pin the post-pass behaviour:

- Phase 2/3/4 fallbacks set ``*_successful=False`` and emit no quality
  score; the orchestrator no longer writes hardcoded constants on the
  happy path.
- CrossReferenceManager's real ``graph.validation_score`` is preserved.
- BrandFormatter failures propagate instead of being silently rewritten.
- Quality validation skips ``None`` scores and skips scores from failed
  phases, and emits a ``Degraded phases:`` warning naming every phase
  that fell back.
"""

from __future__ import annotations

import logging
from types import SimpleNamespace
from typing import Any

import pytest

from docfusion.document_engine.document_engine import (
	DocumentEngine,
	DocumentGenerationConfiguration,
	DocumentGenerationRequest,
	DocumentGenerationResult,
)
from docfusion.document_engine.formatter.brand_formatter import BrandFormattingResult
from docfusion.document_engine.formatter.document_formatter import FormattingResult


# ---------------------------------------------------------------------------
# Engine harness — bypass full construction; the phase methods only touch
# self.logger and self.<phase_component>, so a hollow DocumentEngine is
# enough.
# ---------------------------------------------------------------------------


def _make_engine(**components: Any) -> DocumentEngine:
	engine = DocumentEngine.__new__(DocumentEngine)
	engine.logger = logging.getLogger("test")
	for name, value in components.items():
		setattr(engine, name, value)
	return engine


def _make_request() -> DocumentGenerationRequest:
	return DocumentGenerationRequest(
		content_sources=[{"type": "text", "content": "Hello world."}],
		generation_config=DocumentGenerationConfiguration(
			document_type="proposal",
			document_title="Test",
		),
	)


# ---------------------------------------------------------------------------
# Phase 2 — Structure Building
# ---------------------------------------------------------------------------


class _StructureRaiser:
	async def create_document_structure(self, **_: Any) -> Any:
		raise RuntimeError("structure builder boom")


class _StructureSucceeder:
	async def create_document_structure(self, **_: Any) -> Any:
		return SimpleNamespace(sections=["s1", "s2", "s3"])


class TestStructureBuildingFallback:
	async def test_happy_path_omits_hardcoded_score(self):
		engine = _make_engine(structure_builder=_StructureSucceeder())
		result = await engine._execute_structure_building(_make_request(), None)
		assert result.build_successful is True
		# B.fix.2: orchestrator no longer fabricates 0.89; StructureBuilder
		# does not yet compute its own score so None is the honest signal.
		assert result.structure_quality_score is None
		assert result.section_count == 3

	async def test_fallback_reports_failure_and_no_score(self):
		engine = _make_engine(structure_builder=_StructureRaiser())
		result = await engine._execute_structure_building(_make_request(), None)
		assert result.build_successful is False
		assert result.structure_quality_score is None
		assert "boom" in result.failure_reason


# ---------------------------------------------------------------------------
# Phase 3 — Cross-Reference Management
# ---------------------------------------------------------------------------


class _CrossRefRaiser:
	async def build_reference_graph(self, **_: Any) -> Any:
		raise RuntimeError("cross-ref boom")


class _CrossRefSucceeder:
	def __init__(self, validation_score: float, total_references: int) -> None:
		self._validation_score = validation_score
		self._total_references = total_references

	async def build_reference_graph(self, **_: Any) -> Any:
		return SimpleNamespace(
			validation_score=self._validation_score,
			total_references=self._total_references,
		)


class TestCrossReferenceFallback:
	async def test_happy_path_preserves_real_validation_score(self):
		engine = _make_engine(cross_reference_manager=_CrossRefSucceeder(0.7, 4))
		result = await engine._execute_cross_reference_management(
			_make_request(), structure_result=None
		)
		assert result.processing_successful is True
		# B.fix.2: was hardcoded 1.0 — now the real graph score reaches
		# downstream consumers.
		assert result.resolution_success_rate == 0.7
		assert result.total_references == 4

	async def test_fallback_reports_failure_and_no_score(self):
		engine = _make_engine(cross_reference_manager=_CrossRefRaiser())
		result = await engine._execute_cross_reference_management(
			_make_request(), structure_result=None
		)
		assert result.processing_successful is False
		assert result.resolution_success_rate is None


# ---------------------------------------------------------------------------
# Phase 4 — Document Formatting
# ---------------------------------------------------------------------------


class _DocFormatterRaiser:
	async def format_document(self, **_: Any) -> FormattingResult:
		raise RuntimeError("formatter boom")


class _DocFormatterSucceeder:
	async def format_document(self, **_: Any) -> FormattingResult:
		fr = FormattingResult(document_id="r", success=True)
		fr.formatted_content = {"html": "<p>ok</p>"}
		return fr


class TestDocumentFormattingFallback:
	async def test_happy_path_omits_hardcoded_score(self):
		engine = _make_engine(document_formatter=_DocFormatterSucceeder())
		result = await engine._execute_document_formatting(_make_request(), None)
		assert getattr(result, "formatting_successful") is True
		# B.fix.2: was 0.85 — None signals "no measurement yet".
		assert getattr(result, "formatting_quality_score") is None

	async def test_fallback_marks_failure_and_carries_reason(self):
		engine = _make_engine(document_formatter=_DocFormatterRaiser())
		result = await engine._execute_document_formatting(_make_request(), None)
		assert result.success is False
		assert getattr(result, "formatting_successful") is False
		assert getattr(result, "formatting_quality_score") is None
		assert "boom" in getattr(result, "failure_reason", "")


# ---------------------------------------------------------------------------
# Phase 5 — Brand Formatting (the failure-masking case is B.fix.3)
# ---------------------------------------------------------------------------


class _BrandReturnsFailure:
	"""Real component returned without raising, but with formatting_successful=False."""

	async def apply_brand_formatting(self, **_: Any) -> BrandFormattingResult:
		return BrandFormattingResult(
			formatting_successful=False,
			document_id="r",
			brand_consistency_score=0.42,
		)


class _BrandRaiser:
	async def apply_brand_formatting(self, **_: Any) -> BrandFormattingResult:
		raise RuntimeError("brand boom")


class _BrandSucceeder:
	async def apply_brand_formatting(self, **_: Any) -> BrandFormattingResult:
		return BrandFormattingResult(
			formatting_successful=True,
			document_id="r",
			brand_consistency_score=0.91,
		)


class TestBrandFormattingPropagation:
	async def test_real_failure_is_propagated_not_masked(self):
		"""B.fix.3: was rewritten as ``formatting_successful=True, score=0.87``."""
		engine = _make_engine(brand_formatter=_BrandReturnsFailure())
		fr = FormattingResult(document_id="r", success=True)
		fr.formatted_content = {}
		result = await engine._execute_brand_formatting(_make_request(), fr)
		assert result.formatting_successful is False
		# The real score from the failing component is preserved — not
		# overwritten with a placeholder.
		assert result.brand_consistency_score == 0.42

	async def test_exception_fallback_marks_failure(self):
		engine = _make_engine(brand_formatter=_BrandRaiser())
		fr = FormattingResult(document_id="r", success=True)
		fr.formatted_content = {}
		result = await engine._execute_brand_formatting(_make_request(), fr)
		assert result.formatting_successful is False

	async def test_happy_path_preserves_real_score(self):
		engine = _make_engine(brand_formatter=_BrandSucceeder())
		fr = FormattingResult(document_id="r", success=True)
		fr.formatted_content = {}
		result = await engine._execute_brand_formatting(_make_request(), fr)
		assert result.formatting_successful is True
		assert result.brand_consistency_score == 0.91


# ---------------------------------------------------------------------------
# Phase 6 / 7 — Layout & Style fallbacks (real component data was already
# preserved on the happy path; we only need to pin the fallback honesty.)
# ---------------------------------------------------------------------------


class _LayoutRaiser:
	async def compute_document_layout(self, **_: Any) -> Any:
		raise RuntimeError("layout boom")


class _StyleRaiser:
	async def apply_brand_styles(self, **_: Any) -> Any:
		raise RuntimeError("style boom")


class TestLayoutAndStyleFallback:
	async def test_layout_fallback_marks_failure(self):
		engine = _make_engine(layout_manager=_LayoutRaiser())
		result = await engine._execute_layout_management(_make_request(), None)
		assert result.layout_successful is False
		assert result.layout_quality_score is None

	async def test_style_fallback_marks_failure(self):
		engine = _make_engine(style_applier=_StyleRaiser())
		fr = FormattingResult(document_id="r", success=True)
		result = await engine._execute_style_application(_make_request(), None, fr)
		assert result.application_successful is False
		assert result.style_quality_score is None


# ---------------------------------------------------------------------------
# Quality validation — the aggregator's new None-skipping and
# degraded-phase warning emission.
# ---------------------------------------------------------------------------


class TestQualityValidationAggregator:
	async def test_skips_none_scores_and_failed_phases(self):
		"""A mix of real scores, None scores, and failed phases averages
		only the real ones and surfaces degradation."""
		engine = _make_engine()
		request = _make_request()
		result = DocumentGenerationResult(request_id=request.request_id)

		# Successful phase with a real score (0.9 — contributes).
		result.structure_result = SimpleNamespace(
			build_successful=True, structure_quality_score=0.9,
		)
		# Successful phase but score not yet measured (None — skipped).
		result.cross_ref_result = SimpleNamespace(
			processing_successful=True, resolution_success_rate=None,
		)
		# Failed phase with a stale score (skipped + flagged).
		brand = BrandFormattingResult(
			formatting_successful=False, document_id="r", brand_consistency_score=0.42,
		)
		result.brand_result = brand
		# Failed phase with no score (skipped + flagged).
		result.layout_result = SimpleNamespace(
			layout_successful=False, layout_quality_score=None,
		)
		# Successful phase with a real score (0.8 — contributes).
		result.style_result = SimpleNamespace(
			application_successful=True, style_quality_score=0.8,
		)

		await engine._execute_quality_validation(request, result)

		# Only the two real successful scores averaged.
		assert result.overall_quality_score == pytest.approx((0.9 + 0.8) / 2)

		# Both failures named in the degraded-phases warning.
		degraded_warnings = [
			w for w in result.warnings if w.startswith("Degraded phases:")
		]
		assert len(degraded_warnings) == 1
		assert "brand_formatting" in degraded_warnings[0]
		assert "layout_management" in degraded_warnings[0]
		# Successful-but-unmeasured phases are NOT in the degraded list —
		# they didn't fail, they just didn't produce a score.
		assert "cross_reference_management" not in degraded_warnings[0]
		assert "structure_building" not in degraded_warnings[0]

	async def test_no_degraded_warning_when_all_phases_succeed(self):
		engine = _make_engine()
		request = _make_request()
		result = DocumentGenerationResult(request_id=request.request_id)
		result.structure_result = SimpleNamespace(
			build_successful=True, structure_quality_score=None,
		)
		result.layout_result = SimpleNamespace(
			layout_successful=True, layout_quality_score=0.85,
		)
		await engine._execute_quality_validation(request, result)
		assert not any(w.startswith("Degraded phases:") for w in result.warnings)
		assert result.overall_quality_score == pytest.approx(0.85)

	async def test_container_without_success_flag_is_skipped(self):
		"""A result shape that exposes none of the expected success flags
		is treated as unmeasured, not implicitly successful — guards
		against malformed test doubles or future result types poisoning
		the aggregate with placeholder scores."""
		engine = _make_engine()
		request = _make_request()
		result = DocumentGenerationResult(request_id=request.request_id)
		# This namespace has a quality score but NO build_successful or
		# any other known success flag. Pre-fix it would have contributed.
		result.structure_result = SimpleNamespace(structure_quality_score=0.95)
		# Genuine score that should be the only contributor.
		result.layout_result = SimpleNamespace(
			layout_successful=True, layout_quality_score=0.7,
		)
		await engine._execute_quality_validation(request, result)
		assert result.overall_quality_score == pytest.approx(0.7)

	async def test_all_phases_none_leaves_overall_zero(self):
		"""When every phase produces None, the aggregator has nothing to
		average; overall_quality_score stays at its dataclass default 0.0
		rather than fabricating a number."""
		engine = _make_engine()
		request = _make_request()
		result = DocumentGenerationResult(request_id=request.request_id)
		result.structure_result = SimpleNamespace(
			build_successful=True, structure_quality_score=None,
		)
		result.layout_result = SimpleNamespace(
			layout_successful=True, layout_quality_score=None,
		)
		await engine._execute_quality_validation(request, result)
		assert result.overall_quality_score == 0.0
