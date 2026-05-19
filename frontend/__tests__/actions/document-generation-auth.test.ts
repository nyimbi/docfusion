import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const initializeAIConfigMock = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
	insert: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/db", () => ({
	db: mockDb,
}));

vi.mock("@/lib/ai/config", () => ({
	initializeAIConfig: initializeAIConfigMock,
}));

vi.mock("@/lib/ai/providers", () => ({
	getProviderManager: vi.fn(() => ({
		isAvailable: vi.fn(async () => true),
		getActiveProvider: vi.fn(),
	})),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

describe("document generation action auth", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getCurrentUserIdMock.mockResolvedValue("author-1");
	});

	it("requires a session before generating document structures", async () => {
		getCurrentUserIdMock.mockResolvedValueOnce(null);
		const { generateDocumentStructure } = await import("@/lib/actions/document-generation");

		await expect(generateDocumentStructure({
			prompt: "Draft an executive summary",
		})).rejects.toThrow("Unauthorized");

		expect(initializeAIConfigMock).not.toHaveBeenCalled();
	});

	it("rejects spoofed document creation owners before inserting", async () => {
		const { createDocumentFromStructure } = await import("@/lib/actions/document-generation");

		await expect(createDocumentFromStructure(
			"Executive Summary",
			[],
			"other-user"
		)).rejects.toThrow("Unauthorized");

		expect(mockDb.insert).not.toHaveBeenCalled();
	});
});
