/**
 * Document query hooks using TanStack Query with Server Actions.
 *
 * Provides data fetching, caching, and state management
 * for document operations using Next.js Server Actions.
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
	listDocuments,
	getDocument,
	createDocument,
	updateDocument,
	deleteDocument,
	getDocumentYjsState,
	saveDocumentYjsState,
	searchDocuments,
} from "@/app/actions/documents";
import type {
	Document,
	DocumentSummary,
	DocumentListParams,
	DocumentListResponse,
	DocumentYjsState,
	DocumentId,
	CreateDocumentInput,
	UpdateDocumentInput,
} from "@/lib/types/document";

/**
 * Hook to fetch a single document.
 *
 * @example
 * const { data: document, isLoading, error } = useDocument(documentId);
 */
export function useDocument(
	id: DocumentId | null | undefined,
	options?: Omit<
		UseQueryOptions<Document | null, Error>,
		"queryKey" | "queryFn" | "enabled"
	>
) {
	return useQuery({
		queryKey: queryKeys.document(id ?? ""),
		queryFn: () => getDocument(id!),
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
		queryFn: () => listDocuments(params),
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
			listDocuments({ ...params, offset: pageParam as number, limit }),
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
		UseQueryOptions<DocumentYjsState | null, Error>,
		"queryKey" | "queryFn" | "enabled"
	>
) {
	return useQuery({
		queryKey: queryKeys.documentYjsState(id ?? ""),
		queryFn: () => getDocumentYjsState(id!),
		enabled: Boolean(id),
		// Yjs state should be fetched fresh each time
		staleTime: 0,
		...options,
	});
}

/**
 * Hook to create a new document.
 *
 * @example
 * const { mutate: create, isPending } = useCreateDocument();
 * create({ title: "New Doc" });
 */
export function useCreateDocument() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: CreateDocumentInput) => createDocument(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.documents });
		},
	});
}

/**
 * Hook to update a document.
 *
 * @example
 * const { mutate: update } = useUpdateDocument();
 * update({ id: "...", data: { title: "Updated" } });
 */
export function useUpdateDocument() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateDocumentInput }) =>
			updateDocument(id, data),
		onSuccess: (result, { id }) => {
			if (result) {
				queryClient.setQueryData(queryKeys.document(id), result);
			}
			queryClient.invalidateQueries({ queryKey: queryKeys.documents });
		},
	});
}

/**
 * Hook to delete a document.
 *
 * @example
 * const { mutate: remove } = useDeleteDocument();
 * remove(documentId);
 */
export function useDeleteDocument() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => deleteDocument(id),
		onSuccess: (_, id) => {
			queryClient.removeQueries({ queryKey: queryKeys.document(id) });
			queryClient.invalidateQueries({ queryKey: queryKeys.documents });
		},
	});
}

/**
 * Hook to save Yjs state.
 *
 * @example
 * const { mutate: saveState } = useSaveDocumentYjsState();
 * saveState({ documentId, state, stateVector });
 */
export function useSaveDocumentYjsState() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			documentId,
			state,
			stateVector,
		}: {
			documentId: string;
			state: string;
			stateVector: string;
		}) => saveDocumentYjsState(documentId, state, stateVector),
		onSuccess: (_, { documentId }) => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.documentYjsState(documentId),
			});
		},
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
			queryFn: () => getDocument(id),
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
 *
 * @example
 * const { data } = useDocumentSearch(debouncedSearchTerm);
 */
export function useDocumentSearch(
	query: string,
	options?: Omit<
		UseQueryOptions<DocumentSummary[], Error>,
		"queryKey" | "queryFn" | "enabled"
	>
) {
	return useQuery({
		queryKey: [...queryKeys.documents, "search", query] as const,
		queryFn: () => searchDocuments(query),
		enabled: query.length >= 2, // Only search with 2+ characters
		...options,
	});
}
