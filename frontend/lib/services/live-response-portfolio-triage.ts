import type { LiveResponsePursuitFitAssessment, LiveResponseReadinessAssessment } from "@/lib/services/live-response-package";

export interface LiveResponsePortfolioCandidate {
	runId: string;
	sourceKind: string;
	sourceUrl: string;
	completedAt?: string;
	opportunity: {
		title: string;
		organization?: string;
		sourceId?: string;
		portalUrl?: string;
		documentUrl?: string;
	};
	document?: {
		extractionMethod?: string;
		byteLength?: number;
		extractedTextLength?: number;
		doclingStatus?: string;
	};
	response: {
		sourceRequirementCount: number;
		evaluatorCriteriaCount: number;
		winThemeSeedCount: number;
		totalDraftWordCount: number;
		relevantSnippetCount: number;
		readiness: LiveResponseReadinessAssessment;
		pursuitFit: LiveResponsePursuitFitAssessment;
	};
}

export interface RankedLiveResponseOpportunity extends LiveResponsePortfolioCandidate {
	portfolioRank: number;
	portfolioScore: number;
	portfolioRecommendation: "pursue_now" | "review_before_pursuit" | "hold_or_partner";
	rankingReasons: string[];
}

export interface LiveResponsePortfolioTriage {
	generatedAt: string;
	totalCandidates: number;
	responseReadyCount: number;
	pursueNowCount: number;
	reviewBeforePursuitCount: number;
	holdOrPartnerCount: number;
	ranked: RankedLiveResponseOpportunity[];
}

export function triageLiveResponsePortfolio(
	candidates: LiveResponsePortfolioCandidate[],
	options: { generatedAt?: Date; limit?: number } = {}
): LiveResponsePortfolioTriage {
	const latestCandidates = latestCandidatePerOpportunity(latestCandidatePerSourceFeed(candidates));
	const ranked = latestCandidates
		.map(scoreCandidate)
		.sort((left, right) =>
			right.portfolioScore - left.portfolioScore
			|| compareIso(right.completedAt, left.completedAt)
			|| left.opportunity.title.localeCompare(right.opportunity.title)
		)
		.slice(0, options.limit ?? latestCandidates.length)
		.map((candidate, index) => ({
			...candidate,
			portfolioRank: index + 1,
		}));

	return {
		generatedAt: (options.generatedAt ?? new Date()).toISOString(),
		totalCandidates: latestCandidates.length,
		responseReadyCount: ranked.filter((candidate) => candidate.response.readiness.status === "ready_for_review").length,
		pursueNowCount: ranked.filter((candidate) => candidate.portfolioRecommendation === "pursue_now").length,
		reviewBeforePursuitCount: ranked.filter((candidate) => candidate.portfolioRecommendation === "review_before_pursuit").length,
		holdOrPartnerCount: ranked.filter((candidate) => candidate.portfolioRecommendation === "hold_or_partner").length,
		ranked,
	};
}

export function formatLiveResponsePortfolioBrief(triage: LiveResponsePortfolioTriage): string {
	const lines = [
		"# Live Response Portfolio Triage",
		"",
		`Generated: ${triage.generatedAt}`,
		"",
		"## Summary",
		"",
		`- Ranked opportunities: ${triage.ranked.length}`,
		`- Response-ready opportunities: ${triage.responseReadyCount}`,
		`- Pursue now: ${triage.pursueNowCount}`,
		`- Review before pursuit: ${triage.reviewBeforePursuitCount}`,
		`- Hold or partner: ${triage.holdOrPartnerCount}`,
		"",
		"## Ranked Opportunities",
		"",
	];

	for (const opportunity of triage.ranked) {
		lines.push(
			`### ${opportunity.portfolioRank}. ${opportunity.opportunity.title}`,
			"",
			`- Priority: \`${opportunity.portfolioRecommendation}\``,
			`- Source: \`${opportunity.sourceKind}\``,
			`- Run: \`${opportunity.runId}\``,
			`- Portfolio score: ${opportunity.portfolioScore}/100`,
			`- Pursuit fit: ${opportunity.response.pursuitFit.status} (${opportunity.response.pursuitFit.score}/100), ${opportunity.response.pursuitFit.recommendation}`,
			`- Readiness: ${opportunity.response.readiness.status}`,
			`- Evidence: ${opportunity.response.sourceRequirementCount} source requirements, ${opportunity.response.evaluatorCriteriaCount} evaluator criteria, ${opportunity.response.winThemeSeedCount} win-theme seeds, ${opportunity.response.totalDraftWordCount} draft words, ${opportunity.response.relevantSnippetCount} response snippets`,
			...(opportunity.opportunity.portalUrl ? [`- Portal: ${opportunity.opportunity.portalUrl}`] : []),
			...(opportunity.opportunity.documentUrl ? [`- Source document: ${opportunity.opportunity.documentUrl}`] : []),
			"",
			"Reasons:",
			...opportunity.rankingReasons.map((reason) => `- ${reason}`),
			"",
		);
	}

	return `${lines.join("\n").trimEnd()}\n`;
}

function latestCandidatePerSourceFeed(candidates: LiveResponsePortfolioCandidate[]): LiveResponsePortfolioCandidate[] {
	const latest = new Map<string, LiveResponsePortfolioCandidate>();
	for (const candidate of candidates) {
		const key = `${candidate.sourceKind}|${candidate.sourceUrl}`;
		const current = latest.get(key);
		if (!current || compareIso(candidate.completedAt, current.completedAt) > 0) {
			latest.set(key, candidate);
		}
	}
	return [...latest.values()];
}

function latestCandidatePerOpportunity(candidates: LiveResponsePortfolioCandidate[]): LiveResponsePortfolioCandidate[] {
	const latest = new Map<string, LiveResponsePortfolioCandidate>();
	for (const candidate of candidates) {
		const key = [
			candidate.sourceKind,
			candidate.opportunity.sourceId,
			candidate.opportunity.documentUrl,
			candidate.opportunity.title,
		].filter(Boolean).join("|");
		const current = latest.get(key);
		if (!current || compareIso(candidate.completedAt, current.completedAt) > 0) {
			latest.set(key, candidate);
		}
	}
	return [...latest.values()];
}

function scoreCandidate(candidate: LiveResponsePortfolioCandidate): Omit<RankedLiveResponseOpportunity, "portfolioRank"> {
	const readiness = candidate.response.readiness;
	const fit = candidate.response.pursuitFit;
	const readyBonus = readiness.status === "ready_for_review" ? 20 : -30;
	const fitBonus = fit.recommendation === "pursue" ? 15 : fit.recommendation === "review_before_pursuit" ? 0 : -20;
	const evidenceBonus = Math.min(10, Math.floor(candidate.response.sourceRequirementCount / 3))
		+ Math.min(10, candidate.response.evaluatorCriteriaCount * 2)
		+ Math.min(10, Math.floor(candidate.response.totalDraftWordCount / 1000));
	const warningPenalty = Math.min(20, readiness.warnings.length * 4 + readiness.blockers.length * 10);
	const portfolioScore = capScoreForPursuitRecommendation(
		clampScore(fit.score + readyBonus + fitBonus + evidenceBonus - warningPenalty),
		fit.recommendation,
	);
	const portfolioRecommendation = portfolioScore >= 85 && readiness.status === "ready_for_review" && fit.recommendation === "pursue"
		? "pursue_now"
		: portfolioScore >= 50 && readiness.status === "ready_for_review" && fit.recommendation !== "no_bid_unless_partnered"
			? "review_before_pursuit"
			: "hold_or_partner";

	return {
		...candidate,
		portfolioScore,
		portfolioRecommendation,
		rankingReasons: rankingReasons(candidate, portfolioScore, portfolioRecommendation),
	};
}

function rankingReasons(
	candidate: LiveResponsePortfolioCandidate,
	score: number,
	recommendation: RankedLiveResponseOpportunity["portfolioRecommendation"]
): string[] {
	return [
		`Portfolio score ${score}/100 with ${candidate.response.pursuitFit.status} pursuit fit`,
		`Recommendation: ${recommendation}`,
		`${candidate.response.sourceRequirementCount} source requirements, ${candidate.response.evaluatorCriteriaCount} evaluator criteria, ${candidate.response.totalDraftWordCount} draft words`,
		...(candidate.response.pursuitFit.matchedCapabilities.length > 0
			? [`Matched Datacraft capabilities: ${candidate.response.pursuitFit.matchedCapabilities.slice(0, 6).join(", ")}`]
			: []),
		...(candidate.response.pursuitFit.riskFactors.length > 0
			? [`Risk factors: ${candidate.response.pursuitFit.riskFactors.slice(0, 3).join("; ")}`]
			: []),
		...(candidate.response.readiness.warnings.length > 0
			? [`Readiness warnings: ${candidate.response.readiness.warnings.slice(0, 3).join("; ")}`]
			: []),
	];
}

function clampScore(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value)));
}

function capScoreForPursuitRecommendation(
	score: number,
	recommendation: LiveResponsePursuitFitAssessment["recommendation"]
): number {
	if (recommendation === "review_before_pursuit") return Math.min(score, 84);
	if (recommendation === "no_bid_unless_partnered") return Math.min(score, 49);
	return score;
}

function compareIso(left: string | undefined, right: string | undefined): number {
	const leftTime = left ? Date.parse(left) : 0;
	const rightTime = right ? Date.parse(right) : 0;
	return (Number.isNaN(leftTime) ? 0 : leftTime) - (Number.isNaN(rightTime) ? 0 : rightTime);
}
