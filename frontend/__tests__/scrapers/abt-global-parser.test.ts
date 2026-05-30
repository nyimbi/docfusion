import { describe, expect, it } from "vitest";

import { abtGlobalParser } from "@/lib/scrapers/parsers/abt-global";

const SOURCE_URL = "https://www.abtglobal.com/doing-business-with-abt/commercial-opportunities";

describe("Abt Global commercial opportunities parser", () => {
	it("extracts active Abt accordion opportunities and skips expired rows", async () => {
		const result = await abtGlobalParser.parse({
			url: SOURCE_URL,
			html: `
				<h3 class="accordion__item--header-title">FPSP-RFP-2099-043: Request for Proposal - Fiji Public Service Leadership Initiative</h3>
				<div class="accordion__item--body">
					<p>Proposals must be submitted electronically before 5:00pm Fiji Time on 26 June 2099.</p>
					<p><a href="/sites/default/files/fpsp-rfp-2099-043.pdf">RFP documentation</a></p>
				</div>
				<h3 class="accordion__item--header-title">PATH-RFP-2000-001: Request for Proposal - Closed Cost Analysis</h3>
				<div class="accordion__item--body">
					<p>Closing date and time is Friday, 5 June 2000.</p>
					<p><a href="/sites/default/files/path-rfp-2000-001.pdf">RFP documentation</a></p>
				</div>
			`,
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "FPSP-RFP-2099-043: Request for Proposal - Fiji Public Service Leadership Initiative",
				source: "abt_global",
				sourceId: "abt-fpsp-rfp-2099-043",
				noticeId: "FPSP-RFP-2099-043",
				organization: "Abt Global",
				opportunityType: "rfp",
				portalUrl: SOURCE_URL,
				documentUrl: "https://www.abtglobal.com/sites/default/files/fpsp-rfp-2099-043.pdf",
				rfpLink: "https://www.abtglobal.com/sites/default/files/fpsp-rfp-2099-043.pdf",
				tags: ["abt-global", "donor-implementer", "source-scrape"],
			}),
		]);
		expect(result.opportunities[0]?.deadline).toEqual(new Date("2099-06-26T00:00:00.000Z"));
	});
});

