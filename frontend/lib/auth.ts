/**
 * Server-side Better Auth Configuration
 *
 * Configures authentication with email/password, session management,
 * and cookie caching for optimal performance.
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";

// Secret for signing sessions
// For production, MUST set BETTER_AUTH_SECRET environment variable
// For development/build, uses a fallback secret
const authSecret = process.env.BETTER_AUTH_SECRET ||
	"docfusion-dev-secret-change-in-production-12345678901234567890";

export const auth = betterAuth({
	secret: authSecret,
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false, // Can enable later with email provider
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24, // Update session every 24 hours
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // 5 minutes
		},
	},
	trustedOrigins: [
		process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
	],
	plugins: [
		nextCookies(), // Must be last plugin - handles Set-Cookie in server actions
	],
});

// Type exports for use throughout the application
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
