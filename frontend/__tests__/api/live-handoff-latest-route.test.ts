import { beforeEach, describe, expect, it, vi } from "vitest";

const tenantMock = vi.hoisted(() => ({
	isTenantResponse: vi.fn((value: unknown) => value instanceof Response),
	requireRouteTenantContext: vi.fn(),
}));
const latestHandoffMock = vi.hoisted(() => ({
	LatestLivePursuitHandoffNotFoundError: class LatestLivePursuitHandoffNotFoundError extends Error {},
	readLatestLivePursuitHandoff: vi.fn(),
}));
const actionStateMock = vi.hoisted(() => ({
	readLatestLivePursuitHandoffActionStates: vi.fn(),
	updateLatestLivePursuitHandoffTaskActionState: vi.fn(),
}));

vi.mock("@/lib/auth/route-tenant", () => tenantMock);
vi.mock("@/lib/services/latest-live-pursuit-handoff", () => latestHandoffMock);
vi.mock("@/lib/services/live-pursuit-handoff-action-state", () => actionStateMock);

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/opportunities/live-handoff/latest/route";
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
	actionStateMock.readLatestLivePursuitHandoffActionStates.mockResolvedValue({
		"LPH-001": {
			taskId: "LPH-001",
			status: "in_progress",
			assigneeName: "Amina",
			updatedAt: "2026-05-28T01:30:00.000Z",
			updatedByUserId: "user-1",
		},
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
			updatedAt: "2026-05-28T01:35:00.000Z",
			updatedByUserId: "user-1",
			auditPath: ".omx/state/latest-live-pursuit-handoff-action-events.md",
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
			},
		});
		expect(latestHandoffMock.readLatestLivePursuitHandoff).toHaveBeenCalledOnce();
		expect(actionStateMock.readLatestLivePursuitHandoffActionStates).toHaveBeenCalledWith({
			runId: "live_pursuit_handoff_20260528T012604Z",
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
				updatedAt: "2026-05-28T01:35:00.000Z",
				updatedByUserId: "user-1",
				auditPath: ".omx/state/latest-live-pursuit-handoff-action-events.md",
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
});

function jsonRequest(body: Record<string, unknown>) {
	return new NextRequest("https://app.test/api/opportunities/live-handoff/latest/tasks/LPH-001", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}
