import { describe, expect, it } from "vitest";

import { unProcurementParser } from "@/lib/scrapers/parsers/un-procurement";

const renderedListingHtml = `
<ul>
	<li class="views-row">
		<div class="views-field views-field-title custom-card-title">WS2006276746</div>
		<div class="date-country">
			<span class="card-date-label">Date</span>
			<span class="start">09 Jun 2026 </span>
			<span class="end">12 Jun 2026</span>
			<span class="time"><time datetime="2026-06-09T15:00:00Z" class="datetime">15:00</time></span>
		</div>
		<div class="views-field views-field-field-text-75-1 custom-card-title-field">
			<div class="field-content">Provision of Cisco Core, Distribution and Datacenter Solutions</div>
		</div>
		<div class="views-field views-field-name tender-custom-field tender-commodity-group-field">
			<span class="views-label views-label-name">Commodity Group</span>
			<span class="field-content">Communications Equipment</span>
		</div>
		<div class="views-field views-field-nothing card-buttons">
			<div class="field-content">
				<a href="https://www.un.org/Depts/ptd/sites/www.un.org.Depts.ptd/files/pdf/eoi24446.pdf" target="_blank" class="download-pdf-btn btn btn-secondary">PDF Instructions</a>
				<a href="https://www.ungm.org/Public/Notice/302351" class="btn btn-secondary" target="_blank" aria-label="Express interest for WS2006276746">Express Interest</a>
			</div>
		</div>
	</li>
	<li class="views-row">
		<div class="views-field views-field-title custom-card-title">WS218437701</div>
		<div class="date-country">
			<span class="start">04 Jun 2026 </span>
			<span class="time"><time datetime="2026-06-04T15:00:00Z" class="datetime">15:00</time></span>
		</div>
		<div class="views-field views-field-field-text-75-1 custom-card-title-field">
			<div class="field-content">Construction of new boreholes and repair of existing boreholes in Haiti</div>
		</div>
		<div class="views-field views-field-name tender-custom-field tender-commodity-group-field">
			<span class="field-content">Engineering</span>
		</div>
	</li>
</ul>
`;

describe("UN Procurement parser", () => {
	it("extracts rendered solicitation cards from browser-service HTML", async () => {
		const result = await unProcurementParser.parse({
			url: "https://www.un.org/procurement/solicitations-opportunities",
			markdown: renderedListingHtml,
			links: [],
		});

		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0]).toMatchObject({
			title: "Provision of Cisco Core, Distribution and Datacenter Solutions",
			source: "un_procurement",
			sourceId: "un-procurement-ws2006276746",
			noticeId: "WS2006276746",
			organization: "United Nations Procurement Division",
			countryRegion: "Global",
			category: "Communications Equipment",
			opportunityType: "tender",
			portalUrl: "https://www.un.org/procurement/solicitations-opportunities",
			documentUrl: "https://www.un.org/Depts/ptd/sites/www.un.org.Depts.ptd/files/pdf/eoi24446.pdf",
			rfpLink: "https://www.un.org/Depts/ptd/sites/www.un.org.Depts.ptd/files/pdf/eoi24446.pdf",
			submissionMethod: "Monitor UN Procurement solicitation details and follow the published tender instructions.",
			tags: ["un-procurement", "unpd", "solicitation"],
			metadata: {
				unProcurement: expect.objectContaining({
					sourceUrl: "https://www.un.org/procurement/solicitations-opportunities",
					noticeId: "WS2006276746",
					commodityGroup: "Communications Equipment",
					expressInterestUrl: "https://www.ungm.org/Public/Notice/302351",
				}),
			},
		});
		expect(result.opportunities[0]?.deadline).toEqual(new Date(2026, 5, 12));
		expect(result.opportunities[1]).toMatchObject({
			title: "Construction of new boreholes and repair of existing boreholes in Haiti",
			category: "Engineering",
		});
	});
});
