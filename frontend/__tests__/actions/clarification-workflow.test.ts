import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: vi.fn(async () => ({ userId: "proposal-manager-1" })),
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "clarification-workflow-1" })),
	upsertWorkflowRuntimeTask: vi.fn(async () => ({ id: "clarification-task-1" })),
}));

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
	return Reflect.ownKeys(value).flatMap((key) =>
		collectSqlFragments((value as Record<PropertyKey, unknown>)[key], seen)
	);
}

function expectAssignedRequirementScope(where: unknown) {
	const sqlText = collectSqlFragments(where).join(" ");
	expect(sqlText).toContain("opportunities.assigned_to");
	expect(sqlText).toContain("proposal-manager-1");
}

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		select: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import { transitionClarificationWorkflow } from "@/lib/actions/clarification-workflow";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

const baseRequirement: Record<string, any> = {
	id: "req-1",
	rfpDocumentId: "rfp-1",
	opportunityId: "opp-1",
	requirementNumber: "REQ-001",
	title: "Integration requirement",
	requirementText: "The bidder shall integrate with the incumbent case management system.",
	sourceQuote: null,
	sourcePage: 12,
	sourceSection: "L.4.2",
	category: "technical",
	subcategory: null,
	requirementType: "shall",
	priority: "mandatory",
	riskLevel: "high",
	evaluationWeight: null,
	extractionConfidence: 68,
	aiAnalysis: null,
	isImplicit: false,
	ambiguityLevel: "very_ambiguous",
	clarificationQuestions: [],
	relatedRequirements: [],
	keyTerms: [],
	suggestedApproach: null,
	embedding: null,
	complianceStatus: "not_addressed",
	responseStrategy: null,
	assignedTo: null,
	dueDate: new Date("2026-05-08T00:00:00.000Z"),
	responseDocumentId: null,
	responseSection: null,
	notes: null,
	tags: [],
	metadata: null,
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
	updatedAt: new Date("2026-05-01T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.select.mockReset();
	dbMock.update.mockReset();
});

describe("clarification workflow", () => {
	it("drafts a clarification question and projects approval work", async () => {
		let requirementUpdate: Record<string, unknown> | undefined;
		const whereClauses: unknown[] = [];
		dbMock.select.mockReturnValueOnce(createChain({
			result: [baseRequirement],
			onWhere: (value) => {
				whereClauses.push(value);
			},
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{
				...baseRequirement,
				clarificationQuestions: ["Which incumbent system APIs are in scope?"],
				metadata: {},
			}],
			onSet: (value) => {
				requirementUpdate = value;
			},
			onWhere: (value) => {
				whereClauses.push(value);
			},
		}));

		const result = await transitionClarificationWorkflow({
			requirementId: "req-1",
			action: "draft",
			reason: "Requirement references an unnamed incumbent platform",
			question: "Which incumbent system APIs are in scope?",
			assignedTo: "capture-lead-1",
		});

		expect(result).toMatchObject({
			requirementId: "req-1",
			opportunityId: "opp-1",
			fromState: "drafted",
			toState: "drafted",
			questionCount: 1,
			taskProjected: true,
		});
		expect(requirementUpdate?.clarificationQuestions).toEqual(["Which incumbent system APIs are in scope?"]);
		expect((requirementUpdate?.metadata as any).clarificationWorkflow).toMatchObject({
			state: "drafted",
			questions: [expect.objectContaining({ question: "Which incumbent system APIs are in scope?" })],
		});
		expect(whereClauses).toHaveLength(2);
		expectAssignedRequirementScope(whereClauses[0]);
		expectAssignedRequirementScope(whereClauses[1]);
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "requirement_clarification",
			subjectType: "requirement_clarification",
			subjectId: "req-1",
			toState: "drafted",
			priority: "critical",
			assignedRole: "proposal_manager",
			terminal: false,
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			taskKey: "requirement-clarification:req-1",
			title: "Review drafted clarification question",
			state: "open",
			assignedTo: "capture-lead-1",
		}));
	});

	it("records submission reference and waits for customer answer", async () => {
		let requirementUpdate: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				...baseRequirement,
				clarificationQuestions: ["Which incumbent system APIs are in scope?"],
				metadata: {
					clarificationWorkflow: {
						state: "approved",
						history: [],
						questions: [{
							id: "cq-1",
							question: "Which incumbent system APIs are in scope?",
							status: "approved",
							createdAt: "2026-05-01T00:00:00.000Z",
							updatedAt: "2026-05-01T00:00:00.000Z",
						}],
					},
				},
			}],
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{
				...baseRequirement,
				metadata: {},
			}],
			onSet: (value) => {
				requirementUpdate = value;
			},
		}));

		const result = await transitionClarificationWorkflow({
			requirementId: "req-1",
			action: "submit",
			reason: "Approved for customer Q&A",
			submissionReference: "QA-2026-05-05-01",
		});

		expect(result.toState).toBe("submitted");
		expect((requirementUpdate?.metadata as any).clarificationWorkflow).toMatchObject({
			state: "submitted",
			lastSubmissionReference: "QA-2026-05-05-01",
			questions: [expect.objectContaining({ submissionReference: "QA-2026-05-05-01" })],
		});
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			title: "Await customer clarification answer",
			state: "blocked",
		}));
	});

	it("incorporates a recorded answer as a terminal workflow", async () => {
		let requirementUpdate: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				...baseRequirement,
				metadata: {
					clarificationWorkflow: {
						state: "answered",
						history: [],
						lastAnswer: "Only REST APIs listed in Attachment B are in scope.",
						questions: [{
							id: "cq-1",
							question: "Which incumbent system APIs are in scope?",
							answer: "Only REST APIs listed in Attachment B are in scope.",
							status: "answered",
							createdAt: "2026-05-01T00:00:00.000Z",
							updatedAt: "2026-05-01T00:00:00.000Z",
						}],
					},
				},
			}],
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ ...baseRequirement, metadata: {} }],
			onSet: (value) => {
				requirementUpdate = value;
			},
		}));

		const result = await transitionClarificationWorkflow({
			requirementId: "req-1",
			action: "incorporate",
			reason: "Updated technical approach and compliance matrix",
		});

		expect(result.toState).toBe("incorporated");
		expect((requirementUpdate?.metadata as any).clarificationWorkflow).toMatchObject({
			state: "incorporated",
			questions: [expect.objectContaining({ status: "incorporated" })],
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			toState: "incorporated",
			terminal: true,
			assignedRole: null,
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			state: "completed",
			title: "Clarification incorporated",
		}));
	});

	it("requires approval before submission", async () => {
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				...baseRequirement,
				metadata: {
					clarificationWorkflow: {
						state: "drafted",
						history: [],
						questions: [{
							id: "cq-1",
							question: "Which incumbent system APIs are in scope?",
							status: "drafted",
							createdAt: "2026-05-01T00:00:00.000Z",
							updatedAt: "2026-05-01T00:00:00.000Z",
						}],
					},
				},
			}],
		}));

		await expect(
			transitionClarificationWorkflow({
				requirementId: "req-1",
				action: "submit",
				reason: "Trying to submit too early",
				submissionReference: "QA-1",
			})
		).rejects.toThrow("Only approved clarifications can be submitted");

		expect(dbMock.update).not.toHaveBeenCalled();
		expect(recordWorkflowRuntimeTransition).not.toHaveBeenCalled();
	});
});
