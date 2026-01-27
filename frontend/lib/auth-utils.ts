/**
 * Server-Side Auth Utilities
 *
 * Helper functions for accessing session data in server components
 * and server actions.
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Get the current session in a server component or server action.
 * Returns null if no valid session exists.
 */
export async function getServerSession() {
	return auth.api.getSession({
		headers: await headers(),
	});
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
