/**
 * Import Preview API Route
 *
 * POST /api/v1/import/preview
 * Generates preview of transformed data with validation results.
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { generatePreview } from "@/lib/actions/import";
import type { ImportTargetTable, ColumnMapping } from "@/lib/types/import";

/**
 * Get authenticated user context.
 */
async function getUserContext() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) return null;
	return {
		userId: session.user.id,
		organizationId: (session.user as { organizationId?: string }).organizationId,
	};
}

export async function POST(request: NextRequest) {
	// Authenticate
	const userContext = await getUserContext();
	if (!userContext) {
		return NextResponse.json(
			{ success: false, error: "Authentication required" },
			{ status: 401 }
		);
	}

	try {
		const body = await request.json();
		const {
			parsedData,
			targetTable,
			mappings,
			previewCount = 20,
		} = body as {
			parsedData: {
				headers: string[];
				sampleRows: Record<string, unknown>[];
				totalRows: number;
			};
			targetTable: ImportTargetTable;
			mappings: ColumnMapping[];
			previewCount?: number;
		};

		// Validate required fields
		if (!parsedData || !targetTable || !mappings) {
			return NextResponse.json(
				{ success: false, error: "Missing required fields: parsedData, targetTable, mappings" },
				{ status: 400 }
			);
		}

		if (!Array.isArray(mappings) || mappings.length === 0) {
			return NextResponse.json(
				{ success: false, error: "At least one column mapping is required" },
				{ status: 400 }
			);
		}

		// Generate preview
		const preview = await generatePreview(
			parsedData,
			targetTable,
			mappings,
			Math.min(previewCount, 50) // Cap at 50 rows for preview
		);

		return NextResponse.json({
			success: true,
			preview,
		});
	} catch (error) {
		console.error("Preview error:", error);
		const message = error instanceof Error ? error.message : "Failed to generate preview";
		return NextResponse.json(
			{ success: false, error: message },
			{ status: 500 }
		);
	}
}
