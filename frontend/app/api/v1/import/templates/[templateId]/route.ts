/**
 * Import Template Detail API Route
 *
 * GET /api/v1/import/templates/[templateId] - Get template detail
 * DELETE /api/v1/import/templates/[templateId] - Delete template
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getTemplateDetail, deleteTemplate } from "@/lib/actions/import";

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
	params: Promise<{ templateId: string }>;
}

/**
 * GET /api/v1/import/templates/[templateId]
 * Get template detail including mappings.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
	// Authenticate
	const userContext = await getUserContext();
	if (!userContext) {
		return NextResponse.json(
			{ success: false, error: "Authentication required" },
			{ status: 401 }
		);
	}

	try {
		const { templateId } = await params;

		if (!templateId) {
			return NextResponse.json(
				{ success: false, error: "Template ID is required" },
				{ status: 400 }
			);
		}

		const template = await getTemplateDetail(templateId, userContext);

		if (!template) {
			return NextResponse.json(
				{ success: false, error: "Template not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json({
			success: true,
			template,
		});
	} catch (error) {
		console.error("Get template error:", error);
		const message = error instanceof Error ? error.message : "Failed to get template";
		return NextResponse.json(
			{ success: false, error: message },
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/v1/import/templates/[templateId]
 * Delete a template.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
	// Authenticate
	const userContext = await getUserContext();
	if (!userContext) {
		return NextResponse.json(
			{ success: false, error: "Authentication required" },
			{ status: 401 }
		);
	}

	try {
		const { templateId } = await params;

		if (!templateId) {
			return NextResponse.json(
				{ success: false, error: "Template ID is required" },
				{ status: 400 }
			);
		}

		const result = await deleteTemplate(templateId, userContext);

		if (!result.success) {
			return NextResponse.json(
				{ success: false, error: result.error || "Failed to delete template" },
				{ status: 400 }
			);
		}

		return NextResponse.json({
			success: true,
		});
	} catch (error) {
		console.error("Delete template error:", error);
		const message = error instanceof Error ? error.message : "Failed to delete template";
		return NextResponse.json(
			{ success: false, error: message },
			{ status: 500 }
		);
	}
}
