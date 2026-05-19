import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	update: vi.fn(),
	insert: vi.fn(),
	delete: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((left, right) => ({ type: "eq", left, right })),
	and: vi.fn((...conditions) => ({ type: "and", conditions })),
	or: vi.fn((...conditions) => ({ type: "or", conditions })),
	sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
		type: "sql",
		text: Array.from(strings).join("?"),
		values,
	})),
	desc: vi.fn((column) => ({ type: "desc", column })),
	asc: vi.fn((column) => ({ type: "asc", column })),
	inArray: vi.fn((left, values) => ({ type: "inArray", left, values })),
}));

vi.mock("@/lib/db", () => ({
	db: dbMock,
}));

vi.mock("@/lib/db/schema", () => ({
	documents: {
		id: "documents.id",
		title: "documents.title",
		content: "documents.content",
		plainText: "documents.plain_text",
		status: "documents.status",
		visibility: "documents.visibility",
		ownerId: "documents.owner_id",
		templateId: "documents.template_id",
		tags: "documents.tags",
		wordCount: "documents.word_count",
		characterCount: "documents.character_count",
		currentVersion: "documents.current_version",
		collaboratorIds: "documents.collaborator_ids",
		metadata: "documents.metadata",
		createdAt: "documents.created_at",
		updatedAt: "documents.updated_at",
		lastAccessedAt: "documents.last_accessed_at",
	},
	documentVersions: {
		id: "document_versions.id",
		documentId: "document_versions.document_id",
		versionNumber: "document_versions.version_number",
		content: "document_versions.content",
		changeDescription: "document_versions.change_description",
		yjsStateVector: "document_versions.yjs_state_vector",
		createdBy: "document_versions.created_by",
		createdAt: "document_versions.created_at",
	},
	templates: {},
	documentCollaborators: {
		documentId: "document_collaborators.document_id",
		userId: "document_collaborators.user_id",
		role: "document_collaborators.role",
		joinedAt: "document_collaborators.joined_at",
		lastActivityAt: "document_collaborators.last_activity_at",
	},
}));

import {
	getDocumentVersion,
	restoreDocumentVersion,
} from "@/lib/actions/documents-enhanced";

function createChain(result: unknown[], onWhere?: (value: unknown) => void) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "limit", "orderBy", "set"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		onWhere?.(value);
		return chain;
	});
	chain.returning = vi.fn(() => Promise.resolve(result));
	chain.then = (resolve: (value: unknown[]) => void, reject?: (reason: unknown) => void) =>
		Promise.resolve(result).then(resolve, reject);
	return chain;
}

const documentContent = { type: "doc", content: [] };
const versionRow = {
	id: "version-1",
	documentId: "doc-1",
	versionNumber: 2,
	content: documentContent,
	changeDescription: "Manual checkpoint",
	createdAt: new Date("2026-05-19T00:00:00.000Z"),
	createdBy: "user-1",
	yjsStateVector: null,
};
const documentRow = {
	id: "doc-1",
	title: "Scoped document",
	content: documentContent,
	plainText: null,
	status: "draft",
	visibility: "private",
	ownerId: "user-1",
	templateId: null,
	tags: [],
	wordCount: 0,
	characterCount: 0,
	createdAt: new Date("2026-05-19T00:00:00.000Z"),
	updatedAt: new Date("2026-05-19T00:00:00.000Z"),
	lastAccessedAt: null,
	currentVersion: 2,
	collaboratorIds: [],
	metadata: {},
};

function asText(value: unknown): string {
	return JSON.stringify(value);
}

describe("enhanced document version scoping", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getCurrentUserIdMock.mockResolvedValue("user-1");
	});

	it("reads a specific version through document access scope", async () => {
		let versionWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain([versionRow], (value) => {
			versionWhere = value;
		}));

		const result = await getDocumentVersion("version-1");

		expect(result?.id).toBe("version-1");
		expect(dbMock.select).toHaveBeenCalledTimes(1);
		expect(asText(versionWhere)).toContain("version-1");
		expect(asText(versionWhere)).toContain("document_versions.document_id");
		expect(asText(versionWhere)).toContain("user-1");
	});

	it("restores only when the version belongs to the writable document", async () => {
		let versionWhere: unknown;
		let updateWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain([versionRow], (value) => {
			versionWhere = value;
		}));
		dbMock.update.mockReturnValueOnce(createChain([documentRow], (value) => {
			updateWhere = value;
		}));

		const result = await restoreDocumentVersion("doc-1" as never, "version-1");

		expect(result.id).toBe("doc-1");
		expect(asText(versionWhere)).toContain("version-1");
		expect(asText(versionWhere)).toContain("doc-1");
		expect(asText(versionWhere)).toContain("user-1");
		expect(asText(updateWhere)).toContain("doc-1");
		expect(asText(updateWhere)).toContain("user-1");
	});

	it("does not update a writable document from an unrelated version id", async () => {
		let versionWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain([], (value) => {
			versionWhere = value;
		}));

		await expect(restoreDocumentVersion("doc-1" as never, "version-from-other-doc")).rejects.toThrow("Version not found");

		expect(dbMock.update).not.toHaveBeenCalled();
		expect(asText(versionWhere)).toContain("version-from-other-doc");
		expect(asText(versionWhere)).toContain("doc-1");
		expect(asText(versionWhere)).toContain("user-1");
	});
});
