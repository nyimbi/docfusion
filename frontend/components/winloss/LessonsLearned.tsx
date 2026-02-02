"use client";

/**
 * Lessons Learned Component
 *
 * Displays synthesized lessons learned from win/loss debriefs
 * with categorization, filtering, and export capabilities.
 */

import { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Lightbulb,
	Search,
	Filter,
	Trophy,
	XCircle,
	TrendingUp,
	TrendingDown,
	CheckCircle,
	AlertTriangle,
	Target,
	Download,
	RefreshCw,
	Loader2,
	Hash,
	BarChart3,
} from "lucide-react";
import { generateLessonsLearnedReport } from "@/lib/actions/winloss";
import type { LessonsReport, LessonItem } from "@/lib/types/winloss";

interface LessonsLearnedProps {
	initialReport?: LessonsReport;
	onExport?: (format: "pdf" | "xlsx") => void;
	className?: string;
}

type CategoryFilter = "all" | "technical" | "pricing" | "team" | "management" | "experience" | "general";
type OutcomeFilter = "all" | "win" | "loss" | "both";

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
	technical: { label: "Technical", color: "text-blue-700", bgColor: "bg-blue-100" },
	pricing: { label: "Pricing", color: "text-amber-700", bgColor: "bg-amber-100" },
	team: { label: "Team", color: "text-purple-700", bgColor: "bg-purple-100" },
	management: { label: "Management", color: "text-cyan-700", bgColor: "bg-cyan-100" },
	experience: { label: "Experience", color: "text-green-700", bgColor: "bg-green-100" },
	general: { label: "General", color: "text-gray-700", bgColor: "bg-gray-100" },
};

export function LessonsLearned({
	initialReport,
	onExport,
	className,
}: LessonsLearnedProps) {
	const [isPending, startTransition] = useTransition();
	const [report, setReport] = useState<LessonsReport | null>(initialReport ?? null);
	const [isLoading, setIsLoading] = useState(!initialReport);
	const [searchQuery, setSearchQuery] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
	const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");

	// Fetch report
	const fetchReport = useCallback(async () => {
		startTransition(async () => {
			setIsLoading(true);
			try {
				const result = await generateLessonsLearnedReport();

				if (result.success && result.data) {
					setReport(result.data as unknown as LessonsReport);
				}
			} catch (error) {
				console.error("Failed to fetch lessons learned report:", error);
			} finally {
				setIsLoading(false);
			}
		});
	}, []);

	useEffect(() => {
		if (!initialReport) {
			fetchReport();
		}
	}, [initialReport, fetchReport]);

	// Filter lessons
	const filteredLessons = useMemo(() => {
		if (!report?.lessonsLearned) return [];

		return report.lessonsLearned.filter((lesson) => {
			// Search filter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				if (!lesson.lesson.toLowerCase().includes(query)) {
					return false;
				}
			}

			// Category filter
			if (categoryFilter !== "all" && lesson.category !== categoryFilter) {
				return false;
			}

			// Outcome filter
			if (outcomeFilter !== "all" && lesson.relatedOutcome !== outcomeFilter) {
				return false;
			}

			return true;
		});
	}, [report?.lessonsLearned, searchQuery, categoryFilter, outcomeFilter]);

	// Calculate category stats
	const categoryStats = useMemo(() => {
		if (!report?.lessonsLearned) return {};

		const stats: Record<string, number> = {};
		for (const lesson of report.lessonsLearned) {
			stats[lesson.category] = (stats[lesson.category] || 0) + 1;
		}
		return stats;
	}, [report?.lessonsLearned]);

	if (isLoading) {
		return (
			<div className={cn("space-y-6", className)}>
				<div className="flex items-center justify-between">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-10 w-32" />
				</div>
				<div className="grid grid-cols-3 gap-4">
					{[1, 2, 3].map((i) => (
						<Card key={i}>
							<CardContent className="pt-6">
								<Skeleton className="h-6 w-3/4 mb-2" />
								<Skeleton className="h-4 w-full" />
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
		);
	}

	if (!report) {
		return (
			<div className={cn("text-center py-12", className)}>
				<Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
				<p className="text-muted-foreground">No lessons learned report available</p>
				<Button onClick={fetchReport} className="mt-4">
					Generate Report
				</Button>
			</div>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h2 className="text-xl font-semibold">Lessons Learned</h2>
					{isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
					<Badge variant="outline" className="text-muted-foreground">
						{report.lessonsLearned.length} lessons
					</Badge>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" onClick={fetchReport} disabled={isPending}>
						<RefreshCw className={cn("h-4 w-4 mr-2", isPending && "animate-spin")} />
						Refresh
					</Button>
					{onExport && (
						<Button variant="outline" onClick={() => onExport("pdf")}>
							<Download className="h-4 w-4 mr-2" />
							Export
						</Button>
					)}
				</div>
			</div>

			{/* Summary Cards */}
			<div className="grid grid-cols-3 gap-4">
				{/* Top Strengths */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base flex items-center gap-2">
							<TrendingUp className="h-5 w-5 text-green-600" />
							Top Strengths
						</CardTitle>
					</CardHeader>
					<CardContent>
						{report.topStrengths.length > 0 ? (
							<ul className="space-y-2">
								{report.topStrengths.slice(0, 5).map((strength, index) => (
									<li
										key={index}
										className="flex items-start gap-2 text-sm"
									>
										<CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
										<span className="line-clamp-2">{strength}</span>
									</li>
								))}
							</ul>
						) : (
							<p className="text-sm text-muted-foreground">No strengths identified</p>
						)}
					</CardContent>
				</Card>

				{/* Top Weaknesses */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base flex items-center gap-2">
							<TrendingDown className="h-5 w-5 text-red-600" />
							Top Weaknesses
						</CardTitle>
					</CardHeader>
					<CardContent>
						{report.topWeaknesses.length > 0 ? (
							<ul className="space-y-2">
								{report.topWeaknesses.slice(0, 5).map((weakness, index) => (
									<li
										key={index}
										className="flex items-start gap-2 text-sm"
									>
										<AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
										<span className="line-clamp-2">{weakness}</span>
									</li>
								))}
							</ul>
						) : (
							<p className="text-sm text-muted-foreground">No weaknesses identified</p>
						)}
					</CardContent>
				</Card>

				{/* Improvement Areas */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base flex items-center gap-2">
							<Target className="h-5 w-5 text-blue-600" />
							Improvement Areas
						</CardTitle>
					</CardHeader>
					<CardContent>
						{report.improvementAreas.length > 0 ? (
							<ul className="space-y-2">
								{report.improvementAreas.slice(0, 5).map((area, index) => (
									<li
										key={index}
										className="flex items-start gap-2 text-sm"
									>
										<Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
										<span className="line-clamp-2">{area}</span>
									</li>
								))}
							</ul>
						) : (
							<p className="text-sm text-muted-foreground">No areas identified</p>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Category Distribution */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<BarChart3 className="h-5 w-5" />
						Lessons by Category
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap gap-2">
						{Object.entries(categoryStats).map(([category, count]) => {
							const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.general;
							return (
								<button
									key={category}
									type="button"
									onClick={() =>
										setCategoryFilter(
											categoryFilter === category
												? "all"
												: (category as CategoryFilter)
										)
									}
									className={cn(
										"flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
										categoryFilter === category
											? "border-primary bg-primary/10"
											: "hover:border-muted-foreground/50"
									)}
								>
									<Badge variant="secondary" className={cn(config.bgColor, config.color)}>
										{config.label}
									</Badge>
									<span className="text-sm font-medium">{count}</span>
								</button>
							);
						})}
					</div>
				</CardContent>
			</Card>

			{/* Filters */}
			<div className="flex items-center gap-4">
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search lessons..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>

				<Select
					value={outcomeFilter}
					onValueChange={(value) => setOutcomeFilter(value as OutcomeFilter)}
				>
					<SelectTrigger className="w-[160px]">
						<SelectValue placeholder="All Outcomes" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Outcomes</SelectItem>
						<SelectItem value="win">From Wins</SelectItem>
						<SelectItem value="loss">From Losses</SelectItem>
						<SelectItem value="both">Both</SelectItem>
					</SelectContent>
				</Select>

				{(searchQuery || categoryFilter !== "all" || outcomeFilter !== "all") && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setSearchQuery("");
							setCategoryFilter("all");
							setOutcomeFilter("all");
						}}
					>
						Clear Filters
					</Button>
				)}
			</div>

			{/* Lessons List */}
			<div className="space-y-3">
				{filteredLessons.length > 0 ? (
					filteredLessons.map((lesson, index) => {
						const categoryConfig =
							CATEGORY_CONFIG[lesson.category] ?? CATEGORY_CONFIG.general;

						return (
							<Card key={index} className="hover:bg-muted/50 transition-colors">
								<CardContent className="py-4">
									<div className="flex items-start gap-4">
										{/* Outcome Icon */}
										<div
											className={cn(
												"p-2 rounded-full flex-shrink-0",
												lesson.relatedOutcome === "win"
													? "bg-green-100"
													: lesson.relatedOutcome === "loss"
													? "bg-red-100"
													: "bg-gray-100"
											)}
										>
											{lesson.relatedOutcome === "win" ? (
												<Trophy className="h-5 w-5 text-green-600" />
											) : lesson.relatedOutcome === "loss" ? (
												<XCircle className="h-5 w-5 text-red-600" />
											) : (
												<Lightbulb className="h-5 w-5 text-gray-600" />
											)}
										</div>

										{/* Content */}
										<div className="flex-1 min-w-0">
											<p className="font-medium">{lesson.lesson}</p>

											<div className="flex items-center gap-3 mt-2">
												<Badge
													variant="secondary"
													className={cn(
														categoryConfig.bgColor,
														categoryConfig.color
													)}
												>
													{categoryConfig.label}
												</Badge>

												<span className="flex items-center gap-1 text-sm text-muted-foreground">
													<Hash className="h-3 w-3" />
													{lesson.frequency}x mentioned
												</span>

												{lesson.examples && lesson.examples.length > 0 && (
													<span className="text-sm text-muted-foreground">
														{lesson.examples.length} examples
													</span>
												)}
											</div>

											{/* Examples (if any) */}
											{lesson.examples && lesson.examples.length > 0 && (
												<div className="mt-3 pl-4 border-l-2 border-muted">
													<p className="text-sm text-muted-foreground italic">
														{lesson.examples[0]}
													</p>
												</div>
											)}
										</div>

										{/* Frequency indicator */}
										<div className="flex-shrink-0 text-right">
											<div
												className={cn(
													"inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
													lesson.frequency >= 5
														? "bg-red-100 text-red-700"
														: lesson.frequency >= 3
														? "bg-amber-100 text-amber-700"
														: "bg-gray-100 text-gray-700"
												)}
											>
												{lesson.frequency}
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						);
					})
				) : (
					<Card>
						<CardContent className="py-12 text-center">
							<Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
							<p className="text-muted-foreground">No lessons match your filters</p>
							<Button
								variant="ghost"
								onClick={() => {
									setSearchQuery("");
									setCategoryFilter("all");
									setOutcomeFilter("all");
								}}
								className="mt-2"
							>
								Clear Filters
							</Button>
						</CardContent>
					</Card>
				)}
			</div>

			{/* Results count */}
			{filteredLessons.length > 0 && (
				<p className="text-sm text-muted-foreground text-center">
					Showing {filteredLessons.length} of {report.lessonsLearned.length} lessons
				</p>
			)}

			{/* Generated timestamp */}
			{report.generatedAt && (
				<p className="text-xs text-muted-foreground text-center">
					Report generated: {new Date(report.generatedAt).toLocaleString()}
				</p>
			)}
		</div>
	);
}

export default LessonsLearned;
