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
vi.mock("@/lib/db/schema-bibliography", () => ({
	bibliographyEntries: {},
	documentCitations: {},
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
	importFromBibTeX,
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
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("bibliography action auth", () => {
	it("rejects unauthenticated bibliography mutations before database access", async () => {
		await expect(createBibliographyEntry(entryInput)).resolves.toMatchObject({ success: false });
		await expect(updateBibliographyEntry({ id: "entry-1", title: "Updated" })).resolves.toMatchObject({ success: false });
		await expect(deleteBibliographyEntry("entry-1")).resolves.toMatchObject({ success: false });
		await expect(citeInDocument("doc-1", "entry-1")).resolves.toMatchObject({ success: false });
		await expect(importFromBibTeX("@article{smith2026,title={Security Review},author={Smith, Jane},year={2026}}"))
			.resolves.toMatchObject({ success: false });

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
