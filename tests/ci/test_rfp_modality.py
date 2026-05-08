"""Compliance posture is exposed as `modality`, not `category`."""

from docfusion.rfp.requirement_extractor import (
	Requirement,
	RequirementModality,
)


def test_modality_enum_has_three_values():
	assert {m.value for m in RequirementModality} == {
		"mandatory",
		"optional",
		"conditional",
	}


def test_requirement_has_modality_field():
	r = Requirement(text="The contractor shall...", modality=RequirementModality.MANDATORY)
	assert r.modality == RequirementModality.MANDATORY


def test_requirement_modality_defaults_to_mandatory():
	r = Requirement(text="The contractor shall...")
	assert r.modality == RequirementModality.MANDATORY
