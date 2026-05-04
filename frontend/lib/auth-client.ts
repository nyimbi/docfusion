/**
 * Client-side Authentication Exports
 *
 * Re-exports from next-auth/react for use in client components.
 * Maintains the same API surface as the previous better-auth client.
 */

export {
	signIn,
	signOut,
	useSession,
	getSession,
	SessionProvider,
} from "next-auth/react";
