/**
 * SearXNG Client
 * 
 * Interface to the SearXNG metasearch engine running on infrastructure server.
 * Provides web search capabilities across 100+ search engines without API keys.
 */

import { logger } from "@/lib/utils/logger";

const SEARXNG_URL = process.env.SEARXNG_URL || "https://search.lindela.io";
const SEARXNG_BASE_URL = SEARXNG_URL.replace(/\/$/, "");

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
}

export interface SearchOptions {
  categories?: string[]; // general, images, videos, news, it, science, files, social media
  engines?: string[];
  language?: string;
  time_range?: string; // day, week, month, year
  safesearch?: 0 | 1 | 2;
  page?: number;
}

/**
 * Search using SearXNG
 */
export async function searchSearxng(
  query: string,
  options: SearchOptions = {}
): Promise<SearxngSearchResponse> {
  const url = new URL(`${SEARXNG_BASE_URL}/search`);
  
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

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(30000),
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`SearXNG search failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
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
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      return true;
    }
  } catch {
    // Some SearXNG deployments do not expose /health; fall through to search probe.
  }

  try {
    const url = new URL(`${SEARXNG_BASE_URL}/search`);
    url.searchParams.set("q", "rfp");
    url.searchParams.set("format", "json");
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
      headers: {
        "Accept": "application/json",
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
