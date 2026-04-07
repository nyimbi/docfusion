"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { OpportunityStats as OpportunityStatsType } from "@/lib/types/opportunity";
import {
	Briefcase,
	Clock,
	AlertCircle,
	Target,
	Award,
	BarChart3,
} from "lucide-react";

// ============================================================================
// Props
// ============================================================================

interface StatsBannerProps {
	stats: OpportunityStatsType;
}

interface StatPillProps {
	icon: React.ReactNode;
	label: string;
	value: number | string;
	color: "default" | "amber" | "blue" | "green" | "red";
}

// ============================================================================
// StatPill
// ============================================================================

function StatPill({ icon, label, value, color }: StatPillProps) {
	const colorClasses = {
		default: "text-muted-foreground",
		amber: "text-amber-500",
		blue: "text-blue-500",
		green: "text-green-500",
		red: "text-destructive",
	};

	return (
		<div className="flex items-center gap-3 shrink-0">
			<div className="p-2 rounded-lg bg-muted text-foreground">{icon}</div>
			<div>
				<div className={cn("text-lg font-semibold tabular-nums", colorClasses[color])}>
					{value}
				</div>
				<div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
			</div>
		</div>
	);
}

// ============================================================================
// StatsBanner
// ============================================================================

export const StatsBanner = React.memo(function StatsBanner({ stats }: StatsBannerProps) {
	return (
		<div className="rounded-xl border bg-muted/20 p-4 mb-6">
			<div className="flex items-center gap-8 overflow-x-auto scrollbar-none">
				<StatPill
					icon={<Briefcase className="w-4 h-4" />}
					label="Total"
					value={stats.total}
					color="default"
				/>
				<StatPill
					icon={<Clock className="w-4 h-4" />}
					label="Active"
					value={stats.activeCount}
					color="green"
				/>
				<StatPill
					icon={<AlertCircle className="w-4 h-4" />}
					label="Expired"
					value={stats.expiredCount}
					color="red"
				/>
				<StatPill
					icon={<Target className="w-4 h-4" />}
					label="Pursuing"
					value={stats.byStatus.pursuing || 0}
					color="amber"
				/>
				<StatPill
					icon={<Award className="w-4 h-4" />}
					label="Won"
					value={stats.byStatus.won || 0}
					color="green"
				/>
				<div className="h-6 w-px bg-border" />
				<StatPill
					icon={<BarChart3 className="w-4 h-4" />}
					label="Avg Fit"
					value={stats.averageFitScore ? `${Math.round(stats.averageFitScore)}%` : "\u2014"}
					color="blue"
				/>
			</div>
		</div>
	);
});
