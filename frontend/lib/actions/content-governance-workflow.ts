"use server";

import { db } from "@/lib/db";
import { templateSnippets, snippetAnalytics } from "@/lib/db/schema";
import { requireUserContext, userHasAuthorityRole, type UserContext } from "@/lib/auth-utils";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";
import type { FreshnessStatus } from "@/lib/types/content-library";
import { and, eq, or, type SQL } from "drizzle-orm";

type TemplateSnippetRow = typeof templateSnippets.$inferSelect;
type SnippetAnalyticsRow = typeof snippetAnalytics.$inferSelect;

export type ContentGovernanceAction =
	| "mark_review_needed"
	| "mark_stale"
	| "approve_current"
	| "archive"
	| "reopen_review";

export interface ContentGovernanceInput {
	snippetId: string;
	action: ContentGovernanceAction;
	reason: string;
	reviewDueDate?: Date | string | null;
	qualityScore?: number | null;
	assignedTo?: string | null;
	evidenceLinks?: string[];
}

export interface ContentGovernanceResult {
	snippetId: string;
	fromState: FreshnessStatus;
	toState: FreshnessStatus;
	workflowInstanceId: string;
	taskProjected: boolean;
}

const WORKFLOW_KEY = "content_library_governance";
const SUBJECT_TYPE = "template_snippet";

function visibleSnippetCondition(
	snippetId: string,
	userContext: { userId: string; organizationId?: string }
): SQL {
	const accessCondition = userContext.organizationId
		? or(
			eq(templateSnippets.createdBy, userContext.userId),
			eq(templateSnippets.organizationId, userContext.organizationId)
		)!
		: eq(templateSnippets.createdBy, userContext.userId);
	return and(
		eq(templateSnippets.id, snippetId),
		accessCondition
	)!;
}

export async function transitionContentGovernanceWorkflow(
	input: ContentGovernanceInput
): Promise<ContentGovernanceResult> {
	const userContext = await requireUserContext();
	const reason = input.reason.trim();
	if (!reason) {
		throw new Error("Content governance transitions require a reason");
	}
	requireContentGovernanceAuthority(userContext, input.action);

	const [snippet] = await db
		.select()
		.from(templateSnippets)
		.where(visibleSnippetCondition(input.snippetId, userContext))
		.limit(1);
	if (!snippet) {
		throw new Error("Snippet not found");
	}
	enforceSnippetGovernanceAccess(snippet, userContext);

	const [analytics] = await db
		.select()
		.from(snippetAnalytics)
		.where(eq(snippetAnalytics.snippetId, input.snippetId))
		.limit(1);

	const fromState = normalizeFreshnessStatus(analytics?.freshnessStatus);
	const transition = buildGovernanceTransition(input, snippet);
	const updatedAnalytics = analytics
		? await updateAnalytics(input.snippetId, transition.patch)
		: await insertAnalytics(input.snippetId, transition.patch, snippet);

	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: WORKFLOW_KEY,
		subjectType: SUBJECT_TYPE,
		subjectId: input.snippetId,
		fromState,
		toState: transition.toState,
		eventType: `content_${input.action}`,
		actorId: userContext.userId,
		reason,
		evidenceLinks: input.evidenceLinks ?? [],
		priority: transition.priority,
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : "content_governor",
		dueAt: transition.terminal ? null : transition.dueAt,
		metadata: {
			snippetId: input.snippetId,
			snippetName: snippet.name,
			shortcut: snippet.shortcut,
			category: snippet.category ?? null,
			contentType: updatedAnalytics.contentType ?? null,
			qualityScore: updatedAnalytics.qualityScore ?? null,
			freshnessStatus: updatedAnalytics.freshnessStatus,
			action: input.action,
		},
		terminal: transition.terminal,
		actionUrl: "/content-library",
	});

	let taskProjected = false;
	if (transition.runtimeTaskState) {
		await upsertWorkflowRuntimeTask({
			workflowInstanceId: instance.id,
			taskKey: `content-governance:${input.snippetId}`,
			title: transition.taskTitle,
			description: taskDescription(snippet, transition.toState, reason),
			state: transition.runtimeTaskState,
			priority: transition.priority,
			assignedTo: input.assignedTo ?? null,
			assignedRole: transition.terminal ? null : "content_governor",
			dueAt: transition.terminal ? null : transition.dueAt,
			metadata: {
				snippetId: input.snippetId,
				shortcut: snippet.shortcut,
				fromState,
				toState: transition.toState,
				reviewDueDate: transition.dueAt?.toISOString() ?? null,
			},
		});
		taskProjected = true;
	}

	return {
		snippetId: input.snippetId,
		fromState,
		toState: transition.toState,
		workflowInstanceId: instance.id,
		taskProjected,
	};
}

function buildGovernanceTransition(
	input: ContentGovernanceInput,
	snippet: TemplateSnippetRow
): {
	toState: FreshnessStatus;
	terminal: boolean;
	priority: "critical" | "high" | "medium" | "low";
	runtimeTaskState?: "open" | "in_progress" | "completed" | "cancelled";
	taskTitle: string;
	dueAt: Date | null;
	patch: Partial<typeof snippetAnalytics.$inferInsert>;
} {
	const now = new Date();
	const dueAt = normalizeDueAt(input.reviewDueDate, input.action);
	const qualityScore = normalizeQualityScore(input.qualityScore);
	const basePatch = {
		updatedAt: now,
		wordCount: wordCountForSnippet(snippet),
		...(qualityScore === undefined ? {} : { qualityScore }),
	};

	switch (input.action) {
		case "mark_review_needed":
			return {
				toState: "review_needed",
				terminal: false,
				priority: "medium",
				runtimeTaskState: "open",
				taskTitle: "Review reusable content",
				dueAt,
				patch: {
					...basePatch,
					freshnessStatus: "review_needed",
					reviewDueDate: dueAt,
				},
			};
		case "mark_stale":
			return {
				toState: "stale",
				terminal: false,
				priority: "high",
				runtimeTaskState: "open",
				taskTitle: "Refresh stale reusable content",
				dueAt,
				patch: {
					...basePatch,
					freshnessStatus: "stale",
					reviewDueDate: dueAt,
				},
			};
		case "approve_current":
			return {
				toState: "current",
				terminal: true,
				priority: "low",
				runtimeTaskState: "completed",
				taskTitle: "Reusable content review completed",
				dueAt: null,
				patch: {
					...basePatch,
					freshnessStatus: "current",
					reviewDueDate: null,
					lastReviewedAt: now,
				},
			};
		case "archive":
			return {
				toState: "archived",
				terminal: true,
				priority: "low",
				runtimeTaskState: "cancelled",
				taskTitle: "Reusable content archived",
				dueAt: null,
				patch: {
					...basePatch,
					freshnessStatus: "archived",
					reviewDueDate: null,
				},
			};
		case "reopen_review":
			return {
				toState: "review_needed",
				terminal: false,
				priority: "medium",
				runtimeTaskState: "in_progress",
				taskTitle: "Reopened reusable content review",
				dueAt,
				patch: {
					...basePatch,
					freshnessStatus: "review_needed",
					reviewDueDate: dueAt,
				},
			};
	}
}

function requireContentGovernanceAuthority(
	userContext: Pick<UserContext, "role" | "roles">,
	action: ContentGovernanceAction
): void {
	if (action !== "approve_current" && action !== "archive") {
		return;
	}
	const requiredRoles = ["content_governor", "proposal_manager"];
	if (requiredRoles.some((role) => userHasAuthorityRole(userContext, role))) {
		return;
	}
	throw new Error(
		`Approving or archiving reusable content requires content governance authority: requires ${requiredRoles.join(" or ")}`
	);
}

async function updateAnalytics(
	snippetId: string,
	patch: Partial<typeof snippetAnalytics.$inferInsert>
): Promise<SnippetAnalyticsRow> {
	const [updated] = await db
		.update(snippetAnalytics)
		.set(patch)
		.where(eq(snippetAnalytics.snippetId, snippetId))
		.returning();
	if (!updated) {
		throw new Error("Failed to update snippet governance state");
	}
	return updated;
}

async function insertAnalytics(
	snippetId: string,
	patch: Partial<typeof snippetAnalytics.$inferInsert>,
	snippet: TemplateSnippetRow
): Promise<SnippetAnalyticsRow> {
	const [inserted] = await db
		.insert(snippetAnalytics)
		.values({
			snippetId,
			wordCount: wordCountForSnippet(snippet),
			...patch,
		})
		.returning();
	if (!inserted) {
		throw new Error("Failed to create snippet governance state");
	}
	return inserted;
}

function enforceSnippetGovernanceAccess(
	snippet: TemplateSnippetRow,
	userContext: { userId: string; organizationId?: string }
) {
	const ownsSnippet = snippet.createdBy === userContext.userId;
	const sameOrganization = Boolean(
		snippet.organizationId
		&& userContext.organizationId
		&& snippet.organizationId === userContext.organizationId
	);
	if (!ownsSnippet && !sameOrganization) {
		throw new Error("Unauthorized to govern this snippet");
	}
}

function normalizeFreshnessStatus(value: unknown): FreshnessStatus {
	return value === "review_needed" || value === "stale" || value === "archived"
		? value
		: "current";
}

function normalizeDueAt(value: Date | string | null | undefined, action: ContentGovernanceAction): Date | null {
	if (value) {
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) {
			throw new Error("Review due date is invalid");
		}
		return parsed;
	}
	if (action === "mark_review_needed" || action === "reopen_review") {
		return daysFromNow(7);
	}
	if (action === "mark_stale") {
		return daysFromNow(3);
	}
	return null;
}

function normalizeQualityScore(value: number | null | undefined): number | undefined {
	if (value === null || value === undefined) return undefined;
	if (!Number.isFinite(value) || value < 0 || value > 100) {
		throw new Error("Quality score must be between 0 and 100");
	}
	return value;
}

function daysFromNow(days: number): Date {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + days);
	return date;
}

function taskDescription(snippet: TemplateSnippetRow, status: FreshnessStatus, reason: string): string {
	return [
		`Snippet ${snippet.shortcut} is ${status}.`,
		snippet.description ? `Description: ${snippet.description}` : null,
		`Reason: ${reason}`,
	].filter(Boolean).join("\n");
}

function wordCountForSnippet(snippet: TemplateSnippetRow): number {
	return extractText(snippet.content).trim().split(/\s+/).filter(Boolean).length;
}

function extractText(value: unknown): string {
	if (typeof value === "string") return value;
	if (!value || typeof value !== "object") return "";
	if (Array.isArray(value)) return value.map(extractText).join(" ");
	const record = value as Record<string, unknown>;
	return [
		typeof record.text === "string" ? record.text : "",
		extractText(record.content),
	].filter(Boolean).join(" ");
}
