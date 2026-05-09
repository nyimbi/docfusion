/**
 * RFP Parse API Route
 *
 * Triggers parsing of an uploaded RFP document.
 */

import { NextRequest, NextResponse } from "next/server";
import {
	requireRouteTenantContext,
	isTenantResponse,
} from "@/lib/auth/route-tenant";
import { db } from "@/lib/db";
import { rfpDocuments, rfpParsingJobs } from "@/lib/db/schema-rfp";
import { and, eq, ne } from "drizzle-orm";
import {
	processRfpParsingJob,
	transitionRfpParseWorkflow,
} from "@/lib/actions/rfp-parser";
import { getLinodeE3ConfigFromEnv } from "@/lib/storage/linode-e3";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";
const USE_PYTHON_RFP = process.env.USE_PYTHON_RFP !== "false";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================================
// Types
// ============================================================================

interface ParseResponse {
	parsingJobId: string;
	status: string;
	message: string;
}

const RFP_PARSE_WORKFLOW_ACTIONS = new Set(["retry", "reject", "manual_extraction", "cancel"]);

function isRfpParseWorkflowAction(value: unknown): value is "retry" | "reject" | "manual_extraction" | "cancel" {
	return typeof value === "string" && RFP_PARSE_WORKFLOW_ACTIONS.has(value);
}

// ============================================================================
// Handler
// ============================================================================

export async function POST(
	request: NextRequest,
	context: { params: Promise<{ rfpId: string }> }
): Promise<NextResponse> {
	const ctx = await requireRouteTenantContext();
	if (isTenantResponse(ctx)) return ctx;

	const { rfpId } = await context.params;
	if (!UUID_RE.test(rfpId)) {
		return NextResponse.json({ error: "Invalid rfpId" }, { status: 400 });
	}
	const userId = ctx.userId;

	try {
		const objectStoreConfig = getLinodeE3ConfigFromEnv();

		// Get RFP document, scoped to caller's organization.
		const rfpDocument = await db.query.rfpDocuments.findFirst({
			where: and(
				eq(rfpDocuments.id, rfpId),
				eq(rfpDocuments.organizationId, ctx.organizationId),
			),
		});
		const body = await request.json().catch(() => ({}));
		const requestedAction = isRfpParseWorkflowAction(body.action) ? body.action : undefined;
		const transitionReason = typeof body.reason === "string" && body.reason.trim()
			? body.reason
			: requestedAction
				? `${requestedAction} requested from parse API.`
				: "Retry requested from parse API.";

		if (!rfpDocument) {
			// Preserve the legacy Python service path for externally-owned RFP IDs,
			// but never proxy frontend/E3-backed documents away from this runtime.
			if (USE_PYTHON_RFP && !objectStoreConfig) {
				const response = await fetch(`${FASTAPI_URL}/api/v1/rfp/${rfpId}/parse`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
				});
				return NextResponse.json(await response.json(), { status: response.status });
			}

			return NextResponse.json(
				{ error: "RFP document not found" },
				{ status: 404 }
			);
		}

		// Check if already processing
		if (rfpDocument.parsingStatus === "processing") {
			return NextResponse.json(
				{ error: "Document is already being parsed" },
				{ status: 409 }
			);
		}

		if (requestedAction || rfpDocument.parsingStatus === "failed") {
			const action = requestedAction ?? "retry";
			const transition = await transitionRfpParseWorkflow({
				rfpDocumentId: rfpId,
				action,
				reason: transitionReason,
				startProcessing: body.startProcessing === false ? false : undefined,
			});

			if (!transition) {
				return NextResponse.json(
					{ error: "Unable to update parsing workflow" },
					{ status: 409 }
				);
			}

			return NextResponse.json({
				parsingJobId: transition.jobId,
				status: transition.state,
				message: action === "retry"
					? "Parsing retry queued successfully"
					: `Parsing workflow ${action} recorded successfully`,
			}, { status: 202 });
		}

		// Parse request body for options
		let parsingOptions = {
			extractRequirements: true,
			generateEmbeddings: true,
			detectSections: true,
			classifyRequirements: true,
		};

		if (body.options) {
			parsingOptions = { ...parsingOptions, ...body.options };
		}

		// Atomic status transition — only one concurrent caller successfully flips
		// "pending"/"failed" to "processing". The `ne` guard prevents the race
		// where two callers both observed a non-processing status.
		const transitionedRows = await db
			.update(rfpDocuments)
			.set({
				parsingStatus: "processing",
				parsingProgress: 0,
				parsingError: null,
				parsingStartedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(rfpDocuments.id, rfpId),
					eq(rfpDocuments.organizationId, ctx.organizationId),
					ne(rfpDocuments.parsingStatus, "processing"),
				),
			)
			.returning({ id: rfpDocuments.id });

		if (transitionedRows.length === 0) {
			return NextResponse.json(
				{ error: "Document is already being parsed" },
				{ status: 409 },
			);
		}

		// Create new parsing job, tagged with the caller's organization.
		const [parsingJob] = await db
			.insert(rfpParsingJobs)
			.values({
				rfpDocumentId: rfpId,
				organizationId: ctx.organizationId,
				status: "queued",
				currentStep: "upload",
				progress: 0,
				initiatedBy: userId,
				parsingOptions,
			})
			.returning();

		// Trigger background parsing via server action
		processRfpParsingJob({
			jobId: parsingJob.id,
			rfpDocumentId: rfpId,
			tenantContext: { userId: ctx.userId, organizationId: ctx.organizationId },
		}).catch((error: unknown) => {
			console.error("Background parsing job failed:", error);
		});

		const response: ParseResponse = {
			parsingJobId: parsingJob.id,
			status: "queued",
			message: "Parsing job created successfully",
		};

		return NextResponse.json(response, { status: 202 });
	} catch (error) {
		console.error("RFP parse error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
