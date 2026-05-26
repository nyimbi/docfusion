import { beforeEach, describe, expect, it, vi } from "vitest";

const requireTenantContextMock = vi.hoisted(() => vi.fn());
const dbAccessMock = vi.hoisted(() => vi.fn());
const promptMock = vi.hoisted(() => vi.fn());
const getProviderManagerMock = vi.hoisted(() => vi.fn());
const getCompanyCapabilitiesMock = vi.hoisted(() => vi.fn());
const blockedDb = vi.hoisted(() => new Proxy({}, {
	get() {
		dbAccessMock();
		throw new Error("database should not be touched before auth");
	},
}));

vi.mock("@/lib/auth/tenant-context", () => ({
	requireTenantContext: requireTenantContextMock,
}));
vi.mock("@/lib/db", () => ({
	db: blockedDb,
}));
vi.mock("@/lib/db/schema", () => ({
	opportunityAIScores: {},
	opportunities: {},
}));
vi.mock("@/lib/ai/providers", () => ({
	prompt: promptMock,
	getProviderManager: getProviderManagerMock,
}));
vi.mock("@/lib/actions/company-settings", () => ({
	getCompanyCapabilities: getCompanyCapabilitiesMock,
}));
vi.mock("@/lib/utils/logger", () => ({
	logger: {
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

import {
	calculateAllScores,
	calculateAllScoresWithLLM,
	calculateFitScore,
	calculateFitScoreWithLLM,
	calculateRiskScore,
	calculateRiskScoreWithLLM,
	calculateWinProbability,
	calculateWinProbabilityWithLLM,
	generateOpportunitySummary,
	getAIScore,
	getAIScoreHistory,
	getLatestScores,
} from "@/lib/actions/opportunity-ai";

beforeEach(() => {
	vi.clearAllMocks();
	requireTenantContextMock.mockRejectedValue(new Error("Unauthorized"));
});

describe("opportunity AI action auth", () => {
	it("rejects unauthenticated opportunity AI actions before database or provider access", async () => {
		await expect(calculateFitScore("opp-1")).rejects.toThrow("Unauthorized");
		await expect(calculateWinProbability("opp-1")).rejects.toThrow("Unauthorized");
		await expect(calculateRiskScore("opp-1")).rejects.toThrow("Unauthorized");
		await expect(calculateAllScores("opp-1")).rejects.toThrow("Unauthorized");
		await expect(getLatestScores("opp-1")).rejects.toThrow("Unauthorized");
		await expect(getAIScoreHistory("opp-1")).rejects.toThrow("Unauthorized");
		await expect(getAIScore("score-1")).rejects.toThrow("Unauthorized");
		await expect(calculateFitScoreWithLLM("opp-1")).rejects.toThrow("Unauthorized");
		await expect(calculateWinProbabilityWithLLM("opp-1")).rejects.toThrow("Unauthorized");
		await expect(calculateRiskScoreWithLLM("opp-1")).rejects.toThrow("Unauthorized");
		await expect(calculateAllScoresWithLLM("opp-1")).rejects.toThrow("Unauthorized");
		await expect(generateOpportunitySummary("opp-1")).rejects.toThrow("Unauthorized");

		expect(dbAccessMock).not.toHaveBeenCalled();
		expect(promptMock).not.toHaveBeenCalled();
		expect(getProviderManagerMock).not.toHaveBeenCalled();
		expect(getCompanyCapabilitiesMock).not.toHaveBeenCalled();
	});
});
