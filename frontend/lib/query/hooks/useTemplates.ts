/**
 * Template query hooks using TanStack Query with Server Actions.
 *
 * Provides data fetching, caching, and state management
 * for template operations using Next.js Server Actions.
 */

import {
	useQuery,
	useInfiniteQuery,
	useQueryClient,
	useMutation,
	type UseQueryOptions,
	type UseInfiniteQueryOptions,
} from "@tanstack/react-query";
import { queryKeys } from "../provider";
import {
	listTemplates,
	getTemplate,
	createTemplate,
	updateTemplate,
	deleteTemplate,
	listTemplateCategories,
	useTemplate as useTemplateAction,
	searchTemplates,
} from "@/app/actions/templates";
import type {
	Template,
	TemplateSummary,
	TemplateListParams,
	TemplateListResponse,
	TemplateCategory,
	TemplateId,
	CreateTemplateInput,
	UpdateTemplateInput,
	UseTemplateInput,
} from "@/lib/types/template";
import type { Document } from "@/lib/types/document";

/**
 * Hook to fetch a single template.
 *
 * @example
 * const { data: template, isLoading } = useTemplate(templateId);
 */
export function useTemplate(
	id: TemplateId | null | undefined,
	options?: Omit<
		UseQueryOptions<Template | null, Error>,
		"queryKey" | "queryFn" | "enabled"
	>
) {
	return useQuery({
		queryKey: queryKeys.template(id ?? ""),
		queryFn: () => getTemplate(id!),
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
		queryFn: () => listTemplates(params),
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
			listTemplates({ ...params, offset: pageParam as number, limit }),
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
		queryFn: listTemplateCategories,
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
		queryFn: () => listTemplates({ ...params, categoryId: categoryId! }),
		enabled: Boolean(categoryId),
		...options,
	});
}

/**
 * Hook to create a new template.
 *
 * @example
 * const { mutate: create, isPending } = useCreateTemplate();
 * create({ name: "New Template", content: {...} });
 */
export function useCreateTemplate() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: CreateTemplateInput) => createTemplate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.templates });
		},
	});
}

/**
 * Hook to update a template.
 *
 * @example
 * const { mutate: update } = useUpdateTemplate();
 * update({ id: "...", data: { name: "Updated" } });
 */
export function useUpdateTemplate() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateTemplateInput }) =>
			updateTemplate(id, data),
		onSuccess: (result, { id }) => {
			if (result) {
				queryClient.setQueryData(queryKeys.template(id), result);
			}
			queryClient.invalidateQueries({ queryKey: queryKeys.templates });
		},
	});
}

/**
 * Hook to delete a template.
 *
 * @example
 * const { mutate: remove } = useDeleteTemplate();
 * remove(templateId);
 */
export function useDeleteTemplate() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => deleteTemplate(id),
		onSuccess: (_, id) => {
			queryClient.removeQueries({ queryKey: queryKeys.template(id) });
			queryClient.invalidateQueries({ queryKey: queryKeys.templates });
		},
	});
}

/**
 * Hook to create a document from a template.
 *
 * @example
 * const { mutate: createFromTemplate, isPending } = useCreateFromTemplate();
 * createFromTemplate({ templateId: "...", title: "New Doc", placeholderValues: {} });
 */
export function useCreateFromTemplate() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: UseTemplateInput) => useTemplateAction(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.documents });
			queryClient.invalidateQueries({ queryKey: queryKeys.templates });
		},
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
			queryFn: () => getTemplate(id),
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
 *
 * @example
 * const { data } = useTemplateSearch(debouncedSearchTerm);
 */
export function useTemplateSearch(
	query: string,
	options?: Omit<
		UseQueryOptions<TemplateSummary[], Error>,
		"queryKey" | "queryFn" | "enabled"
	>
) {
	return useQuery({
		queryKey: [...queryKeys.templates, "search", query] as const,
		queryFn: () => searchTemplates(query),
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
