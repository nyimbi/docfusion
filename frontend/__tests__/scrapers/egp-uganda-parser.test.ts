import { describe, expect, it } from "vitest";

import { parseEgpUgandaApiPayload, parseEgpUgandaHtml } from "@/lib/scrapers/parsers/egp-uganda";

function formatLocalDate(value: unknown): string | undefined {
	if (!(value instanceof Date)) return undefined;
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, "0");
	const day = String(value.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

describe("Uganda eGP parser", () => {
	it("extracts bid-notice table rows with entities and deadlines", () => {
		const html = `
			<table>
				<tbody>
					<tr>
						<td>
							<a href="https://egpuganda.go.ug/index/379727102_egp" class="text-default font-weight-semibold">UCAA/WRKS/2025-2026/00032
								<div class="text-muted font-size-sm">
									<span class="badge badge-mark border-indigo-300 mr-1"></span>
									Uganda Civil Aviation Authority
								</div>
							</a>
						</td>
						<td><span class="badge bg-indigo-300">Works</span></td>
						<td><span class="text-muted">SUPPLY AND INSTALLATION OF 1250kVA GENERATOR</span></td>
						<td><span class="text-success-600">2026-05-27</span></td>
						<td><span class="text-success-600">2026-06-18</span></td>
						<td><a href="https://egpuganda.go.ug/index/379727102_egp">View details</a></td>
					</tr>
					<tr>
						<td>
							<a href="/index/376033704_egp" class="text-default font-weight-semibold">MOFPED/NCONS/2025-2026/00981
								<div class="text-muted font-size-sm">
									<span class="badge badge-mark border-indigo-300 mr-1"></span>
									Ministry of Finance, Planning and Economic Development
								</div>
							</a>
						</td>
						<td><span class="badge bg-indigo-300">Non Consultancy Services</span></td>
						<td><span class="text-muted">REQUEST TO PROCURE FUMIGATION AND DISINFECTION SERVICES</span></td>
						<td><span class="text-success-600">2026-05-15</span></td>
						<td><span class="text-success-600">2026-06-19</span></td>
						<td><a href="/index/376033704_egp">View details</a></td>
					</tr>
				</tbody>
			</table>
		`;

		const opportunities = parseEgpUgandaHtml(html);

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			title: "SUPPLY AND INSTALLATION OF 1250kVA GENERATOR",
			source: "egp_uganda",
			noticeId: "379727102_egp",
			organization: "Uganda Civil Aviation Authority",
			countryRegion: "Uganda",
			category: "Works",
			opportunityType: "tender",
			portalUrl: "https://egpuganda.go.ug/index/379727102_egp",
			rfpLink: "https://egpuganda.go.ug/index/379727102_egp",
		});
		expect(formatLocalDate(opportunities[0].publishedDate)).toBe("2026-05-27");
		expect(formatLocalDate(opportunities[0].deadline)).toBe("2026-06-18");
		expect(opportunities[1]).toMatchObject({
			title: "REQUEST TO PROCURE FUMIGATION AND DISINFECTION SERVICES",
			organization: "Ministry of Finance, Planning and Economic Development",
			category: "Non Consultancy Services",
			opportunityType: "rfp",
			portalUrl: "https://egpuganda.go.ug/index/376033704_egp",
		});
	});

	it("extracts active bid invitations from the PPDA GPP API", () => {
		const opportunities = parseEgpUgandaApiPayload({
			success: true,
			data: {
				data: [{
					id: 96999,
					ocds_id: "ocds-rdvc92-981777898266",
					procurement_reference_no: "NIRA/SUPLS/2026-2027/00001",
					invitation_to_bid_date: "2026-07-06",
					bid_submission_deadline_date: "2026-07-31 00:00:00",
					bid_submission_deadline_time: "12:00:00",
					estimated_amount: 1000000000,
					estimated_amount_currency: { abbreviation: "UGX" },
					procurement_method: { title: "Request for Quotations/Proposals (RFQ/P)" },
					procurement_plan_entry: {
						subject_of_procurement: "Procurement of motor vehicles for ED's Office",
						procurement_type: { title: "Supplies", ocds_code: "goods" },
						funding_source: { title: "Government of Uganda" },
					},
					pdes: {
						title: "National Identification and Registration Authority",
						abbreviation: "NIRA",
						category: "Central Government",
					},
				}, {
					id: 90000,
					procurement_reference_no: "EXPIRED/SUPLS/2025-2026/00001",
					bid_submission_deadline_date: "2026-04-01 00:00:00",
					procurement_plan_entry: {
						subject_of_procurement: "Expired printer supplies",
					},
				}],
			},
		}, new Date(2026, 4, 29));

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toMatchObject({
			title: "Procurement of motor vehicles for ED's Office",
			source: "egp_uganda",
			sourceId: "ocds-rdvc92-981777898266",
			noticeId: "NIRA/SUPLS/2026-2027/00001",
			organization: "National Identification and Registration Authority",
			countryRegion: "Uganda",
			category: "Supplies",
			opportunityType: "rfp",
			portalUrl: "https://gpp.ppda.go.ug/public/bid-invitations/tender-notice/96999",
			rfpLink: "https://gpp.ppda.go.ug/public/bid-invitations/tender-notice/96999",
			budgetNumeric: 1000000000,
			budgetCurrency: "UGX",
			funder: "Government of Uganda",
		});
		expect(formatLocalDate(opportunities[0].publishedDate)).toBe("2026-07-06");
		expect(formatLocalDate(opportunities[0].deadline)).toBe("2026-07-31");
	});
});
