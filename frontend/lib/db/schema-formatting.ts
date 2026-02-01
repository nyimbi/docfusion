/**
 * Government-Specific Formatting Engine Database Schema - DocFusion
 *
 * Implements comprehensive formatting specifications for government proposal documents,
 * supporting agency-specific requirements, accessibility compliance, and document validation.
 *
 * Key Features:
 * - Agency-specific format templates (DoD, GSA, NASA, etc.)
 * - Page limit tracking with volume-specific exclusions
 * - WCAG/Section 508 accessibility compliance validation
 * - Table of contents generation and management
 * - User-defined format presets with sharing capabilities
 *
 * Tables:
 * - formatTemplates: Core format specifications with agency-specific settings
 * - documentFormats: Applied formats linking documents to templates with overrides
 * - formatValidations: Validation results tracking compliance status
 * - tocEntries: Hierarchical table of contents entries
 * - formatPresets: User-saved custom format configurations
 */

import { relations } from "drizzle-orm";
import {
	boolean,
	integer,
	jsonb,
	pgTable,
	real,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

// ============================================================================
// FORMATTING TYPE ENUMERATIONS
// ============================================================================

/**
 * Standard page sizes supported for government documents.
 * Letter (8.5"x11") is standard for most US government agencies.
 * Legal (8.5"x14") may be required for certain technical drawings.
 * A4 (210mm x 297mm) for international or NATO-aligned submissions.
 */
export type PageSize = "letter" | "legal" | "A4";

/**
 * Page orientation settings.
 * Portrait is standard for narrative content.
 * Landscape may be required for wide tables, charts, or fold-out pages.
 */
export type PageOrientation = "portrait" | "landscape";

/**
 * Accessibility compliance levels following WCAG 2.1 and Section 508 standards.
 * - WCAG_AA: Web Content Accessibility Guidelines 2.1 Level AA (most common requirement)
 * - WCAG_AAA: WCAG 2.1 Level AAA (highest accessibility standard)
 * - Section_508: US Federal Section 508 compliance (required for federal submissions)
 */
export type AccessibilityLevel = "WCAG_AA" | "WCAG_AAA" | "Section_508";

/**
 * Types of table of contents entries.
 * Supports hierarchical document structure and supplementary listings.
 */
export type TocEntryType =
	| "chapter"
	| "section"
	| "subsection"
	| "figure"
	| "table"
	| "acronym"
	| "appendix"
	| "attachment"
	| "exhibit";

/**
 * Validation issue severity levels.
 * - critical: Must be fixed before submission (e.g., exceeds page limit)
 * - major: Strongly recommended to fix (e.g., missing required section)
 * - minor: Should be fixed if possible (e.g., inconsistent formatting)
 * - info: Informational only (e.g., optimization suggestions)
 */
export type ValidationSeverity = "critical" | "major" | "minor" | "info";

/**
 * Types of validation issues that can be detected.
 */
export type ValidationIssueType =
	| "page_limit_exceeded"
	| "font_non_compliant"
	| "margin_violation"
	| "spacing_violation"
	| "missing_header"
	| "missing_footer"
	| "missing_page_number"
	| "accessibility_violation"
	| "missing_toc_entry"
	| "broken_cross_reference"
	| "image_resolution_low"
	| "image_missing_alt_text"
	| "table_accessibility"
	| "color_contrast"
	| "heading_hierarchy"
	| "orphan_widow"
	| "custom";

// ============================================================================
// JSONB TYPE INTERFACES
// ============================================================================

/**
 * Page margin specifications in inches.
 * Government solicitations often specify exact margin requirements.
 */
export interface PageMargins {
	/** Top margin in inches (e.g., 1.0) */
	top: number;
	/** Bottom margin in inches (e.g., 1.0) */
	bottom: number;
	/** Left margin in inches (e.g., 1.0) */
	left: number;
	/** Right margin in inches (e.g., 1.0) */
	right: number;
	/** Optional gutter margin for bound documents */
	gutter?: number;
}

/**
 * Page limit specification per volume or section.
 * Supports complex page counting rules common in government RFPs.
 */
export interface PageLimitSpec {
	/** Volume or section identifier (e.g., "Technical Volume", "Management Approach") */
	volume?: string;
	/** Maximum page count allowed */
	limit: number;
	/** Content types excluded from page count (e.g., ["cover", "toc", "dividers", "resumes"]) */
	excludes?: string[];
	/** Whether fold-out pages count as multiple pages */
	foldoutMultiplier?: number;
	/** Notes about counting methodology */
	notes?: string;
}

/**
 * Header format specification.
 * Defines content and layout for document headers.
 */
export interface HeaderFormat {
	/** Whether headers are enabled */
	enabled: boolean;
	/** Header height in inches */
	height?: number;
	/** Left-aligned content (e.g., company logo, proposal title) */
	leftContent?: string;
	/** Center content */
	centerContent?: string;
	/** Right-aligned content (e.g., volume title, date) */
	rightContent?: string;
	/** Font family for header text */
	font?: string;
	/** Font size in points */
	fontSize?: number;
	/** Whether to include a separator line below header */
	includeLine?: boolean;
	/** Different header for first page */
	differentFirstPage?: boolean;
	/** First page header content if different */
	firstPageContent?: {
		leftContent?: string;
		centerContent?: string;
		rightContent?: string;
	};
	/** Different headers for odd/even pages */
	differentOddEven?: boolean;
}

/**
 * Footer format specification.
 * Defines content and layout for document footers.
 */
export interface FooterFormat {
	/** Whether footers are enabled */
	enabled: boolean;
	/** Footer height in inches */
	height?: number;
	/** Left-aligned content */
	leftContent?: string;
	/** Center content (often page numbers) */
	centerContent?: string;
	/** Right-aligned content (e.g., proprietary notice) */
	rightContent?: string;
	/** Font family for footer text */
	font?: string;
	/** Font size in points */
	fontSize?: number;
	/** Whether to include a separator line above footer */
	includeLine?: boolean;
	/** Different footer for first page */
	differentFirstPage?: boolean;
	/** First page footer content if different */
	firstPageContent?: {
		leftContent?: string;
		centerContent?: string;
		rightContent?: string;
	};
	/** Proprietary/ITAR notice text */
	proprietaryNotice?: string;
}

/**
 * Page numbering format specification.
 */
export interface PageNumberFormat {
	/** Numbering style for body pages */
	style: "arabic" | "roman_lower" | "roman_upper" | "alpha_lower" | "alpha_upper";
	/** Starting page number */
	startAt?: number;
	/** Prefix before number (e.g., "Page ") */
	prefix?: string;
	/** Suffix after number (e.g., " of {total}") */
	suffix?: string;
	/** Position on page */
	position: "header" | "footer";
	/** Alignment within position */
	alignment: "left" | "center" | "right";
	/** Include total page count (e.g., "Page 1 of 50") */
	includeTotal?: boolean;
	/** Different numbering for front matter */
	frontMatterStyle?: "roman_lower" | "roman_upper" | "none";
	/** Restart numbering after front matter */
	restartAfterFrontMatter?: boolean;
}

/**
 * Section numbering format specification.
 */
export interface SectionNumberFormat {
	/** Numbering style for sections */
	style: "decimal" | "alpha_upper" | "alpha_lower" | "roman_upper" | "roman_lower";
	/** Separator between levels (e.g., ".", "-") */
	separator: string;
	/** Maximum depth of numbering (e.g., 3 for "1.2.3") */
	maxDepth?: number;
	/** Include trailing separator (e.g., "1.2.3." vs "1.2.3") */
	trailingSeparator?: boolean;
	/** Bold section numbers */
	bold?: boolean;
	/** Custom format per level */
	levelFormats?: {
		level: number;
		style: "decimal" | "alpha_upper" | "alpha_lower" | "roman_upper" | "roman_lower";
		prefix?: string;
		suffix?: string;
	}[];
}

/**
 * Validation issue details.
 */
export interface ValidationIssue {
	/** Type of validation issue */
	type: ValidationIssueType;
	/** Severity level */
	severity: ValidationSeverity;
	/** Human-readable message describing the issue */
	message: string;
	/** Location in document (page number, section, element ID) */
	location?: string;
	/** Suggested fix or action */
	suggestion?: string;
	/** Relevant specification or requirement reference */
	requirementRef?: string;
	/** Auto-fixable flag */
	autoFixable?: boolean;
}

/**
 * Accessibility issue details from validation.
 */
export interface AccessibilityIssue {
	/** WCAG or Section 508 criterion violated */
	criterion: string;
	/** Description of the issue */
	description: string;
	/** Element or location affected */
	element?: string;
	/** Impact level (critical, serious, moderate, minor) */
	impact: string;
	/** Suggested remediation */
	remediation?: string;
}

/**
 * Custom format settings for overrides and presets.
 */
export interface CustomFormatSettings {
	/** Page size override */
	pageSize?: PageSize;
	/** Orientation override */
	orientation?: PageOrientation;
	/** Margin overrides */
	margins?: Partial<PageMargins>;
	/** Body font override */
	bodyFont?: string;
	/** Body font size override */
	bodyFontSize?: number;
	/** Heading font override */
	headingFont?: string;
	/** Line spacing override */
	lineSpacing?: number;
	/** Header format override */
	headerFormat?: Partial<HeaderFormat>;
	/** Footer format override */
	footerFormat?: Partial<FooterFormat>;
	/** Page number format override */
	pageNumberFormat?: Partial<PageNumberFormat>;
	/** Section number format override */
	sectionNumberFormat?: Partial<SectionNumberFormat>;
	/** Page limits override */
	pageLimits?: PageLimitSpec[];
	/** Front matter order override */
	frontMatterOrder?: string[];
	/** Custom CSS or styling rules */
	customStyles?: Record<string, string>;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

// ============================================================================
// FORMAT TEMPLATES TABLE
// ============================================================================

/**
 * Core format specifications for government documents.
 * Each template defines complete formatting rules for a specific agency or solicitation type.
 * Templates can serve as defaults for agencies or be customized per opportunity.
 */
export const formatTemplates = pgTable("format_templates", {
	id: uuid("id").primaryKey().defaultRandom(),

	// Template identification
	/** Human-readable template name (e.g., "DoD Standard Format", "NASA SEWP Template") */
	name: varchar("name", { length: 200 }).notNull(),
	/** Optional description of template purpose and usage */
	description: text("description"),

	// Agency association
	/** Agency code (e.g., "DOD", "GSA", "NASA", "HHS") */
	agencyCode: varchar("agency_code", { length: 50 }),
	/** Full agency name */
	agencyName: varchar("agency_name", { length: 200 }),
	/** Sub-agency or bureau if applicable */
	subAgency: varchar("sub_agency", { length: 200 }),
	/** Contract vehicle or program (e.g., "SEWP V", "OASIS+", "8(a) STARS III") */
	contractVehicle: varchar("contract_vehicle", { length: 200 }),

	// Page layout
	/** Paper size (letter, legal, A4) */
	pageSize: varchar("page_size", { length: 20 }).default("letter").$type<PageSize>(),
	/** Page orientation (portrait, landscape) */
	orientation: varchar("orientation", { length: 20 }).default("portrait").$type<PageOrientation>(),
	/** Page margins specification */
	margins: jsonb("margins").$type<PageMargins>().default({
		top: 1.0,
		bottom: 1.0,
		left: 1.0,
		right: 1.0,
	}),

	// Typography
	/** Body text font family (e.g., "Times New Roman", "Arial", "Calibri") */
	bodyFont: varchar("body_font", { length: 100 }).default("Times New Roman"),
	/** Body text font size in points (commonly 11 or 12) */
	bodyFontSize: real("body_font_size").default(12),
	/** Heading font family (may differ from body) */
	headingFont: varchar("heading_font", { length: 100 }).default("Arial"),
	/** Line spacing multiplier (e.g., 1.0 for single, 1.5, 2.0 for double) */
	lineSpacing: real("line_spacing").default(1.0),
	/** Minimum allowed font size in points */
	minimumFontSize: real("minimum_font_size").default(10),
	/** Whether to allow font embedding in PDF output */
	allowFontEmbedding: boolean("allow_font_embedding").default(true),

	// Page limits
	/** Volume-specific page limits with exclusions */
	pageLimits: jsonb("page_limits").$type<PageLimitSpec[]>(),

	// Headers and footers
	/** Header format specification */
	headerFormat: jsonb("header_format").$type<HeaderFormat>().default({
		enabled: true,
		height: 0.5,
		rightContent: "{solicitation_number}",
	}),
	/** Footer format specification */
	footerFormat: jsonb("footer_format").$type<FooterFormat>().default({
		enabled: true,
		height: 0.5,
		centerContent: "Page {page_number}",
		rightContent: "Use or disclosure of data contained on this sheet is subject to the restriction on the title page.",
	}),

	// Numbering
	/** Page numbering format */
	pageNumberFormat: jsonb("page_number_format").$type<PageNumberFormat>().default({
		style: "arabic",
		position: "footer",
		alignment: "center",
		includeTotal: false,
		frontMatterStyle: "roman_lower",
		restartAfterFrontMatter: true,
	}),
	/** Section numbering format */
	sectionNumberFormat: jsonb("section_number_format").$type<SectionNumberFormat>().default({
		style: "decimal",
		separator: ".",
		maxDepth: 4,
		trailingSeparator: false,
	}),

	// Document structure
	/** Order of front matter sections */
	frontMatterOrder: jsonb("front_matter_order").$type<string[]>().default([
		"cover_page",
		"table_of_contents",
		"list_of_figures",
		"list_of_tables",
		"list_of_acronyms",
		"executive_summary",
	]),
	/** Required sections that must be present */
	requiredSections: jsonb("required_sections").$type<string[]>(),
	/** Appendix naming convention (e.g., "Appendix A", "Attachment 1") */
	appendixNaming: varchar("appendix_naming", { length: 50 }).default("Appendix {alpha_upper}"),

	// Accessibility compliance
	/** Whether accessibility compliance is required */
	requiresAccessibility: boolean("requires_accessibility").default(true),
	/** Required accessibility compliance level */
	accessibilityLevel: varchar("accessibility_level", { length: 50 })
		.default("Section_508")
		.$type<AccessibilityLevel>(),
	/** Specific accessibility requirements */
	accessibilityRequirements: jsonb("accessibility_requirements").$type<string[]>(),

	// Image and figure requirements
	/** Minimum image resolution in DPI */
	minimumImageResolution: integer("minimum_image_resolution").default(300),
	/** Whether images require alt text */
	requireImageAltText: boolean("require_image_alt_text").default(true),
	/** Maximum image file size in KB */
	maxImageSizeKb: integer("max_image_size_kb"),
	/** Allowed image formats */
	allowedImageFormats: jsonb("allowed_image_formats").$type<string[]>().default([
		"png",
		"jpg",
		"jpeg",
		"gif",
		"svg",
	]),

	// Table formatting
	/** Default table border style */
	tableBorderStyle: varchar("table_border_style", { length: 50 }).default("solid"),
	/** Whether tables require header rows */
	requireTableHeaders: boolean("require_table_headers").default(true),
	/** Maximum table width as percentage of page */
	maxTableWidthPercent: real("max_table_width_percent").default(100),

	// Output formats
	/** Preferred output format (PDF, DOCX, etc.) */
	preferredOutputFormat: varchar("preferred_output_format", { length: 20 }).default("pdf"),
	/** PDF/A compliance level for archival (e.g., "1b", "2b", "3b") */
	pdfACompliance: varchar("pdfa_compliance", { length: 10 }),
	/** Whether to embed fonts in PDF */
	embedFontsInPdf: boolean("embed_fonts_in_pdf").default(true),

	// Status flags
	/** Whether this is the default template for the agency */
	isDefault: boolean("is_default").default(false),
	/** Whether the template is active and available for use */
	isActive: boolean("is_active").default(true),
	/** Whether this is a system template (non-editable by users) */
	isSystem: boolean("is_system").default(false),

	// Version tracking
	/** Template version number */
	version: varchar("version", { length: 20 }).default("1.0"),
	/** ID of template this was derived from */
	derivedFromId: uuid("derived_from_id"),

	// Organization ownership
	/** Organization that owns this template (null for system templates) */
	organizationId: uuid("organization_id"),

	// Audit fields
	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// DOCUMENT FORMATS TABLE
// ============================================================================

/**
 * Applied formats linking documents to format templates.
 * Supports template inheritance with per-document overrides.
 * Tracks who applied the format and when.
 */
export const documentFormats = pgTable("document_formats", {
	id: uuid("id").primaryKey().defaultRandom(),

	// Document association
	/** ID of the document this format is applied to */
	documentId: uuid("document_id").notNull(),
	/** ID of the base format template */
	templateId: uuid("template_id").references(() => formatTemplates.id, { onDelete: "set null" }),

	// Override settings
	/** Custom settings that override the template defaults */
	overrides: jsonb("overrides").$type<CustomFormatSettings>(),
	/** Whether overrides have been applied (vs. using template defaults) */
	hasOverrides: boolean("has_overrides").default(false),

	// Application tracking
	/** When the format was applied to the document */
	appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow(),
	/** User who applied the format */
	appliedBy: varchar("applied_by", { length: 200 }),

	// Validation status (cached from most recent validation)
	/** Whether the document currently passes format validation */
	isValid: boolean("is_valid"),
	/** ID of the most recent validation */
	lastValidationId: uuid("last_validation_id"),
	/** Timestamp of last validation */
	lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),

	// Locked flag to prevent changes during review
	/** Whether format changes are locked (e.g., during formal review) */
	isLocked: boolean("is_locked").default(false),
	/** Reason for lock */
	lockReason: varchar("lock_reason", { length: 500 }),
	/** When the format was locked */
	lockedAt: timestamp("locked_at", { withTimezone: true }),
	/** Who locked the format */
	lockedBy: varchar("locked_by", { length: 200 }),

	// Audit fields
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// FORMAT VALIDATIONS TABLE
// ============================================================================

/**
 * Validation results tracking compliance status against format specifications.
 * Stores comprehensive validation outcomes including page counts, accessibility scores,
 * and detailed issue listings for remediation.
 */
export const formatValidations = pgTable("format_validations", {
	id: uuid("id").primaryKey().defaultRandom(),

	// Document and template association
	/** ID of the document being validated */
	documentId: uuid("document_id").notNull(),
	/** ID of the format template used for validation */
	templateId: uuid("template_id").references(() => formatTemplates.id, { onDelete: "set null" }),

	// Validation context
	/** When the validation was performed */
	validatedAt: timestamp("validated_at", { withTimezone: true }).defaultNow(),
	/** User who triggered the validation */
	validatedBy: varchar("validated_by", { length: 200 }),
	/** Type of validation (full, quick, accessibility_only, page_count_only) */
	validationType: varchar("validation_type", { length: 50 }).default("full"),
	/** Document version or snapshot ID at time of validation */
	documentVersionId: uuid("document_version_id"),

	// Overall results
	/** Whether the document passes all validation checks */
	isValid: boolean("is_valid").notNull(),
	/** Overall compliance score (0-100) */
	overallScore: real("overall_score"),
	/** Summary message */
	summary: text("summary"),

	// Detailed issues
	/** Array of validation issues found */
	issues: jsonb("issues").$type<ValidationIssue[]>().default([]),
	/** Count of critical issues */
	criticalIssueCount: integer("critical_issue_count").default(0),
	/** Count of major issues */
	majorIssueCount: integer("major_issue_count").default(0),
	/** Count of minor issues */
	minorIssueCount: integer("minor_issue_count").default(0),
	/** Count of informational issues */
	infoIssueCount: integer("info_issue_count").default(0),

	// Page count validation
	/** Total page count of the document */
	pageCount: integer("page_count"),
	/** Page limit from template/requirements */
	pageLimit: integer("page_limit"),
	/** Whether page count is within limit */
	pageCountValid: boolean("page_count_valid"),
	/** Page counts by volume/section */
	pageCountsByVolume: jsonb("page_counts_by_volume").$type<Record<string, number>>(),
	/** Pages excluded from count (TOC, cover, etc.) */
	excludedPageCount: integer("excluded_page_count"),

	// Accessibility validation
	/** Accessibility compliance score (0-100) */
	accessibilityScore: real("accessibility_score"),
	/** Whether document meets accessibility requirements */
	accessibilityPassed: boolean("accessibility_passed"),
	/** Detailed accessibility issues */
	accessibilityIssues: jsonb("accessibility_issues").$type<AccessibilityIssue[]>().default([]),
	/** Count of accessibility violations */
	accessibilityViolationCount: integer("accessibility_violation_count").default(0),

	// Typography compliance
	/** Whether fonts meet requirements */
	fontCompliance: boolean("font_compliance"),
	/** Fonts found in document */
	fontsUsed: jsonb("fonts_used").$type<string[]>(),
	/** Non-compliant fonts */
	nonCompliantFonts: jsonb("non_compliant_fonts").$type<string[]>(),

	// Margin compliance
	/** Whether margins meet requirements */
	marginCompliance: boolean("margin_compliance"),
	/** Pages with margin violations */
	marginViolationPages: jsonb("margin_violation_pages").$type<number[]>(),

	// Spacing compliance
	/** Whether line spacing meets requirements */
	spacingCompliance: boolean("spacing_compliance"),
	/** Sections with spacing issues */
	spacingViolationSections: jsonb("spacing_violation_sections").$type<string[]>(),

	// Header/Footer compliance
	/** Whether headers meet requirements */
	headerCompliance: boolean("header_compliance"),
	/** Whether footers meet requirements */
	footerCompliance: boolean("footer_compliance"),
	/** Pages with header/footer issues */
	headerFooterIssuePages: jsonb("header_footer_issue_pages").$type<number[]>(),

	// Image validation
	/** Count of images in document */
	imageCount: integer("image_count"),
	/** Images missing alt text */
	imagesMissingAltText: integer("images_missing_alt_text").default(0),
	/** Images below minimum resolution */
	imagesLowResolution: integer("images_low_resolution").default(0),

	// Table validation
	/** Count of tables in document */
	tableCount: integer("table_count"),
	/** Tables missing headers */
	tablesMissingHeaders: integer("tables_missing_headers").default(0),

	// Cross-reference validation
	/** Count of cross-references */
	crossReferenceCount: integer("cross_reference_count"),
	/** Broken cross-references */
	brokenCrossReferences: integer("broken_cross_references").default(0),

	// Processing metrics
	/** Time taken to perform validation (milliseconds) */
	validationDurationMs: integer("validation_duration_ms"),
	/** Validator engine version used */
	validatorVersion: varchar("validator_version", { length: 50 }),

	// Audit fields
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// TOC ENTRIES TABLE
// ============================================================================

/**
 * Table of contents entries for documents.
 * Supports hierarchical structure with parent-child relationships.
 * Includes entries for figures, tables, and acronyms in addition to sections.
 */
export const tocEntries = pgTable("toc_entries", {
	id: uuid("id").primaryKey().defaultRandom(),

	// Document association
	/** ID of the document this TOC entry belongs to */
	documentId: uuid("document_id").notNull(),
	/** ID of the validation that generated/updated this entry (optional) */
	formatValidationId: uuid("format_validation_id").references(() => formatValidations.id, {
		onDelete: "set null",
	}),

	// Entry classification
	/** Type of TOC entry */
	entryType: varchar("entry_type", { length: 50 }).notNull().$type<TocEntryType>(),
	/** Entry title/text as it appears in the document */
	title: varchar("title", { length: 500 }).notNull(),
	/** Optional short title for narrow TOC layouts */
	shortTitle: varchar("short_title", { length: 200 }),

	// Location
	/** Page number where this entry appears */
	pageNumber: integer("page_number"),
	/** Optional secondary page number for ranges (e.g., "3-5") */
	endPageNumber: integer("end_page_number"),
	/** Section number/reference (e.g., "1.2.3", "A.1") */
	sectionNumber: varchar("section_number", { length: 50 }),

	// Hierarchy
	/** Nesting level (1 = top level, 2 = first sub, etc., max 6) */
	level: integer("level").notNull().default(1),
	/** Sort order within the TOC */
	sortOrder: integer("sort_order").notNull().default(0),
	/** Parent entry ID for hierarchical structure */
	parentEntryId: uuid("parent_entry_id"),

	// Entry metadata
	/** Whether this entry should appear in the main TOC */
	includeInMainToc: boolean("include_in_main_toc").default(true),
	/** Whether this is a generated entry (vs. manually added) */
	isGenerated: boolean("is_generated").default(true),
	/** Anchor/bookmark ID in the document for navigation */
	anchorId: varchar("anchor_id", { length: 200 }),
	/** Document element ID this entry references */
	elementId: uuid("element_id"),

	// For figure/table entries
	/** Caption text for figures/tables */
	caption: text("caption"),
	/** Figure or table number (e.g., "Figure 3.1", "Table A-2") */
	figureTableNumber: varchar("figure_table_number", { length: 50 }),

	// Status
	/** Whether the entry is active (false if section was deleted) */
	isActive: boolean("is_active").default(true),

	// Audit fields
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// FORMAT PRESETS TABLE
// ============================================================================

/**
 * User-saved format presets for quick application.
 * Can be based on an existing template with custom modifications,
 * or standalone custom configurations.
 * Supports sharing presets within an organization.
 */
export const formatPresets = pgTable("format_presets", {
	id: uuid("id").primaryKey().defaultRandom(),

	// Ownership
	/** User who created the preset */
	userId: varchar("user_id", { length: 200 }).notNull(),
	/** Optional organization ID for shared presets */
	organizationId: uuid("organization_id"),

	// Identification
	/** Preset name */
	name: varchar("name", { length: 200 }).notNull(),
	/** Description of what this preset is for */
	description: text("description"),
	/** Tags for categorization and search */
	tags: jsonb("tags").$type<string[]>(),

	// Base template (optional)
	/** Base template this preset is derived from (optional) */
	baseTemplateId: uuid("base_template_id").references(() => formatTemplates.id, {
		onDelete: "set null",
	}),

	// Custom settings
	/** Custom format settings (overrides base template if specified) */
	customSettings: jsonb("custom_settings").$type<CustomFormatSettings>().notNull(),

	// Target agency/use case
	/** Intended agency for this preset */
	targetAgency: varchar("target_agency", { length: 200 }),
	/** Contract type this preset is designed for */
	contractType: varchar("contract_type", { length: 100 }),

	// Sharing
	/** Whether this preset is shared with the organization */
	isShared: boolean("is_shared").default(false),
	/** When the preset was shared */
	sharedAt: timestamp("shared_at", { withTimezone: true }),
	/** Who shared the preset */
	sharedBy: varchar("shared_by", { length: 200 }),
	/** Whether this is a public template (visible to all orgs) */
	isPublic: boolean("is_public").default(false),

	// Usage tracking
	/** Number of times this preset has been used */
	useCount: integer("use_count").default(0),
	/** Last time this preset was applied to a document */
	lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

	// Status
	/** Whether the preset is active */
	isActive: boolean("is_active").default(true),
	/** Whether this is marked as a favorite by the user */
	isFavorite: boolean("is_favorite").default(false),

	// Audit fields
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

/**
 * Relations for formatTemplates table.
 */
export const formatTemplatesRelations = relations(formatTemplates, ({ many, one }) => ({
	/** Documents using this template */
	documentFormats: many(documentFormats),
	/** Validations performed using this template */
	validations: many(formatValidations),
	/** Presets based on this template */
	presets: many(formatPresets),
	/** Template this was derived from */
	derivedFrom: one(formatTemplates, {
		fields: [formatTemplates.derivedFromId],
		references: [formatTemplates.id],
		relationName: "derived_templates",
	}),
	/** Templates derived from this one */
	derivatives: many(formatTemplates, {
		relationName: "derived_templates",
	}),
}));

/**
 * Relations for documentFormats table.
 */
export const documentFormatsRelations = relations(documentFormats, ({ one, many }) => ({
	/** Format template applied */
	template: one(formatTemplates, {
		fields: [documentFormats.templateId],
		references: [formatTemplates.id],
	}),
	/** Most recent validation result */
	lastValidation: one(formatValidations, {
		fields: [documentFormats.lastValidationId],
		references: [formatValidations.id],
	}),
}));

/**
 * Relations for formatValidations table.
 */
export const formatValidationsRelations = relations(formatValidations, ({ one, many }) => ({
	/** Format template used for validation */
	template: one(formatTemplates, {
		fields: [formatValidations.templateId],
		references: [formatTemplates.id],
	}),
	/** TOC entries generated by this validation */
	tocEntries: many(tocEntries),
}));

/**
 * Relations for tocEntries table.
 */
export const tocEntriesRelations = relations(tocEntries, ({ one, many }) => ({
	/** Parent TOC entry for hierarchy */
	parentEntry: one(tocEntries, {
		fields: [tocEntries.parentEntryId],
		references: [tocEntries.id],
		relationName: "toc_hierarchy",
	}),
	/** Child entries under this entry */
	childEntries: many(tocEntries, {
		relationName: "toc_hierarchy",
	}),
	/** Validation that generated/updated this entry */
	validation: one(formatValidations, {
		fields: [tocEntries.formatValidationId],
		references: [formatValidations.id],
	}),
}));

/**
 * Relations for formatPresets table.
 */
export const formatPresetsRelations = relations(formatPresets, ({ one }) => ({
	/** Base template this preset is derived from */
	baseTemplate: one(formatTemplates, {
		fields: [formatPresets.baseTemplateId],
		references: [formatTemplates.id],
	}),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/** Format template select type */
export type FormatTemplate = typeof formatTemplates.$inferSelect;
/** Format template insert type */
export type NewFormatTemplate = typeof formatTemplates.$inferInsert;

/** Document format select type */
export type DocumentFormat = typeof documentFormats.$inferSelect;
/** Document format insert type */
export type NewDocumentFormat = typeof documentFormats.$inferInsert;

/** Format validation select type */
export type FormatValidation = typeof formatValidations.$inferSelect;
/** Format validation insert type */
export type NewFormatValidation = typeof formatValidations.$inferInsert;

/** TOC entry select type */
export type TocEntry = typeof tocEntries.$inferSelect;
/** TOC entry insert type */
export type NewTocEntry = typeof tocEntries.$inferInsert;

/** Format preset select type */
export type FormatPreset = typeof formatPresets.$inferSelect;
/** Format preset insert type */
export type NewFormatPreset = typeof formatPresets.$inferInsert;

