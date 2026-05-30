import { describe, expect, it } from "vitest";

import { saveChildrenParser } from "@/lib/scrapers/parsers/save-children";

describe("Save the Children parser", () => {
	it("extracts tender cards with detail pages as source documents", async () => {
		const result = await saveChildrenParser.parse({
			url: "https://www.savethechildren.net/tenders",
			html: `
				<div class="views-row">
					<div class="three_col-listing-card">
						<h3 class="three_col-listing-card__h3">Lebanon Country Office - Tender for Drinking Water Treatment Station</h3>
						<div class="three_col-listing-card__description">
							<p>Save the Children International in Lebanon is inviting submissions of tenders for water treatment station services.</p>
						</div>
						<div class="three_col-listing-card__table">
							<div class="three_col-listing-card__start-date table-item">14 May 2026</div>
							<div class="three_col-listing-card__end-date table-item">15 Jun 2026 - 16:00 UTC</div>
							<div class="three_col-listing-card__country table-item">Lebanon</div>
							<div class="three_col-listing-card__type table-item">Tender Reference: FWA/WAS/LEB/LHO/2026/002</div>
						</div>
						<div class="three_col-listing-card__link">
							<a href="/tenders/lebanon-country-office-tender-drinking-water-treatment-station">Read More</a>
						</div>
					</div>
				</div>
			`,
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "Lebanon Country Office - Tender for Drinking Water Treatment Station",
				source: "save_children",
				sourceId: "save-children-lebanon-country-office-tender-drinking-water-treatment-station",
				organization: "Save the Children International",
				countryRegion: "Lebanon",
				opportunityType: "tender",
				portalUrl: "https://www.savethechildren.net/tenders/lebanon-country-office-tender-drinking-water-treatment-station",
				documentUrl: "https://www.savethechildren.net/tenders/lebanon-country-office-tender-drinking-water-treatment-station",
				rfpLink: "https://www.savethechildren.net/tenders/lebanon-country-office-tender-drinking-water-treatment-station",
			}),
		]);
		expect(result.opportunities[0]).not.toHaveProperty("noticeId");
		expect(result.opportunities[0]?.deadline).toBeInstanceOf(Date);
	});
});
