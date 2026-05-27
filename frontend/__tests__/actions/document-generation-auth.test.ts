import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const initializeAIConfigMock = vi.hoisted(() => vi.fn());
const providerAvailableMock = vi.hoisted(() => vi.fn(async () => true));
const providerCompleteMock = vi.hoisted(() =>
	vi.fn(async () => ({
		content: JSON.stringify({
			paragraphs: ["Generated section content with concrete proposal detail."],
		}),
	}))
);
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
		isAvailable: providerAvailableMock,
		getActiveProvider: vi.fn(),
		complete: providerCompleteMock,
	})),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

describe("document generation action auth", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getCurrentUserIdMock.mockResolvedValue("author-1");
		providerAvailableMock.mockResolvedValue(true);
		providerCompleteMock.mockResolvedValue({
			content: JSON.stringify({
				paragraphs: ["Generated section content with concrete proposal detail."],
			}),
		});
	});

	it("requires a session before generating document structures", async () => {
		getCurrentUserIdMock.mockResolvedValueOnce(null);
		const { generateDocumentStructure } = await import("@/lib/actions/document-generation");

		await expect(generateDocumentStructure({
			prompt: "Draft an executive summary",
		})).rejects.toThrow("Unauthorized");

		expect(initializeAIConfigMock).not.toHaveBeenCalled();
	});

	it("generates a deterministic structure when AI returns an empty structure array", async () => {
		providerCompleteMock.mockResolvedValueOnce({ content: "[]" });
		const { generateDocumentStructure } = await import("@/lib/actions/document-generation");

		const result = await generateDocumentStructure({
			prompt: "Draft a response plan for a digital health platform",
			minSections: 2,
			maxSections: 4,
		});

		expect(result.length).toBeGreaterThan(0);
		expect(result[0]).toEqual(expect.objectContaining({
			type: "chapter",
			title: expect.stringContaining("Draft a response plan"),
		}));
		expect(result[0].children?.length).toBeGreaterThan(0);
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

	it("uses deterministic section prose when AI returns empty paragraphs", async () => {
		providerCompleteMock.mockResolvedValueOnce({
			content: JSON.stringify({ paragraphs: ["   ", ""] }),
		});
		const { generateSectionContent } = await import("@/lib/actions/document-generation");

		const result = await generateSectionContent({
			documentId: "doc-1",
			sectionId: "section-1",
			sectionPath: ["Technical Approach"],
			sectionTitle: "Technical Approach",
			parentContext: "Executive Summary",
			tone: "professional",
			length: "brief",
			keyPoints: ["Evidence-backed delivery controls"],
		});

		const serialized = JSON.stringify(result.content);
		expect(serialized).toContain("Technical Approach within Executive Summary frames the response content");
		expect(serialized).toContain("Evidence-backed delivery controls");
		expect(serialized).not.toContain("paragraphs");
		expect(result.wordCount).toBeGreaterThan(10);
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

	it("generates a deterministic diagram when the AI provider is unavailable", async () => {
		providerAvailableMock.mockResolvedValueOnce(false);
		const { generateDiagram } = await import("@/lib/actions/document-generation");

		const result = await generateDiagram({
			type: "flowchart",
			description: "Intake request. Validate requirements. Produce response.",
		});

		expect(result).toMatchObject({
			type: "mermaid",
			code: expect.stringContaining("flowchart TD"),
		});
		expect(result.code).toContain("Intake request");
		expect(result.code).toContain("S1 --> S2");
		expect(providerCompleteMock).not.toHaveBeenCalled();
	});

	it("generates a deterministic diagram when AI returns blank diagram code", async () => {
		providerCompleteMock.mockResolvedValueOnce({ content: "```mermaid\n   \n```" });
		const { generateDiagram } = await import("@/lib/actions/document-generation");

		const result = await generateDiagram({
			type: "flowchart",
			description: "Intake request. Validate requirements. Produce response.",
		});

		expect(result).toMatchObject({
			type: "mermaid",
			code: expect.stringContaining("flowchart TD"),
		});
		expect(result.description).toContain("AI diagram generation failed");
	});
});
