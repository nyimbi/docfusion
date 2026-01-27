/**
 * Search query hooks for DocFusion.
 *
 * Provides hooks for global search functionality across
 * documents, templates, and other content types.
 */

import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { DocumentSummary } from "@/lib/types/document";
import type { TemplateSummary } from "@/lib/types/template";

/**
 * Query keys for search.
 */
export const searchKeys = {
	all: ["search"] as const,
	global: (query: string) => [...searchKeys.all, "global", query] as const,
	documents: (query: string) => [...searchKeys.all, "documents", query] as const,
	templates: (query: string) => [...searchKeys.all, "templates", query] as const,
	suggestions: (query: string) => [...searchKeys.all, "suggestions", query] as const,
};

/**
 * Search result types.
 */
export type SearchResultType = "document" | "template" | "tag" | "category";

/**
 * Unified search result item.
 */
export interface SearchResult {
	id: string;
	type: SearchResultType;
	title: string;
	excerpt?: string;
	url: string;
	score: number;
	highlights?: {
		field: string;
		snippet: string;
	}[];
	metadata?: Record<string, unknown>;
}

/**
 * Global search response.
 */
export interface GlobalSearchResponse {
	results: SearchResult[];
	total: number;
	query: string;
	took: number; // Search duration in ms
	facets?: {
		types: Record<SearchResultType, number>;
		categories?: Record<string, number>;
		tags?: Record<string, number>;
	};
}

/**
 * Search parameters.
 */
export interface SearchParams {
	query: string;
	types?: SearchResultType[];
	categories?: string[];
	tags?: string[];
	limit?: number;
	offset?: number;
	sortBy?: "relevance" | "date" | "title";
	sortOrder?: "asc" | "desc";
}

/**
 * Search suggestions response.
 */
export interface SearchSuggestionsResponse {
	suggestions: string[];
	recentSearches: string[];
}

/**
 * Perform global search.
 */
async function globalSearch(params: SearchParams): Promise<GlobalSearchResponse> {
	const searchParams = new URLSearchParams();
	searchParams.set("q", params.query);

	if (params.types?.length) {
		searchParams.set("types", params.types.join(","));
	}
	if (params.categories?.length) {
		searchParams.set("categories", params.categories.join(","));
	}
	if (params.tags?.length) {
		searchParams.set("tags", params.tags.join(","));
	}
	if (params.limit) {
		searchParams.set("limit", params.limit.toString());
	}
	if (params.offset) {
		searchParams.set("offset", params.offset.toString());
	}
	if (params.sortBy) {
		searchParams.set("sort_by", params.sortBy);
	}
	if (params.sortOrder) {
		searchParams.set("sort_order", params.sortOrder);
	}

	return apiClient.get<GlobalSearchResponse>(
		`/api/v1/search?${searchParams.toString()}`
	);
}

/**
 * Fetch search suggestions.
 */
async function fetchSearchSuggestions(
	query: string
): Promise<SearchSuggestionsResponse> {
	if (!query || query.length < 2) {
		return { suggestions: [], recentSearches: [] };
	}

	return apiClient.get<SearchSuggestionsResponse>(
		`/api/v1/search/suggestions?q=${encodeURIComponent(query)}`
	);
}

/**
 * Hook for global search across all content types.
 *
 * @param query - Search query string
 * @param options - Search options and query configuration
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useGlobalSearch("proposal", {
 *   types: ["document", "template"],
 *   limit: 20,
 * });
 * ```
 */
export function useGlobalSearch(
	query: string,
	options: Omit<SearchParams, "query"> & { enabled?: boolean } = {}
) {
	const { enabled = true, ...searchOptions } = options;

	return useQuery({
		queryKey: searchKeys.global(query),
		queryFn: () => globalSearch({ query, ...searchOptions }),
		enabled: enabled && query.length >= 2,
		staleTime: 1000 * 60, // 1 minute
		placeholderData: (previousData) => previousData,
	});
}

/**
 * Hook for infinite scrolling search results.
 *
 * @param query - Search query string
 * @param options - Search options
 *
 * @example
 * ```tsx
 * const {
 *   data,
 *   fetchNextPage,
 *   hasNextPage,
 * } = useInfiniteSearch("proposal");
 * ```
 */
export function useInfiniteSearch(
	query: string,
	options: Omit<SearchParams, "query" | "offset"> & { enabled?: boolean } = {}
) {
	const { enabled = true, limit = 20, ...searchOptions } = options;

	return useInfiniteQuery({
		queryKey: [...searchKeys.global(query), "infinite"],
		queryFn: ({ pageParam = 0 }) =>
			globalSearch({
				query,
				...searchOptions,
				limit,
				offset: pageParam,
			}),
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			const totalFetched = allPages.reduce(
				(acc, page) => acc + page.results.length,
				0
			);
			return totalFetched < lastPage.total ? totalFetched : undefined;
		},
		enabled: enabled && query.length >= 2,
	});
}

/**
 * Hook for search suggestions (autocomplete).
 *
 * @param query - Partial search query
 *
 * @example
 * ```tsx
 * const { data } = useSearchSuggestions("prop");
 * // data.suggestions = ["proposal", "property", "proposition"]
 * ```
 */
export function useSearchSuggestions(query: string) {
	return useQuery({
		queryKey: searchKeys.suggestions(query),
		queryFn: () => fetchSearchSuggestions(query),
		enabled: query.length >= 2,
		staleTime: 1000 * 30, // 30 seconds
	});
}

/**
 * Hook for document-only search.
 *
 * @param query - Search query
 * @param options - Search options
 */
export function useDocumentSearch(
	query: string,
	options: { limit?: number; enabled?: boolean } = {}
) {
	return useGlobalSearch(query, {
		...options,
		types: ["document"],
	});
}

/**
 * Hook for template-only search.
 *
 * @param query - Search query
 * @param options - Search options
 */
export function useTemplateSearch(
	query: string,
	options: { limit?: number; enabled?: boolean } = {}
) {
	return useGlobalSearch(query, {
		...options,
		types: ["template"],
	});
}

/**
 * Transform search results to document summaries.
 * Useful when you need DocumentSummary[] from search results.
 */
export function searchResultsToDocuments(
	results: SearchResult[]
): DocumentSummary[] {
	return results
		.filter((r) => r.type === "document")
		.map((r) => ({
			id: r.id,
			title: r.title,
			excerpt: r.excerpt,
			status: (r.metadata?.status as DocumentSummary["status"]) ?? "draft",
			visibility: (r.metadata?.visibility as DocumentSummary["visibility"]) ?? "private",
			ownerId: (r.metadata?.ownerId as string) ?? "",
			tags: (r.metadata?.tags as string[]) ?? [],
			updatedAt: (r.metadata?.updatedAt as string) ?? new Date().toISOString(),
			createdAt: (r.metadata?.createdAt as string) ?? new Date().toISOString(),
			wordCount: (r.metadata?.wordCount as number) ?? 0,
		}));
}

/**
 * Transform search results to template summaries.
 */
export function searchResultsToTemplates(
	results: SearchResult[]
): TemplateSummary[] {
	return results
		.filter((r) => r.type === "template")
		.map((r) => ({
			id: r.id,
			name: r.title,
			description: r.excerpt ?? "",
			status: (r.metadata?.status as TemplateSummary["status"]) ?? "published",
			visibility: (r.metadata?.visibility as TemplateSummary["visibility"]) ?? "private",
			categoryIds: (r.metadata?.categoryIds as string[]) ?? [],
			tags: (r.metadata?.tags as string[]) ?? [],
			useCount: (r.metadata?.useCount as number) ?? 0,
			rating: r.metadata?.rating as number | undefined,
			ratingCount: r.metadata?.ratingCount as number | undefined,
			previewImageUrl: r.metadata?.previewImageUrl as string | undefined,
			estimatedTime: r.metadata?.estimatedTime as number | undefined,
			difficulty: r.metadata?.difficulty as TemplateSummary["difficulty"],
			updatedAt: (r.metadata?.updatedAt as string) ?? new Date().toISOString(),
			createdAt: (r.metadata?.createdAt as string) ?? new Date().toISOString(),
		}));
}
