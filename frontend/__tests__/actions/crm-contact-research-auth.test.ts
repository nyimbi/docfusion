import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
	update: vi.fn(),
	query: {
		contacts: { findFirst: vi.fn() },
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/db", () => ({
	db: mockDb,
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: {
		error: vi.fn(),
	},
}));

describe("CRM contact research action auth", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserContextMock.mockResolvedValue({
			userId: "crm-user-1",
			organizationId: "org-1",
		});
		vi.stubGlobal("fetch", vi.fn());
	});

	it("rejects spoofed research context before querying contacts", async () => {
		const { researchContact } = await import("@/lib/actions/crm/contact-research");

		await expect(researchContact({
			contactId: "contact-1",
			fullName: "Ada Lovelace",
			categories: ["general"],
		}, { userId: "other-user", organizationId: "org-1" })).rejects.toThrow("Unauthorized");

		expect(mockDb.query.contacts.findFirst).not.toHaveBeenCalled();
		expect(fetch).not.toHaveBeenCalled();
	});

	it("rejects spoofed save context before updating research findings", async () => {
		const { saveContactResearch } = await import("@/lib/actions/crm/contact-research");

		const result = await saveContactResearch("contact-1", {
			summary: "Senior technical contact.",
			keyInsights: [],
			talkingPoints: [],
			connectionOpportunities: [],
			confidenceScore: 0.8,
		}, { userId: "other-user", organizationId: "org-1" });

		expect(result).toEqual({ success: false, error: "Unauthorized" });
		expect(mockDb.query.contacts.findFirst).not.toHaveBeenCalled();
		expect(mockDb.update).not.toHaveBeenCalled();
	});
});
