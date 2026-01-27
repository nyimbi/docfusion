/**
 * WinLossChart Component - DocFusion
 *
 * Displays win/loss analytics with charts.
 */

"use client";

import type { WinLossAnalytics } from "@/lib/types/opportunity";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface WinLossChartProps {
	analytics: WinLossAnalytics;
	className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function WinLossChart({ analytics, className }: WinLossChartProps) {
	const {
		totalSubmissions,
		wins,
		losses,
		withdrawn,
		noAward,
		pending,
		winRate,
		winRateByCategory,
		winRateTrend,
		totalValueWon,
		averageValueWon,
	} = analytics;

	return (
		<div className={cn("space-y-6", className)}>
			{/* Summary Stats */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<StatCard
					label="Total Submissions"
					value={totalSubmissions}
					className="border-blue-500/30"
				/>
				<StatCard
					label="Win Rate"
					value={`${winRate.toFixed(1)}%`}
					subtext={`${wins} of ${wins + losses + withdrawn + noAward}`}
					className={cn(
						winRate >= 50
							? "border-green-500/30"
							: winRate >= 25
								? "border-amber-500/30"
								: "border-red-500/30"
					)}
				/>
				<StatCard
					label="Total Value Won"
					value={formatCurrency(totalValueWon)}
					className="border-green-500/30"
				/>
				<StatCard
					label="Avg Contract Value"
					value={formatCurrency(averageValueWon)}
					className="border-purple-500/30"
				/>
			</div>

			{/* Outcome Distribution */}
			<div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4">
				<h3 className="font-medium text-[var(--foreground)] mb-4">
					Outcome Distribution
				</h3>
				<div className="flex gap-2 h-8 rounded-lg overflow-hidden">
					{wins > 0 && (
						<div
							className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
							style={{ width: `${(wins / totalSubmissions) * 100}%` }}
							title={`Won: ${wins}`}
						>
							{wins}
						</div>
					)}
					{losses > 0 && (
						<div
							className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
							style={{ width: `${(losses / totalSubmissions) * 100}%` }}
							title={`Lost: ${losses}`}
						>
							{losses}
						</div>
					)}
					{withdrawn > 0 && (
						<div
							className="bg-gray-400 flex items-center justify-center text-white text-xs font-medium"
							style={{ width: `${(withdrawn / totalSubmissions) * 100}%` }}
							title={`Withdrawn: ${withdrawn}`}
						>
							{withdrawn}
						</div>
					)}
					{noAward > 0 && (
						<div
							className="bg-amber-500 flex items-center justify-center text-white text-xs font-medium"
							style={{ width: `${(noAward / totalSubmissions) * 100}%` }}
							title={`No Award: ${noAward}`}
						>
							{noAward}
						</div>
					)}
					{pending > 0 && (
						<div
							className="bg-blue-300 flex items-center justify-center text-white text-xs font-medium"
							style={{ width: `${(pending / totalSubmissions) * 100}%` }}
							title={`Pending: ${pending}`}
						>
							{pending}
						</div>
					)}
				</div>
				<div className="flex flex-wrap gap-4 mt-3 text-xs">
					<Legend color="bg-green-500" label={`Won (${wins})`} />
					<Legend color="bg-red-500" label={`Lost (${losses})`} />
					<Legend color="bg-gray-400" label={`Withdrawn (${withdrawn})`} />
					<Legend color="bg-amber-500" label={`No Award (${noAward})`} />
					<Legend color="bg-blue-300" label={`Pending (${pending})`} />
				</div>
			</div>

			{/* Win Rate by Category */}
			{Object.keys(winRateByCategory).length > 0 && (
				<div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4">
					<h3 className="font-medium text-[var(--foreground)] mb-4">
						Win Rate by Category
					</h3>
					<div className="space-y-3">
						{Object.entries(winRateByCategory)
							.sort((a, b) => b[1].rate - a[1].rate)
							.map(([category, data]) => (
								<div key={category}>
									<div className="flex justify-between text-sm mb-1">
										<span className="text-[var(--foreground)]">{category}</span>
										<span className="text-[var(--foreground-muted)]">
											{data.wins}/{data.total} ({data.rate.toFixed(0)}%)
										</span>
									</div>
									<div className="h-2 bg-[var(--background-muted)] rounded-full overflow-hidden">
										<div
											className={cn(
												"h-full rounded-full transition-all",
												data.rate >= 50
													? "bg-green-500"
													: data.rate >= 25
														? "bg-amber-500"
														: "bg-red-500"
											)}
											style={{ width: `${data.rate}%` }}
										/>
									</div>
								</div>
							))}
					</div>
				</div>
			)}

			{/* Win Rate Trend */}
			{winRateTrend.length > 0 && (
				<div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4">
					<h3 className="font-medium text-[var(--foreground)] mb-4">
						Win Rate Trend
					</h3>
					<div className="flex items-end gap-1 h-32">
						{winRateTrend.map((point, i) => (
							<div
								key={point.period}
								className="flex-1 flex flex-col items-center"
							>
								<div
									className={cn(
										"w-full rounded-t transition-all",
										point.rate >= 50
											? "bg-green-500"
											: point.rate >= 25
												? "bg-amber-500"
												: "bg-red-500"
									)}
									style={{ height: `${Math.max(point.rate, 5)}%` }}
									title={`${point.period}: ${point.rate.toFixed(0)}%`}
								/>
								{i % 2 === 0 && (
									<span className="text-xs text-[var(--foreground-muted)] mt-1 truncate w-full text-center">
										{formatMonth(point.period)}
									</span>
								)}
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatCard({
	label,
	value,
	subtext,
	className,
}: {
	label: string;
	value: string | number;
	subtext?: string;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"bg-[var(--background)] border-2 rounded-lg p-4",
				className
			)}
		>
			<p className="text-xs text-[var(--foreground-muted)] uppercase tracking-wide">
				{label}
			</p>
			<p className="text-2xl font-bold text-[var(--foreground)] mt-1">
				{value}
			</p>
			{subtext && (
				<p className="text-xs text-[var(--foreground-muted)] mt-0.5">
					{subtext}
				</p>
			)}
		</div>
	);
}

function Legend({ color, label }: { color: string; label: string }) {
	return (
		<div className="flex items-center gap-1.5">
			<div className={cn("w-3 h-3 rounded", color)} />
			<span className="text-[var(--foreground-muted)]">{label}</span>
		</div>
	);
}

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(value: number): string {
	if (value >= 1000000) {
		return `$${(value / 1000000).toFixed(1)}M`;
	}
	if (value >= 1000) {
		return `$${(value / 1000).toFixed(0)}K`;
	}
	return `$${value.toFixed(0)}`;
}

function formatMonth(period: string): string {
	// period is YYYY-MM
	const [year, month] = period.split("-");
	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	return `${months[parseInt(month, 10) - 1]} '${year.slice(2)}`;
}
