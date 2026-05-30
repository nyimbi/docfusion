import { describe, expect, it } from "vitest";

import { unWomenParser } from "@/lib/scrapers/parsers/un-women";

const SOURCE_URL = "https://www.unwomen.org/en/about-us/procurement";

describe("UN Women procurement parser", () => {
	it("extracts current embedded UNGM notices and skips past-deadline rows", async () => {
		const result = await unWomenParser.parse({
			url: SOURCE_URL,
			html: `
				<h3>Current procurement opportunities:</h3>
				<li>
					<div class="views-field views-field-field-rss-title">
						<div class="field-content">
							<a href="https://www.ungm.org/Public/notice/300630">RFP to Develop Mentorship Program for Women Farmers</a>
						</div>
					</div>
					<div><span>Deadline: </span><time datetime="2099-06-02T00:00:00Z" class="datetime">02 June 2099</time></div>
				</li>
				<li>
					<div class="views-field views-field-field-rss-title">
						<div class="field-content">
							<a href="https://www.ungm.org/Public/notice/299690">Professional service provider to support operations</a>
						</div>
					</div>
					<div><span>Deadline: </span><time datetime="2000-05-13T00:00:00Z" class="datetime">13 May 2000</time></div>
				</li>
			`,
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "RFP to Develop Mentorship Program for Women Farmers",
				source: "un_women",
				sourceId: "un-women-300630",
				noticeId: "300630",
				organization: "UN Women",
				opportunityType: "rfp",
				deadline: new Date("2099-06-02T00:00:00Z"),
				portalUrl: "https://www.ungm.org/Public/notice/300630",
				documentUrl: "https://www.ungm.org/Public/notice/300630",
				tags: ["un-women", "un-procurement", "ungm", "source-scrape"],
			}),
		]);
	});
});
