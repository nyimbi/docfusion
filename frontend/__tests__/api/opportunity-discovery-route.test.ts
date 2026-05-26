import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireScraperAccessMock = vi.hoisted(() => vi.fn());
const discoverAndImportOpportunitiesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/scrapers/api-auth", () => ({
	requireScraperAccess: requireScraperAccessMock,
}));

vi.mock("@/lib/actions/import-opportunities", () => ({
	discoverAndImportOpportunities: discoverAndImportOpportunitiesMock,
}));

import { POST } from "@/app/api/opportunities/discovery/run/route";

function discoveryRequest(body?: unknown): NextRequest {
	return new NextRequest("https://app.test/api/opportunities/discovery/run", {
		method: "POST",
		body: body === undefined ? undefined : JSON.stringify(body),
		headers: body === undefined ? undefined : { "content-type": "application/json" },
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
			countryRegion: "Kenya",
			scrapeTopResults: true,
			scrapeLimit: 1,
		}));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(discoverAndImportOpportunitiesMock).toHaveBeenCalledWith({
			query: "digital transformation tender Kenya",
			queries: undefined,
			limitPerQuery: 5,
			language: undefined,
			timeRange: undefined,
			categories: undefined,
			countryRegion: "Kenya",
			category: undefined,
			updateExisting: undefined,
			includeUnmatchedResults: undefined,
			scrapeTopResults: true,
			scrapeLimit: 1,
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
});
