export interface WorkflowAuditCsvProjection {
	events: Array<{
		id: string;
		workflowInstanceId: string;
		subjectType: string;
		subjectId: string;
		eventType: string;
		fromState: string | null;
		toState: string | null;
		actorId: string;
		actorName: string | null;
		reason: string | null;
		evidenceLinks: string[];
		createdAt: string;
	}>;
}

export function serializeWorkflowAuditCsv(projection: WorkflowAuditCsvProjection): string {
	const header = [
		"event_id",
		"workflow_instance_id",
		"subject_type",
		"subject_id",
		"event_type",
		"from_state",
		"to_state",
		"actor_id",
		"actor_name",
		"reason",
		"evidence_links",
		"created_at",
	];
	const rows = projection.events.map((event) => [
		event.id,
		event.workflowInstanceId,
		event.subjectType,
		event.subjectId,
		event.eventType,
		event.fromState ?? "",
		event.toState ?? "",
		event.actorId,
		event.actorName ?? "",
		event.reason ?? "",
		event.evidenceLinks.join(" "),
		event.createdAt,
	]);
	return [
		header.map(csvCell).join(","),
		...rows.map((row) => row.map(csvCell).join(",")),
	].join("\n") + "\n";
}

function csvCell(value: string): string {
	if (!/[",\r\n]/.test(value)) return value;
	return `"${value.replace(/"/g, '""')}"`;
}

