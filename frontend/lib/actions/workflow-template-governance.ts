"use server";

import { revalidatePath } from "next/cache";
import {
	deprecateWorkflowTemplate,
	publishWorkflowTemplate,
	rollbackWorkflowTemplate,
} from "@/lib/actions/workflow-runtime";
import { getWorkflowViewerScopeFromSession } from "@/lib/workflows/viewer-scope";

export async function publishWorkflowTemplateFromStudio(templateId: string) {
	const scope = await getAdminScope();
	if (!scope.success) return scope;
	const template = await publishWorkflowTemplate(templateId, scope.userId);
	revalidateWorkflowTemplatePages();
	return { success: true as const, template };
}

export async function deprecateWorkflowTemplateFromStudio(templateId: string) {
	const scope = await getAdminScope();
	if (!scope.success) return scope;
	const template = await deprecateWorkflowTemplate(templateId, scope.userId);
	revalidateWorkflowTemplatePages();
	return { success: true as const, template };
}

export async function rollbackWorkflowTemplateFromStudio(templateKey: string, targetVersion: number) {
	const scope = await getAdminScope();
	if (!scope.success) return scope;
	const template = await rollbackWorkflowTemplate({
		templateKey,
		targetVersion,
		actorId: scope.userId,
	});
	revalidateWorkflowTemplatePages();
	return { success: true as const, template };
}

async function getAdminScope(): Promise<
	| { success: true; userId: string }
	| { success: false; error: string }
> {
	const scope = await getWorkflowViewerScopeFromSession();
	if (!scope?.isGlobalWorkflowViewer) {
		return { success: false, error: "Workflow administrator permission is required" };
	}
	return { success: true, userId: scope.userId };
}

function revalidateWorkflowTemplatePages() {
	revalidatePath("/workflows");
	revalidatePath("/workflows/templates");
}
