import { NextRequest, NextResponse } from "next/server";
import { startDomainWorkflowFromTemplate } from "@/lib/actions/workflow-domain";
import { WorkflowAuthorityDeniedError } from "@/lib/workflows/authority-error";
import { isWorkflowApiResponse, requireWorkflowApiActor } from "@/lib/workflows/api-auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const actor = await requireWorkflowApiActor(request, { permission: "write" });
		if (isWorkflowApiResponse(actor)) return actor;

		const body = await request.json();
		if (typeof body.templateKey !== "string" || typeof body.subjectId !== "string") {
			return NextResponse.json({ error: "templateKey and subjectId are required" }, { status: 400 });
		}

		const workflow = await startDomainWorkflowFromTemplate({
			templateKey: body.templateKey,
			subjectId: body.subjectId,
			subjectType: typeof body.subjectType === "string" ? body.subjectType : undefined,
			opportunityId: typeof body.opportunityId === "string" ? body.opportunityId : undefined,
			actorId: actor.userId,
			actorRoles: actor.roles,
			reason: typeof body.reason === "string" ? body.reason : undefined,
			assignedTo: typeof body.assignedTo === "string" ? body.assignedTo : undefined,
			assignedRole: typeof body.assignedRole === "string" ? body.assignedRole : undefined,
			priority: body.priority,
			notificationRecipients: Array.isArray(body.notificationRecipients) ? body.notificationRecipients : undefined,
		});

		return NextResponse.json({ workflow }, { status: 201 });
	} catch (error) {
		if (error instanceof WorkflowAuthorityDeniedError) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		const message = error instanceof Error ? error.message : "Failed to start workflow";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
