/**
 * RFP Parsing Status API Route
 *
 * Returns the current parsing status and progress for an RFP document,
 * scoped to the caller's organization.
 */

import { NextRequest, NextResponse } from "next/server";
import {
	requireRouteTenantContext,
	isTenantResponse,
} from "@/lib/auth/route-tenant";
import { db } from "@/lib/db";
import { rfpDocuments, rfpParsingJobs } from "@/lib/db/schema-rfp";
import { and, eq, desc } from "drizzle-orm";

interface ParsingStatusResponse {
	status: "queued" | "processing" | "completed" | "failed" | "cancelled";
	currentStep: string | null;
	progress: number;
	pagesProcessed: number | null;
	requirementsExtracted: number | null;
	processingTimeMs: number | null;
	errorMessage: string | null;
	documentId: string;
	filename: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
	_request: NextRequest,
	context: { params: Promise<{ rfpId: string }> },
): Promise<NextResponse> {
	const ctx = await requireRouteTenantContext();
	if (isTenantResponse(ctx)) return ctx;

	const { rfpId } = await context.params;
	if (!UUID_RE.test(rfpId)) {
		return NextResponse.json({ error: "Invalid rfpId" }, { status: 400 });
	}

	try {
		const rfpDocument = await db.query.rfpDocuments.findFirst({
			where: and(
				eq(rfpDocuments.id, rfpId),
				eq(rfpDocuments.organizationId, ctx.organizationId),
			),
		});

		if (!rfpDocument) {
			return NextResponse.json(
				{ error: "RFP document not found" },
				{ status: 404 },
			);
		}

		const parsingJob = await db.query.rfpParsingJobs.findFirst({
			where: and(
				eq(rfpParsingJobs.rfpDocumentId, rfpId),
				eq(rfpParsingJobs.organizationId, ctx.organizationId),
			),
			orderBy: desc(rfpParsingJobs.createdAt),
		});

		const response: ParsingStatusResponse = {
			status: (parsingJob?.status ?? rfpDocument.parsingStatus) as ParsingStatusResponse["status"],
			currentStep: parsingJob?.currentStep ?? null,
			progress: parsingJob?.progress ?? rfpDocument.parsingProgress ?? 0,
			pagesProcessed: parsingJob?.pagesProcessed ?? rfpDocument.pageCount ?? null,
			requirementsExtracted: parsingJob?.requirementsExtracted ?? null,
			processingTimeMs: parsingJob?.processingTimeMs ?? null,
			errorMessage: parsingJob?.errorMessage ?? rfpDocument.parsingError ?? null,
			documentId: rfpDocument.id,
			filename: rfpDocument.filename,
		};

		return NextResponse.json(response);
	} catch (error) {
		console.error("RFP status error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
