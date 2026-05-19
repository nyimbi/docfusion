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
vi.mock("@/lib/db/schema", () => ({
	documents: {},
	proposalDocuments: {},
	opportunities: {},
}));
vi.mock("@/lib/render/latex-converter", () => ({
	tiptapToLatex: vi.fn(),
	tiptapToPlainText: vi.fn(),
}));
vi.mock("@/lib/render/docx-converter", () => ({
	tiptapToDocx: vi.fn(),
}));
vi.mock("@/lib/render/pptx-converter", () => ({
	tiptapToPptx: vi.fn(),
	estimateSlideCount: vi.fn(),
}));

import {
	getBrandingConfigs,
	preSubmissionAudit,
	renderDocument,
	renderToDOCX,
	renderToHTML,
	renderToLaTeX,
	renderToMarkdown,
	renderToPDF,
	renderToPPTX,
} from "@/lib/actions/document-render";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("document render action auth", () => {
	it("rejects unauthenticated rendering and audit actions before database access", async () => {
		await expect(renderToPDF("doc-1")).rejects.toThrow("Unauthorized");
		await expect(renderToDOCX("doc-1")).rejects.toThrow("Unauthorized");
		await expect(renderToPPTX("doc-1")).rejects.toThrow("Unauthorized");
		await expect(renderToLaTeX("doc-1")).rejects.toThrow("Unauthorized");
		await expect(renderToMarkdown("doc-1")).rejects.toThrow("Unauthorized");
		await expect(renderToHTML("doc-1")).rejects.toThrow("Unauthorized");
		await expect(renderDocument("doc-1", { format: "html" })).rejects.toThrow("Unauthorized");
		await expect(preSubmissionAudit("opp-1")).rejects.toThrow("Unauthorized");
		await expect(getBrandingConfigs()).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
