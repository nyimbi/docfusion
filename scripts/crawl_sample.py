"""Live crawl sample: test a representative slice of new sources."""
import asyncio
import json
import re
import httpx
from bs4 import BeautifulSoup
from datetime import datetime, timezone

AZURE_ENDPOINT = (
	"https://lindela.openai.azure.com/openai/deployments/gpt-4.1-mini"
	"/chat/completions?api-version=2024-02-15-preview"
)
AZURE_KEY = "1qTgOdaDaJUgfgkSllTJlmTptKNv2wdRpRHLoipIh2nWCWBP2qDaJQQJ99BLACYeBjFXJ3w3AAABACOGNs03"

# Representative sample across categories
SAMPLE = [
	# African sub-national
	("Lagos State Procurement",        "https://lagosprocurement.gov.ng/"),
	("Gauteng Province Tenders",       "https://www.gpg.gov.za/"),
	("Nairobi County",                 "https://www.nairobi.go.ke/"),
	# African parastatals
	("Eskom Suppliers",                "https://www.eskom.co.za/suppliers/"),
	("NNPC Tenders",                   "https://www.nnpcgroup.com/"),
	# African multilaterals
	("Africa CDC Procurement",         "https://africacdc.org/procurement/"),
	("UEMOA Tenders",                  "https://www.uemoa.int/fr/appels-offres"),
	("OMVS Senegal Basin",             "https://www.omvs.org/"),
	# Pacific
	("Papua New Guinea CSTB",          "https://cstb.gov.pg/"),
	("Fiji Procurement",               "https://www.govtender.gov.fj/"),
	("Pacific Community SPC",          "https://www.spc.int/about-us/procurement"),
	# Caribbean
	("Jamaica NCC",                    "https://www.ncc.gov.jm/"),
	("Caribbean Development Bank",     "https://www.caribank.org/business/procurement"),
	("Guyana NPTAB",                   "https://www.nptab.gov.gy/"),
	# Grant funders
	("Kellogg Foundation",             "https://www.wkkf.org/grants"),
	("AGRA Grants",                    "https://agra.org/"),
	("Tony Elumelu Foundation",        "https://www.tonyelumelufoundation.org/tef-programme/apply"),
	# English-speaking world
	("New Zealand GETS",               "https://www.gets.govt.nz/"),
	("India GeM",                      "https://gem.gov.in/"),
	("Philippines PhilGEPS",           "https://www.philgeps.gov.ph/"),
	# Latin America
	("Brazil ComprasNet",              "https://www.gov.br/compras/pt-br"),
	("Colombia SECOP",                 "https://www.colombiacompra.gov.co/"),
	("Chile ChileCompra",              "https://www.chilecompra.cl/"),
]

HEADERS = {
	"User-Agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/121.0 Safari/537.36",
	"Accept": "text/html,*/*;q=0.8",
}


def clean_text(html: str, max_chars: int = 4000) -> str:
	soup = BeautifulSoup(html, "html.parser")
	for tag in soup(["script", "style", "nav", "footer", "header"]):
		tag.decompose()
	text = re.sub(r"\n{3,}", "\n\n", soup.get_text(separator="\n", strip=True))
	return text[:max_chars]


async def probe(client: httpx.AsyncClient, name: str, url: str) -> dict:
	try:
		r = await client.get(url, headers=HEADERS, follow_redirects=True, timeout=12)
		text = clean_text(r.text) if r.status_code == 200 else ""
		return {"name": name, "url": url, "status": r.status_code, "chars": len(text), "text": text}
	except Exception as exc:
		return {"name": name, "url": url, "status": "ERR", "chars": 0, "text": "", "error": str(exc)[:60]}


async def extract(client: httpx.AsyncClient, name: str, content: str) -> list[dict]:
	if len(content) < 300:
		return []
	prompt = (
		f"Extract procurement tenders/grants from this page ({name}). "
		"Return ONLY a JSON array: "
		'[{"title": str, "reference": str, "deadline": str, "category": str}] '
		"max 8 items, or [] if no tenders found.\n\n" + content
	)
	try:
		r = await client.post(AZURE_ENDPOINT, headers={"api-key": AZURE_KEY},
			json={"messages": [{"role": "user", "content": prompt}],
				  "temperature": 0.0, "max_tokens": 800}, timeout=25)
		raw = re.sub(r"```(?:json)?", "", r.json()["choices"][0]["message"]["content"]).strip()
		parsed = json.loads(raw)
		return parsed if isinstance(parsed, list) else []
	except Exception:
		return []


async def main() -> None:
	print("=" * 70)
	print(f"DocuFusion Live Crawl Sample — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
	print(f"Testing {len(SAMPLE)} sources across 7 categories")
	print("=" * 70)

	async with httpx.AsyncClient(timeout=15, verify=False, follow_redirects=True) as client:
		print("\n[1/2] Probing sources...")
		probes = await asyncio.gather(*[probe(client, n, u) for n, u in SAMPLE])
		reachable = [p for p in probes if p["chars"] > 200]
		for p in probes:
			mark = "✓" if p["chars"] > 200 else "✗"
			print(f"  {mark} {p['name']:<35} {str(p['status']):<6} {p['chars']:>6} chars")

		print(f"\n  Reachable: {len(reachable)}/{len(SAMPLE)}")

		print("\n[2/2] Extracting opportunities...")
		extractions = await asyncio.gather(*[extract(client, p["name"], p["text"]) for p in reachable])

	all_opps: list[dict] = []
	print("\n" + "=" * 70)
	for p, tenders in zip(reachable, extractions):
		valid = [t for t in tenders if "error" not in t and t.get("title")]
		if not valid:
			continue
		all_opps.extend({"_source": p["name"], "_url": p["url"], **t} for t in valid)
		print(f"\n  {p['name']}  ({len(valid)} opportunities)")
		for t in valid[:4]:
			print(f"    • {str(t.get('title',''))[:70]}")
			meta = "  |  ".join(x for x in [t.get("reference",""), t.get("deadline",""), t.get("category","")] if x)
			if meta:
				print(f"      {meta}")

	print(f"\n{'='*70}")
	print(f"  TOTAL: {len(all_opps)} opportunities from {len(reachable)} reachable sources")
	print(f"{'='*70}")

	out = "storage/live_crawl_sample.json"
	with open(out, "w") as f:
		json.dump(all_opps, f, indent=2, default=str)
	print(f"  Saved → {out}")


if __name__ == "__main__":
	asyncio.run(main())
