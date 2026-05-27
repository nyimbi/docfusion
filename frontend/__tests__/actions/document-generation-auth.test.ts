import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const initializeAIConfigMock = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
	insert: vi.fn(),
}));

function createInsertChain(result: unknown[] = []) {
	const chain = {
		values: vi.fn(() => chain),
		returning: vi.fn(async () => result),
	};
	return chain;
}

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
		complete: vi.fn(async () => ({
			content: JSON.stringify({
				paragraphs: ["Generated section content with concrete proposal detail."],
			}),
		})),
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

	it("creates an auto-filled document from generated section content", async () => {
		const documentInsert = createInsertChain([{ id: "doc-auto" }]);
		const versionInsert = createInsertChain();
		mockDb.insert
			.mockReturnValueOnce(documentInsert)
			.mockReturnValueOnce(versionInsert);
		const { createDocumentFromStructure } = await import("@/lib/actions/document-generation");

		const result = await createDocumentFromStructure(
			"Executive Summary",
			[{
				id: "section-1",
				type: "section",
				title: "Technical Approach",
				order: 1,
				length: "brief",
			}],
			"author-1",
			{ autoFill: true }
		);

		expect(JSON.stringify(result.content)).toContain("Generated section content with concrete proposal detail.");
		expect(documentInsert.values).toHaveBeenCalledWith(expect.objectContaining({
			content: result.content,
			wordCount: 7,
		}));
	});

	it("creates an editable outline without fake section content", async () => {
		const documentInsert = createInsertChain([{ id: "doc-1" }]);
		const versionInsert = createInsertChain();
		mockDb.insert
			.mockReturnValueOnce(documentInsert)
			.mockReturnValueOnce(versionInsert);

		const { createDocumentFromStructure } = await import("@/lib/actions/document-generation");
		const result = await createDocumentFromStructure(
			"Executive Summary",
			[{
				id: "section-1",
				type: "section",
				title: "Technical Approach",
				order: 1,
				length: "medium",
			}],
			"author-1",
			{ autoFill: false }
		);

		const content = result.content.content;
		expect(JSON.stringify(content)).not.toContain("(medium content for technical approach)");
		expect(content).toEqual([
			{
				type: "heading",
				attrs: { level: 1 },
				content: [{ type: "text", text: "Technical Approach" }],
			},
			{
				type: "paragraph",
				content: [],
			},
		]);
		expect(documentInsert.values).toHaveBeenCalledWith(expect.objectContaining({
			content: result.content,
			wordCount: 0,
		}));
	});
});
