import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, FileText, ListChecks, ShieldCheck, Workflow, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NextActionPanel } from "@/components/work-items/NextActionPanel";
import type { OpportunityCommandCenterProjection } from "@/lib/actions/work-items";

export function OpportunityCommandCenter({
	projection,
}: {
	projection: OpportunityCommandCenterProjection;
}) {
	const readinessTone = projection.readiness.label === "ready"
		? "text-green-600"
		: projection.readiness.label === "watch"
			? "text-amber-600"
			: "text-red-600";

	return (
		<section className="space-y-4" aria-label="Opportunity command center">
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<MetricCard
					label="Readiness"
					value={`${projection.readiness.score}%`}
					icon={ShieldCheck}
					tone={readinessTone}
					subtitle={projection.readiness.reasons.join(", ")}
				/>
				<MetricCard
					label="Open work"
					value={String(projection.workSummary.open)}
					icon={ListChecks}
					tone="text-blue-600"
					subtitle={`${projection.workSummary.blocked} blocked, ${projection.workSummary.overdue} overdue`}
				/>
				<MetricCard
					label="Workflow state"
					value={String(projection.workflowSummary.active + projection.workflowSummary.breached + projection.workflowSummary.escalated)}
					icon={Workflow}
					tone="text-violet-600"
					subtitle={`${projection.workflowSummary.completed} completed, ${projection.workflowSummary.total} total`}
				/>
				<MetricCard
					label="Documents"
					value={`${projection.documentSummary.downloaded}/${projection.documentSummary.total}`}
					icon={FileText}
					tone={projection.documentSummary.failed ? "text-red-600" : "text-slate-600"}
					subtitle={projection.documentSummary.failed ? `${projection.documentSummary.failed} need recovery` : "Downloaded or analyzed"}
				/>
			</div>

			<div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
				<NextActionPanel actions={projection.nextActions} />

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-base">
							<AlertTriangle className="h-4 w-4 text-primary" />
							Blockers
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{projection.blockers.map((blocker) => (
							<div key={blocker.id} className="rounded-md border p-3">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<p className="text-sm font-medium">{blocker.label}</p>
									<PriorityBadge priority={blocker.severity} />
								</div>
								<div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
									<span>{blocker.owner ?? "Unassigned"}</span>
									<span>{formatDate(blocker.dueAt)}</span>
									{blocker.actionUrl && (
										<Link href={blocker.actionUrl} className="text-primary hover:underline">
											Open item
										</Link>
									)}
								</div>
							</div>
						))}
						{projection.blockers.length === 0 && (
							<p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
								No active blockers in the current workflow projection.
							</p>
						)}
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base">
						<Workflow className="h-4 w-4 text-primary" />
						Workflow Surfaces
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					<SurfaceLink href={`/opportunities/${projection.opportunityId}/requirements`} label="Requirements" />
					<SurfaceLink href={`/opportunities/${projection.opportunityId}/documents`} label="Documents" />
					<SurfaceLink href={`/opportunities/${projection.opportunityId}/submission`} label="Submission" />
					<SurfaceLink href={`/tasks?opportunityId=${projection.opportunityId}`} label="Inbox" />
					<SurfaceLink href={`/workflows?opportunityId=${projection.opportunityId}`} label="Workflows" />
					<SurfaceLink href="/workflows/audit" label="Audit" />
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base">
						<ShieldCheck className="h-4 w-4 text-primary" />
						Response Readiness
					</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					{projection.readinessDimensions.map((dimension) => (
						<div key={dimension.key} className="rounded-md border p-3">
							<div className="flex items-center justify-between gap-2">
								<div className="min-w-0">
									<p className="truncate text-sm font-medium">{dimension.label}</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{dimension.blockerCount} blockers, {dimension.warningCount} warnings
									</p>
								</div>
								<ReadinessStatus status={dimension.status} />
							</div>
							<div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
								<span>{dimension.owner ?? "No owner"}</span>
								{dimension.actionUrl && (
									<Link href={dimension.actionUrl} className="text-primary hover:underline">
										Resolve
									</Link>
								)}
							</div>
							{dimension.details.length > 0 && (
								<div className="mt-3 space-y-1 border-t pt-2">
									{dimension.details.map((detail) => (
										<p key={detail} className="text-xs leading-relaxed text-muted-foreground">
											{detail}
										</p>
									))}
								</div>
							)}
						</div>
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base">
						<Clock className="h-4 w-4 text-primary" />
						Recent Audit
					</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-3 md:grid-cols-2">
					{projection.auditEvents.map((event) => (
						<div key={event.id} className="rounded-md border p-3">
							<div className="flex items-center justify-between gap-2">
								<p className="text-sm font-medium">{event.eventType}</p>
								<span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span>
							</div>
							<p className="mt-1 text-xs text-muted-foreground">
								{event.actorName ?? "Unknown actor"}{event.reason ? `: ${event.reason}` : ""}
							</p>
						</div>
					))}
					{projection.auditEvents.length === 0 && (
						<p className="text-sm text-muted-foreground">No audit events recorded for this opportunity yet.</p>
					)}
				</CardContent>
			</Card>
		</section>
	);
}

function ReadinessStatus({ status }: { status: "pass" | "warn" | "block" }) {
	if (status === "block") {
		return (
			<span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs text-red-700">
				<XCircle className="h-3 w-3" />
				block
			</span>
		);
	}
	if (status === "warn") {
		return (
			<span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">
				<AlertTriangle className="h-3 w-3" />
				warn
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs text-green-700">
			<CheckCircle2 className="h-3 w-3" />
			pass
		</span>
	);
}

function SurfaceLink({ href, label }: { href: string; label: string }) {
	return (
		<Button asChild variant="outline" size="sm">
			<Link href={href}>{label}</Link>
		</Button>
	);
}

function MetricCard({
	label,
	value,
	icon: Icon,
	tone,
	subtitle,
}: {
	label: string;
	value: string;
	icon: typeof ShieldCheck;
	tone: string;
	subtitle: string;
}) {
	return (
		<Card>
			<CardContent className="p-4">
				<div className="flex items-center justify-between gap-3">
					<span className="text-sm text-muted-foreground">{label}</span>
					<Icon className={`h-4 w-4 ${tone}`} />
				</div>
				<div className="mt-3 text-2xl font-semibold">{value}</div>
				<p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
			</CardContent>
		</Card>
	);
}

function PriorityBadge({ priority }: { priority: "critical" | "high" | "medium" | "low" }) {
	if (priority === "critical") return <Badge variant="destructive">critical</Badge>;
	if (priority === "high") return <Badge variant="secondary">high</Badge>;
	return <Badge variant="outline">{priority}</Badge>;
}

function formatDate(value?: string | null) {
	if (!value) return "No due date";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "No due date" : date.toLocaleDateString();
}
