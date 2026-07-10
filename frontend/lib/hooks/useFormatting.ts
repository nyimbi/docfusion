/**
 * Formatting Hooks
 *
 * React hooks for document formatting operations that wrap server actions
 * and provide consistent types for the formatting components.
 */

"use client";

import * as React from "react";
import type {
	FormatTemplate,
	FormatValidationResult,
	AccessibilityResult,
	PageCountInfo,
	TOCEntry,
	HeaderFooterSettings,
	FormatIssue,
	TOCConfig,
	WCAGLevel,
	FigureEntry,
	TableEntry,
	AcronymEntry,
} from "@/lib/types/formatting";

import {
	getFormatTemplates as getTemplatesAction,
	getFormatTemplateById,
	applyFormatTemplate as applyTemplateAction,
	validateFormatCompliance,
	validateAccessibility,
	checkPageCount,
	generateTOC,
	generateListOfFigures,
	generateListOfTables,
	generateAcronymList,
	getHeaderFooterSettings as getHeaderFooterAction,
	applyHeaderFooter,
	type FormatTemplate as ServerFormatTemplate,
	type FormatValidationResult as ServerValidationResult,
	type TOCEntry as ServerTOCEntry,
	type HeaderFooterSettings as ServerHeaderFooterSettings,
	type AccessibilityIssue as ServerAccessibilityIssue,
} from "@/lib/actions/formatting";

const FORMAT_PREVIEW_SAMPLE_TEXT =
	"DocFusion prepares a compliant proposal response with clear executive themes, measurable delivery milestones, and evidence-backed differentiators for the reviewing agency.";

// =============================================================================
// Type Adapters
// =============================================================================

/**
 * Converts server format template to client format template type.
 */
function adaptFormatTemplate(template: ServerFormatTemplate): FormatTemplate {
	const agencyCode = (template.agencyCode || "other").toLowerCase();

	return {
		id: template.id,
		name: template.name,
		description: template.description || "",
		agency: agencyCode as FormatTemplate["agency"],
		agencySubtype: template.subAgency || undefined,
		regulationReference: undefined,
		pageSize: (template.pageSize as FormatTemplate["pageSize"]) || "letter",
		margins: template.margins ? {
			top: template.margins.top,
			bottom: template.margins.bottom,
			left: template.margins.left,
			right: template.margins.right,
			gutter: template.margins.gutter,
		} : { top: 1, bottom: 1, left: 1, right: 1 },
		font: {
			family: (template.bodyFont?.toLowerCase().replace(/\s+/g, "-") || "times-new-roman") as FormatTemplate["font"]["family"],
			size: template.bodyFontSize || 12,
		},
		lineSpacing: template.lineSpacing === 1 ? "single" :
			template.lineSpacing === 1.5 ? "1.5" :
			template.lineSpacing === 2 ? "double" : "1.15",
		maxPages: template.pageLimits?.[0]?.limit || undefined,
		requiresPageNumbers: true,
		requiresTOC: true,
		requiresListOfFigures: true,
		requiresListOfTables: true,
		requiresAcronymList: true,
		requiresCrossReferences: true,
		section508Required: template.requiresAccessibility || false,
		targetWCAGLevel: (template.accessibilityLevel as WCAGLevel) || undefined,
		isBuiltIn: template.isSystem || false,
		createdAt: template.createdAt,
		updatedAt: template.updatedAt,
	};
}

/**
 * Converts server validation result to client validation result type.
 */
function adaptValidationResult(result: ServerValidationResult, documentId: string): FormatValidationResult {
	return {
		id: `val-${Date.now()}`,
		documentId,
		templateId: "",
		score: result.overallScore,
		categoryScores: {
			"page-limit": result.pageCountValid ? 100 : 50,
			margins: result.marginCompliance ? 100 : 50,
			font: result.fontCompliance ? 100 : 50,
			spacing: result.spacingCompliance ? 100 : 50,
			headers: result.headerCompliance ? 100 : 50,
			"page-numbers": 100,
			accessibility: result.accessibilityScore,
			structure: 100,
			figures: 100,
			tables: 100,
			"cross-references": 100,
			consistency: 100,
			compliance: result.isValid ? 100 : 50,
		},
		issues: result.issues.map((issue, idx) => ({
			id: `iss-${idx}`,
			severity: issue.severity === "critical" ? "critical" :
				issue.severity === "major" ? "major" : "minor",
			category: issue.type as FormatIssue["category"],
			title: issue.message.split(":")[0] || issue.message,
			description: issue.message,
			location: issue.location ? { section: issue.location } : undefined,
			suggestion: issue.suggestion,
			autoFixable: issue.autoFixable || false,
		})),
		issueCounts: {
			critical: result.issues.filter(i => i.severity === "critical").length,
			major: result.issues.filter(i => i.severity === "major").length,
			minor: result.issues.filter(i => i.severity === "minor" || i.severity === "info").length,
		},
		validatedAt: result.validatedAt,
	};
}

/**
 * Converts server TOC entry to client TOC entry type.
 */
function adaptTOCEntry(entry: ServerTOCEntry): TOCEntry {
	// Map server entry types to client types
	const typeMap: Record<string, TOCEntry["type"]> = {
		chapter: "heading",
		section: "heading",
		subsection: "heading",
		figure: "figure",
		table: "table",
		acronym: "heading",
		appendix: "heading",
		attachment: "heading",
		exhibit: "heading",
	};

	return {
		id: entry.id,
		type: typeMap[entry.entryType] || "heading",
		text: entry.title,
		page: entry.pageNumber || 0,
		level: entry.level as TOCEntry["level"],
		sectionNumber: entry.sectionNumber || undefined,
		targetId: entry.anchorId || entry.id,
		children: entry.children?.map(adaptTOCEntry),
	};
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook for fetching format templates.
 */
export function useFormatTemplates() {
	const [templates, setTemplates] = React.useState<FormatTemplate[]>([]);
	const [isLoading, setIsLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	const fetchTemplates = React.useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const serverTemplates = await getTemplatesAction();
			setTemplates(serverTemplates.map(adaptFormatTemplate));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch templates");
		}

		setIsLoading(false);
	}, []);

	React.useEffect(() => {
		fetchTemplates();
	}, [fetchTemplates]);

	return { templates, isLoading, error, refetch: fetchTemplates };
}

/**
 * Hook for applying a format template.
 */
export function useApplyFormatTemplate() {
	const [isApplying, setIsApplying] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const apply = React.useCallback(async (documentId: string, templateId: string) => {
		setIsApplying(true);
		setError(null);

		try {
			await applyTemplateAction(documentId, templateId);
			setIsApplying(false);
			return true;
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to apply template");
			setIsApplying(false);
			return false;
		}
	}, []);

	return { apply, isApplying, error };
}

/**
 * Hook for validating document format.
 */
export function useFormatValidation(documentId: string) {
	const [result, setResult] = React.useState<FormatValidationResult | null>(null);
	const [isValidating, setIsValidating] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	const validate = React.useCallback(async () => {
		setIsValidating(true);
		setError(null);

		try {
			const serverResult = await validateFormatCompliance(documentId);
			setResult(adaptValidationResult(serverResult, documentId));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Validation failed");
		}

		setIsValidating(false);
	}, [documentId]);

	React.useEffect(() => {
		validate();
	}, [validate]);

	return { result, isValidating, error, revalidate: validate };
}

/**
 * Hook for accessibility checking.
 */
export function useAccessibilityCheck(documentId: string, targetLevel: WCAGLevel = "AA") {
	const [result, setResult] = React.useState<AccessibilityResult | null>(null);
	const [isChecking, setIsChecking] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	const check = React.useCallback(async () => {
		setIsChecking(true);
		setError(null);

		try {
			const serverResult = await validateAccessibility(documentId);

			// Adapt server result to client type
			const clientResult: AccessibilityResult = {
				documentId,
				score: serverResult.score,
				achievedLevel: serverResult.level === "Non-compliant" ? null : serverResult.level as WCAGLevel,
				targetLevel,
				section508Compliant: serverResult.score >= 85,
				issuesByCategory: {
					images: [],
					color: [],
					navigation: [],
					tables: [],
					forms: [],
					multimedia: [],
					documents: [],
					keyboard: [],
					timing: [],
				},
				issueCounts: {
					critical: serverResult.issues.filter(i => i.impact === "critical").length,
					serious: serverResult.issues.filter(i => i.impact === "serious").length,
					moderate: serverResult.issues.filter(i => i.impact === "moderate").length,
					minor: serverResult.issues.filter(i => i.impact === "minor").length,
				},
				categoryScores: {
					images: 100,
					color: 100,
					navigation: 100,
					tables: 100,
					forms: 100,
					multimedia: 100,
					documents: 100,
					keyboard: 100,
					timing: 100,
				},
				checkedAt: new Date().toISOString(),
			};

			// Populate issues by category
			serverResult.issues.forEach((issue: ServerAccessibilityIssue, idx: number) => {
				const criterion = issue.criterion || "";
				const category = criterion.startsWith("1.1") ? "images" :
					criterion.startsWith("1.4") ? "color" :
					criterion.startsWith("2.4") ? "navigation" :
					criterion.startsWith("1.3") ? "documents" : "documents";

				const categoryKey = category as keyof typeof clientResult.issuesByCategory;
				if (clientResult.issuesByCategory[categoryKey]) {
					clientResult.issuesByCategory[categoryKey].push({
						id: `a11y-${idx}`,
						category: categoryKey,
						wcagCriterion: criterion,
						wcagLevel: "A",
						title: issue.description,
						description: issue.description,
						remediation: issue.remediation || "",
						impact: issue.impact as AccessibilityResult["issuesByCategory"]["images"][0]["impact"],
					});
				}
			});

			setResult(clientResult);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Accessibility check failed");
		}

		setIsChecking(false);
	}, [documentId, targetLevel]);

	React.useEffect(() => {
		check();
	}, [check]);

	return { result, isChecking, error, recheck: check };
}

/**
 * Hook for page count tracking.
 */
export function usePageCount(documentId: string) {
	const [pageInfo, setPageInfo] = React.useState<PageCountInfo | null>(null);
	const [isLoading, setIsLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	const fetch = React.useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const serverResult = await checkPageCount(documentId);

			const clientResult: PageCountInfo = {
				documentId,
				totalPages: serverResult.current,
				maxPages: serverResult.limit || undefined,
				percentUsed: serverResult.limit ? (serverResult.current / serverResult.limit) * 100 : 0,
				status: serverResult.isValid ? "ok" : serverResult.current > (serverResult.limit || Infinity) ? "exceeded" : "warning",
				volumeBreakdown: serverResult.byVolume
					? Object.entries(serverResult.byVolume).map(([name, vol], idx) => ({
							volumeName: name,
							volumeNumber: idx + 1,
							currentPages: vol.current,
							maxPages: vol.limit,
							percentUsed: (vol.current / vol.limit) * 100,
							status: vol.isValid ? "ok" as const : vol.current > vol.limit ? "exceeded" as const : "warning" as const,
						}))
					: undefined,
				excludedPages: 0,
				countablePages: serverResult.current,
				updatedAt: new Date().toISOString(),
			};

			setPageInfo(clientResult);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to get page count");
		}

		setIsLoading(false);
	}, [documentId]);

	React.useEffect(() => {
		fetch();
	}, [fetch]);

	return { pageInfo, isLoading, error, refetch: fetch };
}

/**
 * Hook for TOC generation.
 */
export function useTOCGenerator(documentId: string) {
	const [entries, setEntries] = React.useState<TOCEntry[]>([]);
	const [isGenerating, setIsGenerating] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const generate = React.useCallback(async (_config?: TOCConfig) => {
		setIsGenerating(true);
		setError(null);

		try {
			const serverEntries = await generateTOC(documentId);
			setEntries(serverEntries.map(adaptTOCEntry));
		} catch (err) {
			setError(err instanceof Error ? err.message : "TOC generation failed");
		}

		setIsGenerating(false);
	}, [documentId]);

	return { entries, isGenerating, error, generate };
}

/**
 * Hook for list generation.
 */
export function useListGenerator(documentId: string) {
	const [figures, setFigures] = React.useState<FigureEntry[]>([]);
	const [tables, setTables] = React.useState<TableEntry[]>([]);
	const [acronyms, setAcronyms] = React.useState<AcronymEntry[]>([]);
	const [isGenerating, setIsGenerating] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const generate = React.useCallback(async (types: Array<"figures" | "tables" | "acronyms">) => {
		setIsGenerating(true);
		setError(null);

		try {
			if (types.includes("figures")) {
				const serverFigures = await generateListOfFigures(documentId);
				setFigures(serverFigures.map((f, idx) => ({
					id: f.id,
					number: String(idx + 1),
					title: f.title,
					page: f.pageNumber || 0,
					targetId: f.id,
				})));
			}

			if (types.includes("tables")) {
				const serverTables = await generateListOfTables(documentId);
				setTables(serverTables.map((t, idx) => ({
					id: t.id,
					number: String(idx + 1),
					title: t.title,
					page: t.pageNumber || 0,
					targetId: t.id,
				})));
			}

			if (types.includes("acronyms")) {
				const serverAcronyms = await generateAcronymList(documentId);
				setAcronyms(serverAcronyms.map((a, idx) => ({
					id: `acr-${idx}`,
					acronym: a.acronym,
					definition: a.definition,
					firstPage: Math.ceil(a.firstOccurrence / 2500),
				})));
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "List generation failed");
		}

		setIsGenerating(false);
	}, [documentId]);

	return { figures, tables, acronyms, isGenerating, error, generate };
}

/**
 * Hook for header/footer settings.
 */
export function useHeaderFooter(documentId: string) {
	const [settings, setSettings] = React.useState<HeaderFooterSettings | null>(null);
	const [isLoading, setIsLoading] = React.useState(true);
	const [isSaving, setIsSaving] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const fetch = React.useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const serverSettings = await getHeaderFooterAction(documentId);

			if (serverSettings) {
				// Adapt server settings to client type
				const headerFormat = serverSettings.headerFormat;
				const footerFormat = serverSettings.footerFormat;

				const clientSettings: HeaderFooterSettings = {
					header: [
						{ position: "left", content: headerFormat?.leftContent || "" },
						{ position: "center", content: headerFormat?.centerContent || "" },
						{ position: "right", content: headerFormat?.rightContent || "" },
					],
					footer: [
						{ position: "left", content: footerFormat?.leftContent || "" },
						{ position: "center", content: footerFormat?.centerContent || "" },
						{ position: "right", content: footerFormat?.rightContent || "" },
					],
					pageNumberFormat: serverSettings.pageNumberFormat?.style === "roman_lower" ? "roman-lower" :
						serverSettings.pageNumberFormat?.style === "roman_upper" ? "roman-upper" :
						serverSettings.pageNumberFormat?.style === "alpha_lower" ? "alpha-lower" :
						serverSettings.pageNumberFormat?.style === "alpha_upper" ? "alpha-upper" : "arabic",
					startPageNumber: serverSettings.pageNumberFormat?.startAt || 1,
					differentFirstPage: headerFormat?.differentFirstPage || footerFormat?.differentFirstPage || false,
				};
				setSettings(clientSettings);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load settings");
		}

		setIsLoading(false);
	}, [documentId]);

	const save = React.useCallback(async (newSettings: HeaderFooterSettings) => {
		setIsSaving(true);
		setError(null);

		try {
			// Adapt client settings to server type
			const serverSettings: ServerHeaderFooterSettings = {
				headerFormat: {
					enabled: true,
					leftContent: newSettings.header.find(h => h.position === "left")?.content,
					centerContent: newSettings.header.find(h => h.position === "center")?.content,
					rightContent: newSettings.header.find(h => h.position === "right")?.content,
					differentFirstPage: newSettings.differentFirstPage,
				},
				footerFormat: {
					enabled: true,
					leftContent: newSettings.footer.find(f => f.position === "left")?.content,
					centerContent: newSettings.footer.find(f => f.position === "center")?.content,
					rightContent: newSettings.footer.find(f => f.position === "right")?.content,
					differentFirstPage: newSettings.differentFirstPage,
				},
				pageNumberFormat: {
					style: newSettings.pageNumberFormat === "roman-lower" ? "roman_lower" :
						newSettings.pageNumberFormat === "roman-upper" ? "roman_upper" :
						newSettings.pageNumberFormat === "alpha-lower" ? "alpha_lower" :
						newSettings.pageNumberFormat === "alpha-upper" ? "alpha_upper" : "arabic",
					startAt: newSettings.startPageNumber || 1,
					position: "footer",
					alignment: "center",
				},
			};

			await applyHeaderFooter(documentId, serverSettings);
			setSettings(newSettings);
			setIsSaving(false);
			return true;
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save settings");
			setIsSaving(false);
			return false;
		}
	}, [documentId]);

	React.useEffect(() => {
		fetch();
	}, [fetch]);

	return { settings, isLoading, isSaving, error, save, refetch: fetch };
}

/**
 * Escapes generated preview content before embedding it as HTML.
 */
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/**
 * Converts template spacing settings to CSS line-height values.
 */
function lineHeightForSpacing(spacing: FormatTemplate["lineSpacing"]): string {
	switch (spacing) {
		case "single":
			return "1";
		case "1.5":
			return "1.5";
		case "double":
			return "2";
		default:
			return "1.15";
	}
}

/**
 * Builds deterministic HTML that applies selected format options to sample text.
 */
function buildFormatPreviewHtml(template: FormatTemplate | null): string {
	const sampleText = escapeHtml(FORMAT_PREVIEW_SAMPLE_TEXT.slice(0, 200));
	const fontFamily = template?.font.family.replace(/-/g, " ") || "Times New Roman";
	const fontSize = template?.font.size || 12;
	const lineHeight = lineHeightForSpacing(template?.lineSpacing || "1.15");
	const margins = template?.margins || { top: 1, bottom: 1, left: 1, right: 1 };
	const pageSize = template?.pageSize === "legal"
		? "US Legal"
		: template?.pageSize === "a4"
			? "A4"
			: "US Letter";
	const maxPages = template?.maxPages ? `${template.maxPages} page limit` : "No page limit configured";
	const templateName = escapeHtml(template?.name || "Default proposal format");
	const agency = escapeHtml((template?.agency || "other").toUpperCase());

	return [
		`<article style="font-family: '${fontFamily}', serif; font-size: ${fontSize}pt; line-height: ${lineHeight}; color: #111827;">`,
		`<h1 style="font-size: ${Math.round(fontSize * 1.35)}pt; margin: 0 0 ${fontSize}px; text-align: center;">${templateName}</h1>`,
		`<p style="margin: 0 0 ${fontSize}px; text-align: center; color: #4b5563;">${agency} format - ${pageSize} - margins ${margins.top}/${margins.right}/${margins.bottom}/${margins.left} in - ${maxPages}</p>`,
		`<h2 style="font-size: ${Math.round(fontSize * 1.12)}pt; margin: ${fontSize * 1.4}px 0 ${fontSize * 0.6}px;">Executive Summary</h2>`,
		`<p style="margin: 0 0 ${fontSize}px;">${sampleText}</p>`,
		`<ul style="margin: 0 0 0 ${fontSize * 1.5}px; padding: 0;">`,
		`<li>Typography, spacing, and page constraints are applied from the selected template.</li>`,
		`<li>Preview content is generated from a short proposal sample for fast client-side rendering.</li>`,
		`</ul>`,
		`</article>`,
	].join("");
}

/**
 * Hook for format preview.
 */
export function useFormatPreview(documentId: string, templateId?: string) {
	const [template, setTemplate] = React.useState<FormatTemplate | null>(null);
	const [previewHtml, setPreviewHtml] = React.useState(() => buildFormatPreviewHtml(null));
	const [totalPages, setTotalPages] = React.useState(1);
	const [isLoading, setIsLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [refreshToken, setRefreshToken] = React.useState(0);

	const refresh = React.useCallback(() => {
		setRefreshToken((value) => value + 1);
	}, []);

	React.useEffect(() => {
		async function load() {
			if (!templateId) {
				setTemplate(null);
				setPreviewHtml(buildFormatPreviewHtml(null));
				setTotalPages(1);
				setIsLoading(false);
				return;
			}

			setIsLoading(true);
			setError(null);

			try {
				const serverTemplate = await getFormatTemplateById(templateId);
				if (serverTemplate) {
					const clientTemplate = adaptFormatTemplate(serverTemplate);
					setTemplate(clientTemplate);
					setPreviewHtml(buildFormatPreviewHtml(clientTemplate));
					setTotalPages(Math.max(1, Math.min(clientTemplate.maxPages || 1, 3)));
				} else {
					setTemplate(null);
					setPreviewHtml(buildFormatPreviewHtml(null));
					setTotalPages(1);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load preview");
				setPreviewHtml(buildFormatPreviewHtml(null));
				setTotalPages(1);
			}

			setIsLoading(false);
		}

		load();
	}, [templateId, refreshToken]);

	return { template, previewHtml, totalPages, isLoading, error, refresh };
}
