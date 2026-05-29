import { describe, expect, it } from "vitest";

import {
	CEB_MAURITIUS_TENDERS_URL,
	parseCebMauritiusTendersHtml,
} from "@/lib/scrapers/parsers/ceb-mauritius";

const sampleHtml = `
	<section id="openingbids">
		<h4 class="mt-40">CPB/12/2026 (IFB 10805) - PROCUREMENT OF GRID-TIED ROOF-MOUNTED SOLAR PHOTOVOLTAIC SYSTEMS</h4>
		<dl class="row">
			<dt>Download:</dt>
			<dd><ul><li><a href="https://ceb.mu/files/files/tenders/Press%20Notice%20CPB-12-2026.pdf">Press Notice</a></li></ul></dd>
			<dt>Reference:</dt>
			<dd>CPB/12/2026 (IFB 10805)</dd>
			<dt>Closing Date:</dt>
			<dd>Tuesday, June 02, 2026 at 13:30 hours Mauritian Time</dd>
			<dt>Tender Document:</dt>
			<dd></dd>
			<dt>Remarks:</dt>
			<dd></dd>
		</dl>
		<hr>
		<h4 class="mt-40">OAB-TD-2026-10487 - FRAMEWORK AGREEMENT FOR UNSKILLED WORKS [ <span class="blink small">Updated</span> ]</h4>
		<dl class="row">
			<dt>Download:</dt>
			<dd><ul><li><a href="https://ceb.mu/files/files/tenders/Press%20Notice%20OAB-TD-2026-10487.pdf">Press Notice</a></li></ul></dd>
			<dt>Reference:</dt>
			<dd>OAB-TD-2026-10487</dd>
			<dt>Closing Date:</dt>
			<dd>Wednesday, June 10, 2026 at 13:30 hours Mauritian Time</dd>
			<dt>Tender Document:</dt>
			<dd><li><a data-src="https://ceb.mu/files/files/tenders/OAB-TD-2026-10487%20Bidding%20Documents.doc" href="javascript:;" class="subscribe-download">OAB-TD-2026-10487 Bidding Documents.doc</a></li></dd>
			<dt>Updates:</dt>
			<dd><a href="https://ceb.mu/files/files/tenders/Addendum%20No.1%20OAB-TD-2026-10487.pdf">Addendum No.1 OAB-TD-2026-10487</a></dd>
			<dt>Remarks:</dt>
			<dd>Clarification 1<br>Addendum</dd>
		</dl>
	</section>
`;

describe("Mauritius CEB parser", () => {
	it("extracts tender rows and direct document links from the static tender page", () => {
		const opportunities = parseCebMauritiusTendersHtml(sampleHtml);

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			title: "CPB/12/2026 (IFB 10805) - PROCUREMENT OF GRID-TIED ROOF-MOUNTED SOLAR PHOTOVOLTAIC SYSTEMS",
			source: "ceb_mauritius",
			sourceId: "ceb-mauritius-cpb-12-2026-ifb-10805",
			noticeId: "CPB/12/2026 (IFB 10805)",
			organization: "Central Electricity Board Mauritius",
			countryRegion: "Mauritius",
			opportunityType: "tender",
			portalUrl: CEB_MAURITIUS_TENDERS_URL,
			documentUrl: "https://ceb.mu/files/files/tenders/Press%20Notice%20CPB-12-2026.pdf",
			tags: ["ceb", "mauritius", "national-procurement", "direct-documents"],
		});
		expect(opportunities[0]?.deadline).toEqual(new Date("2026-06-02T09:30:00.000Z"));
		expect(opportunities[0]?.metadata?.cebMauritius).toMatchObject({
			reference: "CPB/12/2026 (IFB 10805)",
			closingDateText: "Tuesday, June 02, 2026 at 13:30 hours Mauritian Time",
			documentLinks: [{
				label: "Press Notice",
				url: "https://ceb.mu/files/files/tenders/Press%20Notice%20CPB-12-2026.pdf",
				section: "download",
			}],
		});
	});

	it("prefers tender documents over press notices when both are available", () => {
		const opportunities = parseCebMauritiusTendersHtml(sampleHtml);

		expect(opportunities[1]?.title).toBe("OAB-TD-2026-10487 - FRAMEWORK AGREEMENT FOR UNSKILLED WORKS");
		expect(opportunities[1]?.documentUrl).toBe("https://ceb.mu/files/files/tenders/OAB-TD-2026-10487%20Bidding%20Documents.doc");
		expect(opportunities[1]?.metadata?.cebMauritius).toMatchObject({
			reference: "OAB-TD-2026-10487",
			remarks: "Clarification 1 Addendum",
			documentLinks: [
				expect.objectContaining({ section: "download" }),
				expect.objectContaining({ section: "tender_document" }),
				expect.objectContaining({ section: "updates" }),
			],
		});
	});
});
