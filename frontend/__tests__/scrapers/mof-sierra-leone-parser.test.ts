import { describe, expect, it } from "vitest";

import {
	MOF_SIERRA_LEONE_PUBLIC_NOTICES_URL,
	mofSierraLeoneParser,
	parseMofSierraLeonePublicNoticesHtml,
} from "@/lib/scrapers/parsers/mof-sierra-leone";

const publicNoticesHtml = `
	<table class="posts-data-table">
		<tbody>
			<tr id="post-row-11472" class="post-row post-type-documents documents-11472 publish">
				<td></td>
				<td><a href="https://mof.gov.sl/documents/fiscal-reports-for-april-2026/">Fiscal Reports for April 2026</a></td>
				<td data-sort="1779988447">May 28, 2026</td>
				<td><p><a class="btn btn-default" href="https://mof.gov.sl/wp-content/uploads/2026/05/Fiscal-reports-April-2026.pdf">DOWNLOAD</a></p></td>
			</tr>
			<tr id="post-row-11420" class="post-row post-type-documents documents-11420 publish">
				<td></td>
				<td><a href="https://mof.gov.sl/documents/spn-development-customization-installation-implementation-commissioning-and-support-of-a-public-investment-management-information-system-pimis/">SPN: Development/Customization, Installation, Implementation, Commissioning and Support of a Public Investment Management Information System (PIMIS)</a></td>
				<td data-sort="1779297872">May 20, 2026</td>
				<td><p><a class="btn btn-default" href="https://mof.gov.sl/wp-content/uploads/2026/05/Specific-Procurement-Notice-PIMIS.pdf" target="_blank" rel="noopener">DOWNLOAD</a></p></td>
			</tr>
			<tr id="post-row-11417" class="post-row post-type-documents documents-11417 publish">
				<td></td>
				<td><a href="/documents/reoi-consulting-services-for-a-firm-to-rollout-the-municipal-property-tax-system-mpts-in-bo-and-koidu-new-sembehun-city-councils/">REOI: Consulting Services for a Firm to Rollout the Municipal Property Tax System (MPTS) in Bo and Koidu New Sembehun City Councils</a></td>
				<td data-sort="1779297622">May 20, 2026</td>
				<td><p><a class="btn btn-default" href="/wp-content/uploads/2026/05/REoI-for-Tax-System_RUSLP.pdf">DOWNLOAD</a></p></td>
			</tr>
			<tr id="post-row-11236" class="post-row post-type-documents documents-11236 publish">
				<td></td>
				<td><a href="/documents/reoi-fiduciary-services-to-improve-financial-transparency-and-accountability-of-edsas-financial-operations/">REOI: Fiduciary Services to improve financial transparency and accountability of EDSA's financial operations</a></td>
				<td data-sort="1770222036">February 4, 2026</td>
				<td><p><a class="btn btn-default" href="/wp-content/uploads/2026/01/FY2024-Fiscal-Report_270126.pdf">DOWNLOAD</a></p></td>
			</tr>
		</tbody>
	</table>
`;

describe("Sierra Leone Ministry of Finance public notices parser", () => {
	it("extracts procurement notices and linked source documents from the public notices table", () => {
		const opportunities = parseMofSierraLeonePublicNoticesHtml(publicNoticesHtml, MOF_SIERRA_LEONE_PUBLIC_NOTICES_URL);

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			title: "SPN: Development/Customization, Installation, Implementation, Commissioning and Support of a Public Investment Management Information System (PIMIS)",
			source: "mof_sierra_leone",
			sourceId: "mof-sierra-leone-specific-procurement-notice-pimis",
			organization: "Ministry of Finance, Sierra Leone",
			countryRegion: "Sierra Leone",
			category: "Request for proposal",
			opportunityType: "rfp",
			publishedDate: new Date("2026-05-20T12:00:00.000Z"),
			documentUrl: "https://mof.gov.sl/wp-content/uploads/2026/05/Specific-Procurement-Notice-PIMIS.pdf",
			rfpLink: "https://mof.gov.sl/wp-content/uploads/2026/05/Specific-Procurement-Notice-PIMIS.pdf",
			tags: ["sierra-leone", "ministry-of-finance", "national-procurement", "source-documents"],
		});
		expect(opportunities[0].metadata.mofSierraLeone.documentLinks).toEqual([
			{
				label: "DOWNLOAD",
				url: "https://mof.gov.sl/wp-content/uploads/2026/05/Specific-Procurement-Notice-PIMIS.pdf",
			},
		]);
		expect(opportunities[1]).toMatchObject({
			sourceId: "mof-sierra-leone-reoi-for-tax-system-ruslp",
			category: "Request for expression of interest",
			opportunityType: "eoi",
			documentUrl: "https://mof.gov.sl/wp-content/uploads/2026/05/REoI-for-Tax-System_RUSLP.pdf",
		});
	});

	it("uses the registered parser entrypoint", async () => {
		const result = await mofSierraLeoneParser.parse({
			url: MOF_SIERRA_LEONE_PUBLIC_NOTICES_URL,
			html: publicNoticesHtml,
		});

		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0].source).toBe("mof_sierra_leone");
	});
});
