/**
 * Government-Specific Formatting Engine Types
 *
 * Type definitions for document formatting, validation, accessibility checking,
 * and compliance with government RFP requirements (FAR, DFARS, agency-specific).
 */

// =============================================================================
// Core Identifiers
// =============================================================================

export type FormatTemplateId = string;
export type FormatIssueId = string;
export type TOCEntryId = string;
export type ValidationResultId = string;

// =============================================================================
// Format Templates
// =============================================================================

/**
 * Page size specifications following government standards.
 * US Letter (8.5x11) is standard for most federal RFPs.
 */
export type PageSize = "letter" | "legal" | "a4" | "custom";

/**
 * Font family options typically allowed in government documents.
 */
export type FontFamily =
	| "times-new-roman"
	| "arial"
	| "calibri"
	| "courier-new"
	| "georgia"
	| "helvetica";

/**
 * Line spacing options (government RFPs often require specific spacing).
 */
export type LineSpacing = "single" | "1.15" | "1.5" | "double";

/**
 * Government agency identifiers for agency-specific formatting rules.
 */
export type GovernmentAgency =
	| "dod"
	| "dhs"
	| "hhs"
	| "nasa"
	| "gsa"
	| "usda"
	| "doe"
	| "va"
	| "state"
	| "treasury"
	| "commerce"
	| "interior"
	| "justice"
	| "labor"
	| "transportation"
	| "epa"
	| "other";

/**
 * Margin specifications in inches (government standard unit).
 */
export interface MarginSettings {
	top: number;
	bottom: number;
	left: number;
	right: number;
	/** Gutter margin for binding */
	gutter?: number;
	/** Mirror margins for facing pages */
	mirrorMargins?: boolean;
}

/**
 * Font configuration for document formatting.
 */
export interface FontSettings {
	family: FontFamily;
	/** Font size in points */
	size: number;
	/** Heading font (can differ from body) */
	headingFamily?: FontFamily;
	headingSize?: number;
	/** Caption font settings */
	captionFamily?: FontFamily;
	captionSize?: number;
}

/**
 * Format template defining agency-specific formatting requirements.
 * Templates encode the formatting rules for specific agencies or RFP types.
 */
export interface FormatTemplate {
	id: FormatTemplateId;
	name: string;
	description: string;
	/** Target government agency */
	agency: GovernmentAgency;
	/** Agency-specific sub-type (e.g., "Army", "Navy" for DOD) */
	agencySubtype?: string;
	/** FAR/DFARS reference if applicable */
	regulationReference?: string;

	// Page setup
	pageSize: PageSize;
	/** Custom page dimensions if pageSize is "custom" (in inches) */
	customPageWidth?: number;
	customPageHeight?: number;
	margins: MarginSettings;

	// Typography
	font: FontSettings;
	lineSpacing: LineSpacing;

	// Page limits
	/** Maximum total pages allowed */
	maxPages?: number;
	/** Per-volume page limits */
	volumeLimits?: VolumePageLimit[];

	// Headers and footers
	defaultHeaderFooter?: HeaderFooterSettings;

	// Compliance requirements
	requiresPageNumbers: boolean;
	requiresTOC: boolean;
	requiresListOfFigures: boolean;
	requiresListOfTables: boolean;
	requiresAcronymList: boolean;
	requiresCrossReferences: boolean;

	// Accessibility
	section508Required: boolean;
	targetWCAGLevel?: WCAGLevel;

	// Metadata
	isDefault?: boolean;
	isBuiltIn?: boolean;
	createdAt: string;
	updatedAt: string;
}

/**
 * Volume-specific page limit for multi-volume proposals.
 */
export interface VolumePageLimit {
	volumeName: string;
	volumeNumber: number;
	maxPages: number;
	/** Pages that don't count toward limit */
	excludedSections?: string[];
}

// =============================================================================
// Header/Footer Settings
// =============================================================================

/**
 * Page number format options.
 */
export type PageNumberFormat =
	| "arabic"           // 1, 2, 3
	| "roman-lower"      // i, ii, iii
	| "roman-upper"      // I, II, III
	| "alpha-lower"      // a, b, c
	| "alpha-upper"      // A, B, C
	| "none";

/**
 * Position within header/footer.
 */
export type HeaderFooterPosition = "left" | "center" | "right";

/**
 * Content element for header/footer.
 */
export interface HeaderFooterElement {
	position: HeaderFooterPosition;
	/** Content - can include tokens like {page}, {date}, {title} */
	content: string;
	/** Font settings override for this element */
	fontOverride?: Partial<FontSettings>;
	bold?: boolean;
	italic?: boolean;
}

/**
 * Complete header/footer configuration.
 */
export interface HeaderFooterSettings {
	header: HeaderFooterElement[];
	footer: HeaderFooterElement[];
	pageNumberFormat: PageNumberFormat;
	/** Start page numbering at this value */
	startPageNumber?: number;
	/** Different first page header/footer */
	differentFirstPage: boolean;
	firstPageHeader?: HeaderFooterElement[];
	firstPageFooter?: HeaderFooterElement[];
	/** Show classification markings */
	showClassification?: boolean;
	classificationLevel?: string;
}

// =============================================================================
// Format Validation
// =============================================================================

/**
 * Issue severity levels for format validation.
 * Named FormatIssueSeverity to avoid conflict with opportunity types.
 */
export type FormatIssueSeverity = "critical" | "major" | "minor";

/**
 * Categories of format issues.
 */
export type IssueCategory =
	| "page-limit"
	| "margins"
	| "font"
	| "spacing"
	| "headers"
	| "page-numbers"
	| "accessibility"
	| "structure"
	| "figures"
	| "tables"
	| "cross-references"
	| "consistency"
	| "compliance";

/**
 * A single format validation issue.
 */
export interface FormatIssue {
	id: FormatIssueId;
	severity: FormatIssueSeverity;
	category: IssueCategory;
	title: string;
	description: string;
	/** Location in document (page number, section, element ID) */
	location?: IssueLocation;
	/** Suggested fix */
	suggestion?: string;
	/** Auto-fix available */
	autoFixable?: boolean;
	/** Reference to the rule that was violated */
	ruleReference?: string;
	/** Regulatory reference (FAR, DFARS clause) */
	regulatoryReference?: string;
}

/**
 * Location of an issue within the document.
 */
export interface IssueLocation {
	/** Page number (1-indexed) */
	page?: number;
	/** Section heading or ID */
	section?: string;
	/** Paragraph or element index */
	elementIndex?: number;
	/** Start character offset */
	startOffset?: number;
	/** End character offset */
	endOffset?: number;
	/** Visual coordinates for highlighting */
	boundingBox?: {
		top: number;
		left: number;
		width: number;
		height: number;
	};
}

/**
 * Complete format validation result.
 */
export interface FormatValidationResult {
	id: ValidationResultId;
	documentId: string;
	templateId: FormatTemplateId;
	/** Overall compliance score (0-100) */
	score: number;
	/** Score breakdown by category */
	categoryScores: Record<IssueCategory, number>;
	/** All detected issues */
	issues: FormatIssue[];
	/** Issues by severity */
	issueCounts: {
		critical: number;
		major: number;
		minor: number;
	};
	/** Validation timestamp */
	validatedAt: string;
	/** Document snapshot version validated */
	documentVersion?: number;
}

// =============================================================================
// Page Tracking
// =============================================================================

/**
 * Page count information for limit tracking.
 */
export interface PageCountInfo {
	documentId: string;
	/** Total rendered pages */
	totalPages: number;
	/** Maximum allowed pages */
	maxPages?: number;
	/** Percentage of limit used */
	percentUsed: number;
	/** Status indicator */
	status: "ok" | "warning" | "exceeded";
	/** Per-volume breakdown */
	volumeBreakdown?: VolumePageCount[];
	/** Excluded pages (cover, TOC, etc.) */
	excludedPages: number;
	/** Net countable pages */
	countablePages: number;
	/** Last updated */
	updatedAt: string;
}

/**
 * Page count for a specific volume.
 */
export interface VolumePageCount {
	volumeName: string;
	volumeNumber: number;
	currentPages: number;
	maxPages: number;
	percentUsed: number;
	status: "ok" | "warning" | "exceeded";
}

// =============================================================================
// Accessibility Compliance
// =============================================================================

/**
 * WCAG conformance levels.
 */
export type WCAGLevel = "A" | "AA" | "AAA";

/**
 * Accessibility issue categories (WCAG/Section 508).
 */
export type AccessibilityCategory =
	| "images"          // Alt text, decorative images
	| "color"           // Color contrast, color-only information
	| "navigation"      // Heading structure, link text
	| "tables"          // Table headers, complex tables
	| "forms"           // Form labels, error messages
	| "multimedia"      // Captions, transcripts
	| "documents"       // Reading order, language
	| "keyboard"        // Focus, skip links
	| "timing";         // Auto-refresh, time limits

/**
 * A single accessibility issue.
 */
export interface AccessibilityIssue {
	id: string;
	category: AccessibilityCategory;
	wcagCriterion: string;
	wcagLevel: WCAGLevel;
	title: string;
	description: string;
	location?: IssueLocation;
	/** Remediation guidance */
	remediation: string;
	/** Impact on users with disabilities */
	impact: "critical" | "serious" | "moderate" | "minor";
	/** Auto-fix available */
	autoFixable?: boolean;
}

/**
 * Complete accessibility check result.
 */
export interface AccessibilityResult {
	documentId: string;
	/** Overall accessibility score (0-100) */
	score: number;
	/** Achieved WCAG level */
	achievedLevel: WCAGLevel | null;
	/** Target WCAG level */
	targetLevel: WCAGLevel;
	/** Section 508 compliant */
	section508Compliant: boolean;
	/** Issues by category */
	issuesByCategory: Record<AccessibilityCategory, AccessibilityIssue[]>;
	/** Total issue counts */
	issueCounts: {
		critical: number;
		serious: number;
		moderate: number;
		minor: number;
	};
	/** Category scores */
	categoryScores: Record<AccessibilityCategory, number>;
	/** Check timestamp */
	checkedAt: string;
}

// =============================================================================
// Table of Contents
// =============================================================================

/**
 * Heading level for TOC entries.
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * TOC entry type.
 */
export type TOCEntryType = "heading" | "figure" | "table" | "acronym";

/**
 * A single TOC entry.
 */
export interface TOCEntry {
	id: TOCEntryId;
	type: TOCEntryType;
	/** Entry text/title */
	text: string;
	/** Page number */
	page: number;
	/** Heading level (1-6, for headings only) */
	level?: HeadingLevel;
	/** Section number (e.g., "1.2.3") */
	sectionNumber?: string;
	/** Target element ID for linking */
	targetId?: string;
	/** Child entries (for hierarchical display) */
	children?: TOCEntry[];
}

/**
 * TOC generation configuration.
 */
export interface TOCConfig {
	/** Which heading levels to include */
	includeLevels: HeadingLevel[];
	/** Include figures */
	includeFigures: boolean;
	/** Include tables */
	includeTables: boolean;
	/** Include acronyms */
	includeAcronyms: boolean;
	/** Use section numbering */
	showSectionNumbers: boolean;
	/** Leader style between text and page number */
	leaderStyle: "dots" | "dashes" | "underline" | "none";
	/** Title for the TOC */
	title?: string;
}

/**
 * Generated TOC result.
 */
export interface TOCResult {
	entries: TOCEntry[];
	config: TOCConfig;
	/** Generated at timestamp */
	generatedAt: string;
}

// =============================================================================
// List Generation (Figures, Tables, Acronyms)
// =============================================================================

/**
 * Figure list entry.
 */
export interface FigureEntry {
	id: string;
	number: string;
	title: string;
	page: number;
	targetId: string;
}

/**
 * Table list entry.
 */
export interface TableEntry {
	id: string;
	number: string;
	title: string;
	page: number;
	targetId: string;
}

/**
 * Acronym entry.
 */
export interface AcronymEntry {
	id: string;
	acronym: string;
	definition: string;
	/** First occurrence page */
	firstPage?: number;
}

/**
 * Generated lists result.
 */
export interface ListsResult {
	figures?: FigureEntry[];
	tables?: TableEntry[];
	acronyms?: AcronymEntry[];
	generatedAt: string;
}

// =============================================================================
// Format Preview
// =============================================================================

/**
 * Preview page representation.
 */
export interface PreviewPage {
	pageNumber: number;
	/** Base64 encoded image or SVG content */
	content: string;
	/** Content type */
	contentType: "image/png" | "image/svg+xml" | "text/html";
	width: number;
	height: number;
}

/**
 * Format preview result.
 */
export interface FormatPreviewResult {
	documentId: string;
	templateId: FormatTemplateId;
	pages: PreviewPage[];
	totalPages: number;
	generatedAt: string;
}

// =============================================================================
// Input Types for Actions
// =============================================================================

export interface ApplyTemplateInput {
	documentId: string;
	templateId: FormatTemplateId;
}

export interface ValidateFormatInput {
	documentId: string;
	templateId?: FormatTemplateId;
}

export interface CheckAccessibilityInput {
	documentId: string;
	targetLevel?: WCAGLevel;
}

export interface GenerateTOCInput {
	documentId: string;
	config: TOCConfig;
}

export interface GenerateListsInput {
	documentId: string;
	types: Array<"figures" | "tables" | "acronyms">;
}

export interface UpdateHeaderFooterInput {
	documentId: string;
	settings: HeaderFooterSettings;
}

export interface GeneratePreviewInput {
	documentId: string;
	templateId?: FormatTemplateId;
	/** Specific pages to preview */
	pages?: number[];
}

export interface AutoFixIssuesInput {
	documentId: string;
	issueIds: FormatIssueId[];
}

// =============================================================================
// Action Result Types
// =============================================================================

export interface ActionResult<T> {
	success: boolean;
	data?: T;
	error?: string;
}

export type ApplyTemplateResult = ActionResult<{ applied: boolean; templateId: FormatTemplateId }>;
export type ValidateFormatResult = ActionResult<FormatValidationResult>;
export type CheckAccessibilityResult = ActionResult<AccessibilityResult>;
export type GenerateTOCResult = ActionResult<TOCResult>;
export type GenerateListsResult = ActionResult<ListsResult>;
export type GetPageCountResult = ActionResult<PageCountInfo>;
export type UpdateHeaderFooterResult = ActionResult<{ updated: boolean }>;
export type GeneratePreviewResult = ActionResult<FormatPreviewResult>;
export type AutoFixResult = ActionResult<{ fixedCount: number; remainingIssues: FormatIssue[] }>;
export type GetTemplatesResult = ActionResult<FormatTemplate[]>;
