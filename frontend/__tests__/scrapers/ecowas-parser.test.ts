import { afterEach, describe, expect, it, vi } from "vitest";

import {
	ECOWAS_PROCUREMENT_URL,
	ecowasParser,
	parseEcowasProcurementDetailHtml,
	parseEcowasProcurementListingHtml,
} from "@/lib/scrapers/parsers/ecowas";

const ecowasListingHtml = `
	<div class="procurement-list">
		<a href="https://www.ecowas.int/nwp_events/invitation-for-bid-solar-power-systems/">
			<small>Closing date: 11 Jun, 2099</small><h6>Invitation for Bid : Solar Power Systems for Primary Health Care Facilities</h6>
		</a>
		<a href="https://www.ecowas.int/nwp_events/consulting-services-for-digital-workspaces/">
			<small>Closing date: 04 Jun, 2099</small><h6>CONSULTING SERVICES FOR THE SELECTION OF A SPECIALIZED FIRM TO DEVELOP DIGITAL WORKSPACES</h6>
		</a>
	</div>
`;

const ecowasDetailHtml = `
	<h3>Invitation for Bid : Solar Power Systems for Primary Health Care Facilities</h3>
	<p>The ECOWAS Commission invites sealed bids for solar power systems.</p>
	<h4 class="text-blue">Downloads</h4>
	<a href="https://www.ecowas.int/wp-content/uploads/2099/05/FINAL-SISS-Request-for-bids.pdf" class="accordion-title" target="_blank">
		FINAL SISS Request for bids <div><span>2.43 MB</span> <span>pdf</span></div>
	</a>
	<a href="https://www.ecowas.int/wp-content/uploads/2099/05/INVITATION-TO-BID.pdf" class="accordion-title" target="_blank">
		INVITATION TO BID <div><span>0.21 MB</span> <span>pdf</span></div>
	</a>
`;

afterEach(() => {
	vi.restoreAllMocks();
	delete process.env.ECOWAS_DETAIL_LIMIT;
});

describe("ECOWAS procurement parser", () => {
	it("extracts open procurement rows with closing dates", () => {
		const rows = parseEcowasProcurementListingHtml(ecowasListingHtml, ECOWAS_PROCUREMENT_URL, new Date("2099-05-31T00:00:00.000Z"));

		expect(rows).toEqual([
			expect.objectContaining({
				title: "Invitation for Bid : Solar Power Systems for Primary Health Care Facilities",
				portalUrl: "https://www.ecowas.int/nwp_events/invitation-for-bid-solar-power-systems/",
				deadlineText: "11 Jun, 2099",
				deadline: new Date("2099-06-11T22:59:00.000Z"),
			}),
			expect.objectContaining({
				title: "CONSULTING SERVICES FOR THE SELECTION OF A SPECIALIZED FIRM TO DEVELOP DIGITAL WORKSPACES",
				portalUrl: "https://www.ecowas.int/nwp_events/consulting-services-for-digital-workspaces/",
			}),
		]);
	});

	it("extracts detail downloads as source documents", () => {
		const detail = parseEcowasProcurementDetailHtml(
			ecowasDetailHtml,
			"https://www.ecowas.int/nwp_events/invitation-for-bid-solar-power-systems/"
		);

		expect(detail).toEqual(expect.objectContaining({
			title: "Invitation for Bid : Solar Power Systems for Primary Health Care Facilities",
			summary: "The ECOWAS Commission invites sealed bids for solar power systems.",
			documentLinks: [
				{
					label: "FINAL SISS Request for bids 2.43 MB pdf",
					url: "https://www.ecowas.int/wp-content/uploads/2099/05/FINAL-SISS-Request-for-bids.pdf",
				},
				{
					label: "INVITATION TO BID 0.21 MB pdf",
					url: "https://www.ecowas.int/wp-content/uploads/2099/05/INVITATION-TO-BID.pdf",
				},
			],
		}));
	});

	it("fetches category listings and enriches detail document packages", async () => {
		process.env.ECOWAS_DETAIL_LIMIT = "1";
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL | Request) => {
			const requestedUrl = String(url);
			if (requestedUrl === "https://www.ecowas.int/nwp_events/invitation-for-bid-solar-power-systems/") {
				return new Response(ecowasDetailHtml, { status: 200, headers: { "content-type": "text/html" } });
			}
			if (requestedUrl.startsWith("https://www.ecowas.int/procurement/")) {
				return new Response(requestedUrl === ECOWAS_PROCUREMENT_URL ? ecowasListingHtml : "", {
					status: 200,
					headers: { "content-type": "text/html" },
				});
			}
			return new Response("not found", { status: 404 });
		});

		const result = await ecowasParser.parse({ url: ECOWAS_PROCUREMENT_URL });

		expect(fetchMock).toHaveBeenCalledTimes(8);
		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0]).toEqual(expect.objectContaining({
			source: "ecowas",
			sourceId: "ecowas-invitation-for-bid-solar-power-systems",
			documentUrl: "https://www.ecowas.int/wp-content/uploads/2099/05/FINAL-SISS-Request-for-bids.pdf",
			tags: ["ecowas", "west-africa", "regional-procurement", "source-documents"],
		}));
	});
});
