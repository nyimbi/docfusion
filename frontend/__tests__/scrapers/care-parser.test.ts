import { describe, expect, it } from "vitest";

import { careParser } from "@/lib/scrapers/parsers/care";

const SOURCE_URL = "https://www.care.org/about-us/contact-us/request-for-proposals/";

describe("careParser", () => {
	it("extracts active CARE RFP entries and supporting documents", async () => {
		const result = await careParser.parse({
			url: SOURCE_URL,
			html: `
				<h2 class="title">Current opportunities</h2>
				<h3 class="title">Impact Market Growth Advisory Platform - Commercialization</h3>
				<p><strong>Description:</strong><br />CARE seeks to engage an FS-TA Commercialization Consultant.</p>
				<p><strong>Supporting documents:<br /></strong>
					<a href="https://www.care.org/wp-content/uploads/2099/04/SOW_IMGA_Platform.docx">Click here to view the SOW</a>
				</p>
				<p><strong>Tender submission deadline:</strong><br />May 5, 2099</p>
				<hr />
				<h3 class="title">Expired Vehicles Tender</h3>
				<p><strong>Description:</strong><br />Expired tender.</p>
				<p><strong>Tender submission deadline:</strong><br />May 8, 2020</p>
			`,
		});

		expect(result.opportunities).toHaveLength(1);
		expect(result.opportunities[0]).toEqual(expect.objectContaining({
			title: "Impact Market Growth Advisory Platform - Commercialization",
			source: "care",
			sourceId: "care-impact-market-growth-advisory-platform-commercialization",
			organization: "CARE",
			documentUrl: "https://www.care.org/wp-content/uploads/2099/04/SOW_IMGA_Platform.docx",
			rfpLink: "https://www.care.org/wp-content/uploads/2099/04/SOW_IMGA_Platform.docx",
			tags: ["care", "ngo", "source-scrape", "source-documents"],
		}));
		expect(result.opportunities[0]?.deadline).toEqual(new Date(2099, 4, 5));
		expect(result.opportunities[0]?.metadata?.care).toEqual(expect.objectContaining({
			documentLinks: [{
				url: "https://www.care.org/wp-content/uploads/2099/04/SOW_IMGA_Platform.docx",
				label: "Click here to view the SOW",
			}],
		}));
	});
});
