import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: vi.fn(async () => ({ userId: "compliance-lead" })),
}));

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "innerJoin", "leftJoin", "where", "limit", "orderBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.set = vi.fn((value: Record<string, unknown>) => {
		config.onSet?.(value);
		return chain;
	});
	chain.returning = vi.fn(async () => config.result ?? []);
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

var dbMock: any;

vi.mock("@/lib/db", () => {
	dbMock = {
		select: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
		execute: vi.fn(async () => []),
		transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(dbMock)),
	};
	return { db: dbMock };
});

import { transitionComplianceEntryWorkflow } from "@/lib/actions/compliance-validator";

const baseEntry: Record<string, any> = {
	id: "entry-1",
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
	priority: "mandatory",
};

function mockEntryLookup(entry = baseEntry, requirement = baseRequirement) {
	dbMock.select
		.mockReturnValueOnce(createChain({
			result: [{ entry, requirement }],
		}))
		.mockReturnValueOnce(createChain({
			result: [
				{ entry: { complianceStatus: "compliant" }, requirement: { priority: "mandatory" } },
				{ entry: { complianceStatus: "partial" }, requirement: { priority: "mandatory" } },
				{ entry: { complianceStatus: "non_compliant" }, requirement: { priority: "optional" } },
			],
		}));
}

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => fn(dbMock));
	dbMock.execute.mockResolvedValue([]);
});

describe("compliance entry workflow", () => {
	it("approves a reviewed entry and recalculates matrix statistics", async () => {
		let entryUpdate: Record<string, unknown> | undefined;
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
			complianceStatus: "partial",
			matrixStats: {
				totalRequirements: 3,
				mandatoryCount: 2,
				compliantCount: 1,
				partialCount: 1,
				nonCompliantCount: 1,
				notAddressedCount: 0,
				complianceScore: 50,
				mandatoryComplianceScore: 75,
			},
		});
		expect(entryUpdate).toMatchObject({
			status: "approved",
			approvedBy: "compliance-lead",
			completionPercent: 100,
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
			complianceScore: 50,
			mandatoryComplianceScore: 75,
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
});
