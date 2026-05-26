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
	rfpRequirements: {},
	proposalDocuments: {},
	documentSections: {},
	documents: {},
}));

import {
	exportDeadlineToICS,
	exportOpportunityMilestonesToICS,
	exportToICS,
	getCalendarMonthSummary,
	getDeadlineStats,
	getDeadlinesByDateRange,
	getDeadlinesForUser,
	getDeadlinesGroupedByDate,
	getMilestones,
	getOverdueItems,
	getTodaysDeadlines,
	getUpcomingDeadlines,
} from "@/lib/actions/calendar";

const dateRange = {
	startDate: new Date("2026-01-01T00:00:00.000Z"),
	endDate: new Date("2026-01-31T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
	requireUserContextMock.mockRejectedValue(new Error("Unauthorized"));
});

describe("calendar action auth", () => {
	it("rejects unauthenticated calendar and ICS actions before database access", async () => {
		await expect(getDeadlinesByDateRange(dateRange)).rejects.toThrow("Unauthorized");
		await expect(getUpcomingDeadlines({ days: 30 })).rejects.toThrow("Unauthorized");
		await expect(getOverdueItems()).rejects.toThrow("Unauthorized");
		await expect(getMilestones("opp-1")).rejects.toThrow("Unauthorized");
		await expect(getDeadlinesGroupedByDate(dateRange)).rejects.toThrow("Unauthorized");
		await expect(getCalendarMonthSummary(1, 2026)).rejects.toThrow("Unauthorized");
		await expect(getDeadlineStats()).rejects.toThrow("Unauthorized");
		await expect(getTodaysDeadlines()).rejects.toThrow("Unauthorized");
		await expect(getDeadlinesForUser("user-1")).rejects.toThrow("Unauthorized");
		await expect(exportToICS()).rejects.toThrow("Unauthorized");
		await expect(exportDeadlineToICS("deadline-1")).rejects.toThrow("Unauthorized");
		await expect(exportOpportunityMilestonesToICS("opp-1")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
