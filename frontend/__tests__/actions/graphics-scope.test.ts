import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "innerJoin", "limit", "orderBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
	chain.set = vi.fn(() => chain);
	chain.values = vi.fn(() => chain);
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
	return Object.values(value as Record<string, unknown>).flatMap((item) => collectSqlFragments(item, seen));
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

vi.mock("next/cache", () => ({
	revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: {
		error: vi.fn(),
	},
}));

import {
	createGraphic,
	listGraphics,
	recordGraphicFeedback,
	searchGraphics,
	updateGraphic,
	validateGraphicConsistency,
} from "@/lib/actions/graphics";

const opportunityId = "33333333-3333-4333-8333-333333333333";
const graphicId = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "graphics-user-1",
		organizationId: "11111111-1111-4111-8111-111111111111",
	});
});

describe("graphics opportunity scoping", () => {
	it("checks opportunity assignment before creating opportunity-linked graphics", async () => {
		let opportunityWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				opportunityWhere = value;
			},
		}));

		const result = await createGraphic({
			opportunityId,
			title: "Transition plan",
			graphicType: "diagram",
			format: "mermaid",
		});

		expect(result).toMatchObject({ success: false });
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(collectSqlFragments(opportunityWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes opportunity graphic lists through assignment", async () => {
		let listWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				listWhere = value;
			},
		}));

		const result = await listGraphics(opportunityId);

		expect(result).toMatchObject({ success: true, data: [] });
		expect(collectSqlFragments(listWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes single-graphic updates through the owning opportunity", async () => {
		let updateWhere: unknown;
		dbMock.update.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				updateWhere = value;
			},
		}));

		const result = await updateGraphic(graphicId, { title: "Updated graphic" });

		expect(result).toMatchObject({ success: false, error: "Graphic not found" });
		expect(collectSqlFragments(updateWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes consistency validation to assigned opportunities", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({ result: [] }))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({ result: [] }));

		const result = await validateGraphicConsistency(opportunityId);

		expect(result).toMatchObject({
			success: true,
			data: { totalGraphics: 0 },
		});
		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			expect(collectSqlFragments(where).join(" ")).toContain("opportunities.assigned_to");
		}
	});

	it("scopes search results to visible graphics", async () => {
		let searchWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				searchWhere = value;
			},
		}));

		const result = await searchGraphics("transition");

		expect(result).toMatchObject({ success: true, data: [] });
		expect(collectSqlFragments(searchWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("checks source graphic visibility before recording feedback", async () => {
		let graphicWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				graphicWhere = value;
			},
		}));

		const result = await recordGraphicFeedback(graphicId, "approval", "Looks good");

		expect(result).toMatchObject({ success: false });
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(collectSqlFragments(graphicWhere).join(" ")).toContain("opportunities.assigned_to");
	});
});
