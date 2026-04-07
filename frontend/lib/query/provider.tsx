"use client";

import * as React from "react";
import {
	QueryClient,
	QueryClientProvider,
	QueryCache,
	MutationCache,
} from "@tanstack/react-query";
import { logger } from "@/lib/utils/logger";

/**
 * Default stale time for queries (5 minutes).
 * Data older than this will be refetched in the background.
 */
const DEFAULT_STALE_TIME = 5 * 60 * 1000;

/**
 * Default garbage collection time (30 minutes).
 * Inactive cache entries are removed after this time.
 */
const DEFAULT_GC_TIME = 30 * 60 * 1000;

/**
 * Create and configure the QueryClient with sensible defaults.
 */
function createQueryClient(): QueryClient {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error, query) => {
				// Log query errors in development
				if (process.env.NODE_ENV === "development") {
					logger.error(
						`[Query Error] ${query.queryKey.join("/")}:`,
						error
					);
				}
			},
		}),
		mutationCache: new MutationCache({
			onError: (error, _variables, _context, mutation) => {
				// Log mutation errors in development
				if (process.env.NODE_ENV === "development") {
					logger.error(
						`[Mutation Error] ${mutation.options.mutationKey?.join("/") ?? "unknown"}:`,
						error
					);
				}
			},
		}),
		defaultOptions: {
			queries: {
				// Data is fresh for 5 minutes
				staleTime: DEFAULT_STALE_TIME,
				// Keep unused data for 30 minutes
				gcTime: DEFAULT_GC_TIME,
				// Retry failed requests 3 times with exponential backoff
				retry: 3,
				retryDelay: (attemptIndex) =>
					Math.min(1000 * 2 ** attemptIndex, 30000),
				// Refetch on window focus (good for collaborative editing)
				refetchOnWindowFocus: true,
				// Don't refetch on mount if data is fresh
				refetchOnMount: true,
				// Refetch on reconnect (important for collaboration)
				refetchOnReconnect: true,
			},
			mutations: {
				// Retry mutations once on network error
				retry: 1,
			},
		},
	});
}

/**
 * Store the QueryClient in a ref to persist across re-renders
 * but allow it to be recreated on hot reload.
 */
let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
	if (typeof window === "undefined") {
		// Server: always create a new QueryClient
		return createQueryClient();
	}
	// Browser: reuse existing client or create new one
	if (!browserQueryClient) {
		browserQueryClient = createQueryClient();
	}
	return browserQueryClient;
}

/**
 * Query keys for consistent cache management.
 * Use these constants to ensure cache invalidation works correctly.
 */
export const queryKeys = {
	// Documents
	documents: ["documents"] as const,
	document: (id: string) => ["documents", id] as const,
	documentYjsState: (id: string) => ["documents", id, "yjs-state"] as const,
	documentVersions: (id: string) => ["documents", id, "versions"] as const,

	// Templates
	templates: ["templates"] as const,
	template: (id: string) => ["templates", id] as const,
	templateCategories: ["templates", "categories"] as const,

	// Search
	search: (query: string) => ["search", query] as const,

	// AI
	aiCompletion: (requestId: string) => ["ai", "completion", requestId] as const,

	// User
	currentUser: ["user", "current"] as const,
} as const;

/**
 * Props for the QueryProvider component.
 */
interface QueryProviderProps {
	children: React.ReactNode;
}

/**
 * TanStack Query provider component.
 * Wrap your app with this to enable data fetching.
 *
 * @example
 * // In app/layout.tsx
 * import { QueryProvider } from "@/lib/query/provider";
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <QueryProvider>{children}</QueryProvider>
 *       </body>
 *     </html>
 *   );
 * }
 */
export function QueryProvider({ children }: QueryProviderProps) {
	const queryClient = getQueryClient();

	return (
		<QueryClientProvider client={queryClient}>
			{children}
		</QueryClientProvider>
	);
}

/**
 * Hook to get the query client for imperative operations.
 * Use sparingly - prefer hooks for most operations.
 */
export { useQueryClient } from "@tanstack/react-query";

/**
 * Re-export common hooks for convenience.
 */
export {
	useQuery,
	useMutation,
	useInfiniteQuery,
	useQueries,
	useIsFetching,
	useIsMutating,
} from "@tanstack/react-query";
