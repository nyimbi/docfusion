/**
 * User Settings Server Actions - DocFusion
 *
 * Server actions for managing user profile, preferences, notifications,
 * security settings, API keys, and data exports.
 */

"use server";

import { db } from "@/lib/db";
import { user, session } from "@/lib/db/auth-schema";
import { opportunities, documents, templates } from "@/lib/db/schema";
import { contacts, accounts } from "@/lib/db/schema-crm";
import { rfpDocuments } from "@/lib/db/schema-rfp";
import { templateSnippets } from "@/lib/db/schema-additions";
import { eq, and, ne, count, sql, sum } from "drizzle-orm";
import { requireServerSession, getServerSession } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import crypto from "crypto";

// ============================================================================
// Types
// ============================================================================

export interface UserProfile {
	id: string;
	name: string;
	email: string;
	image: string | null;
	jobTitle: string | null;
	department: string | null;
	bio: string | null;
	phone?: string | null;
}

export interface UserPreferences {
	notifications: {
		email: {
			deadlines: boolean;
			mentions: boolean;
			updates: boolean;
			marketing: boolean;
		};
		push: {
			deadlines: boolean;
			mentions: boolean;
			updates: boolean;
		};
		quietHours?: {
			enabled: boolean;
			start: string; // "22:00"
			end: string; // "08:00"
		};
	};
	appearance: {
		theme: "light" | "dark" | "system";
		density: "comfortable" | "compact";
	};
}

export interface UserSession {
	id: string;
	device: string;
	location: string;
	current: boolean;
	lastActive: string;
	ipAddress: string | null;
}

export interface ApiKey {
	id: string;
	name: string;
	prefix: string;
	createdAt: Date;
	lastUsedAt: Date | null;
}

export interface StorageStats {
	documentsSize: number;
	templatesSize: number;
	attachmentsSize: number;
	totalSize: number;
	limit: number;
}

// ============================================================================
// Default Preferences
// ============================================================================

const DEFAULT_PREFERENCES: UserPreferences = {
	notifications: {
		email: {
			deadlines: true,
			mentions: true,
			updates: false,
			marketing: false,
		},
		push: {
			deadlines: true,
			mentions: true,
			updates: true,
		},
		quietHours: {
			enabled: false,
			start: "22:00",
			end: "08:00",
		},
	},
	appearance: {
		theme: "system",
		density: "comfortable",
	},
};

// ============================================================================
// Profile Operations
// ============================================================================

/**
 * Get the current user's profile
 */
export async function getUserProfile(): Promise<UserProfile | null> {
	const sessionData = await getServerSession();
	if (!sessionData?.user?.id) return null;

	const [userData] = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			image: user.image,
			jobTitle: user.jobTitle,
			department: user.department,
			bio: user.bio,
			preferences: user.preferences,
		})
		.from(user)
		.where(eq(user.id, sessionData.user.id));

	if (!userData) return null;

	const prefs = userData.preferences as Record<string, unknown> | null;

	return {
		id: userData.id,
		name: userData.name,
		email: userData.email,
		image: userData.image,
		jobTitle: userData.jobTitle,
		department: userData.department,
		bio: userData.bio,
		phone: (prefs?.phone as string) ?? null,
	};
}

/**
 * Update the current user's profile
 */
export async function updateUserProfile(data: {
	name?: string;
	jobTitle?: string;
	department?: string;
	bio?: string;
	phone?: string;
}): Promise<{ success: boolean; error?: string }> {
	try {
		const sessionData = await requireServerSession();

		// Get existing preferences to preserve them
		const [existing] = await db
			.select({ preferences: user.preferences })
			.from(user)
			.where(eq(user.id, sessionData.user.id));

		const currentPrefs = (existing?.preferences as Record<string, unknown>) ?? {};

		await db
			.update(user)
			.set({
				name: data.name,
				jobTitle: data.jobTitle,
				department: data.department,
				bio: data.bio,
				preferences: {
					...currentPrefs,
					phone: data.phone,
				},
				updatedAt: new Date(),
			})
			.where(eq(user.id, sessionData.user.id));

		revalidatePath("/settings");
		return { success: true };
	} catch (error) {
		console.error("Failed to update profile:", error);
		return { success: false, error: "Failed to update profile" };
	}
}

/**
 * Update user avatar
 */
export async function updateUserAvatar(imageUrl: string): Promise<{ success: boolean; error?: string }> {
	try {
		const sessionData = await requireServerSession();

		await db
			.update(user)
			.set({
				image: imageUrl,
				updatedAt: new Date(),
			})
			.where(eq(user.id, sessionData.user.id));

		revalidatePath("/settings");
		return { success: true };
	} catch (error) {
		console.error("Failed to update avatar:", error);
		return { success: false, error: "Failed to update avatar" };
	}
}

// ============================================================================
// Preferences Operations
// ============================================================================

/**
 * Get user preferences
 */
export async function getUserPreferences(): Promise<UserPreferences> {
	const sessionData = await getServerSession();
	if (!sessionData?.user?.id) return DEFAULT_PREFERENCES;

	const [userData] = await db
		.select({ preferences: user.preferences })
		.from(user)
		.where(eq(user.id, sessionData.user.id));

	if (!userData?.preferences) return DEFAULT_PREFERENCES;

	const prefs = userData.preferences as Record<string, unknown>;
	return {
		...DEFAULT_PREFERENCES,
		...prefs,
		notifications: {
			...DEFAULT_PREFERENCES.notifications,
			...(prefs.notifications as UserPreferences["notifications"] ?? {}),
		},
		appearance: {
			...DEFAULT_PREFERENCES.appearance,
			...(prefs.appearance as UserPreferences["appearance"] ?? {}),
		},
	};
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
	notifications: UserPreferences["notifications"]
): Promise<{ success: boolean; error?: string }> {
	try {
		const sessionData = await requireServerSession();

		const [existing] = await db
			.select({ preferences: user.preferences })
			.from(user)
			.where(eq(user.id, sessionData.user.id));

		const currentPrefs = (existing?.preferences as Record<string, unknown>) ?? {};

		await db
			.update(user)
			.set({
				preferences: {
					...currentPrefs,
					notifications,
				},
				updatedAt: new Date(),
			})
			.where(eq(user.id, sessionData.user.id));

		revalidatePath("/settings");
		return { success: true };
	} catch (error) {
		console.error("Failed to update notification preferences:", error);
		return { success: false, error: "Failed to update preferences" };
	}
}

/**
 * Update appearance preferences
 */
export async function updateAppearancePreferences(
	appearance: UserPreferences["appearance"]
): Promise<{ success: boolean; error?: string }> {
	try {
		const sessionData = await requireServerSession();

		const [existing] = await db
			.select({ preferences: user.preferences })
			.from(user)
			.where(eq(user.id, sessionData.user.id));

		const currentPrefs = (existing?.preferences as Record<string, unknown>) ?? {};

		await db
			.update(user)
			.set({
				preferences: {
					...currentPrefs,
					appearance,
				},
				updatedAt: new Date(),
			})
			.where(eq(user.id, sessionData.user.id));

		revalidatePath("/settings");
		return { success: true };
	} catch (error) {
		console.error("Failed to update appearance preferences:", error);
		return { success: false, error: "Failed to update preferences" };
	}
}

// ============================================================================
// Security Operations
// ============================================================================

/**
 * Get active sessions for current user
 */
export async function getUserSessions(): Promise<UserSession[]> {
	const sessionData = await getServerSession();
	if (!sessionData?.user?.id) return [];

	const headersList = await headers();
	const currentSessionToken = headersList.get("cookie")?.match(/better-auth\.session_token=([^;]+)/)?.[1];

	const sessions = await db
		.select({
			id: session.id,
			token: session.token,
			userAgent: session.userAgent,
			ipAddress: session.ipAddress,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
		})
		.from(session)
		.where(eq(session.userId, sessionData.user.id));

	return sessions.map((s) => {
		const ua = s.userAgent ?? "Unknown device";
		const device = parseUserAgent(ua);
		const isCurrent = s.token === currentSessionToken;

		return {
			id: s.id,
			device,
			location: "Unknown", // Would need IP geolocation service
			current: isCurrent,
			lastActive: isCurrent ? "Now" : formatRelativeTime(s.updatedAt),
			ipAddress: s.ipAddress,
		};
	});
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
	try {
		const sessionData = await requireServerSession();

		// Verify the session belongs to the current user
		const [targetSession] = await db
			.select({ userId: session.userId })
			.from(session)
			.where(eq(session.id, sessionId));

		if (!targetSession || targetSession.userId !== sessionData.user.id) {
			return { success: false, error: "Session not found" };
		}

		await db.delete(session).where(eq(session.id, sessionId));

		revalidatePath("/settings");
		return { success: true };
	} catch (error) {
		console.error("Failed to revoke session:", error);
		return { success: false, error: "Failed to revoke session" };
	}
}

/**
 * Change user password
 */
export async function changePassword(
	currentPassword: string,
	newPassword: string
): Promise<{ success: boolean; error?: string }> {
	try {
		const sessionData = await requireServerSession();

		// Validate new password requirements
		if (newPassword.length < 8) {
			return { success: false, error: "New password must be at least 8 characters" };
		}

		// Get user's current password hash
		const [userData] = await db
			.select({ id: user.id, password: sql<string>`password` })
			.from(sql`"user"`)
			.where(eq(user.id, sessionData.user.id));

		if (!userData) {
			return { success: false, error: "User not found" };
		}

		// Verify current password using bcryptjs comparison (pure JS, works in serverless)
		const bcrypt = await import("bcryptjs");
		const isValidPassword = await bcrypt.compare(currentPassword, userData.password || "");

		if (!isValidPassword) {
			return { success: false, error: "Current password is incorrect" };
		}

		// Hash new password
		const hashedPassword = await bcrypt.hash(newPassword, 10);

		// Update password in database
		await db
			.update(user)
			.set({
				updatedAt: new Date(),
			})
			.where(eq(user.id, sessionData.user.id));

		// Update the password hash directly (Better Auth stores it in user table)
		await db.execute(
			sql`UPDATE "user" SET password = ${hashedPassword} WHERE id = ${sessionData.user.id}`
		);

		revalidatePath("/settings");
		return { success: true };
	} catch (error) {
		console.error("Failed to change password:", error);
		return { success: false, error: "Failed to change password" };
	}
}

/**
 * Revoke all sessions except current
 */
export async function revokeAllOtherSessions(): Promise<{ success: boolean; error?: string }> {
	try {
		const sessionData = await requireServerSession();

		const headersList = await headers();
		const currentSessionToken = headersList.get("cookie")?.match(/better-auth\.session_token=([^;]+)/)?.[1];

		if (!currentSessionToken) {
			return { success: false, error: "Could not identify current session" };
		}

		await db
			.delete(session)
			.where(
				and(
					eq(session.userId, sessionData.user.id),
					ne(session.token, currentSessionToken)
				)
			);

		revalidatePath("/settings");
		return { success: true };
	} catch (error) {
		console.error("Failed to revoke sessions:", error);
		return { success: false, error: "Failed to revoke sessions" };
	}
}

// ============================================================================
// API Key Operations
// ============================================================================

/**
 * Generate a new API key
 */
export async function generateApiKey(name: string): Promise<{ success: boolean; key?: string; error?: string }> {
	try {
		const sessionData = await requireServerSession();

		// Generate a secure API key
		const keyBytes = crypto.randomBytes(32);
		const key = `dk_live_${keyBytes.toString("hex")}`;
		const prefix = key.substring(0, 15);

		// Store hashed key in user preferences
		const [existing] = await db
			.select({ preferences: user.preferences })
			.from(user)
			.where(eq(user.id, sessionData.user.id));

		const currentPrefs = (existing?.preferences as Record<string, unknown>) ?? {};
		const apiKeys = (currentPrefs.apiKeys as ApiKey[]) ?? [];

		// Hash the key for storage
		const hashedKey = crypto.createHash("sha256").update(key).digest("hex");

		apiKeys.push({
			id: crypto.randomUUID(),
			name,
			prefix,
			hashedKey,
			createdAt: new Date(),
			lastUsedAt: null,
		} as unknown as ApiKey);

		await db
			.update(user)
			.set({
				preferences: {
					...currentPrefs,
					apiKeys,
				},
				updatedAt: new Date(),
			})
			.where(eq(user.id, sessionData.user.id));

		revalidatePath("/settings");
		return { success: true, key }; // Return full key only on creation
	} catch (error) {
		console.error("Failed to generate API key:", error);
		return { success: false, error: "Failed to generate API key" };
	}
}

/**
 * Delete an API key
 */
export async function deleteApiKey(keyId: string): Promise<{ success: boolean; error?: string }> {
	try {
		const sessionData = await requireServerSession();

		const [existing] = await db
			.select({ preferences: user.preferences })
			.from(user)
			.where(eq(user.id, sessionData.user.id));

		const currentPrefs = (existing?.preferences as Record<string, unknown>) ?? {};
		const apiKeys = ((currentPrefs.apiKeys as ApiKey[]) ?? []).filter((k) => k.id !== keyId);

		await db
			.update(user)
			.set({
				preferences: {
					...currentPrefs,
					apiKeys,
				},
				updatedAt: new Date(),
			})
			.where(eq(user.id, sessionData.user.id));

		revalidatePath("/settings");
		return { success: true };
	} catch (error) {
		console.error("Failed to delete API key:", error);
		return { success: false, error: "Failed to delete API key" };
	}
}

/**
 * Get list of API keys (without full key values)
 */
export async function getApiKeys(): Promise<ApiKey[]> {
	const sessionData = await getServerSession();
	if (!sessionData?.user?.id) return [];

	const [userData] = await db
		.select({ preferences: user.preferences })
		.from(user)
		.where(eq(user.id, sessionData.user.id));

	if (!userData?.preferences) return [];

	const prefs = userData.preferences as Record<string, unknown>;
	const keys = (prefs.apiKeys as ApiKey[]) ?? [];

	// Return without hashed keys
	return keys.map((k) => ({
		id: k.id,
		name: k.name,
		prefix: k.prefix,
		createdAt: k.createdAt,
		lastUsedAt: k.lastUsedAt,
	}));
}

// ============================================================================
// Data & Storage Operations
// ============================================================================

/**
 * Get storage usage statistics
 */
export async function getStorageStats(): Promise<StorageStats> {
	const sessionData = await getServerSession();
	if (!sessionData?.user?.id) {
		return {
			documentsSize: 0,
			templatesSize: 0,
			attachmentsSize: 0,
			totalSize: 0,
			limit: 10 * 1024 * 1024 * 1024, // 10 GB default
		};
	}

	// Calculate document storage size
	// Estimate based on document content size (JSONB content typically stored)
	const [docStats] = await db
		.select({
			count: count(),
			// Estimate document size from word count (~6 bytes per word average)
			estimatedSize: sql<number>`COALESCE(SUM(COALESCE(${documents.wordCount}, 0) * 6), 0)`,
		})
		.from(documents);

	// Calculate RFP document storage (actual file sizes tracked)
	const [rfpStats] = await db
		.select({
			totalSize: sql<number>`COALESCE(SUM(${rfpDocuments.fileSize}), 0)`,
		})
		.from(rfpDocuments);

	// Calculate template storage
	// Templates store JSONB content - estimate ~10KB average per template
	const [templateStats] = await db
		.select({
			count: count(),
		})
		.from(templates);

	// Calculate content library storage
	// Snippets store text content - estimate based on content length
	const [snippetStats] = await db
		.select({
			count: count(),
			// Estimate: avg snippet is ~2KB of content
			estimatedSize: sql<number>`COALESCE(COUNT(*) * 2048, 0)`,
		})
		.from(templateSnippets);

	// Document size includes regular docs + RFP files
	const documentsSize = (docStats?.estimatedSize ?? 0) + (rfpStats?.totalSize ?? 0);

	// Template size: template count * estimated 10KB per template
	const templatesSize = (templateStats?.count ?? 0) * 10240;

	// Attachments include content library snippets
	const attachmentsSize = snippetStats?.estimatedSize ?? 0;

	return {
		documentsSize,
		templatesSize,
		attachmentsSize,
		totalSize: documentsSize + templatesSize + attachmentsSize,
		limit: 10 * 1024 * 1024 * 1024, // 10 GB
	};
}

/**
 * Export opportunities to CSV
 */
export async function exportOpportunitiesCSV(): Promise<{ success: boolean; data?: string; error?: string }> {
	try {
		await requireServerSession();

		const opps = await db
			.select({
				id: opportunities.id,
				title: opportunities.title,
				category: opportunities.category,
				organization: opportunities.organization,
				countryRegion: opportunities.countryRegion,
				deadline: opportunities.deadline,
				budgetValue: opportunities.budgetValue,
				decisionStatus: opportunities.decisionStatus,
				priorityRank: opportunities.priorityRank,
				rfpLink: opportunities.rfpLink,
			})
			.from(opportunities)
			.limit(10000);

		// Build CSV
		const headers = ["ID", "Title", "Category", "Organization", "Country/Region", "Deadline", "Budget", "Status", "Priority", "RFP Link"];
		const rows = opps.map((o) => [
			o.id,
			`"${(o.title ?? "").replace(/"/g, '""')}"`,
			o.category ?? "",
			`"${(o.organization ?? "").replace(/"/g, '""')}"`,
			o.countryRegion ?? "",
			o.deadline?.toISOString() ?? "",
			o.budgetValue ?? "",
			o.decisionStatus ?? "",
			o.priorityRank?.toString() ?? "",
			o.rfpLink ?? "",
		]);

		const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

		return { success: true, data: csv };
	} catch (error) {
		console.error("Failed to export opportunities:", error);
		return { success: false, error: "Failed to export opportunities" };
	}
}

/**
 * Export contacts to CSV
 * Includes account name via join for company info
 */
export async function exportContactsCSV(): Promise<{ success: boolean; data?: string; error?: string }> {
	try {
		await requireServerSession();

		// Join with accounts to get company name
		const contactList = await db
			.select({
				id: contacts.id,
				firstName: contacts.firstName,
				lastName: contacts.lastName,
				email: contacts.email,
				phone: contacts.phone,
				title: contacts.title,
				department: contacts.department,
				linkedinUrl: contacts.linkedinUrl,
				country: contacts.country,
				city: contacts.city,
				accountName: accounts.name,
			})
			.from(contacts)
			.leftJoin(accounts, eq(contacts.accountId, accounts.id))
			.limit(10000);

		// Build CSV
		const headers = ["ID", "First Name", "Last Name", "Email", "Phone", "Company", "Job Title", "Department", "LinkedIn", "Country", "City"];
		const rows = contactList.map((c) => [
			c.id,
			`"${(c.firstName ?? "").replace(/"/g, '""')}"`,
			`"${(c.lastName ?? "").replace(/"/g, '""')}"`,
			c.email ?? "",
			c.phone ?? "",
			`"${(c.accountName ?? "").replace(/"/g, '""')}"`,
			`"${(c.title ?? "").replace(/"/g, '""')}"`,
			`"${(c.department ?? "").replace(/"/g, '""')}"`,
			c.linkedinUrl ?? "",
			c.country ?? "",
			c.city ?? "",
		]);

		const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

		return { success: true, data: csv };
	} catch (error) {
		console.error("Failed to export contacts:", error);
		return { success: false, error: "Failed to export contacts" };
	}
}

/**
 * Export accounts to CSV
 */
export async function exportAccountsCSV(): Promise<{ success: boolean; data?: string; error?: string }> {
	try {
		await requireServerSession();

		const accountList = await db
			.select({
				id: accounts.id,
				name: accounts.name,
				industry: accounts.industry,
				website: accounts.website,
				country: accounts.country,
				city: accounts.city,
				phone: accounts.phone,
				email: accounts.email,
			})
			.from(accounts)
			.limit(10000);

		// Build CSV
		const headers = ["ID", "Name", "Industry", "Website", "Country", "City", "Phone", "Email"];
		const rows = accountList.map((a) => [
			a.id,
			`"${(a.name ?? "").replace(/"/g, '""')}"`,
			a.industry ?? "",
			a.website ?? "",
			a.country ?? "",
			a.city ?? "",
			a.phone ?? "",
			a.email ?? "",
		]);

		const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

		return { success: true, data: csv };
	} catch (error) {
		console.error("Failed to export accounts:", error);
		return { success: false, error: "Failed to export accounts" };
	}
}

// ============================================================================
// Danger Zone Operations
// ============================================================================

/**
 * Delete all user data (documents, opportunities, etc.)
 * DANGER: This is irreversible!
 */
export async function deleteAllUserData(): Promise<{ success: boolean; deletedCounts?: Record<string, number>; error?: string }> {
	try {
		const sessionData = await requireServerSession();
		const userId = sessionData.user.id;

		console.log(`[DANGER] Delete all data requested by user: ${userId}`);

		// Delete user-owned data in correct order (respecting foreign keys)
		const deletedCounts: Record<string, number> = {};

		// Delete documents owned by user
		const docsResult = await db.delete(documents).where(eq(documents.ownerId, userId));
		deletedCounts.documents = docsResult.rowCount || 0;

		// Unassign opportunities from user (opportunities are shared business data, not deleted)
		const oppsResult = await db
			.update(opportunities)
			.set({ assignedTo: null })
			.where(eq(opportunities.assignedTo, userId));
		deletedCounts.opportunitiesUnassigned = oppsResult.rowCount || 0;

		// Delete contacts owned by user
		const contactsResult = await db.delete(contacts).where(eq(contacts.ownerId, userId));
		deletedCounts.contacts = contactsResult.rowCount || 0;

		// Delete accounts owned by user
		const accountsResult = await db.delete(accounts).where(eq(accounts.ownerId, userId));
		deletedCounts.accounts = accountsResult.rowCount || 0;

		console.log(`[DANGER] Deleted data for user ${userId}:`, deletedCounts);

		revalidatePath("/");
		return { success: true, deletedCounts };
	} catch (error) {
		console.error("Failed to delete user data:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to delete data" };
	}
}

/**
 * Delete user account
 * DANGER: This is irreversible!
 */
export async function deleteUserAccount(): Promise<{ success: boolean; error?: string }> {
	try {
		const sessionData = await requireServerSession();
		const userId = sessionData.user.id;

		console.log(`[DANGER] Delete account requested by user: ${userId}`);

		// 1. Delete all user data first
		const dataResult = await deleteAllUserData();
		if (!dataResult.success) {
			return { success: false, error: dataResult.error || "Failed to delete user data" };
		}

		// 2. Delete all sessions for this user
		await db.delete(session).where(eq(session.userId, userId));

		// 3. Delete the user account
		await db.delete(user).where(eq(user.id, userId));

		console.log(`[DANGER] Account deleted for user: ${userId}`);

		return { success: true };
	} catch (error) {
		console.error("Failed to delete account:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to delete account" };
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseUserAgent(ua: string): string {
	if (ua.includes("Chrome") && ua.includes("Mac")) return "Chrome on MacOS";
	if (ua.includes("Chrome") && ua.includes("Windows")) return "Chrome on Windows";
	if (ua.includes("Chrome") && ua.includes("Linux")) return "Chrome on Linux";
	if (ua.includes("Safari") && ua.includes("iPhone")) return "Safari on iPhone";
	if (ua.includes("Safari") && ua.includes("iPad")) return "Safari on iPad";
	if (ua.includes("Safari") && ua.includes("Mac")) return "Safari on MacOS";
	if (ua.includes("Firefox") && ua.includes("Windows")) return "Firefox on Windows";
	if (ua.includes("Firefox") && ua.includes("Mac")) return "Firefox on MacOS";
	if (ua.includes("Firefox") && ua.includes("Linux")) return "Firefox on Linux";
	if (ua.includes("Edge")) return "Edge on Windows";
	return "Unknown browser";
}

function formatRelativeTime(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
	if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
	if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
	return date.toLocaleDateString();
}
