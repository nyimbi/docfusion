import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CommandCenterNextAction } from "@/lib/work-items/projections";

export function NextActionPanel({
	actions,
	emptyLabel = "No active next actions in the current workflow projection.",
}: {
	actions: CommandCenterNextAction[];
	emptyLabel?: string;
}) {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="flex items-center gap-2 text-base">
					<CheckCircle2 className="h-4 w-4 text-primary" />
					Next Actions
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{actions.map((action) => (
					<div key={action.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<p className="truncate text-sm font-medium">{action.label}</p>
								<PriorityBadge priority={action.priority} />
							</div>
							<p className="mt-1 text-xs text-muted-foreground">{action.source}</p>
							{action.disabledReason && (
								<p className="mt-1 text-xs text-amber-600">{action.disabledReason}</p>
							)}
						</div>
						{action.actionUrl && !action.disabledReason && (
							<Button asChild variant="outline" size="sm">
								<Link href={action.actionUrl}>Open</Link>
							</Button>
						)}
					</div>
				))}
				{actions.length === 0 && (
					<p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
						{emptyLabel}
					</p>
				)}
			</CardContent>
		</Card>
	);
}

function PriorityBadge({ priority }: { priority: "critical" | "high" | "medium" | "low" }) {
	if (priority === "critical") return <Badge variant="destructive">critical</Badge>;
	if (priority === "high") return <Badge variant="secondary">high</Badge>;
	return <Badge variant="outline">{priority}</Badge>;
}
