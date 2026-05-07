/**
 * Durable Scraper Job Queue
 *
 * PostgreSQL-backed queue with row-level claiming, retry scheduling, and
 * leases. This replaces process-local queue state so queued/running jobs
 * survive app restarts and multiple app instances can safely compete for work.
 */

import { EventEmitter } from "events";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { scraperJobs } from "@/lib/db/schema-scraper";

function uuidv4(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}

	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

export type JobStatus =
	| "queued"
	| "running"
	| "completed"
	| "failed"
	| "cancelled"
	| "retrying";

export type JobPriority = 1 | 2 | 3;

export interface ScraperJob {
	id: string;
	sourceId: string;
	sourceKey: string;
	sourceName: string;
	priority: JobPriority;
	tier: number;
	status: JobStatus;
	progress: number;
	attempt: number;
	maxAttempts: number;
	batchId?: string;
	runDbId?: string | null;
	createdAt: Date;
	startedAt?: Date | null;
	completedAt?: Date | null;
	error?: string | null;
	result?: ScraperJobResult | null;
	lockedBy?: string | null;
	lockedAt?: Date | null;
	leaseExpiresAt?: Date | null;
	nextRunAt?: Date | null;
	updatedAt?: Date | null;
}

export interface ScraperJobResult {
	runId: string;
	opportunitiesFound: number;
	opportunitiesNew: number;
	opportunitiesUpdated: number;
	opportunitiesSkipped: number;
	opportunitiesFailed: number;
	pagesScraped: number;
	durationSeconds: number;
	success: boolean;
	partial?: boolean;
	error?: string;
	warnings?: string[];
}

export interface AddJobOptions {
	sourceId: string;
	sourceKey: string;
	sourceName: string;
	priority?: JobPriority;
	tier?: number;
	batchId?: string;
	maxAttempts?: number;
}

export interface QueueConfig {
	maxConcurrent: number;
	defaultMaxAttempts: number;
	baseRetryDelayMs: number;
	maxRetryDelayMs: number;
	leaseMs: number;
	maxRetainedTerminalJobs: number;
}

export type ProgressCallback = (job: ScraperJob) => void;
export type JobExecutor = (job: ScraperJob) => Promise<ScraperJobResult>;

export type QueueEventType =
	| "job:queued"
	| "job:started"
	| "job:progress"
	| "job:completed"
	| "job:failed"
	| "job:retrying"
	| "job:cancelled"
	| "queue:empty"
	| "queue:full";

export interface QueueEvent {
	type: QueueEventType;
	job: ScraperJob | null;
	timestamp: Date;
}

class ScraperQueueImpl {
	private config: QueueConfig = {
		maxConcurrent: 3,
		defaultMaxAttempts: 3,
		baseRetryDelayMs: 1000,
		maxRetryDelayMs: 60000,
		leaseMs: 30 * 60 * 1000,
		maxRetainedTerminalJobs: 500,
	};

	private running: Set<string> = new Set();
	private events: EventEmitter = new EventEmitter();
	private executor: JobExecutor | null = null;
	private processing = false;
	private workerId = `scraper-${process.pid}-${uuidv4()}`;

	configure(config: Partial<QueueConfig>): void {
		this.config = { ...this.config, ...config };
	}

	setExecutor(executor: JobExecutor): void {
		this.executor = executor;
		if (this.shouldStartWorker()) {
			this.processQueue();
		}
	}

	async add(options: AddJobOptions): Promise<string> {
		const priority = this.normalizePriority(options.priority);
		const tier = this.normalizeTier(options.tier);
		const maxAttempts = Math.max(
			1,
			Math.min(10, Math.floor(options.maxAttempts ?? this.config.defaultMaxAttempts)),
		);

		const [row] = await db
			.insert(scraperJobs)
			.values({
				sourceId: options.sourceId,
				sourceKey: options.sourceKey,
				sourceName: options.sourceName,
				priority,
				tier,
				status: "queued",
				progress: 0,
				attempt: 0,
				maxAttempts,
				batchId: options.batchId,
				nextRunAt: new Date(),
			})
			.returning();

		const job = this.toJob(row);
		this.emit("job:queued", job);
		this.processQueue();
		return job.id;
	}

	async addBatch(jobs: AddJobOptions[]): Promise<string[]> {
		const batchId = uuidv4();
		const jobIds: string[] = [];

		for (const options of jobs) {
			const jobId = await this.add({ ...options, batchId });
			jobIds.push(jobId);
		}

		return jobIds;
	}

	async cancel(jobId: string): Promise<boolean> {
		const [cancelled] = await db
			.update(scraperJobs)
			.set({
				status: "cancelled",
				completedAt: new Date(),
				leaseExpiresAt: null,
				lockedBy: null,
				lockedAt: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(scraperJobs.id, jobId),
					inArray(scraperJobs.status, ["queued", "retrying", "running"]),
				)
			)
			.returning();

		if (!cancelled) return false;
		const job = this.toJob(cancelled);
		this.emit("job:cancelled", job);
		return true;
	}

	async cancelBatch(batchId: string): Promise<number> {
		const rows = await db
			.update(scraperJobs)
			.set({
				status: "cancelled",
				completedAt: new Date(),
				leaseExpiresAt: null,
				lockedBy: null,
				lockedAt: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(scraperJobs.batchId, batchId),
					inArray(scraperJobs.status, ["queued", "retrying", "running"]),
				)
			)
			.returning();

		for (const row of rows) {
			this.emit("job:cancelled", this.toJob(row));
		}
		return rows.length;
	}

	async getStatus(jobId: string): Promise<ScraperJob | null> {
		const row = await db.query.scraperJobs.findFirst({
			where: eq(scraperJobs.id, jobId),
		});
		return row ? this.toJob(row) : null;
	}

	async getBatchJobs(batchId: string): Promise<ScraperJob[]> {
		const rows = await db
			.select()
			.from(scraperJobs)
			.where(eq(scraperJobs.batchId, batchId))
			.orderBy(scraperJobs.createdAt);
		return rows.map((row) => this.toJob(row));
	}

	updateProgress(jobId: string, progress: number): void {
		void this.setJobProgress(jobId, progress);
	}

	async setJobProgress(jobId: string, progress: number): Promise<void> {
		const clamped = Math.min(100, Math.max(0, progress));
		const [row] = await db
			.update(scraperJobs)
			.set({
				progress: clamped,
				leaseExpiresAt: new Date(Date.now() + this.config.leaseMs),
				updatedAt: new Date(),
			})
			.where(and(eq(scraperJobs.id, jobId), eq(scraperJobs.status, "running")))
			.returning();

		if (row) {
			this.emit("job:progress", this.toJob(row));
		}
	}

	async attachRun(jobId: string, runDbId: string): Promise<void> {
		await db
			.update(scraperJobs)
			.set({ runDbId, updatedAt: new Date() })
			.where(eq(scraperJobs.id, jobId));
	}

	async isCancelled(jobId: string): Promise<boolean> {
		const row = await db.query.scraperJobs.findFirst({
			where: eq(scraperJobs.id, jobId),
			columns: { status: true },
		});
		return row?.status === "cancelled";
	}

	private async processQueue(): Promise<void> {
		if (!this.executor || this.processing) return;
		this.processing = true;

		try {
			await this.recoverExpiredLeases();

			while (this.running.size < this.config.maxConcurrent) {
				const job = await this.claimNextJob();
				if (!job) {
					if (this.running.size === 0) {
						this.emit("queue:empty", null);
					}
					break;
				}

				void this.executeJob(job);
			}
		} finally {
			this.processing = false;
		}
	}

	private async executeJob(job: ScraperJob): Promise<void> {
		if (!this.executor) {
			throw new Error("No executor set. Call setExecutor() first.");
		}

		this.running.add(job.id);
		this.emit("job:started", job);

		try {
			const result = await this.executor(job);
			const current = await this.getStatus(job.id);

			if (current?.status === "cancelled") {
				this.running.delete(job.id);
				this.emit("job:cancelled", current);
				return;
			}

			if (result.success) {
				const [completed] = await db
					.update(scraperJobs)
					.set({
						status: "completed",
						progress: 100,
						result: result as unknown as Record<string, unknown>,
						error: null,
						completedAt: new Date(),
						leaseExpiresAt: null,
						lockedBy: null,
						lockedAt: null,
						updatedAt: new Date(),
					})
					.where(eq(scraperJobs.id, job.id))
					.returning();
				if (completed) this.emit("job:completed", this.toJob(completed));
			} else {
				await this.handleFailure(job.id, result.error || "Scraper job failed", result);
			}
		} catch (error) {
			await this.handleFailure(
				job.id,
				error instanceof Error ? error.message : String(error),
			);
		} finally {
			this.running.delete(job.id);
			void this.trimTerminalJobs();
			void this.processQueue();
		}
	}

	private async handleFailure(
		jobId: string,
		error: string,
		result?: ScraperJobResult
	): Promise<void> {
		const current = await this.getStatus(jobId);
		if (!current || current.status === "cancelled") {
			if (current) this.emit("job:cancelled", current);
			return;
		}

		if (current.attempt < current.maxAttempts) {
			const delay = Math.min(
				this.config.baseRetryDelayMs * Math.pow(2, current.attempt - 1),
				this.config.maxRetryDelayMs,
			);
			const [retrying] = await db
				.update(scraperJobs)
				.set({
					status: "retrying",
					error,
					result: result as unknown as Record<string, unknown> | undefined,
					nextRunAt: new Date(Date.now() + delay),
					leaseExpiresAt: null,
					lockedBy: null,
					lockedAt: null,
					updatedAt: new Date(),
				})
				.where(eq(scraperJobs.id, jobId))
				.returning();

			if (retrying) this.emit("job:retrying", this.toJob(retrying));
			setTimeout(() => void this.processQueue(), delay);
			return;
		}

		const [failed] = await db
			.update(scraperJobs)
			.set({
				status: "failed",
				error,
				result: result as unknown as Record<string, unknown> | undefined,
				completedAt: new Date(),
				leaseExpiresAt: null,
				lockedBy: null,
				lockedAt: null,
				updatedAt: new Date(),
			})
			.where(eq(scraperJobs.id, jobId))
			.returning();

		if (failed) this.emit("job:failed", this.toJob(failed));
	}

	private async recoverExpiredLeases(): Promise<void> {
		await db.execute(sql`
			UPDATE scraper_jobs
			SET
				status = 'retrying',
				next_run_at = now(),
				lease_expires_at = NULL,
				locked_by = NULL,
				locked_at = NULL,
				error = COALESCE(error, 'Worker lease expired'),
				updated_at = now()
			WHERE status = 'running'
				AND lease_expires_at IS NOT NULL
				AND lease_expires_at < now()
				AND attempt < max_attempts
		`);

		await db.execute(sql`
			UPDATE scraper_jobs
			SET
				status = 'failed',
				completed_at = now(),
				lease_expires_at = NULL,
				locked_by = NULL,
				locked_at = NULL,
				error = COALESCE(error, 'Worker lease expired after maximum attempts'),
				updated_at = now()
			WHERE status = 'running'
				AND lease_expires_at IS NOT NULL
				AND lease_expires_at < now()
				AND attempt >= max_attempts
		`);
	}

	private async claimNextJob(): Promise<ScraperJob | null> {
		const claimed = await db.execute(sql`
			WITH candidate AS (
				SELECT id
				FROM scraper_jobs
				WHERE status IN ('queued', 'retrying')
					AND next_run_at <= now()
				ORDER BY priority ASC, tier ASC, created_at ASC
				FOR UPDATE SKIP LOCKED
				LIMIT 1
			)
			UPDATE scraper_jobs
			SET
				status = 'running',
				attempt = attempt + 1,
				started_at = COALESCE(started_at, now()),
				locked_by = ${this.workerId},
				locked_at = now(),
				lease_expires_at = now() + (${this.config.leaseMs} * interval '1 millisecond'),
				updated_at = now()
			FROM candidate
			WHERE scraper_jobs.id = candidate.id
			RETURNING
				scraper_jobs.id,
				scraper_jobs.source_id,
				scraper_jobs.source_key,
				scraper_jobs.source_name,
				scraper_jobs.priority,
				scraper_jobs.tier,
				scraper_jobs.status,
				scraper_jobs.progress,
				scraper_jobs.attempt,
				scraper_jobs.max_attempts,
				scraper_jobs.batch_id,
				scraper_jobs.run_db_id,
				scraper_jobs.error,
				scraper_jobs.result,
				scraper_jobs.locked_by,
				scraper_jobs.locked_at,
				scraper_jobs.lease_expires_at,
				scraper_jobs.next_run_at,
				scraper_jobs.created_at,
				scraper_jobs.started_at,
				scraper_jobs.completed_at,
				scraper_jobs.updated_at
		`) as { rows?: unknown[] };

		const row = claimed.rows?.[0];
		return row ? this.toJob(row) : null;
	}

	on(event: QueueEventType, callback: (job: ScraperJob | null) => void): void {
		this.events.on(event, callback);
	}

	off(event: QueueEventType, callback: (job: ScraperJob | null) => void): void {
		this.events.off(event, callback);
	}

	onProgress(callback: ProgressCallback): () => void {
		const handler = (job: ScraperJob | null) => {
			if (job) callback(job);
		};
		this.events.on("job:progress", handler);
		return () => this.events.off("job:progress", handler);
	}

	private emit(type: QueueEventType, job: ScraperJob | null): void {
		const event: QueueEvent = {
			type,
			job,
			timestamp: new Date(),
		};
		this.events.emit(type, job);
		this.events.emit("*", event);
	}

	async getStats(): Promise<{
		queued: number;
		running: number;
		completed: number;
		failed: number;
		total: number;
	}> {
		const rows = await db
			.select({
				status: scraperJobs.status,
				count: sql<number>`count(*)::int`,
			})
			.from(scraperJobs)
			.groupBy(scraperJobs.status);

		const stats = { queued: 0, running: 0, completed: 0, failed: 0, total: 0 };
		for (const row of rows) {
			const count = Number(row.count ?? 0);
			stats.total += count;
			if (row.status === "queued" || row.status === "retrying") stats.queued += count;
			else if (row.status === "running") stats.running += count;
			else if (row.status === "completed") stats.completed += count;
			else if (row.status === "failed" || row.status === "cancelled") stats.failed += count;
		}
		return stats;
	}

	async getAllJobs(limit = 500): Promise<ScraperJob[]> {
		const rows = await db
			.select()
			.from(scraperJobs)
			.orderBy(sql`${scraperJobs.createdAt} DESC`)
			.limit(limit);
		return rows.map((row) => this.toJob(row));
	}

	async getRunningJobs(): Promise<ScraperJob[]> {
		const rows = await db
			.select()
			.from(scraperJobs)
			.where(eq(scraperJobs.status, "running"))
			.orderBy(scraperJobs.startedAt);
		return rows.map((row) => this.toJob(row));
	}

	async clearCompleted(): Promise<number> {
		const rows = await db
			.delete(scraperJobs)
			.where(inArray(scraperJobs.status, ["completed", "failed", "cancelled"]))
			.returning({ id: scraperJobs.id });
		return rows.length;
	}

	async reset(): Promise<void> {
		await db.delete(scraperJobs);
		this.running.clear();
		this.events.removeAllListeners();
	}

	private async trimTerminalJobs(): Promise<void> {
		if (this.config.maxRetainedTerminalJobs <= 0) return;

		await db.execute(sql`
			DELETE FROM scraper_jobs
			WHERE id IN (
				SELECT id
				FROM scraper_jobs
				WHERE status IN ('completed', 'failed', 'cancelled')
				ORDER BY completed_at DESC NULLS LAST, updated_at DESC
				OFFSET ${this.config.maxRetainedTerminalJobs}
			)
		`);
	}

	private normalizePriority(priority: number | undefined): JobPriority {
		return [1, 2, 3].includes(priority ?? 2) ? (priority as JobPriority) ?? 2 : 2;
	}

	private normalizeTier(tier: number | undefined): number {
		return [1, 2, 3].includes(tier ?? 3) ? tier ?? 3 : 3;
	}

	private shouldStartWorker(): boolean {
		return (
			process.env.NEXT_PHASE !== "phase-production-build" &&
			process.env.npm_lifecycle_event !== "build"
		);
	}

	private toJob(row: unknown): ScraperJob {
		const value = row as Record<string, unknown>;
		const get = <T>(camel: string, snake: string): T | undefined =>
			(value[camel] ?? value[snake]) as T | undefined;

		return {
			id: get<string>("id", "id")!,
			sourceId: get<string>("sourceId", "source_id")!,
			sourceKey: get<string>("sourceKey", "source_key")!,
			sourceName: get<string>("sourceName", "source_name")!,
			priority: this.normalizePriority(get<number>("priority", "priority")),
			tier: get<number>("tier", "tier") ?? 3,
			status: get<JobStatus>("status", "status") ?? "queued",
			progress: get<number>("progress", "progress") ?? 0,
			attempt: get<number>("attempt", "attempt") ?? 0,
			maxAttempts: get<number>("maxAttempts", "max_attempts") ?? this.config.defaultMaxAttempts,
			batchId: get<string>("batchId", "batch_id"),
			runDbId: get<string | null>("runDbId", "run_db_id"),
			error: get<string | null>("error", "error"),
			result: get<ScraperJobResult | null>("result", "result"),
			lockedBy: get<string | null>("lockedBy", "locked_by"),
			lockedAt: get<Date | null>("lockedAt", "locked_at"),
			leaseExpiresAt: get<Date | null>("leaseExpiresAt", "lease_expires_at"),
			nextRunAt: get<Date | null>("nextRunAt", "next_run_at"),
			createdAt: get<Date>("createdAt", "created_at") ?? new Date(),
			startedAt: get<Date | null>("startedAt", "started_at"),
			completedAt: get<Date | null>("completedAt", "completed_at"),
			updatedAt: get<Date | null>("updatedAt", "updated_at"),
		};
	}
}

export const scraperQueue = new ScraperQueueImpl();
export { ScraperQueueImpl };
