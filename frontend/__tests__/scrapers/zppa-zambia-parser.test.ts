import { describe, expect, it } from "vitest";

import { parseZppaCurrentTendersHtml, zppaZambiaParser } from "@/lib/scrapers/parsers/zppa-zambia";

const currentTendersHtml = `
	<table id="T01">
		<tbody>
			<tr>
				<td>1</td>
				<td style="display:block; text-align:left">
					<a href="/epps/cft/prepareViewCfTWS.do?resourceId=26779544">TENDER FOR UPGRADING OF THE CCTV NVRS FROM ACCUSENSE TO ACUSEEK ANALYTIC</a>
				</td>
				<td>Zambia Revenue Authority</td>
				<td><img src="/epps/images/icon_information.gif" alt="Description" title="CCTV upgrade" /></td>
				<td>Tue Jun 30 10:00:00 CAT 2026</td>
				<td>Open Bidding National</td>
				<td>Bid Submission</td>
				<td><a href="/epps/cft/downloadNoticeForAdvSearch.do?resourceId=26779544"><img src="/epps/images/acrobat.gif" alt="Contract Notice PDF" /></a></td>
				<td></td>
			</tr>
			<tr>
				<td>2</td>
				<td style="display:block; text-align:left">
					<a href="/epps/cft/prepareViewCfTWS.do?resourceId=26727778">Tender for the provision of consultancy services to conduct a Culture Audit and Transformation Programme</a>
				</td>
				<td>National Pension Scheme Authority</td>
				<td></td>
				<td>Mon Jun 29 14:00:00 CAT 2026</td>
				<td>Open Bidding National</td>
				<td>Bid Submission</td>
				<td><a href="/epps/cft/downloadNoticeForAdvSearch.do?resourceId=26727778"><img src="/epps/images/acrobat.gif" /></a></td>
				<td></td>
			</tr>
		</tbody>
	</table>
`;

describe("ZPPA Zambia parser", () => {
	it("extracts current ZPPA tender rows with CAT deadlines and notice PDFs", () => {
		const opportunities = parseZppaCurrentTendersHtml(currentTendersHtml);

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			title: "TENDER FOR UPGRADING OF THE CCTV NVRS FROM ACCUSENSE TO ACUSEEK ANALYTIC",
			source: "zppa_zambia",
			sourceId: "zppa-26779544",
			noticeId: "26779544",
			organization: "Zambia Revenue Authority",
			countryRegion: "Zambia",
			category: "Open Bidding National",
			opportunityType: "tender",
			portalUrl: "https://eprocure.zppa.org.zm/epps/cft/prepareViewCfTWS.do?resourceId=26779544",
			documentUrl: "https://eprocure.zppa.org.zm/epps/cft/downloadNoticeForAdvSearch.do?resourceId=26779544",
		});
		expect(opportunities[0]?.deadline).toEqual(new Date("Tue Jun 30 10:00:00 GMT+0200 2026"));
		expect(opportunities[1]).toMatchObject({
			sourceId: "zppa-26727778",
			opportunityType: "rfp",
			organization: "National Pension Scheme Authority",
		});
	});

	it("supports the TenderParser interface from provided HTML", async () => {
		const result = await zppaZambiaParser.parse({
			html: currentTendersHtml,
			url: "https://eprocure.zppa.org.zm/epps/quickSearchAction.do?searchSelect=6",
		});

		expect(result.error).toBeUndefined();
		expect(result.opportunities.map((opportunity) => opportunity.sourceId)).toEqual([
			"zppa-26779544",
			"zppa-26727778",
		]);
		expect(zppaZambiaParser.getPageUrl("https://eprocure.zppa.org.zm/epps/quickSearchAction.do?searchSelect=6", 2))
			.toContain("d-3680175-p=2");
	});

	it("reports e-GP maintenance pages as source outages instead of empty tender lists", async () => {
		const result = await zppaZambiaParser.parse({
			html: `
				<html>
					<body>
						<p>The e-Procurement System (EPPS) is temporary unavailable due to maintenance.</p>
					</body>
				</html>
			`,
			url: "https://eprocure.zppa.org.zm/epps/quickSearchAction.do?searchSelect=6",
		});

		expect(result.opportunities).toEqual([]);
		expect(result.error).toContain("temporary unavailable due to maintenance");
	});
});
