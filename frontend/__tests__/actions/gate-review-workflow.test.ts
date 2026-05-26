import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const recordWorkflowRuntimeTransitionMock = vi.hoisted(() => vi.fn());
const upsertWorkflowRuntimeTaskMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: recordWorkflowRuntimeTransitionMock,
	upsertWorkflowRuntimeTask: upsertWorkflowRuntimeTaskMock,
}));

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
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
	chain.set = vi.fn((value: Record<string, unknown>) => {
		config.onSet?.(value);
		return chain;
	});
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

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		select: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import { conductGateReview } from "@/lib/actions/pipeline";

const baseGate = {
	id: "gate-1",
	pipelineId: "pipeline-1",
	gateType: "bid_no_bid",
	gateName: "Bid No-Bid Review",
	status: "in_progress",
	checklistItems: [
		{ item: "PWin assessed", required: true, completed: true },
		{ item: "Risk review complete", required: true, completed: true },
	],
	reviewers: [
		{ name: "Capture Lead", role: "chair" },
		{ name: "Finance Lead", role: "reviewer" },
	],
	decision: null,
	rationale: null,
};

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "capture-lead-1",
		organizationId: "org-1",
	});
	recordWorkflowRuntimeTransitionMock.mockResolvedValue({ id: "workflow-1" });
	upsertWorkflowRuntimeTaskMock.mockResolvedValue({ id: "task-1" });
});

describe("gate review workflow enforcement", () => {
	it("rejects unauthenticated gate decisions before database access", async () => {
		requireUserContextMock.mockRejectedValueOnce(new Error("Unauthorized"));

		await expect(conductGateReview("gate-1", {
			decision: "pass",
			rationale: "Ready to pursue",
			reviewerVotes: [
				{ name: "Capture Lead", vote: "approve" },
				{ name: "Finance Lead", vote: "approve" },
			],
		})).rejects.toThrow("Unauthorized");
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("blocks pass decisions until required checklist items are complete", async () => {
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				...baseGate,
				checklistItems: [
					{ item: "PWin assessed", required: true, completed: false },
				],
			}],
		}));

		const result = await conductGateReview("gate-1", {
			decision: "pass",
			rationale: "Ready to pursue",
			reviewerVotes: [
				{ name: "Capture Lead", vote: "approve" },
				{ name: "Finance Lead", vote: "approve" },
			],
		});

		expect(result).toMatchObject({
			success: false,
			error: expect.stringContaining("Required checklist items"),
		});
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("requires conditions for a conditional pass", async () => {
		dbMock.select.mockReturnValueOnce(createChain({ result: [baseGate] }));

		const result = await conductGateReview("gate-1", {
			decision: "conditional_pass",
			rationale: "Can proceed after finance review",
			reviewerVotes: [
				{ name: "Capture Lead", vote: "conditional" },
				{ name: "Finance Lead", vote: "conditional" },
			],
		});

		expect(result).toMatchObject({
			success: false,
			error: "Conditional pass requires at least one condition",
		});
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("requires reviewer quorum before completing a gate", async () => {
		dbMock.select.mockReturnValueOnce(createChain({ result: [baseGate] }));

		const result = await conductGateReview("gate-1", {
			decision: "pass",
			rationale: "Ready to pursue",
			reviewerVotes: [
				{ name: "Capture Lead", vote: "approve" },
			],
		});

		expect(result).toMatchObject({
			success: false,
			error: "Gate decision requires at least 2 reviewer votes",
		});
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("records a no-bid decision and updates the pipeline terminal path", async () => {
		let gateUpdate: Record<string, unknown> | undefined;
		let gateWhere: unknown;
		let pipelineUpdate: Record<string, unknown> | undefined;
		let pipelineWhere: unknown;
		const completedGate = { ...baseGate, status: "completed", decision: "fail" };

		dbMock.select.mockReturnValueOnce(createChain({
			result: [baseGate],
			onWhere: (value) => {
				gateWhere = value;
			},
		}));
		dbMock.update
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					gateUpdate = value;
				},
				onWhere: (value) => {
					gateWhere = value;
				},
				result: [completedGate],
			}))
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					pipelineUpdate = value;
				},
				onWhere: (value) => {
					pipelineWhere = value;
				},
			}));

		const result = await conductGateReview("gate-1", {
			decision: "fail",
			rationale: "Insufficient win probability",
			reviewerVotes: [
				{ name: "Capture Lead", vote: "reject" },
				{ name: "Finance Lead", vote: "reject" },
			],
		});

		expect(result).toMatchObject({
			success: true,
			data: completedGate,
		});
		expect(gateUpdate).toMatchObject({
			status: "completed",
			decision: "fail",
			rationale: "Insufficient win probability",
		});
		expect(pipelineUpdate).toMatchObject({
			currentStage: "no_bid",
			bidDecision: "no_bid",
			bidDecisionRationale: "Insufficient win probability",
		});
		const gateWhereSql = collectSqlFragments(gateWhere).join(" ");
		expect(gateWhereSql).toContain("capture_pipeline.organization_id");
		expect(gateWhereSql).toContain("org-1");
		expect(gateWhereSql).toContain("opportunities.assigned_to");
		const pipelineWhereSql = collectSqlFragments(pipelineWhere).join(" ");
		expect(pipelineWhereSql).toContain("organization_id");
		expect(pipelineWhereSql).toContain("org-1");
		expect(pipelineWhereSql).toContain("opportunities.assigned_to");
		expect(recordWorkflowRuntimeTransitionMock).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "capture_gate_review",
			organizationId: "org-1",
			subjectId: "gate-1",
			actorId: "capture-lead-1",
			actorName: "capture-lead-1",
			eventType: "gate_fail",
		}));
	});
});
