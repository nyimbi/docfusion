import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	query: {
		documentComments: { findMany: vi.fn() },
		commentReads: { findMany: vi.fn() },
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/auth", () => ({
	isAdmin: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((left, right) => ({ type: "eq", left, right })),
	and: vi.fn((...conditions) => ({ type: "and", conditions })),
	or: vi.fn((...conditions) => ({ type: "or", conditions })),
	desc: vi.fn((column) => ({ type: "desc", column })),
	asc: vi.fn((column) => ({ type: "asc", column })),
	isNull: vi.fn((column) => ({ type: "isNull", column })),
	ne: vi.fn((left, right) => ({ type: "ne", left, right })),
	inArray: vi.fn((left, values) => ({ type: "inArray", left, values })),
	sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
		type: "sql",
		text: Array.from(strings).join("?"),
		values,
	})),
}));

vi.mock("@/lib/db", () => ({
	db: dbMock,
}));

vi.mock("@/lib/db/schema", () => ({
	documents: {
		id: "documents.id",
		ownerId: "documents.owner_id",
		visibility: "documents.visibility",
		collaboratorIds: "documents.collaborator_ids",
	},
}));

vi.mock("@/lib/db/schema-comments-workflow", () => ({
	documentComments: {
		id: "document_comments.id",
		documentId: "document_comments.document_id",
		sectionId: "document_comments.section_id",
		userId: "document_comments.user_id",
		content: "document_comments.content",
		type: "document_comments.type",
		parentId: "document_comments.parent_id",
		position: "document_comments.position",
		resolvedAt: "document_comments.resolved_at",
		resolvedBy: "document_comments.resolved_by",
		isEdited: "document_comments.is_edited",
		createdAt: "document_comments.created_at",
		updatedAt: "document_comments.updated_at",
	},
	commentReactions: {
		commentId: "comment_reactions.comment_id",
		userId: "comment_reactions.user_id",
		reaction: "comment_reactions.reaction",
	},
	commentReads: {
		commentId: "comment_reads.comment_id",
		userId: "comment_reads.user_id",
	},
}));

import {
	createComment,
	getComment,
} from "@/lib/actions/comments";

function createChain(result: unknown[], onWhere?: (value: unknown) => void) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "limit", "orderBy", "set", "values"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		onWhere?.(value);
		return chain;
	});
	chain.returning = vi.fn(() => Promise.resolve(result));
	chain.onConflictDoNothing = vi.fn(() => Promise.resolve(result));
	chain.then = (resolve: (value: unknown[]) => void, reject?: (reason: unknown) => void) =>
		Promise.resolve(result).then(resolve, reject);
	return chain;
}

const commentRow = {
	id: "comment-1",
	documentId: "doc-1",
	sectionId: "section-1",
	userId: "author-1",
	content: "Needs revision",
	type: "comment",
	parentId: null,
	position: null,
	resolvedAt: null,
	resolvedBy: null,
	isEdited: "false",
	createdAt: new Date("2026-05-19T00:00:00.000Z"),
	updatedAt: new Date("2026-05-19T00:00:00.000Z"),
};

function asText(value: unknown): string {
	return JSON.stringify(value);
}

describe("comment document scoping", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getCurrentUserIdMock.mockResolvedValue("user-1");
	});

	it("loads a comment and its replies through document access scope", async () => {
		let commentWhere: unknown;
		let repliesWhere: unknown;
		dbMock.select
			.mockReturnValueOnce(createChain([commentRow], (value) => {
				commentWhere = value;
			}))
			.mockReturnValueOnce(createChain([], (value) => {
				repliesWhere = value;
			}));

		const result = await getComment("comment-1");

		expect(result?.id).toBe("comment-1");
		expect(asText(commentWhere)).toContain("comment-1");
		expect(asText(commentWhere)).toContain("document_comments.document_id");
		expect(asText(commentWhere)).toContain("user-1");
		expect(asText(repliesWhere)).toContain("comment-1");
		expect(asText(repliesWhere)).toContain("doc-1");
	});

	it("requires reply parent lookups to stay on the writable document", async () => {
		let documentWhere: unknown;
		let parentWhere: unknown;
		dbMock.select
			.mockReturnValueOnce(createChain([{ id: "doc-1" }], (value) => {
				documentWhere = value;
			}))
			.mockReturnValueOnce(createChain([{ id: "parent-1", documentId: "doc-1" }], (value) => {
				parentWhere = value;
			}));
		dbMock.insert.mockReturnValueOnce(createChain([{
			...commentRow,
			id: "reply-1",
			parentId: "parent-1",
		}]));

		const result = await createComment({
			documentId: "doc-1",
			parentId: "parent-1",
			content: "Reply",
		}, "spoofed-user");

		expect(result.id).toBe("reply-1");
		expect(asText(documentWhere)).toContain("doc-1");
		expect(asText(documentWhere)).toContain("user-1");
		expect(asText(parentWhere)).toContain("parent-1");
		expect(asText(parentWhere)).toContain("doc-1");
	});
});
