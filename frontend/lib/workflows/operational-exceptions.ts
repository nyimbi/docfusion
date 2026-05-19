import { db } from "@/lib/db";
import {
	rfpDocuments,
	rfpParsingJobs,
	scraperRuns,
	scraperSources,
} from "@/lib/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { transitionRfpParseWorkflow } from "@/lib/actions/rfp-parser";
import { recordWorkflowRuntimeTransition, upsertWorkflowRuntimeTask } from "@/lib/actions/workflow-runtime";

export type OperationalExceptionSubjectType = "rfp_parse" | "scraper_run";
export type OperationalExceptionSeverity = "critical" | "high" | "medium";
export type OperationalExceptionStatus = "open" | "retrying" | "manual_extraction" | "rejected";

export interface OperationalException {
	id: string;
	subjectType: OperationalExceptionSubjectType;
	subjectId: string;
	title: string;
	severity: OperationalExceptionSeverity;
	status: OperationalExceptionStatus;
	detectedAt: Date;
	lastError: string | null;
	ownerHint: string | null;
	workflowActionHint: string[];
	metadata: Record<string, unknown>;
}

export interface OperationalExceptionFilters {
	limit?: number;
	subjectTypes?: OperationalExceptionSubjectType[];
}

export interface RemediateOperationalExceptionInput {
	subjectType: OperationalExceptionSubjectType;
	subjectId: string;
	action: "retry" | "reject" | "manual_extraction";
	reason: string;
}

export async function listOperationalExceptionsForActor(
	filters: OperationalExceptionFilters = {}
): Promise<OperationalException[]> {
	const limit = filters.limit ?? 50;
	const includeRfp = !filters.subjectTypes || filters.subjectTypes.includes("rfp_parse");
	const includeScraper = !filters.subjectTypes || filters.subjectTypes.includes("scraper_run");
	const exceptionGroups: OperationalException[][] = [];

	if (includeRfp) {
		const rows = await db
			.select({
				document: rfpDocuments,
				job: rfpParsingJobs,
			})
			.from(rfpDocuments)
			.leftJoin(rfpParsingJobs, eq(rfpParsingJobs.rfpDocumentId, rfpDocuments.id))
			.where(inArray(rfpDocuments.parsingStatus, ["failed"]))
			.orderBy(desc(rfpDocuments.updatedAt))
			.limit(limit);

		exceptionGroups.push(rows.map(({ document, job }) => ({
			id: `rfp_parse:${document.id}`,
			subjectType: "rfp_parse",
			subjectId: document.id,
			title: `RFP parse failed: ${document.filename}`,
			severity: "high",
			status: getRfpExceptionStatus(document.metadata),
			detectedAt: document.updatedAt ?? document.createdAt,
			lastError: document.parsingError ?? job?.errorMessage ?? null,
			ownerHint: document.uploadedBy,
			workflowActionHint: ["retry", "manual_extraction", "reject"],
			metadata: {
				jobId: job?.id,
				progress: document.parsingProgress,
				currentStep: job?.currentStep,
				opportunityId: document.opportunityId,
			},
		} satisfies OperationalException)));
	}

	if (includeScraper) {
		const rows = await db
			.select({
				run: scraperRuns,
				source: scraperSources,
			})
			.from(scraperRuns)
			.leftJoin(scraperSources, eq(scraperRuns.sourceId, scraperSources.id))
			.where(inArray(scraperRuns.status, ["failed", "timeout", "partial"]))
			.orderBy(desc(scraperRuns.startedAt))
			.limit(limit);

		exceptionGroups.push(rows.map(({ run, source }) => ({
			id: `scraper_run:${run.id}`,
			subjectType: "scraper_run",
			subjectId: run.id,
			title: `Scraper ${run.status}: ${source?.name ?? run.sourceKey}`,
			severity: run.status === "failed" || run.status === "timeout" ? "high" : "medium",
			status: "open",
			detectedAt: run.completedAt ?? run.startedAt,
			lastError: run.errorMessage,
			ownerHint: source?.sourceId ?? run.sourceKey,
			workflowActionHint: ["inspect_source", "rerun_source", "disable_source"],
			metadata: {
				runId: run.runId,
				sourceKey: run.sourceKey,
				errorType: run.errorType,
				opportunitiesFailed: run.opportunitiesFailed,
				progress: run.progress,
			},
		} satisfies OperationalException)));
	}

	return exceptionGroups
		.flat()
		.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
		.slice(0, limit);
}

export async function remediateOperationalExceptionForActor(
	input: RemediateOperationalExceptionInput
) {
	if (input.subjectType !== "rfp_parse") {
		throw new Error("Only RFP parse exceptions support remediation actions in this pilot");
	}

	return transitionRfpParseWorkflow({
		rfpDocumentId: input.subjectId,
		action: input.action,
		reason: input.reason,
		startProcessing: input.action === "retry",
	});
}

export async function syncOperationalExceptionWorkflowsForActor(
	filters: OperationalExceptionFilters = {},
	actorId = "system"
): Promise<{ synced: number }> {
	const exceptions = await listOperationalExceptionsForActor(filters);
	const actorName = actorId === "system" ? "System" : actorId;

	for (const exception of exceptions) {
		const instance = await recordWorkflowRuntimeTransition({
			workflowKey: "operations_exception_queue",
			subjectType: exception.subjectType,
			subjectId: exception.subjectId,
			opportunityId: typeof exception.metadata.opportunityId === "string"
				? exception.metadata.opportunityId
				: null,
			toState: exception.status,
			eventType: "operational_exception_detected",
			actorId,
			actorName,
			reason: exception.lastError ?? exception.title,
			priority: exception.severity,
			assignedTo: exception.ownerHint,
			assignedRole: exception.subjectType === "rfp_parse" ? "proposal_manager" : "operations",
			dueAt: addHours(exception.detectedAt, exception.severity === "critical" ? 4 : 24),
			escalatedTo: exception.severity === "critical" ? "operations_lead" : null,
			visibility: "internal",
			authorityPolicy: {
				requiredRoles: ["operations", "proposal_manager"],
				escalationRole: "operations_lead",
			},
			metadata: exception.metadata,
			terminal: exception.status === "rejected",
			notificationRecipients: exception.ownerHint ? [exception.ownerHint] : [],
		});

		await upsertWorkflowRuntimeTask({
			workflowInstanceId: instance.id,
			taskKey: `exception:${exception.id}`,
			title: exception.title,
			description: exception.lastError ?? undefined,
			state: exception.status === "rejected" ? "completed" : "open",
			priority: exception.severity,
			assignedTo: exception.ownerHint,
			assignedRole: exception.subjectType === "rfp_parse" ? "proposal_manager" : "operations",
			dueAt: addHours(exception.detectedAt, exception.severity === "critical" ? 4 : 24),
			metadata: {
				subjectType: exception.subjectType,
				subjectId: exception.subjectId,
				workflowActionHint: exception.workflowActionHint,
			},
		});
	}

	return { synced: exceptions.length };
}

function getRfpExceptionStatus(metadata: unknown): OperationalExceptionStatus {
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
		return "open";
	}

	const workflow = (metadata as { parseWorkflow?: { state?: string } }).parseWorkflow;
	if (workflow?.state === "manual_extraction") return "manual_extraction";
	if (workflow?.state === "rejected") return "rejected";
	if (workflow?.state === "queued" || workflow?.state === "processing") return "retrying";
	return "open";
}

function addHours(date: Date, hours: number): Date {
	return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
