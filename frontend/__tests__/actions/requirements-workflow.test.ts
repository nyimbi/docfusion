import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/auth/tenant-context", () => ({
	requireTenantContext: vi.fn(async () => ({
		userId: "capture-lead",
		organizationId: "org-1",
		roles: ["admin"],
	})),
}));

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
	onValues?: (value: Record<string, unknown>) => void;
	onReturning?: () => unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	const methods = ["from", "limit", "orderBy"];

	for (const method of methods) {
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
	chain.returning = vi.fn(async () => config.onReturning?.() ?? config.result ?? []);
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
	execute: ReturnType<typeof vi.fn>;
	transaction: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		execute: vi.fn(async () => []),
		transaction: vi.fn(async (fn: (tx: typeof dbMock) => Promise<unknown>) => fn(dbMock)),
	},
}));

import { transitionRequirementWorkflow } from "@/lib/actions/requirements";

const baseRequirement = {
	id: "00000000-0000-4000-8000-000000000001",
	rfpDocumentId: "00000000-0000-4000-8000-000000000010",
	opportunityId: "00000000-0000-4000-8000-000000000020",
	requirementNumber: "REQ-001",
	title: "Security controls",
	requirementText: "Provide evidence of security controls.",
	sourceQuote: "Security controls are mandatory.",
	sourcePage: 12,
	sourceSection: "3.1",
	category: "technical",
	subcategory: null,
	requirementType: null,
	priority: "mandatory",
	riskLevel: "high",
	evaluationWeight: null,
	extractionConfidence: null,
	aiAnalysis: null,
	isImplicit: false,
	ambiguityLevel: null,
	clarificationQuestions: null,
	relatedRequirements: null,
	keyTerms: null,
	suggestedApproach: null,
	embedding: null,
	complianceStatus: "not_addressed",
	responseStrategy: null,
	assignedTo: null,
	dueDate: null,
	responseDocumentId: null,
	responseSection: null,
	notes: null,
	tags: [],
	metadata: null,
	createdAt: new Date("2026-04-01T00:00:00.000Z"),
	updatedAt: new Date("2026-04-01T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.execute.mockResolvedValue([]);
	dbMock.transaction.mockImplementation(async (fn: (tx: typeof dbMock) => Promise<unknown>) => fn(dbMock));
});

describe("transitionRequirementWorkflow", () => {
	it("blocks acceptance when required gates are missing", async () => {
		dbMock.select.mockReturnValueOnce(createChain({ result: [baseRequirement] }));

		await expect(
			transitionRequirementWorkflow({
				requirementId: baseRequirement.id,
				action: "accept",
				actorId: "capture-lead",
				reason: "Ready for drafting",
			})
		).rejects.toThrow("missing owner, due date");

		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("accepts a gated requirement and projects one linked writing task", async () => {
		let taskInsert: Record<string, unknown> | undefined;
		let activityInsert: Record<string, unknown> | undefined;
		let requirementUpdate: Record<string, unknown> | undefined;

		const createdTask = { id: "00000000-0000-4000-8000-000000000030" };

		dbMock.select
			.mockReturnValueOnce(createChain({ result: [baseRequirement] }))
			.mockReturnValueOnce(createChain({ result: [] }));
		dbMock.insert
			.mockReturnValueOnce(createChain({
				onValues: (value) => {
					taskInsert = value;
				},
				result: [createdTask],
			}))
			.mockReturnValueOnce(createChain({
				onValues: (value) => {
					activityInsert = value;
				},
			}));
		dbMock.update.mockReturnValueOnce(createChain({
			onSet: (value) => {
				requirementUpdate = value;
			},
			onReturning: () => [{
				...baseRequirement,
				...requirementUpdate,
				assignedTo: "writer-1",
				dueDate: new Date("2026-05-10T00:00:00.000Z"),
			}],
		}));

		const result = await transitionRequirementWorkflow({
			requirementId: baseRequirement.id,
			action: "accept",
			actorId: "capture-lead",
			actorName: "Capture Lead",
			reason: "Ready for drafting",
			assignedTo: "writer-1",
			assignedToEmail: "writer@example.com",
			dueDate: "2026-05-10",
			evidenceLinks: ["rfp://section/3.1"],
		});

		expect(result?.workflowState).toBe("accepted");
		expect(result?.projectedTaskId).toBe(createdTask.id);
		expect(dbMock.transaction).toHaveBeenCalledTimes(1);
		expect(dbMock.execute).toHaveBeenCalledTimes(1);
		expect(taskInsert).toMatchObject({
			opportunityId: baseRequirement.opportunityId,
			taskType: "writing",
			requirementId: baseRequirement.id,
			assignedTo: "writer-1",
			sourceType: "requirement_workflow",
			sourceId: baseRequirement.id,
			priority: "high",
		});
		expect(requirementUpdate?.complianceStatus).toBe("partial");
		expect((requirementUpdate?.metadata as any).workflow.state).toBe("accepted");
		expect((requirementUpdate?.metadata as any).workflow.projectedTaskId).toBe(createdTask.id);
		expect((requirementUpdate?.metadata as any).workflow.history[0].evidenceLinks).toEqual([
			"rfp://section/3.1",
		]);
		expect(activityInsert).toMatchObject({
			taskId: createdTask.id,
			activityType: "requirement_workflow_transition",
			previousValue: "review",
			newValue: "accepted",
			userId: "capture-lead",
		});
	});

	it("reuses an existing projected task on repeated acceptance", async () => {
		const existingTask = { id: "00000000-0000-4000-8000-000000000040" };
		let taskUpdate: Record<string, unknown> | undefined;
		let existingTaskWhere: unknown;
		let taskUpdateWhere: unknown;
		let requirementUpdate: Record<string, unknown> | undefined;

		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{
				...baseRequirement,
				assignedTo: "writer-1",
				dueDate: new Date("2026-05-10T00:00:00.000Z"),
			}] }))
			.mockReturnValueOnce(createChain({
				result: [existingTask],
				onWhere: (value) => {
					existingTaskWhere = value;
				},
			}));
		dbMock.insert.mockReturnValueOnce(createChain());
		dbMock.update
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					taskUpdate = value;
				},
				onWhere: (value) => {
					taskUpdateWhere = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					requirementUpdate = value;
				},
				onReturning: () => [{
					...baseRequirement,
					...requirementUpdate,
				}],
			}));

		const result = await transitionRequirementWorkflow({
			requirementId: baseRequirement.id,
			action: "accept",
			actorId: "capture-lead",
			reason: "Still ready",
			assignedTo: "writer-2",
			assignedToEmail: "writer-2@example.com",
			dueDate: "2026-05-12",
		});

		expect(result?.projectedTaskId).toBe(existingTask.id);
		expect(dbMock.insert).toHaveBeenCalledTimes(1);
		expect(taskUpdate).toMatchObject({
			assignedTo: "writer-2",
			assignedToEmail: "writer-2@example.com",
			status: "assigned",
		});
		const existingTaskSql = collectSqlFragments(existingTaskWhere).join(" ");
		const taskUpdateSql = collectSqlFragments(taskUpdateWhere).join(" ");
		expect(existingTaskSql).toContain("opportunities.assigned_to");
		expect(existingTaskSql).toContain("opportunity_id");
		expect(taskUpdateSql).toContain("opportunities.assigned_to");
		expect(taskUpdateSql).toContain("opportunity_id");
		expect((requirementUpdate?.metadata as any).workflow.projectedTaskId).toBe(existingTask.id);
	});

	it("rejects illegal transitions before writing task or requirement changes", async () => {
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				...baseRequirement,
				metadata: { workflow: { state: "accepted", history: [] } },
			}],
		}));

		await expect(
			transitionRequirementWorkflow({
				requirementId: baseRequirement.id,
				action: "reject",
				actorId: "capture-lead",
				reason: "Cannot reject accepted requirement",
			})
		).rejects.toThrow("Cannot reject requirement from accepted state");

		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("rejects a requirement without projecting a task", async () => {
		let requirementUpdate: Record<string, unknown> | undefined;

		dbMock.select.mockReturnValueOnce(createChain({ result: [baseRequirement] }));
		dbMock.update.mockReturnValueOnce(createChain({
			onSet: (value) => {
				requirementUpdate = value;
			},
			onReturning: () => [{
				...baseRequirement,
				...requirementUpdate,
			}],
		}));

		const result = await transitionRequirementWorkflow({
			requirementId: baseRequirement.id,
			action: "reject",
			actorId: "capture-lead",
			reason: "Out of scope",
		});

		expect(result?.workflowState).toBe("rejected");
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect((requirementUpdate?.metadata as any).workflow.state).toBe("rejected");
	});

	it("reopens an accepted requirement for review", async () => {
		let requirementUpdate: Record<string, unknown> | undefined;
		const acceptedRequirement = {
			...baseRequirement,
			metadata: {
				workflow: {
					state: "accepted",
					projectedTaskId: "00000000-0000-4000-8000-000000000030",
					history: [],
				},
			},
		};

		dbMock.select.mockReturnValueOnce(createChain({ result: [acceptedRequirement] }));
		dbMock.insert.mockReturnValueOnce(createChain());
		dbMock.update.mockReturnValueOnce(createChain({
			onSet: (value) => {
				requirementUpdate = value;
			},
			onReturning: () => [{
				...acceptedRequirement,
				...requirementUpdate,
			}],
		}));

		const result = await transitionRequirementWorkflow({
			requirementId: baseRequirement.id,
			action: "reopen",
			actorId: "capture-lead",
			reason: "Need evidence check",
		});

		expect(result?.workflowState).toBe("review");
		expect((requirementUpdate?.metadata as any).workflow.state).toBe("review");
		expect((requirementUpdate?.metadata as any).workflow.reopenedBy).toBe("capture-lead");
	});
});
