/**
 * Company Setup Schema - DocFusion
 *
 * Additional database tables for company profile management, roles, CVs,
 * clients, products, and services.
 */

import {
	pgTable,
	text,
	timestamp,
	integer,
	jsonb,
	uuid,
	varchar,
	boolean,
	index,
	uniqueIndex,
	real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// Roles - Job roles within the organization
// ============================================================================

export const roles = pgTable(
	"roles",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Organization this role belongs to */
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		/** Role name */
		name: varchar("name", { length: 200 }).notNull(),
		/** Role description */
		description: text("description"),
		/** Department */
		department: varchar("department", { length: 200 }),
		/** Job level */
		level: varchar("level", { length: 50 }),
		/** Responsibilities as JSON array */
		responsibilities: jsonb("responsibilities").notNull().default([]),
		/** Required skills as JSON array */
		skillsRequired: jsonb("skills_required").notNull().default([]),
		/** Created timestamp */
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		/** Updated timestamp */
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("roles_org_idx").on(table.organizationId),
		index("roles_department_idx").on(table.department),
	]
);

// ============================================================================
// CVs - CV/Resume storage for team members
// ============================================================================

export const cvs = pgTable(
	"cvs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** User ID from auth system */
		userId: varchar("user_id", { length: 100 }),
		/** Organization this CV belongs to */
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		/** Full name */
		fullName: varchar("full_name", { length: 200 }).notNull(),
		/** Professional title */
		title: varchar("title", { length: 200 }),
		/** Professional summary */
		summary: text("summary"),
		/** Work experience as JSON array */
		experience: jsonb("experience").notNull().default([]),
		/** Education as JSON array */
		education: jsonb("education").notNull().default([]),
		/** Skills as JSON array */
		skills: jsonb("skills").notNull().default([]),
		/** Certifications as JSON array */
		certifications: jsonb("certifications").notNull().default([]),
		/** Projects as JSON array */
		projects: jsonb("projects").notNull().default([]),
		/** Languages as JSON array */
		languages: jsonb("languages").notNull().default([]),
		/** Publications as JSON array */
		publications: jsonb("publications").notNull().default([]),
		/** Contact email */
		email: varchar("email", { length: 200 }),
		/** Contact phone */
		phone: varchar("phone", { length: 50 }),
		/** LinkedIn URL */
		linkedinUrl: text("linkedin_url"),
		/** Portfolio/website URL */
		portfolioUrl: text("portfolio_url"),
		/** CV version number */
		version: integer("version").notNull().default(1),
		/** Whether this is the active version */
		isActive: boolean("is_active").notNull().default(true),
		/** Created timestamp */
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		/** Updated timestamp */
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("cvs_user_idx").on(table.userId),
		index("cvs_org_idx").on(table.organizationId),
		index("cvs_active_idx").on(table.isActive),
	]
);

// ============================================================================
// Company Profiles - Standard company information
// ============================================================================

export const companyProfiles = pgTable(
	"company_profiles",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Organization ID */
		organizationId: varchar("organization_id", { length: 100 }).notNull().unique(),
		/** Company name */
		name: varchar("name", { length: 500 }).notNull(),
		/** Company description */
		description: text("description"),
		/** Mission statement */
		mission: text("mission"),
		/** Vision statement */
		vision: text("vision"),
		/** Year founded */
		founded: integer("founded"),
		/** Number of employees */
		employees: varchar("employees", { length: 100 }),
		/** Annual revenue */
		revenue: varchar("revenue", { length: 100 }),
		/** Website URL */
		website: varchar("website", { length: 500 }),
		/** Industry */
		industry: varchar("industry", { length: 200 }),
		/** Specialties/Services offered as JSON array */
		specialties: jsonb("specialties").notNull().default([]),
		/** Certifications as JSON array */
		certifications: jsonb("certifications").notNull().default([]),
		/** Awards as JSON array */
		awards: jsonb("awards").notNull().default([]),
		/** Key clients (can be referenced from clients table) */
		keyClients: jsonb("key_clients").notNull().default([]),
		/** Created timestamp */
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		/** Updated timestamp */
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("company_profiles_org_idx").on(table.organizationId),
	]
);

// ============================================================================
// Clients - Client list
// ============================================================================

export const clients = pgTable(
	"clients",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Organization ID */
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		/** Client name */
		name: varchar("name", { length: 500 }).notNull(),
		/** Client industry */
		industry: varchar("industry", { length: 200 }),
		/** Company size (e.g., "1-50", "51-200", etc.) */
		size: varchar("size", { length: 100 }),
		/** Location */
		location: varchar("location", { length: 300 }),
		/** Primary contact name */
		contactName: varchar("contact_name", { length: 200 }),
		/** Primary contact email */
		contactEmail: varchar("contact_email", { length: 200 }),
		/** Primary contact phone */
		contactPhone: varchar("contact_phone", { length: 50 }),
		/** Relationship type */
		relationshipType: varchar("relationship_type", { length: 100 }),
		/** Contract value (if applicable) */
		contractValue: real("contract_value"),
		/** Contract start date */
		startDate: timestamp("start_date", { withTimezone: true }),
		/** Contract end date */
		endDate: timestamp("end_date", { withTimezone: true }),
		/** Client status: active|former|prospect */
		status: varchar("status", { length: 20 }).notNull().default("prospect"),
		/** Notes */
		notes: text("notes"),
		/** Projects with this client as JSON array */
		projects: jsonb("projects").notNull().default([]),
		/** Created timestamp */
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		/** Updated timestamp */
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("clients_org_idx").on(table.organizationId),
		index("clients_status_idx").on(table.status),
		index("clients_industry_idx").on(table.industry),
	]
);

// ============================================================================
// Products - Products/services offered
// ============================================================================

export const products = pgTable(
	"products",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Organization ID */
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		/** Product name */
		name: varchar("name", { length: 500 }).notNull(),
		/** Product category */
		category: varchar("category", { length: 200 }),
		/** Product description (legacy - use longDescription for new entries) */
		description: text("description"),
		/** Short description (max 500 chars, for summaries) */
		shortDescription: varchar("short_description", { length: 500 }),
		/** Long description (detailed product information) */
		longDescription: text("long_description"),
		/** Product website URL */
		websiteUrl: text("website_url"),
		/** Product logo URL */
		logoUrl: text("logo_url"),
		/** Features as JSON array */
		features: jsonb("features").notNull().default([]),
		/** Pricing information */
		pricing: text("pricing"),
		/** Availability status */
		availability: varchar("availability", { length: 100 }),
		/** Documentation URL */
		documentation: text("documentation"),
		/** Product images as JSON array */
		images: jsonb("images").notNull().default([]),
		/** Product status */
		status: varchar("status", { length: 50 }).notNull().default("active"),
		/** Created timestamp */
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		/** Updated timestamp */
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("products_org_idx").on(table.organizationId),
		index("products_category_idx").on(table.category),
		index("products_status_idx").on(table.status),
	]
);

// ============================================================================
// Services - Services offered
// ============================================================================

export const services = pgTable(
	"services",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Organization ID */
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		/** Service name */
		name: varchar("name", { length: 500 }).notNull(),
		/** Service category */
		category: varchar("category", { length: 200 }),
		/** Service description */
		description: text("description"),
		/** Capabilities as JSON array */
		capabilities: jsonb("capabilities").notNull().default([]),
		/** Pricing information */
		pricing: text("pricing"),
		/** Turnaround time */
		turnaround: varchar("turnaround", { length: 200 }),
		/** Certifications as JSON array */
		certifications: jsonb("certifications").notNull().default([]),
		/** Service status */
		status: varchar("status", { length: 50 }).notNull().default("active"),
		/** Created timestamp */
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		/** Updated timestamp */
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("services_org_idx").on(table.organizationId),
		index("services_category_idx").on(table.category),
		index("services_status_idx").on(table.status),
	]
);

// ============================================================================
// Relations
// ============================================================================

export const cvsRelations = relations(cvs, ({ one }) => ({
	// Could add relations to users or roles in the future
}));

export const companyProfilesRelations = relations(companyProfiles, ({ many }) => ({
	// Future relations could include clients, products, services
}));

export const clientsRelations = relations(clients, ({ one }) => ({
	// Could add relations to opportunities in the future
}));

// ============================================================================
// Company Variables - User-defined variables for template substitution
// ============================================================================

export const companyVariables = pgTable(
	"company_variables",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Organization ID */
		organizationId: varchar("organization_id", { length: 100 }).notNull(),
		/** Variable name (used as {{custom.name}} in templates) */
		name: varchar("name", { length: 100 }).notNull(),
		/** Human-readable label */
		label: varchar("label", { length: 200 }).notNull(),
		/** Variable value */
		value: text("value"),
		/** Description/help text */
		description: text("description"),
		/** Value type for validation */
		valueType: varchar("value_type", { length: 20 }).notNull().default("text"),
		/** Category for grouping */
		category: varchar("category", { length: 100 }),
		/** Sort order within category */
		sortOrder: integer("sort_order").notNull().default(0),
		/** Whether this variable is active */
		isActive: boolean("is_active").notNull().default(true),
		/** Created timestamp */
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		/** Updated timestamp */
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("company_variables_org_idx").on(table.organizationId),
		index("company_variables_category_idx").on(table.category),
		uniqueIndex("company_variables_org_name_idx").on(table.organizationId, table.name),
	]
);

export const companyVariablesRelations = relations(companyVariables, ({ }) => ({
	// No relations for now, but could be extended
}));

// ============================================================================
// Type Exports
// ============================================================================

export type RoleRow = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;

export type CVRow = typeof cvs.$inferSelect;
export type NewCV = typeof cvs.$inferInsert;

export type CompanyProfileRow = typeof companyProfiles.$inferSelect;
export type NewCompanyProfile = typeof companyProfiles.$inferInsert;

export type ClientRow = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type ProductRow = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type ServiceRow = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;

export type CompanyVariableRow = typeof companyVariables.$inferSelect;
export type NewCompanyVariable = typeof companyVariables.$inferInsert;
