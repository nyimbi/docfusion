import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const completeMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

const opportunityId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema-past-performance", () => ({
	projects: {},
	projectRelevanceScores: {},
}));
vi.mock("@/lib/db/schema", () => ({
	opportunities: {},
}));
vi.mock("@/lib/db/schema-rfp", () => ({
	rfpRequirements: {},
}));
vi.mock("@/lib/ai/client", () => ({
	complete: completeMock,
}));
vi.mock("@/lib/utils/logger", () => ({
	logger: {
		error: vi.fn(),
	},
}));
vi.mock("next/cache", () => ({
	revalidatePath: revalidatePathMock,
}));

import {
	analyzePortfolioGaps,
	calculateRelevanceScores,
	checkReferenceAvailability,
	createProject,
	deleteProject,
	duplicateProject,
	exportPastPerformanceVolume,
	generateBriefDescription,
	generateCPARNarrative,
	generateRelevanceMatrix,
	generateRelevanceNarrative,
	getPastPerformanceAnalytics,
	getProject,
	importProjectFromCPARS,
	searchProjects,
	suggestProjects,
	updateProject,
} from "@/lib/actions/past-performance";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("past performance action auth", () => {
	it("rejects unauthenticated past-performance actions before database, AI, or revalidation access", async () => {
		await expect(createProject({
			name: "Health systems implementation",
			customerName: "Ministry of Health",
			primeOrSub: "prime",
			referenceStatus: "available",
		})).rejects.toThrow("Unauthorized");
		await expect(updateProject(projectId, { description: "Updated" })).rejects.toThrow("Unauthorized");
		await expect(deleteProject(projectId)).rejects.toThrow("Unauthorized");
		await expect(duplicateProject(projectId)).rejects.toThrow("Unauthorized");
		await expect(searchProjects({ limit: 50, offset: 0 })).rejects.toThrow("Unauthorized");
		await expect(getProject(projectId)).rejects.toThrow("Unauthorized");

		await expect(calculateRelevanceScores(opportunityId)).rejects.toThrow("Unauthorized");
		await expect(generateRelevanceMatrix({
			opportunityId,
			projectIds: [projectId],
		})).rejects.toThrow("Unauthorized");
		await expect(suggestProjects(opportunityId)).rejects.toThrow("Unauthorized");

		await expect(generateCPARNarrative(projectId)).rejects.toThrow("Unauthorized");
		await expect(generateBriefDescription(projectId)).rejects.toThrow("Unauthorized");
		await expect(generateRelevanceNarrative(projectId, opportunityId)).rejects.toThrow("Unauthorized");

		await expect(checkReferenceAvailability(projectId)).rejects.toThrow("Unauthorized");
		await expect(importProjectFromCPARS({
			contractNumber: "CPARS-1",
			evaluationPeriod: { start: "2025-01-01", end: "2025-12-31" },
			ratings: { quality: 4, schedule: 4, cost: 4, management: 4 },
			narratives: { quality: "Strong quality" },
		})).rejects.toThrow("Unauthorized");
		await expect(exportPastPerformanceVolume(opportunityId, "docx")).rejects.toThrow("Unauthorized");
		await expect(getPastPerformanceAnalytics()).rejects.toThrow("Unauthorized");
		await expect(analyzePortfolioGaps(opportunityId)).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
		expect(completeMock).not.toHaveBeenCalled();
		expect(revalidatePathMock).not.toHaveBeenCalled();
	});
});
