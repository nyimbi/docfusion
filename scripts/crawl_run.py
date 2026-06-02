"""
Live end-to-end tender discovery run.
Direct HTTP scraping + BeautifulSoup + Azure OpenAI extraction.
"""
import asyncio
import json
import re
import ssl
import httpx
from bs4 import BeautifulSoup

AZURE_ENDPOINT = (
	"https://lindela.openai.azure.com/openai/deployments/gpt-4.1-mini"
	"/chat/completions?api-version=2024-02-15-preview"
)
AZURE_KEY = "1qTgOdaDaJUgfgkSllTJlmTptKNv2wdRpRHLoipIh2nWCWBP2qDaJQQJ99BLACYeBjFXJ3w3AAABACOGNs03"

PORTALS = [
	("UNGM",        "https://www.ungm.org/Public/Notice",                  "en"),
	("Zambia ZPPA", "https://www.zppa.org.zm/",                            "en"),
	("Uganda PPDA", "https://www.ppda.go.ug/",                             "en"),
	("Rwanda RPPA", "https://www.rppa.gov.rw/",                            "en"),
	("Ethiopia PPA","https://www.ppa.gov.et/",                             "en"),
	("Botswana",    "https://www.ppadb.co.bw/",                            "en"),
	("Mauritius",   "https://www.publicprocurement.govmu.org/",            "en"),
	("Senegal",     "https://www.marchespublics.sn/",                      "fr"),
	("Morocco",     "https://www.marchespublics.gov.ma/",                  "fr"),
	("UNDP",        "https://procurement-notices.undp.org/",               "en"),
]

HEADERS = {
	"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0 Safari/537.36",
	"Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
	"Accept-Language": "en-US,en;q=0.5",
}


def clean_text(html: str, max_chars: int = 6000) -> str:
	"""Extract readable text from HTML, focused on tender-relevant content."""
	soup = BeautifulSoup(html, "html.parser")
	# Remove script/style/nav noise
	for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
		tag.decompose()
	text = soup.get_text(separator="\n", strip=True)
	# Collapse whitespace
	text = re.sub(r"\n{3,}", "\n\n", text)
	return text[:max_chars]


async def scrape(client: httpx.AsyncClient, name: str, url: str) -> tuple[str, str]:
	try:
		r = await client.get(url, headers=HEADERS, follow_redirects=True)
		if r.status_code == 200:
			return name, clean_text(r.text)
		return name, ""
	except Exception:
		return name, ""


async def extract(client: httpx.AsyncClient, portal: str, lang: str, content: str) -> list[dict]:
	if len(content) < 300:
		return []
	lang_note = " The page may be in French — translate titles to English." if lang == "fr" else ""
	prompt = (
		f"Extract up to 20 procurement/tender opportunities from this page content.{lang_note}\n"
		"Return ONLY a JSON array with objects: "
		"{\"title\": str, \"reference\": str, \"deadline\": str, "
		"\"organization\": str, \"country\": str, \"category\": str}\n\n"
		f"Source portal: {portal}\n\nContent:\n{content}"
	)
	try:
		r = await client.post(
			AZURE_ENDPOINT,
			headers={"api-key": AZURE_KEY},
			json={
				"messages": [{"role": "user", "content": prompt}],
				"temperature": 0.0,
				"max_tokens": 2000,
			},
			timeout=30,
		)
		raw = r.json()["choices"][0]["message"]["content"].strip()
		raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`")
		parsed = json.loads(raw)
		return parsed if isinstance(parsed, list) else []
	except Exception as exc:
		return [{"_error": str(exc)[:80]}]


async def main() -> None:
	print("=" * 68)
	print("DocuFusion Live Crawl — Direct HTTP + Azure OpenAI")
	print("=" * 68)

	# Use SSL context that tolerates old certs (some African govt sites)
	ssl_ctx = ssl.create_default_context()
	ssl_ctx.check_hostname = False
	ssl_ctx.verify_mode = ssl.CERT_NONE

	async with httpx.AsyncClient(timeout=20, verify=False) as client:
		print("\n[1/2] Scraping portals...")
		scrape_tasks = [scrape(client, name, url) for name, url, _ in PORTALS]
		scrape_results = await asyncio.gather(*scrape_tasks)
		for name, text in scrape_results:
			mark = "✓" if text else "✗"
			print(f"  {mark} {name:<25} {len(text):>7} chars")

		print("\n[2/2] Extracting tenders via Azure OpenAI...")
		langs = {name: lang for name, _, lang in PORTALS}
		good = [(name, text) for name, text in scrape_results if len(text) >= 300]
		extract_results = await asyncio.gather(
			*[extract(client, name, langs.get(name, "en"), text) for name, text in good]
		)

	all_tenders: list[dict] = []
	print("\n" + "=" * 68)
	print("RESULTS")
	print("=" * 68)
	for (name, _), tenders in zip(good, extract_results):
		valid = [t for t in tenders if "_error" not in t]
		errors = [t for t in tenders if "_error" in t]
		all_tenders.extend({"_source": name, **t} for t in valid)
		print(f"\n{'─'*60}")
		print(f"  {name}  ({len(valid)} tenders found)")
		print(f"{'─'*60}")
		for t in valid[:6]:
			title = str(t.get("title", "?"))[:70]
			parts = [t.get("organization",""), t.get("reference",""), t.get("deadline",""), t.get("country","")]
			meta = "  |  ".join(p for p in parts if p)
			print(f"  • {title}")
			if meta:
				print(f"    {meta}")
		if len(valid) > 6:
			print(f"  ... and {len(valid)-6} more")
		if errors:
			print(f"  [error: {errors[0]['_error']}]")

	print(f"\n{'='*68}")
	print(f"  TOTAL: {len(all_tenders)} tenders discovered across {len(good)} portals")
	categories: dict[str, int] = {}
	for t in all_tenders:
		cat = t.get("category", "general")
		categories[cat] = categories.get(cat, 0) + 1
	if categories:
		top = sorted(categories.items(), key=lambda x: -x[1])[:5]
		print(f"  Top categories: {', '.join(f'{c}({n})' for c,n in top)}")
	print(f"{'='*68}")

	# Save results
	with open("storage/discovery_results.json", "w") as f:
		json.dump(all_tenders, f, indent=2, default=str)
	print(f"  Saved to storage/discovery_results.json")


if __name__ == "__main__":
	asyncio.run(main())
