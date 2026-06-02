"""End-to-end crawl test: Firecrawl scrape + LiteLLM tender extraction."""
import asyncio
import json
import re
import httpx

AZURE_ENDPOINT = "https://lindela.openai.azure.com/openai/deployments/gpt-4.1-mini/chat/completions?api-version=2024-02-15-preview"
AZURE_KEY = "1qTgOdaDaJUgfgkSllTJlmTptKNv2wdRpRHLoipIh2nWCWBP2qDaJQQJ99BLACYeBjFXJ3w3AAABACOGNs03"
FIRECRAWL = "http://84.247.181.100:3002/v1/scrape"

PORTALS = [
	("Rwanda RPPA", "https://www.rppa.gov.rw/"),
	("UNGM", "https://www.ungm.org/"),
	("Zambia ZPPA", "https://www.zppa.org.zm/"),
	("Senegal DGMP", "https://www.marchespublics.sn/"),
	("Morocco", "https://www.marchespublics.gov.ma/"),
	("Ethiopia PPA", "https://www.ppa.gov.et/"),
]


async def scrape(client: httpx.AsyncClient, name: str, url: str) -> tuple[str, str]:
	try:
		r = await client.post(
			FIRECRAWL,
			json={"url": url, "formats": ["markdown"], "waitFor": 3000},
			timeout=35,
		)
		if r.status_code == 200 and r.json().get("success"):
			md = (r.json().get("data") or {}).get("markdown", "")
			return name, md[:4000]
		return name, ""
	except Exception as exc:
		return name, ""


async def extract_tenders(client: httpx.AsyncClient, portal: str, content: str) -> list[dict]:
	if not content.strip():
		return []
	prompt = (
		"Extract all tender/procurement opportunities from this page content. "
		"Return a JSON array of objects with keys: title, deadline, reference, category. "
		"Return ONLY the JSON array.\n\n"
		f"Source: {portal}\n\nContent:\n{content}"
	)
	try:
		r = await client.post(
			AZURE_ENDPOINT,
			headers={"api-key": AZURE_KEY},
			json={
				"messages": [{"role": "user", "content": prompt}],
				"temperature": 0.1,
				"max_tokens": 1200,
			},
			timeout=30,
		)
		if r.status_code != 200:
			return [{"error": f"LiteLLM HTTP {r.status_code}"}]
		raw = r.json()["choices"][0]["message"]["content"].strip()
		# Strip markdown code fences if present
		raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
		parsed = json.loads(raw)
		return parsed if isinstance(parsed, list) else []
	except Exception as exc:
		return [{"error": str(exc)[:80]}]


async def main() -> None:
	print("=" * 65)
	print("DocuFusion end-to-end crawl test")
	print("=" * 65)

	async with httpx.AsyncClient(timeout=40) as client:
		# Phase 1: scrape all portals in parallel
		print("\n[1/2] Scraping portals via Firecrawl...")
		scrape_results = await asyncio.gather(
			*[scrape(client, name, url) for name, url in PORTALS]
		)
		scraped = {name: md for name, md in scrape_results if md}
		print(f"  Scraped {len(scraped)}/{len(PORTALS)} portals successfully")
		for name, md in scrape_results:
			status = f"{len(md):>6} chars" if md else "  FAILED"
			print(f"    {'✓' if md else '✗'} {name:<25} {status}")

		# Phase 2: extract tenders from scraped content in parallel
		print("\n[2/2] Extracting tenders via LiteLLM (gpt-4o-mini)...")
		extract_tasks = [
			extract_tenders(client, name, md)
			for name, md in scrape_results
			if md
		]
		extract_names = [name for name, md in scrape_results if md]
		extraction_results = await asyncio.gather(*extract_tasks)

	# Report
	print("\n" + "=" * 65)
	print("RESULTS")
	print("=" * 65)
	total = 0
	for name, tenders in zip(extract_names, extraction_results):
		errors = [t for t in tenders if "error" in t]
		valid = [t for t in tenders if "error" not in t]
		total += len(valid)
		print(f"\n{'─' * 55}")
		print(f"  {name}  ({len(valid)} tenders)")
		print(f"{'─' * 55}")
		for t in valid[:5]:
			print(f"  • {str(t.get('title', '?'))[:70]}")
			deadline = t.get("deadline", "")
			ref = t.get("reference", "")
			if deadline:
				print(f"    Deadline: {deadline}")
			if ref:
				print(f"    Ref: {ref}")
		if errors:
			print(f"  [extraction error: {errors[0]['error']}]")

	print(f"\n{'=' * 65}")
	print(f"  Total tenders discovered: {total} across {len(extract_names)} portals")
	print(f"{'=' * 65}")


if __name__ == "__main__":
	asyncio.run(main())
