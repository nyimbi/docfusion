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
	TOCResult,
	ListsResult,
	HeaderFooterSettings,
	FormatPreviewResult,
	FormatIssue,
	TOCConfig,
	TOCEntry,
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
} from "@/lib/actions/formatting";

// =============================================================================
// Type Adapters
// =============================================================================

/**
 * Converts server format template to client format template type.
 */
function adaptFormatTemplate(template: ServerFormatTemplate): FormatTemplate {
	return {
		id: template.id,
		name: template.name,
		description: template.description || "",
		agency: template.agencyCode.toLowerCase() as FormatTemplate["agency"],
		agencySubtype: undefined,
		regulationReference: undefined,
		pageSize: "letter",
		margins: {
			top: template.marginSpecifications.top / 72,
			bottom: template.marginSpecifications.bottom / 72,
			left: template.marginSpecifications.left / 72,
			right: template.marginSpecifications.right / 72,
		},
		font: {
			family: template.fontSpecifications.primaryFont.toLowerCase().replace(/\s+/g, "-") as FormatTemplate["font"]["family"],
			size: template.fontSpecifications.baseFontSize,
		},
		lineSpacing: template.spacingSpecifications.lineSpacing === 1 ? "single" :
			template.spacingSpecifications.lineSpacing === 1.5 ? "1.5" :
			template.spacingSpecifications.lineSpacing === 2 ? "double" : "1.15",
		maxPages: template.pageLimits.totalPageLimit || undefined,
		requiresPageNumbers: true,
		requiresTOC: true,
		requiresListOfFigures: true,
		requiresListOfTables: true,
		requiresAcronymList: true,
		requiresCrossReferences: true,
		section508Required: template.accessibilityRequirements.section508Required,
		targetWCAGLevel: template.accessibilityRequirements.wcagLevel || undefined,
		isBuiltIn: true,
		createdAt: template.createdAt,
		updatedAt: template.updatedAt,
	};
}

/**
 * Converts server validation result to client validation result type.
 */
function adaptValidationResult(result: ServerValidationResult): FormatValidationResult {
	return {
		id: `val-${Date.now()}`,
		documentId: "", // Will be set by caller
		templateId: "",
		score: result.overallScore,
		categoryScores: {
			"page-limit": result.pageCountValid ? 100 : 50,
			margins: result.marginCompliance ? 100 : 50,
			font: result.fontCompliance ? 100 : 50,
			spacing: result.spacingCompliance ? 100 : 50,
			headers: 100,
			"page-numbers": 100,
			accessibility: result.accessibilityScore,
			structure: result.structureCompliance ? 100 : 50,
			figures: 100,
			tables: 100,
			"cross-references": 100,
			consistency: 100,
			compliance: result.isValid ? 100 : 50,
		},
		issues: result.issues.map((issue, idx) => ({
			id: `iss-${idx}`,
			severity: issue.severity === "error" ? "critical" : issue.severity === "warning" ? "major" : "minor",
			category: issue.type as FormatIssue["category"],
			title: issue.message.split(":")[0] || issue.message,
			description: issue.message,
			location: issue.location ? { section: issue.location } : undefined,
			suggestion: issue.suggestion,
			autoFixable: issue.autoFixable,
		})),
		issueCounts: {
			critical: result.issues.filter(i => i.severity === "error").length,
			major: result.issues.filter(i => i.severity === "warning").length,
			minor: result.issues.filter(i => i.severity === "info").length,
		},
		validatedAt: result.validatedAt,
	};
}

/**
 * Converts server TOC entry to client TOC entry type.
 */
function adaptTOCEntry(entry: ServerTOCEntry): TOCEntry {
	return {
		id: entry.id,
		type: "heading",
		text: entry.title,
		page: entry.pageNumber,
		level: entry.level as TOCEntry["level"],
		sectionNumber: undefined,
		targetId: entry.id,
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
			const clientResult = adaptValidationResult(serverResult);
			clientResult.documentId = documentId;
			setResult(clientResult);
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
					critical: serverResult.issues.filter(i => i.severity === "critical").length,
					serious: serverResult.issues.filter(i => i.severity === "serious").length,
					moderate: serverResult.issues.filter(i => i.severity === "moderate").length,
					minor: serverResult.issues.filter(i => i.severity === "minor").length,
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
			serverResult.issues.forEach((issue, idx) => {
				const category = issue.wcagCriterion?.startsWith("1.1") ? "images" :
					issue.wcagCriterion?.startsWith("1.4") ? "color" :
					issue.wcagCriterion?.startsWith("2.4") ? "navigation" :
					issue.wcagCriterion?.startsWith("1.3") ? "documents" : "documents";

				if (clientResult.issuesByCategory[category as keyof typeof clientResult.issuesByCategory]) {
					clientResult.issuesByCategory[category as keyof typeof clientResult.issuesByCategory].push({
						id: `a11y-${idx}`,
						category: category as AccessibilityResult["issuesByCategory"]["images"][0]["category"],
						wcagCriterion: issue.wcagCriterion || "",
						wcagLevel: "A",
						title: issue.message,
						description: issue.message,
						remediation: issue.recommendation,
						impact: issue.severity,
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
					page: f.pageNumber,
					targetId: f.id,
				})));
			}

			if (types.includes("tables")) {
				const serverTables = await generateListOfTables(documentId);
				setTables(serverTables.map((t, idx) => ({
					id: t.id,
					number: String(idx + 1),
					title: t.title,
					page: t.pageNumber,
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
				const clientSettings: HeaderFooterSettings = {
					header: [
						{ position: "left", content: serverSettings.header?.left || "" },
						{ position: "center", content: serverSettings.header?.center || "" },
						{ position: "right", content: serverSettings.header?.right || "" },
					],
					footer: [
						{ position: "left", content: serverSettings.footer?.left || "" },
						{ position: "center", content: serverSettings.footer?.center || "" },
						{ position: "right", content: serverSettings.footer?.right || "" },
					],
					pageNumberFormat: (serverSettings.footer?.pageNumberFormat as HeaderFooterSettings["pageNumberFormat"]) || "arabic",
					startPageNumber: 1,
					differentFirstPage: !(serverSettings.header?.showOnFirstPage ?? true) || !(serverSettings.footer?.showOnFirstPage ?? true),
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
				header: {
					left: newSettings.header.find(h => h.position === "left")?.content,
					center: newSettings.header.find(h => h.position === "center")?.content,
					right: newSettings.header.find(h => h.position === "right")?.content,
					showOnFirstPage: !newSettings.differentFirstPage,
				},
				footer: {
					left: newSettings.footer.find(f => f.position === "left")?.content,
					center: newSettings.footer.find(f => f.position === "center")?.content,
					right: newSettings.footer.find(f => f.position === "right")?.content,
					pageNumberPosition: "center",
					pageNumberFormat: newSettings.pageNumberFormat === "roman-lower" || newSettings.pageNumberFormat === "roman-upper" ? "roman" :
						newSettings.pageNumberFormat === "alpha-lower" || newSettings.pageNumberFormat === "alpha-upper" ? "alpha" : "arabic",
					showOnFirstPage: !newSettings.differentFirstPage,
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
 * Hook for format preview (placeholder - would need actual rendering).
 */
export function useFormatPreview(documentId: string, templateId?: string) {
	const [template, setTemplate] = React.useState<FormatTemplate | null>(null);
	const [isLoading, setIsLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		async function load() {
			if (!templateId) {
				setIsLoading(false);
				return;
			}

			setIsLoading(true);
			setError(null);

			try {
				const serverTemplate = await getFormatTemplateById(templateId);
				if (serverTemplate) {
					setTemplate(adaptFormatTemplate(serverTemplate));
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load preview");
			}

			setIsLoading(false);
		}

		load();
	}, [templateId]);

	return { template, totalPages: 42, isLoading, error };
}
