import { describe, expect, it } from "vitest";

import {
	ESPPRA_TENDER_URL,
	esppraEswatiniParser,
	parseEsppraTenderHtml,
} from "@/lib/scrapers/parsers/esppra-eswatini";

const tenderHtml = `
	<div class="list-item job-box">
		<h5 class="text-center text-md-left" style="text-transform: uppercase; color:#f07d2a">Business Continuity Management System</h5>
		<p style="text-align: justify;"><b>Eswatini Revenue Service</b></p>
		<p style="text-align: justify;"> ERS/RFP/01/2026 </p>
		<p style="text-align: justify;"> Procurement Method: Request For Proposal </p>
		<p style="text-align: justify;"> Tender Upload Date:  Tuesday 19th May 2026 10:13 am</p>
		<p style="text-align: justify;"> Submission Deadline:  Tuesday 9th June 2026 12:00 pm</p>
		<a id="26904" href="documents/tenders/Public Service Pension Fund (PSPF)/1779178473.pdf" class="btn" download>Download Tender</a>
	</div>
	<div class="list-item job-box">
		<h5 class="text-center text-md-left" style="text-transform: uppercase; color:#f07d2a">Supply and Delivery of IT Equipment</h5>
		<p style="text-align: justify;"><b>Ministry of Education and Training</b></p>
		<p style="text-align: justify;"> SZ-MOET-551486-GO-RFB </p>
		<p style="text-align: justify;"> Procurement Method: Request For Tender </p>
		<p style="text-align: justify;"> Tender Upload Date:  Thursday 30th April 2026 4:49 pm</p>
		<p style="text-align: justify;"> Submission Deadline:  Friday 29th May 2026 11:00 am</p>
		<a id="25939" href="documents/tenders/Ministry/1777890226.pdf" class="btn" download>Download Tender</a>
	</div>
	<b> 1 </b>[ <a href='/sppra/tender.php?Page=2&txtKeyword='>2</a> ]
`;

describe("ESPPRA Eswatini parser", () => {
	it("extracts tender cards with deadlines and direct PDF links", () => {
		const opportunities = parseEsppraTenderHtml(tenderHtml);

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			title: "Business Continuity Management System",
			source: "esppra_eswatini",
			sourceId: "esppra-26904",
			noticeId: "ERS/RFP/01/2026",
			organization: "Eswatini Revenue Service",
			countryRegion: "Eswatini",
			category: "Request For Proposal",
			opportunityType: "rfp",
			portalUrl: ESPPRA_TENDER_URL,
			documentUrl: "https://esppra.co.sz/sppra/documents/tenders/Public%20Service%20Pension%20Fund%20(PSPF)/1779178473.pdf",
		});
		expect(opportunities[0]?.deadline).toEqual(new Date("2026-06-09T10:00:00.000Z"));
		expect(opportunities[0]?.publishedDate).toEqual(new Date("2026-05-19T08:13:00.000Z"));
		expect(opportunities[1]).toMatchObject({
			sourceId: "esppra-25939",
			opportunityType: "tender",
			organization: "Ministry of Education and Training",
		});
	});

	it("supports the TenderParser interface from provided HTML", async () => {
		const result = await esppraEswatiniParser.parse({
			html: tenderHtml,
			url: ESPPRA_TENDER_URL,
		});

		expect(result.error).toBeUndefined();
		expect(result.opportunities.map((opportunity) => opportunity.sourceId)).toEqual([
			"esppra-26904",
			"esppra-25939",
		]);
		expect(esppraEswatiniParser.getPageUrl(ESPPRA_TENDER_URL, 2)).toContain("Page=2");
		expect(esppraEswatiniParser.hasNextPage({ html: tenderHtml, url: ESPPRA_TENDER_URL }, 1)).toBe(true);
	});
});
