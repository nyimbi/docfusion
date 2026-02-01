"use client";

/**
 * Battle Card Viewer Component
 *
 * Quick reference card showing competitor key information,
 * strengths, weaknesses, recommended discriminators,
 * ghost themes, and win strategy.
 */

import * as React from "react";
import { useState, useTransition, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Building2,
	Trophy,
	AlertTriangle,
	Target,
	Shield,
	Ghost,
	Copy,
	Check,
	TrendingUp,
	TrendingDown,
	ExternalLink,
	RefreshCw,
	Loader2,
	Swords,
	Lightbulb,
	FileText,
	Globe,
	DollarSign,
} from "lucide-react";
import {
	getCompetitor,
	listGhostThemes,
	listDiscriminators,
	getWinLossAnalysis,
} from "@/lib/actions/competitive";
import type { Competitor, GhostTheme, Discriminator, BattleCard, WinLossAnalysis } from "@/lib/types/competitive";

interface BattleCardViewerProps {
	competitorId: string;
	/** Optional opportunity context for relevance scoring */
	opportunityId?: string;
	/** Compact mode for sidebar display */
	compact?: boolean;
	/** Additional CSS classes */
	className?: string;
}

export function BattleCardViewer({
	competitorId,
	opportunityId,
	compact = false,
	className,
}: BattleCardViewerProps) {
	// State
	const [competitor, setCompetitor] = useState<Competitor | null>(null);
	const [ghostThemes, setGhostThemes] = useState<GhostTheme[]>([]);
	const [discriminators, setDiscriminators] = useState<Discriminator[]>([]);
	const [winLossAnalysis, setWinLossAnalysis] = useState<WinLossAnalysis | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [copiedText, setCopiedText] = useState<string | null>(null);

	// Load battle card data
	useEffect(() => {
		async function loadData() {
			setIsLoading(true);
			setError(null);

			try {
				const [competitorResult, ghostResult, discriminatorResult, winLossResult] = await Promise.all([
					getCompetitor(competitorId),
					listGhostThemes(competitorId),
					listDiscriminators({ effectiveAgainst: competitorId }),
					getWinLossAnalysis(competitorId),
				]);

				if (competitorResult.success) {
					setCompetitor(competitorResult.data);
				} else {
					setError(competitorResult.error);
				}

				if (ghostResult.success) {
					setGhostThemes(ghostResult.data);
				}

				if (discriminatorResult.success) {
					// Filter to those effective against this competitor
					const relevant = discriminatorResult.data.filter((d) =>
						d.effectiveAgainst?.includes(competitorId)
					);
					setDiscriminators(relevant);
				}

				if (winLossResult.success) {
					setWinLossAnalysis(winLossResult.data);
				}
			} catch (err) {
				setError("Failed to load battle card data");
			} finally {
				setIsLoading(false);
			}
		}

		loadData();
	}, [competitorId]);

	/**
	 * Refresh data
	 */
	const handleRefresh = useCallback(() => {
		startTransition(() => {
			// Re-trigger the effect
			setIsLoading(true);
		});
	}, []);

	/**
	 * Copy text to clipboard
	 */
	const handleCopy = useCallback(async (text: string, id: string) => {
		await navigator.clipboard.writeText(text);
		setCopiedText(id);
		setTimeout(() => setCopiedText(null), 2000);
	}, []);

	/**
	 * Get win rate color
	 */
	const getWinRateColor = (rate: number): string => {
		if (rate >= 60) return "text-green-600";
		if (rate >= 40) return "text-yellow-600";
		return "text-red-600";
	};

	// Loading state
	if (isLoading) {
		return (
			<Card className={className}>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-4 w-32" />
				</CardHeader>
				<CardContent className="space-y-4">
					<Skeleton className="h-20" />
					<Skeleton className="h-20" />
					<Skeleton className="h-20" />
				</CardContent>
			</Card>
		);
	}

	// Error state
	if (error || !competitor) {
		return (
			<Card className={className}>
				<CardContent className="flex flex-col items-center justify-center py-8 text-center">
					<AlertTriangle className="h-8 w-8 text-destructive mb-2" />
					<p className="text-sm text-muted-foreground">{error || "Competitor not found"}</p>
				</CardContent>
			</Card>
		);
	}

	const topStrengths = (competitor.strengths ?? []).slice(0, 3);
	const topWeaknesses = (competitor.weaknesses ?? []).slice(0, 3);
	const topGhostThemes = ghostThemes.slice(0, 3);
	const topDiscriminators = discriminators.slice(0, 3);

	return (
		<Card className={cn("relative", className)}>
			{/* Header */}
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
							{competitor.logoUrl ? (
								<img
									src={competitor.logoUrl}
									alt=""
									className="w-8 h-8 object-contain rounded"
								/>
							) : (
								<Building2 className="h-5 w-5 text-muted-foreground" />
							)}
						</div>
						<div>
							<CardTitle className="text-lg flex items-center gap-2">
								{competitor.name}
								<Badge variant="outline" className="text-xs font-normal">
									Battle Card
								</Badge>
							</CardTitle>
							<CardDescription className="flex items-center gap-2">
								{competitor.competitorType && (
									<span className="capitalize">{competitor.competitorType}</span>
								)}
								{competitor.sizeStandard && (
									<>
										<span>·</span>
										<span className="uppercase">{competitor.sizeStandard}</span>
									</>
								)}
							</CardDescription>
						</div>
					</div>
					<Button variant="ghost" size="sm" onClick={handleRefresh}>
						{isPending ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<RefreshCw className="h-4 w-4" />
						)}
					</Button>
				</div>

				{/* Win/Loss Summary */}
				{winLossAnalysis && winLossAnalysis.totalEncounters > 0 && (
					<div className="flex items-center gap-4 mt-3 p-2 bg-muted/50 rounded-lg">
						<div className="flex items-center gap-2">
							{winLossAnalysis.winRate >= 50 ? (
								<TrendingUp className="h-4 w-4 text-green-600" />
							) : (
								<TrendingDown className="h-4 w-4 text-red-600" />
							)}
							<span className={cn("font-semibold", getWinRateColor(winLossAnalysis.winRate))}>
								{winLossAnalysis.winRate.toFixed(0)}%
							</span>
							<span className="text-xs text-muted-foreground">win rate</span>
						</div>
						<div className="text-xs text-muted-foreground">
							{winLossAnalysis.ourWins}W / {winLossAnalysis.ourLosses}L
						</div>
					</div>
				)}
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Quick Stats */}
				{!compact && (
					<div className="flex items-center gap-4 text-xs text-muted-foreground">
						{competitor.website && (
							<a
								href={competitor.website}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-1 hover:text-foreground transition-colors"
							>
								<Globe className="h-3.5 w-3.5" />
								Website
								<ExternalLink className="h-3 w-3" />
							</a>
						)}
						{competitor.pricingTendency && (
							<span className="flex items-center gap-1">
								<DollarSign className="h-3.5 w-3.5" />
								{competitor.pricingTendency}
							</span>
						)}
					</div>
				)}

				{/* Strengths */}
				<div>
					<div className="flex items-center gap-2 mb-2">
						<TrendingUp className="h-4 w-4 text-green-600" />
						<h4 className="text-sm font-semibold text-green-600">Key Strengths</h4>
					</div>
					<ul className="space-y-1.5">
						{topStrengths.map((strength, idx) => (
							<li
								key={idx}
								className="flex items-start gap-2 text-sm pl-6 relative before:absolute before:left-1.5 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-green-400"
							>
								{strength}
							</li>
						))}
						{topStrengths.length === 0 && (
							<li className="text-sm text-muted-foreground pl-6 italic">
								No strengths recorded
							</li>
						)}
					</ul>
				</div>

				{/* Weaknesses */}
				<div>
					<div className="flex items-center gap-2 mb-2">
						<TrendingDown className="h-4 w-4 text-red-600" />
						<h4 className="text-sm font-semibold text-red-600">Key Weaknesses</h4>
					</div>
					<ul className="space-y-1.5">
						{topWeaknesses.map((weakness, idx) => (
							<li
								key={idx}
								className="flex items-start gap-2 text-sm pl-6 relative before:absolute before:left-1.5 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-red-400"
							>
								{weakness}
							</li>
						))}
						{topWeaknesses.length === 0 && (
							<li className="text-sm text-muted-foreground pl-6 italic">
								No weaknesses recorded
							</li>
						)}
					</ul>
				</div>

				{/* Recommended Discriminators */}
				<div>
					<div className="flex items-center gap-2 mb-2">
						<Swords className="h-4 w-4 text-blue-600" />
						<h4 className="text-sm font-semibold text-blue-600">Recommended Discriminators</h4>
					</div>
					{topDiscriminators.length > 0 ? (
						<div className="space-y-2">
							{topDiscriminators.map((discriminator) => (
								<div
									key={discriminator.id}
									className="group flex items-start justify-between gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg"
								>
									<p className="text-sm flex-1 line-clamp-2">
										{discriminator.shortVersion || discriminator.statement}
									</p>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
													onClick={() =>
														handleCopy(
															discriminator.shortVersion || discriminator.statement,
															`disc-${discriminator.id}`
														)
													}
												>
													{copiedText === `disc-${discriminator.id}` ? (
														<Check className="h-3 w-3 text-green-600" />
													) : (
														<Copy className="h-3 w-3" />
													)}
												</Button>
											</TooltipTrigger>
											<TooltipContent>Copy to clipboard</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
							))}
						</div>
					) : (
						<p className="text-sm text-muted-foreground pl-6 italic">
							No discriminators targeting this competitor
						</p>
					)}
				</div>

				{/* Ghost Themes */}
				<div>
					<div className="flex items-center gap-2 mb-2">
						<Ghost className="h-4 w-4 text-purple-600" />
						<h4 className="text-sm font-semibold text-purple-600">Ghost Themes</h4>
					</div>
					{topGhostThemes.length > 0 ? (
						<div className="space-y-2">
							{topGhostThemes.map((theme) => (
								<div
									key={theme.id}
									className="group flex items-start justify-between gap-2 p-2 bg-purple-50 dark:bg-purple-950 rounded-lg"
								>
									<div className="flex-1 min-w-0">
										<p className="text-xs text-muted-foreground mb-0.5">
											Re: {theme.weakness}
										</p>
										<p className="text-sm line-clamp-2">{theme.ghostLanguage}</p>
									</div>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
													onClick={() =>
														handleCopy(theme.ghostLanguage, `ghost-${theme.id}`)
													}
												>
													{copiedText === `ghost-${theme.id}` ? (
														<Check className="h-3 w-3 text-green-600" />
													) : (
														<Copy className="h-3 w-3" />
													)}
												</Button>
											</TooltipTrigger>
											<TooltipContent>Copy to clipboard</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
							))}
						</div>
					) : (
						<p className="text-sm text-muted-foreground pl-6 italic">
							No ghost themes created for this competitor
						</p>
					)}
				</div>

				{/* Win Strategy */}
				{winLossAnalysis && winLossAnalysis.aiInsights && winLossAnalysis.aiInsights.length > 0 && (
					<div>
						<div className="flex items-center gap-2 mb-2">
							<Trophy className="h-4 w-4 text-amber-600" />
							<h4 className="text-sm font-semibold text-amber-600">Win Strategy</h4>
						</div>
						<div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
							<p className="text-sm">{winLossAnalysis.aiInsights[0]}</p>
						</div>
					</div>
				)}
			</CardContent>

			{/* Footer */}
			{!compact && (
				<CardFooter className="pt-0">
					<Alert className="w-full">
						<Lightbulb className="h-4 w-4" />
						<AlertDescription className="text-xs">
							Use discriminators and ghost themes strategically in proposal sections
							where evaluation criteria align with competitor weaknesses.
						</AlertDescription>
					</Alert>
				</CardFooter>
			)}
		</Card>
	);
}

export default BattleCardViewer;
