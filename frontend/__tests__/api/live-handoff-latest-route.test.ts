import { beforeEach, describe, expect, it, vi } from "vitest";

const tenantMock = vi.hoisted(() => ({
	isTenantResponse: vi.fn((value: unknown) => value instanceof Response),
	requireRouteTenantContext: vi.fn(),
}));
const latestHandoffMock = vi.hoisted(() => ({
	LatestLivePursuitHandoffNotFoundError: class LatestLivePursuitHandoffNotFoundError extends Error {},
	readLatestLivePursuitHandoff: vi.fn(),
	readLatestLivePursuitHandoffArtifactContent: vi.fn(),
}));
const actionStateMock = vi.hoisted(() => ({
	readLatestLivePursuitHandoffActionAuditEvents: vi.fn(),
	readLatestLivePursuitHandoffActionStates: vi.fn(),
	summarizeLatestLivePursuitHandoffActionReadiness: vi.fn(),
	updateLatestLivePursuitHandoffTaskActionState: vi.fn(),
}));

vi.mock("@/lib/auth/route-tenant", () => tenantMock);
vi.mock("@/lib/services/latest-live-pursuit-handoff", () => latestHandoffMock);
vi.mock("@/lib/services/live-pursuit-handoff-action-state", () => actionStateMock);

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/opportunities/live-handoff/latest/route";
import { GET as readArtifact } from "@/app/api/opportunities/live-handoff/latest/artifacts/route";
import { POST as updateTask } from "@/app/api/opportunities/live-handoff/latest/tasks/[taskId]/route";

const handoffPayload = {
	index: {
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
			tasks: [],
		},
	},
	operatorBriefMarkdown: "# Latest Live Pursuit Handoff",
	artifactLinks: [{
		path: ".omx/logs/platform-completion/live-response-readiness/response-package/cover_letter.md",
		kind: "primary_response",
		label: "Cover Letter",
		title: "UNGM goAML security consultancy",
		sourceRunId: "live_response_readiness_20260528T010842Z",
		sourceKind: "ungm",
	}],
	paths: {
		indexPath: ".omx/state/latest-live-pursuit-handoff.json",
		briefPath: ".omx/state/latest-live-pursuit-handoff.md",
	},
};

beforeEach(() => {
	vi.clearAllMocks();
	tenantMock.requireRouteTenantContext.mockResolvedValue({
		userId: "user-1",
		organizationId: "org-1",
	});
	latestHandoffMock.readLatestLivePursuitHandoff.mockResolvedValue(handoffPayload);
	latestHandoffMock.readLatestLivePursuitHandoffArtifactContent.mockResolvedValue({
		artifact: handoffPayload.artifactLinks[0],
		content: "# Cover Letter",
		contentType: "text/markdown; charset=utf-8",
		filename: "cover_letter.md",
	});
	actionStateMock.readLatestLivePursuitHandoffActionStates.mockResolvedValue({
		"LPH-001": {
			taskId: "LPH-001",
			status: "in_progress",
			assigneeName: "Amina",
			updatedAt: "2026-05-28T01:30:00.000Z",
			updatedByUserId: "user-1",
		},
	});
	actionStateMock.readLatestLivePursuitHandoffActionAuditEvents.mockResolvedValue([{
		eventId: "lhp_20260528_013000000Z_LPH-001",
		runId: "live_pursuit_handoff_20260528T012604Z",
		taskId: "LPH-001",
		taskTitle: "Open package",
		status: "in_progress",
		assigneeName: "Amina",
		evidenceNote: "Started portal work",
		updatedAt: "2026-05-28T01:30:00.000Z",
		updatedByUserId: "user-1",
		auditPath: ".omx/state/latest-live-pursuit-handoff-action-events.md",
	}]);
	actionStateMock.summarizeLatestLivePursuitHandoffActionReadiness.mockReturnValue({
		status: "blocked",
		taskCount: 1,
		completedTaskCount: 0,
		blockedTaskIds: [],
		pendingTaskIds: ["LPH-001"],
		criticalIncompleteTaskIds: ["LPH-001"],
		missingEvidenceTaskIds: [],
		reasons: ["1 critical task incomplete"],
		updatedAt: "2026-05-28T01:30:00.000Z",
	});
	actionStateMock.updateLatestLivePursuitHandoffTaskActionState.mockResolvedValue({
		taskState: {
			taskId: "LPH-001",
			status: "completed",
			assigneeName: "Amina",
			evidenceNote: "Receipt captured",
			receiptUrl: "https://example.test/receipt",
			updatedAt: "2026-05-28T01:35:00.000Z",
			updatedByUserId: "user-1",
		},
		auditEvent: {
			eventId: "lhp_20260528_013500000Z_LPH-001",
			runId: "live_pursuit_handoff_20260528T012604Z",
			taskId: "LPH-001",
			taskTitle: "Open package",
			status: "completed",
			assigneeName: "Amina",
			evidenceNote: "Receipt captured",
			receiptUrl: "https://example.test/receipt",
			updatedAt: "2026-05-28T01:35:00.000Z",
			updatedByUserId: "user-1",
			auditPath: ".omx/state/latest-live-pursuit-handoff-action-events.md",
		},
		actionReadiness: {
			status: "ready_for_submission",
			taskCount: 1,
			completedTaskCount: 1,
			blockedTaskIds: [],
			pendingTaskIds: [],
			criticalIncompleteTaskIds: [],
			missingEvidenceTaskIds: [],
			reasons: ["All handoff tasks are complete with evidence"],
			updatedAt: "2026-05-28T01:35:00.000Z",
		},
	});
});

describe("latest live pursuit handoff route", () => {
	it("requires tenant context before reading proof artifacts", async () => {
		tenantMock.requireRouteTenantContext.mockResolvedValueOnce(
			NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
		);

		const response = await GET();

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Unauthorized" });
		expect(latestHandoffMock.readLatestLivePursuitHandoff).not.toHaveBeenCalled();
	});

	it("returns the latest live pursuit handoff for authenticated operators", async () => {
		const response = await GET();

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			handoff: {
				...handoffPayload,
				actionStates: {
					"LPH-001": {
						taskId: "LPH-001",
						status: "in_progress",
						assigneeName: "Amina",
						updatedAt: "2026-05-28T01:30:00.000Z",
						updatedByUserId: "user-1",
					},
				},
				actionEvents: [{
					eventId: "lhp_20260528_013000000Z_LPH-001",
					runId: "live_pursuit_handoff_20260528T012604Z",
					taskId: "LPH-001",
					taskTitle: "Open package",
					status: "in_progress",
					assigneeName: "Amina",
					evidenceNote: "Started portal work",
					updatedAt: "2026-05-28T01:30:00.000Z",
					updatedByUserId: "user-1",
					auditPath: ".omx/state/latest-live-pursuit-handoff-action-events.md",
				}],
				actionReadiness: {
					status: "blocked",
					taskCount: 1,
					completedTaskCount: 0,
					blockedTaskIds: [],
					pendingTaskIds: ["LPH-001"],
					criticalIncompleteTaskIds: ["LPH-001"],
					missingEvidenceTaskIds: [],
					reasons: ["1 critical task incomplete"],
					updatedAt: "2026-05-28T01:30:00.000Z",
				},
			},
		});
		expect(latestHandoffMock.readLatestLivePursuitHandoff).toHaveBeenCalledOnce();
		expect(actionStateMock.readLatestLivePursuitHandoffActionStates).toHaveBeenCalledWith({
			runId: "live_pursuit_handoff_20260528T012604Z",
		});
		expect(actionStateMock.readLatestLivePursuitHandoffActionAuditEvents).toHaveBeenCalledWith({
			runId: "live_pursuit_handoff_20260528T012604Z",
			limit: 25,
		});
		expect(actionStateMock.summarizeLatestLivePursuitHandoffActionReadiness).toHaveBeenCalledWith({
			tasks: [],
			actionStates: {
				"LPH-001": {
					taskId: "LPH-001",
					status: "in_progress",
					assigneeName: "Amina",
					updatedAt: "2026-05-28T01:30:00.000Z",
					updatedByUserId: "user-1",
				},
			},
		});
	});

	it("returns proof guidance when no latest handoff has been generated", async () => {
		latestHandoffMock.readLatestLivePursuitHandoff.mockRejectedValueOnce(
			new latestHandoffMock.LatestLivePursuitHandoffNotFoundError("Latest live pursuit handoff has not been generated"),
		);

		const response = await GET();

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({
			success: false,
			error: "Latest live pursuit handoff has not been generated",
			proofCommand: "npm run platform:proof -- --run live-pursuit-handoff --include-live-safe",
		});
	});

	it("serves latest handoff artifacts through an authenticated allowlisted route", async () => {
		const response = await readArtifact(
			new NextRequest("https://app.test/api/opportunities/live-handoff/latest/artifacts?path=.omx%2Flogs%2Fplatform-completion%2Flive-response-readiness%2Fresponse-package%2Fcover_letter.md"),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
		expect(response.headers.get("content-disposition")).toContain("cover_letter.md");
		expect(response.headers.get("x-lindela-artifact-kind")).toBe("primary_response");
		expect(await response.text()).toBe("# Cover Letter");
		expect(latestHandoffMock.readLatestLivePursuitHandoffArtifactContent).toHaveBeenCalledWith({
			artifactPath: ".omx/logs/platform-completion/live-response-readiness/response-package/cover_letter.md",
		});
	});

	it("rejects artifact reads without tenant context", async () => {
		tenantMock.requireRouteTenantContext.mockResolvedValueOnce(
			NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
		);

		const response = await readArtifact(
			new NextRequest("https://app.test/api/opportunities/live-handoff/latest/artifacts?path=.env"),
		);

		expect(response.status).toBe(401);
		expect(latestHandoffMock.readLatestLivePursuitHandoffArtifactContent).not.toHaveBeenCalled();
	});

	it("updates task action state with the authenticated user", async () => {
		const response = await updateTask(
			jsonRequest({
				status: "completed",
				assigneeName: " Amina ",
				evidenceNote: " Receipt captured ",
				receiptUrl: " https://example.test/receipt ",
			}),
			{ params: Promise.resolve({ taskId: "LPH-001" }) },
		);

		expect(response.status).toBe(200);
		expect(actionStateMock.updateLatestLivePursuitHandoffTaskActionState).toHaveBeenCalledWith({
			taskId: "LPH-001",
			status: "completed",
			assigneeName: " Amina ",
			evidenceNote: " Receipt captured ",
			receiptUrl: " https://example.test/receipt ",
			updatedByUserId: "user-1",
		});
		expect(await response.json()).toEqual({
			success: true,
			taskState: {
				taskId: "LPH-001",
				status: "completed",
				assigneeName: "Amina",
				evidenceNote: "Receipt captured",
				receiptUrl: "https://example.test/receipt",
				updatedAt: "2026-05-28T01:35:00.000Z",
				updatedByUserId: "user-1",
			},
			auditEvent: {
				eventId: "lhp_20260528_013500000Z_LPH-001",
				runId: "live_pursuit_handoff_20260528T012604Z",
				taskId: "LPH-001",
				taskTitle: "Open package",
				status: "completed",
				assigneeName: "Amina",
				evidenceNote: "Receipt captured",
				receiptUrl: "https://example.test/receipt",
				updatedAt: "2026-05-28T01:35:00.000Z",
				updatedByUserId: "user-1",
				auditPath: ".omx/state/latest-live-pursuit-handoff-action-events.md",
			},
			actionReadiness: {
				status: "ready_for_submission",
				taskCount: 1,
				completedTaskCount: 1,
				blockedTaskIds: [],
				pendingTaskIds: [],
				criticalIncompleteTaskIds: [],
				missingEvidenceTaskIds: [],
				reasons: ["All handoff tasks are complete with evidence"],
				updatedAt: "2026-05-28T01:35:00.000Z",
			},
		});
	});

	it("rejects task updates without tenant context", async () => {
		tenantMock.requireRouteTenantContext.mockResolvedValueOnce(
			NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
		);

		const response = await updateTask(
			jsonRequest({ status: "completed" }),
			{ params: Promise.resolve({ taskId: "LPH-001" }) },
		);

		expect(response.status).toBe(401);
		expect(actionStateMock.updateLatestLivePursuitHandoffTaskActionState).not.toHaveBeenCalled();
	});

	it("returns validation errors from handoff task completion", async () => {
		actionStateMock.updateLatestLivePursuitHandoffTaskActionState.mockRejectedValueOnce(
			new Error("Completed handoff tasks require an evidence note or receipt URL"),
		);

		const response = await updateTask(
			jsonRequest({ status: "completed" }),
			{ params: Promise.resolve({ taskId: "LPH-001" }) },
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			success: false,
			error: "Completed handoff tasks require an evidence note or receipt URL",
		});
	});
});

function jsonRequest(body: Record<string, unknown>) {
	return new NextRequest("https://app.test/api/opportunities/live-handoff/latest/tasks/LPH-001", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}
