import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema-crm", () => ({
	accounts: {},
}));
vi.mock("@/lib/utils/logger", () => ({
	logger: {
		error: vi.fn(),
	},
}));

import {
	getResearchQueries,
	researchAccount,
	saveResearchFindings,
} from "@/lib/actions/crm/account-research";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockRejectedValue(new Error("Unauthorized"));
});

describe("CRM account research auth", () => {
	it("rejects unauthenticated account research actions before database access", async () => {
		await expect(researchAccount({
			accountId: "account-1",
			categories: ["company_info"],
			companyName: "Acme",
		})).rejects.toThrow("Unauthorized");
		await expect(saveResearchFindings("account-1", { website: "https://example.com" })).rejects.toThrow("Unauthorized");
		await expect(getResearchQueries("account-1", ["news"])).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
