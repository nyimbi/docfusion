import { afterEach, describe, expect, it, vi } from "vitest";

import {
	parseSamGovSearchResponse,
	samGovParser,
	samGovSearchApiUrl,
} from "@/lib/scrapers/parsers/sam-gov";

const samGovApiResponse = {
	page: { totalElements: 11058 },
	_embedded: {
		results: [
			{
				_id: "abc123",
				parentNoticeId: "parent-123",
				solicitationNumber: "FA0000-26-R-0001",
				title: "Request for Proposal: Case Management Platform",
				type: { code: "o", value: "Solicitation" },
				isActive: true,
				isCanceled: false,
				publishDate: "2026-05-20T12:00:00+00:00",
				responseDate: "2026-06-30T20:00:00+00:00",
				modifiedDate: "2026-05-21T12:00:00+00:00",
				archiveDate: "2026-07-15T00:00:00+00:00",
				_rScore: 100,
				descriptions: [{
					content: "<p>The agency requests proposals for implementation and support of a case management platform.</p>",
				}],
				organizationHierarchy: [
					{ level: 1, name: "JUSTICE, DEPARTMENT OF" },
					{ level: 2, name: "OFFICE OF JUSTICE PROGRAMS" },
				],
				placeOfPerformance: [{ country: "USA", state: "DC", city: "Washington" }],
				naics: [{ code: "541511", value: "Custom Computer Programming Services" }],
				pointOfContacts: [{ type: "primary", fullName: "A. Buyer", email: "buyer@example.gov" }],
			},
			{
				_id: "canceled",
				solicitationNumber: "CANCELED",
				title: "Canceled notice",
				isActive: false,
				isCanceled: true,
			},
		],
	},
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("SAM.gov parser", () => {
	it("extracts active SAM.gov opportunities from the public search response", () => {
		const result = parseSamGovSearchResponse(
			samGovApiResponse,
			"https://sam.gov/search/?index=opp&keywords=%22request%20for%20proposal%22"
		);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			title: "Request for Proposal: Case Management Platform",
			source: "sam_gov",
			sourceId: "sam-FA0000-26-R-0001",
			noticeId: "FA0000-26-R-0001",
			organization: "OFFICE OF JUSTICE PROGRAMS",
			countryRegion: "USA / DC / Washington",
			sector: "Custom Computer Programming Services",
			category: "Solicitation",
			opportunityType: "rfp",
			portalUrl: "https://sam.gov/opp/abc123/view",
			documentUrl: "https://sam.gov/opp/abc123/view",
			submissionMethod: "Respond according to SAM.gov notice instructions; primary contact buyer@example.gov.",
			tags: ["sam-gov", "us-federal", "source-scrape"],
			metadata: {
				samGov: expect.objectContaining({
					searchQuery: "\"request for proposal\"",
					totalResults: 11058,
					relevanceScore: 100,
					organizationPath: ["JUSTICE, DEPARTMENT OF", "OFFICE OF JUSTICE PROGRAMS"],
				}),
			},
		});
		expect(result[0]?.projectSummary).toContain("case management platform");
	});

	it("builds relevance-sorted search API URLs from SAM.gov source URLs", () => {
		expect(samGovSearchApiUrl("https://sam.gov/search/?index=opp&keywords=USAID", 5)).toBe(
			"https://sam.gov/api/prod/sgs/v1/search/?index=opp&size=5&page=0&sort=-relevance&q=USAID&is_active=true"
		);
		expect(samGovSearchApiUrl("https://sam.gov/search/?index=opp", 5)).toContain(
			"q=%22request+for+proposal%22"
		);
	});

	it("fetches SAM.gov search results through the parser", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => samGovApiResponse,
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await samGovParser.parse({
			url: "https://sam.gov/search/?index=opp&keywords=%22request%20for%20proposal%22",
			markdown: "SAM.gov Contract Opportunities",
		});

		expect(result.opportunities).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://sam.gov/api/prod/sgs/v1/search/?index=opp&size=10&page=0&sort=-relevance&q=%22request+for+proposal%22&is_active=true"
		);
	});

	it("reports endpoint failures without fabricated opportunities", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
			ok: false,
			status: 502,
			json: async () => ({}),
		}));

		const result = await samGovParser.parse({
			url: "https://sam.gov/search/?index=opp&keywords=USAID",
			markdown: "SAM.gov Contract Opportunities",
		});

		expect(result.opportunities).toEqual([]);
		expect(result.error).toBe("SAM.gov search endpoint returned HTTP 502");
	});
});
