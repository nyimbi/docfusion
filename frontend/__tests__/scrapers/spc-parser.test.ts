import { describe, expect, it } from "vitest";

import { spcParser } from "@/lib/scrapers/parsers/spc";

const SOURCE_URL = "https://www.spc.int/procurement";

describe("Pacific Community procurement parser", () => {
	it("extracts SPC tender rows and uses the tender detail as the source document", async () => {
		const result = await spcParser.parse({
			url: SOURCE_URL,
			html: `
				<div class="views-row">
					<div class="kyanite-views-row-inner">
						<div class="views-field views-field-field-reference-no-"><div class="field-content">RFQ26-9998</div></div>
						<div class="views-field views-field-field-amendment-s-to-procurement">
							<div class="field-content">
								<a href="/procurement/tenders/technical-advisor-for-exposure-modelling-for-kiribati">
									Technical Advisor for Exposure Modelling for Kiribati
								</a>
								<p>Posting date: <time datetime="2026-03-13T22:12:28+00:00">13 March 2026</time><br>
								Closing Date: <time datetime="2026-03-26T12:00:00Z">26 March 2026</time></p>
							</div>
						</div>
						<div class="views-field views-field-field-country-for-deliverables">
							<span class="views-label views-label-field-country-for-deliverables">Country for Deliverables</span>
							<div class="field-content">Suva, Fiji</div>
						</div>
						<div class="views-field views-field-field-division">
							<span class="views-label views-label-field-division">Project/Unit: </span>
							<span class="field-content">GEM</span>
						</div>
						<div class="views-field views-field-field-tender-category">
							<span class="views-label views-label-field-tender-category">Category: </span>
							<span class="field-content">Services</span>
						</div>
						<div class="views-field views-field-field-tender-grant-status">
							<span class="views-label views-label-field-tender-grant-status">Status: </span>
							<span class="field-content">Selection Process Ongoing</span>
						</div>
					</div>
				</div>
			`,
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "Technical Advisor for Exposure Modelling for Kiribati",
				source: "spc",
				sourceId: "spc-rfq26-9998",
				noticeId: "RFQ26-9998",
				organization: "The Pacific Community",
				category: "SPC Services",
				countryRegion: "Suva, Fiji",
				opportunityType: "tender",
				portalUrl: "https://www.spc.int/procurement/tenders/technical-advisor-for-exposure-modelling-for-kiribati",
				documentUrl: "https://www.spc.int/procurement/tenders/technical-advisor-for-exposure-modelling-for-kiribati",
				rfpLink: "https://www.spc.int/procurement/tenders/technical-advisor-for-exposure-modelling-for-kiribati",
				tags: expect.arrayContaining(["spc", "pacific-community", "source-documents"]),
			}),
		]);
		expect(result.opportunities[0]?.deadline).toEqual(new Date(2026, 2, 26));
		expect(result.opportunities[0]?.publishedDate).toEqual(new Date(2026, 2, 13));
		expect(result.opportunities[0]?.projectSummary).toContain("Project/Unit: GEM.");
	});

	it("skips inactive SPC award and cancellation rows", async () => {
		const result = await spcParser.parse({
			url: SOURCE_URL,
			html: `
				<div class="views-row">
					<div class="views-field views-field-field-reference-no-"><div class="field-content">RFP21-007</div></div>
					<div class="views-field views-field-field-amendment-s-to-procurement">
						<div class="field-content"><a href="/procurement/tenders/review-of-festpac-model">Review of FestPAC Model</a></div>
					</div>
					<div class="views-field views-field-field-tender-grant-status">
						<span class="views-label views-label-field-tender-grant-status">Status: </span>
						<span class="field-content">Awarded</span>
					</div>
				</div>
				<div class="views-row">
					<div class="views-field views-field-field-reference-no-"><div class="field-content">RFQ26-9969</div></div>
					<div class="views-field views-field-field-amendment-s-to-procurement">
						<div class="field-content"><a href="/procurement/tenders/waste-sorting-bins">Procurement for colour-coded office waste-sorting bins</a></div>
					</div>
					<div class="views-field views-field-field-tender-grant-status">
						<span class="views-label views-label-field-tender-grant-status">Status: </span>
						<span class="field-content">Cancelled</span>
					</div>
				</div>
			`,
		});

		expect(result.opportunities).toEqual([]);
	});
});
