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
}

/**
 * Get user context for privacy-aware operations.
 * Returns null if not authenticated.
 */
export async function getUserContext(): Promise<UserContext | null> {
	const session = await getServerSession();
	if (!session?.user?.id) return null;
	return {
		userId: session.user.id,
		organizationId: (session.user as { organizationId?: string }).organizationId ?? undefined,
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
