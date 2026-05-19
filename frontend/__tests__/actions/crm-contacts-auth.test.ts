import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	select: vi.fn(),
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

describe("CRM contact action auth", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserContextMock.mockResolvedValue({
			userId: "crm-user-1",
			organizationId: "org-1",
		});
	});

	it("rejects spoofed createContact user context before inserting", async () => {
		const { createContact } = await import("@/lib/actions/crm/contacts");

		await expect(createContact({
			firstName: "Ada",
			lastName: "Lovelace",
			email: "ada@example.com",
		}, { userId: "other-user", organizationId: "org-1" })).rejects.toThrow("Unauthorized");

		expect(mockDb.insert).not.toHaveBeenCalled();
	});

	it("rejects spoofed legacy contact creation before inserting", async () => {
		const { createContactLegacy } = await import("@/lib/actions/crm/contacts");

		await expect(createContactLegacy({
			firstName: "Grace",
			lastName: "Hopper",
			email: "grace@example.com",
		}, "other-user")).rejects.toThrow("Unauthorized");

		expect(mockDb.insert).not.toHaveBeenCalled();
	});

	it("rejects spoofed owner lookup before querying contacts", async () => {
		const { findOwnedContactByEmail } = await import("@/lib/actions/crm/contacts");

		await expect(findOwnedContactByEmail("ada@example.com", "other-user")).rejects.toThrow("Unauthorized");

		expect(mockDb.query.contacts.findFirst).not.toHaveBeenCalled();
	});

	it("rejects spoofed bulk deletion context before deleting", async () => {
		const { bulkDeleteContacts } = await import("@/lib/actions/crm/contacts");

		await expect(bulkDeleteContacts(["contact-1"], {
			userId: "other-user",
			organizationId: "org-1",
		})).rejects.toThrow("Unauthorized");

		expect(mockDb.delete).not.toHaveBeenCalled();
	});
});
