/**
 * RFP Parse API Route
 *
 * Triggers parsing of an uploaded RFP document.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { rfpDocuments, rfpParsingJobs } from "@/lib/db/schema-rfp";
import { eq } from "drizzle-orm";
import { processRfpParsingJob } from "@/lib/actions/rfp-parser";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";
const USE_PYTHON_RFP = process.env.USE_PYTHON_RFP !== "false";

// ============================================================================
// Types
// ============================================================================

interface ParseResponse {
	parsingJobId: string;
	status: string;
	message: string;
}

// ============================================================================
// Handler
// ============================================================================

export async function POST(
	request: NextRequest,
	context: { params: Promise<{ rfpId: string }> }
): Promise<NextResponse> {
	try {
		const { rfpId } = await context.params;

		// Proxy to Python FastAPI when feature flag is enabled
		if (USE_PYTHON_RFP) {
			const response = await fetch(`${FASTAPI_URL}/api/v1/rfp/${rfpId}/parse`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			return NextResponse.json(await response.json(), { status: response.status });
		}

		// Authenticate user
		const session = await requireServerSession();
		const userId = session.user?.id ?? session.user?.email ?? "unknown";

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

		// Check if already processing
		if (rfpDocument.parsingStatus === "processing") {
			return NextResponse.json(
				{ error: "Document is already being parsed" },
				{ status: 409 }
			);
		}

		// Parse request body for options
		let parsingOptions = {
			extractRequirements: true,
			generateEmbeddings: true,
			detectSections: true,
			classifyRequirements: true,
		};

		try {
			const body = await request.json();
			if (body.options) {
				parsingOptions = { ...parsingOptions, ...body.options };
			}
		} catch {
			// No body or invalid JSON - use defaults
		}

		// Update document status
		await db
			.update(rfpDocuments)
			.set({
				parsingStatus: "processing",
				parsingProgress: 0,
				parsingError: null,
				parsingStartedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(rfpDocuments.id, rfpId));

		// Create new parsing job
		const [parsingJob] = await db
			.insert(rfpParsingJobs)
			.values({
				rfpDocumentId: rfpId,
				status: "queued",
				currentStep: "upload",
				progress: 0,
				initiatedBy: userId,
				parsingOptions,
			})
			.returning();

		// Trigger background parsing via server action
		processRfpParsingJob(parsingJob.id, rfpId).catch((error: unknown) => {
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
