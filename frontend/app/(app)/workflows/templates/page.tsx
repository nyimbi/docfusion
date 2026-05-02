import Link from "next/link";
import type { Metadata } from "next";
import { GitBranch, PlayCircle, ShieldCheck, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { listWorkflowTemplates } from "@/lib/actions/workflow-runtime";
import { simulateWorkflowTemplate } from "@/lib/workflows/simulation";

export const metadata: Metadata = {
	title: "Workflow Templates | DocFusion",
};

export default async function WorkflowTemplatesPage() {
	const templates = await listWorkflowTemplates({ limit: 100 });

	return (
		<div className="h-full overflow-auto bg-background">
			<header className="border-b px-6 py-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<h1 className="flex items-center gap-2 text-2xl font-semibold">
							<ShieldCheck className="h-6 w-6 text-primary" />
							Workflow Templates
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Versioned workflow definitions, simulation results, and publication status.
						</p>
					</div>
					<Button asChild variant="outline" size="sm">
						<Link href="/workflows">Dashboard</Link>
					</Button>
				</div>
			</header>

			<main className="space-y-6 p-6">
				<section className="grid gap-4 md:grid-cols-3">
					<TemplateMetric label="Templates" value={templates.length} icon={Workflow} />
					<TemplateMetric label="Active" value={templates.filter((item) => item.status === "active").length} icon={ShieldCheck} />
					<TemplateMetric label="Drafts" value={templates.filter((item) => item.status === "draft").length} icon={GitBranch} />
				</section>

				<section className="rounded-lg border bg-card">
					<div className="border-b px-5 py-4">
						<h2 className="text-base font-semibold">Governance Register</h2>
					</div>
					<div className="divide-y">
						{templates.map((template) => {
							const simulation = simulateWorkflowTemplate({
								states: template.states,
								transitions: template.transitions,
							});
							return (
								<div key={template.id} className="grid gap-4 px-5 py-4 xl:grid-cols-[1fr_140px_160px_220px] xl:items-center">
									<div>
										<div className="flex flex-wrap items-center gap-2">
											<span className="font-medium">{template.name}</span>
											<Badge variant={template.status === "active" ? "default" : "secondary"}>
												{template.status}
											</Badge>
										</div>
										<p className="mt-1 text-sm text-muted-foreground">
											{template.templateKey} / {template.subjectType}
										</p>
									</div>
									<div className="text-sm">
										<div className="text-muted-foreground">Version</div>
										<div>v{template.version}</div>
									</div>
									<div className="text-sm">
										<div className="text-muted-foreground">Simulation</div>
										<div className="flex items-center gap-2">
											<PlayCircle className={simulation.valid ? "h-4 w-4 text-green-600" : "h-4 w-4 text-red-600"} />
											{simulation.valid ? "Valid" : `${simulation.errors.length} issue(s)`}
										</div>
									</div>
									<div className="text-sm">
										<div className="text-muted-foreground">Published</div>
										<div>{formatDate(template.publishedAt)}</div>
									</div>
								</div>
							);
						})}
						{templates.length === 0 && (
							<div className="px-5 py-10 text-center text-sm text-muted-foreground">
								No workflow templates have been drafted.
							</div>
						)}
					</div>
				</section>
			</main>
		</div>
	);
}

function TemplateMetric({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: number;
	icon: typeof Workflow;
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

function formatDate(value: Date | string | null) {
	if (!value) return "None";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "None" : date.toLocaleDateString();
}
