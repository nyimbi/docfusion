import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth-utils", () => ({
	getCurrentUserId: getCurrentUserIdMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema", () => ({
	documents: {},
	documentVersions: {},
}));
vi.mock("@/lib/db/schema-additions", () => ({
	qualityAssessments: {},
}));
vi.mock("@/lib/ai/quality-assessment", () => ({
	runQualityAssessment: vi.fn(),
	compareAssessments: vi.fn(),
	generateSummaryReport: vi.fn(),
	getPriorityCounts: vi.fn(),
	getScoreLevel: vi.fn(),
	getScoreColor: vi.fn(),
	getScoreBgColor: vi.fn(),
	QUALITY_FACTORS: [],
}));
vi.mock("@/lib/utils/logger", () => ({
	logger: {
		error: vi.fn(),
	},
}));

import {
	compareQualityAssessments,
	deleteQualityAssessment,
	generateQualityReport,
	getQualityAssessment,
	getQualityAssessmentHistory,
	getQualityFactors,
	getQualityMetrics,
	triggerQualityAssessment,
} from "@/lib/actions/quality-assessment";

beforeEach(() => {
	vi.clearAllMocks();
	getCurrentUserIdMock.mockResolvedValue(null);
});

describe("quality assessment action auth", () => {
	it("rejects unauthenticated quality assessment actions before database access", async () => {
		await expect(triggerQualityAssessment("doc-1")).rejects.toThrow("Unauthorized");
		await expect(getQualityAssessment("doc-1")).rejects.toThrow("Unauthorized");
		await expect(getQualityAssessmentHistory("doc-1")).rejects.toThrow("Unauthorized");
		await expect(compareQualityAssessments("doc-1", "assessment-1")).rejects.toThrow("Unauthorized");
		await expect(generateQualityReport("doc-1")).rejects.toThrow("Unauthorized");
		await expect(getQualityMetrics("doc-1")).rejects.toThrow("Unauthorized");
		await expect(getQualityFactors()).rejects.toThrow("Unauthorized");
		await expect(deleteQualityAssessment("assessment-1")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
	});
});
