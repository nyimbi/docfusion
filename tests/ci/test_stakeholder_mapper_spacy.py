"""Regression test for the spaCy import bug surfaced by the W3 audit.

The previous code did `from spacy.matcher import PhraseMatch` (singular),
which silently failed and dropped HAS_SPACY_SUPPORT to False even when
spaCy was installed. spaCy was therefore never used. The fix restores
the correct symbol name (`PhraseMatcher`)."""

import importlib.util

import pytest


def test_spacy_phrase_matcher_imports_cleanly():
	if importlib.util.find_spec("spacy") is None:
		pytest.skip("spaCy not installed in this environment")

	from docfusion.rfp import stakeholder_mapper

	assert stakeholder_mapper.HAS_SPACY_SUPPORT is True, (
		"PhraseMatcher import must succeed when spaCy is installed; "
		"if this fails the silent-capability-regression has returned."
	)
