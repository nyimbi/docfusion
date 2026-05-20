/**
 * RFP Upload API Route
 *
 * Handles RFP document uploads with validation, storage,
 * and automatic parsing job creation.
 */

import { NextRequest, NextResponse } from "next/server";
import {
	isTenantResponse,
	requireRouteTenantContext,
} from "@/lib/auth/route-tenant";
import { buildSignedTenantHeaders } from "@/lib/auth/tenant-signature";
import { db } from "@/lib/db";
import { opportunities } from "@/lib/db/schema";
import { rfpDocuments, rfpParsingJobs } from "@/lib/db/schema-rfp";
import { and, eq } from "drizzle-orm";
import {
	buildRfpObjectKey,
	getLinodeE3ConfigFromEnv,
	uploadToLinodeE3,
} from "@/lib/storage/linode-e3";
import { scanRfpUploadBuffer, validateRfpUploadMetadata } from "@/lib/rfp/upload-validation";
import crypto from "crypto";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";
const USE_PYTHON_RFP = process.env.USE_PYTHON_RFP !== "false";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
// Handler
// ============================================================================

async function validateOpportunityAccess(
	opportunityId: string | null,
	userId: string
): Promise<NextResponse | null> {
	if (!opportunityId) return null;

	if (!UUID_PATTERN.test(opportunityId)) {
		return NextResponse.json(
			{ error: "Invalid opportunity ID" },
			{ status: 400 }
		);
	}

	const [opportunity] = await db
		.select({ id: opportunities.id })
		.from(opportunities)
		.where(and(
			eq(opportunities.id, opportunityId),
			eq(opportunities.assignedTo, userId)
		))
		.limit(1);

	if (!opportunity) {
		return NextResponse.json(
			{ error: "Opportunity not found" },
			{ status: 404 }
		);
	}

	return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
	const ctx = await requireRouteTenantContext();
	if (isTenantResponse(ctx)) return ctx;
	const userId = ctx.userId;
	const organizationId = ctx.organizationId;

	try {

		// Parse form data only after authentication.
		const formData = await request.formData();
		const file = formData.get("file") as File | null;
		const opportunityIdValue = formData.get("opportunityId");
		const opportunityId = typeof opportunityIdValue === "string" && opportunityIdValue.trim()
			? opportunityIdValue.trim()
			: null;

		if (!file) {
			return NextResponse.json(
				{ error: "No file provided" },
				{ status: 400 }
			);
		}

		const metadataValidation = validateRfpUploadMetadata({
			filename: file.name,
			contentType: file.type,
			size: file.size,
		});
		if (!metadataValidation.valid) {
			return NextResponse.json(
				{ error: metadataValidation.errors[0] },
				{ status: 400 }
			);
		}
		const extension = metadataValidation.extension;
		const fileType = metadataValidation.fileType ?? "unknown";
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const securityScan = scanRfpUploadBuffer(buffer, metadataValidation.fileType);
		if (securityScan.status === "failed") {
			return NextResponse.json(
				{ error: "Uploaded file failed security preflight", findings: securityScan.findings },
				{ status: 400 }
			);
		}

		const opportunityAccessError = await validateOpportunityAccess(opportunityId, userId);
		if (opportunityAccessError) return opportunityAccessError;

		const objectStoreConfig = getLinodeE3ConfigFromEnv();

		// Proxy to Python FastAPI when feature flag is enabled and local object
		// storage is not configured. Browser uploads cannot go direct to Linode E3
		// because this endpoint does not depend on object-store CORS support.
		if (USE_PYTHON_RFP && !objectStoreConfig) {
			const response = await fetch(`${FASTAPI_URL}/api/v1/rfp/upload`, {
				method: "POST",
				headers: buildSignedTenantHeaders({
					method: "POST",
					path: "/api/v1/rfp/upload",
					userId,
					organizationId,
				}),
				body: formData,
			});
			const data = await response.json();
			return NextResponse.json(data, { status: response.status });
		}

		const fileHash = crypto.createHash("md5").update(buffer).digest("hex");
		const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

		// Check for duplicate file within the caller's organization. Cross-tenant
		// hash collisions are not visible — different orgs may upload the same file.
		const existingDoc = await db.query.rfpDocuments.findFirst({
			where: and(
				eq(rfpDocuments.fileHash, fileHash),
				eq(rfpDocuments.organizationId, organizationId),
			),
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
					"sha256": sha256,
				},
			});

			storagePath = upload.storagePath;
			storageMetadata = {
				provider: "linode_e3",
				bucket: upload.bucket,
				key: upload.key,
				endpoint: upload.endpoint,
				etag: upload.etag,
				sha256,
				byteLength: buffer.length,
				securityScan,
			};
		}

		// Create RFP document record
		const [rfpDocument] = await db
			.insert(rfpDocuments)
			.values({
				id: documentId,
				organizationId,
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
					securityScan,
					sha256,
				},
			})
			.returning();

		// Create parsing job
		const [parsingJob] = await db
			.insert(rfpParsingJobs)
			.values({
				rfpDocumentId: documentId,
				organizationId,
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
