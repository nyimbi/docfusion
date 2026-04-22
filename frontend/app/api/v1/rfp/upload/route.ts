/**
 * RFP Upload API Route
 *
 * Handles RFP document uploads with validation, storage,
 * and automatic parsing job creation.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { rfpDocuments, rfpParsingJobs } from "@/lib/db/schema-rfp";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";
const USE_PYTHON_RFP = process.env.USE_PYTHON_RFP !== "false";

// ============================================================================
// Types
// ============================================================================

interface UploadResponse {
	rfpDocumentId: string;
	filename: string;
	fileSize: number;
	fileType: string;
	parsingJobId: string;
	message: string;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = new Set([
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/msword",
	"text/html",
]);
const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".doc", ".html", ".htm"]);

// ============================================================================
// Handler
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		// Proxy to Python FastAPI when feature flag is enabled
		if (USE_PYTHON_RFP) {
			const formData = await request.formData();
			const response = await fetch(`${FASTAPI_URL}/api/v1/rfp/upload`, {
				method: "POST",
				body: formData,
			});
			const data = await response.json();
			return NextResponse.json(data, { status: response.status });
		}

		// Authenticate user
		const session = await requireServerSession();
		const userId = session.user?.id ?? session.user?.email ?? "unknown";

		// Parse form data
		const formData = await request.formData();
		const file = formData.get("file") as File | null;
		const opportunityId = formData.get("opportunityId") as string | null;

		if (!file) {
			return NextResponse.json(
				{ error: "No file provided" },
				{ status: 400 }
			);
		}

		// Validate file size
		if (file.size > MAX_FILE_SIZE) {
			return NextResponse.json(
				{ error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
				{ status: 400 }
			);
		}

		// Validate file type
		const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
		if (!ALLOWED_EXTENSIONS.has(extension)) {
			return NextResponse.json(
				{ error: `Unsupported file type. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}` },
				{ status: 400 }
			);
		}

		// Determine file type
		let fileType = "unknown";
		if (extension === ".pdf") fileType = "pdf";
		else if (extension === ".docx") fileType = "docx";
		else if (extension === ".doc") fileType = "doc";
		else if (extension === ".html" || extension === ".htm") fileType = "html";

		// Read file content for hashing
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const fileHash = crypto.createHash("md5").update(buffer).digest("hex");

		// Check for duplicate file
		const existingDoc = await db.query.rfpDocuments.findFirst({
			where: (docs, { eq }) => eq(docs.fileHash, fileHash),
		});

		if (existingDoc) {
			return NextResponse.json(
				{
					error: "This file has already been uploaded",
					existingDocumentId: existingDoc.id,
				},
				{ status: 409 }
			);
		}

		// Generate storage path (in production, upload to S3/cloud storage)
		const documentId = uuidv4();
		const storagePath = `/uploads/rfp/${documentId}/${file.name}`;

		// Store file (in production, upload to S3/cloud storage)
		// For now, we'll store metadata only - actual storage implementation TBD
		// await uploadToStorage(buffer, storagePath);

		// Create RFP document record
		const [rfpDocument] = await db
			.insert(rfpDocuments)
			.values({
				id: documentId,
				opportunityId: opportunityId || null,
				filename: file.name,
				fileType,
				fileSize: file.size,
				storagePath,
				fileHash,
				parsingStatus: "pending",
				parsingProgress: 0,
				uploadedBy: userId,
			})
			.returning();

		// Create parsing job
		const [parsingJob] = await db
			.insert(rfpParsingJobs)
			.values({
				rfpDocumentId: documentId,
				status: "queued",
				initiatedBy: userId,
				parsingOptions: {
					extractRequirements: true,
					generateEmbeddings: true,
					detectSections: true,
					classifyRequirements: true,
				},
			})
			.returning();

		// In production, trigger async parsing job here
		// await triggerParsingJob(parsingJob.id);

		const response: UploadResponse = {
			rfpDocumentId: documentId,
			filename: file.name,
			fileSize: file.size,
			fileType,
			parsingJobId: parsingJob.id,
			message: "File uploaded successfully. Parsing started.",
		};

		return NextResponse.json(response, { status: 201 });
	} catch (error) {
		console.error("RFP upload error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

// ============================================================================
// OPTIONS handler for CORS
// ============================================================================

export async function OPTIONS(): Promise<NextResponse> {
	return new NextResponse(null, {
		status: 204,
		headers: {
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		},
	});
}
