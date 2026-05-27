import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const searchSearxngMock = vi.hoisted(() => vi.fn());

var dbMock: {
	query: {
		accounts: {
			findFirst: ReturnType<typeof vi.fn>;
		};
	};
};

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		query: {
			accounts: {
				findFirst: vi.fn(),
			},
		},
	},
}));

vi.mock("@/lib/services/searxng-client", () => ({
	searchSearxng: searchSearxngMock,
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: {
		error: vi.fn(),
	},
}));

import { researchAccount } from "@/lib/actions/crm/account-research";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "research-user-1",
		organizationId: "org-1",
	});
	dbMock.query.accounts.findFirst.mockResolvedValue({
		id: "account-1",
		name: "Datacraft",
		website: null,
		linkedinUrl: null,
		email: null,
		phone: null,
		keyLeadership: null,
		description: null,
		notableClients: null,
		country: "Kenya",
	});
});

describe("CRM account live research", () => {
	it("populates research results from SearXNG instead of returning empty client-side placeholders", async () => {
		searchSearxngMock
			.mockResolvedValueOnce({
				results: [
					{
						title: "Datacraft Africa - Digital services",
						url: "https://datacraft.example/about",
						content: "Datacraft provides cybersecurity and data platforms in Kenya. Contact info@datacraft.example +254 700 000 000.",
						engine: "bing",
						score: 4.2,
						category: "general",
					},
				],
			})
			.mockResolvedValueOnce({
				results: [
					{
						title: "Datacraft names new CEO",
						url: "https://news.example/datacraft-ceo",
						content: "Datacraft announced leadership changes and expanded procurement work.",
						engine: "brave",
						score: 3.4,
						category: "news",
					},
				],
			});

		const result = await researchAccount({
			accountId: "account-1",
			companyName: "Datacraft",
			country: "Kenya",
			categories: ["company_info", "news"],
		});

		expect(result.success).toBe(true);
		expect(result.results).toHaveLength(2);
		expect(result.results[0]).toMatchObject({
			category: "company_info",
			searchQuery: "Datacraft Kenya company profile about overview",
			results: [expect.objectContaining({
				title: "Datacraft Africa - Digital services",
				url: "https://datacraft.example/about",
				source: "datacraft.example",
			})],
		});
		expect(result.summary).toContain("Found 2 live research results");
		expect(result.suggestedUpdates).toMatchObject({
			website: "https://datacraft.example/about",
			email: "info@datacraft.example",
			phone: "+254 700 000 000",
			description: expect.stringContaining("cybersecurity"),
		});
		expect(searchSearxngMock).toHaveBeenNthCalledWith(1, "Datacraft Kenya company profile about overview", {
			categories: ["general"],
			safesearch: 1,
		});
		expect(searchSearxngMock).toHaveBeenNthCalledWith(2, "Datacraft Kenya news announcement press release 2025 2026", {
			categories: ["news"],
			time_range: "year",
			safesearch: 1,
		});
	});

	it("keeps successful categories when one SearXNG category fails", async () => {
		searchSearxngMock
			.mockResolvedValueOnce({
				results: [{
					title: "Datacraft LinkedIn",
					url: "https://www.linkedin.com/company/datacraft",
					content: "Company profile",
					engine: "bing",
					score: 2,
				}],
			})
			.mockRejectedValueOnce(new Error("SearXNG unavailable"));

		const result = await researchAccount({
			accountId: "account-1",
			companyName: "Datacraft",
			categories: ["linkedin", "clients"],
		});

		expect(result.success).toBe(true);
		expect(result.results).toHaveLength(2);
		expect(result.results[0].results).toHaveLength(1);
		expect(result.results[1].results).toEqual([]);
		expect(result.summary).toContain("1 category could not be searched");
		expect(result.suggestedUpdates).toMatchObject({
			linkedinUrl: "https://www.linkedin.com/company/datacraft",
		});
	});
});
