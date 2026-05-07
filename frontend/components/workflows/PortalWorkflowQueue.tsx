import Link from "next/link";
import { ExternalLink, Eye, LockKeyhole, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import type { WorkflowInstanceRow } from "@/lib/db/schema-workflow-runtime";

export function PortalWorkflowQueue({ items }: { items: WorkflowInstanceRow[] }) {
	return (
		<main className="space-y-6 p-6">
			<section className="grid gap-4 md:grid-cols-3">
				<PortalMetric label="Visible items" value={items.length} icon={Eye} />
				<PortalMetric
					label="Partner scoped"
					value={items.filter((item) => item.portalVisibility?.portalRole === "partner").length}
					icon={Users}
				/>
				<PortalMetric
					label="Actionable"
					value={items.filter((item) => Boolean(item.portalVisibility?.actionUrl)).length}
					icon={LockKeyhole}
				/>
			</section>

			<section className="rounded-lg border bg-card">
				<div className="border-b px-5 py-4">
					<h2 className="text-base font-semibold">Portal Queue</h2>
				</div>
				<div className="divide-y">
					{items.map((item) => (
						<div key={item.id} className="grid gap-3 px-5 py-4 xl:grid-cols-[1fr_140px_140px_140px_180px] xl:items-center">
							<div>
								<div className="flex flex-wrap items-center gap-2">
									<span className="font-medium">{item.workflowKey}</span>
									<Badge variant="outline">{item.state}</Badge>
								</div>
								<p className="mt-1 text-sm text-muted-foreground">
									{item.portalVisibility?.summary ?? `${item.subjectType} / ${item.subjectId}`}
								</p>
							</div>
							<div className="text-sm">
								<div className="text-muted-foreground">Portal role</div>
								<div>{item.portalVisibility?.portalRole ?? "Any"}</div>
							</div>
							<div className="text-sm">
								<div className="text-muted-foreground">Status</div>
								<div>{item.status}</div>
							</div>
							<div className="text-sm">
								<div className="text-muted-foreground">Due</div>
								<div>{formatDate(item.dueAt)}</div>
							</div>
							<div className="flex justify-start xl:justify-end">
								{item.portalVisibility?.actionUrl ? (
									<Button asChild variant="outline" size="sm">
										<Link href={item.portalVisibility.actionUrl}>
											<ExternalLink className="h-4 w-4" />
											{item.portalVisibility.actionLabel ?? "Open"}
										</Link>
									</Button>
								) : (
									<span className="text-sm text-muted-foreground">No portal action</span>
								)}
							</div>
						</div>
					))}
					{items.length === 0 && (
						<div className="px-5 py-10 text-center text-sm text-muted-foreground">
							No portal-visible workflow instances.
						</div>
					)}
				</div>
			</section>
		</main>
	);
}

function PortalMetric({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: number;
	icon: typeof Eye;
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
