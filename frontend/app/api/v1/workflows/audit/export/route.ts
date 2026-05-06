import { NextRequest, NextResponse } from "next/server";
import {
	getWorkflowAuditExplorerProjectionForScope,
} from "@/lib/actions/workflow-audit";
import { isWorkflowApiResponse, requireWorkflowApiActor } from "@/lib/workflows/api-auth";
import { serializeWorkflowAuditCsv } from "@/lib/workflows/audit-export";
import { buildWorkflowViewerScope } from "@/lib/workflows/viewer-scope";

export async function GET(request: NextRequest): Promise<NextResponse> {
	const actor = await requireWorkflowApiActor(request, { permission: "read" });
	if (isWorkflowApiResponse(actor)) return actor;

	const params = request.nextUrl.searchParams;
	const projection = await getWorkflowAuditExplorerProjectionForScope(
		buildWorkflowViewerScope(actor),
		{
			runId: clean(params.get("runId")),
			subjectType: clean(params.get("subjectType")),
			subjectId: clean(params.get("subjectId")),
			eventType: clean(params.get("eventType")),
			actorId: clean(params.get("actorId")),
			limit: params.get("limit") ? Number(params.get("limit")) : undefined,
		},
	);
	const csv = serializeWorkflowAuditCsv(projection);
	const filename = `workflow-audit-${new Date().toISOString().slice(0, 10)}.csv`;

	return new NextResponse(csv, {
		status: 200,
		headers: {
			"content-type": "text/csv; charset=utf-8",
			"content-disposition": `attachment; filename="${filename}"`,
			"cache-control": "no-store",
		},
	});
}

function clean(value: string | null): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}
