import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const getServerSessionMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
	getServerSession: getServerSessionMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
	documents: {},
	documentVersions: {},
	documentYjsStates: {},
	templates: {},
	templateCategories: {},
	templateSnippets: {},
}));
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

import {
	createDocument,
	deleteDocument,
	getDocument,
	getDocumentYjsState,
	listDocuments,
	saveDocumentYjsState,
	searchDocuments,
	updateDocument,
} from "@/app/actions/documents";
import {
	createTemplate,
	deleteTemplate,
	getTemplate,
	listTemplates,
	searchTemplates,
	updateTemplate,
	useTemplate,
} from "@/app/actions/templates";
import {
	createSnippet,
	deleteSnippet,
	expandShortcut,
	getSnippet,
	getSnippetByShortcut,
	getSnippetsByCategory,
	incrementSnippetUseCount,
	listSnippets,
	searchSnippets,
	updateSnippet,
} from "@/lib/actions/snippets";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
	getServerSessionMock.mockResolvedValue(null);
});

describe("legacy server action auth gates", () => {
	it("rejects unauthenticated document actions before database access", async () => {
		await expect(listDocuments()).rejects.toThrow("Unauthorized");
		await expect(getDocument("doc-1")).rejects.toThrow("Unauthorized");
		await expect(createDocument({ title: "Draft" })).rejects.toThrow("Unauthorized");
		await expect(updateDocument("doc-1", { title: "Updated" })).rejects.toThrow("Unauthorized");
		await expect(deleteDocument("doc-1")).rejects.toThrow("Unauthorized");
		await expect(getDocumentYjsState("doc-1")).rejects.toThrow("Unauthorized");
		await expect(saveDocumentYjsState("doc-1", "state", "vector")).rejects.toThrow("Unauthorized");
		await expect(searchDocuments("draft")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("rejects unauthenticated template actions before database access", async () => {
		await expect(listTemplates()).rejects.toThrow("Unauthorized");
		await expect(getTemplate("template-1")).rejects.toThrow("Unauthorized");
		await expect(createTemplate({
			name: "Template",
			description: "Description",
			content: { type: "doc", content: [] },
		})).rejects.toThrow("Unauthorized");
		await expect(updateTemplate("template-1", { name: "Updated" })).rejects.toThrow("Unauthorized");
		await expect(deleteTemplate("template-1")).rejects.toThrow("Unauthorized");
		await expect(useTemplate({
			templateId: "template-1",
			title: "Draft",
			placeholderValues: {},
		})).rejects.toThrow("Unauthorized");
		await expect(searchTemplates("template")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("rejects unauthenticated snippet actions before database access", async () => {
		await expect(listSnippets()).rejects.toThrow("Unauthorized");
		await expect(getSnippet("snippet-1")).rejects.toThrow("Unauthorized");
		await expect(getSnippetByShortcut("/intro")).rejects.toThrow("Unauthorized");
		await expect(createSnippet({
			name: "Intro",
			shortcut: "/intro",
			content: { type: "doc", content: [] },
		})).rejects.toThrow("Unauthorized");
		await expect(updateSnippet("snippet-1", { name: "Updated" })).rejects.toThrow("Unauthorized");
		await expect(deleteSnippet("snippet-1")).rejects.toThrow("Unauthorized");
		await expect(incrementSnippetUseCount("snippet-1")).rejects.toThrow("Unauthorized");
		await expect(searchSnippets("intro")).rejects.toThrow("Unauthorized");
		await expect(expandShortcut("/intro")).rejects.toThrow("Unauthorized");
		await expect(getSnippetsByCategory("general")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
