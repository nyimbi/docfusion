/**
 * Scraper Run Progress Component
 *
 * Real-time progress tracking for running scraper jobs.
 * Connects to SSE endpoint for live updates.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
	X,
	Loader2,
	CheckCircle,
	XCircle,
	AlertCircle,
	StopCircle,
	PlayCircle,
	Activity,
	Database,
	Clock,
	TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

// ============================================================================
// Types
// ============================================================================

interface ScraperRunProgressProps {
	jobIds: string[];
	onClose: () => void;
	onComplete?: () => void;
}

interface JobProgress {
	id: string;
	sourceKey: string;
	sourceName: string;
	status: string;
	progress: number;
	pagesScraped: number;
	opportunitiesFound: number;
	error?: string;
	startedAt?: Date;
	completedAt?: Date;
}

// ============================================================================
// Component
// ============================================================================

export function ScraperRunProgress({ jobIds, onClose, onComplete }: ScraperRunProgressProps) {
	const [jobs, setJobs] = React.useState<Map<string, JobProgress>>(new Map());
	const [isConnected, setIsConnected] = React.useState(false);
	const eventSourceRef = React.useRef<EventSource | null>(null);

	// Connect to SSE endpoint
	React.useEffect(() => {
		if (jobIds.length === 0) return;

		// Build URL with all job IDs
		const params = new URLSearchParams();
		params.set("all", "true"); // Watch all events for now

		const url = `/api/scrapers/sse?${params.toString()}`;
		const eventSource = new EventSource(url);
		eventSourceRef.current = eventSource;

		eventSource.onopen = () => {
			setIsConnected(true);
		};

		eventSource.onerror = () => {
			setIsConnected(false);
		};

		// Handle different event types
		const handleEvent = (event: MessageEvent) => {
			try {
				const data = JSON.parse(event.data);

				// Only process events for our jobs
				if (!jobIds.includes(data.job?.id)) return;

				setJobs((prev) => {
					const newJobs = new Map(prev);
					const existing = newJobs.get(data.job.id);

					const baseJob: JobProgress = existing || {
						id: data.job.id,
						sourceKey: data.job.sourceKey,
						sourceName: data.job.sourceName,
						status: "queued",
						progress: 0,
						pagesScraped: 0,
						opportunitiesFound: 0,
					};

					newJobs.set(data.job.id, {
						...baseJob,
						status: data.job.status,
						progress: data.job.progress || 0,
						error: data.job.error,
						startedAt: data.job.startedAt ? new Date(data.job.startedAt) : baseJob.startedAt,
						completedAt: data.job.completedAt ? new Date(data.job.completedAt) : undefined,
					});

					return newJobs;
				});
			} catch (e) {
				console.error("Failed to parse SSE event:", e);
			}
		};

		// Listen to all job event types
		eventSource.addEventListener("job:queued", handleEvent);
		eventSource.addEventListener("job:started", handleEvent);
		eventSource.addEventListener("job:progress", handleEvent);
		eventSource.addEventListener("job:completed", handleEvent);
		eventSource.addEventListener("job:failed", handleEvent);
		eventSource.addEventListener("job:cancelled", handleEvent);
		eventSource.addEventListener("job:status", handleEvent);
		eventSource.addEventListener("connected", () => {
			setIsConnected(true);
		});

		// Initialize jobs from provided IDs
		const initialJobs = new Map<string, JobProgress>();
		for (const id of jobIds) {
			initialJobs.set(id, {
				id,
				sourceKey: "",
				sourceName: "Loading...",
				status: "queued",
				progress: 0,
				pagesScraped: 0,
				opportunitiesFound: 0,
			});
		}
		setJobs(initialJobs);

		// Fetch initial status for each job
		for (const id of jobIds) {
			fetch(`/api/scrapers/run/${id}`)
				.then((res) => res.json())
				.then((data) => {
					if (data.success && data.job) {
						setJobs((prev) => {
							const newJobs = new Map(prev);
							newJobs.set(id, {
								id: data.job.id,
								sourceKey: data.job.sourceKey,
								sourceName: data.job.sourceName,
								status: data.job.status,
								progress: data.job.progress || 0,
								pagesScraped: 0,
								opportunitiesFound: 0,
								error: data.job.error,
								startedAt: data.job.startedAt ? new Date(data.job.startedAt) : undefined,
								completedAt: data.job.completedAt ? new Date(data.job.completedAt) : undefined,
							});
							return newJobs;
						});
					}
				})
				.catch(console.error);
		}

		return () => {
			eventSource.close();
			eventSourceRef.current = null;
		};
	}, [jobIds]);

	// Check if all jobs are complete
	React.useEffect(() => {
		const allComplete = Array.from(jobs.values()).every(
			(job) => job.status === "completed" || job.status === "failed" || job.status === "cancelled"
		);

		if (allComplete && jobs.size > 0 && jobs.size === jobIds.length) {
			// Give a moment for final UI update
			const timer = setTimeout(() => {
				onComplete?.();
			}, 2000);
			return () => clearTimeout(timer);
		}
	}, [jobs, jobIds.length, onComplete]);

	// Handle cancel
	const handleCancel = async (jobId: string) => {
		try {
			await fetch(`/api/scrapers/run/${jobId}/cancel`, { method: "POST" });
		} catch (error) {
			console.error("Failed to cancel job:", error);
		}
	};

	// Calculate summary stats
	const summary = React.useMemo(() => {
		const jobList = Array.from(jobs.values());
		return {
			total: jobList.length,
			running: jobList.filter((j) => j.status === "running").length,
			completed: jobList.filter((j) => j.status === "completed").length,
			failed: jobList.filter((j) => j.status === "failed" || j.status === "cancelled").length,
			queued: jobList.filter((j) => j.status === "queued" || j.status === "retrying").length,
			totalProgress: jobList.reduce((sum, j) => sum + j.progress, 0) / Math.max(jobList.length, 1),
			totalOpportunities: jobList.reduce((sum, j) => sum + j.opportunitiesFound, 0),
		};
	}, [jobs]);

	return (
		<div className="fixed bottom-4 right-4 w-96 bg-card rounded-xl shadow-2xl border overflow-hidden z-50">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b">
				<div className="flex items-center gap-2">
					<Activity className={cn("h-5 w-5", isConnected ? "text-green-500" : "text-muted-foreground")} />
					<span className="font-medium text-foreground">Scraper Progress</span>
					<span className="text-xs text-muted-foreground">
						({summary.running} running)
					</span>
				</div>
				<button
					onClick={onClose}
					className="p-1 rounded-lg hover:bg-muted transition-colors"
				>
					<X className="h-4 w-4 text-muted-foreground" />
				</button>
			</div>

			{/* Summary Stats */}
			<div className="grid grid-cols-4 gap-2 p-3 border-b bg-muted/20">
				<SummaryStat label="Running" value={summary.running} color="text-blue-500" />
				<SummaryStat label="Complete" value={summary.completed} color="text-green-500" />
				<SummaryStat label="Failed" value={summary.failed} color="text-red-500" />
				<SummaryStat label="Queued" value={summary.queued} color="text-muted-foreground" />
			</div>

			{/* Jobs List */}
			<div className="max-h-80 overflow-y-auto">
				{Array.from(jobs.values()).map((job) => (
					<JobProgressRow
						key={job.id}
						job={job}
						onCancel={() => handleCancel(job.id)}
					/>
				))}

				{jobs.size === 0 && (
					<div className="flex items-center justify-center py-8 text-muted-foreground">
						<Loader2 className="h-5 w-5 animate-spin mr-2" />
						Connecting...
					</div>
				)}
			</div>

			{/* Footer */}
			{summary.total > 0 && (
				<div className="px-4 py-2 border-t bg-muted/20">
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<span>Overall Progress</span>
						<span>{Math.round(summary.totalProgress)}%</span>
					</div>
					<div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
						<div
							className="h-full bg-primary transition-all duration-300"
							style={{ width: `${summary.totalProgress}%` }}
						/>
					</div>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Sub-components
// ============================================================================

function SummaryStat({
	label,
	value,
	color,
}: {
	label: string;
	value: number;
	color: string;
}) {
	return (
		<div className="text-center">
			<p className={cn("text-lg font-bold tabular-nums", color)}>{value}</p>
			<p className="text-xs text-muted-foreground">{label}</p>
		</div>
	);
}

function JobProgressRow({
	job,
	onCancel,
}: {
	job: JobProgress;
	onCancel: () => void;
}) {
	const statusConfig: Record<string, {
		icon: React.ComponentType<{ className?: string }>;
		color: string;
		label: string;
	}> = {
		queued: { icon: Clock, color: "text-muted-foreground", label: "Queued" },
		running: { icon: Loader2, color: "text-blue-500", label: "Running" },
		completed: { icon: CheckCircle, color: "text-green-500", label: "Complete" },
		failed: { icon: XCircle, color: "text-red-500", label: "Failed" },
		cancelled: { icon: StopCircle, color: "text-muted-foreground", label: "Cancelled" },
		retrying: { icon: AlertCircle, color: "text-amber-500", label: "Retrying" },
	};

	const status = statusConfig[job.status] || statusConfig.queued;
	const StatusIcon = status.icon;
	const isRunning = job.status === "running";
	const canCancel = job.status === "running" || job.status === "queued";

	return (
		<div className="px-4 py-3 border-b last:border-b-0 hover:bg-muted/20 transition-colors">
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-2">
					<StatusIcon
						className={cn(
							"h-4 w-4",
							status.color,
							isRunning && "animate-spin"
						)}
					/>
					<span className="text-sm font-medium text-foreground truncate max-w-[180px]">
						{job.sourceName}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<span className={cn("text-xs font-medium", status.color)}>
						{status.label}
					</span>
					{canCancel && (
						<button
							onClick={onCancel}
							className="p-1 rounded hover:bg-muted transition-colors"
							title="Cancel"
						>
							<StopCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
						</button>
					)}
				</div>
			</div>

			{/* Progress bar */}
			{isRunning && (
				<div className="mb-2">
					<div className="h-1 bg-muted rounded-full overflow-hidden">
						<div
							className="h-full bg-blue-500 transition-all duration-300"
							style={{ width: `${job.progress}%` }}
						/>
					</div>
				</div>
			)}

			{/* Stats */}
			<div className="flex items-center gap-4 text-xs text-muted-foreground">
				<span className="flex items-center gap-1">
					<Database className="h-3 w-3" />
					{job.pagesScraped} pages
				</span>
				<span className="flex items-center gap-1">
					<TrendingUp className="h-3 w-3" />
					{job.opportunitiesFound} found
				</span>
				{job.progress > 0 && job.progress < 100 && (
					<span>{job.progress}%</span>
				)}
			</div>

			{/* Error message */}
			{job.error && (
				<p className="mt-2 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
					{job.error}
				</p>
			)}
		</div>
	);
}
