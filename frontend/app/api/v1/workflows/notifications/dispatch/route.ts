import { NextRequest, NextResponse } from "next/server";
import { deliverWorkflowNotifications } from "@/lib/actions/workflow-runtime";
import { isWorkflowApiResponse, requireWorkflowApiActor } from "@/lib/workflows/api-auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const actor = await requireWorkflowApiActor(request, {
			permission: "admin",
			allowScheduler: true,
		});
		if (isWorkflowApiResponse(actor)) return actor;

		const body = await request.json().catch(() => ({}));
		const result = await deliverWorkflowNotifications({
			limit: typeof body.limit === "number" ? body.limit : undefined,
		});
		return NextResponse.json({ ...result, actorId: actor.userId });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to dispatch workflow notifications";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
