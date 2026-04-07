# Data Fetching Conventions

## Pattern

- **Server Actions** for mutations (create, update, delete)
- **React Query + Server Actions** for reads (list, get, search)
- **No direct `fetch()`** in components

## Query Key Factory

Use `frontend/lib/query/keys.ts` for consistent query key management.
The legacy `queryKeys` export in `provider.tsx` is maintained for backward compatibility;
new code should import from `keys.ts`.

## Example

```typescript
// In a server action (lib/actions/opportunities.ts):
export async function getOpportunities(filters) { ... }

// In a component:
import { queryKeys } from "@/lib/query/keys";

const { data } = useQuery({
  queryKey: queryKeys.opportunities.list(filters),
  queryFn: () => getOpportunities(filters),
});
```

## Rules

1. All reads go through React Query hooks
2. All mutations use server actions directly (with `useMutation` for optimistic updates)
3. Query keys follow the factory pattern: `domain.operation(params)`
4. Cache invalidation uses `queryClient.invalidateQueries({ queryKey: queryKeys.domain.all })`
5. Hooks live in `frontend/lib/query/hooks/` and mutations in `frontend/lib/query/mutations/`
6. Each domain gets its own hook file (e.g. `useDocuments.ts`, `useTemplates.ts`)
