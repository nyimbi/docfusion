import type { DefaultSession } from "next-auth";

declare module "next-auth" {
	interface Session {
		user: {
			id: string;
			keycloakId?: string;
			organizationId?: string | null;
			role?: string;
			roles?: string[];
		} & DefaultSession["user"];
		error?: "RefreshAccessTokenError";
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		accessToken?: string;
		refreshToken?: string;
		idToken?: string;
		accessTokenExpires?: number;
		keycloakSub?: string;
		localUserId?: string;
		organizationId?: string | null;
		role?: string;
		roles?: string[];
		error?: "RefreshAccessTokenError";
	}
}
