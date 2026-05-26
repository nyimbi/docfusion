/**
 * Import Execute API Route
 *
 * POST /api/v1/import/execute
 * Executes the data import with the provided mappings and options.
 */

import { NextRequest, NextResponse } from "next/server";
import {
	assertUserHasAuthorityRole,
	requireUserContext,
	type UserContext,
} from "@/lib/auth-utils";
import { executeImport, generatePreview } from "@/lib/actions/import";
import { decideSandboxMutation } from "@/lib/sandbox/runtime";
import type { ImportTargetTable, ColumnMapping, ImportOptions } from "@/lib/types/import";

/**
 * Get authenticated user context.
 */
type ImportExecuteUserContext = UserContext & { organizationId: string };

async function getUserContext(): Promise<ImportExecuteUserContext | NextResponse> {
	try {
		const context = await requireUserContext();
		if (!context.organizationId) {
			return NextResponse.json({ error: "No organization context" }, { status: 403 });
		}
		return {
			...context,
			organizationId: context.organizationId,
		};
	} catch {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
}

function isTenantResponse(value: ImportExecuteUserContext | NextResponse): value is NextResponse {
	return value instanceof NextResponse;
}

export async function POST(request: NextRequest) {
	// Authenticate
	const userContext = await getUserContext();
	if (isTenantResponse(userContext)) {
		return userContext;
	}

	try {
		const body = await request.json();
		const {
			parsedData,
			targetTable,
			mappings,
			options,
			sandboxMode,
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
			sandboxMode?: "live" | "sandbox" | "preview";
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

		const sandboxDecision = decideSandboxMutation({
			requestedMode: request.headers.get("x-docfusion-sandbox-mode") ?? sandboxMode,
			operation: "import_execute",
		});
		if (!sandboxDecision.mutationAllowed) {
			const preview = await generatePreview(
				{
					headers: Object.keys(parsedData.sampleRows[0] ?? {}),
					sampleRows: parsedData.sampleRows,
					totalRows: parsedData.totalRows,
				},
				targetTable,
				mappings,
				Math.min(parsedData.sampleRows.length || 20, 50)
			);
			return NextResponse.json({
				success: true,
				result: {
					importId: null,
					success: true,
					totalRows: parsedData.totalRows,
					importedRows: 0,
					updatedRows: 0,
					skippedRows: parsedData.totalRows,
					failedRows: 0,
					importedIds: [],
					errors: [],
					durationMs: 0,
				},
				preview,
				sandbox: sandboxDecision,
			});
		}

		try {
			assertUserHasAuthorityRole(
				userContext,
				"import_approver",
				"Executing an import requires import authority"
			);
		} catch {
			return NextResponse.json(
				{ success: false, error: "Forbidden" },
				{ status: 403 }
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
			sandbox: sandboxDecision,
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
