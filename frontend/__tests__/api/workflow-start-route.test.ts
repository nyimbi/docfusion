import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { WorkflowAuthorityDeniedError } from "@/lib/workflows/authority-error";

const authMock = vi.hoisted(() => vi.fn());
const startWorkflowMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/authz", () => ({ checkPermission: vi.fn() }));
vi.mock("@/lib/actions/workflow-domain", () => ({
	startDomainWorkflowFromTemplate: startWorkflowMock,
}));

import { POST } from "@/app/api/v1/workflows/start/route";

function startRequest(body: Record<string, unknown>) {
	return new NextRequest("https://app.test/api/v1/workflows/start", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	authMock.mockResolvedValue({ user: { id: "writer-1", role: "writer", roles: ["writer"] } });
	startWorkflowMock.mockResolvedValue({ id: "workflow-1", state: "started" });
});

describe("workflow start route", () => {
	it("returns a generic 403 for workflow authority denials", async () => {
		startWorkflowMock.mockRejectedValueOnce(new WorkflowAuthorityDeniedError({
			action: "start",
			requiredRoles: ["finance_approver"],
		}));

		const response = await POST(startRequest({
			templateKey: "pricing_approval",
			subjectId: "subject-1",
		}));
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toEqual({ error: "Forbidden" });
		expect(JSON.stringify(body)).not.toContain("finance_approver");
	});

	it("keeps malformed request bodies as 400 validation failures", async () => {
		const response = await POST(startRequest({ templateKey: "pricing_approval" }));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "templateKey and subjectId are required",
		});
		expect(startWorkflowMock).not.toHaveBeenCalled();
	});

	it("keeps non-forbidden domain failures as 400 responses", async () => {
		startWorkflowMock.mockRejectedValueOnce(new Error("Active workflow template missing_template was not found"));

		const response = await POST(startRequest({
			templateKey: "missing_template",
			subjectId: "subject-1",
		}));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Active workflow template missing_template was not found",
		});
	});
});
