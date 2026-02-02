"use client";

/**
 * Competitor Comparison Component
 *
 * Head-to-head performance comparison against competitors with
 * strengths, weaknesses, and strategic recommendations.
 */

import { useState, useEffect, useTransition, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Trophy,
	XCircle,
	Users,
	TrendingUp,
	TrendingDown,
	Minus,
	Target,
	DollarSign,
	AlertTriangle,
	CheckCircle,
	RefreshCw,
	Loader2,
	ChevronRight,
	ArrowUp,
	ArrowDown,
	Swords,
	Shield,
} from "lucide-react";
import { compareToCompetitors } from "@/lib/actions/winloss";
import type { CompetitorComparison as CompetitorComparisonType, Trend } from "@/lib/types/winloss";

interface CompetitorComparisonProps {
	competitorId?: string;
	competitors?: Array<{ id: string; name: string }>;
	initialComparison?: CompetitorComparisonType;
	onCompetitorSelect?: (competitorId: string) => void;
	className?: string;
}

const TREND_CONFIG: Record<Trend, { label: string; color: string; icon: React.ReactNode }> = {
	improving: {
		label: "Improving",
		color: "text-green-600",
		icon: <TrendingUp className="h-4 w-4 text-green-600" />,
	},
	declining: {
		label: "Declining",
		color: "text-red-600",
		icon: <TrendingDown className="h-4 w-4 text-red-600" />,
	},
	stable: {
		label: "Stable",
		color: "text-blue-600",
		icon: <Minus className="h-4 w-4 text-blue-600" />,
	},
};

const PRICE_COMPETITIVE_CONFIG = {
	lower: { label: "Our price is lower", color: "text-green-600", icon: <ArrowDown /> },
	similar: { label: "Similar pricing", color: "text-blue-600", icon: <Minus /> },
	higher: { label: "Our price is higher", color: "text-red-600", icon: <ArrowUp /> },
	unknown: { label: "Unknown", color: "text-muted-foreground", icon: <Minus /> },
};

export function CompetitorComparison({
	competitorId: initialCompetitorId,
	competitors = [],
	initialComparison,
	onCompetitorSelect,
	className,
}: CompetitorComparisonProps) {
	const [isPending, startTransition] = useTransition();
	const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | undefined>(
		initialCompetitorId
	);
	const [comparison, setComparison] = useState<CompetitorComparisonType | null>(
		initialComparison ?? null
	);
	const [isLoading, setIsLoading] = useState(false);

	// Fetch comparison
	const fetchComparison = useCallback(
		async (compId: string) => {
			startTransition(async () => {
				setIsLoading(true);
				try {
					const result = await compareToCompetitors(compId);

					if (result.success && result.data) {
						setComparison(result.data as unknown as CompetitorComparisonType);
					}
				} catch (error) {
					console.error("Failed to fetch competitor comparison:", error);
				} finally {
					setIsLoading(false);
				}
			});
		},
		[]
	);

	useEffect(() => {
		if (selectedCompetitorId && !initialComparison) {
			fetchComparison(selectedCompetitorId);
		}
	}, [selectedCompetitorId, initialComparison, fetchComparison]);

	const handleCompetitorChange = (compId: string) => {
		setSelectedCompetitorId(compId);
		onCompetitorSelect?.(compId);
		fetchComparison(compId);
	};

	// No competitor selected state
	if (!selectedCompetitorId && competitors.length === 0) {
		return (
			<div className={cn("text-center py-12", className)}>
				<Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
				<p className="text-muted-foreground">No competitors available for comparison</p>
				<p className="text-sm text-muted-foreground mt-1">
					Add competitors to your opportunities to enable comparison
				</p>
			</div>
		);
	}

	const trendConfig = comparison?.recentTrend
		? TREND_CONFIG[comparison.recentTrend]
		: TREND_CONFIG.stable;

	const priceConfig = comparison?.priceCompetitiveness
		? PRICE_COMPETITIVE_CONFIG[comparison.priceCompetitiveness]
		: PRICE_COMPETITIVE_CONFIG.unknown;

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h2 className="text-xl font-semibold">Competitor Comparison</h2>
					{isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
				</div>

				<div className="flex items-center gap-2">
					{competitors.length > 0 && (
						<Select
							value={selectedCompetitorId}
							onValueChange={handleCompetitorChange}
						>
							<SelectTrigger className="w-[200px]">
								<Users className="h-4 w-4 mr-2" />
								<SelectValue placeholder="Select Competitor" />
							</SelectTrigger>
							<SelectContent>
								{competitors.map((comp) => (
									<SelectItem key={comp.id} value={comp.id}>
										{comp.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}

					{selectedCompetitorId && (
						<Button
							variant="outline"
							onClick={() => fetchComparison(selectedCompetitorId)}
							disabled={isPending}
						>
							<RefreshCw className={cn("h-4 w-4 mr-2", isPending && "animate-spin")} />
							Refresh
						</Button>
					)}
				</div>
			</div>

			{/* Loading state */}
			{isLoading && (
				<div className="space-y-4">
					<div className="grid grid-cols-4 gap-4">
						{[1, 2, 3, 4].map((i) => (
							<Card key={i}>
								<CardContent className="pt-6">
									<Skeleton className="h-4 w-20 mb-2" />
									<Skeleton className="h-8 w-24" />
								</CardContent>
							</Card>
						))}
					</div>
					<Card>
						<CardContent className="pt-6">
							<Skeleton className="h-48 w-full" />
						</CardContent>
					</Card>
				</div>
			)}

			{/* No selection state */}
			{!selectedCompetitorId && !isLoading && (
				<Card>
					<CardContent className="py-12 text-center">
						<Swords className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
						<p className="text-muted-foreground">
							Select a competitor to view head-to-head comparison
						</p>
					</CardContent>
				</Card>
			)}

			{/* Comparison Results */}
			{comparison && !isLoading && (
				<>
					{/* Header Card */}
					<Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
						<CardContent className="py-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-muted-foreground">Comparing vs</p>
									<h3 className="text-2xl font-bold">{comparison.competitorName}</h3>
								</div>
								<div className="text-right">
									<div className="flex items-center gap-2 justify-end">
										{trendConfig.icon}
										<span className={cn("font-medium", trendConfig.color)}>
											{trendConfig.label}
										</span>
									</div>
									<p className="text-sm text-muted-foreground mt-1">
										{comparison.totalEncounters} total encounters
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Key Metrics */}
					<div className="grid grid-cols-4 gap-4">
						{/* Win Rate Against */}
						<Card
							className={cn(
								comparison.winRateAgainst >= 50
									? "border-green-200"
									: "border-red-200"
							)}
						>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">Win Rate</p>
										<p
											className={cn(
												"text-3xl font-bold mt-1",
												comparison.winRateAgainst >= 50
													? "text-green-600"
													: "text-red-600"
											)}
										>
											{comparison.winRateAgainst.toFixed(0)}%
										</p>
									</div>
									<div
										className={cn(
											"p-3 rounded-full",
											comparison.winRateAgainst >= 50
												? "bg-green-100"
												: "bg-red-100"
										)}
									>
										{comparison.winRateAgainst >= 50 ? (
											<Trophy className="h-6 w-6 text-green-600" />
										) : (
											<XCircle className="h-6 w-6 text-red-600" />
										)}
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Our Wins */}
						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">Our Wins</p>
										<p className="text-3xl font-bold mt-1 text-green-600">
											{comparison.ourWins}
										</p>
									</div>
									<div className="p-3 rounded-full bg-green-100">
										<Trophy className="h-6 w-6 text-green-600" />
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Their Wins */}
						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">Their Wins</p>
										<p className="text-3xl font-bold mt-1 text-red-600">
											{comparison.theirWins}
										</p>
									</div>
									<div className="p-3 rounded-full bg-red-100">
										<XCircle className="h-6 w-6 text-red-600" />
									</div>
								</div>
							</CardContent>
						</Card>

						{/* No Award */}
						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">No Award</p>
										<p className="text-3xl font-bold mt-1">
											{comparison.noAwardCases}
										</p>
									</div>
									<div className="p-3 rounded-full bg-gray-100">
										<Target className="h-6 w-6 text-gray-600" />
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Win/Loss Visual */}
					<Card>
						<CardHeader>
							<CardTitle>Head-to-Head Record</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{/* Progress bar visualization */}
								<div className="relative h-12 bg-muted rounded-lg overflow-hidden">
									<div
										className="absolute left-0 top-0 h-full bg-green-500 flex items-center justify-center text-white font-bold transition-all"
										style={{
											width: `${
												comparison.totalEncounters > 0
													? (comparison.ourWins / comparison.totalEncounters) * 100
													: 0
											}%`,
										}}
									>
										{comparison.ourWins > 0 && (
											<span>
												{comparison.ourWins} ({((comparison.ourWins / comparison.totalEncounters) * 100).toFixed(0)}%)
											</span>
										)}
									</div>
									<div
										className="absolute right-0 top-0 h-full bg-red-500 flex items-center justify-center text-white font-bold transition-all"
										style={{
											width: `${
												comparison.totalEncounters > 0
													? (comparison.theirWins / comparison.totalEncounters) * 100
													: 0
											}%`,
										}}
									>
										{comparison.theirWins > 0 && (
											<span>
												{comparison.theirWins} ({((comparison.theirWins / comparison.totalEncounters) * 100).toFixed(0)}%)
											</span>
										)}
									</div>
								</div>

								<div className="flex justify-between text-sm">
									<div className="flex items-center gap-2">
										<div className="w-3 h-3 rounded bg-green-500" />
										<span>Our Wins</span>
									</div>
									<div className="flex items-center gap-2">
										<span>Their Wins</span>
										<div className="w-3 h-3 rounded bg-red-500" />
									</div>
								</div>

								{/* Rank delta */}
								{comparison.averageRankDelta !== null && comparison.averageRankDelta !== undefined && (
									<div className="mt-4 p-3 bg-muted rounded-lg">
										<div className="flex items-center justify-between">
											<span className="text-sm text-muted-foreground">
												Average Ranking vs Them
											</span>
											<span
												className={cn(
													"font-medium flex items-center gap-1",
													comparison.averageRankDelta < 0
														? "text-green-600"
														: comparison.averageRankDelta > 0
														? "text-red-600"
														: "text-muted-foreground"
												)}
											>
												{comparison.averageRankDelta < 0 ? (
													<ArrowUp className="h-4 w-4" />
												) : comparison.averageRankDelta > 0 ? (
													<ArrowDown className="h-4 w-4" />
												) : null}
												{Math.abs(comparison.averageRankDelta).toFixed(1)} positions{" "}
												{comparison.averageRankDelta < 0 ? "better" : comparison.averageRankDelta > 0 ? "worse" : "same"}
											</span>
										</div>
									</div>
								)}
							</div>
						</CardContent>
					</Card>

					{/* Strengths & Weaknesses */}
					<div className="grid grid-cols-2 gap-4">
						{/* Our Strengths */}
						<Card className="border-green-200">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-green-700">
									<Shield className="h-5 w-5" />
									Our Strengths vs Them
								</CardTitle>
							</CardHeader>
							<CardContent>
								{comparison.strengthsVsThem && comparison.strengthsVsThem.length > 0 ? (
									<ul className="space-y-2">
										{comparison.strengthsVsThem.map((strength, index) => (
											<li
												key={index}
												className="flex items-start gap-2 text-sm"
											>
												<CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
												<span>{strength}</span>
											</li>
										))}
									</ul>
								) : (
									<p className="text-sm text-muted-foreground">
										No specific strengths identified yet
									</p>
								)}
							</CardContent>
						</Card>

						{/* Our Weaknesses */}
						<Card className="border-red-200">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-red-700">
									<AlertTriangle className="h-5 w-5" />
									Our Weaknesses vs Them
								</CardTitle>
							</CardHeader>
							<CardContent>
								{comparison.weaknessesVsThem && comparison.weaknessesVsThem.length > 0 ? (
									<ul className="space-y-2">
										{comparison.weaknessesVsThem.map((weakness, index) => (
											<li
												key={index}
												className="flex items-start gap-2 text-sm"
											>
												<AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
												<span>{weakness}</span>
											</li>
										))}
									</ul>
								) : (
									<p className="text-sm text-muted-foreground">
										No specific weaknesses identified yet
									</p>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Price Competitiveness */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<DollarSign className="h-5 w-5" />
								Price Competitiveness
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-3">
								<div
									className={cn(
										"p-2 rounded-full",
										comparison.priceCompetitiveness === "lower"
											? "bg-green-100"
											: comparison.priceCompetitiveness === "higher"
											? "bg-red-100"
											: "bg-blue-100"
									)}
								>
									{comparison.priceCompetitiveness === "lower" ? (
										<ArrowDown className="h-5 w-5 text-green-600" />
									) : comparison.priceCompetitiveness === "higher" ? (
										<ArrowUp className="h-5 w-5 text-red-600" />
									) : (
										<Minus className="h-5 w-5 text-blue-600" />
									)}
								</div>
								<div>
									<p className={cn("font-medium", priceConfig.color)}>
										{priceConfig.label}
									</p>
									<p className="text-sm text-muted-foreground">
										Based on historical pricing data
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Recommendations */}
					{comparison.recommendations && comparison.recommendations.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Target className="h-5 w-5" />
									Strategic Recommendations
								</CardTitle>
								<CardDescription>
									Actions to improve performance against {comparison.competitorName}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ul className="space-y-3">
									{comparison.recommendations.map((rec, index) => (
										<li
											key={index}
											className="flex items-start gap-3 p-3 bg-muted rounded-lg"
										>
											<ChevronRight className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
											<span className="text-sm">{rec}</span>
										</li>
									))}
								</ul>
							</CardContent>
						</Card>
					)}
				</>
			)}
		</div>
	);
}

export default CompetitorComparison;
