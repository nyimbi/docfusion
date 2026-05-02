"use server";

import { db } from "@/lib/db";
import { claimAnalysis } from "@/lib/db/schema-evidence";
import { dataImports } from "@/lib/db/schema-import";
import { costElements } from "@/lib/db/schema-pricing";
import { opportunityPartners } from "@/lib/db/schema";
import {
	workflowAuditEvents,
	workflowInstances,
	workflowTemplates,
	type WorkflowInstanceRow,
	type WorkflowTemplateRow,
} from "@/lib/db/schema-workflow-runtime";
import {
	assertWorkflowAuthority,
	recordWorkflowRuntimeTransition,
	reverseWorkflowRuntimeState,
	upsertWorkflowRuntimeTask,
	type WorkflowRuntimeStatus,
} from "@/lib/actions/workflow-runtime";
import { and, desc, eq } from "drizzle-orm";

type DomainWorkflowAction = "start" | "transition" | "reopen" | "cancel" | "resolve";

export interface StartDomainWorkflowInput {
	templateKey: string;
	subjectId: string;
	subjectType?: string;
	opportunityId?: string | null;
	actorId: string;
	actorRoles?: string[];
	reason?: string;
	assignedTo?: string | null;
	assignedRole?: string | null;
	priority?: "critical" | "high" | "medium" | "low";
	notificationRecipients?: string[];
}

export interface TransitionDomainWorkflowInput {
	workflowInstanceId: string;
	action: string;
	actorId: string;
	actorRoles?: string[];
	reason?: string;
	targetState?: string;
	evidenceLinks?: string[];
	notificationRecipients?: string[];
}

export async function startDomainWorkflowFromTemplate(
	input: StartDomainWorkflowInput
): Promise<WorkflowInstanceRow> {
	const template = await getActiveWorkflowTemplate(input.templateKey);
	const initialState = template.states[0];
	if (!initialState) {
		throw new Error(`Workflow template ${input.templateKey} does not define an initial state`);
	}

	const dueAt = computeDueAt(template.slaPolicy);
	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: template.templateKey,
		subjectType: input.subjectType ?? template.subjectType,
		subjectId: input.subjectId,
		opportunityId: input.opportunityId,
		toState: initialState,
		eventType: "workflow_started",
		actorId: input.actorId,
		reason: input.reason ?? `Started ${template.name}`,
		priority: input.priority ?? "medium",
		assignedTo: input.assignedTo,
		assignedRole: input.assignedRole,
		dueAt,
		visibility: getTemplateVisibility(template, initialState),
		portalVisibility: getTemplatePortalVisibility(template, initialState),
		authorityPolicy: getTemplateAuthorityPolicy(template),
		metadata: {
			templateId: template.id,
			templateVersion: template.version,
			templateStatus: template.status,
			domainIntegration: true,
		},
		notificationRecipients: input.notificationRecipients ?? compact([input.assignedTo]),
	});

	await upsertWorkflowRuntimeTask({
		workflowInstanceId: instance.id,
		taskKey: `${template.templateKey}:${initialState}`,
		title: `${template.name}: ${instance.subjectId}`,
		description: template.description ?? undefined,
		state: "open",
		priority: input.priority ?? "medium",
		assignedTo: input.assignedTo,
		assignedRole: input.assignedRole,
		dueAt,
		metadata: {
			templateId: template.id,
			templateVersion: template.version,
			state: initialState,
		},
	});

	await applyDomainStateProjection({
		instance,
		action: "start",
		toState: initialState,
		actorId: input.actorId,
		reason: input.reason ?? `Started ${template.name}`,
	});

	return instance;
}

export async function transitionDomainWorkflow(
	input: TransitionDomainWorkflowInput
): Promise<WorkflowInstanceRow> {
	if (isReversalAction(input.action)) {
		const updated = await reverseWorkflowRuntimeState({
			workflowInstanceId: input.workflowInstanceId,
			action: input.action,
			actorId: input.actorId,
			reason: input.reason ?? "",
			targetState: input.targetState,
			evidenceLinks: input.evidenceLinks,
			metadata: {
				domainCompensation: true,
				apiActorRoles: input.actorRoles ?? [],
			},
		});
		await applyDomainCompensation({
			instance: updated,
			action: input.action,
			actorId: input.actorId,
			reason: input.reason ?? "",
		});
		return updated;
	}

	const instance = await getWorkflowInstance(input.workflowInstanceId);
	const template = await getTemplateForInstance(instance);
	const transition = template.transitions.find((candidate) =>
		candidate.action === input.action && candidate.from.includes(instance.state)
	);
	if (!transition) {
		throw new Error(`Action ${input.action} is not valid from workflow state ${instance.state}`);
	}
	if (transition.requiresReason && !input.reason?.trim()) {
		throw new Error(`Action ${input.action} requires a reason`);
	}
	await assertWorkflowAuthority({
		actorId: input.actorId,
		actorRoles: input.actorRoles,
		policy: { requiredRoles: transition.requiredRoles },
		action: input.action,
	});

	const isTerminal = !template.transitions.some((candidate) => candidate.from.includes(transition.to));
	const updated = await recordWorkflowRuntimeTransition({
		workflowKey: instance.workflowKey,
		subjectType: instance.subjectType,
		subjectId: instance.subjectId,
		opportunityId: instance.opportunityId,
		fromState: instance.state,
		toState: transition.to,
		eventType: `workflow_${input.action}`,
		actorId: input.actorId,
		reason: input.reason,
		evidenceLinks: input.evidenceLinks,
		assignedTo: instance.assignedTo,
		assignedRole: instance.assignedRole,
		dueAt: instance.dueAt,
		visibility: getTemplateVisibility(template, transition.to),
		portalVisibility: getTemplatePortalVisibility(template, transition.to),
		authorityPolicy: getTemplateAuthorityPolicy(template),
		metadata: {
			templateId: template.id,
			templateVersion: template.version,
			domainIntegration: true,
			transitionAction: input.action,
		},
		terminal: isTerminal,
		notificationRecipients: input.notificationRecipients ?? compact([instance.assignedTo]),
	});

	await upsertWorkflowRuntimeTask({
		workflowInstanceId: updated.id,
		taskKey: `${template.templateKey}:${transition.to}`,
		title: `${template.name}: ${transition.to}`,
		state: isTerminal ? "completed" : "open",
		assignedTo: updated.assignedTo,
		assignedRole: updated.assignedRole,
		dueAt: updated.dueAt,
		metadata: {
			transitionAction: input.action,
			fromState: instance.state,
			toState: transition.to,
		},
	});

	await applyDomainStateProjection({
		instance: updated,
		action: "transition",
		toState: transition.to,
		actorId: input.actorId,
		reason: input.reason ?? `Advanced workflow via ${input.action}`,
	});

	return updated;
}

async function applyDomainStateProjection(input: {
	instance: WorkflowInstanceRow;
	action: DomainWorkflowAction;
	toState: string;
	actorId: string;
	reason: string;
}) {
	await applyDomainCompensation({
		instance: input.instance,
		action: normalizeProjectionAction(input.toState),
		actorId: input.actorId,
		reason: input.reason,
	});
}

async function applyDomainCompensation(input: {
	instance: WorkflowInstanceRow;
	action: "reopen" | "cancel" | "resolve";
	actorId: string;
	reason: string;
}) {
	const now = new Date();
	let handler = "metadata_only";
	let patch: Record<string, unknown> = {};

	switch (input.instance.subjectType) {
		case "evidence_claim": {
			handler = "claim_analysis";
			patch = input.action === "reopen"
				? {
					status: "open",
					resolution: null,
					resolvedBy: null,
					resolvedAt: null,
					resolutionNotes: `Reopened by workflow: ${input.reason}`,
				}
				: input.action === "cancel"
					? {
						status: "resolved",
						resolution: "claim_removed",
						resolvedBy: input.actorId,
						resolvedAt: now,
						resolutionNotes: `Cancelled by workflow compensation: ${input.reason}`,
					}
					: {
						status: "resolved",
						resolution: "evidence_added",
						resolvedBy: input.actorId,
						resolvedAt: now,
						resolutionNotes: `Resolved by workflow: ${input.reason}`,
					};
			await db.update(claimAnalysis).set(patch).where(eq(claimAnalysis.id, input.instance.subjectId));
			break;
		}
		case "pricing_package": {
			handler = "pricing_package_cost_elements";
			patch = pricingPatch(input.action, input.actorId, now);
			await db.update(costElements).set(patch).where(eq(costElements.opportunityId, input.instance.subjectId));
			break;
		}
		case "cost_element": {
			handler = "cost_element";
			patch = pricingPatch(input.action, input.actorId, now);
			await db.update(costElements).set(patch).where(eq(costElements.id, input.instance.subjectId));
			break;
		}
		case "import_sync_job": {
			handler = "data_import";
			patch = input.action === "reopen"
				? { status: "pending", completedAt: null }
				: input.action === "cancel"
					? { status: "cancelled", completedAt: now }
					: { status: "completed", completedAt: now };
			await db.update(dataImports).set(patch).where(eq(dataImports.id, input.instance.subjectId));
			break;
		}
		case "partner_assignment": {
			handler = "opportunity_partner";
			patch = input.action === "reopen"
				? { status: "invited", updatedAt: now }
				: input.action === "cancel"
					? { status: "rejected", updatedAt: now }
					: { status: "accepted", updatedAt: now };
			await db.update(opportunityPartners).set(patch).where(eq(opportunityPartners.id, input.instance.subjectId));
			break;
		}
		default:
			break;
	}

	await db.insert(workflowAuditEvents).values({
		workflowInstanceId: input.instance.id,
		subjectType: input.instance.subjectType,
		subjectId: input.instance.subjectId,
		eventType: "domain_compensation_applied",
		fromState: input.instance.state,
		toState: input.instance.state,
		actorId: input.actorId,
		actorName: input.actorId,
		reason: input.reason,
		metadata: {
			action: input.action,
			handler,
			patch,
		},
	});
}

function pricingPatch(action: "reopen" | "cancel" | "resolve", actorId: string, now: Date) {
	if (action === "reopen") {
		return { status: "draft", approvedBy: null, approvedAt: null, updatedAt: now };
	}
	if (action === "cancel") {
		return { status: "draft", approvedBy: null, approvedAt: null, updatedAt: now };
	}
	return { status: "approved", approvedBy: actorId, approvedAt: now, updatedAt: now };
}

function normalizeProjectionAction(state: string): "reopen" | "cancel" | "resolve" {
	if (["rejected", "removed", "expired", "rolled_back", "failed", "superseded"].includes(state)) return "cancel";
	if (["draft", "detected", "mapped", "invited", "cached", "reopened"].includes(state)) return "reopen";
	if (["resolved", "waived", "approved", "locked", "committed", "accepted_final", "published", "retained", "merged"].includes(state)) return "resolve";
	return "reopen";
}

async function getActiveWorkflowTemplate(templateKey: string): Promise<WorkflowTemplateRow> {
	const [template] = await db
		.select()
		.from(workflowTemplates)
		.where(and(eq(workflowTemplates.templateKey, templateKey), eq(workflowTemplates.status, "active")))
		.orderBy(desc(workflowTemplates.version))
		.limit(1);
	if (!template) {
		throw new Error(`Active workflow template ${templateKey} was not found`);
	}
	return template;
}

async function getTemplateForInstance(instance: WorkflowInstanceRow): Promise<WorkflowTemplateRow> {
	const metadata = isRecord(instance.metadata) ? instance.metadata : {};
	const templateVersion = typeof metadata.templateVersion === "number" ? metadata.templateVersion : undefined;
	const conditions = [
		eq(workflowTemplates.templateKey, instance.workflowKey),
		templateVersion ? eq(workflowTemplates.version, templateVersion) : eq(workflowTemplates.status, "active"),
	];
	const [template] = await db
		.select()
		.from(workflowTemplates)
		.where(and(...conditions))
		.orderBy(desc(workflowTemplates.version))
		.limit(1);
	if (!template) {
		throw new Error(`Workflow template ${instance.workflowKey} was not found`);
	}
	return template;
}

async function getWorkflowInstance(workflowInstanceId: string): Promise<WorkflowInstanceRow> {
	const [instance] = await db
		.select()
		.from(workflowInstances)
		.where(eq(workflowInstances.id, workflowInstanceId))
		.limit(1);
	if (!instance) {
		throw new Error("Workflow instance not found");
	}
	return instance;
}

function computeDueAt(policy: WorkflowTemplateRow["slaPolicy"]): Date | undefined {
	const hours = policy?.defaultHours;
	if (!hours || !Number.isFinite(hours)) return undefined;
	return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function getTemplateVisibility(template: WorkflowTemplateRow, state: string): "internal" | "portal" {
	const visibleStates = template.portalPolicy?.visibleStates ?? [];
	return visibleStates.includes(state) ? "portal" : "internal";
}

function getTemplatePortalVisibility(template: WorkflowTemplateRow, state: string) {
	const visibleStates = template.portalPolicy?.visibleStates ?? [];
	if (!visibleStates.includes(state)) return undefined;
	return {
		visibleToPortal: true,
		portalRole: template.portalPolicy?.portalRole,
		summary: template.name,
		actionLabel: "Open workflow",
		actionUrl: "/workflows/portal",
	};
}

function getTemplateAuthorityPolicy(template: WorkflowTemplateRow) {
	return {
		requiredRoles: unique(template.transitions.flatMap((transition) => transition.requiredRoles ?? [])),
		escalationRole: template.slaPolicy?.escalationRole,
	};
}

function isReversalAction(action: string): action is "reopen" | "cancel" | "resolve" {
	return action === "reopen" || action === "cancel" || action === "resolve";
}

function compact(values: Array<string | null | undefined>): string[] {
	return values.filter((value): value is string => Boolean(value));
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
