import { afterEach, describe, expect, it, vi } from "vitest";

import {
	SADC_PROCUREMENT_URL,
	parseSadcProcurementDetailHtml,
	parseSadcProcurementListingHtml,
	sadcParser,
} from "@/lib/scrapers/parsers/sadc";

const sadcListingHtml = `
	<div class="view-content clearfix">
		<div class="views-view-grid horizontal cols-1 clearfix">
			<div class="col-md-3 col-sm-4 col-xs-6 grid-item">
				<div class="column">
					<div class="views-field views-field-fieldset"><span class="field-content"><div class="date-green">
						<div class="views-field views-field-field-closing-date date-large"><div class="field-content">29</div></div>
						<div class="views-field views-field-field-closing-date-1 date-small"><div class="field-content">Jun 2099</div></div>
					</div></span></div>
					<div class="views-field views-field-title"><span class="field-content"><a href="/procurement-opportunities/individual-consultancy-provide-technical-advice-executive-secretary" hreflang="en">INDIVIDUAL CONSULTANCY TO PROVIDE TECHNICAL ADVICE TO THE EXECUTIVE SECRETARY</a></span></div>
				</div>
			</div>
			<div class="col-md-3 col-sm-4 col-xs-6 grid-item">
				<div class="column">
					<div class="views-field views-field-fieldset"><span class="field-content"><div class="date-green">
						<div class="views-field views-field-field-closing-date date-large"><div class="field-content">31</div></div>
						<div class="views-field views-field-field-closing-date-1 date-small"><div class="field-content">Dec 2099</div></div>
					</div></span></div>
					<div class="views-field views-field-title"><span class="field-content"><a href="/procurement-opportunities/general-procurement-notice" hreflang="en">GENERAL PROCUREMENT NOTICE</a></span></div>
				</div>
			</div>
		</div>
	</div>
`;

const sadcDetailHtml = `
	<div id="page-title">
		<h1><span>INDIVIDUAL CONSULTANCY TO PROVIDE TECHNICAL ADVICE TO THE EXECUTIVE SECRETARY</span></h1>
		<div class="details">
			<p><span>Closing Date:</span> June 29, 2099</p>
			<p><span>Closing Time:</span> 12:00 PM</p>
		</div>
	</div>
	<article class="node node--type-tender">
		<div class="field field--name-body field--type-text-with-summary field--entity-node field--label-hidden field__item">
			<p><strong>REQUEST FOR EXPRESSION OF INTEREST</strong></p>
			<p><strong>Reference Number:</strong> SADC/3/5/2/448</p>
			<p>The Request for Expression of Interest is open to individuals who satisfy the eligibility requirements.</p>
		</div>
		<div class="field field--name-field-attachment field--type-file field--entity-node field--label-hidden field__items clearfix">
			<table><tbody>
				<tr><td><a href="/sites/default/files/2099-05/REOI%20TA%20ES%20OFFICE%20ExAnte.pdf" type="application/pdf">REOI TA ES OFFICE ExAnte.pdf</a></td></tr>
				<tr><td><a href="/sites/default/files/2099-05/SPNIndividual%20Consultant%20TA%20ES%20Office.pdf" type="application/pdf">SPNIndividual Consultant TA ES Office.pdf</a></td></tr>
				<tr><td><a href="/sites/default/files/2099-05/REOI%20-%20TA%20ES%20OFFICE.docx" type="application/vnd.openxmlformats-officedocument.wordprocessingml.document">REOI - TA ES OFFICE.docx</a></td></tr>
			</tbody></table>
		</div>
	</article>
`;

afterEach(() => {
	vi.restoreAllMocks();
	delete process.env.SADC_DETAIL_LIMIT;
});

describe("SADC procurement parser", () => {
	it("extracts open procurement listing cards with closing dates", () => {
		const rows = parseSadcProcurementListingHtml(sadcListingHtml, new Date("2099-05-31T00:00:00.000Z"));

		expect(rows).toEqual([
			expect.objectContaining({
				title: "INDIVIDUAL CONSULTANCY TO PROVIDE TECHNICAL ADVICE TO THE EXECUTIVE SECRETARY",
				portalUrl: "https://www.sadc.int/procurement-opportunities/individual-consultancy-provide-technical-advice-executive-secretary",
				deadlineText: "29 Jun 2099",
				deadline: new Date("2099-06-29T21:59:00.000Z"),
			}),
			expect.objectContaining({
				title: "GENERAL PROCUREMENT NOTICE",
				portalUrl: "https://www.sadc.int/procurement-opportunities/general-procurement-notice",
			}),
		]);
	});

	it("extracts detail references, closing time, and procurement documents", () => {
		const detail = parseSadcProcurementDetailHtml(
			sadcDetailHtml,
			"https://www.sadc.int/procurement-opportunities/individual-consultancy-provide-technical-advice-executive-secretary",
			new Date("2099-05-31T00:00:00.000Z")
		);

		expect(detail).toEqual(expect.objectContaining({
			title: "INDIVIDUAL CONSULTANCY TO PROVIDE TECHNICAL ADVICE TO THE EXECUTIVE SECRETARY",
			reference: "SADC/3/5/2/448",
			deadline: new Date("2099-06-29T10:00:00.000Z"),
			documentLinks: expect.arrayContaining([
				{ label: "REOI - TA ES OFFICE.docx", url: "https://www.sadc.int/sites/default/files/2099-05/REOI%20-%20TA%20ES%20OFFICE.docx" },
			]),
		}));
	});

	it("fetches listing rows and enriches detail document packages", async () => {
		process.env.SADC_DETAIL_LIMIT = "1";
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL | Request) => {
			const requestedUrl = String(url);
			if (requestedUrl === SADC_PROCUREMENT_URL) {
				return new Response(sadcListingHtml, { status: 200, headers: { "content-type": "text/html" } });
			}
			if (requestedUrl === "https://www.sadc.int/procurement-opportunities/individual-consultancy-provide-technical-advice-executive-secretary") {
				return new Response(sadcDetailHtml, { status: 200, headers: { "content-type": "text/html" } });
			}
			return new Response("not found", { status: 404 });
		});

		const result = await sadcParser.parse({ url: SADC_PROCUREMENT_URL });

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0]).toEqual(expect.objectContaining({
			source: "sadc",
			noticeId: "SADC/3/5/2/448",
			documentUrl: "https://www.sadc.int/sites/default/files/2099-05/REOI%20TA%20ES%20OFFICE%20ExAnte.pdf",
			tags: ["sadc", "southern-africa", "regional-procurement", "source-documents"],
		}));
	});
});
