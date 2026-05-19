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
vi.mock("@/lib/db/schema-crm", () => ({
	accounts: {},
	activities: {},
	contacts: {},
	crmDocuments: {},
	deals: {},
}));

import {
	bulkDeleteDocuments,
	copyDocument,
	deleteDocument,
	moveDocument,
	updateDocument,
	uploadDocument,
	uploadNewVersion,
} from "@/lib/actions/crm/documents";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("CRM document auth", () => {
	it("rejects unauthenticated document writes before database access", async () => {
		await expect(uploadDocument({
			name: "Spoofed document",
			type: "contract",
			accountId: "account-1",
		})).rejects.toThrow("Unauthorized");
		await expect(updateDocument("document-1", { name: "Updated" })).rejects.toThrow("Unauthorized");
		await expect(deleteDocument("document-1")).rejects.toThrow("Unauthorized");
		await expect(uploadNewVersion("document-1", {
			name: "Version 2",
			type: "contract",
		})).rejects.toThrow("Unauthorized");
		await expect(bulkDeleteDocuments(["document-1"])).rejects.toThrow("Unauthorized");
		await expect(moveDocument("document-1", "deal-1", "deal")).rejects.toThrow("Unauthorized");
		await expect(copyDocument("document-1", "deal-1", "deal")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
