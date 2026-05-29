import { describe, expect, it } from "vitest";

import {
	AFRICAN_UNION_BIDS_URL,
	parseAfricanUnionBidDetailHtml,
	parseAfricanUnionBidsHtml,
} from "@/lib/scrapers/parsers/african-union";

const listHtml = `
	<table class="views-table sticky-enabled cols-4">
		<tbody>
			<tr class="odd">
				<td class="views-field views-field-field-date active views-align-left">
					<span class="date-display-single" content="2026-05-22T15:18:00+03:00">July 02, 2026</span>
				</td>
				<td class="views-field views-field-title views-align-left">
					<a href="/en/bids/20260522/supply-delivery-installation-and-training-enterprise-aigpu-enables-high-performance">Supply, Delivery, Installation and Training of an Enterprise AI/GPU-Enables High-Performance Computing Server</a>
				</td>
				<td class="views-field views-field-field-tags-documents">
					<a href="/en/procurement-bids">Procurement/ Bids</a>
				</td>
				<td class="views-field views-field-field-text-bidnumber views-align-left">
					ET-AUC-545691-GO-
				</td>
			</tr>
		</tbody>
	</table>
`;

const detailHtml = `
	<div class="field field-name-field-date field-type-date field-label-hidden">
		<span class="date-display-range">
			<span class="date-display-start" content="2026-05-22T15:18:00+03:00">May 22, 2026</span>
			to <span class="date-display-end" content="2026-07-02T15:00:00+03:00">July 02, 2026</span>
		</span>
	</div>
	<div class="panel-separator"></div>
	<div class="field field-name-field-text-bidnumber field-type-text field-label-above">
		<div class="field-label">Bid number:&nbsp;</div>
		<div class="field-items"><div class="field-item even">ET-AUC-545691-GO-RFB</div></div>
	</div>
	<div class="panel-separator"></div>
	<div class="field field-name-field-file field-type-file field-label-hidden">
		<div class="field-items"><div class="field-item even">
			<span class="file"><a href="https://au.int/sites/default/files/bids/46431-BIDDING_DOCUMENT_22_May_2026.pdf" type="application/pdf">Bid Document</a></span>
		</div></div>
	</div>
`;

describe("African Union bids parser", () => {
	it("extracts bid rows from the AU bids table", () => {
		const rows = parseAfricanUnionBidsHtml(listHtml);

		expect(rows).toEqual([expect.objectContaining({
			title: "Supply, Delivery, Installation and Training of an Enterprise AI/GPU-Enables High-Performance Computing Server",
			portalUrl: "https://au.int/en/bids/20260522/supply-delivery-installation-and-training-enterprise-aigpu-enables-high-performance",
			bidNumber: "ET-AUC-545691-GO-",
			bidType: "Procurement/ Bids",
		})]);
		expect(rows[0]?.deadline).toEqual(new Date("2026-07-02T20:59:59.000Z"));
	});

	it("extracts deadline, bid number, and direct PDF document links from a detail page", () => {
		const detail = parseAfricanUnionBidDetailHtml(detailHtml);

		expect(detail).toMatchObject({
			publishedDate: new Date("2026-05-22T12:18:00.000Z"),
			deadline: new Date("2026-07-02T12:00:00.000Z"),
			deadlineText: "July 02, 2026",
			bidNumber: "ET-AUC-545691-GO-RFB",
			documentLinks: [{
				label: "Bid Document",
				url: "https://au.int/sites/default/files/bids/46431-BIDDING_DOCUMENT_22_May_2026.pdf",
			}],
		});
	});

	it("normalizes AU rows into source opportunities", async () => {
		const { africanUnionParser } = await import("@/lib/scrapers/parsers/african-union");
		const result = await africanUnionParser.parse({
			url: AFRICAN_UNION_BIDS_URL,
			html: listHtml,
		});

		expect(result.opportunities).toHaveLength(1);
		expect(result.opportunities[0]).toMatchObject({
			title: "Supply, Delivery, Installation and Training of an Enterprise AI/GPU-Enables High-Performance Computing Server",
			source: "african_union",
			sourceId: "african-union-supply-delivery-installation-and-training-enterprise-aigpu-enables-high-performance",
			noticeId: "ET-AUC-545691-GO-",
			organization: "African Union Commission",
			countryRegion: "Africa",
			category: "Procurement/ Bids",
			opportunityType: "tender",
			portalUrl: "https://au.int/en/bids/20260522/supply-delivery-installation-and-training-enterprise-aigpu-enables-high-performance",
			rfpLink: "https://au.int/en/bids/20260522/supply-delivery-installation-and-training-enterprise-aigpu-enables-high-performance",
			tags: ["african-union", "auc", "regional-procurement", "direct-documents"],
		});
	});
});
