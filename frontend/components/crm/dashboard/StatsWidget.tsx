"use client";

/**
 * Stats Widget Component
 *
 * Displays key CRM statistics with sparklines and trends.
 * Configurable for different metric types.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
	TrendingUp,
	TrendingDown,
	Minus,
	Building2,
	Users,
	Handshake,
	Target,
	DollarSign,
	Calendar,
	CheckCircle,
	AlertCircle,
	type LucideIcon,
} from "lucide-react";

interface StatItem {
	label: string;
	value: number | string;
	previousValue?: number;
	format?: "number" | "currency" | "percent" | "string";
	icon?: LucideIcon;
	iconColor?: string;
	description?: string;
}

interface StatsWidgetProps {
	stats: StatItem[];
	columns?: 2 | 3 | 4;
	size?: "sm" | "md" | "lg";
	showTrend?: boolean;
	className?: string;
}

// Format value based on type
const formatValue = (value: number | string, format: StatItem["format"] = "number"): string => {
	if (typeof value === "string") return value;

	switch (format) {
		case "currency":
			return new Intl.NumberFormat("en-US", {
				style: "currency",
				currency: "USD",
				notation: value >= 1000000 ? "compact" : "standard",
				maximumFractionDigits: value >= 1000000 ? 1 : 0,
			}).format(value);
		case "percent":
			return `${value.toFixed(1)}%`;
		case "number":
		default:
			return new Intl.NumberFormat("en-US", {
				notation: value >= 10000 ? "compact" : "standard",
				maximumFractionDigits: 1,
			}).format(value);
	}
};

// Calculate trend
const calculateTrend = (current: number, previous: number) => {
	if (previous === 0) return { value: 0, direction: "neutral" as const };
	const change = ((current - previous) / previous) * 100;
	return {
		value: Math.abs(change),
		direction: change > 2 ? ("up" as const) : change < -2 ? ("down" as const) : ("neutral" as const),
	};
};

// Size configurations
const SIZE_CONFIG = {
	sm: {
		value: "text-xl font-bold",
		label: "text-xs",
		icon: "h-8 w-8",
		iconInner: "h-4 w-4",
		trend: "text-[10px]",
		card: "p-3",
	},
	md: {
		value: "text-2xl font-bold",
		label: "text-sm",
		icon: "h-10 w-10",
		iconInner: "h-5 w-5",
		trend: "text-xs",
		card: "p-4",
	},
	lg: {
		value: "text-3xl font-bold",
		label: "text-base",
		icon: "h-12 w-12",
		iconInner: "h-6 w-6",
		trend: "text-sm",
		card: "p-6",
	},
};

export function StatsWidget({
	stats,
	columns = 4,
	size = "md",
	showTrend = true,
	className,
}: StatsWidgetProps) {
	const sizeConfig = SIZE_CONFIG[size];

	return (
		<div
			className={cn(
				"grid gap-4",
				columns === 2 && "grid-cols-2",
				columns === 3 && "grid-cols-3",
				columns === 4 && "grid-cols-2 md:grid-cols-4",
				className
			)}
		>
			{stats.map((stat, index) => {
				const Icon = stat.icon;
				const numericValue = typeof stat.value === "number" ? stat.value : 0;
				const trend =
					showTrend && stat.previousValue !== undefined && typeof stat.value === "number"
						? calculateTrend(stat.value, stat.previousValue)
						: null;

				return (
					<Card key={index}>
						<CardContent className={sizeConfig.card}>
							<div className="flex items-start justify-between">
								<div className="space-y-1">
									<p className={cn("text-muted-foreground", sizeConfig.label)}>
										{stat.label}
									</p>
									<p className={sizeConfig.value}>
										{formatValue(stat.value, stat.format)}
									</p>
									{trend && (
										<div className={cn("flex items-center gap-1", sizeConfig.trend)}>
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
													trend.direction === "down" && "text-red-600",
													trend.direction === "neutral" && "text-muted-foreground"
												)}
											>
												{trend.value.toFixed(1)}%
											</span>
											<span className="text-muted-foreground">vs last period</span>
										</div>
									)}
									{stat.description && (
										<p className="text-xs text-muted-foreground mt-1">
											{stat.description}
										</p>
									)}
								</div>
								{Icon && (
									<div
										className={cn(
											"rounded-lg flex items-center justify-center",
											sizeConfig.icon,
											stat.iconColor ?? "bg-primary/10"
										)}
									>
										<Icon
											className={cn(
												sizeConfig.iconInner,
												stat.iconColor
													? stat.iconColor.replace("bg-", "text-").replace("/10", "-600")
													: "text-primary"
											)}
										/>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}

// Preset stat configurations for common CRM metrics
export function CRMStatsWidget({
	accounts = 0,
	contacts = 0,
	deals = 0,
	revenue = 0,
	previousAccounts,
	previousContacts,
	previousDeals,
	previousRevenue,
	showTrend = true,
	size = "md",
	className,
}: {
	accounts?: number;
	contacts?: number;
	deals?: number;
	revenue?: number;
	previousAccounts?: number;
	previousContacts?: number;
	previousDeals?: number;
	previousRevenue?: number;
	showTrend?: boolean;
	size?: "sm" | "md" | "lg";
	className?: string;
}) {
	const stats: StatItem[] = [
		{
			label: "Total Accounts",
			value: accounts,
			previousValue: previousAccounts,
			format: "number",
			icon: Building2,
			iconColor: "bg-blue-100",
		},
		{
			label: "Total Contacts",
			value: contacts,
			previousValue: previousContacts,
			format: "number",
			icon: Users,
			iconColor: "bg-green-100",
		},
		{
			label: "Open Deals",
			value: deals,
			previousValue: previousDeals,
			format: "number",
			icon: Handshake,
			iconColor: "bg-purple-100",
		},
		{
			label: "Pipeline Value",
			value: revenue,
			previousValue: previousRevenue,
			format: "currency",
			icon: DollarSign,
			iconColor: "bg-amber-100",
		},
	];

	return <StatsWidget stats={stats} showTrend={showTrend} size={size} className={className} />;
}

// Task/Activity focused stats
export function TaskStatsWidget({
	overdue = 0,
	dueToday = 0,
	upcoming = 0,
	completed = 0,
	showTrend = false,
	size = "sm",
	className,
}: {
	overdue?: number;
	dueToday?: number;
	upcoming?: number;
	completed?: number;
	showTrend?: boolean;
	size?: "sm" | "md" | "lg";
	className?: string;
}) {
	const stats: StatItem[] = [
		{
			label: "Overdue",
			value: overdue,
			format: "number",
			icon: AlertCircle,
			iconColor: "bg-red-100",
		},
		{
			label: "Due Today",
			value: dueToday,
			format: "number",
			icon: Calendar,
			iconColor: "bg-orange-100",
		},
		{
			label: "Upcoming",
			value: upcoming,
			format: "number",
			icon: Target,
			iconColor: "bg-blue-100",
		},
		{
			label: "Completed",
			value: completed,
			format: "number",
			icon: CheckCircle,
			iconColor: "bg-green-100",
		},
	];

	return <StatsWidget stats={stats} showTrend={showTrend} size={size} className={className} />;
}

export default StatsWidget;
