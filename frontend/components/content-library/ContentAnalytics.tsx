/**
 * ContentAnalytics Component
 *
 * Displays usage statistics, win rates, and performance
 * metrics for content blocks.
 */

"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	BarChart3,
	TrendingUp,
	TrendingDown,
	Award,
	FileText,
	Clock,
	Users,
	Download,
	ChevronDown,
	ChevronRight,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface ContentAnalyticsData {
	totalBlocks: number;
	activeBlocks: number;
	totalUsages: number;
	averageWinRate: number;
	averageQualityScore: number;
	topPerformers: {
		id: string;
		title: string;
		winRate: number;
		usageCount: number;
	}[];
	lowPerformers: {
		id: string;
		title: string;
		winRate: number;
		usageCount: number;
	}[];
	categoryBreakdown: {
		category: string;
		count: number;
		winRate: number;
		usageCount: number;
	}[];
	usageTrend: {
		date: string;
		count: number;
	}[];
	freshnessDistribution: {
		current: number;
		stale: number;
		needs_review: number;
		expired: number;
	};
}

interface ContentAnalyticsProps {
	data: ContentAnalyticsData;
	onExport?: () => void;
	onBlockClick?: (blockId: string) => void;
	dateRange?: { start: string; end: string };
	onDateRangeChange?: (range: { start: string; end: string }) => void;
	className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ContentAnalytics({
	data,
	onExport,
	onBlockClick,
	dateRange,
	onDateRangeChange,
	className,
}: ContentAnalyticsProps) {
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		new Set(["overview", "top", "categories"])
	);

	const toggleSection = (section: string) => {
		setExpandedSections((prev) => {
			const next = new Set(prev);
			if (next.has(section)) {
				next.delete(section);
			} else {
				next.add(section);
			}
			return next;
		});
	};

	// Calculate totals
	const totalFreshness =
		data.freshnessDistribution.current +
		data.freshnessDistribution.stale +
		data.freshnessDistribution.needs_review +
		data.freshnessDistribution.expired;

	return (
		<div className={cn("space-y-4", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<BarChart3 className="w-5 h-5 text-blue-600" />
					<h2 className="text-lg font-semibold">Content Analytics</h2>
				</div>
				<div className="flex items-center gap-2">
					{onDateRangeChange && (
						<select
							onChange={(e) => {
								const today = new Date();
								let start: Date;
								switch (e.target.value) {
									case "7d":
										start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
										break;
									case "30d":
										start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
										break;
									case "90d":
										start = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
										break;
									default:
										start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
								}
								onDateRangeChange({
									start: start.toISOString().split("T")[0],
									end: today.toISOString().split("T")[0],
								});
							}}
							className="px-3 py-1.5 border rounded-md text-sm"
						>
							<option value="7d">Last 7 days</option>
							<option value="30d">Last 30 days</option>
							<option value="90d">Last 90 days</option>
						</select>
					)}
					{onExport && (
						<Button variant="outline" size="sm" onClick={onExport}>
							<Download className="w-4 h-4 mr-1" />
							Export
						</Button>
					)}
				</div>
			</div>

			{/* Overview Cards */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<StatCard
					title="Total Blocks"
					value={data.totalBlocks}
					icon={<FileText className="w-5 h-5" />}
					subtitle={`${data.activeBlocks} active`}
				/>
				<StatCard
					title="Total Usages"
					value={data.totalUsages}
					icon={<Users className="w-5 h-5" />}
				/>
				<StatCard
					title="Avg Win Rate"
					value={`${Math.round(data.averageWinRate * 100)}%`}
					icon={<Award className="w-5 h-5" />}
					valueColor={
						data.averageWinRate >= 0.5
							? "text-green-600"
							: data.averageWinRate >= 0.3
							? "text-yellow-600"
							: "text-red-600"
					}
				/>
				<StatCard
					title="Avg Quality"
					value={data.averageQualityScore.toFixed(1)}
					icon={<TrendingUp className="w-5 h-5" />}
				/>
			</div>

			{/* Freshness Distribution */}
			<div className="bg-white rounded-lg border p-4">
				<h3 className="font-medium mb-3">Freshness Distribution</h3>
				<div className="h-4 bg-gray-200 rounded-full overflow-hidden flex">
					<div
						className="bg-green-500"
						style={{
							width: `${(data.freshnessDistribution.current / totalFreshness) * 100}%`,
						}}
						title={`Current: ${data.freshnessDistribution.current}`}
					/>
					<div
						className="bg-yellow-500"
						style={{
							width: `${(data.freshnessDistribution.stale / totalFreshness) * 100}%`,
						}}
						title={`Stale: ${data.freshnessDistribution.stale}`}
					/>
					<div
						className="bg-orange-500"
						style={{
							width: `${(data.freshnessDistribution.needs_review / totalFreshness) * 100}%`,
						}}
						title={`Needs Review: ${data.freshnessDistribution.needs_review}`}
					/>
					<div
						className="bg-red-500"
						style={{
							width: `${(data.freshnessDistribution.expired / totalFreshness) * 100}%`,
						}}
						title={`Expired: ${data.freshnessDistribution.expired}`}
					/>
				</div>
				<div className="flex justify-between mt-2 text-xs">
					<span className="flex items-center gap-1">
						<span className="w-2 h-2 rounded-full bg-green-500" />
						Current ({data.freshnessDistribution.current})
					</span>
					<span className="flex items-center gap-1">
						<span className="w-2 h-2 rounded-full bg-yellow-500" />
						Stale ({data.freshnessDistribution.stale})
					</span>
					<span className="flex items-center gap-1">
						<span className="w-2 h-2 rounded-full bg-orange-500" />
						Review ({data.freshnessDistribution.needs_review})
					</span>
					<span className="flex items-center gap-1">
						<span className="w-2 h-2 rounded-full bg-red-500" />
						Expired ({data.freshnessDistribution.expired})
					</span>
				</div>
			</div>

			{/* Top Performers */}
			<CollapsibleSection
				title="Top Performers"
				icon={<TrendingUp className="w-5 h-5 text-green-600" />}
				isExpanded={expandedSections.has("top")}
				onToggle={() => toggleSection("top")}
			>
				<div className="divide-y">
					{data.topPerformers.map((block, index) => (
						<div
							key={block.id}
							className="py-2 flex items-center justify-between hover:bg-gray-50 cursor-pointer px-2 rounded"
							onClick={() => onBlockClick?.(block.id)}

			role="button"
			tabIndex={0}
			onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
							<div className="flex items-center gap-3">
								<span className="w-6 h-6 flex items-center justify-center bg-green-100 text-green-700 rounded-full text-xs font-medium">
									{index + 1}
								</span>
								<span className="text-sm">{block.title}</span>
							</div>
							<div className="flex items-center gap-4 text-sm">
								<span className="text-green-600 font-medium">
									{Math.round(block.winRate * 100)}% win
								</span>
								<span className="text-gray-500">
									{block.usageCount} uses
								</span>
							</div>
						</div>
					))}
					{data.topPerformers.length === 0 && (
						<p className="py-4 text-center text-gray-500 text-sm">
							No data available
						</p>
					)}
				</div>
			</CollapsibleSection>

			{/* Low Performers */}
			<CollapsibleSection
				title="Needs Improvement"
				icon={<TrendingDown className="w-5 h-5 text-red-600" />}
				isExpanded={expandedSections.has("low")}
				onToggle={() => toggleSection("low")}
			>
				<div className="divide-y">
					{data.lowPerformers.map((block, index) => (
						<div
							key={block.id}
							className="py-2 flex items-center justify-between hover:bg-gray-50 cursor-pointer px-2 rounded"
							onClick={() => onBlockClick?.(block.id)}

			role="button"
			tabIndex={0}
			onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
							<div className="flex items-center gap-3">
								<span className="w-6 h-6 flex items-center justify-center bg-red-100 text-red-700 rounded-full text-xs font-medium">
									{index + 1}
								</span>
								<span className="text-sm">{block.title}</span>
							</div>
							<div className="flex items-center gap-4 text-sm">
								<span className="text-red-600 font-medium">
									{Math.round(block.winRate * 100)}% win
								</span>
								<span className="text-gray-500">
									{block.usageCount} uses
								</span>
							</div>
						</div>
					))}
					{data.lowPerformers.length === 0 && (
						<p className="py-4 text-center text-gray-500 text-sm">
							No data available
						</p>
					)}
				</div>
			</CollapsibleSection>

			{/* Category Breakdown */}
			<CollapsibleSection
				title="By Category"
				isExpanded={expandedSections.has("categories")}
				onToggle={() => toggleSection("categories")}
			>
				<div className="space-y-3">
					{data.categoryBreakdown.map((cat) => (
						<div key={cat.category}>
							<div className="flex items-center justify-between mb-1">
								<span className="text-sm font-medium capitalize">
									{cat.category.replace(/_/g, " ")}
								</span>
								<div className="flex items-center gap-4 text-xs text-gray-500">
									<span>{cat.count} blocks</span>
									<span>{cat.usageCount} uses</span>
									<span
										className={cn(
											"font-medium",
											cat.winRate >= 0.5
												? "text-green-600"
												: cat.winRate >= 0.3
												? "text-yellow-600"
												: "text-red-600"
										)}
									>
										{Math.round(cat.winRate * 100)}% win
									</span>
								</div>
							</div>
							<div className="h-2 bg-gray-200 rounded-full overflow-hidden">
								<div
									className={cn(
										"h-full",
										cat.winRate >= 0.5
											? "bg-green-500"
											: cat.winRate >= 0.3
											? "bg-yellow-500"
											: "bg-red-500"
									)}
									style={{ width: `${cat.winRate * 100}%` }}
								/>
							</div>
						</div>
					))}
					{data.categoryBreakdown.length === 0 && (
						<p className="py-4 text-center text-gray-500 text-sm">
							No data available
						</p>
					)}
				</div>
			</CollapsibleSection>

			{/* Usage Trend */}
			<CollapsibleSection
				title="Usage Trend"
				icon={<Clock className="w-5 h-5" />}
				isExpanded={expandedSections.has("trend")}
				onToggle={() => toggleSection("trend")}
			>
				<div className="h-40">
					{data.usageTrend.length > 0 ? (
						<SimpleTrendChart data={data.usageTrend} />
					) : (
						<p className="h-full flex items-center justify-center text-gray-500 text-sm">
							No usage data available
						</p>
					)}
				</div>
			</CollapsibleSection>
		</div>
	);
}

// ============================================================================
// Sub-components
// ============================================================================

interface StatCardProps {
	title: string;
	value: string | number;
	icon: React.ReactNode;
	subtitle?: string;
	valueColor?: string;
}

function StatCard({ title, value, icon, subtitle, valueColor }: StatCardProps) {
	return (
		<div className="bg-white rounded-lg border p-4">
			<div className="flex items-center gap-2 text-gray-500 mb-2">
				{icon}
				<span className="text-sm">{title}</span>
			</div>
			<div className={cn("text-2xl font-bold", valueColor)}>{value}</div>
			{subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
		</div>
	);
}

interface CollapsibleSectionProps {
	title: string;
	icon?: React.ReactNode;
	isExpanded: boolean;
	onToggle: () => void;
	children: React.ReactNode;
}

function CollapsibleSection({
	title,
	icon,
	isExpanded,
	onToggle,
	children,
}: CollapsibleSectionProps) {
	return (
		<div className="bg-white rounded-lg border">
			<button
				onClick={onToggle}
				className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
			>
				<div className="flex items-center gap-2">
					{isExpanded ? (
						<ChevronDown className="w-4 h-4" />
					) : (
						<ChevronRight className="w-4 h-4" />
					)}
					{icon}
					<span className="font-medium">{title}</span>
				</div>
			</button>
			{isExpanded && <div className="px-4 pb-4">{children}</div>}
		</div>
	);
}

interface SimpleTrendChartProps {
	data: { date: string; count: number }[];
}

function SimpleTrendChart({ data }: SimpleTrendChartProps) {
	const maxCount = Math.max(...data.map((d) => d.count), 1);

	return (
		<div className="flex items-end justify-between h-full gap-1">
			{data.map((point, index) => (
				<div
					key={index}
					className="flex-1 flex flex-col items-center justify-end"
				>
					<div
						className="w-full bg-blue-500 rounded-t min-h-[4px]"
						style={{ height: `${(point.count / maxCount) * 100}%` }}
						title={`${point.date}: ${point.count} uses`}
					/>
					{index % Math.ceil(data.length / 7) === 0 && (
						<span className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">
							{new Date(point.date).toLocaleDateString(undefined, {
								month: "short",
								day: "numeric",
							})}
						</span>
					)}
				</div>
			))}
		</div>
	);
}
