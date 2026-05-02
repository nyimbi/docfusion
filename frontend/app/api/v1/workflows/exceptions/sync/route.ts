import { NextRequest, NextResponse } from "next/server";
import {
	syncOperationalExceptionWorkflows,
	type OperationalExceptionSubjectType,
} from "@/lib/actions/operational-exceptions";

const VALID_SUBJECT_TYPES = new Set<OperationalExceptionSubjectType>(["rfp_parse", "scraper_run"]);

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const body = await request.json().catch(() => ({}));
		const subjectTypes = Array.isArray(body.subjectTypes)
			? body.subjectTypes.filter((item: unknown): item is OperationalExceptionSubjectType =>
				typeof item === "string" && VALID_SUBJECT_TYPES.has(item as OperationalExceptionSubjectType)
			)
			: undefined;
		const result = await syncOperationalExceptionWorkflows({
			limit: typeof body.limit === "number" ? body.limit : undefined,
			subjectTypes,
		});

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to sync operational exceptions";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
