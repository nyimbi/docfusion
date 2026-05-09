/**
 * Session test helper — lets integration tests swap the active session per call.
 *
 * Usage in a test file:
 *
 *   import { vi } from "vitest";
 *
 *   vi.mock("@/lib/auth-utils", async () => {
 *     const helper = await vi.importActual<typeof import("@/__tests__/helpers/session")>(
 *       "@/__tests__/helpers/session"
 *     );
 *     return {
 *       getServerSession: async () => helper.getCurrentMockSession(),
 *       requireServerSession: async () => {
 *         const s = helper.getCurrentMockSession();
 *         if (!s) throw new Error("Unauthorized");
 *         return s;
 *       },
 *     };
 *   });
 *
 *   import { withSession } from "@/__tests__/helpers/session";
 *
 *   await withSession({ userId: "u", organizationId: "o" }, async () => {
 *     // route handler invocation runs with the synthetic session
 *   });
 */

interface MockSession {
	user: {
		id: string;
		email?: string;
		organizationId?: string;
	};
}

export interface SessionOverride {
	userId: string;
	organizationId?: string;
	email?: string;
}

let _currentMockSession: MockSession | null = null;

/** Read the active synthetic session. The auth-utils mock calls this. */
export function getCurrentMockSession(): MockSession | null {
	return _currentMockSession;
}

/** Run `fn` with a synthetic session installed; restore the previous session on exit. */
export async function withSession<T>(
	session: SessionOverride,
	fn: () => Promise<T>,
): Promise<T> {
	const previous = _currentMockSession;
	_currentMockSession = {
		user: {
			id: session.userId,
			email: session.email ?? `${session.userId}@test.local`,
			organizationId: session.organizationId,
		},
	};
	try {
		return await fn();
	} finally {
		_currentMockSession = previous;
	}
}

/** Clear the current session (helper for `afterEach`). */
export function clearMockSession(): void {
	_currentMockSession = null;
}
