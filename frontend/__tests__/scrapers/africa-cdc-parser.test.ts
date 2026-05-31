import { describe, expect, it } from "vitest";

import {
	AFRICA_CDC_OPPORTUNITIES_URL,
	africaCdcParser,
	parseAfricaCdcDetailHtml,
	parseAfricaCdcOpportunitiesHtml,
	parseAfricaCdcOpportunitiesMarkdown,
} from "@/lib/scrapers/parsers/africa-cdc";

const listingHtml = `
	<div class="row" style="margin-bottom:30px;padding-bottom:30px;border-bottom: 1px solid #ececec;">
		<div class="col-md-6"><strong><a href="https://africacdc.org/opportunity/consultancy-to-scaling-of-the-africa-cdc-continental-public-health-data-intelligence-hdi/">Consultancy to Scaling of the Africa CDC Continental Public Health Data Intelligence (HDI)</a></strong></div>
		<div class="col-md-2">7 July 2099</div>
		<div class="col-md-2">RFP No. ACDC/SDI/CS/02</div>
		<div class="col-md-2">Consultancy Services</div>
	</div>
	<div class="row" style="margin-bottom:30px;padding-bottom:30px;border-bottom: 1px solid #ececec;">
		<div class="col-md-6"><strong><a href="https://africacdc.org/opportunity/open-call-for-expression-of-interest-experts-to-serve-on-the-technical-committees-of-the-african-medicines-agency/">Open Call for Expression of Interest: Experts to Serve on the Technical Committees of the African Medicines Agency</a></strong></div>
		<div class="col-md-2">18 June 2099</div>
		<div class="col-md-2">N/A</div>
		<div class="col-md-2">Call for Expression of Interest</div>
	</div>
`;

const detailHtml = `
	<h5 class="elementor-heading-title elementor-size-default"><span>Request for Proposals</span></h5>
	<h1 class="elementor-heading-title elementor-size-default">Consultancy to Scaling of the Africa CDC Continental Public Health Data Intelligence (HDI)</h1>
	<div class="elementor-widget-theme-post-content"><div class="elementor-widget-container">
		<p><strong>Submission Deadline:</strong> July 7, 2099,<br><strong>Submission Email:</strong> <a href="mailto:procurement@africacdc.org">procurement@africacdc.org</a></p>
		<p>Interested firms should submit proposals in accordance with the solicitation document.</p>
	</div></div>
	<h5 class="elementor-heading-title elementor-size-default">Deadline</h5>
	<h3 class="elementor-heading-title elementor-size-default">7 July 2099</h3>
	<h5 class="elementor-heading-title elementor-size-default">Bid Number</h5>
	<h3 class="elementor-heading-title elementor-size-default">RFP No. ACDC/SDI/CS/02</h3>
	<a class="elementor-button" href="https://africacdc.org/wp-content/uploads/2099/05/PROCUREMENT-NOTICE-26-May-2099.pdf">Download bid document</a>
`;

describe("Africa CDC opportunities parser", () => {
	it("extracts current listing rows with deadlines and references", () => {
		const opportunities = parseAfricaCdcOpportunitiesHtml(listingHtml, AFRICA_CDC_OPPORTUNITIES_URL, new Date("2099-06-01T00:00:00Z"));

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			title: "Consultancy to Scaling of the Africa CDC Continental Public Health Data Intelligence (HDI)",
			source: "africa_cdc",
			sourceId: "africa-cdc-rfp-no-acdc-sdi-cs-02",
			noticeId: "RFP No. ACDC/SDI/CS/02",
			organization: "Africa Centres for Disease Control and Prevention (Africa CDC)",
			countryRegion: "Africa",
			category: "Consultancy Services",
			opportunityType: "rfp",
			deadline: new Date("2099-07-07T12:00:00.000Z"),
			rfpLink: "https://africacdc.org/opportunity/consultancy-to-scaling-of-the-africa-cdc-continental-public-health-data-intelligence-hdi/",
			tags: ["africa-cdc", "african-union", "africa", "health-procurement"],
		});
		expect(opportunities[1].opportunityType).toBe("eoi");
		expect(opportunities[1].metadata.africaCdc).toMatchObject({
			deadlineText: "18 June 2099",
			reference: undefined,
			bidType: "Call for Expression of Interest",
			documentLinks: [],
		});
	});

	it("drops expired listing rows", () => {
		const opportunities = parseAfricaCdcOpportunitiesHtml(listingHtml, AFRICA_CDC_OPPORTUNITIES_URL, new Date("2100-01-01T00:00:00Z"));

		expect(opportunities).toEqual([]);
	});

	it("extracts detail pages with bid documents and submission email", () => {
		const opportunities = parseAfricaCdcDetailHtml(
			detailHtml,
			"https://africacdc.org/opportunity/consultancy-to-scaling-of-the-africa-cdc-continental-public-health-data-intelligence-hdi/",
			new Date("2099-06-01T00:00:00Z")
		);

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toMatchObject({
			source: "africa_cdc",
			sourceId: "africa-cdc-rfp-no-acdc-sdi-cs-02",
			documentUrl: "https://africacdc.org/wp-content/uploads/2099/05/PROCUREMENT-NOTICE-26-May-2099.pdf",
			rfpLink: "https://africacdc.org/wp-content/uploads/2099/05/PROCUREMENT-NOTICE-26-May-2099.pdf",
			submissionMethod: "Use the Africa CDC opportunity notice instructions; submission/contact email: procurement@africacdc.org.",
		});
		expect(opportunities[0].metadata.africaCdc.documentLinks).toEqual([
			{
				label: "Download bid document",
				url: "https://africacdc.org/wp-content/uploads/2099/05/PROCUREMENT-NOTICE-26-May-2099.pdf",
			},
		]);
	});

	it("falls back to Firecrawl listing markdown", () => {
		const markdown = [
			"**[Consultancy to Scaling of the Africa CDC Continental Public Health Data Intelligence (HDI)](https://africacdc.org/opportunity/consultancy-to-scaling-of-the-africa-cdc-continental-public-health-data-intelligence-hdi/)",
			"**",
			"",
			"7 July 2099",
			"",
			"RFP No. ACDC/SDI/CS/02",
			"",
			"Consultancy Services",
		].join("\n");

		const opportunities = parseAfricaCdcOpportunitiesMarkdown(markdown, AFRICA_CDC_OPPORTUNITIES_URL, new Date("2099-06-01T00:00:00Z"));

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toMatchObject({
			source: "africa_cdc",
			deadline: new Date("2099-07-07T12:00:00.000Z"),
			noticeId: "RFP No. ACDC/SDI/CS/02",
		});
	});

	it("uses HTML listing rows before markdown in the parser registry", async () => {
		const result = await africaCdcParser.parse({
			url: AFRICA_CDC_OPPORTUNITIES_URL,
			html: listingHtml,
			markdown: "",
		});

		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0].source).toBe("africa_cdc");
	});
});
