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
	templates: {
		id: "templates.id",
		content: "templates.content",
		updatedAt: "templates.updatedAt",
	},
	templateEdits: {
		id: "template_edits.id",
		templateId: "template_edits.templateId",
		createdAt: "template_edits.createdAt",
	},
	templateVersions: {
		id: "template_versions.id",
		templateId: "template_versions.templateId",
		versionNumber: "template_versions.versionNumber",
	},
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

import {
	getTemplateEditHistory,
	getTemplateVersions,
} from "@/lib/actions/template-editor";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue("template-user-1");
});

describe("template editor pagination", () => {
	it("normalizes edit history pagination before querying", async () => {
		const rowsChain = createChain({ result: [] });
		const countChain = createChain({ result: [{ count: 0 }] });
		dbMock.select
			.mockReturnValueOnce(rowsChain)
			.mockReturnValueOnce(countChain);

		await expect(getTemplateEditHistory("template-1", {
			limit: -20,
			offset: -5,
		})).resolves.toEqual({ edits: [], total: 0 });

		expect(rowsChain.limit).toHaveBeenCalledWith(1);
		expect(rowsChain.offset).toHaveBeenCalledWith(0);
	});

	it("normalizes version history pagination before querying", async () => {
		const rowsChain = createChain({ result: [] });
		const countChain = createChain({ result: [{ count: 0 }] });
		dbMock.select
			.mockReturnValueOnce(rowsChain)
			.mockReturnValueOnce(countChain);

		await expect(getTemplateVersions("template-1", {
			limit: 2500,
			offset: Number.POSITIVE_INFINITY,
		})).resolves.toEqual({ versions: [], total: 0 });

		expect(rowsChain.limit).toHaveBeenCalledWith(1000);
		expect(rowsChain.offset).toHaveBeenCalledWith(0);
	});
});
