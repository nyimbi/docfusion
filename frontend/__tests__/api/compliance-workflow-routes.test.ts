import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { WorkflowAuthorityDeniedError } from "@/lib/workflows/authority-error";

const dbMock = vi.hoisted(() => ({
	query: {
		complianceMatrices: { findFirst: vi.fn() },
		complianceEntries: { findFirst: vi.fn() },
	},
}));
const transitionComplianceMatrixWorkflowMock = vi.hoisted(() => vi.fn());
const transitionComplianceEntryWorkflowMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/route-tenant", () => ({
	requireRouteTenantContext: vi.fn(async () => ({
		userId: "compliance-user-1",
		organizationId: "org-1",
	})),
	isTenantResponse: vi.fn(() => false),
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((left, right) => ({ op: "eq", left, right })),
	and: vi.fn((...conditions) => ({ op: "and", conditions })),
}));

vi.mock("@/lib/db", () => ({
	db: dbMock,
}));

vi.mock("@/lib/db/schema-rfp", () => ({
	complianceMatrices: {
		id: "compliance_matrices.id",
		organizationId: "compliance_matrices.organization_id",
	},
	complianceEntries: {
		id: "compliance_entries.id",
		matrixId: "compliance_entries.matrix_id",
		organizationId: "compliance_entries.organization_id",
	},
}));

vi.mock("@/lib/actions/compliance-validator", () => ({
	transitionComplianceMatrixWorkflow: transitionComplianceMatrixWorkflowMock,
	transitionComplianceEntryWorkflow: transitionComplianceEntryWorkflowMock,
}));

import { POST as postMatrixWorkflow } from "@/app/api/v1/compliance-matrix/[matrixId]/workflow/route";
import { POST as postEntryWorkflow } from "@/app/api/v1/compliance-matrix/[matrixId]/entries/[entryId]/workflow/route";

const MATRIX_ID = "11111111-1111-4111-8111-111111111111";
const ENTRY_ID = "22222222-2222-4222-8222-222222222222";

function request(url: string, body: Record<string, unknown>) {
	return new NextRequest(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.query.complianceMatrices.findFirst.mockResolvedValue({ id: MATRIX_ID });
	dbMock.query.complianceEntries.findFirst.mockResolvedValue({ id: ENTRY_ID, matrixId: MATRIX_ID });
	transitionComplianceMatrixWorkflowMock.mockResolvedValue({ matrixId: MATRIX_ID, state: "locked" });
	transitionComplianceEntryWorkflowMock.mockResolvedValue({ matrixId: MATRIX_ID, entryId: ENTRY_ID, state: "approved" });
});

describe("compliance workflow API routes", () => {
	it("maps compliance matrix authority denials to a generic 403", async () => {
		transitionComplianceMatrixWorkflowMock.mockRejectedValueOnce(new WorkflowAuthorityDeniedError({
			action: "lock final compliance matrix requires compliance authority",
			requiredRoles: ["proposal_manager", "compliance_officer"],
		}));

		const response = await postMatrixWorkflow(
			request(`https://app.test/api/v1/compliance-matrix/${MATRIX_ID}/workflow`, {
				action: "lock_final",
				reason: "Ready to lock",
			}),
			{ params: Promise.resolve({ matrixId: MATRIX_ID }) },
		);
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toEqual({ error: "Forbidden" });
		expect(JSON.stringify(body)).not.toContain("proposal_manager");
	});

	it("maps compliance entry authority denials to a generic 403", async () => {
		transitionComplianceEntryWorkflowMock.mockRejectedValueOnce(new WorkflowAuthorityDeniedError({
			action: "approve compliance entry requires compliance authority",
			requiredRoles: ["compliance_officer", "proposal_manager"],
		}));

		const response = await postEntryWorkflow(
			request(`https://app.test/api/v1/compliance-matrix/${MATRIX_ID}/entries/${ENTRY_ID}/workflow`, {
				action: "approve",
				reason: "Verified evidence",
			}),
			{ params: Promise.resolve({ matrixId: MATRIX_ID, entryId: ENTRY_ID }) },
		);
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toEqual({ error: "Forbidden" });
		expect(JSON.stringify(body)).not.toContain("compliance_officer");
	});

	it("keeps non-authority entry failures as workflow transition errors", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		transitionComplianceEntryWorkflowMock.mockRejectedValueOnce(new Error("Cannot approve from draft"));

		const response = await postEntryWorkflow(
			request(`https://app.test/api/v1/compliance-matrix/${MATRIX_ID}/entries/${ENTRY_ID}/workflow`, {
				action: "approve",
				reason: "Verified evidence",
			}),
			{ params: Promise.resolve({ matrixId: MATRIX_ID, entryId: ENTRY_ID }) },
		);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: "Workflow transition failed" });
		expect(consoleError).toHaveBeenCalledWith(
			"Compliance workflow transition failed",
			expect.any(Error),
		);
		consoleError.mockRestore();
	});
});
