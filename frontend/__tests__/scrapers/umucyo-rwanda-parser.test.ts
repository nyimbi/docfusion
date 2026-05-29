import { describe, expect, it } from "vitest";

import { parseUmucyoAdvertisingHtml, umucyoRwandaParser } from "@/lib/scrapers/parsers/umucyo-rwanda";

const SOURCE_URL = "https://www.umucyo.gov.rw/eb/bav/selectListAdvertisingListForGU.do?menuId=EB01020100&leftTopFlag=l&recordCountPerPage=50";

const advertisingHtml = `
	<table class="article_table">
		<tbody>
			<tr>
				<td class="tC"><input type="radio" name="tenderNo" class="radio"
					value="000002/G/ICB/2025/2026/1200001000|Acquisition of AI/ML Infrastructure, Data, ML Models, and AI Platform Licenses|1200001000|29/06/2026|O|ICB|G|29/06/2026 10:30|P"></td>
				<td><span><a href="javascript:ViewDetail('000002/G/ICB/2025/2026/1200001000','O','G');">
					Acquisition of AI/ML Infrastructure, Data, ML Models, and AI Platform Licenses
				</a></span></td>
				<td>000002/G/ICB/2025/2026/SPIU MINECOFIN<input type="hidden" value="000002/G/ICB/2025/2026/1200001000" /></td>
				<td class="tC">Published</td>
				<td class="tC">29/05/2026</td>
				<td class="tC">29/06/2026 10:30</td>
				<td class="tC">29/06/2026 11:00</td>
				<td class="tC">one stage</td>
			</tr>
			<tr>
				<td class="tC"><input type="radio" name="tenderNo" class="radio"
					value="000003/C/NCB/2025/2026/1808000000|Hiring a consultant to supervise water treatment works|1808000000|22/06/2026|O|NCB|C|22/06/2026 10:00|P"></td>
				<td><span><a href="javascript:ViewDetail('000003/C/NCB/2025/2026/1808000000','O','C');">
					Hiring a consultant to supervise water treatment works
				</a></span></td>
				<td>000003/C/NCB/2025/2026/WASAC Development<input type="hidden" value="000003/C/NCB/2025/2026/1808000000" /></td>
				<td class="tC">Published</td>
				<td class="tC">29/05/2026</td>
				<td class="tC">22/06/2026 10:00</td>
				<td class="tC">22/06/2026 10:30</td>
				<td class="tC">one stage</td>
			</tr>
		</tbody>
	</table>
`;

describe("Rwanda UMUCYO advertising parser", () => {
	it("extracts current advertising rows from the public UMUCYO tender table", () => {
		const opportunities = parseUmucyoAdvertisingHtml(advertisingHtml, SOURCE_URL);

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			title: "Acquisition of AI/ML Infrastructure, Data, ML Models, and AI Platform Licenses",
			source: "umucyo_rwanda",
			sourceId: "umucyo-000002-g-icb-2025-2026-1200001000",
			noticeId: "000002/G/ICB/2025/2026/SPIU MINECOFIN",
			organization: "SPIU MINECOFIN",
			countryRegion: "Rwanda",
			category: "Goods - International Competitive Bidding",
			opportunityType: "tender",
			submissionMethod: "Submit through Rwanda UMUCYO public e-procurement system.",
		});
		expect(opportunities[0]?.deadline).toEqual(new Date(2026, 5, 29, 10, 30));
		expect(opportunities[0]?.publishedDate).toEqual(new Date(2026, 4, 29));
		expect(opportunities[0]?.portalUrl).toContain("#000002%2FG%2FICB%2F2025%2F2026%2F1200001000");
		expect(opportunities[1]).toMatchObject({
			category: "Consultant Services - National Competitive Bidding",
			opportunityType: "rfp",
			organization: "WASAC Development",
		});
	});

	it("supports the TenderParser interface without Firecrawl content", async () => {
		const result = await umucyoRwandaParser.parse({ html: advertisingHtml, url: SOURCE_URL });

		expect(result.error).toBeUndefined();
		expect(result.opportunities.map((opportunity) => opportunity.noticeId)).toEqual([
			"000002/G/ICB/2025/2026/SPIU MINECOFIN",
			"000003/C/NCB/2025/2026/WASAC Development",
		]);
		expect(umucyoRwandaParser.getPageUrl("https://www.umucyo.gov.rw/eb/bav/selectListAdvertisingListForGU.do", 1))
			.toContain("recordCountPerPage=50");
	});
});
