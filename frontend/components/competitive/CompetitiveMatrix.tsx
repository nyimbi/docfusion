"use client";

/**
 * Competitive Matrix Component
 *
 * Visual comparison matrix showing evaluation criteria scores
 * across competitors with color-coded advantage indicators.
 */

import * as React from "react";
import { useState, useTransition, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	BarChart3,
	RefreshCw,
	Download,
	FileSpreadsheet,
	FileText,
	ChevronUp,
	ChevronDown,
	Minus,
	Loader2,
	Trophy,
	Target,
	Info,
	Sparkles,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	generateCompetitiveMatrix,
} from "@/lib/actions/competitive";
import type {
	CompetitiveMatrix as CompetitiveMatrixType,
	CompetitiveMatrixProps as CompetitiveMatrixDisplayProps,
} from "@/lib/types/competitive";

interface CompetitiveMatrixProps extends Partial<CompetitiveMatrixDisplayProps> {
	opportunityId: string;
	className?: string;
}

/**
 * Advantage indicator configuration
 */
const advantageConfig = {
	strong: {
		label: "Strong Advantage",
		icon: <ChevronUp className="h-4 w-4" />,
		color: "text-green-600 bg-green-100 dark:bg-green-900",
	},
	slight: {
		label: "Slight Advantage",
		icon: <ChevronUp className="h-3 w-3" />,
		color: "text-green-500 bg-green-50 dark:bg-green-950",
	},
	neutral: {
		label: "Neutral",
		icon: <Minus className="h-3 w-3" />,
		color: "text-gray-500 bg-gray-100 dark:bg-gray-800",
	},
	disadvantage: {
		label: "Disadvantage",
		icon: <ChevronDown className="h-4 w-4" />,
		color: "text-red-600 bg-red-100 dark:bg-red-900",
	},
};

/**
 * Get score color based on value (1-5 scale)
 */
function getScoreColor(score: number): string {
	if (score >= 4.5) return "text-green-600 dark:text-green-400";
	if (score >= 3.5) return "text-green-500 dark:text-green-500";
	if (score >= 2.5) return "text-yellow-600 dark:text-yellow-400";
	if (score >= 1.5) return "text-orange-600 dark:text-orange-400";
	return "text-red-600 dark:text-red-400";
}

/**
 * Get score background color based on value
 */
function getScoreBgColor(score: number): string {
	if (score >= 4.5) return "bg-green-100 dark:bg-green-900";
	if (score >= 3.5) return "bg-green-50 dark:bg-green-950";
	if (score >= 2.5) return "bg-yellow-50 dark:bg-yellow-950";
	if (score >= 1.5) return "bg-orange-50 dark:bg-orange-950";
	return "bg-red-50 dark:bg-red-950";
}

export function CompetitiveMatrix({
	opportunityId,
	matrix: initialMatrix,
	highlightAdvantages = true,
	className,
}: CompetitiveMatrixProps) {
	// State
	const [matrix, setMatrix] = useState<CompetitiveMatrixType | null>(initialMatrix ?? null);
	const [isLoading, setIsLoading] = useState(!initialMatrix);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	// Load matrix
	useEffect(() => {
		if (initialMatrix) return;

		async function loadMatrix() {
			const result = await generateCompetitiveMatrix(opportunityId);
			if (result.success) {
				setMatrix(result.data);
			} else {
				setError(result.error);
			}
			setIsLoading(false);
		}
		loadMatrix();
	}, [opportunityId, initialMatrix]);

	/**
	 * Refresh the matrix
	 */
	const handleRefresh = useCallback(async () => {
		setError(null);

		startTransition(async () => {
			const result = await generateCompetitiveMatrix(opportunityId);
			if (result.success) {
				setMatrix(result.data);
			} else {
				setError(result.error);
			}
		});
	}, [opportunityId]);

	/**
	 * Export to CSV
	 */
	const handleExportCSV = useCallback(() => {
		if (!matrix) return;

		const headers = ["Criteria", "Weight", "Our Score", ...matrix.competitors.map((c) => c.name)];
		const rows = matrix.criteria.map((criterion) => {
			const ourScore = matrix.ourScores.find((s) => s.criterionName === criterion.name);
			const competitorScores = matrix.competitors.map((comp) => {
				const score = comp.scores.find((s) => s.criterionName === criterion.name);
				return score?.score.toFixed(1) ?? "-";
			});

			return [
				criterion.name,
				(criterion.weight * 100).toFixed(0) + "%",
				ourScore?.score.toFixed(1) ?? "-",
				...competitorScores,
			];
		});

		// Add totals row
		rows.push([
			"Total Score",
			"100%",
			matrix.ourTotalScore.toFixed(1),
			...matrix.competitors.map((c) => c.totalScore.toFixed(1)),
		]);

		const csvContent = [headers, ...rows]
			.map((row) => row.map((cell) => `"${cell}"`).join(","))
			.join("\n");

		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "competitive-matrix.csv";
		link.click();
		URL.revokeObjectURL(url);
	}, [matrix]);

	/**
	 * Export to PDF (simplified - creates printable view)
	 */
	const handleExportPDF = useCallback(() => {
		if (!matrix) return;
		window.print();
	}, [matrix]);

	// Loading state
	if (isLoading) {
		return (
			<Card className={className}>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-4 w-64" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-64" />
				</CardContent>
			</Card>
		);
	}

	// Error or empty state
	if (!matrix) {
		return (
			<Card className={className}>
				<CardContent className="flex flex-col items-center justify-center py-12 text-center">
					<BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
					<h3 className="text-lg font-semibold mb-2">No Competitive Matrix</h3>
					<p className="text-muted-foreground mb-4 max-w-md">
						{error || "Generate a competitive matrix to compare your position against competitors."}
					</p>
					<Button onClick={handleRefresh} disabled={isPending}>
						{isPending ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Generating...
							</>
						) : (
							<>
								<Sparkles className="h-4 w-4 mr-2" />
								Generate Matrix
							</>
						)}
					</Button>
				</CardContent>
			</Card>
		);
	}

	// Find leader
	const allScores = [
		{ name: "Our Team", score: matrix.ourTotalScore, isUs: true },
		...matrix.competitors.map((c) => ({ name: c.name, score: c.totalScore, isUs: false })),
	].sort((a, b) => b.score - a.score);

	const leader = allScores[0];
	const ourRank = allScores.findIndex((s) => s.isUs) + 1;

	return (
		<div className={cn("space-y-4 print:space-y-2", className)}>
			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{/* Header */}
			<div className="flex items-center justify-between print:hidden">
				<div>
					<h2 className="text-lg font-semibold flex items-center gap-2">
						<BarChart3 className="h-5 w-5" />
						Competitive Matrix
					</h2>
					<p className="text-sm text-muted-foreground">
						Comparative scoring across evaluation criteria
					</p>
				</div>
				<div className="flex items-center gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm">
								<Download className="h-4 w-4 mr-1" />
								Export
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={handleExportCSV}>
								<FileSpreadsheet className="h-4 w-4 mr-2" />
								Export as CSV
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleExportPDF}>
								<FileText className="h-4 w-4 mr-2" />
								Print / PDF
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<Button variant="outline" size="sm" onClick={handleRefresh} disabled={isPending}>
						{isPending ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<RefreshCw className="h-4 w-4" />
						)}
					</Button>
				</div>
			</div>

			{/* Summary Cards */}
			<div className="grid grid-cols-3 gap-4 print:hidden">
				{/* Our Position */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Our Position</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2">
							<span className={cn("text-2xl font-bold", getScoreColor(matrix.ourTotalScore))}>
								#{ourRank}
							</span>
							<span className="text-muted-foreground">of {allScores.length}</span>
						</div>
						<p className="text-sm text-muted-foreground mt-1">
							Total Score: {matrix.ourTotalScore.toFixed(1)}
						</p>
					</CardContent>
				</Card>

				{/* Leading Competitor */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-1">
							<Trophy className="h-4 w-4 text-yellow-500" />
							{leader.isUs ? "We're Leading" : "Leader"}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-lg font-semibold">{leader.name}</p>
						<p className="text-sm text-muted-foreground">
							Score: {leader.score.toFixed(1)}
						</p>
					</CardContent>
				</Card>

				{/* Advantage Count */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Our Advantages</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-4">
							<div className="text-center">
								<p className="text-lg font-semibold text-green-600">
									{matrix.ourScores.filter((s) => s.advantage === "strong" || s.advantage === "slight").length}
								</p>
								<p className="text-xs text-muted-foreground">Advantages</p>
							</div>
							<div className="text-center">
								<p className="text-lg font-semibold text-gray-500">
									{matrix.ourScores.filter((s) => s.advantage === "neutral").length}
								</p>
								<p className="text-xs text-muted-foreground">Neutral</p>
							</div>
							<div className="text-center">
								<p className="text-lg font-semibold text-red-600">
									{matrix.ourScores.filter((s) => s.advantage === "disadvantage").length}
								</p>
								<p className="text-xs text-muted-foreground">Gaps</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Matrix Table */}
			<Card>
				<CardContent className="p-0">
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-[180px]">Criteria</TableHead>
									<TableHead className="w-[80px] text-center">Weight</TableHead>
									<TableHead className={cn(
										"text-center min-w-[120px]",
										highlightAdvantages && "bg-primary/10"
									)}>
										<div className="flex items-center justify-center gap-1">
											<Target className="h-4 w-4" />
											Our Team
										</div>
									</TableHead>
									{matrix.competitors.map((competitor) => (
										<TableHead key={competitor.id} className="text-center min-w-[120px]">
											{competitor.name}
										</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{matrix.criteria.map((criterion) => {
									const ourScore = matrix.ourScores.find(
										(s) => s.criterionName === criterion.name
									);

									return (
										<TableRow key={criterion.name}>
											<TableCell className="font-medium">
												{criterion.name}
											</TableCell>
											<TableCell className="text-center text-muted-foreground">
												{(criterion.weight * 100).toFixed(0)}%
											</TableCell>
											<TableCell
												className={cn(
													"text-center",
													highlightAdvantages && "bg-primary/5"
												)}
											>
												<TooltipProvider>
													<Tooltip>
														<TooltipTrigger asChild>
															<div className="flex items-center justify-center gap-2">
																<span
																	className={cn(
																		"font-semibold",
																		getScoreColor(ourScore?.score ?? 0)
																	)}
																>
																	{ourScore?.score.toFixed(1) ?? "-"}
																</span>
																{highlightAdvantages && ourScore && (
																	<Badge
																		variant="secondary"
																		className={cn(
																			"h-5 w-5 p-0 flex items-center justify-center",
																			advantageConfig[ourScore.advantage].color
																		)}
																	>
																		{advantageConfig[ourScore.advantage].icon}
																	</Badge>
																)}
															</div>
														</TooltipTrigger>
														<TooltipContent>
															<p className="font-medium">{ourScore?.notes ?? "No notes"}</p>
															{ourScore && (
																<p className="text-xs text-muted-foreground">
																	{advantageConfig[ourScore.advantage].label}
																</p>
															)}
														</TooltipContent>
													</Tooltip>
												</TooltipProvider>
											</TableCell>
											{matrix.competitors.map((competitor) => {
												const score = competitor.scores.find(
													(s) => s.criterionName === criterion.name
												);

												return (
													<TableCell key={competitor.id} className="text-center">
														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger asChild>
																	<span
																		className={cn(
																			"font-medium",
																			getScoreColor(score?.score ?? 0)
																		)}
																	>
																		{score?.score.toFixed(1) ?? "-"}
																	</span>
																</TooltipTrigger>
																<TooltipContent>
																	<p>{score?.notes ?? "No notes available"}</p>
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>
													</TableCell>
												);
											})}
										</TableRow>
									);
								})}

								{/* Totals Row */}
								<TableRow className="border-t-2 font-semibold bg-muted/30">
									<TableCell>Total Score</TableCell>
									<TableCell className="text-center">100%</TableCell>
									<TableCell
										className={cn(
											"text-center",
											highlightAdvantages && "bg-primary/10"
										)}
									>
										<span className={cn("text-lg", getScoreColor(matrix.ourTotalScore))}>
											{matrix.ourTotalScore.toFixed(1)}
										</span>
									</TableCell>
									{matrix.competitors.map((competitor) => (
										<TableCell key={competitor.id} className="text-center">
											<span className={cn("text-lg", getScoreColor(competitor.totalScore))}>
												{competitor.totalScore.toFixed(1)}
											</span>
										</TableCell>
									))}
								</TableRow>
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			{/* Score Legend */}
			<Card className="print:hidden">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm">Legend</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap gap-4">
						<div className="flex items-center gap-2 text-sm">
							<span className="font-medium">Score Range:</span>
							<Badge className={getScoreBgColor(5)}>5.0 = Excellent</Badge>
							<Badge className={getScoreBgColor(4)}>4.0 = Good</Badge>
							<Badge className={getScoreBgColor(3)}>3.0 = Average</Badge>
							<Badge className={getScoreBgColor(2)}>2.0 = Below Avg</Badge>
							<Badge className={getScoreBgColor(1)}>1.0 = Poor</Badge>
						</div>
					</div>
					{highlightAdvantages && (
						<div className="flex flex-wrap gap-3 mt-2 pt-2 border-t">
							{Object.entries(advantageConfig).map(([key, config]) => (
								<div key={key} className="flex items-center gap-1 text-sm">
									<Badge variant="secondary" className={cn("h-5 w-5 p-0", config.color)}>
										{config.icon}
									</Badge>
									<span>{config.label}</span>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Usage Note */}
			<Alert className="print:hidden">
				<Info className="h-4 w-4" />
				<AlertDescription>
					Scores are estimated based on known competitor capabilities and past performance.
					Use this matrix to identify areas where you have competitive advantages to emphasize
					and gaps that need addressing in your proposal.
				</AlertDescription>
			</Alert>
		</div>
	);
}

export default CompetitiveMatrix;
