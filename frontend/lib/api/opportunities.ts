import type {
	DecisionStatus,
	Opportunity,
	OpportunityListItem,
	OpportunitySort,
	OpportunitySortField,
	PaginatedResponse,
	PriorityRank,
	RevenuePotential,
	SortDirection,
	OpportunityFilters as BaseOpportunityFilters,
} from "@/lib/types/opportunity";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export interface OpportunityFilters extends BaseOpportunityFilters {
	page?: number;
	pageSize?: number;
	sort?: OpportunitySort;
	sortField?: OpportunitySortField;
	sortDirection?: SortDirection;
}

export type PaginatedOpportunities = PaginatedResponse<OpportunityListItem>;
export type OpportunityDetail = Opportunity;

interface RawOpportunityListItem {
	id: string;
	source_id: string | null;
	title: string;
	category: string | null;
	country_region: string | null;
	organization: string | null;
	deadline: string | null;
	days_left: number | null;
	is_expired: boolean;
	budget_value: string | null;
	priority_rank: number;
	fit_score: number | null;
	decision_status: string;
	assigned_to: string | null;
	tags: string[];
	rfp_link: string | null;
}

interface RawOpportunityDetail extends RawOpportunityListItem {
	it_category: string | null;
	sector: string | null;
	funder: string | null;
	budget_numeric: number | null;
	budget_currency: string | null;
	project_summary: string | null;
	project_scope: string | null;
	key_requirements: string | null;
	technical_requirements: string | null;
	submission_method: string | null;
	submission_requirements: string | null;
	source_platform: string | null;
	source_file: string | null;
	opportunity_type: string;
	win_probability: number | null;
	revenue_potential: string | null;
	strategic_notes: string | null;
	decision_reason: string | null;
	is_reviewed: boolean;
	notes: string | null;
	created_at: string | null;
	updated_at: string | null;
}

interface RawPaginatedOpportunities {
	data: RawOpportunityListItem[];
	total: number;
	page: number;
	page_size: number;
	total_pages: number;
}

export class APIError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "APIError";
		this.status = status;
	}
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${API_BASE_URL}${path}`, {
		...init,
		headers: {
			"Content-Type": "application/json",
			...init?.headers,
		},
	});

	if (!response.ok) {
		throw new APIError(await response.text(), response.status);
	}

	return response.json() as Promise<T>;
}

function dateOrNull(value: string | null | undefined): Date | null {
	return value ? new Date(value) : null;
}

function priorityRank(value: number | null | undefined): PriorityRank {
	if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) {
		return value;
	}
	return 3;
}

function decisionStatus(value: string | null | undefined): DecisionStatus {
	const allowed: DecisionStatus[] = [
		"pending",
		"interested",
		"shortlisted",
		"pursuing",
		"submitted",
		"won",
		"lost",
		"declined",
		"expired",
	];
	return allowed.includes(value as DecisionStatus) ? (value as DecisionStatus) : "pending";
}

function sortFieldToApi(field: OpportunitySortField): string {
	const fields: Record<OpportunitySortField, string> = {
		deadline: "deadline",
		priorityRank: "priority_rank",
		fitScore: "fit_score",
		budgetNumeric: "budget_numeric",
		title: "title",
		organization: "organization",
		category: "category",
		countryRegion: "country_region",
		createdAt: "created_at",
		updatedAt: "updated_at",
	};
	return fields[field];
}

function appendFilters(searchParams: URLSearchParams, params: OpportunityFilters): void {
	if (params.search) searchParams.set("search", params.search);
	if (params.statuses?.[0]) searchParams.set("decision_status", params.statuses[0]);
	if (params.categories?.[0]) searchParams.set("category", params.categories[0]);
	if (params.countries?.[0]) searchParams.set("country_region", params.countries[0]);
	if (params.organizations?.[0]) searchParams.set("organization", params.organizations[0]);
	if (params.priorityRanks?.length) {
		searchParams.set("priority_min", String(Math.min(...params.priorityRanks)));
		searchParams.set("priority_max", String(Math.max(...params.priorityRanks)));
	}
	if (params.fitScoreMin !== undefined) searchParams.set("fit_score_min", String(params.fitScoreMin));
	if (params.fitScoreMax !== undefined) searchParams.set("fit_score_max", String(params.fitScoreMax));
}

function mapListItem(raw: RawOpportunityListItem): OpportunityListItem {
	return {
		id: raw.id,
		sourceId: raw.source_id,
		title: raw.title,
		category: raw.category,
		countryRegion: raw.country_region,
		organization: raw.organization,
		deadline: dateOrNull(raw.deadline),
		daysLeft: raw.days_left,
		isExpired: raw.is_expired,
		budgetValue: raw.budget_value,
		priorityRank: priorityRank(raw.priority_rank),
		fitScore: raw.fit_score,
		decisionStatus: decisionStatus(raw.decision_status),
		assignedTo: raw.assigned_to,
		tags: raw.tags ?? [],
		rfpLink: raw.rfp_link,
	};
}

function mapDetail(raw: RawOpportunityDetail): OpportunityDetail {
	const createdAt = dateOrNull(raw.created_at) ?? new Date(0);
	const updatedAt = dateOrNull(raw.updated_at) ?? createdAt;
	return {
		...mapListItem(raw),
		itCategory: raw.it_category,
		sector: raw.sector,
		funder: raw.funder,
		budgetNumeric: raw.budget_numeric,
		budgetCurrency: raw.budget_currency,
		projectSummary: raw.project_summary,
		projectScope: raw.project_scope,
		keyRequirements: raw.key_requirements,
		technicalRequirements: raw.technical_requirements,
		submissionMethod: raw.submission_method,
		submissionRequirements: raw.submission_requirements,
		sourcePlatform: raw.source_platform,
		sourceFile: raw.source_file,
		opportunityType: raw.opportunity_type as OpportunityDetail["opportunityType"],
		winProbability: raw.win_probability,
		revenuePotential: raw.revenue_potential as RevenuePotential | null,
		strategicNotes: raw.strategic_notes,
		decisionReason: raw.decision_reason,
		isReviewed: raw.is_reviewed,
		notes: raw.notes,
		metadata: null,
		createdAt,
		updatedAt,
		importedAt: createdAt,
	};
}

export async function getOpportunities(params: OpportunityFilters = {}): Promise<PaginatedOpportunities> {
	const searchParams = new URLSearchParams();
	appendFilters(searchParams, params);
	searchParams.set("page", String(params.page ?? 1));
	searchParams.set("page_size", String(params.pageSize ?? 25));
	const sortField = params.sort?.field ?? params.sortField ?? "deadline";
	const sortDirection = params.sort?.direction ?? params.sortDirection ?? "asc";
	searchParams.set("sort_field", sortFieldToApi(sortField));
	searchParams.set("sort_direction", sortDirection);

	const raw = await requestJson<RawPaginatedOpportunities>(`/api/v1/opportunities?${searchParams.toString()}`);
	return {
		data: raw.data.map(mapListItem),
		total: raw.total,
		page: raw.page,
		pageSize: raw.page_size,
		totalPages: raw.total_pages,
	};
}

export async function getOpportunity(id: string): Promise<OpportunityDetail> {
	const raw = await requestJson<RawOpportunityDetail>(`/api/v1/opportunities/${encodeURIComponent(id)}`);
	return mapDetail(raw);
}
