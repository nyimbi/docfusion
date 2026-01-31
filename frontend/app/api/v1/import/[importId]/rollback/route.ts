/**
 * Import Rollback API Route
 *
 * POST /api/v1/import/[importId]/rollback
 * Rollback an import by deleting all records created during the import.
 *
 * This is a destructive operation that:
 * 1. Finds all records created by the specified import
 * 2. Deletes them from the target table
 * 3. Updates the import status to "cancelled"
 *
 * Security:
 * - Only the user who performed the import can rollback
 * - Requires authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { rollbackImport } from "@/lib/actions/import";

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

interface RouteParams {
	params: Promise<{ importId: string }>;
}

/**
 * POST /api/v1/import/[importId]/rollback
 *
 * Rollback an import operation, deleting all imported records.
 *
 * Response:
 * - 200: { success: true, deletedCount: number }
 * - 400: { success: false, error: string } - Invalid request or rollback failed
 * - 401: { success: false, error: string } - Authentication required
 * - 404: { success: false, error: string } - Import not found
 * - 500: { success: false, error: string } - Server error
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
	// Authenticate
	const userContext = await getUserContext();
	if (!userContext) {
		return NextResponse.json(
			{ success: false, error: "Authentication required" },
			{ status: 401 }
		);
	}

	try {
		const { importId } = await params;

		if (!importId) {
			return NextResponse.json(
				{ success: false, error: "Import ID is required" },
				{ status: 400 }
			);
		}

		// Validate import ID format (UUID)
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		if (!uuidRegex.test(importId)) {
			return NextResponse.json(
				{ success: false, error: "Invalid import ID format" },
				{ status: 400 }
			);
		}

		const result = await rollbackImport(importId, userContext);

		if (!result.success) {
			// Determine appropriate status code based on error
			const status = result.error === "Import not found" ? 404 : 400;
			return NextResponse.json(
				{ success: false, error: result.error || "Rollback failed" },
				{ status }
			);
		}

		return NextResponse.json({
			success: true,
			deletedCount: result.deletedCount,
			message: result.deletedCount > 0
				? `Successfully rolled back ${result.deletedCount} records`
				: "No records to rollback",
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to rollback import";
		return NextResponse.json(
			{ success: false, error: message },
			{ status: 500 }
		);
	}
}
