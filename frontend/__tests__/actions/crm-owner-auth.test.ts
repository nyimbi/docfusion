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
	getAccount,
	getAccounts,
	getAccountsByRegion,
	getAccountStats,
	getAccountsNeedingFollowup,
	getAccountWithRelations,
	getPipelineMetrics,
	searchAccounts,
	updateAccount,
	updateAccountStage,
} from "@/lib/actions/crm/accounts";
import {
	bulkUpdateDealOwner,
	cloneDeal,
	createDeal,
	deleteDeal,
	getAccountDeals,
	getDeal,
	getDealForecast,
	getDealPipelineValue,
	getDeals,
	getDealsClosingSoon,
	getDealWithRelations,
	getOverdueDeals,
	getWinLossAnalysis,
	markDealLost,
	markDealWon,
	putDealOnHold,
	reactivateDeal,
	searchDeals,
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

	it("rejects unauthenticated account reads before database access", async () => {
		await expect(getAccount("account-1")).rejects.toThrow("Unauthorized");
		await expect(getAccountWithRelations("account-1")).rejects.toThrow("Unauthorized");
		await expect(getAccounts()).rejects.toThrow("Unauthorized");
		await expect(getAccountStats()).rejects.toThrow("Unauthorized");
		await expect(getAccountsByRegion()).rejects.toThrow("Unauthorized");
		await expect(getPipelineMetrics("prospect")).rejects.toThrow("Unauthorized");
		await expect(searchAccounts("acme")).rejects.toThrow("Unauthorized");
		await expect(getAccountsNeedingFollowup()).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("rejects spoofed account owner read filters before database access", async () => {
		getServerSessionMock.mockResolvedValue({
			user: { id: "crm-user-1", name: "CRM User" },
		});

		await expect(getAccounts({ ownerId: "other-user" })).rejects.toThrow("Unauthorized");
		await expect(getAccountsNeedingFollowup(0, undefined, "other-user")).rejects.toThrow("Unauthorized");

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

	it("rejects unauthenticated deal reads before database access", async () => {
		await expect(getDeal("deal-1")).rejects.toThrow("Unauthorized");
		await expect(getDealWithRelations("deal-1")).rejects.toThrow("Unauthorized");
		await expect(getDeals()).rejects.toThrow("Unauthorized");
		await expect(getAccountDeals("account-1")).rejects.toThrow("Unauthorized");
		await expect(getDealPipelineValue()).rejects.toThrow("Unauthorized");
		await expect(getDealForecast()).rejects.toThrow("Unauthorized");
		await expect(getWinLossAnalysis()).rejects.toThrow("Unauthorized");
		await expect(getDealsClosingSoon()).rejects.toThrow("Unauthorized");
		await expect(getOverdueDeals()).rejects.toThrow("Unauthorized");
		await expect(searchDeals("renewal")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("rejects spoofed deal owner read filters before database access", async () => {
		getServerSessionMock.mockResolvedValue({
			user: { id: "crm-user-1", name: "CRM User" },
		});

		await expect(getDeals({ ownerId: "other-user" })).rejects.toThrow("Unauthorized");
		await expect(getDealsClosingSoon(30, "other-user")).rejects.toThrow("Unauthorized");
		await expect(getOverdueDeals("other-user")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
