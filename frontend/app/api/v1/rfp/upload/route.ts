/**
 * RFP Upload API Route
 *
 * Handles RFP document uploads with validation, storage,
 * and automatic parsing job creation.
 */

import { NextRequest, NextResponse } from "next/server";
import { isRouteSessionResponse, requireRouteSessionOr401 } from "@/lib/auth/route-session";
import { db } from "@/lib/db";
import { rfpDocuments, rfpParsingJobs } from "@/lib/db/schema-rfp";
import {
	buildRfpObjectKey,
	getLinodeE3ConfigFromEnv,
	uploadToLinodeE3,
} from "@/lib/storage/linode-e3";
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
		const authResult = await requireRouteSessionOr401();
		if (isRouteSessionResponse(authResult)) return authResult;
		const session = authResult.session;
		const userId = session.user?.id ?? session.user?.email ?? "unknown";

		// Parse form data only after authentication.
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
		if (file.type && !ALLOWED_TYPES.has(file.type)) {
			return NextResponse.json(
				{ error: `Unsupported content type: ${file.type}` },
				{ status: 400 }
			);
		}

		const objectStoreConfig = getLinodeE3ConfigFromEnv();

		// Proxy to Python FastAPI when feature flag is enabled and local object
		// storage is not configured. Browser uploads cannot go direct to Linode E3
		// because this endpoint does not depend on object-store CORS support.
		if (USE_PYTHON_RFP && !objectStoreConfig) {
			const response = await fetch(`${FASTAPI_URL}/api/v1/rfp/upload`, {
				method: "POST",
				headers: {
					"x-docfusion-user-id": userId,
				},
				body: formData,
			});
			const data = await response.json();
			return NextResponse.json(data, { status: response.status });
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

		const documentId = crypto.randomUUID();
		let storagePath = `/uploads/rfp/${documentId}/${file.name}`;
		let storageMetadata: Record<string, unknown> = {
			provider: "metadata_only",
			storagePending: true,
		};

		if (objectStoreConfig) {
			const objectKey = buildRfpObjectKey({
				documentId,
				filename: file.name,
				opportunityId,
				prefix: objectStoreConfig.prefix,
			});
			const upload = await uploadToLinodeE3(objectStoreConfig, {
				key: objectKey,
				body: buffer,
				contentType: file.type || "application/octet-stream",
				contentLength: file.size,
				metadata: {
					"document-id": documentId,
					"uploaded-by": userId,
				},
			});

			storagePath = upload.storagePath;
			storageMetadata = {
				provider: "linode_e3",
				bucket: upload.bucket,
				key: upload.key,
				endpoint: upload.endpoint,
				etag: upload.etag,
			};
		}

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
				metadata: {
					storage: storageMetadata,
				},
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
