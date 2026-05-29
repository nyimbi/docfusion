import { describe, expect, it } from "vitest";

import { parseCdbProcurementHtml } from "@/lib/scrapers/parsers/cdb";

describe("CDB procurement parser", () => {
	it("extracts current procurement notices with type, country, and deadlines", () => {
		const html = `
			<table>
				<tbody>
					<tr>
						<td headers="view-field-cdb-role-service-table-column">
							<span><a href="/work-with-us/procurement/procurement-notices/basic-needs-trust-fund-eleventh-cycle">Consultancy Services for the Design and Supervision of Infrastructure Works</a></span>
						</td>
						<td headers="view-field-sector-tag-table-column"><span>Infrastructure</span></td>
						<td headers="view-field-cdb-country-tag-table-column"><span>Saint Vincent and the Grenadines</span></td>
						<td headers="view-field-cdb-contract-awards-type-table-column"><span>Consultancy</span></td>
						<td headers="view-field-date-of-approval-table-column">
							<span><time datetime="2026-06-05T12:00:00Z">Jun 5, 2026</time><br>04:30 PM</span>
						</td>
					</tr>
					<tr>
						<td headers="view-field-cdb-role-service-table-column">
							<span><a href="/work-with-us/procurement/procurement-notices/implementation-multi-hazard-impact-based-forecasting">Supply of one Geonetcast-Americas Satellite Reception System - MET/MHIBFEWSP/ITB003/26</a></span>
						</td>
						<td headers="view-field-sector-tag-table-column"><span>Climate</span></td>
						<td headers="view-field-cdb-country-tag-table-column"><span>Belize</span></td>
						<td headers="view-field-cdb-contract-awards-type-table-column"><span>Goods</span></td>
						<td headers="view-field-date-of-approval-table-column">
							<span><time datetime="2026-06-08T12:00:00Z">Jun 8, 2026</time></span>
						</td>
					</tr>
				</tbody>
			</table>
		`;

		const opportunities = parseCdbProcurementHtml(html);

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			title: "Consultancy Services for the Design and Supervision of Infrastructure Works",
			source: "cdb",
			sourceId: "cdb-basic-needs-trust-fund-eleventh-cycle",
			organization: "Caribbean Development Bank",
			countryRegion: "Saint Vincent and the Grenadines",
			category: "Consultancy",
			opportunityType: "rfp",
			portalUrl: "https://www.caribank.org/work-with-us/procurement/procurement-notices/basic-needs-trust-fund-eleventh-cycle",
			tags: expect.arrayContaining(["cdb", "development-bank", "regional-procurement"]),
		});
		expect(opportunities[0].deadline).toBeInstanceOf(Date);
		const deadline = opportunities[0].deadline as Date;
		expect(deadline.getFullYear()).toBe(2026);
		expect(deadline.getMonth()).toBe(5);
		expect(deadline.getDate()).toBe(5);
		expect(opportunities[1]).toMatchObject({
			category: "Goods",
			countryRegion: "Belize",
			opportunityType: "tender",
		});
	});
});
