/**
 * ReviewDashboard - Review Management Overview
 *
 * Central hub for managing all proposal reviews. Displays review timeline,
 * status overview, and quick actions for Pink/Red/Gold team reviews.
 */

"use client";

import { useState, useMemo } from "react";
import {
	Calendar,
	CheckCircle2,
	Clock,
	FileText,
	Plus,
	Users,
	AlertTriangle,
	BarChart3,
	ChevronRight,
	Play,
	Pause,
	MoreHorizontal,
	Filter,
	Search,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface Review {
	id: string;
	opportunityId: string;
	reviewType: "pink" | "red" | "gold" | "compliance" | "final";
	reviewName: string;
	description?: string;
	status: "draft" | "scheduled" | "in_progress" | "completed" | "cancelled";
	scheduledDate: string | null;
	scheduledEndDate?: string | null;
	startedAt?: string | null;
	completedAt?: string | null;
	overallScore?: number | null;
	recommendation?: string | null;
	totalComments: number;
	criticalIssues: number;
	resolvedIssues: number;
	reviewerCount: number;
	documentVersion?: string;
}

export interface ReviewDashboardProps {
	opportunityId: string;
	opportunityName: string;
	reviews: Review[];
	onCreateReview?: () => void;
	onViewReview?: (reviewId: string) => void;
	onStartReview?: (reviewId: string) => void;
	onCompleteReview?: (reviewId: string) => void;
	onCancelReview?: (reviewId: string) => void;
	onViewReport?: (reviewId: string) => void;
	className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const REVIEW_TYPE_CONFIG: Record<
	Review["reviewType"],
	{ label: string; color: string; bgColor: string; description: string }
> = {
	pink: {
		label: "Pink Team",
		color: "text-pink-700 dark:text-pink-400",
		bgColor: "bg-pink-100 dark:bg-pink-900/30",
		description: "Initial draft review - outline & compliance",
	},
	red: {
		label: "Red Team",
		color: "text-red-700 dark:text-red-400",
		bgColor: "bg-red-100 dark:bg-red-900/30",
		description: "Full review - simulates government evaluation",
	},
	gold: {
		label: "Gold Team",
		color: "text-amber-700 dark:text-amber-400",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
		description: "Final review - polish & verification",
	},
	compliance: {
		label: "Compliance",
		color: "text-blue-700 dark:text-blue-400",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
		description: "Requirements traceability review",
	},
	final: {
		label: "Final",
		color: "text-purple-700 dark:text-purple-400",
		bgColor: "bg-purple-100 dark:bg-purple-900/30",
		description: "Last look before submission",
	},
};

const STATUS_CONFIG: Record<
	Review["status"],
	{ label: string; icon: typeof Clock; color: string }
> = {
	draft: { label: "Draft", icon: FileText, color: "text-muted-foreground" },
	scheduled: { label: "Scheduled", icon: Calendar, color: "text-blue-600" },
	in_progress: { label: "In Progress", icon: Play, color: "text-amber-600" },
	completed: { label: "Completed", icon: CheckCircle2, color: "text-green-600" },
	cancelled: { label: "Cancelled", icon: Pause, color: "text-red-600" },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ReviewDashboard({
	opportunityId,
	opportunityName,
	reviews,
	onCreateReview,
	onViewReview,
	onStartReview,
	onCompleteReview,
	onCancelReview,
	onViewReport,
	className,
}: ReviewDashboardProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<Review["status"] | "all">("all");
	const [activeTab, setActiveTab] = useState<"timeline" | "list" | "metrics">("timeline");

	// Filter reviews
	const filteredReviews = useMemo(() => {
		return reviews.filter((review) => {
			const matchesSearch =
				searchQuery === "" ||
				review.reviewName.toLowerCase().includes(searchQuery.toLowerCase()) ||
				review.reviewType.toLowerCase().includes(searchQuery.toLowerCase());
			const matchesStatus =
				statusFilter === "all" || review.status === statusFilter;
			return matchesSearch && matchesStatus;
		});
	}, [reviews, searchQuery, statusFilter]);

	// Calculate statistics
	const stats = useMemo(() => {
		const total = reviews.length;
		const completed = reviews.filter((r) => r.status === "completed").length;
		const inProgress = reviews.filter((r) => r.status === "in_progress").length;
		const totalComments = reviews.reduce((sum, r) => sum + r.totalComments, 0);
		const totalCritical = reviews.reduce((sum, r) => sum + r.criticalIssues, 0);
		const totalResolved = reviews.reduce((sum, r) => sum + r.resolvedIssues, 0);
		const avgScore =
			reviews
				.filter((r) => r.overallScore != null)
				.reduce((sum, r) => sum + (r.overallScore || 0), 0) /
				(reviews.filter((r) => r.overallScore != null).length || 1);

		return {
			total,
			completed,
			inProgress,
			totalComments,
			totalCritical,
			totalResolved,
			avgScore,
			resolutionRate: totalComments > 0 ? (totalResolved / totalComments) * 100 : 0,
		};
	}, [reviews]);

	// Group reviews by type for timeline view
	const reviewsByType = useMemo(() => {
		const grouped: Record<Review["reviewType"], Review[]> = {
			pink: [],
			red: [],
			gold: [],
			compliance: [],
			final: [],
		};
		filteredReviews.forEach((review) => {
			grouped[review.reviewType].push(review);
		});
		return grouped;
	}, [filteredReviews]);

	// Format date
	const formatDate = (dateStr: string | null | undefined) => {
		if (!dateStr) return "Not scheduled";
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	// Render review card
	const renderReviewCard = (review: Review) => {
		const typeConfig = REVIEW_TYPE_CONFIG[review.reviewType];
		const statusConfig = STATUS_CONFIG[review.status];
		const StatusIcon = statusConfig.icon;

		return (
			<Card
				key={review.id}
				className={cn(
					"cursor-pointer transition-all hover:shadow-md",
					review.status === "in_progress" && "ring-2 ring-amber-500/50"
				)}
				onClick={() => onViewReview?.(review.id)}
			>
				<CardContent className="p-4">
					<div className="flex items-start justify-between gap-4">
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 mb-1">
								<Badge
									variant="secondary"
									className={cn(typeConfig.bgColor, typeConfig.color)}
								>
									{typeConfig.label}
								</Badge>
								<div className={cn("flex items-center gap-1 text-sm", statusConfig.color)}>
									<StatusIcon className="h-3.5 w-3.5" />
									<span>{statusConfig.label}</span>
								</div>
							</div>

							<h4 className="font-medium truncate">{review.reviewName}</h4>

							<div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
								<span className="flex items-center gap-1">
									<Calendar className="h-3.5 w-3.5" />
									{formatDate(review.scheduledDate)}
								</span>
								<span className="flex items-center gap-1">
									<Users className="h-3.5 w-3.5" />
									{review.reviewerCount} reviewers
								</span>
							</div>
						</div>

						<DropdownMenu>
							<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
								<Button variant="ghost" size="icon" className="h-8 w-8">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => onViewReview?.(review.id)}>
									<FileText className="h-4 w-4 mr-2" />
									View Details
								</DropdownMenuItem>
								{review.status === "scheduled" && (
									<DropdownMenuItem onClick={() => onStartReview?.(review.id)}>
										<Play className="h-4 w-4 mr-2" />
										Start Review
									</DropdownMenuItem>
								)}
								{review.status === "in_progress" && (
									<DropdownMenuItem onClick={() => onCompleteReview?.(review.id)}>
										<CheckCircle2 className="h-4 w-4 mr-2" />
										Complete Review
									</DropdownMenuItem>
								)}
								{review.status === "completed" && (
									<DropdownMenuItem onClick={() => onViewReport?.(review.id)}>
										<BarChart3 className="h-4 w-4 mr-2" />
										View Report
									</DropdownMenuItem>
								)}
								<DropdownMenuSeparator />
								{review.status !== "completed" && review.status !== "cancelled" && (
									<DropdownMenuItem
										onClick={() => onCancelReview?.(review.id)}
										className="text-destructive"
									>
										<Pause className="h-4 w-4 mr-2" />
										Cancel Review
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					{/* Statistics row */}
					{review.totalComments > 0 && (
						<div className="mt-3 pt-3 border-t flex items-center gap-4">
							<div className="flex items-center gap-1.5">
								<span className="text-sm font-medium">{review.totalComments}</span>
								<span className="text-xs text-muted-foreground">comments</span>
							</div>
							{review.criticalIssues > 0 && (
								<div className="flex items-center gap-1.5 text-red-600">
									<AlertTriangle className="h-3.5 w-3.5" />
									<span className="text-sm font-medium">{review.criticalIssues}</span>
									<span className="text-xs">critical</span>
								</div>
							)}
							{review.overallScore != null && (
								<div className="ml-auto flex items-center gap-1.5">
									<span className="text-sm font-medium">{review.overallScore.toFixed(1)}</span>
									<span className="text-xs text-muted-foreground">score</span>
								</div>
							)}
						</div>
					)}
				</CardContent>
			</Card>
		);
	};

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold">Review Management</h2>
					<p className="text-muted-foreground">{opportunityName}</p>
				</div>
				<Button onClick={onCreateReview}>
					<Plus className="h-4 w-4 mr-2" />
					Schedule Review
				</Button>
			</div>

			{/* Statistics Cards */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
								<FileText className="h-5 w-5 text-blue-600" />
							</div>
							<div>
								<p className="text-2xl font-bold">{stats.total}</p>
								<p className="text-xs text-muted-foreground">Total Reviews</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
								<CheckCircle2 className="h-5 w-5 text-green-600" />
							</div>
							<div>
								<p className="text-2xl font-bold">{stats.completed}</p>
								<p className="text-xs text-muted-foreground">Completed</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
								<AlertTriangle className="h-5 w-5 text-amber-600" />
							</div>
							<div>
								<p className="text-2xl font-bold">{stats.totalCritical}</p>
								<p className="text-xs text-muted-foreground">Critical Issues</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
								<BarChart3 className="h-5 w-5 text-purple-600" />
							</div>
							<div>
								<p className="text-2xl font-bold">{stats.avgScore.toFixed(1)}</p>
								<p className="text-xs text-muted-foreground">Avg Score</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Resolution Progress */}
			<Card>
				<CardContent className="p-4">
					<div className="flex items-center justify-between mb-2">
						<span className="text-sm font-medium">Issue Resolution Progress</span>
						<span className="text-sm text-muted-foreground">
							{stats.totalResolved} / {stats.totalComments} resolved
						</span>
					</div>
					<Progress value={stats.resolutionRate} className="h-2" />
					<p className="text-xs text-muted-foreground mt-1">
						{stats.resolutionRate.toFixed(1)}% resolution rate across all reviews
					</p>
				</CardContent>
			</Card>

			{/* Tabs */}
			<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
				<div className="flex items-center justify-between gap-4">
					<TabsList>
						<TabsTrigger value="timeline">Timeline</TabsTrigger>
						<TabsTrigger value="list">List View</TabsTrigger>
						<TabsTrigger value="metrics">Metrics</TabsTrigger>
					</TabsList>

					<div className="flex items-center gap-2">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search reviews..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9 w-[200px]"
							/>
						</div>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm">
									<Filter className="h-4 w-4 mr-2" />
									{statusFilter === "all" ? "All Status" : STATUS_CONFIG[statusFilter].label}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent>
								<DropdownMenuItem onClick={() => setStatusFilter("all")}>
									All Status
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								{Object.entries(STATUS_CONFIG).map(([status, config]) => (
									<DropdownMenuItem
										key={status}
										onClick={() => setStatusFilter(status as Review["status"])}
									>
										<config.icon className={cn("h-4 w-4 mr-2", config.color)} />
										{config.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{/* Timeline View */}
				<TabsContent value="timeline" className="mt-4">
					<div className="space-y-6">
						{(["pink", "red", "gold", "compliance", "final"] as const).map((type) => {
							const typeReviews = reviewsByType[type];
							const config = REVIEW_TYPE_CONFIG[type];

							return (
								<div key={type} className="relative">
									<div className="flex items-center gap-3 mb-3">
										<div
											className={cn(
												"w-3 h-3 rounded-full",
												config.bgColor,
												"border-2",
												config.color.replace("text-", "border-")
											)}
										/>
										<h3 className={cn("font-semibold", config.color)}>
											{config.label}
										</h3>
										<span className="text-sm text-muted-foreground">
											{config.description}
										</span>
										{typeReviews.length > 0 && (
											<Badge variant="secondary" className="ml-auto">
												{typeReviews.length}
											</Badge>
										)}
									</div>

									{typeReviews.length > 0 ? (
										<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 pl-6 border-l-2 border-muted ml-1.5">
											{typeReviews.map(renderReviewCard)}
										</div>
									) : (
										<div className="pl-6 border-l-2 border-muted ml-1.5">
											<p className="text-sm text-muted-foreground py-2">
												No {config.label.toLowerCase()} reviews scheduled
											</p>
										</div>
									)}
								</div>
							);
						})}
					</div>
				</TabsContent>

				{/* List View */}
				<TabsContent value="list" className="mt-4">
					<div className="space-y-3">
						{filteredReviews.length > 0 ? (
							filteredReviews.map(renderReviewCard)
						) : (
							<Card>
								<CardContent className="p-8 text-center">
									<p className="text-muted-foreground">No reviews found</p>
								</CardContent>
							</Card>
						)}
					</div>
				</TabsContent>

				{/* Metrics View */}
				<TabsContent value="metrics" className="mt-4">
					<div className="grid gap-4 md:grid-cols-2">
						{/* Reviews by Type */}
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Reviews by Type</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								{(["pink", "red", "gold", "compliance", "final"] as const).map((type) => {
									const config = REVIEW_TYPE_CONFIG[type];
									const count = reviewsByType[type].length;
									const completed = reviewsByType[type].filter(
										(r) => r.status === "completed"
									).length;

									return (
										<div key={type} className="flex items-center gap-3">
											<Badge
												variant="secondary"
												className={cn(config.bgColor, config.color, "w-24 justify-center")}
											>
												{config.label}
											</Badge>
											<div className="flex-1">
												<Progress
													value={count > 0 ? (completed / count) * 100 : 0}
													className="h-2"
												/>
											</div>
											<span className="text-sm text-muted-foreground w-16 text-right">
												{completed}/{count}
											</span>
										</div>
									);
								})}
							</CardContent>
						</Card>

						{/* Issue Distribution */}
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Issue Distribution</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								{[
									{ label: "Critical", count: stats.totalCritical, color: "bg-red-500" },
									{
										label: "Major",
										count: Math.round(stats.totalComments * 0.3),
										color: "bg-orange-500",
									},
									{
										label: "Minor",
										count: Math.round(stats.totalComments * 0.4),
										color: "bg-yellow-500",
									},
									{
										label: "Editorial",
										count: Math.round(stats.totalComments * 0.2),
										color: "bg-blue-500",
									},
								].map((item) => (
									<div key={item.label} className="flex items-center gap-3">
										<span className="text-sm w-20">{item.label}</span>
										<div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
											<div
												className={cn("h-full rounded-full", item.color)}
												style={{
													width: `${stats.totalComments > 0 ? (item.count / stats.totalComments) * 100 : 0}%`,
												}}
											/>
										</div>
										<span className="text-sm text-muted-foreground w-12 text-right">
											{item.count}
										</span>
									</div>
								))}
							</CardContent>
						</Card>

						{/* Recent Activity */}
						<Card className="md:col-span-2">
							<CardHeader>
								<CardTitle className="text-base">Recent Review Activity</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									{reviews
										.filter((r) => r.completedAt || r.startedAt || r.scheduledDate)
										.sort((a, b) => {
											const dateA = new Date(a.completedAt || a.startedAt || a.scheduledDate || 0);
											const dateB = new Date(b.completedAt || b.startedAt || b.scheduledDate || 0);
											return dateB.getTime() - dateA.getTime();
										})
										.slice(0, 5)
										.map((review) => {
											const config = REVIEW_TYPE_CONFIG[review.reviewType];
											return (
												<div
													key={review.id}
													className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
													onClick={() => onViewReview?.(review.id)}
												>
													<Badge
														variant="secondary"
														className={cn(config.bgColor, config.color)}
													>
														{config.label}
													</Badge>
													<span className="flex-1 truncate">{review.reviewName}</span>
													<span className="text-sm text-muted-foreground">
														{formatDate(
															review.completedAt || review.startedAt || review.scheduledDate
														)}
													</span>
													<ChevronRight className="h-4 w-4 text-muted-foreground" />
												</div>
											);
										})}
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}

export default ReviewDashboard;
