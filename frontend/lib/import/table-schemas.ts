/**
 * Table Schemas Registry for DocFusion
 *
 * Defines target table schemas for the universal import system.
 * Each schema includes:
 * - Column definitions with types and validation rules
 * - Unique key fields for duplicate detection
 * - Suggested mappings for common source column names
 */

import type {
	ImportTargetTable,
	ImportTargetConfig,
	TableSchema,
	ColumnSchema,
} from "@/lib/types/import";

// ============================================================================
// Target Table Configurations (for UI)
// ============================================================================

/**
 * Configuration for each supported import target.
 * Used to populate the target selection step.
 */
export const IMPORT_TARGETS: ImportTargetConfig[] = [
	{
		value: "opportunities",
		label: "Opportunities",
		description: "RFPs, bids, tenders, and sales opportunities",
		icon: "Target",
		requiredFields: ["title"],
		uniqueKeyFields: ["sourceId", "sourceFile"],
	},
	{
		value: "contacts",
		label: "Contacts",
		description: "People and professionals",
		icon: "Users",
		requiredFields: ["firstName", "lastName"],
		uniqueKeyFields: ["email"],
	},
	{
		value: "accounts",
		label: "Accounts",
		description: "Companies and organizations (partners, prospects, customers)",
		icon: "Building2",
		requiredFields: ["name", "type"],
		uniqueKeyFields: ["name", "country", "type"],
	},
	{
		value: "partners",
		label: "Partners (Legacy)",
		description: "Partner organizations (use Accounts with type=partner instead)",
		icon: "Handshake",
		requiredFields: ["name"],
		uniqueKeyFields: ["name", "country"],
	},
];

// ============================================================================
// Opportunities Schema
// ============================================================================

const OPPORTUNITIES_COLUMNS: ColumnSchema[] = [
	// Core Identity
	{
		name: "sourceId",
		label: "Source ID",
		type: "string",
		required: false,
		maxLength: 50,
		description: "Original ID from the source system (e.g., RFP-085)",
		examples: ["RFP-085", "AFR-066", "TEN-2024-001"],
	},
	{
		name: "title",
		label: "Title",
		type: "string",
		required: true,
		maxLength: 1000,
		description: "Opportunity title or name",
		examples: ["Enterprise Resource Planning System Implementation"],
	},
	{
		name: "category",
		label: "Category",
		type: "string",
		required: false,
		maxLength: 200,
		description: "Opportunity category or type",
		examples: ["GIS", "Digital Transformation", "Cybersecurity"],
	},
	{
		name: "itCategory",
		label: "IT Category",
		type: "string",
		required: false,
		maxLength: 200,
		description: "Specific IT category",
		examples: ["Enterprise Software", "Cloud Services", "Data Analytics"],
	},
	{
		name: "sector",
		label: "Sector",
		type: "string",
		required: false,
		maxLength: 100,
		description: "Industry sector",
		examples: ["Government/SOE", "NGO", "Commercial", "Healthcare"],
	},

	// Location
	{
		name: "countryRegion",
		label: "Country/Region",
		type: "string",
		required: false,
		maxLength: 200,
		description: "Geographic location",
		examples: ["Kenya", "East Africa", "Global"],
	},

	// Organization
	{
		name: "organization",
		label: "Organization",
		type: "string",
		required: false,
		maxLength: 500,
		description: "Client or issuing organization",
		examples: ["Ministry of ICT", "World Bank", "UNDP"],
	},
	{
		name: "funder",
		label: "Funder",
		type: "string",
		required: false,
		maxLength: 500,
		description: "Funding organization (if different from client)",
		examples: ["World Bank", "USAID", "European Union"],
	},

	// Timeline
	{
		name: "deadline",
		label: "Deadline",
		type: "datetime",
		required: false,
		description: "Submission deadline",
	},

	// Financial
	{
		name: "budgetValue",
		label: "Budget/Value",
		type: "string",
		required: false,
		maxLength: 200,
		description: "Budget or estimated value as text",
		examples: ["$500,000 - $1,000,000", "€2M", "TBD"],
	},

	// Content
	{
		name: "projectSummary",
		label: "Project Summary",
		type: "text",
		required: false,
		description: "Brief description of the project",
	},
	{
		name: "projectScope",
		label: "Project Scope",
		type: "text",
		required: false,
		description: "Detailed scope and deliverables",
	},
	{
		name: "keyRequirements",
		label: "Key Requirements",
		type: "text",
		required: false,
		description: "Key requirements and qualifications",
	},
	{
		name: "technicalRequirements",
		label: "Technical Requirements",
		type: "text",
		required: false,
		description: "Technical stack and requirements",
	},

	// Submission
	{
		name: "submissionMethod",
		label: "Submission Method",
		type: "string",
		required: false,
		maxLength: 200,
		description: "How to submit the proposal",
		examples: ["Email", "Portal", "Physical"],
	},
	{
		name: "submissionRequirements",
		label: "Submission Requirements",
		type: "text",
		required: false,
		description: "Submission format and requirements",
	},

	// Links
	{
		name: "rfpLink",
		label: "RFP/Document Link",
		type: "url",
		required: false,
		description: "Link to the RFP or tender document",
	},
	{
		name: "sourcePlatform",
		label: "Source Platform",
		type: "string",
		required: false,
		maxLength: 200,
		description: "Platform where opportunity was found",
		examples: ["TenderBoard", "UNGM", "DevBiz", "SAM.gov"],
	},
	{
		name: "sourceFile",
		label: "Source File",
		type: "string",
		required: false,
		maxLength: 500,
		description: "Original file name (auto-filled)",
	},

	// Type
	{
		name: "opportunityType",
		label: "Opportunity Type",
		type: "string",
		required: false,
		maxLength: 50,
		description: "Type of opportunity",
		allowedValues: ["rfp", "eoi", "tender", "grant", "contract"],
		examples: ["rfp", "eoi", "tender"],
	},

	// Notes (for unmapped columns)
	{
		name: "notes",
		label: "Notes",
		type: "text",
		required: false,
		description: "General notes and additional information from unmapped columns",
	},
];

// ============================================================================
// Contacts Schema
// ============================================================================

const CONTACTS_COLUMNS: ColumnSchema[] = [
	// Identity
	{
		name: "firstName",
		label: "First Name",
		type: "string",
		required: true,
		maxLength: 100,
		description: "First/given name",
	},
	{
		name: "lastName",
		label: "Last Name",
		type: "string",
		required: true,
		maxLength: 100,
		description: "Last/family name",
	},
	{
		name: "fullName",
		label: "Full Name",
		type: "string",
		required: false,
		maxLength: 255,
		description: "Full display name (auto-generated if not provided)",
	},
	{
		name: "salutation",
		label: "Salutation",
		type: "string",
		required: false,
		maxLength: 20,
		description: "Title/salutation",
		allowedValues: ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof."],
	},

	// Professional
	{
		name: "title",
		label: "Job Title",
		type: "string",
		required: false,
		maxLength: 200,
		description: "Professional title or position",
		examples: ["CEO", "Director of IT", "Senior Developer"],
	},
	{
		name: "department",
		label: "Department",
		type: "string",
		required: false,
		maxLength: 100,
		description: "Department within organization",
		examples: ["Engineering", "Marketing", "Finance"],
	},
	{
		name: "role",
		label: "Role",
		type: "string",
		required: false,
		maxLength: 100,
		description: "Role in decision making",
		allowedValues: ["decision_maker", "influencer", "champion", "blocker", "user"],
	},
	{
		name: "seniority",
		label: "Seniority",
		type: "string",
		required: false,
		maxLength: 50,
		allowedValues: ["c_level", "vp", "director", "manager", "individual"],
	},

	// Contact Details
	{
		name: "email",
		label: "Email",
		type: "email",
		required: false,
		maxLength: 255,
		description: "Primary email address",
	},
	{
		name: "emailSecondary",
		label: "Secondary Email",
		type: "email",
		required: false,
		maxLength: 255,
	},
	{
		name: "phone",
		label: "Phone",
		type: "phone",
		required: false,
		maxLength: 50,
		description: "Primary phone number",
	},
	{
		name: "phoneMobile",
		label: "Mobile Phone",
		type: "phone",
		required: false,
		maxLength: 50,
	},
	{
		name: "linkedinUrl",
		label: "LinkedIn URL",
		type: "url",
		required: false,
		maxLength: 500,
	},

	// Location
	{
		name: "country",
		label: "Country",
		type: "string",
		required: false,
		maxLength: 100,
	},
	{
		name: "city",
		label: "City",
		type: "string",
		required: false,
		maxLength: 100,
	},
	{
		name: "timezone",
		label: "Timezone",
		type: "string",
		required: false,
		maxLength: 50,
		examples: ["America/New_York", "Europe/London", "Africa/Nairobi"],
	},

	// Communication
	{
		name: "preferredLanguage",
		label: "Preferred Language",
		type: "string",
		required: false,
		maxLength: 50,
		examples: ["en", "fr", "sw"],
	},
	{
		name: "preferredContactMethod",
		label: "Preferred Contact Method",
		type: "string",
		required: false,
		maxLength: 50,
		allowedValues: ["email", "phone", "linkedin", "whatsapp"],
	},

	// Notes
	{
		name: "notes",
		label: "Notes",
		type: "text",
		required: false,
		description: "General notes about the contact",
	},
];

// ============================================================================
// Accounts Schema
// ============================================================================

const ACCOUNTS_COLUMNS: ColumnSchema[] = [
	// Core Identity
	{
		name: "name",
		label: "Name",
		type: "string",
		required: true,
		maxLength: 500,
		description: "Company or organization name",
	},
	{
		name: "type",
		label: "Account Type",
		type: "string",
		required: true,
		maxLength: 50,
		description: "Type of relationship",
		allowedValues: ["partner", "prospect", "lead", "customer", "vendor", "other"],
	},

	// Classification
	{
		name: "industry",
		label: "Industry",
		type: "string",
		required: false,
		maxLength: 100,
		description: "Primary industry",
		examples: ["Technology", "Healthcare", "Finance", "Government"],
	},
	{
		name: "sector",
		label: "Sector",
		type: "string",
		required: false,
		maxLength: 100,
		examples: ["Software", "Medical Devices", "Banking"],
	},
	{
		name: "category",
		label: "Category",
		type: "string",
		required: false,
		maxLength: 200,
	},
	{
		name: "companySize",
		label: "Company Size",
		type: "string",
		required: false,
		maxLength: 50,
		allowedValues: ["micro", "small", "medium", "large", "enterprise"],
	},

	// Location
	{
		name: "country",
		label: "Country",
		type: "string",
		required: false,
		maxLength: 100,
	},
	{
		name: "region",
		label: "Region",
		type: "string",
		required: false,
		maxLength: 100,
		examples: ["East Africa", "EMEA", "North America"],
	},
	{
		name: "city",
		label: "City",
		type: "string",
		required: false,
		maxLength: 100,
	},
	{
		name: "address",
		label: "Address",
		type: "text",
		required: false,
	},

	// Company Details
	{
		name: "description",
		label: "Description",
		type: "text",
		required: false,
	},
	{
		name: "website",
		label: "Website",
		type: "url",
		required: false,
		maxLength: 500,
	},
	{
		name: "linkedinUrl",
		label: "LinkedIn URL",
		type: "url",
		required: false,
		maxLength: 500,
	},
	{
		name: "foundedYear",
		label: "Founded Year",
		type: "integer",
		required: false,
	},
	{
		name: "employeeCount",
		label: "Employee Count",
		type: "string",
		required: false,
		maxLength: 50,
		examples: ["10-50", "100-500", "1000+"],
	},
	{
		name: "annualRevenue",
		label: "Annual Revenue",
		type: "string",
		required: false,
		maxLength: 100,
		examples: ["$1M-$5M", "$10M+", "Unknown"],
	},

	// Contact
	{
		name: "email",
		label: "Email",
		type: "email",
		required: false,
		maxLength: 255,
	},
	{
		name: "phone",
		label: "Phone",
		type: "phone",
		required: false,
		maxLength: 100,
	},

	// Partner-Specific
	{
		name: "partnerTier",
		label: "Partner Tier",
		type: "integer",
		required: false,
		description: "1=Strategic, 2=Preferred, 3=Approved",
		allowedValues: ["1", "2", "3"],
	},
	{
		name: "coreCapabilities",
		label: "Core Capabilities",
		type: "text",
		required: false,
	},

	// Status
	{
		name: "stage",
		label: "Stage",
		type: "string",
		required: false,
		maxLength: 50,
	},
	{
		name: "status",
		label: "Status",
		type: "string",
		required: false,
		maxLength: 50,
		allowedValues: ["active", "inactive", "churned", "lost", "archived"],
	},

	// Lead Info
	{
		name: "leadSource",
		label: "Lead Source",
		type: "string",
		required: false,
		maxLength: 100,
		examples: ["Website", "Referral", "Conference", "LinkedIn"],
	},
	{
		name: "leadScore",
		label: "Lead Score",
		type: "integer",
		required: false,
		description: "0-100 score",
	},

	// Notes (for unmapped columns)
	{
		name: "notes",
		label: "Notes",
		type: "text",
		required: false,
		description: "General notes and additional information from unmapped columns",
	},
];

// ============================================================================
// Partners Schema (Legacy - maps to partners table)
// ============================================================================

const PARTNERS_COLUMNS: ColumnSchema[] = [
	{
		name: "name",
		label: "Name",
		type: "string",
		required: true,
		maxLength: 500,
		description: "Partner organization name",
	},
	{
		name: "country",
		label: "Country",
		type: "string",
		required: false,
		maxLength: 100,
	},
	{
		name: "region",
		label: "Region",
		type: "string",
		required: false,
		maxLength: 100,
	},
	{
		name: "industry",
		label: "Industry",
		type: "string",
		required: false,
		maxLength: 100,
	},
	{
		name: "website",
		label: "Website",
		type: "url",
		required: false,
		maxLength: 500,
	},
	{
		name: "description",
		label: "Description",
		type: "text",
		required: false,
	},
	{
		name: "coreCapabilities",
		label: "Core Capabilities",
		type: "text",
		required: false,
	},
	{
		name: "contactName",
		label: "Contact Name",
		type: "string",
		required: false,
		maxLength: 200,
	},
	{
		name: "contactEmail",
		label: "Contact Email",
		type: "email",
		required: false,
		maxLength: 255,
	},
	{
		name: "contactPhone",
		label: "Contact Phone",
		type: "phone",
		required: false,
		maxLength: 50,
	},
	{
		name: "partnerTier",
		label: "Partner Tier",
		type: "integer",
		required: false,
	},
	{
		name: "status",
		label: "Status",
		type: "string",
		required: false,
		maxLength: 50,
		allowedValues: ["active", "inactive", "potential", "former"],
	},
];

// ============================================================================
// Suggested Mappings (common source column patterns)
// ============================================================================

const OPPORTUNITIES_SUGGESTED_MAPPINGS: Record<string, string[]> = {
	title: ["title", "name", "project title", "project name", "rfp title", "opportunity"],
	sourceId: ["id", "no.", "ref", "reference", "source id", "record id"],
	category: ["category", "type", "sector", "industry"],
	countryRegion: ["country", "region", "country/region", "location", "geography"],
	organization: ["organization", "client", "company", "issuer", "agency"],
	deadline: ["deadline", "due date", "closing", "submission date"],
	budgetValue: ["budget", "value", "amount", "est. budget", "budget range"],
	projectSummary: ["summary", "description", "scope summary", "overview"],
	rfpLink: ["link", "url", "document link", "rfp link"],
	sourcePlatform: ["source", "platform", "portal", "origin"],
	notes: ["notes", "comments", "remarks", "additional info", "other"],
};

const CONTACTS_SUGGESTED_MAPPINGS: Record<string, string[]> = {
	firstName: ["first name", "firstname", "given name", "first"],
	lastName: ["last name", "lastname", "surname", "family name", "last"],
	email: ["email", "e-mail", "mail address", "work email"],
	phone: ["phone", "telephone", "mobile", "cell"],
	title: ["title", "job title", "position", "role"],
	department: ["department", "dept", "division"],
	country: ["country", "nation"],
	city: ["city", "town", "location"],
	notes: ["notes", "comments", "remarks"],
};

const ACCOUNTS_SUGGESTED_MAPPINGS: Record<string, string[]> = {
	name: ["name", "company", "organization", "account name", "business name"],
	type: ["type", "account type", "relationship"],
	industry: ["industry", "sector", "vertical"],
	country: ["country", "nation", "headquarters"],
	region: ["region", "area", "territory"],
	website: ["website", "web", "url", "site"],
	email: ["email", "contact email", "company email"],
	phone: ["phone", "telephone", "contact phone"],
	description: ["description", "about", "overview"],
	leadSource: ["source", "lead source", "origin"],
	notes: ["notes", "comments", "remarks", "additional info", "other"],
};

const PARTNERS_SUGGESTED_MAPPINGS: Record<string, string[]> = {
	name: ["name", "partner name", "company", "organization"],
	country: ["country", "nation", "headquarters"],
	region: ["region", "area", "territory"],
	industry: ["industry", "sector", "vertical"],
	website: ["website", "web", "url"],
	description: ["description", "about", "overview"],
	coreCapabilities: ["capabilities", "skills", "expertise"],
	contactName: ["contact", "contact name", "primary contact"],
	contactEmail: ["email", "contact email"],
	contactPhone: ["phone", "contact phone"],
};

// ============================================================================
// Schema Registry
// ============================================================================

/**
 * Complete schema definitions for all target tables.
 */
export const TABLE_SCHEMAS: Record<ImportTargetTable, TableSchema> = {
	opportunities: {
		tableName: "opportunities",
		displayName: "Opportunities",
		columns: OPPORTUNITIES_COLUMNS,
		uniqueKeyFields: ["sourceId", "sourceFile"],
		suggestedMappings: OPPORTUNITIES_SUGGESTED_MAPPINGS,
	},
	contacts: {
		tableName: "contacts",
		displayName: "Contacts",
		columns: CONTACTS_COLUMNS,
		uniqueKeyFields: ["email"],
		suggestedMappings: CONTACTS_SUGGESTED_MAPPINGS,
	},
	accounts: {
		tableName: "accounts",
		displayName: "Accounts",
		columns: ACCOUNTS_COLUMNS,
		uniqueKeyFields: ["name", "country", "type"],
		suggestedMappings: ACCOUNTS_SUGGESTED_MAPPINGS,
	},
	partners: {
		tableName: "partners",
		displayName: "Partners",
		columns: PARTNERS_COLUMNS,
		uniqueKeyFields: ["name", "country"],
		suggestedMappings: PARTNERS_SUGGESTED_MAPPINGS,
	},
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get schema for a target table.
 */
export function getTableSchema(table: ImportTargetTable): TableSchema {
	return TABLE_SCHEMAS[table];
}

/**
 * Get required columns for a target table.
 */
export function getRequiredColumns(table: ImportTargetTable): ColumnSchema[] {
	const schema = TABLE_SCHEMAS[table];
	return schema.columns.filter((col) => col.required);
}

/**
 * Get column schema by name.
 */
export function getColumnSchema(table: ImportTargetTable, columnName: string): ColumnSchema | undefined {
	const schema = TABLE_SCHEMAS[table];
	return schema.columns.find((col) => col.name === columnName);
}

/**
 * Validate a value against column schema.
 */
export function validateColumnValue(
	value: unknown,
	column: ColumnSchema
): { valid: boolean; error?: string } {
	// Required check
	if (column.required && (value === null || value === undefined || value === "")) {
		return { valid: false, error: `${column.label} is required` };
	}

	// Skip validation for empty non-required values
	if (value === null || value === undefined || value === "") {
		return { valid: true };
	}

	const strValue = String(value);

	// Max length check
	if (column.maxLength && strValue.length > column.maxLength) {
		return { valid: false, error: `${column.label} exceeds maximum length of ${column.maxLength}` };
	}

	// Allowed values check
	if (column.allowedValues && !column.allowedValues.includes(strValue.toLowerCase())) {
		return {
			valid: false,
			error: `${column.label} must be one of: ${column.allowedValues.join(", ")}`,
		};
	}

	// Type-specific validation
	switch (column.type) {
		case "email":
			if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue)) {
				return { valid: false, error: `${column.label} is not a valid email address` };
			}
			break;
		case "url":
			try {
				new URL(strValue.startsWith("http") ? strValue : `https://${strValue}`);
			} catch {
				return { valid: false, error: `${column.label} is not a valid URL` };
			}
			break;
		case "integer":
			if (!/^-?\d+$/.test(strValue)) {
				return { valid: false, error: `${column.label} must be a whole number` };
			}
			break;
		case "number":
			if (isNaN(Number(strValue.replace(/,/g, "")))) {
				return { valid: false, error: `${column.label} must be a number` };
			}
			break;
	}

	return { valid: true };
}
