/**
 * CRM Type Definitions for DocFusion
 *
 * Comprehensive type system for the CRM module including:
 * - Account types and pipeline stages
 * - Contact roles and relationships
 * - Activity types and statuses
 * - Deal pipeline configuration
 * - Filter and sort options for queries
 * - Input types for CRUD operations
 */

import type {
	AccountRow,
	ContactRow,
	ActivityRow,
	DealRow,
	CrmDocumentRow,
	AccountStageHistoryRow,
	DealStageHistoryRow,
} from "@/lib/db/schema-crm";

// ============================================================================
// ACCOUNT TYPES AND ENUMS
// ============================================================================

/**
 * Account type discriminator values.
 */
export type AccountType =
	| "partner"
	| "prospect"
	| "lead"
	| "customer"
	| "vendor"
	| "other";

/**
 * Account status values.
 */
export type AccountStatus =
	| "active"
	| "inactive"
	| "churned"
	| "lost"
	| "archived";

/**
 * Company size categories.
 */
export type CompanySize =
	| "micro"      // 1-9 employees
	| "small"      // 10-49 employees
	| "medium"     // 50-249 employees
	| "large"      // 250-999 employees
	| "enterprise"; // 1000+ employees

/**
 * Partner tier levels.
 */
export type PartnerTier = 1 | 2 | 3;

/**
 * Customer churn risk levels.
 */
export type ChurnRisk = "low" | "medium" | "high";

/**
 * Lead qualification status.
 */
export type QualificationStatus =
	| "unqualified"
	| "mql"        // Marketing Qualified Lead
	| "sql"        // Sales Qualified Lead
	| "opportunity"
	| "customer";

/**
 * Preferred contact methods.
 */
export type ContactMethod =
	| "email"
	| "phone"
	| "linkedin"
	| "whatsapp"
	| "in_person";

// ============================================================================
// PIPELINE STAGES BY ACCOUNT TYPE
// ============================================================================

/**
 * Partner pipeline stages.
 */
export type PartnerStage =
	| "identified"
	| "researching"
	| "outreach"
	| "evaluation"
	| "negotiating"
	| "onboarding"
	| "active"
	| "dormant"
	| "churned";

/**
 * Prospect/Lead pipeline stages.
 */
export type LeadStage =
	| "new"
	| "contacted"
	| "qualified"
	| "discovery"
	| "proposal"
	| "negotiation"
	| "closed_won"
	| "closed_lost";

/**
 * Customer pipeline stages.
 */
export type CustomerStage =
	| "onboarding"
	| "active"
	| "expansion"
	| "at_risk"
	| "churned";

/**
 * All possible account stages (union of type-specific stages).
 */
export type AccountStage = PartnerStage | LeadStage | CustomerStage | "new";

/**
 * Stage configuration with metadata.
 */
export interface StageConfig {
	id: string;
	label: string;
	color: string;
	description?: string;
	order: number;
}

/**
 * Pipeline stages configuration by account type.
 */
export const ACCOUNT_STAGES: Record<AccountType, StageConfig[]> = {
	partner: [
		{ id: "identified", label: "Identified", color: "gray", order: 1, description: "Potential partner identified" },
		{ id: "researching", label: "Researching", color: "blue", order: 2, description: "Gathering information" },
		{ id: "outreach", label: "Outreach", color: "indigo", order: 3, description: "Initial contact made" },
		{ id: "evaluation", label: "Evaluation", color: "purple", order: 4, description: "Assessing fit" },
		{ id: "negotiating", label: "Negotiating", color: "yellow", order: 5, description: "Terms discussion" },
		{ id: "onboarding", label: "Onboarding", color: "orange", order: 6, description: "Agreement signed, setting up" },
		{ id: "active", label: "Active", color: "green", order: 7, description: "Active partner relationship" },
		{ id: "dormant", label: "Dormant", color: "gray", order: 8, description: "Inactive but maintained" },
		{ id: "churned", label: "Churned", color: "red", order: 9, description: "Relationship ended" },
	],
	prospect: [
		{ id: "new", label: "New", color: "gray", order: 1, description: "New prospect captured" },
		{ id: "contacted", label: "Contacted", color: "blue", order: 2, description: "Initial outreach done" },
		{ id: "qualified", label: "Qualified", color: "indigo", order: 3, description: "Meets qualification criteria" },
		{ id: "discovery", label: "Discovery", color: "purple", order: 4, description: "Understanding needs" },
		{ id: "proposal", label: "Proposal", color: "yellow", order: 5, description: "Proposal sent" },
		{ id: "negotiation", label: "Negotiation", color: "orange", order: 6, description: "Terms discussion" },
		{ id: "closed_won", label: "Closed Won", color: "green", order: 7, description: "Converted to customer" },
		{ id: "closed_lost", label: "Closed Lost", color: "red", order: 8, description: "Did not convert" },
	],
	lead: [
		{ id: "new", label: "New", color: "gray", order: 1, description: "New lead captured" },
		{ id: "contacted", label: "Contacted", color: "blue", order: 2, description: "Initial outreach done" },
		{ id: "qualified", label: "Qualified", color: "indigo", order: 3, description: "Meets qualification criteria" },
		{ id: "discovery", label: "Discovery", color: "purple", order: 4, description: "Understanding needs" },
		{ id: "proposal", label: "Proposal", color: "yellow", order: 5, description: "Proposal sent" },
		{ id: "negotiation", label: "Negotiation", color: "orange", order: 6, description: "Terms discussion" },
		{ id: "closed_won", label: "Closed Won", color: "green", order: 7, description: "Converted to customer" },
		{ id: "closed_lost", label: "Closed Lost", color: "red", order: 8, description: "Did not convert" },
	],
	customer: [
		{ id: "onboarding", label: "Onboarding", color: "blue", order: 1, description: "New customer setup" },
		{ id: "active", label: "Active", color: "green", order: 2, description: "Active customer" },
		{ id: "expansion", label: "Expansion", color: "purple", order: 3, description: "Upsell/cross-sell opportunity" },
		{ id: "at_risk", label: "At Risk", color: "orange", order: 4, description: "Showing churn signals" },
		{ id: "churned", label: "Churned", color: "red", order: 5, description: "Lost customer" },
	],
	vendor: [
		{ id: "new", label: "New", color: "gray", order: 1, description: "New vendor identified" },
		{ id: "evaluation", label: "Evaluation", color: "blue", order: 2, description: "Assessing capabilities" },
		{ id: "active", label: "Active", color: "green", order: 3, description: "Active vendor" },
		{ id: "dormant", label: "Dormant", color: "yellow", order: 4, description: "Inactive but available" },
		{ id: "churned", label: "Churned", color: "red", order: 5, description: "No longer used" },
	],
	other: [
		{ id: "new", label: "New", color: "gray", order: 1, description: "New contact" },
		{ id: "active", label: "Active", color: "green", order: 2, description: "Active relationship" },
		{ id: "inactive", label: "Inactive", color: "yellow", order: 3, description: "Inactive" },
	],
};

// ============================================================================
// CONTACT TYPES AND ENUMS
// ============================================================================

/**
 * Contact role in decision making.
 */
export type ContactRole =
	| "decision_maker"
	| "influencer"
	| "champion"
	| "blocker"
	| "user"
	| "technical"
	| "financial"
	| "other";

/**
 * Contact seniority level.
 */
export type ContactSeniority =
	| "c_level"
	| "vp"
	| "director"
	| "manager"
	| "senior"
	| "individual";

/**
 * Relationship warmth levels.
 */
export type RelationshipStrength = "cold" | "warm" | "hot";

/**
 * Contact sentiment towards us.
 */
export type ContactSentiment =
	| "negative"
	| "neutral"
	| "positive"
	| "champion";

/**
 * Influence level in decisions.
 */
export type InfluenceLevel = "low" | "medium" | "high";

// ============================================================================
// ACTIVITY TYPES AND ENUMS
// ============================================================================

/**
 * Activity type discriminator.
 */
export type ActivityType =
	| "email"
	| "call"
	| "meeting"
	| "task"
	| "note"
	| "linkedin"
	| "whatsapp"
	| "sms"
	| "event"
	| "demo"
	| "proposal";

/**
 * Activity status values.
 */
export type ActivityStatus =
	| "scheduled"
	| "completed"
	| "cancelled"
	| "no_show"
	| "rescheduled";

/**
 * Communication direction.
 */
export type ActivityDirection =
	| "inbound"
	| "outbound"
	| "internal";

/**
 * Activity priority levels.
 */
export type ActivityPriority =
	| "low"
	| "normal"
	| "high"
	| "urgent";

/**
 * Activity type configuration with metadata.
 */
export interface ActivityTypeConfig {
	id: ActivityType;
	label: string;
	icon: string;
	color: string;
	hasDirection: boolean;
	hasDuration: boolean;
}

/**
 * Activity types configuration.
 */
export const ACTIVITY_TYPES: ActivityTypeConfig[] = [
	{ id: "email", label: "Email", icon: "Mail", color: "blue", hasDirection: true, hasDuration: false },
	{ id: "call", label: "Call", icon: "Phone", color: "green", hasDirection: true, hasDuration: true },
	{ id: "meeting", label: "Meeting", icon: "Calendar", color: "purple", hasDirection: false, hasDuration: true },
	{ id: "task", label: "Task", icon: "CheckSquare", color: "orange", hasDirection: false, hasDuration: false },
	{ id: "note", label: "Note", icon: "FileText", color: "gray", hasDirection: false, hasDuration: false },
	{ id: "linkedin", label: "LinkedIn", icon: "Linkedin", color: "blue", hasDirection: true, hasDuration: false },
	{ id: "whatsapp", label: "WhatsApp", icon: "MessageCircle", color: "green", hasDirection: true, hasDuration: false },
	{ id: "sms", label: "SMS", icon: "MessageSquare", color: "teal", hasDirection: true, hasDuration: false },
	{ id: "event", label: "Event", icon: "Users", color: "indigo", hasDirection: false, hasDuration: true },
	{ id: "demo", label: "Demo", icon: "Presentation", color: "pink", hasDirection: false, hasDuration: true },
	{ id: "proposal", label: "Proposal", icon: "FileSignature", color: "yellow", hasDirection: true, hasDuration: false },
];

// ============================================================================
// DEAL TYPES AND ENUMS
// ============================================================================

/**
 * Deal pipeline stages.
 */
export type DealStage =
	| "qualification"
	| "discovery"
	| "proposal"
	| "negotiation"
	| "closed_won"
	| "closed_lost";

/**
 * Deal status values.
 */
export type DealStatus =
	| "open"
	| "won"
	| "lost"
	| "on_hold"
	| "abandoned";

/**
 * Recurring value periods.
 */
export type RecurringPeriod =
	| "monthly"
	| "quarterly"
	| "yearly";

/**
 * Deal loss reasons.
 */
export type LossReason =
	| "price"
	| "features"
	| "timing"
	| "competition"
	| "budget_cut"
	| "no_decision"
	| "relationship"
	| "other";

/**
 * Deal stage configuration with probability.
 */
export interface DealStageConfig {
	id: DealStage;
	label: string;
	color: string;
	probability: number;
	order: number;
}

/**
 * Default deal pipeline stages configuration.
 */
export const DEAL_STAGES: DealStageConfig[] = [
	{ id: "qualification", label: "Qualification", color: "gray", probability: 10, order: 1 },
	{ id: "discovery", label: "Discovery", color: "blue", probability: 25, order: 2 },
	{ id: "proposal", label: "Proposal", color: "purple", probability: 50, order: 3 },
	{ id: "negotiation", label: "Negotiation", color: "yellow", probability: 75, order: 4 },
	{ id: "closed_won", label: "Closed Won", color: "green", probability: 100, order: 5 },
	{ id: "closed_lost", label: "Closed Lost", color: "red", probability: 0, order: 6 },
];

// ============================================================================
// DOCUMENT TYPES
// ============================================================================

/**
 * CRM document type discriminator.
 */
export type CrmDocumentType =
	| "cv"
	| "certification"
	| "registration"
	| "contract"
	| "proposal"
	| "nda"
	| "invoice"
	| "other";

// ============================================================================
// FILTER AND SORT TYPES
// ============================================================================

/**
 * Account filter options.
 */
export interface AccountFilters {
	type?: AccountType | AccountType[];
	status?: AccountStatus | AccountStatus[];
	stage?: string | string[];
	country?: string | string[];
	region?: string | string[];
	industry?: string | string[];
	companySize?: CompanySize | CompanySize[];
	ownerId?: string;
	teamId?: string;
	partnerTier?: PartnerTier | PartnerTier[];
	leadScoreMin?: number;
	leadScoreMax?: number;
	healthScoreMin?: number;
	healthScoreMax?: number;
	fitScoreMin?: number;
	fitScoreMax?: number;
	tags?: string[];
	lastContactBefore?: Date;
	lastContactAfter?: Date;
	createdBefore?: Date;
	createdAfter?: Date;
	search?: string;
}

/**
 * Contact filter options.
 */
export interface ContactFilters {
	/** Filter by account ID. Use null for standalone contacts (People) */
	accountId?: string | null;
	role?: ContactRole | ContactRole[];
	seniority?: ContactSeniority | ContactSeniority[];
	isPrimaryContact?: boolean;
	relationshipStrength?: RelationshipStrength | RelationshipStrength[];
	sentiment?: ContactSentiment | ContactSentiment[];
	doNotContact?: boolean;
	tags?: string[];
	lastContactBefore?: Date;
	lastContactAfter?: Date;
	search?: string;
}

/**
 * Activity filter options.
 */
export interface ActivityFilters {
	accountId?: string;
	contactId?: string;
	dealId?: string;
	opportunityId?: string;
	type?: ActivityType | ActivityType[];
	status?: ActivityStatus | ActivityStatus[];
	direction?: ActivityDirection | ActivityDirection[];
	priority?: ActivityPriority | ActivityPriority[];
	followUpRequired?: boolean;
	scheduledBefore?: Date;
	scheduledAfter?: Date;
	completedBefore?: Date;
	completedAfter?: Date;
	createdBy?: string;
}

/**
 * Deal filter options.
 */
export interface DealFilters {
	accountId?: string;
	opportunityId?: string;
	pipelineId?: string;
	stage?: DealStage | DealStage[];
	status?: DealStatus | DealStatus[];
	ownerId?: string;
	valueMin?: number;
	valueMax?: number;
	expectedCloseBefore?: Date;
	expectedCloseAfter?: Date;
	tags?: string[];
	search?: string;
}

/**
 * Sort direction.
 */
export type SortDirection = "asc" | "desc";

/**
 * Generic sort configuration.
 */
export interface SortConfig<T extends string = string> {
	field: T;
	direction: SortDirection;
}

/**
 * Account sortable fields.
 */
export type AccountSortField =
	| "name"
	| "createdAt"
	| "updatedAt"
	| "lastContactDate"
	| "leadScore"
	| "partnershipFitScore"
	| "customerHealthScore"
	| "contractValue";

/**
 * Pagination options.
 */
export interface Pagination {
	page: number;
	pageSize: number;
}

/**
 * Paginated response wrapper.
 */
export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
	hasNext: boolean;
	hasPrevious: boolean;
}

// ============================================================================
// INPUT TYPES FOR CRUD OPERATIONS
// ============================================================================

/**
 * Create account input.
 */
export interface CreateAccountInput {
	name: string;
	type: AccountType;
	industry?: string;
	sector?: string;
	subSector?: string;
	companySize?: CompanySize;
	country?: string;
	region?: string;
	city?: string;
	address?: string;
	timezone?: string;
	primaryLanguage?: string;
	additionalLanguages?: string[];
	preferredContactMethod?: ContactMethod;
	description?: string;
	website?: string;
	linkedinUrl?: string;
	foundedYear?: number;
	employeeCount?: string;
	annualRevenue?: string;
	fiscalYearEnd?: string;
	partnerTier?: PartnerTier;
	coreCapabilities?: string;
	capabilities?: string[];
	corporateStatus?: string;
	stage?: string;
	status?: AccountStatus;
	ownerId?: string;
	ownerName?: string;
	teamId?: string;
	leadScore?: number;
	leadSource?: string;
	leadSourceDetail?: string;
	qualificationStatus?: QualificationStatus;
	tags?: string[];
	customFields?: Record<string, unknown>;
	source?: string;
	sourceFile?: string;
}

/**
 * Update account input (all fields optional).
 */
export type UpdateAccountInput = Partial<CreateAccountInput>;

/**
 * Create contact input.
 */
export interface CreateContactInput {
	accountId?: string;
	firstName: string;
	lastName: string;
	fullName?: string;
	salutation?: string;
	title?: string;
	department?: string;
	role?: ContactRole;
	seniority?: ContactSeniority;
	email?: string;
	emailSecondary?: string;
	phone?: string;
	phoneMobile?: string;
	phoneWork?: string;
	linkedinUrl?: string;
	country?: string;
	city?: string;
	timezone?: string;
	preferredLanguage?: string;
	preferredContactMethod?: ContactMethod;
	bestTimeToContact?: string;
	doNotContact?: boolean;
	doNotEmail?: boolean;
	doNotCall?: boolean;
	isPrimaryContact?: boolean;
	relationshipStrength?: RelationshipStrength;
	influence?: InfluenceLevel;
	sentiment?: ContactSentiment;
	notes?: string;
	tags?: string[];
}

/**
 * Update contact input.
 */
export type UpdateContactInput = Partial<CreateContactInput>;

/**
 * Create activity input.
 */
export interface CreateActivityInput {
	accountId?: string;
	contactId?: string;
	dealId?: string;
	opportunityId?: string;
	type: ActivityType;
	subject?: string;
	description?: string;
	outcome?: string;
	scheduledAt?: Date;
	completedAt?: Date;
	durationMinutes?: number;
	direction?: ActivityDirection;
	status?: ActivityStatus;
	priority?: ActivityPriority;
	participants?: {
		internal: string[];
		external: string[];
	};
	followUpRequired?: boolean;
	followUpDate?: Date;
	followUpNotes?: string;
	attachments?: { name: string; url: string; type?: string }[];
	externalId?: string;
	source?: string;
}

/**
 * Update activity input.
 */
export type UpdateActivityInput = Partial<CreateActivityInput>;

/**
 * Create deal input.
 */
export interface CreateDealInput {
	accountId: string;
	primaryContactId?: string;
	opportunityId?: string;
	name: string;
	description?: string;
	value?: number;
	currency?: string;
	recurringValue?: number;
	recurringPeriod?: RecurringPeriod;
	pipelineId?: string;
	stage?: DealStage;
	stageProbability?: number;
	expectedCloseDate?: Date;
	ownerId?: string;
	ownerName?: string;
	tags?: string[];
	customFields?: Record<string, unknown>;
}

/**
 * Update deal input.
 */
export type UpdateDealInput = Partial<CreateDealInput>;

/**
 * Upload document input.
 */
export interface UploadDocumentInput {
	accountId?: string;
	contactId?: string;
	dealId?: string;
	activityId?: string;
	name: string;
	type: CrmDocumentType;
	fileName?: string;
	fileSize?: number;
	mimeType?: string;
	storageUrl?: string;
	description?: string;
	validFrom?: Date;
	validTo?: Date;
	issuedBy?: string;
}

/**
 * Update document input.
 */
export type UpdateDocumentInput = Partial<Omit<UploadDocumentInput, "accountId" | "contactId" | "dealId" | "activityId">>;

// ============================================================================
// ANALYTICS AND STATS TYPES
// ============================================================================

/**
 * Account statistics by type.
 */
export interface AccountStats {
	type: AccountType;
	total: number;
	byStatus: Record<string, number>;
	byStage: Record<string, number>;
	byRegion: Record<string, number>;
	avgLeadScore?: number;
	avgHealthScore?: number;
	avgFitScore?: number;
}

/**
 * Pipeline metrics.
 */
export interface PipelineMetrics {
	type: AccountType;
	stages: {
		stage: string;
		count: number;
		percentage: number;
	}[];
	conversionRates: {
		fromStage: string;
		toStage: string;
		rate: number;
	}[];
	avgTimeInStage: Record<string, number>;
}

/**
 * Deal pipeline value metrics.
 */
export interface DealPipelineValue {
	pipelineId: string;
	stages: {
		stage: DealStage;
		count: number;
		totalValue: number;
		weightedValue: number;
	}[];
	totalValue: number;
	totalWeightedValue: number;
	avgDealSize: number;
}

/**
 * Deal forecast.
 */
export interface DealForecast {
	period: string;
	expectedValue: number;
	weightedValue: number;
	dealCount: number;
}

/**
 * Win/Loss analysis.
 */
export interface WinLossAnalysis {
	totalWon: number;
	totalLost: number;
	winRate: number;
	totalValueWon: number;
	totalValueLost: number;
	avgDealSizeWon: number;
	avgDealSizeLost: number;
	lossReasons: { reason: string; count: number; percentage: number }[];
	topCompetitors: { name: string; lossCount: number }[];
}

/**
 * Activity statistics.
 */
export interface ActivityStats {
	total: number;
	byType: Record<ActivityType, number>;
	byStatus: Record<ActivityStatus, number>;
	completedThisPeriod: number;
	overdueCount: number;
	upcomingCount: number;
}

// ============================================================================
// VIEW MODE TYPES
// ============================================================================

/**
 * Available view modes for lists.
 */
export type ViewMode =
	| "list"
	| "grid"
	| "kanban"
	| "map"
	| "tree"
	| "charts";

/**
 * View mode configuration.
 */
export interface ViewModeConfig {
	id: ViewMode;
	label: string;
	icon: string;
	description: string;
	supportedFor: ("accounts" | "contacts" | "deals" | "activities")[];
}

/**
 * Available view modes.
 */
export const VIEW_MODES: ViewModeConfig[] = [
	{ id: "list", label: "List", icon: "List", description: "Compact table view", supportedFor: ["accounts", "contacts", "deals", "activities"] },
	{ id: "grid", label: "Grid", icon: "Grid", description: "Card grid view", supportedFor: ["accounts", "contacts", "deals"] },
	{ id: "kanban", label: "Kanban", icon: "Columns", description: "Pipeline columns", supportedFor: ["accounts", "deals"] },
	{ id: "map", label: "Map", icon: "Map", description: "Geographic view", supportedFor: ["accounts", "contacts"] },
	{ id: "tree", label: "Tree", icon: "FolderTree", description: "Hierarchical view", supportedFor: ["accounts"] },
	{ id: "charts", label: "Charts", icon: "BarChart", description: "Analytics dashboard", supportedFor: ["accounts", "deals", "activities"] },
];

// ============================================================================
// EXTENDED TYPES WITH RELATIONS
// ============================================================================

/**
 * Account with related entities.
 */
export interface AccountWithRelations extends AccountRow {
	contacts?: ContactRow[];
	deals?: DealRow[];
	recentActivities?: ActivityRow[];
	documents?: CrmDocumentRow[];
	stageHistory?: AccountStageHistoryRow[];
}

/**
 * Contact with related entities.
 */
export interface ContactWithRelations extends ContactRow {
	account?: AccountRow | null;
	recentActivities?: ActivityRow[];
	documents?: CrmDocumentRow[];
}

/**
 * Deal with related entities.
 */
export interface DealWithRelations extends DealRow {
	account?: AccountRow | null;
	primaryContact?: ContactRow | null;
	activities?: ActivityRow[];
	documents?: CrmDocumentRow[];
	stageHistory?: DealStageHistoryRow[];
}

/**
 * Activity with related entities.
 */
export interface ActivityWithRelations extends ActivityRow {
	account?: AccountRow | null;
	contact?: ContactRow | null;
	deal?: DealRow | null;
	documents?: CrmDocumentRow[];
}

// ============================================================================
// IMPORT/EXPORT TYPES
// ============================================================================

/**
 * Import contact input for bulk imports.
 */
export interface ImportContactInput extends CreateContactInput {
	accountName?: string;
	accountType?: AccountType;
}

/**
 * Import result summary.
 */
export interface ImportResult {
	success: boolean;
	totalRecords: number;
	importedCount: number;
	updatedCount: number;
	skippedCount: number;
	failedCount: number;
	errors: { row: number; field?: string; message: string }[];
}

/**
 * Export options.
 */
export interface ExportOptions {
	format: "csv" | "xlsx" | "json";
	fields?: string[];
	filters?: AccountFilters | ContactFilters | DealFilters;
	includeRelated?: boolean;
}
