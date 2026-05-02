import { NextRequest, NextResponse } from "next/server";
import { listPortalWorkflowItems } from "@/lib/actions/workflow-runtime";

export async function GET(request: NextRequest): Promise<NextResponse> {
	try {
		const searchParams = request.nextUrl.searchParams;
		const limit = Number(searchParams.get("limit") ?? 50);
		const items = await listPortalWorkflowItems({
			portalRole: searchParams.get("portalRole") ?? undefined,
			limit: Number.isFinite(limit) ? limit : 50,
		});

		return NextResponse.json({ items });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to load portal workflows";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
