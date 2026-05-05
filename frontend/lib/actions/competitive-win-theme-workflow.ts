"use server";

import { db } from "@/lib/db";
import { competitiveAnalyses } from "@/lib/db/schema-competitors";
import {
	themeAnalysisResults,
	themeInjectionPoints,
	winThemes,
} from "@/lib/db/schema-win-themes";
import { requireUserContext } from "@/lib/auth-utils";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";
import { eq } from "drizzle-orm";

type CompetitiveAnalysisRow = typeof competitiveAnalyses.$inferSelect;
type ThemeAnalysisRow = typeof themeAnalysisResults.$inferSelect;
type ThemeInjectionRow = typeof themeInjectionPoints.$inferSelect;
type WinThemeRow = typeof winThemes.$inferSelect;

export type CompetitiveIntelAction =
	| "start_review"
	| "mark_stale"
	| "approve_current"
	| "reopen_review";

export type WinThemeLifecycleAction =
	| "activate"
	| "approve"
	| "archive"
	| "reopen_review";

export type ThemeInjectionAction =
	| "accept"
	| "modify"
	| "reject"
	| "reopen";

export type ThemeConsistencyAction =
	| "flag_gaps"
	| "approve_consistency"
	| "reopen_review";

export interface CompetitiveIntelWorkflowInput {
	analysisId: string;
	action: CompetitiveIntelAction;
	reason: string;
	assignedTo?: string | null;
	dueAt?: Date | string | null;
}

export interface WinThemeLifecycleWorkflowInput {
	themeId: string;
	action: WinThemeLifecycleAction;
	reason: string;
	assignedTo?: string | null;
	dueAt?: Date | string | null;
}

export interface ThemeInjectionWorkflowInput {
	injectionId: string;
	action: ThemeInjectionAction;
	reason: string;
	modifiedText?: string | null;
	assignedTo?: string | null;
	dueAt?: Date | string | null;
}

export interface ThemeConsistencyWorkflowInput {
	analysisId: string;
	action: ThemeConsistencyAction;
	reason: string;
	assignedTo?: string | null;
	dueAt?: Date | string | null;
}

export interface StrategyWorkflowResult {
	subjectId: string;
	opportunityId: string | null;
	fromState: string;
	toState: string;
	workflowInstanceId: string;
	taskProjected: boolean;
}

const COMPETITIVE_WORKFLOW_KEY = "competitive_intelligence_governance";
const COMPETITIVE_SUBJECT_TYPE = "competitive_analysis";
const THEME_WORKFLOW_KEY = "win_theme_lifecycle";
const THEME_SUBJECT_TYPE = "win_theme";
const INJECTION_WORKFLOW_KEY = "win_theme_injection";
const INJECTION_SUBJECT_TYPE = "theme_injection_point";
const CONSISTENCY_WORKFLOW_KEY = "win_theme_consistency";
const CONSISTENCY_SUBJECT_TYPE = "theme_analysis_result";

export async function transitionCompetitiveIntelWorkflow(
	input: CompetitiveIntelWorkflowInput
): Promise<StrategyWorkflowResult> {
	const userContext = await requireUserContext();
	const reason = requireReason(input.reason, "Competitive intelligence transitions require a reason");
	const [analysis] = await db
		.select()
		.from(competitiveAnalyses)
		.where(eq(competitiveAnalyses.id, input.analysisId))
		.limit(1);
	if (!analysis) {
		throw new Error("Competitive analysis not found");
	}

	const fromState = competitiveState(analysis);
	const transition = buildCompetitiveTransition(input, userContext.userId);
	const [updated] = await db
		.update(competitiveAnalyses)
		.set(transition.patch)
		.where(eq(competitiveAnalyses.id, input.analysisId))
		.returning();
	if (!updated) {
		throw new Error("Failed to update competitive intelligence state");
	}

	return recordStrategyRuntime({
		workflowKey: COMPETITIVE_WORKFLOW_KEY,
		subjectType: COMPETITIVE_SUBJECT_TYPE,
		subjectId: input.analysisId,
		opportunityId: updated.opportunityId ?? null,
		fromState,
		toState: transition.toState,
		eventType: `competitive_${input.action}`,
		actorId: userContext.userId,
		reason,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : "competitive_intel_lead",
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 4),
		terminal: transition.terminal,
		taskKey: `competitive-intel:${input.analysisId}`,
		taskTitle: transition.taskTitle,
		taskDescription: `${transition.taskTitle}. Reason: ${reason}`,
		taskState: transition.taskState,
		metadata: {
			analysisId: input.analysisId,
			opportunityId: updated.opportunityId ?? null,
			isOutdated: updated.isOutdated ?? false,
			ourPosition: updated.ourPosition ?? null,
			competitiveGapCount: (updated.competitiveGaps ?? []).length,
			action: input.action,
		},
		actionUrl: `/opportunities/${updated.opportunityId}`,
	});
}

export async function transitionWinThemeLifecycleWorkflow(
	input: WinThemeLifecycleWorkflowInput
): Promise<StrategyWorkflowResult> {
	const userContext = await requireUserContext();
	const reason = requireReason(input.reason, "Win theme lifecycle transitions require a reason");
	const [theme] = await db
		.select()
		.from(winThemes)
		.where(eq(winThemes.id, input.themeId))
		.limit(1);
	if (!theme) {
		throw new Error("Win theme not found");
	}

	const fromState = themeState(theme);
	const transition = buildThemeTransition(input);
	const [updated] = await db
		.update(winThemes)
		.set(transition.patch)
		.where(eq(winThemes.id, input.themeId))
		.returning();
	if (!updated) {
		throw new Error("Failed to update win theme state");
	}

	return recordStrategyRuntime({
		workflowKey: THEME_WORKFLOW_KEY,
		subjectType: THEME_SUBJECT_TYPE,
		subjectId: input.themeId,
		opportunityId: updated.opportunityId ?? null,
		fromState,
		toState: transition.toState,
		eventType: `win_theme_${input.action}`,
		actorId: userContext.userId,
		reason,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : "proposal_strategist",
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 3),
		terminal: transition.terminal,
		taskKey: `win-theme:${input.themeId}`,
		taskTitle: transition.taskTitle,
		taskDescription: `${transition.taskTitle}. Reason: ${reason}`,
		taskState: transition.taskState,
		metadata: {
			themeId: input.themeId,
			opportunityId: updated.opportunityId,
			shortVersion: updated.shortVersion ?? null,
			themeType: updated.themeType ?? null,
			isActive: updated.isActive ?? false,
			targetSections: updated.targetSections ?? [],
			action: input.action,
		},
		actionUrl: `/opportunities/${updated.opportunityId}`,
	});
}

export async function transitionThemeInjectionWorkflow(
	input: ThemeInjectionWorkflowInput
): Promise<StrategyWorkflowResult> {
	const userContext = await requireUserContext();
	const reason = requireReason(input.reason, "Win theme injection transitions require a reason");
	const [injection] = await db
		.select()
		.from(themeInjectionPoints)
		.where(eq(themeInjectionPoints.id, input.injectionId))
		.limit(1);
	if (!injection) {
		throw new Error("Theme injection point not found");
	}

	const [theme] = await db
		.select()
		.from(winThemes)
		.where(eq(winThemes.id, injection.themeId))
		.limit(1);
	if (!theme) {
		throw new Error("Win theme not found for injection");
	}

	const fromState = injection.status ?? "pending";
	const transition = buildInjectionTransition(input, userContext.userId);
	const [updated] = await db
		.update(themeInjectionPoints)
		.set(transition.patch)
		.where(eq(themeInjectionPoints.id, input.injectionId))
		.returning();
	if (!updated) {
		throw new Error("Failed to update theme injection state");
	}

	return recordStrategyRuntime({
		workflowKey: INJECTION_WORKFLOW_KEY,
		subjectType: INJECTION_SUBJECT_TYPE,
		subjectId: input.injectionId,
		opportunityId: theme.opportunityId ?? null,
		fromState,
		toState: transition.toState,
		eventType: `theme_injection_${input.action}`,
		actorId: userContext.userId,
		reason,
		priority: priorityForInjection(updated),
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : "proposal_writer",
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 2),
		terminal: transition.terminal,
		taskKey: `theme-injection:${input.injectionId}`,
		taskTitle: transition.taskTitle,
		taskDescription: `${transition.taskTitle}. Reason: ${reason}`,
		taskState: transition.taskState,
		metadata: {
			injectionId: input.injectionId,
			themeId: theme.id,
			documentId: updated.documentId,
			sectionId: updated.sectionId ?? null,
			status: updated.status ?? "pending",
			injectionType: updated.injectionType ?? null,
			impactScore: updated.impactScore ?? null,
			action: input.action,
		},
		actionUrl: `/documents/${updated.documentId}`,
	});
}

export async function transitionThemeConsistencyWorkflow(
	input: ThemeConsistencyWorkflowInput
): Promise<StrategyWorkflowResult> {
	const userContext = await requireUserContext();
	const reason = requireReason(input.reason, "Win theme consistency transitions require a reason");
	const [analysis] = await db
		.select()
		.from(themeAnalysisResults)
		.where(eq(themeAnalysisResults.id, input.analysisId))
		.limit(1);
	if (!analysis) {
		throw new Error("Theme analysis result not found");
	}

	const fromState = consistencyState(analysis);
	const transition = buildConsistencyTransition(input, analysis);
	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: CONSISTENCY_WORKFLOW_KEY,
		subjectType: CONSISTENCY_SUBJECT_TYPE,
		subjectId: input.analysisId,
		opportunityId: analysis.opportunityId ?? null,
		fromState,
		toState: transition.toState,
		eventType: `theme_consistency_${input.action}`,
		actorId: userContext.userId,
		reason,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : "proposal_strategist",
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 2),
		metadata: {
			analysisId: input.analysisId,
			opportunityId: analysis.opportunityId,
			criticalGapCount: analysis.criticalGapCount ?? 0,
			majorGapCount: analysis.majorGapCount ?? 0,
			minorGapCount: analysis.minorGapCount ?? 0,
			consistencyScore: analysis.consistencyScore ?? null,
			recommendationCount: (analysis.recommendations ?? []).length,
			action: input.action,
		},
		terminal: transition.terminal,
		actionUrl: `/opportunities/${analysis.opportunityId}`,
	});

	await upsertWorkflowRuntimeTask({
		workflowInstanceId: instance.id,
		taskKey: `theme-consistency:${input.analysisId}`,
		title: transition.taskTitle,
		description: `${transition.taskTitle}. Reason: ${reason}`,
		state: transition.taskState,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : "proposal_strategist",
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 2),
		metadata: {
			analysisId: input.analysisId,
			fromState,
			toState: transition.toState,
		},
	});

	return {
		subjectId: input.analysisId,
		opportunityId: analysis.opportunityId ?? null,
		fromState,
		toState: transition.toState,
		workflowInstanceId: instance.id,
		taskProjected: true,
	};
}

function buildCompetitiveTransition(
	input: CompetitiveIntelWorkflowInput,
	actorId: string
): {
	toState: string;
	terminal: boolean;
	taskState: "open" | "in_progress" | "completed";
	taskTitle: string;
	priority: "critical" | "high" | "medium" | "low";
	patch: Partial<typeof competitiveAnalyses.$inferInsert>;
} {
	const now = new Date();
	switch (input.action) {
		case "start_review":
			return {
				toState: "in_review",
				terminal: false,
				taskState: "in_progress",
				taskTitle: "Review competitive intelligence",
				priority: "medium",
				patch: { isOutdated: true, analyzedBy: actorId, updatedAt: now },
			};
		case "mark_stale":
			return {
				toState: "stale",
				terminal: false,
				taskState: "open",
				taskTitle: "Refresh stale competitive intelligence",
				priority: "high",
				patch: { isOutdated: true, updatedAt: now },
			};
		case "approve_current":
			return {
				toState: "approved_current",
				terminal: true,
				taskState: "completed",
				taskTitle: "Competitive intelligence approved",
				priority: "low",
				patch: { isOutdated: false, analyzedBy: actorId, analyzedAt: now, updatedAt: now },
			};
		case "reopen_review":
			return {
				toState: "in_review",
				terminal: false,
				taskState: "open",
				taskTitle: "Reopened competitive intelligence review",
				priority: "medium",
				patch: { isOutdated: true, updatedAt: now },
			};
	}
}

function buildThemeTransition(input: WinThemeLifecycleWorkflowInput): {
	toState: string;
	terminal: boolean;
	taskState: "open" | "in_progress" | "completed" | "cancelled";
	taskTitle: string;
	priority: "critical" | "high" | "medium" | "low";
	patch: Partial<typeof winThemes.$inferInsert>;
} {
	const now = new Date();
	switch (input.action) {
		case "activate":
			return {
				toState: "active",
				terminal: false,
				taskState: "in_progress",
				taskTitle: "Validate active win theme coverage",
				priority: "medium",
				patch: { isActive: true, updatedAt: now },
			};
		case "approve":
			return {
				toState: "approved",
				terminal: true,
				taskState: "completed",
				taskTitle: "Win theme approved for proposal use",
				priority: "low",
				patch: { isActive: true, updatedAt: now },
			};
		case "archive":
			return {
				toState: "archived",
				terminal: true,
				taskState: "cancelled",
				taskTitle: "Win theme archived",
				priority: "low",
				patch: { isActive: false, updatedAt: now },
			};
		case "reopen_review":
			return {
				toState: "review_needed",
				terminal: false,
				taskState: "open",
				taskTitle: "Reopened win theme review",
				priority: "medium",
				patch: { isActive: true, updatedAt: now },
			};
	}
}

function buildInjectionTransition(
	input: ThemeInjectionWorkflowInput,
	actorId: string
): {
	toState: string;
	terminal: boolean;
	taskState: "open" | "completed" | "cancelled";
	taskTitle: string;
	patch: Partial<typeof themeInjectionPoints.$inferInsert>;
} {
	const now = new Date();
	switch (input.action) {
		case "accept":
			return {
				toState: "accepted",
				terminal: true,
				taskState: "completed",
				taskTitle: "Win theme injection accepted",
				patch: {
					status: "accepted",
					acceptedText: null,
					acceptedBy: actorId,
					acceptedAt: now,
					reviewNotes: input.reason.trim(),
				},
			};
		case "modify":
			if (!input.modifiedText?.trim()) {
				throw new Error("Modified theme injection requires modified text");
			}
			return {
				toState: "modified",
				terminal: true,
				taskState: "completed",
				taskTitle: "Win theme injection accepted with modifications",
				patch: {
					status: "modified",
					acceptedText: input.modifiedText.trim(),
					acceptedBy: actorId,
					acceptedAt: now,
					reviewNotes: input.reason.trim(),
				},
			};
		case "reject":
			return {
				toState: "rejected",
				terminal: true,
				taskState: "cancelled",
				taskTitle: "Win theme injection rejected",
				patch: {
					status: "rejected",
					acceptedText: null,
					acceptedBy: actorId,
					acceptedAt: now,
					reviewNotes: input.reason.trim(),
				},
			};
		case "reopen":
			return {
				toState: "pending",
				terminal: false,
				taskState: "open",
				taskTitle: "Reopened win theme injection review",
				patch: {
					status: "pending",
					acceptedText: null,
					acceptedBy: null,
					acceptedAt: null,
					reviewNotes: input.reason.trim(),
				},
			};
	}
}

function buildConsistencyTransition(
	input: ThemeConsistencyWorkflowInput,
	analysis: ThemeAnalysisRow
): {
	toState: string;
	terminal: boolean;
	taskState: "open" | "completed";
	taskTitle: string;
	priority: "critical" | "high" | "medium" | "low";
} {
	switch (input.action) {
		case "flag_gaps":
			return {
				toState: consistencyState(analysis),
				terminal: false,
				taskState: "open",
				taskTitle: "Resolve win theme consistency gaps",
				priority: priorityForConsistency(analysis),
			};
		case "approve_consistency":
			if ((analysis.criticalGapCount ?? 0) > 0) {
				throw new Error("Cannot approve win theme consistency with critical gaps");
			}
			return {
				toState: "consistent",
				terminal: true,
				taskState: "completed",
				taskTitle: "Win theme consistency approved",
				priority: "low",
			};
		case "reopen_review":
			return {
				toState: "review_needed",
				terminal: false,
				taskState: "open",
				taskTitle: "Reopened win theme consistency review",
				priority: priorityForConsistency(analysis),
			};
	}
}

async function recordStrategyRuntime(input: {
	workflowKey: string;
	subjectType: string;
	subjectId: string;
	opportunityId: string | null;
	fromState: string;
	toState: string;
	eventType: string;
	actorId: string;
	reason: string;
	priority: "critical" | "high" | "medium" | "low";
	assignedTo: string | null;
	assignedRole: string | null;
	dueAt: Date | null;
	terminal: boolean;
	taskKey: string;
	taskTitle: string;
	taskDescription: string;
	taskState: "open" | "in_progress" | "completed" | "cancelled";
	metadata: Record<string, unknown>;
	actionUrl: string;
}): Promise<StrategyWorkflowResult> {
	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: input.workflowKey,
		subjectType: input.subjectType,
		subjectId: input.subjectId,
		opportunityId: input.opportunityId,
		fromState: input.fromState,
		toState: input.toState,
		eventType: input.eventType,
		actorId: input.actorId,
		reason: input.reason,
		priority: input.priority,
		assignedTo: input.assignedTo,
		assignedRole: input.assignedRole,
		dueAt: input.dueAt,
		metadata: input.metadata,
		terminal: input.terminal,
		actionUrl: input.actionUrl,
	});

	await upsertWorkflowRuntimeTask({
		workflowInstanceId: instance.id,
		taskKey: input.taskKey,
		title: input.taskTitle,
		description: input.taskDescription,
		state: input.taskState,
		priority: input.priority,
		assignedTo: input.assignedTo,
		assignedRole: input.assignedRole,
		dueAt: input.dueAt,
		metadata: {
			...input.metadata,
			fromState: input.fromState,
			toState: input.toState,
		},
	});

	return {
		subjectId: input.subjectId,
		opportunityId: input.opportunityId,
		fromState: input.fromState,
		toState: input.toState,
		workflowInstanceId: instance.id,
		taskProjected: true,
	};
}

function competitiveState(analysis: CompetitiveAnalysisRow): string {
	return analysis.isOutdated ? "stale" : "current";
}

function themeState(theme: WinThemeRow): string {
	return theme.isActive ? "active" : "archived";
}

function consistencyState(analysis: ThemeAnalysisRow): string {
	if ((analysis.criticalGapCount ?? 0) > 0) return "critical_gaps";
	if ((analysis.majorGapCount ?? 0) > 0) return "major_gaps";
	if ((analysis.minorGapCount ?? 0) > 0) return "minor_gaps";
	return "consistent";
}

function priorityForInjection(
	injection: ThemeInjectionRow
): "critical" | "high" | "medium" | "low" {
	const score = injection.priorityScore ?? injection.impactScore ?? 0;
	if (score >= 0.85) return "high";
	if (score >= 0.55) return "medium";
	return "low";
}

function priorityForConsistency(
	analysis: ThemeAnalysisRow
): "critical" | "high" | "medium" | "low" {
	if ((analysis.criticalGapCount ?? 0) > 0) return "critical";
	if ((analysis.majorGapCount ?? 0) > 0) return "high";
	if ((analysis.minorGapCount ?? 0) > 0) return "medium";
	return "low";
}

function requireReason(value: string, message: string): string {
	const reason = value.trim();
	if (!reason) {
		throw new Error(message);
	}
	return reason;
}

function normalizeDueAt(value: Date | string | null | undefined, defaultDays: number): Date {
	if (value) {
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) {
			throw new Error("Due date is invalid");
		}
		return parsed;
	}
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + defaultDays);
	return date;
}
