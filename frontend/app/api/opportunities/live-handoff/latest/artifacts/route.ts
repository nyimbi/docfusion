import { NextRequest, NextResponse } from "next/server";
import {
	isTenantResponse,
	requireRouteTenantContext,
} from "@/lib/auth/route-tenant";
import {
	LatestLivePursuitHandoffNotFoundError,
	readLatestLivePursuitHandoffArtifactContent,
} from "@/lib/services/latest-live-pursuit-handoff";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	const userContext = await requireRouteTenantContext();
	if (isTenantResponse(userContext)) return userContext;

	const artifactPath = request.nextUrl.searchParams.get("path") ?? "";
	if (!artifactPath.trim()) {
		return NextResponse.json(
			{ success: false, error: "artifact path is required" },
			{ status: 400 },
		);
	}

	try {
		const artifact = await readLatestLivePursuitHandoffArtifactContent({ artifactPath });
		return new NextResponse(artifact.content, {
			headers: {
				"content-type": artifact.contentType,
				"content-disposition": `inline; filename="${sanitizeFilename(artifact.filename)}"`,
				"x-lindela-artifact-kind": artifact.artifact.kind,
				"x-lindela-artifact-path": artifact.artifact.path,
			},
		});
	} catch (error) {
		if (error instanceof LatestLivePursuitHandoffNotFoundError) {
			return NextResponse.json(
				{ success: false, error: error.message },
				{ status: 404 },
			);
		}
		const message = error instanceof Error ? error.message : "Failed to read latest handoff artifact";
		const status = message.includes("not part") || message.includes("not found") ? 404 : message.includes("required") ? 400 : 500;
		return NextResponse.json(
			{ success: false, error: message },
			{ status },
		);
	}
}

function sanitizeFilename(filename: string): string {
	return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "handoff-artifact.txt";
}
