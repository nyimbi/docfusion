import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/db", () => ({
	db: mockDb,
}));

describe("enhanced document action auth", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getCurrentUserIdMock.mockResolvedValue("author-1");
	});

	it("requires a session before saving document versions", async () => {
		getCurrentUserIdMock.mockResolvedValueOnce(null);
		const { saveDocumentVersion } = await import("@/lib/actions/documents-enhanced");

		await expect(saveDocumentVersion(
			"00000000-0000-4000-8000-000000000001" as never,
			"Manual checkpoint"
		)).rejects.toThrow("Unauthorized");

		expect(mockDb.select).not.toHaveBeenCalled();
		expect(mockDb.insert).not.toHaveBeenCalled();
	});

	it("rejects spoofed owner IDs before importing HTML", async () => {
		const { importFromHTML } = await import("@/lib/actions/documents-enhanced");

		await expect(importFromHTML("<p>Hello</p>", {
			title: "Imported",
			ownerId: "other-user",
		})).rejects.toThrow("Unauthorized");

		expect(mockDb.insert).not.toHaveBeenCalled();
	});
});
