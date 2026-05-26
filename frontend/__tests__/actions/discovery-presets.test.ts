import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const insertValuesMock = vi.hoisted(() => vi.fn());
const deleteWhereMock = vi.hoisted(() => vi.fn());
const selectWhereMock = vi.hoisted(() => vi.fn());
const selectRowsQueue = vi.hoisted(() => [] as unknown[][]);

const savedSearchRow = {
	id: "preset-1",
	userId: "user-1",
	name: "East Africa ICT",
	filters: {
		kind: "opportunity_discovery_preset",
		version: 1,
		input: {
			queries: ["ICT tender Kenya", "RFP Uganda"],
			limitPerQuery: 12,
			countryRegion: "East Africa",
			category: "ICT",
			updateExisting: true,
			scrapeTopResults: true,
			scrapeLimit: 2,
			browserFallback: true,
			browserFallbackLimit: 2,
		},
	},
	sort: null,
	description: "2 queries, East Africa",
	isDefault: false,
	createdAt: new Date("2026-05-20T08:00:00.000Z"),
	updatedAt: new Date("2026-05-20T08:00:00.000Z"),
};

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/db/schema", () => ({
	savedSearches: {
		id: "saved_searches.id",
		userId: "saved_searches.user_id",
		name: "saved_searches.name",
		filters: "saved_searches.filters",
		updatedAt: "saved_searches.updated_at",
		isDefault: "saved_searches.is_default",
	},
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((column: unknown, value: unknown) => ({ op: "eq", column, value })),
	and: vi.fn((...conditions: unknown[]) => ({ op: "and", conditions })),
	desc: vi.fn((column: unknown) => ({ op: "desc", column })),
	sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ op: "sql", strings, values })),
}));

vi.mock("@/lib/db", () => ({
	db: {
		insert: vi.fn(() => ({
			values: vi.fn((value: unknown) => {
				insertValuesMock(value);
				return {
					returning: vi.fn(async () => [savedSearchRow]),
				};
			}),
		})),
		select: vi.fn(() => {
			const rows = selectRowsQueue.shift() ?? [];
			const builder = {
				from: vi.fn(() => builder),
				where: vi.fn((condition: unknown) => {
					selectWhereMock(condition);
					return builder;
				}),
				orderBy: vi.fn(async () => rows),
			};
			return builder;
		}),
		delete: vi.fn(() => ({
			where: vi.fn(async (condition: unknown) => {
				deleteWhereMock(condition);
			}),
		})),
	},
}));

import {
	createDiscoveryPreset,
	deleteDiscoveryPreset,
	listDiscoveryPresets,
} from "@/lib/actions/saved-searches";

beforeEach(() => {
	vi.clearAllMocks();
	selectRowsQueue.length = 0;
	getCurrentUserIdMock.mockResolvedValue("user-1");
});

describe("discovery presets", () => {
	it("stores reusable discovery run inputs as tagged saved searches", async () => {
		const preset = await createDiscoveryPreset({
			name: " East Africa ICT ",
			input: {
				queries: [" ICT tender Kenya ", "ICT tender Kenya", " RFP Uganda "],
				limitPerQuery: 99,
				sourceUrls: [" https://buyer.example/tenders ", "https://buyer.example/tenders"],
				sourceScrapeLimit: 99,
				countryRegion: " East Africa ",
				category: " ICT ",
				engines: [" bing ", "bing", " wikipedia "],
				scrapeTopResults: true,
				scrapeLimit: 12,
				browserFallback: true,
				downloadDiscoveredDocuments: true,
				downloadLimit: 99,
				includeUnmatchedResults: false,
			},
		});

		expect(insertValuesMock).toHaveBeenCalledWith(expect.objectContaining({
			userId: "user-1",
			name: "East Africa ICT",
			filters: expect.objectContaining({
				kind: "opportunity_discovery_preset",
				version: 1,
				input: expect.objectContaining({
					queries: ["ICT tender Kenya", "RFP Uganda"],
					limitPerQuery: 50,
					sourceUrls: ["https://buyer.example/tenders"],
					sourceScrapeLimit: 50,
					countryRegion: "East Africa",
					category: "ICT",
					engines: ["bing", "wikipedia"],
					scrapeLimit: 10,
					downloadDiscoveredDocuments: true,
					downloadLimit: 10,
					updateExisting: true,
				}),
			}),
			isDefault: false,
		}));
		expect(preset).toMatchObject({
			id: "preset-1",
			name: "East Africa ICT",
			input: expect.objectContaining({
				queries: ["ICT tender Kenya", "RFP Uganda"],
				countryRegion: "East Africa",
			}),
		});
	});

	it("lists discovery presets without returning normal saved searches", async () => {
		selectRowsQueue.push([savedSearchRow]);

		const presets = await listDiscoveryPresets();

		expect(selectWhereMock).toHaveBeenCalledWith(expect.objectContaining({ op: "and" }));
		expect(presets).toEqual([expect.objectContaining({
			id: "preset-1",
			name: "East Africa ICT",
			description: "2 queries, East Africa",
		})]);
	});

	it("deletes only discovery presets owned by the signed-in user", async () => {
		await deleteDiscoveryPreset("preset-1");

		expect(deleteWhereMock).toHaveBeenCalledWith(expect.objectContaining({ op: "and" }));
	});
});
