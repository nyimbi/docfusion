// Query key factory (preferred import for new code)
export { queryKeys as domainQueryKeys } from "./keys";

// Provider and core exports
export {
	QueryProvider,
	queryKeys,
	useQueryClient,
	useQuery,
	useMutation,
	useInfiniteQuery,
	useQueries,
	useIsFetching,
	useIsMutating,
} from "./provider";

// Document hooks
export {
	useDocument,
	useDocuments,
	useInfiniteDocuments,
	useDocumentYjsState,
	usePrefetchDocument,
	useInvalidateDocuments,
	useGetCachedDocument,
	useSetCachedDocument,
	flattenDocumentPages,
	type FlattenedDocumentList,
} from "./hooks/useDocuments";

// Template hooks
export {
	useTemplate,
	useTemplates,
	useInfiniteTemplates,
	useTemplateCategories,
	useTemplatesByCategory,
	usePrefetchTemplate,
	useInvalidateTemplates,
	useGetCachedTemplate,
	useTemplateSearch,
	flattenTemplatePages,
	buildCategoryTree,
	type FlattenedTemplateList,
	type CategoryTreeNode,
} from "./hooks/useTemplates";

// Template category hooks
export {
	templateCategoryKeys,
	useTemplateCategory,
	useCreateCategoryMutation,
	useUpdateCategoryMutation,
	useDeleteCategoryMutation,
	useCategoryName,
} from "./hooks/useTemplateCategories";

// Search hooks
export {
	searchKeys,
	useGlobalSearch,
	useInfiniteSearch,
	useSearchSuggestions,
	useDocumentSearch,
	searchResultsToDocuments,
	searchResultsToTemplates,
	type SearchResult,
	type SearchResultType,
	type GlobalSearchResponse,
	type SearchParams,
	type SearchSuggestionsResponse,
} from "./hooks/useSearch";

// Document mutations
export {
	useCreateDocument,
	useUpdateDocument,
	useDeleteDocument,
	useSaveDocumentContent,
	useDuplicateDocument,
	useArchiveDocument,
	useRestoreDocument,
	useBatchUpdateDocuments,
	useDocumentMutationState,
} from "./mutations/useDocumentMutation";

// Template mutations
export {
	useCreateTemplate,
	useUpdateTemplate,
	useDeleteTemplate,
	useCreateFromTemplate,
} from "./hooks/useTemplates";

// AI mutations
export {
	useAICompletion,
	useStreamingAICompletion,
	useSlashCommand,
	useAIFeedback,
	useComplianceCheck,
	useWritingSuggestions,
	useCancelAIOperation,
	useApplyAISuggestion,
	useRejectAISuggestion,
	aiQueryKeys,
} from "./mutations/useAIMutation";
