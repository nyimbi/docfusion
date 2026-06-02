"""Extract live tenders from UNGM using Firecrawl + Azure OpenAI."""
import asyncio
import httpx
import json
import re

AZURE_ENDPOINT = (
	"https://lindela.openai.azure.com/openai/deployments/gpt-4.1-mini"
	"/chat/completions?api-version=2024-02-15-preview"
)
AZURE_KEY = "1qTgOdaDaJUgfgkSllTJlmTptKNv2wdRpRHLoipIh2nWCWBP2qDaJQQJ99BLACYeBjFXJ3w3AAABACOGNs03"

SCRAPE_TARGETS = [
	("UNGM", "https://www.ungm.org/Public/Notice"),
	("UNDP procurement", "https://procurement-notices.undp.org/"),
	("WFP tenders", "https://www.wfp.org/procurement/food-procurement"),
	("African Development Bank", "https://www.afdb.org/en/projects-and-operations/procurement"),
	("Rwanda RPPA", "https://rppa.gov.rw/index.php/en/publicnotices"),
	("SA eTenders", "https://www.etenders.gov.za/content/advertised-tenders"),
]


async def scrape(client: httpx.AsyncClient, name: str, url: str) -> tuple[str, str]:
	try:
		r = await client.post(
			"http://84.247.181.100:3002/v1/scrape",
			json={"url": url, "formats": ["markdown"], "waitFor": 3000},
			timeout=35,
		)
		if r.status_code == 200 and r.json().get("success"):
			md = (r.json().get("data") or {}).get("markdown", "")
			return name, md
		return name, ""
	except Exception:
		return name, ""


async def extract(client: httpx.AsyncClient, portal: str, content: str) -> list[dict]:
	if len(content) < 200:
		return []
	prompt = (
		"Extract procurement tender/notice listings from this page.\n"
		"Return a JSON array: "
		'[{"title": str, "reference": str, "deadline": str, "organization": str, "country": str}]\n'
		"Return ONLY the JSON array, no other text. Extract up to 25 items.\n\n"
		f"Source: {portal}\n\nContent:\n{content[:5000]}"
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
		# Strip code fences
		raw = re.sub(r"```(?:json)?", "", raw).strip()
		parsed = json.loads(raw)
		return parsed if isinstance(parsed, list) else []
	except Exception as exc:
		return [{"_error": str(exc)[:80]}]


async def main() -> None:
	print("=" * 65)
	print("DocuFusion — Live Tender Discovery (Firecrawl + Azure OpenAI)")
	print("=" * 65)

	async with httpx.AsyncClient(timeout=40) as client:
		print("\n[1/2] Scraping tender listing pages...")
		scrape_results = await asyncio.gather(
			*[scrape(client, name, url) for name, url in SCRAPE_TARGETS]
		)
		for name, md in scrape_results:
			print(f"  {'✓' if md else '✗'} {name:<30} {len(md):>6} chars")

		print("\n[2/2] Extracting tender data via Azure OpenAI...")
		good = [(name, md) for name, md in scrape_results if len(md) >= 200]
		extract_results = await asyncio.gather(
			*[extract(client, name, md) for name, md in good]
		)

	print("\n" + "=" * 65)
	print("DISCOVERED TENDERS")
	print("=" * 65)
	total_valid = 0
	for (name, _), tenders in zip(good, extract_results):
		valid = [t for t in tenders if "_error" not in t]
		errors = [t for t in tenders if "_error" in t]
		total_valid += len(valid)
		print(f"\n{'─'*55}")
		print(f"  {name}  ({len(valid)} tenders)")
		print(f"{'─'*55}")
		for t in valid[:8]:
			title = str(t.get("title", "?"))[:68]
			org = t.get("organization", "")
			ref = t.get("reference", "")
			deadline = t.get("deadline", "")
			country = t.get("country", "")
			print(f"  • {title}")
			info = "  ".join(x for x in [org, ref, deadline, country] if x)
			if info:
				print(f"    {info}")
		if errors:
			print(f"  [error: {errors[0]['_error']}]")
		if len(valid) > 8:
			print(f"  ... and {len(valid) - 8} more")

	print(f"\n{'='*65}")
	print(f"  Total: {total_valid} tenders across {len(good)} portals")
	print(f"{'='*65}")


if __name__ == "__main__":
	asyncio.run(main())
