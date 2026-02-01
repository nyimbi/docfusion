/**
 * TypeScript types for RFP (Request for Proposal) Intelligence
 *
 * These types support:
 * - RFP document parsing and metadata extraction
 * - Requirements extraction and classification
 * - Compliance matrix management
 * - AI-powered analysis
 */

import type { DocumentContent } from "./document";

// ============================================================================
// RFP Document Types
// ============================================================================

export type RfpDocumentId = string;
export type RfpRequirementId = string;
export type ComplianceMatrixId = string;
export type ComplianceEntryId = string;

/** RFP format standards */
export type RfpFormat =
	| "far" // Federal Acquisition Regulation
	| "dfars" // Defense FAR Supplement
	| "commercial"
	| "grant"
	| "state_local"
	| "international"
	| "other";

/** RFP document parsing status */
export type ParsingStatus = "pending" | "processing" | "completed" | "failed";

/** Contract types commonly found in RFPs */
export type ContractType =
	| "FFP" // Firm Fixed Price
	| "T&M" // Time and Materials
	| "Cost Plus"
	| "IDIQ" // Indefinite Delivery, Indefinite Quantity
	| "BPA" // Blanket Purchase Agreement
	| "GSA Schedule"
	| "Other";

/** Set-aside types for government contracting */
export type SetAsideType =
	| "8a"
	| "HUBZone"
	| "WOSB" // Women-Owned Small Business
	| "EDWOSB" // Economically Disadvantaged WOSB
	| "SDVOSB" // Service-Disabled Veteran-Owned
	| "Small Business"
	| "Full and Open"
	| "Other";

/**
 * RFP Document - A parsed RFP file with extracted metadata
 */
export interface RfpDocument {
	id: RfpDocumentId;
	opportunityId?: string;
	filename: string;
	fileType: "pdf" | "docx" | "html";
	fileSize: number;
	storagePath: string;
	fileHash?: string;
	rfpFormat?: RfpFormat;
	parsingStatus: ParsingStatus;
	parsingProgress: number;
	parsingError?: string;
	parsingStartedAt?: string;
	parsingCompletedAt?: string;

	// Extracted Metadata
	extractedTitle?: string;
	issuingOrganization?: string;
	solicitationNumber?: string;
	responseDeadline?: string;
	questionsDeadline?: string;
	preProposalDate?: string;
	contractType?: ContractType;
	naicsCodes: string[];
	setAsideType?: SetAsideType;
	estimatedValue?: number;
	periodOfPerformance?: number; // months
	placeOfPerformance?: string;
	submissionInstructions?: string;

	// Document Structure
	pageCount?: number;
	wordCount?: number;
	detectedSections: RfpSection[];
	sectionLContent?: string;
	sectionMContent?: string;
	statementOfWork?: string;

	// AI Analysis
	aiSummary?: string;
	keyThemes: string[];
	evaluationWeights: Record<string, number>;
	parsingConfidence?: number;

	// Metadata
	uploadedBy: string;
	createdAt: string;
	updatedAt: string;
}

/** Detected section in an RFP */
export interface RfpSection {
	id: string;
	title: string;
	pageStart: number;
	pageEnd?: number;
	level: number; // Heading level (1, 2, 3, etc.)
	parentId?: string;
	content?: string;
}

// ============================================================================
// Requirement Types
// ============================================================================

/** Requirement category classification (RFP-specific) */
export type RfpRequirementCategory =
	| "technical"
	| "management"
	| "past_performance"
	| "cost"
	| "administrative"
	| "personnel"
	| "security"
	| "compliance"
	| "other";

/** Requirement type based on RFC language */
export type RfpRequirementType = "shall" | "should" | "may" | "will";

/** Requirement priority (RFP-specific) */
export type RfpRequirementPriority = "mandatory" | "preferred" | "optional";

/** Risk level for requirements (RFP-specific) */
export type RfpRiskLevel = "critical" | "high" | "medium" | "low";

/** Compliance status for a requirement (RFP-specific) */
export type RfpComplianceStatus =
	| "not_addressed"
	| "in_progress"
	| "addressed"
	| "compliant"
	| "partial"
	| "non_compliant"
	| "not_applicable"
	| "pending";

/** Ambiguity level for requirements */
export type AmbiguityLevel = "clear" | "somewhat_ambiguous" | "very_ambiguous";

/**
 * RFP Requirement - An extracted and classified requirement
 */
export interface RfpRequirement {
	id: RfpRequirementId;
	rfpDocumentId: RfpDocumentId;
	opportunityId?: string;

	// Identification
	requirementNumber: string;
	title?: string;
	requirementText: string;
	sourceQuote?: string;
	sourcePage?: number;
	sourceSection?: string;

	// Classification
	category: RfpRequirementCategory;
	subcategory?: string;
	requirementType: RfpRequirementType;
	priority: RfpRequirementPriority;
	riskLevel: RfpRiskLevel;
	evaluationWeight?: number;

	// AI Analysis
	extractionConfidence?: number;
	isImplicit: boolean;
	ambiguityLevel?: AmbiguityLevel;
	clarificationQuestions: string[];
	relatedRequirements: string[];
	keyTerms: string[];
	suggestedApproach?: string;

	// Compliance Tracking
	complianceStatus: RfpComplianceStatus;
	responseStrategy?: string;
	assignedTo?: string;
	dueDate?: string;
	responseDocumentId?: string;
	responseSection?: string;
	notes?: string;

	// Metadata
	tags: string[];
	createdAt: string;
	updatedAt: string;
}

/** Lightweight requirement reference */
export interface RequirementSummary {
	id: RfpRequirementId;
	requirementNumber: string;
	title?: string;
	category: RfpRequirementCategory;
	priority: RfpRequirementPriority;
	complianceStatus: RfpComplianceStatus;
	riskLevel: RfpRiskLevel;
}

// ============================================================================
// Compliance Matrix Types
// ============================================================================

/** Compliance matrix status */
export type MatrixStatus = "draft" | "in_progress" | "review" | "final" | "submitted";

/** Strength assessment for compliance entries */
export type StrengthAssessment = "strong" | "adequate" | "weak" | "gap";

/**
 * Compliance Matrix - Track compliance across all requirements
 */
export interface ComplianceMatrix {
	id: ComplianceMatrixId;
	opportunityId: string;
	rfpDocumentId?: RfpDocumentId;

	// Matrix Info
	name: string;
	description?: string;
	version: number;
	status: MatrixStatus;

	// Statistics
	totalRequirements: number;
	mandatoryCount: number;
	compliantCount: number;
	partialCount: number;
	nonCompliantCount: number;
	notAddressedCount: number;
	complianceScore?: number;
	mandatoryComplianceScore?: number;

	// Review Status
	reviewedBy?: string;
	reviewedAt?: string;
	reviewNotes?: string;
	approvedBy?: string;
	approvedAt?: string;

	// Configuration
	categoryGroups: Record<string, string[]>;
	displayColumns: string[];

	// Metadata
	createdBy: string;
	createdAt: string;
	updatedAt: string;
}

/**
 * Compliance Entry - A single entry in a compliance matrix
 */
export interface ComplianceEntry {
	id: ComplianceEntryId;
	matrixId: ComplianceMatrixId;
	requirementId: RfpRequirementId;

	// Response Mapping
	complianceStatus: RfpComplianceStatus;
	complianceJustification?: string;
	responseDocumentId?: string;
	responseReference?: string;
	responseSummary?: string;

	// Assessment
	strengthAssessment?: StrengthAssessment;
	riskLevel?: RfpRiskLevel;
	mitigationStrategy?: string;
	evidenceReferences: EvidenceReference[];

	// Review Status
	status: "draft" | "review" | "approved" | "rejected";
	reviewerNotes?: string;
	reviewedBy?: string;
	reviewedAt?: string;
	approvedBy?: string;
	approvedAt?: string;

	// Workflow
	assignedTo?: string;
	dueDate?: string;
	completionPercent: number;
	sortOrder: number;

	// Metadata
	notes?: string;
	createdAt: string;
	updatedAt: string;
}

/** Reference to supporting evidence */
export interface EvidenceReference {
	type: "document" | "past_performance" | "certification" | "external";
	id?: string;
	title: string;
	description?: string;
	url?: string;
}

// ============================================================================
// Parsing Job Types
// ============================================================================

/** Parsing job step */
export type ParsingStep =
	| "upload"
	| "text_extraction"
	| "section_detection"
	| "requirement_extraction"
	| "classification"
	| "embedding";

/**
 * RFP Parsing Job - Async parsing operation tracking
 */
export interface RfpParsingJob {
	id: string;
	rfpDocumentId: RfpDocumentId;

	// Status
	status: "queued" | "processing" | "completed" | "failed" | "cancelled";
	currentStep?: ParsingStep;
	progress: number;
	errorMessage?: string;

	// Timing
	queuedAt: string;
	startedAt?: string;
	completedAt?: string;

	// Results
	pagesProcessed?: number;
	requirementsExtracted?: number;
	processingTimeMs?: number;

	// Configuration
	parsingOptions: ParsingOptions;
	modelVersion?: string;

	// Metadata
	initiatedBy: string;
	createdAt: string;
}

/** Options for RFP parsing */
export interface ParsingOptions {
	extractRequirements: boolean;
	generateEmbeddings: boolean;
	detectSections: boolean;
	classifyRequirements: boolean;
}

// ============================================================================
// Input/Output Types
// ============================================================================

/** Input for uploading an RFP document */
export interface UploadRfpInput {
	opportunityId?: string;
	file: File;
	options?: Partial<ParsingOptions>;
}

/** Input for creating a compliance matrix */
export interface CreateComplianceMatrixInput {
	opportunityId: string;
	rfpDocumentId?: string;
	name: string;
	description?: string;
	includeRequirementIds?: string[];
}

/** Input for updating a compliance entry */
export interface UpdateComplianceEntryInput {
	complianceStatus?: RfpComplianceStatus;
	complianceJustification?: string;
	responseDocumentId?: string;
	responseReference?: string;
	responseSummary?: string;
	strengthAssessment?: StrengthAssessment;
	riskLevel?: RfpRiskLevel;
	mitigationStrategy?: string;
	evidenceReferences?: EvidenceReference[];
	assignedTo?: string;
	dueDate?: string;
	notes?: string;
}

/** Filters for listing requirements */
export interface RfpRequirementFilters {
	rfpDocumentId?: string;
	opportunityId?: string;
	category?: RfpRequirementCategory;
	priority?: RfpRequirementPriority;
	complianceStatus?: RfpComplianceStatus;
	riskLevel?: RfpRiskLevel;
	assignedTo?: string;
	search?: string;
}

/** Filters for listing compliance matrices */
export interface ComplianceMatrixFilters {
	opportunityId?: string;
	status?: MatrixStatus;
	search?: string;
}

// ============================================================================
// AI Analysis Types
// ============================================================================

/** AI-generated requirement analysis */
export interface RequirementAnalysis {
	requirementId: RfpRequirementId;
	category: RfpRequirementCategory;
	subcategory?: string;
	priority: RfpRequirementPriority;
	riskLevel: RfpRiskLevel;
	confidence: number;
	keyTerms: string[];
	relatedRequirements: string[];
	suggestedApproach?: string;
	clarificationQuestions: string[];
	ambiguityLevel: AmbiguityLevel;
}

/** AI-generated RFP summary */
export interface RfpSummary {
	rfpDocumentId: RfpDocumentId;
	summary: string;
	keyThemes: string[];
	evaluationCriteria: EvaluationCriterion[];
	criticalRequirements: RequirementSummary[];
	recommendedApproach?: string;
	estimatedEffort?: string;
}

/** Evaluation criterion from Section M */
export interface EvaluationCriterion {
	id: string;
	name: string;
	weight?: number;
	description?: string;
	subfactors?: EvaluationCriterion[];
}

// ============================================================================
// Response Types
// ============================================================================

/** Paginated requirements list */
export interface RequirementListResponse {
	requirements: RfpRequirement[];
	total: number;
	offset: number;
	limit: number;
	hasMore: boolean;
}

/** Compliance matrix with entries */
export interface ComplianceMatrixWithEntries extends ComplianceMatrix {
	entries: ComplianceEntry[];
	requirements: Record<string, RfpRequirement>;
}

/** RFP document with requirements */
export interface RfpDocumentWithRequirements extends RfpDocument {
	requirements: RfpRequirement[];
	totalRequirements: number;
	requirementsByCategory: Record<RfpRequirementCategory, number>;
}
