import { NextRequest, NextResponse } from "next/server";
import {
	transitionComplianceEntryWorkflow,
	type ComplianceEntryWorkflowAction,
} from "@/lib/actions/compliance-validator";

const WORKFLOW_ACTIONS = new Set<ComplianceEntryWorkflowAction>([
	"submit_for_review",
	"approve",
	"reject",
	"waive",
	"reopen",
]);

export async function POST(
	request: NextRequest,
	context: { params: Promise<{ matrixId: string; entryId: string }> }
): Promise<NextResponse> {
	try {
		const { matrixId, entryId } = await context.params;
		const body = await request.json();
		const action = body.action as ComplianceEntryWorkflowAction;

		if (!WORKFLOW_ACTIONS.has(action)) {
			return NextResponse.json(
				{ error: "Unsupported compliance workflow action" },
				{ status: 400 }
			);
		}

		const result = await transitionComplianceEntryWorkflow({
			matrixId,
			entryId,
			action,
			reason: typeof body.reason === "string" ? body.reason : "",
		});

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Compliance workflow transition failed";
		const status = message === "Unauthorized" ? 401 : message.includes("not found") ? 404 : 400;

		return NextResponse.json({ error: message }, { status });
	}
}
