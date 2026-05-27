import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireScraperAccessMock = vi.hoisted(() => vi.fn());
const discoverAndImportOpportunitiesMock = vi.hoisted(() => vi.fn());
const executeOpportunityDiscoveryImportMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/scrapers/api-auth", () => ({
	requireScraperAccess: requireScraperAccessMock,
}));

vi.mock("@/lib/actions/import-opportunities", () => ({
	discoverAndImportOpportunities: discoverAndImportOpportunitiesMock,
}));

vi.mock("@/lib/services/opportunity-discovery-import", () => ({
	executeOpportunityDiscoveryImport: executeOpportunityDiscoveryImportMock,
}));

import { POST } from "@/app/api/opportunities/discovery/run/route";

function discoveryRequest(body?: unknown, headers?: HeadersInit): NextRequest {
	return new NextRequest("https://app.test/api/opportunities/discovery/run", {
		method: "POST",
		body: body === undefined ? undefined : JSON.stringify(body),
		headers: {
			...(body === undefined ? {} : { "content-type": "application/json" }),
			...headers,
		},
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	requireScraperAccessMock.mockResolvedValue(null);
	discoverAndImportOpportunitiesMock.mockResolvedValue({
		importId: "import-1",
		results: {
			total: 2,
			imported: 1,
			updated: 1,
			skipped: 0,
			failed: 0,
		},
		errors: [],
	});
	executeOpportunityDiscoveryImportMock.mockResolvedValue({
		importId: "import-service",
		results: {
			total: 1,
			imported: 1,
			updated: 0,
			skipped: 0,
			failed: 0,
		},
		errors: [],
	});
	delete process.env.SCRAPER_API_KEY;
	delete process.env.DISCOVERY_IMPORT_USER_ID;
	delete process.env.DISCOVERY_IMPORT_ORGANIZATION_ID;
});

describe("opportunity discovery run route", () => {
	it("blocks unauthorized operators before running discovery", async () => {
		requireScraperAccessMock.mockResolvedValue(
			NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
		);

		const response = await POST(discoveryRequest({ query: "rfp kenya" }));
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toEqual({ success: false, message: "Unauthorized" });
		expect(discoverAndImportOpportunitiesMock).not.toHaveBeenCalled();
	});

	it("validates discovery request shape before running search", async () => {
		const response = await POST(discoveryRequest({ queries: "rfp kenya" }));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toMatchObject({
			success: false,
			message: "queries must be an array of strings",
		});
		expect(discoverAndImportOpportunitiesMock).not.toHaveBeenCalled();
	});

	it("runs live discovery imports for authorized operators", async () => {
		const response = await POST(discoveryRequest({
			query: "digital transformation tender Kenya",
			limitPerQuery: 5,
			engines: ["bing"],
			sourceUrls: ["https://buyer.example/tenders"],
			sourceScrapeLimit: 3,
			countryRegion: "Kenya",
			scrapeTopResults: true,
			scrapeLimit: 1,
			downloadDiscoveredDocuments: true,
			downloadLimit: 1,
		}));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(requireScraperAccessMock).toHaveBeenCalledWith(expect.anything(), { allowApiKey: true });
		expect(discoverAndImportOpportunitiesMock).toHaveBeenCalledWith({
			query: "digital transformation tender Kenya",
			queries: undefined,
			limitPerQuery: 5,
			sourceUrls: ["https://buyer.example/tenders"],
			sourceScrapeLimit: 3,
			language: undefined,
			timeRange: undefined,
			categories: undefined,
			engines: ["bing"],
			countryRegion: "Kenya",
			category: undefined,
			updateExisting: undefined,
			includeUnmatchedResults: undefined,
			scrapeTopResults: true,
			scrapeLimit: 1,
			browserFallback: true,
			browserFallbackLimit: 1,
			downloadDiscoveredDocuments: true,
			downloadLimit: 1,
		});
		expect(body).toMatchObject({
			success: true,
			importId: "import-1",
			results: {
				total: 2,
				imported: 1,
				updated: 1,
				failed: 0,
			},
		});
	});

	it("runs API-key discovery under the configured import assignee", async () => {
		process.env.SCRAPER_API_KEY = "scraper-secret";
		process.env.DISCOVERY_IMPORT_USER_ID = "service-user-1";
		process.env.DISCOVERY_IMPORT_ORGANIZATION_ID = "org-service-1";

		const response = await POST(discoveryRequest(
			{ query: "scheduled rfp search" },
			{ authorization: "Bearer scraper-secret" }
		));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(discoverAndImportOpportunitiesMock).not.toHaveBeenCalled();
		expect(executeOpportunityDiscoveryImportMock).toHaveBeenCalledWith(
			expect.objectContaining({
				query: "scheduled rfp search",
				sourceUrls: expect.arrayContaining(["https://www.ungm.org/Public/Notice"]),
				downloadDiscoveredDocuments: true,
				downloadLimit: 3,
			}),
			"service-user-1",
			"org-service-1"
		);
		expect(body).toMatchObject({
			success: true,
			importId: "import-service",
			results: { imported: 1 },
		});
	});

	it("requires an import assignee for API-key discovery runs", async () => {
		process.env.SCRAPER_API_KEY = "scraper-secret";

		const response = await POST(discoveryRequest(
			{ query: "scheduled rfp search" },
			{ authorization: "Bearer scraper-secret" }
		));
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body).toMatchObject({
			success: false,
			message: "DISCOVERY_IMPORT_USER_ID is required for API-key discovery runs",
		});
		expect(discoverAndImportOpportunitiesMock).not.toHaveBeenCalled();
		expect(executeOpportunityDiscoveryImportMock).not.toHaveBeenCalled();
	});

	it("requires an import organization for API-key discovery runs", async () => {
		process.env.SCRAPER_API_KEY = "scraper-secret";
		process.env.DISCOVERY_IMPORT_USER_ID = "service-user-1";

		const response = await POST(discoveryRequest(
			{ query: "scheduled rfp search" },
			{ authorization: "Bearer scraper-secret" }
		));
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body).toMatchObject({
			success: false,
			message: "DISCOVERY_IMPORT_ORGANIZATION_ID is required for API-key discovery runs",
		});
		expect(discoverAndImportOpportunitiesMock).not.toHaveBeenCalled();
		expect(executeOpportunityDiscoveryImportMock).not.toHaveBeenCalled();
	});
});
