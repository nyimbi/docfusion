import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEFAULT_SCRAPER_ROLES, hasScraperRole } from "@/lib/scrapers/access";

interface ScraperAccessOptions {
	allowApiKey?: boolean;
	allowedRoles?: string[];
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
	if (session?.user?.id) {
		const user = session.user as {
			role?: string;
			roles?: string[];
		};
		const allowedRoles = new Set(options.allowedRoles ?? DEFAULT_SCRAPER_ROLES);
		if (hasScraperRole(user, allowedRoles)) {
			return null;
		}
		return NextResponse.json(
			{ success: false, message: "Forbidden" },
			{ status: 403 }
		);
	}

	return NextResponse.json(
		{ success: false, message: "Unauthorized" },
		{ status: 401 }
	);
}
