import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({
	getServerSession: getServerSessionMock,
}));
vi.mock("@/lib/db", () => ({
	db: dbMock,
}));

function createChain(result: unknown[] = []) {
	const chain = {
		from: vi.fn(() => chain),
		where: vi.fn(() => chain),
		limit: vi.fn(() => Promise.resolve(result)),
		set: vi.fn(() => chain),
		values: vi.fn(() => Promise.resolve(result)),
		then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
			Promise.resolve(result).then(resolve, reject),
	};
	return chain;
}

import {
	acquireDocumentLock,
	checkDocumentLock,
	deleteYjsState,
	getActiveCollaborationSessions,
	getActiveCollaborators,
	getAllActiveUsers,
	getDocumentCollaborationStats,
	getYjsState,
	releaseDocumentLock,
	removePresence,
	saveYjsState,
	updatePresence,
} from "@/lib/actions/collaboration";

beforeEach(() => {
	vi.clearAllMocks();
	getServerSessionMock.mockResolvedValue(null);
	dbMock.select.mockImplementation(() => {
		dbAccessMock();
		return createChain([]);
	});
	dbMock.insert.mockImplementation(() => {
		dbAccessMock();
		return createChain([]);
	});
	dbMock.update.mockImplementation(() => {
		dbAccessMock();
		return createChain([]);
	});
	dbMock.delete.mockImplementation(() => {
		dbAccessMock();
		return createChain([]);
	});
});

describe("collaboration action auth", () => {
	it("rejects unauthenticated collaboration actions before database access", async () => {
		await expect(getYjsState("doc-1")).rejects.toThrow("Unauthorized");
		await expect(saveYjsState("doc-1", "state", "vector")).rejects.toThrow("Unauthorized");
		await expect(deleteYjsState("doc-1")).rejects.toThrow("Unauthorized");
		await expect(updatePresence({
			documentId: "doc-1",
			userId: "spoofed-user",
			userName: "Spoofed User",
		})).rejects.toThrow("Unauthorized");
		await expect(removePresence("doc-1", "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(getActiveCollaborators("doc-1")).rejects.toThrow("Unauthorized");
		await expect(getActiveCollaborationSessions()).rejects.toThrow("Unauthorized");
		await expect(getDocumentCollaborationStats("doc-1")).rejects.toThrow("Unauthorized");
		await expect(getAllActiveUsers()).rejects.toThrow("Unauthorized");
		await expect(acquireDocumentLock("doc-1", "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(releaseDocumentLock("doc-1", "spoofed-user")).rejects.toThrow("Unauthorized");
		await expect(checkDocumentLock("doc-1")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});

	it("uses the session actor for presence and locks", async () => {
		getServerSessionMock.mockResolvedValue({
			user: {
				id: "session-user",
				name: "Session User",
				email: "session@example.com",
			},
		});
		dbMock.select.mockImplementation(() => createChain([{ id: "doc-1" }]));

		const presence = await updatePresence({
			documentId: "doc-1",
			userId: "spoofed-user",
			userName: "Spoofed User",
		});

		expect(presence.userId).toBe("session-user");
		expect(presence.userName).toBe("Session User");

		const collaborators = await getActiveCollaborators("doc-1");
		expect(collaborators.collaborators).toEqual([
			expect.objectContaining({
				documentId: "doc-1",
				userId: "session-user",
				userName: "Session User",
			}),
		]);

		await expect(acquireDocumentLock("doc-1", "spoofed-user")).resolves.toEqual({ success: true });
		await expect(checkDocumentLock("doc-1")).resolves.toEqual(expect.objectContaining({
			isLocked: true,
			lockedBy: "session-user",
		}));
		await expect(releaseDocumentLock("doc-1", "spoofed-user")).resolves.toBe(true);
	});
});
