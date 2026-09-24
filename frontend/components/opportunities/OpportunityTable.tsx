"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { OpportunityListItem, OpportunitySort } from "@/lib/types/opportunity";
import type { VoteSummary } from "@/lib/types/opportunity";
import { statusColors, VoteStatusBadge } from "./OpportunityListShared";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Check,
	MoreHorizontal,
	Star,
	Eye,
	Trash2,
	ExternalLink,
	FileText,
	Search as SearchIcon,
} from "lucide-react";

// ============================================================================
// Props
// ============================================================================

export interface OpportunityTableProps {
	opportunities: OpportunityListItem[];
	selectedIds: Set<string>;
	onSelectAll: () => void;
	onSelect: (id: string) => void;
	sort: OpportunitySort;
	onSort: (field: OpportunitySort["field"]) => void;
	voteSummaries: Map<string, VoteSummary>;
}

interface SortableHeaderProps {
	field: OpportunitySort["field"];
	label: string;
	currentSort: OpportunitySort;
	onSort: (field: OpportunitySort["field"]) => void;
}

interface OpportunityRowProps {
	opportunity: OpportunityListItem;
	isSelected: boolean;
	onSelect: () => void;
	index: number;
	voteSummary?: VoteSummary;
}

// ============================================================================
// SortableHeader
// ============================================================================

function SortableHeader({ field, label, currentSort, onSort }: SortableHeaderProps) {
	const isActive = currentSort.field === field;

	return (
		<th className="px-4 py-3 text-left">
			<button
				type="button"
				onClick={() => onSort(field)}
				className={cn(
					"flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors",
					isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
				)}
			>
				{label}
				{isActive && <span>{currentSort.direction === "asc" ? "\u2191" : "\u2193"}</span>}
			</button>
		</th>
	);
}

// ============================================================================
// OpportunityRow
// ============================================================================

function OpportunityRow({
	opportunity,
	isSelected,
	onSelect,
	index,
	voteSummary,
}: OpportunityRowProps) {
	const status = statusColors[opportunity.decisionStatus];

	return (
		<tr
			className={cn(
				"border-b border-border/30 transition-colors",
				isSelected ? "bg-primary/5" : "hover:bg-muted/30",
				"opacity-0 animate-fade-up"
			)}
			style={{
				animationDelay: `${Math.min(index * 30, 300)}ms`,
				animationFillMode: "forwards",
			}}
		>
			<td className="px-4 py-3">
				<button
					type="button"
					onClick={onSelect}
					className={cn(
						"w-5 h-5 rounded-md flex items-center justify-center",
						"border-2 transition-all duration-150",
						isSelected
							? "bg-primary border-primary text-white"
							: "border-input hover:border-primary"
					)}
				>
					{isSelected && <Check className="w-3 h-3" />}
				</button>
			</td>
			<td className="px-4 py-3">
				<Link
					href={`/opportunities/${opportunity.id}`}
					className="text-foreground font-medium hover:text-primary transition-colors line-clamp-1"
				>
					{opportunity.title}
				</Link>
				{opportunity.category && (
					<div className="text-xs text-muted-foreground mt-0.5">{opportunity.category}</div>
				)}
			</td>
			<td className="px-4 py-3 text-sm text-muted-foreground">
				{opportunity.organization || "\u2014"}
			</td>
			<td className="px-4 py-3 text-sm text-muted-foreground">
				{opportunity.countryRegion || "\u2014"}
			</td>
			<td className="px-4 py-3 text-sm">
				{opportunity.deadline ? (
					<div className={cn(opportunity.isExpired && "text-destructive")}>
						{new Date(opportunity.deadline).toLocaleDateString()}
						{opportunity.daysLeft !== null && opportunity.daysLeft > 0 && (
							<div className="text-xs text-muted-foreground">{opportunity.daysLeft}d</div>
						)}
						{opportunity.isExpired && <div className="text-xs text-red-500">Expired</div>}
					</div>
				) : (
					<span className="text-muted-foreground">{"\u2014"}</span>
				)}
			</td>
			<td className="px-4 py-3 text-sm text-muted-foreground">
				{opportunity.budgetValue || "\u2014"}
			</td>
			<td className="px-4 py-3">
				<div className="flex items-center gap-0.5">
					{Array.from({ length: 5 }, (_, i) => (
						<Star
							key={i}
							className={cn(
								"w-3 h-3",
								i < opportunity.priorityRank
									? "fill-primary text-primary"
									: "text-muted-foreground/40"
							)}
						/>
					))}
				</div>
			</td>
			<td className="px-4 py-3">
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
			</td>
			<td className="px-4 py-3">
				<VoteStatusBadge voteSummary={voteSummary} />
			</td>
			<td className="px-4 py-3">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
							<MoreHorizontal className="w-4 h-4" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="bg-card border-border">
						<DropdownMenuItem asChild className="text-foreground">
							<Link href={`/opportunities/${opportunity.id}`}>
								<Eye className="w-4 h-4 mr-2" />
								View Details
							</Link>
						</DropdownMenuItem>
						{(opportunity as { rfpLink?: string }).rfpLink && (
							<DropdownMenuItem asChild className="text-foreground">
								<a
									href={(opportunity as { rfpLink?: string }).rfpLink!}
									target="_blank"
									rel="noopener noreferrer"
								>
									<FileText className="w-4 h-4 mr-2" />
									Open RFP Document
								</a>
							</DropdownMenuItem>
						)}
						<DropdownMenuItem asChild className="text-foreground">
							<a
								href={`https://www.google.com/search?q=${encodeURIComponent(
									`${opportunity.title} ${opportunity.organization || ""} RFP`
								)}`}
								target="_blank"
								rel="noopener noreferrer"
							>
								<SearchIcon className="w-4 h-4 mr-2" />
								Search on Google
							</a>
						</DropdownMenuItem>
						{opportunity.tags.length > 0 && (
							<DropdownMenuItem asChild className="text-foreground">
								<a href={opportunity.tags[0]} target="_blank" rel="noopener noreferrer">
									<ExternalLink className="w-4 h-4 mr-2" />
									Open Link
								</a>
							</DropdownMenuItem>
						)}
						<DropdownMenuSeparator />
						<DropdownMenuItem className="text-destructive">
							<Trash2 className="w-4 h-4 mr-2" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</td>
		</tr>
	);
}

// ============================================================================
// OpportunityTable
// ============================================================================

export const OpportunityTable = React.memo(function OpportunityTable({
	opportunities,
	selectedIds,
	onSelectAll,
	onSelect,
	sort,
	onSort,
	voteSummaries,
}: OpportunityTableProps) {
	const allSelected = selectedIds.size === opportunities.length && opportunities.length > 0;

	return (
		<div className="border border-border/50 rounded-xl overflow-hidden bg-card">
			<div className="overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr className="border-b border-border/50 bg-muted/50">
							<th className="w-12 px-4 py-3">
								<button
									type="button"
									onClick={onSelectAll}
									className={cn(
										"w-5 h-5 rounded-md flex items-center justify-center",
										"border-2 transition-all duration-150",
										allSelected
											? "bg-primary border-primary text-white"
											: "border-input hover:border-primary"
									)}
								>
									{allSelected && <Check className="w-3 h-3" />}
								</button>
							</th>
							<SortableHeader field="title" label="Opportunity" currentSort={sort} onSort={onSort} />
							<SortableHeader field="organization" label="Organization" currentSort={sort} onSort={onSort} />
							<SortableHeader field="countryRegion" label="Location" currentSort={sort} onSort={onSort} />
							<SortableHeader field="deadline" label="Deadline" currentSort={sort} onSort={onSort} />
							<SortableHeader field="budgetNumeric" label="Budget" currentSort={sort} onSort={onSort} />
							<SortableHeader field="priorityRank" label="Priority" currentSort={sort} onSort={onSort} />
							<th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
								Status
							</th>
							<th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
								Vote Status
							</th>
							<th className="w-12 px-4 py-3" />
						</tr>
					</thead>
					<tbody>
						{opportunities.map((opp, index) => (
							<OpportunityRow
								key={opp.id}
								opportunity={opp}
								isSelected={selectedIds.has(opp.id)}
								onSelect={() => onSelect(opp.id)}
								index={index}
								voteSummary={voteSummaries.get(opp.id)}
							/>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
});
