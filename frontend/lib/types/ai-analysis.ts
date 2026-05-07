import { z } from "zod";

const aiAnalysisV1 = z.object({
	version: z.literal("1"),
	summary: z.string(),
	riskFactors: z.array(z.string()).default([]),
	suggestedApproach: z.string().optional(),
	ambiguityFlags: z
		.array(z.object({ requirementId: z.string(), reason: z.string() }))
		.default([]),
	extractedAt: z.string().datetime(),
});

export const aiAnalysisSchema = z.discriminatedUnion("version", [aiAnalysisV1]);

export type AiAnalysis = z.infer<typeof aiAnalysisSchema>;
export type AiAnalysisV1 = z.infer<typeof aiAnalysisV1>;

export function parseAiAnalysis(value: unknown): AiAnalysis | null {
	if (value === null || value === undefined) return null;
	return aiAnalysisSchema.parse(value);
}
