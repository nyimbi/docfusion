import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
}));

function createChain(result: unknown[] = []) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "orderBy", "limit"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (resolve: (value: unknown[]) => void) => Promise.resolve(result).then(resolve);
	return chain;
}

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

	it("requires organization context before import progress queries", async () => {
		requireUserContextMock.mockResolvedValueOnce({
			userId: "importer-1",
			organizationId: undefined,
		});
		const { getImportProgress } = await import("@/lib/actions/import");

		await expect(getImportProgress("import-1", {
			userId: "importer-1",
			organizationId: "org-1",
		})).rejects.toThrow("No organization context");

		expect(mockDb.select).not.toHaveBeenCalled();
	});

	it("rejects missing caller organization before import progress queries", async () => {
		const { getImportProgress } = await import("@/lib/actions/import");

		await expect(getImportProgress("import-1", {
			userId: "importer-1",
			organizationId: "",
		})).rejects.toThrow("Unauthorized");

		expect(mockDb.select).not.toHaveBeenCalled();
	});

	it("normalizes import history limits after matching caller context", async () => {
		const lowLimitChain = createChain([]);
		const highLimitChain = createChain([]);
		mockDb.select
			.mockReturnValueOnce(lowLimitChain)
			.mockReturnValueOnce(highLimitChain);
		const { getImportHistory } = await import("@/lib/actions/import");

		await expect(getImportHistory({
			userId: "importer-1",
			organizationId: "org-1",
		}, -10)).resolves.toEqual([]);
		await expect(getImportHistory({
			userId: "importer-1",
			organizationId: "org-1",
		}, 2500)).resolves.toEqual([]);

		expect(lowLimitChain.limit).toHaveBeenCalledWith(1);
		expect(highLimitChain.limit).toHaveBeenCalledWith(1000);
	});

	it("requires a session before generating import previews", async () => {
		requireUserContextMock.mockRejectedValueOnce(new Error("Unauthorized"));
		const { generatePreview } = await import("@/lib/actions/import");

		await expect(generatePreview(
			{
				headers: ["name"],
				sampleRows: [{ name: "Acme" }],
				totalRows: 1,
			},
			"accounts",
			[{
				id: "mapping-1",
				targetColumn: "name",
				sourceColumns: ["name"],
				separator: ", ",
				transform: "none",
				defaultValue: "",
				required: true,
			}],
			1
		)).rejects.toThrow("Unauthorized");
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
