/**
 * Document Render BFF Route
 *
 * Proxies POST /api/v1/documents/{documentId}/render through the Next.js
 * BFF so the upstream FastAPI handler receives the caller's tenant
 * identity via the x-docfusion-user-id / x-docfusion-organization-id
 * headers. Without this route the fetch falls through to the wildcard
 * rewrite in next.config.ts which forwards the request body verbatim
 * but injects no auth context, so the backend 401s on every call.
 *
 * Mirrors the pattern established by frontend/app/api/v1/rfp/[rfpId]/parse/route.ts.
 *
 * Response is a binary stream (PDF / DOCX bytes). content-type and
 * content-disposition are passed through from the upstream response so
 * the browser's download flow works without re-deriving the filename
 * on the client.
 */

import { NextRequest, NextResponse } from "next/server";
import {
	requireRouteTenantContext,
	isTenantResponse,
} from "@/lib/auth/route-tenant";
import { buildSignedTenantHeaders } from "@/lib/auth/tenant-signature";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

// Document renders can take a while (LaTeX compilation, image fetch)
// but a worker should not be wedged forever. 60s covers normal proposals
// with room for cold-start renderer warmup.
const UPSTREAM_TIMEOUT_MS = 60_000;

// Permissive but bounded — UUID7 (36 chars) is the canonical shape, but
// test fixtures sometimes use short IDs like "doc-1". First char must
// be alphanumeric so "..", "." and other dotfile-shaped segments cannot
// reach the upstream even though "/" was never permitted.
const DOCUMENT_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

// Headers that carry meaning for the browser's download flow. Anything
// else from upstream is dropped to keep the BFF surface small and avoid
// leaking internal headers (Server, X-Powered-By, etc.) to the client.
//
// content-length is intentionally NOT in the passthrough list — Node's
// fetch may transparently decompress the upstream body, making the
// length header a lie for the bytes we actually emit. The browser
// re-derives the length from the streamed response, which is correct.
const PASSTHROUGH_HEADERS = ["content-type", "content-disposition"];

export async function POST(
	request: NextRequest,
	context: { params: Promise<{ documentId: string }> },
): Promise<NextResponse> {
	const ctx = await requireRouteTenantContext();
	if (isTenantResponse(ctx)) return ctx;

	const { documentId } = await context.params;
	if (!DOCUMENT_ID_RE.test(documentId)) {
		return NextResponse.json({ error: "Invalid documentId" }, { status: 400 });
	}

	// Read the body as text so we forward whatever JSON shape the caller
	// sent. Validation lives on the FastAPI side — RenderRequest has
	// extra='forbid' and bounds the content_override length.
	const body = await request.text();

	let upstream: Response;
	try {
		upstream = await fetch(
			`${FASTAPI_URL}/api/v1/documents/${documentId}/render`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...buildSignedTenantHeaders({
						method: "POST",
						path: `/api/v1/documents/${documentId}/render`,
						userId: ctx.userId,
						organizationId: ctx.organizationId,
					}),
				},
				body,
				signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
			},
		);
	} catch (error) {
		console.error("Document render upstream fetch failed:", error);
		const isTimeout = error instanceof Error && error.name === "TimeoutError";
		return NextResponse.json(
			{
				error: isTimeout
					? "Render service timed out"
					: "Render service unreachable",
			},
			{ status: isTimeout ? 504 : 502 },
		);
	}

	const headers = new Headers();
	for (const name of PASSTHROUGH_HEADERS) {
		const value = upstream.headers.get(name);
		if (value) headers.set(name, value);
	}

	return new NextResponse(upstream.body, {
		status: upstream.status,
		headers,
	});
}
