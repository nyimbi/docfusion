import { describe, expect, it } from "vitest";
import {
	LIVE_RESPONSE_DOCUMENT_TYPES,
	buildLiveResponsePackage,
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

	it("builds concrete response draft documents with requirement coverage", () => {
		const responsePackage = buildLiveResponsePackage({
			opportunity,
			sourceText,
			generatedAt: new Date("2026-05-27T00:00:00.000Z"),
		});

		expect(responsePackage.documents.map((document) => document.documentType)).toEqual(LIVE_RESPONSE_DOCUMENT_TYPES);
		expect(responsePackage.requirements.length).toBeGreaterThanOrEqual(5);
		expect(responsePackage.totalWordCount).toBeGreaterThan(2000);
		expect(responsePackage.relevantSnippetCount).toBeGreaterThanOrEqual(12);

		for (const document of responsePackage.documents) {
			expect(document.wordCount).toBeGreaterThan(250);
			expect(document.markdown).toContain("## Source-Driven Response Plan");
			expect(document.markdown).toContain("## Datacraft Evidence To Weave In");
			expect(document.markdown).not.toMatch(/\{\{[^}]+\}\}/);
			expect(document.requirementIds).toHaveLength(new Set(document.requirementIds).size);
		}

		const technicalApproach = responsePackage.documents.find((document) => document.documentType === "technical_approach");
		expect(technicalApproach?.markdown).toContain("penetration testing");
		expect(technicalApproach?.requirementIds.length).toBeGreaterThan(0);
	});
});
