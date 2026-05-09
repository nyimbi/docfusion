"""Versioned aiAnalysis schema, mirror of frontend/lib/types/ai-analysis.ts.

Any change here MUST be mirrored in the TS module and vice-versa. The matched
test pair (tests/ci/test_ai_analysis_schema.py and
frontend/__tests__/types/ai-analysis.test.ts) is the contract.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter


class AmbiguityFlag(BaseModel):
	model_config = ConfigDict(extra="forbid", validate_by_name=True, validate_by_alias=True)

	requirementId: str
	reason: str


class AiAnalysisV1(BaseModel):
	"""Schema version 1 for `rfp_requirements.ai_analysis` JSONB column."""

	model_config = ConfigDict(extra="forbid", validate_by_name=True, validate_by_alias=True)

	version: Literal["1"]
	summary: str
	riskFactors: list[str] = Field(default_factory=list)
	suggestedApproach: str | None = None
	ambiguityFlags: list[AmbiguityFlag] = Field(default_factory=list)
	extractedAt: datetime


# Discriminated union ready for future v2/v3 variants. The `Union[V1]`
# form silently collapses to `V1` while only one variant exists. When a
# second variant is added, switch to a tagged form so Pydantic dispatches
# on the discriminator instead of trying every member:
#
#     AiAnalysis = Annotated[Union[AiAnalysisV1, AiAnalysisV2], Field(discriminator="version")]
#
AiAnalysis = Union[AiAnalysisV1]
_adapter: TypeAdapter[AiAnalysis] = TypeAdapter(AiAnalysis)


def parse_ai_analysis(value: Any) -> AiAnalysis | None:
	"""Parse a raw JSONB payload into the active aiAnalysis variant.

	Returns None for null input. Raises ValidationError on shape mismatch —
	callers should treat that as a data-corruption event.
	"""
	if value is None:
		return None
	return _adapter.validate_python(value)
