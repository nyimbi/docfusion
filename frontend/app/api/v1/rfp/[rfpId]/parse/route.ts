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
		// Authenticate user
		const session = await requireServerSession();
		const userId = session.user?.id ?? session.user?.email ?? "unknown";

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

		// In production, trigger async parsing job here
		// This would typically send a message to a queue (e.g., Redis, SQS)
		// await triggerParsingJob(parsingJob.id);

		// For demo purposes, simulate job processing in background
		// In production, this would be handled by a separate worker
		simulateParsingJob(parsingJob.id, rfpId);

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

// ============================================================================
// Demo: Simulated parsing job (replace with actual implementation)
// ============================================================================

async function simulateParsingJob(jobId: string, documentId: string): Promise<void> {
	const steps = [
		{ step: "text_extraction", progress: 20 },
		{ step: "section_detection", progress: 40 },
		{ step: "requirement_extraction", progress: 60 },
		{ step: "classification", progress: 80 },
		{ step: "embedding", progress: 100 },
	];

	try {
		for (const { step, progress } of steps) {
			// Wait 2 seconds per step
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// Update job progress
			await db
				.update(rfpParsingJobs)
				.set({
					status: "processing",
					currentStep: step,
					progress,
					updatedAt: new Date(),
				})
				.where(eq(rfpParsingJobs.id, jobId));

			// Update document progress
			await db
				.update(rfpDocuments)
				.set({
					parsingProgress: progress,
					updatedAt: new Date(),
				})
				.where(eq(rfpDocuments.id, documentId));
		}

		// Mark as completed
		await db
			.update(rfpParsingJobs)
			.set({
				status: "completed",
				currentStep: null,
				progress: 100,
				completedAt: new Date(),
				processingTimeMs: 10000,
				pagesProcessed: Math.floor(Math.random() * 50) + 10,
				requirementsExtracted: Math.floor(Math.random() * 100) + 20,
				updatedAt: new Date(),
			})
			.where(eq(rfpParsingJobs.id, jobId));

		await db
			.update(rfpDocuments)
			.set({
				parsingStatus: "completed",
				parsingProgress: 100,
				parsingCompletedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(rfpDocuments.id, documentId));
	} catch (error) {
		// Mark as failed
		await db
			.update(rfpParsingJobs)
			.set({
				status: "failed",
				errorMessage: error instanceof Error ? error.message : "Parsing failed",
				completedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(rfpParsingJobs.id, jobId));

		await db
			.update(rfpDocuments)
			.set({
				parsingStatus: "failed",
				parsingError: error instanceof Error ? error.message : "Parsing failed",
				updatedAt: new Date(),
			})
			.where(eq(rfpDocuments.id, documentId));
	}
}
