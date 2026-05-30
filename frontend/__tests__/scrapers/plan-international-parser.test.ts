import { describe, expect, it } from "vitest";

import { planInternationalParser } from "@/lib/scrapers/parsers/plan-international";

describe("Plan International parser", () => {
	it("extracts tender headings with their matching ZIP packages", async () => {
		const result = await planInternationalParser.parse({
			url: "https://plan-international.org/calls-tender/",
			html: `
				<h2 class="wp-block-heading">Calls for tender</h2>
				<h3 class="wp-block-heading">RFQ FY26-214 Child Protection and Humanitarian Diplomacy </h3>
				<p>Plan International Global Hub invites proposals for child protection and humanitarian diplomacy.</p>
				<p>Responses should be submitted no later than 23:59 (GMT) on 27th April 2026.</p>
				<div class="wp-block-qala-blocks-download-block">
					<p class="wp-block-qala-blocks-download-block__title">RFQ FY26-214</p>
					<a href="https://plan-international.org/uploads/2026/04/RFQ-FY26-214-1.zip" class="wp-block-button__link">Download</a>
				</div>
				<h3 class="wp-block-heading">RFQ FY26-215 Children in Mixed Movements (extended deadline to 1st May)</h3>
				<p>Plan International is seeking a consultant to support children in mixed movements.</p>
				<p>Responses should be submitted no later than 23:59 (GMT) on 1st May 2026.</p>
				<div class="wp-block-qala-blocks-download-block">
					<p class="wp-block-qala-blocks-download-block__title">RFQ FY26-215</p>
					<a href="/uploads/2026/04/RFQ-FY26-215-2.zip" class="wp-block-button__link">Download</a>
				</div>
				<h3 class="wp-block-heading">ITT FY26-002 Hygiene Kits</h3>
				<p>Plan International El Salvador is inviting interested parties to submit proposals.</p>
				<p>Please use reference <strong>ITT FY26 - 002 Hygiene Kits</strong> in all communications.</p>
				<p>Responses should be submitted no later than 25th May 2026.</p>
				<h3 class="wp-block-heading"></h3>
				<div class="wp-block-qala-blocks-download-block">
					<p class="wp-block-qala-blocks-download-block__title">LC FY26-002 - Invitacion a licitar kits higiene</p>
					<a href="/uploads/2026/04/LC-FY26-002-Invitacion-a-licitar-kits-higiene.pdf" class="wp-block-button__link">Download</a>
				</div>
				<h3 class="wp-block-heading"><strong>Licitaci&oacute;n Internacional Nro. FY26-003 - Suministro de Insumos Agr&iacute;colas</strong></h3>
				<p>Plan International El Salvador is inviting interested parties to submit proposals.</p>
				<p>Responses should be submitted no later than 8th June 2026.</p>
				<div class="wp-block-qala-blocks-download-block">
					<p class="wp-block-qala-blocks-download-block__title">LC FY26-003 - Agricola Ferreteria</p>
					<a href="/uploads/2026/05/LC-FY26-003-Agricola-Ferreteria.pdf" class="wp-block-button__link">Download</a>
				</div>
			`,
		});

		expect(result.opportunities).toHaveLength(4);
		expect(result.opportunities[0]).toEqual(expect.objectContaining({
			title: "RFQ FY26-214 Child Protection and Humanitarian Diplomacy",
			source: "plan_international",
			sourceId: "plan-international-rfq-fy26-214",
			organization: "Plan International",
			opportunityType: "tender",
			portalUrl: "https://plan-international.org/calls-tender/",
			documentUrl: "https://plan-international.org/uploads/2026/04/RFQ-FY26-214-1.zip",
			rfpLink: "https://plan-international.org/uploads/2026/04/RFQ-FY26-214-1.zip",
		}));
		expect(result.opportunities[0]?.deadline).toBeInstanceOf(Date);
		expect(result.opportunities[1]).toEqual(expect.objectContaining({
			title: "RFQ FY26-215 Children in Mixed Movements (extended deadline to 1st May)",
			sourceId: "plan-international-rfq-fy26-215",
			documentUrl: "https://plan-international.org/uploads/2026/04/RFQ-FY26-215-2.zip",
		}));
		expect(result.opportunities[2]).toEqual(expect.objectContaining({
			title: "ITT FY26-002 Hygiene Kits",
			sourceId: "plan-international-itt-fy26-002",
			documentUrl: "https://plan-international.org/uploads/2026/04/LC-FY26-002-Invitacion-a-licitar-kits-higiene.pdf",
		}));
		expect(result.opportunities[3]).toEqual(expect.objectContaining({
			title: "Licitación Internacional Nro. FY26-003 - Suministro de Insumos Agrícolas",
			sourceId: "plan-international-lc-fy26-003",
			documentUrl: "https://plan-international.org/uploads/2026/05/LC-FY26-003-Agricola-Ferreteria.pdf",
		}));
	});
});
