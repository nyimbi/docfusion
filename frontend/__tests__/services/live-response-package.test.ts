import { describe, expect, it } from "vitest";
import {
	LIVE_RESPONSE_DOCUMENT_TYPES,
	assessLiveResponsePackageReadiness,
	assessLiveResponsePursuitFit,
	buildLiveQualificationPackage,
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

	it("extracts requirement signals from paragraph-heavy procurement text", () => {
		const paragraphText = `
The procuring entity invites eligible consultants to submit a technical and financial proposal for customer satisfaction survey services. The successful bidder shall provide a detailed methodology, sampling approach, data collection plan, quality assurance process, and reporting schedule. The consultant must demonstrate similar experience delivering survey assignments for public institutions and regulated environments. Bidders are required to submit statutory compliance documents, company profile, work plan, and evidence of qualified personnel before the closing date. The financial proposal should include all fees, assumptions, reimbursable costs, and taxes.
		`;

		const requirements = extractLiveResponseRequirementSignals(paragraphText);

		expect(requirements.length).toBeGreaterThanOrEqual(4);
		expect(requirements.map((requirement) => requirement.documentType)).toEqual(
			expect.arrayContaining([
				"technical_approach",
				"management_plan",
				"past_performance",
				"cost_proposal",
			])
		);
		expect(requirements[0]?.text).toContain("technical and financial proposal");
	});

	it("selects Datacraft snippets relevant to the opportunity and source text", () => {
		const snippets = selectLiveResponseSnippets(opportunity, sourceText);

		expect(snippets.length).toBeGreaterThanOrEqual(12);
		expect(snippets.map((snippet) => snippet.shortcut)).toEqual(
			expect.arrayContaining(["/dc-security", "/dc-technical"])
		);
	});

	it("assesses pursuit fit separately from draft readiness", () => {
		const strongFit = assessLiveResponsePursuitFit({
			opportunity,
			sourceText,
			relevantSnippetCount: 20,
		});
		const weakFit = assessLiveResponsePursuitFit({
			opportunity: {
				title: "Tender for provision of staff medical insurance cover",
				organization: "Regional Secretariat",
				source: "comesa",
				sourceId: "medical-insurance",
				projectSummary: "The bidder shall provide staff medical insurance cover and claims administration.",
			},
			sourceText: "The tender requires insurance underwriting, hospital networks, claims processing, and medical cover administration.",
			relevantSnippetCount: 0,
		});

		expect(strongFit).toMatchObject({
			status: "strong_fit",
			recommendation: "pursue",
			pursuitRoute: "proposal_response",
		});
		expect(strongFit.score).toBeGreaterThanOrEqual(75);
		expect(strongFit.matchedCapabilities).toEqual(expect.arrayContaining(["software", "security", "apis"]));
		expect(weakFit).toMatchObject({
			status: "weak_fit",
			recommendation: "no_bid_unless_partnered",
		});
		expect(weakFit.riskFactors.join("\n")).toContain("insurance");
	});

	it("requires bid review for broad supplier registrations with multiple specialist-domain risks", () => {
		const fit = assessLiveResponsePursuitFit({
			opportunity: {
				title: "Registration of suppliers for goods, services and works",
				organization: "Water Utility",
				source: "kenya_ppip",
				sourceId: "supplier-registration",
				projectSummary: "Registration covers ICT software system, workflow automation, data platforms, cleaning, construction, furniture, and vehicle services.",
			},
			sourceText: [
				"Bidders may register for software, API architecture, data platform, payment, records, security, compliance, integration, monitoring, reporting, and digital workflow categories.",
				"The registration also covers cleaning, construction, furniture, and vehicle services.",
				"Applicants shall submit implementation, consultancy, project management, technical assistance, training, and quality assurance experience for government procurement.",
			].join("\n"),
			relevantSnippetCount: 20,
		});

		expect(fit).toMatchObject({
			status: "review_required",
			recommendation: "review_before_pursuit",
			pursuitRoute: "supplier_registration",
		});
		expect(fit.score).toBeGreaterThanOrEqual(75);
		expect(fit.riskFactors).toEqual(expect.arrayContaining([
			"cleaning domain may require specialist partner or no-bid review",
			"construction domain may require specialist partner or no-bid review",
			"furniture domain may require specialist partner or no-bid review",
			"vehicle domain may require specialist partner or no-bid review",
		]));
		expect(fit.rationale).toContain("Supplier-registration workflow required");
	});

	it("routes prequalification notices to bid review instead of ordinary proposal pursuit", () => {
		const fit = assessLiveResponsePursuitFit({
			opportunity: {
				title: "Invitation for Prequalification for National Single Window System",
				organization: "Development Bank",
				source: "world_bank",
				sourceId: "prequalification",
				projectSummary: "Design, development, supply, installation, deployment and implementation of a national digital platform.",
			},
			sourceText: "Invitation for Prequalification. Applicants shall show software, data platform, API integration, security, implementation, project management, and training experience.",
			relevantSnippetCount: 20,
		});

		expect(fit).toMatchObject({
			status: "review_required",
			recommendation: "review_before_pursuit",
			pursuitRoute: "prequalification",
		});
		expect(fit.score).toBeGreaterThanOrEqual(75);
		expect(fit.rationale).toContain("Prequalification workflow required");
	});

	it("builds qualification package artifacts for supplier-registration routes", () => {
		const responsePackage = buildLiveResponsePackage({
			opportunity: {
				title: "Registration of suppliers for goods, services and works",
				organization: "Water Utility",
				source: "kenya_ppip",
				sourceId: "supplier-registration",
				projectSummary: "Registration covers ICT software system, workflow automation, data platforms, cleaning, construction, furniture, and vehicle services.",
			},
			sourceText: [
				"Registration of suppliers for goods, services and works.",
				"Bidders must submit company profile, tax compliance, registration certificate, declarations, and category-specific evidence.",
				"Bidders may register for software, API architecture, data platform, payment, records, security, compliance, integration, monitoring, reporting, and digital workflow categories.",
				"The registration also covers cleaning, construction, furniture, and vehicle services.",
				"Applicants shall submit implementation, consultancy, project management, technical assistance, training, and quality assurance experience for government procurement.",
			].join("\n"),
			generatedAt: new Date("2026-05-28T00:00:00.000Z"),
		});

		const qualificationPackage = buildLiveQualificationPackage(responsePackage);

		expect(qualificationPackage).toMatchObject({
			pursuitRoute: "supplier_registration",
			title: "Supplier Registration Package - Registration of suppliers for goods, services and works",
		});
		expect(qualificationPackage?.requiredArtifacts).toEqual(expect.arrayContaining([
			"Selected supplier category matrix",
			"Tax compliance certificate",
			"Category-specific licenses or certifications",
		]));
		expect(qualificationPackage?.checklist).toHaveLength(5);
		expect(qualificationPackage?.operatorBriefMarkdown).toContain("# Supplier Registration Package");
		expect(qualificationPackage?.operatorBriefMarkdown).toContain("Route: `supplier_registration`");
	});

	it("does not build qualification package artifacts for ordinary proposal-response routes", () => {
		const responsePackage = buildLiveResponsePackage({
			opportunity,
			sourceText,
			generatedAt: new Date("2026-05-28T00:00:00.000Z"),
		});

		expect(buildLiveQualificationPackage(responsePackage)).toBeUndefined();
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

	it("extracts evaluator criteria from unweighted RFP evaluation lists", () => {
		const unweightedEvaluationText = `
## EVALUATION CRITERIA
1. Understanding of the Terms of Reference and proposed technical approach.
2. Methodology, sampling plan, data collection quality controls, and reporting schedule.
3. Relevant experience with similar assignments and qualifications of key personnel.
4. Financial proposal, price realism, assumptions, and reimbursable costs.
		`;

		const criteria = extractLiveResponseEvaluationSignals(unweightedEvaluationText);

		expect(criteria).toHaveLength(4);
		expect(criteria.map((criterion) => criterion.documentType)).toEqual([
			"technical_approach",
			"technical_approach",
			"past_performance",
			"cost_proposal",
		]);
		expect(criteria[0]).toMatchObject({
			id: "LIVE-EVAL-001",
			sourceSection: "EVALUATION CRITERIA",
			weight: undefined,
		});
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

	it("keeps win theme coverage for evaluator criteria beyond eight rows", () => {
		const multiCriteriaSourceText = `
## Scope of Services
The consultant must provide a technical methodology, work plan, personnel, similar experience, and financial proposal for the assignment.
## Evaluation Criteria
1. Technical approach will be evaluated at 10 points.
2. Understanding of the Terms of Reference will be evaluated at 10 points.
3. Methodology and sampling plan will be evaluated at 10 points.
4. Data collection quality controls will be evaluated at 10 points.
5. Reporting schedule and work plan will be evaluated at 10 points.
6. Organization and team composition will be evaluated at 10 points.
7. Key personnel qualifications will be evaluated at 10 points.
8. Similar assignment experience will be evaluated at 10 points.
9. Financial proposal price realism will be evaluated at 10 points.
10. Compliance with submission instructions will be evaluated at 10 points.
		`;

		const responsePackage = buildLiveResponsePackage({
			opportunity,
			sourceText: multiCriteriaSourceText,
			generatedAt: new Date("2026-05-27T00:00:00.000Z"),
		});

		expect(responsePackage.evaluationCriteria).toHaveLength(10);
		expect(responsePackage.winThemeSeeds).toHaveLength(10);
		expect(responsePackage.readiness.status).toBe("ready_for_review");
		expect(responsePackage.readiness.winThemeCoveredEvaluationCriteriaIds).toEqual(responsePackage.readiness.evaluationCriteriaIds);
		expect(responsePackage.readiness.missingWinThemeEvaluationCriteriaIds).toEqual([]);
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
		expect(responsePackage.pursuitFit).toMatchObject({
			status: "strong_fit",
			recommendation: "pursue",
		});
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
			evidenceCitationCoverage: 1,
			draftArtifactIntegrityCoverage: 1,
			reviewGateCoverage: 1,
			sourceCitationCoverage: 1,
			unresolvedPlaceholderCount: 0,
			pursuitFitScore: responsePackage.pursuitFit.score,
			winThemeSeedCount: 4,
		});

		for (const document of responsePackage.documents) {
			expect(document.wordCount).toBeGreaterThan(250);
			expect(document.markdown).toContain("## Source-Driven Response Plan");
			expect(document.markdown).toContain("## Evaluator Alignment Plan");
			expect(document.markdown).toContain("## Source Citation Map");
			expect(document.markdown).toContain("Source requirement LIVE-REQ-");
			expect(document.markdown).toContain("## Datacraft Evidence To Weave In");
			expect(document.markdown).toContain("## Datacraft Evidence Citation Map");
			expect(document.artifact).toMatchObject({
				format: "markdown",
				filename: `${document.documentType}.md`,
				sizeBytes: Buffer.byteLength(document.markdown, "utf8"),
				generatedAt: "2026-05-27T00:00:00.000Z",
			});
			expect(document.artifact.contentHash).toMatch(/^[a-f0-9]{64}$/);
			for (const shortcut of document.relevantSnippetShortcuts) {
				expect(document.markdown).toContain(`Evidence ${shortcut}:`);
			}
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

	it("blocks readiness when source citation maps are missing from drafts", () => {
		const responsePackage = buildLiveResponsePackage({
			opportunity,
			sourceText,
			generatedAt: new Date("2026-05-27T00:00:00.000Z"),
		});
		const brokenPackage = {
			...responsePackage,
			documents: responsePackage.documents.map((document) => ({
				...document,
				markdown: document.markdown.replace(/## Source Citation Map[\s\S]*?## Datacraft Evidence To Weave In/, "## Datacraft Evidence To Weave In"),
			})),
		};

		const readiness = assessLiveResponsePackageReadiness(brokenPackage);

		expect(readiness.status).toBe("blocked");
		expect(readiness.blockers.join("\n")).toContain("source citation map");
		expect(readiness.metrics.sourceCitationCoverage).toBe(0);
		expect(readiness.warnings).toEqual(
			expect.arrayContaining([
				expect.stringContaining("incomplete source citation mapping"),
			])
		);
	});

	it("blocks readiness when evidence citation maps are missing from drafts", () => {
		const responsePackage = buildLiveResponsePackage({
			opportunity,
			sourceText,
			generatedAt: new Date("2026-05-27T00:00:00.000Z"),
		});
		const brokenPackage = {
			...responsePackage,
			documents: responsePackage.documents.map((document) => ({
				...document,
				markdown: document.markdown.replace(/## Datacraft Evidence Citation Map[\s\S]*?## Review Gates/, "## Review Gates"),
			})),
		};

		const readiness = assessLiveResponsePackageReadiness(brokenPackage);

		expect(readiness.status).toBe("blocked");
		expect(readiness.blockers.join("\n")).toContain("Datacraft evidence citation map");
		expect(readiness.metrics.evidenceCitationCoverage).toBe(0);
		expect(readiness.warnings).toEqual(
			expect.arrayContaining([
				expect.stringContaining("incomplete Datacraft evidence citation mapping"),
			])
		);
	});

	it("blocks readiness when draft artifact manifests are stale", () => {
		const responsePackage = buildLiveResponsePackage({
			opportunity,
			sourceText,
			generatedAt: new Date("2026-05-27T00:00:00.000Z"),
		});
		const brokenPackage = {
			...responsePackage,
			documents: responsePackage.documents.map((document) => ({
				...document,
				markdown: `${document.markdown}\nUntracked late edit.`,
			})),
		};

		const readiness = assessLiveResponsePackageReadiness(brokenPackage);

		expect(readiness.status).toBe("blocked");
		expect(readiness.blockers.join("\n")).toContain("draft artifact integrity manifest");
		expect(readiness.metrics.draftArtifactIntegrityCoverage).toBe(0);
		expect(readiness.warnings).toEqual(
			expect.arrayContaining([
				expect.stringContaining("stale draft artifact integrity manifest"),
			])
		);
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
