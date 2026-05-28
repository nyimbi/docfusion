import { NextRequest, NextResponse } from "next/server";
import {
	isTenantResponse,
	requireRouteTenantContext,
} from "@/lib/auth/route-tenant";
import { updateLatestLivePursuitHandoffTaskActionState } from "@/lib/services/live-pursuit-handoff-action-state";
import type { LatestLivePursuitHandoffTaskActionStatus } from "@/lib/types/latest-live-pursuit-handoff";

export const dynamic = "force-dynamic";

interface TaskActionBody {
	status?: unknown;
	assigneeName?: unknown;
	evidenceNote?: unknown;
	receiptUrl?: unknown;
}

export async function POST(
	request: NextRequest,
	context: { params: Promise<{ taskId: string }> },
) {
	const userContext = await requireRouteTenantContext();
	if (isTenantResponse(userContext)) return userContext;

	const { taskId } = await context.params;
	let body: TaskActionBody;
	try {
		body = await request.json() as TaskActionBody;
	} catch {
		return NextResponse.json(
			{ success: false, error: "Invalid JSON body" },
			{ status: 400 },
		);
	}

	if (typeof body.status !== "string") {
		return NextResponse.json(
			{ success: false, error: "status is required" },
			{ status: 400 },
		);
	}

	try {
		const update = await updateLatestLivePursuitHandoffTaskActionState({
			taskId,
			status: body.status as LatestLivePursuitHandoffTaskActionStatus,
			assigneeName: optionalString(body.assigneeName, "assigneeName"),
			evidenceNote: optionalString(body.evidenceNote, "evidenceNote"),
			receiptUrl: optionalString(body.receiptUrl, "receiptUrl"),
			updatedByUserId: userContext.userId,
		});
		return NextResponse.json({
			success: true,
			...update,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to update latest handoff task";
		const status = message.includes("not found") ? 404 : message.includes("Unsupported") || message.includes("required") ? 400 : 500;
		return NextResponse.json(
			{ success: false, error: message },
			{ status },
		);
	}
}

function optionalString(value: unknown, field: string): string | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value !== "string") throw new Error(`${field} must be a string`);
	return value;
}
