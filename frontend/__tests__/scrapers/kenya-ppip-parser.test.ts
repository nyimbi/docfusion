import { describe, expect, it } from "vitest";

import { kenyaPpipParser, mapKenyaPpipApiTenderToOpportunity } from "@/lib/scrapers/parsers/kenya-ppip";

describe("Kenya PPIP parser", () => {
	it("parses PPIP HTML tender table rows into opportunity data", async () => {
		const result = await kenyaPpipParser.parse({
			url: "https://tenders.go.ke/tenders",
			html: `
				<table>
					<tbody>
						<tr>
							<td><a href="/tenders/PPIP-2026-001">PPIP-2026-001</a></td>
							<td>Provision of Case Management Platform</td>
							<td>Ministry of ICT</td>
							<td>Request for Proposal</td>
							<td>ICT Services</td>
							<td>31/12/2026</td>
							<td>219 days</td>
							<td>01/05/2026</td>
							<td></td>
							<td><a href="/tenders/PPIP-2026-001">View</a></td>
						</tr>
					</tbody>
				</table>
			`,
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "Provision of Case Management Platform",
				source: "kenya_ppip",
				sourceId: "PPIP-2026-001",
				noticeId: "PPIP-2026-001",
				organization: "Ministry of ICT",
				countryRegion: "Kenya",
				category: "ICT Services",
				portalUrl: "https://tenders.go.ke/tenders/PPIP-2026-001",
			}),
		]);
		expect(result.opportunities[0].deadline).toEqual(new Date(2026, 11, 31));
	});

	it("parses PPIP markdown table rows from scraped content", async () => {
		const result = await kenyaPpipParser.parse({
			url: "https://tenders.go.ke/tenders",
			markdown: [
				"| Tender. No | Description | Procuring_Entity | Proc. Method | Proc. Category | Close Date | Time to Close | Publish Date |",
				"| --- | --- | --- | --- | --- | --- | --- | --- |",
				"| [PPIP-2026-002](/tenders/PPIP-2026-002) | Supply of Data Center Equipment | Kenya Revenue Authority | RFQ | Goods | 15/06/2026 | 20 days | 26/05/2026 |",
			].join("\n"),
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "Supply of Data Center Equipment",
				sourceId: "PPIP-2026-002",
				organization: "Kenya Revenue Authority",
				category: "Goods",
				portalUrl: "https://tenders.go.ke/tenders/PPIP-2026-002",
			}),
		]);
	});

	it("maps PPIP public API tender records into canonical opportunity data", () => {
		const opportunity = mapKenyaPpipApiTenderToOpportunity({
			id: 291563,
			ocid: "ocds-5whusi-291563-GDC/SC/REG/007/2026-2028",
			title: "REGISTRATION OF SUPPLIERS & SERVICE PROVIDERS",
			tender_ref: "GDC/SC/REG/007/2026-2028",
			published_at: "2026-05-26 00:00:00",
			close_at: "2026-06-10 14:00:00",
			addendum_added: 0,
			is_reservation: 1,
			pe: { name: "Geothermal Development Company" },
			procurement_method: { title: "Prequalification", code: "selective" },
			procurement_category: { title: "Goods", code: "goods" },
			submission_methods: [{ title: "Electronic submission", code: "electronicSubmission" }],
			agpo_groups: [{ name: "Women", code: "women" }],
			documents: [{
				url: "/storage/Documents/registration.pdf",
				document_type_id: 1,
				type: { code: "tenderDocument", description: "Tender Document" },
			}],
		});

		expect(opportunity).toEqual(expect.objectContaining({
			title: "REGISTRATION OF SUPPLIERS & SERVICE PROVIDERS",
			source: "kenya_ppip",
			sourceId: "GDC/SC/REG/007/2026-2028",
			noticeId: "GDC/SC/REG/007/2026-2028",
			organization: "Geothermal Development Company",
			countryRegion: "Kenya",
			category: "Goods",
			opportunityType: "tender",
			portalUrl: "https://tenders.go.ke/tenders/291563",
			documentUrl: "https://tenders.go.ke/storage/Documents/registration.pdf",
			rfpLink: "https://tenders.go.ke/storage/Documents/registration.pdf",
			submissionMethod: "Electronic submission",
			tags: ["reservation", "Women"],
		}));
		expect(opportunity?.deadline).toEqual(new Date(2026, 5, 10, 14, 0, 0));
		expect(opportunity?.publishedDate).toEqual(new Date(2026, 4, 26, 0, 0, 0));
	});
});
