import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	readLatestLivePursuitHandoffActionAuditEvents,
	readLatestLivePursuitHandoffActionStates,
	updateLatestLivePursuitHandoffTaskActionState,
} from "@/lib/services/live-pursuit-handoff-action-state";
import type { LatestLivePursuitHandoffIndex } from "@/lib/types/latest-live-pursuit-handoff";

const latestIndex: LatestLivePursuitHandoffIndex = {
	runId: "live_pursuit_handoff_20260528T012604Z",
	updatedAt: "2026-05-28T01:26:04.763Z",
	sourcePortfolio: {
		path: ".omx/logs/platform-completion/portfolio/live-opportunity-portfolio-triage.json",
		rankedCount: 5,
	},
	handoffArtifactPaths: [],
	primaryPursuit: {
		runId: "live_response_readiness_20260528T010842Z",
		sourceKind: "ungm",
		title: "UNGM goAML security consultancy",
	},
	reviewQueueCount: 3,
	artifactCount: 32,
	executionPlan: {
		status: "ready_for_operator_execution",
		taskCount: 1,
		criticalTaskCount: 1,
		tasks: [{
			id: "LPH-001",
			priority: "critical",
			ownerRole: "proposal_manager",
			title: "Activate same-day submission control.",
			sourceRunId: "live_response_readiness_20260528T010842Z",
			sourceKind: "ungm",
			evidenceRequired: ["Receipt evidence captured before deadline"],
			status: "pending_operator_action",
		}],
	},
};

describe("live pursuit handoff action state", () => {
	it("updates task action state only for tasks in the latest handoff", async () => {
		const workspaceRoot = await writeWorkspaceState();

		const update = await updateLatestLivePursuitHandoffTaskActionState({
			workspaceRoot,
			taskId: "LPH-001",
			status: "completed",
			assigneeName: " Amina ",
			evidenceNote: " Receipt | captured ",
			receiptUrl: " https://example.test/receipt ",
			updatedByUserId: "user-1",
		});

		expect(update.taskState).toMatchObject({
			taskId: "LPH-001",
			status: "completed",
			assigneeName: "Amina",
			evidenceNote: "Receipt | captured",
			receiptUrl: "https://example.test/receipt",
			updatedByUserId: "user-1",
		});
		expect(update.auditEvent).toMatchObject({
			runId: latestIndex.runId,
			taskId: "LPH-001",
			taskTitle: "Activate same-day submission control.",
			status: "completed",
			updatedByUserId: "user-1",
			auditPath: ".omx/state/latest-live-pursuit-handoff-action-events.md",
		});
		const states = await readLatestLivePursuitHandoffActionStates({
			workspaceRoot,
			runId: latestIndex.runId,
		});
		expect(states["LPH-001"]).toMatchObject({
			status: "completed",
			assigneeName: "Amina",
		});
		const auditLog = await fs.readFile(
			path.resolve(workspaceRoot, ".omx", "state", "latest-live-pursuit-handoff-action-events.md"),
			"utf8",
		);
		expect(auditLog).toContain("# Latest Live Pursuit Handoff Action Events");
		expect(auditLog).toContain("`LPH-001`");
		expect(auditLog).toContain("completed");
		expect(auditLog).toContain("Receipt \\| captured");
		const auditEvents = await readLatestLivePursuitHandoffActionAuditEvents({
			workspaceRoot,
			runId: latestIndex.runId,
		});
		expect(auditEvents).toHaveLength(1);
		expect(auditEvents[0]).toMatchObject({
			eventId: update.auditEvent.eventId,
			taskId: "LPH-001",
			taskTitle: "Activate same-day submission control.",
			status: "completed",
			assigneeName: "Amina",
			evidenceNote: "Receipt | captured",
			receiptUrl: "https://example.test/receipt",
			auditPath: ".omx/state/latest-live-pursuit-handoff-action-events.md",
		});
	});

	it("rejects unknown tasks instead of creating loose action state", async () => {
		const workspaceRoot = await writeWorkspaceState();

		await expect(updateLatestLivePursuitHandoffTaskActionState({
			workspaceRoot,
			taskId: "LPH-999",
			status: "completed",
			updatedByUserId: "user-1",
		})).rejects.toThrow("Latest live handoff task not found");
	});

	it("requires completion evidence before marking handoff tasks complete", async () => {
		const workspaceRoot = await writeWorkspaceState();

		await expect(updateLatestLivePursuitHandoffTaskActionState({
			workspaceRoot,
			taskId: "LPH-001",
			status: "completed",
			updatedByUserId: "user-1",
		})).rejects.toThrow("Completed handoff tasks require an evidence note or receipt URL");
	});

	it("ignores stale action state from a different handoff run", async () => {
		const workspaceRoot = await writeWorkspaceState();
		const stateDir = path.resolve(workspaceRoot, ".omx", "state");
		await fs.writeFile(
			path.resolve(stateDir, "latest-live-pursuit-handoff-action-state.json"),
			JSON.stringify({
				runId: "old-run",
				updatedAt: "2026-05-27T00:00:00.000Z",
				tasks: {
					"LPH-001": {
						taskId: "LPH-001",
						status: "completed",
						updatedAt: "2026-05-27T00:00:00.000Z",
						updatedByUserId: "user-1",
					},
				},
			}),
			"utf8",
		);

		const states = await readLatestLivePursuitHandoffActionStates({
			workspaceRoot,
			runId: latestIndex.runId,
		});

		expect(states).toEqual({});
	});
});

async function writeWorkspaceState(): Promise<string> {
	const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "handoff-action-state-"));
	const stateDir = path.resolve(workspaceRoot, ".omx", "state");
	await fs.mkdir(stateDir, { recursive: true });
	await fs.writeFile(
		path.resolve(stateDir, "latest-live-pursuit-handoff.json"),
		`${JSON.stringify(latestIndex, null, 2)}\n`,
		"utf8",
	);
	await fs.writeFile(
		path.resolve(stateDir, "latest-live-pursuit-handoff.md"),
		`# Latest Live Pursuit Handoff\n\nRun: \`${latestIndex.runId}\`\n\n## Execution Checklist\n`,
		"utf8",
	);
	return workspaceRoot;
}
