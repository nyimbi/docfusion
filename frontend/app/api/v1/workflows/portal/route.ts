import { NextRequest, NextResponse } from "next/server";
import { listPortalWorkflowItems } from "@/lib/actions/workflow-runtime";
import { isWorkflowApiResponse, requireWorkflowApiActor } from "@/lib/workflows/api-auth";
import { buildWorkflowViewerScope } from "@/lib/workflows/viewer-scope";

export async function GET(request: NextRequest): Promise<NextResponse> {
	try {
			const actor = await requireWorkflowApiActor(request, { permission: "read" });
			if (isWorkflowApiResponse(actor)) return actor;

			const searchParams = request.nextUrl.searchParams;
			const limit = Number(searchParams.get("limit") ?? 50);
			const scope = buildWorkflowViewerScope(actor);
			const items = await listPortalWorkflowItems(scope, {
				portalRole: scope.isGlobalWorkflowViewer ? searchParams.get("portalRole") ?? undefined : undefined,
				limit: Number.isFinite(limit) ? limit : 50,
			});

		return NextResponse.json({ items });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to load portal workflows";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
