"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { workflowNotifications } from "@/lib/db/schema-workflow-runtime";
import { getWorkflowViewerScopeFromSession } from "@/lib/workflows/viewer-scope";

export async function getUnreadWorkflowNotificationSummary(): Promise<{
	hasNotifications: boolean;
	unreadCount: number;
}> {
	const scope = await getWorkflowViewerScopeFromSession();
	if (!scope) {
		return { hasNotifications: false, unreadCount: 0 };
	}

	const [result] = await db
		.select({ unreadCount: count() })
		.from(workflowNotifications)
		.where(and(
			eq(workflowNotifications.recipientId, scope.userId),
			isNull(workflowNotifications.acknowledgedAt)
		));

	const unreadCount = Number(result?.unreadCount ?? 0);
	return {
		hasNotifications: unreadCount > 0,
		unreadCount,
	};
}
