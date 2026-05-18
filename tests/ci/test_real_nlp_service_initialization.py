"""Regression tests for real NLP service startup behavior."""

import pytest

from docfusion.document_engine.assembler import content_assembler


def test_real_nlp_service_preserves_startup_error(monkeypatch: pytest.MonkeyPatch) -> None:
	"""Initialization should re-raise the real startup failure."""
	startup_error = RuntimeError("nlp backend unavailable")

	monkeypatch.setattr(content_assembler, "HAS_REAL_NLP", True)
	monkeypatch.setattr(
		content_assembler,
		"NLPServiceConfiguration",
		lambda: object(),
		raising=False,
	)

	def fail_to_create_nlp_service(config: object) -> None:
		del config
		raise startup_error

	monkeypatch.setattr(
		content_assembler,
		"create_nlp_service",
		fail_to_create_nlp_service,
		raising=False,
	)

	with pytest.raises(RuntimeError, match="nlp backend unavailable") as exc_info:
		content_assembler.RealNLPService()

	assert exc_info.value is startup_error
