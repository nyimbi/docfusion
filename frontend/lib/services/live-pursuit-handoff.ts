export interface LivePursuitHandoffOpportunity {
	runId: string;
	sourceKind: string;
	title: string;
	organization?: string;
	portalUrl?: string;
	documentUrl?: string;
	portfolioRecommendation: "pursue_now" | "review_before_pursuit" | "hold_or_partner";
	pursuitRoute: "proposal_response" | "supplier_registration" | "prequalification";
	portfolioScore: number;
	readinessStatus: string;
	responseDraftWordCount: number;
	responseArtifactPaths: string[];
	qualificationArtifactPaths?: string[];
	qualificationWorkflow?: {
		status: "ready_for_operator_execution" | "blocked";
		gateCount: number;
		blockedGateCount: number;
		artifactPaths: string[];
	};
	rankingReasons: string[];
}

export interface LivePursuitHandoff {
	generatedAt: string;
	portfolioRunId: string;
	primaryPursuit: LivePursuitHandoffOpportunity;
	reviewQueue: LivePursuitHandoffOpportunity[];
	artifactCount: number;
	nextActions: string[];
	operatorBriefMarkdown: string;
}

export function buildLivePursuitHandoff(input: {
	generatedAt?: Date;
	portfolioRunId: string;
	primaryPursuit: LivePursuitHandoffOpportunity;
	reviewQueue: LivePursuitHandoffOpportunity[];
}): LivePursuitHandoff {
	validateHandoffOpportunity(input.primaryPursuit, "primary pursuit");
	for (const [index, opportunity] of input.reviewQueue.entries()) {
		validateHandoffOpportunity(opportunity, `review queue item ${index + 1}`);
	}

	const artifactCount = uniqueArtifacts([
		...handoffArtifacts(input.primaryPursuit),
		...input.reviewQueue.flatMap(handoffArtifacts),
	]).length;
	const handoffValue: Omit<LivePursuitHandoff, "operatorBriefMarkdown"> = {
		generatedAt: (input.generatedAt ?? new Date()).toISOString(),
		portfolioRunId: input.portfolioRunId,
		primaryPursuit: input.primaryPursuit,
		reviewQueue: input.reviewQueue,
		artifactCount,
		nextActions: buildNextActions(input.primaryPursuit, input.reviewQueue),
	};
	return {
		...handoffValue,
		operatorBriefMarkdown: formatLivePursuitHandoffBrief(handoffValue),
	};
}

function validateHandoffOpportunity(opportunity: LivePursuitHandoffOpportunity, label: string): void {
	if (!opportunity.runId.trim()) throw new Error(`Missing run ID for ${label}`);
	if (!opportunity.title.trim()) throw new Error(`Missing title for ${label}`);
	if (opportunity.readinessStatus !== "ready_for_review") {
		throw new Error(`${label} is not response-ready: ${opportunity.readinessStatus}`);
	}
	if (opportunity.portfolioRecommendation === "pursue_now" && opportunity.responseArtifactPaths.length < 6) {
		throw new Error(`${label} does not include the full response draft artifact set`);
	}
	if (
		opportunity.pursuitRoute !== "proposal_response"
		&& (!opportunity.qualificationWorkflow || opportunity.qualificationWorkflow.status !== "ready_for_operator_execution")
	) {
		throw new Error(`${label} requires a ready qualification workflow`);
	}
}

function buildNextActions(
	primaryPursuit: LivePursuitHandoffOpportunity,
	reviewQueue: LivePursuitHandoffOpportunity[]
): string[] {
	return [
		`Open the response package for ${primaryPursuit.title} and assign proposal ownership.`,
		`Confirm source deadline and submission instructions from ${primaryPursuit.sourceKind}.`,
		`Run bid/no-bid review for ${reviewQueue.length} review-before-pursuit candidate${reviewQueue.length === 1 ? "" : "s"}.`,
		...reviewQueue
			.filter((opportunity) => opportunity.qualificationWorkflow)
			.slice(0, 2)
			.map((opportunity) => `Execute the ready qualification workflow for ${opportunity.title}.`),
	];
}

function formatLivePursuitHandoffBrief(handoff: Omit<LivePursuitHandoff, "operatorBriefMarkdown">): string {
	const lines = [
		"# Live Pursuit Handoff",
		"",
		`Generated: ${handoff.generatedAt}`,
		`Portfolio run: \`${handoff.portfolioRunId}\``,
		`Artifact links: ${handoff.artifactCount}`,
		"",
		"## Primary Pursuit",
		"",
		...formatOpportunity(handoff.primaryPursuit),
		"",
		"## Review Queue",
		"",
		...(handoff.reviewQueue.length > 0
			? handoff.reviewQueue.flatMap((opportunity, index) => [
				`### ${index + 1}. ${opportunity.title}`,
				"",
				...formatOpportunity(opportunity),
				"",
			])
			: ["No review-before-pursuit candidates in the current portfolio.", ""]),
		"## Next Actions",
		"",
		...handoff.nextActions.map((action) => `- ${action}`),
		"",
	];
	return `${lines.join("\n").trimEnd()}\n`;
}

function formatOpportunity(opportunity: LivePursuitHandoffOpportunity): string[] {
	return [
		`- Run: \`${opportunity.runId}\``,
		`- Source: \`${opportunity.sourceKind}\``,
		`- Recommendation: \`${opportunity.portfolioRecommendation}\``,
		`- Route: \`${opportunity.pursuitRoute}\``,
		`- Score: ${opportunity.portfolioScore}/100`,
		`- Readiness: ${opportunity.readinessStatus}`,
		`- Draft words: ${opportunity.responseDraftWordCount}`,
		`- Response artifacts: ${opportunity.responseArtifactPaths.length}`,
		...(opportunity.qualificationArtifactPaths?.length
			? [`- Qualification package artifacts: ${opportunity.qualificationArtifactPaths.length}`]
			: []),
		...(opportunity.qualificationWorkflow
			? [`- Qualification workflow: ${opportunity.qualificationWorkflow.status}, ${opportunity.qualificationWorkflow.gateCount} gates, ${opportunity.qualificationWorkflow.blockedGateCount} blocked`]
			: []),
		...(opportunity.portalUrl ? [`- Portal: ${opportunity.portalUrl}`] : []),
		...(opportunity.documentUrl ? [`- Source document: ${opportunity.documentUrl}`] : []),
		"Artifacts:",
		...handoffArtifacts(opportunity).map((artifact) => `- ${artifact}`),
		"Reasons:",
		...opportunity.rankingReasons.map((reason) => `- ${reason}`),
	];
}

function handoffArtifacts(opportunity: LivePursuitHandoffOpportunity): string[] {
	return [
		...opportunity.responseArtifactPaths,
		...(opportunity.qualificationArtifactPaths ?? []),
		...(opportunity.qualificationWorkflow?.artifactPaths ?? []),
	];
}

function uniqueArtifacts(artifacts: string[]): string[] {
	return [...new Set(artifacts.filter((artifact) => artifact.trim().length > 0))];
}
