import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { OpportunityCommandCenter } from "@/components/opportunities/OpportunityCommandCenter";
import { Button } from "@/components/ui/Button";
import { getOpportunity } from "@/lib/actions/opportunities";
import { getOpportunityCommandCenterProjection } from "@/lib/actions/work-items";

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function OpportunityCommandCenterPage({ params }: PageProps) {
	const { id } = await params;
	const opportunity = await getOpportunity(id);
	if (!opportunity) {
		notFound();
	}
	const projection = await getOpportunityCommandCenterProjection(id);

	return (
		<div className="min-h-screen bg-background">
			<header className="border-b bg-background">
				<div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
					<nav className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
						<Link href="/opportunities" className="hover:text-foreground">
							Opportunities
						</Link>
						<span>/</span>
						<Link href={`/opportunities/${id}`} className="hover:text-foreground">
							{opportunity.sourceId || opportunity.title.slice(0, 42)}
						</Link>
						<span>/</span>
						<span className="font-medium text-foreground">Command center</span>
					</nav>

					<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
						<div className="min-w-0">
							<h1 className="text-2xl font-semibold leading-tight text-foreground">
								{opportunity.title}
							</h1>
							<p className="mt-2 text-sm text-muted-foreground">
								Workflow state, blockers, next actions, readiness, documents, and audit for this opportunity.
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Button asChild variant="outline" size="sm">
								<Link href={`/opportunities/${id}`}>
									<ArrowLeft className="h-4 w-4" />
									Details
								</Link>
							</Button>
							<Button asChild variant="outline" size="sm">
								<Link href={`/opportunities/${id}/documents`}>
									<ExternalLink className="h-4 w-4" />
									Documents
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				<OpportunityCommandCenter projection={projection} />
			</main>
		</div>
	);
}
