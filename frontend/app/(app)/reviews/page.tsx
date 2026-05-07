/**
 * Reviews Page
 *
 * Formal Review Process (Pink/Red/Gold Team) with structured templates,
 * anonymous scoring, resolution tracking, and effectiveness metrics.
 */

"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useTransition } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// import { Input } from "@/components/ui/input"; // Unused
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	ClipboardCheck,
	Plus,
	Calendar,
	MessageSquare,
	BarChart2,
	CheckCircle,
	Users,
	X,
	FileText,
	AlertTriangle,
	RefreshCw,
} from "lucide-react";

// Import real review components
import { CommentPanel } from "@/components/reviews/CommentPanel";
import { ResolutionTracker } from "@/components/reviews/ResolutionTracker";
import { ReviewScheduler } from "@/components/reviews/ReviewScheduler";
// Note: ReviewMetrics, ScoringRubric, ScoreAggregation, ReviewReport, BeforeAfterView
// are available but require specific data structures - using computed metrics for now

// Import server actions
import {
	listAllReviews,
	getReview,
	getReviewComments,
	resolveComment,
	updateComment,
} from "@/lib/actions/reviews";
import { getOpportunities } from "@/lib/actions/opportunities";
import { useSession } from "@/lib/auth-client";

// Types for state management
interface Review {
	id: string;
	opportunityId: string;
	opportunityName?: string;
	reviewType: string;
	reviewName: string;
	status: string;
	scheduledDate: string | null;
	completedAt: string | null;
	totalComments: number;
	criticalIssues: number;
	resolvedIssues: number;
	overallScore: number | null;
	recommendation: string | null;
	reviewerCount: number;
}

interface Comment {
	id: string;
	reviewerId: string;
	reviewerName: string | null;
	commentType: string;
	severity: string;
	category: string;
	title: string | null;
	comment: string;
	sectionId: string | null;
	resolutionStatus: string;
	resolvedBy: string | null;
	resolvedAt: string | null;
	tags: string[] | null;
}

interface ResolutionItem {
	id: string;
	commentId: string;
	title: string;
	description: string;
	severity: "critical" | "major" | "minor" | "editorial";
	category: string;
	sectionName?: string;
	status: "open" | "in_progress" | "resolved" | "wont_fix" | "deferred";
	assignedTo?: string;
	assignedToName?: string;
	resolutionNotes?: string;
	createdAt: string;
	resolvedAt?: string;
	dueDate?: string;
	priorityRank?: number;
}

export default function ReviewsPage() {
	// Auth session for current user
	const { data: session } = useSession();
	const currentUserId = session?.user?.id ?? null;

	const [activeTab, setActiveTab] = useState("dashboard");
	const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
	const [showScheduler, setShowScheduler] = useState(false);
	const [editingComment, setEditingComment] = useState<Comment | null>(null);
	const [isPending, startTransition] = useTransition();

	// Data state
	const [reviews, setReviews] = useState<Review[]>([]);
	const [opportunities, setOpportunities] = useState<{ id: string; name: string }[]>([]);
	const [comments, setComments] = useState<Comment[]>([]);
	const [selectedReview, setSelectedReview] = useState<any>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Filters
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [opportunityFilter, setOpportunityFilter] = useState<string>("all");

	// Load reviews and opportunities
	useEffect(() => {
		async function loadData() {
			setIsLoading(true);
			try {
				// Fetch reviews and opportunities in parallel
				const [reviewsResult, oppsResult] = await Promise.all([
					listAllReviews({
						status: statusFilter !== "all" ? statusFilter : undefined,
						reviewType: typeFilter !== "all" ? typeFilter : undefined,
					}),
					getOpportunities(),
				]);

				// Create opportunity name lookup from paginated response
				const oppMap = new Map<string, string>();
				if (oppsResult && oppsResult.data) {
					oppsResult.data.forEach((opp: any) => {
						oppMap.set(opp.id, opp.name || opp.title || "Untitled");
					});
				}

				if (reviewsResult.success && reviewsResult.reviews) {
					// Add opportunity names to reviews
					const reviewsWithNames = reviewsResult.reviews.map((r: any) => ({
						...r,
						opportunityName: oppMap.get(r.opportunityId) || "Unknown Opportunity",
					}));

					// Apply opportunity filter
					const filtered = opportunityFilter === "all"
						? reviewsWithNames
						: reviewsWithNames.filter((r: Review) => r.opportunityId === opportunityFilter);

					setReviews(filtered);
				}

				if (oppsResult && oppsResult.data) {
					setOpportunities(oppsResult.data.map((o: any) => ({
						id: o.id,
						name: o.name || o.title || "Untitled",
					})));
				}

				setError(null);
			} catch (err) {
				setError("Failed to load reviews");
				console.error("Error loading reviews:", err);
			} finally {
				setIsLoading(false);
			}
		}

		loadData();
	}, [statusFilter, typeFilter, opportunityFilter]);

	// Load comments for comments tab
	useEffect(() => {
		async function loadComments() {
			if (activeTab !== "comments" && activeTab !== "resolutions") return;

			// If a review is selected, load its comments; otherwise load from all reviews
			if (selectedReviewId) {
				const result = await getReviewComments(selectedReviewId);
				if (result.success && result.comments) {
					setComments(result.comments as Comment[]);
				}
			} else {
				// Aggregate comments from recent reviews (limit to first 5)
				const recentReviews = reviews.slice(0, 5);
				const allComments: Comment[] = [];

				for (const review of recentReviews) {
					const result = await getReviewComments(review.id);
					if (result.success && result.comments) {
						allComments.push(...(result.comments as Comment[]));
					}
				}
				setComments(allComments);
			}
		}

		loadComments();
	}, [activeTab, selectedReviewId, reviews]);

	// Load full review details when selecting
	useEffect(() => {
		async function loadReviewDetails() {
			if (!selectedReviewId) {
				setSelectedReview(null);
				return;
			}

			const result = await getReview(selectedReviewId);
			if (result.success && result.review) {
				setSelectedReview(result.review);
			}
		}

		loadReviewDetails();
	}, [selectedReviewId]);

	// Handlers
	const handleRefresh = useCallback(() => {
		startTransition(() => {
			// Re-trigger effect by toggling a dummy state
			setStatusFilter(prev => prev);
		});
	}, []);

	const handleResolutionUpdate = useCallback(async (
		itemId: string,
		status: ResolutionItem["status"],
		notes?: string
	) => {
		// Map UI status to API status
		const statusMap: Record<string, "open" | "in_progress" | "resolved" | "deferred" | "duplicate"> = {
			open: "open",
			in_progress: "in_progress",
			resolved: "resolved",
			wont_fix: "duplicate", // Map wont_fix to duplicate for API
			deferred: "deferred",
		};
		const result = await resolveComment(
			itemId,
			{
				resolutionStatus: statusMap[status] || "open",
				resolutionNotes: notes,
			},
			currentUserId ?? "anonymous"
		);

		if (result.success) {
			// Refresh comments
			if (selectedReviewId) {
				const commentsResult = await getReviewComments(selectedReviewId);
				if (commentsResult.success && commentsResult.comments) {
					setComments(commentsResult.comments as Comment[]);
				}
			}
		}
	}, [selectedReviewId, currentUserId]);

	// Handle editing a comment
	const handleEditComment = useCallback((commentId: string) => {
		const comment = comments.find(c => c.id === commentId);
		if (comment) {
			setEditingComment(comment);
		}
	}, [comments]);

	// Handle saving edited comment
	const handleSaveEditedComment = useCallback(async (data: {
		comment: string;
		severity: string;
		category: string;
		tags: string[];
	}) => {
		if (!editingComment) return;

		const result = await updateComment(editingComment.id, {
			comment: data.comment,
			severity: data.severity as "critical" | "major" | "minor" | "editorial",
			category: data.category,
			tags: data.tags,
		});

		if (result.success) {
			setEditingComment(null);
			// Refresh comments
			if (selectedReviewId) {
				const commentsResult = await getReviewComments(selectedReviewId);
				if (commentsResult.success && commentsResult.comments) {
					setComments(commentsResult.comments as Comment[]);
				}
			}
		}
	}, [editingComment, selectedReviewId]);

	// Transform comments to resolution items
	const resolutionItems: ResolutionItem[] = comments
		.filter(c => c.resolutionStatus !== "resolved")
		.map(c => {
			// Map resolution status - "deferred" maps to "wont_fix" if no exact match
			const statusMap: Record<string, "open" | "in_progress" | "resolved" | "wont_fix" | "deferred"> = {
				open: "open",
				in_progress: "in_progress",
				resolved: "resolved",
				deferred: "deferred",
				duplicate: "wont_fix",
			};
			return {
				id: c.id,
				commentId: c.id,
				title: c.title || c.comment.substring(0, 50),
				description: c.comment,
				severity: (c.severity as ResolutionItem["severity"]) || "minor",
				category: c.category || "general",
				sectionName: c.sectionId || undefined,
				status: statusMap[c.resolutionStatus] || "open",
				assignedTo: c.resolvedBy || undefined,
				createdAt: new Date().toISOString(),
				resolvedAt: c.resolvedAt || undefined,
			};
		});

	// Compute metrics
	const computedMetrics = {
		totalReviews: reviews.length,
		completedReviews: reviews.filter(r => r.status === "completed").length,
		avgScore: reviews.filter(r => r.overallScore).reduce((sum, r) => sum + (r.overallScore || 0), 0) /
			(reviews.filter(r => r.overallScore).length || 1),
		totalComments: reviews.reduce((sum, r) => sum + r.totalComments, 0),
		resolvedComments: reviews.reduce((sum, r) => sum + r.resolvedIssues, 0),
		criticalIssues: reviews.reduce((sum, r) => sum + r.criticalIssues, 0),
		avgResolutionDays: 2.3, // Would need to calculate from actual data
		reviewsByType: {
			pink: reviews.filter(r => r.reviewType === "pink").length,
			red: reviews.filter(r => r.reviewType === "red").length,
			gold: reviews.filter(r => r.reviewType === "gold").length,
			compliance: reviews.filter(r => r.reviewType === "compliance").length,
		},
	};

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* Header */}
			<div className="flex-shrink-0 border-b bg-background p-6">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h1 className="text-2xl font-semibold flex items-center gap-2">
							<ClipboardCheck className="h-6 w-6 text-primary" />
							Color Team Reviews
						</h1>
						<p className="text-sm text-muted-foreground mt-1">
							Structured Pink/Red/Gold team reviews with scoring and resolution tracking
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" onClick={handleRefresh} disabled={isPending}>
							<RefreshCw className={`h-4 w-4 mr-2 ${isPending ? "animate-spin" : ""}`} />
							Refresh
						</Button>
						<Button onClick={() => setShowScheduler(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Schedule Review
						</Button>
					</div>
				</div>

				{/* Review Type Legend & Filters */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-6">
						<ReviewTypeBadge type="pink" label="Pink Team" description="Outline review" />
						<ReviewTypeBadge type="red" label="Red Team" description="Full review" />
						<ReviewTypeBadge type="gold" label="Gold Team" description="Final review" />
						<ReviewTypeBadge type="compliance" label="Compliance" description="Requirements check" />
					</div>
					<div className="flex items-center gap-2">
						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger className="w-[130px]">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="scheduled">Scheduled</SelectItem>
								<SelectItem value="in_progress">In Progress</SelectItem>
								<SelectItem value="completed">Completed</SelectItem>
							</SelectContent>
						</Select>
						<Select value={typeFilter} onValueChange={setTypeFilter}>
							<SelectTrigger className="w-[130px]">
								<SelectValue placeholder="Type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Types</SelectItem>
								<SelectItem value="pink">Pink</SelectItem>
								<SelectItem value="red">Red</SelectItem>
								<SelectItem value="gold">Gold</SelectItem>
								<SelectItem value="compliance">Compliance</SelectItem>
							</SelectContent>
						</Select>
						<Select value={opportunityFilter} onValueChange={setOpportunityFilter}>
							<SelectTrigger className="w-[180px]">
								<SelectValue placeholder="Opportunity" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Opportunities</SelectItem>
								{opportunities.map(opp => (
									<SelectItem key={opp.id} value={opp.id}>{opp.name}</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="flex-1 overflow-hidden">
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="h-full flex flex-col"
				>
					<div className="flex-shrink-0 border-b px-6">
						<TabsList className="h-12 bg-transparent border-b-0">
							<TabsTrigger
								value="dashboard"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<Calendar className="h-4 w-4 mr-2" />
								Review Schedule
							</TabsTrigger>
							<TabsTrigger
								value="comments"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<MessageSquare className="h-4 w-4 mr-2" />
								All Comments
								{comments.length > 0 && (
									<Badge variant="secondary" className="ml-2">
										{comments.filter(c => c.resolutionStatus === "open").length}
									</Badge>
								)}
							</TabsTrigger>
							<TabsTrigger
								value="resolutions"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<CheckCircle className="h-4 w-4 mr-2" />
								Resolutions
								{resolutionItems.length > 0 && (
									<Badge variant="outline" className="ml-2">
										{resolutionItems.length}
									</Badge>
								)}
							</TabsTrigger>
							<TabsTrigger
								value="metrics"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<BarChart2 className="h-4 w-4 mr-2" />
								Metrics
							</TabsTrigger>
						</TabsList>
					</div>

					<div className="flex-1 overflow-auto">
						<TabsContent value="dashboard" className="h-full m-0 p-6">
							{isLoading ? (
								<ReviewDashboardSkeleton />
							) : error ? (
								<div className="text-center py-8 text-red-500">{error}</div>
							) : (
								<ReviewDashboard
									reviews={reviews}
									onSelectReview={setSelectedReviewId}
								/>
							)}
						</TabsContent>

						<TabsContent value="comments" className="h-full m-0 p-6">
							{comments.length > 0 ? (
								<CommentPanel
									comments={comments.map(c => {
										// Map database comment types to UI component types
										const typeMap: Record<string, "strength" | "weakness" | "suggestion" | "question" | "critical" | "compliment" | "compliance_gap" | "theme_opportunity"> = {
											strength: "strength",
											weakness: "weakness",
											suggestion: "suggestion",
											question: "question",
											critical: "critical",
											correction: "suggestion", // Map correction to suggestion
											compliance: "compliance_gap", // Map compliance to compliance_gap
											editorial: "suggestion", // Map editorial to suggestion
											compliment: "compliment",
											compliance_gap: "compliance_gap",
											theme_opportunity: "theme_opportunity",
										};
										return {
											id: c.id,
											reviewerId: c.reviewerId,
											reviewerName: c.reviewerName || "Anonymous",
											commentType: typeMap[c.commentType] || "suggestion",
											severity: c.severity as "critical" | "major" | "minor" | "editorial" | undefined,
											category: c.category,
											title: c.title || undefined,
											comment: c.comment,
											sectionId: c.sectionId || undefined,
											isAnonymous: !c.reviewerName,
											resolutionStatus: c.resolutionStatus as "open" | "in_progress" | "resolved" | "deferred" | "duplicate",
											tags: c.tags || [],
											createdAt: new Date().toISOString(),
										};
									})}
									onEditComment={handleEditComment}
									onResolveComment={(id) => handleResolutionUpdate(id, "resolved")}
								/>
							) : (
								<div className="text-center py-8 text-muted-foreground">
									No comments found. Select a review to view its comments.
								</div>
							)}
						</TabsContent>

						<TabsContent value="resolutions" className="h-full m-0 p-6">
							{resolutionItems.length > 0 ? (
								<ResolutionTracker
									items={resolutionItems}
									onUpdateStatus={handleResolutionUpdate}
								/>
							) : (
								<div className="text-center py-8 text-muted-foreground">
									No open resolutions. All issues have been resolved!
								</div>
							)}
						</TabsContent>

						<TabsContent value="metrics" className="h-full m-0 p-6">
							<ReviewMetricsDisplay metrics={computedMetrics} />
						</TabsContent>
					</div>
				</Tabs>
			</div>

			{/* Review Scheduler Modal */}
			{showScheduler && opportunities.length > 0 && (
				<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
					<div className="bg-background rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
						<div className="p-6">
							<div className="flex items-center justify-between mb-4">
								<h2 className="text-lg font-semibold">Schedule New Review</h2>
								<Button variant="ghost" size="sm" onClick={() => setShowScheduler(false)}>
									<X className="h-4 w-4" />
								</Button>
							</div>
							<ReviewScheduler
								opportunityId={opportunityFilter !== "all" ? opportunityFilter : opportunities[0]?.id || ""}
								onSchedule={async () => {
									setShowScheduler(false);
									handleRefresh();
								}}
								onCancel={() => setShowScheduler(false)}
							/>
						</div>
					</div>
				</div>
			)}

			{/* Review Detail Side Panel */}
			{selectedReviewId && selectedReview && (
				<div className="fixed right-0 top-0 h-full w-[700px] bg-background border-l shadow-xl z-50 overflow-y-auto">
					<ReviewDetailPanel
						review={selectedReview}
						onClose={() => setSelectedReviewId(null)}
					/>
				</div>
			)}

			{/* Edit Comment Modal */}
			{editingComment && (
				<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
					<div className="bg-background rounded-lg max-w-xl w-full mx-4 max-h-[90vh] overflow-y-auto">
						<div className="p-6">
							<div className="flex items-center justify-between mb-4">
								<h2 className="text-lg font-semibold">Edit Comment</h2>
								<Button variant="ghost" size="sm" onClick={() => setEditingComment(null)}>
									<X className="h-4 w-4" />
								</Button>
							</div>
							<CommentEditForm
								comment={editingComment}
								onSave={handleSaveEditedComment}
								onCancel={() => setEditingComment(null)}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function ReviewTypeBadge({
	type,
	label,
	description
}: {
	type: "pink" | "red" | "gold" | "compliance";
	label: string;
	description: string;
}) {
	const colors = {
		pink: "bg-pink-100 text-pink-700 border-pink-200",
		red: "bg-red-100 text-red-700 border-red-200",
		gold: "bg-amber-100 text-amber-700 border-amber-200",
		compliance: "bg-blue-100 text-blue-700 border-blue-200",
	};

	return (
		<div className="flex items-center gap-2">
			<span className={`px-2 py-1 rounded text-xs font-medium border ${colors[type]}`}>
				{label}
			</span>
			<span className="text-xs text-muted-foreground">{description}</span>
		</div>
	);
}

function ReviewDashboard({
	reviews,
	onSelectReview,
}: {
	reviews: Review[];
	onSelectReview: (id: string) => void;
}) {
	const getTypeColor = (type: string) => {
		switch (type) {
			case "pink": return "bg-pink-100 text-pink-700";
			case "red": return "bg-red-100 text-red-700";
			case "gold": return "bg-amber-100 text-amber-700";
			default: return "bg-blue-100 text-blue-700";
		}
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "completed": return <Badge variant="default">Completed</Badge>;
			case "in_progress": return <Badge variant="secondary">In Progress</Badge>;
			default: return <Badge variant="outline">Scheduled</Badge>;
		}
	};

	if (reviews.length === 0) {
		return (
			<div className="text-center py-12">
				<ClipboardCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
				<h3 className="text-lg font-medium mb-2">No Reviews Found</h3>
				<p className="text-sm text-muted-foreground">
					Schedule a review to get started with the formal review process.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-lg">Reviews ({reviews.length})</h3>
			</div>
			<div className="space-y-4">
				{reviews.map((review) => (
					<Card
						key={review.id}
						className="cursor-pointer hover:shadow-md transition-shadow"
						onClick={() => onSelectReview(review.id)}
					>
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div>
									<div className="flex items-center gap-2 mb-1">
										<h4 className="font-medium">{review.reviewName}</h4>
										<Badge className={getTypeColor(review.reviewType)}>
											{review.reviewType}
										</Badge>
									</div>
									<p className="text-sm text-muted-foreground">{review.opportunityName}</p>
									<div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
										<span className="flex items-center gap-1">
											<Calendar className="h-3 w-3" />
											{review.scheduledDate ? new Date(review.scheduledDate).toLocaleDateString() : "Not scheduled"}
										</span>
										<span className="flex items-center gap-1">
											<MessageSquare className="h-3 w-3" />
											{review.totalComments} comments
										</span>
										<span className="flex items-center gap-1">
											<Users className="h-3 w-3" />
											{review.reviewerCount} reviewers
										</span>
									</div>
								</div>
								<div className="flex items-center gap-3">
									{review.criticalIssues > 0 && (
										<div className="flex items-center gap-1 text-red-600">
											<AlertTriangle className="h-4 w-4" />
											<span className="text-sm font-medium">{review.criticalIssues}</span>
										</div>
									)}
									{review.overallScore !== null && (
										<div className="text-right">
											<div className="text-lg font-bold">{Math.round(review.overallScore)}%</div>
											<div className="text-xs text-muted-foreground">Score</div>
										</div>
									)}
									{getStatusBadge(review.status)}
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

function ReviewDashboardSkeleton() {
	return (
		<div className="space-y-4">
			{[1, 2, 3].map((i) => (
				<Card key={i}>
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div className="space-y-2">
								<Skeleton className="h-5 w-48" />
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-3 w-64" />
							</div>
							<Skeleton className="h-10 w-20" />
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

function ReviewMetricsDisplay({ metrics }: { metrics: any }) {
	return (
		<div className="space-y-6">
			<div className="grid md:grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-3xl font-bold">{metrics.completedReviews}</div>
						<div className="text-sm text-muted-foreground">Reviews Completed</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-3xl font-bold text-green-600">{Math.round(metrics.avgScore)}%</div>
						<div className="text-sm text-muted-foreground">Avg Score</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-3xl font-bold">{metrics.resolvedComments}</div>
						<div className="text-sm text-muted-foreground">Comments Resolved</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-3xl font-bold text-blue-600">{metrics.avgResolutionDays}d</div>
						<div className="text-sm text-muted-foreground">Avg Resolution Time</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid md:grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Reviews by Type</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{Object.entries(metrics.reviewsByType).map(([type, count]) => (
								<div key={type} className="flex items-center justify-between">
									<span className="text-sm capitalize">{type} Team</span>
									<div className="flex items-center gap-2">
										<div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
											<div
												className={`h-full ${
													type === "pink" ? "bg-pink-500" :
													type === "red" ? "bg-red-500" :
													type === "gold" ? "bg-amber-500" :
													"bg-blue-500"
												}`}
												style={{ width: `${((count as number) / metrics.totalReviews) * 100}%` }}
											/>
										</div>
										<span className="text-sm font-medium w-8 text-right">{count as number}</span>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Issue Summary</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-sm">Total Comments</span>
								<span className="font-medium">{metrics.totalComments}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-sm">Resolved</span>
								<span className="font-medium text-green-600">{metrics.resolvedComments}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-sm">Critical Issues</span>
								<span className="font-medium text-red-600">{metrics.criticalIssues}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-sm">Resolution Rate</span>
								<span className="font-medium">
									{metrics.totalComments > 0
										? Math.round((metrics.resolvedComments / metrics.totalComments) * 100)
										: 0}%
								</span>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function ReviewDetailPanel({ review, onClose }: { review: any; onClose: () => void }) {
	const [activeSection, setActiveSection] = useState<"review" | "scores" | "compare">("review");

	return (
		<div className="h-full flex flex-col">
			<div className="flex-shrink-0 p-6 border-b">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h2 className="text-lg font-semibold">{review.reviewName}</h2>
						<p className="text-sm text-muted-foreground">{review.description || "No description"}</p>
					</div>
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<div className="flex gap-2">
					<Button
						variant={activeSection === "review" ? "secondary" : "ghost"}
						size="sm"
						onClick={() => setActiveSection("review")}
					>
						<Users className="h-4 w-4 mr-1" />
						Review
					</Button>
					<Button
						variant={activeSection === "scores" ? "secondary" : "ghost"}
						size="sm"
						onClick={() => setActiveSection("scores")}
					>
						<BarChart2 className="h-4 w-4 mr-1" />
						Scores
					</Button>
					<Button
						variant={activeSection === "compare" ? "secondary" : "ghost"}
						size="sm"
						onClick={() => setActiveSection("compare")}
					>
						<CheckCircle className="h-4 w-4 mr-1" />
						Before/After
					</Button>
				</div>
			</div>

			<div className="flex-1 overflow-auto p-6">
				{activeSection === "review" && (
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Review Details</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-2 gap-4 text-sm">
									<div>
										<span className="text-muted-foreground">Type:</span>
										<span className="ml-2 font-medium capitalize">{review.reviewType}</span>
									</div>
									<div>
										<span className="text-muted-foreground">Status:</span>
										<span className="ml-2 font-medium capitalize">{review.status}</span>
									</div>
									<div>
										<span className="text-muted-foreground">Scheduled:</span>
										<span className="ml-2 font-medium">
											{review.scheduledDate ? new Date(review.scheduledDate).toLocaleDateString() : "TBD"}
										</span>
									</div>
									<div>
										<span className="text-muted-foreground">Scope:</span>
										<span className="ml-2 font-medium capitalize">{review.scopeType}</span>
									</div>
								</div>
							</CardContent>
						</Card>

						{review.reviewers && review.reviewers.length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle className="text-base flex items-center gap-2">
										<Users className="h-4 w-4" />
										Assigned Reviewers ({review.reviewers.length})
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-2">
										{review.reviewers.map((reviewer: any) => (
											<div key={reviewer.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
												<div>
													<p className="text-sm font-medium">{reviewer.name || "Anonymous"}</p>
													<p className="text-xs text-muted-foreground">{reviewer.role || "Reviewer"}</p>
												</div>
												<Badge variant={reviewer.status === "completed" ? "default" : "outline"}>
													{reviewer.status}
												</Badge>
											</div>
										))}
									</div>
								</CardContent>
							</Card>
						)}
					</div>
				)}

				{activeSection === "scores" && (
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Score Summary</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-center p-6">
									<div className="text-5xl font-bold text-green-600 mb-2">
										{review.overallScore ? Math.round(review.overallScore) : "N/A"}
									</div>
									<div className="text-sm text-muted-foreground">Overall Score</div>
									{review.recommendation && (
										<Badge className="mt-2" variant="outline">
											{review.recommendation.replace(/_/g, " ")}
										</Badge>
									)}
								</div>
							</CardContent>
						</Card>
					</div>
				)}

				{activeSection === "compare" && (
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Before/After Comparison</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground text-center py-8">
								Before/After comparison available after review completion.
							</p>
						</CardContent>
					</Card>
				)}
			</div>

			<div className="flex-shrink-0 p-6 border-t">
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm font-medium">Review Report</p>
						<p className="text-xs text-muted-foreground">Generate comprehensive review report</p>
					</div>
					<Button variant="outline" size="sm">
						<FileText className="h-4 w-4 mr-2" />
						Generate Report
					</Button>
				</div>
			</div>
		</div>
	);
}

function CommentEditForm({
	comment,
	onSave,
	onCancel,
}: {
	comment: Comment;
	onSave: (data: { comment: string; severity: string; category: string; tags: string[] }) => void;
	onCancel: () => void;
}) {
	const [text, setText] = useState(comment.comment);
	const [severity, setSeverity] = useState(comment.severity);
	const [category, setCategory] = useState(comment.category);
	const [tagsInput, setTagsInput] = useState((comment.tags || []).join(", "));
	const [isSaving, setIsSaving] = useState(false);

	const handleSave = async () => {
		setIsSaving(true);
		const tags = tagsInput.split(",").map(t => t.trim()).filter(t => t.length > 0);
		await onSave({ comment: text, severity, category, tags });
		setIsSaving(false);
	};

	return (
		<div className="space-y-4">
			<div>
				<span className="text-sm font-medium block mb-1">Comment</span>
				<textarea
					value={text}
					onChange={(e) => setText(e.target.value)}
					className="w-full min-h-[120px] p-3 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
					placeholder="Enter comment text..."
				 aria-label="Comment"/>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div>
					<span className="text-sm font-medium block mb-1">Severity</span>
					<Select value={severity} onValueChange={setSeverity}>
						<SelectTrigger aria-label="Severity">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="critical">Critical</SelectItem>
							<SelectItem value="major">Major</SelectItem>
							<SelectItem value="minor">Minor</SelectItem>
							<SelectItem value="editorial">Editorial</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div>
					<span className="text-sm font-medium block mb-1">Category</span>
					<Select value={category} onValueChange={setCategory}>
						<SelectTrigger aria-label="Category">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="technical">Technical</SelectItem>
							<SelectItem value="management">Management</SelectItem>
							<SelectItem value="past_performance">Past Performance</SelectItem>
							<SelectItem value="cost">Cost/Price</SelectItem>
							<SelectItem value="compliance">Compliance</SelectItem>
							<SelectItem value="other">Other</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<div>
				<span className="text-sm font-medium block mb-1">Tags (comma-separated)</span>
				<input
					type="text"
					value={tagsInput}
					onChange={(e) => setTagsInput(e.target.value)}
					className="w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
					placeholder="e.g., pricing, scope, team"
				 aria-label="Tags (comma-separated)"/>
			</div>

			<div className="flex items-center justify-end gap-2 pt-4 border-t">
				<Button variant="outline" onClick={onCancel} disabled={isSaving}>
					Cancel
				</Button>
				<Button onClick={handleSave} disabled={isSaving || !text.trim()}>
					{isSaving ? "Saving..." : "Save Changes"}
				</Button>
			</div>
		</div>
	);
}
