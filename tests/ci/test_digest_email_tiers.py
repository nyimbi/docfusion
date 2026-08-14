"""Tests for the tiered digest email: no truncation, tier ordering, closing-soon."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from docfusion.workers.digest import runner as digest_runner
from docfusion.workers.digest.triage import ScoreCache, TriageScore, url_hash_for

FIXTURE = Path(__file__).parent.parent / "fixtures" / "opportunities-200.json"


def _score_for(opp: dict, relevance: int) -> TriageScore:
	return TriageScore(
		url_hash=url_hash_for(opp),
		relevance=relevance,
		tier=TriageScore.tier_for(relevance),
		why="test reason",
		sector="Health Systems",
		geography="Kenya",
		deadline_iso="",
		scored_by="llm",
		profile_hash="h1",
		model="m",
		scored_at="t",
	)


@pytest.fixture
def kept_opps() -> list[dict]:
	with FIXTURE.open() as f:
		raw = json.load(f)
	kept, _ = digest_runner._split_junk(raw)
	return kept


def _build_tiers(kept: list[dict]) -> dict[str, list[tuple[dict, TriageScore]]]:
	tiers: dict[str, list[tuple[dict, TriageScore]]] = {"A": [], "B": [], "C": []}
	for i, opp in enumerate(kept):
		relevance = (85, 55, 20)[i % 3]
		score = _score_for(opp, relevance)
		tiers[score.tier].append((opp, score))
	return tiers


def test_every_kept_item_renders(kept_opps):
	tiers = _build_tiers(kept_opps)
	counts = {
		"a": len(tiers["A"]),
		"b": len(tiers["B"]),
		"c": len(tiers["C"]),
		"junk": 0,
		"total": len(kept_opps),
		"breakdown": "x",
		"triage_mode": "llm",
	}
	html = digest_runner._html_tiered_digest(tiers, [], "2026-06-07", "summary", counts)
	# No-truncation proof: at least one link per kept item.
	assert html.count("<a href") >= len(kept_opps)
	# Tier sections in order.
	a_pos = html.find("Pursue")
	b_pos = html.find("Worth reviewing")
	c_pos = html.find("Long tail")
	assert 0 < a_pos < b_pos < c_pos


def test_tier_counts_in_header(kept_opps):
	tiers = _build_tiers(kept_opps)
	counts = {
		"a": len(tiers["A"]),
		"b": len(tiers["B"]),
		"c": len(tiers["C"]),
		"junk": 7,
		"total": len(kept_opps) + 7,
		"breakdown": "x",
		"triage_mode": "llm",
	}
	html = digest_runner._html_tiered_digest(tiers, [], "2026-06-07", "s", counts)
	assert f"A: {counts['a']} pursue" in html
	assert "7 junk removed" in html


def test_closing_soon_resurfaces_prior_day(tmp_path, monkeypatch):
	monkeypatch.setattr(digest_runner, "STORAGE_DIR", tmp_path)
	today = datetime.now(timezone.utc)
	today_str = today.strftime("%Y-%m-%d")
	yesterday = (today - timedelta(days=1)).strftime("%Y-%m-%d")
	deadline = (today + timedelta(days=5)).strftime("%Y-%m-%d")

	prior_opp = {
		"title": "EOI: MEL framework design",
		"source_url": "https://www.ungm.org/Public/Notice/99",
		"source": "ungm",
	}
	(tmp_path / f"{yesterday}.json").write_text(json.dumps([prior_opp]))

	cache = ScoreCache(tmp_path / "scores")
	score = _score_for(prior_opp, 80)
	score.deadline_iso = deadline
	cache.put_many([score])

	closing = digest_runner._closing_soon(today_str, cache, "h1", set())
	assert len(closing) == 1
	assert closing[0][0]["title"] == "EOI: MEL framework design"

	# Already in today's crawl → deduped out.
	closing = digest_runner._closing_soon(
		today_str, cache, "h1", {url_hash_for(prior_opp)}
	)
	assert closing == []


def test_closing_soon_ignores_past_and_far_deadlines(tmp_path, monkeypatch):
	monkeypatch.setattr(digest_runner, "STORAGE_DIR", tmp_path)
	today = datetime.now(timezone.utc)
	today_str = today.strftime("%Y-%m-%d")
	yesterday = (today - timedelta(days=1)).strftime("%Y-%m-%d")

	opps = [
		{"title": "expired", "source_url": "https://x.org/1", "source": "ungm"},
		{"title": "far", "source_url": "https://x.org/2", "source": "ungm"},
	]
	(tmp_path / f"{yesterday}.json").write_text(json.dumps(opps))

	cache = ScoreCache(tmp_path / "scores")
	s1 = _score_for(opps[0], 80)
	s1.deadline_iso = (today - timedelta(days=2)).strftime("%Y-%m-%d")
	s2 = _score_for(opps[1], 80)
	s2.deadline_iso = (today + timedelta(days=60)).strftime("%Y-%m-%d")
	cache.put_many([s1, s2])

	assert digest_runner._closing_soon(today_str, cache, "h1", set()) == []


def test_parse_deadline_formats():
	assert digest_runner._parse_deadline("2026-09-30") is not None
	assert digest_runner._parse_deadline("07-Sep-2026") is not None
	assert digest_runner._parse_deadline("2026-08-26T00:00:00Z") is not None
	assert digest_runner._parse_deadline("") is None
	assert digest_runner._parse_deadline("garbage") is None
