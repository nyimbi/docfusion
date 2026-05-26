import { createHash } from "crypto";
import { db } from "@/lib/db";
import { opportunities } from "@/lib/db/schema";
import { FirecrawlClient } from "@/lib/scrapers/firecrawl";
import { searchSearxng, type SearchOptions, type SearxngResult } from "@/lib/services/searxng-client";
import type { ImportConfig, ImportRecordResult, OpportunityInput } from "@/lib/types/opportunity";
import {
	createImportRecord,
	createOpportunity,
	updateImportRecord,
	updateOpportunity,
} from "@/lib/actions/opportunities";
import { and, eq } from "drizzle-orm";

export interface DiscoveryImportInput {
	query?: string;
	queries?: string[];
	limitPerQuery?: number;
	language?: string;
	timeRange?: SearchOptions["time_range"];
	categories?: SearchOptions["categories"];
	countryRegion?: string;
	category?: string;
	updateExisting?: boolean;
	includeUnmatchedResults?: boolean;
	scrapeTopResults?: boolean;
	scrapeLimit?: number;
	browserFallback?: boolean;
	browserFallbackLimit?: number;
}

interface DiscoveryCandidate {
	query: string;
	result: SearxngResult;
	scrape?: {
		title?: string;
		description?: string;
		markdown?: string;
		success: boolean;
		error?: string;
		method: "firecrawl" | "browser_fallback";
		fallbackReason?: string;
	};
}

export type ImportResultsSummary = {
	total: number;
	imported: number;
	updated: number;
	skipped: number;
	failed: number;
};

export interface DiscoveryRunWarning {
	type: "firecrawl_failed" | "browser_fallback_failed" | "browser_fallback_used";
	query: string;
	title: string;
	url: string;
	message: string;
}

export interface DiscoveryImportResult {
	importId: string;
	results: ImportResultsSummary;
	errors: ImportRecordResult[];
	warnings: DiscoveryRunWarning[];
}

const DEFAULT_DISCOVERY_QUERIES = [
	"software development RFP Africa",
	"ICT tender East Africa",
	"digital transformation request for proposals Kenya",
	"grant management system tender Africa",
];

const OPPORTUNITY_KEYWORDS = [
	"rfp",
	"request for proposal",
	"tender",
	"bid",
	"eoi",
	"expression of interest",
	"procurement",
	"grant",
	"solicitation",
];

const DEFAULT_STEALTH_SCRAPER_URL = "http://84.247.181.100:3003";
const MIN_USEFUL_SCRAPE_MARKDOWN_LENGTH = 120;

function sha256Hex(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function normalizeUrlForIdentity(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.hash = "";
		parsed.searchParams.sort();
		return parsed.toString();
	} catch {
		return url.trim();
	}
}

function compactText(value: string | undefined | null, maxLength: number): string | undefined {
	const compacted = value?.replace(/\s+/g, " ").trim();
	if (!compacted) return undefined;
	return compacted.length > maxLength ? `${compacted.slice(0, maxLength - 3)}...` : compacted;
}

function slugForSourceFile(query: string): string {
	const slug = query
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 80);
	return `searxng:${slug || "opportunity-discovery"}`;
}

function normalizeDiscoveryQueries(input: DiscoveryImportInput): string[] {
	const rawQueries = [
		input.query,
		...(input.queries ?? []),
	].filter((query): query is string => Boolean(query?.trim()));
	const queries = rawQueries.length > 0 ? rawQueries : DEFAULT_DISCOVERY_QUERIES;
	return [...new Set(queries.map((query) => query.trim()))];
}

function isLikelyOpportunity(result: SearxngResult): boolean {
	const haystack = `${result.title} ${result.content} ${result.url}`.toLowerCase();
	return OPPORTUNITY_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function inferOpportunityType(candidate: DiscoveryCandidate): OpportunityInput["opportunityType"] {
	const haystack = [
		candidate.result.title,
		candidate.result.content,
		candidate.scrape?.title,
		candidate.scrape?.description,
	].join(" ").toLowerCase();

	if (haystack.includes("expression of interest") || /\beoi\b/.test(haystack)) return "eoi";
	if (haystack.includes("grant")) return "grant";
	if (haystack.includes("tender")) return "tender";
	if (haystack.includes("request for proposal") || /\brfp\b/.test(haystack)) return "rfp";
	return "other";
}

function resultHost(url: string): string | undefined {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return undefined;
	}
}

function buildOpportunityFromDiscovery(
	candidate: DiscoveryCandidate,
	userId: string,
	input: DiscoveryImportInput
): OpportunityInput {
	const normalizedUrl = normalizeUrlForIdentity(candidate.result.url);
	const urlHash = sha256Hex(normalizedUrl);
	const markdownSummary = compactText(candidate.scrape?.markdown, 2200);
	const summary = compactText(
		candidate.scrape?.description || candidate.result.content || markdownSummary,
		2200
	);
	const host = resultHost(candidate.result.url);

	return {
		sourceId: `searxng-${urlHash.slice(0, 42)}`,
		title: compactText(candidate.scrape?.title || candidate.result.title || candidate.result.url, 1000)!,
		category: input.category || candidate.result.category || "External discovery",
		countryRegion: input.countryRegion,
		organization: host,
		projectSummary: summary,
		rfpLink: candidate.result.url,
		sourcePlatform: "SearXNG",
		sourceFile: slugForSourceFile(candidate.query),
		opportunityType: inferOpportunityType(candidate),
		source: "searxng",
		fingerprint: urlHash,
		portalUrl: candidate.result.url,
		documentUrl: /\.(pdf|docx?|xlsx?)(\?|#|$)/i.test(candidate.result.url)
			? candidate.result.url
			: undefined,
		scrapedAt: new Date(),
		priorityRank: 3,
		decisionStatus: "pending",
		assignedTo: userId,
		isReviewed: false,
		tags: ["external-discovery"],
		metadata: {
			discovery: {
				engine: "searxng",
				query: candidate.query,
				resultEngine: candidate.result.engine,
				score: candidate.result.score,
				url: normalizedUrl,
				scrapedWithFirecrawl: candidate.scrape?.success && candidate.scrape.method === "firecrawl",
				scrapedWithBrowserFallback: candidate.scrape?.success && candidate.scrape.method === "browser_fallback",
				scrapeMethod: candidate.scrape?.method,
				browserFallbackReason: candidate.scrape?.fallbackReason,
				scrapeError: candidate.scrape?.error,
			},
		},
	};
}

async function findExistingDiscoveredOpportunity(opp: OpportunityInput): Promise<string | null> {
	if (opp.fingerprint) {
		const [existing] = await db
			.select({ id: opportunities.id })
			.from(opportunities)
			.where(eq(opportunities.fingerprint, opp.fingerprint))
			.limit(1);

		if (existing?.id) return existing.id;
	}

	if (opp.source && opp.sourceId) {
		const [existing] = await db
			.select({ id: opportunities.id })
			.from(opportunities)
			.where(
				and(
					eq(opportunities.source, opp.source),
					eq(opportunities.sourceId, opp.sourceId)
				)!
			)
			.limit(1);

		return existing?.id || null;
	}

	return null;
}

async function scrapeDiscoveryCandidates(
	candidates: DiscoveryCandidate[],
	scrapeLimit: number,
	input: DiscoveryImportInput
): Promise<void> {
	if (scrapeLimit <= 0) return;

	const firecrawl = new FirecrawlClient({ timeout: 15000 });
	const browserFallbackLimit = Math.min(input.browserFallbackLimit ?? scrapeLimit, scrapeLimit);
	let browserFallbackAttempts = 0;

	for (const candidate of candidates.slice(0, scrapeLimit)) {
		const scrapeResult = await firecrawl.scrape(candidate.result.url, {
			formats: ["markdown"],
			timeout: 15000,
		});

		candidate.scrape = {
			success: scrapeResult.success,
			title: scrapeResult.data?.metadata?.title,
			description: scrapeResult.data?.metadata?.description,
			markdown: scrapeResult.data?.markdown,
			error: scrapeResult.error,
			method: "firecrawl",
		};

		const fallbackReason = browserFallbackReason(candidate.scrape);
		if ((input.browserFallback ?? true) && fallbackReason && browserFallbackAttempts < browserFallbackLimit) {
			browserFallbackAttempts++;
			const browserResult = await scrapeWithBrowserFallback(candidate.result.url, fallbackReason);
			if (isUsefulBrowserFallback(browserResult)) {
				candidate.scrape = browserResult;
			} else if (browserResult.error) {
				candidate.scrape.error = `${candidate.scrape.error || fallbackReason}; browser fallback: ${browserResult.error}`;
				candidate.scrape.fallbackReason = fallbackReason;
			}
		}
	}
}

function browserFallbackReason(scrape: DiscoveryCandidate["scrape"]): string | null {
	if (!scrape?.success) {
		return scrape?.error || "Firecrawl scrape failed";
	}

	const markdownLength = scrape.markdown?.trim().length ?? 0;
	if (markdownLength < MIN_USEFUL_SCRAPE_MARKDOWN_LENGTH && !scrape.description?.trim()) {
		return `Firecrawl returned sparse content (${markdownLength} markdown characters)`;
	}

	return null;
}

function isUsefulBrowserFallback(scrape: DiscoveryCandidate["scrape"]): boolean {
	if (!scrape?.success) return false;
	return Boolean(
		scrape.description?.trim() ||
		(scrape.markdown?.trim().length ?? 0) >= MIN_USEFUL_SCRAPE_MARKDOWN_LENGTH ||
		scrape.title?.trim()
	);
}

function collectDiscoveryWarnings(candidates: DiscoveryCandidate[]): DiscoveryRunWarning[] {
	const warnings: DiscoveryRunWarning[] = [];
	for (const candidate of candidates) {
		if (!candidate.scrape) continue;
		const base = {
			query: candidate.query,
			title: candidate.result.title,
			url: candidate.result.url,
		};
		if (candidate.scrape.method === "browser_fallback" && candidate.scrape.success) {
			warnings.push({
				...base,
				type: "browser_fallback_used",
				message: candidate.scrape.fallbackReason ?? "Firecrawl required browser fallback",
			});
			continue;
		}
		if (candidate.scrape.method === "browser_fallback" && !candidate.scrape.success) {
			warnings.push({
				...base,
				type: "browser_fallback_failed",
				message: candidate.scrape.error ?? candidate.scrape.fallbackReason ?? "Browser fallback failed",
			});
			continue;
		}
		if (candidate.scrape.method === "firecrawl" && !candidate.scrape.success) {
			warnings.push({
				...base,
				type: "firecrawl_failed",
				message: candidate.scrape.error ?? "Firecrawl scrape failed",
			});
		}
	}
	return warnings;
}

async function scrapeWithBrowserFallback(
	url: string,
	fallbackReason: string
): Promise<NonNullable<DiscoveryCandidate["scrape"]>> {
	const stealthUrl = (process.env.STEALTH_SCRAPER_URL || DEFAULT_STEALTH_SCRAPER_URL).replace(/\/$/, "");

	try {
		const response = await fetch(`${stealthUrl}/v1/scrape`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				url,
				options: {
					timeout: 15000,
					humanScroll: true,
					blockMedia: true,
				},
			}),
			signal: AbortSignal.timeout(20000),
		});

		if (!response.ok) {
			return {
				success: false,
				error: `Browser fallback error ${response.status}: ${await response.text()}`,
				method: "browser_fallback",
				fallbackReason,
			};
		}

		const result = await response.json() as {
			success: boolean;
			data?: {
				markdown?: string;
				metadata?: {
					title?: string;
					description?: string;
				};
			};
			error?: string;
		};

		return {
			success: result.success,
			title: result.data?.metadata?.title,
			description: result.data?.metadata?.description,
			markdown: result.data?.markdown,
			error: result.error,
			method: "browser_fallback",
			fallbackReason,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
			method: "browser_fallback",
			fallbackReason,
		};
	}
}

export async function executeOpportunityDiscoveryImport(
	input: DiscoveryImportInput,
	userId: string
): Promise<DiscoveryImportResult> {
	const queries = normalizeDiscoveryQueries(input);
	const limitPerQuery = Math.min(Math.max(input.limitPerQuery ?? 10, 1), 50);
	const updateExisting = input.updateExisting ?? true;
	const candidates: DiscoveryCandidate[] = [];
	const seenUrls = new Set<string>();
	const searchFailures: ImportRecordResult[] = [];

	for (const query of queries) {
		try {
			const response = await searchSearxng(query, {
				categories: input.categories ?? ["general", "news", "files"],
				language: input.language,
				time_range: input.timeRange,
				safesearch: 1,
			});

			for (const result of response.results.slice(0, limitPerQuery)) {
				if (!result.url || !result.title) continue;
				if (!input.includeUnmatchedResults && !isLikelyOpportunity(result)) continue;

				const normalizedUrl = normalizeUrlForIdentity(result.url);
				if (seenUrls.has(normalizedUrl)) continue;
				seenUrls.add(normalizedUrl);
				candidates.push({ query, result });
			}
		} catch (err) {
			searchFailures.push({
				rowIndex: searchFailures.length + 1,
				status: "failed",
				error: `Search failed for "${query}": ${String(err)}`,
				data: { title: query },
			});
		}
	}

	if (input.scrapeTopResults) {
		await scrapeDiscoveryCandidates(
			candidates,
			Math.min(input.scrapeLimit ?? 3, candidates.length),
			input
		);
	}
	const warnings = collectDiscoveryWarnings(candidates);
	const importConfig: ImportConfig = {
		columnMappings: [],
		sheetName: "searxng_discovery",
		updateExisting,
		matchBy: "sourceId",
		...(warnings.length > 0 ? { audit: { warnings } } : {}),
	};

	const totalRecords = candidates.length + searchFailures.length;
	const importId = await createImportRecord("searxng-discovery", totalRecords, importConfig);

	const importResults: ImportResultsSummary = {
		total: totalRecords,
		imported: 0,
		updated: 0,
		skipped: 0,
		failed: searchFailures.length,
	};
	const allErrors: ImportRecordResult[] = [...searchFailures];

	for (let i = 0; i < candidates.length; i++) {
		const candidate = candidates[i];

		try {
			const oppData = buildOpportunityFromDiscovery(candidate, userId, input);
			const existingId = await findExistingDiscoveredOpportunity(oppData);

			if (existingId && !updateExisting) {
				importResults.skipped++;
				allErrors.push({
					rowIndex: searchFailures.length + i + 1,
					status: "skipped",
					opportunityId: existingId,
				});
				continue;
			}

			if (existingId) {
				await updateOpportunity(existingId, oppData);
				importResults.updated++;
				allErrors.push({
					rowIndex: searchFailures.length + i + 1,
					status: "updated",
					opportunityId: existingId,
				});
			} else {
				const created = await createOpportunity(oppData);
				importResults.imported++;
				allErrors.push({
					rowIndex: searchFailures.length + i + 1,
					status: "created",
					opportunityId: created.id,
				});
			}
		} catch (err) {
			importResults.failed++;
			allErrors.push({
				rowIndex: searchFailures.length + i + 1,
				status: "failed",
				error: String(err),
				data: {
					title: candidate.result.title,
					rfpLink: candidate.result.url,
				},
			});
		}
	}

	await updateImportRecord(importId, {
		importedRecords: importResults.imported,
		updatedRecords: importResults.updated,
		skippedRecords: importResults.skipped,
		failedRecords: importResults.failed,
		status: "completed",
		errors: allErrors.filter((e) => e.status === "failed"),
		config: importConfig,
	});

	return {
		importId,
		results: importResults,
		errors: allErrors,
		warnings,
	};
}
