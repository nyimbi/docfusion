import { describe, expect, it } from "vitest";

import { parseIomProcurementHtml } from "@/lib/scrapers/parsers/iom";

function formatDate(value: unknown): string | undefined {
	if (!(value instanceof Date)) return undefined;
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, "0");
	const day = String(value.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

describe("IOM procurement parser", () => {
	it("extracts procurement table-card rows with deadlines and response documents", () => {
		const html = `
			<div class="view-content">
				<div>
					<ul class="table-row">
						<li data-label="Invitation to Bid (ITB) Ref. No. &amp; Title" class="specifics">
							<h2 class="h5"><a href="/request-proposal-rfp-provision-training-10000-returnee-migrants-guinea-business-and-entrepreneurial-skills" hreflang="en">Request for Proposal (RFP) for the Provision of Training for 10,000 returnee migrants in Guinea in business and entrepreneurial skills</a></h2>
							<h3 class="h2 label">30000026651 (RFP 003/GN10/05/2026)</h3>
							<div class="data" data-preamble="Attachment">
								<p><a href="/sites/g/files/tmzbdl2616/files/procurement/30000026651_supplier_0.pdf">30000026651_SUPPLIER</a></p>
								<p><a href="/sites/g/files/tmzbdl2616/files/procurement/rfp003_1.doc">RFP003_1</a></p>
								<p>Brief Description</p>
								<p>Training for returnee migrants in entrepreneurial skills.</p>
							</div>
						</li>
						<li data-label="Details" class="details">
							<span data-preamble="Category" class="data">Services</span>
							<span data-preamble="Country" class="data">Guinea</span>
							<span data-preamble="Publication Date" class="data">2026-05-26 </span>
							<span data-preamble="Closing Date" class="data">2026-06-24</span>
						</li>
					</ul>
				</div>
				<div>
					<ul class="table-row">
						<li data-label="Invitation to Bid (ITB) Ref. No. &amp; Title" class="specifics">
							<h2 class="h5"><a href="/call-expression-interest-implementing-partners-migrant-protection-and-reintegration-support" hreflang="en">Call for Expression of Interest - Implementing Partners for Migrant Protection and Reintegration Support</a></h2>
							<h3 class="h2 label">CEI-ET10/PXNE01</h3>
							<div class="data" data-preamble="Attachment">
								<p><a href="/sites/g/files/tmzbdl2616/files/procurement/call-for-expression-of-interest_0.docx" title="Call for Expression of Interest">Call for Expression of Interest</a></p>
								<p><strong>Brief Project Description:</strong></p>
								<p>Specialized protection services for vulnerable migrants in Ethiopia.</p>
							</div>
						</li>
						<li data-label="Details" class="details">
							<span data-preamble="Category" class="data">Services</span>
							<span data-preamble="Country" class="data">ETHIOPIA</span>
							<span data-preamble="Publication Date" class="data">2026-05-19 </span>
							<span data-preamble="Closing Date" class="data">2026-06-17</span>
						</li>
					</ul>
				</div>
			</div>
		`;

		const opportunities = parseIomProcurementHtml(html);

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			title: "Request for Proposal (RFP) for the Provision of Training for 10,000 returnee migrants in Guinea in business and entrepreneurial skills",
			source: "iom",
			sourceId: "iom-30000026651-rfp-003-gn10-05-2026",
			noticeId: "30000026651 (RFP 003/GN10/05/2026)",
			organization: "International Organization for Migration",
			countryRegion: "Guinea",
			category: "Services",
			opportunityType: "rfp",
			portalUrl: "https://www.iom.int/request-proposal-rfp-provision-training-10000-returnee-migrants-guinea-business-and-entrepreneurial-skills",
			documentUrl: "https://www.iom.int/sites/g/files/tmzbdl2616/files/procurement/rfp003_1.doc",
		});
		expect(formatDate(opportunities[0].publishedDate)).toBe("2026-05-26");
		expect(formatDate(opportunities[0].deadline)).toBe("2026-06-24");
		expect(opportunities[1]).toMatchObject({
			opportunityType: "eoi",
			documentUrl: "https://www.iom.int/sites/g/files/tmzbdl2616/files/procurement/call-for-expression-of-interest_0.docx",
		});
	});
});
