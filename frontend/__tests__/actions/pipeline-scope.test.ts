import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "limit", "orderBy", "innerJoin", "groupBy"]) {
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
};

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
	},
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/ai/providers", () => ({
	getProviderManager: vi.fn(() => ({
		isAvailable: vi.fn(async () => false),
		complete: vi.fn(async () => ({ content: "{}" })),
	})),
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(),
	upsertWorkflowRuntimeTask: vi.fn(),
}));

import { updateActivity, updateGateReview, updateMilestone, updatePipelineStage } from "@/lib/actions/pipeline";

const pipeline = {
	id: "44444444-4444-4444-8444-444444444444",
	opportunityId: "33333333-3333-4333-8333-333333333333",
	currentStage: "discovery",
	stageHistory: [{ stage: "discovery", enteredAt: "2026-05-19T12:00:00.000Z" }],
	notes: null,
};

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "pipeline-user-1",
		organizationId: "org-1",
	});
});

describe("pipeline row scoping", () => {
	it("scopes pipeline stage reads and updates through the assigned opportunity", async () => {
		let loadWhere: unknown;
		let updateWhere: unknown;

		dbMock.select.mockReturnValueOnce(createChain({
			result: [pipeline],
			onWhere: (value) => {
				loadWhere = value;
			},
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ ...pipeline, currentStage: "qualification" }],
			onWhere: (value) => {
				updateWhere = value;
			},
		}));

		const result = await updatePipelineStage(pipeline.id, "qualification");

		expect(result).toMatchObject({
			success: true,
			data: { id: pipeline.id, currentStage: "qualification" },
		});
		expect(collectSqlFragments(loadWhere).join(" ")).toContain("opportunities.assigned_to");
		expect(collectSqlFragments(updateWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes activity updates through the owning pipeline opportunity", async () => {
		let updateWhere: unknown;
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{
				id: "55555555-5555-4555-8555-555555555555",
				pipelineId: pipeline.id,
				title: "Updated activity",
			}],
			onWhere: (value) => {
				updateWhere = value;
			},
		}));

		const result = await updateActivity(
			"55555555-5555-4555-8555-555555555555",
			{ title: "Updated activity" }
		);

		expect(result).toMatchObject({
			success: true,
			data: { id: "55555555-5555-4555-8555-555555555555" },
		});
		expect(collectSqlFragments(updateWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes gate review updates through the owning pipeline opportunity", async () => {
		let updateWhere: unknown;
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{
				id: "66666666-6666-4666-8666-666666666666",
				pipelineId: pipeline.id,
				status: "in_progress",
			}],
			onWhere: (value) => {
				updateWhere = value;
			},
		}));

		const result = await updateGateReview(
			"66666666-6666-4666-8666-666666666666",
			{ status: "in_progress" }
		);

		expect(result).toMatchObject({
			success: true,
			data: { id: "66666666-6666-4666-8666-666666666666" },
		});
		expect(collectSqlFragments(updateWhere).join(" ")).toContain("opportunities.assigned_to");
	});

	it("scopes milestone updates through the owning pipeline opportunity", async () => {
		let updateWhere: unknown;
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{
				id: "77777777-7777-4777-8777-777777777777",
				pipelineId: pipeline.id,
				name: "Red team",
			}],
			onWhere: (value) => {
				updateWhere = value;
			},
		}));

		const result = await updateMilestone(
			"77777777-7777-4777-8777-777777777777",
			{ name: "Red team" }
		);

		expect(result).toMatchObject({
			success: true,
			data: { id: "77777777-7777-4777-8777-777777777777" },
		});
		expect(collectSqlFragments(updateWhere).join(" ")).toContain("opportunities.assigned_to");
	});
});
