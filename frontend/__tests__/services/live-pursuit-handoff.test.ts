import { describe, expect, it } from "vitest";
import {
	buildLivePursuitHandoff,
	type LivePursuitHandoffOpportunity,
} from "@/lib/services/live-pursuit-handoff";

const responseArtifacts = [
	"response-package/cover_letter.md",
	"response-package/executive_summary.md",
	"response-package/technical_approach.md",
	"response-package/management_plan.md",
	"response-package/past_performance.md",
	"response-package/cost_proposal.md",
];

function pursuit(overrides: Partial<LivePursuitHandoffOpportunity> = {}): LivePursuitHandoffOpportunity {
	return {
		runId: "live_afdb_response_readiness_20260527T182825Z",
		sourceKind: "afdb",
		title: "Meteorological and Climate Mobile Application",
		organization: "African Development Bank",
		portalUrl: "https://example.test/notice",
		documentUrl: "https://example.test/source.pdf",
		portfolioRecommendation: "pursue_now",
		pursuitRoute: "proposal_response",
		portfolioScore: 100,
		readinessStatus: "ready_for_review",
		responseDraftWordCount: 5429,
		submissionSchedule: {
			deadlineIso: "2026-06-18T23:59:00.000Z",
			deadlineLabel: "2026-06-18",
			deadlineSource: "opportunity_metadata",
			daysUntilDeadline: 21,
			urgency: "normal",
			submissionRequirements: ["Submit through the source portal before closing."],
			evidenceSnippets: ["Opportunity metadata deadline: 2026-06-18"],
		},
		responseArtifactPaths: responseArtifacts,
		rankingReasons: ["Portfolio score 100/100 with strong_fit pursuit fit"],
		...overrides,
	};
}

describe("live pursuit handoff", () => {
	it("bundles primary pursuit artifacts and qualification review work into an operator handoff", () => {
		const handoff = buildLivePursuitHandoff({
			generatedAt: new Date("2026-05-28T00:40:00.000Z"),
			portfolioRunId: "live_opportunity_portfolio_triage_20260528T003203Z",
			primaryPursuit: pursuit(),
			reviewQueue: [
				pursuit({
					runId: "live_kenya_ppip_response_readiness_20260528T002006Z",
					sourceKind: "kenya_ppip",
					title: "Registration of suppliers for goods, services and works",
					portfolioRecommendation: "review_before_pursuit",
					pursuitRoute: "supplier_registration",
					portfolioScore: 84,
					responseDraftWordCount: 11668,
					qualificationArtifactPaths: [
						"qualification-package/qualification-package.json",
						"qualification-package/qualification-package.md",
					],
					qualificationWorkflow: {
						status: "ready_for_operator_execution",
						gateCount: 5,
						blockedGateCount: 0,
						artifactPaths: [
							"live-qualification-workflow.json",
							"live-qualification-workflow.md",
						],
					},
					rankingReasons: ["Qualification workflow: ready_for_operator_execution (5 gates, 0 blocked)"],
				}),
			],
		});

		expect(handoff).toMatchObject({
			generatedAt: "2026-05-28T00:40:00.000Z",
			portfolioRunId: "live_opportunity_portfolio_triage_20260528T003203Z",
			artifactCount: 10,
		});
		expect(handoff.nextActions).toContain("Execute the ready qualification workflow for Registration of suppliers for goods, services and works.");
		expect(handoff.nextActions).toContain("Confirm normal source deadline 2026-06-18 and submission instructions from afdb.");
		expect(handoff.operatorBriefMarkdown).toContain("# Live Pursuit Handoff");
		expect(handoff.operatorBriefMarkdown).toContain("## Primary Pursuit");
		expect(handoff.operatorBriefMarkdown).toContain("- Deadline: 2026-06-18 (normal, opportunity_metadata)");
		expect(handoff.operatorBriefMarkdown).toContain("- Submission requirements: 1 extracted signal");
		expect(handoff.operatorBriefMarkdown).toContain("Qualification workflow: ready_for_operator_execution, 5 gates, 0 blocked");
	});

	it("rejects pursue-now handoffs that do not include a full response artifact set", () => {
		expect(() => buildLivePursuitHandoff({
			portfolioRunId: "portfolio",
			primaryPursuit: pursuit({ responseArtifactPaths: responseArtifacts.slice(0, 4) }),
			reviewQueue: [],
		})).toThrow("full response draft artifact set");
	});

	it("rejects non-proposal routes without a ready qualification workflow", () => {
		expect(() => buildLivePursuitHandoff({
			portfolioRunId: "portfolio",
			primaryPursuit: pursuit(),
			reviewQueue: [
				pursuit({
					runId: "registration",
					portfolioRecommendation: "review_before_pursuit",
					pursuitRoute: "supplier_registration",
					qualificationWorkflow: undefined,
				}),
			],
		})).toThrow("requires a ready qualification workflow");
	});
});
