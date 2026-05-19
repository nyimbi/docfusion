import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	getServerSession: getServerSessionMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema-crm", () => ({
	accounts: {},
	accountStageHistory: {},
	activities: {},
	contacts: {},
	crmDocuments: {},
	deals: {},
	dealStageHistory: {},
}));

import {
	bulkAddAccountTags,
	bulkUpdateAccountOwner,
	convertLeadToCustomer,
	convertProspectToLead,
	createAccount,
	deleteAccount,
	updateAccount,
	updateAccountStage,
} from "@/lib/actions/crm/accounts";
import {
	bulkUpdateDealOwner,
	cloneDeal,
	createDeal,
	deleteDeal,
	markDealLost,
	markDealWon,
	putDealOnHold,
	reactivateDeal,
	updateDeal,
	updateDealStage,
} from "@/lib/actions/crm/deals";

beforeEach(() => {
	vi.clearAllMocks();
	getServerSessionMock.mockResolvedValue(null);
});

describe("CRM account and deal auth", () => {
	it("rejects unauthenticated account writes before database access", async () => {
		await expect(createAccount({
			name: "Spoofed Account",
			type: "prospect",
			ownerId: "victim-user",
		})).rejects.toThrow("Unauthorized");
		await expect(updateAccount("account-1", { ownerId: "victim-user" })).rejects.toThrow("Unauthorized");
		await expect(deleteAccount("account-1")).rejects.toThrow("Unauthorized");
		await expect(updateAccountStage("account-1", "qualified")).rejects.toThrow("Unauthorized");
		await expect(convertLeadToCustomer("account-1")).rejects.toThrow("Unauthorized");
		await expect(convertProspectToLead("account-1")).rejects.toThrow("Unauthorized");
		await expect(bulkUpdateAccountOwner(["account-1"], "victim-user", "Victim")).rejects.toThrow("Unauthorized");
		await expect(bulkAddAccountTags(["account-1"], ["priority"])).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("rejects unauthenticated deal writes before database access", async () => {
		await expect(createDeal({
			accountId: "account-1",
			name: "Spoofed Deal",
			ownerId: "victim-user",
		})).rejects.toThrow("Unauthorized");
		await expect(updateDeal("deal-1", { ownerId: "victim-user" })).rejects.toThrow("Unauthorized");
		await expect(deleteDeal("deal-1")).rejects.toThrow("Unauthorized");
		await expect(updateDealStage("deal-1", "proposal")).rejects.toThrow("Unauthorized");
		await expect(markDealWon("deal-1")).rejects.toThrow("Unauthorized");
		await expect(markDealLost("deal-1", "Lost")).rejects.toThrow("Unauthorized");
		await expect(putDealOnHold("deal-1")).rejects.toThrow("Unauthorized");
		await expect(reactivateDeal("deal-1")).rejects.toThrow("Unauthorized");
		await expect(bulkUpdateDealOwner(["deal-1"], "victim-user", "Victim")).rejects.toThrow("Unauthorized");
		await expect(cloneDeal("deal-1")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
