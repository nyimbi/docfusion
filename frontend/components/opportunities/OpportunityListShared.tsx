"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DecisionStatus } from "@/lib/types/opportunity";
import type { VoteSummary } from "@/lib/types/opportunity";
import { Button } from "@/components/ui/Button";
import {
	Upload,
	Briefcase,
	ChevronLeft,
	ChevronRight,
	CheckCircle,
	XCircle,
	AlertTriangle,
	FileText,
	ExternalLink,
	Search as SearchIcon,
} from "lucide-react";

// ============================================================================
// Status Color Map (shared between table and grid)
// ============================================================================

export const statusColors: Record<
	DecisionStatus,
	{ bg: string; text: string; dot: string }
> = {
	pending: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
	interested: { bg: "bg-blue-500/10", text: "text-blue-500", dot: "bg-blue-500" },
	pursuing: { bg: "bg-purple-500/10", text: "text-purple-500", dot: "bg-purple-500" },
	submitted: { bg: "bg-amber-500/10", text: "text-amber-500", dot: "bg-amber-500" },
	won: { bg: "bg-green-500/10", text: "text-green-500", dot: "bg-green-500" },
	lost: { bg: "bg-red-500/10", text: "text-red-500", dot: "bg-red-500" },
	shortlisted: { bg: "bg-teal-500/10", text: "text-teal-500", dot: "bg-teal-500" },
	declined: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
	expired: { bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive" },
};

// ============================================================================
// VoteStatusBadge
// ============================================================================

export function VoteStatusBadge({ voteSummary }: { voteSummary?: VoteSummary }) {
	if (!voteSummary || voteSummary.totalVotes === 0) {
		return (
			<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-muted-foreground bg-muted">
				<span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
				No votes
			</span>
		);
	}

	const { goCount, noGoCount, hasConsensus, recommendedDecision } = voteSummary;

	if (hasConsensus && recommendedDecision === "go") {
		return (
			<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-green-500 bg-green-500/10 border border-green-500/20">
				<CheckCircle className="w-3 h-3" />
				Go ({goCount})
			</span>
		);
	}

	if (hasConsensus && recommendedDecision === "no_go") {
		return (
			<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-red-500 bg-red-500/10 border border-red-500/20">
				<XCircle className="w-3 h-3" />
				No Go ({noGoCount})
			</span>
		);
	}

	return (
		<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-amber-500 bg-amber-500/10 border border-amber-500/20">
			<AlertTriangle className="w-3 h-3" />
			Pending ({goCount}Go/{noGoCount}No)
		</span>
	);
}

// ============================================================================
// RFPDocumentsSection
// ============================================================================

export function RFPDocumentsSection({
	rfpLink,
	title,
	organization,
}: {
	rfpLink?: string | null;
	title: string;
	organization?: string | null;
}) {
	const hasRfpLink = !!rfpLink && rfpLink.trim().length > 0;
	const searchQuery = encodeURIComponent(`${title} ${organization || ""} RFP tender`);
	const googleSearchUrl = `https://www.google.com/search?q=${searchQuery}`;

	return (
		<div className="flex items-center gap-2 mt-3">
			{hasRfpLink ? (
				<>
					<a
						href={rfpLink!}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-[var(--accent-400)] bg-[var(--accent-500)]/10 border border-[var(--accent-500)]/20 hover:bg-[var(--accent-500)]/20 transition-colors"
					>
						<FileText className="w-3 h-3" />
						<span className="truncate max-w-20">RFP Doc</span>
						<ExternalLink className="w-2.5 h-2.5" />
					</a>
					<a
						href={googleSearchUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-[var(--ink-400)] bg-[var(--ink-800)]/50 border border-[var(--ink-700)]/50 hover:text-[var(--ink-200)] hover:bg-[var(--ink-800)] transition-colors"
						title="Search on Google"
					>
						<SearchIcon className="w-3 h-3" />
					</a>
				</>
			) : (
				<a
					href={googleSearchUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-[var(--ink-400)] bg-[var(--ink-800)]/50 border border-[var(--ink-700)]/50 hover:text-[var(--ink-200)] hover:bg-[var(--ink-800)] transition-colors"
				>
					<SearchIcon className="w-3 h-3" />
					Find Documents
				</a>
			)}
		</div>
	);
}

// ============================================================================
// Pagination
// ============================================================================

export interface PaginationProps {
	page: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}

export const Pagination = React.memo(function Pagination({
	page,
	totalPages,
	onPageChange,
}: PaginationProps) {
	return (
		<div className="flex items-center justify-between mt-6 pt-6 border-t border-[var(--ink-800)]/50">
			<span className="text-sm text-[var(--ink-500)]">
				Page {page} of {totalPages}
			</span>
			<div className="flex items-center gap-2">
				<Button
					variant="ghost"
					size="sm"
					disabled={page === 1}
					onClick={() => onPageChange(page - 1)}
					className="text-[var(--ink-400)] disabled:opacity-50"
				>
					<ChevronLeft className="w-4 h-4" />
					Previous
				</Button>
				<Button
					variant="ghost"
					size="sm"
					disabled={page === totalPages}
					onClick={() => onPageChange(page + 1)}
					className="text-[var(--ink-400)] disabled:opacity-50"
				>
					Next
					<ChevronRight className="w-4 h-4" />
				</Button>
			</div>
		</div>
	);
});

// ============================================================================
// EmptyState
// ============================================================================

export function EmptyState({ hasFilters }: { hasFilters: boolean }) {
	return (
		<div className="flex flex-col items-center justify-center py-24 animate-fade-up">
			<div className="relative mb-8">
				<div className="absolute inset-0 bg-[var(--accent-500)]/20 rounded-3xl blur-2xl" />
				<div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-[var(--accent-500)] to-[var(--accent-700)] flex items-center justify-center">
					<Briefcase className="w-12 h-12 text-white" />
				</div>
			</div>

			<h3 className="heading-display text-2xl text-[var(--ink-100)] mb-3">
				{hasFilters ? "No matching opportunities" : "No opportunities yet"}
			</h3>
			<p className="text-[var(--ink-500)] text-center max-w-md mb-8 leading-relaxed">
				{hasFilters
					? "Try adjusting your filters or search query to find opportunities. Expired opportunities are hidden by default."
					: "Import your first batch of RFPs, EOIs, or tenders to get started."}
			</p>

			{!hasFilters && (
				<Link href="/opportunities/import">
					<Button
						className="bg-[var(--accent-500)] hover:bg-[var(--accent-400)] text-[var(--ink-950)] font-semibold px-6"
						size="lg"
					>
						<Upload className="w-5 h-5" />
						Import Opportunities
					</Button>
				</Link>
			)}
		</div>
	);
}

// ============================================================================
// Loading Skeletons
// ============================================================================

export function PageSkeleton() {
	return (
		<div className="relative">
			<div className="h-8 w-48 bg-[var(--ink-800)] rounded animate-pulse mb-6" />
			<div className="grid grid-cols-6 gap-4 mb-8">
				{Array.from({ length: 6 }).map((_, i) => (
					<div key={i} className="h-16 bg-[var(--ink-800)]/50 rounded-xl animate-pulse" />
				))}
			</div>
			<div className="space-y-3">
				{Array.from({ length: 8 }).map((_, i) => (
					<div key={i} className="h-16 bg-[var(--ink-800)]/50 rounded-xl animate-pulse" />
				))}
			</div>
		</div>
	);
}

export function LoadingSkeleton({ viewMode }: { viewMode: "grid" | "list" }) {
	if (viewMode === "grid") {
		return (
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{Array.from({ length: 6 }).map((_, i) => (
					<div
						key={i}
						className="p-5 rounded-2xl bg-[var(--ink-900)]/40 border border-[var(--ink-800)]/30"
					>
						<div className="h-5 w-20 bg-[var(--ink-800)] rounded mb-3 animate-pulse" />
						<div className="h-5 w-3/4 bg-[var(--ink-800)] rounded mb-2 animate-pulse" />
						<div className="h-4 w-1/2 bg-[var(--ink-800)] rounded mb-4 animate-pulse" />
						<div className="flex gap-2 pt-3 border-t border-[var(--ink-800)]/30">
							<div className="h-3 w-16 bg-[var(--ink-800)] rounded animate-pulse" />
							<div className="h-3 w-20 bg-[var(--ink-800)] rounded animate-pulse" />
						</div>
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="border border-[var(--ink-800)]/50 rounded-xl overflow-hidden bg-[var(--ink-900)]/20">
			{Array.from({ length: 10 }).map((_, i) => (
				<div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[var(--ink-800)]/30">
					<div className="w-5 h-5 bg-[var(--ink-800)] rounded animate-pulse" />
					<div className="flex-1">
						<div className="h-4 w-1/3 bg-[var(--ink-800)] rounded mb-1 animate-pulse" />
						<div className="h-3 w-1/4 bg-[var(--ink-800)] rounded animate-pulse" />
					</div>
					<div className="h-4 w-24 bg-[var(--ink-800)] rounded animate-pulse" />
					<div className="h-4 w-20 bg-[var(--ink-800)] rounded animate-pulse" />
				</div>
			))}
		</div>
	);
}
