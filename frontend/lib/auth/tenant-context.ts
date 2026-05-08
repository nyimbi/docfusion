import { getServerSession } from "@/lib/auth-utils";

export interface TenantContext {
	readonly userId: string;
	readonly organizationId: string;
}

/**
 * Resolve the current tenant context for a server component, server action, or route handler.
 *
 * Hard-fails with `Unauthorized` (no session / no user id) or `No organization context`
 * (session exists but `organizationId` is missing). The absence of an org is never
 * an acceptable default — callers that need to handle org-less users must enroll
 * them in a workspace first.
 */
export async function requireTenantContext(): Promise<TenantContext> {
	const session = await getServerSession();
	const userId = session?.user?.id;
	if (!userId) {
		throw new Error("Unauthorized");
	}
	const organizationId = (session.user as { organizationId?: string }).organizationId;
	if (!organizationId) {
		throw new Error("No organization context");
	}
	return { userId, organizationId };
}
