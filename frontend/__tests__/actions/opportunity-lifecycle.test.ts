import { beforeEach, describe, expect, it, vi } from "vitest";

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "limit"]) {
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

const recordTransitionMock = vi.hoisted(() => vi.fn());
const upsertTaskMock = vi.hoisted(() => vi.fn());
const requireServerSessionMock = vi.hoisted(() => vi.fn());

var dbMock: {
	select: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		update: vi.fn(),
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	requireServerSession: requireServerSessionMock,
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: recordTransitionMock,
	upsertWorkflowRuntimeTask: upsertTaskMock,
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

import {
	recordOpportunityAnalysisAcceptance,
	transitionOpportunityDeadline,
	transitionOpportunityTriage,
} from "@/lib/actions/opportunity-lifecycle";

const opportunity = {
	id: "00000000-0000-4000-8000-000000000101",
	title: "National Data Platform RFP",
	decisionStatus: "pending",
	decisionReason: null,
	isReviewed: false,
	assignedTo: "pm-1",
	deadline: new Date("2026-06-01T12:00:00.000Z"),
	priorityRank: 5,
	fitScore: 82,
	winProbability: 68,
	metadata: {},
};

beforeEach(() => {
	vi.resetAllMocks();
	requireServerSessionMock.mockResolvedValue({
		user: { id: "pm-1", name: "Proposal Manager", email: "pm@example.test" },
	});
	recordTransitionMock.mockResolvedValue({ id: "workflow-1" });
	upsertTaskMock.mockResolvedValue({ id: "task-1" });
});

describe("opportunity lifecycle actions", () => {
	it("shortlists an opportunity and projects triage workflow work", async () => {
		let patch: Record<string, unknown> | undefined;
		let updateWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({ result: [opportunity] }));
		dbMock.update.mockReturnValueOnce(createChain({
			onSet: (value) => {
				patch = value;
			},
			onWhere: (value) => {
				updateWhere = value;
			},
		}));

		const result = await transitionOpportunityTriage({
			opportunityId: opportunity.id,
			action: "shortlist",
			reason: "Strong fit and enough time to bid",
			assignedTo: "capture-1",
		});

		expect(result).toMatchObject({ success: true, state: "shortlisted" });
		expect(patch).toMatchObject({
			decisionStatus: "shortlisted",
			decisionReason: "Strong fit and enough time to bid",
			isReviewed: true,
			assignedTo: "capture-1",
		});
		expect(recordTransitionMock).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "opportunity_triage",
			toState: "shortlisted",
			eventType: "opportunity_shortlist",
			priority: "critical",
		}));
		expect(collectSqlFragments(updateWhere).join(" ")).toContain("assigned_to");
		expect(upsertTaskMock).toHaveBeenCalledWith(expect.objectContaining({
			workflowInstanceId: "workflow-1",
			taskKey: "opportunity_triage:shortlisted",
			assignedTo: "capture-1",
		}));
	});

	it("marks an opportunity interested through the triage workflow", async () => {
		let patch: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({ result: [opportunity] }));
		dbMock.update.mockReturnValueOnce(createChain({
			onSet: (value) => {
				patch = value;
			},
		}));

		const result = await transitionOpportunityTriage({
			opportunityId: opportunity.id,
			action: "mark_interested",
			reason: "Worth tracking for capture planning",
		});

		expect(result).toMatchObject({ success: true, state: "interested" });
		expect(patch).toMatchObject({
			decisionStatus: "interested",
			decisionReason: "Worth tracking for capture planning",
			isReviewed: true,
		});
		expect(recordTransitionMock).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "opportunity_triage",
			toState: "interested",
			eventType: "opportunity_mark_interested",
		}));
		expect(upsertTaskMock).toHaveBeenCalledWith(expect.objectContaining({
			taskKey: "opportunity_triage:interested",
			assignedRole: "capture_manager",
		}));
	});

	it("records analysis acceptance with confidence and evidence", async () => {
		let patch: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({ result: [opportunity] }));
		dbMock.update.mockReturnValueOnce(createChain({
			onSet: (value) => {
				patch = value;
			},
		}));

		const result = await recordOpportunityAnalysisAcceptance({
			opportunityId: opportunity.id,
			recommendation: "accept",
			confidence: 91,
			reason: "Datacraft has strong platform and delivery evidence",
			evidenceLinks: ["evidence://past-performance/sovereign-platform"],
		});

		expect(result).toMatchObject({ success: true, state: "analysis_accepted" });
		expect(patch).toMatchObject({
			strategicNotes: "Datacraft has strong platform and delivery evidence",
		});
		expect(patch?.metadata).toMatchObject({
			workflow: {
				analysisAcceptance: {
					state: "analysis_accepted",
					confidence: 91,
				},
			},
		});
		expect(recordTransitionMock).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "opportunity_analysis_acceptance",
			toState: "analysis_accepted",
			evidenceLinks: ["evidence://past-performance/sovereign-platform"],
			metadata: { confidence: 91, recommendation: "accept" },
		}));
	});

	it("accepts a deadline and creates a deadline protection task", async () => {
		let patch: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({ result: [opportunity] }));
		dbMock.update.mockReturnValueOnce(createChain({
			onSet: (value) => {
				patch = value;
			},
		}));

		const result = await transitionOpportunityDeadline({
			opportunityId: opportunity.id,
			action: "accept",
			reason: "Deadline confirmed from source notice",
		});

		expect(result).toMatchObject({ success: true, state: "deadline_accepted" });
		expect(patch?.metadata).toMatchObject({
			workflow: {
				deadlineAcceptance: {
					state: "deadline_accepted",
					reason: "Deadline confirmed from source notice",
				},
			},
		});
		expect(recordTransitionMock).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "opportunity_deadline_acceptance",
			toState: "deadline_accepted",
			dueAt: opportunity.deadline,
		}));
		expect(upsertTaskMock).toHaveBeenCalledWith(expect.objectContaining({
			taskKey: "opportunity_deadline:accepted",
			dueAt: opportunity.deadline,
		}));
	});

	it("rejects timezone-less deadline strings before workflow mutation", async () => {
		dbMock.select.mockReturnValueOnce(createChain({ result: [opportunity] }));

		const result = await transitionOpportunityDeadline({
			opportunityId: opportunity.id,
			action: "change",
			reason: "User edited local datetime",
			acceptedDeadline: "2026-06-01T12:00",
		});

		expect(result).toMatchObject({
			success: false,
			error: "A valid deadline is required",
		});
		expect(recordTransitionMock).not.toHaveBeenCalled();
	});
});
