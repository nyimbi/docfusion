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

	// Cross-side contract: the same fixture file is parsed by both TS and
	// Python (tests/ci/test_ai_analysis_schema.py). If either side rejects
	// the bytes, the contract has drifted.
	it("accepts the shared cross-side fixture", async () => {
		const fs = await import("node:fs");
		const path = await import("node:path");
		const fixturePath = path.resolve(__dirname, "../../../examples/ai-analysis-v1-fixture.json");
		const payload = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
		const parsed = aiAnalysisSchema.parse(payload);
		expect(parsed.version).toBe("1");
		if (parsed.version === "1") {
			expect(parsed.riskFactors).toHaveLength(2);
			expect(parsed.ambiguityFlags).toHaveLength(2);
		}
	});
});
