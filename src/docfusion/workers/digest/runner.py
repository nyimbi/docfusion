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
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

_log = logging.getLogger(__name__)

STORAGE_DIR = Path(os.environ.get("OPPORTUNITY_STORAGE_DIR", "./storage/opportunities"))
DEFAULT_TO_EMAIL = os.environ.get("DIGEST_TO_EMAIL", "")
DEFAULT_TO_NAME = os.environ.get("DIGEST_TO_NAME", "Team")


# ---------------------------------------------------------------------------
# Quality filtering
# ---------------------------------------------------------------------------

BONUS_DOMAINS: frozenset[str] = frozenset({
	"ungm.org", "ted.europa.eu", "usaid.gov", "afdb.org", "adb.org",
	"iadb.org", "giz.de", "devex.com", "reliefweb.int", "phap.org",
	"mcc.gov", "ifc.org", "worldbank.org", "projects.worldbank.org",
	"undp.org", "unicef.org", "wfp.org", "fao.org", "who.int",
	"globalfund.org", "tenders.go.ke", "etenders.gov.za", "ppda.go.ug",
	"ppra.go.tz", "bpp.gov.ng", "ppa.gov.gh", "rppa.gov.rw",
	"unops.org", "grants.gov", "sam.gov", "reporter.nih.gov",
	"gatesfoundation.org", "rockefellerfoundation.org", "aiib.org",
})
TITLE_KEYWORDS: tuple[str, ...] = (
	"rfp", "tender", "procurement", "call for proposals",
	"bid", "grant", "consultancy", "services",
)
NEGATIVE_TITLE_KEYWORDS: tuple[str, ...] = (
	"wikipedia", "blog", "news", "article", "training course",
)
BUDGET_RE = re.compile(r"\$[\d,]+|\u20ac[\d,]+|\b(?:USD|EUR|GBP)\b", re.IGNORECASE)
STRUCTURED_SOURCES: tuple[str, ...] = (
	"grants.gov", "worldbank", "worldbank.org", "sam.gov",
	"ungm", "ungm.org", "afdb", "afdb.org", "ted.europa.eu",
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
	return bool(domain) and any(domain == d or domain.endswith("." + d) for d in BONUS_DOMAINS)


def _has_title_keyword(title_lc: str) -> bool:
	return any(keyword in title_lc for keyword in TITLE_KEYWORDS)


def _deadline_in_future(deadline: object) -> bool:
	raw = str(deadline or "").strip()
	if not raw:
		return False
	cleaned = raw.replace("Z", "+00:00")
	candidates = [cleaned]
	if "T" in cleaned:
		candidates.append(cleaned.split("T", 1)[0])
	for candidate in candidates:
		try:
			dt = datetime.fromisoformat(candidate)
			if dt.tzinfo is None:
				dt = dt.replace(tzinfo=timezone.utc)
			return dt > datetime.now(timezone.utc)
		except ValueError:
			pass
	for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%m/%d/%Y",
				"%d %b %Y", "%d %B %Y", "%B %d, %Y"):
		try:
			dt = datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
			return dt > datetime.now(timezone.utc)
		except ValueError:
			continue
	return False


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
	description = " ".join(str(opp.get(field) or "") for field in ("description", "summary"))
	source = str(opp.get("source") or "").lower()
	domain = _source_domain(opp)
	has_title_keyword = _has_title_keyword(title_lc)

	score = 0
	if _domain_in_bonus(domain):
		score += 3
	if has_title_keyword:
		score += 2
	if BUDGET_RE.search(description):
		score += 2
	if opp.get("deadline") and _deadline_in_future(opp.get("deadline")):
		score += 2
	if any(keyword in title_lc for keyword in NEGATIVE_TITLE_KEYWORDS):
		score -= 2
	if source.startswith("searxng:"):
		if not _domain_in_bonus(domain) and not has_title_keyword:
			score -= 3
	return score


def _filter_quality(opportunities: list[dict]) -> list[dict]:
	def is_actionable(opp: dict) -> bool:
		source = str(opp.get("source") or "").lower()
		domain = _source_domain(opp)
		score = _quality_score(opp)
		if _is_structured_source(opp, domain):
			return score >= 0
		if source.startswith("searxng:"):
			return score >= 1
		return score >= 1

	filtered = [o for o in opportunities if is_actionable(o)]
	filtered.sort(key=_quality_score, reverse=True)
	return filtered


SECTOR_KEYWORDS: dict[str, list[str]] = {
	"Health": ["health", "medical", "hospital", "pharmaceutical", "hiv", "malaria", "nutrition"],
	"Education": ["education", "school", "curriculum", "learning", "training", "capacity"],
	"Infrastructure": ["road", "bridge", "construction", "urban", "water", "sanitation", "wash"],
	"ICT & Digital": ["ict", "digital", "technology", "software", "data", "cyber"],
	"Agriculture": ["agriculture", "food security", "farm", "livestock", "crop"],
	"Governance": ["governance", "rule of law", "security", "justice", "public sector"],
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
	counts: Counter[str] = Counter(norm(o.get("source", "unknown")) for o in opportunities)
	return " · ".join(f"{src} ({n})" for src, n in counts.most_common())


def _html_digest(opportunities: list[dict], date_str: str, summary: str, total_crawled: int) -> str:
	rows = ""
	shown_opportunities = opportunities[:40]
	grouped: dict[str, list[dict]] = {sector: [] for sector in SECTOR_KEYWORDS}
	for opp in shown_opportunities:
		grouped[classify_sector(str(opp.get("title") or ""))].append(opp)

	row_number = 1
	for sector in SECTOR_KEYWORDS:
		sector_opportunities = grouped.get(sector) or []
		if not sector_opportunities:
			continue
		rows += f"""
		<tr>
		  <td colspan="2" style="padding:14px 4px 6px;color:#333;font-size:13px;font-weight:700">{sector}</td>
		</tr>"""
		for opp in sector_opportunities:
			title = str(opp.get("title") or "Untitled")
			source = str(opp.get("source") or "")
			# Normalise source label for display
			if source.startswith("firecrawl:"):
				source_label = source[len("firecrawl:"):]
			elif source.startswith("searxng:"):
				source_label = "web search"
			else:
				source_label = source
			url = str(opp.get("source_url") or opp.get("url") or "#")
			org = str(opp.get("organization") or "")
			deadline = str(opp.get("deadline") or "")
			reference = str(opp.get("reference") or "")
			ref_str = f"Ref: {reference}" if reference else ""
			meta_parts = [x for x in [source_label, org, deadline, ref_str] if x]
			meta = " · ".join(meta_parts)
			rows += f"""
		<tr style="border-bottom:1px solid #eee">
		  <td style="padding:8px 4px;color:#555;font-size:12px;vertical-align:top">{row_number}</td>
		  <td style="padding:8px">
		    <a href="{url}" style="color:#1a73e8;text-decoration:none;font-weight:500">{title}</a>
		    <div style="color:#777;font-size:12px;margin-top:3px">{meta}</div>
		  </td>
		</tr>"""
			row_number += 1

	breakdown = _source_breakdown(opportunities)
	shown = len(shown_opportunities)

	return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>DocuFusion Daily Digest — {date_str}</title></head>
<body style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:20px;color:#333">
  <div style="background:#1a73e8;color:white;padding:16px 20px;border-radius:6px 6px 0 0">
    <h2 style="margin:0">DocuFusion Opportunity Digest</h2>
    <p style="margin:4px 0 0;opacity:.85">{date_str} · {shown} opportunities (filtered from {total_crawled} crawled)</p>
  </div>
  <div style="background:#f8f9fa;padding:16px;border-left:3px solid #1a73e8;margin:16px 0">
    <p style="margin:0;line-height:1.5">{summary}</p>
  </div>
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:#f1f3f4">
        <th style="padding:8px 4px;text-align:left;font-size:12px;color:#666;width:28px">#</th>
        <th style="padding:8px;text-align:left;font-size:12px;color:#666">Opportunity · Source · Organization · Deadline</th>
      </tr>
    </thead>
    <tbody>{rows}</tbody>
  </table>
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;color:#999;font-size:11px">
    <p style="margin:0"><strong>Sources:</strong> {breakdown}</p>
    <p style="margin:6px 0 0">Generated by <strong>DocuFusion</strong> · {total_crawled} crawled → {shown} shown after quality filter ·
    <a href="https://ours.datacraft.systems" style="color:#1a73e8">View dashboard →</a></p>
  </div>
</body>
</html>"""


async def _summarise(opportunities: list[dict]) -> str:
	"""Generate a 2-sentence AI summary of today's opportunities."""
	import httpx
	litellm_url = os.environ.get("LITELLM_URL", "http://62.169.25.77:4000/v1").rstrip("/")
	litellm_api_key = (
		os.environ.get("LITELLM_API_KEY")
		or os.environ.get("LITELLM_KEY")
		or "sk-pjs-litellm-master-key"
	)
	litellm_model = os.environ.get("LLM_MODEL", "gpt-4o")
	titles = "\n".join(f"- {o.get('title','')}" for o in opportunities[:20])
	prompt = (
		"Write a 2-sentence executive summary of these new procurement opportunities "
		"discovered today. Focus on themes, sectors, and geographic coverage. "
		f"Be specific.\n\nOpportunities:\n{titles}"
	)
	try:
		async with httpx.AsyncClient(timeout=20) as c:
			r = await c.post(f"{litellm_url}/chat/completions", headers={"Authorization": f"Bearer {litellm_api_key}"},
				json={"model": litellm_model, "messages": [{"role": "user", "content": prompt}],
					  "temperature": 0.3, "max_tokens": 150})
			return r.json()["choices"][0]["message"]["content"].strip()
	except (KeyboardInterrupt, SystemExit):
		raise
	except Exception:
		_log.warning("AI summary generation failed — using fallback text", exc_info=True)
		sources = set(o.get("source", "") for o in opportunities if o.get("source"))
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

async def run_digest(date_str: str | None = None, to_email: str = "", to_name: str = "") -> int:
	"""Load opportunities for date, quality-filter, summarise, email. Returns count sent."""
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

	# Drop noise: Wikipedia articles, dictionary entries, blank-field SearXNG hits, etc.
	opportunities = _filter_quality(raw)
	dropped = total_crawled - len(opportunities)
	_log.info(
		"Quality filter: %d kept, %d dropped (%.0f%% noise removed)",
		len(opportunities), dropped,
		100 * dropped / total_crawled if total_crawled else 0,
	)

	if not opportunities:
		_log.warning("All %d crawled items failed quality filter — skipping digest", total_crawled)
		return 0

	summary = await _summarise(opportunities)
	html = _html_digest(opportunities, today, summary, total_crawled)

	recipients = [e.strip() for e in (to_email or DEFAULT_TO_EMAIL).split(",") if e.strip()]
	if not recipients:
		out = STORAGE_DIR / f"{today}-digest.html"
		out.write_text(html, encoding="utf-8")
		_log.info("No DIGEST_TO_EMAIL set — digest written to %s", out)
		return len(opportunities)

	sent = 0
	name = to_name or DEFAULT_TO_NAME
	shown = min(len(opportunities), 40)
	subject = f"[DocuFusion] {shown} opportunities — {today}"
	for email in recipients:
		if _send_email(email, name, subject, html):
			sent += 1

	_log.info("Digest sent to %d/%d recipients", sent, len(recipients))
	return len(opportunities)


def main() -> int:
	logging.basicConfig(
		level=logging.INFO,
		format="%(asctime)s %(levelname)s %(name)s: %(message)s",
	)
	parser = argparse.ArgumentParser(description="Send daily opportunity digest email")
	parser.add_argument("--date", help="Date to digest (YYYY-MM-DD, defaults to today)")
	parser.add_argument("--to", help="Recipient email (overrides DIGEST_TO_EMAIL env var)")
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
