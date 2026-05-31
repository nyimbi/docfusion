import { describe, expect, it } from "vitest";

import { oxfamNigeriaParser, parseOxfamNigeriaProcurementHtml } from "@/lib/scrapers/parsers/oxfam-nigeria";

const SOURCE_URL = "https://nigeria.oxfam.org/procurement-and-consultancy";

describe("oxfamNigeriaParser", () => {
	it("extracts the current procurement consultancy and TOR link", async () => {
		const result = await oxfamNigeriaParser.parse({
			url: SOURCE_URL,
			html: `
				<main>
					<p>Oxfam in Nigeria is seeking the services of an experienced and reliable consultancy service provider.</p>
					<p><strong>Main Objective</strong></p>
					<p>Capacity building for LGA budget and planning officers on Basic Excel skills to support the use of ICT for budget preparation, implementation, monitoring, and evaluation.</p>
					<p>Interested parties can download the <a href="https://oxfam.app.box.com/s/example/folder/384191668623"><strong>Terms of Reference</strong></a> (link embedded)</p>
					<ul>
						<li><strong>Submission Deadline:</strong> June 7, 2099, at 23:59 (WAT).</li>
					</ul>
				</main>
			`,
		});

		expect(result.opportunities).toHaveLength(1);
		expect(result.opportunities[0]).toEqual(expect.objectContaining({
			title: "Capacity building for LGA budget and planning officers on Basic Excel skills to support the use of ICT for budget preparation, implementation, monitoring, and evaluation.",
			source: "oxfam_nigeria",
			sourceId: expect.stringMatching(/^oxfam-nigeria-capacity-building-for-lga-budget-and-planning-officers/),
			organization: "Oxfam in Nigeria",
			countryRegion: "Nigeria",
			deadline: new Date(2099, 5, 7),
			documentUrl: "https://oxfam.app.box.com/s/example/folder/384191668623",
			rfpLink: "https://oxfam.app.box.com/s/example/folder/384191668623",
			tags: ["oxfam-nigeria", "ngo", "source-scrape", "source-documents"],
		}));
	});

	it("filters the page after the visible submission deadline passes", () => {
		const opportunities = parseOxfamNigeriaProcurementHtml(`
			<main>
				<p>Interested parties can download the <a href="https://oxfam.app.box.com/s/example/folder/384191668623">Terms of Reference</a></p>
				<ul><li><strong>Submission Deadline:</strong> June 7, 2099, at 23:59 (WAT).</li></ul>
			</main>
		`, SOURCE_URL, new Date("2099-06-08T00:00:00Z"));

		expect(opportunities).toHaveLength(0);
	});
});
