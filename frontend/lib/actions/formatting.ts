"use server";

/**
 * Government-Specific Formatting Engine Server Actions
 *
 * Provides comprehensive formatting capabilities for government RFP/proposal documents including:
 * - Agency-specific format templates (DoD, GSA, HHS, NASA, etc.)
 * - Page count validation and tracking by volume
 * - Accessibility compliance (Section 508, WCAG 2.1)
 * - Automated TOC, list of figures/tables, acronym glossary generation
 * - Header/footer management with dynamic content
 * - Format validation against agency requirements
 * - Export to compliant PDF and DOCX formats
 *
 * @module lib/actions/formatting
 */

import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import {
	formatTemplates,
	documentFormats,
	formatPresets,
	formatValidations,
	tocEntries,
	type FormatTemplate as FormatTemplateRow,
	type NewFormatTemplate,
	type DocumentFormat as DocumentFormatRow,
	type NewDocumentFormat,
	type FormatPreset as FormatPresetRow,
	type NewFormatPreset,
	type FormatValidation as FormatValidationRow,
	type NewFormatValidation,
	type TocEntry as TocEntryRow,
	type NewTocEntry,
	type PageMargins,
	type PageLimitSpec,
	type HeaderFormat,
	type FooterFormat,
	type PageNumberFormat,
	type SectionNumberFormat,
	type ValidationIssue as SchemaValidationIssue,
	type AccessibilityIssue as SchemaAccessibilityIssue,
	type CustomFormatSettings,
	type PageSize,
	type PageOrientation,
	type AccessibilityLevel,
	type TocEntryType,
	type ValidationSeverity,
	type ValidationIssueType,
} from "@/lib/db/schema-formatting";
import { eq, and, sql, desc, asc, ilike, or } from "drizzle-orm";
import { requireUserContext } from "@/lib/auth-utils";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

// ============================================================================
// Type Definitions - Mapped from Schema Types
// ============================================================================

/**
 * Format template representing agency-specific formatting requirements.
 * Maps to the formatTemplates table in the database.
 */
export interface FormatTemplate {
	id: string;
	name: string;
	description: string | null;
	agencyCode: string | null;
	agencyName: string | null;
	subAgency: string | null;
	contractVehicle: string | null;
	pageSize: PageSize | null;
	orientation: PageOrientation | null;
	margins: PageMargins | null;
	bodyFont: string | null;
	bodyFontSize: number | null;
	headingFont: string | null;
	lineSpacing: number | null;
	minimumFontSize: number | null;
	allowFontEmbedding: boolean | null;
	pageLimits: PageLimitSpec[] | null;
	headerFormat: HeaderFormat | null;
	footerFormat: FooterFormat | null;
	pageNumberFormat: PageNumberFormat | null;
	sectionNumberFormat: SectionNumberFormat | null;
	frontMatterOrder: string[] | null;
	requiredSections: string[] | null;
	appendixNaming: string | null;
	requiresAccessibility: boolean | null;
	accessibilityLevel: AccessibilityLevel | null;
	accessibilityRequirements: string[] | null;
	minimumImageResolution: number | null;
	requireImageAltText: boolean | null;
	maxImageSizeKb: number | null;
	allowedImageFormats: string[] | null;
	tableBorderStyle: string | null;
	requireTableHeaders: boolean | null;
	maxTableWidthPercent: number | null;
	preferredOutputFormat: string | null;
	pdfACompliance: string | null;
	embedFontsInPdf: boolean | null;
	isDefault: boolean | null;
	isActive: boolean | null;
	isSystem: boolean | null;
	version: string | null;
	derivedFromId: string | null;
	organizationId: string | null;
	createdBy: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * Document format application record.
 * Links a document to its applied format template with optional overrides.
 */
export interface DocumentFormat {
	id: string;
	documentId: string;
	templateId: string | null;
	overrides: CustomFormatSettings | null;
	hasOverrides: boolean | null;
	appliedAt: string;
	appliedBy: string | null;
	isValid: boolean | null;
	lastValidationId: string | null;
	lastValidatedAt: string | null;
	isLocked: boolean | null;
	lockReason: string | null;
	lockedAt: string | null;
	lockedBy: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * Format preset for saving custom formatting configurations.
 */
export interface FormatPreset {
	id: string;
	userId: string;
	organizationId: string | null;
	name: string;
	description: string | null;
	tags: string[] | null;
	baseTemplateId: string | null;
	customSettings: CustomFormatSettings;
	targetAgency: string | null;
	contractType: string | null;
	isShared: boolean | null;
	sharedAt: string | null;
	sharedBy: string | null;
	isPublic: boolean | null;
	useCount: number | null;
	lastUsedAt: string | null;
	isActive: boolean | null;
	isFavorite: boolean | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * Format validation result stored in database.
 */
export interface FormatValidation {
	id: string;
	documentId: string;
	templateId: string | null;
	validatedAt: string;
	validatedBy: string | null;
	validationType: string | null;
	documentVersionId: string | null;
	isValid: boolean;
	overallScore: number | null;
	summary: string | null;
	issues: SchemaValidationIssue[] | null;
	criticalIssueCount: number | null;
	majorIssueCount: number | null;
	minorIssueCount: number | null;
	infoIssueCount: number | null;
	pageCount: number | null;
	pageLimit: number | null;
	pageCountValid: boolean | null;
	pageCountsByVolume: Record<string, number> | null;
	excludedPageCount: number | null;
	accessibilityScore: number | null;
	accessibilityPassed: boolean | null;
	accessibilityIssues: SchemaAccessibilityIssue[] | null;
	accessibilityViolationCount: number | null;
	fontCompliance: boolean | null;
	fontsUsed: string[] | null;
	nonCompliantFonts: string[] | null;
	marginCompliance: boolean | null;
	marginViolationPages: number[] | null;
	spacingCompliance: boolean | null;
	spacingViolationSections: string[] | null;
	headerCompliance: boolean | null;
	footerCompliance: boolean | null;
	headerFooterIssuePages: number[] | null;
	imageCount: number | null;
	imagesMissingAltText: number | null;
	imagesLowResolution: number | null;
	tableCount: number | null;
	tablesMissingHeaders: number | null;
	crossReferenceCount: number | null;
	brokenCrossReferences: number | null;
	validationDurationMs: number | null;
	validatorVersion: string | null;
	createdAt: string;
}

/**
 * Table of contents entry.
 */
export interface TOCEntry {
	id: string;
	documentId: string;
	formatValidationId: string | null;
	entryType: TocEntryType;
	title: string;
	shortTitle: string | null;
	pageNumber: number | null;
	endPageNumber: number | null;
	sectionNumber: string | null;
	level: number;
	sortOrder: number;
	parentEntryId: string | null;
	includeInMainToc: boolean | null;
	isGenerated: boolean | null;
	anchorId: string | null;
	elementId: string | null;
	caption: string | null;
	figureTableNumber: string | null;
	isActive: boolean | null;
	createdAt: string;
	updatedAt: string;
	children?: TOCEntry[];
}

/**
 * Input type for creating new format templates.
 */
export type NewFormatTemplateInput = Omit<NewFormatTemplate, "id" | "createdAt" | "updatedAt">;

/**
 * Input type for creating new format presets.
 */
export type NewFormatPresetInput = Omit<NewFormatPreset, "id" | "createdAt" | "updatedAt">;

// ============================================================================
// Validation Result Types (for API responses)
// ============================================================================

/**
 * Individual format issue found during validation.
 */
export interface FormatIssue {
	type: ValidationIssueType;
	severity: ValidationSeverity;
	message: string;
	location?: string;
	suggestion?: string;
	requirementRef?: string;
	autoFixable?: boolean;
}

/**
 * Accessibility issue found during validation.
 */
export interface AccessibilityIssue {
	criterion: string;
	description: string;
	element?: string;
	impact: string;
	remediation?: string;
}

/**
 * Comprehensive format validation result returned by validation functions.
 */
export interface FormatValidationResult {
	isValid: boolean;
	overallScore: number;
	issues: FormatIssue[];
	pageCount: number;
	pageLimit: number;
	pageCountValid: boolean;
	accessibilityScore: number;
	accessibilityIssues: AccessibilityIssue[];
	fontCompliance: boolean;
	marginCompliance: boolean;
	spacingCompliance: boolean;
	headerCompliance: boolean;
	footerCompliance: boolean;
	validatedAt: string;
}

/**
 * Header and footer settings for documents (convenience interface).
 */
export interface HeaderFooterSettings {
	headerFormat?: HeaderFormat;
	footerFormat?: FooterFormat;
	pageNumberFormat?: PageNumberFormat;
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

const pageMarginsSchema = z.object({
	top: z.number().min(0).max(3).default(1.0),
	bottom: z.number().min(0).max(3).default(1.0),
	left: z.number().min(0).max(3).default(1.0),
	right: z.number().min(0).max(3).default(1.0),
	gutter: z.number().min(0).max(1).optional(),
});

const pageLimitSpecSchema = z.object({
	volume: z.string().optional(),
	limit: z.number().min(1),
	excludes: z.array(z.string()).optional(),
	foldoutMultiplier: z.number().optional(),
	notes: z.string().optional(),
});

const headerFormatSchema = z.object({
	enabled: z.boolean().default(true),
	height: z.number().optional(),
	leftContent: z.string().optional(),
	centerContent: z.string().optional(),
	rightContent: z.string().optional(),
	font: z.string().optional(),
	fontSize: z.number().optional(),
	includeLine: z.boolean().optional(),
	differentFirstPage: z.boolean().optional(),
	firstPageContent: z.object({
		leftContent: z.string().optional(),
		centerContent: z.string().optional(),
		rightContent: z.string().optional(),
	}).optional(),
	differentOddEven: z.boolean().optional(),
});

const footerFormatSchema = z.object({
	enabled: z.boolean().default(true),
	height: z.number().optional(),
	leftContent: z.string().optional(),
	centerContent: z.string().optional(),
	rightContent: z.string().optional(),
	font: z.string().optional(),
	fontSize: z.number().optional(),
	includeLine: z.boolean().optional(),
	differentFirstPage: z.boolean().optional(),
	firstPageContent: z.object({
		leftContent: z.string().optional(),
		centerContent: z.string().optional(),
		rightContent: z.string().optional(),
	}).optional(),
	proprietaryNotice: z.string().optional(),
});

const pageNumberFormatSchema = z.object({
	style: z.enum(["arabic", "roman_lower", "roman_upper", "alpha_lower", "alpha_upper"]).default("arabic"),
	startAt: z.number().optional(),
	prefix: z.string().optional(),
	suffix: z.string().optional(),
	position: z.enum(["header", "footer"]).default("footer"),
	alignment: z.enum(["left", "center", "right"]).default("center"),
	includeTotal: z.boolean().optional(),
	frontMatterStyle: z.enum(["roman_lower", "roman_upper", "none"]).optional(),
	restartAfterFrontMatter: z.boolean().optional(),
});

const customFormatSettingsSchema = z.object({
	pageSize: z.enum(["letter", "legal", "A4"]).optional(),
	orientation: z.enum(["portrait", "landscape"]).optional(),
	margins: pageMarginsSchema.partial().optional(),
	bodyFont: z.string().optional(),
	bodyFontSize: z.number().optional(),
	headingFont: z.string().optional(),
	lineSpacing: z.number().optional(),
	headerFormat: headerFormatSchema.partial().optional(),
	footerFormat: footerFormatSchema.partial().optional(),
	pageNumberFormat: pageNumberFormatSchema.partial().optional(),
	pageLimits: z.array(pageLimitSpecSchema).optional(),
	frontMatterOrder: z.array(z.string()).optional(),
	customStyles: z.record(z.string(), z.string()).optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

const createFormatTemplateSchema = z.object({
	name: z.string().min(1, "Template name is required").max(200),
	description: z.string().max(2000).nullable().optional(),
	agencyCode: z.string().max(50).nullable().optional(),
	agencyName: z.string().max(200).nullable().optional(),
	subAgency: z.string().max(200).nullable().optional(),
	contractVehicle: z.string().max(200).nullable().optional(),
	pageSize: z.enum(["letter", "legal", "A4"]).default("letter"),
	orientation: z.enum(["portrait", "landscape"]).default("portrait"),
	margins: pageMarginsSchema.optional(),
	bodyFont: z.string().max(100).default("Times New Roman"),
	bodyFontSize: z.number().min(6).max(72).default(12),
	headingFont: z.string().max(100).default("Arial"),
	lineSpacing: z.number().min(1).max(3).default(1.0),
	minimumFontSize: z.number().min(6).max(72).default(10),
	allowFontEmbedding: z.boolean().default(true),
	pageLimits: z.array(pageLimitSpecSchema).optional(),
	headerFormat: headerFormatSchema.optional(),
	footerFormat: footerFormatSchema.optional(),
	pageNumberFormat: pageNumberFormatSchema.optional(),
	requiresAccessibility: z.boolean().default(true),
	accessibilityLevel: z.enum(["WCAG_AA", "WCAG_AAA", "Section_508"]).default("Section_508"),
	accessibilityRequirements: z.array(z.string()).optional(),
	minimumImageResolution: z.number().default(300),
	requireImageAltText: z.boolean().default(true),
	requireTableHeaders: z.boolean().default(true),
	preferredOutputFormat: z.string().default("pdf"),
	isDefault: z.boolean().default(false),
	isActive: z.boolean().default(true),
	isSystem: z.boolean().default(false),
});

// ============================================================================
// Helper Functions
// ============================================================================

async function requireFormattingContext(): Promise<{ userId: string; organizationId: string }> {
	const userContext = await requireUserContext();
	if (!userContext.organizationId) {
		throw new Error("No organization context");
	}
	return {
		userId: userContext.userId,
		organizationId: userContext.organizationId,
	};
}

/**
 * Maps a database format template row to the FormatTemplate interface.
 */
function mapFormatTemplate(row: FormatTemplateRow): FormatTemplate {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		agencyCode: row.agencyCode,
		agencyName: row.agencyName,
		subAgency: row.subAgency,
		contractVehicle: row.contractVehicle,
		pageSize: row.pageSize,
		orientation: row.orientation,
		margins: row.margins,
		bodyFont: row.bodyFont,
		bodyFontSize: row.bodyFontSize,
		headingFont: row.headingFont,
		lineSpacing: row.lineSpacing,
		minimumFontSize: row.minimumFontSize,
		allowFontEmbedding: row.allowFontEmbedding,
		pageLimits: row.pageLimits,
		headerFormat: row.headerFormat,
		footerFormat: row.footerFormat,
		pageNumberFormat: row.pageNumberFormat,
		sectionNumberFormat: row.sectionNumberFormat,
		frontMatterOrder: row.frontMatterOrder,
		requiredSections: row.requiredSections,
		appendixNaming: row.appendixNaming,
		requiresAccessibility: row.requiresAccessibility,
		accessibilityLevel: row.accessibilityLevel,
		accessibilityRequirements: row.accessibilityRequirements,
		minimumImageResolution: row.minimumImageResolution,
		requireImageAltText: row.requireImageAltText,
		maxImageSizeKb: row.maxImageSizeKb,
		allowedImageFormats: row.allowedImageFormats,
		tableBorderStyle: row.tableBorderStyle,
		requireTableHeaders: row.requireTableHeaders,
		maxTableWidthPercent: row.maxTableWidthPercent,
		preferredOutputFormat: row.preferredOutputFormat,
		pdfACompliance: row.pdfACompliance,
		embedFontsInPdf: row.embedFontsInPdf,
		isDefault: row.isDefault,
		isActive: row.isActive,
		isSystem: row.isSystem,
		version: row.version,
		derivedFromId: row.derivedFromId,
		organizationId: row.organizationId,
		createdBy: row.createdBy,
		createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
		updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
	};
}

/**
 * Maps a database document format row to the DocumentFormat interface.
 */
function mapDocumentFormat(row: DocumentFormatRow): DocumentFormat {
	return {
		id: row.id,
		documentId: row.documentId,
		templateId: row.templateId,
		overrides: row.overrides,
		hasOverrides: row.hasOverrides,
		appliedAt: row.appliedAt?.toISOString() ?? new Date().toISOString(),
		appliedBy: row.appliedBy,
		isValid: row.isValid,
		lastValidationId: row.lastValidationId,
		lastValidatedAt: row.lastValidatedAt?.toISOString() ?? null,
		isLocked: row.isLocked,
		lockReason: row.lockReason,
		lockedAt: row.lockedAt?.toISOString() ?? null,
		lockedBy: row.lockedBy,
		createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
		updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
	};
}

/**
 * Maps a database format preset row to the FormatPreset interface.
 */
function mapFormatPreset(row: FormatPresetRow): FormatPreset {
	return {
		id: row.id,
		userId: row.userId,
		organizationId: row.organizationId,
		name: row.name,
		description: row.description,
		tags: row.tags,
		baseTemplateId: row.baseTemplateId,
		customSettings: row.customSettings,
		targetAgency: row.targetAgency,
		contractType: row.contractType,
		isShared: row.isShared,
		sharedAt: row.sharedAt?.toISOString() ?? null,
		sharedBy: row.sharedBy,
		isPublic: row.isPublic,
		useCount: row.useCount,
		lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
		isActive: row.isActive,
		isFavorite: row.isFavorite,
		createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
		updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
	};
}

/**
 * Maps a database format validation row to the FormatValidation interface.
 */
function mapFormatValidation(row: FormatValidationRow): FormatValidation {
	return {
		id: row.id,
		documentId: row.documentId,
		templateId: row.templateId,
		validatedAt: row.validatedAt?.toISOString() ?? new Date().toISOString(),
		validatedBy: row.validatedBy,
		validationType: row.validationType,
		documentVersionId: row.documentVersionId,
		isValid: row.isValid,
		overallScore: row.overallScore,
		summary: row.summary,
		issues: row.issues,
		criticalIssueCount: row.criticalIssueCount,
		majorIssueCount: row.majorIssueCount,
		minorIssueCount: row.minorIssueCount,
		infoIssueCount: row.infoIssueCount,
		pageCount: row.pageCount,
		pageLimit: row.pageLimit,
		pageCountValid: row.pageCountValid,
		pageCountsByVolume: row.pageCountsByVolume,
		excludedPageCount: row.excludedPageCount,
		accessibilityScore: row.accessibilityScore,
		accessibilityPassed: row.accessibilityPassed,
		accessibilityIssues: row.accessibilityIssues,
		accessibilityViolationCount: row.accessibilityViolationCount,
		fontCompliance: row.fontCompliance,
		fontsUsed: row.fontsUsed,
		nonCompliantFonts: row.nonCompliantFonts,
		marginCompliance: row.marginCompliance,
		marginViolationPages: row.marginViolationPages,
		spacingCompliance: row.spacingCompliance,
		spacingViolationSections: row.spacingViolationSections,
		headerCompliance: row.headerCompliance,
		footerCompliance: row.footerCompliance,
		headerFooterIssuePages: row.headerFooterIssuePages,
		imageCount: row.imageCount,
		imagesMissingAltText: row.imagesMissingAltText,
		imagesLowResolution: row.imagesLowResolution,
		tableCount: row.tableCount,
		tablesMissingHeaders: row.tablesMissingHeaders,
		crossReferenceCount: row.crossReferenceCount,
		brokenCrossReferences: row.brokenCrossReferences,
		validationDurationMs: row.validationDurationMs,
		validatorVersion: row.validatorVersion,
		createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
	};
}

/**
 * Maps a database TOC entry row to the TOCEntry interface.
 */
function mapTocEntry(row: TocEntryRow): TOCEntry {
	return {
		id: row.id,
		documentId: row.documentId,
		formatValidationId: row.formatValidationId,
		entryType: row.entryType,
		title: row.title,
		shortTitle: row.shortTitle,
		pageNumber: row.pageNumber,
		endPageNumber: row.endPageNumber,
		sectionNumber: row.sectionNumber,
		level: row.level,
		sortOrder: row.sortOrder,
		parentEntryId: row.parentEntryId,
		includeInMainToc: row.includeInMainToc,
		isGenerated: row.isGenerated,
		anchorId: row.anchorId,
		elementId: row.elementId,
		caption: row.caption,
		figureTableNumber: row.figureTableNumber,
		isActive: row.isActive,
		createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
		updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
	};
}

/**
 * Estimates page count from document content.
 * Uses standard government proposal assumptions:
 * - ~250 words per page with standard margins and 12pt font
 * - Adjusts for line spacing and font size
 */
function estimatePageCount(
	content: Record<string, unknown>,
	specs: { lineSpacing: number; baseFontSize: number }
): number {
	const plainText = extractPlainText(content);
	const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;

	// Base words per page (12pt, single-spaced, 1" margins)
	const baseWordsPerPage = 500;

	// Adjust for line spacing (more spacing = fewer words per page)
	const spacingMultiplier = 1 / specs.lineSpacing;

	// Adjust for font size (larger font = fewer words per page)
	const fontMultiplier = 12 / specs.baseFontSize;

	const adjustedWordsPerPage = baseWordsPerPage * spacingMultiplier * fontMultiplier;

	return Math.ceil(wordCount / adjustedWordsPerPage);
}

/**
 * Extracts plain text from Tiptap document content.
 */
function extractPlainText(content: unknown): string {
	if (!content || typeof content !== "object") return "";

	const doc = content as { type?: string; content?: unknown[]; text?: string };

	if (doc.text) return doc.text;

	if (Array.isArray(doc.content)) {
		return doc.content.map(node => extractPlainText(node)).join(" ");
	}

	return "";
}

/**
 * Extracts headings from document content for TOC generation.
 */
function extractHeadings(
	content: unknown,
	pageEstimator: (position: number) => number
): { id: string; title: string; pageNumber: number; level: number }[] {
	if (!content || typeof content !== "object") return [];

	const doc = content as { type?: string; content?: unknown[]; attrs?: Record<string, unknown> };
	const headings: { id: string; title: string; pageNumber: number; level: number }[] = [];
	let position = 0;

	function processNode(node: unknown): void {
		if (!node || typeof node !== "object") return;

		const n = node as {
			type?: string;
			content?: unknown[];
			attrs?: Record<string, unknown>;
			text?: string;
		};

		if (n.type === "heading") {
			const level = (n.attrs?.level as number) ?? 1;
			const text = n.content?.map((c: unknown) => {
				const textNode = c as { text?: string };
				return textNode.text ?? "";
			}).join("") ?? "";

			if (text.trim()) {
				headings.push({
					id: `heading-${headings.length}`,
					title: text.trim(),
					pageNumber: pageEstimator(position),
					level,
				});
			}
		}

		// Track position for page estimation
		if (n.text) {
			position += n.text.length;
		}

		if (Array.isArray(n.content)) {
			n.content.forEach(processNode);
		}
	}

	if (Array.isArray(doc.content)) {
		doc.content.forEach(processNode);
	}

	return headings;
}

/**
 * Extracts figures from document content.
 */
function extractFigures(
	content: unknown,
	pageEstimator: (position: number) => number
): { id: string; title: string; pageNumber: number }[] {
	if (!content || typeof content !== "object") return [];

	const doc = content as { content?: unknown[] };
	const figures: { id: string; title: string; pageNumber: number }[] = [];
	let position = 0;
	let figureCount = 0;

	function processNode(node: unknown): void {
		if (!node || typeof node !== "object") return;

		const n = node as {
			type?: string;
			content?: unknown[];
			attrs?: Record<string, unknown>;
			text?: string;
		};

		// Detect images or figure elements
		if (n.type === "image" || n.type === "figure") {
			figureCount++;
			const caption = (n.attrs?.caption as string) ??
				(n.attrs?.alt as string) ??
				`Figure ${figureCount}`;

			figures.push({
				id: `figure-${figureCount}`,
				title: caption,
				pageNumber: pageEstimator(position),
			});
		}

		if (n.text) {
			position += n.text.length;
		}

		if (Array.isArray(n.content)) {
			n.content.forEach(processNode);
		}
	}

	if (Array.isArray(doc.content)) {
		doc.content.forEach(processNode);
	}

	return figures;
}

/**
 * Extracts tables from document content.
 */
function extractTables(
	content: unknown,
	pageEstimator: (position: number) => number
): { id: string; title: string; pageNumber: number }[] {
	if (!content || typeof content !== "object") return [];

	const doc = content as { content?: unknown[] };
	const tables: { id: string; title: string; pageNumber: number }[] = [];
	let position = 0;
	let tableCount = 0;

	function processNode(node: unknown): void {
		if (!node || typeof node !== "object") return;

		const n = node as {
			type?: string;
			content?: unknown[];
			attrs?: Record<string, unknown>;
			text?: string;
		};

		if (n.type === "table") {
			tableCount++;
			const caption = (n.attrs?.caption as string) ?? `Table ${tableCount}`;

			tables.push({
				id: `table-${tableCount}`,
				title: caption,
				pageNumber: pageEstimator(position),
			});
		}

		if (n.text) {
			position += n.text.length;
		}

		if (Array.isArray(n.content)) {
			n.content.forEach(processNode);
		}
	}

	if (Array.isArray(doc.content)) {
		doc.content.forEach(processNode);
	}

	return tables;
}

/**
 * Extracts acronyms from document content using pattern matching.
 * Looks for patterns like "Agency Name (AN)" or uppercase sequences.
 */
function extractAcronyms(content: unknown): { acronym: string; definition: string; firstOccurrence: number }[] {
	const plainText = extractPlainText(content);
	const acronymMap = new Map<string, { definition: string; position: number }>();

	// Pattern 1: "Full Name (ACRONYM)" format
	const definitionPattern = /([A-Z][a-zA-Z\s]+)\s+\(([A-Z]{2,})\)/g;
	let match;

	while ((match = definitionPattern.exec(plainText)) !== null) {
		const definition = match[1].trim();
		const acronym = match[2];

		if (!acronymMap.has(acronym)) {
			acronymMap.set(acronym, {
				definition,
				position: match.index,
			});
		}
	}

	// Pattern 2: Standalone uppercase acronyms (2-6 letters)
	const standalonePattern = /\b([A-Z]{2,6})\b/g;

	while ((match = standalonePattern.exec(plainText)) !== null) {
		const acronym = match[1];

		// Skip common words that happen to be uppercase
		const commonWords = ["THE", "AND", "FOR", "BUT", "NOT", "YOU", "ALL", "CAN", "HAD"];
		if (commonWords.includes(acronym)) continue;

		if (!acronymMap.has(acronym)) {
			acronymMap.set(acronym, {
				definition: "", // Unknown definition
				position: match.index,
			});
		}
	}

	// Convert to array and sort by acronym
	return Array.from(acronymMap.entries())
		.map(([acronym, data]) => ({
			acronym,
			definition: data.definition,
			firstOccurrence: data.position,
		}))
		.sort((a, b) => a.acronym.localeCompare(b.acronym));
}

/**
 * Validates font compliance against template specifications.
 */
function validateFontCompliance(
	_content: unknown,
	template: FormatTemplate
): { compliant: boolean; issues: FormatIssue[]; fontsUsed: string[]; nonCompliantFonts: string[] } {
	const issues: FormatIssue[] = [];
	const fontsUsed: string[] = [];
	const nonCompliantFonts: string[] = [];

	// In a production implementation, this would analyze the document's
	// actual font usage. For now, we'll return compliance based on
	// whether specs are defined.

	if (!template.bodyFont) {
		issues.push({
			type: "font_non_compliant",
			severity: "major",
			message: "Primary font not specified in formatting template",
			autoFixable: false,
		});
	} else {
		fontsUsed.push(template.bodyFont);
	}

	if (template.headingFont) {
		fontsUsed.push(template.headingFont);
	}

	if (template.bodyFontSize && template.minimumFontSize) {
		if (template.bodyFontSize < template.minimumFontSize) {
			issues.push({
				type: "font_non_compliant",
				severity: "critical",
				message: `Base font size (${template.bodyFontSize}pt) is below minimum (${template.minimumFontSize}pt)`,
				autoFixable: true,
			});
		}
	}

	return {
		compliant: issues.filter(i => i.severity === "critical").length === 0,
		issues,
		fontsUsed,
		nonCompliantFonts,
	};
}

/**
 * Validates margin compliance against template specifications.
 */
function validateMarginCompliance(
	_content: unknown,
	template: FormatTemplate
): { compliant: boolean; issues: FormatIssue[]; violationPages: number[] } {
	const issues: FormatIssue[] = [];
	const violationPages: number[] = [];

	// Standard government minimums (typically 1 inch)
	const minimumMargin = 1.0;

	if (template.margins) {
		if (template.margins.top < minimumMargin) {
			issues.push({
				type: "margin_violation",
				severity: "critical",
				message: `Top margin (${template.margins.top}") is below minimum (${minimumMargin}")`,
				autoFixable: true,
			});
		}

		if (template.margins.bottom < minimumMargin) {
			issues.push({
				type: "margin_violation",
				severity: "critical",
				message: `Bottom margin (${template.margins.bottom}") is below minimum (${minimumMargin}")`,
				autoFixable: true,
			});
		}

		if (template.margins.left < minimumMargin) {
			issues.push({
				type: "margin_violation",
				severity: "critical",
				message: `Left margin (${template.margins.left}") is below minimum (${minimumMargin}")`,
				autoFixable: true,
			});
		}

		if (template.margins.right < minimumMargin) {
			issues.push({
				type: "margin_violation",
				severity: "critical",
				message: `Right margin (${template.margins.right}") is below minimum (${minimumMargin}")`,
				autoFixable: true,
			});
		}
	}

	return {
		compliant: issues.filter(i => i.severity === "critical").length === 0,
		issues,
		violationPages,
	};
}

/**
 * Validates spacing compliance against template specifications.
 */
function validateSpacingCompliance(
	_content: unknown,
	_template: FormatTemplate
): { compliant: boolean; issues: FormatIssue[]; violationSections: string[] } {
	const issues: FormatIssue[] = [];
	const violationSections: string[] = [];

	// In production, would analyze actual document spacing
	// For now, return compliant if specs are reasonable

	return {
		compliant: issues.filter(i => i.severity === "critical").length === 0,
		issues,
		violationSections,
	};
}

/**
 * Validates accessibility compliance.
 */
function validateAccessibilityCompliance(
	content: unknown,
	template: FormatTemplate
): { score: number; passed: boolean; issues: AccessibilityIssue[]; violationCount: number } {
	const issues: AccessibilityIssue[] = [];
	let totalChecks = 0;
	let passedChecks = 0;

	// Check for images without alt text
	if (template.requireImageAltText) {
		totalChecks++;
		const hasImagesWithoutAlt = checkImagesWithoutAltText(content);
		if (hasImagesWithoutAlt) {
			issues.push({
				criterion: "1.1.1",
				description: "Images must have alternative text",
				impact: "critical",
				remediation: "Add descriptive alt text to all images",
			});
		} else {
			passedChecks++;
		}
	}

	// Check for proper heading structure
	totalChecks++;
	const headingIssues = checkHeadingStructure(content);
	if (headingIssues.length > 0) {
		issues.push({
			criterion: "1.3.1",
			description: "Document must have proper heading hierarchy",
			impact: "serious",
			remediation: "Use headings in sequential order (H1, H2, H3) without skipping levels",
		});
	} else {
		passedChecks++;
	}

	// Calculate score
	const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;
	const requiredScore = template.accessibilityLevel === "WCAG_AAA" ? 95 :
	                      template.accessibilityLevel === "WCAG_AA" ? 85 : 80;

	return {
		score,
		passed: score >= requiredScore,
		issues,
		violationCount: issues.length,
	};
}

/**
 * Checks for images without alt text in document content.
 */
function checkImagesWithoutAltText(content: unknown): boolean {
	if (!content || typeof content !== "object") return false;

	const doc = content as { content?: unknown[] };
	let foundImageWithoutAlt = false;

	function processNode(node: unknown): void {
		if (!node || typeof node !== "object") return;

		const n = node as {
			type?: string;
			content?: unknown[];
			attrs?: Record<string, unknown>;
		};

		if (n.type === "image" && !n.attrs?.alt) {
			foundImageWithoutAlt = true;
		}

		if (Array.isArray(n.content)) {
			n.content.forEach(processNode);
		}
	}

	if (Array.isArray(doc.content)) {
		doc.content.forEach(processNode);
	}

	return foundImageWithoutAlt;
}

/**
 * Checks heading structure for proper hierarchy.
 */
function checkHeadingStructure(content: unknown): string[] {
	if (!content || typeof content !== "object") return [];

	const doc = content as { content?: unknown[] };
	const structureIssues: string[] = [];
	let lastLevel = 0;

	function processNode(node: unknown): void {
		if (!node || typeof node !== "object") return;

		const n = node as {
			type?: string;
			content?: unknown[];
			attrs?: Record<string, unknown>;
		};

		if (n.type === "heading") {
			const level = (n.attrs?.level as number) ?? 1;

			// Check for skipped levels (e.g., H1 directly to H3)
			if (lastLevel > 0 && level > lastLevel + 1) {
				structureIssues.push(`Heading level skipped from H${lastLevel} to H${level}`);
			}

			lastLevel = level;
		}

		if (Array.isArray(n.content)) {
			n.content.forEach(processNode);
		}
	}

	if (Array.isArray(doc.content)) {
		doc.content.forEach(processNode);
	}

	return structureIssues;
}

/**
 * Validates header compliance.
 */
function validateHeaderCompliance(
	_content: unknown,
	template: FormatTemplate
): { compliant: boolean; issues: FormatIssue[] } {
	const issues: FormatIssue[] = [];

	if (template.headerFormat?.enabled && !template.headerFormat.centerContent &&
	    !template.headerFormat.leftContent && !template.headerFormat.rightContent) {
		issues.push({
			type: "missing_header",
			severity: "minor",
			message: "Header is enabled but has no content defined",
			autoFixable: false,
		});
	}

	return {
		compliant: issues.filter(i => i.severity === "critical").length === 0,
		issues,
	};
}

/**
 * Validates footer compliance.
 */
function validateFooterCompliance(
	_content: unknown,
	template: FormatTemplate
): { compliant: boolean; issues: FormatIssue[] } {
	const issues: FormatIssue[] = [];

	if (template.footerFormat?.enabled && !template.footerFormat.centerContent &&
	    !template.footerFormat.leftContent && !template.footerFormat.rightContent) {
		issues.push({
			type: "missing_footer",
			severity: "minor",
			message: "Footer is enabled but has no content defined",
			autoFixable: false,
		});
	}

	return {
		compliant: issues.filter(i => i.severity === "critical").length === 0,
		issues,
	};
}

// ============================================================================
// Format Template CRUD Operations
// ============================================================================

/**
 * Retrieves all format templates, optionally filtered by active status.
 *
 * @param options - Optional filtering options
 * @returns Array of format templates sorted by agency name
 *
 * @example
 * ```typescript
 * const templates = await getFormatTemplates({ activeOnly: true });
 * ```
 */
export async function getFormatTemplates(
	options?: { activeOnly?: boolean }
): Promise<FormatTemplate[]> {
	await requireUserContext();

	try {
		const conditions = [];

		if (options?.activeOnly) {
			conditions.push(eq(formatTemplates.isActive, true));
		}

		const rows = await db
			.select()
			.from(formatTemplates)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(asc(formatTemplates.agencyName), desc(formatTemplates.createdAt));

		return rows.map(mapFormatTemplate);
	} catch (error) {
		logger.error("Error fetching format templates:", error);
		throw new Error("Failed to fetch format templates");
	}
}

/**
 * Retrieves a single format template by ID.
 *
 * @param id - The format template ID
 * @returns The format template or null if not found
 *
 * @example
 * ```typescript
 * const template = await getFormatTemplateById("template-uuid");
 * if (template) {
 *   console.log(template.agencyCode);
 * }
 * ```
 */
export async function getFormatTemplateById(id: string): Promise<FormatTemplate | null> {
	await requireUserContext();

	try {
		const [row] = await db
			.select()
			.from(formatTemplates)
			.where(eq(formatTemplates.id, id))
			.limit(1);

		return row ? mapFormatTemplate(row) : null;
	} catch (error) {
		logger.error("Error fetching format template:", error);
		throw new Error("Failed to fetch format template");
	}
}

/**
 * Retrieves the default format template for a specific agency.
 *
 * @param agencyCode - The agency code (e.g., "DOD", "GSA", "NASA")
 * @returns The default format template for the agency or null if none exists
 *
 * @example
 * ```typescript
 * const dodTemplate = await getFormatTemplateByAgency("DOD");
 * ```
 */
export async function getFormatTemplateByAgency(
	agencyCode: string
): Promise<FormatTemplate | null> {
	await requireUserContext();

	try {
		// First try to find the default template for this agency
		let [row] = await db
			.select()
			.from(formatTemplates)
			.where(
				and(
					ilike(formatTemplates.agencyCode, agencyCode),
					eq(formatTemplates.isDefault, true),
					eq(formatTemplates.isActive, true)
				)
			)
			.limit(1);

		// If no default, get the latest active template for this agency
		if (!row) {
			[row] = await db
				.select()
				.from(formatTemplates)
				.where(
					and(
						ilike(formatTemplates.agencyCode, agencyCode),
						eq(formatTemplates.isActive, true)
					)
				)
				.orderBy(desc(formatTemplates.createdAt))
				.limit(1);
		}

		return row ? mapFormatTemplate(row) : null;
	} catch (error) {
		logger.error("Error fetching format template by agency:", error);
		throw new Error("Failed to fetch format template by agency");
	}
}

/**
 * Creates a new format template.
 *
 * @param data - The format template data
 * @returns The created format template
 *
 * @example
 * ```typescript
 * const template = await createFormatTemplate({
 *   name: "DoD Standard Format",
 *   agencyCode: "DOD",
 *   agencyName: "Department of Defense",
 *   bodyFont: "Times New Roman",
 *   // ... other fields
 * });
 * ```
 */
export async function createFormatTemplate(
	data: NewFormatTemplateInput
): Promise<FormatTemplate> {
	const userContext = await requireUserContext();

	// Validate input
	const validationResult = createFormatTemplateSchema.safeParse(data);
	if (!validationResult.success) {
		throw new Error(`Validation failed: ${validationResult.error.message}`);
	}

	const validatedData = validationResult.data;

	try {
		// If this is set as default, unset any existing default for this agency
		if (validatedData.isDefault && validatedData.agencyCode) {
			await db
				.update(formatTemplates)
				.set({ isDefault: false })
				.where(
					and(
						ilike(formatTemplates.agencyCode, validatedData.agencyCode),
						eq(formatTemplates.isDefault, true)
					)
				);
		}

		const [row] = await db
			.insert(formatTemplates)
			.values({
				name: validatedData.name,
				description: validatedData.description ?? null,
				agencyCode: validatedData.agencyCode?.toUpperCase() ?? null,
				agencyName: validatedData.agencyName ?? null,
				subAgency: validatedData.subAgency ?? null,
				contractVehicle: validatedData.contractVehicle ?? null,
				pageSize: validatedData.pageSize,
				orientation: validatedData.orientation,
				margins: validatedData.margins,
				bodyFont: validatedData.bodyFont,
				bodyFontSize: validatedData.bodyFontSize,
				headingFont: validatedData.headingFont,
				lineSpacing: validatedData.lineSpacing,
				minimumFontSize: validatedData.minimumFontSize,
				allowFontEmbedding: validatedData.allowFontEmbedding,
				pageLimits: validatedData.pageLimits,
				headerFormat: validatedData.headerFormat,
				footerFormat: validatedData.footerFormat,
				pageNumberFormat: validatedData.pageNumberFormat,
				requiresAccessibility: validatedData.requiresAccessibility,
				accessibilityLevel: validatedData.accessibilityLevel,
				accessibilityRequirements: validatedData.accessibilityRequirements,
				minimumImageResolution: validatedData.minimumImageResolution,
				requireImageAltText: validatedData.requireImageAltText,
				requireTableHeaders: validatedData.requireTableHeaders,
				preferredOutputFormat: validatedData.preferredOutputFormat,
				isDefault: validatedData.isDefault,
				isActive: validatedData.isActive,
				isSystem: validatedData.isSystem,
				createdBy: userContext.userId,
			})
			.returning();

		return mapFormatTemplate(row);
	} catch (error) {
		logger.error("Error creating format template:", error);
		throw new Error("Failed to create format template");
	}
}

/**
 * Updates an existing format template.
 *
 * @param id - The format template ID
 * @param data - Partial data to update
 * @returns The updated format template
 *
 * @example
 * ```typescript
 * const updated = await updateFormatTemplate("template-uuid", {
 *   pageLimits: [{ limit: 100 }]
 * });
 * ```
 */
export async function updateFormatTemplate(
	id: string,
	data: Partial<NewFormatTemplateInput>
): Promise<FormatTemplate> {
	await requireUserContext();

	try {
		// Get existing template
		const existing = await getFormatTemplateById(id);
		if (!existing) {
			throw new Error("Format template not found");
		}

		// Check if it's a system template
		if (existing.isSystem) {
			throw new Error("Cannot modify system templates");
		}

		// If setting as default, unset other defaults for this agency
		if (data.isDefault === true) {
			const agencyCode = data.agencyCode ?? existing.agencyCode;
			if (agencyCode) {
				await db
					.update(formatTemplates)
					.set({ isDefault: false })
					.where(
						and(
							ilike(formatTemplates.agencyCode, agencyCode),
							eq(formatTemplates.isDefault, true)
						)
					);
			}
		}

		// Build update object with only defined values
		const updateData: Partial<NewFormatTemplate> = {
			updatedAt: new Date(),
		};

		if (data.name !== undefined) updateData.name = data.name;
		if (data.description !== undefined) updateData.description = data.description;
		if (data.agencyCode !== undefined) updateData.agencyCode = data.agencyCode?.toUpperCase();
		if (data.agencyName !== undefined) updateData.agencyName = data.agencyName;
		if (data.subAgency !== undefined) updateData.subAgency = data.subAgency;
		if (data.contractVehicle !== undefined) updateData.contractVehicle = data.contractVehicle;
		if (data.pageSize !== undefined) updateData.pageSize = data.pageSize;
		if (data.orientation !== undefined) updateData.orientation = data.orientation;
		if (data.margins !== undefined) updateData.margins = data.margins;
		if (data.bodyFont !== undefined) updateData.bodyFont = data.bodyFont;
		if (data.bodyFontSize !== undefined) updateData.bodyFontSize = data.bodyFontSize;
		if (data.headingFont !== undefined) updateData.headingFont = data.headingFont;
		if (data.lineSpacing !== undefined) updateData.lineSpacing = data.lineSpacing;
		if (data.minimumFontSize !== undefined) updateData.minimumFontSize = data.minimumFontSize;
		if (data.allowFontEmbedding !== undefined) updateData.allowFontEmbedding = data.allowFontEmbedding;
		if (data.pageLimits !== undefined) updateData.pageLimits = data.pageLimits;
		if (data.headerFormat !== undefined) updateData.headerFormat = data.headerFormat;
		if (data.footerFormat !== undefined) updateData.footerFormat = data.footerFormat;
		if (data.pageNumberFormat !== undefined) updateData.pageNumberFormat = data.pageNumberFormat;
		if (data.requiresAccessibility !== undefined) updateData.requiresAccessibility = data.requiresAccessibility;
		if (data.accessibilityLevel !== undefined) updateData.accessibilityLevel = data.accessibilityLevel;
		if (data.accessibilityRequirements !== undefined) updateData.accessibilityRequirements = data.accessibilityRequirements;
		if (data.minimumImageResolution !== undefined) updateData.minimumImageResolution = data.minimumImageResolution;
		if (data.requireImageAltText !== undefined) updateData.requireImageAltText = data.requireImageAltText;
		if (data.requireTableHeaders !== undefined) updateData.requireTableHeaders = data.requireTableHeaders;
		if (data.preferredOutputFormat !== undefined) updateData.preferredOutputFormat = data.preferredOutputFormat;
		if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
		if (data.isActive !== undefined) updateData.isActive = data.isActive;

		const [row] = await db
			.update(formatTemplates)
			.set(updateData)
			.where(eq(formatTemplates.id, id))
			.returning();

		return mapFormatTemplate(row);
	} catch (error) {
		logger.error("Error updating format template:", error);
		throw new Error("Failed to update format template");
	}
}

/**
 * Deletes a format template. Marks as inactive rather than hard delete.
 *
 * @param id - The format template ID
 *
 * @example
 * ```typescript
 * await deleteFormatTemplate("template-uuid");
 * ```
 */
export async function deleteFormatTemplate(id: string): Promise<void> {
	await requireUserContext();

	try {
		// Check if it's a system template
		const existing = await getFormatTemplateById(id);
		if (existing?.isSystem) {
			throw new Error("Cannot delete system templates");
		}

		// Soft delete by setting isActive to false
		await db
			.update(formatTemplates)
			.set({
				isActive: false,
				updatedAt: new Date(),
			})
			.where(eq(formatTemplates.id, id));
	} catch (error) {
		logger.error("Error deleting format template:", error);
		throw new Error("Failed to delete format template");
	}
}

// ============================================================================
// Apply Formatting Operations
// ============================================================================

/**
 * Applies a format template to a document.
 * Creates a document format record linking the document to the template.
 *
 * @param documentId - The document ID
 * @param templateId - The format template ID
 * @returns The document format record
 *
 * @example
 * ```typescript
 * const format = await applyFormatTemplate("doc-uuid", "template-uuid");
 * ```
 */
export async function applyFormatTemplate(
	documentId: string,
	templateId: string
): Promise<DocumentFormat> {
	const userContext = await requireUserContext();

	try {
		// Verify document exists
		const [document] = await db
			.select()
			.from(documents)
			.where(eq(documents.id, documentId))
			.limit(1);

		if (!document) {
			throw new Error("Document not found");
		}

		// Get the format template
		const template = await getFormatTemplateById(templateId);
		if (!template) {
			throw new Error("Format template not found");
		}

		// Check if document already has a format applied
		const [existingFormat] = await db
			.select()
			.from(documentFormats)
			.where(eq(documentFormats.documentId, documentId))
			.limit(1);

		let row: DocumentFormatRow;

		if (existingFormat) {
			// Check if locked
			if (existingFormat.isLocked) {
				throw new Error("Document format is locked and cannot be changed");
			}

			// Update existing format
			[row] = await db
				.update(documentFormats)
				.set({
					templateId,
					hasOverrides: false,
					overrides: null,
					isValid: null,
					lastValidationId: null,
					lastValidatedAt: null,
					appliedAt: new Date(),
					appliedBy: userContext.userId,
					updatedAt: new Date(),
				})
				.where(eq(documentFormats.id, existingFormat.id))
				.returning();
		} else {
			// Create new format record
			[row] = await db
				.insert(documentFormats)
				.values({
					documentId,
					templateId,
					hasOverrides: false,
					appliedBy: userContext.userId,
				})
				.returning();
		}

		return mapDocumentFormat(row);
	} catch (error) {
		logger.error("Error applying format template:", error);
		throw new Error("Failed to apply format template");
	}
}

/**
 * Removes the format from a document.
 *
 * @param documentId - The document ID
 *
 * @example
 * ```typescript
 * await removeDocumentFormat("doc-uuid");
 * ```
 */
export async function removeDocumentFormat(documentId: string): Promise<void> {
	await requireUserContext();

	try {
		// Check if locked
		const [existing] = await db
			.select()
			.from(documentFormats)
			.where(eq(documentFormats.documentId, documentId))
			.limit(1);

		if (existing?.isLocked) {
			throw new Error("Document format is locked and cannot be removed");
		}

		await db
			.delete(documentFormats)
			.where(eq(documentFormats.documentId, documentId));
	} catch (error) {
		logger.error("Error removing document format:", error);
		throw new Error("Failed to remove document format");
	}
}

/**
 * Gets the format applied to a document.
 *
 * @param documentId - The document ID
 * @returns The document format or null if none applied
 *
 * @example
 * ```typescript
 * const format = await getDocumentFormat("doc-uuid");
 * if (format) {
 *   console.log(`Using template: ${format.templateId}`);
 * }
 * ```
 */
export async function getDocumentFormat(documentId: string): Promise<DocumentFormat | null> {
	await requireUserContext();

	try {
		const [row] = await db
			.select()
			.from(documentFormats)
			.where(eq(documentFormats.documentId, documentId))
			.limit(1);

		return row ? mapDocumentFormat(row) : null;
	} catch (error) {
		logger.error("Error fetching document format:", error);
		throw new Error("Failed to fetch document format");
	}
}

// ============================================================================
// Validation Operations
// ============================================================================

/**
 * Validates a document's formatting compliance against its applied template.
 * Performs comprehensive checks including fonts, margins, spacing, page counts,
 * and accessibility requirements.
 *
 * @param documentId - The document ID
 * @returns Comprehensive validation result
 *
 * @example
 * ```typescript
 * const result = await validateFormatCompliance("doc-uuid");
 * if (!result.isValid) {
 *   console.log(`Found ${result.issues.length} formatting issues`);
 * }
 * ```
 */
export async function validateFormatCompliance(
	documentId: string
): Promise<FormatValidationResult> {
	const userContext = await requireUserContext();
	const startTime = Date.now();

	try {
		// Get document and its format
		const [document] = await db
			.select()
			.from(documents)
			.where(eq(documents.id, documentId))
			.limit(1);

		if (!document) {
			throw new Error("Document not found");
		}

		const documentFormat = await getDocumentFormat(documentId);
		if (!documentFormat || !documentFormat.templateId) {
			// Return basic validation without template-specific checks
			return {
				isValid: false,
				overallScore: 0,
				issues: [{
					type: "custom",
					severity: "major",
					message: "No format template applied to document",
					suggestion: "Apply a format template to enable compliance validation",
					autoFixable: false,
				}],
				pageCount: 0,
				pageLimit: 0,
				pageCountValid: true,
				accessibilityScore: 0,
				accessibilityIssues: [],
				fontCompliance: true,
				marginCompliance: true,
				spacingCompliance: true,
				headerCompliance: true,
				footerCompliance: true,
				validatedAt: new Date().toISOString(),
			};
		}

		// Get the template
		const template = await getFormatTemplateById(documentFormat.templateId);
		if (!template) {
			throw new Error("Format template not found");
		}

		const content = document.content as Record<string, unknown>;
		const allIssues: FormatIssue[] = [];

		// Validate fonts
		const fontResult = validateFontCompliance(content, template);
		allIssues.push(...fontResult.issues);

		// Validate margins
		const marginResult = validateMarginCompliance(content, template);
		allIssues.push(...marginResult.issues);

		// Validate spacing
		const spacingResult = validateSpacingCompliance(content, template);
		allIssues.push(...spacingResult.issues);

		// Validate headers
		const headerResult = validateHeaderCompliance(content, template);
		allIssues.push(...headerResult.issues);

		// Validate footers
		const footerResult = validateFooterCompliance(content, template);
		allIssues.push(...footerResult.issues);

		// Validate accessibility
		const accessibilityResult = validateAccessibilityCompliance(content, template);

		// Calculate page count
		const pageCount = estimatePageCount(content, {
			lineSpacing: template.lineSpacing ?? 1.0,
			baseFontSize: template.bodyFontSize ?? 12,
		});

		// Get page limit from template
		let pageLimit = 0;
		if (template.pageLimits && template.pageLimits.length > 0) {
			// Use the first limit as the total, or sum up volume limits
			pageLimit = template.pageLimits.reduce((sum, spec) => sum + spec.limit, 0);
		}

		const pageCountValid = pageLimit === 0 || pageCount <= pageLimit;

		if (!pageCountValid) {
			allIssues.push({
				type: "page_limit_exceeded",
				severity: "critical",
				message: `Page count (${pageCount}) exceeds limit (${pageLimit})`,
				suggestion: `Reduce content by approximately ${pageCount - pageLimit} pages`,
				autoFixable: false,
			});
		}

		// Calculate overall score
		const criticalCount = allIssues.filter(i => i.severity === "critical").length;
		const majorCount = allIssues.filter(i => i.severity === "major").length;
		const minorCount = allIssues.filter(i => i.severity === "minor").length;
		const overallScore = Math.max(0, 100 - (criticalCount * 25) - (majorCount * 10) - (minorCount * 3));

		const isValid = criticalCount === 0 && accessibilityResult.passed;

		// Store validation result in database
		const validationDurationMs = Date.now() - startTime;

		const [validationRow] = await db
			.insert(formatValidations)
			.values({
				documentId,
				templateId: documentFormat.templateId,
				validatedBy: userContext.userId,
				validationType: "full",
				isValid,
				overallScore,
				summary: isValid ? "Document passes all format compliance checks" : `Found ${allIssues.length} issues requiring attention`,
				issues: allIssues as SchemaValidationIssue[],
				criticalIssueCount: criticalCount,
				majorIssueCount: majorCount,
				minorIssueCount: minorCount,
				infoIssueCount: allIssues.filter(i => i.severity === "info").length,
				pageCount,
				pageLimit,
				pageCountValid,
				accessibilityScore: accessibilityResult.score,
				accessibilityPassed: accessibilityResult.passed,
				accessibilityIssues: accessibilityResult.issues as SchemaAccessibilityIssue[],
				accessibilityViolationCount: accessibilityResult.violationCount,
				fontCompliance: fontResult.compliant,
				fontsUsed: fontResult.fontsUsed,
				nonCompliantFonts: fontResult.nonCompliantFonts,
				marginCompliance: marginResult.compliant,
				marginViolationPages: marginResult.violationPages,
				spacingCompliance: spacingResult.compliant,
				spacingViolationSections: spacingResult.violationSections,
				headerCompliance: headerResult.compliant,
				footerCompliance: footerResult.compliant,
				validationDurationMs,
				validatorVersion: "1.0.0",
			})
			.returning();

		// Update document format with validation status
		await db
			.update(documentFormats)
			.set({
				isValid,
				lastValidationId: validationRow.id,
				lastValidatedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(documentFormats.documentId, documentId));

		return {
			isValid,
			overallScore,
			issues: allIssues,
			pageCount,
			pageLimit,
			pageCountValid,
			accessibilityScore: accessibilityResult.score,
			accessibilityIssues: accessibilityResult.issues,
			fontCompliance: fontResult.compliant,
			marginCompliance: marginResult.compliant,
			spacingCompliance: spacingResult.compliant,
			headerCompliance: headerResult.compliant,
			footerCompliance: footerResult.compliant,
			validatedAt: new Date().toISOString(),
		};
	} catch (error) {
		logger.error("Error validating format compliance:", error);
		throw new Error("Failed to validate format compliance");
	}
}

/**
 * Checks the current page count against limits.
 * Returns detailed breakdown by volume if volume limits are defined.
 *
 * @param documentId - The document ID
 * @returns Page count information including validation status
 *
 * @example
 * ```typescript
 * const pageCheck = await checkPageCount("doc-uuid");
 * if (!pageCheck.isValid) {
 *   console.log(`Over limit by ${pageCheck.current - pageCheck.limit} pages`);
 * }
 * ```
 */
export async function checkPageCount(
	documentId: string
): Promise<{
	current: number;
	limit: number;
	isValid: boolean;
	byVolume?: Record<string, { current: number; limit: number; isValid: boolean }>;
}> {
	await requireUserContext();

	try {
		const [document] = await db
			.select()
			.from(documents)
			.where(eq(documents.id, documentId))
			.limit(1);

		if (!document) {
			throw new Error("Document not found");
		}

		const documentFormat = await getDocumentFormat(documentId);
		const content = document.content as Record<string, unknown>;

		// Default specs if no format applied
		const defaultSpecs = {
			lineSpacing: 1.5,
			baseFontSize: 12,
		};

		let specs = defaultSpecs;
		let pageLimit = 0;
		let volumeLimits: PageLimitSpec[] = [];

		if (documentFormat?.templateId) {
			const template = await getFormatTemplateById(documentFormat.templateId);
			if (template) {
				specs = {
					lineSpacing: template.lineSpacing ?? 1.0,
					baseFontSize: template.bodyFontSize ?? 12,
				};
				if (template.pageLimits && template.pageLimits.length > 0) {
					volumeLimits = template.pageLimits;
					pageLimit = volumeLimits.reduce((sum, spec) => sum + spec.limit, 0);
				}
			}
		}

		const current = estimatePageCount(content, specs);
		const isValid = pageLimit === 0 || current <= pageLimit;

		// Volume breakdown
		const byVolume: Record<string, { current: number; limit: number; isValid: boolean }> = {};

		for (const volumeSpec of volumeLimits) {
			if (volumeSpec.volume) {
				// In production, would analyze document sections
				const volumePageCount = Math.floor(current / volumeLimits.length);
				byVolume[volumeSpec.volume] = {
					current: volumePageCount,
					limit: volumeSpec.limit,
					isValid: volumePageCount <= volumeSpec.limit,
				};
			}
		}

		return {
			current,
			limit: pageLimit,
			isValid,
			byVolume: Object.keys(byVolume).length > 0 ? byVolume : undefined,
		};
	} catch (error) {
		logger.error("Error checking page count:", error);
		throw new Error("Failed to check page count");
	}
}

/**
 * Validates document accessibility compliance.
 *
 * @param documentId - The document ID
 * @returns Accessibility score and issues
 *
 * @example
 * ```typescript
 * const accessibility = await validateAccessibility("doc-uuid");
 * if (accessibility.score < 80) {
 *   console.log("Document needs accessibility improvements");
 * }
 * ```
 */
export async function validateAccessibility(
	documentId: string
): Promise<{ score: number; level: string; issues: AccessibilityIssue[] }> {
	await requireUserContext();

	try {
		const [document] = await db
			.select()
			.from(documents)
			.where(eq(documents.id, documentId))
			.limit(1);

		if (!document) {
			throw new Error("Document not found");
		}

		const documentFormat = await getDocumentFormat(documentId);
		const content = document.content as Record<string, unknown>;

		// Default template for accessibility validation
		let template: FormatTemplate = {
			id: "",
			name: "Default",
			description: null,
			agencyCode: null,
			agencyName: null,
			subAgency: null,
			contractVehicle: null,
			pageSize: "letter",
			orientation: "portrait",
			margins: null,
			bodyFont: "Times New Roman",
			bodyFontSize: 12,
			headingFont: "Arial",
			lineSpacing: 1.0,
			minimumFontSize: 10,
			allowFontEmbedding: true,
			pageLimits: null,
			headerFormat: null,
			footerFormat: null,
			pageNumberFormat: null,
			sectionNumberFormat: null,
			frontMatterOrder: null,
			requiredSections: null,
			appendixNaming: null,
			requiresAccessibility: true,
			accessibilityLevel: "Section_508",
			accessibilityRequirements: null,
			minimumImageResolution: 300,
			requireImageAltText: true,
			maxImageSizeKb: null,
			allowedImageFormats: null,
			tableBorderStyle: null,
			requireTableHeaders: true,
			maxTableWidthPercent: null,
			preferredOutputFormat: "pdf",
			pdfACompliance: null,
			embedFontsInPdf: true,
			isDefault: false,
			isActive: true,
			isSystem: false,
			version: "1.0",
			derivedFromId: null,
			organizationId: null,
			createdBy: null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		if (documentFormat?.templateId) {
			const loadedTemplate = await getFormatTemplateById(documentFormat.templateId);
			if (loadedTemplate) {
				template = loadedTemplate;
			}
		}

		const result = validateAccessibilityCompliance(content, template);

		// Determine compliance level based on score
		let level: string;
		if (result.score >= 95) {
			level = "AAA";
		} else if (result.score >= 85) {
			level = "AA";
		} else if (result.score >= 70) {
			level = "A";
		} else {
			level = "Non-compliant";
		}

		return {
			score: result.score,
			level,
			issues: result.issues,
		};
	} catch (error) {
		logger.error("Error validating accessibility:", error);
		throw new Error("Failed to validate accessibility");
	}
}

// ============================================================================
// Table of Contents & Lists Generation
// ============================================================================

/**
 * Generates a table of contents from document headings.
 *
 * @param documentId - The document ID
 * @returns Hierarchical TOC entries with page numbers
 *
 * @example
 * ```typescript
 * const toc = await generateTOC("doc-uuid");
 * toc.forEach(entry => {
 *   console.log(`${"  ".repeat(entry.level - 1)}${entry.title} - Page ${entry.pageNumber}`);
 * });
 * ```
 */
export async function generateTOC(documentId: string): Promise<TOCEntry[]> {
	await requireUserContext();

	try {
		const [document] = await db
			.select()
			.from(documents)
			.where(eq(documents.id, documentId))
			.limit(1);

		if (!document) {
			throw new Error("Document not found");
		}

		const content = document.content as Record<string, unknown>;

		// Get format specs for page estimation
		const documentFormat = await getDocumentFormat(documentId);
		let wordsPerPage = 250;

		if (documentFormat?.templateId) {
			const template = await getFormatTemplateById(documentFormat.templateId);
			if (template) {
				const spacingMultiplier = 1 / (template.lineSpacing ?? 1.0);
				const fontMultiplier = 12 / (template.bodyFontSize ?? 12);
				wordsPerPage = 500 * spacingMultiplier * fontMultiplier;
			}
		}

		// Create page estimator function
		const pageEstimator = (charPosition: number): number => {
			const avgCharsPerWord = 5;
			const wordPosition = charPosition / avgCharsPerWord;
			return Math.max(1, Math.ceil(wordPosition / wordsPerPage));
		};

		const headings = extractHeadings(content, pageEstimator);

		// Clear existing TOC entries for this document
		await db
			.delete(tocEntries)
			.where(
				and(
					eq(tocEntries.documentId, documentId),
					eq(tocEntries.entryType, "section")
				)
			);

		// Store TOC entries in database
		const storedEntries: TOCEntry[] = [];
		let sortOrder = 0;

		for (const heading of headings) {
			const [row] = await db
				.insert(tocEntries)
				.values({
					documentId,
					entryType: heading.level === 1 ? "chapter" :
					           heading.level === 2 ? "section" : "subsection",
					title: heading.title,
					pageNumber: heading.pageNumber,
					level: heading.level,
					sortOrder: sortOrder++,
					isGenerated: true,
				})
				.returning();

			storedEntries.push(mapTocEntry(row));
		}

		// Build hierarchical structure
		const buildHierarchy = (
			entries: TOCEntry[],
			currentLevel: number = 1
		): TOCEntry[] => {
			const result: TOCEntry[] = [];
			let i = 0;

			while (i < entries.length) {
				const entry = entries[i];

				if (entry.level === currentLevel) {
					// Find children
					const children: TOCEntry[] = [];
					let j = i + 1;

					while (j < entries.length && entries[j].level > currentLevel) {
						children.push(entries[j]);
						j++;
					}

					result.push({
						...entry,
						children: children.length > 0
							? buildHierarchy(children, currentLevel + 1)
							: undefined,
					});

					i = j;
				} else {
					i++;
				}
			}

			return result;
		};

		return buildHierarchy(storedEntries);
	} catch (error) {
		logger.error("Error generating TOC:", error);
		throw new Error("Failed to generate table of contents");
	}
}

/**
 * Generates a list of figures from document images.
 *
 * @param documentId - The document ID
 * @returns List of figures with captions and page numbers
 *
 * @example
 * ```typescript
 * const figures = await generateListOfFigures("doc-uuid");
 * ```
 */
export async function generateListOfFigures(documentId: string): Promise<TOCEntry[]> {
	await requireUserContext();

	try {
		const [document] = await db
			.select()
			.from(documents)
			.where(eq(documents.id, documentId))
			.limit(1);

		if (!document) {
			throw new Error("Document not found");
		}

		const content = document.content as Record<string, unknown>;

		// Simple page estimator
		const pageEstimator = (charPosition: number): number => {
			return Math.max(1, Math.ceil(charPosition / 2500));
		};

		const figures = extractFigures(content, pageEstimator);

		// Clear existing figure entries for this document
		await db
			.delete(tocEntries)
			.where(
				and(
					eq(tocEntries.documentId, documentId),
					eq(tocEntries.entryType, "figure")
				)
			);

		// Store figure entries in database
		const storedEntries: TOCEntry[] = [];
		let sortOrder = 0;
		let figureNumber = 1;

		for (const figure of figures) {
			const [row] = await db
				.insert(tocEntries)
				.values({
					documentId,
					entryType: "figure",
					title: figure.title,
					pageNumber: figure.pageNumber,
					level: 1,
					sortOrder: sortOrder++,
					figureTableNumber: `Figure ${figureNumber++}`,
					isGenerated: true,
				})
				.returning();

			storedEntries.push(mapTocEntry(row));
		}

		return storedEntries;
	} catch (error) {
		logger.error("Error generating list of figures:", error);
		throw new Error("Failed to generate list of figures");
	}
}

/**
 * Generates a list of tables from document content.
 *
 * @param documentId - The document ID
 * @returns List of tables with captions and page numbers
 *
 * @example
 * ```typescript
 * const tables = await generateListOfTables("doc-uuid");
 * ```
 */
export async function generateListOfTables(documentId: string): Promise<TOCEntry[]> {
	await requireUserContext();

	try {
		const [document] = await db
			.select()
			.from(documents)
			.where(eq(documents.id, documentId))
			.limit(1);

		if (!document) {
			throw new Error("Document not found");
		}

		const content = document.content as Record<string, unknown>;

		// Simple page estimator
		const pageEstimator = (charPosition: number): number => {
			return Math.max(1, Math.ceil(charPosition / 2500));
		};

		const tables = extractTables(content, pageEstimator);

		// Clear existing table entries for this document
		await db
			.delete(tocEntries)
			.where(
				and(
					eq(tocEntries.documentId, documentId),
					eq(tocEntries.entryType, "table")
				)
			);

		// Store table entries in database
		const storedEntries: TOCEntry[] = [];
		let sortOrder = 0;
		let tableNumber = 1;

		for (const table of tables) {
			const [row] = await db
				.insert(tocEntries)
				.values({
					documentId,
					entryType: "table",
					title: table.title,
					pageNumber: table.pageNumber,
					level: 1,
					sortOrder: sortOrder++,
					figureTableNumber: `Table ${tableNumber++}`,
					isGenerated: true,
				})
				.returning();

			storedEntries.push(mapTocEntry(row));
		}

		return storedEntries;
	} catch (error) {
		logger.error("Error generating list of tables:", error);
		throw new Error("Failed to generate list of tables");
	}
}

/**
 * Generates an acronym glossary from document content.
 * Extracts acronyms and their definitions from patterns like "Full Name (FN)".
 *
 * @param documentId - The document ID
 * @returns Alphabetically sorted list of acronyms with definitions
 *
 * @example
 * ```typescript
 * const acronyms = await generateAcronymList("doc-uuid");
 * acronyms.forEach(a => {
 *   console.log(`${a.acronym}: ${a.definition || "Definition needed"}`);
 * });
 * ```
 */
export async function generateAcronymList(
	documentId: string
): Promise<{ acronym: string; definition: string; firstOccurrence: number }[]> {
	await requireUserContext();

	try {
		const [document] = await db
			.select()
			.from(documents)
			.where(eq(documents.id, documentId))
			.limit(1);

		if (!document) {
			throw new Error("Document not found");
		}

		const content = document.content as Record<string, unknown>;
		const acronyms = extractAcronyms(content);

		// Clear existing acronym entries for this document
		await db
			.delete(tocEntries)
			.where(
				and(
					eq(tocEntries.documentId, documentId),
					eq(tocEntries.entryType, "acronym")
				)
			);

		// Store acronym entries in database
		let sortOrder = 0;
		for (const item of acronyms) {
			await db
				.insert(tocEntries)
				.values({
					documentId,
					entryType: "acronym",
					title: item.acronym,
					shortTitle: item.definition || null,
					level: 1,
					sortOrder: sortOrder++,
					isGenerated: true,
				});
		}

		return acronyms;
	} catch (error) {
		logger.error("Error generating acronym list:", error);
		throw new Error("Failed to generate acronym list");
	}
}

// ============================================================================
// Header & Footer Operations
// ============================================================================

/**
 * Applies header and footer settings to a document.
 *
 * @param documentId - The document ID
 * @param settings - Header and footer configuration
 *
 * @example
 * ```typescript
 * await applyHeaderFooter("doc-uuid", {
 *   headerFormat: {
 *     enabled: true,
 *     centerContent: "COMPANY CONFIDENTIAL",
 *   },
 *   footerFormat: {
 *     enabled: true,
 *     centerContent: "Page {page_number}",
 *   },
 * });
 * ```
 */
export async function applyHeaderFooter(
	documentId: string,
	settings: HeaderFooterSettings
): Promise<void> {
	const userContext = await requireUserContext();

	try {
		// Get or create document format
		const [existingFormat] = await db
			.select()
			.from(documentFormats)
			.where(eq(documentFormats.documentId, documentId))
			.limit(1);

		// Build custom settings with header/footer overrides
		const customSettings: CustomFormatSettings = {
			headerFormat: settings.headerFormat,
			footerFormat: settings.footerFormat,
			pageNumberFormat: settings.pageNumberFormat,
		};

		if (existingFormat) {
			// Check if locked
			if (existingFormat.isLocked) {
				throw new Error("Document format is locked and cannot be changed");
			}

			// Merge with existing overrides
			const mergedOverrides: CustomFormatSettings = {
				...(existingFormat.overrides ?? {}),
				...customSettings,
			};

			await db
				.update(documentFormats)
				.set({
					overrides: mergedOverrides,
					hasOverrides: true,
					updatedAt: new Date(),
				})
				.where(eq(documentFormats.id, existingFormat.id));
		} else {
			// Create a basic format record for header/footer only
			await db
				.insert(documentFormats)
				.values({
					documentId,
					overrides: customSettings,
					hasOverrides: true,
					appliedBy: userContext.userId,
				});
		}
	} catch (error) {
		logger.error("Error applying header/footer:", error);
		throw new Error("Failed to apply header/footer settings");
	}
}

/**
 * Gets the current header and footer settings for a document.
 *
 * @param documentId - The document ID
 * @returns Header/footer settings or null if none applied
 *
 * @example
 * ```typescript
 * const settings = await getHeaderFooterSettings("doc-uuid");
 * if (settings?.headerFormat) {
 *   console.log(`Header center: ${settings.headerFormat.centerContent}`);
 * }
 * ```
 */
export async function getHeaderFooterSettings(
	documentId: string
): Promise<HeaderFooterSettings | null> {
	await requireUserContext();

	try {
		const format = await getDocumentFormat(documentId);
		if (!format) return null;

		// Get settings from template and/or overrides
		let headerFormat: HeaderFormat | undefined;
		let footerFormat: FooterFormat | undefined;
		let pageNumberFormat: PageNumberFormat | undefined;

		// Load template settings first
		if (format.templateId) {
			const template = await getFormatTemplateById(format.templateId);
			if (template) {
				headerFormat = template.headerFormat ?? undefined;
				footerFormat = template.footerFormat ?? undefined;
				pageNumberFormat = template.pageNumberFormat ?? undefined;
			}
		}

		// Override with document-specific settings
		if (format.overrides) {
			if (format.overrides.headerFormat) {
				headerFormat = { ...headerFormat, ...format.overrides.headerFormat } as HeaderFormat;
			}
			if (format.overrides.footerFormat) {
				footerFormat = { ...footerFormat, ...format.overrides.footerFormat } as FooterFormat;
			}
			if (format.overrides.pageNumberFormat) {
				pageNumberFormat = { ...pageNumberFormat, ...format.overrides.pageNumberFormat } as PageNumberFormat;
			}
		}

		if (!headerFormat && !footerFormat && !pageNumberFormat) {
			return null;
		}

		return { headerFormat, footerFormat, pageNumberFormat };
	} catch (error) {
		logger.error("Error getting header/footer settings:", error);
		throw new Error("Failed to get header/footer settings");
	}
}

// ============================================================================
// Agency-Specific Operations
// ============================================================================

/**
 * Applies agency-specific formatting to a document and validates compliance.
 * Combines template application with immediate validation.
 *
 * @param documentId - The document ID
 * @param agencyCode - The agency code (e.g., "DOD", "GSA")
 * @returns Validation result after applying formatting
 *
 * @example
 * ```typescript
 * const result = await formatForAgency("doc-uuid", "DOD");
 * if (result.isValid) {
 *   console.log("Document is DoD compliant!");
 * }
 * ```
 */
export async function formatForAgency(
	documentId: string,
	agencyCode: string
): Promise<FormatValidationResult> {
	await requireUserContext();

	try {
		// Get agency template
		const template = await getFormatTemplateByAgency(agencyCode);
		if (!template) {
			throw new Error(`No format template found for agency: ${agencyCode}`);
		}

		// Apply template
		await applyFormatTemplate(documentId, template.id);

		// Validate and return result
		return await validateFormatCompliance(documentId);
	} catch (error) {
		logger.error("Error formatting for agency:", error);
		throw new Error(`Failed to format document for agency: ${agencyCode}`);
	}
}

/**
 * Gets the formatting requirements for a specific agency.
 *
 * @param agencyCode - The agency code
 * @returns The agency's format template or null
 *
 * @example
 * ```typescript
 * const requirements = await getAgencyFormattingRequirements("NASA");
 * if (requirements && requirements.pageLimits) {
 *   console.log(`NASA page limits: ${JSON.stringify(requirements.pageLimits)}`);
 * }
 * ```
 */
export async function getAgencyFormattingRequirements(
	agencyCode: string
): Promise<FormatTemplate | null> {
	await requireUserContext();

	return await getFormatTemplateByAgency(agencyCode);
}

// ============================================================================
// Export Operations
// ============================================================================

/**
 * Exports a formatted document to PDF or DOCX.
 * Applies all formatting settings and generates a compliant output file.
 *
 * @param documentId - The document ID
 * @param format - Export format ("pdf" or "docx")
 * @returns URL and filename for download
 *
 * @example
 * ```typescript
 * const { url, filename } = await exportFormattedDocument("doc-uuid", "pdf");
 * console.log(`Download: ${url}`);
 * ```
 */
export async function exportFormattedDocument(
	documentId: string,
	format: "pdf" | "docx"
): Promise<{ url: string; filename: string }> {
	await requireUserContext();

	try {
		// Get document
		const [document] = await db
			.select()
			.from(documents)
			.where(eq(documents.id, documentId))
			.limit(1);

		if (!document) {
			throw new Error("Document not found");
		}

		// Get applied format
		const documentFormat = await getDocumentFormat(documentId);

		// Generate filename
		const sanitizedTitle = document.title
			.replace(/[^a-zA-Z0-9\s-]/g, "")
			.replace(/\s+/g, "-")
			.substring(0, 50);
		const timestamp = new Date().toISOString().split("T")[0];
		const filename = `${sanitizedTitle}-${timestamp}.${format}`;

		// Generate export URL
		// In production, this would trigger actual document generation
		const exportParams = new URLSearchParams({
			documentId,
			format,
			filename,
			templateId: documentFormat?.templateId ?? "",
		});

		const url = `/api/documents/export?${exportParams.toString()}`;

		return { url, filename };
	} catch (error) {
		logger.error("Error exporting formatted document:", error);
		throw new Error("Failed to export formatted document");
	}
}

// ============================================================================
// Format Preset Operations
// ============================================================================

/**
 * Saves a custom format preset for reuse.
 *
 * @param name - Preset name
 * @param customSettings - Format settings to save
 * @param baseTemplateId - Optional base template ID
 * @returns The created preset
 *
 * @example
 * ```typescript
 * const preset = await saveFormatPreset(
 *   "My Custom Format",
 *   { bodyFont: "Arial", bodyFontSize: 11 },
 *   "base-template-uuid"
 * );
 * ```
 */
export async function saveFormatPreset(
	name: string,
	customSettings: CustomFormatSettings,
	baseTemplateId?: string
): Promise<FormatPreset> {
	const userContext = await requireFormattingContext();

	if (!name || name.trim().length === 0) {
		throw new Error("Preset name is required");
	}

	// Validate settings
	const validationResult = customFormatSettingsSchema.safeParse(customSettings);
	if (!validationResult.success) {
		throw new Error(`Invalid settings: ${validationResult.error.message}`);
	}

	try {
		const [row] = await db
			.insert(formatPresets)
			.values({
				name: name.trim(),
				description: null,
				baseTemplateId: baseTemplateId ?? null,
				customSettings: validationResult.data,
				userId: userContext.userId,
				organizationId: userContext.organizationId,
				isShared: false,
			})
			.returning();

		return mapFormatPreset(row);
	} catch (error) {
		logger.error("Error saving format preset:", error);
		throw new Error("Failed to save format preset");
	}
}

/**
 * Gets all format presets available to the current user.
 *
 * @returns Array of format presets
 *
 * @example
 * ```typescript
 * const presets = await getFormatPresets();
 * ```
 */
export async function getFormatPresets(): Promise<FormatPreset[]> {
	const userContext = await requireFormattingContext();

	try {
		// Get user's own presets and shared presets from their organization
		const rows = await db
			.select()
			.from(formatPresets)
			.where(
				and(
					eq(formatPresets.isActive, true),
					or(
						and(
							eq(formatPresets.userId, userContext.userId),
							eq(formatPresets.organizationId, userContext.organizationId)
						),
						and(
							eq(formatPresets.isShared, true),
							or(
								eq(formatPresets.organizationId, userContext.organizationId),
								eq(formatPresets.isPublic, true)
							)
						)
					)
				)
			)
			.orderBy(desc(formatPresets.updatedAt));

		return rows.map(mapFormatPreset);
	} catch (error) {
		logger.error("Error fetching format presets:", error);
		throw new Error("Failed to fetch format presets");
	}
}

/**
 * Deletes a format preset.
 *
 * @param id - The preset ID
 *
 * @example
 * ```typescript
 * await deleteFormatPreset("preset-uuid");
 * ```
 */
export async function deleteFormatPreset(id: string): Promise<void> {
	const userContext = await requireFormattingContext();

	try {
		// Verify ownership
		const [preset] = await db
			.select()
			.from(formatPresets)
			.where(and(
				eq(formatPresets.id, id),
				eq(formatPresets.userId, userContext.userId),
				eq(formatPresets.organizationId, userContext.organizationId)
			))
			.limit(1);

		if (!preset) {
			throw new Error("Format preset not found");
		}

		// Soft delete by setting isActive to false
		await db
			.update(formatPresets)
			.set({
				isActive: false,
				updatedAt: new Date(),
			})
			.where(and(
				eq(formatPresets.id, id),
				eq(formatPresets.userId, userContext.userId),
				eq(formatPresets.organizationId, userContext.organizationId)
			));
	} catch (error) {
		logger.error("Error deleting format preset:", error);
		throw new Error("Failed to delete format preset");
	}
}

/**
 * Applies a format preset to a document.
 * Merges preset settings with any base template settings.
 *
 * @param documentId - The document ID
 * @param presetId - The preset ID
 * @returns The applied document format
 *
 * @example
 * ```typescript
 * const format = await applyFormatPreset("doc-uuid", "preset-uuid");
 * ```
 */
export async function applyFormatPreset(
	documentId: string,
	presetId: string
): Promise<DocumentFormat> {
	const userContext = await requireFormattingContext();

	try {
		// Get preset
		const [preset] = await db
			.select()
			.from(formatPresets)
			.where(and(
				eq(formatPresets.id, presetId),
				or(
					and(
						eq(formatPresets.userId, userContext.userId),
						eq(formatPresets.organizationId, userContext.organizationId)
					),
					and(
						eq(formatPresets.isShared, true),
						or(
							eq(formatPresets.organizationId, userContext.organizationId),
							eq(formatPresets.isPublic, true)
						)
					)
				)
			))
			.limit(1);

		if (!preset) {
			throw new Error("Format preset not found");
		}

		if (!preset.isActive) {
			throw new Error("Format preset is no longer active");
		}

		// If preset has a base template, apply that first
		if (preset.baseTemplateId) {
			await applyFormatTemplate(documentId, preset.baseTemplateId);
		}

		// Apply preset overrides
		const [existingFormat] = await db
			.select()
			.from(documentFormats)
			.where(eq(documentFormats.documentId, documentId))
			.limit(1);

		let row: DocumentFormatRow;

		if (existingFormat) {
			// Check if locked
			if (existingFormat.isLocked) {
				throw new Error("Document format is locked and cannot be changed");
			}

			// Merge preset settings as overrides
			const mergedOverrides: CustomFormatSettings = {
				...(existingFormat.overrides ?? {}),
				...preset.customSettings,
			};

			[row] = await db
				.update(documentFormats)
				.set({
					overrides: mergedOverrides,
					hasOverrides: true,
					isValid: null,
					lastValidationId: null,
					lastValidatedAt: null,
					updatedAt: new Date(),
				})
				.where(eq(documentFormats.id, existingFormat.id))
				.returning();
		} else {
			// Create new format with preset settings
			[row] = await db
				.insert(documentFormats)
				.values({
					documentId,
					templateId: preset.baseTemplateId,
					overrides: preset.customSettings,
					hasOverrides: true,
					appliedBy: userContext.userId,
				})
				.returning();
		}

		// Update preset usage stats
		await db
			.update(formatPresets)
			.set({
				useCount: sql`${formatPresets.useCount} + 1`,
				lastUsedAt: new Date(),
			})
			.where(and(
				eq(formatPresets.id, presetId),
				or(
					and(
						eq(formatPresets.userId, userContext.userId),
						eq(formatPresets.organizationId, userContext.organizationId)
					),
					and(
						eq(formatPresets.isShared, true),
						or(
							eq(formatPresets.organizationId, userContext.organizationId),
							eq(formatPresets.isPublic, true)
						)
					)
				)
			));

		return mapDocumentFormat(row);
	} catch (error) {
		logger.error("Error applying format preset:", error);
		throw new Error("Failed to apply format preset");
	}
}
