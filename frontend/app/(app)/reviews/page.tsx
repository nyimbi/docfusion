/**
 * Reviews Page
 *
 * Formal Review Process (Pink/Red/Gold Team) with structured templates,
 * anonymous scoring, resolution tracking, and effectiveness metrics.
 */

"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
	Star,
} from "lucide-react";

export default function ReviewsPage() {
	const [activeTab, setActiveTab] = React.useState("dashboard");
	const [selectedReviewId, setSelectedReviewId] = React.useState<string | null>(null);
	const [showScheduler, setShowScheduler] = React.useState(false);

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
						<Button onClick={() => setShowScheduler(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Schedule Review
						</Button>
					</div>
				</div>

				{/* Review Type Legend */}
				<div className="flex items-center gap-6">
					<ReviewTypeBadge type="pink" label="Pink Team" description="Outline review" />
					<ReviewTypeBadge type="red" label="Red Team" description="Full review" />
					<ReviewTypeBadge type="gold" label="Gold Team" description="Final review" />
					<ReviewTypeBadge type="compliance" label="Compliance" description="Requirements check" />
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
							</TabsTrigger>
							<TabsTrigger
								value="resolutions"
								className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
							>
								<CheckCircle className="h-4 w-4 mr-2" />
								Resolutions
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
							<ReviewDashboardPlaceholder
								onSelectReview={setSelectedReviewId}
							/>
						</TabsContent>
						<TabsContent value="comments" className="h-full m-0 p-6">
							<CommentPanelPlaceholder reviewId={selectedReviewId} />
						</TabsContent>
						<TabsContent value="resolutions" className="h-full m-0 p-6">
							<ResolutionTrackerPlaceholder />
						</TabsContent>
						<TabsContent value="metrics" className="h-full m-0 p-6">
							<ReviewMetricsPlaceholder />
						</TabsContent>
					</div>
				</Tabs>
			</div>

			{/* Review Scheduler Modal */}
			{showScheduler && (
				<ReviewSchedulerPlaceholder onClose={() => setShowScheduler(false)} />
			)}

			{/* Review Detail Side Panel */}
			{selectedReviewId && (
				<div className="fixed right-0 top-0 h-full w-[700px] bg-background border-l shadow-xl z-50 overflow-y-auto">
					<ReviewDetailPanel
						reviewId={selectedReviewId}
						onClose={() => setSelectedReviewId(null)}
					/>
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

function ReviewDetailPanel({ reviewId, onClose }: { reviewId: string; onClose: () => void }) {
	const [activeSection, setActiveSection] = React.useState<"review" | "scores" | "compare">("review");

	return (
		<div className="h-full flex flex-col">
			<div className="flex-shrink-0 p-6 border-b">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold">Review Details</h2>
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
					<>
						<ReviewInterfacePlaceholder reviewId={reviewId} />
						<div className="mt-6">
							<ReviewerAssignmentPlaceholder reviewId={reviewId} />
						</div>
					</>
				)}
				{activeSection === "scores" && (
					<>
						<ScoringRubricPlaceholder reviewId={reviewId} />
						<div className="mt-6">
							<ScoreAggregationPlaceholder reviewId={reviewId} />
						</div>
					</>
				)}
				{activeSection === "compare" && (
					<BeforeAfterViewPlaceholder reviewId={reviewId} />
				)}
			</div>
			<div className="flex-shrink-0 p-6 border-t">
				<ReviewReportPlaceholder reviewId={reviewId} />
			</div>
		</div>
	);
}

// Placeholder Components

function ReviewDashboardPlaceholder({
	onSelectReview,
}: {
	onSelectReview: (id: string) => void;
}) {
	const reviews = [
		{ id: "1", name: "DoD Cloud - Pink Team", type: "pink", opportunity: "DoD Cloud Services", date: "2024-02-10", status: "completed", score: 78 },
		{ id: "2", name: "DoD Cloud - Red Team", type: "red", opportunity: "DoD Cloud Services", date: "2024-02-18", status: "in_progress", score: null },
		{ id: "3", name: "VA Portal - Gold Team", type: "gold", opportunity: "VA Health Portal", date: "2024-02-22", status: "scheduled", score: null },
		{ id: "4", name: "DHS Cyber - Compliance", type: "compliance", opportunity: "DHS Cyber Defense", date: "2024-02-15", status: "completed", score: 92 },
	];

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

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-lg">Upcoming & Recent Reviews</h3>
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
										<h4 className="font-medium">{review.name}</h4>
										<Badge className={getTypeColor(review.type)}>
											{review.type}
										</Badge>
									</div>
									<p className="text-sm text-muted-foreground">{review.opportunity}</p>
									<p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
										<Calendar className="h-3 w-3" />
										{review.date}
									</p>
								</div>
								<div className="flex items-center gap-3">
									{review.score !== null && (
										<div className="text-right">
											<div className="text-lg font-bold">{review.score}%</div>
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

function CommentPanelPlaceholder({ reviewId }: { reviewId: string | null }) {
	const comments = [
		{ id: "1", section: "Executive Summary", reviewer: "Anonymous", type: "critical", comment: "Need stronger opening hook", status: "open" },
		{ id: "2", section: "Technical Approach", reviewer: "Anonymous", type: "major", comment: "Cloud architecture diagram unclear", status: "resolved" },
		{ id: "3", section: "Past Performance", reviewer: "Anonymous", type: "minor", comment: "Add contract dates", status: "open" },
		{ id: "4", section: "Pricing", reviewer: "Anonymous", type: "editorial", comment: "Format numbers consistently", status: "open" },
	];

	const getTypeColor = (type: string) => {
		switch (type) {
			case "critical": return "bg-red-100 text-red-700";
			case "major": return "bg-orange-100 text-orange-700";
			case "minor": return "bg-yellow-100 text-yellow-700";
			default: return "bg-blue-100 text-blue-700";
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-lg">All Comments</h3>
				<div className="text-sm text-muted-foreground">
					{comments.filter(c => c.status === "open").length} open / {comments.length} total
				</div>
			</div>
			<div className="space-y-3">
				{comments.map((comment) => (
					<Card key={comment.id}>
						<CardContent className="p-4">
							<div className="flex items-start justify-between gap-4">
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-1">
										<span className="text-sm font-medium">{comment.section}</span>
										<Badge className={`text-xs ${getTypeColor(comment.type)}`}>
											{comment.type}
										</Badge>
									</div>
									<p className="text-sm">{comment.comment}</p>
									<p className="text-xs text-muted-foreground mt-1">{comment.reviewer}</p>
								</div>
								<Badge variant={comment.status === "resolved" ? "default" : "outline"}>
									{comment.status}
								</Badge>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

function ResolutionTrackerPlaceholder() {
	const resolutions = [
		{ id: "1", comment: "Need stronger opening hook", assignee: "Sarah Johnson", dueDate: "Feb 15", status: "in_progress" },
		{ id: "2", comment: "Add contract dates", assignee: "Michael Chen", dueDate: "Feb 14", status: "completed" },
		{ id: "3", comment: "Format numbers consistently", assignee: "Emily Rodriguez", dueDate: "Feb 16", status: "pending" },
	];

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-lg">Resolution Tracker</h3>
				<div className="text-sm text-muted-foreground">
					{resolutions.filter(r => r.status === "completed").length} resolved / {resolutions.length} total
				</div>
			</div>
			<div className="space-y-3">
				{resolutions.map((resolution) => (
					<Card key={resolution.id}>
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium">{resolution.comment}</p>
									<p className="text-xs text-muted-foreground mt-1">
										Assigned to: {resolution.assignee} - Due: {resolution.dueDate}
									</p>
								</div>
								<Badge variant={
									resolution.status === "completed" ? "default" :
									resolution.status === "in_progress" ? "secondary" : "outline"
								}>
									{resolution.status.replace("_", " ")}
								</Badge>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

function ReviewMetricsPlaceholder() {
	return (
		<div className="space-y-6">
			<div className="grid md:grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-3xl font-bold">12</div>
						<div className="text-sm text-muted-foreground">Reviews Completed</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-3xl font-bold text-green-600">85%</div>
						<div className="text-sm text-muted-foreground">Avg Score</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-3xl font-bold">156</div>
						<div className="text-sm text-muted-foreground">Comments Resolved</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-3xl font-bold text-blue-600">2.3d</div>
						<div className="text-sm text-muted-foreground">Avg Resolution Time</div>
					</CardContent>
				</Card>
			</div>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Review Score Trends</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{[
							{ review: "Pink Team 1", score: 72 },
							{ review: "Red Team 1", score: 78 },
							{ review: "Pink Team 2", score: 82 },
							{ review: "Red Team 2", score: 85 },
							{ review: "Gold Team", score: 91 },
						].map((item) => (
							<div key={item.review} className="flex items-center justify-between">
								<span className="text-sm">{item.review}</span>
								<div className="flex items-center gap-2">
									<div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
										<div
											className="h-full bg-primary"
											style={{ width: `${item.score}%` }}
										/>
									</div>
									<span className="text-sm font-medium w-12 text-right">{item.score}%</span>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function ReviewSchedulerPlaceholder({ onClose }: { onClose: () => void }) {
	return (
		<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
			<div className="bg-background rounded-lg p-6 max-w-lg w-full mx-4">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold">Schedule Review</h2>
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<div className="space-y-4">
					<div>
						<label className="text-sm font-medium">Review Type</label>
						<Input placeholder="Select review type" className="mt-1" />
					</div>
					<div>
						<label className="text-sm font-medium">Opportunity</label>
						<Input placeholder="Select opportunity" className="mt-1" />
					</div>
					<div>
						<label className="text-sm font-medium">Date</label>
						<Input type="date" className="mt-1" />
					</div>
					<div>
						<label className="text-sm font-medium">Reviewers</label>
						<Input placeholder="Add reviewers" className="mt-1" />
					</div>
				</div>
				<div className="flex justify-end gap-2 mt-6">
					<Button variant="outline" onClick={onClose}>Cancel</Button>
					<Button>Schedule</Button>
				</div>
			</div>
		</div>
	);
}

function ReviewInterfacePlaceholder({ reviewId }: { reviewId: string }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Review Interface</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					<div className="p-4 bg-muted/50 rounded-lg">
						<h4 className="font-medium mb-2">Executive Summary</h4>
						<p className="text-sm text-muted-foreground">Section ready for review</p>
					</div>
					<div className="p-4 bg-muted/50 rounded-lg">
						<h4 className="font-medium mb-2">Technical Approach</h4>
						<p className="text-sm text-muted-foreground">Section ready for review</p>
					</div>
					<div className="p-4 bg-muted/50 rounded-lg">
						<h4 className="font-medium mb-2">Management Approach</h4>
						<p className="text-sm text-muted-foreground">Section ready for review</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function ReviewerAssignmentPlaceholder({ reviewId }: { reviewId: string }) {
	const reviewers = [
		{ name: "John Doe", role: "Technical Reviewer", status: "active" },
		{ name: "Jane Smith", role: "Management Reviewer", status: "active" },
		{ name: "Bob Wilson", role: "Pricing Reviewer", status: "pending" },
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base flex items-center gap-2">
					<Users className="h-4 w-4" />
					Assigned Reviewers
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{reviewers.map((reviewer) => (
						<div key={reviewer.name} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
							<div>
								<p className="text-sm font-medium">{reviewer.name}</p>
								<p className="text-xs text-muted-foreground">{reviewer.role}</p>
							</div>
							<Badge variant={reviewer.status === "active" ? "default" : "outline"}>
								{reviewer.status}
							</Badge>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function ScoringRubricPlaceholder({ reviewId }: { reviewId: string }) {
	const criteria = [
		{ name: "Technical Approach", weight: 30, score: 85 },
		{ name: "Management Approach", weight: 25, score: 78 },
		{ name: "Past Performance", weight: 25, score: 92 },
		{ name: "Pricing", weight: 20, score: 75 },
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Scoring Rubric</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{criteria.map((item) => (
						<div key={item.name} className="space-y-1">
							<div className="flex items-center justify-between text-sm">
								<span className="font-medium">{item.name}</span>
								<span>{item.score}/100 ({item.weight}% weight)</span>
							</div>
							<div className="h-2 bg-muted rounded-full overflow-hidden">
								<div
									className="h-full bg-primary"
									style={{ width: `${item.score}%` }}
								/>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function ScoreAggregationPlaceholder({ reviewId }: { reviewId: string }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Score Summary</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="text-center p-6">
					<div className="text-5xl font-bold text-green-600 mb-2">82.8</div>
					<div className="text-sm text-muted-foreground">Weighted Average Score</div>
					<div className="flex items-center justify-center gap-1 mt-2">
						{[1,2,3,4,5].map((n) => (
							<Star
								key={n}
								className={`h-5 w-5 ${n <= 4 ? "text-yellow-500 fill-yellow-500" : "text-muted"}`}
							/>
						))}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function BeforeAfterViewPlaceholder({ reviewId }: { reviewId: string }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Before/After Comparison</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<h4 className="text-sm font-medium mb-2 text-red-600">Before</h4>
						<div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm">
							"Our team has experience in cloud solutions..."
						</div>
					</div>
					<div>
						<h4 className="text-sm font-medium mb-2 text-green-600">After</h4>
						<div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm">
							"Our team has successfully delivered 15 cloud migration projects totaling $50M..."
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function ReviewReportPlaceholder({ reviewId }: { reviewId: string }) {
	return (
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
	);
}
