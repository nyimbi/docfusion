import { auth } from "@/lib/auth";
import type { WorkflowApiActor } from "@/lib/workflows/api-auth";

const GLOBAL_WORKFLOW_VIEWER_ROLES = new Set(["admin", "workflow_admin", "operations"]);
const PORTAL_ROLE_NAMES = new Set(["partner", "contributor", "reviewer", "external", "customer"]);

export interface WorkflowViewerScope {
	userId: string;
	organizationId?: string;
	roles: string[];
	portalRoles: string[];
	isGlobalWorkflowViewer: boolean;
}

export function buildWorkflowViewerScope(actor: WorkflowApiActor): WorkflowViewerScope {
	const roles = normalizeRoles(actor.role, actor.roles);
	return {
		userId: actor.userId,
		organizationId: actor.organizationId,
		roles,
		portalRoles: roles.filter((role) => PORTAL_ROLE_NAMES.has(role)),
		isGlobalWorkflowViewer: isGlobalWorkflowViewer(roles),
	};
}

export async function getWorkflowViewerScopeFromSession(): Promise<WorkflowViewerScope | null> {
	const session = await auth();
	if (!session?.user?.id) return null;
	const user = session.user as {
		id: string;
		organizationId?: string;
		role?: string;
		roles?: string[];
	};
	const roles = normalizeRoles(user.role, user.roles);
	return {
		userId: user.id,
		organizationId: user.organizationId,
		roles,
		portalRoles: roles.filter((role) => PORTAL_ROLE_NAMES.has(role)),
		isGlobalWorkflowViewer: isGlobalWorkflowViewer(roles),
	};
}

export function isGlobalWorkflowViewer(roles: string[]): boolean {
	return roles.some((role) => GLOBAL_WORKFLOW_VIEWER_ROLES.has(role));
}

function normalizeRoles(role?: string, roles?: string[]): string[] {
	return [...new Set([role, ...(roles ?? [])].filter((value): value is string => Boolean(value)))];
}
