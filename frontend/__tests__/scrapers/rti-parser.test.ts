import { describe, expect, it } from "vitest";

import { rtiParser } from "@/lib/scrapers/parsers/rti";

const SOURCE_URL = "https://www.rti.org/current-opportunities";

describe("RTI current opportunities parser", () => {
	it("extracts active RTI request opportunities and skips closed entries", async () => {
		const result = await rtiParser.parse({
			url: SOURCE_URL,
			html: `
				<p><strong>Request for Quote/Proposal (RFQ/RFP)</strong></p>
				<p><strong>Title:</strong> Service Provider for Physics-Constrained Graph Neural Network Development</p>
				<p><strong>Project:</strong> Energy Systems Planning and Analysis</p>
				<p><strong>RFP/Q Number:</strong> ESP-RFP-2099-027</p>
				<p><strong>Date Proposal Due:</strong> June 12, 2099 at 5:00 PM Manila time</p>
				<p><strong>Attachment:</strong> <a href="/sites/default/files/rfp-027.pdf">Request for Proposal</a></p>
				<p><strong>Request for Quote/Proposal (RFQ/RFP)</strong></p>
				<p><strong>Title:</strong> Closed Research Support</p>
				<p><strong>Solicitation Number:</strong> ESP-RFP-2000-001</p>
				<p><strong>Closing Date:</strong> May 1, 2000</p>
			`,
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "Service Provider for Physics-Constrained Graph Neural Network Development",
				source: "rti",
				sourceId: "rti-esp-rfp-2099-027",
				noticeId: "ESP-RFP-2099-027",
				organization: "RTI International",
				opportunityType: "rfp",
				portalUrl: SOURCE_URL,
				documentUrl: "https://www.rti.org/sites/default/files/rfp-027.pdf",
				rfpLink: "https://www.rti.org/sites/default/files/rfp-027.pdf",
				tags: ["rti", "donor-implementer", "source-scrape"],
			}),
		]);
		expect(result.opportunities[0]?.deadline).toEqual(new Date("2099-06-12T00:00:00.000Z"));
	});
});
