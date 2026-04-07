/**
 * Query key factory for consistent cache key management.
 *
 * All React Query cache keys should be created through this factory
 * to ensure consistent invalidation and prevent key collisions.
 *
 * Usage:
 *   useQuery({ queryKey: queryKeys.opportunities.list(filters), ... })
 *   queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all })
 */
export const queryKeys = {
	opportunities: {
		all: ["opportunities"] as const,
		list: (filters?: Record<string, unknown>) =>
			["opportunities", "list", filters] as const,
		detail: (id: string) => ["opportunities", "detail", id] as const,
		stats: (filters?: Record<string, unknown>) =>
			["opportunities", "stats", filters] as const,
		search: (query: string) =>
			["opportunities", "search", query] as const,
	},
	documents: {
		all: ["documents"] as const,
		list: (filters?: Record<string, unknown>) =>
			["documents", "list", filters] as const,
		detail: (id: string) => ["documents", "detail", id] as const,
		yjsState: (id: string) => ["documents", id, "yjs-state"] as const,
		versions: (id: string) => ["documents", id, "versions"] as const,
	},
	templates: {
		all: ["templates"] as const,
		list: (filters?: Record<string, unknown>) =>
			["templates", "list", filters] as const,
		detail: (id: string) => ["templates", "detail", id] as const,
		categories: ["templates", "categories"] as const,
	},
	pricing: {
		all: ["pricing"] as const,
		elements: (opportunityId: string) =>
			["pricing", "elements", opportunityId] as const,
		laborCategories: () => ["pricing", "laborCategories"] as const,
	},
	evidence: {
		all: ["evidence"] as const,
		list: (filters?: Record<string, unknown>) =>
			["evidence", "list", filters] as const,
		detail: (id: string) => ["evidence", "detail", id] as const,
	},
	competitive: {
		all: ["competitive"] as const,
		competitors: (filters?: Record<string, unknown>) =>
			["competitive", "competitors", filters] as const,
		discriminators: (filters?: Record<string, unknown>) =>
			["competitive", "discriminators", filters] as const,
	},
	crm: {
		accounts: {
			all: ["crm", "accounts"] as const,
			list: (filters?: Record<string, unknown>) =>
				["crm", "accounts", "list", filters] as const,
			detail: (id: string) =>
				["crm", "accounts", "detail", id] as const,
		},
		contacts: {
			all: ["crm", "contacts"] as const,
			list: (filters?: Record<string, unknown>) =>
				["crm", "contacts", "list", filters] as const,
			detail: (id: string) =>
				["crm", "contacts", "detail", id] as const,
		},
	},
	search: {
		all: ["search"] as const,
		query: (q: string) => ["search", q] as const,
	},
	ai: {
		completion: (requestId: string) =>
			["ai", "completion", requestId] as const,
	},
	user: {
		current: ["user", "current"] as const,
	},
} as const;
