import { NextRequest, NextResponse } from "next/server";
import { transitionDomainWorkflow } from "@/lib/actions/workflow-domain";
import { isWorkflowApiResponse, requireWorkflowApiActor } from "@/lib/workflows/api-auth";

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
		if (typeof body.action !== "string") {
			return NextResponse.json({ error: "Workflow transition action is required" }, { status: 400 });
		}

		const result = await transitionDomainWorkflow({
			workflowInstanceId: workflowId,
			action: body.action,
			actorId: actor.userId,
			actorRoles: actor.roles,
			reason: typeof body.reason === "string" ? body.reason : "",
			targetState: typeof body.targetState === "string" ? body.targetState : undefined,
			evidenceLinks: Array.isArray(body.evidenceLinks) ? body.evidenceLinks : undefined,
			notificationRecipients: Array.isArray(body.notificationRecipients) ? body.notificationRecipients : undefined,
		});

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Workflow transition failed";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
