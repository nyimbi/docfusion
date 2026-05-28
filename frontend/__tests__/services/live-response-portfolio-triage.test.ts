import { describe, expect, it } from "vitest";
import {
	formatLiveResponsePortfolioBrief,
	triageLiveResponsePortfolio,
	type LiveResponsePortfolioCandidate,
} from "@/lib/services/live-response-portfolio-triage";

const baseReadiness: LiveResponsePortfolioCandidate["response"]["readiness"] = {
	status: "ready_for_review",
	blockers: [],
	warnings: [],
	evaluationCriteriaIds: [],
	draftCoveredEvaluationCriteriaIds: [],
	winThemeCoveredEvaluationCriteriaIds: [],
	missingDraftEvaluationCriteriaIds: [],
	missingWinThemeEvaluationCriteriaIds: [],
	metrics: {
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
		minDocumentWordCount: 800,
		totalDraftWordCount: 6000,
		relevantSnippetCount: 24,
		winThemeSeedCount: 4,
		pursuitFitScore: 90,
	},
};

function candidate(overrides: Partial<LiveResponsePortfolioCandidate>): LiveResponsePortfolioCandidate {
	return {
		runId: "run-1",
		sourceKind: "ungm",
		sourceUrl: "https://example.test/source",
		completedAt: "2026-05-27T10:00:00.000Z",
		document: {
			extractionMethod: "docling-document",
			byteLength: 100000,
			extractedTextLength: 9000,
			doclingStatus: "success",
		},
		...overrides,
		opportunity: {
			title: overrides.opportunity?.title ?? "Security API Platform",
			organization: overrides.opportunity?.organization ?? "UN Secretariat",
			sourceId: overrides.opportunity?.sourceId ?? "300700",
			portalUrl: overrides.opportunity?.portalUrl ?? "https://example.test/notice",
			documentUrl: overrides.opportunity?.documentUrl ?? "https://example.test/source.pdf",
		},
		response: {
			sourceRequirementCount: overrides.response?.sourceRequirementCount ?? 20,
			evaluatorCriteriaCount: overrides.response?.evaluatorCriteriaCount ?? 4,
			winThemeSeedCount: overrides.response?.winThemeSeedCount ?? 4,
			totalDraftWordCount: overrides.response?.totalDraftWordCount ?? 7000,
			relevantSnippetCount: overrides.response?.relevantSnippetCount ?? 24,
			readiness: overrides.response?.readiness ?? baseReadiness,
			pursuitFit: overrides.response?.pursuitFit ?? {
				status: "strong_fit",
				score: 90,
				pursuitRoute: "proposal_response",
				matchedCapabilities: ["security", "api", "software"],
				riskFactors: [],
				recommendation: "pursue",
				rationale: "Strong fit.",
			},
		},
	};
}

describe("live response portfolio triage", () => {
	it("ranks ready strong-fit opportunities ahead of review-required opportunities", () => {
		const triage = triageLiveResponsePortfolio([
			candidate({
				runId: "review-required",
				sourceKind: "comesa",
				opportunity: { title: "Medical Insurance RFP", sourceId: "medical" },
				response: {
					sourceRequirementCount: 24,
					evaluatorCriteriaCount: 5,
					winThemeSeedCount: 5,
					totalDraftWordCount: 7900,
					relevantSnippetCount: 24,
					readiness: {
						...baseReadiness,
						warnings: ["Pursuit fit requires review before bid decision"],
					},
					pursuitFit: {
						status: "review_required",
						score: 72,
						pursuitRoute: "proposal_response",
						matchedCapabilities: ["compliance", "data"],
						riskFactors: ["insurance domain may require specialist partner or no-bid review"],
						recommendation: "review_before_pursuit",
						rationale: "Review required.",
					},
				},
			}),
			candidate({ runId: "strong-fit" }),
		], { generatedAt: new Date("2026-05-27T12:00:00.000Z") });

		expect(triage).toMatchObject({
			totalCandidates: 2,
			responseReadyCount: 2,
			pursueNowCount: 1,
			reviewBeforePursuitCount: 1,
			holdOrPartnerCount: 0,
			generatedAt: "2026-05-27T12:00:00.000Z",
		});
		expect(triage.ranked.map((item) => item.runId)).toEqual(["strong-fit", "review-required"]);
		expect(triage.ranked[0]).toMatchObject({
			portfolioRank: 1,
			portfolioRecommendation: "pursue_now",
		});
		expect(triage.ranked[1]).toMatchObject({
			portfolioRank: 2,
			portfolioRecommendation: "review_before_pursuit",
		});
		expect(triage.ranked[1]?.rankingReasons.join("\n")).toContain("insurance domain");

		const brief = formatLiveResponsePortfolioBrief(triage);
		expect(brief).toContain("# Live Response Portfolio Triage");
		expect(brief).toContain("### 1. Security API Platform");
		expect(brief).toContain("- Priority: `pursue_now`");
		expect(brief).toContain("### 2. Medical Insurance RFP");
		expect(brief).toContain("insurance domain may require specialist partner");
	});

	it("keeps only the latest run for the same opportunity", () => {
		const triage = triageLiveResponsePortfolio([
			candidate({
				runId: "older",
				completedAt: "2026-05-27T10:00:00.000Z",
				response: {
					sourceRequirementCount: 20,
					evaluatorCriteriaCount: 4,
					winThemeSeedCount: 4,
					totalDraftWordCount: 7000,
					relevantSnippetCount: 24,
					readiness: baseReadiness,
					pursuitFit: {
						status: "review_required",
						score: 65,
						pursuitRoute: "proposal_response",
						matchedCapabilities: ["security"],
						riskFactors: [],
						recommendation: "review_before_pursuit",
						rationale: "Older fit.",
					},
				},
			}),
			candidate({
				runId: "newer",
				completedAt: "2026-05-27T12:00:00.000Z",
			}),
		]);

		expect(triage.totalCandidates).toBe(1);
		expect(triage.ranked).toHaveLength(1);
		expect(triage.ranked[0]?.runId).toBe("newer");
	});

	it("keeps only the latest run for the same source feed", () => {
		const triage = triageLiveResponsePortfolio([
			candidate({
				runId: "older-world-bank",
				sourceKind: "world_bank",
				sourceUrl: "https://projects.worldbank.org/en/projects-operations/procurement",
				completedAt: "2026-05-27T10:00:00.000Z",
				opportunity: {
					title: "Critical Habitat Assessment",
					sourceId: "OP00435405",
					documentUrl: "https://search.worldbank.org/api/procnotices?format=json&apilang=en&id=OP00435405",
				},
			}),
			candidate({
				runId: "newer-world-bank",
				sourceKind: "world_bank",
				sourceUrl: "https://projects.worldbank.org/en/projects-operations/procurement",
				completedAt: "2026-05-27T12:00:00.000Z",
				opportunity: {
					title: "Support the development of energy management systems and capacity building",
					sourceId: "OP00440843",
					documentUrl: "https://search.worldbank.org/api/procnotices?format=json&apilang=en&id=OP00440843",
				},
			}),
			candidate({
				runId: "ungm",
				sourceKind: "ungm",
				sourceUrl: "https://www.ungm.org/Public/Notice?title=software",
			}),
		]);

		expect(triage.totalCandidates).toBe(2);
		expect(triage.ranked.map((item) => item.runId)).toContain("newer-world-bank");
		expect(triage.ranked.map((item) => item.runId)).not.toContain("older-world-bank");
	});

	it("keeps blocked or weak-fit opportunities out of pursue-now priority", () => {
		const triage = triageLiveResponsePortfolio([
			candidate({
				runId: "blocked",
				response: {
					sourceRequirementCount: 4,
					evaluatorCriteriaCount: 0,
					winThemeSeedCount: 1,
					totalDraftWordCount: 1200,
					relevantSnippetCount: 2,
					readiness: {
						...baseReadiness,
						status: "blocked",
						blockers: ["Draft artifacts are missing required source citations"],
						warnings: ["Pursuit fit requires partner/no-bid review"],
					},
					pursuitFit: {
						status: "weak_fit",
						score: 32,
						pursuitRoute: "proposal_response",
						matchedCapabilities: [],
						riskFactors: ["domain fit is weak"],
						recommendation: "no_bid_unless_partnered",
						rationale: "Weak fit.",
					},
				},
			}),
		]);

		expect(triage).toMatchObject({
			responseReadyCount: 0,
			pursueNowCount: 0,
			reviewBeforePursuitCount: 0,
			holdOrPartnerCount: 1,
		});
		expect(triage.ranked[0]).toMatchObject({
			portfolioRecommendation: "hold_or_partner",
		});
	});

	it("surfaces supplier-registration routing in operator reasons and brief", () => {
		const triage = triageLiveResponsePortfolio([
			candidate({
				runId: "supplier-registration",
				sourceKind: "kenya_ppip",
				qualificationWorkflow: {
					status: "ready_for_operator_execution",
					currentState: "route_review",
					gateCount: 5,
					blockedGateCount: 0,
					taskCount: 5,
					mandatoryTaskCount: 4,
					sourceSignalCount: 22,
					artifactPaths: [
						".omx/logs/platform-completion/live-qualification-workflow-live_qualification_workflow_20260528T002713Z/live-qualification-workflow.json",
					],
				},
				opportunity: {
					title: "Registration of suppliers for goods, services and works",
					sourceId: "registration",
				},
				response: {
					sourceRequirementCount: 24,
					evaluatorCriteriaCount: 13,
					winThemeSeedCount: 13,
					totalDraftWordCount: 11000,
					relevantSnippetCount: 24,
					readiness: {
						...baseReadiness,
						warnings: ["Pursuit fit requires review before bid decision"],
					},
					pursuitFit: {
						status: "review_required",
						score: 82,
						pursuitRoute: "supplier_registration",
						matchedCapabilities: ["software", "platform", "security"],
						riskFactors: ["construction domain may require specialist partner or no-bid review"],
						recommendation: "review_before_pursuit",
						rationale: "Supplier-registration workflow required.",
					},
				},
			}),
			candidate({ runId: "strong-fit" }),
		]);

		const registration = triage.ranked.find((item) => item.runId === "supplier-registration");
		expect(registration).toMatchObject({
			portfolioRecommendation: "review_before_pursuit",
			response: {
				pursuitFit: {
					pursuitRoute: "supplier_registration",
				},
			},
		});
		expect(registration?.rankingReasons.join("\n")).toContain("Pursuit route: supplier_registration");
		expect(registration?.rankingReasons.join("\n")).toContain("Qualification workflow: ready_for_operator_execution (5 gates, 0 blocked)");
		const brief = formatLiveResponsePortfolioBrief(triage);
		expect(brief).toContain("- Pursuit route: supplier_registration");
		expect(brief).toContain("- Qualification workflow: ready_for_operator_execution, 5 gates, 0 blocked");
	});
});
