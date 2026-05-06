import Link from "next/link";
import type { Metadata } from "next";
import { Activity, Fingerprint, History, Search, ShieldCheck, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { SandboxModeBanner } from "@/components/workflows/SandboxModeBanner";
import { getWorkflowAuditExplorerProjection } from "@/lib/actions/workflow-audit";
import { getWorkflowViewerScopeFromSession } from "@/lib/workflows/viewer-scope";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
	title: "Workflow Audit Explorer | DocFusion",
};

interface AuditPageProps {
	searchParams: Promise<{
		runId?: string;
		subjectType?: string;
		subjectId?: string;
		eventType?: string;
		actorId?: string;
		limit?: string;
	}>;
}

export default async function WorkflowAuditPage({ searchParams }: AuditPageProps) {
	const scope = await getWorkflowViewerScopeFromSession();
	if (!scope) redirect("/auth/sign-in");
	const params = await searchParams;
	const projection = await getWorkflowAuditExplorerProjection({
		runId: clean(params.runId),
		subjectType: clean(params.subjectType),
		subjectId: clean(params.subjectId),
		eventType: clean(params.eventType),
		actorId: clean(params.actorId),
		limit: params.limit ? Number(params.limit) : undefined,
	});

	return (
		<div className="h-full overflow-auto bg-background">
			<header className="border-b px-6 py-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<h1 className="flex items-center gap-2 text-2xl font-semibold">
							<ShieldCheck className="h-6 w-6 text-primary" />
							Workflow Audit Explorer
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Reconstruct workflow runs by run ID, subject, event, or actor from durable audit events.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button asChild variant="outline" size="sm">
							<Link href="/workflows">
								<Workflow className="h-4 w-4" />
								Dashboard
							</Link>
						</Button>
						<Button asChild variant="outline" size="sm">
							<Link href="/workflows/operations">
								<Activity className="h-4 w-4" />
								Operations
							</Link>
						</Button>
					</div>
				</div>
			</header>

			<main className="space-y-6 p-6">
				<SandboxModeBanner />

				<form className="rounded-lg border bg-card p-5" action="/workflows/audit">
					<div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
						<FilterInput name="runId" label="Run ID" defaultValue={projection.filters.runId} />
						<FilterInput name="subjectType" label="Subject type" defaultValue={projection.filters.subjectType} />
						<FilterInput name="subjectId" label="Subject ID" defaultValue={projection.filters.subjectId} />
						<FilterInput name="eventType" label="Event type" defaultValue={projection.filters.eventType} />
						<FilterInput name="actorId" label="Actor ID" defaultValue={projection.filters.actorId} />
						<FilterInput name="limit" label="Limit" defaultValue={String(projection.filters.limit)} />
					</div>
					<div className="mt-4 flex flex-wrap gap-2">
						<Button type="submit" size="sm">
							<Search className="h-4 w-4" />
							Search
						</Button>
						<Button asChild type="button" variant="outline" size="sm">
							<Link href={`/api/v1/workflows/audit/export?${buildAuditExportQuery(projection.filters)}`}>
								Export CSV
							</Link>
						</Button>
						<Button asChild type="button" variant="outline" size="sm">
							<Link href="/workflows/audit">Clear</Link>
						</Button>
					</div>
				</form>

				<section className="grid gap-4 md:grid-cols-4">
					<Metric label="Events" value={projection.summary.totalEvents} icon={History} />
					<Metric label="Runs" value={projection.summary.runCount} icon={Workflow} />
					<Metric label="Subjects" value={projection.summary.subjectCount} icon={Fingerprint} />
					<Metric label="Event types" value={Object.keys(projection.summary.eventTypes).length} icon={Search} />
				</section>

				{projection.reconstruction && (
					<section className="rounded-lg border bg-card">
						<div className="border-b px-5 py-4">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<h2 className="text-base font-semibold">Run Reconstruction</h2>
									<p className="mt-1 text-sm text-muted-foreground">
										{projection.reconstruction.workflowKey} / {projection.reconstruction.subjectType} / {projection.reconstruction.subjectId}
									</p>
								</div>
								<Badge variant={projection.reconstruction.status === "completed" ? "secondary" : "outline"}>
									{projection.reconstruction.currentState}
								</Badge>
							</div>
						</div>
						<div className="divide-y">
							{projection.reconstruction.timeline.map((event) => (
								<AuditEventRow key={event.id} event={event} compact />
							))}
						</div>
					</section>
				)}

				<section className="rounded-lg border bg-card">
					<div className="border-b px-5 py-4">
						<h2 className="text-base font-semibold">Audit Events</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Latest matching events, newest first. Use a run ID to reconstruct the full timeline.
						</p>
					</div>
					<div className="divide-y">
						{projection.events.map((event) => (
							<AuditEventRow key={event.id} event={event} />
						))}
						{projection.events.length === 0 && (
							<div className="px-5 py-10 text-center text-sm text-muted-foreground">
								No audit events matched the current filters.
							</div>
						)}
					</div>
				</section>
			</main>
		</div>
	);
}

function FilterInput({
	name,
	label,
	defaultValue,
}: {
	name: string;
	label: string;
	defaultValue?: string | null;
}) {
	return (
		<label className="grid gap-2 text-sm">
			<span className="text-xs font-medium text-muted-foreground">{label}</span>
			<Input name={name} defaultValue={defaultValue ?? ""} />
		</label>
	);
}

function Metric({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: number;
	icon: typeof History;
}) {
	return (
		<div className="rounded-lg border bg-card p-4">
			<div className="flex items-center justify-between gap-3">
				<span className="text-sm text-muted-foreground">{label}</span>
				<Icon className="h-4 w-4 text-primary" />
			</div>
			<div className="mt-3 text-2xl font-semibold">{value}</div>
		</div>
	);
}

function AuditEventRow({
	event,
	compact = false,
}: {
	event: Awaited<ReturnType<typeof getWorkflowAuditExplorerProjection>>["events"][number];
	compact?: boolean;
}) {
	return (
		<div className={compact ? "px-5 py-3" : "grid gap-3 px-5 py-4 lg:grid-cols-[1fr_220px_180px]"}>
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-medium">{event.eventType}</span>
					<Badge variant="outline">{event.fromState ?? "none"} {"->"} {event.toState ?? "none"}</Badge>
				</div>
				<p className="mt-1 truncate text-sm text-muted-foreground">
					{event.subjectType} / {event.subjectId}
				</p>
				{event.reason && <p className="mt-1 text-sm text-muted-foreground">{event.reason}</p>}
			</div>
			{!compact && (
				<div className="text-sm">
					<div className="text-xs text-muted-foreground">Run</div>
					<Link className="break-all text-primary hover:underline" href={`/workflows/audit?runId=${event.workflowInstanceId}`}>
						{event.workflowInstanceId}
					</Link>
				</div>
			)}
			<div className="text-sm">
				<div className="text-xs text-muted-foreground">Actor / time</div>
				<div>{event.actorName ?? event.actorId}</div>
				<div className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</div>
			</div>
		</div>
	);
}

function clean(value?: string) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function buildAuditExportQuery(filters: Awaited<ReturnType<typeof getWorkflowAuditExplorerProjection>>["filters"]) {
	const params = new URLSearchParams();
	if (filters.runId) params.set("runId", filters.runId);
	if (filters.subjectType) params.set("subjectType", filters.subjectType);
	if (filters.subjectId) params.set("subjectId", filters.subjectId);
	if (filters.eventType) params.set("eventType", filters.eventType);
	if (filters.actorId) params.set("actorId", filters.actorId);
	params.set("limit", String(filters.limit));
	return params.toString();
}

function formatDate(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
