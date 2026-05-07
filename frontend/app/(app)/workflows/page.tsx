import Link from "next/link";
import type { Metadata } from "next";
import {
	Activity,
	AlertTriangle,
	CheckCircle2,
	Clock,
	ExternalLink,
	History,
	LayoutDashboard,
	ShieldCheck,
	Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { SandboxModeBanner } from "@/components/workflows/SandboxModeBanner";
import { WorkflowActionPanel } from "@/components/workflows/WorkflowActionPanel";
import { getWorkflowDashboard, listWorkflowTemplates } from "@/lib/actions/workflow-runtime";
import type { WorkflowInstanceRow } from "@/lib/db/schema-workflow-runtime";
import { getWorkflowViewerScopeFromSession } from "@/lib/workflows/viewer-scope";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
	title: "Workflows | DocFusion",
};

export default async function WorkflowDashboardPage() {
	const scope = await getWorkflowViewerScopeFromSession();
	if (!scope) redirect("/auth/sign-in");
	const [dashboard, templates] = await Promise.all([
		getWorkflowDashboard(scope, { limit: 80 }),
		listWorkflowTemplates({ limit: 10 }),
	]);

	return (
		<div className="h-full overflow-auto bg-background">
			<div className="border-b bg-background px-6 py-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<h1 className="flex items-center gap-2 text-2xl font-semibold tracking-normal">
							<Workflow className="h-6 w-6 text-primary" />
							Workflow Control
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Runtime state, SLA pressure, portal visibility, and template publication.
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Button asChild variant="outline" size="sm">
							<Link href="/workflows/operations">
								<Activity className="h-4 w-4" />
								Operations
							</Link>
						</Button>
						<Button asChild variant="outline" size="sm">
							<Link href="/workflows/portal">
								<ExternalLink className="h-4 w-4" />
								Portal
							</Link>
						</Button>
						<Button asChild variant="outline" size="sm">
							<Link href="/workflows/audit">
								<History className="h-4 w-4" />
								Audit
							</Link>
						</Button>
						<Button asChild variant="outline" size="sm">
							<Link href="/workflows/templates">
								<ShieldCheck className="h-4 w-4" />
								Templates
							</Link>
						</Button>
					</div>
				</div>
			</div>

			<main className="space-y-6 p-6">
				<SandboxModeBanner />

				<WorkflowActionPanel
					templates={templates.map((template) => ({
						id: template.id,
						templateKey: template.templateKey,
						name: template.name,
						subjectType: template.subjectType,
						status: template.status,
					}))}
					instances={dashboard.items.map((item) => ({
						id: item.id,
						workflowKey: item.workflowKey,
						subjectType: item.subjectType,
						subjectId: item.subjectId,
						state: item.state,
						status: item.status,
					}))}
				/>

				<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
					<Metric label="Total" value={dashboard.total} icon={LayoutDashboard} tone="neutral" />
					<Metric label="Active" value={dashboard.active} icon={Activity} tone="active" />
					<Metric label="Breached" value={dashboard.breached} icon={AlertTriangle} tone="danger" />
					<Metric label="Escalated" value={dashboard.escalated} icon={Clock} tone="warning" />
					<Metric label="Completed" value={dashboard.completed} icon={CheckCircle2} tone="success" />
				</section>

				<section className="grid gap-6 xl:grid-cols-[1fr_360px]">
					<div className="rounded-lg border bg-card">
						<div className="border-b px-5 py-4">
							<h2 className="text-base font-semibold">Runtime Instances</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								Workflow-backed JTBD currently persisted by the runtime.
							</p>
						</div>
						<div className="overflow-x-auto">
							<table className="w-full min-w-[900px] text-sm">
								<thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
									<tr>
										<th className="px-5 py-3 text-left font-medium">Subject</th>
										<th className="px-5 py-3 text-left font-medium">Workflow</th>
										<th className="px-5 py-3 text-left font-medium">State</th>
										<th className="px-5 py-3 text-left font-medium">Status</th>
										<th className="px-5 py-3 text-left font-medium">Owner</th>
										<th className="px-5 py-3 text-left font-medium">Due</th>
									</tr>
								</thead>
								<tbody>
									{dashboard.items.map((item) => (
										<WorkflowRow key={item.id} item={item} />
									))}
									{dashboard.items.length === 0 && (
										<tr>
											<td className="px-5 py-8 text-center text-muted-foreground" colSpan={6}>
												No workflow instances have been recorded.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</div>

					<div className="space-y-6">
						<div className="rounded-lg border bg-card">
							<div className="border-b px-5 py-4">
								<h2 className="text-base font-semibold">Subject Coverage</h2>
							</div>
							<div className="space-y-3 p-5">
								{Object.entries(dashboard.bySubjectType).map(([subjectType, count]) => (
									<div key={subjectType} className="flex items-center justify-between gap-3">
										<span className="truncate text-sm">{subjectType}</span>
										<Badge variant="outline">{count}</Badge>
									</div>
								))}
								{Object.keys(dashboard.bySubjectType).length === 0 && (
									<p className="text-sm text-muted-foreground">No subject telemetry yet.</p>
								)}
							</div>
						</div>

						<div className="rounded-lg border bg-card">
							<div className="border-b px-5 py-4">
								<h2 className="text-base font-semibold">Published Templates</h2>
							</div>
							<div className="space-y-3 p-5">
								{templates.map((template) => (
									<div key={template.id} className="space-y-1">
										<div className="flex items-center justify-between gap-3">
											<span className="truncate text-sm font-medium">{template.name}</span>
											<Badge variant={template.status === "active" ? "default" : "secondary"}>
												v{template.version}
											</Badge>
										</div>
										<p className="truncate text-xs text-muted-foreground">{template.subjectType}</p>
									</div>
								))}
								{templates.length === 0 && (
									<p className="text-sm text-muted-foreground">No workflow templates are configured.</p>
								)}
							</div>
						</div>
					</div>
				</section>
			</main>
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
	icon: typeof Activity;
	tone: "neutral" | "active" | "danger" | "warning" | "success";
}) {
	const toneClass = {
		neutral: "text-muted-foreground",
		active: "text-blue-600",
		danger: "text-red-600",
		warning: "text-amber-600",
		success: "text-green-600",
	}[tone];

	return (
		<div className="rounded-lg border bg-card p-4">
			<div className="flex items-center justify-between gap-3">
				<span className="text-sm text-muted-foreground">{label}</span>
				<Icon className={`h-4 w-4 ${toneClass}`} />
			</div>
			<div className="mt-3 text-2xl font-semibold">{value}</div>
		</div>
	);
}

function WorkflowRow({ item }: { item: WorkflowInstanceRow }) {
	return (
		<tr className="border-b last:border-b-0">
			<td className="px-5 py-4">
				<div className="font-medium">{item.subjectType}</div>
				<div className="max-w-[220px] truncate text-xs text-muted-foreground">{item.subjectId}</div>
			</td>
			<td className="px-5 py-4">{item.workflowKey}</td>
			<td className="px-5 py-4">{item.state}</td>
			<td className="px-5 py-4">
				<StatusBadge status={item.status} />
			</td>
			<td className="px-5 py-4 text-muted-foreground">{item.assignedTo ?? item.escalatedTo ?? "Unassigned"}</td>
			<td className="px-5 py-4 text-muted-foreground">{formatDate(item.dueAt)}</td>
		</tr>
	);
}

function StatusBadge({ status }: { status: string }) {
	if (status === "breached" || status === "escalated") {
		return <Badge variant="destructive">{status}</Badge>;
	}
	if (status === "completed") {
		return <Badge variant="secondary">{status}</Badge>;
	}
	return <Badge variant="outline">{status}</Badge>;
}

function formatDate(value: Date | string | null) {
	if (!value) return "None";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "None" : date.toLocaleDateString();
}
