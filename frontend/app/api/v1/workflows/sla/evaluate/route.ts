import { NextRequest, NextResponse } from "next/server";
import { evaluateWorkflowSla } from "@/lib/actions/workflow-runtime";
import { isWorkflowApiResponse, requireWorkflowApiActor } from "@/lib/workflows/api-auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const actor = await requireWorkflowApiActor(request, {
			permission: "admin",
			allowScheduler: true,
		});
		if (isWorkflowApiResponse(actor)) return actor;

		const body = await request.json().catch(() => ({}));
		const now = typeof body.now === "string" ? new Date(body.now) : undefined;
		const limit = typeof body.limit === "number" ? body.limit : undefined;
		const result = await evaluateWorkflowSla({
			now: now && !Number.isNaN(now.getTime()) ? now : undefined,
			escalationRecipient: typeof body.escalationRecipient === "string" ? body.escalationRecipient : undefined,
			limit,
		});

		return NextResponse.json({ ...result, actorId: actor.userId });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to evaluate workflow SLA";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
