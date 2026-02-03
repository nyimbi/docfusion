/**
 * Scraper Job Queue
 *
 * In-memory job queue with concurrency control for serverless environments.
 * Supports priority scheduling, retry logic, and progress callbacks.
 *
 * Architecture:
 * - Max 3 concurrent jobs (configurable)
 * - Priority: tier1 > tier2 > tier3
 * - Exponential backoff retry (3 attempts)
 * - Event-driven progress updates
 *
 * Production path: Replace with Redis + BullMQ for persistence and
 * multi-instance coordination.
 */

import { EventEmitter } from "events";

// UUID v4 generation - inline for serverless compatibility
function uuidv4(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

// ============================================================================
// Types
// ============================================================================

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
	createdAt: Date;
	startedAt?: Date;
	completedAt?: Date;
	error?: string;
	result?: ScraperJobResult;
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
	error?: string;
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
}

export type ProgressCallback = (job: ScraperJob) => void;
export type JobExecutor = (job: ScraperJob) => Promise<ScraperJobResult>;

// ============================================================================
// Queue Events
// ============================================================================

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
	job: ScraperJob;
	timestamp: Date;
}

// ============================================================================
// Scraper Queue Implementation
// ============================================================================

/**
 * In-memory job queue with priority scheduling and retry logic.
 * Singleton pattern ensures single queue instance per process.
 */
class ScraperQueueImpl {
	private config: QueueConfig = {
		maxConcurrent: 3,
		defaultMaxAttempts: 3,
		baseRetryDelayMs: 1000,
		maxRetryDelayMs: 60000,
	};

	private queue: Map<string, ScraperJob> = new Map();
	private running: Set<string> = new Set();
	private events: EventEmitter = new EventEmitter();
	private executor: JobExecutor | null = null;
	private processing = false;

	// -------------------------------------------------------------------------
	// Configuration
	// -------------------------------------------------------------------------

	/**
	 * Configure queue settings
	 */
	configure(config: Partial<QueueConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Set the job executor function
	 */
	setExecutor(executor: JobExecutor): void {
		this.executor = executor;
	}

	// -------------------------------------------------------------------------
	// Job Management
	// -------------------------------------------------------------------------

	/**
	 * Add a job to the queue
	 */
	async add(options: AddJobOptions): Promise<string> {
		const job: ScraperJob = {
			id: uuidv4(),
			sourceId: options.sourceId,
			sourceKey: options.sourceKey,
			sourceName: options.sourceName,
			priority: options.priority ?? 2,
			tier: options.tier ?? 3,
			status: "queued",
			progress: 0,
			attempt: 0,
			maxAttempts: options.maxAttempts ?? this.config.defaultMaxAttempts,
			batchId: options.batchId,
			createdAt: new Date(),
		};

		this.queue.set(job.id, job);
		this.emit("job:queued", job);

		// Trigger processing if not already running
		this.processQueue();

		return job.id;
	}

	/**
	 * Add multiple jobs as a batch
	 */
	async addBatch(jobs: AddJobOptions[]): Promise<string[]> {
		const batchId = uuidv4();
		const jobIds: string[] = [];

		for (const options of jobs) {
			const jobId = await this.add({ ...options, batchId });
			jobIds.push(jobId);
		}

		return jobIds;
	}

	/**
	 * Cancel a job
	 */
	async cancel(jobId: string): Promise<boolean> {
		const job = this.queue.get(jobId);
		if (!job) return false;

		// Can only cancel queued or retrying jobs
		if (job.status === "queued" || job.status === "retrying") {
			job.status = "cancelled";
			job.completedAt = new Date();
			this.emit("job:cancelled", job);
			this.queue.delete(jobId);
			return true;
		}

		// For running jobs, mark as cancelled (executor should check)
		if (job.status === "running") {
			job.status = "cancelled";
			return true;
		}

		return false;
	}

	/**
	 * Cancel all jobs in a batch
	 */
	async cancelBatch(batchId: string): Promise<number> {
		let cancelled = 0;
		for (const job of this.queue.values()) {
			if (job.batchId === batchId) {
				if (await this.cancel(job.id)) {
					cancelled++;
				}
			}
		}
		return cancelled;
	}

	/**
	 * Get job status
	 */
	getStatus(jobId: string): ScraperJob | null {
		return this.queue.get(jobId) ?? null;
	}

	/**
	 * Get all jobs for a batch
	 */
	getBatchJobs(batchId: string): ScraperJob[] {
		return Array.from(this.queue.values())
			.filter(job => job.batchId === batchId);
	}

	/**
	 * Update job progress
	 */
	updateProgress(jobId: string, progress: number): void {
		const job = this.queue.get(jobId);
		if (job && job.status === "running") {
			job.progress = Math.min(100, Math.max(0, progress));
			this.emit("job:progress", job);
		}
	}

	// -------------------------------------------------------------------------
	// Queue Processing
	// -------------------------------------------------------------------------

	/**
	 * Get the next job to process based on priority
	 */
	private getNextJob(): ScraperJob | null {
		const queuedJobs = Array.from(this.queue.values())
			.filter(job => job.status === "queued")
			.sort((a, b) => {
				// Sort by priority (1 > 2 > 3)
				if (a.priority !== b.priority) {
					return a.priority - b.priority;
				}
				// Then by tier (1 > 2 > 3)
				if (a.tier !== b.tier) {
					return a.tier - b.tier;
				}
				// Then by creation time (oldest first)
				return a.createdAt.getTime() - b.createdAt.getTime();
			});

		return queuedJobs[0] ?? null;
	}

	/**
	 * Process the queue - runs continuously while jobs exist
	 */
	private async processQueue(): Promise<void> {
		if (this.processing) return;
		this.processing = true;

		try {
			while (true) {
				// Check if we can run more jobs
				if (this.running.size >= this.config.maxConcurrent) {
					break;
				}

				// Get next job
				const job = this.getNextJob();
				if (!job) {
					if (this.running.size === 0) {
						this.emit("queue:empty", null as any);
					}
					break;
				}

				// Start job execution (non-blocking)
				this.executeJob(job);
			}
		} finally {
			this.processing = false;
		}
	}

	/**
	 * Execute a single job
	 */
	private async executeJob(job: ScraperJob): Promise<void> {
		if (!this.executor) {
			throw new Error("No executor set. Call setExecutor() first.");
		}

		job.status = "running";
		job.attempt++;
		job.startedAt = new Date();
		this.running.add(job.id);
		this.emit("job:started", job);

		try {
			const result = await this.executor(job);

			// Check if cancelled during execution (status can be changed by cancel() method)
			if ((job.status as JobStatus) === "cancelled") {
				this.running.delete(job.id);
				this.queue.delete(job.id);
				return;
			}

			job.result = result;
			job.status = result.success ? "completed" : "failed";
			job.completedAt = new Date();
			job.progress = 100;

			if (result.success) {
				this.emit("job:completed", job);
			} else {
				job.error = result.error;
				await this.handleFailure(job);
			}
		} catch (error) {
			job.error = error instanceof Error ? error.message : String(error);
			job.status = "failed";
			await this.handleFailure(job);
		} finally {
			this.running.delete(job.id);
			// Continue processing queue
			this.processQueue();
		}
	}

	/**
	 * Handle job failure with retry logic
	 */
	private async handleFailure(job: ScraperJob): Promise<void> {
		if (job.attempt < job.maxAttempts) {
			// Calculate exponential backoff delay
			const delay = Math.min(
				this.config.baseRetryDelayMs * Math.pow(2, job.attempt - 1),
				this.config.maxRetryDelayMs
			);

			job.status = "retrying";
			this.emit("job:retrying", job);

			// Schedule retry
			setTimeout(() => {
				if (job.status === "retrying") {
					job.status = "queued";
					this.processQueue();
				}
			}, delay);
		} else {
			job.status = "failed";
			job.completedAt = new Date();
			this.emit("job:failed", job);
			this.queue.delete(job.id);
		}
	}

	// -------------------------------------------------------------------------
	// Event Handling
	// -------------------------------------------------------------------------

	/**
	 * Subscribe to queue events
	 */
	on(event: QueueEventType, callback: (job: ScraperJob) => void): void {
		this.events.on(event, callback);
	}

	/**
	 * Unsubscribe from queue events
	 */
	off(event: QueueEventType, callback: (job: ScraperJob) => void): void {
		this.events.off(event, callback);
	}

	/**
	 * Subscribe to progress updates for a specific job
	 */
	onProgress(callback: ProgressCallback): () => void {
		const handler = (job: ScraperJob) => callback(job);
		this.events.on("job:progress", handler);
		return () => this.events.off("job:progress", handler);
	}

	/**
	 * Emit an event
	 */
	private emit(type: QueueEventType, job: ScraperJob): void {
		const event: QueueEvent = {
			type,
			job,
			timestamp: new Date(),
		};
		this.events.emit(type, job);
		this.events.emit("*", event); // Wildcard for all events
	}

	// -------------------------------------------------------------------------
	// Queue State
	// -------------------------------------------------------------------------

	/**
	 * Get queue statistics
	 */
	getStats(): {
		queued: number;
		running: number;
		completed: number;
		failed: number;
		total: number;
	} {
		const jobs = Array.from(this.queue.values());
		return {
			queued: jobs.filter(j => j.status === "queued" || j.status === "retrying").length,
			running: jobs.filter(j => j.status === "running").length,
			completed: jobs.filter(j => j.status === "completed").length,
			failed: jobs.filter(j => j.status === "failed").length,
			total: jobs.length,
		};
	}

	/**
	 * Get all jobs
	 */
	getAllJobs(): ScraperJob[] {
		return Array.from(this.queue.values());
	}

	/**
	 * Get running jobs
	 */
	getRunningJobs(): ScraperJob[] {
		return Array.from(this.queue.values())
			.filter(job => job.status === "running");
	}

	/**
	 * Clear completed jobs from memory
	 */
	clearCompleted(): number {
		let cleared = 0;
		for (const [id, job] of this.queue.entries()) {
			if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
				this.queue.delete(id);
				cleared++;
			}
		}
		return cleared;
	}

	/**
	 * Reset queue (for testing)
	 */
	reset(): void {
		this.queue.clear();
		this.running.clear();
		this.events.removeAllListeners();
	}
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Global scraper queue instance
 */
export const scraperQueue = new ScraperQueueImpl();

/**
 * Export class for testing
 */
export { ScraperQueueImpl };
