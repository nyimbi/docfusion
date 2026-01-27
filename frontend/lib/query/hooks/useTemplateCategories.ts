/**
 * Template categories query hooks for DocFusion.
 *
 * Provides hooks for fetching and managing template categories.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { TemplateCategory } from "@/lib/types/template";

/**
 * Query keys for template categories.
 */
export const templateCategoryKeys = {
	all: ["templateCategories"] as const,
	list: () => [...templateCategoryKeys.all, "list"] as const,
	detail: (id: string) => [...templateCategoryKeys.all, "detail", id] as const,
};

/**
 * API response for template categories list.
 */
interface TemplateCategoriesResponse {
	categories: TemplateCategory[];
	total: number;
}

/**
 * Fetch template categories from API.
 */
async function fetchTemplateCategories(): Promise<TemplateCategory[]> {
	const response = await apiClient.get<TemplateCategoriesResponse>(
		"/api/v1/templates/categories"
	);
	return response.categories;
}

/**
 * Fetch a single template category.
 */
async function fetchTemplateCategory(id: string): Promise<TemplateCategory> {
	return apiClient.get<TemplateCategory>(`/api/v1/templates/categories/${id}`);
}

/**
 * Create a new template category.
 */
interface CreateCategoryParams {
	name: string;
	description?: string;
	icon?: string;
	color?: string;
}

async function createTemplateCategory(
	params: CreateCategoryParams
): Promise<TemplateCategory> {
	return apiClient.post<TemplateCategory>("/api/v1/templates/categories", params);
}

/**
 * Update a template category.
 */
interface UpdateCategoryParams extends Partial<CreateCategoryParams> {
	id: string;
}

async function updateTemplateCategory(
	params: UpdateCategoryParams
): Promise<TemplateCategory> {
	const { id, ...data } = params;
	return apiClient.put<TemplateCategory>(`/api/v1/templates/categories/${id}`, data);
}

/**
 * Delete a template category.
 */
async function deleteTemplateCategory(id: string): Promise<void> {
	await apiClient.delete(`/api/v1/templates/categories/${id}`);
}

/**
 * Hook to fetch all template categories.
 *
 * @example
 * ```tsx
 * const { data: categories, isLoading } = useTemplateCategories();
 * ```
 */
export function useTemplateCategories() {
	return useQuery({
		queryKey: templateCategoryKeys.list(),
		queryFn: fetchTemplateCategories,
		staleTime: 1000 * 60 * 10, // 10 minutes - categories don't change often
	});
}

/**
 * Hook to fetch a single template category.
 *
 * @param id - Category ID
 * @param options - Query options
 *
 * @example
 * ```tsx
 * const { data: category } = useTemplateCategory("cat-123");
 * ```
 */
export function useTemplateCategory(
	id: string,
	options: { enabled?: boolean } = {}
) {
	return useQuery({
		queryKey: templateCategoryKeys.detail(id),
		queryFn: () => fetchTemplateCategory(id),
		enabled: options.enabled !== false && !!id,
		staleTime: 1000 * 60 * 10,
	});
}

/**
 * Hook to create a new template category.
 *
 * @example
 * ```tsx
 * const createCategory = useCreateCategoryMutation();
 * await createCategory.mutateAsync({ name: "Business" });
 * ```
 */
export function useCreateCategoryMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: createTemplateCategory,
		onSuccess: (newCategory) => {
			// Add to list cache
			queryClient.setQueryData<TemplateCategory[]>(
				templateCategoryKeys.list(),
				(old) => (old ? [...old, newCategory] : [newCategory])
			);
		},
	});
}

/**
 * Hook to update a template category.
 *
 * @example
 * ```tsx
 * const updateCategory = useUpdateCategoryMutation();
 * await updateCategory.mutateAsync({ id: "cat-123", name: "Updated Name" });
 * ```
 */
export function useUpdateCategoryMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: updateTemplateCategory,
		onSuccess: (updatedCategory) => {
			// Update in list cache
			queryClient.setQueryData<TemplateCategory[]>(
				templateCategoryKeys.list(),
				(old) =>
					old?.map((cat) =>
						cat.id === updatedCategory.id ? updatedCategory : cat
					)
			);
			// Update detail cache
			queryClient.setQueryData(
				templateCategoryKeys.detail(updatedCategory.id),
				updatedCategory
			);
		},
	});
}

/**
 * Hook to delete a template category.
 *
 * @example
 * ```tsx
 * const deleteCategory = useDeleteCategoryMutation();
 * await deleteCategory.mutateAsync("cat-123");
 * ```
 */
export function useDeleteCategoryMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: deleteTemplateCategory,
		onSuccess: (_, deletedId) => {
			// Remove from list cache
			queryClient.setQueryData<TemplateCategory[]>(
				templateCategoryKeys.list(),
				(old) => old?.filter((cat) => cat.id !== deletedId)
			);
			// Remove detail cache
			queryClient.removeQueries({
				queryKey: templateCategoryKeys.detail(deletedId),
			});
		},
	});
}

/**
 * Get category by ID from cache or fetch.
 * Useful for getting category info in components that already have the ID.
 */
export function useCategoryName(categoryId: string | undefined): string {
	const { data: categories } = useTemplateCategories();

	if (!categoryId || !categories) return "";

	const category = categories.find((c) => c.id === categoryId);
	return category?.name ?? "";
}
