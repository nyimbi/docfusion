import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());

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

function expectDocumentScope(where: unknown) {
	const sqlText = collectSqlFragments(where).join(" ");
	expect(sqlText).toContain("documents.owner_id");
	expect(sqlText).toContain("format-user-1");
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
	insert: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
	applyFormatTemplate,
	exportFormattedDocument,
	getDocumentFormat,
	removeDocumentFormat,
} from "@/lib/actions/formatting";

const documentId = "11111111-1111-4111-8111-111111111111";
const templateId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "format-user-1",
		organizationId: "33333333-3333-4333-8333-333333333333",
	});
});

describe("formatting document scoping", () => {
	it("checks writable document scope before applying templates", async () => {
		let documentWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				documentWhere = value;
			},
		}));

		await expect(applyFormatTemplate(documentId, templateId)).rejects.toThrow(
			"Failed to apply format template"
		);

		expect(dbMock.insert).not.toHaveBeenCalled();
		expectDocumentScope(documentWhere);
	});

	it("scopes document format reads through readable documents", async () => {
		let formatWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				formatWhere = value;
			},
		}));

		await expect(getDocumentFormat(documentId)).resolves.toBeNull();

		const sqlText = collectSqlFragments(formatWhere).join(" ");
		expect(sqlText).toContain("documents.owner_id");
		expect(sqlText).toContain("documents.visibility");
		expect(sqlText).toContain("format-user-1");
	});

	it("scopes document format removals through writable documents", async () => {
		const wheres: unknown[] = [];
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => wheres.push(value),
		}));
		dbMock.delete.mockReturnValueOnce(createChain({
			onWhere: (value) => wheres.push(value),
		}));

		await removeDocumentFormat(documentId);

		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			expectDocumentScope(where);
		}
	});

	it("scopes formatted exports through readable documents", async () => {
		let documentWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				documentWhere = value;
			},
		}));

		await expect(exportFormattedDocument(documentId, "pdf")).rejects.toThrow(
			"Failed to export formatted document"
		);

		const sqlText = collectSqlFragments(documentWhere).join(" ");
		expect(sqlText).toContain("documents.owner_id");
		expect(sqlText).toContain("documents.visibility");
		expect(sqlText).toContain("format-user-1");
	});
});
