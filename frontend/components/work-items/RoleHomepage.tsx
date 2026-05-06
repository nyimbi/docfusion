import Link from "next/link";
import {
	AlertTriangle,
	ArrowRight,
	Briefcase,
	CheckCircle2,
	Clock,
	Inbox,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { RoleHomepageProjection } from "@/lib/work-items/role-homepage";
import type { WorkItem } from "@/lib/work-items/projections";

export function RoleHomepage({ projection }: { projection: RoleHomepageProjection }) {
	return (
		<section className="space-y-5" aria-label={projection.profile.title}>
			<div className="rounded-lg border bg-card p-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="max-w-3xl">
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="outline">Role workspace</Badge>
							{projection.roles.map((role) => (
								<Badge key={role} variant="secondary">{role}</Badge>
							))}
						</div>
						<h1 className="mt-3 text-2xl font-semibold tracking-normal">{projection.profile.title}</h1>
						<p className="mt-2 text-sm text-muted-foreground">{projection.profile.job}</p>
					</div>
					<Button asChild>
						<Link href={projection.profile.primaryRoute}>
							{projection.profile.primaryAction}
							<ArrowRight className="h-4 w-4" />
						</Link>
					</Button>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
				<Metric label="Open" value={projection.summary.open} icon={Inbox} tone="text-blue-600" />
				<Metric label="Blocked" value={projection.summary.blocked} icon={AlertTriangle} tone="text-red-600" />
				<Metric label="Overdue" value={projection.summary.overdue} icon={Clock} tone="text-amber-600" />
				<Metric label="Due soon" value={projection.summary.dueSoon} icon={Briefcase} tone="text-violet-600" />
				<Metric label="Critical" value={projection.summary.critical} icon={ShieldCheck} tone="text-red-600" />
			</div>

			<div className="grid gap-5 xl:grid-cols-[1fr_380px]">
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-base">
							<Sparkles className="h-4 w-4 text-primary" />
							Role Focus
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{projection.focusItems.map((item) => (
							<FocusItem key={item.id} item={item} />
						))}
						{projection.focusItems.length === 0 && (
							<div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
								{projection.emptyState}
							</div>
						)}
					</CardContent>
				</Card>

				<div className="space-y-5">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">Readiness Pressure</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<Progress value={readinessValue(projection.summary)} />
							<div className="grid grid-cols-2 gap-3 text-sm">
								<div>
									<div className="text-xs text-muted-foreground">Next actions</div>
									<div className="font-medium">{projection.nextActions.length}</div>
								</div>
								<div>
									<div className="text-xs text-muted-foreground">Blockers</div>
									<div className="font-medium">{projection.blockers.length}</div>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">Quick Links</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-2">
							{projection.profile.quickLinks.map((link) => (
								<Button
									key={link.href}
									asChild
									variant={link.priority === "primary" ? "primary" : "outline"}
									size="sm"
								>
									<Link href={link.href}>{link.label}</Link>
								</Button>
							))}
						</CardContent>
					</Card>
				</div>
			</div>
		</section>
	);
}

function Metric({
	label,
	value,
	icon: Icon,
	tone,
}: {
	label: string;
	value: number;
	icon: typeof Inbox;
	tone: string;
}) {
	return (
		<Card>
			<CardContent className="p-4">
				<div className="flex items-center justify-between gap-3">
					<span className="text-sm text-muted-foreground">{label}</span>
					<Icon className={`h-4 w-4 ${tone}`} />
				</div>
				<div className="mt-3 text-2xl font-semibold">{value}</div>
			</CardContent>
		</Card>
	);
}

function FocusItem({ item }: { item: WorkItem }) {
	return (
		<div className="grid gap-3 rounded-md border p-3 lg:grid-cols-[1fr_130px_150px_auto] lg:items-center">
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-2">
					<KindBadge kind={item.kind} />
					<PriorityBadge priority={item.priority} />
					<p className="truncate text-sm font-medium">{item.title}</p>
				</div>
				<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
					{item.description ?? `${item.subjectType ?? item.source}${item.subjectId ? ` / ${item.subjectId}` : ""}`}
				</p>
				{item.blocker && <p className="mt-1 text-xs text-red-600">{item.blocker}</p>}
			</div>
			<div className="text-sm">
				<div className="text-xs text-muted-foreground">Owner</div>
				<div>{item.owner ?? item.role ?? "Unassigned"}</div>
			</div>
			<div className="text-sm">
				<div className="text-xs text-muted-foreground">Due</div>
				<div>{formatDate(item.dueAt)}</div>
			</div>
			<div className="flex justify-end">
				{item.actionUrl ? (
					<Button asChild variant="outline" size="sm" disabled={Boolean(item.disabledReason)}>
						<Link href={item.actionUrl}>Open</Link>
					</Button>
				) : (
					<CheckCircle2 className="h-4 w-4 text-muted-foreground" />
				)}
			</div>
		</div>
	);
}

function KindBadge({ kind }: { kind: string }) {
	if (kind === "exception") return <Badge variant="destructive">exception</Badge>;
	if (kind === "approval") return <Badge variant="secondary">approval</Badge>;
	if (kind === "portal") return <Badge variant="secondary">portal</Badge>;
	return <Badge variant="outline">{kind}</Badge>;
}

function PriorityBadge({ priority }: { priority: "critical" | "high" | "medium" | "low" }) {
	if (priority === "critical") return <Badge variant="destructive">critical</Badge>;
	if (priority === "high") return <Badge variant="secondary">high</Badge>;
	return <Badge variant="outline">{priority}</Badge>;
}

function readinessValue(summary: RoleHomepageProjection["summary"]) {
	return Math.max(0, Math.min(100, 100 - (summary.blocked * 18 + summary.overdue * 14 + summary.critical * 8)));
}

function formatDate(value?: string | null) {
	if (!value) return "No due date";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "No due date" : date.toLocaleDateString();
}
