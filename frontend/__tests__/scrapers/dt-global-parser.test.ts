import { describe, expect, it } from "vitest";

import { dtGlobalParser } from "@/lib/scrapers/parsers/dt-global";

const SOURCE_URL = "https://dt-global.com/proposals/";

describe("dtGlobalParser", () => {
	it("extracts active proposal cards from the archive", async () => {
		const result = await dtGlobalParser.parse({
			url: SOURCE_URL,
			html: `
				<div id="div_block-23-4572-1" class="ct-div-block">
					<h5 id="headline-35-4572-1">
						<a href="https://dt-global.com/proposals/rfp-review-of-regulations-and-laws-related-to-land-trustees/">RFP - Review of Regulations and Laws related to Land Trustees</a>
					</h5>
					<div id="text_block-47-4572-1">
						<p>The Millennium Challenge Corporation supports the Solomon Islands Threshold Program.</p>
					</div>
					<div id="text_block-100-4572-1"><span>2 June 2099, 17.00 (5.00pm) Melbourne Time.</span></div>
				</div>
				<div id="div_block-23-4572-2" class="ct-div-block">
					<h5 id="headline-35-4572-2">
						<a href="https://dt-global.com/proposals/closed-old-rfp/">RFP - Closed Old Work</a>
					</h5>
					<div id="text_block-100-4572-2"><span>10 May 2020</span></div>
				</div>
			`,
		});

		expect(result.opportunities).toHaveLength(1);
		expect(result.opportunities[0]).toEqual(expect.objectContaining({
			title: "RFP - Review of Regulations and Laws related to Land Trustees",
			source: "dt_global",
			sourceId: "dt-global-rfp-review-of-regulations-and-laws-related-to-land-trustees",
			organization: "DT Global",
			portalUrl: "https://dt-global.com/proposals/rfp-review-of-regulations-and-laws-related-to-land-trustees/",
			documentUrl: "https://dt-global.com/proposals/rfp-review-of-regulations-and-laws-related-to-land-trustees/",
			rfpLink: "https://dt-global.com/proposals/rfp-review-of-regulations-and-laws-related-to-land-trustees/",
			tags: ["dt-global", "donor-implementer", "source-scrape", "source-documents"],
		}));
		expect(result.opportunities[0]?.deadline).toEqual(new Date(2099, 5, 2));
	});

	it("extracts detail-page document links when available", async () => {
		const result = await dtGlobalParser.parse({
			url: "https://dt-global.com/proposals/rfp-alternate-website-development/",
			html: `
				<h1>RFP - Alternate Website Development for the Ministry of Education</h1>
				<p>The following documents are included in this Request for Proposal (RFP):</p>
				<p><a href="https://tinyurl.com/mr2e2zh4">RFP_SO24_SET_Website Developer for MEHRD_final</a></p>
				<h4>Application Deadline</h4>
				<p>The deadline for tender submission is no later than 1700 hrs Solomon Islands time, Wednesday 13 May 2099.</p>
			`,
		});

		expect(result.opportunities).toHaveLength(1);
		expect(result.opportunities[0]).toEqual(expect.objectContaining({
			source: "dt_global",
			documentUrl: "https://tinyurl.com/mr2e2zh4",
			rfpLink: "https://tinyurl.com/mr2e2zh4",
		}));
		expect(result.opportunities[0]?.metadata?.dtGlobal).toEqual(expect.objectContaining({
			documentLinks: [{ url: "https://tinyurl.com/mr2e2zh4", label: "RFP_SO24_SET_Website Developer for MEHRD_final" }],
		}));
	});
});
