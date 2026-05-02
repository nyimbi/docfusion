import { NextRequest, NextResponse } from "next/server";
import { reverseWorkflowRuntimeState } from "@/lib/actions/workflow-runtime";
import { isWorkflowApiResponse, requireWorkflowApiActor } from "@/lib/workflows/api-auth";

const REVERSAL_ACTIONS = new Set(["reopen", "cancel", "resolve"]);

export async function POST(
	request: NextRequest,
	context: { params: Promise<{ workflowId: string }> }
): Promise<NextResponse> {
	try {
		const { workflowId } = await context.params;
		const actor = await requireWorkflowApiActor(request, {
			permission: "write",
			resourceType: "workflow_instance",
			resourceId: workflowId,
		});
		if (isWorkflowApiResponse(actor)) return actor;

		const body = await request.json();
		if (!REVERSAL_ACTIONS.has(body.action)) {
			return NextResponse.json({ error: "Unsupported workflow transition action" }, { status: 400 });
		}

		const result = await reverseWorkflowRuntimeState({
			workflowInstanceId: workflowId,
			action: body.action,
			actorId: actor.userId,
			actorName: actor.userId,
			reason: typeof body.reason === "string" ? body.reason : "",
			targetState: typeof body.targetState === "string" ? body.targetState : undefined,
			evidenceLinks: Array.isArray(body.evidenceLinks) ? body.evidenceLinks : undefined,
			metadata: { apiActorRoles: actor.roles },
		});

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Workflow transition failed";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
