import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	query: {
		bibliographyEntries: {
			findFirst: vi.fn(),
			findMany: vi.fn(),
		},
		documentCitations: {
			findMany: vi.fn(),
		},
	},
}));

function createChain(result: unknown = []) {
	const chain: Record<string, unknown> = {};
	for (const method of ["from", "where", "limit", "values", "returning"]) {
		chain[method] = vi.fn(() => chain);
	}
	(chain.returning as ReturnType<typeof vi.fn>).mockResolvedValue(Array.isArray(result) ? result : [result]);
	chain.then = (resolve: (value: unknown) => void) =>
		Promise.resolve(Array.isArray(result) ? result : [result]).then(resolve);
	return chain;
}

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));
vi.mock("@/lib/db", () => ({
	db: dbMock,
}));
vi.mock("@/lib/db/schema-bibliography", () => ({
	bibliographyEntries: {
		id: "bibliographyEntries.id",
		organizationId: "bibliographyEntries.organizationId",
		createdBy: "bibliographyEntries.createdBy",
		isPublic: "bibliographyEntries.isPublic",
	},
	documentCitations: {},
}));
vi.mock("@/lib/db/schema", () => ({
	documents: {
		id: "documents.id",
		ownerId: "documents.ownerId",
		visibility: "documents.visibility",
		collaboratorIds: "documents.collaboratorIds",
	},
}));
vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn() },
}));
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

import {
	citeInDocument,
	createBibliographyEntry,
	deleteBibliographyEntry,
	exportToBibTeX,
	getBibliographyEntry,
	getBibliographyStats,
	getDocumentCitations,
	importFromBibTeX,
	listBibliographyEntries,
	updateBibliographyEntry,
} from "@/lib/actions/bibliography";

const entryInput = {
	citeKey: "smith2026",
	entryType: "article",
	title: "Security Review",
	authors: ["Smith, Jane"],
	year: 2026,
} as Parameters<typeof createBibliographyEntry>[0];

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockRejectedValue(new Error("Unauthorized"));
	dbMock.select.mockImplementation(() => createChain([]));
	dbMock.insert.mockImplementation(() => createChain([]));
});

describe("bibliography action auth", () => {
	it("rejects unauthenticated bibliography actions before database access", async () => {
		await expect(listBibliographyEntries()).resolves.toMatchObject({ success: false });
		await expect(getBibliographyEntry("entry-1")).resolves.toMatchObject({ success: false });
		await expect(createBibliographyEntry(entryInput)).resolves.toMatchObject({ success: false });
		await expect(updateBibliographyEntry({ id: "entry-1", title: "Updated" })).resolves.toMatchObject({ success: false });
		await expect(deleteBibliographyEntry("entry-1")).resolves.toMatchObject({ success: false });
		await expect(citeInDocument("doc-1", "entry-1")).resolves.toMatchObject({ success: false });
		await expect(getDocumentCitations("doc-1")).resolves.toMatchObject({ success: false });
		await expect(importFromBibTeX("@article{smith2026,title={Security Review},author={Smith, Jane},year={2026}}"))
			.resolves.toMatchObject({ success: false });
		await expect(exportToBibTeX()).resolves.toMatchObject({ success: false });
		await expect(getBibliographyStats()).resolves.toMatchObject({ success: false });

		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
		expect(dbMock.delete).not.toHaveBeenCalled();
		expect(dbMock.query.bibliographyEntries.findFirst).not.toHaveBeenCalled();
		expect(dbMock.query.bibliographyEntries.findMany).not.toHaveBeenCalled();
		expect(dbMock.query.documentCitations.findMany).not.toHaveBeenCalled();
	});

	it("binds created entries to the session organization and actor", async () => {
		const organizationId = "11111111-1111-4111-8111-111111111111";
		const insertChain = createChain([{
			id: "entry-1",
			citeKey: entryInput.citeKey,
			entryType: entryInput.entryType,
			title: entryInput.title,
			authors: entryInput.authors,
			year: entryInput.year,
			citationCount: 0,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		}]);

		requireUserContextMock.mockResolvedValue({
			userId: "bibliography-user-1",
			organizationId,
		});
		dbMock.insert.mockReturnValueOnce(insertChain);

		const result = await createBibliographyEntry(entryInput);

		expect(result.success).toBe(true);
		expect(insertChain.values).toHaveBeenCalledWith(
			expect.objectContaining({
				organizationId,
				createdBy: "bibliography-user-1",
			})
		);
	});

	it("checks document write access before creating citations", async () => {
		requireUserContextMock.mockResolvedValue({
			userId: "bibliography-user-1",
			organizationId: "11111111-1111-4111-8111-111111111111",
		});
		dbMock.select.mockReturnValueOnce(createChain([]));

		const result = await citeInDocument("doc-1", "entry-1");

		expect(result.success).toBe(false);
		expect(dbMock.query.bibliographyEntries.findFirst).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});
});
