/**
 * API Route: Rate a Template
 * POST /api/v1/templates/[id]/rate
 *
 * Submits a rating (1-5) for a template and updates
 * the weighted average rating.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateTemplate } from "@/lib/actions/templates";
import { getCurrentUserId } from "@/lib/auth-utils";

interface RouteParams {
	params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const { id: templateId } = await params;
		const userId = await getCurrentUserId();
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();

		// Validate rating
		const rating = Number(body.rating);
		if (isNaN(rating) || rating < 1 || rating > 5) {
			return NextResponse.json(
				{ error: "Rating must be a number between 1 and 5" },
				{ status: 400 }
			);
		}

		const result = await rateTemplate({
			templateId,
			rating,
			userId,
		});

		return NextResponse.json({
			success: result.success,
			rating: result.newRating,
			ratingCount: result.newRatingCount,
		});
	} catch (error) {
		console.error("Error rating template:", error);

		if (error instanceof Error) {
			if (error.message === "Template not found") {
				return NextResponse.json(
					{ error: "Template not found" },
					{ status: 404 }
				);
			}
			if (error.message.includes("Rating must be")) {
				return NextResponse.json(
					{ error: error.message },
					{ status: 400 }
				);
			}
		}

		return NextResponse.json(
			{ error: "Failed to rate template" },
			{ status: 500 }
		);
	}
}
