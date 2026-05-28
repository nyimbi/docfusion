import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	LatestLivePursuitHandoffNotFoundError,
	readLatestLivePursuitHandoff,
	readLatestLivePursuitHandoffArtifactContent,
} from "@/lib/services/latest-live-pursuit-handoff";
import type { LatestLivePursuitHandoffIndex } from "@/lib/types/latest-live-pursuit-handoff";

const latestIndex: LatestLivePursuitHandoffIndex = {
	runId: "live_pursuit_handoff_20260528T012604Z",
	updatedAt: "2026-05-28T01:26:04.763Z",
	sourcePortfolio: {
		runId: "live_opportunity_portfolio_triage_20260528T010913Z",
		path: ".omx/logs/platform-completion/portfolio/live-opportunity-portfolio-triage.json",
		completedAt: "2026-05-28T01:09:13.687Z",
		rankedCount: 5,
	},
	handoffArtifactPaths: [
		".omx/logs/platform-completion/live-pursuit-handoff/live-pursuit-handoff.json",
		".omx/logs/platform-completion/live-pursuit-handoff/live-pursuit-handoff.md",
	],
	primaryPursuit: {
		runId: "live_response_readiness_20260528T010842Z",
		sourceKind: "ungm",
		title: "UNGM goAML security consultancy",
		deadline: "2026-05-28",
		deadlineUrgency: "critical",
		portalUrl: "https://www.ungm.org/Public/Notice/300700",
		documentUrl: "https://www.un.org/Depts/ptd/sites/www.un.org.Depts.ptd/files/pdf/eoi24414.pdf",
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
			dueLabel: "2026-05-28",
			evidenceRequired: ["Receipt evidence captured before deadline"],
			status: "pending_operator_action",
		}],
	},
};

describe("latest live pursuit handoff reader", () => {
	it("reads the latest index and markdown brief from workspace state", async () => {
		const workspaceRoot = await writeWorkspaceState(
			latestIndex,
			`# Latest Live Pursuit Handoff\n\nRun: \`${latestIndex.runId}\`\n\n## Execution Checklist\n`,
		);

		const handoff = await readLatestLivePursuitHandoff({ workspaceRoot });

		expect(handoff.index.primaryPursuit.title).toBe("UNGM goAML security consultancy");
		expect(handoff.index.executionPlan.criticalTaskCount).toBe(1);
		expect(handoff.operatorBriefMarkdown).toContain("## Execution Checklist");
		expect(handoff.artifactLinks).toEqual(expect.arrayContaining([
			expect.objectContaining({
				kind: "handoff",
				label: "Live Pursuit Handoff",
				path: ".omx/logs/platform-completion/live-pursuit-handoff/live-pursuit-handoff.json",
			}),
			expect.objectContaining({
				kind: "primary_response",
				label: "Cover Letter",
				path: ".omx/logs/platform-completion/live-response-readiness/response-package/cover_letter.md",
				sourceRunId: "live_response_readiness_20260528T010842Z",
			}),
		]));
		expect(handoff.actionReadiness).toMatchObject({
			status: "blocked",
			taskCount: 1,
			completedTaskCount: 0,
			pendingTaskIds: ["LPH-001"],
			criticalIncompleteTaskIds: ["LPH-001"],
		});
		expect(handoff.paths).toEqual({
			indexPath: ".omx/state/latest-live-pursuit-handoff.json",
			briefPath: ".omx/state/latest-live-pursuit-handoff.md",
		});
	});

	it("throws a typed not-found error when the latest handoff has not been generated", async () => {
		const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "latest-handoff-missing-"));

		await expect(readLatestLivePursuitHandoff({ workspaceRoot }))
			.rejects.toBeInstanceOf(LatestLivePursuitHandoffNotFoundError);
	});

	it("reads only artifacts linked by the latest handoff", async () => {
		const workspaceRoot = await writeWorkspaceState(
			latestIndex,
			`# Latest Live Pursuit Handoff\n\nRun: \`${latestIndex.runId}\`\n\n## Execution Checklist\n`,
		);
		const artifactPath = ".omx/logs/platform-completion/live-response-readiness/response-package/cover_letter.md";
		await fs.mkdir(path.resolve(workspaceRoot, ".omx", "logs", "platform-completion", "live-response-readiness", "response-package"), { recursive: true });
		await fs.writeFile(
			path.resolve(workspaceRoot, artifactPath),
			"# Cover Letter\n\nSource-backed response.",
			"utf8",
		);

		const artifact = await readLatestLivePursuitHandoffArtifactContent({
			workspaceRoot,
			artifactPath,
		});

		expect(artifact).toMatchObject({
			content: "# Cover Letter\n\nSource-backed response.",
			contentType: "text/markdown; charset=utf-8",
			filename: "cover_letter.md",
			artifact: {
				kind: "primary_response",
				label: "Cover Letter",
			},
		});
		await expect(readLatestLivePursuitHandoffArtifactContent({
			workspaceRoot,
			artifactPath: ".env",
		})).rejects.toThrow("not part of the latest live handoff");
	});

	it("rejects stale markdown that does not match the indexed run", async () => {
		const workspaceRoot = await writeWorkspaceState(
			latestIndex,
			"# Latest Live Pursuit Handoff\n\nRun: `different`\n\n## Execution Checklist\n",
		);

		await expect(readLatestLivePursuitHandoff({ workspaceRoot }))
			.rejects.toThrow("brief does not match");
	});
});

async function writeWorkspaceState(
	index: LatestLivePursuitHandoffIndex,
	markdown: string,
): Promise<string> {
	const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "latest-handoff-"));
	const stateDir = path.resolve(workspaceRoot, ".omx", "state");
	await fs.mkdir(stateDir, { recursive: true });
	await fs.writeFile(
		path.resolve(stateDir, "latest-live-pursuit-handoff.json"),
		`${JSON.stringify(index, null, 2)}\n`,
		"utf8",
	);
	await fs.writeFile(
		path.resolve(stateDir, "latest-live-pursuit-handoff.md"),
		markdown,
		"utf8",
	);
	const handoffPath = path.resolve(workspaceRoot, ".omx", "logs", "platform-completion", "live-pursuit-handoff", "live-pursuit-handoff.json");
	await fs.mkdir(path.dirname(handoffPath), { recursive: true });
	await fs.writeFile(
		handoffPath,
		JSON.stringify({
			primaryPursuit: {
				runId: index.primaryPursuit.runId,
				sourceKind: index.primaryPursuit.sourceKind,
				title: index.primaryPursuit.title,
				responseArtifactPaths: [
					".omx/logs/platform-completion/live-response-readiness/response-package/cover_letter.md",
				],
			},
		}),
		"utf8",
	);
	return workspaceRoot;
}
