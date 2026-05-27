import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());

function createChain(result: unknown[]) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "limit"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (
		resolve: (value: unknown[]) => void,
		reject: (reason: unknown) => void
	) => Promise.resolve(result).then(resolve, reject);
	return chain;
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
	requireUserContext: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
	},
}));

import { renderDocument, renderToPDF } from "@/lib/actions/document-render";

const documentContent = {
	type: "doc",
	content: [
		{
			type: "heading",
			attrs: { level: 1 },
			content: [{ type: "text", text: "Technical Approach" }],
		},
		{
			type: "paragraph",
			content: [{
				type: "text",
				text: "DocFusion will deliver a compliant, evidence-backed response package.",
			}],
		},
		{
			type: "bulletList",
			content: [
				{
					type: "listItem",
					content: [{
						type: "paragraph",
						content: [{ type: "text", text: "Mapped requirements" }],
					}],
				},
				{
					type: "listItem",
					content: [{
						type: "paragraph",
						content: [{ type: "text", text: "Validated attachments" }],
					}],
				},
			],
		},
	],
};

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue("render-user-1");
	dbMock.select.mockReturnValue(createChain([{
		content: documentContent,
		title: "Winning Response",
		wordCount: 32,
	}]));
});

describe("document PDF rendering", () => {
	it("returns a real PDF artifact instead of LaTeX source", async () => {
		const result = await renderToPDF("doc-1", {
			format: "pdf",
			includeHeader: true,
			includeFooter: true,
			branding: {
				id: "brand-1",
				name: "Bid Team",
				companyName: "Lindela",
				primaryColor: "#124f8c",
				secondaryColor: "#3f6f7f",
			},
			metadata: {
				title: "Final Submission",
				author: "Proposal Team",
			},
		});

		expect(result.success).toBe(true);
		expect(result.format).toBe("pdf");
		expect(result.mimeType).toBe("application/pdf");
		expect(result.filename).toMatch(/^winning-response-\d{4}-\d{2}-\d{2}\.pdf$/);
		expect(result.pageCount).toBeGreaterThanOrEqual(1);
		expect(result.data).toBeDefined();

		const pdfBuffer = Buffer.from(result.data!, "base64");
		expect(pdfBuffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
		expect(result.size).toBe(pdfBuffer.length);
		expect(pdfBuffer.toString("utf8")).not.toContain("\\documentclass");
	});

	it("routes unified PDF rendering to the same PDF artifact builder", async () => {
		const result = await renderDocument("doc-1", { format: "pdf" });

		expect(result.success).toBe(true);
		expect(result.mimeType).toBe("application/pdf");
		expect(result.filename).toMatch(/\.pdf$/);
		expect(Buffer.from(result.data!, "base64").subarray(0, 5).toString("utf8")).toBe("%PDF-");
	});

	it("paginates long response documents instead of overflowing a single page", async () => {
		dbMock.select.mockReturnValue(createChain([{
			content: {
				type: "doc",
				content: Array.from({ length: 90 }, (_, index) => ({
					type: "paragraph",
					content: [{
						type: "text",
						text: `Evidence-backed delivery paragraph ${index + 1} with enough response detail to require wrapped PDF output.`,
					}],
				})),
			},
			title: "Long Response",
			wordCount: 1000,
		}]));

		const result = await renderToPDF("doc-1", { format: "pdf" });

		expect(result.success).toBe(true);
		expect(result.pageCount).toBeGreaterThan(1);
		expect(Buffer.from(result.data!, "base64").subarray(0, 5).toString("utf8")).toBe("%PDF-");
	});

	it("preserves PDF-only options and non-text content references", async () => {
		dbMock.select.mockReturnValue(createChain([{
			content: {
				type: "doc",
				content: [
					{
						type: "heading",
						attrs: { level: 1 },
						content: [{ type: "text", text: "Delivery Plan" }],
					},
					{
						type: "paragraph",
						content: [
							{ type: "text", text: "Strong", marks: [{ type: "bold" }] },
							{ type: "text", text: " compliance evidence with " },
							{ type: "text", text: "linked proof", marks: [{ type: "link", attrs: { href: "https://example.test/proof" } }] },
							{ type: "text", text: "." },
						],
					},
					{
						type: "image",
						attrs: {
							src: "https://example.test/architecture.png",
							alt: "Solution architecture diagram",
						},
					},
				],
			},
			title: "Optioned Response",
			wordCount: 64,
		}]));

		const result = await renderToPDF("doc-1", {
			format: "pdf",
			includeTableOfContents: true,
			watermark: "DRAFT",
		});

		expect(result.success).toBe(true);
		const pdfText = Buffer.from(result.data!, "base64").toString("latin1");
		expect(pdfText).toContain("DRAFT");
		expect(pdfText).toContain("Table of Contents");
		expect(pdfText).toContain("Image: Solution architecture diagram");
		expect(pdfText).toContain("/Helvetica-Bold");
	});
});
