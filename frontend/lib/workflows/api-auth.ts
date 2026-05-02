import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/authz";

export interface WorkflowApiActor {
	userId: string;
	role?: string;
	roles: string[];
	organizationId?: string;
	isSystem: boolean;
}

const ADMIN_ROLES = new Set(["admin", "workflow_admin", "operations", "proposal_manager"]);

export async function requireWorkflowApiActor(
	request: NextRequest,
	options: {
		permission?: "read" | "write" | "admin";
		resourceType?: string;
		resourceId?: string;
		allowScheduler?: boolean;
	} = {}
): Promise<WorkflowApiActor | NextResponse> {
	if (options.allowScheduler && hasValidSchedulerSecret(request)) {
		return {
			userId: "system",
			role: "system",
			roles: ["system", "workflow_scheduler"],
			isSystem: true,
		};
	}

	const session = await auth();
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const user = session.user as {
		id: string;
		role?: string;
		roles?: string[];
		organizationId?: string;
	};
	const roles = normalizeRoles(user.role, user.roles);
	const actor: WorkflowApiActor = {
		userId: user.id,
		role: user.role,
		roles,
		organizationId: user.organizationId,
		isSystem: false,
	};

	if (options.permission === "admin" && !hasAdminRole(actor)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	if (options.resourceType && options.resourceId && options.permission) {
		const spicedbAllowed = await checkPermission(
			options.resourceType,
			options.resourceId,
			options.permission,
			actor.userId
		);
		if (!spicedbAllowed && !hasAdminRole(actor)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
	}

	return actor;
}

export function isWorkflowApiResponse(value: WorkflowApiActor | NextResponse): value is NextResponse {
	return value instanceof NextResponse;
}

export function hasAdminRole(actor: WorkflowApiActor): boolean {
	return actor.roles.some((role) => ADMIN_ROLES.has(role));
}

function normalizeRoles(role?: string, roles?: string[]): string[] {
	return [...new Set([role, ...(roles ?? [])].filter((value): value is string => Boolean(value)))];
}

function hasValidSchedulerSecret(request: NextRequest): boolean {
	const configured = process.env.WORKFLOW_CRON_SECRET ?? process.env.CRON_SECRET;
	if (!configured) return false;
	const supplied = request.headers.get("x-cron-secret")
		?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
	return supplied === configured;
}
