import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onSet?: (value: Record<string, unknown>) => void;
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "innerJoin", "leftJoin", "limit"]) {
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
	chain.then = (resolve: (value: unknown[]) => void) =>
		Promise.resolve(config.result ?? []).then(resolve);
	return chain;
}

function collectSqlFragments(value: unknown, seen = new Set<object>()): string[] {
	if (typeof value === "string") return [value];
	if (!value || typeof value !== "object") return [];
	if (seen.has(value)) return [];
	seen.add(value);
	if (Array.isArray(value)) return value.flatMap((item) => collectSqlFragments(item, seen));
	return Reflect.ownKeys(value).flatMap((key) =>
		collectSqlFragments((value as Record<PropertyKey, unknown>)[key], seen)
	);
}

var dbMock: {
	select: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	query: {
		complianceMatrices: {
			findFirst: ReturnType<typeof vi.fn>;
		};
		rfpRequirements: {
			findFirst: ReturnType<typeof vi.fn>;
			findMany: ReturnType<typeof vi.fn>;
		};
	};
};

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
	userHasAuthorityRole: vi.fn(() => true),
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	recordWorkflowRuntimeTransition: vi.fn(),
	upsertWorkflowRuntimeTask: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		update: vi.fn(),
		query: {
			complianceMatrices: {
				findFirst: vi.fn(),
			},
			rfpRequirements: {
				findFirst: vi.fn(),
				findMany: vi.fn(),
			},
		},
	},
}));

import {
	autoLinkRequirements,
	detectMissingCrossReferences,
	detectOverReferences,
	suggestCrossReferenceLocations,
} from "@/lib/actions/compliance-validator";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "compliance-user-1",
		organizationId: "org-1",
		roles: ["compliance_officer"],
	});
	dbMock.query.rfpRequirements.findFirst.mockResolvedValue({
		id: "req-1",
		organizationId: "org-1",
		opportunityId: "opp-1",
		requirementNumber: "C.3.2",
		requirementText: "The contractor shall provide cybersecurity incident response monitoring and evidence reporting.",
		category: "cybersecurity",
	});
	dbMock.query.complianceMatrices.findFirst.mockResolvedValue({
		id: "matrix-1",
		organizationId: "org-1",
		opportunityId: "opp-1",
	});
	dbMock.query.rfpRequirements.findMany.mockResolvedValue([]);
	dbMock.update.mockReturnValue(createChain());
});

describe("compliance cross-reference suggestions", () => {
	it("ranks response document sections by requirement-term overlap", async () => {
		const wheres: unknown[] = [];
		dbMock.select.mockReturnValue(createChain({
			onWhere: (value) => wheres.push(value),
			result: [
				{
					documentId: "doc-technical",
					documentTitle: "Technical Approach",
					documentType: "technical_approach",
					plainText: null,
					content: {
						type: "doc",
						content: [
							{
								type: "heading",
								attrs: { level: 2 },
								content: [{ type: "text", text: "Cybersecurity Monitoring" }],
							},
							{
								type: "paragraph",
								content: [{
									type: "text",
									text: "Our incident response team provides continuous monitoring, reporting, and evidence capture.",
								}],
							},
							{
								type: "heading",
								attrs: { level: 2 },
								content: [{ type: "text", text: "Staffing" }],
							},
							{
								type: "paragraph",
								content: [{ type: "text", text: "Key personnel coverage and escalation roles." }],
							},
						],
					},
				},
				{
					documentId: "doc-management",
					documentTitle: "Management Plan",
					documentType: "management_plan",
					plainText: null,
					content: {
						type: "doc",
						content: [{
							type: "paragraph",
							content: [{ type: "text", text: "Program governance and reporting cadence." }],
						}],
					},
				},
			],
		}));

		const suggestions = await suggestCrossReferenceLocations("req-1");

		expect(suggestions[0]).toMatchObject({
			documentId: "doc-technical",
			documentTitle: "Technical Approach",
			sectionId: "doc-technical#section-1",
			sectionTitle: "Cybersecurity Monitoring",
		});
		expect(suggestions[0].relevanceScore).toBeGreaterThan(suggestions[1].relevanceScore);
		expect(suggestions[0].reason).toContain("cybersecurity");
		expect(JSON.stringify(wheres.map((where) => collectSqlFragments(where)))).toContain("org-1");
		expect(JSON.stringify(wheres.map((where) => collectSqlFragments(where)))).toContain("opp-1");
	});

	it("returns no suggestions when no response sections match the requirement", async () => {
		dbMock.select.mockReturnValue(createChain({
			result: [{
				documentId: "doc-cost",
				documentTitle: "Cost Volume",
				documentType: "cost_proposal",
				plainText: "Pricing assumptions and escalation factors.",
				content: null,
			}],
		}));

		const suggestions = await suggestCrossReferenceLocations("req-1");

		expect(suggestions).toEqual([]);
	});

	it("adds suggested response sections to missing cross-reference findings", async () => {
		dbMock.select.mockReturnValue(createChain({
			result: [{
				documentId: "doc-technical",
				documentTitle: "Technical Approach",
				documentType: "technical_approach",
				opportunityId: "opp-1",
				plainText: null,
				content: {
					type: "doc",
					content: [
						{
							type: "heading",
							content: [{ type: "text", text: "Incident Response Monitoring" }],
						},
						{
							type: "paragraph",
							content: [{
								type: "text",
								text: "Cybersecurity incident response monitoring includes evidence reporting and escalation.",
							}],
						},
					],
				},
			}],
		}));
		dbMock.query.rfpRequirements.findMany.mockResolvedValue([{
			id: "req-1",
			requirementNumber: "C.3.2",
			requirementText: "The contractor shall provide cybersecurity incident response monitoring and evidence reporting.",
			category: "cybersecurity",
			priority: "mandatory",
		}]);

		const missing = await detectMissingCrossReferences("doc-technical");

		expect(missing).toHaveLength(1);
		expect(missing[0]).toMatchObject({
			requirementId: "req-1",
			requirementNumber: "C.3.2",
			category: "cybersecurity",
			priority: "mandatory",
		});
		expect(missing[0].suggestedSections[0]).toContain("Technical Approach - Incident Response Monitoring");
		expect(missing[0].suggestedSections[0]).toContain("cybersecurity");
	});

	it("detects over-referenced requirements from scoped response document sections", async () => {
		dbMock.select.mockReturnValue(createChain({
			result: [{
				documentId: "doc-technical",
				documentTitle: "Technical Approach",
				documentType: "technical_approach",
				opportunityId: "opp-1",
				plainText: [
					"C.3.2 establishes the monitoring baseline.",
					"Our C.3.2 response includes evidence reporting.",
					"The C.3.2 workflow is staffed continuously.",
					"C.3.2 appears again in the closeout checklist.",
				].join("\n"),
				content: null,
			}],
		}));
		dbMock.query.rfpRequirements.findMany.mockResolvedValue([{
			id: "req-1",
			requirementNumber: "C.3.2",
			requirementText: "The contractor shall provide cybersecurity incident response monitoring and evidence reporting.",
			category: "cybersecurity",
			priority: "mandatory",
		}]);

		const overReferences = await detectOverReferences("doc-technical");

		expect(overReferences).toEqual([{
			requirementId: "req-1",
			requirementNumber: "C.3.2",
			referenceCount: 4,
			locations: [
				"Technical Approach - Document body",
				"Technical Approach - Document body",
				"Technical Approach - Document body",
				"Technical Approach - Document body",
			],
			recommendation: expect.stringContaining("Consolidate duplicate requirement references"),
		}]);
	});

	it("auto-links high-confidence requirement matches to response sections", async () => {
		let entryUpdate: Record<string, unknown> | undefined;
		let requirementUpdate: Record<string, unknown> | undefined;
		let matrixUpdate: Record<string, unknown> | undefined;
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{
					documentId: "doc-technical",
					documentTitle: "Technical Approach",
					documentType: "technical_approach",
					opportunityId: "opp-1",
					plainText: null,
					content: {
						type: "doc",
						content: [
							{
								type: "heading",
								content: [{ type: "text", text: "Cybersecurity Incident Response Monitoring" }],
							},
							{
								type: "paragraph",
								content: [{
									type: "text",
									text: "The C.3.2 response provides cybersecurity incident response monitoring and evidence reporting.",
								}],
							},
						],
					},
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					entry: {
						id: "entry-1",
						organizationId: "org-1",
						matrixId: "matrix-1",
						requirementId: "req-1",
						responseReference: null,
						complianceStatus: "pending",
						completionPercent: 10,
						metadata: { existing: true },
					},
					requirement: {
						id: "req-1",
						organizationId: "org-1",
						requirementNumber: "C.3.2",
						requirementText: "The contractor shall provide cybersecurity incident response monitoring and evidence reporting.",
						category: "cybersecurity",
					},
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					entry: {
						complianceStatus: "partial",
					},
					requirement: {
						priority: "mandatory",
					},
				}],
			}));
		dbMock.update
			.mockReturnValueOnce(createChain({ onSet: (value) => { entryUpdate = value; } }))
			.mockReturnValueOnce(createChain({ onSet: (value) => { requirementUpdate = value; } }))
			.mockReturnValueOnce(createChain({ onSet: (value) => { matrixUpdate = value; } }));

		const result = await autoLinkRequirements("doc-technical");

		expect(result.successfulLinks).toBe(1);
		expect(result.failedLinks).toBe(0);
		expect(result.linkedRequirements[0]).toMatchObject({
			requirementId: "req-1",
			requirementNumber: "C.3.2",
			linkedTo: "Technical Approach - Cybersecurity Incident Response Monitoring",
		});
		expect(result.linkedRequirements[0].confidence).toBeGreaterThanOrEqual(60);
		expect(entryUpdate).toMatchObject({
			responseDocumentId: "doc-technical",
			responseReference: "Technical Approach - Cybersecurity Incident Response Monitoring",
			complianceStatus: "partial",
			completionPercent: 60,
		});
		expect((entryUpdate?.metadata as Record<string, unknown>).autoLink).toMatchObject({
			documentId: "doc-technical",
			sectionTitle: "Cybersecurity Incident Response Monitoring",
			linkedBy: "compliance-user-1",
		});
		expect(requirementUpdate).toMatchObject({
			complianceStatus: "partial",
			responseDocumentId: "doc-technical",
			responseSection: "Cybersecurity Incident Response Monitoring",
		});
		expect(matrixUpdate).toMatchObject({
			totalRequirements: 1,
			mandatoryCount: 1,
			partialCount: 1,
			complianceScore: 50,
			mandatoryComplianceScore: 50,
		});
	});

	it("leaves low-confidence automatic links unmodified", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{
					documentId: "doc-management",
					documentTitle: "Management Plan",
					documentType: "management_plan",
					opportunityId: "opp-1",
					plainText: "Program governance and staffing cadence.",
					content: null,
				}],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					entry: {
						id: "entry-1",
						organizationId: "org-1",
						matrixId: "matrix-1",
						requirementId: "req-1",
						responseReference: null,
						complianceStatus: "pending",
						completionPercent: 10,
						metadata: null,
					},
					requirement: {
						id: "req-1",
						organizationId: "org-1",
						requirementNumber: "C.3.2",
						requirementText: "The contractor shall provide cybersecurity incident response monitoring and evidence reporting.",
						category: "cybersecurity",
					},
				}],
			}));

		const result = await autoLinkRequirements("doc-management");

		expect(result.successfulLinks).toBe(0);
		expect(result.failedLinks).toBe(1);
		expect(result.unlinkedRequirements[0]).toMatchObject({
			requirementId: "req-1",
			reason: "No matching response section found",
		});
		expect(dbMock.update).not.toHaveBeenCalled();
	});
});
