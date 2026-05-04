import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

interface ScraperAccessOptions {
	allowApiKey?: boolean;
}

export async function requireScraperAccess(
	request: NextRequest,
	options: ScraperAccessOptions = {}
): Promise<NextResponse | null> {
	const apiKey = process.env.SCRAPER_API_KEY?.trim();
	const authHeader = request.headers.get("authorization");

	if (options.allowApiKey && apiKey && authHeader === `Bearer ${apiKey}`) {
		return null;
	}

	const session = await auth();
	if (session?.user) {
		return null;
	}

	return NextResponse.json(
		{ success: false, message: "Unauthorized" },
		{ status: 401 }
	);
}
