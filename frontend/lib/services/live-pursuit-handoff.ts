import type { LiveSubmissionSchedule } from "@/lib/services/live-response-package";

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
	submissionSchedule?: LiveSubmissionSchedule;
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

export type LivePursuitHandoffExecutionTaskPriority = "critical" | "high" | "medium";

export type LivePursuitHandoffExecutionTaskOwnerRole =
	| "proposal_manager"
	| "capture_manager"
	| "compliance"
	| "technical_lead";

export interface LivePursuitHandoffExecutionTask {
	id: string;
	priority: LivePursuitHandoffExecutionTaskPriority;
	ownerRole: LivePursuitHandoffExecutionTaskOwnerRole;
	title: string;
	sourceRunId: string;
	sourceKind: string;
	dueLabel?: string;
	evidenceRequired: string[];
	status: "pending_operator_action";
}

export interface LivePursuitHandoffExecutionPlan {
	status: "ready_for_operator_execution";
	taskCount: number;
	criticalTaskCount: number;
	tasks: LivePursuitHandoffExecutionTask[];
}

export interface LivePursuitHandoff {
	generatedAt: string;
	portfolioRunId: string;
	primaryPursuit: LivePursuitHandoffOpportunity;
	reviewQueue: LivePursuitHandoffOpportunity[];
	artifactCount: number;
	executionPlan: LivePursuitHandoffExecutionPlan;
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
		executionPlan: buildExecutionPlan(input.primaryPursuit, input.reviewQueue),
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

function buildExecutionPlan(
	primaryPursuit: LivePursuitHandoffOpportunity,
	reviewQueue: LivePursuitHandoffOpportunity[]
): LivePursuitHandoffExecutionPlan {
	const tasks = [
		primaryPackageTask(primaryPursuit),
		...primaryDeadlineTasks(primaryPursuit),
		...(reviewQueue.length > 0 ? [reviewQueueTask(reviewQueue)] : []),
		...reviewQueueDeadlineTasks(reviewQueue),
		...qualificationWorkflowTasks(reviewQueue),
	];
	return {
		status: "ready_for_operator_execution",
		taskCount: tasks.length,
		criticalTaskCount: tasks.filter((task) => task.priority === "critical").length,
		tasks,
	};
}

function primaryPackageTask(primaryPursuit: LivePursuitHandoffOpportunity): LivePursuitHandoffExecutionTask {
	return executionTask({
		id: "LPH-001",
		priority: "high",
		ownerRole: "proposal_manager",
		title: `Open the response package for ${actionTitle(primaryPursuit.title)} and assign proposal ownership.`,
		opportunity: primaryPursuit,
		evidenceRequired: [
			"Proposal owner named",
			"Response package opened from linked artifacts",
			"Bid/no-bid review record started",
		],
	});
}

function primaryDeadlineTasks(primaryPursuit: LivePursuitHandoffOpportunity): LivePursuitHandoffExecutionTask[] {
	const schedule = primaryPursuit.submissionSchedule;
	const tasks: LivePursuitHandoffExecutionTask[] = [];
	const priority = priorityForSchedule(schedule);
	const title = schedule?.deadlineLabel
		? `Confirm ${schedule.urgency} source deadline ${schedule.deadlineLabel} and submission instructions from ${primaryPursuit.sourceKind}.`
		: `Confirm source deadline and submission instructions from ${primaryPursuit.sourceKind}.`;
	tasks.push(executionTask({
		id: "LPH-002",
		priority,
		ownerRole: "compliance",
		title,
		opportunity: primaryPursuit,
		dueLabel: schedule?.deadlineLabel,
		evidenceRequired: [
			"Source deadline verified",
			"Submission channel confirmed",
			...(schedule?.urgency === "critical" ? ["Submission receipt or acknowledgement capture path named"] : []),
		],
	}));

	if (schedule?.submissionRequirements.length) {
		tasks.push(executionTask({
			id: "LPH-003",
			priority,
			ownerRole: "compliance",
			title: `Verify ${schedule.submissionRequirements.length} extracted submission requirement signal${schedule.submissionRequirements.length === 1 ? "" : "s"} against the source document before final packaging.`,
			opportunity: primaryPursuit,
			dueLabel: schedule.deadlineLabel,
			evidenceRequired: [
				`${schedule.submissionRequirements.length} extracted submission requirement signal${schedule.submissionRequirements.length === 1 ? "" : "s"} reviewed`,
				"Source document cross-check recorded",
			],
		}));
	}

	if (schedule?.urgency === "critical") {
		tasks.push(executionTask({
			id: "LPH-004",
			priority: "critical",
			ownerRole: "proposal_manager",
			title: `Activate same-day submission control for ${actionTitle(primaryPursuit.title)}.`,
			opportunity: primaryPursuit,
			dueLabel: schedule.deadlineLabel,
			evidenceRequired: [
				"Named same-day submission owner",
				"Submission channel confirmed",
				"Receipt evidence captured before deadline",
			],
		}));
	} else if (schedule?.urgency === "urgent") {
		tasks.push(executionTask({
			id: "LPH-004",
			priority: "high",
			ownerRole: "proposal_manager",
			title: `Reserve a submission review window for ${actionTitle(primaryPursuit.title)} before ${schedule.deadlineLabel}.`,
			opportunity: primaryPursuit,
			dueLabel: schedule.deadlineLabel,
			evidenceRequired: [
				"Submission review window reserved",
				"Final packaging owner named",
			],
		}));
	}

	return tasks;
}

function reviewQueueTask(reviewQueue: LivePursuitHandoffOpportunity[]): LivePursuitHandoffExecutionTask {
	return executionTask({
		id: "LPH-005",
		priority: reviewQueue.some(isDeadlineRisk) ? "high" : "medium",
		ownerRole: "capture_manager",
		title: `Run bid/no-bid review for ${reviewQueue.length} review-before-pursuit candidate${reviewQueue.length === 1 ? "" : "s"}.`,
		opportunity: reviewQueue[0],
		sourceRunId: reviewQueue[0]?.runId ?? "review-queue",
		sourceKind: reviewQueue[0]?.sourceKind ?? "portfolio",
		evidenceRequired: [
			"Bid/no-bid decision recorded for each review candidate",
			"Partnering or hold rationale captured where applicable",
		],
	});
}

function reviewQueueDeadlineTasks(reviewQueue: LivePursuitHandoffOpportunity[]): LivePursuitHandoffExecutionTask[] {
	return reviewQueue
		.filter(isDeadlineRisk)
		.slice(0, 2)
		.map((opportunity, index) => executionTask({
			id: `LPH-${String(6 + index).padStart(3, "0")}`,
			priority: opportunity.submissionSchedule?.urgency === "critical" ? "critical" : "high",
			ownerRole: "capture_manager",
			title: `Triage deadline-risk review candidate ${actionTitle(opportunity.title)} (${opportunity.submissionSchedule?.urgency} deadline ${opportunity.submissionSchedule?.deadlineLabel}).`,
			opportunity,
			dueLabel: opportunity.submissionSchedule?.deadlineLabel,
			evidenceRequired: [
				"Deadline-risk bid/no-bid decision recorded",
				"Submission feasibility confirmed or candidate held",
			],
		}));
}

function qualificationWorkflowTasks(reviewQueue: LivePursuitHandoffOpportunity[]): LivePursuitHandoffExecutionTask[] {
	return reviewQueue
		.filter((opportunity) => opportunity.qualificationWorkflow)
		.slice(0, 2)
		.map((opportunity, index) => executionTask({
			id: `LPH-${String(8 + index).padStart(3, "0")}`,
			priority: opportunity.submissionSchedule?.urgency === "critical" ? "critical" : "high",
			ownerRole: "compliance",
			title: `Execute the ready qualification workflow for ${actionTitle(opportunity.title)}.`,
			opportunity,
			dueLabel: opportunity.submissionSchedule?.deadlineLabel,
			evidenceRequired: [
				`${opportunity.qualificationWorkflow?.gateCount ?? 0} qualification workflow gate${opportunity.qualificationWorkflow?.gateCount === 1 ? "" : "s"} reviewed`,
				"Required qualification artifacts assembled",
			],
		}));
}

function executionTask(input: {
	id: string;
	priority: LivePursuitHandoffExecutionTaskPriority;
	ownerRole: LivePursuitHandoffExecutionTaskOwnerRole;
	title: string;
	opportunity?: LivePursuitHandoffOpportunity;
	sourceRunId?: string;
	sourceKind?: string;
	dueLabel?: string;
	evidenceRequired: string[];
}): LivePursuitHandoffExecutionTask {
	return {
		id: input.id,
		priority: input.priority,
		ownerRole: input.ownerRole,
		title: input.title,
		sourceRunId: input.sourceRunId ?? input.opportunity?.runId ?? "unknown",
		sourceKind: input.sourceKind ?? input.opportunity?.sourceKind ?? "unknown",
		dueLabel: input.dueLabel,
		evidenceRequired: input.evidenceRequired,
		status: "pending_operator_action",
	};
}

function priorityForSchedule(
	schedule: LivePursuitHandoffOpportunity["submissionSchedule"]
): LivePursuitHandoffExecutionTaskPriority {
	if (schedule?.urgency === "critical") return "critical";
	if (schedule?.urgency === "urgent") return "high";
	return "medium";
}

function buildNextActions(
	primaryPursuit: LivePursuitHandoffOpportunity,
	reviewQueue: LivePursuitHandoffOpportunity[]
): string[] {
	return [
		`Open the response package for ${actionTitle(primaryPursuit.title)} and assign proposal ownership.`,
		...deadlineControlActions(primaryPursuit, reviewQueue),
		primaryPursuit.submissionSchedule?.deadlineLabel
			? `Confirm ${primaryPursuit.submissionSchedule.urgency} source deadline ${primaryPursuit.submissionSchedule.deadlineLabel} and submission instructions from ${primaryPursuit.sourceKind}.`
			: `Confirm source deadline and submission instructions from ${primaryPursuit.sourceKind}.`,
		...(reviewQueue.length > 0
			? [`Run bid/no-bid review for ${reviewQueue.length} review-before-pursuit candidate${reviewQueue.length === 1 ? "" : "s"}.`]
			: []),
		...reviewQueue
			.filter((opportunity) => opportunity.qualificationWorkflow)
			.slice(0, 2)
			.map((opportunity) => `Execute the ready qualification workflow for ${opportunity.title}.`),
	];
}

function deadlineControlActions(
	primaryPursuit: LivePursuitHandoffOpportunity,
	reviewQueue: LivePursuitHandoffOpportunity[]
): string[] {
	const actions: string[] = [];
	const primarySchedule = primaryPursuit.submissionSchedule;
	const primaryTitle = actionTitle(primaryPursuit.title);
	if (primarySchedule?.urgency === "critical") {
		actions.push(`Activate same-day submission control for ${primaryTitle}: name an owner, confirm the submission channel, and capture receipt evidence before the deadline.`);
	} else if (primarySchedule?.urgency === "urgent") {
		actions.push(`Reserve a submission review window for ${primaryTitle} before ${primarySchedule.deadlineLabel}.`);
	}
	if (primarySchedule?.submissionRequirements.length) {
		actions.push(`Verify ${primarySchedule.submissionRequirements.length} extracted submission requirement signal${primarySchedule.submissionRequirements.length === 1 ? "" : "s"} against the source document before final packaging.`);
	}

	for (const opportunity of reviewQueue.filter(isDeadlineRisk).slice(0, 2)) {
		actions.push(`Triage deadline-risk review candidate ${actionTitle(opportunity.title)} (${opportunity.submissionSchedule?.urgency} deadline ${opportunity.submissionSchedule?.deadlineLabel}).`);
	}

	return actions;
}

function actionTitle(title: string): string {
	return title.trim().replace(/[.!?]+$/u, "");
}

function isDeadlineRisk(opportunity: LivePursuitHandoffOpportunity): boolean {
	return opportunity.submissionSchedule?.urgency === "critical" || opportunity.submissionSchedule?.urgency === "urgent";
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
		"## Execution Checklist",
		"",
		`- Status: ${handoff.executionPlan.status}`,
		`- Tasks: ${handoff.executionPlan.taskCount}`,
		`- Critical tasks: ${handoff.executionPlan.criticalTaskCount}`,
		"",
		...handoff.executionPlan.tasks.flatMap((task) => [
			`### ${task.id} - ${task.title}`,
			"",
			`- Priority: ${task.priority}`,
			`- Owner role: ${task.ownerRole}`,
			`- Source: ${task.sourceKind} / ${task.sourceRunId}`,
			...(task.dueLabel ? [`- Due: ${task.dueLabel}`] : []),
			`- Status: ${task.status}`,
			"- Evidence required:",
			...task.evidenceRequired.map((evidence) => `  - ${evidence}`),
			"",
		]),
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
		...(opportunity.submissionSchedule?.deadlineLabel
			? [`- Deadline: ${opportunity.submissionSchedule.deadlineLabel} (${opportunity.submissionSchedule.urgency}, ${opportunity.submissionSchedule.deadlineSource})`]
			: ["- Deadline: not found in response-readiness evidence"]),
		...(opportunity.submissionSchedule?.submissionMethod
			? [`- Submission method: ${opportunity.submissionSchedule.submissionMethod}`]
			: []),
		...(opportunity.submissionSchedule?.submissionRequirements.length
			? [`- Submission requirements: ${opportunity.submissionSchedule.submissionRequirements.length} extracted signal${opportunity.submissionSchedule.submissionRequirements.length === 1 ? "" : "s"}`]
			: []),
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
