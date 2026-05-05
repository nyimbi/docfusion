import { describe, expect, it } from "vitest";
import {
	deriveCommandCenterBlockers,
	deriveCommandCenterNextActions,
	deriveReadinessScore,
	normalizeWorkItems,
	summarizeWorkItems,
	type WorkItem,
} from "@/lib/work-items/projections";

const now = new Date("2026-05-05T12:00:00.000Z");

describe("work item projections", () => {
	it("prioritizes critical overdue and blocked work for the operational inbox", () => {
		const items: WorkItem[] = [
			{
				id: "task:low",
				kind: "task",
				title: "Low priority future task",
				status: "open",
				priority: "low",
				dueAt: "2026-05-12T12:00:00.000Z",
				source: "proposal_task",
			},
			{
				id: "workflow:breached",
				kind: "workflow",
				title: "Parse remediation",
				status: "breached",
				priority: "critical",
				dueAt: "2026-05-04T12:00:00.000Z",
				source: "workflow_runtime",
			},
			{
				id: "notification:failed",
				kind: "notification",
				title: "Failed notification",
				status: "failed",
				priority: "high",
				source: "workflow_notification",
			},
		];

		const normalized = normalizeWorkItems(items, now);
		expect(normalized.map((item) => item.id)).toEqual([
			"workflow:breached",
			"notification:failed",
			"task:low",
		]);
		expect(normalized[0]?.blocker).toBe("SLA breached");

		const summary = summarizeWorkItems(normalized, now);
		expect(summary).toMatchObject({
			total: 3,
			open: 2,
			blocked: 2,
			overdue: 1,
			critical: 1,
		});
	});

	it("derives command center blockers, next actions, and readiness reasons", () => {
		const items: WorkItem[] = [
			{
				id: "workflow:approval",
				kind: "workflow",
				title: "Final approval",
				status: "waiting",
				priority: "high",
				dueAt: "2026-05-06T12:00:00.000Z",
				actionUrl: "/workflows",
				source: "workflow_runtime",
			},
			{
				id: "task:evidence",
				kind: "task",
				title: "Add evidence",
				status: "blocked",
				priority: "critical",
				dueAt: "2026-05-05T08:00:00.000Z",
				actionUrl: "/tasks",
				source: "proposal_task",
			},
		];

		const blockers = deriveCommandCenterBlockers(items, now);
		const actions = deriveCommandCenterNextActions(items, now);
		const readiness = deriveReadinessScore(items, now);

		expect(blockers).toEqual([
			expect.objectContaining({
				id: "task:evidence",
				label: "Blocked work item",
				severity: "critical",
			}),
		]);
		expect(actions.map((action) => action.id)).toEqual(["task:evidence", "workflow:approval"]);
		expect(readiness.label).toBe("blocked");
		expect(readiness.reasons).toContain("1 blocker");
		expect(readiness.reasons).toContain("1 overdue item");
	});
});
