import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: vi.fn(async () => ({ userId: "compliance-lead", organizationId: "org-1" })),
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(async () => ({ id: "workflow-instance-1" })),
}));

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "innerJoin", "leftJoin", "limit", "orderBy"]) {
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

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		select: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
		execute: vi.fn(async () => []),
		query: {
			complianceMatrices: {
				findFirst: vi.fn(),
			},
		},
		transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(dbMock)),
	};
	return { db: dbMock };
});

import {
	transitionComplianceEntryWorkflow,
	transitionComplianceMatrixWorkflow,
	validateCompliance,
} from "@/lib/actions/compliance-validator";

const baseEntry: Record<string, any> = {
	id: "entry-1",
	organizationId: "org-1",
	matrixId: "matrix-1",
	requirementId: "req-1",
	complianceStatus: "partial",
	complianceJustification: "Addresses most evidence needs",
	responseReference: "Volume 1, Section 2.1",
	responseSummary: null,
	evidenceReferences: [],
	status: "review",
	reviewerNotes: null,
	reviewedBy: null,
	reviewedAt: null,
	approvedBy: null,
	approvedAt: null,
	assignedTo: null,
	dueDate: null,
	completionPercent: 75,
	metadata: null,
	updatedAt: new Date("2026-04-01T00:00:00.000Z"),
};

const baseRequirement = {
	id: "req-1",
	organizationId: "org-1",
	requirementNumber: "REQ-001",
	priority: "mandatory",
	riskLevel: "high",
	opportunityId: "opp-1",
};

const baseMatrix: Record<string, any> = {
	id: "matrix-1",
	organizationId: "org-1",
	opportunityId: "opp-1",
	rfpDocumentId: "rfp-1",
	name: "Compliance Matrix",
	description: null,
	version: 1,
	status: "review",
	totalRequirements: 1,
	mandatoryCount: 1,
	compliantCount: 1,
	partialCount: 0,
	nonCompliantCount: 0,
	notAddressedCount: 0,
	complianceScore: 100,
	mandatoryComplianceScore: 100,
	reviewedBy: "compliance-lead",
	reviewedAt: new Date("2026-04-01T00:00:00.000Z"),
	reviewNotes: null,
	approvedBy: null,
	approvedAt: null,
	categoryGroups: {},
	displayColumns: [],
	exportSettings: {},
	createdBy: "compliance-lead",
	metadata: null,
	createdAt: new Date("2026-04-01T00:00:00.000Z"),
	updatedAt: new Date("2026-04-01T00:00:00.000Z"),
};

function mockEntryLookup(entry = baseEntry, requirement = baseRequirement) {
	dbMock.select
		.mockReturnValueOnce(createChain({
			result: [{ entry, requirement }],
		}))
		.mockReturnValueOnce(createChain({
				result: [
					{ entry: { complianceStatus: "compliant" }, requirement: { priority: "mandatory" } },
				{ entry: { complianceStatus: "compliant" }, requirement: { priority: "mandatory" } },
				{ entry: { complianceStatus: "non_compliant" }, requirement: { priority: "optional" } },
			],
		}));
}

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.select.mockReset();
	dbMock.update.mockReset();
	dbMock.execute.mockReset();
	dbMock.query.complianceMatrices.findFirst.mockReset();
	dbMock.transaction.mockReset();
	dbMock.transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => fn(dbMock));
	dbMock.execute.mockResolvedValue([]);
});

describe("compliance validation access scope", () => {
	it("scopes opportunity validation matrix and entries to the actor organization", async () => {
		let matrixWhere: unknown;
		let entriesWhere: unknown;
		dbMock.query.complianceMatrices.findFirst.mockImplementation(async (args: { where: unknown }) => {
			matrixWhere = args.where;
			return baseMatrix;
		});
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{ entry: baseEntry, requirement: baseRequirement }],
			onWhere: (value) => {
				entriesWhere = value;
			},
		}));

		const result = await validateCompliance("opp-1");

		expect(result.totalRequirements).toBe(1);
		expect(collectSqlFragments(matrixWhere).join(" ")).toContain("organization_id");
		expect(collectSqlFragments(matrixWhere).join(" ")).toContain("org-1");
		expect(collectSqlFragments(entriesWhere).join(" ")).toContain("organization_id");
		expect(collectSqlFragments(entriesWhere).join(" ")).toContain("org-1");
	});
});

describe("compliance entry workflow", () => {
	it("approves a reviewed entry and recalculates matrix statistics", async () => {
		let entryUpdate: Record<string, unknown> | undefined;
		let requirementUpdate: Record<string, unknown> | undefined;
		let matrixUpdate: Record<string, unknown> | undefined;

		mockEntryLookup();
		dbMock.update
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					entryUpdate = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					requirementUpdate = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					matrixUpdate = value;
				},
			}));

		const result = await transitionComplianceEntryWorkflow({
			matrixId: "matrix-1",
			entryId: "entry-1",
			action: "approve",
			reason: "Reviewer verified the response evidence",
		});

		expect(result).toMatchObject({
			matrixId: "matrix-1",
			entryId: "entry-1",
			state: "approved",
			status: "approved",
			complianceStatus: "compliant",
			matrixStats: {
				totalRequirements: 3,
				mandatoryCount: 2,
				compliantCount: 2,
				partialCount: 0,
				nonCompliantCount: 1,
				notAddressedCount: 0,
				complianceScore: 67,
				mandatoryComplianceScore: 100,
			},
		});
		expect(entryUpdate).toMatchObject({
			status: "approved",
			complianceStatus: "compliant",
			complianceJustification: "Addresses most evidence needs",
			approvedBy: "compliance-lead",
			completionPercent: 100,
		});
		expect(requirementUpdate).toMatchObject({
			complianceStatus: "compliant",
			responseStrategy: "Addresses most evidence needs",
		});
		expect((entryUpdate?.metadata as any).complianceWorkflow.history[0]).toMatchObject({
			action: "approve",
			from: "review",
			to: "approved",
			actorId: "compliance-lead",
			reason: "Reviewer verified the response evidence",
		});
		expect(matrixUpdate).toMatchObject({
			totalRequirements: 3,
			mandatoryCount: 2,
			complianceScore: 67,
			mandatoryComplianceScore: 100,
		});
	});

	it("blocks review submission when an entry has no response evidence", async () => {
		mockEntryLookup({
			...baseEntry,
			complianceStatus: "pending",
			complianceJustification: null,
			responseReference: null,
			responseSummary: null,
			evidenceReferences: [],
			status: "draft",
		});

		await expect(
			transitionComplianceEntryWorkflow({
				matrixId: "matrix-1",
				entryId: "entry-1",
				action: "submit_for_review",
				reason: "Ready for review",
			})
		).rejects.toThrow("Submit for review requires");

		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("waives a draft gap as a not-applicable approved exception", async () => {
		let entryUpdate: Record<string, unknown> | undefined;

		mockEntryLookup({
			...baseEntry,
			complianceStatus: "non_compliant",
			complianceJustification: null,
			responseReference: null,
			status: "draft",
			completionPercent: 10,
		});
		dbMock.update
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					entryUpdate = value;
				},
			}))
			.mockReturnValueOnce(createChain())
			.mockReturnValueOnce(createChain());

		const result = await transitionComplianceEntryWorkflow({
			matrixId: "matrix-1",
			entryId: "entry-1",
			action: "waive",
			reason: "Customer instruction excludes this requirement",
		});

		expect(result).toMatchObject({
			state: "waived",
			status: "approved",
			complianceStatus: "not_applicable",
		});
		expect(entryUpdate).toMatchObject({
			status: "approved",
			complianceStatus: "not_applicable",
			complianceJustification: "Customer instruction excludes this requirement",
			approvedBy: "compliance-lead",
			completionPercent: 100,
		});
		expect((entryUpdate?.metadata as any).complianceWorkflow.waiver).toMatchObject({
			reason: "Customer instruction excludes this requirement",
			actorId: "compliance-lead",
		});
	});

	it("blocks final matrix lock when mandatory entries are unresolved", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [baseMatrix] }))
			.mockReturnValueOnce(createChain({
				result: [{
					entry: {
						...baseEntry,
						status: "review",
						complianceStatus: "non_compliant",
					},
					requirement: baseRequirement,
				}],
			}));

		await expect(
			transitionComplianceMatrixWorkflow({
				matrixId: "matrix-1",
				action: "lock_final",
				reason: "Ready for submission lock",
			})
		).rejects.toThrow("Compliance matrix final lock blocked");

		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("bulk-approves ready compliant entries before final matrix lock", async () => {
		const updateSets: Record<string, unknown>[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({ result: [{ ...baseMatrix, status: "draft" }] }))
			.mockReturnValueOnce(createChain({
				result: [
					{
						entry: {
							...baseEntry,
							id: "entry-ready",
							status: "draft",
							complianceStatus: "compliant",
							responseReference: "Volume 1, Section 2.1",
						},
						requirement: baseRequirement,
					},
					{
						entry: {
							...baseEntry,
							id: "entry-partial",
							status: "draft",
							complianceStatus: "partial",
							responseReference: "Volume 1, Section 2.2",
						},
						requirement: {
							...baseRequirement,
							id: "req-2",
							requirementNumber: "REQ-002",
							priority: "preferred",
						},
					},
				],
			}))
			.mockReturnValueOnce(createChain({
				result: [
					{ entry: { complianceStatus: "compliant" }, requirement: { priority: "mandatory" } },
					{ entry: { complianceStatus: "partial" }, requirement: { priority: "preferred" } },
				],
			}));
		dbMock.update.mockImplementation(() => createChain({
			onSet: (value) => {
				updateSets.push(value);
			},
		}));

		const result = await transitionComplianceMatrixWorkflow({
			matrixId: "matrix-1",
			action: "approve_ready_entries",
			reason: "Approve generated compliant entries with response evidence",
		});

		expect(result).toMatchObject({
			matrixId: "matrix-1",
			state: "draft",
			status: "draft",
			approvedEntryCount: 1,
			matrixStats: {
				totalRequirements: 2,
				mandatoryCount: 1,
				compliantCount: 1,
				partialCount: 1,
			},
		});
		expect(updateSets).toEqual(expect.arrayContaining([
			expect.objectContaining({
				status: "approved",
				complianceStatus: "compliant",
				approvedBy: "compliance-lead",
				completionPercent: 100,
			}),
			expect.objectContaining({
				complianceStatus: "compliant",
				responseStrategy: "Addresses most evidence needs",
			}),
			expect.objectContaining({
				reviewedBy: "compliance-lead",
				reviewNotes: "Approve generated compliant entries with response evidence",
			}),
		]));
		const { recordWorkflowRuntimeTransition } = await import("@/lib/actions/workflow-runtime");
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				workflowKey: "compliance_matrix_bulk_entry_approval",
				eventType: "compliance_matrix_approve_ready_entries",
				actionUrl: "/opportunities/opp-1/requirements",
				metadata: expect.objectContaining({
					approvedEntryCount: 1,
				}),
			}),
			dbMock
		);
	});

	it("locks a compliant matrix and records final lock workflow", async () => {
		let matrixUpdate: Record<string, unknown> | undefined;
		let matrixWhere: unknown;
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [baseMatrix],
				onWhere: (value) => {
					matrixWhere = value;
				},
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					entry: {
						...baseEntry,
						status: "approved",
						complianceStatus: "compliant",
					},
					requirement: baseRequirement,
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					entry: {
						...baseEntry,
						status: "approved",
						complianceStatus: "compliant",
					},
					requirement: baseRequirement,
				}],
			}));
		dbMock.update
			.mockReturnValueOnce(createChain({
				onSet: (value) => {
					matrixUpdate = value;
				},
			}))
			.mockReturnValueOnce(createChain());

		const result = await transitionComplianceMatrixWorkflow({
			matrixId: "matrix-1",
			action: "lock_final",
			reason: "All mandatory entries approved",
		});

		expect(result).toMatchObject({
			matrixId: "matrix-1",
			state: "locked",
			status: "final",
			blockers: [],
			matrixStats: {
				totalRequirements: 1,
				mandatoryCount: 1,
				compliantCount: 1,
				complianceScore: 100,
				mandatoryComplianceScore: 100,
			},
		});
		expect(matrixUpdate).toMatchObject({
			status: "final",
			approvedBy: "compliance-lead",
			reviewNotes: "All mandatory entries approved",
		});
		expect(collectSqlFragments(matrixWhere).join(" ")).toContain("organization_id");
		expect((matrixUpdate?.metadata as any).complianceMatrixWorkflow).toMatchObject({
			state: "locked",
			reason: "All mandatory entries approved",
		});
		const { recordWorkflowRuntimeTransition } = await import("@/lib/actions/workflow-runtime");
		expect(recordWorkflowRuntimeTransition).toHaveBeenCalledWith(
			expect.objectContaining({
				actionUrl: "/opportunities/opp-1/requirements",
			}),
			dbMock
		);
	});
});
