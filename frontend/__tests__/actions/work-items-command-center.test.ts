import { beforeEach, describe, expect, it, vi } from "vitest";

const viewerScopeMock = vi.hoisted(() => vi.fn());
const getOpportunityMock = vi.hoisted(() => vi.fn());
const listTasksMock = vi.hoisted(() => vi.fn());
const getWorkflowDashboardMock = vi.hoisted(() => vi.fn());
const getOpportunityDocumentsMock = vi.hoisted(() => vi.fn());

interface ChainConfig {
	result?: unknown[];
	onWhere?: (value: unknown) => void;
}

function createChain(config: ChainConfig = {}) {
	const chain: Record<string, any> = {};
	for (const method of ["from", "orderBy", "limit"]) {
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
	};
	return { db: dbMock };
});

vi.mock("@/lib/workflows/viewer-scope", () => ({
	getWorkflowViewerScopeFromSession: viewerScopeMock,
}));

vi.mock("@/lib/actions/opportunities", () => ({
	getOpportunity: getOpportunityMock,
}));

vi.mock("@/lib/actions/task-management", () => ({
	listAllTasks: vi.fn(),
	listTasks: listTasksMock,
}));

vi.mock("@/lib/services/rfp-document-service", () => ({
	getOpportunityDocuments: getOpportunityDocumentsMock,
}));

vi.mock("@/lib/actions/workflow-runtime", () => ({
	deliverWorkflowNotifications: vi.fn(),
	getWorkflowDashboard: getWorkflowDashboardMock,
}));

vi.mock("@/lib/actions/user-settings", () => ({
	getUserPreferences: vi.fn(async () => ({ notifications: null })),
	updateNotificationPreferences: vi.fn(),
}));

import { getOpportunityCommandCenterProjection } from "@/lib/actions/work-items";

const highRiskClaim = {
	id: "claim-1",
	documentId: "doc-1",
	sectionId: null,
	opportunityId: "opp-1",
	claimText: "Datacraft will deliver flawless integration outcomes without transition risk.",
	claimType: "performance",
	claimLocation: null,
	hasEvidence: false,
	evidenceStrength: "none",
	linkedEvidenceIds: [],
	suggestedEvidence: [],
	quantificationSuggestion: "Add programme metrics.",
	riskLevel: "high",
	evaluatorImpact: "Evaluator may discount unsupported absolute delivery claims.",
	status: "open",
	resolution: null,
	resolvedBy: null,
	resolvedAt: null,
	resolutionNotes: null,
	analyzedAt: new Date("2026-05-03T00:00:00.000Z"),
	createdAt: new Date("2026-05-03T00:00:00.000Z"),
};

beforeEach(() => {
	vi.clearAllMocks();
	viewerScopeMock.mockResolvedValue({
		userId: "proposal-manager-1",
		organizationId: "org-1",
		isGlobalWorkflowViewer: false,
	});
	getOpportunityMock.mockResolvedValue({
		id: "opp-1",
		assignedTo: "proposal-manager-1",
		deadline: null,
	});
	listTasksMock.mockResolvedValue({ data: [] });
	getWorkflowDashboardMock.mockResolvedValue({
		items: [],
		total: 0,
		active: 0,
		breached: 0,
		escalated: 0,
		completed: 0,
	});
	getOpportunityDocumentsMock.mockResolvedValue([]);
	dbMock.select.mockReset();
});

describe("opportunity command center projection", () => {
	it("projects unresolved high-risk claims as readiness blockers", async () => {
		let claimWhere: unknown;
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [highRiskClaim],
				onWhere: (value) => {
					claimWhere = value;
				},
			}))
			.mockReturnValueOnce(createChain({ result: [] }));

		const projection = await getOpportunityCommandCenterProjection("opp-1");

		expect(projection.readiness.label).toBe("blocked");
		expect(projection.blockers).toContainEqual(expect.objectContaining({
			id: "claim:claim-1",
			label: "High-risk unsupported claim requires remediation",
			severity: "critical",
			owner: "proposal_writer",
			actionUrl: "/documents/doc-1",
		}));
		expect(projection.nextActions).toContainEqual(expect.objectContaining({
			id: "claim:claim-1",
			source: "claim_analysis",
		}));
		expect(projection.readinessDimensions).toContainEqual(expect.objectContaining({
			key: "evidence",
			status: "block",
			blockerCount: 1,
			owner: "proposal_writer",
			actionUrl: "/documents/doc-1",
		}));
		const claimSql = collectSqlFragments(claimWhere).join(" ");
		expect(claimSql).toContain("opportunities.organization_id");
		expect(claimSql).toContain("org-1");
		expect(claimSql).toContain("opportunities.assigned_to");
		expect(claimSql).toContain("proposal-manager-1");
	});

	it("does not project resolved high-risk claims as blockers", async () => {
		dbMock.select
			.mockReturnValueOnce(createChain({
				result: [{ ...highRiskClaim, status: "resolved", resolution: "evidence_added" }],
			}))
			.mockReturnValueOnce(createChain({ result: [] }));

		const projection = await getOpportunityCommandCenterProjection("opp-1");

		expect(projection.blockers).not.toContainEqual(expect.objectContaining({
			id: "claim:claim-1",
		}));
		expect(projection.readiness.label).toBe("ready");
	});
});
