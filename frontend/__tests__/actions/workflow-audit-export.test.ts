import { describe, expect, it } from "vitest";
import { serializeWorkflowAuditCsv, type WorkflowAuditCsvProjection } from "@/lib/workflows/audit-export";

describe("workflow audit export", () => {
	it("serializes visible audit events as CSV with escaped cells", () => {
		const projection: WorkflowAuditCsvProjection = {
			events: [
				{
					id: "event-1",
					workflowInstanceId: "run-1",
					subjectType: "submission_package",
					subjectId: "sub-1",
					eventType: "approval.recorded",
					fromState: "review",
					toState: "approved",
					actorId: "approver-1",
					actorName: "Approver, One",
					reason: 'Approved "final" package',
					evidenceLinks: ["artifact:sha256:abc", "receipt:123"],
					createdAt: "2026-05-06T00:00:00.000Z",
				},
			],
		};

		expect(serializeWorkflowAuditCsv(projection)).toBe([
			"event_id,workflow_instance_id,subject_type,subject_id,event_type,from_state,to_state,actor_id,actor_name,reason,evidence_links,created_at",
			'event-1,run-1,submission_package,sub-1,approval.recorded,review,approved,approver-1,"Approver, One","Approved ""final"" package",artifact:sha256:abc receipt:123,2026-05-06T00:00:00.000Z',
			"",
		].join("\n"));
	});
});
