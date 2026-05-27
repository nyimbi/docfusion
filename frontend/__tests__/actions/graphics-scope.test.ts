import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const aiCompleteMock = vi.hoisted(() =>
	vi.fn(async () => ({ content: "not json" }))
);

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "innerJoin", "limit", "orderBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.where = vi.fn((value: unknown) => {
		config.onWhere?.(value);
		return chain;
	});
	chain.set = vi.fn(() => chain);
	chain.values = vi.fn(() => chain);
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

var dbMock: {
	select: ReturnType<typeof vi.fn>;
	insert: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock = {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("next/cache", () => ({
	revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

vi.mock("@/lib/ai/providers", () => ({
	getProviderManager: vi.fn(() => ({
		complete: aiCompleteMock,
	})),
}));

import {
	createGraphic,
	exportGraphics,
	generateActionCaption,
	generateProcessFlow,
	listGraphics,
	recordGraphicFeedback,
	searchGraphics,
	suggestGraphics,
	updateGraphic,
	validateGraphicConsistency,
} from "@/lib/actions/graphics";

const opportunityId = "33333333-3333-4333-8333-333333333333";
const graphicId = "44444444-4444-4444-8444-444444444444";
const sectionId = "55555555-5555-4555-8555-555555555555";
const proposalDocumentId = "66666666-6666-4666-8666-666666666666";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "graphics-user-1",
		organizationId: "11111111-1111-4111-8111-111111111111",
	});
});

describe("graphics opportunity scoping", () => {
	function expectAssignedOpportunityTenantScope(where: unknown) {
		const sqlText = collectSqlFragments(where).join(" ");
		expect(sqlText).toContain("opportunities.assigned_to");
		expect(sqlText).toContain("graphics-user-1");
		expect(sqlText).toContain("opportunities.organization_id");
		expect(sqlText).toContain("11111111-1111-4111-8111-111111111111");
	}

	it("checks opportunity assignment before creating opportunity-linked graphics", async () => {
		let opportunityWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				opportunityWhere = value;
			},
		}));

		const result = await createGraphic({
			opportunityId,
			title: "Transition plan",
			graphicType: "diagram",
			format: "mermaid",
		});

		expect(result).toMatchObject({ success: false });
		expect(dbMock.insert).not.toHaveBeenCalled();
		expectAssignedOpportunityTenantScope(opportunityWhere);
	});

	it("scopes opportunity graphic lists through assignment", async () => {
		let listWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				listWhere = value;
			},
		}));

		const result = await listGraphics(opportunityId);

		expect(result).toMatchObject({ success: true, data: [] });
		expectAssignedOpportunityTenantScope(listWhere);
	});

	it.each([
		["zip", "data:application/zip;base64,", "PK"],
		["pdf", "data:application/pdf;base64,", "%PDF-"],
	] as const)("generates a real %s graphics export artifact", async (format, expectedPrefix, expectedSignature) => {
		const graphic = {
			id: graphicId,
			opportunityId,
			title: "Implementation Flow",
			figureNumber: "Figure 1",
			graphicType: "process_flow",
			format: "mermaid",
			diagramCode: "graph TD\nA[Start] --> B[Delivery]",
			imageUrl: null,
			sourceData: null,
			caption: "Implementation flow",
			actionCaption: "Show the delivery flow",
			status: "approved",
		};
		dbMock.select.mockReturnValueOnce(createChain({ result: [graphic] }));
		dbMock.insert.mockReturnValueOnce(createChain());

		const result = await exportGraphics(opportunityId, format);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.downloadUrl).toMatch(new RegExp(`^${expectedPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
		expect(result.data.downloadUrl).not.toContain("/api/exports/graphics");
		const encoded = result.data.downloadUrl.split(",")[1] ?? "";
		expect(Buffer.from(encoded, "base64").toString("latin1").startsWith(expectedSignature)).toBe(true);
		expect(dbMock.insert).toHaveBeenCalled();
	});

	it("scopes single-graphic updates through the owning opportunity", async () => {
		let updateWhere: unknown;
		dbMock.update.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				updateWhere = value;
			},
		}));

		const result = await updateGraphic(graphicId, { title: "Updated graphic" });

		expect(result).toMatchObject({ success: false, error: "Graphic not found" });
		expectAssignedOpportunityTenantScope(updateWhere);
	});

	it("scopes consistency validation to assigned opportunities", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({ result: [] }))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({ result: [] }));

		const result = await validateGraphicConsistency(opportunityId);

		expect(result).toMatchObject({
			success: true,
			data: { totalGraphics: 0 },
		});
		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			expectAssignedOpportunityTenantScope(where);
		}
	});

	it("scopes search results to visible graphics", async () => {
		let searchWhere: unknown;
		const lowLimitChain = createChain({
			result: [],
			onWhere: (value) => {
				searchWhere = value;
			},
		});
		const highLimitChain = createChain({ result: [] });
		dbMock.select
			.mockReturnValueOnce(lowLimitChain)
			.mockReturnValueOnce(highLimitChain);

		const result = await searchGraphics("transition", -10);
		const highLimitResult = await searchGraphics("transition", 2500);

		expect(result).toMatchObject({ success: true, data: [] });
		expect(highLimitResult).toMatchObject({ success: true, data: [] });
		expect(lowLimitChain.limit).toHaveBeenCalledWith(1);
		expect(highLimitChain.limit).toHaveBeenCalledWith(1000);
		expectAssignedOpportunityTenantScope(searchWhere);
	});

	it("checks source graphic visibility before recording feedback", async () => {
		let graphicWhere: unknown;
		dbMock.select.mockReturnValueOnce(createChain({
			result: [],
			onWhere: (value) => {
				graphicWhere = value;
			},
		}));

		const result = await recordGraphicFeedback(graphicId, "approval", "Looks good");

		expect(result).toMatchObject({ success: false });
		expect(dbMock.insert).not.toHaveBeenCalled();
		expectAssignedOpportunityTenantScope(graphicWhere);
	});

	it("scopes graphic suggestions through assigned opportunity proposal documents", async () => {
		const wheres: unknown[] = [];
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{ id: sectionId, proposalDocumentId }],
				onWhere: (value) => wheres.push(value),
			}))
			.mockReturnValueOnce(createChain({
				result: [],
				onWhere: (value) => wheres.push(value),
			}));

		const result = await suggestGraphics(sectionId);

		expect(result).toEqual({ success: false, error: "Proposal document not found" });
		expect(wheres).toHaveLength(2);
		for (const where of wheres) {
			expectAssignedOpportunityTenantScope(where);
		}
	});

	it("returns deterministic graphic suggestions when AI output is malformed", async () => {
		aiCompleteMock.mockResolvedValueOnce({ content: "not json" });
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{ id: sectionId, proposalDocumentId, sectionName: "Implementation Approach" }],
			}))
			.mockReturnValueOnce(createChain({
				result: [{ id: proposalDocumentId, documentId: "doc-1" }],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					id: "doc-1",
					plainText:
						"Implementation workflow with milestones, governance approvals, team roles, and 99.9% uptime metric.",
					content: {},
				}],
			}));

		const result = await suggestGraphics(sectionId);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data).not.toEqual([]);
		expect(result.data[0]).toMatchObject({
			graphicType: "process_flow",
			title: "Implementation Approach Process Flow",
			confidence: 0.82,
		});
		expect(result.data[0]?.suggestedDiagramCode).toContain("flowchart TD");
		expect(result.data.map((suggestion) => suggestion.graphicType)).toEqual(
			expect.arrayContaining(["schedule", "org_chart", "chart"])
		);
	});

	it("returns deterministic graphic suggestions when AI output has no usable suggestion text", async () => {
		aiCompleteMock.mockResolvedValueOnce({
			content: JSON.stringify([
				{ graphicType: "process_flow", title: "   ", rationale: "   ", confidence: 0.9 },
				{},
			]),
		});
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{ id: sectionId, proposalDocumentId, sectionName: "Implementation Approach" }],
			}))
			.mockReturnValueOnce(createChain({
				result: [{ id: proposalDocumentId, documentId: "doc-1" }],
			}))
			.mockReturnValueOnce(createChain({
				result: [{
					id: "doc-1",
					plainText:
						"Implementation workflow with milestones, governance approvals, team roles, and 99.9% uptime metric.",
					content: {},
				}],
			}));

		const result = await suggestGraphics(sectionId);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data).not.toEqual([]);
		expect(result.data[0]).toMatchObject({
			graphicType: "process_flow",
			title: "Implementation Approach Process Flow",
			confidence: 0.82,
		});
		expect(result.data[0]?.rationale).toContain("process graphic");
	});

	it("generates a deterministic process flow when AI output has no diagram", async () => {
		aiCompleteMock.mockResolvedValueOnce({ content: "not a diagram" });

		const result = await generateProcessFlow(
			"Receive intake request. Validate requirements. Assign delivery team. Report completion."
		);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.diagramCode).toContain("flowchart TD");
		expect(result.data.diagramCode).toContain("Receive intake request");
		expect(result.data.diagramCode).toContain("S1 --> S2");
		expect(result.data.suggestedCaption).toContain("4-step");
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("generates a deterministic action caption when AI is unavailable", async () => {
		aiCompleteMock.mockRejectedValueOnce(new Error("provider unavailable"));
		const updateChain = createChain();
		dbMock.select.mockReturnValueOnce(createChain({
			result: [{
				id: graphicId,
				title: "Implementation Workflow",
				graphicType: "process_flow",
				caption: "Implementation workflow from intake through delivery",
				diagramCode: "flowchart TD\nA[Intake] --> B[Delivery]",
				actionCaption: null,
				opportunityId,
			}],
		}));
		dbMock.update.mockReturnValueOnce(updateChain);

		const result = await generateActionCaption(graphicId);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data).toContain("Maps implementation workflow from intake through delivery");
		expect(result.data).toContain("ordered delivery approach");
		expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
			actionCaption: result.data,
		}));
		expect(revalidatePathMock).toHaveBeenCalledWith("/opportunities");
		expect(revalidatePathMock).toHaveBeenCalledWith("/documents");
	});
});
