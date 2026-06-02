"""
Live procurement discovery via confirmed JSON APIs.
"""
import asyncio
import json
import httpx
from datetime import datetime

HEADERS = {
	"User-Agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/121.0 Safari/537.36",
	"Accept": "application/json,*/*",
}

API_SOURCES = [
	# ── USA Federal ──────────────────────────────────────────────────────
	{
		"name": "grants.gov (US Federal Grants)",
		"method": "POST",
		"url": "https://apply07.grants.gov/grantsws/rest/opportunities/search/",
		"body": {"keyword": "", "oppStatuses": "posted", "rows": 25, "startRecordNum": 0},
		"list_key": "oppHits",
		"title_key": "title",
		"deadline_key": "closeDate",
		"ref_key": "number",
		"org_key": "agency",
	},
	{
		"name": "SAM.gov Opportunities (US Federal)",
		"method": "GET",
		"url": "https://api.sam.gov/opportunities/v2/search",
		"params": {"limit": 20, "postedFrom": "01/01/2025", "postedTo": "12/31/2025", "ptype": "o,k,u,r,s,g,a,i", "api_key": "DEMO_KEY"},
		"list_key": "opportunitiesData",
		"title_key": "title",
		"deadline_key": "responseDeadLine",
		"ref_key": "noticeId",
		"org_key": "organizationName",
	},
	# ── World Bank ────────────────────────────────────────────────────────
	{
		"name": "World Bank Projects (active)",
		"method": "GET",
		"url": "https://search.worldbank.org/api/v2/projects",
		"params": {
			"fl": "id,project_name,boardapprovaldate,countryname,sector_exact,status",
			"fq": "regionname_exact:(\"Africa\") AND status:(\"Active\")",
			"rows": 25,
			"format": "json",
		},
		"list_key": "projects",
		"title_key": "project_name",
		"deadline_key": "boardapprovaldate",
		"ref_key": "id",
		"org_key": "countryname",
	},
	# ── UN / Multilateral ─────────────────────────────────────────────────
	{
		"name": "ReliefWeb Reports (UN/NGO)",
		"method": "GET",
		"url": "https://api.reliefweb.int/v1/reports",
		"params": {
			"appname": "docfusion-discovery",
			"fields[include][]": ["title", "date", "source.name", "country.name"],
			"filter[field]": "theme.name",
			"filter[value]": "Procurement",
			"limit": 20,
			"sort[]": "date:desc",
		},
		"list_key": "data",
		"title_key": "fields.title",
		"deadline_key": "fields.date.created",
		"ref_key": "id",
		"org_key": "fields.source.0.name",
	},
	{
		"name": "USAid (Development.gov grants)",
		"method": "GET",
		"url": "https://www.usaid.gov/sites/default/files/opportunities.json",
		"params": {},
		"list_key": "items",
		"title_key": "title",
		"deadline_key": "closeDate",
		"ref_key": "referenceNumber",
		"org_key": "organization",
	},
	# ── UK / EU ───────────────────────────────────────────────────────────
	{
		"name": "Find a Tender (UK Gov)",
		"method": "GET",
		"url": "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages",
		"params": {"publishedFrom": "2025-01-01", "limit": 20},
		"list_key": "releases",
		"title_key": "tender.title",
		"deadline_key": "tender.tenderPeriod.endDate",
		"ref_key": "id",
		"org_key": "buyer.name",
	},
]


def get_nested(obj: object, dotted_key: str) -> object:
	"""Navigate a dotted path; return raw object (not stringified)."""
	for part in dotted_key.split("."):
		if isinstance(obj, dict):
			obj = obj.get(part)
		elif isinstance(obj, list):
			try:
				obj = obj[int(part)]
			except Exception:
				return None
		else:
			return None
	return obj


def get_str(obj: object, dotted_key: str) -> str:
	return str(get_nested(obj, dotted_key) or "")


async def fetch(client: httpx.AsyncClient, src: dict) -> tuple[str, list[dict]]:
	name = src["name"]
	try:
		if src["method"] == "POST":
			r = await client.post(src["url"], json=src.get("body"), headers=HEADERS)
		else:
			r = await client.get(src["url"], params=src.get("params"), headers=HEADERS)
		if r.status_code != 200:
			return name, [{"_error": f"HTTP {r.status_code}"}]
		data = r.json()
		raw = get_nested(data, src["list_key"])
		# World Bank projects is a dict-of-dicts keyed by project ID
		if isinstance(raw, dict):
			items: list = list(raw.values())
		elif isinstance(raw, list):
			items = raw
		else:
			return name, [{"_error": f"list_key '{src['list_key']}' returned {type(raw).__name__}: {str(data)[:80]}"}]
		tenders = []
		for item in items[:25]:
			tenders.append({
				"title": (get_str(item, src["title_key"]) or "?")[:80],
				"deadline": get_str(item, src["deadline_key"]),
				"reference": get_str(item, src["ref_key"]),
				"organization": get_str(item, src["org_key"]),
				"_source": name,
			})
		return name, tenders
	except Exception as exc:
		return name, [{"_error": str(exc)[:80]}]


async def main() -> None:
	print("=" * 68)
	print("DocuFusion — Live Procurement API Discovery")
	print(f"Timestamp: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
	print("=" * 68)

	async with httpx.AsyncClient(timeout=20, verify=False, follow_redirects=True) as client:
		results = await asyncio.gather(*[fetch(client, s) for s in API_SOURCES])

	all_tenders: list[dict] = []
	for name, tenders in results:
		valid = [t for t in tenders if "_error" not in t]
		errors = [t for t in tenders if "_error" in t]
		all_tenders.extend(valid)
		print(f"\n{'─'*60}")
		print(f"  {name}  ({len(valid)} tenders)")
		print(f"{'─'*60}")
		for t in valid[:6]:
			print(f"  • {t['title']}")
			meta = "  |  ".join(x for x in [t["organization"], t["reference"], t["deadline"]] if x)
			if meta:
				print(f"    {meta}")
		if len(valid) > 6:
			print(f"  ... and {len(valid)-6} more")
		if errors:
			print(f"  [error: {errors[0]['_error']}]")

	print(f"\n{'='*68}")
	print(f"  TOTAL: {len(all_tenders)} tenders across {sum(1 for _, t in results if any('_error' not in x for x in t))} sources")
	print(f"{'='*68}")

	with open("storage/api_discovery_results.json", "w") as f:
		json.dump(all_tenders, f, indent=2, default=str)
	print(f"  Saved → storage/api_discovery_results.json")


if __name__ == "__main__":
	asyncio.run(main())
