"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { scraperJobs, scraperSources, type ScraperSource } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth-utils";
import { recordWorkflowRuntimeTransition, upsertWorkflowRuntimeTask } from "@/lib/actions/workflow-runtime";
import { scraperQueue } from "@/lib/scrapers/queue";
import { initializeScraperQueue, scraperRuntime } from "@/lib/scrapers/runtime";
import { and, eq, inArray } from "drizzle-orm";

initializeScraperQueue();

type ScraperWorkflowPriority = "critical" | "high" | "medium" | "low";

export interface ScraperRunWorkflowResult {
	success: boolean;
	sourceId: string;
	jobId?: string;
	state: "queued" | "duplicate_active" | "blocked_disabled" | "not_found" | "error";
	error?: string;
}

export interface ScraperSourceHealthWorkflowResult {
	success: boolean;
	sourceId: string;
	state: "healthy" | "stale" | "degraded" | "failing" | "disabled" | "not_found" | "error";
	error?: string;
}

export async function startScraperSourceRunWorkflow(
	sourceId: string,
	options: { priority?: 1 | 2 | 3; reason?: string } = {}
): Promise<ScraperRunWorkflowResult> {
	const actorId = await requireWorkflowActor();
	const source = await db.query.scraperSources.findFirst({
		where: eq(scraperSources.id, sourceId),
	});

	if (!source) {
		return { success: false, sourceId, state: "not_found", error: "Source not found" };
	}

	if (!source.enabled) {
		await recordSourceWorkflow({
			source,
			actorId,
			toState: "blocked_disabled",
			reason: options.reason ?? "Manual scraper run blocked because the source is disabled.",
			priority: "medium",
			terminal: true,
		});
		return {
			success: false,
			sourceId,
			state: "blocked_disabled",
			error: "Source is disabled",
		};
	}

	const activeJob = await findActiveScraperJob(source.id);
	if (activeJob) {
		const workflow = await recordSourceWorkflow({
			source,
			actorId,
			toState: "duplicate_active",
			reason: options.reason ?? "Manual scraper run requires review because this source already has an active job.",
			priority: "medium",
			jobId: activeJob.id,
		});
		await upsertWorkflowRuntimeTask({
			workflowInstanceId: workflow.id,
			taskKey: `scraper-duplicate-review:${source.id}`,
			title: `Review duplicate scraper run for ${source.name}`,
			description: `Active job ${activeJob.id} is already ${activeJob.status}. Confirm whether to wait, cancel, or reschedule.`,
			state: "open",
			priority: "medium",
			assignedRole: "operations",
			dueAt: addHours(new Date(), 4),
			metadata: {
				sourceId: source.id,
				activeJobId: activeJob.id,
				activeJobStatus: activeJob.status,
			},
		});
		return {
			success: false,
			sourceId,
			jobId: activeJob.id,
			state: "duplicate_active",
			error: "Source already has an active scraper job",
		};
	}

	try {
		const jobId = await scraperQueue.add({
			sourceId: source.id,
			sourceKey: source.sourceId,
			sourceName: source.name,
			priority: options.priority ?? (source.priority as 1 | 2 | 3),
			tier: source.scheduleTier,
		});
		const workflow = await recordSourceWorkflow({
			source,
			actorId,
			toState: "queued",
			reason: options.reason ?? "Manual scraper run queued by operator.",
			priority: mapSourcePriority(source.priority),
			jobId,
		});
		await upsertWorkflowRuntimeTask({
			workflowInstanceId: workflow.id,
			taskKey: `monitor-scraper-run:${jobId}`,
			title: `Monitor scraper run for ${source.name}`,
			description: "Confirm the scraper run completes, produces fresh discovery data, or raises a remediation exception.",
			state: "open",
			priority: mapSourcePriority(source.priority),
			assignedRole: "operations",
			dueAt: addHours(new Date(), source.scheduleTier === 1 ? 2 : source.scheduleTier === 2 ? 4 : 8),
			metadata: {
				sourceId: source.id,
				sourceKey: source.sourceId,
				jobId,
				scheduleTier: source.scheduleTier,
			},
		});
		revalidateSourcePages();
		return { success: true, sourceId, jobId, state: "queued" };
	} catch (error) {
		await recordSourceWorkflow({
			source,
			actorId,
			toState: "queue_failed",
			reason: error instanceof Error ? error.message : "Failed to queue scraper run.",
			priority: "high",
		});
		return {
			success: false,
			sourceId,
			state: "error",
			error: error instanceof Error ? error.message : "Failed to queue scraper run",
		};
	}
}

export async function startSelectedScraperSourceRunsWorkflow(
	sourceIds: string[],
	options: { priority?: 1 | 2 | 3; reason?: string } = {}
): Promise<{
	success: boolean;
	results: ScraperRunWorkflowResult[];
	summary: { succeeded: number; failed: number };
}> {
	const uniqueSourceIds = [...new Set(sourceIds)];
	const results: ScraperRunWorkflowResult[] = [];
	for (const sourceId of uniqueSourceIds) {
		results.push(await startScraperSourceRunWorkflow(sourceId, options));
	}

	const succeeded = results.filter((result) => result.success).length;
	const failed = results.length - succeeded;
	return {
		success: failed === 0,
		results,
		summary: { succeeded, failed },
	};
}

export async function transitionScraperSourceEnabledWorkflow(
	sourceId: string,
	enabled: boolean,
	reason = enabled ? "Source enabled for scheduled discovery." : "Source disabled by operator."
): Promise<{ success: boolean; source?: ScraperSource; error?: string }> {
	const actorId = await requireWorkflowActor();
	const source = await db.query.scraperSources.findFirst({
		where: eq(scraperSources.id, sourceId),
	});
	if (!source) {
		return { success: false, error: "Source not found" };
	}

	const [updated] = await db.update(scraperSources).set({
		enabled,
		healthStatus: enabled ? "unknown" : "disabled",
		updatedAt: new Date(),
	}).where(eq(scraperSources.id, sourceId)).returning();

	if (!updated) {
		return { success: false, error: "Failed to update source" };
	}

	await recordSourceWorkflow({
		source: updated,
		actorId,
		fromState: source.enabled ? "enabled" : "disabled",
		toState: enabled ? "enabled" : "disabled",
		reason,
		priority: enabled ? "medium" : "high",
		terminal: !enabled,
		metadata: {
			previousEnabled: source.enabled,
			nextEnabled: enabled,
			previousHealthStatus: source.healthStatus,
			nextHealthStatus: updated.healthStatus,
		},
	});

	revalidateSourcePages();
	return { success: true, source: updated };
}

export async function cancelScraperJobWorkflow(
	jobId: string,
	reason = "Operator cancelled scraper job."
): Promise<{ success: boolean; jobId: string; error?: string }> {
	const actorId = await requireWorkflowActor();
	const job = await db.query.scraperJobs.findFirst({
		where: eq(scraperJobs.id, jobId),
	});
	if (!job) {
		return { success: false, jobId, error: "Scraper job not found" };
	}

	const queueCancelled = await scraperQueue.cancel(jobId);
	const runtimeCancelled = scraperRuntime.cancel(jobId);
	if (!queueCancelled && !runtimeCancelled) {
		return { success: false, jobId, error: "Job is not cancellable" };
	}

	await recordWorkflowRuntimeTransition({
		workflowKey: "scraper_source_run",
		subjectType: "scraper_job",
		subjectId: jobId,
		fromState: job.status,
		toState: "cancelled",
		eventType: "scraper_job_cancelled",
		actorId,
		reason,
		priority: "medium",
		assignedRole: "operations",
		visibility: "internal",
		authorityPolicy: {
			requiredRoles: ["operations", "admin"],
			escalationRole: "operations",
		},
		metadata: {
			sourceId: job.sourceId,
			sourceKey: job.sourceKey,
			sourceName: job.sourceName,
			jobId,
		},
		terminal: true,
		actionUrl: "/opportunities/sources",
	});

	revalidateSourcePages();
	return { success: true, jobId };
}

export async function evaluateScraperSourceHealthWorkflow(
	sourceId: string,
	options: { now?: Date; reason?: string } = {}
): Promise<ScraperSourceHealthWorkflowResult> {
	const actorId = await requireWorkflowActor();
	const source = await db.query.scraperSources.findFirst({
		where: eq(scraperSources.id, sourceId),
	});
	if (!source) {
		return { success: false, sourceId, state: "not_found", error: "Source not found" };
	}

	const now = options.now ?? new Date();
	const evaluation = evaluateSourceHealth(source, now);
	try {
		const [updated] = await db.update(scraperSources).set({
			healthStatus: evaluation.sourceHealthStatus,
			updatedAt: now,
		}).where(eq(scraperSources.id, source.id)).returning();

		const workflow = await recordWorkflowRuntimeTransition({
			workflowKey: "scraper_source_health",
			subjectType: "scraper_source",
			subjectId: source.id,
			fromState: source.healthStatus,
			toState: evaluation.workflowState,
			eventType: `scraper_source_health_${evaluation.workflowState}`,
			actorId,
			reason: options.reason ?? evaluation.reason,
			priority: evaluation.priority,
			assignedRole: evaluation.workflowState === "healthy" || evaluation.workflowState === "disabled"
				? null
				: "operations",
			dueAt: evaluation.dueAt,
			visibility: "internal",
			authorityPolicy: {
				requiredRoles: ["operations", "admin"],
				escalationRole: "operations",
			},
			metadata: {
				sourceId: source.id,
				sourceKey: source.sourceId,
				sourceName: source.name,
				scheduleTier: source.scheduleTier,
				lastRunAt: source.lastRunAt?.toISOString() ?? null,
				lastSuccessAt: source.lastSuccessAt?.toISOString() ?? null,
				successRate: source.successRate,
				failedRuns: source.failedRuns,
				dataQualityScore: source.dataQualityScore,
				freshnessSlaHours: evaluation.freshnessSlaHours,
				sourceHealthStatus: evaluation.sourceHealthStatus,
			},
			terminal: evaluation.workflowState === "healthy" || evaluation.workflowState === "disabled",
			actionUrl: "/opportunities/sources",
		});

		if (evaluation.workflowState !== "healthy" && evaluation.workflowState !== "disabled") {
			await upsertWorkflowRuntimeTask({
				workflowInstanceId: workflow.id,
				taskKey: `scraper-source-health:${source.id}`,
				title: `Remediate ${evaluation.workflowState} source: ${source.name}`,
				description: options.reason ?? evaluation.reason,
				state: "open",
				priority: evaluation.priority,
				assignedRole: "operations",
				dueAt: evaluation.dueAt,
				metadata: {
					sourceId: source.id,
					workflowState: evaluation.workflowState,
					sourceHealthStatus: evaluation.sourceHealthStatus,
				},
			});
		}

		revalidateSourcePages();
		return {
			success: true,
			sourceId: source.id,
			state: evaluation.workflowState,
		};
	} catch (error) {
		return {
			success: false,
			sourceId,
			state: "error",
			error: error instanceof Error ? error.message : "Failed to evaluate source health",
		};
	}
}

async function requireWorkflowActor(): Promise<string> {
	const userId = await getCurrentUserId();
	if (!userId) {
		throw new Error("Unauthorized");
	}
	return userId;
}

async function findActiveScraperJob(sourceId: string) {
	return db.query.scraperJobs.findFirst({
		where: and(
			eq(scraperJobs.sourceId, sourceId),
			inArray(scraperJobs.status, ["queued", "retrying", "running"])
		),
		orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
	});
}

async function recordSourceWorkflow(params: {
	source: ScraperSource;
	actorId: string;
	fromState?: string;
	toState: string;
	reason: string;
	priority: ScraperWorkflowPriority;
	jobId?: string;
	terminal?: boolean;
	metadata?: Record<string, unknown>;
}) {
	return recordWorkflowRuntimeTransition({
		workflowKey: params.toState === "enabled" || params.toState === "disabled"
			? "scraper_source_governance"
			: "scraper_source_run",
		subjectType: "scraper_source",
		subjectId: params.source.id,
		fromState: params.fromState ?? params.source.healthStatus,
		toState: params.toState,
		eventType: `scraper_source_${params.toState}`,
		actorId: params.actorId,
		reason: params.reason,
		priority: params.priority,
		assignedRole: "operations",
		dueAt: params.toState === "queue_failed" || params.toState === "duplicate_active"
			? addHours(new Date(), 4)
			: null,
		visibility: "internal",
		authorityPolicy: {
			requiredRoles: ["operations", "admin"],
			escalationRole: "operations",
		},
		metadata: {
			sourceId: params.source.id,
			sourceKey: params.source.sourceId,
			sourceName: params.source.name,
			sourceType: params.source.sourceType,
			scheduleTier: params.source.scheduleTier,
			healthStatus: params.source.healthStatus,
			jobId: params.jobId,
			...(params.metadata ?? {}),
		},
		terminal: params.terminal ?? false,
		actionUrl: "/opportunities/sources",
	});
}

function mapSourcePriority(priority: number | null): ScraperWorkflowPriority {
	if (priority === 1) return "critical";
	if (priority === 2) return "high";
	return "medium";
}

function evaluateSourceHealth(source: ScraperSource, now: Date): {
	workflowState: ScraperSourceHealthWorkflowResult["state"];
	sourceHealthStatus: ScraperSource["healthStatus"];
	reason: string;
	priority: ScraperWorkflowPriority;
	dueAt: Date | null;
	freshnessSlaHours: number;
} {
	const freshnessSlaHours = source.scheduleTier === 1 ? 8 : source.scheduleTier === 2 ? 16 : 32;
	if (!source.enabled) {
		return {
			workflowState: "disabled",
			sourceHealthStatus: "disabled",
			reason: "Source is disabled and excluded from freshness evaluation.",
			priority: "low",
			dueAt: null,
			freshnessSlaHours,
		};
	}

	const lastSuccessAt = source.lastSuccessAt ?? source.lastRunAt;
	const hoursSinceSuccess = lastSuccessAt
		? (now.getTime() - lastSuccessAt.getTime()) / (60 * 60 * 1000)
		: Number.POSITIVE_INFINITY;
	if ((source.failedRuns ?? 0) >= 3 || (source.successRate !== null && source.successRate < 50) || source.healthStatus === "failing") {
		return {
			workflowState: "failing",
			sourceHealthStatus: "failing",
			reason: "Source has repeated failures or low success rate and needs operator remediation.",
			priority: mapSourcePriority(source.priority),
			dueAt: addHours(now, 4),
			freshnessSlaHours,
		};
	}
	if (hoursSinceSuccess > freshnessSlaHours) {
		return {
			workflowState: "stale",
			sourceHealthStatus: "degraded",
			reason: `Source has no successful run inside the ${freshnessSlaHours} hour freshness SLA.`,
			priority: mapSourcePriority(source.priority),
			dueAt: addHours(now, 6),
			freshnessSlaHours,
		};
	}
	if (source.dataQualityScore !== null && source.dataQualityScore < 60) {
		return {
			workflowState: "degraded",
			sourceHealthStatus: "degraded",
			reason: "Source data quality is below the 60% remediation threshold.",
			priority: "medium",
			dueAt: addHours(now, 12),
			freshnessSlaHours,
		};
	}
	return {
		workflowState: "healthy",
		sourceHealthStatus: "healthy",
		reason: "Source is inside freshness and quality thresholds.",
		priority: "low",
		dueAt: null,
		freshnessSlaHours,
	};
}

function addHours(date: Date, hours: number): Date {
	return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function revalidateSourcePages(): void {
	try {
		revalidatePath("/opportunities/sources");
	} catch {
		// Scraper workflows can be exercised from API routes and worker-like proof scripts.
	}
}
