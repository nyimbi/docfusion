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
	artifactLinks: LatestLivePursuitHandoffArtifactLink[];
	actionStates: Record<string, LatestLivePursuitHandoffTaskActionState>;
	actionEvents: LatestLivePursuitHandoffTaskActionAuditEvent[];
	actionReadiness: LatestLivePursuitHandoffActionReadiness;
	paths: {
		indexPath: string;
		briefPath: string;
	};
}

export type LatestLivePursuitHandoffArtifactKind =
	| "handoff"
	| "primary_response"
	| "review_response"
	| "qualification_package"
	| "qualification_workflow";

export interface LatestLivePursuitHandoffArtifactLink {
	path: string;
	kind: LatestLivePursuitHandoffArtifactKind;
	label: string;
	title?: string;
	sourceRunId?: string;
	sourceKind?: string;
}

export interface LatestLivePursuitHandoffArtifactContent {
	artifact: LatestLivePursuitHandoffArtifactLink;
	content: string;
	contentType: string;
	filename: string;
}

export type LatestLivePursuitHandoffTaskActionStatus =
	| "pending_operator_action"
	| "in_progress"
	| "completed"
	| "blocked";

export interface LatestLivePursuitHandoffTaskActionState {
	taskId: string;
	status: LatestLivePursuitHandoffTaskActionStatus;
	assigneeName?: string;
	evidenceNote?: string;
	receiptUrl?: string;
	updatedAt: string;
	updatedByUserId: string;
}

export interface LatestLivePursuitHandoffTaskActionAuditEvent {
	eventId: string;
	runId: string;
	taskId: string;
	taskTitle: string;
	status: LatestLivePursuitHandoffTaskActionStatus;
	assigneeName?: string;
	evidenceNote?: string;
	receiptUrl?: string;
	updatedAt: string;
	updatedByUserId: string;
	auditPath: string;
}

export type LatestLivePursuitHandoffActionReadinessStatus =
	| "blocked"
	| "in_progress"
	| "ready_for_submission";

export interface LatestLivePursuitHandoffActionReadiness {
	status: LatestLivePursuitHandoffActionReadinessStatus;
	taskCount: number;
	completedTaskCount: number;
	blockedTaskIds: string[];
	pendingTaskIds: string[];
	criticalIncompleteTaskIds: string[];
	missingEvidenceTaskIds: string[];
	reasons: string[];
	updatedAt?: string;
}

export interface LatestLivePursuitHandoffTaskActionUpdate {
	taskState: LatestLivePursuitHandoffTaskActionState;
	auditEvent: LatestLivePursuitHandoffTaskActionAuditEvent;
	actionReadiness: LatestLivePursuitHandoffActionReadiness;
}
