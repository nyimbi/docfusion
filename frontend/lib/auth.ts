/**
 * DocFusion Authentication System
 *
 * Better Auth configuration with Datacraft organization enforcement.
 * All users are members of the Datacraft organization.
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { user, session, account, verification, organization } from "@/lib/db/auth-schema";
import { eq } from "drizzle-orm";

// Get database connection
import { Pool } from "pg";

// PostgreSQL pool for Better Auth
const pgPool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

// ============================================================================
// Better Auth Configuration
// ============================================================================

export const auth = betterAuth({
	// Database adapter using Drizzle
	database: drizzleAdapter(db, { 
			provider: "pg", 
			schema: { user, session, account, verification, organization }
		}),
	
	// User schema with organization fields
	user: {
		modelName: "user",
		additionalFields: {
			organizationId: {
				type: "string",
				required: false,
			},
			role: {
				type: "string",
				required: false,
			},
			department: {
				type: "string",
				required: false,
			},
			jobTitle: {
				type: "string",
				required: false,
			},
			skills: {
				type: "string",
				required: false,
			},
			bio: {
				type: "string",
				required: false,
			},
		},
	},
	
	// Email and password authentication
	emailAndPassword: {
		enabled: true,
		autoSignIn: true, // Auto sign in after registration
	},
	
	// Session configuration
	session: {
		expiresIn: 60 * 60 * 24, // 24 hours
		updateAge: 60 * 60, // 1 hour
	},
	
	// Cookie configuration
	cookies: {
		sessionToken: {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: 60 * 60 * 24 * 7, // 7 days
		},
	},

	// Plugins
	plugins: [
		// nextCookies plugin for proper cookie handling in Next.js
		// Automatically sets cookies when Set-Cookie headers are present
		nextCookies(),
	],
});

// ============================================================================
// Type Exports
// ============================================================================

export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session;

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
