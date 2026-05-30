import "./load-env";

import path from "node:path";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	type EvidenceRecord,
} from "./platform-proof/core";
import { forceLocalEnv } from "./env-utils";
import {
	documents,
	opportunities,
	proposalDocuments,
	rfpDocuments,
	rfpRequirements,
} from "@/lib/db/schema";
import { proposalTasks, taskActivity } from "@/lib/db/schema-tasks";
import type { ProposalDocumentType } from "@/lib/types/opportunity";
import { getDocumentTypeLabel } from "@/lib/utils/proposal-labels";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_REQUIREMENT_ACCEPTANCE_BACKFILL_RUN_ID ?? createProofRunId("live_requirement_acceptance_backfill");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "requirement-acceptance-backfill" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-requirement-acceptance-backfill-evidence.md");
const LIMIT = boundedNumber(process.env.LIVE_REQUIREMENT_ACCEPTANCE_BACKFILL_LIMIT, 10, 1, 100);
const APPLY = process.env.LIVE_REQUIREMENT_ACCEPTANCE_BACKFILL_APPLY === "1";
const USER_ID = (process.env.LIVE_REQUIREMENT_ACCEPTANCE_BACKFILL_USER_ID ?? process.env.DISCOVERY_IMPORT_USER_ID ?? "system").slice(0, 100);
const DEFAULT_ASSIGNED_TO = optionalString(process.env.LIVE_REQUIREMENT_ACCEPTANCE_BACKFILL_DEFAULT_ASSIGNED_TO);
const DEFAULT_DUE_DATE = optionalDate(process.env.LIVE_REQUIREMENT_ACCEPTANCE_BACKFILL_DEFAULT_DUE_DATE);
const TARGET_OPPORTUNITY_IDS = csvStrings(process.env.LIVE_REQUIREMENT_ACCEPTANCE_BACKFILL_OPPORTUNITY_IDS);
const SOURCE_PLATFORMS = csvStrings(process.env.LIVE_REQUIREMENT_ACCEPTANCE_BACKFILL_SOURCE_PLATFORMS);
const REFRESH_OPPORTUNITY_IDS = csvStrings(process.env.LIVE_REQUIREMENT_ACCEPTANCE_BACKFILL_REFRESH_OPPORTUNITY_IDS);
const REASON = process.env.LIVE_REQUIREMENT_ACCEPTANCE_BACKFILL_REASON?.trim()
	|| "Accepted by service backfill after parse-confidence review passed.";

let db: typeof import("@/lib/db")["db"];
let closeDatabaseConnection: typeof import("@/lib/db")["closeDatabaseConnection"] = async () => undefined;
let recordWorkflowRuntimeTransition: typeof import("@/lib/actions/workflow-runtime")["recordWorkflowRuntimeTransition"];
let upsertWorkflowRuntimeTask: typeof import("@/lib/actions/workflow-runtime")["upsertWorkflowRuntimeTask"];
let canProjectProposalTasks = false;
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type CandidateRow = {
	requirement: typeof rfpRequirements.$inferSelect;
	rfpDocument: typeof rfpDocuments.$inferSelect;
	opportunity: typeof opportunities.$inferSelect;
};

type AcceptanceBackfillProof = {
	runId: string;
	startedAt: string;
	completedAt?: string;
	apply: boolean;
	limit: number;
	targetOpportunityIds: string[];
	sourcePlatforms: string[];
	candidatesFound: number;
	accepted: Array<{
		requirementId: string;
		opportunityId: string;
		rfpDocumentId: string;
		requirementNumber: string | null;
		assignedTo: string;
		dueDate: string;
		responseDocumentId?: string;
		projectedTaskId?: string;
	}>;
	skipped: Array<{
		requirementId?: string;
		opportunityId?: string;
		rfpDocumentId?: string;
		requirementNumber?: string | null;
		reason: string;
	}>;
	responsePackageReceipts: Array<{
		opportunityId: string;
		workflowInstanceId: string;
		readinessStatus: string;
		acceptedRequirementCount: number;
		draftedRequirementCount: number;
		requirementCoverage: number;
		blockers: string[];
	}>;
	schema: {
		proposalTaskProjection: "supported" | "not-supported";
	};
	error?: string;
};

async function main() {
	forceLocalEnv(["DATABASE_URL"]);
	await loadRuntime();

	const proof: AcceptanceBackfillProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		apply: APPLY,
		limit: LIMIT,
		targetOpportunityIds: TARGET_OPPORTUNITY_IDS,
		sourcePlatforms: SOURCE_PLATFORMS,
		candidatesFound: 0,
		accepted: [],
		skipped: [],
		responsePackageReceipts: [],
		schema: {
			proposalTaskProjection: "not-supported",
		},
	};
	let disposition: EvidenceRecord["disposition"] = "fail";

	try {
		canProjectProposalTasks = await supportsProposalTaskProjection();
		proof.schema.proposalTaskProjection = canProjectProposalTasks ? "supported" : "not-supported";
		const candidates = await selectAcceptanceCandidates();
		proof.candidatesFound = candidates.length;
		for (const candidate of candidates) {
			const dryRunResult = await evaluateCandidate(candidate);
			if (!dryRunResult.ok) {
				proof.skipped.push(candidateSkip(candidate, dryRunResult.reason));
				continue;
			}
			if (!APPLY) {
				proof.accepted.push({
					requirementId: candidate.requirement.id,
					opportunityId: candidate.opportunity.id,
					rfpDocumentId: candidate.rfpDocument.id,
					requirementNumber: candidate.requirement.requirementNumber,
					assignedTo: dryRunResult.assignedTo,
					dueDate: dryRunResult.dueDate.toISOString(),
					responseDocumentId: dryRunResult.responseDocumentId,
				});
				continue;
			}

			try {
				proof.accepted.push(await acceptCandidate(candidate, dryRunResult));
			} catch (error) {
				proof.skipped.push(candidateSkip(candidate, error instanceof Error ? error.message : String(error)));
			}
		}

		if (APPLY) {
			const opportunityIds = uniqueStrings([
				...proof.accepted.map((item) => item.opportunityId),
				...REFRESH_OPPORTUNITY_IDS,
			]);
			for (const opportunityId of opportunityIds) {
				proof.responsePackageReceipts.push(await refreshResponsePackageWorkflowReceipt(opportunityId));
			}
		}
		proof.completedAt = new Date().toISOString();
		disposition = proof.accepted.length > 0 || proof.responsePackageReceipts.length > 0 ? "pass" : "blocked";
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		disposition = "fail";
	} finally {
		await writeArtifacts(proof, disposition);
		await closeDatabaseConnection().catch(() => undefined);
	}

	console.log(JSON.stringify(proof, null, 2));
	if (disposition === "fail") process.exit(1);
}

async function loadRuntime(): Promise<void> {
	const [databaseModule, workflowRuntimeModule] = await Promise.all([
		import("@/lib/db"),
		import("@/lib/actions/workflow-runtime"),
	]);
	db = databaseModule.db;
	closeDatabaseConnection = databaseModule.closeDatabaseConnection;
	recordWorkflowRuntimeTransition = workflowRuntimeModule.recordWorkflowRuntimeTransition;
	upsertWorkflowRuntimeTask = workflowRuntimeModule.upsertWorkflowRuntimeTask;
}

async function selectAcceptanceCandidates(): Promise<CandidateRow[]> {
	return db
		.select({
			requirement: rfpRequirements,
			rfpDocument: rfpDocuments,
			opportunity: opportunities,
		})
		.from(rfpRequirements)
		.innerJoin(rfpDocuments, eq(rfpDocuments.id, rfpRequirements.rfpDocumentId))
		.innerJoin(opportunities, eq(opportunities.id, rfpRequirements.opportunityId))
		.where(and(
			eq(rfpDocuments.parsingStatus, "completed"),
			sql`coalesce(${rfpDocuments.metadata}->'parseReview'->>'state', '') in ('accepted', 'auto_accepted')`,
			sql`coalesce(jsonb_array_length(coalesce(${rfpDocuments.metadata}->'parseReview'->'qualitySignals', '[]'::jsonb)), 0) = 0`,
			sql`coalesce(${rfpRequirements.metadata}->'workflow'->>'state', 'review') = 'review'`,
			sql`${rfpRequirements.complianceStatus} <> 'not_applicable'`,
			sql`exists (
				select 1 from proposal_documents
				where proposal_documents.opportunity_id = ${rfpRequirements.opportunityId}
			)`,
			...(TARGET_OPPORTUNITY_IDS.length > 0 ? [inArray(opportunities.id, TARGET_OPPORTUNITY_IDS)] : []),
			...(SOURCE_PLATFORMS.length > 0 ? [inArray(opportunities.sourcePlatform, SOURCE_PLATFORMS)] : []),
		))
		.orderBy(asc(rfpRequirements.createdAt))
		.limit(LIMIT);
}

async function supportsProposalTaskProjection(): Promise<boolean> {
	const requiredProposalTaskColumns = [
		"organization_id",
		"opportunity_id",
		"task_number",
		"title",
		"description",
		"task_type",
		"task_category",
		"section_id",
		"requirement_id",
		"volume_id",
		"assigned_to",
		"assigned_to_email",
		"assigned_by",
		"assigned_at",
		"suggested_assignees",
		"start_date",
		"due_date",
		"estimated_hours",
		"actual_hours",
		"hours_logged",
		"depends_on",
		"blocked_by",
		"blocks",
		"status",
		"priority",
		"completed_at",
		"completed_by",
		"progress",
		"word_count_target",
		"word_count_current",
		"page_target",
		"page_current",
		"quality_score",
		"last_reviewed_at",
		"last_reviewed_by",
		"review_notes",
		"updated_at",
		"compliance_requirements",
		"evaluation_criteria_ids",
		"reminders_sent",
		"last_reminder_at",
		"escalated",
		"escalated_at",
		"comments",
		"tags",
		"source_type",
		"source_id",
		"created_by",
		"created_at",
	];
	const requiredTaskActivityColumns = [
		"task_id",
		"activity_type",
		"description",
		"previous_value",
		"new_value",
		"change_field",
		"user_id",
		"user_name",
		"metadata",
	];
	const [proposalTaskColumns, taskActivityColumns] = await Promise.all([
		tableColumns("proposal_tasks"),
		tableColumns("task_activity"),
	]);
	return requiredProposalTaskColumns.every((column) => proposalTaskColumns.has(column))
		&& requiredTaskActivityColumns.every((column) => taskActivityColumns.has(column));
}

async function tableColumns(tableName: string): Promise<Set<string>> {
	const result = await db.execute(sql`
		select column_name
		from information_schema.columns
		where table_schema = 'public'
			and table_name = ${tableName}
	`);
	const rows = result.rows as Array<{ column_name: unknown }>;
	return new Set(rows.map((row) => String(row.column_name)));
}

async function evaluateCandidate(candidate: CandidateRow): Promise<
	{ ok: true; assignedTo: string; dueDate: Date; responseDocumentId: string } | { ok: false; reason: string }
> {
	const assignedTo = candidate.requirement.assignedTo ?? candidate.opportunity.assignedTo ?? DEFAULT_ASSIGNED_TO;
	const expiredReason = expiredCandidateDeadlineReason(candidate);
	if (expiredReason) return { ok: false, reason: expiredReason };
	const dueDate = normalizeDueDate(
		candidate.requirement.dueDate,
		candidate.rfpDocument.responseDeadline,
		candidate.opportunity.deadline
	);
	const missing = acceptanceGateFailures(candidate.requirement, assignedTo, dueDate);
	if (missing.length > 0) {
		return { ok: false, reason: `acceptance gate missing ${missing.join(", ")}` };
	}
	if (!assignedTo || Number.isNaN(dueDate.getTime())) {
		return { ok: false, reason: "acceptance gate missing owner or due date" };
	}
	const responseDocumentId = await responseDocumentIdForRequirement(candidate.opportunity.id, candidate.requirement.category, db);
	if (!responseDocumentId) {
		return { ok: false, reason: `acceptance gate missing ${documentTypeForRequirement(candidate.requirement.category)} response document` };
	}
	return { ok: true, assignedTo, dueDate, responseDocumentId };
}

async function acceptCandidate(
	candidate: CandidateRow,
	evaluation: { ok: true; assignedTo: string; dueDate: Date; responseDocumentId: string }
) {
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${candidate.requirement.id}))`);
		const [current] = await tx
			.select()
			.from(rfpRequirements)
			.where(eq(rfpRequirements.id, candidate.requirement.id))
			.limit(1);
		if (!current) throw new Error("Requirement no longer exists");
		if (requirementWorkflowState(current.metadata) !== "review") {
			throw new Error(`Requirement is no longer in review state (${requirementWorkflowState(current.metadata)})`);
		}

		const responseDocumentId = await responseDocumentIdForRequirement(candidate.opportunity.id, current.category, tx);
		if (!responseDocumentId) throw new Error(`No matching ${documentTypeForRequirement(current.category)} response document exists`);
		const now = new Date();
		const task = await upsertProposalTask({
			requirement: current,
			opportunity: candidate.opportunity,
			assignedTo: evaluation.assignedTo,
			dueDate: evaluation.dueDate,
			now,
			client: tx,
		});

		const workflow = buildAcceptedWorkflowMetadata({
			currentMetadata: current.metadata,
			projectedTaskId: task?.id,
			now,
			responseDocumentId,
		});
		await tx
			.update(rfpRequirements)
			.set({
				assignedTo: evaluation.assignedTo,
				dueDate: evaluation.dueDate,
				complianceStatus: current.complianceStatus === "not_addressed" ? "partial" : current.complianceStatus,
				responseDocumentId,
				responseSection: responseDocumentId ? getDocumentTypeLabel(documentTypeForRequirement(current.category)) : current.responseSection,
				responseStrategy: current.responseStrategy
					?? `Accepted for response drafting by ${RUN_ID}; verify evidence before final package rendering.`,
				metadata: {
					...recordObject(current.metadata),
					workflow,
				},
				updatedAt: now,
			})
			.where(eq(rfpRequirements.id, current.id));

		if (task) {
			await tx.insert(taskActivity).values({
				taskId: task.id,
				activityType: "requirement_workflow_transition",
				description: `Requirement accepted: ${REASON}`,
				previousValue: "review",
				newValue: "accepted",
				changeField: "requirement.workflow.state",
				userId: USER_ID,
				userName: USER_ID,
				metadata: {
					requirementId: current.id,
					action: "accept",
					evidenceLinks: buildEvidenceLinks(current, candidate.rfpDocument.id),
					source: "requirement-acceptance-backfill",
					runId: RUN_ID,
				},
			});
		}

		const runtimeInstance = await recordWorkflowRuntimeTransition({
			workflowKey: "requirement_acceptance",
			organizationId: current.organizationId,
			subjectType: "requirement",
			subjectId: current.id,
			opportunityId: current.opportunityId,
			fromState: "review",
			toState: "accepted",
			eventType: "requirement_accept",
			actorId: USER_ID,
			actorName: USER_ID,
			reason: REASON,
			evidenceLinks: buildEvidenceLinks(current, candidate.rfpDocument.id),
			priority: workflowPriority(task?.priority),
			assignedTo: evaluation.assignedTo,
			assignedRole: "writer",
			assignedBy: USER_ID,
			dueAt: evaluation.dueDate,
			visibility: "portal",
			portalVisibility: {
				visibleToPortal: true,
				portalRole: "contributor",
				summary: `Requirement ${current.requirementNumber ?? current.id} is accepted`,
				actionLabel: "Draft response",
				actionUrl: `/opportunities/${current.opportunityId}/requirements`,
			},
			authorityPolicy: {
				requiredRoles: ["proposal_manager", "capture_manager"],
				allowedActorIds: [USER_ID],
				escalationRole: "proposal_manager",
			},
			metadata: {
				requirementNumber: current.requirementNumber,
				projectedTaskId: task?.id,
				complianceStatus: current.complianceStatus === "not_addressed" ? "partial" : current.complianceStatus,
				source: "requirement-acceptance-backfill",
				runId: RUN_ID,
			},
			terminal: true,
			notificationRecipients: evaluation.assignedTo ? [evaluation.assignedTo] : [],
		}, tx);
		await upsertWorkflowRuntimeTask({
			workflowInstanceId: runtimeInstance.id,
			taskKey: `requirement-writing:${current.id}`,
			title: `Draft response for ${current.requirementNumber ?? "requirement"}`,
			description: current.requirementText,
			state: "open",
			priority: workflowPriority(task?.priority),
			assignedTo: evaluation.assignedTo,
			assignedRole: "writer",
			dueAt: evaluation.dueDate,
			metadata: { projectedTaskId: task?.id, requirementId: current.id },
		}, tx);

		return {
			requirementId: current.id,
			opportunityId: candidate.opportunity.id,
			rfpDocumentId: candidate.rfpDocument.id,
			requirementNumber: current.requirementNumber,
			assignedTo: evaluation.assignedTo,
			dueDate: evaluation.dueDate.toISOString(),
			responseDocumentId: responseDocumentId ?? undefined,
			projectedTaskId: task?.id,
		};
	});
}

async function upsertProposalTask(input: {
	requirement: typeof rfpRequirements.$inferSelect;
	opportunity: typeof opportunities.$inferSelect;
	assignedTo: string;
	dueDate: Date;
	now: Date;
	client: DbClient;
}) {
	if (!canProjectProposalTasks) return null;
	const [existing] = await input.client
		.select()
		.from(proposalTasks)
		.where(and(
			eq(proposalTasks.organizationId, input.requirement.organizationId),
			eq(proposalTasks.requirementId, input.requirement.id),
			eq(proposalTasks.opportunityId, input.opportunity.id),
			eq(proposalTasks.sourceType, "requirement_workflow"),
		))
		.limit(1);
	const priority = mapRequirementPriorityToTaskPriority(input.requirement.priority, input.requirement.riskLevel);
	const taskSyncData = {
		assignedTo: input.assignedTo,
		assignedBy: USER_ID,
		assignedAt: input.now,
		dueDate: input.dueDate,
		status: "assigned",
		priority,
		updatedAt: input.now,
	};
	if (existing) {
		const [updated] = await input.client
			.update(proposalTasks)
			.set(taskSyncData)
			.where(eq(proposalTasks.id, existing.id))
			.returning();
		if (!updated) throw new Error("Failed to update proposal task");
		return updated;
	}

	const [created] = await input.client
		.insert(proposalTasks)
		.values({
			organizationId: input.requirement.organizationId,
			opportunityId: input.opportunity.id,
			taskNumber: makeRequirementTaskNumber(input.requirement),
			title: `Draft response for ${input.requirement.requirementNumber ?? "requirement"}`,
			description: input.requirement.requirementText,
			taskType: "writing",
			taskCategory: input.requirement.category ?? "technical",
			requirementId: input.requirement.id,
			...taskSyncData,
			complianceRequirements: [input.requirement.requirementNumber ?? input.requirement.id],
			sourceType: "requirement_workflow",
			sourceId: input.requirement.id,
			createdBy: USER_ID,
			createdAt: input.now,
		})
		.returning();
	if (!created) throw new Error("Failed to create proposal task");
	return created;
}

async function responseDocumentIdForRequirement(
	opportunityId: string,
	category: string | null,
	client: DbClient
): Promise<string | null> {
	const documentType = documentTypeForRequirement(category);
	const [row] = await client
		.select({ documentId: proposalDocuments.documentId })
		.from(proposalDocuments)
		.innerJoin(documents, eq(documents.id, proposalDocuments.documentId))
		.where(and(
			eq(proposalDocuments.opportunityId, opportunityId),
			eq(proposalDocuments.documentType, documentType),
		))
		.limit(1);
	return row?.documentId ?? null;
}

async function refreshResponsePackageWorkflowReceipt(opportunityId: string) {
	const [opportunity] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
	if (!opportunity) throw new Error("Opportunity not found while refreshing response package receipt");
	const requirements = await db.select().from(rfpRequirements).where(eq(rfpRequirements.opportunityId, opportunityId));
	const acceptedRequirements = requirements.filter((requirement) => requirementWorkflowState(requirement.metadata) === "accepted");
	const draftedRequirementCount = 0;
	const proposalRows = await db
		.select({ id: proposalDocuments.id, documentId: proposalDocuments.documentId, wordCount: documents.wordCount })
		.from(proposalDocuments)
		.innerJoin(documents, eq(documents.id, proposalDocuments.documentId))
		.where(eq(proposalDocuments.opportunityId, opportunityId));
	const blockers = ["Backfilled response packages require the standard response readiness pass before final rendering"];
	if (acceptedRequirements.length === 0) {
		blockers.push("Parsed requirements are still pending acceptance; review and accept requirements before final package rendering");
	}
	const requirementCoverage = 0;
	const readiness = {
		status: "blocked",
		blockers,
		warnings: ["Requirement draft coverage requires the standard response readiness pass"],
		missingRequirementIds: acceptedRequirements.map((requirement) => requirement.id),
		metrics: {
			acceptedRequirementCount: acceptedRequirements.length,
			draftedRequirementCount,
			requirementCoverage,
			documentsDrafted: proposalRows.length,
			sectionsDrafted: proposalRows.length,
			complianceEntriesCreated: 0,
			totalDraftWordCount: proposalRows.reduce((total, row) => total + row.wordCount, 0),
			minDocumentDraftWordCount: proposalRows.length ? Math.min(...proposalRows.map((row) => row.wordCount)) : 0,
			evidenceChecklistCoverage: 0,
			evidenceCitationCoverage: 0,
			draftArtifactIntegrityCoverage: 0,
			reviewGateCoverage: 0,
			sourceCitationCoverage: 0,
			winThemeCoverage: 0,
			unresolvedPlaceholderCount: 0,
		},
	};
	const instance = await recordWorkflowRuntimeTransition({
		workflowKey: "proposal_response_package",
		organizationId: opportunity.organizationId ?? undefined,
		subjectType: "opportunity",
		subjectId: opportunityId,
		opportunityId,
		fromState: "response_package_drafted",
		toState: "response_package_drafted",
		eventType: "response_package_requirements_accepted",
		actorId: USER_ID,
		actorName: USER_ID,
		reason: "Accepted parsed requirements for an existing backfilled response package",
		evidenceLinks: acceptedRequirements.map((requirement) => `requirement:${requirement.id}`),
		priority: "high",
		visibility: "internal",
		metadata: {
			readiness,
			requirementCount: acceptedRequirements.length,
			proposalDocumentCount: proposalRows.length,
			proposalDocumentIds: proposalRows.map((row) => row.id),
			documentIds: proposalRows.map((row) => row.documentId),
			source: "requirement-acceptance-backfill",
			runId: RUN_ID,
		},
		terminal: false,
		actionUrl: `/opportunities/${opportunityId}/documents`,
	});
	return {
		opportunityId,
		workflowInstanceId: instance.id,
		readinessStatus: readiness.status,
		acceptedRequirementCount: acceptedRequirements.length,
		draftedRequirementCount,
		requirementCoverage,
		blockers,
	};
}

function buildAcceptedWorkflowMetadata(input: {
	currentMetadata: unknown;
	projectedTaskId?: string;
	now: Date;
	responseDocumentId: string | null;
}) {
	const metadata = recordObject(input.currentMetadata);
	const currentWorkflow = recordObject(metadata.workflow);
	const history = Array.isArray(currentWorkflow.history) ? currentWorkflow.history : [];
	const at = input.now.toISOString();
	return {
		...currentWorkflow,
		state: "accepted",
		reason: REASON,
		updatedAt: at,
		acceptedAt: at,
		acceptedBy: USER_ID,
		...(input.projectedTaskId ? { projectedTaskId: input.projectedTaskId } : {}),
		responseDocumentId: input.responseDocumentId,
		history: [
			...history,
			{
				action: "accept",
				from: "review",
				to: "accepted",
				actorId: USER_ID,
				actorName: USER_ID,
				reason: REASON,
				at,
				...(input.projectedTaskId ? { projectedTaskId: input.projectedTaskId } : {}),
				evidenceLinks: [],
				source: "requirement-acceptance-backfill",
				runId: RUN_ID,
			},
		],
	};
}

function acceptanceGateFailures(
	requirement: typeof rfpRequirements.$inferSelect,
	assignedTo: string | null,
	dueDate: Date | null
): string[] {
	const missing: string[] = [];
	if (!requirement.opportunityId) missing.push("opportunity");
	if (!requirement.sourceQuote && !requirement.sourceSection && requirement.sourcePage == null && !requirement.rfpDocumentId) {
		missing.push("source trace");
	}
	if (!requirement.category) missing.push("category");
	if (!requirement.priority) missing.push("priority");
	if (!assignedTo) missing.push("owner");
	if (!dueDate || Number.isNaN(dueDate.getTime())) missing.push("due date");
	return missing;
}

function normalizeDueDate(
	requirementDueDate: Date | null,
	responseDeadline: Date | null,
	opportunityDeadline: Date | null
): Date {
	const now = new Date();
	if (requirementDueDate && !Number.isNaN(requirementDueDate.getTime()) && requirementDueDate > now) return requirementDueDate;
	if (responseDeadline && !Number.isNaN(responseDeadline.getTime()) && responseDeadline > now) return responseDeadline;
	if (opportunityDeadline && !Number.isNaN(opportunityDeadline.getTime()) && opportunityDeadline > now) return opportunityDeadline;
	return DEFAULT_DUE_DATE && DEFAULT_DUE_DATE > now ? DEFAULT_DUE_DATE : new Date(Number.NaN);
}

function expiredCandidateDeadlineReason(candidate: CandidateRow): string | null {
	const opportunityReason = expiredDeadlineReason("opportunity deadline", candidate.opportunity.deadline);
	if (opportunityReason) return opportunityReason;
	return expiredDeadlineReason("RFP response deadline", candidate.rfpDocument.responseDeadline);
}

function expiredDeadlineReason(label: string, value: Date | null): string | null {
	if (!value || Number.isNaN(value.getTime()) || value >= new Date()) return null;
	return `acceptance gate expired ${label} ${value.toISOString()}`;
}

function documentTypeForRequirement(category: string | null): ProposalDocumentType {
	const normalized = category?.toLowerCase() ?? "";
	if (normalized.includes("cost") || normalized.includes("financial") || normalized.includes("price")) return "cost_proposal";
	if (normalized.includes("past")) return "past_performance";
	if (normalized.includes("staff") || normalized.includes("personnel")) return "management_plan";
	if (normalized.includes("management") || normalized.includes("delivery")) return "management_plan";
	if (normalized.includes("admin") || normalized.includes("submission")) return "cover_letter";
	if (normalized.includes("executive")) return "executive_summary";
	return "technical_approach";
}

function requirementWorkflowState(metadata: unknown): string {
	const workflow = recordObject(recordObject(metadata).workflow);
	return typeof workflow.state === "string" ? workflow.state : "review";
}

function buildEvidenceLinks(requirement: typeof rfpRequirements.$inferSelect, rfpDocumentId: string): string[] {
	return [
		`rfp-document:${rfpDocumentId}`,
		requirement.sourceSection ? `rfp-section:${requirement.sourceSection}` : null,
		requirement.sourcePage != null ? `rfp-page:${requirement.sourcePage}` : null,
	].filter((value): value is string => Boolean(value));
}

function makeRequirementTaskNumber(requirement: typeof rfpRequirements.$inferSelect): string {
	const suffix = requirement.requirementNumber?.replace(/[^A-Za-z0-9_-]+/g, "-") || requirement.id.slice(0, 8);
	return `REQ-${suffix}`.slice(0, 50);
}

function mapRequirementPriorityToTaskPriority(priority: string | null, riskLevel: string | null): string {
	if (priority === "mandatory" || riskLevel === "critical" || riskLevel === "high") return "high";
	if (priority === "optional" || riskLevel === "low") return "low";
	return "medium";
}

function workflowPriority(value: string | null | undefined): "critical" | "high" | "medium" | "low" {
	if (value === "critical" || value === "high" || value === "medium" || value === "low") return value;
	return "medium";
}

function candidateSkip(candidate: CandidateRow, reason: string): AcceptanceBackfillProof["skipped"][number] {
	return {
		requirementId: candidate.requirement.id,
		opportunityId: candidate.opportunity.id,
		rfpDocumentId: candidate.rfpDocument.id,
		requirementNumber: candidate.requirement.requirementNumber,
		reason,
	};
}

function uniqueStrings(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}

function recordObject(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value) ? { ...value } as Record<string, unknown> : {};
}

function boundedNumber(raw: string | undefined, defaultValue: number, min: number, max: number): number {
	const parsed = raw === undefined ? defaultValue : Number(raw);
	if (!Number.isFinite(parsed)) return defaultValue;
	return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function optionalString(raw: string | undefined): string | null {
	const trimmed = raw?.trim();
	return trimmed ? trimmed.slice(0, 100) : null;
}

function optionalDate(raw: string | undefined): Date | null {
	if (!raw) return null;
	const parsed = new Date(raw);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function csvStrings(raw: string | undefined): string[] {
	return raw
		?.split(",")
		.map((value) => value.trim())
		.filter(Boolean) ?? [];
}

async function writeArtifacts(proof: AcceptanceBackfillProof, disposition: EvidenceRecord["disposition"]): Promise<void> {
	const artifactPath = await writeProofJson(LOG_DIR, "requirement-acceptance-backfill.json", proof);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "requirement acceptance backfill",
		journey: "parse-reviewed requirements to response execution",
		run_id: proof.runId,
		artifact_ids: [
			path.relative(WORKSPACE_ROOT, artifactPath),
			`candidates:${proof.candidatesFound}`,
			`accepted:${proof.accepted.length}`,
			`apply:${String(proof.apply)}`,
		],
		topology_tier: "live database",
		verification_bucket: "parsed-rfp requirement acceptance",
		timestamp: proof.completedAt ?? new Date().toISOString(),
		operator: USER_ID,
		cleanup_status: proof.apply ? "not-applicable" : "idempotent-noop",
		disposition,
		notes: proof.accepted.length > 0
			? `${proof.apply ? "Accepted" : "Validated acceptance for"} ${proof.accepted.length} parse-review-ready requirement(s).`
			: proof.responsePackageReceipts.length > 0
				? `Refreshed ${proof.responsePackageReceipts.length} response package receipt(s).`
			: proof.error ?? "No parse-review-ready requirements were eligible for service acceptance.",
	}], { title: "Requirement Acceptance Backfill Evidence" });
}

void main();
