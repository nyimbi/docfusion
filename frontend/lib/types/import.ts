/**
 * Import Types for DocFusion
 *
 * TypeScript interfaces for the universal data import system.
 * Covers wizard state, column mappings, file parsing, and validation.
 */

// ============================================================================
// Target Table Definitions
// ============================================================================

/** Supported target tables for import */
export type ImportTargetTable = "opportunities" | "contacts" | "accounts" | "partners";

/** Target table metadata for UI display */
export interface ImportTargetConfig {
	value: ImportTargetTable;
	label: string;
	description: string;
	/** Icon name from lucide-react */
	icon: string;
	/** Required fields that must be mapped */
	requiredFields: string[];
	/** Unique key fields for duplicate detection */
	uniqueKeyFields: string[];
}

// ============================================================================
// Column Schema (Target Tables)
// ============================================================================

/** Data types supported for column validation */
export type ColumnDataType =
	| "string"
	| "text"
	| "number"
	| "integer"
	| "boolean"
	| "date"
	| "datetime"
	| "email"
	| "phone"
	| "url"
	| "currency"
	| "json";

/** Column definition in a target table schema */
export interface ColumnSchema {
	/** Column name in the database */
	name: string;
	/** Human-readable label for display */
	label: string;
	/** Data type for validation */
	type: ColumnDataType;
	/** Whether this column is required */
	required: boolean;
	/** Maximum length for string fields */
	maxLength?: number;
	/** Description/help text for the UI */
	description?: string;
	/** Example values for hints */
	examples?: string[];
	/** Allowed values for enum-like fields */
	allowedValues?: string[];
}

/** Full schema for a target table */
export interface TableSchema {
	tableName: ImportTargetTable;
	displayName: string;
	columns: ColumnSchema[];
	/** Fields used to detect duplicates */
	uniqueKeyFields: string[];
	/** Recommended mappings for common source columns */
	suggestedMappings: Record<string, string[]>;
}

// ============================================================================
// Parsed File Data
// ============================================================================

/** Detected data type for a column */
export interface DetectedColumnType {
	/** Column name from file header */
	name: string;
	/** Inferred data type */
	inferredType: ColumnDataType;
	/** Percentage of non-empty values */
	fillRate: number;
	/** Sample values for preview */
	sampleValues: string[];
	/** Whether the column appears to contain unique values */
	appearsUnique: boolean;
}

/** Result of parsing a file */
export interface ParsedFileData {
	/** Column headers from the file */
	headers: string[];
	/** Sample rows for preview (first 100) */
	sampleRows: Record<string, unknown>[];
	/** Total row count (excluding header) */
	totalRows: number;
	/** Detected types for each column */
	detectedTypes: DetectedColumnType[];
	/** File metadata */
	metadata: {
		filename: string;
		fileType: "csv" | "tsv";
		fileSize: number;
	};
}

// ============================================================================
// Column Mapping
// ============================================================================

/** Transform functions for column values */
export type ColumnTransform =
	| "none"
	| "uppercase"
	| "lowercase"
	| "trim"
	| "capitalize"
	| "date"
	| "datetime"
	| "number"
	| "integer"
	| "currency"
	| "email"
	| "phone"
	| "url"
	| "boolean";

/** Alias for backward compatibility */
export type TransformType = ColumnTransform;

/** A single column mapping from source to target */
export interface ColumnMapping {
	/** Unique ID for this mapping (for React keys) */
	id: string;
	/** Target column name in the database */
	targetColumn: string;
	/** Source column names (multiple for concatenation) */
	sourceColumns: string[];
	/** Separator used when concatenating (default: ", ") */
	separator: string;
	/** Transform to apply to the value */
	transform: ColumnTransform;
	/** Default value if source is empty */
	defaultValue: string;
	/** Whether this mapping is required (from schema) */
	required: boolean;
}

/** Auto-detected mapping with confidence score */
export interface MappingSuggestion {
	targetColumn: string;
	sourceColumn: string;
	/** Confidence score 0-100 */
	confidence: number;
	/** Reason for the suggestion */
	reason: string;
}

// ============================================================================
// Validation
// ============================================================================

/** Validation severity levels */
export type ValidationSeverity = "error" | "warning" | "info";

/** A single validation issue */
export interface ValidationIssue {
	/** Row number (1-indexed) */
	row: number;
	/** Column name */
	column?: string;
	/** Value that caused the issue */
	value?: unknown;
	/** Issue message */
	message: string;
	/** Severity level */
	severity: ValidationSeverity;
	/** Suggestion for fixing */
	suggestion?: string;
}

/** Validation result for a batch of data */
export interface ValidationResult {
	/** Whether validation passed (no errors) */
	isValid: boolean;
	/** Total number of errors */
	errorCount: number;
	/** Total number of warnings */
	warningCount: number;
	/** Individual issues */
	issues: ValidationIssue[];
	/** Summary by column */
	columnSummary: Record<string, {
		errorCount: number;
		warningCount: number;
	}>;
}

// ============================================================================
// Data Preview
// ============================================================================

/** Transformed row for preview */
export interface PreviewRow {
	/** Original row number in source file */
	sourceRow: number;
	/** Original values from source */
	sourceValues: Record<string, unknown>;
	/** Transformed values for target */
	targetValues: Record<string, unknown>;
	/** Validation issues for this row */
	issues: ValidationIssue[];
	/** Whether this row has errors */
	hasError: boolean;
	/** Whether this row has warnings */
	hasWarning: boolean;
}

/** Preview data for the wizard */
export interface ImportPreview {
	/** Transformed rows */
	rows: PreviewRow[];
	/** Total rows in source */
	totalRows: number;
	/** Rows shown in preview */
	previewRowCount: number;
	/** Overall validation result */
	validation: ValidationResult;
}

// ============================================================================
// Import Options
// ============================================================================

/** How to handle duplicate records */
export type DuplicateHandling = "skip" | "update" | "create";

/** Import options configured by user */
export interface ImportOptions {
	/** How to handle duplicates */
	duplicateHandling: DuplicateHandling;
	/** Batch size for processing */
	batchSize: number;
	/** Whether to skip header row (first row treated as headers) */
	skipHeaderRow?: boolean;
	/** Whether to validate all rows before inserting any */
	validateBeforeInsert?: boolean;
	/** Whether to save as template after import */
	saveAsTemplate: boolean;
	/** Template name (if saving) */
	templateName?: string;
	/** Template description (if saving) */
	templateDescription?: string;
}

// ============================================================================
// Import Progress
// ============================================================================

/** Current import progress */
export interface ImportProgress {
	/** Import ID for tracking */
	importId: string;
	/** Current status */
	status: "pending" | "processing" | "completed" | "failed" | "cancelled";
	/** Total rows to process */
	totalRows: number;
	/** Rows processed so far */
	processedRows: number;
	/** Rows successfully imported */
	importedRows: number;
	/** Rows updated */
	updatedRows: number;
	/** Rows skipped */
	skippedRows: number;
	/** Rows failed */
	failedRows: number;
	/** Current batch number */
	currentBatch: number;
	/** Total batches */
	totalBatches: number;
	/** Progress percentage 0-100 */
	percentage: number;
	/** Error message if failed */
	errorMessage?: string;
	/** Detailed errors */
	errors: ValidationIssue[];
	/** Start time */
	startedAt: string;
	/** Completion time */
	completedAt?: string;
}

// ============================================================================
// Import Results
// ============================================================================

/** Final import result summary */
export interface ImportResult {
	/** Import ID */
	importId: string;
	/** Success flag */
	success: boolean;
	/** Total rows in source */
	totalRows: number;
	/** Rows imported as new */
	importedRows: number;
	/** Rows updated */
	updatedRows: number;
	/** Rows skipped */
	skippedRows: number;
	/** Rows failed */
	failedRows: number;
	/** IDs of created records (for rollback) */
	importedIds: string[];
	/** Errors encountered */
	errors: ValidationIssue[];
	/** Duration in milliseconds */
	durationMs: number;
	/** Template ID if saved */
	savedTemplateId?: string;
}

// ============================================================================
// Wizard Step State
// ============================================================================

/** Wizard step identifiers */
export type WizardStep = "upload" | "target" | "mapping" | "preview" | "options" | "results";

/** Wizard step configuration */
export interface WizardStepConfig {
	id: WizardStep;
	title: string;
	description: string;
	/** Whether this step can be skipped */
	optional: boolean;
}

/** Full wizard state (for Zustand store) */
export interface ImportWizardState {
	// Navigation
	currentStep: WizardStep;
	completedSteps: WizardStep[];

	// File data
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

	// Options
	options: ImportOptions;

	// Progress
	importId: string | null;
	progress: ImportProgress | null;

	// Results
	result: ImportResult | null;

	// UI State
	isLoading: boolean;
	error: string | null;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/** Request to parse a file */
export interface ParseFileRequest {
	/** File content as base64 or FormData */
	file: File;
}

/** Response from parse endpoint */
export interface ParseFileResponse {
	success: boolean;
	data?: ParsedFileData;
	error?: string;
}

/** Request to preview transformed data */
export interface PreviewImportRequest {
	parsedData: ParsedFileData;
	targetTable: ImportTargetTable;
	mappings: ColumnMapping[];
	/** Number of rows to preview */
	previewCount?: number;
}

/** Response from preview endpoint */
export interface PreviewImportResponse {
	success: boolean;
	preview?: ImportPreview;
	error?: string;
}

/** Request to execute import */
export interface ExecuteImportRequest {
	parsedData: ParsedFileData;
	targetTable: ImportTargetTable;
	mappings: ColumnMapping[];
	options: ImportOptions;
}

/** Response from execute endpoint */
export interface ExecuteImportResponse {
	success: boolean;
	importId?: string;
	error?: string;
}

/** Progress polling response */
export interface ImportProgressResponse {
	success: boolean;
	progress?: ImportProgress;
	error?: string;
}

// ============================================================================
// Template Types
// ============================================================================

/** Template for list display */
export interface ImportTemplateSummary {
	id: string;
	name: string;
	description?: string;
	targetTable: ImportTargetTable;
	useCount: number;
	lastUsedAt?: string;
	createdAt: string;
}

/** Full template for loading */
export interface ImportTemplateDetail extends ImportTemplateSummary {
	mappings: Array<{
		targetColumn: string;
		sourceColumns: string[];
		separator?: string;
		transform?: string;
		defaultValue?: string;
		required: boolean;
	}>;
	sourceColumnPatterns?: Record<string, string[]>;
}

/** Request to save template */
export interface SaveTemplateRequest {
	name: string;
	description?: string;
	targetTable: ImportTargetTable;
	mappings: ColumnMapping[];
}

/** Response from save template */
export interface SaveTemplateResponse {
	success: boolean;
	templateId?: string;
	error?: string;
}

/** Import template for UI (alias for summary) */
export type ImportMappingTemplate = ImportTemplateSummary;

/** Import error type (alias for validation issue) */
export interface ImportError {
	row: number;
	column?: string;
	value?: string;
	error: string;
}
