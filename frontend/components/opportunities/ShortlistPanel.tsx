"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	BookmarkCheck,
	X,
	BarChart3,
	Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getOpportunities } from "@/lib/actions/opportunities";
import type { OpportunityListItem } from "@/lib/types/opportunity";

interface ShortlistPanelProps {
	isOpen: boolean;
	onClose: () => void;
	onCompare?: (ids: string[]) => void;
}

export function ShortlistPanel({ isOpen, onClose, onCompare }: ShortlistPanelProps) {
	const [selectedForCompare, setSelectedForCompare] = React.useState<Set<string>>(new Set());

	const { data, isLoading } = useQuery({
		queryKey: ["opportunities", "shortlisted"],
		queryFn: () =>
			getOpportunities(
				{ statuses: ["shortlisted"] },
				{ field: "deadline", direction: "asc" },
				{ page: 1, pageSize: 50 }
			),
		enabled: isOpen,
		staleTime: 2 * 60 * 1000,
	});

	const shortlisted = data?.data ?? [];

	const toggleCompare = (id: string) => {
		setSelectedForCompare((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else if (next.size < 4) {
				next.add(id);
			}
			return next;
		});
	};

	const handleCompare = () => {
		if (onCompare && selectedForCompare.size >= 2) {
			onCompare(Array.from(selectedForCompare));
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-y-0 right-0 z-50 w-96 bg-background border-l border-border shadow-2xl">
			<div className="flex items-center justify-between px-4 py-3 border-b border-border">
				<div className="flex items-center gap-2">
					<BookmarkCheck className="w-5 h-5 text-amber-500" />
					<h2 className="text-base font-semibold text-foreground">Shortlist</h2>
					<span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
						{shortlisted.length}
					</span>
				</div>
				<div className="flex items-center gap-1">
					{selectedForCompare.size >= 2 && (
						<Button size="sm" onClick={handleCompare} className="gap-1 h-8">
							<BarChart3 className="w-3.5 h-3.5" />
							Compare ({selectedForCompare.size})
						</Button>
					)}
					<button
						onClick={onClose}
						className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
					>
						<X className="w-4 h-4" />
					</button>
				</div>
			</div>

			<div className="overflow-y-auto h-[calc(100vh-60px)]">
				{isLoading ? (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
					</div>
				) : shortlisted.length === 0 ? (
					<div className="px-6 py-12 text-center">
						<BookmarkCheck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
						<p className="text-sm text-muted-foreground">No shortlisted opportunities yet</p>
						<p className="text-xs text-muted-foreground/60 mt-1">
							Select opportunities from the list and click Shortlist
						</p>
					</div>
				) : (
					<div className="divide-y divide-border">
						{shortlisted.map((opp) => (
							<ShortlistItem
								key={opp.id}
								opportunity={opp}
								isSelected={selectedForCompare.has(opp.id)}
								onToggleCompare={() => toggleCompare(opp.id)}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function ShortlistItem({
	opportunity,
	isSelected,
	onToggleCompare,
}: {
	opportunity: OpportunityListItem;
	isSelected: boolean;
	onToggleCompare: () => void;
}) {
	const isUrgent = opportunity.daysLeft !== null && opportunity.daysLeft < 7;
	const isSoon = opportunity.daysLeft !== null && opportunity.daysLeft < 14;

	return (
		<div className="group px-4 py-3 hover:bg-accent/50 transition-colors">
			<div className="flex items-start gap-3">
				<button
					onClick={onToggleCompare}
					className={cn(
						"mt-0.5 w-4 h-4 rounded border transition-colors shrink-0",
						isSelected ? "bg-primary border-primary" : "border-border hover:border-primary"
					)}
				>
					{isSelected && (
						<svg className="w-3 h-3 text-white mx-auto mt-0.5" viewBox="0 0 12 12" fill="none">
							<path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					)}
				</button>

				<div className="flex-1 min-w-0">
					<Link
						href={`/opportunities/${opportunity.id}`}
						className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2"
					>
						{opportunity.title}
					</Link>

					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
						{opportunity.organization && (
							<span className="truncate max-w-[120px]">{opportunity.organization}</span>
						)}
						{opportunity.daysLeft !== null && (
							<span className={cn(
								isUrgent ? "text-red-500 font-medium" : isSoon ? "text-amber-500" : "text-green-600"
							)}>
								{opportunity.daysLeft}d left
							</span>
						)}
						{opportunity.fitScore !== null && (
							<span className="text-primary">
								Fit {Math.round(opportunity.fitScore)}
							</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
