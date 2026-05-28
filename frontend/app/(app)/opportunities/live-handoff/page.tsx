"use client";

import * as React from "react";
import Link from "next/link";
import {
	AlertTriangle,
	ArrowLeft,
	CalendarClock,
	CheckSquare,
	ClipboardCheck,
	ExternalLink,
	FileText,
	History,
	RefreshCw,
	UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { LatestLivePursuitHandoffPayload, LatestLivePursuitHandoffTask } from "@/lib/types/latest-live-pursuit-handoff";
import type {
	LatestLivePursuitHandoffTaskActionAuditEvent,
	LatestLivePursuitHandoffTaskActionState,
	LatestLivePursuitHandoffTaskActionStatus,
} from "@/lib/types/latest-live-pursuit-handoff";

type LatestHandoffResponse =
	| { success: true; handoff: LatestLivePursuitHandoffPayload }
	| { success: false; error: string; proofCommand?: string };

const priorityClassName: Record<LatestLivePursuitHandoffTask["priority"], string> = {
	critical: "border-red-500/40 bg-red-500/10 text-red-200",
	high: "border-amber-500/40 bg-amber-500/10 text-amber-100",
	medium: "border-sky-500/30 bg-sky-500/10 text-sky-100",
};

export default function LatestLiveHandoffPage() {
	const [handoff, setHandoff] = React.useState<LatestLivePursuitHandoffPayload | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const [proofCommand, setProofCommand] = React.useState<string | null>(null);
	const [isLoading, setIsLoading] = React.useState(true);
	const [updatingTaskId, setUpdatingTaskId] = React.useState<string | null>(null);
	const [drafts, setDrafts] = React.useState<Record<string, {
		assigneeName: string;
		evidenceNote: string;
		receiptUrl: string;
	}>>({});

	const loadHandoff = React.useCallback(async () => {
		setIsLoading(true);
		setError(null);
		setProofCommand(null);
		try {
			const response = await fetch("/api/opportunities/live-handoff/latest", {
				cache: "no-store",
			});
			const body = await response.json() as LatestHandoffResponse;
			if (!response.ok || !body.success) {
				setHandoff(null);
				setError(body.success ? "Latest live handoff request failed" : body.error);
				setProofCommand(body.success ? null : body.proofCommand ?? null);
				return;
			}
			setHandoff(body.handoff);
			setDrafts(draftsFromActionStates(body.handoff.actionStates));
		} catch (loadError) {
			setHandoff(null);
			setError(loadError instanceof Error ? loadError.message : "Failed to load latest live handoff");
		} finally {
			setIsLoading(false);
		}
	}, []);

	const updateTask = React.useCallback(async (
		task: LatestLivePursuitHandoffTask,
		status: LatestLivePursuitHandoffTaskActionStatus,
	) => {
		const draft = drafts[task.id] ?? { assigneeName: "", evidenceNote: "", receiptUrl: "" };
		setUpdatingTaskId(task.id);
		setError(null);
		try {
			const response = await fetch(`/api/opportunities/live-handoff/latest/tasks/${encodeURIComponent(task.id)}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ status, ...draft }),
			});
			const body = await response.json() as {
				success: true;
				taskState: LatestLivePursuitHandoffTaskActionState;
				auditEvent: LatestLivePursuitHandoffTaskActionAuditEvent;
			} | { success: false; error: string };
			if (!response.ok || !body.success) {
				setError(body.success ? "Task update failed" : body.error);
				return;
			}
			setHandoff((current) => current
				? {
					...current,
					actionStates: {
						...current.actionStates,
						[task.id]: body.taskState,
					},
					actionEvents: [
						body.auditEvent,
						...current.actionEvents.filter((event) => event.eventId !== body.auditEvent.eventId),
					],
				}
				: current);
			setDrafts((current) => ({
				...current,
				[task.id]: {
					assigneeName: body.taskState.assigneeName ?? "",
					evidenceNote: body.taskState.evidenceNote ?? "",
					receiptUrl: body.taskState.receiptUrl ?? "",
				},
			}));
		} catch (updateError) {
			setError(updateError instanceof Error ? updateError.message : "Task update failed");
		} finally {
			setUpdatingTaskId(null);
		}
	}, [drafts]);

	React.useEffect(() => {
		void loadHandoff();
	}, [loadHandoff]);

	return (
		<div className="h-full overflow-y-auto p-6">
			<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
				<div>
					<div className="mb-3">
						<Link href="/opportunities" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
							<ArrowLeft className="h-4 w-4" />
							Opportunities
						</Link>
					</div>
					<h1 className="text-2xl font-bold text-foreground">Live Pursuit Handoff</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Current source-backed response package, review queue, and execution checklist.
					</p>
				</div>
				<Button variant="outline" onClick={() => void loadHandoff()} disabled={isLoading}>
					<RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
					Refresh
				</Button>
			</div>

			{isLoading && (
				<div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
					Loading latest live handoff.
				</div>
			)}

			{!isLoading && error && (
				<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-5">
					<div className="flex items-start gap-3">
						<AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
						<div>
							<h2 className="font-semibold text-foreground">Latest handoff unavailable</h2>
							<p className="mt-1 text-sm text-muted-foreground">{error}</p>
							{proofCommand && (
								<code className="mt-3 block rounded bg-background px-3 py-2 text-xs text-foreground">
									{proofCommand}
								</code>
							)}
						</div>
					</div>
				</div>
			)}

			{!isLoading && handoff && (
				<div className="space-y-6">
					<Summary handoff={handoff} />
					<ExecutionTasks
						tasks={handoff.index.executionPlan.tasks}
						actionStates={handoff.actionStates}
						drafts={drafts}
						updatingTaskId={updatingTaskId}
						onDraftChange={(taskId, field, value) => {
							setDrafts((current) => ({
								...current,
								[taskId]: {
									assigneeName: current[taskId]?.assigneeName ?? "",
									evidenceNote: current[taskId]?.evidenceNote ?? "",
									receiptUrl: current[taskId]?.receiptUrl ?? "",
									[field]: value,
								},
							}));
						}}
						onUpdateTask={updateTask}
					/>
					<RecentActivity events={handoff.actionEvents} />
					<ArtifactPaths handoff={handoff} />
				</div>
			)}
		</div>
	);
}

function Summary({ handoff }: { handoff: LatestLivePursuitHandoffPayload }) {
	const { index } = handoff;
	return (
		<section className="rounded-lg border bg-card p-5">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0">
					<p className="text-xs uppercase tracking-wide text-muted-foreground">Primary pursuit</p>
					<h2 className="mt-1 max-w-4xl text-lg font-semibold text-foreground">
						{index.primaryPursuit.title}
					</h2>
					<div className="mt-3 flex flex-wrap gap-2 text-xs">
						<Pill icon={ClipboardCheck}>Run {index.runId}</Pill>
						<Pill icon={FileText}>{index.artifactCount} artifacts</Pill>
						<Pill icon={CheckSquare}>{index.executionPlan.taskCount} tasks</Pill>
						<Pill icon={AlertTriangle}>{index.executionPlan.criticalTaskCount} critical</Pill>
						{index.primaryPursuit.deadline && (
							<Pill icon={CalendarClock}>{index.primaryPursuit.deadlineUrgency} deadline {index.primaryPursuit.deadline}</Pill>
						)}
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					{index.primaryPursuit.portalUrl && (
						<Button variant="outline" size="sm" asChild>
							<a href={index.primaryPursuit.portalUrl} target="_blank" rel="noreferrer">
								<ExternalLink className="h-4 w-4" />
								Portal
							</a>
						</Button>
					)}
					{index.primaryPursuit.documentUrl && (
						<Button variant="outline" size="sm" asChild>
							<a href={index.primaryPursuit.documentUrl} target="_blank" rel="noreferrer">
								<FileText className="h-4 w-4" />
								Source
							</a>
						</Button>
					)}
				</div>
			</div>
		</section>
	);
}

function ExecutionTasks({
	tasks,
	actionStates,
	drafts,
	updatingTaskId,
	onDraftChange,
	onUpdateTask,
}: {
	tasks: LatestLivePursuitHandoffTask[];
	actionStates: Record<string, LatestLivePursuitHandoffTaskActionState>;
	drafts: Record<string, { assigneeName: string; evidenceNote: string; receiptUrl: string }>;
	updatingTaskId: string | null;
	onDraftChange: (
		taskId: string,
		field: "assigneeName" | "evidenceNote" | "receiptUrl",
		value: string,
	) => void;
	onUpdateTask: (
		task: LatestLivePursuitHandoffTask,
		status: LatestLivePursuitHandoffTaskActionStatus,
	) => void;
}) {
	return (
		<section>
			<div className="mb-3 flex items-center gap-2">
				<CheckSquare className="h-5 w-5 text-foreground" />
				<h2 className="text-lg font-semibold text-foreground">Execution Checklist</h2>
			</div>
			<div className="grid gap-3">
				{tasks.map((task) => (
					<TaskCard
						key={task.id}
						task={task}
						actionState={actionStates[task.id]}
						draft={drafts[task.id] ?? { assigneeName: "", evidenceNote: "", receiptUrl: "" }}
						isUpdating={updatingTaskId === task.id}
						onDraftChange={onDraftChange}
						onUpdateTask={onUpdateTask}
					/>
				))}
			</div>
		</section>
	);
}

function TaskCard({
	task,
	actionState,
	draft,
	isUpdating,
	onDraftChange,
	onUpdateTask,
}: {
	task: LatestLivePursuitHandoffTask;
	actionState: LatestLivePursuitHandoffTaskActionState | undefined;
	draft: { assigneeName: string; evidenceNote: string; receiptUrl: string };
	isUpdating: boolean;
	onDraftChange: (
		taskId: string,
		field: "assigneeName" | "evidenceNote" | "receiptUrl",
		value: string,
	) => void;
	onUpdateTask: (
		task: LatestLivePursuitHandoffTask,
		status: LatestLivePursuitHandoffTaskActionStatus,
	) => void;
}) {
	const status = actionState?.status ?? task.status;
	return (
		<article className="rounded-lg border bg-card p-4">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<div className="mb-2 flex flex-wrap items-center gap-2">
									<span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", priorityClassName[task.priority])}>
										{task.priority}
									</span>
									<span className="text-xs text-muted-foreground">{task.id}</span>
									<span className="text-xs text-muted-foreground">{task.sourceKind}</span>
									{task.dueLabel && <span className="text-xs text-muted-foreground">due {task.dueLabel}</span>}
									<span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
										{status}
									</span>
								</div>
								<h3 className="text-sm font-medium leading-6 text-foreground">{task.title}</h3>
								<div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
									<UserCheck className="h-4 w-4" />
									{actionState?.assigneeName || task.ownerRole}
								</div>
							</div>
						</div>
						<ul className="mt-3 space-y-1 text-sm text-muted-foreground">
							{task.evidenceRequired.map((evidence) => (
								<li key={evidence} className="flex gap-2">
									<span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
									<span>{evidence}</span>
								</li>
							))}
						</ul>
			<div className="mt-4 grid gap-3 md:grid-cols-3">
				<label className="grid gap-1 text-xs text-muted-foreground">
					<span>Assignee</span>
					<input
						value={draft.assigneeName}
						onChange={(event) => onDraftChange(task.id, "assigneeName", event.target.value)}
						className="h-9 rounded-md border bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
					/>
				</label>
				<label className="grid gap-1 text-xs text-muted-foreground md:col-span-2">
					<span>Receipt URL</span>
					<input
						value={draft.receiptUrl}
						onChange={(event) => onDraftChange(task.id, "receiptUrl", event.target.value)}
						className="h-9 rounded-md border bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
					/>
				</label>
				<label className="grid gap-1 text-xs text-muted-foreground md:col-span-3">
					<span>Evidence note</span>
					<textarea
						value={draft.evidenceNote}
						onChange={(event) => onDraftChange(task.id, "evidenceNote", event.target.value)}
						rows={2}
						className="rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
					/>
				</label>
			</div>
			<div className="mt-3 flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={isUpdating}
					onClick={() => onUpdateTask(task, "in_progress")}
				>
					Start
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={isUpdating}
					onClick={() => onUpdateTask(task, "blocked")}
				>
					Block
				</Button>
				<Button
					size="sm"
					disabled={isUpdating}
					onClick={() => onUpdateTask(task, "completed")}
				>
					Complete
				</Button>
			</div>
		</article>
	);
}

function RecentActivity({ events }: { events: LatestLivePursuitHandoffTaskActionAuditEvent[] }) {
	return (
		<section className="rounded-lg border bg-card p-5">
			<div className="mb-3 flex items-center gap-2">
				<History className="h-5 w-5 text-foreground" />
				<h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
			</div>
			{events.length === 0 ? (
				<p className="text-sm text-muted-foreground">No task activity has been recorded for this handoff.</p>
			) : (
				<div className="divide-y">
					{events.slice(0, 10).map((event) => (
						<div key={event.eventId} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_auto]">
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
									<span className="rounded-full border px-2 py-0.5 text-foreground">{event.status}</span>
									<span>{event.taskId}</span>
									<span>{formatDateTime(event.updatedAt)}</span>
									<span>{event.updatedByUserId}</span>
								</div>
								<p className="mt-1 text-sm font-medium text-foreground">{event.taskTitle}</p>
								{event.evidenceNote && (
									<p className="mt-1 text-sm text-muted-foreground">{event.evidenceNote}</p>
								)}
							</div>
							<div className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground md:items-end">
								{event.assigneeName && <span>Assignee: {event.assigneeName}</span>}
								{event.receiptUrl && (
									<a
										href={event.receiptUrl}
										target="_blank"
										rel="noreferrer"
										className="inline-flex max-w-full items-center gap-1 text-primary hover:underline"
									>
										<ExternalLink className="h-3.5 w-3.5 shrink-0" />
										<span className="truncate">Receipt</span>
									</a>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}

function ArtifactPaths({ handoff }: { handoff: LatestLivePursuitHandoffPayload }) {
	return (
		<section className="rounded-lg border bg-card p-5">
			<h2 className="text-lg font-semibold text-foreground">Proof Links</h2>
			<div className="mt-3 grid gap-2 text-sm text-muted-foreground">
				<div>Portfolio: <code className="text-foreground">{handoff.index.sourcePortfolio.runId}</code></div>
				<div>Index: <code className="text-foreground">{handoff.paths.indexPath}</code></div>
				<div>Brief: <code className="text-foreground">{handoff.paths.briefPath}</code></div>
				{handoff.index.handoffArtifactPaths.map((artifactPath) => (
					<div key={artifactPath}>Artifact: <code className="text-foreground">{artifactPath}</code></div>
				))}
			</div>
		</section>
	);
}

function formatDateTime(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function draftsFromActionStates(
	actionStates: Record<string, LatestLivePursuitHandoffTaskActionState>,
): Record<string, { assigneeName: string; evidenceNote: string; receiptUrl: string }> {
	return Object.fromEntries(Object.entries(actionStates).map(([taskId, state]) => [
		taskId,
		{
			assigneeName: state.assigneeName ?? "",
			evidenceNote: state.evidenceNote ?? "",
			receiptUrl: state.receiptUrl ?? "",
		},
	]));
}

function Pill({ icon: Icon, children }: {
	icon: React.ComponentType<{ className?: string }>;
	children: React.ReactNode;
}) {
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-muted-foreground">
			<Icon className="h-3.5 w-3.5" />
			{children}
		</span>
	);
}
