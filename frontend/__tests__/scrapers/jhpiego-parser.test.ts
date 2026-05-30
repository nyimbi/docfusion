import { describe, expect, it } from "vitest";

import { jhpiegoParser } from "@/lib/scrapers/parsers/jhpiego";

const SOURCE_URL = "https://jhpiego.org/work-with-us/";

describe("Jhpiego work-with-us parser", () => {
	it("extracts active request rows and skips expired entries", async () => {
		const result = await jhpiegoParser.parse({
			url: SOURCE_URL,
			html: `
				<table class="show-desktop">
					<tbody>
						<tr>
							<td class="title">RFP 20-04</td>
							<td class="description"><div class="text">Expired Audit Services</div></td>
							<td class="post-date"><time datetime="April 13, 2000">April 13, 2000</time></td>
							<td class="close-date"><time datetime="May 29, 2000">May 29, 2000</time></td>
							<td class="location">Global</td>
						</tr>
						<tr>
							<td class="title">RFP-99-009</td>
							<td class="description"><div class="text">Social Listening Services</div></td>
							<td class="post-date"><time datetime="May 27, 2099">May 27, 2099</time></td>
							<td class="close-date"><time datetime="June 19, 2099">June 19, 2099</time></td>
							<td class="location">USA</td>
						</tr>
					</tbody>
				</table>
			`,
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "RFP-99-009: Social Listening Services",
				source: "jhpiego",
				sourceId: "jhpiego-rfp-99-009",
				noticeId: "RFP-99-009",
				organization: "Jhpiego",
				countryRegion: "USA",
				opportunityType: "rfp",
				portalUrl: SOURCE_URL,
				rfpLink: SOURCE_URL,
				tags: ["jhpiego", "donor-implementer", "source-scrape"],
			}),
		]);
		expect(result.opportunities[0]?.deadline).toEqual(new Date(2099, 5, 19));
		expect(result.opportunities[0]?.publishedDate).toEqual(new Date(2099, 4, 27));
	});
});
