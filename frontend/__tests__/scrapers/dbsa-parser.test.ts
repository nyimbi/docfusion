import { afterEach, describe, expect, it, vi } from "vitest";

import {
	DBSA_PROCUREMENT_URL,
	dbsaParser,
	parseDbsaProcurementHtml,
} from "@/lib/scrapers/parsers/dbsa";

const dbsaTableHtml = `
	<table class="table">
		<thead><tr><th>OPEN RFP's and RFR's</th><th>Date Published</th><th>Closing Date and Time</th></tr></thead>
		<tbody>
			<tr>
				<td>
					<strong>RFP 090/2099:</strong> Appointment of a Integrated Digital Marketing and Development Partner
					<br><a href="/sites/ppdf.dbsa.org/files/media/documents/2099-05/RFP090-2099%20Digital%20Agency.pdf">Tender Volume</a>
					<br><strong>Compulsory Briefing Session:</strong> 8 June 2099 @ 10H00 via Microsoft Teams
				</td>
				<td>26 May 2099</td>
				<td>19 June 2099 at 23H55</td>
			</tr>
			<tr>
				<td>
					<strong>RFI 002/2099:</strong> Scan of Onsite Greywater / Blackwater / Wastewater Treatment Technologies and Service Offerings for South Africa
					<br><a href="/sites/default/files/media/documents/2099-05/RFI002.2099%20WESS%20Technologies%20Database%20.pdf">Tender Volume</a>,
					<a href="/sites/default/files/media/documents/2099-05/RFI002.2099%20WESS%20Response%20Form%20%28ANNEXURE%20A%29.zip">Annexure A</a>
				</td>
				<td>6 May 2099</td>
				<td>19 June 2099 at 23H55</td>
			</tr>
		</tbody>
	</table>
`;

afterEach(() => {
	vi.restoreAllMocks();
});

describe("DBSA procurement parser", () => {
	it("extracts open RFP/RFI table rows with direct documents and closing dates", () => {
		const opportunities = parseDbsaProcurementHtml(dbsaTableHtml, new Date("2099-05-31T00:00:00.000Z"));

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toEqual(expect.objectContaining({
			title: "RFP 090/2099: Appointment of a Integrated Digital Marketing and Development Partner",
			source: "dbsa",
			sourceId: "dbsa-rfp-090-2099",
			noticeId: "RFP 090/2099",
			organization: "Development Bank of Southern Africa",
			countryRegion: "South Africa",
			opportunityType: "rfp",
			documentUrl: "https://www.dbsa.org/sites/ppdf.dbsa.org/files/media/documents/2099-05/RFP090-2099%20Digital%20Agency.pdf",
			tags: expect.arrayContaining(["dbsa", "south-africa", "source-documents"]),
		}));
		expect(opportunities[0]?.deadline).toEqual(new Date("2099-06-19T21:55:00.000Z"));
		expect(opportunities[1]).toEqual(expect.objectContaining({
			noticeId: "RFI 002/2099",
			opportunityType: "eoi",
			metadata: {
				dbsa: expect.objectContaining({
					documentLinks: expect.arrayContaining([
						{ label: "Annexure A", url: "https://www.dbsa.org/sites/default/files/media/documents/2099-05/RFI002.2099%20WESS%20Response%20Form%20%28ANNEXURE%20A%29.zip" },
					]),
				}),
			},
		}));
	});

	it("uses the source parser path when no HTML is supplied", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(dbsaTableHtml, { status: 200, headers: { "content-type": "text/html" } })
		);

		const result = await dbsaParser.parse({ url: DBSA_PROCUREMENT_URL });

		expect(fetchMock).toHaveBeenCalledWith(DBSA_PROCUREMENT_URL, expect.any(Object));
		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0]?.source).toBe("dbsa");
	});
});
