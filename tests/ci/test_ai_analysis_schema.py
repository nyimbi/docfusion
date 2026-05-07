import pytest
from pydantic import ValidationError

from docfusion.rfp.ai_analysis import AiAnalysisV1, parse_ai_analysis


def test_v1_round_trips():
	payload = {
		"version": "1",
		"summary": "ten mandatory requirements",
		"riskFactors": ["unfunded scope"],
		"suggestedApproach": "address Section L first",
		"ambiguityFlags": [{"requirementId": "r1", "reason": "no metric"}],
		"extractedAt": "2026-05-08T00:00:00+00:00",
	}
	parsed = parse_ai_analysis(payload)
	assert isinstance(parsed, AiAnalysisV1)
	assert parsed.version == "1"
	assert parsed.summary == "ten mandatory requirements"


def test_none_returns_none():
	assert parse_ai_analysis(None) is None


def test_missing_version_rejected():
	with pytest.raises(ValidationError):
		parse_ai_analysis({"summary": "..."})


def test_unknown_version_rejected():
	with pytest.raises(ValidationError):
		parse_ai_analysis({"version": "99", "summary": "..."})


def test_extra_fields_rejected():
	with pytest.raises(ValidationError):
		parse_ai_analysis(
			{
				"version": "1",
				"summary": "x",
				"riskFactors": [],
				"ambiguityFlags": [],
				"extractedAt": "2026-05-08T00:00:00+00:00",
				"unknown": "field",
			}
		)
