"use server";

import { getOperationalInboxProjection } from "@/lib/actions/work-items";
import { buildRoleHomepageProjection, type RoleHomepageProjection } from "@/lib/work-items/role-homepage";
import { getWorkflowViewerScopeFromSession } from "@/lib/workflows/viewer-scope";

export async function getRoleHomepageProjection(): Promise<RoleHomepageProjection> {
	const scope = await getWorkflowViewerScopeFromSession();
	if (!scope) {
		throw new Error("Authentication is required to load role homepage");
	}

	const inbox = await getOperationalInboxProjection({ limit: 160 });
	return buildRoleHomepageProjection(scope.roles, inbox.items);
}
