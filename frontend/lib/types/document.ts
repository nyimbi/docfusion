/**
 * Document types for DocFusion.
 *
 * Documents are the core entity - they contain rich text content,
 * can be collaboratively edited, and support versioning.
 */

import type { JSONContent } from "@tiptap/react";

/** Unique identifier type (UUID v7 from backend) */
export type DocumentId = string;
export type UserId = string;
export type VersionId = string;
export type BlockId = string;

/** Document visibility/access levels */
export type DocumentVisibility = "private" | "team" | "organization" | "public";

/** Document lifecycle status */
export type DocumentStatus = "draft" | "in_review" | "approved" | "archived";

/**
 * DocumentContent is an alias for Tiptap's JSONContent for editor compatibility.
 * This ensures full compatibility with Tiptap's editor while allowing us to
 * add additional metadata when persisting to the backend.
 */
export type DocumentContent = JSONContent;

/**
 * A node within the document content tree.
 * Used for traversing and manipulating document structure.
 */
export type DocumentNode = JSONContent;

/**
 * A content block within a document - extended type for backend storage.
 * Blocks are the atomic units of content that can be individually
 * versioned, moved, and collaborated on.
 */
export interface DocumentBlock {
	id?: BlockId;
	type: BlockType;
	text?: string;
	content?: DocumentBlock[];
	attrs?: Record<string, unknown>;
	marks?: { type: string; attrs?: Record<string, unknown> }[];
	metadata?: BlockMetadata;
}

/** Supported block types aligned with Tiptap/ProseMirror */
export type BlockType =
	| "paragraph"
	| "heading"
	| "bulletList"
	| "orderedList"
	| "listItem"
	| "blockquote"
	| "codeBlock"
	| "horizontalRule"
	| "image"
	| "table"
	| "tableRow"
	| "tableCell"
	| "tableHeader"
	| "hardBreak"
	| "text";

/** Block-level metadata for tracking and AI features */
export interface BlockMetadata {
	createdAt?: string;
	updatedAt?: string;
	createdBy?: UserId;
	aiGenerated?: boolean;
	aiConfidence?: number;
	sourceTemplateId?: string;
	complianceFlags?: string[];
}

/**
 * Document version for tracking changes over time.
 * Each save creates a new version for audit trail.
 */
export interface DocumentVersion {
	id: VersionId;
	documentId: DocumentId;
	versionNumber: number;
	content: DocumentContent;
	createdAt: string;
	createdBy: UserId;
	changeDescription?: string;
	/** Yjs state vector for CRDT sync */
	yjsStateVector?: Uint8Array;
}

/**
 * Default empty document content for initialization.
 */
export const EMPTY_DOCUMENT_CONTENT: DocumentContent = {
	type: "doc",
	content: [{ type: "paragraph" }],
};

/**
 * Core document entity.
 */
export interface Document {
	id: DocumentId;
	title: string;
	content: DocumentContent;
	/** Plain text for search indexing */
	plainText?: string;
	status: DocumentStatus;
	visibility: DocumentVisibility;
	ownerId: UserId;
	templateId?: string;
	/** Tags for organization */
	tags: string[];
	/** Word count (computed) */
	wordCount: number;
	/** Character count (computed) */
	characterCount: number;
	createdAt: string;
	updatedAt: string;
	/** Last time document was opened */
	lastAccessedAt?: string;
	/** Current version number */
	currentVersion: number;
	/** Collaborator user IDs */
	collaboratorIds: UserId[];
	/** Custom metadata */
	metadata?: DocumentMetadata;
}

/** Extended metadata for documents */
export interface DocumentMetadata {
	/** RFP-specific fields */
	rfpNumber?: string;
	dueDate?: string;
	clientName?: string;
	projectValue?: number;
	complianceScore?: number;
	/** AI analysis results */
	aiSummary?: string;
	keyTopics?: string[];
	suggestedImprovements?: string[];
	/** HDSI editor integration */
	hdsiDocumentId?: string;
	type?: string;
	generationVersion?: string;
}

/**
 * Lightweight document reference for lists and search results.
 */
export interface DocumentSummary {
	id: DocumentId;
	title: string;
	status: DocumentStatus;
	visibility: DocumentVisibility;
	ownerId: UserId;
	ownerName?: string;
	tags: string[];
	wordCount: number;
	createdAt: string;
	updatedAt: string;
	lastAccessedAt?: string;
	/** Preview snippet */
	excerpt?: string;
	/** Number of active collaborators */
	activeCollaborators?: number;
}

/**
 * Parameters for creating a new document.
 */
export interface CreateDocumentInput {
	title: string;
	content?: DocumentContent;
	templateId?: string;
	visibility?: DocumentVisibility;
	tags?: string[];
	metadata?: DocumentMetadata;
}

/**
 * Parameters for updating a document.
 */
export interface UpdateDocumentInput {
	title?: string;
	content?: DocumentContent;
	status?: DocumentStatus;
	visibility?: DocumentVisibility;
	tags?: string[];
	metadata?: DocumentMetadata;
	changeDescription?: string;
}

/**
 * Document list query parameters.
 */
export interface DocumentListParams {
	/** Filter by status */
	status?: DocumentStatus;
	/** Filter by visibility */
	visibility?: DocumentVisibility;
	/** Filter by owner */
	ownerId?: UserId;
	/** Filter by tags (any match) */
	tags?: string[];
	/** Full-text search query */
	search?: string;
	/** Sort field */
	sortBy?: "createdAt" | "updatedAt" | "title" | "lastAccessedAt";
	/** Sort direction */
	sortOrder?: "asc" | "desc";
	/** Pagination offset */
	offset?: number;
	/** Pagination limit */
	limit?: number;
}

/**
 * Paginated document list response.
 */
export interface DocumentListResponse {
	documents: DocumentSummary[];
	total: number;
	offset: number;
	limit: number;
	hasMore: boolean;
}

/**
 * Document with full version history.
 */
export interface DocumentWithHistory extends Document {
	versions: DocumentVersion[];
}

/**
 * Yjs collaboration state stored on backend.
 */
export interface DocumentYjsState {
	documentId: DocumentId;
	/** Base64-encoded Yjs document state */
	state: string;
	/** State vector for incremental sync */
	stateVector: string;
	updatedAt: string;
}
