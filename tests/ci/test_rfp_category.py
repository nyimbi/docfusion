"""Python RequirementCategory must match TS REQUIREMENT_CATEGORIES exactly."""

from docfusion.rfp.requirement_extractor import RequirementCategory, Requirement


# Mirror of frontend/lib/db/schema-rfp.ts:598-608.
TS_CATEGORIES = frozenset({
	"technical", "management", "past_performance", "cost",
	"administrative", "personnel", "security", "compliance", "other",
})


def test_category_enum_matches_ts_taxonomy():
	py_categories = {c.value for c in RequirementCategory}
	assert py_categories == TS_CATEGORIES, (
		f"Python and TS taxonomies diverged. "
		f"Python only: {py_categories - TS_CATEGORIES}. "
		f"TS only: {TS_CATEGORIES - py_categories}."
	)


def test_category_default_is_other():
	r = Requirement(text="anything")
	assert r.category == RequirementCategory.OTHER
