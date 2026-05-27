import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
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
	query: {
		rfpRequirements: {
			findFirst: ReturnType<typeof vi.fn>;
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
		query: {
			rfpRequirements: {
				findFirst: vi.fn(),
			},
		},
	},
}));

import { suggestCrossReferenceLocations } from "@/lib/actions/compliance-validator";

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
});
