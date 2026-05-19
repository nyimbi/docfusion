import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMock = vi.hoisted(() => vi.fn());
const eqMock = vi.hoisted(() => vi.fn((column: unknown, value: unknown) => ({ op: "eq", column, value })));
const andMock = vi.hoisted(() => vi.fn((...conditions: unknown[]) => ({ op: "and", conditions })));
const orMock = vi.hoisted(() => vi.fn((...conditions: unknown[]) => ({ op: "or", conditions })));
const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
}));

function createSelectChain(result: unknown[] = []) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "limit", "orderBy", "offset", "groupBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (resolve: (value: unknown[]) => void) => Promise.resolve(result).then(resolve);
	return chain;
}

function createInsertChain(result: unknown[], onValues?: (value: Record<string, unknown>) => void) {
	const chain: Record<string, any> = {};
	chain.values = vi.fn((value: Record<string, unknown>) => {
		onValues?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => result);
	return chain;
}

vi.mock("@/lib/auth-utils", () => ({
	getServerSession: sessionMock,
}));
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));
vi.mock("drizzle-orm", async (importOriginal) => {
	const actual = await importOriginal<typeof import("drizzle-orm")>();
	return {
		...actual,
		eq: eqMock,
		and: andMock,
		or: orMock,
		desc: vi.fn((column: unknown) => ({ op: "desc", column })),
		asc: vi.fn((column: unknown) => ({ op: "asc", column })),
		ilike: vi.fn((column: unknown, value: unknown) => ({ op: "ilike", column, value })),
		inArray: vi.fn((column: unknown, values: unknown[]) => ({ op: "inArray", column, values })),
		sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ op: "sql", strings, values })),
	};
});
vi.mock("@/lib/db", () => ({
	db: dbMock,
	templateSnippets: {
		id: "template_snippets.id",
		name: "template_snippets.name",
		shortcut: "template_snippets.shortcut",
		content: "template_snippets.content",
		placeholders: "template_snippets.placeholders",
		description: "template_snippets.description",
		tags: "template_snippets.tags",
		category: "template_snippets.category",
		createdBy: "template_snippets.created_by",
		organizationId: "template_snippets.organization_id",
		useCount: "template_snippets.use_count",
		isPublic: "template_snippets.is_public",
		createdAt: "template_snippets.created_at",
		updatedAt: "template_snippets.updated_at",
	},
}));

import {
	createSnippet,
	getSnippet,
} from "@/lib/actions/snippets";

beforeEach(() => {
	vi.clearAllMocks();
	sessionMock.mockResolvedValue({
		user: { id: "snippet-user-1", organizationId: "org-1" },
	});
	dbMock.select.mockReturnValue(createSelectChain([]));
});

describe("snippet tenant scoping", () => {
	it("requires organization context before creating snippets", async () => {
		sessionMock.mockResolvedValueOnce({
			user: { id: "snippet-user-1", organizationId: undefined },
		});

		await expect(createSnippet({
			name: "Intro",
			shortcut: "/intro",
			content: { type: "doc", content: [] },
		})).rejects.toThrow("No organization context");

		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("creates snippets under the session organization", async () => {
		const inserted: Record<string, unknown>[] = [];
		dbMock.select.mockReturnValueOnce(createSelectChain([]));
		dbMock.insert.mockReturnValueOnce(createInsertChain([snippetRow()], (value) => inserted.push(value)));

		const snippet = await createSnippet({
			name: "Intro",
			shortcut: "intro",
			content: { type: "doc", content: [] },
		});

		expect(snippet.id).toBe("snippet-1");
		expect(inserted[0]).toMatchObject({
			createdBy: "snippet-user-1",
			organizationId: "org-1",
			shortcut: "/intro",
		});
	});

	it("builds tenant-visible predicates when loading a snippet by id", async () => {
		dbMock.select.mockReturnValueOnce(createSelectChain([]));

		await getSnippet("snippet-1");

		expect(eqMock).toHaveBeenCalledWith("template_snippets.id", "snippet-1");
		expect(eqMock).toHaveBeenCalledWith("template_snippets.created_by", "snippet-user-1");
		expect(eqMock).toHaveBeenCalledWith("template_snippets.organization_id", "org-1");
		expect(eqMock).toHaveBeenCalledWith("template_snippets.is_public", true);
	});
});

function snippetRow() {
	return {
		id: "snippet-1",
		name: "Intro",
		shortcut: "/intro",
		content: { type: "doc", content: [] },
		placeholders: [],
		description: null,
		tags: [],
		category: null,
		createdBy: "snippet-user-1",
		organizationId: "org-1",
		useCount: 0,
		isPublic: false,
		createdAt: new Date("2026-05-01T00:00:00.000Z"),
		updatedAt: new Date("2026-05-01T00:00:00.000Z"),
	};
}
