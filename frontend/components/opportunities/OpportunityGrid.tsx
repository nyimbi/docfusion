"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { OpportunityListItem } from "@/lib/types/opportunity";
import type { VoteSummary } from "@/lib/types/opportunity";
import { statusColors, VoteStatusBadge, RFPDocumentsSection } from "./OpportunityListShared";
import {
	Check,
	MapPin,
	DollarSign,
	Star,
	Building2,
} from "lucide-react";

// ============================================================================
// Props
// ============================================================================

export interface OpportunityGridProps {
	opportunities: OpportunityListItem[];
	selectedIds: Set<string>;
	onSelect: (id: string) => void;
	voteSummaries: Map<string, VoteSummary>;
}

interface OpportunityCardProps {
	opportunity: OpportunityListItem;
	isSelected: boolean;
	onSelect: () => void;
	index: number;
	voteSummary?: VoteSummary;
}

// ============================================================================
// OpportunityCard
// ============================================================================

function OpportunityCard({
	opportunity,
	isSelected,
	onSelect,
	index,
	voteSummary,
}: OpportunityCardProps) {
	const status = statusColors[opportunity.decisionStatus];

	return (
		<Link
			href={`/opportunities/${opportunity.id}`}
			className={cn(
				"group relative flex flex-col p-5 rounded-2xl",
				"bg-gradient-to-br from-[var(--ink-900)]/80 to-[var(--ink-900)]/40",
				"border transition-all duration-300 ease-out",
				"hover:border-[var(--accent-500)]/50 hover:shadow-lg hover:shadow-[var(--accent-500)]/5",
				isSelected
					? "border-[var(--accent-500)] ring-1 ring-[var(--accent-500)]/20"
					: "border-[var(--ink-800)]/50",
				"opacity-0 animate-fade-up"
			)}
			style={{
				animationDelay: `${Math.min(index * 50, 400)}ms`,
				animationFillMode: "forwards",
			}}
		>
			{/* Selection checkbox */}
			<button
				type="button"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					onSelect();
				}}
				className={cn(
					"absolute top-4 left-4 w-5 h-5 rounded-md flex items-center justify-center z-10",
					"border-2 transition-all duration-150",
					isSelected
						? "bg-[var(--accent-500)] border-[var(--accent-500)] text-white"
						: "border-[var(--ink-600)] hover:border-[var(--accent-500)]"
				)}
			>
				{isSelected && <Check className="w-3 h-3" />}
			</button>

			{/* Header */}
			<div className="flex items-start justify-between gap-2 ml-8 mb-3">
				<div className="flex items-center gap-1.5 flex-wrap">
					<span
						className={cn(
							"inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
							status.bg,
							status.text
						)}
					>
						<span className={cn("w-1.5 h-1.5 rounded-full", status.dot)} />
						{opportunity.decisionStatus}
					</span>
					<VoteStatusBadge voteSummary={voteSummary} />
					{opportunity.category && (
						<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-[var(--ink-400)] bg-[var(--ink-800)]/50">
							{opportunity.category}
						</span>
					)}
				</div>
				{opportunity.daysLeft !== null && opportunity.daysLeft > 0 && (
					<span
						className={cn(
							"text-xs font-medium",
							opportunity.daysLeft <= 7 ? "text-[var(--error-400)]" : "text-[var(--ink-500)]"
						)}
					>
						{opportunity.daysLeft}d left
					</span>
				)}
				{opportunity.isExpired && <span className="text-xs font-medium text-red-500">Expired</span>}
			</div>

			{/* Content */}
			<div className="flex-1 ml-8">
				<h3 className="text-[var(--ink-100)] font-semibold text-base mb-2 line-clamp-2 group-hover:text-[var(--accent-300)] transition-colors">
					{opportunity.title}
				</h3>
				{opportunity.organization && (
					<p className="text-sm text-[var(--ink-500)] flex items-center gap-1.5 mb-2">
						<Building2 className="w-3.5 h-3.5" />
						{opportunity.organization}
					</p>
				)}
			</div>

			{/* RFP Documents */}
			<div className="ml-8">
				<RFPDocumentsSection
					rfpLink={(opportunity as { rfpLink?: string }).rfpLink}
					title={opportunity.title}
					organization={opportunity.organization}
				/>
			</div>

			{/* Meta */}
			<div className="flex flex-wrap items-center gap-3 mt-3 pt-3 ml-8 border-t border-[var(--ink-800)]/50 text-xs text-[var(--ink-500)]">
				{opportunity.countryRegion && (
					<span className="flex items-center gap-1">
						<MapPin className="w-3 h-3" />
						{opportunity.countryRegion}
					</span>
				)}
				{opportunity.budgetValue && (
					<span className="flex items-center gap-1">
						<DollarSign className="w-3 h-3" />
						{opportunity.budgetValue}
					</span>
				)}
			</div>

			{/* Priority Stars */}
			<div className="flex items-center justify-between mt-3 ml-8">
				<div className="flex items-center gap-0.5">
					{Array.from({ length: 5 }, (_, i) => (
						<Star
							key={i}
							className={cn(
								"w-3.5 h-3.5",
								i < opportunity.priorityRank
									? "fill-[var(--accent-400)] text-[var(--accent-400)]"
									: "text-[var(--ink-700)]"
							)}
						/>
					))}
				</div>
				{opportunity.fitScore !== null && (
					<span className="text-xs font-medium text-[var(--accent-400)]">
						{Math.round(opportunity.fitScore)}% fit
					</span>
				)}
			</div>
		</Link>
	);
}

// ============================================================================
// OpportunityGrid
// ============================================================================

export const OpportunityGrid = React.memo(function OpportunityGrid({
	opportunities,
	selectedIds,
	onSelect,
	voteSummaries,
}: OpportunityGridProps) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{opportunities.map((opp, index) => (
				<OpportunityCard
					key={opp.id}
					opportunity={opp}
					isSelected={selectedIds.has(opp.id)}
					onSelect={() => onSelect(opp.id)}
					index={index}
					voteSummary={voteSummaries.get(opp.id)}
				/>
			))}
		</div>
	);
});
