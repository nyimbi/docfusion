import { NextRequest, NextResponse } from "next/server";
import { getWorkflowDashboard, type WorkflowRuntimeStatus } from "@/lib/actions/workflow-runtime";
import { isWorkflowApiResponse, requireWorkflowApiActor } from "@/lib/workflows/api-auth";
import { buildWorkflowViewerScope } from "@/lib/workflows/viewer-scope";

const VALID_STATUSES = new Set<WorkflowRuntimeStatus>([
	"active",
	"waiting",
	"breached",
	"escalated",
	"completed",
	"cancelled",
]);

export async function GET(request: NextRequest): Promise<NextResponse> {
	try {
		const actor = await requireWorkflowApiActor(request, { permission: "read" });
		if (isWorkflowApiResponse(actor)) return actor;

		const searchParams = request.nextUrl.searchParams;
		const statuses = splitParam(searchParams.get("statuses"))
			.filter((status): status is WorkflowRuntimeStatus => VALID_STATUSES.has(status as WorkflowRuntimeStatus));
		const subjectTypes = splitParam(searchParams.get("subjectTypes"));
		const limit = Number(searchParams.get("limit") ?? 100);
		const scope = buildWorkflowViewerScope(actor);

		const dashboard = await getWorkflowDashboard(scope, {
			statuses: statuses.length ? statuses : undefined,
			subjectTypes: subjectTypes.length ? subjectTypes : undefined,
			assignedTo: searchParams.get("assignedTo") ?? undefined,
			opportunityId: searchParams.get("opportunityId") ?? undefined,
			limit: Number.isFinite(limit) ? limit : 100,
		});

		return NextResponse.json(dashboard);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to load workflow dashboard";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

function splitParam(value: string | null): string[] {
	return value
		? value.split(",").map((item) => item.trim()).filter(Boolean)
		: [];
}
