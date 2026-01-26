/**
 * Document query hooks using TanStack Query.
 *
 * Provides data fetching, caching, and state management
 * for document operations.
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
	Document,
	DocumentSummary,
	DocumentListParams,
	DocumentListResponse,
	DocumentYjsState,
	DocumentVersion,
	DocumentId,
} from "@/lib/types/document";

/**
 * Fetch a single document by ID.
 */
async function fetchDocument(id: DocumentId): Promise<Document> {
	return fetcher<Document>(`/documents/${id}`);
}

/**
 * Fetch a paginated list of documents.
 */
async function fetchDocuments(
	params: DocumentListParams
): Promise<DocumentListResponse> {
	const searchParams = new URLSearchParams();

	if (params.status) searchParams.set("status", params.status);
	if (params.visibility) searchParams.set("visibility", params.visibility);
	if (params.ownerId) searchParams.set("owner_id", params.ownerId);
	if (params.tags?.length) searchParams.set("tags", params.tags.join(","));
	if (params.search) searchParams.set("search", params.search);
	if (params.sortBy) searchParams.set("sort_by", params.sortBy);
	if (params.sortOrder) searchParams.set("sort_order", params.sortOrder);
	if (params.offset !== undefined)
		searchParams.set("offset", String(params.offset));
	if (params.limit !== undefined)
		searchParams.set("limit", String(params.limit));

	const queryString = searchParams.toString();
	const endpoint = queryString ? `/documents?${queryString}` : "/documents";

	return fetcher<DocumentListResponse>(endpoint);
}

/**
 * Fetch Yjs collaboration state for a document.
 */
async function fetchDocumentYjsState(
	id: DocumentId
): Promise<DocumentYjsState> {
	return fetcher<DocumentYjsState>(`/documents/${id}/state`);
}

/**
 * Fetch version history for a document.
 */
async function fetchDocumentVersions(
	id: DocumentId
): Promise<DocumentVersion[]> {
	return fetcher<DocumentVersion[]>(`/documents/${id}/versions`);
}

/**
 * Hook to fetch a single document.
 *
 * @example
 * const { data: document, isLoading, error } = useDocument(documentId);
 */
export function useDocument(
	id: DocumentId | null | undefined,
	options?: Omit<
		UseQueryOptions<Document, Error>,
		"queryKey" | "queryFn" | "enabled"
	>
) {
	return useQuery({
		queryKey: queryKeys.document(id ?? ""),
		queryFn: () => fetchDocument(id!),
		enabled: Boolean(id),
		...options,
	});
}

/**
 * Hook to fetch a paginated list of documents.
 *
 * @example
 * const { data, isLoading } = useDocuments({ status: "draft", limit: 20 });
 */
export function useDocuments(
	params: DocumentListParams = {},
	options?: Omit<
		UseQueryOptions<DocumentListResponse, Error>,
		"queryKey" | "queryFn"
	>
) {
	return useQuery({
		queryKey: [...queryKeys.documents, params] as const,
		queryFn: () => fetchDocuments(params),
		...options,
	});
}

/**
 * Hook to fetch documents with infinite scrolling.
 *
 * @example
 * const { data, fetchNextPage, hasNextPage } = useInfiniteDocuments({ limit: 20 });
 */
export function useInfiniteDocuments(
	params: Omit<DocumentListParams, "offset"> = {},
	options?: Omit<
		UseInfiniteQueryOptions<DocumentListResponse, Error>,
		"queryKey" | "queryFn" | "getNextPageParam" | "initialPageParam"
	>
) {
	const limit = params.limit ?? 20;

	return useInfiniteQuery({
		queryKey: [...queryKeys.documents, "infinite", params] as const,
		queryFn: ({ pageParam }) =>
			fetchDocuments({ ...params, offset: pageParam as number, limit }),
		initialPageParam: 0,
		getNextPageParam: (lastPage: DocumentListResponse): number | undefined =>
			lastPage.hasMore ? lastPage.offset + lastPage.limit : undefined,
		...options,
	});
}

/**
 * Hook to fetch Yjs state for collaborative editing.
 *
 * @example
 * const { data: yjsState } = useDocumentYjsState(documentId);
 */
export function useDocumentYjsState(
	id: DocumentId | null | undefined,
	options?: Omit<
		UseQueryOptions<DocumentYjsState, Error>,
		"queryKey" | "queryFn" | "enabled"
	>
) {
	return useQuery({
		queryKey: queryKeys.documentYjsState(id ?? ""),
		queryFn: () => fetchDocumentYjsState(id!),
		enabled: Boolean(id),
		// Yjs state should be fetched fresh each time
		staleTime: 0,
		...options,
	});
}

/**
 * Hook to fetch document version history.
 *
 * @example
 * const { data: versions } = useDocumentVersions(documentId);
 */
export function useDocumentVersions(
	id: DocumentId | null | undefined,
	options?: Omit<
		UseQueryOptions<DocumentVersion[], Error>,
		"queryKey" | "queryFn" | "enabled"
	>
) {
	return useQuery({
		queryKey: queryKeys.documentVersions(id ?? ""),
		queryFn: () => fetchDocumentVersions(id!),
		enabled: Boolean(id),
		...options,
	});
}

/**
 * Hook to prefetch a document (for hover previews, etc).
 *
 * @example
 * const prefetchDocument = usePrefetchDocument();
 * onMouseEnter={() => prefetchDocument(documentId)}
 */
export function usePrefetchDocument() {
	const queryClient = useQueryClient();

	return (id: DocumentId) => {
		queryClient.prefetchQuery({
			queryKey: queryKeys.document(id),
			queryFn: () => fetchDocument(id),
			staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
		});
	};
}

/**
 * Hook to invalidate document queries (after mutations).
 *
 * @example
 * const invalidate = useInvalidateDocuments();
 * await updateDocument(id, data);
 * invalidate(id); // or invalidate() for all documents
 */
export function useInvalidateDocuments() {
	const queryClient = useQueryClient();

	return (id?: DocumentId) => {
		if (id) {
			// Invalidate specific document and list
			queryClient.invalidateQueries({ queryKey: queryKeys.document(id) });
			queryClient.invalidateQueries({
				queryKey: queryKeys.documentYjsState(id),
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.documentVersions(id),
			});
		}
		// Always invalidate the list to reflect changes
		queryClient.invalidateQueries({ queryKey: queryKeys.documents });
	};
}

/**
 * Hook to get cached document data synchronously.
 * Useful for optimistic updates.
 *
 * @example
 * const getDocument = useGetCachedDocument();
 * const doc = getDocument(documentId);
 */
export function useGetCachedDocument() {
	const queryClient = useQueryClient();

	return (id: DocumentId): Document | undefined => {
		return queryClient.getQueryData<Document>(queryKeys.document(id));
	};
}

/**
 * Hook to set cached document data.
 * Useful for optimistic updates.
 *
 * @example
 * const setDocument = useSetCachedDocument();
 * setDocument(documentId, updatedDoc);
 */
export function useSetCachedDocument() {
	const queryClient = useQueryClient();

	return (id: DocumentId, data: Document | ((prev: Document | undefined) => Document)) => {
		queryClient.setQueryData<Document>(queryKeys.document(id), data);
	};
}

/**
 * Type for the document list with all pages flattened.
 */
export interface FlattenedDocumentList {
	documents: DocumentSummary[];
	total: number;
}

/**
 * Flatten infinite query pages into a single list.
 */
export function flattenDocumentPages(
	pages: DocumentListResponse[] | undefined
): FlattenedDocumentList {
	if (!pages) return { documents: [], total: 0 };

	return {
		documents: pages.flatMap((page) => page.documents),
		total: pages[0]?.total ?? 0,
	};
}

/**
 * Hook to search documents with debounced input.
 * Combines with list params for filtering.
 *
 * @example
 * const { data, refetch } = useDocumentSearch(debouncedSearchTerm);
 */
export function useDocumentSearch(
	query: string,
	params: Omit<DocumentListParams, "search"> = {},
	options?: Omit<
		UseQueryOptions<DocumentListResponse, Error>,
		"queryKey" | "queryFn" | "enabled"
	>
) {
	return useQuery({
		queryKey: [...queryKeys.documents, "search", query, params] as const,
		queryFn: () => fetchDocuments({ ...params, search: query }),
		enabled: query.length >= 2, // Only search with 2+ characters
		...options,
	});
}
