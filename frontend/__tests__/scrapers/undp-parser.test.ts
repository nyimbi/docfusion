import { describe, expect, it } from "vitest";

import { undpParser } from "@/lib/scrapers/parsers/undp";

const undpMarkdown = `
[Title\\ \\ Wool handloom value chain, Livelihood Enterprise Development & Community Cons\\ \\ Ref No\\ \\ UNDP-IND-00772,1\\ \\ UNDP Office/Country\\ \\ UNDP-IND/INDIA\\ \\ Process\\ \\ RFP - Request for proposal\\ \\ Deadline\\ \\ 09-Jun-26 \\ 08:00 AM (New York time)\\ \\ Posted\\ \\ 26-May-26](https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=45879)
[Title\\ \\ Procurement of tablets for field monitors\\ \\ Ref No\\ \\ UNDP-KEN-00456\\ \\ UNDP Office/Country\\ \\ UNDP-KEN/KENYA\\ \\ Process\\ \\ RFQ - Request for quotation\\ \\ Deadline\\ \\ 12-Jun-26 \\ 05:00 PM (New York time)\\ \\ Posted\\ \\ 27-May-26](https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=45880)
`;

describe("UNDP parser", () => {
	it("normalizes field-packed procurement notice links with UNDP source metadata", async () => {
		const result = await undpParser.parse({
			url: "https://procurement-notices.undp.org",
			markdown: undpMarkdown,
			links: [],
		});

		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0]).toMatchObject({
			title: "Wool handloom value chain, Livelihood Enterprise Development & Community Cons",
			source: "undp",
			sourceId: "UNDP-IND-00772,1",
			noticeId: "UNDP-IND-00772,1",
			organization: "UNDP-IND",
			countryRegion: "INDIA",
			category: "RFP - Request for proposal",
			opportunityType: "rfp",
			projectSummary: "Process: RFP - Request for proposal",
			portalUrl: "https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=45879",
			documentUrl: "https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=45879",
			tags: ["undp", "un-procurement"],
			metadata: {
				undp: expect.objectContaining({
					refNo: "UNDP-IND-00772,1",
					process: "RFP - Request for proposal",
				}),
			},
		});
		expect(result.opportunities[0].deadline).toEqual(new Date(2026, 5, 9));
		expect(result.opportunities[0].publishedDate).toEqual(new Date(2026, 4, 26));
		expect(result.opportunities[1]).toMatchObject({
			sourceId: "UNDP-KEN-00456",
			countryRegion: "KENYA",
			opportunityType: "tender",
		});
		expect(String(result.opportunities[0].title)).not.toContain("Ref No");
	});
});
