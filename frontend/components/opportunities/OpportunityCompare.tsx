"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { X, ArrowRight, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getOpportunity } from "@/lib/actions/opportunities";
import type { Opportunity } from "@/lib/types/opportunity";

interface OpportunityCompareProps {
	opportunityIds: string[];
	isOpen: boolean;
	onClose: () => void;
}

export function OpportunityCompare({ opportunityIds, isOpen, onClose }: OpportunityCompareProps) {
	if (!isOpen || opportunityIds.length < 2) return null;

	return (
		<div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
			<div className="fixed inset-x-4 inset-y-4 md:inset-x-12 md:inset-y-8 bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
				<div className="flex items-center justify-between px-6 py-4 border-b border-border">
					<div>
						<h2 className="text-lg font-semibold text-foreground">Compare Opportunities</h2>
						<p className="text-sm text-muted-foreground">Side-by-side comparison</p>
					</div>
					<button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
						<X className="w-5 h-5" />
					</button>
				</div>
				<div className="flex-1 overflow-auto p-6">
					<div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${opportunityIds.length}, minmax(280px, 1fr))` }}>
						<div className="sticky left-0 bg-background z-10" />
						{opportunityIds.map((id) => (
							<OpportunityHeader key={id} opportunityId={id} />
						))}
						<div className="col-span-full h-px bg-border" />
						<CompareRow label="Organization" ids={opportunityIds} field="organization" />
						<CompareRow label="Category" ids={opportunityIds} field="category" />
						<CompareRow label="Sector" ids={opportunityIds} field="sector" />
						<CompareRow label="Country" ids={opportunityIds} field="countryRegion" />
						<CompareRow label="Budget" ids={opportunityIds} field="budgetValue" />
						<CompareRow label="Deadline" ids={opportunityIds} field="deadline" type="date" />
						<CompareRow label="Days Left" ids={opportunityIds} field="daysLeft" type="number" />
						<CompareRow label="Fit Score" ids={opportunityIds} field="fitScore" type="score" />
						<CompareRow label="Win Probability" ids={opportunityIds} field="winProbability" type="score" />
						<CompareRow label="Priority" ids={opportunityIds} field="priorityRank" type="priority" />
					</div>
				</div>
			</div>
		</div>
	);
}

function OpportunityHeader({ opportunityId }: { opportunityId: string }) {
	const { data: opp, isLoading } = useQuery({
		queryKey: ["opportunity", opportunityId],
		queryFn: () => getOpportunity(opportunityId),
		staleTime: 5 * 60 * 1000,
	});
	if (isLoading) return <div className="p-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
	if (!opp) return <div className="p-4 text-sm text-muted-foreground">Not found</div>;
	return (
		<div className="p-4 bg-muted/30 rounded-lg">
			<Link href={`/opportunities/${opp.id}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors line-clamp-2">{opp.title}</Link>
			<Button size="sm" variant="outline" className="mt-2 w-full gap-1" asChild>
				<Link href={`/opportunities/${opp.id}`}>View <ArrowRight className="w-3 h-3" /></Link>
			</Button>
		</div>
	);
}

function CompareRow({ label, ids, field, type = "text" }: { label: string; ids: string[]; field: keyof Opportunity; type?: string }) {
	return (
		<>
			<div className="sticky left-0 bg-background z-10 flex items-center px-4 py-3 text-sm font-medium text-muted-foreground border-r border-border">{label}</div>
			{ids.map((id) => (
				<CompareCell key={id} opportunityId={id} field={field} type={type} />
			))}
		</>
	);
}

function CompareCell({ opportunityId, field, type }: { opportunityId: string; field: keyof Opportunity; type: string }) {
	const { data: opp } = useQuery({ queryKey: ["opportunity", opportunityId], queryFn: () => getOpportunity(opportunityId), staleTime: 5 * 60 * 1000 });
	if (!opp) return <div className="px-4 py-3 text-sm text-muted-foreground">-</div>;
	const value = opp[field];
	if (value === null || value === undefined) return <div className="px-4 py-3 text-sm text-muted-foreground">-</div>;
	if (type === "date") return <div className="px-4 py-3 text-sm text-foreground">{value ? new Date(String(value)).toLocaleDateString() : "-"}</div>;
	if (type === "score") {
		const score = value as number;
		return (
			<div className="px-4 py-3">
				<div className="flex items-center gap-2">
					<span className={cn("text-sm font-semibold", score >= 70 ? "text-green-600" : score >= 40 ? "text-amber-600" : "text-red-600")}>{Math.round(score)}</span>
					<div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
						<div className={cn("h-full rounded-full", score >= 70 ? "bg-green-500" : score >= 40 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${score}%` }} />
					</div>
				</div>
			</div>
		);
	}
	if (type === "priority") {
		const rank = value as number;
		return <div className="px-4 py-3"><div className="flex gap-0.5">{[1,2,3,4,5].map((n) => (<div key={n} className={cn("w-2 h-2 rounded-full", n <= rank ? "bg-primary" : "bg-muted")} />))}</div></div>;
	}
	if (type === "number") {
		const num = value as number;
		const isUrgent = num < 7;
		const isSoon = num < 14;
		return <div className={cn("px-4 py-3 text-sm", isUrgent ? "text-red-500 font-medium" : isSoon ? "text-amber-500" : "text-foreground")}>{num}d</div>;
	}
	return <div className="px-4 py-3 text-sm text-foreground">{String(value)}</div>;
}
