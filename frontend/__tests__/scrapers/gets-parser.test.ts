import { describe, expect, it } from "vitest";

import { parseGetsDetailHtml, parseGetsListingHtml } from "@/lib/scrapers/parsers/gets";

describe("New Zealand GETS parser", () => {
	it("maps current tender table rows into source-backed opportunities and filters expired rows", () => {
		const opportunities = parseGetsListingHtml(`
			<table>
				<tbody>
					<tr id="tender-34016603" class="tender blueRow">
						<td><a href="MSD/ExternalTenderDetails.htm?id=34016603">34016603</a></td>
						<td><a href="MSD/ExternalTenderDetails.htm?id=34016603">12802</a></td>
						<td><a href="MSD/ExternalTenderDetails.htm?id=34016603">Debt Collection Services - RFP</a></td>
						<td><abbr title="Request for Proposals">RFP</abbr></td>
						<td>12:00 PM 3 Jun 2099 (Pacific/Auckland UTC+12:00)</td>
						<td>Ministry of Social Development</td>
					</tr>
					<tr id="tender-11111111" class="tender">
						<td><a href="ABC/ExternalTenderDetails.htm?id=11111111">11111111</a></td>
						<td>[None]</td>
						<td><a href="ABC/ExternalTenderDetails.htm?id=11111111">Expired GETS tender</a></td>
						<td><abbr title="Request for Tenders">RFT</abbr></td>
						<td>5:00 PM 1 Jan 2024 (Pacific/Auckland UTC+13:00)</td>
						<td>Expired Buyer</td>
					</tr>
				</tbody>
			</table>
		`, new Date("2099-05-31T00:00:00Z"));

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toMatchObject({
			title: "Debt Collection Services - RFP",
			source: "new_zealand_gets",
			sourceId: "gets-34016603",
			noticeId: "12802",
			organization: "Ministry of Social Development",
			countryRegion: "New Zealand",
			category: "Request for Proposals",
			opportunityType: "rfp",
			portalUrl: "https://www.gets.govt.nz/MSD/ExternalTenderDetails.htm?id=34016603",
			documentUrl: "https://www.gets.govt.nz/MSD/ExternalTenderDetails.htm?id=34016603",
			rfpLink: "https://www.gets.govt.nz/MSD/ExternalTenderDetails.htm?id=34016603",
			tags: ["gets", "new-zealand", "public-procurement", "source-documents"],
			metadata: {
				newZealandGets: expect.objectContaining({
					rfxId: "34016603",
					reference: "12802",
					tenderType: "Request for Proposals",
					detailUrl: "https://www.gets.govt.nz/MSD/ExternalTenderDetails.htm?id=34016603",
					documentLinks: [{
						url: "https://www.gets.govt.nz/MSD/ExternalTenderDetails.htm?id=34016603",
						label: "Debt Collection Services - RFP",
					}],
				}),
			},
		});
		expect(new Date(opportunities[0]!.deadline!).toISOString()).toBe("2099-06-03T00:00:00.000Z");
	});

	it("extracts detail-page RFx metadata and direct document links when exposed", () => {
		const detail = parseGetsDetailHtml(`
			<table id="tender-details-info-tbl">
				<tr><td class="label-cell">RFx ID&nbsp;:</td><td>34016603</td></tr>
				<tr><td class="label-cell">Reference #&nbsp;:</td><td>12802</td></tr>
				<tr><td class="label-cell">Close Date&nbsp;:</td><td>12:00 PM 3 Jun 2099 (Pacific/Auckland UTC+12:00)</td></tr>
				<tr><td class="label-cell">Tender Type&nbsp;:</td><td>Request for Proposals (RFP)</td></tr>
				<tr><td class="label-cell">Categories&nbsp;:</td><td>Finance and Insurance Services; Debt collection services</td></tr>
				<tr><td class="label-cell">Regions&nbsp;:</td><td>Auckland; Wellington</td></tr>
				<tr><td class="label-cell">Contact&nbsp;:</td><td>All submissions to be made through the GETS website</td></tr>
			</table>
			<a href="/MSD/DownloadFile.htm?file=rfp.pdf">RFP document.pdf</a>
		`, "https://www.gets.govt.nz/MSD/ExternalTenderDetails.htm?id=34016603");

		expect(detail).toMatchObject({
			rfxId: "34016603",
			reference: "12802",
			tenderType: "Request for Proposals (RFP)",
			categories: ["Finance and Insurance Services", "Debt collection services"],
			regions: ["Auckland", "Wellington"],
			contact: "All submissions to be made through the GETS website",
			documentLinks: [{
				url: "https://www.gets.govt.nz/MSD/DownloadFile.htm?file=rfp.pdf",
				label: "RFP document.pdf",
			}],
		});
		expect(new Date(detail.deadline!).toISOString()).toBe("2099-06-03T00:00:00.000Z");
	});
});
