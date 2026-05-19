import { NextRequest, NextResponse } from "next/server";
import {
	syncOperationalExceptionWorkflowsForActor,
	type OperationalExceptionSubjectType,
} from "@/lib/workflows/operational-exceptions";
import { isWorkflowApiResponse, requireWorkflowApiActor } from "@/lib/workflows/api-auth";

const VALID_SUBJECT_TYPES = new Set<OperationalExceptionSubjectType>(["rfp_parse", "scraper_run"]);

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const actor = await requireWorkflowApiActor(request, {
			permission: "admin",
			allowScheduler: true,
		});
		if (isWorkflowApiResponse(actor)) return actor;

		const body = await request.json().catch(() => ({}));
		const subjectTypes = Array.isArray(body.subjectTypes)
			? body.subjectTypes.filter((item: unknown): item is OperationalExceptionSubjectType =>
				typeof item === "string" && VALID_SUBJECT_TYPES.has(item as OperationalExceptionSubjectType)
			)
			: undefined;
		const result = await syncOperationalExceptionWorkflowsForActor({
			limit: typeof body.limit === "number" ? body.limit : undefined,
			subjectTypes,
		}, actor.userId);

		return NextResponse.json({ ...result, actorId: actor.userId });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to sync operational exceptions";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
