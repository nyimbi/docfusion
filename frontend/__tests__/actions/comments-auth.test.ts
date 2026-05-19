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
vi.mock("@/lib/auth", () => ({
	isAdmin: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema", () => ({
	documents: {},
}));
vi.mock("@/lib/db/schema-comments-workflow", () => ({
	documentComments: {},
	commentReactions: {},
	commentReads: {},
}));

import {
	addCommentReaction,
	createComment,
	deleteComment,
	getComment,
	getCommentReactions,
	getComments,
	getCommentStats,
	markCommentsRead,
	removeCommentReaction,
	resolveComment,
	resolveSectionComments,
	updateComment,
} from "@/lib/actions/comments";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("comment action auth", () => {
	it("rejects unauthenticated comment reads and mutations before database access", async () => {
		await expect(getComment("comment-1")).rejects.toThrow("Unauthorized");
		await expect(getComments({ documentId: "doc-1" })).rejects.toThrow("Unauthorized");
		await expect(getCommentStats("doc-1")).rejects.toThrow("Unauthorized");
		await expect(getCommentReactions("comment-1")).rejects.toThrow("Unauthorized");
		await expect(createComment({
			documentId: "doc-1",
			content: "Spoofed comment",
		}, "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(updateComment("comment-1", { content: "Updated" }, "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(deleteComment("comment-1", "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(resolveComment("comment-1", { resolved: true }, "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(addCommentReaction("comment-1", "check" as never, "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(removeCommentReaction("comment-1", "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(resolveSectionComments("section-1", "spoofed-user", "doc-1")).rejects.toThrow("Unauthorized");
		await expect(markCommentsRead("doc-1", "spoofed-user")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
