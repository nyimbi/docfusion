/**
 * Template query hooks using TanStack Query.
 *
 * Provides data fetching, caching, and state management
 * for template operations.
 */

import {
	useQuery,
	useInfiniteQuery,
	useQueryClient,
	type UseQueryOptions,
	type UseInfiniteQueryOptions,
} from "@tanstack/react-query";
import { fetcher } from "@/lib/api/client";
import { queryKeys } from "../provider";
import type {
	Template,
	TemplateSummary,
	TemplateListParams,
	TemplateListResponse,
	TemplateCategory,
	TemplateId,
	TemplateWithCategories,
} from "@/lib/types/template";

/**
 * Fetch a single template by ID.
 */
async function fetchTemplate(id: TemplateId): Promise<Template> {
	return fetcher<Template>(`/templates/${id}`);
}

/**
 * Fetch a template with resolved categories.
 */
async function fetchTemplateWithCategories(
	id: TemplateId
): Promise<TemplateWithCategories> {
	return fetcher<TemplateWithCategories>(`/templates/${id}?include=categories`);
}

/**
 * Fetch a paginated list of templates.
 */
async function fetchTemplates(
	params: TemplateListParams
): Promise<TemplateListResponse> {
	const searchParams = new URLSearchParams();

	if (params.status) searchParams.set("status", params.status);
	if (params.visibility) searchParams.set("visibility", params.visibility);
	if (params.categoryId) searchParams.set("category_id", params.categoryId);
	if (params.tags?.length) searchParams.set("tags", params.tags.join(","));
	if (params.difficulty) searchParams.set("difficulty", params.difficulty);
	if (params.search) searchParams.set("search", params.search);
	if (params.sortBy) searchParams.set("sort_by", params.sortBy);
	if (params.sortOrder) searchParams.set("sort_order", params.sortOrder);
	if (params.offset !== undefined)
		searchParams.set("offset", String(params.offset));
	if (params.limit !== undefined)
		searchParams.set("limit", String(params.limit));

	const queryString = searchParams.toString();
	const endpoint = queryString ? `/templates?${queryString}` : "/templates";

	return fetcher<TemplateListResponse>(endpoint);
}

/**
 * Fetch all template categories.
 */
async function fetchTemplateCategories(): Promise<TemplateCategory[]> {
	return fetcher<TemplateCategory[]>("/templates/categories");
}

/**
 * Hook to fetch a single template.
 *
 * @example
 * const { data: template, isLoading } = useTemplate(templateId);
 */
export function useTemplate(
	id: TemplateId | null | undefined,
	options?: Omit<
		UseQueryOptions<Template, Error>,
		"queryKey" | "queryFn" | "enabled"
	>
) {
	return useQuery({
		queryKey: queryKeys.template(id ?? ""),
		queryFn: () => fetchTemplate(id!),
		enabled: Boolean(id),
		...options,
	});
}

/**
 * Hook to fetch a template with resolved categories.
 *
 * @example
 * const { data: template } = useTemplateWithCategories(templateId);
 * // template.categories is resolved
 */
export function useTemplateWithCategories(
	id: TemplateId | null | undefined,
	options?: Omit<
		UseQueryOptions<TemplateWithCategories, Error>,
		"queryKey" | "queryFn" | "enabled"
	>
) {
	return useQuery({
		queryKey: [...queryKeys.template(id ?? ""), "with-categories"] as const,
		queryFn: () => fetchTemplateWithCategories(id!),
		enabled: Boolean(id),
		...options,
	});
}

/**
 * Hook to fetch a paginated list of templates.
 *
 * @example
 * const { data } = useTemplates({ categoryId: "proposals", limit: 20 });
 */
export function useTemplates(
	params: TemplateListParams = {},
	options?: Omit<
		UseQueryOptions<TemplateListResponse, Error>,
		"queryKey" | "queryFn"
	>
) {
	return useQuery({
		queryKey: [...queryKeys.templates, params] as const,
		queryFn: () => fetchTemplates(params),
		...options,
	});
}

/**
 * Hook to fetch templates with infinite scrolling.
 *
 * @example
 * const { data, fetchNextPage, hasNextPage } = useInfiniteTemplates({ limit: 12 });
 */
export function useInfiniteTemplates(
	params: Omit<TemplateListParams, "offset"> = {},
	options?: Omit<
		UseInfiniteQueryOptions<TemplateListResponse, Error>,
		"queryKey" | "queryFn" | "getNextPageParam" | "initialPageParam"
	>
) {
	const limit = params.limit ?? 12;

	return useInfiniteQuery({
		queryKey: [...queryKeys.templates, "infinite", params] as const,
		queryFn: ({ pageParam }) =>
			fetchTemplates({ ...params, offset: pageParam as number, limit }),
		initialPageParam: 0,
		getNextPageParam: (lastPage: TemplateListResponse): number | undefined =>
			lastPage.hasMore ? lastPage.offset + lastPage.limit : undefined,
		...options,
	});
}

/**
 * Hook to fetch template categories.
 *
 * @example
 * const { data: categories } = useTemplateCategories();
 */
export function useTemplateCategories(
	options?: Omit<
		UseQueryOptions<TemplateCategory[], Error>,
		"queryKey" | "queryFn"
	>
) {
	return useQuery({
		queryKey: queryKeys.templateCategories,
		queryFn: fetchTemplateCategories,
		// Categories change infrequently, cache for longer
		staleTime: 30 * 60 * 1000, // 30 minutes
		...options,
	});
}

/**
 * Hook to fetch templates by category.
 *
 * @example
 * const { data } = useTemplatesByCategory("proposals");
 */
export function useTemplatesByCategory(
	categoryId: string | null | undefined,
	params: Omit<TemplateListParams, "categoryId"> = {},
	options?: Omit<
		UseQueryOptions<TemplateListResponse, Error>,
		"queryKey" | "queryFn" | "enabled"
	>
) {
	return useQuery({
		queryKey: [...queryKeys.templates, "category", categoryId, params] as const,
		queryFn: () => fetchTemplates({ ...params, categoryId: categoryId! }),
		enabled: Boolean(categoryId),
		...options,
	});
}

/**
 * Hook to prefetch a template (for hover previews).
 *
 * @example
 * const prefetchTemplate = usePrefetchTemplate();
 * onMouseEnter={() => prefetchTemplate(templateId)}
 */
export function usePrefetchTemplate() {
	const queryClient = useQueryClient();

	return (id: TemplateId) => {
		queryClient.prefetchQuery({
			queryKey: queryKeys.template(id),
			queryFn: () => fetchTemplate(id),
			staleTime: 10 * 60 * 1000, // Consider fresh for 10 minutes
		});
	};
}

/**
 * Hook to invalidate template queries.
 *
 * @example
 * const invalidate = useInvalidateTemplates();
 * await updateTemplate(id, data);
 * invalidate(id);
 */
export function useInvalidateTemplates() {
	const queryClient = useQueryClient();

	return (id?: TemplateId) => {
		if (id) {
			queryClient.invalidateQueries({ queryKey: queryKeys.template(id) });
		}
		queryClient.invalidateQueries({ queryKey: queryKeys.templates });
	};
}

/**
 * Hook to get cached template data synchronously.
 */
export function useGetCachedTemplate() {
	const queryClient = useQueryClient();

	return (id: TemplateId): Template | undefined => {
		return queryClient.getQueryData<Template>(queryKeys.template(id));
	};
}

/**
 * Hook to search templates with debounced input.
 * Combines with list params for filtering.
 *
 * @example
 * const { data, refetch } = useTemplateSearch(debouncedSearchTerm);
 */
export function useTemplateSearch(
	query: string,
	params: Omit<TemplateListParams, "search"> = {},
	options?: Omit<
		UseQueryOptions<TemplateListResponse, Error>,
		"queryKey" | "queryFn" | "enabled"
	>
) {
	return useQuery({
		queryKey: [...queryKeys.templates, "search", query, params] as const,
		queryFn: () => fetchTemplates({ ...params, search: query }),
		enabled: query.length >= 2, // Only search with 2+ characters
		...options,
	});
}

/**
 * Type for flattened template list.
 */
export interface FlattenedTemplateList {
	templates: TemplateSummary[];
	total: number;
}

/**
 * Flatten infinite query pages into a single list.
 */
export function flattenTemplatePages(
	pages: TemplateListResponse[] | undefined
): FlattenedTemplateList {
	if (!pages) return { templates: [], total: 0 };

	return {
		templates: pages.flatMap((page) => page.templates),
		total: pages[0]?.total ?? 0,
	};
}

/**
 * Category tree node with recursive children.
 */
export type CategoryTreeNode = TemplateCategory & { children: CategoryTreeNode[] };

/**
 * Build a category tree from flat category list.
 */
export function buildCategoryTree(
	categories: TemplateCategory[]
): CategoryTreeNode[] {
	const map = new Map<string, CategoryTreeNode>();
	const roots: CategoryTreeNode[] = [];

	// First pass: create map entries
	for (const category of categories) {
		map.set(category.id, { ...category, children: [] });
	}

	// Second pass: build tree
	for (const category of categories) {
		const node = map.get(category.id)!;
		if (category.parentId) {
			const parent = map.get(category.parentId);
			if (parent) {
				parent.children.push(node);
			} else {
				roots.push(node);
			}
		} else {
			roots.push(node);
		}
	}

	// Sort by order
	const sortByOrder = (a: TemplateCategory, b: TemplateCategory) =>
		a.order - b.order;
	roots.sort(sortByOrder);
	for (const node of map.values()) {
		node.children.sort(sortByOrder);
	}

	return roots;
}
