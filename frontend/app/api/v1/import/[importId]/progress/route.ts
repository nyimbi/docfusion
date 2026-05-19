/**
 * Import Progress API Route
 *
 * GET /api/v1/import/[importId]/progress
 * Get progress and status of an import operation.
 */

import { NextRequest, NextResponse } from "next/server";
import {
	isTenantResponse,
	requireRouteTenantContext,
	type RouteTenantResult,
} from "@/lib/auth/route-tenant";
import { getImportProgress } from "@/lib/actions/import";

/**
 * Get authenticated user context.
 */
async function getUserContext(): Promise<RouteTenantResult> {
	return requireRouteTenantContext();
}

interface RouteParams {
	params: Promise<{ importId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
	// Authenticate
	const userContext = await getUserContext();
	if (isTenantResponse(userContext)) {
		return userContext;
	}

	try {
		const { importId } = await params;

		if (!importId) {
			return NextResponse.json(
				{ success: false, error: "Import ID is required" },
				{ status: 400 }
			);
		}

		const progress = await getImportProgress(importId, userContext);

		if (!progress) {
			return NextResponse.json(
				{ success: false, error: "Import not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json({
			success: true,
			progress,
		});
	} catch (error) {
		console.error("Progress error:", error);
		const message = error instanceof Error ? error.message : "Failed to get progress";
		return NextResponse.json(
			{ success: false, error: message },
			{ status: 500 }
		);
	}
}
