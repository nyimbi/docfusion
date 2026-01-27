/**
 * Client-side Better Auth Client
 *
 * Provides auth hooks and methods for client components.
 * Use these in React components for sign-in, sign-out, and session access.
 */

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	// Use relative URL to automatically use the current origin
	// This avoids port mismatch issues in development
	baseURL:
		typeof window !== "undefined"
			? window.location.origin
			: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});

// Export commonly used auth methods and hooks
export const {
	signIn,
	signUp,
	signOut,
	useSession,
	getSession,
} = authClient;
