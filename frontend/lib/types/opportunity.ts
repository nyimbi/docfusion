/**
 * Opportunity Types - DocFusion
 *
 * Type definitions for RFP/EOI/Tender opportunities,
 * import processing, and ranking/analysis features.
 */

// ============================================================================
// Core Opportunity Types
// ============================================================================

/** Decision status for an opportunity */
export type DecisionStatus =
	| "pending"
	| "interested"
	| "pursuing"
	| "submitted"
	| "won"
	| "lost"
	| "declined"
	| "expired";

/** Revenue potential category */
export type RevenuePotential = "low" | "medium" | "high" | "very_high";

/** Opportunity type */
export type OpportunityType = "rfp" | "eoi" | "tender" | "grant" | "other";

/** Priority rank (1-5, 5 = highest) */
export type PriorityRank = 1 | 2 | 3 | 4 | 5;

/**
 * Core opportunity data structure.
 */
export interface Opportunity {
	id: string;
	sourceId: string | null;
	title: string;
	category: string | null;
	itCategory: string | null;
	sector: string | null;
	countryRegion: string | null;
	organization: string | null;
	funder: string | null;
	deadline: Date | null;
	daysLeft: number | null;
	isExpired: boolean;
	budgetValue: string | null;
	budgetNumeric: number | null;
	budgetCurrency: string | null;
	projectSummary: string | null;
	projectScope: string | null;
	keyRequirements: string | null;
	technicalRequirements: string | null;
	submissionMethod: string | null;
	submissionRequirements: string | null;
	rfpLink: string | null;
	sourcePlatform: string | null;
	sourceFile: string | null;
	opportunityType: OpportunityType;

	// Ranking & Analysis
	priorityRank: PriorityRank;
	fitScore: number | null;
	winProbability: number | null;
	revenuePotential: RevenuePotential | null;
	strategicNotes: string | null;
	decisionStatus: DecisionStatus;
	decisionReason: string | null;
	assignedTo: string | null;

	// Metadata
	isReviewed: boolean;
	tags: string[];
	metadata: Record<string, unknown> | null;
	createdAt: Date;
	updatedAt: Date;
	importedAt: Date;
}

/**
 * Opportunity for display in lists (subset of fields).
 */
export interface OpportunityListItem {
	id: string;
	sourceId: string | null;
	title: string;
	category: string | null;
	countryRegion: string | null;
	organization: string | null;
	deadline: Date | null;
	daysLeft: number | null;
	isExpired: boolean;
	budgetValue: string | null;
	priorityRank: PriorityRank;
	fitScore: number | null;
	decisionStatus: DecisionStatus;
	assignedTo: string | null;
	tags: string[];
}

/**
 * Input for creating/updating an opportunity.
 */
export interface OpportunityInput {
	sourceId?: string;
	title: string;
	category?: string;
	itCategory?: string;
	sector?: string;
	countryRegion?: string;
	organization?: string;
	funder?: string;
	deadline?: Date | string;
	budgetValue?: string;
	budgetNumeric?: number;
	budgetCurrency?: string;
	projectSummary?: string;
	projectScope?: string;
	keyRequirements?: string;
	technicalRequirements?: string;
	submissionMethod?: string;
	submissionRequirements?: string;
	rfpLink?: string;
	sourcePlatform?: string;
	sourceFile?: string;
	opportunityType?: OpportunityType;
	priorityRank?: PriorityRank;
	fitScore?: number;
	winProbability?: number;
	revenuePotential?: RevenuePotential;
	strategicNotes?: string;
	decisionStatus?: DecisionStatus;
	decisionReason?: string;
	assignedTo?: string;
	isReviewed?: boolean;
	tags?: string[];
	metadata?: Record<string, unknown>;
}

// ============================================================================
// Import Types
// ============================================================================

/** Import status */
export type ImportStatus = "pending" | "processing" | "completed" | "failed";

/**
 * Column mapping configuration for import.
 */
export interface ColumnMapping {
	/** Target field name */
	field: keyof OpportunityInput;
	/** Source column name(s) from spreadsheet */
	sourceColumns: string[];
	/** Whether this field is required */
	required?: boolean;
	/** Transform function name */
	transform?: "date" | "currency" | "number" | "trim" | "lowercase";
}

/**
 * Import configuration.
 */
export interface ImportConfig {
	/** Column mappings */
	columnMappings: ColumnMapping[];
	/** Sheet name or index to import */
	sheetName?: string;
	/** Skip first N rows (for headers) */
	skipRows?: number;
	/** Whether to update existing records */
	updateExisting?: boolean;
	/** How to identify existing records */
	matchBy?: "sourceId" | "title" | "sourceIdAndFile";
}

/**
 * Import result for a single record.
 */
export interface ImportRecordResult {
	rowIndex: number;
	status: "created" | "updated" | "skipped" | "failed";
	opportunityId?: string;
	error?: string;
	data?: Partial<OpportunityInput>;
}

/**
 * Import job record.
 */
export interface OpportunityImport {
	id: string;
	filename: string;
	filePath: string | null;
	totalRecords: number;
	importedRecords: number;
	updatedRecords: number;
	skippedRecords: number;
	failedRecords: number;
	status: ImportStatus;
	errors: ImportRecordResult[];
	config: ImportConfig | null;
	importedBy: string;
	startedAt: Date;
	completedAt: Date | null;
}

// ============================================================================
// Filter & Sort Types
// ============================================================================

/**
 * Filter criteria for opportunities.
 */
export interface OpportunityFilters {
	search?: string;
	categories?: string[];
	sectors?: string[];
	countries?: string[];
	organizations?: string[];
	statuses?: DecisionStatus[];
	priorityRanks?: PriorityRank[];
	tags?: string[];
	isExpired?: boolean;
	isReviewed?: boolean;
	deadlineFrom?: Date;
	deadlineTo?: Date;
	budgetMin?: number;
	budgetMax?: number;
	fitScoreMin?: number;
	fitScoreMax?: number;
	sourceFiles?: string[];
	assignedTo?: string;
}

/**
 * Sort options for opportunities.
 */
export type OpportunitySortField =
	| "deadline"
	| "priorityRank"
	| "fitScore"
	| "budgetNumeric"
	| "title"
	| "organization"
	| "category"
	| "countryRegion"
	| "createdAt"
	| "updatedAt";

export type SortDirection = "asc" | "desc";

export interface OpportunitySort {
	field: OpportunitySortField;
	direction: SortDirection;
}

/**
 * Pagination options.
 */
export interface PaginationOptions {
	page: number;
	pageSize: number;
}

/**
 * Paginated response.
 */
export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Summary statistics for opportunities.
 */
export interface OpportunityStats {
	total: number;
	byStatus: Record<DecisionStatus, number>;
	byPriority: Record<PriorityRank, number>;
	byCategory: { category: string; count: number }[];
	byCountry: { country: string; count: number }[];
	expiredCount: number;
	activeCount: number;
	upcomingDeadlines: { date: Date; count: number }[];
	totalEstimatedValue: number;
	averageFitScore: number | null;
}

/**
 * Ranking criteria weights for AI scoring.
 */
export interface RankingCriteria {
	/** Weight for budget size (0-1) */
	budgetWeight: number;
	/** Weight for deadline proximity (0-1) */
	deadlineWeight: number;
	/** Weight for category match (0-1) */
	categoryMatchWeight: number;
	/** Weight for geographic preference (0-1) */
	geographyWeight: number;
	/** Weight for technical fit (0-1) */
	technicalFitWeight: number;
	/** Weight for strategic alignment (0-1) */
	strategicWeight: number;
	/** Preferred categories */
	preferredCategories?: string[];
	/** Preferred countries/regions */
	preferredCountries?: string[];
	/** Technical capabilities we have */
	technicalCapabilities?: string[];
}

/**
 * AI analysis result for an opportunity.
 */
export interface OpportunityAnalysis {
	opportunityId: string;
	fitScore: number;
	winProbability: number;
	revenuePotential: RevenuePotential;
	strengths: string[];
	weaknesses: string[];
	recommendations: string[];
	competitorAnalysis?: string;
	riskFactors: string[];
	analyzedAt: Date;
}

// ============================================================================
// Spreadsheet Parsing Types
// ============================================================================

/**
 * Detected spreadsheet format based on column headers.
 */
export interface DetectedFormat {
	type:
		| "software_dev_rfps"
		| "africa_ngo_rfps"
		| "africa_software_rfps"
		| "africa_commercial_rfps"
		| "unknown";
	confidence: number;
	columnMapping: ColumnMapping[];
	sheetName: string;
}

/**
 * Raw row from spreadsheet before normalization.
 */
export interface RawSpreadsheetRow {
	[column: string]: string | number | Date | null | undefined;
}

/**
 * Normalized opportunity from any spreadsheet format.
 */
export interface NormalizedOpportunity extends OpportunityInput {
	_rawRow?: RawSpreadsheetRow;
	_parseErrors?: string[];
}

// ============================================================================
// Go/No-Go Voting Types
// ============================================================================

/** Vote decision */
export type VoteDecision = "go" | "no_go" | "abstain";

/** Confidence level (1-5, 5 = highest) */
export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;

/**
 * A single vote on an opportunity.
 */
export interface OpportunityVote {
	id: string;
	opportunityId: string;
	userId: string;
	userName: string | null;
	vote: VoteDecision;
	confidence: ConfidenceLevel | null;
	justification: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input for casting a vote.
 */
export interface CastVoteInput {
	opportunityId: string;
	userId: string;
	userName?: string;
	vote: VoteDecision;
	confidence?: ConfidenceLevel;
	justification?: string;
}

/**
 * Summary of votes for an opportunity.
 */
export interface VoteSummary {
	opportunityId: string;
	totalVotes: number;
	goCount: number;
	noGoCount: number;
	abstainCount: number;
	averageConfidence: number | null;
	/** Percentage of go votes (0-100) */
	goPercentage: number;
	/** Consensus reached when 60%+ agree */
	hasConsensus: boolean;
	/** Recommended decision based on votes */
	recommendedDecision: VoteDecision | null;
}

// ============================================================================
// AI Scoring Types
// ============================================================================

/** AI score type */
export type AIScoreType = "fit" | "win_probability" | "risk" | "effort";

/**
 * A factor that contributes to an AI score.
 */
export interface AIScoreFactor {
	factor: string;
	weight: number;
	score: number;
	reasoning: string;
}

/**
 * AI score record.
 */
export interface OpportunityAIScore {
	id: string;
	opportunityId: string;
	scoreType: AIScoreType;
	score: number;
	factors: AIScoreFactor[];
	modelVersion: string | null;
	reasoning: string | null;
	createdAt: Date;
}

/**
 * Input for calculating AI score.
 */
export interface CalculateAIScoreInput {
	opportunityId: string;
	scoreType: AIScoreType;
}

/**
 * Combined AI scores for an opportunity.
 */
export interface OpportunityAIScoreSummary {
	opportunityId: string;
	fitScore: number | null;
	winProbability: number | null;
	riskScore: number | null;
	effortScore: number | null;
	lastUpdated: Date | null;
}

// ============================================================================
// Requirements Types
// ============================================================================

/** Requirement category */
export type RequirementCategory =
	| "technical"
	| "legal"
	| "financial"
	| "experience"
	| "administrative"
	| "personnel"
	| "security"
	| "compliance"
	| "other";

/** Requirement priority */
export type RequirementPriority = "mandatory" | "preferred" | "optional";

/** Compliance status */
export type ComplianceStatus =
	| "not_addressed"
	| "partial"
	| "compliant"
	| "non_compliant"
	| "not_applicable";

/** Risk level */
export type RiskLevel = "low" | "medium" | "high" | "critical";

/**
 * AI analysis for a requirement.
 */
export interface RequirementAIAnalysis {
	difficultyScore: number;
	suggestedApproach: string;
	relatedCapabilities: string[];
	potentialRisks: string[];
	estimatedEffort: string;
	analyzedAt: Date;
}

/**
 * A single requirement extracted from an RFP.
 */
export interface Requirement {
	id: string;
	opportunityId: string;
	requirementId: string | null;
	category: RequirementCategory | null;
	subcategory: string | null;
	text: string;
	source: string | null;
	sourcePageRef: string | null;
	priority: RequirementPriority | null;
	complianceStatus: ComplianceStatus;
	responseStrategy: string | null;
	assignedTo: string | null;
	dueDate: Date | null;
	notes: string | null;
	riskLevel: RiskLevel | null;
	aiAnalysis: RequirementAIAnalysis | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input for creating a requirement.
 */
export interface RequirementInput {
	opportunityId: string;
	requirementId?: string;
	category?: RequirementCategory;
	subcategory?: string;
	text: string;
	source?: string;
	sourcePageRef?: string;
	priority?: RequirementPriority;
	complianceStatus?: ComplianceStatus;
	responseStrategy?: string;
	assignedTo?: string;
	dueDate?: Date | string;
	notes?: string;
	riskLevel?: RiskLevel;
}

/**
 * Input for updating a requirement.
 */
export interface RequirementUpdateInput {
	requirementId?: string;
	category?: RequirementCategory;
	subcategory?: string;
	text?: string;
	source?: string;
	sourcePageRef?: string;
	priority?: RequirementPriority;
	complianceStatus?: ComplianceStatus;
	responseStrategy?: string;
	assignedTo?: string;
	dueDate?: Date | string | null;
	notes?: string;
	riskLevel?: RiskLevel;
}

/**
 * Filter criteria for requirements.
 */
export interface RequirementFilters {
	search?: string;
	categories?: RequirementCategory[];
	priorities?: RequirementPriority[];
	complianceStatuses?: ComplianceStatus[];
	riskLevels?: RiskLevel[];
	assignedTo?: string;
	hasDueDate?: boolean;
	isOverdue?: boolean;
}

/**
 * Sort options for requirements.
 */
export type RequirementSortField =
	| "requirementId"
	| "category"
	| "priority"
	| "complianceStatus"
	| "riskLevel"
	| "dueDate"
	| "createdAt"
	| "updatedAt";

export interface RequirementSort {
	field: RequirementSortField;
	direction: SortDirection;
}

/**
 * Summary statistics for requirements.
 */
export interface RequirementStats {
	total: number;
	byCategory: Record<string, number>;
	byPriority: Record<RequirementPriority, number>;
	byStatus: Record<ComplianceStatus, number>;
	byRiskLevel: Record<string, number>;
	compliancePercentage: number;
	overdueCount: number;
	unassignedCount: number;
}

/**
 * Extracted requirement from AI analysis (before saving).
 */
export interface ExtractedRequirement {
	text: string;
	category: RequirementCategory | null;
	subcategory: string | null;
	source: string | null;
	sourcePageRef: string | null;
	priority: RequirementPriority | null;
	suggestedRiskLevel: RiskLevel | null;
}

/**
 * Result of requirement extraction.
 */
export interface ExtractionResult {
	requirements: ExtractedRequirement[];
	documentInfo: {
		title: string | null;
		organization: string | null;
		deadline: string | null;
		totalPages: number | null;
	};
	confidence: number;
	processingTime: number;
}

/**
 * Gap analysis result.
 */
export interface RequirementGapAnalysis {
	opportunityId: string;
	gaps: {
		category: RequirementCategory;
		description: string;
		severity: RiskLevel;
		suggestedAction: string;
	}[];
	overallReadiness: number;
	recommendations: string[];
	analyzedAt: Date;
}

// ============================================================================
// Proposal Document Types
// ============================================================================

/** Proposal document type within a proposal */
export type ProposalDocumentType =
	| "technical_approach"
	| "management_plan"
	| "past_performance"
	| "cost_proposal"
	| "cover_letter"
	| "executive_summary"
	| "staffing_plan"
	| "quality_assurance"
	| "risk_mitigation"
	| "appendix"
	| "other";

/** Proposal document development status */
export type ProposalDocumentStatus =
	| "not_started"
	| "drafting"
	| "in_review"
	| "revising"
	| "approved"
	| "final";

/**
 * A proposal document linked to an opportunity.
 */
export interface ProposalDocument {
	id: string;
	opportunityId: string;
	documentId: string;
	documentType: ProposalDocumentType;
	sectionOrder: number;
	status: ProposalDocumentStatus;
	assignedTo: string | null;
	dueDate: Date | null;
	reviewerId: string | null;
	approvedBy: string | null;
	approvedAt: Date | null;
	aiAnalysisScore: number | null;
	aiAnalysisAt: Date | null;
	notes: string | null;
	createdAt: Date;
	updatedAt: Date;
	/** Joined document data */
	document?: {
		id: string;
		title: string;
		wordCount: number;
		status: string;
		updatedAt: Date;
	};
}

/**
 * Input for creating a proposal document link.
 */
export interface CreateProposalDocumentInput {
	opportunityId: string;
	documentType: ProposalDocumentType;
	title?: string;
	templateId?: string;
	assignedTo?: string;
	dueDate?: Date | string;
	notes?: string;
}

/**
 * Input for linking an existing document to a proposal.
 */
export interface LinkDocumentInput {
	opportunityId: string;
	documentId: string;
	documentType: ProposalDocumentType;
	sectionOrder?: number;
	assignedTo?: string;
	dueDate?: Date | string;
	notes?: string;
}

/**
 * Input for updating a proposal document.
 */
export interface UpdateProposalDocumentInput {
	documentType?: ProposalDocumentType;
	sectionOrder?: number;
	status?: ProposalDocumentStatus;
	assignedTo?: string | null;
	dueDate?: Date | string | null;
	reviewerId?: string | null;
	notes?: string | null;
}

/**
 * Progress summary for proposal documents.
 */
export interface ProposalProgress {
	opportunityId: string;
	totalDocuments: number;
	byStatus: Record<ProposalDocumentStatus, number>;
	completionPercentage: number;
	documentsOnTrack: number;
	documentsOverdue: number;
	documentsAtRisk: number;
	nextDeadline: Date | null;
	averageAiScore: number | null;
}

// ============================================================================
// Document Section Types
// ============================================================================

/** Document section status */
export type DocumentSectionStatus =
	| "not_started"
	| "drafting"
	| "in_review"
	| "revising"
	| "approved"
	| "final";

/**
 * A section within a proposal document.
 */
export interface DocumentSection {
	id: string;
	proposalDocumentId: string;
	sectionName: string;
	sectionOrder: number;
	status: DocumentSectionStatus;
	wordCount: number;
	targetWordCount: number | null;
	assignedTo: string | null;
	dueDate: Date | null;
	requirementIds: string[];
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input for creating a document section.
 */
export interface CreateSectionInput {
	proposalDocumentId: string;
	sectionName: string;
	sectionOrder?: number;
	targetWordCount?: number;
	assignedTo?: string;
	dueDate?: Date | string;
	requirementIds?: string[];
}

/**
 * Input for updating a document section.
 */
export interface UpdateSectionInput {
	sectionName?: string;
	sectionOrder?: number;
	status?: DocumentSectionStatus;
	wordCount?: number;
	targetWordCount?: number | null;
	assignedTo?: string | null;
	dueDate?: Date | string | null;
	requirementIds?: string[];
}

/**
 * Section progress with word count tracking.
 */
export interface SectionProgress {
	sectionId: string;
	sectionName: string;
	wordCount: number;
	targetWordCount: number | null;
	progressPercentage: number;
	status: DocumentSectionStatus;
	requirementsAddressed: number;
	totalRequirements: number;
}

// ============================================================================
// Document Analysis Types (30+ Factor AI Analysis)
// ============================================================================

/** Analysis factor category */
export type AnalysisFactorCategory =
	| "clarity"
	| "compliance"
	| "persuasiveness"
	| "technical";

/** Issue severity level */
export type IssueSeverity = "info" | "warning" | "error" | "critical";

/** Suggestion impact level */
export type SuggestionImpact = "low" | "medium" | "high";

/**
 * A single analysis factor score.
 */
export interface AnalysisFactor {
	id: string;
	name: string;
	category: AnalysisFactorCategory;
	description: string;
	score: number; // 0-100
	weight: number; // 0-1, how much this factor contributes
	issues: AnalysisIssue[];
	suggestions: AnalysisSuggestion[];
}

/**
 * An issue found during analysis.
 */
export interface AnalysisIssue {
	id: string;
	severity: IssueSeverity;
	factorId: string;
	message: string;
	location?: {
		paragraphIndex?: number;
		startOffset?: number;
		endOffset?: number;
		text?: string;
	};
	suggestion?: string;
}

/**
 * A suggestion for improvement.
 */
export interface AnalysisSuggestion {
	id: string;
	type: "rewrite" | "add" | "remove" | "restructure" | "clarify";
	text: string;
	impact: SuggestionImpact;
	location?: {
		paragraphIndex?: number;
		startOffset?: number;
		endOffset?: number;
	};
	replacement?: string;
}

/**
 * Category-level score summary.
 */
export interface CategoryScore {
	category: AnalysisFactorCategory;
	score: number;
	factorCount: number;
	issueCount: number;
	topIssues: AnalysisIssue[];
}

/**
 * Full document analysis result.
 */
export interface DocumentAnalysis {
	id: string;
	documentId: string;
	proposalDocumentId: string | null;
	overallScore: number;
	categoryScores: CategoryScore[];
	factors: AnalysisFactor[];
	issues: AnalysisIssue[];
	suggestions: AnalysisSuggestion[];
	wordCount: number;
	paragraphCount: number;
	analyzedAt: Date;
	modelVersion: string | null;
}

/**
 * Paragraph-level analysis for heatmap.
 */
export interface ParagraphAnalysis {
	id: string;
	analysisId: string;
	paragraphIndex: number;
	text: string;
	score: number;
	issues: AnalysisIssue[];
	suggestions: AnalysisSuggestion[];
}

/**
 * Input for running analysis.
 */
export interface AnalyzeDocumentInput {
	documentId: string;
	proposalDocumentId?: string;
	/** Specific categories to analyze (default: all) */
	categories?: AnalysisFactorCategory[];
	/** Whether to include paragraph-level analysis */
	includeParagraphs?: boolean;
}

/**
 * Analysis history entry.
 */
export interface AnalysisHistoryEntry {
	id: string;
	overallScore: number;
	analyzedAt: Date;
	wordCount: number;
	issueCount: number;
}

/**
 * Analysis comparison between two versions.
 */
export interface AnalysisComparison {
	current: DocumentAnalysis;
	previous: DocumentAnalysis | null;
	scoreDelta: number;
	resolvedIssues: AnalysisIssue[];
	newIssues: AnalysisIssue[];
	improvedFactors: string[];
	declinedFactors: string[];
}

// ============================================================================
// Calendar & Deadline Types
// ============================================================================

/** Type of deadline item */
export type DeadlineType =
	| "opportunity"
	| "requirement"
	| "proposal_document"
	| "document_section"
	| "review"
	| "submission";

/** Deadline urgency based on days remaining */
export type DeadlineUrgency =
	| "overdue"
	| "critical" // <= 3 days
	| "urgent" // <= 7 days
	| "upcoming" // <= 14 days
	| "normal"; // > 14 days

/**
 * A unified deadline item from any source.
 */
export interface DeadlineItem {
	id: string;
	type: DeadlineType;
	title: string;
	description: string | null;
	deadline: Date;
	daysUntil: number;
	urgency: DeadlineUrgency;
	/** Source entity ID (opportunityId, documentId, etc.) */
	sourceId: string;
	/** For nested items, the parent opportunity */
	opportunityId: string;
	opportunityTitle: string;
	/** Assignee if any */
	assignedTo: string | null;
	/** Status of the related item */
	status: string | null;
	/** Additional context */
	metadata?: Record<string, unknown>;
}

/**
 * Filter criteria for calendar/deadlines.
 */
export interface DeadlineFilters {
	types?: DeadlineType[];
	urgencies?: DeadlineUrgency[];
	opportunityIds?: string[];
	assignedTo?: string;
	includeCompleted?: boolean;
	search?: string;
}

/**
 * Input for date range queries.
 */
export interface DateRangeInput {
	startDate: Date | string;
	endDate: Date | string;
	filters?: DeadlineFilters;
}

/**
 * Input for upcoming deadlines query.
 */
export interface UpcomingDeadlinesInput {
	days: number;
	filters?: DeadlineFilters;
	limit?: number;
}

/**
 * Grouped deadlines by date for calendar view.
 */
export interface DeadlinesByDate {
	date: string; // ISO date string (YYYY-MM-DD)
	items: DeadlineItem[];
	count: number;
}

/**
 * Calendar month summary.
 */
export interface CalendarMonthSummary {
	month: number;
	year: number;
	totalDeadlines: number;
	byDate: DeadlinesByDate[];
	overdueCount: number;
	criticalCount: number;
	urgentCount: number;
}

/**
 * Milestone for opportunity timeline view.
 */
export interface OpportunityMilestone {
	id: string;
	type: DeadlineType;
	title: string;
	date: Date;
	status: "pending" | "in_progress" | "completed" | "overdue";
	description: string | null;
	assignedTo: string | null;
	/** For document milestones, the document ID */
	documentId?: string;
	/** For requirement milestones, the requirement ID */
	requirementId?: string;
}

/**
 * Summary statistics for deadlines.
 */
export interface DeadlineStats {
	total: number;
	overdue: number;
	dueToday: number;
	dueThisWeek: number;
	dueThisMonth: number;
	byType: Record<DeadlineType, number>;
	byUrgency: Record<DeadlineUrgency, number>;
	nextDeadline: DeadlineItem | null;
}

// ============================================================================
// Document Rendering Types
// ============================================================================

/** Export format options */
export type ExportFormat = "pdf" | "docx" | "pptx" | "latex" | "markdown" | "html";

/** Paper size options */
export type PaperSize = "letter" | "a4" | "legal";

/** Page orientation */
export type PageOrientation = "portrait" | "landscape";

/**
 * Branding configuration for exports.
 */
export interface BrandingConfig {
	id: string;
	name: string;
	/** Company/organization name */
	companyName: string;
	/** Logo URL or base64 */
	logoUrl?: string;
	/** Primary brand color (hex) */
	primaryColor: string;
	/** Secondary brand color (hex) */
	secondaryColor?: string;
	/** Header text/tagline */
	headerText?: string;
	/** Footer text */
	footerText?: string;
	/** Contact information */
	contactInfo?: {
		address?: string;
		phone?: string;
		email?: string;
		website?: string;
	};
	/** Font settings */
	fonts?: {
		heading?: string;
		body?: string;
	};
}

/**
 * Render options for document export.
 */
export interface RenderOptions {
	format: ExportFormat;
	/** Paper size */
	paperSize?: PaperSize;
	/** Page orientation */
	orientation?: PageOrientation;
	/** Margins in inches */
	margins?: {
		top?: number;
		bottom?: number;
		left?: number;
		right?: number;
	};
	/** Branding to apply */
	branding?: BrandingConfig;
	/** Include table of contents */
	includeTableOfContents?: boolean;
	/** Include page numbers */
	includePageNumbers?: boolean;
	/** Include header */
	includeHeader?: boolean;
	/** Include footer */
	includeFooter?: boolean;
	/** Header content override */
	headerContent?: string;
	/** Footer content override */
	footerContent?: string;
	/** Watermark text */
	watermark?: string;
	/** Document metadata */
	metadata?: {
		title?: string;
		author?: string;
		subject?: string;
		keywords?: string[];
		createdDate?: Date;
	};
	/** For PPTX: slide template */
	slideTemplate?: "default" | "executive" | "technical" | "minimal";
}

/**
 * Render result with file data.
 */
export interface RenderResult {
	success: boolean;
	format: ExportFormat;
	/** Base64-encoded file content */
	data?: string;
	/** File size in bytes */
	size?: number;
	/** MIME type */
	mimeType?: string;
	/** Suggested filename */
	filename?: string;
	/** Error message if failed */
	error?: string;
	/** Render time in ms */
	renderTimeMs?: number;
	/** Page count (for PDF/PPTX) */
	pageCount?: number;
}

/**
 * Pre-submission audit result.
 */
export interface PreSubmissionAudit {
	opportunityId: string;
	isReady: boolean;
	/** Overall readiness score (0-100) */
	readinessScore: number;
	/** Checks performed */
	checks: AuditCheck[];
	/** Documents included */
	documents: {
		id: string;
		title: string;
		type: ProposalDocumentType;
		status: ProposalDocumentStatus;
		isReady: boolean;
		issues: string[];
	}[];
	/** Missing required documents */
	missingDocuments: ProposalDocumentType[];
	/** Overall issues */
	issues: string[];
	/** Recommendations */
	recommendations: string[];
	auditedAt: Date;
}

/**
 * A single audit check result.
 */
export interface AuditCheck {
	id: string;
	name: string;
	category: "completeness" | "compliance" | "quality" | "formatting";
	passed: boolean;
	severity: "error" | "warning" | "info";
	message: string;
	/** Which document this relates to */
	documentId?: string;
}

// ============================================================================
// Submission Types (Batch 7)
// ============================================================================

/** Submission method */
export type SubmissionMethod = "portal" | "email" | "physical" | "ftp" | "other";

/** Submission status */
export type SubmissionStatus =
	| "submitted"
	| "under_review"
	| "shortlisted"
	| "won"
	| "lost"
	| "withdrawn"
	| "no_award";

/** Submission outcome */
export type SubmissionOutcome = "won" | "lost" | "withdrawn" | "no_award";

/**
 * A proposal submission record.
 */
export interface Submission {
	id: string;
	opportunityId: string;
	submittedAt: Date;
	submittedBy: string;
	submissionMethod: SubmissionMethod | null;
	confirmationNumber: string | null;
	attachments: SubmissionAttachment[];
	notes: string | null;
	status: SubmissionStatus;
	outcome: SubmissionOutcome | null;
	outcomeDate: Date | null;
	outcomeNotes: string | null;
	evaluatorFeedback: string | null;
	lessonsLearned: string | null;
	contractValue: number | null;
	contractDuration: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Attachment included in a submission.
 */
export interface SubmissionAttachment {
	documentId: string;
	documentTitle: string;
	documentType: ProposalDocumentType;
	fileSize?: number;
}

/**
 * Input for creating a submission.
 */
export interface CreateSubmissionInput {
	opportunityId: string;
	submittedBy: string;
	submissionMethod?: SubmissionMethod;
	confirmationNumber?: string;
	attachmentIds: string[];
	notes?: string;
}

/**
 * Input for updating submission status.
 */
export interface UpdateSubmissionStatusInput {
	submissionId: string;
	status: SubmissionStatus;
	notes?: string;
}

/**
 * Input for recording an outcome.
 */
export interface RecordOutcomeInput {
	submissionId: string;
	outcome: SubmissionOutcome;
	outcomeNotes?: string;
	evaluatorFeedback?: string;
	lessonsLearned?: string;
	contractValue?: number;
	contractDuration?: string;
}

/**
 * Pre-submission checklist item.
 */
export interface PreSubmissionChecklistItem {
	id: string;
	label: string;
	description: string;
	category: "documents" | "compliance" | "formatting" | "administrative";
	isRequired: boolean;
	isCompleted: boolean;
	completedAt?: Date;
	completedBy?: string;
	notes?: string;
}

/**
 * Win/loss analytics data.
 */
export interface WinLossAnalytics {
	totalSubmissions: number;
	wins: number;
	losses: number;
	withdrawn: number;
	noAward: number;
	pending: number;
	winRate: number;
	/** Win rate by category */
	winRateByCategory: Record<string, { wins: number; total: number; rate: number }>;
	/** Win rate by value range */
	winRateByValueRange: {
		range: string;
		wins: number;
		total: number;
		rate: number;
	}[];
	/** Win rate trend over time */
	winRateTrend: {
		period: string;
		wins: number;
		total: number;
		rate: number;
	}[];
	/** Total contract value won */
	totalValueWon: number;
	/** Average contract value */
	averageValueWon: number;
}

// ============================================================================
// Partner Types (Batch 8)
// ============================================================================

/** Partner type */
export type PartnerType = "prime" | "sub" | "consultant" | "vendor" | "other";

/** Partner status */
export type PartnerStatus = "active" | "inactive" | "pending" | "archived";

/** Partner collaboration status on an opportunity */
export type PartnerCollaborationStatus =
	| "invited"
	| "accepted"
	| "active"
	| "completed"
	| "declined";

/**
 * A partner organization.
 */
export interface Partner {
	id: string;
	name: string;
	type: PartnerType | null;
	contactName: string | null;
	contactEmail: string | null;
	contactPhone: string | null;
	capabilities: string[];
	pastCollaborations: number;
	performanceRating: number | null;
	notes: string | null;
	status: PartnerStatus;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Partner list item for display.
 */
export interface PartnerListItem {
	id: string;
	name: string;
	type: PartnerType | null;
	contactName: string | null;
	contactEmail: string | null;
	capabilities: string[];
	pastCollaborations: number;
	performanceRating: number | null;
	status: PartnerStatus;
	activeOpportunities: number;
}

/**
 * Input for creating a partner.
 */
export interface CreatePartnerInput {
	name: string;
	type?: PartnerType;
	contactName?: string;
	contactEmail?: string;
	contactPhone?: string;
	capabilities?: string[];
	notes?: string;
}

/**
 * Input for updating a partner.
 */
export interface UpdatePartnerInput {
	name?: string;
	type?: PartnerType;
	contactName?: string;
	contactEmail?: string;
	contactPhone?: string;
	capabilities?: string[];
	notes?: string;
	status?: PartnerStatus;
	performanceRating?: number;
}

/**
 * Partner assignment to an opportunity.
 */
export interface OpportunityPartner {
	id: string;
	opportunityId: string;
	partnerId: string;
	partner?: Partner;
	role: string | null;
	workShare: number | null;
	assignedSections: string[];
	status: PartnerCollaborationStatus;
	ndaSigned: boolean;
	teamingAgreementSigned: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input for assigning a partner to an opportunity.
 */
export interface AssignPartnerInput {
	opportunityId: string;
	partnerId: string;
	role?: string;
	workShare?: number;
	assignedSections?: string[];
}

/**
 * Input for updating a partner assignment.
 */
export interface UpdatePartnerAssignmentInput {
	assignmentId: string;
	role?: string;
	workShare?: number;
	assignedSections?: string[];
	status?: PartnerCollaborationStatus;
	ndaSigned?: boolean;
	teamingAgreementSigned?: boolean;
}

/**
 * Partner performance summary.
 */
export interface PartnerPerformance {
	partnerId: string;
	partnerName: string;
	totalOpportunities: number;
	winsAsTeam: number;
	lossesAsTeam: number;
	winRate: number;
	averageWorkShare: number;
	rolesPlayed: Record<string, number>;
	averageRating: number | null;
	totalCollaborations: number;
}

/**
 * Partner search/filter options.
 */
export interface PartnerFilters {
	search?: string;
	type?: PartnerType;
	status?: PartnerStatus;
	capabilities?: string[];
	minRating?: number;
	hasAvailability?: boolean;
}

// ============================================================================
// Collaboration Types (Batch 9)
// ============================================================================

/**
 * User presence in a document.
 */
export interface UserPresence {
	documentId: string;
	userId: string;
	userName: string;
	userColor: string;
	cursorPosition?: {
		from: number;
		to: number;
	};
	lastActiveAt: Date;
}

/**
 * Active collaborators on a document.
 */
export interface DocumentCollaborators {
	documentId: string;
	collaborators: UserPresence[];
	lastUpdated: Date;
}

/**
 * Yjs document state for persistence.
 */
export interface YjsDocumentState {
	documentId: string;
	/** Base64-encoded Yjs state */
	state: string;
	/** Base64-encoded state vector */
	stateVector: string;
	updatedAt: Date;
}

/**
 * Input for updating presence.
 */
export interface UpdatePresenceInput {
	documentId: string;
	userId: string;
	userName: string;
	cursorPosition?: {
		from: number;
		to: number;
	};
}

/**
 * Collaboration session info.
 */
export interface CollaborationSession {
	documentId: string;
	documentTitle: string;
	activeUsers: number;
	startedAt: Date;
	lastActivityAt: Date;
}
