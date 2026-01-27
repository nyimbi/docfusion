/**
 * Proposal Documents Page - DocFusion
 *
 * Dashboard for viewing and managing proposal documents for an opportunity.
 * Features document grid, progress tracking, and document creation.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getOpportunity } from "@/lib/actions/opportunities";
import { getProposalDocuments, getProposalProgress } from "@/lib/actions/proposal-documents";
import { ProposalDocumentsClientPage } from "./ProposalDocumentsClientPage";
import { Card, CardContent } from "@/components/ui/card";

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function ProposalDocumentsPage({ params }: PageProps) {
	const { id } = await params;

	// Fetch data in parallel
	const [opportunity, documents, progress] = await Promise.all([
		getOpportunity(id),
		getProposalDocuments(id),
		getProposalProgress(id),
	]);

	if (!opportunity) {
		notFound();
	}

	return (
		<div className="min-h-screen bg-[var(--background)]">
			{/* Header */}
			<header className="border-b border-[var(--border)] bg-[var(--background)]">
				<div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
					{/* Breadcrumb */}
					<nav className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] mb-3">
						<Link
							href="/opportunities"
							className="hover:text-[var(--foreground)] transition-colors"
						>
							Opportunities
						</Link>
						<span>/</span>
						<Link
							href={`/opportunities/${id}`}
							className="hover:text-[var(--foreground)] transition-colors truncate max-w-[200px]"
						>
							{opportunity.sourceId || opportunity.title.slice(0, 20)}
						</Link>
						<span>/</span>
						<span className="text-[var(--foreground)] font-medium">Documents</span>
					</nav>

					{/* Title */}
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h1 className="text-2xl font-semibold text-[var(--foreground)]">
								Proposal Documents
							</h1>
							<p className="text-sm text-[var(--foreground-muted)] mt-1">
								{progress.totalDocuments} document{progress.totalDocuments !== 1 ? "s" : ""} •{" "}
								{progress.completionPercentage}% complete
							</p>
						</div>
						{/* Navigation to other opportunity sections */}
						<div className="flex items-center gap-2">
							<Link
								href={`/opportunities/${id}/requirements`}
								className="px-3 py-1.5 text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-muted)] rounded-lg transition-colors"
							>
								Requirements
							</Link>
							<Link
								href={`/opportunities/${id}`}
								className="px-3 py-1.5 text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-muted)] rounded-lg transition-colors"
							>
								Overview
							</Link>
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				<Suspense fallback={<DocumentsSkeleton />}>
					<ProposalDocumentsClientPage
						opportunityId={id}
						initialDocuments={documents}
						initialProgress={progress}
					/>
				</Suspense>
			</main>
		</div>
	);
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function DocumentsSkeleton() {
	return (
		<div className="space-y-6">
			{/* Progress Skeleton */}
			<Card>
				<CardContent className="py-4">
					<div className="animate-pulse">
						<div className="h-4 bg-[var(--background-muted)] rounded w-1/3 mb-2" />
						<div className="h-2 bg-[var(--background-muted)] rounded w-full mt-3" />
					</div>
				</CardContent>
			</Card>

			{/* Grid Skeleton */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{[1, 2, 3, 4, 5, 6].map((i) => (
					<Card key={i}>
						<CardContent className="py-6">
							<div className="animate-pulse space-y-3">
								<div className="flex items-center gap-3">
									<div className="h-10 w-10 bg-[var(--background-muted)] rounded-lg" />
									<div className="flex-1">
										<div className="h-4 bg-[var(--background-muted)] rounded w-2/3" />
										<div className="h-3 bg-[var(--background-muted)] rounded w-1/2 mt-1" />
									</div>
								</div>
								<div className="h-6 bg-[var(--background-muted)] rounded w-24" />
								<div className="h-8 bg-[var(--background-muted)] rounded w-full" />
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
