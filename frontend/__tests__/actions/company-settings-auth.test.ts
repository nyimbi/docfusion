import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
}));
const eqMock = vi.hoisted(() => vi.fn((column, value) => ({ type: "eq", column, value })));
const andMock = vi.hoisted(() => vi.fn((...conditions) => ({ type: "and", conditions })));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));
vi.mock("@/lib/db", () => ({
	db: dbMock,
}));
vi.mock("@/lib/db/schema", () => ({
	companySettings: {
		id: "company_settings.id",
		organizationId: "company_settings.organization_id",
	},
}));
vi.mock("drizzle-orm", () => ({
	eq: eqMock,
	and: andMock,
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
	requireUserContextMock.mockRejectedValue(new Error("Unauthorized"));
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

		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("filters settings reads by the authenticated organization", async () => {
		requireUserContextMock.mockResolvedValue({
			userId: "user-1",
			organizationId: "org-1",
		});
		const limitMock = vi.fn(async () => []);
		const whereMock = vi.fn(() => ({ limit: limitMock }));
		const fromMock = vi.fn(() => ({ where: whereMock }));
		dbMock.select.mockReturnValueOnce({ from: fromMock });

		await expect(getCompanySettings()).resolves.toBeNull();

		expect(eqMock).toHaveBeenCalledWith(
			"company_settings.organization_id",
			"org-1"
		);
		expect(whereMock).toHaveBeenCalledWith({
			type: "eq",
			column: "company_settings.organization_id",
			value: "org-1",
		});
	});
});
