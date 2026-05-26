import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: vi.fn(async () => ({ userId: "proposal-manager-1", organizationId: "org-1" })),
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "task-workflow-1" })),
	upsertWorkflowRuntimeTask: vi.fn(async () => ({ id: "runtime-task-1" })),
}));

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
	onValues?: (value: Record<string, unknown>) => void;
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
	chain.values = vi.fn((value: Record<string, unknown>) => {
		config.onValues?.(value);
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
	return Reflect.ownKeys(value).flatMap((key) =>
		collectSqlFragments((value as Record<PropertyKey, unknown>)[key], seen)
	);
}

function expectAssignedTaskScope(where: unknown) {
	const sqlText = collectSqlFragments(where).join(" ");
	expect(sqlText).toContain("opportunities.organization_id");
	expect(sqlText).toContain("opportunities.assigned_to");
	expect(sqlText).toContain("proposal-manager-1");
	expect(sqlText).toContain("org-1");
}

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		select: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
		insert: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import { transitionProposalTaskWorkflow } from "@/lib/actions/proposal-task-workflow";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

const baseTask: Record<string, any> = {
	id: "task-1",
	organizationId: "org-1",
	opportunityId: "opp-1",
	taskNumber: "T-0001",
	title: "Draft technical response",
	description: "Write the integration approach.",
	taskType: "writing",
	taskCategory: "technical",
	sectionId: null,
	requirementId: "req-1",
	volumeId: null,
	assignedTo: "writer-1",
	assignedToEmail: "writer@example.com",
	assignedBy: "proposal-manager-1",
	assignedAt: new Date("2026-05-01T00:00:00.000Z"),
	suggestedAssignees: null,
	startDate: null,
	dueDate: new Date("2026-05-08T00:00:00.000Z"),
	estimatedHours: 8,
	actualHours: null,
	hoursLogged: [],
	dependsOn: [],
	blockedBy: [],
	blocks: [],
	status: "assigned",
	priority: "high",
	completedAt: null,
	completedBy: null,
	progress: 0,
	wordCountTarget: 1200,
	wordCountCurrent: 0,
	pageTarget: null,
	pageCurrent: null,
	qualityScore: null,
	lastReviewedAt: null,
	lastReviewedBy: null,
	reviewNotes: null,
	complianceRequirements: ["REQ-001"],
	evaluationCriteriaIds: null,
	remindersSent: 0,
	lastReminderAt: null,
	escalated: false,
	escalatedAt: null,
	comments: [],
	tags: [],
	sourceType: "manual",
	sourceId: null,
	createdBy: "proposal-manager-1",
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.select.mockReset();
	dbMock.update.mockReset();
	dbMock.insert.mockReset();
	dbMock.insert.mockReturnValue(createChain());
});

describe("proposal task workflow", () => {
	it("starts an assigned task and mirrors it into the workflow queue", async () => {
		let taskUpdate: Record<string, unknown> | undefined;
		let activity: Record<string, unknown> | undefined;
		const wheres: unknown[] = [];
		dbMock.select.mockReturnValueOnce(createChain({ result: [baseTask], onWhere: (value) => wheres.push(value) }));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ ...baseTask, status: "in_progress", progress: 1 }],
			onSet: (value) => {
				taskUpdate = value;
			},
			onWhere: (value) => wheres.push(value),
		}));
		dbMock.insert.mockReturnValueOnce(createChain({
			onValues: (value) => {
				activity = value;
			},
		}));

		const result = await transitionProposalTaskWorkflow({
			taskId: "task-1",
			action: "start",
			reason: "Beginning draft",
		});

		expect(result).toMatchObject({
			taskId: "task-1",
			opportunityId: "opp-1",
			fromState: "assigned",
			toState: "in_progress",
			runtimeTaskState: "in_progress",
		});
		expect(taskUpdate).toMatchObject({
			status: "in_progress",
			progress: 1,
			blockedBy: [],
		});
		expect(activity).toMatchObject({
			taskId: "task-1",
			activityType: "workflow_start",
			previousValue: "assigned",
			newValue: "in_progress",
			userId: "proposal-manager-1",
		});
		for (const where of wheres) {
			expectAssignedTaskScope(where);
		}
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "proposal_task_lifecycle",
			subjectType: "proposal_task",
			toState: "in_progress",
			assignedTo: "writer-1",
			assignedRole: "proposal_writer",
			terminal: false,
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			taskKey: "proposal-task:task-1",
			state: "in_progress",
			priority: "high",
			assignedTo: "writer-1",
		}));
	});

	it("blocks an in-progress task with blocker evidence", async () => {
		let taskUpdate: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{ ...baseTask, status: "in_progress", progress: 25 }],
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ ...baseTask, status: "blocked", progress: 25, blockedBy: ["Waiting for SME evidence"] }],
			onSet: (value) => {
				taskUpdate = value;
			},
		}));

		const result = await transitionProposalTaskWorkflow({
			taskId: "task-1",
			action: "block",
			reason: "Cannot substantiate claim",
			blocker: "Waiting for SME evidence",
			evidenceLinks: ["claim-1"],
		});

		expect(result.toState).toBe("blocked");
		expect(result.runtimeTaskState).toBe("blocked");
		expect(taskUpdate).toMatchObject({
			status: "blocked",
			blockedBy: ["Waiting for SME evidence"],
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			toState: "blocked",
			evidenceLinks: ["claim-1"],
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			state: "blocked",
		}));
	});

	it("completes a review task as terminal workflow work", async () => {
		let taskUpdate: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{ ...baseTask, status: "review", progress: 90 }],
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ ...baseTask, status: "completed", progress: 100, completedBy: "proposal-manager-1" }],
			onSet: (value) => {
				taskUpdate = value;
			},
		}));

		const result = await transitionProposalTaskWorkflow({
			taskId: "task-1",
			action: "complete",
			reason: "Reviewer accepted final response",
			evidenceLinks: ["doc-section-1"],
		});

		expect(result.toState).toBe("completed");
		expect(result.runtimeTaskState).toBe("completed");
		expect(taskUpdate).toMatchObject({
			status: "completed",
			progress: 100,
			completedBy: "proposal-manager-1",
			blockedBy: [],
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			toState: "completed",
			terminal: true,
			assignedRole: null,
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			state: "completed",
			assignedRole: null,
		}));
	});

	it("rejects completion before work is in progress or review", async () => {
		dbMock.select.mockReturnValueOnce(createChain({ result: [baseTask] }));

		await expect(
			transitionProposalTaskWorkflow({
				taskId: "task-1",
				action: "complete",
				reason: "Too early",
			})
		).rejects.toThrow("Only in-progress or review tasks can be completed");

		expect(dbMock.update).not.toHaveBeenCalled();
		expect(recordWorkflowRuntimeTransition).not.toHaveBeenCalled();
	});
});
