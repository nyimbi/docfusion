"""Tests for the digest LLM triage layer (recall invariant, tiers, cache)."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from docfusion.workers.digest import runner as digest_runner
from docfusion.workers.digest.triage import (
	ScoreCache,
	TriageScore,
	heuristic_fallback,
	load_profile,
	triage,
	url_hash_for,
)

FIXTURE = Path(__file__).parent.parent / "fixtures" / "opportunities-200.json"


@pytest.fixture
def fixture_opps() -> list[dict]:
	with FIXTURE.open() as f:
		return json.load(f)


@pytest.fixture
def profile() -> tuple[dict, str]:
	return load_profile(Path("config/opportunity_profile.yaml"))


# ── Profile ──────────────────────────────────────────────────────


def test_profile_loads_with_required_keys(profile):
	p, h = profile
	assert p["company"] == "Datacraft"
	assert {s["name"] for s in p["sectors"]} >= {
		"Health Systems",
		"ICT & Digital",
		"WASH",
	}
	assert p["geographies"]["primary"]
	assert len(h) == 12


def test_profile_missing_file_uses_default():
	p, h = load_profile(Path("/nonexistent/profile.yaml"))
	assert p["company"] == "Datacraft"
	assert len(h) == 12


def test_profile_hash_changes_with_content(tmp_path):
	f = tmp_path / "p.yaml"
	f.write_text("company: X\nsectors: [{name: A, hints: [a]}]\n")
	_, h1 = load_profile(f)
	f.write_text("company: Y\nsectors: [{name: A, hints: [a]}]\n")
	_, h2 = load_profile(f)
	assert h1 != h2


# ── Junk split (recall guard) ────────────────────────────────────


def test_split_junk_rejects_only_definitive_junk(fixture_opps):
	kept, junk = digest_runner._split_junk(fixture_opps)
	assert len(kept) + len(junk) == len(fixture_opps)
	# Every junk item is provably reference content / junk host / no URL.
	for opp in junk:
		title_lc = str(opp.get("title") or "").lower()
		url = str(opp.get("source_url") or opp.get("url") or "")
		assert (
			not url
			or digest_runner._url_is_junk(url)
			or any(t in title_lc for t in digest_runner.REFERENCE_TITLE_TOKENS)
		), f"non-definitive junk rejected: {opp.get('title')}"
	# The known French-Wikipedia hit must be junk.
	assert any("wikipédia" in str(o.get("title", "")).lower() for o in junk)


def test_split_junk_keeps_borderline_items():
	borderline = [
		{
			"title": "Webinar recording: procurement trends",
			"source_url": "https://x.org/a",
			"source": "searxng:bing",
		},
		{
			"title": "Vacancy: M&E officer",
			"source_url": "https://x.org/b",
			"source": "searxng:bing",
		},
		{"title": "Short", "source_url": "https://x.org/c", "source": "searxng:bing"},
	]
	kept, junk = digest_runner._split_junk(borderline)
	assert len(kept) == 3 and not junk


# ── Heuristic fallback ───────────────────────────────────────────


def test_heuristic_fallback_tiers():
	strong = {
		"title": "Request for Proposals: digital health platform",
		"source_url": "https://www.ungm.org/Public/Notice/1",
		"source": "ungm",
		"deadline": "2030-01-01",
		"organization": "UNICEF",
		"reference": "REF-1",
	}
	s = heuristic_fallback(strong, "abc")
	assert s.tier == "A" and s.scored_by == "heuristic"
	weak = {
		"title": "some random page",
		"source_url": "https://x.org/z",
		"source": "searxng:bing",
	}
	assert heuristic_fallback(weak, "abc").tier == "C"


def test_tier_thresholds():
	assert TriageScore.tier_for(70) == "A"
	assert TriageScore.tier_for(69) == "B"
	assert TriageScore.tier_for(40) == "B"
	assert TriageScore.tier_for(39) == "C"


# ── Triage with mocked LLM ───────────────────────────────────────


class _FakeResponse:
	def __init__(self, payload: dict, status_code: int = 200):
		self._payload = payload
		self.status_code = status_code
		self.text = json.dumps(payload)

	def json(self):
		return self._payload


def _llm_response(items: list[dict]) -> dict:
	return {"choices": [{"message": {"content": json.dumps({"items": items})}}]}


def _mock_post(fn):
	"""Patch httpx.AsyncClient.post with fn(url, **kwargs) -> _FakeResponse."""
	import httpx

	async def post(self, url, **kwargs):
		return fn(url, **kwargs)

	return pytest.MonkeyPatch().context, httpx.AsyncClient, post


def test_triage_recall_invariant_and_batching(
	fixture_opps, profile, tmp_path, monkeypatch
):
	"""Every input gets a score; omitted items are backfilled heuristically."""
	import httpx

	p, h = profile
	kept, _ = digest_runner._split_junk(fixture_opps)
	calls = []

	async def fake_post(self, url, **kwargs):
		body = kwargs.get("json") or {}
		content = body["messages"][-1]["content"]
		n_items = content.count("\n") - content.split("OPPORTUNITIES")[0].count("\n")
		# Count numbered lines after OPPORTUNITIES
		lines = content.split("OPPORTUNITIES\n", 1)[1].strip().split("\n")
		calls.append(len(lines))
		# Omit the last item of every batch — triage must backfill it.
		items = [
			{
				"id": i + 1,
				"relevance": 80,
				"why": "fit",
				"sector": "Health Systems",
				"geography": "Kenya",
				"deadline": "2030-01-01",
			}
			for i in range(len(lines) - 1)
		]
		return _FakeResponse(_llm_response(items))

	monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
	monkeypatch.setenv("TRIAGE_BATCH_SIZE", "25")

	cache = ScoreCache(tmp_path / "scores")
	loop = asyncio.new_event_loop()
	try:
		scores = loop.run_until_complete(triage(kept, p, h, cache))
	finally:
		loop.close()

	# Recall invariant: every kept item has a score.
	assert set(scores) == {url_hash_for(o) for o in kept}
	# Batching: ceil(n/25) calls.
	assert len(calls) == -(-len(kept) // 25)
	# Omitted items became heuristic; scored items are llm.
	by_kind = {"llm": 0, "heuristic": 0}
	for s in scores.values():
		by_kind[s.scored_by] += 1
	assert by_kind["heuristic"] == len(calls)  # one omission per batch
	assert by_kind["llm"] == len(kept) - len(calls)


def test_triage_batch_failure_falls_back_heuristic(
	fixture_opps, profile, tmp_path, monkeypatch
):
	import httpx

	p, h = profile
	kept, _ = digest_runner._split_junk(fixture_opps)
	kept = kept[:30]

	async def fake_post(self, url, **kwargs):
		raise httpx.ConnectError("refused")

	monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
	cache = ScoreCache(tmp_path / "scores")
	loop = asyncio.new_event_loop()
	try:
		scores = loop.run_until_complete(triage(kept, p, h, cache))
	finally:
		loop.close()
	assert len(scores) == len(kept)
	assert all(s.scored_by == "heuristic" for s in scores.values())


def test_triage_dirty_json_parsed(profile, tmp_path, monkeypatch):
	import httpx

	p, h = profile
	opps = [
		{
			"title": "Tender: water supply Kenya",
			"source_url": "https://x.org/t1",
			"source": "ungm",
		}
	]

	async def fake_post(self, url, **kwargs):
		content = '```json\n{"items":[{"id":1,"relevance":85,"why":"fit","sector":"WASH","geography":"Kenya","deadline":""}]}\n```'
		return _FakeResponse({"choices": [{"message": {"content": content}}]})

	monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
	cache = ScoreCache(tmp_path / "scores")
	loop = asyncio.new_event_loop()
	try:
		scores = loop.run_until_complete(triage(opps, p, h, cache))
	finally:
		loop.close()
	s = scores[url_hash_for(opps[0])]
	assert s.tier == "A" and s.relevance == 85 and s.sector == "WASH"


# ── Cache semantics ──────────────────────────────────────────────


def test_cache_round_trip_and_profile_invalidation(tmp_path):
	cache = ScoreCache(tmp_path / "scores")
	score = TriageScore(
		url_hash="deadbeef00000000",
		relevance=80,
		tier="A",
		why="w",
		sector="WASH",
		geography="Kenya",
		deadline_iso="2030-01-01",
		scored_by="llm",
		profile_hash="h1",
		model="m",
		scored_at="t",
	)
	cache.put_many([score])
	cache.flush()

	fresh = ScoreCache(tmp_path / "scores")
	fresh.load_recent()
	assert fresh.get("deadbeef00000000", "h1") is not None
	# Different profile hash → miss (re-score).
	assert fresh.get("deadbeef00000000", "h2") is None


def test_cache_heuristic_entries_rescored_when_llm_available(tmp_path):
	cache = ScoreCache(tmp_path / "scores")
	score = TriageScore(
		url_hash="feedface00000000",
		relevance=50,
		tier="B",
		why="heuristic",
		sector="Other",
		geography="",
		deadline_iso="",
		scored_by="heuristic",
		profile_hash="h1",
		model="",
		scored_at="t",
	)
	cache.put_many([score])
	# LLM up: heuristic entry treated as a miss → upgrade path.
	assert cache.get("feedface00000000", "h1", llm_available=True) is None
	# LLM down: heuristic entry is served.
	assert cache.get("feedface00000000", "h1", llm_available=False) is not None
