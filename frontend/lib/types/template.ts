/**
 * Template types for DocFusion.
 *
 * Templates provide pre-structured documents with placeholders,
 * AI prompts, and compliance requirements.
 */

import type { DocumentContent, DocumentMetadata } from "./document";

export type TemplateId = string;
export type CategoryId = string;

/** Template visibility levels */
export type TemplateVisibility = "private" | "team" | "organization" | "public";

/** Template lifecycle status */
export type TemplateStatus = "draft" | "published" | "deprecated";

/**
 * A placeholder field within a template.
 * Placeholders are filled in when creating a document from the template.
 */
export interface TemplatePlaceholder {
	id: string;
	/** Display name shown to user */
	name: string;
	/** Variable name for substitution (e.g., {{company_name}}) */
	variableName: string;
	/** Description/help text */
	description?: string;
	/** Input type for the placeholder */
	type: PlaceholderType;
	/** Whether this field is required */
	required: boolean;
	/** Default value if not provided */
	defaultValue?: string;
	/** Validation rules */
	validation?: PlaceholderValidation;
	/** Options for select/multiselect types */
	options?: PlaceholderOption[];
	/** AI prompt for auto-filling this placeholder */
	aiPrompt?: string;
}

export type PlaceholderType =
	| "text"
	| "textarea"
	| "number"
	| "date"
	| "select"
	| "multiselect"
	| "boolean"
	| "email"
	| "url"
	| "currency";

export interface PlaceholderValidation {
	minLength?: number;
	maxLength?: number;
	min?: number;
	max?: number;
	pattern?: string;
	patternMessage?: string;
}

export interface PlaceholderOption {
	value: string;
	label: string;
}

/**
 * AI instruction for template sections.
 * Guides AI when generating or improving content.
 */
export interface TemplateAIInstruction {
	/** Section or block ID this applies to */
	targetId?: string;
	/** AI prompt for content generation */
	prompt: string;
	/** Tone/style guidance */
	tone?: "formal" | "professional" | "friendly" | "technical";
	/** Maximum length for generated content */
	maxLength?: number;
	/** Reference documents or knowledge sources */
	references?: string[];
}

/**
 * Compliance requirement attached to a template.
 */
export interface TemplateComplianceRequirement {
	id: string;
	/** Regulatory framework (e.g., "FAR", "DFARS", "GDPR") */
	framework: string;
	/** Specific clause or section */
	clause: string;
	/** Requirement description */
	description: string;
	/** Whether compliance is mandatory */
	mandatory: boolean;
	/** Validation criteria */
	criteria?: string;
}

/**
 * Template category for organization.
 */
export interface TemplateCategory {
	id: CategoryId;
	name: string;
	description?: string;
	slug: string;
	parentId?: CategoryId;
	/** Number of templates in this category */
	templateCount: number;
	/** Category icon (lucide icon name) */
	icon?: string;
	/** Display order */
	order: number;
}

/**
 * Core template entity.
 */
export interface Template {
	id: TemplateId;
	name: string;
	description: string;
	/** The document content structure */
	content: DocumentContent;
	status: TemplateStatus;
	visibility: TemplateVisibility;
	/** Creator user ID */
	createdBy: string;
	/** Category assignments */
	categoryIds: CategoryId[];
	/** Searchable tags */
	tags: string[];
	/** Placeholder fields */
	placeholders: TemplatePlaceholder[];
	/** AI instructions for content generation */
	aiInstructions: TemplateAIInstruction[];
	/** Compliance requirements */
	complianceRequirements: TemplateComplianceRequirement[];
	/** Number of documents created from this template */
	useCount: number;
	/** Average rating (1-5) */
	rating?: number;
	/** Number of ratings */
	ratingCount?: number;
	/** Preview image URL */
	previewImageUrl?: string;
	/** Estimated completion time in minutes */
	estimatedTime?: number;
	/** Difficulty level */
	difficulty?: "beginner" | "intermediate" | "advanced";
	createdAt: string;
	updatedAt: string;
	/** Default metadata for documents created from this template */
	defaultMetadata?: DocumentMetadata;
}

/**
 * Lightweight template reference for lists.
 */
export interface TemplateSummary {
	id: TemplateId;
	name: string;
	description: string;
	status: TemplateStatus;
	visibility: TemplateVisibility;
	categoryIds: CategoryId[];
	tags: string[];
	useCount: number;
	rating?: number;
	ratingCount?: number;
	previewImageUrl?: string;
	estimatedTime?: number;
	difficulty?: "beginner" | "intermediate" | "advanced";
	createdAt: string;
	updatedAt: string;
}

/**
 * Parameters for creating a new template.
 */
export interface CreateTemplateInput {
	name: string;
	description: string;
	content: DocumentContent;
	visibility?: TemplateVisibility;
	categoryIds?: CategoryId[];
	tags?: string[];
	placeholders?: TemplatePlaceholder[];
	aiInstructions?: TemplateAIInstruction[];
	complianceRequirements?: TemplateComplianceRequirement[];
	previewImageUrl?: string;
	estimatedTime?: number;
	difficulty?: "beginner" | "intermediate" | "advanced";
	defaultMetadata?: DocumentMetadata;
}

/**
 * Parameters for updating a template.
 */
export interface UpdateTemplateInput {
	name?: string;
	description?: string;
	content?: DocumentContent;
	status?: TemplateStatus;
	visibility?: TemplateVisibility;
	categoryIds?: CategoryId[];
	tags?: string[];
	placeholders?: TemplatePlaceholder[];
	aiInstructions?: TemplateAIInstruction[];
	complianceRequirements?: TemplateComplianceRequirement[];
	previewImageUrl?: string;
	estimatedTime?: number;
	difficulty?: "beginner" | "intermediate" | "advanced";
	defaultMetadata?: DocumentMetadata;
}

/**
 * Template list query parameters.
 */
export interface TemplateListParams {
	/** Filter by status */
	status?: TemplateStatus;
	/** Filter by visibility */
	visibility?: TemplateVisibility;
	/** Filter by category */
	categoryId?: CategoryId;
	/** Filter by tags (any match) */
	tags?: string[];
	/** Filter by difficulty */
	difficulty?: "beginner" | "intermediate" | "advanced";
	/** Full-text search query */
	search?: string;
	/** Sort field */
	sortBy?: "createdAt" | "updatedAt" | "name" | "useCount" | "rating";
	/** Sort direction */
	sortOrder?: "asc" | "desc";
	/** Pagination offset */
	offset?: number;
	/** Pagination limit */
	limit?: number;
}

/**
 * Paginated template list response.
 */
export interface TemplateListResponse {
	templates: TemplateSummary[];
	total: number;
	offset: number;
	limit: number;
	hasMore: boolean;
}

/**
 * Input for creating a document from a template.
 */
export interface UseTemplateInput {
	templateId: TemplateId;
	/** Title for the new document */
	title: string;
	/** Values for template placeholders */
	placeholderValues: Record<string, string | number | boolean | string[]>;
	/** Whether to auto-fill using AI */
	useAIFill?: boolean;
}

/**
 * Template with resolved categories.
 */
export interface TemplateWithCategories extends Template {
	categories: TemplateCategory[];
}
