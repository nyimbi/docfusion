import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const requireUserContextMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
	requireUserContext: requireUserContextMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema", () => ({
	opportunities: {},
	opportunityVotes: {},
}));

import {
	bulkDeleteOpportunities,
	bulkUpdateStatus,
	createOpportunity,
	deleteOpportunity,
	duplicateOpportunity,
	getOpportunityById,
	getUpcomingDeadlines,
	listOpportunities,
	refreshExpirationStatus,
	updateOpportunity,
} from "@/lib/actions/opportunities-crud";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
	requireUserContextMock.mockRejectedValue(new Error("Unauthorized"));
});

describe("legacy opportunity CRUD action auth", () => {
	it("rejects unauthenticated opportunity CRUD and calendar helper actions before database access", async () => {
		await expect(createOpportunity({ title: "Solar mini-grid RFP" })).rejects.toThrow("Unauthorized");
		await expect(getOpportunityById("opp-1")).rejects.toThrow("Unauthorized");
		await expect(updateOpportunity("opp-1", { title: "Updated RFP" })).rejects.toThrow("Unauthorized");
		await expect(deleteOpportunity("opp-1")).rejects.toThrow("Unauthorized");
		await expect(listOpportunities()).rejects.toThrow("Unauthorized");
		await expect(duplicateOpportunity("opp-1")).rejects.toThrow("Unauthorized");
		await expect(bulkUpdateStatus(["opp-1"], "interested")).rejects.toThrow("Unauthorized");
		await expect(bulkDeleteOpportunities(["opp-1"])).rejects.toThrow("Unauthorized");
		await expect(refreshExpirationStatus()).rejects.toThrow("Unauthorized");
		await expect(getUpcomingDeadlines()).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
