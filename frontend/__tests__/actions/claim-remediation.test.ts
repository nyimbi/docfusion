import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-utils", () => {
	const userHasAuthorityRole = (
		context: { role?: string; roles?: string[] },
		requiredRole: string
	) => {
		const roles = new Set([context.role, ...(context.roles ?? [])]
			.filter(Boolean)
			.map((value) => String(value).trim().toLowerCase()));
		return roles.has("admin") || roles.has(requiredRole.trim().toLowerCase());
	};
	return {
		requireUserContext: requireUserContextMock,
		userHasAuthorityRole,
	};
});

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "claim-workflow-1" })),
	upsertWorkflowRuntimeTask: vi.fn(async () => ({ id: "claim-task-1" })),
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

function expectAssignedClaimScope(where: unknown) {
	const sqlText = collectSqlFragments(where).join(" ");
	expect(sqlText).toContain("opportunities.organization_id");
	expect(sqlText).toContain("org-1");
	expect(sqlText).toContain("opportunities.assigned_to");
	expect(sqlText).toContain("proposal-writer-1");
}

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		select: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
	};
	return { db: dbMock };
});

import { transitionClaimRemediationWorkflow } from "@/lib/actions/claim-remediation";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";

const baseClaim: Record<string, any> = {
	id: "claim-1",
	documentId: "doc-1",
	sectionId: "section-1",
	opportunityId: "opp-1",
	claimText: "Datacraft will deliver flawless integration outcomes.",
	claimType: "performance",
	claimLocation: null,
	hasEvidence: false,
	evidenceStrength: "none",
	linkedEvidenceIds: [],
	suggestedEvidence: [],
	quantificationSuggestion: "Add delivery metrics from prior projects.",
	riskLevel: "high",
	evaluatorImpact: "Evaluator may discount the claim without proof.",
	status: "open",
	resolution: null,
	resolvedBy: null,
	resolvedAt: null,
	resolutionNotes: null,
	analyzedAt: new Date("2026-05-01T00:00:00.000Z"),
	createdAt: new Date("2026-05-01T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "proposal-writer-1",
		organizationId: "org-1",
		roles: ["proposal_writer"],
	});
	dbMock.select.mockReset();
	dbMock.update.mockReset();
});

describe("claim remediation workflow", () => {
	it("starts high-risk claim remediation and projects an owned task", async () => {
		let claimUpdate: Record<string, unknown> | undefined;
		const whereClauses: unknown[] = [];
		dbMock.select.mockReturnValueOnce(createChain({
			result: [baseClaim],
			onWhere: (value) => {
				whereClauses.push(value);
			},
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ ...baseClaim, status: "in_progress", resolutionNotes: "Needs evidence" }],
			onSet: (value) => {
				claimUpdate = value;
			},
			onWhere: (value) => {
				whereClauses.push(value);
			},
		}));

		const result = await transitionClaimRemediationWorkflow({
			claimId: "claim-1",
			action: "start",
			reason: "Needs evidence",
			assignedTo: "proposal-writer-2",
			dueAt: "2026-05-06T00:00:00.000Z",
		});

		expect(result).toMatchObject({
			claimId: "claim-1",
			opportunityId: "opp-1",
			fromState: "open",
			toState: "in_progress",
			status: "in_progress",
			taskProjected: true,
		});
		expect(claimUpdate).toMatchObject({
			status: "in_progress",
			resolution: null,
			resolvedBy: null,
			resolvedAt: null,
		});
		expect(whereClauses).toHaveLength(2);
		expectAssignedClaimScope(whereClauses[0]);
		expectAssignedClaimScope(whereClauses[1]);
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			workflowKey: "evidence_claim_remediation",
			subjectType: "evidence_claim",
			subjectId: "claim-1",
			organizationId: "org-1",
			toState: "in_progress",
			priority: "critical",
			assignedTo: "proposal-writer-2",
			assignedRole: "proposal_writer",
			terminal: false,
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			workflowInstanceId: "claim-workflow-1",
			taskKey: "claim-remediation:claim-1",
			state: "in_progress",
			priority: "critical",
			metadata: expect.objectContaining({
				organizationId: "org-1",
			}),
			assignedTo: "proposal-writer-2",
		}));
	});

	it("resolves a claim by adding evidence and completes the remediation task", async () => {
		let claimUpdate: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{ ...baseClaim, status: "in_progress", linkedEvidenceIds: ["ev-1"] }],
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{
				...baseClaim,
				status: "resolved",
				resolution: "evidence_added",
				hasEvidence: true,
				evidenceStrength: "moderate",
				linkedEvidenceIds: ["ev-1", "ev-2"],
			}],
			onSet: (value) => {
				claimUpdate = value;
			},
		}));

		const result = await transitionClaimRemediationWorkflow({
			claimId: "claim-1",
			action: "add_evidence",
			reason: "Linked verified case study",
			evidenceIds: ["ev-2"],
		});

		expect(result).toMatchObject({
			toState: "evidenced",
			status: "resolved",
			resolution: "evidence_added",
			taskProjected: true,
		});
		expect(claimUpdate).toMatchObject({
			status: "resolved",
			resolution: "evidence_added",
			hasEvidence: true,
			evidenceStrength: "moderate",
			linkedEvidenceIds: ["ev-1", "ev-2"],
			resolvedBy: "proposal-writer-1",
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			toState: "evidenced",
			terminal: true,
			evidenceLinks: ["ev-2"],
			assignedRole: null,
		}));
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			state: "completed",
			assignedRole: null,
		}));
	});

	it("records a rewritten claim as terminal claim-modified remediation", async () => {
		let claimUpdate: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({ result: [baseClaim] }));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{
				...baseClaim,
				claimText: "Datacraft will apply proven integration controls validated across prior programmes.",
				status: "resolved",
				resolution: "claim_modified",
			}],
			onSet: (value) => {
				claimUpdate = value;
			},
		}));

		await transitionClaimRemediationWorkflow({
			claimId: "claim-1",
			action: "rewrite",
			reason: "Qualified unsupported absolute language",
			revisedClaimText: "Datacraft will apply proven integration controls validated across prior programmes.",
		});

		expect(claimUpdate).toMatchObject({
			claimText: "Datacraft will apply proven integration controls validated across prior programmes.",
			status: "resolved",
			resolution: "claim_modified",
		});
		expect(String(claimUpdate?.resolutionNotes)).toContain("Original claim:");
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			toState: "rewritten",
			terminal: true,
		}));
	});

	it("requires claim risk authority before waiving unsupported claims", async () => {
		await expect(
			transitionClaimRemediationWorkflow({
				claimId: "claim-1",
				action: "waive",
				reason: "Leadership accepts the unsupported claim risk",
			})
		).rejects.toThrow("Waiving unsupported proposal claims requires claim risk authority");

		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
		expect(recordWorkflowRuntimeTransition).not.toHaveBeenCalled();
		expect(upsertWorkflowRuntimeTask).not.toHaveBeenCalled();
	});

	it("records a claim risk waiver for an authorized proposal manager", async () => {
		let claimUpdate: Record<string, unknown> | undefined;
		requireUserContextMock.mockResolvedValueOnce({
			userId: "proposal-manager-1",
			organizationId: "org-1",
			roles: ["proposal_manager"],
		});
		dbMock.select.mockReturnValueOnce(createChain({ result: [baseClaim] }));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{
				...baseClaim,
				status: "wont_fix",
				resolution: "accepted_as_is",
				resolvedBy: "proposal-manager-1",
			}],
			onSet: (value) => {
				claimUpdate = value;
			},
		}));

		const result = await transitionClaimRemediationWorkflow({
			claimId: "claim-1",
			action: "waive",
			reason: "Leadership accepts the unsupported claim risk",
		});

		expect(result).toMatchObject({
			fromState: "open",
			toState: "waived",
			status: "wont_fix",
			resolution: "accepted_as_is",
		});
		expect(claimUpdate).toMatchObject({
			status: "wont_fix",
			resolution: "accepted_as_is",
			resolvedBy: "proposal-manager-1",
		});
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(expect.objectContaining({
			toState: "waived",
			terminal: true,
			assignedRole: null,
		}));
	});

	it("requires evidence for evidence remediation", async () => {
		dbMock.select.mockReturnValueOnce(createChain({ result: [baseClaim] }));

		await expect(
			transitionClaimRemediationWorkflow({
				claimId: "claim-1",
				action: "add_evidence",
				reason: "Evidence will be added later",
			})
		).rejects.toThrow("requires at least one evidence item");

		expect(dbMock.update).not.toHaveBeenCalled();
		expect(recordWorkflowRuntimeTransition).not.toHaveBeenCalled();
	});

	it("reopens a waived claim for renewed evidence work", async () => {
		let claimUpdate: Record<string, unknown> | undefined;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				...baseClaim,
				status: "wont_fix",
				resolution: "accepted_as_is",
				resolvedBy: "approver-1",
				resolvedAt: new Date("2026-05-02T00:00:00.000Z"),
			}],
		}));
		dbMock.update.mockReturnValueOnce(createChain({
			result: [{ ...baseClaim, status: "open", resolution: null }],
			onSet: (value) => {
				claimUpdate = value;
			},
		}));

		const result = await transitionClaimRemediationWorkflow({
			claimId: "claim-1",
			action: "reopen",
			reason: "New evidence became available",
		});

		expect(result).toMatchObject({
			fromState: "accepted_as_is",
			toState: "open",
			status: "open",
		});
		expect(claimUpdate).toMatchObject({
			status: "open",
			resolution: null,
			resolvedBy: null,
			resolvedAt: null,
		});
		expect(upsertWorkflowRuntimeTask).toHaveBeenCalledWith(expect.objectContaining({
			state: "open",
			title: "Reopened claim remediation",
		}));
	});
});
