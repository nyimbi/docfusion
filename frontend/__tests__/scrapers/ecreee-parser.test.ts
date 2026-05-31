import { afterEach, describe, expect, it, vi } from "vitest";

import {
	ECREEE_PROCUREMENT_URL,
	ecreeeParser,
	parseEcreeeProcurementDetailHtml,
	parseEcreeeProcurementListingHtml,
} from "@/lib/scrapers/parsers/ecreee";

const ecreeeListingHtml = `
	<article class="style-three post category-procurement-notices">
		<div class="post-meta">
			<span><i class="fa fa-calendar"></i> May 18, 2099</span>
		</div>
		<header class="entry-header">
			<h3 class="entry-title">
				<a href="https://www.ecreee.org/call-for-expressions-of-interest-warep-phase-1/" rel="bookmark">
					Call for Expressions of Interest: Consultancy for the WAREP Completion Report
				</a>
			</h3>
		</header>
		<div class="entry-content">ECREEE invites qualified consultants for a West Africa regional energy assignment.</div>
	</article>
	<article class="style-three post category-procurement-notices">
		<div class="post-meta"><span><i class="fa fa-calendar"></i> March 19, 2099</span></div>
		<h3 class="entry-title">
			<a href="https://www.ecreee.org/procurement-notice-reccawa-project-implementation-unit-procurement-specialist/">
				Procurement notice: ReCCAWA Project Implementation Unit - Procurement Specialist
			</a>
		</h3>
		<div class="entry-content">Project: Regional Clean Cooking Action in West Africa.</div>
	</article>
`;

const ecreeeDetailHtml = `
	<article class="single-post category-procurement-notices">
		<h1 class="entry-title">Call for Expressions of Interest: Consultancy for the WAREP Completion Report</h1>
		<time class="entry-date published" datetime="2099-05-18T22:01:22-01:00">May 18, 2099</time>
		<div class="entry-content default-page">
			<table><tbody><tr><td>
				<div class="field-name-field-procurement-id"><h3>Procurement ID:</h3><div class="field-item odd">ECR/WAREP/EOI/2099/01</div></div>
			</td><td>
				<div class="field-name-field-procurment-dead-line"><h3>Deadline:</h3><div class="field-item odd"><span class="date-display-single">Wednesday, June 22, 2099 - 23:59</span></div></div>
			</td></tr></tbody></table>
			<p>The ECOWAS Centre for Renewable Energy and Energy Efficiency invites qualified consultants.</p>
			<p>Applications must be submitted before the deadline.</p>
			<div style="width:100%;"><h3>Attachments</h3><ul class="post-attachments">
				<li><a href="https://www.ecreee.org/wp-content/uploads/2099/05/WAREP-Terms-of-Reference.pdf">WAREP Terms of Reference</a></li>
				<li><a href="/wp-content/uploads/2099/05/WAREP-Application-Form.docx">Application form</a></li>
			</ul></div>
			<div class="clearfix"></div>
		</div>
	</article>
`;

afterEach(() => {
	vi.restoreAllMocks();
	delete process.env.ECREEE_DETAIL_LIMIT;
	delete process.env.ECREEE_PAGE_LIMIT;
});

describe("ECREEE procurement parser", () => {
	it("extracts procurement-notice archive rows with published dates", () => {
		const rows = parseEcreeeProcurementListingHtml(ecreeeListingHtml, ECREEE_PROCUREMENT_URL, new Date("2099-05-31T00:00:00.000Z"));

		expect(rows).toEqual([
			expect.objectContaining({
				title: "Call for Expressions of Interest: Consultancy for the WAREP Completion Report",
				portalUrl: "https://www.ecreee.org/call-for-expressions-of-interest-warep-phase-1/",
				publishedDate: new Date("2099-05-19T00:59:00.000Z"),
				publishedDateText: "May 18, 2099",
			}),
			expect.objectContaining({
				title: "Procurement notice: ReCCAWA Project Implementation Unit - Procurement Specialist",
				portalUrl: "https://www.ecreee.org/procurement-notice-reccawa-project-implementation-unit-procurement-specialist/",
			}),
		]);
	});

	it("extracts detail deadlines, procurement IDs, and source documents", () => {
		const detail = parseEcreeeProcurementDetailHtml(
			ecreeeDetailHtml,
			"https://www.ecreee.org/call-for-expressions-of-interest-warep-phase-1/",
			new Date("2099-05-31T00:00:00.000Z")
		);

		expect(detail).toEqual(expect.objectContaining({
			title: "Call for Expressions of Interest: Consultancy for the WAREP Completion Report",
			procurementId: "ECR/WAREP/EOI/2099/01",
			deadlineText: "Wednesday, June 22, 2099 - 23:59",
			deadline: new Date("2099-06-23T00:59:00.000Z"),
			documentLinks: [
				{
					label: "WAREP Terms of Reference",
					url: "https://www.ecreee.org/wp-content/uploads/2099/05/WAREP-Terms-of-Reference.pdf",
				},
				{
					label: "Application form",
					url: "https://www.ecreee.org/wp-content/uploads/2099/05/WAREP-Application-Form.docx",
				},
			],
		}));
	});

	it("drops detail pages whose structured deadline has expired", () => {
		const detail = parseEcreeeProcurementDetailHtml(
			ecreeeDetailHtml.replace("Wednesday, June 22, 2099 - 23:59", "Wednesday, April 22, 2020 - 23:59"),
			"https://www.ecreee.org/call-for-expressions-of-interest-warep-phase-1/",
			new Date("2099-05-31T00:00:00.000Z")
		);

		expect(detail).toBeUndefined();
	});

	it("fetches bounded archive pages and enriches detail document packages", async () => {
		process.env.ECREEE_DETAIL_LIMIT = "1";
		process.env.ECREEE_PAGE_LIMIT = "1";
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL | Request) => {
			const requestedUrl = String(url);
			if (requestedUrl === ECREEE_PROCUREMENT_URL) {
				return new Response(ecreeeListingHtml, { status: 200, headers: { "content-type": "text/html" } });
			}
			if (requestedUrl === "https://www.ecreee.org/call-for-expressions-of-interest-warep-phase-1/") {
				return new Response(ecreeeDetailHtml, { status: 200, headers: { "content-type": "text/html" } });
			}
			return new Response("not found", { status: 404 });
		});

		const result = await ecreeeParser.parse({ url: ECREEE_PROCUREMENT_URL });

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0]).toEqual(expect.objectContaining({
			source: "ecreee",
			sourceId: "ecreee-call-for-expressions-of-interest-warep-phase-1",
			noticeId: "ECR/WAREP/EOI/2099/01",
			documentUrl: "https://www.ecreee.org/wp-content/uploads/2099/05/WAREP-Terms-of-Reference.pdf",
			tags: ["ecreee", "ecowas", "west-africa", "renewable-energy", "source-documents"],
		}));
	});
});
