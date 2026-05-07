/**
 * Snippet types for DocFusion.
 *
 * Snippets are reusable content blocks that can be inserted into documents
 * via shortcuts (e.g., typing "/header" expands to a company header).
 */

import type { DocumentContent } from "./document";

export type SnippetId = string;
export type PartialId = string;
export type EditId = string;

/**
 * Edit type for tracking template modifications.
 */
export type EditType = "create" | "edit" | "delete" | "publish" | "revert";

/**
 * A reusable content block (snippet).
 */
export interface TemplateSnippet {
	id: SnippetId;
	name: string;
	/** Shortcut for quick insertion (e.g., "/header") */
	shortcut: string;
	/** Content stored as Tiptap JSON */
	content: DocumentContent;
	/** Placeholder definitions for context resolution */
	placeholders: SnippetPlaceholder[];
	description?: string;
	/** Tags for categorization and search */
	tags: string[];
	category?: string;
	createdBy: string;
	organizationId?: string;
	/** Number of times this snippet has been used */
	useCount: number;
	/** Whether this snippet is public/shared across org */
	isPublic: boolean;
	createdAt: string;
	updatedAt: string;
}

/**
 * Lightweight snippet reference for lists.
 */
export interface SnippetSummary {
	id: SnippetId;
	name: string;
	shortcut: string;
	description?: string;
	category?: string;
	tags: string[];
	placeholders: SnippetPlaceholder[];
	useCount: number;
	isPublic: boolean;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
}

/**
 * A partial template that can be combined with others.
 */
export interface TemplatePartial {
	id: PartialId;
	name: string;
	description?: string;
	/** Content stored as Tiptap JSON */
	content: DocumentContent;
	/** Placeholder definitions */
	placeholders: SnippetPlaceholder[];
	/** Usage tracking */
	usage: PartialUsage;
	createdBy: string;
	organizationId?: string;
	createdAt: string;
	updatedAt: string;
}

/**
 * Placeholder field for partials.
 */
export interface SnippetPlaceholder {
	id: string;
	name: string;
	/** Canonical raw key, e.g. client_name. Legacy values may include moustaches at read boundaries. */
	key?: string;
	variableName: string;
	description?: string;
	type: SnippetPlaceholderType;
	required: boolean;
	defaultValue?: string;
	options?: SnippetOption[];
}

/**
 * Placeholder types.
 */
export type SnippetPlaceholderType =
	| "text"
	| "textarea"
	| "number"
	| "date"
	| "select"
	| "multiselect"
	| "boolean"
	| "email"
	| "url";

/**
 * Option for select/multiselect placeholder types.
 */
export interface SnippetOption {
	value: string;
	label: string;
}

/**
 * Usage tracking for partials.
 */
export interface PartialUsage {
	/** IDs of templates using this partial */
	templateIds: string[];
	useCount: number;
}

/**
 * Template edit record for version history.
 */
export interface TemplateEdit {
	id: EditId;
	templateId: string;
	userId: string;
	type: EditType;
	/** Detailed changes */
	changes: EditChanges;
	versionNumber?: number;
	comment?: string;
	createdAt: string;
}

/**
 * Edit changes structure.
 */
export interface EditChanges {
	/** Diff format: "before" and "after" snapshots */
	before?: DocumentContent;
	after?: DocumentContent;
	/** Field-level changes */
	fieldChanges?: FieldChange[];
	/** For reverting: which version to restore */
	revertToVersion?: number;
}

/**
 * Individual field change.
 */
export interface FieldChange {
	field: string;
	before: unknown;
	after: unknown;
}

/**
 * Template version snapshot.
 */
export interface TemplateVersionHistory {
	id: string;
	templateId: string;
	versionNumber: number;
	content: DocumentContent;
	placeholders: SnippetPlaceholder[];
	aiInstructions: unknown[];
	changeDescription?: string;
	createdBy: string;
	createdAt: string;
}

/**
 * Shortcut expansion result.
 */
export interface ShortcutExpansion {
	snippet: SnippetSummary;
	/** Resolved content after placeholder substitution */
	content: DocumentContent;
	plainTextPreview?: string;
	unresolvedPlaceholders?: SnippetUnresolvedPlaceholder[];
	resolvedValues?: Record<string, string | number | boolean | string[]>;
	valueSources?: Record<string, string>;
	diagnostics?: SnippetResolutionDiagnostic[];
	adaptationNotes?: string[];
	provenance?: SnippetInsertionProvenance;
}

export interface SnippetInsertionProvenance {
	snippetId?: string;
	shortcut?: string;
	resolvedAt: string;
	placeholderCount: number;
	resolvedKeys: string[];
	unresolvedKeys: string[];
	valueSources: Record<string, string>;
	diagnostics: SnippetResolutionDiagnostic[];
	adaptation: {
		usedAI: boolean;
		notes: string[];
	};
	context: {
		documentId?: string;
		opportunityId?: string;
		requirementId?: string;
		hasRequirementText: boolean;
		hasSurroundingText: boolean;
		sectionTitle?: string;
	};
}

/**
 * Parameters for creating a new snippet.
 */
export interface CreateSnippetInput {
	name: string;
	shortcut: string;
	content: DocumentContent;
	placeholders?: SnippetPlaceholder[];
	description?: string;
	tags?: string[];
	category?: string;
	isPublic?: boolean;
}

/**
 * Parameters for updating a snippet.
 */
export interface UpdateSnippetInput {
	name?: string;
	shortcut?: string;
	content?: DocumentContent;
	placeholders?: SnippetPlaceholder[];
	description?: string;
	tags?: string[];
	category?: string;
	isPublic?: boolean;
}

/**
 * Parameters for creating a partial.
 */
export interface CreatePartialInput {
	name: string;
	description?: string;
	content: DocumentContent;
	placeholders?: SnippetPlaceholder[];
}

/**
 * Parameters for updating a partial.
 */
export interface UpdatePartialInput {
	name?: string;
	description?: string;
	content?: DocumentContent;
	placeholders?: SnippetPlaceholder[];
}

/**
 * Snippet list query parameters.
 */
export interface SnippetListParams {
	category?: string;
	tags?: string[];
	isPublic?: boolean;
	createdBy?: string;
	search?: string;
	sortBy?: "createdAt" | "updatedAt" | "name" | "useCount";
	sortOrder?: "asc" | "desc";
	offset?: number;
	limit?: number;
}

/**
 * Snippet list response.
 */
export interface SnippetListResponse {
	snippets: SnippetSummary[];
	total: number;
	offset: number;
	limit: number;
	hasMore: boolean;
	categories: string[];
}

/**
 * Snippet expansion request.
 */
export interface SnippetExpansionRequest {
	shortcut: string;
	/** Optional placeholder values to fill in */
	placeholderValues?: Record<string, string | number | boolean | string[] | null>;
	documentId?: string;
	opportunityId?: string;
	requirementId?: string;
	requirementText?: string;
	sectionTitle?: string;
	surroundingText?: string;
	proposalTone?: string;
	useAI?: boolean;
}

export interface NormalizedSnippetContent {
	content: DocumentContent;
	plainTextPreview: string;
}

export interface SnippetUnresolvedPlaceholder {
	token: string;
	key: string;
	path: string;
}

export interface SnippetResolutionDiagnostic {
	code:
		| "ambiguousOpportunityLink"
		| "explicitOpportunityLinkMismatch"
		| "aiAdaptationUnavailable";
	message: string;
	details?: Record<string, unknown>;
}

export interface ResolveSnippetContentRequest {
	snippetId?: string;
	shortcut?: string;
	content?: DocumentContent | string;
	placeholders?: SnippetPlaceholder[];
	placeholderValues?: Record<string, string | number | boolean | string[] | null>;
	documentId?: string;
	opportunityId?: string;
	requirementId?: string;
	requirementText?: string;
	sectionTitle?: string;
	surroundingText?: string;
}

export interface ResolveSnippetContentResult {
	snippetId?: string;
	shortcut?: string;
	originalContent: DocumentContent;
	resolvedContent: DocumentContent;
	plainTextPreview: string;
	unresolvedPlaceholders: SnippetUnresolvedPlaceholder[];
	resolvedValues: Record<string, string | number | boolean | string[]>;
	valueSources: Record<string, string>;
	placeholderMetadata: SnippetPlaceholder[];
	diagnostics: SnippetResolutionDiagnostic[];
}

export interface AdaptResolvedSnippetRequest {
	resolved: ResolveSnippetContentResult;
	richContext: {
		requirementText?: string;
		sectionTitle?: string;
		surroundingText?: string;
		proposalTone?: string;
	};
	useAI?: boolean;
}

export interface AdaptResolvedSnippetResult {
	adaptedContent: DocumentContent;
	plainTextPreview: string;
	unresolvedPlaceholders: SnippetUnresolvedPlaceholder[];
	adaptationNotes: string[];
	diagnostics: SnippetResolutionDiagnostic[];
}

/**
 * Text selection for creating snippet.
 */
export interface SelectedTextForSnippet {
	/** Plain text */
	text: string;
	/** Full content nodes */
	content: DocumentContent;
	/** Document path/location info */
	documentId?: string;
}
