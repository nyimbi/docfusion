import { describe, it, expect } from "vitest";
import {
	aiAnalysisSchema,
	parseAiAnalysis,
	type AiAnalysis,
} from "@/lib/types/ai-analysis";

describe("aiAnalysis schema v1", () => {
	it("accepts a valid v1 payload", () => {
		const valid: AiAnalysis = {
			version: "1",
			summary: "10 mandatory requirements detected",
			riskFactors: ["unfunded scope", "unclear evaluation criteria"],
			suggestedApproach: "Prioritize Section L compliance",
			ambiguityFlags: [{ requirementId: "r1", reason: "no metric" }],
			extractedAt: "2026-05-08T00:00:00Z",
		};
		expect(aiAnalysisSchema.parse(valid)).toEqual(valid);
	});

	it("rejects an unversioned payload", () => {
		expect(() => aiAnalysisSchema.parse({ summary: "..." })).toThrow();
	});

	it("rejects an unknown version", () => {
		expect(() =>
			aiAnalysisSchema.parse({ version: "99", summary: "..." }),
		).toThrow();
	});

	it("parseAiAnalysis returns null for null input", () => {
		expect(parseAiAnalysis(null)).toBeNull();
	});

	it("parseAiAnalysis throws on garbage", () => {
		expect(() => parseAiAnalysis({ random: "stuff" })).toThrow();
	});
});
