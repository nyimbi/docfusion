"""Probe API responses to find correct field names."""
import asyncio
import httpx
import json

HEADERS = {"User-Agent": "Mozilla/5.0 Chrome/121.0 Safari/537.36", "Accept": "application/json"}


async def probe(client: httpx.AsyncClient, name: str, url: str, method: str = "GET",
				params: dict | None = None, body: dict | None = None) -> None:
	print(f"\n{'='*55}")
	print(f"  {name}")
	print(f"  {url}")
	print(f"{'='*55}")
	try:
		if method == "GET":
			r = await client.get(url, params=params, headers=HEADERS)
		else:
			r = await client.post(url, json=body, headers=HEADERS)
		print(f"  HTTP {r.status_code}")
		if r.status_code == 200:
			data = r.json()
			# Show top-level keys and first item structure
			if isinstance(data, dict):
				print(f"  Top keys: {list(data.keys())[:8]}")
				for key, val in data.items():
					if isinstance(val, list) and val:
						print(f"  '{key}' list first item keys: {list(val[0].keys())[:10] if isinstance(val[0], dict) else type(val[0])}")
						print(f"  First item sample: {json.dumps(val[0], default=str)[:300]}")
						break
			elif isinstance(data, list) and data:
				print(f"  Array, first item keys: {list(data[0].keys())[:10] if isinstance(data[0], dict) else type(data[0])}")
				print(f"  First item: {json.dumps(data[0], default=str)[:300]}")
		else:
			print(f"  Body: {r.text[:200]}")
	except Exception as e:
		print(f"  ERROR: {e}")


async def main() -> None:
	async with httpx.AsyncClient(timeout=20, verify=False, follow_redirects=True) as c:
		# Fix grants.gov title key
		await probe(c, "grants.gov", "https://apply07.grants.gov/grantsws/rest/opportunities/search/",
					"POST", body={"keyword": "Africa", "oppStatuses": "posted", "rows": 3, "startRecordNum": 0})

		# Try correct World Bank API
		await probe(c, "World Bank Projects",
					"https://search.worldbank.org/api/v2/projects",
					params={"fl": "id,project_name,boardapprovaldate,countryname", "rows": 5, "format": "json"})

		# ADB API
		await probe(c, "ADB Tenders",
					"https://www.adb.org/api/procurementnotices?page=1&page_size=10")

		# UNGM with follow redirects
		await probe(c, "UNGM Public Notices",
					"https://www.ungm.org/Public/Notice?pageIndex=0&pageSize=10&format=json")

		# EU TED API
		await probe(c, "EU TED API",
					"https://ted.europa.eu/api/v3.0/notices/search",
					params={"fields": "ND,TY,PD,DT,AU,CY,TI", "query": "procurement", "page": 1, "limit": 5})


if __name__ == "__main__":
	asyncio.run(main())
