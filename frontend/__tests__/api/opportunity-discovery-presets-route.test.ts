import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireScraperAccessMock = vi.hoisted(() => vi.fn());
const executeOpportunityDiscoveryImportMock = vi.hoisted(() => vi.fn());
const selectRowsQueue = vi.hoisted(() => [] as unknown[][]);
const limitMock = vi.hoisted(() => vi.fn());

const presetRow = {
	id: "preset-1",
	userId: "service-user-1",
	name: "Daily East Africa ICT",
	filters: {
		kind: "opportunity_discovery_preset",
		version: 1,
		input: {
			queries: ["ICT tender Kenya", "digital transformation RFP Uganda"],
			limitPerQuery: 10,
			countryRegion: "East Africa",
			scrapeTopResults: true,
		},
	},
	sort: null,
	description: "2 queries, East Africa",
	isDefault: false,
	createdAt: new Date("2026-05-20T08:00:00.000Z"),
	updatedAt: new Date("2026-05-20T08:00:00.000Z"),
};

vi.mock("@/lib/scrapers/api-auth", () => ({
	requireScraperAccess: requireScraperAccessMock,
}));

vi.mock("@/lib/services/opportunity-discovery-import", () => ({
	executeOpportunityDiscoveryImport: executeOpportunityDiscoveryImportMock,
}));

vi.mock("@/lib/db/schema", () => ({
	savedSearches: {
		id: "saved_searches.id",
		userId: "saved_searches.user_id",
		name: "saved_searches.name",
		filters: "saved_searches.filters",
		updatedAt: "saved_searches.updated_at",
	},
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((column: unknown, value: unknown) => ({ op: "eq", column, value })),
	and: vi.fn((...conditions: unknown[]) => ({ op: "and", conditions })),
	desc: vi.fn((column: unknown) => ({ op: "desc", column })),
	inArray: vi.fn((column: unknown, values: unknown[]) => ({ op: "inArray", column, values })),
	sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ op: "sql", strings, values })),
}));

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn(() => {
			const rows = selectRowsQueue.shift() ?? [];
			const builder = {
				from: vi.fn(() => builder),
				where: vi.fn(() => builder),
				orderBy: vi.fn(() => builder),
				limit: vi.fn(async (limit: number) => {
					limitMock(limit);
					return rows;
				}),
			};
			return builder;
		}),
	},
}));

import { POST } from "@/app/api/opportunities/discovery/presets/run/route";

function runRequest(body?: unknown): NextRequest {
	return new NextRequest("https://app.test/api/opportunities/discovery/presets/run", {
		method: "POST",
		body: body === undefined ? undefined : JSON.stringify(body),
		headers: body === undefined ? undefined : { "content-type": "application/json" },
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	selectRowsQueue.length = 0;
	requireScraperAccessMock.mockResolvedValue(null);
	executeOpportunityDiscoveryImportMock.mockResolvedValue({
		importId: "import-1",
		results: {
			total: 2,
			imported: 1,
			updated: 1,
			skipped: 0,
			failed: 0,
		},
		errors: [],
		warnings: [{
			type: "searxng_engine_degraded",
			query: "ICT tender Kenya",
			title: "SearXNG engine degradation",
			url: "https://search.lindela.io/search",
			message: "bing: timeout",
		}],
	});
	delete process.env.DISCOVERY_IMPORT_USER_ID;
	delete process.env.DISCOVERY_IMPORT_ORGANIZATION_ID;
});

describe("scheduled discovery preset run route", () => {
	it("blocks unauthorized callers before loading presets", async () => {
		requireScraperAccessMock.mockResolvedValue(
			NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
		);

		const response = await POST(runRequest({}));
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toEqual({ success: false, message: "Unauthorized" });
		expect(executeOpportunityDiscoveryImportMock).not.toHaveBeenCalled();
	});

	it("requires a configured import assignee", async () => {
		const response = await POST(runRequest({}));
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body).toMatchObject({
			success: false,
			message: "DISCOVERY_IMPORT_USER_ID is required for scheduled discovery preset runs",
		});
		expect(executeOpportunityDiscoveryImportMock).not.toHaveBeenCalled();
	});

	it("returns dry-run preset inputs without running discovery", async () => {
		process.env.DISCOVERY_IMPORT_USER_ID = "service-user-1";
		process.env.DISCOVERY_IMPORT_ORGANIZATION_ID = "org-service-1";
		selectRowsQueue.push([presetRow]);

		const response = await POST(runRequest({ dryRun: true, limit: 1 }));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(limitMock).toHaveBeenCalledWith(1);
		expect(executeOpportunityDiscoveryImportMock).not.toHaveBeenCalled();
		expect(body).toMatchObject({
			success: true,
			dryRun: true,
			assigneeUserId: "service-user-1",
			presets: [
				{
					presetId: "preset-1",
					name: "Daily East Africa ICT",
					input: {
						queries: ["ICT tender Kenya", "digital transformation RFP Uganda"],
						engines: ["duckduckgo", "bing"],
						sourceUrls: expect.arrayContaining(["https://www.ungm.org/Public/Notice"]),
						downloadDiscoveredDocuments: true,
						downloadLimit: 5,
					},
				},
			],
		});
	});

	it("runs saved presets sequentially under the configured assignee", async () => {
		process.env.DISCOVERY_IMPORT_USER_ID = "service-user-1";
		process.env.DISCOVERY_IMPORT_ORGANIZATION_ID = "org-service-1";
		selectRowsQueue.push([presetRow]);

		const response = await POST(runRequest({ presetIds: ["preset-1"] }));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(requireScraperAccessMock).toHaveBeenCalledWith(expect.anything(), { allowApiKey: true });
		expect(executeOpportunityDiscoveryImportMock).toHaveBeenCalledWith(
			expect.objectContaining({
				queries: ["ICT tender Kenya", "digital transformation RFP Uganda"],
				countryRegion: "East Africa",
				engines: ["duckduckgo", "bing"],
				sourceUrls: expect.arrayContaining(["https://www.ungm.org/Public/Notice"]),
				downloadDiscoveredDocuments: true,
				downloadLimit: 5,
			}),
			"service-user-1",
			"org-service-1"
		);
		expect(body).toMatchObject({
			success: true,
			totalPresets: 1,
			failedPresets: 0,
			presets: [
				{
					presetId: "preset-1",
					success: true,
					importId: "import-1",
					results: { imported: 1, updated: 1 },
					warnings: [{
						type: "searxng_engine_degraded",
						query: "ICT tender Kenya",
					}],
				},
			],
		});
	});

	it("validates request shape before loading presets", async () => {
		process.env.DISCOVERY_IMPORT_USER_ID = "service-user-1";
		process.env.DISCOVERY_IMPORT_ORGANIZATION_ID = "org-service-1";

		const response = await POST(runRequest({ presetIds: "preset-1" }));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toMatchObject({
			success: false,
			message: "presetIds must be an array of strings",
		});
		expect(executeOpportunityDiscoveryImportMock).not.toHaveBeenCalled();
	});
});
