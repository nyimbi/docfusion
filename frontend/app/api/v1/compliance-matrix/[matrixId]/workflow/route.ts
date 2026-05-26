import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
	requireRouteTenantContext,
	isTenantResponse,
} from "@/lib/auth/route-tenant";
import { db } from "@/lib/db";
import { complianceMatrices } from "@/lib/db/schema-rfp";
import { and, eq } from "drizzle-orm";
import {
	transitionComplianceMatrixWorkflow,
	type ComplianceMatrixWorkflowAction,
} from "@/lib/actions/compliance-validator";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BodySchema = z
	.object({
		action: z.enum(["submit_for_review", "lock_final", "reopen"]),
		reason: z.string().optional(),
	})
	.strict();

export async function POST(
	request: NextRequest,
	context: { params: Promise<{ matrixId: string }> },
): Promise<NextResponse> {
	const ctx = await requireRouteTenantContext();
	if (isTenantResponse(ctx)) return ctx;

	const { matrixId } = await context.params;
	if (!UUID_RE.test(matrixId)) {
		return NextResponse.json(
			{ error: "Invalid matrixId" },
			{ status: 400 },
		);
	}

	const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid body", issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	const matrix = await db.query.complianceMatrices.findFirst({
		where: and(
			eq(complianceMatrices.id, matrixId),
			eq(complianceMatrices.organizationId, ctx.organizationId),
		),
	});
	if (!matrix) {
		return NextResponse.json(
			{ error: "Compliance matrix not found" },
			{ status: 404 },
		);
	}

	try {
		const result = await transitionComplianceMatrixWorkflow({
			matrixId,
			action: parsed.data.action as ComplianceMatrixWorkflowAction,
			reason: parsed.data.reason ?? "",
		});
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Workflow transition failed";
		console.error("Compliance matrix workflow transition failed", error);
		return NextResponse.json(
			{ error: message },
			{ status: 500 },
		);
	}
}
