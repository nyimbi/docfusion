import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
	requireRouteTenantContext,
	isTenantResponse,
} from "@/lib/auth/route-tenant";
import { db } from "@/lib/db";
import { complianceEntries } from "@/lib/db/schema-rfp";
import { and, eq } from "drizzle-orm";
import {
	transitionComplianceEntryWorkflow,
	type ComplianceEntryWorkflowAction,
} from "@/lib/actions/compliance-validator";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BodySchema = z
	.object({
		action: z.enum([
			"submit_for_review",
			"approve",
			"reject",
			"waive",
			"reopen",
		]),
		reason: z.string().optional(),
	})
	.strict();

export async function POST(
	request: NextRequest,
	context: { params: Promise<{ matrixId: string; entryId: string }> },
): Promise<NextResponse> {
	const ctx = await requireRouteTenantContext();
	if (isTenantResponse(ctx)) return ctx;

	const { matrixId, entryId } = await context.params;
	if (!UUID_RE.test(matrixId) || !UUID_RE.test(entryId)) {
		return NextResponse.json(
			{ error: "Invalid matrixId or entryId" },
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

	// Confirm the entry belongs to the caller's organization. If not, return 404
	// — never let cross-tenant probes distinguish "missing" from "forbidden".
	const entry = await db.query.complianceEntries.findFirst({
		where: and(
			eq(complianceEntries.id, entryId),
			eq(complianceEntries.matrixId, matrixId),
			eq(complianceEntries.organizationId, ctx.organizationId),
		),
	});
	if (!entry) {
		return NextResponse.json(
			{ error: "Compliance entry not found" },
			{ status: 404 },
		);
	}

	try {
		const result = await transitionComplianceEntryWorkflow({
			matrixId,
			entryId,
			action: parsed.data.action as ComplianceEntryWorkflowAction,
			reason: parsed.data.reason ?? "",
		});
		return NextResponse.json(result);
	} catch (error) {
		console.error("Compliance workflow transition failed", error);
		return NextResponse.json(
			{ error: "Workflow transition failed" },
			{ status: 500 },
		);
	}
}
