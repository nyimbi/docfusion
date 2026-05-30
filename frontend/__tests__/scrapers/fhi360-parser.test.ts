import { describe, expect, it } from "vitest";

import { fhi360Parser } from "@/lib/scrapers/parsers/fhi360";

const SOURCE_URL = "https://solicitations.fhi360.org/Solicitation.aspx";

describe("FHI 360 solicitations parser", () => {
	it("extracts active FHI 360 RFP/RFQ/RFA solicitations and skips closed entries", async () => {
		const result = await fhi360Parser.parse({
			url: SOURCE_URL,
			html: `
				<hr />
				<p class="rteindent1">
					<b><span id="MainContent_lvRFP_lblTitle_0">Support to Strengthen Community-Based Surveillance Activities</span></b><br />
					RFP No.: <span id="MainContent_lvRFP_lblNumber_0">2026-016-Indonesia-CBS_RFP_02</span><br />
					Issue date: <span id="MainContent_lvRFP_lblIssue_0">15 May, 2099</span><br />
					Closing date: <span id="MainContent_lvRFP_lblClose_0">10 Jun, 2099</span><br />
				</p>
				<p class="rteindent1">
					<b>Solicitation file(s):</b><br />
					<a href="/Files/STRIDES%20Tender%20for%20GHS%20Indonesia.pdf">STRIDES - Tender for GHS Indonesia.pdf</a>
					<a href="/Files/Attachment%20A%20Budget%20Proposal.xlsx">Attachment A-Budget Proposal.xlsx</a>
				</p>
				<hr />
				<p class="rteindent1">
					<b><span id="MainContent_lvRFQ_lblTitle_0">Health Commodity Testing Services</span></b><br />
					RFQ No.: <span id="MainContent_lvRFQ_lblNumber_0">FHI 360-FY26-002-QC Testing_RFQ_02</span><br />
					Issue date: <span id="MainContent_lvRFQ_lblIssue_0">18 May, 2099</span><br />
					Closing date: <span id="MainContent_lvRFQ_lblClose_0">26 Jun, 2099</span><br />
				</p>
				<p class="rteindent1">
					<b>Solicitation file(s):</b><br />
					<a href="/Files/FHI%20360%20FY26%20002%20QC%20Testing%20FINAL.pdf">FHI 360-FY26-002-QC Testing FINAL.pdf</a>
				</p>
				<hr />
				<p class="rteindent1">
					<b><span id="MainContent_lvRFA_lblTitle_0">RFA #103425 English for STEM Professionals Course</span></b><br />
					RFA No.: <span id="MainContent_lvRFA_lblNumber_0">103425-03-23-2099-001_RFA_02</span><br />
					Issue date: <span id="MainContent_lvRFA_lblIssue_0">23 Mar, 2099</span><br />
					Closing date: <span id="MainContent_lvRFA_lblClose_0">5 Jun, 2099</span><br />
				</p>
				<p class="rteindent1">
					<b>Solicitation file(s):</b><br />
					<a href="/Files/English%20for%20STEM%20Professionals%20RFA.pdf">English for STEM Professionals RFA.pdf</a>
				</p>
				<hr />
				<p class="rteindent1">
					<b><span id="MainContent_lvRFP_lblTitle_1">Closed Solicitation</span></b><br />
					RFP No.: <span id="MainContent_lvRFP_lblNumber_1">CLOSED-RFP-2000</span><br />
					Closing date: <span id="MainContent_lvRFP_lblClose_1">1 Jan, 2000</span><br />
				</p>
			`,
		});

		expect(result.opportunities).toHaveLength(3);
		expect(result.opportunities[0]).toEqual(expect.objectContaining({
			title: "Support to Strengthen Community-Based Surveillance Activities",
			source: "fhi360",
			sourceId: "fhi360-2026-016-indonesia-cbs-rfp-02",
			noticeId: "2026-016-Indonesia-CBS_RFP_02",
			organization: "FHI 360",
			opportunityType: "rfp",
			portalUrl: SOURCE_URL,
			documentUrl: "https://solicitations.fhi360.org/Files/STRIDES%20Tender%20for%20GHS%20Indonesia.pdf",
			rfpLink: "https://solicitations.fhi360.org/Files/STRIDES%20Tender%20for%20GHS%20Indonesia.pdf",
			tags: ["fhi360", "donor-implementer", "source-scrape", "source-documents"],
		}));
		expect(result.opportunities[0]?.deadline).toEqual(new Date("2099-06-10T00:00:00.000Z"));
		expect(result.opportunities[0]?.publishedDate).toEqual(new Date("2099-05-15T00:00:00.000Z"));
		expect(result.opportunities[0]?.metadata?.fhi360).toEqual(expect.objectContaining({
			kind: "RFP",
			documentLinks: [
				{
					label: "STRIDES - Tender for GHS Indonesia.pdf",
					url: "https://solicitations.fhi360.org/Files/STRIDES%20Tender%20for%20GHS%20Indonesia.pdf",
				},
				{
					label: "Attachment A-Budget Proposal.xlsx",
					url: "https://solicitations.fhi360.org/Files/Attachment%20A%20Budget%20Proposal.xlsx",
				},
			],
		}));
		expect(result.opportunities[1]?.opportunityType).toBe("tender");
		expect(result.opportunities[2]?.opportunityType).toBe("grant");
	});
});
