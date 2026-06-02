"""Debug: show raw scraped content and Azure response."""
import asyncio
import httpx
from bs4 import BeautifulSoup
import re
import json

AZURE_ENDPOINT = (
	"https://lindela.openai.azure.com/openai/deployments/gpt-4.1-mini"
	"/chat/completions?api-version=2024-02-15-preview"
)
AZURE_KEY = "1qTgOdaDaJUgfgkSllTJlmTptKNv2wdRpRHLoipIh2nWCWBP2qDaJQQJ99BLACYeBjFXJ3w3AAABACOGNs03"

HEADERS = {
	"User-Agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/121.0 Safari/537.36",
	"Accept": "text/html,*/*;q=0.8",
}


def clean_text(html: str, max_chars: int = 6000) -> str:
	soup = BeautifulSoup(html, "html.parser")
	for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
		tag.decompose()
	text = soup.get_text(separator="\n", strip=True)
	text = re.sub(r"\n{3,}", "\n\n", text)
	return text[:max_chars]


async def main() -> None:
	async with httpx.AsyncClient(timeout=25, verify=False) as c:
		# 1. Scrape UNGM
		print("=== Scraping UNGM ===")
		r = await c.get("https://www.ungm.org/Public/Notice", headers=HEADERS, follow_redirects=True)
		text = clean_text(r.text)
		print(f"Status: {r.status_code}  Cleaned chars: {len(text)}")
		print("--- first 800 chars ---")
		print(text[:800])

		# 2. Call Azure
		print("\n=== Azure extraction ===")
		prompt = (
			"Extract up to 10 procurement tenders from this text. "
			"Return ONLY a JSON array: "
			'[{"title": str, "reference": str, "deadline": str, "organization": str}]\n\n'
			+ text[:4000]
		)
		r2 = await c.post(
			AZURE_ENDPOINT,
			headers={"api-key": AZURE_KEY},
			json={
				"messages": [{"role": "user", "content": prompt}],
				"temperature": 0.0,
				"max_tokens": 1500,
			},
			timeout=30,
		)
		print(f"Azure status: {r2.status_code}")
		resp = r2.json()
		if "choices" in resp:
			content = resp["choices"][0]["message"]["content"]
			print("Azure response:", content[:600])
		else:
			print("Azure error response:", json.dumps(resp, indent=2)[:400])


if __name__ == "__main__":
	asyncio.run(main())
