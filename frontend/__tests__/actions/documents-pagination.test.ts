import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "where", "orderBy", "limit", "offset"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
	},
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
	documentVersions: {},
	documentYjsStates: {},
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

import {
	listDocuments,
	searchDocuments,
} from "@/app/actions/documents";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue("document-user-1");
});

describe("document action pagination", () => {
	it("normalizes document list pagination before querying", async () => {
		const rowsChain = createChain({ result: [] });
		const countChain = createChain({ result: [{ count: 0 }] });
		dbMock.select
			.mockReturnValueOnce(rowsChain)
			.mockReturnValueOnce(countChain);

		await expect(listDocuments({
			limit: -25,
			offset: -10,
		})).resolves.toEqual({
			documents: [],
			total: 0,
			offset: 0,
			limit: 1,
			hasMore: false,
		});

		expect(rowsChain.limit).toHaveBeenCalledWith(1);
		expect(rowsChain.offset).toHaveBeenCalledWith(0);
	});

	it("normalizes document search limits before querying", async () => {
		const rowsChain = createChain({ result: [] });
		dbMock.select.mockReturnValueOnce(rowsChain);

		await expect(searchDocuments("draft", 2500)).resolves.toEqual([]);

		expect(rowsChain.limit).toHaveBeenCalledWith(1000);
	});
});
