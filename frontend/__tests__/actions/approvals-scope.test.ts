import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "limit", "orderBy", "offset"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
	chain.values = vi.fn(() => chain);
	chain.set = vi.fn(() => chain);
	chain.returning = vi.fn(async () => config.result ?? []);
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

function collectSqlFragments(value: unknown, seen = new Set<object>()): string[] {
	if (typeof value === "string") {
		return [value];
	}
	if (!value || typeof value !== "object") {
		return [];
	}
	if (seen.has(value)) {
		return [];
	}
	seen.add(value);
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectSqlFragments(item, seen));
	}
	return Reflect.ownKeys(value).flatMap((key) =>
		collectSqlFragments((value as Record<PropertyKey, unknown>)[key], seen)
	);
}

function expectVisibleApprovalScope(where: unknown) {
	const sqlText = collectSqlFragments(where).join(" ");
	expect(sqlText).toContain("assigned_to");
	expect(sqlText).toContain("documents.owner_id");
	expect(sqlText).toContain("approval-user-1");
}

function expectOwnerScope(where: unknown) {
	const sqlText = collectSqlFragments(where).join(" ");
	expect(sqlText).toContain("documents.owner_id");
	expect(sqlText).toContain("approval-user-1");
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
	insert: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
	query: {
		user: { findFirst: ReturnType<typeof vi.fn> };
		documents: { findFirst: ReturnType<typeof vi.fn> };
	};
};

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		query: {
			user: { findFirst: vi.fn() },
			documents: { findFirst: vi.fn() },
		},
	},
}));

vi.mock("@/lib/security/public-url", () => ({
	fetchPublicHttpUrl: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: {
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

import {
	createApproval,
	deleteApproval,
	getApprovals,
	submitReview,
	updateApproval,
	updateApprovalDueDate,
} from "@/lib/actions/approvals";

const documentId = "11111111-1111-4111-8111-111111111111";
const approvalId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue("approval-user-1");
});

describe("approval document scoping", () => {
	it("checks document ownership before creating approval rows", async () => {
		let documentWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				documentWhere = value;
			},
		}));

		await expect(createApproval({
			documentId,
			stage: "reviewer",
			assignedTo: "reviewer-1",
		})).rejects.toThrow("Document not found");

		expect(dbMock.insert).not.toHaveBeenCalled();
		expectOwnerScope(documentWhere);
	});

	it("scopes approval lists to assigned rows or documents owned by the actor", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{ count: 0 }],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}));

		await expect(getApprovals()).resolves.toEqual({ approvals: [], total: 0 });

		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			expectVisibleApprovalScope(where);
		}
	});

	it("scopes review submission reads to visible approval rows", async () => {
		let approvalWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				approvalWhere = value;
			},
		}));

		await expect(submitReview({
			approvalId,
			status: "approved",
		}, "spoofed-user")).rejects.toThrow("Approval record not found");

		expectVisibleApprovalScope(approvalWhere);
	});

	it("scopes approval owner mutations through the owning document", async () => {
		const wheres: unknown[] = [];
		dbMock.update
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}));
		dbMock.delete.mockReturnValueOnce(createChain({
			onWhere: (value) => wheres.push(value),
		}));

		await expect(updateApproval(approvalId, { status: "in_review" })).rejects.toThrow("Approval not found");
		await expect(updateApprovalDueDate(approvalId, new Date("2026-01-01T00:00:00.000Z"))).rejects.toThrow("Approval not found");
		await deleteApproval(approvalId);

		expect(wheres).toHaveLength(3);
		for (const where of wheres) {
			expectOwnerScope(where);
		}
	});
});
