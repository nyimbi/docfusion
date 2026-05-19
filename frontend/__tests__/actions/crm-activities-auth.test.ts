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
});
