/**
 * PPTX slide layout configuration constants.
 *
 * All hardcoded values extracted from pptx-converter.ts so that
 * slide appearance can be tuned from a single location.
 */

// ============================================================================
// Typography - font sizes used across slide types
// ============================================================================

export const PPTX_FONT_SIZES = {
	/** Default template title */
	title: 44,
	/** Executive template title */
	titleExecutive: 36,
	/** Technical template title */
	titleTechnical: 32,
	/** Minimal template title */
	titleMinimal: 40,
	/** Default / minimal body text */
	body: 18,
	/** Executive body text */
	bodyExecutive: 16,
	/** Technical body text */
	bodyTechnical: 14,
	/** Default / minimal bullet text */
	bullet: 16,
	/** Executive bullet text */
	bulletExecutive: 14,
	/** Technical bullet text */
	bulletTechnical: 12,
	/** Table cell text */
	tableCell: 12,
	/** Slide number and branding footer */
	footer: 10,
} as const;

/**
 * Per-template font size offsets applied to the title font size
 * when rendering section dividers, slide headings, etc.
 */
export const PPTX_TITLE_ADJUSTMENTS = {
	/** Section divider title is 4pt smaller than template title */
	sectionDividerOffset: 4,
	/** Content / bullet / table slide heading is 12pt smaller than template title */
	slideHeadingOffset: 12,
} as const;

// ============================================================================
// Colors (hex strings WITHOUT leading #)
// ============================================================================

export const PPTX_COLORS = {
	// Default template
	defaultPrimary: "363636",
	defaultSecondary: "666666",
	// Executive template
	executivePrimary: "1a365d",
	executiveSecondary: "4a5568",
	// Technical template
	technicalPrimary: "2d3748",
	technicalSecondary: "718096",
	// Minimal template
	minimalPrimary: "1a1a1a",
	minimalSecondary: "888888",
	// Shared element colors
	slideNumber: "999999",
	brandingFooter: "999999",
	// Table
	tableBorder: "CCCCCC",
	tableHeaderBackground: "2d3748",
	tableHeaderText: "FFFFFF",
} as const;

// ============================================================================
// Layout positions and dimensions (inches unless noted)
// ============================================================================

export const PPTX_LAYOUT = {
	/** Horizontal margin for all text boxes */
	marginX: 0.5,
	/** Text box width (percentage string consumed by pptxgenjs) */
	contentWidth: "90%",

	// Title slide
	titleY: "35%",
	titleHeight: 1.5,
	subtitleY: "55%",
	subtitleHeight: 0.75,

	// Section divider
	sectionY: "40%",
	sectionHeight: 1.5,

	// Content / bullet / table slides
	slideHeadingY: 0.5,
	slideHeadingHeight: 1,
	slideBodyY: 1.5,
	slideBodyHeight: 4,

	// Table
	tableWidth: 9,

	// Slide number
	slideNumberX: "90%",
	slideNumberY: "95%",
	slideNumberWidth: 0.5,
	slideNumberHeight: 0.25,

	// Branding footer
	brandingX: 0.5,
	brandingY: "95%",
	brandingWidth: 3,
	brandingHeight: 0.25,
} as const;

// ============================================================================
// Table styling
// ============================================================================

export const PPTX_TABLE = {
	borderWidth: 1,
	borderColor: PPTX_COLORS.tableBorder,
	fontFace: "Arial",
	fontSize: PPTX_FONT_SIZES.tableCell,
} as const;

// ============================================================================
// Template definitions — maps template name to its computed style values
// ============================================================================

export type PptxTemplateName = "default" | "executive" | "technical" | "minimal";

export interface PptxTemplateStyle {
	titleFontSize: number;
	bodyFontSize: number;
	bulletFontSize: number;
	primaryColor: string;
	secondaryColor: string;
}

/**
 * Resolve the template style, applying branding overrides when present.
 */
export function resolveTemplateStyle(
	templateName: PptxTemplateName,
	brandingPrimary?: string,
	brandingSecondary?: string,
): PptxTemplateStyle {
	const base = TEMPLATE_DEFAULTS[templateName] ?? TEMPLATE_DEFAULTS.default;
	return {
		...base,
		primaryColor: brandingPrimary || base.primaryColor,
		secondaryColor: brandingSecondary || base.secondaryColor,
	};
}

const TEMPLATE_DEFAULTS: Record<PptxTemplateName, PptxTemplateStyle> = {
	default: {
		titleFontSize: PPTX_FONT_SIZES.title,
		bodyFontSize: PPTX_FONT_SIZES.body,
		bulletFontSize: PPTX_FONT_SIZES.bullet,
		primaryColor: PPTX_COLORS.defaultPrimary,
		secondaryColor: PPTX_COLORS.defaultSecondary,
	},
	executive: {
		titleFontSize: PPTX_FONT_SIZES.titleExecutive,
		bodyFontSize: PPTX_FONT_SIZES.bodyExecutive,
		bulletFontSize: PPTX_FONT_SIZES.bulletExecutive,
		primaryColor: PPTX_COLORS.executivePrimary,
		secondaryColor: PPTX_COLORS.executiveSecondary,
	},
	technical: {
		titleFontSize: PPTX_FONT_SIZES.titleTechnical,
		bodyFontSize: PPTX_FONT_SIZES.bodyTechnical,
		bulletFontSize: PPTX_FONT_SIZES.bulletTechnical,
		primaryColor: PPTX_COLORS.technicalPrimary,
		secondaryColor: PPTX_COLORS.technicalSecondary,
	},
	minimal: {
		titleFontSize: PPTX_FONT_SIZES.titleMinimal,
		bodyFontSize: PPTX_FONT_SIZES.body,
		bulletFontSize: PPTX_FONT_SIZES.bullet,
		primaryColor: PPTX_COLORS.minimalPrimary,
		secondaryColor: PPTX_COLORS.minimalSecondary,
	},
};
