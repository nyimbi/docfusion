"""
Opportunity Digest Runner

Entry point for the systemd daily digest job (08:00 UTC).
Reads today's crawl output from storage/opportunities/YYYY-MM-DD.json,
generates an HTML digest via LiteLLM, and emails it via Stalwart SMTP.

Usage:
    python -m docfusion.workers.digest [--date YYYY-MM-DD] [--to email@example.com]

Environment variables:
    DIGEST_TO_EMAIL      — recipient address (comma-separated for multiple)
    DIGEST_TO_NAME       — recipient display name
    OPPORTUNITY_STORAGE_DIR — path to daily opportunity JSON files
    SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

_log = logging.getLogger(__name__)

STORAGE_DIR = Path(os.environ.get("OPPORTUNITY_STORAGE_DIR", "./storage/opportunities"))
DEFAULT_TO_EMAIL = os.environ.get("DIGEST_TO_EMAIL", "")
DEFAULT_TO_NAME = os.environ.get("DIGEST_TO_NAME", "Team")


# ---------------------------------------------------------------------------
# Quality filtering
# ---------------------------------------------------------------------------

BONUS_DOMAINS: frozenset[str] = frozenset(
	{
		"ungm.org",
		"ted.europa.eu",
		"usaid.gov",
		"afdb.org",
		"adb.org",
		"iadb.org",
		"giz.de",
		"devex.com",
		"reliefweb.int",
		"phap.org",
		"mcc.gov",
		"ifc.org",
		"worldbank.org",
		"projects.worldbank.org",
		"undp.org",
		"unicef.org",
		"wfp.org",
		"fao.org",
		"who.int",
		"globalfund.org",
		"tenders.go.ke",
		"etenders.gov.za",
		"ppda.go.ug",
		"ppra.go.tz",
		"bpp.gov.ng",
		"ppa.gov.gh",
		"rppa.gov.rw",
		"unops.org",
		"grants.gov",
		"sam.gov",
		"reporter.nih.gov",
		"gatesfoundation.org",
		"rockefellerfoundation.org",
		"aiib.org",
		# Additional tender/procurement portals
		"eu-supply.com",
		"tenderselectric.com",
		"reliefweb.int",
		"grants.nih.gov",
		"eur-lex.europa.eu",
		"state.gov",
		"treasury.gov",
		"eiopa.europa.eu",
		"ebrd.com",
	}
)

# Strong procurement phrases \u2014 require multi-word context so we don't match
# "grant Thornton", "Ulysses S. Grant Wikipedia", "services page", etc.
TITLE_PHRASES: tuple[str, ...] = (
	"request for proposal",
	"request for proposals",
	"request for quotation",
	"request for quotations",
	"request for information",
	"request for tender",
	"call for proposal",
	"call for proposals",
	"call for tender",
	"call for tenders",
	"call for expression of interest",
	"invitation to bid",
	"invitation to tender",
	"invitation for bid",
	"expression of interest",
	"expressions of interest",
	"notice of tender",
	"notice of procurement",
	"procurement notice",
	"tender notice",
	"tender opportunity",
	"prior information notice",
	"contract notice",
	"contract opportunity",
	"solicitation notice",
	"grant opportunity",
	"funding opportunity",
	"grant application",
	"grant call",
	"consultancy opportunity",
)

# Bare tokens still counted, but any-token-alone is not enough on its own \u2014
# scoring keeps the searxng threshold high so token-only matches lose.
TITLE_KEYWORDS: tuple[str, ...] = (
	"rfp",
	"rfq",
	"rfi",
	"tender",
	"procurement",
	"solicitation",
)

# Anything with these substrings in the title is dropped outright.
# Includes unicode variants ("wikip\u00e9dia") and common non-opportunity content.
NEGATIVE_TITLE_KEYWORDS: tuple[str, ...] = (
	# Reference / dictionary content
	"wikipedia",
	"wikip\u00e9dia",
	"wiktionary",
	"wiktionnaire",
	"dictionary",
	"dictionnaire",
	"definition",
	"d\u00e9finition",
	"traduction",
	"translation",
	"encyclop",
	"wikimedia",
	"wikivoyage",
	# Editorial / marketing
	"blog",
	"news article",
	"op-ed",
	"opinion piece",
	"podcast",
	"webinar recording",
	"case study",
	"white paper",
	"e-book",
	"press release",
	"how to",
	"guide to",
	"top 10",
	"top ten",
	"top 5",
	"top five",
	"list of",
	"best practices",
	# Training / courses
	"training course",
	"online course",
	"certification",
	"workshop",
	# Recruitment / careers
	"career",
	"job opening",
	"hiring",
	"we are hiring",
	"vacancy",
	"recruitment",
	# Corporate marketing
	"our services",
	"we offer",
	"consulting firm",
	"company profile",
	"our team",
	"meet the team",
	"about us",
)

# Positive URL-path signals \u2014 presence of any of these in the path strongly
# suggests an actual procurement notice.
URL_PATH_SIGNALS: tuple[str, ...] = (
	"/tender",
	"/tenders",
	"/procurement",
	"/procure",
	"/rfp",
	"/rfq",
	"/rfi",
	"/eoi",
	"/bid",
	"/bids",
	"/notice",
	"/notices",
	"/opportunit",
	"/solicitation",
	"/contract",
	"/proposal",
	"/grants/view",
)

# Definitive-junk URL patterns \u2014 dictionaries, wikis, social. These are the
# ONLY hosts hard-rejected from the digest (recall constraint: everything
# else is shown, at worst in the long-tail tier).
URL_JUNK_SUBSTRINGS: tuple[str, ...] = (
	"wikipedia.org",
	"wiktionary.org",
	"wikimedia.org",
	"wordreference.com",
	"reverso.net",
	"linguee",
	"dictionary.com",
	"merriam-webster.com",
	"collinsdictionary.com",
	"larousse.fr",
	"thefreedictionary.com",
	"youtube.com",
	"youtu.be",
	"reddit.com",
	"quora.com",
	"linkedin.com",
	"twitter.com",
	"facebook.com",
	"instagram.com",
)

# News/editorial hosts \u2014 demoted in scoring but NEVER hard-rejected
# (a news page can announce a real tender).
URL_DEMOTE_SUBSTRINGS: tuple[str, ...] = (
	"lemonde.fr",
	"nytimes.com",
	"bbc.co.uk",
	"bbc.com",
	"medium.com",
	"substack.com",
)

# Title tokens that mark reference content (encyclopedia/dictionary) \u2014 the
# only title-based hard reject. Marketing/webinar/vacancy tokens stay in
# NEGATIVE_TITLE_KEYWORDS for score demotion only.
REFERENCE_TITLE_TOKENS: tuple[str, ...] = (
	"wikipedia",
	"wikip\u00e9dia",
	"wiktionary",
	"wiktionnaire",
	"dictionary",
	"dictionnaire",
	"definition",
	"d\u00e9finition",
	"traduction",
	"translation",
	"encyclop",
	"wikimedia",
	"wikivoyage",
)

BUDGET_RE = re.compile(
	r"\$[\d,]+|\u20ac[\d,]+|\bUSD\s*[\d,]+|\bEUR\s*[\d,]+|\bGBP\s*[\d,]+", re.IGNORECASE
)
STRUCTURED_SOURCES: tuple[str, ...] = (
	"grants.gov",
	"worldbank",
	"worldbank.org",
	"sam.gov",
	"ungm",
	"ungm.org",
	"afdb",
	"afdb.org",
	"ted.europa.eu",
	"reporter.nih.gov",
)


def _domain(url: str) -> str:
	try:
		return urlparse(url).netloc.lower().removeprefix("www.")
	except Exception:
		return ""


def _source_domain(opp: dict) -> str:
	domain = _domain(str(opp.get("source_url") or opp.get("url") or ""))
	if domain:
		return domain
	source = str(opp.get("source") or "").lower()
	if "://" in source:
		return _domain(source)
	if "." in source and not source.startswith(("searxng:", "firecrawl:")):
		return source.split(":", 1)[0].removeprefix("www.")
	return ""


def _domain_in_bonus(domain: str) -> bool:
	return bool(domain) and any(
		domain == d or domain.endswith("." + d) for d in BONUS_DOMAINS
	)


def _has_title_keyword(title_lc: str) -> bool:
	"""True if the title contains a procurement keyword as a whole word."""
	return any(
		re.search(rf"\b{re.escape(keyword)}\b", title_lc) for keyword in TITLE_KEYWORDS
	)


def _has_title_phrase(title_lc: str) -> bool:
	"""True if the title contains a strong multi-word procurement phrase."""
	return any(phrase in title_lc for phrase in TITLE_PHRASES)


def _url_has_procurement_path(url: str) -> bool:
	"""True if the URL path contains a procurement/tender path marker."""
	try:
		path = urlparse(url).path.lower()
	except Exception:
		return False
	return any(sig in path for sig in URL_PATH_SIGNALS)


def _url_is_junk(url: str) -> bool:
	"""True if the URL matches a known non-opportunity destination (wiki, dict, social)."""
	url_lc = (url or "").lower()
	return any(sig in url_lc for sig in URL_JUNK_SUBSTRINGS)


def _title_has_negative(title_lc: str) -> bool:
	return any(neg in title_lc for neg in NEGATIVE_TITLE_KEYWORDS)


def _parse_deadline(deadline: object) -> datetime | None:
	"""Parse a deadline string in any of the formats sources emit. None if unparseable."""
	raw = str(deadline or "").strip()
	if not raw:
		return None
	cleaned = raw.replace("Z", "+00:00")
	candidates = [cleaned]
	if "T" in cleaned:
		candidates.append(cleaned.split("T", 1)[0])
	for candidate in candidates:
		try:
			dt = datetime.fromisoformat(candidate)
			if dt.tzinfo is None:
				dt = dt.replace(tzinfo=timezone.utc)
			return dt
		except ValueError:
			pass
	for fmt in (
		"%Y-%m-%d",
		"%Y/%m/%d",
		"%d/%m/%Y",
		"%m/%d/%Y",
		"%d %b %Y",
		"%d %B %Y",
		"%B %d, %Y",
		"%d-%b-%Y",
	):
		try:
			return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
		except ValueError:
			continue
	return None


def _deadline_in_future(deadline: object) -> bool:
	dt = _parse_deadline(deadline)
	return dt is not None and dt > datetime.now(timezone.utc)


def _is_structured_source(opp: dict, domain: str) -> bool:
	source = str(opp.get("source") or "").lower()
	return any(
		source == structured
		or source.startswith(structured + ":")
		or domain == structured
		or domain.endswith("." + structured)
		for structured in STRUCTURED_SOURCES
	)


def _quality_score(opp: dict) -> int:
	title = str(opp.get("title") or "")
	title_lc = title.lower()
	description = " ".join(
		str(opp.get(field) or "") for field in ("description", "summary")
	)
	source = str(opp.get("source") or "").lower()
	url = str(opp.get("source_url") or opp.get("url") or "")
	domain = _source_domain(opp)

	has_phrase = _has_title_phrase(title_lc)
	has_keyword = _has_title_keyword(title_lc)
	in_bonus = _domain_in_bonus(domain)
	on_procurement_path = _url_has_procurement_path(url)

	score = 0
	if in_bonus:
		score += 3
	if has_phrase:
		score += 4  # Strong signal: "request for proposal" beats bare "rfp"
	elif has_keyword:
		score += 1  # Weaker: whole-word "tender" alone
	if on_procurement_path:
		score += 2
	if BUDGET_RE.search(description) or BUDGET_RE.search(title):
		score += 2
	if opp.get("deadline") and _deadline_in_future(opp.get("deadline")):
		score += 3  # Future deadline is the strongest single positive signal
	if opp.get("organization"):
		score += 1
	if opp.get("reference"):
		score += 1
	# Strong penalties
	if _title_has_negative(title_lc):
		score -= 6
	if _url_is_junk(url):
		score -= 6
	if any(sig in url.lower() for sig in URL_DEMOTE_SUBSTRINGS):
		score -= 3
	# SearXNG is the noisiest path; it must earn its place.
	if source.startswith("searxng:") and not (
		has_phrase or on_procurement_path or in_bonus
	):
		score -= 4
	return score


def _split_junk(opportunities: list[dict]) -> tuple[list[dict], list[dict]]:
	"""
	Split into (kept, junk). Recall constraint: junk means PROVABLY not an
	opportunity — no URL, a dictionary/wiki/social host, or reference-content
	title (wikipedia/dictionnaire/...). Everything else is kept and flows to
	LLM triage, which tiers it but never drops it.
	"""
	kept: list[dict] = []
	junk: list[dict] = []
	for opp in opportunities:
		title_lc = str(opp.get("title") or "").strip().lower()
		url = str(opp.get("source_url") or opp.get("url") or "").strip()
		if (
			not url
			or _url_is_junk(url)
			or any(tok in title_lc for tok in REFERENCE_TITLE_TOKENS)
		):
			junk.append(opp)
		else:
			kept.append(opp)
	return kept, junk


# Canonical sector names — keep in sync with config/opportunity_profile.yaml
SECTOR_KEYWORDS: dict[str, list[str]] = {
	"Health Systems": [
		"health",
		"medical",
		"hospital",
		"pharmaceutical",
		"hiv",
		"malaria",
		"nutrition",
	],
	"Education": [
		"education",
		"school",
		"curriculum",
		"learning",
		"training",
		"capacity",
	],
	"WASH": ["water", "sanitation", "wash", "hygiene"],
	"ICT & Digital": ["ict", "digital", "technology", "software", "data", "cyber"],
	"Agriculture & Food Security": [
		"agriculture",
		"food security",
		"farm",
		"livestock",
		"crop",
	],
	"Governance & MEL": [
		"governance",
		"rule of law",
		"justice",
		"public sector",
		"monitoring and evaluation",
		"evaluation",
	],
	"Climate & Energy": ["climate", "renewable", "solar", "energy", "environment"],
	"Other": [],
}


def classify_sector(title: str) -> str:
	title_lc = title.lower()
	for sector, keywords in SECTOR_KEYWORDS.items():
		if sector == "Other":
			continue
		if any(keyword in title_lc for keyword in keywords):
			return sector
	return "Other"


# ---------------------------------------------------------------------------
# HTML digest builder
# ---------------------------------------------------------------------------


def _source_breakdown(opportunities: list[dict]) -> str:
	"""Return a compact string like 'grants.gov (45) · worldbank (30) · firecrawl (12)'."""
	from collections import Counter

	# Normalise source names: strip the engine suffix from searxng:bing → searxng
	def norm(src: str) -> str:
		if src.startswith("searxng:"):
			return "searxng"
		if src.startswith("firecrawl:"):
			return "firecrawl"
		return src

	counts: Counter[str] = Counter(
		norm(o.get("source", "unknown")) for o in opportunities
	)
	return " · ".join(f"{src} ({n})" for src, n in counts.most_common())


def _source_label(source: str) -> str:
	if source.startswith("firecrawl:"):
		return source[len("firecrawl:") :]
	if source.startswith("searxng:"):
		return "web search"
	return source


def _days_left(deadline_iso: str) -> str:
	dt = _parse_deadline(deadline_iso)
	if dt is None:
		return ""
	days = (dt.date() - datetime.now(timezone.utc).date()).days
	if days < 0:
		return ""
	return f" ({days}d left)"


def _meta_line(opp: dict, score) -> str:
	parts = [
		_source_label(str(opp.get("source") or "")),
		str(opp.get("organization") or ""),
	]
	deadline = score.deadline_iso or str(opp.get("deadline") or "")
	if deadline:
		parts.append(f"{deadline}{_days_left(score.deadline_iso)}")
	if opp.get("reference"):
		parts.append(f"Ref: {opp['reference']}")
	if score.geography:
		parts.append(score.geography)
	return " · ".join(p for p in parts if p)


def _html_tiered_digest(
	tiers: dict[str, list[tuple[dict, object]]],
	closing_soon: list[tuple[dict, object]],
	date_str: str,
	summary: str,
	counts: dict[str, int | str],
) -> str:
	a_items = tiers.get("A", [])
	b_items = tiers.get("B", [])
	c_items = tiers.get("C", [])

	# ── Closing soon ────────────────────────────────────────────
	closing_html = ""
	if closing_soon:
		rows = ""
		for opp, score in closing_soon:
			url = str(opp.get("source_url") or opp.get("url") or "#")
			rows += f"""
		<tr style="border-bottom:1px solid #f3e2bd">
		  <td style="padding:7px 10px">
		    <a href="{url}" style="color:#7a5c00;text-decoration:none;font-weight:600">{opp.get("title", "Untitled")}</a>
		    <div style="color:#8a7433;font-size:12px;margin-top:2px">{_meta_line(opp, score)} · Tier {score.tier}</div>
		  </td>
		</tr>"""
		closing_html = f"""
  <div style="background:#fdf6e3;border:1px solid #eadfb8;border-radius:6px;margin:16px 0;overflow:hidden">
    <div style="padding:10px 14px;font-weight:700;color:#7a5c00;font-size:14px">⏰ Closing soon ({len(closing_soon)})</div>
    <table style="width:100%;border-collapse:collapse">{rows}</table>
  </div>"""

	# ── Tier A: full cards grouped by sector ────────────────────
	a_html = ""
	if a_items:
		grouped: dict[str, list[tuple[dict, object]]] = {}
		for opp, score in a_items:
			grouped.setdefault(score.sector or "Other", []).append((opp, score))
		cards = ""
		for sector in list(SECTOR_KEYWORDS) + [
			s for s in grouped if s not in SECTOR_KEYWORDS
		]:
			sector_items = grouped.get(sector)
			if not sector_items:
				continue
			cards += f'<div style="padding:12px 4px 4px;color:#555;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">{sector}</div>'
			for opp, score in sector_items:
				url = str(opp.get("source_url") or opp.get("url") or "#")
				desc = str(score.synopsis or opp.get("description") or "")[:400]
				desc_html = (
					f'<p style="margin:6px 0 0;color:#444;font-size:13px;line-height:1.45">{desc}</p>'
					if desc
					else ""
				)
				budget = ""
				m = BUDGET_RE.search(
					f"{opp.get('description') or ''} {opp.get('title') or ''}"
				)
				if m:
					budget = f'<span style="color:#0b7a3e;font-weight:600;font-size:12px"> · {m.group(0)}</span>'
				cards += f"""
    <div style="border:1px solid #e3e8ee;border-radius:6px;padding:12px 14px;margin:8px 0;background:#fff">
      <a href="{url}" style="color:#0b57d0;text-decoration:none;font-weight:700;font-size:15px">{opp.get("title", "Untitled")}</a>
      <span style="background:#e6f4ea;color:#0b7a3e;font-size:11px;font-weight:700;padding:1px 7px;border-radius:9px;margin-left:6px">A {score.relevance}</span>
      <div style="color:#5f6b7a;font-style:italic;font-size:13px;margin-top:4px">{score.why}</div>
      <div style="color:#777;font-size:12px;margin-top:4px">{_meta_line(opp, score)}{budget}</div>
      {desc_html}
    </div>"""
		a_html = f"""
  <div style="margin:20px 0 6px;font-size:16px;font-weight:700;color:#0b57d0">🎯 Pursue — {len(a_items)} strong matches</div>
  {cards}"""

	# ── Tier B: compact rows ────────────────────────────────────
	b_html = ""
	if b_items:
		rows = ""
		for opp, score in b_items:
			url = str(opp.get("source_url") or opp.get("url") or "#")
			deadline = score.deadline_iso or str(opp.get("deadline") or "")
			rows += f"""
		<tr style="border-bottom:1px solid #eee">
		  <td style="padding:7px 8px"><a href="{url}" style="color:#1a73e8;text-decoration:none;font-size:13px">{opp.get("title", "Untitled")}</a></td>
		  <td style="padding:7px 8px;color:#666;font-size:12px;white-space:nowrap">{score.sector}</td>
		  <td style="padding:7px 8px;color:#666;font-size:12px">{opp.get("organization") or ""}</td>
		  <td style="padding:7px 8px;color:#666;font-size:12px;white-space:nowrap">{deadline}</td>
		</tr>"""
		b_html = f"""
  <div style="margin:24px 0 6px;font-size:15px;font-weight:700;color:#444">🔍 Worth reviewing — {len(b_items)}</div>
  <table style="width:100%;border-collapse:collapse">{rows}</table>"""

	# ── Tier C: long tail, grouped by source — EVERYTHING shows ─
	c_html = ""
	if c_items:
		from collections import defaultdict

		by_source: dict[str, list[tuple[dict, object]]] = defaultdict(list)
		for opp, score in c_items:
			src = str(opp.get("source", "unknown"))
			if src.startswith("searxng:"):
				src = "searxng"
			elif src.startswith("firecrawl:"):
				src = "firecrawl"
			by_source[src].append((opp, score))
		groups = ""
		for src in sorted(by_source, key=lambda s: -len(by_source[s])):
			lines = ""
			for opp, score in by_source[src]:
				url = str(opp.get("source_url") or opp.get("url") or "#")
				org = str(opp.get("organization") or _domain(url))
				lines += f'<div style="padding:2px 0"><a href="{url}" style="color:#7a8694;text-decoration:none">{opp.get("title", "Untitled")}</a><span style="color:#aab3bd"> · {org}</span></div>'
			groups += f"""
    <div style="margin:10px 0 2px;color:#8a949e;font-size:12px;font-weight:700">{src} ({len(by_source[src])})</div>
    <div style="font-size:11px;line-height:1.5">{lines}</div>"""
		c_html = f"""
  <div style="margin:24px 0 2px;font-size:14px;font-weight:700;color:#8a949e">📚 Long tail — {len(c_items)} (kept for completeness)</div>
  {groups}"""

	return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>DocuFusion Daily Digest — {date_str}</title></head>
<body style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:20px;color:#333">
  <div style="background:#0b57d0;color:white;padding:16px 20px;border-radius:6px 6px 0 0">
    <h2 style="margin:0">DocuFusion Opportunity Digest</h2>
    <p style="margin:4px 0 0;opacity:.85">{date_str} · A: {counts["a"]} pursue · B: {counts["b"]} review · C: {counts["c"]} long tail · {counts["junk"]} junk removed of {counts["total"]} crawled</p>
  </div>
  <div style="background:#f8f9fa;padding:16px;border-left:3px solid #0b57d0;margin:16px 0">
    <p style="margin:0;line-height:1.5">{summary}</p>
  </div>
  {closing_html}
  {a_html}
  {b_html}
  {c_html}
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;color:#999;font-size:11px">
    <p style="margin:0"><strong>Sources:</strong> {counts["breakdown"]}</p>
    <p style="margin:6px 0 0">Generated by <strong>DocuFusion</strong> · triage: {counts["triage_mode"]} ·
    <a href="https://ours.datacraft.systems" style="color:#1a73e8">View dashboard →</a></p>
  </div>
</body>
</html>"""


async def _summarise(opportunities: list[dict]) -> str:
	"""Generate a 2-sentence AI summary of today's opportunities."""
	import httpx

	litellm_url = os.environ.get("LITELLM_URL", "http://62.169.25.77:4000/v1").rstrip(
		"/"
	)
	litellm_api_key = (
		os.environ.get("LITELLM_API_KEY")
		or os.environ.get("LITELLM_KEY")
		or "sk-pjs-litellm-master-key"
	)
	litellm_model = os.environ.get("LLM_MODEL", "gpt-4o")

	def line(entry) -> str:
		if isinstance(entry, tuple):
			opp, score = entry
			why = f" — {score.why}" if getattr(score, "why", "") else ""
			return f"- {opp.get('title', '')}{why}"
		return f"- {entry.get('title', '')}"

	titles = "\n".join(line(e) for e in opportunities[:20])
	prompt = (
		"Write a 2-sentence executive summary of these new procurement opportunities "
		"discovered today. Focus on themes, sectors, and geographic coverage. "
		f"Be specific.\n\nOpportunities:\n{titles}"
	)
	try:
		async with httpx.AsyncClient(timeout=20) as c:
			r = await c.post(
				f"{litellm_url}/chat/completions",
				headers={"Authorization": f"Bearer {litellm_api_key}"},
				json={
					"model": litellm_model,
					"messages": [{"role": "user", "content": prompt}],
					"temperature": 0.3,
					"max_tokens": 150,
				},
			)
			if r.status_code >= 400:
				raise RuntimeError(f"LiteLLM returned {r.status_code}: {r.text[:200]}")
			body = r.json()
			choices = body.get("choices") or []
			if not choices:
				raise RuntimeError(f"LiteLLM response has no choices: {body}")
			return (choices[0].get("message") or {}).get("content", "").strip()
	except (KeyboardInterrupt, SystemExit):
		raise
	except Exception:
		_log.warning(
			"AI summary generation failed — using fallback text", exc_info=True
		)
		plain = [e[0] if isinstance(e, tuple) else e for e in opportunities]
		sources = set(o.get("source", "") for o in plain if o.get("source"))
		return (
			f"Today's digest contains {len(opportunities)} new procurement opportunities "
			f"from {len(sources)} sources. Review the listings below for deadlines and application details."
		)


def _send_email(to_email: str, to_name: str, subject: str, html: str) -> bool:
	"""Send via Stalwart SMTP using the existing EmailService config."""
	import smtplib
	from email.mime.multipart import MIMEMultipart
	from email.mime.text import MIMEText
	from docfusion.config.secrets import SecretsManager

	host = SecretsManager.get_smtp_host()
	port = SecretsManager.get_smtp_port()
	user = SecretsManager.get_smtp_user()
	password = SecretsManager.get_smtp_password()
	from_addr = SecretsManager.get_smtp_from_address()

	if not host or not from_addr:
		_log.warning("SMTP not configured — skipping email send")
		return False

	msg = MIMEMultipart("alternative")
	msg["Subject"] = subject
	msg["From"] = f"DocuFusion <{from_addr}>"
	msg["To"] = f"{to_name} <{to_email}>" if to_name else to_email
	msg.attach(MIMEText(html, "html", "utf-8"))

	try:
		with smtplib.SMTP(host, port, timeout=30) as smtp:
			smtp.ehlo()
			if port != 25:
				smtp.starttls()
			if user and password:
				smtp.login(user, password)
			smtp.sendmail(from_addr, [to_email], msg.as_string())
		_log.info("Digest email sent to %s", to_email)
		return True
	except Exception as exc:
		_log.error("SMTP send failed: %s", exc)
		return False


# ---------------------------------------------------------------------------
# Main digest logic
# ---------------------------------------------------------------------------


def _closing_soon(
	today: str,
	cache,
	profile_hash: str,
	today_hashes: set[str],
	days: int | None = None,
) -> list[tuple[dict, object]]:
	"""Resurface prior days' Tier A/B items whose deadlines are within `days`."""
	from .triage import url_hash_for

	days = days or int(os.environ.get("CLOSING_SOON_DAYS", "14"))
	today_dt = datetime.strptime(today, "%Y-%m-%d").replace(tzinfo=timezone.utc)
	horizon = today_dt + timedelta(days=days)
	results: list[tuple[dict, object]] = []
	seen: set[str] = set(today_hashes)

	for offset in range(1, days + 1):
		day = (today_dt - timedelta(days=offset)).strftime("%Y-%m-%d")
		day_path = STORAGE_DIR / f"{day}.json"
		if not day_path.exists():
			continue
		try:
			with day_path.open() as f:
				items: list[dict] = json.load(f)
		except Exception:
			continue
		for opp in items:
			h = url_hash_for(opp)
			if h in seen:
				continue
			score = cache.get(h, profile_hash, llm_available=False)
			if score is None or score.tier not in ("A", "B") or not score.deadline_iso:
				continue
			deadline_dt = _parse_deadline(score.deadline_iso)
			if deadline_dt is None or not (today_dt <= deadline_dt <= horizon):
				continue
			seen.add(h)
			results.append((opp, score))

	results.sort(key=lambda pair: pair[1].deadline_iso)
	return results[:15]


async def run_digest(
	date_str: str | None = None, to_email: str = "", to_name: str = ""
) -> int:
	"""Load opportunities for date, triage into tiers, email. Returns kept count."""
	from .triage import ScoreCache, load_profile, triage, url_hash_for

	today = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")
	path = STORAGE_DIR / f"{today}.json"

	if not path.exists():
		_log.warning("No opportunity file for %s — nothing to digest", today)
		return 0

	with path.open() as f:
		raw: list[dict] = json.load(f)

	if not raw:
		_log.info("Empty opportunity file for %s", today)
		return 0

	total_crawled = len(raw)
	_log.info("Loaded %d opportunities for %s", total_crawled, today)

	# Hard-reject ONLY definitive junk (no URL / wiki / dictionary / social).
	kept, junk = _split_junk(raw)
	_log.info(
		"Junk split: %d kept, %d definitive junk (%.0f%%)",
		len(kept),
		len(junk),
		100 * len(junk) / total_crawled if total_crawled else 0,
	)
	if not kept:
		_log.warning("All %d crawled items are junk — skipping digest", total_crawled)
		return 0

	# LLM triage — tiers everything, never drops. Kill-switch + failure fall
	# back to heuristic tiers so the email always sends.
	profile, profile_hash = load_profile()
	cache = ScoreCache(STORAGE_DIR / "scores")
	cache.load_recent()
	triage_mode = "llm"
	if os.environ.get("TRIAGE_ENABLED", "1") != "1":
		triage_mode = "heuristic"
		from .triage import heuristic_fallback

		scores = {url_hash_for(o): heuristic_fallback(o, profile_hash) for o in kept}
	else:
		try:
			scores = await triage(kept, profile, profile_hash, cache)
			if all(s.scored_by == "heuristic" for s in scores.values()):
				triage_mode = "heuristic"
		except (KeyboardInterrupt, SystemExit):
			raise
		except Exception:
			_log.error("Triage failed entirely — heuristic tiers", exc_info=True)
			from .triage import heuristic_fallback

			triage_mode = "heuristic"
			scores = {
				url_hash_for(o): heuristic_fallback(o, profile_hash) for o in kept
			}

	tiers: dict[str, list[tuple[dict, object]]] = {"A": [], "B": [], "C": []}
	for opp in kept:
		score = scores[url_hash_for(opp)]
		tiers[score.tier].append((opp, score))
	for tier_items in tiers.values():
		tier_items.sort(
			key=lambda pair: (-pair[1].relevance, pair[1].deadline_iso or "9999")
		)

	# Enrich Tier A descriptions (grants.gov synopsis) — bounded, non-fatal.
	try:
		from .enrich import enrich_tier_a

		enriched = await enrich_tier_a(tiers["A"], cache)
		if enriched:
			_log.info("Enriched %d Tier A items with synopses", enriched)
	except Exception:
		_log.warning("Tier A enrichment failed — continuing", exc_info=True)

	today_hashes = {url_hash_for(o) for o in kept}
	closing = _closing_soon(today, cache, profile_hash, today_hashes)

	counts = {
		"a": len(tiers["A"]),
		"b": len(tiers["B"]),
		"c": len(tiers["C"]),
		"junk": len(junk),
		"total": total_crawled,
		"breakdown": _source_breakdown(kept),
		"triage_mode": triage_mode,
	}
	_log.info(
		"Tiers: A=%d B=%d C=%d closing_soon=%d (triage=%s)",
		counts["a"],
		counts["b"],
		counts["c"],
		len(closing),
		triage_mode,
	)

	summary = await _summarise(tiers["A"] or kept)
	html = _html_tiered_digest(tiers, closing, today, summary, counts)

	recipients = [
		e.strip() for e in (to_email or DEFAULT_TO_EMAIL).split(",") if e.strip()
	]
	if not recipients:
		out = STORAGE_DIR / f"{today}-digest.html"
		out.write_text(html, encoding="utf-8")
		_log.info("No DIGEST_TO_EMAIL set — digest written to %s", out)
		return len(kept)

	sent = 0
	name = to_name or DEFAULT_TO_NAME
	subject = f"[DocuFusion] {counts['a']} to pursue · {len(kept)} total — {today}"
	for email in recipients:
		if _send_email(email, name, subject, html):
			sent += 1

	_log.info("Digest sent to %d/%d recipients", sent, len(recipients))
	return len(kept)


def main() -> int:
	logging.basicConfig(
		level=logging.INFO,
		format="%(asctime)s %(levelname)s %(name)s: %(message)s",
	)
	parser = argparse.ArgumentParser(description="Send daily opportunity digest email")
	parser.add_argument("--date", help="Date to digest (YYYY-MM-DD, defaults to today)")
	parser.add_argument(
		"--to", help="Recipient email (overrides DIGEST_TO_EMAIL env var)"
	)
	parser.add_argument("--name", help="Recipient name", default="")
	args = parser.parse_args()

	try:
		count = asyncio.run(run_digest(args.date, args.to or "", args.name))
		print(f"Digest complete: {count} opportunities sent")
		return 0
	except Exception as exc:
		_log.exception("Digest runner failed: %s", exc)
		return 1


if __name__ == "__main__":
	sys.exit(main())
