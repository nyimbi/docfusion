import { describe, expect, it } from "vitest";

import { tetraTechIntdevParser } from "@/lib/scrapers/parsers/tetra-tech-intdev";

const SOURCE_URL = "https://intdev.tetratech.com.au/partner-with-us/";

describe("Tetra Tech International Development parser", () => {
	it("extracts active accordion tenders with document links", async () => {
		const result = await tetraTechIntdevParser.parse({
			url: SOURCE_URL,
			html: `
				<div class="elementor-accordion-item">
					<a class="elementor-accordion-title">RFP - Expired Video Production</a>
					<div id="elementor-tab-content-1" class="elementor-tab-content">
						<p>Closing Date and Time: Monday 31 May 2000 at 3:00pm</p>
						<p><a href="/wp-content/uploads/expired.pdf">RFP document</a></p>
					</div>
				</div>
				<div class="elementor-accordion-item">
					<a class="elementor-accordion-title">Strategic Border Management - Request for Tender</a>
					<div id="elementor-tab-content-2" class="elementor-tab-content">
						<p>Closing Date and Time: Tuesday 23 June 2099 at 4:00pm AEST</p>
						<p><a href="/wp-content/uploads/strategic-border-management-rft.pdf">RFT document [PDF]</a></p>
						<p><a href="/wp-content/uploads/strategic-border-management-budget.xlsx">Budget template</a></p>
					</div>
				</div>
			`,
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "Strategic Border Management - Request for Tender",
				source: "tetra_tech_intdev",
				sourceId: "tetra-tech-intdev-strategic-border-management-request-for-tender",
				organization: "Tetra Tech International Development",
				countryRegion: "Asia-Pacific / Indo-Pacific",
				opportunityType: "tender",
				portalUrl: SOURCE_URL,
				documentUrl: "https://intdev.tetratech.com.au/wp-content/uploads/strategic-border-management-rft.pdf",
				rfpLink: "https://intdev.tetratech.com.au/wp-content/uploads/strategic-border-management-rft.pdf",
				tags: expect.arrayContaining(["tetra-tech-intdev", "source-documents"]),
			}),
		]);
		expect(result.opportunities[0]?.deadline).toEqual(new Date("2099-06-23T00:00:00.000Z"));
	});
});
