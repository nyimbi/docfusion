/**
 * Document mutation hooks using TanStack Query.
 *
 * Provides optimistic updates, cache invalidation, and error handling
 * for document CRUD operations.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/client";
import { queryKeys } from "../provider";
import type {
	Document,
	DocumentId,
	CreateDocumentInput,
	UpdateDocumentInput,
	DocumentContent,
	DocumentSummary,
	DocumentListResponse,
} from "@/lib/types/document";

/**
 * Create a new document.
 */
async function createDocument(input: CreateDocumentInput): Promise<Document> {
	return fetcher<Document>("/documents", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
}

/**
 * Update an existing document.
 */
async function updateDocument(
	id: DocumentId,
	input: UpdateDocumentInput
): Promise<Document> {
	return fetcher<Document>(`/documents/${id}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
}

/**
 * Delete a document.
 */
async function deleteDocument(id: DocumentId): Promise<void> {
	return fetcher<void>(`/documents/${id}`, { method: "DELETE" });
}

/**
 * Save document content (partial update for autosave).
 */
async function saveDocumentContent(
	id: DocumentId,
	content: DocumentContent
): Promise<Document> {
	return fetcher<Document>(`/documents/${id}/content`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ content }),
	});
}

/**
 * Duplicate a document.
 */
async function duplicateDocument(id: DocumentId): Promise<Document> {
	return fetcher<Document>(`/documents/${id}/duplicate`, {
		method: "POST",
	});
}

/**
 * Archive a document (soft delete).
 */
async function archiveDocument(id: DocumentId): Promise<Document> {
	return fetcher<Document>(`/documents/${id}/archive`, {
		method: "POST",
	});
}

/**
 * Restore an archived document.
 */
async function restoreDocument(id: DocumentId): Promise<Document> {
	return fetcher<Document>(`/documents/${id}/restore`, {
		method: "POST",
	});
}

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
		mutationFn: (content: DocumentContent) => saveDocumentContent(id, content),
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
		mutationFn: duplicateDocument,
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
		mutationFn: archiveDocument,
		onSuccess: (document) => {
			queryClient.setQueryData(queryKeys.document(document.id), document);
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
		mutationFn: restoreDocument,
		onSuccess: (document) => {
			queryClient.setQueryData(queryKeys.document(document.id), document);
			queryClient.invalidateQueries({ queryKey: queryKeys.documents });
		},
	});
}

/**
 * Batch update multiple documents (for bulk operations).
 */
async function batchUpdateDocuments(
	updates: { id: DocumentId; input: UpdateDocumentInput }[]
): Promise<Document[]> {
	return fetcher<Document[]>("/documents/batch", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ updates }),
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
		mutationFn: batchUpdateDocuments,
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
