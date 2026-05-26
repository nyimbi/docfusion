import { describe, expect, it } from "vitest";

import { genericParser } from "@/lib/scrapers/parsers/generic";

describe("generic tender parser", () => {
	it("normalizes field-packed procurement table links", async () => {
		const result = await genericParser.parse({
			url: "https://procurement-notices.undp.org",
			markdown: [
				"[Title\\ \\ Wool handloom value chain, Livelihood Enterprise Development & Community Cons\\ \\ Ref No\\ \\ UNDP-IND-00772,1\\ \\ UNDP Office/Country\\ \\ UNDP-IND/INDIA\\ \\ Process\\ \\ RFP - Request for proposal\\ \\ Deadline\\ \\ 09-Jun-26 \\ 08:00 AM (New York time)\\ \\ Posted\\ \\ 26-May-26](https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=45879)",
			].join("\n"),
			links: [],
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "Wool handloom value chain, Livelihood Enterprise Development & Community Cons",
				noticeId: "UNDP-IND-00772,1",
				organization: "UNDP-IND",
				countryRegion: "INDIA",
				projectSummary: "Process: RFP - Request for proposal",
				portalUrl: "https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=45879",
			}),
		]);
		expect(String(result.opportunities[0].title)).not.toContain("Ref No");
	});
});
