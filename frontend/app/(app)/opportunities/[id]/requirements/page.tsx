/**
 * Requirements Page - DocFusion
 *
 * Dashboard for viewing and managing RFP requirements for an opportunity.
 * Features requirements table, stats overview, extraction, and gap analysis.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getOpportunity } from "@/lib/actions/opportunities";
import { getRequirements, getRequirementStats, analyzeRequirementGaps } from "@/lib/actions/requirements";
import { listComplianceMatrices, listRfpDocuments } from "@/lib/actions/rfp-parser";
import { getResponseWinThemeSeedReview } from "@/lib/actions/win-themes";
import { RequirementsClientPage } from "./RequirementsClientPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function RequirementsPage({ params }: PageProps) {
	const { id } = await params;

	// Fetch data in parallel
	const [opportunity, requirementsResponse, stats, gapAnalysis, rfpDocumentsResponse, complianceMatricesResponse, winThemeSeedReviewResponse] = await Promise.all([
		getOpportunity(id),
		getRequirements(id),
		getRequirementStats(id),
		analyzeRequirementGaps(id),
		listRfpDocuments({ opportunityId: id, limit: null }),
		listComplianceMatrices({ opportunityId: id, limit: 5 }),
		getResponseWinThemeSeedReview(id),
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
						<span className="text-[var(--foreground)] font-medium">Requirements</span>
					</nav>

					{/* Title */}
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h1 className="text-2xl font-semibold text-[var(--foreground)]">
								Requirements
							</h1>
							<p className="text-sm text-[var(--foreground-muted)] mt-1">
								{stats.total} requirements extracted from RFP
							</p>
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				<div className="space-y-6">
					{/* Stats Overview */}
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<StatCard
							label="Total"
							value={stats.total}
							icon={<DocumentIcon className="h-5 w-5" />}
						/>
						<StatCard
							label="Compliant"
							value={stats.byStatus.compliant}
							total={stats.total}
							variant="success"
							icon={<CheckIcon className="h-5 w-5" />}
						/>
						<StatCard
							label="Not Addressed"
							value={stats.byStatus.not_addressed}
							total={stats.total}
							variant="warning"
							icon={<ClockIcon className="h-5 w-5" />}
						/>
						<StatCard
							label="Compliance"
							value={`${stats.compliancePercentage}%`}
							progress={stats.compliancePercentage}
							icon={<ChartIcon className="h-5 w-5" />}
						/>
					</div>

					{/* Gap Analysis Alert */}
					{gapAnalysis.gaps.length > 0 && (
						<Card className="border-[var(--warning-500)] bg-[var(--warning-50)] dark:bg-[var(--warning-950)]">
							<CardHeader className="pb-2">
								<CardTitle className="text-base flex items-center gap-2 text-[var(--warning-700)] dark:text-[var(--warning-300)]">
									<AlertIcon className="h-5 w-5" />
									Gap Analysis: {gapAnalysis.gaps.length} issue{gapAnalysis.gaps.length !== 1 ? "s" : ""} found
								</CardTitle>
							</CardHeader>
							<CardContent>
								<ul className="space-y-2">
									{gapAnalysis.gaps.slice(0, 3).map((gap, i) => (
										<li key={i} className="text-sm text-[var(--warning-700)] dark:text-[var(--warning-300)]">
											<span className="font-medium capitalize">{gap.category}:</span>{" "}
											{gap.description}
										</li>
									))}
								</ul>
								{gapAnalysis.recommendations.length > 0 && (
									<div className="mt-3 pt-3 border-t border-[var(--warning-200)] dark:border-[var(--warning-800)]">
										<p className="text-sm font-medium text-[var(--warning-700)] dark:text-[var(--warning-300)] mb-1">
											Recommendations:
										</p>
										<ul className="text-sm text-[var(--warning-600)] dark:text-[var(--warning-400)] space-y-1">
											{gapAnalysis.recommendations.map((rec, i) => (
												<li key={i}>• {rec}</li>
											))}
										</ul>
									</div>
								)}
							</CardContent>
						</Card>
					)}

					{/* Requirements Table and Detail */}
					<Suspense fallback={<TableSkeleton />}>
						<RequirementsClientPage
							opportunityId={id}
							initialRequirements={requirementsResponse.data}
							initialStats={stats}
							initialRfpDocuments={rfpDocumentsResponse.documents.map((doc) => ({
								id: doc.id,
								filename: doc.filename,
								parsingStatus: doc.parsingStatus,
								parsingConfidence: doc.parsingConfidence,
								metadata: doc.metadata,
								createdAt: doc.createdAt.toISOString(),
							}))}
							initialComplianceMatrices={complianceMatricesResponse.matrices.map((matrix) => ({
								id: matrix.id,
								name: matrix.name,
								status: matrix.status,
								totalRequirements: matrix.totalRequirements,
								compliantCount: matrix.compliantCount,
								partialCount: matrix.partialCount,
								notAddressedCount: matrix.notAddressedCount,
								updatedAt: matrix.updatedAt.toISOString(),
							}))}
							initialWinThemeSeedReview={winThemeSeedReviewResponse.success ? winThemeSeedReviewResponse.data : undefined}
						/>
					</Suspense>
				</div>
			</main>
		</div>
	);
}

// ============================================================================
// Helper Components
// ============================================================================

function StatCard({
	label,
	value,
	total,
	variant,
	progress,
	icon,
}: {
	label: string;
	value: number | string;
	total?: number;
	variant?: "success" | "warning" | "error";
	progress?: number;
	icon?: React.ReactNode;
}) {
	const variantColors = {
		success: "text-green-600 dark:text-green-400",
		warning: "text-yellow-600 dark:text-yellow-400",
		error: "text-red-600 dark:text-red-400",
	};

	return (
		<Card>
			<CardContent className="pt-4">
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm text-[var(--foreground-muted)]">{label}</p>
						<p
							className={`text-2xl font-semibold ${
								variant ? variantColors[variant] : "text-[var(--foreground)]"
							}`}
						>
							{value}
							{total !== undefined && (
								<span className="text-sm font-normal text-[var(--foreground-muted)] ml-1">
									/ {total}
								</span>
							)}
						</p>
					</div>
					{icon && (
						<div className="p-2 rounded-lg bg-[var(--background-muted)] text-[var(--foreground-muted)]">
							{icon}
						</div>
					)}
				</div>
				{progress !== undefined && (
					<div className="mt-3">
						<div className="h-2 bg-[var(--background-muted)] rounded-full overflow-hidden">
							<div
								className="h-full bg-green-500 rounded-full transition-all duration-500"
								style={{ width: `${progress}%` }}
							/>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function TableSkeleton() {
	return (
		<Card>
			<CardContent className="p-6">
				<div className="animate-pulse space-y-4">
					<div className="h-10 bg-[var(--background-muted)] rounded w-full" />
					<div className="h-8 bg-[var(--background-muted)] rounded w-full" />
					<div className="h-8 bg-[var(--background-muted)] rounded w-full" />
					<div className="h-8 bg-[var(--background-muted)] rounded w-full" />
					<div className="h-8 bg-[var(--background-muted)] rounded w-full" />
				</div>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Icons
// ============================================================================

function DocumentIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
			/>
		</svg>
	);
}

function CheckIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M5 13l4 4L19 7"
			/>
		</svg>
	);
}

function ClockIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
	);
}

function ChartIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
			/>
		</svg>
	);
}

function AlertIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
			/>
		</svg>
	);
}
