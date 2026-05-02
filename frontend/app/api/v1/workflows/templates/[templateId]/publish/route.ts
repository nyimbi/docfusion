import { NextRequest, NextResponse } from "next/server";
import { publishWorkflowTemplate } from "@/lib/actions/workflow-runtime";
import { isWorkflowApiResponse, requireWorkflowApiActor } from "@/lib/workflows/api-auth";

export async function POST(
	request: NextRequest,
	context: { params: Promise<{ templateId: string }> }
): Promise<NextResponse> {
	try {
		const { templateId } = await context.params;
		const actor = await requireWorkflowApiActor(request, {
			permission: "admin",
			resourceType: "workflow_template",
			resourceId: templateId,
		});
		if (isWorkflowApiResponse(actor)) return actor;

		const template = await publishWorkflowTemplate(templateId, actor.userId);
		return NextResponse.json({ template });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to publish workflow template";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
