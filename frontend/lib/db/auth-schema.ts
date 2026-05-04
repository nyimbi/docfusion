import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index, jsonb, uuid } from "drizzle-orm/pg-core";

// ============================================================================
// Organizations (Datacraft is the default organization)
// ============================================================================

export const organization = pgTable(
	"organization",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		slug: text("slug").notNull().unique(),
		description: text("description"),
		logo: text("logo"),
		website: text("website"),
		// Company profile fields
		industry: text("industry"),
		size: text("size"), // small, medium, large, enterprise
		location: text("location"),
		foundedYear: text("founded_year"),
		// Contact info
		contactEmail: text("contact_email"),
		contactPhone: text("contact_phone"),
		// Settings
		settings: jsonb("settings").default({}),
		isActive: boolean("is_active").default(true).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("org_slug_idx").on(table.slug)]
);

// ============================================================================
// Users with Organization Membership
// ============================================================================

export const user = pgTable(
	"user",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		email: text("email").notNull().unique(),
		emailVerified: boolean("email_verified").default(false).notNull(),
		image: text("image"),
		// Keycloak identity mapping
		keycloakId: text("keycloak_id").unique(),
		// Organization membership
		organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }),
		// Role within the organization
		role: text("role").default("member").notNull(), // admin, manager, member, viewer
		// Department/team
		department: text("department"),
		jobTitle: text("job_title"),
		skills: jsonb("skills").default([]),
		bio: text("bio"),
		// User preferences
		preferences: jsonb("preferences").default({}),
		// Status
		isActive: boolean("is_active").default(true).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("user_org_idx").on(table.organizationId),
		index("user_email_idx").on(table.email),
		index("user_keycloak_idx").on(table.keycloakId),
	]
);

// ============================================================================
// Session
// ============================================================================

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at").notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_userId_idx").on(table.userId)]
);

// ============================================================================
// Account (Credentials Provider Support)
// ============================================================================

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("account_userId_idx").on(table.userId)]
);

// ============================================================================
// Verification
// ============================================================================

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)]
);

// ============================================================================
// Relations
// ============================================================================

export const organizationRelations = relations(organization, ({ many }) => ({
	users: many(user),
}));

export const userRelations = relations(user, ({ one, many }) => ({
	organization: one(organization, {
		fields: [user.organizationId],
		references: [organization.id],
	}),
	sessions: many(session),
	accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
}));
