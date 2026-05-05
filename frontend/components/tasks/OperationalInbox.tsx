"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle2, Clock, ExternalLink, Inbox, RefreshCw, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	acknowledgeWorkflowNotification,
	retryWorkflowNotificationDelivery,
	updateWorkflowNotificationQuietHours,
	type OperationalInboxProjection,
} from "@/lib/actions/work-items";
import type { WorkItem } from "@/lib/work-items/projections";

export function OperationalInbox({
	initialProjection,
	onRefresh,
}: {
	initialProjection: OperationalInboxProjection | null;
	onRefresh?: () => void;
}) {
	const [kindFilter, setKindFilter] = React.useState<string>("all");
	const [pendingId, setPendingId] = React.useState<string | null>(null);
	const [quietHoursEnabled, setQuietHoursEnabled] = React.useState(
		Boolean(initialProjection?.notificationPreferences?.quietHours?.enabled)
	);
	const [quietStart, setQuietStart] = React.useState(initialProjection?.notificationPreferences?.quietHours?.start ?? "22:00");
	const [quietEnd, setQuietEnd] = React.useState(initialProjection?.notificationPreferences?.quietHours?.end ?? "08:00");
	const [preferencesMessage, setPreferencesMessage] = React.useState<string | null>(null);
	const [isPending, startTransition] = React.useTransition();
	const projection = initialProjection ?? {
		items: [],
		summary: {
			total: 0,
			open: 0,
			blocked: 0,
			overdue: 0,
			dueSoon: 0,
			critical: 0,
			byKind: {},
		},
		notificationPreferences: null,
		generatedAt: new Date().toISOString(),
	};
	const filteredItems = kindFilter === "all"
		? projection.items
		: projection.items.filter((item) => item.kind === kindFilter);

	const acknowledge = (item: WorkItem) => {
		if (!item.id.startsWith("notification:")) return;
		const notificationId = item.id.slice("notification:".length);
		setPendingId(item.id);
		startTransition(async () => {
			await acknowledgeWorkflowNotification(notificationId);
			setPendingId(null);
			onRefresh?.();
		});
	};

	const retryDelivery = (item: WorkItem) => {
		if (!item.id.startsWith("notification:")) return;
		const notificationId = item.id.slice("notification:".length);
		setPendingId(item.id);
		startTransition(async () => {
			await retryWorkflowNotificationDelivery(notificationId);
			setPendingId(null);
			onRefresh?.();
		});
	};

	const saveQuietHours = () => {
		setPreferencesMessage(null);
		startTransition(async () => {
			const result = await updateWorkflowNotificationQuietHours({
				enabled: quietHoursEnabled,
				start: quietStart,
				end: quietEnd,
			});
			setPreferencesMessage(result.success ? "Notification preferences saved" : result.error ?? "Failed to save preferences");
			onRefresh?.();
		});
	};

	return (
		<div className="space-y-4">
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
				<Metric label="Open" value={projection.summary.open} icon={Inbox} tone="text-blue-600" />
				<Metric label="Blocked" value={projection.summary.blocked} icon={ShieldAlert} tone="text-red-600" />
				<Metric label="Overdue" value={projection.summary.overdue} icon={AlertTriangle} tone="text-amber-600" />
				<Metric label="Due soon" value={projection.summary.dueSoon} icon={Clock} tone="text-violet-600" />
				<Metric label="Critical" value={projection.summary.critical} icon={Bell} tone="text-red-600" />
			</div>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base">
						<Bell className="h-4 w-4 text-primary" />
						Notification Controls
					</CardTitle>
					<p className="text-sm text-muted-foreground">
						Acknowledgements, quiet hours, failed delivery retry, and Stalwart dispatch status are handled from the inbox.
					</p>
				</CardHeader>
				<CardContent className="grid gap-4 lg:grid-cols-[1fr_130px_130px_auto] lg:items-end">
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={quietHoursEnabled}
							onChange={(event) => setQuietHoursEnabled(event.target.checked)}
							className="h-4 w-4 rounded border-input"
						/>
						Quiet hours
					</label>
					<label className="grid gap-1 text-sm">
						<span className="text-xs text-muted-foreground">Start</span>
						<Input type="time" value={quietStart} onChange={(event) => setQuietStart(event.target.value)} />
					</label>
					<label className="grid gap-1 text-sm">
						<span className="text-xs text-muted-foreground">End</span>
						<Input type="time" value={quietEnd} onChange={(event) => setQuietEnd(event.target.value)} />
					</label>
					<div className="flex flex-wrap items-center gap-2">
						<Button variant="outline" size="sm" onClick={saveQuietHours} isLoading={isPending && pendingId === null}>
							Save
						</Button>
						{preferencesMessage && <span className="text-xs text-muted-foreground">{preferencesMessage}</span>}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-center md:justify-between">
					<div>
						<CardTitle className="flex items-center gap-2 text-base">
							<Inbox className="h-4 w-4 text-primary" />
							Operational Inbox
						</CardTitle>
						<p className="mt-1 text-sm text-muted-foreground">
							Tasks, workflows, notifications, exceptions, and portal-visible work projected into one queue.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						{["all", "workflow", "task", "notification", "exception", "portal"].map((kind) => (
							<Button
								key={kind}
								variant={kindFilter === kind ? "secondary" : "outline"}
								size="sm"
								onClick={() => setKindFilter(kind)}
							>
								{kind}
							</Button>
						))}
					</div>
				</CardHeader>
				<CardContent className="space-y-3">
					{filteredItems.map((item) => (
						<div key={item.id} className="grid gap-3 rounded-md border p-3 lg:grid-cols-[1fr_160px_180px_160px] lg:items-center">
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<KindBadge kind={item.kind} />
									<PriorityBadge priority={item.priority} />
									<p className="truncate text-sm font-medium">{item.title}</p>
								</div>
								<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
									{item.description ?? `${item.subjectType ?? item.source}${item.subjectId ? ` / ${item.subjectId}` : ""}`}
								</p>
								{item.blocker && (
									<p className="mt-1 text-xs text-red-600">{item.blocker}</p>
								)}
								{item.disabledReason && (
									<p className="mt-1 text-xs text-amber-600">{item.disabledReason}</p>
								)}
							</div>
							<div className="text-sm">
								<div className="text-xs text-muted-foreground">Owner</div>
								<div>{item.owner ?? item.role ?? "Unassigned"}</div>
							</div>
							<div className="text-sm">
								<div className="text-xs text-muted-foreground">Due / updated</div>
								<div>{formatDate(item.dueAt ?? item.updatedAt)}</div>
							</div>
							<div className="flex items-center gap-2 lg:justify-end">
								{item.id.startsWith("notification:") && item.status !== "completed" && (
									<Button
										variant="outline"
										size="sm"
										isLoading={isPending && pendingId === item.id}
										onClick={() => acknowledge(item)}
									>
										<CheckCircle2 className="h-4 w-4" />
										Ack
									</Button>
								)}
								{item.id.startsWith("notification:") && item.status === "failed" && (
									<Button
										variant="outline"
										size="sm"
										isLoading={isPending && pendingId === item.id}
										onClick={() => retryDelivery(item)}
									>
										<RefreshCw className="h-4 w-4" />
										Retry
									</Button>
								)}
								{item.actionUrl && !item.disabledReason && (
									<Button asChild variant="outline" size="sm">
										<Link href={item.actionUrl}>
											<ExternalLink className="h-4 w-4" />
											Open
										</Link>
									</Button>
								)}
							</div>
						</div>
					))}
					{filteredItems.length === 0 && (
						<div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
							No work items match the current filter.
						</div>
					)}
				</CardContent>
			</Card>
		</div>
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

function KindBadge({ kind }: { kind: string }) {
	if (kind === "exception") return <Badge variant="destructive">exception</Badge>;
	if (kind === "notification") return <Badge variant="secondary">notification</Badge>;
	return <Badge variant="outline">{kind}</Badge>;
}

function PriorityBadge({ priority }: { priority: "critical" | "high" | "medium" | "low" }) {
	if (priority === "critical") return <Badge variant="destructive">critical</Badge>;
	if (priority === "high") return <Badge variant="secondary">high</Badge>;
	return <Badge variant="outline">{priority}</Badge>;
}

function formatDate(value?: string | null) {
	if (!value) return "No date";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "No date" : date.toLocaleDateString();
}
