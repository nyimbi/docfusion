/**
 * POST /api/opportunities/discovery/run
 *
 * Operator entrypoint for live opportunity discovery. Searches SearXNG and
 * persists likely notices through the audited opportunity import pipeline.
 */

import { NextRequest, NextResponse } from "next/server";
import {
	discoverAndImportOpportunities,
	type DiscoveryImportInput,
} from "@/lib/actions/import-opportunities";
import { executeOpportunityDiscoveryImport } from "@/lib/services/opportunity-discovery-import";
import { requireScraperAccess } from "@/lib/scrapers/api-auth";

type DiscoveryRequestBody = Record<string, unknown>;

function optionalString(value: unknown, field: string): string | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "string") return value;
	throw new Error(`${field} must be a string`);
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "boolean") return value;
	throw new Error(`${field} must be a boolean`);
}

function optionalNumber(value: unknown, field: string): number | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "number" && Number.isFinite(value)) return value;
	throw new Error(`${field} must be a finite number`);
}

function optionalStringArray(value: unknown, field: string): string[] | undefined {
	if (value === undefined) return undefined;
	if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
		return value;
	}
	throw new Error(`${field} must be an array of strings`);
}

async function readJsonBody(request: NextRequest): Promise<DiscoveryRequestBody> {
	const raw = await request.text();
	if (!raw.trim()) return {};

	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as DiscoveryRequestBody;
		}
		throw new Error("request body must be a JSON object");
	} catch (error) {
		throw new Error(error instanceof Error ? error.message : "Invalid JSON body");
	}
}

function parseDiscoveryInput(body: DiscoveryRequestBody): DiscoveryImportInput {
	return {
		query: optionalString(body.query, "query"),
		queries: optionalStringArray(body.queries, "queries"),
		limitPerQuery: optionalNumber(body.limitPerQuery, "limitPerQuery"),
		language: optionalString(body.language, "language"),
		timeRange: optionalString(body.timeRange, "timeRange") as DiscoveryImportInput["timeRange"],
		categories: optionalStringArray(body.categories, "categories"),
		countryRegion: optionalString(body.countryRegion, "countryRegion"),
		category: optionalString(body.category, "category"),
		updateExisting: optionalBoolean(body.updateExisting, "updateExisting"),
		includeUnmatchedResults: optionalBoolean(body.includeUnmatchedResults, "includeUnmatchedResults"),
		scrapeTopResults: optionalBoolean(body.scrapeTopResults, "scrapeTopResults"),
		scrapeLimit: optionalNumber(body.scrapeLimit, "scrapeLimit"),
		browserFallback: optionalBoolean(body.browserFallback, "browserFallback"),
		browserFallbackLimit: optionalNumber(body.browserFallbackLimit, "browserFallbackLimit"),
	};
}

function isScraperApiKeyRequest(request: NextRequest): boolean {
	const apiKey = process.env.SCRAPER_API_KEY?.trim();
	return Boolean(apiKey && request.headers.get("authorization") === `Bearer ${apiKey}`);
}

export async function POST(request: NextRequest) {
	try {
		const apiKeyRequest = isScraperApiKeyRequest(request);
		const unauthorized = await requireScraperAccess(request, { allowApiKey: true });
		if (unauthorized) return unauthorized;

		let input: DiscoveryImportInput;
		try {
			input = parseDiscoveryInput(await readJsonBody(request));
		} catch (error) {
			return NextResponse.json(
				{
					success: false,
					message: error instanceof Error ? error.message : "Invalid discovery request",
				},
				{ status: 400 }
			);
		}

		const serviceUserId = process.env.DISCOVERY_IMPORT_USER_ID?.trim();
		if (apiKeyRequest && !serviceUserId) {
			return NextResponse.json(
				{
					success: false,
					message: "DISCOVERY_IMPORT_USER_ID is required for API-key discovery runs",
				},
				{ status: 503 }
			);
		}

		const result = apiKeyRequest
			? await executeOpportunityDiscoveryImport(input, serviceUserId!)
			: await discoverAndImportOpportunities(input);
		return NextResponse.json({
			success: true,
			message: "Opportunity discovery import completed",
			...result,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Opportunity discovery import failed";
		return NextResponse.json(
			{ success: false, message },
			{ status: message === "Unauthorized" ? 401 : 500 }
		);
	}
}
