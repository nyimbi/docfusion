/**
 * Import Parse API Route
 *
 * POST /api/v1/import/parse
 * Parses uploaded file and returns headers, sample rows, and detected types.
 *
 * Accepts multipart/form-data with:
 * - file: The Excel/CSV file to parse
 * - sheetName: (optional) For Excel files, which sheet to parse
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { parseFile, getExcelSheets } from "@/lib/import/universal-parser";

/**
 * Get authenticated user context.
 * Uses headers() from next/headers as recommended by Better Auth docs.
 */
async function getUserContext() {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) return null;
		return {
			userId: session.user.id,
			organizationId: (session.user as { organizationId?: string }).organizationId,
		};
	} catch (error) {
		console.error("[Parse API] Session error:", error);
		return null;
	}
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
		// Parse form data
		const formData = await request.formData();
		const file = formData.get("file") as File | null;
		const sheetName = formData.get("sheetName") as string | null;

		if (!file) {
			return NextResponse.json(
				{ success: false, error: "No file provided" },
				{ status: 400 }
			);
		}

		// Validate file type
		const allowedTypes = [
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
			"application/vnd.ms-excel", // .xls
			"text/csv",
			"text/tab-separated-values",
			"application/csv",
		];

		const isAllowedType = allowedTypes.includes(file.type) ||
			file.name.endsWith(".xlsx") ||
			file.name.endsWith(".xls") ||
			file.name.endsWith(".csv") ||
			file.name.endsWith(".tsv");

		if (!isAllowedType) {
			return NextResponse.json(
				{ success: false, error: `Unsupported file type: ${file.type}. Please upload Excel (.xlsx, .xls) or CSV files.` },
				{ status: 400 }
			);
		}

		// Validate file size (max 50MB)
		const maxSize = 50 * 1024 * 1024;
		if (file.size > maxSize) {
			return NextResponse.json(
				{ success: false, error: "File too large. Maximum size is 50MB." },
				{ status: 400 }
			);
		}

		// Parse the file
		const parsedData = await parseFile(file, sheetName || undefined);

		return NextResponse.json({
			success: true,
			data: parsedData,
		});
	} catch (error) {
		console.error("Parse error:", error);
		const message = error instanceof Error ? error.message : "Failed to parse file";
		return NextResponse.json(
			{ success: false, error: message },
			{ status: 500 }
		);
	}
}

/**
 * GET /api/v1/import/parse?filename=...
 * Get available sheets from an Excel file (for sheet selection UI).
 * Note: Requires re-uploading the file as we don't store files.
 */
export async function GET(request: NextRequest) {
	// This endpoint is not typically needed as sheet info is returned in POST
	return NextResponse.json(
		{ success: false, error: "Use POST to parse files" },
		{ status: 405 }
	);
}
