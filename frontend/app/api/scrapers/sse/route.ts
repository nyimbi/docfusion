/**
 * GET /api/scrapers/sse
 *
 * Server-Sent Events endpoint for real-time scraper progress updates.
 *
 * Query parameters:
 * - jobId: (optional) Subscribe to a specific job
 * - batchId: (optional) Subscribe to all jobs in a batch
 * - all: (optional) Subscribe to all queue events
 *
 * Events:
 * - job:queued - Job added to queue
 * - job:started - Job execution started
 * - job:progress - Job progress update (includes percentage)
 * - job:completed - Job finished successfully
 * - job:failed - Job failed
 * - job:retrying - Job being retried after failure
 * - job:cancelled - Job was cancelled
 * - queue:empty - Queue has no more jobs
 *
 * Event data format:
 * {
 *   type: string;
 *   job: ScraperJob;
 *   timestamp: string;
 * }
 */

import { NextRequest } from "next/server";
import { scraperQueue, type ScraperJob, type QueueEventType } from "@/lib/scrapers/queue";

// Event types we stream
const STREAM_EVENTS: QueueEventType[] = [
	"job:queued",
	"job:started",
	"job:progress",
	"job:completed",
	"job:failed",
	"job:retrying",
	"job:cancelled",
	"queue:empty",
];

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const jobId = searchParams.get("jobId");
	const batchId = searchParams.get("batchId");
	const all = searchParams.get("all") === "true";

	// Create a readable stream for SSE
	const stream = new ReadableStream({
		start(controller) {
			// Keep track of handlers for cleanup
			const handlers: Map<QueueEventType, (job: ScraperJob) => void> = new Map();

			// Helper to send SSE event
			const sendEvent = (type: string, job: ScraperJob) => {
				const data = JSON.stringify({
					type,
					job,
					timestamp: new Date().toISOString(),
				});

				try {
					controller.enqueue(`event: ${type}\ndata: ${data}\n\n`);
				} catch (error) {
					// Stream closed, clean up
					cleanup();
				}
			};

			// Helper to check if we should send this event
			const shouldSendEvent = (job: ScraperJob | null): boolean => {
				if (!job) return false;
				if (all) return true;
				if (jobId && job.id === jobId) return true;
				if (batchId && job.batchId === batchId) return true;
				return false;
			};

			// Set up event handlers
			for (const eventType of STREAM_EVENTS) {
				const handler = (job: ScraperJob) => {
					if (shouldSendEvent(job)) {
						sendEvent(eventType, job);
					}
				};
				handlers.set(eventType, handler);
				scraperQueue.on(eventType, handler);
			}

			// Send initial connection event
			const initEvent = JSON.stringify({
				type: "connected",
				jobId,
				batchId,
				all,
				timestamp: new Date().toISOString(),
			});
			controller.enqueue(`event: connected\ndata: ${initEvent}\n\n`);

			// If watching a specific job, send its current state
			if (jobId) {
				const job = scraperQueue.getStatus(jobId);
				if (job) {
					sendEvent("job:status", job);
				}
			}

			// If watching a batch, send current state of all jobs
			if (batchId) {
				const jobs = scraperQueue.getBatchJobs(batchId);
				for (const job of jobs) {
					sendEvent("job:status", job);
				}
			}

			// Send heartbeat every 30 seconds to keep connection alive
			const heartbeat = setInterval(() => {
				try {
					controller.enqueue(`: heartbeat\n\n`);
				} catch {
					cleanup();
				}
			}, 30000);

			// Cleanup function
			const cleanup = () => {
				clearInterval(heartbeat);
				for (const [eventType, handler] of handlers) {
					scraperQueue.off(eventType, handler);
				}
				handlers.clear();
			};

			// Handle stream close/abort
			request.signal.addEventListener("abort", () => {
				cleanup();
				try {
					controller.close();
				} catch {
					// Already closed
				}
			});
		},
	});

	// Return SSE response
	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			"Connection": "keep-alive",
			"X-Accel-Buffering": "no", // Disable nginx buffering
		},
	});
}

// Disable body parsing for SSE
export const dynamic = "force-dynamic";
