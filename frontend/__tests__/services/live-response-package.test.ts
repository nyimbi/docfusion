import { describe, expect, it } from "vitest";
import {
	LIVE_RESPONSE_DOCUMENT_TYPES,
	assessLiveResponsePackageReadiness,
	buildLiveResponsePackage,
	buildLiveResponseWinThemeSeeds,
	extractLiveResponseEvaluationSignals,
	extractLiveResponseRequirementSignals,
	selectLiveResponseSnippets,
} from "@/lib/services/live-response-package";
import type { OpportunityData } from "@/lib/scrapers/deduplicator";

const opportunity: OpportunityData = {
	title: "Provision of Penetration Testing Services and Security Consultancy for goAML Software product",
	organization: "UN Secretariat",
	source: "ungm",
	sourceId: "300700",
	portalUrl: "https://www.ungm.org/Public/Notice/300700",
	deadline: "2026-06-18",
	projectSummary: "Security consultancy for web applications, APIs, software risk, and audit controls.",
};

const sourceText = `
## REQUEST FOR EXPRESSION OF INTEREST
The United Nations Office requests qualified suppliers to submit an expression of interest for software security services.
## Scope of Services
The supplier must provide penetration testing for web applications and APIs.
The contractor shall deliver a security consultancy report with remediation priorities and evidence.
Offerors should describe similar experience with enterprise software platforms and regulated environments.
The response must include project management, schedule, risk controls, and quality assurance.
The financial proposal shall include all pricing assumptions, fees, and exclusions.
## Evaluation Criteria
Technical approach will be evaluated at 40 points.
Similar experience with enterprise software platforms will be evaluated at 25 points.
Project management, schedule, risk controls, and quality assurance will be evaluated at 20 points.
Financial proposal price realism will be evaluated at 15 points.
`;

describe("live response package builder", () => {
	it("extracts source requirement signals from live procurement text", () => {
		const requirements = extractLiveResponseRequirementSignals(sourceText);

		expect(requirements.length).toBeGreaterThanOrEqual(5);
		expect(requirements.map((requirement) => requirement.documentType)).toEqual(
			expect.arrayContaining([
				"technical_approach",
				"management_plan",
				"past_performance",
				"cost_proposal",
			])
		);
		expect(requirements[0]).toMatchObject({
			id: "LIVE-REQ-001",
			sourceSection: "REQUEST FOR EXPRESSION OF INTEREST",
		});
	});

	it("selects Datacraft snippets relevant to the opportunity and source text", () => {
		const snippets = selectLiveResponseSnippets(opportunity, sourceText);

		expect(snippets.length).toBeGreaterThanOrEqual(12);
		expect(snippets.map((snippet) => snippet.shortcut)).toEqual(
			expect.arrayContaining(["/dc-security", "/dc-technical"])
		);
	});

	it("extracts evaluator criteria signals from scoring sections", () => {
		const criteria = extractLiveResponseEvaluationSignals(sourceText);

		expect(criteria).toHaveLength(4);
		expect(criteria[0]).toMatchObject({
			id: "LIVE-EVAL-001",
			sourceSection: "Evaluation Criteria",
			weight: "40 points",
			documentType: "technical_approach",
		});
		expect(criteria.map((criterion) => criterion.documentType)).toEqual(
			expect.arrayContaining([
				"technical_approach",
				"past_performance",
				"management_plan",
				"cost_proposal",
			])
		);
	});

	it("builds win theme seeds from evaluator criteria", () => {
		const requirements = extractLiveResponseRequirementSignals(sourceText);
		const evaluationCriteria = extractLiveResponseEvaluationSignals(sourceText);
		const seeds = buildLiveResponseWinThemeSeeds({
			opportunity,
			requirements,
			evaluationCriteria,
			relevantSnippetShortcuts: ["/dc-security", "/dc-technical", "/dc-proof"],
		});

		expect(seeds).toHaveLength(4);
		expect(seeds[0]).toMatchObject({
			id: "LIVE-WIN-001",
			evaluationCriteriaIds: ["LIVE-EVAL-001"],
			type: "differentiator",
			priority: 1,
		});
		expect(seeds.flatMap((seed) => seed.evaluationCriteriaIds)).toEqual(
			expect.arrayContaining(["LIVE-EVAL-001", "LIVE-EVAL-002", "LIVE-EVAL-003", "LIVE-EVAL-004"])
		);
		expect(seeds[0]?.supportingEvidence).toEqual(
			expect.arrayContaining([
				expect.stringContaining("Evaluator criterion LIVE-EVAL-001"),
				expect.stringContaining("Datacraft evidence shortcut"),
			])
		);
	});

	it("builds concrete response draft documents with requirement coverage", () => {
		const responsePackage = buildLiveResponsePackage({
			opportunity,
			sourceText,
			generatedAt: new Date("2026-05-27T00:00:00.000Z"),
		});

		expect(responsePackage.documents.map((document) => document.documentType)).toEqual(LIVE_RESPONSE_DOCUMENT_TYPES);
		expect(responsePackage.requirements.length).toBeGreaterThanOrEqual(5);
		expect(responsePackage.evaluationCriteria.length).toBe(4);
		expect(responsePackage.winThemeSeeds.length).toBe(4);
		expect(responsePackage.totalWordCount).toBeGreaterThan(2000);
		expect(responsePackage.relevantSnippetCount).toBeGreaterThanOrEqual(12);
		expect(responsePackage.readiness.status).toBe("ready_for_review");
		expect(responsePackage.readiness.blockers).toEqual([]);
		expect(responsePackage.readiness.evaluationCriteriaIds).toEqual([
			"LIVE-EVAL-001",
			"LIVE-EVAL-002",
			"LIVE-EVAL-003",
			"LIVE-EVAL-004",
		]);
		expect(responsePackage.readiness.winThemeCoveredEvaluationCriteriaIds).toEqual(responsePackage.readiness.evaluationCriteriaIds);
		expect(responsePackage.readiness.missingWinThemeEvaluationCriteriaIds).toEqual([]);
		expect(responsePackage.readiness.metrics).toMatchObject({
			documentTypeCoverage: 1,
			sourceRequirementCoverage: 1,
			mandatoryRequirementCoverage: 1,
			evaluationCriteriaCoverage: 1,
			winThemeCriteriaCoverage: 1,
			evidenceCueCoverage: 1,
			reviewGateCoverage: 1,
			unresolvedPlaceholderCount: 0,
			winThemeSeedCount: 4,
		});

		for (const document of responsePackage.documents) {
			expect(document.wordCount).toBeGreaterThan(250);
			expect(document.markdown).toContain("## Source-Driven Response Plan");
			expect(document.markdown).toContain("## Evaluator Alignment Plan");
			expect(document.markdown).toContain("## Source Citation Map");
			expect(document.markdown).toContain("Source requirement LIVE-REQ-");
			expect(document.markdown).toContain("## Datacraft Evidence To Weave In");
			expect(document.markdown).not.toContain("Replace generic claims");
			expect(document.markdown).not.toMatch(/\{\{[^}]+\}\}/);
			expect(document.requirementIds).toHaveLength(new Set(document.requirementIds).size);
			expect(document.evaluationCriteriaIds).toHaveLength(new Set(document.evaluationCriteriaIds).size);
		}

		const technicalApproach = responsePackage.documents.find((document) => document.documentType === "technical_approach");
		expect(technicalApproach?.markdown).toContain("penetration testing");
		expect(technicalApproach?.markdown).toContain("LIVE-EVAL-001");
		expect(technicalApproach?.markdown).toContain("Evaluator criterion LIVE-EVAL-001 from Evaluation Criteria");
		expect(technicalApproach?.markdown).toContain("Win response:");
		expect(technicalApproach?.requirementIds.length).toBeGreaterThan(0);
		expect(technicalApproach?.evaluationCriteriaIds.length).toBeGreaterThan(0);
		expect(responsePackage.winThemeSeeds[0]?.statement).toContain("Datacraft will win");
	});

	it("adapts mandatory source signals for sections without explicit source clauses", () => {
		const eoiOnlySourceText = `
## REQUEST FOR EXPRESSION OF INTEREST
Please note that this document is solely an Expression of Interest and not a tender invitation.
Expressions of Interest shall be submitted exclusively through the United Nations Global Marketplace.
Vendors interested in participating in the planned solicitation process should submit the Vendor Response Form before the closing date.
		`;

		const responsePackage = buildLiveResponsePackage({
			opportunity,
			sourceText: eoiOnlySourceText,
			generatedAt: new Date("2026-05-27T00:00:00.000Z"),
		});

		const managementPlan = responsePackage.documents.find((document) => document.documentType === "management_plan");
		const pastPerformance = responsePackage.documents.find((document) => document.documentType === "past_performance");

		expect(managementPlan?.requirementIds.length).toBeGreaterThan(0);
		expect(pastPerformance?.requirementIds.length).toBeGreaterThan(0);
		expect(managementPlan?.markdown).toContain("Show governance, staffing, schedule control");
		expect(pastPerformance?.markdown).toContain("Map Lindela, MeGuard, and Wakala proof points");
		expect(responsePackage.readiness.warnings).not.toContain("management_plan has no directly assigned source requirement signal");
		expect(responsePackage.readiness.warnings).not.toContain("past_performance has no directly assigned source requirement signal");
	});

	it("blocks readiness when source requirements are not represented in drafts", () => {
		const responsePackage = buildLiveResponsePackage({
			opportunity,
			sourceText,
			generatedAt: new Date("2026-05-27T00:00:00.000Z"),
		});
		const brokenPackage = {
			...responsePackage,
			documents: responsePackage.documents.map((document) => ({
				...document,
				requirementIds: [],
			})),
		};

		const readiness = assessLiveResponsePackageReadiness(brokenPackage);

		expect(readiness.status).toBe("blocked");
		expect(readiness.blockers.join("\n")).toContain("source requirement signals");
		expect(readiness.metrics.sourceRequirementCoverage).toBe(0);
	});

	it("blocks readiness when evaluator criteria are not represented in drafts", () => {
		const responsePackage = buildLiveResponsePackage({
			opportunity,
			sourceText,
			generatedAt: new Date("2026-05-27T00:00:00.000Z"),
		});
		const brokenPackage = {
			...responsePackage,
			documents: responsePackage.documents.map((document) => ({
				...document,
				evaluationCriteriaIds: [],
			})),
		};

		const readiness = assessLiveResponsePackageReadiness(brokenPackage);

		expect(readiness.status).toBe("blocked");
		expect(readiness.blockers.join("\n")).toContain("evaluator criteria");
		expect(readiness.metrics.evaluationCriteriaCoverage).toBe(0);
		expect(readiness.missingDraftEvaluationCriteriaIds).toEqual([
			"LIVE-EVAL-001",
			"LIVE-EVAL-002",
			"LIVE-EVAL-003",
			"LIVE-EVAL-004",
		]);
	});

	it("blocks readiness when evaluator criteria are not represented in win theme seeds", () => {
		const responsePackage = buildLiveResponsePackage({
			opportunity,
			sourceText,
			generatedAt: new Date("2026-05-27T00:00:00.000Z"),
		});
		const brokenPackage = {
			...responsePackage,
			winThemeSeeds: [],
		};

		const readiness = assessLiveResponsePackageReadiness(brokenPackage);

		expect(readiness.status).toBe("blocked");
		expect(readiness.blockers.join("\n")).toContain("win theme seeds");
		expect(readiness.metrics.winThemeCriteriaCoverage).toBe(0);
		expect(readiness.missingWinThemeEvaluationCriteriaIds).toEqual([
			"LIVE-EVAL-001",
			"LIVE-EVAL-002",
			"LIVE-EVAL-003",
			"LIVE-EVAL-004",
		]);
	});
});
