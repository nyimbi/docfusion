import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const requireWorkflowApiActorMock = vi.hoisted(() => vi.fn());
const buildWorkflowViewerScopeMock = vi.hoisted(() => vi.fn());
const getProjectionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/workflows/api-auth", () => ({
	requireWorkflowApiActor: requireWorkflowApiActorMock,
	isWorkflowApiResponse: (value: unknown) => value instanceof Response,
}));

vi.mock("@/lib/workflows/viewer-scope", () => ({
	buildWorkflowViewerScope: buildWorkflowViewerScopeMock,
}));

vi.mock("@/lib/actions/workflow-audit", () => ({
	getWorkflowAuditExplorerProjectionForScope: getProjectionMock,
}));

import { GET } from "@/app/api/v1/workflows/audit/export/route";

describe("workflow audit export route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireWorkflowApiActorMock.mockResolvedValue({
			id: "admin-1",
			userId: "admin-1",
			roles: ["admin"],
		});
		buildWorkflowViewerScopeMock.mockReturnValue({
			userId: "admin-1",
			isGlobalWorkflowViewer: true,
		});
		getProjectionMock.mockResolvedValue({
			events: [
				{
					id: "event-1",
					workflowInstanceId: "run-1",
					subjectType: "submission_package",
					subjectId: "sub-1",
					eventType: "submitted",
					fromState: "ready",
					toState: "submitted",
					actorId: "admin-1",
					actorName: "Admin",
					reason: "Receipt captured",
					evidenceLinks: [],
					metadata: {},
					createdAt: "2026-05-06T00:00:00.000Z",
				},
			],
		});
	});

	it("exports scoped audit events as downloadable CSV", async () => {
		const request = new NextRequest(
			"https://app.test/api/v1/workflows/audit/export?runId=run-1&subjectType=submission_package&limit=25",
		);

		const response = await GET(request);
		const body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/csv");
		expect(response.headers.get("content-disposition")).toContain("workflow-audit-");
		expect(body).toContain("event_id,workflow_instance_id,subject_type");
		expect(body).toContain("event-1,run-1,submission_package,sub-1,submitted");
		expect(requireWorkflowApiActorMock).toHaveBeenCalledWith(request, { permission: "read" });
		expect(getProjectionMock).toHaveBeenCalledWith(
			{ userId: "admin-1", isGlobalWorkflowViewer: true },
			expect.objectContaining({
				runId: "run-1",
				subjectType: "submission_package",
				limit: 25,
			}),
		);
	});

	it("returns auth failures from the workflow API guard", async () => {
		requireWorkflowApiActorMock.mockResolvedValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));

		const response = await GET(new NextRequest("https://app.test/api/v1/workflows/audit/export"));

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Unauthorized" });
		expect(getProjectionMock).not.toHaveBeenCalled();
	});
});

