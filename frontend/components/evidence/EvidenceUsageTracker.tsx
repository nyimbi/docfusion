/**
 * EvidenceUsageTracker - Track Usage History
 *
 * Displays evidence usage timeline, opportunity breakdown,
 * effectiveness ratings, and usage indicators.
 */

"use client";

import { useState, useEffect } from "react";
import {
	History,
	FileText,
	Briefcase,
	Star,
	StarHalf,
	Calendar,
	TrendingUp,
	BarChart3,
	AlertCircle,
	Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import type { EvidenceUsage, EvidenceUsageStats } from "@/lib/types/evidence";
import { getEvidenceUsageStats, getEvidenceUsageHistory } from "@/lib/actions/evidence";

// =============================================================================
// Types
// =============================================================================

export interface EvidenceUsageTrackerProps {
	/** Evidence ID to track */
	evidenceId: string;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Rating Stars Component
// =============================================================================

interface RatingStarsProps {
	rating: number;
	maxRating?: number;
}

function RatingStars({ rating, maxRating = 5 }: RatingStarsProps) {
	const fullStars = Math.floor(rating);
	const hasHalfStar = rating % 1 >= 0.5;
	const emptyStars = maxRating - fullStars - (hasHalfStar ? 1 : 0);

	return (
		<div className="flex items-center gap-0.5">
			{Array.from({ length: fullStars }).map((_, i) => (
				<Star key={`full-${i}`} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
			))}
			{hasHalfStar && <StarHalf className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
			{Array.from({ length: emptyStars }).map((_, i) => (
				<Star key={`empty-${i}`} className="h-3 w-3 text-gray-300" />
			))}
		</div>
	);
}

// =============================================================================
// Usage Timeline Item
// =============================================================================

interface TimelineItemProps {
	usage: EvidenceUsage;
}

function TimelineItem({ usage }: TimelineItemProps) {
	const date = new Date(usage.usedAt);
	const formattedDate = date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
	const formattedTime = date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
	});

	return (
		<div className="flex gap-3 pb-4 last:pb-0">
			{/* Timeline dot and line */}
			<div className="flex flex-col items-center">
				<div className="h-2 w-2 rounded-full bg-primary shrink-0" />
				<div className="flex-1 w-px bg-border" />
			</div>

			{/* Content */}
			<div className="flex-1 min-w-0 pb-4">
				<div className="flex items-center justify-between gap-2 mb-1">
					<span className="text-sm font-medium truncate">
						{usage.opportunityName}
					</span>
					<span className="text-xs text-muted-foreground shrink-0">
						{formattedDate}
					</span>
				</div>
				<div className="text-xs text-muted-foreground">
					<span>{usage.documentName}</span>
					{usage.sectionName && (
						<>
							<span className="mx-1">/</span>
							<span>{usage.sectionName}</span>
						</>
					)}
				</div>
				{usage.effectivenessRating && (
					<div className="flex items-center gap-2 mt-2">
						<RatingStars rating={usage.effectivenessRating / 20} />
						<span className="text-xs text-muted-foreground">
							Effectiveness: {usage.effectivenessRating}%
						</span>
					</div>
				)}
			</div>
		</div>
	);
}

// =============================================================================
// Stats Card
// =============================================================================

interface StatsCardProps {
	icon: typeof History;
	label: string;
	value: string | number;
	subtext?: string;
	className?: string;
}

function StatsCard({ icon: Icon, label, value, subtext, className }: StatsCardProps) {
	return (
		<div className={cn("p-4 bg-muted/50 rounded-lg", className)}>
			<div className="flex items-center gap-2 mb-1">
				<Icon className="h-4 w-4 text-muted-foreground" />
				<span className="text-sm text-muted-foreground">{label}</span>
			</div>
			<div className="text-2xl font-bold">{value}</div>
			{subtext && (
				<div className="text-xs text-muted-foreground mt-1">{subtext}</div>
			)}
		</div>
	);
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function UsageTrackerSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-6 w-40" />
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-3 gap-4">
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-24" />
					))}
				</div>
				<Skeleton className="h-48" />
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function EvidenceUsageTracker({
	evidenceId,
	className,
}: EvidenceUsageTrackerProps) {
	// State
	const [stats, setStats] = useState<EvidenceUsageStats | null>(null);
	const [history, setHistory] = useState<EvidenceUsage[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Load data
	useEffect(() => {
		async function loadData() {
			setIsLoading(true);
			setError(null);

			const [statsResult, historyResult] = await Promise.all([
				getEvidenceUsageStats(evidenceId),
				getEvidenceUsageHistory(evidenceId),
			]);

			if (statsResult.success && statsResult.data) {
				// Transform action result to EvidenceUsageStats format used by component
				const actionStats = statsResult.data;
				const transformedStats: EvidenceUsageStats = {
					evidenceId,
					totalUses: actionStats.totalUsages,
					uniqueOpportunities: actionStats.proposalUsages,
					averageEffectiveness: actionStats.averageScore,
					usageByMonth: [], // Not available from action
					topOpportunities: actionStats.recentUsages
						.filter((u) => u.opportunityId)
						.map((u) => ({
							opportunityId: u.opportunityId!,
							opportunityName: u.opportunityTitle ?? "Unknown",
							useCount: 1,
						})),
					lastUsedAt: actionStats.recentUsages[0]?.usedAt,
				};
				setStats(transformedStats);
			} else if (!statsResult.success) {
				setError(statsResult.error);
			}

			if (historyResult.success && historyResult.data) {
				// Transform DB usage records to EvidenceUsage format
				const usages: EvidenceUsage[] = historyResult.data.map((u) => ({
					id: u.id ?? "",
					evidenceId: u.evidenceId,
					opportunityId: u.opportunityId,
					documentId: u.documentId,
					sectionId: u.sectionId,
					sectionName: u.sectionName,
					usageType: u.usageType,
					usedText: u.usedText,
					context: u.context,
					effectiveness: u.effectiveness,
					evaluatorFeedback: u.evaluatorFeedback,
					usedAt: u.usedAt ?? new Date(),
					usedBy: u.usedBy,
				}));
				setHistory(usages);
			}

			setIsLoading(false);
		}

		loadData();
	}, [evidenceId]);

	if (isLoading) {
		return <UsageTrackerSkeleton />;
	}

	if (error) {
		return (
			<Card className={className}>
				<CardContent className="py-8">
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	// Calculate usage indicator
	const usageLevel = stats
		? stats.totalUses >= 10
			? "high"
			: stats.totalUses >= 5
				? "medium"
				: "low"
		: "low";

	const usageLevelConfig = {
		high: { label: "Frequently Used", color: "text-green-600 bg-green-100" },
		medium: { label: "Moderately Used", color: "text-blue-600 bg-blue-100" },
		low: { label: "Rarely Used", color: "text-gray-600 bg-gray-100" },
	};

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<History className="h-5 w-5" />
						Usage Tracker
					</CardTitle>
					<Badge
						variant="outline"
						className={cn("text-xs", usageLevelConfig[usageLevel].color)}
					>
						{usageLevelConfig[usageLevel].label}
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Stats Overview */}
				<div className="grid grid-cols-3 gap-4">
					<StatsCard
						icon={FileText}
						label="Total Uses"
						value={stats?.totalUses || 0}
						subtext={stats?.lastUsedAt
							? `Last: ${new Date(stats.lastUsedAt).toLocaleDateString()}`
							: "Never used"}
					/>
					<StatsCard
						icon={Briefcase}
						label="Opportunities"
						value={stats?.uniqueOpportunities || 0}
						subtext="Unique opportunities"
					/>
					<StatsCard
						icon={Star}
						label="Effectiveness"
						value={stats?.averageEffectiveness
							? `${Math.round(stats.averageEffectiveness)}%`
							: "N/A"}
						subtext="Average rating"
					/>
				</div>

				<Tabs defaultValue="timeline">
					<TabsList className="w-full justify-start">
						<TabsTrigger value="timeline">Timeline</TabsTrigger>
						<TabsTrigger value="breakdown">Breakdown</TabsTrigger>
						<TabsTrigger value="trends">Trends</TabsTrigger>
					</TabsList>

					{/* Timeline Tab */}
					<TabsContent value="timeline" className="mt-4">
						{history.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground">
								<History className="h-8 w-8 mx-auto mb-2 opacity-50" />
								<p className="text-sm">No usage history yet</p>
							</div>
						) : (
							<ScrollArea className="h-64">
								<div className="pr-4">
									{history.map((usage) => (
										<TimelineItem key={usage.id} usage={usage} />
									))}
								</div>
							</ScrollArea>
						)}
					</TabsContent>

					{/* Breakdown Tab */}
					<TabsContent value="breakdown" className="mt-4">
						{stats?.topOpportunities && stats.topOpportunities.length > 0 ? (
							<div className="space-y-3">
								<h4 className="text-sm font-medium flex items-center gap-2">
									<Briefcase className="h-4 w-4" />
									Top Opportunities
								</h4>
								{stats.topOpportunities.map((opp) => (
									<div
										key={opp.opportunityId}
										className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
									>
										<span className="text-sm truncate flex-1">
											{opp.opportunityName}
										</span>
										<div className="flex items-center gap-2">
											<Progress
												value={(opp.useCount / (stats.totalUses || 1)) * 100}
												className="w-16 h-1.5"
											/>
											<Badge variant="secondary" className="text-xs">
												{opp.useCount} uses
											</Badge>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="text-center py-8 text-muted-foreground">
								<BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
								<p className="text-sm">No breakdown data available</p>
							</div>
						)}
					</TabsContent>

					{/* Trends Tab */}
					<TabsContent value="trends" className="mt-4">
						{stats?.usageByMonth && stats.usageByMonth.length > 0 ? (
							<div className="space-y-3">
								<h4 className="text-sm font-medium flex items-center gap-2">
									<TrendingUp className="h-4 w-4" />
									Monthly Usage
								</h4>
								<div className="space-y-2">
									{stats.usageByMonth.slice(-6).map((month) => (
										<div
											key={month.month}
											className="flex items-center gap-3"
										>
											<span className="text-xs text-muted-foreground w-16">
												{month.month}
											</span>
											<div className="flex-1">
												<Progress
													value={(month.count / Math.max(...stats.usageByMonth.map(m => m.count))) * 100}
													className="h-2"
												/>
											</div>
											<span className="text-xs font-medium w-8 text-right">
												{month.count}
											</span>
										</div>
									))}
								</div>
							</div>
						) : (
							<div className="text-center py-8 text-muted-foreground">
								<TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
								<p className="text-sm">No trend data available</p>
							</div>
						)}
					</TabsContent>
				</Tabs>

				{/* Usage Indicators Legend */}
				<div className="pt-4 border-t">
					<h4 className="text-xs font-medium text-muted-foreground mb-2">
						Usage Indicators
					</h4>
					<div className="flex gap-4 text-xs text-muted-foreground">
						<div className="flex items-center gap-1">
							<div className="h-2 w-2 rounded-full bg-green-500" />
							<span>High (&ge;10)</span>
						</div>
						<div className="flex items-center gap-1">
							<div className="h-2 w-2 rounded-full bg-blue-500" />
							<span>Medium (5-9)</span>
						</div>
						<div className="flex items-center gap-1">
							<div className="h-2 w-2 rounded-full bg-gray-400" />
							<span>Low (&lt;5)</span>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export default EvidenceUsageTracker;
