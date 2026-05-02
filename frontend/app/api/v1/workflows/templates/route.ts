import { NextRequest, NextResponse } from "next/server";
import {
	createWorkflowTemplateDraft,
	listWorkflowTemplates,
	type WorkflowTemplateInput,
} from "@/lib/actions/workflow-runtime";
import { isWorkflowApiResponse, requireWorkflowApiActor } from "@/lib/workflows/api-auth";
import { simulateWorkflowTemplate } from "@/lib/workflows/simulation";

export async function GET(request: NextRequest): Promise<NextResponse> {
	try {
		const actor = await requireWorkflowApiActor(request, { permission: "read" });
		if (isWorkflowApiResponse(actor)) return actor;

		const searchParams = request.nextUrl.searchParams;
		const templates = await listWorkflowTemplates({
			status: searchParams.get("status") ?? undefined,
			subjectType: searchParams.get("subjectType") ?? undefined,
			limit: Number(searchParams.get("limit") ?? 100),
		});
		return NextResponse.json({ templates });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to list workflow templates";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const actor = await requireWorkflowApiActor(request, { permission: "admin" });
		if (isWorkflowApiResponse(actor)) return actor;

		const body = await request.json();
		const input = body as WorkflowTemplateInput;
		const simulation = simulateWorkflowTemplate(input);
		if (body.simulateOnly === true) {
			return NextResponse.json({ simulation });
		}
		if (!simulation.valid) {
			return NextResponse.json({ error: "Template simulation failed", simulation }, { status: 400 });
		}

		const template = await createWorkflowTemplateDraft(input, actor.userId);
		return NextResponse.json({ template, simulation }, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to create workflow template";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
