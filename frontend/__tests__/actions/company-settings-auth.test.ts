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
	companySettings: {},
}));

import {
	getCompanyBoilerplate,
	getCompanyCapabilities,
	getCompanySettings,
	getDefaultBranding,
	isCompanyConfigured,
	saveCompanySettings,
	updateCompanySettings,
} from "@/lib/actions/company-settings";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("company settings action auth", () => {
	it("rejects unauthenticated settings reads and mutations before database access", async () => {
		await expect(getCompanySettings()).rejects.toThrow("Unauthorized");
		await expect(saveCompanySettings({ companyName: "Datacraft" })).rejects.toThrow("Unauthorized");
		await expect(updateCompanySettings({ companyName: "Datacraft" })).rejects.toThrow("Unauthorized");
		await expect(getDefaultBranding()).rejects.toThrow("Unauthorized");
		await expect(isCompanyConfigured()).rejects.toThrow("Unauthorized");
		await expect(getCompanyBoilerplate()).rejects.toThrow("Unauthorized");
		await expect(getCompanyCapabilities()).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
