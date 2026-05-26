import http from "node:http";
import https from "node:https";
import { mapKenyaPpipApiTenderToOpportunity, type KenyaPpipApiTender } from "@/lib/scrapers/parsers/kenya-ppip";
import type { OpportunityData } from "@/lib/scrapers/deduplicator";

interface KenyaPpipPaginatedResponse {
	current_page?: number;
	data?: KenyaPpipApiTender[];
	last_page?: number;
	per_page?: number;
	total?: number;
}

export interface KenyaPpipFetchResult {
	apiUrl: string;
	opportunities: OpportunityData[];
	total?: number;
	page?: number;
	lastPage?: number;
}

export interface KenyaPpipFetchOptions {
	limit?: number;
	timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

export function isKenyaPpipUrl(sourceUrl: string): boolean {
	try {
		return new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase() === "tenders.go.ke";
	} catch {
		return false;
	}
}

function endpointPathForSourceUrl(sourceUrl: URL): string {
	const pathname = sourceUrl.pathname.toLowerCase();
	const status = sourceUrl.searchParams.get("status")?.toLowerCase();

	if (pathname.startsWith("/api/")) return sourceUrl.pathname;
	if (status === "all" || pathname.includes("/all")) return "/api/tender";
	if (status === "closed" || pathname.includes("closed")) return "/api/closed-tenders";
	if (status === "agpo" || pathname.includes("agpo")) return "/api/agpo-tenders";
	if (status === "terminated" || pathname.includes("terminated")) return "/api/terminated-tenders";
	if (status === "restricted" || pathname.includes("restricted")) return "/api/restricted-tenders";
	return "/api/active-tenders";
}

export function buildKenyaPpipApiUrl(sourceUrl: string, limit = DEFAULT_LIMIT): string {
	const parsed = new URL(sourceUrl);
	const apiUrl = new URL(endpointPathForSourceUrl(parsed), parsed.origin);
	for (const [key, value] of parsed.searchParams.entries()) {
		if (!["page", "perpage", "status"].includes(key.toLowerCase())) {
			apiUrl.searchParams.set(key, value);
		}
	}
	apiUrl.searchParams.set("perpage", String(Math.min(Math.max(limit, 1), MAX_LIMIT)));
	apiUrl.searchParams.set("page", "1");
	return apiUrl.toString();
}

async function requestJson<T>(url: string, timeoutMs: number): Promise<T> {
	const parsed = new URL(url);
	const transport = parsed.protocol === "https:" ? https : http;
	const allowInvalidTls = parsed.hostname.replace(/^www\./, "").toLowerCase() === "tenders.go.ke";

	return new Promise<T>((resolve, reject) => {
		const request = transport.request(parsed, {
			method: "GET",
			headers: {
				Accept: "application/json",
				"User-Agent": "DocFusion/1.0 opportunity-discovery",
			},
			timeout: timeoutMs,
			...(parsed.protocol === "https:" ? { rejectUnauthorized: !allowInvalidTls } : {}),
		}, (response) => {
			let body = "";
			response.setEncoding("utf8");
			response.on("data", (chunk) => {
				body += chunk;
			});
			response.on("end", () => {
				if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
					reject(new Error(`Kenya PPIP API returned HTTP ${response.statusCode ?? "unknown"}`));
					return;
				}
				try {
					resolve(JSON.parse(body) as T);
				} catch (error) {
					reject(error);
				}
			});
		});

		request.on("timeout", () => {
			request.destroy(new Error(`Kenya PPIP API timed out after ${timeoutMs}ms`));
		});
		request.on("error", reject);
		request.end();
	});
}

export async function fetchKenyaPpipOpportunities(
	sourceUrl: string,
	options: KenyaPpipFetchOptions = {}
): Promise<KenyaPpipFetchResult> {
	const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
	const apiUrl = buildKenyaPpipApiUrl(sourceUrl, limit);
	const response = await requestJson<KenyaPpipPaginatedResponse>(apiUrl, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
	const baseUrl = new URL(apiUrl).origin;
	const opportunities = (response.data ?? [])
		.map((tender) => mapKenyaPpipApiTenderToOpportunity(tender, baseUrl))
		.filter((opportunity): opportunity is OpportunityData => Boolean(opportunity));

	return {
		apiUrl,
		opportunities,
		total: response.total,
		page: response.current_page,
		lastPage: response.last_page,
	};
}
