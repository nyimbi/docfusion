import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema", () => ({
	savedSearches: {},
}));

import {
	createSavedSearch,
	createDiscoveryPreset,
	deleteDiscoveryPreset,
	deleteSavedSearch,
	getDefaultSavedSearch,
	listDiscoveryPresets,
	listSavedSearches,
	setDefaultSavedSearch,
	updateSavedSearch,
} from "@/lib/actions/saved-searches";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("saved search action auth", () => {
	it("rejects unauthenticated saved search actions before database access", async () => {
		await expect(createSavedSearch("spoofed-user", {
			name: "Spoofed",
			filters: {},
		})).rejects.toThrow("Unauthorized");
		await expect(listSavedSearches("spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(getDefaultSavedSearch("spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(updateSavedSearch("search-1", "spoofed-user", { name: "Updated" })).rejects.toThrow("Unauthorized");
		await expect(deleteSavedSearch("search-1", "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(setDefaultSavedSearch("search-1", "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(createDiscoveryPreset({
			name: "Spoofed discovery",
			input: { queries: ["rfp Kenya"] },
		})).rejects.toThrow("Unauthorized");
		await expect(listDiscoveryPresets()).rejects.toThrow("Unauthorized");
		await expect(deleteDiscoveryPreset("preset-1")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
