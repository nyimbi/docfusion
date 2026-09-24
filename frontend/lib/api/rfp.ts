const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export interface RfpUploadResponse {
	rfp_id: string;
	filename: string;
	size: number;
	organization_id: string;
	file_hash: string;
	storage_path: string;
	parsing_status: string;
}

export interface RfpMetadata {
	rfp_id: string;
	organization_id: string;
	filename: string;
	file_type: string | null;
	file_size: number | null;
	storage_path: string | null;
	file_hash: string | null;
	parsing_status: string;
	parsing_progress: number;
	parsing_error: string | null;
	parsing_started_at: string | null;
	parsing_completed_at: string | null;
	uploaded_by: string | null;
	opportunity_id: string | null;
	created_at: string | null;
	updated_at: string | null;
}

export interface AnalyzeJobResponse {
	rfp_id: string;
	workflow_id: string;
	run_id: string;
	status: string;
}

export interface RfpStatusResponse {
	rfp_id: string;
	organization_id: string;
	status: string;
	progress: number;
	error: string | null;
	started_at: string | null;
	completed_at: string | null;
}

export interface RfpRequirementSummary {
	id: string;
	requirement_number: string | null;
	title: string | null;
	requirement_text: string | null;
	source_quote: string | null;
	source_page: number | null;
	source_section: string | null;
	category: string | null;
	subcategory: string | null;
	requirement_type: string | null;
	priority: string | null;
	risk_level: string | null;
	extraction_confidence: number | null;
	ai_analysis: Record<string, unknown> | null;
	compliance_status: string | null;
	response_strategy: string | null;
	assigned_to: string | null;
	due_date: string | null;
	response_section: string | null;
	notes: string | null;
	created_at: string | null;
	updated_at: string | null;
}

export interface RfpResultResponse {
	rfp_id: string;
	organization_id: string;
	status: string;
	metadata: RfpMetadata;
	requirement_count: number;
	requirements: RfpRequirementSummary[];
	analysis: Record<string, unknown> | null;
	download_pdf_url?: string | null;
	pdf_status?: string | null;
	pdf_errors?: string[];
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${API_BASE_URL}${path}`, {
		...init,
		headers: {
			...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
			...init?.headers,
		},
	});

	if (!response.ok) {
		throw new Error(await response.text());
	}

	return response.json() as Promise<T>;
}

export async function uploadRfp(file: File): Promise<RfpUploadResponse> {
	const formData = new FormData();
	formData.append("file", file);
	return requestJson<RfpUploadResponse>("/api/v1/rfp/upload", {
		method: "POST",
		body: formData,
	});
}

export async function getRfp(rfpId: string): Promise<RfpMetadata> {
	return requestJson<RfpMetadata>(`/api/v1/rfp/${encodeURIComponent(rfpId)}`);
}

export async function analyzeRfp(rfpId: string): Promise<AnalyzeJobResponse> {
	return requestJson<AnalyzeJobResponse>(`/api/v1/rfp/${encodeURIComponent(rfpId)}/analyze`, {
		method: "POST",
	});
}

export async function getRfpStatus(rfpId: string): Promise<RfpStatusResponse> {
	return requestJson<RfpStatusResponse>(`/api/v1/rfp/${encodeURIComponent(rfpId)}/status`);
}

export async function getRfpResult(rfpId: string): Promise<RfpResultResponse> {
	return requestJson<RfpResultResponse>(`/api/v1/rfp/${encodeURIComponent(rfpId)}/result`);
}
