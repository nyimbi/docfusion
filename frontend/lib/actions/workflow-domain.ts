"use server";

import { db } from "@/lib/db";
import { claimAnalysis } from "@/lib/db/schema-evidence";
import { dataImports } from "@/lib/db/schema-import";
import { costElements } from "@/lib/db/schema-pricing";
import { documents, opportunities, opportunityPartners, proposalDocuments, submissions } from "@/lib/db/schema";
import { documentApprovals } from "@/lib/db/schema-comments-workflow";
import { gateReviews } from "@/lib/db/schema-pipeline";
import { complianceEntries, rfpDocuments, rfpParsingJobs, rfpRequirements } from "@/lib/db/schema-rfp";
import { scraperRuns } from "@/lib/db/schema-scraper";
import { proposalReviews, reviewComments } from "@/lib/db/schema-reviews";
import { proposalTasks } from "@/lib/db/schema-tasks";
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
import { z } from "zod";
import { requireTenantContext } from "@/lib/auth/tenant-context";

// Zod whitelist for workflow-driven rfpRequirements patch — only the columns
// that the domain compensation legitimately writes are permitted.
const rfpRequirementWorkflowPatchSchema = z.object({
	complianceStatus: z.enum(["not_addressed", "partial", "compliant", "non_compliant", "not_applicable", "addressed"]).optional(),
	priority: z.enum(["mandatory", "preferred", "optional"]).optional(),
	notes: z.string().optional(),
	assignedTo: z.string().optional(),
	updatedAt: z.date().optional(),
});

type DomainWorkflowAction = "start" | "transition" | "reopen" | "cancel" | "resolve";
type CompensationAction = "reopen" | "cancel" | "resolve";

const WORKFLOW_MANAGED_SUBJECT_STATE_MODELS = {
	ai_governance_event: {
		handler: "workflow_managed_ai_governance_event",
		storage: "workflow_instances.metadata.domainState",
		states: ["detected", "triage", "eval_required", "human_review", "approved", "rejected", "rolled_back"],
		terminalStates: ["approved", "rejected", "rolled_back"],
		actionStates: {
			reopen: "triage",
			cancel: "rejected",
			resolve: "approved",
		},
	},
	audit_report_package: {
		handler: "workflow_managed_audit_report_package",
		storage: "workflow_instances.metadata.domainState",
		states: ["draft", "snapshot_ready", "review", "approved", "published", "rejected", "retained"],
		terminalStates: ["published", "rejected", "retained"],
		actionStates: {
			reopen: "review",
			cancel: "rejected",
			resolve: "published",
		},
	},
	offline_action_batch: {
		handler: "workflow_managed_offline_action_batch",
		storage: "workflow_instances.metadata.domainState",
		states: ["cached", "syncing", "conflict_review", "merged", "rejected", "superseded"],
		terminalStates: ["merged", "rejected", "superseded"],
		actionStates: {
			reopen: "cached",
			cancel: "rejected",
			resolve: "merged",
		},
	},
} as const;

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
	const { organizationId } = await requireTenantContext();
	const template = await getActiveWorkflowTemplate(input.templateKey);
	const initialState = template.states[0];
	if (!initialState) {
		throw new Error(`Workflow template ${input.templateKey} does not define an initial state`);
	}
	await assertWorkflowAuthority({
		actorId: input.actorId,
		actorRoles: input.actorRoles,
		policy: getStartAuthorityPolicy(template, initialState),
		action: "start",
	});

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
		organizationId,
	});

	return instance;
}

export async function transitionDomainWorkflow(
	input: TransitionDomainWorkflowInput
): Promise<WorkflowInstanceRow> {
	const { organizationId } = await requireTenantContext();
	if (isReversalAction(input.action)) {
		const instance = await getWorkflowInstance(input.workflowInstanceId);
		const template = await getTemplateForInstance(instance);
		const targetState = input.targetState ?? getDefaultReversalTargetState(input.action);
		await assertWorkflowAuthority({
			actorId: input.actorId,
			actorRoles: input.actorRoles,
			policy: getReversalAuthorityPolicy(input.action, instance, template),
			action: input.action,
		});
		const updated = await reverseWorkflowRuntimeState({
			workflowInstanceId: input.workflowInstanceId,
			action: input.action,
			actorId: input.actorId,
			reason: input.reason ?? "",
			targetState,
			visibility: getTemplateVisibility(template, targetState),
			portalVisibility: getTemplatePortalVisibility(template, targetState) ?? null,
			evidenceLinks: input.evidenceLinks,
			authorityChecked: true,
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
			organizationId,
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
		organizationId,
	});

	return updated;
}

async function applyDomainStateProjection(input: {
	instance: WorkflowInstanceRow;
	action: DomainWorkflowAction;
	toState: string;
	actorId: string;
	reason: string;
	organizationId: string;
}) {
	await applyDomainCompensation({
		instance: input.instance,
		action: normalizeProjectionAction(input.toState),
		actorId: input.actorId,
		reason: input.reason,
		organizationId: input.organizationId,
	});
}

async function applyDomainCompensation(input: {
	instance: WorkflowInstanceRow;
	action: CompensationAction;
	actorId: string;
	reason: string;
	organizationId: string;
}) {
	const now = new Date();
	let handler = "metadata_only";
	let patch: Record<string, unknown> = {};

	switch (input.instance.subjectType) {
		case "opportunity": {
			handler = "opportunity_decision";
			patch = input.action === "reopen"
				? {
					decisionStatus: "pending",
					decisionReason: `Reopened by workflow: ${input.reason}`,
					isReviewed: false,
					updatedAt: now,
				}
				: input.action === "cancel"
					? {
						decisionStatus: "no_bid",
						decisionReason: `Cancelled by workflow compensation: ${input.reason}`,
						isReviewed: true,
						updatedAt: now,
					}
					: {
						decisionStatus: "go",
						decisionReason: `Resolved by workflow: ${input.reason}`,
						isReviewed: true,
						updatedAt: now,
					};
			await db.update(opportunities).set(patch).where(eq(opportunities.id, input.instance.subjectId));
			break;
		}
		case "document": {
			handler = "document_finalization";
			const [document] = await db
				.select()
				.from(documents)
				.where(eq(documents.id, input.instance.subjectId))
				.limit(1);
			if (!document) {
				throw new Error("Document not found for workflow compensation");
			}
			patch = documentFinalizationPatch({
				action: input.action,
				actorId: input.actorId,
				reason: input.reason,
				now,
				metadata: document.metadata,
			});
			await db.update(documents).set(patch).where(eq(documents.id, input.instance.subjectId));
			await db
				.update(proposalDocuments)
				.set(proposalDocumentFinalizationPatch(input.action, input.actorId, input.reason, now))
				.where(eq(proposalDocuments.documentId, input.instance.subjectId));
			break;
		}
		case "rfp_parse":
		case "rfp_document": {
			handler = "rfp_document_parse";
			patch = rfpDocumentPatch(input.action, input.reason, now);
			await db.update(rfpDocuments).set(patch).where(and(eq(rfpDocuments.id, input.instance.subjectId), eq(rfpDocuments.organizationId, input.organizationId)));
			break;
		}
		case "rfp_parsing_job": {
			handler = "rfp_parsing_job";
			patch = input.action === "reopen"
				? {
					status: "queued",
					currentStep: "queued",
					progress: 0,
					errorMessage: null,
					errorStack: null,
					startedAt: null,
					completedAt: null,
					updatedAt: now,
				}
				: input.action === "cancel"
					? {
						status: "cancelled",
						errorMessage: `Cancelled by workflow compensation: ${input.reason}`,
						completedAt: now,
						updatedAt: now,
					}
					: {
						status: "completed",
						progress: 100,
						errorMessage: null,
						errorStack: null,
						completedAt: now,
						updatedAt: now,
					};
			await db.update(rfpParsingJobs).set(patch).where(and(eq(rfpParsingJobs.id, input.instance.subjectId), eq(rfpParsingJobs.organizationId, input.organizationId)));
			break;
		}
		case "requirement":
		case "rfp_requirement": {
			handler = "rfp_requirement";
			patch = input.action === "reopen"
				? {
					complianceStatus: "not_addressed",
					updatedAt: now,
				}
				: input.action === "cancel"
					? {
						complianceStatus: "non_compliant",
						updatedAt: now,
					}
					: {
						complianceStatus: "addressed",
						updatedAt: now,
					};
			// Validate patch against whitelist before writing — prevents uncontrolled column writes.
			const validatedReqPatch = rfpRequirementWorkflowPatchSchema.parse(patch);
			await db.update(rfpRequirements).set(validatedReqPatch).where(and(eq(rfpRequirements.id, input.instance.subjectId), eq(rfpRequirements.organizationId, input.organizationId)));
			break;
		}
		case "compliance_entry": {
			handler = "compliance_entry";
			patch = input.action === "reopen"
				? {
					status: "draft",
					complianceStatus: "pending",
					reviewerNotes: `Reopened by workflow: ${input.reason}`,
					reviewedBy: null,
					reviewedAt: null,
					approvedBy: null,
					approvedAt: null,
					completionPercent: 0,
					updatedAt: now,
				}
				: input.action === "cancel"
					? {
						status: "rejected",
						complianceStatus: "non_compliant",
						reviewerNotes: `Cancelled by workflow compensation: ${input.reason}`,
						reviewedBy: input.actorId,
						reviewedAt: now,
						approvedBy: null,
						approvedAt: null,
						updatedAt: now,
					}
					: {
						status: "approved",
						complianceStatus: "full",
						reviewerNotes: `Resolved by workflow: ${input.reason}`,
						reviewedBy: input.actorId,
						reviewedAt: now,
						approvedBy: input.actorId,
						approvedAt: now,
						completionPercent: 100,
						updatedAt: now,
					};
			await db.update(complianceEntries).set(patch).where(and(eq(complianceEntries.id, input.instance.subjectId), eq(complianceEntries.organizationId, input.organizationId)));
			break;
		}
		case "gate_review": {
			handler = "gate_review";
			patch = input.action === "reopen"
				? {
					status: "in_progress",
					decision: null,
					conductedDate: null,
					rationale: `Reopened by workflow: ${input.reason}`,
					updatedAt: now,
				}
				: input.action === "cancel"
					? {
						status: "cancelled",
						decision: "defer",
						conductedDate: now,
						rationale: `Cancelled by workflow compensation: ${input.reason}`,
						updatedAt: now,
					}
					: {
						status: "completed",
						decision: "pass",
						conductedDate: now,
						rationale: `Resolved by workflow: ${input.reason}`,
						updatedAt: now,
					};
			await db.update(gateReviews).set(patch).where(eq(gateReviews.id, input.instance.subjectId));
			break;
		}
		case "proposal_task": {
			handler = "proposal_task";
			patch = input.action === "reopen"
				? {
					status: "in_progress",
					completedAt: null,
					completedBy: null,
					progress: 50,
					updatedAt: now,
				}
				: input.action === "cancel"
					? {
						status: "cancelled",
						completedAt: now,
						completedBy: input.actorId,
						updatedAt: now,
					}
					: {
						status: "completed",
						completedAt: now,
						completedBy: input.actorId,
						progress: 100,
						updatedAt: now,
					};
			await db.update(proposalTasks).set(patch).where(eq(proposalTasks.id, input.instance.subjectId));
			break;
		}
		case "proposal_review": {
			handler = "proposal_review";
			patch = input.action === "reopen"
				? {
					status: "in_progress",
					completedAt: null,
					recommendation: null,
					updatedAt: now,
				}
				: input.action === "cancel"
					? {
						status: "cancelled",
						completedAt: now,
						recommendation: "not_ready",
						updatedAt: now,
					}
					: {
						status: "completed",
						completedAt: now,
						recommendation: "ready_to_submit",
						updatedAt: now,
					};
			await db.update(proposalReviews).set(patch).where(eq(proposalReviews.id, input.instance.subjectId));
			break;
		}
		case "review_comment": {
			handler = "review_comment";
			patch = input.action === "reopen"
				? {
					resolutionStatus: "open",
					resolutionNotes: `Reopened by workflow: ${input.reason}`,
					resolutionAction: null,
					resolvedBy: null,
					resolvedAt: null,
					verifiedBy: null,
					verifiedAt: null,
					verificationNotes: null,
					updatedAt: now,
				}
				: input.action === "cancel"
					? {
						resolutionStatus: "wont_fix",
						resolutionNotes: `Cancelled by workflow compensation: ${input.reason}`,
						resolutionAction: "kept",
						resolvedBy: input.actorId,
						resolvedAt: now,
						updatedAt: now,
					}
					: {
						resolutionStatus: "resolved",
						resolutionNotes: `Resolved by workflow: ${input.reason}`,
						resolutionAction: "revised",
						resolvedBy: input.actorId,
						resolvedAt: now,
						verifiedBy: input.actorId,
						verifiedAt: now,
						verificationNotes: `Verified by workflow: ${input.reason}`,
						updatedAt: now,
					};
			await db.update(reviewComments).set(patch).where(eq(reviewComments.id, input.instance.subjectId));
			break;
		}
		case "document_approval": {
			handler = "document_approval";
			patch = input.action === "reopen"
				? {
					status: "in_review",
					completedAt: null,
					notes: `Reopened by workflow: ${input.reason}`,
					rejectionReason: null,
					updatedAt: now,
				}
				: input.action === "cancel"
					? {
						status: "rejected",
						completedAt: now,
						notes: `Cancelled by workflow compensation: ${input.reason}`,
						rejectionReason: input.reason,
						updatedAt: now,
					}
					: {
						status: "approved",
						completedAt: now,
						notes: `Resolved by workflow: ${input.reason}`,
						rejectionReason: null,
						updatedAt: now,
					};
			await db.update(documentApprovals).set(patch).where(eq(documentApprovals.id, input.instance.subjectId));
			break;
		}
		case "submission": {
			handler = "submission";
			patch = input.action === "reopen"
				? {
					status: "reopened",
					outcome: null,
					outcomeDate: null,
					outcomeNotes: `Reopened by workflow: ${input.reason}`,
					updatedAt: now,
				}
				: input.action === "cancel"
					? {
						status: "cancelled",
						outcome: null,
						outcomeDate: now,
						outcomeNotes: `Cancelled by workflow compensation: ${input.reason}`,
						updatedAt: now,
					}
					: {
						status: "submitted",
						outcomeNotes: `Resolved by workflow: ${input.reason}`,
						updatedAt: now,
					};
			await db.update(submissions).set(patch).where(eq(submissions.id, input.instance.subjectId));
			break;
		}
		case "scraper_run": {
			handler = "scraper_run";
			patch = input.action === "reopen"
				? {
					status: "pending",
					progress: 0,
					errorMessage: null,
					errorType: null,
					completedAt: null,
				}
				: input.action === "cancel"
					? {
						status: "cancelled",
						errorMessage: `Cancelled by workflow compensation: ${input.reason}`,
						errorType: "workflow_cancelled",
						completedAt: now,
					}
					: {
						status: "success",
						progress: 100,
						errorMessage: null,
						errorType: null,
						completedAt: now,
					};
			await db.update(scraperRuns).set(patch).where(eq(scraperRuns.id, input.instance.subjectId));
			break;
		}
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
		default: {
			const workflowManagedState = getWorkflowManagedSubjectState({
				instance: input.instance,
				action: input.action,
				actorId: input.actorId,
				reason: input.reason,
				now,
			});
			if (workflowManagedState) {
				handler = workflowManagedState.handler;
				patch = {
					domainStateModel: workflowManagedState.domainStateModel,
					domainState: workflowManagedState.domainState,
				};
				await db
					.update(workflowInstances)
					.set({
						metadata: {
							...(isRecord(input.instance.metadata) ? input.instance.metadata : {}),
							domainStateModel: workflowManagedState.domainStateModel,
							domainState: workflowManagedState.domainState,
						},
						updatedAt: now,
					})
					.where(eq(workflowInstances.id, input.instance.id));
			}
			break;
		}
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

function documentFinalizationPatch(input: {
	action: "reopen" | "cancel" | "resolve";
	actorId: string;
	reason: string;
	now: Date;
	metadata: unknown;
}) {
	const metadata = isRecord(input.metadata) ? input.metadata : {};
	if (input.action === "reopen") {
		return {
			status: "draft",
			metadata: {
				...metadata,
				finalArtifact: null,
				finalArtifactWorkflow: {
					state: "artifact_reopened",
					reopenedAt: input.now.toISOString(),
					reopenedBy: input.actorId,
					reason: input.reason,
				},
				finalizationCompensation: {
					action: input.action,
					reason: input.reason,
					actorId: input.actorId,
					at: input.now.toISOString(),
				},
			},
			updatedAt: input.now,
		};
	}
	if (input.action === "cancel") {
		return {
			status: "draft",
			metadata: {
				...metadata,
				finalArtifact: null,
				finalArtifactWorkflow: {
					state: "artifact_cancelled",
					cancelledAt: input.now.toISOString(),
					cancelledBy: input.actorId,
					reason: input.reason,
				},
				finalizationCompensation: {
					action: input.action,
					reason: input.reason,
					actorId: input.actorId,
					at: input.now.toISOString(),
				},
			},
			updatedAt: input.now,
		};
	}
	return {
		status: "final",
		metadata: {
			...metadata,
			finalArtifactWorkflow: {
				...(isRecord(metadata.finalArtifactWorkflow) ? metadata.finalArtifactWorkflow : {}),
				state: "artifact_approved",
				resolvedAt: input.now.toISOString(),
				resolvedBy: input.actorId,
				reason: input.reason,
			},
			finalizationCompensation: {
				action: input.action,
				reason: input.reason,
				actorId: input.actorId,
				at: input.now.toISOString(),
			},
		},
		updatedAt: input.now,
	};
}

function proposalDocumentFinalizationPatch(
	action: "reopen" | "cancel" | "resolve",
	actorId: string,
	reason: string,
	now: Date
) {
	if (action === "resolve") {
		return {
			status: "final",
			approvedBy: actorId,
			approvedAt: now,
			notes: `Resolved by workflow compensation: ${reason}`,
			updatedAt: now,
		};
	}
	return {
		status: "in_review",
		approvedBy: null,
		approvedAt: null,
		notes: `${action === "reopen" ? "Reopened" : "Cancelled"} by workflow compensation: ${reason}`,
		updatedAt: now,
	};
}

function rfpDocumentPatch(action: "reopen" | "cancel" | "resolve", reason: string, now: Date) {
	if (action === "reopen") {
		return {
			parsingStatus: "pending",
			parsingProgress: 0,
			parsingError: null,
			parsingStartedAt: null,
			parsingCompletedAt: null,
			updatedAt: now,
		};
	}
	if (action === "cancel") {
		return {
			parsingStatus: "failed",
			parsingProgress: 0,
			parsingError: `Cancelled by workflow compensation: ${reason}`,
			parsingCompletedAt: now,
			updatedAt: now,
		};
	}
	return {
		parsingStatus: "completed",
		parsingProgress: 100,
		parsingError: null,
		parsingCompletedAt: now,
		updatedAt: now,
	};
}

function getWorkflowManagedSubjectState(input: {
	instance: WorkflowInstanceRow;
	action: CompensationAction;
	actorId: string;
	reason: string;
	now: Date;
}) {
	const model = WORKFLOW_MANAGED_SUBJECT_STATE_MODELS[
		input.instance.subjectType as keyof typeof WORKFLOW_MANAGED_SUBJECT_STATE_MODELS
	];
	if (!model) return null;

	const states: readonly string[] = model.states;
	const status = states.includes(input.instance.state)
		? input.instance.state
		: model.actionStates[input.action];
	const updatedAt = input.now.toISOString();

	return {
		handler: model.handler,
		domainStateModel: {
			subjectType: input.instance.subjectType,
			storage: model.storage,
			states: model.states,
			terminalStates: model.terminalStates,
			reasonField: "domainState.reason",
			actorField: "domainState.actorId",
			updatedAtField: "domainState.updatedAt",
			version: 1,
		},
		domainState: {
			status,
			action: input.action,
			reason: input.reason,
			actorId: input.actorId,
			updatedAt,
		},
	};
}

function normalizeProjectionAction(state: string): "reopen" | "cancel" | "resolve" {
	if ([
		"cancelled",
		"deferred",
		"failed",
		"no_bid",
		"rejected",
		"removed",
		"rolled_back",
		"superseded",
		"wont_fix",
	].includes(state)) return "cancel";
	if ([
		"accepted",
		"accepted_final",
		"addressed",
		"approved",
		"completed",
		"committed",
		"go",
		"locked",
		"merged",
		"pass",
		"published",
		"ready_to_submit",
		"resolved",
		"retained",
		"submitted",
		"won",
		"waived",
	].includes(state)) return "resolve";
	if ([
		"cached",
		"detected",
		"draft",
		"in_progress",
		"in_review",
		"invited",
		"mapped",
		"open",
		"pending",
		"queued",
		"reopened",
		"scheduled",
	].includes(state)) return "reopen";
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

function getStartAuthorityPolicy(template: WorkflowTemplateRow, initialState: string) {
	const metadata = isRecord(template.metadata) ? template.metadata : {};
	const metadataStartRoles = Array.isArray(metadata.startRequiredRoles)
		? metadata.startRequiredRoles.filter((role): role is string => typeof role === "string" && role.length > 0)
		: [];
	const initialTransitionRoles = template.transitions
		.filter((transition) => transition.from.includes(initialState))
		.flatMap((transition) => transition.requiredRoles ?? []);
	const requiredRoles = unique([
		...metadataStartRoles,
		...initialTransitionRoles,
	]);
	return {
		requiredRoles: requiredRoles.length ? requiredRoles : ["admin", "workflow_admin"],
	};
}

function isReversalAction(action: string): action is "reopen" | "cancel" | "resolve" {
	return action === "reopen" || action === "cancel" || action === "resolve";
}

function getDefaultReversalTargetState(action: "reopen" | "cancel" | "resolve") {
	if (action === "reopen") return "active";
	if (action === "cancel") return "cancelled";
	return "resolved";
}

function getReversalAuthorityPolicy(
	action: "reopen" | "cancel" | "resolve",
	instance: WorkflowInstanceRow,
	template: WorkflowTemplateRow
) {
	const explicitTransition = template.transitions.find((candidate) =>
		candidate.action === action && candidate.from.includes(instance.state)
	);
	return {
		requiredRoles: explicitTransition?.requiredRoles?.length
			? explicitTransition.requiredRoles
			: ["admin", "workflow_admin"],
		allowedActorIds: instance.authorityPolicy?.allowedActorIds,
	};
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
