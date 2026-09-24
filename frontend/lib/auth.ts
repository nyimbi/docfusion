/**
 * DocFusion Authentication System
 *
 * Next-Auth (Auth.js v5) with Keycloak OIDC provider.
 * Replaces better-auth for SSO integration with PJS infrastructure.
 */

import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import type { JWT } from "next-auth/jwt";
import { db } from "@/lib/db";
import { user, organization } from "@/lib/db/auth-schema";
import { eq } from "drizzle-orm";

function decodeJwtPayload(token: string): Record<string, unknown> {
	return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
}

function stringClaim(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0
		? value
		: undefined;
}

async function ensureDatacraftOrganization() {
	const existing = await getDatacraftOrganization();
	if (existing) return existing;

	const [created] = await db
		.insert(organization)
		.values({
			id: crypto.randomUUID(),
			name: "Datacraft",
			slug: "datacraft",
			description: "Datacraft Consulting & Technology",
			industry: "Technology & Consulting",
			size: "small",
			location: "South Africa",
			contactEmail: "info@datacraft.co.za",
			isActive: true,
		})
		.returning();

	return created;
}

async function syncKeycloakUser(decoded: Record<string, unknown>) {
	const keycloakSub = stringClaim(decoded.sub);
	if (!keycloakSub) {
		throw new Error("Keycloak token is missing sub");
	}

	const email =
		stringClaim(decoded.email) ??
		`${keycloakSub}@keycloak.local`;
	const name =
		stringClaim(decoded.name) ??
		(
			[stringClaim(decoded.given_name), stringClaim(decoded.family_name)]
				.filter(Boolean)
				.join(" ") || email
		);
	const image = stringClaim(decoded.picture);
	const datacraft = await ensureDatacraftOrganization();

	const existing =
		(await db.query.user.findFirst({
			where: eq(user.keycloakId, keycloakSub),
		})) ??
		(await db.query.user.findFirst({
			where: eq(user.email, email),
		}));

	if (existing) {
		const [updated] = await db
			.update(user)
			.set({
				keycloakId: keycloakSub,
				name,
				email,
				image,
				emailVerified: decoded.email_verified === true,
				organizationId: existing.organizationId ?? datacraft.id,
				isActive: true,
				updatedAt: new Date(),
			})
			.where(eq(user.id, existing.id))
			.returning();
		return updated;
	}

	const [created] = await db
		.insert(user)
		.values({
			id: crypto.randomUUID(),
			keycloakId: keycloakSub,
			name,
			email,
			image,
			emailVerified: decoded.email_verified === true,
			organizationId: datacraft.id,
			role: "member",
			isActive: true,
		})
		.returning();
	return created;
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
	try {
		const res = await fetch(
			`${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`,
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					client_id: process.env.KEYCLOAK_CLIENT_ID!,
					client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
					grant_type: "refresh_token",
					refresh_token: token.refreshToken as string,
				}),
				cache: "no-store",
			},
		);
		if (!res.ok) throw new Error("Refresh failed");
		const data = await res.json();
		const decoded = decodeJwtPayload(data.access_token);
		const roles = (decoded.realm_access as { roles?: string[] })?.roles ?? [];
		const localUser = await syncKeycloakUser(decoded);

		return {
			...token,
			accessToken: data.access_token,
			refreshToken: data.refresh_token ?? token.refreshToken,
			idToken: data.id_token ?? token.idToken,
			accessTokenExpires: Date.now() + data.expires_in * 1000,
			keycloakSub: decoded.sub as string,
			localUserId: localUser.id,
			organizationId: localUser.organizationId,
			role: localUser.role,
			roles,
			error: undefined,
		};
	} catch {
		return { ...token, error: "RefreshAccessTokenError" };
	}
}

export const { handlers, auth, signIn, signOut } = NextAuth({
	providers: [
		Keycloak({
			clientId: process.env.KEYCLOAK_CLIENT_ID!,
			clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
			issuer: process.env.KEYCLOAK_ISSUER!,
		}),
	],
	secret: process.env.NEXTAUTH_SECRET,
	session: { strategy: "jwt" },
	pages: { signIn: "/auth/sign-in" },
	trustHost: true,
	callbacks: {
		jwt: async ({ token, account }) => {
			if (account) {
				const decoded = decodeJwtPayload(account.access_token!);
				const roles = (decoded.realm_access as { roles?: string[] })?.roles ?? [];
				const localUser = await syncKeycloakUser(decoded);
				return {
					...token,
					accessToken: account.access_token,
					refreshToken: account.refresh_token,
					idToken: account.id_token,
					accessTokenExpires: account.expires_at
						? account.expires_at * 1000
						: Date.now() + 300_000,
					keycloakSub: decoded.sub as string,
					localUserId: localUser.id,
					organizationId: localUser.organizationId,
					role: localUser.role,
					roles,
				};
			}
			if (
				token.accessTokenExpires &&
				Date.now() < (token.accessTokenExpires as number) - 30_000
			) {
				return token;
			}
			return refreshAccessToken(token);
		},
		session: async ({ session, token }) => {
			if (token.localUserId) session.user.id = token.localUserId as string;
			if (token.keycloakSub) {
				session.user.keycloakId = token.keycloakSub;
			}
			if (token.organizationId) {
				session.user.organizationId = token.organizationId;
			}
			if (token.role) {
				session.user.role = token.role;
			}
			if (token.roles) {
				session.user.roles = token.roles;
			}
			if (token.error) {
				session.error = token.error;
			}
			return session;
		},
	},
	events: {
		// Backchannel logout — end Keycloak SSO session on sign out
		signOut: async (message) => {
			const token = "token" in message ? message.token : null;
			if (!token?.idToken) return;
			try {
				await fetch(
					`${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout`,
					{
						method: "POST",
						headers: { "Content-Type": "application/x-www-form-urlencoded" },
						body: new URLSearchParams({
							id_token_hint: token.idToken as string,
							client_id: process.env.KEYCLOAK_CLIENT_ID!,
							client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
						}),
					},
				);
			} catch {
				// Ignore logout errors
			}
		},
	},
});

// ============================================================================
// Organization Helper Functions
// ============================================================================

/**
 * Get the Datacraft organization
 */
export async function getDatacraftOrganization() {
	return db.query.organization.findFirst({
		where: eq(organization.slug, "datacraft"),
	});
}

/**
 * Check if user belongs to Datacraft
 */
export async function isDatacraftMember(userId: string): Promise<boolean> {
	const userRecord = await db.query.user.findFirst({
		where: eq(user.id, userId),
		with: {
			organization: true,
		},
	});

	return userRecord?.organization?.slug === "datacraft";
}

/**
 * Get user's role within Datacraft
 */
export async function getUserRole(userId: string): Promise<string | null> {
	const userRecord = await db.query.user.findFirst({
		where: eq(user.id, userId),
	});

	return userRecord?.role ?? null;
}

/**
 * Check if user has admin privileges
 */
export async function isAdmin(userId: string): Promise<boolean> {
	const role = await getUserRole(userId);
	return role === "admin";
}
