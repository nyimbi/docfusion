import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import {
	downloadFromLinodeE3,
	getLinodeE3ConfigFromEnv,
} from "@/lib/storage/linode-e3";
import { and, eq, sql } from "drizzle-orm";

type StoredFinalArtifact = {
	artifactHash: string;
	filename: string;
	mimeType: string;
	storagePath: string;
};

type DocumentArtifactSource = {
	title: string;
	content: unknown;
	plainText: string | null;
	currentVersion: number | null;
	metadata: unknown;
};

type ArtifactLookupResult =
	| { artifact: StoredFinalArtifact }
	| { stale: true }
	| { notFound: true };

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ documentId: string }> }
): Promise<NextResponse> {
	const session = await auth();
	if (!session?.user?.id) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	const { documentId } = await context.params;
	const artifactHash = request.nextUrl.searchParams.get("artifactHash");
	if (!artifactHash) {
		return new NextResponse("artifactHash is required", { status: 400 });
	}

	const [document] = await db
		.select({
			title: documents.title,
			content: documents.content,
			plainText: documents.plainText,
			currentVersion: documents.currentVersion,
			metadata: documents.metadata,
		})
		.from(documents)
		.where(visibleDocumentCondition(documentId, session.user.id))
		.limit(1);

	if (!document) {
		return new NextResponse("Document not found", { status: 404 });
	}

	const lookup = findStoredArtifact(document, artifactHash);
	if ("stale" in lookup) {
		return new NextResponse("Final artifact requires re-rendering the current document version", { status: 409 });
	}
	if ("notFound" in lookup) {
		return new NextResponse("Final artifact not found", { status: 404 });
	}
	const { artifact } = lookup;

	const objectStoreConfig = getLinodeE3ConfigFromEnv();
	if (!objectStoreConfig) {
		return new NextResponse("Final artifact object storage is not configured", { status: 503 });
	}

	const object = await downloadFromLinodeE3(objectStoreConfig, artifact.storagePath);
	const actualHash = createHash("sha256").update(object.body).digest("hex");
	if (actualHash !== artifact.artifactHash) {
		return new NextResponse("Final artifact hash mismatch", { status: 409 });
	}

	const filename = request.nextUrl.searchParams.get("filename") ?? artifact.filename ?? document.title;
	return new NextResponse(new Uint8Array(object.body), {
		status: 200,
		headers: {
			"Content-Type": object.contentType ?? artifact.mimeType ?? "application/octet-stream",
			"Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
			"Content-Length": object.body.length.toString(),
			"ETag": object.etag ?? `"${actualHash}"`,
		},
	});
}

function visibleDocumentCondition(documentId: string, actorId: string) {
	return and(
		eq(documents.id, documentId),
		sql`(
			documents.owner_id = ${actorId}
			or exists (
				select 1
				from proposal_documents
				join opportunities on opportunities.id = proposal_documents.opportunity_id
				where proposal_documents.document_id = ${documentId}
					and opportunities.assigned_to = ${actorId}
			)
		)`
	)!;
}

function findStoredArtifact(document: DocumentArtifactSource, artifactHash: string): ArtifactLookupResult {
	const current = asRecord(document.metadata);
	const finalArtifact = toStoredArtifact(current.finalArtifact);
	if (finalArtifact?.artifactHash === artifactHash) {
		return artifactMatchesCurrentDocument(current.finalArtifact, document, { requireApproval: true })
			? { artifact: finalArtifact }
			: { stale: true };
	}

	const renderedArtifacts = asRecord(current.renderedArtifacts);
	for (const candidate of Object.values(renderedArtifacts)) {
		const artifact = toStoredArtifact(candidate);
		if (artifact?.artifactHash === artifactHash) {
			return artifactMatchesCurrentDocument(candidate, document, { requireApproval: false })
				? { artifact }
				: { stale: true };
		}
	}
	return { notFound: true };
}

function toStoredArtifact(value: unknown): StoredFinalArtifact | null {
	const record = asRecord(value);
	if (
		typeof record.artifactHash !== "string" ||
		typeof record.filename !== "string" ||
		typeof record.storagePath !== "string"
	) {
		return null;
	}
	return {
		artifactHash: record.artifactHash,
		filename: record.filename,
		mimeType: typeof record.mimeType === "string" ? record.mimeType : "application/octet-stream",
		storagePath: record.storagePath,
	};
}

function artifactMatchesCurrentDocument(
	value: unknown,
	document: DocumentArtifactSource,
	options: { requireApproval: boolean }
): boolean {
	const record = asRecord(value);
	const hasApprovalReceipt = !options.requireApproval ||
		(typeof record.approvedBy === "string" &&
			(typeof record.approvedAt === "string" || record.approvedAt instanceof Date));
	return (
		hasApprovalReceipt &&
		"sourceDocumentVersion" in record &&
		(record.sourceDocumentVersion === document.currentVersion ||
			(record.sourceDocumentVersion === null && document.currentVersion === null)) &&
		record.sourceContentHash === hashDocumentSource(document)
	);
}

function hashDocumentSource(document: Pick<DocumentArtifactSource, "title" | "content" | "plainText">): string {
	return createHash("sha256")
		.update(JSON.stringify({
			title: document.title,
			content: document.content,
			plainText: document.plainText,
		}))
		.digest("hex");
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};
}
