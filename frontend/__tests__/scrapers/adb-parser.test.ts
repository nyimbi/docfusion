import { afterEach, describe, expect, it, vi } from "vitest";

import { adbParser } from "@/lib/scrapers/parsers/adb";

const institutionalNoticesHtml = `
<h2 class="h3 mb-1">Request for Proposal</h2>
<table>
<tbody>
<tr>
<td data-th="Title"><a href="/sites/default/files/page/559266/rfp-broad-commodities-precious-metals-20260527.pdf">Request for Proposal: Investment Manager Selection for Broad Commodities and Precious Metals Portfolio (Separately Managed Account or Commingled Fund Participation)</a><br><em>Deadline for Clarifications: 11 June 2026, 5:00 p.m. (Manila time)</em></td>
<td data-th="Start date">27 May 2026</td>
<td data-th="End date">3 July 2026, 5:00 p.m. (Manila time)</td>
</tr>
<tr>
<td data-th="Title"><a href="/sites/default/files/page/559266/rfp-emerging-market-debt.pdf">Request for Proposal: Investment Manager Selection for Emerging Market Debt &ndash; Hard Currency (USD) (Commingled Fund)</a></td>
<td data-th="Start date">6 May 2026</td>
<td data-th="End date">10 June 2026, 5:00 p.m. (Manila time)</td>
</tr>
</tbody>
</table>
<h2 class="h3 mb-1">Invitation to Bid</h2>
<table>
<tbody>
<tr>
<td data-th="Title"><a href="/sites/default/files/page/559266/itb-bau-climate-disaster-risk-analytics-explorer.pdf">Invitation to Bid: Climate &amp; Disaster Risk Analytics Explorer (Risk Explorer) - Managed Services Provider for BAU Support</a> | <a href="/sites/default/files/page/559266/bau-climate-disaster-risk-analytics-explorer-rfp-docs.zip">RFP Documents</a></td>
<td data-th="Start date">25 May 2026</td>
<td data-th="End date">8 June 2026, 5:00 p.m. (Manila time)</td>
</tr>
</tbody>
</table>
`;

describe("ADB institutional procurement parser", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("extracts current institutional RFP and bid rows with document links", async () => {
		const result = await adbParser.parse({
			url: "https://www.adb.org/business/institutional-procurement/notices",
			html: institutionalNoticesHtml,
			links: [],
		});

		expect(result.opportunities).toHaveLength(3);
		expect(result.opportunities[0]).toMatchObject({
			title: "Request for Proposal: Investment Manager Selection for Broad Commodities and Precious Metals Portfolio (Separately Managed Account or Commingled Fund Participation)",
			source: "adb",
			sourceId: "adb-rfp-broad-commodities-precious-metals-20260527",
			organization: "Asian Development Bank",
			countryRegion: "Global",
			category: "Request for Proposal",
			opportunityType: "rfp",
			portalUrl: "https://www.adb.org/business/institutional-procurement/notices",
			documentUrl: "https://www.adb.org/sites/default/files/page/559266/rfp-broad-commodities-precious-metals-20260527.pdf",
			rfpLink: "https://www.adb.org/sites/default/files/page/559266/rfp-broad-commodities-precious-metals-20260527.pdf",
			tags: ["adb", "development-bank", "institutional-procurement", "source-scrape"],
		});
		expect(result.opportunities[0]?.publishedDate).toEqual(new Date(2026, 4, 27));
		expect(result.opportunities[0]?.deadline).toEqual(new Date(2026, 6, 3));
		expect(result.opportunities[2]).toMatchObject({
			opportunityType: "tender",
			documentUrl: "https://www.adb.org/sites/default/files/page/559266/itb-bau-climate-disaster-risk-analytics-explorer.pdf",
		});
		expect(result.opportunities[2]?.metadata?.adb).toEqual(expect.objectContaining({
			documentLinks: [
				expect.objectContaining({
					url: "https://www.adb.org/sites/default/files/page/559266/itb-bau-climate-disaster-risk-analytics-explorer.pdf",
				}),
				expect.objectContaining({
					url: "https://www.adb.org/sites/default/files/page/559266/bau-climate-disaster-risk-analytics-explorer-rfp-docs.zip",
				}),
			],
		}));
	});

	it("falls back to direct static-page fetch when scraper content omits notice tables", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => institutionalNoticesHtml,
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await adbParser.parse({
			url: "https://www.adb.org/business/institutional-procurement/notices",
			html: "<html><body>Institutional Procurement Notices</body></html>",
			links: [],
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://www.adb.org/business/institutional-procurement/notices",
			expect.objectContaining({
				headers: expect.objectContaining({
					accept: "text/html,application/xhtml+xml",
				}),
			})
		);
		expect(result.opportunities).toHaveLength(3);
		expect(result.error).toBeUndefined();
	});
});
