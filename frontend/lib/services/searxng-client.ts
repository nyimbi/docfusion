/**
 * SearXNG Client
 * 
 * Interface to the SearXNG metasearch engine running on infrastructure server.
 * Provides web search capabilities across 100+ search engines without API keys.
 */

import { logger } from "@/lib/utils/logger";

const SEARXNG_URL = process.env.SEARXNG_URL || "https://search.lindela.io";
const SEARXNG_BASE_URL = SEARXNG_URL.replace(/\/$/, "");
const SEARXNG_SPACE_INSTANCES_URL = process.env.SEARXNG_SPACE_INSTANCES_URL || "https://searx.space/data/instances.json";
const SEARXNG_FALLBACK_CACHE_MS = 60 * 60 * 1000;
const DEFAULT_SEARXNG_FALLBACK_LIMIT = 8;

export function getSearxngBaseUrl(): string {
  return SEARXNG_BASE_URL;
}

export interface SearxngResult {
  title: string;
  url: string;
  content: string;
  engine: string;
  score: number;
  category?: string;
}

export type SearxngUnresponsiveEngine =
  | string
  | [string, string]
  | { engine?: string; error?: string; message?: string };

export interface SearxngSearchResponse {
  query: string;
  number_of_results: number;
  results: SearxngResult[];
  answers?: string[];
  corrections?: string[];
  infoboxes?: unknown[];
  suggestions?: string[];
  unresponsive_engines?: SearxngUnresponsiveEngine[];
  sourceInstance?: string;
  sourceInstances?: string[];
  fallbackFrom?: string;
  fallbackReason?: string;
}

export interface SearchOptions {
  categories?: string[]; // general, images, videos, news, it, science, files, social media
  engines?: string[];
  language?: string;
  time_range?: string; // day, week, month, year
  safesearch?: 0 | 1 | 2;
  page?: number;
  sendAcceptHeader?: boolean;
}

type SearxngInstanceRecord = {
  error?: unknown;
  main?: boolean;
  network_type?: string;
  git_url?: string | null;
  http?: {
    status_code?: number | null;
    error?: unknown;
  };
  tls?: unknown;
  timing?: {
    search?: {
      success_percentage?: number;
      all?: {
        median?: number;
        value?: number;
      };
    };
  };
  engines?: Record<string, {
    error_rate?: number | null;
    errors?: unknown[];
  } | undefined>;
};

type SearxngInstancesPayload = {
  instances?: Record<string, SearxngInstanceRecord>;
};

let publicFallbackCache:
  | { expiresAt: number; key: string; urls: string[] }
  | undefined;

/**
 * Search using SearXNG
 */
export async function searchSearxng(
  query: string,
  options: SearchOptions = {}
): Promise<SearxngSearchResponse> {
  const primary = await searchSearxngBase(SEARXNG_BASE_URL, query, options);
  if (primary.ok && !shouldRetryOnFallback(primary.response, options)) {
    return withSourceInstance(primary.response, SEARXNG_BASE_URL);
  }

  const fallbackReason = primary.ok
    ? describeDegradedSearch(primary.response, options)
    : primary.error;
  const fallbacks = await getSearxngFallbackUrls(SEARXNG_BASE_URL, options.engines ?? []);
  const fallbackResponses = await Promise.all(
    fallbacks.map(async (fallbackBaseUrl) => ({
      fallbackBaseUrl,
      result: await searchSearxngBase(fallbackBaseUrl, query, options),
    }))
  );
  const usableFallbacks: Array<{ baseUrl: string; response: SearxngSearchResponse }> = [];

  for (const { fallbackBaseUrl, result: fallback } of fallbackResponses) {
    if (!fallback.ok) {
      logger.warn("[SearXNG] Fallback instance search failed", {
        query,
        fallbackBaseUrl,
        error: fallback.error,
      });
      continue;
    }
    if (fallback.response.results.length === 0 && fallback.response.unresponsive_engines?.length) {
      logger.warn("[SearXNG] Fallback instance returned no results with degraded engines", {
        query,
        fallbackBaseUrl,
        unresponsiveEngines: fallback.response.unresponsive_engines,
      });
      continue;
    }

    if (fallback.response.results.length === 0) {
      continue;
    }

    usableFallbacks.push({
      baseUrl: fallbackBaseUrl,
      response: fallback.response,
    });
  }

  if (usableFallbacks.length > 0) {
    const includePrimaryResults = primary.ok && primary.response.results.length > 0;
    const mergedResponses = includePrimaryResults
      ? [primary.response, ...usableFallbacks.map(({ response }) => response)]
      : usableFallbacks.map(({ response }) => response);
    const sourceInstances = includePrimaryResults
      ? [SEARXNG_BASE_URL, ...usableFallbacks.map(({ baseUrl }) => baseUrl)]
      : usableFallbacks.map(({ baseUrl }) => baseUrl);

    logger.warn("[SearXNG] Used fallback instance fanout after primary search degradation", {
      query,
      primaryBaseUrl: SEARXNG_BASE_URL,
      fallbackBaseUrls: usableFallbacks.map(({ baseUrl }) => baseUrl),
      fallbackReason,
    });
    return withFallbackProvenance(
      mergeSearxngResponses(query, mergedResponses),
      sourceInstances,
      SEARXNG_BASE_URL,
      fallbackReason
    );
  }

  if (primary.ok) {
    return withSourceInstance(primary.response, SEARXNG_BASE_URL);
  }
  throw new Error(primary.error);
}

async function searchSearxngBase(
  baseUrl: string,
  query: string,
  options: SearchOptions
): Promise<
  | { ok: true; response: SearxngSearchResponse }
  | { ok: false; error: string }
> {
  const url = new URL(`${baseUrl}/search`);
  
  // Required parameter
  url.searchParams.append("q", query);
  url.searchParams.append("format", "json");
  
  // Optional parameters
  if (options.categories?.length) {
    url.searchParams.append("categories", options.categories.join(","));
  }
  if (options.engines?.length) {
    url.searchParams.append("engines", options.engines.join(","));
  }
  if (options.language) {
    url.searchParams.append("language", options.language);
  }
  if (options.time_range) {
    url.searchParams.append("time_range", options.time_range);
  }
  if (options.safesearch !== undefined) {
    url.searchParams.append("safesearch", options.safesearch.toString());
  }
  if (options.page) {
    url.searchParams.append("pageno", options.page.toString());
  }

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(30000),
      ...(options.sendAcceptHeader === false ? {} : {
        headers: {
          "Accept": "application/json",
        },
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `${baseUrl} search failed: ${response.status} ${response.statusText}`,
      };
    }

    const body = await response.text();
    const parsedJson = parseSearxngJsonBody(body);
    if (parsedJson) {
      return {
        ok: true,
        response: parsedJson,
      };
    }

    const parsedHtml = parseSearxngHtmlBody(body, query, baseUrl);
    if (parsedHtml) {
      return {
        ok: true,
        response: parsedHtml,
      };
    }

    return {
      ok: false,
      error: `${baseUrl} search failed: response was not valid SearXNG JSON or HTML`,
    };
  } catch (error) {
    return {
      ok: false,
      error: `${baseUrl} search failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function shouldRetryOnFallback(response: SearxngSearchResponse, options: SearchOptions): boolean {
  if (!response.unresponsive_engines?.length) return false;
  if (!options.engines?.length) return response.results.length === 0;
  return responseHasRequestedEngineDegradation(response, options);
}

function responseHasRequestedEngineDegradation(response: SearxngSearchResponse, options: SearchOptions): boolean {
  const degradedEngines = response.unresponsive_engines ?? [];
  const requestedEngines = options.engines ?? [];
  const degraded = degradedEngines.map(describeUnresponsiveEngine).join(" ").toLowerCase();
  return requestedEngines.some((engine) => degraded.includes(engine.toLowerCase()));
}

function describeDegradedSearch(response: SearxngSearchResponse, options: SearchOptions): string {
  const engines = options.engines?.join(",") || "default engines";
  const degraded = response.unresponsive_engines?.map(describeUnresponsiveEngine).join("; ") || "unknown degradation";
  if (response.results.length > 0) {
    return `${SEARXNG_BASE_URL} returned ${response.results.length} result(s) but requested engine fanout degraded for ${engines}; degraded engines: ${degraded}`;
  }
  return `${SEARXNG_BASE_URL} returned no results for ${engines}; degraded engines: ${degraded}`;
}

function describeUnresponsiveEngine(engine: SearxngUnresponsiveEngine): string {
  if (Array.isArray(engine)) return engine.filter(Boolean).join(": ");
  if (typeof engine === "string") return engine;
  const name = engine.engine ?? "unknown";
  const reason = engine.error ?? engine.message;
  return reason ? `${name}: ${reason}` : name;
}

function parseSearxngJsonBody(body: string): SearxngSearchResponse | undefined {
  const trimmed = body.trimStart();
  if (!trimmed.startsWith("{")) return undefined;
  try {
    return JSON.parse(body) as SearxngSearchResponse;
  } catch {
    return undefined;
  }
}

function parseSearxngHtmlBody(body: string, query: string, baseUrl: string): SearxngSearchResponse | undefined {
  if (!/<html[\s>]/i.test(body) && !/<article\b/i.test(body)) return undefined;
  const results: SearxngResult[] = [];
  const seen = new Set<string>();
  const articlePattern = /<article\b[^>]*class=["'][^"']*\bresult\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi;
  let articleMatch: RegExpExecArray | null;
  while ((articleMatch = articlePattern.exec(body)) && results.length < 50) {
    const article = articleMatch[1] ?? "";
    const linkMatch = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(article);
    if (!linkMatch) continue;
    const url = normalizeSearxngHtmlResultUrl(decodeHtmlEntities(linkMatch[1] ?? ""), baseUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const content =
      extractHtmlClassText(article, "content") ||
      extractHtmlClassText(article, "result-content") ||
      "";
    const engine = extractHtmlClassText(article, "engine") || "searxng_html";
    results.push({
      title: stripHtml(linkMatch[2] ?? ""),
      url,
      content,
      engine,
      score: Math.max(0.1, 1 - results.length / 100),
    });
  }

  return {
    query,
    number_of_results: results.length,
    results,
  };
}

function withSourceInstance(response: SearxngSearchResponse, sourceInstance: string): SearxngSearchResponse {
  return {
    ...response,
    sourceInstance,
  };
}

function withFallbackProvenance(
  response: SearxngSearchResponse,
  sourceInstances: string[],
  fallbackFrom: string,
  fallbackReason: string
): SearxngSearchResponse {
  return {
    ...response,
    sourceInstance: sourceInstances[0],
    sourceInstances,
    fallbackFrom,
    fallbackReason,
    unresponsive_engines: [
      ...(response.unresponsive_engines ?? []),
      {
        engine: "searxng_primary",
        error: fallbackReason,
      },
    ],
  };
}

function mergeSearxngResponses(query: string, responses: SearxngSearchResponse[]): SearxngSearchResponse {
  const seenResultUrls = new Set<string>();
  const results: SearxngResult[] = [];
  for (const response of responses) {
    for (const result of response.results) {
      const identity = normalizeSearchResultUrl(result.url) ?? `${result.engine}:${result.title}:${result.url}`;
      if (seenResultUrls.has(identity)) continue;
      seenResultUrls.add(identity);
      results.push(result);
    }
  }

  return {
    query: responses[0]?.query ?? query,
    number_of_results: results.length,
    results,
    answers: mergeUniqueStrings(responses.flatMap((response) => response.answers ?? [])),
    corrections: mergeUniqueStrings(responses.flatMap((response) => response.corrections ?? [])),
    infoboxes: responses.flatMap((response) => response.infoboxes ?? []),
    suggestions: mergeUniqueStrings(responses.flatMap((response) => response.suggestions ?? [])),
    unresponsive_engines: responses.flatMap((response) => response.unresponsive_engines ?? []),
  };
}

function mergeUniqueStrings(values: string[]): string[] | undefined {
  const merged = Array.from(new Set(values.filter((value) => value.trim().length > 0)));
  return merged.length > 0 ? merged : undefined;
}

function normalizeSearchResultUrl(rawUrl: string): string | undefined {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

async function getSearxngFallbackUrls(primaryBaseUrl: string, requestedEngines: string[] = []): Promise<string[]> {
  const limit = searxngFallbackLimit();
  const configured = configuredSearxngFallbackUrls(primaryBaseUrl);
  if (configured.length >= limit) {
    return configured.slice(0, limit);
  }

  const publicUrls = await publicSearxngFallbackUrls(primaryBaseUrl, requestedEngines);
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const url of [...configured, ...publicUrls]) {
    const normalized = normalizeBaseUrl(url);
    if (!normalized || normalized === primaryBaseUrl || seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }
  return urls.slice(0, limit);
}

function configuredSearxngFallbackUrls(primaryBaseUrl: string): string[] {
  const raw = process.env.SEARXNG_FALLBACK_URLS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((url) => normalizeBaseUrl(url))
    .filter((url): url is string => Boolean(url && url !== primaryBaseUrl));
}

async function publicSearxngFallbackUrls(primaryBaseUrl: string, requestedEngines: string[]): Promise<string[]> {
  if (process.env.SEARXNG_PUBLIC_FALLBACKS === "0") return [];
  const cacheKey = requestedEngines
    .map(normalizeEngineName)
    .filter(Boolean)
    .sort()
    .join(",");
  if (publicFallbackCache && publicFallbackCache.key === cacheKey && publicFallbackCache.expiresAt > Date.now()) {
    return publicFallbackCache.urls;
  }

  try {
    const response = await fetch(SEARXNG_SPACE_INSTANCES_URL, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "Accept": "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const payload = await response.json() as SearxngInstancesPayload;
    const urls = Object.entries(payload.instances ?? {})
      .filter(([, instance]) => isUsablePublicSearxngInstance(instance, requestedEngines))
      .sort(([, a], [, b]) =>
        requestedEngineHealthScore(b, requestedEngines) - requestedEngineHealthScore(a, requestedEngines) ||
        (instanceSearchSuccess(b) ?? 0) - (instanceSearchSuccess(a) ?? 0) ||
        instanceSearchMedian(a) - instanceSearchMedian(b)
      )
      .map(([url]) => normalizeBaseUrl(url))
      .filter((url): url is string => Boolean(url && url !== primaryBaseUrl));

    publicFallbackCache = {
      expiresAt: Date.now() + SEARXNG_FALLBACK_CACHE_MS,
      key: cacheKey,
      urls,
    };
    return urls;
  } catch (error) {
    logger.warn("[SearXNG] Could not refresh searx.space fallback instances", {
      url: SEARXNG_SPACE_INSTANCES_URL,
      error: error instanceof Error ? error.message : String(error),
    });
    publicFallbackCache = {
      expiresAt: Date.now() + 5 * 60 * 1000,
      key: cacheKey,
      urls: [],
    };
    return [];
  }
}

function isUsablePublicSearxngInstance(instance: SearxngInstanceRecord, requestedEngines: string[] = []): boolean {
  if (instance.error || instance.http?.error) return false;
  if (instance.http?.status_code !== 200) return false;
  if (instance.network_type && instance.network_type !== "normal") return false;
  if (instance.git_url && !instance.git_url.includes("searxng")) return false;
  const searchSuccess = instanceSearchSuccess(instance);
  if (searchSuccess !== undefined && searchSuccess <= 0) return false;
  if (requestedEngineHealthScore(instance, requestedEngines) < 0) return false;
  return true;
}

function requestedEngineHealthScore(instance: SearxngInstanceRecord, requestedEngines: string[]): number {
  const normalizedEngines = requestedEngines
    .map(normalizeEngineName)
    .filter((engine) => engine.length > 0);
  if (!normalizedEngines.length) return 0;

  const knownRates = normalizedEngines
    .map((engine) => instanceEngineErrorRate(instance, engine))
    .filter((rate): rate is number => rate !== undefined);
  if (!knownRates.length) return 0;

  if (knownRates.every((rate) => rate >= 90)) return -1;
  const averageErrorRate = knownRates.reduce((sum, rate) => sum + rate, 0) / knownRates.length;
  return 100 - averageErrorRate;
}

function instanceEngineErrorRate(instance: SearxngInstanceRecord, normalizedEngine: string): number | undefined {
  for (const [engineName, engine] of Object.entries(instance.engines ?? {})) {
    if (normalizeEngineName(engineName) !== normalizedEngine) continue;
    const rate = Number(engine?.error_rate);
    return Number.isFinite(rate) ? rate : undefined;
  }
  return undefined;
}

function normalizeEngineName(value: string): string {
  return value.trim().toLowerCase();
}

function instanceSearchMedian(instance: SearxngInstanceRecord): number {
  const median = instance.timing?.search?.all?.median ?? instance.timing?.search?.all?.value;
  return Number.isFinite(median) ? median! : Number.MAX_SAFE_INTEGER;
}

function instanceSearchSuccess(instance: SearxngInstanceRecord): number | undefined {
  const success = instance.timing?.search?.success_percentage;
  return Number.isFinite(success) ? success : undefined;
}

function searxngFallbackLimit(): number {
  const parsed = Number(process.env.SEARXNG_PUBLIC_FALLBACK_LIMIT ?? DEFAULT_SEARXNG_FALLBACK_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_SEARXNG_FALLBACK_LIMIT;
  return Math.min(12, Math.max(0, Math.trunc(parsed)));
}

function normalizeBaseUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

function normalizeSearxngHtmlResultUrl(rawUrl: string, baseUrl: string): string | undefined {
  try {
    const url = new URL(rawUrl, baseUrl);
    if (url.origin === baseUrl && url.pathname === "/url" && url.searchParams.get("url")) {
      return normalizeSearxngHtmlResultUrl(url.searchParams.get("url") ?? "", baseUrl);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

function extractHtmlClassText(html: string, className: string): string | undefined {
  const pattern = new RegExp(
    `<[^>]*class=["'][^"']*\\b${escapeRegExp(className)}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`,
    "i"
  );
  const match = pattern.exec(html);
  const text = stripHtml(match?.[1] ?? "");
  return text || undefined;
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Search for documents (PDFs, DOCX, etc.)
 */
export async function searchDocuments(
  query: string,
  fileTypes: string[] = ["pdf", "docx", "doc"]
): Promise<SearxngResult[]> {
  // Add filetype constraints to query
  const fileTypeQuery = fileTypes.map(ft => `filetype:${ft}`).join(" OR ");
  const fullQuery = `${query} (${fileTypeQuery})`;
  
  const response = await searchSearxng(fullQuery, {
    categories: ["files"],
  });
  
  return response.results.filter(result => {
    const url = result.url.toLowerCase();
    return fileTypes.some(ft => url.endsWith(`.${ft}`) || url.includes(`.${ft}?`));
  });
}

/**
 * Search with multiple queries in parallel
 */
export async function searchMultiple(
  queries: string[],
  options: SearchOptions = {}
): Promise<Map<string, SearxngResult[]>> {
  const results = new Map<string, SearxngResult[]>();
  
  await Promise.all(
    queries.map(async (query) => {
      try {
        const response = await searchSearxng(query, options);
        results.set(query, response.results);
      } catch (error) {
        logger.error(`SearXNG search failed for "${query}":`, error);
        results.set(query, []);
      }
    })
  );
  
  return results;
}

/**
 * Check SearXNG health
 */
export async function checkSearxngHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${SEARXNG_BASE_URL}/health`, {
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      return true;
    }
  } catch {
    // Some SearXNG deployments do not expose /health; fall through to search probe.
  }

  try {
    const url = new URL(`${SEARXNG_BASE_URL}/search`);
    url.searchParams.set("q", "tenders.go.ke");
    url.searchParams.set("format", "json");
    url.searchParams.set("engines", "bing");
    url.searchParams.set("language", "en");
    url.searchParams.set("safesearch", "1");
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
      headers: {
        "Accept": "application/json",
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
