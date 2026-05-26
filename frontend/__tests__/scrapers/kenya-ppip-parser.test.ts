import { describe, expect, it } from "vitest";

import { kenyaPpipParser } from "@/lib/scrapers/parsers/kenya-ppip";

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
});
