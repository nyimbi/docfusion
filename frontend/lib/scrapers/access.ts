export const DEFAULT_SCRAPER_ROLES = new Set([
	"admin",
	"operations",
	"scraper_admin",
	"scraper_operator",
]);

export function hasScraperRole(
	user: { role?: string; roles?: string[] },
	allowedRoles: Set<string> = DEFAULT_SCRAPER_ROLES
): boolean {
	return normalizeRoles(user.role, user.roles).some((role) => allowedRoles.has(role));
}

function normalizeRoles(role?: string, roles?: string[]): string[] {
	return [...new Set([role, ...(roles ?? [])].filter((value): value is string => Boolean(value)))];
}
