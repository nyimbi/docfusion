"use client";

/**
 * Pipeline Widget Component
 *
 * Displays pipeline metrics and visualizations for CRM dashboard.
 * Shows deal/account distribution across stages with values.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, DollarSign, Target } from "lucide-react";
import type { DealRow, AccountRow } from "@/lib/db/schema-crm";

interface PipelineWidgetProps {
	deals?: DealRow[];
	accounts?: AccountRow[];
	mode?: "deals" | "accounts";
	accountType?: AccountRow["type"];
	title?: string;
	showTrend?: boolean;
	previousPeriodValue?: number;
	className?: string;
}

// Deal pipeline stages with colors and probabilities
const DEAL_STAGES = [
	{ id: "qualification", label: "Qualification", color: "bg-slate-500", probability: 10 },
	{ id: "discovery", label: "Discovery", color: "bg-blue-500", probability: 25 },
	{ id: "proposal", label: "Proposal", color: "bg-indigo-500", probability: 50 },
	{ id: "negotiation", label: "Negotiation", color: "bg-purple-500", probability: 75 },
	{ id: "closed_won", label: "Won", color: "bg-green-500", probability: 100 },
	{ id: "closed_lost", label: "Lost", color: "bg-red-500", probability: 0 },
];

// Account pipeline stages by type
const ACCOUNT_STAGES: Record<string, { id: string; label: string; color: string }[]> = {
	partner: [
		{ id: "identified", label: "Identified", color: "bg-slate-500" },
		{ id: "researching", label: "Researching", color: "bg-blue-500" },
		{ id: "outreach", label: "Outreach", color: "bg-indigo-500" },
		{ id: "evaluation", label: "Evaluation", color: "bg-purple-500" },
		{ id: "negotiating", label: "Negotiating", color: "bg-pink-500" },
		{ id: "onboarding", label: "Onboarding", color: "bg-orange-500" },
		{ id: "active", label: "Active", color: "bg-green-500" },
	],
	prospect: [
		{ id: "new", label: "New", color: "bg-slate-500" },
		{ id: "contacted", label: "Contacted", color: "bg-blue-500" },
		{ id: "qualified", label: "Qualified", color: "bg-indigo-500" },
		{ id: "discovery", label: "Discovery", color: "bg-purple-500" },
		{ id: "proposal", label: "Proposal", color: "bg-pink-500" },
		{ id: "negotiation", label: "Negotiation", color: "bg-orange-500" },
		{ id: "closed_won", label: "Won", color: "bg-green-500" },
		{ id: "closed_lost", label: "Lost", color: "bg-red-500" },
	],
	lead: [
		{ id: "new", label: "New", color: "bg-slate-500" },
		{ id: "contacted", label: "Contacted", color: "bg-blue-500" },
		{ id: "qualified", label: "Qualified", color: "bg-indigo-500" },
		{ id: "discovery", label: "Discovery", color: "bg-purple-500" },
		{ id: "proposal", label: "Proposal", color: "bg-pink-500" },
		{ id: "negotiation", label: "Negotiation", color: "bg-orange-500" },
		{ id: "closed_won", label: "Won", color: "bg-green-500" },
		{ id: "closed_lost", label: "Lost", color: "bg-red-500" },
	],
	customer: [
		{ id: "onboarding", label: "Onboarding", color: "bg-blue-500" },
		{ id: "active", label: "Active", color: "bg-green-500" },
		{ id: "expansion", label: "Expansion", color: "bg-purple-500" },
		{ id: "at_risk", label: "At Risk", color: "bg-orange-500" },
		{ id: "churned", label: "Churned", color: "bg-red-500" },
	],
};

// Format currency
const formatCurrency = (value: number, currency = "USD") => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
		notation: value >= 1000000 ? "compact" : "standard",
		maximumFractionDigits: value >= 1000000 ? 1 : 0,
	}).format(value);
};

// Calculate trend
const calculateTrend = (current: number, previous: number) => {
	if (previous === 0) return { value: 0, direction: "neutral" as const };
	const change = ((current - previous) / previous) * 100;
	return {
		value: Math.abs(change),
		direction: change > 0 ? ("up" as const) : change < 0 ? ("down" as const) : ("neutral" as const),
	};
};

export function PipelineWidget({
	deals = [],
	accounts = [],
	mode = "deals",
	accountType = "prospect",
	title,
	showTrend = false,
	previousPeriodValue,
	className,
}: PipelineWidgetProps) {
	// Calculate pipeline metrics
	const metrics = useMemo(() => {
		if (mode === "deals") {
			const openDeals = deals.filter((d) => d.status === "open");
			const totalValue = openDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
			const weightedValue = openDeals.reduce((sum, d) => {
				const stage = DEAL_STAGES.find((s) => s.id === d.stage);
				const probability = stage?.probability ?? 0;
				return sum + (d.value ?? 0) * (probability / 100);
			}, 0);

			const byStage = DEAL_STAGES.filter((s) => !["closed_won", "closed_lost"].includes(s.id)).map(
				(stage) => {
					const stageDeals = openDeals.filter((d) => d.stage === stage.id);
					return {
						...stage,
						count: stageDeals.length,
						value: stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0),
					};
				}
			);

			const maxStageValue = Math.max(...byStage.map((s) => s.value), 1);

			return {
				total: totalValue,
				weighted: weightedValue,
				count: openDeals.length,
				byStage,
				maxStageValue,
			};
		} else {
			const stages = ACCOUNT_STAGES[accountType] ?? ACCOUNT_STAGES.prospect;
			const typeAccounts = accounts.filter((a) => a.type === accountType);

			const byStage = stages
				.filter((s) => !["closed_won", "closed_lost", "churned"].includes(s.id))
				.map((stage) => {
					const stageAccounts = typeAccounts.filter((a) => a.stage === stage.id);
					return {
						...stage,
						count: stageAccounts.length,
						value: stageAccounts.reduce((sum, a) => sum + (a.contractValue ?? 0), 0),
					};
				});

			const maxStageCount = Math.max(...byStage.map((s) => s.count), 1);
			const totalValue = byStage.reduce((sum, s) => sum + s.value, 0);

			return {
				total: totalValue,
				weighted: totalValue,
				count: typeAccounts.length,
				byStage,
				maxStageValue: maxStageCount,
			};
		}
	}, [deals, accounts, mode, accountType]);

	const trend = showTrend && previousPeriodValue !== undefined
		? calculateTrend(metrics.total, previousPeriodValue)
		: null;

	const displayTitle = title ?? (mode === "deals" ? "Deal Pipeline" : `${accountType.charAt(0).toUpperCase() + accountType.slice(1)} Pipeline`);

	return (
		<Card className={className}>
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base font-medium">{displayTitle}</CardTitle>
					{mode === "deals" && (
						<Badge variant="outline" className="text-xs">
							{metrics.count} deals
						</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Summary metrics */}
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground flex items-center gap-1">
							<DollarSign className="h-3 w-3" />
							Total Value
						</p>
						<p className="text-2xl font-bold">{formatCurrency(metrics.total)}</p>
						{trend && (
							<div className="flex items-center gap-1 text-xs">
								{trend.direction === "up" ? (
									<TrendingUp className="h-3 w-3 text-green-500" />
								) : trend.direction === "down" ? (
									<TrendingDown className="h-3 w-3 text-red-500" />
								) : (
									<Minus className="h-3 w-3 text-muted-foreground" />
								)}
								<span
									className={cn(
										trend.direction === "up" && "text-green-600",
										trend.direction === "down" && "text-red-600"
									)}
								>
									{trend.value.toFixed(1)}%
								</span>
								<span className="text-muted-foreground">vs last period</span>
							</div>
						)}
					</div>
					{mode === "deals" && (
						<div className="space-y-1">
							<p className="text-xs text-muted-foreground flex items-center gap-1">
								<Target className="h-3 w-3" />
								Weighted Value
							</p>
							<p className="text-2xl font-bold">{formatCurrency(metrics.weighted)}</p>
							<p className="text-xs text-muted-foreground">
								{metrics.total > 0
									? `${((metrics.weighted / metrics.total) * 100).toFixed(0)}% win probability`
									: "No deals"}
							</p>
						</div>
					)}
				</div>

				{/* Stage breakdown */}
				<div className="space-y-3">
					<p className="text-xs font-medium text-muted-foreground">By Stage</p>
					{metrics.byStage.map((stage) => (
						<div key={stage.id} className="space-y-1">
							<div className="flex items-center justify-between text-sm">
								<div className="flex items-center gap-2">
									<div className={cn("h-2 w-2 rounded-full", stage.color)} />
									<span>{stage.label}</span>
								</div>
								<div className="flex items-center gap-2 text-muted-foreground">
									<span>{stage.count}</span>
									{mode === "deals" && stage.value > 0 && (
										<span className="text-xs">({formatCurrency(stage.value)})</span>
									)}
								</div>
							</div>
							<Progress
								value={
									mode === "deals"
										? (stage.value / metrics.maxStageValue) * 100
										: (stage.count / metrics.maxStageValue) * 100
								}
								className={cn("h-1.5", stage.color.replace("bg-", ""))}
							/>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

export default PipelineWidget;
