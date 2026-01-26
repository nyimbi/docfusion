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
	useDocumentVersions,
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
	useTemplateWithCategories,
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
} from "./hooks/useTemplates";
