"use server";

import { requireUserContext } from "@/lib/auth-utils";
import {
	recordWorkflowRuntimeTransition,
	upsertWorkflowRuntimeTask,
} from "@/lib/actions/workflow-runtime";
import { db } from "@/lib/db";
import {
	costElements,
	costTechnicalTracking,
	pricingSummaries,
	type AlignmentIssue,
} from "@/lib/db/schema-pricing";
import { and, eq, sql, type SQL } from "drizzle-orm";

type CostElementRow = typeof costElements.$inferSelect;
type CostTechnicalTrackingRow = typeof costTechnicalTracking.$inferSelect;
type PricingSummaryRow = typeof pricingSummaries.$inferSelect;

export type CostElementPricingAction =
	| "submit_review"
	| "approve"
	| "reject"
	| "reopen";

export type PricingPackageAction =
	| "request_review"
	| "approve_lock"
	| "reject"
	| "reopen";

export interface CostElementPricingWorkflowInput {
	costElementId: string;
	action: CostElementPricingAction;
	reason: string;
	boeNarrative?: string | null;
	authorityRole?: string | null;
	assignedTo?: string | null;
	dueAt?: Date | string | null;
}

export interface PricingPackageWorkflowInput {
	pricingSummaryId: string;
	action: PricingPackageAction;
	reason: string;
	authorityRole?: string | null;
	waiveCriticalAlignment?: boolean;
	assignedTo?: string | null;
	dueAt?: Date | string | null;
}

export interface PricingApprovalWorkflowResult {
	subjectId: string;
	opportunityId: string;
	fromState: string;
	toState: string;
	workflowInstanceId: string;
	taskProjected: boolean;
}

const COST_ELEMENT_WORKFLOW_KEY = "cost_element_pricing_approval";
const PRICING_PACKAGE_WORKFLOW_KEY = "pricing_package_approval";

function requirePricingApprovalContext(userContext: { userId: string; organizationId?: string | null }) {
	if (!userContext.organizationId) {
		throw new Error("No organization context");
	}
}

function assignedOpportunityExistsSql(opportunityId: unknown, userId: string): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and opportunities.assigned_to = ${userId}
	)`;
}

function visibleCostElementByIdCondition(costElementId: string, userId: string): SQL {
	return and(
		eq(costElements.id, costElementId),
		assignedOpportunityExistsSql(costElements.opportunityId, userId)
	)!;
}

function visiblePricingSummaryByIdCondition(pricingSummaryId: string, userId: string): SQL {
	return and(
		eq(pricingSummaries.id, pricingSummaryId),
		assignedOpportunityExistsSql(pricingSummaries.opportunityId, userId)
	)!;
}

function visibleCostElementsByOpportunityCondition(opportunityId: string, userId: string): SQL {
	return and(
		eq(costElements.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userId)
	)!;
}

export async function transitionCostElementPricingWorkflow(
	input: CostElementPricingWorkflowInput
): Promise<PricingApprovalWorkflowResult> {
	const userContext = await requireUserContext();
	requirePricingApprovalContext(userContext);
	const reason = requireReason(input.reason, "Pricing cost element transitions require a reason");
	const [costElement] = await db
		.select()
		.from(costElements)
		.where(visibleCostElementByIdCondition(input.costElementId, userContext.userId))
		.limit(1);
	if (!costElement) {
		throw new Error("Cost element not found");
	}

	const fromState = costElement.status ?? "draft";
	const transition = buildCostElementTransition({
		input,
		costElement,
		actorId: userContext.userId,
	});

	const [updatedCostElement] = await db
		.update(costElements)
		.set(transition.patch)
		.where(visibleCostElementByIdCondition(input.costElementId, userContext.userId))
		.returning();
	if (!updatedCostElement) {
		throw new Error("Failed to update cost element pricing state");
	}

	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: COST_ELEMENT_WORKFLOW_KEY,
		subjectType: "cost_element",
		subjectId: input.costElementId,
		opportunityId: updatedCostElement.opportunityId,
		fromState,
		toState: transition.toState,
		eventType: `cost_element_pricing_${input.action}`,
		actorId: userContext.userId,
		reason,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : transition.assignedRole,
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 2),
		authorityPolicy: input.authorityRole
			? { requiredRoles: [input.authorityRole] }
			: undefined,
		metadata: {
			costElementId: input.costElementId,
			wbsCode: updatedCostElement.wbsCode ?? null,
			wbsTitle: updatedCostElement.wbsTitle ?? null,
			elementType: updatedCostElement.elementType ?? null,
			totalCost: updatedCostElement.totalCost ?? null,
			action: input.action,
			authorityRole: input.authorityRole ?? null,
			hasBoeNarrative: hasText(updatedCostElement.boeNarrative),
		},
		terminal: transition.terminal,
		actionUrl: `/pricing`,
	});

	await upsertWorkflowRuntimeTask({
		workflowInstanceId: instance.id,
		taskKey: `pricing-cost-element:${input.costElementId}`,
		title: transition.taskTitle,
		description: `${transition.taskTitle}. Reason: ${reason}`,
		state: transition.taskState,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : transition.assignedRole,
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 2),
		metadata: {
			costElementId: input.costElementId,
			fromState,
			toState: transition.toState,
			authorityRole: input.authorityRole ?? null,
		},
	});

	return {
		subjectId: input.costElementId,
		opportunityId: updatedCostElement.opportunityId,
		fromState,
		toState: transition.toState,
		workflowInstanceId: instance.id,
		taskProjected: true,
	};
}

export async function transitionPricingPackageWorkflow(
	input: PricingPackageWorkflowInput
): Promise<PricingApprovalWorkflowResult> {
	const userContext = await requireUserContext();
	requirePricingApprovalContext(userContext);
	const reason = requireReason(input.reason, "Pricing package transitions require a reason");
	const [summary] = await db
		.select()
		.from(pricingSummaries)
		.where(visiblePricingSummaryByIdCondition(input.pricingSummaryId, userContext.userId))
		.limit(1);
	if (!summary) {
		throw new Error("Pricing summary not found");
	}

	const [elements, trackingRows] = await Promise.all([
		db.select().from(costElements).where(visibleCostElementsByOpportunityCondition(summary.opportunityId, userContext.userId)),
		db.select().from(costTechnicalTracking).where(eq(costTechnicalTracking.opportunityId, summary.opportunityId)),
	]);
	const fromState = derivePricingSummaryState(summary, elements);
	const transition = buildPricingPackageTransition({
		input,
		summary,
		costElements: elements,
		trackingRows,
		actorId: userContext.userId,
	});

	const [updatedSummary] = await db
		.update(pricingSummaries)
		.set(transition.patch)
		.where(visiblePricingSummaryByIdCondition(input.pricingSummaryId, userContext.userId))
		.returning();
	if (!updatedSummary) {
		throw new Error("Failed to update pricing summary workflow projection");
	}

	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: PRICING_PACKAGE_WORKFLOW_KEY,
		subjectType: "pricing_summary",
		subjectId: input.pricingSummaryId,
		opportunityId: updatedSummary.opportunityId,
		fromState,
		toState: transition.toState,
		eventType: `pricing_package_${input.action}`,
		actorId: userContext.userId,
		reason,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : transition.assignedRole,
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 2),
		authorityPolicy: input.authorityRole
			? { requiredRoles: [input.authorityRole] }
			: undefined,
		metadata: {
			pricingSummaryId: input.pricingSummaryId,
			action: input.action,
			authorityRole: input.authorityRole ?? null,
			costElementCount: elements.length,
			approvedCostElementCount: elements.filter((element) => element.status === "approved").length,
			criticalAlignmentIssueCount: transition.criticalIssues.length,
			criticalAlignmentWaived: Boolean(input.waiveCriticalAlignment && input.authorityRole),
			grandTotalPrice: updatedSummary.grandTotalPrice ?? null,
		},
		terminal: transition.terminal,
		actionUrl: `/pricing`,
	});

	await upsertWorkflowRuntimeTask({
		workflowInstanceId: instance.id,
		taskKey: `pricing-package:${input.pricingSummaryId}`,
		title: transition.taskTitle,
		description: `${transition.taskTitle}. Reason: ${reason}`,
		state: transition.taskState,
		priority: transition.priority,
		assignedTo: input.assignedTo ?? null,
		assignedRole: transition.terminal ? null : transition.assignedRole,
		dueAt: transition.terminal ? null : normalizeDueAt(input.dueAt, 2),
		metadata: {
			pricingSummaryId: input.pricingSummaryId,
			fromState,
			toState: transition.toState,
			criticalAlignmentIssueCount: transition.criticalIssues.length,
		},
	});

	return {
		subjectId: input.pricingSummaryId,
		opportunityId: updatedSummary.opportunityId,
		fromState,
		toState: transition.toState,
		workflowInstanceId: instance.id,
		taskProjected: true,
	};
}

function buildCostElementTransition(input: {
	input: CostElementPricingWorkflowInput;
	costElement: CostElementRow;
	actorId: string;
}): {
	toState: string;
	terminal: boolean;
	taskState: "open" | "in_progress" | "blocked" | "completed" | "cancelled";
	taskTitle: string;
	priority: "critical" | "high" | "medium" | "low";
	assignedRole: string;
	patch: Partial<typeof costElements.$inferInsert>;
} {
	const now = new Date();
	const narrative = input.input.boeNarrative?.trim() || input.costElement.boeNarrative?.trim() || "";
	switch (input.input.action) {
		case "submit_review":
			enforceCostElementStatus(
				input.costElement,
				["draft"],
				"Only draft cost elements can be submitted for pricing review"
			);
			if (!narrative) {
				throw new Error("Submitting a cost element for pricing review requires a BOE narrative");
			}
			return {
				toState: "pending_review",
				terminal: false,
				taskState: "open",
				taskTitle: "Review cost element BOE and price basis",
				priority: "high",
				assignedRole: "pricing_reviewer",
				patch: {
					status: "pending_review",
					boeNarrative: narrative,
					updatedAt: now,
				},
			};
		case "approve":
			enforceCostElementStatus(
				input.costElement,
				["pending_review"],
				"Only cost elements pending review can be approved"
			);
			requireAuthority(input.input.authorityRole, "Approving cost elements requires pricing authority");
			if (!narrative) {
				throw new Error("Approving a cost element requires a BOE narrative");
			}
			return {
				toState: "approved",
				terminal: true,
				taskState: "completed",
				taskTitle: "Cost element pricing approved",
				priority: "medium",
				assignedRole: "pricing_reviewer",
				patch: {
					status: "approved",
					boeNarrative: narrative,
					approvedBy: input.actorId,
					approvedAt: now,
					updatedAt: now,
				},
			};
		case "reject":
			enforceCostElementStatus(
				input.costElement,
				["pending_review", "approved"],
				"Only reviewed cost elements can be rejected"
			);
			return {
				toState: "draft",
				terminal: false,
				taskState: "blocked",
				taskTitle: "Revise rejected cost element",
				priority: "high",
				assignedRole: "pricing_owner",
				patch: {
					status: "draft",
					approvedBy: null,
					approvedAt: null,
					boeNarrative: narrative || input.costElement.boeNarrative,
					updatedAt: now,
				},
			};
		case "reopen":
			enforceCostElementStatus(
				input.costElement,
				["pending_review", "approved"],
				"Only submitted or approved cost elements can be reopened"
			);
			return {
				toState: "draft",
				terminal: false,
				taskState: "open",
				taskTitle: "Rework reopened cost element pricing",
				priority: "high",
				assignedRole: "pricing_owner",
				patch: {
					status: "draft",
					approvedBy: null,
					approvedAt: null,
					updatedAt: now,
				},
			};
	}
}

function buildPricingPackageTransition(input: {
	input: PricingPackageWorkflowInput;
	summary: PricingSummaryRow;
	costElements: CostElementRow[];
	trackingRows: CostTechnicalTrackingRow[];
	actorId: string;
}): {
	toState: string;
	terminal: boolean;
	taskState: "open" | "in_progress" | "blocked" | "completed" | "cancelled";
	taskTitle: string;
	priority: "critical" | "high" | "medium" | "low";
	assignedRole: string;
	criticalIssues: AlignmentIssue[];
	patch: Partial<typeof pricingSummaries.$inferInsert>;
} {
	const now = new Date();
	const criticalIssues = collectCriticalAlignmentIssues(input.trackingRows);
	const unapprovedElements = input.costElements.filter((element) => element.status !== "approved");
	switch (input.input.action) {
		case "request_review":
			if (input.costElements.length === 0) {
				throw new Error("Requesting pricing package review requires at least one cost element");
			}
			if (input.summary.grandTotalPrice == null) {
				throw new Error("Requesting pricing package review requires a calculated grand total price");
			}
			return {
				toState: "package_review_requested",
				terminal: false,
				taskState: "open",
				taskTitle: "Review pricing package for approval",
				priority: "high",
				assignedRole: "pricing_reviewer",
				criticalIssues,
				patch: {
					calculatedBy: input.summary.calculatedBy ?? input.actorId,
					calculatedAt: input.summary.calculatedAt ?? now,
					updatedAt: now,
				},
			};
		case "approve_lock":
			requireAuthority(input.input.authorityRole, "Locking pricing requires pricing approval authority");
			if (input.costElements.length === 0) {
				throw new Error("Locking a pricing package requires cost elements");
			}
			if (unapprovedElements.length > 0) {
				throw new Error("Locking a pricing package requires all cost elements to be approved");
			}
			if (criticalIssues.length > 0 && !(input.input.waiveCriticalAlignment && input.input.authorityRole)) {
				throw new Error("Locking a pricing package requires critical cost-technical issues to be resolved or waived by authority");
			}
			return {
				toState: "locked",
				terminal: true,
				taskState: "completed",
				taskTitle: "Pricing package locked for submission",
				priority: "medium",
				assignedRole: "pricing_approver",
				criticalIssues,
				patch: {
					calculatedBy: input.actorId,
					calculatedAt: now,
					updatedAt: now,
				},
			};
		case "reject":
			return {
				toState: "package_rework_required",
				terminal: false,
				taskState: "blocked",
				taskTitle: "Rework rejected pricing package",
				priority: "high",
				assignedRole: "pricing_owner",
				criticalIssues,
				patch: {
					updatedAt: now,
				},
			};
		case "reopen":
			requireAuthority(input.input.authorityRole, "Reopening locked pricing requires pricing authority");
			return {
				toState: "package_reopened",
				terminal: false,
				taskState: "open",
				taskTitle: "Reconcile reopened pricing package",
				priority: "high",
				assignedRole: "pricing_owner",
				criticalIssues,
				patch: {
					updatedAt: now,
				},
			};
	}
}

function enforceCostElementStatus(
	costElement: CostElementRow,
	allowed: Array<NonNullable<CostElementRow["status"]>>,
	message: string
) {
	if (!allowed.includes(costElement.status ?? "draft")) {
		throw new Error(message);
	}
}

function requireReason(value: string | null | undefined, message: string) {
	const reason = value?.trim();
	if (!reason) {
		throw new Error(message);
	}
	return reason;
}

function requireAuthority(value: string | null | undefined, message: string) {
	if (!value?.trim()) {
		throw new Error(message);
	}
}

function hasText(value: string | null | undefined) {
	return Boolean(value?.trim());
}

function derivePricingSummaryState(summary: PricingSummaryRow, elements: CostElementRow[]) {
	if (elements.length > 0 && elements.every((element) => element.status === "approved")) {
		return "all_cost_elements_approved";
	}
	if (summary.grandTotalPrice != null) {
		return "priced";
	}
	return "draft";
}

function collectCriticalAlignmentIssues(rows: CostTechnicalTrackingRow[]) {
	return rows.flatMap((row) => {
		if (!Array.isArray(row.alignmentIssues)) {
			return [];
		}
		return row.alignmentIssues.filter((issue) => issue.severity === "critical");
	});
}

function normalizeDueAt(value: Date | string | null | undefined, fallbackDays: number) {
	if (value instanceof Date) {
		return value;
	}
	if (typeof value === "string" && value.trim()) {
		return new Date(value);
	}
	const dueAt = new Date();
	dueAt.setDate(dueAt.getDate() + fallbackDays);
	return dueAt;
}
