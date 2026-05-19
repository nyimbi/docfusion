import { beforeEach, describe, expect, test, vi } from "vitest";

const requireUserContextMock = vi.hoisted(() => vi.fn());

const sessionOrganizationId = "11111111-1111-1111-1111-111111111111";
const otherOrganizationId = "22222222-2222-2222-2222-222222222222";
const opportunityId = "33333333-3333-3333-3333-333333333333";
const debriefId = "44444444-4444-4444-4444-444444444444";
const competitorId = "55555555-5555-5555-5555-555555555555";

const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
}));

vi.mock("@/lib/auth-utils", () => ({
	requireUserContext: requireUserContextMock,
}));

vi.mock("@/lib/db", () => ({
	db: dbMock,
}));

vi.mock("@/lib/utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/ai/providers", () => ({
	getProviderManager: vi.fn(() => ({
		initialize: vi.fn(),
		isAvailable: vi.fn(async () => false),
		complete: vi.fn(async () => ({ content: "[]" })),
	})),
}));

vi.mock("@/lib/db/schema-winloss", () => ({
	debriefs: {
		id: "debriefs.id",
		opportunityId: "debriefs.opportunityId",
		organizationId: "debriefs.organizationId",
		outcome: "debriefs.outcome",
		createdAt: "debriefs.createdAt",
	},
	winLossPatterns: {
		id: "winLossPatterns.id",
		organizationId: "winLossPatterns.organizationId",
		patternType: "winLossPatterns.patternType",
		isActive: "winLossPatterns.isActive",
		confidence: "winLossPatterns.confidence",
		occurrenceCount: "winLossPatterns.occurrenceCount",
	},
	proposalROI: {
		id: "proposalROI.id",
		organizationId: "proposalROI.organizationId",
	},
}));

vi.mock("@/lib/db/schema", () => ({
	opportunities: {
		id: "opportunities.id",
		title: "opportunities.title",
		organization: "opportunities.organization",
	},
	companySettings: {
		id: "companySettings.id",
	},
}));

vi.mock("@/lib/db/schema-competitors", () => ({
	competitors: {
		id: "competitors.id",
		organizationId: "competitors.organizationId",
	},
	competitorOpportunities: {
		opportunityId: "competitorOpportunities.opportunityId",
		competitorId: "competitorOpportunities.competitorId",
	},
}));

import {
	calculateProposalROI,
	compareToCompetitors,
	createDebrief,
	getPatterns,
	listDebriefs,
	updateDebrief,
} from "@/lib/actions/winloss";

beforeEach(() => {
	vi.clearAllMocks();
	requireUserContextMock.mockResolvedValue({
		userId: "winloss-user-1",
		organizationId: sessionOrganizationId,
	});
});

describe("Win/loss action auth", () => {
	test("requires a session before listing debriefs", async () => {
		requireUserContextMock.mockRejectedValueOnce(new Error("Unauthorized"));

		const result = await listDebriefs();

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
	});

	test("rejects spoofed organization IDs before listing debriefs", async () => {
		const result = await listDebriefs({ organizationId: otherOrganizationId });

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
	});

	test("rejects spoofed organization IDs before creating debriefs", async () => {
		const result = await createDebrief({
			opportunityId,
			outcome: "loss",
			organizationId: otherOrganizationId,
		});

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	test("rejects spoofed organization IDs before updating debriefs", async () => {
		const result = await updateDebrief(debriefId, {
			outcome: "win",
			organizationId: otherOrganizationId,
		});

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	test("requires a session before calculating ROI", async () => {
		requireUserContextMock.mockRejectedValueOnce(new Error("Unauthorized"));

		const result = await calculateProposalROI();

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	test("requires a session before competitor comparison", async () => {
		requireUserContextMock.mockRejectedValueOnce(new Error("Unauthorized"));

		const result = await compareToCompetitors(competitorId);

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
	});

	test("requires a session before listing patterns", async () => {
		requireUserContextMock.mockRejectedValueOnce(new Error("Unauthorized"));

		const result = await getPatterns();

		expect(result.success).toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
	});
});
