import { describe, expect, it } from "vitest";

import { ghanepsParser, parseGhanepsCurrentTendersHtml } from "@/lib/scrapers/parsers/ghaneps";

const currentTendersHtml = `
	<table id="T01">
		<tbody>
			<tr>
				<td>1</td>
				<td style="display:block; text-align:left">
					<a href="/epps/cft/prepareViewCfTWS.do?resourceId=2974032">Rehabilitation of Bnekumhene road and Papa Kofi road in Old Tafo Municipality</a>
				</td>
				<td>OLD TAFO MUNICIPAL ASSEMBLY</td>
				<td><img src="/epps/images/icon_information.gif" alt="Description" title="Road works" /></td>
				<td>Fri Jun 19 11:00:00 GMT 2026</td>
				<td>National Competitive Tendering</td>
				<td>Bid Submission</td>
				<td><a href="/epps/cft/downloadNoticeForAdvSearch.do?resourceId=2974032"><img src="/epps/images/acrobat.gif" alt="Specific Procurement Notice PDF" /></a></td>
				<td>Fri May 29 16:35:48 GMT 2026</td>
			</tr>
			<tr>
				<td>2</td>
				<td style="display:block; text-align:left">
					<a href="/epps/cft/prepareViewCfTWS.do?resourceId=2961470">Consultancy Service for the preparation of a comprehensive risk assessment report</a>
				</td>
				<td>MINISTRY OF FINANCE</td>
				<td></td>
				<td>Mon Jun 29 10:00:00 GMT 2026</td>
				<td>Quality and Cost Based Selection</td>
				<td>Bid Submission</td>
				<td><a href="/epps/cft/downloadNoticeForAdvSearch.do?resourceId=2961470"><img src="/epps/images/acrobat.gif" /></a></td>
				<td>Fri May 29 09:15:00 GMT 2026</td>
			</tr>
		</tbody>
	</table>
`;

describe("GHANEPS parser", () => {
	it("extracts current tender rows with portal and notice PDF URLs", () => {
		const opportunities = parseGhanepsCurrentTendersHtml(currentTendersHtml);

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			title: "Rehabilitation of Bnekumhene road and Papa Kofi road in Old Tafo Municipality",
			source: "ghaneps",
			sourceId: "ghaneps-2974032",
			noticeId: "2974032",
			organization: "OLD TAFO MUNICIPAL ASSEMBLY",
			countryRegion: "Ghana",
			category: "National Competitive Tendering",
			opportunityType: "tender",
			portalUrl: "https://www.ghaneps.gov.gh/epps/cft/prepareViewCfTWS.do?resourceId=2974032",
			documentUrl: "https://www.ghaneps.gov.gh/epps/cft/downloadNoticeForAdvSearch.do?resourceId=2974032",
		});
		expect(opportunities[0]?.deadline).toEqual(new Date("Fri Jun 19 11:00:00 GMT 2026"));
		expect(opportunities[0]?.publishedDate).toEqual(new Date("Fri May 29 16:35:48 GMT 2026"));
		expect(opportunities[1]).toMatchObject({
			sourceId: "ghaneps-2961470",
			opportunityType: "rfp",
			organization: "MINISTRY OF FINANCE",
		});
	});

	it("supports the TenderParser interface from provided HTML", async () => {
		const result = await ghanepsParser.parse({
			html: currentTendersHtml,
			url: "https://www.ghaneps.gov.gh/epps/quickSearchAction.do?searchSelect=6",
		});

		expect(result.error).toBeUndefined();
		expect(result.opportunities.map((opportunity) => opportunity.sourceId)).toEqual([
			"ghaneps-2974032",
			"ghaneps-2961470",
		]);
		expect(ghanepsParser.getPageUrl("https://www.ghaneps.gov.gh/epps/quickSearchAction.do?searchSelect=6", 2))
			.toContain("d-3680175-p=2");
	});
});
