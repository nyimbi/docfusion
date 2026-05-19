/**
 * API Route: Create Document from Template
 * POST /api/v1/documents/from-template
 *
 * Creates a new document using a template, substituting placeholders
 * and incrementing the template's use count.
 */

import { NextRequest, NextResponse } from "next/server";
import { createDocumentFromTemplate } from "@/lib/actions/templates";
import { getCurrentUserId } from "@/lib/auth-utils";
import type { UseTemplateInput } from "@/lib/types/template";

export async function POST(request: NextRequest) {
	try {
		const userId = await getCurrentUserId();
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();

		// Validate required fields
		if (!body.templateId) {
			return NextResponse.json(
				{ error: "templateId is required" },
				{ status: 400 }
			);
		}

		if (!body.title || typeof body.title !== "string") {
			return NextResponse.json(
				{ error: "title is required and must be a string" },
				{ status: 400 }
			);
		}

		const input: UseTemplateInput = {
			templateId: body.templateId,
			title: body.title.trim(),
			placeholderValues: body.placeholderValues || {},
			useAIFill: body.useAIFill ?? false,
		};

		const result = await createDocumentFromTemplate(input);

		return NextResponse.json({
			id: result.documentId,
			title: result.title,
			success: result.success,
		});
	} catch (error) {
		console.error("Error creating document from template:", error);

		if (error instanceof Error) {
			if (error.message === "Template not found") {
				return NextResponse.json(
					{ error: "Template not found" },
					{ status: 404 }
				);
			}
		}

		return NextResponse.json(
			{ error: "Failed to create document from template" },
			{ status: 500 }
		);
	}
}
