import { describe, expect, it } from "vitest";

import { dgmarketParser } from "@/lib/scrapers/parsers/dgmarket";

describe("DGMarket parser", () => {
	it("extracts rendered DGMarket notice rows from browser fallback HTML", async () => {
		const result = await dgmarketParser.parse({
			url: "https://www.dgmarket.com",
			markdown: "",
			html: `
				<table class="list_notice_table" width="100%" cellpadding="0" cellspacing="10px">
					<tbody>
						<tr class="one">
							<td width="80%">
								<input type="hidden" name="noticeId" value="108981643">
								<div class="ln_notice_title">
									<a href="/tender/108981643">Supply and installation of education data platform</a>
								</div>
								<p>
									<span class="ln_title country_icon">Country:&nbsp;</span>
									<span class="ln_listing">
										<a href="/tenders/list.do?sub=tenders-in-Kenya&amp;locationISO=ke">Kenya</a>
									</span>
								</p>
								<p>
									<span class="ln_title type_icon">Type:</span>
									<span class="ln_listing">Request for Proposals</span>
								</p>
							</td>
							<td width="15%">
								<div class="ln_title2">Published</div>
								<div class="ln_date">May 26, 2026</div>
								<div class="ln_title2">Deadline</div>
								<div class="ln_deadline">Jun 15, 2026</div>
							</td>
						</tr>
					</tbody>
				</table>
			`,
			links: [],
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "Supply and installation of education data platform",
				source: "dgmarket",
				sourceId: "108981643",
				noticeId: "dgm-108981643",
				organization: "DGMarket",
				portalUrl: "https://www.dgmarket.com/tender/108981643",
				documentUrl: "https://www.dgmarket.com/tender/108981643",
				countryRegion: "Kenya",
				category: "Request for Proposals",
				opportunityType: "tender",
				tags: ["dgmarket", "global-procurement"],
			}),
		]);
		expect(result.opportunities[0].publishedDate).toEqual(new Date(2026, 4, 26));
		expect(result.opportunities[0].deadline).toEqual(new Date(2026, 5, 15));
	});

	it("preserves notice links from markdown tables", async () => {
		const result = await dgmarketParser.parse({
			url: "https://www.dgmarket.com",
			markdown: [
				"| Title | Organization | Country | Deadline |",
				"| --- | --- | --- | --- |",
				"| [Design and implementation of national e-procurement portal](/tender/108981700) | Ministry of Finance | Rwanda | 2026-06-30 |",
			].join("\n"),
			links: [],
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "Design and implementation of national e-procurement portal",
				source: "dgmarket",
				organization: "Ministry of Finance",
				countryRegion: "Rwanda",
				portalUrl: "https://www.dgmarket.com/tender/108981700",
				documentUrl: "https://www.dgmarket.com/tender/108981700",
				noticeId: "dgm-108981700",
			}),
		]);
		expect(result.opportunities[0].deadline).toEqual(new Date(2026, 5, 30));
	});

	it("ignores category navigation links while accepting notice links", async () => {
		const result = await dgmarketParser.parse({
			url: "https://www.dgmarket.com",
			markdown: [
				"[Government procurement](/tenders/list.do)",
				"[Agriculture and Food](/tenders/list.do?sub=1)",
				"[Data center expansion tender](/tender/108981701)",
			].join("\n"),
			links: [],
		});

		expect(result.opportunities.map((opportunity) => opportunity.title)).toEqual([
			"Data center expansion tender",
		]);
	});
});
