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
vi.mock("@/lib/actions/crm/contacts", () => ({
	recordContactInteractionInternal: vi.fn(),
}));

import {
	cancelActivity,
	completeActivity,
	createActivity,
	deleteActivity,
	getAccountTimeline,
	getActivities,
	getActivitiesNeedingFollowup,
	getActivity,
	getActivityCountsByUser,
	getActivityStats,
	getActivityWithRelations,
	getContactTimeline,
	getDealTimeline,
	getOverdueTasks,
	getUpcomingTasks,
	rescheduleActivity,
	updateActivity,
} from "@/lib/actions/crm/activities";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("CRM activity auth", () => {
	it("rejects unauthenticated activity writes before database access", async () => {
		await expect(createActivity({
			type: "note",
			subject: "Spoofed activity",
		})).rejects.toThrow("Unauthorized");
		await expect(updateActivity("activity-1", { subject: "Updated" })).rejects.toThrow("Unauthorized");
		await expect(deleteActivity("activity-1")).rejects.toThrow("Unauthorized");
		await expect(completeActivity("activity-1")).rejects.toThrow("Unauthorized");
		await expect(rescheduleActivity("activity-1", new Date("2026-01-01T00:00:00Z"))).rejects.toThrow("Unauthorized");
		await expect(cancelActivity("activity-1")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("rejects unauthenticated activity reads before database access", async () => {
		await expect(getActivity("activity-1")).rejects.toThrow("Unauthorized");
		await expect(getActivityWithRelations("activity-1")).rejects.toThrow("Unauthorized");
		await expect(getActivities()).rejects.toThrow("Unauthorized");
		await expect(getAccountTimeline("account-1")).rejects.toThrow("Unauthorized");
		await expect(getContactTimeline("contact-1")).rejects.toThrow("Unauthorized");
		await expect(getDealTimeline("deal-1")).rejects.toThrow("Unauthorized");
		await expect(getUpcomingTasks()).rejects.toThrow("Unauthorized");
		await expect(getOverdueTasks()).rejects.toThrow("Unauthorized");
		await expect(getActivitiesNeedingFollowup()).rejects.toThrow("Unauthorized");
		await expect(getActivityStats()).rejects.toThrow("Unauthorized");
		await expect(getActivityCountsByUser()).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("rejects spoofed activity actor parameters before database access", async () => {
		getCurrentUserIdMock.mockResolvedValue("crm-user-1");

		await expect(createActivity({
			type: "note",
			subject: "Spoofed activity",
		}, "other-user")).rejects.toThrow("Unauthorized");
		await expect(getActivities({ createdBy: "other-user" })).rejects.toThrow("Unauthorized");
		await expect(getUpcomingTasks("other-user")).rejects.toThrow("Unauthorized");
		await expect(getOverdueTasks("other-user")).rejects.toThrow("Unauthorized");
		await expect(getActivitiesNeedingFollowup("other-user")).rejects.toThrow("Unauthorized");
		await expect(getActivityStats({ createdBy: "other-user" })).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
