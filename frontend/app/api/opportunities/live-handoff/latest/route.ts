import { NextResponse } from "next/server";
import {
	isTenantResponse,
	requireRouteTenantContext,
} from "@/lib/auth/route-tenant";
import {
	LatestLivePursuitHandoffNotFoundError,
	readLatestLivePursuitHandoff,
} from "@/lib/services/latest-live-pursuit-handoff";
import {
	readLatestLivePursuitHandoffActionAuditEvents,
	readLatestLivePursuitHandoffActionStates,
	summarizeLatestLivePursuitHandoffActionReadiness,
} from "@/lib/services/live-pursuit-handoff-action-state";

export const dynamic = "force-dynamic";

export async function GET() {
	const userContext = await requireRouteTenantContext();
	if (isTenantResponse(userContext)) return userContext;

	try {
		const handoff = await readLatestLivePursuitHandoff();
		const [actionStates, actionEvents] = await Promise.all([
			readLatestLivePursuitHandoffActionStates({
				runId: handoff.index.runId,
			}),
			readLatestLivePursuitHandoffActionAuditEvents({
				runId: handoff.index.runId,
				limit: 25,
			}),
		]);
		return NextResponse.json({
			success: true,
			handoff: {
				...handoff,
				actionStates,
				actionEvents,
				actionReadiness: summarizeLatestLivePursuitHandoffActionReadiness({
					tasks: handoff.index.executionPlan.tasks,
					actionStates,
				}),
			},
		});
	} catch (error) {
		if (error instanceof LatestLivePursuitHandoffNotFoundError) {
			return NextResponse.json(
				{
					success: false,
					error: error.message,
					proofCommand: "npm run platform:proof -- --run live-pursuit-handoff --include-live-safe",
				},
				{ status: 404 },
			);
		}

		const message = error instanceof Error ? error.message : "Failed to read latest live pursuit handoff";
		return NextResponse.json(
			{ success: false, error: message },
			{ status: 500 },
		);
	}
}
