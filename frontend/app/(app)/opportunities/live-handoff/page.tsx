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
	RefreshCw,
	UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { LatestLivePursuitHandoffPayload, LatestLivePursuitHandoffTask } from "@/lib/types/latest-live-pursuit-handoff";

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
		} catch (loadError) {
			setHandoff(null);
			setError(loadError instanceof Error ? loadError.message : "Failed to load latest live handoff");
		} finally {
			setIsLoading(false);
		}
	}, []);

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
					<ExecutionTasks tasks={handoff.index.executionPlan.tasks} />
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

function ExecutionTasks({ tasks }: { tasks: LatestLivePursuitHandoffTask[] }) {
	return (
		<section>
			<div className="mb-3 flex items-center gap-2">
				<CheckSquare className="h-5 w-5 text-foreground" />
				<h2 className="text-lg font-semibold text-foreground">Execution Checklist</h2>
			</div>
			<div className="grid gap-3">
				{tasks.map((task) => (
					<article key={task.id} className="rounded-lg border bg-card p-4">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<div className="mb-2 flex flex-wrap items-center gap-2">
									<span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", priorityClassName[task.priority])}>
										{task.priority}
									</span>
									<span className="text-xs text-muted-foreground">{task.id}</span>
									<span className="text-xs text-muted-foreground">{task.sourceKind}</span>
									{task.dueLabel && <span className="text-xs text-muted-foreground">due {task.dueLabel}</span>}
								</div>
								<h3 className="text-sm font-medium leading-6 text-foreground">{task.title}</h3>
								<div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
									<UserCheck className="h-4 w-4" />
									{task.ownerRole}
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
					</article>
				))}
			</div>
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
