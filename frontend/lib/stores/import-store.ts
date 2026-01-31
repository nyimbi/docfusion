/**
 * Import Wizard Store
 *
 * Zustand store for managing universal data import wizard state.
 * Uses immer for immutable updates and selective persistence.
 *
 * State includes:
 * - Wizard navigation (current step, completed steps)
 * - File data (file reference, parsed data)
 * - Target configuration (table, schema)
 * - Column mappings with concatenation support
 * - Import options and progress
 */

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
	WizardStep,
	ImportTargetTable,
	TableSchema,
	ParsedFileData,
	ColumnMapping,
	MappingSuggestion,
	ImportOptions,
	ImportProgress,
	ImportResult,
} from "@/lib/types/import";
import { getTableSchema } from "@/lib/import/table-schemas";
import { detectMappings } from "@/lib/import/column-detector";

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_OPTIONS: ImportOptions = {
	duplicateHandling: "skip",
	batchSize: 100,
	saveAsTemplate: false,
	templateName: "",
	templateDescription: "",
};

const WIZARD_STEPS: WizardStep[] = ["upload", "target", "mapping", "preview", "options", "results"];

// ============================================================================
// State Interface
// ============================================================================

export interface ImportWizardState {
	// Navigation
	currentStep: WizardStep;
	completedSteps: WizardStep[];

	// File data (not persisted)
	file: File | null;
	parsedData: ParsedFileData | null;

	// Target
	targetTable: ImportTargetTable | null;
	targetSchema: TableSchema | null;

	// Mappings
	mappings: ColumnMapping[];
	mappingSuggestions: MappingSuggestion[];

	// Template
	selectedTemplateId: string | null;

	// Options (persisted)
	options: ImportOptions;

	// Progress (not persisted)
	importId: string | null;
	progress: ImportProgress | null;

	// Results (not persisted)
	result: ImportResult | null;

	// Preview data
	previewData: {
		rows: Array<{
			sourceRow: number;
			sourceValues: Record<string, unknown>;
			targetValues: Record<string, unknown>;
			issues: Array<{ column?: string; message: string; severity: "error" | "warning" }>;
			hasError: boolean;
			hasWarning: boolean;
		}>;
		validation: {
			isValid: boolean;
			errorCount: number;
			warningCount: number;
		};
		totalRows: number;
	} | null;

	// Templates list
	templates: Array<{
		id: string;
		name: string;
		description?: string;
		targetTable: string;
		useCount: number;
		lastUsedAt?: string;
		createdAt: string;
	}>;

	// UI State
	isLoading: boolean;
	error: string | null;
}

// ============================================================================
// Actions Interface
// ============================================================================

export interface ImportWizardActions {
	// Navigation
	goToStep: (step: WizardStep) => void;
	nextStep: () => void;
	prevStep: () => void;
	canProceed: () => boolean;

	// File
	setFile: (file: File) => void;
	setParsedData: (data: ParsedFileData) => void;
	clearFile: () => void;

	// Target
	setTargetTable: (table: ImportTargetTable) => void;

	// Mappings
	addMapping: (mapping: Omit<ColumnMapping, "id">) => void;
	updateMapping: (id: string, updates: Partial<ColumnMapping>) => void;
	removeMapping: (id: string) => void;
	removeMappingByTarget: (targetColumn: string) => void;
	clearMappings: () => void;
	autoDetectMappings: () => void;
	applyTemplate: (templateId: string, mappings: ColumnMapping[]) => void;
	setSuggestions: (suggestions: MappingSuggestion[]) => void;

	// Options
	setOptions: (options: Partial<ImportOptions>) => void;

	// Progress
	setImportId: (id: string) => void;
	setProgress: (progress: ImportProgress) => void;

	// Results
	setResult: (result: ImportResult) => void;

	// UI
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	setIsLoading: (loading: boolean) => void;
	setPreviewData: (data: ImportWizardState["previewData"]) => void;
	setTemplates: (templates: ImportWizardState["templates"]) => void;
	setSelectedTemplateId: (id: string | null) => void;
	setImportResult: (result: ImportResult) => void;

	// Navigation helpers
	previousStep: () => void;

	// Reset
	reset: () => void;
	resetToStep: (step: WizardStep) => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: ImportWizardState = {
	currentStep: "upload",
	completedSteps: [],
	file: null,
	parsedData: null,
	targetTable: null,
	targetSchema: null,
	mappings: [],
	mappingSuggestions: [],
	selectedTemplateId: null,
	options: DEFAULT_OPTIONS,
	importId: null,
	progress: null,
	result: null,
	previewData: null,
	templates: [],
	isLoading: false,
	error: null,
};

// ============================================================================
// Store
// ============================================================================

export const useImportStore = create<ImportWizardState & ImportWizardActions>()(
	persist(
		immer((set, get) => ({
			...initialState,

			// ===== Navigation =====

			goToStep: (step) =>
				set((state) => {
					state.currentStep = step;
					state.error = null;
				}),

			nextStep: () =>
				set((state) => {
					const currentIndex = WIZARD_STEPS.indexOf(state.currentStep);
					if (currentIndex < WIZARD_STEPS.length - 1) {
						// Mark current as completed
						if (!state.completedSteps.includes(state.currentStep)) {
							state.completedSteps.push(state.currentStep);
						}
						state.currentStep = WIZARD_STEPS[currentIndex + 1];
						state.error = null;
					}
				}),

			prevStep: () =>
				set((state) => {
					const currentIndex = WIZARD_STEPS.indexOf(state.currentStep);
					if (currentIndex > 0) {
						state.currentStep = WIZARD_STEPS[currentIndex - 1];
						state.error = null;
					}
				}),

			canProceed: () => {
				const state = get();
				switch (state.currentStep) {
					case "upload":
						return state.parsedData !== null;
					case "target":
						return state.targetTable !== null;
					case "mapping":
						// At least one mapping and all required fields mapped
						if (state.mappings.length === 0) return false;
						if (!state.targetSchema) return false;
						const requiredFields = state.targetSchema.columns
							.filter((c) => c.required)
							.map((c) => c.name);
						const mappedTargets = state.mappings.map((m) => m.targetColumn);
						return requiredFields.every((f) => mappedTargets.includes(f));
					case "preview":
						return true;
					case "options":
						return true;
					case "results":
						return false; // End state
					default:
						return false;
				}
			},

			// ===== File =====

			setFile: (file) =>
				set((state) => {
					state.file = file;
					state.error = null;
				}),

			setParsedData: (data) =>
				set((state) => {
					state.parsedData = data;
					state.error = null;
				}),

			clearFile: () =>
				set((state) => {
					state.file = null;
					state.parsedData = null;
					state.mappings = [];
					state.mappingSuggestions = [];
				}),

			// ===== Target =====

			setTargetTable: (table) =>
				set((state) => {
					state.targetTable = table;
					state.targetSchema = getTableSchema(table);
					state.mappings = [];
					state.mappingSuggestions = [];
					state.error = null;
				}),

			// ===== Mappings =====

			addMapping: (mapping) =>
				set((state) => {
					// Check if target column already has a mapping
					const existingIndex = state.mappings.findIndex(
						(m) => m.targetColumn === mapping.targetColumn
					);
					if (existingIndex >= 0) {
						// Update existing mapping
						state.mappings[existingIndex] = {
							...state.mappings[existingIndex],
							...mapping,
						};
					} else {
						// Add new mapping
						state.mappings.push({
							...mapping,
							id: crypto.randomUUID(),
						});
					}
				}),

			updateMapping: (id, updates) =>
				set((state) => {
					const index = state.mappings.findIndex((m) => m.id === id);
					if (index >= 0) {
						Object.assign(state.mappings[index], updates);
					}
				}),

			removeMapping: (id) =>
				set((state) => {
					state.mappings = state.mappings.filter((m) => m.id !== id);
				}),

			removeMappingByTarget: (targetColumn) =>
				set((state) => {
					state.mappings = state.mappings.filter((m) => m.targetColumn !== targetColumn);
				}),

			clearMappings: () =>
				set((state) => {
					state.mappings = [];
				}),

			autoDetectMappings: () =>
				set((state) => {
					if (!state.parsedData || !state.targetSchema) return;

					// Detect mappings using the column detector
					const suggestions = detectMappings(
						state.parsedData.detectedTypes,
						state.targetSchema.columns
					);

					state.mappingSuggestions = suggestions;

					// Auto-apply high-confidence suggestions
					for (const suggestion of suggestions) {
						if (suggestion.confidence >= 70) {
							const existingIndex = state.mappings.findIndex(
								(m) => m.targetColumn === suggestion.targetColumn
							);

							// Get column schema for required flag
							const columnSchema = state.targetSchema.columns.find(
								(c) => c.name === suggestion.targetColumn
							);

							if (existingIndex < 0) {
								state.mappings.push({
									id: crypto.randomUUID(),
									targetColumn: suggestion.targetColumn,
									sourceColumns: [suggestion.sourceColumn],
									separator: ", ",
									transform: "trim",
									defaultValue: "",
									required: columnSchema?.required || false,
								});
							}
						}
					}
				}),

			applyTemplate: (templateId, mappings) =>
				set((state) => {
					state.selectedTemplateId = templateId;
					state.mappings = mappings.map((m) => ({
						...m,
						id: m.id || crypto.randomUUID(),
					}));
				}),

			setSuggestions: (suggestions) =>
				set((state) => {
					state.mappingSuggestions = suggestions;
				}),

			// ===== Options =====

			setOptions: (options) =>
				set((state) => {
					Object.assign(state.options, options);
				}),

			// ===== Progress =====

			setImportId: (id) =>
				set((state) => {
					state.importId = id;
				}),

			setProgress: (progress) =>
				set((state) => {
					state.progress = progress;
				}),

			// ===== Results =====

			setResult: (result) =>
				set((state) => {
					state.result = result;
					// Auto-navigate to results step
					if (!state.completedSteps.includes("options")) {
						state.completedSteps.push("options");
					}
					state.currentStep = "results";
				}),

			// ===== UI =====

			setLoading: (loading) =>
				set((state) => {
					state.isLoading = loading;
				}),

			setError: (error) =>
				set((state) => {
					state.error = error;
					state.isLoading = false;
				}),

			setIsLoading: (loading) =>
				set((state) => {
					state.isLoading = loading;
				}),

			setPreviewData: (data) =>
				set((state) => {
					state.previewData = data;
				}),

			setTemplates: (templates) =>
				set((state) => {
					state.templates = templates;
				}),

			setSelectedTemplateId: (id) =>
				set((state) => {
					state.selectedTemplateId = id;
				}),

			setImportResult: (result) =>
				set((state) => {
					state.result = result;
				}),

			// Navigation alias
			previousStep: () =>
				set((state) => {
					const currentIndex = WIZARD_STEPS.indexOf(state.currentStep);
					if (currentIndex > 0) {
						state.currentStep = WIZARD_STEPS[currentIndex - 1];
						state.error = null;
					}
				}),

			// ===== Reset =====

			reset: () =>
				set((state) => {
					// Preserve options (they're persisted)
					const preservedOptions = state.options;
					Object.assign(state, initialState);
					state.options = preservedOptions;
				}),

			resetToStep: (step) =>
				set((state) => {
					const stepIndex = WIZARD_STEPS.indexOf(step);
					state.currentStep = step;
					state.completedSteps = state.completedSteps.filter(
						(s) => WIZARD_STEPS.indexOf(s) < stepIndex
					);
					state.error = null;

					// Clear data that comes after this step
					if (stepIndex <= 0) {
						// Reset everything
						state.file = null;
						state.parsedData = null;
						state.targetTable = null;
						state.targetSchema = null;
						state.mappings = [];
						state.mappingSuggestions = [];
					}
					if (stepIndex <= 1) {
						state.targetTable = null;
						state.targetSchema = null;
						state.mappings = [];
						state.mappingSuggestions = [];
					}
					if (stepIndex <= 2) {
						state.mappings = [];
						state.mappingSuggestions = [];
					}
					// Always clear progress and results on reset
					state.importId = null;
					state.progress = null;
					state.result = null;
				}),
		})),
		{
			name: "docfusion-import",
			storage: createJSONStorage(() => localStorage),
			// Only persist options and last used template
			partialize: (state) => ({
				options: state.options,
				selectedTemplateId: state.selectedTemplateId,
			}),
		}
	)
);

// ============================================================================
// Selector Hooks
// ============================================================================

/** Current wizard step */
export const useCurrentStep = () => useImportStore((s) => s.currentStep);

/** Completed steps for navigation */
export const useCompletedSteps = () => useImportStore((s) => s.completedSteps);

/** File and parsed data */
export const useFileData = () =>
	useImportStore((s) => ({
		file: s.file,
		parsedData: s.parsedData,
	}));

/** Target table configuration */
export const useTargetConfig = () =>
	useImportStore((s) => ({
		targetTable: s.targetTable,
		targetSchema: s.targetSchema,
	}));

/** Column mappings array */
export const useMappings = () => useImportStore((s) => s.mappings);

/** Mapping suggestions */
export const useSuggestedMappings = () => useImportStore((s) => s.mappingSuggestions);

/** Import options */
export const useImportOptions = () => useImportStore((s) => s.options);

/** Import options (alias) */
export const useOptions = () => useImportStore((s) => s.options);

/** Import progress (combined) */
export const useImportProgress = () =>
	useImportStore((s) => ({
		importId: s.importId,
		progress: s.progress,
	}));

/** Progress only */
export const useProgress = () => useImportStore((s) => s.progress);

/** Import result */
export const useImportResult = () => useImportStore((s) => s.result);

/** Loading and error state */
export const useImportStatus = () =>
	useImportStore((s) => ({
		isLoading: s.isLoading,
		error: s.error,
	}));

/** Is loading state */
export const useIsLoading = () => useImportStore((s) => s.isLoading);

/** Parsed file data */
export const useParsedData = () => useImportStore((s) => s.parsedData);

/** Target table */
export const useTargetTable = () => useImportStore((s) => s.targetTable);

/** Target schema */
export const useTargetSchema = () => useImportStore((s) => s.targetSchema);

/** Selected template ID */
export const useSelectedTemplateId = () => useImportStore((s) => s.selectedTemplateId);

/** Preview data (alias for result preview) */
export const usePreviewData = () => useImportStore((s) => s.previewData);

/** Templates list */
export const useTemplates = () => useImportStore((s) => s.templates);

/** Check if can proceed to next step */
export const useCanProceed = () => {
	const store = useImportStore();
	return store.canProceed();
};

/** Check if can go back */
export const useCanGoBack = () => {
	const currentStep = useImportStore((s) => s.currentStep);
	return currentStep !== "upload";
};
