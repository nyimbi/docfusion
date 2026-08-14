"""
LLM triage for the opportunity digest.

Scores every crawled opportunity against the business profile in
config/opportunity_profile.yaml and assigns a tier:

	A (relevance >= 70)  — pursue
	B (relevance >= 40)  — worth reviewing
	C (otherwise)        — long tail

Recall invariant: triage() ALWAYS returns a score for every input item.
Items the LLM omits or fails on get a heuristic fallback score — nothing
is ever dropped here. Tiers control position in the email, not inclusion.

Environment:
	OPPORTUNITY_PROFILE_PATH — profile YAML (default config/opportunity_profile.yaml)
	TRIAGE_BATCH_SIZE        — items per LLM call (default 25)
	TRIAGE_MODEL             — model override (falls back to LLM_MODEL, then gpt-4o)
	LITELLM_URL / LITELLM_API_KEY / LITELLM_KEY — gateway (same as _summarise)
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

_log = logging.getLogger(__name__)

TIER_A_MIN = 70
TIER_B_MIN = 40

_DEFAULT_PROFILE: dict = {
	"company": "Datacraft",
	"positioning": (
		"Africa-focused development consultancy delivering technical assistance, "
		"digital systems, and monitoring & evaluation."
	),
	"sectors": [
		{"name": "Health Systems", "hints": ["health"]},
		{"name": "ICT & Digital", "hints": ["digital", "ict"]},
		{"name": "Education", "hints": ["education"]},
		{"name": "WASH", "hints": ["water", "sanitation"]},
		{"name": "Agriculture & Food Security", "hints": ["agriculture"]},
		{"name": "Governance & MEL", "hints": ["governance", "evaluation"]},
		{"name": "Climate & Energy", "hints": ["climate", "energy"]},
	],
	"geographies": {"primary": ["Sub-Saharan Africa"], "secondary": ["global"]},
	"client_types": ["World Bank", "UN agencies", "USAID", "African governments"],
	"delivery_models": ["consultancy", "technical assistance"],
	"exclusions": ["clinical trials / biomedical research"],
	"keyword_boost": [],
	"keyword_demote": [],
}


def load_profile(path: Path | None = None) -> tuple[dict, str]:
	"""Load the relevance profile. Returns (profile_dict, profile_hash).

	Missing or invalid file returns the built-in default — never raises.
	"""
	if path is None:
		path = Path(
			os.environ.get(
				"OPPORTUNITY_PROFILE_PATH", "config/opportunity_profile.yaml"
			)
		)
	try:
		raw = path.read_bytes()
		import yaml

		profile = yaml.safe_load(raw)
		if not isinstance(profile, dict) or "sectors" not in profile:
			raise ValueError("profile missing required keys")
		profile_hash = hashlib.sha256(raw).hexdigest()[:12]
		return profile, profile_hash
	except Exception as exc:
		_log.warning("Profile load failed (%s: %s) — using built-in default", path, exc)
		default_bytes = json.dumps(_DEFAULT_PROFILE, sort_keys=True).encode()
		return _DEFAULT_PROFILE, hashlib.sha256(default_bytes).hexdigest()[:12]


@dataclass
class TriageScore:
	url_hash: str
	relevance: int
	tier: str
	why: str
	sector: str
	geography: str
	deadline_iso: str
	scored_by: str  # "llm" | "heuristic"
	profile_hash: str
	model: str
	scored_at: str
	synopsis: str = ""

	@staticmethod
	def tier_for(relevance: int) -> str:
		if relevance >= TIER_A_MIN:
			return "A"
		if relevance >= TIER_B_MIN:
			return "B"
		return "C"


def url_hash_for(opp: dict) -> str:
	url = str(opp.get("source_url") or opp.get("url") or "")
	return hashlib.sha256(url.encode()).hexdigest()[:16]


class ScoreCache:
	"""Monthly-sharded score store: storage/opportunities/scores/YYYY-MM.json."""

	def __init__(self, scores_dir: Path):
		self.scores_dir = scores_dir
		self._data: dict[str, dict] = {}
		self._loaded_shards: set[str] = set()
		self._dirty_shards: set[str] = set()

	def _shard_name(self, when: datetime | None = None) -> str:
		when = when or datetime.now(timezone.utc)
		return when.strftime("%Y-%m")

	def load_recent(self, months: int = 3) -> None:
		"""Load current + previous shards so multi-day items hit the cache."""
		if not self.scores_dir.exists():
			return
		shards = sorted(self.scores_dir.glob("[0-9][0-9][0-9][0-9]-[0-9][0-9].json"))
		for shard_path in shards[-months:]:
			try:
				with shard_path.open() as f:
					self._data.update(json.load(f))
				self._loaded_shards.add(shard_path.stem)
			except Exception:
				_log.warning("Failed to load score shard %s", shard_path, exc_info=True)

	def get(
		self, url_hash: str, profile_hash: str, llm_available: bool = True
	) -> Optional[TriageScore]:
		entry = self._data.get(url_hash)
		if not entry:
			return None
		if entry.get("profile_hash") != profile_hash:
			return None
		# Heuristic entries are provisional: re-score once the LLM is back.
		if entry.get("scored_by") == "heuristic" and llm_available:
			return None
		try:
			return TriageScore(**entry)
		except TypeError:
			return None

	def put_many(self, scores: Iterable[TriageScore]) -> None:
		shard = self._shard_name()
		for s in scores:
			self._data[s.url_hash] = asdict(s)
		self._dirty_shards.add(shard)

	def update_synopsis(self, url_hash: str, synopsis: str) -> None:
		if url_hash in self._data:
			self._data[url_hash]["synopsis"] = synopsis
			self._dirty_shards.add(self._shard_name())

	def flush(self) -> None:
		"""Atomic write of the current shard (all in-memory entries)."""
		if not self._dirty_shards:
			return
		self.scores_dir.mkdir(parents=True, exist_ok=True)
		shard = self._shard_name()
		path = self.scores_dir / f"{shard}.json"
		tmp = path.with_suffix(".json.tmp")
		try:
			with tmp.open("w") as f:
				json.dump(self._data, f, indent=1, default=str)
			os.replace(tmp, path)
			self._dirty_shards.clear()
		except Exception:
			_log.error("Failed to flush score cache %s", path, exc_info=True)
			tmp.unlink(missing_ok=True)


def heuristic_fallback(opp: dict, profile_hash: str) -> TriageScore:
	"""Regex-based tier when the LLM is unavailable or omitted an item."""
	# Late import avoids a circular import (runner imports this module).
	from .runner import _parse_deadline, _quality_score, classify_sector

	q = _quality_score(opp)
	if q >= 7:
		relevance = 75
	elif q >= 3:
		relevance = 50
	else:
		relevance = 20
	deadline_dt = _parse_deadline(str(opp.get("deadline") or ""))
	return TriageScore(
		url_hash=url_hash_for(opp),
		relevance=relevance,
		tier=TriageScore.tier_for(relevance),
		why="heuristic (LLM unavailable)",
		sector=classify_sector(str(opp.get("title") or "")),
		geography="",
		deadline_iso=deadline_dt.strftime("%Y-%m-%d") if deadline_dt else "",
		scored_by="heuristic",
		profile_hash=profile_hash,
		model="",
		scored_at=datetime.now(timezone.utc).isoformat(),
	)


def _profile_prompt(profile: dict) -> str:
	sectors = ", ".join(s["name"] for s in profile.get("sectors", []))
	geo = profile.get("geographies", {})
	return (
		"COMPANY PROFILE\n"
		f"{profile.get('positioning', '').strip()}\n"
		f"Sectors: {sectors}\n"
		f"Priority geographies: {', '.join(geo.get('primary', []))}; "
		f"acceptable: {', '.join(geo.get('secondary', []))}\n"
		f"Clients: {', '.join(str(c) for c in profile.get('client_types', []))}\n"
		f"We deliver: {', '.join(profile.get('delivery_models', []))}\n"
		f"Poor fits (score <=30): {'; '.join(profile.get('exclusions', []))}\n"
		"\nSCORING: 70-100 = strong fit we should pursue; "
		"40-69 = possible fit worth a look; "
		"0-39 = weak fit or not a real opportunity "
		"(research grants, wrong geography, goods-only).\n"
		"Items from source nih.reporter are funded research projects, not open "
		"solicitations — score <=35 unless clearly an open call.\n"
	)


_SYSTEM_PROMPT = (
	"You score procurement/grant opportunities for relevance to a specific "
	"consultancy. Return ONLY JSON of the form "
	'{"items":[{"id":<int>,"relevance":<0-100>,"why":"<max 12 words>",'
	'"sector":"<one of the listed sectors or Other>",'
	'"geography":"<country/region or unknown>",'
	'"deadline":"<YYYY-MM-DD or empty string>"}]}. '
	"Score every input item. Never omit an item."
)


def _item_line(n: int, opp: dict) -> str:
	title = str(opp.get("title") or "")[:160]
	return (
		f"{n}. [{opp.get('source', '?')}] {title}"
		f" | org: {opp.get('organization') or '-'}"
		f" | deadline: {opp.get('deadline') or '-'}"
		f" | tags: {','.join(opp.get('tags') or [])}"
		f" | desc: {str(opp.get('description') or '')[:200]}"
	)


def _parse_llm_json(raw: str) -> dict:
	cleaned = re.sub(r"```(?:json)?", "", raw).strip()
	return json.loads(cleaned)


async def _score_batch(
	client,
	batch: list[dict],
	profile: dict,
	profile_hash: str,
	model: str,
	litellm_url: str,
	api_key: str,
) -> list[TriageScore]:
	"""Score one batch. Raises on unrecoverable failure (caller falls back)."""
	user_msg = (
		_profile_prompt(profile)
		+ "\nOPPORTUNITIES\n"
		+ "\n".join(_item_line(i + 1, o) for i, o in enumerate(batch))
	)
	messages = [
		{"role": "system", "content": _SYSTEM_PROMPT},
		{"role": "user", "content": user_msg},
	]
	valid_sectors = {s["name"] for s in profile.get("sectors", [])}

	for attempt in range(2):
		r = await client.post(
			f"{litellm_url}/chat/completions",
			headers={"Authorization": f"Bearer {api_key}"},
			json={
				"model": model,
				"messages": messages,
				"temperature": 0,
				# deepseek-v4-flash has 1M context; generous output budget so a
				# batch's JSON can never truncate mid-item.
				"max_tokens": 32000,
				"response_format": {"type": "json_object"},
			},
			timeout=60,
		)
		if r.status_code >= 400:
			raise RuntimeError(f"LiteLLM {r.status_code}: {r.text[:200]}")
		body = r.json()
		choices = body.get("choices") or []
		if not choices:
			raise RuntimeError(f"no choices in response: {str(body)[:200]}")
		content = (choices[0].get("message") or {}).get("content", "")
		try:
			parsed = _parse_llm_json(content)
			break
		except (json.JSONDecodeError, ValueError):
			if attempt == 0:
				messages.append({"role": "assistant", "content": content})
				messages.append({"role": "user", "content": "Return ONLY valid JSON."})
				continue
			raise

	now = datetime.now(timezone.utc).isoformat()
	scores: list[TriageScore] = []
	by_id: dict[int, dict] = {}
	for item in parsed.get("items", []):
		try:
			by_id[int(item["id"])] = item
		except (KeyError, TypeError, ValueError):
			continue

	for i, opp in enumerate(batch):
		item = by_id.get(i + 1)
		if item is None:
			# Recall invariant: LLM omitted it — heuristic backfill.
			scores.append(heuristic_fallback(opp, profile_hash))
			continue
		try:
			relevance = max(0, min(100, int(item.get("relevance", 0))))
		except (TypeError, ValueError):
			relevance = 0
		sector = str(item.get("sector") or "Other")
		if sector not in valid_sectors:
			sector = "Other"
		deadline = str(item.get("deadline") or "")
		if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", deadline):
			deadline = ""
		scores.append(
			TriageScore(
				url_hash=url_hash_for(opp),
				relevance=relevance,
				tier=TriageScore.tier_for(relevance),
				why=str(item.get("why") or "")[:200],
				sector=sector,
				geography=str(item.get("geography") or "")[:60],
				deadline_iso=deadline,
				scored_by="llm",
				profile_hash=profile_hash,
				model=model,
				scored_at=now,
			)
		)
	return scores


async def triage(
	opps: list[dict],
	profile: dict,
	profile_hash: str,
	cache: ScoreCache,
) -> dict[str, TriageScore]:
	"""Score all opportunities. Guaranteed to return a score per input item."""
	import httpx

	litellm_url = os.environ.get("LITELLM_URL", "http://62.169.25.77:4000/v1").rstrip(
		"/"
	)
	api_key = (
		os.environ.get("LITELLM_API_KEY")
		or os.environ.get("LITELLM_KEY")
		or "sk-pjs-litellm-master-key"
	)
	model = os.environ.get("TRIAGE_MODEL") or os.environ.get("LLM_MODEL", "gpt-4o")
	batch_size = max(5, int(os.environ.get("TRIAGE_BATCH_SIZE", "25")))

	result: dict[str, TriageScore] = {}
	to_score: list[dict] = []
	for opp in opps:
		h = url_hash_for(opp)
		cached = cache.get(h, profile_hash, llm_available=True)
		if cached:
			result[h] = cached
		else:
			to_score.append(opp)

	_log.info(
		"Triage: %d cached, %d to score (batch=%d, model=%s)",
		len(result),
		len(to_score),
		batch_size,
		model,
	)

	if to_score:
		batches = [
			to_score[i : i + batch_size] for i in range(0, len(to_score), batch_size)
		]
		sem = asyncio.Semaphore(3)
		newly_scored: list[TriageScore] = []

		async with httpx.AsyncClient() as client:

			async def run_batch(batch: list[dict]) -> list[TriageScore]:
				async with sem:
					try:
						return await _score_batch(
							client,
							batch,
							profile,
							profile_hash,
							model,
							litellm_url,
							api_key,
						)
					except (KeyboardInterrupt, SystemExit):
						raise
					except Exception as exc:
						_log.warning(
							"Triage batch failed (%s) — heuristic fallback for %d items",
							str(exc)[:120],
							len(batch),
						)
						return [heuristic_fallback(o, profile_hash) for o in batch]

			batch_results = await asyncio.gather(*(run_batch(b) for b in batches))

		for scores in batch_results:
			newly_scored.extend(scores)
		for s in newly_scored:
			result[s.url_hash] = s
		cache.put_many(newly_scored)
		cache.flush()

	# Recall invariant: every input must have a score.
	for opp in opps:
		h = url_hash_for(opp)
		if h not in result:
			result[h] = heuristic_fallback(opp, profile_hash)

	return result
