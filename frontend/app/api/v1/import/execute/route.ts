/**
 * Import Execute API Route
 *
 * POST /api/v1/import/execute
 * Executes the data import with the provided mappings and options.
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { executeImport } from "@/lib/actions/import";
import type { ImportTargetTable, ColumnMapping, ImportOptions } from "@/lib/types/import";

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
			options,
		} = body as {
			parsedData: {
				sampleRows: Record<string, unknown>[];
				totalRows: number;
				metadata: {
					filename: string;
					fileType: string;
					fileSize?: number;
					sheetName?: string;
				};
			};
			targetTable: ImportTargetTable;
			mappings: ColumnMapping[];
			options: ImportOptions;
		};

		// Validate required fields
		if (!parsedData || !targetTable || !mappings || !options) {
			return NextResponse.json(
				{ success: false, error: "Missing required fields" },
				{ status: 400 }
			);
		}

		if (!Array.isArray(mappings) || mappings.length === 0) {
			return NextResponse.json(
				{ success: false, error: "At least one column mapping is required" },
				{ status: 400 }
			);
		}

		// Validate target table
		const validTables: ImportTargetTable[] = ["opportunities", "contacts", "accounts", "partners"];
		if (!validTables.includes(targetTable)) {
			return NextResponse.json(
				{ success: false, error: `Invalid target table: ${targetTable}` },
				{ status: 400 }
			);
		}

		// Execute import
		const result = await executeImport(
			parsedData,
			targetTable,
			mappings,
			options,
			userContext
		);

		return NextResponse.json({
			success: result.success,
			result,
		});
	} catch (error) {
		console.error("Execute error:", error);
		const message = error instanceof Error ? error.message : "Failed to execute import";
		return NextResponse.json(
			{ success: false, error: message },
			{ status: 500 }
		);
	}
}
