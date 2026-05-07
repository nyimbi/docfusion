/**
 * Import Parse API Route
 *
 * POST /api/v1/import/parse
 * Parses uploaded delimited files and returns headers, sample rows, and detected types.
 *
 * Accepts multipart/form-data with:
 * - file: The CSV/TSV file to parse
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseFile } from "@/lib/import/universal-parser";

/**
 * Get authenticated user context.
 * Uses headers() from next/headers as recommended by Better Auth docs.
 */
async function getUserContext() {
	try {
		const session = await auth();

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

		if (!file) {
			return NextResponse.json(
				{ success: false, error: "No file provided" },
				{ status: 400 }
			);
		}

		// Validate file type
		const allowedTypes = [
			"text/csv",
			"text/tab-separated-values",
			"application/csv",
		];

		const isAllowedType = allowedTypes.includes(file.type) ||
			file.name.endsWith(".csv") ||
			file.name.endsWith(".tsv");

		if (!isAllowedType) {
			return NextResponse.json(
				{ success: false, error: `Unsupported file type: ${file.type}. Please upload CSV or TSV files.` },
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
		const parsedData = await parseFile(file);

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
 * GET /api/v1/import/parse
 */
export async function GET(request: NextRequest) {
	// This endpoint is not typically needed as sheet info is returned in POST
	return NextResponse.json(
		{ success: false, error: "Use POST to parse files" },
		{ status: 405 }
	);
}
