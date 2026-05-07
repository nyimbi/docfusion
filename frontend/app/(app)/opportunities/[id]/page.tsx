/**
 * Opportunity Detail Page - DocFusion
 *
 * Displays full opportunity information with Go/No-Go voting panel,
 * AI scores, and navigation to requirements/proposals.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getOpportunity } from "@/lib/actions/opportunities";
import { getVoteSummary, getVotes } from "@/lib/actions/opportunity-votes";
import { getLatestScores } from "@/lib/actions/opportunity-ai";
import { getOpportunityDocuments } from "@/lib/services/rfp-document-service";
import { getOpportunityCommandCenterProjection } from "@/lib/actions/work-items";
import { OpportunityDetailView } from "@/components/opportunities/OpportunityDetailView";
import { GoNoGoPanel } from "@/components/opportunities/GoNoGoPanel";
import { AIScoreCard } from "@/components/opportunities/AIScoreCard";
import { OpportunityDocumentsPanel } from "@/components/opportunities/OpportunityDocumentsPanel";
import { OpportunityCommandCenter } from "@/components/opportunities/OpportunityCommandCenter";
import { OpportunityLifecyclePanel } from "@/components/opportunities/OpportunityLifecyclePanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { OpportunityHeaderActions } from "@/components/opportunities/OpportunityHeaderActions";
import { ShortlistButton } from "@/components/opportunities/ShortlistButton";

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function OpportunityDetailPage({ params }: PageProps) {
	const { id } = await params;

	// Fetch data in parallel
	const [opportunity, voteSummary, votes, aiScores, documents, commandCenter] = await Promise.all([
		getOpportunity(id),
		getVoteSummary(id),
		getVotes(id),
		getLatestScores(id),
		getOpportunityDocuments(id),
		getOpportunityCommandCenterProjection(id),
	]);

	if (!opportunity) {
		notFound();
	}

	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<header className="border-b bg-background">
				<div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
					{/* Breadcrumb */}
					<nav className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
						<Link
							href="/opportunities"
							className="hover:text-foreground transition-colors"
						>
							Opportunities
						</Link>
						<span>/</span>
						<span className="text-foreground font-medium truncate max-w-[300px]">
							{opportunity.sourceId || opportunity.title.slice(0, 30)}
						</span>
					</nav>

					{/* Title and status */}
					<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div className="min-w-0 flex-1">
							<h1 className="text-2xl font-semibold text-foreground leading-tight">
								{opportunity.title}
							</h1>
							<div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-[var(--foreground-muted)]">
								{opportunity.organization && (
									<span className="flex items-center gap-1">
										<BuildingIcon className="h-4 w-4" />
										{opportunity.organization}
									</span>
								)}
								{opportunity.countryRegion && (
									<span className="flex items-center gap-1">
										<GlobeIcon className="h-4 w-4" />
										{opportunity.countryRegion}
									</span>
								)}
								{opportunity.deadline && (
									<span className="flex items-center gap-1">
										<CalendarIcon className="h-4 w-4" />
										{formatDate(opportunity.deadline)}
										{opportunity.daysLeft !== null && (
											<span
												className={`ml-1 ${opportunity.daysLeft < 7
														? "text-destructive"
														: opportunity.daysLeft < 14
															? "text-amber-500"
															: "text-green-500"
													}`}
											>
												({opportunity.daysLeft}d)
											</span>
										)}
									</span>
								)}
							</div>
						</div>

						{/* Status badge and actions */}
						<div className="flex items-center gap-3 flex-wrap">
							<StatusBadge status={opportunity.decisionStatus} />
							<ShortlistButton
								opportunityId={id}
								isShortlisted={opportunity.decisionStatus === "shortlisted"}
							/>
							<OpportunityHeaderActions
								opportunityId={id}
								opportunityTitle={opportunity.title}
								sourceUrl={opportunity.portalUrl || opportunity.rfpLink}
								rfpLink={opportunity.rfpLink}
								documentsDiscovered={opportunity.documentsDiscovered || documents.length > 0}
								documents={documents}
							/>
						</div>
					</div>
				</div>
			</header>

			{/* Main content */}
			<main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				<div className="mb-6">
					<OpportunityCommandCenter projection={commandCenter} />
				</div>
				<div className="mb-6">
					<OpportunityLifecyclePanel
						opportunity={{
							id: opportunity.id,
							title: opportunity.title,
							decisionStatus: opportunity.decisionStatus,
							assignedTo: opportunity.assignedTo,
							deadline: opportunity.deadline,
							fitScore: opportunity.fitScore,
							winProbability: opportunity.winProbability,
						}}
					/>
				</div>
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Left column - Details & Documents */}
					<div className="lg:col-span-2 space-y-6">
						<OpportunityDetailView opportunity={opportunity} />
						
						{/* RFP Documents Panel */}
						<Suspense fallback={<CardSkeleton title="RFP Documents" />}>
							<OpportunityDocumentsPanel
								opportunityId={id}
								opportunityTitle={opportunity.title}
								sourceUrl={opportunity.portalUrl || opportunity.rfpLink}
								documentsDiscovered={opportunity.documentsDiscovered || documents.length > 0}
								initialDocuments={documents.map(d => ({
									...d,
									documentType: d.documentType as "rfp" | "amendment" | "attachment" | "specification" | "evaluation" | "form" | "other",
									status: d.status as "discovered" | "downloading" | "downloaded" | "failed" | "analyzed" | "error",
									discoveredAt: new Date(d.discoveredAt),
									downloadedAt: d.downloadedAt ? new Date(d.downloadedAt) : null,
								}))}
							/>
						</Suspense>
					</div>

					{/* Right column - Voting and AI Scores */}
					<div className="space-y-6">
						{/* Go/No-Go Panel */}
						<Suspense fallback={<CardSkeleton title="Go/No-Go Decision" />}>
							<GoNoGoPanel
								opportunityId={id}
								initialSummary={voteSummary}
								initialVotes={votes}
							/>
						</Suspense>

						{/* AI Scores */}
						<Suspense fallback={<CardSkeleton title="AI Analysis" />}>
							<AIScoreCard
								opportunityId={id}
								initialScores={aiScores}
							/>
						</Suspense>

						{/* Quick Info Card */}
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-base">Quick Info</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3 text-sm">
								{opportunity.budgetValue && (
									<div className="flex justify-between">
										<span className="text-[var(--foreground-muted)]">Budget</span>
										<span className="font-medium">{opportunity.budgetValue}</span>
									</div>
								)}
								{opportunity.category && (
									<div className="flex justify-between">
										<span className="text-[var(--foreground-muted)]">Category</span>
										<span className="font-medium">{opportunity.category}</span>
									</div>
								)}
								{opportunity.sector && (
									<div className="flex justify-between">
										<span className="text-[var(--foreground-muted)]">Sector</span>
										<span className="font-medium">{opportunity.sector}</span>
									</div>
								)}
								{opportunity.opportunityType && (
									<div className="flex justify-between">
										<span className="text-[var(--foreground-muted)]">Type</span>
										<span className="font-medium uppercase">{opportunity.opportunityType}</span>
									</div>
								)}
								{opportunity.sourcePlatform && (
									<div className="flex justify-between">
										<span className="text-[var(--foreground-muted)]">Source</span>
										<span className="font-medium">{opportunity.sourcePlatform}</span>
									</div>
								)}
								{opportunity.rfpLink && (
									<div className="pt-2 border-t border-border mt-2">
										<div className="flex items-center justify-between">
											<span className="text-sm text-muted-foreground">Source RFP</span>
											<a
												href={opportunity.rfpLink}
												target="_blank"
												rel="noopener noreferrer"
												className="text-primary hover:underline flex items-center gap-1 text-sm font-medium"
												title="Opens the actual RFP document in a new tab"
											>
												<ExternalLinkIcon className="h-4 w-4" />
												Open RFP
											</a>
										</div>
										<p className="text-xs text-muted-foreground mt-1 truncate" title={opportunity.rfpLink}>
											{opportunity.rfpLink.length > 50 
												? opportunity.rfpLink.substring(0, 50) + "..." 
												: opportunity.rfpLink}
										</p>
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</main>
		</div>
	);
}

// ============================================================================
// Helper Components
// ============================================================================

function StatusBadge({ status }: { status: string }) {
	const statusConfig: Record<string, { label: string; className: string }> = {
		pending: {
			label: "Pending Review",
			className: "bg-muted text-muted-foreground",
		},
		interested: {
			label: "Interested",
			className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
		},
		pursuing: {
			label: "Pursuing",
			className: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
		},
		submitted: {
			label: "Submitted",
			className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
		},
		won: {
			label: "Won",
			className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
		},
		lost: {
			label: "Lost",
			className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
		},
		declined: {
			label: "Declined",
			className: "bg-muted text-muted-foreground",
		},
		expired: {
			label: "Expired",
			className: "bg-muted text-muted-foreground",
		},
	};

	const config = statusConfig[status] || statusConfig.pending;

	return (
		<span
			className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}
		>
			{config.label}
		</span>
	);
}

function CardSkeleton({ title }: { title: string }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="animate-pulse space-y-3">
					<div className="h-4 bg-[var(--background-muted)] rounded w-3/4" />
					<div className="h-4 bg-[var(--background-muted)] rounded w-1/2" />
					<div className="h-8 bg-[var(--background-muted)] rounded w-full" />
				</div>
			</CardContent>
		</Card>
	);
}

function formatDate(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(date));
}

// ============================================================================
// Icons
// ============================================================================

function BuildingIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
			/>
		</svg>
	);
}

function GlobeIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
			/>
		</svg>
	);
}

function CalendarIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
			/>
		</svg>
	);
}

function ExternalLinkIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
			/>
		</svg>
	);
}
