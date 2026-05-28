export type LivePursuitHandoffTaskPriority = "critical" | "high" | "medium";

export type LivePursuitHandoffTaskOwnerRole =
	| "proposal_manager"
	| "capture_manager"
	| "compliance"
	| "technical_lead";

export interface LatestLivePursuitHandoffTask {
	id: string;
	priority: LivePursuitHandoffTaskPriority;
	ownerRole: LivePursuitHandoffTaskOwnerRole;
	title: string;
	sourceRunId: string;
	sourceKind: string;
	dueLabel?: string;
	evidenceRequired: string[];
	status: "pending_operator_action";
}

export interface LatestLivePursuitHandoffIndex {
	runId: string;
	updatedAt: string;
	sourcePortfolio: {
		runId?: string;
		path: string;
		completedAt?: string;
		rankedCount: number;
	};
	handoffArtifactPaths: string[];
	primaryPursuit: {
		runId: string;
		sourceKind: string;
		title: string;
		deadline?: string;
		deadlineUrgency?: string;
		portalUrl?: string;
		documentUrl?: string;
	};
	reviewQueueCount: number;
	artifactCount: number;
	executionPlan: {
		status: "ready_for_operator_execution";
		taskCount: number;
		criticalTaskCount: number;
		tasks: LatestLivePursuitHandoffTask[];
	};
}

export interface LatestLivePursuitHandoffPayload {
	index: LatestLivePursuitHandoffIndex;
	operatorBriefMarkdown: string;
	paths: {
		indexPath: string;
		briefPath: string;
	};
}
