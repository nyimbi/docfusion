import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, BellRing, Clock, RotateCcw, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { getWorkflowDashboard } from "@/lib/actions/workflow-runtime";
import { getWorkflowViewerScopeFromSession } from "@/lib/workflows/viewer-scope";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
	title: "Workflow Operations | DocFusion",
};

export default async function WorkflowOperationsPage() {
	const scope = await getWorkflowViewerScopeFromSession();
	if (!scope) redirect("/auth/sign-in");
	const dashboard = await getWorkflowDashboard(scope, {
		statuses: ["active", "waiting", "breached", "escalated"],
		limit: 120,
	});
	const exceptionRows = dashboard.items.filter((item) => item.status === "breached" || item.status === "escalated");

	return (
		<div className="h-full overflow-auto bg-background">
			<header className="border-b px-6 py-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<h1 className="flex items-center gap-2 text-2xl font-semibold">
							<TimerReset className="h-6 w-6 text-primary" />
							Workflow Operations
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							SLA breaches, assignments, compensating actions, and scheduled runtime jobs.
						</p>
					</div>
					<Button asChild variant="outline" size="sm">
						<Link href="/workflows">Dashboard</Link>
					</Button>
				</div>
			</header>

			<main className="grid gap-6 p-6 xl:grid-cols-[1fr_360px]">
				<section className="rounded-lg border bg-card">
					<div className="border-b px-5 py-4">
						<h2 className="text-base font-semibold">Exception Queue</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Workflow instances requiring escalation, re-assignment, reversal, or compensation.
						</p>
					</div>
					<div className="divide-y">
						{exceptionRows.map((item) => (
							<div key={item.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_160px_160px] md:items-center">
								<div>
									<div className="flex flex-wrap items-center gap-2">
										<span className="font-medium">{item.workflowKey}</span>
										<Badge variant={item.status === "escalated" ? "destructive" : "outline"}>{item.status}</Badge>
									</div>
									<p className="mt-1 text-sm text-muted-foreground">
										{item.subjectType} / {item.subjectId}
									</p>
								</div>
								<div className="text-sm">
									<div className="text-muted-foreground">Owner</div>
									<div>{item.assignedTo ?? item.escalatedTo ?? "Unassigned"}</div>
								</div>
								<div className="text-sm">
									<div className="text-muted-foreground">Due</div>
									<div>{formatDate(item.dueAt)}</div>
								</div>
							</div>
						))}
						{exceptionRows.length === 0 && (
							<div className="px-5 py-10 text-center text-sm text-muted-foreground">
								No breached or escalated workflow instances.
							</div>
						)}
					</div>
				</section>

				<aside className="space-y-6">
					<OperationPanel
						icon={Clock}
						title="SLA Evaluation"
						body="Scheduled worker execution evaluates overdue active and waiting workflows, writes audit events, and promotes breached items to escalation."
						endpoint="POST /api/v1/workflows/sla/evaluate"
					/>
					<OperationPanel
						icon={AlertTriangle}
						title="Exception Sync"
						body="Operational exceptions are synchronized into durable workflow instances for dashboarding and downstream task ownership."
						endpoint="POST /api/v1/workflows/exceptions/sync"
					/>
					<OperationPanel
						icon={BellRing}
						title="Stalwart Delivery"
						body="Queued workflow notifications are dispatched through the configured Stalwart SMTP server and recorded as delivered or failed."
						endpoint="POST /api/v1/workflows/notifications/dispatch"
					/>
					<OperationPanel
						icon={RotateCcw}
						title="Reversal Semantics"
						body="Authorized actors can reopen, cancel, or resolve workflow instances with reason capture, task cancellation, and audit evidence."
						endpoint="POST /api/v1/workflows/{id}/transition"
					/>
				</aside>
			</main>
		</div>
	);
}

function OperationPanel({
	icon: Icon,
	title,
	body,
	endpoint,
}: {
	icon: typeof Clock;
	title: string;
	body: string;
	endpoint: string;
}) {
	return (
		<div className="rounded-lg border bg-card p-5">
			<div className="flex items-center gap-2">
				<Icon className="h-4 w-4 text-primary" />
				<h2 className="text-base font-semibold">{title}</h2>
			</div>
			<p className="mt-3 text-sm text-muted-foreground">{body}</p>
			<div className="mt-4 rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">{endpoint}</div>
		</div>
	);
}

function formatDate(value: Date | string | null) {
	if (!value) return "None";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "None" : date.toLocaleDateString();
}
