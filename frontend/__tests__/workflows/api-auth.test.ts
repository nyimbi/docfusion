import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

var authMock: ReturnType<typeof vi.fn>;
var checkPermissionMock: ReturnType<typeof vi.fn>;

vi.mock("@/lib/auth", () => ({
	auth: authMock = vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
	checkPermission: checkPermissionMock = vi.fn(),
}));

import { isWorkflowApiResponse, requireWorkflowApiActor } from "@/lib/workflows/api-auth";

beforeEach(() => {
	vi.clearAllMocks();
	delete process.env.WORKFLOW_CRON_SECRET;
	delete process.env.CRON_SECRET;
});

describe("workflow API auth", () => {
	it("rejects unauthenticated workflow API calls", async () => {
		authMock.mockResolvedValueOnce(null);

		const result = await requireWorkflowApiActor(new NextRequest("https://app.test/api/v1/workflows/dashboard"));

		expect(isWorkflowApiResponse(result)).toBe(true);
		if (isWorkflowApiResponse(result)) {
			expect(result.status).toBe(401);
		}
	});

	it("allows scheduler calls only with the configured secret", async () => {
		process.env.WORKFLOW_CRON_SECRET = "secret";
		const request = new NextRequest("https://app.test/api/v1/workflows/sla/evaluate", {
			headers: { "x-cron-secret": "secret" },
		});

		const result = await requireWorkflowApiActor(request, { allowScheduler: true, permission: "admin" });

		expect(isWorkflowApiResponse(result)).toBe(false);
		if (!isWorkflowApiResponse(result)) {
			expect(result).toMatchObject({
				userId: "system",
				isSystem: true,
			});
		}
		expect(authMock).not.toHaveBeenCalled();
	});

	it("enforces admin roles for privileged workflow API actions", async () => {
		authMock.mockResolvedValueOnce({ user: { id: "user-1", role: "writer" } });

		const result = await requireWorkflowApiActor(
			new NextRequest("https://app.test/api/v1/workflows/templates"),
			{ permission: "admin" }
		);

		expect(isWorkflowApiResponse(result)).toBe(true);
		if (isWorkflowApiResponse(result)) {
			expect(result.status).toBe(403);
		}
	});

	it("requires SpiceDB permission or an admin override when a resource is supplied", async () => {
		authMock.mockResolvedValueOnce({ user: { id: "user-1", role: "writer" } });
		checkPermissionMock.mockResolvedValueOnce(false);

		const denied = await requireWorkflowApiActor(
			new NextRequest("https://app.test/api/v1/workflows/workflow-1/transition"),
			{
				permission: "write",
				resourceType: "workflow_instance",
				resourceId: "workflow-1",
			}
		);

		expect(isWorkflowApiResponse(denied)).toBe(true);
		if (isWorkflowApiResponse(denied)) {
			expect(denied.status).toBe(403);
		}

		authMock.mockResolvedValueOnce({ user: { id: "admin-1", role: "admin" } });
		checkPermissionMock.mockResolvedValueOnce(false);
		const allowed = await requireWorkflowApiActor(
			new NextRequest("https://app.test/api/v1/workflows/workflow-1/transition"),
			{
				permission: "write",
				resourceType: "workflow_instance",
				resourceId: "workflow-1",
			}
		);

		expect(isWorkflowApiResponse(allowed)).toBe(false);
	});
});
