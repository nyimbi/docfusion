import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/db", () => ({
	db: mockDb,
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

describe("import action auth", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserContextMock.mockResolvedValue({
			userId: "importer-1",
			organizationId: "org-1",
		});
	});

	it("rejects mismatched import progress context before querying", async () => {
		const { getImportProgress } = await import("@/lib/actions/import");

		await expect(getImportProgress("import-1", {
			userId: "other-user",
			organizationId: "org-1",
		})).rejects.toThrow("Unauthorized");

		expect(mockDb.select).not.toHaveBeenCalled();
	});

	it("rejects mismatched import execution context before creating records", async () => {
		const { executeImport } = await import("@/lib/actions/import");

		await expect(executeImport(
			{
				sampleRows: [],
				totalRows: 0,
				metadata: { filename: "contacts.csv", fileType: "csv" },
			},
			"contacts",
			[],
			{ duplicateHandling: "skip", batchSize: 100, saveAsTemplate: false },
			{ userId: "importer-1", organizationId: "other-org" }
		)).rejects.toThrow("Unauthorized");

		expect(mockDb.insert).not.toHaveBeenCalled();
		expect(mockDb.update).not.toHaveBeenCalled();
	});
});
