"use client";

/**
 * Win/Loss Tracker Component
 *
 * Track and display win/loss outcomes against competitors
 * with historical patterns and AI-generated insights.
 */

import * as React from "react";
import { useState, useTransition, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
	TrendingUp,
	TrendingDown,
	Trophy,
	AlertTriangle,
	BarChart3,
	Loader2,
	Target,
	Lightbulb,
	Plus,
	Building2,
	Calendar,
	Award,
	ThumbsDown,
	RefreshCw,
} from "lucide-react";
import {
	listCompetitors,
	getWinLossAnalysis,
	trackCompetitorWinLoss,
} from "@/lib/actions/competitive";
import type { Competitor, WinLossAnalysis } from "@/lib/types/competitive";

interface WinLossTrackerProps {
	/** Filter to specific competitor */
	competitorId?: string;
	/** Associated opportunity ID for recording outcomes */
	opportunityId?: string;
	/** Additional CSS classes */
	className?: string;
}

export function WinLossTracker({
	competitorId: initialCompetitorId,
	opportunityId,
	className,
}: WinLossTrackerProps) {
	// State
	const [competitors, setCompetitors] = useState<Competitor[]>([]);
	const [selectedCompetitorId, setSelectedCompetitorId] = useState(initialCompetitorId ?? "");
	const [analysis, setAnalysis] = useState<WinLossAnalysis | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	// Record outcome dialog
	const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
	const [recordOutcome, setRecordOutcome] = useState<"win" | "loss">("win");
	const [recordNotes, setRecordNotes] = useState("");

	/**
	 * Load win/loss analysis for a competitor
	 */
	const loadAnalysis = useCallback(async (competitorId: string) => {
		if (!competitorId) return;

		setIsLoadingAnalysis(true);
		setError(null);

		const result = await getWinLossAnalysis(competitorId);
		if (result.success) {
			setAnalysis(result.data);
		} else {
			setError(result.error);
			setAnalysis(null);
		}
		setIsLoadingAnalysis(false);
	}, []);

	// Load competitors
	useEffect(() => {
		async function load() {
			const result = await listCompetitors();
			if (result.success) {
				setCompetitors(result.data);

				// If initialCompetitorId provided, load analysis immediately
				if (initialCompetitorId) {
					await loadAnalysis(initialCompetitorId);
				}
			}
			setIsLoading(false);
		}
		load();
	}, [initialCompetitorId, loadAnalysis]);

	/**
	 * Handle competitor selection change
	 */
	const handleCompetitorChange = useCallback(
		(competitorId: string) => {
			setSelectedCompetitorId(competitorId);
			loadAnalysis(competitorId);
		},
		[loadAnalysis]
	);

	/**
	 * Record a win/loss outcome
	 */
	const handleRecordOutcome = useCallback(async () => {
		if (!selectedCompetitorId || !opportunityId) return;

		startTransition(async () => {
			const result = await trackCompetitorWinLoss(
				selectedCompetitorId,
				recordOutcome,
				opportunityId,
				recordNotes || undefined
			);

			if (result.success) {
				setIsRecordDialogOpen(false);
				setRecordNotes("");
				// Reload analysis
				await loadAnalysis(selectedCompetitorId);
			} else {
				setError(result.error);
			}
		});
	}, [selectedCompetitorId, opportunityId, recordOutcome, recordNotes, loadAnalysis]);

	/**
	 * Get win rate color based on value
	 */
	const getWinRateColor = (rate: number): string => {
		if (rate >= 60) return "text-green-600";
		if (rate >= 40) return "text-yellow-600";
		return "text-red-600";
	};

	/**
	 * Get win rate badge variant
	 */
	const getWinRateBadge = (rate: number): string => {
		if (rate >= 60) return "bg-green-100 text-green-800";
		if (rate >= 40) return "bg-yellow-100 text-yellow-800";
		return "bg-red-100 text-red-800";
	};

	if (isLoading) {
		return (
			<div className={cn("space-y-4", className)}>
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-48" />
			</div>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			{error && (
				<Alert variant="destructive">
					<AlertTriangle className="h-4 w-4" />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{/* Competitor Selector */}
			<div className="flex items-center gap-4">
				<div className="flex-1">
					<Select value={selectedCompetitorId} onValueChange={handleCompetitorChange}>
						<SelectTrigger>
							<SelectValue placeholder="Select a competitor to view win/loss data" />
						</SelectTrigger>
						<SelectContent>
							{competitors.map((competitor) => (
								<SelectItem key={competitor.id} value={competitor.id}>
									<div className="flex items-center gap-2">
										<Building2 className="h-4 w-4" />
										{competitor.name}
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{opportunityId && selectedCompetitorId && (
					<Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
						<DialogTrigger asChild>
							<Button variant="outline">
								<Plus className="h-4 w-4 mr-2" />
								Record Outcome
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Record Win/Loss Outcome</DialogTitle>
								<DialogDescription>
									Record the outcome of competing against this competitor
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-4 py-4">
								<div className="space-y-2">
									<Label>Outcome</Label>
									<div className="flex gap-2">
										<Button
											variant={recordOutcome === "win" ? "primary" : "outline"}
											className={cn(
												"flex-1",
												recordOutcome === "win" && "bg-green-600 hover:bg-green-700"
											)}
											onClick={() => setRecordOutcome("win")}
										>
											<Trophy className="h-4 w-4 mr-2" />
											We Won
										</Button>
										<Button
											variant={recordOutcome === "loss" ? "primary" : "outline"}
											className={cn(
												"flex-1",
												recordOutcome === "loss" && "bg-red-600 hover:bg-red-700"
											)}
											onClick={() => setRecordOutcome("loss")}
										>
											<ThumbsDown className="h-4 w-4 mr-2" />
											They Won
										</Button>
									</div>
								</div>

								<div className="space-y-2">
									<Label>Notes (Optional)</Label>
									<Textarea
										placeholder="Key factors in the outcome, lessons learned..."
										value={recordNotes}
										onChange={(e) => setRecordNotes(e.target.value)}
										className="min-h-[80px]"
									/>
								</div>
							</div>

							<DialogFooter>
								<Button variant="outline" onClick={() => setIsRecordDialogOpen(false)}>
									Cancel
								</Button>
								<Button onClick={handleRecordOutcome} disabled={isPending}>
									{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
									Record Outcome
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				)}
			</div>

			{/* No Selection State */}
			{!selectedCompetitorId && (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12 text-center">
						<BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold mb-2">Select a Competitor</h3>
						<p className="text-muted-foreground max-w-md">
							Choose a competitor above to view win/loss statistics and historical patterns.
						</p>
					</CardContent>
				</Card>
			)}

			{/* Loading Analysis */}
			{selectedCompetitorId && isLoadingAnalysis && (
				<div className="space-y-4">
					<Skeleton className="h-32" />
					<Skeleton className="h-48" />
				</div>
			)}

			{/* Analysis Display */}
			{selectedCompetitorId && !isLoadingAnalysis && analysis && (
				<>
					{/* Summary Card */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center justify-between">
								<span className="flex items-center gap-2">
									{analysis.winRate >= 50 ? (
										<TrendingUp className="h-5 w-5 text-green-600" />
									) : (
										<TrendingDown className="h-5 w-5 text-red-600" />
									)}
									Win/Loss vs {analysis.competitorName}
								</span>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => loadAnalysis(selectedCompetitorId)}
								>
									<RefreshCw className="h-4 w-4" />
								</Button>
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-4 gap-4">
								{/* Win Rate */}
								<div className="text-center">
									<div className={cn("text-3xl font-bold", getWinRateColor(analysis.winRate))}>
										{analysis.winRate.toFixed(0)}%
									</div>
									<div className="text-sm text-muted-foreground">Win Rate</div>
								</div>

								{/* Total Encounters */}
								<div className="text-center">
									<div className="text-3xl font-bold">{analysis.totalEncounters}</div>
									<div className="text-sm text-muted-foreground">Total Encounters</div>
								</div>

								{/* Wins */}
								<div className="text-center">
									<div className="text-3xl font-bold text-green-600">
										{analysis.ourWins}
									</div>
									<div className="text-sm text-muted-foreground">Our Wins</div>
								</div>

								{/* Losses */}
								<div className="text-center">
									<div className="text-3xl font-bold text-red-600">
										{analysis.ourLosses}
									</div>
									<div className="text-sm text-muted-foreground">Our Losses</div>
								</div>
							</div>

							{/* Win Rate Progress */}
							<div className="mt-6">
								<div className="flex items-center justify-between text-sm mb-2">
									<span>Win Rate Progress</span>
									<Badge variant="secondary" className={getWinRateBadge(analysis.winRate)}>
										{analysis.winRate >= 60 ? "Strong" : analysis.winRate >= 40 ? "Moderate" : "Needs Improvement"}
									</Badge>
								</div>
								<div className="relative h-4 rounded-full bg-muted overflow-hidden">
									<div
										className="absolute inset-y-0 left-0 bg-green-500 transition-all"
										style={{ width: `${analysis.winRate}%` }}
									/>
									<div
										className="absolute inset-y-0 right-0 bg-red-500"
										style={{ width: `${100 - analysis.winRate}%` }}
									/>
								</div>
								<div className="flex justify-between text-xs text-muted-foreground mt-1">
									<span>Wins: {analysis.ourWins}</span>
									<span>Losses: {analysis.ourLosses}</span>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Patterns */}
					<div className="grid grid-cols-2 gap-4">
						{/* Win Patterns */}
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-base flex items-center gap-2 text-green-600">
									<Trophy className="h-4 w-4" />
									Win Patterns
								</CardTitle>
							</CardHeader>
							<CardContent>
								<ul className="space-y-2">
									{analysis.winPatterns.map((pattern, idx) => (
										<li
											key={idx}
											className="flex items-start gap-2 text-sm"
										>
											<Award className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
											<span>{pattern}</span>
										</li>
									))}
								</ul>
							</CardContent>
						</Card>

						{/* Loss Patterns */}
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-base flex items-center gap-2 text-red-600">
									<AlertTriangle className="h-4 w-4" />
									Loss Patterns
								</CardTitle>
							</CardHeader>
							<CardContent>
								<ul className="space-y-2">
									{analysis.lossPatterns.map((pattern, idx) => (
										<li
											key={idx}
											className="flex items-start gap-2 text-sm"
										>
											<Target className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
											<span>{pattern}</span>
										</li>
									))}
								</ul>
							</CardContent>
						</Card>
					</div>

					{/* AI Insights */}
					{analysis.aiInsights && analysis.aiInsights.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="text-base flex items-center gap-2">
									<Lightbulb className="h-4 w-4 text-yellow-500" />
									Strategic Insights
								</CardTitle>
								<CardDescription>
									AI-generated recommendations based on historical performance
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									{analysis.aiInsights.map((insight, idx) => (
										<div
											key={idx}
											className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
										>
											<Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
											<p className="text-sm">{insight}</p>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</>
			)}

			{/* No Data State */}
			{selectedCompetitorId && !isLoadingAnalysis && analysis && analysis.totalEncounters === 0 && (
				<Alert>
					<Calendar className="h-4 w-4" />
					<AlertTitle>No Historical Data</AlertTitle>
					<AlertDescription>
						No win/loss records found for this competitor. Record outcomes as you compete
						against them to build historical analysis.
					</AlertDescription>
				</Alert>
			)}
		</div>
	);
}

export default WinLossTracker;
