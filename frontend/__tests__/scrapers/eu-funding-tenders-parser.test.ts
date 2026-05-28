import { afterEach, describe, expect, it, vi } from "vitest";

import {
	euFundingTendersParser,
	euFundingTendersSearchApiUrl,
	parseEuFundingTendersResponse,
} from "@/lib/scrapers/parsers/eu-funding-tenders";

const sourceUrl = "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals?keywords=proposal";

const euSearchResponse = {
	totalResults: 30611,
	results: [
		{
			reference: "HORIZON-EIC-2026-ACCELERATOR-01en",
			url: "https://ec.europa.eu/info/funding-tenders/opportunities/data/topicDetails/HORIZON-EIC-2026-ACCELERATOR-01.json",
			summary: "EIC Accelerator 2026 - Short proposal",
			score: 21.5,
			metadata: {
				title: ["EIC Accelerator 2026 - Short proposal"],
				identifier: ["HORIZON-EIC-2026-ACCELERATOR-01"],
				callTitle: ["EIC Accelerator 2026"],
				description: ["<p>Funding for innovative companies preparing a short proposal.</p>"],
				type: ["1"],
				status: ["31094502"],
				sortStatus: ["1"],
				deadlineDate: ["2099-12-17T00:00:00.000+0000"],
				startDate: ["2099-01-01T00:00:00.000+0000"],
				frameworkProgramme: ["Horizon Europe"],
				budget: ["1000000"],
				url: ["https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-EIC-2026-ACCELERATOR-01.json"],
			},
		},
		{
			reference: "closed",
			url: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/CLOSED",
			summary: "Closed call",
			metadata: {
				title: ["Closed call"],
				identifier: ["CLOSED"],
				deadlineDate: ["2020-01-01T00:00:00.000+0000"],
			},
		},
	],
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("EU Funding & Tenders parser", () => {
	it("extracts current EU calls from the SEDIA search response", () => {
		const result = parseEuFundingTendersResponse(euSearchResponse, sourceUrl, new Date("2026-05-28T00:00:00Z"));

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			title: "EIC Accelerator 2026 - Short proposal",
			source: "eu_funding_tenders",
			sourceId: "eu-HORIZON-EIC-2026-ACCELERATOR-01",
			noticeId: "HORIZON-EIC-2026-ACCELERATOR-01",
			organization: "European Commission",
			sector: "Horizon Europe",
			category: "EIC Accelerator 2026",
			opportunityType: "grant",
			portalUrl: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-EIC-2026-ACCELERATOR-01",
			documentUrl: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-EIC-2026-ACCELERATOR-01",
			budgetValue: "1000000",
			submissionMethod: "Review and submit through the EU Funding & Tenders Portal.",
			tags: ["eu-funding-tenders", "eu-grant", "source-scrape"],
			metadata: {
				euFundingTenders: expect.objectContaining({
					searchQuery: "proposal",
					totalResults: 30611,
					reference: "HORIZON-EIC-2026-ACCELERATOR-01en",
				}),
			},
		});
		expect(result[0]?.projectSummary).toContain("innovative companies");
	});

	it("builds SEDIA search API URLs from portal source URLs", () => {
		expect(euFundingTendersSearchApiUrl(sourceUrl, 10)).toBe(
			"https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=proposal&pageSize=10&pageNumber=1"
		);
	});

	it("fetches EU portal search results through the parser", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => euSearchResponse,
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await euFundingTendersParser.parse({
			url: sourceUrl,
			markdown: "EU Funding & Tenders Portal",
		});

		expect(result.opportunities).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=proposal&pageSize=25&pageNumber=1",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{}",
			}
		);
	});

	it("reports endpoint failures without fabricated opportunities", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
			ok: false,
			status: 503,
			json: async () => ({}),
		}));

		const result = await euFundingTendersParser.parse({
			url: sourceUrl,
			markdown: "EU Funding & Tenders Portal",
		});

		expect(result.opportunities).toEqual([]);
		expect(result.error).toBe("EU Funding & Tenders search endpoint returned HTTP 503");
	});
});
