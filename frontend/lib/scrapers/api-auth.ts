import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

interface ScraperAccessOptions {
	allowApiKey?: boolean;
	allowedRoles?: string[];
}

const DEFAULT_SCRAPER_ROLES = new Set([
	"admin",
	"operations",
	"scraper_admin",
	"scraper_operator",
]);

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
		const roles = normalizeRoles(user.role, user.roles);
		if (roles.some((role) => allowedRoles.has(role))) {
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

function normalizeRoles(role?: string, roles?: string[]): string[] {
	return [...new Set([role, ...(roles ?? [])].filter((value): value is string => Boolean(value)))];
}
