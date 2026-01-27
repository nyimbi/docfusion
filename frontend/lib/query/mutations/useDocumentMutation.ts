/**
 * Document mutation hooks using TanStack Query with Server Actions.
 *
 * Provides optimistic updates, cache invalidation, and error handling
 * for document CRUD operations using Next.js Server Actions.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../provider";
import {
	createDocument,
	updateDocument,
	deleteDocument,
} from "@/app/actions/documents";
import type {
	Document,
	DocumentId,
	CreateDocumentInput,
	UpdateDocumentInput,
	DocumentContent,
	DocumentListResponse,
} from "@/lib/types/document";

/**
 * Hook for creating a new document.
 *
 * @example
 * const createMutation = useCreateDocument();
 * const document = await createMutation.mutateAsync({ title: "New Doc" });
 */
export function useCreateDocument() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: createDocument,
		onSuccess: (newDocument) => {
			// Invalidate list queries to include new document
			queryClient.invalidateQueries({ queryKey: queryKeys.documents });

			// Pre-populate the cache for the new document
			queryClient.setQueryData(queryKeys.document(newDocument.id), newDocument);
		},
	});
}

/**
 * Hook for updating a document.
 *
 * Supports optimistic updates for better UX.
 *
 * @example
 * const updateMutation = useUpdateDocument(documentId);
 * await updateMutation.mutateAsync({ title: "Updated Title" });
 */
export function useUpdateDocument(id: DocumentId) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: UpdateDocumentInput) => updateDocument(id, input),
		onMutate: async (input) => {
			// Cancel in-flight queries
			await queryClient.cancelQueries({ queryKey: queryKeys.document(id) });

			// Snapshot previous value
			const previousDocument = queryClient.getQueryData<Document>(
				queryKeys.document(id)
			);

			// Optimistically update
			if (previousDocument) {
				queryClient.setQueryData<Document>(queryKeys.document(id), {
					...previousDocument,
					...input,
					updatedAt: new Date().toISOString(),
				});
			}

			return { previousDocument };
		},
		onError: (_err, _input, context) => {
			// Roll back on error
			if (context?.previousDocument) {
				queryClient.setQueryData(
					queryKeys.document(id),
					context.previousDocument
				);
			}
		},
		onSettled: () => {
			// Refetch to ensure consistency
			queryClient.invalidateQueries({ queryKey: queryKeys.document(id) });
			queryClient.invalidateQueries({ queryKey: queryKeys.documents });
		},
	});
}

/**
 * Hook for deleting a document.
 *
 * @example
 * const deleteMutation = useDeleteDocument();
 * await deleteMutation.mutateAsync(documentId);
 */
export function useDeleteDocument() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: deleteDocument,
		onMutate: async (id) => {
			// Cancel queries
			await queryClient.cancelQueries({ queryKey: queryKeys.documents });

			// Snapshot previous list
			const previousDocuments = queryClient.getQueriesData<DocumentListResponse>({
				queryKey: queryKeys.documents,
			});

			// Optimistically remove from lists
			queryClient.setQueriesData<DocumentListResponse>(
				{ queryKey: queryKeys.documents },
				(old) => {
					if (!old) return old;
					return {
						...old,
						documents: old.documents.filter((doc) => doc.id !== id),
						total: old.total - 1,
					};
				}
			);

			// Remove individual cache
			queryClient.removeQueries({ queryKey: queryKeys.document(id) });

			return { previousDocuments };
		},
		onError: (_err, _id, context) => {
			// Roll back on error
			context?.previousDocuments.forEach(([queryKey, data]) => {
				queryClient.setQueryData(queryKey, data);
			});
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.documents });
		},
	});
}

/**
 * Hook for saving document content (used by autosave).
 *
 * This is a lightweight mutation that only updates content,
 * with optimistic updates for instant feedback.
 *
 * @example
 * const saveMutation = useSaveDocumentContent(documentId);
 * await saveMutation.mutateAsync(editorContent);
 */
export function useSaveDocumentContent(id: DocumentId) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (content: DocumentContent) =>
			updateDocument(id, { content }),
		onMutate: async (content) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.document(id) });

			const previousDocument = queryClient.getQueryData<Document>(
				queryKeys.document(id)
			);

			if (previousDocument) {
				queryClient.setQueryData<Document>(queryKeys.document(id), {
					...previousDocument,
					content,
					updatedAt: new Date().toISOString(),
				});
			}

			return { previousDocument };
		},
		onError: (_err, _content, context) => {
			if (context?.previousDocument) {
				queryClient.setQueryData(
					queryKeys.document(id),
					context.previousDocument
				);
			}
		},
		// Don't invalidate on settle - content updates are frequent
		// and we don't want to refetch constantly
	});
}

/**
 * Hook for duplicating a document.
 *
 * @example
 * const duplicateMutation = useDuplicateDocument();
 * const newDoc = await duplicateMutation.mutateAsync(sourceDocId);
 */
export function useDuplicateDocument() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (sourceId: DocumentId) => {
			// Get the source document
			const source = queryClient.getQueryData<Document>(
				queryKeys.document(sourceId)
			);
			if (!source) {
				throw new Error("Source document not found");
			}
			// Create a copy
			return createDocument({
				title: `${source.title} (Copy)`,
				content: source.content,
				visibility: source.visibility,
				tags: source.tags,
				metadata: source.metadata,
			});
		},
		onSuccess: (newDocument) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.documents });
			queryClient.setQueryData(queryKeys.document(newDocument.id), newDocument);
		},
	});
}

/**
 * Hook for archiving a document.
 *
 * @example
 * const archiveMutation = useArchiveDocument();
 * await archiveMutation.mutateAsync(documentId);
 */
export function useArchiveDocument() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: DocumentId) => updateDocument(id, { status: "archived" }),
		onSuccess: (document) => {
			if (document) {
				queryClient.setQueryData(queryKeys.document(document.id), document);
			}
			queryClient.invalidateQueries({ queryKey: queryKeys.documents });
		},
	});
}

/**
 * Hook for restoring an archived document.
 *
 * @example
 * const restoreMutation = useRestoreDocument();
 * await restoreMutation.mutateAsync(documentId);
 */
export function useRestoreDocument() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: DocumentId) => updateDocument(id, { status: "draft" }),
		onSuccess: (document) => {
			if (document) {
				queryClient.setQueryData(queryKeys.document(document.id), document);
			}
			queryClient.invalidateQueries({ queryKey: queryKeys.documents });
		},
	});
}

/**
 * Hook for batch updating documents.
 *
 * @example
 * const batchMutation = useBatchUpdateDocuments();
 * await batchMutation.mutateAsync([
 *   { id: "doc1", input: { status: "archived" } },
 *   { id: "doc2", input: { status: "archived" } },
 * ]);
 */
export function useBatchUpdateDocuments() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (updates: { id: DocumentId; input: UpdateDocumentInput }[]) => {
			// Execute all updates in parallel
			const results = await Promise.all(
				updates.map(({ id, input }) => updateDocument(id, input))
			);
			return results.filter((doc): doc is Document => doc !== null);
		},
		onSuccess: (documents) => {
			// Update individual caches
			documents.forEach((doc) => {
				queryClient.setQueryData(queryKeys.document(doc.id), doc);
			});
			// Invalidate lists
			queryClient.invalidateQueries({ queryKey: queryKeys.documents });
		},
	});
}

/**
 * Hook to get mutation status for a specific document.
 * Useful for showing loading states in UI.
 */
export function useDocumentMutationState(id: DocumentId) {
	const queryClient = useQueryClient();

	return {
		isMutating: queryClient.isMutating({
			mutationKey: ["document", id],
		}) > 0,
	};
}
