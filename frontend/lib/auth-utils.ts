/**
 * Server-Side Auth Utilities
 *
 * Helper functions for accessing session data in server components
 * and server actions. Uses Next-Auth's auth() function.
 */

import { auth } from "@/lib/auth";

/**
 * Get the current session in a server component or server action.
 * Returns null if no valid session exists.
 */
export async function getServerSession() {
	return auth();
}

/**
 * Get the current session or throw an error if not authenticated.
 * Use this in server actions that require authentication.
 */
export async function requireServerSession() {
	const session = await getServerSession();
	if (!session) {
		throw new Error("Unauthorized");
	}
	return session;
}

/**
 * Get user ID from current session, or null if not authenticated.
 * Convenience method for quick user ID access.
 */
export async function getCurrentUserId(): Promise<string | null> {
	const session = await getServerSession();
	return session?.user?.id ?? null;
}

/**
 * Get user email from current session, or null if not authenticated.
 */
export async function getCurrentUserEmail(): Promise<string | null> {
	const session = await getServerSession();
	return session?.user?.email ?? null;
}

/**
 * User context for privacy-aware operations.
 */
export interface UserContext {
	userId: string;
	organizationId?: string;
	role?: string;
	roles: string[];
}

/**
 * Get user context for privacy-aware operations.
 * Returns null if not authenticated.
 */
export async function getUserContext(): Promise<UserContext | null> {
	const session = await getServerSession();
	if (!session?.user?.id) return null;
	const user = session.user as {
		organizationId?: string;
		role?: string | null;
		roles?: string[] | null;
	};
	return {
		userId: session.user.id,
		organizationId: user.organizationId ?? undefined,
		role: user.role ?? undefined,
		roles: normalizeUserRoles(user.role, user.roles),
	};
}

/**
 * Get user context or throw if not authenticated.
 */
export async function requireUserContext(): Promise<UserContext> {
	const ctx = await getUserContext();
	if (!ctx) throw new Error("Unauthorized");
	return ctx;
}

export function normalizeUserRoles(
	role?: string | null,
	roles?: Array<string | null | undefined> | null
): string[] {
	return [...new Set([role, ...(roles ?? [])]
		.filter((value): value is string => Boolean(value?.trim()))
		.map((value) => value.trim().toLowerCase()))];
}

export function userHasAuthorityRole(
	context: Pick<UserContext, "role" | "roles">,
	requiredRole: string
): boolean {
	const normalized = new Set(normalizeUserRoles(context.role, context.roles));
	if (normalized.has("admin")) {
		return true;
	}
	return authorityRoleAliases(requiredRole).some((role) => normalized.has(role));
}

export function assertUserHasAuthorityRole(
	context: Pick<UserContext, "role" | "roles">,
	requiredRole: string | null | undefined,
	message: string
): string {
	const normalizedRequiredRole = requiredRole?.trim().toLowerCase();
	if (!normalizedRequiredRole) {
		throw new Error(message);
	}
	if (!userHasAuthorityRole(context, normalizedRequiredRole)) {
		throw new Error(`${message}: requires ${normalizedRequiredRole}`);
	}
	return normalizedRequiredRole;
}

function authorityRoleAliases(requiredRole: string): string[] {
	switch (requiredRole.trim().toLowerCase()) {
		case "executive_or_legal":
			return ["executive_or_legal", "executive", "legal"];
		default:
			return [requiredRole.trim().toLowerCase()];
	}
}
