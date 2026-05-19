import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const completeMock = vi.hoisted(() => vi.fn(async () => ({ content: "[]" })));
const revalidatePathMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "limit", "orderBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
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
	return Object.values(value as Record<string, unknown>).flatMap((item) =>
		collectSqlFragments(item, seen)
	);
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

vi.mock("@/lib/ai/client", () => ({
	complete: completeMock,
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("next/cache", () => ({
	revalidatePath: revalidatePathMock,
}));

import {
	anticipateQuestions,
	createPresentation,
} from "@/lib/actions/presentations";

const opportunityId = "33333333-3333-4333-8333-333333333333";
const presentationId = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "presentations-user-1",
		organizationId: "11111111-1111-4111-8111-111111111111",
	});
	completeMock.mockResolvedValue({ content: "[]" });
});

describe("presentation opportunity scoping", () => {
	it("checks assigned opportunity visibility before creating presentations", async () => {
		let opportunityWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				opportunityWhere = value;
			},
		}));

		const result = await createPresentation(opportunityId, {
			title: "Oral presentation",
		});

		expect(result).toEqual({ success: false, error: "Opportunity not found" });
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(collectSqlFragments(opportunityWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes Q&A requirement context to assigned opportunities", async () => {
		let requirementsWhere: unknown;
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{
					id: presentationId,
					opportunityId,
					title: "Oral presentation",
					audienceDescription: "Evaluation panel",
					evaluationCriteria: [],
				}],
			}))
			.mockReturnValueOnce(createChain({ result: [] }))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => {
					requirementsWhere = value;
				},
			}));

		const result = await anticipateQuestions(presentationId);

		expect(result).toEqual({ success: true, data: [] });
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(revalidatePathMock).toHaveBeenCalledWith(`/presentations/${presentationId}`);
		expect(collectSqlFragments(requirementsWhere).join(" ")).toContain("opportunities.assigned_to");
	});
});
