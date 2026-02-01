/**
 * RFP Parsing Status API Route
 *
 * Returns the current parsing status and progress for an RFP document.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { rfpDocuments, rfpParsingJobs } from "@/lib/db/schema-rfp";
import { eq, desc } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Handler
// ============================================================================

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ rfpId: string }> }
): Promise<NextResponse> {
	try {
		// Authenticate user
		await requireServerSession();

		const { rfpId } = await context.params;

		// Get RFP document
		const rfpDocument = await db.query.rfpDocuments.findFirst({
			where: eq(rfpDocuments.id, rfpId),
		});

		if (!rfpDocument) {
			return NextResponse.json(
				{ error: "RFP document not found" },
				{ status: 404 }
			);
		}

		// Get latest parsing job
		const parsingJob = await db.query.rfpParsingJobs.findFirst({
			where: eq(rfpParsingJobs.rfpDocumentId, rfpId),
			orderBy: desc(rfpParsingJobs.createdAt),
		});

		// Build response
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
			{ status: 500 }
		);
	}
}
