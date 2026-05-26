import { describe, expect, it } from "vitest";

import { parseUngmNoticeDetailHtml, parseUngmSearchHtml } from "@/lib/scrapers/parsers/ungm";

describe("UNGM parser", () => {
	it("parses public notice search rows into canonical opportunity data", () => {
		const opportunities = parseUngmSearchHtml(`
			<div role="row" tabindex="0" data-noticeid="300726" class="tableRow dataRow notice-table">
				<div role="cell" class="tableCell editable intendbuttonsHeader resultOptions">
					<input type="button" value="View Documents" class="buttonViewDocuments" data-notice-id="300726" />
				</div>
				<div role="cell" class="tableCell resultTitle">
					<span class="ungm-title ungm-title--small">Adquisici&#243;n de ropa de cama y toallas de ba&#241;o</span>
					<a target="_blank" href="/Public/Notice/300726">Open</a>
				</div>
				<div role="cell" class="tableCell resultInfo1 deadline" data-description="Deadline">
					<span>26-May-2026 15:30 (GMT -4.00)</span>
					<span class="remainingDaysToDeadline" style="display:none">0.07</span>
				</div>
				<div role="cell" class="tableCell"><span>13-May-2026</span></div>
				<div role="cell" class="tableCell resultAgency"><span>UNDP</span></div>
				<div role="cell" class="tableCell"><span><label>Invitation to bid</label></span></div>
				<div role="cell" class="tableCell resultInfo1" data-description="Reference"><span>UNDP-PER-00907,1</span></div>
				<div role="cell" class="tableCell"><span>Peru</span></div>
			</div>
			<script>var noticeTotal = "1657";</script>
		`, "https://www.ungm.org/Public/Notice");

		expect(opportunities).toEqual([
			expect.objectContaining({
				title: "Adquisici\u00f3n de ropa de cama y toallas de ba\u00f1o",
				source: "ungm",
				sourceId: "300726",
				noticeId: "UNDP-PER-00907,1",
				organization: "UNDP",
				countryRegion: "Peru",
				category: "Invitation to bid",
				opportunityType: "tender",
				portalUrl: "https://www.ungm.org/Public/Notice/300726",
				rfpLink: "https://www.ungm.org/Public/Notice/300726",
				tags: ["ungm", "un-procurement"],
			}),
		]);
		expect(opportunities[0].deadline).toEqual(new Date(2026, 4, 26, 15, 30, 0));
		expect(opportunities[0].publishedDate).toEqual(new Date(2026, 4, 13));
	});

	it("extracts public notice detail descriptions, contacts, and procurement links", () => {
		const detail = parseUngmNoticeDetailHtml(`
			<div class="ungm-list-item ungm-background">
				<div class="title">Description</div>
				<div>
					<p>Submit offers through Quantum.</p>
					<p>Questions go to procurement@example.org.</p>
				</div>
			</div>
			<a href="mailto:procurement@example.org">procurement@example.org</a>
			<table id="tblLinks">
				<tbody>
					<tr data-id="1">
						<td>https://example.org/register</td>
						<td>Supplier Registration</td>
					</tr>
					<tr data-id="2">
						<td>https://undp.sharepoint.com/sites/Docs-Public/Procurement</td>
						<td>Negotiation Document(s)</td>
					</tr>
					<tr data-id="3">
						<td>https://procurement-notices.undp.org/view_negotiation_dlink.cfm?nego_id=45454</td>
						<td>Direct link to Quantum Negotiation</td>
					</tr>
				</tbody>
			</table>
		`);

		expect(detail.description).toBe("Submit offers through Quantum. Questions go to procurement@example.org.");
		expect(detail.contactEmail).toBe("procurement@example.org");
		expect(detail.links).toHaveLength(3);
		expect(detail.primaryLink).toEqual({
			url: "https://undp.sharepoint.com/sites/Docs-Public/Procurement",
			description: "Negotiation Document(s)",
		});
	});
});
