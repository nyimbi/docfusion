/**
 * Helpers for testing Next.js server actions.
 *
 * Server actions commonly depend on Next.js runtime APIs (cache invalidation,
 * cookies, headers) that don't exist outside the framework. This module provides
 * standardized mocks for those APIs so server action tests run in plain Vitest.
 *
 * Import this file in test setup or at the top of server action test files.
 */
import { expect, vi } from "vitest";

// ============================================================================
// Next.js Cache Mocks
// ============================================================================

/**
 * Mock next/cache - used by server actions that call revalidatePath/revalidateTag
 * after mutations to bust the Next.js data cache.
 */
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
	unstable_cache: vi.fn((fn: Function) => fn),
	unstable_noStore: vi.fn(),
}));

// ============================================================================
// Next.js Headers Mocks
// ============================================================================

/**
 * Mock next/headers - used by server actions that read cookies or request headers.
 * Returns empty-but-functional stubs that tests can override per-case.
 */
vi.mock("next/headers", () => ({
	cookies: vi.fn(() => ({
		get: vi.fn((name: string) => undefined),
		getAll: vi.fn(() => []),
		set: vi.fn(),
		delete: vi.fn(),
		has: vi.fn(() => false),
	})),
	headers: vi.fn(() => new Map()),
}));

// ============================================================================
// Next.js Navigation Mocks
// ============================================================================

/**
 * Mock next/navigation - used by components/actions that call redirect()
 * or read route params.
 */
vi.mock("next/navigation", () => ({
	redirect: vi.fn((url: string) => {
		throw new Error(`NEXT_REDIRECT:${url}`);
	}),
	notFound: vi.fn(() => {
		throw new Error("NEXT_NOT_FOUND");
	}),
	useRouter: vi.fn(() => ({
		push: vi.fn(),
		replace: vi.fn(),
		back: vi.fn(),
		refresh: vi.fn(),
		prefetch: vi.fn(),
	})),
	usePathname: vi.fn(() => "/"),
	useSearchParams: vi.fn(() => new URLSearchParams()),
	useParams: vi.fn(() => ({})),
}));

// ============================================================================
// Server Action Test Utilities
// ============================================================================

/**
 * Assert that a server action called revalidatePath with the expected path.
 *
 * @example
 * ```ts
 * import { assertRevalidated } from "@/__tests__/utils/action-helpers";
 *
 * await createOpportunity(input);
 * assertRevalidated("/opportunities");
 * ```
 */
export async function assertRevalidated(expectedPath: string): Promise<void> {
	const { revalidatePath } = await import("next/cache");
	expect(revalidatePath).toHaveBeenCalledWith(expectedPath);
}

/**
 * Assert that a server action called revalidateTag with the expected tag.
 */
export async function assertTagRevalidated(expectedTag: string): Promise<void> {
	const { revalidateTag } = await import("next/cache");
	expect(revalidateTag).toHaveBeenCalledWith(expectedTag);
}

/**
 * Assert that a server action triggered a redirect.
 * Server actions that call redirect() throw a special error in the mock.
 *
 * @example
 * ```ts
 * await assertRedirects(
 *   () => deleteOpportunity("123"),
 *   "/opportunities"
 * );
 * ```
 */
export async function assertRedirects(
	action: () => Promise<unknown>,
	expectedUrl: string,
): Promise<void> {
	try {
		await action();
		throw new Error("Expected redirect but action completed normally");
	} catch (error) {
		if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT:")) {
			const redirectUrl = error.message.replace("NEXT_REDIRECT:", "");
			expect(redirectUrl).toBe(expectedUrl);
		} else {
			throw error;
		}
	}
}

/**
 * Assert that a server action triggered a notFound response.
 */
export async function assertNotFound(action: () => Promise<unknown>): Promise<void> {
	try {
		await action();
		throw new Error("Expected notFound but action completed normally");
	} catch (error) {
		if (error instanceof Error && error.message === "NEXT_NOT_FOUND") {
			return;
		}
		throw error;
	}
}

/**
 * Create a mock authenticated session context for server actions that
 * check auth before proceeding.
 *
 * @example
 * ```ts
 * const session = mockAuthSession({ userId: "user-1", role: "admin" });
 * // Now server actions that call auth() will get this session
 * ```
 */
export function mockAuthSession(overrides: {
	userId?: string;
	email?: string;
	name?: string;
	role?: string;
} = {}) {
	const session = {
		user: {
			id: overrides.userId ?? "test-user-id",
			email: overrides.email ?? "test@example.com",
			name: overrides.name ?? "Test User",
			role: overrides.role ?? "user",
		},
		expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
	};

	vi.mock("@/lib/auth", () => ({
		auth: vi.fn(() => Promise.resolve(session)),
		getSession: vi.fn(() => Promise.resolve(session)),
	}));

	return session;
}
