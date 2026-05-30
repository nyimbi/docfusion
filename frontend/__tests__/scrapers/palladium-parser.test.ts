import { describe, expect, it } from "vitest";

import { palladiumParser } from "@/lib/scrapers/parsers/palladium";

const SOURCE_URL = "https://thepalladiumgroup.com/tenders";

describe("Palladium tenders parser", () => {
	it("extracts tender listing rows and queues detail pages as source documents", async () => {
		const result = await palladiumParser.parse({
			url: SOURCE_URL,
			html: `
				<ul class="listing">
					<li>
						<span class="display--inline">RFP99-008 Photography, videography and animation services for SWLT PNG</span>
						<a href="/tender/RFP99-008-Photography-videography-and-animation-services-for-SWLT-PNG">Find out more</a>
					</li>
					<li>
						<span>Community Health Digitalization Reference Platform</span>
						<a href="/tender/community-health-digitalization-reference-platform">Find out more</a>
					</li>
				</ul>
			`,
		});

		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0]).toEqual(expect.objectContaining({
			title: "RFP99-008 Photography, videography and animation services for SWLT PNG",
			source: "palladium",
			sourceId: "palladium-rfp99-008",
			noticeId: "RFP99-008",
			organization: "Palladium",
			portalUrl: "https://thepalladiumgroup.com/tender/RFP99-008-Photography-videography-and-animation-services-for-SWLT-PNG",
			documentUrl: "https://thepalladiumgroup.com/tender/RFP99-008-Photography-videography-and-animation-services-for-SWLT-PNG",
			rfpLink: "https://thepalladiumgroup.com/tender/RFP99-008-Photography-videography-and-animation-services-for-SWLT-PNG",
			tags: expect.arrayContaining(["palladium", "source-documents"]),
		}));
	});

	it("extracts document downloads and deadlines from detail pages", async () => {
		const result = await palladiumParser.parse({
			url: "https://thepalladiumgroup.com/tender/RFP99-008-Photography-videography-and-animation-services-for-SWLT-PNG",
			html: `
				<div class="h2 white uppercase margin--bottom">RFP99-008 Photography services for SWLT PNG</div>
				<div class="content">
					<p>Proposal submission closes on Friday, 8 May 2099, 4pm PNG Time.</p>
					<p><a href="/downloads/abc123/download?file=AED_RFP99-008.zip">Download RFP package</a></p>
				</div>
			`,
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "RFP99-008 Photography services for SWLT PNG",
				source: "palladium",
				sourceId: "palladium-rfp99-008",
				documentUrl: "https://thepalladiumgroup.com/downloads/abc123/download?file=AED_RFP99-008.zip",
				rfpLink: "https://thepalladiumgroup.com/downloads/abc123/download?file=AED_RFP99-008.zip",
			}),
		]);
		expect(result.opportunities[0]?.deadline).toEqual(new Date("2099-05-08T00:00:00.000Z"));
	});
});
