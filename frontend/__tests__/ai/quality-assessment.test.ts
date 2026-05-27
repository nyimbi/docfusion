import { describe, expect, it } from "vitest";

import {
	QUALITY_FACTORS,
	runQualityAssessment,
	type QualityAssessment,
} from "@/lib/ai/quality-assessment";

const proposalContent = `# Executive Summary

Datacraft will deliver a compliant data governance platform for the ministry. The objective is to reduce manual reporting by 35% within 6 months, improve evaluator visibility, and support procurement decision-makers with auditable evidence. According to the UNGM procurement notice [1], the client must receive secure workflow automation, analytics, and migration support. Source: https://www.ungm.org/Public/Notice/300700.

## Introduction

The solution covers intake, validation, analytics, and user adoption. First, Datacraft will profile current records and define the operating model. Therefore, the implementation team can align each requirement to a controlled workflow and measurable outcome.

## Technical Approach

| Area | Evidence |
| --- | --- |
| Security | Role-based access control and audit logs |
| Analytics | Dashboards for committee review |

- Phase 1 lasts 4 weeks and establishes the baseline.
- Phase 2 lasts 8 weeks and implements the workflow.
- Phase 3 lasts 2 weeks and supports acceptance testing.

The architecture includes integration, interoperability, metadata governance, and security controls such as encryption. These terms are defined through examples in each section so evaluators can connect the design to outcomes.

## Risk Management

The primary risk is source-data quality. Datacraft will mitigate that risk with profiling rules, an accountable owner, monitoring, escalation triggers, and contingency validation queues.

## Budget Justification

The budget includes specialist resources, migration effort, training, and value for money because each cost is based on the required level of effort and delivery schedule.

## Team Qualifications

The team includes certified data specialists, a migration expert, and personnel who delivered comparable government analytics projects in 2024.

## Conclusion

In summary, Datacraft recommends proceeding with phased implementation. Contact us to schedule the kickoff and confirm next steps.`;

function scoreSnapshot(assessment: QualityAssessment) {
	return {
		overallScore: assessment.overallScore,
		categoryScores: assessment.categoryScores.map((category) => ({
			category: category.category,
			score: category.score,
			factorCount: category.factorCount,
			issueCount: category.issueCount,
		})),
		factors: assessment.factors.map((factor) => ({
			id: factor.id,
			score: factor.score,
			actualValue: factor.actualValue,
			details: factor.details,
			issueCount: factor.issues.length,
			suggestionCount: factor.suggestions.length,
		})),
	};
}

describe("quality assessment engine", () => {
	it("produces repeatable scores for the same proposal content", () => {
		const first = runQualityAssessment("doc-1", proposalContent);
		const second = runQualityAssessment("doc-1", proposalContent);

		expect(scoreSnapshot(second)).toEqual(scoreSnapshot(first));
	});

	it("uses dedicated sentence-structure scoring instead of the deterministic fallback", () => {
		const assessment = runQualityAssessment("doc-1", proposalContent, {
			categories: ["style"],
		});

		const sentenceVariety = assessment.factors.find((factor) => factor.id === "sentence_structure_variety");

		expect(sentenceVariety).toBeDefined();
		expect(sentenceVariety?.actualValue).toMatch(/%$/);
		expect(sentenceVariety?.details).toContain("Sentence length variation");
		expect(sentenceVariety?.actualValue).not.toBe("Deterministic baseline");
	});

	it("scores fact and source credibility from evidence signals without placeholder values", () => {
		const withSources = runQualityAssessment("doc-1", proposalContent, {
			categories: ["content"],
		});
		const withoutSources = runQualityAssessment("doc-2", "We will deliver a useful platform with strong outcomes.", {
			categories: ["content"],
		});

		const sourcedFactAccuracy = withSources.factors.find((factor) => factor.id === "fact_accuracy");
		const unsourcedFactAccuracy = withoutSources.factors.find((factor) => factor.id === "fact_accuracy");
		const sourcedCredibility = withSources.factors.find((factor) => factor.id === "source_credibility");

		expect(sourcedFactAccuracy?.actualValue).toContain("verification signals");
		expect(sourcedFactAccuracy?.actualValue).not.toContain("placeholder");
		expect(sourcedCredibility?.actualValue).toContain("source specificity signals");
		expect(sourcedCredibility?.actualValue).not.toContain("placeholder");
		expect(sourcedFactAccuracy?.score).toBeGreaterThan(unsourcedFactAccuracy?.score ?? 100);
	});

	it("uses the first substantive paragraph for key-message clarity after markdown headings", () => {
		const assessment = runQualityAssessment("doc-1", proposalContent, {
			categories: ["content"],
		});

		const keyMessage = assessment.factors.find((factor) => factor.id === "key_message_clarity");

		expect(keyMessage?.actualValue).not.toBe("0 opening message signals");
		expect(keyMessage?.issues.map((issue) => issue.message).join("\n")).not.toContain("Opening paragraph does not clearly state");
	});

	it("counts sentence-start named-source citations for source credibility", () => {
		const assessment = runQualityAssessment(
			"doc-1",
			"According to Gartner, public sector analytics programmes need named ownership and measurable adoption evidence.",
			{ categories: ["content"] }
		);

		const credibility = assessment.factors.find((factor) => factor.id === "source_credibility");

		expect(credibility?.score).toBeGreaterThan(45);
		expect(credibility?.actualValue).toContain("source specificity signals");
		expect(credibility?.issues.map((issue) => issue.message).join("\n")).not.toContain("Sources are not specific enough");
	});

	it("keeps factor definitions and measured values free of placeholder quality claims", () => {
		const assessment = runQualityAssessment("doc-1", proposalContent);

		expect(QUALITY_FACTORS.map((factor) => factor.description).join("\n")).not.toMatch(/placeholder/i);
		expect(assessment.factors.map((factor) => String(factor.actualValue ?? "")).join("\n")).not.toMatch(/placeholder|Auto-assessed/i);
	});
});
