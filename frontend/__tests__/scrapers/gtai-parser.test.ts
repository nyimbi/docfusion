import { describe, expect, it } from "vitest";

import { gtaiParser } from "@/lib/scrapers/parsers/gtai";

const SOURCE_URL = "https://www.gtai.de/en/meta/search/kfw-tenders/795748!search";

describe("GTAI KfW parser", () => {
	it("extracts active KfW tender search results and skips closed notices", async () => {
		const result = await gtaiParser.parse({
			url: SOURCE_URL,
			html: `
				<div class="search-result">
					<span>Tender Award </span>
					<a class="" href="/en/trade/cote-d-ivoire/tenders/consulting-design-and-construction-supervision-of-solar-power-station-1788968" title="Link to Event">
						<h3>Consulting, Design and Construction Supervision of Solar Power Station</h3>
					</a>
					<p class="excerpt">Award notice.</p>
				</div>
				<div class="search-result">
					<span>Tender Notice </span>
					<a class="overline__link" href="/en/trade/tenders/construction-management-of-water-resources-and-sanitation-rehabilitation-of-water-treatment-plants--2001114!saveUserDocument">store page</a>
					<a class="" href="/en/trade/zambia/tenders/construction-management-of-water-resources-and-sanitation-rehabilitation-of-water-treatment-plants--2001114" title="Link to Event">
						<h3>Construction, Management of Water Resources and Sanitation (Rehabilitation of Water Treatment Plants)</h3>
					</a>
					<p>KfW Entwicklungsbank</p>
					<p class="excerpt">Project: rehabilitation of water treatment plants and consulting support.</p>
					<a class="country" href="/en/meta/search/66080!search">Zambia</a>
				</div>
				<a href="/en/meta/search/kfw-tenders/795748!search?page=1" title=" Next page"> Next page</a>
			`,
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "Construction, Management of Water Resources and Sanitation (Rehabilitation of Water Treatment Plants)",
				source: "gtai_kfw",
				sourceId: "gtai-kfw-2001114",
				organization: "GTAI / KfW Entwicklungsbank",
				countryRegion: "Zambia",
				opportunityType: "tender",
				portalUrl: "https://www.gtai.de/en/trade/zambia/tenders/construction-management-of-water-resources-and-sanitation-rehabilitation-of-water-treatment-plants--2001114",
				documentUrl: "https://www.gtai.de/en/trade/zambia/tenders/construction-management-of-water-resources-and-sanitation-rehabilitation-of-water-treatment-plants--2001114",
				projectSummary: "Project: rehabilitation of water treatment plants and consulting support.",
			}),
		]);
		expect(result.nextPageUrl).toBe("https://www.gtai.de/en/meta/search/kfw-tenders/795748!search?page=1");
	});

	it("maps pagination to GTAI's zero-based search page parameter", () => {
		expect(gtaiParser.getPageUrl(SOURCE_URL, 1)).toBe(SOURCE_URL);
		expect(gtaiParser.getPageUrl(SOURCE_URL, 2)).toBe(`${SOURCE_URL}?page=1`);
	});
});
