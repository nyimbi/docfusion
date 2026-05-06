import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PortalWorkflowQueue } from "@/components/workflows/PortalWorkflowQueue";
import { listPortalWorkflowItems } from "@/lib/actions/workflow-runtime";
import { getWorkflowViewerScopeFromSession } from "@/lib/workflows/viewer-scope";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
	title: "Portal Workflows | DocFusion",
};

export default async function PortalWorkflowsPage() {
	const scope = await getWorkflowViewerScopeFromSession();
	if (!scope) redirect("/auth/sign-in");
	const items = await listPortalWorkflowItems(scope, { limit: 100 });

	return (
		<div className="h-full overflow-auto bg-background">
			<header className="border-b px-6 py-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<h1 className="flex items-center gap-2 text-2xl font-semibold">
							<ExternalLink className="h-6 w-6 text-primary" />
							Portal Workflows
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							External-facing workflow obligations, partner tasks, and customer-visible states.
						</p>
					</div>
					<Button asChild variant="outline" size="sm">
						<Link href="/workflows">Dashboard</Link>
					</Button>
				</div>
			</header>

			<PortalWorkflowQueue items={items} />
		</div>
	);
}
