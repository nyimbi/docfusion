import { describe, expect, it } from "vitest";

import {
	parseCanadaBuysDetailHtml,
	parseCanadaBuysListingHtml,
} from "@/lib/scrapers/parsers/canada-buys";

const LISTING_HTML = `
	<table>
		<tbody>
			<tr>
				<td class="views-field views-field-dummy-notice-title">
					<a title="Technology and Innovation - Pre-qualification Request - Sovereign Compute Environment - Pre-Qualification Request (PQR)" href="/en/tender-opportunities/tender-notice/ab-2026-00655">Technology and Innovation - Pre-qualification Request - Sovereign...</a>
				</td>
				<td class="views-field views-field-field-term-label-1-1">Services</td>
				<td class="views-field views-field-field-term-label-1-1">2099/05/29<div class="amended-icon">Amended</div></td>
				<td class="views-field views-field-field-tender-closing-date">2099/06/08</td>
				<td class="views-field views-field-field-tender-organization"><span>Government of Alberta</span></td>
			</tr>
			<tr>
				<td class="views-field views-field-dummy-notice-title">
					<a href="/en/tender-opportunities/tender-notice/cb-expired">Expired tender</a>
				</td>
				<td>Goods</td>
				<td>2024/01/01</td>
				<td>2024/01/05</td>
				<td><span>Expired Buyer</span></td>
			</tr>
		</tbody>
	</table>
`;

const DETAIL_HTML = `
	<div class="field field--name-field-tender-solicitation-number field--type-string field--label-above">
		<span class="field--item display-flex">202604242/A</span>
	</div>
	<div class="field field--name-field-tender-publication-date field--type-datetime field--label-above">
		<span class="field--item display-flex"><time datetime="2099-05-30T12:00:00Z">2099/05/30</time></span>
	</div>
	<div class="closing-date-field">
		<span class="dateclass">2099/06/22</span>
		<span class="timeclass">17:00 EDT</span>
	</div>
	<div class="field field--name-body field--type-text-with-summary field--label-hidden h-600-overflow-h tender-detail-description field--item">
		<p>Description:<br />The buyer requires a low bandwidth mesh solution with satellite connectivity.</p>
		<p>Tenders must be submitted to the Bid Receiving Unit at: <a href="mailto:bids@example.gc.ca">bids@example.gc.ca</a></p>
	</div>
	<div class="field field--name-field-tender-contact-orgname field--type-string field--label-hidden field--item">Royal Canadian Mounted Police (RCMP)</div>
	<table class="tender-documents-table">
		<tr>
			<td class="field-document_link"><a href="https://canadabuys.canada.ca/sites/default/files/webform/tender_notice/96751/en_202604242a_low-bandwidth-mesh-solution.pdf">EN_202604242A_Low Bandwidth Mesh Solution.pdf</a></td>
		</tr>
		<tr>
			<td class="field-document_link"><a href="/sites/default/files/webform/tender_notice/96751/annex-f-form.xlsx">Annex F Form.xlsx</a></td>
		</tr>
	</table>
	<div class="field field--name-field-term-label field--type-string field--label-hidden field--item">Request for Proposal</div>
	<div class="field field--name-field-term-label field--type-string field--label-hidden field--item">Competitive - Open Bidding</div>
	<div class="field field--name-field-term-label field--type-string field--label-hidden field--item">Lowest Price</div>
	<span aria-hidden="true">43190000 Communications Devices and Accessories</span>
`;

describe("CanadaBuys parser", () => {
	it("maps open listing rows into CanadaBuys tender opportunities", () => {
		const opportunities = parseCanadaBuysListingHtml(LISTING_HTML, new Date("2099-05-31T00:00:00Z"));

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toMatchObject({
			title: "Technology and Innovation - Pre-qualification Request - Sovereign Compute Environment - Pre-Qualification Request (PQR)",
			source: "canada_buys",
			sourceId: "canadabuys-ab-2026-00655",
			noticeId: "ab-2026-00655",
			organization: "Government of Alberta",
			countryRegion: "Canada",
			category: "Services",
			opportunityType: "eoi",
			portalUrl: "https://canadabuys.canada.ca/en/tender-opportunities/tender-notice/ab-2026-00655",
			documentUrl: "https://canadabuys.canada.ca/en/tender-opportunities/tender-notice/ab-2026-00655",
			tags: ["canadabuys", "canada", "public-procurement", "source-documents"],
		});
		expect(new Date(opportunities[0]!.publishedDate!).toISOString()).toBe("2099-05-29T12:00:00.000Z");
		expect(new Date(opportunities[0]!.deadline!).toISOString()).toBe("2099-06-08T12:00:00.000Z");
	});

	it("extracts solicitation metadata and direct tender documents from detail pages", () => {
		const detail = parseCanadaBuysDetailHtml(
			DETAIL_HTML,
			"https://canadabuys.canada.ca/en/tender-opportunities/tender-notice/cb-900-58930369"
		);

		expect(detail).toMatchObject({
			solicitationNumber: "202604242/A",
			contractingOrganization: "Royal Canadian Mounted Police (RCMP)",
			procurementMethod: "Competitive - Open Bidding",
			selectionMethod: "Lowest Price",
			unspsc: ["43190000 Communications Devices and Accessories"],
			documentLinks: [
				{
					url: "https://canadabuys.canada.ca/sites/default/files/webform/tender_notice/96751/en_202604242a_low-bandwidth-mesh-solution.pdf",
					label: "EN_202604242A_Low Bandwidth Mesh Solution.pdf",
				},
				{
					url: "https://canadabuys.canada.ca/sites/default/files/webform/tender_notice/96751/annex-f-form.xlsx",
					label: "Annex F Form.xlsx",
				},
			],
		});
		expect(detail.publishedDate?.toISOString()).toBe("2099-05-30T12:00:00.000Z");
		expect(detail.deadline?.toISOString()).toBe("2099-06-22T21:00:00.000Z");
		expect(detail.description).toContain("low bandwidth mesh solution");
		expect(detail.submissionMethod).toContain("Tenders must be submitted");
	});
});
